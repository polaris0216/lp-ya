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
 *   project_create プロジェクト作成
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
  var UNIT_PRICE_KEY = 'credit_unit_price';        // feature_credits に置く単価専用の行
  var UNIT_PRICE_NAME = 'クレジット単価（円）';
  var DEFAULT_UNIT_PRICE = 10;                     // 1クレジット = 10円
  var USER_LIMIT = 50;
  var INQUIRY_LIMIT = 50;
  var COUPON_LIMIT = 20;
  var TX_SCAN_LIMIT = 300;                         // 本日の消費を数えるために読む履歴の上限
  var MAX_FEATURE_KEY_LENGTH = 40;
  var MAX_FEATURE_NAME_LENGTH = 40;
  var MAX_CREDIT_COST = 100000;
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
    { key: 'line_content', cost: 15, name: ['LINEコンテンツ生成', 'LINE content generation', 'LINE 콘텐츠 생성'] },
    { key: 'project_create', cost: 10, name: ['プロジェクト作成', 'Project creation', '프로젝트 생성'] }
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
      '単価・機能別クレジット・ユーザー・クーポン・問い合わせをここで管理します',
      'Manage unit price, feature credits, users, coupons and inquiries here',
      '단가·기능별 크레딧·사용자·쿠폰·문의를 여기에서 관리합니다'
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
    'local.unitPriceSub': ['1クレジットあたりの円', 'Yen per credit', '크레딧당 엔'],
    'local.unitPriceDesc': [
      '保存するとクレジット購入画面の表示価格に反映されます',
      'Saving updates the prices shown on the purchase screen',
      '저장하면 크레딧 구매 화면의 표시 가격에 반영됩니다'
    ],
    'local.todaySub': ['本日 {n}件の消費', '{n} charges today', '오늘 {n}건 소비'],
    'local.userSectionDesc': ['登録 {n}人（新しい順）', '{n} registered users (newest first)', '등록 {n}명(최신순)'],
    'local.usersEmpty': ['登録ユーザーがいません', 'No registered users yet', '등록된 사용자가 없습니다'],
    'local.userNameFallback': ['名称未設定', 'No name', '이름 없음'],
    'local.balanceLabel': ['残高', 'Balance', '잔액'],
    'local.joinedLabel': ['登録日', 'Registered', '가입일'],
    'local.adminBadge': ['管理者', 'Admin', '관리자'],
    'local.unlimitedBadge': ['無制限 {date}まで', 'Unlimited until {date}', '무제한 {date}까지'],
    'local.unlimitedNone': ['無制限利用権なし', 'No unlimited access', '무제한 이용권 없음'],
    'local.userActions': ['ユーザー操作', 'User actions', '사용자 관리'],
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
    'local.grantCreditLabel': ['付与するクレジット', 'Credits to grant', '지급할 크레딧'],
    'local.grantUnlimitedLabel': ['無制限利用の日数', 'Days of unlimited access', '무제한 이용 일수'],
    'local.grantAction': ['付与', 'Grant', '지급'],
    'local.grantAmountInvalid': ['1以上の整数を入力してください', 'Please enter a whole number of 1 or more', '1 이상의 정수를 입력해 주세요'],
    'local.grantDaysInvalid': ['1〜365の整数を入力してください', 'Please enter a whole number from 1 to 365', '1~365 사이의 정수를 입력해 주세요'],
    'local.grantCreditDone': ['{name} に{n}クレジットを付与しました', 'Granted {n} credits to {name}', '{name} 님에게 {n} 크레딧을 지급했습니다'],
    'local.grantUnlimitedDone': [
      '{name} に無制限利用権を{days}日間付与しました（{until}まで）',
      'Granted {days} days of unlimited access to {name} (until {until})',
      '{name} 님에게 무제한 이용권을 {days}일 지급했습니다({until}까지)'
    ],
    'local.grantFailed': ['付与に失敗しました', 'The grant failed', '지급에 실패했습니다'],
    'local.grantMemo': ['管理画面からの付与', 'Granted from the admin screen', '관리 화면에서 지급'],
    'local.couponSection': ['クーポン発行', 'Issue coupon', '쿠폰 발행'],
    'local.couponSectionDesc': [
      'クレジットまたは月間無制限利用のクーポンを発行します',
      'Issue credit coupons or unlimited-access coupons',
      '크레딧 또는 월간 무제한 이용 쿠폰을 발행합니다'
    ],
    'local.couponCodeLabel': ['クーポンコード', 'Coupon code', '쿠폰 코드'],
    'local.couponCodePlaceholder': ['半角英数字4〜32文字', '4 to 32 letters or numbers', '영문·숫자 4~32자'],
    'local.couponGenerate': ['自動生成', 'Generate', '자동 생성'],
    'local.couponTypeLabel': ['クーポンの種類', 'Coupon type', '쿠폰 종류'],
    'local.couponTypeCredit': ['クレジット付与', 'Credit grant', '크레딧 지급'],
    'local.couponTypeUnlimited': ['無制限利用', 'Unlimited access', '무제한 이용'],
    'local.couponCreditLabel': ['付与クレジット', 'Credits granted', '지급 크레딧'],
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
    'local.featureListDesc': ['{n}件の機能（1回あたりの消費クレジット）', '{n} features (credits used per run)', '{n}개 기능(1회당 소모 크레딧)'],
    'local.featureListEmpty': ['機能が登録されていません。下の入力から行を追加してください', 'No features yet. Add a row with the form below.', '등록된 기능이 없습니다. 아래 입력에서 행을 추가해 주세요'],
    'local.unsavedBadge': ['未保存', 'Unsaved', '미저장'],
    'local.featureNameLabel': ['機能名（任意）', 'Feature name (optional)', '기능 이름(선택)'],
    'local.featureNamePlaceholder': ['例: KV生成', 'e.g. Key visual generation', '예: KV 생성'],
    'local.featureKeyPlaceholder': ['例: kv_generation', 'e.g. kv_generation', '예: kv_generation'],
    'local.creditCostPlaceholder': ['例: 20', 'e.g. 20', '예: 20'],
    'local.featureKeyRequired': ['機能キーを入力してください', 'Please enter a feature key', '기능 키를 입력해 주세요'],
    'local.featureKeyTooLong': ['機能キーは40文字までです', 'A feature key can be up to 40 characters', '기능 키는 40자까지입니다'],
    'local.addRowDone': ['行を追加しました。保存して戻ると反映されます', 'Row added. Save to apply it.', '행을 추가했습니다. 저장하면 반영됩니다'],
    'local.estimateSub': ['合計 {n}CR × 単価 {price}円', '{n} CR total x {price} yen', '합계 {n}CR × 단가 {price}엔'],
    'local.savedCount': ['{n}件を保存しました', 'Saved {n} rows', '{n}건을 저장했습니다'],
    'local.nothingToSave': ['変更はありません', 'No changes to save', '변경 사항이 없습니다'],
    'local.saveFailedPartial': [
      '一部の行だけ保存された状態で失敗しました。画面を開き直して内容を確認してください。',
      'The save failed partway through. Please reopen this screen and check the rows.',
      '일부 행만 저장된 상태에서 실패했습니다. 화면을 다시 열어 내용을 확인해 주세요.'
    ],
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
      console.error('[screens-admin] Api.credits.' + name + ' がありません。api.js を確認してください。');
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
    node.type = 'text';
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
    node.step = '1';
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
      inquiries: [],
      coupons: [],
      todayCredits: 0,
      todayCount: 0,
      couponType: 'credit'
    };

    load();

    function load() {
      showLoading(root);
      Promise.all([
        tableList('featureCredits', { order: 'created_at.asc' }),
        tableList('users', { order: 'created_at.desc', limit: USER_LIMIT }),
        tableList('creditTransactions', { order: 'created_at.desc', limit: TX_SCAN_LIMIT }),
        tableList('inquiries', { order: 'created_at.desc', limit: INQUIRY_LIMIT }),
        tableList('coupons', { order: 'created_at.desc', limit: COUPON_LIMIT })
      ]).then(function (results) {
        var featureRows = results[0] || [];
        state.unitPrice = unitPriceOf(featureRows);
        state.unitRowId = unitPriceRowId(featureRows);
        state.featureCount = 0;
        featureRows.forEach(function (row) {
          if (textOf(row.feature_key).trim() !== UNIT_PRICE_KEY) { state.featureCount += 1; }
        });
        state.users = results[1] || [];
        applyToday(results[2] || []);
        state.inquiries = results[3] || [];
        state.coupons = results[4] || [];
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

      wrap.appendChild(unitPriceSection());
      wrap.appendChild(usersSection());
      wrap.appendChild(couponSection());
      wrap.appendChild(inquiriesSection());

      var actions = el('div', 'stack stack--group');
      actions.appendChild(button('btn btn--secondary btn--block', t('admin.featurePricingLink'), function () {
        goto('S19');
      }));
      actions.appendChild(button('btn btn--text btn--block', t('admin.backToDashboard'), function () {
        goto('S3');
      }));
      wrap.appendChild(actions);

      root.appendChild(wrap);
    }

    /* ---- クレジット単価 ---- */
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
          console.error('[screens-admin] クレジット単価の保存に失敗しました', err);
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
      if (user.is_admin) { meta += ' ・ ' + tl('local.adminBadge'); }
      bodyNode.appendChild(el('div', 'list-row__meta clamp-2', meta));

      row.appendChild(bodyNode);
      row.appendChild(statusBadge(user));
      return row;
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
      var until = unlimitedUntilOf(user);
      info.appendChild(infoRow(t('admin.grantUnlimited'), until ? fmtDate(until) : tl('local.unlimitedNone')));
      modal.appendChild(info);

      /* クレジット付与 */
      var creditInput = numberInput('', { min: 1, max: MAX_GRANT_CREDIT, placeholder: '100' });
      var creditField = field(tl('local.grantCreditLabel'), creditInput);
      var creditLabel = tl('local.grantAction');
      var creditBtn = button('btn btn--secondary', creditLabel, function () { grantCredit(); });
      var creditRow = el('div', 'row--input-action');
      creditRow.appendChild(creditField);
      creditRow.appendChild(creditBtn);
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

      /* 状態切替と閉じる */
      var actions = el('div', 'modal__actions');
      actions.appendChild(button('btn btn--secondary', t('common.close'), function () { closeModal(); }));
      actions.appendChild(button(isActiveUser(user) ? 'btn btn--danger' : 'btn btn--primary',
        isActiveUser(user) ? tl('local.toSuspend') : tl('local.toActivate'),
        function () { toggleStatus(); }));
      modal.appendChild(actions);

      open(modal, {});

      function grantCredit() {
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
        busy(creditBtn, true, tl('local.processing'), creditLabel);
        grant(user.id, amount, tl('local.grantMemo')).then(function () {
          closeModal();
          toast(tl('local.grantCreditDone', { name: displayNameOf(user), n: fmtNumber(amount) }), 'success');
          load();
        }, function (err) {
          busy(creditBtn, false, tl('local.processing'), creditLabel);
          console.error('[screens-admin] クレジットの付与に失敗しました', err);
          toast(tl('local.grantFailed'), 'danger');
          handleError(err, grantCredit);
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

      modal.appendChild(el('p', 'modal__body', tl('local.inquiryBodyLabel')));
      modal.appendChild(el('p', 'note-box', textOf(inquiry.body)));

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
      estimateValue: null,
      estimateSub: null,
      saveBtn: null,
      saving: false
    };

    load();

    function load() {
      showLoading(root);
      tableList('featureCredits', { order: 'created_at.asc' }).then(function (rows) {
        build(rows || []);
        draw();
      }, function (err) {
        console.error('[screens-admin] 機能別クレジットの読み込みに失敗しました', err);
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
          originalName: name,
          originalCost: cost,
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

    function listSection() {
      var body;
      if (!state.rows.length) {
        body = emptyBlock(tl('local.featureListEmpty'));
      } else {
        body = el('div', 'list');
        body.appendChild(el('div', 'list__head', t('featurePricing.creditCost')));
        state.rows.forEach(function (row) { body.appendChild(featureRow(row)); });
      }
      return section(t('featurePricing.list'), tl('local.featureListDesc', { n: fmtNumber(state.rows.length) }), [body]);
    }

    function featureRow(row) {
      var wrap = el('div', 'stack stack--tight');
      var line = el('div', 'list-row');

      var bodyNode = el('div', 'list-row__body');
      var title = el('div', 'list-row__title clamp-1', row.name);
      bodyNode.appendChild(title);
      var sub = el('div', 'list-row__sub clamp-1', row.key);
      bodyNode.appendChild(sub);
      if (row.isNew) {
        bodyNode.appendChild(el('div', 'list-row__meta', tl('local.unsavedBadge')));
      }
      line.appendChild(bodyNode);

      var input = numberInput(row.cost, { min: 0, max: MAX_CREDIT_COST, narrow: true });
      input.setAttribute('aria-label', row.name + ' ' + t('featurePricing.creditCost'));
      line.appendChild(input);
      wrap.appendChild(line);

      var error = el('p', 'field__error', '');
      error.hidden = true;
      wrap.appendChild(error);

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
        error.textContent = row.error;
        error.hidden = !row.error;
        recalcEstimate();
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
      state.rows.forEach(function (row) { if (row.error) { invalid = true; } });
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
        if (row.cost !== row.originalCost || row.name !== row.originalName) {
          jobs.push({ row: row, kind: 'update' });
        }
      });

      if (!jobs.length) {
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
              is_active: job.row.active !== false
            }).then(function () { saved += 1; });
          }
          return tableInsert('featureCredits', {
            feature_key: job.row.key,
            feature_name: job.row.name || job.row.key,
            credit_cost: job.row.cost,
            is_active: true
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
        console.error('[screens-admin] 機能別クレジットの保存に失敗しました（保存できた件数 ' + saved + '）', err);
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
})(window, document);
