# エルピーヤ (Elpiya)

## 1. アプリ概要

エルピーヤは、日本のクラウドファンディング（Makuake・CAMPFIRE・GREENFUNDING・Machi-ya等）で商品を販売するセラーや、セラーから業務委託を受けるデザイナーのための、LP・広告・LINEコンテンツ制作アプリです。

売れている競合LPのURLを最大5件登録するだけで、ページ構成・訴求順・CTA配置・売れた理由を自動分析し、その勝ちパターンを反映したクラファンLP・自社LP（LINE友だち追加ボタン付き）・KV・Meta広告クリエイティブ・LINEコンテンツ（リッチメニュー／リッチメッセージ／あいさつメッセージ／メッセージ）を一括生成します。

利用は事前購入したクレジットの消費制で、機能ごとに必要クレジットが設定されています。管理者はクレジット単価・機能別必要クレジット・ユーザー・問い合わせ・クーポンを管理画面から一元管理できます。

- アプリ名: エルピーヤ
- プラットフォーム: Web / iOS / Android（Capacitorで同一コードをアプリ化）
- 対応言語: 日本語（初期表示）/ English / 한국어（アプリ内で即時切替、選択を保持）
- 表示テーマ: ライト固定
- データ保存先: Supabase（本アプリはローカルストレージに業務データを保存しません。保持するのは言語設定と選択中IDのみです）

## 2. 技術構成

- ビルドツール・外部CDNなし。純粋なHTML/CSS/JSのみで構成しています。
- 画面表示は index.html を唯一のHTMLシェルとし、各screens-*.jsが `App.registerScreen("画面ID", { render: function(root, params) {...} })` の形で自身の画面を登録するハッシュルーター方式です（app.js が司令塔、画面自体は描画しません）。
- ストア提出用に Capacitor で iOS/Android ネイティブシェルを生成します。

### ファイル構成

```
index.html              アプリの唯一のHTMLシェル（共通ヘッダー・下部タブバー・#app差し込み先）
styles.css               全画面共通スタイル（デザイントークン・カード/入力/ボタン/タブ/モーダル等）
i18n.js                  日本語/English/한국어の辞書と言語切替エンジン
api.js                   Supabase RESTへのfetchラッパー（業務データの読み書き専用）
app.js                   ハッシュルーター兼司令塔（画面登録・状態管理・共通UIヘルパー）
screens-auth.js          S1 ログイン / S2 会員登録
screens-home.js          S3 ダッシュボード / S4 プロジェクト作成
screens-project-ops.js   S5 プロジェクト操作メニュー / S6 プロジェクト名変更 / S7 プロジェクト削除確認
screens-project.js       S8 プロジェクト詳細 / S9 商品登録
screens-analysis.js      S10 競合分析 / S11 分析レポート / S12 分析内容確認
screens-generate.js      S13 生成結果 / S14 デザイン編集 / S15 デバイスプレビュー拡大
screens-credit.js        S16 クレジット消費確認 / S17 クレジット
screens-admin.js         S18 管理画面 / S19 機能別クレジット価格設定
package.json             Capacitor用プロジェクト定義
capacitor.config.json    Capacitor設定（appId / appName / webDir）
README.md                本ファイル
```

## 3. ローカルでの確認方法

ビルド不要の静的サイトなので、任意の静的サーバーで index.html を配信するだけで動作確認できます。

```bash
npx serve .
# もしくは
python3 -m http.server 8080
```

ブラウザで表示された URL を開いてください（`file://` 直開きは fetch のCORS制約で動作しないため、必ずローカルサーバー経由で確認してください）。

## 4. ストア出荷手順

このアプリは Capacitor で純粋なHTML/CSS/JSをiOS/Androidのネイティブシェルに包んで配布します。以下の順番で作業してください。

### ① 依存パッケージのインストール

```bash
npm install
```

`package.json` に `@capacitor/core` `@capacitor/cli` `@capacitor/ios` `@capacitor/android` を依存として定義済みです。

### ② ネイティブプロジェクトの追加

```bash
npx cap add ios
npx cap add android
```

それぞれ `ios/` `android/` ディレクトリにネイティブプロジェクト一式が生成されます（初回のみ）。

### ③ Web資産の同期

`index.html` `styles.css` `*.js` を編集するたびに実行し、`webDir`（"."＝プロジェクトルート）の内容をネイティブプロジェクトへコピーします。

```bash
npx cap sync
```

### ④ ネイティブIDEでの署名・ビルド

**iOS（Xcodeで署名・Archive）**

```bash
npx cap open ios
```

Xcodeが開いたら、
1. Signing & Capabilities で自分の Apple Developer チームを選択し、Bundle Identifier（`jp.elpiya.app`）を確認する
2. アプリアイコン・スプラッシュ画像を `ios/App/App/Assets.xcassets` に設定する（後述の規格を参照）
3. メニューの Product → Archive でアーカイブを作成する
4. Organizer からアーカイブを検証（Validate App）し、App Store Connect へアップロードする

**Android（Android Studioで署名済みAAB）**

```bash
npx cap open android
```

Android Studioが開いたら、
1. アプリアイコン・スプラッシュ画像を `android/app/src/main/res` の各解像度フォルダに設定する（後述の規格を参照）
2. Build → Generate Signed Bundle / APK を選択し、Android App Bundle（.aab）を選ぶ
3. 署名鍵（keystore）を新規作成または既存のものを指定し、release ビルドで署名済み .aab を生成する
4. `applicationId`（`jp.elpiya.app`）とバージョン番号を確認する

### ⑤ ストアへのアップロード

- **App Store Connect**（https://appstoreconnect.apple.com）: ③で作成したアーカイブをアップロード後、アプリ情報・スクリーンショット・審査情報を入力して審査に提出する
- **Google Play Console**（https://play.google.com/console）: ④で生成した署名済み .aab を内部テスト／製品トラックにアップロードし、ストア掲載情報・スクリーンショットを入力して審査に提出する

## 5. 必要なアカウント

| アカウント | 費用 | 用途 |
|---|---|---|
| Apple Developer Program | 年額 99 USD（法人は 299 USD） | iOSアプリの署名・App Store Connectへの提出に必須 |
| Google Play Developer | 登録料 25 USD（初回のみ・買い切り） | Androidアプリの署名済みAABのGoogle Play Consoleへの提出に必須 |

いずれもアプリを実機やTestFlight/内部テストで配布する前に、事前に取得しておく必要があります。

## 6. アイコン・スプラッシュ画像の規格

| 用途 | サイズ | 形式 | 備考 |
|---|---|---|---|
| iOSアプリアイコン | 1024×1024px | PNG | 角丸なし・透過なし（アルファチャンネル不可）。Xcodeが自動で各サイズに書き出す |
| Androidアプリアイコン | 512×512px | PNG | Google Play Console の掲載情報用アイコン |
| Androidアダプティブアイコン（前景レイヤー） | 432×432px | PNG | 透過対応。中央 66% 程度のセーフゾーン内にロゴを収める |
| スプラッシュ画像 | 2732×2732px | PNG | 起動画面。中央に収まるよう余白を持たせ、背景色は `#FAF8FB`（オフホワイト）に合わせる |

いずれもブランドカラーのグラデーション（`linear-gradient(135deg,#C13584 0%,#5B2A86 55%,#515BD4 100%)`）を基調にデザインしてください。

## 7. Supabase 接続先・テーブル一覧

本アプリの業務データはすべて Supabase REST API 経由で読み書きします（localStorageには言語設定と選択中IDのみを保持し、業務データは保存しません）。

- 接続先URL: `https://hhmresepzahfhwhywxhu.supabase.co`
- 認証: `apikey` / `Authorization: Bearer <anon key>` ヘッダー（anon keyは `api.js` に定義）

| テーブル | 内容 |
|---|---|
| `a2f58db45_users` | 利用者アカウント（メール／Google ID）とクレジット残高 |
| `a2f58db45_projects` | 1商品＝1プロジェクト。商品情報を含む制作の単位 |
| `a2f58db45_analysis_reports` | 競合LP分析の実行結果と勝ちパターン |
| `a2f58db45_generations` | 生成物（クラファンLP・自社LP・KV・メタ広告・LINEコンテンツ）とA/B公開計測 |
| `a2f58db45_credit_transactions` | クレジットの購入・消費・付与の履歴 |
| `a2f58db45_feature_credits` | 機能ごとの必要クレジット（管理者が変更） |
| `a2f58db45_coupons` | 管理者が発行するクレジット／月間無制限利用クーポン |
| `a2f58db45_inquiries` | ユーザーからの問い合わせと対応状況 |

`id` と `created_at` は Supabase が自動採番するため、書き込み時には送信しません。通信に失敗した場合は画面に日本語のエラーメッセージと「再試行」操作を表示します。

## 8. ログインについての注意

本アプリは現時点でログイン機能（会員登録・メール認証・Google連携）が未実装です。ユーザーの識別や権限分けを行っていないため、**このアプリを開いた人は全員が同じSupabaseデータ（同じプロジェクト・クレジット残高・生成物）を見ます。** 個人ごとのデータ分離が必要な場合は、認証機能の実装後にご利用ください。この注意書きはアプリの全画面ヘッダー下に常時表示されます。

## 9. 画面一覧

| ID | 画面名 | 登録ファイル |
|---|---|---|
| S1 | ログイン | screens-auth.js |
| S2 | 会員登録 | screens-auth.js |
| S3 | ダッシュボード | screens-home.js |
| S4 | プロジェクト作成 | screens-home.js |
| S5 | プロジェクト操作メニュー | screens-project-ops.js |
| S6 | プロジェクト名変更 | screens-project-ops.js |
| S7 | プロジェクト削除確認 | screens-project-ops.js |
| S8 | プロジェクト詳細 | screens-project.js |
| S9 | 商品登録 | screens-project.js |
| S10 | 競合分析 | screens-analysis.js |
| S11 | 分析レポート | screens-analysis.js |
| S12 | 分析内容確認 | screens-analysis.js |
| S13 | 生成結果 | screens-generate.js |
| S14 | デザイン編集 | screens-generate.js |
| S15 | デバイスプレビュー拡大 | screens-generate.js |
| S16 | クレジット消費確認 | screens-credit.js |
| S17 | クレジット | screens-credit.js |
| S18 | 管理画面 | screens-admin.js |
| S19 | 機能別クレジット価格設定 | screens-admin.js |
| settings | 設定（言語切替・アカウント情報） | app.js |
