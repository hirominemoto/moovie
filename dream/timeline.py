"""映像と音楽で共有するタイムライン。

映像 (render.py) と音楽 (music.py) の両方がここを参照するので、
パズルのピースがはまる瞬間と音が鳴る瞬間がぴったり揃う。
"""
import numpy as np

FPS = 30
DURATION = 15.0
SAMPLE_RATE = 44100
SEED = 7

# ---- テキスト ---------------------------------------------------------
TITLE_LINE1 = "夢・・・"
TITLE_LINE2 = "それはあなたの記憶の断片"
ENDING_LINE = "目が覚めたら、消えている"
ENDING_WORD = "DREAM"

# 1行目は「夢」のあとに「・・・」がひとつずつ灯る
TITLE1_STARTS = [0.45, 0.80, 0.98, 1.16]
TITLE2_START, TITLE2_STEP = 1.40, 0.045
TITLE_OUT = 2.80          # タイトルがほどけ始める

# ---- 記憶の断片（パズル） ---------------------------------------------
COLS, ROWS = 8, 5
SCATTER = 3.0             # 断片が中央から散らばり始める
SCATTER_SPREAD = 0.8      # 出現タイミングのばらつき
ASSEMBLE = 6.0            # 組み上がり開始
ASSEMBLE_SPREAD = 1.8     # 飛び立つタイミングのばらつき
ASSEMBLE_DUR = 1.3        # 1ピースが飛んでいく時間
COMPLETE = ASSEMBLE + ASSEMBLE_SPREAD + ASSEMBLE_DUR + 0.05   # 完成

# ---- 朝 ----------------------------------------------------------------
DAWN = 10.55              # 朝の光が差し始める
FLASH = 11.25             # 光が満ちて、夢が消える

# ---- エンディング ------------------------------------------------------
ENDING_TEXT = 11.95
DREAM_IN = 12.15          # D→R→E→A→M の順に浮かび上がる
DREAM_OUT = 14.05         # 同じ順に消えていく


def piece_schedule():
    """各ピースの出現・出発・着地の時刻を返す。

    中央に近いピースほど先にはまるので、絵が真ん中から広がるように現れる。
    """
    rng = np.random.RandomState(SEED)
    n = COLS * ROWS
    cols = np.arange(n) % COLS
    rows = np.arange(n) // COLS
    dx = (cols + 0.5) / COLS - 0.5
    dy = (rows + 0.5) / ROWS - 0.5
    dist = np.sqrt(dx ** 2 + (dy * 0.9) ** 2) / 0.66
    key = dist + 0.55 * rng.rand(n)
    rank = np.empty(n, int)
    rank[np.argsort(key)] = np.arange(n)

    appear = SCATTER + SCATTER_SPREAD * rng.rand(n)
    start = ASSEMBLE + ASSEMBLE_SPREAD * rank / (n - 1)
    land = start + ASSEMBLE_DUR
    return {
        "col": cols,
        "row": rows,
        "rank": rank,
        "appear": appear,
        "start": start,
        "land": land,
    }
