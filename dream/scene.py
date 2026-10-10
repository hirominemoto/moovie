"""パズルが組み上がって現れる「夢の一枚絵」をコードで描く。

空を泳ぐクジラ、その背中で灯りのともる小さな家、空を泳ぐ魚たち、
海から昇っていく灯籠、大きな月。
ばらばらの記憶が、ありえない形で組み合わさった景色。
"""
import math

import numpy as np
from PIL import Image, ImageDraw

from common import blur, gradient, hexrgb, smoothstep

SS = 2          # スーパーサンプリング倍率
HORIZON = 0.70  # 水平線の高さ（画面比）


def _catmull_rom(points, samples=14):
    """閉じた Catmull-Rom スプラインで点列をなめらかにつなぐ。"""
    P = np.asarray(points, float)
    n = len(P)
    t = np.linspace(0, 1, samples, endpoint=False)[:, None]
    out = []
    for i in range(n):
        p0, p1, p2, p3 = P[(i - 1) % n], P[i], P[(i + 1) % n], P[(i + 2) % n]
        out.append(0.5 * (2 * p1 + (-p0 + p2) * t
                          + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return np.concatenate(out)


def _mask(w, h, polys, soft=0.5 * SS):
    im = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(im)
    for p in polys:
        d.polygon([tuple(q) for q in np.asarray(p)], fill=255)
    return blur(np.asarray(im, np.float32) / 255, soft)


def _over(img, mask, color, alpha=1.0):
    a = (mask * alpha)[..., None]
    img *= 1 - a
    img += a * color


def _circle(cx, cy, r, n=40):
    a = np.linspace(0, 2 * math.pi, n, endpoint=False)
    return np.stack([cx + r * np.cos(a), cy + r * np.sin(a)], 1)


# クジラの輪郭（x: 0=尾 → 1=頭, y: 下向きが正, 単位は体長）
WHALE_BODY = [
    (1.00, 0.025), (0.975, -0.04), (0.92, -0.095), (0.84, -0.130),
    (0.72, -0.152), (0.58, -0.155), (0.45, -0.140), (0.33, -0.110),
    (0.22, -0.072), (0.13, -0.045), (0.06, -0.100), (0.00, -0.165),
    (0.035, -0.070), (0.07, -0.015), (0.02, 0.055), (0.10, 0.012),
    (0.16, 0.020), (0.26, 0.050), (0.38, 0.090), (0.52, 0.125),
    (0.66, 0.140), (0.80, 0.122), (0.91, 0.085), (0.975, 0.055),
]
WHALE_FIN = [(0.70, 0.12), (0.66, 0.175), (0.60, 0.245), (0.605, 0.195), (0.63, 0.13)]
WHALE_BELLY = [(0.52, 0.125), (0.66, 0.140), (0.80, 0.122), (0.91, 0.085), (0.975, 0.055)]


def paint_dream(pw, ph, seed=11):
    """夢の一枚絵 (ph, pw, 3) と、きらめかせる場所のメタ情報を返す。"""
    w, h = pw * SS, ph * SS
    rng = np.random.RandomState(seed)
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    hz = HORIZON * h

    # ---- 空と海のグラデーション ----------------------------------------
    img = gradient(h, w, [
        (0.00, "#0b1036"), (0.30, "#25246a"), (0.50, "#5a4290"),
        (0.62, "#a46aa8"), (0.695, "#efb9c4"),
        (0.700, "#8a6aa0"), (0.735, "#43397a"), (0.84, "#1b1c4e"), (1.00, "#080a24"),
    ])

    # ---- 星 ----------------------------------------------------------
    star = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(star)
    stars = []
    for _ in range(330):
        u, v = rng.rand(), rng.rand() ** 1.35 * 0.64
        b = rng.uniform(0.25, 1.0)
        r = rng.choice([0.8, 1.2, 1.6, 2.4], p=[0.45, 0.3, 0.17, 0.08]) * SS
        d.ellipse([u * w - r, v * h - r, u * w + r, v * h + r], fill=int(255 * b))
        stars.append((u * pw, v * ph, b, r / SS))
    s = np.asarray(star, np.float32) / 255
    img += (blur(s, 0.8 * SS) * 1.8 + blur(s, 5 * SS) * 0.9)[..., None] * hexrgb("#fff4fb")

    # ---- 月 ----------------------------------------------------------
    mx, my, R = 0.79 * w, 0.21 * h, 0.058 * w
    dd = np.sqrt((X - mx) ** 2 + (Y - my) ** 2)
    glow = 0.42 * np.exp(-(dd / (1.7 * R)) ** 2) + 0.22 * np.exp(-(dd / (4.5 * R)) ** 2)
    img += glow[..., None] * hexrgb("#ffd9ea")
    shade = 1 - 0.10 * (dd / R) ** 2
    for cu, cv, cr, a in [(-0.3, -0.2, 0.22, 0.07), (0.25, 0.15, 0.30, 0.06),
                          (0.1, -0.45, 0.14, 0.05), (-0.42, 0.32, 0.16, 0.05)]:
        shade *= 1 - a * np.exp(-((X - mx - cu * R) ** 2 + (Y - my - cv * R) ** 2) / (cr * R) ** 2)
    disc = np.clip((R - dd) / SS + 0.5, 0, 1)[..., None]
    img = img * (1 - disc) + hexrgb("#fff6e4") * shade[..., None] * disc

    # ---- 雲（月にかかる薄雲と、水平線のちぎれ雲） ------------------------
    cloud = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(cloud)
    for _ in range(6):
        cx, cy = rng.uniform(0.62, 0.98) * w, rng.uniform(0.235, 0.30) * h
        rx = rng.uniform(0.05, 0.10) * w
        d.ellipse([cx - rx, cy - rx * 0.07, cx + rx, cy + rx * 0.07], fill=170)
    for _ in range(26):
        cx, cy = rng.uniform(-0.05, 1.05) * w, rng.uniform(0.53, 0.665) * h
        rx = rng.uniform(0.06, 0.16) * w
        ry = rx * rng.uniform(0.10, 0.22)
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=int(rng.uniform(110, 255)))
    _over(img, blur(np.asarray(cloud, np.float32) / 255, 14 * SS), hexrgb("#f0b8d6"), 0.45)

    # ---- 海のさざなみと、月の光の道 ------------------------------------
    rip = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(rip)
    for k in range(140):
        f = k / 140
        y = hz + f ** 1.7 * (h - hz) + rng.uniform(-2, 2) * SS
        for _ in range(rng.randint(2, 7)):
            x0 = rng.uniform(0, w)
            ln = rng.uniform(0.02, 0.12) * w * (0.4 + f)
            d.line([(x0, y), (x0 + ln, y)], fill=int(rng.uniform(30, 90)),
                   width=max(1, int(SS * (0.6 + f * 1.4))))
    img += blur(np.asarray(rip, np.float32) / 255, 0.8 * SS)[..., None] * hexrgb("#b9a3e0") * 0.35

    ref = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(ref)
    glitter = []
    y = hz + 2 * SS
    while y < h:
        f = (y - hz) / (h - hz)
        half = (0.006 + 0.05 * f) * w * rng.uniform(0.3, 1.0)
        xc = mx + rng.uniform(-0.012, 0.012) * w * (0.3 + f)
        b = 0.95 * math.exp(-f / 0.45) * rng.uniform(0.45, 1.0)
        d.line([(xc - half, y), (xc + half, y)], fill=int(255 * b),
               width=max(1, int(SS * (0.8 + 1.6 * f))))
        if rng.rand() < 0.4:
            glitter.append(((xc + rng.uniform(-half, half)) / SS, y / SS, b))
        y += SS * (1.5 + 7 * f) * rng.uniform(0.6, 1.4)
    rf = np.asarray(ref, np.float32) / 255
    img += (blur(rf, 0.9 * SS) * 1.3 + blur(rf, 6 * SS) * 0.6)[..., None] * hexrgb("#ffe7cf")

    rows = (np.arange(h) + 0.5)[:, None, None]
    img += np.exp(-((rows - hz) / (0.006 * h)) ** 2) * hexrgb("#ffd3dc") * 0.38

    # ---- 海から昇る灯籠 ------------------------------------------------
    lanterns = [(0.10, 0.60, 1.0), (0.17, 0.50, 0.75), (0.25, 0.655, 0.6),
                (0.83, 0.56, 0.95), (0.93, 0.64, 0.65), (0.66, 0.62, 0.7),
                (0.56, 0.675, 0.5), (0.06, 0.36, 0.55), (0.95, 0.40, 0.6),
                (0.72, 0.47, 0.45)]
    body = Image.new("L", (w, h), 0)
    core = Image.new("L", (w, h), 0)
    db, dc = ImageDraw.Draw(body), ImageDraw.Draw(core)
    for u, v, s in lanterns:
        cx, cy, sz = u * w, v * h, 0.014 * w * s
        top, bot, hh = 0.50 * sz, 0.36 * sz, 1.25 * sz
        db.polygon([(cx - top, cy - hh / 2), (cx + top, cy - hh / 2),
                    (cx + bot, cy + hh / 2), (cx - bot, cy + hh / 2)], fill=255)
        dc.ellipse([cx - bot * 0.8, cy + hh / 2 - 0.25 * sz, cx + bot * 0.8, cy + hh / 2 + 0.12 * sz], fill=255)
    lb = blur(np.asarray(body, np.float32) / 255, 0.5 * SS)
    lc = blur(np.asarray(core, np.float32) / 255, 1.5 * SS)
    img += (blur(lb, 7 * SS) * 1.4 + blur(lb, 26 * SS) * 1.2)[..., None] * hexrgb("#ff9a52")
    _over(img, lb, hexrgb("#ffb86e"))
    img += lc[..., None] * hexrgb("#fff1c4")

    # ---- 空を泳ぐクジラと、背中の家 ------------------------------------
    L, wcx, wcy = 0.50 * w, 0.385 * w, 0.43 * h
    th = math.radians(-8)
    ct, st = math.cos(th), math.sin(th)

    def T(pts):
        p = np.asarray(pts, float)
        lx, ly = (p[:, 0] - 0.5) * L, p[:, 1] * L
        return np.stack([wcx + lx * ct - ly * st, wcy + lx * st + ly * ct], 1)

    def rect(x0, y0, x1, y1):
        return T([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])

    wm = _mask(w, h, [T(_catmull_rom(WHALE_BODY, 16))])
    lx = ((X - wcx) * ct + (Y - wcy) * st) / L + 0.5
    ly = (-(X - wcx) * st + (Y - wcy) * ct) / L
    g = smoothstep(-0.10, 0.13, ly)[..., None]
    col = hexrgb("#171a45") * (1 - g) + hexrgb("#4a4a86") * g
    col += (0.05 * np.clip(lx, 0, 1))[..., None]
    img *= 1 - wm[..., None]
    img += col * wm[..., None]

    groove = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(groove)
    bx, by = zip(*WHALE_BELLY)
    for k in range(5):
        xs = np.linspace(0.62, 0.95, 24)
        ys = np.interp(xs, bx, by) - 0.014 * (k + 1)
        d.line([tuple(q) for q in T(np.stack([xs, ys], 1))], fill=255, width=int(1.2 * SS))
    img += (blur(np.asarray(groove, np.float32) / 255, 0.6 * SS) * wm)[..., None] * hexrgb("#7c78b8") * 0.35

    fin = _mask(w, h, [T(_catmull_rom(WHALE_FIN, 10))])
    _over(img, fin, hexrgb("#23255a"))

    mouth = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mouth).line([tuple(q) for q in T([(0.99, 0.035), (0.93, 0.05), (0.86, 0.055)])],
                               fill=255, width=int(1.4 * SS))
    _over(img, blur(np.asarray(mouth, np.float32) / 255, 0.5 * SS), hexrgb("#10123a"), 0.8)
    ex, ey = T([(0.875, 0.022)])[0]
    _over(img, _mask(w, h, [_circle(ex, ey, 0.0075 * L)]), hexrgb("#0b0d25"))
    _over(img, _mask(w, h, [_circle(ex + 0.002 * L, ey - 0.002 * L, 0.0025 * L)]), hexrgb("#d8d4ff"), 0.8)

    # 背中の家と木
    chimney = _mask(w, h, [rect(0.515, -0.228, 0.527, -0.200)])
    walls = _mask(w, h, [rect(0.465, -0.192, 0.535, -0.140)])
    roof = _mask(w, h, [T([(0.455, -0.190), (0.545, -0.190), (0.50, -0.232)])])
    trunk = _mask(w, h, [rect(0.598, -0.178, 0.606, -0.140)])
    leaves = _mask(w, h, [T(_circle(0.602, -0.198, 0.026)), T(_circle(0.584, -0.184, 0.017))])
    window = _mask(w, h, [rect(0.488, -0.178, 0.512, -0.157)])
    for m, c in [(chimney, "#1c1f4b"), (walls, "#2b2e63"), (roof, "#1c1f4b"),
                 (trunk, "#1a1d46"), (leaves, "#1e2352")]:
        _over(img, m, hexrgb(c))
    img += (blur(window, 6 * SS) * 1.5 + blur(window, 22 * SS) * 1.2)[..., None] * hexrgb("#ffb766")
    _over(img, window, hexrgb("#ffe2a0"))
    smoke = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(smoke)
    for j, (sx, sy, sr) in enumerate([(0.523, -0.245, 0.007), (0.530, -0.262, 0.010), (0.540, -0.282, 0.013)]):
        (px, py), = T([(sx, sy)])
        d.ellipse([px - sr * L, py - sr * L, px + sr * L, py + sr * L], fill=200 - 50 * j)
    _over(img, blur(np.asarray(smoke, np.float32) / 255, 3 * SS), hexrgb("#c9bdf0"), 0.35)

    # 月の側から当たるリムライト
    union = np.clip(wm + fin + walls + roof + chimney + trunk + leaves, 0, 1)
    sh = int(3 * SS)
    rim = np.clip(union - np.roll(union, (sh, -sh), axis=(0, 1)), 0, 1)
    img += blur(rim, 0.8 * SS)[..., None] * hexrgb("#ffd6ea") * 0.75

    # ---- 空を泳ぐ魚の群れ ----------------------------------------------
    fish = [(0.735, 0.46, 1.0, -8), (0.77, 0.42, 0.8, -12), (0.80, 0.49, 0.9, -5),
            (0.835, 0.44, 0.7, -10), (0.70, 0.52, 0.6, -4), (0.86, 0.51, 0.65, -9)]
    a = np.linspace(0, 2 * math.pi, 28, endpoint=False)
    fbody = np.stack([0.5 * np.cos(a), 0.19 * np.sin(a)], 1)
    ftail = np.array([(-0.42, 0.0), (-0.78, -0.22), (-0.66, 0.0), (-0.78, 0.22)])
    polys = []
    for u, v, s, ang in fish:
        size, r = 0.016 * w * s, math.radians(ang)
        rot = np.array([[math.cos(r), -math.sin(r)], [math.sin(r), math.cos(r)]])
        for shape in (fbody, ftail):
            polys.append(shape @ rot.T * size + (u * w, v * h))
    fm = _mask(w, h, polys)
    img += (blur(fm, 6 * SS) * 1.4 + blur(fm, 20 * SS) * 0.8)[..., None] * hexrgb("#7fd6ff")
    _over(img, fm, hexrgb("#dff7ff"), 0.9)

    # ---- 縮小して仕上げ ------------------------------------------------
    img = np.clip(img, 0, 1).reshape(ph, SS, pw, SS, 3).mean(axis=(1, 3)).astype(np.float32)
    meta = {
        "stars": stars,
        "glitter": glitter,
        "lanterns": [(u * pw, v * ph, s) for u, v, s in lanterns],
        "moon": (mx / SS, my / SS, R / SS),
    }
    return img, meta
