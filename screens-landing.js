/* ============================================================
 * エルピーヤ — screens-landing.js
 * S0 ログイン前ホーム（アプリ紹介）だけを描く。
 *
 * ttalkkak-ai.com のトップページと同じ組み立て:
 *   左寄せヒーロー（右に映像）→ 掲載先ロゴ → 3ステップ → できること → 料金 → 最終CTA
 *   節ごとに組み方を変えてある（同じ型のカード列を二度並べない）。
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
  /* 動画の1コマ目を静止画で持っておく（2026-10-30 指摘「開いてすぐは動画が
     全然見えない」）。動画は JS が作るので、取りに行き始めるのが遅い。
     index.html が head から先に読み、poster として即座に出す。
     動画が追いついたら、そのまま同じ絵から動き出す */
  var HERO_POSTER = 'hero-bg.jpg';

  /* ヒーロー直下に出す掲載先。ロゴの実体は platform-logos.js（assets/platform から生成）。
     国内4つのあとに海外・韓国を続ける。ロゴが無いものは buildProof が黙って飛ばすので、
     素材が揃っていない行をここに書いても画面は壊れない。
     商品入力のKVプリセットと URL の言語判定も同じ顔ぶれ（screens-home.js） */
  var PLATFORMS = [
    { id: 'makuake', name: 'Makuake' },
    { id: 'campfire', name: 'CAMPFIRE' },
    { id: 'greenfunding', name: 'GREENFUNDING' },
    { id: 'machiya', name: 'Machi-ya' },
    { id: 'kickstarter', name: 'Kickstarter' },
    { id: 'indiegogo', name: 'Indiegogo' },
    { id: 'wadiz', name: 'Wadiz' }
  ];

  /* 外注との比較。左が外注、右がエルピーヤ。行は3つだけに絞る
     （費用・納期・何をもとに作るか）。増やすと表になって読まれなくなる */
  var COMPARE = [
    { row: 'compare.rowCost', old: 'compare.oldCost', now: 'compare.newCost', big: true },
    { row: 'compare.rowTime', old: 'compare.oldTime', now: 'compare.newTime', big: true },
    { row: 'compare.rowHow', old: 'compare.oldHow', now: 'compare.newHow' }
  ];

  /* 比較の下に置く絵。ブラウザのChatGPTで作って lp-ya/assets/ に置いたもの */
  /* 比較の帯の上に出す2枚（2026-10-30 要望）。金額の差より先に、
     気持ちの差を見せる。左＝外注を待っているとき、右＝エルピーヤのあと */
  var COMPARE_FACES = [
    { src: 'assets/compare-before.jpg', cap: 'compare.beforeCap', alt: 'compare.beforeAlt' },
    { src: 'assets/compare-after.jpg', cap: 'compare.afterCap', alt: 'compare.afterAlt', now: true }
  ];

  var STEPS = ['landing.step1', 'landing.step2', 'landing.step3'];

  /* 先頭2つが大きい区画。6件ちょうどで埋まる組み方にしてある */
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

  /* \n で改行して入れる（文言側に改行を持たせたいところ用） */
  function lines(node, text) {
    String(text).split('\n').forEach(function (line, index) {
      if (index > 0) { node.appendChild(el('br')); }
      node.appendChild(document.createTextNode(line));
    });
    return node;
  }

  /* 金額だけ色を変えて入れる（2026-10-30 指摘「30万円・15万円を赤の太字に」）。
     辞書に綴りを入れず、数字＋万円／円 の形をその場で拾う。
     こうしておけば、相場を書き換えても印の付け直しが要らない。
     innerHTML は使わない（辞書の文をそのまま差し込む口を作らない） */
  var MONEY = /([0-9][0-9,]*(?:万)?円)/;
  function money(node, text) {
    String(text).split('\n').forEach(function (line, index) {
      if (index > 0) { node.appendChild(el('br')); }
      line.split(MONEY).forEach(function (part, i) {
        if (!part) { return; }
        /* split に丸括弧を使っているので、奇数番が金額そのもの */
        if (i % 2 === 1) {
          node.appendChild(el('span', 'lp-vs__yen', part));
        } else {
          node.appendChild(document.createTextNode(part));
        }
      });
    });
    return node;
  }

  /* 見出しの「、」で改行させる（2行ヘッドライン） */
  function headline(text) {
    var node = el('h1', 'lp-hero__title');
    String(text).split('\n').forEach(function (line, index) {
      if (index > 0) { node.appendChild(el('br')); }
      node.appendChild(document.createTextNode(line));
    });
    return node;
  }

  /* --- ヒーロー：文字は左、映像の右半分は隠さない --- */
  function buildHero() {
    var hero = el('section', 'lp-hero');

    var video = document.createElement('video');
    video.className = 'lp-hero__video';
    video.src = HERO_VIDEO;
    /* 1コマ目を先に出す。index.html が head で先読みしてあるので、
       ここに着いた時点ではもう手元にある */
    video.poster = HERO_POSTER;
    video.preload = 'auto';
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

    hero.appendChild(inner);
    return hero;
  }

  /* --- 掲載先ロゴ。ロゴが1枚も無い環境では帯ごと出さない --- */
  function buildProof() {
    var logos = window.LPYA_PLATFORM_LOGOS || {};
    var strip = el('section', 'lp-proof');
    var row = el('div', 'lp-proof__row');
    var found = 0;

    PLATFORMS.forEach(function (platform) {
      var logo = logos[platform.id];
      if (!logo || !logo.src) { return; }
      var img = el('img', 'lp-proof__logo');
      img.src = logo.src;
      img.alt = platform.name;
      /* 大きさの光学補正をCSS側でやるため、どの社かを持たせる。
         色を変える加工は各社の条件で禁じられているので、できるのは大きさだけ */
      img.setAttribute('data-platform', platform.id);
      img.loading = 'lazy';
      img.decoding = 'async';
      row.appendChild(img);
      found += 1;
    });

    if (!found) { return null; }

    strip.appendChild(el('span', 'lp-proof__label', t('landing.platforms')));
    strip.appendChild(row);
    strip.appendChild(el('p', 'lp-proof__note', t('landing.ctaNote')));
    return strip;
  }

  function buildSection(titleKey, descKey, extraClass) {
    var section = el('section', 'lp-section' + (extraClass ? ' ' + extraClass : ''));
    section.appendChild(el('h2', 'lp-section__title', t(titleKey)));
    if (descKey) { section.appendChild(el('p', 'lp-section__desc', t(descKey))); }
    return section;
  }

  /* --- 外注との比較：左右2列。右（エルピーヤ）だけ地を変えて立たせる --- */
  function buildCompare() {
    var section = buildSection('compare.title', 'compare.desc');

    /* 並びは「表 → 写真」（2026-10-30 指摘）。数字で違いを示してから、
       その違いが暮らしにどう出るかを写真で見せる。
       写真は表の続きとして見えるよう、隙間をあけずに下に貼り付ける。
       読み込めない環境では黙って消す（帯ごと崩さない） */
    var faces = el('div', 'lp-faces');
    COMPARE_FACES.forEach(function (one) {
      var fig = el('figure', 'lp-face' + (one.now ? ' lp-face--now' : ''));
      var img = el('img', 'lp-face__img');
      img.src = one.src;
      img.alt = t(one.alt);
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', function () { fig.remove(); });
      fig.appendChild(img);
      fig.appendChild(el('figcaption', 'lp-face__cap', t(one.cap)));
      faces.appendChild(fig);
    });

    var table = el('div', 'lp-vs');

    var head = el('div', 'lp-vs__head');
    head.appendChild(el('span', 'lp-vs__corner', ''));
    head.appendChild(el('span', 'lp-vs__col', t('compare.colOld')));
    head.appendChild(el('span', 'lp-vs__col lp-vs__col--now', t('compare.colNew')));
    table.appendChild(head);

    COMPARE.forEach(function (one) {
      var row = el('div', 'lp-vs__row');
      row.appendChild(el('span', 'lp-vs__key', t(one.row)));
      var oldCell = row.appendChild(el('span', 'lp-vs__old'));
      /* 狭い画面では見出しの行を消すので、どちらの話かを各セルに持たせる */
      oldCell.setAttribute('data-label', t('compare.colOld'));
      /* 外注側の金額は赤の太字にする。いちばん効くのは「いくら浮くか」 */
      money(oldCell, t(one.old));
      var nowCell = row.appendChild(el('span', 'lp-vs__now' + (one.big ? ' lp-vs__now--big' : '')));
      nowCell.setAttribute('data-label', t('compare.colNew'));
      lines(nowCell, t(one.now));
      table.appendChild(row);
    });

    /* 表と写真は1枚の板として扱う。別々に節へ入れていたため、
       節の gap（10px）があいだに入って線が切れていた（2026-10-30 指摘）。
       包みを1つにすれば、gap は包みの外側にだけ効く */
    var board = el('div', 'lp-vs-board');
    board.appendChild(table);
    board.appendChild(faces);
    section.appendChild(board);
    section.appendChild(el('p', 'lp-vs__note', t('compare.note')));

    return section;
  }

  /* --- 使い方：カードで囲わず、縦罫と大きな番号だけで3つに分ける --- */
  function buildSteps() {
    var section = buildSection('landing.stepsTitle', 'landing.stepsDesc', 'lp-section--left');
    var flow = el('ol', 'lp-flow');

    STEPS.forEach(function (key, index) {
      var item = el('li', 'lp-flow__item');
      item.appendChild(el('span', 'lp-flow__num', String(index + 1)));
      item.appendChild(el('h3', 'lp-flow__title', t(key)));
      item.appendChild(el('p', 'lp-flow__desc', t(key + 'Desc')));
      flow.appendChild(item);
    });

    section.appendChild(flow);
    return section;
  }

  /* --- できること：先頭2件を大きく、残り4件を小さく。6件ちょうどで隙間が出ない --- */
  function buildFeatures() {
    var section = buildSection('landing.featuresTitle', 'landing.featuresDesc', 'lp-section--left');
    var grid = el('div', 'lp-bento');

    FEATURES.forEach(function (key, index) {
      var cell = el('article', 'lp-bento__cell' + (index < 2 ? ' lp-bento__cell--lead' : ''));
      cell.appendChild(el('h3', 'lp-bento__title', t(key)));
      cell.appendChild(el('p', 'lp-bento__desc', t(key + 'Desc')));
      grid.appendChild(cell);
    });

    section.appendChild(grid);
    return section;
  }

  /* --- 料金：払い方だけを言う。金額は出さない（2026-10-30 利用者の決め）。
         必要ポイントは管理画面でいつでも変わるうえ（アプリ内はDBから取っている）、
         1ポイントが何円かも管理画面の設定なので、ここに「60P」とだけ置いても
         はじめて来た人には金額が分からない。直書きは古くなるだけだった --- */
  function buildPricing() {
    return buildSection('landing.pricingTitle', 'landing.pricingDesc');
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

      var proof = buildProof();
      if (proof) { page.appendChild(proof); }

      page.appendChild(buildCompare());
      page.appendChild(buildSteps());
      page.appendChild(buildFeatures());
      page.appendChild(buildPricing());
      page.appendChild(buildFinalCta());

      root.appendChild(page);
    }
  });

}(window, document));
