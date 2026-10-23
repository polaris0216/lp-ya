/* line-pick.js — LINEの枠の形を、見本を描いて選ばせる
 *
 * なぜ切り出したか（2026-10-23 要望）:
 *   同じ「形を選ぶ」が LP案ページ（S12）と LINEコンテンツ（S21）の両方に要る。
 *   S12 は文字だけの <select> で、どんな割り方か分からなかった。
 *   S21 には見本つきの選択があったが、その画面にしか無かった。
 *   写すと必ずずれるので、1か所に置いて両方から使う。
 *
 *   形の大元は line-layouts.js（tools/make-line-layouts.mjs が作る自動生成）。
 *   こちらは描き方だけを持つ。
 *
 * 使い方:
 *   var node = window.LpyaLinePick({
 *     kind: 'menu' | 'message',
 *     value: 'ÂÂ-3y',          // いま選んでいる形。無ければ ''
 *     noneLabel: '作らない',
 *     onPick: function (id) {}
 *   });
 *
 * class は styles.css の .line-pick / __one / __shape / __cell / __name / __size。
 */
(function (global) {
  'use strict';

  function el(tag, cls, text) {
    var node = global.document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  function layoutsOf(kind) {
    var all = global.LPYA_LINE_LAYOUTS;
    if (!all) { return []; }
    return (kind === 'menu' ? all.menu : all.message) || [];
  }

  global.LpyaLinePick = function (opts) {
    var o = opts || {};
    var wrap = el('div', 'line-pick');
    var chosen = String(o.value || '');
    var tell = typeof o.onPick === 'function' ? o.onPick : function () {};

    function mark() {
      [].slice.call(wrap.children).forEach(function (node) {
        var id = node.getAttribute('data-id') || '';
        node.className = 'line-pick__one' + (id === chosen ? ' is-on' : '');
      });
    }

    function add(id, build) {
      var b = el('button', 'line-pick__one' + (id === chosen ? ' is-on' : ''));
      b.type = 'button';
      b.setAttribute('data-id', id);
      build(b);
      b.addEventListener('click', function () { chosen = id; mark(); tell(id); });
      wrap.appendChild(b);
      return b;
    }

    /* 「作らない」も選べる。無いと、一度選んだら外せない */
    add('', function (b) {
      b.appendChild(el('span', 'line-pick__none', '—'));
      b.appendChild(el('span', 'line-pick__name', o.noneLabel || '作らない'));
    });

    layoutsOf(o.kind).forEach(function (L) {
      add(L.id, function (b) {
        /* 見本。高さは幅から縦横比で出す。カスタム（高さ未定）は
           いちばん短い高さで描く——「高さは自由」と名前に出ている */
        var h = L.h || L.hMin || 1040;
        var shape = el('div', 'line-pick__shape');
        shape.style.aspectRatio = String(L.w) + ' / ' + String(h);
        (L.cells || []).forEach(function (c) {
          var cell = el('span', 'line-pick__cell');
          cell.style.left = (c.x * 100) + '%';
          cell.style.top = (c.y * 100) + '%';
          cell.style.width = (c.w * 100) + '%';
          cell.style.height = (c.h * 100) + '%';
          shape.appendChild(cell);
        });
        b.appendChild(shape);
        b.appendChild(el('span', 'line-pick__name', L.name));
        b.appendChild(el('span', 'line-pick__size',
          L.h ? (L.w + '×' + L.h) : (L.w + '×高さ自由')));
      });
    });

    /* 箱の中だけを送るので、いま選んでいるものが隠れていることがある。
       開いたときに、選んでいる所まで中を送っておく */
    if (global.requestAnimationFrame) {
      global.requestAnimationFrame(function () {
        var on = wrap.querySelector('.is-on');
        if (!on || on === wrap.firstChild) { return; }
        wrap.scrollTop = Math.max(0, on.offsetTop - wrap.clientHeight / 2 + on.offsetHeight / 2);
      });
    }

    return wrap;
  };
}(window));
