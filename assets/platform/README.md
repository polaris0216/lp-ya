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

- 元: `CAMPFIRE_brand_resource/3 LOGO PR/png/campfire-pr-badge-vertical.png`
  （→ 高さ150pxに縮小、583×150）
  横組み（1386×91）もあるが、縦横比が 15:1 で、ロゴを大きく見せる組みだと
  細い帯になって読めない。縦組みは 3.9:1 で、ほかの3つとほぼ同じ比率になる
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

## greenfunding.svg

- 元: `header-logo_green_funding-….svg`（117×36）そのまま
- 出どころ: GREENFUNDING が自分のサイトのヘッダーで配っているもの
  https://assets.greenfunding.jp/assets/layouts/common/header-logo_green_funding-b78e4742b64ff7bcba14ff2125d7688eb902de64f08ac7131d254915543f25d7.svg
- 注意: Makuake や CAMPFIRE と違い、**ロゴ素材の配布ページと使用条件の文書は
  見つかっていない**（運営は株式会社ワンモア）。2026-10-04、利用者の
  「各社公式に使用を許可している」という判断で登録した。
  条件の文書が出てきたら、ここに書き足して必要なら直すこと。

## machiya.png

- 元: `logo-c-….png`（347×82、透過）そのまま
- 出どころ: machi-ya が自分のサイトで配っているもの
  https://static.camp-fire.jp/assets/machiya/logo-c-e5d98bfe7060f24b80f542a37af89b0960ef25f55c12e308778c5374eefa1a6d.png
  （`?auto=format` を付けると JPEG になって透過が落ちるので、付けずに取る）
- 注意: greenfunding と同じ。**配布ページと使用条件の文書は見つかっていない**
  （運営はメディアジーン、掲載は CAMPFIRE 上）。同じく利用者の判断で登録した。

## 差し替え方

    node tools/make-platform-logos.mjs

で `lp-ya/platform-logos.js` を作り直す。PNG はページに data URI で
焼き込む（iframe の srcdoc・ZIP・公開ページ、どれでも相対パスが効かないため）。
