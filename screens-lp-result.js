/* =============================================================================
 * screens-lp-result.js — S13 生成結果（LP案を HTML に組んで見る・落とす・公開する）
 *
 * S12 で直した LP案（generations.sections）を、lp-render.js の buildDraftHtml で
 * HTML にする。ブランドカラー・フォントは商品入力のものを使う。
 * 組んだ HTML は generations.generated_html に保存し、公開は既存の
 * Api.lp.publish（SECURITY DEFINER RPC）を通す。
 *
 * 画面登録   App.registerScreen('S13', { render })
 * URL        #/S13?id=<プロジェクトID>&gen=<生成物ID>
 * ========================================================================== */
(function () {
  'use strict';

  var App = window.App = window.App || {};
  var LOCALES = ['ja', 'en', 'ko'];
  var FEATURE = 'lp_draft';

  var LOCAL = {
    'lpr.title': ['生成結果', 'Generated result', '생성 결과'],
    'lpr.lead': ['LP案を、参照ページと同じ形（本文幅712px・訴求は絵に焼き込み・余白なし）で組みます。',
      'Renders the LP draft in the same shape as the reference page (712px column, copy burned into visuals, no gaps).',
      'LP 초안을 참조 페이지와 같은 형태(본문 712px, 카피는 이미지에 새김, 여백 없음)로 조립합니다.'],
    'lpr.build': ['HTMLを組む', 'Build HTML', 'HTML 조립'],
    'lpr.rebuild': ['組み直す', 'Rebuild', '다시 조립'],
    'lpr.download': ['HTMLを落とす', 'Download HTML', 'HTML 다운로드'],
    'lpr.publish': ['公開する', 'Publish', '공개'],
    'lpr.unpublish': ['公開をやめる', 'Unpublish', '공개 중지'],
    'lpr.published': ['公開しました', 'Published', '공개했습니다'],
    'lpr.unpublished': ['公開をやめました', 'Unpublished', '공개를 중지했습니다'],
    'lpr.saved': ['HTMLを保存しました', 'HTML saved', 'HTML을 저장했습니다'],
    'lpr.backToDraft': ['LP案に戻る', 'Back to draft', '초안으로'],
    'lpr.noGen': ['LP案がありません。先に LP案 を作ってください。', 'No LP draft yet. Create one first.', 'LP 초안이 없습니다. 먼저 만들어 주세요.'],
    'lpr.noProject': ['プロジェクトが選ばれていません', 'No project selected', '프로젝트가 선택되지 않았습니다'],
    'lpr.stats': ['{sections} 区画 / 絵 {images} 枚 / 高さ約 {height}px', '{sections} sections / {images} visuals / about {height}px tall', '{sections}구획 / 이미지 {images}장 / 높이 약 {height}px'],
    'lpr.publicUrl': ['公開URL', 'Public URL', '공개 URL']
  };

  if (typeof App.registerScreen !== 'function') {
    console.error('[screens-lp-result] App.registerScreen が見つかりません。index.html の読み込み順を確認してください。');
    App.screens = App.screens || {};
    App.registerScreen = function (id, spec) { App.screens[id] = spec; };
  }

  function currentLocale() {
    if (window.I18N && typeof window.I18N.locale === 'function') { return window.I18N.locale(); }
    return 'ja';
  }
  function fill(text, params) {
    if (!params) { return text; }
    return String(text).replace(/\{(\w+)\}/g, function (m, k) { return params[k] === undefined ? m : String(params[k]); });
  }
  function t(key, params) {
    var row = LOCAL[key];
    if (row) { var i = LOCALES.indexOf(currentLocale()); return fill(row[i < 0 ? 0 : i] || row[0], params); }
    if (window.I18N && typeof window.I18N.t === 'function') { return window.I18N.t(key, params); }
    return key;
  }
  function el(tag, className, textContent) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (textContent !== undefined && textContent !== null) { node.textContent = String(textContent); }
    return node;
  }
  function button(className, label, onClick) {
    var node = el('button', className, label);
    node.type = 'button';
    if (onClick) { node.addEventListener('click', onClick); }
    return node;
  }
  function clear(node) { while (node && node.firstChild) { node.removeChild(node.firstChild); } }
  function add(parent, child) { if (parent && child) { parent.appendChild(child); } return child; }
  function toast(message, kind) {
    if (typeof App.toast === 'function') { App.toast(message, kind); } else { console.log('[screens-lp-result]', kind, message); }
  }
  function setHeader(title) {
    var titleNode = document.getElementById('header-title');
    var backNode = document.getElementById('header-back');
    var actionNode = document.getElementById('header-action');
    if (titleNode) { titleNode.textContent = title; }
    if (backNode) { backNode.hidden = false; }
    if (actionNode) { clear(actionNode); }
  }

  /* 商品入力のブランド指定を、描画の設計値に写す。
     色は先頭がメイン。文字色は濃い方、差し色は2色目 */
  function designFromProject(project) {
    var d = {
      titleFont: 'gothic', bodyFont: 'gothic', titleSize: 30, bodySize: 16,
      titleColor: '#171018', bodyColor: '#3A323E', bgColor: '#FFFFFF', accentColor: '#C13584'
    };
    var colors = Array.isArray(project && project.brand_colors) ? project.brand_colors : [];
    if (colors[0]) { d.accentColor = String(colors[0]); }
    if (colors[1]) { d.accentColor = String(colors[1]); d.titleColor = String(colors[0]); }
    var fonts = project && project.brand_fonts && typeof project.brand_fonts === 'object' ? project.brand_fonts : {};
    if (fonts.title === 'mincho') { d.titleFont = 'mincho'; }
    if (fonts.body === 'mincho') { d.bodyFont = 'mincho'; }
    return d;
  }

  App.registerScreen('S13', {
    render: function (root, params) {
      params = params || {};
      var projectId = params.id || (window.Api && Api.storage && Api.storage.get('projectId')) || '';
      setHeader(t('lpr.title'));
      clear(root);
      if (!projectId) { add(root, el('p', 'empty', t('lpr.noProject'))); return; }

      var view = { project: null, gen: null, html: '', busy: false };
      var screen = el('div', 'screen');
      var head = el('header', 'screen__head');
      add(head, el('h2', 'screen__title', t('lpr.title')));
      add(head, el('p', 'screen__lead', t('lpr.lead')));
      add(screen, head);
      var toolbar = el('div', 'lp-toolbar');
      add(screen, toolbar);
      var stats = el('p', 't-note lpr-stats');
      add(screen, stats);
      var frameWrap = el('div', 'lpr-frame');
      var frame = el('iframe', 'lpr-frame__iframe');
      frame.setAttribute('title', t('lpr.title'));
      frame.setAttribute('sandbox', 'allow-same-origin');
      add(frameWrap, frame);
      add(screen, frameWrap);
      add(root, screen);

      var genQuery = params.gen
        ? Api.generations.get(params.gen)
        : Api.generations.first({ eq: { projects_id: projectId, feature_key: FEATURE }, order: 'created_at.desc' });
      Promise.all([Api.projects.get(projectId), genQuery]).then(function (got) {
        view.project = got[0];
        view.gen = got[1];
        if (!view.gen) { add(root, el('p', 'empty', t('lpr.noGen'))); return; }
        view.html = String(view.gen.generated_html || '');
        if (!view.html) { build(false); }
        paint();
      }).catch(function (err) {
        console.error('[screens-lp-result] 読み込みに失敗:', err);
        add(root, el('p', 'empty', String(err && err.message || err)));
      });

      function build(save) {
        if (!window.LpRender || typeof LpRender.buildDraftHtml !== 'function') {
          console.error('[screens-lp-result] LpRender.buildDraftHtml がありません。lp-render.js を確認してください。');
          return;
        }
        var draft = { summary: view.gen.content && view.gen.content.summary, sections: view.gen.sections };
        view.html = LpRender.buildDraftHtml({
          draft: draft,
          project: view.project,
          design: designFromProject(view.project),
          title: view.project.product_name || view.project.name || ''
        });
        if (save) {
          Api.generations.update(view.gen.id, { generated_html: view.html }).then(function () {
            toast(t('lpr.saved'), 'success');
          }).catch(function (err) { console.error('[screens-lp-result] 保存に失敗:', err); });
        }
      }

      function paint() {
        clear(toolbar);
        add(toolbar, button('btn btn--secondary', t('lpr.backToDraft'), function () {
          location.hash = '#/S12?id=' + encodeURIComponent(projectId) + '&gen=' + encodeURIComponent(view.gen.id);
        }));
        add(toolbar, button('btn btn--primary', view.gen.generated_html ? t('lpr.rebuild') : t('lpr.build'), function () {
          build(true); paint();
        }));
        add(toolbar, button('btn btn--secondary', t('lpr.download'), download));
        if (window.Api && Api.lp) {
          if (view.gen.published_at && view.gen.public_url) {
            add(toolbar, button('btn btn--secondary', t('lpr.unpublish'), function () { setPublish(false); }));
          } else {
            add(toolbar, button('btn btn--secondary', t('lpr.publish'), function () { setPublish(true); }));
          }
        }
        if (view.gen.published_at && view.gen.public_url) {
          var a = el('a', 't-note', t('lpr.publicUrl') + ': ' + view.gen.public_url);
          a.href = view.gen.public_url; a.target = '_blank'; a.rel = 'noopener';
          add(toolbar, a);
        }

        frame.srcdoc = view.html;
        frame.addEventListener('load', measure, { once: true });
      }

      function measure() {
        try {
          var doc = frame.contentDocument;
          var sections = doc.querySelectorAll('section').length;
          var images = doc.querySelectorAll('img, svg image, video').length;
          var height = doc.documentElement.scrollHeight;
          stats.textContent = t('lpr.stats', { sections: sections, images: images, height: height });
          frame.style.height = Math.min(height, 12000) + 'px';
        } catch (e) { /* 測れなくても表示は続ける */ }
      }

      function download() {
        var blob = new Blob([view.html], { type: 'text/html' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = (view.project.product_name || view.project.name || 'lp') + '.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }

      function setPublish(on) {
        if (view.busy) { return; }
        view.busy = true;
        var call = on ? Api.lp.publish(view.gen.id, view.html) : Api.lp.unpublish(view.gen.id);
        call.then(function () {
          return Api.generations.get(view.gen.id);
        }).then(function (row) {
          view.gen = row || view.gen;
          view.busy = false;
          toast(t(on ? 'lpr.published' : 'lpr.unpublished'), 'success');
          paint();
        }).catch(function (err) {
          view.busy = false;
          console.error('[screens-lp-result] 公開の切り替えに失敗:', err);
          toast(String(err && err.message || err), 'danger');
        });
      }
    }
  });
})();
