/* compliance-panel.js — 拾った「危ない表現」を画面に出す
 *
 * 作りの決め:
 *   ・**止めない**。生成も保存も通す。止めると「直せないのに進めない」になる
 *   ・**「問題ありません」と出さない**。何も拾わなければ、何も出さない。
 *     出すと「アプリがOKと言った」を根拠にされる
 *   ・たたんでおく。毎回開いていると、本来の作業の邪魔になる
 *
 * 使い方:
 *   var node = window.LpyaCompliancePanel(findings, { t: t });
 *   findings が空なら null を返す（呼んだ側は足さない）
 */
(function (global) {
  'use strict';

  function el(tag, cls, text) {
    var n = global.document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined && text !== null) { n.textContent = String(text); }
    return n;
  }

  global.LpyaCompliancePanel = function (found, opts) {
    var list = (found || []).filter(function (x) { return x && x.kind; });
    if (!list.length) { return null; }
    var o = opts || {};
    var t = typeof o.t === 'function' ? o.t : function (k) { return k; };

    var det = el('details', 'compli');
    var sum = el('summary', 'compli__sum');
    sum.appendChild(el('span', 'chip chip--sm chip--warn', String(list.length)));
    sum.appendChild(el('span', '', ' ' + t('compli.title')));
    det.appendChild(sum);

    /* 何のための表示かを先に言う。でないと「違反です」と読まれる */
    det.appendChild(el('p', 'field__hint', t('compli.note')));

    var rows = el('div', 'list');
    list.forEach(function (f) {
      var row = el('div', 'list-row');
      var body = el('div', 'list-row__body');
      var head = el('div', 'list-row__title clamp-1');
      head.appendChild(el('span', 'chip chip--sm', f.law || ''));
      head.appendChild(el('span', '', ' ' + (f.kind || '')));
      body.appendChild(head);
      if (f.hit) { body.appendChild(el('div', 'list-row__sub', '「' + f.hit + '」')); }
      if (f.fix) { body.appendChild(el('div', 'list-row__meta clamp-2', f.fix)); }
      row.appendChild(body);
      rows.appendChild(row);
    });
    det.appendChild(rows);
    return det;
  };
}(window));
