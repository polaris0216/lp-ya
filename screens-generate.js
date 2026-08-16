/*!
 * screens-generate.js — エルピーヤ
 * S13 生成結果（右側にPC・スマホモックアップ同時プレビュー） /
 * S14 デザイン編集（Figma風エディタ） /
 * S15 デバイスプレビュー拡大（PC／スマホ切替） の3画面だけを担当する。
 *
 * ---- 他ファイルとの約束（この綴りのまま使う。似た名前を作らない）----
 * 画面登録は index.html の契約どおり1形式だけ:
 *   App.registerScreen('S13', { render: function (root, params) { ... } });
 *   第2引数は必ず { render: 関数 } オブジェクト。関数をそのまま渡さない。
 *   app.js 側は spec.render(root, params) で呼ぶ。
 *   window.renderXxx / window.Screens.Xxx などの別方式は混ぜない。
 *
 * 画面遷移は index.html に書かれたハッシュ経路をそのまま使う:
 *   '#/S8?id=<プロジェクトID>' '#/S11?id=<プロジェクトID>' '#/S13?id=...'
 *   '#/S14?id=...&gen=<生成物ID>' '#/S15?id=...&gen=...&section=<番号>' '#/S17'
 *   プロジェクトに紐づく画面の id は「プロジェクトID」（app.js の PROJECT_SCOPED と同じ約束）。
 *
 * i18n.js が実際に公開している名前だけを使う:
 *   window.t(key, params) / window.I18N.getLocale() / イベント 'elpiya:locale-changed'
 *   この3画面の文言は generate.* / design.* / preview.* / credit.* / common.* を使い、
 *   i18n.js に無い言い回しだけ、このファイルの LOCAL に ja / en / ko の3言語で持ち、
 *   'gen.' で始まるキーにする（表に無ければコンソールに何が無いかを残す）。
 *
 * api.js（window.Api）から使う名前は api.js が実際に公開しているものだけ:
 *   Api.projects.get(id)
 *   Api.generations.list(options) / .get(id) / .update(id, patch)
 *   Api.generations.generate(payload)  S12経由で来たときだけ。中身づくりと
 *     クレジット消費は generate-content Edge Function（サーバー側）が行う
 *   Api.analysisReports.list(options)
 *   Api.users.get(id)
 *   Api.storage.get('userId'|'projectId'|'generationId') / .set(名前, 値)
 *   失敗時の reject は必ず ApiError（err.code と err.message を持つ）。
 *
 * app.js（window.App）から使う名前も app.js が実際に公開しているものだけ:
 *   App.registerScreen / App.getUser / App.setUser(user, { silent: true }) /
 *   App.formatNumber / App.toast / App.confirm
 *   無いときは何が無いかをコンソールに残したうえで、このファイル側の予備実装で必ず動かす。
 *
 * 通信は Supabase だけ。生成物のプレビューは srcdoc の iframe に閉じ、
 * 外部CDN・外部画像・外部フォントは1つも読み込まない
 * （画像は書き出したHTMLファイルの中でだけ実体のURLになる）。
 *
 * このファイルが触る class は styles.css に実在するものだけ:
 *   screen / screen__head / screen__title / screen__lead / section / section__head /
 *   section__title / section__desc / stack / stack--tight / stack--group / row /
 *   row--2 / row--between / list / list__head / list-row / list-row__body /
 *   list-row__title / list-row__sub / list-row__meta / list-row__action /
 *   list-row--selected / info-list / info-row / info-row__key / info-row__val /
 *   card / card--gradient / card--soft / card__label / card__value / card__unit /
 *   card__sub / field / field__label / field__hint / field__error / input /
 *   input--error / textarea / select / counter / counter--over / chips / chip /
 *   chip--selected / chip--mute / tabs / tabs__item / tabs__item--active /
 *   mock-grid / mock / mock--pc / mock--phone / mock__label / mock__frame /
 *   mock__screen / preview-stage / preview-stage--pc / preview-stage--phone /
 *   preview-stage__inner / editor-canvas / editor-node / editor-node--selected /
 *   code-block / badge / badge--warn / badge--ok / badge--mute / note-box /
 *   warn-box / divider / btn / btn--primary / btn--secondary / btn--danger /
 *   btn--text / btn--block / btn--sm / icon-btn / empty / empty__text / banner /
 *   banner__text / banner__retry / toast / toast__text / toast--success /
 *   toast--danger / sheet / modal-root--sheet / skeleton / skeleton--title /
 *   skeleton--card / skeleton--row / loading-text / clamp-1 / clamp-2 / t-note / num
 * 触る id は index.html にあるものだけ:
 *   header-title / header-back / header-action / banner-root / toast-root / modal-root
 *
 * ログイン機能は未実装で、業務データは共有の Supabase に入る。
 * 生成結果は RLS により本人のプロジェクトの分だけ見える（旧: 全員共有だった）。
 */
(function (window, document) {
  'use strict';

  var App = window.App;
  if (!App || typeof App.registerScreen !== 'function') {
    console.error('[screens-generate] App.registerScreen(画面ID, { render: 関数 }) が見つかりません。index.html の読み込み順（app.js → screens-generate.js）を確認してください。S13・S14・S15 は描画されません。');
    return;
  }

  var Api = window.Api;
  if (!Api || !Api.generations || !Api.projects || !Api.users || !Api.storage) {
    console.error('[screens-generate] window.Api（api.js）が見つからないか、Api.generations / Api.projects / Api.users / Api.storage がありません。api.js が screens-generate.js より先に読み込まれているか確認してください。');
  }

  /* =========================================================
     1. 文言
     画面に出る文字（ボタン・検証・空状態・通知）はすべて辞書経由。
     i18n.js にあるキーは i18n.js を使い、無い言い回しだけ LOCAL に置く。
     ========================================================= */

  var LOCALES = ['ja', 'en', 'ko'];

  var LOCAL = {
    /* 共通 */
    'gen.noProject': ['プロジェクトが選択されていません', 'No project is selected', '선택된 프로젝트가 없습니다'],
    'gen.projectNotFound': ['このプロジェクトは見つかりませんでした。すでに削除された可能性があります', 'This project could not be found. It may have already been deleted.', '이 프로젝트를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다'],
    'gen.apiMissing': ['アプリの読み込みに失敗しました。ページを再読み込みしてください', 'The app failed to load. Please reload the page.', '앱을 불러오지 못했습니다. 페이지를 새로고침해 주세요'],
    'gen.untitled': ['名称未設定', 'Untitled', '이름 없음'],
    'gen.untitledSection': ['無題のセクション', 'Untitled section', '제목 없는 섹션'],
    'gen.saving': ['保存中…', 'Saving…', '저장 중…'],
    'gen.generating': ['{name}を生成しています…（1分ほどかかります）', 'Generating {name}… (takes about a minute)', '{name}을(를) 생성하고 있습니다… (약 1분 소요)'],
    'gen.generatingCount': [
      '{done} / {total} 件が完了',
      '{done} / {total} done',
      '{done} / {total}건 완료'
    ],
    'gen.runTitle': ['生成しています', 'Generating', '생성하고 있습니다'],
    'gen.runElapsed': ['経過 {t}', 'Elapsed {t}', '경과 {t}'],
    'gen.runQueued': ['順番待ち', 'Waiting', '대기 중'],
    'gen.runRunning': ['作成中', 'Working', '작성 중'],
    'gen.runDone': ['完了', 'Done', '완료'],
    'gen.runFailed': ['失敗', 'Failed', '실패'],
    'gen.runTimeout': ['まだ作成中', 'Still running', '아직 작성 중'],
    'gen.runSeeDone': [
      'できたものを見る（{n}件）',
      'See what is done ({n})',
      '완료된 것 보기({n}건)'
    ],
    'gen.runFresh': [
      '新しく{n}件できました。表示する',
      '{n} new — show them',
      '새로 {n}건 완료. 표시'
    ],
    'gen.runNote': [
      '1件あたり1〜3分かかります。この画面を離れても作成は続き、'
        + 'できたものから生成結果に出ます。',
      'Each item takes 1–3 minutes. You can leave this screen; '
        + 'items appear in the results as they finish.',
      '1건당 1~3분 걸립니다. 이 화면을 벗어나도 작성은 계속되며, '
        + '완료된 것부터 생성 결과에 표시됩니다.'
    ],
    'gen.generateDone': ['生成が完了しました', 'Generation completed', '생성이 완료되었습니다'],
    'gen.generateFailed': ['{name}の生成に失敗しました。ポイントは消費されていません', 'Failed to generate {name}. No points were consumed.', '{name} 생성에 실패했습니다. 포인트은 소비되지 않았습니다'],
    'gen.generateNotReady': ['{name}はまだ生成に対応していません。ポイントは消費されていません', '{name} is not supported yet. No points were consumed.', '{name}은(는) 아직 생성을 지원하지 않습니다. 포인트은 소비되지 않았습니다'],
    'gen.queuedLocal': ['{name}の生成を受け付けました。処理を待っています…', 'Queued {name}. Waiting for it to finish…', '{name} 생성을 접수했습니다. 처리를 기다리는 중…'],
    'gen.queuedTimeout': ['生成がまだ終わっていません。あとでこの画面を開き直すと反映されます', 'Generation is still running. Reopen this screen later to see the result.', '생성이 아직 끝나지 않았습니다. 나중에 이 화면을 다시 열면 반영됩니다'],
    'gen.charCount': ['{n}文字', '{n} characters', '{n}자'],
    'gen.charLimit': ['上限{max}文字', 'limit {max}', '최대 {max}자'],

    /* S13 タブ・プレビュー */
    'gen.tabKvAd': ['KV・メタ広告', 'KV & Meta ads', 'KV·메타 광고'],
    'gen.tabOther': ['その他', 'Other', '기타'],
    'gen.targetFilter': ['ターゲット層で絞る', 'Filter by audience', '타깃층으로 좁히기'],
    'gen.targetAll': ['すべて', 'All', '전체'],

    /* ---- 生成待ちの素材（画像は ChatGPT image2、動画は segmind で作る） ---- */
    'gen.assetTitle': ['生成待ちの素材', 'Assets still to be made', '생성 대기 중인 소재'],
    'gen.assetLead': [
      'LP・KV・広告バナーに入る画像と動画です。指示文はできていて、あとは実際に作って貼るだけの状態です。',
      'The images and videos that go inside the LPs, key visuals and ad banners. The instructions are written; they just need to be produced and pasted in.',
      'LP·KV·광고 배너에 들어가는 이미지와 동영상입니다. 지시문은 완성되어 있고, 실제로 만들어 붙이기만 하면 됩니다.'
    ],
    'gen.assetImage': ['画像', 'Image', '이미지'],
    'gen.assetVideo': ['動画', 'Video', '동영상'],
    'gen.assetProviderImage': ['ChatGPT image2', 'ChatGPT image2', 'ChatGPT image2'],
    'gen.assetProviderVideo': ['segmind', 'segmind', 'segmind'],
    'gen.assetWaiting': ['未生成', 'Not made yet', '미생성'],
    'gen.assetDone': ['生成済み', 'Made', '생성 완료'],
    'gen.assetCopy': ['指示文をコピー', 'Copy the instruction', '지시문 복사'],
    'gen.assetCopied': ['コピーしました', 'Copied', '복사했습니다'],
    'gen.assetCopyFailed': ['コピーできませんでした。指示文を選んで手でコピーしてください。', 'Could not copy. Select the text and copy it by hand.', '복사하지 못했습니다. 지시문을 선택해 직접 복사해 주세요.'],
    'gen.assetPaste': ['できた素材のURLを貼る', 'Paste the URL of the finished asset', '완성된 소재의 URL 붙여넣기'],
    'gen.assetSave': ['貼る', 'Attach', '붙이기'],
    'gen.assetSaved': ['素材を登録しました', 'The asset was attached', '소재를 등록했습니다'],
    'gen.assetSaveFailed': ['素材の登録に失敗しました。', 'Attaching the asset failed.', '소재 등록에 실패했습니다.'],
    'gen.assetBadUrl': ['http から始まるURLを入れてください。', 'Enter a URL starting with http.', 'http로 시작하는 URL을 입력해 주세요.'],
    'gen.assetCount': ['未生成 {n}件 / 全{m}件', '{n} of {m} still to make', '미생성 {n}건 / 전체 {m}건'],
    'gen.assetEmpty': [
      '生成待ちの素材はありません。',
      'There is nothing waiting to be made.',
      '생성 대기 중인 소재가 없습니다.'
    ],
    'gen.assetRenderAll': ['未生成の素材をまとめて生成', 'Produce every missing asset', '미생성 소재를 한 번에 생성'],
    'gen.assetRendering': ['素材を生成しています', 'Producing the assets', '소재를 생성하는 중입니다'],
    'gen.assetRenderQueued': [
      '{n}件の素材を生成に出しました。できあがると、この一覧が埋まります。',
      '{n} assets were sent for production. This list fills in as they arrive.',
      '{n}건의 소재를 생성에 보냈습니다. 완성되면 이 목록이 채워집니다.'
    ],
    'gen.assetRenderFailed': ['素材の生成に出せませんでした。', 'The assets could not be sent for production.', '소재를 생성에 보내지 못했습니다.'],
    'gen.assetNeedShots': [
      '先に商品入力ページで、商品が写っている写真に★を付けてください。見本が無いと、AIが商品の見た目を作り変えてしまいます。',
      'Star the photos that actually show the product on the product input page first. Without a reference the AI invents its own version of the product.',
      '먼저 상품 입력 페이지에서 상품이 찍힌 사진에 ★를 표시해 주세요. 견본이 없으면 AI가 상품의 겉모습을 마음대로 만들어 버립니다.'
    ],
    'gen.assetShots': ['見本にする商品写真 {n}枚', '{n} product shots used as the reference', '견본으로 사용할 상품 사진 {n}장'],
    'gen.assetCutouts': [
      'うち背景を抜いた切り抜き {n}枚を見本に使います',
      '{n} of them are background-free cutouts and are used as the reference',
      '그중 배경을 제거한 컷아웃 {n}장을 견본으로 사용합니다'
    ],
    'gen.assetCutoutFirst': [
      '背景を抜いた切り抜きはまだありません。生成の最初に切り抜きを作ってから、それを見本にします。',
      'There are no background-free cutouts yet. They are made first, then used as the reference.',
      '배경을 제거한 컷아웃이 아직 없습니다. 생성 시작 시 컷아웃을 먼저 만들어 견본으로 사용합니다.'
    ],
    'gen.assetToInput': ['商品入力へ', 'Go to product input', '상품 입력으로'],
    'gen.previewScroll': [
      '画面の上にカーソルを置いてスクロールすると、ページの下まで見られます。',
      'Put the pointer over the screen and scroll to see further down the page.',
      '화면 위에 커서를 두고 스크롤하면 페이지 아래까지 볼 수 있습니다.'
    ],
    'gen.assetOpen': ['原寸で開く', 'Open full size', '원본 크기로 열기'],
    'gen.assetShowPrompt': ['指示文を見る（管理者）', 'Show the instruction (admin)', '지시문 보기(관리자)'],
    'gen.assetRedo': ['作り直す', 'Make it again', '다시 만들기'],
    'gen.assetRedoing': ['作り直しています', 'Making it again', '다시 만드는 중입니다'],
    'gen.assetMaking': ['生成中', 'Making', '생성 중'],
    'gen.assetProgress': ['素材を生成中 {done}/{total}', 'Making assets {done}/{total}', '소재 생성 중 {done}/{total}'],
    'gen.assetSomeFailed': ['{n}件は生成に出せませんでした。', '{n} could not be sent for production.', '{n}건은 생성에 보내지 못했습니다.'],
    'gen.assetRedoQueued': [
      '作り直しに出しました。できあがると差し替わります。',
      'Sent to be made again. It swaps in when it arrives.',
      '다시 만들기에 보냈습니다. 완성되면 교체됩니다.'
    ],
    'gen.assetApiNote': [
      '画像・動画のAPIはまだ接続していません。いまは指示文をコピーして ChatGPT と segmind で作り、できたURLをここに貼ります。キーを入れたら、この欄は自動で埋まります。',
      'The image and video APIs are not connected yet. For now, copy the instruction, make the asset in ChatGPT or segmind, and paste the URL here. Once the keys are in, this fills itself.',
      '이미지·동영상 API는 아직 연결하지 않았습니다. 지금은 지시문을 복사해 ChatGPT와 segmind에서 만들고, 완성된 URL을 여기에 붙입니다. 키를 넣으면 이 칸은 자동으로 채워집니다.'
    ],
    'gen.previewOf': ['プレビュー中：{name}', 'Previewing: {name}', '미리보기 중: {name}'],
    'gen.pcSize': ['1440px', '1440px', '1440px'],
    'gen.phoneSize': ['390px', '390px', '390px'],
    'gen.previewNone': ['プレビューできるLPがまだありません', 'There is no LP to preview yet', '아직 미리 볼 LP가 없습니다'],
    'gen.previewNoteInApp': ['生成した画像を含む実際の表示です。書き出したHTML・公開URLでも同じものが表示されます', 'This preview shows the real page including generated images. Exported HTML and the public URL render the same.', '생성한 이미지를 포함한 실제 표시입니다. 내보낸 HTML과 공개 URL에서도 동일하게 표시됩니다'],
    'gen.sectionsTitle': ['セクション構成', 'Section structure', '섹션 구성'],
    'gen.copyAll': ['すべてコピー', 'Copy all', '전체 복사'],
    'gen.downloadSvg': ['SVGダウンロード', 'Download SVG', 'SVG 다운로드'],
    'gen.downloadPng': ['PNGダウンロード', 'Download PNG', 'PNG 다운로드'],
    'gen.downloadTxt': ['テキストダウンロード', 'Download text', '텍스트 다운로드'],
    'gen.downloadFailed': ['ダウンロードに失敗しました', 'The download failed', '다운로드에 실패했습니다'],
    'gen.pngUnsupported': ['この端末ではPNGを書き出せませんでした。SVGをダウンロードしてください', 'PNG export is not available on this device. Please download the SVG instead.', '이 기기에서는 PNG를 내보낼 수 없습니다. SVG를 다운로드해 주세요'],
    'gen.downloaded': ['ダウンロードを開始しました', 'The download has started', '다운로드를 시작했습니다'],
    'gen.publish': ['公開する（A/Bテスト用URL）', 'Publish (A/B test URL)', '공개하기(A/B 테스트 URL)'],
    'gen.publishUpdate': ['公開中のHTMLを更新', 'Update the published HTML', '공개 중인 HTML 업데이트'],
    'gen.unpublish': ['公開停止', 'Unpublish', '공개 중지'],
    'gen.published': ['公開中', 'Published', '공개 중'],
    'gen.publishDone': ['公開しました。URLをコピーして配布できます', 'Published. Copy the URL to share it.', '공개했습니다. URL을 복사해 배포할 수 있습니다'],
    'gen.unpublishDone': ['公開を停止しました', 'Unpublished', '공개를 중지했습니다'],
    'gen.publishFailed': ['公開に失敗しました', 'Publishing failed', '공개에 실패했습니다'],
    'gen.publicUrl': ['公開URL', 'Public URL', '공개 URL'],
    'gen.copyUrl': ['URLをコピー', 'Copy URL', 'URL 복사'],
    'gen.openUrl': ['開く', 'Open', '열기'],
    'gen.metricViews': ['表示', 'Views', '노출'],
    'gen.metricCta': ['CTAクリック', 'CTA clicks', 'CTA 클릭'],
    'gen.metricLine': ['LINE追加', 'LINE adds', 'LINE 추가'],
    'gen.abHint': ['A/B両案を公開して、表示数・CTAクリック・LINE追加を並べて比較できます', 'Publish both A and B to compare views, CTA clicks and LINE adds side by side.', 'A/B 두 안을 공개해 노출·CTA 클릭·LINE 추가를 나란히 비교할 수 있습니다'],
    'gen.cfImageNote': ['クラファンLPは画像入稿のため、全体のSVGとPNGで書き出します', 'Crowdfunding pages are submitted as images, so they export as SVG and PNG.', '크라우드펀딩 LP는 이미지 입고용이라 SVG와 PNG로 내보냅니다'],

    /* S13 LINE友だち追加ボタン */
    'gen.lineUrlPlaceholder': ['https://lin.ee/xxxxxxx', 'https://lin.ee/xxxxxxx', 'https://lin.ee/xxxxxxx'],
    'gen.lineUrlHint': ['友だち追加リンク、または友だち追加ボタンのHTMLコードを貼り付けてください。コードのときはリンク先だけを使い、ボタンは推奨デザインで書き出します', 'Paste the friend-add link or the button HTML. If HTML is pasted, only the link is used and the button is exported with the recommended design.', '친구 추가 링크 또는 버튼 HTML 코드를 붙여넣어 주세요. 코드일 때는 링크만 사용하고 버튼은 추천 디자인으로 내보냅니다'],
    'gen.lineUrlInvalid': ['https:// で始まるURL、または href を含むHTMLコードを入力してください', 'Enter a URL starting with https:// or HTML that contains an href.', 'https:// 로 시작하는 URL 또는 href가 포함된 HTML 코드를 입력해 주세요'],
    'gen.lineUrlSaved': ['LINE友だち追加ボタンを保存しました', 'The LINE friend-add button was saved', 'LINE 친구 추가 버튼을 저장했습니다'],
    'gen.lineUrlEmpty': ['URLが未設定のため、書き出したHTMLに友だち追加ボタンは入りません', 'No URL is set, so the exported HTML has no friend-add button.', 'URL이 없으므로 내보낸 HTML에는 친구 추가 버튼이 들어가지 않습니다'],
    'gen.lineSaveFailed': ['LINE設定の保存に失敗しました', 'Failed to save the LINE settings', 'LINE 설정 저장에 실패했습니다'],
    'gen.linePositionHint': ['推奨位置をタップして選びます', 'Tap a recommended position to choose it', '추천 위치를 눌러 선택합니다'],
    'gen.linePositionAfter': ['{name} の直後', 'Right after {name}', '{name} 바로 뒤'],
    'gen.lineStyleGreen': ['標準グリーン', 'Standard green', '기본 그린'],
    'gen.lineStyleOutline': ['白地・グリーン枠', 'White with green border', '흰 배경·그린 테두리'],
    'gen.lineStyleLarge': ['大きめ（幅いっぱい）', 'Large (full width)', '크게(전체 너비)'],
    'gen.lineButtonLabel': ['友だち追加', 'Add friend', '친구 추가'],
    'gen.lineButtonPreview': ['ボタンの表示イメージ', 'How the button looks', '버튼 표시 이미지'],
    'gen.lineSaveButton': ['ボタン設定を保存', 'Save button settings', '버튼 설정 저장'],

    /* S13 KV・メタ広告・LINEコンテンツ */
    'gen.kvConcept': ['クリエイティブ案', 'Creative concept', '크리에이티브 안'],
    'gen.composition': ['構図', 'Composition', '구도'],
    'gen.appealPoints': ['訴求要素', 'Selling points', '소구 요소'],
    'gen.recommendedSize': ['推奨サイズ', 'Recommended size', '권장 사이즈'],
    'gen.appealAxis': ['訴求軸', 'Differentiating angle', '소구 축'],
    'gen.headline': ['見出し', 'Headline', '헤드라인'],
    'gen.bodyText': ['本文', 'Body', '본문'],
    'gen.ctaText': ['CTA文言', 'CTA text', 'CTA 문구'],
    'gen.imageConcept': ['画像構成案', 'Image concept', '이미지 구성안'],
    'gen.richMenuLayout': ['分割レイアウト', 'Split layout', '분할 레이아웃'],
    'gen.cellLabel': ['枠{n}', 'Cell {n}', '{n}번 칸'],
    'gen.overLimitBadge': ['超過', 'Over', '초과'],
    'gen.emptyKind': ['{name}はまだ生成されていません', '{name} has not been generated yet', '{name}은(는) 아직 생성되지 않았습니다'],
    'gen.generateThis': ['この内容を生成する', 'Generate this', '이 항목 생성하기'],
    'gen.unknownType': ['種別が判定できない生成物です（content_type: {type}）', 'This item has an unrecognized content_type: {type}', '종류를 알 수 없는 생성물입니다(content_type: {type})'],
    'gen.variant': ['{label}案', 'Variant {label}', '{label}안'],

    /* 既定セクション（生成物にセクションが入っていないときだけ使う下書き） */
    'gen.sec.hero': ['ファーストビュー', 'Hero', '퍼스트 뷰'],
    'gen.sec.problem': ['課題提起', 'The problem', '문제 제기'],
    'gen.sec.solution': ['解決策', 'The solution', '해결책'],
    'gen.sec.features': ['商品の特徴', 'Product features', '상품 특징'],
    'gen.sec.proof': ['実績・レビュー', 'Proof and reviews', '실적·리뷰'],
    'gen.sec.price': ['価格・リターン', 'Price and rewards', '가격·리워드'],
    'gen.sec.cta': ['CTA', 'CTA', 'CTA'],
    'gen.sec.heroBody': ['{name}で、毎日の悩みをまるごと軽くする。', 'Make everyday problems lighter with {name}.', '{name}로 매일의 고민을 가볍게.'],
    'gen.sec.problemBody': ['{target}が抱えがちな悩みを、具体的な場面から書き出します。', 'Describe the problems {target} run into, scene by scene.', '{target}가 겪는 고민을 구체적인 장면으로 적습니다.'],
    'gen.sec.solutionBody': ['{name}がその悩みをどう解決するのかを、1文で言い切ります。', 'State in one sentence how {name} solves it.', '{name}가 그 고민을 어떻게 해결하는지 한 문장으로 말합니다.'],
    'gen.sec.priceBody': ['価格 {price}。早期割引や数量限定の見せ方をここに置きます。', 'Price {price}. Show early-bird or limited-quantity offers here.', '가격 {price}. 얼리버드나 한정 수량 안내를 여기에 둡니다.'],
    'gen.sec.ctaBody': ['いま応援する／購入するボタンを、迷わない言葉で置きます。', 'Place the support or buy button with unambiguous wording.', '지금 응원하기·구매하기 버튼을 분명한 말로 둡니다.'],
    'gen.sec.defaultBody': ['ここに本文が入ります。デザイン編集から書き換えられます。', 'Body copy goes here. You can rewrite it in the design editor.', '여기에 본문이 들어갑니다. 디자인 편집에서 수정할 수 있습니다.'],
    'gen.ctaButton': ['詳しく見る', 'Learn more', '자세히 보기'],

    /* S14 デザイン編集 */
    'gen.canvasTitle': ['編集キャンバス', 'Canvas', '편집 캔버스'],
    'gen.canvasHint': ['レイヤーをタップすると選択できます', 'Tap a layer to select it', '레이어를 누르면 선택됩니다'],
    'gen.selectLayerFirst': ['レイヤーを選ぶと、ここで文字と色を編集できます', 'Select a layer to edit its text and colors here', '레이어를 선택하면 여기에서 글자와 색을 편집할 수 있습니다'],
    'gen.headingLabel': ['見出し', 'Heading', '제목'],
    'gen.bodyLabel': ['本文', 'Body text', '본문'],
    'gen.headingColor': ['見出しの色', 'Heading color', '제목 색'],
    'gen.bodyColor': ['本文の色', 'Body color', '본문 색'],
    'gen.bgColor': ['背景色', 'Background color', '배경색'],
    'gen.headingFont': ['見出しフォント', 'Heading font', '제목 폰트'],
    'gen.bodyFont': ['本文フォント', 'Body font', '본문 폰트'],
    'gen.headingSize': ['見出しサイズ', 'Heading size', '제목 크기'],
    'gen.bodySize': ['本文サイズ', 'Body size', '본문 크기'],
    'gen.fontSans': ['ゴシック（標準）', 'Sans (default)', '고딕(기본)'],
    'gen.fontGothic': ['ゴシック（太め）', 'Sans (bold face)', '고딕(굵게)'],
    'gen.fontMincho': ['明朝', 'Serif', '명조'],
    'gen.addLayerTitle': ['追加するレイヤー', 'Layer to add', '추가할 레이어'],
    'gen.layerText': ['テキスト', 'Text', '텍스트'],
    'gen.layerImage': ['画像', 'Image', '이미지'],
    'gen.layerDivider': ['区切り線', 'Divider', '구분선'],
    'gen.newLayerName': ['新しいセクション', 'New section', '새 섹션'],
    'gen.imageUrl': ['画像URL', 'Image URL', '이미지 URL'],
    'gen.imageUrlHint': ['https:// で始まる画像URLを入れると、書き出したHTMLに画像として入ります', 'A URL starting with https:// is embedded as an image in the exported HTML', 'https:// 로 시작하는 URL을 넣으면 내보낸 HTML에 이미지로 들어갑니다'],
    'gen.imagePlaceholder': ['画像（アプリ内では読み込みません）', 'Image (not loaded inside the app)', '이미지(앱 안에서는 불러오지 않습니다)'],
    'gen.moveUp': ['上へ', 'Move up', '위로'],
    'gen.moveDown': ['下へ', 'Move down', '아래로'],
    'gen.deleteLayer': ['レイヤーを削除', 'Delete layer', '레이어 삭제'],
    'gen.deleteLayerBody': ['「{name}」を削除します。元に戻せません', '“{name}” will be deleted. This cannot be undone.', '“{name}”을(를) 삭제합니다. 되돌릴 수 없습니다'],
    'gen.lastLayer': ['最後のレイヤーは削除できません', 'The last layer cannot be deleted', '마지막 레이어는 삭제할 수 없습니다'],
    'gen.layerAdded': ['レイヤーを追加しました', 'Layer added', '레이어를 추가했습니다'],
    'gen.layerDeleted': ['レイヤーを削除しました', 'Layer deleted', '레이어를 삭제했습니다'],
    'gen.unsaved': ['未保存の変更があります', 'You have unsaved changes', '저장하지 않은 변경 사항이 있습니다'],
    'gen.autoSavedAgo': ['自動保存 {time}', 'Auto-saved {time}', '자동 저장 {time}'],
    'gen.justNow': ['たった今', 'just now', '방금 전'],
    'gen.secondsAgo': ['{n}秒前', '{n} seconds ago', '{n}초 전'],
    'gen.minutesAgo': ['{n}分前', '{n} minutes ago', '{n}분 전'],
    'gen.notSavedYet': ['まだ保存していません', 'Not saved yet', '아직 저장하지 않았습니다'],
    'gen.editTargetMissing': ['編集できる生成物がありません。先にLPを生成してください', 'There is nothing to edit yet. Generate an LP first.', '편집할 생성물이 없습니다. 먼저 LP를 생성해 주세요'],

    /* S15 実寸プレビュー */
    'gen.devicePc': ['PC 1440px', 'PC 1440px', 'PC 1440px'],
    'gen.devicePhone': ['スマホ 375px', 'Mobile 375px', '모바일 375px'],
    'gen.previewScrollHint': ['横にスクロールすると実寸のまま全体を確認できます', 'Scroll sideways to see the full width at real size', '가로로 스크롤하면 실제 크기 그대로 전체를 볼 수 있습니다'],
    'gen.showingSection': ['表示中：{name}', 'Now showing: {name}', '표시 중: {name}'],
    'gen.noSections': ['セクションがありません', 'There are no sections', '섹션이 없습니다'],
    'gen.jumpFailed': ['プレビューの位置を移動できませんでした', 'Could not scroll the preview', '미리보기 위치를 이동하지 못했습니다']
  };

  var LINE_LIMITS = { rich_menu: 30, rich_message: 400, greeting: 500, message: 500 };

  function currentLocale() {
    var I18N = window.I18N;
    if (I18N && typeof I18N.getLocale === 'function') {
      var code = I18N.getLocale();
      if (LOCALES.indexOf(code) !== -1) { return code; }
    }
    return 'ja';
  }

  function fill(text, params) {
    if (!params) { return text; }
    var out = String(text);
    Object.keys(params).forEach(function (key) {
      out = out.split('{' + key + '}').join(String(params[key]));
    });
    return out;
  }

  var i18nMissingReported = false;

  function t(key, params) {
    if (key.indexOf('gen.') === 0) {
      var row = LOCAL[key];
      if (!row) {
        console.error('[screens-generate] このファイルの文言表に ' + key + ' がありません。キーをそのまま表示します。');
        return key;
      }
      var index = LOCALES.indexOf(currentLocale());
      return fill(row[index === -1 ? 0 : index] || row[0], params);
    }
    if (typeof window.t === 'function') { return window.t(key, params); }
    if (!i18nMissingReported) {
      i18nMissingReported = true;
      console.error('[screens-generate] window.t（i18n.js）が見つかりません。index.html で i18n.js が読み込まれているか確認してください。翻訳キーがそのまま表示されます。');
    }
    return key;
  }

  /* =========================================================
     2. 小さな道具
     ========================================================= */

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  function clear(node) {
    if (!node) { return node; }
    while (node.firstChild) { node.removeChild(node.firstChild); }
    return node;
  }

  function button(cls, label, onClick) {
    var node = document.createElement('button');
    node.type = 'button';
    node.className = cls;
    if (label) { node.textContent = label; }
    if (typeof onClick === 'function') { node.addEventListener('click', onClick); }
    return node;
  }

  function formatNumber(value) {
    if (typeof App.formatNumber === 'function') { return App.formatNumber(value); }
    var n = Number(value) || 0;
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function toast(message, kind) {
    if (typeof App.toast === 'function') { App.toast(message, kind); return; }
    var root = document.getElementById('toast-root');
    if (!root) {
      console.error('[screens-generate] #toast-root が無いため通知を表示できません: ' + message);
      return;
    }
    var extra = '';
    if (kind === 'success') { extra = ' toast--success'; }
    if (kind === 'danger') { extra = ' toast--danger'; }
    var box = el('div', 'toast' + extra);
    box.appendChild(el('span', 'toast__text', message));
    root.appendChild(box);
    window.setTimeout(function () {
      if (box.parentNode) { box.parentNode.removeChild(box); }
    }, 3600);
  }

  function clearBanner() {
    var root = document.getElementById('banner-root');
    if (root) { clear(root); }
  }

  function showBanner(message, onRetry) {
    var root = document.getElementById('banner-root');
    if (!root) {
      console.error('[screens-generate] #banner-root が無いため通信失敗を表示できません: ' + message);
      return;
    }
    clear(root);
    var banner = el('div', 'banner');
    banner.setAttribute('role', 'alert');
    banner.appendChild(el('span', 'banner__text', message));
    if (typeof onRetry === 'function') {
      banner.appendChild(button('banner__retry', t('common.retry'), function () {
        clearBanner();
        onRetry();
      }));
    }
    root.appendChild(banner);
  }

  function errorMessage(err, fallbackKey) {
    if (err && typeof err.message === 'string' && err.message) { return err.message; }
    return t(fallbackKey || 'common.networkError');
  }

  function showSkeleton(root) {
    clear(root);
    var screen = el('div', 'screen');
    screen.appendChild(el('div', 'skeleton skeleton--title'));
    screen.appendChild(el('div', 'skeleton skeleton--card'));
    screen.appendChild(el('div', 'skeleton skeleton--row'));
    screen.appendChild(el('div', 'skeleton skeleton--row'));
    screen.appendChild(el('p', 'loading-text', t('common.loading')));
    root.appendChild(screen);
  }

  function showErrorScreen(root, message, onRetry, extraButton) {
    clear(root);
    var screen = el('div', 'screen');
    var banner = el('div', 'banner');
    banner.setAttribute('role', 'alert');
    banner.appendChild(el('span', 'banner__text', message));
    if (typeof onRetry === 'function') {
      banner.appendChild(button('banner__retry', t('common.retry'), onRetry));
    }
    screen.appendChild(banner);
    if (extraButton) { screen.appendChild(extraButton); }
    root.appendChild(screen);
  }

  function closeSheet() {
    var root = document.getElementById('modal-root');
    if (!root) { return; }
    clear(root);
    root.hidden = true;
    root.className = 'modal-root';
    root.onclick = null;
  }

  /* 下から出る選択シート（レイヤー追加メニュー） */
  function openSheet(title, items) {
    var root = document.getElementById('modal-root');
    if (!root) {
      console.error('[screens-generate] #modal-root がありません。シートを表示できません。');
      return;
    }
    clear(root);
    root.hidden = false;
    root.className = 'modal-root modal-root--sheet';
    root.onclick = function (event) {
      if (event.target === root) { closeSheet(); }
    };

    var sheet = el('div', 'sheet');
    sheet.appendChild(el('div', 'list__head', title));
    var list = el('div', 'list');
    items.forEach(function (item) {
      var row = button('list-row', '', function () {
        closeSheet();
        item.onSelect();
      });
      var body = el('div', 'list-row__body');
      body.appendChild(el('span', 'list-row__title', item.label));
      if (item.note) { body.appendChild(el('span', 'list-row__sub', item.note)); }
      row.appendChild(body);
      list.appendChild(row);
    });
    sheet.appendChild(list);
    sheet.appendChild(button('btn btn--secondary btn--block', t('common.cancel'), closeSheet));
    root.appendChild(sheet);
  }

  function confirmDialog(options) {
    if (typeof App.confirm === 'function') {
      App.confirm({
        title: options.title,
        body: options.body,
        confirmLabel: options.confirmLabel,
        cancelLabel: t('common.cancel'),
        danger: !!options.danger,
        onConfirm: options.onConfirm
      });
      return;
    }
    console.error('[screens-generate] App.confirm がありません。window.confirm で代用します。');
    if (window.confirm(options.title)) { options.onConfirm(); }
  }

  /* ---------- コピーとダウンロード（失敗は必ず知らせる） ---------- */
  function copyText(text) {
    function fallback() {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        console.error('[screens-generate] クリップボードへのコピーに失敗しました', e);
        ok = false;
      }
      document.body.removeChild(area);
      toast(ok ? t('common.copied') : t('common.copyFailed'), ok ? 'success' : 'danger');
    }

    if (window.navigator && window.navigator.clipboard && typeof window.navigator.clipboard.writeText === 'function') {
      window.navigator.clipboard.writeText(text).then(function () {
        toast(t('common.copied'), 'success');
      }, function (err) {
        console.error('[screens-generate] navigator.clipboard.writeText に失敗したため execCommand で再試行します', err);
        fallback();
      });
      return;
    }
    fallback();
  }

  function downloadBlob(blob, filename) {
    try {
      var url = window.URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 4000);
      toast(t('gen.downloaded'), 'success');
      return true;
    } catch (e) {
      console.error('[screens-generate] ファイルの書き出しに失敗しました: ' + filename, e);
      toast(t('gen.downloadFailed'), 'danger');
      return false;
    }
  }

  function downloadText(text, filename, mime) {
    return downloadBlob(new window.Blob([text], { type: mime || 'text/plain;charset=utf-8' }), filename);
  }

  function safeFileName(name) {
    var base = String(name || 'elpiya').replace(/[\\/:*?"<>|\s]+/g, '_');
    return base.slice(0, 40) || 'elpiya';
  }

  /* ---------- 遷移（経路の綴りは index.html のとおり） ---------- */
  function hashFor(screenId, params) {
    var hash = '#/' + screenId;
    if (params) {
      var parts = [];
      Object.keys(params).forEach(function (key) {
        var value = params[key];
        if (value === undefined || value === null || value === '') { return; }
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
      });
      if (parts.length) { hash += '?' + parts.join('&'); }
    }
    return hash;
  }

  function go(screenId, params) {
    var next = hashFor(screenId, params);
    if (window.location.hash === next) { return; }
    window.location.hash = next;
  }

  function currentScreenId() {
    var hash = String(window.location.hash || '');
    if (hash.indexOf('#/') !== 0) { return ''; }
    var rest = hash.slice(2);
    var q = rest.indexOf('?');
    return q === -1 ? rest : rest.slice(0, q);
  }

  function setHeader(title, showBack) {
    var titleNode = document.getElementById('header-title');
    var backNode = document.getElementById('header-back');
    var actionNode = document.getElementById('header-action');
    if (titleNode) { titleNode.textContent = title; }
    else { console.error('[screens-generate] index.html に #header-title がありません。'); }
    if (backNode) { backNode.hidden = !showBack; }
    else { console.error('[screens-generate] index.html に #header-back がありません。'); }
    if (actionNode) { clear(actionNode); }
  }

  /* ---------- 現在のユーザー・プロジェクト・生成物 ---------- */
  function currentUserId() {
    if (typeof App.getUser === 'function') {
      var user = App.getUser();
      if (user && user.id) { return String(user.id); }
    }
    if (Api && Api.storage) { return Api.storage.get('userId'); }
    console.error('[screens-generate] 現在のユーザーIDを取得できません（App.getUser も Api.storage もありません）。');
    return null;
  }

  function loadUser() {
    var id = currentUserId();
    if (!id || !Api || !Api.users) { return Promise.resolve(null); }
    return Api.users.get(id).then(function (user) {
      if (typeof App.setUser === 'function') { App.setUser(user, { silent: true }); }
      return user;
    }, function (err) {
      console.error('[screens-generate] 残高表示のためのユーザー取得に失敗しました', err);
      return null;
    });
  }

  function resolveProjectId(params) {
    var fromParams = params && params.id ? String(params.id) : '';
    if (fromParams) {
      if (Api && Api.storage) { Api.storage.set('projectId', fromParams); }
      return fromParams;
    }
    if (Api && Api.storage) {
      var saved = Api.storage.get('projectId');
      if (saved) { return String(saved); }
    }
    return '';
  }

  function rememberGeneration(id) {
    if (Api && Api.storage && id) { Api.storage.set('generationId', String(id)); }
  }

  /* =========================================================
     3. 生成物の読み取り（保存されている形の揺れを吸収する）
     ========================================================= */

  var TYPE = {
    CF: 'crowdfunding_lp',
    OWN: 'own_lp',
    KV: 'kv',
    AD: 'meta_ad',
    LINE: 'line'
  };

  var unknownTypeReported = {};

  function normalizeType(raw) {
    var v = String(raw === undefined || raw === null ? '' : raw).toLowerCase();
    if (!v) { return ''; }
    if (v.indexOf('crowd') !== -1 || v.indexOf('makuake') !== -1 || v.indexOf('クラファン') !== -1) { return TYPE.CF; }
    if (v.indexOf('own') !== -1 || v.indexOf('company') !== -1 || v.indexOf('self') !== -1 || v.indexOf('brand') !== -1 || v.indexOf('自社') !== -1) { return TYPE.OWN; }
    if (v.indexOf('line') !== -1) { return TYPE.LINE; }
    if (v.indexOf('kv') !== -1 || v.indexOf('visual') !== -1) { return TYPE.KV; }
    if (v.indexOf('ad') !== -1 || v.indexOf('meta') !== -1 || v.indexOf('広告') !== -1) { return TYPE.AD; }
    if (v.indexOf('lp') !== -1) { return TYPE.OWN; }
    if (!unknownTypeReported[v]) {
      unknownTypeReported[v] = true;
      console.warn('[screens-generate] content_type「' + raw + '」の種別を判定できませんでした。「その他」タブに出します。');
    }
    return '';
  }

  /* ---- 生成待ちの素材 ----
     生成物1行が持つ asset_prompts（画像はChatGPT image2、動画はsegmind向けの
     指示文）と、実際にできたURL（image_urls / video_urls）を突き合わせる。
     URLがまだ入っていないものが「生成待ち」。
     APIキーを入れたら Edge Function が同じ列を埋めるので、この画面は変えずに済む。 */
  function assetRowsOf(generation) {
    var prompts = generation.asset_prompts;
    if (typeof prompts === 'string') {
      try { prompts = JSON.parse(prompts); } catch (e) { prompts = null; }
    }
    if (!prompts || typeof prompts !== 'object') { return []; }

    var out = [];
    [['images', 'image_urls', 'image'], ['videos', 'video_urls', 'video']].forEach(function (spec) {
      var list = asArray(prompts[spec[0]]);
      var made = asArray(generation[spec[1]]);
      list.forEach(function (one, index) {
        var url = made[index];
        /* できたものが {slot, url} で入っている場合は slot で合わせる */
        if (url && typeof url === 'object') { url = url.url; }
        if (!url) {
          made.forEach(function (m) {
            if (m && typeof m === 'object' && m.slot && m.slot === one.slot) { url = m.url; }
          });
        }
        out.push({
          generation: generation,
          column: spec[1],
          index: index,
          kind: spec[2],
          slot: String(one.slot || (index + 1)),
          prompt: String(one.prompt || ''),
          url: String(url || '')
        });
      });
    });
    return out;
  }

  /* LP本文に空けてある差し込み口を、貼られた素材のURLで埋める。
     指示文の並び順に {image_1} {image_2} … {video_1} … が対応する。
     まだ貼っていない口は、そのままでは生の波括弧が見えてしまうので、
     灰色の待ち枠（data URI の1x1）に置き換える。 */
  var PENDING_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAOXh7wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

  function fillAssetSlots(generation, html) {
    var out = String(html);
    assetRowsOf(generation).forEach(function (one) {
      var token = '{' + (one.kind === 'image' ? 'image_' : 'video_') + (one.index + 1) + '}';
      var value = one.url || PENDING_PIXEL;
      out = out.split(token).join(value);
      /* 指示文の見出しをそのまま口にしている書き方も拾う */
      if (one.slot) { out = out.split('{' + one.slot + '}').join(value); }
    });
    /* 動画の口は <img> のままでは再生されない。URLが動画なら <video> に置き換える。
       音は付けない（LPの中で勝手に鳴らさないため） */
    return out.replace(/<img\b[^>]*\bsrc="([^"]+\.(?:mp4|webm))"[^>]*>/gi,
      function (whole, url) {
        var alt = /alt="([^"]*)"/i.exec(whole);
        return '<video src="' + url + '" muted playsinline loop autoplay controls'
          + (alt ? ' aria-label="' + alt[1] + '"' : '')
          + ' style="display:block;width:100%;height:auto"></video>';
      });
  }

  function isLp(type) { return type === TYPE.CF || type === TYPE.OWN; }

  function typeLabel(type) {
    if (type === TYPE.CF) { return t('generate.crowdfundingLp'); }
    if (type === TYPE.OWN) { return t('generate.ownLp'); }
    if (type === TYPE.KV) { return t('generate.kv'); }
    if (type === TYPE.AD) { return t('generate.metaAd'); }
    if (type === TYPE.LINE) { return t('generate.lineContent'); }
    return t('gen.tabOther');
  }

  function asObject(value) {
    if (!value) { return {}; }
    if (typeof value === 'object' && !Array.isArray(value)) { return value; }
    if (typeof value === 'string') {
      try {
        var parsed = JSON.parse(value);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
      } catch (e) {
        console.warn('[screens-generate] JSON列を読めませんでした。空として扱います。', value);
        return {};
      }
    }
    return {};
  }

  function asArray(value) {
    if (!value) { return []; }
    if (Array.isArray(value)) { return value; }
    if (typeof value === 'string') {
      try {
        var parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.warn('[screens-generate] JSON配列を読めませんでした。空として扱います。', value);
        return [];
      }
    }
    if (typeof value === 'object' && Array.isArray(value.sections)) { return value.sections; }
    return [];
  }

  function normalizeSections(raw) {
    return asArray(raw).map(function (item, i) {
      if (typeof item === 'string') {
        return { key: 'sec' + (i + 1), title: item, body: '', type: 'text', image: '', titleColor: '', bodyColor: '', bg: '' };
      }
      var o = item || {};
      return {
        key: String(o.key || o.id || ('sec' + (i + 1))),
        title: String(o.title || o.name || o.heading || ''),
        body: String(o.body || o.text || o.copy || o.description || ''),
        type: String(o.type || ((o.image || o.image_url) ? 'image' : 'text')),
        image: String(o.image || o.image_url || ''),
        titleColor: String(o.titleColor || ''),
        bodyColor: String(o.bodyColor || ''),
        bg: String(o.bg || ''),
        /* 区画ごとの素材の指示。ここで捨てると、LPから絵が消える */
        media: asArray(o.media)
      };
    });
  }

  function priceText(project) {
    var price = Number(project && project.price);
    if (!price) { return '—'; }
    return '¥' + formatNumber(price);
  }

  /* 生成物にセクションが入っていないときの下書き構成（画面が空のまま壊れて見えないようにする） */
  function defaultSections(project) {
    var name = (project && (project.product_name || project.project_name)) || t('gen.untitled');
    var target = (project && project.target_audience) || t('product.target');
    var features = (project && project.product_features) || t('gen.sec.defaultBody');
    return [
      { key: 'hero', title: t('gen.sec.hero'), body: fill(t('gen.sec.heroBody'), { name: name }) },
      { key: 'problem', title: t('gen.sec.problem'), body: fill(t('gen.sec.problemBody'), { target: target }) },
      { key: 'solution', title: t('gen.sec.solution'), body: fill(t('gen.sec.solutionBody'), { name: name }) },
      { key: 'features', title: t('gen.sec.features'), body: features },
      { key: 'proof', title: t('gen.sec.proof'), body: t('gen.sec.defaultBody') },
      { key: 'price', title: t('gen.sec.price'), body: fill(t('gen.sec.priceBody'), { price: priceText(project) }) },
      { key: 'cta', title: t('gen.sec.cta'), body: t('gen.sec.ctaBody') }
    ].map(function (item) {
      item.type = 'text';
      item.image = '';
      item.titleColor = '';
      item.bodyColor = '';
      item.bg = '';
      return item;
    });
  }

  function sectionsOf(generation, project) {
    var sections = normalizeSections(generation && generation.sections);
    if (sections.length) { return sections; }
    return defaultSections(project);
  }

  var DEFAULT_DESIGN = {
    titleFont: 'sans',
    bodyFont: 'sans',
    titleSize: 30,
    bodySize: 16,
    titleColor: '#171018',
    bodyColor: '#3A323E',
    bgColor: '#FFFFFF',
    accentColor: '#C13584'
  };

  /* 本文の指示に当てはめる素材。参照ページから自動入力で入った写真・GIF・
     動画と、背景を抜いた商品カットを使う。ここを渡さないと、
     LPは絵が1枚も無い文字だけのページになる。

     プレビュー（S13）と拡大表示（S15）で必ず同じものを渡すこと。
     片方だけ渡していたとき、プレビューには絵が出るのに拡大すると
     文字だけになる、という食い違いが出ていた。 */
  function assetPoolOf(project) {
    var imgs = asArray(project && project.image_urls).map(String).filter(Boolean);
    var cutouts = asArray(project && project.product_cutout_urls).map(String).filter(Boolean);
    var isGif = function (u) { return String(u).split('?')[0].toLowerCase().slice(-4) === '.gif'; };
    return {
      gif: imgs.filter(isGif),
      photo: cutouts.concat(imgs.filter(function (u) { return !isGif(u); })),
      video: asArray(project && project.video_urls).map(String).filter(Boolean),
      used: { gif: 0, photo: 0, video: 0 }
    };
  }

  /* 生成物1件をLPのHTMLにする。プレビュー（S13）も拡大表示（S15）も
     ダウンロードも、必ずここを通す。

     以前は S13 と S15 が別々に組み立てていて、S15 だけ素材と見出しを
     渡し忘れていた。同じ生成物なのに、プレビューには絵が出るのに
     拡大すると文字だけになる、という食い違いになっていた。
     組み立てを1本にすれば、片方だけ直し忘れることが起きない。 */
  function lpHtmlOf(generation, project, forDownload) {
    var type = generation.__type || normalizeType(generation.content_type);

    /* 保存済みHTML（デザイン済みのリッチLP）があればそれを使う。
       自社LPでLINE URLが設定されたら、<!--LINE_BUTTON--> の位置
       （無ければ </body> 直前）へボタンを差し込む */
    if (generation.generated_html) {
      var rich = fillAssetSlots(generation, String(generation.generated_html));
      if (type === TYPE.OWN) {
        var href = lineHref(generation.line_button_url);
        if (href) {
          var btn = lineButtonMarkup(lineStyleOf(generation), href);
          if (rich.indexOf('<!--LINE_BUTTON-->') !== -1) {
            rich = rich.split('<!--LINE_BUTTON-->').join(btn);
          } else if (rich.indexOf('</body>') !== -1) {
            rich = rich.replace('</body>', btn + '\n</body>');
          } else {
            rich += btn;
          }
        }
      }
      return rich;
    }

    return buildHtml({
      title: generation.headline || (project && project.project_name) || '',
      sections: sectionsOf(generation, project),
      assets: assetPoolOf(project),
      design: designOf(generation),
      type: type,
      lineUrl: generation.line_button_url,
      lineStyle: lineStyleOf(generation),
      linePosition: generation.line_button_position,
      forDownload: !!forDownload
    });
  }

  function designOf(generation) {
    var concept = asObject(generation && generation.creative_concept);
    var saved = asObject(concept.design);
    var out = {};
    Object.keys(DEFAULT_DESIGN).forEach(function (key) {
      out[key] = (saved[key] === undefined || saved[key] === null || saved[key] === '') ? DEFAULT_DESIGN[key] : saved[key];
    });
    out.titleSize = Number(out.titleSize) || DEFAULT_DESIGN.titleSize;
    out.bodySize = Number(out.bodySize) || DEFAULT_DESIGN.bodySize;
    return out;
  }

  function fontStack(kind) {
    if (kind === 'mincho') { return "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif"; }
    if (kind === 'gothic') { return "'Hiragino Sans', 'Yu Gothic UI', 'Noto Sans JP', system-ui, sans-serif"; }
    return "-apple-system, system-ui, 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, sans-serif";
  }

  var LINE_STYLE_KEYS = ['green', 'outline', 'large'];

  function lineStyleLabel(key) {
    if (key === 'outline') { return t('gen.lineStyleOutline'); }
    if (key === 'large') { return t('gen.lineStyleLarge'); }
    return t('gen.lineStyleGreen');
  }

  function lineStyleOf(generation) {
    var saved = asObject(generation && generation.line_button_style);
    var variant = String(saved.variant || 'green');
    if (LINE_STYLE_KEYS.indexOf(variant) === -1) { variant = 'green'; }
    return {
      variant: variant,
      label: String(saved.label || t('gen.lineButtonLabel')),
      height: Number(saved.height) || 48,
      radius: Number(saved.radius) || 12
    };
  }

  /*
   * 貼り付けられたのがURLでもHTMLコードでも、リンク先だけを取り出す。
   * 取り出したURL以外は書き出さない（外部の画像を勝手に読み込まないため）。
   */
  function lineHref(raw) {
    var s = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!s) { return ''; }
    if (/^https?:\/\/\S+$/i.test(s)) { return s; }
    var m = s.match(/href\s*=\s*["']([^"']+)["']/i);
    if (m && /^https?:\/\//i.test(m[1])) { return m[1].trim(); }
    return '';
  }

  /* =========================================================
     4. 書き出し（HTML / SVG / PNG）
     生成物はこのファイルの中だけで組み立てる。外部リソースは読まない。
     ========================================================= */

  function escapeHtml(text) {
    return String(text === undefined || text === null ? '' : text)
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;')
      .split('"').join('&quot;')
      .split("'").join('&#39;');
  }

  function lineButtonMarkup(style, href) {
    var base = 'display:inline-flex;align-items:center;justify-content:center;min-height:' + style.height + 'px;padding:0 28px;border-radius:' + style.radius + 'px;font-size:16px;font-weight:600;text-decoration:none;line-height:1.4;';
    var skin = 'background:#06C755;color:#FFFFFF;border:0;';
    if (style.variant === 'outline') { skin = 'background:#FFFFFF;color:#06C755;border:2px solid #06C755;'; }
    if (style.variant === 'large') { skin = 'background:#06C755;color:#FFFFFF;border:0;width:100%;'; }
    return '<div class="line-cta"><a href="' + escapeHtml(href) + '" style="' + base + skin + '">' + escapeHtml(style.label) + '</a></div>';
  }

  /* ---- 本文に埋まっている素材の指示 ----
     生成した本文には ［動画1：…］［GIF：…］のような指示が入っている。
     これを本文としてそのまま出していたので、画面が指示文の羅列になり、
     絵が1枚も出ないまま「文字だけのページ」になっていた。
     指示は本文から外し、代わりに手元の素材をそこへ置く。 */
  /* 指示の書き方は生成のたびに揺れる（［…］ / […] / ※動画1本目：…）。
     一つの形に賭けると、形が変わった回だけ絵が消える。
     いまは section.media に構造化して出させ、ここは古い行のための受け皿。 */
  var ASSET_DIRECTIVE = /[［\[]([^］\]]{2,200})[］\]]/g;
  /* ※で始まる行には2種類ある。読み手に伝える注意書き（※重量にはバラつきが
     あります）は残し、作り手向けの素材の指示（※1枚目の大判画像は…を使用）
     だけを外す。素材の名前と、作る動作の言葉が両方あるものを指示とみなす */
  var ASSET_WORD = /動画|GIF|ＧＩＦ|サムネ|写真|画像|図版|カット/;
  /* 「枚」だけでは足りない。※貼り付けパーツの同梱枚数：のような
     読み手向けの注記まで落ちてしまうので、作る動作の言葉に限る */
  var MAKE_WORD = /撮影|撮る|使用|使わない|使う|並べ|横並び|一続き|カットなし|差し替え|配置|直下|本ずつ|枚ずつ/;
  function isAssetNote(line) {
    return ASSET_WORD.test(line) && MAKE_WORD.test(line);
  }
  var ASSET_NOTE_LINE = /^[※＊*]\s*([^\n]+)$/gim;

  function directiveKind(text) {
    if (/^動画|ムービー/.test(text)) return 'video';
    if (/^GIF|ループ|アニメ/i.test(text)) return 'gif';
    if (/^サムネ|一覧|並び|列/.test(text)) return 'strip';
    if (/^焼き込み|コピー/.test(text)) return 'caption';
    if (/^写真|カット|画像|図/.test(text)) return 'photo';
    return 'note';
  }

  function splitDirectives(section) {
    var found = [];
    /* 生成が構造化して出したものが第一。読み違えようがない */
    asArray(section && section.media).forEach(function (one) {
      if (!one) { return; }
      var text = String(one.note || one.text || '').trim();
      found.push({ kind: String(one.kind || directiveKind(text)), text: text });
    });
    var fromBody = !found.length;

    var prose = String((section && section.body) || '')
      .replace(ASSET_NOTE_LINE, function (whole, inner) {
        if (!isAssetNote(inner)) { return whole; }
        if (fromBody) { found.push({ kind: directiveKind(inner), text: String(inner).trim() }); }
        return '';
      })
      .replace(ASSET_DIRECTIVE, function (whole, inner) {
        var text = String(inner).trim();
        if (fromBody) { found.push({ kind: directiveKind(text), text: text }); }
        return '';
      });
    return { directives: found, prose: prose.replace(/\n{3,}/g, '\n\n').trim() };
  }

  /* 同じ絵を続けて出さないよう頭から配る。尽きたら黙って何も置かない
     （同じ写真を何度も出すより、無いほうが読み手を惑わせない） */
  function takeAsset(pool, kind) {
    if (!pool || !pool[kind]) { return ''; }
    var used = pool.used[kind] || 0;
    if (used >= pool[kind].length) { return ''; }
    pool.used[kind] = used + 1;
    return pool[kind][used];
  }

  function mediaMarkup(url, alt) {
    if (!url) { return ''; }
    if (/\.(mp4|webm)(\?|$)/i.test(url)) {
      return '<video src="' + escapeHtml(url) + '" muted playsinline loop autoplay controls'
        + ' style="display:block;width:100%;height:auto;border-radius:12px;margin-top:20px;"></video>';
    }
    return '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt || '') + '" loading="lazy"'
      + ' style="display:block;width:100%;height:auto;border-radius:12px;margin-top:20px;">';
  }

  function directiveMarkup(one, pool, design) {
    if (one.kind === 'caption') {
      return '<p style="margin-top:20px;padding:16px 18px;border-left:3px solid '
        + escapeHtml(design.accentColor) + ';background:#FAF8FB;border-radius:0 12px 12px 0;'
        + 'font-size:' + Math.round(design.bodySize * 1.15) + 'px;font-weight:700;line-height:1.6;">'
        + escapeHtml(String(one.text).replace(/^焼き込み文字[：:]\s*/, '')) + '</p>';
    }
    if (one.kind === 'strip') {
      var shots = [];
      for (var i = 0; i < 4; i += 1) {
        var got = takeAsset(pool, i < 2 ? 'gif' : 'photo');
        if (got) { shots.push(got); }
      }
      if (!shots.length) { return ''; }
      return '<div style="margin-top:20px;display:grid;'
        + 'grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;">'
        + shots.map(function (u) {
          return '<img src="' + escapeHtml(u) + '" alt="" loading="lazy"'
            + ' style="display:block;width:100%;height:auto;border-radius:10px;">';
        }).join('') + '</div>';
    }
    if (one.kind === 'video') { return mediaMarkup(takeAsset(pool, 'video'), one.text); }
    if (one.kind === 'gif') { return mediaMarkup(takeAsset(pool, 'gif'), one.text); }
    if (one.kind === 'photo') { return mediaMarkup(takeAsset(pool, 'photo'), one.text); }
    return '';
  }

  function sectionHtml(section, index, design, forDownload, pool) {
    var isHero = index === 0;
    var tag = isHero ? 'h1' : 'h2';
    var titleSize = isHero ? Math.round(design.titleSize * 1.6) : design.titleSize;
    var titleColor = section.titleColor || design.titleColor;
    var bodyColor = section.bodyColor || design.bodyColor;
    var bg = section.bg || (isHero ? '#FAF8FB' : design.bgColor);
    var out = [];
    out.push('<section id="sec-' + (index + 1) + '" data-key="' + escapeHtml(section.key) + '" style="background:' + escapeHtml(bg) + ';">');
    out.push('<div class="wrap">');
    if (section.type === 'divider') {
      out.push('<hr style="border:0;border-top:1px solid #ECE6EE;margin:0;">');
    } else {
      if (section.title) {
        out.push('<' + tag + ' style="font-family:' + fontStack(design.titleFont) + ';font-size:' + titleSize + 'px;line-height:1.35;font-weight:600;color:' + escapeHtml(titleColor) + ';margin:0 0 16px;">' + escapeHtml(section.title) + '</' + tag + '>');
      }
      /* 指示（動画・GIF・サムネ列）は本文から外し、素材に置き換える。
         そのまま出していたので、画面が指示文の羅列になっていた */
      var split = splitDirectives(section);
      if (split.prose) {
        out.push('<p style="font-family:' + fontStack(design.bodyFont) + ';font-size:' + design.bodySize + 'px;line-height:1.9;color:' + escapeHtml(bodyColor) + ';margin:0;white-space:pre-wrap;">' + escapeHtml(split.prose) + '</p>');
      }
      if (pool) {
        split.directives.forEach(function (one) {
          out.push(directiveMarkup(one, pool, design));
        });
      }
      if (section.type === 'image') {
        if (section.image && forDownload) {
          out.push('<img src="' + escapeHtml(section.image) + '" alt="' + escapeHtml(section.title) + '" style="display:block;width:100%;height:auto;border-radius:12px;margin-top:20px;">');
        } else {
          out.push('<div style="margin-top:20px;border:1px dashed #ECE6EE;border-radius:12px;padding:32px;text-align:center;color:#6B6270;font-size:13px;">' + escapeHtml(t('gen.imagePlaceholder')) + '</div>');
        }
      }
      if (String(section.key).toLowerCase().indexOf('cta') !== -1) {
        out.push('<div style="margin-top:24px;"><a href="#" style="display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 32px;border-radius:12px;background:' + escapeHtml(design.accentColor) + ';color:#FFFFFF;font-size:16px;font-weight:600;text-decoration:none;">' + escapeHtml(t('gen.ctaButton')) + '</a></div>');
      }
    }
    out.push('</div>');
    out.push('</section>');
    return out.join('');
  }

  /*
   * 生成物のHTMLを組み立てる。
   * options: { title, sections, design, type, lineUrl, lineStyle, linePosition, forDownload }
   * クラファンLP（TYPE.CF）にはLINE友だち追加ボタンを絶対に入れない。
   */
  function buildHtml(options) {
    var o = options || {};
    var sections = o.sections || [];
    var design = o.design || DEFAULT_DESIGN;
    var href = (o.type === TYPE.OWN) ? lineHref(o.lineUrl) : '';
    var style = o.lineStyle || { variant: 'green', label: t('gen.lineButtonLabel'), height: 48, radius: 12 };
    var position = String(o.linePosition || '');
    var out = [];

    out.push('<!DOCTYPE html>');
    out.push('<html lang="ja">');
    out.push('<head>');
    out.push('<meta charset="UTF-8">');
    out.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
    out.push('<title>' + escapeHtml(o.title || '') + '</title>');
    out.push('<style>');
    out.push('*{box-sizing:border-box;}');
    out.push('body{margin:0;background:' + escapeHtml(design.bgColor) + ';font-family:' + fontStack(design.bodyFont) + ';-webkit-text-size-adjust:100%;overflow-wrap:break-word;word-break:normal;line-break:strict;}');
    out.push('section{padding:56px 0;}');
    out.push('.wrap{max-width:1080px;margin:0 auto;padding:0 32px;}');
    out.push('.line-cta{padding:32px;text-align:center;background:#F6FBF7;}');
    out.push('@media (max-width:600px){section{padding:40px 0;}.wrap{padding:0 20px;}}');
    out.push('</style>');
    out.push('</head>');
    out.push('<body>');

    var placed = false;
    sections.forEach(function (section, index) {
      out.push(sectionHtml(section, index, design, !!o.forDownload, o.assets));
      if (href && !placed && position && String(section.key) === position) {
        out.push(lineButtonMarkup(style, href));
        placed = true;
      }
    });
    if (href && !placed) { out.push(lineButtonMarkup(style, href)); }

    out.push('</body>');
    out.push('</html>');
    return out.join('\n');
  }

  /* ---------- クラファンLP用の画像書き出し（SVG / PNG） ---------- */
  function wrapLines(text, maxChars) {
    var limit = Math.max(8, Math.floor(maxChars) || 8);
    var out = [];
    String(text === undefined || text === null ? '' : text).split('\n').forEach(function (paragraph) {
      var rest = paragraph;
      if (!rest) { out.push(''); return; }
      while (rest.length > limit) {
        out.push(rest.slice(0, limit));
        rest = rest.slice(limit);
      }
      out.push(rest);
    });
    return out;
  }

  function posterLayout(sections, design, width) {
    var padding = 80;
    var lines = [];
    var y = padding + 40;
    sections.forEach(function (section, index) {
      var titleSize = index === 0 ? 56 : 36;
      var bodySize = 24;
      if (index > 0) { y += 28; }
      wrapLines(section.title || t('gen.untitledSection'), (width - padding * 2) / (titleSize * 0.62)).forEach(function (line) {
        lines.push({ text: line, x: padding, y: y, size: titleSize, weight: '600', color: section.titleColor || design.titleColor });
        y += Math.round(titleSize * 1.35);
      });
      y += 12;
      wrapLines(section.body || '', (width - padding * 2) / (bodySize * 0.62)).forEach(function (line) {
        lines.push({ text: line, x: padding, y: y, size: bodySize, weight: '400', color: section.bodyColor || design.bodyColor });
        y += Math.round(bodySize * 1.8);
      });
      y += 24;
    });
    return { lines: lines, width: width, height: Math.max(y + padding, 640) };
  }

  function buildSvg(sections, design, width) {
    var layout = posterLayout(sections, design, width || 1200);
    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + layout.width + '" height="' + layout.height + '" viewBox="0 0 ' + layout.width + ' ' + layout.height + '">');
    out.push('<rect width="' + layout.width + '" height="' + layout.height + '" fill="' + escapeHtml(design.bgColor) + '"/>');
    layout.lines.forEach(function (line) {
      if (!line.text) { return; }
      out.push('<text x="' + line.x + '" y="' + line.y + '" font-size="' + line.size + '" font-weight="' + line.weight + '" fill="' + escapeHtml(line.color) + '" font-family="sans-serif">' + escapeHtml(line.text) + '</text>');
    });
    out.push('</svg>');
    return out.join('\n');
  }

  /* PNGはcanvasに直接描く（外部SVGを読み込まないのでcanvasが汚染されない） */
  function downloadPng(sections, design, filename) {
    var layout = posterLayout(sections, design, 1200);
    var canvas = document.createElement('canvas');
    if (!canvas.getContext) {
      console.error('[screens-generate] canvas を使えない環境のため PNG を書き出せません。');
      toast(t('gen.pngUnsupported'), 'danger');
      return;
    }
    canvas.width = layout.width;
    canvas.height = layout.height;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = design.bgColor;
    ctx.fillRect(0, 0, layout.width, layout.height);
    ctx.textBaseline = 'alphabetic';
    layout.lines.forEach(function (line) {
      if (!line.text) { return; }
      ctx.fillStyle = line.color;
      ctx.font = line.weight + ' ' + line.size + "px 'Hiragino Sans', 'Yu Gothic UI', sans-serif";
      ctx.fillText(line.text, line.x, line.y);
    });

    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(function (blob) {
        if (!blob) {
          console.error('[screens-generate] canvas.toBlob が空を返しました。PNG を書き出せません。');
          toast(t('gen.pngUnsupported'), 'danger');
          return;
        }
        downloadBlob(blob, filename);
      }, 'image/png');
      return;
    }
    try {
      var url = canvas.toDataURL('image/png');
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast(t('gen.downloaded'), 'success');
    } catch (e) {
      console.error('[screens-generate] canvas.toDataURL に失敗しました', e);
      toast(t('gen.pngUnsupported'), 'danger');
    }
  }

  /* =========================================================
     5. プレビュー用 iframe（縮小モックアップ）
     ========================================================= */

  function fitFrame(frame) {
    var wrapper = frame.parentNode;
    if (!wrapper) { return; }
    var cssWidth = Number(frame.getAttribute('data-fit-width')) || 1440;
    var boxWidth = wrapper.clientWidth;
    var boxHeight = wrapper.clientHeight;
    /* まだ大きさが決まっていない段階で縮尺を出すと、実寸より小さいまま
       固まって中身が左に寄る。決まってから測り直す */
    if (!boxWidth || !boxHeight) { return; }
    var scale = boxWidth / cssWidth;

    /* ページ全体の高さぶん iframe を伸ばし、枠のほうをスクロールさせる。
       iframe を見えているぶんだけの高さにして中身を内側でスクロールさせると、
       ホイールが外側のページに流れてしまい、端末の画面が動かない。 */
    var contentHeight = 0;
    try {
      var doc = frame.contentDocument;
      if (doc && doc.documentElement) {
        contentHeight = Math.max(doc.documentElement.scrollHeight, doc.body ? doc.body.scrollHeight : 0);
      }
    } catch (e) {
      /* 読めない場合は見えているぶんだけにする（スクロールはしない） */
      contentHeight = 0;
    }
    if (!contentHeight) { contentHeight = Math.round(boxHeight / scale); }

    frame.style.width = cssWidth + 'px';
    frame.style.height = contentHeight + 'px';
    frame.style.transform = 'scale(' + scale + ')';
    frame.style.transformOrigin = '0 0';

    /* 縮尺は並びの計算に効かないので、スクロールできる高さを別に置く */
    var spacer = wrapper.querySelector('.mock__scroll');
    if (spacer) { spacer.style.height = Math.round(contentHeight * scale) + 'px'; }
  }

  /* 枠の大きさが決まった時点で測り直す。読み込み直後の一瞬だけ
     小さく描かれて左に寄る、という見え方を防ぐ */
  function watchFrame(frame) {
    var wrapper = frame.parentNode;
    if (!wrapper) { return; }
    if (typeof window.ResizeObserver === 'function') {
      var ro = new window.ResizeObserver(function () { fitFrame(frame); });
      ro.observe(wrapper);
      return;
    }
    console.warn('[screens-generate] ResizeObserver がないため、プレビューの縮尺は数回の測り直しで合わせます。');
    [0, 60, 200, 600].forEach(function (wait) {
      window.setTimeout(function () { fitFrame(frame); }, wait);
    });
  }

  function fitAllFrames() {
    var nodes = document.querySelectorAll('iframe[data-fit-width]');
    var i;
    for (i = 0; i < nodes.length; i += 1) { fitFrame(nodes[i]); }
  }

  window.addEventListener('resize', fitAllFrames);

  /* 実物の端末に見えるように、外側の枠まで描く。
     PC はブラウザの窓（信号3つとアドレスバー）、スマホは本体の縁と
     画面上部の黒い島。中身は等倍で描いてから縮尺をかけるので、
     文字の大きさの関係は実機と同じになる。 */
  function mockCard(kind, html, label) {
    var isPhone = kind === 'phone';
    var card = el('div', 'mock ' + (isPhone ? 'mock--phone' : 'mock--pc'));
    card.appendChild(el('span', 'mock__label', label));

    var device = el('div', 'device ' + (isPhone ? 'device--phone' : 'device--pc'));

    if (isPhone) {
      device.appendChild(el('span', 'device__island'));
    } else {
      var bar = el('div', 'device__bar');
      var dots = el('span', 'device__dots');
      dots.appendChild(el('i', 'device__dot device__dot--r'));
      dots.appendChild(el('i', 'device__dot device__dot--y'));
      dots.appendChild(el('i', 'device__dot device__dot--g'));
      bar.appendChild(dots);
      bar.appendChild(el('span', 'device__url', 'example.com'));
      device.appendChild(bar);
    }

    var frame = el('div', 'mock__frame');
    var iframe = document.createElement('iframe');
    iframe.className = 'mock__screen';
    iframe.setAttribute('title', label);
    /* allow-same-origin は中身の高さを測るためだけ。allow-scripts は付けないので
       生成されたHTMLの中でスクリプトは動かない */
    iframe.setAttribute('sandbox', 'allow-same-origin');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('data-fit-width', isPhone ? '390' : '1440');
    iframe.srcdoc = html;
    frame.appendChild(iframe);
    /* スクロールできる高さを作るための下敷き */
    frame.appendChild(el('div', 'mock__scroll'));
    iframe.addEventListener('load', function () {
      fitFrame(iframe);
      /* 画像が入って高さが伸びたぶんを拾い直す */
      [120, 400, 1200].forEach(function (wait) {
        window.setTimeout(function () { fitFrame(iframe); }, wait);
      });
    });
    device.appendChild(frame);
    card.appendChild(device);

    watchFrame(iframe);
    window.setTimeout(function () { fitFrame(iframe); }, 0);
    return card;
  }

  function infoRow(key, value) {
    var row = el('div', 'info-row');
    row.appendChild(el('span', 'info-row__key', key));
    row.appendChild(el('span', 'info-row__val', value));
    return row;
  }

  /* =========================================================
     6. S13 生成結果（PC・スマホ同時プレビュー＋4タブ＋残高）
     ========================================================= */

  var TABS = [
    { key: 'cf', type: TYPE.CF, labelKey: 'generate.crowdfundingLp' },
    { key: 'own', type: TYPE.OWN, labelKey: 'generate.ownLp' },
    { key: 'kvad', type: null, labelKey: 'gen.tabKvAd' },
    { key: 'line', type: TYPE.LINE, labelKey: 'generate.lineContent' }
  ];

  var LINE_SUBS = [
    { key: 'rich_menu', labelKey: 'generate.richMenu' },
    { key: 'rich_message', labelKey: 'generate.richMessage' },
    { key: 'greeting', labelKey: 'generate.greetingMessage' },
    { key: 'message', labelKey: 'generate.message' }
  ];

  function bucketKey(type) {
    if (type === TYPE.CF) { return 'cf'; }
    if (type === TYPE.OWN) { return 'own'; }
    if (type === TYPE.KV || type === TYPE.AD) { return 'kvad'; }
    if (type === TYPE.LINE) { return 'line'; }
    return 'other';
  }

  function normalizeLineSub(raw) {
    var v = String(raw === undefined || raw === null ? '' : raw).toLowerCase();
    if (v.indexOf('menu') !== -1) { return 'rich_menu'; }
    if (v.indexOf('rich') !== -1) { return 'rich_message'; }
    if (v.indexOf('greet') !== -1 || v.indexOf('あいさつ') !== -1 || v.indexOf('挨拶') !== -1) { return 'greeting'; }
    return 'message';
  }

  function renderGenerate(root, params) {
    mounted = { id: 'S13', root: root, params: params };
    setHeader(t('generate.title'), true);

    var projectId = resolveProjectId(params);
    var view = {
      tab: (params && params.tab) ? String(params.tab) : 'cf',
      lineSub: 'rich_menu',
      target: 'all',  /* 'all' か、ターゲット層の記号（A〜E） */
      device: 'pc',   /* プレビューで見せている端末。'pc' か 'phone' */
      making: {}      /* いま作っている素材の印。'生成物ID:列:番号' → true */
    };
    /* 生成中の状態。層 × 成果物ぶんの仕事が並ぶので、全部終わるまで
       20分以上かかる。できたものを途中で見られるように、生成の進み具合を
       画面のどこからでも読めるところに置く */
    var run = { active: false, done: 0, total: 0, startedAt: 0, fresh: 0, viewing: false };
    var data = { project: null, generations: [], buckets: {}, user: null, report: null, metrics: {} };

    if (!projectId) {
      showErrorScreen(root, t('gen.noProject'), null,
        button('btn btn--primary btn--block', t('projectDetail.backToDashboard'), function () { go('S3'); }));
      return;
    }
    if (!Api || !Api.generations) {
      showErrorScreen(root, t('gen.apiMissing'), function () { window.location.reload(); });
      return;
    }

    function load() {
      clearBanner();
      showSkeleton(root);
      Api.projects.get(projectId).then(function (project) {
        data.project = project;
        /* 素材の見本にするのは、S4 で★を付けた商品カットだけ */
        data.productShots = asArray(project && project.product_shot_urls).map(String).filter(Boolean);
        /* 背景を抜いた切り抜き。あればこちらを見本に渡す（背景ごと商品だと
           解釈されて、まるで違う物が描かれるのを防ぐため） */
        data.productCutouts = asArray(project && project.product_cutout_urls).map(String).filter(Boolean);
        return Api.generations.list({
          eq: { projects_id: String(projectId) },
          order: 'created_at.desc',
          limit: 200
        });
      }).then(function (rows) {
        data.generations = rows || [];
        data.targets = [];
        data.generations.forEach(function (row) {
          row.__type = normalizeType(row.content_type);
          var label = String(row.variant_label || '').trim();
          if (label && data.targets.indexOf(label) === -1) { data.targets.push(label); }
        });
        data.targets.sort();
        if (view.target !== 'all' && data.targets.indexOf(view.target) === -1) { view.target = 'all'; }
        fillBuckets();
        return Api.analysisReports.list({
          eq: { projects_id: String(projectId) },
          order: 'created_at.desc',
          limit: 1
        }).catch(function (err) {
          console.error('[screens-generate] 参照元の分析レポートを読めませんでした（件数表示のみ省きます）', err);
          return [];
        });
      }).then(function (reports) {
        data.report = (reports && reports[0]) || null;
        /* 公開LPの計測（A/Bテスト）。読めなくても画面は出す */
        if (Api.lp && typeof Api.lp.metrics === 'function') {
          return Api.lp.metrics(String(projectId)).then(function (rows) {
            data.metrics = {};
            (rows || []).forEach(function (row) {
              var id = String(row.generation_id || '');
              if (!data.metrics[id]) { data.metrics[id] = {}; }
              data.metrics[id][String(row.event_type)] = Number(row.count) || 0;
            });
          }, function (err) {
            console.error('[screens-generate] 計測の読み込みに失敗しました（表示のみ省きます）', err);
            data.metrics = {};
          });
        }
      }).then(function () {
        return loadUser();
      }).then(function (user) {
        data.user = user;
        if (!data.buckets[view.tab] || !data.buckets[view.tab].length) {
          var firstFilled = null;
          TABS.forEach(function (tab) {
            if (!firstFilled && data.buckets[tab.key] && data.buckets[tab.key].length) { firstFilled = tab.key; }
          });
          if (firstFilled) { view.tab = firstFilled; }
        }
        paint();
      }).catch(function (err) {
        console.error('[screens-generate] 生成結果の読み込みに失敗しました', err);
        if (err && err.code === 'notfound') {
          showErrorScreen(root, t('gen.projectNotFound'), null,
            button('btn btn--primary btn--block', t('projectDetail.backToDashboard'), function () { go('S3'); }));
          return;
        }
        showErrorScreen(root, errorMessage(err, 'generate.loadFailed'), load);
      });
    }

    function allAssetRows() {
      var out = [];
      data.generations.forEach(function (row) {
        if (view.target !== 'all' && String(row.variant_label || '').trim() !== view.target) { return; }
        assetRowsOf(row).forEach(function (one) { out.push(one); });
      });
      return out;
    }

    /* できた素材のURLを、その生成物の image_urls / video_urls に入れる。
       並びは指示文と同じにしておく（何番目の指示のものか分かるように） */
    function attachAsset(assetRow, url) {
      var current = asArray(assetRow.generation[assetRow.column]).slice();
      while (current.length <= assetRow.index) { current.push(null); }
      current[assetRow.index] = {
        slot: assetRow.slot,
        url: url,
        provider: assetRow.kind === 'image' ? 'chatgpt_image2' : 'segmind'
      };

      var patch = {};
      patch[assetRow.column] = current;
      return Api.generations.update(assetRow.generation.id, patch).then(function (row) {
        /* 手元の行も更新して、貼った直後から生成済みとして見えるようにする */
        assetRow.generation[assetRow.column] = row ? row[assetRow.column] : current;
        return row;
      });
    }

    function assetSection() {
      var rows = allAssetRows();
      var section = el('section', 'section');
      var head = el('div', 'section__head');
      head.appendChild(el('h3', 'section__title', t('gen.assetTitle')));

      var waiting = rows.filter(function (one) { return !one.url; }).length;
      head.appendChild(el('span', 't-note', fill(t('gen.assetCount'), { n: waiting, m: rows.length })));
      section.appendChild(head);
      section.appendChild(el('p', 'section__desc', t('gen.assetLead')));

      if (!rows.length) {
        var box = el('div', 'empty');
        box.appendChild(el('p', 'empty__text', t('gen.assetEmpty')));
        section.appendChild(box);
        return section;
      }

      var note = el('div', 'note-box');
      note.appendChild(el('p', null, t('gen.assetApiNote')));
      section.appendChild(note);

      section.appendChild(renderAllBar(rows));

      var grid = el('div', 'asset-grid');
      rows.forEach(function (one) {
        grid.appendChild(assetCard(one));
      });
      section.appendChild(grid);
      return section;
    }

    /* ---- 未生成の素材をまとめて生成に出す ----
       ChatGPT（画像）と segmind（動画）には、指示文だけでなく
       S4 で★を付けた商品カットを一緒に渡す。見本が無いと、AIが
       商品の見た目を作り変えてしまうため。 */
    function renderAllBar(rows) {
      var box = el('div', 'stack stack--tight');
      var waiting = rows.filter(function (one) { return !one.url; });
      var shots = data.productShots || [];

      if (!shots.length) {
        var warn = el('div', 'warn-box');
        warn.appendChild(el('p', null, t('gen.assetNeedShots')));
        box.appendChild(warn);
        box.appendChild(button('btn btn--secondary btn--block', t('gen.assetToInput'), function () {
          go('S4', { id: projectId });
        }));
        return box;
      }

      box.appendChild(el('p', 't-note', fill(t('gen.assetShots'), { n: shots.length })));
      var cutouts = data.productCutouts || [];
      box.appendChild(el('p', 't-note', cutouts.length
        ? fill(t('gen.assetCutouts'), { n: cutouts.length })
        : t('gen.assetCutoutFirst')));

      var run = button('btn btn--primary btn--block', t('gen.assetRenderAll'), function () {
        if (!waiting.length) { return; }
        run.disabled = true;
        run.textContent = t('gen.assetRendering');
        renderAllAssets(waiting, shots, run);
      });
      if (!waiting.length) { run.disabled = true; }
      box.appendChild(run);
      return box;
    }

    /* 素材1件ぶんの覚え書き。どのカードが作られているかを見分ける */
    function assetKey(one) {
      return String(one.generation.id) + ':' + one.column + ':' + one.index;
    }

    function assetPayload(one) {
      return {
        generation_id: String(one.generation.id),
        content_type: one.generation.content_type,
        target: one.generation.variant_label || '',
        column: one.column,
        index: one.index,
        kind: one.kind,
        slot: one.slot,
        prompt: one.prompt
      };
    }

    /* ---- 複数の素材を同時に作る ----
       1件ずつ順番に待つと、枚数ぶんだけ待ち時間が積み上がる。
       素材ごとに生成へ出し、何件かを並行して走らせる。できたものから
       順に一覧へ入るので、全部そろうのを待たずに見はじめられる。
       同時数を絞るのは、画像生成が詰まって全体が遅くなるのを避けるため。 */
    var ASSET_RUNNING_MAX = 4;

    function renderAllAssets(waiting, shots, run, queuedMessage) {
      if (!Api.analysis || typeof Api.analysis.run !== 'function') {
        console.error('[screens-generate] Api.analysis.run がありません。api.js を確認してください。');
        toast(t('gen.assetRenderFailed'), 'danger');
        run.disabled = false;
        run.textContent = queuedMessage ? t('gen.assetRedo') : t('gen.assetRenderAll');
        return;
      }

      var list = waiting.slice();
      if (!list.length) { return; }

      list.forEach(function (one) { view.making[assetKey(one)] = true; });
      paint();

      var done = 0;
      var failed = 0;
      var next = 0;
      var live = 0;
      var single = list.length === 1;

      function announce() {
        if (single) { return; }
        toast(fill(t('gen.assetProgress'), { done: done, total: list.length }), 'info');
      }

      function runOne(one) {
        return Api.analysis.run({
          mode: 'asset_render',
          projects_id: String(projectId),
          product_shots: shots,
          /* 切り抜きができていればそれを見本にする。無ければ生成の最初に作る */
          product_cutouts: data.productCutouts || [],
          assets: [assetPayload(one)],
          lang: (App.getLang && App.getLang()) || 'ja'
        }).then(function (result) {
          if (!(result && result.queued)) { return null; }
          return waitForAssetJob(result.job_id);
        }, function (err) {
          console.error('[screens-generate] 素材の生成に出せませんでした', one.slot, err);
          failed += 1;
        }).then(function () {
          delete view.making[assetKey(one)];
          done += 1;
          announce();
        });
      }

      function finish() {
        if (failed) {
          toast(fill(t('gen.assetSomeFailed'), { n: failed }), 'danger');
        } else {
          toast(queuedMessage || fill(t('gen.assetRenderQueued'), { n: list.length }), 'success');
        }
        load();
      }

      function pump() {
        while (live < ASSET_RUNNING_MAX && next < list.length) {
          var one = list[next];
          next += 1;
          live += 1;
          runOne(one).then(function () {
            live -= 1;
            /* 1件終わるたびに一覧を作り直し、できたものからすぐ見えるようにする */
            if (next < list.length) { pump(); }
            if (!live && next >= list.length) { finish(); return; }
            load();
          });
        }
      }

      announce();
      pump();
    }

    /* 素材のジョブが片づくまで待つ。待ちきれなくても、次に画面を開けば入っている */
    function waitForAssetJob(jobId) {
      var POLL_MS = 4000;
      var LIMIT_MS = 15 * 60 * 1000;
      var startedAt = Date.now();
      return new Promise(function (resolve) {
        function tick() {
          if (Date.now() - startedAt > LIMIT_MS) { resolve('timeout'); return; }
          Api.generationJobs.get(jobId).then(function (job) {
            if (job && job.status === 'done') { resolve('done'); return; }
            if (job && job.status === 'failed') { resolve('failed'); return; }
            setTimeout(tick, POLL_MS);
          }, function (err) {
            console.error('[screens-generate] 素材ジョブの確認に失敗しました。続けて確認します', err);
            setTimeout(tick, POLL_MS);
          });
        }
        setTimeout(tick, POLL_MS);
      });
    }

    function assetCard(one) {
      var making = !!view.making[assetKey(one)];
      var card = el('div', 'card asset-card');

      var badges = el('div', 'chips');
      if (one.generation.variant_label) {
        badges.appendChild(el('span', 'badge', String(one.generation.variant_label)));
      }
      badges.appendChild(el('span', 'badge badge--mute', typeLabel(one.generation.__type)));
      badges.appendChild(el('span', 'badge badge--mute',
        t(one.kind === 'image' ? 'gen.assetImage' : 'gen.assetVideo')));
      badges.appendChild(el('span',
        making ? 'badge badge--warn' : (one.url ? 'badge badge--ok' : 'badge badge--mute'),
        t(making ? 'gen.assetMaking' : (one.url ? 'gen.assetDone' : 'gen.assetWaiting'))));
      card.appendChild(badges);

      card.appendChild(el('p', 'card__label', one.slot));

      if (making) {
        var pending = el('div', 'asset-view asset-view--making');
        pending.appendChild(el('span', 't-note', t('gen.assetMaking')));
        card.appendChild(pending);
      } else if (one.url) {
        var link = el('a', 'asset-view');
        link.href = one.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.setAttribute('aria-label', t('gen.assetOpen') + '：' + one.slot);
        if (one.kind === 'video') {
          var movie = el('video', 'asset-view__media');
          movie.src = one.url;
          movie.muted = true;
          movie.loop = true;
          movie.autoplay = true;
          movie.playsInline = true;
          link.appendChild(movie);
        } else {
          var shot = el('img', 'asset-view__media');
          shot.src = one.url;
          shot.alt = one.slot;
          shot.loading = 'lazy';
          link.appendChild(shot);
        }
        card.appendChild(link);
      }

      /* 指示文は運営が中身を確かめるためのもの。利用者には見せない */
      if (App.isAdmin && App.isAdmin()) {
        var promptBox = el('details', 'asset-prompt');
        if (!one.url) { promptBox.open = true; }
        promptBox.appendChild(el('summary', 'asset-prompt__head', t('gen.assetShowPrompt')));
        var body = el('p', 'card__sub');
        body.textContent = one.prompt;
        promptBox.appendChild(body);
        /* 指示文をそのまま ChatGPT / segmind に貼れるようにする */
        promptBox.appendChild(button('btn btn--secondary btn--sm', t('gen.assetCopy'), function () {
          copyText(one.prompt);
        }));
        card.appendChild(promptBox);
      }

      /* 気に入らなければ作り直す。同じ指示文でもう一度作らせる */
      var redo = button('btn btn--secondary btn--block btn--sm',
        t(making ? 'gen.assetRedoing' : 'gen.assetRedo'), function () {
        redo.disabled = true;
        redo.textContent = t('gen.assetRedoing');
        renderAllAssets([one], data.productCutouts && data.productCutouts.length
          ? data.productCutouts : (data.productShots || []), redo, t('gen.assetRedoQueued'));
      });
      if (making) { redo.disabled = true; }
      card.appendChild(redo);

      /* URLを貼る欄も、できたあとは畳んでおく（差し替えたいときだけ開く） */
      /* URLを手で貼る欄も運営用。APIを入れたら自動で埋まるので、
         利用者には出さない（利用者にできるのは「作り直す」だけ） */
      if (!(App.isAdmin && App.isAdmin())) { return card; }

      var field = el('details', 'field asset-paste');
      if (!one.url) { field.open = true; }
      field.appendChild(el('summary', 'field__label', t('gen.assetPaste')));
      var line = el('div', 'row--input-action');
      var input = el('input', 'input');
      input.type = 'url';
      input.placeholder = 'https://';
      input.value = one.url;
      input.setAttribute('aria-label', t('gen.assetPaste') + '：' + one.slot);
      line.appendChild(input);

      var save = button('btn btn--primary btn--sm', t('gen.assetSave'), function () {
        var value = String(input.value || '').trim();
        if (!/^https?:\/\//i.test(value)) {
          toast(t('gen.assetBadUrl'), 'danger');
          return;
        }
        save.disabled = true;
        attachAsset(one, value).then(function () {
          toast(t('gen.assetSaved'), 'success');
          paint();
        }, function (err) {
          save.disabled = false;
          console.error('[screens-generate] 素材の登録に失敗しました', err);
          toast(errorMessage(err, 'gen.assetSaveFailed'), 'danger');
        });
      });
      line.appendChild(save);
      field.appendChild(line);
      card.appendChild(field);
      return card;
    }

    /* 選んでいる層だけを種別ごとの入れ物に配る。'all' のときは全部入れる */
    function fillBuckets() {
      data.buckets = { cf: [], own: [], kvad: [], line: [], other: [] };
      data.generations.forEach(function (row) {
        if (view.target !== 'all' && String(row.variant_label || '').trim() !== view.target) { return; }
        data.buckets[bucketKey(row.__type)].push(row);
      });
    }

    /* プレビュー対象（LPタブはそのLP、その他タブは自社LP→クラファンLPの順） */
    function previewTarget() {
      var order = (view.tab === 'cf') ? ['cf', 'own'] : ['own', 'cf'];
      var found = null;
      order.forEach(function (key) {
        if (!found && data.buckets[key] && data.buckets[key].length) { found = data.buckets[key][0]; }
      });
      return found;
    }

    function htmlOf(generation, forDownload) {
      return lpHtmlOf(generation, data.project, forDownload);
    }


    function footerActions() {
      var box = el('div', 'stack stack--group');
      box.appendChild(button('btn btn--secondary btn--block', t('generate.addMore'), function () {
        go('S12', { id: projectId });
      }));

      /* 途中保存。生成物そのものはサーバーにあるので、ここでは
         「この工程まで進んだ」ことを覚えさせる（続きから戻れるように） */
      if (App && typeof App.saveProgressButton === 'function') {
        var saveHere = App.saveProgressButton({ projectId: projectId, step: 'S13' });
        saveHere.classList.add('btn--block');
        box.appendChild(saveHere);
      }

      box.appendChild(button('btn btn--primary btn--block', t('generate.saveAndReturn'), function () {
        go('S8', { id: projectId });
      }));
      box.appendChild(button('btn btn--text btn--block', t('generate.viewCredit'), function () { go('S17'); }));
      return box;
    }

    function emptyForTab(container, name) {
      var box = el('div', 'empty');
      box.appendChild(el('p', 'empty__text', fill(t('gen.emptyKind'), { name: name })));
      box.appendChild(button('btn btn--primary', t('gen.generateThis'), function () {
        go('S12', { id: projectId });
      }));
      container.appendChild(box);
    }

    function recommendPositions(sections) {
      var out = [];
      function push(section) {
        if (!section) { return; }
        var exists = false;
        out.forEach(function (item) { if (item.key === section.key) { exists = true; } });
        if (!exists) { out.push({ key: section.key, title: section.title || t('gen.untitledSection') }); }
      }
      push(sections[0]);
      var featureIndex = -1;
      sections.forEach(function (section, index) {
        if (featureIndex === -1 && String(section.key).toLowerCase().indexOf('feature') !== -1) { featureIndex = index; }
      });
      push(sections[featureIndex === -1 ? Math.min(3, sections.length - 1) : featureIndex]);
      push(sections[sections.length - 1]);
      return out;
    }

    /* ---- 自社LPのLINE友だち追加ボタン（URL入力・推奨位置・推奨デザイン） ---- */
    function lineButtonEditor(generation, sections) {
      var box = el('section', 'section');
      box.appendChild(el('h3', 'section__title', t('generate.lineButtonUrl')));

      var draft = {
        position: String(generation.line_button_position || ''),
        style: lineStyleOf(generation)
      };
      if (!draft.position && sections.length) { draft.position = sections[0].key; }

      var inputId = 'line-url-' + String(generation.id);
      var field = el('div', 'field');
      var label = el('label', 'field__label', t('generate.lineButtonUrl'));
      label.setAttribute('for', inputId);
      field.appendChild(label);
      var input = document.createElement('input');
      input.type = 'url';
      input.className = 'input';
      input.id = inputId;
      input.placeholder = t('gen.lineUrlPlaceholder');
      input.value = String(generation.line_button_url || '');
      field.appendChild(input);
      field.appendChild(el('p', 'field__hint', t('gen.lineUrlHint')));
      var error = el('p', 'field__error');
      error.hidden = true;
      field.appendChild(error);
      box.appendChild(field);

      /* 推奨位置 */
      box.appendChild(el('p', 'section__desc', t('generate.lineButtonPosition') + '：' + t('gen.linePositionHint')));
      var positionChips = el('div', 'chips');
      recommendPositions(sections).forEach(function (item) {
        var chip = button('chip' + (draft.position === item.key ? ' chip--selected' : ''),
          fill(t('gen.linePositionAfter'), { name: item.title }), function () {
            draft.position = item.key;
            refreshChips();
          });
        chip.setAttribute('data-position', item.key);
        positionChips.appendChild(chip);
      });
      box.appendChild(positionChips);

      /* 推奨デザイン */
      box.appendChild(el('p', 'section__desc', t('generate.lineButtonStyle')));
      var styleChips = el('div', 'chips');
      LINE_STYLE_KEYS.forEach(function (key) {
        var chip = button('chip' + (draft.style.variant === key ? ' chip--selected' : ''), lineStyleLabel(key), function () {
          draft.style.variant = key;
          refreshChips();
          refreshPreview();
        });
        chip.setAttribute('data-style', key);
        styleChips.appendChild(chip);
      });
      box.appendChild(styleChips);

      /* 実際に描画するボタン */
      box.appendChild(el('p', 't-note', t('gen.lineButtonPreview')));
      var previewBox = el('div', 'card card--soft');
      var previewButton = el('span', '', draft.style.label);
      previewBox.appendChild(previewButton);
      box.appendChild(previewBox);

      function refreshPreview() {
        var s = previewButton.style;
        s.display = 'inline-flex';
        s.alignItems = 'center';
        s.justifyContent = 'center';
        s.minHeight = draft.style.height + 'px';
        s.padding = '0 28px';
        s.borderRadius = draft.style.radius + 'px';
        s.fontSize = '16px';
        s.fontWeight = '600';
        s.lineHeight = '1.4';
        if (draft.style.variant === 'outline') {
          s.background = '#FFFFFF';
          s.color = '#06C755';
          s.border = '2px solid #06C755';
          s.width = 'auto';
        } else if (draft.style.variant === 'large') {
          s.background = '#06C755';
          s.color = '#FFFFFF';
          s.border = '0';
          s.width = '100%';
        } else {
          s.background = '#06C755';
          s.color = '#FFFFFF';
          s.border = '0';
          s.width = 'auto';
        }
      }

      function refreshChips() {
        var i;
        var positionNodes = positionChips.querySelectorAll('.chip');
        for (i = 0; i < positionNodes.length; i += 1) {
          positionNodes[i].classList.toggle('chip--selected', positionNodes[i].getAttribute('data-position') === draft.position);
        }
        var styleNodes = styleChips.querySelectorAll('.chip');
        for (i = 0; i < styleNodes.length; i += 1) {
          styleNodes[i].classList.toggle('chip--selected', styleNodes[i].getAttribute('data-style') === draft.style.variant);
        }
      }

      refreshPreview();

      var save = button('btn btn--primary btn--block', t('gen.lineSaveButton'), function () {
        var raw = input.value.trim();
        var href = lineHref(raw);
        if (raw && !href) {
          input.classList.add('input--error');
          error.hidden = false;
          error.textContent = t('gen.lineUrlInvalid');
          return;
        }
        input.classList.remove('input--error');
        error.hidden = true;
        save.disabled = true;
        save.textContent = t('gen.saving');
        Api.generations.update(generation.id, {
          line_button_url: href,
          line_button_position: draft.position,
          line_button_style: {
            variant: draft.style.variant,
            label: draft.style.label,
            height: draft.style.height,
            radius: draft.style.radius
          }
        }).then(function () {
          generation.line_button_url = href;
          generation.line_button_position = draft.position;
          generation.line_button_style = {
            variant: draft.style.variant,
            label: draft.style.label,
            height: draft.style.height,
            radius: draft.style.radius
          };
          toast(href ? t('gen.lineUrlSaved') : t('gen.lineUrlEmpty'), href ? 'success' : 'danger');
          paint();
        }, function (err) {
          console.error('[screens-generate] LINE友だち追加ボタンの保存に失敗しました', err);
          save.disabled = false;
          save.textContent = t('gen.lineSaveButton');
          showBanner(errorMessage(err, 'gen.lineSaveFailed'), function () { save.click(); });
          toast(t('gen.lineSaveFailed'), 'danger');
        });
      });
      box.appendChild(save);

      if (!lineHref(generation.line_button_url)) {
        var warn = el('div', 'warn-box');
        warn.appendChild(el('p', 't-note', t('gen.lineUrlEmpty')));
        box.appendChild(warn);
      }
      return box;
    }

    /* ---- LPの公開とA/B計測（f8） ----
       公開＝HTMLスナップショットを保存して view.html?lp=<slug> で誰でも見られる状態にする。
       表示数・CTAクリック・LINE追加は view.html が RPC で記録し、ここで並べて表示する。 */
    function publicUrlOf(generation) {
      if (!generation.public_url_slug) { return ''; }
      var base = window.location.href.split('#')[0].replace(/index\.html$/, '');
      return base + 'view.html?lp=' + encodeURIComponent(generation.public_url_slug);
    }

    function publishBlock(generation) {
      var box = el('div', 'stack stack--tight');
      var isPublished = !!generation.published_at;

      if (isPublished) {
        var url = publicUrlOf(generation);
        var chips = el('div', 'chips');
        chips.appendChild(el('span', 'chip', t('gen.published')));
        var m = data.metrics[String(generation.id)] || {};
        chips.appendChild(el('span', 'chip chip--mute', t('gen.metricViews') + ' ' + formatNumber(m.view || 0)));
        chips.appendChild(el('span', 'chip chip--mute', t('gen.metricCta') + ' ' + formatNumber(m.cta_click || 0)));
        chips.appendChild(el('span', 'chip chip--mute', t('gen.metricLine') + ' ' + formatNumber(m.line_add || 0)));
        box.appendChild(chips);

        var urlRow = el('div', 'info-row');
        urlRow.appendChild(el('span', 'info-row__key', t('gen.publicUrl')));
        urlRow.appendChild(el('span', 'info-row__val break-url clamp-2', url));
        box.appendChild(urlRow);

        var row2 = el('div', 'row row--2');
        row2.appendChild(button('btn btn--secondary btn--block', t('gen.copyUrl'), function () {
          copyText(url);
        }));
        row2.appendChild(button('btn btn--secondary btn--block', t('gen.openUrl'), function () {
          window.open(url, '_blank', 'noopener');
        }));
        box.appendChild(row2);

        var row3 = el('div', 'row row--2');
        row3.appendChild(button('btn btn--text btn--block', t('gen.publishUpdate'), function () {
          doPublish(generation, true);
        }));
        row3.appendChild(button('btn btn--text btn--block', t('gen.unpublish'), function () {
          Api.lp.unpublish(generation.id).then(function (row) {
            generation.published_at = null;
            toast(t('gen.unpublishDone'), 'success');
            paint();
          }, function (err) {
            console.error('[screens-generate] 公開停止に失敗しました', err);
            toast(t('gen.publishFailed'), 'danger');
          });
        }));
        box.appendChild(row3);
      } else {
        box.appendChild(button('btn btn--secondary btn--block', t('gen.publish'), function () {
          doPublish(generation, false);
        }));
        if (generation.variant_label) {
          box.appendChild(el('p', 't-note', t('gen.abHint')));
        }
      }
      return box;
    }

    function doPublish(generation, isUpdate) {
      var html;
      try {
        html = htmlOf(generation, true);
      } catch (e) {
        console.error('[screens-generate] 公開用HTMLの生成に失敗しました', e);
        toast(t('gen.publishFailed'), 'danger');
        return;
      }
      Api.lp.publish(generation.id, html).then(function (row) {
        if (row && typeof row === 'object') {
          generation.public_url_slug = row.public_url_slug || generation.public_url_slug;
          generation.published_at = row.published_at || new Date().toISOString();
          generation.generated_html = html;
        }
        toast(t(isUpdate ? 'common.saved' : 'gen.publishDone'), 'success');
        paint();
      }, function (err) {
        console.error('[screens-generate] 公開に失敗しました', err);
        toast(t('gen.publishFailed'), 'danger');
      });
    }

    /* ---- LPタブ（クラファンLP / 自社LP） ---- */
    function paintLpTab(container, rows, type) {
      if (!rows || !rows.length) {
        emptyForTab(container, typeLabel(type));
        return;
      }

      rows.forEach(function (generation) {
        var sections = sectionsOf(generation, data.project);
        var design = designOf(generation);
        var card = el('section', 'section');

        var headRow = el('div', 'section__head');
        headRow.appendChild(el('h3', 'section__title', generation.headline || typeLabel(type)));
        card.appendChild(headRow);

        var meta = el('div', 'chips');
        if (generation.variant_label) {
          meta.appendChild(el('span', 'chip chip--mute', fill(t('gen.variant'), { label: generation.variant_label })));
        }
        meta.appendChild(el('span', 'chip chip--mute', formatNumber(generation.credit_cost) + ' ' + t('common.creditShort')));
        card.appendChild(meta);

        if (type === TYPE.CF) {
          var note = el('div', 'note-box');
          note.appendChild(el('p', 't-note', t('generate.noLineButtonForCrowdfunding')));
          note.appendChild(el('p', 't-note', t('gen.cfImageNote')));
          card.appendChild(note);
        } else {
          card.appendChild(lineButtonEditor(generation, sections));
        }

        card.appendChild(publishBlock(generation));

        card.appendChild(el('div', 'list__head', t('gen.sectionsTitle')));
        var list = el('div', 'list');
        sections.forEach(function (section, index) {
          var row = el('div', 'list-row');
          var bodyBox = el('div', 'list-row__body');
          bodyBox.appendChild(el('span', 'list-row__title', section.title || t('gen.untitledSection')));
          if (section.body) { bodyBox.appendChild(el('span', 'list-row__sub clamp-2', section.body)); }
          row.appendChild(bodyBox);
          var copyBtn = button('btn btn--text btn--sm list-row__action', t('common.copy'), function () {
            copyText((section.title || '') + '\n' + (section.body || ''));
          });
          copyBtn.setAttribute('aria-label', t('generate.copySection') + ' ' + (index + 1));
          row.appendChild(copyBtn);
          list.appendChild(row);
        });
        card.appendChild(list);

        var actions = el('div', 'stack stack--tight');
        actions.appendChild(button('btn btn--secondary btn--block', t('gen.copyAll'), function () {
          copyText(sections.map(function (section) {
            return (section.title || '') + '\n' + (section.body || '');
          }).join('\n\n'));
        }));

        var baseName = safeFileName((data.project && data.project.project_name) || 'lp');
        if (type === TYPE.CF) {
          actions.appendChild(button('btn btn--secondary btn--block', t('gen.downloadSvg'), function () {
            downloadText(buildSvg(sections, design, 1200), baseName + '_crowdfunding.svg', 'image/svg+xml;charset=utf-8');
          }));
          actions.appendChild(button('btn btn--secondary btn--block', t('gen.downloadPng'), function () {
            downloadPng(sections, design, baseName + '_crowdfunding.png');
          }));
        } else {
          actions.appendChild(button('btn btn--secondary btn--block', t('generate.downloadHtml'), function () {
            downloadText(htmlOf(generation, true), baseName + '_own_lp.html', 'text/html;charset=utf-8');
          }));
        }

        actions.appendChild(button('btn btn--text btn--block', t('generate.editDesign'), function () {
          rememberGeneration(generation.id);
          go('S14', { id: projectId, gen: generation.id });
        }));
        card.appendChild(actions);
        container.appendChild(card);
      });
    }

    /* ---- KV・メタ広告タブ（A/B案を並べて表示） ---- */
    function paintKvAdTab(container) {
      var rows = data.buckets.kvad || [];
      if (!rows.length) {
        emptyForTab(container, t('gen.tabKvAd'));
        return;
      }
      var texts = [];

      rows.forEach(function (generation) {
        var concept = asObject(generation.creative_concept);
        var card = el('section', 'section');
        var headRow = el('div', 'section__head');
        headRow.appendChild(el('h3', 'section__title',
          typeLabel(generation.__type) + (generation.variant_label ? '　' + fill(t('gen.variant'), { label: generation.variant_label }) : '')));
        card.appendChild(headRow);

        /* 生成済みのKV画像（image_urls）。SVGデータURI・通常URLの両方を表示できる */
        var kvImages = asArray(generation.image_urls).filter(Boolean);
        if (kvImages.length) {
          kvImages.forEach(function (src, imgIndex) {
            var frame = el('div', 'preview-frame');
            var img = el('img', 'thumb__img');
            img.src = String(src);
            img.alt = (generation.title || 'KV') + ' ' + (imgIndex + 1);
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.display = 'block';
            img.style.borderRadius = '12px';
            frame.appendChild(img);
            card.appendChild(frame);
          });
          card.appendChild(button('btn btn--secondary btn--block', t('gen.downloadSvg'), function () {
            var src = String(kvImages[0]);
            if (src.indexOf('data:image/svg') === 0) {
              var svgText = src.indexOf('base64,') !== -1
                ? atob(src.split('base64,')[1])
                : decodeURIComponent(src.split(',').slice(1).join(','));
              downloadText(svgText, safeFileName(generation.title || 'kv') + '.svg', 'image/svg+xml;charset=utf-8');
            } else {
              window.open(src, '_blank', 'noopener');
            }
          }));
        }

        var info = el('div', 'info-list');
        if (generation.headline) {
          info.appendChild(infoRow(t('gen.headline'), generation.headline));
          texts.push(t('gen.headline') + ': ' + generation.headline);
        }
        if (generation.body_text) {
          info.appendChild(infoRow(t('gen.bodyText'), generation.body_text));
          texts.push(t('gen.bodyText') + ': ' + generation.body_text);
        }
        if (concept.cta) {
          info.appendChild(infoRow(t('gen.ctaText'), concept.cta));
          texts.push(t('gen.ctaText') + ': ' + concept.cta);
        }
        if (concept.composition) { info.appendChild(infoRow(t('gen.composition'), concept.composition)); }
        if (concept.appeal) { info.appendChild(infoRow(t('gen.appealPoints'), concept.appeal)); }
        if (concept.size) { info.appendChild(infoRow(t('gen.recommendedSize'), concept.size)); }
        if (concept.axis) {
          info.appendChild(infoRow(t('gen.appealAxis'), concept.axis));
          texts.push(t('gen.appealAxis') + ': ' + concept.axis);
        }
        if (!info.childNodes.length) {
          info.appendChild(infoRow(t('gen.kvConcept'), t('gen.sec.defaultBody')));
        }
        card.appendChild(info);

        var row2 = el('div', 'row row--2');
        row2.appendChild(button('btn btn--secondary btn--block', t('common.copy'), function () {
          copyText([generation.headline || '', generation.body_text || '', concept.cta || '', concept.axis || '']
            .filter(function (line) { return !!line; }).join('\n'));
        }));
        row2.appendChild(button('btn btn--text btn--block', t('generate.editDesign'), function () {
          rememberGeneration(generation.id);
          go('S14', { id: projectId, gen: generation.id });
        }));
        card.appendChild(row2);
        container.appendChild(card);
      });

      var all = el('div', 'stack stack--tight');
      all.appendChild(button('btn btn--secondary btn--block', t('gen.copyAll'), function () {
        copyText(texts.join('\n'));
      }));
      all.appendChild(button('btn btn--secondary btn--block', t('gen.downloadTxt'), function () {
        downloadText(texts.join('\n'), safeFileName((data.project && data.project.project_name) || 'ad') + '_ads.txt');
      }));
      container.appendChild(all);
    }

    /* ---- LINEコンテンツタブ（リッチメニュー・リッチメッセージ・あいさつ・メッセージ） ---- */
    function paintLineTab(container) {
      var rows = data.buckets.line || [];
      if (!rows.length) {
        emptyForTab(container, t('generate.lineContent'));
        return;
      }

      var subTabs = el('div', 'tabs');
      subTabs.setAttribute('role', 'tablist');
      LINE_SUBS.forEach(function (sub) {
        var isActive = view.lineSub === sub.key;
        var item = button('tabs__item' + (isActive ? ' tabs__item--active' : ''), t(sub.labelKey), function () {
          view.lineSub = sub.key;
          paint();
        });
        item.setAttribute('role', 'tab');
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        subTabs.appendChild(item);
      });
      container.appendChild(subTabs);

      var current = rows.filter(function (row) { return normalizeLineSub(row.sub_type) === view.lineSub; });
      if (!current.length) {
        var subLabel = t('generate.message');
        LINE_SUBS.forEach(function (sub) { if (sub.key === view.lineSub) { subLabel = t(sub.labelKey); } });
        emptyForTab(container, subLabel);
        return;
      }

      current.forEach(function (generation) {
        var concept = asObject(generation.creative_concept);
        var card = el('section', 'section');
        card.appendChild(el('h3', 'section__title', generation.headline || t('generate.lineContent')));

        if (view.lineSub === 'rich_menu') {
          var layout = concept.layout || asObject(concept.rich_menu_layout).layout || '2 × 3';
          card.appendChild(infoRow(t('gen.richMenuLayout'), layout));
          var cells = asArray(concept.cells);
          if (cells.length) {
            var cellList = el('div', 'list');
            cells.forEach(function (cell, index) {
              var row = el('div', 'list-row');
              var bodyBox = el('div', 'list-row__body');
              bodyBox.appendChild(el('span', 'list-row__title', fill(t('gen.cellLabel'), { n: index + 1 })));
              bodyBox.appendChild(el('span', 'list-row__sub clamp-2',
                typeof cell === 'string' ? cell : ((cell && (cell.label || cell.text)) || '')));
              row.appendChild(bodyBox);
              cellList.appendChild(row);
            });
            card.appendChild(cellList);
          }
          if (concept.imageConcept) { card.appendChild(infoRow(t('gen.imageConcept'), concept.imageConcept)); }
        }

        var text = String(generation.body_text || '');
        var limit = LINE_LIMITS[view.lineSub] || 500;
        card.appendChild(el('pre', 'code-block', text || t('gen.sec.defaultBody')));

        var countRow = el('div', 'row row--between');
        countRow.appendChild(el('span', 'counter' + (text.length > limit ? ' counter--over' : ''),
          fill(t('gen.charCount'), { n: text.length }) + '／' + fill(t('gen.charLimit'), { max: limit })));
        if (text.length > limit) {
          countRow.appendChild(el('span', 'badge badge--warn', t('gen.overLimitBadge')));
        }
        card.appendChild(countRow);
        if (text.length > limit) {
          var warn = el('div', 'warn-box');
          warn.appendChild(el('p', 't-note', t('generate.charLimitWarning')));
          card.appendChild(warn);
        }

        card.appendChild(button('btn btn--secondary btn--block', t('common.copy'), function () {
          copyText(text);
        }));
        container.appendChild(card);
      });
    }

    /* ---- その他（content_type を判定できなかった生成物） ---- */
    function paintOtherTab(container) {
      var rows = data.buckets.other || [];
      if (!rows.length) {
        emptyForTab(container, t('gen.tabOther'));
        return;
      }
      rows.forEach(function (generation) {
        var card = el('section', 'section');
        card.appendChild(el('h3', 'section__title', generation.headline || t('gen.tabOther')));
        card.appendChild(el('p', 't-note', fill(t('gen.unknownType'), { type: String(generation.content_type || '') })));
        if (generation.body_text) {
          card.appendChild(el('pre', 'code-block', String(generation.body_text)));
          card.appendChild(button('btn btn--secondary btn--block', t('common.copy'), function () {
            copyText(String(generation.body_text));
          }));
        }
        container.appendChild(card);
      });
    }

    /* ---- 画面の描き直し ---- */
    /* 結果を見ているあいだも、生成が続いていることと、新しくできた件数を出す。
       これが無いと、途中で見に来た人には「これで全部」に見えてしまう */
    function runElapsed() {
      var sec = Math.max(0, Math.round((Date.now() - run.startedAt) / 1000));
      return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    }

    /* 帯だけを差し替える。画面ごと作り直すと、開いていたタブや
       スクロール位置を失って、読んでいた場所へ戻れなくなる */
    function refreshBanner() {
      var old = root.querySelector('.run-banner');
      if (!old) { return; }
      var next = runBanner();
      if (next) { old.replaceWith(next); } else { old.remove(); }
    }

    function runBanner() {
      if (!run.active) { return null; }
      var box = el('div', 'note-box run-banner');
      box.appendChild(el('span', 'progress__label',
        fill(t('gen.generatingCount'), { done: run.done, total: run.total })
        + '　' + fill(t('gen.runElapsed'), { t: runElapsed() })));
      if (run.fresh > 0) {
        box.appendChild(button('btn btn--secondary btn--sm',
          fill(t('gen.runFresh'), { n: run.fresh }), function () {
            run.fresh = 0;
            load();
          }));
      }
      return box;
    }

    function paint() {
      clear(root);
      var screen = el('div', 'screen');

      var head = el('header', 'screen__head');
      var banner = runBanner();
      if (banner) { screen.insertBefore(banner, screen.firstChild); }
      head.appendChild(el('h2', 'screen__title', t('generate.title')));
      head.appendChild(el('p', 'screen__lead', t('generate.completed')));
      var competitors = data.report ? asArray(data.report.competitor_urls).length : 0;
      if (competitors > 0) {
        head.appendChild(el('p', 't-note', fill(t('generate.reflectedNote'), { count: competitors })));
      }
      screen.appendChild(head);

      if (!data.generations.length) {
        var emptyBox = el('div', 'empty');
        emptyBox.appendChild(el('p', 'empty__text', t('generate.empty')));
        emptyBox.appendChild(button('btn btn--primary', t('creditConfirm.runGenerate'), function () {
          go('S12', { id: projectId });
        }));
        screen.appendChild(emptyBox);
        screen.appendChild(footerActions());
        root.appendChild(screen);
        return;
      }

      /* 何を見ているか（層・成果物）を先に決めてから中身に入る。
         プレビューの下に置くと、絞り込みがあること自体に気づけない */
      /* ターゲット層の絞り込み。層を分けて作っているときだけ出す */
      if (data.targets && data.targets.length) {
        var targetRow = el('div', 'chips');
        ['all'].concat(data.targets).forEach(function (label) {
          var on = view.target === label;
          var chip = button('chip' + (on ? ' chip--selected' : ''),
            label === 'all' ? t('gen.targetAll') : label, function () {
              view.target = label;
              fillBuckets();
              paint();
            });
          chip.setAttribute('aria-pressed', on ? 'true' : 'false');
          targetRow.appendChild(chip);
        });
        screen.appendChild(el('span', 'field__label', t('gen.targetFilter')));
        screen.appendChild(targetRow);
      }

      /* タブ */
      var tabsRow = el('div', 'tabs');
      tabsRow.setAttribute('role', 'tablist');
      var tabList = TABS.slice();
      if (data.buckets.other && data.buckets.other.length) {
        tabList.push({ key: 'other', type: null, labelKey: 'gen.tabOther' });
      }
      tabList.forEach(function (tab) {
        var isActive = view.tab === tab.key;
        var item = button('tabs__item' + (isActive ? ' tabs__item--active' : ''), t(tab.labelKey), function () {
          view.tab = tab.key;
          paint();
        });
        item.setAttribute('role', 'tab');
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tabsRow.appendChild(item);
      });
      screen.appendChild(tabsRow);


      /* プレビューは1台ずつ。タブか左右の矢印で PC とスマホを行き来する */
      var target = previewTarget();
      var previewSection = el('section', 'section');
      var previewHead = el('div', 'section__head');
      var isPhone = view.device === 'phone';
      previewHead.appendChild(el('h3', 'section__title',
        isPhone ? t('generate.mobilePreview') : t('generate.pcPreview')));
      previewHead.appendChild(el('span', 't-note', isPhone ? t('gen.phoneSize') : t('gen.pcSize')));
      previewSection.appendChild(previewHead);

      if (target) {
        var html = htmlOf(target, false);

        var switcher = el('div', 'tabs');
        switcher.setAttribute('role', 'tablist');
        [['pc', 'generate.pcPreview'], ['phone', 'generate.mobilePreview']].forEach(function (pair) {
          var on = view.device === pair[0];
          var tab = button('tabs__item' + (on ? ' tabs__item--active' : ''), t(pair[1]), function () {
            view.device = pair[0];
            paint();
          });
          tab.setAttribute('role', 'tab');
          tab.setAttribute('aria-selected', on ? 'true' : 'false');
          switcher.appendChild(tab);
        });
        previewSection.appendChild(switcher);

        var stage = el('div', 'mock-stage');
        var prev = button('mock-stage__arrow', '‹', function () {
          view.device = isPhone ? 'pc' : 'phone';
          paint();
        });
        prev.setAttribute('aria-label', isPhone ? t('generate.pcPreview') : t('generate.mobilePreview'));
        stage.appendChild(prev);

        stage.appendChild(mockCard(view.device, html,
          isPhone ? t('generate.mobilePreview') + ' ' + t('gen.phoneSize')
                  : t('generate.pcPreview') + ' ' + t('gen.pcSize')));

        var next = button('mock-stage__arrow', '›', function () {
          view.device = isPhone ? 'pc' : 'phone';
          paint();
        });
        next.setAttribute('aria-label', isPhone ? t('generate.pcPreview') : t('generate.mobilePreview'));
        stage.appendChild(next);
        previewSection.appendChild(stage);
        previewSection.appendChild(el('p', 't-note', t('gen.previewScroll')));
        previewSection.appendChild(el('p', 't-note', fill(t('gen.previewOf'), { name: typeLabel(target.__type) })));
        previewSection.appendChild(el('p', 't-note', t('gen.previewNoteInApp')));
        previewSection.appendChild(button('btn btn--primary btn--block', t('generate.expand'), function () {
          rememberGeneration(target.id);
          go('S15', { id: projectId, gen: target.id });
        }));
      } else {
        var noPreview = el('div', 'empty');
        noPreview.appendChild(el('p', 'empty__text', t('gen.previewNone')));
        noPreview.appendChild(button('btn btn--primary', t('creditConfirm.runGenerate'), function () {
          go('S12', { id: projectId });
        }));
        previewSection.appendChild(noPreview);
      }

      var pair = el('div', 'row row--2');
      pair.appendChild(button('btn btn--secondary btn--block', t('generate.viewReport'), function () {
        go('S11', { id: projectId, report: data.report ? data.report.id : '' });
      }));
      pair.appendChild(button('btn btn--secondary btn--block', t('generate.editDesign'), function () {
        var editTarget = target || data.generations[0];
        if (!editTarget) {
          toast(t('gen.editTargetMissing'), 'danger');
          return;
        }
        rememberGeneration(editTarget.id);
        go('S14', { id: projectId, gen: editTarget.id });
      }));
      previewSection.appendChild(pair);
      screen.appendChild(previewSection);

      /* タブの中身 */
      var body = el('div', 'stack stack--group');
      if (view.tab === 'cf') { paintLpTab(body, data.buckets.cf, TYPE.CF); }
      else if (view.tab === 'own') { paintLpTab(body, data.buckets.own, TYPE.OWN); }
      else if (view.tab === 'kvad') { paintKvAdTab(body); }
      else if (view.tab === 'line') { paintLineTab(body); }
      else { paintOtherTab(body); }
      screen.appendChild(body);

      screen.appendChild(assetSection());

      /* 残高はヘッダーに常時出ているので、ここには置かない */

      screen.appendChild(footerActions());
      root.appendChild(screen);
      fitAllFrames();
    }

    /* ---- S12（生成プロンプトの確認）から来た直後の生成実行 ----
       generateRequest は一度きり読んで消す（戻る・再訪で二重生成しないため）。
       消費はここでは行わない。generate-content Edge Function が LLM 成功後に
       消費+保存を1トランザクションで行うので、失敗時にクレジットは動かない。 */
    function runGeneration(confirmed) {
      var features = (confirmed.features || []).filter(function (f) { return f && f.feature_key; });
      if (!features.length) { load(); return; }

      /* 作るのは「選んだ層 × 成果物」の総当たり。層を選んでいない古い呼び方でも
         動くように、空の層をひとつ置いて1周だけ回す */
      var targets = (confirmed.targets || []).filter(Boolean);
      if (!targets.length) { targets = ['']; }
      var jobs = [];
      targets.forEach(function (target) {
        features.forEach(function (feature) {
          jobs.push({ target: target, feature: feature });
        });
      });
      if (!Api.generations || typeof Api.generations.generate !== 'function') {
        console.error('[screens-generate] Api.generations.generate がありません。api.js を確認してください。');
        load();
        return;
      }

      var failures = [];
      var made = 0;

      function nameOf(job) {
        /* 名前が登録されていない機能があり、内部キー（own_lp など）が
           そのまま画面に出ていた。共通の辞書で日本語名に直す */
        var key = job.feature.feature_key;
        var named = t('feature.' + key);
        var base = job.feature.feature_name
          || (named === 'feature.' + key ? key : named);
        return job.target ? job.target + '　' + base : base;
      }

      /* ---- 進み具合の表示 ----
         骨組み（showSkeleton）だけを出していたので、動いているのか
         止まっているのか画面から分からなかった。1件が数分かかるうえ、
         トーストは消えるので残らない。何件中の何件目で、いま何を
         作っていて、それぞれ何分経ったかを、置いたままにする */
      var startedAll = Date.now();
      jobs.forEach(function (one) { one.state = 'queued'; one.startedAt = 0; });
      run.active = true; run.done = 0; run.total = jobs.length;
      run.startedAt = startedAll; run.fresh = 0; run.viewing = false;

      function minutesText(ms) {
        var sec = Math.max(0, Math.round(ms / 1000));
        return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
      }

      function stateBadge(job) {
        if (job.state === 'done') { return el('span', 'badge badge--ok', t('gen.runDone')); }
        if (job.state === 'failed') { return el('span', 'badge badge--danger', t('gen.runFailed')); }
        if (job.state === 'timeout') { return el('span', 'badge badge--warn', t('gen.runTimeout')); }
        if (job.state === 'running') { return el('span', 'badge badge--ok', t('gen.runRunning')); }
        return el('span', 'badge badge--mute', t('gen.runQueued'));
      }

      function paintRun() {
        /* 結果を見ているときに描き直すと、読んでいた画面を奪ってしまう。
           そのときは上の帯（runBanner）だけが数字を伝える */
        if (run.viewing) { return; }
        clear(root);
        var screen = el('div', 'screen');
        var card = el('section', 'card');

        var head = el('div', 'section__head');
        head.appendChild(el('h1', 'section__title', t('gen.runTitle')));
        head.appendChild(el('span', 'progress__label',
          fill(t('gen.runElapsed'), { t: minutesText(Date.now() - startedAll) })));
        card.appendChild(head);

        var pct = Math.round((done / jobs.length) * 100);
        card.appendChild(el('p', 'progress__label',
          fill(t('gen.generatingCount'), { done: done, total: jobs.length }) + '　' + pct + '%'));
        var bar = el('div', 'progress');
        var fillNode = el('div', 'progress__bar');
        fillNode.style.width = pct + '%';
        bar.appendChild(fillNode);
        card.appendChild(bar);

        var list = el('div', 'stack stack--tight');
        jobs.forEach(function (one) {
          var row = el('div', 'info-row');
          var left = el('span', 'info-row__key', nameOf(one));
          row.appendChild(left);
          var right = el('span', 'chips');
          if (one.state === 'running') {
            right.appendChild(el('span', 'progress__label', minutesText(Date.now() - one.startedAt)));
          }
          right.appendChild(stateBadge(one));
          row.appendChild(right);
          list.appendChild(row);
        });
        card.appendChild(list);

        card.appendChild(el('p', 't-note', t('gen.runNote')));
        /* できたものは、全部そろう前に見られるようにする。
           層 × 成果物ぶん並ぶので、待つと20分を超える */
        if (run.done > 0) {
          card.appendChild(button('btn btn--primary btn--block',
            fill(t('gen.runSeeDone'), { n: run.done }), function () {
              run.viewing = true;
              run.fresh = 0;
              load();
            }));
        }
        screen.appendChild(card);
        root.appendChild(screen);
      }

      /* 経過時間だけを1秒ごとに書き換える。全部作り直すと重い */
      var runTimer = setInterval(paintRun, 1000);
      function stopRunPaint() { clearInterval(runTimer); }

      /* 開発モード（サーバーに ANTHROPIC_API_KEY が無い間）は {queued:true} が返る。
         ジョブの完了をポーリングして待つ。待ちきれなくても、生成物は次に
         S13 を開いたときに反映されている（ジョブは破棄されない）。 */
      function waitForJob(jobId) {
        var POLL_MS = 5000;
        var LIMIT_MS = 10 * 60 * 1000;
        var startedAt = Date.now();
        return new Promise(function (resolve) {
          function tick() {
            if (Date.now() - startedAt > LIMIT_MS) { resolve('timeout'); return; }
            Api.generationJobs.get(jobId).then(function (job) {
              if (job && job.status === 'done') { resolve('done'); return; }
              if (job && job.status === 'failed') { resolve('failed'); return; }
              setTimeout(tick, POLL_MS);
            }, function (err) {
              console.error('[screens-generate] ジョブの確認に失敗しました。続けて確認します', err);
              setTimeout(tick, POLL_MS);
            });
          }
          setTimeout(tick, POLL_MS);
        });
      }

      /* 1件ずつ順番に待つと、層 × 成果物のぶんだけ待ち時間が積み上がる。
         まとめて出して同時に走らせ、全部の結果が出そろってから画面を戻す。
         同時に走らせる数は絞る（サーバー側の生成が詰まらないように）。 */
      var RUNNING_MAX = 4;
      var done = 0;

      function progress() { paintRun(); }

      function runOne(job) {
        job.state = 'running';
        job.startedAt = Date.now();
        paintRun();
        return Api.generations.generate({
          project_id: String(projectId),
          feature_key: job.feature.feature_key,
          target: job.target || null,
          report_id: confirmed.reportId || null,
          lang: (App.getLang && App.getLang()) || 'ja'
        }).then(function (result) {
          if (result && result.queued) {
            return waitForJob(result.job_id).then(function (outcome) {
              job.state = outcome === 'done' ? 'done'
                : (outcome === 'failed' ? 'failed' : 'timeout');
              if (outcome === 'done') { made += 1; }
              else if (outcome === 'failed') { failures.push({ job: job, err: null }); }
              else { toast(t('gen.queuedTimeout'), 'info'); }
            });
          }
          job.state = 'done';
          made += 1;
        }, function (err) {
          console.error('[screens-generate] 生成に失敗しました', job.target, job.feature.feature_key, err);
          job.state = 'failed';
          failures.push({ job: job, err: err });
        }).then(function () {
          done += 1;
          run.done = done;
          if (job.state === 'done') { run.fresh += 1; }
          progress();
          /* 結果を見ている最中なら、上の帯の数字だけを書き換える */
          if (run.viewing) { refreshBanner(); }
        });
      }

      function finish() {
        stopRunPaint();
        run.active = false;
        if (run.viewing) { load(); return; }
        if (made) { toast(t('gen.generateDone'), 'success'); }
        failures.forEach(function (failed) {
          var key = (failed.err && failed.err.status === 501) ? 'gen.generateNotReady' : 'gen.generateFailed';
          if (failed.err && failed.err.code === 'insufficient') {
            toast(errorMessage(failed.err, 'gen.generateFailed'), 'danger');
          } else {
            toast(fill(t(key), { name: nameOf(failed.job) }), 'danger');
          }
        });
        load();
      }

      var next = 0;
      var live = 0;

      function pump() {
        while (live < RUNNING_MAX && next < jobs.length) {
          var job = jobs[next];
          next += 1;
          live += 1;
          runOne(job).then(function () {
            live -= 1;
            if (next < jobs.length) { pump(); return; }
            if (!live) { finish(); }
          });
        }
        if (!live && next >= jobs.length) { finish(); }
      }

      progress();
      pump();
    }

    var requested = App.state && App.state.generateRequest;
    if (requested && String(requested.projectId) === String(projectId)) {
      App.state.generateRequest = null;
      runGeneration(requested);
    } else {
      load();
    }
  }

  /* =========================================================
     7. S14 デザイン編集（レイヤー一覧・テキスト／カラー／フォント）
     ========================================================= */

  function relativeTime(stamp) {
    if (!stamp) { return t('gen.notSavedYet'); }
    var diff = Math.round((Date.now() - stamp) / 1000);
    if (diff < 5) { return t('gen.justNow'); }
    if (diff < 60) { return fill(t('gen.secondsAgo'), { n: diff }); }
    return fill(t('gen.minutesAgo'), { n: Math.round(diff / 60) });
  }

  function renderDesign(root, params) {
    mounted = { id: 'S14', root: root, params: params };
    setHeader(t('design.title'), true);

    var projectId = resolveProjectId(params);
    var generationId = (params && params.gen) ? String(params.gen) : (Api && Api.storage ? Api.storage.get('generationId') : '');
    var state = {
      project: null,
      generation: null,
      sections: [],
      design: DEFAULT_DESIGN,
      selected: 0,
      dirty: false,
      savedAt: 0,
      saving: false
    };
    var timer = null;
    var statusNode = null;

    if (!projectId) {
      showErrorScreen(root, t('gen.noProject'), null,
        button('btn btn--primary btn--block', t('projectDetail.backToDashboard'), function () { go('S3'); }));
      return;
    }
    if (!Api || !Api.generations) {
      showErrorScreen(root, t('gen.apiMissing'), function () { window.location.reload(); });
      return;
    }

    function pickGeneration() {
      if (generationId) {
        return Api.generations.get(generationId).catch(function (err) {
          console.error('[screens-generate] 指定された生成物を読めなかったため、プロジェクトの最新の生成物を使います', err);
          return null;
        });
      }
      return Promise.resolve(null);
    }

    function latestGeneration() {
      return Api.generations.list({
        eq: { projects_id: String(projectId) },
        order: 'created_at.desc',
        limit: 20
      }).then(function (rows) {
        var list = rows || [];
        var lp = null;
        list.forEach(function (row) {
          if (!lp && isLp(normalizeType(row.content_type))) { lp = row; }
        });
        return lp || list[0] || null;
      });
    }

    function load() {
      clearBanner();
      showSkeleton(root);
      Api.projects.get(projectId).then(function (project) {
        state.project = project;
        return pickGeneration();
      }).then(function (generation) {
        return generation || latestGeneration();
      }).then(function (generation) {
        if (!generation) {
          showErrorScreen(root, t('gen.editTargetMissing'), null,
            button('btn btn--primary btn--block', t('creditConfirm.runGenerate'), function () { go('S12', { id: projectId }); }));
          return;
        }
        state.generation = generation;
        generationId = String(generation.id);
        rememberGeneration(generationId);
        state.sections = sectionsOf(generation, state.project);
        state.design = designOf(generation);
        var wanted = (params && params.section !== undefined) ? Number(params.section) : 0;
        state.selected = (wanted >= 0 && wanted < state.sections.length) ? wanted : 0;
        startAutoSave();
        paint();
      }).catch(function (err) {
        console.error('[screens-generate] デザイン編集の読み込みに失敗しました', err);
        showErrorScreen(root, errorMessage(err, 'generate.loadFailed'), load);
      });
    }

    /* ---- 保存（自動保存と明示保存の入口はここだけ） ---- */
    function patchBody() {
      var concept = asObject(state.generation.creative_concept);
      concept.design = state.design;
      var first = state.sections[0] || {};
      return {
        sections: state.sections,
        creative_concept: concept,
        headline: first.title || state.generation.headline || '',
        body_text: first.body || state.generation.body_text || '',
        /* ここで保存したHTMLは、以後どの画面もそのまま出す。
           素材を渡さずに保存すると、絵の無いLPが焼き付いてしまい、
           プレビューも拡大表示もダウンロードも文字だけになる */
        generated_html: buildHtml({
          title: state.generation.headline
            || (state.project && state.project.project_name) || '',
          sections: state.sections,
          assets: assetPoolOf(state.project),
          design: state.design,
          type: normalizeType(state.generation.content_type),
          lineUrl: state.generation.line_button_url,
          lineStyle: lineStyleOf(state.generation),
          linePosition: state.generation.line_button_position,
          forDownload: true
        })
      };
    }

    function save() {
      if (state.saving) { return Promise.resolve(null); }
      state.saving = true;
      updateStatus();
      return Api.generations.update(state.generation.id, patchBody()).then(function (updated) {
        state.saving = false;
        state.dirty = false;
        state.savedAt = Date.now();
        if (updated) {
          updated.__type = state.generation.__type;
          state.generation = updated;
        }
        updateStatus();
        return updated;
      }, function (err) {
        state.saving = false;
        console.error('[screens-generate] 編集内容の保存に失敗しました', err);
        showBanner(errorMessage(err, 'design.saveFailed'), function () { save(); });
        toast(t('design.saveFailed'), 'danger');
        updateStatus();
        return Promise.reject(err);
      });
    }

    function startAutoSave() {
      if (timer) { window.clearInterval(timer); }
      timer = window.setInterval(function () {
        if (!document.body.contains(root) || currentScreenId() !== 'S14') {
          window.clearInterval(timer);
          timer = null;
          return;
        }
        if (state.dirty && !state.saving) { save(); }
      }, 30000);
    }

    function updateStatus() {
      if (!statusNode) { return; }
      clear(statusNode);
      if (state.saving) {
        statusNode.appendChild(el('span', 'badge badge--mute', t('gen.saving')));
        return;
      }
      if (state.dirty) {
        statusNode.appendChild(el('span', 'badge badge--warn', t('gen.unsaved')));
        return;
      }
      statusNode.appendChild(el('span', 'badge badge--ok',
        fill(t('gen.autoSavedAgo'), { time: relativeTime(state.savedAt) })));
    }

    function markDirty() {
      state.dirty = true;
      updateStatus();
    }

    function layerTypeLabel(type) {
      if (type === 'image') { return t('gen.layerImage'); }
      if (type === 'divider') { return t('gen.layerDivider'); }
      return t('gen.layerText');
    }

    function moveLayer(index, delta) {
      var next = index + delta;
      if (next < 0 || next >= state.sections.length) { return; }
      var moved = state.sections.splice(index, 1)[0];
      state.sections.splice(next, 0, moved);
      if (state.selected === index) { state.selected = next; }
      else if (state.selected === next) { state.selected = index; }
      markDirty();
      paint();
    }

    function addLayer(type) {
      state.sections.push({
        key: 'sec' + (state.sections.length + 1) + '_' + type,
        title: type === 'divider' ? '' : t('gen.newLayerName'),
        body: type === 'text' ? t('gen.sec.defaultBody') : '',
        type: type,
        image: '',
        titleColor: '',
        bodyColor: '',
        bg: ''
      });
      state.selected = state.sections.length - 1;
      markDirty();
      toast(t('gen.layerAdded'), 'success');
      paint();
    }

    function openAddLayer() {
      openSheet(t('gen.addLayerTitle'), [
        { label: t('gen.layerText'), onSelect: function () { addLayer('text'); } },
        { label: t('gen.layerImage'), note: t('gen.imageUrlHint'), onSelect: function () { addLayer('image'); } },
        { label: t('gen.layerDivider'), onSelect: function () { addLayer('divider'); } }
      ]);
    }

    /* キャンバスだけ描き直す（入力中にフォーカスが飛ばないようにする） */
    function repaintCanvas() {
      var canvas = root.querySelector('.editor-canvas');
      if (!canvas) { return; }
      canvas.style.background = state.design.bgColor;
      var nodes = canvas.querySelectorAll('.editor-node');
      var i;
      for (i = 0; i < nodes.length; i += 1) {
        var section = state.sections[i];
        if (!section) { continue; }
        var spans = nodes[i].getElementsByTagName('span');
        if (spans.length > 0) {
          spans[0].textContent = section.title || t('gen.untitledSection');
          spans[0].style.color = section.titleColor || state.design.titleColor;
          spans[0].style.fontFamily = fontStack(state.design.titleFont);
          spans[0].style.fontSize = Math.min(Number(state.design.titleSize) || 30, 26) + 'px';
        }
        if (spans.length > 1) {
          spans[1].textContent = section.body || '';
          spans[1].style.color = section.bodyColor || state.design.bodyColor;
          spans[1].style.fontFamily = fontStack(state.design.bodyFont);
          spans[1].style.fontSize = Math.min(Number(state.design.bodySize) || 16, 15) + 'px';
        }
        nodes[i].style.background = section.bg || 'transparent';
      }
    }

    function colorField(labelText, id, value, onChange) {
      var field = el('div', 'field');
      var label = el('label', 'field__label', labelText);
      label.setAttribute('for', id);
      field.appendChild(label);
      var input = document.createElement('input');
      input.type = 'color';
      input.className = 'input';
      input.id = id;
      input.value = /^#[0-9a-fA-F]{6}$/.test(String(value)) ? String(value) : '#171018';
      input.addEventListener('input', function () { onChange(input.value); });
      field.appendChild(input);
      return field;
    }

    function selectField(labelText, id, options, value, onChange) {
      var field = el('div', 'field');
      var label = el('label', 'field__label', labelText);
      label.setAttribute('for', id);
      field.appendChild(label);
      var select = document.createElement('select');
      select.className = 'select';
      select.id = id;
      options.forEach(function (option) {
        var node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        if (option.value === value) { node.selected = true; }
        select.appendChild(node);
      });
      select.addEventListener('change', function () { onChange(select.value); });
      field.appendChild(select);
      return field;
    }

    function sizeField(labelText, id, value, min, max, onChange) {
      var field = el('div', 'field');
      var label = el('label', 'field__label', labelText);
      label.setAttribute('for', id);
      field.appendChild(label);
      var input = document.createElement('input');
      input.type = 'number';
      input.className = 'input num';
      input.id = id;
      input.min = min;
      input.max = max;
      input.step = 1;
      input.value = value;
      input.addEventListener('input', function () {
        var next = Number(input.value);
        if (!next || next < min || next > max) { return; }
        onChange(next);
      });
      field.appendChild(input);
      return field;
    }

    function fontOptions() {
      return [
        { value: 'sans', label: t('gen.fontSans') },
        { value: 'gothic', label: t('gen.fontGothic') },
        { value: 'mincho', label: t('gen.fontMincho') }
      ];
    }

    function propertySection() {
      var box = el('section', 'section');
      var section = state.sections[state.selected];
      if (!section) {
        box.appendChild(el('p', 't-note', t('gen.selectLayerFirst')));
        return box;
      }

      /* テキスト */
      box.appendChild(el('h3', 'section__title', t('design.text')));

      var titleField = el('div', 'field');
      var titleLabel = el('label', 'field__label', t('gen.headingLabel'));
      titleLabel.setAttribute('for', 'layer-title');
      titleField.appendChild(titleLabel);
      var titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.className = 'input';
      titleInput.id = 'layer-title';
      titleInput.value = section.title;
      titleInput.addEventListener('input', function () {
        section.title = titleInput.value;
        markDirty();
        repaintCanvas();
      });
      titleField.appendChild(titleInput);
      box.appendChild(titleField);

      var bodyField = el('div', 'field');
      var bodyLabel = el('label', 'field__label', t('gen.bodyLabel'));
      bodyLabel.setAttribute('for', 'layer-body');
      bodyField.appendChild(bodyLabel);
      var bodyInput = document.createElement('textarea');
      bodyInput.className = 'textarea';
      bodyInput.id = 'layer-body';
      bodyInput.rows = 4;
      bodyInput.value = section.body;
      bodyInput.addEventListener('input', function () {
        section.body = bodyInput.value;
        markDirty();
        repaintCanvas();
      });
      bodyField.appendChild(bodyInput);
      box.appendChild(bodyField);

      if (section.type === 'image') {
        var imageField = el('div', 'field');
        var imageLabel = el('label', 'field__label', t('gen.imageUrl'));
        imageLabel.setAttribute('for', 'layer-image');
        imageField.appendChild(imageLabel);
        var imageInput = document.createElement('input');
        imageInput.type = 'url';
        imageInput.className = 'input';
        imageInput.id = 'layer-image';
        imageInput.value = section.image;
        imageInput.placeholder = 'https://';
        imageInput.addEventListener('input', function () {
          section.image = imageInput.value.trim();
          markDirty();
        });
        imageField.appendChild(imageInput);
        imageField.appendChild(el('p', 'field__hint', t('gen.imageUrlHint')));
        box.appendChild(imageField);
      }

      /* カラー */
      box.appendChild(el('h3', 'section__title', t('design.color')));
      box.appendChild(colorField(t('gen.headingColor'), 'color-title', section.titleColor || state.design.titleColor, function (value) {
        section.titleColor = value;
        markDirty();
        repaintCanvas();
      }));
      box.appendChild(colorField(t('gen.bodyColor'), 'color-body', section.bodyColor || state.design.bodyColor, function (value) {
        section.bodyColor = value;
        markDirty();
        repaintCanvas();
      }));
      box.appendChild(colorField(t('gen.bgColor'), 'color-bg', state.design.bgColor, function (value) {
        state.design.bgColor = value;
        markDirty();
        repaintCanvas();
      }));

      /* フォント */
      box.appendChild(el('h3', 'section__title', t('design.font')));
      box.appendChild(selectField(t('gen.headingFont'), 'font-title', fontOptions(), state.design.titleFont, function (value) {
        state.design.titleFont = value;
        markDirty();
        repaintCanvas();
      }));
      box.appendChild(selectField(t('gen.bodyFont'), 'font-body', fontOptions(), state.design.bodyFont, function (value) {
        state.design.bodyFont = value;
        markDirty();
        repaintCanvas();
      }));
      box.appendChild(sizeField(t('gen.headingSize'), 'size-title', state.design.titleSize, 18, 64, function (value) {
        state.design.titleSize = value;
        markDirty();
        repaintCanvas();
      }));
      box.appendChild(sizeField(t('gen.bodySize'), 'size-body', state.design.bodySize, 12, 28, function (value) {
        state.design.bodySize = value;
        markDirty();
        repaintCanvas();
      }));

      return box;
    }

    function goPreview() {
      function jump() {
        go('S15', { id: projectId, gen: state.generation.id, section: state.selected });
      }
      if (!state.dirty) { jump(); return; }
      save().then(jump, function () { /* 失敗はバナーとトーストで通知済み。画面は残す */ });
    }

    function paint() {
      clear(root);
      var screen = el('div', 'screen');

      var head = el('header', 'screen__head');
      head.appendChild(el('h2', 'screen__title', t('design.title')));
      head.appendChild(el('p', 'screen__lead',
        state.generation.headline || typeLabel(normalizeType(state.generation.content_type))));
      screen.appendChild(head);

      statusNode = el('div', 'chips');
      screen.appendChild(statusNode);
      updateStatus();

      /* 編集キャンバス */
      var canvasSection = el('section', 'section');
      canvasSection.appendChild(el('h3', 'section__title', t('gen.canvasTitle')));
      var canvas = el('div', 'editor-canvas');
      canvas.style.background = state.design.bgColor;
      state.sections.forEach(function (section, index) {
        var node = button('editor-node' + (index === state.selected ? ' editor-node--selected' : ''), '', function () {
          state.selected = index;
          paint();
        });
        node.style.display = 'block';
        node.style.width = '100%';
        node.style.textAlign = 'left';
        node.style.background = section.bg || 'transparent';
        node.setAttribute('aria-pressed', index === state.selected ? 'true' : 'false');

        if (section.type === 'divider') {
          node.appendChild(el('div', 'divider'));
        } else {
          var title = el('span', '', section.title || t('gen.untitledSection'));
          title.style.display = 'block';
          title.style.fontFamily = fontStack(state.design.titleFont);
          title.style.fontSize = Math.min(Number(state.design.titleSize) || 30, 26) + 'px';
          title.style.fontWeight = '600';
          title.style.lineHeight = '1.35';
          title.style.color = section.titleColor || state.design.titleColor;
          title.style.overflowWrap = 'break-word';
          node.appendChild(title);

          var body = el('span', 'clamp-2', section.body || '');
          body.style.display = 'block';
          body.style.marginTop = '8px';
          body.style.fontFamily = fontStack(state.design.bodyFont);
          body.style.fontSize = Math.min(Number(state.design.bodySize) || 16, 15) + 'px';
          body.style.lineHeight = '1.6';
          body.style.color = section.bodyColor || state.design.bodyColor;
          body.style.overflowWrap = 'break-word';
          node.appendChild(body);

          if (section.type === 'image') {
            var placeholder = el('span', 't-note', t('gen.imagePlaceholder'));
            placeholder.style.display = 'block';
            placeholder.style.marginTop = '8px';
            node.appendChild(placeholder);
          }
        }
        canvas.appendChild(node);
      });
      canvasSection.appendChild(canvas);
      canvasSection.appendChild(el('p', 't-note', t('gen.canvasHint')));
      screen.appendChild(canvasSection);

      /* レイヤー一覧 */
      var layerSection = el('section', 'section');
      var layerHead = el('div', 'section__head row row--between');
      layerHead.appendChild(el('h3', 'section__title', t('design.layers')));
      var addButton = button('icon-btn', '＋', openAddLayer);
      addButton.setAttribute('aria-label', t('design.addLayer'));
      layerHead.appendChild(addButton);
      layerSection.appendChild(layerHead);

      var list = el('div', 'list');
      state.sections.forEach(function (section, index) {
        var row = el('div', 'list-row' + (index === state.selected ? ' list-row--selected' : ''));
        var select = button('list-row__body', '', function () {
          state.selected = index;
          paint();
        });
        select.style.textAlign = 'left';
        select.appendChild(el('span', 'list-row__title clamp-1', section.title || t('gen.untitledSection')));
        select.appendChild(el('span', 'list-row__sub', layerTypeLabel(section.type)));
        row.appendChild(select);

        var up = button('icon-btn', '↑', function () { moveLayer(index, -1); });
        up.setAttribute('aria-label', t('gen.moveUp'));
        up.disabled = index === 0;
        row.appendChild(up);

        var down = button('icon-btn', '↓', function () { moveLayer(index, 1); });
        down.setAttribute('aria-label', t('gen.moveDown'));
        down.disabled = index === state.sections.length - 1;
        row.appendChild(down);

        list.appendChild(row);
      });
      layerSection.appendChild(list);
      screen.appendChild(layerSection);

      /* テキスト・カラー・フォント */
      screen.appendChild(propertySection());

      /* 操作 */
      var actions = el('div', 'row row--2');
      actions.appendChild(button('btn btn--secondary btn--block', t('design.checkRealSize'), goPreview));
      actions.appendChild(button('btn btn--primary btn--block', t('design.saveAndReturn'), function () {
        save().then(function () {
          toast(t('common.saved'), 'success');
          go('S13', { id: projectId });
        }, function () { /* 失敗はバナーとトーストで通知済み */ });
      }));
      screen.appendChild(actions);

      screen.appendChild(button('btn btn--danger btn--block', t('gen.deleteLayer'), function () {
        var section = state.sections[state.selected];
        if (!section) { return; }
        if (state.sections.length <= 1) {
          toast(t('gen.lastLayer'), 'danger');
          return;
        }
        confirmDialog({
          title: t('gen.deleteLayer'),
          body: fill(t('gen.deleteLayerBody'), { name: section.title || t('gen.untitledSection') }),
          confirmLabel: t('common.delete'),
          danger: true,
          onConfirm: function () {
            state.sections.splice(state.selected, 1);
            state.selected = Math.max(0, state.selected - 1);
            markDirty();
            toast(t('gen.layerDeleted'), 'success');
            paint();
          }
        });
      }));

      root.appendChild(screen);
    }

    load();
  }

  /* =========================================================
     8. S15 デバイスプレビュー拡大（PC 1440px / スマホ 375px）
     ========================================================= */

  function renderPreview(root, params) {
    mounted = { id: 'S15', root: root, params: params };
    setHeader(t('preview.title'), true);

    var projectId = resolveProjectId(params);
    var generationId = (params && params.gen) ? String(params.gen) : (Api && Api.storage ? Api.storage.get('generationId') : '');
    var state = {
      project: null,
      generation: null,
      sections: [],
      design: DEFAULT_DESIGN,
      device: 'pc',
      current: Number(params && params.section) || 0
    };
    var stage = null;
    var frame = null;
    var showingLabel = null;

    if (!projectId) {
      showErrorScreen(root, t('gen.noProject'), null,
        button('btn btn--primary btn--block', t('projectDetail.backToDashboard'), function () { go('S3'); }));
      return;
    }
    if (!Api || !Api.generations) {
      showErrorScreen(root, t('gen.apiMissing'), function () { window.location.reload(); });
      return;
    }

    function load() {
      clearBanner();
      showSkeleton(root);
      Api.projects.get(projectId).then(function (project) {
        state.project = project;
        if (generationId) {
          return Api.generations.get(generationId).catch(function (err) {
            console.error('[screens-generate] 指定された生成物を読めなかったため、最新の生成物を使います', err);
            return null;
          });
        }
        return null;
      }).then(function (generation) {
        if (generation) { return generation; }
        return Api.generations.list({
          eq: { projects_id: String(projectId) },
          order: 'created_at.desc',
          limit: 20
        }).then(function (rows) {
          var list = rows || [];
          var lp = null;
          list.forEach(function (row) {
            if (!lp && isLp(normalizeType(row.content_type))) { lp = row; }
          });
          return lp || list[0] || null;
        });
      }).then(function (generation) {
        if (!generation) {
          showErrorScreen(root, t('generate.empty'), null,
            button('btn btn--primary btn--block', t('creditConfirm.runGenerate'), function () { go('S12', { id: projectId }); }));
          return;
        }
        state.generation = generation;
        generationId = String(generation.id);
        rememberGeneration(generationId);
        state.sections = sectionsOf(generation, state.project);
        state.design = designOf(generation);
        if (state.current < 0 || state.current >= state.sections.length) { state.current = 0; }
        paint();
      }).catch(function (err) {
        console.error('[screens-generate] 実寸プレビューの読み込みに失敗しました', err);
        showErrorScreen(root, errorMessage(err, 'generate.loadFailed'), load);
      });
    }

    function previewHtml() {
      return lpHtmlOf(state.generation, state.project, false);
    }

    /* iframeの高さを中身に合わせる（外側の .preview-stage がスクロールする） */
    function resizeFrame() {
      if (!frame) { return; }
      try {
        var doc = frame.contentDocument;
        if (!doc || !doc.body) { return; }
        var height = Math.max(doc.body.scrollHeight, doc.documentElement ? doc.documentElement.scrollHeight : 0);
        frame.style.height = height + 'px';
      } catch (e) {
        console.error('[screens-generate] プレビューの高さを測れませんでした', e);
      }
    }

    function jumpTo(index, scroll) {
      state.current = index;
      if (showingLabel) {
        showingLabel.textContent = fill(t('gen.showingSection'), {
          name: (state.sections[index] && state.sections[index].title) || t('gen.untitledSection')
        });
      }
      var rows = root.querySelectorAll('.list-row');
      var i;
      for (i = 0; i < rows.length; i += 1) {
        rows[i].classList.toggle('list-row--selected', i === index);
      }
      if (!scroll || !frame || !stage) { return; }
      try {
        var doc = frame.contentDocument;
        if (!doc) { throw new Error('contentDocument を読めません'); }
        var target = doc.getElementById('sec-' + (index + 1));
        if (!target) { throw new Error('セクション要素が見つかりません: sec-' + (index + 1)); }
        stage.scrollTop = target.offsetTop;
      } catch (e) {
        console.error('[screens-generate] プレビューのスクロールに失敗しました', e);
        toast(t('gen.jumpFailed'), 'danger');
      }
    }

    function paint() {
      clear(root);
      var screen = el('div', 'screen');

      var head = el('header', 'screen__head');
      head.appendChild(el('h2', 'screen__title', t('preview.title')));
      head.appendChild(el('p', 'screen__lead',
        state.generation.headline || typeLabel(normalizeType(state.generation.content_type))));
      screen.appendChild(head);

      /* PC／スマホ切替 */
      var deviceChips = el('div', 'chips');
      [
        { key: 'pc', label: t('gen.devicePc') },
        { key: 'phone', label: t('gen.devicePhone') }
      ].forEach(function (item) {
        var chip = button('chip' + (state.device === item.key ? ' chip--selected' : ''), item.label, function () {
          if (state.device === item.key) { return; }
          state.device = item.key;
          paint();
        });
        chip.setAttribute('aria-pressed', state.device === item.key ? 'true' : 'false');
        deviceChips.appendChild(chip);
      });
      screen.appendChild(deviceChips);

      /* プレビュー画面（実寸） */
      stage = el('div', 'preview-stage ' + (state.device === 'phone' ? 'preview-stage--phone' : 'preview-stage--pc'));
      frame = document.createElement('iframe');
      frame.className = 'preview-stage__inner';
      frame.setAttribute('title', t('preview.title'));
      /* スクリプトは動かさず、同一オリジンだけ許してセクション位置を測る */
      frame.setAttribute('sandbox', 'allow-same-origin');
      frame.srcdoc = previewHtml();
      frame.addEventListener('load', function () {
        resizeFrame();
        jumpTo(state.current, false);
      });
      stage.appendChild(frame);
      screen.appendChild(stage);
      screen.appendChild(el('p', 't-note', t('gen.previewScrollHint')));
      screen.appendChild(el('p', 't-note', t('gen.previewNoteInApp')));

      showingLabel = el('p', 'section__desc', fill(t('gen.showingSection'), {
        name: (state.sections[state.current] && state.sections[state.current].title) || t('gen.untitledSection')
      }));
      screen.appendChild(showingLabel);

      /* セクション一覧（タップで該当位置までスクロール） */
      var listSection = el('section', 'section');
      listSection.appendChild(el('h3', 'section__title', t('preview.sections')));
      if (!state.sections.length) {
        var box = el('div', 'empty');
        box.appendChild(el('p', 'empty__text', t('gen.noSections')));
        box.appendChild(button('btn btn--primary', t('design.title'), function () {
          go('S14', { id: projectId, gen: state.generation.id });
        }));
        listSection.appendChild(box);
      } else {
        var list = el('div', 'list');
        state.sections.forEach(function (section, index) {
          var row = button('list-row' + (index === state.current ? ' list-row--selected' : ''), '', function () {
            jumpTo(index, true);
          });
          var body = el('div', 'list-row__body');
          body.appendChild(el('span', 'list-row__title clamp-1', section.title || t('gen.untitledSection')));
          if (section.body) { body.appendChild(el('span', 'list-row__sub clamp-1', section.body)); }
          row.appendChild(body);
          row.appendChild(el('span', 'list-row__meta num', String(index + 1)));
          list.appendChild(row);
        });
        listSection.appendChild(list);
      }
      screen.appendChild(listSection);

      var actions = el('div', 'row row--2');
      actions.appendChild(button('btn btn--secondary btn--block', t('preview.backToGenerate'), function () {
        go('S13', { id: projectId });
      }));
      actions.appendChild(button('btn btn--primary btn--block', t('preview.editThis'), function () {
        go('S14', { id: projectId, gen: state.generation.id, section: state.current });
      }));
      screen.appendChild(actions);

      root.appendChild(screen);
    }

    load();
  }

  /* =========================================================
     9. 言語切替への追随と画面登録
     ========================================================= */

  var mounted = { id: null, root: null, params: null };

  window.addEventListener('elpiya:locale-changed', function () {
    if (!mounted.id || !mounted.root) { return; }
    if (!document.body.contains(mounted.root)) { return; }
    if (currentScreenId() !== mounted.id) { return; }
    if (mounted.id === 'S13') { renderGenerate(mounted.root, mounted.params); }
    if (mounted.id === 'S14') { renderDesign(mounted.root, mounted.params); }
    if (mounted.id === 'S15') { renderPreview(mounted.root, mounted.params); }
  });

  /* 画面登録（第2引数は必ず { render: 関数 }） */
  App.registerScreen('S13', {
    render: function (root, params) { renderGenerate(root, params); }
  });

  App.registerScreen('S14', {
    render: function (root, params) { renderDesign(root, params); }
  });

  App.registerScreen('S15', {
    render: function (root, params) { renderPreview(root, params); }
  });

})(window, document);
