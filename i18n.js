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
    'common.sharedDataNotice': ['ログイン機能は未実装のため、このアプリを開いた全員が同じデータを見ます', 'Login is not yet implemented, so everyone who opens this app sees the same data.', '로그인 기능이 구현되어 있지 않아 이 앱을 연 모든 사람이 같은 데이터를 보게 됩니다'],
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
    'common.yes': ['はい', 'Yes', '예'],
    'common.no': ['いいえ', 'No', '아니오'],
    'common.creditUnit': ['クレジット', 'credits', '크레딧'],
    'common.creditShort': ['CR', 'CR', 'CR'],
    'common.yen': ['円', 'yen', '엔'],
    'common.unsavedTitle': ['変更を破棄しますか？', 'Discard changes?', '변경 사항을 취소할까요?'],
    'common.unsavedBody': ['保存していない変更は失われます', 'Unsaved changes will be lost', '저장하지 않은 변경 사항은 사라집니다'],
    'common.discard': ['破棄', 'Discard', '취소하고 나가기'],
    'common.keepEditing': ['編集を続ける', 'Keep editing', '계속 편집'],

    // ==== tab: 下部タブバー ====
    'tab.home': ['ホーム', 'Home', '홈'],
    'tab.create': ['作成', 'Create', '작성'],
    'tab.credit': ['クレジット', 'Credits', '크레딧'],
    'tab.admin': ['管理', 'Admin', '관리'],
    'tab.settings': ['設定', 'Settings', '설정'],

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
    'dashboard.creditBalance': ['クレジット残高', 'Credit balance', '크레딧 잔액'],
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
    'project.createTitle': ['新規プロジェクト', 'New project', '새 프로젝트'],
    'project.createSubtitle': ['商品情報を登録', 'Enter product details', '상품 정보 등록'],
    'project.createCreditNote': ['作成に10クレジット消費', 'Creating a project costs 10 credits', '생성에 10크레딧이 소모됩니다'],
    'project.name': ['プロジェクト名', 'Project name', '프로젝트 이름'],
    'project.nameRequired': ['プロジェクト名を入力してください', 'Please enter a project name', '프로젝트 이름을 입력해 주세요'],
    'project.createButton': ['作成する', 'Create', '생성하기'],
    'project.createFailed': ['プロジェクトの作成に失敗しました', 'Failed to create the project', '프로젝트 생성에 실패했습니다'],

    'product.features': ['商品の特徴', 'Product features', '상품 특징'],
    'product.featuresMax': ['300文字まで入力できます', 'Up to 300 characters', '300자까지 입력할 수 있습니다'],
    'product.price': ['価格', 'Price', '가격'],
    'product.priceInvalid': ['半角数字で入力してください', 'Please enter numbers only', '숫자로 입력해 주세요'],
    'product.target': ['ターゲット', 'Target audience', '타겟'],
    'product.images': ['商品画像', 'Product images', '상품 이미지'],
    'product.imagesMax': ['最大10枚までアップロードできます', 'You can upload up to 10 photos', '최대 10장까지 업로드할 수 있습니다'],

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
    'projectDetail.remainingCredit': ['残クレジット', 'Remaining credits', '남은 크레딧'],
    'projectDetail.registeredProducts': ['登録済み商品', 'Registered products', '등록된 상품'],
    'projectDetail.registerProduct': ['商品を登録', 'Register product', '상품 등록'],
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
    'productForm.photoMax': ['最大10枚まで追加できます', 'You can add up to 10 photos', '최대 10장까지 추가할 수 있습니다'],
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
    'analysis.platform.other': ['その他', 'Other', '기타'],
    'analysis.kvSettings': ['KV収集設定', 'KV collection settings', 'KV 수집 설정'],
    'analysis.lpSettings': ['LP収集設定', 'LP collection settings', 'LP 수집 설정'],
    'analysis.run': ['分析を実行', 'Run analysis', '분석 실행'],
    'analysis.backToProduct': ['商品登録へ戻る', 'Back to product registration', '상품 등록으로 돌아가기'],
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
    'reportConfirm.creditCost': ['消費クレジット', 'Credit cost', '소모 크레딧'],
    'reportConfirm.generateWith': ['この内容で生成', 'Generate with these settings', '이 내용으로 생성'],
    'reportConfirm.backToReport': ['分析レポートへ', 'Back to report', '분석 리포트로'],
    'reportConfirm.backToAnalysis': ['競合分析へ', 'Back to analysis', '경쟁 분석으로'],
    'reportConfirm.winPatternNote': ['反映する勝ちパターン', 'Winning pattern to apply', '반영할 성공 패턴'],
    'reportConfirm.reflectedCount': ['分析結果 {count}件を反映', 'Applying {count} analysis findings', '분석 결과 {count}건 반영'],

    // ==== generate: S13 生成結果 ====
    'generate.title': ['生成結果', 'Generated results', '생성 결과'],
    'generate.completed': ['LPが完成しました', 'Your LP is ready', 'LP가 완성되었습니다'],
    'generate.reflectedNote': ['競合{count}社の分析を反映済み', 'Reflects analysis of {count} competitors', '경쟁사 {count}곳의 분석을 반영함'],
    'generate.pcPreview': ['PCプレビュー', 'PC preview', 'PC 미리보기'],
    'generate.mobilePreview': ['スマホプレビュー', 'Mobile preview', '모바일 미리보기'],
    'generate.expand': ['拡大表示', 'Expand', '확대 보기'],
    'generate.viewReport': ['分析レポート', 'Analysis report', '분석 리포트'],
    'generate.editDesign': ['デザイン編集', 'Edit design', '디자인 편집'],
    'generate.balance': ['残高', 'Balance', '잔액'],
    'generate.addMore': ['KV・メタ広告・LINEコンテンツを追加生成', 'Generate more KV, ads, or LINE content', 'KV·메타 광고·LINE 콘텐츠 추가 생성'],
    'generate.saveAndReturn': ['プロジェクトへ戻る', 'Back to project', '프로젝트로 돌아가기'],
    'generate.viewCredit': ['クレジット残高と利用履歴を確認', 'View credit balance and history', '크레딧 잔액과 이용 내역 보기'],
    'generate.crowdfundingLp': ['クラファンLP', 'Crowdfunding LP', '크라우드펀딩 LP'],
    'generate.ownLp': ['自社LP', 'Brand LP', '자사 LP'],
    'generate.kv': ['KV', 'Key visual', 'KV'],
    'generate.metaAd': ['メタ広告', 'Meta ads', '메타 광고'],
    'generate.lineContent': ['LINEコンテンツ', 'LINE content', 'LINE 콘텐츠'],
    'generate.lineButtonUrl': ['LINE友だち追加ボタンのURL', 'LINE friend-add button URL', 'LINE 친구 추가 버튼 URL'],
    'generate.lineButtonPosition': ['推奨位置', 'Recommended position', '추천 위치'],
    'generate.lineButtonStyle': ['推奨デザイン', 'Recommended design', '추천 디자인'],
    'generate.downloadHtml': ['HTMLダウンロード', 'Download HTML', 'HTML 다운로드'],
    'generate.copySection': ['セクションをコピー', 'Copy section', '섹션 복사'],
    'generate.abVariantA': ['A案', 'Variant A', 'A안'],
    'generate.abVariantB': ['B案', 'Variant B', 'B안'],
    'generate.richMenu': ['リッチメニュー', 'Rich menu', '리치 메뉴'],
    'generate.richMessage': ['リッチメッセージ', 'Rich message', '리치 메시지'],
    'generate.greetingMessage': ['あいさつメッセージ', 'Greeting message', '인사 메시지'],
    'generate.message': ['メッセージ', 'Message', '메시지'],
    'generate.charLimitWarning': ['文字数の上限を超えています', 'The character limit has been exceeded', '글자 수 제한을 초과했습니다'],
    'generate.noLineButtonForCrowdfunding': ['クラウドファンディングLPにはLINEボタンを含められません', 'LINE buttons cannot be included in crowdfunding LPs', '크라우드펀딩 LP에는 LINE 버튼을 넣을 수 없습니다'],
    'generate.loadFailed': ['生成結果の読み込みに失敗しました', 'Failed to load the generated results', '생성 결과를 불러오지 못했습니다'],
    'generate.empty': ['まだ生成された結果がありません', 'Nothing has been generated yet', '아직 생성된 결과가 없습니다'],

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

    // ==== creditConfirm: S16 クレジット消費確認 ====
    'creditConfirm.title': ['クレジット消費確認', 'Confirm credit use', '크레딧 사용 확인'],
    'creditConfirm.balance': ['残高', 'Balance', '잔액'],
    'creditConfirm.thisTime': ['今回消費', 'This action costs', '이번 소모량'],
    'creditConfirm.byFeature': ['機能別消費', 'Cost by feature', '기능별 소모량'],
    'creditConfirm.afterExecution': ['実行後残高', 'Balance after', '실행 후 잔액'],
    'creditConfirm.insufficientWarning': ['クレジットが不足しています', 'Not enough credits', '크레딧이 부족합니다'],
    'creditConfirm.runAnalysis': ['分析を実行', 'Run analysis', '분석 실행'],
    'creditConfirm.runGenerate': ['生成を実行', 'Run generation', '생성 실행'],
    'creditConfirm.charge': ['チャージ', 'Add credits', '충전하기'],
    'creditConfirm.cancel': ['キャンセル', 'Cancel', '취소'],
    'creditConfirm.executeFailed': ['実行に失敗しました', 'Failed to run', '실행에 실패했습니다'],

    // ==== credit: S17 クレジット ====
    'credit.title': ['クレジット', 'Credits', '크레딧'],
    'credit.balance': ['残高', 'Balance', '잔액'],
    'credit.expiry': ['有効期限', 'Expires', '유효기간'],
    'credit.purchase': ['購入', 'Purchase', '구매'],
    'credit.purchaseSuccess': ['クレジットを購入しました', 'Credits purchased', '크레딧을 구매했습니다'],
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
    'credit.loadFailed': ['クレジット情報の読み込みに失敗しました', 'Failed to load credit info', '크레딧 정보를 불러오지 못했습니다'],

    // ==== admin: S18 管理画面 ====
    'admin.title': ['管理者ダッシュボード', 'Admin dashboard', '관리자 대시보드'],
    'admin.notAdminNotice': ['管理者権限がありません', 'Admin access is required', '관리자 권한이 없습니다'],
    'admin.creditUnitPrice': ['クレジット単価', 'Credit unit price', '크레딧 단가'],
    'admin.todayUsage': ['本日の消費', 'Usage today', '오늘 사용량'],
    'admin.priceLabel': ['単価（円）', 'Unit price (yen)', '단가(엔)'],
    'admin.priceInvalid': ['1円以上の数値を入力してください', 'Please enter a value of at least 1 yen', '1엔 이상의 숫자를 입력해 주세요'],
    'admin.save': ['保存', 'Save', '저장'],
    'admin.saveSuccess': ['設定を保存しました', 'Settings saved', '설정을 저장했습니다'],
    'admin.saveFailed': ['保存に失敗しました', 'Failed to save', '저장에 실패했습니다'],
    'admin.userManagement': ['ユーザー管理', 'User management', '사용자 관리'],
    'admin.userStatusActive': ['有効', 'Active', '활성'],
    'admin.userStatusSuspended': ['停止', 'Suspended', '정지'],
    'admin.grantCredit': ['クレジットを付与', 'Grant credits', '크레딧 지급'],
    'admin.grantUnlimited': ['無制限利用権を付与', 'Grant unlimited access', '무제한 이용권 지급'],
    'admin.inquiries': ['お問い合わせ', 'Inquiries', '문의 관리'],
    'admin.inquiryStatus.pending': ['未対応', 'Pending', '미대응'],
    'admin.inquiryStatus.inProgress': ['対応中', 'In progress', '대응 중'],
    'admin.inquiryStatus.done': ['完了', 'Resolved', '완료'],
    'admin.issueCoupon': ['クーポンを発行', 'Issue coupon', '쿠폰 발행'],
    'admin.featurePricingLink': ['機能別クレジット価格設定', 'Feature pricing', '기능별 크레딧 가격 설정'],
    'admin.backToDashboard': ['ダッシュボードへ戻る', 'Back to dashboard', '대시보드로 돌아가기'],
    'admin.loadFailed': ['管理データの読み込みに失敗しました', 'Failed to load admin data', '관리자 데이터를 불러오지 못했습니다'],

    // ==== featurePricing: S19 機能別クレジット価格設定 ====
    'featurePricing.title': ['機能別価格設定', 'Feature pricing', '기능별 가격 설정'],
    'featurePricing.list': ['機能別クレジット', 'Credits by feature', '기능별 크레딧'],
    'featurePricing.featureKey': ['機能キー', 'Feature key', '기능 키'],
    'featurePricing.featureKeyInvalid': ['半角英数字で入力してください', 'Please use letters and numbers only', '영문·숫자로 입력해 주세요'],
    'featurePricing.featureKeyDuplicate': ['この機能キーはすでに存在します', 'This feature key already exists', '이 기능 키는 이미 존재합니다'],
    'featurePricing.creditCost': ['消費クレジット', 'Credit cost', '소모 크레딧'],
    'featurePricing.creditCostInvalid': ['0以上の整数を入力してください', 'Please enter a whole number of 0 or more', '0 이상의 정수를 입력해 주세요'],
    'featurePricing.addRow': ['行を追加', 'Add row', '행 추가'],
    'featurePricing.estimatedCost': ['想定コスト', 'Estimated cost', '예상 비용'],
    'featurePricing.saveAndReturn': ['保存して戻る', 'Save and return', '저장하고 돌아가기'],
    'featurePricing.saveFailed': ['保存に失敗しました', 'Failed to save', '저장에 실패했습니다'],
    'featurePricing.note': ['1回あたりの消費クレジット', 'Credits used per run', '1회당 소모 크레딧'],

    // ==== settings: 設定画面(app.jsが登録) ====
    'settings.title': ['設定', 'Settings', '설정'],
    'settings.language': ['言語', 'Language', '언어'],
    'settings.account': ['アカウント情報', 'Account', '계정 정보'],
    'settings.displayName': ['表示名', 'Display name', '표시 이름'],
    'settings.email': ['メールアドレス', 'Email address', '이메일 주소'],
    'settings.changePassword': ['パスワードを変更', 'Change password', '비밀번호 변경'],
    'settings.logout': ['ログアウト', 'Log out', '로그아웃']
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
