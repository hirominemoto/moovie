#!/usr/bin/env python3
"""夢をテーマにした15秒のムービーを、すべてコードで生成する。

    python dream/render.py                       # → output/dream.mp4
    python dream/render.py --font path/to/font   # フォントを指定
    python dream/render.py --stills 1.5 7 12.8   # 確認用の静止画だけ書き出す

フォントは Meiryo を優先して自動で探す（Windows なら C:\\Windows\\Fonts\\meiryo.ttc）。
見つからない環境では、近いゴシック体で代用して警告を出す。
"""
import argparse
import math
import multiprocessing as mp
import os
import shutil
import subprocess
import sys
import tempfile
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import music
import timeline as T
from common import gradient, hexrgb
from puzzle import cut_pieces
from scene import paint_dream

TAU = 2 * math.pi

# ---- フォント ------------------------------------------------------------

MEIRYO_CANDIDATES = [
    r"C:\Windows\Fonts\meiryo.ttc",
    "/mnt/c/Windows/Fonts/meiryo.ttc",                     # WSL
    "/Library/Fonts/Meiryo.ttc", "/Library/Fonts/meiryo.ttc",
    "/Library/Fonts/Microsoft/Meiryo.ttf",
    "~/Library/Fonts/Meiryo.ttc", "~/Library/Fonts/meiryo.ttc",
    "~/.local/share/fonts/meiryo.ttc", "~/.fonts/meiryo.ttc",
    "/usr/share/fonts/truetype/meiryo/meiryo.ttc",
]
FALLBACK_FAMILIES = ["Noto Sans CJK JP", "Noto Sans JP", "IPAexGothic", "IPAGothic", "TakaoGothic"]


def find_font(path=None, index=0):
    """(フォントファイル, ttc内の番号, 表示名) を返す。"""
    if path:
        return path, index, os.path.basename(path)
    windir = os.environ.get("WINDIR")
    candidates = ([os.path.join(windir, "Fonts", "meiryo.ttc")] if windir else []) + MEIRYO_CANDIDATES
    for p in candidates:
        p = os.path.expanduser(p)
        if os.path.isfile(p):
            return p, 0, "Meiryo"
    fc = shutil.which("fc-match")
    if fc:
        for family in ["Meiryo"] + FALLBACK_FAMILIES:
            found = subprocess.run([fc, "-f", "%{file}", family], capture_output=True, text=True).stdout.strip()
            name = os.path.basename(found).lower().replace("-", "").replace("_", "")
            if family == "Meiryo":
                if "meiryo" in name:
                    return found, 0, "Meiryo"
            elif any(key in name for key in ("cjk", "notosansjp", "ipa", "takao")):
                print(f"⚠ Meiryo が見つからないので {family} で代用します（--font で指定できます）", file=sys.stderr)
                return found, 0, family
    sys.exit("日本語フォントが見つかりません。--font でフォントファイルを指定してください。")


# ---- 小さな道具 --------------------------------------------------------

def _c01(x):
    return min(max(x, 0.0), 1.0)


def _ss(a, b, x):
    t = _c01((x - a) / (b - a))
    return t * t * (3 - 2 * t)


def _eo(t):
    t = _c01(t)
    return 1 - (1 - t) ** 3


def _eio(t):
    t = _c01(t)
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def _region(f, h, w, x0, y0):
    """フレーム f と、そこに置く (h, w) 配列の重なり部分のスライスを返す。"""
    H, W = f.shape[:2]
    fx0, fy0, fx1, fy1 = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if fx0 >= fx1 or fy0 >= fy1:
        return None
    return (slice(fy0, fy1), slice(fx0, fx1)), (slice(fy0 - y0, fy1 - y0), slice(fx0 - x0, fx1 - x0))


def transform(img, W, H, cx, cy, ang=0.0, scale=1.0, sx=1.0):
    """スプライトを回転・拡大して (cx, cy) を中心に置く。サブピクセル精度。"""
    sw, sh = img.size
    ca, sa = math.cos(ang), math.sin(ang)
    a00, a01, a10, a11 = ca * scale * sx, -sa * scale, sa * scale * sx, ca * scale
    hw, hh = sw / 2, sh / 2
    xs = [a00 * dx + a01 * dy for dx, dy in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh))]
    ys = [a10 * dx + a11 * dy for dx, dy in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh))]
    x0, x1 = math.floor(cx + min(xs)) - 1, math.ceil(cx + max(xs)) + 1
    y0, y1 = math.floor(cy + min(ys)) - 1, math.ceil(cy + max(ys)) + 1
    if x1 <= 0 or y1 <= 0 or x0 >= W or y0 >= H:
        return None
    det = a00 * a11 - a01 * a10
    if abs(det) < 1e-6:
        return None
    i00, i01, i10, i11 = a11 / det, -a01 / det, -a10 / det, a00 / det
    ox, oy = x0 - cx, y0 - cy
    out = img.transform((x1 - x0, y1 - y0), Image.AFFINE,
                        (i00, i01, i00 * ox + i01 * oy + hw, i10, i11, i10 * ox + i11 * oy + hh),
                        resample=Image.BILINEAR)
    return np.asarray(out, np.float32) / 255, x0, y0


def splat(f, x, y, sx, sy, col):
    """ぼんやり光る点（楕円ガウス）を加算する。"""
    H, W = f.shape[:2]
    rx, ry = int(3 * sx) + 1, int(3 * sy) + 1
    x0, x1 = max(0, int(x) - rx), min(W, int(x) + rx + 1)
    y0, y1 = max(0, int(y) - ry), min(H, int(y) + ry + 1)
    if x0 >= x1 or y0 >= y1:
        return
    gx = np.exp(-((np.arange(x0, x1) + 0.5 - x) ** 2) / (2 * sx * sx))
    gy = np.exp(-((np.arange(y0, y1) + 0.5 - y) ** 2) / (2 * sy * sy))
    f[y0:y1, x0:x1] += (gy[:, None] * gx[None, :])[..., None] * col


def glint(f, x, y, size, col):
    """十字にきらっと光る星。"""
    splat(f, x, y, 1.8 * size, 1.8 * size, col)
    splat(f, x, y, 11 * size, 0.7 * size, col * 0.6)
    splat(f, x, y, 0.7 * size, 11 * size, col * 0.6)


def make_chars(text, font, tracking, k, soft=2.5, glow=10.0):
    """1文字ずつのスプライト（くっきり/ぼんやり/光）と横位置を作る。"""
    adv = [font.getlength(c) for c in text]
    total = sum(adv) + tracking * (len(text) - 1)
    S = int(font.size * 1.5 + 6 * glow * k)
    S += S % 2
    chars, x = [], -total / 2
    for c, a in zip(text, adv):
        im = Image.new("L", (S, S), 0)
        ImageDraw.Draw(im).text((S / 2, S / 2), c, font=font, fill=255, anchor="mm")
        g = np.asarray(im.filter(ImageFilter.GaussianBlur(glow * k)), np.float32)
        peak = max(g.max(), 1.0)
        chars.append({
            "dx": x + a / 2,
            "sharp": im,
            "soft": im.filter(ImageFilter.GaussianBlur(soft * k)),
            "glow": Image.fromarray(np.clip(g * 255 / peak, 0, 255).astype(np.uint8)),
            "gpeak": peak / 255,
        })
        x += a + tracking
    return chars


# ---- レンダラー ----------------------------------------------------------

class Renderer:
    def __init__(self, W, H, font_path, font_index=0):
        self.W, self.H = W, H
        self.k = k = H / 1080
        self.Cx, self.Cy = W / 2, H / 2
        rng = np.random.RandomState(T.SEED + 1)

        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        night = gradient(H, W, [(0, "#05061a"), (0.5, "#110f2c"), (1, "#1a1234")])
        r = np.sqrt(((xx - W / 2) / (0.7 * W)) ** 2 + ((yy - 0.55 * H) / (0.7 * H)) ** 2)
        night += np.exp(-2.2 * r ** 2)[..., None] * hexrgb("#6a5acd") * 0.06
        dawn = gradient(H, W, [(0, "#0a0d24"), (0.55, "#181634"), (1, "#33233f")])
        dawn += np.exp(-(((xx - W / 2) / (0.8 * W)) ** 2 + ((yy - 1.15 * H) / (0.45 * H)) ** 2))[..., None] \
            * hexrgb("#a0606a") * 0.28
        self.bg_night, self.bg_dawn = night, dawn
        rv = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
        self.vignette = (1 - 0.42 * np.clip(rv / 1.25, 0, 1) ** 2.4)[..., None].astype(np.float32)
        ds = np.sqrt(((xx - 0.86 * W) / W) ** 2 + ((yy - 1.08 * H) / W) ** 2)
        self.sun_field = np.exp(-(ds / 0.55) ** 2)[..., None].astype(np.float32)
        self.warm = hexrgb("#fffaf3")
        self.gold = hexrgb("#ffc890")
        del yy, xx, r, rv, ds

        # 背景でゆっくり漂う星雲（低解像度で計算して拡大する）
        lw, lh = max(16, W // 8), max(9, H // 8)
        ly, lx = np.mgrid[0:lh, 0:lw].astype(np.float32)
        self.neb_x, self.neb_y = (lx + 0.5) / lw * (W / H), (ly + 0.5) / lh
        self.blobs = [dict(x=rng.uniform(0.1, 0.9) * W / H, y=rng.uniform(0.15, 0.85),
                           vx=rng.uniform(-0.015, 0.015), vy=rng.uniform(-0.01, 0.01),
                           ax=rng.uniform(0.03, 0.08), ay=rng.uniform(0.02, 0.06),
                           fr=rng.uniform(0.05, 0.12), ph=rng.uniform(0, TAU),
                           r=rng.uniform(0.18, 0.35), col=hexrgb(c) * rng.uniform(0.05, 0.10))
                      for c in ["#5b4bd6", "#c25aa8", "#2f8fb8", "#7a5cff", "#e07a9c", "#3a3fa8"]]

        # 漂う光の粒
        n = 130
        palette = np.array([hexrgb(c) for c in ["#d9d2ff", "#ffc8e6", "#bfefff", "#fff1c9"]])
        self.dust = dict(x=rng.uniform(0, W, n), y=rng.uniform(0, H, n), vy=-rng.uniform(5, 20, n) * k,
                         sa=rng.uniform(4, 22, n) * k, sf=rng.uniform(0.1, 0.35, n), sp=rng.uniform(0, TAU, n),
                         sig=rng.uniform(0.7, 2.4, n) * k, b=rng.uniform(0.15, 0.75, n),
                         tf=rng.uniform(0.4, 1.6, n), tp=rng.uniform(0, TAU, n),
                         col=palette[rng.randint(0, len(palette), n)])

        # 夢の一枚絵とパズル
        cw = round(0.75 * W / T.COLS)
        self.PW = cw * T.COLS
        self.PH = round(self.PW * 9 / 16 / T.ROWS) * T.ROWS
        self.X0, self.Y0 = (W - self.PW) // 2, (H - self.PH) // 2
        self.dream, self.meta = paint_dream(self.PW, self.PH)
        self.pieces, (self.cw, self.ch) = cut_pieces(self.dream, T.COLS, T.ROWS, seed=T.SEED, k=k)
        self.dream_sprite = Image.fromarray((self.dream * 255 + 0.5).astype(np.uint8)).convert("RGBA")
        self.sched = T.piece_schedule()
        self._piece_params(rng)

        stars = sorted(self.meta["stars"], key=lambda s: -s[2])[:45]
        self.tw_stars = [(x, y, b, r, rng.uniform(0.3, 0.9), rng.uniform(0, TAU)) for x, y, b, r in stars]
        g = self.meta["glitter"]
        self.tw_glitter = [(x, y, b, rng.uniform(0.8, 2.2), rng.uniform(0, TAU)) for x, y, b in g]
        self.tw_lanterns = [(x, y, s, rng.uniform(0, TAU), rng.uniform(0, TAU)) for x, y, s in self.meta["lanterns"]]

        # 夢が消えたあとに舞う光の粒（絵の色を引き継ぐ）
        n = 240
        px, py = rng.uniform(0, self.PW, n), rng.uniform(0, self.PH, n)
        cols = self.dream[py.astype(int), px.astype(int)] * 1.2 + 0.25
        cam = self.cam(T.FLASH)
        sx = self.Cx + cam * (self.X0 + px - self.Cx)
        sy = self.Cy + cam * (self.Y0 + py - self.Cy)
        d = np.hypot(sx - self.Cx, sy - self.Cy) + 1e-3
        sp = rng.uniform(40, 120, n) * k
        self.ddust = dict(x=sx, y=sy, vx=(sx - self.Cx) / d * sp, vy=(sy - self.Cy) / d * sp - 20 * k,
                          tau=rng.uniform(0.8, 1.6, n), fade=rng.uniform(1.3, 2.4, n),
                          sig=rng.uniform(0.8, 2.6, n) * k, b=rng.uniform(0.5, 1.0, n), col=cols,
                          tf=rng.uniform(1, 3, n), tp=rng.uniform(0, TAU, n))

        # 文字
        def font(size):
            return ImageFont.truetype(font_path, int(round(size)), index=font_index)

        self.title1 = make_chars(T.TITLE_LINE1, font(0.070 * H), 0.012 * H, k)
        self.title2 = make_chars(T.TITLE_LINE2, font(0.047 * H), 0.006 * H, k)
        self.ending = make_chars(T.ENDING_LINE, font(0.046 * H), 0.008 * H, k)
        self.word = make_chars(T.ENDING_WORD, font(0.25 * H), 0.06 * H, k, soft=1.2, glow=16)
        self.title_drift = [(rng.uniform(-10, 10) * k, -rng.uniform(6, 20) * k) for _ in range(40)]
        self.word_phase = [rng.uniform(0, TAU, 5) for _ in T.ENDING_WORD]

    # ---- パズルの動き ----------------------------------------------------

    def _piece_params(self, rng):
        n = len(self.pieces)
        gx, gy = np.meshgrid(np.arange(T.COLS), np.arange(T.ROWS))
        perm = rng.permutation(n)
        gx, gy = gx.ravel()[perm], gy.ravel()[perm]
        self.pp = dict(
            Sx=((gx + 0.5 + rng.uniform(-0.4, 0.4, n)) / T.COLS * 1.04 - 0.02) * self.W,
            Sy=((gy + 0.5 + rng.uniform(-0.4, 0.4, n)) / T.ROWS * 1.0) * self.H,
            vx=rng.uniform(-14, 14, n) * self.k, vy=rng.uniform(-10, 10, n) * self.k,
            ax=rng.uniform(4, 14, n) * self.k, ay=rng.uniform(4, 14, n) * self.k,
            sf=rng.uniform(0.2, 0.5, n), sp=rng.uniform(0, TAU, n), sp2=rng.uniform(0, TAU, n),
            a0=rng.uniform(-0.7, 0.7, n), om=rng.uniform(-0.25, 0.25, n), spin=rng.uniform(-2.5, 2.5, n),
            s=rng.uniform(0.55, 0.95, n), tilt=rng.uniform(0.1, 0.45, n),
            tf=rng.uniform(0.25, 0.6, n), tp=rng.uniform(0, TAU, n),
            arc=rng.uniform(-0.12, 0.12, n) * self.W,
            bd=rng.uniform(0, TAU, n), br=rng.uniform(-0.8, 0.8, n), bs=rng.uniform(0.6, 1.4, n),
            corner=rng.randint(0, 4, n),
        )

    def cam(self, t):
        """完成に向けて、ほんの少しカメラが寄っていく。"""
        return 1 + 0.035 * _ss(8.6, 11.2, t)

    def to_screen(self, px, py, cam):
        return self.Cx + cam * (self.X0 + px - self.Cx), self.Cy + cam * (self.Y0 + py - self.Cy)

    def _scatter(self, i, t):
        P = self.pp
        dt = t - self.sched["appear"][i]
        e = _eo(dt / 1.8)
        x = self.Cx + (P["Sx"][i] - self.Cx) * e + P["vx"][i] * dt + P["ax"][i] * math.sin(TAU * P["sf"][i] * dt + P["sp"][i])
        y = self.Cy + (P["Sy"][i] - self.Cy) * e + P["vy"][i] * dt + P["ay"][i] * math.sin(TAU * P["sf"][i] * 0.8 * dt + P["sp2"][i])
        ang = P["a0"][i] + P["om"][i] * dt + P["spin"][i] * (1 - e)
        sc = P["s"][i] * (0.3 + 0.7 * e)
        sx = 1 - P["tilt"][i] * (0.5 - 0.5 * math.cos(TAU * P["tf"][i] * dt + P["tp"][i]))
        tint = 0.6 + 0.4 * (P["s"][i] - 0.55) / 0.4
        return x, y, ang, sc, sx, _ss(0, 0.45, dt), tint

    def piece_state(self, i, t, cam):
        S, P = self.sched, self.pp
        p = self.pieces[i]
        tx, ty = self.to_screen(p["cx"], p["cy"], cam)
        ts, tl = S["start"][i], S["land"][i]
        if t < ts:
            x, y, ang, sc, sx, alpha, tint = self._scatter(i, t)
            halo = 0.42
        elif t < tl:
            ev = _eio((t - ts) / (tl - ts))
            x, y, ang, sc, sx, alpha, tint = self._scatter(i, t)
            x_s, y_s, ang_s = self._scatter(i, ts)[:3]
            dx, dy = tx - x_s, ty - y_s
            ln = math.hypot(dx, dy) + 1e-6
            bow = P["arc"][i] * math.sin(math.pi * ev)
            x += (tx - x) * ev - dy / ln * bow
            y += (ty - y) * ev + dx / ln * bow
            ang += (TAU * round(ang_s / TAU) - ang) * ev
            sc += (cam - sc) * ev
            sx += (1 - sx) * ev
            tint += (1 - tint) * ev
            halo = 0.42 * (1 - ev)
        else:
            x, y, ang, sc, sx, alpha, tint = tx, ty, 0.0, cam, 1.0, 1.0, 1.0
            halo = 1.1 * math.exp(-(t - tl) / 0.14)

        tb = T.DAWN + 0.1          # 朝の光の中で、ピースがほどけていく
        if t > tb:
            w = _c01((t - tb) / (T.FLASH - tb))
            e = w * w * P["bs"][i]
            x += ((tx - self.Cx) * 0.45 + math.cos(P["bd"][i]) * 90 * self.k) * e
            y += ((ty - self.Cy) * 0.45 + math.sin(P["bd"][i]) * 90 * self.k) * e
            ang += P["br"][i] * e
            sc *= 1 + 0.12 * e
            halo += 0.7 * e
            alpha *= 1 - _ss(0.7, 1.0, w)
        return x, y, ang, sc, sx, alpha, tint, halo

    # ---- 各レイヤー ------------------------------------------------------

    def background(self, t):
        w = _ss(T.FLASH - 0.1, T.FLASH + 0.3, t)
        f = self.bg_night.copy() if w <= 0 else self.bg_night * (1 - w) + self.bg_dawn * w
        amp = (0.55 + 0.3 * _ss(3.0, 4.2, t) - 0.25 * _ss(8.8, 9.6, t)) * (1 - 0.45 * w)
        lo = np.zeros(self.neb_x.shape + (3,), np.float32)
        for b in self.blobs:
            bx = b["x"] + b["vx"] * t + b["ax"] * math.sin(TAU * b["fr"] * t + b["ph"])
            by = b["y"] + b["vy"] * t + b["ay"] * math.cos(TAU * b["fr"] * 0.7 * t + b["ph"])
            d2 = (self.neb_x - bx) ** 2 + (self.neb_y - by) ** 2
            lo += np.exp(-d2 / (2 * b["r"] ** 2))[..., None] * b["col"]
        lo *= amp
        for c in range(3):
            f[..., c] += np.asarray(Image.fromarray(np.ascontiguousarray(lo[..., c])).resize((self.W, self.H), Image.BICUBIC))
        return f

    def draw_dust(self, f, t):
        D = self.dust
        amp = 1.0 - 0.3 * _ss(9.0, 9.6, t) * (1 - _ss(T.FLASH, T.FLASH + 0.5, t)) - 0.35 * _ss(T.FLASH, T.FLASH + 0.5, t)
        span = self.H + 40 * self.k
        for i in range(len(D["x"])):
            y = (D["y"][i] + D["vy"][i] * t) % span - 20 * self.k
            x = D["x"][i] + D["sa"][i] * math.sin(TAU * D["sf"][i] * t + D["sp"][i])
            b = D["b"][i] * (0.6 + 0.4 * math.sin(TAU * D["tf"][i] * t + D["tp"][i])) * amp
            splat(f, x, y, D["sig"][i], D["sig"][i], D["col"][i] * b)

    def draw_chars(self, f, chars, cx, cy, env, col=hexrgb("#f4effe"), glow_col=hexrgb("#a99cff")):
        for i, c in enumerate(chars):
            sharp, soft, glow, ox, oy, rot = env(i)
            if max(sharp, soft, glow) < 0.003:
                continue
            x, y = cx + c["dx"] + ox, cy + oy
            for img, a, mode in ((c["glow"], glow * c["gpeak"], "add"), (c["soft"], soft, "over"), (c["sharp"], sharp, "over")):
                if a < 0.003:
                    continue
                res = transform(img, self.W, self.H, x, y, rot)
                if res is None:
                    continue
                m, x0, y0 = res
                reg = _region(f, *m.shape, x0, y0)
                if reg is None:
                    continue
                fs, ms = reg
                mm = (m[ms] * a)[..., None]
                if mode == "add":
                    f[fs] += mm * glow_col
                else:
                    f[fs] *= 1 - mm
                    f[fs] += mm * col

    @staticmethod
    def _text_env(t, start, dur, out_start, out_dur, drift, k):
        p = _c01((t - start) / dur)
        e = _eo(p)
        q = 1 - _c01((t - out_start) / out_dur)
        sharp = e ** 1.5 * q ** 2.2
        soft = 0.85 * min(1, 3 * p) * (1 - e) * q + 1.1 * q * (1 - q)
        glow = (0.5 * e + 0.25 * min(1, 3 * p) * (1 - e)) * q ** 0.6 + 0.6 * q * (1 - q)
        u = (1 - q) ** 1.5
        return sharp, soft, glow, drift[0] * u, drift[1] * u + 8 * k * (1 - e), 0.0

    def draw_title(self, f, t):
        if t > T.TITLE_OUT + 1.2:
            return
        k = self.k

        def env1(i):
            dur = 0.9 if i == 0 else 0.6
            return self._text_env(t, T.TITLE1_STARTS[i], dur, T.TITLE_OUT + 0.05 * i, 0.7, self.title_drift[i], k)

        def env2(i):
            return self._text_env(t, T.TITLE2_START + T.TITLE2_STEP * i, 0.75,
                                  T.TITLE_OUT + 0.12 + 0.03 * i, 0.65, self.title_drift[10 + i], k)

        self.draw_chars(f, self.title1, self.Cx, 0.435 * self.H, env1)
        self.draw_chars(f, self.title2, self.Cx, 0.565 * self.H, env2)

    def draw_puzzle(self, f, t):
        if t < T.SCATTER or t > T.FLASH + 0.05:
            return
        cam = self.cam(t)
        S = self.sched
        halo_col = hexrgb("#b8a4ff")
        states = []
        for i in range(len(self.pieces)):
            if t < S["appear"][i]:
                continue
            st = self.piece_state(i, t, cam)
            key = (0, S["land"][i]) if t >= S["land"][i] else (1, st[3])
            states.append((key, i, st))
        states.sort(key=lambda s: s[0])

        for _, i, (x, y, ang, sc, sx, alpha, tint, halo) in states:
            p = self.pieces[i]
            if alpha < 0.003:
                continue
            if halo * alpha > 0.01:
                res = transform(p["halo"], self.W, self.H, x, y, ang, sc, sx)
                if res is not None:
                    m, x0, y0 = res
                    reg = _region(f, *m.shape, x0, y0)
                    if reg:
                        f[reg[0]] += (m[reg[1]] * (0.55 * halo * alpha))[..., None] * halo_col
            res = transform(p["sprite"], self.W, self.H, x, y, ang, sc, sx)
            if res is None:
                continue
            a, x0, y0 = res
            reg = _region(f, *a.shape[:2], x0, y0)
            if reg:
                fs, ms = reg
                aa = a[ms]
                f[fs] *= 1 - aa[..., 3:4] * alpha
                f[fs] += aa[..., :3] * (alpha * tint)

        # 完成：継ぎ目が溶けて、一枚の絵になる
        ac = _ss(T.COMPLETE, T.COMPLETE + 0.45, t) * (1 - _ss(T.DAWN + 0.06, T.DAWN + 0.2, t))
        if ac > 0:
            cx, cy = self.to_screen(self.PW / 2, self.PH / 2, cam)
            res = transform(self.dream_sprite, self.W, self.H, cx, cy, 0.0, cam)
            if res is not None:
                a, x0, y0 = res
                reg = _region(f, *a.shape[:2], x0, y0)
                if reg:
                    fs, ms = reg
                    aa = a[ms]
                    f[fs] *= 1 - aa[..., 3:4] * ac
                    f[fs] += aa[..., :3] * ac
            self.draw_life(f, t, cam, ac)

        # はまった瞬間のきらめき
        for i in range(len(self.pieces)):
            age = t - S["land"][i]
            if 0 <= age < 0.6:
                p = self.pieces[i]
                c = self.pp["corner"][i]
                px = p["cx"] + (self.cw / 2 if c & 1 else -self.cw / 2)
                py = p["cy"] + (self.ch / 2 if c & 2 else -self.ch / 2)
                x, y = self.to_screen(px, py, cam)
                glint(f, x, y, self.k, hexrgb("#fff5ff") * 0.9 * math.exp(-age / 0.16))

    def draw_life(self, f, t, cam, ac):
        """完成した絵の中で、星や灯籠や海がきらめく。"""
        k = self.k
        for x, y, b, r, fr, ph in self.tw_stars:
            tw = max(0.0, math.sin(TAU * fr * t + ph)) ** 6 * b
            if tw > 0.05:
                sx, sy = self.to_screen(x, y, cam)
                glint(f, sx, sy, k * (0.5 + 0.25 * r), hexrgb("#ffffff") * 0.55 * tw * ac)
        for x, y, s, p1, p2 in self.tw_lanterns:
            fl = 0.10 + 0.07 * math.sin(13 * t + p1) + 0.05 * math.sin(29 * t + p2)
            sx, sy = self.to_screen(x, y, cam)
            splat(f, sx, sy, 10 * k * s, 10 * k * s, hexrgb("#ff9a52") * fl * ac)
        for x, y, b, fr, ph in self.tw_glitter:
            tw = max(0.0, math.sin(TAU * fr * t + ph)) ** 10 * b
            if tw > 0.05:
                sx, sy = self.to_screen(x, y, cam)
                glint(f, sx, sy, 0.6 * k, hexrgb("#fff1dc") * 0.8 * tw * ac)
        # 完成の瞬間、光の帯が絵の上をすっと流れる
        u = (t - T.COMPLETE - 0.05) / 0.8
        if 0 < u < 1:
            x0, y0 = (int(v) for v in self.to_screen(0, 0, cam))
            x1, y1 = (int(v) for v in self.to_screen(self.PW, self.PH, cam))
            x0, y0, x1, y1 = max(0, x0), max(0, y0), min(self.W, x1), min(self.H, y1)
            gx = (np.arange(x1 - x0, dtype=np.float32) / (x1 - x0))[None, :]
            gy = (np.arange(y1 - y0, dtype=np.float32) / (y1 - y0))[:, None]
            pos = -0.3 + 1.8 * _eio(u)
            band = np.exp(-((gx * 0.85 + gy * 0.35 - pos) / 0.07) ** 2) * (0.20 * math.sin(math.pi * u) * ac)
            f[y0:y1, x0:x1] += band[..., None] * hexrgb("#fff2e6")

    def light_amount(self, t):
        if t < T.DAWN:
            return 0.0
        if t < T.FLASH:
            return 0.97 * ((t - T.DAWN) / (T.FLASH - T.DAWN)) ** 2.3
        if t < T.FLASH + 0.12:
            return 0.97 + 0.03 * (t - T.FLASH) / 0.12
        u = (t - T.FLASH - 0.12) / 0.9
        return 0.0 if u >= 1 else (1 - u) ** 2.8

    def draw_morning(self, f, t):
        L = self.light_amount(t)
        if L <= 0:
            return
        if t < T.FLASH:
            uni = _ss(T.DAWN + 0.35, T.FLASH, t)
        else:
            uni = 1 - _c01((t - T.FLASH - 0.12) * 1.2)
        field = self.sun_field * (1 - uni) + uni
        col = self.gold + (self.warm - self.gold) * L * L   # 弱い光は金色、満ちると白
        a = np.clip(L * field, 0, 1)
        f += col * (a * (1 - a))       # まず絵ごと光らせてから
        f += (col - f) * (a * a)       # 光で満たしていく

    def draw_dream_dust(self, f, t):
        dt = t - T.FLASH
        if dt < 0 or dt > 2.6:
            return
        D = self.ddust
        for i in range(len(D["x"])):
            a = D["b"][i] * (1 - _ss(0.2, D["fade"][i], dt))
            if a < 0.01:
                continue
            g = D["tau"][i] * (1 - math.exp(-dt / D["tau"][i]))
            x = D["x"][i] + D["vx"][i] * g
            y = D["y"][i] + D["vy"][i] * g - 10 * self.k * dt
            a *= 0.75 + 0.25 * math.sin(TAU * D["tf"][i] * t + D["tp"][i])
            splat(f, x, y, D["sig"][i], D["sig"][i], D["col"][i] * a)

    def draw_ending(self, f, t):
        if t < T.ENDING_TEXT:
            return
        k = self.k

        def env(i):
            return self._text_env(t, T.ENDING_TEXT + 0.07 * i, 0.95, 13.75 + 0.035 * i, 0.8,
                                  self.title_drift[25 + i], k)

        self.draw_chars(f, self.ending, self.Cx, 0.645 * self.H, env)

    def draw_word(self, f, t):
        """淡く透ける DREAM が、ふわふわと漂う。"""
        a_in = _ss(T.DREAM_IN, T.DREAM_IN + 1.4, t)
        A = a_in * (1 - _ss(T.DREAM_OUT, T.DURATION - 0.02, t))
        if A <= 0:
            return
        k = self.k
        prog = (t - T.DREAM_IN) / (T.DURATION - T.DREAM_IN)
        spread = 1 + 0.015 * math.sin(TAU * t / 4.0)

        def env(i):
            ph = self.word_phase[i]
            dy = 12 * k * math.sin(TAU * t / 3.6 + ph[0]) + 4 * k * math.sin(TAU * t / 2.1 + ph[1]) + 18 * k * (1 - a_in)
            dx = 5 * k * math.sin(TAU * t / 4.3 + ph[2]) + (14 * prog - 7) * k + self.word[i]["dx"] * (spread - 1)
            sh = A * (0.85 + 0.15 * math.sin(TAU * t / 1.7 + ph[4]))
            return 0.17 * sh, 0.0, 0.22 * sh, dx, dy, 0.02 * math.sin(TAU * t / 5 + ph[3])

        self.draw_chars(f, self.word, self.Cx, 0.45 * self.H, env,
                        col=hexrgb("#efeaff"), glow_col=hexrgb("#b9a8ff"))

    # ---- 1フレーム -------------------------------------------------------

    def frame(self, t, index=0):
        f = self.background(t)
        self.draw_dust(f, t)
        self.draw_title(f, t)
        self.draw_puzzle(f, t)
        self.draw_morning(f, t)
        self.draw_dream_dust(f, t)
        self.draw_ending(f, t)
        f *= 1 - _ss(14.0, 14.85, t)
        self.draw_word(f, t)
        f *= _ss(0.0, 0.6, t)
        f *= self.vignette
        f += np.random.default_rng(index).standard_normal((self.H, self.W), np.float32)[..., None] * 0.0045
        f = np.where(f > 0.8, 0.8 + 0.2 * np.tanh((f - 0.8) / 0.2), f)
        return (np.clip(f, 0, 1) * 255 + 0.5).astype(np.uint8)


# ---- 書き出し ------------------------------------------------------------

_R = None


def _init(*args):
    global _R
    _R = Renderer(*args)


def _frame(i):
    return _R.frame(i / T.FPS, i).tobytes()


def main():
    global _R
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description="夢の15秒ムービーを生成する")
    ap.add_argument("--out", default=os.path.join(here, "..", "output", "dream.mp4"))
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--font", help="フォントファイル（省略時は Meiryo を自動検出）")
    ap.add_argument("--font-index", type=int, default=0, help=".ttc の中の番号")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 1)
    ap.add_argument("--crf", type=int, default=20)
    ap.add_argument("--stills", type=float, nargs="*", help="指定した秒数の静止画だけ書き出す")
    args = ap.parse_args()

    font_path, font_index, font_name = find_font(args.font, args.font_index)
    print(f"フォント: {font_name} ({font_path})")
    out = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    W, H = args.width, args.height

    if args.stills:
        r = Renderer(W, H, font_path, font_index)
        for t in args.stills:
            p = os.path.join(os.path.dirname(out), f"still_{t:05.2f}.png")
            Image.fromarray(r.frame(t, int(t * T.FPS))).save(p)
            print(p)
        return

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        sys.exit("ffmpeg が見つかりません。インストールしてから実行してください。")

    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "music.wav")
        print("音楽を合成中…")
        music.write_wav(wav, music.synthesize())

        cmd = [ffmpeg, "-y", "-loglevel", "error",
               "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(T.FPS), "-i", "-",
               "-i", wav,
               "-c:v", "libx264", "-preset", "slow", "-crf", str(args.crf), "-pix_fmt", "yuv420p",
               "-x264-params", "aq-mode=3",   # 暗い部分の階調を守る
               "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        n = int(round(T.DURATION * T.FPS))
        t0 = time.time()
        print("映像をレンダリング中…")

        if args.jobs > 1 and sys.platform.startswith("linux"):
            # fork なら下ごしらえ済みのレンダラーを各ワーカーがそのまま使える
            _R = Renderer(W, H, font_path, font_index)
            pool = mp.get_context("fork").Pool(args.jobs)
        elif args.jobs > 1:
            pool = mp.get_context("spawn").Pool(args.jobs, initializer=_init,
                                                initargs=(W, H, font_path, font_index))
        else:
            _R, pool = Renderer(W, H, font_path, font_index), None

        frames = pool.imap(_frame, range(n), chunksize=2) if pool else map(_frame, range(n))
        for i, buf in enumerate(frames):
            proc.stdin.write(buf)
            if (i + 1) % 30 == 0 or i + 1 == n:
                print(f"  {i + 1}/{n} フレーム ({time.time() - t0:.0f}秒)", flush=True)
        if pool:
            pool.close()
            pool.join()
        proc.stdin.close()
        if proc.wait() != 0:
            sys.exit("ffmpeg のエンコードに失敗しました。")
    print(f"できあがり: {out}")


if __name__ == "__main__":
    main()
