/* =============================================================================
 * pricing.js — 原価と望む利益率から、ボタンごとの値段を出す
 *
 * なぜ要るか（2026-10-25 要望）:
 *   値付けを手で決めていたので、実際の原価と合っているか分からなかった。
 *   実測 2026-10-24 の突き合わせでは、LP生成 60pt（600円）に対して
 *   原価が 560円で、残り6.6%から決済・サーバー・広告・利益を全部出す形だった。
 *   原価と望む配分を入れたら、必要な値段が出るようにする。
 *
 * 数えるもの:
 *   画像   … **投げた回数**。成果物の枚数ではない
 *            （実測: 3回試して0枚でも $0.11×3 請求された）
 *   Claude … トークン数。単価は変わるがトークン数は変わらないので、
 *            あとから単価を入れ替えて計算し直せる
 *   GIF    … Replicate の1本あたり
 *
 * ブラウザ: window.LpyaPricing / Node: tools/pricing.mjs が読み込む
 * ========================================================================== */
(function (global) {
  'use strict';

  /* 1機能ぶんの原価（USD）。使った実績から出す */
  function costUsd(use, rate) {
    const u = use || {};
    const r = rate || {};
    const img = (Number(u.imageTries) || 0) * (Number(r.imageUsd) || 0);
    const tin = (Number(u.inputTokens) || 0) / 1e6 * (Number(r.inUsdPerMtok) || 0);
    const tout = (Number(u.outputTokens) || 0) / 1e6 * (Number(r.outUsdPerMtok) || 0);
    const gif = (Number(u.gifs) || 0) * (Number(r.gifUsd) || 0);
    return { image: img, textIn: tin, textOut: tout, gif: gif, total: img + tin + tout + gif };
  }

  /* 望む配分から、原価に使える割合を出す。
     ここが小さいほど売価は跳ね上がる。利益50%・広告25%だと 11.4% しか残らず、
     売価は原価の8.8倍になる（2026-10-23 に実際そうなった） */
  function costRoom(share) {
    const s = share || {};
    const used = (Number(s.profit) || 0) + (Number(s.ad) || 0)
      + (Number(s.server) || 0) + (Number(s.payment) || 0);
    return 1 - used;
  }

  /* 値段を出す。返すのは円とポイント両方 */
  function price(use, rate, share) {
    const c = costUsd(use, rate);
    const room = costRoom(share);
    const usdjpy = Number((rate || {}).usdJpy) || 0;
    const costYen = c.total * usdjpy;
    if (room <= 0) {
      return { ok: false, why: 'tooMuchShare', room: room, costYen: costYen, cost: c };
    }
    const yen = costYen / room;
    const perPoint = Number((rate || {}).yenPerPoint) || 10;
    return {
      ok: true, room: room, cost: c, costYen: costYen, yen: yen,
      points: Math.ceil(yen / perPoint),
      /* 内訳。何にいくら乗っているかを見せる */
      breakdown: {
        cost: costYen,
        server: yen * (Number((share || {}).server) || 0),
        ad: yen * (Number((share || {}).ad) || 0),
        payment: yen * (Number((share || {}).payment) || 0),
        profit: yen * (Number((share || {}).profit) || 0),
      },
    };
  }

  /* いまの値段だと、実際いくら残るか（逆から見る）。
     値段を上げたくないときに、どこを削ればよいかが分かる */
  function marginOf(points, use, rate, share) {
    const perPoint = Number((rate || {}).yenPerPoint) || 10;
    const yen = (Number(points) || 0) * perPoint;
    const c = costUsd(use, rate);
    const costYen = c.total * (Number((rate || {}).usdJpy) || 0);
    if (!yen) { return { yen: 0, costYen: costYen, profitYen: -costYen, profitRate: 0 }; }
    const s = share || {};
    const other = yen * ((Number(s.ad) || 0) + (Number(s.server) || 0) + (Number(s.payment) || 0));
    const profitYen = yen - costYen - other;
    return { yen: yen, costYen: costYen, profitYen: profitYen, profitRate: profitYen / yen };
  }

  global.LpyaPricing = { costUsd: costUsd, costRoom: costRoom, price: price, marginOf: marginOf };
}(typeof window !== 'undefined' ? window : globalThis));
