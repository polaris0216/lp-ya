/* ============================================================
 * エルピーヤ — screens-line.js
 * S21 LINEコンテンツ（工程6）。生成結果（S13）の次に置く。
 *
 * ここでやること（2026-10-15 要望「5生成結果の次に6のLINEコンテンツ
 * 生成ページを追加して、リッチメニューやリッチメッセージ、
 * ラインメッセージ文章など生成できるように」）:
 *   1. 形を選ぶ   … リッチメニュー・リッチメッセージの寸法（販売の条件と同じ鍵）
 *   2. 絵を作る   … line_brief（区画を書く）→ lp_section（1枚ずつ絵にする）
 *   3. 文章を作る … line_copy（送る場面ごとの文を書く）
 *
 * 絵の作り方は LP・KV・広告と同じ仕組みに乗せてある（生成物＋区画＋asset_prompts）。
 * ここは入口を1つにまとめるだけで、作る所を別に持たない。
 *
 * ---- 他ファイルとの共通契約 ----
 * 画面登録   App.registerScreen('S21', { render: function (root, params) {} });
 * 通信       window.Api だけを使う（Api.projects / Api.generations / Api.generationJobs）
 * 文言       window.I18N.t。辞書に無いものは下の LOCAL（ja/en/ko）で補って tl() で引く
 * ============================================================ */
(function (window, document) {
  'use strict';

  var App = window.App = window.App || {};
  var LOCALES = ['ja', 'en', 'ko'];

  /* 形の一覧。S12 の販売の条件と同じ並びにする（別物に見えると迷う）。
     寸法の決まりそのものは tools/line-assets.mjs が持っていて、
     ここは選ばせるだけ。鍵も sales_info.line_menu / line_msg で同じ */
  var MENU_SIZES = [
    ['', 'lp.pubLineNone'],
    ['大-1', '大・全面1枠（2500×1686）'],
    ['大-2x', '大・左右2枠（2500×1686）'],
    ['大-3L', '大・左に商品＋右に2枠（2500×1686）'],
    ['大-3y', '大・上1枠＋下2枠（2500×1686）'],
    ['大-1+3', '大・上1枠＋下3枠（2500×1686）'],
    ['大-4', '大・4枠（2500×1686）'],
    ['大-6', '大・2段3列（2500×1686）'],
    ['小-1', '小・全面1枠（2500×843）'],
    ['小-2x', '小・左右2枠（2500×843）'],
    ['小-3x', '小・横3枠（2500×843）']
  ];
  var MSG_SIZES = [
    ['', 'lp.pubLineNone'],
    ['正方形A', '正方形・1枠（1040×1040）'],
    ['正方形B', '正方形・左右2枠（1040×1040）'],
    ['正方形C', '正方形・上下2枠（1040×1040）'],
    ['正方形E', '正方形・4枠（1040×1040）'],
    ['正方形H', '正方形・2段3列（1040×1040）'],
    ['正方形K', '正方形・左大＋右2枠（1040×1040）'],
    ['横長A', '横長・細1枠（1040×350）'],
    ['横長B', '横長・1枠（1040×700）'],
    ['横長D', '横長・1枠（1040×585）'],
    ['縦長A', '縦長・1枠（1040×1300）'],
    ['縦長E', '縦長・長い1枠（1040×1850）'],
    ['カスタム', 'カスタム（1040×高さ自由）']
  ];

  var LOCAL = {
    'line.title': ['LINEコンテンツ', 'LINE content', 'LINE 콘텐츠'],
    'line.lead': ['LINE公式アカウントで使う、リッチメニュー・リッチメッセージの絵と、送る文章を作ります。'
      + '絵は商品写真を見本にして作り、掲載先の公式ロゴはあとから貼ります。',
      'Rich menu and rich message images, plus the copy you send. Images use your product photos; the platform logo is stamped in afterwards.',
      'LINE 공식 계정에서 쓸 리치메뉴·리치메시지 이미지와 보낼 문장을 만듭니다.'],
    'line.sizes': ['1. 形を選ぶ', '1. Pick the sizes', '1. 형식 선택'],
    'line.sizesHint': ['選んだ寸法ちょうどに仕上げます。LINEが受け取らない寸法は選べません。',
      'Images are finished at exactly the chosen size.',
      '선택한 치수 그대로 마무리합니다.'],
    'line.msgH': ['カスタムの高さ（520〜2080）', 'Custom height (520–2080)', '커스텀 높이（520〜2080）'],
    'line.save': ['形を保存', 'Save sizes', '형식 저장'],
    'line.saved': ['保存しました', 'Saved', '저장했습니다'],
    'line.images': ['2. 絵を作る', '2. Make the images', '2. 이미지 만들기'],
    'line.imagesHint': ['先に「区画を作る」で何を描くかを決め、それから1枚ずつ絵にします。',
      'Write the briefs first, then generate image by image.',
      '먼저 구획을 만들고, 그 다음 한 장씩 생성합니다.'],
    'line.makeBrief': ['区画を作る', 'Write the briefs', '구획 만들기'],
    'line.briefDone': ['区画を作りました', 'Briefs written', '구획을 만들었습니다'],
    'line.needSize': ['先に形を選んで保存してください。', 'Pick and save the sizes first.', '먼저 형식을 선택해 저장하세요.'],
    'line.noBrief': ['まだ区画がありません。「区画を作る」を押してください。',
      'No briefs yet. Press “Write the briefs”.', '아직 구획이 없습니다.'],
    'line.make': ['絵を作る', 'Generate', '생성'],
    'line.remake': ['作り直す', 'Regenerate', '다시 생성'],
    'line.open': ['大きく見る', 'Open', '크게 보기'],
    'line.making': ['作っています…', 'Working…', '만드는 중…'],
    'line.texts': ['3. 文章を作る', '3. Write the copy', '3. 문장 만들기'],
    'line.textsHint': ['友だち追加のあいさつから締切前のお知らせまで、送る場面ごとに1通ずつ書きます。'
      + '商品情報に無い数字は書きません。',
      'One message per moment, from the welcome note to the final reminder.',
      '보낼 장면별로 한 통씩 씁니다.'],
    'line.makeText': ['文章を作る', 'Write the copy', '문장 만들기'],
    'line.remakeText': ['書き直す', 'Rewrite', '다시 쓰기'],
    'line.copy': ['写す', 'Copy', '복사'],
    'line.copied': ['写しました', 'Copied', '복사했습니다'],
    'line.noText': ['まだ文章がありません。', 'No copy yet.', '아직 문장이 없습니다.'],
    'line.noProject': ['プロジェクトを選んでから開いてください。', 'Open a project first.', '프로젝트를 먼저 선택하세요.']
  };

  function localeIndex() {
    var code = (window.I18N && typeof window.I18N.locale === 'function') ? window.I18N.locale() : 'ja';
    var at = LOCALES.indexOf(String(code));
    return at === -1 ? 0 : at;
  }

  function t(key, params) {
    if (window.I18N && typeof window.I18N.t === 'function') { return window.I18N.t(key, params); }
    return key;
  }

  function tl(key) {
    var row = LOCAL[key];
    if (!row) {
      console.error('[screens-line] 辞書に ' + key + ' がありません');
      return key;
    }
    return row[localeIndex()] || row[0];
  }

  /* 形の名札。LOCAL の鍵（lp.pubLineNone）ならそれを引き、
     そうでなければ寸法つきの文字列をそのまま出す */
  function sizeLabel(label) {
    return /^[a-z]+\./.test(label) ? t(label) : label;
  }

  function el(tag, className, textContent) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (textContent !== undefined && textContent !== null) { node.textContent = String(textContent); }
    return node;
  }

  function add(parent, child) { if (parent && child) { parent.appendChild(child); } return child; }

  function button(className, label, onClick) {
    var node = el('button', className, label);
    node.type = 'button';
    if (onClick) { node.addEventListener('click', onClick); }
    return node;
  }

  function clear(node) { while (node && node.firstChild) { node.removeChild(node.firstChild); } }

  function toast(message, kind) {
    if (typeof App.toast === 'function') { App.toast(message, kind); return; }
    console.log('[screens-line] ' + message);
  }

  function isArray(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

  function userId() {
    return (window.Api && Api.auth && typeof Api.auth.userId === 'function') ? Api.auth.userId() : undefined;
  }

  function currentLocale() {
    return (window.I18N && typeof window.I18N.locale === 'function') ? window.I18N.locale() : 'ja';
  }

  function renderLine(root, params) {
    clear(root);
    var projectId = (params && params.id)
      || (window.Api && Api.storage && Api.storage.get('projectId')) || '';
    if (!projectId) {
      add(root, el('p', 'empty', tl('line.noProject')));
      return;
    }

    var screen = el('section', 'screen');
    add(screen, el('h1', 'screen__title', tl('line.title')));
    add(screen, el('p', 'screen__lead', tl('line.lead')));
    var body = el('div', 'stack');
    add(screen, body);
    add(root, screen);

    var view = { project: null, brief: null, images: null, texts: null, busy: {} };

    function reload() {
      return Promise.all([
        Api.projects.get(projectId),
        /* 絵の区画（line_brief）と文章（line_copy）。どちらも新しい順で1本だけ見る */
        Api.generations.first({ eq: { projects_id: projectId, feature_key: 'line_brief' },
          order: 'created_at.desc' }),
        Api.generations.first({ eq: { projects_id: projectId, feature_key: 'line_copy' },
          order: 'created_at.desc' })
      ]).then(function (got) {
        view.project = got[0];
        view.brief = got[1];
        view.texts = got[2];
      });
    }

    /* ---------- 1. 形 ---------- */
    function paintSizes(box) {
      clear(box);
      var info = (view.project && view.project.sales_info
        && typeof view.project.sales_info === 'object') ? view.project.sales_info : {};
      add(box, el('h2', 'section__title', tl('line.sizes')));
      add(box, el('p', 'field__hint', tl('line.sizesHint')));

      function pick(list, value) {
        var sel = el('select', 'input');
        list.forEach(function (one) {
          var op = el('option', '', sizeLabel(one[1]));
          op.value = one[0];
          if (one[0] === value) { op.selected = true; }
          add(sel, op);
        });
        return sel;
      }
      var fm = el('div', 'field');
      add(fm, el('label', 'field__label', t('lp.pubLineMenu')));
      var menuSel = pick(MENU_SIZES, String(info.line_menu || ''));
      add(fm, menuSel);
      add(box, fm);

      var fg = el('div', 'field');
      add(fg, el('label', 'field__label', t('lp.pubLineMsg')));
      var msgSel = pick(MSG_SIZES, String(info.line_msg || ''));
      add(fg, msgSel);
      add(box, fg);

      var fh = el('div', 'field');
      add(fh, el('label', 'field__label', tl('line.msgH')));
      var hIn = el('input', 'input');
      hIn.type = 'number';
      hIn.min = '520';
      hIn.max = '2080';
      hIn.value = String(info.line_msg_h || '');
      add(fh, hIn);
      add(box, fh);
      function showH() { fh.style.display = msgSel.value === 'カスタム' ? '' : 'none'; }
      msgSel.addEventListener('change', showH);
      showH();

      add(box, button('btn btn--secondary', tl('line.save'), function () {
        var next = {};
        Object.keys(info).forEach(function (k) { next[k] = info[k]; });
        next.line_menu = menuSel.value;
        next.line_msg = msgSel.value;
        /* カスタムのときだけ高さを持つ。決まった形に高さを残すと、
           あとで形を替えたときに古い高さが効いてしまう */
        next.line_msg_h = msgSel.value === 'カスタム'
          ? Math.min(2080, Math.max(520, Number(hIn.value) || 1040)) : '';
        Api.projects.update(projectId, { sales_info: next }).then(function () {
          view.project.sales_info = next;
          toast(tl('line.saved'), 'success');
          paint();
        }).catch(function (err) {
          console.error('[screens-line] 形を保存できませんでした:', err);
          toast(t('common.error'), 'danger');
        });
      }));
    }

    /* 仕事を積んで、終わったら読み直す。3つのボタンで同じことをするので1つにまとめる */
    function queue(featureKey, payload, doneKey, btn) {
      if (!window.Api || !Api.generationJobs) { toast(t('common.error'), 'danger'); return; }
      btn.disabled = true;
      btn.textContent = tl('line.making');
      Api.generationJobs.insert({
        feature_key: featureKey,
        status: 'pending',
        projects_id: projectId,
        users_id: userId(),
        payload: payload,
        lang: currentLocale()
      }).then(function (job) {
        if (!App.watchJob) { reload().then(paint); return; }
        App.watchJob({
          jobId: job.id,
          titleKey: 'line.title',
          urls: [],
          onDone: function () { reload().then(function () { toast(tl(doneKey), 'success'); paint(); }); },
          onFail: function () { reload().then(paint); }
        });
      }).catch(function (err) {
        console.error('[screens-line] 仕事を積めませんでした:', err);
        toast(t('common.error'), 'danger');
        paint();
      });
    }

    /* ---------- 2. 絵 ---------- */
    function paintImages(box) {
      clear(box);
      var info = (view.project && view.project.sales_info
        && typeof view.project.sales_info === 'object') ? view.project.sales_info : {};
      add(box, el('h2', 'section__title', tl('line.images')));
      add(box, el('p', 'field__hint', tl('line.imagesHint')));
      if (!info.line_menu && !info.line_msg) {
        add(box, el('p', 'field__error', tl('line.needSize')));
        return;
      }
      var mk = button('btn btn--secondary', tl('line.makeBrief'), function () {
        queue('line_brief', { generation_id: (view.brief && view.brief.id) || '' }, 'line.briefDone', mk);
      });
      add(box, mk);
      if (!view.brief || !isArray(view.brief.sections) || !view.brief.sections.length) {
        add(box, el('p', 'empty', tl('line.noBrief')));
        return;
      }
      var made = (view.brief.asset_prompts && view.brief.asset_prompts.made) || {};
      var grid = el('div', 'line-grid');
      view.brief.sections.forEach(function (sec) {
        var slot = String(sec.index) + '-1';
        var url = made[slot];
        var card = el('div', 'line-card');
        add(card, el('h3', 'line-card__title', String(sec.title || '')));
        if (url) {
          var img = el('img', 'line-card__img');
          img.src = url;
          img.alt = String(sec.title || '');
          img.loading = 'lazy';
          add(card, img);
          var a = el('a', 'btn btn--text btn--sm', tl('line.open'));
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener';
          add(card, a);
        }
        var b = button('btn btn--primary btn--sm', url ? tl('line.remake') : tl('line.make'), function () {
          queue('lp_section',
            { generation_id: view.brief.id, sections: [sec.index], force: !!url },
            'line.briefDone', b);
        });
        add(card, b);
        add(grid, card);
      });
      add(box, grid);
    }

    /* ---------- 3. 文章 ---------- */
    function paintTexts(box) {
      clear(box);
      add(box, el('h2', 'section__title', tl('line.texts')));
      add(box, el('p', 'field__hint', tl('line.textsHint')));
      var has = view.texts && isArray(view.texts.sections) && view.texts.sections.length;
      var b = button('btn btn--secondary', has ? tl('line.remakeText') : tl('line.makeText'), function () {
        queue('line_copy', {}, 'line.copied', b);
      });
      add(box, b);
      if (!has) { add(box, el('p', 'empty', tl('line.noText'))); return; }
      var list = el('div', 'line-texts');
      view.texts.sections.forEach(function (sec) {
        var row = el('div', 'line-text');
        add(row, el('h3', 'line-text__when', String(sec.title || '')));
        add(row, el('p', 'line-text__body', String(sec.body || '')));
        add(row, button('btn btn--text btn--sm', tl('line.copy'), function () {
          /* 写すのは文章だけ。コピーできない環境（古い端末・http）もあるので黙らない */
          if (!navigator.clipboard || !navigator.clipboard.writeText) {
            toast(t('common.error'), 'danger');
            return;
          }
          navigator.clipboard.writeText(String(sec.body || '')).then(function () {
            toast(tl('line.copied'), 'success');
          }).catch(function (err) {
            console.error('[screens-line] 写せませんでした:', err);
            toast(t('common.error'), 'danger');
          });
        }));
        add(list, row);
      });
      add(box, list);
    }

    var sizeBox = add(body, el('section', 'section'));
    var imgBox = add(body, el('section', 'section'));
    var textBox = add(body, el('section', 'section'));

    function paint() {
      paintSizes(sizeBox);
      paintImages(imgBox);
      paintTexts(textBox);
    }

    reload().then(paint).catch(function (err) {
      console.error('[screens-line] 読み込みに失敗:', err);
      add(body, el('p', 'field__error', t('common.error')));
    });
  }

  App.registerScreen('S21', {
    render: function (root, params) { renderLine(root, params); }
  });

})(window, document);
