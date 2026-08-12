/* ============================================================
 * エルピーヤ — app.js
 * ハッシュルーター兼アプリ全体の司令塔。
 * 画面そのものは描画しない（唯一の例外は index.html の約束どおり settings 画面）。
 *
 * ---- 画面ファイルとの共通契約（この形だけを使う。別方式は混ぜない）----
 *   App.registerScreen('S3', { render: function (root, params) { ... } });
 *   第2引数は必ず { render: 関数 } のオブジェクト。関数をそのまま渡さない。
 *   app.js 側は spec.render(root, params) で呼ぶ。
 *   経路は '#/S8'、パラメータ付きは '#/S8?id=xxx'。
 *
 * ---- app.js が公開するもの（window.App）----
 *   画面登録・遷移
 *     App.registerScreen(id, spec)
 *     App.navigate(id, params)      次の画面へ（履歴に積む）
 *     App.replace(id, params)       履歴を置き換えて移動
 *     App.back()                    1つ戻る（履歴が無ければ画面表の戻り先へ）
 *     App.hashFor(id, params)       '#/S8?id=xxx' を作る
 *     App.currentRoute()            { id, params }
 *     App.meta(id)                  画面表の1行 { tab, back, auth, admin }
 *   ヘッダー
 *     App.setHeader({ title, back, action })
 *     App.setTitle(text) / App.setHeaderAction(node|null)
 *   言語（辞書は i18n.js。app.js は自分が出す文言の予備辞書だけ持つ）
 *     App.t(key, vars) / App.getLang() / App.setLang(code) / App.LANGS
 *     App.applyI18n(root)
 *   状態
 *     App.getUser() / App.setUser(user) / App.logout() / App.isAdmin()
 *     App.refreshUser() / App.getBalance() / App.setBalance(n) / App.hasUnlimited()
 *     App.consumeCredit(featureKey, memo)   ← 数量は渡さない。サーバーが単価を引く
 *     （クレジット購入の入口は App には無い。決済導線は S17 だけが持つ）
 *     App.on('user'|'balance'|'lang'|'route', fn) -> 解除関数
 *   共通の見た目
 *     App.showLoading(root, opts) / App.loadingBlock(opts)
 *     App.empty({ text, actionLabel, onAction })
 *     App.errorBlock(message, retry) / App.showBanner(message, retry) / App.clearBanner()
 *     App.handleError(err, retry)   ← api.js の ApiError をそのまま渡してよい
 *     App.toast(message, 'success'|'danger')
 *     App.confirm({ title, message, note, confirmLabel, cancelLabel, danger }) -> Promise<boolean>
 *     App.openModal(node, opts) / App.openSheet(node, opts) / App.closeModal()
 *   小道具
 *     App.el(tag, props, children) / App.clear(node) / App.button(opts)
 *     App.formatNumber(n) / App.formatYen(n) / App.formatDate(v) /
 *     App.formatDateTime(v) / App.fromNow(v)
 *
 * ---- 依存（実際に存在する名前だけを呼ぶ。無ければコンソールに何が無いかを残す）----
 *   api.js  : Api.auth.restore / Api.auth.signOut / Api.auth.consumeRedirect /
 *             Api.users.get / Api.credits.consume / Api.credits.hasUnlimited /
 *             Api.storage.get / set / remove / Api.storage.clearSelection / Api.URL
 *   i18n.js : I18n.t(key, vars) / I18n.getLang() / I18n.setLang(code) / I18n.apply(root)
 *             （setLocale という綴りだった場合はそちらを使い、その旨をコンソールに残す）
 *             言語の保存先は api.js と同じ localStorage の 'elpiya.lang'（Api.storage の 'lang'）。
 * ============================================================ */

(function (global) {
  'use strict';

  var APP_NAME = 'エルピーヤ';
  var APP_VERSION = '1.0.0';
  var DEFAULT_LANG = 'ja';
  var TOAST_MS = 3200;

  var LANGS = [
    { code: 'ja', label: '日本語', tag: 'ja-JP' },
    { code: 'en', label: 'English', tag: 'en-US' },
    { code: 'ko', label: '한국어', tag: 'ko-KR' }
  ];

  /* ------------------------------------------------------------------
   * 1. 画面表（S1〜S19 と settings）
   *    tab   : 下部タブバーで光らせる項目。null ならタブバーごと隠す
   *    back  : 履歴が無いときの戻り先
   *    auth  : ログイン中のユーザーが必要か
   *    admin : 管理者のみか
   * ------------------------------------------------------------------ */
  var SCREENS = {
    S1: { tab: null, back: null, auth: false, admin: false },
    S2: { tab: null, back: 'S1', auth: false, admin: false },
    S3: { tab: 'S3', back: null, auth: true, admin: false },
    S4: { tab: 'S4', back: 'S3', auth: true, admin: false },
    S5: { tab: 'S3', back: 'S3', auth: true, admin: false },
    S6: { tab: null, back: 'S5', auth: true, admin: false },
    S7: { tab: null, back: 'S5', auth: true, admin: false },
    S8: { tab: 'S3', back: 'S3', auth: true, admin: false },
    S9: { tab: 'S4', back: 'S8', auth: true, admin: false },
    S10: { tab: null, back: 'S8', auth: true, admin: false },
    S11: { tab: null, back: 'S8', auth: true, admin: false },
    S12: { tab: null, back: 'S11', auth: true, admin: false },
    S13: { tab: 'S4', back: 'S8', auth: true, admin: false },
    S14: { tab: null, back: 'S13', auth: true, admin: false },
    S15: { tab: null, back: 'S13', auth: true, admin: false },
    S16: { tab: null, back: 'S8', auth: true, admin: false },
    S17: { tab: 'S17', back: 'S3', auth: true, admin: false },
    S18: { tab: 'S18', back: 'S3', auth: true, admin: true },
    S19: { tab: null, back: 'S18', auth: true, admin: true },
    settings: { tab: 'settings', back: 'S3', auth: false, admin: false }
  };

  /* プロジェクトに紐づく画面は、戻り先を作るときに選択中のプロジェクトIDを付ける */
  var PROJECT_SCOPED = ['S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16'];

  /* ------------------------------------------------------------------
   * 2. 予備辞書
   *    本来の辞書は i18n.js。ここにあるのは app.js 自身が出す文言だけで、
   *    i18n.js にキーが無いとき（またはまだ読み込まれていないとき）に使う。
   *    生のキー文字列が画面に出ることを防ぐための保険。
   * ------------------------------------------------------------------ */
  var FALLBACK = {
    ja: {
      'common.back': '戻る',
      'common.mainNav': 'メインナビゲーション',
      'common.loading': '読み込み中…',
      'common.retry': '再試行',
      'common.cancel': 'キャンセル',
      'common.ok': 'OK',
      'common.close': '閉じる',
      'common.confirm': '確認',
      'common.creditUnit': 'CR',
      'common.justNow': 'たった今',
      'common.minutesAgo': '{n}分前',
      'common.hoursAgo': '{n}時間前',
      'common.daysAgo': '{n}日前',
      'common.sharedDataNotice': 'ログイン機能は未実装のため、このアプリを開いた全員が同じデータを見ます',
      'common.errorUnknown': '問題が発生しました。時間をおいて再試行してください。',
      'common.errorRender': 'この画面を表示できませんでした。再試行してください。',
      'common.errorScreenMissing': 'この画面の部品がまだ読み込まれていません。アプリを再読み込みしてください。',
      'common.errorApiMissing': '通信部品（api.js）が読み込まれていないため、データを取得できません。',
      'common.reload': '再読み込み',
      'common.adminOnly': 'この画面は管理者のみが利用できます。',
      'common.loginRequired': 'この画面を使うにはログインが必要です。',
      'tab.home': 'ホーム',
      'tab.create': '作成',
      'tab.credit': 'クレジット',
      'tab.admin': '管理',
      'tab.settings': '設定',
      'screen.S1': 'ログイン',
      'screen.S2': '会員登録',
      'screen.S3': 'マイプロジェクト',
      'screen.S4': '新規プロジェクト',
      'screen.S5': 'プロジェクト操作',
      'screen.S6': '名前を変更',
      'screen.S7': 'プロジェクトを削除',
      'screen.S8': 'プロジェクト詳細',
      'screen.S9': '商品登録',
      'screen.S10': '競合LP分析',
      'screen.S11': '分析レポート',
      'screen.S12': '生成内容の確認',
      'screen.S13': '生成結果',
      'screen.S14': 'デザイン編集',
      'screen.S15': '実寸プレビュー',
      'screen.S16': 'クレジット消費確認',
      'screen.S17': 'クレジット',
      'screen.S18': '管理者ダッシュボード',
      'screen.S19': '機能別価格設定',
      'screen.settings': '設定',
      'settings.language': '表示言語',
      'settings.languageHint': '選んだ言語はこの端末に保存され、すぐにすべての画面へ反映されます。',
      'settings.account': 'アカウント情報',
      'settings.displayName': '表示名',
      'settings.email': 'メールアドレス',
      'settings.provider': 'ログイン方法',
      'settings.providerEmail': 'メールとパスワード',
      'settings.providerGoogle': 'Googleで続行（体験用の疑似ログイン）',
      'settings.role': '権限',
      'settings.roleAdmin': '管理者',
      'settings.roleUser': '一般ユーザー',
      'settings.balance': 'クレジット残高',
      'settings.unlimited': '無制限利用 {date} まで',
      'settings.since': '登録日',
      'settings.goCredit': 'クレジットを見る',
      'settings.goAdmin': '管理画面を開く',
      'settings.logout': 'ログアウト',
      'settings.logoutTitle': 'ログアウトしますか？',
      'settings.logoutBody': 'もう一度使うにはログインが必要です。保存したプロジェクトは残ります。',
      'settings.loggedOut': 'ログアウトしました',
      'settings.guest': 'ログインしていません',
      'settings.guestHint': 'ログインするとプロジェクトとクレジットを利用できます。',
      'settings.login': 'ログインへ',
      'settings.appInfo': 'アプリ情報',
      'settings.version': 'バージョン',
      'settings.server': '保存先',
      'settings.notice': '業務データは共有のサーバーに保存されます。この端末に残るのは表示言語と選択中のIDだけです。'
    },
    en: {
      'common.back': 'Back',
      'common.mainNav': 'Main navigation',
      'common.loading': 'Loading…',
      'common.retry': 'Retry',
      'common.cancel': 'Cancel',
      'common.ok': 'OK',
      'common.close': 'Close',
      'common.confirm': 'Confirm',
      'common.creditUnit': 'CR',
      'common.justNow': 'Just now',
      'common.minutesAgo': '{n} min ago',
      'common.hoursAgo': '{n} h ago',
      'common.daysAgo': '{n} d ago',
      'common.sharedDataNotice': 'Sign-in is not implemented yet, so everyone who opens this app sees the same data',
      'common.errorUnknown': 'Something went wrong. Please try again later.',
      'common.errorRender': 'This screen could not be displayed. Please try again.',
      'common.errorScreenMissing': 'This screen has not been loaded yet. Please reload the app.',
      'common.errorApiMissing': 'The network module (api.js) is not loaded, so data cannot be fetched.',
      'common.reload': 'Reload',
      'common.adminOnly': 'This screen is for administrators only.',
      'common.loginRequired': 'Please sign in to use this screen.',
      'tab.home': 'Home',
      'tab.create': 'Create',
      'tab.credit': 'Credits',
      'tab.admin': 'Admin',
      'tab.settings': 'Settings',
      'screen.S1': 'Sign in',
      'screen.S2': 'Create account',
      'screen.S3': 'My projects',
      'screen.S4': 'New project',
      'screen.S5': 'Project actions',
      'screen.S6': 'Rename',
      'screen.S7': 'Delete project',
      'screen.S8': 'Project',
      'screen.S9': 'Product',
      'screen.S10': 'Competitor analysis',
      'screen.S11': 'Analysis report',
      'screen.S12': 'Review before generating',
      'screen.S13': 'Generated result',
      'screen.S14': 'Design editor',
      'screen.S15': 'Actual size preview',
      'screen.S16': 'Credit confirmation',
      'screen.S17': 'Credits',
      'screen.S18': 'Admin dashboard',
      'screen.S19': 'Feature pricing',
      'screen.settings': 'Settings',
      'settings.language': 'Language',
      'settings.languageHint': 'Your choice is stored on this device and applied to every screen right away.',
      'settings.account': 'Account',
      'settings.displayName': 'Display name',
      'settings.email': 'Email',
      'settings.provider': 'Sign-in method',
      'settings.providerEmail': 'Email and password',
      'settings.providerGoogle': 'Continue with Google (demo only)',
      'settings.role': 'Role',
      'settings.roleAdmin': 'Administrator',
      'settings.roleUser': 'Member',
      'settings.balance': 'Credit balance',
      'settings.unlimited': 'Unlimited until {date}',
      'settings.since': 'Registered',
      'settings.goCredit': 'View credits',
      'settings.goAdmin': 'Open admin',
      'settings.logout': 'Sign out',
      'settings.logoutTitle': 'Sign out?',
      'settings.logoutBody': 'You will need to sign in again. Your saved projects remain.',
      'settings.loggedOut': 'Signed out',
      'settings.guest': 'Not signed in',
      'settings.guestHint': 'Sign in to use projects and credits.',
      'settings.login': 'Go to sign in',
      'settings.appInfo': 'About',
      'settings.version': 'Version',
      'settings.server': 'Storage',
      'settings.notice': 'Business data is stored on the shared server. Only the language and the selected IDs stay on this device.'
    },
    ko: {
      'common.back': '뒤로',
      'common.mainNav': '메인 내비게이션',
      'common.loading': '불러오는 중…',
      'common.retry': '다시 시도',
      'common.cancel': '취소',
      'common.ok': '확인',
      'common.close': '닫기',
      'common.confirm': '확인',
      'common.creditUnit': 'CR',
      'common.justNow': '방금',
      'common.minutesAgo': '{n}분 전',
      'common.hoursAgo': '{n}시간 전',
      'common.daysAgo': '{n}일 전',
      'common.sharedDataNotice': '로그인 기능이 아직 없어, 이 앱을 연 모든 사람이 같은 데이터를 봅니다',
      'common.errorUnknown': '문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      'common.errorRender': '이 화면을 표시하지 못했습니다. 다시 시도해 주세요.',
      'common.errorScreenMissing': '이 화면의 파일이 아직 로드되지 않았습니다. 앱을 새로고침해 주세요.',
      'common.errorApiMissing': '통신 모듈(api.js)이 로드되지 않아 데이터를 가져올 수 없습니다.',
      'common.reload': '새로고침',
      'common.adminOnly': '이 화면은 관리자만 사용할 수 있습니다.',
      'common.loginRequired': '이 화면을 사용하려면 로그인이 필요합니다.',
      'tab.home': '홈',
      'tab.create': '작성',
      'tab.credit': '크레딧',
      'tab.admin': '관리',
      'tab.settings': '설정',
      'screen.S1': '로그인',
      'screen.S2': '회원가입',
      'screen.S3': '내 프로젝트',
      'screen.S4': '새 프로젝트',
      'screen.S5': '프로젝트 작업',
      'screen.S6': '이름 변경',
      'screen.S7': '프로젝트 삭제',
      'screen.S8': '프로젝트 상세',
      'screen.S9': '상품 등록',
      'screen.S10': '경쟁 LP 분석',
      'screen.S11': '분석 리포트',
      'screen.S12': '생성 내용 확인',
      'screen.S13': '생성 결과',
      'screen.S14': '디자인 편집',
      'screen.S15': '실측 미리보기',
      'screen.S16': '크레딧 사용 확인',
      'screen.S17': '크레딧',
      'screen.S18': '관리자 대시보드',
      'screen.S19': '기능별 가격 설정',
      'screen.settings': '설정',
      'settings.language': '표시 언어',
      'settings.languageHint': '선택한 언어는 이 기기에 저장되며 모든 화면에 즉시 반영됩니다.',
      'settings.account': '계정 정보',
      'settings.displayName': '표시 이름',
      'settings.email': '이메일',
      'settings.provider': '로그인 방법',
      'settings.providerEmail': '이메일과 비밀번호',
      'settings.providerGoogle': 'Google로 계속하기(체험용 모의 로그인)',
      'settings.role': '권한',
      'settings.roleAdmin': '관리자',
      'settings.roleUser': '일반 사용자',
      'settings.balance': '크레딧 잔액',
      'settings.unlimited': '무제한 이용 {date}까지',
      'settings.since': '가입일',
      'settings.goCredit': '크레딧 보기',
      'settings.goAdmin': '관리 화면 열기',
      'settings.logout': '로그아웃',
      'settings.logoutTitle': '로그아웃할까요?',
      'settings.logoutBody': '다시 사용하려면 로그인이 필요합니다. 저장한 프로젝트는 남습니다.',
      'settings.loggedOut': '로그아웃했습니다',
      'settings.guest': '로그인하지 않았습니다',
      'settings.guestHint': '로그인하면 프로젝트와 크레딧을 사용할 수 있습니다.',
      'settings.login': '로그인으로',
      'settings.appInfo': '앱 정보',
      'settings.version': '버전',
      'settings.server': '저장 위치',
      'settings.notice': '업무 데이터는 공유 서버에 저장됩니다. 이 기기에는 표시 언어와 선택 중인 ID만 남습니다.'
    }
  };

  /* ------------------------------------------------------------------
   * 3. 状態
   * ------------------------------------------------------------------ */
  var state = {
    user: null,
    lang: DEFAULT_LANG
  };

  var screens = {};
  var listeners = {};
  var stack = [];
  var current = { id: '', params: {} };
  var lastHash = null;
  var pendingReplace = false;
  var started = false;
  var warnedI18n = false;

  var dom = {
    shell: null,
    header: null,
    back: null,
    title: null,
    action: null,
    banner: null,
    main: null,
    tabbar: null,
    tabAdmin: null,
    toast: null,
    modal: null
  };

  /* ------------------------------------------------------------------
   * 4. 小道具
   * ------------------------------------------------------------------ */
  function isFn(value) { return typeof value === 'function'; }

  function clear(node) {
    if (!node) { return node; }
    while (node.firstChild) { node.removeChild(node.firstChild); }
    return node;
  }

  function appendChild(parent, child) {
    if (child === null || child === undefined || child === false) { return; }
    if (Array.isArray(child)) {
      child.forEach(function (one) { appendChild(parent, one); });
      return;
    }
    if (typeof child === 'string' || typeof child === 'number') {
      parent.appendChild(document.createTextNode(String(child)));
      return;
    }
    if (child.nodeType) { parent.appendChild(child); return; }
    console.error('[App] el(): 子要素として扱えない値が渡されました', child);
  }

  var DIRECT_PROPS = ['id', 'type', 'value', 'checked', 'disabled', 'hidden', 'name', 'min', 'max', 'step', 'maxLength', 'rows', 'placeholder', 'src', 'alt', 'href', 'title', 'selected'];

  function el(tag, props, children) {
    var node = document.createElement(tag);
    var p = props || {};
    Object.keys(p).forEach(function (key) {
      var value = p[key];
      if (value === undefined || value === null || value === false) { return; }
      if (key === 'class') { node.className = value; return; }
      if (key === 'text') { node.textContent = String(value); return; }
      if (key === 'onClick') { node.addEventListener('click', value); return; }
      if (key === 'onInput') { node.addEventListener('input', value); return; }
      if (key === 'onChange') { node.addEventListener('change', value); return; }
      if (key === 'onSubmit') { node.addEventListener('submit', value); return; }
      if (key === 'dataset') {
        Object.keys(value).forEach(function (dataKey) { node.dataset[dataKey] = value[dataKey]; });
        return;
      }
      if (DIRECT_PROPS.indexOf(key) !== -1) { node[key] = value; return; }
      node.setAttribute(key, value === true ? '' : String(value));
    });
    appendChild(node, children);
    return node;
  }

  function button(options) {
    var o = options || {};
    var cls = 'btn btn--' + (o.variant || 'secondary');
    if (o.block !== false) { cls += ' btn--block'; }
    if (o.small) { cls += ' btn--sm'; }
    var node = el('button', { class: cls, type: o.type || 'button', text: o.label || '' });
    if (o.i18n) { node.setAttribute('data-i18n', o.i18n); }
    if (o.disabled) { node.disabled = true; }
    if (isFn(o.onClick)) { node.addEventListener('click', o.onClick); }
    return node;
  }

  function byId(id, required) {
    var node = document.getElementById(id);
    if (!node && required !== false) {
      console.error('[App] index.html に #' + id + ' がありません。app.js はこのidを前提にしています。');
    }
    return node;
  }

  /* ------------------------------------------------------------------
   * 5. 言語（辞書は i18n.js、無いときは予備辞書）
   * ------------------------------------------------------------------ */
  function interpolate(text, vars) {
    if (!vars) { return text; }
    var out = String(text);
    Object.keys(vars).forEach(function (key) {
      out = out.split('{' + key + '}').join(String(vars[key]));
    });
    return out;
  }

  function fallbackText(key) {
    var table = FALLBACK[state.lang] || FALLBACK[DEFAULT_LANG];
    if (table && table[key] !== undefined) { return table[key]; }
    if (FALLBACK[DEFAULT_LANG][key] !== undefined) { return FALLBACK[DEFAULT_LANG][key]; }
    return null;
  }

  function t(key, vars) {
    var i18n = global.I18n;
    var value = null;
    if (i18n && isFn(i18n.t)) {
      value = i18n.t(key, vars);
    } else if (isFn(global.t)) {
      value = global.t(key, vars);
    } else if (!warnedI18n) {
      warnedI18n = true;
      console.warn('[App] i18n.js（window.I18n.t）が見つかりません。app.js 内蔵の予備辞書で表示します。');
    }
    if (value === null || value === undefined || value === '' || value === key) {
      var alt = fallbackText(key);
      if (alt === null) {
        console.error('[App] 文言キーが辞書にありません: ' + key);
        return key;
      }
      value = alt;
    }
    return interpolate(value, vars);
  }

  function readLang() {
    var saved = null;
    if (global.Api && global.Api.storage && isFn(global.Api.storage.get)) {
      saved = global.Api.storage.get('lang');
    } else {
      console.error('[App] api.js の Api.storage.get がありません。言語設定を読み出せないため既定の日本語で表示します。');
    }
    var found = null;
    LANGS.forEach(function (one) { if (one.code === saved) { found = one.code; } });
    return found || DEFAULT_LANG;
  }

  function langTag() {
    var tag = 'ja-JP';
    LANGS.forEach(function (one) { if (one.code === state.lang) { tag = one.tag; } });
    return tag;
  }

  function applyI18n(root) {
    var scope = root || document;
    var i18n = global.I18n;
    if (i18n && isFn(i18n.apply)) { i18n.apply(scope); return; }
    /* i18n.js がまだ無い場合でも文言が出るように、同じ属性を app.js 側でも差し替える */
    var nodes = scope.querySelectorAll('[data-i18n]');
    var i;
    for (i = 0; i < nodes.length; i += 1) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
    nodes = scope.querySelectorAll('[data-i18n-aria]');
    for (i = 0; i < nodes.length; i += 1) {
      nodes[i].setAttribute('aria-label', t(nodes[i].getAttribute('data-i18n-aria')));
    }
    nodes = scope.querySelectorAll('[data-i18n-placeholder]');
    for (i = 0; i < nodes.length; i += 1) {
      nodes[i].setAttribute('placeholder', t(nodes[i].getAttribute('data-i18n-placeholder')));
    }
  }

  function pushLangToI18n(code) {
    var i18n = global.I18n;
    if (!i18n) { return; }
    if (isFn(i18n.setLang)) { i18n.setLang(code); return; }
    if (isFn(i18n.setLocale)) {
      console.warn('[App] I18n.setLang がないため I18n.setLocale を使いました。i18n.js の公開名を setLang に揃えてください。');
      i18n.setLocale(code);
      return;
    }
    console.error('[App] i18n.js に setLang も setLocale もありません。言語を切り替えても辞書側は追随しません。');
  }

  function setLang(code, options) {
    var opts = options || {};
    var known = false;
    LANGS.forEach(function (one) { if (one.code === code) { known = true; } });
    if (!known) {
      console.error('[App] 対応していない言語コードです: ' + code + '（対応: ja / en / ko）');
      return state.lang;
    }
    state.lang = code;
    document.documentElement.setAttribute('lang', code);
    if (global.Api && global.Api.storage && isFn(global.Api.storage.set)) {
      global.Api.storage.set('lang', code);
    }
    pushLangToI18n(code);
    applyI18n(document);
    emit('lang', code);
    if (!opts.silent) { render(true); }
    return state.lang;
  }

  function getLang() { return state.lang; }

  /* ------------------------------------------------------------------
   * 6. 書式
   * ------------------------------------------------------------------ */
  function toNumber(value) {
    var n = Number(value);
    return isFinite(n) ? n : 0;
  }

  function formatNumber(value) {
    var n = toNumber(value);
    try {
      return n.toLocaleString(langTag());
    } catch (e) {
      return String(n);
    }
  }

  function formatYen(value) { return '¥' + formatNumber(value); }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function toDate(value) {
    if (!value) { return null; }
    if (value instanceof Date) { return isNaN(value.getTime()) ? null : value; }
    var d = new Date(String(value));
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDate(value) {
    var d = toDate(value);
    if (!d) { return '—'; }
    return d.getFullYear() + '/' + pad2(d.getMonth() + 1) + '/' + pad2(d.getDate());
  }

  function formatDateTime(value) {
    var d = toDate(value);
    if (!d) { return '—'; }
    return formatDate(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function fromNow(value) {
    var d = toDate(value);
    if (!d) { return '—'; }
    var diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) { return t('common.justNow'); }
    if (diff < 3600) { return t('common.minutesAgo', { n: Math.floor(diff / 60) }); }
    if (diff < 86400) { return t('common.hoursAgo', { n: Math.floor(diff / 3600) }); }
    if (diff < 86400 * 7) { return t('common.daysAgo', { n: Math.floor(diff / 86400) }); }
    return formatDate(d);
  }

  /* ------------------------------------------------------------------
   * 7. 出来事の購読（画面が残高やユーザーの変化を受け取るため）
   * ------------------------------------------------------------------ */
  function on(name, fn) {
    if (!isFn(fn)) {
      console.error('[App] on(' + name + ') には関数を渡してください');
      return function () {};
    }
    if (!listeners[name]) { listeners[name] = []; }
    listeners[name].push(fn);
    return function () { off(name, fn); };
  }

  function off(name, fn) {
    var arr = listeners[name];
    if (!arr) { return; }
    var index = arr.indexOf(fn);
    if (index !== -1) { arr.splice(index, 1); }
  }

  function emit(name, payload) {
    var arr = listeners[name];
    if (!arr || !arr.length) { return; }
    arr.slice().forEach(function (fn) {
      try {
        fn(payload);
      } catch (err) {
        console.error('[App] ' + name + ' の購読者で例外が発生しました', err);
      }
    });
  }

  /* ------------------------------------------------------------------
   * 8. 共通の見た目（ローディング・空状態・バナー・トースト・モーダル）
   * ------------------------------------------------------------------ */
  function loadingBlock(options) {
    var o = options || {};
    var rows = typeof o.rows === 'number' ? o.rows : 2;
    var kids = [];
    var i;
    if (o.title !== false) { kids.push(el('div', { class: 'skeleton skeleton--title', 'aria-hidden': 'true' })); }
    if (o.card !== false) { kids.push(el('div', { class: 'skeleton skeleton--card', 'aria-hidden': 'true' })); }
    for (i = 0; i < rows; i += 1) {
      kids.push(el('div', { class: 'skeleton skeleton--row', 'aria-hidden': 'true' }));
    }
    kids.push(el('p', { class: 'loading-text', 'data-i18n': 'common.loading', text: t('common.loading') }));
    return el('div', { class: 'screen' }, kids);
  }

  function showLoading(root, options) {
    if (!root) {
      console.error('[App] showLoading(): 描画先の要素がありません');
      return null;
    }
    clear(root);
    var node = loadingBlock(options);
    root.appendChild(node);
    return node;
  }

  function empty(options) {
    var o = options || {};
    var kids = [el('p', { class: 'empty__text', text: o.text || '' })];
    if (o.actionLabel) {
      kids.push(button({
        label: o.actionLabel,
        variant: o.actionVariant || 'primary',
        block: false,
        onClick: o.onAction
      }));
    }
    return el('div', { class: 'empty' }, kids);
  }

  function messageOf(err) {
    if (err && typeof err.message === 'string' && err.message) { return err.message; }
    if (typeof err === 'string' && err) { return err; }
    return t('common.errorUnknown');
  }

  function errorBlock(message, retry) {
    var kids = [el('p', { class: 'banner__text', text: message || t('common.errorUnknown') })];
    if (isFn(retry)) {
      kids.push(el('button', { class: 'banner__retry', type: 'button', text: t('common.retry'), onClick: retry }));
    }
    return el('div', { class: 'banner', role: 'alert' }, kids);
  }

  function clearBanner() {
    if (dom.banner) { clear(dom.banner); }
  }

  function showBanner(message, retry) {
    if (!dom.banner) {
      console.error('[App] #banner-root がないためエラーバナーを表示できません: ' + message);
      return null;
    }
    clearBanner();
    var node = errorBlock(message, isFn(retry) ? function () { clearBanner(); retry(); } : null);
    node.appendChild(el('button', {
      class: 'banner__close',
      type: 'button',
      'aria-label': t('common.close'),
      text: '×',
      onClick: clearBanner
    }));
    dom.banner.appendChild(node);
    return node;
  }

  function handleError(err, retry) {
    console.error('[App] 通信または処理に失敗しました', err);
    var again = isFn(retry) ? retry : (err && isFn(err.retry) ? function () { err.retry(); } : null);
    showBanner(messageOf(err), again);
    return err;
  }

  function toast(message, kind) {
    if (!dom.toast) {
      console.error('[App] #toast-root がないためトーストを表示できません: ' + message);
      return null;
    }
    var cls = 'toast';
    if (kind === 'success') { cls += ' toast--success'; }
    if (kind === 'danger') { cls += ' toast--danger'; }
    var node = el('div', { class: cls }, [el('span', { class: 'toast__text', text: message })]);
    dom.toast.appendChild(node);
    while (dom.toast.children.length > 3) { dom.toast.removeChild(dom.toast.firstChild); }
    global.setTimeout(function () {
      if (node.parentNode) { node.parentNode.removeChild(node); }
    }, TOAST_MS);
    return node;
  }

  var modalState = null;

  function focusables(root) {
    var list = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]');
    var out = [];
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (!list[i].disabled && list[i].getAttribute('tabindex') !== '-1') { out.push(list[i]); }
    }
    return out;
  }

  function onModalKeydown(event) {
    if (!modalState) { return; }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== 'Tab') { return; }
    var items = focusables(dom.modal);
    if (!items.length) { return; }
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onModalBackdrop(event) {
    if (!modalState || !modalState.closeOnBackdrop) { return; }
    if (event.target === dom.modal) { closeModal(); }
  }

  function openModal(content, options) {
    var opts = options || {};
    if (!dom.modal) {
      console.error('[App] #modal-root がないためモーダルを表示できません');
      return null;
    }
    closeModal();
    modalState = {
      onClose: isFn(opts.onClose) ? opts.onClose : null,
      closeOnBackdrop: opts.closeOnBackdrop !== false,
      lastFocus: document.activeElement
    };
    dom.modal.className = 'modal-root' + (opts.sheet ? ' modal-root--sheet' : '');
    clear(dom.modal);
    dom.modal.appendChild(content);
    dom.modal.hidden = false;
    document.addEventListener('keydown', onModalKeydown, true);
    dom.modal.addEventListener('click', onModalBackdrop);
    applyI18n(dom.modal);
    var items = focusables(content);
    if (items.length) { items[0].focus(); }
    return content;
  }

  function openSheet(content, options) {
    var opts = options || {};
    opts.sheet = true;
    return openModal(content, opts);
  }

  function closeModal() {
    if (!modalState) { return; }
    var info = modalState;
    modalState = null;
    document.removeEventListener('keydown', onModalKeydown, true);
    if (dom.modal) {
      dom.modal.removeEventListener('click', onModalBackdrop);
      clear(dom.modal);
      dom.modal.hidden = true;
      dom.modal.className = 'modal-root';
    }
    if (info.lastFocus && isFn(info.lastFocus.focus)) {
      try { info.lastFocus.focus(); } catch (e) { /* すでに外れている要素は無視してよい */ }
    }
    if (info.onClose) { info.onClose(); }
  }

  function confirmDialog(options) {
    var o = options || {};
    return new Promise(function (resolve) {
      var settled = false;
      function finish(value) {
        if (settled) { return; }
        settled = true;
        resolve(value);
        closeModal();
      }
      var kids = [el('p', { class: 'modal__title', id: 'app-modal-title', text: o.title || t('common.confirm') })];
      if (o.message) { kids.push(el('p', { class: 'modal__body', text: o.message })); }
      if (o.note) { kids.push(el('p', { class: 'modal__note', text: o.note })); }
      kids.push(el('div', { class: 'modal__actions' }, [
        button({ label: o.cancelLabel || t('common.cancel'), variant: 'secondary', onClick: function () { finish(false); } }),
        button({ label: o.confirmLabel || t('common.ok'), variant: o.danger ? 'danger' : 'primary', onClick: function () { finish(true); } })
      ]));
      var modal = el('div', {
        class: 'modal',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'app-modal-title'
      }, kids);
      openModal(modal, { onClose: function () { finish(false); } });
    });
  }

  /* ------------------------------------------------------------------
   * 9. ユーザーとクレジット
   * ------------------------------------------------------------------ */
  function requireApi(path) {
    var parts = String(path).split('.');
    var obj = global.Api;
    var i;
    for (i = 0; i < parts.length; i += 1) {
      obj = obj ? obj[parts[i]] : undefined;
    }
    if (!isFn(obj)) {
      console.error('[App] api.js に Api.' + path + ' がありません。api.js が公開している名前を確認してください。');
      return null;
    }
    return obj;
  }

  function getUser() { return state.user; }

  function isAdmin() { return !!(state.user && state.user.is_admin); }

  function getBalance() {
    return state.user ? toNumber(state.user.credit_balance) : 0;
  }

  function hasUnlimited() {
    if (!state.user) { return false; }
    if (global.Api && global.Api.credits && isFn(global.Api.credits.hasUnlimited)) {
      return global.Api.credits.hasUnlimited(state.user);
    }
    console.error('[App] api.js に Api.credits.hasUnlimited がありません。無制限利用の判定ができません。');
    return false;
  }

  function setUser(user, options) {
    var opts = options || {};
    state.user = user || null;
    if (global.Api && global.Api.storage && isFn(global.Api.storage.set)) {
      if (user && user.id) {
        global.Api.storage.set('userId', user.id);
      } else if (isFn(global.Api.storage.remove)) {
        global.Api.storage.remove('userId');
      }
    }
    updateAdminTab();
    emit('user', state.user);
    emit('balance', getBalance());
    if (!opts.silent) { render(true); }
    return state.user;
  }

  function setBalance(value) {
    if (!state.user) {
      console.error('[App] ログイン中のユーザーがいないため残高を更新できません');
      return 0;
    }
    state.user.credit_balance = toNumber(value);
    emit('balance', getBalance());
    return getBalance();
  }

  function refreshUser() {
    if (!state.user || !state.user.id) { return Promise.resolve(null); }
    var get = requireApi('users.get');
    if (!get) { return Promise.reject(new Error('Api.users.get がありません')); }
    return get(state.user.id).then(function (user) {
      setUser(user, { silent: true });
      return user;
    });
  }

  // 消費するクレジット数は渡さない。feature_key だけ渡してサーバーが単価を引く。
  function consumeCredit(featureKey, memo) {
    if (!state.user) {
      console.error('[App] ログイン中のユーザーがいないためクレジットを消費できません');
      return Promise.reject(new Error('ログインが必要です'));
    }
    var consume = requireApi('credits.consume');
    if (!consume) { return Promise.reject(new Error('Api.credits.consume がありません')); }
    return consume(featureKey, memo).then(function (result) {
      if (result && result.user) { setUser(result.user, { silent: true }); }
      return result;
    });
  }

  /*
   * クレジット購入の入口は App には無い。決済ページへ移る導線は S17 だけが持つ。
   * 付与は支払い完了後に Stripe の webhook から行われる。
   */

  function logout() {
    // サーバー側のセッション失効を待たずに画面は戻す。トークンの破棄は必ず行われる。
    if (global.Api && global.Api.auth && isFn(global.Api.auth.signOut)) {
      global.Api.auth.signOut();
    }
    state.user = null;
    if (global.Api && global.Api.storage && isFn(global.Api.storage.clearSelection)) {
      global.Api.storage.clearSelection();
    }
    stack = [];
    updateAdminTab();
    emit('user', null);
    emit('balance', 0);
    replace('S1');
  }

  /*
   * 保存されたセッションからログイン状態を戻す。
   * 旧実装は localStorage の userId をそのまま信じていた（他人のIDを書けば入れた）。
   * いまはアクセストークンを持っていることがログイン状態そのもので、
   * 期限切れなら Api.auth.restore() の中で取り直す。
   */
  function restoreUser() {
    if (!global.Api || !global.Api.auth || !isFn(global.Api.auth.restore)) {
      console.error('[App] Api.auth がありません。api.js の読み込みを確認してください。');
      return Promise.resolve(null);
    }
    showLoading(dom.main);
    return global.Api.auth.restore().then(function (user) {
      if (user) { setUser(user, { silent: true }); }
      return user;
    }, function (err) {
      handleError(err, function () {
        restoreUser().then(function () { render(true); });
      });
      return null;
    });
  }

  /* ------------------------------------------------------------------
   * 10. ヘッダーとタブバー
   * ------------------------------------------------------------------ */
  function updateAdminTab() {
    if (!dom.tabAdmin) { return; }
    dom.tabAdmin.hidden = !isAdmin();
  }

  function setTitle(text) {
    if (!dom.title) { return; }
    dom.title.textContent = text || APP_NAME;
  }

  function setHeaderAction(node) {
    if (!dom.action) { return; }
    clear(dom.action);
    if (node) { dom.action.appendChild(node); }
  }

  function setHeader(options) {
    var o = options || {};
    if (o.title !== undefined) { setTitle(o.title); }
    if (dom.back && o.back !== undefined) { dom.back.hidden = !o.back; }
    if (o.action !== undefined) { setHeaderAction(o.action); }
  }

  function applyChrome(meta, route) {
    setTitle(t('screen.' + route.id));
    if (dom.back) {
      dom.back.hidden = !(stack.length > 1 || meta.back);
    }
    setHeaderAction(null);
    if (dom.tabbar) {
      dom.tabbar.hidden = !meta.tab;
      var items = dom.tabbar.querySelectorAll('.tabbar__item');
      var i;
      var isActive;
      for (i = 0; i < items.length; i += 1) {
        isActive = !!meta.tab && items[i].getAttribute('data-screen') === meta.tab;
        items[i].classList.toggle('tabbar__item--active', isActive);
        if (isActive) {
          items[i].setAttribute('aria-current', 'page');
        } else {
          items[i].removeAttribute('aria-current');
        }
      }
    }
    if (dom.shell) {
      dom.shell.classList.toggle('app-shell--no-tabbar', !meta.tab);
    }
    updateAdminTab();
  }

  /* ------------------------------------------------------------------
   * 11. ルーター
   * ------------------------------------------------------------------ */
  function parseRoute(hash) {
    var str = String(hash || '');
    if (str.charAt(0) === '#') { str = str.slice(1); }
    if (str.charAt(0) === '/') { str = str.slice(1); }
    var q = str.indexOf('?');
    var id = q === -1 ? str : str.slice(0, q);
    var query = q === -1 ? '' : str.slice(q + 1);
    var params = {};
    if (query) {
      query.split('&').forEach(function (pair) {
        if (!pair) { return; }
        var eq = pair.indexOf('=');
        var key = eq === -1 ? pair : pair.slice(0, eq);
        var value = eq === -1 ? '' : pair.slice(eq + 1);
        try {
          params[decodeURIComponent(key)] = decodeURIComponent(value.split('+').join(' '));
        } catch (e) {
          console.error('[App] URLのパラメータを読めませんでした: ' + pair, e);
        }
      });
    }
    return { id: id, params: params };
  }

  function hashFor(id, params) {
    var out = '#/' + String(id || '');
    var parts = [];
    if (params) {
      Object.keys(params).forEach(function (key) {
        var value = params[key];
        if (value === undefined || value === null || value === '') { return; }
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
      });
    }
    if (parts.length) { out += '?' + parts.join('&'); }
    return out;
  }

  function selectedProjectId() {
    if (global.Api && global.Api.storage && isFn(global.Api.storage.get)) {
      return global.Api.storage.get('projectId');
    }
    return null;
  }

  function fallbackParams(id) {
    if (PROJECT_SCOPED.indexOf(id) === -1) { return null; }
    var projectId = selectedProjectId();
    return projectId ? { id: projectId } : null;
  }

  function navigate(id, params) {
    var target = hashFor(id, params);
    if (global.location.hash === target) {
      render(true);
      return;
    }
    global.location.hash = target;
  }

  function replace(id, params) {
    var target = hashFor(id, params);
    if (global.location.hash === target) {
      render(true);
      return;
    }
    pendingReplace = true;
    global.location.replace(global.location.pathname + global.location.search + target);
  }

  function back() {
    if (stack.length > 1) {
      global.history.back();
      return;
    }
    var meta = SCREENS[current.id] || {};
    var target = meta.back || (state.user ? 'S3' : 'S1');
    replace(target, fallbackParams(target));
  }

  function screenMissingBlock(id) {
    var known = Object.keys(screens);
    console.error('[App] 画面 ' + id + ' が登録されていません。担当ファイルが App.registerScreen(' + id + ', { render: 関数 }) を呼んでいるか確認してください。登録済み: ' + (known.length ? known.join(' / ') : 'なし'));
    return el('div', { class: 'screen' }, [
      errorBlock(t('common.errorScreenMissing'), function () { global.location.reload(); })
    ]);
  }

  function render(force) {
    if (!dom.main) { return; }
    var route = current;
    if (!route.id) { return; }
    var meta = SCREENS[route.id];
    if (!meta) {
      console.error('[App] 未知の画面IDです: ' + route.id + '（S1〜S19 と settings のみ）');
      replace(state.user ? 'S3' : 'S1');
      return;
    }
    if (meta.auth && !state.user) {
      toast(t('common.loginRequired'), 'danger');
      replace('S1');
      return;
    }
    if (meta.admin && !isAdmin()) {
      toast(t('common.adminOnly'), 'danger');
      replace('S3');
      return;
    }
    clearBanner();
    closeModal();
    clear(dom.main);
    applyChrome(meta, route);
    var spec = screens[route.id];
    if (!spec) {
      dom.main.appendChild(screenMissingBlock(route.id));
      return;
    }
    try {
      spec.render(dom.main, route.params);
    } catch (err) {
      console.error('[App] 画面 ' + route.id + ' の描画で例外が発生しました', err);
      clear(dom.main);
      dom.main.appendChild(el('div', { class: 'screen' }, [
        errorBlock(t('common.errorRender'), function () { render(true); })
      ]));
    }
    applyI18n(dom.main);
    try { global.scrollTo(0, 0); } catch (e) { /* スクロール位置を戻せなくても表示は続ける */ }
    emit('route', { id: route.id, params: route.params, force: !!force });
  }

  function onHashChange() {
    var hash = global.location.hash || '';
    var route = parseRoute(hash);
    if (!route.id) {
      replace(state.user ? 'S3' : 'S1');
      return;
    }
    if (pendingReplace) {
      pendingReplace = false;
      if (stack.length) { stack[stack.length - 1] = hash; } else { stack.push(hash); }
    } else if (stack.length > 1 && stack[stack.length - 2] === hash) {
      stack.pop();
    } else if (stack[stack.length - 1] !== hash) {
      stack.push(hash);
    }
    if (lastHash === hash && current.id === route.id) { return; }
    lastHash = hash;
    current = route;
    render();
  }

  function registerScreen(id, spec) {
    if (!id || typeof id !== 'string') {
      console.error('[App] registerScreen(): 画面IDが文字列ではありません', id);
      return;
    }
    if (!spec || typeof spec !== 'object' || !isFn(spec.render)) {
      console.error('[App] registerScreen(' + id + '): 第2引数は { render: 関数 } のオブジェクトでなければなりません。関数をそのまま渡していないか確認してください。受け取った型: ' + (spec === null ? 'null' : typeof spec));
      return;
    }
    if (!SCREENS[id]) {
      console.error('[App] registerScreen(' + id + '): 画面表にないIDです（S1〜S19 と settings のみ）。綴りを確認してください。');
      return;
    }
    if (screens[id]) {
      console.warn('[App] registerScreen(' + id + '): 同じIDが二重に登録されました。後から登録した方を使います。');
    }
    screens[id] = spec;
    if (started && current.id === id) { render(true); }
  }

  /* ------------------------------------------------------------------
   * 12. settings 画面（app.js が登録する唯一の画面）
   * ------------------------------------------------------------------ */
  function infoRow(key, value) {
    return el('div', { class: 'info-row' }, [
      el('span', { class: 'info-row__key', text: key }),
      el('span', { class: 'info-row__val', text: value })
    ]);
  }

  function languageSection() {
    var select = el('select', { class: 'select', id: 'lang-select', 'aria-label': t('settings.language') });
    LANGS.forEach(function (one) {
      var option = el('option', { value: one.code, text: one.label });
      if (one.code === state.lang) { option.selected = true; }
      select.appendChild(option);
    });
    select.addEventListener('change', function () { setLang(select.value); });
    return el('section', { class: 'section' }, [
      el('div', { class: 'section__head' }, [
        el('h2', { class: 'section__title', text: t('settings.language') })
      ]),
      el('p', { class: 'section__desc', text: t('settings.languageHint') }),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'lang-select', text: t('settings.language') }),
        select
      ])
    ]);
  }

  function providerLabel(user) {
    return user && user.auth_provider === 'google' ? t('settings.providerGoogle') : t('settings.providerEmail');
  }

  function accountSection() {
    var user = state.user;
    if (!user) {
      return el('section', { class: 'section' }, [
        el('div', { class: 'section__head' }, [
          el('h2', { class: 'section__title', text: t('settings.guest') })
        ]),
        empty({
          text: t('settings.guestHint'),
          actionLabel: t('settings.login'),
          onAction: function () { navigate('S1'); }
        })
      ]);
    }

    var balanceCard = el('button', {
      class: 'card card--gradient',
      type: 'button',
      role: 'button',
      onClick: function () { navigate('S17'); }
    }, [
      el('span', { class: 'card__label', text: t('settings.balance') }),
      el('span', { class: 'card__value', text: formatNumber(getBalance()) }),
      el('span', { class: 'card__unit', text: t('common.creditUnit') })
    ]);
    if (hasUnlimited()) {
      balanceCard.appendChild(el('span', {
        class: 'card__sub',
        text: t('settings.unlimited', { date: formatDate(user.unlimited_until) })
      }));
    }

    var rows = [
      infoRow(t('settings.displayName'), user.display_name || '—'),
      infoRow(t('settings.email'), user.email || '—'),
      infoRow(t('settings.provider'), providerLabel(user)),
      infoRow(t('settings.role'), isAdmin() ? t('settings.roleAdmin') : t('settings.roleUser')),
      infoRow(t('settings.since'), formatDate(user.created_at))
    ];

    var actions = [
      button({ label: t('settings.goCredit'), variant: 'secondary', onClick: function () { navigate('S17'); } })
    ];
    if (isAdmin()) {
      actions.push(button({ label: t('settings.goAdmin'), variant: 'secondary', onClick: function () { navigate('S18'); } }));
    }
    actions.push(button({
      label: t('settings.logout'),
      variant: 'danger',
      onClick: function () {
        confirmDialog({
          title: t('settings.logoutTitle'),
          message: t('settings.logoutBody'),
          confirmLabel: t('settings.logout'),
          danger: true
        }).then(function (yes) {
          if (!yes) { return; }
          logout();
          toast(t('settings.loggedOut'), 'success');
        });
      }
    }));

    return el('section', { class: 'section' }, [
      el('div', { class: 'section__head' }, [
        el('h2', { class: 'section__title', text: t('settings.account') })
      ]),
      balanceCard,
      el('div', { class: 'info-list' }, rows),
      el('div', { class: 'stack' }, actions)
    ]);
  }

  function appInfoSection() {
    var url = (global.Api && global.Api.URL) ? global.Api.URL : '—';
    return el('section', { class: 'section' }, [
      el('div', { class: 'section__head' }, [
        el('h2', { class: 'section__title', text: t('settings.appInfo') })
      ]),
      el('div', { class: 'info-list' }, [
        infoRow(t('settings.version'), APP_NAME + ' ' + APP_VERSION),
        infoRow(t('settings.server'), url)
      ]),
      el('p', { class: 'note-box', text: t('settings.notice') })
    ]);
  }

  function renderSettings(root) {
    root.appendChild(el('div', { class: 'screen' }, [
      el('div', { class: 'screen__head' }, [
        el('h1', { class: 'screen__title', text: t('screen.settings') }),
        el('p', { class: 'screen__lead', text: t('common.sharedDataNotice') })
      ]),
      languageSection(),
      accountSection(),
      appInfoSection()
    ]));
  }

  /* ------------------------------------------------------------------
   * 13. 起動
   * ------------------------------------------------------------------ */
  function cacheDom() {
    dom.shell = document.querySelector('.app-shell');
    if (!dom.shell) { console.error('[App] index.html に .app-shell がありません'); }
    dom.header = byId('app-header');
    dom.back = byId('header-back');
    dom.title = byId('header-title');
    dom.action = byId('header-action');
    dom.banner = byId('banner-root');
    dom.main = byId('app');
    dom.tabbar = byId('tabbar');
    dom.tabAdmin = byId('tab-admin');
    dom.toast = byId('toast-root');
    dom.modal = byId('modal-root');
  }

  function tabTargetOf(node) {
    var target = node;
    while (target && target !== dom.tabbar) {
      if (target.getAttribute && target.getAttribute('data-screen')) { return target; }
      target = target.parentNode;
    }
    return null;
  }

  function wireChrome() {
    if (dom.back) {
      dom.back.addEventListener('click', function () { back(); });
    }
    if (dom.tabbar) {
      dom.tabbar.addEventListener('click', function (event) {
        var target = tabTargetOf(event.target);
        if (!target) { return; }
        var id = target.getAttribute('data-screen');
        if (current.id === id) { render(true); return; }
        navigate(id, fallbackParams(id));
      });
    }
  }

  function onUnhandledRejection(event) {
    var reason = event ? event.reason : null;
    console.error('[App] 処理されなかったエラーがあります（画面側で catch していない可能性があります）', reason);
    toast(messageOf(reason), 'danger');
  }

  function start() {
    if (started) { return; }
    started = true;
    cacheDom();

    if (!global.Api) {
      console.error('[App] api.js が読み込まれていません（window.Api がありません）。index.html の読み込み順を確認してください。');
      showBanner(t('common.errorApiMissing'), function () { global.location.reload(); });
    }

    // Google ログインから戻った直後は URL のハッシュにトークンが入っている。
    // ルーターより先に取り込んで消す（消さないと '#access_token=...' を画面IDとして読む）。
    if (global.Api && global.Api.auth && isFn(global.Api.auth.consumeRedirect)) {
      global.Api.auth.consumeRedirect();
    }

    state.lang = readLang();
    document.documentElement.setAttribute('lang', state.lang);
    pushLangToI18n(state.lang);
    applyI18n(document);

    wireChrome();
    global.addEventListener('hashchange', onHashChange);
    global.addEventListener('unhandledrejection', onUnhandledRejection);

    restoreUser().then(function () {
      updateAdminTab();
      if (!global.location.hash) {
        replace(state.user ? 'S3' : 'S1');
      }
      onHashChange();
    }, function (err) {
      handleError(err);
      replace('S1');
      onHashChange();
    });
  }

  /* ------------------------------------------------------------------
   * 14. 公開
   * ------------------------------------------------------------------ */
  var App = {
    NAME: APP_NAME,
    VERSION: APP_VERSION,
    LANGS: LANGS,

    registerScreen: registerScreen,
    meta: function (id) { return SCREENS[id] || null; },
    screenIds: function () { return Object.keys(SCREENS); },

    navigate: navigate,
    replace: replace,
    back: back,
    hashFor: hashFor,
    currentRoute: function () { return { id: current.id, params: current.params }; },
    rerender: function () { render(true); },

    setHeader: setHeader,
    setTitle: setTitle,
    setHeaderAction: setHeaderAction,

    t: t,
    getLang: getLang,
    setLang: setLang,
    applyI18n: applyI18n,

    formatNumber: formatNumber,
    formatYen: formatYen,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    fromNow: fromNow,

    el: el,
    clear: clear,
    button: button,

    showLoading: showLoading,
    loadingBlock: loadingBlock,
    empty: empty,
    errorBlock: errorBlock,
    showBanner: showBanner,
    clearBanner: clearBanner,
    handleError: handleError,
    messageOf: messageOf,
    toast: toast,
    confirm: confirmDialog,
    openModal: openModal,
    openSheet: openSheet,
    closeModal: closeModal,

    getUser: getUser,
    setUser: setUser,
    logout: logout,
    isAdmin: isAdmin,
    refreshUser: refreshUser,
    getBalance: getBalance,
    setBalance: setBalance,
    hasUnlimited: hasUnlimited,
    consumeCredit: consumeCredit,

    on: on,
    off: off,

    start: start
  };

  if (global.App) {
    console.warn('[App] window.App がすでに定義されています。app.js が二重に読み込まれていないか確認してください。');
  }
  global.App = App;

  registerScreen('settings', { render: function (root) { renderSettings(root); } });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window);
