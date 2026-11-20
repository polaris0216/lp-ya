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
    ['ryumin', 'リュウミン', 'mincho', '出版の定番。端正で読みやすい', "'A-OTF Ryumin Pr6N','Ryumin'"],
    ['reimin', '黎ミン', 'mincho', '現代的な明朝。細くても粘る', "'A-OTF Reimin Pr6N'"],
    ['a1mincho', 'A1明朝', 'mincho', '角のにじみ。懐かしい温度', "'A-OTF A1 Mincho Std','A1 Mincho'"],
    ['shuei', '秀英明朝', 'mincho', '新聞の骨格。硬質で真面目', "'A-OTF Shuei Mincho Pr6N'"],
    ['shueiShogo', '秀英初号明朝', 'mincho', '大見出し。筆の抑揚が強い', "'A-OTF Shuei NijimiMin Std'"],
    ['tsukuMincho', '筑紫明朝', 'mincho', 'ふところが狭く文学的', "'Tsukushi Mincho Pr6N','TsukuMinPr6N'"],
    ['tsukuOldMincho', '筑紫オールド明朝', 'mincho', '古風。和の老舗らしさ', "'Tsukushi Old Mincho'"],
    ['tsukuAMidashiMin', '筑紫A見出ミン', 'mincho', '太い明朝見出し。品と力', "'Tsukushi A Midashi Min'"],
    ['tsukuCMidashiMin', '筑紫C見出ミン', 'mincho', '抑揚の強い明朝見出し', "'Tsukushi C Midashi Min'"],
    ['yumincho', '游明朝体', 'mincho', '穏やか。長文でも疲れない', "'Yu Mincho','YuMincho'"],
    ['yutsukiShogo', '游築初号明朝', 'mincho', '大正風の見出し。情緒', "'Yu Mincho','YuMincho'"],
    ['hiraMincho', 'ヒラギノ明朝', 'mincho', 'すっきり。都会的な明朝', "'Hiragino Mincho ProN','Hiragino Mincho Pro'"],
    ['honMincho', '本明朝', 'mincho', '書籍の標準。中庸', "'Hon Mincho'"],
    ['kocho', '光朝', 'mincho', '極細のコントラスト。化粧品', "'A-OTF Kocho Std'"],
    ['tenMincho', '貂明朝', 'mincho', '筆の気配。やわらかい明朝', "'Ten Mincho','Ten Mincho Text'"],
    ['shippori', 'しっぽり明朝', 'mincho', '素朴で柔らかい。手仕事', "'Shippori Mincho'"],
    ['hannari', 'はんなり明朝', 'mincho', '京都らしい軽やかさ', "'Hannari'"],
    ['notoSerifJp', 'Noto Serif JP', 'mincho', '無難。多言語でそろう', "'Noto Serif JP','Noto Serif CJK JP'"],
    ['genryuMin', '源流明朝', 'mincho', '素直な明朝。無料系の定番', "'Genryu Mincho','Source Han Serif JP'"],
    ['iwataMincho', 'イワタ明朝体', 'mincho', 'educational。生真面目', "'Iwata Mincho Pro'"],
    ['bunkyuMincho', '凸版文久明朝', 'mincho', '小さくても読める明朝', "'Toppan Bunkyu Mincho'"],
    ['kaimin', '解ミン 月', 'mincho', '抑揚の効いた細身の明朝', "'Kaimin Tsuki'"],
    ['kaiminTen', '解ミン 宙', 'mincho', '明朝の骨に現代の線', "'Kaimin Sora'"],

    /* ── ゴシック体 ── */
    ['shingo', '新ゴ', 'gothic', '看板・交通。誰にでも読める', "'A-OTF Shin Go Pr6N','Shin Go'"],
    ['gothicMB101', 'ゴシックMB101', 'gothic', '広告の定番。字面が大きい', "'A-OTF Gothic MB101 Pr6N'"],
    ['midashiGoMB31', '見出ゴMB31', 'gothic', '太い見出し。安売り感が出にくい', "'A-OTF Midashi Go MB31 Pr6N'"],
    ['taigoB101', '太ゴB101', 'gothic', 'ずっしり。信頼と重さ', "'A-OTF Futo Go B101 Pr6N'"],
    ['chuGothicBBB', '中ゴシックBBB', 'gothic', '癖がない本文ゴシック', "'A-OTF Gothic BBB Pr6N'"],
    ['tsukuGothic', '筑紫ゴシック', 'gothic', '柔らかいゴシック。生活雑貨', "'Tsukushi A Round Gothic','Tsukushi Gothic'"],
    ['tsukuOldGothic', '筑紫オールドゴシック', 'gothic', '昭和の味。レトロ', "'Tsukushi Old Gothic'"],
    ['yugothic', '游ゴシック体', 'gothic', '線が細く上品。白を活かす', "'Yu Gothic','YuGothic'"],
    ['hiraKakuGo', 'ヒラギノ角ゴ', 'gothic', 'Apple風。清潔でモダン', "'Hiragino Sans','Hiragino Kaku Gothic ProN'"],
    ['notoSansJp', 'Noto Sans JP', 'gothic', '無難。多言語でそろう', "'Noto Sans JP','Noto Sans CJK JP'"],
    ['genNoKaku', '源ノ角ゴシック', 'gothic', '素直。無料系の定番', "'Source Han Sans JP','Noto Sans CJK JP'"],
    ['udShingo', 'UD新ゴ', 'gothic', '読み間違えにくい。高齢者向け', "'A-OTF UD Shin Go Pr6N'"],
    ['udKakuGo', 'ヒラギノUD角ゴ', 'gothic', '小さい字でも潰れない', "'Hiragino Sans','Hiragino UD Sans'"],
    ['bunkyuGothic', '凸版文久ゴシック', 'gothic', '本文向けの穏やかなゴシック', "'Toppan Bunkyu Gothic'"],
    ['koburina', 'こぶりなゴシック', 'gothic', '小さめの字面。余白が映える', "'Koburina Gothic StdN'"],
    ['rodin', 'ロダン', 'gothic', 'まっすぐ。実用品らしさ', "'FOT-Rodin Pro'"],
    ['tbGothic', 'TBゴシック', 'gothic', '素直な本文ゴシック', "'TBGothic'"],
    ['folk', 'フォーク', 'gothic', '明朝の骨にゴシックの線。個性', "'FOT-Folk Pro'"],
    ['seurat', 'スーラ', 'gothic', '明るく軽い。食品・雑貨', "'FOT-Seurat Pro'"],
    ['shinGoCond', '新ゴ コンデンス', 'gothic', '幅を詰めて長い見出しを入れる', "'A-OTF Shin Go Con Pr6N'"],
    ['bokutohRaira', '墨東レラ', 'gothic', '筆のうねりが残るゴシック', "'Bokutoh Reira'"],
    ['tsukuAntique', '筑紫アンティークゴシック', 'gothic', '古書の匂い。クラフト', "'Tsukushi Antique Gothic'"],
    ['jiyuGothic', '自由ゴシック', 'gothic', '手書きに近い抜け感', "'Jiyu Gothic'"],
    ['kinutaGothic', '砧ゴシック', 'gothic', '端正で現代的', "'Kinuta Gothic'"],

    /* ── 丸ゴシック体 ── */
    ['shinMaruGo', '新丸ゴ', 'maru', '定番の丸ゴ。清潔で親しみ', "'A-OTF Shin Maru Go Pr6N'"],
    ['maruFolk', '丸フォーク', 'maru', '上品な丸ゴ。美容・ベビー', "'FOT-Maru Folk Pro'"],
    ['jun', 'じゅん', 'maru', 'ふっくら。お菓子・子ども', "'A-OTF Jun Pro','Jun 101'"],
    ['hiraMaruGo', 'ヒラギノ丸ゴ', 'maru', '素直な丸ゴ。説明文にも', "'Hiragino Maru Gothic ProN','Hiragino Maru Gothic Pro'"],
    ['tsukuAMaruGo', '筑紫A丸ゴシック', 'maru', '柔らかく品がある', "'Tsukushi A Round Gothic'"],
    ['nikoMoji', 'にくまるフォント', 'maru', '太くてかわいい。ポップ', "'Nikumaru'"],
    ['mPlusRounded', 'M PLUS Rounded 1c', 'maru', '素直な丸ゴ。無料系', "'M PLUS Rounded 1c'"],
    ['komorebi', 'こもれびゴシック', 'maru', '線が細い丸ゴ。やさしい', "'Komorebi Gothic'"],

    /* ── 筆書体・デザイン書体 ── */
    ['kyokasho', '教科書体', 'brush', '手書きの正しい形。学習・子ども', "'YuKyokasho','Kyokasho ICA'"],
    ['udKyokasho', 'UDデジタル教科書体', 'brush', '読み書きに配慮。学校', "'UD Digi Kyokasho N-R','UD Digi Kyokasho NK-R'"],
    ['kaisho', '楷書体', 'brush', '礼。挨拶文・のし', "'Kaisho','Toppan Bunkyu Midashi Mincho'"],
    ['gyosho', '行書体', 'brush', '流れる筆。和食・酒', "'Gyosho','Hannari'"],
    ['reisho', '隷書体', 'brush', '扁平な筆。漢方・老舗', "'Reisho','Oradano Mincho'"],
    ['rikurei', '陸隷', 'brush', '隷書の意匠版。力強い', "'Rikurei'"],
    ['kanteiryu', '勘亭流', 'brush', '芝居文字。祭り・縁日', "'Kanteiryu'"],
    ['edomoji', '江戸文字', 'brush', '寄席・提灯。粋', "'Edo Moji','Kanteiryu'"],
    ['shino', '篠', 'brush', '細い筆。繊細な和', "'Shino'"],
    ['kokuryu', '黒龍', 'brush', '太い墨。迫力・辛さ', "'Kokuryu'"],
    ['bokutoh', '墨東ルイカ', 'brush', '筆の気配を残した見出し', "'Bokutoh Ruika'"],
    ['showaModern', '昭和モダン', 'brush', '大正〜昭和の広告文字', "'Showa Modern'"],
    ['raglanPunch', 'ラグランパンチ', 'brush', '極太の角。スポーツ・激安', "'Raglan Punch'"],
    ['takaHand', 'タカハンド', 'brush', '手書き太字。楽しい', "'TakaHand'"],
    ['logoMaru', 'ロゴ丸', 'brush', 'ロゴ用の丸文字。かわいい', "'Logo Maru'"],

    /* ── 欧文セリフ ── */
    ['garamond', 'Garamond', 'serifEn', '古典。本と香り', "Garamond,'EB Garamond','Adobe Garamond Pro'"],
    ['baskerville', 'Baskerville', 'serifEn', '端正な英国。信頼', "Baskerville,'Baskerville Old Face'"],
    ['bodoni', 'Bodoni', 'serifEn', '極端な太細。モード誌', "'Bodoni 72','Bodoni MT',Bodoni"],
    ['didot', 'Didot', 'serifEn', '高級化粧品・ファッション', "Didot,'Didot LT STD'"],
    ['caslon', 'Caslon', 'serifEn', '読みやすい古典。手紙', "'Big Caslon','Libre Caslon Text',Caslon"],
    ['georgia', 'Georgia', 'serifEn', '画面で読みやすいセリフ', "Georgia"],
    ['timesNewRoman', 'Times New Roman', 'serifEn', '書類らしさ。中立', "'Times New Roman',Times"],
    ['playfair', 'Playfair Display', 'serifEn', '見出し向きの高コントラスト', "'Playfair Display'"],
    ['cormorant', 'Cormorant', 'serifEn', '細く繊細。余白が映える', "Cormorant,'Cormorant Garamond'"],
    ['minion', 'Minion', 'serifEn', '長文向け。落ち着き', "'Minion Pro','Minion 3'"],
    ['sabon', 'Sabon', 'serifEn', '穏やかな古典。工芸', "'Sabon LT Std',Sabon"],
    ['freight', 'Freight Text', 'serifEn', '現代的なセリフ。雑誌', "'Freight Text Pro'"],
    ['trajan', 'Trajan', 'serifEn', '碑文の大文字。格式', "'Trajan Pro','Trajan Pro 3'"],
    ['clarendon', 'Clarendon', 'serifEn', '太いうろこ。レトロ看板', "Clarendon,'Clarendon LT Std'"],
    ['rockwell', 'Rockwell', 'serifEn', '角材のような太いセリフ', "Rockwell,'Rockwell Nova'"],
    ['merriweather', 'Merriweather', 'serifEn', '画面向け。素直', "Merriweather"],

    /* ── 欧文サンセリフ ── */
    ['helvetica', 'Helvetica', 'sansEn', '中立。何にでも合う', "Helvetica"],
    ['helveticaNeue', 'Helvetica Neue', 'sansEn', '整った中立。家電', "'Helvetica Neue'"],
    ['univers', 'Univers', 'sansEn', '体系的。工業製品', "Univers,'Univers LT Std'"],
    ['akzidenz', 'Akzidenz-Grotesk', 'sansEn', 'スイス流。硬派', "'Akzidenz-Grotesk','Akzidenz Grotesk BQ'"],
    ['futura', 'Futura', 'sansEn', '幾何学。モダニズム', "Futura,'Futura PT'"],
    ['avenir', 'Avenir', 'sansEn', '幾何学＋人間味。清潔', "Avenir,'Avenir Next'"],
    ['gillSans', 'Gill Sans', 'sansEn', '英国の humanist。穏やか', "'Gill Sans','Gill Sans MT'"],
    ['frutiger', 'Frutiger', 'sansEn', '案内表示。読みやすい', "Frutiger,'Frutiger LT Std'"],
    ['din', 'DIN', 'sansEn', 'ドイツ工業規格。寸法・工具', "'DIN Alternate','DIN Condensed','D-DIN'"],
    ['interstate', 'Interstate', 'sansEn', '道路標識。力強い', "Interstate"],
    ['proximaNova', 'Proxima Nova', 'sansEn', 'Web定番。親しみやすい', "'Proxima Nova'"],
    ['montserrat', 'Montserrat', 'sansEn', '幅広。見出しが決まる', "Montserrat"],
    ['gotham', 'Gotham', 'sansEn', '都会的。まっすぐ', "Gotham,'Montserrat'"],
    ['optima', 'Optima', 'sansEn', '抑揚のあるサンセリフ。上品', "Optima,'Optima nova'"],
    ['lato', 'Lato', 'sansEn', '素直。本文にも', "Lato"],
    ['openSans', 'Open Sans', 'sansEn', '無難。読みやすい', "'Open Sans'"],
    ['inter', 'Inter', 'sansEn', '画面最適。アプリらしさ', "Inter"],
    ['roboto', 'Roboto', 'sansEn', 'Android。中立で現代的', "Roboto"],
    ['franklinGothic', 'Franklin Gothic', 'sansEn', '新聞見出し。報道らしさ', "'Franklin Gothic Medium','Franklin Gothic'"],
    ['eurostile', 'Eurostile', 'sansEn', '角の四角。未来・機械', "Eurostile,'Eurostile LT Std'"],

    /* ── 欧文ディスプレイ ── */
    ['bebasNeue', 'Bebas Neue', 'display', '細長い大文字。スポーツ', "'Bebas Neue'"],
    ['oswald', 'Oswald', 'display', '詰まった見出し。情報量', "Oswald"],
    ['anton', 'Anton', 'display', '極太。数字を叫ぶ', "Anton"],
    ['impact', 'Impact', 'display', '最も太い。安さ・勢い', "Impact"],
    ['cooperBlack', 'Cooper Black', 'display', '丸い極太。レトロで甘い', "'Cooper Black','Cooper Std'"],
    ['lobster', 'Lobster', 'display', '筆記体。カフェ・食', "Lobster"],
    ['pacifico', 'Pacifico', 'display', '手書き風。南国・気軽', "Pacifico"],
    ['copperplate', 'Copperplate', 'display', '小さな serif。老舗の看板', "Copperplate,'Copperplate Gothic'"],

    /* ── 等幅 ── */
    ['courier', 'Courier', 'mono', 'タイプライター。書類・証明', "'Courier New',Courier"],
    ['robotoMono', 'Roboto Mono', 'mono', '素直な等幅。数値表', "'Roboto Mono'"],
    ['ibmPlexMono', 'IBM Plex Mono', 'mono', '技術的。開発者向け', "'IBM Plex Mono'"],
    ['jetbrainsMono', 'JetBrains Mono', 'mono', '読みやすい等幅。コード', "'JetBrains Mono'"]
  ];

  var list = ROWS.map(function (r) {
    /* family は、その書体の**実際の CSS 名**。端末に入っていれば本物で出る。
       入っていなければ、後ろに続く系統の並びに落ちる（2026-11-19 要望:
       「フォント選ぶ時のリストに、フォント名前にそのフォントを適用した
         リストにして」）。外部CDNを使わない方針は変えていないので、
       出せるのは端末に載っているものだけ */
    return { key: r[0], name: r[1], group: r[2], mood: r[3], family: r[4] || '' };
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
  /* その端末で、その書体が**本物で出せるか**（2026-11-19 要望:
       「どんなフォントデザインなのかわかるようにしてほしい」）。
     端末に無い書体は CSS が黙って飛ばすので、見た目は系統のものになる。
     黙って別の形を見せると「これがリュウミンだ」と誤解させるので、
     出せないものは画面でそう言う。

     測り方: 同じ字を、その書体＋monospace と、無い書体＋monospace で描いて
     幅を比べる。違えば、その書体が効いている。
     document.fonts.check は当てにならない（無い書体でも true を返す）。
     1回測ったら覚える（一覧を開くたびに124回測らない）。 */
  var canCache = {};
  function canShow(key) {
    var f = byKey[String(key || '')];
    if (!f || !f.family) { return false; }
    if (canCache[f.key] !== undefined) { return canCache[f.key]; }
    var out = false;
    try {
      var ctx = document.createElement('canvas').getContext('2d');
      var text = /^[\x20-\x7e]+$/.test(f.name) ? 'Handgloves 123' : 'あア漢Ag';
      var wide = function (fam) { ctx.font = '32px ' + fam; return ctx.measureText(text).width; };
      out = Math.round(wide(f.family + ', monospace') * 100)
        !== Math.round(wide("'__lpya_none__', monospace") * 100);
    } catch (err) { out = false; }
    canCache[f.key] = out;
    return out;
  }

  /* 鍵 → 系統。HTMLのLPは系統ごとの CSS で描くので、この1語に落として渡す */
  function groupOf(key) {
    var f = byKey[String(key || '')];
    return f ? f.group : '';
  }
  function cssOf(key) {
    var f = byKey[String(key || '')];
    if (!f) { return ''; }
    /* 実際の書体名を先に、系統の並びを後ろに。
       **端末に無い書体はここで黙って飛ばされる**（CSSの決まり）ので、
       一覧では同じ系統の見た目になる。無い書体を無理に出す方法は無い */
    var css = (f.family ? f.family + ', ' : '') + GROUPS[f.group].css;
    /* 太字の鍵だけは重さも持たせる（系統は同じゴシック） */
    return f.key === 'gothicBold' ? css + '; font-weight: 700' : css;
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
    has: has, groupOf: groupOf, canShow: canShow, cssOf: cssOf, promptOf: promptOf, lines: lines,
    keys: list.map(function (f) { return f.key; })
  };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  global.LpFonts = api;
}(typeof window !== 'undefined' ? window : globalThis));
