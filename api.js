/* ============================================================
 * エルピーヤ — api.js
 * Supabase REST（https://hhmresepzahfhwhywxhu.supabase.co）専用の fetch ラッパー。
 * 画面は描画しない。localStorage には言語設定と選択中IDだけを置き、業務データは必ず Supabase に置く。
 * SDK・CDN は使わない。fetch のみ。
 *
 * ---- 他ファイルとの共通契約（この名前どおりに呼ぶこと。似た名前を作らない）----
 * 表ごとのCRUD（すべて Promise を返す）
 *   Api.users / Api.projects / Api.analysisReports / Api.generations /
 *   Api.creditTransactions / Api.featureCredits / Api.coupons / Api.inquiries
 *     .list(options)     -> 行の配列
 *     .first(options)    -> 先頭の行 または null
 *     .get(id)           -> 行（無ければ ApiError code='notfound'）
 *     .insert(row)       -> 作成した行（id・created_at は送らない。自動で除去する）
 *     .update(id, patch) -> 更新した行
 *     .remove(id)        -> true
 *     .count(options)    -> 件数
 *
 *   options = {
 *     select: '*',                          // 既定 '*'
 *     order: 'created_at.desc',             // 既定。false を渡すと order を付けない
 *     limit: 20, offset: 0,
 *     eq:      { users_id: 'xxx' },         // 完全一致
 *     neq:     { user_status: 'stopped' },
 *     ilike:   { project_name: '春' },      // 部分一致（前後に * を付けて送る）
 *     in:      { id: ['a', 'b'] },
 *     filters: { credit_balance: 'gte.10' } // 生のフィルタ文字列
 *   }
 *
 * 認証（Supabase Auth。パスワードはこのファイルもDBも保存しない）
 *   Api.auth.signUp(email, password, displayName) -> { user, needsConfirmation }
 *   Api.auth.signIn(email, password)              -> 自分の users 行
 *   Api.auth.signInWithGoogle(redirectTo)         -> 画面ごと遷移する（戻り値なし）
 *   Api.auth.consumeRedirect()                    -> OAuth から戻った直後に1回呼ぶ
 *   Api.auth.restore()                            -> 自分の users 行 または null
 *   Api.auth.signOut() / Api.auth.session() / Api.auth.userId() / Api.auth.profile()
 *   Api.auth.resetPassword(email) / Api.auth.updatePassword(password)
 *
 * クレジット（残高を動かすのはサーバー側の関数だけ。クライアントは金額も数量も送らない）
 *   Api.credits.balance(userId)
 *   Api.credits.consume(featureKey, memo)   単価はサーバーが feature_credits から引く
 *   Api.credits.redeemCoupon(code)
 *   Api.credits.plans()                     購入プラン一覧（金額の出どころは Edge Function）
 *   Api.credits.checkout(planId)            -> Stripe の決済ページURL
 *   Api.credits.grant(userId, credits, memo)          管理者のみ
 *   Api.credits.grantUnlimited(userId, days, memo)    管理者のみ
 *   Api.credits.setUserStatus(userId, status)         管理者のみ
 *   Api.credits.history(userId, limit)
 *   Api.credits.featureCosts()
 *   Api.credits.costOf(featureKey)
 *   Api.credits.hasUnlimited(user)
 *
 * 直接呼びたいとき
 *   Api.rpc(name, params)          Supabase の関数
 *   Api.fn(name, body, method)     Edge Function
 *
 * 端末に置いてよいものだけを扱う保管庫
 *   Api.storage.get(name) / Api.storage.set(name, value) / Api.storage.remove(name)
 *   Api.storage.clearSelection()
 *   name は 'lang' | 'session' | 'userId' | 'projectId' | 'analysisReportId' | 'generationId' のみ。
 *   それ以外の名前を渡したときは保存せず、何が拒否されたかをコンソールに残す。
 *   実キーは 'elpiya.lang' のように STORAGE_PREFIX 付き。i18n.js も言語は 'elpiya.lang' を使う。
 *
 * 失敗時
 *   reject される値は必ず ApiError。
 *     err.message  日本語の説明（そのまま画面に出してよい）
 *     err.code     'network' | 'timeout' | 'unauthorized' | 'notfound' | 'conflict' |
 *                  'validation' | 'server' | 'parse' | 'insufficient' | 'coupon…' |
 *                  'invalidLogin' | 'emailTaken' | 'weakPassword' | 'emailNotConfirmed' |
 *                  'loginRequired' | 'unknown'
 *     insufficient のときだけ err.balance（現在の残高）と err.shortage（不足分）が付く
 *     err.status   HTTPステータス（通信自体が届かなかったときは 0）
 *     err.detail   サーバーからの生の応答（調査用）
 *     err.retry()  同じ処理をやり直し、同じ形の Promise を返す（エラーバナーの再試行ボタン用）
 *
 * その他
 *   Api.today()        'YYYY-MM-DD'（last_login_at などの日付欄用）
 *   Api.addDays(d, n)  'YYYY-MM-DD'
 *   Api.TABLES         実際のテーブル名
 *   Api._selfTest()    通信なしの自己チェック（開発時にコンソールから呼ぶ）
 * ============================================================ */

(function (global) {
  'use strict';

  /* ---------- 接続情報 ---------- */
  var SUPABASE_URL = 'https://hhmresepzahfhwhywxhu.supabase.co';
  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhobXJlc2VwemFoZmh3aHl3eGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNzU0MDQsImV4cCI6MjEwMTY1MTQwNH0.SXJqKH75xKEE3Bdmort2A_vUzkG15rktpokOZn1QqfU';
  var REST_BASE = SUPABASE_URL + '/rest/v1/';
  var AUTH_BASE = SUPABASE_URL + '/auth/v1/';
  var FUNCTIONS_BASE = SUPABASE_URL + '/functions/v1/';
  var TABLE_PREFIX = 'a2f58db45_';
  var TIMEOUT_MS = 15000;
  var AUTO_RETRY_DELAY_MS = 700;
  var STORAGE_PREFIX = 'elpiya.';
  // Google ログインは Supabase 側に OAuth を設定するまで使えない。未設定のまま
  // authorize へ飛ばすと 400 が返り、アプリを離れて生のエラーJSONが表示される。
  // docs/SUPABASE-SETUP.md の手順4 を終えたら true にする（ここ1か所だけ）。
  var GOOGLE_LOGIN_ENABLED = false;
  // session はログイン状態そのもの。これだけは端末に置かないと開くたびログインになる。
  var ALLOWED_STORAGE_KEYS = ['lang', 'session', 'userId', 'projectId', 'analysisReportId', 'generationId'];

  var TABLES = {
    users: TABLE_PREFIX + 'users',
    projects: TABLE_PREFIX + 'projects',
    analysisReports: TABLE_PREFIX + 'analysis_reports',
    generations: TABLE_PREFIX + 'generations',
    generationJobs: TABLE_PREFIX + 'generation_jobs',
    creditTransactions: TABLE_PREFIX + 'credit_transactions',
    featureCredits: TABLE_PREFIX + 'feature_credits',
    coupons: TABLE_PREFIX + 'coupons',
    inquiries: TABLE_PREFIX + 'inquiries'
  };

  /* ---------- 日本語エラーメッセージ ---------- */
  var MESSAGES = {
    network: '通信に失敗しました。ネットワーク接続を確認して、もう一度お試しください。',
    timeout: '通信に時間がかかりすぎました。電波の良い場所で、もう一度お試しください。',
    unauthorized: 'データへのアクセスが許可されませんでした。時間をおいて、もう一度お試しください。',
    notfound: '対象のデータが見つかりませんでした。画面を更新して、もう一度お試しください。',
    conflict: 'すでに同じデータが登録されています。内容を確認してください。',
    validation: '入力内容に誤りがあります。項目を確認して、もう一度お試しください。',
    server: 'サーバーでエラーが発生しました。時間をおいて、もう一度お試しください。',
    parse: 'サーバーからの応答を読み取れませんでした。もう一度お試しください。',
    insufficient: 'クレジットが不足しています。チャージしてから、もう一度お試しください。',
    invalidLogin: 'メールアドレスまたはパスワードが違います。',
    emailTaken: 'このメールアドレスはすでに登録されています。ログインしてください。',
    weakPassword: 'パスワードは6文字以上で入力してください。',
    emailNotConfirmed: 'メールアドレスの確認が終わっていません。届いたメールのリンクを開いてください。',
    loginRequired: 'ログインが必要です。もう一度ログインしてください。',
    couponNotFound: 'このクーポンコードは見つかりませんでした。',
    couponInactive: 'このクーポンは現在利用できません。',
    couponExpired: 'このクーポンは有効期限が切れています。',
    couponUsedUp: 'このクーポンは利用上限に達しています。',
    unknown: '処理に失敗しました。もう一度お試しください。'
  };

  /* ---------- エラー ---------- */
  function ApiError(code, status, detail) {
    this.name = 'ApiError';
    this.code = MESSAGES[code] ? code : 'unknown';
    this.status = status || 0;
    this.detail = detail === undefined || detail === null ? '' : String(detail);
    this.message = MESSAGES[this.code];
    this.retry = null;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  function toApiError(err) {
    if (err instanceof ApiError) { return err; }
    var wrapped = new ApiError('unknown', 0, err && err.message ? err.message : String(err));
    console.error('[Api] 想定外のエラー', err);
    return wrapped;
  }

  function codeForStatus(status) {
    if (status === 401 || status === 403) { return 'unauthorized'; }
    if (status === 404) { return 'notfound'; }
    if (status === 409) { return 'conflict'; }
    if (status === 400 || status === 422) { return 'validation'; }
    if (status >= 500) { return 'server'; }
    return 'unknown';
  }

  /*
   * サーバーが返した本文からエラーコードを決める。
   * status だけでは足りない。PostgREST は RPC の raise exception を
   * {"code":"P0001","message":"insufficient:100:50"} の 400 で返し、
   * GoTrue は {"error_description":"Invalid login credentials"} の 400 で返す。
   * どちらも codeForStatus では 'validation' になってしまい、画面に出す文言を選べない。
   */
  var AUTH_HINTS = [
    ['invalid login credentials', 'invalidLogin'],
    ['already registered', 'emailTaken'],
    ['user_already_exists', 'emailTaken'],
    ['already been registered', 'emailTaken'],
    ['password should be', 'weakPassword'],
    ['weak_password', 'weakPassword'],
    ['email not confirmed', 'emailNotConfirmed'],
    ['email_not_confirmed', 'emailNotConfirmed']
  ];

  function errorFromResponse(status, text) {
    var body = null;
    try { body = JSON.parse(text); } catch (e) { body = null; }

    var message = String((body && (body.message || body.msg || body.error_description || body.error)) || '');

    // 002 の elpiya_apply_credit が投げる 'insufficient:<残高>:<不足分>'
    if (message.indexOf('insufficient:') === 0) {
      var parts = message.split(':');
      var lack = new ApiError('insufficient', status, text);
      lack.balance = Number(parts[1]) || 0;
      lack.shortage = Number(parts[2]) || 0;
      return lack;
    }
    // 'unauthorized' / 'notfound' / 'couponExpired' など、そのままコードになるもの
    if (MESSAGES[message]) { return new ApiError(message, status, text); }
    if (message.indexOf('feature_not_found') === 0) { return new ApiError('notfound', status, text); }
    if (message.indexOf('validation:') === 0) { return new ApiError('validation', status, text); }

    var lower = (message + ' ' + String((body && body.error_code) || '')).toLowerCase();
    for (var i = 0; i < AUTH_HINTS.length; i += 1) {
      if (lower.indexOf(AUTH_HINTS[i][0]) !== -1) { return new ApiError(AUTH_HINTS[i][1], status, text); }
    }

    return new ApiError(codeForStatus(status), status, text);
  }

  function logError(method, path, err) {
    console.error('[Api] ' + method + ' ' + path + ' 失敗 code=' + err.code + ' status=' + err.status + ' detail=' + err.detail);
  }

  /* ---------- 小道具 ---------- */
  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function toDateString(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function today() { return toDateString(new Date()); }

  function addDays(date, days) {
    var base = date instanceof Date ? new Date(date.getTime()) : new Date(String(date));
    if (isNaN(base.getTime())) { base = new Date(); }
    base.setDate(base.getDate() + (Number(days) || 0));
    return toDateString(base);
  }

  function shallow(obj) {
    var out = {};
    if (obj) {
      Object.keys(obj).forEach(function (k) { out[k] = obj[k]; });
    }
    return out;
  }

  function buildQuery(params) {
    var parts = [];
    Object.keys(params).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === '') { return; }
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  function listParams(options) {
    var opts = options || {};
    var params = { select: opts.select || '*' };

    if (opts.order !== false) { params.order = opts.order || 'created_at.desc'; }
    if (opts.limit) { params.limit = opts.limit; }
    if (opts.offset) { params.offset = opts.offset; }

    if (opts.eq) {
      Object.keys(opts.eq).forEach(function (col) {
        if (opts.eq[col] === undefined || opts.eq[col] === null) { return; }
        params[col] = 'eq.' + opts.eq[col];
      });
    }
    if (opts.neq) {
      Object.keys(opts.neq).forEach(function (col) { params[col] = 'neq.' + opts.neq[col]; });
    }
    if (opts.ilike) {
      Object.keys(opts.ilike).forEach(function (col) {
        var word = String(opts.ilike[col] === undefined ? '' : opts.ilike[col]).trim();
        if (!word) { return; }
        params[col] = 'ilike.*' + word + '*';
      });
    }
    if (opts.in) {
      Object.keys(opts.in).forEach(function (col) {
        var arr = opts.in[col];
        if (!arr || !arr.length) { return; }
        params[col] = 'in.(' + arr.join(',') + ')';
      });
    }
    if (opts.filters) {
      Object.keys(opts.filters).forEach(function (col) { params[col] = opts.filters[col]; });
    }
    return params;
  }

  // id と created_at はサーバーが入れる。undefined も送らない。
  function cleanPayload(row) {
    var out = {};
    if (!row || typeof row !== 'object') { return out; }
    Object.keys(row).forEach(function (key) {
      if (key === 'id' || key === 'created_at') { return; }
      if (row[key] === undefined) { return; }
      out[key] = row[key];
    });
    return out;
  }

  function firstRow(data) {
    if (Array.isArray(data)) { return data.length ? data[0] : null; }
    return data || null;
  }

  /* ---------- 通信の本体 ---------- */
  function request(method, path, body, options) {
    var opts = options || {};
    var url = (opts.base || REST_BASE) + path;

    // 送るたびに組み立てる。途中でトークンが入れ替わっても古い値を使わないため。
    function buildHeaders() {
      var token = (!opts.noAuth && session && session.access_token) ? session.access_token : ANON_KEY;
      var h = {
        apikey: ANON_KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': opts.contentType || 'application/json'
      };
      if (opts.prefer) { h.Prefer = opts.prefer; }
      /* Storage へのアップロードなど、追加ヘッダが要る呼び出し用 */
      if (opts.extraHeaders) {
        Object.keys(opts.extraHeaders).forEach(function (key) { h[key] = opts.extraHeaders[key]; });
      }
      return h;
    }

    var autoRetryLeft = typeof opts.autoRetry === 'number' ? opts.autoRetry : (method === 'GET' ? 1 : 0);
    var refreshLeft = opts.noAuth ? 0 : 1;

    function send() {
      var controller = (typeof AbortController === 'function') ? new AbortController() : null;
      var timer = null;
      var init = { method: method, headers: buildHeaders(), cache: 'no-store' };

      /* rawBody は Blob/File をそのまま送る（Storage のアップロード用）。JSON化しない */
      if (opts.rawBody !== undefined && opts.rawBody !== null) { init.body = opts.rawBody; }
      else if (body !== undefined && body !== null) { init.body = JSON.stringify(body); }
      if (controller) {
        init.signal = controller.signal;
        timer = setTimeout(function () { controller.abort(); }, opts.timeoutMs || TIMEOUT_MS);
      }

      return fetch(url, init).then(function (res) {
        if (timer) { clearTimeout(timer); }
        return res.text().then(function (text) {
          if (!res.ok) {
            throw errorFromResponse(res.status, text);
          }
          if (!text) { return null; }
          try {
            return JSON.parse(text);
          } catch (parseErr) {
            throw new ApiError('parse', res.status, text);
          }
        }, function () {
          throw new ApiError('parse', res.status, '応答の本文を読めませんでした');
        });
      }, function (err) {
        if (timer) { clearTimeout(timer); }
        var aborted = err && (err.name === 'AbortError' || err.code === 20);
        throw new ApiError(aborted ? 'timeout' : 'network', 0, err && err.message ? err.message : '');
      });
    }

    function run() {
      return send().catch(function (rawErr) {
        var err = toApiError(rawErr);
        var canAutoRetry = (err.code === 'network' || err.code === 'timeout' || err.code === 'server');
        if (canAutoRetry && autoRetryLeft > 0) {
          autoRetryLeft -= 1;
          console.warn('[Api] ' + method + ' ' + path + ' を自動で再試行します（' + err.code + '）');
          return delay(AUTO_RETRY_DELAY_MS).then(run);
        }
        // アクセストークンは1時間で切れる。切れただけならログイン画面に戻さず取り直す。
        if (err.code === 'unauthorized' && refreshLeft > 0 && session && session.refresh_token) {
          refreshLeft -= 1;
          console.warn('[Api] アクセストークンを取り直して ' + method + ' ' + path + ' をやり直します');
          return refreshSession().then(run, function () { return Promise.reject(err); });
        }
        logError(method, path, err);
        err.retry = function () { return request(method, path, body, options); };
        return Promise.reject(err);
      });
    }

    return run();
  }

  // どの入口から失敗しても err.retry() で「同じ処理」をやり直せるようにする。
  function retriable(runner) {
    return runner().catch(function (rawErr) {
      var err = toApiError(rawErr);
      err.retry = function () { return retriable(runner); };
      return Promise.reject(err);
    });
  }

  function requireId(table, id) {
    if (id === undefined || id === null || String(id) === '') {
      var err = new ApiError('validation', 0, table + ': id が空です');
      console.error('[Api] ' + table + ' の操作に id が渡されませんでした');
      return err;
    }
    return null;
  }

  /* ---------- 認証（Supabase Auth / GoTrue） ----------
   * 資格情報はサーバーが持つ。このファイルが預かるのはトークンだけで、
   * パスワードはどこにも保存しない（旧実装は端末内で変換した文字列を
   * a2f58db45_users.password_hash に入れていた。001 でその列ごと落とした）。
   */
  var session = null;

  function saveSession(raw) {
    if (!raw || !raw.access_token) { return null; }
    session = {
      access_token: raw.access_token,
      refresh_token: raw.refresh_token || (session && session.refresh_token) || '',
      // GoTrue の expires_at は秒。扱いを間違えないようミリ秒に直して持つ。
      expires_at: raw.expires_at ? Number(raw.expires_at) * 1000
        : Date.now() + (Number(raw.expires_in) || 3600) * 1000,
      user: raw.user || (session && session.user) || null
    };
    storage.set('session', JSON.stringify(session));
    if (session.user && session.user.id) { storage.set('userId', session.user.id); }
    return session;
  }

  function forgetSession() {
    session = null;
    storage.remove('session');
    storage.remove('userId');
  }

  function loadSession() {
    var text = storage.get('session');
    if (!text) { return null; }
    try {
      var parsed = JSON.parse(text);
      session = (parsed && parsed.access_token) ? parsed : null;
    } catch (e) {
      console.error('[Api] 保存されていたセッションを読めませんでした。ログインし直しになります。', e);
      forgetSession();
    }
    return session;
  }

  function refreshSession() {
    if (!session || !session.refresh_token) {
      return Promise.reject(new ApiError('loginRequired', 401, 'refresh_token がありません'));
    }
    return request('POST', 'token?grant_type=refresh_token', { refresh_token: session.refresh_token },
      { base: AUTH_BASE, noAuth: true, autoRetry: 0 }
    ).then(function (data) {
      return saveSession(data);
    }, function (err) {
      // 取り直せない = ログインし直すしかない。古いトークンを残すと失敗し続ける。
      console.error('[Api] セッションを取り直せませんでした。ログアウトします。', err);
      forgetSession();
      return Promise.reject(new ApiError('loginRequired', err.status || 401, err.detail || ''));
    });
  }

  function currentUserId() {
    return (session && session.user && session.user.id) ? session.user.id : null;
  }

  // 自分のプロフィール行（a2f58db45_users）。RLS があるので自分の行しか返らない。
  function myProfile() {
    var id = currentUserId();
    if (!id) { return Promise.reject(new ApiError('loginRequired', 401, 'セッションがありません')); }
    return api.users.get(id);
  }

  var auth = {
    session: function () { return session; },
    userId: currentUserId,
    profile: myProfile,

    signUp: function (email, password, displayName) {
      var body = {
        email: String(email || '').trim(),
        password: String(password || ''),
        data: { full_name: String(displayName || '').trim() }
      };
      return request('POST', 'signup', body, { base: AUTH_BASE, noAuth: true, autoRetry: 0 })
        .then(function (data) {
          // メール確認が有効なとき、ここではまだセッションが返らない。
          if (data && data.access_token) {
            saveSession(data);
            return { user: data.user, needsConfirmation: false };
          }
          return { user: data, needsConfirmation: true };
        });
    },

    signIn: function (email, password) {
      var body = { email: String(email || '').trim(), password: String(password || '') };
      return request('POST', 'token?grant_type=password', body, { base: AUTH_BASE, noAuth: true, autoRetry: 0 })
        .then(function (data) {
          saveSession(data);
          return myProfile();
        });
    },

    // 本物の Google OAuth。ブラウザごと Supabase へ飛ばし、戻り先の URL の
    // ハッシュにトークンが付いて返ってくる（consumeRedirect が拾う）。
    // 設定前は false を返すだけで、画面遷移しない（呼び出し側が案内を出す）。
    googleEnabled: function () { return GOOGLE_LOGIN_ENABLED; },

    signInWithGoogle: function (redirectTo) {
      if (!GOOGLE_LOGIN_ENABLED) { return false; }
      var back = redirectTo || (global.location.origin + global.location.pathname);
      global.location.href = AUTH_BASE + 'authorize?provider=google&redirect_to=' + encodeURIComponent(back);
      return true;
    },

    /*
     * OAuth から戻ってきた直後に呼ぶ。ハッシュにトークンがあれば取り込んで消す。
     * 消さないとハッシュルーターが '#access_token=...' を画面IDとして読んでしまう。
     * 戻り値: 取り込んだら true。
     */
    consumeRedirect: function () {
      var hash = String(global.location.hash || '');
      if (hash.indexOf('access_token=') === -1) { return false; }

      var params = {};
      hash.replace(/^#\/?/, '').split('&').forEach(function (pair) {
        var kv = pair.split('=');
        if (kv[0]) { params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); }
      });
      if (!params.access_token) { return false; }

      saveSession(params);
      try {
        global.history.replaceState(null, '', global.location.pathname + global.location.search);
      } catch (e) {
        global.location.hash = '';
      }
      return true;
    },

    signOut: function () {
      if (!session) { return Promise.resolve(true); }
      // サーバー側の失効に失敗しても端末からは必ず消す（消さないと入れっぱなしになる）。
      return request('POST', 'logout', {}, { base: AUTH_BASE, autoRetry: 0 })
        .then(function () { forgetSession(); return true; },
          function (err) {
            console.warn('[Api] サーバー側のログアウトに失敗しましたが、端末のセッションは破棄します', err);
            forgetSession();
            return true;
          });
    },

    /* 起動時に呼ぶ。ログイン中ならプロフィール行、そうでなければ null。 */
    restore: function () {
      if (!loadSession()) { return Promise.resolve(null); }
      var needsRefresh = !session.expires_at || session.expires_at - Date.now() < 60000;
      var ready = needsRefresh ? refreshSession() : Promise.resolve(session);
      return ready.then(myProfile).catch(function (err) {
        console.warn('[Api] セッションを復元できませんでした', err);
        if (err && (err.code === 'loginRequired' || err.code === 'unauthorized' || err.code === 'notfound')) {
          forgetSession();
        }
        return null;
      });
    },

    /* パスワード再設定メールの送信 */
    resetPassword: function (email, redirectTo) {
      var back = redirectTo || (global.location.origin + global.location.pathname);
      return request('POST', 'recover?redirect_to=' + encodeURIComponent(back),
        { email: String(email || '').trim() },
        { base: AUTH_BASE, noAuth: true, autoRetry: 0 }
      ).then(function () { return true; });
    },

    /* ログイン中の利用者が自分のパスワードを変える */
    updatePassword: function (password) {
      if (!session) { return Promise.reject(new ApiError('loginRequired', 401, '')); }
      return request('PUT', 'user', { password: String(password || '') }, { base: AUTH_BASE, autoRetry: 0 })
        .then(function (user) { if (session) { session.user = user; } return true; });
    }
  };

  /* ---------- RPC（サーバー側の1トランザクション） ---------- */
  function rpc(name, params) {
    return retriable(function () {
      return request('POST', 'rpc/' + name, params || {}, { autoRetry: 0 });
    });
  }

  /* ---------- Edge Function ---------- */
  function callFunction(name, body, method, opts) {
    var extra = opts || {};
    return retriable(function () {
      return request(method || 'POST', name, body, {
        base: FUNCTIONS_BASE,
        autoRetry: 0,
        timeoutMs: extra.timeoutMs
      });
    });
  }

  /* ---------- 表ごとのCRUD ---------- */
  function makeTable(table) {
    function list(options) {
      return retriable(function () {
        return request('GET', table + buildQuery(listParams(options)), null, {}).then(function (data) {
          if (Array.isArray(data)) { return data; }
          return data ? [data] : [];
        });
      });
    }

    function first(options) {
      var opts = shallow(options);
      opts.limit = 1;
      return list(opts).then(function (rows) { return rows.length ? rows[0] : null; });
    }

    function get(id) {
      var bad = requireId(table, id);
      if (bad) { return Promise.reject(bad); }
      return retriable(function () {
        return first({ eq: { id: id }, order: false }).then(function (row) {
          if (!row) {
            var err = new ApiError('notfound', 404, table + ' id=' + id);
            console.error('[Api] ' + table + ' に id=' + id + ' の行がありません');
            throw err;
          }
          return row;
        });
      });
    }

    function insert(row) {
      var payload = cleanPayload(row);
      return retriable(function () {
        return request('POST', table, payload, { prefer: 'return=representation' }).then(function (data) {
          var created = firstRow(data);
          if (!created) {
            throw new ApiError('parse', 0, table + ': 作成した行が返りませんでした');
          }
          return created;
        });
      });
    }

    function update(id, patch) {
      var bad = requireId(table, id);
      if (bad) { return Promise.reject(bad); }
      var payload = cleanPayload(patch);
      return retriable(function () {
        var path = table + buildQuery({ id: 'eq.' + id, select: '*' });
        return request('PATCH', path, payload, { prefer: 'return=representation' }).then(function (data) {
          var updated = firstRow(data);
          if (!updated) {
            var err = new ApiError('notfound', 404, table + ' id=' + id);
            console.error('[Api] ' + table + ' id=' + id + ' の更新対象が見つかりませんでした');
            throw err;
          }
          return updated;
        });
      });
    }

    function remove(id) {
      var bad = requireId(table, id);
      if (bad) { return Promise.reject(bad); }
      return retriable(function () {
        return request('DELETE', table + buildQuery({ id: 'eq.' + id }), null, {}).then(function () { return true; });
      });
    }

    // ponytail: 件数は取得した行を数えるだけ。数万件になったら Prefer: count=exact に切り替える。
    function count(options) {
      var opts = shallow(options);
      opts.select = 'id';
      opts.order = false;
      return list(opts).then(function (rows) { return rows.length; });
    }

    return {
      table: table,
      list: list,
      first: first,
      get: get,
      insert: insert,
      update: update,
      remove: remove,
      count: count
    };
  }

  var api = {
    URL: SUPABASE_URL,
    TABLES: TABLES,
    MESSAGES: MESSAGES,
    ApiError: ApiError,
    request: request,
    today: today,
    addDays: addDays,
    users: makeTable(TABLES.users),
    projects: makeTable(TABLES.projects),
    analysisReports: makeTable(TABLES.analysisReports),
    generations: makeTable(TABLES.generations),
    generationJobs: makeTable(TABLES.generationJobs),
    creditTransactions: makeTable(TABLES.creditTransactions),
    featureCredits: makeTable(TABLES.featureCredits),
    coupons: makeTable(TABLES.coupons),
    inquiries: makeTable(TABLES.inquiries)
  };

  /* ---------- クレジット ---------- */
  function hasUnlimited(user) {
    if (!user || !user.unlimited_until) { return false; }
    var until = new Date(String(user.unlimited_until));
    if (isNaN(until.getTime())) { return false; }
    return toDateString(until) >= today();
  }

  function balance(userId) {
    return api.users.get(userId).then(function (user) { return Number(user.credit_balance) || 0; });
  }

  /* ============================================================
   * 残高を動かす処理はすべて Supabase の RPC（002_credit_functions.sql）に移した。
   *
   * 理由は2つ。
   *  1) 001 で users の列単位の権限を絞ったので、クライアントからは
   *     credit_balance を書けない（書けたら誰でも自分の残高を増やせる）。
   *  2) 旧実装は「残高を更新」「履歴を記録」の2回のRESTに分かれていて原子的でなかった。
   *     旧コードのコメント自身がRPCへの移行を upgrade path として挙げていた。
   *
   * 消費するクレジット数はもうクライアントから送らない。feature_key だけ送り、
   * 単価はサーバーが feature_credits から引く。送れると「1クレジットで実行」と申告できてしまう。
   * ============================================================ */

  /* 消費。無制限利用中なら amount 0・unlimited true が返り、残高は動かない。 */
  function consume(featureKey, memo) {
    return rpc('elpiya_consume_credit', {
      p_feature_key: String(featureKey || ''),
      p_memo: memo || null
    });
  }

  function redeemCoupon(code) {
    var trimmed = String(code === undefined || code === null ? '' : code).trim();
    if (!trimmed) {
      return Promise.reject(new ApiError('validation', 0, 'クーポンコードが空です'));
    }
    return rpc('elpiya_redeem_coupon', { p_code: trimmed });
  }

  /* 管理者用。is_admin の判定はサーバー側（elpiya_is_admin）で行う。 */
  function grant(userId, credits, memo) {
    return rpc('elpiya_admin_grant_credit', {
      p_user: String(userId),
      p_credits: Math.round(Number(credits) || 0),
      p_memo: memo || null
    });
  }

  function grantUnlimited(userId, days, memo) {
    return rpc('elpiya_admin_grant_unlimited', {
      p_user: String(userId),
      p_days: Math.max(1, Math.round(Number(days) || 30)),
      p_memo: memo || null
    });
  }

  function setUserStatus(userId, status) {
    return rpc('elpiya_admin_set_user_status', { p_user: String(userId), p_status: String(status) });
  }

  /* 購入。金額とクレジット数は stripe-checkout Edge Function が持つ。 */
  function plans() {
    return callFunction('stripe-checkout', null, 'GET').then(function (data) {
      return (data && data.plans) || [];
    });
  }

  function checkout(planId) {
    return callFunction('stripe-checkout', { plan: String(planId || '') }).then(function (data) {
      if (!data || !data.url) { throw new ApiError('server', 0, 'Checkout の URL が返りませんでした'); }
      return data.url;
    });
  }

  function history(userId, limit) {
    return api.creditTransactions.list({
      eq: { users_id: String(userId) },
      order: 'created_at.desc',
      limit: limit || 50
    });
  }

  function featureCosts() {
    return api.featureCredits.list({ order: 'created_at.asc' });
  }

  function costOf(featureKey) {
    return api.featureCredits.first({ eq: { feature_key: featureKey }, order: false }).then(function (row) {
      if (!row) {
        console.warn('[Api] feature_credits に feature_key=' + featureKey + ' がありません。呼び出し側で既定値を決めてください');
        return null;
      }
      return Number(row.credit_cost) || 0;
    });
  }

  api.auth = auth;
  api.rpc = rpc;
  api.fn = callFunction;

  /* 生成。中身づくりとクレジット消費は generate-content Edge Function（サーバー側）が
     LLM成功後に1トランザクションで行う。LLM の応答を待つため、タイムアウトだけ長く取る。 */
  api.generations.generate = function (payload) {
    return callFunction('generate-content', payload || {}, 'POST', { timeoutMs: 120000 });
  };

  /* ---------- ファイル（商品写真などの画像）----------
     保存先は Storage の公開バケット `lp-assets`。パスの先頭は必ず自分の user_id
     （009 のポリシーがそれ以外への書き込みを拒否する）。
     戻り値は公開URL。業務テーブルにはこのURLだけを入れる（データURLを入れない）。 */
  var STORAGE_OBJECT_BASE = SUPABASE_URL + '/storage/v1/object/';
  var ASSET_BUCKET = 'lp-assets';
  var PUBLIC_MARKER = '/storage/v1/object/public/' + ASSET_BUCKET + '/';

  function uploadFile(blob, options) {
    var o = options || {};
    var userId = storage.get('userId');
    if (!userId) {
      return Promise.reject(new ApiError('loginRequired', 0, 'ログインが必要です'));
    }
    if (!blob) {
      return Promise.reject(new ApiError('validation', 0, 'ファイルがありません'));
    }
    /* パスの先頭は必ず自分の user_id。009 のポリシーがそれ以外を拒否する */
    var folder = String(o.folder || 'uploads').replace(/^\/+|\/+$/g, '');
    var ext = String(o.ext || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
    var base = String(o.name || (Date.now() + '-' + Math.random().toString(36).slice(2, 10)));
    var path = userId + '/' + folder + '/' + base + '.' + ext;

    return request('POST', ASSET_BUCKET + '/' + path, null, {
      base: STORAGE_OBJECT_BASE,
      rawBody: blob,
      contentType: o.contentType || blob.type || 'image/jpeg',
      extraHeaders: { 'x-upsert': 'true' },
      timeoutMs: 60000,
      autoRetry: 0
    }).then(function () {
      return SUPABASE_URL + PUBLIC_MARKER + path;
    });
  }

  /* 自分がアップロードしたファイルの削除。公開URL・保存パスのどちらでも渡せる。 */
  function removeFile(urlOrPath) {
    var text = String(urlOrPath || '');
    var path = text.indexOf(PUBLIC_MARKER) !== -1 ? text.split(PUBLIC_MARKER)[1] : text;
    if (!path || path.indexOf('data:') === 0) { return Promise.resolve(null); }
    return request('DELETE', ASSET_BUCKET + '/' + path, null, {
      base: STORAGE_OBJECT_BASE,
      autoRetry: 0
    });
  }

  api.files = {
    upload: uploadFile,
    remove: removeFile,
    isStorageUrl: function (value) {
      return String(value || '').indexOf(PUBLIC_MARKER) !== -1;
    }
  };

  /* 競合LP分析。スクレイピング・LLM分析・消費+保存は analyze-competitor
     Edge Function（サーバー側）が行う。開発モード中は {queued, job_id} が返る。 */
  api.analysis = {
    run: function (payload) {
      return callFunction('analyze-competitor', payload || {}, 'POST', { timeoutMs: 180000 });
    }
  };

  /* LP A/Bテスト（公開と計測）。すべて 007 の SECURITY DEFINER RPC。
     テーブルを anon に開かないための窓口なので、直接 REST を叩かないこと。 */
  api.lp = {
    publish: function (generationId, html) {
      return rpc('elpiya_publish_lp', {
        p_generation: String(generationId),
        p_html: html === undefined || html === null ? null : String(html),
        p_publish: true
      });
    },
    unpublish: function (generationId) {
      return rpc('elpiya_publish_lp', { p_generation: String(generationId), p_html: null, p_publish: false });
    },
    metrics: function (projectId) {
      return rpc('elpiya_lp_metrics', { p_project: String(projectId) });
    }
  };

  api.credits = {
    balance: balance,
    consume: consume,
    grant: grant,
    grantUnlimited: grantUnlimited,
    setUserStatus: setUserStatus,
    plans: plans,
    checkout: checkout,
    history: history,
    featureCosts: featureCosts,
    costOf: costOf,
    redeemCoupon: redeemCoupon,
    hasUnlimited: hasUnlimited
  };

  /* ---------- 端末に置いてよいものだけ（言語設定と選択中ID） ---------- */
  function isAllowedStorageKey(name) {
    if (ALLOWED_STORAGE_KEYS.indexOf(name) !== -1) { return true; }
    console.error('[Api] localStorage に置けるのは ' + ALLOWED_STORAGE_KEYS.join(' / ') + ' だけです。拒否した名前: ' + name + '（業務データは Supabase に保存してください）');
    return false;
  }

  var storage = {
    keys: ALLOWED_STORAGE_KEYS.slice(),

    get: function (name) {
      if (!isAllowedStorageKey(name)) { return null; }
      try {
        return global.localStorage.getItem(STORAGE_PREFIX + name);
      } catch (e) {
        console.error('[Api] localStorage を読めませんでした: ' + name, e);
        return null;
      }
    },

    set: function (name, value) {
      if (!isAllowedStorageKey(name)) { return false; }
      if (value === undefined || value === null || value === '') {
        return storage.remove(name);
      }
      try {
        global.localStorage.setItem(STORAGE_PREFIX + name, String(value));
        return true;
      } catch (e) {
        console.error('[Api] localStorage に書けませんでした: ' + name, e);
        return false;
      }
    },

    remove: function (name) {
      if (!isAllowedStorageKey(name)) { return false; }
      try {
        global.localStorage.removeItem(STORAGE_PREFIX + name);
        return true;
      } catch (e) {
        console.error('[Api] localStorage から消せませんでした: ' + name, e);
        return false;
      }
    },

    clearSelection: function () {
      ['userId', 'projectId', 'analysisReportId', 'generationId'].forEach(function (name) {
        storage.remove(name);
      });
      return true;
    }
  };

  api.storage = storage;

  /* ---------- 通信なしの自己チェック（開発時にコンソールから Api._selfTest()） ---------- */
  api._selfTest = function () {
    function assert(ok, name) {
      if (!ok) { throw new Error('[Api] 自己チェック失敗: ' + name); }
    }

    var q = buildQuery(listParams({ eq: { users_id: 'u1' }, ilike: { project_name: '春' }, limit: 5 }));
    assert(q.indexOf('select=*') !== -1, 'select');
    assert(q.indexOf('order=created_at.desc') !== -1, 'order');
    assert(q.indexOf('limit=5') !== -1, 'limit');
    assert(q.indexOf('users_id=eq.u1') !== -1, 'eq');
    assert(q.indexOf('project_name=ilike.*') !== -1, 'ilike');

    var q2 = buildQuery(listParams({ order: false, in: { id: ['a', 'b'] }, filters: { credit_balance: 'gte.10' } }));
    assert(q2.indexOf('order=') === -1, 'order=false');
    assert(q2.indexOf('id=in.') !== -1, 'in');
    assert(q2.indexOf('credit_balance=gte.10') !== -1, 'filters');

    var payload = cleanPayload({ id: 'x', created_at: 'y', project_name: 'A', price: undefined, product_name: null });
    assert(payload.id === undefined, 'cleanPayload id');
    assert(payload.created_at === undefined, 'cleanPayload created_at');
    assert(payload.price === undefined, 'cleanPayload undefined');
    assert(payload.project_name === 'A', 'cleanPayload 値');
    assert(payload.product_name === null, 'cleanPayload null は残す');

    assert(addDays(new Date(2026, 0, 30), 2) === '2026-02-01', 'addDays');
    assert(toDateString(new Date(2026, 11, 5)) === '2026-12-05', 'toDateString');

    assert(hasUnlimited({ unlimited_until: addDays(new Date(), 1) }) === true, 'hasUnlimited 有効');
    assert(hasUnlimited({ unlimited_until: addDays(new Date(), -1) }) === false, 'hasUnlimited 期限切れ');
    assert(hasUnlimited({}) === false, 'hasUnlimited 未設定');

    assert(isAllowedStorageKey('lang') === true, 'storage 許可キー');
    assert(isAllowedStorageKey('projects') === false, 'storage 拒否キー');

    var err = new ApiError('network', 0, 'test');
    assert(err.message === MESSAGES.network, 'エラーメッセージ');
    assert(new ApiError('存在しないコード', 0, '').code === 'unknown', '未知コードの既定');

    // サーバーが返す本文からコードを決められること（画面に出す文言がこれで決まる）
    var lack = errorFromResponse(400, '{"code":"P0001","message":"insufficient:100:40"}');
    assert(lack.code === 'insufficient', 'RPC insufficient');
    assert(lack.balance === 100 && lack.shortage === 40, 'RPC insufficient の残高と不足分');
    assert(errorFromResponse(400, '{"message":"couponExpired"}').code === 'couponExpired', 'RPC クーポン期限切れ');
    assert(errorFromResponse(400, '{"message":"feature_not_found:kv"}').code === 'notfound', 'RPC 機能なし');
    assert(errorFromResponse(400, '{"message":"validation:user_status=x"}').code === 'validation', 'RPC 入力不正');
    assert(errorFromResponse(400, '{"error_description":"Invalid login credentials"}').code === 'invalidLogin', 'ログイン失敗');
    assert(errorFromResponse(422, '{"msg":"User already registered"}').code === 'emailTaken', '登録済みメール');
    assert(errorFromResponse(500, 'not json').code === 'server', '本文が読めなくても status で決まること');

    console.log('[Api] 自己チェック OK');
    return true;
  };

  /* ---------- 公開 ---------- */
  if (typeof fetch !== 'function') {
    console.error('[Api] この環境には fetch がありません。通信機能は使えません。');
  }
  if (global.Api) {
    console.warn('[Api] window.Api がすでに定義されています。api.js が二重に読み込まれていないか確認してください。');
  }
  global.Api = api;
})(window);
