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
 * クレジット（残高更新と credit_transactions への記録はこのファイルだけで行う）
 *   Api.credits.balance(userId)
 *   Api.credits.apply(userId, { type, amount, featureKey, amountYen, couponId, memo })
 *   Api.credits.purchase(userId, credits, yen, memo)
 *   Api.credits.consume(userId, credits, featureKey, memo)
 *   Api.credits.grant(userId, credits, memo)
 *   Api.credits.history(userId, limit)
 *   Api.credits.featureCosts()
 *   Api.credits.costOf(featureKey)
 *   Api.credits.redeemCoupon(userId, code)
 *   Api.credits.hasUnlimited(user)
 *
 * 端末に置いてよいものだけを扱う保管庫
 *   Api.storage.get(name) / Api.storage.set(name, value) / Api.storage.remove(name)
 *   Api.storage.clearSelection()
 *   name は 'lang' | 'userId' | 'projectId' | 'analysisReportId' | 'generationId' のみ。
 *   それ以外の名前を渡したときは保存せず、何が拒否されたかをコンソールに残す。
 *   実キーは 'elpiya.lang' のように STORAGE_PREFIX 付き。i18n.js も言語は 'elpiya.lang' を使う。
 *
 * 失敗時
 *   reject される値は必ず ApiError。
 *     err.message  日本語の説明（そのまま画面に出してよい）
 *     err.code     'network' | 'timeout' | 'unauthorized' | 'notfound' | 'conflict' |
 *                  'validation' | 'server' | 'parse' | 'insufficient' | 'coupon…' | 'unknown'
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
  var TABLE_PREFIX = 'a2f58db45_';
  var TIMEOUT_MS = 15000;
  var AUTO_RETRY_DELAY_MS = 700;
  var STORAGE_PREFIX = 'elpiya.';
  var ALLOWED_STORAGE_KEYS = ['lang', 'userId', 'projectId', 'analysisReportId', 'generationId'];

  var TABLES = {
    users: TABLE_PREFIX + 'users',
    projects: TABLE_PREFIX + 'projects',
    analysisReports: TABLE_PREFIX + 'analysis_reports',
    generations: TABLE_PREFIX + 'generations',
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
    var url = REST_BASE + path;
    var headers = {
      apikey: ANON_KEY,
      Authorization: 'Bearer ' + ANON_KEY,
      'Content-Type': 'application/json'
    };
    if (opts.prefer) { headers.Prefer = opts.prefer; }

    var autoRetryLeft = typeof opts.autoRetry === 'number' ? opts.autoRetry : (method === 'GET' ? 1 : 0);

    function send() {
      var controller = (typeof AbortController === 'function') ? new AbortController() : null;
      var timer = null;
      var init = { method: method, headers: headers, cache: 'no-store' };

      if (body !== undefined && body !== null) { init.body = JSON.stringify(body); }
      if (controller) {
        init.signal = controller.signal;
        timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
      }

      return fetch(url, init).then(function (res) {
        if (timer) { clearTimeout(timer); }
        return res.text().then(function (text) {
          if (!res.ok) {
            throw new ApiError(codeForStatus(res.status), res.status, text);
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

  /*
   * 残高更新と credit_transactions への記録をひとまとめに行う唯一の入口。
   * amount は符号つき（購入・付与は正、消費は負）。
   * ponytail: 残高更新と履歴記録は2回のRESTに分かれるため原子的ではない。
   *           履歴の記録に失敗したときは残高を戻す。厳密な同時実行制御が要るなら Supabase の RPC（単一トランザクション）へ移す。
   */
  function applyCredit(userId, options) {
    var opts = options || {};
    var type = opts.type || 'consume';
    var amount = Math.round(Number(opts.amount) || 0);

    function run() {
      return api.users.get(userId).then(function (user) {
        var before = Number(user.credit_balance) || 0;
        var after = before + amount;

        if (after < 0) {
          var lack = new ApiError('insufficient', 0, 'balance=' + before + ' amount=' + amount);
          lack.shortage = Math.abs(after);
          lack.balance = before;
          throw lack;
        }

        return api.users.update(userId, { credit_balance: after }).then(function (updatedUser) {
          return api.creditTransactions.insert({
            users_id: String(userId),
            transaction_type: type,
            credit_amount: amount,
            balance_after: after,
            feature_key: opts.featureKey || null,
            amount_yen: (opts.amountYen === undefined || opts.amountYen === null) ? null : Number(opts.amountYen),
            coupons_id: opts.couponId ? String(opts.couponId) : null,
            memo: opts.memo || null
          }).then(function (tx) {
            return {
              user: updatedUser,
              balance: after,
              balanceBefore: before,
              amount: amount,
              transaction: tx
            };
          }, function (txErr) {
            console.error('[Api] credit_transactions の記録に失敗したため残高を元に戻します', txErr);
            return api.users.update(userId, { credit_balance: before }).then(
              function () { return Promise.reject(txErr); },
              function (rollbackErr) {
                console.error('[Api] 残高の巻き戻しにも失敗しました。users id=' + userId + ' の credit_balance を確認してください', rollbackErr);
                return Promise.reject(txErr);
              }
            );
          });
        });
      });
    }

    return retriable(run);
  }

  function purchase(userId, credits, yen, memo) {
    return applyCredit(userId, {
      type: 'purchase',
      amount: Math.abs(Math.round(Number(credits) || 0)),
      amountYen: yen,
      memo: memo || 'クレジット購入'
    });
  }

  function consume(userId, credits, featureKey, memo) {
    return applyCredit(userId, {
      type: 'consume',
      amount: -Math.abs(Math.round(Number(credits) || 0)),
      featureKey: featureKey || null,
      memo: memo || null
    });
  }

  function grant(userId, credits, memo) {
    return applyCredit(userId, {
      type: 'grant',
      amount: Math.round(Number(credits) || 0),
      memo: memo || '管理者による付与'
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

  function grantUnlimited(userId, days, memo, couponId) {
    var addDaysCount = Math.max(1, Math.round(Number(days) || 30));
    function run() {
      return api.users.get(userId).then(function (user) {
        var current = user.unlimited_until ? new Date(String(user.unlimited_until)) : null;
        var base = (current && !isNaN(current.getTime()) && toDateString(current) >= today()) ? current : new Date();
        var until = addDays(base, addDaysCount);
        return api.users.update(userId, { unlimited_until: until }).then(function (updatedUser) {
          return api.creditTransactions.insert({
            users_id: String(userId),
            transaction_type: 'unlimited',
            credit_amount: 0,
            balance_after: Number(user.credit_balance) || 0,
            feature_key: null,
            amount_yen: null,
            coupons_id: couponId ? String(couponId) : null,
            memo: memo || (addDaysCount + '日間の無制限利用権')
          }).then(function (tx) {
            return {
              user: updatedUser,
              unlimitedUntil: until,
              days: addDaysCount,
              balance: Number(user.credit_balance) || 0,
              transaction: tx
            };
          });
        });
      });
    }
    return retriable(run);
  }

  function redeemCoupon(userId, code) {
    var trimmed = String(code === undefined || code === null ? '' : code).trim();

    function run() {
      if (!trimmed) {
        return Promise.reject(new ApiError('validation', 0, 'クーポンコードが空です'));
      }
      return api.coupons.first({ eq: { code: trimmed }, order: false }).then(function (coupon) {
        if (!coupon) { throw new ApiError('couponNotFound', 0, trimmed); }
        if (!coupon.is_active) { throw new ApiError('couponInactive', 0, trimmed); }

        if (coupon.expires_at) {
          var limitDate = new Date(String(coupon.expires_at));
          if (!isNaN(limitDate.getTime()) && toDateString(limitDate) < today()) {
            throw new ApiError('couponExpired', 0, trimmed);
          }
        }

        var used = Number(coupon.used_count) || 0;
        var max = Number(coupon.max_uses) || 0;
        if (max > 0 && used >= max) { throw new ApiError('couponUsedUp', 0, trimmed); }

        return api.coupons.update(coupon.id, { used_count: used + 1 }).then(function () {
          if (coupon.coupon_type === 'unlimited') {
            var days = Number(coupon.unlimited_days) || 30;
            return grantUnlimited(userId, days, 'クーポン ' + coupon.code + '（' + days + '日間の無制限利用）', coupon.id)
              .then(function (result) {
                return {
                  type: 'unlimited',
                  coupon: coupon,
                  days: result.days,
                  unlimitedUntil: result.unlimitedUntil,
                  balance: result.balance,
                  transaction: result.transaction
                };
              }, function (err) {
                console.error('[Api] 無制限クーポンの適用に失敗したため used_count を戻します', err);
                return api.coupons.update(coupon.id, { used_count: used }).then(
                  function () { return Promise.reject(err); },
                  function () { return Promise.reject(err); }
                );
              });
          }

          var credits = Math.round(Number(coupon.credit_amount) || 0);
          return applyCredit(userId, {
            type: 'coupon',
            amount: credits,
            couponId: coupon.id,
            memo: 'クーポン ' + coupon.code
          }).then(function (result) {
            return {
              type: 'credit',
              coupon: coupon,
              credits: credits,
              balance: result.balance,
              transaction: result.transaction
            };
          }, function (err) {
            console.error('[Api] クレジットクーポンの適用に失敗したため used_count を戻します', err);
            return api.coupons.update(coupon.id, { used_count: used }).then(
              function () { return Promise.reject(err); },
              function () { return Promise.reject(err); }
            );
          });
        });
      });
    }

    return retriable(run);
  }

  api.credits = {
    balance: balance,
    apply: applyCredit,
    purchase: purchase,
    consume: consume,
    grant: grant,
    grantUnlimited: grantUnlimited,
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
