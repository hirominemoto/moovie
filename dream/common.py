"""色・ぼかし・イージングなどの小道具。"""
import numpy as np


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0


def clamp01(x):
    return np.clip(x, 0.0, 1.0)


def smoothstep(a, b, x):
    t = clamp01((x - a) / (b - a))
    return t * t * (3 - 2 * t)


def ease_out_cubic(t):
    t = clamp01(t)
    return 1 - (1 - t) ** 3


def ease_in_out_cubic(t):
    t = clamp01(t)
    return np.where(t < 0.5, 4 * t ** 3, 1 - (-2 * t + 2) ** 3 / 2)


def _box_blur(a, r, axis):
    if r < 1:
        return a
    a = np.moveaxis(a, axis, 0)
    n = a.shape[0]
    pad = [(r + 1, r)] + [(0, 0)] * (a.ndim - 1)
    c = np.cumsum(np.pad(a, pad), axis=0, dtype=np.float64)
    out = (c[2 * r + 1:2 * r + 1 + n] - c[:n]) / (2 * r + 1)
    return np.moveaxis(out.astype(np.float32), 0, axis)


def blur(a, sigma):
    """箱ぼかし3回でガウスぼかしを近似する（float配列用）。"""
    if sigma <= 0.3:
        return a.astype(np.float32)
    r = max(1, int(round((np.sqrt(4 * sigma * sigma + 1) - 1) / 2)))
    out = a.astype(np.float32)
    for axis in (0, 1):
        for _ in range(3):
            out = _box_blur(out, r, axis)
    return out


def gradient(h, w, stops):
    """縦方向のグラデーション。stops は [(位置0-1, '#rrggbb'), ...]。"""
    v = (np.arange(h) + 0.5) / h
    pos = [s[0] for s in stops]
    cols = np.array([hexrgb(s[1]) for s in stops])
    col = np.stack([np.interp(v, pos, cols[:, c]) for c in range(3)], -1)
    return np.repeat(col[:, None, :], w, axis=1).astype(np.float32)
