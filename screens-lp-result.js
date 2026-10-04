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
    'lpr.mode': ['区画の見せ方', 'How each section shows', '구획 표현 방식'],
    'lpr.modeHint': ['区画ごとに、絵で見せるか文字で読ませるかを選べます。生成のときに両方できています。',
      'Pick per section: show the visual, or read it as text. Both were generated.',
      '구획마다 이미지로 볼지 텍스트로 읽을지 고를 수 있습니다. 생성 시 둘 다 만들어져 있습니다.'],
    'lpr.modeImage': ['絵', 'Visual', '이미지'],
    'lpr.modeText': ['文字', 'Text', '텍스트'],
    'lpr.modeBoth': ['絵＋文字', 'Visual + text', '이미지＋텍스트'],
    'lpr.modeCount': ['{n}区画', '{n} sections', '{n}개 구획'],
    'lpr.viewSales': ['販売ページ', 'Sales page', '판매 페이지'],
    'lpr.viewCanvas': ['区画そのまま', 'Sections only', '구획 그대로'],
    'lpr.viewHint': ['販売ページは、公開したときに見える形です（LINE友だち追加もここに出ます）。'
      + '区画そのままは、作った絵と文字だけを縦に並べたものです。',
      'The sales page is what visitors see once published (including the LINE button).',
      '판매 페이지는 공개 시 보이는 형태입니다.'],
    'lpr.noSales': ['販売ページの文章がまだありません。生成プロンプトの画面で「販売ページの文章をAIに書かせる」を押してください',
      'No sales copy yet. Write it on the prompts screen.', '판매 문구가 없습니다'],
    'lpr.modeAll': ['すべての区画を', 'All sections', '모든 구획을'],
    'lpr.modeNoText': ['文字版なし', 'No text version', '텍스트 버전 없음'],
    'lpr.modeNoImage': ['絵は未生成', 'Visual not generated', '이미지 미생성'],
    'lpr.live': ['公開中', 'Live', '공개 중'],
    'lpr.take': ['使う案', 'Version', '사용할 안'],
    'lpr.takeNo': ['{n}回目', 'Take {n}', '{n}회차'],
    'lpr.takeHint': ['この層は {n} 回作っています。選ぶと、そのときの絵と文字で組み直します。',
      'This audience has {n} takes. Picking one rebuilds the page from that take.',
      '이 층은 {n}회 생성했습니다.'],
    'lpr.shots': ['この区画の絵', 'Visuals for this section', '이 구획의 이미지'],
    'lpr.shelf': ['区画ごとの写真', 'Photos by section', '구획별 사진'],
    'lpr.shelfHint': ['写真が複数ある区画は {n} 件です。選ぶと、その場でページに入れ替わります。',
      '{n} sections have more than one photo. Pick one and the page updates right away.',
      '사진이 여러 장인 구획은 {n}건입니다.'],
    'lpr.shelfNone': ['作り直した写真がまだありません。', 'No regenerated photos yet.', '아직 다시 만든 사진이 없습니다.'],
    'lpr.pickUnused': ['この区画は販売ページでは使っていません（区画そのままには出ます）',
      'Not used by the sales page (shown in the plain lineup)',
      '판매 페이지에서는 사용하지 않습니다'],
    'lpr.shelfOne': ['残り {n} 区画は写真が1枚なので、そのまま使います。',
      'The other {n} sections have a single photo and use it automatically.',
      '나머지 {n} 구획은 사진이 1장이라 그대로 사용합니다.'],
    'lpr.shotNow': ['いま使っている絵', 'In use', '사용 중'],
    'lpr.shotUse': ['これを使う', 'Use this', '이것을 사용'],
    'lpr.shotOne': ['作り直していないので、選べる絵は1枚だけです',
      'Only one visual so far', '아직 1장뿐입니다'],
    'lpr.publicUrl': ['公開URL', 'Public URL', '공개 URL'],
    'lpr.history': ['過去の版', 'Past versions', '이전 버전'],
    'lpr.latest': ['最新', 'Latest', '최신'],
    'lpr.viewing': ['過去の版を見ています（{at}）。最新に戻すには「最新」を選んでください。',
      'Viewing a past version ({at}). Pick "Latest" to return.',
      '이전 버전을 보고 있습니다({at}). 최신으로 돌아가려면 "최신"을 고르세요.'],
    'lpr.restore': ['この版を最新にする', 'Make this the latest', '이 버전을 최신으로'],
    'lpr.restored': ['この版を最新にしました', 'Made this the latest', '이 버전을 최신으로 했습니다']
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
  function escapeHtml(text) {
    return String(text === undefined || text === null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

  /* #RRGGBB の明るさ（0=黒, 1=白）。人の目の感じ方に合わせて重みを付ける */
  /* 設計値の決まりは lp-render.js に1本化した（公開も同じ値で組むため） */
  function designFromProject(project) {
    return window.LpRender && LpRender.designFromProject
      ? LpRender.designFromProject(project)
      : { titleFont: 'gothic', bodyFont: 'gothic', titleSize: 30, bodySize: 16,
          titleColor: '#171018', bodyColor: '#3A323E', bgColor: '#FFFFFF', accentColor: '#C13584' };
  }


  App.registerScreen('S13', {
    render: function (root, params) {
      params = params || {};
      var projectId = params.id || (window.Api && Api.storage && Api.storage.get('projectId')) || '';
      setHeader(t('lpr.title'));
      clear(root);
      if (!projectId) { add(root, el('p', 'empty', t('lpr.noProject'))); return; }

      var view = { project: null, gen: null, html: '', busy: false, mode: {}, siblings: [], modesOpen: false, kvUrls: [], preview: '', takes: {}, takePick: {}, spots: [], atSlot: '' };
      var screen = el('div', 'screen');
      var head = el('header', 'screen__head');
      add(head, el('h2', 'screen__title', t('lpr.title')));
      add(head, el('p', 'screen__lead', t('lpr.lead')));
      add(screen, head);
      /* 層の耳。生成プロンプトの画面と同じ並びにして、行き来しても迷わない */
      var tabsBar = el('div', 'lp-tabs');
      add(screen, tabsBar);
      var toolbar = el('div', 'lp-toolbar');
      add(screen, toolbar);
      var stats = el('p', 't-note lpr-stats');
      add(screen, stats);
      var modes = el('div', 'lpr-modes');
      add(screen, modes);
      /* LPの下見と、その右の棚を横に並べる。
         棚には区画ごとの過去の写真を出し、押すとその場で入れ替わる
         （2026-10-05 要望: 右にサイドメニューとして出す）。
         狭い画面では棚が下に回る */
      var stage = el('div', 'lpr-stage');
      var shelf = el('aside', 'lpr-shelf');
      var frameWrap = el('div', 'lpr-frame');
      var frame = el('iframe', 'lpr-frame__iframe');
      frame.setAttribute('title', t('lpr.title'));
      /* 中の JS を動かす。KV のスライドもメールの登録も、ページの中の
         小さな JS で動いている。allow-scripts が無いと一切動かず、
         「矢印を押しても左右に動かない」になる（実測 2026-10-04）。
         allow-same-origin と併せると枠の外にも触れてしまうので、
         ここは同じ生い立ちを外して「別の生い立ち」で動かす。
         高さの測りは、読み込み後に中から教えてもらう（下の measure）*/
      frame.setAttribute('sandbox', 'allow-scripts');
      add(frameWrap, frame);
      add(stage, frameWrap);
      add(stage, shelf);
      add(screen, stage);
      add(root, screen);

      /* 指定が無ければ、生成プロンプト（lp_brief）の最新を出す。無ければ従来の LP案 */
      /* スクロールを見張る。描き直しのたびに付け外しすると漏れるので、
         画面を作るときに1回だけ繋ぐ */
      window.addEventListener('scroll', followScroll, { passive: true });
      window.addEventListener('resize', followScroll, { passive: true });

      var genQuery = params.gen
        ? Api.generations.get(params.gen)
        : Api.generations.first({ eq: { projects_id: projectId, feature_key: 'lp_brief' }, order: 'created_at.desc' })
          .then(function (row) {
            return row || Api.generations.first({ eq: { projects_id: projectId, feature_key: FEATURE }, order: 'created_at.desc' });
          });
      Promise.all([Api.projects.get(projectId), genQuery]).then(function (got) {
        view.project = got[0];
        view.gen = got[1];
        if (!view.gen) { add(root, el('p', 'empty', t('lpr.noGen'))); return; }
        /* 同じ回の、他の層も読む。生成結果も層ごとに見られるようにする
           （2026-10-04 要望）。絵と文字は層ごとに別なので、
           1つしか見られないと他の層を確かめられなかった */
        loadSiblings();
        loadKv();
        view.html = String(view.gen.generated_html || '');
        view.mode = (view.gen.asset_prompts && typeof view.gen.asset_prompts.mode === 'object'
          && view.gen.asset_prompts.mode) || {};
        view.history = Array.isArray(view.gen.html_history) ? view.gen.html_history : [];
        view.at = -1;   /* -1 = 最新、0〜 = 履歴の番号 */
        /* S12 の「このLP案でLPを作る」から来たときは必ず組み直す。
           前は generated_html があれば古いものを出していて、LP案を直しても
           生成結果が変わらなかった（実測）。前の版は履歴に積んでおく */
        if (params.build === '1' || !view.html) { build(!!view.gen.generated_html || params.build === '1'); }
        paint();
      }).catch(function (err) {
        console.error('[screens-lp-result] 読み込みに失敗:', err);
        add(root, el('p', 'empty', String(err && err.message || err)));
      });

      /* 区画の見せ方。asset_prompts.mode に { '3': 'text' } の形で持つ。
         列を増やさずに済み、made / redoSlots と同じ入れ物に収まる。
         既定は「絵」。ただし絵がまだ無くて文字版があるなら文字で出す
         （空の「未生成」が並ぶより、読める形になっているほうがよい） */
      /* その区画の絵。動く絵（GIF・動画）があればそちらを使う */
      function visualOf(sec) {
        var bag = (view.gen.asset_prompts && typeof view.gen.asset_prompts === 'object')
          ? view.gen.asset_prompts : {};
        var slot = String(sec.index) + '-1';
        var mov = bag.motion && bag.motion[slot];
        var still = bag.made && bag.made[slot];
        return mov || still || '';
      }

      /* その区画で選べる絵。いま使っているもの＋作り直して押し出された履歴。
         履歴は asset-ingest が作り直しのたびに最大10件ためている
         （2026-10-05 要望: 複数の生成物からどれを使うか選びたい） */
      function shotsOf(sec) {
        var bag = (view.gen.asset_prompts && typeof view.gen.asset_prompts === 'object')
          ? view.gen.asset_prompts : {};
        var slot = String(sec.index) + '-1';
        var out = [];
        var seen = {};
        var push = function (url, at) {
          var u = String(url || '');
          if (!u || seen[u]) { return; }
          seen[u] = 1;
          out.push({ url: u, at: at || '' });
        };
        /* 動く絵は静止画と置き場が別。どちらも同じ区画の候補として並べる */
        push(bag.motion && bag.motion[slot]);
        push(bag.made && bag.made[slot]);
        [['motionHistory', 1], ['history', 1]].forEach(function (pair) {
          var h = bag[pair[0]] && bag[pair[0]][slot];
          (Array.isArray(h) ? h : []).forEach(function (one) { push(one && one.url, one && one.at); });
        });
        return out;
      }

      /* 選んだ絵を、その区画の「いま使う絵」にする。
         捨てずに入れ替える: 今まで使っていたものは履歴の先頭へ戻すので、
         選び直せば元に戻せる */
      function useShot(sec, url) {
        var bag = (view.gen.asset_prompts && typeof view.gen.asset_prompts === 'object')
          ? view.gen.asset_prompts : {};
        var slot = String(sec.index) + '-1';
        var motion = /\.(gif|mp4|webm|mov)(\?|$)/i.test(String(url));
        var key = motion ? 'motion' : 'made';
        var hk = motion ? 'motionHistory' : 'history';
        var now = Object.assign({}, bag[key] || {});
        var hist = Object.assign({}, bag[hk] || {});
        var prev = now[slot];
        if (prev === url) { return; }
        var rest = (Array.isArray(hist[slot]) ? hist[slot] : [])
          .filter(function (one) { return one && one.url !== url; });
        if (prev) { rest = [{ url: prev, at: new Date().toISOString() }].concat(rest); }
        hist[slot] = rest.slice(0, 10);
        now[slot] = url;
        bag[key] = now;
        bag[hk] = hist;
        view.gen.asset_prompts = bag;
        build(false);
        paint();
        /* 保存は待たない。見た目はもう変わっているし、選び直せる */
        Api.generations.update(view.gen.id, { asset_prompts: bag }).catch(function (err) {
          console.error('[screens-lp-result] 絵の選び直しを保存できません:', err);
        });
      }

      /* 動画は <video>、それ以外は <img>。S12 の見せ方に合わせる */
      function mediaTag(url, slot) {
        var u = String(url);
        var tag = slot ? ' data-slot="' + escapeHtml(String(slot)) + '"' : '';
        if (/\.(mp4|webm|mov)(\?|$)/i.test(u)) {
          return '<video src="' + escapeHtml(u) + '" autoplay loop muted playsinline preload="metadata"'
            + tag + '></video>';
        }
        return '<img src="' + escapeHtml(u) + '" alt="" loading="lazy"' + tag + '>';
      }

      function modeOf(sec, url) {
        var picked = view.mode[String(sec.index)];
        if (picked === 'text' || picked === 'both' || picked === 'image') { return picked; }
        return (!url && sec.text) ? 'text' : 'image';
      }

      /* 文字版の組み方。
         これまでは「1行目が見出し、残りは全部 p」だけで、どの行も同じ大きさに
         見えていた（2026-10-04 指摘）。読む人が目で追えるよう、段をつける:
           1行目          大見出し（h2）
           短くて句点の無い行  小見出し（h3）
           「…：…」の行    言葉と説明の組（dl）
           「・」「-」で始まる行 箇条書き
           それ以外        本文（p）
         強調の書き方も読む:
           **太字**  __下線__  ==マーカー==  [[差し色]]
         区画の文はAIが書くので、書き方を決めておけば使い分けられる */
      function inline(text) {
        var out = escapeHtml(String(text || ''));
        out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        out = out.replace(/__([^_]+)__/g, '<u>$1</u>');
        out = out.replace(/==([^=]+)==/g, '<mark>$1</mark>');
        out = out.replace(/\[\[([^\]]+)\]\]/g, '<em class="accent">$1</em>');
        return out;
      }

      function textBlock(sec) {
        var lines = String(sec.text || '').split('\n').map(function (s) { return s.trim(); })
          .filter(function (s) { return s; });
        if (!lines.length) { return ''; }
        var out = ['<h2>' + inline(lines[0]) + '</h2>'];
        var list = [];
        function flush() {
          if (!list.length) { return; }
          out.push('<ul>' + list.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</ul>');
          list = [];
        }
        lines.slice(1).forEach(function (raw) {
          var bullet = /^[・\-—–]\s*(.+)$/.exec(raw);
          if (bullet) { list.push(bullet[1]); return; }
          flush();
          var pair = /^(.{1,14})[：:]\s*(.+)$/.exec(raw);
          if (pair) {
            out.push('<dl><dt>' + inline(pair[1]) + '</dt><dd>' + inline(pair[2]) + '</dd></dl>');
            return;
          }
          /* 短くて句点で終わらない行は、小見出しとして扱う */
          if (raw.length <= 22 && !/[。．.!！?？]$/.test(raw)) {
            out.push('<h3>' + inline(raw) + '</h3>');
            return;
          }
          out.push('<p>' + inline(raw) + '</p>');
        });
        flush();
        return out.join('');
      }

      function setMode(index, value) {
        if (index === '*') {
          (view.gen.sections || []).forEach(function (sec) { view.mode[String(sec.index)] = value; });
        } else {
          view.mode[String(index)] = value;
        }
        var bag = (view.gen.asset_prompts && typeof view.gen.asset_prompts === 'object')
          ? view.gen.asset_prompts : {};
        bag.mode = view.mode;
        view.gen.asset_prompts = bag;
        /* 販売ページは AI の文章で組むので、区画の見せ方を使わない。
           そのまま組み直しても見た目が変わらず「反映されていない」に見える
           （2026-10-05 指摘）。変えた結果がその場で見えるよう、
           区画そのままへ切り替える */
        if (previewKind() === 'sales') { view.preview = 'canvas'; }
        build(false);
        paint();
        /* 保存は待たない。見た目はもう変わっているし、失敗しても選び直せる */
        Api.generations.update(view.gen.id, { asset_prompts: bag }).catch(function (err) {
          console.error('[screens-lp-result] 見せ方の保存に失敗:', err);
        });
      }

      /* 販売ページの文章があるか */
      function hasSales() {
        return !!(view.gen && view.gen.content && view.gen.content.sales);
      }

      /* いま出す形。販売ページの文章があれば、既定はそちら。
         公開したときに見えるものを、そのまま見せる
         （2026-10-04 指摘: LINE登録のところが見えない。
         公開ページにしか出ず、生成結果では確かめられなかった） */
      function previewKind() {
        if (view.preview === 'canvas') { return 'canvas'; }
        if (view.preview === 'sales' && hasSales()) { return 'sales'; }
        return hasSales() ? 'sales' : 'canvas';
      }

      /* 販売ページを組む。中身は公開のときと同じ道具・同じ値を使う */
      function buildSales() {
        var project = view.project || {};
        var info = (project.sales_info && typeof project.sales_info === 'object') ? project.sales_info : {};
        var mode = String(project.lead_mode || 'line');
        var prompts = (view.gen.asset_prompts && typeof view.gen.asset_prompts === 'object')
          ? view.gen.asset_prompts : {};
        var slug = String(view.gen.public_url_slug
          || ((project.shop_slug || '') + '/' + String(view.gen.variant_label || '-').toLowerCase()));
        return LpRender.buildSalesHtml({
          sales: view.gen.content.sales,
          assets: (prompts.made && typeof prompts.made === 'object') ? prompts.made : {},
          design: designFromProject(project),
          title: project.product_name || project.name || '',
          /* 掲載先（Makuake など）。ロゴのURLを入れていればそちらを出す */
          platform: String(project.cf_platform || ''),
          platformLogo: String(info.platform_logo || ''),
          /* 誘いの塊の2行目・3行目。売る人が入れた事実をそのまま出す */
          saleStart: String(info.sale_start || ''),
          discount: String(info.discount || ''),
          lineUrl: (mode !== 'mail') ? String(project.line_url || '') : '',
          kv: info.kv_first ? (view.kvUrls || []) : [],
          mail: (mode === 'mail' || mode === 'both') ? {
            url: Api.URL, key: Api.ANON_KEY, slug: slug,
            note: (window.LpRender && LpRender.mailNote) || ''
          } : null
        });
      }

      function build(save) {
        if (!window.LpRender || typeof LpRender.buildDraftHtml !== 'function') {
          console.error('[screens-lp-result] LpRender.buildDraftHtml がありません。lp-render.js を確認してください。');
          return;
        }
        if (previewKind() === 'sales' && typeof LpRender.buildSalesHtml === 'function') {
          var made = buildSales();
          if (made) {
            view.html = made;
            if (save) { saveHtml(); }
            return;
          }
        }
        /* 生成プロンプト（lp_brief）は、区画を縦に並べるだけ（キャンバス）。
           区画ごとに「絵」「文字」「絵＋文字」を選べる。同じ区画の絵版と文字版は
           生成のときに両方できているので、ここでは選んで並べるだけ */
        if (view.gen.feature_key === 'lp_brief') {
          var parts = (view.gen.sections || []).map(function (sec) {
            /* 動く絵があれば、その区画の絵はそちら。
               止まった絵と2つ並べると同じ場面が続いてくどい
               （2026-10-05 要望: 絵とGIFだけを並べたい） */
            var url = visualOf(sec);
            var mode = modeOf(sec, url);
            var cap = sec.body ? '<p class="cap">' + escapeHtml(String(sec.body)) + '</p>' : '';
            var img = url ? mediaTag(url, String(sec.index) + '-1') : '';
            var txt = sec.text ? textBlock(sec) : '';
            /* 選んだとおりに出す。
               「絵」を選んだのに本文（cap）を足していたので、絵だけにしたはずの
               区画に文字が残っていた（2026-10-04 指摘）。
                 絵      … 絵だけ。文字は一切出さない
                 文字    … 文字だけ
                 絵＋文字 … 両方 */
            if (mode === 'image') {
              return img
                ? '<section>' + img + '</section>'
                : '<section class="todo"><p>' + escapeHtml(String(sec.title || ('区画 ' + sec.index))) + '（絵が未生成）</p></section>';
            }
            if (mode === 'text') {
              return (txt || cap)
                ? '<section class="txt">' + txt + cap + '</section>'
                : '<section class="todo"><p>' + escapeHtml(String(sec.title || ('区画 ' + sec.index))) + '（文字がありません）</p></section>';
            }
            if (mode === 'both' && (img || txt || cap)) { return '<section>' + img + txt + cap + '</section>'; }
            return '<section class="todo"><p>' + escapeHtml(String(sec.title || ('区画 ' + sec.index))) + '（未生成）</p></section>';
          });
          /* 差し色はブランド指定から。無ければ既定。
             下線とマーカーは同じ色を薄くして使う（色を増やすとうるさい） */
          /* KVから始めるか。設定は販売の条件と同じ入れ物（sales_info）にある */
          var wantKv = !!(view.project && view.project.sales_info
            && view.project.sales_info.kv_first && view.kvUrls && view.kvUrls.length
            && window.LpRender && LpRender.kvSliderMarkup);
          var dez = designFromProject(view.project);
          var accent = String(dez.accentColor || '#C13584');
          var weak = accent + '33';
          view.html = '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            + '<title>' + escapeHtml(view.project.product_name || view.project.name || '') + '</title>'
            /* スマホでは画面いっぱい。広い画面でだけ、読みやすい幅に収める
               （2026-10-04 要望: 画面に満ちるように） */
            + '<style>*{box-sizing:border-box}html,body{width:100%;overflow-x:hidden}'
            + 'body{margin:0;background:#fff}main{max-width:100%;margin:0 auto}'
            /* 本文の幅は1000px。生成する絵が1024幅なので等倍で出せる
               （実物の販売ページも本文の絵がすべて width=1000 だった） */
            + '@media (min-width:768px){main{max-width:1000px}}'
            + 'section{margin:0}img{display:block;width:100%;height:auto}'
            + '.todo{padding:28px 24px;border:1px dashed #D9CFE0;color:#6B6270;font:14px/1.6 system-ui;text-align:center}'
            /* 文字の段。見出し・小見出し・本文・箇条書き・言葉と説明で、
               大きさと色を変える。全部同じ見た目だと目で追えない */
            + '.txt{padding:34px 24px 30px;font-family:-apple-system,\'Hiragino Sans\',\'Yu Gothic UI\',sans-serif}'
            + '.txt h2{margin:0 0 14px;font:700 26px/1.45;color:#171018;letter-spacing:.01em}'
            + '.txt h3{margin:22px 0 8px;font:700 18px/1.6;color:#171018;padding-left:12px;border-left:4px solid ' + accent + '}'
            + '.txt p{margin:0 0 12px;font:16px/1.95;color:#3A323E}'
            + '.txt ul{margin:0 0 14px;padding-left:1.2em}'
            + '.txt li{margin:4px 0;font:16px/1.9;color:#3A323E}'
            + '.txt dl{display:flex;gap:10px;margin:0 0 8px;font:15px/1.8}'
            + '.txt dt{flex:0 0 7.5em;font-weight:700;color:#171018}'
            + '.txt dd{flex:1 1 auto;margin:0;color:#3A323E}'
            + '.txt strong{font-weight:700;color:#171018}'
            + '.txt u{text-decoration:none;background:linear-gradient(transparent 62%,' + weak + ' 62%)}'
            + '.txt mark{background:' + weak + ';color:inherit;padding:0 2px;border-radius:2px}'
            + '.txt .accent{font-style:normal;font-weight:700;color:' + accent + '}'
            + '.cap{margin:0;padding:14px 24px 22px;font:15px/1.85 -apple-system,\'Hiragino Sans\',\'Yu Gothic UI\',sans-serif;color:#3A323E;white-space:pre-wrap}'
            /* 「ページの最初をKVから始める」を入れていたら、ここでも同じように出す。
               これまで公開ページだけに効いていて、生成結果で確かめられなかった
               （2026-10-04 指摘）。見えているものと公開するものを揃える */
            + (wantKv ? LpRender.kvSliderCss() : '')
            + '</style></head><body>'
            + (wantKv ? LpRender.kvSliderMarkup(view.kvUrls, view.project.product_name || '') : '')
            + '<main>'
            + parts.join('') + '</main>'
            + (wantKv && view.kvUrls.length > 1 ? '<script>' + LpRender.kvSliderJs() + '<\/script>' : '')
            /* 高さは中から知らせてもらう（枠の中で JS を動かすため、
               親からは中の document に触れない） */
            + (LpRender.frameReportJs ? '<script>' + LpRender.frameReportJs() + '<\/script>' : '')
            + '</body></html>';
          if (save) { saveHtml(); }
          return;
        }
        var draft = { summary: view.gen.content && view.gen.content.summary, sections: view.gen.sections };
        /* 生成し終えた絵・動画を区画に差す。asset_prompts.made は
           { '3-2': 'https://…' } の形で、lp-render の assets と同じ並び。
           渡し忘れると、せっかく作った素材が本文に出ない */
        var prompts = view.gen.asset_prompts && typeof view.gen.asset_prompts === 'object' ? view.gen.asset_prompts : {};
        view.html = LpRender.buildDraftHtml({
          draft: draft,
          project: view.project,
          design: designFromProject(view.project),
          /* LP は全区画とも静止画で組む。動く絵（motion）はここでは混ぜない。
             一度は「動く絵があればそちらを使う」にしていたが、そうすると
             区画の絵が入れ替わってしまう。GIF は別の成果物として扱い、
             使うかどうかは人が決める */
          assets: prompts.made && typeof prompts.made === 'object' ? prompts.made : {},
          /* 外国語が焼かれていて作り直す区画は、元の写真を使わず空けておく */
          redoSlots: (Array.isArray(prompts.redoSlots) ? prompts.redoSlots : [])
            .filter(function (slot) { return !(prompts.made && prompts.made[slot]); }),
          /* 訴求が絵そのものに焼かれている区画。文字を重ねると二重になる */
          burnedSlots: (Array.isArray(prompts.burnedSlots) ? prompts.burnedSlots : [])
            .filter(function (slot) { return prompts.made && prompts.made[slot]; }),
          title: view.project.product_name || view.project.name || ''
        });
        if (save) { saveHtml(); }
      }

      /* 同じ回（batch）の、同じ種類の層をぜんぶ持っておく。
         重いのは generated_html と sections なので、一覧では取らない。
         切り替えたときに、その1本だけ取りに行く */
      var LIGHT_COLS = 'id,feature_key,variant_label,title,created_at,'
        + 'published_at,public_url_slug,batch:content->>batch';

      function batchOf(g) {
        if (!g) { return ''; }
        if (g.content && g.content.batch) { return String(g.content.batch); }
        return g.batch ? String(g.batch) : '';
      }

      function loadSiblings() {
        if (!Api.generations || typeof Api.generations.list !== 'function') { return; }
        Api.generations.list({
          eq: { projects_id: projectId, feature_key: view.gen.feature_key },
          select: LIGHT_COLS, order: 'created_at.desc', limit: 200
        }).then(function (rows) {
          var all = Array.isArray(rows) ? rows : [];
          var mine = batchOf(view.gen);
          var same = mine ? all.filter(function (g) { return batchOf(g) === mine; }) : [];
          /* 同じ回で揃わないことがある（古い回には content.batch が無い、
             層を1つだけ作り直した、など）。そのときは種類ごとに
             いちばん新しいものを層ごとに拾う。耳が消えるより出すほうがよい
             （実測 2026-10-04: 耳が1つも出ないと言われた） */
          /* 層ごとの「何回目の案」をぜんぶ覚えておく。古い順に数えて
             1回目・2回目…と呼ぶ（2026-10-05 要望: どの回を使うか選びたい） */
          view.takes = {};
          all.slice().sort(function (a, b) {
            return String(a.created_at || '').localeCompare(String(b.created_at || ''));
          }).forEach(function (g) {
            var L = String(g.variant_label || '-');
            if (!view.takes[L]) { view.takes[L] = []; }
            view.takes[L].push(g);
          });
          var use = same.length >= 2 ? same : newestPerLabel(all);
          view.siblings = use.sort(function (a, b) {
            return String(a.variant_label || '').localeCompare(String(b.variant_label || ''));
          });
          paint();
        }).catch(function (err) {
          console.error('[screens-lp-result] 他の層を読めませんでした:', err);
          view.siblings = [];
          paint();
        });
      }

      /* いま見ている層の KV の絵。ページの最初に並べるのに使う。
         KV は別の生成物（kv_brief）なので、同じ回・同じ層のものを拾う。
         読めたら組み直す（チェックを入れた直後でも反映される） */
      function loadKv() {
        if (!Api.generations || typeof Api.generations.list !== 'function') { return; }
        var label = String(view.gen.variant_label || '-');
        var mine = batchOf(view.gen);
        Api.generations.list({
          eq: { projects_id: projectId, feature_key: 'kv_brief' },
          select: 'id,variant_label,sections,asset_prompts,batch:content->>batch',
          order: 'created_at.desc', limit: 20
        }).then(function (rows) {
          var all = Array.isArray(rows) ? rows : [];
          var kv = all.filter(function (g) {
            return String(g.variant_label || '-') === label && (!mine || batchOf(g) === mine);
          })[0] || all.filter(function (g) {
            return String(g.variant_label || '-') === label;
          })[0];
          var made = (kv && kv.asset_prompts && kv.asset_prompts.made) || {};
          view.kvUrls = ((kv && kv.sections) || [])
            .map(function (sec) { return made[String(sec.index) + '-1']; })
            .filter(Boolean).map(String);
          if (view.kvUrls.length && view.project && view.project.sales_info
            && view.project.sales_info.kv_first) {
            build(false);
            paint();
          }
        }).catch(function (err) {
          console.error('[screens-lp-result] KV を読めませんでした:', err);
        });
      }

      /* 層ごとに、いちばん新しいものを1つずつ。
         並びは created_at の新しい順で来るので、先に出たほうを残す */
      function newestPerLabel(rows) {
        var seen = {};
        var out = [];
        rows.forEach(function (g) {
          var L = String(g.variant_label || '-');
          if (seen[L]) { return; }
          seen[L] = 1;
          out.push(g);
        });
        /* いま見ているものが入っていなければ足す（自分の耳が消えない） */
        if (!out.some(function (g) { return g.id === view.gen.id; })) {
          out.push({ id: view.gen.id, variant_label: view.gen.variant_label,
            title: view.gen.title, published_at: view.gen.published_at });
        }
        return out;
      }

      /* 層を切り替える。中身（HTMLと区画）はそのときに取りに行く */
      function switchVariant(id) {
        if (!id || id === view.gen.id) { return; }
        var hold = view.gen;
        Api.generations.get(id).then(function (row) {
          if (!row) { return; }
          view.gen = row;
          view.html = String(row.generated_html || '');
          view.mode = (row.asset_prompts && typeof row.asset_prompts.mode === 'object'
            && row.asset_prompts.mode) || {};
          view.history = Array.isArray(row.html_history) ? row.html_history : [];
          view.at = -1;
          /* 層が変われば KV も変わる */
          view.kvUrls = [];
          loadKv();
          /* まだ組んでいない層は、その場で組む（空の画面を見せない） */
          if (!view.html) { build(false); }
          paint();
        }).catch(function (err) {
          view.gen = hold;
          console.error('[screens-lp-result] 層を切り替えられませんでした:', err);
          toast(String(err && err.message || err), 'danger');
        });
      }

      /* 層の耳。1層しか無い回では出さない（押せない耳は邪魔） */
      function paintVariants() {
        clear(tabsBar);
        var rows = view.siblings || [];
        /* 層が1つしかなくても、案（何回目）は選べるようにする */
        if (rows.length < 2) { paintTakes(); return; }
        var tabs = el('div', 'lp-delivs lp-delivs--variants');
        rows.forEach(function (g) {
          /* 印は層で合わせる。古い案に切り替えると id が耳と変わるので、
             id で見ていると耳の印が消える（2026-10-05） */
          var on = String(g.variant_label || '-') === String(view.gen.variant_label || '-');
          var b = button('lp-deliv' + (on ? ' lp-deliv--on' : ''), '',
            function () { switchVariant(takeFor(g)); });
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          add(b, el('span', 'lp-variant__label', String(g.variant_label || '-')));
          add(b, el('span', 'lp-variant__name', String(g.title || '').slice(0, 24)));
          if (g.published_at) { add(b, el('span', 'lp-deliv__count', t('lpr.live'))); }
          add(tabs, b);
        });
        add(tabsBar, tabs);
        paintTakes();
      }

      /* その層で開く案。既定は最新（2026-10-05 要望: 最新の案を適用）。
         自分で古い案を選んだ層は、それを覚えておいて戻れるようにする */
      function takeFor(g) {
        var L = String(g.variant_label || '-');
        if (view.takePick && view.takePick[L]) { return view.takePick[L]; }
        var takes = (view.takes && view.takes[L]) || [];
        return takes.length ? takes[takes.length - 1].id : g.id;
      }

      /* いま見ている層の「何回目の案」を選ぶ。
         同じ層を作り直すたびに生成物の行が増えるが、これまでは
         いちばん新しいものしか開けなかった（2026-10-05 要望） */
      function paintTakes() {
        var label = String(view.gen.variant_label || '-');
        var takes = (view.takes && view.takes[label]) || [];
        if (takes.length < 2) { return; }
        var row = el('div', 'lpr-takes');
        add(row, el('span', 't-note', t('lpr.take')));
        var pick = el('select', 'select select--sm');
        takes.forEach(function (g, i) {
          var o = el('option', null, t('lpr.takeNo', { n: i + 1 })
            + '　' + when(g.created_at)
            + (g.published_at ? '　' + t('lpr.live') : ''));
          o.value = g.id;
          add(pick, o);
        });
        pick.value = view.gen.id;
        pick.addEventListener('change', function () {
          if (!view.takePick) { view.takePick = {}; }
          view.takePick[label] = pick.value;
          switchVariant(pick.value);
        });
        add(row, pick);
        add(row, el('span', 't-note', t('lpr.takeHint', { n: takes.length })));
        add(tabsBar, row);
      }

      /* 「10/4 21:15」。年は出さない（同じ案を並べるので月日で足りる） */
      function when(iso) {
        var d = new Date(String(iso || ''));
        if (isNaN(d.getTime())) { return '-'; }
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
      }

      function saveHtml() {
        {
          /* 前の版を履歴に積んでから上書きする。同じ中身なら積まない */
          var prev = String(view.gen.generated_html || '');
          var history = view.history.slice();
          if (prev && prev !== view.html) {
            history.push({ at: new Date().toISOString(), html: prev });
            /* 履歴は直近20件まで。1件が数十KBあるので際限なく溜めない */
            while (history.length > 20) { history.shift(); }
          }
          Api.generations.update(view.gen.id, { generated_html: view.html, html_history: history }).then(function () {
            view.gen.generated_html = view.html;
            view.gen.html_history = history;
            view.history = history;
            view.at = -1;
            toast(t('lpr.saved'), 'success');
            paint();
          }).catch(function (err) { console.error('[screens-lp-result] 保存に失敗:', err); });
        }
      }

      /* 履歴の1件を見る。見るだけで保存はしない */
      function showVersion(index) {
        view.at = index;
        view.html = index < 0 ? String(view.gen.generated_html || '') : String(view.history[index].html || '');
        paint();
      }

      /* 見ている過去の版を最新にする。今の最新は履歴に回す */
      function restoreVersion() {
        if (view.at < 0) { return; }
        var picked = String(view.history[view.at].html || '');
        var history = view.history.slice();
        var cur = String(view.gen.generated_html || '');
        history.splice(view.at, 1);
        if (cur && cur !== picked) { history.push({ at: new Date().toISOString(), html: cur }); }
        Api.generations.update(view.gen.id, { generated_html: picked, html_history: history }).then(function () {
          view.gen.generated_html = picked;
          view.gen.html_history = history;
          view.history = history;
          view.html = picked;
          view.at = -1;
          toast(t('lpr.restored'), 'success');
          paint();
        }).catch(function (err) { console.error('[screens-lp-result] 版の差し戻しに失敗:', err); });
      }

      function paint() {
        paintVariants();
        clear(toolbar);
        add(toolbar, button('btn btn--secondary', t('lpr.backToDraft'), function () {
          location.hash = '#/S12?id=' + encodeURIComponent(projectId) + '&gen=' + encodeURIComponent(view.gen.id);
        }));
        add(toolbar, button('btn btn--primary', view.gen.generated_html ? t('lpr.rebuild') : t('lpr.build'), function () {
          build(true); paint();
        }));
        add(toolbar, button('btn btn--secondary', t('lpr.download'), download));
        /* 出す形の切り替え。販売ページ（公開したときに見える形。LINEもここ）と、
           区画そのまま（作った絵と文字を縦に並べただけ） */
        var kind = previewKind();
        var sw = el('div', 'lpr-view');
        [['sales', 'lpr.viewSales'], ['canvas', 'lpr.viewCanvas']].forEach(function (pair) {
          var b = button('btn btn--sm' + (kind === pair[0] ? ' btn--primary' : ' btn--secondary'),
            t(pair[1]), function () {
              view.preview = pair[0];
              build(false);
              paint();
            });
          b.setAttribute('aria-pressed', kind === pair[0] ? 'true' : 'false');
          /* 販売ページの文章が無ければ、そちらは選べない */
          if (pair[0] === 'sales' && !hasSales()) { b.disabled = true; b.title = t('lpr.noSales'); }
          add(sw, b);
        });
        add(toolbar, sw);
        if (!hasSales()) { add(toolbar, el('span', 't-note', t('lpr.noSales'))); }
        else { add(toolbar, el('span', 't-note', t('lpr.viewHint'))); }
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
        /* 過去の版。新しい順に並べ、選ぶとその版を見る（保存はしない） */
        if (view.history.length) {
          var pick = el('select', 'select lp-history');
          var latest = el('option', null, t('lpr.latest'));
          latest.value = '-1';
          add(pick, latest);
          for (var i = view.history.length - 1; i >= 0; i -= 1) {
            var o = el('option', null, String(view.history[i].at || '').slice(0, 16).replace('T', ' '));
            o.value = String(i);
            add(pick, o);
          }
          pick.value = String(view.at);
          pick.setAttribute('aria-label', t('lpr.history'));
          pick.addEventListener('change', function () { showVersion(Number(pick.value)); });
          add(toolbar, pick);
          if (view.at >= 0) {
            add(toolbar, button('btn btn--secondary', t('lpr.restore'), restoreVersion));
            add(toolbar, el('span', 't-note', t('lpr.viewing', { at: String(view.history[view.at].at || '').slice(0, 16).replace('T', ' ') })));
          }
        }

        paintModes();
        paintShelf();
        markShelf();
        frame.srcdoc = view.html;
        frame.addEventListener('load', measure, { once: true });
      }

      /* 区画ごとの見せ方。生成プロンプト（lp_brief）のときだけ出す。
         LP案（lp_draft）は文章と絵が1つのHTMLに組まれるので、選ぶ余地がない */
      function paintModes() {
        clear(modes);
        if (view.gen.feature_key !== 'lp_brief') { return; }
        /* 販売ページを見ているときも出す。ここで決めた見せ方は
           「区画そのまま」に効くもので、切り替えるたびに消えると探せない
           （2026-10-05 指摘「消えたけど復活させて」） */
        var sections = view.gen.sections || [];
        if (!sections.length) { return; }
        /* 区画が30本あると、この一覧だけで画面が埋まる。折りたたむ。
           開いたかどうかは覚えておく（層を切り替えるたびに閉じると面倒）
           （2026-10-04 要望） */
        var open = el('details', 'lpr-modes__box');
        if (view.modesOpen) { open.open = true; }
        open.addEventListener('toggle', function () { view.modesOpen = open.open; });
        var head = el('summary', 'lpr-modes__sum');
        add(head, el('span', 'lpr-modes__title', t('lpr.mode')));
        add(head, el('span', 't-note', t('lpr.modeCount', { n: sections.length })));
        add(open, head);
        add(modes, open);
        /* 以下は開いた中に積む */
        var modes0 = modes;
        modes = open;
        add(modes, el('p', 't-note', t('lpr.modeHint')));

        var all = el('div', 'lpr-modes__all');
        add(all, el('span', 't-note', t('lpr.modeAll')));
        [['image', 'lpr.modeImage'], ['text', 'lpr.modeText'], ['both', 'lpr.modeBoth']].forEach(function (pair) {
          add(all, button('btn btn--secondary btn--sm', t(pair[1]), function () { setMode('*', pair[0]); }));
        });
        add(modes, all);

        var list = el('div', 'lpr-modes__list');
        sections.forEach(function (sec) {
          var url = visualOf(sec);
          var row = el('div', 'lpr-modes__row');
          add(row, el('span', 'lpr-modes__no', String(sec.index)));
          add(row, el('span', 'lpr-modes__name', String(sec.title || t('lpr.mode'))));
          var pick = el('select', 'select select--sm');
          [['image', 'lpr.modeImage'], ['text', 'lpr.modeText'], ['both', 'lpr.modeBoth']].forEach(function (pair) {
            var o = el('option', null, t(pair[1]));
            o.value = pair[0];
            /* 中身が無い選択肢は選ばせない。選べても空の区画が出るだけ */
            if (pair[0] === 'text' && !sec.text) { o.disabled = true; }
            if (pair[0] === 'image' && !url) { o.disabled = true; }
            add(pick, o);
          });
          pick.value = modeOf(sec, url);
          pick.addEventListener('change', function () { setMode(sec.index, pick.value); });
          add(row, pick);
          if (!sec.text) { add(row, el('span', 't-note', t('lpr.modeNoText'))); }
          else if (!url) { add(row, el('span', 't-note', t('lpr.modeNoImage'))); }
          add(list, row);
        });
        add(modes, list);
        modes = modes0;   /* 入れ物を元に戻す（次に描くときに迷わない） */
      }

      /* 下見の右に出す棚。区画ごとに、これまで作った写真を並べる。
         写真が1枚しか無い区画は出さない（選ぶ余地がなく、ただ長くなる）。
         押すとその場で入れ替わり、保存もする（2026-10-05 要望） */
      function paintShelf() {
        clear(shelf);
        if (view.gen.feature_key !== 'lp_brief') { return; }
        var sections = view.gen.sections || [];
        if (!sections.length) { return; }
        /* 写真がある区画はぜんぶ並べる。1枚だけの区画も出す——
           スクロールに合わせて棚を動かすので、抜けがあると追えない
           （実測 2026-10-05: 複数ある区画だけ出していたら、
           ほとんどの場所で棚が動かなかった）。
           選べるのは2枚以上ある区画だけ */
        var many = [];
        var one = 0;
        sections.forEach(function (sec) {
          var shots = shotsOf(sec);
          if (!shots.length) { return; }
          if (shots.length === 1) { one += 1; }
          many.push({ sec: sec, shots: shots });
        });
        if (!many.length) { return; }
        var pickable = many.filter(function (p) { return p.shots.length >= 2; }).length;
        /* いまの下見がどの区画の絵を使っているか。
           販売ページは AI が選んだ区画だけを使う（30本あっても8本など）。
           使っていない区画の写真を選んでも見た目が変わらず、
           「選んでも反映されない」に見える（実測 2026-10-05） */
        var used = usedSlots();
        add(shelf, el('h3', 'lpr-shelf__title', t('lpr.shelf')));
        add(shelf, el('p', 't-note', pickable
          ? t('lpr.shelfHint', { n: pickable })
          : t('lpr.shelfNone')));
        if (one) { add(shelf, el('p', 't-note', t('lpr.shelfOne', { n: one }))); }
        var now = currentShots();
        many.forEach(function (pair) {
          var g = el('div', 'lpr-pick');
          g.setAttribute('data-slot', String(pair.sec.index) + '-1');
          var head = el('p', 'lpr-pick__head');
          add(head, el('span', 'lpr-pick__no', String(pair.sec.index)));
          add(head, el('span', 'lpr-pick__name', String(pair.sec.title || '')));
          add(g, head);
          if (used && !used[String(pair.sec.index) + '-1']) {
            g.className = 'lpr-pick lpr-pick--off';
            add(g, el('p', 't-note', t('lpr.pickUnused')));
          }
          var band = el('div', 'lpr-pick__band');
          var only = pair.shots.length < 2;
          pair.shots.forEach(function (shot, i) {
            var on = shot.url === now[String(pair.sec.index) + '-1'];
            var b = el('button', 'lpr-shot' + (on ? ' lpr-shot--on' : ''));
            b.type = 'button';
            b.title = on ? t('lpr.shotNow') : t('lpr.shotUse');
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
            var im = el('img', 'lpr-shot__im');
            im.src = shot.url; im.alt = ''; im.loading = 'lazy';
            add(b, im);
            /* いま使っているものに印。チェックの形にして、ひと目で分かるように */
            /* 1枚しか無い区画は、選ぶ余地がないので番号も付けない */
            if (!only) { add(b, el('span', 'lpr-shot__tick', on ? '✓' : String(pair.shots.length - i))); }
            if (!on) { b.addEventListener('click', function () { useShot(pair.sec, shot.url); }); }
            else { b.disabled = only; }
            add(band, b);
          });
          add(g, band);
          add(shelf, g);
        });
      }

      /* いまの下見が実際に出している区画。
         区画そのままは全部出すので null（＝ぜんぶ使う）を返す */
      function usedSlots() {
        if (previewKind() !== 'sales') { return null; }
        var sales = (view.gen.content && view.gen.content.sales) || null;
        if (!sales) { return null; }
        var out = {};
        [(sales.hero && sales.hero.slot)]
          .concat((sales.blocks || []).map(function (b) { return b && b.slot; }))
          .forEach(function (slot) { if (slot) { out[String(slot)] = 1; } });
        return out;
      }

      /* いま各区画で使っている写真（動く絵が優先） */
      function currentShots() {
        var bag = (view.gen.asset_prompts && typeof view.gen.asset_prompts === 'object')
          ? view.gen.asset_prompts : {};
        var out = {};
        (view.gen.sections || []).forEach(function (sec) {
          var slot = String(sec.index) + '-1';
          out[slot] = (bag.motion && bag.motion[slot]) || (bag.made && bag.made[slot]) || '';
        });
        return out;
      }

      /* 高さと中身の数は、枠の中から知らせてもらう。
         前は親から contentDocument を読んでいたが、中の JS を動かすために
         同じ生い立ちを外したので、もう読めない（2026-10-04）*/
      function measure() { /* 読み込みの合図。実際の値は下の受け口で入る */ }

      window.addEventListener('message', function (e) {
        var m = e && e.data;
        if (!m || m.lpya !== 1 || !frame) { return; }
        /* 自分の枠からのものだけ受ける */
        if (e.source !== frame.contentWindow) { return; }
        if (m.kind === 'spots') {
          view.spots = Array.isArray(m.spots) ? m.spots : [];
          followScroll();
          return;
        }
        if (m.kind === 'size') {
          frame.style.height = Math.min(Number(m.height) || 0, 12000) + 'px';
          stats.textContent = t('lpr.stats', {
            sections: Number(m.sections) || 0, images: Number(m.images) || 0,
            height: Number(m.height) || 0
          });
        }
      });

      /* 下見をスクロールすると、棚もいま見ている区画に合わせる
         （2026-10-05 要望）。枠は中身の高さぶん伸ばしてあって自分では
         スクロールしないので、外のページのスクロール位置から決める。
         目で追っているのは画面の真ん中あたりなので、そこに来た区画を選ぶ */
      function followScroll() {
        var spots = view.spots || [];
        if (!spots.length) { return; }
        var box = frame.getBoundingClientRect();
        var base = box.top + window.scrollY;
        var eye = window.scrollY + window.innerHeight * 0.4;
        var best = null;
        var bestGap = Infinity;
        /* 絵がまだ読めていないと、どれも高さ0で同じ位置に重なる。
           そのときは並び順から等間隔とみなす。読めたら本当の位置に入れ替わる
           （実測 2026-10-05: 30区画ぜんぶ top:289 h:0 で、棚が動かなかった） */
        var flat = spots.every(function (one) { return !Number(one.h); });
        spots.forEach(function (one, i) {
          var top, bottom;
          if (flat) {
            top = base + box.height * (i / spots.length);
            bottom = base + box.height * ((i + 1) / spots.length);
          } else {
            top = base + Number(one.top || 0);
            bottom = top + Number(one.h || 0);
          }
          /* 画面の目の高さがその絵の中にあれば、それ。無ければいちばん近いもの */
          var gap = (eye >= top && eye <= bottom) ? 0 : Math.min(Math.abs(eye - top), Math.abs(eye - bottom));
          if (gap < bestGap) { bestGap = gap; best = String(one.slot || ''); }
        });
        if (!best || best === view.atSlot) { return; }
        view.atSlot = best;
        markShelf();
      }

      /* 棚のうち、いま見ている区画を目立たせて、見える所まで寄せる */
      function markShelf() {
        var groups = shelf.querySelectorAll('.lpr-pick');
        var hit = null;
        for (var i = 0; i < groups.length; i++) {
          var on = groups[i].getAttribute('data-slot') === view.atSlot;
          groups[i].classList.toggle('lpr-pick--here', on);
          if (on) { hit = groups[i]; }
        }
        if (!hit) { return; }
        /* 棚の中だけを動かす。ページ全体が飛ぶと、読んでいる所を見失う */
        var top = hit.offsetTop - shelf.clientHeight / 2 + hit.clientHeight / 2;
        shelf.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
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
