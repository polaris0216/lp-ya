# 掲載先（クラウドファンディング）のロゴ

販売ページの「誘いの塊」（LINE登録セクション）の頭に出すロゴ。
**各社が公式に配布しているものだけ**をここに置く。拾い物は置かない。

取得日: 2026-10-04

## makuake.png

- 元: `Makuake_logo/png/Makuake_Logo_yoko.png`（1920×530）→ 高さ72pxに縮小
- 出どころ: Makuakeヘルプ「Makuakeロゴを使いたいのですが、何に気をつけたらいいですか？」
  https://mkhelp.makuake.com/hc/ja/articles/13897727579929
  → 《Makuakeロゴデータ》 https://app.box.com/s/shy8cpwa8db4hyf6ajvmtkb43w6akzhe
  （ログイン不要で配布されている）
- 条件（ロゴガイドライン・ロゴ使用ルールの遵守が前提）:
  - プロジェクトページの**キービジュアルには使えない**
  - 雇用・提携・パートナーシップ関係があるかのような使い方、
    承認・後援・推奨を示唆する使い方はできない
  - デジタルデータで形を正確に再現する（描き直さない）

## campfire.png

- 元: `CAMPFIRE_brand_resource/3 LOGO PR/png/campfire-pr-badge-horizontal.png`
  （1386×91）→ 高さ56pxに縮小
- 出どころ: CAMPFIREヘルプ「CAMPFIREのサービスロゴを利用することはできますか？」
  https://help.camp-fire.jp/hc/ja/campfireのサービスロゴを利用することはできますか
  → CAMPFIRE ロゴ素材（配布用）
  https://drive.google.com/file/d/1ME2LWUfngsEpsy-cspNx9Pdh9eETkK61/view
- 条件: 利用規約が「ウェブサイトや広告で、CAMPFIRE で行っている
  クラウドファンディングプロジェクト自体の宣伝を行う場合」を
  **許諾なしで可**としている。まさにこの用途。あわせて:
  - クリエイティブでは「クラウドファンディング公開中」の**バッジ入り**を使う
    → なのでコーポレートロゴでも素のサービスロゴでもなく、PRバッジを選んでいる
  - 広告主ロゴやプロジェクト名より**過度に大きくしない**
  - シンボルマーク単体での使用は不可（バッジは組みで1つなので問題ない）
  - 色・デザインを変えない。彩度の高い地の上では白版を使う
    → 誘いの塊の地は差し色の5%（＝ほぼ白）なので、カラー版で合っている
  - 周囲にロゴの高さの1/2のアイソレーション（余白）

## 入れていない掲載先

**GREENFUNDING**（株式会社ワンモア）と **machi-ya**（メディアジーン）は、
2026-10-04 時点で公式のロゴ配布ページが見つからなかった。
第三者のロゴ集（brandfetch 等）は「公式に許可された配布」ではないので使わない。
この2つは名前の文字組みで出す。素材を各社からもらえたら、
ここに置いて `tools/make-platform-logos.mjs` を回せば差し替わる。

## 差し替え方

    node tools/make-platform-logos.mjs

で `lp-ya/platform-logos.js` を作り直す。PNG はページに data URI で
焼き込む（iframe の srcdoc・ZIP・公開ページ、どれでも相対パスが効かないため）。
