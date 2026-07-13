# App Shelf

GitHub Pages向けの静的アプリ一覧サイトです。ビルド作業は不要です。

## アプリを追加する

`apps.js` の `apps` 配列に項目を追加してください。

- `status`: `released`、`developing`、`planned` のいずれか
- `url`: 公開先。開発中などリンクがない場合は空文字
- `technologies`: 使用技術や特徴

## GitHub Pagesで公開する

このフォルダの内容をリポジトリへ置き、GitHubの **Settings → Pages** から公開元のブランチとフォルダを選択します。
