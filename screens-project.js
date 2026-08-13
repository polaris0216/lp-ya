/* ============================================================
 * エルピーヤ — screens-project.js
 * S8 プロジェクト詳細 と S9 商品登録 の2画面だけを描く。
 *
 * ---- 他ファイルとの共通契約（この名前どおりに使う。似た名前を作らない）----
 * 画面登録   App.registerScreen('S8', { render: function (root, params) {} });
 *            第2引数は必ず { render: 関数 } のオブジェクト。関数をそのまま渡さない。
 * 画面遷移   index.html に書かれた経路の綴りをそのまま使う。
 *            location.hash = '#/S9?id=...' （ハッシュルーターは app.js）
 * 通信       api.js の window.Api だけを使う。
 *              Api.users.get(id) / Api.projects.get(id) / Api.projects.update(id, patch)
 *              Api.analysisReports.list(options) / Api.generations.list(options)
 *              Api.storage.get|set
 *            業務データは localStorage に置かない（保存先は Supabase）。
 * 文言       i18n.js の window.I18N.t(key) だけを使う。辞書に無いキーは作らない。
 * DOM        index.html が用意した id だけを触る。
 *              #app-header 内の #header-title / #header-back / #header-action
 *              #banner-root / #toast-root / #modal-root
 * class      styles.css に実在する綴りだけを使う。
 *              screen / screen__head / screen__title / screen__lead / section /
 *              section__head / section__title / stack / btn-row / row--2 /
 *              card / card--soft / card--gradient / card__label / card__value /
 *              card__unit / card__sub / card__foot / progress / progress__bar /
 *              progress__label / chips / chip / chip--selected / chip--mute /
 *              list / list-row / list-row--selected / list-row__thumb /
 *              list-row__body / list-row__title / list-row__sub / list-row__action /
 *              field / field__label / field__hint / field__error / field__req /
 *              input / textarea / counter / counter--over / thumb-grid / thumb /
 *              thumb__img / thumb__remove / thumb-add / file-input / tap /
 *              btn / btn--primary / btn--secondary / btn--text / btn--block /
 *              empty / empty__text / skeleton / skeleton--title / skeleton--card /
 *              skeleton--row / loading-text / banner / banner__text / banner__retry /
 *              toast / toast__text / toast--success / toast--danger /
 *              t-note / clamp-1 / clamp-2
 *
 * ponytail: 意図書のとおり「1商品＝1プロジェクト」。Supabase に products 表は無く、
 *           商品情報は a2f58db45_projects の行そのもの（product_name / price /
 *           product_features / target_audience / image_urls）に入る。
 *           1プロジェクトに複数商品を持たせるなら、まず表を足すこと。
 *
 * 無い関数は黙って飛ばさない。何が無いのかを console.error に必ず残す。
 * ============================================================ */

(function (window, document) {
  'use strict';

  var App = window.App = window.App || {};

  /* ---------- 依存の確認 ---------- */
  if (typeof App.registerScreen !== 'function') {
    console.error('[screens-project] App.registerScreen が見つかりません。index.html の読み込み順（app.js -> screens-project.js）を確認してください。登録内容は window.App.screens に控えます。');
    App.screens = App.screens || {};
    App.registerScreen = function (id, spec) {
      if (!spec || typeof spec.render !== 'function') {
        console.error('[screens-project] registerScreen の第2引数は { render: 関数 } である必要があります。画面ID: ' + id);
        return;
      }
      App.screens[id] = spec;
    };
  }
  if (!window.Api) {
    console.error('[screens-project] window.Api が見つかりません。api.js が読み込まれているか確認してください。プロジェクト詳細と商品登録は動きません。');
  }
  if (!window.I18N || typeof window.I18N.t !== 'function') {
    console.error('[screens-project] window.I18N.t が見つかりません。i18n.js が読み込まれているか確認してください。翻訳キーをそのまま表示します。');
  }

  /* ---------- 定数 ---------- */
  var MAX_IMAGES = 10;              // 商品写真は最大10枚
  var MAX_PRODUCT_NAME = 60;
  var MAX_TARGET = 60;
  var MAX_FEATURES = 300;
  var PROGRESS_STEPS = 3;           // 商品登録・競合LP分析・生成 の3段階で進捗を出す
  var IMAGE_MAX_EDGE = 1600;        // 商品写真は生成LPにもそのまま載せるので長辺1600pxまで残す
  var IMAGE_QUALITY = 0.82;

  /* ---------- 小さな道具 ---------- */
  function t(key, params) {
    if (window.I18N && typeof window.I18N.t === 'function') { return window.I18N.t(key, params); }
    return key;
  }

  /* i18n.js の辞書に無い、このファイルだけの文言。並びは [日本語, English, 한국어] */
  var LOCAL = {
    'local.photoUploading': ['商品写真をアップロードしています…', 'Uploading product photos…', '상품 사진을 업로드하는 중…'],
    'local.photoUploaded': ['商品写真をアップロードしました', 'Product photos uploaded', '상품 사진을 업로드했습니다'],
    'local.photoUploadFailed': ['一部の写真をアップロードできませんでした', 'Some photos could not be uploaded', '일부 사진을 업로드하지 못했습니다']
  };

  function tl(key) {
    var row = LOCAL[key];
    if (!row) { return key; }
    var code = 'ja';
    if (window.I18N && typeof window.I18N.getLocale === 'function') {
      code = String(window.I18N.getLocale() || 'ja');
    }
    var index = code === 'en' ? 1 : (code === 'ko' ? 2 : 0);
    return row[index] || row[0];
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

  function textOf(value) {
    return String(value === undefined || value === null ? '' : value);
  }

  function imagesOf(project) {
    if (!project || !project.image_urls) { return []; }
    if (Object.prototype.toString.call(project.image_urls) === '[object Array]') {
      return project.image_urls.slice(0, MAX_IMAGES);
    }
    console.error('[screens-project] image_urls が配列ではありません。空として扱います。', project.image_urls);
    return [];
  }

  function hasProduct(project) {
    return !!(project && textOf(project.product_name).trim());
  }

  function errorMessage(err, fallbackKey) {
    if (err && err.message) { return String(err.message); }
    return t(fallbackKey || 'common.networkError');
  }

  function apiReady() {
    if (window.Api && window.Api.users && window.Api.projects && window.Api.analysisReports && window.Api.generations) { return true; }
    console.error('[screens-project] window.Api の中身（users / projects / analysisReports / generations）が揃っていません。api.js を確認してください。');
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
    else { console.error('[screens-project] index.html に #header-title がありません。'); }
    if (backNode) { backNode.hidden = !showBack; }
    else { console.error('[screens-project] index.html に #header-back がありません。'); }
    if (actionNode) { clear(actionNode); }
  }

  function toast(message, kind) {
    if (typeof App.toast === 'function') { App.toast(message, kind); return; }
    var root = document.getElementById('toast-root');
    if (!root) {
      console.error('[screens-project] #toast-root が無いため通知を表示できません: ' + message);
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
      console.error('[screens-project] #banner-root が無いため通信失敗を表示できません: ' + message);
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
    var box = el('div', 'empty');
    box.appendChild(el('p', 'empty__text', message));
    box.appendChild(button('btn btn--primary', t('common.retry'), function () {
      clearBanner();
      onRetry();
    }));
    wrap.appendChild(box);
    root.appendChild(wrap);
  }

  /* ---------- 現在のユーザーと選択中プロジェクト ---------- */
  function currentUserId() {
    if (typeof App.getUser === 'function') {
      var current = App.getUser();
      if (current && current.id) { return String(current.id); }
    }
    if (App.state && App.state.user && App.state.user.id) { return String(App.state.user.id); }
    if (window.Api && window.Api.storage) { return window.Api.storage.get('userId'); }
    console.error('[screens-project] 現在のユーザーIDを取得できません（App.getUser も App.state も Api.storage も使えません）。');
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
    if (window.Api && window.Api.storage) { window.Api.storage.set('userId', user.id); }
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

  function selectProject(project) {
    if (!project) { return; }
    if (App.state && typeof App.state === 'object') { App.state.projectId = String(project.id); }
    else { App.state = { projectId: String(project.id) }; }
    if (window.Api && window.Api.storage) { window.Api.storage.set('projectId', project.id); }
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

  /* ---------- 商品写真 ----------
     端末の写真を長辺1600pxへ縮めてから Supabase Storage（公開バケット）へ上げ、
     image_urls には公開URLだけを入れる。
     以前はデータURLを列にそのまま入れていたため、1枚あたり数百KBの文字列が
     業務テーブルに載り、生成LPへ写真を差し込むこともできなかった。 */
  function shrinkImage(file, done) {
    if (!file || String(file.type).indexOf('image/') !== 0) {
      done(new Error('画像ファイルではありません'));
      return;
    }
    if (typeof window.FileReader !== 'function') {
      console.error('[screens-project] この環境には FileReader がありません。画像を追加できません。');
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
          console.error('[screens-project] canvas の 2d コンテキストが取れません。画像を縮小できません。');
          done(new Error('canvas が使えません'));
          return;
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        /* 送るのは Blob。toDataURL だと base64 で約1.37倍に膨らむ */
        if (typeof canvas.toBlob === 'function') {
          canvas.toBlob(function (blob) {
            if (blob) { done(null, blob); }
            else { done(new Error('画像を書き出せませんでした')); }
          }, 'image/jpeg', IMAGE_QUALITY);
          return;
        }
        /* toBlob が無い古い環境向けの保険（データURL→Blob） */
        try {
          var dataUrl = canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
          var binary = window.atob(dataUrl.split(',')[1]);
          var bytes = new window.Uint8Array(binary.length);
          var i;
          for (i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); }
          done(null, new window.Blob([bytes], { type: 'image/jpeg' }));
        } catch (e) {
          done(e);
        }
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  /* 縮小 → アップロード。成功すると公開URLが返る */
  function uploadProductPhoto(file, projectId, done) {
    shrinkImage(file, function (err, blob) {
      if (err) { done(err); return; }
      if (!window.Api || !window.Api.files || typeof window.Api.files.upload !== 'function') {
        console.error('[screens-project] Api.files.upload がありません。api.js を確認してください。');
        done(new Error('Api.files.upload がありません'));
        return;
      }
      window.Api.files.upload(blob, {
        folder: 'products/' + String(projectId || 'draft'),
        ext: 'jpg',
        contentType: 'image/jpeg'
      }).then(function (url) { done(null, url); }, function (uploadErr) { done(uploadErr); });
    });
  }

  /* ============================================================
   * S8 プロジェクト詳細
   *   進捗% ・ 残クレジット ・ 登録済み商品リスト
   *   商品を登録 / 競合LP分析 / 分析レポートを開く / 生成結果を開く / ダッシュボードへ戻る
   * ============================================================ */
  function renderDetail(root, params) {
    mounted = { id: 'S8', root: root, params: params };
    setHeader(t('projectDetail.title'), true);

    var projectId = projectIdFrom(params);
    if (!projectId) {
      console.error('[screens-project] プロジェクトIDが分からないため S3 ダッシュボードへ戻します。');
      go('S3');
      return;
    }

    var data = { user: null, project: null, reports: [], generations: [] };
    var selectedProductId = null;

    function load() {
      clearBanner();
      showSkeleton(root);

      loadUser().then(function (user) {
        data.user = user;
        return Promise.all([
          window.Api.projects.get(projectId),
          window.Api.analysisReports.list({ eq: { projects_id: String(projectId) }, limit: 50 }),
          window.Api.generations.list({ eq: { projects_id: String(projectId) }, limit: 50 })
        ]);
      }).then(function (results) {
        data.project = results[0];
        data.reports = results[1] || [];
        data.generations = results[2] || [];
        selectProject(data.project);
        selectedProductId = hasProduct(data.project) ? String(data.project.id) : null;
        paint();
      }).catch(function (err) {
        if (err && err.code === 'noUser') {
          console.error('[screens-project] ログイン中のユーザーがいないため S1 ログインへ戻します。');
          go('S1');
          return;
        }
        console.error('[screens-project] プロジェクト詳細の読み込みに失敗しました', err);
        showErrorScreen(root, errorMessage(err, 'projectDetail.loadFailed'), load);
      });
    }

    function stepList() {
      return [
        { label: t('projectDetail.registerProduct'), done: hasProduct(data.project) },
        { label: t('analysis.title'), done: data.reports.length > 0 },
        { label: t('generate.title'), done: data.generations.length > 0 }
      ];
    }

    function progressPercent() {
      var done = 0;
      stepList().forEach(function (step) { if (step.done) { done++; } });
      return Math.round((done / PROGRESS_STEPS) * 100);
    }

    function countsLine() {
      var productCount = hasProduct(data.project) ? 1 : 0;
      return [
        t('projectOps.productCount') + ' ' + formatNumber(productCount),
        t('projectOps.reportCount') + ' ' + formatNumber(data.reports.length),
        t('generate.title') + ' ' + formatNumber(data.generations.length)
      ].join(' · ');
    }

    function openAnalysis() {
      if (!hasProduct(data.project)) {
        toast(t('projectDetail.emptyProducts'), 'danger');
        return;
      }
      if (!selectedProductId) {
        toast(t('projectDetail.selectProductFirst'), 'danger');
        return;
      }
      go('S10', { id: projectId });
    }

    function openReport() {
      if (!data.reports.length) {
        toast(t('report.empty'), 'danger');
        return;
      }
      go('S11', { id: projectId, reportId: data.reports[0].id });
    }

    function openGeneration() {
      if (!data.generations.length) {
        toast(t('generate.empty'), 'danger');
        return;
      }
      go('S13', { id: projectId, generationId: data.generations[0].id });
    }

    function productRow() {
      var project = data.project;
      var images = imagesOf(project);
      var selected = selectedProductId === String(project.id);

      var row = button('list-row' + (selected ? ' list-row--selected' : ''), null, function () {
        selectedProductId = selected ? null : String(project.id);
        paint();
      });
      row.setAttribute('aria-pressed', selected ? 'true' : 'false');

      if (images.length) {
        var thumb = el('img', 'list-row__thumb');
        thumb.src = images[0];
        thumb.alt = '';
        row.appendChild(thumb);
      }

      var body = el('span', 'list-row__body');
      body.appendChild(el('span', 'list-row__title clamp-2', textOf(project.product_name)));

      var subParts = [];
      if (project.price !== null && project.price !== undefined && project.price !== '') {
        subParts.push(formatYen(project.price));
      }
      if (textOf(project.target_audience).trim()) {
        subParts.push(textOf(project.target_audience).trim());
      }
      if (images.length) {
        subParts.push(t('product.images') + ' ' + formatNumber(images.length));
      }
      if (subParts.length) {
        body.appendChild(el('span', 'list-row__sub clamp-1', subParts.join(' · ')));
      }
      row.appendChild(body);

      row.appendChild(el('span', 'list-row__action', selected ? t('common.confirm') : t('common.edit')));
      return row;
    }

    function paint() {
      clearBanner();
      clear(root);

      var screen = el('div', 'screen');

      /* 見出し（プロジェクト名と件数） */
      var head = el('header', 'screen__head');
      head.appendChild(el('h2', 'screen__title', textOf(data.project.project_name) || t('common.empty')));
      head.appendChild(el('p', 'screen__lead', countsLine()));
      screen.appendChild(head);

      /* 進捗 */
      var percent = progressPercent();
      var progressCard = el('div', 'card card--soft');
      var progressHead = el('div', 'card__foot');
      progressHead.style.borderTop = '0';
      progressHead.style.paddingTop = '0';
      progressHead.appendChild(el('span', 'card__label', t('projectDetail.progress')));
      var progressValue = el('span');
      progressValue.appendChild(el('span', 'card__value', formatNumber(percent)));
      progressValue.appendChild(el('span', 'card__unit', '%'));
      progressHead.appendChild(progressValue);
      progressCard.appendChild(progressHead);

      var track = el('div', 'progress');
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', '100');
      track.setAttribute('aria-valuenow', String(percent));
      track.setAttribute('aria-label', t('projectDetail.progress'));
      var bar = el('div', 'progress__bar');
      bar.style.width = percent + '%';
      track.appendChild(bar);
      progressCard.appendChild(track);

      var stepChips = el('div', 'chips');
      stepList().forEach(function (step) {
        stepChips.appendChild(el('span', 'chip ' + (step.done ? 'chip--selected' : 'chip--mute'), step.label));
      });
      progressCard.appendChild(stepChips);

      if (data.project.created_at) {
        progressCard.appendChild(el('span', 'progress__label', t('projectOps.createdAt') + ' ' + formatDate(data.project.created_at)));
      }
      screen.appendChild(progressCard);

      /* 残クレジット（タップで S17 クレジットへ） */
      var balance = Number(data.user.credit_balance) || 0;
      var balanceCard = el('button', 'card card--gradient');
      balanceCard.type = 'button';
      balanceCard.appendChild(el('span', 'card__label', t('projectDetail.remainingCredit')));
      var balanceValue = el('span');
      balanceValue.appendChild(el('span', 'card__value', formatNumber(balance)));
      balanceValue.appendChild(el('span', 'card__unit', t('common.creditUnit')));
      balanceCard.appendChild(balanceValue);
      if (data.user.unlimited_until) {
        balanceCard.appendChild(el('span', 'card__sub', t('credit.expiry') + ' ' + formatDate(data.user.unlimited_until)));
      }
      balanceCard.addEventListener('click', function () { go('S17'); });
      screen.appendChild(balanceCard);

      /* 登録済み商品 */
      var section = el('section', 'section');
      var sectionHead = el('div', 'section__head');
      sectionHead.appendChild(el('h3', 'section__title', t('projectDetail.registeredProducts')));
      sectionHead.appendChild(el('span', 't-note', formatNumber(hasProduct(data.project) ? 1 : 0) + t('dashboard.countUnit')));
      section.appendChild(sectionHead);

      if (hasProduct(data.project)) {
        var list = el('div', 'list');
        list.appendChild(productRow());
        section.appendChild(list);
      } else {
        var empty = el('div', 'empty');
        empty.appendChild(el('p', 'empty__text', t('projectDetail.emptyProducts')));
        empty.appendChild(button('btn btn--primary', t('projectDetail.registerProduct'), function () {
          go('S9', { id: projectId });
        }));
        section.appendChild(empty);
      }
      screen.appendChild(section);

      /* 商品を登録 / 競合LP分析（スケッチのとおり横並び） */
      var mainRow = el('div', 'btn-row');
      mainRow.appendChild(button('btn btn--primary', t('projectDetail.registerProduct'), function () {
        go('S9', { id: projectId });
      }));
      mainRow.appendChild(button('btn btn--secondary', t('projectDetail.startAnalysis'), openAnalysis));
      screen.appendChild(mainRow);

      /* 保存済みのものを開く / ダッシュボードへ戻る */
      var links = el('div', 'stack');
      links.appendChild(button('btn btn--secondary btn--block', t('projectDetail.openReport'), openReport));
      links.appendChild(button('btn btn--secondary btn--block', t('projectDetail.openGeneration'), openGeneration));
      links.appendChild(button('btn btn--text btn--block', t('projectDetail.backToDashboard'), function () {
        go('S3');
      }));
      screen.appendChild(links);

      root.appendChild(screen);
    }

    load();
  }

  /* ============================================================
   * S9 商品登録
   *   商品写真を追加（最大10枚サムネイル）・商品名・価格・ターゲット層・商品の特徴
   *   「保存して分析へ」→ S10 競合分析 ／ 「下書き保存」→ S8 プロジェクト詳細
   * ============================================================ */
  function renderProductForm(root, params) {
    mounted = { id: 'S9', root: root, params: params };
    setHeader(t('productForm.title'), true);

    var projectId = projectIdFrom(params);
    if (!projectId) {
      console.error('[screens-project] プロジェクトIDが分からないため S3 ダッシュボードへ戻します。');
      go('S3');
      return;
    }

    var project = null;
    var form = { name: '', price: '', target: '', features: '', images: [] };
    var touched = false;
    var busy = false;

    /* 描き直しのたびに入れ替える部品の控え */
    var nameError = null;
    var priceError = null;
    var featuresError = null;
    var featuresCounter = null;
    var imagesHost = null;
    var saveButton = null;
    var draftButton = null;

    function load() {
      clearBanner();
      showSkeleton(root);

      loadUser().then(function () {
        return window.Api.projects.get(projectId);
      }).then(function (loaded) {
        project = loaded;
        selectProject(project);
        form.name = textOf(project.product_name) || textOf(project.project_name);
        form.price = (project.price === null || project.price === undefined || project.price === '') ? '' : formatNumber(project.price);
        form.target = textOf(project.target_audience);
        form.features = textOf(project.product_features);
        form.images = imagesOf(project);
        paint();
      }).catch(function (err) {
        if (err && err.code === 'noUser') {
          console.error('[screens-project] ログイン中のユーザーがいないため S1 ログインへ戻します。');
          go('S1');
          return;
        }
        console.error('[screens-project] 商品登録画面の読み込みに失敗しました', err);
        showErrorScreen(root, errorMessage(err, 'projectDetail.loadFailed'), load);
      });
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
      head.appendChild(el('h2', 'screen__title', t('productForm.title')));
      head.appendChild(el('p', 'screen__lead', textOf(project.project_name)));
      screen.appendChild(head);

      /* 商品写真を追加（最大10枚） */
      var photoField = el('div', 'field');
      photoField.appendChild(el('span', 'field__label', t('productForm.addPhoto')));
      imagesHost = el('div', 'thumb-grid');
      photoField.appendChild(imagesHost);
      photoField.appendChild(el('p', 'field__hint', t('productForm.photoMax')));
      screen.appendChild(photoField);

      /* 入力欄 */
      var fields = el('div', 'stack');

      /* 商品名 */
      var nameInput = el('input', 'input');
      nameInput.id = 'product-name';
      nameInput.type = 'text';
      nameInput.maxLength = MAX_PRODUCT_NAME;
      nameInput.value = form.name;
      nameInput.setAttribute('placeholder', t('productForm.name'));
      nameInput.addEventListener('input', function () {
        form.name = nameInput.value;
        validate();
      });
      nameInput.addEventListener('blur', function () {
        touched = true;
        validate();
      });
      var nameField = makeField(t('productForm.name'), nameInput, { required: true });
      nameError = nameField.error;
      fields.appendChild(nameField.wrap);

      /* 価格 / ターゲット層（スケッチのとおり横並び） */
      var pair = el('div', 'row--2');

      var priceInput = el('input', 'input');
      priceInput.id = 'product-price';
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
      var priceField = makeField(t('product.price'), priceInput, { hint: t('common.yen') });
      priceError = priceField.error;
      pair.appendChild(priceField.wrap);

      var targetInput = el('input', 'input');
      targetInput.id = 'product-target';
      targetInput.type = 'text';
      targetInput.maxLength = MAX_TARGET;
      targetInput.value = form.target;
      targetInput.setAttribute('placeholder', t('product.target'));
      targetInput.addEventListener('input', function () {
        form.target = targetInput.value;
      });
      var targetField = makeField(t('product.target'), targetInput, { hint: t('common.optional') });
      pair.appendChild(targetField.wrap);

      fields.appendChild(pair);

      /* 商品の特徴 */
      var featuresInput = el('textarea', 'textarea');
      featuresInput.id = 'product-features';
      featuresInput.maxLength = MAX_FEATURES;
      featuresInput.value = form.features;
      featuresInput.rows = 4;
      featuresInput.setAttribute('placeholder', t('product.features'));
      featuresCounter = el('span', 'counter', form.features.length + ' / ' + MAX_FEATURES);
      featuresInput.addEventListener('input', function () {
        form.features = featuresInput.value;
        validate();
      });
      var featuresField = makeField(t('product.features'), featuresInput, {
        counter: featuresCounter,
        hint: t('product.featuresMax')
      });
      featuresError = featuresField.error;
      fields.appendChild(featuresField.wrap);

      screen.appendChild(fields);

      /* 保存して分析へ / 下書き保存（スケッチのとおり横並び） */
      var actions = el('div', 'btn-row');
      saveButton = button('btn btn--primary', t('productForm.saveAndAnalyze'), function () { submit('analyze'); });
      draftButton = button('btn btn--secondary', t('productForm.saveDraft'), function () { submit('draft'); });
      actions.appendChild(saveButton);
      actions.appendChild(draftButton);
      screen.appendChild(actions);

      root.appendChild(screen);

      paintImages();
      validate();
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
          var removed = form.images.splice(index, 1)[0];
          paintImages();
          /* Storage の実体も消す（消し損ねてもフォームは進むので待たない）。
             データURL時代の写真はファイルが無いので remove 側が黙って無視する */
          if (window.Api && window.Api.files && typeof window.Api.files.remove === 'function') {
            window.Api.files.remove(removed).catch(function (err) {
              console.error('[screens-project] 商品写真の実体を削除できませんでした（画面からは外しています）', err);
            });
          }
        });
        remove.setAttribute('aria-label', t('common.delete'));
        cell.appendChild(remove);
        imagesHost.appendChild(cell);
      });

      if (form.images.length < MAX_IMAGES) {
        var picker = el('label', 'thumb-add tap');
        picker.appendChild(el('span', null, '＋'));
        picker.appendChild(el('span', null, t('common.add')));
        var fileInput = el('input', 'file-input');
        fileInput.type = 'file';
        fileInput.id = 'product-images';
        fileInput.accept = 'image/*';
        fileInput.multiple = true;
        picker.setAttribute('for', fileInput.id);
        fileInput.addEventListener('change', function () {
          addFiles(fileInput.files);
          fileInput.value = '';
        });
        picker.appendChild(fileInput);
        imagesHost.appendChild(picker);
      }
    }

    function addFiles(files) {
      if (!files || !files.length) { return; }
      var slots = MAX_IMAGES - form.images.length;
      if (slots <= 0) {
        toast(t('productForm.photoMax'), 'danger');
        return;
      }
      var picked = [];
      var i;
      for (i = 0; i < files.length && picked.length < slots; i++) { picked.push(files[i]); }
      if (files.length > slots) { toast(t('productForm.photoMax'), 'danger'); }

      var pending = picked.length;
      if (!pending) { return; }

      var failed = 0;
      toast(tl('local.photoUploading'), 'info');

      picked.forEach(function (file) {
        uploadProductPhoto(file, projectIdFrom(params), function (err, url) {
          pending--;
          if (err) {
            failed += 1;
            console.error('[screens-project] 商品写真をアップロードできませんでした: ' + (file && file.name ? file.name : ''), err);
          } else {
            form.images.push(url);
          }
          if (pending === 0) {
            paintImages();
            if (failed) { toast(tl('local.photoUploadFailed'), 'danger'); }
            else { toast(tl('local.photoUploaded'), 'success'); }
          }
        });
      });
    }

    function priceValue() {
      var digits = digitsOf(form.price);
      if (!digits) { return null; }
      return Number(digits);
    }

    function validate() {
      var name = form.name.trim();
      var digits = digitsOf(form.price);
      var nameOk = name.length > 0 && name.length <= MAX_PRODUCT_NAME;
      var priceOk = !digits || isDigits(digits);
      var featuresOk = form.features.length <= MAX_FEATURES;

      if (nameError) {
        if (!nameOk && touched) {
          nameError.textContent = name.length > MAX_PRODUCT_NAME
            ? t('validation.maxLength', { max: MAX_PRODUCT_NAME })
            : t('productForm.nameRequired');
        } else {
          nameError.textContent = '';
        }
      }
      if (priceError) {
        priceError.textContent = priceOk ? '' : t('product.priceInvalid');
      }
      if (featuresError) {
        featuresError.textContent = featuresOk ? '' : t('validation.maxLength', { max: MAX_FEATURES });
      }
      if (featuresCounter) {
        featuresCounter.textContent = form.features.length + ' / ' + MAX_FEATURES;
        featuresCounter.className = featuresOk ? 'counter' : 'counter counter--over';
      }

      var ok = nameOk && priceOk && featuresOk;
      setDisabled(busy || !ok);
      return ok;
    }

    function setDisabled(off) {
      [saveButton, draftButton].forEach(function (node) {
        if (!node) { return; }
        node.disabled = off;
        node.setAttribute('aria-disabled', off ? 'true' : 'false');
      });
    }

    function setBusy(on) {
      busy = on;
      setDisabled(on);
      if (saveButton) {
        saveButton.textContent = on ? t('common.loading') : t('productForm.saveAndAnalyze');
      }
    }

    /*
     * 保存先は a2f58db45_projects の同じ行（1商品＝1プロジェクト）。
     * ponytail: 「下書き」を区別する列が projects に無いため、下書き保存も同じ行を更新し、
     *           分析へ進まずプロジェクト詳細へ戻ることで区別する。状態を持たせるなら列を足すこと。
     */
    function submit(mode) {
      if (busy) { return; }
      touched = true;
      if (!validate()) {
        toast(t('productForm.nameRequired'), 'danger');
        return;
      }
      if (!apiReady()) {
        toast(t('common.error'), 'danger');
        return;
      }

      setBusy(true);
      clearBanner();

      window.Api.projects.update(projectId, {
        product_name: form.name.trim(),
        price: priceValue(),
        product_features: form.features.trim() || null,
        target_audience: form.target.trim() || null,
        image_urls: form.images.slice()
      }).then(function (updated) {
        project = updated;
        selectProject(updated);
        toast(t('common.saved'), 'success');
        if (mode === 'analyze') { go('S10', { id: projectId }); }
        else { go('S8', { id: projectId }); }
      }).catch(function (err) {
        setBusy(false);
        validate();
        console.error('[screens-project] 商品情報の保存に失敗しました', err);
        var message = errorMessage(err, 'productForm.saveFailed');
        showBanner(message, function () { submit(mode); });
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
    if (mounted.id === 'S8') { renderDetail(mounted.root, mounted.params); }
    if (mounted.id === 'S9') { renderProductForm(mounted.root, mounted.params); }
  });

  /* ---------- 画面登録（第2引数は必ず { render: 関数 }） ---------- */
  App.registerScreen('S8', {
    render: function (root, params) { renderDetail(root, params); }
  });

  App.registerScreen('S9', {
    render: function (root, params) { renderProductForm(root, params); }
  });

})(window, document);
