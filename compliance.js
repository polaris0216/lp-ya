/* =============================================================================
 * compliance.js — 書いた文の「危ない表現」を拾う
 *
 * ことわり（これが一番大事）:
 *   ここがやるのは **指摘** であって、適法の **判定ではない**。
 *   「問題ありません」とは絶対に言わない。理由:
 *     ・薬機法は文面だけでなく、商品の区分（化粧品／医薬部外品／雑貨）と
 *       届出の実態で決まる。文字だけでは原理的に確定できない
 *     ・外れたときに「アプリがOKと言った」を根拠にされると、作った側が負う
 *   出すのは〈どこが・なぜ危ないか・どう言い換えるか〉だけ。
 *
 * 景表法が先、薬機法が後の理由:
 *   薬機法は化粧品・食品など一部のカテゴリだけに効く。景表法は全案件に効く。
 *   しかもこのアプリは割引率を主役に据えていて、クラファンは「支援」なので
 *   比較対象の通常価格がまだ無い。二重価格表示はここで最も起きやすい。
 *
 * この1本を、画面（ブラウザ）と道具（Node）の両方から使う。
 * 写すと必ずずれるので、規則はここにしか置かない。
 *   ブラウザ … window.LpyaCompliance
 *   Node     … tools/compliance.mjs が読み込んで同じものを返す
 * ========================================================================== */
(function (global) {
  'use strict';

  /* 言い切り。根拠があっても言い切れないものと、そもそも書けないもの */
  const ASSERT = [
    [/必ず|絶対(に)?|確実に|100\s*[%％]|誰でも/, '言い切り',
      '例外が1件でもあると不当表示になる。「〜しやすい」「〜を目指して設計」に逃がす'],
    [/永久|半永久|一生(もの|使える)/, '永久をうたう',
      '寿命の裏づけが要る。「耐久試験で〇〇回」など測った値に言い換える'],
  ];

  /* 最上級・No.1。使うなら調査の出典（調査機関・時期・範囲）が要る */
  const BEST = [
    [/No\.?\s*[1１]|ナンバー\s*ワン|日本一|世界一|業界\s*(初|No)|世界初|日本初|国内初/, '最上級・No.1',
      '調査の出典（機関・時期・範囲）を併記しないと使えない。無いなら表現ごと外す'],
    [/最高(の|級)|最強|最安|唯一無二|他社を圧倒|比類/, '最上級',
      '何と比べて最高かを示せないなら外す。「当社従来比」なども根拠が要る'],
  ];

  /* 期間・数量の煽り。実際にその期間・数量で終わらないと不当表示 */
  const URGENCY = [
    [/今だけ|本日限り|残りわずか|先着\s*\d*\s*(名|個)?限り/, '期間・数量の煽り',
      '実際の期限や残数と一致していないと不当表示になる。具体的な日付・数に置き換える'],
  ];

  /* 二重価格。クラファンで最も起きやすい */
  const PRICE = [
    [/\d+\s*[%％]\s*(OFF|オフ|割引)|定価|通常価格|希望小売価格|メーカー希望/, '二重価格表示', ''],
  ];

  /* 薬機法。カテゴリで効かせ方を変える。
     雑貨（家電・ガジェット）に「改善」と書いてあっても問題にならないが、
     化粧品・食品で同じ語を使うと医薬品的な効能をうたったことになる */
  const YAKKI_BODY = [
    [/治る|治療|完治|治癒|快方/, '治るとうたう',
      '医薬品以外では書けない。「〜のケアに」「〜を心地よく保つ」に逃がす'],
    [/効く|効果が?あ(る|り)|効能/, '効能をうたう',
      '承認を受けた医薬品以外では書けない。使用感や設計の説明に置き換える'],
    [/予防|防ぐ/, '予防をうたう',
      '化粧品・食品では書けない（薬用で認められた範囲を除く）'],
    [/改善|回復|解消/, '身体の変化をうたう',
      '化粧品で言える範囲を超える。「うるおいを与える」など認められた表現に寄せる'],
    [/痩せ(る|せる)?|脂肪(を)?燃焼|体脂肪が減|デトックス|毒素/, '痩身をうたう',
      '食品・化粧品では書けない。体験談の形でも同じ'],
    [/美白|シミが?消え|シワが?消え|若返(り|る)|アンチエイジング/, '美白・若返りをうたう',
      '「メラニンの生成を抑え、しみ・そばかすを防ぐ」など、認められた言い回しに限る'],
    [/副作用が?な(い|く)|安全です|無害/, '安全性の言い切り',
      '安全性の断定は医薬品でも書けない'],
    [/医薬品|処方|医師(が|も)(推奨|認め)|臨床/, '医薬品と紛らわしい',
      '医薬品だと誤解させる表現。区分が雑貨・化粧品なら外す'],
  ];

  /* 薬機法を効かせるカテゴリ。
     雑貨には効かせない——「汚れを改善」程度で止めると使い物にならない */
  const YAKKI_CATEGORIES = ['beauty', 'food'];

  /* 言い切りを和らげる言葉。近くにあれば断定していない。
     実測 2026-10-24: 「家庭で最高の一杯を**目指して**」（会社の理念）を
     最上級として拾ってしまった。目指す・ように・ための は断定ではない */
  /* 実測 2026-10-24: 「家庭で最高の〜を届けることを目標にしてきました」も
     理念であって断定ではない。目指 だけでは足りなかった */
  const SOFT = /目指|目標|ように|ための|したい|願[いうっ]|祈|こだわ|という思い|をコンセプト|理念|掲げ/;

  /* 打ち消しの形。「絶対にしない」は言い切りの宣伝ではない */
  const NEG = /しない|しません|せず|ありません|避け/;

  function near(body, at, hit) {
    /* 同じ文の中だけを見る。文をまたぐと関係ない語を拾う */
    const from = Math.max(0, body.lastIndexOf('。', at) + 1);
    let to = body.indexOf('。', at + hit.length);
    if (to === -1) { to = Math.min(body.length, at + hit.length + 40); }
    return body.slice(from, to + 1);
  }

  function hitsOf(text, rules, law) {
    const out = [];
    const body = String(text || '');
    rules.forEach(([re, kind, fix]) => {
      const m = body.match(re);
      if (!m) { return; }
      const at = body.indexOf(m[0]);
      const sentence = near(body, at, m[0]);
      /* 和らげ・打ち消しが同じ文にあるなら拾わない */
      if (SOFT.test(sentence) || NEG.test(sentence)) { return; }
      out.push({ law, kind, hit: m[0], fix, at });
    });
    return out;
  }

  /* 生成物から「実際に人の目に出る文」だけを取り出す。
     sections[].prompt は **AIへの指示**で、LPには出ない。
     実測 2026-10-24: 指示の中の「## 絶対にしないこと」を拾って誤検出していた。
     見るのは 見出し(title) と 本文(text / body)、それに販売ページの文章 */
  function displayText(generation) {
    const g = generation || {};
    const out = [];
    const push = (v) => { if (v && typeof v === 'string') { out.push(v); } };
    const secs = Array.isArray(g.sections) ? g.sections : [];
    secs.forEach((s) => { push(s && s.title); push(s && s.text); push(s && s.body); });
    const c = (g.content && typeof g.content === 'object') ? g.content : {};
    if (typeof c.sales === 'string') { push(c.sales); }
    else if (c.sales && typeof c.sales === 'object') { push(JSON.stringify(c.sales)); }
    /* LINEの文章は content.messages に入る */
    if (Array.isArray(c.messages)) { c.messages.forEach((m) => push(m && (m.text || m.body || m))); }
    return out.join('。');
  }

  /* カテゴリの綴りを取り出す。画面は 'category.beauty' の形で持っている */
  function categoryKey(value) {
    return String(value || '').replace(/^category\./, '').trim().toLowerCase();
  }

  /* 割引をうたってよいかを見る。
     クラファンは「支援」で、比較対象の価格をまだ売っていないことが多い。
     消費者庁の二重価格表示の考え方では、比較対照価格は
     「最近相当期間にわたって販売された価格」でなければならない。
     将来の販売価格を使うなら、**終了後に実際にその価格で売ること**が要る */
  function checkPrice(text, ctx) {
    const o = ctx || {};
    const body = String(text || '');
    const found = hitsOf(body, PRICE, '景表法');
    if (!found.length) { return []; }
    const list = Number(o.listPrice) || 0;
    const now = Number(o.price) || 0;
    const out = [];
    if (!list) {
      out.push({ law: '景表法', kind: '二重価格の根拠が無い', hit: found[0].hit,
        fix: '比較する価格（発売予定価格）を商品情報に入れる。入れられないなら割引率を出さない' });
      return out;
    }
    /* 数字が合っているか。合っていないと、それだけで不当表示になる */
    const shown = (body.match(/(\d+)\s*[%％]\s*(OFF|オフ|割引)/) || [])[1];
    if (shown && list && now) {
      const real = Math.round((1 - now / list) * 100);
      if (Math.abs(real - Number(shown)) > 1) {
        out.push({ law: '景表法', kind: '割引率が合わない', hit: shown + '%OFF',
          fix: `入力の価格（${list}円→${now}円）だと約${real}%。表示と揃える` });
      }
    }
    /* まだ売っていない価格との比較 */
    if (o.beforeSale) {
      out.push({ law: '景表法', kind: '将来価格との比較', hit: found[0].hit,
        fix: '「発売予定価格」と明記し、終了後に実際にその価格で販売すること。'
          + '売らないなら比較表示にしない' });
    }
    return out;
  }

  function check(text, ctx) {
    const o = ctx || {};
    const body = String(text || '');
    if (!body.trim()) { return []; }
    let out = []
      .concat(hitsOf(body, ASSERT, '景表法'))
      .concat(hitsOf(body, BEST, '景表法'))
      .concat(hitsOf(body, URGENCY, '景表法'))
      .concat(checkPrice(body, o));
    /* 薬機法はカテゴリで効かせる */
    if (YAKKI_CATEGORIES.indexOf(categoryKey(o.category)) !== -1) {
      out = out.concat(hitsOf(body, YAKKI_BODY, '薬機法'));
    }
    /* 同じ語を二度出さない */
    const seen = {};
    return out.filter((x) => {
      const key = x.law + ':' + x.kind + ':' + x.hit;
      if (seen[key]) { return false; }
      seen[key] = 1;
      return true;
    });
  }

  /* 画面やログに出す1行。「問題ありません」は返さない */
  function summary(found) {
    if (!found || !found.length) { return ''; }
    const byLaw = {};
    found.forEach((f) => { byLaw[f.law] = (byLaw[f.law] || 0) + 1; });
    return Object.keys(byLaw).map((k) => `${k} ${byLaw[k]}件`).join(' / ');
  }

  global.LpyaCompliance = {
    check: check, checkPrice: checkPrice,
    categoryKey: categoryKey, summary: summary, displayText: displayText
  };
}(typeof window !== 'undefined' ? window : globalThis));
