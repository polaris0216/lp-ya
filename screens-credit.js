/* ============================================================
 * エルピーヤ — screens-credit.js
 * S16 クレジット消費確認（機能別消費クレジット・残高表示）と S17 クレジット の2画面だけを描く。
 *
 * ---- 他ファイルとの共通契約（この名前どおりに使う。似た名前を作らない）----
 * 画面登録   App.registerScreen('S16', { render: function (root, params) {} });
 *            第2引数は必ず { render: 関数 } のオブジェクト。関数をそのまま渡さない。
 * 画面遷移   index.html に書かれた経路の綴りをそのまま使う。
 *            location.hash = '#/S16?id=...' （ハッシュルーターは app.js）
 * 通信       api.js の window.Api だけを使う。
 *              Api.users.get(id) / Api.projects.get(id)
 *              Api.credits.featureCosts() / Api.credits.consume(featureKey, memo)
 *              Api.credits.plans() / Api.credits.checkout(planId)
 *              Api.credits.redeemCoupon(code) / Api.credits.history(userId, limit)
 *              Api.credits.hasUnlimited(user) / Api.storage.get
 *            業務データは localStorage に置かない（保存先は Supabase）。
 * 文言       i18n.js の window.I18N.t(key) を使う。辞書に無いキーは作らず、
 *            このファイル内の LOCAL（ja / en / ko の3言語）で補って tl(key) で引く。
 * DOM        index.html が用意した id だけを触る。
 *              #app-header 内の #header-title / #header-back / #header-action
 *              #banner-root / #toast-root / #modal-root
 * class      styles.css に実在する綴りだけを使う。
 *              screen / screen__head / screen__title / screen__lead / section /
 *              section__head / section__title / section__desc / stack / stack--tight /
 *              row / row--between / row--input-action / btn-row /
 *              card / card--soft / card--gradient / card__label / card__value /
 *              card__unit / card__sub / list / list-row / list-row__body /
 *              list-row__title / list-row__sub / list-row__meta /
 *              info-list / info-row / info-row__key / info-row__val /
 *              check-row / check-row__box / check-row__label /
 *              field / field__label / field__hint / field__error / input /
 *              input--error / badge / badge--ok / btn / btn--primary /
 *              btn--secondary / btn--text / btn--block / warn-box / note-box /
 *              empty / empty__text / skeleton / skeleton--title / skeleton--card /
 *              skeleton--row / loading-text / banner / banner__text / banner__retry /
 *              toast / toast__text / toast--success / toast--danger /
 *              t-note / t-danger / t-ok / num / clamp-1 / clamp-2
 *
 * ---- S16 が受け取る params（呼び出し側はこの綴りで渡すこと）----
 *   id           プロジェクトID（キャンセルの戻り先 S8 と、実行後の遷移先に付ける）
 *   mode         'analysis'（既定）または 'generate'。最初にチェックを入れる機能を決める
 *   features     'kv_generation,meta_ads' のように機能キーをカンマで並べたもの（任意）
 *   reportId     参照する分析レポートID（任意。実行後の遷移先へそのまま引き継ぐ）
 *   generationId 参照する生成物ID（任意。同上）
 *   例: location.hash = '#/S16?id=' + projectId + '&mode=generate&features=crowdfunding_lp,meta_ads'
 *
 * ---- S16 が実行後に残すもの（S11 分析レポート / S13 生成結果 が読む）----
 *   App.state.creditConfirmed = {
 *     mode: 'analysis' | 'generate',
 *     features: [{ feature_key, feature_name, credit_cost }],
 *     total: 消費した合計クレジット,
 *     unlimited: 無制限利用中で消費しなかったか,
 *     projectId, reportId, generationId,
 *     at: ISO文字列
 *   }
 *   分析（mode=analysis）の引き落としと credit_transactions への記録はこの画面が行い、
 *   中身づくりは S11 が creditConfirmed を見て行う。
 *   生成（mode=generate）はこの画面では引き落とさない。S13 が creditConfirmed を見て
 *   generate-content Edge Function を呼び、サーバー側が LLM 成功後に消費+保存する。
 *
 * ---- S17 が受け取る params ----
 *   returnTo    'S16' のとき、消費確認へ戻るボタンを出す
 *   id / mode / features / reportId / generationId  戻るときにそのまま S16 へ返す
 *
 * ---- 機能キー（a2f58db45_feature_credits の実データと同じ綴りを使う）----
 *   competitor_analysis 競合LP分析 / crowdfunding_lp クラファンLP生成 /
 *   own_lp 自社LP生成 / kv_creative KV生成 / meta_ads メタ広告文生成 /
 *   line_contents LINEコンテンツ生成 /
 *   project_create プロジェクト作成（S4 が消費する。S16 の一覧には出さない）
 *   credit_unit_price は機能ではなく「1クレジットあたりの円」を入れる特別な行。
 *
 * 無い関数は黙って飛ばさない。何が無いのかを console.error に必ず残す。
 * ============================================================ */

(function (window, document) {
  'use strict';

  var App = window.App = window.App || {};

  /* ---------- 依存の確認 ---------- */
  if (typeof App.registerScreen !== 'function') {
    console.error('[screens-credit] App.registerScreen が見つかりません。index.html の読み込み順（app.js -> screens-credit.js）を確認してください。登録内容は window.App.screens に控えます。');
    App.screens = App.screens || {};
    App.registerScreen = function (id, spec) {
      if (!spec || typeof spec.render !== 'function') {
        console.error('[screens-credit] registerScreen の第2引数は { render: 関数 } である必��があります。画面ID: ' + id);
        return;
      }
      App.screens[id] = spec;
    };
  }
  if (!window.Api) {
    console.error('[screens-credit] window.Api が見つかりません。api.js が読み込まれているか確認してください。クレジット消費確認とクレジット画面は動きません。');
  }
  if (!window.I18N || typeof window.I18N.t !== 'function') {
    console.error('[screens-credit] window.I18N.t が見つかりません。i18n.js が読み込まれているか確認してください。翻訳キーをそのまま表示します。');
  }

  /* ---------- 定数 ---------- */
  var UNIT_PRICE_KEY = 'credit_unit_price';   // a2f58db45_feature_credits に置く単価専用の行（機能一覧からは除く）
  var CREATE_FEATURE_KEY = 'project_create';  // S4 が消費する。この画面の一覧には出さない
  var HISTORY_LIMIT = 50;
  var MAX_COUPON_LENGTH = 32;

  /* 機能別の既定クレジット。a2f58db45_feature_credits に行があればそちらを優先する。
     キーの綴りは feature_credits の実データに合わせる。ここがズレていると
     elpiya_consume_credit が feature_not_found で落ちる（旧: generation / kv_generation /
     line_content という実在しないキーが並んでいて、生成の実行が必ず失敗する状態だった）。 */
  var FEATURE_DEFAULTS = [
    { key: 'competitor_analysis', cost: 40, kind: 'analysis', name: ['競合LP分析', 'Competitor LP analysis', '경쟁 LP 분석'] },
    { key: 'crowdfunding_lp', cost: 60, kind: 'generate', name: ['クラファンLP生成', 'Crowdfunding LP generation', '크라우드펀딩 LP 생성'] },
    { key: 'own_lp', cost: 60, kind: 'generate', name: ['自社LP生成（LINE導線つき）', 'Brand LP generation (with LINE)', '자사 LP 생성(LINE 도선 포함)'] },
    { key: 'kv_creative', cost: 30, kind: 'generate', name: ['KV生成', 'Key visual generation', 'KV 생성'] },
    { key: 'meta_ads', cost: 30, kind: 'generate', name: ['メタ広告文生成', 'Meta ad copy generation', '메타 광고 문구 생성'] },
    { key: 'line_contents', cost: 30, kind: 'generate', name: ['LINEコンテンツ生成', 'LINE content generation', 'LINE 콘텐츠 생성'] }
  ];

  /*
   * 購入プラン（クレジット数と金額）はここには無い。stripe-checkout Edge Function が持つ。
   * 画面とサーバーで別々に持つと、表示は1200円・実際の請求は別の額、という食い違いが起きる。
   * Api.credits.plans() が [{ id, credits, yen }] を返す。
   */

  /* i18n.js の辞書に無い文言だけをここで持つ。並びは [日本語, English, 한국어] */
  var LOCAL = {
    'local.selectPlan': ['購入プランを選択', 'Choose a plan', '구매 플랜 선택'],
    'local.perCredit': ['1クレジットあたり', 'per credit', '크레딧당'],
    'local.paymentNotice': [
      '購入を押すと決済ページ（Stripe）が開きます。クレジットは支払いの完了後に反映されます。',
      'Purchasing opens the Stripe payment page. Credits are added once the payment completes.',
      '구매를 누르면 결제 페이지(Stripe)가 열립니다. 크레딧은 결제 완료 후 반영됩니다.'
    ],
    'local.paidPending': [
      'お支払いありがとうございます。反映まで少しかかることがあります。',
      'Thank you for your payment. It can take a moment to appear.',
      '결제해 주셔서 감사합니다. 반영까지 잠시 걸릴 수 있습니다.'
    ],
    'local.plansFailed': [
      '購入プランを読み込めませんでした。',
      'Could not load the purchase plans.',
      '구매 플랜을 불러오지 못했습니다.'
    ],
    'local.couponHint': [
      'クレジットまたは無制限利用権のクーポンを登録できます',
      'You can redeem credit or unlimited-access coupons',
      '크레딧 또는 무제한 이용권 쿠폰을 등록할 수 있습니다'
    ],
    'local.couponRequired': ['クーポンコードを入力してください', 'Please enter a coupon code', '쿠폰 코드를 입력해 주세요'],
    'local.couponCreditSuccess': ['{n}クレジットを追加しました', 'Added {n} credits', '{n} 크레딧을 추가했습니다'],
    'local.couponUnlimitedSuccess': ['無制限利用権を{days}日間追加しました', 'Unlimited access extended by {days} days', '무제한 이용권을 {days}일 추가했습니다'],
    'local.unlimitedBadge': ['無制限利用中', 'Unlimited active', '무제한 이용 중'],
    'local.unlimitedNotice': [
      '無制限利用中のため、この実行ではクレジットを消費しません',
      'Unlimited access is active, so this run does not use credits',
      '무제한 이용 중이므로 이번 실행에서는 크레딧을 소모하지 않습니다'
    ],
    'local.shortage': ['不足', 'Short by', '부족'],
    'local.needAnalysisFeature': ['競合LP分析にチェックを入れてください', 'Please check competitor LP analysis', '경쟁 LP 분석에 체크해 주세요'],
    'local.needGenerateFeature': ['生成する機能にチェックを入れてください', 'Please check at least one generation feature', '생성할 기능에 체크해 주세요'],
    'local.noFeature': ['実行できる機能が登録されていません', 'No runnable features are configured', '실행할 수 있는 기능이 등록되어 있지 않습니다'],
    'local.executing': ['実行中…', 'Running…', '실행 중…'],
    'local.processing': ['処理中…', 'Processing…', '처리 중…'],
    'local.backToConfirm': ['クレジット消費確認へ戻る', 'Back to credit confirmation', '크레딧 사용 확인으로 돌아가기'],
    'local.consumeFailedPartial': [
      '一部の機能だけ引き落としが終わった状態で失敗しました。利用履歴で消費内容を確認してください。',
      'The charge failed partway through. Please check your history for what was already used.',
      '일부 기능만 차감된 상태에서 실패했습니다. 이용 내역에서 사용 내용을 확인해 주세요.'
    ],
    'local.historyBalanceAfter': ['残高', 'Balance', '잔액'],
    'local.purchaseCredits': ['{n}クレジット', '{n} credits', '{n} 크레딧']
  };

  /* ---------- 小さな道具 ---------- */
  function localeIndex() {
    var code = 'ja';
    if (window.I18N && typeof window.I18N.getLocale === 'function') {
      code = String(window.I18N.getLocale() || 'ja');
    }
    if (code === 'en') { return 1; }
    if (code === 'ko') { return 2; }
    return 0;
  }

  function fillParams(text, params) {
    var out = String(text);
    if (!params) { return out; }
    Object.keys(params).forEach(function (name) {
      out = out.split('{' + name + '}').join(String(params[name]));
    });
    return out;
  }

  function t(key, params) {
    if (window.I18N && typeof window.I18N.t === 'function') { return window.I18N.t(key, params); }
    return fillParams(key, params);
  }

  function tl(key, params) {
    var row = LOCAL[key];
    if (!row) {
      console.error('[screens-credit] このファイルの辞書に ' + key + ' がありません。キーをそのまま表示します。');
      return key;
    }
    return fillParams(row[localeIndex()] || row[0], params);
  }

  function el(tag, className, textContent) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (textContent !== undefined && textContent !== null) { node.textContent = String(textContent); }
    return node;
  }

  function button(className, label, onClick) {
    var node = el('button', className, label);
    node.type = 'button';
    if (onClick) { node.addEventListener('click', onClick); }
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) { node.removeChild(node.firstChild); }
  }

  function textOf(value) {
    return String(value === undefined || value === null ? '' : value);
  }

  function pad2(value) {
    return value < 10 ? '0' + value : String(value);
  }

  // 3桁区切り（外部ライブラリを使わない）
  function formatNumber(value) {
    var n = Math.round(Number(value) || 0);
    var sign = n < 0 ? '-' : '';
    var digits = String(Math.abs(n));
    var out = '';
    var count = 0;
    var i;
    for (i = digits.length - 1; i >= 0; i--) {
      out = digits.charAt(i) + out;
      count++;
      if (count % 3 === 0 && i > 0) { out = ',' + out; }
    }
    return sign + out;
  }

  function formatYen(value) {
    return '¥' + formatNumber(value);
  }

  function formatDate(value) {
    if (!value) { return ''; }
    var d = new Date(String(value));
    if (isNaN(d.getTime())) { return String(value); }
    return d.getFullYear() + '/' + pad2(d.getMonth() + 1) + '/' + pad2(d.getDate());
  }

  function formatDateTime(value) {
    if (!value) { return ''; }
    var d = new Date(String(value));
    if (isNaN(d.getTime())) { return String(value); }
    return formatDate(value) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function signedCredits(amount) {
    var n = Math.round(Number(amount) || 0);
    return (n > 0 ? '+' : '') + formatNumber(n) + t('common.creditShort');
  }

  function isArray(value) {
    return Object.prototype.toString.call(value) === '[object Array]';
  }

  /* api.js の ApiError は日本語のメッセージを持つ。英語・韓国語の画面では辞書の文言を優先する */
  function errorMessage(err, fallbackKey) {
    var code = err && err.code ? String(err.code) : '';
    if (code === 'network' || code === 'timeout') { return t('common.networkError'); }
    if (code === 'insufficient') { return t('creditConfirm.insufficientWarning'); }
    if (code === 'couponNotFound' || code === 'couponInactive') { return t('credit.couponInvalid'); }
    if (code === 'couponExpired') { return t('credit.couponExpired'); }
    if (code === 'couponUsedUp') { return t('credit.couponUsedUp'); }
    if (localeIndex() === 0 && err && err.message) { return String(err.message); }
    if (fallbackKey) { return t(fallbackKey); }
    if (err && err.message) { return String(err.message); }
    return t('common.error');
  }

  function apiReady() {
    if (window.Api && window.Api.users && window.Api.projects && window.Api.credits && window.Api.featureCredits) { return true; }
    console.error('[screens-credit] window.Api の中身（users / projects / credits / featureCredits）が揃っていません。api.js を確認してください。');
    return false;
  }

  /* ---------- 遷移（経路の綴りは index.html のとおり） ---------- */
  function hashFor(screenId, params) {
    var hash = '#/' + screenId;
    if (params) {
      var parts = [];
      Object.keys(params).forEach(function (key) {
        var value = params[key];
        if (value === undefined || value === null || value === '') { return; }
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
      });
      if (parts.length) { hash += '?' + parts.join('&'); }
    }
    return hash;
  }

  function go(screenId, params) {
    var next = hashFor(screenId, params);
    if (window.location.hash === next) { return; }
    window.location.hash = next;
  }

  function currentScreenId() {
    var hash = String(window.location.hash || '');
    if (hash.indexOf('#/') !== 0) { return ''; }
    var rest = hash.slice(2);
    var q = rest.indexOf('?');
    return q === -1 ? rest : rest.slice(0, q);
  }

  /* ---------- 共通シェルの操作 ---------- */
  function setHeader(title, showBack) {
    var titleNode = document.getElementById('header-title');
    var backNode = document.getElementById('header-back');
    var actionNode = document.getElementById('header-action');
    if (titleNode) { titleNode.textContent = title; }
    else { console.error('[screens-credit] index.html に #header-title がありません。'); }
    if (backNode) { backNode.hidden = !showBack; }
    else { console.error('[screens-credit] index.html に #header-back がありません。'); }
    if (actionNode) { clear(actionNode); }
  }

  function toast(message, kind) {
    if (typeof App.toast === 'function') { App.toast(message, kind); return; }
    var root = document.getElementById('toast-root');
    if (!root) {
      console.error('[screens-credit] #toast-root が無いため通知を表示できません: ' + message);
      return;
    }
    var extra = '';
    if (kind === 'success') { extra = ' toast--success'; }
    if (kind === 'danger') { extra = ' toast--danger'; }
    var box = el('div', 'toast' + extra);
    box.appendChild(el('span', 'toast__text', message));
    root.appendChild(box);
    window.setTimeout(function () {
      if (box.parentNode) { box.parentNode.removeChild(box); }
    }, 3600);
  }

  function clearBanner() {
    var root = document.getElementById('banner-root');
    if (root) { clear(root); }
  }

  function showBanner(message, onRetry) {
    var root = document.getElementById('banner-root');
    if (!root) {
      console.error('[screens-credit] #banner-root が無いため通信失敗を表示できません: ' + message);
      return;
    }
    clear(root);
    var banner = el('div', 'banner');
    banner.setAttribute('role', 'alert');
    banner.appendChild(el('span', 'banner__text', message));
    if (onRetry) {
      banner.appendChild(button('banner__retry', t('common.retry'), function () {
        clearBanner();
        onRetry();
      }));
    }
    root.appendChild(banner);
  }

  function showSkeleton(root) {
    clear(root);
    var wrap = el('div', 'screen');
    var shapes = ['skeleton skeleton--title', 'skeleton skeleton--card', 'skeleton skeleton--card', 'skeleton skeleton--row', 'skeleton skeleton--row'];
    shapes.forEach(function (cls) {
      var box = el('div', cls);
      box.setAttribute('aria-hidden', 'true');
      wrap.appendChild(box);
    });
    wrap.appendChild(el('p', 'loading-text', t('common.loading')));
    root.appendChild(wrap);
  }

  function showErrorScreen(root, message, onRetry) {
    showBanner(message, onRetry);
    clear(root);
    var wrap = el('div', 'screen');
    var box = el('div', 'empty');
    box.appendChild(el('p', 'empty__text', message));
    box.appendChild(button('btn btn--primary', t('common.retry'), function () {
      clearBanner();
      onRetry();
    }));
    wrap.appendChild(box);
    root.appendChild(wrap);
  }

  /* ---------- 現在のユーザー ---------- */
  function currentUserId() {
    if (typeof App.getUser === 'function') {
      var current = App.getUser();
      if (current && current.id) { return String(current.id); }
    }
    if (App.state && App.state.user && App.state.user.id) { return String(App.state.user.id); }
    if (window.Api && window.Api.storage) { return window.Api.storage.get('userId'); }
    console.error('[screens-credit] 現在のユーザーIDを取得できません（App.getUser も App.state も Api.storage も使えません）。');
    return null;
  }

  function syncUser(user) {
    if (!user) { return; }
    if (App.state && typeof App.state === 'object') {
      App.state.user = user;
      App.state.creditBalance = Number(user.credit_balance) || 0;
    } else {
      App.state = { user: user, creditBalance: Number(user.credit_balance) || 0 };
    }
    /* silent が要る。App.setUser は既定で画面全体を描き直すため、
       描画中に呼ぶ（この関数は loadUser から呼ばれる）と
       描画→取得→setUser→描画… の無限ループになり、
       チェックした機能が毎回消えて「生成を実行」が押せなくなる。 */
    if (typeof App.setUser === 'function') { App.setUser(user, { silent: true }); }
    else if (typeof App.setBalance === 'function') { App.setBalance(Number(user.credit_balance) || 0); }
  }

  function loadUser() {
    if (!apiReady()) {
      return Promise.reject({ code: 'noApi', message: t('common.error') });
    }
    var id = currentUserId();
    if (!id) {
      return Promise.reject({ code: 'noUser', message: t('common.error') });
    }
    return window.Api.users.get(id).then(function (user) {
      syncUser(user);
      return user;
    });
  }

  function hasUnlimited(user) {
    if (window.Api && window.Api.credits && typeof window.Api.credits.hasUnlimited === 'function') {
      return window.Api.credits.hasUnlimited(user);
    }
    console.error('[screens-credit] Api.credits.hasUnlimited がありません。無制限利用権は無いものとして扱います。');
    return false;
  }

  function projectIdFrom(params) {
    if (params && params.id) { return String(params.id); }
    if (params && params.projectId) { return String(params.projectId); }
    if (App.state && App.state.projectId) { return String(App.state.projectId); }
    if (window.Api && window.Api.storage) {
      var saved = window.Api.storage.get('projectId');
      if (saved) { return String(saved); }
    }
    return null;
  }

  /* ---------- 機能別クレジット（a2f58db45_feature_credits） ---------- */
  function loadFeatureRows() {
    if (!window.Api || !window.Api.credits || typeof window.Api.credits.featureCosts !== 'function') {
      console.error('[screens-credit] Api.credits.featureCosts がありません。このファイルの既定値だけで表示します。');
      return Promise.resolve([]);
    }
    return window.Api.credits.featureCosts();
  }

  function buildFeatureList(rows) {
    var byKey = {};
    (rows || []).forEach(function (row) {
      var key = textOf(row.feature_key).trim();
      if (!key) { return; }
      byKey[key] = row;
    });

    var out = [];
    var seen = {};
    var index = localeIndex();

    FEATURE_DEFAULTS.forEach(function (def) {
      seen[def.key] = true;
      var row = byKey[def.key];
      if (row && row.is_active === false) { return; }
      out.push({
        key: def.key,
        kind: def.kind,
        name: (row && textOf(row.feature_name).trim()) || def.name[index] || def.name[0],
        cost: row ? Math.max(0, Math.round(Number(row.credit_cost) || 0)) : def.cost
      });
    });

    /* 管理画面（S19）で足された機能もそのまま並べる。生成側として扱う */
    Object.keys(byKey).forEach(function (key) {
      if (seen[key]) { return; }
      if (key === UNIT_PRICE_KEY || key === CREATE_FEATURE_KEY) { return; }
      var row = byKey[key];
      if (row.is_active === false) { return; }
      out.push({
        key: key,
        kind: 'generate',
        name: textOf(row.feature_name).trim() || key,
        cost: Math.max(0, Math.round(Number(row.credit_cost) || 0))
      });
    });

    return out;
  }

  /* ============================================================
   * S16 クレジット消費確認（機能別消費クレジット・残高表示）
   *   残高 / 今回消費 / 機能別単価のチェック集計 / 実行後残高 / 不足警告
   *   分析を実行・生成を実行・チャージ・キャンセル
   * ============================================================ */
  function renderConfirm(root, params) {
    mounted = { id: 'S16', root: root, params: params };
    setHeader(t('creditConfirm.title'), true);

    var query = params || {};
    var projectId = projectIdFrom(query);
    var reportId = textOf(query.reportId).trim();
    var generationId = textOf(query.generationId).trim();
    var mode = textOf(query.mode).trim();
    if (mode !== 'analysis' && mode !== 'generate') {
      mode = reportId ? 'generate' : 'analysis';
    }

    var state = {
      user: null,
      project: null,
      features: [],
      selected: {},
      busy: false
    };

    /* 集計の貼り替え先（チェックのたびに画面全体を描き直さない） */
    var nodes = {
      balanceValue: null,
      costValue: null,
      afterValue: null,
      warnHost: null,
      analysisButton: null,
      generateButton: null
    };

    function selectedFeatures() {
      return state.features.filter(function (feature) { return !!state.selected[feature.key]; });
    }

    function totalCost() {
      var sum = 0;
      selectedFeatures().forEach(function (feature) { sum += Math.max(0, feature.cost); });
      return sum;
    }

    function balanceOf() {
      return Math.max(0, Math.round(Number(state.user && state.user.credit_balance) || 0));
    }

    function unlimited() {
      return hasUnlimited(state.user);
    }

    function afterBalance() {
      if (unlimited()) { return balanceOf(); }
      return balanceOf() - totalCost();
    }

    function shortage() {
      var lack = totalCost() - balanceOf();
      return lack > 0 ? lack : 0;
    }

    function hasAnalysisChecked() {
      var found = false;
      selectedFeatures().forEach(function (feature) {
        if (feature.kind === 'analysis') { found = true; }
      });
      return found;
    }

    function hasGenerateChecked() {
      var found = false;
      selectedFeatures().forEach(function (feature) {
        if (feature.kind !== 'analysis') { found = true; }
      });
      return found;
    }

    function initSelection() {
      var wanted = {};
      var raw = textOf(query.features).trim();
      if (raw) {
        raw.split(',').forEach(function (part) {
          var key = part.trim();
          if (key) { wanted[key] = true; }
        });
      }

      state.features.forEach(function (feature) {
        if (raw) { state.selected[feature.key] = !!wanted[feature.key]; return; }
        if (mode === 'analysis') { state.selected[feature.key] = feature.kind === 'analysis'; return; }
        state.selected[feature.key] = feature.key === 'generation';
      });

      var any = false;
      state.features.forEach(function (feature) {
        if (state.selected[feature.key]) { any = true; }
      });
      if (!any && state.features.length) {
        state.selected[state.features[0].key] = true;
      }
    }

    function load() {
      clearBanner();
      showSkeleton(root);

      loadUser().then(function (user) {
        state.user = user;
        return loadFeatureRows();
      }).then(function (rows) {
        state.features = buildFeatureList(rows);
        initSelection();
        if (!projectId) {
          state.project = null;
          paint();
          return null;
        }
        return window.Api.projects.get(projectId).then(function (project) {
          state.project = project;
          paint();
          return project;
        }, function (err) {
          /* プロジェクト名は見出しに添えるだけなので、取れなくてもこの画面は使える */
          console.warn('[screens-credit] プロジェクト名を取得できませんでした（見出しの補足だけを省きます）', err);
          state.project = null;
          paint();
          return null;
        });
      }).catch(function (err) {
        if (err && err.code === 'noUser') {
          console.error('[screens-credit] ログイン中のユーザーがいないため S1 ログインへ戻します。');
          go('S1');
          return;
        }
        console.error('[screens-credit] クレジット消費確認の読み込みに失敗しました', err);
        showErrorScreen(root, errorMessage(err, 'credit.loadFailed'), load);
      });
    }

    function goCharge() {
      var keys = [];
      selectedFeatures().forEach(function (feature) { keys.push(feature.key); });
      go('S17', {
        returnTo: 'S16',
        id: projectId,
        mode: mode,
        features: keys.join(','),
        reportId: reportId,
        generationId: generationId
      });
    }

    function goCancel() {
      if (projectId) { go('S8', { id: projectId }); return; }
      go('S3');
    }

    function setDisabled(node, disabled) {
      if (!node) { return; }
      node.disabled = !!disabled;
      node.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }

    function paintWarn() {
      if (!nodes.warnHost) { return; }
      clear(nodes.warnHost);

      if (unlimited()) {
        var okBox = el('div', 'note-box');
        okBox.appendChild(el('p', null, tl('local.unlimitedNotice')));
        nodes.warnHost.appendChild(okBox);
        return;
      }

      var lack = shortage();
      if (!lack) { return; }

      var box = el('div', 'warn-box');
      box.setAttribute('role', 'alert');
      box.appendChild(el('p', null, t('creditConfirm.insufficientWarning')));
      box.appendChild(el('p', null,
        t('creditConfirm.balance') + ' ' + formatNumber(balanceOf()) + t('common.creditShort') +
        ' / ' + t('creditConfirm.thisTime') + ' ' + formatNumber(totalCost()) + t('common.creditShort') +
        ' / ' + tl('local.shortage') + ' ' + formatNumber(lack) + t('common.creditShort')));
      box.appendChild(button('btn btn--text', t('creditConfirm.charge'), goCharge));
      nodes.warnHost.appendChild(box);
    }

    function paintButtons() {
      var blocked = state.busy || (!unlimited() && shortage() > 0);
      setDisabled(nodes.analysisButton, blocked || !hasAnalysisChecked());
      setDisabled(nodes.generateButton, blocked || !hasGenerateChecked());
      if (!state.busy) {
        if (nodes.analysisButton) { nodes.analysisButton.textContent = t('creditConfirm.runAnalysis'); }
        if (nodes.generateButton) { nodes.generateButton.textContent = t('creditConfirm.runGenerate'); }
      }
    }

    function refreshSummary() {
      if (nodes.balanceValue) { nodes.balanceValue.textContent = formatNumber(balanceOf()); }
      if (nodes.costValue) { nodes.costValue.textContent = formatNumber(totalCost()); }
      if (nodes.afterValue) {
        nodes.afterValue.textContent = formatNumber(afterBalance()) + t('common.creditShort');
        nodes.afterValue.className = (!unlimited() && shortage() > 0) ? 'info-row__val num t-danger' : 'info-row__val num';
      }
      paintWarn();
      paintButtons();
    }

    function setBusy(on) {
      state.busy = on;
      if (on) {
        if (nodes.analysisButton) { nodes.analysisButton.textContent = tl('local.executing'); }
        if (nodes.generateButton) { nodes.generateButton.textContent = tl('local.executing'); }
      }
      paintButtons();
    }

    /*
     * 選んだ機能を1件ずつ引き落とす。
     * ponytail: 途中で失敗しても、すでに引き落とし済みの機能は戻さない（api.js の1件ずつの記録に合わせる）。
     *           1回の取引としてまとめたいなら Supabase の RPC を足して、そこへ移すこと。
     */
    function consumeAll(entries, memo) {
      var charged = [];
      return entries.reduce(function (chain, entry) {
        return chain.then(function () {
          if (entry.cost <= 0) { return null; }
          return window.Api.credits.consume(entry.key, memo).then(function (result) {
            charged.push(entry);
            state.user = result.user;
            syncUser(result.user);
            return result;
          }, function (err) {
            if (err) { err.chargedCount = charged.length; }
            return Promise.reject(err);
          });
        });
      }, Promise.resolve()).then(function () { return charged; });
    }

    function execute(kind) {
      if (state.busy) { return; }

      if (!state.features.length) {
        toast(tl('local.noFeature'), 'danger');
        return;
      }
      if (kind === 'analysis' && !hasAnalysisChecked()) {
        toast(tl('local.needAnalysisFeature'), 'danger');
        return;
      }
      if (kind === 'generate' && !hasGenerateChecked()) {
        toast(tl('local.needGenerateFeature'), 'danger');
        return;
      }
      if (!apiReady()) {
        toast(t('common.error'), 'danger');
        return;
      }

      var entries = selectedFeatures();
      var total = totalCost();
      var isUnlimited = unlimited();

      if (!isUnlimited && total > balanceOf()) {
        refreshSummary();
        toast(t('creditConfirm.insufficientWarning'), 'danger');
        return;
      }

      var memo = (state.project && textOf(state.project.project_name)) || t('creditConfirm.title');

      setBusy(true);
      clearBanner();

      /* 生成はここで引き落とさない。S13 が呼ぶ generate-content Edge Function が
         LLM 成功後に消費+保存を1トランザクションで行う（先に消費すると失敗時の
         返金経路が要るため）。分析（S11）は従来どおりここで引き落とす。 */
      var work = (isUnlimited || kind === 'generate') ? Promise.resolve([]) : consumeAll(entries, memo);

      work.then(function () {
        App.state = App.state || {};
        App.state.creditConfirmed = {
          mode: kind,
          features: entries.map(function (entry) {
            return { feature_key: entry.key, feature_name: entry.name, credit_cost: entry.cost };
          }),
          total: isUnlimited ? 0 : total,
          unlimited: isUnlimited,
          projectId: projectId,
          reportId: reportId || null,
          generationId: generationId || null,
          at: new Date().toISOString()
        };

        toast(t('common.saved'), 'success');

        if (kind === 'analysis') {
          go('S11', { id: projectId, reportId: reportId });
        } else {
          go('S13', { id: projectId, reportId: reportId, generationId: generationId });
        }
      }).catch(function (err) {
        setBusy(false);
        console.error('[screens-credit] クレジットの引き落としに失敗しました', err);
        var message = errorMessage(err, 'creditConfirm.executeFailed');
        if (err && err.chargedCount) { message = message + ' ' + tl('local.consumeFailedPartial'); }
        showBanner(message, function () { execute(kind); });
        toast(message, 'danger');
        /* 途中まで引き落とされている場合があるので、残高を取り直してから集計を出し直す */
        loadUser().then(function (user) {
          state.user = user;
          refreshSummary();
        }, function (reloadErr) {
          console.error('[screens-credit] 残高の取り直しにも失敗しました', reloadErr);
        });
      });
    }

    function featureRow(feature) {
      var row = el('label', 'check-row');

      var box = el('input', 'check-row__box');
      box.type = 'checkbox';
      box.checked = !!state.selected[feature.key];
      box.addEventListener('change', function () {
        state.selected[feature.key] = box.checked;
        refreshSummary();
      });
      row.appendChild(box);

      /* check-row__label で幅を、list-row__body で縦並びを受け持つ（どちらも styles.css に実在する） */
      var body = el('span', 'check-row__label list-row__body');
      body.appendChild(el('span', 'list-row__title clamp-2', feature.name));
      body.appendChild(el('span', 'list-row__sub clamp-1', feature.key));
      row.appendChild(body);

      row.appendChild(el('span', 'list-row__meta num', formatNumber(feature.cost) + t('common.creditShort')));
      return row;
    }

    function paint() {
      clearBanner();
      clear(root);

      var screen = el('div', 'screen');

      /* 見出し */
      var head = el('header', 'screen__head');
      head.appendChild(el('h2', 'screen__title', t('creditConfirm.title')));
      if (state.project && textOf(state.project.project_name)) {
        head.appendChild(el('p', 'screen__lead clamp-2', textOf(state.project.project_name)));
      }
      screen.appendChild(head);

      /* 残高 */
      var balanceCard = el('div', 'card card--gradient');
      balanceCard.appendChild(el('span', 'card__label', t('creditConfirm.balance')));
      var balanceValueWrap = el('span');
      nodes.balanceValue = el('span', 'card__value num', formatNumber(balanceOf()));
      balanceValueWrap.appendChild(nodes.balanceValue);
      balanceValueWrap.appendChild(el('span', 'card__unit', t('common.creditShort')));
      balanceCard.appendChild(balanceValueWrap);
      if (unlimited()) {
        balanceCard.appendChild(el('span', 'card__sub',
          tl('local.unlimitedBadge') + ' / ' + t('credit.expiry') + ' ' + formatDate(state.user.unlimited_until)));
      }
      screen.appendChild(balanceCard);

      /* 今回消費 */
      var costCard = el('div', 'card card--soft');
      costCard.appendChild(el('span', 'card__label', t('creditConfirm.thisTime')));
      var costValueWrap = el('span');
      nodes.costValue = el('span', 'card__value num', formatNumber(totalCost()));
      costValueWrap.appendChild(nodes.costValue);
      costValueWrap.appendChild(el('span', 'card__unit', t('common.creditShort')));
      costCard.appendChild(costValueWrap);
      screen.appendChild(costCard);

      /* 機能別消費 */
      var section = el('section', 'section');
      var sectionHead = el('div', 'section__head');
      sectionHead.appendChild(el('h3', 'section__title', t('creditConfirm.byFeature')));
      section.appendChild(sectionHead);
      section.appendChild(el('p', 'section__desc', t('featurePricing.note')));

      if (!state.features.length) {
        var emptyBox = el('div', 'empty');
        emptyBox.appendChild(el('p', 'empty__text', tl('local.noFeature')));
        emptyBox.appendChild(button('btn btn--primary', t('creditConfirm.cancel'), goCancel));
        section.appendChild(emptyBox);
      } else {
        var list = el('div', 'list');
        state.features.forEach(function (feature) { list.appendChild(featureRow(feature)); });
        section.appendChild(list);
      }
      screen.appendChild(section);

      /* 実行後残高 */
      var info = el('div', 'info-list');
      var afterRow = el('div', 'info-row');
      afterRow.appendChild(el('span', 'info-row__key', t('creditConfirm.afterExecution')));
      nodes.afterValue = el('span', 'info-row__val num', formatNumber(afterBalance()) + t('common.creditShort'));
      afterRow.appendChild(nodes.afterValue);
      info.appendChild(afterRow);
      screen.appendChild(info);

      /* 不足警告・無制限の案内 */
      nodes.warnHost = el('div', 'stack stack--tight');
      screen.appendChild(nodes.warnHost);

      /* 分析を実行 / 生成を実行 */
      var runRow = el('div', 'btn-row');
      nodes.analysisButton = button(
        mode === 'analysis' ? 'btn btn--primary' : 'btn btn--secondary',
        t('creditConfirm.runAnalysis'),
        function () { execute('analysis'); }
      );
      nodes.generateButton = button(
        mode === 'generate' ? 'btn btn--primary' : 'btn btn--secondary',
        t('creditConfirm.runGenerate'),
        function () { execute('generate'); }
      );
      runRow.appendChild(nodes.analysisButton);
      runRow.appendChild(nodes.generateButton);
      screen.appendChild(runRow);

      /* チャージ / キャンセル */
      var subRow = el('div', 'btn-row');
      subRow.appendChild(button('btn btn--secondary', t('creditConfirm.charge'), goCharge));
      subRow.appendChild(button('btn btn--secondary', t('creditConfirm.cancel'), goCancel));
      screen.appendChild(subRow);

      root.appendChild(screen);
      refreshSummary();
    }

    load();
  }

  /* ============================================================
   * S17 クレジット
   *   残高 / 購入プラン選択と購入処理 / クーポンコード登録 / 利用履歴（新しい順）
   * ============================================================ */
  function renderCredit(root, params) {
    mounted = { id: 'S17', root: root, params: params };
    setHeader(t('credit.title'), true);

    var query = params || {};
    var returnTo = textOf(query.returnTo).trim();
    // Stripe の success_url から戻ってきた印。付与は webhook 経由なので、
    // 戻ってきた瞬間にはまだ残高が増えていないことがある。
    var justPaid = textOf(query.paid).trim() === '1';

    var state = {
      user: null,
      plans: [],
      featureNames: {},
      history: [],
      planIndex: 0,
      coupon: '',
      couponError: '',
      buying: false,
      redeeming: false
    };

    var nodes = {
      planHost: null,
      buyButton: null,
      couponInput: null,
      couponErrorNode: null,
      couponButton: null,
      historyHost: null
    };

    function planYen(plan) {
      return Math.round(Number(plan && plan.yen) || 0);
    }

    function planUnitYen(plan) {
      if (!plan || !plan.credits) { return 0; }
      return Math.round((planYen(plan) / plan.credits) * 10) / 10;
    }

    function selectedPlan() {
      return state.plans[state.planIndex] || state.plans[0] || null;
    }

    function balanceOf() {
      return Math.max(0, Math.round(Number(state.user && state.user.credit_balance) || 0));
    }

    /* 利用履歴は新しい順。created_at が読めない行は末尾へ回す */
    function sortHistory(rows) {
      var list = isArray(rows) ? rows.slice() : [];
      list.sort(function (a, b) {
        var ta = new Date(String(a && a.created_at)).getTime();
        var tb = new Date(String(b && b.created_at)).getTime();
        if (isNaN(ta) && isNaN(tb)) { return 0; }
        if (isNaN(ta)) { return 1; }
        if (isNaN(tb)) { return -1; }
        return tb - ta;
      });
      return list;
    }

    function load() {
      clearBanner();
      showSkeleton(root);

      loadUser().then(function (user) {
        state.user = user;
        return Promise.all([
          loadFeatureRows(),
          window.Api.credits.history(user.id, HISTORY_LIMIT),
          // プランが取れなくても残高と履歴は出す。購入だけができない状態にする。
          window.Api.credits.plans().catch(function (err) {
            console.error('[screens-credit] 購入プランを読み込めませんでした', err);
            return [];
          })
        ]);
      }).then(function (results) {
        var rows = results[0] || [];
        state.plans = results[2] || [];
        state.featureNames = {};
        buildFeatureList(rows).forEach(function (feature) {
          state.featureNames[feature.key] = feature.name;
        });
        state.history = sortHistory(results[1] || []);
        paint();
        if (justPaid) {
          justPaid = false;
          toast(tl('local.paidPending'), 'success');
        }
      }).catch(function (err) {
        if (err && err.code === 'noUser') {
          console.error('[screens-credit] ログイン中のユーザーがいないため S1 ログインへ戻します。');
          go('S1');
          return;
        }
        console.error('[screens-credit] クレジット画面の読み込みに失敗しました', err);
        showErrorScreen(root, errorMessage(err, 'credit.loadFailed'), load);
      });
    }

    function reload() {
      return Promise.all([
        window.Api.users.get(state.user.id),
        window.Api.credits.history(state.user.id, HISTORY_LIMIT)
      ]).then(function (results) {
        state.user = results[0];
        syncUser(results[0]);
        state.history = sortHistory(results[1] || []);
        paint();
      });
    }

    function txTypeLabel(row) {
      var type = textOf(row.transaction_type).trim();
      if (type === 'purchase') { return t('credit.txType.purchase'); }
      if (type === 'consume') { return t('credit.txType.consume'); }
      if (type === 'grant') { return t('credit.txType.grant'); }
      if (type === 'coupon') { return t('credit.txType.coupon'); }
      return type || t('credit.history');
    }

    function txTitle(row) {
      var key = textOf(row.feature_key).trim();
      if (key && state.featureNames[key]) { return state.featureNames[key]; }
      if (key) { return key; }
      return txTypeLabel(row);
    }

    function historyRow(row) {
      var item = el('div', 'list-row');

      var body = el('div', 'list-row__body');
      body.appendChild(el('span', 'list-row__title clamp-1', txTitle(row)));
      var sub = txTypeLabel(row) + ' · ' + formatDateTime(row.created_at);
      if (textOf(row.memo).trim()) { sub = sub + ' · ' + textOf(row.memo).trim(); }
      body.appendChild(el('span', 'list-row__sub clamp-2', sub));
      item.appendChild(body);

      var meta = el('div', 'list-row__meta');
      var amount = Math.round(Number(row.credit_amount) || 0);
      meta.appendChild(el('span', amount < 0 ? 'num t-danger' : 'num t-ok', signedCredits(amount)));
      meta.appendChild(document.createElement('br'));
      meta.appendChild(el('span', 'num t-note', tl('local.historyBalanceAfter') + ' ' + formatNumber(row.balance_after)));
      item.appendChild(meta);

      return item;
    }

    function paintHistory() {
      if (!nodes.historyHost) { return; }
      clear(nodes.historyHost);

      if (!state.history.length) {
        var box = el('div', 'empty');
        box.appendChild(el('p', 'empty__text', t('credit.historyEmpty')));
        box.appendChild(button('btn btn--primary', t('credit.purchase'), function () {
          if (nodes.buyButton && typeof nodes.buyButton.focus === 'function') { nodes.buyButton.focus(); }
        }));
        nodes.historyHost.appendChild(box);
        return;
      }

      var list = el('div', 'list');
      state.history.forEach(function (row) { list.appendChild(historyRow(row)); });
      nodes.historyHost.appendChild(list);
    }

    function updateBuyButton() {
      if (!nodes.buyButton) { return; }
      var plan = selectedPlan();
      var disabled = state.buying || !plan;
      nodes.buyButton.textContent = state.buying
        ? tl('local.processing')
        : (plan ? t('credit.purchase') + ' ' + formatYen(planYen(plan)) : t('credit.purchase'));
      nodes.buyButton.disabled = disabled;
      nodes.buyButton.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }

    function paintPlans() {
      if (!nodes.planHost) { return; }
      clear(nodes.planHost);

      if (!state.plans.length) {
        var empty = el('div', 'empty');
        empty.appendChild(el('p', 'empty__text', tl('local.plansFailed')));
        nodes.planHost.appendChild(empty);
        return;
      }

      state.plans.forEach(function (plan, index) {
        var selected = index === state.planIndex;
        var card = el('button', selected ? 'card card--soft' : 'card');
        card.type = 'button';
        card.setAttribute('aria-pressed', selected ? 'true' : 'false');

        var top = el('span', 'row row--between');
        top.appendChild(el('span', 'card__label', tl('local.purchaseCredits', { n: formatNumber(plan.credits) })));
        if (selected) { top.appendChild(el('span', 'badge badge--ok', t('common.ok'))); }
        card.appendChild(top);

        card.appendChild(el('span', 'card__value num', formatYen(planYen(plan))));
        card.appendChild(el('span', 'card__sub num', tl('local.perCredit') + ' ' + formatYen(planUnitYen(plan))));

        card.addEventListener('click', function () {
          state.planIndex = index;
          paintPlans();
          updateBuyButton();
        });

        nodes.planHost.appendChild(card);
      });
    }

    function purchase() {
      if (state.buying) { return; }
      if (!apiReady()) {
        toast(t('common.error'), 'danger');
        return;
      }

      var plan = selectedPlan();
      if (!plan) { return; }

      state.buying = true;
      updateBuyButton();
      clearBanner();

      /*
       * 決済ページへ移るだけ。ここでは残高を触らない。
       * 付与は支払い完了後に Stripe が stripe-webhook を叩いて行う。
       * 画面から「買った」と申告できる経路を残すと、決済を通さず増やせてしまう。
       */
      window.Api.credits.checkout(plan.id).then(function (url) {
        window.location.href = url;
      }).catch(function (err) {
        state.buying = false;
        updateBuyButton();
        console.error('[screens-credit] 決済ページを開けませんでした', err);
        var message = errorMessage(err, 'credit.purchaseFailed');
        showBanner(message, purchase);
        toast(message, 'danger');
      });
    }

    function setCouponError(message) {
      state.couponError = message || '';
      if (nodes.couponErrorNode) { nodes.couponErrorNode.textContent = state.couponError; }
      if (nodes.couponInput) {
        nodes.couponInput.className = state.couponError ? 'input input--error' : 'input';
        nodes.couponInput.setAttribute('aria-invalid', state.couponError ? 'true' : 'false');
      }
    }

    function updateCouponButton() {
      if (!nodes.couponButton) { return; }
      nodes.couponButton.textContent = state.redeeming ? tl('local.processing') : t('credit.couponApply');
      nodes.couponButton.disabled = state.redeeming;
      nodes.couponButton.setAttribute('aria-disabled', state.redeeming ? 'true' : 'false');
    }

    function redeem() {
      if (state.redeeming) { return; }

      var code = textOf(state.coupon).trim();
      if (!code) {
        setCouponError(tl('local.couponRequired'));
        return;
      }
      if (!apiReady() || typeof window.Api.credits.redeemCoupon !== 'function') {
        console.error('[screens-credit] Api.credits.redeemCoupon がありません。クーポンを登録できません。');
        setCouponError(t('common.error'));
        return;
      }

      setCouponError('');
      state.redeeming = true;
      updateCouponButton();
      clearBanner();

      window.Api.credits.redeemCoupon(code).then(function (result) {
        state.coupon = '';
        if (nodes.couponInput) { nodes.couponInput.value = ''; }
        return reload().then(function () { return result; });
      }).then(function (result) {
        state.redeeming = false;
        updateCouponButton();
        toast(t('credit.couponSuccess'), 'success');
        if (result && result.type === 'unlimited') {
          toast(tl('local.couponUnlimitedSuccess', { days: formatNumber(result.days) }), 'success');
        } else if (result) {
          toast(tl('local.couponCreditSuccess', { n: formatNumber(result.credits) }), 'success');
        }
      }).catch(function (err) {
        state.redeeming = false;
        updateCouponButton();
        console.error('[screens-credit] クーポンの登録に失敗しました', err);
        var message = errorMessage(err, 'credit.couponInvalid');
        setCouponError(message);
        toast(message, 'danger');
      });
    }

    function paint() {
      clearBanner();
      clear(root);

      var screen = el('div', 'screen');

      /* 見出し */
      var head = el('header', 'screen__head');
      head.appendChild(el('h2', 'screen__title', t('credit.title')));
      if (state.user && textOf(state.user.display_name)) {
        head.appendChild(el('p', 'screen__lead clamp-1', textOf(state.user.display_name)));
      }
      screen.appendChild(head);

      /* 残高 */
      var balanceCard = el('div', 'card card--gradient');
      balanceCard.appendChild(el('span', 'card__label', t('credit.balance')));
      var balanceValueWrap = el('span');
      balanceValueWrap.appendChild(el('span', 'card__value num', formatNumber(balanceOf())));
      balanceValueWrap.appendChild(el('span', 'card__unit', t('common.creditUnit')));
      balanceCard.appendChild(balanceValueWrap);
      if (state.user && state.user.unlimited_until) {
        balanceCard.appendChild(el('span', 'card__sub',
          (hasUnlimited(state.user) ? tl('local.unlimitedBadge') + ' / ' : '') +
          t('credit.expiry') + ' ' + formatDate(state.user.unlimited_until)));
      }
      screen.appendChild(balanceCard);

      /* 購入プラン */
      var planSection = el('section', 'section');
      var planHead = el('div', 'section__head');
      planHead.appendChild(el('h3', 'section__title', tl('local.selectPlan')));
      planSection.appendChild(planHead);

      nodes.planHost = el('div', 'stack');
      planSection.appendChild(nodes.planHost);

      nodes.buyButton = button('btn btn--primary btn--block', t('credit.purchase'), purchase);
      planSection.appendChild(nodes.buyButton);

      var notice = el('div', 'note-box');
      notice.appendChild(el('p', null, tl('local.paymentNotice')));
      planSection.appendChild(notice);

      screen.appendChild(planSection);

      /* クーポンコード登録 */
      var couponSection = el('section', 'section');
      var couponHead = el('div', 'section__head');
      couponHead.appendChild(el('h3', 'section__title', t('credit.couponLabel')));
      couponSection.appendChild(couponHead);

      var couponRow = el('div', 'row row--input-action');

      var couponField = el('div', 'field');
      var couponLabel = el('label', 'field__label', t('credit.couponLabel'));
      couponLabel.setAttribute('for', 'credit-coupon');
      couponField.appendChild(couponLabel);

      nodes.couponInput = el('input', 'input');
      nodes.couponInput.type = 'text';
      nodes.couponInput.id = 'credit-coupon';
      nodes.couponInput.value = state.coupon;
      nodes.couponInput.maxLength = MAX_COUPON_LENGTH;
      nodes.couponInput.setAttribute('autocomplete', 'off');
      nodes.couponInput.setAttribute('autocapitalize', 'characters');
      nodes.couponInput.setAttribute('spellcheck', 'false');
      nodes.couponInput.setAttribute('placeholder', t('credit.couponPlaceholder'));
      nodes.couponInput.addEventListener('input', function () {
        state.coupon = nodes.couponInput.value;
        if (state.couponError) { setCouponError(''); }
      });
      nodes.couponInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.keyCode === 13) {
          event.preventDefault();
          redeem();
        }
      });
      couponField.appendChild(nodes.couponInput);

      nodes.couponErrorNode = el('p', 'field__error', state.couponError);
      couponField.appendChild(nodes.couponErrorNode);
      couponField.appendChild(el('p', 'field__hint', tl('local.couponHint')));

      couponRow.appendChild(couponField);

      nodes.couponButton = button('btn btn--secondary', t('credit.couponApply'), redeem);
      couponRow.appendChild(nodes.couponButton);

      couponSection.appendChild(couponRow);
      screen.appendChild(couponSection);

      /* 利用履歴（新しい順） */
      var historySection = el('section', 'section');
      var historyHead = el('div', 'section__head');
      historyHead.appendChild(el('h3', 'section__title', t('credit.history')));
      historyHead.appendChild(el('span', 't-note', formatNumber(state.history.length) + t('dashboard.countUnit')));
      historySection.appendChild(historyHead);

      nodes.historyHost = el('div');
      historySection.appendChild(nodes.historyHost);
      screen.appendChild(historySection);

      /* 戻る導線 */
      if (returnTo === 'S16') {
        screen.appendChild(button('btn btn--secondary btn--block', tl('local.backToConfirm'), function () {
          go('S16', {
            id: query.id,
            mode: query.mode,
            features: query.features,
            reportId: query.reportId,
            generationId: query.generationId
          });
        }));
      }

      screen.appendChild(button('btn btn--secondary btn--block', t('credit.backToDashboard'), function () {
        go('S3');
      }));

      root.appendChild(screen);

      paintPlans();
      updateBuyButton();
      updateCouponButton();
      setCouponError(state.couponError);
      paintHistory();
    }

    load();
  }

  /* ============================================================
   * 言語切替への追随
   * i18n.js は elpiya:locale-changed を投げるだけなので、
   * 自分が今出している画面のときだけ描き直す。
   * ============================================================ */
  var mounted = { id: null, root: null, params: null };

  window.addEventListener('elpiya:locale-changed', function () {
    if (!mounted.id || !mounted.root) { return; }
    if (!document.body.contains(mounted.root)) { return; }
    if (currentScreenId() !== mounted.id) { return; }
    if (mounted.id === 'S16') { renderConfirm(mounted.root, mounted.params); }
    if (mounted.id === 'S17') { renderCredit(mounted.root, mounted.params); }
  });

  /* ---------- 画面登録（第2引数は必ず { render: 関数 }） ---------- */
  App.registerScreen('S16', {
    render: function (root, params) { renderConfirm(root, params); }
  });

  App.registerScreen('S17', {
    render: function (root, params) { renderCredit(root, params); }
  });

})(window, document);
