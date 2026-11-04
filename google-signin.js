/* =============================================================================
 * google-signin.js — Googleログインのボタン（2026-11-04）
 *
 * なぜ作り直したか:
 *   これまでは Supabase の /auth/v1/authorize へブラウザごと飛ばしていた。
 *   この方式だと Google に渡る redirect_uri が
 *     https://yyxbtoekzarbsrtdqwzn.supabase.co/auth/v1/callback
 *   になり、Googleのログイン画面に **その文字列がそのまま出る**。
 *   利用者から見れば、知らないドメインに飛ばされたのと同じで、入口で止まる。
 *   （アプリ名の設定でも、アプリを本番公開しても、ここは変わらない。
 *     あの行は redirect_uri のドメインから機械的に作られているため）
 *
 * 新しい方式（Google Identity Services）:
 *   Googleのボタンを埋め込み、押すと小窓が出て、**ページを離れずに**
 *   IDトークンが返る。redirect_uri が無いので、小窓に出るのは
 *   アプリ名（エルピーヤ）と、いま開いているドメイン（www.lpya.net）。
 *   受け取った IDトークンは Supabase の
 *     POST /auth/v1/token?grant_type=id_token
 *   に渡す。あとはメール＋パスワードのログインと同じ流れになる。
 *
 * 壊れたときの逃げ道:
 *   Googleのスクリプトが読めない環境（遮断・社内網など）では mount が
 *   false を返す。呼ぶ側は、これまでの飛ばす方式のボタンを出すこと。
 *
 * client_id は秘密ではない（Googleのボタンに埋め込んで配るもの）。
 * 秘密鍵は Supabase 側にあり、ここには無い。
 *
 * ブラウザ: window.LpyaGoogle.mount(host, onToken, onError)
 * ========================================================================== */
(function (global) {
  'use strict';

  var CLIENT_ID = '818010077010-1g156f13fmculnpe1sgr1hb98t5udac6.apps.googleusercontent.com';
  var SRC = 'https://accounts.google.com/gsi/client';
  var LOAD_MS = 8000;

  var loading = null;
  /* initialize はページに1つしか持てない。押されたときに呼ぶ先を
     ここで差し替える（S1 と S2 で別の画面に戻すため） */
  var handler = null;

  function load() {
    if (loading) { return loading; }
    loading = new Promise(function (done) {
      if (global.google && global.google.accounts && global.google.accounts.id) { done(true); return; }
      var tag = global.document.createElement('script');
      tag.src = SRC;
      tag.async = true;
      tag.defer = true;
      var timer = global.setTimeout(function () { done(false); }, LOAD_MS);
      tag.onload = function () {
        global.clearTimeout(timer);
        done(!!(global.google && global.google.accounts && global.google.accounts.id));
      };
      tag.onerror = function () { global.clearTimeout(timer); done(false); };
      global.document.head.appendChild(tag);
    });
    return loading;
  }

  /* Googleのボタンを host の中に作る。
       host    … 入れ物（空にしてから作る）
       onToken … 押して本人確認が済んだとき。IDトークンの文字列が渡る
       onError … Googleの側で失敗したとき
     返り値: Promise<boolean>。false なら、これまでの方式のボタンを出すこと */
  function mount(host, onToken, onError) {
    if (!host) { return Promise.resolve(false); }
    return load().then(function (ok) {
      if (!ok) { return false; }
      handler = { token: onToken, error: onError };
      try {
        global.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          /* 押したときだけ出す。勝手に出る One Tap は使わない
             （入力中に小窓がかぶる） */
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: function (res) {
            var cb = handler && handler.token;
            if (!cb) { return; }
            if (!res || !res.credential) {
              var bad = handler && handler.error;
              if (bad) { bad(new Error('no credential')); }
              return;
            }
            cb(res.credential);
          }
        });
        while (host.firstChild) { host.removeChild(host.firstChild); }
        /* ボタンの中の字はGoogleが用意する。アプリと同じ言語を渡さないと、
           ブラウザの言語（この端末では韓国語）になる */
        var lang = 'ja';
        try {
          if (global.I18N && typeof global.I18N.getLocale === 'function') {
            lang = String(global.I18N.getLocale() || 'ja');
          }
        } catch (e) { /* 言語が取れなくても日本語で出す */ }

        global.google.accounts.id.renderButton(host, {
          locale: lang,
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'continue_with',
          logo_alignment: 'center',
          /* 入れ物の幅に合わせる。Google の上限は 400 */
          width: Math.min(400, Math.max(200, Math.round(host.clientWidth || 320)))
        });
        return true;
      } catch (e) {
        return false;
      }
    }, function () { return false; });
  }

  global.LpyaGoogle = { mount: mount, CLIENT_ID: CLIENT_ID };
}(window));
