/* =============================================================================
 * cost-badge.js — 押す前に「いくらか」を見せる
 *
 * なぜ要るか（2026-10-25 使い勝手の見直し／2026-10-30 要望）:
 *   ポイントを使う画面のうち、押す前に値段を出していたのは競合分析だけだった。
 *   しかも「絵をまとめて作る」は5層×2枚＝10枚を一度に作るので、
 *   知らずに押すと一気に減る。
 *   2026-10-30 から **AIを使うボタンには必ず値段を出す**。ボタンの中に出すので、
 *   下の説明文を読まなくても、押す指の先に金額がある。
 *
 * 払いはDBで起きる（2026-10-30）:
 *   generation_jobs の insert 引き金が引く（055_points_by_group.sql）。
 *   この画面側の表示は**知らせるためだけ**で、ここを書き換えても安くはならない。
 *   だから金額は「この生成は120ポイントです」と値段として出す。
 *
 * 単位ごとの値段:
 *   feature_credits.per_unit が true のキーは、credit_cost が単位1つあたり。
 *   ブロック28枚なら 8P × 28 = 224P。units を渡すと掛けて出す。
 *
 * ブラウザ: window.LpyaCost
 *   LpyaCost.load()                     単価表を1回だけ読む
 *   LpyaCost.pointsOf(key, units)       ポイント数（読み込み前は 0）
 *   LpyaCost.stamp(btn, key, units, t)  ボタンの中に「120P」を出す
 *   LpyaCost.stampSum(btn, [[key,n]..]) 続けて走る仕事のぶんを足して出す
 *   LpyaCost.attach(host, key, opts)    ボタンの下に一言添える（従来どおり）
 *   LpyaCost.info(key)                  { points, perUnit, unitName, group }
 * ========================================================================== */
(function (global) {
  'use strict';

  let cache = null;      /* feature_key → { points, perUnit, unitName, group } */
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
        if (!r || !r.feature_key) { return; }
        map[String(r.feature_key)] = {
          points: Number(r.credit_cost) || 0,
          perUnit: r.per_unit === true,
          unitName: r.unit_name || '',
          group: r.group_no === null || r.group_no === undefined ? null : Number(r.group_no)
        };
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

  function info(featureKey) {
    return (cache && cache[String(featureKey)]) || null;
  }

  /* units を渡すと、単位ごとの値段のキーだけ掛ける。
     掛けないキーに units を渡しても値段は変わらない（渡し間違えても高く出ない） */
  function pointsOf(featureKey, units) {
    const one = info(featureKey);
    if (!one) { return 0; }
    if (!one.perUnit) { return one.points; }
    const n = Math.max(1, Math.round(Number(units) || 1));
    return one.points * n;
  }

  /* ボタンの中に金額を出す。読み込みが終わってから足すので、
     分からないあいだは何も出さない（0ポイントと嘘をつかない）。
     同じボタンに二度押ししても札は1枚だけ（前の札を外してから足す） */
  function paint(btn, points) {
    if (!btn || !btn.appendChild) { return; }
    const old = btn.querySelector && btn.querySelector('.btn__pt');
    if (old && old.parentNode) { old.parentNode.removeChild(old); }
    if (!points) { return; }
    const tag = global.document.createElement('span');
    tag.className = 'btn__pt';
    tag.textContent = String(points) + 'P';
    btn.appendChild(tag);
  }

  function stamp(btn, featureKey, units) {
    if (!btn) { return; }
    load().then(function () { paint(btn, pointsOf(featureKey, units)); });
  }

  /* 1回押すと続けて何本も走るボタン（商品入力の「AI自動分析」など）。
     parts は [[featureKey, units], ...]。合計を出す */
  function stampSum(btn, parts) {
    if (!btn) { return; }
    load().then(function () {
      let sum = 0;
      (parts || []).forEach(function (pair) {
        if (!pair) { return; }
        sum += pointsOf(pair[0], pair[1]);
      });
      paint(btn, sum);
    });
  }

  /* ボタンの下に一言添える（説明が要る場所だけ。札はボタンの中に出る） */
  function attach(host, featureKey, opts) {
    const o = opts || {};
    const t = typeof o.t === 'function' ? o.t : function (k) { return k; };
    if (!host || !host.appendChild) { return; }
    load().then(function () {
      const p = pointsOf(featureKey, o.count);
      if (!p) { return; }
      const node = global.document.createElement('p');
      node.className = 'field__hint cost-hint';
      node.textContent = o.count
        ? t('cost.withCount', { p: p, n: o.count })
        : t('cost.plain', { p: p });
      host.appendChild(node);
    });
  }

  global.LpyaCost = {
    load: load, pointsOf: pointsOf, info: info,
    stamp: stamp, stampSum: stampSum, attach: attach
  };
}(window));
