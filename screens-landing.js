/* ============================================================
 * エルピーヤ — screens-landing.js
 * S0 ログイン前ホーム（アプリ紹介）だけを描く。
 *
 * ttalkkak-ai.com のトップページと同じ組み立て:
 *   映像背景のヒーロー → 3ステップ → 機能一覧 → クレジット料金 → 最終CTA
 *
 * ---- 他ファイルとの共通契約 ----
 * 画面登録   App.registerScreen('S0', { render: function (root, params) {} });
 * 画面遷移   location.hash = '#/S1'（ログイン）/ '#/S2'（新規登録）
 * 文言       i18n.js の window.I18N.t(key) だけを使う
 * class      styles.css に実在する綴りだけを使う（lp-* は本画面専用）
 *
 * 背景動画 hero-bg.mp4 が無い環境でも、CSS のグラデーションだけで成立する。
 * ============================================================ */

(function (window, document) {
  'use strict';

  var App = window.App = window.App || {};

  if (typeof App.registerScreen !== 'function') {
    console.error('[screens-landing] App.registerScreen が見つかりません。index.html の読み込み順（app.js -> screens-landing.js）を確認してください。');
    return;
  }
  if (!window.I18N || typeof window.I18N.t !== 'function') {
    console.error('[screens-landing] window.I18N.t が見つかりません。翻訳キーをそのまま表示します。');
  }

  var HERO_VIDEO = 'hero-bg.mp4';

  var STEPS = ['landing.step1', 'landing.step2', 'landing.step3'];
  var FEATURES = [
    'landing.featCfLp', 'landing.featOwnLp', 'landing.featKv',
    'landing.featAds', 'landing.featLine', 'landing.featAb'
  ];

  function t(key, params) {
    if (window.I18N && typeof window.I18N.t === 'function') { return window.I18N.t(key, params); }
    return key;
  }

  function el(tag, className, textContent) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (textContent !== undefined && textContent !== null) { node.textContent = String(textContent); }
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) { node.removeChild(node.firstChild); }
  }

  function go(screenId) {
    window.location.hash = '#/' + screenId;
  }

  function linkButton(className, label, screenId) {
    var node = el('button', className, label);
    node.type = 'button';
    node.addEventListener('click', function () { go(screenId); });
    return node;
  }

  /* 見出しの「、」で改行させる（ttalkkak の2行ヘッドラインと同じ見え方） */
  function headline(text) {
    var node = el('h1', 'lp-hero__title');
    String(text).split('\n').forEach(function (line, index) {
      if (index > 0) { node.appendChild(el('br')); }
      node.appendChild(document.createTextNode(line));
    });
    return node;
  }

  function buildHero() {
    var hero = el('section', 'lp-hero');

    /* 背景の映像。読めない環境ではグラデーションだけが残る */
    var video = document.createElement('video');
    video.className = 'lp-hero__video';
    video.src = HERO_VIDEO;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    video.addEventListener('error', function () {
      console.error('[screens-landing] ' + HERO_VIDEO + ' を読み込めませんでした。背景はグラデーションだけになります。');
      video.remove();
    });
    hero.appendChild(video);
    hero.appendChild(el('div', 'lp-hero__veil'));

    var inner = el('div', 'lp-hero__inner');
    inner.appendChild(el('span', 'lp-eyebrow', t('landing.eyebrow')));
    inner.appendChild(headline(t('landing.title')));
    inner.appendChild(el('p', 'lp-hero__lead', t('landing.lead')));

    var actions = el('div', 'lp-actions');
    actions.appendChild(linkButton('btn btn--primary lp-cta', t('landing.ctaStart'), 'S2'));
    actions.appendChild(linkButton('btn lp-cta lp-cta--ghost', t('landing.ctaLogin'), 'S1'));
    inner.appendChild(actions);

    inner.appendChild(el('p', 'lp-hero__note', t('landing.ctaNote')));
    hero.appendChild(inner);
    return hero;
  }

  function buildSection(labelKey, titleKey, descKey) {
    var section = el('section', 'lp-section');
    section.appendChild(el('span', 'lp-eyebrow lp-eyebrow--dark', t(labelKey)));
    section.appendChild(el('h2', 'lp-section__title', t(titleKey)));
    if (descKey) { section.appendChild(el('p', 'lp-section__desc', t(descKey))); }
    return section;
  }

  function buildCards(keys, extraClass) {
    var grid = el('div', 'lp-grid' + (extraClass ? ' ' + extraClass : ''));
    keys.forEach(function (key, index) {
      var card = el('article', 'lp-card');
      if (extraClass === 'lp-grid--steps') {
        card.appendChild(el('span', 'lp-card__num', String(index + 1)));
      }
      card.appendChild(el('span', 'lp-card__title', t(key)));
      card.appendChild(el('p', 'lp-card__desc', t(key + 'Desc')));
      grid.appendChild(card);
    });
    return grid;
  }

  function buildPricing() {
    var section = buildSection('landing.pricingLabel', 'landing.pricingTitle', 'landing.pricingDesc');
    var card = el('div', 'lp-price');
    card.appendChild(el('span', 'lp-price__label', t('landing.pricingUnit')));
    card.appendChild(el('p', 'lp-price__desc', t('landing.pricingNote')));
    section.appendChild(card);
    return section;
  }

  function buildFinalCta() {
    var band = el('section', 'lp-band');
    band.appendChild(el('h2', 'lp-band__title', t('landing.finalTitle')));
    band.appendChild(el('p', 'lp-band__desc', t('landing.finalDesc')));
    var actions = el('div', 'lp-actions');
    actions.appendChild(linkButton('btn lp-cta lp-cta--onband', t('landing.ctaStart'), 'S2'));
    band.appendChild(actions);
    return band;
  }

  App.registerScreen('S0', {
    render: function (root) {
      clear(root);
      var page = el('div', 'lp');

      page.appendChild(buildHero());

      var steps = buildSection('landing.stepsLabel', 'landing.stepsTitle', 'landing.stepsDesc');
      steps.appendChild(buildCards(STEPS, 'lp-grid--steps'));
      page.appendChild(steps);

      var features = buildSection('landing.featuresLabel', 'landing.featuresTitle', 'landing.featuresDesc');
      features.appendChild(buildCards(FEATURES));
      page.appendChild(features);

      page.appendChild(buildPricing());
      page.appendChild(buildFinalCta());

      root.appendChild(page);
    }
  });

}(window, document));
