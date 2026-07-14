# Cloudflare Pages へのデプロイ手順

このサイトは Cloudflare Pages に **wrangler で直接アップロード**する方式で公開します。
GitHubリポジトリとは連携しないため、Cloudflare側にソース一式は渡りません。
公開されるのは `dist/`(minify済みの成果物)だけです。

## 初回のみ: Cloudflareにログイン

ターミナルで次を実行し、ブラウザで開くCloudflareの画面から許可してください
(このログイン操作だけは、アカウント所有者本人が行う必要があります)。

```
cd F:\dev\10925
npx wrangler login
```

`Successfully logged in.` と出れば完了です。確認:

```
npx wrangler whoami
```

## デプロイ

```
npm run build     # dist/ を作り直す(minify)
npm run deploy    # dist/ を Cloudflare Pages にアップロード
```

初回の `npm run deploy` で `app-shelf` というプロジェクトが自動作成され、
`https://app-shelf.pages.dev`(プロジェクト名が既に使われていた場合は別名)で公開されます。
公開URLはコマンドの出力に表示されます。

2回目以降も同じ2コマンドだけで更新できます。

## ビルドについて

`build.mjs` が行うこと:

- 公開するファイルだけを `dist/` に集める
  (開発中の Idle Motion Maker / Manga FX Maker、README、ビルド関連は含めない)
- HTML / CSS / JS を minify し、コメントや整形を落とす
- OSS(gifenc / mp4-muxer / JSZip)の **MITライセンス表記は保持**
  (`@license` 付きヘッダー + `lib/LICENSE-*` ファイルを同梱)
- `_headers` を生成(`X-Content-Type-Options`、ライブラリの長期キャッシュ)

## ソースコードの見え方について

Webアプリである以上、ブラウザが実行するコードは必ず利用者側にダウンロードされるため、
**コードを完全に隠すことはできません**。このビルドでできるのは次の2点です。

1. minify によりコメント(日本語の解説含む)や整形が消え、読み解くコストが大幅に上がる
2. Cloudflare には `dist/` しか渡らないので、READMEやビルドスクリプト、コミット履歴は公開されない

さらに隠したい場合は、GitHubリポジトリ `tokonoha00/10925` を **private** にするのが最も効果的です
(ただし GitHub Pages の無料公開は public リポジトリが前提のため、
GitHub Pages 側を停止してCloudflareに一本化してから行ってください)。
