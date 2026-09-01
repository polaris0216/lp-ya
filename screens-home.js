/* ============================================================
 * エルピーヤ — screens-home.js
 * S3 ダッシュボード と S4 プロジェクト作成 の2画面だけを描く。
 *
 * ---- 他ファイルとの共通契約（この名前どおりに使う。似た名前を作らない）----
 * 画面登録   App.registerScreen('S3', { render: function (root, params) {} });
 *            第2引数は必ず { render: 関数 } のオブジェクト。関数をそのまま渡さない。
 * 画面遷移   index.html に書かれた経路の綴りをそのまま使う。
 *            location.hash = '#/S8?id=...' （ハッシュルーターは app.js）
 * 通信       api.js の window.Api だけを使う。
 *              Api.users.get(id) / Api.projects.list(options) / Api.projects.insert(row)
 *              Api.projects.remove(id) / Api.analysisReports.list(options)
 *              Api.creditTransactions.list(options)
 *              Api.credits.costOf(featureKey) / Api.credits.consume(userId, credits, featureKey, memo)
 *              Api.credits.hasUnlimited(user) / Api.storage.get|set|clearSelection
 *            業務データは localStorage に置かない（保存先は Supabase）。
 * 文言       i18n.js の window.I18N.t(key) だけを使う。辞書に無いキーは作らない。
 * DOM        index.html が用意した id だけを触る。
 *              #app-header 内の #header-title / #header-back / #header-action
 *              #banner-root / #toast-root / #modal-root / #tab-admin
 * class      styles.css に実在する綴りだけを使う。
 *              screen / screen__head / screen__title / screen__lead / section /
 *              section__head / section__title / stack / row--2 / stat-grid /
 *              card / card--gradient / card--soft / card__label / card__value /
 *              card__unit / card__sub / card__foot / search / search__input /
 *              list / list-row / list-row__body / list-row__title / list-row__sub /
 *              list-row__thumb / list-row__action / field / field__label /
 *              field__hint / field__error / field__req / input / textarea /
 *              counter / chips / chip / chip--selected / thumb-grid / thumb /
 *              thumb__img / thumb__remove / thumb-add / file-input / btn /
 *              btn--primary / btn--secondary / btn--text / btn--block / fab /
 *              empty / empty__text / skeleton / loading-text / banner /
 *              banner__text / banner__retry / toast / toast__text / modal /
 *              modal__title / modal__body / modal__actions / warn-box /
 *              t-note / clamp-1 / clamp-2 / tap
 *
 * 無い関数は黙って飛ばさない。何が無いのかを console.error に必ず残す。
 * ============================================================ */

(function (window, document) {
  'use strict';

  var App = window.App = window.App || {};

  /* ---------- 依存の確認 ---------- */
  if (typeof App.registerScreen !== 'function') {
    console.error('[screens-home] App.registerScreen が見つかりません。index.html の読み込み順（app.js -> screens-home.js）を確認してください。登録内容は window.App.screens に控えます。');
    App.screens = App.screens || {};
    App.registerScreen = function (id, spec) {
      if (!spec || typeof spec.render !== 'function') {
        console.error('[screens-home] registerScreen の第2引数は { render: 関数 } である必要があります。画面ID: ' + id);
        return;
      }
      App.screens[id] = spec;
    };
  }
  if (!window.Api) {
    console.error('[screens-home] window.Api が見つかりません。api.js が読み込まれているか確認してください。ダッシュボードとプロジェクト作成は動きません。');
  }
  if (!window.I18N || typeof window.I18N.t !== 'function') {
    console.error('[screens-home] window.I18N.t が見つかりません。i18n.js が読み込まれているか確認してください。翻訳キーをそのまま表示します。');
  }

  /* ---------- 定数 ---------- */
  var MAX_IMAGES = 15;
  var MAX_BRAND_COLORS = 5;
  var DEFAULT_SWATCH = '#A855F7';
  var TARGET_LABELS = ['A', 'B', 'C', 'D', 'E'];
  var FONT_SLOTS = [
    { key: 'title', label: 'product.fontTitle' },
    { key: 'subtitle', label: 'product.fontSubtitle' },
    { key: 'body', label: 'product.fontBody' },
    { key: 'emphasis', label: 'product.fontEmphasis' }
  ];
  var CATEGORY_KEYS = ['tech', 'appliance', 'food', 'fashion', 'bag', 'beauty', 'interior',
    'outdoor', 'vehicle', 'baby', 'pet', 'craft', 'other'];
  var FONT_OPTIONS = ['gothic', 'mincho', 'maru', 'gothicBold', 'serifEn', 'sansEn'];
  /* 外部CDNを使わない方針なので、端末に載っている書体だけで組む */
  var FONT_STACKS = {
    gothic: "'Hiragino Sans', 'Yu Gothic', Meiryo, system-ui, sans-serif",
    mincho: "'Hiragino Mincho ProN', 'Yu Mincho', 'YuMincho', serif",
    maru: "'Hiragino Maru Gothic ProN', 'Yu Gothic', system-ui, sans-serif",
    gothicBold: "'Hiragino Sans', 'Yu Gothic', Meiryo, system-ui, sans-serif",
    serifEn: "Georgia, 'Times New Roman', serif",
    sansEn: "Helvetica, Arial, system-ui, sans-serif"
  };
  /* 表示順は「新商品として出やすい順」。値は辞書キーの末尾（tech / food ...）を保存する。
     翻訳文そのものを保存すると、言語を切り替えたときに保存済みの値と一致しなくなる。 */
  /* LPを出す言語。画面の表示言語（i18n）とは別物なので、ここに持つ。
     並びは値そのものを見せる（日本語の画面で韓国語のLPを作ることがあり、
     訳した名前だと「どの言語で出るのか」が分からなくなる） */
  var OUTPUT_LANGS = [
    { value: 'ja', label: '日本語' },
    { value: 'en', label: 'English' },
    { value: 'ko', label: '한국어' }
  ];

  var CATEGORIES = [
    'category.tech', 'category.appliance', 'category.food', 'category.fashion',
    'category.bag', 'category.beauty', 'category.interior', 'category.outdoor',
    'category.vehicle', 'category.baby', 'category.pet', 'category.craft', 'category.other'
  ];
  var MAX_NAME = 30;
  var MAX_FEATURES = 300;
  var IMAGE_MAX_EDGE = 1024;       // ponytail: 画像はデータURLのまま projects.image_urls に入れるので長辺1024pxへ縮小する。専用ストレージを使うならここを差し替える。
  var IMAGE_QUALITY = 0.72;

  /* ---------- 小さな道具 ---------- */

  /* 参照ページは、そのプラットフォームの主言語のページで読む。
     自動翻訳された版だと商品名も訴求も原文から崩れるため。
     戻り値の lang は解析側（Edge Function / ローカル処理）が Accept-Language に使う。 */
  var PLATFORM_LOCALES = [
    { match: /(^|\.)wadiz\.kr$/, lang: 'ko', strip: /^\/(ja|en|zh[-\w]*)(?=\/)/ },
    { match: /(^|\.)tumblbug\.com$/, lang: 'ko', strip: /^\/(ja|en)(?=\/)/ },
    { match: /(^|\.)alibaba\.com$/, lang: 'en' },
    { match: /(^|\.)aliexpress\.com$/, lang: 'en' },
    { match: /(^|\.)1688\.com$/, lang: 'zh-CN' },
    { match: /(^|\.)jd\.com$/, lang: 'zh-CN' },
    { match: /(^|\.)tmall\.com$/, lang: 'zh-CN' },
    { match: /(^|\.)taobao\.com$/, lang: 'zh-CN' },
    { match: /(^|\.)zeczec\.com$/, lang: 'zh-TW' },
    { match: /(^|\.)kickstarter\.com$/, lang: 'en', strip: /^\/(ja|de|es|fr|it|nl)(?=\/)/ },
    { match: /(^|\.)indiegogo\.com$/, lang: 'en' },
    { match: /(^|\.)makuake\.com$/, lang: 'ja' },
    { match: /(^|\.)camp-fire\.jp$/, lang: 'ja' },
    { match: /(^|\.)greenfunding\.jp$/, lang: 'ja' },
    { match: /(^|\.)machi-ya\.jp$/, lang: 'ja' },
    { match: /(^|\.)amazon\.co\.jp$/, lang: 'ja' },
    { match: /(^|\.)rakuten\.co\.jp$/, lang: 'ja' }
  ];

  function localeOfUrl(raw) {
    var text = String(raw || '').trim();
    if (!text) { return null; }
    var host = '';
    var path = '';
    try {
      var parsed = new window.URL(text);
      host = parsed.hostname.toLowerCase();
      path = parsed.pathname;
    } catch (e) {
      return { url: text, lang: '' };
    }
    var i;
    for (i = 0; i < PLATFORM_LOCALES.length; i += 1) {
      var rule = PLATFORM_LOCALES[i];
      if (!rule.match.test(host)) { continue; }
      var out = text;
      if (rule.strip && rule.strip.test(path)) {
        out = text.replace(path, path.replace(rule.strip, ''));
      }
      return { url: out, lang: rule.lang };
    }
    return { url: text, lang: '' };
  }

  function t(key, params) {
    if (window.I18N && typeof window.I18N.t === 'function') { return window.I18N.t(key, params); }
    return key;
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

  function monthStartString() {
    var now = new Date();
    return now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-01';
  }

  function isDigits(text) {
    if (!text.length) { return false; }
    var i;
    for (i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (c < '0' || c > '9') { return false; }
    }
    return true;
  }

  function digitsOf(text) {
    var raw = String(text === undefined || text === null ? '' : text);
    return raw.split(',').join('').split(' ').join('').split('　').join('');
  }

  function errorMessage(err, fallbackKey) {
    if (err && err.message) { return String(err.message); }
    return t(fallbackKey || 'common.networkError');
  }

  function apiReady() {
    if (window.Api && window.Api.users && window.Api.projects && window.Api.credits) { return true; }
    console.error('[screens-home] window.Api の中身（users / projects / points）が揃っていません。api.js を確認してください。');
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
    else { console.error('[screens-home] index.html に #header-title がありません。'); }
    if (backNode) { backNode.hidden = !showBack; }
    else { console.error('[screens-home] index.html に #header-back がありません。'); }
    if (actionNode) { clear(actionNode); }
  }


  /* app.js のモーダルを閉じる。無い環境でも落ちないようにしておく */
  function dismissModal() {
    if (window.App && typeof window.App.closeModal === 'function') { window.App.closeModal(); return; }
    var host = document.getElementById('modal-root');
    if (host) { host.hidden = true; }
  }

  function toast(message, kind) {
    if (typeof App.toast === 'function') { App.toast(message, kind); return; }
    var root = document.getElementById('toast-root');
    if (!root) {
      console.error('[screens-home] #toast-root が無いため通知を表示できません: ' + message);
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

  function showBanner(message, onRetry) {
    var root = document.getElementById('banner-root');
    if (!root) {
      console.error('[screens-home] #banner-root が無いため通信失敗を表示できません: ' + message);
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

  function clearBanner() {
    var root = document.getElementById('banner-root');
    if (root) { clear(root); }
  }

  function confirmModal(options) {
    var root = document.getElementById('modal-root');
    var onConfirm = options.onConfirm;
    if (!root) {
      console.error('[screens-home] #modal-root がありません。window.confirm で代用します。');
      if (window.confirm(options.title)) { onConfirm(); }
      return;
    }

    function close() {
      clear(root);
      root.hidden = true;
      root.onclick = null;
    }

    clear(root);
    root.hidden = false;
    root.onclick = function (event) {
      if (event.target === root) { close(); }
    };

    var modal = el('div', 'modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.appendChild(el('h2', 'modal__title', options.title));
    if (options.body) { modal.appendChild(el('p', 'modal__body', options.body)); }

    var actions = el('div', 'modal__actions');
    actions.appendChild(button('btn btn--secondary', t('common.cancel'), close));
    actions.appendChild(button('btn btn--primary', options.confirmLabel || t('common.ok'), function () {
      close();
      onConfirm();
    }));
    modal.appendChild(actions);
    root.appendChild(modal);
  }

  function showSkeleton(root) {
    clear(root);
    var wrap = el('div', 'screen');
    var shapes = ['skeleton skeleton--title', 'skeleton skeleton--card', 'skeleton skeleton--row', 'skeleton skeleton--row'];
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
    var empty = el('div', 'empty');
    empty.appendChild(el('p', 'empty__text', message));
    empty.appendChild(button('btn btn--primary', t('common.retry'), function () {
      clearBanner();
      onRetry();
    }));
    wrap.appendChild(empty);
    root.appendChild(wrap);
  }

  /* ---------- 現在のユーザー（管理者フラグ・残高） ---------- */
  function currentUserId() {
    if (App.state && App.state.user && App.state.user.id) { return String(App.state.user.id); }
    if (window.Api && window.Api.storage) { return window.Api.storage.get('userId'); }
    console.error('[screens-home] 現在のユーザーIDを取得できません（App.state.user も Api.storage も使えません）。');
    return null;
  }

  function syncUser(user) {
    if (App.state && typeof App.state === 'object') {
      App.state.user = user;
      App.state.creditBalance = Number(user.credit_balance) || 0;
    } else {
      App.state = { user: user, creditBalance: Number(user.credit_balance) || 0 };
    }
    if (window.Api && window.Api.storage) { window.Api.storage.set('userId', user.id); }
    var adminTab = document.getElementById('tab-admin');
    if (adminTab) { adminTab.hidden = !user.is_admin; }
  }

  function selectProject(project) {
    if (!project) { return; }
    if (App.state && typeof App.state === 'object') { App.state.projectId = String(project.id); }
    if (window.Api && window.Api.storage) { window.Api.storage.set('projectId', project.id); }
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
    console.error('[screens-home] Api.points.hasUnlimited がありません。無制限利用権は無いものとして扱います。');
    return false;
  }

  /* ============================================================
   * S3 ダッシュボード
   * 残高カード / 管理ボタン（管理者のみ） / 検索 / 進行中件数 /
   * 今月の消費 / プロジェクト一覧（行タップで詳細・…で操作メニュー） /
   * ＋ボタン / ログアウト
   * ============================================================ */
  function renderDashboard(root, params) {
    mounted = { id: 'S3', root: root, params: params };
    setHeader(t('common.appName'), false);

    var view = { search: '', onlyInProgress: false };

    function load() {
      clearBanner();
      showSkeleton(root);

      var data = {};
      loadUser().then(function (user) {
        data.user = user;
        return window.Api.projects.list({
          eq: { users_id: String(user.id) },
          order: 'created_at.desc'
        });
      }).then(function (projects) {
        data.projects = projects || [];
        var ids = data.projects.map(function (project) { return String(project.id); });

        var monthly = window.Api.creditTransactions.list({
          eq: { users_id: String(data.user.id), transaction_type: 'consume' },
          filters: { created_at: 'gte.' + monthStartString() },
          limit: 500
        });
        /* 「進行中」は分析まで進んだかで決める。生成の機能は作り直し中 */
        var reports = ids.length
          ? window.Api.analysisReports.list({ in: { projects_id: ids }, select: 'projects_id', limit: 1000 })
          : Promise.resolve([]);

        return Promise.all([monthly, reports]);
      }).then(function (results) {
        var transactions = results[0] || [];
        var reports = results[1] || [];
        var used = 0;
        transactions.forEach(function (tx) {
          used += Math.abs(Number(tx.credit_amount) || 0);
        });
        data.monthlyUsed = used;
        data.analyzedIds = {};
        reports.forEach(function (row) {
          if (row && row.projects_id) { data.analyzedIds[String(row.projects_id)] = true; }
        });
        paint(data);
      }).catch(function (err) {
        if (err && err.code === 'noUser') {
          console.error('[screens-home] ログイン中のユーザーがいないため S1 ログインへ戻します。');
          go('S1');
          return;
        }
        console.error('[screens-home] ダッシュボードの読み込みに失敗しました', err);
        showErrorScreen(root, errorMessage(err, 'dashboard.loadFailed'), load);
      });
    }

    function isInProgress(data, project) {
      return !data.analyzedIds[String(project.id)];
    }

    function matches(project, keyword) {
      if (!keyword) { return true; }
      var needle = keyword.toLowerCase();
      var fields = [project.project_name, project.product_name, project.target_audience, project.product_features];
      var i;
      for (i = 0; i < fields.length; i++) {
        var value = fields[i];
        if (value && String(value).toLowerCase().indexOf(needle) !== -1) { return true; }
      }
      return false;
    }

    function paint(data) {
      clearBanner();
      clear(root);

      var screen = el('div', 'screen');

      /* 見出し */
      var head = el('header', 'screen__head');
      head.appendChild(el('h2', 'screen__title', t('dashboard.title')));
      if (data.user.display_name) {
        head.appendChild(el('p', 'screen__lead', data.user.display_name));
      }
      screen.appendChild(head);

      /* クレジット残高カード（タップで S17 クレジットへ） */
      var balance = Number(data.user.credit_balance) || 0;
      var balanceCard = el('button', 'card card--gradient');
      balanceCard.type = 'button';
      balanceCard.appendChild(el('span', 'card__label', t('dashboard.creditBalance')));
      var balanceValue = el('span');
      balanceValue.appendChild(el('span', 'card__value', formatNumber(balance)));
      balanceValue.appendChild(el('span', 'card__unit', t('common.creditUnit')));
      balanceCard.appendChild(balanceValue);
      if (hasUnlimited(data.user)) {
        balanceCard.appendChild(el('span', 'card__sub', t('credit.expiry') + ' ' + formatDate(data.user.unlimited_until)));
      }
      balanceCard.addEventListener('click', function () { go('S17'); });
      screen.appendChild(balanceCard);

      /* 管理ボタン（管理者のみ） */
      if (data.user.is_admin) {
        screen.appendChild(button('btn btn--secondary btn--block', t('dashboard.adminMenu'), function () {
          go('S18');
        }));
      }

      /* プロジェクト検索 */
      var searchWrap = el('div', 'search');
      var searchInput = el('input', 'search__input');
      searchInput.type = 'search';
      searchInput.id = 'home-search';
      searchInput.value = view.search;
      searchInput.setAttribute('placeholder', t('dashboard.searchPlaceholder'));
      searchInput.setAttribute('aria-label', t('dashboard.searchPlaceholder'));
      searchInput.addEventListener('input', function () {
        view.search = searchInput.value;
        paintList();
      });
      searchWrap.appendChild(searchInput);
      screen.appendChild(searchWrap);

      /* 進行中件数 / 今月の消費 */
      var inProgressCount = 0;
      data.projects.forEach(function (project) {
        if (isInProgress(data, project)) { inProgressCount++; }
      });

      var stats = el('div', 'stat-grid');

      var progressCard = el('button', view.onlyInProgress ? 'card card--soft' : 'card');
      progressCard.type = 'button';
      progressCard.setAttribute('aria-pressed', view.onlyInProgress ? 'true' : 'false');
      progressCard.appendChild(el('span', 'card__label', t('dashboard.inProgress')));
      var progressValue = el('span');
      progressValue.appendChild(el('span', 'card__value', formatNumber(inProgressCount)));
      progressValue.appendChild(el('span', 'card__unit', t('dashboard.countUnit')));
      progressCard.appendChild(progressValue);
      progressCard.addEventListener('click', function () {
        view.onlyInProgress = !view.onlyInProgress;
        paint(data);
      });
      stats.appendChild(progressCard);

      var usageCard = el('button', 'card');
      usageCard.type = 'button';
      usageCard.appendChild(el('span', 'card__label', t('dashboard.monthlyUsage')));
      var usageValue = el('span');
      usageValue.appendChild(el('span', 'card__value', formatNumber(data.monthlyUsed)));
      usageValue.appendChild(el('span', 'card__unit', t('common.creditShort')));
      usageCard.appendChild(usageValue);
      usageCard.addEventListener('click', function () { go('S17'); });
      stats.appendChild(usageCard);

      screen.appendChild(stats);

      /* プロジェクト一覧 */
      var section = el('section', 'section');
      var sectionHead = el('div', 'section__head');
      sectionHead.appendChild(el('h3', 'section__title', t('dashboard.projectList')));
      var countLabel = el('span', 't-note', '');
      sectionHead.appendChild(countLabel);
      section.appendChild(sectionHead);

      var listHost = el('div');
      section.appendChild(listHost);
      screen.appendChild(section);

      function projectRow(project) {
        var row = el('div', 'list-row');

        var images = Array.isArray(project.image_urls) ? project.image_urls : [];
        if (images.length && typeof images[0] === 'string' && images[0]) {
          var thumb = el('img', 'list-row__thumb');
          thumb.src = images[0];
          thumb.alt = '';
          thumb.setAttribute('loading', 'lazy');
          row.appendChild(thumb);
        }

        var open = el('button', 'list-row__body');
        open.type = 'button';
        open.appendChild(el('span', 'list-row__title clamp-2', project.project_name || t('common.empty')));

        var subParts = [];
        if (project.product_name && project.product_name !== project.project_name) {
          subParts.push(String(project.product_name));
        }
        if (project.price !== null && project.price !== undefined && project.price !== '') {
          subParts.push(formatYen(project.price));
        }
        if (project.created_at) { subParts.push(formatDate(project.created_at)); }
        if (isInProgress(data, project)) { subParts.push(t('dashboard.inProgress')); }
        open.appendChild(el('span', 'list-row__sub clamp-1', subParts.join(' · ')));

        open.addEventListener('click', function () {
          selectProject(project);
          go('S8', { id: project.id });
        });
        row.appendChild(open);

        var menu = el('button', 'list-row__action', '…');
        menu.type = 'button';
        menu.setAttribute('aria-label', t('dashboard.projectMenu'));
        menu.addEventListener('click', function () {
          selectProject(project);
          go('S5', { id: project.id });
        });
        row.appendChild(menu);

        return row;
      }

      function paintList() {
        clear(listHost);

        var rows = data.projects.filter(function (project) {
          if (view.onlyInProgress && !isInProgress(data, project)) { return false; }
          return matches(project, view.search.trim());
        });

        countLabel.textContent = formatNumber(rows.length) + t('dashboard.countUnit');

        if (!rows.length) {
          var empty = el('div', 'empty');
          empty.appendChild(el('p', 'empty__text', data.projects.length ? t('common.empty') : t('dashboard.emptyProjects')));
          empty.appendChild(button('btn btn--primary', t('dashboard.createFirstProject'), function () { go('S4'); }));
          listHost.appendChild(empty);
          return;
        }

        var list = el('div', 'list');
        rows.forEach(function (project) { list.appendChild(projectRow(project)); });
        listHost.appendChild(list);
      }

      paintList();

      /* ログアウト（S1 ログインへ戻る） */
      screen.appendChild(button('btn btn--text btn--block', t('dashboard.logout'), function () {
        confirmModal({
          title: t('auth.logoutConfirmTitle'),
          confirmLabel: t('dashboard.logout'),
          onConfirm: function () {
            if (window.Api && window.Api.storage) { window.Api.storage.clearSelection(); }
            if (App.state && typeof App.state === 'object') {
              App.state.user = null;
              App.state.creditBalance = 0;
              App.state.projectId = null;
            }
            var adminTab = document.getElementById('tab-admin');
            if (adminTab) { adminTab.hidden = true; }
            go('S1');
          }
        });
      }));

      /* ＋ボタン（新規プロジェクト作成） */
      var fab = el('button', 'fab', '＋');
      fab.type = 'button';
      fab.setAttribute('aria-label', t('dashboard.newProject'));
      fab.addEventListener('click', function () { go('S4'); });
      screen.appendChild(fab);

      root.appendChild(screen);
    }

    load();
  }

  /* ============================================================
   * S4 プロジェクト作成
   * プロジェクト名 / 商品の特徴 / 価格 / ターゲット / 商品画像 と
   * 10クレジット消費つきの作成処理
   * ============================================================ */
  function renderCreate(root, params) {
    mounted = { id: 'S4', root: root, params: params };
    /* 前回の進行状況ウィンドウが body に残っていたら片づける */
    if (window.App && typeof window.App.stopJobWatch === 'function') { window.App.stopJobWatch(); }
    var stale = document.querySelectorAll('.jobwatch, .viewer');
    var si;
    for (si = 0; si < stale.length; si += 1) { stale[si].parentNode.removeChild(stale[si]); }
    setHeader(t('project.createTitle'), true);

    var form = { name: '', features: '', price: '', target: '', images: [], productShots: [], rewards: [],
      category: '', outputLang: 'ja', fundingGoal: '', valueProp: '', brandTone: '',
      refUrls: [''], brandColors: [], brandFonts: {}, targets: [], videos: [],
      /* 自動入力が出す配色案（5案）。フォントと同じく、ここから選ぶ。
         選んだものが brandColors に入る。案そのものは保存しない
         （選び終えたら要らない。読み直したときは brandColors だけが残る） */
      brandPalettes: [],
      /* 参照ページの組み立て方。自動入力がワーカー側でプロジェクトへ直接書く。
         ここは読んで表示するためだけに持つ（画面からは編集しない） */
      referenceStructure: null };
    var user = null;
    var targetCandidates = [];
    var touched = false;
    var busy = false;
    var projectId = null;   // 名前を付けて作成済みなら、その行のID
    var dirty = false;      // 未保存の変更があるか
    var saveButton = null;
    var dirtyMark = null;

    /* 描き直しのたびに入れ替える部品の控え */
    var nameError = null;
    var priceError = null;
    var submitButton = null;
    var imagesHost = null;
    var productShotNote = null;
    var registerRow = null;
    var registerBtn = null;
    var rewardsHost = null;
    var rewardsEmpty = null;
    var discountNodes = [];
    var rewardIndex = 0;
    var rewardAnim = 0;   // 1=次へ -1=前へ。滑り込む向き
    var refHost = null;
    var refStructureHost = null;
    var refRunButton = null;
    var colorsHost = null;
    var palettesHost = null;
    var brandColorAdd = null;
    var targetsHost = null;
    var targetsEmpty = null;
    var targetAddButton = null;
    var targetProposeButton = null;
    var targetOpen = -1;
    var aiTargetOrder = null;   // AIが出したときの並び（順位を戻す用）
    var targetResetButton = null;
    var dragFrom = -1;    // 掴んでいるカードの位置   // 詳細を開いているカード。-1 はすべて畳んだ状態
    var targetCountNode = null;
    var analyzing = false;
    var dropzone = null;
    var videosHost = null;

    function load() {
      clearBanner();
      showSkeleton(root);

      var wanted = params && params.id ? String(params.id) : '';
      loadUser().then(function (loaded) {
        user = loaded;
        return Promise.all([
          window.Api.projects.list({
            eq: { users_id: String(loaded.id) },
            select: 'target_audience',
            limit: 50
          }),
          wanted ? window.Api.projects.get(wanted) : Promise.resolve(null)
        ]);
      }).then(function (results) {
        targetCandidates = uniqueTargets(results[0] || []);
        if (results[1]) {
          projectId = String(results[1].id);
          fillFormFrom(results[1]);
          selectProject(results[1]);
        }
        paint();
        /* まだ作られていないなら、まず名前だけ決めてもらう */
        if (!projectId) { askProjectName(); }
      }).catch(function (err) {
        if (err && err.code === 'noUser') {
          console.error('[screens-home] ログイン中のユーザーがいないため S1 ログインへ戻します。');
          go('S1');
          return;
        }
        console.error('[screens-home] プロジェクト作成画面の読み込みに失敗しました', err);
        showErrorScreen(root, errorMessage(err, 'project.createFailed'), load);
      });
    }


    /* 保存済みの行をフォームに戻す。列が無い/空でも落ちないように素直に読む */
    function fillFormFrom(row) {
      function text(value) { return value === null || value === undefined ? '' : String(value); }
      function list(value) { return isArray(value) ? value : []; }
      form.name = text(row.project_name || row.name);
      form.referenceStructure = (row.reference_structure
        && isArray(row.reference_structure.sections)
        && row.reference_structure.sections.length) ? row.reference_structure : null;
      form.category = text(row.category);
      form.outputLang = text(row.output_lang) || 'ja';
      form.price = row.price === null || row.price === undefined ? '' : formatNumber(row.price);
      form.fundingGoal = text(row.funding_goal);
      form.valueProp = text(row.value_prop);
      form.features = text(row.product_features);
      form.target = text(row.target_audience);
      form.brandTone = text(row.brand_tone);
      form.images = list(row.image_urls).map(String);
      form.productShots = list(row.product_shot_urls).map(String);
      lastShots = JSON.stringify(form.productShots.slice().sort());
      form.videos = list(row.video_urls).map(String);
      form.brandColors = list(row.brand_colors).map(String);
      form.brandFonts = row.brand_fonts && typeof row.brand_fonts === 'object' ? row.brand_fonts : {};
      form.targets = list(row.targets).map(function (target, index) {
        return {
          label: TARGET_LABELS[index] || String(index + 1),
          name: text(target && target.name),
          age: text(target && target.age),
          gender: text(target && target.gender),
          rationale: text(target && target.rationale),
          persona: text(target && target.persona),
          description: text(target && target.description)
        };
      });
      form.rewards = list(row.rewards).map(function (reward) {
        return {
          name: text(reward && reward.name),
          listPrice: reward && reward.list_price !== null && reward.list_price !== undefined ? formatNumber(reward.list_price) : '',
          price: reward && reward.price !== null && reward.price !== undefined ? formatNumber(reward.price) : '',
          qty: reward && reward.quantity !== null && reward.quantity !== undefined ? String(reward.quantity) : '',
          desc: text(reward && reward.description)
        };
      });
      var refs = list(row.reference_urls).map(String);
      form.refUrls = refs.length ? refs : [''];
      dirty = false;
    }

    function uniqueTargets(rows) {
      var seen = {};
      var out = [];
      rows.forEach(function (row) {
        var value = row && row.target_audience ? String(row.target_audience).trim() : '';
        if (!value || seen[value]) { return; }
        seen[value] = true;
        out.push(value);
      });
      return out.slice(0, 6);
    }

    function makeField(labelText, control, options) {
      var opts = options || {};
      var wrap = el('div', 'field');
      var label = el('label', 'field__label', labelText);
      if (control.id) { label.setAttribute('for', control.id); }
      if (opts.required) {
        var mark = el('span', 'field__req', '*');
        mark.setAttribute('aria-hidden', 'true');
        label.appendChild(mark);
      }
      wrap.appendChild(label);
      wrap.appendChild(control);
      if (opts.counter) { wrap.appendChild(opts.counter); }
      if (opts.hint) { wrap.appendChild(el('p', 'field__hint', opts.hint)); }
      var error = el('p', 'field__error');
      wrap.appendChild(error);
      return { wrap: wrap, error: error };
    }

    function paint() {
      clearBanner();
      clear(root);

      var screen = el('div', 'screen');

      /* 見出し */
      var head = el('header', 'screen__head');
      head.appendChild(el('h2', 'screen__title', t('project.createTitle')));
      head.appendChild(el('p', 'screen__lead', t('project.createSubtitle')));
      screen.appendChild(head);

      /* --- 入力欄。ttalkkak-ai.com の「① 상품 입력」に合わせ、白パネルで区画する --- */

      function panel(titleKey, descKey) {
        var box = el('section', 'panel');
        var head = el('div', 'panel__head');
        head.appendChild(el('span', 'panel__title', t(titleKey)));
        box.appendChild(head);
        if (descKey) { box.appendChild(el('p', 'panel__desc', t(descKey))); }
        return box;
      }

      function textInput(id, value, placeholder, onInput, options) {
        var opts = options || {};
        var input = el('input', 'input');
        input.id = id;
        input.type = 'text';
        input.value = value;
        input.setAttribute('placeholder', placeholder);
        if (opts.numeric) { input.setAttribute('inputmode', 'numeric'); }
        if (opts.maxLength) { input.maxLength = opts.maxLength; }
        input.addEventListener('input', function () { onInput(input.value, input); });
        return input;
      }

      /* 参考ページからのAI自動入力（手入力も残す） */
      var refPanel = panel('product.refPanel', 'product.refPanelDesc');
      refHost = el('div', 'stack');
      refPanel.appendChild(refHost);
      var refActions = el('div', 'btn-row');
      refActions.appendChild(button('btn btn--secondary', '＋ ' + t('product.refAdd'), function () {
        form.refUrls.push('');
        paintRefUrls();
      }));
      refRunButton = button('btn btn--primary', t('product.refRun'), runAutofill);
      refActions.appendChild(refRunButton);
      refPanel.appendChild(refActions);
      /* 読み取った組み立て方を出す。保存しても見えない場所に置くと、
         入っているのか失敗したのか画面から分からない */
      refStructureHost = el('div');
      refPanel.appendChild(refStructureHost);
      screen.appendChild(refPanel);

      /* 商品写真 */
      var photoPanel = panel('product.photoPanel', 'product.photoPanelDesc');
      photoPanel.appendChild(el('p', 'field__hint', t('s4.productShotHint')));
      photoPanel.appendChild(el('p', 'field__hint', t('s4.productShotCutouts')));
      imagesHost = el('div', 'thumb-grid');
      photoPanel.appendChild(imagesHost);
      productShotNote = el('p', 'field__hint');
      productShotNote.hidden = true;
      photoPanel.appendChild(productShotNote);
      /* ★を付けたら、その場で見本に登録できる。保存→切り抜き→結果まで一息でやる。
         保存ボタンを待つ作りだと、画面が古いまま保存されて見本が増えないことがあった */
      registerRow = el('div', 'lp-toolbar');
      registerBtn = button('btn btn--secondary', t('s4.registerShots'), registerShots);
      registerBtn.title = t('s4.registerShotsHint');
      registerRow.appendChild(registerBtn);
      registerRow.hidden = true;
      photoPanel.appendChild(registerRow);
      photoPanel.appendChild(buildDropzone('home-create-images'));
      videosHost = el('div', 'stack');
      photoPanel.appendChild(videosHost);
      screen.appendChild(photoPanel);

      /* 商品カテゴリ & 基本情報 */
      var basicPanel = panel('product.basicPanel', 'product.basicPanelDesc');
      var basicTop = el('div', 'row--2');

      var categorySelect = el('select', 'select');
      categorySelect.id = 'home-create-category';
      var blank = el('option', null, t('product.categoryPlaceholder'));
      blank.value = '';
      categorySelect.appendChild(blank);
      CATEGORIES.forEach(function (key) {
        var option = el('option', null, t(key));
        option.value = key.slice('category.'.length);
        if (form.category === option.value) { option.selected = true; }
        categorySelect.appendChild(option);
      });
      categorySelect.addEventListener('change', function () { form.category = categorySelect.value; });
      basicTop.appendChild(makeField(t('product.category'), categorySelect, { required: true }).wrap);

      /* LPを出す言語。画面の表示言語とは別（画面は日本語のまま、出すLPは韓国語、
         ということがある）。骨格と日本のクラファンの決まりは言語では変えない */
      var langSelect = el('select', 'input');
      langSelect.id = 'home-create-output-lang';
      OUTPUT_LANGS.forEach(function (one) {
        var option = el('option', null, one.label);
        option.value = one.value;
        if (form.outputLang === one.value) { option.selected = true; }
        langSelect.appendChild(option);
      });
      langSelect.addEventListener('change', function () { form.outputLang = langSelect.value; });
      basicTop.appendChild(makeField(t('product.outputLang'), langSelect,
        { hint: t('product.outputLangHint') }).wrap);

      var nameInput = textInput('home-create-name', form.name, t('product.namePlaceholder'), function (value) {
        form.name = value;
        validate();
      }, { maxLength: MAX_NAME });
      nameInput.addEventListener('blur', function () { touched = true; validate(); });
      var nameField = makeField(t('project.name'), nameInput, { required: true, hint: t('projectRename.hint') });
      nameError = nameField.error;
      basicTop.appendChild(nameField.wrap);
      basicPanel.appendChild(basicTop);

      /* 定価はリワードごとに持たせるので、ここには置かない */
      var fundingInput = textInput('home-create-funding', form.fundingGoal, t('product.fundingGoalPlaceholder'), function (value) {
        form.fundingGoal = value;
      }, {});
      basicPanel.appendChild(makeField(t('product.fundingGoal'), fundingInput, {}).wrap);
      screen.appendChild(basicPanel);

      /* リワード（販売）価格・数量 */
      var rewardPanel = panel('product.rewardPanel', 'product.rewardPanelDesc');
      rewardsEmpty = el('p', 'panel__desc', t('product.rewardEmpty'));
      rewardPanel.appendChild(rewardsEmpty);
      rewardsHost = el('div', 'stack');
      rewardPanel.appendChild(rewardsHost);
      rewardPanel.querySelector('.panel__head').appendChild(
        button('btn btn--secondary btn--sm panel__action', '＋ ' + t('product.rewardAdd'), function () {
          form.rewards.push({ name: '', listPrice: '', price: '', qty: '', desc: '' });
          rewardIndex = form.rewards.length - 1;
          rewardAnim = 1;
          paintRewards();
        }));
      screen.appendChild(rewardPanel);

      /* 訴求メッセージ */
      var messagePanel = panel('product.messagePanel', 'product.messagePanelDesc');

      var valueInput = textInput('home-create-value', form.valueProp, t('product.valuePropPlaceholder'), function (value) {
        form.valueProp = value;
      }, {});
      messagePanel.appendChild(makeField(t('product.valueProp'), valueInput, {}).wrap);

      var featuresInput = el('textarea', 'textarea');
      featuresInput.id = 'home-create-features';
      featuresInput.maxLength = MAX_FEATURES;
      featuresInput.value = form.features;
      featuresInput.setAttribute('placeholder', t('product.featuresPlaceholder'));
      var featuresCounter = el('span', 'counter', form.features.length + ' / ' + MAX_FEATURES + t('common.characters'));
      featuresInput.addEventListener('input', function () {
        form.features = featuresInput.value;
        featuresCounter.textContent = form.features.length + ' / ' + MAX_FEATURES + t('common.characters');
      });
      messagePanel.appendChild(makeField(t('product.featuresLabel'), featuresInput, { counter: featuresCounter }).wrap);

      var toneInput = textInput('home-create-tone', form.brandTone, t('product.brandTonePlaceholder'), function (value) {
        form.brandTone = value;
      }, {});
      messagePanel.appendChild(makeField(t('product.brandTone'), toneInput, {}).wrap);
      screen.appendChild(messagePanel);
      /* ターゲット案 A〜E */
      var targetPanel = panel('product.targetPanel', 'product.targetPanelDesc');
      targetCountNode = el('span', 'panel__count', t('product.targetCount', { n: form.targets.length }));
      targetCountNode.hidden = form.targets.length === 0;
      targetPanel.querySelector('.panel__title').appendChild(targetCountNode);
      targetProposeButton = button('btn btn--primary', t('product.targetPropose'), proposeTargets);
      targetPanel.appendChild(targetProposeButton);
      var priorityRow = el('div', 'row row--between');
      priorityRow.appendChild(el('p', 'field__hint', t('product.targetPriorityNote')));
      targetResetButton = button('btn btn--text btn--sm', t('product.targetResetOrder'), restoreAiOrder);
      priorityRow.appendChild(targetResetButton);
      targetPanel.appendChild(priorityRow);
      targetsEmpty = el('p', 'panel__desc', t('product.targetEmpty'));
      targetPanel.appendChild(targetsEmpty);
      targetsHost = el('div', 'stack');
      targetPanel.appendChild(targetsHost);
      targetAddButton = button('btn btn--secondary', '＋ ' + t('product.targetAdd'), function () {
        if (form.targets.length >= TARGET_LABELS.length) { return; }
        form.targets.push({ label: TARGET_LABELS[form.targets.length], name: '', age: '', gender: '', rationale: '', persona: '', description: '' });
        targetOpen = form.targets.length - 1;
        paintTargets();
      });
      targetPanel.appendChild(targetAddButton);
      screen.appendChild(targetPanel);

      /* ブランド指定（色・フォント） */
      var brandPanel = panel('product.brandPanel', 'product.brandPanelDesc');
      brandPanel.appendChild(el('span', 'field__label', t('product.brandColors')));
      palettesHost = el('div', 'palettes');
      brandPanel.appendChild(palettesHost);
      colorsHost = el('div', 'swatches');
      brandPanel.appendChild(colorsHost);
      brandPanel.appendChild(el('p', 'field__hint', t('product.brandColorsHint')));
      brandColorAdd = button('btn btn--secondary', '＋ ' + t('product.brandColorAdd'), function () {
        if (form.brandColors.length >= MAX_BRAND_COLORS) { return; }
        form.brandColors.push(DEFAULT_SWATCH);
        paintBrandColors();
      });
      brandPanel.appendChild(brandColorAdd);

      brandPanel.appendChild(el('div', 'divider'));
      brandPanel.appendChild(el('span', 'field__label', t('product.brandFonts')));
      var fontGrid = el('div', 'row--2');
      FONT_SLOTS.forEach(function (slot) {
        var select = el('select', 'select');
        select.id = 'home-create-font-' + slot.key;
        var auto = el('option', null, t('product.fontAuto'));
        auto.value = '';
        select.appendChild(auto);
        FONT_OPTIONS.forEach(function (key) {
          var option = el('option', null, t('font.' + key));
          option.value = key;
          option.style.fontFamily = FONT_STACKS[key];
          if (form.brandFonts[slot.key] === key) { option.selected = true; }
          select.appendChild(option);
        });
        select.addEventListener('change', function () {
          form.brandFonts[slot.key] = select.value;
          select.style.fontFamily = select.value ? FONT_STACKS[select.value] : '';
        });
        select.style.fontFamily = form.brandFonts[slot.key] ? FONT_STACKS[form.brandFonts[slot.key]] : '';
        fontGrid.appendChild(makeField(t(slot.label), select, {}).wrap);
      });
      brandPanel.appendChild(fontGrid);
      screen.appendChild(brandPanel);


      /* 保存は「途中保存（更新・無料）」と「完了して詳細へ」の2つ。
         行はすでに作成済みなので、ここでポイントは減らない */
      var footer = el('div', 'form-actions');
      dirtyMark = el('span', 'form-actions__mark', t('project.unsavedMark'));
      dirtyMark.hidden = !dirty;
      footer.appendChild(dirtyMark);
      var footerButtons = el('div', 'form-actions__buttons');
      saveButton = button('btn btn--secondary', t('project.saveDraft'), saveDraft);
      footerButtons.appendChild(saveButton);
      submitButton = button('btn btn--primary', t('project.finish'), submitCreate);
      footerButtons.appendChild(submitButton);
      footer.appendChild(footerButtons);
      screen.appendChild(footer);

      /* どの入力でも未保存の印が立つように、画面ごと拾う */
      screen.addEventListener('input', markDirty);
      screen.addEventListener('change', markDirty);

      root.appendChild(screen);

      paintImages();
      paintRewards();
      paintRefUrls();
      paintRefStructure();
      paintBrandPalettes();
      paintBrandColors();
      paintTargets();
      validate();
    }

    /* --- 参考ページURL --- */
    /* 参照ページから読み取った組み立て方。作るLPの骨格になる。
       競合分析（日本の市場で何が効くか）とは別物なので、
       ここでは「元ページが何をどの順で見せていたか」だけを出す。 */
    function paintRefStructure() {
      if (!refStructureHost) { return; }
      clear(refStructureHost);
      var st = form.referenceStructure;
      if (!st) { return; }
      var sections = isArray(st.sections) ? st.sections : [];
      if (!sections.length) { return; }

      /* たたんでおく。区画が10前後並ぶと商品入力の画面が縦に長くなり、
         その下の商品写真やリターンへ届きにくかった。
         見出しに区画数と要約を出しておき、読みたいときだけ開く。
         開閉は競合分析の fold と同じ <details>（キーボードと読み上げを
         作り直さないため）。開いた状態は覚えない。毎回たたむ */
      var box = el('details', 'fold ref-structure');
      var head = el('summary', 'fold__head');
      var titles = el('div', 'fold__titles');
      titles.appendChild(el('span', 'fold__title', t('product.refStructure')));
      if (st.summary) { titles.appendChild(el('span', 'fold__lead clamp-2', String(st.summary))); }
      head.appendChild(titles);
      head.appendChild(el('span', 'fold__meta', t('product.refStructureCount', { n: sections.length })));
      box.appendChild(head);
      var body = el('div', 'fold__body');

      var list = el('ol', 'ref-structure__list');
      sections.forEach(function (one) {
        var li = el('li', 'ref-structure__item');
        var head = el('div', 'ref-structure__line');
        head.appendChild(el('span', 'ref-structure__name',
          String((one && one.title) || (one && one.key) || '')));
        /* 申し込みへ進ませる区画には印を付ける。骨格を組むとき、
           どこで背中を押していたかが並びの判断材料になる */
        if (one && one.cta) { head.appendChild(el('span', 'chip chip--sm', t('product.refStructureCta'))); }
        /* その区画に置かれていた素材の数。この参照ページは訴求を
           画像に焼き込んでいることが多く、文字と絵の比が骨格の要になる */
        var media = one && one.media;
        if (media) {
          var parts = [];
          if (media.image) { parts.push(t('product.refMediaImage', { n: media.image })); }
          if (media.gif) { parts.push(t('product.refMediaGif', { n: media.gif })); }
          if (media.video) { parts.push(t('product.refMediaVideo', { n: media.video })); }
          if (parts.length) { head.appendChild(el('span', 't-note', parts.join(' / '))); }
        }
        li.appendChild(head);
        /* hook はその区画がいちばん強く出している一言。
           role（読み手に何をさせるか）とは別物なので両方出す */
        if (one && one.hook) {
          li.appendChild(el('span', 'ref-structure__hook', '「' + String(one.hook) + '」'));
        }
        if (one && one.role) { li.appendChild(el('span', 'ref-structure__role', String(one.role))); }
        /* body は「何が置かれていたか」の事実。骨格を組むときここが一番効く
           （例: 説明文のない画像6枚が連続して並ぶ） */
        if (one && one.body) { li.appendChild(el('span', 'ref-structure__body', String(one.body))); }
        /* shots は絵に何が写っていたか（人物・場面・見せ方）。body が言葉の中身、
           shots が絵の中身。骨格を組むとき、どんな絵を用意すべきかの手がかりになる */
        if (one && one.shots) {
          li.appendChild(el('span', 'ref-structure__body ref-structure__shots',
            t('product.refShots') + ' ' + String(one.shots)));
        }
        list.appendChild(li);
      });
      body.appendChild(list);
      box.appendChild(body);
      refStructureHost.appendChild(box);
    }

    function paintRefUrls() {
      if (!refHost) { return; }
      clear(refHost);
      form.refUrls.forEach(function (url, index) {
        var row = el('div', 'row--input-action');
        var input = el('input', 'input');
        input.type = 'url';
        input.value = url;
        input.setAttribute('placeholder', 'https://');
        input.setAttribute('aria-label', t('product.refUrl') + ' ' + (index + 1));
        input.addEventListener('input', function () { form.refUrls[index] = input.value; });
        row.appendChild(input);
        var remove = button('btn btn--text', t('common.delete'), function () {
          form.refUrls.splice(index, 1);
          if (!form.refUrls.length) { form.refUrls.push(''); }
          paintRefUrls();
        });
        row.appendChild(remove);
        refHost.appendChild(row);
      });
    }

    function filledRefUrls() {
      var out = [];
      form.refUrls.forEach(function (url) {
        var text = String(url || '').trim();
        if (text) { out.push(text); }
      });
      return out;
    }

    /* 解析側に渡す形。プラットフォームの主言語のURLに直し、言語も添える */
    function refTargets() {
      var out = [];
      filledRefUrls().forEach(function (url) {
        var info = localeOfUrl(url);
        if (info) { out.push({ url: info.url, lang: info.lang }); }
      });
      return out;
    }

    /* --- 配色案（自動入力が出す5案から選ぶ） --- */
    function paintBrandPalettes() {
      if (!palettesHost) { return; }
      clear(palettesHost);
      if (!form.brandPalettes.length) { return; }
      var current = form.brandColors.map(normalizeHex).join(',');
      palettesHost.appendChild(el('p', 'field__hint palettes__lead', t('product.brandPalettesLead')));
      form.brandPalettes.forEach(function (palette, index) {
        var colors = palette.colors.map(normalizeHex);
        var picked = colors.join(',') === current;
        var card = button('palette' + (picked ? ' palette--picked' : ''), '', function () {
          form.brandColors = colors.slice(0, MAX_BRAND_COLORS);
          paintBrandColors();
          paintBrandPalettes();
        });
        card.setAttribute('aria-pressed', picked ? 'true' : 'false');
        var strip = el('span', 'palette__strip');
        colors.forEach(function (hex) {
          var chip = el('span', 'palette__chip');
          chip.style.background = hex;
          chip.title = hex;
          strip.appendChild(chip);
        });
        card.appendChild(strip);
        var text = el('span', 'palette__text');
        text.appendChild(el('span', 'palette__name',
          String.fromCharCode(65 + index) + '. ' + (palette.name || '')));
        if (palette.note) { text.appendChild(el('span', 'palette__note', palette.note)); }
        card.appendChild(text);
        palettesHost.appendChild(card);
      });
    }

    /* --- ブランドカラー --- */
    function paintBrandColors() {
      if (!colorsHost) { return; }
      clear(colorsHost);
      form.brandColors.forEach(function (value, index) {
        var cell = el('div', 'swatch');
        var picker = el('input', 'swatch__input');
        picker.type = 'color';
        picker.value = normalizeHex(value);
        picker.setAttribute('aria-label', t('product.brandColors') + ' ' + (index + 1));
        var code = el('input', 'swatch__code');
        code.type = 'text';
        code.value = normalizeHex(value);
        code.setAttribute('aria-label', t('product.brandColors') + ' ' + (index + 1));
        picker.addEventListener('input', function () {
          form.brandColors[index] = picker.value;
          code.value = picker.value;
        });
        code.addEventListener('input', function () {
          var hex = normalizeHex(code.value);
          form.brandColors[index] = hex;
          picker.value = hex;
        });
        cell.appendChild(picker);
        cell.appendChild(code);
        var remove = button('swatch__remove', '×', function () {
          form.brandColors.splice(index, 1);
          paintBrandColors();
        });
        remove.setAttribute('aria-label', t('common.delete'));
        cell.appendChild(remove);
        colorsHost.appendChild(cell);
      });
      if (brandColorAdd) {
        brandColorAdd.disabled = form.brandColors.length >= MAX_BRAND_COLORS;
      }
    }

    /* #RRGGBB に寄せる。input[type=color] はこの形しか受け取らない */
    function normalizeHex(value) {
      var text = String(value || '').trim();
      if (text.charAt(0) !== '#') { text = '#' + text; }
      if (/^#[0-9a-fA-F]{3}$/.test(text)) {
        text = '#' + text.charAt(1) + text.charAt(1) + text.charAt(2) + text.charAt(2) + text.charAt(3) + text.charAt(3);
      }
      return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toUpperCase() : DEFAULT_SWATCH;
    }

    /* --- ターゲット案 A〜E --- */
    /* AIが出した順番に戻す。名前や説明の編集は保ったまま、並びだけ入れ替える */
    function restoreAiOrder() {
      if (!aiTargetOrder) { return; }
      var rest = [];
      form.targets.forEach(function (target) {
        if (aiTargetOrder.indexOf(target) === -1) { rest.push(target); }
      });
      var ordered = [];
      aiTargetOrder.forEach(function (target) {
        if (form.targets.indexOf(target) !== -1) { ordered.push(target); }
      });
      form.targets = ordered.concat(rest);
      targetOpen = -1;
      paintTargets();
      markDirty();
      toast(t('product.targetOrderRestored'), 'success');
    }

    /* AIの並びと今の並びが違うときだけ「戻す」を出す */
    function refreshResetButton() {
      if (!targetResetButton) { return; }
      var differs = false;
      if (aiTargetOrder && aiTargetOrder.length === form.targets.length) {
        form.targets.forEach(function (target, index) {
          if (aiTargetOrder[index] !== target) { differs = true; }
        });
      }
      targetResetButton.hidden = !differs;
    }

    function paintTargets() {
      if (!targetsHost) { return; }
      clear(targetsHost);
      if (targetsEmpty) { targetsEmpty.hidden = form.targets.length > 0; }
      if (targetCountNode) {
        targetCountNode.textContent = t('product.targetCount', { n: form.targets.length });
        targetCountNode.hidden = form.targets.length === 0;
      }

      form.targets.forEach(function (target, index) {
        target.label = TARGET_LABELS[index] || String(index + 1);
        var card = el('article', 'target-card');

        /* 見出し行：A〜E の札 ＋ 何番目の案か ＋ 削除 */
        var open = targetOpen === index;
        if (open) { card.className += ' is-open'; }

        /* 畳んだ状態でも「誰か」が分かるよう、名前と年代だけは出す */
        var head = el('div', 'target-card__head');
        head.setAttribute('role', 'button');
        head.setAttribute('tabindex', '0');
        head.setAttribute('aria-expanded', open ? 'true' : 'false');
        head.setAttribute('aria-label', t(open ? 'product.targetClose' : 'product.targetOpen'));
        head.appendChild(el('span', 'target-card__grip', '⋮⋮'));
        head.appendChild(el('span', 'target-badge', target.label));
        var summary = el('span', 'target-card__summary');
        summary.appendChild(el('span', 'target-card__name',
          String(target.name || '').trim() || t('product.targetUnnamed')));
        var age = String(target.age || '').trim();
        if (age) { summary.appendChild(el('span', 'target-card__age', age)); }
        head.appendChild(summary);
        if (index === 0) { head.appendChild(el('span', 'target-card__top', t('product.targetTop'))); }

        var remove = button('target-card__remove', '', function () {
          form.targets.splice(index, 1);
          if (targetOpen === index) { targetOpen = -1; }
          paintTargets();
          markDirty();
        });
        remove.appendChild(svgIcon('M6 6l12 12M18 6L6 18'));
        remove.setAttribute('aria-label', t('common.delete'));
        head.appendChild(remove);

        var caret = el('span', 'target-card__caret');
        caret.appendChild(svgIcon('M6 9l6 6 6-6'));
        head.appendChild(caret);

        /* 掴んで上下に動かすと優先順位が変わる */
        head.draggable = true;
        head.addEventListener('dragstart', function (event) {
          dragFrom = index;
          card.className += ' is-dragging';
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            /* Firefox は何か入れないとドラッグが始まらない */
            event.dataTransfer.setData('text/plain', String(index));
          }
        });
        head.addEventListener('dragend', function () {
          dragFrom = -1;
          clearDropMarks();
          card.className = card.className.replace(' is-dragging', '');
        });
        head.addEventListener('dragover', function (event) {
          if (dragFrom === -1 || dragFrom === index) { return; }
          event.preventDefault();
          if (event.dataTransfer) { event.dataTransfer.dropEffect = 'move'; }
          clearDropMarks();
          card.className += dragFrom > index ? ' is-drop-before' : ' is-drop-after';
        });
        head.addEventListener('drop', function (event) {
          event.preventDefault();
          if (dragFrom === -1 || dragFrom === index) { return; }
          var moved = form.targets.splice(dragFrom, 1)[0];
          form.targets.splice(index, 0, moved);
          if (targetOpen === dragFrom) { targetOpen = index; }
          else if (targetOpen === index) { targetOpen = dragFrom; }
          dragFrom = -1;
          paintTargets();
          markDirty();
        });

        /* 削除の押下では開閉しない */
        head.addEventListener('click', function (event) {
          if (event.target.closest('button')) { return; }
          targetOpen = open ? -1 : index;
          paintTargets();
        });
        head.addEventListener('keydown', function (event) {
          if (event.key !== 'Enter' && event.key !== ' ') { return; }
          event.preventDefault();
          targetOpen = open ? -1 : index;
          paintTargets();
        });
        card.appendChild(head);

        if (!open) { targetsHost.appendChild(card); return; }

        var body = el('div', 'target-card__body');

        /* 誰か（名前） */
        var nameField = el('div', 'field');
        nameField.appendChild(el('span', 'field__label', t('product.targetName')));
        var name = el('input', 'input');
        name.type = 'text';
        name.value = target.name || '';
        name.setAttribute('placeholder', t('product.targetNamePlaceholder'));
        name.addEventListener('input', function () { target.name = name.value; });
        nameField.appendChild(name);
        body.appendChild(nameField);

        /* 年代・性別は入力後もラベルが残るよう、見出し付きで置く */
        var who = el('div', 'target-card__who');
        [
          { key: 'age', label: 'product.targetAge', ph: 'product.targetAgePlaceholder' },
          { key: 'gender', label: 'product.targetGender', ph: 'product.targetGenderPlaceholder' }
        ].forEach(function (slot) {
          var field = el('div', 'field');
          field.appendChild(el('span', 'field__label', t(slot.label)));
          var input = el('input', 'input');
          input.type = 'text';
          input.value = target[slot.key] || '';
          input.setAttribute('placeholder', t(slot.ph));
          input.addEventListener('input', function () { target[slot.key] = input.value; });
          field.appendChild(input);
          who.appendChild(field);
        });
        body.appendChild(who);

        /* なぜこの層を選んだのか（AIが埋める。手入力なら空欄のままでよい） */
        var rationaleField = el('div', 'field');
        var rationaleLabel = el('span', 'field__label', t('product.targetRationale'));
        rationaleLabel.appendChild(el('span', 'field__ai', 'AI'));
        rationaleField.appendChild(rationaleLabel);
        var rationale = el('textarea', 'textarea textarea--ai');
        rationale.value = target.rationale || '';
        rationale.setAttribute('placeholder', t('product.targetRationalePlaceholder'));
        rationale.addEventListener('input', function () { target.rationale = rationale.value; });
        rationaleField.appendChild(rationale);
        body.appendChild(rationaleField);

        /* どんな人物か（ペルソナ） */
        var personaField = el('div', 'field');
        personaField.appendChild(el('span', 'field__label', t('product.targetPersona')));
        var persona = el('textarea', 'textarea');
        persona.value = target.persona || '';
        persona.setAttribute('placeholder', t('product.targetPersonaPlaceholder'));
        persona.addEventListener('input', function () { target.persona = persona.value; });
        personaField.appendChild(persona);
        body.appendChild(personaField);

        /* なぜ刺さるか */
        var descField = el('div', 'field');
        descField.appendChild(el('span', 'field__label', t('product.targetDescLabel')));
        var desc = el('textarea', 'textarea');
        desc.value = target.description || '';
        desc.setAttribute('placeholder', t('product.targetDesc'));
        desc.addEventListener('input', function () { target.description = desc.value; });
        descField.appendChild(desc);
        body.appendChild(descField);

        card.appendChild(body);
        targetsHost.appendChild(card);
      });

      if (targetAddButton) {
        targetAddButton.disabled = form.targets.length >= TARGET_LABELS.length;
      }
      refreshResetButton();
    }

    /* --- 収集した写真・動画の拡大表示 -------------------------------
     * サムネイルを押すと大きく出す。左右で送り、背景・× ・Esc で閉じる。
     * ---------------------------------------------------------------- */
    var viewer = null;   // { items, index, root, onKey }

    function mediaList() {
      var list = [];
      form.images.forEach(function (url) { list.push({ type: 'image', url: url }); });
      form.videos.forEach(function (url) { list.push({ type: 'video', url: url }); });
      return list;
    }


    /* 丸ボタンの中身。文字だと書体ごとに重心がずれるので図形で描く */
    function iconButton(className, path, labelKey, onClick) {
      var node = button(className, '', onClick);
      node.appendChild(svgIcon(path));
      node.setAttribute('aria-label', t(labelKey));
      return node;
    }

    function svgIcon(path) {
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', '20');
      svg.setAttribute('height', '20');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      var d = document.createElementNS(ns, 'path');
      d.setAttribute('d', path);
      svg.appendChild(d);
      return svg;
    }

    function closeViewer() {
      if (!viewer) { return; }
      document.removeEventListener('keydown', viewer.onKey);
      if (viewer.root && viewer.root.parentNode) { viewer.root.parentNode.removeChild(viewer.root); }
      viewer = null;
    }

    function openViewer(index) {
      var items = mediaList();
      if (!items.length) { return; }
      closeViewer();
      viewer = { items: items, index: Math.max(0, Math.min(index, items.length - 1)), root: null, onKey: null };
      viewer.onKey = function (event) {
        if (event.key === 'Escape') { closeViewer(); return; }
        if (event.key === 'ArrowRight') { stepViewer(1); }
        if (event.key === 'ArrowLeft') { stepViewer(-1); }
      };
      document.addEventListener('keydown', viewer.onKey);
      paintViewer();
    }

    function stepViewer(delta) {
      if (!viewer) { return; }
      var next = viewer.index + delta;
      if (next < 0) { next = viewer.items.length - 1; }
      if (next >= viewer.items.length) { next = 0; }
      viewer.index = next;
      paintViewer();
    }

    function paintViewer() {
      if (!viewer) { return; }
      if (viewer.root && viewer.root.parentNode) { viewer.root.parentNode.removeChild(viewer.root); }

      var item = viewer.items[viewer.index];
      var root = el('div', 'viewer');
      viewer.root = root;

      var backdrop = el('div', 'viewer__backdrop');
      backdrop.addEventListener('click', closeViewer);
      root.appendChild(backdrop);

      var stage = el('div', 'viewer__stage');
      if (item.type === 'video') {
        var media = document.createElement('video');
        media.className = 'viewer__media';
        media.src = item.url;
        media.controls = true;
        media.autoplay = true;
        media.playsInline = true;
        stage.appendChild(media);
      } else {
        var image = el('img', 'viewer__media');
        image.src = item.url;
        image.alt = '';
        stage.appendChild(image);
      }
      root.appendChild(stage);

      root.appendChild(iconButton('viewer__close', 'M6 6l12 12M18 6L6 18', 'common.close', closeViewer));

      root.appendChild(el('span', 'viewer__count', (viewer.index + 1) + ' / ' + viewer.items.length));

      if (viewer.items.length > 1) {
        root.appendChild(iconButton('viewer__nav viewer__nav--prev', 'M15 19L8 12l7-7', 'viewer.prev', function () { stepViewer(-1); }));
        root.appendChild(iconButton('viewer__nav viewer__nav--next', 'M9 5l7 7-7 7', 'viewer.next', function () { stepViewer(1); }));
      }

      document.body.appendChild(root);
    }

    /* 進行状況ウィンドウは app.js の共通実装を使う（競合分析と同じ見た目） */
    function startWatch(jobId, titleKey) {
      if (!window.App || typeof window.App.watchJob !== 'function') {
        console.error('[screens-home] App.watchJob がありません。app.js を確認してください。');
        toast(t('product.refQueued'), 'success');
        return;
      }
      window.App.watchJob({
        jobId: jobId,
        titleKey: titleKey,
        urls: filledRefUrls(),
        onDone: function (result) {
          if (!applyAutofill(result || {})) { return; }
          markDirty();
          toast(t('job.done'), 'success');
          /* 反映しただけだと画面を離れた時点で消える。そのまま保存まで済ませる */
          if (projectId) { saveDraft(); }
        }
      });
    }

    /* --- AI呼び出し。鍵未接続の開発中は {queued:true} が返り、後から反映される --- */
    function setAnalyzing(on, node, labelKey) {
      analyzing = on;
      [refRunButton, targetProposeButton].forEach(function (b) {
        if (b) { b.disabled = on; }
      });
      if (node) { node.textContent = on ? t('product.refRunning') : t(labelKey); }
    }

    function analysisApiReady() {
      if (window.Api && window.Api.analysis && typeof window.Api.analysis.run === 'function') { return true; }
      console.error('[screens-home] Api.analysis.run がありません。api.js を確認してください。');
      return false;
    }

    function applyAutofill(result) {
      if (!result || typeof result !== 'object') { return false; }
      var touchedAny = false;
      /* 基本情報。すでに手で入れてある欄は上書きしない */
      if (result.category && CATEGORY_KEYS.indexOf(String(result.category)) !== -1) {
        form.category = String(result.category);
        touchedAny = true;
      }
      if (result.product_name && !form.name.trim()) {
        form.name = String(result.product_name).slice(0, MAX_NAME);
        touchedAny = true;
      }
      if (result.price !== undefined && result.price !== null && String(result.price) !== '') {
        var priceDigits = digitsOf(result.price);
        if (priceDigits && isDigits(priceDigits)) { form.price = formatNumber(priceDigits); touchedAny = true; }
      }
      if (result.funding_goal) { form.fundingGoal = String(result.funding_goal); touchedAny = true; }
      if (isArray(result.rewards)) {
        form.rewards = result.rewards.map(function (row) {
          return {
            name: String((row && row.name) || ''),
            listPrice: (row && row.list_price !== undefined && row.list_price !== null) ? formatNumber(digitsOf(row.list_price)) : '',
            price: (row && row.price !== undefined && row.price !== null) ? formatNumber(digitsOf(row.price)) : '',
            qty: (row && row.quantity !== undefined && row.quantity !== null) ? String(row.quantity) : '',
            desc: String((row && row.description) || '')
          };
        });
        touchedAny = true;
      }
      if (result.value_prop) { form.valueProp = String(result.value_prop); touchedAny = true; }
      if (result.brand_tone) { form.brandTone = String(result.brand_tone); touchedAny = true; }
      if (result.target_audience) { form.target = String(result.target_audience); touchedAny = true; }
      if (result.product_features) { form.features = String(result.product_features); touchedAny = true; }
      if (isArray(result.brand_palettes)) {
        form.brandPalettes = result.brand_palettes
          .filter(function (one) { return one && isArray(one.colors) && one.colors.length; })
          .slice(0, 5)
          .map(function (one) {
            return { name: String(one.name || ''), note: String(one.note || ''),
              colors: one.colors.slice(0, MAX_BRAND_COLORS).map(normalizeHex) };
          });
        touchedAny = true;
      }
      if (isArray(result.brand_colors)) {
        form.brandColors = result.brand_colors.slice(0, MAX_BRAND_COLORS).map(normalizeHex);
        touchedAny = true;
      } else if (form.brandPalettes.length && !form.brandColors.length) {
        /* brand_colors を返さなかったときは、A案（参照ページの実際の色）を入れておく */
        form.brandColors = form.brandPalettes[0].colors.slice();
        touchedAny = true;
      }
      if (result.brand_fonts && typeof result.brand_fonts === 'object') {
        FONT_SLOTS.forEach(function (slot) {
          var value = result.brand_fonts[slot.key];
          if (value && FONT_OPTIONS.indexOf(String(value)) !== -1) { form.brandFonts[slot.key] = String(value); }
        });
        touchedAny = true;
      }
      if (isArray(result.images)) {
        var added = 0;
        result.images.forEach(function (url) {
          var text = String(url || '').trim();
          if (!text || text.indexOf('http') !== 0) { return; }
          if (form.images.indexOf(text) !== -1) { return; }
          /* 参照ページから集めた分は打ち切らない。MAX_IMAGES は手動追加の上限 */
          form.images.push(text);
          added += 1;
        });
        if (added) { touchedAny = true; }
      }
      if (isArray(result.videos)) {
        result.videos.forEach(function (url) {
          var text = String(url || '').trim();
          if (!text || text.indexOf('http') !== 0) { return; }
          if (form.videos.indexOf(text) !== -1) { return; }
          form.videos.push(text);
          touchedAny = true;
        });
      }
      if (isArray(result.targets)) {
        targetOpen = -1;
        aiTargetOrder = null;
        form.targets = result.targets.slice(0, TARGET_LABELS.length).map(function (row, index) {
          return {
            label: TARGET_LABELS[index],
            name: String((row && row.name) || ''),
            age: String((row && row.age) || ''),
            gender: String((row && row.gender) || ''),
            rationale: String((row && row.rationale) || ''),
            persona: String((row && row.persona) || ''),
            description: String((row && row.description) || '')
          };
        });
        /* このときの並びが「AIが出した優先順位」。戻せるように控える */
        aiTargetOrder = form.targets.slice();
        touchedAny = true;
      }
      if (touchedAny) { paint(); }
      return touchedAny;
    }

    function isArray(value) {
      return Object.prototype.toString.call(value) === '[object Array]';
    }

    function runAutofill() {
      if (analyzing) { return; }
      var urls = filledRefUrls();
      if (!urls.length) {
        toast(t('product.refNoUrl'), 'danger');
        return;
      }
      if (!analysisApiReady()) { toast(t('common.error'), 'danger'); return; }

      setAnalyzing(true, refRunButton, 'product.refRun');
      window.Api.analysis.run({
        mode: 'product_autofill',
        /* 参照ページの組み立て方は、フォームではなくプロジェクトへ直接書く。
           どのプロジェクトの話かを渡さないと、書き戻し先が分からず捨てられる
           （実測: AIは9区画で返していたのに保存されず0区画のままだった） */
        projects_id: projectId ? String(projectId) : null,
        urls: refTargets().map(function (r) { return r.url; }),
        targets_lang: refTargets(),
        collect: ['images', 'videos'],
        product: { name: form.name.trim(), category: form.category, price: digitsOf(form.price) }
      }).then(function (result) {
        setAnalyzing(false, refRunButton, 'product.refRun');
        if (result && result.queued) { startWatch(result.job_id, 'job.title'); return; }
        var before = form.images.length;
        if (applyAutofill(result && result.content ? result.content : result)) {
          var pulled = form.images.length - before;
          toast(pulled > 0 ? t('product.refFilledImages', { n: pulled }) : t('product.refFilled'), 'success');
        } else {
          toast(t('common.error'), 'danger');
        }
      }, function (err) {
        setAnalyzing(false, refRunButton, 'product.refRun');
        console.error('[screens-home] 参考ページの読み取りに失敗しました', err);
        toast(errorMessage(err), 'danger');
      });
    }

    function proposeTargets() {
      if (analyzing) { return; }
      if (!analysisApiReady()) { toast(t('common.error'), 'danger'); return; }

      setAnalyzing(true, targetProposeButton, 'product.targetPropose');
      window.Api.analysis.run({
        mode: 'target_proposal',
        urls: filledRefUrls(),
        product: {
          name: form.name.trim(),
          category: form.category,
          price: digitsOf(form.price),
          features: form.features.trim(),
          value_prop: form.valueProp.trim()
        }
      }).then(function (result) {
        setAnalyzing(false, targetProposeButton, 'product.targetPropose');
        if (result && result.queued) { startWatch(result.job_id, 'job.titleTargets'); return; }
        if (applyAutofill(result && result.content ? result.content : result)) {
          toast(t('product.refFilled'), 'success');
        } else {
          toast(t('common.error'), 'danger');
        }
      }, function (err) {
        setAnalyzing(false, targetProposeButton, 'product.targetPropose');
        console.error('[screens-home] ターゲット案の生成に失敗しました', err);
        toast(errorMessage(err), 'danger');
      });
    }

    /* 入力中に描き直すとフォーカスが飛ぶので、追加・削除・送りのときだけ呼ぶこと。
       段階が増えても縦に伸びないよう、1枚ずつ出して左右のボタンで送る。 */
    function paintRewards() {
      if (!rewardsHost) { return; }
      /* 描き直す前に、いま出ている1枚を手元に残す。あとで新しい枠に置き直して
         出ていく側として動かす。これがないと前のカードだけ瞬間的に消える */
      var leaving = rewardAnim && !reducedMotion() ? rewardsHost.querySelector('.reward-card') : null;
      clear(rewardsHost);
      discountNodes = [];
      var total = form.rewards.length;
      if (rewardsEmpty) { rewardsEmpty.hidden = total > 0; }
      if (!total) { return; }

      if (rewardIndex >= total) { rewardIndex = total - 1; }
      if (rewardIndex < 0) { rewardIndex = 0; }
      var index = rewardIndex;
      var reward = form.rewards[index];

      var carousel = el('div', 'reward-carousel');
      var prev = iconButton('reward-nav', 'M15 19L8 12l7-7', 'product.rewardPrev', function () { stepReward(-1); });
      prev.disabled = total < 2;
      carousel.appendChild(prev);

      var dir = rewardAnim;
      var card = el('article', 'reward-card'
        + (dir > 0 ? ' is-from-right' : (dir < 0 ? ' is-from-left' : '')));
      rewardAnim = 0;

      var head = el('div', 'reward-card__head');
      head.appendChild(el('span', 'reward-badge', String(index + 1)));
      head.appendChild(el('span', 'reward-card__title', t('product.rewardCardTitle', { n: index + 1 })));
      head.appendChild(el('span', 'reward-card__pos', t('product.rewardPosition', { n: index + 1, total: total })));
      var remove = button('target-card__remove', '', function () {
        form.rewards.splice(index, 1);
        if (rewardIndex >= form.rewards.length) { rewardIndex = form.rewards.length - 1; }
        paintRewards();
        markDirty();
      });
      remove.appendChild(svgIcon('M6 6l12 12M18 6L6 18'));
      remove.setAttribute('aria-label', t('common.delete'));
      head.appendChild(remove);
      card.appendChild(head);

      var body = el('div', 'reward-card__body');

      body.appendChild(labeledInput('product.rewardName', 'product.rewardNamePlaceholder',
        reward.name, false, null, function (value) { reward.name = value; }));

      /* 定価 → リワード価格 の順に置き、価格の下に定価比を出す */
      var pair = el('div', 'reward-card__pair');
      pair.appendChild(labeledInput('product.rewardListPrice', 'product.rewardListPricePlaceholder',
        reward.listPrice, true, 'unit.yen', function (value) {
          reward.listPrice = value;
          refreshDiscounts();
        }));
      var priceField = labeledInput('product.rewardPrice', 'product.rewardPricePlaceholder',
        reward.price, true, 'unit.yen', function (value) {
          reward.price = value;
          refreshDiscounts();
        });
      var mark = el('span', 'discount-mark');
      priceField.appendChild(mark);
      discountNodes[index] = mark;
      pair.appendChild(priceField);
      pair.appendChild(labeledInput('product.rewardQty', 'product.rewardQtyPlaceholder',
        reward.qty, true, 'unit.count', function (value) { reward.qty = value; }, 'product.rewardQtyHint'));
      body.appendChild(pair);

      var descField = el('div', 'field');
      descField.appendChild(el('span', 'field__label', t('product.rewardDesc')));
      var desc = el('textarea', 'textarea');
      desc.value = reward.desc || '';
      desc.setAttribute('placeholder', t('product.rewardDescPlaceholder'));
      desc.addEventListener('input', function () { reward.desc = desc.value; });
      descField.appendChild(desc);
      body.appendChild(descField);

      card.appendChild(body);
      var cardView = el('div', 'reward-carousel__view');
      cardView.appendChild(card);
      if (leaving && dir) { slideOut(cardView, leaving, dir); }
      carousel.appendChild(cardView);

      var next = iconButton('reward-nav', 'M9 5l7 7-7 7', 'product.rewardNext', function () { stepReward(1); });
      next.disabled = total < 2;
      carousel.appendChild(next);
      rewardsHost.appendChild(carousel);

      /* 何段階目を見ているかの点。押しても移れる */
      if (total > 1) {
        var dots = el('div', 'reward-dots');
        form.rewards.forEach(function (item, dotIndex) {
          var dot = button('reward-dot' + (dotIndex === index ? ' is-current' : ''), '', function () {
            if (dotIndex === rewardIndex) { return; }
            rewardAnim = dotIndex > rewardIndex ? 1 : -1;
            rewardIndex = dotIndex;
            paintRewards();
          });
          dot.setAttribute('aria-label', t('product.rewardCardTitle', { n: dotIndex + 1 }));
          dots.appendChild(dot);
        });
        rewardsHost.appendChild(dots);
      }

      refreshDiscounts();
    }

    /* OS側で「視差効果を減らす」が入っているときは動かさない */
    function reducedMotion() {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /* 前のカードを新しい枠に置き直し、送った向きへ流して捨てる。
       入力欄が残っているので、触れないようにしてから動かす */
    function slideOut(view, node, delta) {
      node.className = 'reward-card ' + (delta > 0 ? 'is-leaving-left' : 'is-leaving-right');
      node.setAttribute('aria-hidden', 'true');
      node.querySelectorAll('input, textarea, button').forEach(function (field) { field.tabIndex = -1; });
      view.appendChild(node);
      var drop = function () { if (node.parentNode) { node.parentNode.removeChild(node); } };
      node.addEventListener('animationend', drop);
      /* アニメーションが走らなかったときの保険。残ると次の1枚に重なる */
      setTimeout(drop, 1200);
    }

    function stepReward(delta) {
      var total = form.rewards.length;
      if (total < 2) { return; }
      rewardAnim = delta;
      rewardIndex = (rewardIndex + delta + total) % total;
      paintRewards();
    }

    /* 定価とリワード価格から割引率を出す。定価より高い構成（2台セット等）は
       割引として出さず、そのまま「高い」と書く。嘘の%OFFを出さないため。 */
    function refreshDiscounts() {
      form.rewards.forEach(function (reward, index) {
        var baseDigits = digitsOf(reward.listPrice);
        var base = baseDigits && isDigits(baseDigits) ? Number(baseDigits) : null;
        var node = discountNodes[index];
        if (!node) { return; }
        var digits = digitsOf(reward.price);
        var value = digits && isDigits(digits) ? Number(digits) : null;
        if (!value) { node.textContent = ''; node.className = 'discount-mark'; return; }
        if (!base) {
          node.textContent = t('product.discountNeedPrice');
          node.className = 'discount-mark discount-mark--hint';
          return;
        }
        if (value < base) {
          node.textContent = t('product.discountOff', { n: Math.round((1 - value / base) * 100) });
          node.className = 'discount-mark discount-mark--off';
        } else if (value > base) {
          node.textContent = t('product.discountOver', { n: Math.round((value / base - 1) * 100) });
          node.className = 'discount-mark discount-mark--over';
        } else {
          node.textContent = '';
          node.className = 'discount-mark';
        }
      });
    }

    /* 見出し付きの入力欄。単位キーを渡すと右端に単位を出す */
    function labeledInput(labelKey, placeholderKey, value, numeric, unitKey, onInput, hintKey) {
      var field = el('div', 'field');
      field.appendChild(el('span', 'field__label', t(labelKey)));
      var input = el('input', 'input');
      input.type = 'text';
      input.value = value || '';
      input.setAttribute('placeholder', t(placeholderKey));
      if (numeric) { input.setAttribute('inputmode', 'numeric'); }
      input.addEventListener('input', function () { onInput(input.value); });
      if (unitKey) {
        var wrap = el('div', 'input-unit');
        wrap.appendChild(input);
        wrap.appendChild(el('span', 'input-unit__label', t(unitKey)));
        field.appendChild(wrap);
      } else {
        field.appendChild(input);
      }
      if (hintKey) { field.appendChild(el('p', 'field__hint', t(hintKey))); }
      return field;
    }

    function rewardInput(placeholder, value, numeric, onInput) {
      var input = el('input', 'input');
      input.type = 'text';
      input.value = value;
      if (numeric) { input.setAttribute('inputmode', 'numeric'); }
      input.setAttribute('placeholder', placeholder);
      input.setAttribute('aria-label', placeholder);
      input.addEventListener('input', function () { onInput(input.value); });
      return input;
    }

    /* 空行は捨て、価格と数量は数値にしてから rewards 列に入れる */
    function brandFontsValue() {
      var out = {};
      FONT_SLOTS.forEach(function (slot) {
        var value = form.brandFonts[slot.key];
        if (value) { out[slot.key] = value; }
      });
      return out;
    }

    /* 名前も説明も空の案は捨てる */
    /* 既存の画面や生成が読む target_audience は、最優先（A）の層を入れておく */
    function primaryTargetName() {
      var first = form.targets[0];
      var name = first ? String(first.name || '').trim() : '';
      if (name) {
        var age = String(first.age || '').trim();
        var gender = String(first.gender || '').trim();
        return name + (age || gender ? '（' + [age, gender].filter(Boolean).join('・') + '）' : '');
      }
      return form.target.trim() || null;
    }

    function targetsValue() {
      var out = [];
      form.targets.forEach(function (target, index) {
        var name = String(target.name || '').trim();
        var desc = String(target.description || '').trim();
        var age = String(target.age || '').trim();
        var gender = String(target.gender || '').trim();
        var persona = String(target.persona || '').trim();
        var rationale = String(target.rationale || '').trim();
        if (!name && !desc && !age && !gender && !persona && !rationale) { return; }
        out.push({
          label: TARGET_LABELS[index] || String(index + 1),
          name: name, age: age, gender: gender,
          rationale: String(target.rationale || '').trim(),
          persona: String(target.persona || '').trim(),
          description: desc
        });
      });
      return out;
    }

    function rewardsValue() {
      var out = [];
      form.rewards.forEach(function (reward) {
        var name = String(reward.name || '').trim();
        var desc = String(reward.desc || '').trim();
        var price = digitsOf(reward.price);
        var qty = digitsOf(reward.qty);
        if (!name && !desc && !price && !qty) { return; }
        var listPrice = digitsOf(reward.listPrice);
        out.push({
          name: name,
          list_price: listPrice && isDigits(listPrice) ? Number(listPrice) : null,
          price: price && isDigits(price) ? Number(price) : null,
          quantity: qty && isDigits(qty) ? Number(qty) : null,
          description: desc || null
        });
      });
      return out;
    }

    function paintImages() {
      if (!imagesHost) { return; }
      clear(imagesHost);

      form.images.forEach(function (source, index) {
        var cell = el('div', 'thumb');
        var image = el('img', 'thumb__img');
        image.src = source;
        image.alt = '';
        image.setAttribute('role', 'button');
        image.setAttribute('tabindex', '0');
        image.setAttribute('aria-label', t('viewer.open'));
        image.addEventListener('click', function () { openViewer(index); });
        image.addEventListener('keydown', function (event) {
          if (event.key !== 'Enter' && event.key !== ' ') { return; }
          event.preventDefault();
          openViewer(index);
        });
        cell.appendChild(image);

        /* GIF は止まった写真では伝わらない場面（開く・畳む・使うところ）が入っている。
           一覧では動いて見えるが、静止画と混ざると見分けが付かないので印を付ける */
        if (/\.gif(\?|$)/i.test(source)) {
          var tag = el('span', 'thumb__tag', 'GIF');
          tag.title = t('s4.gifNote');
          cell.appendChild(tag);
        }

        var remove = button('thumb__remove', '×', function () {
          form.images.splice(index, 1);
          var at = form.productShots.indexOf(source);
          if (at !== -1) { form.productShots.splice(at, 1); }
          paintImages();
        });
        remove.setAttribute('aria-label', t('common.delete'));
        cell.appendChild(remove);

        /* 集めた写真には仕様の図版やレビュー画面も混ざる。
           商品そのものが写っているものだけを選んでおくと、
           KV・LP・広告の素材を作るときの参照として AI に渡せる */
        /* GIF にも ☆ を付けられる。見本にするときは最初のコマを静止画にして切り抜く
           （商品が大きく写った GIF は形の参照として十分役に立つ） */
        var picked = form.productShots.indexOf(source) !== -1;
        var mark = button('thumb__pick' + (picked ? ' thumb__pick--on' : ''),
          picked ? '★' : '☆', function () {
            if (picked) { form.productShots.splice(form.productShots.indexOf(source), 1); }
            else { form.productShots.push(source); }
            paintImages();
          });
        mark.setAttribute('aria-pressed', picked ? 'true' : 'false');
        mark.setAttribute('aria-label', t('s4.productShot'));
        mark.title = t('s4.productShot');
        cell.appendChild(mark);

        imagesHost.appendChild(cell);
      });

      if (productShotNote) {
        productShotNote.textContent = t('s4.productShotCount', {
          n: form.productShots.length, m: form.images.length
        });
        productShotNote.hidden = form.images.length === 0;
      }
      if (registerRow) { registerRow.hidden = form.productShots.length === 0 || !projectId; }

      imagesHost.hidden = form.images.length === 0;
      if (dropzone) { dropzone.hidden = form.images.length >= MAX_IMAGES; }
      paintVideos();
    }

    /* 参照ページから集めた動画。再生できる形でそのまま並べる */
    function paintVideos() {
      if (!videosHost) { return; }
      clear(videosHost);
      videosHost.hidden = form.videos.length === 0;
      if (!form.videos.length) { return; }

      videosHost.appendChild(el('span', 'field__label', t('product.videos') + '（' + form.videos.length + '）'));
      var grid = el('div', 'video-grid');
      form.videos.forEach(function (url, index) {
        var cell = el('div', 'video-cell');
        var media = document.createElement('video');
        media.className = 'video-cell__player';
        media.src = url;
        media.controls = true;
        media.preload = 'metadata';
        media.muted = true;
        media.playsInline = true;
        cell.appendChild(media);
        var zoom = button('video-cell__zoom', '⤢', function () {
          openViewer(form.images.length + index);
        });
        zoom.setAttribute('aria-label', t('viewer.open'));
        cell.appendChild(zoom);
        var remove = button('thumb__remove', '×', function () {
          form.videos.splice(index, 1);
          paintVideos();
        });
        remove.setAttribute('aria-label', t('common.delete'));
        cell.appendChild(remove);
        grid.appendChild(cell);
      });
      videosHost.appendChild(grid);
      videosHost.appendChild(el('p', 'field__hint', t('product.videosHint')));
    }

    /* 写真の追加口。クリックでもドロップでも同じ addFiles に流す */
    function buildDropzone(inputId) {
      dropzone = el('div', 'dropzone');
      dropzone.appendChild(el('span', null, t('product.dropzone')));
      dropzone.appendChild(el('span', 'dropzone__sub', t('product.dropzoneSub')));

      /* 透明な input を枠いっぱいに敷く。クリックもドロップもブラウザ自身が処理するので、
         JSでクリックを転送する必要がなく、Safari や WebView でも同じ動きになる */
      var fileInput = el('input', 'dropzone__input');
      fileInput.type = 'file';
      fileInput.id = inputId;
      fileInput.accept = 'image/*';
      fileInput.multiple = true;
      fileInput.setAttribute('aria-label', t('product.dropzone'));
      fileInput.addEventListener('change', function () {
        addFiles(fileInput.files);
        fileInput.value = '';
      });
      dropzone.appendChild(fileInput);

      /* 見た目の変化だけ。既定動作は止めない（止めると input がドロップを受け取れない） */
      ['dragenter', 'dragover'].forEach(function (name) {
        dropzone.addEventListener(name, function () { dropzone.classList.add('dropzone--over'); });
      });
      ['dragleave', 'dragend', 'drop'].forEach(function (name) {
        dropzone.addEventListener(name, function () { dropzone.classList.remove('dropzone--over'); });
      });
      return dropzone;
    }

    function addFiles(files) {
      if (!files || !files.length) { return; }
      var slots = MAX_IMAGES - form.images.length;
      if (slots <= 0) {
        toast(t('product.imagesMax'), 'danger');
        return;
      }
      var picked = [];
      var i;
      for (i = 0; i < files.length && picked.length < slots; i++) { picked.push(files[i]); }
      if (files.length > slots) { toast(t('product.imagesMax'), 'danger'); }

      var pending = picked.length;
      if (!pending) { return; }

      picked.forEach(function (file) {
        shrinkImage(file, function (err, dataUrl) {
          pending--;
          if (err) {
            console.error('[screens-home] 画像を読み込めませんでした: ' + (file && file.name ? file.name : ''), err);
            toast(t('common.error'), 'danger');
          } else {
            form.images.push(dataUrl);
          }
          if (pending === 0) { paintImages(); }
        });
      });
    }

    // 端末の写真をそのまま入れると行が巨大になるため、長辺を縮めてから image_urls に入れる
    function shrinkImage(file, done) {
      if (!file || String(file.type).indexOf('image/') !== 0) {
        done(new Error('画像ファイルではありません'));
        return;
      }
      if (typeof window.FileReader !== 'function') {
        console.error('[screens-home] この環境には FileReader がありません。画像を追加できません。');
        done(new Error('FileReader がありません'));
        return;
      }

      var reader = new window.FileReader();
      reader.onerror = function () { done(reader.error || new Error('読み込みに失敗しました')); };
      reader.onload = function () {
        var image = new window.Image();
        image.onerror = function () { done(new Error('画像を復号できませんでした')); };
        image.onload = function () {
          var width = image.naturalWidth || image.width;
          var height = image.naturalHeight || image.height;
          if (!width || !height) { done(new Error('画像の大きさが取れませんでした')); return; }
          var scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(width, height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          var ctx = canvas.getContext ? canvas.getContext('2d') : null;
          if (!ctx) {
            console.error('[screens-home] canvas の 2d コンテキストが取れません。画像を縮小できません。');
            done(new Error('canvas が使えません'));
            return;
          }
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          done(null, canvas.toDataURL('image/jpeg', IMAGE_QUALITY));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    }

    /* 既存の画面や生成が読む projects.price は、最初の段階の定価を入れておく */
    function firstListPrice() {
      var found = null;
      form.rewards.forEach(function (reward) {
        if (found !== null) { return; }
        var digits = digitsOf(reward.listPrice);
        if (digits && isDigits(digits)) { found = Number(digits); }
      });
      return found;
    }

    function priceValue() {
      var digits = digitsOf(form.price);
      if (!digits) { return null; }
      return Number(digits);
    }

    function validate() {
      var name = form.name.trim();
      var digits = digitsOf(form.price);
      var nameOk = name.length > 0 && name.length <= MAX_NAME;
      var priceOk = !digits || isDigits(digits);

      if (nameError) {
        if (!nameOk && touched) {
          nameError.textContent = name.length > MAX_NAME ? t('projectRename.tooLong') : t('project.nameRequired');
        } else {
          nameError.textContent = '';
        }
      }

      var ok = nameOk && priceOk;
      if (submitButton) {
        var blocked = busy || !ok || !projectId;
        submitButton.disabled = blocked;
        submitButton.setAttribute('aria-disabled', blocked ? 'true' : 'false');
      }
      if (saveButton) { saveButton.disabled = busy || !projectId; }
      return ok;
    }

    function setBusy(on) {
      busy = on;
      if (!submitButton) { return; }
      submitButton.disabled = on;
      submitButton.setAttribute('aria-disabled', on ? 'true' : 'false');
      submitButton.textContent = on ? t('common.loading') : t('project.finish');
    }

    /* --- 先に名前だけ作る → 以後は途中保存で更新 ------------------- */

    /* フォームの中身を projects の列の形にする。作成にも更新にも同じ形を使う */
    function formPayload() {
      var name = form.name.trim();
      return {
        project_name: name,
        name: name,
        product_name: name,
        price: firstListPrice(),
        product_features: form.features.trim() || null,
        target_audience: primaryTargetName(),
        image_urls: form.images.slice(),
        /* 素材生成で AI に渡す見本。GIF も可（最初のコマを切り抜いて使う） */
        product_shot_urls: form.productShots.filter(function (url) {
          return form.images.indexOf(url) !== -1;
        }),
        video_urls: form.videos.slice(),
        rewards: rewardsValue(),
        category: form.category || null,
        output_lang: form.outputLang || 'ja',
        funding_goal: form.fundingGoal.trim() || null,
        value_prop: form.valueProp.trim() || null,
        brand_tone: form.brandTone.trim() || null,
        brand_colors: form.brandColors.slice(),
        brand_fonts: brandFontsValue(),
        reference_urls: filledRefUrls(),
        targets: targetsValue()
      };
    }

    /* 名前を聞くだけの入口。ここで行を作ってしまうので、以後の保存は無料の更新になる */
    function askProjectName() {
      var box = el('div', 'modal');
      box.appendChild(el('h2', 'modal__title', t('project.nameFirstTitle')));
      var body = el('div', 'modal__body');
      body.appendChild(el('p', null, t('project.nameFirstBody')));
      var input = el('input', 'input');
      input.type = 'text';
      input.id = 'home-create-name-first';
      input.maxLength = MAX_NAME;
      input.value = form.name;
      input.setAttribute('placeholder', t('product.namePlaceholder'));
      body.appendChild(input);
      var error = el('p', 'field__error');
      body.appendChild(error);
      box.appendChild(body);

      var actions = el('div', 'modal__actions');
      var cancel = button('btn btn--secondary', t('common.cancel'), function () {
        dismissModal();
        go('S3');
      });
      actions.appendChild(cancel);
      /* 作成は無料なので、ボタンには消費量を出さない */
      var createLabel = t('project.nameFirstCreate');
      var create = button('btn btn--primary', createLabel, function () {
        var name = input.value.trim();
        if (!name) { error.textContent = t('project.nameRequired'); input.focus(); return; }
        if (name.length > MAX_NAME) { error.textContent = t('projectRename.tooLong'); return; }
        form.name = name;
        /* 押した瞬間に大きさが変わらないようにする。
           このボタンは幅が中身で決まるので、文字が短くなると縮んで
           指の下でボタンが動く。押す前の幅で固定してから差し替える。
           ポイントも出したまま（押す前と同じ情報なので消す理由がない） */
        create.style.minWidth = create.offsetWidth + 'px';
        create.disabled = true;
        create.textContent = t('common.loading');
        createShell(name).then(function () {
          dismissModal();
        }, function (err) {
          create.disabled = false;
          create.textContent = createLabel;
          error.textContent = errorMessage(err, 'project.createFailed');
        });
      });
      actions.appendChild(create);
      box.appendChild(actions);

      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') { event.preventDefault(); create.click(); }
      });

      window.App.openModal(box, { closeOnBackdrop: false });
      input.focus();
    }

    /* 名前だけの行を作る。作成は無料で、この先の保存も無料 */
    function createShell(name) {
      if (!apiReady()) { return Promise.reject(new Error('api')); }
      return window.Api.projects.insert({
        users_id: String(user.id),
        project_name: name,
        name: name,
        status: 'active',
        product_name: name
      }).then(function (created) {
        selectProject(created);
        projectId = String(created.id);
        dirty = false;
        toast(t('common.created'), 'success');
        /* 再読み込みしても同じプロジェクトの続きになるよう、URLにIDを載せる */
        window.location.hash = '#/S4?id=' + encodeURIComponent(projectId);
        paint();
        return created;
      });
    }

    /* ☆が変わったら、商品だけを抜いた白背景の見本を作り直す（裏で）。
       見本は素材の生成に全部添付されるので、☆を増やせば見本も増える */
    var lastShots = '';
    function refreshCutouts() {
      var now = JSON.stringify(form.productShots.slice().sort());
      if (now === lastShots || !form.productShots.length) { return; }
      lastShots = now;
      if (!window.Api || !window.Api.generationJobs) { return; }
      window.Api.generationJobs.insert({
        feature_key: 'product_cutouts',
        status: 'pending',
        projects_id: projectId,
        users_id: (window.Api.auth && typeof window.Api.auth.userId === 'function') ? window.Api.auth.userId() : undefined,
        payload: {},
        lang: (window.I18N && typeof window.I18N.locale === 'function') ? window.I18N.locale() : 'ja'
      }).catch(function (err) { console.warn('[screens-home] 切り抜きの仕事を積めませんでした', err); });
    }

    /* ★の写真を見本に登録する。保存 → 切り抜きの仕事 → 終わったら枚数を知らせる */
    function registerShots() {
      if (!projectId || !apiReady()) { toast(t('common.error'), 'danger'); return; }
      if (!form.productShots.length) { toast(t('s4.registerShotsNone'), 'danger'); return; }
      var label = registerBtn.textContent;
      registerBtn.disabled = true;
      registerBtn.textContent = t('s4.registerShotsRunning');
      var done = function () { registerBtn.disabled = false; registerBtn.textContent = label; };
      window.Api.projects.update(projectId, formPayload()).then(function () {
        dirty = false;
        paintSaveState();
        lastShots = JSON.stringify(form.productShots.slice().sort());
        return window.Api.generationJobs.insert({
          feature_key: 'product_cutouts',
          status: 'pending',
          projects_id: projectId,
          users_id: (window.Api.auth && typeof window.Api.auth.userId === 'function') ? window.Api.auth.userId() : undefined,
          payload: {},
          lang: (window.I18N && typeof window.I18N.locale === 'function') ? window.I18N.locale() : 'ja'
        });
      }).then(function (job) {
        if (!window.App || !window.App.watchJob) { done(); toast(t('project.saved'), 'success'); return; }
        window.App.watchJob({
          jobId: job.id,
          titleKey: 'job.titleAssets',
          urls: [],
          onDone: function (result) {
            done();
            /* watchJob は onDone(row.result, row) で呼ぶ。made は作れた枚数 */
            var n = result && result.made;
            toast(t('s4.registerShotsDone', { n: n === undefined ? '' : n }), 'success');
          }
        });
      }).catch(function (err) {
        done();
        console.error('[screens-home] 見本の登録に失敗しました', err);
        toast(errorMessage(err, 'project.saveFailed'), 'danger');
      });
    }

    /* 途中保存。作成済みの行を更新するだけなので消費は無い */
    function saveDraft() {
      if (!projectId || busy) { return; }
      if (!apiReady()) { toast(t('common.error'), 'danger'); return; }
      setSaving(true);
      window.Api.projects.update(projectId, formPayload()).then(function () {
        dirty = false;
        setSaving(false);
        paintSaveState();
        toast(t('project.saved'), 'success');
        refreshCutouts();
      }, function (err) {
        setSaving(false);
        console.error('[screens-home] 途中保存に失敗しました', err);
        toast(errorMessage(err, 'project.saveFailed'), 'danger');
      });
    }

    function setSaving(on) {
      busy = on;
      if (saveButton) {
        saveButton.disabled = on;
        saveButton.textContent = on ? t('common.loading') : t('project.saveDraft');
      }
    }

    function paintSaveState() {
      if (!dirtyMark) { return; }
      dirtyMark.hidden = !dirty;
    }

    /* 入力のたびに「未保存」を立てる */
    function markDirty() {
      dirty = true;
      paintSaveState();
    }

    function submitCreate() {
      if (busy || !projectId) { return; }
      touched = true;
      if (!validate()) { return; }
      if (!apiReady()) {
        toast(t('common.error'), 'danger');
        return;
      }
      setBusy(true);
      clearBanner();
      window.Api.projects.update(projectId, formPayload()).then(function (row) {
        dirty = false;
        selectProject(row);
        toast(t('common.saved'), 'success');
        refreshCutouts();
        go('S8', { id: projectId });
      }, function (err) {
        setBusy(false);
        validate();
        console.error('[screens-home] プロジェクトの保存に失敗しました', err);
        toast(errorMessage(err, 'project.saveFailed'), 'danger');
      });
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
    if (mounted.id === 'S3') { renderDashboard(mounted.root, mounted.params); }
    if (mounted.id === 'S4') { renderCreate(mounted.root, mounted.params); }
  });

  /* ---------- 画面登録（第2引数は必ず { render: 関数 }） ---------- */
  App.registerScreen('S3', {
    render: function (root, params) { renderDashboard(root, params); }
  });

  App.registerScreen('S4', {
    render: function (root, params) { renderCreate(root, params); }
  });

})(window, document);
