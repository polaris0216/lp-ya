/*
 * i18n.js
 * エルピーヤ の多言語辞書と言語切替エンジン
 *
 * 契約:
 *   window.t(key, params)         現在の言語で翻訳文字列を返す。keyが辞書に無ければキー自体を返しconsole.warnに記録する
 *   window.I18N.t(key, params)    上と同じ
 *   window.I18N.apply(root)       root配下の data-i18n / data-i18n-aria / data-i18n-placeholder 属性を一括で辞書の値に差し替える。root省略時はdocument全体
 *   window.I18N.setLocale(code)   言語をjaかenかkoに切り替えて端末(localStorage)に保存し、document全体へ再適用したうえで elpiya:locale-changed イベントを発火する
 *   window.I18N.getLocale()       現在の言語コードを返す
 *   window.I18N.locales           対応言語コードの配列 [ja, en, ko]
 *   window.I18N.langOptions       設定画面の言語セレクタ用に code と nativeName を持つ配列
 *   window.I18N.STORAGE_KEY       言語設定を保持するlocalStorageキー名
 *
 * 他ファイル(app.js の設定画面や各screens-*.js)は elpiya:locale-changed イベントを購読し、
 * 現在表示中の画面を再描画すること。例:
 *   window.addEventListener(elpiya:locale-changed, function (e) {
 *     App.rerenderCurrentScreen();
 *   });
 *
 * 初期言語は日本語(ja)。選択した言語は端末のlocalStorageに保存し、次回起動時も引き継ぐ。
 * アプリ名エルピーヤは全言語共通で翻訳しない(このファイルの辞書にも含めない)。
 */

(function () {

  var STORAGE_KEY = 'elpiya_lang';
  var DEFAULT_LOCALE = 'ja';
  var LOCALES = ['ja', 'en', 'ko'];

  // 翻訳辞書本体。各キーの値は [ja, en, ko] の順の配列
  // key命名は 画面領域.要素 の形。共通する項目はcommon配下にまとめる
  var STRINGS = {

    // ==== common: ヘッダー・タブバー・通知・トースト・確認モーダルなど全画面共通 ====
    'common.appName': ['エルピーヤ', 'エルピーヤ', 'エルピーヤ'],
    'common.back': ['戻る', 'Back', '뒤로'],
    'common.loading': ['読み込み中…', 'Loading…', '로딩 중…'],
    'common.retry': ['再試行', 'Retry', '다시 시도'],
    'common.save': ['保存', 'Save', '저장'],
    'common.cancel': ['キャンセル', 'Cancel', '취소'],
    'common.confirm': ['確認', 'Confirm', '확인'],
    'common.delete': ['削除', 'Delete', '삭제'],
    'common.edit': ['編集', 'Edit', '편집'],
    'common.close': ['閉じる', 'Close', '닫기'],
    'common.add': ['追加', 'Add', '추가'],
    'common.ok': ['OK', 'OK', '확인'],
    'common.error': ['エラーが発生しました', 'An error occurred', '오류가 발생했습니다'],
    'common.networkError': ['通信に失敗しました。ネットワーク接続を確認して再試行してください', 'Connection failed. Please check your network and try again.', '통신에 실패했습니다. 네트워크 연결을 확인한 후 다시 시도해 주세요'],
    'common.required': ['必須項目です', 'This field is required', '필수 항목입니다'],
    'common.sharedDataNotice': ['データはアカウントごとに保護され、ログインした本人だけが閲覧できます', 'Your data is private to your account and visible only to you after signing in.', '데이터는 계정별로 보호되며, 로그인한 본인만 볼 수 있습니다'],
    'common.mainNav': ['メインナビゲーション', 'Main navigation', '메인 내비게이션'],
    'common.empty': ['データがありません', 'No data yet', '데이터가 없습니다'],
    'common.copy': ['コピー', 'Copy', '복사'],
    'common.copied': ['コピーしました', 'Copied', '복사했습니다'],
    'common.copyFailed': ['コピーに失敗しました', 'Failed to copy', '복사에 실패했습니다'],
    'common.download': ['ダウンロード', 'Download', '다운로드'],
    'common.saved': ['保存しました', 'Saved', '저장했습니다'],
    'common.deleted': ['削除しました', 'Deleted', '삭제했습니다'],
    'common.created': ['作成しました', 'Created', '생성했습니다'],
    'common.updated': ['更新しました', 'Updated', '업데이트했습니다'],
    'common.duplicated': ['複製しました', 'Duplicated', '복제했습니다'],
    'common.optional': ['任意', 'Optional', '선택'],
    'common.search': ['検索', 'Search', '검색'],
    'common.characters': ['文字', 'characters', '자'],
    /* ポイントを使うボタンには、必ず消費量を並べて出す。
       押してから確認画面で知るのでは、押す前に判断できない */
    'common.costOnButton': ['{label}（{n}P）', '{label} ({n}P)', '{label}({n}P)'],
    'common.costFree': ['{label}（消費なし）', '{label} (no charge)', '{label}(소모 없음)'],
    'common.yes': ['はい', 'Yes', '예'],
    'common.no': ['いいえ', 'No', '아니오'],
    'common.creditUnit': ['ポイント', 'points', '포인트'],
    'common.creditShort': ['P', 'P', 'P'],
    'common.yen': ['円', 'yen', '엔'],
    'common.unsavedTitle': ['変更を破棄しますか？', 'Discard changes?', '변경 사항을 취소할까요?'],
    'common.unsavedBody': ['保存していない変更は失われます', 'Unsaved changes will be lost', '저장하지 않은 변경 사항은 사라집니다'],
    'common.discard': ['破棄', 'Discard', '취소하고 나가기'],
    'common.keepEditing': ['編集を続ける', 'Keep editing', '계속 편집'],

    // ==== tab: 下部タブバー ====
    'tab.home': ['ホーム', 'Home', '홈'],
    'tab.create': ['作成', 'Create', '작성'],
    'tab.credit': ['ポイント', 'Points', '포인트'],
    'tab.admin': ['管理', 'Admin', '관리'],
    'tab.settings': ['設定', 'Settings', '설정'],

    // ==== sidebar / header: 左サイドメニューとヘッダーのアカウント表示 ====
    'sidebar.myProjects': ['マイプロジェクト', 'My projects', '내 프로젝트'],
    'sidebar.rename': ['名前を変更', 'Rename', '이름 변경'],
    'sidebar.duplicate': ['複製', 'Duplicate', '복제'],
    'sidebar.delete': ['削除', 'Delete', '삭제'],
    'sidebar.deleteTitle': ['このプロジェクトを削除しますか？', 'Delete this project?', '이 프로젝트를 삭제할까요?'],
    'sidebar.deleteBody': ['「{name}」を削除します。', '“{name}” will be deleted.', '「{name}」을(를) 삭제합니다.'],
    'sidebar.deleteNote': [
      '登録商品・分析レポート・生成物もすべて消えます。元に戻せません。',
      'Its products, analysis reports and generated items are removed too. This cannot be undone.',
      '등록 상품·분석 리포트·생성물도 모두 사라집니다. 되돌릴 수 없습니다.'
    ],
    'sidebar.noProjects': ['まだプロジェクトがありません。「作成」から始めてください。', 'No projects yet. Start from “Create”.', '아직 프로젝트가 없습니다. 작성에서 시작해 주세요.'],
    'account.unlimited': ['無制限', 'Unlimited', '무제한'],
    'account.balanceChip': ['残高：{n}', 'Balance: {n}', '잔액: {n}'],
    'account.nameChip': ['{name}様', '{name}', '{name}님'],

    // ==== landing: S0 ログイン前ホーム ====
    'landing.eyebrow': ['クラファン・自社EC対応 / 日本語AI', 'For crowdfunding and DTC / Japanese AI', '크라우드펀딩·자사몰 / 일본어 AI'],
    'landing.title': ['競合分析からデザインまで、\n1ページでAIが。', 'From competitor analysis to design,\nall in one page with AI.', '경쟁사 분석부터 디자인까지,\n한 페이지에서 AI로.'],
    'landing.lead': ['売れている競合LPのURLを入れるだけ。勝ちパターンを読み解いて、クラファンLP・自社LP・KV・Meta広告・LINEコンテンツをまとめて作ります。', 'Just paste the URLs of competitor pages that sell. We read the winning pattern and produce your crowdfunding page, own LP, key visual, Meta ads and LINE content together.', '팔리는 경쟁 상세페이지 URL만 넣으세요. 승리 패턴을 읽어 크라우드펀딩 페이지·자사 LP·KV·메타광고·LINE 콘텐츠를 한 번에 만듭니다.'],
    'landing.ctaStart': ['無料で始める', 'Start free', '무료로 시작하기'],
    'landing.ctaLogin': ['ログイン', 'Log in', '로그인'],
    'landing.ctaNote': ['登録時にお試しポイント付き。カード登録は不要です。', 'Trial points on sign-up. No card required.', '가입 시 체험 포인트 제공. 카드 등록 불필요.'],

    'landing.stepsLabel': ['使い方', 'How it works', '사용법'],
    'landing.stepsTitle': ['たった3ステップ、数分で。', 'Three steps, a few minutes.', '딱 3단계, 몇 분이면.'],
    'landing.stepsDesc': ['デザインの知識も、指示の書き方も要りません。', 'No design skills and no prompt writing needed.', '디자인 지식도, 프롬프트도 필요 없습니다.'],
    'landing.step1': ['商品を入力', 'Enter your product', '상품 입력'],
    'landing.step1Desc': ['写真・カテゴリ・定価・リワード・訴求メッセージを入れます。入力が正確なほど生成結果がよくなります。', 'Photos, category, list price, rewards and messaging. The more accurate the input, the better the output.', '사진·카테고리·정가·리워드·소구 메시지를 넣습니다. 입력이 정확할수록 결과가 좋아집니다.'],
    'landing.step2': ['競合LPを分析', 'Analyze competitors', '경쟁 상세페이지 분석'],
    'landing.step2Desc': ['売れているLPを最大5件登録すると、構成・訴求順・CTA配置・売れた理由を読み解きます。', 'Register up to five pages that sell. We extract structure, order of appeal, CTA placement and why they worked.', '팔리는 페이지를 최대 5건 등록하면 구성·소구 순서·CTA 배치·이유를 읽어냅니다.'],
    'landing.step3': ['まとめて生成', 'Generate everything', '한 번에 생성'],
    'landing.step3Desc': ['LP・KV・Meta広告・LINEコンテンツを一括生成。A/Bテスト用の2案も出せます。', 'Landing pages, key visuals, Meta ads and LINE content at once, plus two variants for A/B testing.', '상세페이지·KV·메타광고·LINE 콘텐츠를 한 번에. A/B 테스트용 2안도 만듭니다.'],

    'landing.featuresLabel': ['できること', 'What you get', '기능'],
    'landing.featuresTitle': ['LP・広告・KV・LINE、1ページで。', 'Pages, ads, visuals and LINE — one place.', '상세페이지·광고·KV·LINE, 한 페이지에서.'],
    'landing.featuresDesc': ['作ったものはそのまま公開でき、閲覧数とCTAクリックを計測できます。', 'Publish what you made and measure views and CTA clicks.', '만든 결과물은 그대로 공개하고 조회수와 CTA 클릭을 측정할 수 있습니다.'],
    'landing.featCfLp': ['クラファンLP', 'Crowdfunding page', '크라우드펀딩 페이지'],
    'landing.featCfLpDesc': ['Makuake・CAMPFIRE・GREENFUNDING の型に沿った構成で生成します。', 'Built to the structures that work on Makuake, CAMPFIRE and GREENFUNDING.', 'Makuake·CAMPFIRE·GREENFUNDING 형식에 맞춰 생성합니다.'],
    'landing.featOwnLp': ['自社LP', 'Your own LP', '자사 LP'],
    'landing.featOwnLpDesc': ['LINE友だち追加ボタン付き。公開URLをそのまま配れます。', 'With a LINE add-friend button. Share the public URL as is.', 'LINE 친구추가 버튼 포함. 공개 URL을 그대로 배포할 수 있습니다.'],
    'landing.featKv': ['KV（メインビジュアル）', 'Key visual', 'KV(메인 비주얼)'],
    'landing.featKvDesc': ['商品写真を活かしたメインビジュアルを生成します。', 'Key visuals built around your own product photos.', '상품 사진을 살린 메인 비주얼을 생성합니다.'],
    'landing.featAds': ['Meta広告', 'Meta ads', '메타광고'],
    'landing.featAdsDesc': ['訴求軸を変えたA・B・C案のクリエイティブとコピーを出します。', 'Three creative and copy variants with different angles.', '소구축을 달리한 A·B·C안 크리에이티브와 카피를 만듭니다.'],
    'landing.featLine': ['LINEコンテンツ', 'LINE content', 'LINE 콘텐츠'],
    'landing.featLineDesc': ['リッチメニュー・リッチメッセージ・あいさつ・配信文の4種。', 'Rich menu, rich message, greeting and broadcast copy.', '리치메뉴·리치메시지·인사말·발송문 4종.'],
    'landing.featAb': ['A/Bテスト', 'A/B testing', 'A/B 테스트'],
    'landing.featAbDesc': ['LPを2案公開して、閲覧数とCTAクリックを並べて見られます。', 'Publish two variants and compare views and CTA clicks side by side.', '2안을 공개하고 조회수·CTA 클릭을 나란히 볼 수 있습니다.'],

    'landing.pricingLabel': ['料金', 'Pricing', '요금'],
    'landing.pricingTitle': ['必要な分だけ、ポイントで。', 'Pay only for what you generate.', '필요한 만큼만, 포인트으로.'],
    'landing.pricingDesc': ['月額の縛りはありません。使った機能の分だけポイントが減ります。', 'No monthly lock-in. Points are spent per feature you use.', '월 구독 묶임 없음. 사용한 기능만큼 포인트이 차감됩니다.'],
    'landing.pricingUnit': ['ポイント制', 'Point based', '포인트 제'],
    'landing.pricingNote': ['プロジェクト作成は無料。LP生成60P / KV・Meta広告・LINE 30P / 競合分析・A/Bテスト 40P。', 'Creating a project is free. Landing page 60P / KV, Meta ads, LINE 30P / analysis and A/B 40P.', '프로젝트 생성은 무료. 상세페이지 60P / KV·메타광고·LINE 30P / 분석·A/B 40P.'],

    'landing.finalTitle': ['今すぐ、最初のLPを作ってみましょう。', 'Make your first landing page now.', '지금, 첫 상세페이지를 만들어 보세요.'],
    'landing.finalDesc': ['商品を入れるところから、数分で。', 'From entering your product, in a few minutes.', '상품을 넣는 것부터, 몇 분이면.'],

    // ==== lang: 設定画面の言語表示名(現在の言語で他言語名をどう呼ぶか) ====
    'lang.ja': ['日本語', 'Japanese', '일본어'],
    'lang.en': ['英語', 'English', '영어'],
    'lang.ko': ['韓国語', 'Korean', '한국어'],

    // ==== validation: 汎用の入力検証メッセージ ====
    'validation.invalidUrl': ['URLの形式が正しくありません', 'This URL is not valid', 'URL 형식이 올바르지 않습니다'],
    'validation.invalidNumber': ['半角数字で入力してください', 'Please enter a valid number', '숫자로 입력해 주세요'],
    'validation.maxLength': ['{max}文字以内で入力してください', 'Please enter within {max} characters', '{max}자 이내로 입력해 주세요'],

    // ==== auth: S1 ログイン / S2 会員登録 ====
    'auth.loginTitle': ['ログイン', 'Log in', '로그인'],
    'auth.welcomeBack': ['おかえりなさい', 'Welcome back', '다시 오신 것을 환영합니다'],
    'auth.continueWith': ['メールまたはGoogleで続行', 'Continue with email or Google', '이메일 또는 Google로 계속하기'],
    'auth.forgotPassword': ['パスワードをお忘れですか？', 'Forgot your password?', '비밀번호를 잊으셨나요?'],
    'auth.email': ['メールアドレス', 'Email address', '이메일 주소'],
    'auth.password': ['パスワード', 'Password', '비밀번호'],
    'auth.emailInvalid': ['メールアドレスの形式が正しくありません', 'This email address is not valid', '이메일 주소 형식이 올바르지 않습니다'],
    'auth.passwordTooShort': ['パスワードは8文字以上で入力してください', 'Password must be at least 8 characters', '비밀번호는 8자 이상 입력해 주세요'],
    'auth.loginButton': ['ログイン', 'Log in', '로그인'],
    'auth.loginFailed': ['認証情報が正しくありません', 'Your email or password is incorrect', '인증 정보가 올바르지 않습니다'],
    'auth.continueWithGoogle': ['Googleで続行', 'Continue with Google', 'Google로 계속하기'],
    'auth.googleDemoNotice': ['体験用の疑似Googleログインです。実際のGoogle認証は行われません', 'This is a demo Google sign-in. No real Google authentication takes place.', '체험용 모의 Google 로그인입니다. 실제 Google 인증은 이루어지지 않습니다'],
    'auth.noAccount': ['アカウントをお持ちでない方は', 'No account yet?', '계정이 없으신가요?'],
    'auth.signupLink': ['新規登録', 'Sign up', '신규 가입'],
    'auth.deviceOnlyNotice': ['このアプリのアカウントは端末内にのみ保存されます。他の端末・ブラウザではログインできません', 'This app stores accounts only on this device. You cannot log in from another device or browser.', '이 앱의 계정은 기기 안에만 저장됩니다. 다른 기기나 브라우저에서는 로그인할 수 없습니다'],
    'auth.signupTitle': ['新規会員登録', 'Create account', '신규 회원가입'],
    'auth.createAccount': ['アカウントを作成', 'Create an account', '계정 만들기'],
    'auth.agreeTerms': ['利用規約に同意のうえ登録', 'By signing up you agree to the Terms of Service', '이용약관에 동의하고 가입합니다'],
    'auth.displayName': ['表示名', 'Display name', '표시 이름'],
    'auth.displayNameInvalid': ['表示名は1〜20文字で入力してください', 'Display name must be 1-20 characters', '표시 이름은 1~20자로 입력해 주세요'],
    'auth.emailDuplicate': ['このメールアドレスは登録済みです', 'This email address is already registered', '이미 등록된 이메일 주소입니다'],
    'auth.passwordHint': ['英数字8文字以上', 'At least 8 letters or numbers', '영문·숫자 8자 이상'],
    'auth.signupButton': ['登録する', 'Sign up', '가입하기'],
    'auth.signupWithGoogle': ['Googleで登録', 'Sign up with Google', 'Google로 가입하기'],
    'auth.backToLogin': ['ログインへ戻る', 'Back to login', '로그인으로 돌아가기'],
    'auth.confirmSent': ['確認メールを送信しました', 'A confirmation email has been sent', '확인 이메일을 발송했습니다'],
    'auth.googleCancelled': ['Google認証がキャンセルされました。もう一度お試しください', 'Google sign-in was cancelled. Please try again.', 'Google 인증이 취소되었습니다. 다시 시도해 주세요'],
    'auth.googleFailed': ['Google認証に失敗しました。もう一度お試しください', 'Google sign-in failed. Please try again.', 'Google 인증에 실패했습니다. 다시 시도해 주세요'],
    'auth.linkedProvider': ['連携中のログイン方法', 'Linked sign-in method', '연결된 로그인 방식'],
    'auth.providerGoogle': ['Google', 'Google', 'Google'],
    'auth.providerEmail': ['メール', 'Email', '이메일'],
    'auth.currentPassword': ['現在のパスワード', 'Current password', '현재 비밀번호'],
    'auth.newPassword': ['新しいパスワード', 'New password', '새 비밀번호'],
    'auth.passwordChanged': ['パスワードを変更しました', 'Password changed', '비밀번호를 변경했습니다'],
    'auth.logoutConfirmTitle': ['ログアウトしますか？', 'Log out?', '로그아웃할까요?'],

    // ==== dashboard: S3 ダッシュボード ====
    'dashboard.title': ['マイプロジェクト', 'My projects', '내 프로젝트'],
    'dashboard.creditBalance': ['ポイント残高', 'Point balance', '포인트 잔액'],
    'dashboard.adminMenu': ['管理', 'Admin', '관리'],
    'dashboard.searchPlaceholder': ['プロジェクトを検索', 'Search projects', '프로젝트 검색'],
    'dashboard.inProgress': ['進行中', 'In progress', '진행 중'],
    'dashboard.monthlyUsage': ['今月の消費', 'Usage this month', '이번 달 사용량'],
    'dashboard.projectList': ['プロジェクト一覧', 'Projects', '프로젝트 목록'],
    'dashboard.newProject': ['新規プロジェクト作成', 'New project', '새 프로젝트 만들기'],
    'dashboard.logout': ['ログアウト', 'Log out', '로그아웃'],
    'dashboard.emptyProjects': ['プロジェクトがまだありません', 'No projects yet', '아직 프로젝트가 없습니다'],
    'dashboard.createFirstProject': ['最初のプロジェクトを作成', 'Create your first project', '첫 프로젝트 만들기'],
    'dashboard.projectMenu': ['操作メニュー', 'Options', '작업 메뉴'],
    'dashboard.countUnit': ['件', 'items', '건'],
    'dashboard.loadFailed': ['プロジェクト一覧の読み込みに失敗しました', 'Failed to load your projects', '프로젝트 목록을 불러오지 못했습니다'],

    // ==== project: S4 プロジェクト作成 ====
    'project.createTitle': ['商品入力', 'Product details', '상품 입력'],
    'project.createSubtitle': ['ここに入れた内容が、LP・KV・広告・LINEすべての材料になります', 'Everything here becomes the material for the pages, key visuals, ads and LINE content', '여기에 입력한 내용이 모든 생성물의 재료가 됩니다'],
    'project.createCreditNote': ['作成に10ポイント消費', 'Creating a project costs 10 points', '생성에 10포인트이 소모됩니다'],
    'project.name': ['プロジェクト名', 'Project name', '프로젝트 이름'],
    'project.nameRequired': ['プロジェクト名を入力してください', 'Please enter a project name', '프로젝트 이름을 입력해 주세요'],
    'project.createButton': ['作成する', 'Create', '생성하기'],
    'project.createFailed': ['プロジェクトの作成に失敗しました', 'Failed to create the project', '프로젝트 생성에 실패했습니다'],

    'product.features': ['商品の特徴', 'Product features', '상품 특징'],
    'product.featuresMax': ['300文字まで入力できます', 'Up to 300 characters', '300자까지 입력할 수 있습니다'],
    'product.cfPlatform': ['出稿するクラファン', 'Crowdfunding platform', '출고할 크라우드펀딩'],
    'product.cfPlatformHint': ['KV（メインビジュアル）の縦横比と枚数がこれで決まります。Makuake はキービジュアル1枚＋スライドショー7枚で計8枚、CAMPFIRE と machi-ya はメイン画像1枚です。',
      'This sets the key visual ratio and how many to make. Makuake takes 8 (1 key visual + 7 slideshow); CAMPFIRE and machi-ya take 1 main image.',
      'KV의 비율과 장수가 여기서 정해집니다. Makuake는 8장(키비주얼 1＋슬라이드쇼 7), CAMPFIRE와 machi-ya는 메인 이미지 1장입니다.'],
    'product.outputLang': ['出力言語', 'Output language', '출력 언어'],
    'product.outputLangHint': ['作るLPの言語です。画面の表示言語とは別で、文章も画像の中の文字もこの言語になります。',
      'The language of the LP you are producing. Separate from the app language; both the copy and the text inside images follow it.',
      '만들 LP의 언어입니다. 화면 표시 언어와는 별개로, 문장도 이미지 속 글자도 이 언어가 됩니다.'],
    'product.price': ['定価', 'List price', '정가'],
    'product.priceInvalid': ['半角数字で入力してください', 'Please enter numbers only', '숫자로 입력해 주세요'],
    'product.target': ['ターゲット', 'Target audience', '타겟'],
    'product.images': ['商品画像', 'Product images', '상품 이미지'],
    'product.imagesMax': ['最大15枚までアップロードできます', 'You can upload up to 15 photos', '최대 15장까지 업로드할 수 있습니다'],
    'product.rewards': ['リワード', 'Rewards', '리워드'],
    'product.reward': ['リワード', 'Reward', '리워드'],
    'product.rewardAdd': ['リワードを追加', 'Add a reward', '리워드 추가'],
    'product.rewardName': ['リワード名', 'Reward name', '리워드 이름'],
    'product.rewardPrice': ['リワード価格', 'Reward price', '리워드 가격'],
    'product.rewardQty': ['数量', 'Quantity', '수량'],
    'product.rewardDesc': ['リワード説明', 'Reward description', '리워드 설명'],

    // 商品入力（ttalkkak-ai.com の「① 상품 입력」タブに合わせた項目）
    'product.photoPanel': ['商品写真', 'Product photos', '상품 사진'],
    's4.productShot': ['商品カットとして使う', 'Use as a product shot', '상품 컷으로 사용'],
    's4.registerShots': ['★の写真を見本に登録する', 'Register starred photos as references', '★ 사진을 견본으로 등록'],
    's4.registerShotsRunning': ['切り抜いています…', 'Cutting out…', '잘라내는 중…'],
    's4.registerShotsDone': ['見本を {n} 枚登録しました', 'Registered {n} references', '견본 {n}장을 등록했습니다'],
    's4.registerShotsHint': ['押すと保存し、★の写真から商品だけを切り抜いて見本にします（1分ほど）。見本は素材の生成にすべて添付されます。',
      'Saves, then cuts the product out of each starred photo to use as references (about a minute). All references are attached when generating.',
      '누르면 저장하고, ★ 사진에서 상품만 잘라내어 견본으로 만듭니다(1분 정도). 견본은 소재 생성 시 모두 첨부됩니다.'],
    's4.registerShotsNone': ['★を付けた写真がありません', 'No starred photos', '★ 표시한 사진이 없습니다'],
    's4.productShotCutouts': [
      '★の写真は、素材を作る前に背景を抜いて商品だけを切り出します。背景が多いままだと、AIが背景ごと商品だと解釈して別の物を描いてしまうためです。',
      'Starred photos have their background removed before the assets are produced. Handed over with the background intact, the AI reads the whole scene as the product and draws something else.',
      '★ 사진은 소재를 만들기 전에 배경을 제거해 상품만 잘라냅니다. 배경이 많은 채로 넘기면 AI가 배경까지 상품으로 이해해 다른 물건을 그려 버립니다.'
    ],
    's4.productShotHint': [
      '★を付けた写真だけを、KV・LP・広告の素材を作るときの見本としてAIに渡します。商品そのものが写っているものを選んでください（仕様の図版やレビュー画面は外す）。',
      'Only the photos you star are handed to the AI as the reference when producing key visuals, LPs and ads. Pick the ones that actually show the product — leave out spec graphics and review screenshots.',
      '★를 표시한 사진만 KV·LP·광고 소재를 만들 때 참고로 AI에 전달합니다. 상품 자체가 찍힌 것을 선택해 주세요(사양 도표나 리뷰 화면은 제외).'
    ],
    's4.gifNote': [
      '動くGIFです。開く・畳む・使うところなど、止まった写真では伝わらない場面が入っています',
      'An animated GIF — it carries what a still cannot: opening, folding, the product in use.',
      '움직이는 GIF입니다. 펼치고 접고 사용하는 장면 등, 정지 사진으로는 전달되지 않는 부분이 담겨 있습니다'
    ],
    's4.productShotCount': [
      '商品カット {n}枚 / 収集した写真 {m}枚',
      '{n} product shots of {m} photos',
      '상품 컷 {n}장 / 수집한 사진 {m}장'
    ],
    'product.photoPanelDesc': ['参考ページから集めた写真と動画がすべてここに並びます。足りないカットは下から追加してください。生成AIに参考として一緒に渡します。', 'Every photo and video collected from the reference page appears here. Add any missing shots below. They are passed to the AI as reference material.', '참고 페이지에서 수집한 사진과 동영상이 모두 여기에 표시됩니다.'],
    'product.dropzone': ['クリックまたはドラッグして写真を追加', 'Click or drag to add photos', '클릭 또는 드래그하여 사진 추가'],
    'product.dropzoneSub': ['PNG / JPG（自動で圧縮して保存）・手動での追加は15枚まで', 'PNG / JPG (compressed automatically) · up to 15 added by hand', 'PNG / JPG (자동 압축 저장) · 직접 추가는 15장까지'],
    'product.basicPanel': ['商品カテゴリ & 基本情報', 'Category & basics', '상품 카테고리 & 기본 정보'],
    'product.basicPanelDesc': ['カテゴリを選ぶと、その分野で実績のあるLPの構成・フックパターンが生成に反映されます。', 'Choosing a category applies the page structure and hook patterns that work in that field.', '카테고리를 선택하면 해당 분야에서 통한 상세페이지 구성·후킹 패턴이 반영됩니다.'],
    'product.category': ['カテゴリ', 'Category', '카테고리'],
    'product.categoryPlaceholder': ['選択してください', 'Select', '선택해 주세요'],
    'product.fundingGoal': ['目標調達額 / ポジショニング', 'Funding goal / positioning', '목표 펀딩액 / 포지셔닝'],
    'product.fundingGoalPlaceholder': ['例: 500万円目標 / プレミアムライン', 'e.g. 5M yen goal / premium line', '예: 5,000만원 목표 / 프리미엄 라인'],
    'product.namePlaceholder': ['例: SYMTIK S1 携帯用エスプレッソマシン', 'e.g. SYMTIK S1 portable espresso machine', '예: SYMTIK S1 휴대용 에스프레소 머신'],
    'product.pricePlaceholder': ['例: 12,900', 'e.g. 12,900', '예: 129,000'],
    'product.rewardPanel': ['リワード（販売）価格・数量', 'Rewards — price and quantity', '리워드(판매) 가격·수량'],
    'product.rewardPanelDesc': ['段階ごとに追加します。数量は「限定」訴求に使います。', 'Add one row per tier. Quantity drives the scarcity message.', '단계별로 추가합니다. 수량은 한정 어필용입니다.'],
    'product.rewardEmpty': ['まだリワードがありません。下の「＋ リワードを追加」から段階別の価格・数量を入れてください。', 'No rewards yet. Use “+ Add a reward” below to enter tiered price and quantity.', '아직 리워드가 없습니다. 아래 + 리워드 추가로 단계별 가격·수량을 넣어주세요.'],
    'product.rewardCardTitle': ['リワード{n}', 'Reward {n}', '리워드 {n}'],
    'product.rewardCount': ['{n}段階', '{n} tiers', '{n}단계'],
    'product.rewardNamePlaceholder': ['例: 超早割 本体1台 + アロマオイル', 'e.g. Super early bird: unit + oil', '예: 슈퍼 얼리버드 본품 1개 + 오일'],
    'product.rewardPricePlaceholder': ['例: 19,800', 'e.g. 19,800', '예: 19,800'],
    'product.rewardQtyPlaceholder': ['例: 100', 'e.g. 100', '예: 100'],
    'product.rewardDescPlaceholder': ['例: 本体＋専用リフィル1本。最も安く手に入る枠', 'e.g. Unit + one refill. The cheapest tier.', '예: 본품 + 전용 리필 1개. 가장 저렴한 구성'],
    'product.rewardQtyHint': ['空欄なら数量無制限として扱います', 'Leave blank for unlimited', '비워두면 수량 무제한으로 처리합니다'],
    'unit.yen': ['円', 'JPY', '엔'],
    'unit.count': ['個', 'pcs', '개'],
    'product.discountOff': ['定価より{n}%OFF', '{n}% off list price', '정가보다 {n}% 할인'],
    'product.discountOver': ['定価より{n}%高い構成です', '{n}% above list price', '정가보다 {n}% 높은 구성입니다'],
    'product.discountNeedPrice': ['上の定価を入れると割引率が出ます', 'Enter the list price above to see the discount', '위의 정가를 입력하면 할인율이 표시됩니다'],
    'product.rewardListPrice': ['定価', 'List price', '정가'],
    'product.rewardListPricePlaceholder': ['例: 24,800', 'e.g. 24,800', '예: 24,800'],
    'product.rewardPosition': ['{n} / {total}', '{n} / {total}', '{n} / {total}'],
    'product.rewardPrev': ['前のリワード', 'Previous reward', '이전 리워드'],
    'product.rewardNext': ['次のリワード', 'Next reward', '다음 리워드'],
    'product.messagePanel': ['訴求メッセージ', 'Messaging', '소구 메시지'],
    'product.messagePanelDesc': ['ここがLPの見出しとキャッチコピーの種になります。', 'This becomes the seed for the headline and copy.', '여기가 상세페이지 헤드라인과 카피의 재료가 됩니다.'],
    'product.valueProp': ['一言価値提案（核心メッセージ）', 'One-line value proposition', '한 줄 가치 제안 (핵심 메시지)'],
    'product.valuePropPlaceholder': ['例: ポケットに、カフェそのままのクレマ', 'e.g. Café-grade crema, in your pocket', '예: 주머니에 쏙, 카페 그대로의 크레마'],
    'product.featuresPlaceholder': ['例:\nワンタッチ18bar抽出\nUSB-C 3分充電\n本体280g', 'e.g.\nOne-touch 18bar extraction\nUSB-C 3-min charge\n280g body', '예:\n원터치 18bar 추출\nUSB-C 3분 충전\n본체 280g'],
    'product.featuresLabel': ['主な差別化ポイント / 機能（改行で複数）', 'Key differentiators / features (one per line)', '핵심 차별점 / 기능 (줄바꿈으로 여러 개)'],
    'product.targetPlaceholder': ['例: キャンプ・車中泊を楽しむ20〜40代のコーヒー好き', 'e.g. Coffee lovers in their 20s-40s who camp', '예: 캠핑·차박 즐기는 2040 커피 애호가'],
    'product.brandTone': ['ブランドトーン & ムード', 'Brand tone & mood', '브랜드 톤 & 무드'],
    'product.brandTonePlaceholder': ['例: ミニマル、プレミアム、あたたかい', 'e.g. minimal, premium, warm', '예: 미니멀, 프리미엄, 따뜻한'],

    // 参考ページからのAI自動入力
    'product.refPanel': ['AI自動分析', 'AI analysis', 'AI 자동 분석'],
    'product.refUrlsLabel': ['参考ページ（自分の商品）', 'Reference pages (your product)', '참고 페이지(자사 상품)'],
    'product.refPanelDesc': ['URLを貼って「AI自動分析」を押すと、2つを続けて読みます。①参考ページ（すでに販売している海外クラファンや Alibaba などの自分の商品ページ）から、商品写真・訴求メッセージ・ターゲット案・ブランドトーン・配色・フォントを下のフォームに埋めます。②競合LPは、①が終わってから分析します。すべて手入力したい場合はこの区画を使わずに下へ進んでください。',
      'Paste URLs and press "Analyse with AI". It reads two things in order: (1) your own product page — photos, messaging, target segments, brand tone, colours and fonts go into the form below; (2) competitor LPs, analysed once step 1 finishes. To type everything yourself, skip this panel.',
      'URL을 붙여넣고 "AI 자동 분석"을 누르면 두 가지를 차례로 읽습니다. ①자사 상품 페이지에서 사진·소구 메시지·타깃 안·브랜드 톤·배색·폰트를 아래 폼에 채우고, ②경쟁 LP는 ①이 끝난 뒤 분석합니다.'],
    'product.refUrl': ['参考ページURL', 'Reference page URL', '참고 페이지 URL'],
    'product.refAdd': ['URLを追加', 'Add URL', 'URL 추가'],
    'product.rivalPanel': ['競合LPのURL（最大5件）', 'Competitor LP URLs (up to 5)', '경쟁 LP URL(최대 5개)'],
    'product.rivalPanelDesc': ['売れている競合のクラファンページを貼ってください。上の商品の読み取りが終わってから、同じボタンで続けて分析します。結果は「競合LP分析」の画面で見られます。伸びなかったページも貼ると、避けるべき型が出ます。',
      'Paste competitor crowdfunding pages. They are analysed right after the product page above is read; results appear on the Competitor analysis screen. Pages that did poorly are useful too — they show what to avoid.',
      '잘 팔린 경쟁사 크라우드펀딩 페이지를 붙여넣으세요. 위 상품 읽기가 끝난 뒤 이어서 분석합니다.'],
    'product.rivalUrl': ['競合LPのURL', 'Competitor LP URL', '경쟁 LP URL'],
    'product.rivalAdd': ['競合LPを追加', 'Add competitor LP', '경쟁 LP 추가'],
    'product.rivalCount': ['{n} / {max} 件', '{n} / {max}', '{n} / {max}건'],
    'product.rivalSame': ['競合LPは同じURLで分析ずみです。そのまま使います。',
      'These competitor LPs are already analysed; reusing the result.',
      '같은 URL의 경쟁 LP는 이미 분석했습니다. 그대로 사용합니다.'],
    'product.rivalQueued': ['競合LP {n}件も分析します（商品の読み取りが終わってから始まります）',
      'Also analysing {n} competitor LPs (starts once the product page is read)',
      '경쟁 LP {n}건도 분석합니다(상품 읽기가 끝난 뒤 시작)'],
    'product.refStructure': ['参照ページの組み立て方', 'How the reference page is built', '참고 페이지의 구성'],
    'product.refMediaImage': ['画像{n}', '{n} images', '이미지 {n}'],
    'product.refMediaGif': ['GIF{n}', '{n} GIFs', 'GIF {n}'],
    'product.refMediaVideo': ['動画{n}', '{n} videos', '동영상 {n}'],
    'product.refShots': ['絵:', 'Visual:', '그림:'],
    'product.refStructureCta': ['申込導線', 'CTA', '신청 도선'],
    'product.refStructureCount': ['{n}区画', '{n} sections', '{n}개 구간'],
    'product.refRun': ['AI自動分析', 'Analyse with AI', 'AI 자동 분석'],
    'product.refRunning': ['読み取り中…', 'Reading…', '읽는 중…'],
    'product.refNoUrl': ['参考ページURLを1件以上入れてください', 'Please enter at least one reference URL', '참고 페이지 URL을 1건 이상 입력해 주세요'],
    'product.refQueued': ['読み取りを受け付けました。完了するとこの画面に反映されます。', 'Analysis queued. The results will appear on this screen.', '분석을 접수했습니다. 완료되면 이 화면에 반영됩니다.'],
    'product.refFilled': ['参考ページの内容を反映しました', 'Filled in from the reference page', '참고 페이지 내용을 반영했습니다'],
    'product.refFilledImages': ['参考ページから写真を{n}枚取り込みました', 'Pulled in {n} photos from the reference page', '참고 페이지에서 사진 {n}장을 가져왔습니다'],

    // 自動入力ジョブの進行状況ウィンドウ
    'job.title': ['参考ページを読み取り中', 'Reading the reference page', '참고 페이지를 읽는 중'],
    'job.titleTargets': ['ターゲット案を作成中', 'Building target segments', '타깃 안 생성 중'],
    // ==== wf: プロジェクトの工程タブ（画面上部） ====
    'wf.input': ['商品入力', 'Product', '상품 입력'],
    'wf.competitor': ['競合LP分析', 'Competitors', '경쟁 LP 분석'],
    'wf.report': ['分析レポート', 'Report', '분석 리포트'],
    'wf.overall': ['総合分析', 'Overview', '종합 분석'],
    'wf.prompt': ['LP案', 'LP draft', 'LP 초안'],
    'wf.result': ['生成結果', 'Generated results', '생성 결과'],
    'wf.pending': ['この工程は作り直し中です', 'This step is being rebuilt', '이 단계는 다시 만드는 중입니다'],

    'job.titleAnalysis': ['競合LPを分析中', 'Analyzing competitor pages', '경쟁 상세페이지 분석 중'],
    'job.titlePrompts': ['生成プロンプトを作成中', 'Writing the generation prompts', '생성 프롬프트 작성 중'],
    'job.titleAssets': ['画像と動画を生成中', 'Producing images and video', '이미지와 동영상 생성 중'],
    'job.doneAssets': ['できました。素材を貼り付けました', 'Done. The assets have been attached', '완료했습니다. 소재를 붙였습니다'],
    'job.noteAssets': ['この画面を閉じても生成は続きます。できあがると素材の一覧が埋まります。', 'You can close this. The asset list fills in as they arrive.', '이 화면을 닫아도 생성은 계속됩니다. 완성되면 소재 목록이 채워집니다.'],
    'job.donePrompts': ['できました。生成プロンプトの画面に進みます', 'Done. Opening the generation prompts', '완료했습니다. 생성 프롬프트 화면으로 이동합니다'],
    'job.notePrompts': ['この画面を閉じても処理は続きます。完了すると生成プロンプトの画面に進みます。', 'You can close this. The prompts open when it is done.', '이 화면을 닫아도 처리는 계속됩니다. 완료되면 생성 프롬프트 화면으로 이동합니다.'],
    'job.queued': ['受け付けました。処理の順番を待っています', 'Queued. Waiting for a worker', '접수했습니다. 처리 순서를 기다리는 중입니다'],
    'job.running': ['ページを読み取っています', 'Reading the page', '페이지를 읽는 중입니다'],
    'job.done': ['完了しました。フォームに反映しました', 'Done. The form has been filled in', '완료했습니다. 폼에 반영했습니다'],
    'job.failed': ['失敗しました', 'It failed', '실패했습니다'],
    'job.elapsed': ['経過 {t}', 'Elapsed {t}', '경과 {t}'],
    'job.targetUrls': ['読み取り対象', 'Pages being read', '읽는 대상'],
    'job.note': ['この画面を閉じても処理は続きます。完了するとフォームに反映されます。', 'You can close this window; the job keeps running and the form is filled in when it finishes.', '이 창을 닫아도 처리는 계속됩니다.'],
    'job.minimize': ['閉じる（右下に小さく表示）', 'Close (keep a small badge)', '닫기(오른쪽 아래에 작게 표시)'],
    'job.expand': ['詳しく見る', 'Show details', '자세히 보기'],
    'job.dismiss': ['表示を消す', 'Dismiss', '표시 지우기'],
    'job.cancel': ['中止する', 'Stop', '중지'],
    'job.cancelAll': ['{n}件まとめて中止する', 'Stop all {n}', '{n}건 모두 중지'],
    'job.cancelling': ['止めています…', 'Stopping…', '중지하는 중…'],
    'job.cancelled': ['中止しました。ここまでにできたものは残っています。',
      'Stopped. Anything finished so far is kept.',
      '중지했습니다. 여기까지 만들어진 것은 남아 있습니다.'],
    'job.stepQueued': ['受付', 'Queued', '접수'],
    'job.stepRead': ['読み取り', 'Reading', '읽기'],
    'job.stepApply': ['反映', 'Applying', '반영'],
    'job.stalled': ['{m}分待っても誰も拾っていません。生成の担当（ローカルのエージェント）が動いていません。', 'No worker has picked this up in {m} min. The local worker agent is not running.', '{m}분 동안 아무도 가져가지 않았습니다. 로컬 워커 에이전트가 실행되고 있지 않습니다.'],
    /* 担当が別の仕事で手一杯なだけのとき。以前はここでも「動いていません」と出していて、
       実際は動いている担当を「入れ直せ」と案内していた（実測: 9分かかるLP・KVプロンプトの裏で
       次のジョブを出すと、必ずこの誤報が出た） */
    'job.queuedBusy': ['他の生成が動いているので順番待ちです（{m}分）。終わり次第このまま始まります。', 'Waiting in line ({m} min) — another generation is running. It starts as soon as that one finishes.', '다른 생성이 실행 중이라 대기 중입니다({m}분). 끝나는 대로 이어서 시작합니다.'],
    'ov.makeLpTitle': ['LP・KVプロンプトを作成中', 'Writing the LP/KV prompts', 'LP·KV 프롬프트 작성 중'],
    /* 窓は1つしか出せないが、仕事は同時に走る。裏で見張っている数 */
    'job.alsoRunning': ['ほかに {n} 件を生成中です（終わり次第、画面に反映します）', '{n} more running — they will appear as they finish.', '다른 {n}건도 생성 중입니다(끝나는 대로 화면에 반영됩니다)'],
    'job.stalledHow': ['ターミナルで tools/install-worker-agent.sh を実行すると、ログイン時に自動で立ち上がるようになります。', 'Run tools/install-worker-agent.sh in a terminal to start it automatically at login.', '터미널에서 tools/install-worker-agent.sh 를 실행하면 로그인 시 자동으로 시작됩니다.'],

    // ブランド指定
    'product.brandPanel': ['ブランド指定', 'Brand settings', '브랜드 설정'],
    'product.brandPanelDesc': ['LP・KV・広告バナーの配色と書体をここで固定します。指定しない項目は商品カテゴリから自動で選ばれます。', 'Locks the palette and typefaces used across the page, key visual and ad banners. Anything left blank is chosen from the category.', '상세페이지·KV·광고 배너의 배색과 서체를 여기서 고정합니다.'],
    'product.brandColors': ['ブランドカラー（最大5色）', 'Brand colors (up to 5)', '브랜드 컬러(최대 5색)'],
    'product.brandColorsHint': ['先頭がメインカラーです。ドラッグではなく削除して入れ直すと順番を変えられます。', 'The first one is the main color. Remove and re-add to change the order.', '첫 번째가 메인 컬러입니다.'],
    'product.brandColorAdd': ['色を追加', 'Add a color', '색 추가'],
    'product.brandPalettesLead': ['AIのおすすめ配色。押すと下のブランドカラーに入ります。入れたあと1色ずつ直せます。', 'AI-suggested palettes. Pick one to fill the brand colors below, then adjust any color.', 'AI 추천 배색. 누르면 아래 브랜드 컬러에 들어갑니다. 넣은 뒤 색을 하나씩 고칠 수 있습니다.'],
    'product.brandFonts': ['ブランドフォント', 'Brand fonts', '브랜드 폰트'],
    'product.fontTitle': ['タイトル', 'Title', '타이틀'],
    'product.fontSubtitle': ['サブタイトル', 'Subtitle', '서브타이틀'],
    'product.fontBody': ['本文', 'Body', '본문'],
    'product.fontEmphasis': ['強調', 'Emphasis', '강조'],
    'product.fontAuto': ['自動（カテゴリに合わせる）', 'Auto (match the category)', '자동(카테고리에 맞춤)'],
    'font.gothic': ['ゴシック体（標準）', 'Gothic / sans-serif', '고딕체'],
    'font.mincho': ['明朝体', 'Mincho / serif', '명조체'],
    'font.maru': ['丸ゴシック体', 'Rounded gothic', '둥근 고딕'],
    'font.gothicBold': ['太ゴシック体', 'Heavy gothic', '굵은 고딕'],
    'font.serifEn': ['欧文セリフ', 'Latin serif', '영문 세리프'],
    'font.sansEn': ['欧文サンセリフ', 'Latin sans-serif', '영문 산세리프'],

    // ターゲット案 A〜E
    'product.targetPanel': ['ターゲット案（A〜E）', 'Target segments (A-E)', '타깃 안(A~E)'],
    'product.targetPanelDesc': ['この商品を一番買ってくれそうな消費者層を、AIが可能性の高い順に5つ出します。ここで決めたA〜Eが、そのままLPと広告バナーの5セットになります。実際に出稿して反応の良い案をメインに絞ってください。', 'Five segments most likely to buy. A-E here become the five landing page and ad banner sets, so you can run them and keep the winner.', '가장 잘 팔릴 고객층 5안. 여기서 정한 A~E가 그대로 상세페이지·광고 배너 5세트가 됩니다.'],
    'product.targetPropose': ['AIに5案を出してもらう', 'Ask the AI for five segments', 'AI에게 5안 받기'],
    'product.targetName': ['ターゲット名', 'Segment name', '타깃 이름'],
    'product.targetDesc': ['この層に刺さる理由・訴求の切り口', 'Why it lands and the angle to use', '이 층에 통하는 이유·소구 각도'],
    'product.targetEmpty': ['まだターゲット案がありません。上のボタンでAIに出してもらうか、手で書いてください。', 'No segments yet. Ask the AI above, or write them yourself.', '아직 타깃 안이 없습니다.'],
    'product.targetAdd': ['ターゲットを追加', 'Add a segment', '타깃 추가'],
    'product.targetAge': ['年代', 'Age range', '연령대'],
    'product.targetGender': ['性別', 'Gender', '성별'],
    'product.targetAgePlaceholder': ['例: 30〜50代', 'e.g. 30s-50s', '예: 30~50대'],
    'product.targetGenderPlaceholder': ['例: 男性 / 女性 / 男女問わず', 'e.g. male / female / any', '예: 남성 / 여성 / 무관'],
    'product.targetCardTitle': ['ターゲット{label}', 'Segment {label}', '타깃 {label}'],
    'product.targetNamePlaceholder': ['例: アロマを日常的に買う30〜50代女性', 'e.g. Women in their 30s-50s who buy aroma products', '예: 아로마를 일상적으로 사는 30~50대 여성'],
    'product.targetDescLabel': ['刺さる理由 / 訴求の切り口', 'Why it lands / the angle', '통하는 이유 / 소구 각도'],
    'product.targetCount': ['{n} / 5案', '{n} / 5', '{n} / 5안'],
    'product.targetPriorityNote': ['上から優先順位順です。Aが最優先。カードを掴んで上下に動かすと順位を入れ替えられます。', 'Listed by priority, A first. Drag a card up or down to reorder.', '위에서부터 우선순위 순입니다. A가 최우선. 카드를 끌어 순서를 바꿀 수 있습니다.'],
    'product.targetUp': ['優先順位を上げる', 'Move up', '우선순위 올리기'],
    'product.targetDown': ['優先順位を下げる', 'Move down', '우선순위 내리기'],
    'product.targetTop': ['最優先', 'Top priority', '최우선'],
    'product.targetPersona': ['ペルソナ', 'Persona', '페르소나'],
    'product.targetPersonaPlaceholder': ['例: 38歳・共働き・都内マンション。週末は家を整える時間が好きで、ホテルの香りに憧れがある。Instagramでインテリア投稿を保存しがち', 'e.g. 38, dual-income, city apartment. Enjoys tidying on weekends and admires hotel scents. Saves interior posts on Instagram.', '예: 38세·맞벌이·도심 아파트. 주말에 집을 정리하는 시간을 좋아하고 호텔 향에 동경이 있음'],
    'product.targetRationale': ['AIがこの層を選んだ理由', 'Why the AI picked this segment', 'AI가 이 층을 고른 이유'],
    'product.targetRationalePlaceholder': ['AIに5案を出してもらうと、ここに選定理由が入ります（手入力のときは空欄で構いません）', 'Filled in when the AI proposes segments. Leave blank when writing your own.', 'AI가 5안을 제안하면 여기에 선정 이유가 들어갑니다'],
    'product.targetOpen': ['詳細を開く', 'Show details', '자세히 보기'],
    'product.targetClose': ['詳細を閉じる', 'Hide details', '접기'],
    'product.targetUnnamed': ['（名前未入力）', '(unnamed)', '(이름 미입력)'],
    'product.targetResetOrder': ['AIの並びに戻す', 'Restore the AI order', 'AI 순서로 되돌리기'],
    'product.targetOrderRestored': ['AIが出した優先順位に戻しました', 'Restored the order the AI proposed', 'AI가 제안한 우선순위로 되돌렸습니다'],
    'product.videos': ['商品動画', 'Product videos', '상품 동영상'],
    'product.videosHint': ['参照ページから集めた動画です。生成時の参考に使います。', 'Videos collected from the reference page, used as generation input.', '참고 페이지에서 수집한 동영상입니다.'],
    'viewer.open': ['拡大表示', 'Open larger', '확대 보기'],
    'viewer.prev': ['前へ', 'Previous', '이전'],
    'viewer.next': ['次へ', 'Next', '다음'],

    // プロジェクト名を先に決めてから中身を埋める流れ
    'project.nameFirstTitle': ['プロジェクト名を決めてください', 'Name your project', '프로젝트 이름을 정해 주세요'],
    'project.nameFirstBody': ['先に名前だけ作ってしまえば、あとは途中でいつでも保存できます。名前はあとから変更できます。', 'Create it with just a name first, then save your progress at any time. You can rename it later.', '먼저 이름만 만들어 두면 이후에는 언제든 저장할 수 있습니다.'],
    'project.nameFirstCreate': ['作成して続ける', 'Create and continue', '생성하고 계속'],
    'project.saveDraft': ['途中保存', 'Save progress', '중간 저장'],
    'project.saved': ['保存しました', 'Saved', '저장했습니다'],
    'project.saveFailed': ['保存に失敗しました', 'Failed to save', '저장에 실패했습니다'],
    'project.editing': ['編集中', 'Editing', '편집 중'],
    'project.unsavedMark': ['未保存の変更があります', 'You have unsaved changes', '저장하지 않은 변경이 있습니다'],
    'project.finish': ['完了して詳細へ', 'Finish and open the project', '완료하고 상세로'],
    // 国内クラファンのモノ系3社（Makuake / CAMPFIRE / GREENFUNDING）の共通項から、
    // LPの型が実際に変わる粒度で13個に絞ったもの。寄付型・興行系は扱わない。
    'category.tech': ['テクノロジー・ガジェット', 'Technology & gadgets', '테크·가젯'],
    'category.appliance': ['家電・オーディオ', 'Appliances & audio', '가전·오디오'],
    'category.food': ['フード・ドリンク', 'Food & drink', '푸드·음료'],
    'category.fashion': ['ファッション・アパレル', 'Fashion & apparel', '패션·의류'],
    'category.bag': ['バッグ・財布・小物', 'Bags, wallets & accessories', '가방·지갑·소품'],
    'category.beauty': ['美容・ヘルスケア', 'Beauty & healthcare', '뷰티·헬스케어'],
    'category.interior': ['インテリア・生活雑貨', 'Interior & living goods', '인테리어·생활잡화'],
    'category.outdoor': ['アウトドア・スポーツ', 'Outdoor & sports', '아웃도어·스포츠'],
    'category.vehicle': ['車・バイク・自転車', 'Cars, bikes & cycling', '자동차·바이크·자전거'],
    'category.baby': ['ベビー・キッズ', 'Baby & kids', '베이비·키즈'],
    'category.pet': ['ペット', 'Pet', '반려동물'],
    'category.craft': ['アート・クラフト・文具', 'Art, craft & stationery', '아트·크래프트·문구'],
    'category.other': ['その他', 'Other', '기타'],

    // ==== projectOps: S5 プロジェクト操作メニュー ====
    'projectOps.title': ['プロジェクト操作', 'Project options', '프로젝트 작업'],
    'projectOps.lastUpdated': ['最終更新', 'Last updated', '마지막 수정'],
    'projectOps.info': ['プロジェクト情報', 'Project info', '프로젝트 정보'],
    'projectOps.createdAt': ['作成日', 'Created', '생성일'],
    'projectOps.productCount': ['登録商品数', 'Registered products', '등록 상품 수'],
    'projectOps.reportCount': ['分析レポート数', 'Analysis reports', '분석 리포트 수'],
    'projectOps.rename': ['名前を変更', 'Rename', '이름 변경'],
    'projectOps.duplicate': ['複製', 'Duplicate', '복제'],
    'projectOps.duplicateSuccess': ['プロジェクトを複製しました', 'Project duplicated', '프로젝트를 복제했습니다'],
    'projectOps.duplicateFailed': ['複製に失敗しました', 'Failed to duplicate the project', '복제에 실패했습니다'],
    'projectOps.delete': ['削除', 'Delete', '삭제'],
    'projectOps.deleteWarning': ['削除は元に戻せません', 'This cannot be undone', '삭제는 되돌릴 수 없습니다'],

    // ==== projectRename: S6 プロジェクト名変更 ====
    'projectRename.title': ['名前を変更', 'Rename project', '이름 변경'],
    'projectRename.label': ['新しいプロジェクト名', 'New project name', '새 프로젝트 이름'],
    'projectRename.hint': ['全角30文字まで', 'Up to 30 characters', '최대 30자'],
    'projectRename.recent': ['最近使った名前', 'Recently used names', '최근 사용한 이름'],
    'projectRename.empty': ['プロジェクト名を入力してください', 'Please enter a project name', '프로젝트 이름을 입력해 주세요'],
    'projectRename.tooLong': ['30文字以内で入力してください', 'Please enter within 30 characters', '30자 이내로 입력해 주세요'],
    'projectRename.duplicate': ['同じ名前のプロジェクトがすでにあります', 'A project with this name already exists', '같은 이름의 프로젝트가 이미 있습니다'],
    'projectRename.saveFailed': ['名前の変更に失敗しました', 'Failed to rename the project', '이름 변경에 실패했습니다'],

    // ==== projectDelete: S7 プロジェクト削除確認 ====
    'projectDelete.title': ['プロジェクトを削除', 'Delete project', '프로젝트 삭제'],
    'projectDelete.willDelete': ['削除される項目', 'Items that will be deleted', '삭제될 항목'],
    'projectDelete.products': ['登録商品', 'Registered products', '등록 상품'],
    'projectDelete.reports': ['分析レポート', 'Analysis reports', '분석 리포트'],
    'projectDelete.generations': ['生成クリエイティブ', 'Generated creatives', '생성된 크리에이티브'],
    'projectDelete.relatedNotice': ['関連データもすべて削除されます', 'All related data will also be deleted', '관련 데이터도 모두 삭제됩니다'],
    'projectDelete.confirmLabel': ['プロジェクト名を入力', 'Type the project name', '프로젝트 이름 입력'],
    'projectDelete.confirmButton': ['削除を確定する', 'Confirm delete', '삭제 확정'],
    'projectDelete.mismatch': ['プロジェクト名が一致しません', 'The name does not match', '프로젝트 이름이 일치하지 않습니다'],
    'projectDelete.failed': ['削除に失敗しました', 'Failed to delete the project', '삭제에 실패했습니다'],

    // ==== projectDetail: S8 プロジェクト詳細 ====
    'projectDetail.title': ['プロジェクト詳細', 'Project', '프로젝트 상세'],
    'projectDetail.progress': ['進捗', 'Progress', '진행률'],
    'projectDetail.remainingCredit': ['残ポイント', 'Remaining points', '남은 포인트'],
    'projectDetail.registeredProducts': ['登録済み商品', 'Registered products', '등록된 상품'],
    'projectDetail.registerProduct': ['商品情報を編集', 'Edit product details', '상품 정보 편집'],
    'projectDetail.startAnalysis': ['競合LP分析', 'Analyze competitor pages', '경쟁 LP 분석'],
    'projectDetail.openReport': ['分析レポートを開く', 'Open analysis report', '분석 리포트 열기'],
    'projectDetail.openGeneration': ['生成結果を開く', 'Open generated results', '생성 결과 열기'],
    'projectDetail.backToDashboard': ['ダッシュボードへ戻る', 'Back to dashboard', '대시보드로 돌아가기'],
    'projectDetail.emptyProducts': ['商品がまだ登録されていません', 'No products registered yet', '아직 등록된 상품이 없습니다'],
    'projectDetail.selectProductFirst': ['商品を選択してください', 'Please select a product', '상품을 선택해 주세요'],
    'projectDetail.loadFailed': ['プロジェクトの読み込みに失敗しました', 'Failed to load the project', '프로젝트를 불러오지 못했습니다'],

    // ==== productForm: S9 商品登録 ====
    'productForm.title': ['商品登録', 'Register product', '상품 등록'],
    'productForm.addPhoto': ['商品写真を追加', 'Add product photos', '상품 사진 추가'],
    'productForm.photoMax': ['最大15枚まで追加できます', 'You can add up to 15 photos', '최대 15장까지 추가할 수 있습니다'],
    'productForm.name': ['商品名', 'Product name', '상품명'],
    'productForm.nameRequired': ['商品名を入力してください', 'Please enter a product name', '상품명을 입력해 주세요'],
    'productForm.saveAndAnalyze': ['保存して分析へ', 'Save and analyze', '저장하고 분석하기'],
    'productForm.saveDraft': ['下書き保存', 'Save draft', '임시 저장'],
    'productForm.saveFailed': ['商品情報の保存に失敗しました', 'Failed to save the product', '상품 정보 저장에 실패했습니다'],

    // ==== analysis: S10 競合分析 ====
    'analysis.title': ['競合LP分析', 'Competitor LP analysis', '경쟁 LP 분석'],
    'analysis.urlLabel': ['競合LPのURL', 'Competitor LP URL', '경쟁 LP URL'],
    'analysis.add': ['追加', 'Add', '추가'],
    'analysis.maxUrls': ['競合LPのURLは最大5件まで追加できます', 'You can add up to 5 competitor URLs', '경쟁 LP URL은 최대 5개까지 추가할 수 있습니다'],
    'analysis.registered': ['登録した競合LP', 'Added competitor LPs', '등록한 경쟁 LP'],
    'analysis.platformAuto': ['プラットフォームを自動判定', 'Platform detected automatically', '플랫폼 자동 판별'],
    'analysis.platform.makuake': ['Makuake', 'Makuake', 'Makuake'],
    'analysis.platform.campfire': ['CAMPFIRE', 'CAMPFIRE', 'CAMPFIRE'],
    'analysis.platform.greenfunding': ['GREENFUNDING', 'GREENFUNDING', 'GREENFUNDING'],
    'analysis.platform.machiya': ['Machi-ya', 'Machi-ya', 'Machi-ya'],
    'analysis.platform.wadiz': ['Wadiz（韓国）', 'Wadiz (Korea)', '와디즈'],
    'analysis.platform.other': ['その他', 'Other', '기타'],
    'analysis.kvSettings': ['KV収集設定', 'KV collection settings', 'KV 수집 설정'],
    'analysis.lpSettings': ['LP収集設定', 'LP collection settings', 'LP 수집 설정'],
    'admin.selectorsTitle': ['KV / LP 収集設定', 'KV / LP collection settings', 'KV / LP 수집 설정'],
    'admin.selectorsDesc': ['プラットフォームごとに、KVと本文をページのどこから取るかを決めます。ここは運営が管理する設定で、利用者の画面には出ません。分析を実行すると、その時点のこの設定が使われます。', 'Where the key visual and body are read from on each platform. Operators manage this; it is not shown to users. Each analysis uses the settings as of the moment it runs.', '플랫폼별로 KV와 본문을 어디에서 가져올지 정합니다.'],
    'admin.selectorsKv': ['KV（メインビジュアル）', 'Key visual', 'KV(메인 비주얼)'],
    'admin.selectorsLp': ['LP（本文）', 'Page body', '상세 본문'],
    'admin.selectorsPlaceholder': ['CSSセレクタを改行で複数', 'One CSS selector per line', 'CSS 선택자를 줄바꿈으로'],
    'admin.selectorsSave': ['収集設定を保存', 'Save collection settings', '수집 설정 저장'],
    'admin.selectorsSaved': ['収集設定を保存しました', 'Collection settings saved', '수집 설정을 저장했습니다'],
    'admin.selectorsMedia': ['取得するもの', 'What to collect', '수집 대상'],
    'admin.roleLabel': ['権限', 'Role', '권한'],
    'admin.roleAdmin': ['管理者', 'Administrator', '관리자'],
    'admin.roleMember': ['一般', 'Member', '일반'],
    'admin.grantAdmin': ['管理者にする', 'Make administrator', '관리자로 지정'],
    'admin.revokeAdmin': ['管理者を外す', 'Remove administrator', '관리자 해제'],
    'admin.grantAdminDone': ['{name}を管理者にしました', '{name} is now an administrator', '{name}을(를) 관리자로 지정했습니다'],
    'admin.revokeAdminDone': ['{name}の管理者権限を外しました', 'Removed {name} from administrators', '{name}의 관리자 권한을 해제했습니다'],
    'admin.revokeAdminConfirm': ['管理者権限を外しますか？', 'Remove administrator rights?', '관리자 권한을 해제할까요?'],
    'admin.revokeAdminBody': ['{name}は管理画面に入れなくなります。ユーザー管理・ポイント単価・収集設定も触れなくなります。', '{name} will lose access to the admin screen, user management, pricing and collection settings.', '{name}은(는) 관리 화면에 들어갈 수 없게 됩니다.'],
    'admin.grantAdminConfirm': ['管理者にしますか？', 'Grant administrator rights?', '관리자로 지정할까요?'],
    'admin.grantAdminBody': ['{name}はユーザー管理・ポイント単価・収集設定を変更できるようになります。', '{name} will be able to change user management, pricing and collection settings.', '{name}은(는) 사용자 관리·포인트 단가·수집 설정을 변경할 수 있게 됩니다.'],
    'admin.cannotDemoteSelf': ['自分の管理者権限は外せません', 'You cannot remove your own administrator rights', '자신의 관리자 권한은 해제할 수 없습니다'],
    'admin.lastAdmin': ['管理者が0人になるため外せません', 'You cannot remove the last administrator', '관리자가 0명이 되므로 해제할 수 없습니다'],
    'admin.roleChangeFailed': ['権限の変更に失敗しました', 'Failed to change the role', '권한 변경에 실패했습니다'],
    'admin.media.text': ['テキスト', 'Text', '텍스트'],
    'admin.media.image': ['画像', 'Images', '이미지'],
    'admin.media.video': ['動画', 'Video', '동영상'],
    'analysis.run': ['分析を実行', 'Run analysis', '분석 실행'],
    'analysis.backToProduct': ['商品入力へ戻る', 'Back to product details', '상품 입력으로 돌아가기'],
    'analysis.uncollected': ['未収集', 'Not collected', '미수집'],
    'analysis.errorCount': ['エラー', 'Errors', '오류'],
    'analysis.empty': ['競合LPのURLをまだ追加していません', 'No competitor URLs added yet', '아직 경쟁 LP URL을 추가하지 않았습니다'],
    'analysis.startFailed': ['分析の開始に失敗しました', 'Failed to start the analysis', '분석 시작에 실패했습니다'],

    // ==== report: S11 分析レポート ====
    'report.title': ['分析レポート', 'Analysis report', '분석 리포트'],
    'report.collectedKv': ['収集したKV', 'Collected KV', '수집한 KV'],
    'report.collectedLp': ['収集したLP', 'Collected LP', '수집한 LP'],
    'report.successFactors': ['成功要因', 'Success factors', '성공 요인'],
    'report.pageStructure': ['ページ構成', 'Page structure', '페이지 구성'],
    'report.byCompetitor': ['競合LP別の分析', 'Results by competitor', '경쟁사별 분석 결과'],
    'report.winPattern': ['勝ちパターン', 'Winning pattern', '성공 패턴'],
    'report.proceed': ['生成に進む', 'Proceed to generation', '생성으로 진행'],
    'report.collectionError': ['収集エラー', 'Collection error', '수집 오류'],
    'report.empty': ['分析レポートがまだありません', 'No analysis report yet', '아직 분석 리포트가 없습니다'],
    'report.loadFailed': ['レポートの読み込みに失敗しました', 'Failed to load the report', '리포트를 불러오지 못했습니다'],

    // ==== reportConfirm: S12 分析内容確認 ====
    'reportConfirm.title': ['生成内容の確認', 'Confirm what to generate', '생성 내용 확인'],
    'reportConfirm.reflectElements': ['反映する要素', 'Elements to apply', '반영할 요소'],
    'reportConfirm.sectionOrder': ['LPセクション構成', 'LP section order', 'LP 섹션 구성'],
    'reportConfirm.creditCost': ['消費ポイント', 'Point cost', '소모 포인트'],
    'reportConfirm.generateWith': ['この内容で生成', 'Generate with these settings', '이 내용으로 생성'],
    'reportConfirm.backToReport': ['総合分析へ', 'Back to the overview', '종합 분석으로'],
    'reportConfirm.backToAnalysis': ['競合分析へ', 'Back to analysis', '경쟁 분석으로'],
    'reportConfirm.winPatternNote': ['反映する勝ちパターン', 'Winning pattern to apply', '반영할 성공 패턴'],
    'reportConfirm.reflectedCount': ['分析結果 {count}件を反映', 'Applying {count} analysis findings', '분석 결과 {count}건 반영'],

    // ==== generate: S13 生成結果 ====

    // ==== design: S14 デザイン編集 ====
    'design.title': ['デザイン編集', 'Edit design', '디자인 편집'],
    'design.autoSaved': ['自動保存', 'Auto-saved', '자동 저장됨'],
    'design.layers': ['レイヤー', 'Layers', '레이어'],
    'design.font': ['フォント', 'Font', '폰트'],
    'design.text': ['テキスト', 'Text', '텍스트'],
    'design.color': ['カラー', 'Color', '색상'],
    'design.addLayer': ['レイヤーを追加', 'Add layer', '레이어 추가'],
    'design.checkRealSize': ['実寸で確認', 'Preview at full size', '실제 크기로 확인'],
    'design.saveAndReturn': ['保存して戻る', 'Save and return', '저장하고 돌아가기'],
    'design.saveFailed': ['保存に失敗しました', 'Failed to save', '저장에 실패했습니다'],

    // ==== preview: S15 デバイスプレビュー拡大 ====
    'preview.title': ['実寸プレビュー', 'Full-size preview', '실제 크기 미리보기'],
    'preview.pc': ['PC', 'PC', 'PC'],
    'preview.mobile': ['スマホ', 'Mobile', '모바일'],
    'preview.sections': ['セクション', 'Sections', '섹션'],
    'preview.editThis': ['このセクションを編集', 'Edit this section', '이 섹션 편집'],
    'preview.backToGenerate': ['生成結果へ戻る', 'Back to generated results', '생성 결과로 돌아가기'],
    'preview.currentlyShowing': ['表示中', 'Now showing', '현재 표시 중'],

    // ==== creditConfirm: 消費ポイントの言い回し（S11・S12・S13 が使う） ====
    'creditConfirm.title': ['ポイント消費確認', 'Confirm point use', '포인트 사용 확인'],
    'creditConfirm.balance': ['残高', 'Balance', '잔액'],
    'creditConfirm.thisTime': ['今回消費', 'This action costs', '이번 소모량'],
    'creditConfirm.byFeature': ['機能別消費', 'Cost by feature', '기능별 소모량'],
    'creditConfirm.afterExecution': ['実行後残高', 'Balance after', '실행 후 잔액'],
    'creditConfirm.insufficientWarning': ['ポイントが不足しています', 'Not enough points', '포인트이 부족합니다'],
    'creditConfirm.runAnalysis': ['分析を実行', 'Run analysis', '분석 실행'],
    'creditConfirm.runGenerate': ['生成を実行', 'Run generation', '생성 실행'],
    'creditConfirm.charge': ['チャージ', 'Add points', '충전하기'],
    'creditConfirm.cancel': ['キャンセル', 'Cancel', '취소'],
    'creditConfirm.executeFailed': ['実行に失敗しました', 'Failed to run', '실행에 실패했습니다'],

    // ==== credit: S17 クレジット ====
    'credit.title': ['ポイント', 'Points', '포인트'],
    'credit.balance': ['残高', 'Balance', '잔액'],
    'credit.expiry': ['有効期限', 'Expires', '유효기간'],
    'credit.purchase': ['購入', 'Purchase', '구매'],
    'credit.purchaseSuccess': ['ポイントを購入しました', 'Points purchased', '포인트을 구매했습니다'],
    'credit.purchaseFailed': ['購入処理に失敗しました', 'The purchase failed', '구매 처리에 실패했습니다'],
    'credit.couponLabel': ['クーポンコード', 'Coupon code', '쿠폰 코드'],
    'credit.couponPlaceholder': ['クーポンコードを入力', 'Enter a coupon code', '쿠폰 코드를 입력하세요'],
    'credit.couponApply': ['登録', 'Apply', '등록'],
    'credit.couponSuccess': ['クーポンを適用しました', 'Coupon applied', '쿠폰을 적용했습니다'],
    'credit.couponInvalid': ['クーポンコードが正しくありません', 'This coupon code is not valid', '쿠폰 코드가 올바르지 않습니다'],
    'credit.couponExpired': ['このクーポンは有効期限切れです', 'This coupon has expired', '이 쿠폰은 유효기간이 지났습니다'],
    'credit.couponUsedUp': ['このクーポンは利用上限に達しています', 'This coupon has reached its usage limit', '이 쿠폰은 사용 한도에 도달했습니다'],
    'credit.history': ['利用履歴', 'History', '이용 내역'],
    'credit.historyEmpty': ['利用履歴がありません', 'No history yet', '이용 내역이 없습니다'],
    'credit.backToDashboard': ['ダッシュボードへ戻る', 'Back to dashboard', '대시보드로 돌아가기'],
    'credit.txType.purchase': ['購入', 'Purchase', '구매'],
    'credit.txType.consume': ['消費', 'Used', '사용'],
    'credit.txType.grant': ['付与', 'Granted', '지급'],
    'credit.txType.coupon': ['クーポン', 'Coupon', '쿠폰'],
    'feature.project_create': ['プロジェクト作成', 'Project created', '프로젝트 생성'],
    'feature.competitor_analysis': ['競合LP分析', 'Competitor analysis', '경쟁 상세페이지 분석'],
    'feature.design_edit': ['デザイン編集', 'Design edit', '디자인 편집'],
    'feature.product_autofill': ['参考ページ自動入力', 'Reference auto-fill', '참고 페이지 자동 입력'],
    'feature.target_proposal': ['ターゲット案の生成', 'Target segments', '타깃 안 생성'],
    'credit.loadFailed': ['ポイント情報の読み込みに失敗しました', 'Failed to load point info', '포인트 정보를 불러오지 못했습니다'],

    // ==== admin: S18 管理画面 ====
    'admin.title': ['管理者ダッシュボード', 'Admin dashboard', '관리자 대시보드'],
    'admin.notAdminNotice': ['管理者権限がありません', 'Admin access is required', '관리자 권한이 없습니다'],
    'admin.creditUnitPrice': ['ポイント単価', 'Point unit price', '포인트 단가'],
    'admin.todayUsage': ['本日の消費', 'Usage today', '오늘 사용량'],
    'admin.priceLabel': ['単価（円）', 'Unit price (yen)', '단가(엔)'],
    'admin.priceInvalid': ['1円以上の数値を入力してください', 'Please enter a value of at least 1 yen', '1엔 이상의 숫자를 입력해 주세요'],
    'admin.save': ['保存', 'Save', '저장'],
    'admin.saveSuccess': ['設定を保存しました', 'Settings saved', '설정을 저장했습니다'],
    'admin.saveFailed': ['保存に失敗しました', 'Failed to save', '저장에 실패했습니다'],
    'admin.userManagement': ['ユーザー管理', 'User management', '사용자 관리'],
    'admin.userStatusActive': ['有効', 'Active', '활성'],
    'admin.userStatusSuspended': ['停止', 'Suspended', '정지'],
    'admin.grantCredit': ['ポイントを付与', 'Grant points', '포인트 지급'],
    'admin.grantUnlimited': ['無制限利用権を付与', 'Grant unlimited access', '무제한 이용권 지급'],
    'admin.inquiries': ['お問い合わせ', 'Inquiries', '문의 관리'],
    'admin.inquiryStatus.pending': ['未対応', 'Pending', '미대응'],
    'admin.inquiryStatus.inProgress': ['対応中', 'In progress', '대응 중'],
    'admin.inquiryStatus.done': ['完了', 'Resolved', '완료'],
    'admin.issueCoupon': ['クーポンを発行', 'Issue coupon', '쿠폰 발행'],
    'admin.featurePricingLink': ['機能別ポイント価格設定', 'Feature pricing', '기능별 포인트 가격 설정'],
    'admin.backToDashboard': ['ダッシュボードへ戻る', 'Back to dashboard', '대시보드로 돌아가기'],
    'admin.loadFailed': ['管理データの読み込みに失敗しました', 'Failed to load admin data', '관리자 데이터를 불러오지 못했습니다'],

    // ==== featurePricing: S19 機能別クレジット価格設定 ====
    'featurePricing.title': ['機能別価格設定', 'Feature pricing', '기능별 가격 설정'],
    'featurePricing.list': ['機能別ポイント', 'Points by feature', '기능별 포인트'],
    'featurePricing.featureKey': ['機能キー', 'Feature key', '기능 키'],
    'featurePricing.featureKeyInvalid': ['半角英数字で入力してください', 'Please use letters and numbers only', '영문·숫자로 입력해 주세요'],
    'featurePricing.featureKeyDuplicate': ['この機能キーはすでに存在します', 'This feature key already exists', '이 기능 키는 이미 존재합니다'],
    'featurePricing.creditCost': ['消費ポイント', 'Point cost', '소모 포인트'],
    'featurePricing.creditCostInvalid': ['0以上の整数を入力してください', 'Please enter a whole number of 0 or more', '0 이상의 정수를 입력해 주세요'],
    'featurePricing.addRow': ['行を追加', 'Add row', '행 추가'],
    'featurePricing.estimatedCost': ['想定コスト', 'Estimated cost', '예상 비용'],
    'featurePricing.saveAndReturn': ['保存して戻る', 'Save and return', '저장하고 돌아가기'],
    'featurePricing.saveFailed': ['保存に失敗しました', 'Failed to save', '저장에 실패했습니다'],
    'featurePricing.note': ['1回あたりの消費ポイント', 'Points used per run', '1회당 소모 포인트'],

    // ==== settings: 設定画面(app.jsが登録) ====
    'settings.title': ['設定', 'Settings', '설정'],
    'settings.language': ['言語', 'Language', '언어'],
    'settings.account': ['アカウント情報', 'Account', '계정 정보'],
    'settings.displayName': ['表示名', 'Display name', '표시 이름'],
    'settings.email': ['メールアドレス', 'Email address', '이메일 주소'],
    'settings.changePassword': ['パスワードを変更', 'Change password', '비밀번호 변경'],
    'settings.logout': ['ログアウト', 'Log out', '로그아웃'],

    /* 管理者が1人も居ないときだけ出る。2人目からは管理画面（S18）から付ける */
    'settings.claimAdminTitle': ['管理者がまだいません', 'No administrator yet', '관리자가 아직 없습니다'],
    'settings.claimAdminBody': [
      'このアプリにはまだ管理者がいません。最初に登録したあなたが管理者になれます。管理者になると、ポイント単価・機能別ポイント・利用者・クーポン・問い合わせを扱えます。',
      'This app has no administrator yet. As the first registered user, you can become one. Administrators manage pricing, feature points, users, coupons and inquiries.',
      '이 앱에는 아직 관리자가 없습니다. 가장 먼저 가입한 당신이 관리자가 될 수 있습니다.'
    ],
    'settings.claimAdmin': ['管理者になる', 'Become administrator', '관리자가 되기'],
    'settings.claimAdminConfirm': [
      '管理者になります。以後この操作は出ません（2人目からは管理画面から付けます）。',
      'You will become the administrator. This option will not appear again; further administrators are granted from the admin screen.',
      '관리자가 됩니다. 이후 이 조작은 나타나지 않습니다.'
    ],
    'settings.claimAdminDone': ['管理者になりました', 'You are now an administrator', '관리자가 되었습니다'],
    'settings.claimAdminTaken': [
      '管理者になれませんでした。すでに他の人が管理者になっているか、最初に登録した人ではありません。',
      'Could not become administrator. Someone else already is, or you are not the first registered user.',
      '관리자가 될 수 없었습니다. 이미 다른 사람이 관리자이거나, 가장 먼저 가입한 사람이 아닙니다.'
    ]
  };

  // STRINGSから locale別辞書 DICT.ja / DICT.en / DICT.ko を組み立てる
  var DICT = { ja: {}, en: {}, ko: {} };
  Object.keys(STRINGS).forEach(function (key) {
    var row = STRINGS[key];
    DICT.ja[key] = row[0];
    DICT.en[key] = row[1];
    DICT.ko[key] = row[2];
  });

  function readStoredLocale() {
    try {
      var v = window.localStorage.getItem(STORAGE_KEY);
      if (v && LOCALES.indexOf(v) !== -1) return v;
    } catch (e) {}
    return null;
  }

  var currentLocale = readStoredLocale() || DEFAULT_LOCALE;

  // t(key, params) 現在の言語の翻訳文字列を返す。paramsはプレースホルダー {name} を置換するオブジェクト
  // 辞書に無いキーはconsole.warnに記録したうえでキー自体を返す(サイレントに握りつぶさない)
  function t(key, params) {
    var table = DICT[currentLocale] || DICT[DEFAULT_LOCALE];
    var str = table[key];
    if (str === undefined) {
      str = DICT[DEFAULT_LOCALE][key];
      if (str !== undefined) {
        console.warn('[i18n] missing translation for locale ' + currentLocale + ':', key);
      }
    }
    if (str === undefined) {
      console.warn('[i18n] unknown translation key:', key);
      return key;
    }
    if (params) {
      Object.keys(params).forEach(function (k) {
        str = str.split('{' + k + '}').join(String(params[k]));
      });
    }
    return str;
  }

  // root配下の data-i18n / data-i18n-aria / data-i18n-placeholder を一括で辞書の値に差し替える
  function applyDom(root) {
    var scope = root || document;

    var textNodes = scope.querySelectorAll('[data-i18n]');
    for (var i = 0; i < textNodes.length; i++) {
      var elText = textNodes[i];
      elText.textContent = t(elText.getAttribute('data-i18n'));
    }

    var ariaNodes = scope.querySelectorAll('[data-i18n-aria]');
    for (var j = 0; j < ariaNodes.length; j++) {
      var elAria = ariaNodes[j];
      elAria.setAttribute('aria-label', t(elAria.getAttribute('data-i18n-aria')));
    }

    var placeholderNodes = scope.querySelectorAll('[data-i18n-placeholder]');
    for (var p = 0; p < placeholderNodes.length; p++) {
      var elPlaceholder = placeholderNodes[p];
      elPlaceholder.setAttribute('placeholder', t(elPlaceholder.getAttribute('data-i18n-placeholder')));
    }
  }

  function htmlLangFor(code) {
    if (code === 'ko') return 'ko';
    if (code === 'en') return 'en';
    return 'ja';
  }

  // setLocale(code) 言語を切り替えて端末に保存し、共通シェル(ヘッダー・タブバー・注意書きなど)を
  // 即座に再適用したうえで elpiya:locale-changed イベントを発火する。
  // 画面本体(JSが動的に組み立てるテキスト)の再描画は、このイベントを購読するapp.js側の責務とする
  function setLocale(code) {
    if (LOCALES.indexOf(code) === -1) {
      console.warn('[i18n] unsupported locale:', code);
      return;
    }
    currentLocale = code;
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch (e) {}
    document.documentElement.setAttribute('lang', htmlLangFor(code));
    applyDom(document);
    var evt;
    try {
      evt = new CustomEvent('elpiya:locale-changed', { detail: { locale: code } });
    } catch (e) {
      evt = document.createEvent('CustomEvent');
      evt.initCustomEvent('elpiya:locale-changed', false, false, { locale: code });
    }
    window.dispatchEvent(evt);
  }

  function getLocale() {
    return currentLocale;
  }

  // 設定画面の言語セレクタ用。表示名は各言語の自称(ネイティブネーム)を使う
  var LANG_OPTIONS = [
    { code: 'ja', nativeName: '日本語' },
    { code: 'en', nativeName: 'English' },
    { code: 'ko', nativeName: '한국어' }
  ];

  window.t = t;
  window.I18N = {
    t: t,
    apply: applyDom,
    setLocale: setLocale,
    getLocale: getLocale,
    locales: LOCALES.slice(),
    langOptions: LANG_OPTIONS,
    STORAGE_KEY: STORAGE_KEY
  };

  // このファイルはdeferで読み込まれるため、実行時点でHTMLの構文解析は完了している。
  // 起動時点の言語(端末保存値、無ければ日本語)を html[lang] とシェル要素にただちに適用する
  document.documentElement.setAttribute('lang', htmlLangFor(currentLocale));
  applyDom(document);

})();
