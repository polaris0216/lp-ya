/* =============================================================================
 * brief-stamp.js — 生成プロンプトの「材料の指紋」
 *
 * マスターブリーフは、商品情報・ターゲット層・☆の写真・参照ページの区画・
 * 競合分析の結果から書く。どれかを直したら、ブリーフは古くなる。
 * 「古いか」を見分けるために、材料をひとまとめにして短い印にする。
 *
 * ワーカー（tools/job-worker.mjs）が書くときに同じ計算で印を残し、
 * 画面（screens-lp.js）が開いたときに今の材料から印を出して比べる。
 * 違えば「設定が変わりました。更新しますか？」と出す。
 *
 * 計算はここ1か所。両方がこれを読む（ブラウザ＝グローバル、Node＝module.exports）。
 * ========================================================================== */
(function (global) {
  'use strict';

  /* 材料を決まった順で文字列にする。順番が変わると印も変わるので並べ替える */
  function stable(value) {
    if (Array.isArray(value)) { return '[' + value.map(stable).join(',') + ']'; }
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function (k) { return k + ':' + stable(value[k]); }).join(',') + '}';
    }
    return String(value === undefined || value === null ? '' : value);
  }

  /* 32bit の簡単なハッシュ。衝突しても困らない（同じか違うかだけ） */
  function hash(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(36);
  }

  /* 印に入れる材料。ブリーフの中身に効くものだけ。
     効かないもの（公開URL・ステータス）は入れない。入れると無関係な変更で「古い」と出る */
  function materials(project, report) {
    var p = project || {};
    var r = report || {};
    return {
      name: p.product_name || p.name || '',
      category: p.category || '',
      price: p.price || '',
      value: p.value_prop || '',
      features: p.product_features || '',
      tone: p.brand_tone || '',
      colors: p.brand_colors || [],
      fonts: p.brand_fonts || {},
      targets: p.targets || [],
      rewards: p.rewards || [],
      shots: (p.product_shot_urls || []).slice().sort(),
      structure: p.reference_structure || null,
      report: r.analyzed_at || r.created_at || '',
      factors: r.success_factors || null
    };
  }

  function stampOf(project, report) {
    return hash(stable(materials(project, report)));
  }

  var api = { stampOf: stampOf, materials: materials, stable: stable, hash: hash };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.BriefStamp = api;
}(typeof window !== 'undefined' ? window : globalThis));
