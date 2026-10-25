/* =============================================================================
 * friendly-error.js — 失敗を、次に何をすればいいか分かる形にする
 *
 * なぜ要るか（2026-10-25 使い勝手の見直し）:
 *   失敗を伝える文言368本のうち、次の手が書いてあるのは48本（13%）だけだった。
 *   「エラーが発生しました」は33か所で使われていて、これを見ても
 *   待てばいいのか、やり直すのか、自分が悪いのかが分からない。
 *
 *   もう一つの問題は、生の技術的な文がそのまま出ていたこと。
 *   errorMessage() が err.message をそのまま返していたので、
 *   "Failed to fetch" や "HTTP 500" が画面に出ていた。
 *
 * 決め:
 *   ・api.js の ApiError は **すでに良い文を持っている**（次の手つき）。そのまま使う
 *   ・ワーカーが返す失敗（stuckWhy など）も日本語で書かれている。そのまま使う
 *   ・それ以外（英語の技術的な文）は見せない。代わりに、次の手のある一般的な文を出す
 *
 * 見分け方は「日本語が入っているか」。人に向けて書かれた文には必ず日本語が入る。
 *
 * ブラウザ: window.LpyaError
 * ========================================================================== */
(function (global) {
  'use strict';

  /* 日本語（ひらがな・カタカナ・漢字）が含まれているか */
  const JA = /[぀-ヿ一-龯]/;

  function textOf(err) {
    if (!err) { return ''; }
    if (typeof err === 'string') { return err; }
    return String(err.message || '');
  }

  /* 人に向けて書かれた文か。そうでなければ見せない */
  function forHumans(err) {
    const t = textOf(err);
    if (!t) { return ''; }
    if (!JA.test(t)) { return ''; }
    /* 長すぎるものは、途中で切らずに丸ごと捨てる。
       途中で切ると意味が変わって、かえって混乱させる */
    if (t.length > 160) { return ''; }
    return t;
  }

  /* 画面に出す文。t は呼ぶ側の辞書引き */
  function message(err, t) {
    const say = typeof t === 'function' ? t : function (k) { return k; };
    const human = forHumans(err);
    if (human) { return human; }
    /* 通信まわりは、待てば直ることが多いので、そう言う */
    const raw = textOf(err).toLowerCase();
    if (/failed to fetch|networkerror|load failed/.test(raw)) { return say('err.network'); }
    if (/abort|timeout/.test(raw)) { return say('err.timeout'); }
    if (/\b(5\d\d)\b/.test(raw)) { return say('err.server'); }
    if (/\b(401|403)\b/.test(raw)) { return say('err.auth'); }
    return say('err.unknown');
  }

  global.LpyaError = { message: message, forHumans: forHumans };
}(typeof window !== 'undefined' ? window : globalThis));
