# Line Boil Maker

線画画像を読み込むだけで、手描きで何度も描き直したように線が揺れる
「ラインボイル(line boil)」アニメーションを GIF / WebM で書き出せるツール。

## 使い方

1. `run_app.bat` をダブルクリック(既定のブラウザで `index.html` が開く。サーバー不要・完全オフライン動作)
2. 線画画像(PNG / JPG / WebP)をドラッグ&ドロップ、クリック選択、または Ctrl+V で貼り付け
3. プレビューを見ながらスライダーを調整
4. 書き出し形式を選ぶ:
   - **GIF** — 透過対応・無限ループ。SNSやチャットにそのまま貼れる
   - **MP4** — H.264動画(WebCodecs使用)。動画編集ソフトやSNS投稿に
   - **WebM** — MP4が使えないブラウザ向けのフォールバック
   - **連番PNG (ZIP)** — フル透過のまま1コマずつ。AviUtl / Premiere / After Effects 等の素材に

## パラメータ

| 項目 | 意味 |
|---|---|
| コマ数 | 描き直し枚数(2〜8)。本物の作画ボイルは2〜4枚が定番 |
| 揺れの強さ | 線がずれる最大量(px) |
| 揺れの波長 | 小さいほど細かくガタガタ、大きいほどゆったりうねる |
| 再生速度 | ループのfps。8〜12fpsが手描きらしい |
| 白背景を透過にする | 白い紙に描いた線画を透過線画に変換(色線も保持)。不透明画像は自動でON |
| 背景 | GIFの背景。「透過」なら透過GIFになる(WebMは透過不可のため白合成) |
| 出力サイズ上限 | 大きい画像を縮小してファイルサイズを抑える |

## 仕組み

- 値ノイズ(2オクターブ)による滑らかな変位マップをコマごとに別シードで生成し、
  元画像をピクセル単位でずらすことで「同じ絵を描き直した」ような線のブレを作る
- GIFの色は gifenc(OSS)の適応パレット量子化で決定(カラーイラストでも減色がきれい)。
  ライブラリが読み込めない場合は固定パレット+自作エンコーダーにフォールバック
- GIFのバイナリ組み立ては自作 `gifenc.js`(GIF89a + LZW、透過・無限ループ対応)
- MP4 は WebCodecs (VideoEncoder) + mp4-muxer、WebM は MediaRecorder で生成(3秒以上になるようループ)
- 連番PNG は JSZip で1つのZIPにまとめる

## 使用OSS(すべてMITライセンス、`lib/` に同梱・オフライン動作)

| ライブラリ | 用途 | 作者 |
|---|---|---|
| [gifenc](https://github.com/mattdesl/gifenc) 1.0.3 | GIF用の適応パレット量子化 | Matt DesLauriers |
| [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) 5.2.2 | MP4コンテナ生成 | Vanilagy |
| [JSZip](https://github.com/Stuk/jszip) 3.10.1 | 連番PNGのZIP化 | Stuart Knightley ほか |

各ライセンス全文は `lib/LICENSE-*` を参照。

## ファイル構成

- `index.html` — アプリ本体(UI・ボイル生成・書き出し)
- `gifenc.js` — 自作GIFエンコーダー(Node からも require 可能)
- `lib/` — 同梱OSS(gifenc / mp4-muxer / JSZip とライセンス)
- `test_gif.js` — エンコーダー検証(`node test_gif.js`、要ffmpeg: `C:\ffmpeg-8.1.2-essentials_build`)
- `run_app.bat` — 起動用

## 検証方法

- `node test_gif.js` で GIF が ffmpeg でデコード可能なことを確認
- ブラウザで「サンプル線画で試す」→ プレビューが揺れる → GIF書き出し → 下部の結果エリアにアニメGIFが表示されればOK
