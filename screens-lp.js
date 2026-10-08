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

  /* 種類の呼び名。KINDS を引くのはここだけ */
  function kindLabel(key) {
    var one = KINDS.filter(function (k) { return k.key === key; })[0];
    return one ? one.label : 'lp.kindLp';
  }

  var LOCAL = {
    'lp.title': ['生成プロンプト', 'Generation prompts', '생성 프롬프트'],
    'lp.lead': ['総合分析から書いたマスターブリーフ（LP全体の決まり）と、区画ごとの生成プロンプトです。プロンプトを直してから、区画ごとに生成します。',
      'The master brief (page-wide rules) and one prompt per section, written from the overall analysis. Edit, then generate section by section.',
      '종합 분석에서 쓴 마스터 브리프(LP 전체 규칙)와 구획별 생성 프롬프트입니다. 고친 뒤 구획마다 생성합니다.'],
    'lp.empty': ['まだ生成プロンプトがありません。', 'No prompts yet.', '아직 생성 프롬프트가 없습니다.'],
    'lp.emptyHint': ['総合分析のページで「LP・KVプロンプトを生成」を押してください。',
      'Press "Generate LP/KV prompts" on the overall analysis page.',
      '종합 분석 페이지에서 "LP·KV 프롬프트 생성"을 누르세요.'],
    'lp.brief': ['マスターブリーフ（LP全体の決まり）', 'Master brief (page-wide rules)', '마스터 브리프(LP 전체 규칙)'],
    'lp.briefOpen': ['開く', 'Open', '열기'],
    'lp.briefClose': ['閉じる', 'Close', '닫기'],
    'lp.copy': ['コピー', 'Copy', '복사'],
    'lp.copied': ['コピーしました', 'Copied', '복사했습니다'],
    'lp.sections': ['区画', 'Sections', '구획'],
    'lp.section': ['区画 {n}', 'Section {n}', '구획 {n}'],
    'lp.prompt': ['生成プロンプト', 'Prompt', '생성 프롬프트'],
    'lp.gen': ['この区画を生成', 'Generate this section', '이 구획 생성'],
    'lp.via': ['絵の作り先', 'Where images are made', '그림 생성처'],
    'lp.viaBrowser': ['ChatGPTの画面', 'ChatGPT (browser)', 'ChatGPT 화면'],
    'lp.viaApi': ['OpenAI API', 'OpenAI API', 'OpenAI API'],
    'lp.viaBrowserHint': ['追加の料金はかかりません。ただし回数制限があり、当たると数時間止まります',
      'No extra charge, but there is a usage limit; hitting it stops generation for hours.',
      '추가 요금은 없습니다. 다만 횟수 제한이 있어 걸리면 몇 시간 멈춥니다'],
    'lp.viaApiHint': ['1枚およそ $0.06〜0.08 かかります。回数制限は無く、速く作れます',
      'About $0.06–0.08 per image. No usage limit, and faster.',
      '1장당 약 $0.06~0.08. 횟수 제한이 없고 빠릅니다'],
    'lp.viaApiOn': ['これからは OpenAI API で作ります（1枚 $0.06〜0.08）',
      'Now generating with the OpenAI API ($0.06–0.08 per image)',
      '이제 OpenAI API로 만듭니다($0.06~0.08/장)'],
    'lp.viaBrowserOn': ['これからは ChatGPT の画面で作ります（追加の料金なし）',
      'Now generating in the ChatGPT browser (no extra charge)',
      '이제 ChatGPT 화면에서 만듭니다(추가 요금 없음)'],
    'lp.faqBody': ['質問と回答（この文字がそのまま出ます）',
      'Questions and answers (this text is what appears)',
      '질문과 답변(이 글자가 그대로 나옵니다)'],
    'lp.faqBodyHint': ['「Q1 …。A1 …。Q2 …。A2 …」の形で書きます。最大8問まで出ます',
      'Write as "Q1 …. A1 …. Q2 …. A2 …". Up to 8 questions are shown.',
      '「Q1 …. A1 …. Q2 …. A2 …」 형식으로 씁니다. 최대 8문항까지 나옵니다'],
    'lp.faqNoImage': ['よくある質問は、絵ではなく文字で組むので生成しません（回答まで出ます）',
      'FAQ is laid out as text, not an image, so nothing is generated (answers included)',
      '자주 묻는 질문은 그림이 아니라 글자로 구성하므로 생성하지 않습니다(답변까지 나옵니다)'],
    'lp.regen': ['作り直す', 'Regenerate', '다시 생성'],
    'lp.genWithEdited': ['直した生成文を保存しました。この文で作ります',
      'Saved your edited prompt. Generating with it.', '수정한 프롬프트로 생성합니다'],
    'lp.genSaveFailed': ['直した生成文を保存できませんでした。作り直しは始めていません',
      'Could not save your edited prompt. Nothing was queued.', '프롬프트를 저장하지 못했습니다'],
    'lp.generating': ['生成しています…', 'Generating…', '생성 중…'],
    'lp.genAll': ['全部一括生成', 'Generate everything', '전부 일괄 생성'],
    'lp.genOne': ['生成する', 'Generate', '생성'],
    'lp.genOneRedo': ['作り直す', 'Regenerate', '다시 생성'],
    'lp.genOneHint': ['いま開いている層・種類の、まだ絵が無い区画だけを作ります',
      'Generates the missing sections of the audience and kind you have open.',
      '지금 열어둔 타깃·종류의 미생성 구획만 만듭니다'],
    'lp.genOneRedoHint': ['いま開いている層・種類の全区画を、いまのプロンプトで作り直します',
      'Redo every section of the open audience and kind with the current prompts',
      '열려 있는 층·종류의 모든 구획을 지금의 프롬프트로 다시 만듭니다'],
    'lp.genAllRedoHint': ['全ターゲット層の LP・KV・メタ広告を、まとめて作り直します',
      'Redo the LP, KV and ads for every audience',
      '모든 타깃층의 LP·KV·메타 광고를 한꺼번에 다시 만듭니다'],
    'lp.makeAssets': ['動く絵を生成する', 'Generate motion visuals', '움직이는 소재 생성'],
    'lp.makeAssetsRunning': ['生成しています…', 'Generating…', '생성 중…'],
    'lp.makeAssetsQueued': ['動く絵の生成を積みました', 'Queued the motion generation', '움직이는 소재 생성을 예약했습니다'],
    'lp.makeAssetsDone': ['動く絵ができました。組み直すと本文に入ります。',
      'Motion visuals are ready. Rebuild to place them in the page.',
      '움직이는 소재가 준비되었습니다. 다시 조립하면 본문에 들어갑니다.'],
    'lp.genAllRedo': ['全部を作り直す', 'Regenerate everything', '전부 다시 생성'],
    'lp.allDone': ['全部できています', 'Everything is done', '모두 완료되었습니다'],
    'lp.queueing': ['いま積んでいます。少し待ってください', 'Queueing — please wait.', '등록 중입니다'],
    'lp.alreadyQueued': ['すでに生成中です。重ねて積みませんでした',
      'Already generating — nothing was queued again.', '이미 생성 중입니다'],
    'lp.doneOne': ['いま開いているぶんができました。他の層・種類は裏で続いています',
      'The one you have open is done. The other audiences and kinds are still running.',
      '지금 열어둔 분량이 완료되었습니다. 다른 타깃·종류는 계속 진행 중입니다'],
    'lp.queuedAll': ['{n}区画を積みました。全ターゲット層の LP・KV・メタ広告が順に作られます',
      'Queued {n} sections. LP, KV and Meta ads for every audience will be generated in turn.',
      '{n}구획을 등록했습니다. 모든 타깃의 LP·KV·메타광고가 순서대로 만들어집니다'],
    'lp.genAllRedoConfirm': ['{n} 区画をすべて作り直します。今の絵は上書きされます。よろしいですか？', 'Regenerate all {n} sections? Current images will be replaced.', '{n}개 구획을 모두 다시 생성합니다. 지금의 이미지는 덮어씌워집니다. 진행할까요?'],
    'lp.genAllHint': ['全ターゲット層（A〜E）の LP・KV・メタ広告から、まだ絵が無い区画だけを作ります。'
      + '1枚 35〜60秒、10枚ずつ同時に作ります',
      'Generates only the sections that have no image yet, across LP, KV and Meta ads for every audience (A–E). '
      + '35–60 s each, 10 at a time.',
      '모든 타깃(A~E)의 LP·KV·메타광고 중, 아직 이미지가 없는 구획만 만듭니다.'],
    'lp.genAllRunning': ['まとめて生成しています…', 'Generating all…', '한꺼번에 생성 중…'],
    'lp.save': ['プロンプトを保存', 'Save prompts', '프롬프트 저장'],
    'lp.saved': ['保存しました', 'Saved', '저장했습니다'],
    'lp.canvas': ['キャンバスに並べる', 'Lay out on canvas', '캔버스에 배치'],
    'lp.progress': ['{done}/{total} 区画が完成', '{done}/{total} sections done', '{done}/{total} 구획 완료'],
    'lp.queued': ['生成を積みました', 'Queued', '생성을 예약했습니다'],
    'lp.genDone': ['区画ができました', 'Section generated', '구획이 생성되었습니다'],
    'lp.refs': ['商品の見本（全区画に添付・最大16枚）', 'Product references (attached to every section, up to 16)', '상품 견본(모든 구획에 첨부·최대 16장)'],
    'lp.refsShape': ['形の根拠 {n}枚', 'Shape references ({n})', '형태 기준 {n}장'],
    'lp.refsShapeHint': ['商品だけがはっきり写っているもの。生成される商品の形は、この写真だけで決まります',
      'Product-only shots. The generated product shape comes from these alone.',
      '상품만 찍힌 사진. 생성되는 상품의 형태는 이 사진들로만 결정됩니다'],
    'lp.refsContext': ['場面の参考 {n}枚', 'Scene references ({n})', '장면 참고 {n}장'],
    'lp.refsContextHint': ['人や場面が主のもの。持ち方・置き場所・大きさの見当に使い、形の根拠にはしません',
      'People/scene shots. Used for how it is held and where it sits — not for shape.',
      '사람이나 장면이 주인 사진. 형태 기준으로는 쓰지 않습니다'],
    'lp.addRefs': ['見本を増やす（商品入力で☆）', 'Add references (star photos in Product input)', '견본 추가(상품 입력에서 ☆)'],
    'lp.refsStale': ['☆の写真が {n} 枚ありますが、見本は {m} 枚です。作り直すと追いつきます。', '{n} starred photos but {m} references. Rebuild to catch up.', '☆ 사진 {n}장 중 견본은 {m}장입니다. 다시 만들면 맞춰집니다.'],
    'lp.shots': ['商品の見本に使う写真', 'Photos used as product references', '상품 견본으로 쓰는 사진'],
    'lp.shotsAi': ['AIが選びました', 'Picked by AI', 'AI가 선택'],
    'lp.shotsHuman': ['あなたが選びました', 'Picked by you', '직접 선택'],
    'lp.shotsNow': ['{n} 枚の写真から商品の形を取っています。出来が気になるときは選び直してください。',
      'Product shape is taken from {n} photos. Re-pick if the result looks off.',
      '{n}장의 사진에서 상품 형태를 가져옵니다. 결과가 아쉬우면 다시 고르세요.'],
    'lp.shotsPick': ['写真を選び直す', 'Re-pick photos', '사진 다시 고르기'],
    'lp.shotsClose': ['選び直しを閉じる', 'Close', '닫기'],
    'lp.shotsHint': ['商品がはっきり写っていて、向きが散らばっているものを選ぶと形が崩れません。写真を押すと入り切りできます。',
      'Pick clear product shots from varied angles. Tap a photo to toggle.',
      '상품이 선명하고 각도가 다양한 사진을 고르세요. 사진을 누르면 켜고 끕니다.'],
    'lp.shotsSave': ['この写真で見本を作り直す', 'Rebuild references with these', '이 사진으로 견본 다시 만들기'],
    'lp.shotsNone': ['写真を1枚以上選んでください', 'Select at least one photo', '사진을 1장 이상 선택하세요'],
    'lp.shotsAuto': ['AIに選び直させる', 'Let AI re-pick', 'AI에게 다시 고르게 하기'],
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
    'lp.shotPrompt': ['この版を作った生成文を見る', 'Show the prompt that made this version', '이 버전을 만든 프롬프트 보기'],
    'lp.shotPromptNone': ['この版には生成文が残っていません（この機能より前に作った版です）',
      'No prompt was saved for this version (made before this feature existed).',
      '이 버전에는 프롬프트가 남아 있지 않습니다'],
    'lp.shotPromptUse': ['この文に戻す', 'Use this prompt', '이 프롬프트로 되돌리기'],
    'lp.shotPromptUsed': ['生成文を戻しました。保存してから作り直してください',
      'Prompt restored. Save, then regenerate.', '프롬프트를 되돌렸습니다. 저장 후 다시 생성하세요'],
    'lp.shotZoom': ['大きく見る', 'Open larger', '크게 보기'],
    'lp.motion': ['動く絵', 'Motion', '움직이는 소재'],
    'lp.kindLp': ['LP', 'LP', 'LP'],
    'lp.kindKv': ['KV', 'KV', 'KV'],
    'lp.kindAds': ['メタ広告', 'Meta ads', '메타 광고'],
    'lp.unsure': ['見本と違うかもしれません', 'May not match the product', '견본과 다를 수 있습니다'],
    'lp.motionPick': ['動きが向く区画', 'Good for motion', '움직임이 어울리는 구획'],
    'lp.motionMake': ['この区画のGIFを作る', 'Make the GIF', '이 구획 GIF 만들기'],
    /* 履歴の選択肢。日付だけでは何回目か分からない */
    'lp.roundNth': ['{n}回目案', 'Run {n}', '{n}회차 안'],
    'lp.motionGroup': ['{kind}（動きが向く区画）', '{kind} (good for motion)', '{kind}（움직임이 어울리는 구획）'],
    'lp.motionHas': ['作成済み', 'Made', '생성됨'],
    'lp.motionNone': ['未作成', 'Not made', '미생성'],
    'lp.motionPromptHead': ['Replicate（bytedance/seedance-2.5）へ送る文 — {kind} / 比率 {aspect} / 見本 {refs}枚',
      'Sent to Replicate (bytedance/seedance-2.5) — {kind} / {aspect} / {refs} references',
      'Replicate로 보내는 문장 — {kind} / 비율 {aspect} / 견본 {refs}장'],
    'lp.motionPromptSave': ['この文で保存', 'Save this prompt', '이 문장으로 저장'],
    'lp.motionPromptReset': ['元に戻す', 'Revert', '되돌리기'],
    'lp.motionPromptSaved': ['保存しました。次に作るときはこの文を使います', 'Saved. The next run uses this prompt.', '저장했습니다.'],
    'lp.motionPromptNote': [
      '直した文は、次にこの区画のGIFを作るときに使われます。ただし区画のプロンプト自体を直して作り直すと、この文は組み直されて上書きされます。',
      'Your edit is used the next time this section’s GIF is made. Editing the section prompt itself rebuilds and overwrites this text.',
      '수정한 문장은 다음에 이 구획의 GIF를 만들 때 사용됩니다.'],
    'lp.motionPromptNone': ['まだありません。一度「この区画のGIFを作る」を押すと、送る文が保存されて見られます。',
      'Not written yet. Press “Make the GIF” once and the prompt is saved so you can read it.',
      '아직 없습니다. 「이 구획 GIF 만들기」를 한 번 누르면 저장되어 볼 수 있습니다.'],
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
    'lp.loadingSections': ['区画を読み込んでいます…', 'Loading sections…', '구획을 불러오는 중…'],
    'lp.kindEmptyFor': ['{v}層の{k}はまだ作られていません。', 'No {k} for audience {v} yet.', '{v} 타깃의 {k}는 아직 없습니다.'],
    'lp.kindEmptyHint': ['「生成プロンプトを更新する」を押すと、足りない層のぶんが書かれます。',
      'Press "Update the prompts" to write the missing ones.',
      '"프롬프트 업데이트"를 누르면 부족한 분량이 작성됩니다.'],
    /* ---- 公開（販売ページ） ---- */
    'lp.pub': ['販売ページを公開する', 'Publish sales pages', '판매 페이지 공개'],
    'lp.pubLead': ['ターゲット層ごとに、生成した写真と文章で販売ページを作って公開します。'
      + '見た人が LINE に登録することが狙いです。',
      'Publishes one sales page per audience, built from the generated images and copy, '
      + 'aiming to get visitors onto your LINE account.',
      '타깃별 판매 페이지를 공개합니다.'],
    'lp.pubSlug': ['公開URLの名前', 'URL name', '공개 URL 이름'],
    'lp.pubSlugHint': ['公開ページのURLに出る名前です。英小文字・数字・ハイフンだけが使えます。'
      + '商品名かブランド名を、ローマ字で入れてください（例: simtiple）。'
      + 'あとから変えると、前のURLは開けなくなります。',
      'Appears in the public URL. Lowercase letters, numbers and hyphens only. '
      + 'Use your product or brand name (e.g. simtiple). Changing it later breaks the old URL.',
      '공개 URL에 나오는 이름입니다. 영소문자·숫자·하이픈만 쓸 수 있습니다.'],
    'lp.pubSlugTaken': ['この名前は、ほかの方が使っています。別の名前にしてください',
      'That name is taken. Please choose another.', '이미 사용 중인 이름입니다'],
    'lp.pubSlugFree': ['この名前は使えます', 'That name is available', '사용할 수 있습니다'],
    'lp.pubSlugEmpty': ['名前を入れてください（例: simtiple）', 'Enter a name (e.g. simtiple)', '이름을 입력하세요'],
    'lp.pubPreview': ['公開URL', 'Public URL', '공개 URL'],
    'lp.pubLine': ['LINE友だち追加のURL', 'LINE add-friend URL', 'LINE 친구추가 URL'],
    'lp.pubLineHint': ['LINE公式アカウントの「友だち追加」URLを貼ってください（https://lin.ee/… など）。'
      + '入れると、ページの本文の途中と末尾、画面下の固定バーにボタンが出ます。'
      + '空のままだとボタンは出ません。',
      'Paste your LINE official account add-friend URL (https://lin.ee/…). '
      + 'Buttons then appear mid-page, at the end, and in a sticky bottom bar.',
      'LINE 공식 계정의 친구추가 URL을 넣으세요.'],
    'lp.pubInfo': ['販売の条件', 'Sales terms', '판매 조건'],
    'lp.pubInfoHint': ['販売ページに載せる条件です。入れた項目だけがページに出ます。'
      + '書いていないことは AI も書きません。',
      'Shown on the sales page. Only what you fill in appears; the AI will not invent the rest.',
      '판매 페이지에 실리는 조건입니다. 입력한 항목만 표시됩니다.'],
    'lp.pubShipping': ['送料', 'Shipping', '배송비'],
    'lp.pubShippingPh': ['例: 全国一律500円（5,000円以上で無料）', 'e.g. Flat ¥500', '예: 전국 500엔'],
    'lp.pubDelivery': ['お届け', 'Delivery', '배송 시기'],
    'lp.pubDeliveryPh': ['例: ご注文から3営業日以内に発送', 'e.g. Ships within 3 business days', '예: 3영업일 이내 발송'],
    'lp.pubWarranty': ['保証', 'Warranty', '보증'],
    'lp.pubWarrantyPh': ['例: お買い上げから1年間の初期不良保証', 'e.g. 1-year warranty', '예: 1년 보증'],
    'lp.pubReturns': ['返品・交換', 'Returns', '반품·교환'],
    'lp.pubReturnsPh': ['例: 到着後8日以内、未使用のものに限り承ります', 'e.g. Within 8 days, unused', '예: 8일 이내'],
    'lp.pubSeller': ['販売者', 'Seller', '판매자'],
    'lp.pubSellerPh': ['例: 株式会社◯◯／東京都…／03-0000-0000', 'e.g. Company, address, phone', '예: 회사명·주소·전화'],
    'lp.pubSellerHint': ['日本で商品を売るページには、特定商取引法にもとづく表記が要ります。'
      + '会社名・住所・連絡先を入れてください。',
      'Japanese law requires seller details on a sales page.',
      '판매자 정보를 입력하세요.'],
    'lp.pubNote': ['そのほか', 'Other', '기타'],
    'lp.pubStart': ['販売開始の時期', 'Launch timing', '판매 개시 시기'],
    'lp.pubStartPh': ['9月上旬', 'early September', '9월 초'],
    'lp.pubStartHint': ['LINE登録の塊の2行目に「9月上旬販売 数量限定割引」のように出ます。'
      + '空のままだとAIが書いた文章が入りますが、見本どおりの見た目にはなりません。',
      'Shown as the second line of the LINE block. Leave empty and the AI copy is used instead.',
      'LINE 등록 블록의 둘째 줄에 표시됩니다.'],
    'lp.pubOff': ['最大の割引率', 'Max discount', '최대 할인율'],
    'lp.pubOffPh': ['30%', '30%', '30%'],
    'lp.pubOffHint': ['LINE登録の塊の3行目に「最大 30% OFF」のように、いちばん大きく出ます。'
      + '実際に出す割引だけを入れてください（景品表示法）。',
      'Shown as the biggest line of the LINE block. Only enter a discount you will actually offer.',
      'LINE 등록 블록에서 가장 크게 표시됩니다.'],
    'lp.pubLogo': ['掲載先ロゴの画像URL', 'Platform logo URL', '게재처 로고 URL'],
    'lp.pubLogoPh': ['https://… （ふつうは空のままで大丈夫です）', 'https://… (usually leave empty)', 'https://…'],
    'lp.pubLogoHint': ['LINEの誘いの上に出す、クラウドファンディングの掲載先です。'
      + 'Makuake と CAMPFIRE は、各社が公式に配っているロゴを入れてあるので、'
      + 'ここは空のままで大丈夫です。'
      + 'GREENFUNDING と machi-ya は公式の配布が見つからなかったので、'
      + '空だと名前を文字で出します。'
      + '各社からロゴ素材をもらっている場合だけ、その画像のURLをここに入れてください'
      + '（使い方は各社の決まりに従ってください）。',
      'Shown above the LINE call-to-action. Makuake and CAMPFIRE ship with their '
      + 'officially distributed logo, so you can leave this empty. For the others the '
      + 'platform name is typeset instead; paste a logo URL only if you have the asset.',
      'LINE 유도 위에 표시되는 게재처입니다. Makuake와 CAMPFIRE는 공식 로고가 들어 있습니다.'],
    'lp.pubWrite': ['販売ページの文章をAIに書かせる', 'Write the sales copy with AI', 'AI로 판매 문구 작성'],
    'lp.pubWriteHint': ['ターゲット層ごとに、冒頭・特長・仕様・よくある質問・最後の一押しを書きます。'
      + '数分かかります。書いたあとに公開してください。',
      'Writes hero, benefits, specs, FAQ and closing per audience. Takes a few minutes.',
      '타깃별로 문구를 작성합니다. 몇 분 걸립니다.'],
    'lp.pubWriting': ['書いています…', 'Writing…', '작성 중…'],
    'lp.pubWritten': ['販売ページの文章ができました', 'Sales copy is ready', '판매 문구가 준비되었습니다'],
    'lp.pubNoCopy': ['まだ販売ページの文章がありません。先に書かせると、価格・送料・保証・よくある質問の入ったページになります',
      'No sales copy yet. Write it first to include price, shipping, warranty and FAQ.',
      '아직 판매 문구가 없습니다.'],
    'lp.pubHasCopy': ['販売ページの文章: {n}層ぶんあります', 'Sales copy: {n} audiences', '판매 문구: {n}개 타깃'],
    'lp.pubMode': ['受け取り方', 'How to collect leads', '수집 방법'],
    'lp.pubModeHint': ['ページを見た人と、どうやって繋がるかを選びます。',
      'How visitors connect with you.', '방문자와 연결되는 방법'],
    'lp.pubModeLine': ['LINE友だち追加', 'LINE', 'LINE'],
    'lp.pubModeMail': ['メール登録', 'Email', '이메일'],
    'lp.pubModeBoth': ['両方', 'Both', '둘 다'],
    'lp.pubKv': ['ページの最初をKVから始める', 'Start the page with the KV slider', 'KV로 시작'],
    'lp.pubKvHint': ['チェックすると、ページの一番上にKVが横に並び、5秒ごとにゆっくり流れます。'
      + '左右のボタンでも動かせます。KVが1枚のときはボタンは出ません。',
      'Puts the KV images at the very top as a slider that advances every 5 seconds.',
      'KV가 맨 위에 슬라이더로 들어갑니다.'],
    'lp.pubKvNone': ['この層のKVがまだありません', 'No KV for this audience yet', 'KV가 없습니다'],
    'lp.leads': ['集まったメール', 'Collected emails', '수집된 이메일'],
    'lp.leadsNone': ['まだありません', 'None yet', '아직 없습니다'],
    'lp.leadsCount': ['{n}件', '{n}', '{n}건'],
    'lp.leadsCsv': ['CSVで落とす', 'Download CSV', 'CSV 내려받기'],
    'lp.leadsDel': ['消す', 'Delete', '삭제'],
    'lp.pubSave': ['保存する', 'Save', '저장'],
    'lp.pubSaved': ['保存しました', 'Saved', '저장했습니다'],
    'lp.pubGo': ['{n}層をまとめて公開する', 'Publish {n} audiences', '{n}개 타깃 공개'],
    'lp.pubGoing': ['公開しています…', 'Publishing…', '공개 중…'],
    'lp.pubDone': ['{n}層を公開しました', 'Published {n} audiences', '{n}개 타깃을 공개했습니다'],
    'lp.pubStop': ['公開をやめる', 'Unpublish', '공개 중지'],
    'lp.pubStopped': ['公開をやめました', 'Unpublished', '공개를 중지했습니다'],
    'lp.pubNone': ['公開できる層がありません。先に絵を作ってください',
      'Nothing to publish yet — generate the images first.', '먼저 이미지를 만들어 주세요'],
    'lp.pubCopy': ['URLをコピー', 'Copy URL', 'URL 복사'],
    'lp.pubCopied': ['コピーしました', 'Copied', '복사했습니다'],
    'lp.pubOpen': ['開く', 'Open', '열기'],
    'lp.zip': ['まとめてダウンロード', 'Download all', '한꺼번에 내려받기'],
    'lp.zipBusy': ['集めています… {n}/{m}', 'Collecting… {n}/{m}', '모으는 중… {n}/{m}'],
    'lp.zipDone': ['{n}点を1つの zip にしました', 'Zipped {n} files', '{n}개를 zip으로 묶었습니다'],
    'lp.zipNone': ['落とせる絵がまだありません', 'Nothing to download yet', '내려받을 이미지가 없습니다'],
    'lp.zipHint': ['この回の全ターゲット層ぶん（LP・KV・メタ広告）の絵と生成文を、1つの zip にまとめます',
      'Zips the images and prompts of this round (LP, KV and Meta ads, every audience).',
      '이 회차의 모든 타깃(LP·KV·메타광고) 이미지와 프롬프트를 zip으로 묶습니다'],
    'lp.movedToNewest': ['新しい回ができていたので、そちらに切り替えて生成します。', 'A newer round exists; switched to it.', '새 회차가 있어 그쪽으로 전환했습니다.'],
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
      var view = { project: null, gens: [], gen: null, dirty: false, busy: {}, shotAt: {}, motionOpen: {},
        kind: 'lp_brief', byKind: {}, missingLabel: '' };
      /* 一覧では本文（content.brief）を取らない。1本25,000字あり、
         3種類×20件で5.9MBになる。画面が開くたびにこれを読んでいたので、
         取り直しが重なると白いまま返らなくなった（実測 2026-10-04）。
         回の記号だけ content から抜き出し、本文は開いた1本だけ後から取る */
      /* 一覧で読むのは、案を並べるのに要るものだけ。
         区画の中身（sections）と絵の記録（asset_prompts）は、LP1件で76KBあり、
         3種類×20件で2MB近くになる。耳に出す「◯/◯」を数えるためだけに
         全文を読んでいた。いま見ている回のぶん（最大15件）だけ後から読む */
      var LIGHT = 'id,feature_key,content_type,variant_label,title,created_at,'
        + 'batch:content->>batch,stamp:content->>stamp';
      var HEAVY = 'id,sections,asset_prompts';
      /* 本文を取りに行っている最中の案。二重に取りに行かないための札 */
      var fetching = {};
      /* 回ごとに、重い列を読み終えたか */
      var detailDone = {};

      /* その回の区画と絵の記録を読む。読めたら同じ行に入れる（参照は変えない） */
      function loadDetail(batch) {
        if (!batch) { return Promise.resolve(); }
        if (detailDone[batch]) { return Promise.resolve(); }
        var ids = [];
        KINDS.forEach(function (k) {
          (view.byKind[k.key] || []).forEach(function (g) {
            if (batchOf(g) === batch && !isArray(g.sections)) { ids.push(g.id); }
          });
        });
        if (!ids.length) { detailDone[batch] = true; return Promise.resolve(); }
        detailDone[batch] = true;
        return Api.generations.list({ in: { id: ids }, select: HEAVY, order: false, limit: ids.length })
          .then(function (rows) {
            var by = {};
            (isArray(rows) ? rows : []).forEach(function (r) { by[r.id] = r; });
            KINDS.forEach(function (k) {
              (view.byKind[k.key] || []).forEach(function (g) {
                var r = by[g.id];
                if (!r) { return; }
                g.sections = r.sections;
                g.asset_prompts = r.asset_prompts;
              });
            });
          })
          .catch(function (err) {
            /* 読めなければ次に開いたときにもう一度試す。黙らない */
            detailDone[batch] = false;
            console.error('[screens-lp] 区画の読み込みに失敗:', err);
          });
      }

      /* いま見ている回のぶんを読んでから描き直す */
      function withDetail() {
        return loadDetail(batchOf(view.gen)).then(function () { paint(); });
      }
      /* 回（batch）の読み方は1か所。軽い一覧では g.batch、本文まで取った行では
         g.content.batch に入っている */
      function batchOf(g) {
        if (!g) { return ''; }
        if (g.content && g.content.batch) { return String(g.content.batch); }
        return g.batch ? String(g.batch) : '';
      }

      var screen = el('div', 'screen');
      var head = el('header', 'screen__head');
      add(head, el('h2', 'screen__title', t('lp.title')));
      add(head, el('p', 'screen__lead', t('lp.lead')));
      add(screen, head);
      /* 一括生成は、見出しのすぐ下に幅いっぱいで置く。
         他のボタンに紛れていると、何を押せば全部作れるのか分からない
         （2026-10-03 指示） */
      var bulkBar = el('div', 'lp-bulk');
      add(screen, bulkBar);
      /* 成果物の切り替えは、他のボタンと同じ行に混ぜない。
         書類ばさみの耳として、専用の帯に置く（下に1本の線が通る） */
      var tabsBar = el('div', 'lp-tabs');
      add(screen, tabsBar);
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
            select: LIGHT, order: 'created_at.desc', limit: 20 }).catch(function () { return []; });
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
        /* 耳の数字に要る区画は、いま見ている回のぶんだけ後から読む */
        withDetail();
      }).catch(function (err) {
        console.error('[screens-lp] 読み込みに失敗:', err);
        add(body, el('p', 'empty', String(err && err.message || err)));
      });

      /* 種類を切り替える。同じ層が向こうにもあればそれを開く
         （A を見ていたのに、切り替えたら E が出る、を避ける） */
      function switchKind(key) {
        if (view.kind === key) { return; }
        var want = view.gen ? String(view.gen.variant_label || '') : '';
        var wantBatch = batchOf(view.gen);
        view.kind = key;
        view.gens = view.byKind[key] || [];
        view.shotAt = {};
        /* 同じ回の同じ層を開く。無ければ、同じ層の別の回を開く。
           **層を乗り換えない。** 前は見つからないと別の層の先頭に飛んでいたので、
           B層を選んだまま KV を押すと A層の KV が出て、
           「作られているのに数えられていない」と見えた（2026-10-04 指摘）。
           その層のものが本当に無いなら、無いと言う（lp.kindEmpty） */
        var mine = view.gens.filter(function (g) { return String(g.variant_label || '') === want; });
        view.gen = mine.filter(function (g) { return batchOf(g) === wantBatch; })[0]
          || mine[0]
          || (want ? null : firstVariant(view.gens));
        view.missingLabel = view.gen ? '' : want;
        view.dirty = false;
        paint();
        withDetail();
      }

      /* いちばん新しい回の、いちばん若い層を返す。
         回は content.batch でまとまっている。層の記号（A〜E）が小さい順 */
      function firstVariant(list) {
        if (!isArray(list) || !list.length) { return null; }
        var newest = list[0];
        var batch = batchOf(newest);
        var same = batch
          ? list.filter(function (g) { return batchOf(g) === batch; })
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
        clear(bulkBar);
        clear(tabsBar);
        clear(toolbar);
        clear(body);
        if (keepY) {
          window.requestAnimationFrame(function () { window.scrollTo(0, keepY); });
        }
        /* 種類の切り替え（LP / KV / 広告）。中身が無い種類も押せるようにして、
           「まだ作られていない」と言う。押せないと、無いのか壊れたのか分からない。
           置くのは層の耳の下。**層ごとに、その層のLP・KV・広告を見る**という並びにした
           （2026-10-02 要望。前は種類が耳で、層がその下だった） */
        var kinds = el('div', 'lp-delivs');
        var curLabel = String((view.gen && view.gen.variant_label) || '-');
        var curBatch = batchOf(view.gen);
        KINDS.forEach(function (k) {
          var on = view.kind === k.key;
          /* その種類に、いま見ている層のものがあるか。
             同じ回のものを先に見る。回を指定せずに拾うと、別の回の行を数えて
             いま開いている回と食い違う（数も、読み込みの有無も） */
          var all = view.byKind[k.key] || [];
          var mine = all.filter(function (g) {
            return String(g.variant_label || '-') === curLabel && batchOf(g) === curBatch;
          })[0] || all.filter(function (g) {
            return String(g.variant_label || '-') === curLabel;
          })[0];
          var b = button('lp-deliv' + (on ? ' lp-deliv--on' : '') + (mine ? '' : ' lp-deliv--empty'),
            t(k.label), function () { switchKind(k.key); });
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          /* その層・その種類で何枚できているか。層をまたいで比べられる */
          /* 区画をまだ読んでいないあいだは数を出さない。
             0/0 と出すと「無くなった」と読めてしまう */
          if (mine && isArray(mine.sections)) {
            var km = (mine.asset_prompts && mine.asset_prompts.made) || {};
            var ks = mine.sections;
            var kn = ks.filter(function (x) { return !!km[String(x.index) + '-1']; }).length;
            add(b, el('span', 'lp-deliv__count' + (kn ? '' : ' is-none'), ' ' + kn + '/' + ks.length));
          }
          add(kinds, b);
        });

        /* 一覧では本文（マスターブリーフ）を取っていない。
           開いた1本だけ後から取って、届いたら描き直す */
        if (view.gen && !view.gen.content && !fetching[view.gen.id]) {
          var want = view.gen.id;
          fetching[want] = true;
          Api.generations.get(want).then(function (full) {
            fetching[want] = false;
            if (!full || !full.content) { return; }
            KINDS.forEach(function (k) {
              (view.byKind[k.key] || []).forEach(function (g) {
                if (g.id === want) { g.content = full.content; }
              });
            });
            if (view.gen && view.gen.id === want) { view.gen.content = full.content; paint(); }
          }).catch(function () { fetching[want] = false; });
        }

        if (!view.gen) {
          /* 層まで決まっているなら、どの層の何が無いのかを言う。
             ただ「ありません」だと、別の層にはあるのか分からない */
          add(body, el('p', 'empty', view.missingLabel
            ? t('lp.kindEmptyFor', { v: view.missingLabel, k: t(kindLabel(view.kind)) })
            : (view.kind === 'lp_brief' ? t('lp.empty') : t('lp.kindEmpty'))));
          if (view.kind === 'lp_brief' && !view.missingLabel) {
            add(body, el('p', 'field__hint', t('lp.emptyHint')));
          }
          if (view.missingLabel) { add(body, el('p', 'field__hint', t('lp.kindEmptyHint'))); }
          /* 種類は、いつもと同じ「耳の下の行」に出す。
             戻れないと行き止まりになるので、何も無いときも出す
             （耳の帯に入れると、層と種類の並びが入れ替わって見える） */
          add(toolbar, kinds);
          return;
        }
        /* 層の切り替え。タブは必ず出す。
           同じ回（content.batch が同じ）にその層があればそれを、無ければ
           その層のいちばん新しい1本に飛ぶ。1層だけの回（昔の A のみの回）を
           選んでもタブが消えないようにする（実測: 過去の回を選ぶと
           タブごと消えて、他の層に戻れなくなっていた） */
        var myBatch = batchOf(view.gen);
        var batch = view.gens.filter(function (g) {
          if (myBatch) { return batchOf(g) === myBatch; }
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
          var tabs = el('div', 'lp-delivs lp-delivs--variants');
          labels.forEach(function (L) {
            /* この回に無い層は、その層の最新へ */
            var g = byLabel[L] || view.gens.filter(function (x) { return String(x.variant_label || '-') === L; })[0];
            if (!g) { return; }
            var on = g.id === view.gen.id;
            var inRound = !!byLabel[L];
            var b = button('lp-deliv' + (on ? ' lp-deliv--on' : '') + (inRound ? '' : ' lp-deliv--empty'), '',
              function () { view.gen = g; view.missingLabel = ''; view.dirty = false; paint(); withDetail(); });
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
            if (!inRound) { b.title = String(g.created_at || '').slice(0, 16).replace('T', ' '); }
            add(b, el('span', 'lp-variant__label', L));
            add(b, el('span', 'lp-variant__name', String(g.title || '').slice(0, 28)));
            /* その層に絵が何枚あるかを出す。無いと、どの層を作ったのか分からない
               （実測 2026-09-27: 絵23枚が全部A層に入っているのに、B〜E層を見て
               「まとめて生成しても1区画しか作られない」と受け取られた）。
               層が外側になったので、数えるのは LP・KV・メタ広告を合わせたぶん
               （2026-10-02。種類ごとの数は、下の行の種類に出る） */
            var gn = 0;
            var gt = 0;
            var known = false;
            KINDS.forEach(function (k) {
              var rows = view.byKind[k.key] || [];
              /* 同じ回のものを数える。回をまたぐと、いま開いている案と合わない */
              var one = rows.filter(function (x) {
                return String(x.variant_label || '-') === L && batchOf(x) === myBatch;
              })[0];
              if (!one || !isArray(one.sections)) { return; }
              known = true;
              var om = (one.asset_prompts && one.asset_prompts.made) || {};
              var os = one.sections;
              gn += os.filter(function (x) { return !!om[String(x.index) + '-1']; }).length;
              gt += os.length;
            });
            /* まだ読んでいないあいだは数を出さない */
            if (known) {
              add(b, el('span', 'lp-variant__count' + (gn ? '' : ' is-none'), gn + '/' + gt));
            }
            add(tabs, b);
          });
          add(tabsBar, tabs);
        }
        /* 層を選んでから、その層の中で種類を選ぶ。
           層が1つも無いときも、種類は出す（出さないと何も切り替えられない） */
        add(toolbar, kinds);
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
                    Api.generations.list({ eq: { projects_id: projectId, feature_key: FEATURE }, select: LIGHT, order: 'created_at.desc', limit: 20 })
                      .then(function (rows) {
                        view.gens = isArray(rows) ? rows : [];
                        var mine = view.gens.filter(function (g) { return batchOf(g) === myBatch && String(g.variant_label || '-') === L; })[0];
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
          var key = batchOf(g) || (g.created_at || '').slice(0, 16);
          if (seen[key]) { return; }
          seen[key] = 1;
          rounds.push({ key: key, gen: g });
        });
        /* 1回ぶんしか無くても出す。前は2回以上のときだけ出していたので、
           LPでは出るのに KV・メタ広告では消え、どの回を見ているのかも
           分からなくなっていた（2026-10-07 利用者の指摘）。
           回が1つでも「何回目のどの日時か」は知りたい情報なので、そのまま出す */
        if (rounds.length) {
          var pick = el('select', 'select lp-history-select');
          /* 並びは新しい順なので、番号は古い方から数える。
             日付だけだと「どれが何回目か」が分からない（実測: 4回ぶん並ぶと
             どれを見ているのか数え直していた） */
          rounds.forEach(function (r, i) {
            var nth = rounds.length - i;
            var o = el('option', null,
              t('lp.roundNth', { n: nth }) + '　' + String(r.gen.created_at || '').slice(0, 16).replace('T', ' '));
            o.value = r.key;
            var mine = batchOf(view.gen) || (view.gen.created_at || '').slice(0, 16);
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
           前は全部できると押せなくなり、直したプロンプトで作り直せなかった。
           数えるのは**同じ回の全種類（LP / KV / メタ広告）× 全層**。
           開いている1つだけを作っていたので、5層ぶんを揃えるのに15回押す必要があった */
        var batchPlan = sameBatch().map(function (g) {
          return { gen: g, miss: missingOf(g).length, all: (g.sections || []).length };
        });
        var remaining = batchPlan.reduce(function (n, x) { return n + x.miss; }, 0);
        var anyBusy = Object.keys(view.busy).length > 0;
        /* 走っていても、残りがあれば枚数を出して押せるようにする */
        /* 「123／11案」は読めない。この画面では斜線を「できた／全体」の意味で
           使っている（4/8 区画が完成・LP 7/34）ので、同じ形だと二重に誤解される。
           単位を付けて並べる（2026-10-02 指摘） */
        /* ボタンは2つに分ける。1つで全部やっていたので、何が作られるのか分からなかった
           （2026-10-03 指摘）。数字は出さない。押す前に知りたいのは
           「何を作るか」であって「残り何枚か」ではない（枚数は下の層・種類に出ている）
             生成する     … いま開いている層・種類だけ
             全部生成する … 全ターゲット層の LP・KV・メタ広告 */
        /* 「生成する」と「作り直す」は別のボタンにして、両方いつも出す。
           前は1つのボタンが切り替わる作りで、残りが1区画でもあると
           「作り直す」が消えていた。25/27 の層で、気に入らない絵を
           作り直す方法が画面から無くなっていた（2026-10-07 利用者の指摘）。
             生成する   … まだ絵が無い区画だけ（残りが無ければ押せない）
             作り直す   … その層・種類の全区画（いつでも押せる。確認を出す） */
        var mineLeft = missingOf(view.gen).length;
        var one = button('btn btn--secondary', t('lp.genOne'), function () { generate(null); });
        one.title = t('lp.genOneHint');
        one.disabled = !mineLeft || anyBusy;
        add(toolbar, one);

        var oneRedo = button('btn btn--secondary', t('lp.genOneRedo'), function () {
          var n1 = (view.gen.sections || []).length;
          if (window.confirm(t('lp.genAllRedoConfirm', { n: n1 }))) { generate('all'); }
        });
        oneRedo.title = t('lp.genOneRedoHint');
        oneRedo.disabled = anyBusy;
        add(toolbar, oneRedo);

        var all = button('btn btn--primary lp-bulk__btn',
          anyBusy && !remaining ? t('lp.genAllRunning') : t('lp.genAll'), function () {
            generateEverything(false);
          });
        /* 走っている最中でも押せる。区画ごとのボタンと同じく、押したぶんは
           別の仕事として積まれ、ワーカーが空いた順に取る。
           押せなくしていたため、見張りを1件でも取りこぼすと「まとめて生成」が
           二度と押せなくなっていた（実測: 区画ごとのボタンを続けて押したあと、
           画面を開き直すまで押せないままだった）。
           残りが0なら作り直しなので、そこだけは走行中に押させない */
        all.disabled = !remaining || anyBusy;

        /* 全部作り直す。こちらもいつでも押せるようにする（下の bulkBar に並べる） */
        var allRedo = button('btn btn--secondary lp-bulk__btn', t('lp.genAllRedo'), function () {
          var n = batchPlan.reduce(function (x, y) { return x + y.all; }, 0);
          if (window.confirm(t('lp.genAllRedoConfirm', { n: n }))) { generateEverything(true); }
        });
        allRedo.disabled = anyBusy;
        allRedo.title = t('lp.genAllRedoHint');
        /* 静止画は lp_section（OpenAI の画面）、動く絵は lp_assets（Replicate の
           seedance-2.5）と作る先が別なので、ボタンも分ける。
           押したときの案を指すので、層を切り替えてから押せばその層ぶんが作られる */
        add(toolbar, button('btn btn--secondary', t('lp.makeAssets'), function (e) {
          startAssets(e.currentTarget);
        }));
        all.title = t('lp.genAllHint');
        add(bulkBar, all);
        add(bulkBar, allRedo);
        /* できあがりを持ち出す口。生成の隣に置く（別の画面を探させない） */
        var zipBtn = button('btn btn--secondary lp-bulk__zip', t('lp.zip'), function (e) {
          downloadZip(e.currentTarget);
        });
        zipBtn.title = t('lp.zipHint');
        add(bulkBar, zipBtn);
        add(bulkBar, el('p', 'lp-bulk__note', t('lp.genAllHint')));
        add(bulkBar, viaSwitch());
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
        /* 公開は、見本より先に出す。
           見本（最大16枚）と区画（30本）の下に置くと、延々スクロールしないと
           辿り着けない（2026-10-04 指摘）。
           作る順でも、公開の設定を先に決めるほうが筋が通る */
        var pub = el('section', 'panel lp-pub');
        add(body, pub);
        paintPublish(pub);
        paintRefs();
        paintShots();
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

      /* 動く絵を頼むときに Replicate へ送る文。asset-orders.mjs が作って
         generations.asset_prompts.orders に置く。作る前に保存されるので、
         一度ボタンを押せば（失敗しても）中身が見られる */
      function orders() { var a = view.gen.asset_prompts && view.gen.asset_prompts.orders; return Array.isArray(a) ? a : []; }
      function orderOf(slot) {
        var hit = null;
        orders().forEach(function (o) { if (o && o.slot === slot && (o.kind === 'gif' || o.kind === 'video')) { hit = o; } });
        return hit;
      }

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

      /* 見本の切り抜きを作り直す。ワーカーは切り抜く前に、見本に使う写真
         そのものを選び直す（shots_by が 'human' なら人の選択を残す） */
      function rebuildRefs() {
        return Api.generationJobs.insert({
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
      }

      /* 見本に使う写真は、ふだん AI が採点して選ぶ（tools/pick-product-shots.mjs）。
         出来が良くないときに人が選び直せる口（2026-10-06 利用者の決め:
         「基本A案、ただ結果が良くなかったら人が選択して反映させる余地も残して」）。
         人が選んだら shots_by='human' を立て、以後 AI は黙って上書きしない（041） */
      function paintShots() {
        var all = isArray(view.project && view.project.image_urls)
          ? view.project.image_urls.map(String) : [];
        if (!all.length) { return; }
        var on = {};
        (isArray(view.project && view.project.product_shot_urls) ? view.project.product_shot_urls : [])
          .forEach(function (u) { on[String(u)] = true; });
        var byHuman = String((view.project && view.project.shots_by) || 'ai') === 'human';

        var box = el('section', 'panel');
        var headRow = el('div', 'lpd-section__head');
        add(headRow, el('span', 'panel__title', t('lp.shots')));
        add(headRow, el('span', 'chip chip--sm', t(byHuman ? 'lp.shotsHuman' : 'lp.shotsAi')));
        var pane = el('div', '');
        pane.hidden = true;
        var toggle = button('btn btn--secondary btn--sm', t('lp.shotsPick'), function () {
          pane.hidden = !pane.hidden;
          toggle.textContent = t(pane.hidden ? 'lp.shotsPick' : 'lp.shotsClose');
        });
        add(headRow, toggle);
        add(box, headRow);
        add(box, el('p', 'field__hint', t('lp.shotsNow', {
          n: Object.keys(on).length
        })));

        add(pane, el('p', 'field__hint', t('lp.shotsHint')));
        var row = el('div', 'lp-assets__row');
        all.forEach(function (u) {
          /* 入り切りは枠と濃さで見せる。チェックボックスを重ねるより、
             写真そのものを押せた方が速い */
          var img = el('img', 'lp-assets__thumb');
          img.src = u; img.alt = ''; img.loading = 'lazy';
          img.style.cursor = 'pointer';
          var dress = function () {
            img.style.outline = on[u] ? '3px solid var(--color-primary, #2f6df6)' : '1px solid #ddd';
            img.style.opacity = on[u] ? '1' : '0.4';
          };
          dress();
          img.addEventListener('click', function () { on[u] = !on[u]; dress(); });
          add(row, img);
        });
        add(pane, row);

        var acts = el('div', 'lpd-section__head');
        add(acts, button('btn btn--primary btn--sm', t('lp.shotsSave'), function (e) {
          var picked = all.filter(function (u) { return !!on[u]; });
          if (!picked.length) { toast(t('lp.shotsNone'), 'danger'); return; }
          var node = e && e.currentTarget;
          if (node) { node.disabled = true; }
          Api.projects.update(projectId, { product_shot_urls: picked, shots_by: 'human' })
            .then(function (p) { view.project = p; return rebuildRefs(); })
            .catch(function (err) {
              if (node) { node.disabled = false; }
              toast(String(err && err.message || err), 'danger');
            });
        }));
        /* AI に戻す口。これが無いと、一度人が選んだら二度と自動に戻せない */
        add(acts, button('btn btn--secondary btn--sm', t('lp.shotsAuto'), function (e) {
          var node = e && e.currentTarget;
          if (node) { node.disabled = true; }
          Api.projects.update(projectId, { shots_by: 'ai' })
            .then(function (p) { view.project = p; return rebuildRefs(); })
            .catch(function (err) {
              if (node) { node.disabled = false; }
              toast(String(err && err.message || err), 'danger');
            });
        }));
        add(pane, acts);
        add(box, pane);
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
          add(headRow, button('btn btn--primary btn--sm', t('lp.rebuildRefs'), function () { rebuildRefs(); }));
        }
        add(box, headRow);
        if (stale && stars.length) {
          add(box, el('p', 'field__hint', t('lp.refsStale', { n: stars.length, m: refs.length })));
        }
        if (!refs.length) { add(box, el('p', 'field__hint', t('lp.noRefs'))); add(body, box); return; }
        /* 切り抜きは2種類ある（034）。
             shape   … 商品だけがはっきり写っている。**形の根拠はこれだけ**
             context … 商品は写るが人や場面が主。使われ方の参考
           分けて見せないと「商品でない写真が見本に入っている」と見えてしまう。
           役割が無い古いプロジェクトは、全部を形の根拠として扱う */
        var roles = isArray(view.project && view.project.product_cutout_roles)
          && view.project.product_cutout_roles.length === refs.length
          ? view.project.product_cutout_roles : refs.map(function () { return 'shape'; });
        var drawGroup = function (want, labelKey, hintKey) {
          var list = refs.filter(function (u, i) { return roles[i] === want; });
          if (!list.length) { return; }
          add(box, el('p', 'field__label', t(labelKey, { n: list.length })));
          add(box, el('p', 'field__hint', t(hintKey)));
          var row = el('div', 'lp-assets__row');
          list.forEach(function (u) {
            var img = el('img', 'lp-assets__thumb');
            img.src = u; img.alt = ''; img.loading = 'lazy';
            add(row, img);
          });
          add(box, row);
        };
        drawGroup('shape', 'lp.refsShape', 'lp.refsShapeHint');
        drawGroup('context', 'lp.refsContext', 'lp.refsContextHint');
        add(body, box);
      }

      /* 絵をどこで作るか。案件ごとに覚える（projects.image_via）。
           ChatGPT の画面 … 追加課金なし。ただし回数制限があり、当たると数時間止まる
           OpenAI API     … 従量課金（1枚 $0.06〜0.08）。回数制限が無く、速い
         どちらで作っても、絵のできたあとの検査は同じものを通る（2026-10-09） */
      function viaSwitch() {
        var box = el('div', 'lp-via');
        var now = String((view.project && view.project.image_via) || '') || 'chatgpt';
        add(box, el('span', 'field__label', t('lp.via')));
        [['chatgpt', 'lp.viaBrowser'], ['api', 'lp.viaApi']].forEach(function (one) {
          var on = now === one[0];
          var b = button('btn btn--sm ' + (on ? 'btn--primary' : 'btn--secondary'), t(one[1]), function (e) {
            if (on) { return; }
            var node = e && e.currentTarget;
            if (node) { node.disabled = true; }
            Api.projects.update(projectId, { image_via: one[0] }).then(function (row) {
              view.project = row;
              toast(t(one[0] === 'api' ? 'lp.viaApiOn' : 'lp.viaBrowserOn'), 'success');
              paint();
            }).catch(function (err) {
              if (node) { node.disabled = false; }
              toast(errorMessage(err), 'danger');
            });
          });
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          add(box, b);
        });
        add(box, el('span', 'field__hint', t(now === 'api' ? 'lp.viaApiHint' : 'lp.viaBrowserHint')));
        return box;
      }

      /* 区画ごとのカード: プロンプト（編集可）＋生成ボタン＋できた絵 */
      function paintSections() {
        /* 区画は一覧では読まない（LP1件で60KBある）。読み終わるまでは
           何も出さずに空白にすると「壊れた」と見えるので、そう言っておく */
        if (!isArray(view.gen.sections)) {
          add(body, el('p', 'empty', t('lp.loadingSections')));
          return;
        }
        var list = el('ol', 'lpd-sections');
        view.gen.sections.forEach(function (sec, i) { add(list, sectionCard(sec, i)); });
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
        /* 下の生成文の入力欄。版ごとの文から「この文に戻す」を押したときに
           書き換えるので、先に名前だけ用意しておく。
           名前は必ず固有にする: この関数の下の方に GIF 用の入力欄があり、
           どちらも var ta だったため同じ変数になっていた（var は関数ごと）。
           GIF側が後から代入するので、写真の生成文に入力すると
           sec.prompt に GIF の文が書き込まれていた（実測 2026-09-29:
           写真の生成プロンプトが【場面】【動き】【質感】に化けた） */
        var promptTa = null;
        if (url) {
          var madeP = (view.gen.asset_prompts && view.gen.asset_prompts.madePrompt) || {};
          var shots = [{ url: url, at: '', prompt: madeP[slot] || '' }].concat(hist);
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
          /* その版を作った文。文を直して作り直したあと「前の方がよかった」と
             なったとき、絵だけ戻せても文が戻せないと同じものを作り直せない。
             古い版には文が残っていないことがある（この機能より前に作ったもの） */
          var shotPrompt = el('details', 'lp-shot__prompt');
          var shotPromptSum = el('summary', '', t('lp.shotPrompt'));
          var shotPromptBody = el('pre', 'lp-shot__prompt-body', '');
          var shotPromptRow = el('div', 'lp-toolbar');
          add(shotPrompt, shotPromptSum);
          add(shotPrompt, shotPromptBody);
          add(shotPrompt, shotPromptRow);

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

            var was = String(shots[at].prompt || '');
            shotPromptBody.textContent = was || t('lp.shotPromptNone');
            clear(shotPromptRow);
            /* いま書かれている文と違うときだけ「この文に戻す」を出す。
               同じ文なら押す意味がないので出さない */
            if (was && was !== String(sec.prompt || '')) {
              add(shotPromptRow, button('btn btn--secondary btn--sm', t('lp.shotPromptUse'), function () {
                sec.prompt = was;
                view.dirty = true;
                if (promptTa) { promptTa.value = was; }
                var sv = document.getElementById('lp-save'); if (sv) { sv.disabled = false; }
                toast(t('lp.shotPromptUsed'), 'success');
              }));
              add(shotPromptRow, button('btn btn--text btn--sm', t('lp.copy'), function () { copyText(was); }));
            } else if (was) {
              add(shotPromptRow, button('btn btn--text btn--sm', t('lp.copy'), function () { copyText(was); }));
            }
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
          add(li, shotPrompt);
        }

        /* よくある質問は絵を作らない。見せるのも直させるのも、写真の指示ではなく
           質問と回答そのもの（これを画面側が SVG に組んで出す）。
           写真の指示を出していたので、作られもしない「湯気の立つマグカップ」を
           直す画面になっていた（2026-10-08 利用者の指摘） */
        var faq = /よくある質問|FAQ|Q&A|Q＆A/i.test(String(sec.title || ''));
        var field = el('label', 'field');
        add(field, el('span', 'field__label', t(faq ? 'lp.faqBody' : 'lp.prompt')));
        promptTa = el('textarea', 'textarea lp-prompt');
        promptTa.value = String((faq ? (sec.body || sec.text) : sec.prompt) || '');
        promptTa.rows = faq ? 10 : 6;
        promptTa.addEventListener('input', function () {
          if (faq) { sec.body = promptTa.value; } else { sec.prompt = promptTa.value; }
          view.dirty = true;
          var s = document.getElementById('lp-save'); if (s) { s.disabled = false; }
        });
        add(field, promptTa);
        add(li, field);
        if (faq) { add(li, el('p', 'field__hint', t('lp.faqBodyHint'))); }

        var row = el('div', 'lp-toolbar');
        var busy = !!view.busy[slot];
        /* よくある質問は絵を作らない。回答まで入れると文字が多く、
           画像生成に長い日本語を描かせると字形が崩れるので、画面側が SVG で組む
           （lp-render の faqPanel）。ボタンを出すと押せてしまい、
           「指定の区画がありません」とだけ返っていた（2026-10-08 利用者の指摘）。
           押せないようにして、理由をその場に出す */
        if (faq) {
          /* ボタンは出さない。押せないだけにすると、見た目が生成中のときと
             同じ（薄い色＋押せない）なので、走っていないのに走っていると見える
             （実測 2026-10-08: 利用者が「リロードしたら生成中と表示される」と指摘）。
             作らないものは、はじめから置かない */
          add(row, el('span', 'field__hint', t('lp.faqNoImage')));
        } else {
          var b = button('btn ' + (url ? 'btn--secondary' : 'btn--primary'), busy ? t('lp.generating') : t(url ? 'lp.regen' : 'lp.gen'), function () {
            generate(sec.index);
          });
          b.disabled = busy;
          add(row, b);
        }
        add(row, button('btn btn--secondary btn--sm', t('lp.copy'), function () { copyText(String(sec.prompt || '')); }));
        add(li, row);

        /* 並びは「写真 → 写真の生成プロンプト → GIFのボタン → GIF → GIF生成文」。
           作る順に読めるようにする。前は GIF 一式が写真のプロンプトより先に出ていた */
        /* GIF まわりは1つの折りたたみにまとめる。ボタン・できた GIF・生成文が
           ばらばらに並ぶと、区画1つぶんが縦に長くなって静止画が見づらい。
           開閉は <details> に任せ、paint() を呼ばない（呼ぶと画面を作り直して
           見ていた場所を失い、ページの先頭へ飛ぶ） */
        var pick = motionPick(sec);
        var moving = motion()[slot];
        if (pick) {
          var det = el('details', 'lp-gif');
          /* 一度でも開いたらその状態を覚える。既定は、できた GIF があれば開く */
          det.open = view.motionOpen[slot] === undefined ? !!moving : !!view.motionOpen[slot];
          det.addEventListener('toggle', function () { view.motionOpen[slot] = det.open; });
          var sum = el('summary', 'lp-gif__head');
          add(sum, el('span', 'lp-gif__title', t('lp.motionGroup', { kind: pick.toUpperCase() })));
          add(sum, el('span', 'chip chip--sm' + (moving ? ' chip--success' : ''),
            t(moving ? 'lp.motionHas' : 'lp.motionNone')));
          add(det, sum);

          /* 作るボタン */
          var mrow = el('div', 'lp-toolbar');
          var mbusy = !!view.busy[slot + ':m'];
          var mb = button('btn btn--secondary btn--sm',
            mbusy ? t('lp.motionRunning') : t(moving ? 'lp.motionRedo' : 'lp.motionMake'),
            function () { generateMotion(sec.index, !!moving); });
          mb.disabled = mbusy;
          add(mrow, mb);
          add(det, mrow);

          /* できた GIF */
          if (moving) {
            var mbox = el('div', 'lp-motion');
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
            add(det, mbox);
          }

          /* 送る文。出来を見てから直せるよう、GIF の下に置く */
          var ord = orderOf(slot);
          var box = el('div', 'lp-motion-prompt');
          if (ord) {
            add(box, el('span', 'field__label',
              t('lp.motionPromptHead', { kind: String(ord.kind || '').toUpperCase(), aspect: ord.aspect || '-',
                refs: (ord.references || []).length })));
            var motionTa = el('textarea', 'textarea');
            motionTa.value = String(ord.prompt || '');
            motionTa.rows = 12;
            add(box, motionTa);
            /* 直して保存できる。次に作るときはこの文が使われる。
               ただし、区画のプロンプトを直して作り直すと組み直されるので、そう書いておく */
            var brow = el('div', 'lp-toolbar');
            add(brow, button('btn btn--secondary btn--sm', t('lp.motionPromptSave'), function () {
              saveOrderPrompt(slot, motionTa.value);
            }));
            add(brow, button('btn btn--text btn--sm', t('lp.motionPromptReset'), function () {
              motionTa.value = String(ord.prompt || '');
            }));
            add(box, brow);
            add(box, el('p', 'field__hint', t('lp.motionPromptNote')));
          } else {
            add(box, el('p', 'field__hint', t('lp.motionPromptNone')));
          }
          add(det, box);
          add(li, det);
        }
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

      /* 動く絵の文を直して保存する。orders の中の、その区画のものだけ入れ替える */
      function saveOrderPrompt(slot, text) {
        var ap = view.gen.asset_prompts || {};
        var list = (ap.orders || []).map(function (o) {
          if (o && o.slot === slot && (o.kind === 'gif' || o.kind === 'video')) {
            return Object.assign({}, o, { prompt: String(text || ''), edited: true });
          }
          return o;
        });
        var next = Object.assign({}, ap, { orders: list });
        Api.generations.update(view.gen.id, { asset_prompts: next }).then(function () {
          view.gen.asset_prompts = next;
          toast(t('lp.motionPromptSaved'), 'success');
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
              reloadAll().then(function () {
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
              reloadAll().then(function () {
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
      /* 積んでいる最中かどうか。二度押しで同じ仕事を重ねないための札 */
      var queueing = false;

      /* 3種類ぜんぶを取り直す。
         生成が終わったとき、開いている1本しか取り直していなかったので、
         層の耳や種類の数字（LP 32/34）が古いままだった
         （実測 2026-10-03: ページを開き直すと直る、と言われた）。
         数字は全種類から数えているので、全種類を取り直さないと合わない */
      function reloadAll() {
        return Promise.all(KINDS.map(function (k) {
          return Api.generations.list({ eq: { projects_id: projectId, feature_key: k.key },
            select: LIGHT, order: 'created_at.desc', limit: 20 }).catch(function () { return null; });
        })).then(function (lists) {
          KINDS.forEach(function (k, i) {
            if (isArray(lists[i])) { view.byKind[k.key] = lists[i]; }
          });
          view.gens = view.byKind[view.kind] || [];
          /* 開いている案は、取り直したものに差し替える（絵の数が増えている） */
          if (view.gen) {
            var fresh = view.gens.filter(function (g) { return g.id === view.gen.id; })[0];
            if (fresh) { view.gen = fresh; }
          }
          /* 取り直すと軽い行に戻るので、重い列も読み直す */
          detailDone = {};
          return loadDetail(batchOf(view.gen));
        });
      }

      /* 画面に戻ってきたら数え直す。
         終わりの合図は、このページが始めた生成にしか届かない。別のタブ・別の端末・
         手元から積んだ生成では合図が来ないので、耳の数字が古いまま残る
         （実測 2026-10-03: DB は KV 8/8 なのに画面は KV 0/8 のままだった）。
         文を書きかけ（dirty）のときは描き直さない。書いた字が消えるため */
      /* 取り直しは重い（この画面は1回で6MB読む）。間を置き、重ならせない。
         実測 2026-10-04: focus でも取り直していたため、窓をクリックするたびに
         6MBの読み込みが走って重なり、画面が白いまま返らなくなった。
         focus は押すたびに出るので使わない。タブに戻ったときだけ見る */
      var lastLook = Date.now();
      var looking = false;
      var LOOK_GAP = 60000;
      function refreshOnReturn() {
        if (!document.body.contains(screen)) {
          document.removeEventListener('visibilitychange', refreshOnReturn);
          return;
        }
        if (document.hidden || view.dirty || looking) { return; }
        if (Date.now() - lastLook < LOOK_GAP) { return; }
        looking = true;
        lastLook = Date.now();
        reloadAll().then(paint).catch(function () {}).then(function () {
          looking = false;
          lastLook = Date.now();
        });
      }
      document.addEventListener('visibilitychange', refreshOnReturn);

      /* ---- 販売ページの公開 ----
         公開URLは <配信の根>/<URLの名前>/<層> の形。
         GitHub Pages は静的配信なので、その場所にファイルは無く 404 になる。
         404.html が受けて view.html?lp=… へ渡す（lp-ya/404.html）。
         独自ドメインに移すときは、ここの根が変わるだけ */
      function publicBase() {
        var at = location.pathname.lastIndexOf('/');
        return location.origin + location.pathname.slice(0, at + 1);
      }

      /* URLに使える形へ。英小文字・数字・ハイフンだけ */
      function slugify(raw) {
        return String(raw || '').toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/-{2,}/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      /* 名前を決めていなければ商品名から作る。
         日本語しか無いと空になるので、そのときは空のまま返して人に決めさせる
         （勝手に project の id を使うと、意味の無いURLになる） */
      function defaultSlug() {
        var p = view.project || {};
        return slugify(p.shop_slug || p.product_name || p.name || '');
      }

      function publicUrlFor(slug, label) {
        return publicBase() + slug + '/' + String(label || '-').toLowerCase();
      }

      function paintPublish(box) {
        clear(box);
        add(box, el('h3', 'panel__title', t('lp.pub')));
        add(box, el('p', 'field__hint', t('lp.pubLead')));

        var project = view.project || {};
        var state = { slug: slugify(project.shop_slug || '') || defaultSlug(), line: String(project.line_url || '') };

        /* URLの名前 */
        var f1 = el('div', 'field');
        add(f1, el('label', 'field__label', t('lp.pubSlug')));
        var slugIn = el('input', 'input');
        slugIn.type = 'text';
        slugIn.value = state.slug;
        slugIn.setAttribute('placeholder', 'simtiple');
        slugIn.autocomplete = 'off';
        add(f1, slugIn);
        add(f1, el('p', 'field__hint', t('lp.pubSlugHint')));
        var preview = el('p', 'lp-pub__url');
        var says = el('p', 'field__hint');
        add(f1, preview);
        add(f1, says);
        add(box, f1);

        function showUrl() {
          var slug = slugify(slugIn.value);
          preview.textContent = slug
            ? t('lp.pubPreview') + '： ' + publicUrlFor(slug, 'A')
            : '';
        }
        /* 打っている最中は確かめに行かない。手が止まってから1回だけ聞く */
        var askAt = null;
        function askFree() {
          var slug = slugify(slugIn.value);
          state.slug = slug;
          showUrl();
          if (!slug) { says.textContent = t('lp.pubSlugEmpty'); says.className = 'field__error'; return; }
          says.textContent = '';
          if (!Api.lp || typeof Api.lp.slugFree !== 'function') { return; }
          Api.lp.slugFree(slug, projectId).then(function (free) {
            if (slugify(slugIn.value) !== slug) { return; }   /* もう別の字を打っている */
            says.textContent = free ? t('lp.pubSlugFree') : t('lp.pubSlugTaken');
            says.className = free ? 'field__hint' : 'field__error';
          }).catch(function () { /* 確かめられなくても公開はできる */ });
        }
        slugIn.addEventListener('input', function () {
          showUrl();
          if (askAt) { clearTimeout(askAt); }
          askAt = setTimeout(askFree, 500);
        });
        showUrl();

        /* 受け取り方（LINE / メール / 両方） */
        var fm = el('div', 'field');
        add(fm, el('label', 'field__label', t('lp.pubMode')));
        add(fm, el('p', 'field__hint', t('lp.pubModeHint')));
        var modeRow = el('div', 'lp-pub__modes');
        var mode = String(project.lead_mode || 'line');
        var modeIns = {};
        [['line', 'lp.pubModeLine'], ['mail', 'lp.pubModeMail'], ['both', 'lp.pubModeBoth']].forEach(function (pair) {
          var lab = el('label', 'lp-pub__mode');
          var r = el('input', '');
          r.type = 'radio';
          r.name = 'lp-lead-mode';
          r.value = pair[0];
          r.checked = (mode === pair[0]);
          r.addEventListener('change', function () { if (r.checked) { mode = pair[0]; showLine(); } });
          add(lab, r);
          add(lab, el('span', '', t(pair[1])));
          add(modeRow, lab);
          modeIns[pair[0]] = r;
        });
        add(fm, modeRow);
        add(box, fm);

        /* LINE */
        var f2 = el('div', 'field');
        add(f2, el('label', 'field__label', t('lp.pubLine')));
        var lineIn = el('input', 'input');
        lineIn.type = 'url';
        lineIn.value = state.line;
        lineIn.setAttribute('placeholder', 'https://lin.ee/xxxxxxx');
        lineIn.autocomplete = 'off';
        add(f2, lineIn);
        add(f2, el('p', 'field__hint', t('lp.pubLineHint')));
        add(box, f2);
        /* メールだけのときは LINE の欄を隠す（入れても使われないので迷わせない） */
        function showLine() { f2.style.display = (mode === 'mail') ? 'none' : ''; }
        showLine();

        /* ページの最初をKVから */
        var kvAll = kvUrls();
        var fk = el('div', 'field');
        var kvLab = el('label', 'lp-pub__check');
        var kvBox = el('input', '');
        kvBox.type = 'checkbox';
        kvBox.checked = !!(project.sales_info && project.sales_info.kv_first);
        kvBox.disabled = !kvAll.length;
        add(kvLab, kvBox);
        add(kvLab, el('span', '', t('lp.pubKv')));
        add(fk, kvLab);
        add(fk, el('p', kvAll.length ? 'field__hint' : 'field__error',
          kvAll.length ? t('lp.pubKvHint') : t('lp.pubKvNone')));
        add(box, fk);

        /* 販売の条件。入れた項目だけがページに出る */
        var info = (project.sales_info && typeof project.sales_info === 'object') ? project.sales_info : {};
        var box2 = el('details', 'lp-pub__terms');
        var sum = el('summary', 'lp-pub__sum', t('lp.pubInfo'));
        add(box2, sum);
        add(box2, el('p', 'field__hint', t('lp.pubInfoHint')));
        var ins = {};
        /* 上の2つは LINE登録の塊の2行目・3行目になる。事実なので AI には書かせない */
        [['sale_start', 'lp.pubStart', 'lp.pubStartPh', 'lp.pubStartHint'],
          ['discount', 'lp.pubOff', 'lp.pubOffPh', 'lp.pubOffHint'],
          ['shipping', 'lp.pubShipping', 'lp.pubShippingPh', ''],
          ['delivery', 'lp.pubDelivery', 'lp.pubDeliveryPh', ''],
          ['warranty', 'lp.pubWarranty', 'lp.pubWarrantyPh', ''],
          ['returns', 'lp.pubReturns', 'lp.pubReturnsPh', ''],
          ['seller', 'lp.pubSeller', 'lp.pubSellerPh', 'lp.pubSellerHint'],
          ['note', 'lp.pubNote', '', ''],
          ['platform_logo', 'lp.pubLogo', 'lp.pubLogoPh', 'lp.pubLogoHint']].forEach(function (one) {
          var f = el('div', 'field');
          add(f, el('label', 'field__label', t(one[1])));
          var i = el('input', 'input');
          i.type = 'text';
          i.value = String(info[one[0]] || '');
          if (one[2]) { i.setAttribute('placeholder', t(one[2])); }
          add(f, i);
          if (one[3]) { add(f, el('p', 'field__hint', t(one[3]))); }
          add(box2, f);
          ins[one[0]] = i;
        });
        add(box, box2);
        function termsValue() {
          var v = {};
          Object.keys(ins).forEach(function (k) {
            var x = ins[k].value.trim();
            if (x) { v[k] = x; }
          });
          /* KVから始めるかは、販売の条件と同じ入れ物に持つ（列を増やさない） */
          if (kvBox.checked) { v.kv_first = true; }
          return v;
        }
        function leadMode() { return mode; }

        /* 販売ページの文章があるか */
        var withCopy = sameBatch().filter(function (g) {
          return g.feature_key === 'lp_brief' && g.content && g.content.sales;
        });
        add(box, el('p', withCopy.length ? 'field__hint' : 'field__error',
          withCopy.length ? t('lp.pubHasCopy', { n: withCopy.length }) : t('lp.pubNoCopy')));

        var row = el('div', 'lp-pub__row');
        add(row, button('btn btn--secondary', t('lp.pubSave'), function (e) {
          savePublishSettings(e.currentTarget, slugify(slugIn.value), lineIn.value.trim(), termsValue(), leadMode());
        }));
        add(row, button('btn btn--secondary', t('lp.pubWrite'), function (e) {
          writeSalesCopy(e.currentTarget, slugify(slugIn.value), lineIn.value.trim(), termsValue(), leadMode());
        }));
        /* 公開できるのは、絵のある LP だけ */
        var ready = sameBatch().filter(function (g) {
          return g.feature_key === 'lp_brief' && doneOf(g) > 0;
        });
        var go = button('btn btn--primary', t('lp.pubGo', { n: ready.length }), function (e) {
          publishAll(e.currentTarget, slugify(slugIn.value), lineIn.value.trim(), ready, termsValue(), leadMode());
        });
        go.disabled = !ready.length;
        add(row, go);
        add(box, row);
        if (!ready.length) { add(box, el('p', 'field__hint', t('lp.pubNone'))); }

        /* 集まったメール。メールで受け取る設定のときだけ出す */
        if (mode === 'mail' || mode === 'both') {
          var leadBox = el('div', 'lp-pub__leads');
          add(leadBox, el('h4', 'field__label', t('lp.leads')));
          add(box, leadBox);
          paintLeads(leadBox);
        }

        /* すでに公開しているものの一覧 */
        var live = sameBatch().filter(function (g) { return g.published_at && g.public_url_slug; });
        if (live.length) {
          var list = el('ul', 'lp-pub__list');
          live.forEach(function (g) {
            var li = el('li', 'lp-pub__item');
            add(li, el('span', 'lp-pub__label', String(g.variant_label || '-')));
            var url = publicBase() + String(g.public_url_slug);
            var a = el('a', 'lp-pub__link', url);
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener';
            add(li, a);
            add(li, button('btn btn--secondary btn--sm', t('lp.pubCopy'), function () {
              navigator.clipboard.writeText(url).then(function () { toast(t('lp.pubCopied'), 'success'); })
                .catch(function () { window.prompt(t('lp.pubPreview'), url); });
            }));
            add(list, li);
          });
          add(box, list);
          add(box, button('btn btn--secondary', t('lp.pubStop'), function (e) {
            unpublishAll(e.currentTarget, live);
          }));
        }
      }

      /* 集まったメールを見る・落とす・消す。
         出すのは最新200件まで（全部を一度に出すと画面が重い）。
         CSV はブラウザの中で作る（送り先を増やさない） */
      function paintLeads(box) {
        if (!window.Api || !Api.leads || typeof Api.leads.list !== 'function') { return; }
        var hold = el('p', 'field__hint', '…');
        add(box, hold);
        Api.leads.list({ eq: { projects_id: projectId }, order: 'created_at.desc', limit: 200 })
          .then(function (rows) {
            hold.remove();
            var list = isArray(rows) ? rows : [];
            if (!list.length) { add(box, el('p', 'field__hint', t('lp.leadsNone'))); return; }
            add(box, el('p', 'field__hint', t('lp.leadsCount', { n: list.length })));
            var row = el('div', 'lp-pub__row');
            add(row, button('btn btn--secondary btn--sm', t('lp.leadsCsv'), function () {
              /* Excel が文字化けしないよう BOM を付ける */
              var head = '\ufeff日時,メール,層,ページ\n';
              var body = list.map(function (x) {
                return [String(x.created_at || '').slice(0, 19).replace('T', ' '),
                  String(x.email || ''), String(x.variant || ''), String(x.slug || '')]
                  .map(function (c) { return '"' + c.replace(/"/g, '""') + '"'; }).join(',');
              }).join('\n');
              var blob = new Blob([head + body], { type: 'text/csv;charset=utf-8' });
              var a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = (slugify((view.project && view.project.shop_slug) || 'leads') || 'leads') + '.csv';
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(function () { URL.revokeObjectURL(a.href); }, 20000);
            }));
            add(box, row);
            var ul = el('ul', 'lp-pub__leadlist');
            list.slice(0, 50).forEach(function (x) {
              var li = el('li', 'lp-pub__lead');
              add(li, el('span', 'lp-pub__leadmail', String(x.email || '')));
              add(li, el('span', 'lp-pub__leadmeta',
                String(x.variant || '') + ' / ' + String(x.created_at || '').slice(0, 10)));
              add(li, button('btn btn--secondary btn--sm', t('lp.leadsDel'), function () {
                Api.leads.remove(x.id).then(function () {
                  li.remove();
                }).catch(function (err) {
                  console.error('[screens-lp] メールを消せませんでした:', err);
                  toast(String(err && err.message || err), 'danger');
                });
              }));
              add(ul, li);
            });
            add(box, ul);
          })
          .catch(function (err) {
            hold.textContent = String(err && err.message || err);
            console.error('[screens-lp] 集まったメールを読めませんでした:', err);
          });
      }

      /* いま見ている層の KV の絵。ページの最初に並べる。
         KV は別の生成物（kv_brief）なので、同じ回・同じ層のものを拾う */
      function kvUrls() {
        var label = String((view.gen && view.gen.variant_label) || '-');
        var batch = batchOf(view.gen);
        var kv = (view.byKind.kv_brief || []).filter(function (g) {
          return String(g.variant_label || '-') === label && batchOf(g) === batch;
        })[0];
        if (!kv) { return []; }
        var made = (kv.asset_prompts && kv.asset_prompts.made) || {};
        return (kv.sections || []).map(function (sec) { return made[String(sec.index) + '-1']; })
          .filter(Boolean).map(String);
      }

      /* その層の KV（公開するときに使う）。層ごとに引き直す */
      function kvUrlsFor(g) {
        var label = String(g.variant_label || '-');
        var batch = batchOf(g);
        var kv = (view.byKind.kv_brief || []).filter(function (x) {
          return String(x.variant_label || '-') === label && batchOf(x) === batch;
        })[0];
        if (!kv) { return []; }
        var made = (kv.asset_prompts && kv.asset_prompts.made) || {};
        return (kv.sections || []).map(function (sec) { return made[String(sec.index) + '-1']; })
          .filter(Boolean).map(String);
      }

      /* その案に絵が何枚あるか */
      function doneOf(g) {
        var made = (g.asset_prompts && g.asset_prompts.made) || {};
        return Object.keys(made).length;
      }

      /* 販売ページの文章を AI に書かせる。
         先に販売の条件を保存してから積む（書いている最中に条件を読むので、
         保存前に積むと「未入力」のまま書かれる） */
      function writeSalesCopy(node, slug, line, terms, mode) {
        if (!window.Api || !Api.generationJobs) { toast(t('common.error'), 'danger'); return; }
        var batch = batchOf(view.gen);
        if (!batch) { toast(t('lp.pubNone'), 'danger'); return; }
        var was = node.textContent;
        node.disabled = true;
        node.textContent = t('lp.pubWriting');
        var patch = { shop_slug: slug || null, line_url: line || null, lead_mode: mode || 'line' };
        if (terms) { patch.sales_info = Object.keys(terms).length ? terms : null; }
        Api.projects.update(projectId, patch).catch(function () { /* 保存できなくても進める */ })
          .then(function () {
            if (view.project) {
              view.project.shop_slug = patch.shop_slug;
              view.project.line_url = patch.line_url;
              view.project.lead_mode = patch.lead_mode;
              if (terms) { view.project.sales_info = patch.sales_info; }
            }
            return Api.generationJobs.insert({
              feature_key: 'sales_copy', status: 'pending', projects_id: projectId,
              users_id: (window.Api && Api.auth && typeof Api.auth.userId === 'function') ? Api.auth.userId() : undefined,
              payload: { batch: batch }, lang: currentLocale()
            });
          })
          .then(function (job) {
            toast(t('lp.pubWriting'), 'success');
            if (!App.watchJob) { return; }
            App.watchJob({
              jobId: job.id, titleKey: 'lp.pubWrite', urls: [],
              onDone: function () {
                reloadAll().then(function () {
                  toast(t('lp.pubWritten'), 'success');
                  paint();
                });
              },
              onFail: function (why) { toast(String(why || t('common.error')), 'danger'); }
            });
          })
          .catch(function (err) {
            console.error('[screens-lp] 販売ページの文章を積めませんでした:', err);
            toast(String(err && err.message || err), 'danger');
          })
          .then(function () { node.disabled = false; node.textContent = was; });
      }

      function savePublishSettings(node, slug, line, terms, mode) {
        node.disabled = true;
        var patch = { shop_slug: slug || null, line_url: line || null, lead_mode: mode || 'line' };
        if (terms) { patch.sales_info = Object.keys(terms).length ? terms : null; }
        Api.projects.update(projectId, patch)
          .then(function (row) {
            view.project = row || view.project;
            if (view.project) {
              view.project.shop_slug = patch.shop_slug;
              view.project.line_url = patch.line_url;
              view.project.lead_mode = patch.lead_mode;
              if (terms) { view.project.sales_info = patch.sales_info; }
            }
            toast(t('lp.pubSaved'), 'success');
          })
          .catch(function (err) {
            console.error('[screens-lp] 公開の設定を保存できませんでした:', err);
            toast(String(err && err.message || err), 'danger');
          })
          .then(function () { node.disabled = false; });
      }

      /* 層ごとに、LPのHTMLを組んでから公開する。
         組むのは S13 と同じ LpRender。片方だけ見た目が変わらないよう、
         組み立ては1か所から呼ぶ */
      function buildOne(g, line, terms, mode) {
        if (!window.LpRender || typeof LpRender.buildDraftHtml !== 'function') {
          throw new Error('LpRender がありません');
        }
        var prompts = (g.asset_prompts && typeof g.asset_prompts === 'object') ? g.asset_prompts : {};
        var design = LpRender.designFromProject ? LpRender.designFromProject(view.project) : undefined;
        /* 販売ページの文章があれば、そちらで組む。
           クラファンLPの並びのまま公開すると、価格も送料も保証も出ない
           （2026-10-04 要望: 実際に売っているページにする）。
           無ければ、これまでどおり区画をそのまま並べる */
        var sales = g.content && g.content.sales;
        if (sales && LpRender.buildSalesHtml) {
          var wantLine = (mode !== 'mail');
          var wantMail = (mode === 'mail' || mode === 'both');
          var made = LpRender.buildSalesHtml({
            sales: sales,
            /* LP案で作った区画ぜんぶ。順番どおりに並べるのに使う */
            sections: (g && g.sections) || [],
            /* 区画ごとの見せ方。販売ページでも同じ設定を効かせる */
            modes: (prompts && prompts.mode) || {},
            assets: (prompts.made && typeof prompts.made === 'object') ? prompts.made : {},
            design: design,
            title: (view.project && (view.project.product_name || view.project.name)) || '',
            platform: String((view.project && view.project.cf_platform) || ''),
            platformLogo: String((terms && terms.platform_logo) || ''),
            /* 誘いの塊の2行目・3行目。売る人が入れた事実をそのまま出す */
            saleStart: String((terms && terms.sale_start) || ''),
            discount: String((terms && terms.discount) || ''),
            lineUrl: wantLine ? (line || '') : '',
            /* ページの最初を KV から（チェックしたときだけ） */
            kv: (terms && terms.kv_first) ? kvUrlsFor(g) : [],
            /* メールで受け取る。送り先は公開ページから直接 Supabase の RPC */
            mail: wantMail ? {
              url: Api.URL,
              key: Api.ANON_KEY,
              slug: String(g.public_url_slug || ''),
              note: (window.LpRender && LpRender.mailNote) || ''
            } : null
          });
          if (made) { return made; }
        }
        return LpRender.buildDraftHtml({
          draft: { summary: g.content && g.content.summary, sections: g.sections },
          project: view.project,
          design: design,
          assets: (prompts.made && typeof prompts.made === 'object') ? prompts.made : {},
          burnedSlots: (isArray(prompts.burnedSlots) ? prompts.burnedSlots : [])
            .filter(function (slot) { return prompts.made && prompts.made[slot]; }),
          title: (view.project && (view.project.product_name || view.project.name)) || '',
          /* 友だち追加。URLが無ければボタンは出ない */
          lineUrl: line || ''
        });
      }

      function publishAll(node, slug, line, rows, terms, mode) {
        if (!slug) { toast(t('lp.pubSlugEmpty'), 'danger'); return; }
        if (!rows.length) { toast(t('lp.pubNone'), 'danger'); return; }
        var was = node.textContent;
        node.disabled = true;
        node.textContent = t('lp.pubGoing');
        /* 名前とLINEを先に保存する。公開したページと設定がずれないように */
        var patch = { shop_slug: slug, line_url: line || null, lead_mode: mode || 'line' };
        if (terms) { patch.sales_info = Object.keys(terms).length ? terms : null; }
        Api.projects.update(projectId, patch)
          .then(function () {
            if (view.project) {
              view.project.shop_slug = patch.shop_slug;
              view.project.line_url = patch.line_url;
              view.project.lead_mode = patch.lead_mode;
              if (terms) { view.project.sales_info = patch.sales_info; }
            }
          })
          .catch(function () { /* 保存できなくても公開は進める */ })
          .then(function () {
            /* 1本ずつ順に。まとめて投げると、重なったときにどれが失敗したか分からない */
            var at = 0;
            var okCount = 0;
            function next() {
              if (at >= rows.length) { return Promise.resolve(); }
              var g = rows[at];
              at += 1;
              var want = slug + '/' + String(g.variant_label || '-').toLowerCase();
              /* メールの送り先はこのページの slug。公開してから決まるのでは遅いので、
                 これから付ける名前を先に入れておく */
              g.public_url_slug = want;
              var html;
              try { html = buildOne(g, line, terms, mode); } catch (err) {
                console.error('[screens-lp] 組み立てに失敗:', g.variant_label, err);
                return next();
              }
              return Api.lp.publish(g.id, html, want).then(function () {
                okCount += 1;
              }).catch(function (err) {
                console.error('[screens-lp] 公開に失敗:', g.variant_label, err);
              }).then(next);
            }
            return next().then(function () { return okCount; });
          })
          .then(function (okCount) {
            toast(t('lp.pubDone', { n: okCount }), 'success');
            return reloadAll().then(paint);
          })
          .catch(function (err) {
            console.error('[screens-lp] 公開できませんでした:', err);
            toast(String(err && err.message || err), 'danger');
          })
          .then(function () { node.disabled = false; node.textContent = was; });
      }

      function unpublishAll(node, rows) {
        node.disabled = true;
        var at = 0;
        function next() {
          if (at >= rows.length) { return Promise.resolve(); }
          var g = rows[at];
          at += 1;
          return Api.lp.unpublish(g.id).catch(function (err) {
            console.error('[screens-lp] 公開を止められませんでした:', g.variant_label, err);
          }).then(next);
        }
        next().then(function () {
          toast(t('lp.pubStopped'), 'success');
          return reloadAll().then(paint);
        }).then(function () { node.disabled = false; });
      }

      /* この回の成果物を1つの zip にして落とす。
         入れるのは、できた絵と、それを作った生成文。
         フォルダ名は ASCII（A/LP/01.png）にする。日本語のフォルダ名は
         macOS 同梱の unzip(6.0) が UTF-8 の印を無視して壊すため
         （Finder は正しく開くが、受け取った人の道具を選ばない形にする）。
         層の名前は中の一覧（README.txt）に書く */
      function zipName(kind) {
        return kind === 'kv_brief' ? 'KV' : (kind === 'ads_brief' ? 'ADS' : 'LP');
      }

      function downloadZip(node) {
        if (!window.Zip) {
          console.error('[screens-lp] Zip がありません。zip.js の読み込みを確認してください。');
          toast(t('common.error'), 'danger');
          return;
        }
        var rows = sameBatch();
        /* 絵のある区画だけを数え上げる */
        var want = [];
        rows.forEach(function (g) {
          var made = (g.asset_prompts && g.asset_prompts.made) || {};
          (g.sections || []).forEach(function (sec) {
            var url = made[String(sec.index) + '-1'];
            if (!url) { return; }
            want.push({ gen: g, sec: sec, url: String(url) });
          });
        });
        if (!want.length) { toast(t('lp.zipNone'), 'danger'); return; }

        var brand = String((view.project && (view.project.product_name || view.project.name)) || 'lp')
          .replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'lp';
        var was = node.textContent;
        node.disabled = true;

        var files = [];
        var done = 0;
        /* 一度に取りに行くのは4本まで。全部まとめて投げると、
           枚数が多い回でブラウザが詰まる */
        var at = 0;
        function next() {
          if (at >= want.length) { return Promise.resolve(); }
          var one = want[at];
          at += 1;
          return fetch(one.url).then(function (r) {
            if (!r.ok) { throw new Error('HTTP ' + r.status); }
            return r.arrayBuffer();
          }).then(function (buf) {
            var ext = (one.url.split('?')[0].match(/\.(png|jpe?g|gif|webp|mp4)$/i) || [, 'png'])[1];
            var no = ('0' + one.sec.index).slice(-2);
            files.push({
              name: brand + '/' + String(one.gen.variant_label || '-') + '/'
                + zipName(one.gen.feature_key) + '/' + no + '.' + ext.toLowerCase(),
              data: buf
            });
          }).catch(function (err) {
            /* 1枚落とせなくても、残りは落とす。何が欠けたかは中に残す */
            console.error('[screens-lp] 落とせませんでした:', one.url, err);
            files.push({
              name: brand + '/' + String(one.gen.variant_label || '-') + '/'
                + zipName(one.gen.feature_key) + '/' + ('0' + one.sec.index).slice(-2) + '.取得できず.txt',
              data: one.url
            });
          }).then(function () {
            done += 1;
            node.textContent = t('lp.zipBusy', { n: done, m: want.length });
            return next();
          });
        }

        var lanes = [];
        for (var i = 0; i < Math.min(4, want.length); i += 1) { lanes.push(next()); }
        Promise.all(lanes).then(function () {
          /* 生成文と、層の名前の一覧を添える */
          rows.forEach(function (g) {
            var lines = ['# ' + String(g.title || '') + '（' + String(g.variant_label || '-') + ' / '
              + zipName(g.feature_key) + '）', ''];
            (g.sections || []).forEach(function (sec) {
              lines.push('## 区画' + sec.index + ' ' + String(sec.title || ''));
              lines.push(String(sec.prompt || ''));
              lines.push('');
            });
            files.push({
              name: brand + '/' + String(g.variant_label || '-') + '/'
                + zipName(g.feature_key) + '/生成プロンプト.txt',
              data: lines.join('\n')
            });
          });
          var guide = ['# ' + brand, '',
            'エルピーヤで作った絵と生成文です。',
            '層ごとのフォルダ（A〜E）の中に、LP / KV / ADS が入っています。', ''];
          var seen = {};
          rows.forEach(function (g) {
            var L = String(g.variant_label || '-');
            if (seen[L]) { return; }
            seen[L] = 1;
            guide.push(L + ' … ' + String(g.title || ''));
          });
          files.push({ name: brand + '/README.txt', data: guide.join('\n') });

          var blob = Zip.make(files);
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = brand + '.zip';
          document.body.appendChild(a);
          a.click();
          a.remove();
          /* 作った URL は使い終わったら捨てる（持ったままだと中身が残る） */
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 20000);
          toast(t('lp.zipDone', { n: files.length }), 'success');
        }).catch(function (err) {
          console.error('[screens-lp] zip を作れませんでした:', err);
          toast(String(err && err.message || err), 'danger');
        }).then(function () {
          node.disabled = false;
          node.textContent = was;
        });
      }

      /* 同じ回（batch）の、全種類（LP / KV / メタ広告）× 全層ぶんの生成物を集める。
         「全区画をまとめて生成」はここを使う。
         これまでは開いている種類・層の1つしか作らなかったので、
         5層ぶんのLPとKVと広告を作るのに15回押す必要があった（2026-10-02 要望） */
      function sameBatch() {
        var myBatch = batchOf(view.gen);
        var myTime = (view.gen && view.gen.created_at || '').slice(0, 16);
        var out = [];
        KINDS.forEach(function (k) {
          (view.byKind[k.key] || []).forEach(function (g) {
            var b = batchOf(g);
            var same = myBatch ? (b === myBatch) : ((g.created_at || '').slice(0, 16) === myTime);
            if (same && isArray(g.sections) && g.sections.length) { out.push(g); }
          });
        });
        return out;
      }

      /* その生成物の、まだ絵が無い区画の番号 */
      function missingOf(g) {
        var made = (g.asset_prompts && g.asset_prompts.made) || {};
        return (g.sections || []).filter(function (s) { return !made[String(s.index) + '-1']; })
          .map(function (s) { return s.index; });
      }

      /* 全種類・全層をまとめて積む。1つの生成物＝1つの仕事（ワーカーは3件まで同時に取る） */
      function generateEverything(redo) {
        if (!window.Api || !Api.generationJobs) { toast(t('common.error'), 'danger'); return; }
        /* 二度押しで同じ仕事が重なるのを止める。
           実測 2026-10-02: 4回押されて同じ内容が4重に積まれ、57件の待ち行列になった。
           混みすぎて1枚に879秒かかっていた（ふだんは40〜60秒）。
           押せてしまう作りだったので、押した側は重なっていることに気づけない */
        if (queueing) { toast(t('lp.queueing'), 'success'); return; }
        queueing = true;
        var unlock = function () { queueing = false; };
        /* 積む前に必ず取り直す。ページは開きっぱなしのことがあり、手元の写しは古い。
           実測 2026-10-03: 230枚できている案を「1枚も無い」と見て全部積み直し、
           2時間かけて出来上がりを上書きしていた。
           さらに「生成プロンプトを更新する」で新しい回が増えていても、
           画面が古い回のままだと、古い回に積んでしまう（新しい回は0枚のまま）。
           いちばん新しい回に合わせてから積む */
        reloadAll().then(function () {
          var newest = null;
          KINDS.forEach(function (k) {
            (view.byKind[k.key] || []).forEach(function (g) {
              if (!isArray(g.sections) || !g.sections.length) { return; }
              if (!newest || (g.created_at || '') > (newest.created_at || '')) { newest = g; }
            });
          });
          var mine = batchOf(view.gen);
          var top = batchOf(newest);
          if (newest && top && mine && top !== mine) {
            view.gen = (view.byKind[view.kind] || []).filter(function (g) {
              var b = batchOf(g);
              return b === top && isArray(g.sections) && g.sections.length;
            })[0] || newest;
            view.dirty = false;
            paint();
            toast(t('lp.movedToNewest'), 'success');
            return loadDetail(top).then(function () { paint(); queueAll(redo, unlock); });
          }
          return queueAll(redo, unlock);
        }).catch(function () { queueAll(redo, unlock); });
      }

      /* 積む本体。generateEverything が取り直したあとに呼ぶ */
      function queueAll(redo, unlock) {
        var plan = sameBatch().map(function (g) {
          return { gen: g, sections: redo ? (g.sections || []).map(function (s) { return s.index; }) : missingOf(g) };
        }).filter(function (x) { return x.sections.length; });
        if (!plan.length) { unlock(); toast(t('lp.allDone'), 'success'); return; }
        var total = plan.reduce(function (n, x) { return n + x.sections.length; }, 0);
        /* すでに同じ案の仕事が待っていれば積まない。
           画面を開き直すと札が下りるので、札だけでは防ぎきれない */
        var already = function () {
          if (!Api.generationJobs.list) { return Promise.resolve({}); }
          /* order は文字列で渡す（'created_at.desc'）。
             オブジェクトを渡していたので毎回エラーになり、catch が黙って {} を返し、
             重複の検出がまったく効いていなかった（実測 2026-10-02:
             1時間20分あけて押した2回ぶんが、そのまま二重に積まれた） */
          return Api.generationJobs.list({
            eq: { projects_id: projectId, feature_key: 'lp_section' },
            order: 'created_at.desc', limit: 200
          }).then(function (rows) {
            var busyGen = {};
            (isArray(rows) ? rows : []).forEach(function (r) {
              if (r.status !== 'pending' && r.status !== 'processing') { return; }
              var g = r.payload && r.payload.generation_id;
              if (g) { busyGen[g] = true; }
            });
            return busyGen;
          }).catch(function (err) {
            /* 調べられなくても積めなくならない。ただし黙らない。
             黙っていたせいで、効いていないことに気づけなかった */
            console.error('[screens-lp] すでに走っている仕事を調べられませんでした', err);
            return {};
          });
        };

        var put = function () {
          plan.forEach(function (x) {
            if (x.gen.id === view.gen.id) {
              x.sections.forEach(function (ix) { view.busy[String(ix) + '-1'] = true; });
            }
          });
          paint();
          already().then(function (busyGen) {
          var skipped = plan.filter(function (x) { return busyGen[x.gen.id]; }).length;
          plan = plan.filter(function (x) { return !busyGen[x.gen.id]; });
          if (!plan.length) {
            unlock();
            Object.keys(view.busy).forEach(function (k2) { delete view.busy[k2]; });
            paint();
            toast(t('lp.alreadyQueued'), 'success');
            return;
          }
          if (skipped) { console.log('[screens-lp] すでに走っている ' + skipped + '案は積みませんでした'); }
          return Promise.all(plan.map(function (x) {
            return Api.generationJobs.insert({
              feature_key: 'lp_section',
              status: 'pending',
              projects_id: projectId,
              users_id: (window.Api && Api.auth && typeof Api.auth.userId === 'function') ? Api.auth.userId() : undefined,
              payload: { generation_id: x.gen.id, sections: x.sections },
              lang: currentLocale()
            });
          })).then(function (jobs) {
            unlock();
            toast(t('lp.queuedAll', { n: total }), 'success');
            /* 進み具合のポップアップを出す。
               見張れるのは1件なので、いま開いている案の仕事を見る。
               開いている案が無ければ先頭の仕事。
               実測 2026-10-02: ここを足し忘れて、まとめて生成のときだけ
               ポップアップが出なくなっていた（1案ずつのときは出ていた） */
            var mineAt = 0;
            plan.forEach(function (x, i) { if (x.gen.id === view.gen.id) { mineAt = i; } });
            var watched = jobs[mineAt];
            if (!App.watchJob || !watched) { paint(); return; }
            App.watchJob({
              jobId: watched.id,
              /* 一緒に積んだ仕事。中止はこれも全部止める。
                 1件だけ止めても残りが動き続けるので「中止されない」と見える
                 （実測 2026-10-02） */
              siblings: jobs.map(function (x) { return x && x.id; }).filter(Boolean),
              titleKey: 'job.titleAssets',
              urls: [],
              onDone: function () {
                /* 全種類を取り直す。1本だけだと層の耳の数字が古いまま残る */
                reloadAll().then(function () {
                  plan[mineAt].sections.forEach(function (ix) {
                    delete view.busy[String(ix) + '-1'];
                    view.shotAt[String(ix) + '-1'] = 0;
                  });
                  toast(plan.length > 1 ? t('lp.doneOne') : t('lp.genDone'), 'success');
                  paint();
                });
              },
              onFail: function (why) {
                plan[mineAt].sections.forEach(function (ix) { delete view.busy[String(ix) + '-1']; });
                toast(String(why || t('common.error')), 'danger');
                paint();
              }
            });
          }).catch(function (err) {
            unlock();
            Object.keys(view.busy).forEach(function (k2) { delete view.busy[k2]; });
            paint();
            toast(String(err && err.message || err), 'danger');
          });
          });
        };
        if (view.dirty) {
          Api.generations.update(view.gen.id, { sections: view.gen.sections }).then(function () {
            view.dirty = false;
            var sv = document.getElementById('lp-save'); if (sv) { sv.disabled = true; }
            put();
          }).catch(function (err) {
            unlock();
            toast(t('lp.genSaveFailed') + '：' + String(err && err.message || err), 'danger');
          });
        } else { put(); }
      }

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
                reloadAll().then(function () {
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
        /* 直したプロンプトは先に保存してから作る。
           保存が転んだら作らない。前は catch が無く、転ぶと何も起きないまま
           「押したのに動かない」になっていた */
        if (view.dirty) {
          Api.generations.update(view.gen.id, { sections: view.gen.sections }).then(function () {
            view.dirty = false;
            var sv = document.getElementById('lp-save'); if (sv) { sv.disabled = true; }
            toast(t('lp.genWithEdited'), 'success');
            go();
          }).catch(function (err) {
            targets.forEach(function (ix) { delete view.busy[String(ix) + '-1']; });
            paint();
            toast(t('lp.genSaveFailed') + '：' + String(err && err.message || err), 'danger');
          });
        } else { go(); }
      }
    }
  });
})();
