/* ============================================================
 * エルピーヤ — screens-analysis.js
 * S10 競合分析 / S11 分析レポート / S12 分析内容確認 の3画面だけを描く。
 *
 * ---- 他ファイルとの共通契約（この名前どおりに使う。似た名前を作らない）----
 * 画面登録   App.registerScreen('S10', { render: function (root, params) {} });
 *            第2引数は必ず { render: 関数 } のオブジェクト。関数をそのまま渡さない。
 * 画面遷移   location.hash = '#/S10?id=<プロジェクトID>'（ハッシュルーターは app.js）
 *            S11 / S12 は '#/S11?id=<プロジェクトID>&reportId=<分析レポートID>'
 *            S13 だけ 'report=' の綴りで渡してくるため、S11 / S12 は
 *            reportId と report の両方を受け取れるようにしてある。
 * 通信       api.js の window.Api だけを使う。
 *              Api.projects.get(id)
 *              Api.analysisReports.list(options) / .get(id) / .insert(row) / .update(id, patch)
 *              Api.credits.costOf(featureKey) / Api.credits.hasUnlimited(user)
 *              Api.storage.get|set（'projectId' と 'analysisReportId' のみ）
 *            業務データは localStorage に置かない（保存先は Supabase）。
 * 文言       i18n.js の window.I18N.t(key) を使う。辞書に無いキーは作らず、
 *            このファイル内の LOCAL（ja / en / ko の3言語）で補って t(key) で引く。
 *            LOCAL のキーは 'sa.' 's10.' 's11.' 's12.' 'sec.' 'secDesc.' 'fac.'
 *            'item.' 'media.' で始め、i18n.js のキーと衝突させない。
 * DOM        index.html が用意した id だけを触る。
 *              #header-title / #header-back / #header-action /
 *              #banner-root / #toast-root / #modal-root
 * class      styles.css に実在する綴りだけを使う。
 *              screen / screen__head / screen__title / screen__lead / section /
 *              section__head / section__title / section__desc / stack / stack--tight /
 *              row--input-action / btn-row / card / card--soft / card__label /
 *              card__value / card__unit / card__sub / card__foot / list / list__head /
 *              list-row / list-row__body / list-row__title / list-row__sub /
 *              list-row__meta / list-row__action / list-row__handle /
 *              list-row--sortable / list-row--dragging / list-row--danger /
 *              info-list / info-row / info-row__key / info-row__val /
 *              check-row / check-row__box / check-row__label / check-row__note /
 *              field / field__label / field__hint / field__error / input / select /
 *              chips / chip / chip--selected / tabs / tabs__item / tabs__item--active /
 *              badge / badge--ok / badge--warn / badge--mute / thumb-grid / thumb /
 *              thumb-add / btn / btn--primary / btn--secondary / btn--text /
 *              btn--block / btn--sm / warn-box / note-box / empty / empty__text /
 *              skeleton / skeleton--title / skeleton--card / skeleton--row /
 *              loading-text / banner / banner__text / banner__retry / toast /
 *              toast__text / modal / modal__title / modal__body / modal__actions /
 *              modal__actions--1 / t-note / t-danger / t-center / t-sub / t-body /
 *              num / break-url / clamp-2
 *
 * ---- 消費ポイント ----
 *   確認だけの画面（旧 S16）は廃止した。何にいくらかかるかは、それを実行する
 *   画面に出す（S11 は分析の 40P、S12 は 選んだ層 × 成果物 の積み上げ）。
 *   引き落とすのは各 Edge Function が成功したあと。画面側では引き落とさない。
 *   機能キーは a2f58db45_feature_credits と同じ綴り：
 *     competitor_analysis 40 / own_lp 60 / crowdfunding_lp 60 /
 *     kv_creative 30 / meta_ads 30
 *
 * ---- S13 生成結果への受け渡し ----
 *   S12 の「この内容で生成する」で置く。S13 は一度だけ読んで消す。
 *     App.state.generateRequest = { projectId, reportId, targets: ['A', ...],
 *                                   features: [{ feature_key, kind, credit_cost }], at }
 *
 * ---- 分析レポート1行の使い方（a2f58db45_analysis_reports）----
 *   projects_id      プロジェクトID
 *   competitor_urls  ['https://...', ...] 最大5件
 *   source_platforms ['makuake', 'campfire', ...] competitor_urls と同じ並び
 *   kv_selectors     { makuake: { selectors: [...], media: ['text','image','video'] }, ... }
 *   lp_selectors     同上
 *   kv_assets        [{ url, platform, selectors, auto, basisKey, counts, items }]
 *   lp_assets        同上
 *   page_structure   { summary, sections: [{ key, title, body, role, hook, emotion, cta, priceShown }] }
 *                    競合LPを上から区画に割った構造・流れ分析（1段階目）
 *   success_factors  { summary, items: [{ key, title, body, kind, weight, evidence }] }
 *   common_points    [{ key, label, body, sources: [url...], weight }] 競合に共通していた型（2段階目）
 *   prompts          { own_lp, crowdfunding_lp, kv, meta_ads } 生成プロンプト本文（2段階目）
 *   prompt_status    'none' / 'pending' / 'done' / 'error'
 *   collection_errors[{ url, platform, kind, reasonKey, message }]
 *   analysis_status  'draft'（S10 で保存しただけ）/ 'pending'（実行待ち）/
 *                    'done'（収集済み）/ 'error'（保存に失敗）
 *
 * ---- この環境の正直な断り ----
 *   このアプリが通信してよいのは Supabase だけで、競合LPへ直接アクセスできない。
 *   そのため KV・LP の「収集結果」は、URL・プラットフォーム判定・収集セレクタ設定から
 *   毎回同じ結果になるように組み立てた想定データである。
 *   その旨は S10 と S11 の画面上に1行で明記している。
 *
 * 無い関数は黙って飛ばさない。何が無いのかを console.error に必ず残す。
 * ============================================================ */

(function (window, document) {
  'use strict';

  var App = window.App = window.App || {};

  /* ---------- 依存の確認 ---------- */
  if (typeof App.registerScreen !== 'function') {
    console.error('[screens-analysis] App.registerScreen が見つかりません。index.html の読み込み順（app.js -> screens-analysis.js）を確認してください。登録内容は window.App.screens に控えます。');
    App.screens = App.screens || {};
    App.registerScreen = function (id, spec) {
      if (!spec || typeof spec.render !== 'function') {
        console.error('[screens-analysis] registerScreen の第2引数は { render: 関数 } である必要があります。画面ID: ' + id);
        return;
      }
      App.screens[id] = spec;
    };
  }
  if (!window.Api) {
    console.error('[screens-analysis] window.Api が見つかりません。api.js が読み込まれているか確認してください。競合分析・分析レポート・分析内容確認は動きません。');
  }
  if (!window.I18N || typeof window.I18N.t !== 'function') {
    console.error('[screens-analysis] window.I18N.t が見つかりません。i18n.js が読み込まれているか確認してください。i18n.js 側の文言はキーのまま表示されます。');
  }

  /* ---------- 定数 ---------- */
  var MAX_URLS = 5;
  var LOCALES = ['ja', 'en', 'ko'];

  /* 機能キーと既定値は a2f58db45_feature_credits と同じにする */
  var FEATURE_ANALYSIS = 'competitor_analysis';
  var COST_ANALYSIS_FALLBACK = 40;

  var STATUS_DRAFT = 'draft';
  var STATUS_PENDING = 'pending';
  var STATUS_DONE = 'done';
  var STATUS_ERROR = 'error';

  /* GIF は image と分けて数える。動きで見せている区画かどうかが一目で分かるように */
  var MEDIA_TYPES = ['text', 'image', 'gif', 'video'];

  /* 生成プロンプトの種類。この順で S12 に並ぶ */
  var PROMPT_KINDS = ['own_lp', 'crowdfunding_lp', 'kv', 'meta_ads'];

  /* 成果物と、消費ポイントを引く機能キー（a2f58db45_feature_credits の綴り）。
     KV だけ画面側の呼び名と機能キーがずれているので、ここで対応させる */
  var KIND_FEATURE = {
    own_lp: 'own_lp',
    crowdfunding_lp: 'crowdfunding_lp',
    kv: 'kv_creative',
    meta_ads: 'meta_ads'
  };
  var KIND_COST_FALLBACK = { own_lp: 60, crowdfunding_lp: 60, kv: 30, meta_ads: 30 };

  /* 生成プロンプト1本ぶんを、ターゲット層と成果物の組で正規化する。
     { target, kind, brief, images: [{slot, prompt}], videos: [{slot, prompt}] }
     画像は ChatGPT image2、動画は segmind に渡す前提で書かせる。 */
  function promptItemsOf(report) {
    var raw = report && report.prompts;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch (e) { raw = null; }
    }
    if (!raw || typeof raw !== 'object') { return []; }

    function slots(list) {
      return asArray(list).map(function (one) {
        if (typeof one === 'string') { return { slot: '', prompt: one }; }
        return { slot: String(one.slot || ''), prompt: String(one.prompt || '') };
      });
    }

    if (Array.isArray(raw.items)) {
      return raw.items.map(function (one) {
        return {
          target: String(one.target || ''),
          kind: String(one.kind || ''),
          brief: String(one.brief || ''),
          images: slots(one.images),
          videos: slots(one.videos)
        };
      }).filter(function (one) { return PROMPT_KINDS.indexOf(one.kind) !== -1; });
    }

    /* ターゲット層別にする前の形（成果物ごとに本文1本だけ）。捨てずに読む */
    return PROMPT_KINDS.filter(function (kind) { return raw[kind]; }).map(function (kind) {
      return { target: '', kind: kind, brief: String(raw[kind]), images: [], videos: [] };
    });
  }

  /* 競合の結果。失敗例は「避けるべき型」の根拠になる */
  var OUTCOMES = ['success', 'failure', 'unknown'];

  /* GREENFUNDING は意図書の指定どおりの綴りをそのまま保持する */
  var GF_SELECTOR = 'div[id="container container--project_wide container-flex"]';

  var PLATFORMS = [
    {
      key: 'makuake',
      name: 'Makuake',
      i18n: 'analysis.platform.makuake',
      hosts: ['makuake.com'],
      kv: ['div#media', 'div#thumbnailList'],
      lp: ['div#main']
    },
    {
      key: 'campfire',
      name: 'CAMPFIRE',
      i18n: 'analysis.platform.campfire',
      hosts: ['camp-fire.jp', 'campfire.jp'],
      kv: ['div.hero-pc-left.svelte-e9kowv'],
      lp: ['div#main']
    },
    {
      key: 'greenfunding',
      name: 'GREENFUNDING',
      i18n: 'analysis.platform.greenfunding',
      hosts: ['greenfunding.jp', 'green-funding.jp'],
      kv: [GF_SELECTOR],
      lp: [GF_SELECTOR]
    },
    {
      key: 'machiya',
      name: 'Machi-ya',
      i18n: 'analysis.platform.machiya',
      hosts: ['machi-ya.jp'],
      kv: ['div.hero-pc-left.svelte-e9kowv'],
      lp: ['div#main']
    },
    {
      key: 'other',
      name: 'その他',
      i18n: 'analysis.platform.other',
      hosts: [],
      kv: [],
      lp: []
    }
  ];

  /* ------------------------------------------------------------------
   * 追加辞書
   * i18n.js の辞書に無い文言だけをここに置く。値は [ja, en, ko] の順。
   * i18n.js にあるキー（analysis.* / report.* / reportConfirm.* / common.* /
   * creditConfirm.* / validation.* / project.*）はここに重ねない。
   * ------------------------------------------------------------------ */
  var LOCAL = {
    /* ---- 構造・流れ分析（1段階目）と、共通点まとめ＋プロンプト作成（2段階目） ---- */
    'flow.title': ['構造・流れ分析', 'Structure and flow', '구조·흐름 분석'],
    'flow.lead': [
      '競合LPを上から下まで区画に割り、それぞれが読み手に何をさせる区画なのか、次へどう渡しているのかを見ています。',
      'Each competitor page is split into blocks, showing what each block asks of the reader and how it hands over to the next.',
      '경쟁 페이지를 위에서 아래로 구획으로 나누고, 각 구획이 독자에게 무엇을 시키는지, 다음으로 어떻게 넘기는지를 봅니다.'
    ],
    'flow.role': ['役割', 'Role', '역할'],
    'flow.hook': ['次へのつなぎ', 'Hand-off', '다음으로 넘기는 방식'],
    'flow.emotion': ['読み手の状態', 'Reader state', '독자의 상태'],
    'cp.title': ['競合に共通していた型', 'Patterns shared across competitors', '경쟁사에 공통된 형태'],
    'cp.lead': [
      '登録した競合をすべて突き合わせ、多くのページが共通してやっていたことを上から並べています。上にあるものほど「外すと不利になる型」です。',
      'All registered competitors were compared. What most pages do in common is listed first — the higher it sits, the more costly it is to skip.',
      '등록한 경쟁사를 모두 대조해, 여러 페이지가 공통으로 하고 있던 것을 위에서부터 나열했습니다. 위에 있을수록 빼면 불리한 형태입니다.'
    ],
    'cp.sources': ['{n}件中 {m}件', '{m} of {n} pages', '{n}건 중 {m}건'],
    'cp.count': ['{n}件', '{n} patterns', '{n}건'],
    'oc.title': ['この競合の結果', 'How it did', '이 경쟁사의 결과'],
    'oc.success': ['達成した', 'Succeeded', '달성함'],
    'oc.failure': ['伸びなかった', 'Fell short', '부진했음'],
    'oc.unknown': ['未指定', 'Not set', '미지정'],
    'oc.hint': [
      '高額を達成した競合だけでなく、伸びなかった競合も貼ってください。失敗例に共通していた型は「避けるべき型」としてまとめに出ます。',
      'Add the ones that fell short as well as the winners. Patterns shared by the failures are surfaced as things to avoid.',
      '고액을 달성한 경쟁사뿐 아니라 부진했던 경쟁사도 붙여 주세요. 실패 사례에 공통된 형태는 「피해야 할 형태」로 정리됩니다.'
    ],
    'cp.do': ['真似すべき型', 'Do this', '따라야 할 형태'],
    'cp.avoid': ['避けるべき型', 'Avoid this', '피해야 할 형태'],
    'pr.targets': ['作るターゲット層', 'Which audiences to build for', '만들 타깃층'],
    'pr.targetsHint': [
      '選んだ層のぶんだけ、自社LP・クラファンLP・KV・メタ広告バナーを作ります。あとから他の層を追加で作ることもできます。',
      'An own-site LP, a crowdfunding LP, a key visual and Meta ad banners are produced for each audience you pick. You can add the others later.',
      '선택한 층의 수만큼 자사 LP·크라우드펀딩 LP·KV·메타 광고 배너를 만듭니다. 나중에 다른 층을 추가로 만들 수도 있습니다.'
    ],
    'pr.needTarget': ['作るターゲット層を1つ以上選んでください。', 'Pick at least one audience.', '만들 타깃층을 하나 이상 선택해 주세요.'],
    'pr.selected': ['{n}層 × 4種類 ＝ {m}本', '{n} audiences x 4 kinds = {m} pieces', '{n}개 층 × 4종류 = {m}개'],
    'pr.brief': ['作る指示', 'The brief', '만들 지시'],
    'pr.images': ['画像プロンプト（ChatGPT image2）', 'Image prompts (ChatGPT image2)', '이미지 프롬프트(ChatGPT image2)'],
    'pr.videos': ['動画プロンプト（segmind）', 'Video prompts (segmind)', '동영상 프롬프트(segmind)'],
    'pr.noAsset': ['この成果物に画像・動画の指定はありません。', 'No image or video is specified for this piece.', '이 결과물에는 이미지·동영상 지정이 없습니다.'],
    'pr.base': ['全体に効く前提', 'Shared ground rules', '전체에 적용되는 전제'],
    'pr.baseHint': [
      '商品の事実、競合に共通していた型、書いてはいけないこと。下の全プロンプトの先頭に付きます。',
      'Product facts, the patterns shared by competitors, and what must not be written. Prepended to every prompt below.',
      '상품의 사실, 경쟁사에 공통된 형태, 써서는 안 되는 것. 아래 모든 프롬프트 앞에 붙습니다.'
    ],
    'pr.costLine': [
      'この分析で {n}P 使います（残高 {b}P）', 'Uses {n}P (balance {b}P)', '이 분석에 {n}P 사용합니다(잔액 {b}P)'
    ],
    'pr.apiNote': [
      '画像と動画のAPIはまだ接続していません。いまは指示文だけが作られ、実際の生成はこちらで確定します。',
      'The image and video APIs are not connected yet. For now only the instructions are produced; the assets are filled in manually.',
      '이미지와 동영상 API는 아직 연결하지 않았습니다. 지금은 지시문만 만들어지고, 실제 생성은 수동으로 채웁니다.'
    ],
    'cp.empty': [
      'まだ共通点をまとめていません。下のボタンで、競合の分析をひとつにまとめて生成プロンプトを作ります。',
      'The competitors have not been consolidated yet. Use the button below to merge them and write the generation prompts.',
      '아직 공통점을 정리하지 않았습니다. 아래 버튼으로 경쟁사 분석을 하나로 합쳐 생성 프롬프트를 만듭니다.'
    ],
    'prompt.build': ['共通点をまとめて生成プロンプトを作る', 'Consolidate and write the prompts', '공통점을 정리해 생성 프롬프트 만들기'],
    'prompt.rebuild': ['プロンプトを作り直す', 'Rewrite the prompts', '프롬프트 다시 만들기'],
    'prompt.open': ['生成プロンプトを見る', 'Open the generation prompts', '생성 프롬프트 보기'],
    'prompt.buildFailed': [
      'プロンプトの作成に失敗しました。時間をおいて実行してください。',
      'Writing the prompts failed. Please try again later.',
      '프롬프트 작성에 실패했습니다. 잠시 후 다시 실행해 주세요.'
    ],
    'prompt.title': ['生成プロンプト', 'Generation prompts', '생성 프롬프트'],
    'prompt.lead': [
      '共通点のまとめから、作るもの別にプロンプトを書き起こしました。そのままでも、直してからでも生成に進めます。',
      'Prompts were written from the consolidated findings, one per deliverable. Generate as-is, or edit first.',
      '공통점 정리에서 만들 것별로 프롬프트를 작성했습니다. 그대로도, 고친 뒤에도 생성으로 넘어갈 수 있습니다.'
    ],
    'prompt.own_lp': ['自社LP用', 'Own-site LP', '자사 LP용'],
    'prompt.own_lpDesc': [
      '自社サイトに置くLP。応援購入ではなく購入が終点なので、返品・保証・配送とカート導線を最後に置きます。',
      'The LP for your own site. The endpoint is a purchase, not backing, so returns, warranty, shipping and the cart sit at the end.',
      '자사 사이트에 두는 LP. 응원 구매가 아니라 구매가 종점이므로 반품·보증·배송과 장바구니 동선을 마지막에 둡니다.'
    ],
    'prompt.crowdfunding_lp': ['クラファンプラットフォーム用', 'Crowdfunding platform', '크라우드펀딩 플랫폼용'],
    'prompt.crowdfunding_lpDesc': [
      'makuake・CAMPFIRE などに載せるLP。応援購入の言い回し、リターン表、開発ストーリー、実行者紹介が要ります。',
      'The LP for makuake, CAMPFIRE and the like: backing-style wording, a reward table, the development story and a maker introduction.',
      'makuake·CAMPFIRE 등에 올리는 LP. 응원 구매 표현, 리워드 표, 개발 스토리, 실행자 소개가 필요합니다.'
    ],
    'prompt.kv': ['KV（キービジュアル）', 'Key visual', 'KV(키 비주얼)'],
    'prompt.kvDesc': [
      '一番上に置く1枚。競合が共通して見せていた画づくりを踏まえた指示です。',
      'The single image at the top, based on the framing the competitors shared.',
      '가장 위에 두는 한 장. 경쟁사가 공통으로 보여주던 화면 구성을 반영한 지시입니다.'
    ],
    'prompt.meta_ads': ['メタ広告バナー', 'Meta ad banners', '메타 광고 배너'],
    'prompt.meta_adsDesc': [
      'Facebook・Instagram の広告バナー。訴求の切り口ごとに複数案を出す指示です。',
      'Facebook and Instagram ad banners, with several variants by angle.',
      'Facebook·Instagram 광고 배너. 소구 관점별로 여러 안을 내는 지시입니다.'
    ],
    'prompt.notReady': [
      'まだ生成プロンプトがありません。分析レポートから作成してください。',
      'There are no generation prompts yet. Create them from the analysis report.',
      '아직 생성 프롬프트가 없습니다. 분석 리포트에서 만들어 주세요.'
    ],
    'prompt.toReport': ['総合分析へ戻る', 'Back to the overview', '종합 분석으로 돌아가기'],
    'prompt.saveFailed': [
      'プロンプトの保存に失敗しました。',
      'Saving the prompts failed.',
      '프롬프트 저장에 실패했습니다.'
    ],
    'prompt.generateWith': ['この内容で生成する', 'Generate with this', '이 내용으로 생성하기'],
    'prompt.edited': ['編集済み', 'Edited', '수정함'],
    /* ---- この3画面で共通の言い回し ---- */
    'sa.serverAnalysisNote': [
      '分析はサーバーが競合ページを実際に取得して行います。ページの規模により1〜2分かかることがあります。',
      'The analysis fetches the competitor pages on the server. It can take 1–2 minutes depending on page size.',
      '분석은 서버가 경쟁 페이지를 실제로 가져와 수행합니다. 페이지 규모에 따라 1~2분 걸릴 수 있습니다.'
    ],
    'sa.analysisFailed': [
      '分析に失敗しました。時間をおいて再実行してください。',
      'The analysis failed. Please try again later.',
      '분석에 실패했습니다. 잠시 후 다시 실행해 주세요.'
    ],
    'sa.analysisQueued': [
      '分析を受け付けました。完了までこの画面でお待ちください（開発モード：ローカルエージェントが処理します）。',
      'The analysis has been queued. Please wait on this screen (dev mode: a local agent will process it).',
      '분석이 접수되었습니다. 완료까지 이 화면에서 기다려 주세요(개발 모드: 로컬 에이전트가 처리합니다).'
    ],
    'sa.verdictTitle': ['プロジェクト成否判定', 'Project outcome', '프로젝트 성패 판정'],
    'sa.verdictLead': ['公開データ（目標金額・応援購入総額）による機械判定です', 'Judged from public data (goal and total raised).', '공개 데이터(목표 금액·응원 구매 총액)에 따른 자동 판정입니다'],
    'sa.verdictSuccess': ['成功', 'Success', '성공'],
    'sa.verdictFailure': ['失敗', 'Failure', '실패'],
    'sa.verdictUnknown': ['判定不可', 'Unknown', '판정 불가'],
    'sa.verdictGoal': ['目標金額', 'Goal', '목표 금액'],
    'sa.verdictTotal': ['応援購入総額', 'Total raised', '응원 구매 총액'],
    'sa.verdictSupporters': ['サポーター', 'Supporters', '서포터'],
    'sa.verdictRatio': ['達成率', 'Achievement', '달성률'],
    'sa.factorTitle': ['成功・失敗要因', 'Success & failure factors', '성공·실패 요인'],
    'sa.factorKindSuccess': ['成功要因', 'Success factor', '성공 요인'],
    'sa.factorKindFailure': ['失敗要因', 'Failure factor', '실패 요인'],
    'sa.noProject': [
      'プロジェクトが選ばれていません。ダッシュボードからプロジェクトを開いてください。',
      'No project is selected. Please open a project from the dashboard.',
      '프로젝트가 선택되지 않았습니다. 대시보드에서 프로젝트를 열어 주세요.'
    ],
    'sa.toDashboard': ['ダッシュボードへ', 'Go to dashboard', '대시보드로'],
    'sa.toProjectDetail': ['プロジェクト詳細へ', 'Go to project', '프로젝트 상세로'],
    'sa.saving': ['保存中…', 'Saving…', '저장 중…'],
    'sa.platformLabel': ['プラットフォーム', 'Platform', '플랫폼'],

    'media.text': ['テキスト', 'Text', '텍스트'],
    'media.image': ['画像', 'Images', '이미지'],
    'media.gif': ['GIF', 'GIF', 'GIF'],
    'media.video': ['動画', 'Video', '동영상'],
    'media.all': ['すべて', 'All', '전체'],

    /* ---- S10 競合分析 ---- */
    's10.lead': [
      '売れている競合LPのURLを最大5件まで追加します。ドメインからプラットフォームを自動で判定します。',
      'Add up to five competitor landing page URLs. The platform is detected automatically from the domain.',
      '잘 팔리는 경쟁 LP의 URL을 최대 5개까지 추가합니다. 도메인에서 플랫폼을 자동으로 판별합니다.'
    ],
    's10.urlPlaceholder': ['https://www.makuake.com/project/...', 'https://www.makuake.com/project/...', 'https://www.makuake.com/project/...'],
    's10.count': ['{n}/{max}件', '{n} of {max}', '{n}/{max}개'],
    's10.maxReached': [
      'URLは5件までです。追加するには登録済みの行を削除してください。',
      'You can add five URLs at most. Remove a row to add another one.',
      'URL은 5개까지입니다. 추가하려면 등록된 행을 삭제해 주세요.'
    ],
    's10.duplicate': ['このURLはすでに追加されています', 'This URL has already been added', '이 URL은 이미 추가되어 있습니다'],
    's10.emptyUrl': ['URLを入力してください', 'Please enter a URL', 'URL을 입력해 주세요'],
    's10.added': ['競合LPを追加しました', 'Competitor LP added', '경쟁 LP를 추가했습니다'],
    's10.removed': ['競合LPを削除しました', 'Competitor LP removed', '경쟁 LP를 삭제했습니다'],
    's10.rowHint': [
      '行を左にスワイプ、または×でURLを削除できます。プラットフォームは行の中で手動変更できます。',
      'Swipe a row left or tap × to remove the URL. You can change the platform inside the row.',
      '행을 왼쪽으로 스와이프하거나 ×로 URL을 삭제할 수 있습니다. 플랫폼은 행 안에서 직접 바꿀 수 있습니다.'
    ],
    's10.remove': ['このURLを削除', 'Remove this URL', '이 URL 삭제'],
    's10.platformChanged': ['プラットフォームを{name}に変更しました', 'Platform changed to {name}', '플랫폼을 {name}(으)로 변경했습니다'],
    's10.kvDesc': [
      'KV（メインビジュアル）を取り出す範囲です。プラットフォームごとの既定セレクタが入っています。',
      'Where the key visual is collected from. Default selectors are filled in per platform.',
      'KV(메인 비주얼)를 가져올 범위입니다. 플랫폼별 기본 셀렉터가 들어 있습니다.'
    ],
    's10.lpDesc': [
      'LP本文を取り出す範囲です。ページ構成の取得範囲がここで決まります。',
      'Where the landing page body is collected from. This decides the scope of the page structure.',
      'LP 본문을 가져올 범위입니다. 페이지 구성의 취득 범위가 여기서 정해집니다.'
    ],
    's10.selector': ['セレクタ', 'Selector', '셀렉터'],
    's10.selectorAdd': ['セレクタを追加', 'Add selector', '셀렉터 추가'],
    's10.selectorRemove': ['このセレクタを削除', 'Remove this selector', '이 셀렉터 삭제'],
    's10.selectorReset': ['既定に戻す', 'Reset to default', '기본값으로'],
    's10.selectorEmptyWarn': [
      'セレクタが空です。このままだと該当URLは収集エラーになります。',
      'The selector is empty. Those URLs will be reported as collection errors.',
      '셀렉터가 비어 있습니다. 이대로면 해당 URL은 수집 오류가 됩니다.'
    ],
    's10.mediaLabel': ['収集する種別', 'Content types to collect', '수집할 종류'],
    's10.mediaNoneWarn': [
      '種別を1つも選んでいません。このままだと収集結果が空になり、エラーとして記録されます。',
      'No content type is selected. The collection will come back empty and be logged as an error.',
      '종류를 하나도 선택하지 않았습니다. 이대로면 수집 결과가 비어 오류로 기록됩니다.'
    ],
    's10.autoDetect': ['自動判定', 'Auto detect', '자동 판별'],
    's10.autoDetectNote': [
      'その他のページはセレクタを空のままにすると、ページ構造を精査してKV領域とLP本文領域を判定し、採用したセレクタを根拠としてレポートに表示します。',
      'For other pages, leave the selector empty and the page structure is inspected to decide the KV and body areas; the selector that was adopted is shown in the report.',
      '기타 페이지는 셀렉터를 비워 두면 페이지 구조를 살펴 KV 영역과 LP 본문 영역을 판별하고, 채택한 셀렉터를 근거로 리포트에 표시합니다.'
    ],
    's10.summary': ['未収集 {uncollected}件 / エラー {errors}件', 'Not collected: {uncollected} / Errors: {errors}', '미수집 {uncollected}건 / 오류 {errors}건'],
    's10.needUrl': ['競合LPのURLを1件以上追加してください', 'Please add at least one competitor URL', '경쟁 LP URL을 1개 이상 추가해 주세요'],
    's10.runNote': ['押すとその場で分析を始めます。{cost}Pを消費します。', 'Starts the analysis right away and uses {cost} P.', '누르면 바로 분석을 시작하고 {cost}P를 사용합니다.'],
    's10.savedDraft': ['入力中の内容を保存しました', 'Your work in progress has been saved', '입력 중인 내용을 저장했습니다'],
    's10.saveFailed': ['競合LPの保存に失敗しました', 'Failed to save the competitor list', '경쟁 LP 저장에 실패했습니다'],
    's10.loadFailed': ['競合分析の読み込みに失敗しました', 'Failed to load the competitor analysis', '경쟁 분석을 불러오지 못했습니다'],
    's10.noPlatformYet': [
      'URLを追加すると、そのプラットフォームの収集設定がここに出ます。',
      'Add a URL and the collection settings for its platform appear here.',
      'URL을 추가하면 해당 플랫폼의 수집 설정이 여기에 표시됩니다.'
    ],

    /* ---- S11 分析レポート ---- */
    's11.lead': [
      '登録した競合リンク1件ずつの結果です。左右のボタンで送ると、次のリンクの結果に移ります。',
      'One card per competitor link. Use the arrows to move to the next link.',
      '등록한 경쟁 링크별 결과입니다. 좌우 버튼으로 다음 링크의 결과로 이동합니다.'
    ],
    's11.toOverall': ['総合分析を見る', 'View the overview', '종합 분석 보기'],
    'overall.title': ['総合分析', 'Overview', '종합 분석'],
    'overall.lead': [
      '登録した競合すべてを突き合わせた結果です。共通していた型・LPの流れ・成功と失敗の要因をまとめています。',
      'Everything the competitor pages had in common: the shared pattern, the flow, and what worked or fell short.',
      '등록한 경쟁사를 모두 대조한 결과입니다. 공통된 형·LP 흐름·성공과 실패 요인을 정리했습니다.'
    ],
    'overall.toSources': ['リンクごとの結果に戻る', 'Back to the per-link results', '링크별 결과로 돌아가기'],
    's11.draftTitle': ['この分析はまだ実行されていません', 'This analysis has not been run yet', '이 분석은 아직 실행되지 않았습니다'],
    's11.draftBody': [
      '競合LPの登録は保存済みです。ポイント消費確認から分析を実行してください。',
      'Your competitor list is saved. Run the analysis from the point confirmation screen.',
      '경쟁 LP 등록은 저장되어 있습니다. 포인트 사용 확인에서 분석을 실행해 주세요.'
    ],
    's11.collecting': ['収集しています…', 'Collecting…', '수집하는 중…'],
    's11.runFailed': ['分析結果の保存に失敗しました', 'Failed to save the analysis result', '분석 결과 저장에 실패했습니다'],
    's11.counts': ['テキスト{text} / 画像{image} / GIF{gif} / 動画{video}', 'Text {text} / Images {image} / GIF {gif} / Video {video}', '텍스트 {text} / 이미지 {image} / GIF {gif} / 동영상 {video}'],
    's11.openAll': ['すべて見る', 'View all', '전체 보기'],
    's11.kvOpenTitle': ['収集したKV（{n}件）', 'Collected KV ({n})', '수집한 KV({n}건)'],
    's11.lpOpenTitle': ['収集したLP（{n}件）', 'Collected LP ({n})', '수집한 LP({n}건)'],
    's11.tapKv': ['タップすると収集したKVを種別ごとに一覧できます', 'Tap to list the collected KV by content type', '탭하면 수집한 KV를 종류별로 볼 수 있습니다'],
    's11.tapLp': ['タップするとLP本文を上から順に読めます', 'Tap to read the LP body from the top', '탭하면 LP 본문을 위에서부터 읽을 수 있습니다'],
    's11.weight': ['重要度 {n}', 'Importance {n}', '중요도 {n}'],
    's11.evidence': ['根拠：{url}', 'Evidence: {url}', '근거: {url}'],
    's11.jumpDone': ['根拠の競合LPまで移動しました', 'Jumped to the competitor it came from', '근거가 된 경쟁 LP로 이동했습니다'],
    's11.order': ['{n}番目', 'Position {n}', '{n}번째'],
    's11.ratio': ['本文に占める割合', 'Share of the body', '본문 비중'],
    's11.hasCta': ['CTAあり', 'Has CTA', 'CTA 있음'],
    's11.hasPrice': ['価格の見せ場', 'Price is shown here', '가격 노출 지점'],
    's11.selectorUsed': ['採用セレクタ', 'Selector used', '채택한 셀렉터'],
    's11.basis': ['判定の根拠', 'Why this selector', '판별 근거'],
    's11.basisAuto': [
      'ページ構造を精査し、見出しと画像がまとまった最初のブロックをKV領域と判定しました。',
      'The page structure was inspected and the first block that groups a heading with images was treated as the KV area.',
      '페이지 구조를 살펴 제목과 이미지가 모인 첫 블록을 KV 영역으로 판별했습니다.'
    ],
    's11.basisAutoLp': [
      'ページ構造を精査し、本文セクションが最も多く連なるブロックをLP本文領域と判定しました。',
      'The page structure was inspected and the block with the most consecutive body sections was treated as the LP body.',
      '페이지 구조를 살펴 본문 섹션이 가장 많이 이어지는 블록을 LP 본문 영역으로 판별했습니다.'
    ],
    's11.errorTitle': ['収集エラー {n}件', 'Collection errors: {n}', '수집 오류 {n}건'],
    's11.errorContinue': ['エラーのあった範囲以外の分析は続けています。', 'Everything else was analysed as usual.', '오류가 난 범위 외의 분석은 계속했습니다.'],
    's11.errSelectorMissing': ['セレクタが空のため収集できませんでした', 'The selector was empty, so nothing could be collected', '셀렉터가 비어 있어 수집하지 못했습니다'],
    's11.errMediaNone': ['収集する種別が選ばれておらず、結果が空でした', 'No content type was selected, so the result was empty', '수집할 종류가 선택되지 않아 결과가 비었습니다'],
    's11.errNotFound': ['指定セレクタがページに見つかりませんでした', 'The given selector was not found on the page', '지정한 셀렉터를 페이지에서 찾지 못했습니다'],
    's11.assetStrip': ['収集した素材（横に送って見る）', 'Collected assets (scroll sideways)', '수집한 소재(옆으로 넘겨서 보기)'],
    's11.kindKv': ['KV', 'KV', 'KV'],
    's11.kindLp': ['LP本文', 'LP body', 'LP 본문'],
    's11.createdAt': ['作成日時', 'Created', '생성 일시'],
    's11.urlCount': ['競合LP {n}件', '{n} competitor LPs', '경쟁 LP {n}건'],
    's11.sourcePos': ['{n} / {total} 件目', 'Competitor {n} of {total}', '{n} / {total}번째'],
    's11.prevSource': ['前の競合LP', 'Previous competitor', '이전 경쟁 LP'],
    's11.nextSource': ['次の競合LP', 'Next competitor', '다음 경쟁 LP'],
    's11.sourceFlow': ['この競合ページの流れ', 'How this competitor page flows', '이 경쟁 페이지의 흐름'],
    's11.sourceFactors': ['この競合ページの重要要素', 'Key elements of this competitor page', '이 경쟁 페이지의 중요 요소'],
    's11.openHint': ['項目を押すと詳しく見られます', 'Tap a row to see the details', '항목을 누르면 자세히 볼 수 있습니다'],
    's11.roleLabel': ['この区画の役割', 'What this block does', '이 구획의 역할'],
    's11.bodyLabel': ['何が置かれていたか', 'What was placed here', '무엇이 놓여 있었는가'],
    's11.hookLabel': ['次へのつなぎ', 'How it leads to the next block', '다음으로 넘기는 방법'],
    's11.emotionLabel': ['読み手の状態', 'Where the reader is', '읽는 사람의 상태'],
    's11.marksLabel': ['この区画にあるもの', 'What this block contains', '이 구획에 있는 것'],
    's11.assetsLabel': ['ここに置かれていた素材', 'The assets placed here', '여기에 놓여 있던 소재'],
    's11.kvAssets': ['KV（最初の1画面）の素材', 'Key visual assets', 'KV(첫 화면)의 소재'],
    's11.lpAssets': ['LP本文の素材', 'Body assets', 'LP 본문의 소재'],
    's11.assetsMissing': [
      'この区画の素材は、古い分析には記録されていません。再分析すると、区画ごとに素材が並びます。',
      'Per-block assets are not stored in this older analysis. Re-run it to see them here.',
      '이 구획의 소재는 이전 분석에는 기록되어 있지 않습니다. 다시 분석하면 구획별 소재가 표시됩니다.'
    ],
    's11.noPrice': ['価格の表示なし', 'No price shown', '가격 표시 없음'],
    's11.noCta': ['CTAなし', 'No CTA', 'CTA 없음'],
    's11.factorSuccess': ['真似したい点', 'Worth copying', '따라 하고 싶은 점'],
    's11.factorFailure': ['避けたい点', 'Worth avoiding', '피하고 싶은 점'],
    's11.factorSuccessHint': [
      'このページが伸びた理由。自分のLPにも取り入れる価値がある。',
      'Why this page did well. Worth bringing into your own LP.',
      '이 페이지가 잘된 이유. 자신의 LP에도 가져올 가치가 있다.'
    ],
    's11.factorFailureHint': [
      'このページの弱いところ。赤で出しているのはここ。自分のLPでは同じことをしない。',
      'The weak points of this page, shown in red. Do not repeat them in your own LP.',
      '이 페이지의 약한 부분. 빨간색으로 표시된 곳. 자신의 LP에서는 같은 실수를 하지 않는다.'
    ],
    's11.factorLegend': [
      '赤は「避けたい点」（このページの弱いところ）です',
      'Red marks the weak points to avoid',
      '빨간색은 "피하고 싶은 점"(이 페이지의 약한 부분)입니다'
    ],
    'error.pageUnreadable': [
      'このページを開けませんでした。URLが変わっていないか確認してください。',
      'Could not open this page. Check whether the URL has changed.',
      '이 페이지를 열 수 없었습니다. URL이 변경되지 않았는지 확인해 주세요.'
    ],
    's11.noAsset': ['収集できたコンテンツがありません', 'Nothing could be collected', '수집된 콘텐츠가 없습니다'],
    's11.reAnalyze': ['競合LPを追加して再分析', 'Add competitors and analyse again', '경쟁 LP를 추가해 재분석'],
    's11.reportEmptyAction': ['競合LP分析を始める', 'Start competitor analysis', '경쟁 LP 분석 시작'],

    /* ---- S12 分析内容確認 ---- */
    's12.lead': [
      '生成に反映する勝ちパターンを確認します。外した要素は生成に使いません。',
      'Check the winning pattern that will be applied. Unchecked items are left out of the generation.',
      '생성에 반영할 성공 패턴을 확인합니다. 해제한 요소는 생성에 사용하지 않습니다.'
    ],
    's12.selectAll': ['すべて選ぶ', 'Select all', '모두 선택'],
    's12.clearAll': ['すべて外す', 'Clear all', '모두 해제'],
    's12.needOne': ['反映する要素を1つ以上選んでください', 'Please keep at least one element', '반영할 요소를 1개 이상 선택해 주세요'],
    's12.excluded': ['除外中', 'Excluded', '제외됨'],
    's12.orderHint': ['↑↓ボタン、またはドラッグで並び替えできます。', 'Reorder with the up and down buttons, or by dragging.', '↑↓ 버튼이나 드래그로 순서를 바꿀 수 있습니다.'],
    's12.moveUp': ['上へ移動', 'Move up', '위로 이동'],
    's12.moveDown': ['下へ移動', 'Move down', '아래로 이동'],
    's12.sectionCount': ['{n}セクション', '{n} sections', '{n}개 섹션'],
    's12.shortage': ['{n}P不足しています', 'You are short {n} P', '{n}P 부족합니다'],
    's12.unlimited': ['無制限利用中のためポイントを消費しません', 'Unlimited use is active, so no points are spent', '무제한 이용 중이라 포인트을 소모하지 않습니다'],
    's12.saveFailed': ['生成内容の保存に失敗しました', 'Failed to save what will be generated', '생성 내용 저장에 실패했습니다'],
    's12.needDone': [
      '分析がまだ完了していないため、生成内容を確認できません。',
      'The analysis is not finished yet, so there is nothing to confirm.',
      '분석이 아직 완료되지 않아 생성 내용을 확인할 수 없습니다.'
    ],

    /* ---- ページ構成のセクション名と説明 ---- */
    'sec.firstview': ['ファーストビュー', 'First view', '퍼스트 뷰'],
    'secDesc.firstview': [
      '商品名・一言価値・KV・最初のCTAを1画面に収めている',
      'Product name, one-line value, key visual and the first CTA all fit in one screen',
      '상품명·한 줄 가치·KV·첫 CTA를 한 화면에 담고 있다'
    ],
    'sec.problem': ['課題提起', 'Problem', '문제 제기'],
    'secDesc.problem': [
      '購入前の不満やつまずきを具体的に並べて共感を作る',
      'Lists the frustrations before purchase in concrete terms to build empathy',
      '구매 전 불만과 걸림돌을 구체적으로 나열해 공감을 만든다'
    ],
    'sec.solution': ['解決策', 'Solution', '해결책'],
    'secDesc.solution': [
      '仕組みと使い方で、課題がどう消えるのかを見せる',
      'Shows how the mechanism and usage make the problem disappear',
      '구조와 사용법으로 문제가 어떻게 사라지는지 보여 준다'
    ],
    'sec.spec': ['仕様・スペック', 'Specifications', '사양·스펙'],
    'secDesc.spec': [
      '寸法・素材・付属品を表で整理し、比較の手間を減らす',
      'Organises size, material and contents in a table to cut comparison effort',
      '치수·소재·구성품을 표로 정리해 비교 부담을 줄인다'
    ],
    'sec.proof': ['実績', 'Proof', '실적'],
    'secDesc.proof': [
      '支援者数・販売数・受賞歴など、数字で裏づけを見せる',
      'Backs the claim with numbers such as backers, units sold and awards',
      '후원자 수·판매 수·수상 이력 등 숫자로 근거를 보여 준다'
    ],
    'sec.story': ['開発ストーリー', 'Maker story', '개발 스토리'],
    'secDesc.story': [
      '作り手の背景と試作の過程を見せ、信頼を作る',
      'Shows the maker background and prototyping to build trust',
      '만든 사람의 배경과 시제품 과정을 보여 신뢰를 만든다'
    ],
    'sec.voice': ['利用者の声', 'Customer voices', '이용자 후기'],
    'secDesc.voice': [
      '写真つきの声で使用シーンを具体的に想像させる',
      'Photo-backed voices make the usage scene concrete',
      '사진이 있는 후기로 사용 장면을 구체적으로 떠올리게 한다'
    ],
    'sec.faq': ['よくある質問', 'FAQ', '자주 묻는 질문'],
    'secDesc.faq': [
      '購入前の不安を先回りして潰しておく',
      'Answers the doubts that come up right before buying',
      '구매 전 불안을 미리 해소한다'
    ],
    'sec.price': ['リターン・価格', 'Rewards and price', '리워드·가격'],
    'secDesc.price': [
      '通常価格と支援価格を並べ、割引率と数量限定を明示する',
      'Puts the regular price next to the campaign price with the discount and the limited quantity',
      '정가와 후원가를 나란히 두고 할인율과 수량 한정을 명시한다'
    ],
    'sec.cta': ['CTA配置', 'CTA placement', 'CTA 배치'],
    'secDesc.cta': [
      '支援ボタンをファーストビュー直下・本文中盤・末尾に置く',
      'Places the pledge button below the first view, mid-body and at the end',
      '후원 버튼을 퍼스트 뷰 아래·본문 중반·마지막에 배치한다'
    ],

    /* ---- 成功要因（売れた理由） ---- */
    'fac.fvBenefit': [
      'ファーストビューで得られる変化を1文で言い切っている',
      'The first view states the change you get in a single sentence',
      '퍼스트 뷰에서 얻게 될 변화를 한 문장으로 단언한다'
    ],
    'fac.priceAnchor': [
      '通常価格と支援価格を並べ、割引率を数字で見せている',
      'Regular price and campaign price sit side by side with the discount as a number',
      '정가와 후원가를 나란히 두고 할인율을 숫자로 보여 준다'
    ],
    'fac.problemFirst': [
      '課題提起を先に置き、共感してから解決策へ進む順番になっている',
      'The problem comes first, so empathy lands before the solution',
      '문제 제기를 먼저 배치해 공감한 뒤 해결책으로 넘어간다'
    ],
    'fac.proofNumber': [
      '実績を具体的な数字（支援者数・販売数）で示している',
      'Results are given as concrete numbers such as backers and units sold',
      '실적을 구체적인 숫자(후원자 수·판매 수)로 제시한다'
    ],
    'fac.ctaRepeat': [
      'CTAをファーストビュー直下・本文中盤・末尾に繰り返し置いている',
      'The CTA repeats below the first view, mid-body and at the end',
      'CTA를 퍼스트 뷰 아래·본문 중반·마지막에 반복 배치한다'
    ],
    'fac.specTable': [
      '仕様を表で整理し、比較検討の手間を減らしている',
      'Specs are laid out in a table, which cuts the effort of comparing',
      '사양을 표로 정리해 비교 검토의 수고를 줄인다'
    ],
    'fac.voiceReal': [
      '利用者の声を写真つきで載せ、使用シーンを想像させている',
      'Customer voices come with photos so the usage scene is easy to picture',
      '이용자 후기를 사진과 함께 실어 사용 장면을 상상하게 한다'
    ],
    'fac.limited': [
      '数量・期間の限定を明示して、先延ばしを防いでいる',
      'Limited quantity and deadline are stated, which stops people putting it off',
      '수량·기간 한정을 명시해 미루는 것을 막는다'
    ],
    'fac.faqObjection': [
      'よくある質問で購入前の不安を先回りして潰している',
      'The FAQ clears the doubts that appear right before buying',
      '자주 묻는 질문으로 구매 전 불안을 미리 해소한다'
    ],
    'fac.makerStory': [
      '開発ストーリーで作り手の顔を見せ、信頼を作っている',
      'The maker story shows the people behind it and builds trust',
      '개발 스토리로 만든 사람을 보여 신뢰를 만든다'
    ],

    /* ---- 収集したコンテンツの品目名 ---- */
    'item.kvHero': ['メインビジュアル', 'Key visual', '메인 비주얼'],
    'item.kvThumb': ['サムネイル', 'Thumbnail', '썸네일'],
    'item.kvDetail': ['ディテールカット', 'Detail shot', '디테일 컷'],
    'item.kvUsage': ['使用シーン画像', 'Usage scene', '사용 장면 이미지'],
    'item.kvPackage': ['パッケージ画像', 'Package shot', '패키지 이미지'],
    'item.kvLifestyle': ['ライフスタイル画像', 'Lifestyle shot', '라이프스타일 이미지'],
    'item.kvCatch': ['キャッチコピー', 'Catch copy', '캐치 카피'],
    'item.kvSub': ['サブコピー', 'Sub copy', '서브 카피'],
    'item.kvBadge': ['実績バッジ', 'Achievement badge', '실적 배지'],
    'item.kvPrice': ['価格表示', 'Price label', '가격 표시'],
    'item.kvDeadline': ['残り日数の表示', 'Days remaining', '남은 일수 표시'],
    'item.kvMovie': ['紹介動画', 'Intro video', '소개 영상'],
    'item.kvShort': ['ショート動画', 'Short video', '숏폼 영상'],
    'item.lpProblem': ['課題提起の図解', 'Problem diagram', '문제 제기 도해'],
    'item.lpSolution': ['解決策の図解', 'Solution diagram', '해결책 도해'],
    'item.lpSpecTable': ['スペック表', 'Spec table', '스펙 표'],
    'item.lpReview': ['レビュー画像', 'Review image', '리뷰 이미지'],
    'item.lpMaker': ['開発風景の写真', 'Behind the scenes photo', '개발 현장 사진'],
    'item.lpCompare': ['比較表', 'Comparison table', '비교 표'],
    'item.lpHeadline': ['セクション見出し', 'Section heading', '섹션 제목'],
    'item.lpBody': ['本文テキスト', 'Body text', '본문 텍스트'],
    'item.lpVoice': ['利用者の声', 'Customer voice', '이용자 후기'],
    'item.lpFaq': ['よくある質問', 'FAQ', '자주 묻는 질문'],
    'item.lpReturn': ['リターン一覧', 'Reward list', '리워드 목록'],
    'item.lpSchedule': ['配送スケジュール', 'Delivery schedule', '배송 일정'],
    'item.lpDemo': ['使い方の動画', 'How-to video', '사용법 영상'],
    'item.lpHowTo': ['組み立て動画', 'Assembly video', '조립 영상']
  };

  /* ------------------------------------------------------------------
   * 文言まわり
   * ------------------------------------------------------------------ */
  function currentLocale() {
    if (window.I18N && typeof window.I18N.getLocale === 'function') {
      var code = window.I18N.getLocale();
      if (LOCALES.indexOf(code) !== -1) { return code; }
    }
    if (typeof App.getLang === 'function') {
      var appCode = App.getLang();
      if (LOCALES.indexOf(appCode) !== -1) { return appCode; }
    }
    return 'ja';
  }

  function fill(text, params) {
    if (!params) { return text; }
    var out = String(text);
    Object.keys(params).forEach(function (key) {
      out = out.split('{' + key + '}').join(String(params[key]));
    });
    /* 差し込み先が残っていたら、そのまま画面に {gif} と出てしまう。
       実際 GIF の件数を足したとき、呼び出し側1か所が渡し忘れて表に出た。
       埋まらなかったことに気づけるようにする */
    var left = out.match(/\{[a-zA-Z_]+\}/g);
    if (left) {
      console.error('[screens-analysis] 差し込む値が足りません: ' + left.join(' ') + ' / ' + text);
    }
    return out;
  }

  function t(key, params) {
    var row = LOCAL[key];
    if (row) {
      var index = LOCALES.indexOf(currentLocale());
      if (index < 0) { index = 0; }
      return fill(row[index] || row[0], params);
    }
    if (window.I18N && typeof window.I18N.t === 'function') {
      return window.I18N.t(key, params);
    }
    console.error('[screens-analysis] window.I18N.t がないため文言キーをそのまま表示します: ' + key);
    return key;
  }

  /* LOCAL に訳があればその言語の訳、無ければ保存されている日本語ラベルを出す */
  function labelOf(prefix, key, savedLabel) {
    var full = prefix + key;
    if (LOCAL[full]) { return t(full); }
    return savedLabel || key;
  }

  /* app.js は App.setLang、i18n.js は I18N.setLocale と別名で言語を持つため、
   * 片方だけ切り替わって表示が古い言語のまま残ることがある。
   * 一度だけ橋渡しを付けて、どちらから切り替えても全画面が同じ言語になるようにする。 */
  function installLangBridge() {
    if (window.__elpiyaLangBridge) { return; }
    window.__elpiyaLangBridge = true;

    window.addEventListener('elpiya:locale-changed', function () {
      if (typeof App.getLang === 'function' && typeof App.setLang === 'function') {
        var code = currentLocale();
        if (App.getLang() !== code) { App.setLang(code); return; }
      }
      if (typeof App.rerender === 'function') { App.rerender(); }
    });

    if (typeof App.on === 'function') {
      App.on('lang', function (code) {
        if (window.I18N && typeof window.I18N.setLocale === 'function') {
          if (window.I18N.getLocale() !== code) { window.I18N.setLocale(code); }
        } else {
          console.error('[screens-analysis] window.I18N.setLocale がありません。i18n.js 側の文言が切り替わりません。');
        }
      });
    }
  }
  installLangBridge();

  /* ------------------------------------------------------------------
   * 小道具
   * ------------------------------------------------------------------ */
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

  function clear(node) {
    while (node && node.firstChild) { node.removeChild(node.firstChild); }
  }

  function add(parent, child) {
    if (parent && child) { parent.appendChild(child); }
    return child;
  }

  function formatNumber(value) {
    var n = Math.round(Number(value) || 0);
    var sign = n < 0 ? '-' : '';
    var digits = String(Math.abs(n));
    var out = '';
    var count = 0;
    var i;
    for (i = digits.length - 1; i >= 0; i--) {
      out = digits.charAt(i) + out;
      count++;
      if (count % 3 === 0 && i > 0) { out = ',' + out; }
    }
    return sign + out;
  }

  function pad2(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function formatDateTime(value) {
    if (!value) { return '—'; }
    var d = new Date(String(value));
    if (isNaN(d.getTime())) { return String(value); }
    return d.getFullYear() + '/' + pad2(d.getMonth() + 1) + '/' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function shortUrl(url, max) {
    var text = String(url || '');
    var limit = max || 42;
    if (text.length <= limit) { return text; }
    return text.slice(0, limit - 1) + '…';
  }

  /* ---------- 遷移 ---------- */
  function hashFor(screenId, params) {
    var hash = '#/' + screenId;
    var parts = [];
    if (params) {
      Object.keys(params).forEach(function (key) {
        var value = params[key];
        if (value === undefined || value === null || value === '') { return; }
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
      });
    }
    if (parts.length) { hash += '?' + parts.join('&'); }
    return hash;
  }

  function go(screenId, params) {
    var next = hashFor(screenId, params);
    if (window.location.hash === next) {
      if (typeof App.rerender === 'function') { App.rerender(); }
      return;
    }
    window.location.hash = next;
  }

  /* ---------- 共通シェル ---------- */
  function setHeader(title) {
    var titleNode = document.getElementById('header-title');
    var backNode = document.getElementById('header-back');
    var actionNode = document.getElementById('header-action');
    if (titleNode) { titleNode.textContent = title; }
    else { console.error('[screens-analysis] index.html に #header-title がありません。'); }
    if (backNode) { backNode.hidden = false; }
    else { console.error('[screens-analysis] index.html に #header-back がありません。'); }
    if (actionNode) { clear(actionNode); }
  }

  function toast(message, kind) {
    if (typeof App.toast === 'function') { App.toast(message, kind); return; }
    var root = document.getElementById('toast-root');
    if (!root) {
      console.error('[screens-analysis] App.toast も #toast-root もありません: ' + message);
      return;
    }
    var node = el('div', 'toast' + (kind ? ' toast--' + kind : ''));
    add(node, el('span', 'toast__text', message));
    root.appendChild(node);
    window.setTimeout(function () {
      if (node.parentNode) { node.parentNode.removeChild(node); }
    }, 3200);
  }

  function clearBanner() {
    if (typeof App.clearBanner === 'function') { App.clearBanner(); return; }
    var root = document.getElementById('banner-root');
    if (root) { clear(root); }
  }

  function showBanner(message, retry) {
    if (typeof App.showBanner === 'function') { App.showBanner(message, retry); return; }
    var root = document.getElementById('banner-root');
    if (!root) {
      console.error('[screens-analysis] App.showBanner も #banner-root もありません: ' + message);
      return;
    }
    clear(root);
    var banner = el('div', 'banner');
    banner.setAttribute('role', 'alert');
    add(banner, el('p', 'banner__text', message));
    if (retry) { add(banner, button('banner__retry', t('common.retry'), retry)); }
    root.appendChild(banner);
  }

  function errorMessage(err, fallbackKey) {
    if (err && typeof err.message === 'string' && err.message) { return err.message; }
    return t(fallbackKey || 'common.networkError');
  }

  function showSkeleton(root, rows) {
    clear(root);
    var wrap = el('div', 'screen');
    add(wrap, el('div', 'skeleton skeleton--title'));
    add(wrap, el('div', 'skeleton skeleton--card'));
    var count = rows === undefined ? 3 : rows;
    var i;
    for (i = 0; i < count; i++) { add(wrap, el('div', 'skeleton skeleton--row')); }
    add(wrap, el('p', 'loading-text', t('common.loading')));
    root.appendChild(wrap);
  }

  function showFailure(root, message, onRetry) {
    clear(root);
    var wrap = el('div', 'screen');
    var banner = el('div', 'banner');
    banner.setAttribute('role', 'alert');
    add(banner, el('p', 'banner__text', message));
    if (onRetry) { add(banner, button('banner__retry', t('common.retry'), onRetry)); }
    add(wrap, banner);
    root.appendChild(wrap);
  }

  function emptyBox(text, actionLabel, onAction) {
    var box = el('div', 'empty');
    add(box, el('p', 'empty__text', text));
    if (actionLabel && onAction) {
      add(box, button('btn btn--primary', actionLabel, onAction));
    }
    return box;
  }

  function openModal(node) {
    if (typeof App.openModal === 'function') { App.openModal(node); return true; }
    console.error('[screens-analysis] App.openModal がありません。拡大表示できません。');
    return false;
  }

  function closeModal() {
    if (typeof App.closeModal === 'function') { App.closeModal(); return; }
    console.error('[screens-analysis] App.closeModal がありません。');
  }

  function apiReady() {
    if (window.Api && window.Api.analysisReports && window.Api.projects) { return true; }
    console.error('[screens-analysis] window.Api の中身（analysisReports / projects）が揃っていません。api.js を確認してください。');
    return false;
  }

  function currentUser() {
    if (typeof App.getUser === 'function') {
      var user = App.getUser();
      if (user) { return user; }
    }
    if (App.state && App.state.user) { return App.state.user; }
    return null;
  }

  function currentBalance() {
    var user = currentUser();
    if (user) { return Number(user.credit_balance) || 0; }
    if (typeof App.getBalance === 'function') { return Number(App.getBalance()) || 0; }
    return 0;
  }

  function hasUnlimited() {
    var user = currentUser();
    if (!user) { return false; }
    if (window.Api && window.Api.credits && typeof window.Api.credits.hasUnlimited === 'function') {
      return window.Api.credits.hasUnlimited(user);
    }
    console.error('[screens-analysis] Api.points.hasUnlimited がありません。無制限利用権は無いものとして扱います。');
    return false;
  }

  function costOf(featureKey, fallback) {
    if (!window.Api || !window.Api.credits || typeof window.Api.credits.costOf !== 'function') {
      console.error('[screens-analysis] Api.points.costOf がありません。既定値 ' + fallback + 'P で表示します（feature_key: ' + featureKey + '）。');
      return Promise.resolve(fallback);
    }
    return window.Api.credits.costOf(featureKey).then(function (value) {
      if (value === null || value === undefined) { return fallback; }
      return Number(value) || 0;
    }, function (err) {
      console.error('[screens-analysis] 機能別ポイントの取得に失敗したため既定値 ' + fallback + 'P を使います（feature_key: ' + featureKey + '）', err);
      return fallback;
    });
  }

  function resolveProjectId(params) {
    if (params && params.id) { return String(params.id); }
    if (App.state && App.state.projectId) { return String(App.state.projectId); }
    if (window.Api && window.Api.storage) { return window.Api.storage.get('projectId'); }
    return null;
  }

  /* 呼び出し側の綴りが2通りある（S8 は reportId、S13 は report） */
  function resolveReportId(params) {
    if (params && params.reportId) { return String(params.reportId); }
    if (params && params.report) { return String(params.report); }
    if (window.Api && window.Api.storage) { return window.Api.storage.get('analysisReportId'); }
    return null;
  }

  function rememberReportId(id) {
    if (window.Api && window.Api.storage) { window.Api.storage.set('analysisReportId', id); }
  }

  function rememberProjectId(id) {
    if (App.state && typeof App.state === 'object') { App.state.projectId = String(id); }
    if (window.Api && window.Api.storage) { window.Api.storage.set('projectId', id); }
  }

  function noProjectScreen(root) {
    clear(root);
    var wrap = el('div', 'screen');
    add(wrap, emptyBox(t('sa.noProject'), t('sa.toDashboard'), function () { go('S3'); }));
    root.appendChild(wrap);
  }

  /* ------------------------------------------------------------------
   * URL とプラットフォーム判定
   * ------------------------------------------------------------------ */
  function platformByKey(key) {
    var found = null;
    PLATFORMS.forEach(function (one) {
      if (one.key === key) { found = one; }
    });
    return found || PLATFORMS[PLATFORMS.length - 1];
  }

  function platformName(key) {
    return t(platformByKey(key).i18n);
  }

  function isHostChar(ch) {
    if (ch >= 'a' && ch <= 'z') { return true; }
    if (ch >= '0' && ch <= '9') { return true; }
    return ch === '.' || ch === '-';
  }

  function normalizeUrl(raw) {
    var text = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!text) { return { ok: false, reasonKey: 's10.emptyUrl' }; }
    if (text.indexOf(' ') !== -1) { return { ok: false, reasonKey: 'validation.invalidUrl' }; }

    var lower = text.toLowerCase();
    if (lower.indexOf('http://') !== 0 && lower.indexOf('https://') !== 0) {
      if (lower.indexOf('://') !== -1 || text.indexOf('.') === -1) {
        return { ok: false, reasonKey: 'validation.invalidUrl' };
      }
      text = 'https://' + text;
    }

    var rest = text.slice(text.indexOf('://') + 3);
    if (!rest) { return { ok: false, reasonKey: 'validation.invalidUrl' }; }

    var slash = rest.indexOf('/');
    var hostPart = slash === -1 ? rest : rest.slice(0, slash);
    var path = slash === -1 ? '/' : rest.slice(slash);

    var at = hostPart.indexOf('@');
    if (at !== -1) { hostPart = hostPart.slice(at + 1); }
    var colon = hostPart.indexOf(':');
    if (colon !== -1) { hostPart = hostPart.slice(0, colon); }

    var host = hostPart.toLowerCase();
    if (!host || host.indexOf('.') <= 0) { return { ok: false, reasonKey: 'validation.invalidUrl' }; }
    if (host.charAt(host.length - 1) === '.') { return { ok: false, reasonKey: 'validation.invalidUrl' }; }

    var i;
    for (i = 0; i < host.length; i++) {
      if (!isHostChar(host.charAt(i))) { return { ok: false, reasonKey: 'validation.invalidUrl' }; }
    }
    var labels = host.split('.');
    for (i = 0; i < labels.length; i++) {
      if (!labels[i].length) { return { ok: false, reasonKey: 'validation.invalidUrl' }; }
    }
    if (labels[labels.length - 1].length < 2) { return { ok: false, reasonKey: 'validation.invalidUrl' }; }

    return { ok: true, url: text, host: host, path: path.toLowerCase() };
  }

  function hostMatches(host, domain) {
    if (host === domain) { return true; }
    return host.length > domain.length && host.slice(host.length - domain.length - 1) === '.' + domain;
  }

  function detectPlatform(host, path) {
    var lowerHost = String(host || '').toLowerCase();
    var lowerPath = String(path || '').toLowerCase();

    /* Machi-ya は camp-fire.jp の配下にも置かれるため、先に経路で判定する */
    if (lowerHost.indexOf('machi-ya') !== -1 || lowerPath.indexOf('/machi-ya') === 0) { return 'machiya'; }

    var found = 'other';
    PLATFORMS.forEach(function (one) {
      if (found !== 'other') { return; }
      one.hosts.forEach(function (domain) {
        if (found === 'other' && hostMatches(lowerHost, domain)) { found = one.key; }
      });
    });
    return found;
  }

  /* ------------------------------------------------------------------
   * 収集セレクタの設定（プラットフォームごと）
   * ------------------------------------------------------------------ */
  function defaultConf(platformKey, kind) {
    var platform = platformByKey(platformKey);
    var base = kind === 'kv' ? platform.kv : platform.lp;
    return { selectors: base.slice(), media: MEDIA_TYPES.slice() };
  }

  function normalizeConfMap(raw, kind, platformKeys) {
    var out = {};
    var source = (raw && typeof raw === 'object') ? raw : {};
    platformKeys.forEach(function (key) {
      var entry = source[key];
      if (!entry || typeof entry !== 'object') {
        out[key] = defaultConf(key, kind);
        return;
      }
      var selectors = Array.isArray(entry.selectors) ? entry.selectors.slice() : defaultConf(key, kind).selectors;
      var media = Array.isArray(entry.media) ? entry.media.filter(function (one) {
        return MEDIA_TYPES.indexOf(one) !== -1;
      }) : MEDIA_TYPES.slice();
      out[key] = { selectors: selectors, media: media };
    });
    return out;
  }

  function usedPlatformKeys(entries) {
    var keys = [];
    entries.forEach(function (entry) {
      if (keys.indexOf(entry.platform) === -1) { keys.push(entry.platform); }
    });
    return keys;
  }

  function cleanSelectors(list) {
    var out = [];
    (list || []).forEach(function (one) {
      var text = String(one || '').trim();
      if (text) { out.push(text); }
    });
    return out;
  }

  /* ------------------------------------------------------------------
   * 収集エンジン（想定データの組み立て）
   * 外部サイトへ通信できないため、URL・プラットフォーム・収集設定から
   * 毎回同じ結果になるように組み立てる。
   * ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------
   * レポート1行の読み書き
   * ------------------------------------------------------------------ */
  function asArray(value) {
    if (Array.isArray(value)) { return value; }
    if (value === null || value === undefined || value === '') { return []; }
    if (typeof value === 'string') {
      try {
        return asArray(JSON.parse(value));
      } catch (e) {
        console.error('[screens-analysis] JSON列を配列として読めませんでした', value, e);
        return [];
      }
    }
    /* 分析結果は {summary: '…', items: [...]} のように総括と本体を分けて返ってくる。
       本体だけ欲しい場面が多いので、中の配列をここで取り出す */
    if (typeof value === 'object') {
      var inner = ['items', 'sections', 'points', 'list'];
      for (var i = 0; i < inner.length; i += 1) {
        if (Array.isArray(value[inner[i]])) { return value[inner[i]]; }
      }
    }
    return [];
  }

  /* 分析結果の総括文。無ければ空文字 */
  function summaryOf(value) {
    if (typeof value === 'string') {
      try { return summaryOf(JSON.parse(value)); } catch (e) { return ''; }
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return String(value.summary || '');
    }
    return '';
  }

  /* competitor_urls と source_platforms を1行ずつの並びに直す */
  function entriesOf(report) {
    var urls = asArray(report && report.competitor_urls);
    var platforms = asArray(report && report.source_platforms);
    var outcomes = asArray(report && report.source_outcomes);
    var out = [];
    urls.forEach(function (raw, index) {
      var url = '';
      var platform = '';
      var outcome = '';
      if (raw && typeof raw === 'object') {
        url = String(raw.url || '');
        platform = String(raw.platform || '');
        outcome = String(raw.outcome || '');
      } else {
        url = String(raw || '');
      }
      if (!outcome) { outcome = String(outcomes[index] || ''); }
      if (OUTCOMES.indexOf(outcome) === -1) { outcome = 'unknown'; }
      if (!url) { return; }
      if (!platform) {
        var fromList = platforms[index];
        if (fromList && typeof fromList === 'object') { platform = String(fromList.platform || ''); }
        else if (fromList) { platform = String(fromList); }
      }
      if (!platform) {
        var parsed = normalizeUrl(url);
        platform = parsed.ok ? detectPlatform(parsed.host, parsed.path) : 'other';
      }
      out.push({ url: url, platform: platform, outcome: outcome });
    });
    return out;
  }

  function reportPayload(entries, kvConf, lpConf, status) {
    return {
      competitor_urls: entries.map(function (entry) { return entry.url; }),
      source_platforms: entries.map(function (entry) { return entry.platform; }),
      source_outcomes: entries.map(function (entry) { return entry.outcome || 'unknown'; }),
      kv_selectors: kvConf,
      lp_selectors: lpConf,
      /* status は NOT NULL・既定値なし。analysis_status は同じ意味の旧列（nullable）。
         旧側だけに入れると insert が 23502 で必ず失敗する（列が二重化しているテーブル） */
      status: status,
      analysis_status: status
    };
  }

  function loadEditableReport(projectId) {
    /* 編集中（draft）か実行待ち（pending）の新しい1行を拾う。無ければ null */
    return window.Api.analysisReports.list({
      eq: { projects_id: String(projectId) },
      order: 'created_at.desc',
      limit: 10
    }).then(function (rows) {
      var found = null;
      (rows || []).forEach(function (row) {
        if (found) { return; }
        if (row.analysis_status === STATUS_DRAFT || row.analysis_status === STATUS_PENDING) { found = row; }
      });
      return found;
    });
  }

  function loadLatestReport(projectId) {
    return window.Api.analysisReports.list({
      eq: { projects_id: String(projectId) },
      order: 'created_at.desc',
      limit: 1
    }).then(function (rows) {
      return (rows && rows.length) ? rows[0] : null;
    });
  }

  /* ==================================================================
   * S10 競合分析
   * URL最大5件の追加 / 形式検証 / プラットフォーム自動判定 /
   * KV・LP収集セレクタ設定 / 未収集・エラー件数 / 分析を実行
   * ================================================================== */
  function renderAnalysis(root, params) {
    setHeader(t('analysis.title'));

    if (!apiReady()) {
      showFailure(root, t('common.error'), function () { renderAnalysis(root, params); });
      return;
    }

    var projectId = resolveProjectId(params);
    if (!projectId) {
      noProjectScreen(root);
      return;
    }
    rememberProjectId(projectId);

    var view = {
      project: null,
      report: null,
      entries: [],
      kvConf: {},
      lpConf: {},
      inputValue: '',
      inputError: '',
      cost: COST_ANALYSIS_FALLBACK,
      saving: false
    };

    function syncConfMaps() {
      var keys = usedPlatformKeys(view.entries);
      var nextKv = {};
      var nextLp = {};
      keys.forEach(function (key) {
        nextKv[key] = view.kvConf[key] || defaultConf(key, 'kv');
        nextLp[key] = view.lpConf[key] || defaultConf(key, 'lp');
      });
      view.kvConf = nextKv;
      view.lpConf = nextLp;
    }


    /* 管理画面（S18）で決めた収集設定を読む。読めなければ画面側の既定に落とす */
    function adminSelectors() {
      if (!window.Api || !window.Api.platformSelectors) {
        return Promise.resolve({ kv: null, lp: null });
      }
      return window.Api.platformSelectors.list({ limit: 50 }).then(function (rows) {
        var out = { kv: {}, lp: {} };
        (rows || []).forEach(function (row) {
          var kind = String(row.kind);
          if (kind !== 'kv' && kind !== 'lp') { return; }
          out[kind][String(row.platform)] = {
            selectors: Array.isArray(row.selectors) ? row.selectors : [],
            media: Array.isArray(row.media) ? row.media : MEDIA_TYPES.slice()
          };
        });
        return out;
      }, function (err) {
        console.error('[screens-analysis] 収集設定を読めませんでした。既定値で続行します', err);
        return { kv: null, lp: null };
      });
    }

    function load() {
      clearBanner();
      showSkeleton(root);

      Promise.all([
        window.Api.projects.get(projectId),
        loadEditableReport(projectId),
        costOf(FEATURE_ANALYSIS, COST_ANALYSIS_FALLBACK),
        /* 収集設定は運営が管理画面で決めるもの。ここでは読むだけ */
        adminSelectors()
      ]).then(function (results) {
        view.project = results[0];
        view.report = results[1];
        view.cost = results[2];
        view.adminConf = results[3];

        view.entries = view.report ? entriesOf(view.report) : [];
        var keys = usedPlatformKeys(view.entries);
        view.kvConf = normalizeConfMap(view.adminConf.kv, 'kv', keys);
        view.lpConf = normalizeConfMap(view.adminConf.lp, 'lp', keys);

        if (view.report && view.report.id) { rememberReportId(view.report.id); }
        draw();
      }, function (err) {
        console.error('[screens-analysis] S10 の読み込みに失敗しました', err);
        showFailure(root, errorMessage(err, 's10.loadFailed'), load);
      });
    }

    /* ---- URLの追加・削除・プラットフォーム変更 ---- */
    function addUrl(raw) {
      if (view.entries.length >= MAX_URLS) {
        view.inputError = t('s10.maxReached');
        draw();
        return;
      }
      var parsed = normalizeUrl(raw);
      if (!parsed.ok) {
        view.inputValue = String(raw || '');
        view.inputError = t(parsed.reasonKey);
        draw();
        return;
      }
      var duplicated = false;
      view.entries.forEach(function (entry) {
        if (entry.url.toLowerCase() === parsed.url.toLowerCase()) { duplicated = true; }
      });
      if (duplicated) {
        view.inputValue = String(raw || '');
        view.inputError = t('s10.duplicate');
        draw();
        return;
      }

      view.entries.push({ url: parsed.url, platform: detectPlatform(parsed.host, parsed.path), outcome: 'success' });
      view.inputValue = '';
      view.inputError = '';
      syncConfMaps();
      draw();
      toast(t('s10.added'), 'success');
    }

    function removeUrl(index) {
      view.entries.splice(index, 1);
      view.inputError = '';
      syncConfMaps();
      draw();
      toast(t('s10.removed'));
    }

    function changePlatform(index, key) {
      view.entries[index].platform = key;
      syncConfMaps();
      draw();
      toast(t('s10.platformChanged', { name: platformName(key) }));
    }

    /* ---- 保存 ---- */
    function persist(status) {
      var payload = reportPayload(view.entries, view.kvConf, view.lpConf, status);
      payload.projects_id = String(projectId);

      if (view.report && view.report.id) {
        return window.Api.analysisReports.update(view.report.id, payload).then(function (row) {
          view.report = row;
          rememberReportId(row.id);
          return row;
        });
      }
      return window.Api.analysisReports.insert(payload).then(function (row) {
        view.report = row;
        rememberReportId(row.id);
        return row;
      });
    }

    function saveDraftAndGo(screenId) {
      if (view.saving) { return; }
      if (!view.entries.length) {
        /* 何も入力していないなら、空の行を作らずそのまま戻る */
        go(screenId, { id: projectId });
        return;
      }
      view.saving = true;
      draw();
      persist(STATUS_DRAFT).then(function () {
        view.saving = false;
        toast(t('s10.savedDraft'), 'success');
        go(screenId, { id: projectId });
      }, function (err) {
        view.saving = false;
        console.error('[screens-analysis] 競合LPの下書き保存に失敗しました', err);
        showBanner(errorMessage(err, 's10.saveFailed'), function () { saveDraftAndGo(screenId); });
        draw();
      });
    }

    function runAnalysis() {
      if (view.saving) { return; }
      if (!view.entries.length) {
        view.inputError = t('s10.needUrl');
        draw();
        return;
      }
      view.saving = true;
      draw();
      /* 押したらその場で分析を始める。確認画面は挟まない。
         S11 側が pending のレポートを見つけて収集を走らせる。 */
      persist(STATUS_PENDING).then(function (row) {
        view.saving = false;
        go('S11', { id: projectId, reportId: row.id, run: '1' });
      }, function (err) {
        view.saving = false;
        console.error('[screens-analysis] 分析の開始に失敗しました', err);
        showBanner(errorMessage(err, 'analysis.startFailed'), runAnalysis);
        draw();
      });
    }

    /* ---- 行のスワイプ削除（×ボタンと同じ動作） ---- */
    function attachSwipeDelete(row, onDelete) {
      var startX = 0;
      var startY = 0;
      var tracking = false;
      var moved = 0;

      row.addEventListener('touchstart', function (event) {
        if (!event.touches || event.touches.length !== 1) { return; }
        tracking = true;
        moved = 0;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
      }, { passive: true });

      row.addEventListener('touchmove', function (event) {
        if (!tracking || !event.touches || !event.touches.length) { return; }
        var dx = event.touches[0].clientX - startX;
        var dy = event.touches[0].clientY - startY;
        if (Math.abs(dy) > Math.abs(dx)) {
          tracking = false;
          row.style.transform = '';
          return;
        }
        moved = dx < 0 ? dx : 0;
        row.style.transform = 'translateX(' + Math.max(moved, -96) + 'px)';
      }, { passive: true });

      row.addEventListener('touchend', function () {
        if (!tracking) { return; }
        tracking = false;
        row.style.transform = '';
        if (moved <= -64) { onDelete(); }
      });

      row.addEventListener('touchcancel', function () {
        tracking = false;
        row.style.transform = '';
      });
    }

    /* ---- 描画 ---- */
    function urlField() {
      var field = el('div', 'field');
      add(field, el('label', 'field__label', t('analysis.urlLabel')));

      var line = el('div', 'row--input-action');
      var input = el('input', 'input');
      input.type = 'url';
      input.inputMode = 'url';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = t('s10.urlPlaceholder');
      input.value = view.inputValue;
      input.setAttribute('aria-label', t('analysis.urlLabel'));
      if (view.inputError) { input.setAttribute('aria-invalid', 'true'); }
      if (view.entries.length >= MAX_URLS) { input.disabled = true; }

      var errorLine = el('p', 'field__error', view.inputError);

      input.addEventListener('input', function () {
        view.inputValue = input.value;
        if (view.inputError) {
          view.inputError = '';
          errorLine.textContent = '';
          input.removeAttribute('aria-invalid');
        }
      });
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          addUrl(input.value);
        }
      });
      add(line, input);

      var addButton = button('btn btn--primary', t('analysis.add'), function () { addUrl(input.value); });
      if (view.entries.length >= MAX_URLS) { addButton.disabled = true; }
      add(line, addButton);
      add(field, line);

      add(field, el('p', 'field__hint', t('s10.count', { n: view.entries.length, max: MAX_URLS })));
      if (view.entries.length >= MAX_URLS) {
        add(field, el('p', 'field__hint', t('s10.maxReached')));
      }
      add(field, errorLine);
      return field;
    }

    function platformSelect(entry, index) {
      var select = el('select', 'select');
      select.setAttribute('aria-label', t('sa.platformLabel'));
      PLATFORMS.forEach(function (platform) {
        var option = el('option', null, t(platform.i18n));
        option.value = platform.key;
        if (platform.key === entry.platform) { option.selected = true; }
        add(select, option);
      });
      select.addEventListener('change', function () { changePlatform(index, select.value); });
      return select;
    }

    function urlList() {
      if (!view.entries.length) {
        return emptyBox(t('analysis.empty'));
      }
      var list = el('ul', 'list');
      list.setAttribute('role', 'list');

      view.entries.forEach(function (entry, index) {
        var row = el('li', 'list-row');
        var body = el('div', 'list-row__body');

        add(body, el('span', 'list-row__title break-url', entry.url));
        add(body, el('span', 'list-row__sub', t('analysis.platformAuto') + '：' + platformName(entry.platform)));

        var picks = el('div', 'chips');
        ['success', 'failure'].forEach(function (kind) {
          var on = entry.outcome === kind;
          var chip = button('chip chip--sm' + (on ? ' chip--' + kind : ''), t('oc.' + kind), function () {
            /* 同じものをもう一度押したら未指定に戻す */
            view.entries[index].outcome = on ? 'unknown' : kind;
            draw();
          });
          chip.setAttribute('aria-pressed', on ? 'true' : 'false');
          add(picks, chip);
        });
        add(body, picks);
        add(row, body);

        var removeButton = button('list-row__action', '×', function () { removeUrl(index); });
        removeButton.setAttribute('aria-label', t('s10.remove'));
        add(row, removeButton);

        attachSwipeDelete(row, function () { removeUrl(index); });
        add(list, row);
      });
      return list;
    }

    function selectorCard(kind, platformKey) {
      var conf = (kind === 'kv' ? view.kvConf : view.lpConf)[platformKey];
      if (!conf) { return null; }
      if (!conf.selectors.length) { conf.selectors = ['']; }

      var card = el('div', 'card');
      add(card, el('p', 'card__label', platformName(platformKey)));

      conf.selectors.forEach(function (value, index) {
        var field = el('div', 'field');
        add(field, el('label', 'field__label', t('s10.selector') + ' ' + (index + 1)));

        var line = el('div', 'row--input-action');
        var input = el('input', 'input');
        input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.value = value;
        input.placeholder = platformKey === 'other' ? t('s10.autoDetect') : t('s10.selector');
        input.setAttribute('aria-label', platformName(platformKey) + ' ' + t('s10.selector') + ' ' + (index + 1));
        input.addEventListener('input', function () { conf.selectors[index] = input.value; });
        input.addEventListener('change', function () {
          conf.selectors[index] = input.value;
          draw();
        });
        add(line, input);

        var removeButton = button('btn btn--secondary btn--sm', '×', function () {
          conf.selectors.splice(index, 1);
          draw();
        });
        removeButton.setAttribute('aria-label', t('s10.selectorRemove'));
        add(line, removeButton);
        add(field, line);
        add(card, field);
      });

      var actions = el('div', 'btn-row');
      add(actions, button('btn btn--secondary btn--sm', t('s10.selectorAdd'), function () {
        conf.selectors.push('');
        draw();
      }));
      add(actions, button('btn btn--secondary btn--sm', t('s10.selectorReset'), function () {
        conf.selectors = defaultConf(platformKey, kind).selectors;
        draw();
      }));
      add(card, actions);

      add(card, el('p', 'card__label', t('s10.mediaLabel')));
      var chips = el('div', 'chips');
      MEDIA_TYPES.forEach(function (type) {
        var on = conf.media.indexOf(type) !== -1;
        var chip = button('chip' + (on ? ' chip--selected' : ''), t('media.' + type), function () {
          var at = conf.media.indexOf(type);
          if (at === -1) { conf.media.push(type); } else { conf.media.splice(at, 1); }
          draw();
        });
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
        add(chips, chip);
      });
      add(card, chips);

      if (!cleanSelectors(conf.selectors).length) {
        if (platformKey === 'other') {
          add(card, el('p', 'card__sub', t('s10.autoDetectNote')));
        } else {
          add(card, el('p', 'card__sub t-danger', t('s10.selectorEmptyWarn')));
        }
      }
      if (!conf.media.length) {
        add(card, el('p', 'card__sub t-danger', t('s10.mediaNoneWarn')));
      }
      return card;
    }

    function selectorSection(kind) {
      var section = el('section', 'section');
      var head = el('div', 'section__head');
      add(head, el('h2', 'section__title', kind === 'kv' ? t('analysis.kvSettings') : t('analysis.lpSettings')));
      add(section, head);
      add(section, el('p', 'section__desc', kind === 'kv' ? t('s10.kvDesc') : t('s10.lpDesc')));

      var keys = usedPlatformKeys(view.entries);
      if (!keys.length) {
        add(section, el('div', 'note-box', t('s10.noPlatformYet')));
        return section;
      }
      var stack = el('div', 'stack');
      keys.forEach(function (key) {
        var card = selectorCard(kind, key);
        if (card) { add(stack, card); }
      });
      add(section, stack);
      return section;
    }

    function countErrors() {
      var errors = 0;
      usedPlatformKeys(view.entries).forEach(function (key) {
        var rows = 0;
        view.entries.forEach(function (entry) { if (entry.platform === key) { rows += 1; } });

        [view.kvConf[key], view.lpConf[key]].forEach(function (conf) {
          if (!conf) { return; }
          if (!cleanSelectors(conf.selectors).length && key !== 'other') { errors += rows; return; }
          if (!conf.media.length) { errors += rows; }
        });
      });
      return errors;
    }

    function draw() {
      clear(root);
      var wrap = el('div', 'screen');

      var head = el('div', 'screen__head');
      add(head, el('h1', 'screen__title', t('analysis.title')));
      add(head, el('p', 'screen__lead', t('s10.lead')));
      add(wrap, head);

      if (view.project) {
        var info = el('div', 'info-list');
        var infoRow = el('div', 'info-row');
        add(infoRow, el('span', 'info-row__key', t('project.name')));
        add(infoRow, el('span', 'info-row__val clamp-2', view.project.project_name || view.project.product_name || '—'));
        add(info, infoRow);
        add(wrap, info);
      }

      add(wrap, el('div', 'note-box', t('sa.serverAnalysisNote')));

      var inputSection = el('section', 'section');
      add(inputSection, urlField());
      add(wrap, inputSection);

      var listSection = el('section', 'section');
      var listHead = el('div', 'section__head');
      add(listHead, el('h2', 'section__title', t('analysis.registered')));
      add(listHead, el('span', 't-note', t('s10.count', { n: view.entries.length, max: MAX_URLS })));
      add(listSection, listHead);
      add(listSection, el('p', 'section__desc', t('oc.hint')));
      add(listSection, urlList());
      if (view.entries.length) {
        add(listSection, el('p', 'section__desc', t('s10.rowHint')));
      }
      add(wrap, listSection);


      add(wrap, el('p', 't-note', t('s10.summary', {
        uncollected: view.entries.length,
        errors: countErrors()
      })));

      var actions = el('div', 'stack');
      var runButton = button('btn btn--primary btn--block', view.saving ? t('sa.saving') : t('analysis.run'), runAnalysis);
      if (view.saving || !view.entries.length) { runButton.disabled = true; }
      add(actions, runButton);
      add(actions, el('p', 't-note t-center', t('s10.runNote', { cost: formatNumber(view.cost) })));

      /* 途中保存。入力したURLと収集の設定を下書きとして残し、
         この工程を「続きから」の戻り先にする */
      if (App && typeof App.saveProgressButton === 'function') {
        var saveHere = App.saveProgressButton({
          projectId: projectId,
          step: 'S10',
          save: function () {
            return view.entries.length ? persist(STATUS_DRAFT) : Promise.resolve(null);
          }
        });
        saveHere.classList.add('btn--block');
        add(actions, saveHere);
      }

      var backButton = button('btn btn--secondary btn--block', t('analysis.backToProduct'), function () {
        saveDraftAndGo('S4');
      });
      if (view.saving) { backButton.disabled = true; }
      add(actions, backButton);

      add(actions, button('btn btn--text', t('sa.toProjectDetail'), function () { saveDraftAndGo('S8'); }));
      add(wrap, actions);

      root.appendChild(wrap);
    }

    load();
  }

  /* ==================================================================
   * S11 分析レポート
   * 収集KV / 収集LP / 成功要因 / ページ構成 / 競合別結果 / 収集エラー
   * ================================================================== */
  /* S11（分析レポート）と S20（総合分析）は、同じレポート1行を別の面から見せる。
     読むデータも、集め直す手順も、素材の見せ方も同じなので、
     画面を2つに分けても中身は1つのまま持ち、出す区画だけを mode で変える。

       mode='sources' … リンク1件ずつのカード。そのページが何をどう見せていたか
       mode='overall' … 全リンクを突き合わせた共通点・流れ・要因 */
  function renderReport(root, params, mode) {
    var isOverall = mode === 'overall';
    var titleKey = isOverall ? 'overall.title' : 'report.title';
    setHeader(t(titleKey));

    if (!apiReady()) {
      showFailure(root, t('common.error'), function () { renderReport(root, params, mode); });
      return;
    }

    var projectId = resolveProjectId(params);
    if (!projectId) {
      noProjectScreen(root);
      return;
    }
    rememberProjectId(projectId);

    var reportId = resolveReportId(params);
    var forceRun = !!(params && (params.run === '1' || params.run === 'true'));
    var view = { report: null, analysisCost: COST_ANALYSIS_FALLBACK };

    costOf(FEATURE_ANALYSIS, COST_ANALYSIS_FALLBACK).then(function (value) {
      view.analysisCost = value;
    });

    function load() {
      clearBanner();
      showSkeleton(root);

      var fetchReport = reportId
        ? window.Api.analysisReports.get(reportId)
        : loadLatestReport(projectId);

      fetchReport.then(function (row) {
        if (!row) {
          drawNoReport();
          return;
        }
        view.report = row;
        rememberReportId(row.id);

        /* 実行待ちのまま残っているか、S10 から実行して来たら収集する */
        if (forceRun || row.analysis_status === STATUS_PENDING) {
          runCollection();
          return;
        }
        drawReport();
      }, function (err) {
        if (err && err.code === 'notfound') {
          drawNoReport();
          return;
        }
        console.error('[screens-analysis] 分析レポートの読み込みに失敗しました', err);
        showFailure(root, errorMessage(err, 'report.loadFailed'), load);
      });
    }

    /* 分析はサーバー（analyze-competitor Edge Function）が行う。
       競合ページの取得・LLM分析・クレジット消費+保存はすべてサーバー側で、
       この画面は実行の起点と完了待ちだけを受け持つ。
       開発モード（サーバーにキーが無い間）は {queued, job_id} が返るので、
       ジョブの完了をポーリングしてからレポートを読み直す。 */
    function runCollection() {
      clear(root);
      var wrap = el('div', 'screen');
      add(wrap, el('div', 'skeleton skeleton--card'));
      add(wrap, el('div', 'skeleton skeleton--row'));
      add(wrap, el('div', 'skeleton skeleton--row'));
      add(wrap, el('p', 'loading-text', t('s11.collecting')));
      add(wrap, el('p', 't-note t-center', t('sa.serverAnalysisNote')));
      root.appendChild(wrap);

      if (!window.Api.analysis || typeof window.Api.analysis.run !== 'function') {
        console.error('[screens-analysis] Api.analysis.run がありません。api.js を確認してください。');
        showFailure(root, t('common.error'), runCollection);
        return;
      }

      function reloadReport() {
        return window.Api.analysisReports.get(view.report.id).then(function (row) {
          view.report = row;
          drawReport();
        }, function (err) {
          console.error('[screens-analysis] 分析後のレポート再取得に失敗しました', err);
          showFailure(root, errorMessage(err, 'report.loadFailed'), reloadReport);
        });
      }

      /* 進み具合は app.js 共通のポップアップで見せる。
         外側をクリックすると右下の小窓に畳めて、その間もポーリングは続く。 */
      function waitForJob(jobId) {
        if (!App.watchJob) {
          console.error('[screens-analysis] App.watchJob がありません。app.js を確認してください。');
          return;
        }
        App.watchJob({
          jobId: jobId,
          titleKey: 'job.titleAnalysis',
          urls: urlsOfReport(),
          onDone: function () { reloadReport(); }
        });
      }

      function urlsOfReport() {
        var list = view.report && view.report.competitor_urls;
        if (!Array.isArray(list)) { return []; }
        return list.map(function (one) {
          if (one && typeof one === 'object') { return String(one.url || ''); }
          return String(one || '');
        }).filter(Boolean);
      }

      window.Api.analysis.run({
        report_id: String(view.report.id),
        lang: (App.getLang && App.getLang()) || 'ja'
      }).then(function (result) {
        if (result && result.queued) {
          waitForJob(result.job_id);
          return;
        }
        if (result && result.user && App.setUser) { App.setUser(result.user, { silent: true }); }
        reloadReport();
      }, function (err) {
        console.error('[screens-analysis] 分析の実行に失敗しました', err);
        showFailure(root, errorMessage(err, 'sa.analysisFailed'), runCollection);
      });
    }

    function drawNoReport() {
      clear(root);
      var wrap = el('div', 'screen');
      var head = el('div', 'screen__head');
      add(head, el('h1', 'screen__title', t('report.title')));
      add(wrap, head);
      add(wrap, emptyBox(t('report.empty'), t('s11.reportEmptyAction'), function () {
        go('S10', { id: projectId });
      }));
      root.appendChild(wrap);
    }

    function drawDraft() {
      clear(root);
      var wrap = el('div', 'screen');
      var head = el('div', 'screen__head');
      add(head, el('h1', 'screen__title', t('report.title')));
      add(head, el('p', 'screen__lead', t('s11.draftTitle')));
      add(wrap, head);

      add(wrap, emptyBox(t('s11.draftBody'), t('creditConfirm.runAnalysis'), function () {
        runCollection();
      }));
      add(wrap, el('p', 't-note t-center', t('pr.costLine', {
        n: formatNumber(hasUnlimited() ? 0 : view.analysisCost),
        b: formatNumber(currentBalance())
      })));

      var actions = el('div', 'stack');
      add(actions, button('btn btn--secondary btn--block', t('s11.reAnalyze'), function () {
        go('S10', { id: projectId });
      }));
      add(wrap, actions);
      root.appendChild(wrap);
    }

    /* ---- 収集物の一覧（種別タブつき） ---- */
    function itemName(item) {
      return labelOf('item.', item.key, item.label);
    }

    function assetListNode(assets, kind) {
      var state = { type: 'all' };
      var wrap = el('div', 'stack');
      var tabs = el('div', 'tabs');
      var body = el('div', 'stack');
      var types = ['all'].concat(MEDIA_TYPES);

      function paint() {
        clear(tabs);
        types.forEach(function (type) {
          var label = type === 'all' ? t('media.all') : t('media.' + type);
          var tab = button('tabs__item' + (state.type === type ? ' tabs__item--active' : ''), label, function () {
            state.type = type;
            paint();
          });
          tab.setAttribute('aria-pressed', state.type === type ? 'true' : 'false');
          add(tabs, tab);
        });

        clear(body);
        if (!assets.length) {
          add(body, emptyBox(t('s11.noAsset')));
          return;
        }
        assets.forEach(function (asset) {
          var group = el('div', 'stack stack--tight');
          add(group, el('p', 't-sub break-url', shortUrl(asset.url, 60)));

          var badges = el('div', 'chips');
          add(badges, el('span', 'badge', platformName(asset.platform)));
          add(badges, el('span', 'badge badge--mute', (asset.selectors || []).join(' , ')));
          if (asset.auto) { add(badges, el('span', 'badge badge--warn', t('s10.autoDetect'))); }
          add(group, badges);

          var items = (asset.items || []).filter(function (item) {
            return state.type === 'all' || item.type === state.type;
          });

          if (!items.length) {
            add(group, el('p', 't-note', t('s11.noAsset')));
          } else {
            /* 絵が出せるものはサムネイルのグリッドで全件、それ以外は行で全件見せる。
               動画は src が YouTube のページなので、絵は poster を使う */
            var thumbOf = function (item) {
              if ((item.type === 'image' || item.type === 'gif') && item.src) { return item.src; }
              if (item.type === 'video' && item.poster) { return item.poster; }
              return '';
            };
            var withSrc = items.filter(function (item) { return !!thumbOf(item); });
            var rest = items.filter(function (item) { return !thumbOf(item); });

            if (withSrc.length) {
              /* ここも3行の帯。縦に積むと、下にある種別の切り替えや
                 収集エラーの説明まで届かなくなる */
              var grid = el('div', 'thumb-strip');
              grid.setAttribute('role', 'list');
              grid.setAttribute('aria-label', t('s11.assetStrip'));
              withSrc.forEach(function (item) {
                var tile = el('a', 'thumb');
                tile.href = item.src;
                tile.target = '_blank';
                tile.rel = 'noopener';
                var img = el('img', 'thumb__img');
                img.src = thumbOf(item);
                img.alt = itemName(item);
                img.loading = 'lazy';
                add(tile, img);
                if (item.type === 'gif') { add(tile, el('span', 'thumb__tag', 'GIF')); }
                if (item.type === 'video') { add(tile, el('span', 'thumb__tag', t('media.video'))); }
                add(grid, tile);
              });
              add(group, grid);
            }

            if (rest.length) {
              var list = el('ul', 'list');
              list.setAttribute('role', 'list');
              rest.forEach(function (item) {
                var row = el('li', 'list-row');
                var rowBody = el('div', 'list-row__body');
                add(rowBody, el('span', 'list-row__title', itemName(item) + (item.index > 1 ? ' ' + item.index : '')));
                add(rowBody, el('span', 'list-row__sub', t('media.' + item.type)));
                add(row, rowBody);
                add(row, el('span', 'list-row__meta', kind === 'kv' ? t('s11.kindKv') : t('s11.kindLp')));
                add(list, row);
              });
              add(group, list);
            }
          }
          add(body, group);
        });
      }

      paint();
      add(wrap, tabs);
      add(wrap, body);
      return wrap;
    }

    function openAssets(assets, kind) {
      var modal = el('div', 'modal');
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');

      add(modal, el('p', 'modal__title', kind === 'kv'
        ? t('s11.kvOpenTitle', { n: assets.length })
        : t('s11.lpOpenTitle', { n: assets.length })));

      var bodyWrap = el('div', 'modal__body');
      add(bodyWrap, assetListNode(assets, kind));
      add(modal, bodyWrap);

      var actions = el('div', 'modal__actions modal__actions--1');
      add(actions, button('btn btn--secondary', t('common.close'), closeModal));
      add(modal, actions);

      openModal(modal);
    }

    function totalCounts(assets) {
      var total = { text: 0, image: 0, gif: 0, video: 0 };
      assets.forEach(function (asset) {
        var counts = asset.counts || {};
        MEDIA_TYPES.forEach(function (type) {
          total[type] += Number(counts[type]) || 0;
        });
      });
      return total;
    }

    function assetCard(assets, kind) {
      var card = el('button', 'card');
      card.type = 'button';
      card.setAttribute('role', 'button');

      add(card, el('span', 'card__label', kind === 'kv' ? t('report.collectedKv') : t('report.collectedLp')));

      var counts = totalCounts(assets);
      var value = el('span', 'card__value num',
        formatNumber(counts.text + counts.image + counts.gif + counts.video));
      add(value, el('span', 'card__unit', kind === 'kv' ? t('s11.kindKv') : t('s11.kindLp')));
      add(card, value);
      add(card, el('span', 'card__sub', t('s11.counts', {
        text: counts.text,
        image: counts.image,
        gif: counts.gif,
        video: counts.video
      })));

      /* プレビューは実画像で最大8枚。全件はカードをタップした一覧で見せる */
      var grid = el('div', 'thumb-grid');
      var shown = 0;
      assets.forEach(function (asset) {
        (asset.items || []).forEach(function (item) {
          if (shown >= 8 || item.type === 'text') { return; }
          var tile = el('div', 'thumb');
          if (item.src) {
            var img = el('img', 'thumb__img');
            img.src = item.src;
            img.alt = itemName(item);
            img.loading = 'lazy';
            add(tile, img);
          } else {
            add(tile, el('span', 'thumb-add', itemName(item)));
          }
          add(grid, tile);
          shown += 1;
        });
      });
      if (shown) { add(card, grid); }

      var foot = el('div', 'card__foot');
      add(foot, el('span', 'card__sub', kind === 'kv' ? t('s11.tapKv') : t('s11.tapLp')));
      add(foot, el('span', 'card__sub', t('s11.openAll')));
      add(card, foot);

      card.addEventListener('click', function () { openAssets(assets, kind); });
      return card;
    }

    /* ---- プロジェクト成否判定（公開データによる機械判定） ---- */
    function verdictSection(report) {
      var collected = report.collected_assets;
      if (typeof collected === 'string') {
        try { collected = JSON.parse(collected); } catch (e) { collected = null; }
      }
      var verdicts = (collected && Array.isArray(collected.verdicts)) ? collected.verdicts : [];
      if (!verdicts.length) { return null; }

      var section = el('section', 'section');
      var head = el('div', 'section__head');
      add(head, el('h2', 'section__title', t('sa.verdictTitle')));
      add(head, el('span', 't-note', t('sa.verdictLead')));
      add(section, head);

      verdicts.forEach(function (v) {
        var group = el('div', 'stack stack--tight');

        var badges = el('div', 'chips');
        var badgeClass = v.verdict === 'success' ? 'badge badge--ok'
          : v.verdict === 'failure' ? 'badge badge--danger' : 'badge badge--mute';
        var badgeText = v.verdict === 'success' ? t('sa.verdictSuccess')
          : v.verdict === 'failure' ? t('sa.verdictFailure') : t('sa.verdictUnknown');
        add(badges, el('span', badgeClass, badgeText));
        if (v.ratio !== null && v.ratio !== undefined) {
          add(badges, el('span', 'badge badge--mute', t('sa.verdictRatio') + ' ' + formatNumber(v.ratio) + '%'));
        }
        add(group, badges);
        add(group, el('p', 't-sub break-url', shortUrl(v.url, 60)));

        var info = el('div', 'info-list');
        function numRow(labelKey, value, unit) {
          if (value === null || value === undefined) { return; }
          var row = el('div', 'info-row');
          add(row, el('span', 'info-row__key', t(labelKey)));
          add(row, el('span', 'info-row__val num', formatNumber(value) + unit));
          add(info, row);
        }
        numRow('sa.verdictGoal', v.target_amount, '円');
        numRow('sa.verdictTotal', v.current_amount, '円');
        numRow('sa.verdictSupporters', v.supporters, '人');
        if (info.childNodes.length) { add(group, info); }

        if (v.reason) { add(group, el('p', 'note-box', v.reason)); }
        add(section, group);
      });
      return section;
    }

    /* ---- 成功・失敗要因（重要度順・タップで根拠へジャンプ） ---- */
    function factorSection(factors, jumpTarget, factorSummary) {
      var section = el('section', 'section');
      var head = el('div', 'section__head');
      add(head, el('h2', 'section__title', t('sa.factorTitle')));
      add(head, el('span', 't-note', t('report.winPattern')));
      add(section, head);
      if (factorSummary) { add(section, el('div', 'note-box', factorSummary)); }

      if (!factors.length) {
        add(section, emptyBox(t('common.empty')));
        return section;
      }

      var list = el('ul', 'list');
      list.setAttribute('role', 'list');
      factors.forEach(function (factor) {
        var row = el('li', 'list-row');
        var body = el('div', 'list-row__body');

        /* kind 無し（旧データ）は成功要因として扱う */
        var isFailure = factor.kind === 'failure';
        var kindBadge = el('span', isFailure ? 'badge badge--danger' : 'badge badge--ok',
          isFailure ? t('sa.factorKindFailure') : t('sa.factorKindSuccess'));
        var titleLine = el('span', 'list-row__title');
        add(titleLine, kindBadge);
        titleLine.appendChild(document.createTextNode(' ' + labelOf('fac.', factor.key, factor.label || factor.title)));
        add(body, titleLine);
        if (factor.body) { add(body, el('span', 'list-row__sub', factor.body)); }
        if (factor.evidence) {
          add(body, el('span', 'list-row__sub break-url', t('s11.evidence', { url: shortUrl(factor.evidence, 48) })));
        }
        add(row, body);
        if (factor.weight) { add(row, el('span', 'list-row__meta', t('s11.weight', { n: factor.weight }))); }

        /* 総合分析の側には競合別のカードが無いので、そのときは分析レポートへ送る */
        var jump = button('list-row__action', '›', function () {
          if (jumpTarget && typeof jumpTarget.scrollIntoView === 'function') {
            jumpTarget.scrollIntoView({ block: 'start' });
            toast(t('s11.jumpDone'));
            return;
          }
          go('S11', { id: projectId, reportId: view.report ? view.report.id : null });
        });
        jump.setAttribute('aria-label', t('report.byCompetitor'));
        add(row, jump);
        add(list, row);
      });
      add(section, list);
      return section;
    }

    /* ---- ページ構成 ---- */
    function openSection(section, index) {
      var modal = el('div', 'modal');
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');

      var name = labelOf('sec.', section.key, section.label || section.title);
      add(modal, el('p', 'modal__title', t('s11.order', { n: index + 1 }) + '　' + name));

      if (section.body) {
        add(modal, el('p', 'modal__body', section.body));
      } else if (LOCAL['secDesc.' + section.key]) {
        add(modal, el('p', 'modal__body', t('secDesc.' + section.key)));
      }

      var info = el('div', 'info-list');

      [['flow.role', section.role], ['flow.hook', section.hook], ['flow.emotion', section.emotion]]
        .forEach(function (pair) {
          if (!pair[1]) { return; }
          var row = el('div', 'info-row');
          add(row, el('span', 'info-row__key', t(pair[0])));
          add(row, el('span', 'info-row__val', pair[1]));
          add(info, row);
        });

      if (section.ratio) {
        var ratioRow = el('div', 'info-row');
        add(ratioRow, el('span', 'info-row__key', t('s11.ratio')));
        add(ratioRow, el('span', 'info-row__val num', section.ratio + '%'));
        add(info, ratioRow);
      }

      var ctaRow = el('div', 'info-row');
      add(ctaRow, el('span', 'info-row__key', t('s11.hasCta')));
      add(ctaRow, el('span', 'info-row__val', section.cta ? t('common.yes') : t('common.no')));
      add(info, ctaRow);

      var priceRow = el('div', 'info-row');
      add(priceRow, el('span', 'info-row__key', t('s11.hasPrice')));
      add(priceRow, el('span', 'info-row__val', section.priceShown ? t('common.yes') : t('common.no')));
      add(info, priceRow);
      add(modal, info);

      var actions = el('div', 'modal__actions modal__actions--1');
      add(actions, button('btn btn--secondary', t('common.close'), closeModal));
      add(modal, actions);
      openModal(modal);
    }

    function structureSection(sections, flowSummary) {
      var section = el('section', 'section');
      var head = el('div', 'section__head');
      add(head, el('h2', 'section__title', t('flow.title')));
      add(head, el('span', 't-note', t('s12.sectionCount', { n: sections.length })));
      add(section, head);
      add(section, el('p', 'section__desc', t('flow.lead')));
      if (flowSummary) { add(section, el('div', 'note-box', flowSummary)); }

      if (!sections.length) {
        add(section, emptyBox(t('common.empty')));
        return section;
      }

      var list = el('ul', 'list');
      list.setAttribute('role', 'list');
      sections.forEach(function (one, index) {
        var row = el('li', 'list-row');
        var body = el('div', 'list-row__body');
        var name = labelOf('sec.', one.key, one.label || one.title);
        add(body, el('span', 'list-row__title', t('s11.order', { n: index + 1 }) + '　' + name));

        if (one.body) { add(body, el('span', 'list-row__sub', one.body)); }
        else if (LOCAL['secDesc.' + one.key]) {
          add(body, el('span', 'list-row__sub', t('secDesc.' + one.key)));
        }

        /* 流れの分析結果。1段階目が書いていれば出す */
        [['flow.role', one.role], ['flow.hook', one.hook], ['flow.emotion', one.emotion]]
          .forEach(function (pair) {
            if (!pair[1]) { return; }
            add(body, el('span', 'list-row__sub', t(pair[0]) + '：' + pair[1]));
          });

        if (one.cta || one.priceShown) {
          var marks = el('div', 'chips');
          if (one.cta) { add(marks, el('span', 'badge badge--ok', t('s11.hasCta'))); }
          if (one.priceShown) { add(marks, el('span', 'badge badge--warn', t('s11.hasPrice'))); }
          add(body, marks);
        }
        add(row, body);
        if (one.ratio) { add(row, el('span', 'list-row__meta num', one.ratio + '%')); }

        var open = button('list-row__action', '›', function () { openSection(one, index); });
        open.setAttribute('aria-label', name);
        add(row, open);
        add(list, row);
      });
      add(section, list);
      return section;
    }

    /* ---- 競合LP別の分析 ----
       リンク1件につき1枚。左右のボタンかドットで送る。
       まとめた結果（共通点・成功要因）とは別に、
       「このリンクは何をどう見せていたか」を1件ずつ確かめられるようにする。 */
    var srcIndex = 0;
    var srcAnim = 0;   // 1=次へ -1=前へ。滑り込む向き

    function reducedMotion() {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /* 前のカードを新しい枠に置き直し、送った向きへ流して捨てる */
    function slideOut(view, node, delta) {
      node.className = 'carousel__card ' + (delta > 0 ? 'is-leaving-left' : 'is-leaving-right');
      node.setAttribute('aria-hidden', 'true');
      view.appendChild(node);
      var drop = function () { if (node.parentNode) { node.parentNode.removeChild(node); } };
      node.addEventListener('animationend', drop);
      setTimeout(drop, 1200);
    }

    /* 古いレポートには source_results が無い。
       そのときは登録済みリンクと収集済み素材から、同じ形を組み立てて出す */
    /* たたんでおいて、押したら中身を開く1件。
       <details> をそのまま使う（自前の開閉を書くと、キーボードと
       読み上げの扱いを作り直すことになる）。
       options: { title, lead?, badge?, meta?, danger?, rows: [[見出し, 本文]...],
                  marks?: [{on, yes, no}], marksLabel? } */
    function foldRow(options) {
      var o = options || {};
      var box = el('details', 'fold' + (o.danger ? ' fold--danger' : ''));
      var head = el('summary', 'fold__head');

      var titleWrap = el('div', 'fold__titles');
      add(titleWrap, el('span', 'fold__title', o.title || ''));
      if (o.lead) { add(titleWrap, el('span', 'fold__lead clamp-2', o.lead)); }
      add(head, titleWrap);

      if (o.badge) {
        add(head, el('span', 'badge ' + (o.danger ? 'badge--danger' : 'badge--ok'), o.badge));
      }
      if (o.meta) { add(head, el('span', 'fold__meta', o.meta)); }
      add(box, head);

      var body = el('div', 'fold__body');
      (o.rows || []).forEach(function (pair) {
        var value = pair && pair[1];
        if (!value) { return; }
        var row = el('div', 'info-row info-row--stack');
        add(row, el('span', 'info-row__key', pair[0]));
        add(row, el('span', 'info-row__val', value));
        add(body, row);
      });

      /* その区画に置かれていた素材。文字だけだと何の話か分からないので、
         開いたときに絵も一緒に見せる */
      var shots = (o.assets || []).filter(Boolean);
      if (shots.length) {
        var shotRow = el('div', 'info-row info-row--stack');
        add(shotRow, el('span', 'info-row__key', o.assetsLabel || ''));
        var strip = el('div', 'thumb-strip thumb-strip--one');
        shots.forEach(function (item) {
          var tile = el('a', 'thumb');
          tile.href = item.src;
          tile.target = '_blank';
          tile.rel = 'noopener';
          var img = el('img', 'thumb__img');
          img.src = item.poster || item.src;
          img.alt = item.label || '';
          img.loading = 'lazy';
          add(tile, img);
          if (item.type === 'gif') { add(tile, el('span', 'thumb__tag', 'GIF')); }
          if (item.type === 'video') { add(tile, el('span', 'thumb__tag', t('media.video'))); }
          add(strip, tile);
        });
        add(shotRow, strip);
        add(body, shotRow);
      }

      var marks = (o.marks || []).filter(function (one) { return one && (one.yes || one.no); });
      if (marks.length) {
        var chips = el('div', 'chips');
        marks.forEach(function (one) {
          add(chips, el('span', one.on ? 'badge badge--ok' : 'badge badge--mute', one.on ? one.yes : one.no));
        });
        var markRow = el('div', 'info-row info-row--stack');
        add(markRow, el('span', 'info-row__key', o.marksLabel || ''));
        add(markRow, chips);
        add(body, markRow);
      }

      add(box, body);
      return box;
    }

    function sourcesOf(report, kvAssets, lpAssets) {
      var saved = asArray(report.source_results);
      if (saved.length) { return saved; }

      return entriesOf(report).map(function (entry) {
        var items = [];
        var counts = { text: 0, image: 0, gif: 0, video: 0 };
        [kvAssets, lpAssets].forEach(function (groups) {
          groups.forEach(function (group) {
            if (group.url !== entry.url) { return; }
            (group.items || []).forEach(function (item) { items.push(item); });
            var got = group.counts || {};
            MEDIA_TYPES.forEach(function (type) { counts[type] += Number(got[type]) || 0; });
          });
        });
        return {
          url: entry.url, platform: entry.platform, outcome: entry.outcome,
          title: '', summary: '', sections: [], factors: [], counts: counts, items: items
        };
      });
    }

    function competitorSection(report, kvAssets, lpAssets, errors) {
      var section = el('section', 'section');
      section.id = 'report-by-competitor';

      var sources = sourcesOf(report, kvAssets, lpAssets);

      var head = el('div', 'section__head');
      add(head, el('h2', 'section__title', t('report.byCompetitor')));
      if (sources.length) {
        add(head, el('span', 't-note', t('s11.urlCount', { n: sources.length })));
      }
      add(section, head);

      if (!sources.length) {
        add(section, emptyBox(t('analysis.empty'), t('s11.reAnalyze'), function () {
          go('S10', { id: projectId });
        }));
        return section;
      }

      var host = el('div', 'stack');
      add(section, host);
      paintSources();
      return section;

      function stepSource(delta) {
        if (sources.length < 2) { return; }
        srcAnim = delta;
        srcIndex = (srcIndex + delta + sources.length) % sources.length;
        paintSources();
      }

      function paintSources() {
        if (srcIndex >= sources.length) { srcIndex = sources.length - 1; }
        if (srcIndex < 0) { srcIndex = 0; }

        var leaving = srcAnim && !reducedMotion() ? host.querySelector('.carousel__card') : null;
        clear(host);

        var index = srcIndex;
        var source = sources[index];
        var dir = srcAnim;
        srcAnim = 0;

        var carousel = el('div', 'carousel');
        var prev = button('carousel__nav', '‹', function () { stepSource(-1); });
        prev.disabled = sources.length < 2;
        prev.setAttribute('aria-label', t('s11.prevSource'));
        add(carousel, prev);

        var card = el('article', 'carousel__card card'
          + (dir > 0 ? ' is-from-right' : (dir < 0 ? ' is-from-left' : '')));

        /* 見出し行: 何番目 / プラットフォーム / 成否 */
        var top = el('div', 'src-card__head');
        add(top, el('span', 'card__label', t('s11.sourcePos', { n: index + 1, total: sources.length })));
        var chips = el('div', 'chips');
        add(chips, el('span', 'badge', platformName(source.platform)));
        if (source.outcome === 'success' || source.outcome === 'failure') {
          add(chips, el('span', 'chip chip--sm chip--' + source.outcome, t('oc.' + source.outcome)));
        }
        add(top, chips);
        add(card, top);

        if (source.title) { add(card, el('p', 'card__title', source.title)); }

        var link = el('a', 't-sub break-url', source.url);
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener';
        add(card, link);

        if (source.summary) { add(card, el('p', 't-body', source.summary)); }

        var counts = source.counts || {};
        add(card, el('p', 'card__sub', t('s11.counts', {
          text: Number(counts.text) || 0,
          image: Number(counts.image) || 0,
          gif: Number(counts.gif) || 0,
          video: Number(counts.video) || 0
        })));

        /* 拾った素材は全件出す。何をどれだけ使って売っているページなのかは
           枚数そのものが答えなので、8枚で打ち切ると判断材料が消える。
           ただし100枚を超えることがあり、縦に全部並べるとページの流れや
           要因の話が下へ押し出されて読めない。3行の帯に収め、
           続きは帯の中を横に送って見る。
           動画は src が YouTube のページなので、絵は poster を使う */
        var thumbSrc = function (item) {
          if ((item.type === 'image' || item.type === 'gif') && item.src) { return item.src; }
          if (item.type === 'video' && item.poster) { return item.poster; }
          return '';
        };
        var media = asArray(source.items).filter(function (item) { return !!thumbSrc(item); });
        /* 動画 → GIF → 静止画の順。紹介動画とGIFはそのページの勝負どころなので、
           静止画の海に埋めずに先へ出す */
        var rank = function (item) {
          if (item.type === 'video') { return 2; }
          if (item.type === 'gif') { return 1; }
          return 0;
        };
        media.sort(function (a, b) { return rank(b) - rank(a); });

        /* KV（最初の1画面）と本文は役割が違う。同じ帯に混ぜると、
           どれが最初に目に入る絵なのかが分からない。分けて出す。
           where が無い古いレポートは、分けずに1本の帯で出す */
        function assetStrip(list, labelText) {
          if (!list.length) { return; }
          if (labelText) { add(card, el('p', 'card__sub', labelText + '（' + list.length + '）')); }
          var grid = el('div', 'thumb-strip');
          grid.setAttribute('role', 'list');
          grid.setAttribute('aria-label', labelText || t('s11.assetStrip'));
          list.forEach(function (item) {
            var tile = el('a', 'thumb');
            tile.href = item.src;
            tile.target = '_blank';
            tile.rel = 'noopener';
            var img = el('img', 'thumb__img');
            img.src = thumbSrc(item);
            img.alt = item.label || '';
            img.loading = 'lazy';
            add(tile, img);
            if (item.type === 'gif') { add(tile, el('span', 'thumb__tag', 'GIF')); }
            if (item.type === 'video') { add(tile, el('span', 'thumb__tag', t('media.video'))); }
            add(grid, tile);
          });
          add(card, grid);
        }

        var kvMedia = media.filter(function (item) { return item.where === 'kv'; });
        var bodyMedia = media.filter(function (item) { return item.where !== 'kv'; });
        if (media.length) {
          if (kvMedia.length) {
            assetStrip(kvMedia, t('s11.kvAssets'));
            assetStrip(bodyMedia, t('s11.lpAssets'));
          } else {
            assetStrip(media, '');
          }
        }

        /* 分析が「この区画にあった」と書いた素材のURLから、
           収集済みの1件（種別・動画のサムネイル付き）を引き当てる。
           URLはクエリの付き方が変わることがあるので、?より前で照らす */
        var byUrl = {};
        asArray(source.items).forEach(function (item) {
          if (!item || !item.src) { return; }
          byUrl[String(item.src).split('?')[0]] = item;
        });
        var shotsOf = function (one) {
          return asArray(one && one.assets).map(function (url) {
            var key = String(url || '').split('?')[0];
            return byUrl[key] || (key ? { src: String(url), type: 'image', label: '' } : null);
          }).filter(Boolean).slice(0, 6);
        };

        /* この競合ページの流れ。
           1行に全部並べると読み切れないので、たたんでおいて押したら開く。
           開いた中では、拾ってあるのに今まで画面に出していなかった
           「次へのつなぎ」「読み手の状態」「CTA・価格の有無」まで見せる。 */
        var sections = asArray(source.sections);
        /* 区画ごとの素材は、分析のときに記録していないと出せない。
           出ない理由が画面から分からないと「壊れている」に見えるので、
           古いレポートではその旨と直し方（再分析）を出す */
        var hasShots = sections.some(function (one) { return asArray(one.assets).length; })
          || asArray(source.factors).some(function (one) { return asArray(one.assets).length; });

        if (sections.length) {
          add(card, el('p', 'card__label', t('s11.sourceFlow')));
          add(card, el('p', 't-note', t('s11.openHint')));
          if (!hasShots) { add(card, el('p', 'note-box', t('s11.assetsMissing'))); }
          var flow = el('div', 'stack stack--tight');
          sections.forEach(function (one, at) {
            add(flow, foldRow({
              title: (at + 1) + '. ' + (one.title || one.key || ''),
              lead: one.role || '',
              rows: [
                [t('s11.roleLabel'), one.role],
                [t('s11.bodyLabel'), one.body],
                [t('s11.hookLabel'), one.hook],
                [t('s11.emotionLabel'), one.emotion]
              ],
              assets: shotsOf(one),
              assetsLabel: t('s11.assetsLabel'),
              marks: [
                { on: !!one.cta, yes: t('s11.hasCta'), no: t('s11.noCta') },
                { on: !!one.priceShown, yes: t('s11.hasPrice'), no: t('s11.noPrice') }
              ],
              marksLabel: t('s11.marksLabel')
            }));
          });
          add(card, flow);
        }

        /* この競合ページの重要要素（成功・失敗）。
           赤が何を指すのか画面に書いていなかったので、
           見出しに凡例を出し、1件ずつにも札を付ける。 */
        var factors = asArray(source.factors);
        if (factors.length) {
          add(card, el('p', 'card__label', t('s11.sourceFactors')));
          add(card, el('p', 't-note', t('s11.factorLegend')));
          var list = el('div', 'stack stack--tight');
          factors.forEach(function (one) {
            var bad = one.kind === 'failure';
            add(list, foldRow({
              title: one.title || one.key || '',
              danger: bad,
              badge: bad ? t('s11.factorFailure') : t('s11.factorSuccess'),
              meta: one.weight ? t('s11.weight', { n: one.weight }) : '',
              rows: [
                [bad ? t('s11.factorFailure') : t('s11.factorSuccess'),
                  bad ? t('s11.factorFailureHint') : t('s11.factorSuccessHint')],
                [t('s11.bodyLabel'), one.body]
              ],
              assets: shotsOf(one),
              assetsLabel: t('s11.assetsLabel')
            }));
          });
          add(card, list);
        }

        /* このリンクで読めなかったものがあれば、その1件だけ添える */
        asArray(errors).forEach(function (one) {
          if (one.url !== source.url) { return; }
          var message = LOCAL[one.reasonKey] ? t(one.reasonKey) : (one.message || one.reasonKey);
          add(card, el('p', 'warn-box', message));
        });

        var cardView = el('div', 'carousel__view');
        add(cardView, card);
        if (leaving && dir) { slideOut(cardView, leaving, dir); }
        add(carousel, cardView);

        var next = button('carousel__nav', '›', function () { stepSource(1); });
        next.disabled = sources.length < 2;
        next.setAttribute('aria-label', t('s11.nextSource'));
        add(carousel, next);
        add(host, carousel);

        if (sources.length > 1) {
          var dots = el('div', 'carousel__dots');
          sources.forEach(function (one, dotIndex) {
            var dot = button('carousel__dot' + (dotIndex === index ? ' is-current' : ''), '', function () {
              if (dotIndex === srcIndex) { return; }
              srcAnim = dotIndex > srcIndex ? 1 : -1;
              srcIndex = dotIndex;
              paintSources();
            });
            dot.setAttribute('aria-label', shortUrl(one.url, 40));
            add(dots, dot);
          });
          add(host, dots);
        }
      }
    }

    function errorSection(errors) {
      if (!errors.length) { return null; }
      var section = el('section', 'section');
      var head = el('div', 'section__head');
      add(head, el('h2', 'section__title', t('report.collectionError')));
      add(head, el('span', 't-note', t('s11.errorTitle', { n: errors.length })));
      add(section, head);

      var list = el('ul', 'list');
      list.setAttribute('role', 'list');
      errors.forEach(function (one) {
        var row = el('li', 'list-row list-row--danger');
        var body = el('div', 'list-row__body');
        var message = LOCAL[one.reasonKey] ? t(one.reasonKey) : (one.message || one.reasonKey);
        add(body, el('span', 'list-row__title', message));
        add(body, el('span', 'list-row__sub break-url', shortUrl(one.url, 52)));
        add(row, body);
        add(row, el('span', 'list-row__meta', one.kind === 'kv' ? t('s11.kindKv') : t('s11.kindLp')));
        add(list, row);
      });
      add(section, list);
      add(section, el('p', 'section__desc', t('s11.errorContinue')));
      return section;
    }

    /* ---- 2段階目：1〜複数の競合分析をひとつにまとめ、生成プロンプトを書かせる ----
       共通点の抽出も、それを踏まえたプロンプトの起草もサーバー側の仕事。
       この画面は起点と完了待ちだけを持ち、終わったら S12 に渡す。 */
    function buildPrompts() {
      var report = view.report;
      window.Api.analysis.run({
        mode: 'prompt_build',
        report_id: String(report.id),
        lang: (App.getLang && App.getLang()) || 'ja'
      }).then(function (result) {
        function done() { go('S12', { id: projectId, reportId: report.id }); }
        if (result && result.queued && App.watchJob) {
          App.watchJob({
            jobId: result.job_id,
            titleKey: 'job.titlePrompts',
            doneKey: 'job.donePrompts',
            noteKey: 'job.notePrompts',
            urls: entriesOf(report).map(function (one) { return one.url; }).filter(Boolean),
            onDone: done
          });
          return;
        }
        done();
      }, function (err) {
        console.error('[screens-analysis] 生成プロンプトの作成に失敗しました', err);
        showBanner(errorMessage(err, 'prompt.buildFailed'), buildPrompts);
      });
    }

    /* ---- 2段階目の結果：競合に共通していた型 ---- */
    function commonSection(points, total) {
      var section = el('section', 'section');
      var head = el('div', 'section__head');
      add(head, el('h2', 'section__title', t('cp.title')));
      if (points.length) { add(head, el('span', 't-note', t('cp.count', { n: points.length }))); }
      add(section, head);
      add(section, el('p', 'section__desc', points.length ? t('cp.lead') : t('cp.empty')));
      if (!points.length) { return section; }

      var list = el('ul', 'list');
      list.setAttribute('role', 'list');
      /* 共通している競合が多い順。同数なら重みの大きい順 */
      points.slice().sort(function (a, b) {
        /* 真似すべき型が先。そのなかは共通していた競合が多い順、同数なら重みの大きい順 */
        var avoidA = a.kind === 'avoid' ? 1 : 0;
        var avoidB = b.kind === 'avoid' ? 1 : 0;
        if (avoidA !== avoidB) { return avoidA - avoidB; }
        var diff = asArray(b.sources).length - asArray(a.sources).length;
        return diff !== 0 ? diff : (Number(b.weight) || 0) - (Number(a.weight) || 0);
      }).forEach(function (one) {
        var avoid = one.kind === 'avoid';
        var row = el('li', 'list-row' + (avoid ? ' list-row--danger' : ''));
        var body = el('div', 'list-row__body');

        var titleLine = el('span', 'list-row__title');
        add(titleLine, el('span', avoid ? 'badge badge--danger' : 'badge badge--ok',
          t(avoid ? 'cp.avoid' : 'cp.do')));
        titleLine.appendChild(document.createTextNode(' ' + (one.label || one.key)));
        add(body, titleLine);

        if (one.body) { add(body, el('span', 'list-row__sub', one.body)); }
        add(row, body);

        /* 失敗例そのものを貼っていない型は件数を出さない（0件中0件は誤解を生む） */
        var count = asArray(one.sources).length;
        if (count) {
          add(row, el('span', 'list-row__meta num', t('cp.sources', { n: total, m: count })));
        }
        add(list, row);
      });
      add(section, list);
      return section;
    }

    function drawReport() {
      var report = view.report;
      if (report.analysis_status !== STATUS_DONE && report.analysis_status !== STATUS_ERROR) {
        drawDraft();
        return;
      }

      var kvAssets = asArray(report.kv_assets);
      var lpAssets = asArray(report.lp_assets);
      var factors = asArray(report.success_factors);
      var sections = asArray(report.page_structure);
      var errors = asArray(report.collection_errors);
      var entries = entriesOf(report);

      clear(root);
      var wrap = el('div', 'screen');

      var head = el('div', 'screen__head');
      add(head, el('h1', 'screen__title', t(titleKey)));
      add(head, el('p', 'screen__lead', t(isOverall ? 'overall.lead' : 's11.lead')));
      add(wrap, head);

      var meta = el('div', 'info-list');
      var urlRow = el('div', 'info-row');
      add(urlRow, el('span', 'info-row__key', t('analysis.registered')));
      add(urlRow, el('span', 'info-row__val', t('s11.urlCount', { n: entries.length })));
      add(meta, urlRow);

      var dateRow = el('div', 'info-row');
      add(dateRow, el('span', 'info-row__key', t('s11.createdAt')));
      add(dateRow, el('span', 'info-row__val', formatDateTime(report.created_at)));
      add(meta, dateRow);
      add(wrap, meta);

      var actions = el('div', 'stack');

      if (!isOverall) {
        /* ---- 分析レポート: リンク1件ずつ ---- */
        var errorNode = errorSection(errors);
        if (errorNode) { add(wrap, errorNode); }

        var verdictNode = verdictSection(report);
        if (verdictNode) { add(wrap, verdictNode); }

        add(wrap, competitorSection(report, kvAssets, lpAssets, errors));

        add(actions, button('btn btn--primary btn--block', t('s11.toOverall'), function () {
          go('S20', { id: projectId, reportId: report.id });
        }));
        add(actions, button('btn btn--secondary btn--block', t('s11.reAnalyze'), function () {
          go('S10', { id: projectId });
        }));
      } else {
        /* ---- 総合分析: 全リンクを突き合わせた結果 ---- */
        add(wrap, commonSection(asArray(report.common_points), entries.length));
        add(wrap, structureSection(sections, summaryOf(report.page_structure)));
        add(wrap, factorSection(factors, null, summaryOf(report.success_factors)));

        var kvSection = el('section', 'section');
        add(kvSection, assetCard(kvAssets, 'kv'));
        add(wrap, kvSection);

        var lpSection = el('section', 'section');
        add(lpSection, assetCard(lpAssets, 'lp'));
        add(wrap, lpSection);

        var hasPrompts = report.prompt_status === 'done';
        add(actions, button('btn btn--primary btn--block',
          hasPrompts ? t('prompt.open') : t('prompt.build'), function () {
            if (hasPrompts) {
              go('S12', { id: projectId, reportId: report.id });
              return;
            }
            buildPrompts();
          }));
        if (hasPrompts) {
          add(actions, button('btn btn--secondary btn--block', t('prompt.rebuild'), buildPrompts));
        }
        add(actions, button('btn btn--secondary btn--block', t('overall.toSources'), function () {
          go('S11', { id: projectId, reportId: report.id });
        }));
      }

      /* 途中保存。レポートの中身はサーバーにあるので、ここでは
         「この工程まで進んだ」ことを覚えさせる（続きから戻れるように） */
      if (App && typeof App.saveProgressButton === 'function') {
        var saveHere = App.saveProgressButton({
          projectId: projectId,
          step: isOverall ? 'S20' : 'S11'
        });
        saveHere.classList.add('btn--block');
        add(actions, saveHere);
      }

      add(actions, button('btn btn--text', t('sa.toProjectDetail'), function () {
        go('S8', { id: projectId });
      }));
      add(wrap, actions);

      root.appendChild(wrap);
    }

    load();
  }

  /* ==================================================================
   * S12 分析内容確認（生成に反映する勝ちパターンの確認）
   * 反映する要素のチェック / LPセクション構成の並び替え / 消費クレジット
   * ================================================================== */
  function renderConfirm(root, params) {
    setHeader(t('prompt.title'));

    if (!apiReady()) {
      showFailure(root, t('common.error'), function () { renderConfirm(root, params); });
      return;
    }

    var projectId = resolveProjectId(params);
    if (!projectId) {
      noProjectScreen(root);
      return;
    }
    rememberProjectId(projectId);

    var reportId = resolveReportId(params);

    var view = {
      report: null,
      project: null,
      base: '',
      items: [],        /* {target, kind, brief, images, videos} */
      targets: [],      /* {label, name, age, gender} S4 で決めた層 */
      picked: {},       /* label -> true 作るものだけ選ぶ */
      openTarget: '',
      kindCost: {},     /* 成果物ごとの消費ポイント */
      saving: false
    };
    PROMPT_KINDS.forEach(function (kind) { view.kindCost[kind] = KIND_COST_FALLBACK[kind]; });

    function load() {
      clearBanner();
      showSkeleton(root);

      var fetchReport = reportId
        ? window.Api.analysisReports.get(reportId)
        : loadLatestReport(projectId);

      Promise.all([
        fetchReport,
        window.Api.projects.get(String(projectId)).catch(function () { return null; }),
        Promise.all(PROMPT_KINDS.map(function (kind) {
          return costOf(KIND_FEATURE[kind], KIND_COST_FALLBACK[kind]);
        }))
      ]).then(function (results) {
        var report = results[0];
        view.project = results[1];
        PROMPT_KINDS.forEach(function (kind, index) { view.kindCost[kind] = results[2][index]; });

        if (!report) {
          drawNoReport();
          return;
        }
        view.report = report;
        rememberReportId(report.id);

        if (report.analysis_status !== STATUS_DONE) {
          drawNotReady();
          return;
        }

        if (report.prompt_status !== 'done') {
          drawNoPrompts();
          return;
        }

        var stored = report.prompts && typeof report.prompts === 'object' ? report.prompts : {};
        view.base = String(stored.base || '');
        view.items = promptItemsOf(report);

        /* 層はプロジェクト（S4 のターゲット案）が本体。プロンプト側にしか
           出てこない層があれば、それも見えるように足しておく */
        var seen = {};
        view.targets = asArray(view.project && view.project.targets).map(function (one) {
          var label = String(one.label || '');
          seen[label] = true;
          return {
            label: label,
            name: String(one.name || ''),
            age: String(one.age || ''),
            gender: String(one.gender || '')
          };
        }).filter(function (one) { return one.label; });

        view.items.forEach(function (one) {
          if (one.target && !seen[one.target]) {
            seen[one.target] = true;
            view.targets.push({ label: one.target, name: '', age: '', gender: '' });
          }
        });

        /* 既定は最初の層だけ。20本まとめて作らせない */
        view.picked = {};
        if (view.targets.length) { view.picked[view.targets[0].label] = true; }
        view.openTarget = view.targets.length ? view.targets[0].label : '';
        draw();
      }, function (err) {
        if (err && err.code === 'notfound') {
          drawNoReport();
          return;
        }
        console.error('[screens-analysis] 分析内容確認の読み込みに失敗しました', err);
        showFailure(root, errorMessage(err, 'report.loadFailed'), load);
      });
    }

    function drawNoReport() {
      clear(root);
      var wrap = el('div', 'screen');
      var head = el('div', 'screen__head');
      add(head, el('h1', 'screen__title', t('reportConfirm.title')));
      add(wrap, head);
      add(wrap, emptyBox(t('report.empty'), t('s11.reportEmptyAction'), function () {
        go('S10', { id: projectId });
      }));
      root.appendChild(wrap);
    }

    function drawNotReady() {
      clear(root);
      var wrap = el('div', 'screen');
      var head = el('div', 'screen__head');
      add(head, el('h1', 'screen__title', t('reportConfirm.title')));
      add(wrap, head);
      add(wrap, emptyBox(t('s12.needDone'), t('report.title'), function () {
        go('S11', { id: projectId, reportId: view.report.id });
      }));
      root.appendChild(wrap);
    }

    function drawNoPrompts() {
      clear(root);
      var wrap = el('div', 'screen');
      var head = el('div', 'screen__head');
      add(head, el('h1', 'screen__title', t('prompt.title')));
      add(wrap, head);
      add(wrap, emptyBox(t('prompt.notReady'), t('prompt.toReport'), function () {
        go('S20', { id: projectId, reportId: view.report.id });
      }));
      root.appendChild(wrap);
    }

    function pickedLabels() {
      return view.targets.filter(function (one) { return view.picked[one.label]; })
        .map(function (one) { return one.label; });
    }

    /* 編集した内容を、読み込んだときと同じ形に戻す */
    function promptPayload() {
      return {
        base: view.base,
        items: view.items.map(function (one) {
          return {
            target: one.target,
            kind: one.kind,
            brief: one.brief,
            images: one.images.map(function (a) { return { slot: a.slot, prompt: a.prompt, provider: 'chatgpt_image2' }; }),
            videos: one.videos.map(function (a) { return { slot: a.slot, prompt: a.prompt, provider: 'segmind' }; })
          };
        })
      };
    }

    function persistAndGo() {
      if (view.saving) { return; }
      var picked = pickedLabels();
      if (view.targets.length && !picked.length) {
        toast(t('pr.needTarget'), 'danger');
        return;
      }
      view.saving = true;
      draw();

      window.Api.analysisReports.update(view.report.id, { prompts: promptPayload() }).then(function (row) {
        view.saving = false;
        view.report = row;

        /* 何を作るかは S13 に直接渡す。消費は generate-content Edge Function が
           成功したあとに行うので、ここでは引き落とさない */
        App.state = App.state || {};
        App.state.generateRequest = {
          projectId: String(projectId),
          reportId: String(row.id),
          targets: picked,
          features: PROMPT_KINDS.map(function (kind) {
            return { feature_key: KIND_FEATURE[kind], kind: kind, credit_cost: view.kindCost[kind] || 0 };
          }),
          at: new Date().toISOString()
        };
        go('S13', { id: projectId, reportId: row.id });
      }, function (err) {
        view.saving = false;
        console.error('[screens-analysis] 生成プロンプトの保存に失敗しました', err);
        showBanner(errorMessage(err, 'prompt.saveFailed'), persistAndGo);
        draw();
      });
    }

    /* ---- 作る層を選ぶ ---- */
    function targetSection() {
      var section = el('section', 'section');
      var head = el('div', 'section__head');
      add(head, el('h2', 'section__title', t('pr.targets')));
      var picked = pickedLabels();
      add(head, el('span', 't-note', t('pr.selected', { n: picked.length, m: picked.length * PROMPT_KINDS.length })));
      add(section, head);
      add(section, el('p', 'section__desc', t('pr.targetsHint')));

      if (!view.targets.length) {
        add(section, emptyBox(t('common.empty')));
        return section;
      }

      var chips = el('div', 'chips');
      view.targets.forEach(function (one) {
        var on = !!view.picked[one.label];
        var name = one.label + (one.name ? '　' + one.name : '');
        var meta = [one.age, one.gender].filter(Boolean).join('・');
        var chip = button('chip' + (on ? ' chip--selected' : ''), name + (meta ? '（' + meta + '）' : ''), function () {
          view.picked[one.label] = !on;
          if (!on) { view.openTarget = one.label; }
          draw();
        });
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
        add(chips, chip);
      });
      add(section, chips);
      return section;
    }

    /* ---- 全プロンプトの先頭に付く前提 ---- */
    function baseSection() {
      var section = el('section', 'section');
      var head = el('div', 'section__head');
      add(head, el('h2', 'section__title', t('pr.base')));
      add(section, head);
      add(section, el('p', 'section__desc', t('pr.baseHint')));
      add(section, promptField(t('pr.base'), view.base, function (value) { view.base = value; }));
      return section;
    }

    /* ---- 編集欄1つ。打っている間は描き直さない（入力が飛ぶため） ---- */
    function promptField(label, value, onChange, rows) {
      var field = el('textarea', 'textarea textarea--prompt' + (rows ? ' textarea--short' : ''));
      field.value = value;
      field.rows = rows || 10;
      field.setAttribute('aria-label', label);
      field.addEventListener('input', function () { onChange(field.value); });
      field.addEventListener('blur', function () { draw(); });
      return field;
    }

    /* ---- 層1つ ✕ 成果物1種類ぶん ---- */
    function itemSection(item) {
      var section = el('section', 'section');
      var head = el('div', 'section__head');
      add(head, el('h2', 'section__title', t('prompt.' + item.kind)));
      add(section, head);
      add(section, el('p', 'section__desc', t('prompt.' + item.kind + 'Desc')));

      add(section, el('span', 'field__label', t('pr.brief')));
      add(section, promptField(t('pr.brief'), item.brief, function (value) { item.brief = value; }));

      [['images', 'pr.images'], ['videos', 'pr.videos']].forEach(function (pair) {
        var list = item[pair[0]];
        if (!list.length) { return; }
        add(section, el('span', 'field__label', t(pair[1])));
        list.forEach(function (asset, index) {
          var label = asset.slot || (index + 1) + '';
          add(section, el('span', 'field__hint', label));
          add(section, promptField(label, asset.prompt, function (value) { asset.prompt = value; }, 4));
        });
      });

      if (!item.images.length && !item.videos.length) {
        add(section, el('p', 't-note', t('pr.noAsset')));
      }
      return section;
    }

    /* ---- 選んだ層を切り替えて中身を見る ---- */
    function promptBody() {
      var wrap = el('div', 'stack');
      var picked = pickedLabels();

      /* 層に紐づかない古い形のプロンプトは、そのまま並べる */
      if (!view.targets.length || !view.items.some(function (one) { return one.target; })) {
        view.items.forEach(function (item) { add(wrap, itemSection(item)); });
        return wrap;
      }

      if (!picked.length) {
        add(wrap, emptyBox(t('pr.needTarget')));
        return wrap;
      }
      if (picked.indexOf(view.openTarget) === -1) { view.openTarget = picked[0]; }

      if (picked.length > 1) {
        var tabs = el('div', 'tabs');
        picked.forEach(function (label) {
          var on = view.openTarget === label;
          var tab = button('tabs__item' + (on ? ' tabs__item--active' : ''), label, function () {
            view.openTarget = label;
            draw();
          });
          tab.setAttribute('aria-pressed', on ? 'true' : 'false');
          add(tabs, tab);
        });
        add(wrap, tabs);
      }

      var shown = view.items.filter(function (one) { return one.target === view.openTarget; });
      if (!shown.length) {
        add(wrap, emptyBox(t('prompt.notReady')));
        return wrap;
      }
      /* 自社LP → クラファンLP → KV → メタ広告 の順で並べる */
      PROMPT_KINDS.forEach(function (kind) {
        shown.filter(function (one) { return one.kind === kind; })
          .forEach(function (item) { add(wrap, itemSection(item)); });
      });
      return wrap;
    }

    /* 選んだ層 × 4種類ぶんを積み上げる */
    function totalCost() {
      var perTarget = 0;
      PROMPT_KINDS.forEach(function (kind) { perTarget += view.kindCost[kind] || 0; });
      return perTarget * Math.max(pickedLabels().length, view.targets.length ? 0 : 1);
    }

    function creditSection() {
      var section = el('section', 'section');
      var head = el('div', 'section__head');
      add(head, el('h2', 'section__title', t('reportConfirm.creditCost')));
      add(section, head);

      var unlimited = hasUnlimited();
      var balance = currentBalance();
      var cost = unlimited ? 0 : totalCost();
      var after = balance - cost;

      var card = el('div', 'card card--soft');
      add(card, el('p', 'card__label', t('creditConfirm.thisTime')));

      var value = el('p', 'card__value num' + (after < 0 ? ' t-danger' : ''), formatNumber(cost));
      add(value, el('span', 'card__unit', t('common.creditShort')));
      add(card, value);

      var foot = el('div', 'card__foot');
      add(foot, el('span', 'card__sub',
        t('creditConfirm.balance') + '：' + formatNumber(balance) + t('common.creditShort')));
      add(foot, el('span', 'card__sub' + (after < 0 ? ' t-danger' : ''),
        t('creditConfirm.afterExecution') + '：' + formatNumber(after) + t('common.creditShort')));
      add(card, foot);
      add(section, card);

      /* 何にいくらかかるのかは、実行するこの画面に出す */
      if (!unlimited && pickedLabels().length) {
        var info = el('div', 'info-list');
        PROMPT_KINDS.forEach(function (kind) {
          var row = el('div', 'info-row');
          add(row, el('span', 'info-row__key', t('prompt.' + kind)));
          add(row, el('span', 'info-row__val num',
            formatNumber(view.kindCost[kind] || 0) + t('common.creditShort')
            + ' × ' + pickedLabels().length));
          add(info, row);
        });
        add(section, info);
      }

      if (unlimited) {
        add(section, el('div', 'note-box', t('s12.unlimited')));
      } else if (after < 0) {
        add(section, el('div', 'warn-box',
          t('creditConfirm.insufficientWarning') + '　' + t('s12.shortage', { n: formatNumber(-after) })));
        add(section, button('btn btn--secondary btn--block', t('creditConfirm.charge'), function () {
          go('S17', { returnTo: 'S12', id: projectId, reportId: view.report.id });
        }));
      }
      return section;
    }

    function draw() {
      clear(root);
      var wrap = el('div', 'screen');

      var head = el('div', 'screen__head');
      add(head, el('h1', 'screen__title', t('prompt.title')));
      add(head, el('p', 'screen__lead', t('prompt.lead')));
      add(wrap, head);

      add(wrap, el('div', 'note-box', t('pr.apiNote')));
      add(wrap, targetSection());
      if (view.base) { add(wrap, baseSection()); }
      add(wrap, promptBody());
      add(wrap, creditSection());

      var actions = el('div', 'stack');
      var generate = button('btn btn--primary btn--block',
        view.saving ? t('sa.saving') : t('prompt.generateWith'), persistAndGo);
      if (view.saving) { generate.disabled = true; }
      add(actions, generate);

      /* 途中保存。編集したプロンプト本文は打っただけでは残らないので、
         生成へ進まずに離れるときはここで保存する */
      if (App && typeof App.saveProgressButton === 'function') {
        var savePrompt = App.saveProgressButton({
          projectId: projectId,
          step: 'S12',
          save: function () {
            return window.Api.analysisReports.update(view.report.id, { prompts: promptPayload() })
              .then(function (row) { view.report = row; return row; });
          }
        });
        savePrompt.classList.add('btn--block');
        if (view.saving) { savePrompt.disabled = true; }
        add(actions, savePrompt);
      }

      /* プロンプトは総合分析の画面から作るので、1つ前の工程はそちら */
      add(actions, button('btn btn--secondary btn--block', t('reportConfirm.backToReport'), function () {
        go('S20', { id: projectId, reportId: view.report.id });
      }));
      add(actions, button('btn btn--secondary btn--block', t('reportConfirm.backToAnalysis'), function () {
        go('S10', { id: projectId });
      }));
      add(wrap, actions);

      root.appendChild(wrap);
    }

    load();
  }

  /* ------------------------------------------------------------------
   * 画面登録（第2引数は必ず { render: 関数 } のオブジェクト）
   * ------------------------------------------------------------------ */
  App.registerScreen('S10', {
    render: function (root, params) { renderAnalysis(root, params || {}); }
  });

  App.registerScreen('S11', {
    render: function (root, params) { renderReport(root, params || {}, 'sources'); }
  });

  App.registerScreen('S20', {
    render: function (root, params) { renderReport(root, params || {}, 'overall'); }
  });

  App.registerScreen('S12', {
    render: function (root, params) { renderConfirm(root, params || {}); }
  });

  /* 通信なしの自己チェック（開発時にコンソールから ScreensAnalysis._selfTest()） */
  window.ScreensAnalysis = {
    _selfTest: function () {
      function assert(ok, name) {
        if (!ok) { throw new Error('[screens-analysis] 自己チェック失敗: ' + name); }
      }

      assert(normalizeUrl('https://www.makuake.com/project/abc/').ok === true, 'URL 正常');
      assert(normalizeUrl('makuake.com/project/abc').url === 'https://makuake.com/project/abc', 'スキーム補完');
      assert(normalizeUrl('ほげ').ok === false, 'URL 不正');
      assert(normalizeUrl('').reasonKey === 's10.emptyUrl', '空URL');
      assert(normalizeUrl('https://').ok === false, 'ホスト無し');
      assert(normalizeUrl('https://a b.com').ok === false, '空白入り');
      assert(normalizeUrl('https://example.c').ok === false, 'トップレベルが1文字');

      assert(detectPlatform('www.makuake.com', '/project/x') === 'makuake', 'Makuake 判定');
      assert(detectPlatform('camp-fire.jp', '/projects/view/1') === 'campfire', 'CAMPFIRE 判定');
      assert(detectPlatform('camp-fire.jp', '/machi-ya/projects/1') === 'machiya', 'Machi-ya 判定');
      assert(detectPlatform('greenfunding.jp', '/lab/projects/1') === 'greenfunding', 'GREENFUNDING 判定');
      assert(detectPlatform('example.co.jp', '/lp') === 'other', 'その他 判定');
      assert(detectPlatform('notmakuake.com', '/x') === 'other', '部分一致では判定しない');

      assert(defaultConf('makuake', 'kv').selectors.length === 2, 'Makuake KV セレクタ2件');
      assert(defaultConf('makuake', 'lp').selectors[0] === 'div#main', 'Makuake LP セレクタ');
      assert(defaultConf('campfire', 'kv').selectors[0] === defaultConf('machiya', 'kv').selectors[0], 'CAMPFIRE と Machi-ya の KV は同じ');
      assert(defaultConf('greenfunding', 'kv').selectors[0] === defaultConf('greenfunding', 'lp').selectors[0], 'GREENFUNDING は KV と LP が同じ');

      assert(resolveReportId({ reportId: 'a' }) === 'a', 'reportId を読む');
      assert(resolveReportId({ report: 'b' }) === 'b', 'report も読む（S13 の綴り）');

      /* 分析の中身はサーバー（analyze-competitor）が作るので、ここでは
         レポート行の読み書きの整形だけを確認する */
      var entries = entriesOf({ competitor_urls: ['https://www.makuake.com/x'], source_platforms: [] });
      assert(entries[0].platform === 'makuake', 'source_platforms が無くてもURLから判定する');

      var payload = reportPayload(entries, {}, {}, STATUS_PENDING);
      assert(payload.competitor_urls.length === 1, '保存用の competitor_urls');
      assert(payload.analysis_status === STATUS_PENDING, '保存用の analysis_status');

      console.log('[screens-analysis] 自己チェック OK');
      return true;
    }
  };
})(window, document);
