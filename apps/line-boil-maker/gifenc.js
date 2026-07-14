/*
 * gifenc.js - 依存ゼロの最小GIF89aエンコーダー(アニメーション・透過対応)
 * ブラウザ(window.GifEnc)とNode(module.exports)の両方で使える。
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.GifEnc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // LZW圧縮して255バイトごとのサブブロックとしてoutに書き込む
  function lzwEncode(minCodeSize, pixels, out) {
    out.push(minCodeSize);
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let maxCode = (1 << codeSize) - 1;
    let nextCode = eoiCode + 1;
    let dict = new Map();

    const bytes = [];
    let cur = 0, curBits = 0;
    const emit = (code) => {
      cur |= code << curBits;
      curBits += codeSize;
      while (curBits >= 8) {
        bytes.push(cur & 255);
        cur >>>= 8;
        curBits -= 8;
      }
    };
    // 放出直後にコード幅を見直す(ppmtogif系実装と同じ順序)
    const grow = () => {
      if (nextCode > maxCode && codeSize < 12) {
        codeSize++;
        maxCode = (1 << codeSize) - 1;
      }
    };

    emit(clearCode);
    let prev = pixels[0];
    for (let i = 1; i < pixels.length; i++) {
      const k = pixels[i];
      const key = (prev << 8) | k;
      const found = dict.get(key);
      if (found !== undefined) {
        prev = found;
        continue;
      }
      emit(prev);
      grow();
      if (nextCode < 4096) {
        dict.set(key, nextCode++);
      } else {
        emit(clearCode);
        dict = new Map();
        nextCode = eoiCode + 1;
        codeSize = minCodeSize + 1;
        maxCode = (1 << codeSize) - 1;
      }
      prev = k;
    }
    emit(prev);
    grow();
    emit(eoiCode);
    if (curBits > 0) bytes.push(cur & 255);

    for (let i = 0; i < bytes.length; i += 255) {
      const n = Math.min(255, bytes.length - i);
      out.push(n);
      for (let j = 0; j < n; j++) out.push(bytes[i + j]);
    }
    out.push(0); // block terminator
  }

  /**
   * アニメーションGIFを組み立てる。
   * @param frames    フレームごとのパレットインデックス配列(Uint8Array, 長さ width*height)
   * @param width     画像幅
   * @param height    画像高さ
   * @param palette   [[r,g,b], ...] 最大256色。不足分は黒で埋める
   * @param delayCs   1フレームの表示時間(1/100秒単位)
   * @param transIndex 透過色のインデックス。透過なしなら -1
   * @returns Uint8Array (GIFファイル全体)
   */
  function encode(frames, width, height, palette, delayCs, transIndex) {
    const out = [];
    const w8 = (v) => out.push(v & 255);
    const w16 = (v) => { out.push(v & 255, (v >> 8) & 255); };
    const str = (s) => { for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); };

    str("GIF89a");
    w16(width);
    w16(height);
    w8(0xf7); // グローバルカラーテーブルあり / 256色
    w8(transIndex >= 0 ? transIndex : 0); // 背景色インデックス
    w8(0);    // アスペクト比
    for (let i = 0; i < 256; i++) {
      const p = palette[i];
      if (p) out.push(p[0] & 255, p[1] & 255, p[2] & 255);
      else out.push(0, 0, 0);
    }

    // 無限ループ (NETSCAPE2.0)
    out.push(0x21, 0xff, 11);
    str("NETSCAPE2.0");
    out.push(3, 1);
    w16(0);
    w8(0);

    for (const frame of frames) {
      // Graphic Control Extension
      out.push(0x21, 0xf9, 4);
      // 透過ありなら disposal=2(背景に戻す)+透過フラグ、なしは disposal=1
      w8(transIndex >= 0 ? (2 << 2) | 1 : (1 << 2));
      w16(delayCs);
      w8(transIndex >= 0 ? transIndex : 0);
      w8(0);
      // Image Descriptor(ローカルパレットなし)
      out.push(0x2c);
      w16(0); w16(0);
      w16(width); w16(height);
      w8(0);
      lzwEncode(8, frame, out);
    }

    out.push(0x3b); // trailer
    return Uint8Array.from(out);
  }

  return { encode };
});
