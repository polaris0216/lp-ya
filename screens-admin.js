/* ============================================================
 * エルピーヤ — screens-admin.js
 * S18 管理画面 と S19 機能別クレジット価格設定 の2画面だけを描く。
 *
 * ---- 他ファイルとの共通契約（この名前どおりに使う。似た名前を作らない）----
 * 画面登録   App.registerScreen('S18', { render: function (root, params) {} });
 *            第2引数は必ず { render: 関数 } のオブジェクト。関数をそのまま渡さない。
 * 画面遷移   App.navigate(id, params) / App.replace(id, params)（ハッシュルーターは app.js）
 *              S18 -> S19 機能別クレジット価格設定
 *              S18 -> S3  ダッシュボード
 *              S19 -> S18 管理画面（保存して戻る）
 * 通信       api.js の window.Api だけを使う。
 *              Api.featureCredits.list / insert / update
 *              Api.users.list / update
 *              Api.creditTransactions.list
 *              Api.inquiries.list / update
 *              Api.coupons.list / insert / update
 *              Api.credits.grant(userId, credits, memo)
 *              Api.credits.grantUnlimited(userId, days, memo)
 *              Api.credits.setUserStatus(userId, status)  ← users への直接 PATCH は不可
 *              Api.credits.hasUnlimited(user) / Api.today()
 *            業務データは localStorage に置かない（保存先は Supabase）。
 * 文言       i18n.js の window.I18N.t(key) を使う。辞書に無いキーは勝手に作らず、
 *            このファイル内の LOCAL（ja / en / ko の3言語）で補って tl(key) で引く。
 * 共通部品   App.showLoading / App.errorBlock / App.handleError / App.toast /
 *            App.confirm / App.openModal / App.closeModal /
 *            App.formatNumber / App.formatYen / App.formatDate / App.isAdmin
 * class      styles.css に実在する綴りだけを使う。
 *              screen / screen__head / screen__title / screen__lead /
 *              section / section__head / section__title / section__desc /
 *              stack / stack--tight / stack--group / row--input-action / row--2 /
 *              btn-row / btn-row--1 / stat-grid /
 *              card / card--soft / card__label / card__value / card__unit / card__sub /
 *              list / list__head / list-row / list-row__body / list-row__title /
 *              list-row__sub / list-row__meta / list-row__action /
 *              info-list / info-row / info-row__key / info-row__val /
 *              field / field__label / field__hint / field__error / input / input--error /
 *              chips / chip / chip--selected / badge / badge--ok / badge--warn /
 *              badge--danger / badge--mute / btn / btn--primary / btn--secondary /
 *              btn--danger / btn--text / btn--block / btn--sm /
 *              modal / modal__title / modal__body / modal__note / modal__actions /
 *              note-box / warn-box / empty / empty__text / divider /
 *              t-note / t-danger / t-ok / num / clamp-1 / clamp-2
 *
 * ---- クレジット単価の置き場所（screens-credit.js と同じ約束）----
 *   設定専用のテーブルは無いので、a2f58db45_feature_credits に
 *   feature_key = 'credit_unit_price' の1行を置き、credit_cost に
 *   「1クレジットあたりの円」を入れる。
 *   この行は機能ではないため S19 の一覧には出さず、想定コストの計算にだけ使う。
 *   S17 クレジット画面の購入価格もこの行を読むので、ここで保存すれば購入画面に反映される。
 *
 * ---- 機能キー（screens-credit.js と同じ綴り）----
 *   competitor_analysis 競合LP分析 / generation クラファンLP・自社LP生成 /
 *   kv_generation KV生成 / meta_ads メタ広告文生成 / line_content LINEコンテンツ生成 /
 *
 * 無い関数は黙って飛ばさない。何が無いのかを console.error に必ず残す。
 * ============================================================ */

(function (window, document) {
  'use strict';

  var App = window.App = window.App || {};

  /* ---------- 依存の確認（無いものは必ずコンソールに残す） ---------- */
  if (typeof App.registerScreen !== 'function') {
    console.error('[screens-admin] App.registerScreen が見つかりません。index.html の読み込み順（app.js -> screens-admin.js）を確認してください。登録内容は window.App.screens に控えます。');
    App.screens = App.screens || {};
    App.registerScreen = function (id, spec) {
      if (!spec || typeof spec.render !== 'function') {
        console.error('[screens-admin] registerScreen の第2引数は { render: 関数 } である必要があります。画面ID: ' + id);
        return;
      }
      App.screens[id] = spec;
    };
  }
  if (!window.Api) {
    console.error('[screens-admin] window.Api が見つかりません。api.js が読み込まれているか確認してください。管理画面はデータを取得できません。');
  }
  if (!window.I18N || typeof window.I18N.t !== 'function') {
    console.error('[screens-admin] window.I18N.t が見つかりません。i18n.js が読み込まれているか確認してください。翻訳キーをそのまま表示します。');
  }

  /* ---------- 定数 ---------- */
  var MAX_PLANS = 9;                               // 購入画面が並べる上限（Edge Function と同じ数）
  var PLANS_KEY = 'purchase_plans';                // app_settings の行（062）
  var UNIT_PRICE_KEY = 'credit_unit_price';        // feature_credits に置く単価専用の行
  var UNIT_PRICE_NAME = 'ポイント単価（円）';
  /* 為替。S18（料金設定の欄）と S19（値段表から外す判定）の両方が使うので、
     画面の関数の中ではなくここに置く。
     2026-11-08 に S18 の中で宣言してしまい、S19 が ReferenceError で
     まるごと描けなくなった（「この画面が消えた」）*/
  /* 単価の行の名前（073 がこの形で会社ごとの単価を引く）。
     どの会社を知っているかの台帳としても使う */
  var AI_RATE_RE = /^(.+)_(in|out|cw|cr)_usd_per_mtok_x1000$/;

  var RATE_KEY = 'usdjpy_x100';
  var RATE_NAME = '為替 1USD=何円 ×100';
  var MAX_RATE = 100000;   /* 1USD=1000円。これを超えるのは打ち間違い */
  var DEFAULT_UNIT_PRICE = 10;                     // 1クレジット = 10円
  var USER_LIMIT = 50;
  var INQUIRY_LIMIT = 50;
  var COUPON_LIMIT = 20;
  /* AIの使用量。月ごとに合計するだけなので、直近ぶんが読めれば足りる */
  var TX_SCAN_LIMIT = 300;                         // 本日の消費を数えるために読む履歴の上限
  /* ponytail: 売上は直近200件の購入から数える。件数が増えたら SQL 側で合計を出す */
  var PURCHASE_LIMIT = 200;                        // 売上の集計と一覧に読む購入の上限
  var MAX_FEATURE_KEY_LENGTH = 40;
  var MAX_FEATURE_NAME_LENGTH = 40;
  var MAX_CREDIT_COST = 100000;
  /* 手で入れる原価（1回あたりの円）の上限 */
  /* 手で入れる原価はUSD。1回 1万ドルを超える原価は打ち間違い */
  var MAX_COST_USD = 10000;
  /* 文言の {yen} を入力欄に差し替えるための目印（画面には出ない） */
  var YEN_SLOT = '\u0001';
  var MAX_UNIT_PRICE = 100000;
  var MAX_GRANT_CREDIT = 100000;
  var MAX_GRANT_DAYS = 365;
  var MAX_COUPON_USES = 10000;
  var FEATURE_KEY_PATTERN = /^[A-Za-z0-9_]+$/;
  var COUPON_CODE_PATTERN = /^[A-Za-z0-9]{4,32}$/;
  var COUPON_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  /* 機能別クレジットの既定値。feature_credits に行が無ければ未保存の行として並べる */
  var FEATURE_DEFAULTS = [
    { key: 'competitor_analysis', cost: 40, name: ['競合LP分析', 'Competitor LP analysis', '경쟁 LP 분석'] },
    { key: 'generation', cost: 60, name: ['クラファンLP・自社LP生成', 'Crowdfunding and brand LP generation', '크라우드펀딩·자사 LP 생성'] },
    { key: 'kv_generation', cost: 20, name: ['KV生成', 'Key visual generation', 'KV 생성'] },
    { key: 'meta_ads', cost: 15, name: ['メタ広告文生成', 'Meta ad copy generation', '메타 광고 문구 생성'] },
    { key: 'line_content', cost: 15, name: ['LINEコンテンツ生成', 'LINE content generation', 'LINE 콘텐츠 생성'] }
  ];

  /* 問い合わせの対応状況。値は a2f58db45_inquiries.inquiry_status にそのまま入れる */
  var INQUIRY_STATUSES = [
    { value: 'pending', key: 'admin.inquiryStatus.pending', badge: 'badge badge--warn' },
    { value: 'in_progress', key: 'admin.inquiryStatus.inProgress', badge: 'badge badge--mute' },
    { value: 'done', key: 'admin.inquiryStatus.done', badge: 'badge badge--ok' }
  ];

  /* i18n.js の辞書に無い文言だけをここで持つ。並びは [日本語, English, 한국어] */
  var LOCAL = {
    'local.adminLead': [
      '単価・機能別ポイント・ユーザー・クーポン・問い合わせをここで管理します',
      'Manage unit price, feature points, users, coupons and inquiries here',
      '단가·기능별 포인트·사용자·쿠폰·문의를 여기에서 관리합니다'
    ],
    'local.notAdminBody': [
      'この画面は管理者のみが利用できます。ダッシュボードへ戻ります。',
      'This screen is for administrators only. Returning to the dashboard.',
      '이 화면은 관리자만 이용할 수 있습니다. 대시보드로 돌아갑니다.'
    ],
    'local.apiMissing': [
      '通信部品（api.js）の {name} が見つかりません。アプリを再読み込みしてください。',
      'The api.js function {name} is missing. Please reload the app.',
      '통신 부품(api.js)의 {name}을(를) 찾을 수 없습니다. 앱을 다시 불러와 주세요.'
    ],
    'local.reload': ['再読み込み', 'Reload', '다시 불러오기'],
    'local.unitPriceSub': ['1ポイントあたりの円', 'Yen per point', '포인트당 엔'],
    /* 広告の札（2026-11-04） */
    'local.adTagTitle': ['広告の札（AdMax）', 'Ad tag (AdMax)', '광고 태그(AdMax)'],
    'local.adTagDesc': ['生成中のポップアップに出ます。空にすると何も出ません。',
      'Shown in the progress popup. Leave empty to show nothing.',
      '생성 중 팝업에 표시됩니다. 비우면 아무것도 나오지 않습니다.'],
    'local.adTagPlaceholder': ['<script src="https://adm.shinobi.jp/s/..."></script>',
      '<script src="https://adm.shinobi.jp/s/..."></script>',
      '<script src="https://adm.shinobi.jp/s/..."></script>'],
    'local.adTagWarn': ['顧客のLP（公開ページ）には出ません。ここはアプリの画面だけです。',
      'Never shown on customer LPs. This is the app UI only.',
      '고객 LP(공개 페이지)에는 나오지 않습니다. 앱 화면에만 표시됩니다.'],
    'local.adTagSaved': ['広告の札を保存しました', 'Ad tag saved', '광고 태그를 저장했습니다'],
    'local.unitPriceDesc': [
      '保存するとポイント購入画面の表示価格に反映されます',
      'Saving updates the prices shown on the purchase screen',
      '저장하면 포인트 구매 화면의 표시 가격에 반영됩니다'
    ],
    'local.todaySub': ['本日 {n}件の消費', '{n} charges today', '오늘 {n}건 소비'],
    /* 購入プラン（2026-11-06 要望）。購入画面に並ぶカードをここで作る */
    'local.plansTitle': ['購入プラン', 'Purchase plans', '구매 플랜'],
    'local.plansDesc': [
      '購入画面に並ぶカードです。{max}件まで作れます',
      'The cards shown on the purchase screen. Up to {max}.',
      '구매 화면에 늘어서는 카드입니다. {max}개까지 만들 수 있습니다'
    ],
    'local.plansPoints': ['ポイント数', 'Points', '포인트 수'],
    'local.plansYen': ['金額（円）', 'Price (yen)', '금액(엔)'],
    'local.plansAdd': ['プランを追加', 'Add a plan', '플랜 추가'],
    'local.plansFull': ['プランは{max}件までです', 'Up to {max} plans', '플랜은 {max}개까지입니다'],
    'local.plansInvalid': [
      'ポイント数と金額は1以上の数字で入れてください',
      'Points and price must be 1 or more',
      '포인트 수와 금액은 1 이상으로 입력해 주세요'
    ],
    'local.plansEmpty': [
      'プランがありません。追加すると購入画面に並びます',
      'No plans yet. Add one and it appears on the purchase screen.',
      '플랜이 없습니다. 추가하면 구매 화면에 표시됩니다'
    ],
    'local.plansSaved': ['購入プランを保存しました', 'Purchase plans saved', '구매 플랜을 저장했습니다'],
    'local.plansPerPoint': ['1ポイントあたり {yen}', '{yen} per point', '포인트당 {yen}'],
    'local.userSectionDesc': ['登録 {n}人（新しい順）', '{n} registered users (newest first)', '등록 {n}명(최신순)'],
    'local.usersEmpty': ['登録ユーザーがいません', 'No registered users yet', '등록된 사용자가 없습니다'],
    'local.userNameFallback': ['名称未設定', 'No name', '이름 없음'],
    'local.balanceLabel': ['残高', 'Balance', '잔액'],
    'local.joinedLabel': ['登録日', 'Registered', '가입일'],
    'local.adminBadge': ['管理者', 'Admin', '관리자'],
    'local.unlimitedBadge': ['無制限 {date}まで', 'Unlimited until {date}', '무제한 {date}까지'],
    'local.unlimitedNone': ['無制限利用権なし', 'No unlimited access', '무제한 이용권 없음'],
    'local.userActions': ['ユーザー操作', 'User actions', '사용자 관리'],
    'local.useHistory': ['使用履歴', 'Usage history', '사용 내역'],
    'local.useHistoryEmpty': ['まだ履歴がありません', 'No history yet', '내역이 없습니다'],
    'local.useHistoryLoad': ['読み込んでいます…', 'Loading…', '불러오는 중…'],
    'local.useHistoryFail': ['履歴を読み込めませんでした', 'Could not load history', '내역을 불러오지 못했습니다'],
    'local.useHistoryAfter': ['残', 'left', '잔액'],
    'local.tx_consume': ['利用', 'Used', '사용'],
    'local.tx_purchase': ['チャージ', 'Top-up', '충전'],
    'local.tx_grant': ['管理者付与', 'Granted', '관리자 지급'],
    'local.tx_coupon': ['クーポン', 'Coupon', '쿠폰'],
    'local.chatTitle': ['やり取り', 'Conversation', '대화'],
    'local.chatLoad': ['読み込んでいます…', 'Loading…', '불러오는 중…'],
    'local.chatFail': ['やり取りを読み込めませんでした', 'Could not load', '대화를 불러오지 못했습니다'],
    'local.chatYou': ['運営', 'Support', '운영'],
    'local.chatUser': ['お客さま', 'Customer', '고객'],
    'local.chatReply': ['返信を書く', 'Write a reply', '답장 쓰기'],
    'local.chatSend': ['返信する', 'Send reply', '답장 보내기'],
    'local.chatSent': ['返信しました', 'Reply sent', '답장했습니다'],
    'local.chatNeedBody': ['返信の内容を入れてください', 'Enter a reply', '내용을 입력하세요'],
    'local.aiCostTitle': ['AIにかかった費用', 'AI spend', 'AI 비용'],
    'local.aiCostDesc': ['どのAIにいくら払っているかを月ごとに出します。絵は投げた回数×単価（作り直しも1回）、文章はトークン数×単価です。',
      'What each AI costs, by month. Images are requests x unit price (retries count); text is tokens x rate.',
      '어느 AI에 얼마를 쓰는지 월별로 표시합니다. 이미지는 요청 수 × 단가(재시도 포함), 텍스트는 토큰 수 × 단가입니다.'],
    'local.aiCostMonth': ['月', 'Month', '월'],
    'local.aiCostTries': ['投げた回数', 'Requests', '요청 수'],
    'local.aiCostMade': ['できた枚数', 'Delivered', '생성 수'],
    'local.aiCostRate': ['1枚あたり', 'Per image', '1장당'],
    'local.aiCostTimes': ['回', ' tries', '회'],
    'local.aiCostMonthTotal': ['この月の合計', 'Total for the month', '이 달 합계'],
    'local.aiCostCalls': ['呼んだ回数 {n}', '{n} calls', '호출 {n}회'],
    'local.aiCostUsd': ['費用', 'Cost', '비용'],
    'local.aiCostEmpty': ['まだ記録がありません', 'No records yet', '기록이 없습니다'],
    'local.aiCostNote': ['※ 単価は上の「機能ごとの単価」で変えられます。絵は投げたときの単価が記録に残るので過去ぶんは変わりません。文章はトークン数だけを記録しているので、単価を直すと過去ぶんも計算し直されます。',
      'Rates are editable above. Images keep the price recorded at the time, so past months do not change. Text stores only token counts, so changing a rate recalculates past months too.',
      '단가는 위의 설정에서 변경할 수 있습니다. 이미지는 요청 당시의 단가가 기록되어 과거분은 바뀌지 않습니다. 텍스트는 토큰 수만 기록하므로 단가를 바꾸면 과거분도 다시 계산됩니다.'],
    'local.statusLabel': ['状態', 'Status', '상태'],
    'local.toSuspend': ['このユーザーを停止する', 'Suspend this user', '이 사용자를 정지'],
    'local.toActivate': ['このユーザーを有効にする', 'Activate this user', '이 사용자를 활성화'],
    'local.suspendConfirmTitle': ['ユーザーを停止しますか？', 'Suspend this user?', '사용자를 정지할까요?'],
    'local.suspendConfirmBody': [
      '{name} は停止中はアプリを利用できなくなります',
      '{name} will not be able to use the app while suspended',
      '{name} 님은 정지 중에는 앱을 이용할 수 없습니다'
    ],
    'local.statusChanged': ['{name} を{status}にしました', '{name} is now {status}', '{name} 님을 {status} 상태로 변경했습니다'],
    'local.statusChangeFailed': ['状態の切り替えに失敗しました', 'Failed to change the status', '상태 변경에 실패했습니다'],
    'local.grantCreditLabel': ['増減するポイント', 'Points to add or deduct', '증감할 포인트'],
    'local.grantUnlimitedLabel': ['無制限利用の日数', 'Days of unlimited access', '무제한 이용 일수'],
    'local.grantAction': ['付与', 'Grant', '지급'],
    'local.grantAmountInvalid': ['1以上の整数を入力してください', 'Please enter a whole number of 1 or more', '1 이상의 정수를 입력해 주세요'],
    'local.grantDaysInvalid': ['1〜365の整数を入力してください', 'Please enter a whole number from 1 to 365', '1~365 사이의 정수를 입력해 주세요'],
    'local.grantCreditDone': ['{name} に{n}ポイントを付与しました', 'Granted {n} points to {name}', '{name} 님에게 {n} 포인트을 지급했습니다'],
    'local.grantUnlimitedDone': [
      '{name} に無制限利用権を{days}日間付与しました（{until}まで）',
      'Granted {days} days of unlimited access to {name} (until {until})',
      '{name} 님에게 무제한 이용권을 {days}일 지급했습니다({until}까지)'
    ],
    'local.grantFailed': ['付与に失敗しました', 'The grant failed', '지급에 실패했습니다'],
    'local.grantMemo': ['管理画面からの付与', 'Granted from the admin screen', '관리 화면에서 지급'],
    'local.deductAction': ['減らす', 'Deduct', '차감'],
    'local.deductCreditDone': [
      '{name} から{n}ポイントを減らしました',
      'Deducted {n} points from {name}',
      '{name} 님에게서 {n} 포인트을 차감했습니다'
    ],
    'local.deductFailed': ['減算に失敗しました', 'The deduction failed', '차감에 실패했습니다'],
    'local.deductMemo': ['管理画面からの減算', 'Deducted from the admin screen', '관리 화면에서 차감'],
    'local.deductShortage': [
      '残高が足りません（いまの残高 {n}ポイント）',
      'Not enough balance (currently {n} points)',
      '잔액이 부족합니다(현재 {n} 포인트)'
    ],
    'local.tabUsers': ['会員・ポイント', 'Members', '회원·포인트'],
    'local.tabSales': ['決済・売上', 'Payments', '결제·매출'],
    'local.tabCost': ['使用量・原価', 'Usage', '사용량·원가'],
    'local.tabPricing': ['料金設定', 'Pricing', '요금 설정'],
    'local.tabCoupons': ['クーポン', 'Coupons', '쿠폰'],
    'local.tabInquiries': ['問い合わせ', 'Inquiries', '문의'],
    'local.tabSettings': ['設定', 'Settings', '설정'],
    'local.salesTitle': ['決済・売上', 'Payments', '결제·매출'],
    'local.salesDesc': [
      'Stripe の決済が確定したぶんだけが並びます（直近{n}件）',
      'Only confirmed Stripe payments are listed (latest {n})',
      'Stripe 결제가 확정된 건만 표시됩니다(최근 {n}건)'
    ],
    'local.salesTotal': ['総売上', 'Total revenue', '총 매출'],
    'local.salesMonth': ['今月の売上', 'This month', '이번 달 매출'],
    'local.salesCount': ['購入件数', 'Payments', '결제 건수'],
    'local.salesCountSub': ['今月 {n}件', '{n} this month', '이번 달 {n}건'],
    'local.salesEmpty': ['まだ購入がありません', 'No payments yet', '아직 결제가 없습니다'],
    'local.salesRefund': ['返金', 'Refund', '환불'],
    'local.salesPoints': ['{n}ポイント', '{n} points', '{n} 포인트'],
    'local.couponSection': ['クーポン発行', 'Issue coupon', '쿠폰 발행'],
    'local.couponSectionDesc': [
      'ポイントまたは月間無制限利用のクーポンを発行します',
      'Issue point coupons or unlimited-access coupons',
      '포인트 또는 월간 무제한 이용 쿠폰을 발행합니다'
    ],
    'local.couponCodeLabel': ['クーポンコード', 'Coupon code', '쿠폰 코드'],
    'local.couponCodePlaceholder': ['半角英数字4〜32文字', '4 to 32 letters or numbers', '영문·숫자 4~32자'],
    'local.couponGenerate': ['自動生成', 'Generate', '자동 생성'],
    'local.couponTypeLabel': ['クーポンの種類', 'Coupon type', '쿠폰 종류'],
    'local.couponTypeCredit': ['ポイント付与', 'Point grant', '포인트 지급'],
    'local.couponTypeUnlimited': ['無制限利用', 'Unlimited access', '무제한 이용'],
    'local.couponCreditLabel': ['付与ポイント', 'Points granted', '지급 포인트'],
    'local.couponDaysLabel': ['無制限の日数', 'Days of unlimited access', '무제한 일수'],
    'local.couponMaxUsesLabel': ['利用上限（回）', 'Maximum uses', '이용 한도(회)'],
    'local.couponExpiresLabel': ['有効期限（任意）', 'Expiry date (optional)', '유효기간(선택)'],
    'local.couponIssueAction': ['このクーポンを発行', 'Issue this coupon', '이 쿠폰을 발행'],
    'local.couponIssued': ['クーポン {code} を発行しました', 'Issued coupon {code}', '쿠폰 {code}을(를) 발행했습니다'],
    'local.couponIssueFailed': ['クーポンの発行に失敗しました', 'Failed to issue the coupon', '쿠폰 발행에 실패했습니다'],
    'local.couponCodeInvalid': ['半角英数字4〜32文字で入力してください', 'Please use 4 to 32 letters or numbers', '영문·숫자 4~32자로 입력해 주세요'],
    'local.couponCodeDuplicate': ['このコードはすでに発行されています', 'This code has already been issued', '이 코드는 이미 발행되었습니다'],
    'local.couponAmountInvalid': ['1以上の整数を入力してください', 'Please enter a whole number of 1 or more', '1 이상의 정수를 입력해 주세요'],
    'local.couponMaxUsesInvalid': ['1以上の整数を入力してください', 'Please enter a whole number of 1 or more', '1 이상의 정수를 입력해 주세요'],
    'local.couponListTitle': ['発行済みクーポン', 'Issued coupons', '발행된 쿠폰'],
    'local.couponEmpty': ['発行済みのクーポンはありません', 'No coupons issued yet', '발행된 쿠폰이 없습니다'],
    'local.couponUses': ['利用 {used}/{max}回', 'Used {used} of {max}', '이용 {used}/{max}회'],
    'local.couponExpiresOn': ['期限 {date}', 'Expires {date}', '기한 {date}'],
    'local.couponNoExpiry': ['期限なし', 'No expiry', '기한 없음'],
    'local.couponStopped': ['停止中', 'Stopped', '중지됨'],
    'local.couponStopTitle': ['クーポンを停止しますか？', 'Stop this coupon?', '쿠폰을 중지할까요?'],
    'local.couponStopBody': ['{code} は以降利用できなくなります', '{code} can no longer be redeemed', '{code}은(는) 이후 이용할 수 없습니다'],
    'local.couponResumeTitle': ['クーポンを再開しますか？', 'Reactivate this coupon?', '쿠폰을 다시 사용할까요?'],
    'local.couponResumeBody': ['{code} をふたたび利用できるようにします', '{code} becomes redeemable again', '{code}을(를) 다시 이용할 수 있게 합니다'],
    'local.couponStopDone': ['クーポンを停止しました', 'The coupon was stopped', '쿠폰을 중지했습니다'],
    'local.couponResumeDone': ['クーポンを再開しました', 'The coupon was reactivated', '쿠폰을 다시 활성화했습니다'],
    'local.inquiriesDesc': ['{n}件（新しい順）', '{n} inquiries (newest first)', '{n}건(최신순)'],
    'local.inquiriesEmpty': ['問い合わせはありません', 'No inquiries yet', '문의가 없습니다'],
    'local.inquiryDetailTitle': ['問い合わせ詳細', 'Inquiry detail', '문의 상세'],
    'local.inquiryFrom': ['送信者', 'From', '보낸 사람'],
    'local.inquiryBodyLabel': ['本文', 'Message', '본문'],
    'local.inquiryStatusLabel': ['対応状況', 'Status', '대응 상태'],
    'local.inquiryUpdated': ['対応状況を更新しました', 'The status was updated', '대응 상태를 업데이트했습니다'],
    'local.inquiryUpdateFailed': ['対応状況の更新に失敗しました', 'Failed to update the status', '대응 상태 업데이트에 실패했습니다'],
    'local.noSubject': ['（件名なし）', '(No subject)', '(제목 없음)'],
    'local.featureListDesc': ['{n}件の機能（1回あたりの消費ポイント）', '{n} features (points used per run)', '{n}개 기능(1회당 소모 포인트)'],
    'local.featureListEmpty': ['機能が登録されていません。下の入力から行を追加してください', 'No features yet. Add a row with the form below.', '등록된 기능이 없습니다. 아래 입력에서 행을 추가해 주세요'],
    'local.unsavedBadge': ['未保存', 'Unsaved', '미저장'],
    /* 会員登録の許可制（2026-11-01 要望） */
    'local.pendingTitle': ['承認待ちの登録', 'Waiting for approval', '승인 대기'],
    'local.pendingDesc': ['{n}人が待っています。許可するまで、その人はアプリの中に入れません。',
      '{n} waiting. They cannot enter the app until you approve them.',
      '{n}명 대기 중. 승인할 때까지 앱에 들어올 수 없습니다.'],
    'local.pendingEmpty': ['承認待ちはいません。', 'Nobody is waiting.', '대기 중인 사람이 없습니다.'],
    'local.pendingSince': ['登録 {d}', 'Registered {d}', '등록 {d}'],
    'local.approve': ['許可する', 'Approve', '승인'],
    'local.reject': ['断る', 'Reject', '거절'],
    'local.approved': ['{name} さんを許可しました', 'Approved {name}', '{name} 님을 승인했습니다'],
    'local.rejected': ['{name} さんを断りました', 'Rejected {name}', '{name} 님을 거절했습니다'],
    'local.rejectConfirm': ['この登録を断りますか', 'Reject this registration?', '이 등록을 거절할까요'],
    'local.rejectBody': ['{name} さんは今後ログインできません。あとから許可し直すこともできます。',
      '{name} will not be able to sign in. You can approve them later.',
      '{name} 님은 로그인할 수 없게 됩니다. 나중에 다시 승인할 수 있습니다.'],
    /* 値段表の括り分けと、実測原価（2026-10-30 要望） */
    /* 1つのボタンで複数の機能が走る組み合わせ（2026-11-08 指摘） */
    'local.bundleIfRef': ['（参考URLがあるとき）', ' (when a reference URL is given)', '(참고 URL이 있을 때)'],
    'local.bundleAiRun': ['AI自動分析', 'Analyse with AI', 'AI 자동 분석'],
    'local.bundlePrice': ['売値 {p}P（{yen}円）／1回', 'Price {p}P (¥{yen}) per press', '판매가 {p}P({yen}원)/1회'],
    'local.bundleCostEach': ['実測原価 ${yen}/回{jpy}（{n}つの機能の合計）',
      'Measured cost ${yen} per press{jpy} (sum of {n} features)',
      '실측 원가 ${yen}/회{jpy}({n}개 기능 합계)'],
    'local.bundleCostHint': ['このボタン1回ぶんの原価をUSDで入れられます。空にすると、中で走る機能の実測を足した額を使います。',
      'Enter the USD cost of one press. Leave it empty to use the sum of the measured costs of the features it runs.',
      '이 버튼 1회분의 원가를 USD로 입력할 수 있습니다. 비우면 내부 기능의 실측 합계를 사용합니다.'],
    /* AIの鍵と、どのAIを使うか（2026-11-09 要望） */
    'local.aiTitle': ['AIの鍵と、使うAI', 'AI keys and which AI to use', 'AI 키와 사용할 AI'],
    'local.aiDesc': ['鍵は本体を残さず、末尾4文字だけ控えます（Supabase Vault）。写真の生成は OpenAI だけ、文章は Claude か DeepSeek を選べます。',
      'Keys are stored in Supabase Vault; only the last 4 characters are kept here. Images use OpenAI only; text can use Claude or DeepSeek.',
      '키는 Supabase Vault에 저장하고, 여기에는 끝 4자리만 남깁니다. 이미지는 OpenAI만, 문장은 Claude 또는 DeepSeek을 고를 수 있습니다.'],
    'local.aiPickTitle': ['文章を作るAI', 'AI for text', '문장 생성 AI'],
    'local.aiPickDesc': ['切り替えると、次に積む仕事から変わります。走っている仕事はそのままです。',
      'Takes effect for jobs queued after the change. Running jobs are not affected.',
      '변경 후 쌓이는 작업부터 적용됩니다. 실행 중인 작업은 그대로입니다.'],
    'local.aiKeyLabel': ['{name} の鍵', '{name} key', '{name} 키'],
    'local.aiKeyPlaceholder': ['sk-… を貼り付け', 'Paste sk-…', 'sk-… 붙여넣기'],
    'local.aiKeySet': ['入っています（末尾 {tail}・{when} 更新）', 'Set (ends {tail}, updated {when})', '등록됨(끝 {tail}, {when} 갱신)'],
    'local.aiKeyNone': ['まだ入っていません', 'Not set yet', '아직 없습니다'],
    'local.aiKeyClear': ['消す', 'Clear', '삭제'],
    'local.aiKeySaved': ['鍵を入れました', 'Key saved', '키를 저장했습니다'],
    'local.aiKeyCleared': ['鍵を消しました', 'Key cleared', '키를 삭제했습니다'],
    'local.aiImageNote': ['写真の生成は OpenAI だけです。この鍵が無いと、絵はブラウザ経由のままになります。',
      'Images use OpenAI only. Without this key, images keep going through the browser.',
      '이미지는 OpenAI만 사용합니다. 이 키가 없으면 이미지는 브라우저 경유로 유지됩니다.'],
    'local.modelLabel': ['{name} のモデル', '{name} model', '{name} 모델'],
    'local.modelDefault': ['指定しない（既定のまま）', 'Leave unset (use default)', '지정하지 않음(기본값)'],
    'local.modelOther': ['その他（直接入力）', 'Other (type it in)', '기타(직접 입력)'],
    'local.modelOtherPlaceholder': ['モデル名を打つ（例 claude-opus-5）',
      'Type the model name (e.g. claude-opus-5)', '모델명을 입력(예: claude-opus-5)'],
    'local.modelBest': ['いちばん賢い・高い', 'most capable, costliest', '가장 똑똑·고가'],
    'local.modelBalanced': ['標準', 'standard', '표준'],
    'local.modelFast': ['速い・安い', 'fast and cheap', '빠름·저가'],
    'local.modelNoImage': ['画像を読めない', 'cannot read images', '이미지를 읽지 못함'],
    'local.modelHint': ['替えると、次に積む仕事から変わります。',
      'Takes effect for jobs queued after the change.',
      '변경 후 쌓이는 작업부터 적용됩니다.'],
    /* ひと続きの字で書く。+ でつなぐと、3言語そろっているかの自己チェックが
       数を取り違える（2026-11-13、実測） */
    'local.modelCostNote': ['替えると、次に積む仕事から変わります。原価はこの下の「モデル別の単価」で計算します。一覧に無いモデルを打ったときは、そこに単価も入れてください（入れるまでは会社の単価で計算します）。',
      'Takes effect for jobs queued after the change. Cost is computed from the per-model rates below. If you typed a model that is not listed, add its rates there too (until then the company rate is used).',
      '변경 후 쌓이는 작업부터 적용됩니다. 원가는 아래의 모델별 단가로 계산합니다. 목록에 없는 모델을 입력했다면 거기에 단가도 넣어주세요(넣기 전에는 회사 단가로 계산합니다).'],
    'local.mrTitle': ['モデル別の単価（USD / 100万トークン）', 'Per-model rates (USD / 1M tokens)', '모델별 단가(USD / 100만 토큰)'],
    'local.mrDesc': ['原価はこの単価で計算します。行が無いモデルは会社の単価に落ちます。公式の値段表が変わったら、ここを直してください。',
      'Cost is computed from these rates. A model with no row falls back to the company rate. Update here when the official price list changes.',
      '원가는 이 단가로 계산합니다. 행이 없는 모델은 회사 단가로 내려갑니다. 공식 가격표가 바뀌면 여기를 고쳐주세요.'],
    'local.mrIn': ['入力', 'Input', '입력'],
    'local.mrOut': ['出力', 'Output', '출력'],
    'local.mrCw': ['キャッシュ書込', 'Cache write', '캐시 쓰기'],
    'local.mrCr': ['キャッシュ読出', 'Cache read', '캐시 읽기'],
    'local.mrNote': ['出どころ: {note}', 'Source: {note}', '출처: {note}'],
    'local.mrNew': ['まだ単価が入っていません（会社の単価で計算しています）',
      'No rates yet (falling back to the company rate)',
      '아직 단가가 없습니다(회사 단가로 계산 중)'],
    'local.mrInvalid': ['0以上の数で入れてください', 'Enter a number of 0 or more', '0 이상의 수로 입력하세요'],
    'local.mrEmpty': ['単価を入れるモデルがまだありません', 'No models to price yet', '단가를 넣을 모델이 아직 없습니다'],
    'local.rateTitle': ['為替（AI原価の円換算）', 'Exchange rate (for AI cost in yen)', '환율(AI 원가 엔화 환산)'],
    'local.rateDesc': ['AIの請求はドル建てです。原価を円で出すときに、この値を掛けます。',
      'AI is billed in USD. This rate converts the cost to yen.',
      'AI는 달러로 청구됩니다. 원가를 엔화로 표시할 때 이 값을 곱합니다.'],
    'local.rateLabel': ['1USD = 何円', '1 USD in JPY', '1USD = 몇 엔'],
    'local.rateNow': ['現在 1USD={rate}円', 'Now 1 USD = {rate} JPY', '현재 1USD={rate}엔'],
    'local.rateUnset': ['まだ入っていません。入れるまで原価の円表示は0になります。',
      'Not set yet. Yen costs show as 0 until you set it.',
      '아직 입력되지 않았습니다. 입력할 때까지 엔화 원가는 0으로 표시됩니다.'],
    'local.rateInvalid': ['為替は 0.01〜1000 の数で入れてください（例: 157.47）',
      'Enter a rate between 0.01 and 1000 (e.g. 157.47)',
      '환율은 0.01~1000 사이의 숫자로 입력해 주세요(예: 157.47)'],
    'local.pressExample': ['→ 1回押して{unit}なら {p}P（{yen}円）・原価 ${usd}',
      '→ one press of {unit}: {p}P (¥{yen}), cost ${usd}',
      '→ 한 번에 {unit}이면 {p}P({yen}원)·원가 ${usd}'],
    'local.bundleShow': ['中で走る{n}つの機能を見る', 'Show the {n} features it runs', '내부 {n}개 기능 보기'],
    'local.bundleHide': ['内訳を閉じる', 'Hide the breakdown', '내역 닫기'],
    'local.settingRows': ['設定（値段ではない行）', 'Settings (not prices)', '설정(가격이 아닌 행)'],
    /* ボタン×AIの会社ごとの原価（2026-11-09 要望）。会社で原価が1桁ちがう */
    'local.byProviderTitle': ['AIごとの原価', 'Cost per AI', 'AI별 원가'],
    'local.byProviderMeasured': ['実測 ${usd}/呼出（{n}呼出）', 'measured ${usd}/call ({n} calls)', '실측 ${usd}/호출({n}회)'],
    'local.byProviderNone': ['実測なし', 'not measured yet', '실측 없음'],
    'local.byProviderManual': ['手入力', 'entered', '직접 입력'],
    'local.byProviderHint': ['会社ごとに、1回あたりの原価をUSDで入れられます。空のままなら実測（呼び出しの平均）が出ます。',
      'Enter the USD cost per run for each AI. Left empty, the measured average per call is shown.',
      'AI별로 1회당 원가를 USD로 입력할 수 있습니다. 비우면 실측 평균이 표시됩니다.'],
    'local.usageLink': ['利用状況（原価・利用者ごと・作っているもの）', 'Usage (cost, per user, their work)', '이용 현황'],
    'local.perUnit': ['単位ごと', 'per unit', '단위마다'],
    'local.costEach': ['実測原価 ${yen}/回{jpy}（{n}回ぶん）・売値 {price}円',
      'Measured cost ${yen} per run{jpy} (from {n} runs) · price ¥{price}',
      '실측 원가 ${yen}/회{jpy}({n}회) · 판매가 {price}원'],
    'local.costTotalOnly': ['実測原価 合計${yen}{jpy}（回数が数えられていません）',
      'Measured cost ${yen} total{jpy} (runs not counted)',
      '실측 원가 합계 ${yen}{jpy}'],
    /* 原価を自分で測って入れる（2026-11-06 要望） */
    'local.costManualEach': ['原価 ${yen}/回{jpy}（自分で入れた値）・売値 {price}円',
      'Cost ${yen} per run{jpy} (entered by you) · price ¥{price}',
      '원가 ${yen}/회{jpy}(직접 입력) · 판매가 {price}원'],
    'local.costManualLabel': ['測った原価（1回あたりのUSD）', 'Measured cost (USD per run)', '측정한 원가(1회당 USD)'],
    'local.costAsk': ['原価 ${yen}/回{jpy}（未入力）・売値 {price}円',
      'Cost ${yen} per run{jpy} (not entered) · price ¥{price}',
      '원가 ${yen}/회{jpy}(미입력) · 판매가 {price}원'],
    'local.costManualHint': ['1回あたりのUSDで入れてください。入れると、この値が原価として使われます（利用状況のボタン別原価にも出ます）。空にすると実測の計算に戻ります。円は為替を掛けて出しています。',
      'Enter USD per run. When set, this is used as the cost (also on the usage screen). Clear it to go back to the measured calculation. Yen is converted with the exchange rate.',
      '1회당 USD로 입력해 주세요. 입력하면 이 값이 원가로 쓰입니다. 비우면 실측 계산으로 돌아갑니다. 엔화는 환율을 곱해 표시합니다.'],
    'local.costManualPlaceholder': ['例: 0.03', 'e.g. 0.03', '예: 0.03'],
    'local.costManualInvalid': ['原価は0以上の数で入れてください', 'Enter the cost as a number of 0 or more', '원가는 0 이상의 숫자로 입력해 주세요'],
    'local.costYenSuffix': ['（¥{n}）', ' (¥{n})', '(¥{n})'],
    'local.costRateNote': ['原価はUSDで入れます。円は 1USD={rate}円 で換算しています（下の「為替 1USD=何円 ×100」で変えられます）。',
      'Costs are entered in USD. Yen is converted at 1 USD = {rate} JPY (change it in the exchange-rate row below).',
      '원가는 USD로 입력합니다. 엔화는 1USD={rate}엔으로 환산했습니다(아래 환율 행에서 변경).'],
    'wfg.research': ['調べる', 'Research', '조사'],
    'wfg.build': ['作る', 'Build', '제작'],
    'wfg.deliver': ['届ける', 'Deliver', '전달'],
    'local.featureNameLabel': ['機能名（任意）', 'Feature name (optional)', '기능 이름(선택)'],
    'local.featureNamePlaceholder': ['例: キービジュアル生成', 'e.g. Key visual generation', '예: KV 생성'],
    'local.featureKeyPlaceholder': ['例: kv_generation', 'e.g. kv_generation', '예: kv_generation'],
    'local.creditCostPlaceholder': ['例: 20', 'e.g. 20', '예: 20'],
    'local.featureKeyRequired': ['機能キーを入力してください', 'Please enter a feature key', '기능 키를 입력해 주세요'],
    'local.featureKeyTooLong': ['機能キーは40文字までです', 'A feature key can be up to 40 characters', '기능 키는 40자까지입니다'],
    'local.addRowDone': ['行を追加しました。保存して戻ると反映されます', 'Row added. Save to apply it.', '행을 추가했습니다. 저장하면 반영됩니다'],
    'local.estimateSub': ['合計 {n}P × 単価 {price}円', '{n} P total x {price} yen', '합계 {n}P × 단가 {price}엔'],
    'local.savedCount': ['{n}件を保存しました', 'Saved {n} rows', '{n}건을 저장했습니다'],
    'local.nothingToSave': ['変更はありません', 'No changes to save', '변경 사항이 없습니다'],
    'local.saveFailedPartial': [
      '一部の行だけ保存された状態で失敗しました。画面を開き直して内容を確認してください。',
      'The save failed partway through. Please reopen this screen and check the rows.',
      '일부 행만 저장된 상태에서 실패했습니다. 화면을 다시 열어 내용을 확인해 주세요.'
    ],
    'local.save': ['保存', 'Save', '저장'],
    'local.saving': ['保存中…', 'Saving…', '저장 중…'],
    'local.processing': ['処理中…', 'Working…', '처리 중…'],
    'local.backToAdmin': ['管理画面へ戻る', 'Back to admin', '관리 화면으로 돌아가기'],
    'local.currentUnitPrice': ['現在の単価 {price}円', 'Current unit price: {price} yen', '현재 단가 {price}엔']
  };

  /* ---------- 小さな道具 ---------- */
  var missingWarned = {};

  function localeIndex() {
    var code = 'ja';
    if (window.I18N && typeof window.I18N.getLocale === 'function') {
      code = String(window.I18N.getLocale() || 'ja');
    } else if (typeof App.getLang === 'function') {
      code = String(App.getLang() || 'ja');
    }
    if (code === 'en') { return 1; }
    if (code === 'ko') { return 2; }
    return 0;
  }

  function fillParams(text, params) {
    var out = String(text);
    if (!params) { return out; }
    Object.keys(params).forEach(function (name) {
      out = out.split('{' + name + '}').join(String(params[name]));
    });
    return out;
  }

  function t(key, params) {
    if (window.I18N && typeof window.I18N.t === 'function') { return window.I18N.t(key, params); }
    if (typeof App.t === 'function') { return App.t(key, params); }
    return fillParams(key, params);
  }

  function tl(key, params) {
    var row = LOCAL[key];
    if (!row) {
      console.error('[screens-admin] このファイルの辞書に ' + key + ' がありません。キーをそのまま表示します。');
      return key;
    }
    return fillParams(row[localeIndex()] || row[0], params);
  }

  /* AIの名前。記録にあるのは短い綴りなので、読める形にして出す。
     知らない綴りはそのまま出す（新しいAIを足したとき、空白にしない） */
  var PROVIDER_NAMES = {
    chatgpt: 'ChatGPT（画像）',
    openai: 'OpenAI',
    claude: 'Claude（文章）',
    deepseek: 'DeepSeek（文章）',
    gemini: 'Gemini',
    replicate: 'Replicate'
  };

  function providerName(key) {
    var k = String(key || '').toLowerCase();
    return PROVIDER_NAMES[k] || String(key || '-');
  }

  function textOf(value) {
    if (value === undefined || value === null) { return ''; }
    return String(value);
  }

  function intOf(value) {
    var raw = textOf(value).trim();
    if (raw === '') { return NaN; }
    var num = Number(raw);
    if (!isFinite(num)) { return NaN; }
    if (Math.floor(num) !== num) { return NaN; }
    return num;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function dateOnly(value) {
    var text = textOf(value);
    if (text.length >= 10 && text.charAt(4) === '-' && text.charAt(7) === '-') { return text.slice(0, 10); }
    var d = new Date(text);
    if (isNaN(d.getTime())) { return ''; }
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayString() {
    if (window.Api && typeof window.Api.today === 'function') { return window.Api.today(); }
    return dateOnly(new Date());
  }

  var uidCount = 0;
  function uid(prefix) {
    uidCount += 1;
    return prefix + '-' + uidCount;
  }

  function el(tag, className, textContent) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (textContent !== undefined && textContent !== null) { node.textContent = String(textContent); }
    return node;
  }

  function clearNode(node) {
    if (!node) { return node; }
    while (node.firstChild) { node.removeChild(node.firstChild); }
    return node;
  }

  function button(className, label, onClick) {
    var node = el('button', className, label);
    node.type = 'button';
    if (typeof onClick === 'function') { node.addEventListener('click', onClick); }
    return node;
  }

  function busy(node, on, busyLabel, normalLabel) {
    if (!node) { return; }
    node.disabled = !!on;
    node.textContent = on ? busyLabel : normalLabel;
  }

  function needApp(name) {
    if (typeof App[name] === 'function') { return App[name]; }
    if (!missingWarned['App.' + name]) {
      missingWarned['App.' + name] = true;
      console.error('[screens-admin] App.' + name + ' がありません。app.js が公開している名前を確認してください。');
    }
    return null;
  }

  function toast(message, kind) {
    var fn = needApp('toast');
    if (fn) { fn(message, kind); return; }
    console.error('[screens-admin] トーストを表示できません: ' + message);
  }

  function handleError(err, retry) {
    var fn = needApp('handleError');
    if (fn) { fn(err, retry); return; }
    console.error('[screens-admin] エラーを表示できません', err);
  }

  function closeModal() {
    var fn = needApp('closeModal');
    if (fn) { fn(); }
  }

  function fmtNumber(value) {
    var fn = needApp('formatNumber');
    if (fn) { return fn(value); }
    return String(Math.round(Number(value) || 0));
  }

  function fmtYen(value) {
    var fn = needApp('formatYen');
    if (fn) { return fn(value); }
    return '¥' + String(Math.round(Number(value) || 0));
  }

  function fmtDate(value) {
    var fn = needApp('formatDate');
    if (fn) { return fn(value); }
    return dateOnly(value);
  }

  function goto(id, params, useReplace) {
    var name = useReplace ? 'replace' : 'navigate';
    var fn = needApp(name);
    if (fn) { fn(id, params || null); return; }
    window.location.hash = '#/' + id;
  }

  /* ---------- 通信のうすい包み（無い名前は必ず知らせる） ---------- */
  function missingApiError(name) {
    var err = new Error(tl('local.apiMissing', { name: name }));
    err.code = 'missing';
    return err;
  }

  function tableOf(name) {
    var table = window.Api ? window.Api[name] : null;
    if (table && typeof table.list === 'function') { return table; }
    if (!missingWarned['Api.' + name]) {
      missingWarned['Api.' + name] = true;
      console.error('[screens-admin] Api.' + name + ' がありません。api.js が公開しているテーブル名を確認してください。');
    }
    return null;
  }

  function tableList(name, options) {
    var table = tableOf(name);
    if (!table) { return Promise.reject(missingApiError('Api.' + name + '.list')); }
    return table.list(options);
  }

  function tableInsert(name, row) {
    var table = tableOf(name);
    if (!table || typeof table.insert !== 'function') {
      console.error('[screens-admin] Api.' + name + '.insert がありません。');
      return Promise.reject(missingApiError('Api.' + name + '.insert'));
    }
    return table.insert(row);
  }

  function tableUpdate(name, id, patch) {
    var table = tableOf(name);
    if (!table || typeof table.update !== 'function') {
      console.error('[screens-admin] Api.' + name + '.update がありません。');
      return Promise.reject(missingApiError('Api.' + name + '.update'));
    }
    return table.update(id, patch);
  }

  function creditsFn(name) {
    var credits = window.Api ? window.Api.credits : null;
    if (credits && typeof credits[name] === 'function') { return credits[name]; }
    if (!missingWarned['Api.credits.' + name]) {
      missingWarned['Api.credits.' + name] = true;
      console.error('[screens-admin] Api.points.' + name + ' がありません。api.js を確認してください。');
    }
    return null;
  }

  /* ---------- 画面の共通部品 ---------- */
  function screenRoot() {
    return el('div', 'screen');
  }

  function head(titleText, leadText) {
    var node = el('div', 'screen__head');
    node.appendChild(el('h2', 'screen__title', titleText));
    if (leadText) { node.appendChild(el('p', 'screen__lead', leadText)); }
    return node;
  }

  function section(titleText, descText, children) {
    var node = el('section', 'section');
    var headNode = el('div', 'section__head');
    headNode.appendChild(el('h3', 'section__title', titleText));
    if (descText) { headNode.appendChild(el('p', 'section__desc', descText)); }
    node.appendChild(headNode);
    (children || []).forEach(function (child) {
      if (child) { node.appendChild(child); }
    });
    return node;
  }

  function statCard(labelText, valueText, unitText, subText) {
    var card = el('div', 'card card--soft');
    card.appendChild(el('div', 'card__label', labelText));
    var value = el('div', 'card__value num', valueText);
    if (unitText) { value.appendChild(el('span', 'card__unit', unitText)); }
    card.appendChild(value);
    if (subText) { card.appendChild(el('div', 'card__sub', subText)); }
    return card;
  }

  function textInput(value, options) {
    var o = options || {};
    var node = el('input', 'input');
    /* 鍵を打つ欄は伏せ字にする（2026-11-09）。肩越しに読まれるのを防ぐ。
       autocomplete='off' と合わせて、ブラウザにも覚えさせない */
    node.type = o.password ? 'password' : 'text';
    node.value = textOf(value);
    if (o.placeholder) { node.placeholder = o.placeholder; }
    if (o.id) { node.id = o.id; }
    if (o.maxLength) { node.maxLength = o.maxLength; }
    node.autocomplete = 'off';
    return node;
  }

  function numberInput(value, options) {
    var o = options || {};
    var node = el('input', 'input');
    node.type = 'number';
    node.inputMode = 'numeric';
    node.step = o.step ? String(o.step) : '1';
    if (o.step && o.step !== '1') { node.inputMode = 'decimal'; }
    node.min = o.min === undefined ? '0' : String(o.min);
    if (o.max !== undefined) { node.max = String(o.max); }
    node.value = (value === null || value === undefined) ? '' : String(value);
    if (o.placeholder) { node.placeholder = o.placeholder; }
    if (o.id) { node.id = o.id; }
    if (o.narrow) {
      /* 行の中に置く数値欄だけ幅を詰める。styles.css に行内用の幅指定が無いためここで指定する */
      node.style.width = '104px';
      node.style.textAlign = 'right';
    }
    return node;
  }

  function dateInput(value, options) {
    var o = options || {};
    var node = el('input', 'input');
    node.type = 'date';
    node.value = textOf(value);
    if (o.id) { node.id = o.id; }
    return node;
  }

  function field(labelText, inputNode, hintText) {
    var wrap = el('div', 'field');
    var id = inputNode.id || uid('f');
    inputNode.id = id;
    var label = el('label', 'field__label', labelText);
    label.setAttribute('for', id);
    wrap.appendChild(label);
    wrap.appendChild(inputNode);
    if (hintText) { wrap.appendChild(el('p', 'field__hint', hintText)); }
    var error = el('p', 'field__error', '');
    error.hidden = true;
    wrap.appendChild(error);
    wrap.errorNode = error;
    return wrap;
  }

  function setFieldError(fieldWrap, inputNode, message) {
    if (!fieldWrap || !fieldWrap.errorNode) { return; }
    fieldWrap.errorNode.textContent = message || '';
    fieldWrap.errorNode.hidden = !message;
    if (inputNode) { inputNode.classList.toggle('input--error', !!message); }
  }

  function infoRow(keyText, valueText) {
    var row = el('div', 'info-row');
    row.appendChild(el('span', 'info-row__key', keyText));
    row.appendChild(el('span', 'info-row__val', valueText));
    return row;
  }

  function emptyBlock(message) {
    var node = el('div', 'empty');
    node.appendChild(el('p', 'empty__text', message));
    return node;
  }

  function showLoading(root) {
    var fn = needApp('showLoading');
    if (fn) { fn(root, { rows: 3 }); return; }
    clearNode(root);
    root.appendChild(el('p', 'loading-text', t('common.loading')));
  }

  function showLoadError(root, err, retry) {
    clearNode(root);
    var wrap = screenRoot();
    var block = needApp('errorBlock');
    if (block) {
      wrap.appendChild(block(t('admin.loadFailed'), retry));
    } else {
      var fallback = el('div', 'banner');
      fallback.appendChild(el('p', 'banner__text', t('admin.loadFailed')));
      fallback.appendChild(button('banner__retry', t('common.retry'), retry));
      wrap.appendChild(fallback);
    }
    wrap.appendChild(el('p', 't-note', textOf(err && err.message)));
    root.appendChild(wrap);
  }

  /* ---------- 管理者判定（非管理者はダッシュボードへ戻す） ---------- */
  function ensureAdmin(screenId, root) {
    var isAdmin;
    if (typeof App.isAdmin === 'function') {
      isAdmin = !!App.isAdmin();
    } else {
      console.error('[screens-admin] App.isAdmin がありません。ユーザー情報の is_admin から直接判定します。');
      var user = (typeof App.getUser === 'function') ? App.getUser() : null;
      isAdmin = !!(user && user.is_admin);
    }
    if (isAdmin) { return true; }

    console.warn('[screens-admin] ' + screenId + ' は管理者専用です。ダッシュボード(S3)へ戻します。');
    if (root) {
      clearNode(root);
      var wrap = screenRoot();
      var box = el('div', 'warn-box', t('admin.notAdminNotice'));
      wrap.appendChild(box);
      wrap.appendChild(el('p', 't-note', tl('local.notAdminBody')));
      wrap.appendChild(button('btn btn--secondary btn--block', t('admin.backToDashboard'), function () { goto('S3', null, true); }));
      root.appendChild(wrap);
    }
    toast(t('admin.notAdminNotice'), 'danger');
    goto('S3', null, true);
    return false;
  }

  /* ---------- ユーザーの見え方 ---------- */
  function displayNameOf(user) {
    var name = textOf(user && user.display_name).trim();
    if (name) { return name; }
    var email = textOf(user && user.email).trim();
    if (email) { return email; }
    return tl('local.userNameFallback');
  }

  function isActiveUser(user) {
    var status = textOf(user && user.user_status).trim();
    if (!status) { return true; }
    return status !== 'suspended' && status !== 'stopped';
  }

  function unlimitedUntilOf(user) {
    var until = dateOnly(user && user.unlimited_until);
    if (!until) { return ''; }
    var check = creditsFn('hasUnlimited');
    if (check) { return check(user) ? until : ''; }
    return until >= todayString() ? until : '';
  }

  function statusBadge(user) {
    var active = isActiveUser(user);
    return el('span', active ? 'badge badge--ok' : 'badge badge--danger',
      active ? t('admin.userStatusActive') : t('admin.userStatusSuspended'));
  }

  /* ---------- 問い合わせの見え方 ---------- */
  function inquiryStatusOf(row) {
    var raw = textOf(row && row.inquiry_status).trim();
    var found = null;
    INQUIRY_STATUSES.forEach(function (one) {
      if (one.value === raw) { found = one; }
    });
    if (found) { return found; }
    if (raw === 'inProgress' || raw === 'progress') { return INQUIRY_STATUSES[1]; }
    if (raw === 'closed' || raw === 'resolved') { return INQUIRY_STATUSES[2]; }
    return INQUIRY_STATUSES[0];
  }

  /* ---------- 機能別クレジットの既定名 ---------- */
  function defaultFeatureName(key) {
    var index = localeIndex();
    var found = '';
    FEATURE_DEFAULTS.forEach(function (def) {
      if (def.key === key) { found = def.name[index] || def.name[0]; }
    });
    return found || key;
  }

  /* 購入プランの JSON を読む。壊れた行で管理画面が開かなくなるほうが困るので、
     読めない値は黙って捨てる（捨てたことは console に残す）。
     同じ判定を stripe-checkout も持っている。金額を決めるのは向こう。 */
  function parsePlans(value) {
    var raw;
    try {
      raw = JSON.parse(String(value || '[]'));
    } catch (err) {
      console.error('[screens-admin] purchase_plans が JSON として読めません', err);
      return [];
    }
    if (!Array.isArray(raw)) { return []; }
    var out = [];
    raw.forEach(function (item) {
      var credits = Math.round(Number(item && item.credits));
      var yen = Math.round(Number(item && item.yen));
      if (!(credits > 0) || !(yen > 0)) { return; }
      if (out.length >= MAX_PLANS) { return; }
      out.push({ id: textOf(item && item.id).trim(), credits: credits, yen: yen });
    });
    return out;
  }

  function unitPriceOf(rows) {
    var price = DEFAULT_UNIT_PRICE;
    (rows || []).forEach(function (row) {
      if (textOf(row.feature_key).trim() !== UNIT_PRICE_KEY) { return; }
      var value = Number(row.credit_cost);
      if (value > 0) { price = Math.round(value); }
    });
    return price;
  }

  function unitPriceRowId(rows) {
    var id = null;
    (rows || []).forEach(function (row) {
      if (textOf(row.feature_key).trim() === UNIT_PRICE_KEY) { id = row.id; }
    });
    return id;
  }

  /* =========================================================
   * S18 管理画面
   * ========================================================= */
  function renderAdmin(root) {
    if (!ensureAdmin('S18', root)) { return; }

    var state = {
      unitPrice: DEFAULT_UNIT_PRICE,
      unitRowId: null,
      featureCount: 0,
      users: [],
      purchases: [],
      tab: 'users',
      inquiries: [],
      coupons: [],
      todayCredits: 0,
      todayCount: 0,
      couponType: 'credit',
      selectors: [],        // 収集設定（KV/LP × プラットフォーム）
      selectorsBusy: false,
      adTag: '',            // 広告の札（061 の app_settings）
      plans: []             // 購入プラン（062 の app_settings）。[{ id, credits, yen }]
    };

    load();

    function load() {
      showLoading(root);
      Promise.all([
        tableList('featureCredits', { order: 'created_at.asc' }),
        tableList('users', { order: 'created_at.desc', limit: USER_LIMIT }),
        tableList('creditTransactions', { order: 'created_at.desc', limit: TX_SCAN_LIMIT }),
        tableList('inquiries', { order: 'created_at.desc', limit: INQUIRY_LIMIT }),
        tableList('coupons', { order: 'created_at.desc', limit: COUPON_LIMIT }),
        /* 売上。purchase の行だけを別に読む（本日分の集計は直近300件しか見ないため） */
        tableList('creditTransactions', {
          eq: { transaction_type: 'purchase' }, order: 'created_at.desc', limit: PURCHASE_LIMIT
        }).catch(function () { return []; }),
        tableList('platformSelectors', { order: 'platform.asc' }),
        /* AIにかかった費用。どのAIに払ったかで分けて、月ごとに集計したものを
           サーバーから受け取る（2026-11-06 要望）。
           画面で足していたころは、文章生成の費用が丸ごと抜けていて、
           しかも1000行の頭打ちで数か月後には黙って減るはずだった。
           読めなくても管理画面は開けるようにする（原価は飾り） */
        Api.rpc('elpiya_admin_ai_cost_by_provider', {})
          .catch(function () { return []; }),
        /* 広告の札。読めなくても管理画面は開ける */
        tableList('appSettings', { eq: { key: 'admax_tag' }, order: false, limit: 1 })
          .catch(function () { return []; }),
        /* 購入プラン。読めなくても管理画面は開ける（購入は Edge Function の既定で動く） */
        tableList('appSettings', { eq: { key: PLANS_KEY }, order: false, limit: 1 })
          .catch(function () { return []; }),
        /* AIの鍵の状態（本体は返らない。入っているか・末尾4文字だけ） */
        (Api.providerKeys && typeof Api.providerKeys.state === 'function'
          ? Api.providerKeys.state('service') : Promise.resolve([]))
          .catch(function () { return []; }),
        /* どの会社で文章を作るか＋どのモデルで動かすか（077）。
           1回で取る。読めなくても管理画面は開ける */
        tableList('appSettings', {
          in: { key: ['text_provider', 'claude_model', 'deepseek_model', 'image_model'] },
          order: false
        }).catch(function () { return []; }),
        /* モデルごとの単価（078）。読めなくても管理画面は開ける */
        tableList('aiModelRates', { order: 'model.asc' })
          .catch(function () { return []; })
      ]).then(function (results) {
        var featureRows = results[0] || [];
        state.unitPrice = unitPriceOf(featureRows);
        state.unitRowId = unitPriceRowId(featureRows);
        /* 為替は料金設定の耳にも出す（2026-11-08）。S18 では state.rows を
           作っていないので、この行だけここで控える */
        /* AIの鍵と、どのAIで文章を作るか（2026-11-09）。
           読めなくても管理画面は開けるようにする */
        state.providerKeys = results[10] || [];
        state.appSettings = {};
        (results[11] || []).forEach(function (r) {
          state.appSettings[textOf(r.key)] = textOf(r.value);
        });
        state.textProvider = String(state.appSettings.text_provider || 'claude');
        state.modelRates = results[12] || [];
        state.rateRow = null;
        featureRows.forEach(function (row) {
          if (textOf(row.feature_key).trim() === 'usdjpy_x100') {
            state.rateRow = { id: row.id, cost: Number(row.credit_cost) || 0 };
          }
        });
        /* キーのままでは管理者に読めない（crowdfunding_lp と出る）。
           feature_name を引けるように控えておく */
        state.featureNames = {};
        featureRows.forEach(function (row) {
          var k = textOf(row.feature_key).trim();
          if (k && k !== UNIT_PRICE_KEY) { state.featureNames[k] = textOf(row.feature_name).trim() || k; }
        });
        state.featureCount = 0;
        featureRows.forEach(function (row) {
          if (textOf(row.feature_key).trim() !== UNIT_PRICE_KEY) { state.featureCount += 1; }
        });
        state.users = results[1] || [];
        applyToday(results[2] || []);
        state.inquiries = results[3] || [];
        state.coupons = results[4] || [];
        state.purchases = results[5] || [];
        state.adTag = String((results[8] && results[8][0] && results[8][0].value) || '');
        state.plans = parsePlans(results[9] && results[9][0] && results[9][0].value);
        state.selectors = results[6] || [];
        state.aiCost = results[7] || [];
        draw();
      }, function (err) {
        console.error('[screens-admin] 管理データの読み込みに失敗しました', err);
        showLoadError(root, err, load);
      });
    }

    /* ponytail: 本日分は直近300件の履歴を端末の日付で数えるだけ。
       件数が増えたら created_at の範囲フィルタ（gte）に切り替える。 */
    function applyToday(rows) {
      var today = todayString();
      var credits = 0;
      var count = 0;
      rows.forEach(function (row) {
        if (textOf(row.transaction_type) !== 'consume') { return; }
        if (dateOnly(row.created_at) !== today) { return; }
        credits += Math.abs(Math.round(Number(row.credit_amount) || 0));
        count += 1;
      });
      state.todayCredits = credits;
      state.todayCount = count;
    }

    function draw() {
      clearNode(root);
      var wrap = screenRoot();

      wrap.appendChild(head(t('admin.title'), tl('local.adminLead')));

      var stats = el('div', 'stat-grid');
      stats.appendChild(statCard(t('admin.creditUnitPrice'), fmtYen(state.unitPrice), '', tl('local.unitPriceSub')));
      stats.appendChild(statCard(t('admin.todayUsage'), fmtNumber(state.todayCredits), t('common.creditShort'), tl('local.todaySub', { n: fmtNumber(state.todayCount) })));
      wrap.appendChild(stats);

      /* 1枚に全部を縦積みすると、承認待ちを見るだけで何度もスクロールすることになる。
         用がある面だけ出す（TTALKKAK の管理画面と同じ並べ方）。 */
      wrap.appendChild(tabBar());

      var body = el('div', 'stack stack--group');
      sectionsOf(state.tab).forEach(function (node) {
        if (node) { body.appendChild(node); }
      });
      wrap.appendChild(body);

      var actions = el('div', 'stack stack--group');
      actions.appendChild(button('btn btn--text btn--block', t('admin.backToDashboard'), function () {
        goto('S3');
      }));
      wrap.appendChild(actions);

      root.appendChild(wrap);
    }

    /* 面の並び。TTALKKAK 側（회원·크레딧／결제·환불／사용량·비용／요금 설정／…）に合わせてある */
    var TABS = [
      { key: 'users', label: 'local.tabUsers' },
      { key: 'sales', label: 'local.tabSales' },
      { key: 'cost', label: 'local.tabCost' },
      { key: 'pricing', label: 'local.tabPricing' },
      { key: 'coupons', label: 'local.tabCoupons' },
      { key: 'inquiries', label: 'local.tabInquiries' },
      { key: 'settings', label: 'local.tabSettings' }
    ];

    function tabBar() {
      var bar = el('div', 'tabs');
      TABS.forEach(function (tab) {
        var cls = 'tabs__item' + (state.tab === tab.key ? ' tabs__item--active' : '');
        bar.appendChild(button(cls, tl(tab.label), function () {
          state.tab = tab.key;
          draw();
        }));
      });
      return bar;
    }

    function sectionsOf(key) {
      if (key === 'sales') { return [salesSection()]; }
      if (key === 'cost') {
        return [aiCostSection(), button('btn btn--secondary btn--block', tl('local.usageLink'), function () {
          goto('S22');
        })];
      }
      if (key === 'pricing') {
        return [unitPriceSection(), rateSection(), plansSection(), button('btn btn--secondary btn--block', t('admin.featurePricingLink'), function () {
          goto('S19');
        })];
      }
      if (key === 'coupons') { return [couponSection()]; }
      if (key === 'inquiries') { return [inquiriesSection()]; }
      if (key === 'settings') {
        return [aiSection(), modelRateSection(), adTagSection(), selectorsSection()];
      }
      /* 既定は会員。承認待ちは、待たせているあいだ相手がアプリに入れないので先頭に出す */
      return [pendingSection(), usersSection()];
    }

    /* ---- 決済・売上 ---- */
    function salesSection() {
      var rows = state.purchases || [];
      var thisMonth = new Date().toISOString().slice(0, 7);   // aiCostSection と同じく UTC の年月で揃える
      var total = 0, month = 0, monthCount = 0;
      rows.forEach(function (row) {
        var yen = Math.round(Number(row.amount_yen) || 0);
        total += yen;
        if (String(row.created_at || '').slice(0, 7) === thisMonth) {
          month += yen;
          monthCount += 1;
        }
      });

      var stats = el('div', 'stat-grid');
      stats.appendChild(statCard(tl('local.salesTotal'), fmtYen(total), '', tl('local.salesDesc', { n: fmtNumber(PURCHASE_LIMIT) })));
      stats.appendChild(statCard(tl('local.salesMonth'), fmtYen(month), '', tl('local.salesCountSub', { n: fmtNumber(monthCount) })));
      stats.appendChild(statCard(tl('local.salesCount'), fmtNumber(rows.length), '', ''));

      var children = [stats];
      if (!rows.length) {
        children.push(emptyBlock(tl('local.salesEmpty')));
        return section(tl('local.salesTitle'), '', children);
      }

      /* 誰の購入かは、読み込み済みの利用者一覧から引く（別に取りに行かない） */
      var mailOf = {};
      (state.users || []).forEach(function (user) {
        mailOf[String(user.id)] = textOf(user.email).trim() || displayNameOf(user);
      });

      var list = el('div', 'list');
      rows.forEach(function (row) {
        var yen = Math.round(Number(row.amount_yen) || 0);
        var points = Math.round(Number(row.credit_amount) || 0);
        var item = el('div', 'list-row');
        var bodyNode = el('div', 'list-row__body');
        bodyNode.appendChild(el('div', 'list-row__title clamp-1',
          mailOf[String(row.users_id)] || String(row.users_id || '').slice(0, 8)));
        bodyNode.appendChild(el('div', 'list-row__sub clamp-2',
          fmtDate(row.created_at) + ' ・ ' + tl('local.salesPoints', { n: fmtNumber(Math.abs(points)) })
          + (points < 0 ? ' ・ ' + tl('local.salesRefund') : '')));
        item.appendChild(bodyNode);
        var meta = el('div', 'list-row__meta');
        meta.appendChild(el('span', yen < 0 ? 'num t-danger' : 'num', fmtYen(yen)));
        item.appendChild(meta);
        list.appendChild(item);
      });
      children.push(list);
      return section(tl('local.salesTitle'), '', children);
    }


    /* ---- KV / LP 収集設定（運営だけが触る） ---- */
    var PLATFORM_LABELS = {
      makuake: 'Makuake',
      campfire: 'CAMPFIRE',
      greenfunding: 'GREENFUNDING',
      machiya: 'Machi-ya',
      other: 'その他'
    };
    var MEDIA_KINDS = ['text', 'image', 'video'];

    function selectorsSection() {
      var rows = state.selectors.slice().sort(function (a, b) {
        if (a.platform === b.platform) { return a.kind < b.kind ? -1 : 1; }
        return a.platform < b.platform ? -1 : 1;
      });

      var body = el('div', 'stack');
      var seen = {};
      rows.forEach(function (row) {
        if (seen[row.platform]) { return; }
        seen[row.platform] = true;

        var card = el('div', 'card');
        var inner = el('div', 'stack');
        inner.appendChild(el('span', 'card__label', PLATFORM_LABELS[row.platform] || row.platform));

        ['kv', 'lp'].forEach(function (kind) {
          var conf = null;
          state.selectors.forEach(function (one) {
            if (one.platform === row.platform && one.kind === kind) { conf = one; }
          });
          if (!conf) { return; }

          var area = el('textarea', 'textarea');
          area.value = (conf.selectors || []).join('\n');
          area.setAttribute('placeholder', t('admin.selectorsPlaceholder'));
          area.addEventListener('input', function () {
            conf.selectors = area.value.split('\n').map(function (one) {
              return String(one).trim();
            }).filter(Boolean);
          });
          inner.appendChild(field(t(kind === 'kv' ? 'admin.selectorsKv' : 'admin.selectorsLp'), area));

          var chips = el('div', 'chips');
          MEDIA_KINDS.forEach(function (media) {
            var on = (conf.media || []).indexOf(media) !== -1;
            var chip = button('chip' + (on ? ' chip--selected' : ''), t('admin.media.' + media), function () {
              var list = (conf.media || []).slice();
              var at = list.indexOf(media);
              if (at === -1) { list.push(media); } else { list.splice(at, 1); }
              conf.media = list;
              draw();
            });
            chip.setAttribute('aria-pressed', on ? 'true' : 'false');
            chips.appendChild(chip);
          });
          inner.appendChild(chips);
        });

        card.appendChild(inner);
        body.appendChild(card);
      });

      var saveButton = button('btn btn--primary btn--block', t('admin.selectorsSave'), saveSelectors);
      saveButton.disabled = state.selectorsBusy;
      body.appendChild(saveButton);

      return section(t('admin.selectorsTitle'), t('admin.selectorsDesc'), [body]);
    }

    function saveSelectors() {
      if (state.selectorsBusy) { return; }
      state.selectorsBusy = true;
      draw();
      var jobs = state.selectors.map(function (row) {
        return window.Api.platformSelectors.update(row.id, {
          selectors: row.selectors || [],
          media: row.media || MEDIA_KINDS.slice()
        });
      });
      Promise.all(jobs).then(function () {
        state.selectorsBusy = false;
        draw();
        toast(t('admin.selectorsSaved'), 'success');
      }, function (err) {
        state.selectorsBusy = false;
        draw();
        console.error('[screens-admin] 収集設定を保存できませんでした', err);
        toast(errorMessage(err), 'danger');
      });
    }

    /* ---- クレジット単価 ---- */
    /* 広告の札（2026-11-04 要望）。生成中のポップアップに出る。
       空のあいだは何も出ない。顧客のLPには ads.js が出さない */
    function adTagSection() {
      var box = el('div', 'stack');
      var area = el('textarea', 'textarea');
      area.rows = 4;
      area.value = String(state.adTag || '');
      area.setAttribute('placeholder', tl('local.adTagPlaceholder'));
      box.appendChild(area);
      box.appendChild(el('p', 'field__hint', tl('local.adTagWarn')));
      var saveLabel = tl('local.save');
      var saveBtn = button('btn btn--primary', saveLabel, function () {
        busy(saveBtn, true, tl('local.saving'), saveLabel);
        var value = String(area.value || '').trim();
        tableUpdate('appSettings', 'admax_tag', { value: value, updated_at: new Date().toISOString() })
          .then(function () {
            busy(saveBtn, false, tl('local.saving'), saveLabel);
            state.adTag = value;
            if (window.LpyaAds && typeof window.LpyaAds._reset === 'function') { window.LpyaAds._reset(); }
            toast(tl('local.adTagSaved'), 'success');
          }, function (err) {
            busy(saveBtn, false, tl('local.saving'), saveLabel);
            console.error('[screens-admin] 広告の札を保存できませんでした', err);
            toast(t('admin.saveFailed'), 'danger');
          });
      });
      box.appendChild(saveBtn);
      return section(tl('local.adTagTitle'), tl('local.adTagDesc'), [box]);
    }

    /* ---- 購入プラン（2026-11-06 要望）----
       購入画面（S17）に並ぶカード。金額の出どころは app_settings の1行で、
       stripe-checkout も同じ行を読む。画面に金額を送らせない約束は変えていない。 */
    function plansSection() {
      var draft = state.plans.map(function (plan) {
        return { id: plan.id, credits: plan.credits, yen: plan.yen };
      });

      var host = el('div', 'stack');
      var addBtn = button('btn btn--secondary btn--block', tl('local.plansAdd'), function () {
        if (draft.length >= MAX_PLANS) {
          toast(tl('local.plansFull', { max: MAX_PLANS }), 'danger');
          return;
        }
        draft.push({ id: '', credits: 100, yen: 1000 });
        paintRows();
      });

      var saveLabel = t('admin.save');
      var saveBtn = button('btn btn--primary btn--block', saveLabel, function () { save(); });

      function paintRows() {
        clearNode(host);
        if (!draft.length) {
          host.appendChild(emptyBlock(tl('local.plansEmpty')));
        }
        draft.forEach(function (plan, index) {
          host.appendChild(planRow(plan, index));
        });
        addBtn.disabled = draft.length >= MAX_PLANS;
      }

      function planRow(plan, index) {
        var row = el('div', 'plan-edit');

        var credits = numberInput(plan.credits, { min: 1, max: 100000, id: uid('plan-credits') });
        credits.addEventListener('input', function () {
          plan.credits = intOf(credits.value);
          paintHint();
        });
        row.appendChild(field(tl('local.plansPoints'), credits));

        var yen = numberInput(plan.yen, { min: 1, max: 10000000, id: uid('plan-yen') });
        yen.addEventListener('input', function () {
          plan.yen = intOf(yen.value);
          paintHint();
        });
        var yenField = field(tl('local.plansYen'), yen);
        row.appendChild(yenField);

        /* 1ポイントあたりを出す。これが無いと、まとめ買いが得になっているか
           管理者が暗算することになる */
        var hint = el('p', 'field__hint num');
        yenField.appendChild(hint);
        function paintHint() {
          var c = Number(plan.credits), y = Number(plan.yen);
          hint.textContent = (c > 0 && y > 0)
            ? tl('local.plansPerPoint', { yen: fmtYen(Math.round((y / c) * 10) / 10) })
            : '';
        }
        paintHint();

        row.appendChild(button('btn btn--text', t('common.delete'), function () {
          draft.splice(index, 1);
          paintRows();
        }));

        return row;
      }

      function save() {
        var bad = draft.some(function (plan) {
          return !(plan.credits >= 1) || !(plan.yen >= 1);
        });
        if (bad) {
          toast(tl('local.plansInvalid'), 'danger');
          return;
        }

        var value = JSON.stringify(draft.slice(0, MAX_PLANS).map(function (plan, index) {
          return {
            /* id は購入のときに画面から送られてくる鍵。作り直すと、
               決済ページを開いたまま管理者が保存した人の購入が落ちる */
            id: plan.id || ('p' + Date.now().toString(36) + index),
            credits: Math.round(plan.credits),
            yen: Math.round(plan.yen)
          };
        }));

        busy(saveBtn, true, tl('local.saving'), saveLabel);
        tableUpdate('appSettings', PLANS_KEY, { value: value, updated_at: new Date().toISOString() })
          .then(function () {
            busy(saveBtn, false, tl('local.saving'), saveLabel);
            state.plans = parsePlans(value);
            toast(tl('local.plansSaved'), 'success');
          }, function (err) {
            busy(saveBtn, false, tl('local.saving'), saveLabel);
            console.error('[screens-admin] 購入プランを保存できませんでした', err);
            toast(t('admin.saveFailed'), 'danger');
          });
      }

      paintRows();
      return section(tl('local.plansTitle'), tl('local.plansDesc', { max: MAX_PLANS }),
        [host, addBtn, saveBtn]);
    }

    function unitPriceSection() {
      var input = numberInput(state.unitPrice, { min: 1, max: MAX_UNIT_PRICE, id: uid('unit-price') });
      var priceField = field(t('admin.priceLabel'), input, tl('local.currentUnitPrice', { price: fmtNumber(state.unitPrice) }));

      var saveLabel = t('admin.save');
      var saveBtn = button('btn btn--primary', saveLabel, function () { save(); });

      var row = el('div', 'row--input-action');
      row.appendChild(priceField);
      row.appendChild(saveBtn);

      input.addEventListener('input', function () {
        setFieldError(priceField, input, '');
      });

      function save() {
        var value = intOf(input.value);
        if (!(value >= 1) || value > MAX_UNIT_PRICE) {
          setFieldError(priceField, input, t('admin.priceInvalid'));
          input.focus();
          return;
        }
        setFieldError(priceField, input, '');
        busy(saveBtn, true, tl('local.saving'), saveLabel);

        var done = function () {
          toast(t('admin.saveSuccess'), 'success');
          load();
        };
        var fail = function (err) {
          busy(saveBtn, false, tl('local.saving'), saveLabel);
          console.error('[screens-admin] ポイント単価の保存に失敗しました', err);
          toast(t('admin.saveFailed'), 'danger');
          handleError(err, save);
        };

        if (state.unitRowId) {
          tableUpdate('featureCredits', state.unitRowId, {
            feature_name: UNIT_PRICE_NAME,
            credit_cost: value,
            is_active: true
          }).then(done, fail);
          return;
        }
        tableInsert('featureCredits', {
          feature_key: UNIT_PRICE_KEY,
          feature_name: UNIT_PRICE_NAME,
          credit_cost: value,
          is_active: true
        }).then(done, fail);
      }

      return section(t('admin.creditUnitPrice'), tl('local.unitPriceDesc'), [row]);
    }

    /* ---- AIの鍵と、使うAI（2026-11-09 要望）----
       鍵の本体はここにもDBにも残らない。Vault に入れ、戻ってくるのは
       「入っているか・末尾4文字・いつ入れたか」だけ（051 の作りを 071 で広げた）。

       写真は OpenAI だけ。文章は Claude か DeepSeek を選ぶ。
       切り替えは app_settings の text_provider に書く */
    /* models … 管理者が選べるモデル（077）。note は訳の鍵で、
       「賢い・高い」などの目印を出すためだけのもの。
       setting は app_settings の行の名前。
       **新しいモデルが出たらここに足す。** 足さなくても
       「その他（直接入力）」で打てるので、リリースを待たなくてよい */
    var AI_PROVIDERS = [
      { key: 'openai', name: 'OpenAI', use: 'image', setting: 'image_model', models: [
        { value: 'gpt-image-2', note: 'local.modelBalanced' },
        { value: 'gpt-image-1', note: 'local.modelFast' }
      ] },
      { key: 'anthropic', name: 'Claude（Anthropic）', use: 'text', setting: 'claude_model', models: [
        { value: 'claude-opus-5', note: 'local.modelBest' },
        { value: 'claude-sonnet-5', note: 'local.modelBalanced' },
        { value: 'claude-fable-5-1', note: 'local.modelBalanced' },
        { value: 'claude-haiku-4-5-20251001', note: 'local.modelFast' }
      ] },
      { key: 'deepseek', name: 'DeepSeek', use: 'text', setting: 'deepseek_model', models: [
        { value: 'deepseek-flash', note: 'local.modelFast' },
        { value: 'deepseek-v4-pro', note: 'local.modelNoImage' }
      ] }
    ];
    var TEXT_PROVIDERS = [
      { value: 'claude', label: 'Claude' },
      { value: 'deepseek', label: 'DeepSeek' }
    ];

    /* 会社ごとの「どのモデルで動かすか」。
       空＝指定しない（.worker-env → 既定値に落ちる）。
       一覧に無いモデルも打てるようにする（新しいものが出たとき、
       リリースを待たずに試せるようにしておく） */
    function modelField(prov) {
      var now = String((state.appSettings || {})[prov.setting] || '');
      var known = false;
      prov.models.forEach(function (m) { if (m.value === now) { known = true; } });

      var sel = el('select', 'select');
      var opts = [{ value: '', label: tl('local.modelDefault') }];
      prov.models.forEach(function (m) {
        opts.push({ value: m.value, label: m.value + '（' + tl(m.note) + '）' });
      });
      opts.push({ value: '__other', label: tl('local.modelOther') });
      opts.forEach(function (o) {
        var node = el('option', '', o.label);
        node.value = o.value;
        sel.appendChild(node);
      });
      /* 一覧に無い値が入っているときは「その他」を選んだ形で見せる。
         既定の '' と取り違えると、入っている指定が消えたように見える */
      sel.value = now ? (known ? now : '__other') : '';

      var free = textInput(known ? '' : now, {
        placeholder: tl('local.modelOtherPlaceholder'), maxLength: 80
      });
      free.hidden = sel.value !== '__other';

      var saveLabel = t('admin.save');
      var saveBtn = button('btn btn--primary', saveLabel, function () {
        var value = sel.value === '__other' ? String(free.value || '').trim() : sel.value;
        if (sel.value === '__other' && !value) {
          setFieldError(f, free, tl('local.modelOtherPlaceholder'));
          return;
        }
        setFieldError(f, free, '');
        busy(saveBtn, true, tl('local.saving'), saveLabel);
        tableUpdate('appSettings', prov.setting,
          { value: value, updated_at: new Date().toISOString() })
          .then(function () {
            state.appSettings[prov.setting] = value;
            toast(t('admin.saveSuccess'), 'success');
            draw();
          }, function (err) {
            busy(saveBtn, false, tl('local.saving'), saveLabel);
            console.error('[screens-admin] モデルを替えられませんでした', err);
            setFieldError(f, free, errorText(err));
          });
      });

      sel.addEventListener('change', function () {
        free.hidden = sel.value !== '__other';
        if (!free.hidden) { free.focus(); }
      });

      var f = field(tl('local.modelLabel', { name: prov.name }), sel,
        prov.use === 'text' ? tl('local.modelCostNote') : tl('local.modelHint'));
      /* 直接入力の欄は選び口のすぐ下。見出しは選び口を指したままにする */
      f.insertBefore(free, sel.nextSibling);

      var row = el('div', 'row--input-action');
      row.appendChild(f);
      row.appendChild(saveBtn);
      return row;
    }

    function aiSection() {
      var box = el('div', 'stack');

      /* どのAIで文章を作るか */
      var pickWrap = el('div', 'field');
      pickWrap.appendChild(el('span', 'field__label', tl('local.aiPickTitle')));
      var chips = el('div', 'chips');
      TEXT_PROVIDERS.forEach(function (one) {
        var on = String(state.textProvider || 'claude') === one.value;
        var chip = button('chip' + (on ? ' chip--selected' : ''), one.label, function () {
          if (on) { return; }
          tableUpdate('appSettings', 'text_provider',
            { value: one.value, updated_at: new Date().toISOString() })
            .then(function () {
              state.textProvider = one.value;
              toast(t('admin.saveSuccess'), 'success');
              draw();
            }, function (err) {
              console.error('[screens-admin] 文章のAIを切り替えられませんでした', err);
              toast(t('admin.saveFailed'), 'danger');
            });
        });
        chips.appendChild(chip);
      });
      pickWrap.appendChild(chips);
      pickWrap.appendChild(el('p', 'field__hint', tl('local.aiPickDesc')));
      box.appendChild(pickWrap);

      /* 会社ごとの鍵 */
      AI_PROVIDERS.forEach(function (prov) {
        var now = null;
        (state.providerKeys || []).forEach(function (r) {
          if (String(r.provider) === prov.key) { now = r; }
        });

        var input = textInput('', {
          placeholder: tl('local.aiKeyPlaceholder'), maxLength: 200, password: true
        });
        var hint = now && now.has_key
          ? tl('local.aiKeySet', {
              tail: String(now.tail || '????'),
              when: String(now.updated_at || '').slice(0, 10)
            })
          : tl('local.aiKeyNone');
        var f = field(tl('local.aiKeyLabel', { name: prov.name }), input, hint);

        var saveLabel = t('admin.save');
        var saveBtn = button('btn btn--primary', saveLabel, function () {
          var value = String(input.value || '').trim();
          if (!value) { setFieldError(f, input, tl('local.aiKeyPlaceholder')); return; }
          setFieldError(f, input, '');
          busy(saveBtn, true, tl('local.saving'), saveLabel);
          Api.providerKeys.set(prov.key, value, 'service').then(function () {
            input.value = '';                    /* 打った鍵を画面に残さない */
            toast(tl('local.aiKeySaved'), 'success');
            load();
          }, function (err) {
            busy(saveBtn, false, tl('local.saving'), saveLabel);
            console.error('[screens-admin] 鍵を入れられませんでした', err);
            setFieldError(f, input, errorText(err));
          });
        });

        var row = el('div', 'row--input-action');
        row.appendChild(f);
        row.appendChild(saveBtn);
        box.appendChild(row);
        box.appendChild(modelField(prov));

        if (now && now.has_key) {
          var clear = button('btn btn--text btn--sm', tl('local.aiKeyClear'), function () {
            Api.providerKeys.set(prov.key, '', 'service').then(function () {
              toast(tl('local.aiKeyCleared'), 'success');
              load();
            }, function (err) {
              console.error('[screens-admin] 鍵を消せませんでした', err);
              toast(t('admin.saveFailed'), 'danger');
            });
          });
          box.appendChild(clear);
        }
        if (prov.use === 'image') {
          box.appendChild(el('p', 'field__hint', tl('local.aiImageNote')));
        }
      });

      return section(tl('local.aiTitle'), tl('local.aiDesc'), [box]);
    }

    /* 鍵を入れる欄が返す言い分を、そのまま出す（形が違う・短すぎる など） */
    function errorText(err) {
      var m = String((err && (err.message || err.hint)) || '').trim();
      return m || t('admin.saveFailed');
    }

    /* ---- 為替（2026-11-08 要望「為替レート設定するところはどこにある？」）----
       置き場は feature_credits の usdjpy_x100 で前からあったが、
       値段表のいちばん下の「設定（値段ではない行）」に紛れていて、
       **4階層＋2回のスクロール**の奥だった。しかも消費ポイントの欄を
       間借りしているので「売値 157,470円」と出ていて、設定値に見えなかった。
       原価の円換算はここだけで決まるので、ポイント単価の隣に出す。

       持ち方は ×100 の整数のまま（DBの credit_cost が integer なので）。
       画面では 157.47 と入れて、保存のときに100倍する。
       ×100 のまま入れさせると、157.47 と打った人の為替が 1.57円になる */

    /* S18（管理者ダッシュボード）は state.rateRow、
       S19（値段表）は state.rows。どちらから開いても同じ行を指す */
    function rateRow() {
      var found = null;
      (state.rows || []).forEach(function (r) {
        if (r.key === RATE_KEY) { found = { id: r.id, cost: Number(r.cost) || 0 }; }
      });
      return found || state.rateRow || null;
    }

    /* ---- モデル別の単価（2026-11-13 要望「モデルごとの単価表も作って」）----
       会社ごとに1つの単価では、Claude の中の差（Opus は Haiku の5倍）を
       計算に入れられない。行が無いモデルは会社の単価に落ちる（078）。
       単価は USD / 100万トークン を **そのまま** 入れる（×1000 はしない）*/
    var RATE_COLS = [
      { col: 'in_usd_per_mtok',  label: 'local.mrIn' },
      { col: 'out_usd_per_mtok', label: 'local.mrOut' },
      { col: 'cw_usd_per_mtok',  label: 'local.mrCw' },
      { col: 'cr_usd_per_mtok',  label: 'local.mrCr' }
    ];
    var MAX_MTOK_USD = 1000;   /* 100万tokで1000ドルを超えるのは打ち間違い */

    /* 画面に出すモデル … 単価の行があるもの＋いま選ばれているもの。
       「その他（直接入力）」で打った名前も拾うので、打った直後から単価を入れられる */
    function modelsForRates() {
      var seen = {};
      var out = [];
      function add(model, provider) {
        var name = String(model || '').trim();
        if (!name || seen[name.toLowerCase()]) { return; }
        seen[name.toLowerCase()] = true;
        out.push({ model: name, provider: provider || '' });
      }
      (state.modelRates || []).forEach(function (r) { add(r.model, r.provider); });
      AI_PROVIDERS.forEach(function (prov) {
        if (prov.use !== 'text') { return; }   /* 写真は1枚いくらで、トークンでは数えない */
        add(String((state.appSettings || {})[prov.setting] || ''),
          prov.key === 'anthropic' ? 'claude' : prov.key);
      });
      return out;
    }

    function modelRateRow(one) {
      var now = null;
      (state.modelRates || []).forEach(function (r) {
        if (String(r.model).toLowerCase() === one.model.toLowerCase()) { now = r; }
      });

      var wrap = el('div', 'stack stack--tight');
      var head = el('div', 'list-row__title clamp-1', one.model);
      wrap.appendChild(head);
      wrap.appendChild(el('div', 'list-row__meta',
        now ? tl('local.mrNote', { note: textOf(now.note) || '-' }) : tl('local.mrNew')));

      var inputs = {};
      var grid = el('div', 'admin-rate-grid');
      RATE_COLS.forEach(function (c) {
        var value = now && now[c.col] !== null && now[c.col] !== undefined ? Number(now[c.col]) : '';
        var node = numberInput(value === '' ? '' : value, {
          min: 0, max: MAX_MTOK_USD, step: '0.001', id: uid('mr')
        });
        inputs[c.col] = node;
        grid.appendChild(field(tl(c.label), node, ''));
      });
      wrap.appendChild(grid);

      var saveLabel = t('admin.save');
      var saveBtn = button('btn btn--primary btn--sm', saveLabel, function () { save(); });
      wrap.appendChild(saveBtn);

      function save() {
        var patch = { provider: one.provider || '', updated_at: new Date().toISOString() };
        var bad = false;
        RATE_COLS.forEach(function (c) {
          var raw = String(inputs[c.col].value || '').trim();
          /* 空欄は null（＝分からない）で送る。0 にすると「この料金は無い」の
             意味になり、会社の単価に落ちなくなる（078） */
          if (raw === '') {
            setFieldError(inputs[c.col].parentNode, inputs[c.col], '');
            patch[c.col] = null;
            return;
          }
          var num = Number(raw);
          if (!isFinite(num) || num < 0 || num > MAX_MTOK_USD) {
            setFieldError(inputs[c.col].parentNode, inputs[c.col], tl('local.mrInvalid'));
            bad = true;
            return;
          }
          setFieldError(inputs[c.col].parentNode, inputs[c.col], '');
          patch[c.col] = num;
        });
        if (bad) { return; }
        busy(saveBtn, true, tl('local.saving'), saveLabel);
        var done = function () { toast(t('admin.saveSuccess'), 'success'); load(); };
        var fail = function (err) {
          busy(saveBtn, false, tl('local.saving'), saveLabel);
          console.error('[screens-admin] モデルの単価を保存できませんでした', err);
          toast(t('admin.saveFailed'), 'danger');
        };
        if (now) {
          tableUpdate('aiModelRates', now.model, patch).then(done, fail);
          return;
        }
        patch.model = one.model;
        tableInsert('aiModelRates', patch).then(done, fail);
      }

      return wrap;
    }

    function modelRateSection() {
      var models = modelsForRates();
      var body;
      if (!models.length) {
        body = emptyBlock(tl('local.mrEmpty'));
      } else {
        body = el('div', 'list');
        models.forEach(function (one) { body.appendChild(modelRateRow(one)); });
      }
      return section(tl('local.mrTitle'), tl('local.mrDesc'), [body]);
    }

    function rateSection() {
      var row = rateRow();
      var now = row ? (Number(row.cost) || 0) / 100 : 0;
      var input = numberInput(now || '', {
        min: 0.01, max: MAX_RATE / 100, step: '0.01', id: uid('usdjpy')
      });
      var rateField = field(tl('local.rateLabel'), input,
        now ? tl('local.rateNow', { rate: now.toFixed(2) }) : tl('local.rateUnset'));

      var saveLabel = t('admin.save');
      var saveBtn = button('btn btn--primary', saveLabel, function () { save(); });
      var line = el('div', 'row--input-action');
      line.appendChild(rateField);
      line.appendChild(saveBtn);

      input.addEventListener('input', function () { setFieldError(rateField, input, ''); });

      function save() {
        var value = Number(String(input.value || '').trim());
        if (!(value > 0) || value * 100 > MAX_RATE) {
          setFieldError(rateField, input, tl('local.rateInvalid'));
          input.focus();
          return;
        }
        setFieldError(rateField, input, '');
        busy(saveBtn, true, tl('local.saving'), saveLabel);
        /* 画面は 157.47、DBは 15747。ここが唯一の変換点 */
        var stored = Math.round(value * 100);
        var done = function () { toast(t('admin.saveSuccess'), 'success'); load(); };
        var fail = function (err) {
          busy(saveBtn, false, tl('local.saving'), saveLabel);
          console.error('[screens-admin] 為替の保存に失敗しました', err);
          toast(t('admin.saveFailed'), 'danger');
          handleError(err, save);
        };
        var current = rateRow();
        if (current && current.id) {
          tableUpdate('featureCredits', current.id, { credit_cost: stored, is_active: true })
            .then(done, fail);
          return;
        }
        tableInsert('featureCredits', {
          feature_key: RATE_KEY, feature_name: RATE_NAME,
          credit_cost: stored, is_active: true
        }).then(done, fail);
      }

      return section(tl('local.rateTitle'), tl('local.rateDesc'), [line]);
    }

    /* ---- 承認待ち（2026-11-01 要望）----
       会員登録は管理者の許可制。許可するまで、その人は中のデータに触れない
       （止めているのは RLS。057_signup_approval.sql） */
    function pendingUsers() {
      return state.users.filter(function (u) {
        return textOf(u && u.user_status).trim() === 'pending';
      });
    }

    function pendingSection() {
      var waiting = pendingUsers();
      var body;
      if (!waiting.length) {
        body = emptyBlock(tl('local.pendingEmpty'));
      } else {
        body = el('div', 'list');
        waiting.forEach(function (user) { body.appendChild(pendingRow(user)); });
      }
      return section(tl('local.pendingTitle'),
        tl('local.pendingDesc', { n: fmtNumber(waiting.length) }), [body]);
    }

    function pendingRow(user) {
      var wrapRow = el('div', 'stack stack--tight');
      var line = el('div', 'list-row');
      var bodyNode = el('div', 'list-row__body');
      bodyNode.appendChild(el('div', 'list-row__title clamp-1', displayNameOf(user)));
      bodyNode.appendChild(el('div', 'list-row__sub clamp-1', textOf(user.email)));
      bodyNode.appendChild(el('div', 'list-row__meta',
        tl('local.pendingSince', { d: fmtDate(user.created_at) || '-' })));
      line.appendChild(bodyNode);

      var ops = el('div', 'btn-row');
      var ok = button('btn btn--primary btn--sm', tl('local.approve'), function () {
        setStatus(user, 'active', ok, tl('local.approved', { name: displayNameOf(user) }));
      });
      var ng = button('btn btn--secondary btn--sm', tl('local.reject'), function () {
        var reject = function () {
          setStatus(user, 'suspended', ng, tl('local.rejected', { name: displayNameOf(user) }));
        };
        /* 確認の窓はアプリ側が持つ（他の節と同じ入口を使う） */
        var confirmFn = needApp('confirm');
        if (!confirmFn) { reject(); return; }
        confirmFn({
          title: tl('local.rejectConfirm'),
          message: tl('local.rejectBody', { name: displayNameOf(user) }),
          confirmLabel: tl('local.reject'),
          danger: true,
          onConfirm: reject
        });
      });
      ops.appendChild(ok);
      ops.appendChild(ng);
      line.appendChild(ops);
      wrapRow.appendChild(line);
      return wrapRow;
    }

    /* 許可・却下はどちらも同じ RPC。状態を変えたら一覧を取り直す */
    function setStatus(user, status, node, okMessage) {
      var fn = creditsFn('setUserStatus');
      if (!fn) {
        console.error('[screens-admin] Api.credits.setUserStatus がありません');
        toast(t('admin.saveFailed'), 'danger');
        return;
      }
      node.disabled = true;
      fn(user.id, status).then(function () {
        user.user_status = status;
        toast(okMessage, 'success');
        load();
      }).catch(function (err) {
        node.disabled = false;
        console.error('[screens-admin] 利用者の状態を変えられませんでした', err);
        var detail = textOf(err && err.message);
        if (detail.indexOf('last_admin') !== -1) { toast(t('admin.lastAdmin'), 'danger'); return; }
        toast(t('admin.saveFailed'), 'danger');
      });
    }

    /* ---- ユーザー管理 ---- */
    function usersSection() {
      var body;
      if (!state.users.length) {
        body = emptyBlock(tl('local.usersEmpty'));
      } else {
        body = el('div', 'list');
        state.users.forEach(function (user) { body.appendChild(userRow(user)); });
      }
      return section(t('admin.userManagement'), tl('local.userSectionDesc', { n: fmtNumber(state.users.length) }), [body]);
    }

    function userRow(user) {
      var row = button('list-row', '', function () { openUserModal(user); });
      clearNode(row);

      var bodyNode = el('div', 'list-row__body');
      bodyNode.appendChild(el('div', 'list-row__title clamp-1', displayNameOf(user)));
      bodyNode.appendChild(el('div', 'list-row__sub clamp-1', textOf(user.email)));

      var meta = tl('local.balanceLabel') + ' ' + fmtNumber(user.credit_balance) + t('common.creditShort')
        + ' ・ ' + tl('local.joinedLabel') + ' ' + fmtDate(user.created_at);
      var until = unlimitedUntilOf(user);
      if (until) { meta += ' ・ ' + tl('local.unlimitedBadge', { date: fmtDate(until) }); }
      meta += ' ・ ' + (user.is_admin ? t('admin.roleAdmin') : t('admin.roleMember'));
      bodyNode.appendChild(el('div', 'list-row__meta clamp-2', meta));

      row.appendChild(bodyNode);
      row.appendChild(statusBadge(user));
      return row;
    }

    /* 機能の消費ではない行（チャージ・付与など）の呼び方。
       tl() は辞書に無いキーでエラーを出すので、LOCAL を直に見る */
    function txTypeName(type) {
      var k = textOf(type).trim();
      if (!k) { return ''; }
      return LOCAL['local.tx_' + k] ? tl('local.tx_' + k) : k;
    }

    /* 履歴1行。S17（ユーザー側）と同じ見え方にそろえる */
    function useHistoryRow(row) {
      var item = el('div', 'list-row');
      var body = el('div', 'list-row__body');
      /* 何に使ったか。feature_key が入っていればその名前、無ければ memo */
      var key = textOf(row.feature_key).trim();
      var what = (key && state.featureNames && state.featureNames[key])
        || key || txTypeName(row.transaction_type) || '—';
      body.appendChild(el('span', 'list-row__title clamp-1', what));
      var sub = fmtDate(row.created_at);
      var memo = textOf(row.memo || row.description).trim();
      if (memo) { sub += ' ・ ' + memo; }
      body.appendChild(el('span', 'list-row__sub clamp-2', sub));
      item.appendChild(body);

      var amount = Math.round(Number(row.credit_amount || row.amount) || 0);
      var meta = el('div', 'list-row__meta');
      meta.appendChild(el('span', amount < 0 ? 'num t-danger' : 'num t-ok',
        (amount > 0 ? '+' : '') + fmtNumber(amount)));
      if (row.balance_after !== null && row.balance_after !== undefined) {
        meta.appendChild(document.createElement('br'));
        meta.appendChild(el('span', 'num t-note',
          tl('local.useHistoryAfter') + ' ' + fmtNumber(row.balance_after)));
      }
      item.appendChild(meta);
      return item;
    }

    function openUserModal(user) {
      var open = needApp('openModal');
      if (!open) {
        toast(tl('local.apiMissing', { name: 'App.openModal' }), 'danger');
        return;
      }

      var modal = el('div', 'modal');
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.appendChild(el('p', 'modal__title', displayNameOf(user)));
      modal.appendChild(el('p', 'modal__note', tl('local.userActions')));

      var info = el('div', 'info-list');
      info.appendChild(infoRow(t('settings.email'), textOf(user.email)));
      info.appendChild(infoRow(tl('local.joinedLabel'), fmtDate(user.created_at)));
      info.appendChild(infoRow(tl('local.balanceLabel'), fmtNumber(user.credit_balance) + t('common.creditShort')));
      info.appendChild(infoRow(tl('local.statusLabel'), isActiveUser(user) ? t('admin.userStatusActive') : t('admin.userStatusSuspended')));
      info.appendChild(infoRow(t('admin.roleLabel'), user.is_admin ? t('admin.roleAdmin') : t('admin.roleMember')));
      var until = unlimitedUntilOf(user);
      info.appendChild(infoRow(t('admin.grantUnlimited'), until ? fmtDate(until) : tl('local.unlimitedNone')));
      modal.appendChild(info);

      /* ---- そのユーザーの使用履歴（2026-10-23 要望）----
         残高だけ見ても「何に使ったか」が分からず、問い合わせに答えられない。
         RLS は credit_transactions に elpiya_is_admin() を持っているので、
         管理者はそのまま他人のぶんも読める */
      modal.appendChild(el('p', 'modal__body', tl('local.useHistory')));
      var histHost = el('div', 'admin-hist');
      histHost.appendChild(el('p', 't-note', tl('local.useHistoryLoad')));
      modal.appendChild(histHost);
      if (window.Api && window.Api.credits && typeof window.Api.credits.history === 'function') {
        window.Api.credits.history(user.id, 30).then(function (rows) {
          clearNode(histHost);
          if (!rows || !rows.length) {
            histHost.appendChild(el('p', 't-note', tl('local.useHistoryEmpty')));
            return;
          }
          var list = el('div', 'list');
          rows.forEach(function (row) { list.appendChild(useHistoryRow(row)); });
          histHost.appendChild(list);
        }).catch(function (err) {
          console.error('[S18] 使用履歴を読めませんでした', err);
          clearNode(histHost);
          histHost.appendChild(el('p', 't-note t-danger', tl('local.useHistoryFail')));
        });
      }

      /* クレジット付与 */
      var creditInput = numberInput('', { min: 1, max: MAX_GRANT_CREDIT, placeholder: '100' });
      var creditField = field(tl('local.grantCreditLabel'), creditInput);
      var creditLabel = tl('local.grantAction');
      var creditBtn = button('btn btn--secondary', creditLabel, function () { grantCredit(1); });
      /* 減らすのも同じ入口（elpiya_apply_credit）。負の数を渡すだけで、
         残高より多く引けないことは DB 側が見ている。 */
      var deductLabel = tl('local.deductAction');
      var deductBtn = button('btn btn--secondary', deductLabel, function () { grantCredit(-1); });
      var creditRow = el('div', 'row--input-action');
      creditRow.appendChild(creditField);
      creditRow.appendChild(creditBtn);
      creditRow.appendChild(deductBtn);
      modal.appendChild(el('p', 'modal__body', t('admin.grantCredit')));
      modal.appendChild(creditRow);

      /* 無制限利用権の付与 */
      var daysInput = numberInput('', { min: 1, max: MAX_GRANT_DAYS, placeholder: '30' });
      var daysField = field(tl('local.grantUnlimitedLabel'), daysInput);
      var daysLabel = tl('local.grantAction');
      var daysBtn = button('btn btn--secondary', daysLabel, function () { grantUnlimited(); });
      var daysRow = el('div', 'row--input-action');
      daysRow.appendChild(daysField);
      daysRow.appendChild(daysBtn);
      modal.appendChild(el('p', 'modal__body', t('admin.grantUnlimited')));
      modal.appendChild(daysRow);

      /* 管理者権限の付与・停止 */
      var me = needApp('getUser') ? window.App.getUser() : null;
      var isSelf = !!(me && String(me.id) === String(user.id));
      if (!isSelf) {
        var roleLabel = user.is_admin ? t('admin.revokeAdmin') : t('admin.grantAdmin');
        var roleBtn = button(user.is_admin ? 'btn btn--danger btn--block' : 'btn btn--secondary btn--block',
          roleLabel, function () { toggleAdmin(); });
        modal.appendChild(el('p', 'modal__body', t('admin.roleLabel')));
        modal.appendChild(roleBtn);
      }

      /* 状態切替と閉じる */
      var actions = el('div', 'modal__actions');
      actions.appendChild(button('btn btn--secondary', t('common.close'), function () { closeModal(); }));
      actions.appendChild(button(isActiveUser(user) ? 'btn btn--danger' : 'btn btn--primary',
        isActiveUser(user) ? tl('local.toSuspend') : tl('local.toActivate'),
        function () { toggleStatus(); }));
      modal.appendChild(actions);

      open(modal, {});

      /* sign: 1 = 付与、-1 = 減算。入れる数は同じ欄から取る。 */
      function grantCredit(sign) {
        var minus = sign < 0;
        var btn = minus ? deductBtn : creditBtn;
        var label = minus ? deductLabel : creditLabel;
        var amount = intOf(creditInput.value);
        if (!(amount >= 1) || amount > MAX_GRANT_CREDIT) {
          setFieldError(creditField, creditInput, tl('local.grantAmountInvalid'));
          creditInput.focus();
          return;
        }
        setFieldError(creditField, creditInput, '');
        var grant = creditsFn('grant');
        if (!grant) {
          toast(tl('local.apiMissing', { name: 'Api.credits.grant' }), 'danger');
          return;
        }
        busy(btn, true, tl('local.processing'), label);
        grant(user.id, minus ? -amount : amount,
          tl(minus ? 'local.deductMemo' : 'local.grantMemo')).then(function () {
          closeModal();
          toast(tl(minus ? 'local.deductCreditDone' : 'local.grantCreditDone',
            { name: displayNameOf(user), n: fmtNumber(amount) }), 'success');
          load();
        }, function (err) {
          busy(btn, false, tl('local.processing'), label);
          console.error('[screens-admin] ポイントの増減に失敗しました', err);
          // 残高より多く引こうとしたときは、DB が insufficient を返す。
          // 「失敗しました」だけだと理由が分からないので、残高を出す。
          if (err && err.code === 'insufficient') {
            toast(tl('local.deductShortage', { n: fmtNumber(err.balance) }), 'danger');
            return;
          }
          toast(tl(minus ? 'local.deductFailed' : 'local.grantFailed'), 'danger');
          handleError(err, function () { grantCredit(sign); });
        });
      }

      function grantUnlimited() {
        var days = intOf(daysInput.value);
        if (!(days >= 1) || days > MAX_GRANT_DAYS) {
          setFieldError(daysField, daysInput, tl('local.grantDaysInvalid'));
          daysInput.focus();
          return;
        }
        setFieldError(daysField, daysInput, '');
        var grant = creditsFn('grantUnlimited');
        if (!grant) {
          toast(tl('local.apiMissing', { name: 'Api.credits.grantUnlimited' }), 'danger');
          return;
        }
        busy(daysBtn, true, tl('local.processing'), daysLabel);
        grant(user.id, days, tl('local.grantMemo')).then(function (result) {
          closeModal();
          toast(tl('local.grantUnlimitedDone', {
            name: displayNameOf(user),
            days: fmtNumber(days),
            until: fmtDate(result && result.unlimitedUntil)
          }), 'success');
          load();
        }, function (err) {
          busy(daysBtn, false, tl('local.processing'), daysLabel);
          console.error('[screens-admin] 無制限利用権の付与に失敗しました', err);
          toast(tl('local.grantFailed'), 'danger');
          handleError(err, grantUnlimited);
        });
      }

      function toggleAdmin() {
        var next = !user.is_admin;

        function run() {
          var setAdmin = creditsFn('setUserAdmin');
          if (!setAdmin) {
            toast(tl('local.apiMissing', { name: 'Api.credits.setUserAdmin' }), 'danger');
            return;
          }
          busy(roleBtn, true, tl('local.processing'), roleLabel);
          setAdmin(user.id, next).then(function () {
            closeModal();
            toast(t(next ? 'admin.grantAdminDone' : 'admin.revokeAdminDone',
              { name: displayNameOf(user) }), 'success');
            load();
          }, function (err) {
            busy(roleBtn, false, tl('local.processing'), roleLabel);
            console.error('[screens-admin] 管理者権限の変更に失敗しました', err);
            var detail = String((err && err.detail) || (err && err.message) || '');
            if (detail.indexOf('cannot_demote_self') !== -1) { toast(t('admin.cannotDemoteSelf'), 'danger'); return; }
            if (detail.indexOf('last_admin') !== -1) { toast(t('admin.lastAdmin'), 'danger'); return; }
            toast(t('admin.roleChangeFailed'), 'danger');
          });
        }

        var confirmFn = needApp('confirm');
        if (confirmFn) {
          confirmFn({
            title: t(next ? 'admin.grantAdminConfirm' : 'admin.revokeAdminConfirm'),
            message: t(next ? 'admin.grantAdminBody' : 'admin.revokeAdminBody', { name: displayNameOf(user) }),
            confirmLabel: next ? t('admin.grantAdmin') : t('admin.revokeAdmin'),
            danger: !next
          }, run);
          return;
        }
        run();
      }

      function toggleStatus() {
        var next = isActiveUser(user) ? 'suspended' : 'active';
        var statusWord = next === 'active' ? t('admin.userStatusActive') : t('admin.userStatusSuspended');

        function run() {
          // users への直接 PATCH は 001 で権限を落としてある（落とさないと
          // 利用者が自分の credit_balance や is_admin も書けてしまう）。管理操作はRPCを通す。
          var setStatus = creditsFn('setUserStatus');
          if (!setStatus) {
            toast(tl('local.apiMissing', { name: 'Api.credits.setUserStatus' }), 'danger');
            return;
          }
          setStatus(user.id, next).then(function () {
            closeModal();
            toast(tl('local.statusChanged', { name: displayNameOf(user), status: statusWord }), 'success');
            load();
          }, function (err) {
            console.error('[screens-admin] ユーザー状態の切り替えに失敗しました', err);
            toast(tl('local.statusChangeFailed'), 'danger');
            handleError(err, toggleStatus);
          });
        }

        var confirmFn = needApp('confirm');
        if (next === 'suspended' && confirmFn) {
          confirmFn({
            title: tl('local.suspendConfirmTitle'),
            message: tl('local.suspendConfirmBody', { name: displayNameOf(user) }),
            confirmLabel: t('admin.userStatusSuspended'),
            cancelLabel: t('common.cancel'),
            danger: true
          }).then(function (ok) {
            if (ok) { run(); }
          });
          return;
        }
        run();
      }
    }

    /* ---- AIにかかった費用（2026-10-23 要望 / 2026-11-06 AI別に分ける）----
       値付けの根拠が「請求画面を人が見る」しか無かった。
       サーバー（elpiya_admin_ai_cost_by_provider）が月×AI別に集計したものを
       そのまま並べる。ここで足さないのは、画面で足していたときに
       文章生成の費用が丸ごと抜けていたため（2026-11-06 実測で判明）。 */
    function aiCostSection() {
      if (!state.aiCost || !state.aiCost.length) {
        return section(tl('local.aiCostTitle'), tl('local.aiCostDesc'),
          [emptyBlock(tl('local.aiCostEmpty'))]);
      }

      /* 円はドルに為替を掛けた結果でしかない。どの為替かは RPC が返す */
      var aiRate = 0;
      function yenOfUsd(v) {
        if (!aiRate) { return ''; }
        return '¥' + fmtNumber(Math.round((Number(v) || 0) * aiRate));
      }

      /* 月ごとにまとめ、その中をAI別に並べる */
      var order = [];
      var byMonth = {};
      state.aiCost.forEach(function (row) {
        var key = textOf(row.month);
        if (!key) { return; }
        if (!byMonth[key]) { byMonth[key] = { usd: 0, cli: 0, lines: [] }; order.push(key); }
        var m = byMonth[key];
        var usd = Number(row.usd) || 0;
        m.usd += usd;
        m.cli += Number(row.cli_usd) || 0;
        if (!aiRate && Number(row.usd_jpy) > 0) { aiRate = Number(row.usd_jpy); }
        m.lines.push({
          provider: textOf(row.provider) || '-',
          kind: textOf(row.kind),
          tries: Number(row.tries) || 0,
          made: Number(row.made) || 0,
          calls: Number(row.calls) || 0,
          usd: usd
        });
      });
      order.sort().reverse();

      var list = el('div', 'list');
      order.forEach(function (key) {
        var m = byMonth[key];

        /* 月の見出し行。右に月の合計 */
        var head = el('div', 'list-row');
        var headBody = el('div', 'list-row__body');
        headBody.appendChild(el('div', 'list-row__title', key));
        headBody.appendChild(el('div', 'list-row__sub clamp-2',
          tl('local.aiCostMonthTotal')));
        head.appendChild(headBody);
        var headMeta = el('div', 'list-row__meta');
        headMeta.appendChild(el('span', 'num', '$' + m.usd.toFixed(2)));
        headMeta.appendChild(el('span', 'usage-yen', yenOfUsd(m.usd)));
        head.appendChild(headMeta);
        list.appendChild(head);

        /* AI別。絵は「投げた回数・枚数・1枚あたり」、文章は呼んだ回数を出す。
           同じ言い方にすると、文章の行に「0枚」と並んで読めなくなる */
        m.lines.sort(function (a, b) { return b.usd - a.usd; });
        m.lines.forEach(function (line) {
          var row = el('div', 'list-row list-row--sub');
          var body = el('div', 'list-row__body');
          body.appendChild(el('div', 'list-row__title', providerName(line.provider)));
          var sub;
          if (line.kind === 'image') {
            var rate = line.made ? (line.tries / line.made) : 0;
            sub = tl('local.aiCostTries') + ' ' + fmtNumber(line.tries)
              + ' ・ ' + tl('local.aiCostMade') + ' ' + fmtNumber(line.made)
              + (line.made ? ' ・ ' + tl('local.aiCostRate') + ' ' + rate.toFixed(2) + tl('local.aiCostTimes') : '');
          } else {
            sub = tl('local.aiCostCalls', { n: fmtNumber(line.calls) });
          }
          body.appendChild(el('div', 'list-row__sub clamp-2', sub));
          row.appendChild(body);
          var meta = el('div', 'list-row__meta');
          meta.appendChild(el('span', 'num', '$' + line.usd.toFixed(2)));
          meta.appendChild(el('span', 'usage-yen', yenOfUsd(line.usd)));
          row.appendChild(meta);
          list.appendChild(row);
        });
      });

      var wrap = el('div', 'stack stack--tight');
      wrap.appendChild(list);
      wrap.appendChild(el('p', 'field__hint', tl('local.aiCostNote')));
      return section(tl('local.aiCostTitle'), tl('local.aiCostDesc'), [wrap]);
    }

    /* ---- クーポン発行 ---- */
    function couponSection() {
      var codeInput = textInput('', { placeholder: tl('local.couponCodePlaceholder'), maxLength: 32 });
      var codeField = field(tl('local.couponCodeLabel'), codeInput);
      var generateBtn = button('btn btn--secondary', tl('local.couponGenerate'), function () {
        codeInput.value = makeCouponCode();
        setFieldError(codeField, codeInput, '');
      });
      var codeRow = el('div', 'row--input-action');
      codeRow.appendChild(codeField);
      codeRow.appendChild(generateBtn);

      var typeWrap = el('div', 'field');
      typeWrap.appendChild(el('span', 'field__label', tl('local.couponTypeLabel')));
      var chips = el('div', 'chips');
      var creditChip = button('chip', tl('local.couponTypeCredit'), function () { setType('credit'); });
      var unlimitedChip = button('chip', tl('local.couponTypeUnlimited'), function () { setType('unlimited'); });
      chips.appendChild(creditChip);
      chips.appendChild(unlimitedChip);
      typeWrap.appendChild(chips);

      var amountInput = numberInput(100, { min: 1, max: MAX_GRANT_CREDIT });
      var amountField = field(tl('local.couponCreditLabel'), amountInput);
      var daysInput = numberInput(30, { min: 1, max: MAX_GRANT_DAYS });
      var daysField = field(tl('local.couponDaysLabel'), daysInput);

      var usesInput = numberInput(1, { min: 1, max: MAX_COUPON_USES });
      var usesField = field(tl('local.couponMaxUsesLabel'), usesInput);
      var expiresInput = dateInput('');
      var expiresField = field(tl('local.couponExpiresLabel'), expiresInput);
      var pairRow = el('div', 'row--2');
      pairRow.appendChild(usesField);
      pairRow.appendChild(expiresField);

      var issueLabel = tl('local.couponIssueAction');
      var issueBtn = button('btn btn--primary btn--block', issueLabel, function () { issue(); });

      var listWrap = el('div', 'stack stack--group');
      listWrap.appendChild(el('h4', 'section__title', tl('local.couponListTitle')));
      if (!state.coupons.length) {
        listWrap.appendChild(emptyBlock(tl('local.couponEmpty')));
      } else {
        var list = el('div', 'list');
        state.coupons.forEach(function (coupon) { list.appendChild(couponRow(coupon)); });
        listWrap.appendChild(list);
      }

      setType(state.couponType);

      function setType(type) {
        state.couponType = type;
        creditChip.className = type === 'credit' ? 'chip chip--selected' : 'chip';
        unlimitedChip.className = type === 'unlimited' ? 'chip chip--selected' : 'chip';
        creditChip.setAttribute('aria-pressed', type === 'credit' ? 'true' : 'false');
        unlimitedChip.setAttribute('aria-pressed', type === 'unlimited' ? 'true' : 'false');
        amountField.hidden = type !== 'credit';
        daysField.hidden = type !== 'unlimited';
      }

      function makeCouponCode() {
        var out = '';
        var i;
        for (i = 0; i < 10; i += 1) {
          out += COUPON_CODE_CHARS.charAt(Math.floor(Math.random() * COUPON_CODE_CHARS.length));
        }
        return out;
      }

      function issue() {
        var code = textOf(codeInput.value).trim().toUpperCase();
        if (!COUPON_CODE_PATTERN.test(code)) {
          setFieldError(codeField, codeInput, tl('local.couponCodeInvalid'));
          codeInput.focus();
          return;
        }
        var duplicated = false;
        state.coupons.forEach(function (one) {
          if (textOf(one.code).trim().toUpperCase() === code) { duplicated = true; }
        });
        if (duplicated) {
          setFieldError(codeField, codeInput, tl('local.couponCodeDuplicate'));
          codeInput.focus();
          return;
        }
        setFieldError(codeField, codeInput, '');

        var uses = intOf(usesInput.value);
        if (!(uses >= 1) || uses > MAX_COUPON_USES) {
          setFieldError(usesField, usesInput, tl('local.couponMaxUsesInvalid'));
          usesInput.focus();
          return;
        }
        setFieldError(usesField, usesInput, '');

        var payload = {
          code: code,
          /* benefit_type は NOT NULL・既定値なしの旧列。coupon_type（新・nullable）と
             同じ値を入れる。旧側を落とすと insert が 23502 で必ず失敗する */
          benefit_type: state.couponType,
          coupon_type: state.couponType,
          credit_amount: null,
          unlimited_days: null,
          max_uses: uses,
          used_count: 0,
          expires_at: textOf(expiresInput.value) || null,
          is_active: true
        };

        if (state.couponType === 'credit') {
          var amount = intOf(amountInput.value);
          if (!(amount >= 1) || amount > MAX_GRANT_CREDIT) {
            setFieldError(amountField, amountInput, tl('local.couponAmountInvalid'));
            amountInput.focus();
            return;
          }
          setFieldError(amountField, amountInput, '');
          payload.credit_amount = amount;
        } else {
          var days = intOf(daysInput.value);
          if (!(days >= 1) || days > MAX_GRANT_DAYS) {
            setFieldError(daysField, daysInput, tl('local.grantDaysInvalid'));
            daysInput.focus();
            return;
          }
          setFieldError(daysField, daysInput, '');
          payload.unlimited_days = days;
        }

        busy(issueBtn, true, tl('local.processing'), issueLabel);
        tableInsert('coupons', payload).then(function () {
          toast(tl('local.couponIssued', { code: code }), 'success');
          load();
        }, function (err) {
          busy(issueBtn, false, tl('local.processing'), issueLabel);
          console.error('[screens-admin] クーポンの発行に失敗しました', err);
          toast(tl('local.couponIssueFailed'), 'danger');
          handleError(err, issue);
        });
      }

      return section(tl('local.couponSection'), tl('local.couponSectionDesc'), [
        codeRow, typeWrap, amountField, daysField, pairRow, issueBtn, listWrap
      ]);
    }

    function couponRow(coupon) {
      var active = coupon.is_active !== false;
      var row = button('list-row', '', function () { toggleCoupon(coupon); });
      clearNode(row);

      var bodyNode = el('div', 'list-row__body');
      bodyNode.appendChild(el('div', 'list-row__title clamp-1', textOf(coupon.code)));

      var sub = coupon.coupon_type === 'unlimited'
        ? tl('local.couponTypeUnlimited') + ' ' + fmtNumber(coupon.unlimited_days) + '日'
        : tl('local.couponTypeCredit') + ' ' + fmtNumber(coupon.credit_amount) + t('common.creditShort');
      bodyNode.appendChild(el('div', 'list-row__sub clamp-1', sub));

      var meta = tl('local.couponUses', {
        used: fmtNumber(coupon.used_count),
        max: fmtNumber(coupon.max_uses)
      }) + ' ・ ' + (coupon.expires_at ? tl('local.couponExpiresOn', { date: fmtDate(coupon.expires_at) }) : tl('local.couponNoExpiry'));
      bodyNode.appendChild(el('div', 'list-row__meta clamp-2', meta));

      row.appendChild(bodyNode);
      row.appendChild(el('span', active ? 'badge badge--ok' : 'badge badge--mute',
        active ? t('admin.userStatusActive') : tl('local.couponStopped')));
      return row;
    }

    function toggleCoupon(coupon) {
      var active = coupon.is_active !== false;
      var confirmFn = needApp('confirm');

      function run() {
        tableUpdate('coupons', coupon.id, { is_active: !active }).then(function () {
          toast(active ? tl('local.couponStopDone') : tl('local.couponResumeDone'), 'success');
          load();
        }, function (err) {
          console.error('[screens-admin] クーポンの状態変更に失敗しました', err);
          toast(t('admin.saveFailed'), 'danger');
          handleError(err, function () { toggleCoupon(coupon); });
        });
      }

      if (!confirmFn) { run(); return; }
      confirmFn({
        title: active ? tl('local.couponStopTitle') : tl('local.couponResumeTitle'),
        message: active
          ? tl('local.couponStopBody', { code: textOf(coupon.code) })
          : tl('local.couponResumeBody', { code: textOf(coupon.code) }),
        confirmLabel: t('common.ok'),
        cancelLabel: t('common.cancel'),
        danger: active
      }).then(function (ok) {
        if (ok) { run(); }
      });
    }

    /* ---- お問い合わせ ---- */
    function inquiriesSection() {
      var body;
      if (!state.inquiries.length) {
        body = emptyBlock(tl('local.inquiriesEmpty'));
      } else {
        body = el('div', 'list');
        state.inquiries.forEach(function (row) { body.appendChild(inquiryRow(row)); });
      }
      return section(t('admin.inquiries'), tl('local.inquiriesDesc', { n: fmtNumber(state.inquiries.length) }), [body]);
    }

    function inquiryRow(inquiry) {
      var status = inquiryStatusOf(inquiry);
      var row = button('list-row', '', function () { openInquiryModal(inquiry); });
      clearNode(row);

      var bodyNode = el('div', 'list-row__body');
      bodyNode.appendChild(el('div', 'list-row__title clamp-1', textOf(inquiry.subject) || tl('local.noSubject')));
      bodyNode.appendChild(el('div', 'list-row__sub clamp-1', textOf(inquiry.email)));
      bodyNode.appendChild(el('div', 'list-row__meta clamp-2', fmtDate(inquiry.created_at)));

      row.appendChild(bodyNode);
      row.appendChild(el('span', status.badge, t(status.key)));
      return row;
    }

    /* やり取りの1行。どちらが書いたかで左右に寄せる */
    function chatRow(m) {
      var mine = !!m.from_admin;
      var row = el('div', 'chat__row' + (mine ? ' chat__row--mine' : ''));
      var bubble = el('div', 'chat__bubble' + (mine ? ' chat__bubble--mine' : ''));
      bubble.appendChild(el('div', 'chat__who', mine ? tl('local.chatYou') : tl('local.chatUser')));
      bubble.appendChild(el('div', 'chat__body', textOf(m.body)));
      bubble.appendChild(el('div', 'chat__at', fmtDate(m.created_at)));
      row.appendChild(bubble);
      return row;
    }

    function openInquiryModal(inquiry) {
      var open = needApp('openModal');
      if (!open) {
        toast(tl('local.apiMissing', { name: 'App.openModal' }), 'danger');
        return;
      }

      var current = inquiryStatusOf(inquiry);
      var modal = el('div', 'modal');
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.appendChild(el('p', 'modal__title', textOf(inquiry.subject) || tl('local.noSubject')));
      modal.appendChild(el('p', 'modal__note', tl('local.inquiryDetailTitle')));

      var info = el('div', 'info-list');
      info.appendChild(infoRow(tl('local.inquiryFrom'), textOf(inquiry.email)));
      info.appendChild(infoRow(tl('local.joinedLabel'), fmtDate(inquiry.created_at)));
      info.appendChild(infoRow(tl('local.inquiryStatusLabel'), t(current.key)));
      modal.appendChild(info);

      /* ---- やり取り（2026-10-23 要望）----
         これまでは本文を1つ出すだけで、返事を書く所が無かった。
         利用者からは「読まれたのか」も分からない。
         046 で足した inquiry_messages に積んで、1本の流れとして出す */
      modal.appendChild(el('p', 'modal__body', tl('local.chatTitle')));
      var chatHost = el('div', 'chat');
      chatHost.appendChild(el('p', 't-note', tl('local.chatLoad')));
      modal.appendChild(chatHost);

      var reply = el('textarea', 'input textarea');
      reply.rows = 3;
      reply.setAttribute('aria-label', tl('local.chatReply'));
      reply.placeholder = tl('local.chatReply');
      modal.appendChild(reply);
      var sendBtn = button('btn btn--primary', tl('local.chatSend'), function () { sendReply(); });
      modal.appendChild(sendBtn);

      drawChat();

      function drawChat() {
        var table = tableOf('inquiryMessages');
        if (!table) { return; }
        table.list({ eq: { inquiries_id: inquiry.id }, order: 'created_at.asc', limit: 200 })
          .then(function (rows) {
            clearNode(chatHost);
            /* 最初の1通がまだ移っていない古いスレッドは、本文を頭に足して見せる */
            var list = (rows || []).slice();
            if (!list.length && textOf(inquiry.body).trim()) {
              list = [{ from_admin: false, body: inquiry.body, created_at: inquiry.created_at }];
            }
            list.forEach(function (m) { chatHost.appendChild(chatRow(m)); });
            chatHost.scrollTop = chatHost.scrollHeight;
          }, function (err) {
            console.error('[S18] やり取りを読めませんでした', err);
            clearNode(chatHost);
            chatHost.appendChild(el('p', 't-note t-danger', tl('local.chatFail')));
          });
      }

      function sendReply() {
        var text = String(reply.value || '').trim();
        if (!text) { toast(tl('local.chatNeedBody'), 'danger'); return; }
        var me = needApp('getUser') ? window.App.getUser() : null;
        if (!me) { return; }
        sendBtn.disabled = true;
        tableInsert('inquiryMessages', {
          inquiries_id: inquiry.id,
          users_id: String(me.id),
          from_admin: true,
          body: text
        }).then(function () {
          /* 返事を書いたら「対応中」に進める。状態を別に押させない */
          return tableUpdate('inquiries', inquiry.id, { inquiry_status: 'in_progress' })
            .catch(function () { return null; });
        }).then(function () {
          sendBtn.disabled = false;
          reply.value = '';
          toast(tl('local.chatSent'), 'success');
          drawChat();
          load();
        }, function (err) {
          sendBtn.disabled = false;
          console.error('[S18] 返信できませんでした', err);
          handleError(err, sendReply);
        });
      }

      var chips = el('div', 'chips');
      INQUIRY_STATUSES.forEach(function (one) {
        var chip = button(one.value === current.value ? 'chip chip--selected' : 'chip', t(one.key), function () {
          updateStatus(one.value);
        });
        chip.setAttribute('aria-pressed', one.value === current.value ? 'true' : 'false');
        chips.appendChild(chip);
      });
      modal.appendChild(el('p', 'modal__body', tl('local.inquiryStatusLabel')));
      modal.appendChild(chips);

      var actions = el('div', 'modal__actions modal__actions--1');
      actions.appendChild(button('btn btn--secondary btn--block', t('common.close'), function () { closeModal(); }));
      modal.appendChild(actions);

      open(modal, {});

      function updateStatus(value) {
        if (value === current.value) { closeModal(); return; }
        tableUpdate('inquiries', inquiry.id, { inquiry_status: value }).then(function () {
          closeModal();
          toast(tl('local.inquiryUpdated'), 'success');
          load();
        }, function (err) {
          console.error('[screens-admin] 問い合わせ状況の更新に失敗しました', err);
          toast(tl('local.inquiryUpdateFailed'), 'danger');
          handleError(err, function () { updateStatus(value); });
        });
      }
    }
  }

  /* =========================================================
   * S19 機能別クレジット価格設定
   * ========================================================= */
  function renderFeaturePricing(root) {
    if (!ensureAdmin('S19', root)) { return; }

    var state = {
      unitPrice: DEFAULT_UNIT_PRICE,
      rows: [],
      cost: {},
      /* 会社ごとの原価（074）。measured[key][provider] = 実測の行、
         manual[key + '|' + provider] = 手で入れた行（id つき） */
      byProvider: {},
      manualProvider: {},
      providerDirty: {},
      estimateValue: null,
      estimateSub: null,
      saveBtn: null,
      saving: false
    };

    load();

    function load() {
      showLoading(root);
      /* 値段を決めるには原価が要る（2026-10-30 要望）。
         実測が取れなくても値段表は出す（原価の欄だけ空になる） */
      var costs = (window.Api && Api.credits && typeof Api.credits.costByFeature === 'function')
        ? Api.credits.costByFeature().catch(function (err) {
            console.error('[screens-admin] ボタン別の原価を読めませんでした', err);
            return [];
          })
        : Promise.resolve([]);
      /* 会社ごとの原価（074）。読めなくても値段表は出す */
      var byProvider = (window.Api && Api.credits && typeof Api.credits.costByProvider === 'function')
        ? Api.credits.costByProvider().catch(function (err) {
            console.error('[screens-admin] 会社ごとの原価を読めませんでした', err);
            return [];
          })
        : Promise.resolve([]);
      var manual = tableList('featureProviderCosts', { order: 'created_at.asc' }).catch(function (err) {
        console.error('[screens-admin] 会社ごとの手入力原価を読めませんでした', err);
        return [];
      });
      Promise.all([tableList('featureCredits', { order: 'created_at.asc' }), costs, byProvider, manual])
        .then(function (got) {
          state.cost = {};
          (got[1] || []).forEach(function (r) {
            if (r && r.feature_key) { state.cost[String(r.feature_key)] = r; }
          });
          state.byProvider = {};
          (got[2] || []).forEach(function (r) {
            if (!r || !r.feature_key) { return; }
            var k = String(r.feature_key);
            if (!state.byProvider[k]) { state.byProvider[k] = {}; }
            state.byProvider[k][String(r.provider || '').toLowerCase()] = r;
          });
          state.manualProvider = {};
          state.providerDirty = {};
          (got[3] || []).forEach(function (r) {
            if (!r || !r.feature_key) { return; }
            state.manualProvider[String(r.feature_key) + '|' + String(r.provider || '').toLowerCase()] = {
              id: r.id,
              usd: r.usd_each_manual === null || r.usd_each_manual === undefined
                ? null : Number(r.usd_each_manual)
            };
          });
          build(got[0] || []);
          draw();
        }, function (err) {
          console.error('[screens-admin] 機能別ポイントの読み込みに失敗しました', err);
          showLoadError(root, err, load);
        });
    }

    function build(rows) {
      state.unitPrice = unitPriceOf(rows);
      state.rows = [];

      rows.forEach(function (row) {
        var key = textOf(row.feature_key).trim();
        if (!key || key === UNIT_PRICE_KEY) { return; }
        var cost = Math.max(0, Math.round(Number(row.credit_cost) || 0));
        var name = textOf(row.feature_name).trim() || defaultFeatureName(key);
        state.rows.push({
          id: row.id,
          key: key,
          name: name,
          cost: cost,
          /* 括り（1 調べる / 2 作る / 3 届ける）と、単位ごとの値段か
             （2026-10-30）。null の行は値段ではなく設定（為替・単価など） */
          group: row.group_no === null || row.group_no === undefined ? null : Number(row.group_no),
          perUnit: row.per_unit === true,
          unitName: row.unit_name || '',
          sort: Number(row.sort_no) || 100,
          /* 手で入れた原価（1回あたりの円）。null は「実測の計算を使う」 */
          costManual: row.cost_usd_each_manual === null || row.cost_usd_each_manual === undefined
            ? null : Number(row.cost_usd_each_manual),
          originalName: name,
          originalCost: cost,
          originalCostManual: row.cost_usd_each_manual === null || row.cost_usd_each_manual === undefined
            ? null : Number(row.cost_usd_each_manual),
          costManualError: '',
          active: row.is_active !== false,
          isNew: false,
          error: ''
        });
      });

      /* まだ登録されていない既定の機能は、未保存の行として並べる（保存で feature_credits に入る） */
      FEATURE_DEFAULTS.forEach(function (def) {
        if (findRow(def.key)) { return; }
        state.rows.push({
          id: null,
          key: def.key,
          name: def.name[localeIndex()] || def.name[0],
          cost: def.cost,
          originalName: '',
          originalCost: -1,
          active: true,
          isNew: true,
          error: ''
        });
      });
    }

    function findRow(key) {
      var found = null;
      state.rows.forEach(function (row) {
        if (row.key === key) { found = row; }
      });
      return found;
    }

    function totalCredits() {
      var total = 0;
      state.rows.forEach(function (row) { total += Math.max(0, row.cost); });
      return total;
    }

    function recalcEstimate() {
      var total = totalCredits();
      if (state.estimateValue) {
        clearNode(state.estimateValue);
        state.estimateValue.textContent = fmtYen(total * state.unitPrice);
      }
      if (state.estimateSub) {
        state.estimateSub.textContent = tl('local.estimateSub', {
          n: fmtNumber(total),
          price: fmtNumber(state.unitPrice)
        });
      }
    }

    function draw() {
      clearNode(root);
      var wrap = screenRoot();

      wrap.appendChild(head(t('featurePricing.title'), t('featurePricing.note')));
      wrap.appendChild(listSection());
      wrap.appendChild(addSection());
      wrap.appendChild(estimateCard());

      var saveLabel = t('featurePricing.saveAndReturn');
      state.saveBtn = button('btn btn--primary btn--block', saveLabel, function () { saveAll(saveLabel); });

      var actions = el('div', 'stack stack--group');
      actions.appendChild(state.saveBtn);
      actions.appendChild(button('btn btn--text btn--block', tl('local.backToAdmin'), function () {
        goto('S18', null, true);
      }));
      wrap.appendChild(actions);

      root.appendChild(wrap);
      recalcEstimate();
    }

    /* 原価の円換算に使う為替。costByFeature（RPC）が返す値をそのまま使う。
       画面で feature_credits から拾い直すと、保存前の編集中の値を
       掛けてしまい、表示と計算がずれる */
    function costRate() {
      var rows = state.cost ? Object.keys(state.cost) : [];
      for (var i = 0; i < rows.length; i += 1) {
        var r = Number(state.cost[rows[i]] && state.cost[rows[i]].usd_jpy);
        if (r > 0) { return r; }
      }
      return 0;
    }

    /* 値段表は括りごとに分けて出す（2026-10-30 要望）。
       工程の耳と同じ並び（①調べる ②作る ③届ける）にして、
       どの括りでいくら払うのかを足し算で読めるようにする。
       括りの付いていない行（為替・1回の単価など）は最後に「設定」としてまとめる */
    /* 画面の上では1つのボタンでも、中では複数の機能が続けて走る（2026-11-08 指摘）。
       内訳だけ並べても「1回押すといくらか」が読めない。
       並びの元は screens-home.js の stampRunCost()。
       片方だけ直すとずれるので、usage-screen-selftest.mjs で見張っている */
    var BUNDLES = [{
      group: 1,
      /* ボタンそのものを表す行（068）。ここではポイントを引かない。
         使うのは名前と、手で入れた原価だけ */
      key: 'ai_autorun',
      nameKey: 'local.bundleAiRun',
      parts: [
        { key: 'product_autofill',    noteKey: 'local.bundleIfRef' },
        { key: 'competitor_analysis', per: true },
        { key: 'target_proposal' }
      ]
    }];

    /* 原価はUSDで持つ。円は為替を掛けた結果なので、ドルの後ろに添える。
       束ねた行と内訳の行の両方が使うので、ここに1つだけ置く */
    function usdText(v) {
      var n = Number(v) || 0;
      if (n !== 0 && Math.abs(n) < 0.01) { return n.toFixed(4); }
      return n.toFixed(2);
    }

    function jpySuffix(usdValue) {
      var rate = costRate();
      if (!rate) { return ''; }
      return tl('local.costYenSuffix', {
        n: fmtNumber(Math.round((Number(usdValue) || 0) * rate))
      });
    }

    /* ×個数で走るボタンに「1回押すといくら」を出すための、例に使う数。
       何枚作るかは案件ごとに違うので、**前提つきの額**として出す
       （2026-11-08 要望。前提を隠して1つの額だけ出すと嘘になる）。
       数の出どころ:
         lp_section  … LPは区画が平均28枚（screens-lp.js の注記と同じ）
         line_assets … LINEは層ごとに数枚。実測が溜まるまで6枚
         lp_assets   … 動く絵は1本ずつ押す作りだが、まとめると数本
         competitor_analysis / product_cutouts … 1本・1枚が普通 */
    var PRESS_EXAMPLE = {
      lp_section: 28,
      line_assets: 6,
      lp_assets: 3,
      product_cutouts: 3
    };

    /* 単位の言い方に数を入れる。単位名には「1」が含まれているので
       （1本 / 1枚 / ブロック1枚 / 絵1枚）、その「1」を数に差し替える。
       数をただ前に付けると「31本」「28ブロック1枚」になった（2026-11-08 実測） */
    function countWith(unitName, n) {
      var unit = textOf(unitName).trim();
      var num = fmtNumber(n);
      if (!unit) { return num + tl('local.perUnit'); }
      if (unit.indexOf('1') !== -1) { return unit.replace('1', num); }
      return num + unit;
    }

    function bundleOf(groupNo) {
      var found = null;
      BUNDLES.forEach(function (b) { if (b.group === groupNo) { found = b; } });
      return found;
    }

    function rowOf(key) {
      var found = null;
      state.rows.forEach(function (r) { if (r.key === key) { found = r; } });
      return found;
    }

    /* ボタン1個ぶんの行。中で走る機能は畳んでおく（2026-11-08 要望
       「最初は『AI自動分析』ボタン1個しかない。ボタン1個に内訳入らない」）。
       ポイントの引き方は変えていないので、内訳の値段はここから開いて直せる */
    function bundleNode(groupNo) {
      var bundle = bundleOf(groupNo);
      if (!bundle) { return null; }
      var self = rowOf(bundle.key);
      var members = bundle.parts.map(function (part) {
        return { part: part, row: rowOf(part.key) };
      }).filter(function (x) { return !!x.row; });
      if (!self || members.length !== bundle.parts.length) { return null; }

      var box = el('div', 'admin-bundle');

      /* 見出しと、1回ぶんの売値 */
      var head = el('div', 'admin-bundle__head');
      head.appendChild(el('span', 'admin-bundle__name', self.name));
      var priceText = el('span', 'admin-bundle__price', '');
      head.appendChild(priceText);
      box.appendChild(head);

      /* 原価。自動の合計と、手で入れた額の両方を扱う */
      var meta = el('div', 'list-row__meta admin-cost', '');
      var costInput = numberInput(self.costManual, {
        min: 0, max: MAX_COST_USD, step: '0.0001',
        placeholder: tl('local.costManualPlaceholder')
      });
      costInput.className = 'input input--sm admin-cost__input';
      costInput.setAttribute('aria-label', self.name + ' ' + tl('local.costManualLabel'));
      costInput.title = tl('local.bundleCostHint');
      var pre = document.createTextNode('');
      var post = document.createTextNode('');
      meta.appendChild(pre);
      meta.appendChild(costInput);
      meta.appendChild(post);
      box.appendChild(meta);

      /* 内訳。既定は畳む */
      var open = false;
      var toggle = button('btn btn--text btn--sm admin-bundle__toggle', '', function () {
        open = !open;
        inner.hidden = !open;
        toggle.textContent = tl(open ? 'local.bundleHide' : 'local.bundleShow',
          { n: fmtNumber(members.length) });
      });
      var inner = el('div', 'admin-bundle__inner');
      inner.hidden = true;
      box.appendChild(toggle);
      box.appendChild(inner);
      members.forEach(function (m) { inner.appendChild(featureRow(m.row)); });
      toggle.textContent = tl('local.bundleShow', { n: fmtNumber(members.length) });

      /* 1回ぶんを数える。競合LPはURLの本数で変わるので、1本のときで出す */
      function sums() {
        var points = 0;
        var usd = 0;
        var measured = true;
        members.forEach(function (m) {
          points += Number(m.row.cost) || 0;
          var c = state.cost[m.row.key];
          var each = c && c.cost_usd_each !== null && c.cost_usd_each !== undefined
            ? Number(c.cost_usd_each) : null;
          if (each === null) { measured = false; } else { usd += each; }
        });
        return { points: points, usd: usd, measured: measured };
      }

      function paintBundle() {
        var sum = sums();
        priceText.textContent = tl('local.bundlePrice', {
          p: fmtNumber(sum.points),
          yen: fmtNumber(Math.round(sum.points * state.unitPrice))
        });

        var manual = self.costManual === null || self.costManual === undefined
          ? null : Number(self.costManual);
        var each = manual !== null ? manual : (sum.measured ? sum.usd : null);
        var key = manual !== null ? 'local.costManualEach'
          : (sum.measured ? 'local.bundleCostEach' : 'local.costAsk');
        var parts = tl(key, {
          yen: YEN_SLOT,
          jpy: each === null ? '' : jpySuffix(each),
          n: fmtNumber(members.length),
          price: fmtNumber(Math.round(sum.points * state.unitPrice))
        }).split(YEN_SLOT);
        pre.nodeValue = parts[0] || '';
        post.nodeValue = parts.length > 1 ? parts[1] : '';
        costInput.placeholder = manual === null && sum.measured
          ? usdText(sum.usd) : tl('local.costManualPlaceholder');
        var eachYen = each === null ? null : each * (costRate() || 0);
        var priceYen = sum.points * state.unitPrice;
        meta.classList.toggle('admin-cost--under', eachYen !== null && priceYen < eachYen);
      }

      costInput.addEventListener('input', function () {
        var raw = String(costInput.value || '').trim();
        if (!raw) {
          self.costManual = null;
        } else {
          var value = Number(raw);
          if (isFinite(value) && value >= 0 && value <= MAX_COST_USD) { self.costManual = value; }
        }
        paintBundle();
      });

      /* 内訳の値段を直したら、上の合計も動かす */
      bundleRepaint = paintBundle;
      paintBundle();
      return box;
    }

    /* 内訳の行が値段を直したときに呼ぶ（束ねた行の合計を描き直す） */
    var bundleRepaint = null;

    var GROUPS = [
      { no: 1, key: 'wfg.research' },
      { no: 2, key: 'wfg.build' },
      { no: 3, key: 'wfg.deliver' }
    ];

    /* 束ねた行の中に入れる機能と、ボタンそのものの行は、
       一覧の本体には出さない（出すと同じ行が2回並ぶ） */
    function insideBundle(key) {
      var hit = false;
      BUNDLES.forEach(function (b) {
        if (b.key === key) { hit = true; }
        b.parts.forEach(function (part) { if (part.key === key) { hit = true; } });
      });
      return hit;
    }

    function rowsOfGroup(no) {
      return state.rows.filter(function (r) { return r.group === no && !insideBundle(r.key); })
        .sort(function (a, b) { return a.sort - b.sort; });
    }

    function listSection() {
      var body;
      if (!state.rows.length) {
        body = emptyBlock(tl('local.featureListEmpty'));
        return section(t('featurePricing.list'), tl('local.featureListDesc', { n: 0 }), [body]);
      }
      body = el('div', 'stack');
      GROUPS.forEach(function (g) {
        var rows = rowsOfGroup(g.no);
        var bundle = bundleNode(g.no);
        if (!rows.length && !bundle) { return; }
        /* 括りの合計は、束ねた行の中の機能も数える（画面から隠れていても引かれる） */
        var sum = state.rows.filter(function (r) { return r.group === g.no; })
          .reduce(function (n, r) { return n + Math.max(0, r.cost); }, 0);
        var head = el('div', 'admin-group__head');
        head.appendChild(el('span', 'admin-group__no', String(g.no)));
        head.appendChild(el('span', 'admin-group__name', t(g.key)));
        head.appendChild(el('span', 'admin-group__sum', fmtNumber(sum) + 'P'));
        var box = el('div', 'admin-group');
        box.appendChild(head);
        if (bundle) { box.appendChild(bundle); }
        var list = el('div', 'list');
        rows.forEach(function (row) { list.appendChild(featureRow(row)); });
        box.appendChild(list);
        body.appendChild(box);
      });
      /* 括りの無い行（Claude のトークン単価など）。
         為替だけは「管理 → 料金設定」に自分の欄ができたので、ここには出さない
         （2026-11-08。2か所にあると、どちらが効くのか分からなくなる。
          しかもこちらは消費ポイントの欄を間借りしていて「売値 157,470円」と出る） */
      var others = state.rows.filter(function (r) {
        return r.group === null && r.key !== RATE_KEY;
      }).sort(function (a, b) { return a.sort - b.sort; });
      if (others.length) {
        var obox = el('div', 'admin-group');
        var ohead = el('div', 'admin-group__head');
        ohead.appendChild(el('span', 'admin-group__name', tl('local.settingRows')));
        obox.appendChild(ohead);
        var olist = el('div', 'list');
        others.forEach(function (row) { olist.appendChild(featureRow(row)); });
        obox.appendChild(olist);
        body.appendChild(obox);
      }
      var rate = costRate();
      if (rate) {
        var note = el('p', 'field__hint', tl('local.costRateNote', { rate: rate.toFixed(2) }));
        body.insertBefore(note, body.firstChild);
      }
      return section(t('featurePricing.list'), tl('local.featureListDesc', { n: fmtNumber(state.rows.length) }), [body]);
    }

    /* 画面に出すAIの会社。単価の行がある会社（＝原価を計算できる会社）に、
       そのボタンで実際に使った会社と、手で入れた会社を足す */
    function providersFor(key) {
      var seen = {};
      var out = [];
      function add(p) {
        var name = String(p || '').toLowerCase();
        if (!name || seen[name]) { return; }
        seen[name] = true;
        out.push(name);
      }
      state.rows.forEach(function (r) {
        var m = AI_RATE_RE.exec(r.key);
        if (m) { add(m[1]); }
      });
      var measured = state.byProvider[key] || {};
      Object.keys(measured).forEach(add);
      Object.keys(state.manualProvider).forEach(function (k) {
        var cut = k.indexOf('|');
        if (cut > 0 && k.slice(0, cut) === key) { add(k.slice(cut + 1)); }
      });
      return out;
    }

    function providerManual(key, provider) {
      if (Object.prototype.hasOwnProperty.call(state.providerDirty, key + '|' + provider)) {
        return state.providerDirty[key + '|' + provider];
      }
      var saved = state.manualProvider[key + '|' + provider];
      return saved ? saved.usd : null;
    }

    /* ボタン1行の下に、会社ごとの原価を並べる（2026-11-09 要望）。
       同じボタンでも Claude と DeepSeek では桁が違うので、1つの欄には入らない */
    function providerCostBlock(row) {
      var list = providersFor(row.key);
      if (!list.length) { return null; }
      var box = el('div', 'admin-byai');
      box.appendChild(el('div', 'admin-byai__head', tl('local.byProviderTitle')));
      list.forEach(function (provider) {
        var one = el('div', 'admin-byai__row');
        one.appendChild(el('span', 'admin-byai__name', providerName(provider)));

        var seen = (state.byProvider[row.key] || {})[provider] || null;
        var calls = seen ? Number(seen.calls) || 0 : 0;
        var measuredEach = seen && !seen.manual
          && seen.cost_usd_each !== null && seen.cost_usd_each !== undefined
          ? Number(seen.cost_usd_each) : null;
        one.appendChild(el('span', 'admin-byai__measured', measuredEach === null
          ? tl('local.byProviderNone')
          : tl('local.byProviderMeasured', { usd: usdText(measuredEach), n: fmtNumber(calls) })));

        var input = numberInput(providerManual(row.key, provider), {
          min: 0, max: MAX_COST_USD, step: '0.0001',
          placeholder: measuredEach === null ? tl('local.costManualPlaceholder') : usdText(measuredEach)
        });
        input.className = 'input input--sm admin-cost__input';
        input.setAttribute('aria-label',
          row.name + ' ' + providerName(provider) + ' ' + tl('local.costManualLabel'));
        var wrapIn = el('span', 'admin-byai__input');
        wrapIn.appendChild(document.createTextNode('$'));
        wrapIn.appendChild(input);
        one.appendChild(wrapIn);

        input.addEventListener('input', function () {
          var raw = textOf(input.value).trim();
          var ok = true;
          if (!raw) {
            state.providerDirty[row.key + '|' + provider] = null;
          } else {
            var usd = Number(raw);
            ok = isFinite(usd) && usd >= 0 && usd <= MAX_COST_USD;
            if (ok) { state.providerDirty[row.key + '|' + provider] = usd; }
          }
          input.classList.toggle('input--error', !ok);
        });
        box.appendChild(one);
      });
      var hint = el('p', 'field__hint', tl('local.byProviderHint'));
      box.appendChild(hint);
      return box;
    }

    function featureRow(row) {
      var wrap = el('div', 'stack stack--tight');
      var line = el('div', 'list-row');

      var bodyNode = el('div', 'list-row__body');
      var title = el('div', 'list-row__title clamp-1', row.name);
      bodyNode.appendChild(title);
      var sub = el('div', 'list-row__sub clamp-1',
        row.key + (row.perUnit ? '　/　' + (row.unitName || tl('local.perUnit')) : ''));
      bodyNode.appendChild(sub);
      if (row.isNew) {
        bodyNode.appendChild(el('div', 'list-row__meta', tl('local.unsavedBadge')));
      }
      /* 実測の原価を値段のすぐ横に出す（2026-10-30 要望）。
         値段を決めるのに毎回ほかの画面を開かなくてよくする。
         自分で測った原価を入れたら、そちらを使う（2026-11-06 要望） */
      var cost = state.cost[row.key] || null;
      var meta = el('div', 'list-row__meta admin-cost', '');
      bodyNode.appendChild(meta);
      line.appendChild(bodyNode);

      var input = numberInput(row.cost, { min: 0, max: MAX_CREDIT_COST, narrow: true });
      input.setAttribute('aria-label', row.name + ' ' + t('featurePricing.creditCost'));
      line.appendChild(input);
      wrap.appendChild(line);

      var error = el('p', 'field__error', '');
      error.hidden = true;
      wrap.appendChild(error);

      /* 原価はこの行の中でそのまま直せるようにする（2026-11-06 要望）。
         別の欄を下に置くと、どの行の原価なのか目で追えなくなる。
         空のままなら実測の計算（placeholder に出ている値）を使う */
      var costInput = numberInput(row.costManual, {
        min: 0, max: MAX_COST_USD, step: '0.0001',
        placeholder: tl('local.costManualPlaceholder')
      });
      costInput.className = 'input input--sm admin-cost__input';
      costInput.setAttribute('aria-label', row.name + ' ' + tl('local.costManualLabel'));
      costInput.title = tl('local.costManualHint');
      var metaPre = document.createTextNode('');
      var metaPost = document.createTextNode('');
      meta.appendChild(metaPre);
      meta.appendChild(costInput);
      meta.appendChild(metaPost);
      /* 回数が数えられていないときだけ、実測の合計を下に出す */
      var costNote = el('div', 'list-row__meta admin-cost', '');
      costNote.hidden = true;
      bodyNode.appendChild(costNote);
      /* 「このボタンを1回押すといくら」。×個数で走るものだけ出す */
      var pressNote = el('div', 'list-row__meta admin-press', '');
      pressNote.hidden = true;
      bodyNode.appendChild(pressNote);
      /* 会社ごとの原価は、ボタンの行にだけ出す（設定の行には関係がない） */
      if (row.group !== null && row.group !== undefined) {
        var byAi = providerCostBlock(row);
        if (byAi) { bodyNode.appendChild(byAi); }
      }

      /* 原価の行を描き直す。売値（ポイント）を直したときも呼ぶ。
         入力欄そのものは作り直さない（打っている最中に消えてしまう） */
      function paintCost() {
        var manual = row.costManual === null || row.costManual === undefined
          ? null : Number(row.costManual);
        var measured = cost && cost.cost_usd_each !== null && cost.cost_usd_each !== undefined
          ? Number(cost.cost_usd_each) : null;
        var each = manual !== null ? manual : measured;
        var price = Math.round(row.cost * state.unitPrice);
        var key = manual !== null ? 'local.costManualEach'
          : (measured !== null ? 'local.costEach' : 'local.costAsk');
        /* 言語で語順が変わるので、{yen} の場所で切って入力欄を挟む */
        var parts = tl(key, {
          yen: YEN_SLOT,
          jpy: each === null ? '' : jpySuffix(each),
          n: fmtNumber(cost ? Number(cost.jobs) || 0 : 0),
          price: fmtNumber(price)
        }).split(YEN_SLOT);
        metaPre.nodeValue = parts[0] || '';
        metaPost.nodeValue = parts.length > 1 ? parts[1] : '';
        /* 空のときは実測の値を薄く出す。そのまま打てば上書きになる */
        costInput.placeholder = manual === null && measured !== null
          ? usdText(measured)
          : tl('local.costManualPlaceholder');
        /* 赤くするのは円どうしで比べる（売値は円、原価はドル） */
        var eachYen = each === null ? null : each * (costRate() || 0);
        meta.classList.toggle('admin-cost--under', eachYen !== null && price < eachYen);
        var totalOnly = measured === null && cost && Number(cost.cost_usd) ? true : false;
        costNote.textContent = totalOnly
          ? tl('local.costTotalOnly', {
              yen: usdText(cost.cost_usd),
              jpy: jpySuffix(cost.cost_usd)
            }) : '';
        costNote.hidden = !totalOnly;

        /* ×個数で走るボタンは、1回押すといくらかを前提つきで出す */
        var n = PRESS_EXAMPLE[row.key];
        if (n && each !== null) {
          pressNote.textContent = tl('local.pressExample', {
            n: fmtNumber(n),
            unit: countWith(row.unitName, n),
            p: fmtNumber(row.cost * n),
            yen: fmtNumber(Math.round(row.cost * n * state.unitPrice)),
            usd: usdText(each * n)
          });
          pressNote.hidden = false;
        } else {
          pressNote.hidden = true;
        }
      }
      paintCost();

      input.addEventListener('input', function () {
        var value = intOf(input.value);
        var ok = !isNaN(value) && value >= 0 && value <= MAX_CREDIT_COST;
        if (ok) {
          row.cost = value;
          row.error = '';
        } else {
          row.error = t('featurePricing.creditCostInvalid');
        }
        input.classList.toggle('input--error', !ok);
        error.textContent = row.error || row.costManualError;
        error.hidden = !error.textContent;
        paintCost();
        if (bundleRepaint) { bundleRepaint(); }
        recalcEstimate();
      });

      costInput.addEventListener('input', function () {
        var raw = textOf(costInput.value).trim();
        if (!raw) {
          row.costManual = null;
          row.costManualError = '';
        } else {
          var value = Number(raw);
          var ok = isFinite(value) && value >= 0 && value <= MAX_COST_USD;
          row.costManualError = ok ? '' : tl('local.costManualInvalid');
          if (ok) { row.costManual = value; }
        }
        costInput.classList.toggle('input--error', !!row.costManualError);
        error.textContent = row.error || row.costManualError;
        error.hidden = !error.textContent;
        paintCost();
      });

      return wrap;
    }

    function addSection() {
      var nameInput = textInput('', { placeholder: tl('local.featureNamePlaceholder'), maxLength: MAX_FEATURE_NAME_LENGTH });
      var nameField = field(tl('local.featureNameLabel'), nameInput);

      var keyInput = textInput('', { placeholder: tl('local.featureKeyPlaceholder'), maxLength: MAX_FEATURE_KEY_LENGTH });
      var keyField = field(t('featurePricing.featureKey'), keyInput);

      var costInput = numberInput('', { min: 0, max: MAX_CREDIT_COST, placeholder: tl('local.creditCostPlaceholder') });
      var costField = field(t('featurePricing.creditCost'), costInput);

      var pair = el('div', 'row--2');
      pair.appendChild(keyField);
      pair.appendChild(costField);

      var addBtn = button('btn btn--secondary btn--block', t('featurePricing.addRow'), function () { addRow(); });

      function addRow() {
        var key = textOf(keyInput.value).trim();
        if (!key) {
          setFieldError(keyField, keyInput, tl('local.featureKeyRequired'));
          keyInput.focus();
          return;
        }
        if (key.length > MAX_FEATURE_KEY_LENGTH) {
          setFieldError(keyField, keyInput, tl('local.featureKeyTooLong'));
          keyInput.focus();
          return;
        }
        if (!FEATURE_KEY_PATTERN.test(key)) {
          setFieldError(keyField, keyInput, t('featurePricing.featureKeyInvalid'));
          keyInput.focus();
          return;
        }
        if (key === UNIT_PRICE_KEY || findRow(key)) {
          setFieldError(keyField, keyInput, t('featurePricing.featureKeyDuplicate'));
          keyInput.focus();
          return;
        }
        setFieldError(keyField, keyInput, '');

        var cost = intOf(costInput.value);
        if (isNaN(cost) || cost < 0 || cost > MAX_CREDIT_COST) {
          setFieldError(costField, costInput, t('featurePricing.creditCostInvalid'));
          costInput.focus();
          return;
        }
        setFieldError(costField, costInput, '');

        state.rows.push({
          id: null,
          key: key,
          name: textOf(nameInput.value).trim() || defaultFeatureName(key),
          cost: cost,
          originalName: '',
          originalCost: -1,
          active: true,
          isNew: true,
          error: ''
        });

        toast(tl('local.addRowDone'), 'success');
        draw();
      }

      return section(t('featurePricing.addRow'), t('featurePricing.note'), [nameField, pair, addBtn]);
    }

    function estimateCard() {
      var card = el('div', 'card card--soft');
      card.appendChild(el('div', 'card__label', t('featurePricing.estimatedCost')));
      state.estimateValue = el('div', 'card__value num', fmtYen(totalCredits() * state.unitPrice));
      card.appendChild(state.estimateValue);
      state.estimateSub = el('div', 'card__sub', tl('local.estimateSub', {
        n: fmtNumber(totalCredits()),
        price: fmtNumber(state.unitPrice)
      }));
      card.appendChild(state.estimateSub);
      return card;
    }

    function saveAll(saveLabel) {
      if (state.saving) { return; }

      var invalid = false;
      state.rows.forEach(function (row) { if (row.error || row.costManualError) { invalid = true; } });
      if (invalid) {
        toast(t('featurePricing.creditCostInvalid'), 'danger');
        return;
      }

      var jobs = [];
      state.rows.forEach(function (row) {
        if (!row.id) {
          jobs.push({ row: row, kind: 'insert' });
          return;
        }
        if (row.cost !== row.originalCost || row.name !== row.originalName
            || row.costManual !== row.originalCostManual) {
          jobs.push({ row: row, kind: 'update' });
        }
      });

      /* 会社ごとの原価（074）。変えた升だけ書く */
      var aiJobs = [];
      Object.keys(state.providerDirty).forEach(function (k) {
        var cut = k.indexOf('|');
        if (cut < 1) { return; }
        var want = state.providerDirty[k];
        var saved = state.manualProvider[k];
        var before = saved ? saved.usd : null;
        if (want === before) { return; }
        aiJobs.push({
          id: saved ? saved.id : null,
          featureKey: k.slice(0, cut),
          provider: k.slice(cut + 1),
          usd: want
        });
      });

      if (!jobs.length && !aiJobs.length) {
        toast(tl('local.nothingToSave'));
        goto('S18', null, true);
        return;
      }

      state.saving = true;
      busy(state.saveBtn, true, tl('local.saving'), saveLabel);

      /* ponytail: 1件ずつ順番に流すだけ。数十件までならこれで足りる。
         数百件を一括で保存したくなったら Supabase の upsert に置き換える。 */
      var saved = 0;
      var chain = Promise.resolve();
      jobs.forEach(function (job) {
        chain = chain.then(function () {
          if (job.kind === 'update') {
            return tableUpdate('featureCredits', job.row.id, {
              feature_name: job.row.name,
              credit_cost: job.row.cost,
              /* null を送ると実測の計算に戻る（063） */
              cost_usd_each_manual: job.row.costManual === undefined ? null : job.row.costManual,
              is_active: job.row.active !== false
            }).then(function () { saved += 1; });
          }
          return tableInsert('featureCredits', {
            feature_key: job.row.key,
            feature_name: job.row.name || job.row.key,
            credit_cost: job.row.cost,
            cost_usd_each_manual: job.row.costManual === undefined ? null : job.row.costManual,
            is_active: true
          }).then(function () { saved += 1; });
        });
      });

      aiJobs.forEach(function (job) {
        chain = chain.then(function () {
          if (job.id) {
            return tableUpdate('featureProviderCosts', job.id, {
              usd_each_manual: job.usd,
              updated_at: new Date().toISOString()
            }).then(function () { saved += 1; });
          }
          /* 空のまま保存したときは、行そのものを作らない */
          if (job.usd === null || job.usd === undefined) { return null; }
          return tableInsert('featureProviderCosts', {
            feature_key: job.featureKey,
            provider: job.provider,
            usd_each_manual: job.usd
          }).then(function () { saved += 1; });
        });
      });

      chain.then(function () {
        state.saving = false;
        toast(tl('local.savedCount', { n: fmtNumber(saved) }), 'success');
        goto('S18', null, true);
      }, function (err) {
        state.saving = false;
        busy(state.saveBtn, false, tl('local.saving'), saveLabel);
        console.error('[screens-admin] 機能別ポイントの保存に失敗しました（保存できた件数 ' + saved + '）', err);
        toast(saved > 0 ? tl('local.saveFailedPartial') : t('featurePricing.saveFailed'), 'danger');
        /* 途中まで保存されている可能性があるので、再試行は保存のやり直しではなく読み直しにする */
        handleError(err, load);
      });
    }
  }

  /* =========================================================
   * 画面登録（第2引数は必ず { render: 関数 }）
   * ========================================================= */
  App.registerScreen('S18', {
    render: function (root) { renderAdmin(root); }
  });

  App.registerScreen('S19', {
    render: function (root) { renderFeaturePricing(root); }
  });

  /* 通信なしの自己チェック（開発時にコンソールから ScreensAdmin._selfTest()）。
     購入プランの読み取りだけ見る。ここが緩むと、壊れた行がそのまま金額になる */
  window.ScreensAdmin = {
    _selfTest: function () {
      function assert(ok, name) {
        if (!ok) { throw new Error('[screens-admin] 自己チェック失敗: ' + name); }
      }
      assert(parsePlans('[]').length === 0, '空');
      assert(parsePlans('こわれている').length === 0, 'JSONでない');
      assert(parsePlans('{"credits":100}').length === 0, '配列でない');
      assert(parsePlans('[{"id":"a","credits":100,"yen":1200}]')[0].yen === 1200, '正しい行');
      assert(parsePlans('[{"id":"a","credits":0,"yen":1200}]').length === 0, 'ポイント0は捨てる');
      assert(parsePlans('[{"id":"a","credits":100,"yen":-1}]').length === 0, 'マイナス円は捨てる');
      assert(parsePlans('[{"id":"a","credits":"ごひゃく","yen":1200}]').length === 0, '数でないものは捨てる');

      var many = [];
      for (var i = 0; i < 12; i += 1) { many.push({ id: 'p' + i, credits: 100, yen: 1000 }); }
      assert(parsePlans(JSON.stringify(many)).length === MAX_PLANS, '9件で止める');

      console.log('[screens-admin] 自己チェック OK');
      return true;
    }
  };
})(window, document);
