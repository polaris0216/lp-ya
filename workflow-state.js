/* =============================================================================
 * workflow-state.js — 6つの工程が「済んだか」と「つぎに何をするか」を1か所で決める
 *
 * なぜ要るか（2026-11-04 の見直し）:
 *   工程タブに出ているのは名前と番号だけで、どこまで済んでいて次に何を
 *   すべきかが分からなかった。8日・144生成という使い方だと、
 *   再開のたびに「で、どこからだっけ」が起きる。
 *
 * なぜ別ファイルか:
 *   同じ判定を3か所（工程タブの点・つぎにやることのカード・帯）が読む。
 *   app.js は3148行、screens-home.js は3315行あるので、どちらに足しても
 *   次に探す人が見つけられない。規則は規則だけで1つのファイルに置く。
 *
 * 「済」の決め方（利用者と詰めたもの。推測で増やさない）:
 *   ① 商品入力     カテゴリと出稿媒体が入っている（名前は作成時に必ず入る）
 *   ② 競合分析     レポートが1本ある
 *   ③ 販売戦略     ターゲットが1つ以上ある
 *   ④ LP作成       選んだ層の絵が全部ある
 *   ⑤ LP登録確認   公開URLがある
 *   ⑥ LINE         コンテンツが1本ある
 *
 * ブラウザ: window.LpyaFlow.stateOf(ctx) / .nextOf(ctx)
 *   ctx = { project, reports, gens, jobs }
 *     project … a2f58db45_projects の1行
 *     reports … 競合分析レポートの配列（件数だけ見る）
 *     gens    … 生成物の配列（feature_key / variant_label / sections /
 *                asset_prompts.made / public_url_slug を見る）
 *     jobs    … いま走っている仕事の配列（feature_key だけ見る）
 * ========================================================================== */
(function (global) {
  'use strict';

  /* 工程の並び。app.js の WORKFLOW と同じ順。
     ここを増やすときは、向こうの一覧にも足すこと */
  var STEPS = ['S4', 'S11', 'S20', 'S12', 'S13', 'S21'];

  /* どの工程が、どの仕事で「作業中」になるか */
  var BUSY_BY = {
    S4:  ['product_autofill', 'product_cutouts', 'target_proposal'],
    S11: ['competitor_analysis'],
    S20: ['target_proposal'],
    S12: ['lp_brief', 'lp_section', 'lp_assets', 'kv', 'meta_ads'],
    S13: ['sales_copy'],
    S21: ['line_brief', 'line_copy', 'line_assets']
  };

  function arr(x) { return Array.isArray(x) ? x : []; }

  function madeOf(gen) {
    var a = gen && gen.asset_prompts && gen.asset_prompts.made;
    return (a && typeof a === 'object') ? a : {};
  }

  /* その案の絵が全部そろっているか。区画が無いものは「まだ」 */
  function fullOf(gen) {
    var secs = arr(gen && gen.sections);
    if (!secs.length) { return false; }
    var made = madeOf(gen);
    return secs.every(function (sec) { return !!made[String(sec.index) + '-1']; });
  }

  function briefs(ctx) {
    return arr(ctx && ctx.gens).filter(function (g) { return g && g.feature_key === 'lp_brief'; });
  }

  function doneOf(step, ctx) {
    var project = (ctx && ctx.project) || {};
    switch (step) {
      case 'S4':
        return !!(project.category && project.cf_platform);
      case 'S11':
        return arr(ctx && ctx.reports).length > 0;
      case 'S20':
        return arr(project.targets).length > 0;
      case 'S12': {
        var list = briefs(ctx);
        return list.length > 0 && list.every(fullOf);
      }
      case 'S13':
        return arr(ctx && ctx.gens).some(function (g) { return g && g.public_url_slug; });
      case 'S21':
        return arr(ctx && ctx.gens).some(function (g) {
          return g && (g.feature_key === 'line_text' || g.feature_key === 'line_assets');
        });
      default:
        return false;
    }
  }

  function busyOf(step, ctx) {
    var keys = BUSY_BY[step] || [];
    return arr(ctx && ctx.jobs).some(function (job) {
      return job && keys.indexOf(String(job.feature_key)) !== -1;
    });
  }

  /* 工程ごとの状態。'done' 済 / 'busy' 作業中 / 'todo' まだ */
  function stateOf(ctx) {
    var out = {};
    STEPS.forEach(function (step) {
      out[step] = busyOf(step, ctx) ? 'busy' : (doneOf(step, ctx) ? 'done' : 'todo');
    });
    return out;
  }

  /* 絵が足りない案を数える。「つぎにやること」の中身になる */
  function shortOf(ctx) {
    var out = [];
    briefs(ctx).forEach(function (gen) {
      var secs = arr(gen.sections);
      if (!secs.length) { return; }
      var made = madeOf(gen);
      var n = secs.filter(function (sec) { return !made[String(sec.index) + '-1']; }).length;
      if (n) { out.push({ label: String(gen.variant_label || '-'), n: n, id: gen.id }); }
    });
    return out;
  }

  /* つぎにやること。1つだけ返す。
     全部済んでいたら、出口を2つ返す（空のカードや「おめでとう」は出さない） */
  function nextOf(ctx) {
    var st = stateOf(ctx);
    var busy = STEPS.filter(function (s) { return st[s] === 'busy'; });
    /* 走っているものがあるなら、次は無い。帯が面倒を見る */
    if (busy.length) { return { kind: 'busy', step: busy[0] }; }

    if (st.S4 !== 'done') { return { kind: 'step', step: 'S4', key: 'next.input' }; }
    if (st.S11 !== 'done') { return { kind: 'step', step: 'S11', key: 'next.report' }; }
    if (st.S20 !== 'done') { return { kind: 'step', step: 'S20', key: 'next.targets' }; }
    if (st.S12 !== 'done') {
      var short = shortOf(ctx);
      if (!briefs(ctx).length) { return { kind: 'step', step: 'S12', key: 'next.brief' }; }
      if (short.length) {
        return { kind: 'shots', step: 'S12', key: 'next.shots',
          label: short[0].label, n: short[0].n,
          total: short.reduce(function (a, b) { return a + b.n; }, 0) };
      }
      return { kind: 'step', step: 'S12', key: 'next.brief' };
    }
    if (st.S13 !== 'done') { return { kind: 'step', step: 'S13', key: 'next.publish' }; }
    if (st.S21 !== 'done') { return { kind: 'step', step: 'S21', key: 'next.line' }; }

    var published = arr(ctx && ctx.gens).filter(function (g) { return g && g.public_url_slug; })[0];
    return { kind: 'done', slug: published ? String(published.public_url_slug) : '' };
  }

  global.LpyaFlow = {
    STEPS: STEPS,
    stateOf: stateOf,
    nextOf: nextOf,
    shortOf: shortOf,
    /* 自己確認用 */
    _doneOf: doneOf
  };
}(window));
