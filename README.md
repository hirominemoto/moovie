# moovie — 夢の15秒ムービー

夢って、記憶の断片がパズルみたいにばらばらになって、
思いがけない形に組み上がって、朝になったらぱっと消えてしまう。
そんなイメージを、映像も音楽もすべてコード（Python + NumPy + Pillow）で作ったショートムービー。

完成した動画: [`output/dream.mp4`](output/dream.mp4)（1920×1080 / 30fps / 15秒 / AAC音声つき）

## 構成

| 時間 | 映像 | 音 |
| --- | --- | --- |
| 0.0–3.0s | 「夢・・・」「それはあなたの記憶の断片」が一文字ずつ灯る | Dmaj9 のパッドと、文字に合わせたベル |
| 3.0–6.0s | 文字がほどけ、記憶の断片（パズルのピース）が中央から散らばって漂う | Bm9。ガラスのような粒と、ちぎれた旋律 |
| 6.0–9.2s | ピースが飛び立ち、中央から順にはまっていく | Gmaj9#11。はまるたびにベルが駆け上がる |
| 9.2–10.6s | 継ぎ目が溶けて一枚の絵に。空を泳ぐクジラ、背中の家、空の魚、海から昇る灯籠 | 完成の和音ときらめき |
| 10.6–11.3s | 朝の光が差し、絵がほどけて光に溶ける | 上昇音のあと、音楽がぷつりと消える |
| 11.3–15.0s | 「目が覚めたら、消えている」。淡く透ける DREAM がふわふわ漂い、余韻を残して消える | オルゴールのように降りてくる旋律と残響 |

## 作り直し方

必要なもの: Python 3.9+ / NumPy / Pillow / ffmpeg

```bash
pip install numpy pillow
python dream/render.py                  # → output/dream.mp4
python dream/render.py --stills 2.4 9.6 # 指定秒の静止画だけ書き出す（確認用）
python dream/music.py music.wav         # 音楽だけ書き出す
```

### フォントについて

文字は **Meiryo（メイリオ）** で描くようにしてあって、スクリプトが自動で探す。

- Windows: `C:\Windows\Fonts\meiryo.ttc`（標準で入っている）
- WSL: `/mnt/c/Windows/Fonts/meiryo.ttc`
- macOS（Office を入れている場合など）: `/Library/Fonts/` ほか

Meiryo は Windows に付属する Microsoft のライセンスフォントなので、このリポジトリには含めていない。
見つからない環境では Noto Sans CJK JP / IPAゴシックなどで代用して警告を出す。
別のフォントを使うときは `--font path/to/font.ttf`（.ttc は `--font-index` で番号指定）。

> `output/dream.mp4` は Meiryo の入っていないクラウド環境で書き出したため、
> 代わりに Noto Sans JP で描画している。Windows で `python dream/render.py` を実行すれば Meiryo 版になる。

## ファイル

- `dream/timeline.py` — 映像と音で共有するタイミング（ピースがはまる瞬間に音が鳴るのはここで揃えている）
- `dream/scene.py` — 組み上がって現れる夢の一枚絵を描く
- `dream/puzzle.py` — 絵をジグソーパズルのピースに切り分ける
- `dream/music.py` — パッド・FMベル・きらめき・リバーブをすべて合成
- `dream/render.py` — 全レイヤーを合成して ffmpeg で mp4 に書き出す
