/*!
 * screens-project-ops.js — エルピーヤ
 * S5 プロジェクト操作メニュー / S6 プロジェクト名変更 / S7 プロジェクト削除確認 の3画面だけを担当する。
 *
 * ---- 他ファイルとの約束（この綴りのまま使う。似た名前を作らない）----
 * 画面登録は index.html の契約どおり1形式だけ:
 *   App.registerScreen('S5', { render: function (root, params) { ... } });
 *   第2引数は必ず { render: 関数 } オブジェクト。関数をそのまま渡さない。
 *   app.js 側は spec.render(root, params) で呼ぶ。
 *   window.renderXxx / window.Screens.Xxx などの別方式は混ぜない。
 *
 * 画面遷移は index.html に書かれたハッシュ経路をそのまま使う（app.js の関数名を推測しない）:
 *   location.hash = '#/S3' / '#/S5?id=xxx' / '#/S6?id=xxx' / '#/S7?id=xxx'
 *
 * i18n.js が実際に公開している名前だけを使う:
 *   window.t(key, params) / window.I18N.getLocale() / イベント 'elpiya:locale-changed'
 *   この3画面の文言は i18n.js の projectOps.* / projectRename.* / projectDelete.* /
 *   project.* / projectDetail.* / dashboard.* / common.* を使う。
 *   i18n.js に無い言い回し（複製名の接尾辞・相対時刻・入力ヒントなど）だけ、
 *   このファイルの LOCAL に ja / en / ko の3言語で持ち、ops. で始まるキーにする。
 *
 * api.js（window.Api）から使う名前は api.js が実際に公開しているものだけ:
 *   Api.projects.get(id) / .list(options) / .insert(row) / .update(id, patch) / .remove(id)
 *   Api.analysisReports.list(options) / .count(options) / .remove(id)
 *   Api.generations.list(options) / .count(options) / .remove(id)
 *   Api.storage.get('userId'|'projectId') / .set(名前, 値) / .remove(名前)
 *   失敗時の reject は必ず ApiError（err.code と err.message を持つ）。
 *
 * app.js に任意で置ける窓口（無ければ何が無いかをコンソールに残したうえで、
 * このファイル側の予備実装で必ず動かす。黙って握りつぶさない）:
 *   App.setHeader({ title, back })    … 共通ヘッダー
 *   App.setTabbarVisible(真偽値)      … 下部タブバーの出し分け（S6・S7 では隠す）
 *   App.toast(文言, 種類)             … トースト
 *   App.currentUser                   … 現在ユーザー（無ければ Api.storage.get('userId')）
 *
 * このファイルが触る class は styles.css に実在するものだけ:
 *   screen / section / section__head / section__title
 *   stack / stack--tight / stack--group / row / row--between / btn-row / btn-row--1
 *   card / card__label / card__value / card__sub
 *   info-list / info-row / info-row__key / info-row__val
 *   list / list-row / list-row__body / list-row__title / list-row__meta
 *   field / field__label / field__hint / field__error / input / input--error / counter / counter--over
 *   btn / btn--primary / btn--secondary / btn--danger / btn--text / btn--block
 *   thumb-grid / thumb / thumb__img / note-box / warn-box
 *   empty / empty__text / banner / banner__text / banner__retry / banner__close
 *   toast / toast__text / toast--success / toast--danger
 *   modal / modal__title / modal__body / modal__actions
 *   skeleton / skeleton--title / skeleton--card / skeleton--row / loading-text
 *   clamp-1 / clamp-2 / t-sub / t-note / app-shell--no-tabbar
 * 触る id は index.html にあるものだけ:
 *   header-title / header-back / tabbar / banner-root / toast-root / modal-root
 *
 * ログイン機能は未実装で、業務データは共有の Supabase に入る。
 * このアプリを開いた全員が同じプロジェクトを見る（注意書きは index.html の #shared-data-notice）。
 */
(function (window, document) {
  'use strict';

  var App = window.App;
  if (!App || typeof App.registerScreen !== 'function') {
    console.error('[screens-project-ops.js] App.registerScreen(画面ID, { render: 関数 }) が見つかりません。index.html の読み込み順（app.js → screens-project-ops.js）を確認してください。S5・S6・S7 は描画されません。');
    return;
  }

  var Api = window.Api;
  if (!Api || !Api.projects || !Api.analysisReports || !Api.generations || !Api.storage) {
    console.error('[screens-project-ops.js] window.Api（api.js）が見つからないか、Api.projects / Api.analysisReports / Api.generations / Api.storage がありません。api.js が screens-project-ops.js より先に読み込まれているか確認してください。');
  }

  var MAX_NAME = 30;           // プロジェクト名の上限（全角30文字）
  var RELATED_LIMIT = 500;     // 削除時にまとめて消す関連行の上限
  var LOCALES = ['ja', 'en', 'ko'];

  /* =========================================================
     1. 文言
     画面に出る文字（ボタン・検証・空状態・通知）はすべて辞書経由にする。
     i18n.js にあるキーは i18n.js を使い、無い言い回しだけ LOCAL に置く。
     ========================================================= */

  var LOCAL = {
    // [ja, en, ko]
    'ops.untitled': ['名称未設定', 'Untitled', '이름 없음'],
    'ops.copySuffix': ['のコピー', ' (copy)', ' 사본'],
    'ops.duplicating': ['複製中…', 'Duplicating…', '복제 중…'],
    'ops.saving': ['保存中…', 'Saving…', '저장 중…'],
    'ops.deleting': ['削除中…', 'Deleting…', '삭제 중…'],
    'ops.noProject': ['プロジェクトが選択されていません', 'No project is selected', '선택된 프로젝트가 없습니다'],
    'ops.notFound': ['このプロジェクトは見つかりませんでした。すでに削除された可能性があります', 'This project could not be found. It may have already been deleted.', '이 프로젝트를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다'],
    'ops.noImage': ['商品画像はまだ登録されていません', 'No product images registered yet', '아직 등록된 상품 이미지가 없습니다'],
    'ops.recentEmpty': ['最近使った名前はまだありません', 'No recently used names yet', '최근 사용한 이름이 아직 없습니다'],
    'ops.useThisName': ['使う', 'Use', '사용'],
    'ops.deleteHint': ['削除するには「{name}」と入力してください', 'Type “{name}” exactly to enable the delete button', '삭제하려면 “{name}”을(를) 그대로 입력해 주세요'],
    'ops.justNow': ['たった今', 'Just now', '방금 전'],
    'ops.minutesAgo': ['{n}分前', '{n} minutes ago', '{n}분 전'],
    'ops.hoursAgo': ['{n}時間前', '{n} hours ago', '{n}시간 전'],
    'ops.daysAgo': ['{n}日前', '{n} days ago', '{n}일 전'],
    'ops.unknownDate': ['不明', 'Unknown', '알 수 없음'],
    'ops.apiMissing': ['アプリの読み込みに失敗しました。ページを再読み込みしてください', 'The app failed to load. Please reload the page.', '앱을 불러오지 못했습니다. 페이지를 새로고침해 주세요'],
    'ops.reload': ['再読み込み', 'Reload', '새로고침'],
    'ops.duplicateRunning': ['プロジェクトを複製しています…', 'Duplicating the project…', '프로젝트를 복제하는 중…']
  };

  function currentLocale() {
    var I18N = window.I18N;
    if (I18N && typeof I18N.getLocale === 'function') {
      var code = I18N.getLocale();
      if (LOCALES.indexOf(code) !== -1) { return code; }
    }
    return 'ja';
  }

  var i18nMissingReported = false;

  function fill(text, params) {
    if (!params) { return text; }
    var out = text;
    Object.keys(params).forEach(function (key) {
      out = out.split('{' + key + '}').join(String(params[key]));
    });
    return out;
  }

  function t(key, params) {
    if (key.indexOf('ops.') === 0) {
      var row = LOCAL[key];
      if (!row) {
        console.error('[screens-project-ops.js] このファイルの文言表に ' + key + ' がありません。キーをそのまま表示します。');
        return key;
      }
      var index = LOCALES.indexOf(currentLocale());
      return fill(row[index === -1 ? 0 : index] || row[0], params);
    }
    if (typeof window.t === 'function') {
      return window.t(key, params);
    }
    if (!i18nMissingReported) {
      i18nMissingReported = true;
      console.error('[screens-project-ops.js] window.t（i18n.js）が見つかりません。index.html で i18n.js が読み込まれているか確認してください。翻訳キーがそのまま表示されます。');
    }
    return key;
  }

  /* =========================================================
     2. 小さな道具
     ========================================================= */

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  function btn(cls, label, onClick) {
    var node = el('button', cls, label);
    node.type = 'button';
    if (onClick) { node.addEventListener('click', onClick); }
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) { node.removeChild(node.firstChild); }
  }

  function trimmed(value) {
    if (value === undefined || value === null) { return ''; }
    return String(value).trim();
  }

  function charLength(value) {
    var str = String(value === undefined || value === null ? '' : value);
    if (typeof Array.from === 'function') { return Array.from(str).length; }
    return str.length;
  }

  function sliceChars(value, count) {
    var str = String(value === undefined || value === null ? '' : value);
    if (count <= 0) { return ''; }
    if (typeof Array.from === 'function') { return Array.from(str).slice(0, count).join(''); }
    return str.slice(0, count);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function parseDate(value) {
    if (!value) { return null; }
    var d = new Date(String(value));
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDate(value) {
    var d = parseDate(value);
    if (!d) { return t('ops.unknownDate'); }
    return d.getFullYear() + '/' + pad2(d.getMonth() + 1) + '/' + pad2(d.getDate());
  }

  function relativeTime(value) {
    var d = parseDate(value);
    if (!d) { return t('ops.unknownDate'); }
    var diff = new Date().getTime() - d.getTime();
    if (diff < 0) { diff = 0; }
    var minutes = Math.floor(diff / 60000);
    if (minutes < 1) { return t('ops.justNow'); }
    if (minutes < 60) { return t('ops.minutesAgo', { n: minutes }); }
    var hours = Math.floor(minutes / 60);
    if (hours < 24) { return t('ops.hoursAgo', { n: hours }); }
    var days = Math.floor(hours / 24);
    if (days < 30) { return t('ops.daysAgo', { n: days }); }
    return formatDate(value);
  }

  // 「3件」「3 items」「3건」。英語だけ数と単位の間に空白を入れる。
  function countLabel(n) {
    var unit = t('dashboard.countUnit');
    return String(n) + (currentLocale() === 'en' ? ' ' : '') + unit;
  }

  var reported = {};
  function report(name, note) {
    if (reported[name]) { return; }
    reported[name] = true;
    console.warn('[screens-project-ops.js] app.js に ' + name + ' がありません。' + note);
  }

  /* ---------- 共通シェル（ヘッダー・タブバー・トースト・バナー・モーダル） ---------- */

  var fallbackBackBound = false;

  function setHeader(title, back) {
    if (typeof App.setHeader === 'function') {
      App.setHeader({ title: title, back: back });
      return;
    }
    report('App.setHeader({ title, back })', 'index.html の #header-title / #header-back を直接更新します。');
    var titleNode = document.getElementById('header-title');
    if (titleNode) { titleNode.textContent = title; }
    var backNode = document.getElementById('header-back');
    if (backNode) {
      backNode.hidden = !back;
      if (!fallbackBackBound) {
        fallbackBackBound = true;
        backNode.addEventListener('click', function () { window.history.back(); });
      }
    }
  }

  function setTabbar(visible) {
    if (typeof App.setTabbarVisible === 'function') {
      App.setTabbarVisible(visible);
      return;
    }
    report('App.setTabbarVisible(真偽値)', 'このファイル側で #tabbar の hidden と .app-shell--no-tabbar を切り替えます。');
    var tabbar = document.getElementById('tabbar');
    if (tabbar) { tabbar.hidden = !visible; }
    var shell = document.querySelector('.app-shell');
    if (shell) {
      if (visible) { shell.classList.remove('app-shell--no-tabbar'); }
      else { shell.classList.add('app-shell--no-tabbar'); }
    }
  }

  function toast(message, kind) {
    if (typeof App.toast === 'function') {
      App.toast(message, kind);
      return;
    }
    report('App.toast(文言, 種類)', 'このファイル側の予備トーストを #toast-root に表示します。');
    var host = document.getElementById('toast-root');
    if (!host) {
      console.warn('[screens-project-ops.js] #toast-root が見つかりません。トーストを表示できません: ' + message);
      return;
    }
    var cls = 'toast';
    if (kind === 'success') { cls = 'toast toast--success'; }
    if (kind === 'danger') { cls = 'toast toast--danger'; }
    var box = el('div', cls);
    box.appendChild(el('span', 'toast__text', message));
    host.appendChild(box);
    window.setTimeout(function () {
      if (box.parentNode) { box.parentNode.removeChild(box); }
    }, 3400);
  }

  function clearBanner() {
    var host = document.getElementById('banner-root');
    if (host) { clear(host); }
  }

  function showBanner(message, onRetry) {
    var host = document.getElementById('banner-root');
    if (!host) {
      console.warn('[screens-project-ops.js] #banner-root が見つかりません。エラーバナーを表示できません: ' + message);
      return;
    }
    clear(host);
    var box = el('div', 'banner');
    box.setAttribute('role', 'alert');
    box.appendChild(el('span', 'banner__text', message));
    if (onRetry) {
      box.appendChild(btn('banner__retry', t('common.retry'), function () {
        clearBanner();
        onRetry();
      }));
    }
    var close = btn('banner__close', '×', function () { clearBanner(); });
    close.setAttribute('aria-label', t('common.close'));
    box.appendChild(close);
    host.appendChild(box);
  }

  // 確認モーダル。app.js に共通モーダルがあるかは分からないので、
  // このファイルは #modal-root に自前で描く（index.html にある置き場だけを使う）。
  function confirmDialog(options) {
    var opts = options || {};
    return new Promise(function (resolve) {
      var host = document.getElementById('modal-root');
      if (!host) {
        console.error('[screens-project-ops.js] #modal-root が見つかりません。ブラウザ標準の確認ダイアログで代用します。');
        resolve(window.confirm(opts.title + ' / ' + (opts.body || '')));
        return;
      }
      var closed = false;

      function finish(result) {
        if (closed) { return; }
        closed = true;
        document.removeEventListener('keydown', onKeyDown, true);
        host.removeEventListener('click', onBackdrop);
        clear(host);
        host.hidden = true;
        resolve(result);
      }

      function onKeyDown(event) {
        if (event.key === 'Escape' || event.key === 'Esc') { finish(false); }
      }

      function onBackdrop(event) {
        if (event.target === host) { finish(false); }
      }

      clear(host);
      host.hidden = false;
      var modal = el('div', 'modal');
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.appendChild(el('h2', 'modal__title', opts.title || t('common.confirm')));
      if (opts.body) { modal.appendChild(el('p', 'modal__body', opts.body)); }
      if (opts.note) { modal.appendChild(el('p', 'modal__note', opts.note)); }
      var actions = el('div', 'modal__actions');
      var cancelBtn = btn('btn btn--secondary btn--block', opts.cancelText || t('common.cancel'), function () { finish(false); });
      var okCls = opts.danger ? 'btn btn--danger btn--block' : 'btn btn--primary btn--block';
      var okBtn = btn(okCls, opts.confirmText || t('common.ok'), function () { finish(true); });
      actions.appendChild(cancelBtn);
      actions.appendChild(okBtn);
      modal.appendChild(actions);
      host.appendChild(modal);
      host.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKeyDown, true);
      try { cancelBtn.focus(); } catch (e) { /* フォーカスできない環境は無視してよい */ }
    });
  }

  function askDiscard() {
    return confirmDialog({
      title: t('common.unsavedTitle'),
      body: t('common.unsavedBody'),
      confirmText: t('common.discard'),
      cancelText: t('common.keepEditing'),
      danger: true
    });
  }

  /* ---------- 遷移とパラメータ ---------- */

  function goTo(hash) {
    window.location.hash = hash;
  }

  function opsHash(id) { return '#/S5?id=' + encodeURIComponent(id); }
  function renameHash(id) { return '#/S6?id=' + encodeURIComponent(id); }
  function deleteHash(id) { return '#/S7?id=' + encodeURIComponent(id); }

  function screenParams(params) {
    var out = {};
    var hash = String(window.location.hash || '');
    var q = hash.indexOf('?');
    if (q !== -1) {
      hash.slice(q + 1).split('&').forEach(function (pair) {
        if (!pair) { return; }
        var eq = pair.indexOf('=');
        var key = eq === -1 ? pair : pair.slice(0, eq);
        var value = eq === -1 ? '' : pair.slice(eq + 1);
        try {
          out[decodeURIComponent(key)] = decodeURIComponent(value);
        } catch (e) {
          out[key] = value;
        }
      });
    }
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(function (key) {
        var value = params[key];
        if (value !== undefined && value !== null && value !== '') { out[key] = value; }
      });
    }
    return out;
  }

  function projectIdOf(p) {
    var id = p.id || p.projectId || null;
    if (!id && Api && Api.storage) { id = Api.storage.get('projectId'); }
    return id ? String(id) : null;
  }

  function currentUserId() {
    if (App.currentUser && App.currentUser.id) { return String(App.currentUser.id); }
    if (Api && Api.storage) {
      var stored = Api.storage.get('userId');
      if (stored) { return String(stored); }
    }
    return null;
  }

  // ログインが無い間は users_id が取れないことがある。その場合は絞り込まない。
  function ownerEq() {
    var uid = currentUserId();
    return uid ? { users_id: uid } : {};
  }

  /* ---------- データ ---------- */

  function apiReady() {
    return !!(Api && Api.projects && Api.analysisReports && Api.generations && Api.storage);
  }

  // 1商品＝1プロジェクト（a2f58db45_projects が商品情報そのものを持つ）ので、
  // 登録商品数は「商品名が入っていれば1件」で数える。
  function productCountOf(project) {
    return project && trimmed(project.product_name) !== '' ? 1 : 0;
  }

  function imageList(value) {
    var out = [];
    if (!value) { return out; }
    var raw = value;
    if (typeof raw === 'string') {
      var text = trimmed(raw);
      if (!text) { return out; }
      if (text.indexOf('[') === 0) {
        try { raw = JSON.parse(text); } catch (e) { return [text]; }
      } else {
        return [text];
      }
    }
    if (Object.prototype.toString.call(raw) !== '[object Array]') { return out; }
    raw.forEach(function (item) {
      if (!item) { return; }
      if (typeof item === 'string') { out.push(item); return; }
      if (item.url) { out.push(String(item.url)); return; }
      if (item.src) { out.push(String(item.src)); }
    });
    return out;
  }

  function loadOverview(id) {
    return Api.projects.get(id).then(function (project) {
      return Promise.all([
        Api.analysisReports.count({ eq: { projects_id: id } }),
        Api.generations.count({ eq: { projects_id: id } })
      ]).then(function (counts) {
        return {
          project: project,
          products: productCountOf(project),
          reports: counts[0],
          generations: counts[1]
        };
      });
    });
  }

  function listProjectNames(excludeId) {
    return Api.projects.list({ select: 'id,project_name', eq: ownerEq(), limit: 200 }).then(function (rows) {
      var names = [];
      rows.forEach(function (row) {
        if (excludeId && String(row.id) === String(excludeId)) { return; }
        var name = trimmed(row.project_name);
        if (name) { names.push(name); }
      });
      return names;
    });
  }

  function uniqueCopyName(baseName, names) {
    var suffix = t('ops.copySuffix');
    var base = trimmed(baseName) || t('ops.untitled');
    var room = MAX_NAME - charLength(suffix) - 3; // 連番用に3文字残す
    if (room > 0 && charLength(base) > room) { base = sliceChars(base, room); }
    var candidate = base + suffix;
    var n = 2;
    while (names.indexOf(candidate) !== -1 && n <= 99) {
      candidate = base + suffix + ' ' + n;
      n += 1;
    }
    return candidate;
  }

  // ponytail: 関連データは一覧1回ぶん（最大500件）をまとめて消す。
  //           それを超える場合は残るので、必要になったらサーバー側の cascade delete に移す。
  function removeRelated(id) {
    return Api.generations.list({ select: 'id', eq: { projects_id: id }, limit: RELATED_LIMIT }).then(function (rows) {
      return Promise.all(rows.map(function (row) { return Api.generations.remove(row.id); }));
    }).then(function () {
      return Api.analysisReports.list({ select: 'id', eq: { projects_id: id }, limit: RELATED_LIMIT });
    }).then(function (rows) {
      return Promise.all(rows.map(function (row) { return Api.analysisReports.remove(row.id); }));
    });
  }

  function failText(err, fallbackKey) {
    console.error('[screens-project-ops.js] 処理に失敗しました', err);
    if (err && (err.code === 'network' || err.code === 'timeout')) { return t('common.networkError'); }
    if (err && err.code === 'notfound') { return t('ops.notFound'); }
    return t(fallbackKey);
  }

  /* ---------- 画面の共通パーツ ---------- */

  function infoRow(key, value) {
    var row = el('div', 'info-row');
    row.appendChild(el('span', 'info-row__key', key));
    row.appendChild(el('span', 'info-row__val', value));
    return row;
  }

  function showSkeleton(host) {
    clear(host);
    var wrap = el('div', 'stack stack--group');
    ['skeleton skeleton--title', 'skeleton skeleton--card', 'skeleton skeleton--row', 'skeleton skeleton--row'].forEach(function (cls) {
      var box = el('div', cls);
      box.setAttribute('aria-hidden', 'true');
      wrap.appendChild(box);
    });
    wrap.appendChild(el('p', 'loading-text', t('common.loading')));
    host.appendChild(wrap);
  }

  function showLoadError(host, message, onRetry) {
    clear(host);
    var box = el('div', 'empty');
    box.appendChild(el('p', 'empty__text', message));
    if (onRetry) { box.appendChild(btn('btn btn--primary', t('common.retry'), onRetry)); }
    box.appendChild(btn('btn btn--text', t('projectDetail.backToDashboard'), function () { goTo('#/S3'); }));
    host.appendChild(box);
    showBanner(message, onRetry);
  }

  function showNoProject(host) {
    clear(host);
    var box = el('div', 'empty');
    box.appendChild(el('p', 'empty__text', t('ops.noProject')));
    box.appendChild(btn('btn btn--primary', t('projectDetail.backToDashboard'), function () { goTo('#/S3'); }));
    host.appendChild(box);
  }

  function showApiMissing(host) {
    console.error('[screens-project-ops.js] api.js が読み込まれていないため、プロジェクトの読み書きができません。');
    clear(host);
    var box = el('div', 'empty');
    box.appendChild(el('p', 'empty__text', t('ops.apiMissing')));
    box.appendChild(btn('btn btn--primary', t('ops.reload'), function () { window.location.reload(); }));
    host.appendChild(box);
    showBanner(t('ops.apiMissing'), null);
  }

  /* ---------- 表示中の画面と言語切替 ---------- */

  var mounted = null;

  function mount(root, redraw) {
    mounted = { root: root, redraw: redraw };
  }

  window.addEventListener('elpiya:locale-changed', function () {
    // app.js が現在画面を描き直す場合は、そちらが先に走って root が差し替わる。
    // 少し待ってから、まだ自分の root が残っているときだけ描き直す。
    window.setTimeout(function () {
      if (!mounted || !mounted.root) { return; }
      if (!document.body.contains(mounted.root)) { mounted = null; return; }
      mounted.redraw();
    }, 0);
  });

  /* ---------- 戻る矢印の横取り（S6 の未保存確認用） ---------- */

  var backGuard = null;

  function removeBackGuard() {
    if (!backGuard) { return; }
    backGuard.node.removeEventListener('click', backGuard.handler, true);
    backGuard = null;
  }

  function installBackGuard(root, shouldBlock, onBlocked) {
    removeBackGuard();
    var node = document.getElementById('header-back');
    if (!node) {
      console.warn('[screens-project-ops.js] #header-back が見つからないため、戻る操作での未保存確認は画面内のキャンセルボタンだけになります。');
      return;
    }
    var handler = function (event) {
      if (!document.body.contains(root)) { removeBackGuard(); return; }
      if (!shouldBlock()) { return; }
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') { event.stopImmediatePropagation(); }
      onBlocked();
    };
    node.addEventListener('click', handler, true);
    backGuard = { node: node, handler: handler };
  }

  /* ---------- 入力の下書き（言語切替や再描画で消さないため） ---------- */

  var renameDraft = { id: null, value: null };
  var deleteDraft = { id: null, value: null };

  /* =========================================================
     S5 プロジェクト操作メニュー
     プロジェクト概要＋情報行（作成日・登録商品数・分析レポート数）と
     名前を変更／複製／削除。
     ========================================================= */

  function renderOpsMenu(root, params) {
    var p = screenParams(params);
    var id = projectIdOf(p);

    removeBackGuard();
    clearBanner();
    setHeader(t('projectOps.title'), true);
    setTabbar(true);
    clear(root);

    var screen = el('div', 'screen');
    root.appendChild(screen);
    mount(root, function () { renderOpsMenu(root, { id: id }); });

    if (!apiReady()) { showApiMissing(screen); return; }
    if (!id) { showNoProject(screen); return; }
    Api.storage.set('projectId', id);

    function load() {
      showSkeleton(screen);
      loadOverview(id).then(paint, function (err) {
        showLoadError(screen, failText(err, 'projectDetail.loadFailed'), load);
      });
    }

    function duplicate(button, project) {
      var label = button.textContent;
      button.disabled = true;
      button.textContent = t('ops.duplicating');
      clearBanner();

      listProjectNames(null).then(null, function (err) {
        // 名前の重複確認だけの失敗。複製そのものは続ける（黙って消さず記録は残す）。
        console.warn('[screens-project-ops.js] 既存のプロジェクト名を取得できませんでした。連番なしの名前で複製します。', err);
        return [];
      }).then(function (names) {
        var copyName = uniqueCopyName(project.project_name, names);
        /* name / status は NOT NULL でデフォルトが無い（screens-home.js の作成側と同じ理由） */
        return Api.projects.insert({
          users_id: project.users_id,
          project_name: copyName,
          name: copyName,
          status: project.status || 'active',
          product_name: project.product_name,
          price: project.price,
          product_features: project.product_features,
          target_audience: project.target_audience,
          sale_start_date: project.sale_start_date,
          image_urls: project.image_urls
        });
      }).then(function (created) {
        Api.storage.set('projectId', created.id);
        toast(t('projectOps.duplicateSuccess'), 'success');
        goTo('#/S3');
      }, function (err) {
        button.disabled = false;
        button.textContent = label;
        var message = failText(err, 'projectOps.duplicateFailed');
        toast(message, 'danger');
        showBanner(message, function () { duplicate(button, project); });
      });
    }

    function paint(data) {
      var project = data.project;
      clear(screen);

      // --- プロジェクト概要 ---
      var overview = el('section', 'section');
      var card = el('div', 'card');
      var cardStack = el('div', 'stack stack--tight');
      cardStack.appendChild(el('div', 'card__label', t('project.name')));
      cardStack.appendChild(el('div', 'card__value clamp-2', trimmed(project.project_name) || t('ops.untitled')));
      cardStack.appendChild(el('div', 'card__sub', t('projectOps.lastUpdated') + ' ' + relativeTime(project.created_at)));
      card.appendChild(cardStack);
      overview.appendChild(card);
      screen.appendChild(overview);

      // --- プロジェクト情報 ---
      var infoSection = el('section', 'section');
      var infoHead = el('div', 'section__head');
      infoHead.appendChild(el('h2', 'section__title', t('projectOps.info')));
      infoSection.appendChild(infoHead);
      var infoList = el('div', 'info-list');
      infoList.appendChild(infoRow(t('projectOps.createdAt'), formatDate(project.created_at)));
      infoList.appendChild(infoRow(t('projectOps.productCount'), countLabel(data.products)));
      infoList.appendChild(infoRow(t('projectOps.reportCount'), countLabel(data.reports)));
      infoSection.appendChild(infoList);
      screen.appendChild(infoSection);

      // --- 操作 ---
      var actions = el('section', 'section');
      var pair = el('div', 'btn-row');
      pair.appendChild(btn('btn btn--primary btn--block', t('projectOps.rename'), function () {
        renameDraft = { id: null, value: null };
        goTo(renameHash(id));
      }));
      var dupBtn = btn('btn btn--secondary btn--block', t('projectOps.duplicate'), function () {
        duplicate(dupBtn, project);
      });
      pair.appendChild(dupBtn);
      actions.appendChild(pair);

      actions.appendChild(btn('btn btn--danger btn--block', t('projectOps.delete'), function () {
        deleteDraft = { id: null, value: null };
        goTo(deleteHash(id));
      }));
      actions.appendChild(el('p', 't-note', t('projectOps.deleteWarning')));
      screen.appendChild(actions);

      // --- 戻り先 ---
      var foot = el('section', 'section');
      foot.appendChild(btn('btn btn--text btn--block', t('projectDetail.backToDashboard'), function () { goTo('#/S3'); }));
      screen.appendChild(foot);
    }

    load();
  }

  /* =========================================================
     S6 プロジェクト名変更
     30文字・空欄・重複を入力のたびに検証し、最近使った名前を候補に出す。
     ========================================================= */

  function renderRename(root, params) {
    var p = screenParams(params);
    var id = projectIdOf(p);

    clearBanner();
    setHeader(t('projectRename.title'), true);
    setTabbar(false);
    clear(root);

    var screen = el('div', 'screen');
    root.appendChild(screen);
    mount(root, function () { renderRename(root, { id: id }); });

    if (!apiReady()) { removeBackGuard(); showApiMissing(screen); return; }
    if (!id) { removeBackGuard(); showNoProject(screen); return; }
    Api.storage.set('projectId', id);

    var state = { project: null, others: [], recent: [] };

    function load() {
      showSkeleton(screen);
      Api.projects.get(id).then(function (project) {
        state.project = project;
        return Api.projects.list({ select: 'id,project_name', eq: ownerEq(), limit: 200 }).then(null, function (err) {
          // 重複確認と候補の取得だけの失敗。名前変更自体は続けられるようにする。
          console.warn('[screens-project-ops.js] プロジェクト一覧を取得できませんでした。重複チェックと候補なしで続行します。', err);
          showBanner(t('dashboard.loadFailed'), function () { load(); });
          return [];
        });
      }).then(function (rows) {
        state.others = [];
        state.recent = [];
        rows.forEach(function (row) {
          var name = trimmed(row.project_name);
          if (!name || String(row.id) === String(id)) { return; }
          if (state.others.indexOf(name) === -1) { state.others.push(name); }
          if (state.recent.indexOf(name) === -1 && state.recent.length < 3) { state.recent.push(name); }
        });
        paint();
      }, function (err) {
        removeBackGuard();
        showLoadError(screen, failText(err, 'projectDetail.loadFailed'), load);
      });
    }

    function paint() {
      var project = state.project;
      var original = trimmed(project.project_name);
      var initial = (renameDraft.id === String(id) && renameDraft.value !== null)
        ? renameDraft.value
        : (project.project_name === undefined || project.project_name === null ? '' : String(project.project_name));

      clear(screen);

      // --- 入力欄 ---
      var inputSection = el('section', 'section');
      var field = el('div', 'field');

      var label = el('label', 'field__label', t('projectRename.label'));
      label.setAttribute('for', 'rename-name-input');

      var input = el('input', 'input');
      input.type = 'text';
      input.id = 'rename-name-input';
      input.value = initial;
      input.autocomplete = 'off';
      input.setAttribute('placeholder', t('project.name'));
      input.setAttribute('aria-describedby', 'rename-name-error');

      var counter = el('div', 'counter');
      var hint = el('p', 'field__hint', t('projectRename.hint'));
      var error = el('p', 'field__error');
      error.id = 'rename-name-error';

      field.appendChild(label);
      field.appendChild(input);
      field.appendChild(counter);
      field.appendChild(hint);
      field.appendChild(error);
      inputSection.appendChild(field);
      screen.appendChild(inputSection);

      // --- 最近使った名前 ---
      var recentSection = el('section', 'section');
      recentSection.appendChild(el('h2', 'section__title', t('projectRename.recent')));
      if (state.recent.length) {
        var list = el('div', 'list');
        state.recent.forEach(function (name) {
          var row = btn('list-row', null, function () {
            input.value = name;
            renameDraft = { id: String(id), value: name };
            validate();
            try { input.focus(); } catch (e) { /* フォーカスできない環境は無視してよい */ }
          });
          var body = el('div', 'list-row__body');
          body.appendChild(el('span', 'list-row__title clamp-1', name));
          row.appendChild(body);
          row.appendChild(el('span', 'list-row__meta', t('ops.useThisName')));
          list.appendChild(row);
        });
        recentSection.appendChild(list);
      } else {
        recentSection.appendChild(el('p', 'note-box', t('ops.recentEmpty')));
      }
      screen.appendChild(recentSection);

      // --- キャンセル／保存 ---
      var buttons = el('div', 'btn-row');
      var cancelBtn = btn('btn btn--secondary btn--block', t('common.cancel'), function () { requestLeave(); });
      var saveBtn = btn('btn btn--primary btn--block', t('common.save'), function () { save(); });
      buttons.appendChild(cancelBtn);
      buttons.appendChild(saveBtn);
      screen.appendChild(buttons);

      function validate() {
        var value = trimmed(input.value);
        var length = charLength(value);
        counter.textContent = length + ' / ' + MAX_NAME;
        counter.className = length > MAX_NAME ? 'counter counter--over' : 'counter';

        var message = '';
        if (!value) {
          message = t('projectRename.empty');
        } else if (length > MAX_NAME) {
          message = t('projectRename.tooLong');
        } else if (state.others.indexOf(value) !== -1) {
          message = t('projectRename.duplicate');
        }

        error.textContent = message;
        if (message) {
          input.classList.add('input--error');
          input.setAttribute('aria-invalid', 'true');
        } else {
          input.classList.remove('input--error');
          input.removeAttribute('aria-invalid');
        }
        saveBtn.disabled = message !== '';
        return message === '';
      }

      function isDirty() {
        return trimmed(input.value) !== original;
      }

      function leave() {
        renameDraft = { id: null, value: null };
        removeBackGuard();
        goTo(opsHash(id));
      }

      function requestLeave() {
        if (!isDirty()) { leave(); return; }
        askDiscard().then(function (ok) {
          if (ok) { leave(); return; }
          try { input.focus(); } catch (e) { /* フォーカスできない環境は無視してよい */ }
        });
      }

      function save() {
        if (!validate()) {
          try { input.focus(); } catch (e) { /* フォーカスできない環境は無視してよい */ }
          return;
        }
        var value = trimmed(input.value);
        var label2 = saveBtn.textContent;
        saveBtn.disabled = true;
        cancelBtn.disabled = true;
        input.disabled = true;
        saveBtn.textContent = t('ops.saving');
        clearBanner();

        Api.projects.update(id, { project_name: value }).then(function () {
          renameDraft = { id: null, value: null };
          removeBackGuard();
          toast(t('common.saved'), 'success');
          goTo('#/S3');
        }, function (err) {
          saveBtn.disabled = false;
          cancelBtn.disabled = false;
          input.disabled = false;
          saveBtn.textContent = label2;
          var message = failText(err, 'projectRename.saveFailed');
          toast(message, 'danger');
          showBanner(message, function () { save(); });
        });
      }

      input.addEventListener('input', function () {
        renameDraft = { id: String(id), value: input.value };
        validate();
      });

      installBackGuard(root, isDirty, requestLeave);
      validate();
    }

    load();
  }

  /* =========================================================
     S7 プロジェクト削除確認
     削除される項目の件数を出し、プロジェクト名の完全一致入力で削除ボタンを解放する。
     ========================================================= */

  function renderDelete(root, params) {
    var p = screenParams(params);
    var id = projectIdOf(p);

    removeBackGuard();
    clearBanner();
    setHeader(t('projectDelete.title'), true);
    setTabbar(false);
    clear(root);

    var screen = el('div', 'screen');
    root.appendChild(screen);
    mount(root, function () { renderDelete(root, { id: id }); });

    if (!apiReady()) { showApiMissing(screen); return; }
    if (!id) { showNoProject(screen); return; }
    Api.storage.set('projectId', id);

    function load() {
      showSkeleton(screen);
      loadOverview(id).then(paint, function (err) {
        showLoadError(screen, failText(err, 'projectDetail.loadFailed'), load);
      });
    }

    function paint(data) {
      var project = data.project;
      var name = trimmed(project.project_name);
      var initial = (deleteDraft.id === String(id) && deleteDraft.value !== null) ? deleteDraft.value : '';

      clear(screen);

      // --- サムネイルと対象プロジェクト ---
      var head = el('section', 'section');
      var images = imageList(project.image_urls);
      if (images.length) {
        var grid = el('div', 'thumb-grid');
        images.slice(0, 4).forEach(function (url) {
          var thumb = el('div', 'thumb');
          var img = el('img', 'thumb__img');
          img.alt = '';
          img.loading = 'lazy';
          img.addEventListener('error', function () {
            if (img.parentNode) { img.parentNode.removeChild(img); }
          });
          img.src = url;
          thumb.appendChild(img);
          grid.appendChild(thumb);
        });
        head.appendChild(grid);
      } else {
        head.appendChild(el('p', 'note-box', t('ops.noImage')));
      }
      var titleStack = el('div', 'stack stack--tight');
      titleStack.appendChild(el('h2', 't-sub clamp-2', name || t('ops.untitled')));
      titleStack.appendChild(el('p', 't-note', t('projectDelete.relatedNotice')));
      head.appendChild(titleStack);
      screen.appendChild(head);

      // --- 削除される項目 ---
      var itemsSection = el('section', 'section');
      itemsSection.appendChild(el('h2', 'section__title', t('projectDelete.willDelete')));
      var itemsList = el('div', 'info-list');
      itemsList.appendChild(infoRow(t('projectDelete.products'), countLabel(data.products)));
      itemsList.appendChild(infoRow(t('projectDelete.reports'), countLabel(data.reports)));
      itemsList.appendChild(infoRow(t('projectDelete.generations'), countLabel(data.generations)));
      itemsSection.appendChild(itemsList);
      screen.appendChild(itemsSection);

      // --- プロジェクト名の入力 ---
      var confirmSection = el('section', 'section');
      var field = el('div', 'field');

      var label = el('label', 'field__label', t('projectDelete.confirmLabel'));
      label.setAttribute('for', 'delete-confirm-input');

      var input = el('input', 'input');
      input.type = 'text';
      input.id = 'delete-confirm-input';
      input.value = initial;
      input.autocomplete = 'off';
      input.setAttribute('placeholder', name || t('ops.untitled'));
      input.setAttribute('aria-describedby', 'delete-confirm-error');

      var hint = el('p', 'field__hint', t('ops.deleteHint', { name: name || t('ops.untitled') }));
      var error = el('p', 'field__error');
      error.id = 'delete-confirm-error';

      field.appendChild(label);
      field.appendChild(input);
      field.appendChild(hint);
      field.appendChild(error);
      confirmSection.appendChild(field);
      confirmSection.appendChild(el('p', 'warn-box', t('projectOps.deleteWarning')));
      screen.appendChild(confirmSection);

      // --- キャンセル／削除を確定する ---
      var buttons = el('div', 'btn-row');
      var cancelBtn = btn('btn btn--secondary btn--block', t('common.cancel'), function () {
        deleteDraft = { id: null, value: null };
        goTo(opsHash(id));
      });
      var deleteBtn = btn('btn btn--danger btn--block', t('projectDelete.confirmButton'), function () { doDelete(); });
      deleteBtn.disabled = true;
      buttons.appendChild(cancelBtn);
      buttons.appendChild(deleteBtn);
      screen.appendChild(buttons);

      function validate(showMismatch) {
        var value = trimmed(input.value);
        var ok = value !== '' && value === name;
        deleteBtn.disabled = !ok;
        if (!ok && showMismatch && value !== '') {
          error.textContent = t('projectDelete.mismatch');
          input.classList.add('input--error');
          input.setAttribute('aria-invalid', 'true');
        } else {
          error.textContent = '';
          input.classList.remove('input--error');
          input.removeAttribute('aria-invalid');
        }
        return ok;
      }

      function doDelete() {
        if (!validate(true)) {
          try { input.focus(); } catch (e) { /* フォーカスできない環境は無視してよい */ }
          return;
        }
        var label2 = deleteBtn.textContent;
        deleteBtn.disabled = true;
        cancelBtn.disabled = true;
        input.disabled = true;
        deleteBtn.textContent = t('ops.deleting');
        clearBanner();

        removeRelated(id).then(function () {
          return Api.projects.remove(id);
        }).then(function () {
          deleteDraft = { id: null, value: null };
          Api.storage.remove('projectId');
          Api.storage.remove('analysisReportId');
          Api.storage.remove('generationId');
          toast(t('common.deleted'), 'success');
          goTo('#/S3');
        }, function (err) {
          deleteBtn.disabled = false;
          cancelBtn.disabled = false;
          input.disabled = false;
          deleteBtn.textContent = label2;
          var message = failText(err, 'projectDelete.failed');
          toast(message, 'danger');
          showBanner(message, function () { doDelete(); });
        });
      }

      input.addEventListener('input', function () {
        deleteDraft = { id: String(id), value: input.value };
        validate(true);
      });

      validate(false);
    }

    load();
  }

  /* =========================================================
     画面登録（第2引数は必ず { render: 関数 } オブジェクト）
     ========================================================= */

  App.registerScreen('S5', { render: function (root, params) { renderOpsMenu(root, params); } });
  App.registerScreen('S6', { render: function (root, params) { renderRename(root, params); } });
  App.registerScreen('S7', { render: function (root, params) { renderDelete(root, params); } });

})(window, document);
