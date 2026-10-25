/* =============================================================================
 * job-eta.js — 「どれくらい待つか」を先に伝える
 *
 * なぜ要るか（2026-10-25 の使い勝手の見直し）:
 *   押したあと何分かかるのか、どこにも書いていなかった。
 *   実測（仕事 454件）では、絵づくりは中央値9.4分だが上位10%で105分、
 *   最長は9時間を超えていた。6分なのか2時間なのか分からないと、
 *   席を立っていいか判断できない。PCに不慣れな人は「固まった」と思って押し直す。
 *
 * 数字は実測から置く。推測で短く言うと、待てたはずの人を不安にさせる。
 *   p50 … ふつうこれくらい
 *   p90 … 10回に1回はこれくらいかかる
 *
 * ブラウザ: window.LpyaJobEta
 * ========================================================================== */
(function (global) {
  'use strict';

  /* 単位は分。2026-10-25 に a2f58db45_generation_jobs から測った値 */
  const ETA = {
    lp_section:          { p50: 9,  p90: 106, note: 'many' },
    competitor_analysis: { p50: 24, p90: 30 },
    product_autofill:    { p50: 10, p90: 12 },
    lp_brief:            { p50: 9,  p90: 13 },
    sales_copy:          { p50: 4,  p90: 5 },
    product_cutouts:     { p50: 4,  p90: 5 },
    lp_assets:           { p50: 1,  p90: 5 },
    line_brief:          { p50: 1,  p90: 1 },
    line_copy:           { p50: 4,  p90: 5 },
  };

  function of(featureKey) {
    return ETA[String(featureKey || '')] || null;
  }

  /* 押す前に出す一言。「〜分」ではなく幅で言う。
     幅で言わないと、超えたときに壊れたように見える */
  function hint(featureKey, t) {
    const e = of(featureKey);
    if (!e) { return ''; }
    const say = typeof t === 'function' ? t : function (k, p) { return k + JSON.stringify(p); };
    if (e.p90 >= e.p50 * 3) {
      /* ばらつきが大きいもの（絵づくり）は、長い側もはっきり言う */
      return say('eta.wide', { a: e.p50, b: e.p90 });
    }
    return say('eta.about', { a: e.p50 });
  }

  /* 進行中に出す残り時間。経過が目安を超えたら「もう少し」に切り替える。
     超えているのに「残り0分」と出し続けると、止まって見える */
  function remain(featureKey, elapsedMin, t) {
    const e = of(featureKey);
    const say = typeof t === 'function' ? t : function (k, p) { return k + JSON.stringify(p); };
    if (!e) { return ''; }
    const left = Math.round(e.p50 - (Number(elapsedMin) || 0));
    if (left >= 1) { return say('eta.left', { m: left }); }
    if ((Number(elapsedMin) || 0) <= e.p90) { return say('eta.overP50', { b: e.p90 }); }
    return say('eta.overP90');
  }

  global.LpyaJobEta = { of: of, hint: hint, remain: remain, table: ETA };
}(typeof window !== 'undefined' ? window : globalThis));
