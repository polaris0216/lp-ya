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
 *   Api.auth.signIn(email, password) / Api.auth.signUp(email, password, displayName)
 *   Api.auth.signInWithGoogle() / Api.auth.signOut() / Api.auth.resetPassword(email)
 *   Api.users.update(id, patch)  … last_login_at だけ
 *   Api.today()  … 'YYYY-MM-DD'（last_login_at 用）
 *   Api.storage.get('lang')
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
 * 認証は Supabase Auth（GoTrue）が行う。この画面はパスワードを保存も変換もしない。
 * 「Googleで続行 / Googleで登録」は本物の OAuth で、Google の画面へ実際に移動する。
 *
 * users への INSERT はここでは行わない。プロフィール行は auth.users への
 * トリガ elpiya_handle_new_user が作る（001_auth_rls.sql）。
 * 「最初の登録者を管理者にする」処理も無い。RLS で users は自分の行しか見えず、
 * 件数を数えると常に 0 になって全員が管理者になってしまうため。
 * 管理者は SQL で手動で立てる（docs/SUPABASE-SETUP.md）。
 */
(function (window, document) {
  'use strict';

  var App = window.App;
  if (!App || typeof App.registerScreen !== 'function') {
    console.error('[screens-auth.js] App.registerScreen(画面ID, { render: 関数 }) が見つかりません。index.html の読み込み順（app.js → screens-auth.js）を確認してください。S1・S2 は描画されません。');
    return;
  }
  if (!window.Api || !window.Api.auth || !window.Api.storage) {
    console.error('[screens-auth.js] window.Api（api.js）が見つからないか、Api.auth / Api.storage がありません。api.js が screens-auth.js より先に読み込まれているか確認してください。');
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
      storageNotice: 'アカウントとプロジェクトはご自身のものだけが見えます。他の利用者のデータにはアクセスできません。',
      passwordNotice: 'パスワードはこのアプリには保存されません。認証は Supabase が行います。',

      s1Title: 'ログイン',
      s1Lead: 'おかえりなさい',
      s1Sub: 'メールまたはGoogleで続行',
      email: 'メールアドレス',
      emailPh: 'you@example.com',
      password: 'パスワード',
      passwordPh: '8文字以上',
      login: 'ログイン',
      loginBusy: 'ログイン中…',
      googleContinue: 'Googleで続行',
      signupLink: '新規登録',
      forgotTitle: 'パスワードをお忘れですか？',
      forgotBody: '登録したメールアドレスを上に入力してから、下のボタンを押してください。再設定用のメールをお送りします。',
      forgotSend: '再設定メールを送る',
      forgotBusy: '送信中…',
      forgotSent: '再設定メールを送りました。届いたメールのリンクを開いてください。',

      errEmailEmpty: 'メールアドレスを入力してください',
      errEmailFormat: 'メールアドレスの形式が正しくありません',
      errPwEmpty: 'パスワードを入力してください',
      errPwShort: 'パスワードは8文字以上で入力してください',
      errAuth: '認証情報が正しくありません',
      errStopped: 'このアカウントは現在利用できません。管理者にお問い合わせください。',
      errGoogleOnly: 'このアカウントはGoogle連携でのみログインできます。「Googleで続行」をお使いください。',
      errGoogleNotReady: 'Googleログインは準備中です。メールアドレスとパスワードでログインしてください。',
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
      googleSignup: 'Googleで登録',
      backToLogin: 'ログインへ戻る',
      errNameEmpty: '表示名を入力してください',
      errNameLong: '表示名は20文字以内で入力してください',
      errPwAlnum: 'パスワードは英字と数字を含む8文字以上で入力してください',
      errEmailTaken: 'このメールアドレスは登録済みです',
      signupNoMail: '登録するとメールアドレス宛に確認メールが届くことがあります。届いたらリンクを開いてください。',
      signupConfirm: '確認メールを送りました。メール内のリンクを開いてから、ログインしてください。',
      googleRedirect: 'Googleの画面に移動します…',
      signupDone: 'アカウントを作成しました。「ログインへ戻る」からログインしてください。',
      signupDoneToast: 'アカウントを作成しました'
    },

    en: {
      retry: 'Retry',
      cancel: 'Cancel',
      errUnknown: 'Something went wrong. Please try again.',
      storageNotice: 'You only ever see your own account and projects. Other users\u2019 data is not accessible.',
      passwordNotice: 'Your password is never stored by this app. Supabase handles authentication.',

      s1Title: 'Sign in',
      s1Lead: 'Welcome back',
      s1Sub: 'Continue with email or Google',
      email: 'Email address',
      emailPh: 'you@example.com',
      password: 'Password',
      passwordPh: '8 characters or more',
      login: 'Sign in',
      loginBusy: 'Signing in…',
      googleContinue: 'Continue with Google',
      signupLink: 'Create an account',
      forgotTitle: 'Forgot your password?',
      forgotBody: 'Enter your registered email address above, then tap the button below. We will send you a reset link.',
      forgotSend: 'Send a reset email',
      forgotBusy: 'Sending\u2026',
      forgotSent: 'Reset email sent. Please open the link in it.',

      errEmailEmpty: 'Please enter your email address',
      errEmailFormat: 'This email address is not in a valid format',
      errPwEmpty: 'Please enter your password',
      errPwShort: 'Your password must be at least 8 characters',
      errAuth: 'Your sign-in details are incorrect',
      errStopped: 'This account is currently unavailable. Please contact an administrator.',
      errGoogleOnly: 'This account can only sign in through Google. Please use “Continue with Google”.',
      errGoogleNotReady: 'Google sign-in is not available yet. Please sign in with your email address and password.',
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
      googleSignup: 'Sign up with Google',
      backToLogin: 'Back to sign in',
      errNameEmpty: 'Please enter a display name',
      errNameLong: 'Your display name must be 20 characters or fewer',
      errPwAlnum: 'Your password must be at least 8 characters and contain letters and numbers',
      errEmailTaken: 'This email address is already registered',
      signupNoMail: 'A confirmation email may be sent to your address. Open the link if it arrives.',
      signupConfirm: 'We sent you a confirmation email. Open the link in it, then sign in.',
      googleRedirect: 'Taking you to Google…',
      signupDone: 'Your account was created. Tap “Back to sign in” to sign in.',
      signupDoneToast: 'Account created'
    },

    ko: {
      retry: '다시 시도',
      cancel: '취소',
      errUnknown: '처리에 실패했습니다. 다시 시도해 주세요.',
      storageNotice: '본인의 계정과 프로젝트만 볼 수 있습니다. 다른 이용자의 데이터에는 접근할 수 없습니다.',
      passwordNotice: '비밀번호는 이 앱에 저장되지 않습니다. 인증은 Supabase가 처리합니다.',

      s1Title: '로그인',
      s1Lead: '다시 오신 것을 환영합니다',
      s1Sub: '이메일 또는 Google로 계속하기',
      email: '이메일 주소',
      emailPh: 'you@example.com',
      password: '비밀번호',
      passwordPh: '8자 이상',
      login: '로그인',
      loginBusy: '로그인 중…',
      googleContinue: 'Google로 계속하기',
      signupLink: '신규 가입',
      forgotTitle: '비밀번호를 잊으셨나요?',
      forgotBody: '가입한 이메일 주소를 위에 입력한 뒤 아래 버튼을 눌러 주세요. 재설정 메일을 보내드립니다.',
      forgotSend: '재설정 메일 보내기',
      forgotBusy: '보내는 중\u2026',
      forgotSent: '재설정 메일을 보냈습니다. 메일의 링크를 열어 주세요.',

      errEmailEmpty: '이메일 주소를 입력해 주세요',
      errEmailFormat: '이메일 주소 형식이 올바르지 않습니다',
      errPwEmpty: '비밀번호를 입력해 주세요',
      errPwShort: '비밀번호는 8자 이상으로 입력해 주세요',
      errAuth: '인증 정보가 올바르지 않습니다',
      errStopped: '이 계정은 현재 사용할 수 없습니다. 관리자에게 문의해 주세요.',
      errGoogleOnly: '이 계정은 Google 연동으로만 로그인할 수 있습니다. “Google로 계속하기(체험용)”를 사용해 주세요.',
      errGoogleNotReady: 'Google 로그인은 준비 중입니다. 이메일 주소와 비밀번호로 로그인해 주세요.',
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
      googleSignup: 'Google로 가입',
      backToLogin: '로그인으로 돌아가기',
      errNameEmpty: '표시 이름을 입력해 주세요',
      errNameLong: '표시 이름은 20자 이내로 입력해 주세요',
      errPwAlnum: '비밀번호는 영문과 숫자를 포함해 8자 이상으로 입력해 주세요',
      errEmailTaken: '이미 가입된 이메일 주소입니다',
      signupNoMail: '가입하면 이메일로 확인 메일이 갈 수 있습니다. 도착하면 링크를 열어 주세요.',
      signupConfirm: '확인 메일을 보냈습니다. 메일의 링크를 연 뒤 로그인해 주세요.',
      googleRedirect: 'Google 화면으로 이동합니다…',
      signupDone: '계정을 만들었습니다. “로그인으로 돌아가기”에서 로그인해 주세요.',
      signupDoneToast: '계정을 만들었습니다'
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
      busy: false, resetting: false, alert: null
    },
    S2: {
      name: '', email: '', password: '',
      busy: false, alert: null, done: false, needsConfirmation: false
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
     6. Google ログイン
     ========================================================= */

  /*
   * 本物の OAuth。ブラウザごと Supabase の認可URLへ移り、
   * 戻ってきた URL のハッシュに入るトークンは app.js の起動時に
   * Api.auth.consumeRedirect() が拾う。
   * 旧実装は Google の画面を開かず、入力されたメールで
   * auth_provider='google' の行を作るだけの見せかけだった。
   */
  function startGoogle(screenId) {
    if (!Api || !Api.auth || typeof Api.auth.signInWithGoogle !== 'function') {
      console.error('[screens-auth.js] Api.auth.signInWithGoogle がありません。api.js の読み込みを確認してください。');
      setAlert(screenId, { kind: 'auth', key: 'errUnknown' }, null);
      rerender();
      return;
    }
    /* Supabase 側に OAuth を設定するまでは飛ばさない（飛ばすと 400 の生JSONが出る）。 */
    if (typeof Api.auth.googleEnabled === 'function' && !Api.auth.googleEnabled()) {
      setAlert(screenId, { kind: 'auth', key: 'errGoogleNotReady' }, null);
      rerender();
      return;
    }
    toast(t('googleRedirect'), 'success');
    Api.auth.signInWithGoogle();
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
      setAlert('S1', null, null);
      startGoogle('S1');
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

    var forgot = el('div', 'stack stack--tight');
    forgot.appendChild(el('h3', 'section__title', t('forgotTitle')));
    forgot.appendChild(el('p', 't-note', t('forgotBody')));

    var resetBtn = makeButton('btn--text btn--block', t('forgotSend'), function () {
      if (s.busy || s.resetting) { return; }
      var issue = emailIssue(emailField.value());
      if (issue) {
        emailField.setError(issue);
        emailField.focus();
        return;
      }
      s.resetting = true;
      resetBtn.disabled = true;
      resetBtn.textContent = t('forgotBusy');
      // 「そのアドレスは未登録です」は返さない。返すと登録済みメールを総当たりで割り出せる。
      Api.auth.resetPassword(normalizeEmail(emailField.value())).then(function () {
        s.resetting = false;
        resetBtn.disabled = false;
        resetBtn.textContent = t('forgotSend');
        toast(t('forgotSent'), 'success');
      }, function (err) {
        s.resetting = false;
        resetBtn.disabled = false;
        resetBtn.textContent = t('forgotSend');
        console.error('[screens-auth.js] 再設定メールを送れませんでした', err);
        showFailure('S1', err, null);
        rerender();
      });
    });
    forgot.appendChild(resetBtn);
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

      if (!Api || !Api.auth) {
        console.error('[screens-auth.js] Api.auth がありません。api.js の読み込みを確認してください。');
        setAlert('S1', { kind: 'auth', key: 'errUnknown' }, null);
        rerender();
        return;
      }

      var email = normalizeEmail(s.email);
      var password = s.password;

      setAlert('S1', null, null);
      setBusy(true);

      /*
       * 照合はサーバー（Supabase Auth）が行う。
       * 旧実装は users を1件読んで自前ハッシュと突き合わせていた。
       * それは password_hash が誰にでも読めることが前提で、認証として成立していなかった。
       */
      Api.auth.signIn(email, password)
        .then(function (user) {
          if (user && user.user_status && user.user_status !== 'active') {
            // 停止中のアカウントはログイン状態を残さない
            return Api.auth.signOut().then(function () { throw new AuthFail('errStopped'); });
          }
          return Api.users.update(user.id, { last_login_at: Api.today() }).catch(function (err) {
            // 最終ログイン日の記録に失敗してもログイン自体は成立させる
            console.warn('[screens-auth.js] last_login_at を更新できませんでした', err);
            return user;
          });
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
      if (s.needsConfirmation) { screen.appendChild(noteNode(t('signupConfirm'))); }
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
        handle.setHint('', false);
        handle.setError(v.trim() ? emailIssue(v) : null);
      },
      onBlur: function (v, handle) {
        handle.setError(emailIssue(v));
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


    var buttons = el('div', 'stack');

    var registerBtn = makeButton('btn--primary btn--block', s.busy ? t('registerBusy') : t('register'), function () { submit(); });
    registerBtn.disabled = !!s.busy || s.done;

    var googleBtn = makeButton('btn--secondary btn--block', t('googleSignup'), function () {
      if (s.busy) { return; }
      setAlert('S2', null, null);
      startGoogle('S2');
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

    var terms = el('div', 'stack stack--tight');
    terms.appendChild(el('p', 't-note', t('s2Sub')));
    terms.appendChild(el('p', 't-note', t('signupNoMail')));
    screen.appendChild(terms);

    screen.appendChild(noticeBlock());

    /*
     * メールの重複確認は廃止した。
     * RLS で users は自分の行しか読めないため、他人のアドレスは必ず「未登録」に見える。
     * 「使えます」と出したあとに登録が弾かれるのが一番わかりにくい。
     * 重複はサーバーが返す emailTaken で伝える。
     */

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

      if (!Api || !Api.auth) {
        console.error('[screens-auth.js] Api.auth がありません。api.js の読み込みを確認してください。');
        setAlert('S2', { kind: 'auth', key: 'errUnknown' }, null);
        rerender();
        return;
      }

      var email = normalizeEmail(s.email);
      var displayName = String(s.name).trim();

      setAlert('S2', null, null);
      setBusy(true);

      /*
       * アカウントの作成はサーバーが行う。users への INSERT はもう行わない
       * （001 で INSERT ポリシーを作らず、プロフィール行は auth.users への
       *  トリガ elpiya_handle_new_user が作る）。
       * 「最初の登録者を管理者にする」判定も無くした。RLS により users は
       * 自分の行しか見えず、件数を数えると常に0になって全員が管理者になってしまう。
       * 管理者はSQLで手動で立てる（docs/SUPABASE-SETUP.md）。
       */
      Api.auth.signUp(email, s.password, displayName)
        .then(function (result) {
          setBusy(false);
          s.done = true;
          s.needsConfirmation = !!(result && result.needsConfirmation);
          s.password = '';
          setAlert('S2', null, null);
          toast(t('signupDoneToast'), 'success');
          rerender();
        })
        .catch(function (err) {
          setBusy(false);
          if (err && (err.code === 'emailTaken' || (err.authFail && err.key === 'errEmailTaken'))) {
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
    s.needsConfirmation = false;
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
