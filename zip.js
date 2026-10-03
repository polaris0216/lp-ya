/* =============================================================================
 * zip.js — まとめて落とすための ZIP を、ブラウザの中だけで作る
 *
 * なぜ自前か:
 *   PNG も JPEG も MP4 も、すでに圧縮済み。もう一度縮めても1〜2%しか減らず、
 *   そのために外の部品を足すと、読み込みが増えて壊れる所も増える。
 *   だから「縮めずに束ねるだけ（store）」の、いちばん小さな ZIP を書く。
 *
 * 作りは ZIP の仕様のうち必要な3つだけ:
 *   ローカルヘッダ（各ファイルの前）／中央ディレクトリ（末尾の目次）／
 *   その終わり（EOCD）。暗号化も分割も使わない。
 *
 *   Zip.make([{ name: 'A/LP/01.png', data: Uint8Array|ArrayBuffer|string }])
 *     → Blob（application/zip）
 *
 * 名前は UTF-8。言語エンコーディングフラグ（ビット11）を立てるので、
 * 日本語のフォルダ名も macOS・Windows の標準の展開で文字化けしない。
 * ============================================================================= */
(function (global) {
  'use strict';

  /* CRC-32。表は初回に1度だけ作る */
  var TABLE = null;
  function table() {
    if (TABLE) { return TABLE; }
    TABLE = new Uint32Array(256);
    for (var n = 0; n < 256; n += 1) {
      var c = n;
      for (var k = 0; k < 8; k += 1) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      TABLE[n] = c >>> 0;
    }
    return TABLE;
  }

  function crc32(bytes) {
    var t = table();
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i += 1) {
      c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function bytesOf(data) {
    if (data instanceof Uint8Array) { return data; }
    if (data instanceof ArrayBuffer) { return new Uint8Array(data); }
    return new TextEncoder().encode(String(data === undefined || data === null ? '' : data));
  }

  /* ZIP の日時は MS-DOS 形式（2秒きざみ・1980年から） */
  function dosTime(d) {
    var date = d || new Date();
    var year = Math.max(1980, date.getFullYear());
    return {
      time: ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((date.getSeconds() / 2) & 31),
      date: (((year - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31)
    };
  }

  function put32(view, at, value) { view.setUint32(at, value >>> 0, true); }
  function put16(view, at, value) { view.setUint16(at, value & 0xFFFF, true); }

  /* 同じ名前が2つ入ると、展開する側で片方が消える。後ろに (2) を足して避ける */
  function uniqueName(used, raw) {
    var name = String(raw || 'file')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/{2,}/g, '/');
    if (!used[name]) { used[name] = 1; return name; }
    var dot = name.lastIndexOf('.');
    var stem = dot > 0 ? name.slice(0, dot) : name;
    var ext = dot > 0 ? name.slice(dot) : '';
    var n = 2;
    while (used[stem + '(' + n + ')' + ext]) { n += 1; }
    var made = stem + '(' + n + ')' + ext;
    used[made] = 1;
    return made;
  }

  function make(files, when) {
    var list = (files || []).filter(Boolean);
    var stamp = dosTime(when);
    var used = {};
    var parts = [];
    var central = [];
    var offset = 0;

    list.forEach(function (one) {
      var name = new TextEncoder().encode(uniqueName(used, one.name));
      var body = bytesOf(one.data);
      var sum = crc32(body);

      var head = new ArrayBuffer(30);
      var hv = new DataView(head);
      put32(hv, 0, 0x04034B50);     /* ローカルヘッダの印 */
      put16(hv, 4, 20);             /* 要るバージョン 2.0 */
      put16(hv, 6, 0x0800);         /* 名前は UTF-8（ビット11） */
      put16(hv, 8, 0);              /* 縮めない（store） */
      put16(hv, 10, stamp.time);
      put16(hv, 12, stamp.date);
      put32(hv, 14, sum);
      put32(hv, 18, body.length);
      put32(hv, 22, body.length);
      put16(hv, 26, name.length);
      put16(hv, 28, 0);
      parts.push(new Uint8Array(head), name, body);

      var dir = new ArrayBuffer(46);
      var dv = new DataView(dir);
      put32(dv, 0, 0x02014B50);     /* 目次の印 */
      put16(dv, 4, 20);             /* 作った側のバージョン */
      put16(dv, 6, 20);
      put16(dv, 8, 0x0800);
      put16(dv, 10, 0);
      put16(dv, 12, stamp.time);
      put16(dv, 14, stamp.date);
      put32(dv, 16, sum);
      put32(dv, 20, body.length);
      put32(dv, 24, body.length);
      put16(dv, 28, name.length);
      put16(dv, 30, 0);
      put16(dv, 32, 0);
      put16(dv, 34, 0);
      put16(dv, 36, 0);
      put32(dv, 38, 0);
      put32(dv, 42, offset);        /* そのファイルの頭の位置 */
      central.push(new Uint8Array(dir), name);

      offset += 30 + name.length + body.length;
    });

    var dirSize = central.reduce(function (n, x) { return n + x.length; }, 0);
    var end = new ArrayBuffer(22);
    var ev = new DataView(end);
    put32(ev, 0, 0x06054B50);       /* 終わりの印 */
    put16(ev, 4, 0);
    put16(ev, 6, 0);
    put16(ev, 8, list.length);
    put16(ev, 10, list.length);
    put32(ev, 12, dirSize);
    put32(ev, 16, offset);
    put16(ev, 20, 0);

    return new Blob(parts.concat(central, [new Uint8Array(end)]), { type: 'application/zip' });
  }

  global.Zip = { make: make, crc32: crc32 };
}(typeof window !== 'undefined' ? window : globalThis));
