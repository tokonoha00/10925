/*
 * ExportKit - フレーム(canvas配列)を GIF / MP4 / WebM / 連番PNG に書き出す共通モジュール
 * 前提スクリプト: gifenc.js(GifEnc), lib/gifenc-lib.js(GifencLib),
 *                lib/mp4-muxer.js(Mp4Muxer), lib/jszip.min.js(JSZip)
 * 前提DOM: #status, #result, #resultImg, #resultVideo, #resultInfo
 * bg は null(透過)または [r,g,b]
 */
const ExportKit = (() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const setStatus = (m) => { $("status").textContent = m; };
  let lastUrl = null;

  function showResult(blob, ext, detail) {
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl = URL.createObjectURL(blob);
    const name = `material_${Date.now()}.${ext}`;
    const img = $("resultImg");
    const vid = $("resultVideo");
    img.style.display = "none";
    vid.style.display = "none";
    if (ext === "gif") { img.src = lastUrl; img.style.display = ""; }
    else if (ext === "mp4" || ext === "webm") { vid.src = lastUrl; vid.style.display = ""; }
    $("resultInfo").innerHTML =
      `<b>${name}</b>(${(blob.size / 1024).toFixed(1)} KB)<br>${detail}<br>` +
      `<a href="${lastUrl}" download="${name}">保存されない場合はここをクリック</a>`;
    $("result").classList.add("show");
    const a = document.createElement("a");
    a.href = lastUrl;
    a.download = name;
    a.click();
  }

  const toImageData = (canvases) =>
    canvases.map((cv) => cv.getContext("2d").getImageData(0, 0, cv.width, cv.height));

  // ---- GIF ----
  // gifenc(OSS)による適応パレット。透過は index 0 に予約
  function quantizeAdaptive(frames, transparent, bg) {
    const { quantize, applyPalette } = GifencLib;
    if (transparent) {
      const cap = 400000;
      const buf = new Uint8Array(cap * 4);
      let count = 0;
      outer:
      for (const fr of frames) {
        const d = fr.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 128) continue;
          const o = count * 4;
          buf[o] = d[i]; buf[o + 1] = d[i + 1]; buf[o + 2] = d[i + 2]; buf[o + 3] = 255;
          if (++count >= cap) break outer;
        }
      }
      if (count === 0) {
        return {
          indexed: frames.map((fr) => new Uint8Array(fr.width * fr.height)),
          palette: [[255, 0, 255]],
          transIndex: 0,
        };
      }
      const pal = quantize(buf.slice(0, count * 4), 255, { format: "rgb565" });
      const indexed = frames.map((fr) => {
        const idx = applyPalette(fr.data, pal, "rgb565");
        const d = fr.data;
        const out = new Uint8Array(idx.length);
        for (let p = 0, i = 3; p < idx.length; p++, i += 4) {
          out[p] = d[i] < 128 ? 0 : idx[p] + 1;
        }
        return out;
      });
      return { indexed, palette: [[255, 0, 255], ...pal], transIndex: 0 };
    }
    const comped = frames.map((fr) => {
      const d = fr.data;
      const o = new Uint8ClampedArray(d.length);
      for (let i = 0; i < d.length; i += 4) {
        const na = d[i + 3] / 255;
        o[i]     = d[i] * na + bg[0] * (1 - na);
        o[i + 1] = d[i + 1] * na + bg[1] * (1 - na);
        o[i + 2] = d[i + 2] * na + bg[2] * (1 - na);
        o[i + 3] = 255;
      }
      return o;
    });
    const pal = quantize(comped[0], 256, { format: "rgb565" });
    return {
      indexed: comped.map((c) => applyPalette(c, pal, "rgb565")),
      palette: pal,
      transIndex: -1,
    };
  }

  // フォールバック固定パレット: 0=透過, 1..216=6×6×6, 217..246=グレー30階調
  function buildFixedPalette() {
    const pal = [[255, 0, 255]];
    for (let r = 0; r < 6; r++)
      for (let g = 0; g < 6; g++)
        for (let b = 0; b < 6; b++) pal.push([r * 51, g * 51, b * 51]);
    for (let i = 0; i < 30; i++) {
      const v = Math.round((i * 255) / 29);
      pal.push([v, v, v]);
    }
    return pal;
  }
  function quantizeFixedAll(frames, transparent, bg) {
    const qf = (r, g, b) => {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn <= 16) return 217 + Math.round(((r + g + b) / 3 / 255) * 29);
      return 1 + Math.round(r / 51) * 36 + Math.round(g / 51) * 6 + Math.round(b / 51);
    };
    const indexed = frames.map((fr) => {
      const d = fr.data;
      const px = new Uint8Array(fr.width * fr.height);
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        const a = d[i + 3];
        if (transparent) {
          if (a < 128) { px[p] = 0; continue; }
          px[p] = qf(d[i], d[i + 1], d[i + 2]);
        } else {
          const na = a / 255;
          px[p] = qf(
            d[i] * na + bg[0] * (1 - na),
            d[i + 1] * na + bg[1] * (1 - na),
            d[i + 2] * na + bg[2] * (1 - na)
          );
        }
      }
      return px;
    });
    return { indexed, palette: buildFixedPalette(), transIndex: transparent ? 0 : -1 };
  }

  async function exportGIF(canvases, fps, bg) {
    setStatus("GIFエンコード中...");
    await new Promise((r) => setTimeout(r, 20));
    const frames = toImageData(canvases);
    const W = frames[0].width, H = frames[0].height;
    const transparent = bg == null;
    const { indexed, palette, transIndex } =
      typeof GifencLib !== "undefined"
        ? quantizeAdaptive(frames, transparent, bg)
        : quantizeFixedAll(frames, transparent, bg);
    const delayCs = Math.max(2, Math.round(100 / fps));
    const bytes = GifEnc.encode(indexed, W, H, palette, delayCs, transIndex);
    const blob = new Blob([bytes], { type: "image/gif" });
    showResult(blob, "gif", `${W}×${H} / ${canvases.length}コマ / ${fps}fps${transparent ? " / 透過" : ""}`);
    setStatus("GIF書き出し完了");
  }

  // ---- MP4 (WebCodecs + mp4-muxer) ----
  async function exportMP4(canvases, fps, bg) {
    if (!("VideoEncoder" in window)) {
      setStatus("このブラウザはWebCodecs非対応です。WebM書き出しをご利用ください");
      return;
    }
    if (bg == null) bg = [255, 255, 255]; // 動画は透過不可のため白に
    const N = canvases.length;
    const W = canvases[0].width, H = canvases[0].height;
    const outW = W + (W % 2), outH = H + (H % 2); // H.264は偶数サイズ必須

    let config = null;
    for (const codec of ["avc1.42001f", "avc1.420028", "avc1.42002a", "avc1.420034"]) {
      const c = { codec, width: outW, height: outH, bitrate: 8_000_000, framerate: fps };
      try {
        if ((await VideoEncoder.isConfigSupported(c)).supported) { config = c; break; }
      } catch (e) { /* 次の候補へ */ }
    }
    if (!config) { setStatus("対応するH.264エンコーダーが見つかりませんでした"); return; }

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: "avc", width: outW, height: outH },
      fastStart: "in-memory",
    });
    let encodeError = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { encodeError = e; },
    });
    encoder.configure(config);

    const cv = document.createElement("canvas");
    cv.width = outW; cv.height = outH;
    const cx = cv.getContext("2d");
    const totalFrames = Math.max(N, Math.ceil(3 * fps)); // 3秒以上になるまでループ
    for (let f = 0; f < totalFrames; f++) {
      cx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
      cx.fillRect(0, 0, outW, outH);
      cx.drawImage(canvases[f % N], 0, 0);
      const vf = new VideoFrame(cv, {
        timestamp: Math.round((f * 1e6) / fps),
        duration: Math.round(1e6 / fps),
      });
      encoder.encode(vf, { keyFrame: f % (fps * 2) === 0 });
      vf.close();
      if (f % 15 === 14) {
        setStatus(`MP4エンコード中... ${f + 1}/${totalFrames}`);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    await encoder.flush();
    muxer.finalize();
    if (encodeError) { setStatus("MP4エンコード失敗: " + encodeError.message); return; }
    const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
    showResult(blob, "mp4", `${outW}×${outH} / ${fps}fps / 約${(totalFrames / fps).toFixed(1)}秒`);
    setStatus("MP4書き出し完了");
  }

  // ---- WebM (MediaRecorder) ----
  async function exportWebM(canvases, fps, bg) {
    if (bg == null) bg = [255, 255, 255];
    const N = canvases.length;
    const W = canvases[0].width, H = canvases[0].height;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const cx = cv.getContext("2d");
    const stream = cv.captureStream(fps);
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9" : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    const done = new Promise((r) => { rec.onstop = r; });
    const totalFrames = Math.max(N, Math.ceil(3 * fps));
    rec.start();
    setStatus("WebM録画中...");
    for (let f = 0; f < totalFrames; f++) {
      cx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
      cx.fillRect(0, 0, W, H);
      cx.drawImage(canvases[f % N], 0, 0);
      await new Promise((r) => setTimeout(r, 1000 / fps));
    }
    rec.stop();
    await done;
    const blob = new Blob(chunks, { type: "video/webm" });
    showResult(blob, "webm", `${W}×${H} / ${fps}fps / 約${(totalFrames / fps).toFixed(1)}秒`);
    setStatus("WebM書き出し完了");
  }

  // ---- 連番PNG (ZIP) ----
  async function exportZIP(canvases, fps, bg) {
    setStatus("連番PNGを作成中...");
    const N = canvases.length;
    const W = canvases[0].width, H = canvases[0].height;
    const zip = new JSZip();
    for (let f = 0; f < N; f++) {
      let target = canvases[f];
      if (bg != null) {
        const cv = document.createElement("canvas");
        cv.width = W; cv.height = H;
        const cx = cv.getContext("2d");
        cx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
        cx.fillRect(0, 0, W, H);
        cx.drawImage(canvases[f], 0, 0);
        target = cv;
      }
      const blob = await new Promise((r) => target.toBlob(r, "image/png"));
      zip.file(`frame_${String(f).padStart(3, "0")}.png`, blob);
    }
    zip.file(
      "info.txt",
      `連番PNG素材\r\nフレーム数: ${N}\r\n推奨fps: ${fps}\r\nループ素材です(frame_000から順に繰り返し再生)。\r\n`
    );
    const blob = await zip.generateAsync({ type: "blob" });
    showResult(blob, "zip", `${W}×${H} / ${N}枚 / 推奨${fps}fps${bg == null ? " / 透過PNG" : ""}`);
    setStatus("連番PNG(ZIP)書き出し完了");
  }

  return { exportGIF, exportMP4, exportWebM, exportZIP, setStatus, showResult };
})();
if (typeof module !== "undefined" && module.exports) module.exports = ExportKit;
