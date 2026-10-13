# moovie — 夢の15秒ムービー

夢って、記憶の断片がパズルみたいにばらばらになって、
思いがけない形に組み上がって、朝になったらぱっと消えてしまう。
そんなイメージを、映像も音楽もすべてコード（Python + NumPy + Pillow）で作ったショートムービー。

完成した動画: [`output/dream.mp4`](output/dream.mp4)（1920×1080 / 30fps / 15秒 / AAC音声つき）

## サイト

同じテーマで作ったもう1本の動画（[`dream_15s_v6.mp4`](dream_15s_v6.mp4)）と並べて見られるページが [`index.html`](index.html)。
GitHub Pages で公開すると https://hirominemoto.github.io/moovie/ で見られる。

公開の手順（最初の1回だけ）: リポジトリの **Settings → Pages** で、
Source を「Deploy from a branch」、Branch を `claude/modest-heisenberg-k96lp2` の `/ (root)` にして Save。

## 構成

| 時間 | 映像 | 音 |
| --- | --- | --- |
| 0.0–3.0s | 「夢・・・」「それはあなたの記憶の断片」が一文字ずつ灯る | Dmaj9 のパッドと、文字に合わせたベル |
| 3.0–6.0s | 文字がほどけ、記憶の断片（パズルのピース）が中央から散らばって漂う | Bm9。ガラスのような粒と、ちぎれた旋律 |
| 6.0–9.2s | ピースが飛び立ち、中央から順にはまっていく | Gmaj9#11。はまるたびにベルが駆け上がる |
| 9.2–10.6s | 継ぎ目が溶けて一枚の絵に。空を泳ぐクジラ、背中の家、空の魚、海から昇る灯籠 | 完成の和音ときらめき |
| 10.6–11.3s | 朝の光が差し、絵がほどけて光に溶ける | 上昇音のあと、音楽がぷつりと消える |
| 11.3–15.0s | 「目が覚めたら、消えている」。淡く透ける DREAM が一文字ずつふわっと浮き上がり、それぞれ別々に漂って、昇りながら消えていく | オルゴールのように降りてくる旋律と残響 |

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

## トークンメーター（もーメーター）

AIチャットの画面に置く、トークン使用量のバー。部品とデモは [`token-meter/`](token-meter/) にある。

- **このチャット**（うし）: いまの会話の大きさ。AIが一度に読める量（コンテキスト）の何%まで来たか。うしが右へ歩いていく
- **トータル**（月）: これまでに使ったトークンの合計。自分で決めた予算の何%か。月が満ちていく

50%・80%・95% で色と札が変わって、うしは汗をかき、最後は目を回す。うしや月をクリックするとしゃべる。

デモは [`token-meter/index.html`](token-meter/index.html)（返事とトークン数はシミュレーション）。
モジュールを読み込むので、手元で見るときは `python -m http.server` などで開く（ファイルをダブルクリックでは動かない）。

### 自分のチャット画面に組み込む

```html
<script type="module" src="token-meter.js"></script>
<token-meter id="meter" chat-limit="1000000" total-limit="5000000" storage-key="my-chat-total"></token-meter>
```

```js
const meter = document.getElementById("meter");

// Claude API を呼んだら、レスポンスの usage をそのまま渡す
meter.addUsage(data.usage);

// 新しい会話を始めたとき（うしがスタートにもどる）
meter.newChat();
```

API キーはブラウザに置かないこと。サーバー側で Claude API を呼んで、`usage` だけブラウザに返す形にする。

| 属性 | 意味 |
| --- | --- |
| `chat-limit` | このチャットの上限。いまの Claude（Opus 5.5 / Sonnet 5.5 / Haiku 5.5 / Fable 5.1）は 1,000,000 で、これが初期値。Haiku 4.5 なら 200,000 |
| `total-limit` | トータルの予算。自分で決める（初期値 5,000,000） |
| `chat-used` / `total-used` | 最初に表示する使用量 |
| `storage-key` | 付けると、トータルをブラウザ（localStorage）に覚えておいて、開きなおしても続きから数える |
| `chat-label` / `total-label` | ラベルの文字（初期値「このチャット」「トータル」） |

JavaScript からは `chatUsed` `totalUsed` `chatLimit` `totalLimit` を読み書きできて、`addUsage(usage)` `newChat()` `resetTotal()` が使える。
段階が変わると `levelchange` イベント（`detail: { meter, level, ratio }`、`level` は `calm` / `half` / `near` / `full`）が飛ぶ。
色とフォントは `--tm-ink` `--tm-muted` `--tm-surface` `--tm-line` `--tm-track` `--tm-font` `--tm-num-font` でページに合わせられる。

### 数え方

`addUsage` は `input_tokens + cache_creation_input_tokens + cache_read_input_tokens + output_tokens` を1回ぶんとして数える。

- **このチャット**は最新の1回ぶんをそのまま使う。AI は毎回それまでの会話をまるごと読み直すので、これがいまの会話の大きさになる（足し算はしない）
- **トータル**は1回ぶんを毎回足していく。読み直したぶんも入るので、長い会話ほど早く増える（キャッシュから読んだぶんは料金が安いけれど、ここでは同じ1トークンとして数える）
