/*
 * Cloudflare Pages 用のビルド。
 * 公開するファイルだけを dist/ に集め、HTML/CSS/JS を minify する。
 * - コメント(日本語の解説含む)や整形は落とすが、OSSのライセンス表記は残す
 * - README や開発中アプリ、ビルド関連ファイルは dist に入れない
 * 実行: npm run build
 */
import { readFile, writeFile, mkdir, rm, readdir, stat, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { minify as minifyHtml } from "html-minifier-terser";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");

// dist に含めるトップレベルのファイル/フォルダ。
// 開発中アプリ(idle-motion-maker / manga-fx-maker)は公開しないので載せない。
const INCLUDE = [
  "index.html",
  "styles.css",
  "apps.js",
  "apps/ui-animation-gallery.html",
  "apps/line-boil-maker",
  "apps/logo-shine-maker",
];

// dist から除外するファイル名(アプリフォルダ内)
const EXCLUDE_NAMES = new Set(["README.md"]);

const isText = (p) => /\.(html|css|js|mjs|json|md|txt)$/i.test(p);

let stats = { html: 0, js: 0, css: 0, copied: 0, srcBytes: 0, outBytes: 0 };

async function processFile(src, dest) {
  const ext = path.extname(src).toLowerCase();
  await mkdir(path.dirname(dest), { recursive: true });

  if (!isText(src)) {
    await copyFile(src, dest);
    stats.copied++;
    return;
  }

  const code = await readFile(src, "utf8");
  stats.srcBytes += Buffer.byteLength(code);
  let out = code;

  if (ext === ".html") {
    out = await minifyHtml(code, {
      collapseWhitespace: true,
      conservativeCollapse: false,
      removeComments: true,
      minifyCSS: true,
      minifyJS: { legalComments: "inline" }, // @license 付きコメントは残す
      removeAttributeQuotes: false,
      keepClosingSlash: true,
    });
    stats.html++;
  } else if (ext === ".js" || ext === ".mjs") {
    // 既に minify 済みのライブラリ(jszip.min.js 等)は触らずコピー
    if (/\.min\.js$/i.test(src)) {
      await copyFile(src, dest);
      stats.copied++;
      stats.outBytes += (await stat(dest)).size;
      return;
    }
    const r = await esbuild.transform(code, {
      loader: "js",
      minify: true,
      legalComments: "inline", // @license / /*! を保持(MIT の表示義務を満たす)
      target: "es2020",
    });
    out = r.code;
    stats.js++;
  } else if (ext === ".css") {
    const r = await esbuild.transform(code, { loader: "css", minify: true });
    out = r.code;
    stats.css++;
  } else {
    await copyFile(src, dest);
    stats.copied++;
    stats.outBytes += (await stat(dest)).size;
    return;
  }

  await writeFile(dest, out, "utf8");
  stats.outBytes += Buffer.byteLength(out);
}

async function walk(srcDir, destDir) {
  for (const name of await readdir(srcDir)) {
    if (EXCLUDE_NAMES.has(name)) continue;
    const src = path.join(srcDir, name);
    const dest = path.join(destDir, name);
    const s = await stat(src);
    if (s.isDirectory()) await walk(src, dest);
    else await processFile(src, dest);
  }
}

async function main() {
  if (existsSync(DIST)) await rm(DIST, { recursive: true });
  await mkdir(DIST, { recursive: true });

  for (const entry of INCLUDE) {
    const src = path.join(ROOT, entry);
    const dest = path.join(DIST, entry);
    if (!existsSync(src)) throw new Error(`ビルド対象が見つかりません: ${entry}`);
    const s = await stat(src);
    if (s.isDirectory()) await walk(src, dest);
    else await processFile(src, dest);
  }

  // Cloudflare Pages 用のヘッダー設定(キャッシュ + 基本のセキュリティヘッダー)
  await writeFile(
    path.join(DIST, "_headers"),
    [
      "/*",
      "  X-Content-Type-Options: nosniff",
      "  Referrer-Policy: strict-origin-when-cross-origin",
      "",
      "/apps/*/lib/*",
      "  Cache-Control: public, max-age=31536000, immutable",
      "",
    ].join("\n"),
    "utf8"
  );

  const kb = (n) => (n / 1024).toFixed(1) + " KB";
  console.log(
    `build 完了: html=${stats.html} js=${stats.js} css=${stats.css} copy=${stats.copied}\n` +
      `  minify対象 ${kb(stats.srcBytes)} → 出力合計 ${kb(stats.outBytes)}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
