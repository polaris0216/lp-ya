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
 *              Api.projects.remove(id) / Api.generations.list(options)
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
  var CREATE_FEATURE_KEY = 'project_create';
  var CREATE_COST_FALLBACK = 10;   // 意図書のメモ「作成に10クレジット消費」。feature_credits に登録があればそちらを使う
  var MAX_IMAGES = 15;
  var MAX_NAME = 30;
  var MAX_FEATURES = 300;
  var IMAGE_MAX_EDGE = 1024;       // ponytail: 画像はデータURLのまま projects.image_urls に入れるので長辺1024pxへ縮小する。専用ストレージを使うならここを差し替える。
  var IMAGE_QUALITY = 0.72;

  /* ---------- 小さな道具 ---------- */
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
    console.error('[screens-home] window.Api の中身（users / projects / credits）が揃っていません。api.js を確認してください。');
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
    console.error('[screens-home] Api.credits.hasUnlimited がありません。無制限利用権は無いものとして扱います。');
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
        var generations = ids.length
          ? window.Api.generations.list({ in: { projects_id: ids }, select: 'projects_id', limit: 1000 })
          : Promise.resolve([]);

        return Promise.all([monthly, generations]);
      }).then(function (results) {
        var transactions = results[0] || [];
        var generations = results[1] || [];
        var used = 0;
        transactions.forEach(function (tx) {
          used += Math.abs(Number(tx.credit_amount) || 0);
        });
        data.monthlyUsed = used;
        data.generatedIds = {};
        generations.forEach(function (row) {
          if (row && row.projects_id) { data.generatedIds[String(row.projects_id)] = true; }
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
      return !data.generatedIds[String(project.id)];
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
    setHeader(t('project.createTitle'), true);

    var form = { name: '', features: '', price: '', target: '', images: [], rewards: [] };
    var user = null;
    var cost = CREATE_COST_FALLBACK;
    var targetCandidates = [];
    var touched = false;
    var busy = false;

    /* 描き直しのたびに入れ替える部品の控え */
    var nameError = null;
    var priceError = null;
    var submitButton = null;
    var imagesHost = null;
    var rewardsHost = null;
    var warnHost = null;

    function load() {
      clearBanner();
      showSkeleton(root);

      loadUser().then(function (loaded) {
        user = loaded;
        return Promise.all([
          window.Api.credits.costOf(CREATE_FEATURE_KEY),
          window.Api.projects.list({
            eq: { users_id: String(loaded.id) },
            select: 'target_audience',
            limit: 50
          })
        ]);
      }).then(function (results) {
        var configured = results[0];
        cost = (configured === null || configured === undefined) ? CREATE_COST_FALLBACK : Number(configured);
        targetCandidates = uniqueTargets(results[1] || []);
        paint();
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

      /* 残高と今回の消費 */
      var balance = Number(user.credit_balance) || 0;
      var costCard = el('div', 'card card--soft');
      costCard.appendChild(el('span', 'card__label', t('dashboard.creditBalance')));
      var balanceValue = el('span');
      balanceValue.appendChild(el('span', 'card__value', formatNumber(balance)));
      balanceValue.appendChild(el('span', 'card__unit', t('common.creditUnit')));
      costCard.appendChild(balanceValue);
      if (cost === CREATE_COST_FALLBACK) {
        costCard.appendChild(el('span', 'card__sub', t('project.createCreditNote')));
      }
      var costFoot = el('div', 'card__foot');
      costFoot.appendChild(el('span', 'card__label', t('creditConfirm.thisTime')));
      costFoot.appendChild(el('span', 'card__sub', formatNumber(cost) + t('common.creditShort')));
      costCard.appendChild(costFoot);
      screen.appendChild(costCard);

      /* 入力欄 */
      var fields = el('div', 'stack');

      /* プロジェクト名 */
      var nameInput = el('input', 'input');
      nameInput.id = 'home-create-name';
      nameInput.type = 'text';
      nameInput.maxLength = MAX_NAME;
      nameInput.value = form.name;
      nameInput.setAttribute('placeholder', t('project.name'));
      nameInput.addEventListener('input', function () {
        form.name = nameInput.value;
        validate();
      });
      nameInput.addEventListener('blur', function () {
        touched = true;
        validate();
      });
      var nameField = makeField(t('project.name'), nameInput, {
        required: true,
        hint: t('projectRename.hint')
      });
      nameError = nameField.error;
      fields.appendChild(nameField.wrap);

      /* 商品の特徴 */
      var featuresInput = el('textarea', 'textarea');
      featuresInput.id = 'home-create-features';
      featuresInput.maxLength = MAX_FEATURES;
      featuresInput.value = form.features;
      featuresInput.setAttribute('placeholder', t('product.features'));
      var featuresCounter = el('span', 'counter', form.features.length + ' / ' + MAX_FEATURES);
      featuresInput.addEventListener('input', function () {
        form.features = featuresInput.value;
        featuresCounter.textContent = form.features.length + ' / ' + MAX_FEATURES;
      });
      var featuresField = makeField(t('product.features'), featuresInput, {
        counter: featuresCounter,
        hint: t('product.featuresMax')
      });
      fields.appendChild(featuresField.wrap);

      /* 価格 / ターゲット（スケッチのとおり横並び） */
      var pair = el('div', 'row--2');

      var priceInput = el('input', 'input');
      priceInput.id = 'home-create-price';
      priceInput.type = 'text';
      priceInput.value = form.price;
      priceInput.setAttribute('inputmode', 'numeric');
      priceInput.setAttribute('placeholder', t('product.price'));
      priceInput.addEventListener('input', function () {
        form.price = priceInput.value;
        validate();
      });
      priceInput.addEventListener('blur', function () {
        var digits = digitsOf(form.price);
        if (digits && isDigits(digits)) {
          form.price = formatNumber(digits);
          priceInput.value = form.price;
        }
        touched = true;
        validate();
      });
      var priceField = makeField(t('product.price'), priceInput, {});
      priceError = priceField.error;
      pair.appendChild(priceField.wrap);

      var targetInput = el('input', 'input');
      targetInput.id = 'home-create-target';
      targetInput.type = 'text';
      targetInput.value = form.target;
      targetInput.setAttribute('placeholder', t('product.target'));
      targetInput.addEventListener('input', function () {
        form.target = targetInput.value;
        paintTargetChips();
      });
      var targetField = makeField(t('product.target'), targetInput, {});
      var chipsHost = el('div', 'chips');
      targetField.wrap.insertBefore(chipsHost, targetField.error);
      pair.appendChild(targetField.wrap);

      function paintTargetChips() {
        clear(chipsHost);
        targetCandidates.forEach(function (candidate) {
          var selected = form.target.trim() === candidate;
          var chip = button('chip' + (selected ? ' chip--selected' : ''), candidate, function () {
            form.target = candidate;
            targetInput.value = candidate;
            paintTargetChips();
          });
          chip.setAttribute('aria-pressed', selected ? 'true' : 'false');
          chipsHost.appendChild(chip);
        });
      }
      paintTargetChips();

      fields.appendChild(pair);

      /* リワード（定価の下に、リワードごとの名前・価格・数量・説明を並べる） */
      var rewardsField = el('div', 'field');
      rewardsField.appendChild(el('span', 'field__label', t('product.rewards')));
      rewardsHost = el('div', 'stack');
      rewardsField.appendChild(rewardsHost);
      rewardsField.appendChild(button('btn btn--secondary btn--block', '＋ ' + t('product.rewardAdd'), function () {
        form.rewards.push({ name: '', price: '', qty: '', desc: '' });
        paintRewards();
      }));
      fields.appendChild(rewardsField);

      /* 商品画像 */
      var imagesField = el('div', 'field');
      imagesField.appendChild(el('span', 'field__label', t('product.images')));
      imagesHost = el('div', 'thumb-grid');
      imagesField.appendChild(imagesHost);
      imagesField.appendChild(el('p', 'field__hint', t('product.imagesMax')));
      fields.appendChild(imagesField);

      screen.appendChild(fields);

      /* 残高不足などの警告置き場 */
      warnHost = el('div');
      screen.appendChild(warnHost);

      /* 作成する */
      submitButton = button('btn btn--primary btn--block', t('project.createButton'), submitCreate);
      screen.appendChild(submitButton);

      root.appendChild(screen);

      paintImages();
      paintRewards();
      validate();
    }

    /* 入力中に描き直すとフォーカスが飛ぶので、追加・削除のときだけ呼ぶこと */
    function paintRewards() {
      if (!rewardsHost) { return; }
      clear(rewardsHost);

      form.rewards.forEach(function (reward, index) {
        var card = el('div', 'card');
        var body = el('div', 'stack');

        var head = el('div', 'row row--between');
        head.appendChild(el('span', 'card__label', t('product.reward') + ' ' + (index + 1)));
        head.appendChild(button('btn btn--text', t('common.delete'), function () {
          form.rewards.splice(index, 1);
          paintRewards();
        }));
        body.appendChild(head);

        body.appendChild(rewardInput(t('product.rewardName'), reward.name, false, function (value) {
          reward.name = value;
        }));

        var pair = el('div', 'row--2');
        pair.appendChild(rewardInput(t('product.rewardPrice'), reward.price, true, function (value) {
          reward.price = value;
        }));
        pair.appendChild(rewardInput(t('product.rewardQty'), reward.qty, true, function (value) {
          reward.qty = value;
        }));
        body.appendChild(pair);

        var desc = el('textarea', 'textarea');
        desc.value = reward.desc;
        desc.setAttribute('placeholder', t('product.rewardDesc'));
        desc.setAttribute('aria-label', t('product.rewardDesc'));
        desc.addEventListener('input', function () { reward.desc = desc.value; });
        body.appendChild(desc);

        card.appendChild(body);
        rewardsHost.appendChild(card);
      });
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
    function rewardsValue() {
      var out = [];
      form.rewards.forEach(function (reward) {
        var name = String(reward.name || '').trim();
        var desc = String(reward.desc || '').trim();
        var price = digitsOf(reward.price);
        var qty = digitsOf(reward.qty);
        if (!name && !desc && !price && !qty) { return; }
        out.push({
          name: name,
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
        cell.appendChild(image);
        var remove = button('thumb__remove', '×', function () {
          form.images.splice(index, 1);
          paintImages();
        });
        remove.setAttribute('aria-label', t('common.delete'));
        cell.appendChild(remove);
        imagesHost.appendChild(cell);
      });

      if (form.images.length < MAX_IMAGES) {
        var picker = el('div', 'thumb-add tap');
        picker.setAttribute('role', 'button');
        picker.setAttribute('tabindex', '0');
        picker.setAttribute('aria-label', t('common.add'));
        picker.appendChild(el('span', null, '＋'));
        picker.appendChild(el('span', null, t('common.add')));
        var fileInput = el('input', 'file-input');
        fileInput.type = 'file';
        fileInput.id = 'home-create-images';
        fileInput.accept = 'image/*';
        fileInput.multiple = true;
        fileInput.addEventListener('change', function () {
          addFiles(fileInput.files);
          fileInput.value = '';
        });

        /* 追加ボックスへ直接ドロップしても登録できるようにする */
        ['dragenter', 'dragover'].forEach(function (name) {
          picker.addEventListener(name, function (event) {
            event.preventDefault();
            picker.classList.add('thumb-add--over');
          });
        });
        ['dragleave', 'dragend', 'drop'].forEach(function (name) {
          picker.addEventListener(name, function () { picker.classList.remove('thumb-add--over'); });
        });
        picker.addEventListener('drop', function (event) {
          event.preventDefault();
          if (event.dataTransfer) { addFiles(event.dataTransfer.files); }
        });

        /* label 任せだと開かないブラウザがあるので、自分で input を叩いてファイル選択窓を出す */
        picker.addEventListener('click', function (event) {
          if (event.target === fileInput) { return; }
          fileInput.click();
        });
        picker.addEventListener('keydown', function (event) {
          if (event.key !== 'Enter' && event.key !== ' ') { return; }
          event.preventDefault();
          fileInput.click();
        });
        picker.appendChild(fileInput);
        imagesHost.appendChild(picker);
      }
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
      if (priceError) {
        priceError.textContent = priceOk ? '' : t('product.priceInvalid');
      }

      var ok = nameOk && priceOk;
      if (submitButton) {
        submitButton.disabled = busy || !ok;
        submitButton.setAttribute('aria-disabled', (busy || !ok) ? 'true' : 'false');
      }
      return ok;
    }

    function setBusy(on) {
      busy = on;
      if (!submitButton) { return; }
      submitButton.disabled = on;
      submitButton.setAttribute('aria-disabled', on ? 'true' : 'false');
      submitButton.textContent = on ? t('common.loading') : t('project.createButton');
    }

    function showShortage(shortage) {
      if (!warnHost) { return; }
      clear(warnHost);
      var box = el('div', 'warn-box');
      box.setAttribute('role', 'alert');
      box.appendChild(el('p', null, t('creditConfirm.insufficientWarning')));
      box.appendChild(el('p', null,
        t('creditConfirm.balance') + ' ' + formatNumber(user.credit_balance) + t('common.creditShort') +
        ' / ' + t('creditConfirm.thisTime') + ' ' + formatNumber(cost) + t('common.creditShort') +
        (shortage ? ' / -' + formatNumber(shortage) + t('common.creditShort') : '')));
      box.appendChild(button('btn btn--text', t('creditConfirm.charge'), function () { go('S17'); }));
      warnHost.appendChild(box);
    }

    function submitCreate() {
      if (busy) { return; }
      touched = true;
      if (!validate()) { return; }
      if (!apiReady()) {
        toast(t('common.error'), 'danger');
        return;
      }

      var balance = Number(user.credit_balance) || 0;
      var unlimited = hasUnlimited(user);
      if (!unlimited && balance < cost) {
        showShortage(cost - balance);
        toast(t('creditConfirm.insufficientWarning'), 'danger');
        return;
      }
      if (warnHost) { clear(warnHost); }

      var name = form.name.trim();
      setBusy(true);
      clearBanner();

      /* projects も列が二重化している（name/project_name）。NOT NULL 側は name と
         status で、どちらもデフォルトが無い。送らないと 23502 で必ず失敗する。 */
      window.Api.projects.insert({
        users_id: String(user.id),
        project_name: name,
        name: name,
        status: 'active',
        product_name: name,
        price: priceValue(),
        product_features: form.features.trim() || null,
        target_audience: form.target.trim() || null,
        image_urls: form.images.slice(),
        rewards: rewardsValue()
      }).then(function (created) {
        if (unlimited) {
          return { project: created, user: user };
        }
        // 消費するクレジット数は送らない。feature_key だけ渡してサーバーが単価を引く。
        return window.Api.credits.consume(CREATE_FEATURE_KEY, name).then(function (result) {
          return { project: created, user: result.user };
        }, function (creditErr) {
          console.error('[screens-home] クレジットを引き落とせなかったため、作成したプロジェクトを取り消します', creditErr);
          return window.Api.projects.remove(created.id).then(function () {
            return Promise.reject(creditErr);
          }, function (removeErr) {
            console.error('[screens-home] 取り消しにも失敗しました。projects id=' + created.id + ' を確認してください', removeErr);
            return Promise.reject(creditErr);
          });
        });
      }).then(function (result) {
        syncUser(result.user);
        selectProject(result.project);
        toast(t('common.created'), 'success');
        go('S8', { id: result.project.id });
      }).catch(function (err) {
        setBusy(false);
        validate();
        console.error('[screens-home] プロジェクトの作成に失敗しました', err);
        if (err && err.code === 'insufficient') {
          showShortage(err.shortage);
          toast(t('creditConfirm.insufficientWarning'), 'danger');
          return;
        }
        var message = errorMessage(err, 'project.createFailed');
        showBanner(message, submitCreate);
        toast(message, 'danger');
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
