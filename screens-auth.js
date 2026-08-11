/*!
 * screens-auth.js — エルピーヤ
 * S1 ログイン / S2 会員登録 の2画面だけを担当する。
 *
 * ---- 他ファイルとの約束（この綴りのまま使う。似た名前を作らない）----
 * 画面登録は index.html の契約どおり1形式だけ:
 *   App.registerScreen("S1", { render: function (root, params) { ... } });
 *   第2引数は必ず { render: 関数 } オブジェクト。関数をそのまま渡さない。
 *   window.renderXxx / window.Screens.Xxx などの別方式は混ぜない。
 *
 * 画面遷移は index.html に書かれたハッシュ経路をそのまま使う:
 *   location.hash = '#/S3'（パラメータ付きは '#/S1?signup=done'）
 *   app.js の関数名を推測しないため、遷移だけは必ずこの方式にする。
 *
 * api.js（window.Api）から使う名前（api.js が実際に公開しているものだけ）:
 *   Api.users.first(options) / Api.users.insert(row) / Api.users.update(id, patch) / Api.users.count(options)
 *   Api.today()  … 'YYYY-MM-DD'（last_login_at / password_updated_at 用）
 *   Api.storage.set('userId', id) / Api.storage.get('lang')
 *   失敗時の reject は必ず ApiError（err.message は日本語・err.retry() で再試行）
 *
 * app.js に任意で置ける窓口（無ければ何が無いかをコンソールに残したうえで、
 * このファイル側の予備実装で必ず動かす。黙って握りつぶさない）:
 *   App.setCurrentUser(ユーザー行)   … 現在ユーザーのグローバル状態
 *   App.setHeader({ title, back })   … 共通ヘッダー
 *   App.setTabbarVisible(真偽値)      … 下部タブバーの出し分け（S1・S2 では隠す）
 *   App.toast(文言, 種類)             … トースト
 *   I18n.getLocale() / I18n.onChange(関数) … 言語と切替通知
 *
 * このファイルが触る class は styles.css に実在するものだけ:
 *   screen / screen__head / screen__title / screen__lead
 *   section / section__title / stack / stack--tight / stack--group / row / row--between
 *   field / field__label / field__hint / field__error / input / input--error
 *   btn / btn--primary / btn--secondary / btn--text / btn--block
 *   card / note-box / warn-box / banner / banner__text / banner__retry
 *   progress / progress__bar / progress__label / badge / badge--ok / divider
 *   loading-inline / t-note / t-ok / toast / toast__text / toast--success / toast--danger
 *   app-shell / app-shell--no-tabbar
 * 触る id は index.html にあるものだけ:
 *   header-title / header-back / header-action / tabbar / toast-root
 *
 * サーバーの認証機能は無い。パスワードは端末内で変換した文字列を
 * a2f58db45_users.password_hash に入れているだけで、暗号としての強度は無い。
 * 「Googleで続行 / Googleで登録」も本物のOAuthではない。Googleの画面は開かず、
 * 偽のGoogleログイン画面も作らない。ボタン名と説明に体験用であることを明記する。
 */
(function (window, document) {
  'use strict';

  var App = window.App;
  if (!App || typeof App.registerScreen !== 'function') {
    console.error('[screens-auth.js] App.registerScreen(画面ID, { render: 関数 }) が見つかりません。index.html の読み込み順（app.js → screens-auth.js）を確認してください。S1・S2 は描画されません。');
    return;
  }
  if (!window.Api || !window.Api.users || !window.Api.storage) {
    console.error('[screens-auth.js] window.Api（api.js）が見つからないか、Api.users / Api.storage がありません。api.js が screens-auth.js より先に読み込まれているか確認してください。');
  }

  var Api = window.Api;
  var APP_NAME = 'エルピーヤ';

  /* =========================================================
     1. 文言（日本語・English・한국어。初期値は日本語）
     画面に出る文字はボタン・検証・空状態・通知まですべてここに置く。
     ========================================================= */

  var TEXT = {
    ja: {
      retry: '再試行',
      cancel: 'キャンセル',
      errUnknown: '処理に失敗しました。もう一度お試しください。',
      storageNotice: 'アカウントは共有のデータベース（Supabase）に保存されます。このアプリを開いた全員が同じデータを見ます。',
      passwordNotice: 'パスワードは端末内で簡易的に変換して保存します。暗号としての強度はないので、他のサービスで使っているパスワードは入力しないでください。',

      s1Title: 'ログイン',
      s1Lead: 'おかえりなさい',
      s1Sub: 'メールまたはGoogleで続行',
      email: 'メールアドレス',
      emailPh: 'you@example.com',
      password: 'パスワード',
      passwordPh: '8文字以上',
      login: 'ログイン',
      loginBusy: 'ログイン中…',
      googleContinue: 'Googleで続行（体験用）',
      signupLink: '新規登録',
      forgotTitle: 'パスワードをお忘れですか？',
      forgotBody: 'この体験版ではメールでの再設定ができません。管理者にお問い合わせください。',

      errEmailEmpty: 'メールアドレスを入力してください',
      errEmailFormat: 'メールアドレスの形式が正しくありません',
      errPwEmpty: 'パスワードを入力してください',
      errPwShort: 'パスワードは8文字以上で入力してください',
      errAuth: '認証情報が正しくありません',
      errStopped: 'このアカウントは現在利用できません。管理者にお問い合わせください。',
      errGoogleOnly: 'このアカウントはGoogle連携でのみログインできます。「Googleで続行（体験用）」をお使いください。',
      loginDone: 'ログインしました',
      signedUpNotice: 'アカウントを作成しました。登録したメールアドレスとパスワードでログインしてください。',

      s2Title: '新規会員登録',
      s2Lead: 'アカウントを作成',
      s2Sub: '利用規約に同意のうえ登録',
      displayName: '表示名',
      displayNamePh: '例：山田太郎',
      displayNameHint: '1〜20文字',
      signupPwHint: '英字と数字を含む8文字以上',
      strengthLabel: 'パスワードの強度',
      strengthWeak: '弱い',
      strengthMid: '普通',
      strengthStrong: '強い',
      register: '登録する',
      registerBusy: '登録中…',
      googleSignup: 'Googleで登録（体験用）',
      backToLogin: 'ログインへ戻る',
      errNameEmpty: '表示名を入力してください',
      errNameLong: '表示名は20文字以内で入力してください',
      errPwAlnum: 'パスワードは英字と数字を含む8文字以上で入力してください',
      errEmailTaken: 'このメールアドレスは登録済みです',
      emailChecking: '登録済みかどうかを確認しています…',
      emailFree: 'このメールアドレスは使えます',
      signupNoMail: '確認メールはこの体験版では送信されません。登録後すぐにログインできます。',
      signupDone: 'アカウントを作成しました。「ログインへ戻る」からログインしてください。',
      signupDoneToast: 'アカウントを作成しました',
      adminGranted: '最初の登録者のため、このアカウントは管理者になりました。',

      googleTitle: '体験用の擬似Google連携',
      googleNote: 'サーバーとOAuthの設定がないため、これは本物のGoogle認証ではありません。Googleの画面は開きません。ここに入力したメールアドレスで auth_provider=google のアカウントを作る（同じメールのアカウントがあれば連携する）体験用の機能です。',
      googleEmail: 'Googleアカウントのメールアドレス',
      googleName: 'Googleの表示名',
      googleNameHint: '未入力のときはメールアドレスから作ります',
      googleLink: 'この内容で続行',
      googleBusy: '連携中…',
      googleCancelled: 'Google連携をキャンセルしました。もう一度お試しください。',
      googleCreated: 'Googleアカウントで登録しました',
      googleLinked: '既存のアカウントにGoogleを連携しました'
    },

    en: {
      retry: 'Retry',
      cancel: 'Cancel',
      errUnknown: 'Something went wrong. Please try again.',
      storageNotice: 'Accounts are stored in a shared database (Supabase). Everyone who opens this app sees the same data.',
      passwordNotice: 'Passwords are only lightly scrambled on the device before being stored. This is not real encryption, so do not reuse a password from another service.',

      s1Title: 'Sign in',
      s1Lead: 'Welcome back',
      s1Sub: 'Continue with email or Google',
      email: 'Email address',
      emailPh: 'you@example.com',
      password: 'Password',
      passwordPh: '8 characters or more',
      login: 'Sign in',
      loginBusy: 'Signing in…',
      googleContinue: 'Continue with Google (demo)',
      signupLink: 'Create an account',
      forgotTitle: 'Forgot your password?',
      forgotBody: 'This demo build cannot send a reset email. Please contact an administrator.',

      errEmailEmpty: 'Please enter your email address',
      errEmailFormat: 'This email address is not in a valid format',
      errPwEmpty: 'Please enter your password',
      errPwShort: 'Your password must be at least 8 characters',
      errAuth: 'Your sign-in details are incorrect',
      errStopped: 'This account is currently unavailable. Please contact an administrator.',
      errGoogleOnly: 'This account can only sign in through Google. Please use “Continue with Google (demo)”.',
      loginDone: 'Signed in',
      signedUpNotice: 'Your account was created. Sign in with the email address and password you registered.',

      s2Title: 'Create an account',
      s2Lead: 'Create an account',
      s2Sub: 'By registering you agree to the terms of use',
      displayName: 'Display name',
      displayNamePh: 'e.g. Taro Yamada',
      displayNameHint: '1 to 20 characters',
      signupPwHint: '8 characters or more, with letters and numbers',
      strengthLabel: 'Password strength',
      strengthWeak: 'Weak',
      strengthMid: 'Fair',
      strengthStrong: 'Strong',
      register: 'Register',
      registerBusy: 'Registering…',
      googleSignup: 'Sign up with Google (demo)',
      backToLogin: 'Back to sign in',
      errNameEmpty: 'Please enter a display name',
      errNameLong: 'Your display name must be 20 characters or fewer',
      errPwAlnum: 'Your password must be at least 8 characters and contain letters and numbers',
      errEmailTaken: 'This email address is already registered',
      emailChecking: 'Checking whether this address is already registered…',
      emailFree: 'This email address is available',
      signupNoMail: 'No confirmation email is sent in this demo build. You can sign in right after registering.',
      signupDone: 'Your account was created. Tap “Back to sign in” to sign in.',
      signupDoneToast: 'Account created',
      adminGranted: 'This is the first registered account, so it was made an administrator.',

      googleTitle: 'Simulated Google link (demo only)',
      googleNote: 'There is no server or OAuth setup, so this is not real Google authentication and no Google screen opens. It only creates an account with auth_provider=google for the address you type here, or links it to an existing account with the same address.',
      googleEmail: 'Google account email address',
      googleName: 'Google display name',
      googleNameHint: 'Left empty, it is built from the email address',
      googleLink: 'Continue with this',
      googleBusy: 'Linking…',
      googleCancelled: 'The Google link was cancelled. Please try again.',
      googleCreated: 'Registered with a Google account',
      googleLinked: 'Google was linked to your existing account'
    },

    ko: {
      retry: '다시 시도',
      cancel: '취소',
      errUnknown: '처리에 실패했습니다. 다시 시도해 주세요.',
      storageNotice: '계정은 공유 데이터베이스(Supabase)에 저장됩니다. 이 앱을 연 모든 사람이 같은 데이터를 봅니다.',
      passwordNotice: '비밀번호는 기기 안에서 간단히 변환해 저장합니다. 암호로서의 강도는 없으니 다른 서비스에서 쓰는 비밀번호는 입력하지 마세요.',

      s1Title: '로그인',
      s1Lead: '다시 오신 것을 환영합니다',
      s1Sub: '이메일 또는 Google로 계속하기',
      email: '이메일 주소',
      emailPh: 'you@example.com',
      password: '비밀번호',
      passwordPh: '8자 이상',
      login: '로그인',
      loginBusy: '로그인 중…',
      googleContinue: 'Google로 계속하기(체험용)',
      signupLink: '신규 가입',
      forgotTitle: '비밀번호를 잊으셨나요?',
      forgotBody: '이 체험판에서는 메일로 재설정할 수 없습니다. 관리자에게 문의해 주세요.',

      errEmailEmpty: '이메일 주소를 입력해 주세요',
      errEmailFormat: '이메일 주소 형식이 올바르지 않습니다',
      errPwEmpty: '비밀번호를 입력해 주세요',
      errPwShort: '비밀번호는 8자 이상으로 입력해 주세요',
      errAuth: '인증 정보가 올바르지 않습니다',
      errStopped: '이 계정은 현재 사용할 수 없습니다. 관리자에게 문의해 주세요.',
      errGoogleOnly: '이 계정은 Google 연동으로만 로그인할 수 있습니다. “Google로 계속하기(체험용)”를 사용해 주세요.',
      loginDone: '로그인했습니다',
      signedUpNotice: '계정을 만들었습니다. 등록한 이메일 주소와 비밀번호로 로그인해 주세요.',

      s2Title: '신규 회원가입',
      s2Lead: '계정 만들기',
      s2Sub: '이용약관에 동의하고 가입합니다',
      displayName: '표시 이름',
      displayNamePh: '예: 홍길동',
      displayNameHint: '1~20자',
      signupPwHint: '영문과 숫자를 포함해 8자 이상',
      strengthLabel: '비밀번호 강도',
      strengthWeak: '약함',
      strengthMid: '보통',
      strengthStrong: '강함',
      register: '가입하기',
      registerBusy: '가입 중…',
      googleSignup: 'Google로 가입(체험용)',
      backToLogin: '로그인으로 돌아가기',
      errNameEmpty: '표시 이름을 입력해 주세요',
      errNameLong: '표시 이름은 20자 이내로 입력해 주세요',
      errPwAlnum: '비밀번호는 영문과 숫자를 포함해 8자 이상으로 입력해 주세요',
      errEmailTaken: '이미 가입된 이메일 주소입니다',
      emailChecking: '이미 가입된 주소인지 확인하고 있습니다…',
      emailFree: '사용할 수 있는 이메일 주소입니다',
      signupNoMail: '이 체험판에서는 확인 메일을 보내지 않습니다. 가입 후 바로 로그인할 수 있습니다.',
      signupDone: '계정을 만들었습니다. “로그인으로 돌아가기”에서 로그인해 주세요.',
      signupDoneToast: '계정을 만들었습니다',
      adminGranted: '첫 가입자이므로 이 계정은 관리자가 되었습니다.',

      googleTitle: '체험용 모의 Google 연동',
      googleNote: '서버와 OAuth 설정이 없어 실제 Google 인증이 아닙니다. Google 화면은 열리지 않습니다. 여기에 입력한 이메일 주소로 auth_provider=google 계정을 만들거나, 같은 주소의 계정이 있으면 연동하는 체험용 기능입니다.',
      googleEmail: 'Google 계정 이메일 주소',
      googleName: 'Google 표시 이름',
      googleNameHint: '비워 두면 이메일 주소에서 만듭니다',
      googleLink: '이 내용으로 계속',
      googleBusy: '연동 중…',
      googleCancelled: 'Google 연동을 취소했습니다. 다시 시도해 주세요.',
      googleCreated: 'Google 계정으로 가입했습니다',
      googleLinked: '기존 계정에 Google을 연동했습니다'
    }
  };

  var LANGS = ['ja', 'en', 'ko'];

  function currentLang() {
    var code = null;
    var I18n = window.I18n;
    if (I18n && typeof I18n.getLocale === 'function') { code = I18n.getLocale(); }
    else if (I18n && typeof I18n.locale === 'string') { code = I18n.locale; }
    else if (Api && Api.storage) { code = Api.storage.get('lang'); }
    code = String(code || '').slice(0, 2).toLowerCase();
    return LANGS.indexOf(code) >= 0 ? code : 'ja';
  }

  function t(key) {
    var dict = TEXT[currentLang()] || TEXT.ja;
    if (Object.prototype.hasOwnProperty.call(dict, key)) { return dict[key]; }
    if (Object.prototype.hasOwnProperty.call(TEXT.ja, key)) {
      console.error('[screens-auth.js] ' + currentLang() + ' の訳がありません: ' + key + '（日本語で表示します）');
      return TEXT.ja[key];
    }
    console.error('[screens-auth.js] 未定義の文言キーです: ' + key);
    return key;
  }

  /* =========================================================
     2. app.js との橋渡し（無い名前は一度だけコンソールに残す）
     ========================================================= */

  var reported = {};

  function report(name, fallbackNote) {
    if (reported[name]) { return; }
    reported[name] = true;
    console.error('[screens-auth.js] ' + name + ' がありません（app.js 側の綴りを確認してください）。' + fallbackNote);
  }

  // 遷移は index.html に書かれたハッシュ経路をそのまま使う（関数名を推測しない）。
  function go(screenId, query) {
    window.location.hash = '#/' + screenId + (query ? '?' + query : '');
  }

  function setHeader() {
    if (typeof App.setHeader === 'function') {
      App.setHeader({ title: APP_NAME, back: false });
      return;
    }
    report('App.setHeader({ title, back })', 'index.html の #header-title / #header-back を直接更新します。');
    var title = document.getElementById('header-title');
    if (title) { title.textContent = APP_NAME; }
    var back = document.getElementById('header-back');
    if (back) { back.hidden = true; }
    var action = document.getElementById('header-action');
    if (action) { action.innerHTML = ''; }
  }

  var tabbarRestoreBound = false;

  function bindTabbarRestore() {
    if (tabbarRestoreBound) { return; }
    tabbarRestoreBound = true;
    window.addEventListener('hashchange', function () {
      var id = String(window.location.hash || '').replace('#/', '').split('?')[0];
      if (id === 'S1' || id === 'S2' || id === '') { return; }
      var bar = document.getElementById('tabbar');
      if (bar) { bar.hidden = false; }
      var shell = document.querySelector('.app-shell');
      if (shell) { shell.classList.remove('app-shell--no-tabbar'); }
    });
  }

  function hideTabbar() {
    if (typeof App.setTabbarVisible === 'function') {
      App.setTabbarVisible(false);
      return;
    }
    report('App.setTabbarVisible(真偽値)', 'screens-auth.js 側で #tabbar を隠し、S1・S2 を離れたら戻します。');
    bindTabbarRestore();
    var bar = document.getElementById('tabbar');
    if (bar) { bar.hidden = true; }
    var shell = document.querySelector('.app-shell');
    if (shell) { shell.classList.add('app-shell--no-tabbar'); }
  }

  function toast(message, kind) {
    if (typeof App.toast === 'function') {
      App.toast(message, kind);
      return;
    }
    report('App.toast(文言, 種類)', 'screens-auth.js 側の予備トーストを #toast-root に表示します。');
    var root = document.getElementById('toast-root');
    if (!root) {
      console.log('[screens-auth.js] ' + message);
      return;
    }
    root.innerHTML = '';
    var box = el('div', 'toast' + (kind === 'success' ? ' toast--success' : (kind === 'danger' ? ' toast--danger' : '')));
    box.appendChild(el('span', 'toast__text', message));
    root.appendChild(box);
    window.setTimeout(function () {
      if (box.parentNode === root) { root.removeChild(box); }
    }, 3200);
  }

  // 現在ユーザーの引き渡し。Api.storage の userId は api.js が許可している唯一の保存先。
  function adoptUser(user) {
    if (Api && Api.storage) { Api.storage.set('userId', user.id); }
    if (typeof App.setCurrentUser === 'function') {
      App.setCurrentUser(user);
      return;
    }
    report('App.setCurrentUser(ユーザー行)', 'Api.storage の userId のみ更新しました。app.js はここから現在ユーザーを読み込んでください。');
    App.currentUser = user;
  }

  /* =========================================================
     3. 検証・パスワード・擬似google_sub
     ========================================================= */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function normalizeEmail(v) {
    return String(v || '').trim().toLowerCase();
  }

  function emailIssue(v) {
    var s = String(v || '').trim();
    if (!s) { return 'errEmailEmpty'; }
    if (!EMAIL_RE.test(s)) { return 'errEmailFormat'; }
    return null;
  }

  function loginPasswordIssue(v) {
    var s = String(v || '');
    if (!s) { return 'errPwEmpty'; }
    if (s.length < 8) { return 'errPwShort'; }
    return null;
  }

  function signupPasswordIssue(v) {
    var s = String(v || '');
    if (!s) { return 'errPwEmpty'; }
    if (s.length < 8 || !/[A-Za-z]/.test(s) || !/[0-9]/.test(s)) { return 'errPwAlnum'; }
    return null;
  }

  function nameIssue(v) {
    var s = String(v || '').trim();
    if (!s) { return 'errNameEmpty'; }
    if (s.length > 20) { return 'errNameLong'; }
    return null;
  }

  function strength(pw) {
    var s = String(pw || '');
    if (!s) { return 0; }
    var score = 0;
    if (s.length >= 8) { score += 34; }
    if (s.length >= 12) { score += 16; }
    if (/[A-Za-z]/.test(s)) { score += 16; }
    if (/[0-9]/.test(s)) { score += 17; }
    if (/[^A-Za-z0-9]/.test(s)) { score += 17; }
    return Math.min(100, score);
  }

  function strengthKey(score) {
    if (score < 50) { return 'strengthWeak'; }
    if (score < 84) { return 'strengthMid'; }
    return 'strengthStrong';
  }

  function fnv1a(str, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  function hex8(n) {
    return ('00000000' + (n >>> 0).toString(16)).slice(-8);
  }

  // ponytail: サーバーが無いので純JSの反復ハッシュ。暗号強度は無い。
  // 本番の認証が要るときは Supabase Auth（bcrypt/argon2）へ差し替える。
  function hashPassword(plain) {
    var s = 'elpiya.v1$' + String(plain === undefined || plain === null ? '' : plain);
    var a = 2166136261;
    var b = 1103515245;
    for (var round = 0; round < 600; round++) {
      a = fnv1a(s + '|' + round + '|' + hex8(b), a);
      b = fnv1a(hex8(a) + '|' + round + '|' + s, b);
    }
    return 'v1$' + hex8(a) + hex8(b) + hex8(a ^ b) + hex8((a + b) >>> 0);
  }

  function verifyPassword(plain, stored) {
    if (!stored) { return false; }
    return hashPassword(plain) === String(stored);
  }

  // 本物の Google の sub ではない。体験用に、メールアドレスから決まる値を作るだけ。
  function pseudoGoogleSub(email) {
    var e = normalizeEmail(email);
    return 'demo-google-' + hex8(fnv1a(e, 2166136261)) + hex8(fnv1a('sub|' + e, 1103515245));
  }

  function nameFromEmail(email) {
    var e = normalizeEmail(email);
    var local = e.split('@')[0] || 'user';
    return local.slice(0, 20);
  }

  function AuthFail(key) {
    this.name = 'AuthFail';
    this.authFail = true;
    this.key = key;
    this.message = key;
  }
  AuthFail.prototype = Object.create(Error.prototype);
  AuthFail.prototype.constructor = AuthFail;

  /* =========================================================
     4. DOM の小道具（styles.css に実在する class だけ使う）
     ========================================================= */

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text !== undefined && text !== null) { node.textContent = text; }
    return node;
  }

  function makeButton(cls, label, onClick) {
    var b = el('button', 'btn ' + cls, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  /**
   * 入力欄。ラベル13px → 入力48px → エラー13px赤字 → 補足13px の順。
   * 戻り値の setError(キー または null) でエラー表示を切り替える。
   */
  function makeField(opts) {
    var wrap = el('div', 'field');

    var label = el('label', 'field__label', opts.label);
    label.setAttribute('for', opts.id);

    var input = document.createElement('input');
    input.className = 'input';
    input.id = opts.id;
    input.type = opts.type || 'text';
    input.value = opts.value || '';
    if (opts.placeholder) { input.placeholder = opts.placeholder; }
    if (opts.autocomplete) { input.autocomplete = opts.autocomplete; }
    if (opts.inputmode) { input.setAttribute('inputmode', opts.inputmode); }
    if (opts.maxlength) { input.maxLength = opts.maxlength; }
    if (opts.type === 'email' || opts.type === 'password') {
      input.setAttribute('autocapitalize', 'none');
      input.setAttribute('autocorrect', 'off');
      input.spellcheck = false;
    }

    var error = el('p', 'field__error');
    error.id = opts.id + '-error';
    error.setAttribute('role', 'alert');
    input.setAttribute('aria-describedby', error.id);

    wrap.appendChild(label);
    wrap.appendChild(input);
    wrap.appendChild(error);

    var hintNode = null;
    if (opts.hint) {
      hintNode = el('p', 'field__hint', opts.hint);
      wrap.appendChild(hintNode);
    }

    var handle = {
      wrap: wrap,
      input: input,
      hint: hintNode,
      value: function () { return input.value; },
      focus: function () { try { input.focus(); } catch (e) { /* 表示前の要素 */ } },
      setError: function (key) {
        if (key) {
          error.textContent = t(key);
          input.classList.add('input--error');
          input.setAttribute('aria-invalid', 'true');
        } else {
          error.textContent = '';
          input.classList.remove('input--error');
          input.removeAttribute('aria-invalid');
        }
      },
      setHint: function (text, ok) {
        if (!hintNode) { return; }
        hintNode.textContent = text || '';
        hintNode.className = ok ? 'field__hint t-ok' : 'field__hint';
      }
    };

    if (typeof opts.onInput === 'function') {
      input.addEventListener('input', function () { opts.onInput(input.value, handle); });
    }
    if (typeof opts.onBlur === 'function') {
      input.addEventListener('blur', function () { opts.onBlur(input.value, handle); });
    }
    if (typeof opts.onEnter === 'function') {
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); opts.onEnter(); }
      });
    }

    return handle;
  }

  function bannerNode(message, onRetry) {
    var box = el('div', 'banner');
    box.setAttribute('role', 'alert');
    box.appendChild(el('p', 'banner__text', message));
    if (typeof onRetry === 'function') {
      var retry = el('button', 'banner__retry', t('retry'));
      retry.type = 'button';
      retry.addEventListener('click', onRetry);
      box.appendChild(retry);
    }
    return box;
  }

  function warnNode(message) {
    var box = el('p', 'warn-box', message);
    box.setAttribute('role', 'alert');
    return box;
  }

  function noteNode(message) {
    return el('p', 'note-box', message);
  }

  /* =========================================================
     5. 画面の状態（言語切替で描き直しても入力が消えないように保持する）
     ========================================================= */

  var state = {
    S1: {
      email: '', password: '',
      busy: false, alert: null,
      googleOpen: false, gEmail: '', gName: '', gBusy: false
    },
    S2: {
      name: '', email: '', password: '',
      busy: false, alert: null, done: false, adminGranted: false,
      emailHint: null,
      googleOpen: false, gEmail: '', gName: '', gBusy: false
    }
  };

  var lastRetry = { S1: null, S2: null };
  var activeScreen = null;   // { id, root, params }
  var langBound = false;

  function setAlert(screenId, alert, retryFn) {
    state[screenId].alert = alert;   // { kind:'net'|'auth'|'ok', key?:文言キー, text?:そのままの文字列 }
    lastRetry[screenId] = retryFn || null;
  }

  function alertNode(screenId) {
    var alert = state[screenId].alert;
    if (!alert) { return null; }
    var message = alert.key ? t(alert.key) : String(alert.text || '');
    if (alert.kind === 'net') {
      return bannerNode(message, function () {
        setAlert(screenId, null, null);
        var fn = lastRetry[screenId];
        rerender();
        if (typeof fn === 'function') { fn(); }
      });
    }
    if (alert.kind === 'ok') {
      var ok = el('p', 'note-box t-ok', message);
      ok.setAttribute('role', 'status');
      return ok;
    }
    return warnNode(message);
  }

  function showFailure(screenId, err, retryFn) {
    if (err && err.authFail) {
      setAlert(screenId, { kind: 'auth', key: err.key }, null);
      return;
    }
    if (err && err.name === 'ApiError') {
      setAlert(screenId, { kind: 'net', text: err.message }, retryFn);
      return;
    }
    console.error('[screens-auth.js] 想定外のエラーです', err);
    setAlert(screenId, { kind: 'net', key: 'errUnknown' }, retryFn);
  }

  function rerender() {
    if (!activeScreen) { return; }
    if (activeScreen.id === 'S1') { renderLogin(activeScreen.root, activeScreen.params); }
    else if (activeScreen.id === 'S2') { renderSignup(activeScreen.root, activeScreen.params); }
  }

  function bindLangChange() {
    if (langBound) { return; }
    langBound = true;
    if (window.I18n && typeof window.I18n.onChange === 'function') {
      window.I18n.onChange(rerender);
    } else {
      report('I18n.onChange(関数)', 'window の elpiya:langchange / languagechange イベントで言語切替を受け取ります。');
    }
    window.addEventListener('elpiya:langchange', rerender);
    window.addEventListener('languagechange', rerender);
  }

  function beginScreen(id, root, params) {
    activeScreen = { id: id, root: root, params: params || {} };
    setHeader();
    hideTabbar();
    bindLangChange();
    if (!root) {
      console.error('[screens-auth.js] ' + id + ' の描画先（#app）が渡されませんでした。app.js の spec.render(root, params) の呼び出しを確認してください。');
      return null;
    }
    root.innerHTML = '';
    var screen = el('div', 'screen');
    root.appendChild(screen);
    return screen;
  }

  function headBlock(titleKey, leadKey, subKey) {
    var head = el('div', 'screen__head');
    head.appendChild(el('h2', 'screen__title', t(titleKey)));
    head.appendChild(el('p', 'screen__lead', t(leadKey) + ' — ' + t(subKey)));
    return head;
  }

  function noticeBlock() {
    var stack = el('div', 'stack stack--tight');
    stack.appendChild(noteNode(t('storageNotice')));
    stack.appendChild(noteNode(t('passwordNotice')));
    return stack;
  }

  function paramOf(params, key) {
    if (!params) { return null; }
    if (typeof params.get === 'function') { return params.get(key); }
    return params[key] === undefined ? null : params[key];
  }

  /* =========================================================
     6. 体験用の擬似Google連携パネル（偽のGoogle画面は作らない）
     ========================================================= */

  function googlePanel(screenId, opts) {
    var s = state[screenId];
    var card = el('div', 'card');

    card.appendChild(el('h3', 'section__title', t('googleTitle')));
    card.appendChild(el('p', 't-note', t('googleNote')));

    var emailField = makeField({
      id: screenId + '-g-email',
      label: t('googleEmail'),
      type: 'email',
      inputmode: 'email',
      autocomplete: 'email',
      placeholder: t('emailPh'),
      value: s.gEmail,
      onInput: function (v, handle) {
        s.gEmail = v;
        handle.setError(emailIssue(v) && v.trim() ? emailIssue(v) : null);
      }
    });
    card.appendChild(emailField.wrap);

    var nameField = makeField({
      id: screenId + '-g-name',
      label: t('googleName'),
      type: 'text',
      autocomplete: 'name',
      maxlength: 20,
      hint: t('googleNameHint'),
      value: s.gName,
      onInput: function (v) { s.gName = v; }
    });
    card.appendChild(nameField.wrap);

    var row = el('div', 'btn-row');
    var cancelBtn = makeButton('btn--secondary', t('cancel'), function () {
      if (s.gBusy) { return; }
      s.googleOpen = false;
      s.gEmail = '';
      s.gName = '';
      // 意図書どおり「キャンセル時は再試行できるエラーを出す」。偽の画面には遷移しない。
      setAlert(screenId, { kind: 'auth', key: 'googleCancelled' }, null);
      rerender();
    });
    var okBtn = makeButton('btn--primary', s.gBusy ? t('googleBusy') : t('googleLink'), function () {
      if (s.gBusy) { return; }
      var issue = emailIssue(emailField.value());
      if (issue) {
        emailField.setError(issue);
        emailField.focus();
        return;
      }
      emailField.setError(null);
      s.gEmail = emailField.value();
      s.gName = nameField.value();
      opts.onSubmit(normalizeEmail(s.gEmail), String(s.gName || '').trim());
    });
    okBtn.disabled = !!s.gBusy;
    cancelBtn.disabled = !!s.gBusy;
    row.appendChild(cancelBtn);
    row.appendChild(okBtn);
    card.appendChild(row);

    if (s.gBusy) {
      card.appendChild(el('p', 'loading-inline', t('googleBusy')));
    }

    return card;
  }

  /**
   * 擬似Google連携の本体。
   *  - 同じメールのユーザーが無ければ auth_provider='google' で新規作成
   *  - あれば google_sub を書き込んで既存アカウントに連携（二重登録しない）
   * 成功したらダッシュボード（S3）へ。
   */
  function runGoogleFlow(screenId, email, displayName) {
    var s = state[screenId];
    if (!Api || !Api.users) {
      console.error('[screens-auth.js] Api.users がありません。api.js の読み込みを確認してください。');
      setAlert(screenId, { kind: 'auth', key: 'errUnknown' }, null);
      rerender();
      return;
    }

    s.gBusy = true;
    setAlert(screenId, null, null);
    rerender();

    var retry = function () { runGoogleFlow(screenId, email, displayName); };
    var sub = pseudoGoogleSub(email);
    var name = displayName || nameFromEmail(email);

    Api.users.first({ eq: { email: email }, order: false })
      .then(function (user) {
        if (user) {
          if (user.user_status && user.user_status !== 'active') {
            throw new AuthFail('errStopped');
          }
          var provider = user.auth_provider === 'google' ? 'google' : 'email,google';
          return Api.users.update(user.id, {
            google_sub: sub,
            auth_provider: provider,
            display_name: user.display_name || name,
            last_login_at: Api.today()
          }).then(function (updated) {
            return { user: updated, linked: true, admin: false };
          });
        }
        return Api.users.count({ limit: 1 }).then(function (existing) {
          var isFirst = existing === 0;
          return Api.users.insert({
            email: email,
            display_name: name,
            auth_provider: 'google',
            google_sub: sub,
            is_admin: isFirst,
            credit_balance: 0,
            user_status: 'active',
            last_login_at: Api.today()
          }).then(function (created) {
            return { user: created, linked: false, admin: isFirst };
          });
        });
      })
      .then(function (result) {
        s.gBusy = false;
        s.googleOpen = false;
        s.gEmail = '';
        s.gName = '';
        adoptUser(result.user);
        toast(result.linked ? t('googleLinked') : t('googleCreated'), 'success');
        if (result.admin) { toast(t('adminGranted'), 'success'); }
        setAlert(screenId, null, null);
        go('S3');
      })
      .catch(function (err) {
        s.gBusy = false;
        showFailure(screenId, err, retry);
        rerender();
      });
  }

  /* =========================================================
     7. S1 ログイン
     ========================================================= */

  function renderLogin(root, params) {
    var s = state.S1;
    var screen = beginScreen('S1', root, params);
    if (!screen) { return; }

    if (paramOf(params, 'signup') === 'done' && !s.alert) {
      setAlert('S1', { kind: 'ok', key: 'signedUpNotice' }, null);
    }

    screen.appendChild(headBlock('s1Title', 's1Lead', 's1Sub'));

    var alertBox = alertNode('S1');
    if (alertBox) { screen.appendChild(alertBox); }

    var fields = el('div', 'stack');

    var emailField = makeField({
      id: 's1-email',
      label: t('email'),
      type: 'email',
      inputmode: 'email',
      autocomplete: 'email',
      placeholder: t('emailPh'),
      value: s.email,
      onInput: function (v, handle) {
        s.email = v;
        handle.setError(v.trim() ? emailIssue(v) : null);
      },
      onBlur: function (v, handle) {
        handle.setError(emailIssue(v));
      },
      onEnter: function () { submit(); }
    });

    var pwField = makeField({
      id: 's1-password',
      label: t('password'),
      type: 'password',
      autocomplete: 'current-password',
      placeholder: t('passwordPh'),
      value: s.password,
      onInput: function (v, handle) {
        s.password = v;
        handle.setError(v ? loginPasswordIssue(v) : null);
      },
      onBlur: function (v, handle) {
        handle.setError(loginPasswordIssue(v));
      },
      onEnter: function () { submit(); }
    });

    fields.appendChild(emailField.wrap);
    fields.appendChild(pwField.wrap);
    screen.appendChild(fields);

    var buttons = el('div', 'stack');

    var loginBtn = makeButton('btn--primary btn--block', s.busy ? t('loginBusy') : t('login'), function () { submit(); });
    loginBtn.disabled = !!s.busy;

    var googleBtn = makeButton('btn--secondary btn--block', t('googleContinue'), function () {
      if (s.busy) { return; }
      s.googleOpen = true;
      if (!s.gEmail) { s.gEmail = s.email; }
      setAlert('S1', null, null);
      rerender();
    });
    googleBtn.disabled = !!s.busy;

    var signupBtn = makeButton('btn--text btn--block', t('signupLink'), function () {
      if (s.busy) { return; }
      go('S2');
    });

    buttons.appendChild(loginBtn);
    buttons.appendChild(googleBtn);
    buttons.appendChild(signupBtn);
    screen.appendChild(buttons);

    if (s.googleOpen) {
      screen.appendChild(googlePanel('S1', {
        onSubmit: function (email, name) { runGoogleFlow('S1', email, name); }
      }));
    }

    var forgot = el('div', 'stack stack--tight');
    forgot.appendChild(el('h3', 'section__title', t('forgotTitle')));
    forgot.appendChild(el('p', 't-note', t('forgotBody')));
    screen.appendChild(forgot);

    screen.appendChild(noticeBlock());

    function setBusy(on) {
      s.busy = on;
      loginBtn.disabled = on;
      googleBtn.disabled = on;
      loginBtn.textContent = on ? t('loginBusy') : t('login');
      emailField.input.disabled = on;
      pwField.input.disabled = on;
    }

    function submit() {
      if (s.busy) { return; }

      s.email = emailField.value();
      s.password = pwField.value();

      var eIssue = emailIssue(s.email);
      var pIssue = loginPasswordIssue(s.password);
      emailField.setError(eIssue);
      pwField.setError(pIssue);
      if (eIssue) { emailField.focus(); return; }
      if (pIssue) { pwField.focus(); return; }

      if (!Api || !Api.users) {
        console.error('[screens-auth.js] Api.users がありません。api.js の読み込みを確認してください。');
        setAlert('S1', { kind: 'auth', key: 'errUnknown' }, null);
        rerender();
        return;
      }

      var email = normalizeEmail(s.email);
      var password = s.password;

      setAlert('S1', null, null);
      setBusy(true);

      Api.users.first({ eq: { email: email }, order: false })
        .then(function (user) {
          if (!user) { throw new AuthFail('errAuth'); }
          if (user.user_status && user.user_status !== 'active') { throw new AuthFail('errStopped'); }
          if (!user.password_hash) { throw new AuthFail('errGoogleOnly'); }
          if (!verifyPassword(password, user.password_hash)) { throw new AuthFail('errAuth'); }
          return Api.users.update(user.id, { last_login_at: Api.today() });
        })
        .then(function (updated) {
          setBusy(false);
          s.password = '';
          s.alert = null;
          adoptUser(updated);
          toast(t('loginDone'), 'success');
          go('S3');
        })
        .catch(function (err) {
          setBusy(false);
          showFailure('S1', err, submit);
          rerender();
        });
    }
  }

  /* =========================================================
     8. S2 会員登録
     ========================================================= */

  function renderSignup(root, params) {
    var s = state.S2;
    var screen = beginScreen('S2', root, params);
    if (!screen) { return; }

    screen.appendChild(headBlock('s2Title', 's2Lead', 's2Sub'));

    var alertBox = alertNode('S2');
    if (alertBox) { screen.appendChild(alertBox); }

    if (s.done) {
      var doneBox = el('p', 'note-box t-ok', t('signupDone'));
      doneBox.setAttribute('role', 'status');
      screen.appendChild(doneBox);
      if (s.adminGranted) { screen.appendChild(noteNode(t('adminGranted'))); }
    }

    var fields = el('div', 'stack');

    var nameField = makeField({
      id: 's2-name',
      label: t('displayName'),
      type: 'text',
      autocomplete: 'name',
      maxlength: 20,
      placeholder: t('displayNamePh'),
      hint: t('displayNameHint'),
      value: s.name,
      onInput: function (v, handle) {
        s.name = v;
        handle.setError(v.trim() ? nameIssue(v) : null);
      },
      onBlur: function (v, handle) { handle.setError(nameIssue(v)); }
    });

    var emailField = makeField({
      id: 's2-email',
      label: t('email'),
      type: 'email',
      inputmode: 'email',
      autocomplete: 'email',
      placeholder: t('emailPh'),
      hint: '',
      value: s.email,
      onInput: function (v, handle) {
        s.email = v;
        s.emailHint = null;
        handle.setHint('', false);
        handle.setError(v.trim() ? emailIssue(v) : null);
      },
      onBlur: function (v, handle) {
        var issue = emailIssue(v);
        handle.setError(issue);
        if (!issue) { checkEmailTaken(normalizeEmail(v), handle); }
      }
    });

    var meterWrap = el('div', 'stack stack--tight');
    var meterRow = el('div', 'row row--between');
    var meterLabel = el('span', 'progress__label', t('strengthLabel'));
    var meterBadge = el('span', 'badge', t(strengthKey(strength(s.password))));
    meterRow.appendChild(meterLabel);
    meterRow.appendChild(meterBadge);
    var meter = el('div', 'progress');
    var meterBar = el('span', 'progress__bar');
    meterBar.style.width = strength(s.password) + '%';
    meter.appendChild(meterBar);
    meterWrap.appendChild(meterRow);
    meterWrap.appendChild(meter);

    function updateMeter(v) {
      var score = strength(v);
      meterBar.style.width = score + '%';
      meterBadge.textContent = t(strengthKey(score));
      meterBadge.className = score >= 84 ? 'badge badge--ok' : 'badge';
    }

    var pwField = makeField({
      id: 's2-password',
      label: t('password'),
      type: 'password',
      autocomplete: 'new-password',
      placeholder: t('passwordPh'),
      hint: t('signupPwHint'),
      value: s.password,
      onInput: function (v, handle) {
        s.password = v;
        updateMeter(v);
        handle.setError(v ? signupPasswordIssue(v) : null);
      },
      onBlur: function (v, handle) { handle.setError(signupPasswordIssue(v)); }
    });

    fields.appendChild(nameField.wrap);
    fields.appendChild(emailField.wrap);
    fields.appendChild(pwField.wrap);
    fields.appendChild(meterWrap);
    screen.appendChild(fields);

    if (s.emailHint) {
      emailField.setHint(t(s.emailHint.key), !!s.emailHint.ok);
    }

    var buttons = el('div', 'stack');

    var registerBtn = makeButton('btn--primary btn--block', s.busy ? t('registerBusy') : t('register'), function () { submit(); });
    registerBtn.disabled = !!s.busy || s.done;

    var googleBtn = makeButton('btn--secondary btn--block', t('googleSignup'), function () {
      if (s.busy) { return; }
      s.googleOpen = true;
      if (!s.gEmail) { s.gEmail = s.email; }
      if (!s.gName) { s.gName = s.name; }
      setAlert('S2', null, null);
      rerender();
    });
    googleBtn.disabled = !!s.busy;

    var backBtn = makeButton(s.done ? 'btn--primary btn--block' : 'btn--text btn--block', t('backToLogin'), function () {
      if (s.busy) { return; }
      var wasDone = s.done;
      resetSignupState();
      go('S1', wasDone ? 'signup=done' : '');
    });

    buttons.appendChild(registerBtn);
    buttons.appendChild(googleBtn);
    buttons.appendChild(backBtn);
    screen.appendChild(buttons);

    if (s.googleOpen) {
      screen.appendChild(googlePanel('S2', {
        onSubmit: function (email, name) { runGoogleFlow('S2', email, name); }
      }));
    }

    var terms = el('div', 'stack stack--tight');
    terms.appendChild(el('p', 't-note', t('s2Sub')));
    terms.appendChild(el('p', 't-note', t('signupNoMail')));
    screen.appendChild(terms);

    screen.appendChild(noticeBlock());

    function checkEmailTaken(email, handle) {
      if (!Api || !Api.users) {
        console.error('[screens-auth.js] Api.users がありません。メールの重複確認ができません。');
        return;
      }
      s.emailHint = { key: 'emailChecking', ok: false };
      handle.setHint(t('emailChecking'), false);
      Api.users.first({ eq: { email: email }, order: false })
        .then(function (user) {
          if (user) {
            s.emailHint = null;
            handle.setHint('', false);
            handle.setError('errEmailTaken');
          } else {
            s.emailHint = { key: 'emailFree', ok: true };
            handle.setHint(t('emailFree'), true);
          }
        })
        .catch(function (err) {
          s.emailHint = null;
          handle.setHint('', false);
          // 重複確認だけの失敗。登録操作そのものは止めないが、黙って消さずにバナーで知らせる。
          showFailure('S2', err, function () { checkEmailTaken(email, handle); });
          rerender();
        });
    }

    function setBusy(on) {
      s.busy = on;
      registerBtn.disabled = on || s.done;
      googleBtn.disabled = on;
      registerBtn.textContent = on ? t('registerBusy') : t('register');
      nameField.input.disabled = on || s.done;
      emailField.input.disabled = on || s.done;
      pwField.input.disabled = on || s.done;
    }

    if (s.done) { setBusy(false); }

    function submit() {
      if (s.busy || s.done) { return; }

      s.name = nameField.value();
      s.email = emailField.value();
      s.password = pwField.value();

      var nIssue = nameIssue(s.name);
      var eIssue = emailIssue(s.email);
      var pIssue = signupPasswordIssue(s.password);
      nameField.setError(nIssue);
      emailField.setError(eIssue);
      pwField.setError(pIssue);
      if (nIssue) { nameField.focus(); return; }
      if (eIssue) { emailField.focus(); return; }
      if (pIssue) { pwField.focus(); return; }

      if (!Api || !Api.users) {
        console.error('[screens-auth.js] Api.users がありません。api.js の読み込みを確認してください。');
        setAlert('S2', { kind: 'auth', key: 'errUnknown' }, null);
        rerender();
        return;
      }

      var email = normalizeEmail(s.email);
      var displayName = String(s.name).trim();
      var passwordHash = hashPassword(s.password);

      setAlert('S2', null, null);
      setBusy(true);

      Api.users.first({ eq: { email: email }, order: false })
        .then(function (existing) {
          if (existing) { throw new AuthFail('errEmailTaken'); }
          return Api.users.count({ limit: 1 });
        })
        .then(function (userCount) {
          var isFirst = userCount === 0;
          return Api.users.insert({
            email: email,
            password_hash: passwordHash,
            display_name: displayName,
            auth_provider: 'email',
            is_admin: isFirst,
            credit_balance: 0,
            user_status: 'active',
            password_updated_at: Api.today()
          }).then(function (created) {
            return { user: created, admin: isFirst };
          });
        })
        .then(function (result) {
          setBusy(false);
          s.done = true;
          s.adminGranted = result.admin;
          s.password = '';
          s.emailHint = null;
          setAlert('S2', null, null);
          toast(t('signupDoneToast'), 'success');
          rerender();
        })
        .catch(function (err) {
          setBusy(false);
          if (err && err.authFail && err.key === 'errEmailTaken') {
            emailField.setError('errEmailTaken');
            emailField.focus();
            return;
          }
          showFailure('S2', err, submit);
          rerender();
        });
    }
  }

  function resetSignupState() {
    var s = state.S2;
    s.name = '';
    s.email = '';
    s.password = '';
    s.busy = false;
    s.alert = null;
    s.done = false;
    s.adminGranted = false;
    s.emailHint = null;
    s.googleOpen = false;
    s.gEmail = '';
    s.gName = '';
    s.gBusy = false;
    lastRetry.S2 = null;
  }

  /* =========================================================
     9. 画面登録（第2引数は必ず { render: 関数 }）
     ========================================================= */

  App.registerScreen('S1', { render: function (root, params) { renderLogin(root, params); } });
  App.registerScreen('S2', { render: function (root, params) { renderSignup(root, params); } });

  /* =========================================================
     10. 通信なしの自己チェック（開発時にコンソールから AuthScreens._selfTest()）
     ========================================================= */

  window.AuthScreens = {
    hashPassword: hashPassword,
    verifyPassword: verifyPassword,
    pseudoGoogleSub: pseudoGoogleSub,

    _selfTest: function () {
      function assert(ok, name) {
        if (!ok) { throw new Error('[screens-auth.js] 自己チェック失敗: ' + name); }
      }

      assert(emailIssue('') === 'errEmailEmpty', 'メール未入力');
      assert(emailIssue('abc') === 'errEmailFormat', 'メール形式');
      assert(emailIssue('a@b') === 'errEmailFormat', 'TLDなし');
      assert(emailIssue('a b@c.co') === 'errEmailFormat', '空白入り');
      assert(emailIssue(' a@b.co ') === null, 'メール正常（前後の空白は無視）');
      assert(normalizeEmail(' A@B.CO ') === 'a@b.co', 'メールの正規化');

      assert(loginPasswordIssue('') === 'errPwEmpty', 'パスワード未入力');
      assert(loginPasswordIssue('1234567') === 'errPwShort', '8文字未満');
      assert(loginPasswordIssue('12345678') === null, '8文字ちょうど');

      assert(signupPasswordIssue('abcdefgh') === 'errPwAlnum', '数字なし');
      assert(signupPasswordIssue('12345678') === 'errPwAlnum', '英字なし');
      assert(signupPasswordIssue('abcd1234') === null, '英数字8文字');

      assert(nameIssue('') === 'errNameEmpty', '表示名未入力');
      assert(nameIssue(new Array(22).join('あ')) === 'errNameLong', '表示名21文字');
      assert(nameIssue(new Array(21).join('あ')) === null, '表示名20文字');
      assert(nameIssue('山田太郎') === null, '表示名正常');

      var h = hashPassword('abcd1234');
      assert(h === hashPassword('abcd1234'), '同じ入力は同じハッシュ');
      assert(h !== hashPassword('abcd1235'), '違う入力は違うハッシュ');
      assert(h.indexOf('v1$') === 0 && h.length === 35, 'ハッシュの形式');
      assert(verifyPassword('abcd1234', h) === true, '照合成功');
      assert(verifyPassword('abcd1235', h) === false, '照合失敗');
      assert(verifyPassword('abcd1234', null) === false, 'ハッシュ無しは常に失敗');
      assert(verifyPassword('abcd1234', '') === false, '空ハッシュは常に失敗');

      assert(pseudoGoogleSub('A@B.com') === pseudoGoogleSub('a@b.com'), 'google_sub は大文字小文字を無視');
      assert(pseudoGoogleSub('a@b.com') !== pseudoGoogleSub('c@d.com'), 'google_sub はメールごとに変わる');
      assert(nameFromEmail('taro.yamada@example.com') === 'taro.yamada', 'メールから表示名');

      assert(strength('') === 0, '空は強度0');
      assert(strengthKey(strength('abcd1234')) === 'strengthMid', '英数字8文字は普通');
      assert(strengthKey(strength('abc1')) === 'strengthWeak', '短いものは弱い');
      assert(strengthKey(strength('Abcdefgh1234!@')) === 'strengthStrong', '長く複雑なものは強い');

      var keys = Object.keys(TEXT.ja);
      assert(keys.length > 0, '日本語辞書');
      ['en', 'ko'].forEach(function (lang) {
        assert(TEXT[lang], lang + ' の辞書');
        keys.forEach(function (k) {
          assert(typeof TEXT[lang][k] === 'string' && TEXT[lang][k] !== '', '訳が抜けています: ' + lang + '.' + k);
        });
        Object.keys(TEXT[lang]).forEach(function (k) {
          assert(Object.prototype.hasOwnProperty.call(TEXT.ja, k), '日本語に無いキーがあります: ' + lang + '.' + k);
        });
      });

      console.log('[screens-auth.js] 自己チェック OK');
      return true;
    }
  };
})(window, document);
