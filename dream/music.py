"""幻想的なBGMを numpy だけで合成する。

- やわらかいシンセ・パッド（Dmaj9 → Bm9 → Gmaj9#11 → Dmaj9）
- オルゴール/チェレスタ風の FM ベル
- ピースがはまるたびに上昇していくきらめき
- 朝の光の直前の上昇音と、夢が消える瞬間の静寂
- 最後は合成した残響（リバーブ）で余韻を残す

単体でも実行でき、`python music.py out.wav` で音だけ書き出せる。
"""
import math
import sys
import wave

import numpy as np

import timeline as T

SR = T.SAMPLE_RATE
N = int(round(T.DURATION * SR))
TAU = 2 * math.pi
NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5,
        "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(name):
    midi = 12 * (int(name[-1]) + 1) + NOTE[name[:-1]]
    return 440.0 * 2 ** ((midi - 69) / 12)


def _smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def _place(bus, start, sig):
    i = int(round(start * SR))
    if i >= N:
        return
    j0 = max(0, -i)
    i = max(0, i)
    n = min(len(sig) - j0, N - i)
    if n > 0:
        bus[i:i + n] += sig[j0:j0 + n]


def _pan(mono, pan):
    th = (pan + 1) * math.pi / 4
    return np.stack([mono * math.cos(th), mono * math.sin(th)], 1)


# ---- 音色 --------------------------------------------------------------

def pad_note(freq, dur, rng, bright=1.0):
    """少しずつずらした倍音の重なりで作る、ふくよかなパッド。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for ch in range(2):
        for cents in (-7, 0, 7):
            f = freq * 2 ** ((cents + rng.uniform(-2, 2)) / 1200)
            for h in range(1, 8):
                if f * h > 8000:
                    break
                amp = math.exp(-(h - 1) * 0.5 / bright) / h
                out[:, ch] += amp * np.sin(TAU * f * h * t + rng.uniform(0, TAU))
    lfo = 1 + 0.12 * np.sin(TAU * rng.uniform(0.15, 0.3) * t + rng.uniform(0, TAU))
    return out * (lfo / 5.0)[:, None]


def bell(freq, dur=3.0, bright=1.0, decay=None):
    """FM合成のベル。オルゴールとチェレスタの中間くらいの音。"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    tau = decay or 1.1 * (523 / freq) ** 0.35
    env = np.exp(-t / tau) * (1 - np.exp(-t / 0.002)) * (1 - _smooth((t - dur + 0.4) / 0.4))
    index = 1.6 * bright * min(1.0, 1200 / freq) * np.exp(-t / 0.18)   # 高音は控えめにして折り返しノイズを防ぐ
    s = np.sin(TAU * freq * t + index * np.sin(TAU * freq * 3.5 * t)) * env
    s += 0.22 * np.sin(TAU * 2 * freq * t) * np.exp(-t / (tau * 0.45))
    s += 0.07 * np.sin(TAU * 5.04 * freq * t) * np.exp(-t / (tau * 0.15))
    return s


def lowpass_sweep(x, cutoff):
    """カットオフが時間で動くローパス（1次×2段）。"""
    a = 1 - np.exp(-TAU * np.asarray(cutoff) / SR)
    y = np.zeros_like(x)
    for _ in range(2):
        acc = 0.0
        for i in range(len(x)):
            acc += a[i] * (x[i] - acc)
            y[i] = acc
        x = y.copy()
    return y


# ---- 曲の組み立て ------------------------------------------------------

CHORDS = [
    # (開始, 終了, 構成音, アタック, リリース, 明るさ)
    (0.00, 3.70, ["D3", "A3", "C#4", "E4", "F#4"], 1.6, 1.2, 1.0),
    (3.55, 6.10, ["B2", "F#3", "A3", "C#4", "D4"], 0.9, 1.2, 1.0),
    (5.95, 9.20, ["G2", "D3", "F#3", "A3", "B3", "C#4"], 0.9, 1.0, 1.1),
    (9.10, T.FLASH, ["D3", "A3", "E4", "F#4", "C#5"], 0.6, 0.10, 1.3),   # 光とともにぷつりと消える
    (11.65, 13.40, ["G3", "B3", "D4", "F#4", "A4"], 1.2, 1.4, 0.7),
    (13.20, T.DURATION, ["A3", "D4", "E4", "F#4", "C#5"], 1.2, 1.6, 0.7),
]
BASS = [(0.00, 3.70, "D2"), (3.55, 6.10, "B1"), (5.95, 9.20, "G1"), (9.10, T.FLASH, "D2")]


def _envelope(n, attack, sustain, release):
    t = np.arange(n) / SR
    return _smooth(t / attack) * (1 - _smooth((t - sustain) / release))


def synthesize():
    rng = np.random.RandomState(T.SEED)
    pad = np.zeros((N, 2))
    bells = np.zeros((N, 2))
    fx = np.zeros((N, 2))

    # パッドとベース
    for t0, t1, notes, att, rel, bright in CHORDS:
        dur = t1 - t0 + rel
        n = int(dur * SR)
        env = _envelope(n, att, t1 - t0, rel)[:, None]
        for name in notes:
            _place(pad, t0, pad_note(hz(name), dur, rng, bright) * env * 0.16)
    for t0, t1, name in BASS:
        dur = t1 - t0 + 0.6
        n = int(dur * SR)
        t = np.arange(n) / SR
        f = hz(name)
        s = np.sin(TAU * f * t) + 0.3 * np.sin(TAU * 2 * f * t)
        env = _envelope(n, 1.0, t1 - t0, 0.12 if t1 == T.FLASH else 0.6)
        _place(pad, t0, _pan(s * env * 0.07, 0))

    def ring(t0, name, amp, pan=None, **kw):
        p = rng.uniform(-0.6, 0.6) if pan is None else pan
        _place(bells, t0, _pan(bell(hz(name), **kw) * amp, p))

    # オープニング：「夢・・・」で灯るベル
    for t0, name, amp in zip(T.TITLE1_STARTS, ["A5", "E6", "C#6", "A5"], [0.30, 0.15, 0.13, 0.11]):
        ring(t0, name, amp)
    for t0, name, amp in [(1.40, "F#5", 0.20), (2.05, "A5", 0.13), (2.70, "C#6", 0.11)]:
        ring(t0, name, amp)

    # 断片が散らばる：ガラスのような小さな音と、ちぎれた旋律
    sched = T.piece_schedule()
    for t0 in np.sort(sched["appear"])[::4]:
        ring(t0, rng.choice(["F#6", "A6", "B6", "D7", "C#7"]), 0.05, bright=0.4, decay=0.35)
    for t0, name in [(3.90, "B5"), (4.35, "D6"), (4.60, "F#5"), (5.20, "A5"), (5.50, "C#6")]:
        ring(t0, name, rng.uniform(0.14, 0.19))

    # 組み上がる：ピースがはまるたびに G リディアンを駆け上がる
    scale = ["G4", "A4", "B4", "C#5", "D5", "E5", "F#5", "G5", "A5", "B5",
             "C#6", "D6", "E6", "F#6", "G6", "A6", "B6", "C#7", "D7", "E7"]
    order = np.argsort(sched["land"])[::2]
    for j, i in enumerate(order):
        pan = (sched["col"][i] + 0.5) / T.COLS * 1.4 - 0.7
        ring(sched["land"][i], scale[j % len(scale)], 0.09 + 0.05 * j / len(order), pan=pan, decay=0.9)

    # 完成の和音
    for j, name in enumerate(["D5", "A5", "F#6", "D7"]):
        ring(T.COMPLETE + 0.025 * j, name, 0.13, pan=-0.4 + 0.27 * j)

    # エンディング：オルゴールのように、ゆっくり降りてくる
    for t0, name, amp, dec in [(T.ENDING_TEXT, "A5", 0.22, None), (12.55, "F#5", 0.18, None),
                               (13.15, "E5", 0.16, None), (13.85, "D5", 0.20, 2.2)]:
        ring(t0, name, amp, dur=3.5, decay=dec)
    ring(T.DREAM_IN + 0.1, "C#7", 0.05, pan=-0.5)
    ring(T.DREAM_IN + 0.25, "F#7", 0.04, pan=0.5)

    # きらめき（高い音の粒）
    def shimmer(t0, t1, density, amp, fmin=2000, fmax=6000):
        for _ in range(int(density * (t1 - t0))):
            d = rng.uniform(0.08, 0.25)
            n = int(d * SR)
            t = np.arange(n) / SR
            f = math.exp(rng.uniform(math.log(fmin), math.log(fmax)))
            g = np.exp(-0.5 * ((t - d / 2) / (d / 5)) ** 2)
            _place(fx, rng.uniform(t0, t1), _pan(np.sin(TAU * f * t) * g * amp * rng.uniform(0.3, 1), rng.uniform(-0.9, 0.9)))
    shimmer(0.2, 3.0, 6, 0.010)
    shimmer(3.0, 6.0, 12, 0.012)
    shimmer(T.COMPLETE, 10.5, 22, 0.016)
    shimmer(T.DREAM_IN, 14.0, 5, 0.008)

    # 組み上がり開始の「ふわっ」
    n = int(1.0 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    sweep = 300 + 2600 * np.sin(math.pi * t / 1.0) ** 2
    s = lowpass_sweep(noise, sweep) * np.sin(math.pi * t / 1.0) ** 2 * 0.10
    _place(fx, T.ASSEMBLE - 0.35, _pan(s, -0.3))

    # 朝の光：上昇していくノイズと逆再生のベル
    rise = T.FLASH - (T.DAWN - 0.25)
    n = int(rise * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    s = lowpass_sweep(noise, 200 * (9000 / 200) ** (t / rise)) * (t / rise) ** 3 * 0.30
    s *= 1 - _smooth((t - rise + 0.04) / 0.04)      # 最後はプツッとならないよう短く閉じる
    _place(fx, T.DAWN - 0.25, _pan(s, 0.2))
    rev = sum(bell(hz(x), dur=0.95, decay=0.5) for x in ["D6", "F#6", "A6"])[::-1] * 0.10
    _place(fx, T.FLASH - 0.95, _pan(rev, 0))

    # 夢が消える瞬間：明るいベルの束と、空気のゆらぎ
    for name, amp in [("D5", 0.14), ("A5", 0.14), ("D6", 0.12), ("F#6", 0.10), ("A6", 0.08), ("D7", 0.06)]:
        ring(T.FLASH, name, amp, bright=0.7)
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    air = lowpass_sweep(rng.standard_normal(n), 1000 + 7000 * np.exp(-t / 0.3)) * np.exp(-t / 0.35) * 0.18
    air *= _smooth(t / 0.01)
    _place(fx, T.FLASH, _pan(air, 0))
    shimmer(T.FLASH, T.FLASH + 1.2, 18, 0.012)

    # ベルにピンポンディレイ
    mono = bells.sum(1) / 2
    d = int(0.36 * SR)
    delayed = np.zeros_like(bells)
    for k in range(1, 6):
        g = 0.30 * 0.55 ** (k - 1)
        sh = np.zeros(N)
        sh[k * d:] = mono[:N - k * d] * g
        delayed[:, (k - 1) % 2] += sh
    bells_all = bells + delayed

    # リバーブ
    dry = pad * 0.85 + bells_all * 0.85 + fx * 0.8
    send = pad * 0.5 + bells_all * 0.75 + fx * 0.6
    wet = np.stack([_convolve(send[:, c], ir) for c, ir in enumerate(_reverb_ir(rng))], 1)
    mix = dry + wet * 0.55

    # 仕上げ
    mix /= np.max(np.abs(mix)) + 1e-9
    mix = np.tanh(1.2 * mix) / math.tanh(1.2) * 0.89
    t = np.arange(N) / SR
    fade = _smooth(t / 0.08) * (1 - _smooth((t - 14.2) / (T.DURATION - 14.2)))
    return (mix * fade[:, None]).astype(np.float32)


def _reverb_ir(rng, seconds=3.6, rt60=3.2):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    irs = []
    for _ in range(2):
        noise = rng.standard_normal(n)
        dark = np.convolve(noise, np.ones(12) / 12, mode="same") * 2.5
        ir = 0.5 * noise * np.exp(-t / 0.15) + dark * 10 ** (-3 * t / rt60)
        ir[: int(0.022 * SR)] = 0
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return irs


def _convolve(x, h):
    size = len(x) + len(h) - 1
    nfft = 1 << (size - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)[:len(x)]


def write_wav(path, audio):
    data = (np.clip(audio, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(data.tobytes())


if __name__ == "__main__":
    write_wav(sys.argv[1] if len(sys.argv) > 1 else "music.wav", synthesize())
