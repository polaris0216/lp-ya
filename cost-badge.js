/* =============================================================================
 * cost-badge.js — 押す前に「いくらか」を見せる
 *
 * なぜ要るか（2026-10-25 使い勝手の見直し）:
 *   ポイントを使う画面のうち、押す前に値段を出していたのは競合分析だけだった。
 *   LP生成もLINE生成も**0か所**。しかも「絵をまとめて作る」は5層×2枚＝10枚を
 *   一度に作るので、知らずに押すと一気に減る。
 *
 * 言い方に気をつける:
 *   **いまは消費が繋がっていない**（App.consumeCredit は定義だけで未使用）。
 *   なので「60ポイント減ります」とは書かない。「この生成は60ポイントです」と
 *   値段として出す。繋がったあとも、この文面のままで正しい。
 *
 * ブラウザ: window.LpyaCost
 * ========================================================================== */
(function (global) {
  'use strict';

  let cache = null;      /* feature_key → ポイント */
  let loading = null;

  /* 単価表は1回だけ読む。ボタンごとに読むと、画面を開くたびに何度も走る */
  function load() {
    if (cache) { return Promise.resolve(cache); }
    if (loading) { return loading; }
    const api = global.Api && global.Api.credits;
    if (!api || typeof api.featureCosts !== 'function') { return Promise.resolve({}); }
    loading = api.featureCosts().then(function (rows) {
      const map = {};
      (rows || []).forEach(function (r) {
        if (r && r.feature_key) { map[String(r.feature_key)] = Number(r.credit_cost) || 0; }
      });
      cache = map;
      loading = null;
      return map;
    }).catch(function (err) {
      console.error('[cost] 単価表を読めませんでした', err);
      loading = null;
      return {};
    });
    return loading;
  }

  function pointsOf(featureKey) {
    return (cache && cache[String(featureKey)]) || 0;
  }

  /* ボタンの下に一言添える。読み込みが終わってから足すので、
     値段が分からないあいだは何も出さない（0ポイントと嘘をつかない）*/
  function attach(host, featureKey, opts) {
    const o = opts || {};
    const t = typeof o.t === 'function' ? o.t : function (k) { return k; };
    if (!host || !host.appendChild) { return; }
    load().then(function () {
      const p = pointsOf(featureKey);
      if (!p) { return; }
      const node = global.document.createElement('p');
      node.className = 'field__hint cost-hint';
      node.textContent = o.count
        ? t('cost.withCount', { p: p, n: o.count })
        : t('cost.plain', { p: p });
      host.appendChild(node);
    });
  }

  global.LpyaCost = { load: load, pointsOf: pointsOf, attach: attach };
}(window));
