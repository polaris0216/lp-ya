/* =============================================================================
 * fonts.js — ブランド書体の一覧（画面とワーカーが同じ表を読む）
 *
 * なぜ1か所にするか:
 *   書体の鍵は3か所で使われる。
 *     ① 商品入力の画面（S4）… 使う人が選ぶ
 *     ② 生成プロンプト（job-worker の brand_fonts）… AIが選ぶ
 *     ③ 画の指示（briefDesign）… 絵の中の文字をどの書体で描くか
 *   前は①が6種、③が3種しか対応表を持っておらず、
 *   ①で「丸ゴシック」を選んでも③では明朝で描かれていた（2026-11-19 発見）。
 *   鍵の集合がずれないように、表はここだけに置く。
 *
 * 画面の見え方について:
 *   外部CDNは使わない方針なので、**端末に載っている書体だけで組む**。
 *   一覧の名前は実在する書体名だが、画面のプレビューはその書体の
 *   「系統」（明朝・ゴシック・丸ゴ…）で出る。これは意図どおりで、
 *   書体名がそのまま効くのは③の画の指示（絵の中の文字）のほう。
 *
 * ブラウザ＝グローバル（LpFonts）、Node＝module.exports。
 * ========================================================================== */
(function (global) {
  /* 系統。css は端末にある書体だけ、prompt は絵の指示に添える言い方 */
  var GROUPS = {
    mincho: {
      name: '明朝体',
      css: "'Hiragino Mincho ProN', 'Yu Mincho', YuMincho, serif",
      prompt: '明朝（細い横画と太い縦画の和文セリフ）'
    },
    gothic: {
      name: 'ゴシック体',
      css: "'Hiragino Sans', 'Yu Gothic', Meiryo, system-ui, sans-serif",
      prompt: 'ゴシック（線の太さが均一な和文サンセリフ）'
    },
    maru: {
      name: '丸ゴシック体',
      css: "'Hiragino Maru Gothic ProN', 'Yu Gothic', system-ui, sans-serif",
      prompt: '丸ゴシック（角が丸い柔らかい和文サンセリフ）'
    },
    brush: {
      name: '筆書体・デザイン書体',
      css: "'Hiragino Mincho ProN', 'Yu Mincho', serif",
      prompt: '筆書き・デザイン書体（手書きや版下の味がある和文）'
    },
    serifEn: {
      name: '欧文セリフ',
      css: "Georgia, 'Times New Roman', serif",
      prompt: 'セリフ欧文（うろこのあるローマン体）'
    },
    sansEn: {
      name: '欧文サンセリフ',
      css: "Helvetica, Arial, system-ui, sans-serif",
      prompt: 'サンセリフ欧文（うろこの無いグロテスク体）'
    },
    display: {
      name: '欧文ディスプレイ',
      css: "Impact, 'Arial Black', Haettenschweiler, sans-serif",
      prompt: 'ディスプレイ欧文（見出し専用の強い字面）'
    },
    mono: {
      name: '等幅',
      css: "'SF Mono', Menlo, Consolas, monospace",
      prompt: '等幅（文字幅がそろう機械的な書体）'
    }
  };

  /* [鍵, 表示名, 系統, 向いている所（AIが選ぶときの手がかり・20字以内）]
     鍵は保存される値なので、**一度出したものは消さない・綴りを変えない**。
     先頭6つ（gothic / mincho / maru / gothicBold / serifEn / sansEn）は
     2026-11-19 より前に保存された値なので、必ず残す */
  var ROWS = [
    ['gothic', 'ゴシック（標準）', 'gothic', '迷ったらこれ。読みやすさ優先'],
    ['mincho', '明朝（標準）', 'mincho', '上質・落ち着き・ギフト'],
    ['maru', '丸ゴシック（標準）', 'maru', '親しみ・子ども・やさしさ'],
    ['gothicBold', 'ゴシック 太字', 'gothic', '数値や強調を太く見せる'],
    ['serifEn', 'セリフ欧文（標準）', 'serifEn', '海外・クラシック・香り'],
    ['sansEn', 'サンセリフ欧文（標準）', 'sansEn', '無国籍・機能的'],

    /* ── 明朝体 ── */
    ['ryumin', 'リュウミン', 'mincho', '出版の定番。端正で読みやすい'],
    ['reimin', '黎ミン', 'mincho', '現代的な明朝。細くても粘る'],
    ['a1mincho', 'A1明朝', 'mincho', '角のにじみ。懐かしい温度'],
    ['shuei', '秀英明朝', 'mincho', '新聞の骨格。硬質で真面目'],
    ['shueiShogo', '秀英初号明朝', 'mincho', '大見出し。筆の抑揚が強い'],
    ['tsukuMincho', '筑紫明朝', 'mincho', 'ふところが狭く文学的'],
    ['tsukuOldMincho', '筑紫オールド明朝', 'mincho', '古風。和の老舗らしさ'],
    ['tsukuAMidashiMin', '筑紫A見出ミン', 'mincho', '太い明朝見出し。品と力'],
    ['tsukuCMidashiMin', '筑紫C見出ミン', 'mincho', '抑揚の強い明朝見出し'],
    ['yumincho', '游明朝体', 'mincho', '穏やか。長文でも疲れない'],
    ['yutsukiShogo', '游築初号明朝', 'mincho', '大正風の見出し。情緒'],
    ['hiraMincho', 'ヒラギノ明朝', 'mincho', 'すっきり。都会的な明朝'],
    ['honMincho', '本明朝', 'mincho', '書籍の標準。中庸'],
    ['kocho', '光朝', 'mincho', '極細のコントラスト。化粧品'],
    ['tenMincho', '貂明朝', 'mincho', '筆の気配。やわらかい明朝'],
    ['shippori', 'しっぽり明朝', 'mincho', '素朴で柔らかい。手仕事'],
    ['hannari', 'はんなり明朝', 'mincho', '京都らしい軽やかさ'],
    ['notoSerifJp', 'Noto Serif JP', 'mincho', '無難。多言語でそろう'],
    ['genryuMin', '源流明朝', 'mincho', '素直な明朝。無料系の定番'],
    ['iwataMincho', 'イワタ明朝体', 'mincho', 'educational。生真面目'],
    ['bunkyuMincho', '凸版文久明朝', 'mincho', '小さくても読める明朝'],
    ['kaimin', '解ミン 月', 'mincho', '抑揚の効いた細身の明朝'],
    ['kaiminTen', '解ミン 宙', 'mincho', '明朝の骨に現代の線'],

    /* ── ゴシック体 ── */
    ['shingo', '新ゴ', 'gothic', '看板・交通。誰にでも読める'],
    ['gothicMB101', 'ゴシックMB101', 'gothic', '広告の定番。字面が大きい'],
    ['midashiGoMB31', '見出ゴMB31', 'gothic', '太い見出し。安売り感が出にくい'],
    ['taigoB101', '太ゴB101', 'gothic', 'ずっしり。信頼と重さ'],
    ['chuGothicBBB', '中ゴシックBBB', 'gothic', '癖がない本文ゴシック'],
    ['tsukuGothic', '筑紫ゴシック', 'gothic', '柔らかいゴシック。生活雑貨'],
    ['tsukuOldGothic', '筑紫オールドゴシック', 'gothic', '昭和の味。レトロ'],
    ['yugothic', '游ゴシック体', 'gothic', '線が細く上品。白を活かす'],
    ['hiraKakuGo', 'ヒラギノ角ゴ', 'gothic', 'Apple風。清潔でモダン'],
    ['notoSansJp', 'Noto Sans JP', 'gothic', '無難。多言語でそろう'],
    ['genNoKaku', '源ノ角ゴシック', 'gothic', '素直。無料系の定番'],
    ['udShingo', 'UD新ゴ', 'gothic', '読み間違えにくい。高齢者向け'],
    ['udKakuGo', 'ヒラギノUD角ゴ', 'gothic', '小さい字でも潰れない'],
    ['bunkyuGothic', '凸版文久ゴシック', 'gothic', '本文向けの穏やかなゴシック'],
    ['koburina', 'こぶりなゴシック', 'gothic', '小さめの字面。余白が映える'],
    ['rodin', 'ロダン', 'gothic', 'まっすぐ。実用品らしさ'],
    ['tbGothic', 'TBゴシック', 'gothic', '素直な本文ゴシック'],
    ['folk', 'フォーク', 'gothic', '明朝の骨にゴシックの線。個性'],
    ['seurat', 'スーラ', 'gothic', '明るく軽い。食品・雑貨'],
    ['shinGoCond', '新ゴ コンデンス', 'gothic', '幅を詰めて長い見出しを入れる'],
    ['bokutohRaira', '墨東レラ', 'gothic', '筆のうねりが残るゴシック'],
    ['tsukuAntique', '筑紫アンティークゴシック', 'gothic', '古書の匂い。クラフト'],
    ['jiyuGothic', '自由ゴシック', 'gothic', '手書きに近い抜け感'],
    ['kinutaGothic', '砧ゴシック', 'gothic', '端正で現代的'],

    /* ── 丸ゴシック体 ── */
    ['shinMaruGo', '新丸ゴ', 'maru', '定番の丸ゴ。清潔で親しみ'],
    ['maruFolk', '丸フォーク', 'maru', '上品な丸ゴ。美容・ベビー'],
    ['jun', 'じゅん', 'maru', 'ふっくら。お菓子・子ども'],
    ['hiraMaruGo', 'ヒラギノ丸ゴ', 'maru', '素直な丸ゴ。説明文にも'],
    ['tsukuAMaruGo', '筑紫A丸ゴシック', 'maru', '柔らかく品がある'],
    ['nikoMoji', 'にくまるフォント', 'maru', '太くてかわいい。ポップ'],
    ['mPlusRounded', 'M PLUS Rounded 1c', 'maru', '素直な丸ゴ。無料系'],
    ['komorebi', 'こもれびゴシック', 'maru', '線が細い丸ゴ。やさしい'],

    /* ── 筆書体・デザイン書体 ── */
    ['kyokasho', '教科書体', 'brush', '手書きの正しい形。学習・子ども'],
    ['udKyokasho', 'UDデジタル教科書体', 'brush', '読み書きに配慮。学校'],
    ['kaisho', '楷書体', 'brush', '礼。挨拶文・のし'],
    ['gyosho', '行書体', 'brush', '流れる筆。和食・酒'],
    ['reisho', '隷書体', 'brush', '扁平な筆。漢方・老舗'],
    ['rikurei', '陸隷', 'brush', '隷書の意匠版。力強い'],
    ['kanteiryu', '勘亭流', 'brush', '芝居文字。祭り・縁日'],
    ['edomoji', '江戸文字', 'brush', '寄席・提灯。粋'],
    ['shino', '篠', 'brush', '細い筆。繊細な和'],
    ['kokuryu', '黒龍', 'brush', '太い墨。迫力・辛さ'],
    ['bokutoh', '墨東ルイカ', 'brush', '筆の気配を残した見出し'],
    ['showaModern', '昭和モダン', 'brush', '大正〜昭和の広告文字'],
    ['raglanPunch', 'ラグランパンチ', 'brush', '極太の角。スポーツ・激安'],
    ['takaHand', 'タカハンド', 'brush', '手書き太字。楽しい'],
    ['logoMaru', 'ロゴ丸', 'brush', 'ロゴ用の丸文字。かわいい'],

    /* ── 欧文セリフ ── */
    ['garamond', 'Garamond', 'serifEn', '古典。本と香り'],
    ['baskerville', 'Baskerville', 'serifEn', '端正な英国。信頼'],
    ['bodoni', 'Bodoni', 'serifEn', '極端な太細。モード誌'],
    ['didot', 'Didot', 'serifEn', '高級化粧品・ファッション'],
    ['caslon', 'Caslon', 'serifEn', '読みやすい古典。手紙'],
    ['georgia', 'Georgia', 'serifEn', '画面で読みやすいセリフ'],
    ['timesNewRoman', 'Times New Roman', 'serifEn', '書類らしさ。中立'],
    ['playfair', 'Playfair Display', 'serifEn', '見出し向きの高コントラスト'],
    ['cormorant', 'Cormorant', 'serifEn', '細く繊細。余白が映える'],
    ['minion', 'Minion', 'serifEn', '長文向け。落ち着き'],
    ['sabon', 'Sabon', 'serifEn', '穏やかな古典。工芸'],
    ['freight', 'Freight Text', 'serifEn', '現代的なセリフ。雑誌'],
    ['trajan', 'Trajan', 'serifEn', '碑文の大文字。格式'],
    ['clarendon', 'Clarendon', 'serifEn', '太いうろこ。レトロ看板'],
    ['rockwell', 'Rockwell', 'serifEn', '角材のような太いセリフ'],
    ['merriweather', 'Merriweather', 'serifEn', '画面向け。素直'],

    /* ── 欧文サンセリフ ── */
    ['helvetica', 'Helvetica', 'sansEn', '中立。何にでも合う'],
    ['helveticaNeue', 'Helvetica Neue', 'sansEn', '整った中立。家電'],
    ['univers', 'Univers', 'sansEn', '体系的。工業製品'],
    ['akzidenz', 'Akzidenz-Grotesk', 'sansEn', 'スイス流。硬派'],
    ['futura', 'Futura', 'sansEn', '幾何学。モダニズム'],
    ['avenir', 'Avenir', 'sansEn', '幾何学＋人間味。清潔'],
    ['gillSans', 'Gill Sans', 'sansEn', '英国の humanist。穏やか'],
    ['frutiger', 'Frutiger', 'sansEn', '案内表示。読みやすい'],
    ['din', 'DIN', 'sansEn', 'ドイツ工業規格。寸法・工具'],
    ['interstate', 'Interstate', 'sansEn', '道路標識。力強い'],
    ['proximaNova', 'Proxima Nova', 'sansEn', 'Web定番。親しみやすい'],
    ['montserrat', 'Montserrat', 'sansEn', '幅広。見出しが決まる'],
    ['gotham', 'Gotham', 'sansEn', '都会的。まっすぐ'],
    ['optima', 'Optima', 'sansEn', '抑揚のあるサンセリフ。上品'],
    ['lato', 'Lato', 'sansEn', '素直。本文にも'],
    ['openSans', 'Open Sans', 'sansEn', '無難。読みやすい'],
    ['inter', 'Inter', 'sansEn', '画面最適。アプリらしさ'],
    ['roboto', 'Roboto', 'sansEn', 'Android。中立で現代的'],
    ['franklinGothic', 'Franklin Gothic', 'sansEn', '新聞見出し。報道らしさ'],
    ['eurostile', 'Eurostile', 'sansEn', '角の四角。未来・機械'],

    /* ── 欧文ディスプレイ ── */
    ['bebasNeue', 'Bebas Neue', 'display', '細長い大文字。スポーツ'],
    ['oswald', 'Oswald', 'display', '詰まった見出し。情報量'],
    ['anton', 'Anton', 'display', '極太。数字を叫ぶ'],
    ['impact', 'Impact', 'display', '最も太い。安さ・勢い'],
    ['cooperBlack', 'Cooper Black', 'display', '丸い極太。レトロで甘い'],
    ['lobster', 'Lobster', 'display', '筆記体。カフェ・食'],
    ['pacifico', 'Pacifico', 'display', '手書き風。南国・気軽'],
    ['copperplate', 'Copperplate', 'display', '小さな serif。老舗の看板'],

    /* ── 等幅 ── */
    ['courier', 'Courier', 'mono', 'タイプライター。書類・証明'],
    ['robotoMono', 'Roboto Mono', 'mono', '素直な等幅。数値表'],
    ['ibmPlexMono', 'IBM Plex Mono', 'mono', '技術的。開発者向け'],
    ['jetbrainsMono', 'JetBrains Mono', 'mono', '読みやすい等幅。コード']
  ];

  var list = ROWS.map(function (r) {
    return { key: r[0], name: r[1], group: r[2], mood: r[3] };
  });
  var byKey = {};
  list.forEach(function (f) { byKey[f.key] = f; });

  /* 画面の並び。系統ごとにまとめて出す（100件を素のリストで出すと選べない） */
  var groupOrder = ['gothic', 'mincho', 'maru', 'brush', 'serifEn', 'sansEn', 'display', 'mono'];
  function groups() {
    return groupOrder.map(function (g) {
      return {
        key: g, name: GROUPS[g].name,
        fonts: list.filter(function (f) { return f.group === g; })
      };
    });
  }

  function has(key) { return !!byKey[String(key || '')]; }
  /* 鍵 → 系統。HTMLのLPは系統ごとの CSS で描くので、この1語に落として渡す */
  function groupOf(key) {
    var f = byKey[String(key || '')];
    return f ? f.group : '';
  }
  function cssOf(key) {
    var f = byKey[String(key || '')];
    var css = f ? GROUPS[f.group].css : '';
    /* 太字の鍵だけは重さも持たせる（系統は同じゴシック） */
    return f && f.key === 'gothicBold' ? css + '; font-weight: 700' : css;
  }
  /* 絵の指示に入れる言い方。書体名＋系統の説明。
     絵の中の文字は画像AIが描くので、ここは実在の書体名がそのまま効く */
  function promptOf(key) {
    var f = byKey[String(key || '')];
    if (!f) { return ''; }
    return f.name + '／' + GROUPS[f.group].prompt;
  }
  /* AIに選ばせるときに渡す一覧。1行1書体で短く */
  function lines() {
    return groups().map(function (g) {
      return '【' + g.name + '】\n' + g.fonts.map(function (f) {
        return '  ' + f.key + ' = ' + f.name + '｜' + f.mood;
      }).join('\n');
    }).join('\n');
  }

  var api = {
    GROUPS: GROUPS, list: list, byKey: byKey, groups: groups,
    has: has, groupOf: groupOf, cssOf: cssOf, promptOf: promptOf, lines: lines,
    keys: list.map(function (f) { return f.key; })
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.LpFonts = api;
}(typeof window !== 'undefined' ? window : globalThis));
