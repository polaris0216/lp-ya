/* shot-carousel.js — できた絵を「版」として左右に送って見せる
 *
 * なぜ切り出したか（2026-10-23 要望）:
 *   LP案ページ（S12）のこの見せ方を、LINEコンテンツ（S21）でも使いたい。
 *   同じものを写すと必ずずれるので、1か所に置いて両方から呼ぶ。
 *
 * 作りの決め（S12 で分かっていること）:
 *   ・0番目が「いま使う版」。以降が前の版（新しい順）
 *   ・矢印では画面全体を描き直さない。描き直すと見ていた場所を失い、
 *     ページの先頭へ飛ぶ。ここで変わるのは絵と下の1行だけ
 *   ・両端に前後の版をぼかして覗かせる。次に何が来るか見当がつくし、
 *     押しても送れる（飾りにしない）
 *
 * 使い方:
 *   var c = window.LpyaShotCarousel({
 *     shots: [{ url, at, prompt }, …],   // 0番目がいま使う版
 *     at: 0,                              // どれを見ているか
 *     labels: { now, restore, zoom, prev, next, prompt, promptNone, promptUse, copy },
 *     currentPrompt: '…',                 // いま書かれている文（戻す手を出すか決める）
 *     onZoom: function (url) {},
 *     onRestore: function (indexInHistory) {},   // 0番目以外を選んだとき
 *     onUsePrompt: function (text) {},           // 「この文に戻す」
 *     onCopy: function (text) {},
 *     onMove: function (at) {},                  // 見ている位置が変わった
 *   });
 *   c.node  … 画面に足す要素
 *
 * class は styles.css の .lp-shot / __peek / __nav / __foot / __action / __prompt。
 */
(function (global) {
  'use strict';

  function el(tag, cls, text) {
    var node = global.document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  function btn(cls, text, onClick) {
    var b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  global.LpyaShotCarousel = function (opts) {
    var o = opts || {};
    var shots = (o.shots || []).filter(function (x) { return x && x.url; });
    var L = o.labels || {};
    var wrap = el('div', 'stack stack--tight');
    if (!shots.length) { return { node: wrap, at: 0 }; }

    var at = Math.min(Math.max(Number(o.at) || 0, 0), shots.length - 1);
    var stage = el('div', 'lp-shot');
    var img = el('img', 'lp-section__img');
    img.alt = ''; img.loading = 'lazy';
    img.title = L.zoom || '';
    img.setAttribute('role', 'button');
    img.setAttribute('tabindex', '0');
    var zoom = function () { if (o.onZoom) { o.onZoom(shots[at].url, at); } };
    img.addEventListener('click', zoom);
    img.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoom(); }
    });

    var peekPrev = el('img', 'lp-shot__peek');
    var peekNext = el('img', 'lp-shot__peek');
    peekPrev.alt = ''; peekNext.alt = '';
    peekPrev.loading = 'lazy'; peekNext.loading = 'lazy';

    var foot = el('div', 'lp-shot__foot');
    var counter = el('span', 't-note', '');
    var action = el('span', 'lp-shot__action');
    foot.appendChild(counter);
    foot.appendChild(action);

    var det = el('details', 'lp-shot__prompt');
    det.appendChild(el('summary', '', L.prompt || ''));
    var body = el('pre', 'lp-shot__prompt-body', '');
    var row = el('div', 'lp-toolbar');
    det.appendChild(body);
    det.appendChild(row);

    /* 左＝古い方、右＝新しい方。端はつながる */
    var older = function (i) { return (i + 1) % shots.length; };
    var newer = function (i) { return (i - 1 + shots.length) % shots.length; };

    function clear(node) { while (node.firstChild) { node.removeChild(node.firstChild); } }

    function show() {
      img.src = shots[at].url;
      /* 版が2つしか無いと左右の覗きが同じ絵になる。
         それでも「隣がある」ことは伝わるので、そのまま出す */
      peekPrev.src = shots[older(at)].url;
      peekNext.src = shots[newer(at)].url;
      counter.textContent = (at + 1) + ' / ' + shots.length
        + (shots[at].at ? '　' + String(shots[at].at).slice(0, 16).replace('T', ' ') : '');

      clear(action);
      /* いま使っている版以外を見ているときだけ、置き換えの手を出す */
      if (at === 0) {
        action.appendChild(el('span', 'chip chip--sm chip--success', L.now || ''));
      } else if (o.onRestore) {
        action.appendChild(btn('btn btn--secondary btn--sm', L.restore || '',
          function () { o.onRestore(at - 1, shots[at]); }));
      }

      var was = String(shots[at].prompt || '');
      body.textContent = was || (L.promptNone || '');
      clear(row);
      if (was) {
        /* いま書かれている文と違うときだけ「この文に戻す」を出す。
           同じ文なら押す意味がない */
        if (o.onUsePrompt && was !== String(o.currentPrompt || '')) {
          row.appendChild(btn('btn btn--secondary btn--sm', L.promptUse || '',
            function () { o.onUsePrompt(was); }));
        }
        if (o.onCopy) {
          row.appendChild(btn('btn btn--text btn--sm', L.copy || '',
            function () { o.onCopy(was); }));
        }
      }
      if (o.onMove) { o.onMove(at); }
    }

    if (shots.length > 1) {
      var goOlder = function () { at = older(at); show(); };
      var goNewer = function () { at = newer(at); show(); };
      var prev = btn('btn btn--secondary btn--sm lp-shot__nav', '‹', goOlder);
      prev.setAttribute('aria-label', L.prev || '');
      var next = btn('btn btn--secondary btn--sm lp-shot__nav', '›', goNewer);
      next.setAttribute('aria-label', L.next || '');
      peekPrev.addEventListener('click', goOlder);
      peekNext.addEventListener('click', goNewer);
      stage.appendChild(peekPrev);
      stage.appendChild(prev);
      stage.appendChild(img);
      stage.appendChild(next);
      stage.appendChild(peekNext);
    } else {
      stage.appendChild(img);
    }

    show();
    wrap.appendChild(stage);
    if (shots.length > 1) { wrap.appendChild(foot); }
    wrap.appendChild(det);

    return { node: wrap, show: show, at: function () { return at; } };
  };
}(window));
