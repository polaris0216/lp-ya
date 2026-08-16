/* =============================================================================
 * lp-render.js — 生成物1件を LP の HTML にする、描画の中核だけ
 *
 * どこから来たか:
 *   旧 screens-generate.js（S13 生成結果画面）から、画面のUIを外して
 *   描画の部分だけを抜き出したもの。S12・S13 を作り直すにあたって、
 *   実物を測って決めた組み方を捨てないために残す。
 *
 * ここに入っている「測って決めたこと」:
 *   ・クラファンLPは Makuake と同じ形で組む
 *     本文カラム712px、画像はカラムを端まで埋め、余白も角丸も無い。
 *     訴求は写真に焼き込んだ1枚絵（burnedPanel）にし、地の文は
 *     末尾の5区画（商品概要・ブランドの物語・プロジェクトに関する情報・
 *     リスク&チャレンジ・リターン）だけに置く。
 *     実測: 実物は高さ40,374px・画像29枚・HTMLの文字2,088字。
 *     この組み方で 高さ31,771px・ビジュアル39枚・文字2,026字 まで寄った。
 *   ・焼き込みは SVG で行う。画像生成に日本語を描かせると字形が崩れる。
 *     canvas を使わないのは、外部の写真を描くと canvas が汚れて
 *     PNG 書き出しが丸ごと失敗するため。
 *   ・自社LPの LINE友だち追加は、本文の後半に繰り返し置き、末尾と
 *     画面下の固定バーにも置く（lineSpots）。実物の自社LP4本を測った:
 *       LAVA CLIP 58/64/75/83% ・ SilverAnt 75%と末尾 ・ NANOBAG 末尾
 *       ・ FLEXY 末尾。前半に置いていたページは1本も無い。
 *
 * 使い方:
 *   LpRender.buildHtml({ title, sections, assets, design, type, lineUrl,
 *                        lineStyle, linePosition, forDownload })
 *   type は LpRender.TYPE.CF / LpRender.TYPE.OWN
 *   assets は LpRender.assetPoolOf(project)
 *
 * まだ画面からは読まれていない。新しい生成画面ができたら index.html に足す。
 * ========================================================================== */
(function () {
  'use strict';

  var TYPE = { CF: 'crowdfunding_lp', OWN: 'own_lp' };

  /* 旧画面の文言表からは切り離した。描画に要るのはこの3つだけ。
     画面側に文言表ができたら、そちらを見るように差し替える */
  var TEXT = {
    'gen.lineButtonLabel': '友だち追加',
    'gen.ctaButton': '詳しく見る',
    'gen.imagePlaceholder': '（画像をここに入れます）'
  };
  function t(key) { return TEXT[key] === undefined ? key : TEXT[key]; }

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

  function lineHref(raw) {
    var s = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!s) { return ''; }
    if (/^https?:\/\/\S+$/i.test(s)) { return s; }
    var m = s.match(/href\s*=\s*["']([^"']+)["']/i);
    if (m && /^https?:\/\//i.test(m[1])) { return m[1].trim(); }
    return '';
  }

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

  function lineBarMarkup(style, href) {
    return '<div class="line-bar"><a href="' + escapeHtml(href) + '">'
      + escapeHtml(style.label) + '</a></div>';
  }

  function lineSpots(sections, position) {
    var n = sections.length;
    var out = [];
    if (!n) { return out; }
    var i;
    for (i = Math.floor(n * 0.6); i < n; i += 2) { out.push(i); }
    if (out.indexOf(n - 1) === -1) { out.push(n - 1); }
    if (position) {
      sections.forEach(function (section, index) {
        if (String(section.key) === position && out.indexOf(index) === -1) { out.push(index); }
      });
    }
    return out;
  }

  var ASSET_DIRECTIVE = /[［\[]([^］\]]{2,200})[］\]]/g;

  var ASSET_WORD = /動画|GIF|ＧＩＦ|サムネ|写真|画像|図版|カット/;

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

  var CF_TEXT_KEYS = ['overview', 'story', 'project_info', 'risk', 'returns'];

  function isCfTextSection(section) {
    return CF_TEXT_KEYS.indexOf(String(section && section.key)) !== -1;
  }

  function burnedPanel(src, title, body, design, width) {
    var W = width;
    var pad = 36;
    var titleSize = 32;
    var bodySize = 18;
    var titleLines = title ? wrapLines(title, (W - pad * 2) / (titleSize * 0.62)) : [];
    var bodyLines = body ? wrapLines(body, (W - pad * 2) / (bodySize * 0.62)) : [];
    var titleStep = Math.round(titleSize * 1.45);
    var bodyStep = Math.round(bodySize * 1.85);
    var textH = titleLines.length || bodyLines.length
      ? pad + titleLines.length * titleStep + (titleLines.length && bodyLines.length ? 14 : 0)
        + bodyLines.length * bodyStep + pad
      : 0;
    var imgH = Math.round(W * 0.72);
    var H = imgH + textH;
    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H
      + '" viewBox="0 0 ' + W + ' ' + H + '" style="display:block;width:100%;height:auto;">');
    out.push('<rect width="' + W + '" height="' + H + '" fill="' + escapeHtml(design.bgColor) + '"/>');
    if (src) {
      out.push('<image href="' + escapeHtml(src) + '" x="0" y="0" width="' + W + '" height="' + imgH
        + '" preserveAspectRatio="xMidYMid slice"/>');
    }
    var y = imgH + pad;
    titleLines.forEach(function (line) {
      y += Math.round(titleSize * 0.82);
      out.push('<text x="' + pad + '" y="' + y + '" font-size="' + titleSize
        + '" font-weight="700" fill="' + escapeHtml(design.titleColor)
        + '" font-family="\'Hiragino Sans\',\'Yu Gothic UI\',sans-serif">'
        + escapeHtml(line) + '</text>');
      y += titleStep - Math.round(titleSize * 0.82);
    });
    if (titleLines.length && bodyLines.length) { y += 14; }
    bodyLines.forEach(function (line) {
      y += Math.round(bodySize * 0.82);
      out.push('<text x="' + pad + '" y="' + y + '" font-size="' + bodySize
        + '" fill="' + escapeHtml(design.bodyColor)
        + '" font-family="\'Hiragino Sans\',\'Yu Gothic UI\',sans-serif">'
        + escapeHtml(line) + '</text>');
      y += bodyStep - Math.round(bodySize * 0.82);
    });
    out.push('</svg>');
    return out.join('');
  }

  function flushMedia(url) {
    if (!url) { return ''; }
    if (/\.(mp4|webm)(\?|$)/i.test(url)) {
      return '<video src="' + escapeHtml(url) + '" muted playsinline loop autoplay'
        + ' style="display:block;width:100%;height:auto;margin:0;"></video>';
    }
    return '<img src="' + escapeHtml(url) + '" alt="" loading="lazy"'
      + ' style="display:block;width:100%;height:auto;margin:0;">';
  }

  function cfPanelHtml(section, index, design, pool, share) {
    var out = [];
    out.push('<section id="sec-' + (index + 1) + '" data-key="' + escapeHtml(section.key) + '">');
    out.push('<div class="wrap">');
    var split = splitDirectives(section);
    out.push(burnedPanel(takeAsset(pool, 'photo'), section.title, split.prose, design, 712));
    /* 動きで見せる区画は GIF と動画を先に置く。実物も画像列の途中に挟んでいた */
    split.directives.forEach(function (one) {
      if (one.kind === 'gif') { out.push(flushMedia(takeAsset(pool, 'gif'))); }
      if (one.kind === 'video') { out.push(flushMedia(takeAsset(pool, 'video'))); }
    });
    for (var i = 1; i < share; i += 1) {
      var got = takeAsset(pool, 'photo');
      if (!got) { break; }
      out.push(flushMedia(got));
    }
    out.push('</div>');
    out.push('</section>');
    return out.join('');
  }

  function sectionHtml(section, index, design, forDownload, pool) {
    var isHero = index === 0;
    var tag = isHero ? 'h1' : 'h2';
    var titleSize = isHero ? Math.round(design.titleSize * 1.6) : design.titleSize;
    var titleColor = section.titleColor || design.titleColor;
    var bodyColor = section.bodyColor || design.bodyColor;
    var bg = section.bg || (isHero ? '#FAF8FB' : design.bgColor);
    var out = [];
    out.push('<section id="sec-' + (index + 1) + '" data-key="' + escapeHtml(section.key)
      + '" data-text="1" style="background:' + escapeHtml(bg) + ';">');
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
    /* Makuake の本文カラムは 712px（配信画像も width=712 で来る）。
       クラファンLPは同じ幅で組み、実際のページと同じ見え方にする */
    out.push('.wrap{max-width:' + (o.type === TYPE.CF ? '712px' : '1080px') + ';margin:0 auto;padding:0 32px;}');
    out.push('.line-cta{padding:32px;text-align:center;background:#F6FBF7;}');
    out.push('@media (max-width:600px){section{padding:40px 0;}.wrap{padding:0 20px;}}');
    if (o.type === TYPE.CF) {
      /* 実物は1枚絵が余白なしで縦に続く。区画の上下パディングと横パディングを
         外さないと、絵と絵のあいだに白い帯が入って「文章のページ」に見える */
      out.push('section{padding:0;}');
      out.push('section .wrap{padding:0;}');
      out.push('section[data-text="1"]{padding:40px 0;}');
      out.push('section[data-text="1"] .wrap{padding:0 24px;}');
      out.push('@media (max-width:600px){section{padding:0;}section .wrap{padding:0;}'
        + 'section[data-text="1"]{padding:32px 0;}section[data-text="1"] .wrap{padding:0 18px;}}');
    }
    if (href) {
      out.push('body{padding-bottom:76px;}');
      out.push('.line-bar{position:fixed;left:0;right:0;bottom:0;z-index:9;padding:10px 16px;'
        + 'background:rgba(255,255,255,.94);border-top:1px solid #E3E8E5;text-align:center;}');
      out.push('.line-bar a{display:flex;max-width:520px;margin:0 auto;min-height:' + style.height + 'px;'
        + 'align-items:center;justify-content:center;border-radius:' + style.radius + 'px;'
        + 'background:#06C755;color:#FFFFFF;font-size:16px;font-weight:600;text-decoration:none;}');
    }
    out.push('</style>');
    out.push('</head>');
    out.push('<body>');

    var spots = href ? lineSpots(sections, position) : [];
    /* 1区画に何枚積むか。1枚で止めていたので、素材が71枚あっても
       13枚しか出ていなかった。かといって全部使うと、参照ページが
       カラー違いを大量に持っているとき同じ絵が並び続ける
       （実測: 71枚使うと高さ54,639px、実物の40,374pxを超えた）。
       実物は画像29枚を前半8区画に置いていたので、1区画あたり3〜4枚。
       ponytail: 上限4枚は実測から置いた固定値。参照ページごとに
       素材の重複度が違うので、効かなくなったら重複判定を足す。 */
    var panelCount = (o.type === TYPE.CF)
      ? sections.filter(function (s) { return !isCfTextSection(s); }).length : 0;
    var share = panelCount
      ? Math.min(4, Math.max(1, Math.ceil(((o.assets && o.assets.photo) || []).length / panelCount)))
      : 1;
    sections.forEach(function (section, index) {
      if (o.type === TYPE.CF && !isCfTextSection(section) && section.type !== 'divider') {
        out.push(cfPanelHtml(section, index, design, o.assets, share));
      } else {
        out.push(sectionHtml(section, index, design, !!o.forDownload, o.assets));
      }
      if (spots.indexOf(index) !== -1) { out.push(lineButtonMarkup(style, href)); }
    });
    if (href) { out.push(lineBarMarkup(style, href)); }

    out.push('</body>');
    out.push('</html>');
    return out.join('\n');
  }

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
  window.LpRender = {
    TYPE: TYPE,
    buildHtml: buildHtml,
    assetPoolOf: assetPoolOf,
    designOf: designOf,
    normalizeSections: normalizeSections,
    lineSpots: lineSpots,
    lineHref: lineHref,
    lineStyleOf: lineStyleOf,
    burnedPanel: burnedPanel,
    escapeHtml: escapeHtml,
    wrapLines: wrapLines
  };
}());
