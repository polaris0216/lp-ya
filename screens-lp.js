/* =============================================================================
 * screens-lp.js — S12 生成プロンプト（マスターブリーフと区画ごとの生成）
 *
 * ttalkkak-ai と同じ形。
 *   上: マスターブリーフ（LP全体の決まり。折りたたみ）
 *   下: 区画ごとのカード。プロンプトはその場で直せる。
 *       「この区画を生成」で1枚ずつ作り、できた絵がカードに入る。
 *   全部できたら「キャンバスに並べる」で S13 へ。
 *
 * 作る入口は総合分析（S20）の「LP・KVプロンプトを生成」。
 * 区画の生成は lp_section（ワーカー）。OpenAI の gpt-image-2 で、
 * 切り抜いた商品写真を全部添付し、日本語を絵の中に焼く。
 *
 * 画面登録   App.registerScreen('S12', { render })
 * URL        #/S12?id=<プロジェクトID>&gen=<生成物ID>
 * ========================================================================== */
(function () {
  'use strict';

  var App = window.App = window.App || {};
  var LOCALES = ['ja', 'en', 'ko'];
  var FEATURE = 'lp_brief';
  /* 成果物の種類。どれも同じ形（sections ＋ content.brief）で保存してあるので、
     画面の作りは種類で変えず、どの束を見るかだけを切り替える */
  var KINDS = [
    { key: 'lp_brief', label: 'lp.kindLp' },
    { key: 'kv_brief', label: 'lp.kindKv' },
    { key: 'ads_brief', label: 'lp.kindAds' }
  ];

  var LOCAL = {
    'lp.title': ['生成プロンプト', 'Generation prompts', '생성 프롬프트'],
    'lp.lead': ['総合分析から書いたマスターブリーフ（LP全体の決まり）と、区画ごとの生成プロンプトです。プロンプトを直してから、区画ごとに生成します。',
      'The master brief (page-wide rules) and one prompt per section, written from the overall analysis. Edit, then generate section by section.',
      '종합 분석에서 쓴 마스터 브리프(LP 전체 규칙)와 구획별 생성 프롬프트입니다. 고친 뒤 구획마다 생성합니다.'],
    'lp.empty': ['まだ生成プロンプトがありません。', 'No prompts yet.', '아직 생성 프롬프트가 없습니다.'],
    'lp.emptyHint': ['総合分析のページで「LP・KVプロンプトを生成」を押してください。',
      'Press "Generate LP/KV prompts" on the overall analysis page.',
      '종합 분석 페이지에서 "LP·KV 프롬프트 생성"을 누르세요.'],
    'lp.toAnalysis': ['総合分析へ', 'To the overall analysis', '종합 분석으로'],
    'lp.brief': ['マスターブリーフ（LP全体の決まり）', 'Master brief (page-wide rules)', '마스터 브리프(LP 전체 규칙)'],
    'lp.briefOpen': ['開く', 'Open', '열기'],
    'lp.briefClose': ['閉じる', 'Close', '닫기'],
    'lp.copy': ['コピー', 'Copy', '복사'],
    'lp.copied': ['コピーしました', 'Copied', '복사했습니다'],
    'lp.sections': ['区画', 'Sections', '구획'],
    'lp.section': ['区画 {n}', 'Section {n}', '구획 {n}'],
    'lp.prompt': ['生成プロンプト', 'Prompt', '생성 프롬프트'],
    'lp.gen': ['この区画を生成', 'Generate this section', '이 구획 생성'],
    'lp.regen': ['作り直す', 'Regenerate', '다시 생성'],
    'lp.generating': ['生成しています…', 'Generating…', '생성 중…'],
    'lp.genAll': ['全区画をまとめて生成', 'Generate all sections', '모든 구획 한꺼번에 생성'],
    'lp.makeAssets': ['動く絵を生成する', 'Generate motion visuals', '움직이는 소재 생성'],
    'lp.makeAssetsRunning': ['生成しています…', 'Generating…', '생성 중…'],
    'lp.makeAssetsQueued': ['動く絵の生成を積みました', 'Queued the motion generation', '움직이는 소재 생성을 예약했습니다'],
    'lp.makeAssetsDone': ['動く絵ができました。組み直すと本文に入ります。',
      'Motion visuals are ready. Rebuild to place them in the page.',
      '움직이는 소재가 준비되었습니다. 다시 조립하면 본문에 들어갑니다.'],
    'lp.genAllRedo': ['全区画を作り直す', 'Regenerate all sections', '모든 구획 다시 생성'],
    'lp.genAllRedoConfirm': ['{n} 区画をすべて作り直します。今の絵は上書きされます。よろしいですか？', 'Regenerate all {n} sections? Current images will be replaced.', '{n}개 구획을 모두 다시 생성합니다. 지금의 이미지는 덮어씌워집니다. 진행할까요?'],
    'lp.genAllHint': ['未生成の区画を同時並行で作ります（4枚ずつ）。1枚 30〜55秒。', 'Generates remaining sections in parallel (4 at a time), 30–55 s each.', '미생성 구획을 동시에 만듭니다(4장씩). 장당 30~55초.'],
    'lp.genAllRunning': ['まとめて生成しています…', 'Generating all…', '한꺼번에 생성 중…'],
    'lp.save': ['プロンプトを保存', 'Save prompts', '프롬프트 저장'],
    'lp.saved': ['保存しました', 'Saved', '저장했습니다'],
    'lp.canvas': ['キャンバスに並べる', 'Lay out on canvas', '캔버스에 배치'],
    'lp.progress': ['{done}/{total} 区画が完成', '{done}/{total} sections done', '{done}/{total} 구획 완료'],
    'lp.queued': ['生成を積みました', 'Queued', '생성을 예약했습니다'],
    'lp.genDone': ['区画ができました', 'Section generated', '구획이 생성되었습니다'],
    'lp.refs': ['商品の見本（全区画に添付・最大16枚）', 'Product references (attached to every section, up to 16)', '상품 견본(모든 구획에 첨부·최대 16장)'],
    'lp.addRefs': ['見本を増やす（商品入力で☆）', 'Add references (star photos in Product input)', '견본 추가(상품 입력에서 ☆)'],
    'lp.refsStale': ['☆の写真が {n} 枚ありますが、見本は {m} 枚です。作り直すと追いつきます。', '{n} starred photos but {m} references. Rebuild to catch up.', '☆ 사진 {n}장 중 견본은 {m}장입니다. 다시 만들면 맞춰집니다.'],
    'lp.rebuildRefs': ['見本を作り直す', 'Rebuild references', '견본 다시 만들기'],
    'lp.rebuildRefsQueued': ['見本を作り直しています。1分ほどで揃います。', 'Rebuilding references; about a minute.', '견본을 다시 만드는 중입니다. 1분 정도 걸립니다.'],
    'lp.noRefs': ['切り抜きがありません。商品入力で商品が写っている写真に☆を付けると、自動で切り抜きます。',
      'No cutouts yet. Star product photos in Product input; they are cut out automatically.',
      '잘라낸 사진이 없습니다. 상품 입력에서 상품 사진에 ☆를 붙이면 자동으로 잘라냅니다.'],
    'lp.target': ['ターゲット層', 'Target', '타깃층'],
    'lp.history': ['前の版 {n}', 'Previous {n}', '이전 버전 {n}'],
    'lp.restore': ['この版に戻す', 'Use this version', '이 버전으로 되돌리기'],
    'lp.restored': ['前の版に戻しました', 'Restored', '이전 버전으로 되돌렸습니다'],
    'lp.historyOpen': ['履歴を見る', 'Show history', '이력 보기'],
    'lp.historyClose': ['履歴を閉じる', 'Hide history', '이력 닫기'],
    'lp.prevShot': ['前の版', 'Previous', '이전'],
    'lp.nextShot': ['次の版', 'Next', '다음'],
    'lp.shotNow': ['いま使う版', 'In use', '사용 중'],
    'lp.shotZoom': ['大きく見る', 'Open larger', '크게 보기'],
    'lp.motion': ['動く絵', 'Motion', '움직이는 소재'],
    'lp.kindLp': ['LP', 'LP', 'LP'],
    'lp.kindKv': ['KV', 'KV', 'KV'],
    'lp.kindAds': ['メタ広告', 'Meta ads', '메타 광고'],
    'lp.unsure': ['見本と違うかもしれません', 'May not match the product', '견본과 다를 수 있습니다'],
    'lp.motionPick': ['動きが向く区画', 'Good for motion', '움직임이 어울리는 구획'],
    'lp.motionMake': ['この区画のGIFを作る', 'Make the GIF', '이 구획 GIF 만들기'],
    'lp.motionRedo': ['GIFを作り直す', 'Remake the GIF', 'GIF 다시 만들기'],
    'lp.motionRunning': ['作っています…', 'Making…', '만드는 중…'],
    'lp.motionDone': ['動く絵ができました', 'The motion asset is ready', '움직이는 소재가 완성되었습니다'],
    'lp.kindEmpty': ['この種類はまだ作られていません。総合分析から作り直すと一緒に作られます。',
      'Nothing here yet. Regenerate from the overall analysis to produce it.',
      '아직 없습니다. 종합 분석에서 다시 만들면 함께 생성됩니다.'],
    'lp.stale': ['商品入力・ターゲット層・競合分析のどれかが変わっています。生成プロンプトを今の設定で書き直しますか？（数分。区画の絵はそのまま残り、作り直すときに新しいプロンプトが使われます）',
      'Product input, targets, or competitor analysis changed since these prompts were written. Rewrite with the current settings? (A few minutes. Existing images stay; regenerate to apply.)',
      '상품 입력·타깃층·경쟁 분석 중 하나가 바뀌었습니다. 지금 설정으로 프롬프트를 다시 쓸까요? (몇 분. 기존 이미지는 남고, 다시 만들 때 새 프롬프트가 쓰입니다)'],
    'lp.rewrite': ['生成プロンプトを更新する', 'Update the prompts', '프롬프트 업데이트'],
    'lp.rewriteQueued': ['書き直しています。数分で新しい回が増えます。', 'Rewriting; a new round will appear in a few minutes.', '다시 쓰는 중입니다. 몇 분 뒤 새 회차가 추가됩니다.'],
    'lp.missing': ['この回に無い層', 'Missing from this round', '이 회차에 없는 층'],
    'lp.genLayer': ['{L} だけ生成', 'Generate {L} only', '{L}만 생성'],
    'lp.genLayerQueued': ['{L} のプロンプトを書いています（1分ほど）', 'Writing prompts for {L} (about a minute)', '{L}의 프롬프트를 쓰는 중(1분 정도)'],
  };

  if (typeof App.registerScreen !== 'function') {
    console.error('[screens-lp] App.registerScreen が見つかりません。index.html の読み込み順を確認してください。');
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
    if (typeof App.toast === 'function') { App.toast(message, kind); } else { console.log('[screens-lp]', kind, message); }
  }
  function setHeader(title) {
    var titleNode = document.getElementById('header-title');
    var backNode = document.getElementById('header-back');
    var actionNode = document.getElementById('header-action');
    if (titleNode) { titleNode.textContent = title; }
    if (backNode) { backNode.hidden = false; }
    if (actionNode) { clear(actionNode); }
  }
  function isArray(v) { return Array.isArray(v); }

  App.registerScreen('S12', {
    render: function (root, params) {
      params = params || {};
      var projectId = params.id || (window.Api && Api.storage && Api.storage.get('projectId')) || '';
      setHeader(t('lp.title'));
      clear(root);
      if (!projectId) { add(root, el('p', 'empty', t('lp.noProject'))); return; }

      /* shotAt は区画ごとに「いま何番目の版を見ているか」。paint() で作り直しても
         見ていた版に戻れるよう、描画の外に持つ */
      var view = { project: null, gens: [], gen: null, dirty: false, busy: {}, shotAt: {},
        kind: 'lp_brief', byKind: {} };
      var screen = el('div', 'screen');
      var head = el('header', 'screen__head');
      add(head, el('h2', 'screen__title', t('lp.title')));
      add(head, el('p', 'screen__lead', t('lp.lead')));
      add(screen, head);
      var toolbar = el('div', 'lp-toolbar');
      add(screen, toolbar);
      var body = el('div', 'lp-body');
      add(screen, body);
      add(root, screen);

      Promise.all([
        Api.projects.get(projectId),
        /* 3種類をまとめて取る。in の絞り込みが api に無いので、種類ごとに引く */
        Promise.all(KINDS.map(function (k) {
          return Api.generations.list({ eq: { projects_id: projectId, feature_key: k.key },
            order: 'created_at.desc', limit: 20 }).catch(function () { return []; });
        })),
        (window.Api && Api.analysisReports && typeof Api.analysisReports.first === 'function')
          ? Api.analysisReports.first({ eq: { projects_id: projectId, analysis_status: 'done' }, order: 'created_at.desc' }).catch(function () { return null; })
          : Promise.resolve(null)
      ]).then(function (got) {
        view.project = got[0];
        var lists = isArray(got[1]) ? got[1] : [];
        KINDS.forEach(function (k, i) { view.byKind[k.key] = isArray(lists[i]) ? lists[i] : []; });
        view.gens = view.byKind[view.kind] || [];
        view.report = got[2] || null;
        /* 何も指定が無ければ、いちばん新しい回の A 層から見せる。
           created_at の降順で並んでいるので、素直に先頭を取ると
           最後に書かれた層（E）が開く（実測） */
        view.gen = params.gen
          ? (view.gens.filter(function (g) { return g.id === params.gen; })[0] || firstVariant(view.gens))
          : firstVariant(view.gens);
        paint();
      }).catch(function (err) {
        console.error('[screens-lp] 読み込みに失敗:', err);
        add(body, el('p', 'empty', String(err && err.message || err)));
      });

      /* 種類を切り替える。同じ層が向こうにもあればそれを開く
         （A を見ていたのに、切り替えたら E が出る、を避ける） */
      function switchKind(key) {
        if (view.kind === key) { return; }
        var want = view.gen ? String(view.gen.variant_label || '') : '';
        view.kind = key;
        view.gens = view.byKind[key] || [];
        view.shotAt = {};
        var same = want
          ? view.gens.filter(function (g) { return String(g.variant_label || '') === want; })[0]
          : null;
        view.gen = same || firstVariant(view.gens);
        view.dirty = false;
        paint();
      }

      /* いちばん新しい回の、いちばん若い層を返す。
         回は content.batch でまとまっている。層の記号（A〜E）が小さい順 */
      function firstVariant(list) {
        if (!isArray(list) || !list.length) { return null; }
        var newest = list[0];
        var batch = newest.content && newest.content.batch;
        var same = batch
          ? list.filter(function (g) { return g.content && g.content.batch === batch; })
          : list.slice();
        var sorted = same.slice().sort(function (x, y) {
          return String(x.variant_label || '').localeCompare(String(y.variant_label || ''));
        });
        return sorted[0] || newest;
      }

      /* 画面を作り直す。中身を全部捨てて建て直すので、そのままだと
         見ていた場所を失って先頭へ飛ぶ。位置を覚えて戻す
         （実測: 版を切り替えるたびにページの一番上へ戻っていた）。
         高さが変わることもあるので、書き終わってから戻す */
      function paint() {
        var keepY = window.scrollY || window.pageYOffset || 0;
        clear(toolbar);
        clear(body);
        if (keepY) {
          window.requestAnimationFrame(function () { window.scrollTo(0, keepY); });
        }
        add(toolbar, button('btn btn--secondary', t('lp.toAnalysis'), function () {
          location.hash = '#/S20?id=' + encodeURIComponent(projectId);
        }));
        /* 種類の切り替え（LP / KV / 広告）。中身が無い種類も押せるようにして、
           「まだ作られていない」と言う。押せないと、無いのか壊れたのか分からない */
        var kinds = el('div', 'lp-delivs');
        KINDS.forEach(function (k) {
          var on = view.kind === k.key;
          var has = (view.byKind[k.key] || []).length;
          var b = button('lp-deliv' + (on ? ' lp-deliv--on' : '') + (has ? '' : ' lp-deliv--empty'),
            t(k.label), function () { switchKind(k.key); });
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          add(kinds, b);
        });
        add(toolbar, kinds);

        if (!view.gen) {
          add(body, el('p', 'empty',
            view.kind === 'lp_brief' ? t('lp.empty') : t('lp.kindEmpty')));
          if (view.kind === 'lp_brief') { add(body, el('p', 'field__hint', t('lp.emptyHint'))); }
          return;
        }
        /* 層の切り替え。タブは必ず出す。
           同じ回（content.batch が同じ）にその層があればそれを、無ければ
           その層のいちばん新しい1本に飛ぶ。1層だけの回（昔の A のみの回）を
           選んでもタブが消えないようにする（実測: 過去の回を選ぶと
           タブごと消えて、他の層に戻れなくなっていた） */
        var myBatch = view.gen.content && view.gen.content.batch;
        var batch = view.gens.filter(function (g) {
          if (myBatch) { return g.content && g.content.batch === myBatch; }
          return (g.created_at || '').slice(0, 16) === (view.gen.created_at || '').slice(0, 16);
        });
        var byLabel = {};
        batch.forEach(function (g) { byLabel[String(g.variant_label || '-')] = g; });
        var labels = [];
        view.gens.forEach(function (g) {
          var L = String(g.variant_label || '-');
          if (labels.indexOf(L) === -1) { labels.push(L); }
        });
        labels.sort();
        if (labels.length) {
          var tabs = el('div', 'lp-variants');
          labels.forEach(function (L) {
            /* この回に無い層は、その層の最新へ */
            var g = byLabel[L] || view.gens.filter(function (x) { return String(x.variant_label || '-') === L; })[0];
            if (!g) { return; }
            var on = g.id === view.gen.id;
            var inRound = !!byLabel[L];
            var b = button('lp-variant' + (on ? ' lp-variant--on' : '') + (inRound ? '' : ' lp-variant--faded'), '',
              function () { view.gen = g; view.dirty = false; paint(); });
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
            if (!inRound) { b.title = String(g.created_at || '').slice(0, 16).replace('T', ' '); }
            add(b, el('span', 'lp-variant__label', L));
            add(b, el('span', 'lp-variant__name', String(g.title || '').slice(0, 28)));
            add(tabs, b);
          });
          add(toolbar, tabs);
        }
        /* この回に無い層（書けなかった・失敗した層）。その層だけ書き直せる。
           できた1本は join_batch でこの回に合流するので、タブに揃って出る */
        var targetLabels = (isArray(view.project && view.project.targets) ? view.project.targets : [])
          .map(function (tg) { return String(tg.label || '-'); });
        var missing = targetLabels.filter(function (L) { return !byLabel[L]; });
        if (missing.length && myBatch) {
          var missRow = el('div', 'lp-toolbar');
          add(missRow, el('span', 't-note', t('lp.missing') + ':'));
          missing.forEach(function (L) {
            add(missRow, button('btn btn--secondary btn--sm', t('lp.genLayer', { L: L }), function (e) {
              var node = e.currentTarget;
              node.disabled = true;
              Api.generationJobs.insert({
                feature_key: 'lp_brief', status: 'pending', projects_id: projectId,
                report_id: (view.report && view.report.id) || null,
                users_id: (window.Api && Api.auth && typeof Api.auth.userId === 'function') ? Api.auth.userId() : undefined,
                payload: { only: L, join_batch: myBatch },
                lang: currentLocale()
              }).then(function (job) {
                toast(t('lp.genLayerQueued', { L: L }), 'success');
                if (App.watchJob) {
                  App.watchJob({ jobId: job.id, titleKey: 'ov.makeLpTitle', urls: [], onDone: function () {
                    Api.generations.list({ eq: { projects_id: projectId, feature_key: FEATURE }, order: 'created_at.desc', limit: 20 })
                      .then(function (rows) {
                        view.gens = isArray(rows) ? rows : [];
                        var mine = view.gens.filter(function (g) { return g.content && g.content.batch === myBatch && String(g.variant_label || '-') === L; })[0];
                        if (mine) { view.gen = mine; }
                        paint();
                      });
                  } });
                }
              }).catch(function (err) { node.disabled = false; toast(String(err && err.message || err), 'danger'); });
            }));
          });
          add(toolbar, missRow);
        }
        /* 過去の回。回ごとに先頭の1本を出し、選ぶとその回の層に切り替わる */
        var rounds = [];
        var seen = {};
        view.gens.forEach(function (g) {
          var key = (g.content && g.content.batch) || (g.created_at || '').slice(0, 16);
          if (seen[key]) { return; }
          seen[key] = 1;
          rounds.push({ key: key, gen: g });
        });
        if (rounds.length > 1) {
          var pick = el('select', 'select lp-history-select');
          rounds.forEach(function (r) {
            var o = el('option', null, String(r.gen.created_at || '').slice(0, 16).replace('T', ' '));
            o.value = r.key;
            var mine = (view.gen.content && view.gen.content.batch) || (view.gen.created_at || '').slice(0, 16);
            if (r.key === mine) { o.selected = true; }
            add(pick, o);
          });
          pick.addEventListener('change', function () {
            var r = rounds.filter(function (x) { return x.key === pick.value; })[0];
            if (r) { view.gen = r.gen; view.dirty = false; paint(); }
          });
          add(toolbar, pick);
        }
        var save = button('btn btn--secondary', t('lp.save'), saveEdits);
        save.disabled = !view.dirty;
        save.id = 'lp-save';
        add(toolbar, save);
        /* 未生成があれば「残りをまとめて生成」、全部できていれば「全区画を作り直す」。
           前は全部できると押せなくなり、直したプロンプトで作り直せなかった */
        var remaining = (view.gen.sections || []).filter(function (s) { return !made()[String(s.index) + '-1']; }).length;
        var anyBusy = Object.keys(view.busy).length > 0;
        var label = anyBusy ? t('lp.genAllRunning')
          : (remaining ? t('lp.genAll') + '（' + remaining + '）' : t('lp.genAllRedo'));
        var all = button('btn btn--primary', label, function () {
          if (remaining) { generate(null); return; }
          var n = (view.gen.sections || []).length;
          if (window.confirm(t('lp.genAllRedoConfirm', { n: n }))) { generate('all'); }
        });
        all.disabled = anyBusy;
        /* 静止画は lp_section（OpenAI の画面）、動く絵は lp_assets（Replicate の
           seedance-2.5）と作る先が別なので、ボタンも分ける。
           押したときの案を指すので、層を切り替えてから押せばその層ぶんが作られる */
        add(toolbar, button('btn btn--secondary', t('lp.makeAssets'), function (e) {
          startAssets(e.currentTarget);
        }));
        all.title = t('lp.genAllHint');
        add(toolbar, all);
        var done = doneCount();
        var total = (view.gen.sections || []).length;
        var toCanvas = button('btn btn--secondary', t('lp.canvas'), function () {
          location.hash = '#/S13?id=' + encodeURIComponent(projectId) + '&gen=' + encodeURIComponent(view.gen.id) + '&build=1';
        });
        toCanvas.disabled = done === 0;
        add(toolbar, toCanvas);
        add(toolbar, el('span', 't-note', t('lp.progress', { done: done, total: total })));

        paintStale();
        paintBrief();
        paintRefs();
        paintSections();
      }

      /* 設定が変わったら知らせる。自動では書き直さない（数分かかり、絵の作り直しにも費用がかかる）。
         ブリーフを書いたときの材料の印（content.stamp）と、今の材料の印を比べる */
      function paintStale() {
        var c = content();
        if (!c.stamp || !window.BriefStamp) { return; }
        var now = window.BriefStamp.stampOf(view.project, view.report);
        if (now === c.stamp) { return; }
        var box = el('section', 'panel lp-stale');
        add(box, el('p', 'lp-notice__warn', t('lp.stale')));
        add(box, button('btn btn--primary', t('lp.rewrite'), function (e) {
          var node = e.currentTarget;
          node.disabled = true;
          Api.generationJobs.insert({
            feature_key: 'lp_brief', status: 'pending', projects_id: projectId,
            report_id: view.report ? view.report.id : null,
            users_id: (window.Api && Api.auth && typeof Api.auth.userId === 'function') ? Api.auth.userId() : undefined,
            payload: {}, lang: currentLocale()
          }).then(function (job) {
            toast(t('lp.rewriteQueued'), 'success');
            if (App.watchJob) {
              App.watchJob({ jobId: job.id, titleKey: 'ov.makeLpTitle', urls: [], onDone: function () {
                location.hash = '#/S12?id=' + encodeURIComponent(projectId);
                location.reload();
              } });
            }
          }).catch(function (err) { node.disabled = false; toast(String(err && err.message || err), 'danger'); });
        }));
        add(body, box);
      }

      function content() { return view.gen.content && typeof view.gen.content === 'object' ? view.gen.content : {}; }
      function made() { var a = view.gen.asset_prompts && view.gen.asset_prompts.made; return a && typeof a === 'object' ? a : {}; }
      /* AI が「ここは動かした方がよい」と書いた区画。ブリーフが区画の指示に
         「動き: GIF」「動き: 動画」と入れる。読み方は tools/asset-orders.mjs と同じ */
      /* 照合を通らなかったが残した区画。捨てずに見て決めてもらう */
      function unsure() { var a = view.gen.asset_prompts && view.gen.asset_prompts.unsure; return a && typeof a === 'object' ? a : {}; }

      function motionPick(sec) {
        var m = String((sec && sec.prompt) || '').match(/動き\s*[:：]\s*(GIF|ＧＩＦ|gif|動画|ビデオ)/);
        if (!m) { return ''; }
        return /動画|ビデオ/.test(m[1]) ? 'video' : 'gif';
      }
      /* 動く絵は静止画と別の置き場。同じ場所に入れていたら、動画を作ると
         静止画が消えていた（実測） */
      function motion() { var a = view.gen.asset_prompts && view.gen.asset_prompts.motion; return a && typeof a === 'object' ? a : {}; }
      function doneCount() {
        var m = made();
        return (view.gen.sections || []).filter(function (s) { return !!m[String(s.index) + '-1']; }).length;
      }

      /* マスターブリーフ。長いので折りたたみ。コピーできる */
      function paintBrief() {
        var c = content();
        var box = el('section', 'panel lp-brief');
        var headRow = el('div', 'lpd-section__head');
        add(headRow, el('span', 'panel__title', t('lp.brief')));
        if (c.target && c.target.name) {
          add(headRow, el('span', 'chip chip--sm', String(view.gen.variant_label || '-') + ' ' + String(c.target.name)));
        }
        var open = false;
        var pre = el('pre', 'lp-brief__text', String(c.brief || ''));
        pre.hidden = true;
        var toggle = button('btn btn--secondary btn--sm', t('lp.briefOpen'), function () {
          open = !open; pre.hidden = !open; toggle.textContent = t(open ? 'lp.briefClose' : 'lp.briefOpen');
        });
        add(headRow, toggle);
        add(headRow, button('btn btn--secondary btn--sm', t('lp.copy'), function () { copyText(String(c.brief || '')); }));
        add(box, headRow);
        add(box, pre);
        add(body, box);
      }

      /* 商品の見本（切り抜き）。全区画の生成に添付される */
      function paintRefs() {
        var refs = isArray(view.project && view.project.product_cutout_urls) ? view.project.product_cutout_urls : [];
        var stars = isArray(view.project && view.project.product_shot_urls) ? view.project.product_shot_urls : [];
        var src = isArray(view.project && view.project.product_cutout_source) ? view.project.product_cutout_source : [];
        /* ☆と切り抜きの元が違えば古い。見せて、その場で作り直せるようにする */
        var stale = JSON.stringify(stars.slice().sort()) !== JSON.stringify(src.slice().sort());
        var box = el('section', 'panel');
        var headRow = el('div', 'lpd-section__head');
        add(headRow, el('span', 'panel__title', t('lp.refs')));
        add(headRow, button('btn btn--secondary btn--sm', t('lp.addRefs'), function () {
          location.hash = '#/S4?id=' + encodeURIComponent(projectId);
        }));
        if (stale && stars.length) {
          add(headRow, button('btn btn--primary btn--sm', t('lp.rebuildRefs'), function () {
            Api.generationJobs.insert({
              feature_key: 'product_cutouts', status: 'pending', projects_id: projectId,
              users_id: (window.Api && Api.auth && typeof Api.auth.userId === 'function') ? Api.auth.userId() : undefined,
              payload: {}, lang: currentLocale()
            }).then(function (job) {
              toast(t('lp.rebuildRefsQueued'), 'success');
              if (App.watchJob) {
                App.watchJob({ jobId: job.id, titleKey: 'job.titleAssets', urls: [], onDone: function () {
                  Api.projects.get(projectId).then(function (p) { view.project = p; paint(); });
                } });
              }
            }).catch(function (err) { toast(String(err && err.message || err), 'danger'); });
          }));
        }
        add(box, headRow);
        if (stale && stars.length) {
          add(box, el('p', 'field__hint', t('lp.refsStale', { n: stars.length, m: refs.length })));
        }
        if (!refs.length) { add(box, el('p', 'field__hint', t('lp.noRefs'))); add(body, box); return; }
        var row = el('div', 'lp-assets__row');
        refs.forEach(function (u) {
          var img = el('img', 'lp-assets__thumb');
          img.src = u; img.alt = ''; img.loading = 'lazy';
          add(row, img);
        });
        add(box, row);
        add(body, box);
      }

      /* 区画ごとのカード: プロンプト（編集可）＋生成ボタン＋できた絵 */
      function paintSections() {
        var list = el('ol', 'lpd-sections');
        (view.gen.sections || []).forEach(function (sec, i) { add(list, sectionCard(sec, i)); });
        add(body, list);
      }

      function sectionCard(sec, i) {
        var slot = String(sec.index) + '-1';
        var url = made()[slot] || '';
        var li = el('li', 'lpd-section');
        var headRow = el('div', 'lpd-section__head');
        add(headRow, el('span', 'lpd-section__no', String(sec.index)));
        add(headRow, el('span', 'lpd-section__title', String(sec.title || t('lp.section', { n: sec.index }))));
        var doubt = unsure()[slot];
        if (url && !doubt) { add(headRow, el('span', 'chip chip--sm chip--success', '✓')); }
        if (url && doubt) {
          var warn = el('span', 'chip chip--sm chip--warn', t('lp.unsure'));
          warn.title = String(doubt);
          add(headRow, warn);
        }
        add(li, headRow);

        /* 絵は左右の矢印で版を送る。0番目がいま使っている版、以降が前の版。
           前は「履歴を開く」で下に並べていたが、作り直すたびに横に伸びて
           見比べにくかった。同じ場所で入れ替えれば、変わったところが分かる */
        var hist = (view.gen.asset_prompts && view.gen.asset_prompts.history && view.gen.asset_prompts.history[slot]) || [];
        if (url) {
          var shots = [{ url: url, at: '' }].concat(hist);
          /* 何番目を見ているかは描き直しをまたいで覚える。作り直しのあとに
             paint() が走ると、見ていた版に戻れなくなる */
          if (view.shotAt[slot] === undefined || view.shotAt[slot] >= shots.length) { view.shotAt[slot] = 0; }
          var stage = el('div', 'lp-shot');
          var img = el('img', 'lp-section__img');
          img.alt = ''; img.loading = 'lazy';
          /* 押したら大きく見る。区画のカードでは幅360pxまでなので、
             文字が読めるか・商品の形が合っているかを確かめられない */
          img.title = t('lp.shotZoom');
          img.setAttribute('role', 'button');
          img.setAttribute('tabindex', '0');
          var zoom = function () { openShot(shots[view.shotAt[slot]].url); };
          img.addEventListener('click', zoom);
          img.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoom(); }
          });
          /* 両端に前後の版をぼかして覗かせる。次に何が来るかが見えるので、
             押す前に見当がつく。飾りではなく、押しても送れるようにする */
          var peekPrev = el('img', 'lp-shot__peek');
          var peekNext = el('img', 'lp-shot__peek');
          peekPrev.alt = ''; peekNext.alt = '';
          peekPrev.loading = 'lazy'; peekNext.loading = 'lazy';
          var foot = el('div', 'lp-shot__foot');
          var counter = el('span', 't-note', '');
          var action = el('span', 'lp-shot__action');
          add(foot, counter);
          add(foot, action);

          /* 矢印では paint() を呼ばない。全部を描き直すと画面が作り直され、
             見ていた場所を失ってページの先頭へ飛ぶ（実測）。
             ここで変わるのは絵と下の1行だけなので、その2つだけ書き換える */
          var older = function (at) { return (at + 1) % shots.length; };          /* 左＝古い方 */
          var newer = function (at) { return (at - 1 + shots.length) % shots.length; };

          var show = function () {
            var at = view.shotAt[slot];
            img.src = shots[at].url;
            /* 版が2つしか無いと、左右の覗きが同じ絵になる。それでも
               「隣がある」ことは伝わるので、そのまま出す */
            peekPrev.src = shots[older(at)].url;
            peekNext.src = shots[newer(at)].url;
            counter.textContent = (at + 1) + ' / ' + shots.length
              + (shots[at].at ? '　' + String(shots[at].at).slice(0, 16).replace('T', ' ') : '');
            clear(action);
            /* いま使っている版以外を見ているときだけ、置き換えの手を出す */
            add(action, at === 0
              ? el('span', 'chip chip--sm chip--success', t('lp.shotNow'))
              : button('btn btn--secondary btn--sm', t('lp.restore'), function () { restoreVersion(slot, at - 1); }));
          };

          if (shots.length > 1) {
            var goOlder = function () { view.shotAt[slot] = older(view.shotAt[slot]); show(); };
            var goNewer = function () { view.shotAt[slot] = newer(view.shotAt[slot]); show(); };
            var prev = button('btn btn--secondary btn--sm lp-shot__nav', '‹', goOlder);
            prev.setAttribute('aria-label', t('lp.prevShot'));
            var next = button('btn btn--secondary btn--sm lp-shot__nav', '›', goNewer);
            next.setAttribute('aria-label', t('lp.nextShot'));
            peekPrev.addEventListener('click', goOlder);
            peekNext.addEventListener('click', goNewer);
            add(stage, peekPrev);
            add(stage, prev);
            add(stage, img);
            add(stage, next);
            add(stage, peekNext);
          } else {
            add(stage, img);
          }
          show();
          add(li, stage);
          if (shots.length > 1) { add(li, foot); }
        }

        /* AI が動きを勧めた区画には印と、その区画だけのボタンを出す。
           絵の生成とは別の作業（作る先も費用も違う）ので、ボタンも分ける */
        var pick = motionPick(sec);
        var moving = motion()[slot];
        if (pick) {
          var mrow = el('div', 'lp-toolbar');
          add(mrow, el('span', 'chip chip--sm', t('lp.motionPick') + '（' + pick.toUpperCase() + '）'));
          var mbusy = !!view.busy[slot + ':m'];
          var mb = button('btn btn--secondary btn--sm',
            mbusy ? t('lp.motionRunning') : t(moving ? 'lp.motionRedo' : 'lp.motionMake'),
            function () { generateMotion(sec.index, !!moving); });
          mb.disabled = mbusy;
          add(mrow, mb);
          add(li, mrow);
        }
        if (moving) {
          var mbox = el('div', 'lp-motion');
          add(mbox, el('span', 'field__label', t('lp.motion')));
          if (/\.(mp4|webm|mov)(\?|$)/i.test(String(moving))) {
            var vid = el('video', 'lp-motion__media');
            vid.src = moving; vid.controls = true; vid.loop = true;
            vid.muted = true; vid.playsInline = true; vid.preload = 'metadata';
            add(mbox, vid);
          } else {
            var gif = el('img', 'lp-motion__media');
            gif.src = moving; gif.alt = ''; gif.loading = 'lazy';
            gif.title = t('lp.shotZoom');
            gif.style.cursor = 'zoom-in';
            gif.addEventListener('click', function () { openShot(moving); });
            add(mbox, gif);
          }
          add(li, mbox);
        }

        var field = el('label', 'field');
        add(field, el('span', 'field__label', t('lp.prompt')));
        var ta = el('textarea', 'textarea lp-prompt');
        ta.value = String(sec.prompt || '');
        ta.rows = 6;
        ta.addEventListener('input', function () {
          sec.prompt = ta.value; view.dirty = true;
          var s = document.getElementById('lp-save'); if (s) { s.disabled = false; }
        });
        add(field, ta);
        add(li, field);

        var row = el('div', 'lp-toolbar');
        var busy = !!view.busy[slot];
        var b = button('btn ' + (url ? 'btn--secondary' : 'btn--primary'), busy ? t('lp.generating') : t(url ? 'lp.regen' : 'lp.gen'), function () {
          generate(sec.index);
        });
        b.disabled = busy;
        add(row, b);
        add(row, button('btn btn--secondary btn--sm', t('lp.copy'), function () { copyText(String(sec.prompt || '')); }));
        add(li, row);
        return li;
      }

      /* 前の版を最新に戻す。今の最新は履歴の先頭に回る */
      function restoreVersion(slot, index) {
        var ap = view.gen.asset_prompts || {};
        var made = Object.assign({}, ap.made || {});
        var history = Object.assign({}, ap.history || {});
        var list = (history[slot] || []).slice();
        var picked = list[index];
        if (!picked) { return; }
        list.splice(index, 1);
        if (made[slot] && made[slot] !== picked.url) { list.unshift({ url: made[slot], at: new Date().toISOString() }); }
        made[slot] = picked.url;
        history[slot] = list.slice(0, 10);
        var next = Object.assign({}, ap, { made: made, history: history });
        Api.generations.update(view.gen.id, { asset_prompts: next }).then(function () {
          view.gen.asset_prompts = next;
          /* 戻したものが「いま使う版」になるので、見る位置も先頭へ */
          view.shotAt[slot] = 0;
          toast(t('lp.restored'), 'success');
          paint();
        }).catch(function (err) { toast(String(err && err.message || err), 'danger'); });
      }

      function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { toast(t('lp.copied'), 'success'); });
        }
      }

      function saveEdits() {
        Api.generations.update(view.gen.id, { sections: view.gen.sections }).then(function () {
          view.dirty = false;
          toast(t('lp.saved'), 'success');
          paint();
        }).catch(function (err) { toast(String(err && err.message || err), 'danger'); });
      }

      /* 1枚を画面いっぱいで見る。背景・×・Esc で閉じるのは App.openModal 任せ。
         拡大の作りを自前で持たない（他の画面と閉じ方が変わると混乱する） */
      function openShot(url) {
        if (!url) { return; }
        if (typeof App.openModal !== 'function') {
          console.error('[screens-lp] App.openModal がありません。拡大表示できません。');
          window.open(url, '_blank');
          return;
        }
        var box = el('div', 'lp-zoom');
        var big = el('img', 'lp-zoom__img');
        big.src = url;
        big.alt = '';
        add(box, big);
        App.openModal(box);
      }

      /* 区画を1つだけ動かす。全部まとめる方（startAssets）と同じ仕事だが、
         payload に slot を入れて1点に絞る。作り直しのときは force を付ける
         （付けないと、もうあるものとして飛ばされる） */
      function generateMotion(index, redo) {
        if (!window.Api || !Api.generationJobs) { toast(t('common.error'), 'danger'); return; }
        var slot = String(index) + '-1';
        view.busy[slot + ':m'] = true;
        paint();
        var freeUp = function () { delete view.busy[slot + ':m']; };
        Api.generationJobs.insert({
          feature_key: 'lp_assets',
          status: 'pending',
          projects_id: projectId,
          users_id: (window.Api && Api.auth && typeof Api.auth.userId === 'function') ? Api.auth.userId() : undefined,
          payload: { generation_id: view.gen.id, slot: slot, force: !!redo },
          lang: currentLocale()
        }).then(function (job) {
          if (!App.watchJob) { freeUp(); paint(); return; }
          App.watchJob({
            jobId: job.id,
            titleKey: 'job.titleAssets',
            urls: [],
            onDone: function () {
              Api.generations.get(view.gen.id).then(function (row) {
                if (row) {
                  view.gen = row;
                  view.gens = view.gens.map(function (g) { return g.id === row.id ? row : g; });
                }
                freeUp();
                toast(t('lp.motionDone'), 'success');
                paint();
              });
            },
            onFail: function (why) {
              freeUp();
              toast(String(why || t('common.error')), 'danger');
              paint();
            }
          });
        }).catch(function (err) {
          freeUp();
          console.error('[screens-lp] 動く絵のジョブを積めませんでした:', err);
          toast(String(err && err.message || err), 'danger');
          paint();
        });
      }

      /* 絵の指示から動く絵（GIF・動画）を作る。ワーカーの lp_assets が受け、
         make-video.mjs が Replicate の bytedance/seedance-2.5 で作る。
         静止画はここでは作らない（lp_section が OpenAI の画面で作る） */
      function startAssets(node) {
        if (!window.Api || !Api.generationJobs) {
          console.error('[screens-lp] Api.generationJobs がありません。api.js を確認してください。');
          toast(t('common.error'), 'danger');
          return;
        }
        var label = node.textContent;
        /* 押した瞬間に幅が変わらないようにしてから文字を差し替える */
        node.style.minWidth = node.offsetWidth + 'px';
        node.disabled = true;
        node.textContent = t('lp.makeAssetsRunning');
        var restore = function () { node.disabled = false; node.textContent = label; };
        Api.generationJobs.insert({
          feature_key: 'lp_assets',
          status: 'pending',
          projects_id: projectId,
          users_id: (window.Api && Api.auth && typeof Api.auth.userId === 'function')
            ? Api.auth.userId() : undefined,
          payload: { generation_id: view.gen.id },
          lang: currentLocale()
        }).then(function (job) {
          if (!App.watchJob) { toast(t('lp.makeAssetsQueued'), 'success'); restore(); return; }
          App.watchJob({
            jobId: job.id,
            titleKey: 'job.titleAssets',
            urls: [],
            onDone: function () {
              /* できた素材は asset_prompts.made に入る。読み直さないと
                 区画のカードが古いままになる */
              Api.generations.get(view.gen.id).then(function (row) {
                if (row) {
                  view.gen = row;
                  view.gens = view.gens.map(function (g) { return g.id === row.id ? row : g; });
                }
                restore();
                toast(t('lp.makeAssetsDone'), 'success');
                paint();
              });
            },
            /* 失敗でもボタンを戻す。戻さないと「生成しています…」のまま固まる */
            onFail: function (why) {
              restore();
              toast(String(why || t('common.error')), 'danger');
              paint();
            }
          });
        }).catch(function (err) {
          restore();
          console.error('[screens-lp] 動く絵のジョブを積めませんでした:', err);
          toast(String(err && err.message || err), 'danger');
        });
      }

      /* 1区画（index）か、未生成の全部（null）を作る。ワーカーの lp_section が受ける */
      function generate(index) {
        if (!window.Api || !Api.generationJobs) { toast(t('common.error'), 'danger'); return; }
        var targets = index === null
          ? (view.gen.sections || []).filter(function (s) { return !made()[String(s.index) + '-1']; }).map(function (s) { return s.index; })
          : (index === 'all'
            ? (view.gen.sections || []).map(function (s) { return s.index; })
            : [index]);
        if (!targets.length) { return; }
        var go = function () {
          targets.forEach(function (ix) { view.busy[String(ix) + '-1'] = true; });
          paint();
          Api.generationJobs.insert({
            feature_key: 'lp_section',
            status: 'pending',
            projects_id: projectId,
            users_id: (window.Api && Api.auth && typeof Api.auth.userId === 'function') ? Api.auth.userId() : undefined,
            payload: { generation_id: view.gen.id, sections: targets },
            lang: currentLocale()
          }).then(function (job) {
            if (!App.watchJob) { toast(t('lp.queued'), 'success'); return; }
            App.watchJob({
              jobId: job.id,
              titleKey: 'job.titleAssets',
              urls: [],
              onDone: function () {
                Api.generations.get(view.gen.id).then(function (row) {
                  if (row) {
                    view.gen = row;
                    view.gens = view.gens.map(function (g) { return g.id === row.id ? row : g; });
                  }
                  /* できたてを見せる。前の版を見ていた位置のままだと、
                     作り直したのに絵が変わらないように見える */
                  targets.forEach(function (ix) {
                    delete view.busy[String(ix) + '-1'];
                    view.shotAt[String(ix) + '-1'] = 0;
                  });
                  toast(t('lp.genDone'), 'success');
                  paint();
                });
              },
              /* 失敗でもボタンを戻す。戻さないと「生成しています…」のまま固まり、
                 失敗の帯だけが残り続ける（実測） */
              onFail: function (why) {
                targets.forEach(function (ix) { delete view.busy[String(ix) + '-1']; });
                toast(String(why || t('common.error')), 'danger');
                paint();
              }
            });
          }).catch(function (err) {
            targets.forEach(function (ix) { delete view.busy[String(ix) + '-1']; });
            paint();
            toast(String(err && err.message || err), 'danger');
          });
        };
        /* 直したプロンプトは先に保存してから作る */
        if (view.dirty) {
          Api.generations.update(view.gen.id, { sections: view.gen.sections }).then(function () { view.dirty = false; go(); });
        } else { go(); }
      }
    }
  });
})();
