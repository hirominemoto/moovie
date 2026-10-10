"""一枚絵をジグソーパズルのピースに切り分ける。"""
import math

import numpy as np
from PIL import Image, ImageDraw

from common import blur


def _bezier(p0, p1, p2, p3, n=20):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


def _tab_curve(rng):
    """辺1本ぶんの凸凹（0→1 の区間, y は辺に垂直な向き）。"""
    t = rng.uniform(0.095, 0.11)
    a, b, c, d, e = rng.uniform(-0.035, 0.035, 5)
    P = np.array([
        (0, 0), (0.2, a), (0.5 + b + d, -t + c), (0.5 - t + b, t + c),
        (0.5 - 2 * t + b - d, 3 * t + c), (0.5 + 2 * t + b - d, 3 * t + c),
        (0.5 + t + b, t + c), (0.5 + b + d, -t + c), (0.8, e), (1, 0),
    ])
    pts = np.concatenate([_bezier(*P[0:4]), _bezier(*P[3:7])[1:], _bezier(*P[6:10])[1:]])
    pts[:, 1] *= rng.choice([-1, 1])
    return pts


def cut_pieces(img, cols, rows, seed=3, k=1.0):
    """img (ph, pw, 3) を cols×rows に切り分け、ピースのスプライトを返す。

    sprite は乗算済みアルファの RGBA、halo はピースの周りに灯る光（L）。
    """
    ph, pw = img.shape[:2]
    cw, ch = pw // cols, ph // rows
    rng = np.random.RandomState(seed)

    horiz = {(r, c): _tab_curve(rng) * (cw, ch) + (c * cw, r * ch)
             for r in range(1, rows) for c in range(cols)}
    vert = {(c, r): _tab_curve(rng)[:, ::-1] * (cw, ch) + (c * cw, r * ch)
            for c in range(1, cols) for r in range(rows)}

    halo_sigma = 9 * k
    m = int(math.ceil(0.40 * max(cw, ch) + 3 * halo_sigma)) + 2
    sw, sh = cw + 2 * m, ch + 2 * m
    padded = np.pad(img, ((m, m), (m, m), (0, 0)))
    bevel = max(1, int(round(2 * k)))
    Q = 4

    pieces = []
    for r in range(rows):
        for c in range(cols):
            x0, x1, y0, y1 = c * cw, (c + 1) * cw, r * ch, (r + 1) * ch
            top = horiz[(r, c)] if r > 0 else np.array([(x0, y0), (x1, y0)])
            right = vert[(c + 1, r)] if c < cols - 1 else np.array([(x1, y0), (x1, y1)])
            bottom = horiz[(r + 1, c)][::-1] if r < rows - 1 else np.array([(x1, y1), (x0, y1)])
            left = vert[(c, r)][::-1] if c > 0 else np.array([(x0, y1), (x0, y0)])
            poly = np.concatenate([top, right, bottom, left]) - (x0 - m, y0 - m)

            im = Image.new("L", (sw * Q, sh * Q), 0)
            ImageDraw.Draw(im).polygon([tuple(p) for p in poly * Q], fill=255)
            mask = np.asarray(im.resize((sw, sh), Image.BOX), np.float32) / 255

            content = padded[y0:y0 + sh, x0:x0 + sw].copy()
            # 左上を明るく、右下を暗くして、厚みのあるピースに見せる
            hl = blur(np.clip(mask - np.roll(mask, (bevel, bevel), (0, 1)), 0, 1), 0.7 * k)
            sd = blur(np.clip(mask - np.roll(mask, (-bevel, -bevel), (0, 1)), 0, 1), 0.7 * k)
            content += hl[..., None] * 0.40 * (1 - content)
            content *= 1 - 0.38 * sd[..., None]

            rgba = np.dstack([content * mask[..., None], mask])
            sprite = Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8))
            halo = blur(mask, halo_sigma)
            halo_img = Image.fromarray((np.clip(halo / halo.max(), 0, 1) * 255 + 0.5).astype(np.uint8))
            pieces.append({
                "col": c, "row": r,
                "sprite": sprite, "halo": halo_img,
                "cx": x0 + cw / 2, "cy": y0 + ch / 2,
            })
    return pieces, (cw, ch)
