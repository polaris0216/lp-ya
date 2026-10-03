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

  /* 絵に訴求を焼き込む1枚。
     参照した日本のLP（silverantoutdoors.jp / makuake）は、見出しを本文として
     置かず、写真の上に明朝の白文字で重ねている。文字を絵の下に置くと
     「写真＋見出し＋段落」の繰り返しになり、ブログの見た目になる（実測: 前の版）。

     写真の明るさは選べない（生成した絵は明るいものも暗いものもある）ので、
     下から黒い幕を重ねて、どの写真でも白文字が読めるようにする。
     長い本文は絵の上に載せきれないので、載せるのは最初の数行だけにして、
     残りは呼ぶ側が小さな添え書きとして下に出す（makuake の作り）。 */
  var PANEL_BODY_LINES = 3;

  function burnedPanel(src, title, body, design, width, options) {
    var o = options || {};
    var W = width;
    var pad = Math.round(W * 0.075);
    var titleSize = Math.round(W * 0.062);      /* 712px で 44px */
    var bodySize = Math.round(W * 0.023);       /* 712px で 16px */
    var titleLines = title ? wrapLines(title, (W - pad * 2) / (titleSize * 0.56)) : [];
    var bodyLines = body ? wrapLines(body, (W - pad * 2) / (bodySize * 0.62)).slice(0, PANEL_BODY_LINES) : [];
    var titleStep = Math.round(titleSize * 1.5);
    var bodyStep = Math.round(bodySize * 1.9);

    /* 縦は絵の比率に合わせる。4:5 の絵は縦長のまま出す（切ると商品が欠ける） */
    var H = Math.round(W * (o.ratio || 1.25));
    var textH = titleLines.length * titleStep + (titleLines.length && bodyLines.length ? Math.round(bodySize * 1.2) : 0)
      + bodyLines.length * bodyStep;
    var uid = 'g' + Math.abs(hashOf(String(src) + title)).toString(36);
    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H
      + '" viewBox="0 0 ' + W + ' ' + H + '" style="display:block;width:100%;height:auto;">');
    out.push('<defs><linearGradient id="' + uid + '" x1="0" y1="1" x2="0" y2="0">'
      + '<stop offset="0" stop-color="#000" stop-opacity="0.72"/>'
      + '<stop offset="0.45" stop-color="#000" stop-opacity="0.34"/>'
      + '<stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>');
    out.push('<rect width="' + W + '" height="' + H + '" fill="#111"/>');
    if (src) {
      out.push('<image href="' + escapeHtml(src) + '" x="0" y="0" width="' + W + '" height="' + H
        + '" preserveAspectRatio="xMidYMid slice"/>');
    }
    if (textH) {
      /* 幕は文字の高さぶん＋ゆとり。絵の下半分までは覆わない */
      var veil = Math.min(H, textH + pad * 2.2);
      out.push('<rect x="0" y="' + (H - veil) + '" width="' + W + '" height="' + veil
        + '" fill="url(#' + uid + ')"/>');
    }

    var y = H - pad - (bodyLines.length ? bodyLines.length * bodyStep : 0);
    if (titleLines.length && bodyLines.length) { y -= Math.round(bodySize * 1.2); }
    y -= titleLines.length * titleStep;

    titleLines.forEach(function (line) {
      y += Math.round(titleSize * 0.86);
      out.push('<text x="' + pad + '" y="' + y + '" font-size="' + titleSize
        + '" font-weight="500" fill="#FFFFFF" letter-spacing="0.04em"'
        + ' font-family="\'Hiragino Mincho ProN\',\'Yu Mincho\',\'Noto Serif JP\',serif">'
        + escapeHtml(line) + '</text>');
      y += titleStep - Math.round(titleSize * 0.86);
    });
    if (titleLines.length && bodyLines.length) { y += Math.round(bodySize * 1.2); }
    bodyLines.forEach(function (line) {
      y += Math.round(bodySize * 0.86);
      out.push('<text x="' + pad + '" y="' + y + '" font-size="' + bodySize
        + '" fill="#FFFFFF" fill-opacity="0.88" letter-spacing="0.02em"'
        + ' font-family="\'Hiragino Sans\',\'Yu Gothic UI\',sans-serif">'
        + escapeHtml(line) + '</text>');
      y += bodyStep - Math.round(bodySize * 0.86);
    });
    out.push('</svg>');
    return out.join('');
  }

  /* 同じ絵と見出しなら同じ番号。SVG の中で幕に付ける名前に使う。
     ページに何枚も並ぶので、名前が重なると幕が効かなくなる */
  function hashOf(text) {
    var h = 0;
    for (var i = 0; i < text.length; i += 1) { h = (h * 31 + text.charCodeAt(i)) | 0; }
    return h;
  }

  /* 絵に載せきれなかった本文を、下に小さく添える（makuake の一行キャプション）。
     載せた行数ぶんは飛ばす */
  function panelRest(body, width) {
    var bodySize = Math.round(width * 0.023);
    var lines = wrapLines(String(body || ''), (width - Math.round(width * 0.075) * 2) / (bodySize * 0.62));
    var rest = lines.slice(PANEL_BODY_LINES).join('').trim();
    if (!rest) { return ''; }
    return '<p class="cap">' + escapeHtml(rest) + '</p>';
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

  /* ---- ブランド指定を描画の設計値に写す ----
     画面（S13 / S12）と書き出し（tools/lp-export.mjs）で同じ値を使う。
     3か所に写していると、片方だけ色が変わる */
  function brightness(hex) {
    var m = String(hex || '').match(/^#?([0-9a-f]{6})$/i);
    if (!m) { return 0.5; }
    var n = parseInt(m[1], 16);
    return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
  }
  function readableOn(color, bg, min) {
    return Math.abs(brightness(color) - brightness(bg)) >= (min === undefined ? 0.35 : min);
  }

  /* 商品入力のブランド指定を、描画の設計値に写す。
     ブランドカラーは「使う色」であって「文字の色」ではない。
     実測: 1色目が #FFFFFF のプロジェクトで、それを見出しの色にしたため
     白背景に白文字になり、焼き込んだ見出しが1つも読めなかった。
     背景の上で読める色だけを文字に使う。差し色は薄くても成り立つので
     基準を分ける（tools/lp-export.mjs と同じ決まり） */
  function designFromProject(project) {
    var d = {
      titleFont: 'gothic', bodyFont: 'gothic', titleSize: 30, bodySize: 16,
      titleColor: '#171018', bodyColor: '#3A323E', bgColor: '#FFFFFF', accentColor: '#C13584'
    };
    var colors = (Array.isArray(project && project.brand_colors) ? project.brand_colors : [])
      .map(String).filter(function (c) { return /^#?[0-9a-f]{6}$/i.test(c); });
    var forText = colors.filter(function (c) { return readableOn(c, d.bgColor); });
    if (forText[0]) { d.titleColor = forText[0]; }
    var forAccent = colors.filter(function (c) {
      return readableOn(c, d.bgColor, 0.15) && c !== d.titleColor;
    });
    if (forAccent[0]) { d.accentColor = forAccent[0]; }
    else if (forText[0]) { d.accentColor = forText[0]; }
    var fonts = project && project.brand_fonts && typeof project.brand_fonts === 'object' ? project.brand_fonts : {};
    if (fonts.title === 'mincho') { d.titleFont = 'mincho'; }
    if (fonts.body === 'mincho') { d.bodyFont = 'mincho'; }
    return d;
  }
  function buildHtml(options) {
    var o = options || {};
    var sections = o.sections || [];
    var design = o.design || DEFAULT_DESIGN;
    /* LINE友だち追加は、自社LPだけのものではない。
       クラウドファンディングのページでも、見た人を友だちに繋ぐのが狙いなので、
       LINEのURLが入っていれば種類を問わず出す
       （2026-10-04 要望: 公開ページに友だち追加ボタンを置きたい）。
       URLが無ければ、これまでどおり出さない */
    var href = lineHref(o.lineUrl);
    var style = o.lineStyle || { variant: 'green', label: t('gen.lineButtonLabel'), height: 48, radius: 12 };
    var position = String(o.linePosition || '');
    var out = [];

    out.push('<!DOCTYPE html>');
    out.push('<html lang="' + langCode(o) + '">');
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

  /* ---------- LP案（S12 が作るもの）から組む ----------
     旧生成物と違い、区画ごとに使う素材が番号で決まっている（assets: ["p1","v2"]）。
     素材プールから順に取るのではなく、指されたものをその区画に置く。
     組み方の決まりは上と同じ（測って決めた Makuake の形）:
       ・本文カラム712px、絵は端まで、余白なし
       ・訴求は写真に焼き込んだ1枚絵（burnedPanel）。見出しと本文を絵に載せる
       ・地の文にするのは、日本向けに足した区画（実行者・スケジュール・リスク）と
         申し込み区画。参照ページで文章だった区画も地の文
     区画の見せ方（mode）は draft 側が決めていなければここで判定する:
       素材があり、日本向け追加でなく、CTAでもない → 焼き込みパネル
       それ以外 → 地の文 */
  /* ---------- LP案の見た目（1か所にまとめる） ----------
     1枚のHTMLにも、style.css に切り出すのにも、同じものを使う。
     片方だけ直すと見た目がずれるので、必ずここから取る */
  function draftCss(design) {
    var d = design || DEFAULT_DESIGN;
    return [
      '*{box-sizing:border-box;}',
      'body{margin:0;background:' + escapeHtml(d.bgColor) + ';font-family:' + fontStack(d.bodyFont)
        + ';-webkit-text-size-adjust:100%;overflow-wrap:break-word;line-break:strict;}',
      /* 参照ページの実物に合わせた本文幅。ここを変えると絵の見え方が変わる */
      '.wrap{max-width:712px;margin:0 auto;padding:0;}',
      'section{padding:0;}',
      'section[data-text="1"]{padding:40px 0;}',
      'section[data-text="1"] .wrap{padding:0 24px;}',
      '.lead{font-size:' + d.bodySize + 'px;line-height:1.9;color:' + escapeHtml(d.bodyColor)
        + ';margin:0;white-space:pre-wrap;}',
      'h2{font-family:' + fontStack(d.titleFont) + ';font-size:' + d.titleSize
        + 'px;line-height:1.35;font-weight:600;color:' + escapeHtml(d.titleColor) + ';margin:0 0 16px;}',
      '.sub{font-size:' + Math.round(d.bodySize * 1.05) + 'px;color:' + escapeHtml(d.bodyColor)
        + ';margin:-8px 0 16px;opacity:.85;}',
      'ul.bul{margin:12px 0 0;padding-left:1.3em;line-height:1.9;font-size:' + d.bodySize
        + 'px;color:' + escapeHtml(d.bodyColor) + ';}',
      '.cta{margin-top:24px;}',
      '.cta a{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 36px;'
        + 'border-radius:12px;background:' + escapeHtml(d.accentColor)
        + ';color:#fff;font-size:17px;font-weight:700;text-decoration:none;}',
      /* 絵に載せきれなかった本文の添え書き。makuake の一行キャプションと同じ役目。
         絵と絵の間に置くので、上下の余白は詰める（間が空くと並びが切れて見える） */
      '.cap{margin:0;padding:14px 24px 22px;font-size:' + Math.round(d.bodySize * 0.94)
        + 'px;line-height:1.85;color:' + escapeHtml(d.bodyColor) + ';}',
      '.cap:empty{display:none;}',
      '.visual{margin:20px 0 0;padding:14px 16px;border:1px dashed #D9CFE0;border-radius:10px;'
        + 'color:#6B6270;font-size:13px;background:#FBF9FC;}',
      /* 絵が主体のページなので、画像は読み込みを待たせない */
      'img,video{display:block;width:100%;height:auto;margin:0;}',
      '@media (max-width:600px){section[data-text="1"]{padding:32px 0;}'
        + 'section[data-text="1"] .wrap{padding:0 18px;}}',
    ].join('\n');
  }

  /* 画面に入ったら絵を出す。縦に長いページなので、全部を最初に読むと重い。
     JS が動かない環境でも絵は出る（src は最初から入れてある） */
  function draftJs() {
    return [
      '(function () {',
      "  var lazy = document.querySelectorAll('img[loading=\"lazy\"]');",
      '  if (!window.IntersectionObserver || !lazy.length) { return; }',
      '  var io = new IntersectionObserver(function (rows) {',
      '    rows.forEach(function (row) {',
      '      if (!row.isIntersecting) { return; }',
      "      row.target.setAttribute('data-seen', '1');",
      '      io.unobserve(row.target);',
      '    });',
      '  }, { rootMargin: \'600px\' });',
      '  lazy.forEach(function (n) { io.observe(n); });',
      '}());',
    ].join('\n');
  }

  /* ---------- LP案の本文（区画を縦に積む） ----------
     生成した素材があれば、絵の指示の代わりにそれを置く。
     assets は { '3-2': 'https://…' } の形（区画-何点目 → URL）。
     asAsset を渡すと、URLをファイル名などに差し替えられる（分割書き出し用）。 */
  function draftBody(options) {
    var o = options || {};
    var draft = o.draft || {};
    var sections = asArray(draft.sections);
    var project = o.project || {};
    var design = o.design || DEFAULT_DESIGN;
    var made = o.assets || {};
    /* 焼き込まれた文字が外国語だった写真の区画。作り直しが済むまで、
       元の写真は使わない（韓国語のまま日本のLPに出さないため） */
    var redo = {};
    asArray(o.redoSlots).forEach(function (slot) { redo[String(slot)] = 1; });
    /* 訴求が絵そのものに焼かれている区画。ここに文字を重ねると二重になる */
    var burnedSlots = {};
    asArray(o.burnedSlots).forEach(function (slot) { burnedSlots[String(slot)] = 1; });
    var asAsset = typeof o.asAsset === 'function' ? o.asAsset : function (url) { return url; };
    var images = asArray(project.image_urls);
    var videos = asArray(project.video_urls);
    var urlOf = function (ref) {
      var text = String(ref || '').trim();
      if (text.indexOf('http') === 0) { return text; }
      var m = text.match(/^([pv])(\d+)$/);
      if (!m) { return ''; }
      var list = m[1] === 'p' ? images : videos;
      return String(list[Number(m[2]) - 1] || '');
    };
    var out = [];

    sections.forEach(function (sec, index) {
      /* この区画で出す絵。生成したものが先、無ければ手持ち、
         どちらも無ければ指示を仮置きで見せる */
      var visuals = asArray(sec.visuals);
      if (!visuals.length && sec.visual) { visuals = [{ kind: 'image', prompt: sec.visual }]; }
      var shots = [];
      visuals.forEach(function (v, vi) {
        var slot = (index + 1) + '-' + (vi + 1);
        var url = made[slot] || (redo[slot] ? '' : urlOf(v.asset));
        /* 区画番号は必ず持ち回す。あとで並び順から作り直すと、
           動画が混ざった区画でずれる（実測: 1枚目が動画の区画で、
           2枚目の絵に 1-1 の札が付き、焼き込み済みなのに文字を重ねた） */
        if (url) { shots.push({ slot: slot, kind: String(v.kind || 'image'), url: asAsset(url, slot), use: String(v.use || '') }); }
        else { shots.push({ slot: slot, kind: String(v.kind || 'image'), url: '', use: String(v.use || ''), brief: String(v.prompt || '') }); }
      });
      /* 手持ちの素材を直に指しているぶん（assets 欄）も足す */
      asArray(sec.assets).forEach(function (ref, ai) {
        var url = urlOf(ref);
        if (url) { shots.push({ kind: /^v/.test(String(ref)) ? 'video' : 'image', url: asAsset(url, 'a' + (index + 1) + '-' + (ai + 1)), use: '' }); }
      });

      var stills = shots.filter(function (x) { return x.url && x.kind !== 'video'; });
      var movies = shots.filter(function (x) { return x.url && x.kind === 'video'; });
      var briefs = shots.filter(function (x) { return !x.url && x.brief; });
      var mode = String(sec.mode || '');
      /* 絵があるなら焼き込む。文字だけの区画にするのは、絵が1枚も無いときか
         申し込みの区画だけ。参照した日本のLPは、見出しを本文として置かず
         ぜんぶ絵に焼いている（silverantoutdoors.jp は HTML の文字が905字しかない） */
      if (!mode) { mode = stills.length ? 'panel' : 'text'; }
      var bullets = asArray(sec.bullets).map(String).filter(Boolean);
      var bodyText = String(sec.body || '');

      out.push('<section id="sec-' + (index + 1) + '" data-key="' + escapeHtml(sec.key || '') + '"'
        + (mode === 'text' ? ' data-text="1"' : '') + '><div class="wrap">');
      if (mode === 'panel') {
        /* 訴求は絵そのものに焼かれている（asset-orders が画像生成に焼かせる）。
           ここで SVG の文字を重ねると、絵の中の文字と二重になる。
           だから絵はそのまま並べるだけ。文章は絵に載りきらないぶんだけ
           小さく添える（makuake の一行キャプションと同じ役目）。

           焼かれていない絵（burnedSlots に無い区画）は、まだ作り直していない
           古い絵なので、そのときだけ SVG で重ねて読めるようにしておく */
        var burnBody = bodyText || bullets.join('\n');
        if (burnedSlots[stills[0].slot]) {
          out.push(flushMedia(stills[0].url));
        } else {
          out.push(burnedPanel(stills[0].url, String(sec.headline || sec.title || ''), burnBody, design, 712));
        }
        out.push(panelRest(burnBody, 712));
        movies.forEach(function (m) { out.push(flushMedia(m.url)); });
        /* 2枚目以降は実機の写真をそのまま並べる（makuake の実物と同じ）。
           箇条書きは写真に焼かず、写真の下に短い地の文として置く。
           前は2枚目からも箇条書きを焼いていたが、実機写真に字を重ねると
           「写真＋字幕」に見え、写真の中身（寸法・操作部）も隠れた */
        stills.slice(1).forEach(function (m) { out.push(flushMedia(m.url)); });
        /* 本文があって箇条書きもある区画は、箇条書きを写真の下に地の文で置く。
           本文が無い区画は、箇条書きが1枚目に焼かれているので重ねて出さない */
        if (bullets.length && bodyText) {
          out.push('<ul class="bul cap">' + bullets.map(function (b) { return '<li>' + escapeHtml(b) + '</li>'; }).join('') + '</ul>');
        }
        if (sec.cta) {
          out.push('<div class="cta"><a href="' + escapeHtml(o.ctaHref || '#') + '">'
            + escapeHtml(sec.cta_label || t('gen.ctaButton')) + '</a></div>');
        }
      } else {
        if (sec.headline || sec.title) { out.push('<h2>' + escapeHtml(sec.headline || sec.title) + '</h2>'); }
        if (sec.subhead) { out.push('<p class="sub">' + escapeHtml(sec.subhead) + '</p>'); }
        if (bodyText) { out.push('<p class="lead">' + escapeHtml(bodyText) + '</p>'); }
        if (bullets.length) {
          out.push('<ul class="bul">' + bullets.map(function (b) { return '<li>' + escapeHtml(b) + '</li>'; }).join('') + '</ul>');
        }
        movies.forEach(function (m) { out.push(mediaMarkup(m.url, m.use)); });
        stills.forEach(function (m) { out.push(mediaMarkup(m.url, m.use || sec.headline || '')); });
        if (sec.cta) {
          out.push('<div class="cta"><a href="' + escapeHtml(o.ctaHref || '#') + '">'
            + escapeHtml(sec.cta_label || t('gen.ctaButton')) + '</a></div>');
        }
      }
      /* まだ作っていない絵は、指示を残しておく。何が足りないかが分かる */
      briefs.forEach(function (b) {
        out.push('<div class="visual">' + escapeHtml(t('gen.imagePlaceholder')) + ' '
          + escapeHtml(b.use ? b.use + ' — ' + b.brief : b.brief) + '</div>');
      });
      out.push('</div></section>');
    });
    return out.join('\n');
  }

  /* 1枚のHTML。CSSもJSも中に入れる（そのまま公開できる形） */
  /* 出す言語。projects.output_lang（ja / en / ko）。
     読み上げや検索エンジンが言語を取り違えないよう、必ず lang 属性に出す */
  function langCode(o) {
    var v = String((o && o.project && o.project.output_lang) || (o && o.lang) || 'ja').toLowerCase();
    return (v === 'en' || v === 'ko') ? v : 'ja';
  }

  function buildDraftHtml(options) {
    var o = options || {};
    var design = o.design || DEFAULT_DESIGN;
    var title = o.title || (o.draft && o.draft.summary) || '';
    return [
      '<!DOCTYPE html><html lang="' + langCode(o) + '"><head><meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>' + escapeHtml(title) + '</title>',
      '<style>' + draftCss(design) + '</style>',
      '</head><body>',
      draftBody(o),
      '<script>' + draftJs() + '<\/script>',
      '</body></html>',
    ].join('\n');
  }

  /* ファイルを分ける形。{ 'index.html': …, 'style.css': …, 'script.js': … } を返す。
     assets の差し替えは asAsset に任せる（呼ぶ側が images/001.png などに直す） */
  function buildDraftFiles(options) {
    var o = options || {};
    var design = o.design || DEFAULT_DESIGN;
    var title = o.title || (o.draft && o.draft.summary) || '';
    var html = [
      '<!DOCTYPE html>',
      '<html lang="' + langCode(o) + '">',
      '<head>',
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>' + escapeHtml(title) + '</title>',
      '<link rel="stylesheet" href="style.css">',
      '</head>',
      '<body>',
      draftBody(o),
      '<script src="script.js"><\/script>',
      '</body>',
      '</html>',
    ].join('\n');
    return { 'index.html': html, 'style.css': draftCss(design), 'script.js': draftJs() };
  }

  /* 文字幅で折る。maxChars は「半角なら何文字入るか」。全角は半角2つぶん、
     半角は1つぶんとして数える。以前は文字数だけで折っていたので、
     日本語の見出しが右端で切れていた（実測: 712px幅で32pxの見出し
     「GOOD DESIGN AWARD受賞の、香るオブジェ」の末尾2文字が消えた） */
  function charUnits(ch) {
    var code = ch.charCodeAt(0);
    /* 半角英数・記号・半角カナ。それ以外（漢字かな・全角記号・絵文字）は全角扱い */
    if (code < 0x2E80 || (code >= 0xFF61 && code <= 0xFF9F)) { return 1; }
    return 2;
  }
  function wrapLines(text, maxChars) {
    var limit = Math.max(8, Math.floor(maxChars) || 8);
    var out = [];
    String(text === undefined || text === null ? '' : text).split('\n').forEach(function (paragraph) {
      if (!paragraph) { out.push(''); return; }
      var line = '';
      var units = 0;
      for (var i = 0; i < paragraph.length; i += 1) {
        var ch = paragraph[i];
        var w = charUnits(ch);
        /* 行頭に来てはいけない字（句読点・閉じ括弧・長音）は前の行に付ける。
           1文字はみ出すぶんは、右の余白（pad=36px）で吸収できる */
        var noHead = /[、。，．・）」』】〕〉》］｝!?！？ー〜…]/.test(ch);
        /* 数字の直後の単位（130日・25dB・40坪）は前の行に付ける。
           数字で終わっているのに次が全角1〜2字なら、そこは切らない */
        var afterNumber = /[0-9０-９]$/.test(line) && /[日坪本枚個台人円%％]/.test(ch);
        if (units + w > limit && line && !noHead && !afterNumber) {
          out.push(line);
          line = '';
          units = 0;
        }
        line += ch;
        units += w;
      }
      out.push(line);
    });
    return out;
  }
  window.LpRender = {
    TYPE: TYPE,
    buildDraftHtml: buildDraftHtml,
    buildDraftFiles: buildDraftFiles,
    draftCss: draftCss,
    draftBody: draftBody,
    buildHtml: buildHtml,
    assetPoolOf: assetPoolOf,
    designOf: designOf,
    designFromProject: designFromProject,
    normalizeSections: normalizeSections,
    lineSpots: lineSpots,
    lineHref: lineHref,
    lineStyleOf: lineStyleOf,
    burnedPanel: burnedPanel,
    escapeHtml: escapeHtml,
    wrapLines: wrapLines
  };
}());
