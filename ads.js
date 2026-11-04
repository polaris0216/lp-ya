/* =============================================================================
 * ads.js — 広告の札を出す唯一の場所（2026-11-04 要望）
 *
 * なぜ1か所にまとめるか:
 *   面ごとに出してよい・いけないがはっきり決まっているため（docs/domains.md）。
 *     lpya.net        集客・読み物     出してよい
 *     app.lpya.net    道具（アプリ）   出してよい  ← 生成中のポップアップはここ
 *     pre-launch.net  顧客のLP         **絶対に出さない**
 *   呼ぶ側が面を判断すると、いつか必ず顧客のLPに混ざる。
 *   だから **出してよい面かどうかを、この中で必ず確かめる**。
 *
 * 顧客のLPに混ざらない仕掛け（二重）:
 *   ① view.html（公開LP）と、組み立てたLPのHTMLは、このファイルを読み込まない
 *   ② それでも呼ばれたら、下の allowed() が false を返して何もしない
 *
 * 広告の札（AdMax）は管理者が入れる。入っていなければ何も出さない。
 * 置き場は a2f58db45_app_settings の 'admax_tag'（画面から直に書けない）。
 *
 * ブラウザ: window.LpyaAds.slot(host, where)
 * ========================================================================== */
(function (global) {
  'use strict';

  var CACHE_MS = 10 * 60 * 1000;
  var tag = null;        /* まだ読んでいない間は null。'' は「無し」 */
  var at = 0;
  var loading = null;

  /* 広告を出してよい面か。顧客のLPでは何があっても出さない */
  function allowed() {
    try {
      var host = String(global.location.hostname || '').toLowerCase();
      /* 顧客のLPの面。ここは出さない（docs/domains.md の決め） */
      if (host === 'pre-launch.net' || /\.pre-launch\.net$/.test(host)) { return false; }
      /* 公開したLPそのもの。アプリと同じ面に置かれていても出さない */
      var path = String(global.location.pathname || '');
      if (/view\.html$/.test(path)) { return false; }
      return true;
    } catch (e) { return false; }
  }

  function load() {
    if (tag !== null && Date.now() - at < CACHE_MS) { return Promise.resolve(tag); }
    if (loading) { return loading; }
    var api = global.Api && global.Api.appSettings;
    if (!api || typeof api.list !== 'function') { return Promise.resolve(''); }
    loading = api.list({ eq: { key: 'admax_tag' }, order: false, limit: 1 })
      .then(function (rows) {
        tag = String((rows && rows[0] && rows[0].value) || '');
        at = Date.now();
        loading = null;
        return tag;
      }, function () { loading = null; return ''; });
    return loading;
  }

  /* 広告の枠を1つ置く。
     host  … 入れ物（この中に作る）
     where … どこの枠か。記録に使うだけ（'jobwatch' など）

     札は <script> を含むので、innerHTML では走らない。
     いったん組み立ててから、script だけ作り直して差し込む */
  function slot(host, where) {
    if (!host || !host.appendChild) { return; }
    if (!allowed()) { return; }
    load().then(function (code) {
      if (!code) { return; }
      /* 画面を描き直すと入れ物ごと捨てられる。残っているときだけ足す */
      if (!global.document.body.contains(host)) { return; }
      var box = global.document.createElement('div');
      box.className = 'ad-slot';
      box.setAttribute('data-ad', String(where || ''));
      /* 「広告」と明記する。何の表示か分からないまま出すと、
         アプリの機能だと思われる */
      var label = global.document.createElement('span');
      label.className = 'ad-slot__label';
      label.textContent = '広告';
      box.appendChild(label);

      var frame = global.document.createElement('div');
      frame.className = 'ad-slot__in';
      frame.innerHTML = code;
      box.appendChild(frame);
      host.appendChild(box);

      /* innerHTML で入れた <script> は走らない決まりなので、作り直す */
      Array.prototype.forEach.call(frame.querySelectorAll('script'), function (old) {
        var made = global.document.createElement('script');
        Array.prototype.forEach.call(old.attributes, function (a) {
          made.setAttribute(a.name, a.value);
        });
        made.text = old.text;
        old.parentNode.replaceChild(made, old);
      });
    });
  }

  global.LpyaAds = { slot: slot, allowed: allowed, _reset: function () { tag = null; at = 0; } };
}(window));
