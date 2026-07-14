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

  // Cloudflare Pages 用のヘッダー設定(キャッシュ + 基本のセキュリティヘッダー)。
  // ルールごとにワイルドカードは末尾1つだけなので、アプリごとに列挙する。
  const libRules = INCLUDE.filter((e) => e.startsWith("apps/") && !e.endsWith(".html")).flatMap(
    (app) => [`/${app}/lib/*`, "  Cache-Control: public, max-age=31536000, immutable", ""]
  );
  await writeFile(
    path.join(DIST, "_headers"),
    [
      "/*",
      "  X-Content-Type-Options: nosniff",
      "  Referrer-Policy: strict-origin-when-cross-origin",
      "",
      ...libRules,
    ].join("\n"),
    "utf8"
  );

  // 存在しないパスにトップページが200で返らないよう、404ページを置く
  await writeFile(
    path.join(DIST, "404.html"),
    await minifyHtml(
      `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>404 — ページが見つかりません | App Shelf</title>
<style>
  body { margin:0; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:16px; background:#0a1020; color:#e8eaf0; font-family:"Segoe UI","Yu Gothic UI","Meiryo",sans-serif; text-align:center; padding:24px; }
  h1 { font-size:64px; margin:0; letter-spacing:0.08em; color:#8cffc1; }
  p { margin:0; color:#9aa3b2; font-size:14px; line-height:1.9; }
  a { color:#8cffc1; text-decoration:none; border:1px solid #2c3a4d; border-radius:8px; padding:10px 18px; font-size:13px; }
  a:hover { background:#131c30; }
</style></head><body>
<h1>404</h1>
<p>お探しのページは見つかりませんでした。<br>URLが変わったか、まだ公開されていない可能性があります。</p>
<a href="/">アプリ一覧へ戻る</a>
</body></html>`,
      { collapseWhitespace: true, removeComments: true, minifyCSS: true }
    ),
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
