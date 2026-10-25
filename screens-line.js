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

  /* 形の一覧は line-layouts.js（tools/make-line-layouts.mjs が焼く）から読む。
     ここに書き写すと、寸法を足したときに必ずずれる */
  /* 掲載先の選択肢。公式ロゴを持っている4社と、ロゴの無い海外3社 */
  var PLATFORMS = [
    ['makuake', 'Makuake'], ['campfire', 'CAMPFIRE'],
    ['greenfunding', 'GREENFUNDING'], ['machiya', 'machi-ya'],
    ['kickstarter', 'Kickstarter'], ['indiegogo', 'Indiegogo'], ['wadiz', 'Wadiz']
  ];

  /* LINE に登録する richmenu の本体を組む。
     座標の出し方は tools/line-assets.mjs の menuAreas と同じにする
     （端で1pxこぼれないよう、右端・下端は引き算で出す） */
  function menuObject(L, links, name) {
    return {
      size: { width: L.w, height: L.h },
      selected: true,
      name: String(name || 'メニュー').slice(0, 300),
      chatBarText: 'メニュー',
      areas: L.cells.map(function (c, i) {
        var one = links[i] || {};
        var x = Math.round(c.x * L.w);
        var y = Math.round(c.y * L.h);
        return {
          bounds: { x: x, y: y,
            width: Math.round((c.x + c.w) * L.w) - x,
            height: Math.round((c.y + c.h) * L.h) - y },
          action: one.uri
            ? { type: 'uri', label: String(one.label || ('枠' + (i + 1))).slice(0, 20), uri: one.uri }
            : { type: 'postback', label: String(one.label || ('枠' + (i + 1))).slice(0, 20),
              data: 'cell=' + (i + 1) }
        };
      })
    };
  }

  function layouts(kind) {
    var all = window.LPYA_LINE_LAYOUTS || null;
    if (!all) {
      console.error('[screens-line] line-layouts.js が読み込まれていません');
      return [];
    }
    return all[kind] || [];
  }

  var LOCAL = {
    'line.title': ['LINEコンテンツ', 'LINE content', 'LINE 콘텐츠'],
    /* lp.pubLine* は screens-lp.js の中だけの辞書なので、ここからは引けない。
       引くと鍵の文字（lp.pubLineMenu）がそのまま画面に出る
       （2026-10-15 指摘「このままの表記ではなんなのかわからない」） */
    'line.menuLabel': ['LINEリッチメニューの形', 'LINE rich menu layout', 'LINE 리치메뉴 형식'],
    'line.msgLabel': ['LINEリッチメッセージの形', 'LINE rich message layout', 'LINE 리치메시지 형식'],
    'line.none': ['作らない', 'None', '만들지 않음'],
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
    'line.makeBrief': ['区画を作る（何を描くか決める）', 'Write the briefs', '구획 만들기'],
    'line.makeAll': ['絵をまとめて作る', 'Generate all', '이미지 일괄 생성'],
    /* 枠ごとに別の商品を出す（2026-10-18 要望）。
       商品は別のプロジェクトから呼び出す */
    'line.ask': ['他のプロジェクトから商品を呼び出しますか？',
      'Pull products from other projects?', '다른 프로젝트에서 상품을 불러올까요?'],
    'line.askHint': ['リッチメニューは、枠ごとに別の商品を出せます。'
      + '呼び出すと、その商品の名前・割引率・写真をそのまま使って枠に割り当てます。',
      'A rich menu can show a different product per cell.',
      '리치메뉴는 칸마다 다른 상품을 넣을 수 있습니다.'],
    'line.askNo': ['いいえ（この商品だけ）', 'No (this product only)', '아니요'],
    'line.askYes': ['はい、呼び出す', 'Yes, pull them in', '네, 불러오기'],
    'line.pickProjects': ['出す商品を選ぶ（枠の順に割り当てます）',
      'Pick the products (assigned to cells in order)', '상품 선택'],
    'line.noOther': ['他のプロジェクトがありません。', 'No other projects.', '다른 프로젝트가 없습니다.'],
    'line.saved2': ['呼び出す商品を保存しました', 'Saved', '저장했습니다'],
    'line.goLayer': ['{v}層には絵があります。開く', 'Layer {v} has images. Open',
      '{v} 레이어에 이미지가 있습니다'],
    /* 生成文を見る・足す（2026-10-18 要望） */
    'line.prompt': ['生成プロンプトを見る・足す', 'View / extend the prompt', '생성 프롬프트 보기·추가'],
    'line.promptBase': ['生成プロンプト（ここで直せます）',
      'Prompt (editable here)', '생성 프롬프트（여기서 수정）'],
    'line.promptEdited': ['手で直した文を使っています', 'Using your edited prompt', '직접 고친 문장을 사용 중'],
    'line.promptReset': ['自動の文に戻す', 'Back to the generated text', '자동 문장으로 되돌리기'],
    'line.promptResetDone': ['自動の文に戻しました', 'Restored', '되돌렸습니다'],
    'line.promptAdd': ['足したい指示', 'Your extra instruction', '추가 지시'],
    'line.promptAddPh': ['例: 背景は夜の台所にする／札は丸い形にする',
      'e.g. make the background a night kitchen', '예: 배경을 밤의 주방으로'],
    'line.promptHint': ['上の文は直接直せます。直すと、その区画は「区画を作る」で'
      + '作り直しても上書きされません（自動の更新は入りません）。'
      + '下の「足したい指示」はいちばん後ろに付き、どちらの場合も残ります。',
      'You can edit the prompt above; edited sections are not overwritten by rebuilds.',
      '위 문장은 직접 수정할 수 있습니다.'],
    'line.promptSave': ['指示を保存', 'Save', '저장'],
    'line.promptSaved': ['保存しました。次に作る絵から効きます。',
      'Saved. It applies to the next image.', '저장했습니다.'],
    /* 押せる面（2026-10-19）。画像だけではLINEに登録できない */
    'line.areas': ['押したときの行き先（LINEに登録する面）',
      'Tap targets (areas for LINE)', '탭 영역'],
    'line.areasHint': ['枠ごとの行き先を入れて、JSONを落としてください。'
      + 'Messaging API の richmenu にそのまま使えます。'
      + '空のままの枠は、押しても何も起きない形で書き出します。',
      'Enter a link per cell and download the JSON for the Messaging API.',
      '칸마다 링크를 넣고 JSON을 받으세요.'],
    'line.areasCell': ['枠{n}', 'Cell {n}', '칸 {n}'],
    'line.areasLabel': ['表示名', 'Label', '표시명'],
    'line.areasUri': ['行き先のURL', 'Link', '링크'],
    'line.areasSave': ['行き先を保存', 'Save links', '링크 저장'],
    'line.areasGet': ['JSONを落とす', 'Download JSON', 'JSON 받기'],
    'line.areasSaved': ['行き先を保存しました', 'Saved', '저장했습니다'],
    /* 商品ごとに売る場所が違う（2026-10-18 要望） */
    'line.cellPf': ['この商品の掲載先', 'Platform for this product', '이 상품의 게재처'],
    'line.pfHint': ['商品ごとに売る場所が違う場合に変えてください。'
      + 'ふだんはその案件に登録した掲載先がそのまま入ります。',
      'Change this when a product sells on a different platform.',
      '상품마다 판매처가 다를 때 바꿔 주세요.'],
    'line.briefOnly': ['このボタンは「何を描くか」を決めるだけで、絵はまだできません。'
      + '下の「絵を作る」か「絵をまとめて作る」を押すと作り始めます。',
      'This only decides what to draw. Press Generate below to make the images.',
      '이 버튼은 무엇을 그릴지 정할 뿐입니다.'],
    /* 絵の作り先。LP案の画面（S12）と同じ鍵（projects.image_via）を使う。
       文言は lp.* で、あちらのファイルの中だけの辞書なので、ここにも持つ */
    'line.via': ['絵の作り先', 'Where images are made', '그림 생성처'],
    'line.viaBrowser': ['ChatGPTの画面', 'ChatGPT (browser)', 'ChatGPT 화면'],
    'line.viaApi': ['OpenAI API', 'OpenAI API', 'OpenAI API'],
    'line.viaBrowserHint': ['追加の料金はかかりません。ただし回数制限があり、当たると数時間止まります',
      'No extra cost, but rate limits can stall it for hours',
      '추가 요금은 없지만 횟수 제한이 있습니다'],
    'line.viaApiHint': ['1枚およそ $0.06〜0.08 かかります。回数制限は無く、速く作れます',
      'About $0.06–0.08 per image, no rate limit',
      '장당 약 $0.06〜0.08, 횟수 제한 없음'],
    'line.viaApiOn': ['これからは OpenAI API で作ります（1枚 $0.06〜0.08）',
      'Images will be made with the OpenAI API', '이제 OpenAI API로 만듭니다'],
    'line.viaBrowserOn': ['これからは ChatGPT の画面で作ります（追加の料金なし）',
      'Images will be made in the ChatGPT browser', '이제 ChatGPT 화면에서 만듭니다'],
    'line.briefDone': ['区画を作りました', 'Briefs written', '구획을 만들었습니다'],
    'line.needSize': ['先に形を選んで保存してください。', 'Pick and save the sizes first.', '먼저 형식을 선택해 저장하세요.'],
    'line.noBrief': ['まだ区画がありません。「区画を作る」を押してください。',
      'No briefs yet. Press “Write the briefs”.', '아직 구획이 없습니다.'],
    'line.make': ['絵を作る', 'Generate', '생성'],
    'line.remake': ['作り直す', 'Regenerate', '다시 생성'],
    'line.open': ['大きく見る', 'Open', '크게 보기'],
    'line.useThis': ['これを使う', 'Use this', '이걸로 설정'],
    'line.shotNow': ['いま使う版', 'In use', '사용 중'],
    'line.shotPrompt': ['この版を作った生成文を見る', 'Show the prompt that made this version', '이 버전을 만든 프롬프트 보기'],
    'line.shotPromptNone': ['この版の生成文は残っていません', 'No prompt kept for this version', '이 버전의 프롬프트가 없습니다'],
    'line.shotPromptUse': ['この文に戻す', 'Use this prompt', '이 프롬프트로 되돌리기'],
    'line.shotPromptUsed': ['生成文を戻しました。保存してから作り直してください',
      'Prompt restored. Save, then regenerate.', '프롬프트를 되돌렸습니다. 저장 후 다시 생성하세요'],
    'line.useThisDone': ['この絵をいまの絵にしました', 'Now the current image', '현재 그림으로 바꿨습니다'],
    'line.prev': ['前へ', 'Previous', '이전'],
    'line.next': ['次へ', 'Next', '다음'],
    'line.saveFail': ['ダウンロードできませんでした', 'Could not download', '내려받지 못했습니다'],
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

  /* params を渡すと {v} のような穴を埋める。共通の t() と同じ使い勝手にする */
  function tl(key, params) {
    var row = LOCAL[key];
    if (!row) {
      console.error('[screens-line] 辞書に ' + key + ' がありません');
      return key;
    }
    var out = row[localeIndex()] || row[0];
    if (params) {
      Object.keys(params).forEach(function (name) {
        out = out.split('{' + name + '}').join(String(params[name]));
      });
    }
    return out;
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

    /* shotAt は「どの版を見ているか」。描き直しをまたいで覚える
       （作り直しのあと paint() が走ると、見ていた版に戻れなくなる）*/
    var view = { project: null, brief: null, layers: {}, layer: '', texts: null,
      busy: {}, shotAt: {} };

    /* 絵のある束を選ぶ。いちばん新しい1本にすると、区画を作り直した直後に
       「絵が1枚も無い」画面になる（実測 2026-10-15: 作った絵は1つ前の束にあった）。
       生成結果（S13）の bestTake と同じ決め方: 絵の多い順 → 新しい順 */
    function bestOf(rows) {
      var list = isArray(rows) ? rows.slice() : [];
      list.sort(function (a, b) {
        var na = Object.keys((a.asset_prompts && a.asset_prompts.made) || {}).length;
        var nb = Object.keys((b.asset_prompts && b.asset_prompts.made) || {}).length;
        if (na !== nb) { return nb - na; }
        return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      });
      return list[0] || null;
    }

    /* 層ごとに1本ずつ選ぶ。LINEの台は層ぶん作るので、1層ぶんしか出さないと
       「B〜E層のぶんが画面に出ない」ことになる（2026-10-15 指摘）。
       層の中では bestOf と同じ決め方 */
    function byLayer(rows) {
      var out = {};
      (isArray(rows) ? rows : []).forEach(function (g) {
        var L = String(g.variant_label || '-');
        (out[L] = out[L] || []).push(g);
      });
      Object.keys(out).forEach(function (L) { out[L] = bestOf(out[L]); });
      return out;
    }

    function reload() {
      return Promise.all([
        Api.projects.get(projectId),
        Api.generations.list({ eq: { projects_id: projectId, feature_key: 'line_brief' },
          order: 'created_at.desc', limit: 20 }),
        Api.generations.first({ eq: { projects_id: projectId, feature_key: 'line_copy' },
          order: 'created_at.desc' }),
        /* 枠に出す商品の選択肢。自分の案件だけが返る（RLS） */
        Api.projects.list({ select: 'id,name,product_name,cf_platform',
          order: 'created_at.desc', limit: 50 })
          .catch(function () { return []; })
      ]).then(function (got) {
        view.project = got[0];
        view.layers = byLayer(got[1]);
        /* byLayer は層ごとに1本しか選ばない。選ばれなかった束にも作った絵が
           残っているので、「前に作った絵」を集めるために全部持っておく
           （2026-10-20 要望「過去のものも見れるように」） */
        view.rows = isArray(got[1]) ? got[1] : [];
        /* 開いて見せる層。ABCDE順の先頭（生成結果の画面と同じ決め）。
           いま見ている層が消えていなければ、そのまま残す */
        var names = Object.keys(view.layers).sort();
        if (!view.layer || names.indexOf(view.layer) === -1) { view.layer = names[0] || ''; }
        view.brief = view.layers[view.layer] || null;
        view.texts = got[2];
        view.others = isArray(got[3]) ? got[3] : [];
      });
    }

    /* ---------- 1. 形 ---------- */
    function paintSizes(box) {
      clear(box);
      var info = (view.project && view.project.sales_info
        && typeof view.project.sales_info === 'object') ? view.project.sales_info : {};
      add(box, el('h2', 'section__title', tl('line.sizes')));
      add(box, el('p', 'field__hint', tl('line.sizesHint')));

      /* 形を選ぶ見本は line-pick.js に置いた（2026-10-23）。
         同じものが LP案ページ（S12）にも要るので、写さずに共有する */
      function pick(kind, value, onPick) {
        if (typeof window.LpyaLinePick !== 'function') {
          console.error('[screens-line] line-pick.js が読み込まれていません');
          return el('p', 'field__hint', tl('line.none'));
        }
        return window.LpyaLinePick({
          kind: kind, value: value, noneLabel: tl('line.none'), onPick: onPick
        });
      }

      var chosen = { menu: String(info.line_menu || ''), msg: String(info.line_msg || '') };
      var fm = el('div', 'field');
      add(fm, el('label', 'field__label', tl('line.menuLabel')));
      add(fm, pick('menu', chosen.menu, function (id) { chosen.menu = id; }));
      add(box, fm);

      var fg = el('div', 'field');
      add(fg, el('label', 'field__label', tl('line.msgLabel')));
      add(fg, pick('message', chosen.msg, function (id) { chosen.msg = id; showH(); }));
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
      function showH() { fh.style.display = chosen.msg === 'カスタム' ? '' : 'none'; }
      showH();

      add(box, button('btn btn--secondary', tl('line.save'), function () {
        var next = {};
        Object.keys(info).forEach(function (k) { next[k] = info[k]; });
        next.line_menu = chosen.menu;
        next.line_msg = chosen.msg;
        /* カスタムのときだけ高さを持つ。決まった形に高さを残すと、
           あとで形を替えたときに古い高さが効いてしまう */
        next.line_msg_h = chosen.msg === 'カスタム'
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
    /* 仕事が走っているあいだ、定期的に読み直して描き直す。
       これが無いと、絵は出来ているのに画面が変わらない。
       「まとめて作る」は10分以上かかるので、終わるまで何も起きないように見える
       （2026-10-18 指摘「生成されても全く表示されない」）。
       画面を離れたら止める */
    var poll = null;
    var pollUntil = 0;
    function startPoll() {
      /* 40分で諦める。押しっぱなしで一日中たたき続けない */
      pollUntil = new Date().getTime() + 40 * 60 * 1000;
      if (poll) { return; }
      poll = window.setInterval(function () {
        if (!document.body.contains(root) || new Date().getTime() > pollUntil) { stopPoll(); return; }
        reload().then(function () {
          paint();
          /* 層ぜんぶの絵がそろったら、もう見に行かない */
          var names2 = Object.keys(view.layers);
          var all = names2.length && names2.every(function (L) {
            var g = view.layers[L];
            var n = Object.keys((g && g.asset_prompts && g.asset_prompts.made) || {}).length;
            return g && isArray(g.sections) && n >= g.sections.length;
          });
          if (all) { stopPoll(); }
        }).catch(function () { /* 次の回で拾う */ });
      }, 20000);
    }
    function stopPoll() {
      if (poll) { window.clearInterval(poll); poll = null; }
    }

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
        startPoll();
        if (!App.watchJob) { reload().then(paint); return; }
        App.watchJob({
          jobId: job.id,
          titleKey: 'job.lineAssets',
          urls: [],
          onDone: function () {
            stopPoll();
            reload().then(function () { toast(tl(doneKey), 'success'); paint(); });
          },
          onFail: function () { stopPoll(); reload().then(paint); }
        });
      }).catch(function (err) {
        console.error('[screens-line] 仕事を積めませんでした:', err);
        toast(t('common.error'), 'danger');
        paint();
      });
    }

    /* 絵をどこで作るか。LP案の画面（S12）と同じ設定（projects.image_via）を見る。
       ここに置いたのは、この画面からも絵を作るから——別の画面まで戻って
       切り替えるのでは、どちらで作っているのか分からないまま押すことになる
       （2026-10-15 要望） */
    function viaSwitch() {
      var box = el('div', 'lp-via');
      var now = String((view.project && view.project.image_via) || '') || 'chatgpt';
      add(box, el('span', 'field__label', tl('line.via')));
      [['chatgpt', 'line.viaBrowser'], ['api', 'line.viaApi']].forEach(function (one) {
        var on = now === one[0];
        var b = button('btn btn--sm ' + (on ? 'btn--primary' : 'btn--secondary'), tl(one[1]), function (e) {
          if (on) { return; }
          var node = e && e.currentTarget;
          if (node) { node.disabled = true; }
          Api.projects.update(projectId, { image_via: one[0] }).then(function (row) {
            view.project = row;
            toast(tl(one[0] === 'api' ? 'line.viaApiOn' : 'line.viaBrowserOn'), 'success');
            paint();
          }).catch(function (err) {
            if (node) { node.disabled = false; }
            console.error('[screens-line] 作り先を変えられませんでした:', err);
            toast(t('common.error'), 'danger');
          });
        });
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        add(box, b);
      });
      add(box, el('span', 'field__hint', tl(now === 'api' ? 'line.viaApiHint' : 'line.viaBrowserHint')));
      return box;
    }

    /* 枠ごとに別の商品を出すか（2026-10-18 要望）。
       「はい」を選んだら、同じ利用者のほかのプロジェクトを並べて選ばせる。
       選んだ順がそのまま枠の順になる */
    function paintPull(box) {
      clear(box);
      var pr = view.project || {};
      var info = (pr.sales_info && typeof pr.sales_info === 'object') ? pr.sales_info : {};
      var chosen = isArray(info.line_projects) ? info.line_projects.slice() : [];
      add(box, el('h3', 'section__title', tl('line.ask')));
      add(box, el('p', 'field__hint', tl('line.askHint')));

      var row = el('div', 'line-ask');
      var on = chosen.length > 0 || view.pullOpen;
      [[false, 'line.askNo'], [true, 'line.askYes']].forEach(function (one) {
        var b = button('btn btn--sm ' + (one[0] === on ? 'btn--primary' : 'btn--secondary'),
          tl(one[1]), function () {
            view.pullOpen = one[0];
            if (!one[0] && chosen.length) { save([]); return; }
            paint();
          });
        b.setAttribute('aria-pressed', one[0] === on ? 'true' : 'false');
        add(row, b);
      });
      add(box, row);
      if (!on) { return; }

      var others = (view.others || []).filter(function (x) { return String(x.id) !== String(projectId); });
      if (!others.length) { add(box, el('p', 'empty', tl('line.noOther'))); return; }
      add(box, el('p', 'field__label', tl('line.pickProjects')));
      var list = el('div', 'line-pull');
      others.forEach(function (o) {
        var at = chosen.indexOf(String(o.id));
        var b = button('line-pull__one' + (at >= 0 ? ' is-on' : ''), '', function () {
          var next = chosen.slice();
          var i = next.indexOf(String(o.id));
          if (i >= 0) { next.splice(i, 1); } else { next.push(String(o.id)); }
          save(next);
        });
        /* 何番目の枠に入るかを出す。選んだ順がそのまま枠の順 */
        add(b, el('span', 'line-pull__no', at >= 0 ? String(at + 2) : '＋'));
        add(b, el('span', 'line-pull__name', String(o.product_name || o.name || '')));
        var cell = el('div', 'line-pull__cell');
        add(cell, b);
        /* 商品ごとに売る場所が違うことがある（2026-10-18 要望）。
           選んだ商品にだけ、掲載先の選び直しを出す */
        if (at >= 0) {
          var pfs = (info.line_project_platforms && typeof info.line_project_platforms === 'object')
            ? info.line_project_platforms : {};
          var now = String(pfs[String(o.id)] || o.cf_platform || '');
          var sel = el('select', 'input input--sm');
          PLATFORMS.forEach(function (one) {
            var op = el('option', '', one[1]);
            op.value = one[0];
            if (one[0] === now) { op.selected = true; }
            add(sel, op);
          });
          sel.addEventListener('change', function () {
            var next = {};
            Object.keys(pfs).forEach(function (k) { next[k] = pfs[k]; });
            next[String(o.id)] = sel.value;
            savePf(next);
          });
          add(cell, sel);
        }
        add(list, cell);
      });
      add(box, list);
      if (chosen.length) { add(box, el('p', 'field__hint', tl('line.pfHint'))); }

      function savePf(next) {
        var patch = {};
        Object.keys(info).forEach(function (k) { patch[k] = info[k]; });
        patch.line_project_platforms = next;
        Api.projects.update(projectId, { sales_info: patch }).then(function (rowP) {
          view.project = rowP;
          toast(tl('line.saved2'), 'success');
          paint();
        }).catch(function (err) {
          console.error('[screens-line] 掲載先を保存できませんでした:', err);
          toast(t('common.error'), 'danger');
        });
      }

      function save(next) {
        var patch = {};
        Object.keys(info).forEach(function (k) { patch[k] = info[k]; });
        patch.line_projects = next;
        Api.projects.update(projectId, { sales_info: patch }).then(function (rowP) {
          view.project = rowP;
          view.pullOpen = next.length > 0;
          toast(tl('line.saved2'), 'success');
          paint();
        }).catch(function (err) {
          console.error('[screens-line] 呼び出す商品を保存できませんでした:', err);
          toast(t('common.error'), 'danger');
        });
      }
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
        /* どの回に足すかはワーカーが決める（いちばん新しい回）。
           ここで空の generation_id を渡していたため、初回は必ず
           「どの回に足すかが指定されていません」で失敗していた
           （実測 2026-10-18） */
        queue('line_brief', view.brief ? { generation_id: view.brief.id } : {}, 'line.briefDone', mk);
      });
      add(box, mk);
      /* 押しても絵が出ない、と受け取られた（2026-10-15）。
         このボタンが何をするボタンなのかを、すぐ下に書く */
      add(box, el('p', 'field__hint', tl('line.briefOnly')));
      if (!view.brief || !isArray(view.brief.sections) || !view.brief.sections.length) {
        add(box, el('p', 'empty', tl('line.noBrief')));
        return;
      }
      /* 層の耳。どの層のぶんを見ているかが分からないと、作ったのに
         「出ていない」と見える。何枚できているかも耳に出す */
      var names = Object.keys(view.layers).sort();
      if (names.length > 1) {
        var tabs = el('div', 'lp-delivs lp-delivs--variants');
        names.forEach(function (L) {
          var g = view.layers[L];
          var n = Object.keys((g && g.asset_prompts && g.asset_prompts.made) || {}).length;
          var tot = (g && isArray(g.sections)) ? g.sections.length : 0;
          var on = L === view.layer;
          var b = button('lp-deliv' + (on ? ' lp-deliv--on' : '') + (n ? '' : ' lp-deliv--empty'), '',
            function () { view.layer = L; view.brief = view.layers[L]; paint(); });
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          add(b, el('span', 'lp-variant__label', L));
          add(b, el('span', 'lp-deliv__count' + (n ? '' : ' is-none'), ' ' + n + '/' + tot));
          add(tabs, b);
        });
        add(box, tabs);
      }
      var made = (view.brief.asset_prompts && view.brief.asset_prompts.made) || {};
      /* 作り直すたびに前の版が history[区画] に積まれている（新しい順・最大10）。
         これまで画面はいまの絵しか出しておらず、前の方がよかったときに
         見返せなかった（2026-10-20 要望「以前生成したものも見れるようにして」） */
      var hist = (view.brief.asset_prompts && view.brief.asset_prompts.history) || {};
      /* その区画で前に作った絵をぜんぶ集める。出どころは2つ:
         1. いまの束の history[区画]（同じ束で作り直した前の版）
         2. 同じ層のほかの束（byLayer が選ばなかったもの）の made と history
         新しい順に並べ、同じURLは1つにまとめる */
      function pastOf(slot) {
        var now = made[slot];
        var out = [];
        var seen = {};
        function push(url, at, prompt) {
          if (!url || url === now || seen[url]) { return; }
          seen[url] = 1;
          out.push({ url: url, at: at || '', prompt: prompt || '' });
        }
        (isArray(hist[slot]) ? hist[slot] : []).forEach(function (h) {
          if (h) { push(h.url, h.at, h.prompt); }
        });
        (view.rows || []).forEach(function (g) {
          if (!g || g.id === view.brief.id) { return; }
          if (String(g.variant_label || '-') !== String(view.brief.variant_label || '-')) { return; }
          var ap = g.asset_prompts || {};
          push((ap.made || {})[slot], g.created_at, ((ap.madePrompt || {})[slot]) || '');
          (isArray((ap.history || {})[slot]) ? ap.history[slot] : []).forEach(function (h) {
            if (h) { push(h.url, h.at, h.prompt); }
          });
        });
        out.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
        return out;
      }

      /* 絵を手元に落とす。置き場は別の出どころなので、<a download> だけでは
         ただ開くだけになる。いったん取ってきてから落とす（ZIPと同じやり方） */
      function saveImage(url, name, node) {
        if (node) { node.disabled = true; }
        return fetch(url).then(function (r) {
          if (!r.ok) { throw new Error(String(r.status)); }
          return r.blob();
        }).then(function (blob) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
        }).catch(function (err) {
          console.error('[screens-line] 落とせませんでした:', err);
          toast(tl('line.saveFail'), 'danger');
        }).then(function () {
          if (node) { node.disabled = false; }
        });
      }

      function nameFor(slot, at, url) {
        var ext = (String(url).match(/\.(png|jpe?g|webp|gif)(\?|$)/i) || [])[1] || 'png';
        var day = String(at || '').slice(0, 10).replace(/-/g, '') || 'now';
        var who = (view.project && (view.project.product_name || view.project.name)) || 'line';
        return String(who).replace(/[^\w-]/g, '') + '-' + slot + '-' + day + '.' + ext;
      }

      /* 前の版を「いまの絵」に戻す。いま置いてある絵は捨てずに history へ送る
         （戻したあと、やっぱり元が良かったときに行き来できる）。
         その版を作った文も一緒に戻す。文が戻らないと同じものを作り直せない */
      function useVersion(slot, h, node) {
        var ap = view.brief.asset_prompts || {};
        var copy = function (o) {
          var out = {};
          Object.keys(o || {}).forEach(function (k) { out[k] = o[k]; });
          return out;
        };
        var made2 = copy(ap.made);
        var hist2 = copy(ap.history);
        var mp = copy(ap.madePrompt);
        var now = made2[slot];
        if (now && now !== h.url) {
          hist2[slot] = [{ url: now, at: new Date().toISOString(), prompt: mp[slot] || '' }]
            .concat(isArray(hist2[slot]) ? hist2[slot] : []).slice(0, 10);
        }
        made2[slot] = h.url;
        if (h.prompt) { mp[slot] = h.prompt; }
        var next = copy(ap);
        next.made = made2;
        next.history = hist2;
        next.madePrompt = mp;
        if (node) { node.disabled = true; }
        Api.generations.update(view.brief.id, { asset_prompts: next }).then(function () {
          view.brief.asset_prompts = next;
          toast(tl('line.useThisDone'), 'success');
          paint();
        }).catch(function (err) {
          if (node) { node.disabled = false; }
          console.error('[screens-line] 戻せませんでした:', err);
          toast(t('common.error'), 'danger');
        });
      }
      /* いま見ている層が空で、絵のある層が他にあるなら、そこへ行けるようにする。
         耳の数字だけでは見落とす */
      if (!Object.keys(made).length) {
        var hasOne = names.filter(function (L) {
          var g = view.layers[L];
          return L !== view.layer
            && Object.keys((g && g.asset_prompts && g.asset_prompts.made) || {}).length;
        })[0];
        if (hasOne) {
          var jump = button('btn btn--text btn--sm', tl('line.goLayer', { v: hasOne }), function () {
            view.layer = hasOne; view.brief = view.layers[hasOne]; paint();
          });
          add(box, jump);
        }
      }
      /* 1枚ずつ押させない。**層ぜんぶ**をまとめて積む。
         開いている層だけだと、他の層が空のままなのに気づけない
         （2026-10-18 指摘「生成されても全く表示されない」の一因） */
      var all = button('btn btn--primary', tl('line.makeAll'), function () {
        var targets = names.map(function (L) { return view.layers[L]; })
          .filter(function (g) { return g && isArray(g.sections) && g.sections.length; });
        if (!targets.length) { return; }
        all.disabled = true;
        all.textContent = tl('line.making');
        startPoll();
        Promise.all(targets.map(function (g) {
          return Api.generationJobs.insert({
            feature_key: 'lp_section',
            status: 'pending',
            projects_id: projectId,
            users_id: userId(),
            /* feature_key も渡す。案が入れ替わっていたとき、ワーカーが
               同じ種類のいちばん新しい案に回せる（2026-10-18） */
            payload: { generation_id: g.id, feature_key: 'line_brief',
              sections: g.sections.map(function (x) { return x.index; }), force: true },
            lang: currentLocale()
          });
        })).then(function (jobs) {
          /* 見張るのは**最初の1件**だけにする。層ごとに1件ずつ積むので、
             どれか1件が失敗しただけで「ぜんぶ失敗した」ように見えていた
             （2026-10-18: 5件のうち1件の失敗の窓が出たまま残った）。
             残りは裏で進み、20秒ごとの読み直しで画面に出る */
          var first = jobs[0];
          if (!App.watchJob || !first) { reload().then(paint); return; }
          App.watchJob({
            jobId: first.id,
            titleKey: 'job.lineAssets',
            urls: [],
            onDone: function () { reload().then(function () { paint(); }); },
            /* 1件こけても、他の層は作り続ける。見張りだけ外して読み直す */
            onFail: function () { reload().then(paint); }
          });

        }).catch(function (err) {
          stopPoll();
          console.error('[screens-line] まとめて積めませんでした:', err);
          toast(t('common.error'), 'danger');
          paint();
        });
      });
      add(box, all);
      /* 押す前に、どれくらい待つかと、いくらかを出す（2026-10-25）。
         実測では絵づくりが中央値9分・上位10%で106分と幅が大きい。
         言わないと「固まった」と思って押し直される。
         値段も、知らずに押すと5層×2枚＝10枚ぶん一気に進む */
      if (window.LpyaJobEta) {
        var eta = window.LpyaJobEta.hint('lp_section', t);
        if (eta) { add(box, el('p', 'field__hint', eta)); }
      }
      if (window.LpyaCost) {
        var sheets = names.reduce(function (n, L) {
          var g = view.layers[L];
          return n + ((g && isArray(g.sections)) ? g.sections.length : 0);
        }, 0);
        window.LpyaCost.attach(box, 'line_contents', { t: t, count: sheets });
      }
      var grid = el('div', 'line-grid');
      view.brief.sections.forEach(function (sec) {
        var slot = String(sec.index) + '-1';
        var url = made[slot];
        var card = el('div', 'line-card');
        add(card, el('h3', 'line-card__title', String(sec.title || '')));
        /* 生成文を見せ、足せるようにする（2026-10-18 要望）。
           **題と写真のあいだ**に置く。絵を作る前に読みたいので、
           写真の下だと、まだ絵が無いときに見つけにくい。
           自動で作る部分は読むだけ。足したい指示は別に持つので、
           作り直しても消えない */
        var det = el('details', 'line-prompt');
        add(det, el('summary', 'line-prompt__sum', tl('line.prompt')));
        add(det, el('p', 'field__label', tl('line.promptBase')));
        if (sec.edited) { add(det, el('p', 'chip chip--sm', tl('line.promptEdited'))); }
        /* 2026-10-18 要望:「この欄の中で修正できるようにして」。
           読むだけの枠をやめ、そのまま直せる入力欄にする */
        var base = el('textarea', 'input line-prompt__base');
        base.rows = 10;
        base.value = String(sec.prompt || '');
        add(det, base);
        add(det, el('p', 'field__label', tl('line.promptAdd')));
        var ta = el('textarea', 'input line-prompt__add');
        ta.rows = 3;
        ta.value = String(sec.addon || '');
        ta.setAttribute('placeholder', tl('line.promptAddPh'));
        add(det, ta);
        add(det, el('p', 'field__hint', tl('line.promptHint')));
        var sv = button('btn btn--secondary btn--sm', tl('line.promptSave'), function () {
          sv.disabled = true;
          var next = (view.brief.sections || []).map(function (x) {
            if (Number(x.index) !== Number(sec.index)) { return x; }
            var copy = {};
            Object.keys(x).forEach(function (k) { copy[k] = x[k]; });
            copy.addon = ta.value.trim();
            /* 本文に手が入っていたら、その印を付ける。
               印があるものは、作り直しで上書きしない */
            var body = base.value.trim();
            if (body && body !== String(sec.prompt || '').trim()) {
              copy.prompt = body;
              copy.edited = true;
            }
            return copy;
          });
          Api.generations.update(view.brief.id, { sections: next }).then(function () {
            view.brief.sections = next;
            toast(tl('line.promptSaved'), 'success');
            paint();
          }).catch(function (err) {
            sv.disabled = false;
            console.error('[screens-line] 指示を保存できませんでした:', err);
            toast(t('common.error'), 'danger');
          });
        });
        add(det, sv);
        /* 手で直したものを、自動の文に戻せるようにする。
           戻せないと、直したあと自動の更新を受け取れなくなる */
        if (sec.edited) {
          add(det, button('btn btn--text btn--sm', tl('line.promptReset'), function () {
            var next2 = (view.brief.sections || []).map(function (x) {
              if (Number(x.index) !== Number(sec.index)) { return x; }
              var copy2 = {};
              Object.keys(x).forEach(function (k) { if (k !== 'edited') { copy2[k] = x[k]; } });
              return copy2;
            });
            Api.generations.update(view.brief.id, { sections: next2 }).then(function () {
              view.brief.sections = next2;
              toast(tl('line.promptResetDone'), 'success');
              paint();
            }).catch(function (err) {
              console.error('[screens-line] 戻せませんでした:', err);
              toast(t('common.error'), 'danger');
            });
          }));
        }
        add(card, det);
        /* 写真は生成文のあと。
           見せ方は LP案ページと同じ（2026-10-23 要望）。shot-carousel.js を
           両方から使う。版を左右に送れて、いま使う版が分かり、
           その版を作った文もその場で読める */
        if (url) {
          var madeP = (view.brief.asset_prompts && view.brief.asset_prompts.madePrompt) || {};
          var shots = [{ url: url, at: '', prompt: madeP[slot] || '' }].concat(pastOf(slot));
          if (view.shotAt[slot] === undefined || view.shotAt[slot] >= shots.length) {
            view.shotAt[slot] = 0;
          }
          var car = window.LpyaShotCarousel({
            shots: shots,
            at: view.shotAt[slot],
            currentPrompt: sec.prompt || '',
            labels: {
              now: tl('line.shotNow'), restore: tl('line.useThis'), zoom: tl('line.open'),
              prev: tl('line.prev'), next: tl('line.next'),
              prompt: tl('line.shotPrompt'), promptNone: tl('line.shotPromptNone'),
              promptUse: tl('line.shotPromptUse'), copy: tl('line.copy')
            },
            onZoom: function (u) {
              if (!App || typeof App.openViewer !== 'function') { return; }
              App.openViewer([{ type: 'image', src: u, label: String(sec.title || '') }], 0);
            },
            onMove: function (n) { view.shotAt[slot] = n; },
            /* 0番目以外を選んだら、その版をいまの絵にする */
            onRestore: function (i, shot) { useVersion(slot, shot); },
            onUsePrompt: function (was) {
              base.value = was;
              toast(tl('line.shotPromptUsed'), 'success');
            },
            onCopy: function (was) {
              if (navigator.clipboard) { navigator.clipboard.writeText(was); }
            }
          });
          add(card, car.node);

          var dl = button('btn btn--text btn--sm', t('common.download'), function () {
            saveImage(shots[view.shotAt[slot]].url,
              nameFor(slot, shots[view.shotAt[slot]].at, shots[view.shotAt[slot]].url), dl);
          });
          add(card, dl);
        }
        var b = button('btn btn--primary btn--sm', url ? tl('line.remake') : tl('line.make'), function () {
          queue('lp_section',
            { generation_id: view.brief.id, feature_key: 'line_brief',
              sections: [sec.index], force: !!url },
            'line.briefDone', b);
        });
        add(card, b);
        add(grid, card);
      });
      add(box, grid);
    }

    /* 押せる面（areas）。画像だけではLINEに登録できないので、
       枠ごとの行き先を入れて JSON で落とせるようにする（2026-10-19）。
       枠の形は line-layouts.js が持っているので、座標はそこから出す */
    function paintAreas(box) {
      clear(box);
      var pr = view.project || {};
      var info = (pr.sales_info && typeof pr.sales_info === 'object') ? pr.sales_info : {};
      var id = String(info.line_menu || '');
      if (!id) { return; }
      var L = layouts('menu').filter(function (x) { return x.id === id; })[0];
      if (!L) { return; }
      add(box, el('h2', 'section__title', tl('line.areas')));
      add(box, el('p', 'field__hint', tl('line.areasHint')));
      var links = isArray(info.line_links) ? info.line_links.slice() : [];
      var rows = [];
      L.cells.forEach(function (c, i) {
        var one = links[i] || {};
        var f = el('div', 'line-area');
        add(f, el('span', 'line-area__no', tl('line.areasCell', { n: i + 1 })));
        var lb = el('input', 'input input--sm');
        lb.type = 'text';
        lb.value = String(one.label || '');
        lb.setAttribute('placeholder', tl('line.areasLabel'));
        var ur = el('input', 'input input--sm');
        ur.type = 'url';
        ur.value = String(one.uri || '');
        ur.setAttribute('placeholder', tl('line.areasUri'));
        add(f, lb);
        add(f, ur);
        add(box, f);
        rows.push({ lb: lb, ur: ur });
      });
      var save = button('btn btn--secondary btn--sm', tl('line.areasSave'), function () {
        var next = rows.map(function (r) {
          return { label: r.lb.value.trim(), uri: r.ur.value.trim() };
        });
        var patch = {};
        Object.keys(info).forEach(function (k) { patch[k] = info[k]; });
        patch.line_links = next;
        Api.projects.update(projectId, { sales_info: patch }).then(function (rowP) {
          view.project = rowP;
          toast(tl('line.areasSaved'), 'success');
          paint();
        }).catch(function (err) {
          console.error('[screens-line] 行き先を保存できませんでした:', err);
          toast(t('common.error'), 'danger');
        });
      });
      add(box, save);
      add(box, button('btn btn--primary btn--sm', tl('line.areasGet'), function () {
        var obj = menuObject(L, rows.map(function (r) {
          return { label: r.lb.value.trim(), uri: r.ur.value.trim() };
        }), String(pr.product_name || pr.name || ''));
        var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
        var a = el('a', '');
        a.href = URL.createObjectURL(blob);
        a.download = 'richmenu-' + id.replace(/[^\w+-]/g, '') + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      }));
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

    var viaBox = add(body, el('div', 'line-via'));
    var sizeBox = add(body, el('section', 'section'));
    var pullBox = add(body, el('section', 'section'));
    var imgBox = add(body, el('section', 'section'));
    var areaBox = add(body, el('section', 'section'));
    var textBox = add(body, el('section', 'section'));

    function paint() {
      clear(viaBox);
      add(viaBox, viaSwitch());
      paintSizes(sizeBox);
      paintPull(pullBox);
      paintImages(imgBox);
      paintAreas(areaBox);
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
