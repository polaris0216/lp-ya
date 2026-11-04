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

  /* ---- 残高との差（2026-11-04 の決め）----
     残高280Pのときに「全部一括生成 1072P」が、押せる見た目のまま出ていた。
     押してはじめて足りないと分かり、足す導線もその場に無かった。
     ここは値段の札を出す唯一の場所なので、残高の判断もここでまとめて持つ。 */
  const stamped = [];          /* { btn, points, big, note } 札を出したボタン */
  let watching = false;

  function balanceNow() {
    const app = global.App;
    return (app && typeof app.getBalance === 'function') ? Number(app.getBalance()) || 0 : null;
  }

  /* 無制限で使える人は、残高と比べない（2026-11-04）。
     DBの引き落とし（055 のトリガ）は elpiya_has_unlimited を見て 0 を引くので、
     残高はそのまま残る。それを見て「足りません」と塞ぐと、
     実際には押せる人のボタンを画面だけが止めてしまう */
  function unlimited() {
    const app = global.App;
    const user = (app && typeof app.getUser === 'function') ? app.getUser() : null;
    const api = global.Api && global.Api.credits;
    if (!user || !api || typeof api.hasUnlimited !== 'function') { return false; }
    return !!api.hasUnlimited(user);
  }

  function say(key, params) {
    const app = global.App;
    return (app && typeof app.t === 'function') ? app.t(key, params) : key;
  }

  /* 残高が変わったら、出している札を全部描き直す */
  function watchBalance() {
    if (watching) { return; }
    const app = global.App;
    if (!app || typeof app.on !== 'function') { return; }
    watching = true;
    app.on('balance', function () { repaintAll(); });
  }

  function repaintAll() {
    for (let i = stamped.length - 1; i >= 0; i -= 1) {
      const one = stamped[i];
      /* 画面を描き直すとボタンは捨てられる。残ったものだけ面倒を見る */
      if (!one.btn || !global.document.body.contains(one.btn)) { stamped.splice(i, 1); continue; }
      applyBalance(one);
    }
  }

  function dropNote(one) {
    if (one.note && one.note.parentNode) { one.note.parentNode.removeChild(one.note); }
    one.note = null;
  }

  function applyBalance(one) {
    const btn = one.btn;
    const have = balanceNow();
    dropNote(one);
    btn.classList.remove('btn--short');
    if (btn.dataset) { delete btn.dataset.lpyaShort; }
    if (have === null || !one.points) { return; }
    /* 無制限の人には、不足額も「生成後の残高」も出さない。どちらも嘘になる */
    if (unlimited()) { return; }

    if (one.points > have) {
      /* 足りないボタンは沈める。押させてから怒るのはやめる */
      btn.classList.add('btn--short');
      btn.disabled = true;
      if (btn.dataset) { btn.dataset.lpyaShort = '1'; }
      const box = global.document.createElement('div');
      box.className = 'cost-short';
      const text = global.document.createElement('span');
      text.textContent = say('cost.short', { n: one.points - have });
      box.appendChild(text);
      const go = global.document.createElement('button');
      go.type = 'button';
      go.className = 'cost-short__go';
      go.textContent = say('cost.topup');
      go.addEventListener('click', function () { global.location.hash = '#/S17'; });
      box.appendChild(go);
      one.note = box;
      if (btn.parentNode) { btn.parentNode.insertBefore(box, btn.nextSibling); }
      return;
    }

    /* 大きいボタンにだけ「生成後の残高」を添える。
       1区画8Pのような小さいボタンにも出すと、札だらけになる */
    if (one.big) {
      const after = global.document.createElement('p');
      after.className = 'field__hint cost-after';
      after.textContent = say('cost.after', { a: have, b: have - one.points });
      one.note = after;
      if (btn.parentNode) { btn.parentNode.insertBefore(after, btn.nextSibling); }
    }
  }

  /* ボタンの中に金額を出す。読み込みが終わってから足すので、
     分からないあいだは何も出さない（0ポイントと嘘をつかない）。
     同じボタンに二度押ししても札は1枚だけ（前の札を外してから足す） */
  function paint(btn, points, opts) {
    if (!btn || !btn.appendChild) { return; }
    const old = btn.querySelector && btn.querySelector('.btn__pt');
    if (old && old.parentNode) { old.parentNode.removeChild(old); }
    if (!points) { return; }
    const tag = global.document.createElement('span');
    tag.className = 'btn__pt';
    tag.textContent = String(points) + 'P';
    btn.appendChild(tag);

    /* 残高との差はここで面倒を見る */
    let one = null;
    for (let i = 0; i < stamped.length; i += 1) { if (stamped[i].btn === btn) { one = stamped[i]; } }
    if (!one) { one = { btn: btn, points: 0, big: false, note: null }; stamped.push(one); }
    one.points = points;
    one.big = !!(opts && opts.big);
    watchBalance();
    applyBalance(one);
  }

  function stamp(btn, featureKey, units, opts) {
    if (!btn) { return; }
    load().then(function () { paint(btn, pointsOf(featureKey, units), opts); });
  }

  /* 1回押すと続けて何本も走るボタン（商品入力の「AI自動分析」など）。
     parts は [[featureKey, units], ...]。合計を出す */
  function stampSum(btn, parts, opts) {
    if (!btn) { return; }
    load().then(function () {
      let sum = 0;
      (parts || []).forEach(function (pair) {
        if (!pair) { return; }
        sum += pointsOf(pair[0], pair[1]);
      });
      paint(btn, sum, opts);
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
