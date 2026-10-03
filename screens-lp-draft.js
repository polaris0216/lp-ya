/* =============================================================================
 * screens-lp.js — S12 LP案（区画ごとの文章・素材・絵の指示を見て直す）
 *
 * 流れ:
 *   1. 「LP案を作る」を押す → generation_jobs に lp_draft を積む
 *   2. ワーカーが 骨格（参照ページの組み立て方）＋当て込み（競合分析の要因）から
 *      日本語の区画案を書き、generations に1行入れる
 *   3. この画面で区画ごとに読み、見出し・本文を直して保存する
 *   4. 「HTMLで見る」→ S13（lp-render.js で組む）
 *
 * 画面登録   App.registerScreen('S12', { render })
 * URL        #/S12?id=<プロジェクトID>[&gen=<生成物ID>]
 * 通信       Api.projects / Api.generations / Api.generationJobs / App.watchJob
 * 文言       i18n.js。ここだけの文言は LOCAL に置く
 * ========================================================================== */
(function () {
  'use strict';

  var App = window.App = window.App || {};
  var LOCALES = ['ja', 'en', 'ko'];
  var FEATURE = 'lp_draft';

  var LOCAL = {
    'lp.title': ['LP案', 'LP draft', 'LP 초안'],
    'lp.lead': ['総合分析の「共通する流れ」を骨格に、勝ち筋と反省点を当て込み、ターゲット層ごとに1本ずつ作ります。層を切り替えて中身を見比べ、文章を直してからHTMLに組みます。',
      'One draft per target segment: the shared flow from the overall analysis as the skeleton, with the factors applied. Switch segments, edit the copy, then render to HTML.',
      '종합 분석의 "공통 흐름"을 뼈대로, 성공 요인과 반성할 점을 반영해 타깃층별로 한 편씩 만듭니다. 층을 바꿔가며 비교하고, 문장을 다듬은 뒤 HTML로 조립합니다.'],
    'lp.run': ['LP案を作る', 'Draft the LP', 'LP 초안 만들기'],
    'lp.rerun': ['作り直す', 'Redraft', '다시 만들기'],
    'lp.running': ['作っています…', 'Drafting…', '만드는 중…'],
    'lp.needStructure': ['参照ページの組み立て方がまだありません。商品入力で「参照ページから自動入力」を先に実行してください。',
      'No reference structure yet. Run "Auto-fill from reference page" in Product input first.',
      '참조 페이지 구성이 아직 없습니다. 상품 입력에서 "참조 페이지로 자동 입력"을 먼저 실행하세요.'],
    'lp.noFactors': ['競合分析がまだ無いので、骨格だけで組みます。競合分析を先に済ませると、日本で伸びる型を当て込めます。',
      'No competitor analysis yet; drafting from the skeleton only. Run the analysis first to apply what works in Japan.',
      '경쟁 분석이 아직 없어 뼈대만으로 만듭니다. 먼저 분석을 마치면 일본에서 통하는 형식을 반영할 수 있습니다.'],
    'lp.loading': ['読み込んでいます…', 'Loading…', '불러오는 중…'],
    'lp.loadFailed': ['LP案を読み込めませんでした', 'Could not load the LP drafts', 'LP 초안을 불러오지 못했습니다'],
    'lp.empty': ['まだLP案がありません。', 'No LP draft yet.', '아직 LP 초안이 없습니다.'],
    'lp.emptyHint': [
      '総合分析のページで「この分析からLP案を作る」を押すと、ターゲット層ごとに1本ずつ作られます。',
      'On the overall analysis page, press "Draft LPs from this analysis" to create one per target segment.',
      '종합 분석 페이지에서 "이 분석으로 LP 초안 만들기"를 누르면 타깃층별로 한 편씩 만들어집니다.'
    ],
    'lp.summary': ['この案の流れ', 'Flow of this draft', '이 초안의 흐름'],
    'lp.applied': ['当て込んだ要因', 'Factors applied', '반영한 요인'],
    'lp.sections': ['区画', 'sections', '구획'],
    'lp.headline': ['見出し', 'Headline', '헤드라인'],
    'lp.subhead': ['補足', 'Subhead', '보조 문구'],
    'lp.body': ['本文', 'Body', '본문'],
    'lp.bullets': ['箇条書き（1行1項目）', 'Bullets (one per line)', '항목(줄당 하나)'],
    'lp.assets': ['使う素材', 'Assets', '소재'],
    'lp.visual': ['絵の指示', 'Visual brief', '이미지 지시'],
    'lp.ctaLabel': ['ボタン文言', 'CTA label', '버튼 문구'],
    'lp.cta': ['申し込み', 'CTA', '신청'],
    'lp.added': ['日本向けに追加', 'Added for Japan', '일본용 추가'],
    'lp.from': ['骨格 {n} から', 'From skeleton #{n}', '뼈대 {n}에서'],
    'lp.save': ['変更を保存', 'Save changes', '변경 저장'],
    'lp.saved': ['保存しました', 'Saved', '저장했습니다'],
    'lp.toHtml': ['このLP案でLPを作る', 'Build the LP from this draft', '이 초안으로 LP 만들기'],
    'lp.makeAssets': ['素材を生成する', 'Generate the visuals', '소재 생성'],
    'lp.makeAssetsRunning': ['生成しています…', 'Generating…', '생성 중…'],
    'lp.makeAssetsQueued': ['素材の生成を積みました', 'Queued the visual generation', '소재 생성을 예약했습니다'],
    'lp.makeAssetsDone': ['素材ができました。組み直すと本文に入ります。',
      'Visuals are ready. Rebuild to place them in the page.',
      '소재가 준비되었습니다. 다시 조립하면 본문에 들어갑니다.'],
    'lp.assetsHint': ['この案の絵の指示から、動く絵（GIF・動画）を作ります。静止画の注文書も一緒に書き出します。',
      'Produces the motion visuals (GIF/video) from this draft. The still-image order sheet is written out too.',
      '이 초안의 이미지 지시로 움직이는 소재(GIF·동영상)를 만듭니다. 정지 이미지 주문서도 함께 씁니다.'],
    'lp.jobTitle': ['LP案を作成中', 'Drafting the LP', 'LP 초안 작성 중'],
    'lp.history': ['前の案', 'Earlier drafts', '이전 초안'],
    'lp.noProject': ['プロジェクトが選ばれていません', 'No project selected', '프로젝트가 선택되지 않았습니다'],
    'lp.visualHasAsset': ['手持ちの素材 {ref} を使う', 'Use existing asset {ref}', '보유 소재 {ref} 사용'],
    'lp.variants': ['ターゲット層', 'Target segments', '타깃층'],
    'lp.noAssetsPicked': ['（素材なし）', '(none)', '(없음)']
  };

  /* ---------- 依存の確認 ---------- */
  if (typeof App.registerScreen !== 'function') {
    console.error('[screens-lp] App.registerScreen が見つかりません。index.html の読み込み順（app.js -> screens-lp.js）を確認してください。');
    App.screens = App.screens || {};
    App.registerScreen = function (id, spec) { App.screens[id] = spec; };
  }
  if (!window.Api) { console.error('[screens-lp] window.Api が見つかりません。api.js を確認してください。'); }

  /* ---------- 小道具 ---------- */
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
    if (row) {
      var index = LOCALES.indexOf(currentLocale());
      return fill(row[index < 0 ? 0 : index] || row[0], params);
    }
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
    if (typeof App.toast === 'function') { App.toast(message, kind); }
    else { console.log('[screens-lp]', kind || 'info', message); }
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

  /* 素材の番号（p1 / v1）を、プロジェクトの写真・動画のURLに戻す */
  function assetUrl(project, ref) {
    var s = String(ref || '').trim();
    if (s.indexOf('http') === 0) { return s; }
    var m = s.match(/^([pv])(\d+)$/);
    if (!m) { return ''; }
    var list = m[1] === 'p' ? (project.image_urls || []) : (project.video_urls || []);
    return String(list[Number(m[2]) - 1] || '');
  }

  /* ---------- 画面 ---------- */
  App.registerScreen('S12', {
    render: function (root, params) {
      params = params || {};
      var projectId = params.id || (window.Api && Api.storage && Api.storage.get('projectId')) || '';
      setHeader(t('lp.title'));
      clear(root);

      if (!projectId) {
        add(root, el('p', 'empty', t('lp.noProject')));
        return;
      }

      var view = { project: null, gen: null, gens: [], user: null, running: false, dirty: false };
      var screen = el('div', 'screen');
      var head = el('header', 'screen__head');
      add(head, el('h2', 'screen__title', t('lp.title')));
      add(head, el('p', 'screen__lead', t('lp.lead')));
      add(screen, head);
      var notice = el('div', 'lp-notice');
      add(screen, notice);
      var toolbar = el('div', 'lp-toolbar');
      add(screen, toolbar);
      var body = el('div', 'lp-body');
      add(screen, body);
      add(root, screen);

      /* --- 読み込み ---
         途中の状態を必ず画面に出す。黙って空欄になると、まだ無いのか
         読めなかったのかが分からない（実測: 5本できているのに空欄に見えた） */
      add(body, el('p', 'empty', t('lp.loading')));
      Promise.all([
        Api.projects.get(projectId),
        Api.generations.list({ eq: { projects_id: projectId, feature_key: FEATURE }, order: 'created_at.desc', limit: 20 })
      ]).then(function (got) {
        view.project = got[0];
        view.gens = got[1] || [];
        var wanted = params.gen && view.gens.filter(function (g) { return g.id === params.gen; })[0];
        view.gen = wanted || view.gens[0] || null;
        paint();
      }).catch(function (err) {
        console.error('[screens-lp] 読み込みに失敗:', err);
        clear(body);
        add(body, el('p', 'empty', t('lp.loadFailed')));
        add(body, el('p', 'field__hint', String(err && err.message || err)));
      });



      function paint() {
        clear(notice); clear(toolbar); clear(body);

        /* 作る入口は総合分析（S20）にある。ここは出来たものを直す画面 */

        if (view.gen) {
          /* build=1 で S13 に入ると、必ず組み直す（前の版は履歴に積まれる）。
             付けないと、前に組んだものがあればそれを出すだけで、
             LP案を直しても生成結果が変わらない */
          add(toolbar, button('btn btn--primary', t('lp.toHtml'), function () {
            location.hash = '#/S13?id=' + encodeURIComponent(projectId) + '&gen=' + encodeURIComponent(view.gen.id) + '&build=1';
          }));
          add(toolbar, button('btn btn--secondary', t('lp.makeAssets'), function (e) {
            startAssets(e.currentTarget);
          }));
          var save = button('btn btn--secondary', t('lp.save'), saveEdits);
          save.disabled = !view.dirty;
          save.id = 'lp-save';
          add(toolbar, save);
        }
        /* 層ごとに1本できる。同じ回のものを横に並べて、押して切り替える。
           選ぶのは「どの層に向けたLPを使うか」なので、日付より層が先に要る */
        var batch = view.gen ? view.gens.filter(function (g) {
          return (g.created_at || '').slice(0, 16) === (view.gen.created_at || '').slice(0, 16);
        }) : [];
        if (batch.length > 1) {
          var tabs = el('div', 'lp-variants');
          batch.slice().sort(function (a, b) {
            return String(a.variant_label || '').localeCompare(String(b.variant_label || ''));
          }).forEach(function (g) {
            var on = view.gen && g.id === view.gen.id;
            var b = button('lp-variant' + (on ? ' lp-variant--on' : ''), '', function () {
              view.gen = g; view.dirty = false; paint();
            });
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
            add(b, el('span', 'lp-variant__label', String(g.variant_label || '-')));
            add(b, el('span', 'lp-variant__name', String(g.title || '').slice(0, 28)));
            add(tabs, b);
          });
          add(toolbar, tabs);
        }
        /* 過去の回。層の切り替えとは別物なので、日付だけの一覧にする */
        var rounds = [];
        var seen = {};
        view.gens.forEach(function (g) {
          var when = (g.created_at || '').slice(0, 16);
          if (seen[when]) { return; }
          seen[when] = 1;
          rounds.push(g);
        });
        if (rounds.length > 1) {
          var pick = el('select', 'select lp-history');
          rounds.forEach(function (g) {
            var o = el('option', null, (g.created_at || '').slice(0, 16).replace('T', ' '));
            o.value = g.id;
            if (view.gen && (g.created_at || '').slice(0, 16) === (view.gen.created_at || '').slice(0, 16)) { o.selected = true; }
            add(pick, o);
          });
          pick.setAttribute('aria-label', t('lp.history'));
          pick.addEventListener('change', function () {
            view.gen = view.gens.filter(function (g) { return g.id === pick.value; })[0] || view.gen;
            view.dirty = false;
            paint();
          });
          add(toolbar, pick);
        }

        if (!view.gen) {
          add(body, el('p', 'empty', t('lp.empty')));
          add(body, el('p', 'field__hint', t('lp.emptyHint')));
          return;
        }
        paintDraft();
      }

      function paintDraft() {
        var gen = view.gen;
        var content = gen.content && typeof gen.content === 'object' ? gen.content : {};
        var sections = isArray(gen.sections) ? gen.sections : [];

        var top = el('section', 'panel');
        add(top, el('span', 'panel__title', t('lp.summary')));
        /* どの層に向けたLPかを最初に出す。5本あるので、見ているものが
           どれか分からないと直しようがない */
        var tg = content.target;
        if (tg && tg.name) {
          var who = el('p', 'lp-target');
          add(who, el('span', 'chip chip--sm', String(tg.label || '-')));
          add(who, el('strong', null, ' ' + String(tg.name)));
          if (tg.description) { add(who, el('span', 't-note', ' — ' + String(tg.description))); }
          add(top, who);
        }
        add(top, el('p', 'lp-summary', String(content.summary || gen.title || '')));
        var applied = isArray(content.applied) ? content.applied : [];
        if (applied.length) {
          add(top, el('span', 'field__label', t('lp.applied')));
          var ul = el('ul', 'lp-applied');
          applied.forEach(function (a) {
            var li = el('li', null);
            add(li, el('strong', null, String(a.factor || '')));
            if (isArray(a.where) && a.where.length) { add(li, el('span', 't-note', ' → ' + a.where.join(', '))); }
            if (a.how) { add(li, el('div', 'lp-applied__how', String(a.how))); }
            add(ul, li);
          });
          add(top, ul);
        } else {
          add(top, el('p', 'field__hint', t('lp.noFactors')));
        }
        add(body, top);

        var list = el('ol', 'lpd-sections');
        sections.forEach(function (sec, index) {
          add(list, sectionCard(sec, index));
        });
        add(body, list);
      }

      /* 区画1つ。見出し・補足・本文・箇条書き・ボタン文言はその場で直せる。
         素材と絵の指示は見るだけ（素材の差し替えは HTML 側で） */
      function sectionCard(sec, index) {
        var li = el('li', 'lpd-section' + (sec.cta ? ' lpd-section--cta' : ''));
        var head = el('div', 'lpd-section__head');
        add(head, el('span', 'lpd-section__no', String(index + 1)));
        add(head, el('span', 'lpd-section__title', String(sec.title || sec.key || '')));
        if (sec.cta) { add(head, el('span', 'chip chip--sm', t('lp.cta'))); }
        if (sec.added) { add(head, el('span', 'chip chip--sm', t('lp.added'))); }
        else if (sec.from) { add(head, el('span', 't-note', t('lp.from', { n: sec.from }))); }
        add(li, head);

        add(li, field(t('lp.headline'), 'input', sec.headline, function (v) { sec.headline = v; }));
        if (sec.subhead || sec.cta) { add(li, field(t('lp.subhead'), 'input', sec.subhead, function (v) { sec.subhead = v; })); }
        add(li, field(t('lp.body'), 'textarea', sec.body, function (v) { sec.body = v; }));
        if (isArray(sec.bullets) && sec.bullets.length) {
          add(li, field(t('lp.bullets'), 'textarea', sec.bullets.join('\n'), function (v) {
            sec.bullets = v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
          }));
        }
        if (sec.cta) { add(li, field(t('lp.ctaLabel'), 'input', sec.cta_label, function (v) { sec.cta_label = v; })); }

        /* 素材（サムネイル）と絵の指示 */
        var assets = isArray(sec.assets) ? sec.assets : [];
        var strip = el('div', 'lp-assets');
        add(strip, el('span', 'field__label', t('lp.assets')));
        var row = el('div', 'lp-assets__row');
        var shown = 0;
        assets.forEach(function (ref) {
          var url = assetUrl(view.project, ref);
          if (!url) { return; }
          shown += 1;
          if (/^v\d+$/.test(String(ref)) || /\.(mp4|webm|mov)(\?|$)/i.test(url)) {
            var v = el('video', 'lp-assets__thumb');
            v.src = url; v.muted = true; v.playsInline = true; v.preload = 'metadata';
            add(row, v);
          } else {
            var img = el('img', 'lp-assets__thumb');
            img.src = url; img.alt = String(ref); img.loading = 'lazy';
            add(row, img);
          }
        });
        if (!shown) { add(row, el('span', 't-note', t('lp.noAssetsPicked'))); }
        add(strip, row);
        add(li, strip);
        /* 絵の指示。ここが素材を作る段への申し送りになる。
           kind（image / gif / video）で作らせる先が変わる */
        var visuals = isArray(sec.visuals) ? sec.visuals : (sec.visual ? [{ kind: 'image', prompt: sec.visual }] : []);
        if (visuals.length) {
          var vis = el('div', 'lp-visual');
          add(vis, el('span', 'field__label', t('lp.visual')));
          visuals.forEach(function (v) {
            var row = el('div', 'lp-visual__row');
            add(row, el('span', 'lp-kind', String(v.kind || 'image')));
            var txt = el('div', 'lp-visual__body');
            if (v.use) { add(txt, el('span', 'lp-visual__use', String(v.use))); }
            add(txt, el('p', 'lp-visual__text', String(v.prompt || '')));
            if (v.asset) { add(txt, el('span', 't-note', t('lp.visualHasAsset', { ref: String(v.asset) }))); }
            add(row, txt);
            add(vis, row);
          });
          add(li, vis);
        }
        return li;
      }

      function field(label, kind, value, onChange) {
        var wrap = el('label', 'field');
        add(wrap, el('span', 'field__label', label));
        var input = el(kind === 'textarea' ? 'textarea' : 'input', kind === 'textarea' ? 'textarea' : 'input');
        if (kind !== 'textarea') { input.type = 'text'; }
        input.value = String(value || '');
        if (kind === 'textarea') { input.rows = Math.min(10, Math.max(3, String(value || '').split('\n').length + 1)); }
        input.addEventListener('input', function () {
          onChange(input.value);
          if (!view.dirty) { view.dirty = true; var s = document.getElementById('lp-save'); if (s) { s.disabled = false; } }
        });
        add(wrap, input);
        return wrap;
      }

      /* --- 実行 --- */

      /* 絵の指示から素材を作る。動く絵は機械が最後まで作り、
         静止画は注文書に残る（OpenAI の画面を人が回すため）。
         押したときの案を指すので、層を切り替えてから押せばその層ぶんが作られる */
      function startAssets(node) {
        if (!window.Api || !Api.generationJobs) {
          console.error('[screens-lp] Api.generationJobs がありません。api.js を確認してください。');
          toast(t('common.error'), 'danger');
          return;
        }
        var label = node.textContent;
        node.disabled = true;
        node.style.minWidth = node.offsetWidth + 'px';
        node.textContent = t('lp.makeAssetsRunning');
        Api.generationJobs.insert({
          feature_key: 'lp_assets',
          status: 'pending',
          projects_id: projectId,
          users_id: (window.Api && Api.auth && typeof Api.auth.userId === 'function')
            ? Api.auth.userId() : undefined,
          payload: { generation_id: view.gen.id },
          lang: currentLocale()
        }).then(function (job) {
          if (!App.watchJob) { toast(t('lp.makeAssetsQueued'), 'success'); return; }
          App.watchJob({
            jobId: job.id,
            titleKey: 'job.titleAssets',
            urls: [],
            onDone: function () {
              toast(t('lp.makeAssetsDone'), 'success');
              node.disabled = false;
              node.textContent = label;
            }
          });
        }).catch(function (err) {
          node.disabled = false;
          node.textContent = label;
          console.error('[screens-lp] 素材のジョブを積めませんでした:', err);
          toast(String(err && err.message || err), 'danger');
        });
      }

      function saveEdits() {
        if (!view.gen) { return; }
        Api.generations.update(view.gen.id, { sections: view.gen.sections }).then(function () {
          view.dirty = false;
          paint();
          toast(t('lp.saved'), 'success');
        }).catch(function (err) {
          console.error('[screens-lp] 保存に失敗:', err);
          toast(String(err && err.message || err), 'danger');
        });
      }
    }
  });
})();
