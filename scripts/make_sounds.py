#!/usr/bin/env python3
"""给「蹦一蹦」合成几段可爱的音效（纯标准库，不依赖 numpy）。"""
import math
import os
import random
import struct
import sys
import wave

RATE = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else 'sounds'


def tone(freq_fn, dur, wave_fn='sine', vol=0.5, attack=0.005, release=0.08, vibrato=0.0):
    """freq_fn(t) 给出瞬时频率；带起音、收尾包络。"""
    n = int(RATE * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / RATE
        f = freq_fn(t) * (1 + vibrato * math.sin(2 * math.pi * 6 * t))
        phase += 2 * math.pi * f / RATE
        if wave_fn == 'sine':
            v = math.sin(phase)
        elif wave_fn == 'tri':
            v = 2 / math.pi * math.asin(math.sin(phase))
        elif wave_fn == 'soft':  # 正弦加一点泛音，像小木琴
            v = math.sin(phase) + 0.3 * math.sin(2 * phase) + 0.12 * math.sin(3 * phase)
            v /= 1.42
        else:
            v = math.sin(phase)
        env = min(1.0, t / attack) if attack > 0 else 1.0
        env *= min(1.0, (dur - t) / release) if release > 0 else 1.0
        out.append(v * env * vol)
    return out


def bell(freq, dur, vol=0.4):
    """铃铛：几个泛音，指数衰减。"""
    n = int(RATE * dur)
    parts = [(1, 1.0), (2.01, 0.45), (3.0, 0.2), (4.2, 0.1)]
    out = []
    for i in range(n):
        t = i / RATE
        v = sum(a * math.sin(2 * math.pi * freq * k * t) for k, a in parts) / 1.75
        env = math.exp(-t * 7) * min(1.0, t / 0.003)
        out.append(v * env * vol)
    return out


def mix(*tracks):
    n = max(len(off + t) for off, t in ((int(o * RATE) * [0.0], t) for o, t in tracks))
    out = [0.0] * n
    for o, t in tracks:
        s = int(o * RATE)
        for i, v in enumerate(t):
            out[s + i] += v
    return out


def save(name, samples):
    peak = max(1e-9, max(abs(v) for v in samples))
    k = min(1.0, 0.9 / peak)
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v * k)) * 32767)) for v in samples))


os.makedirs(OUT, exist_ok=True)
C5, E5, G5, C6, E6, G6, C7 = 523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0, 2093.0

# 蓄力：音调慢慢往上爬的「呜——」，带点颤音，按多久响多久（最长 2.6 秒）
save('charge.wav', tone(lambda t: 260 + 520 * (t / 2.6) ** 1.3, 2.6, 'tri', 0.28, attack=0.04, release=0.05, vibrato=0.012))
# 起跳：「啵嘤」一下往上滑
save('jump.wav', tone(lambda t: 380 + 900 * (t / 0.16), 0.16, 'soft', 0.45, release=0.05))
# 落地：短促的「哒」
save('land.wav', mix((0, tone(lambda t: 520 - 260 * t / 0.09, 0.09, 'soft', 0.5, attack=0.001, release=0.06))))
# 完美：叮叮叮的上行琶音
save('perfect.wav', mix((0, bell(C6, 0.5)), (0.06, bell(E6, 0.5)), (0.12, bell(G6, 0.5)), (0.18, bell(C7, 0.6, 0.3))))
# 特殊方块加分：金币声
save('bonus.wav', mix((0, tone(lambda t: 987.8, 0.08, 'tri', 0.35, release=0.02)), (0.08, tone(lambda t: 1318.5, 0.3, 'tri', 0.35, release=0.25))))
# 掉下去：「呜~」往下滑，最后「咚」一声
fall = tone(lambda t: 700 * (1 - t / 0.55) ** 1.4 + 140, 0.55, 'tri', 0.35, release=0.1, vibrato=0.03)
thud = tone(lambda t: 110 - 50 * t / 0.18, 0.18, 'sine', 0.6, attack=0.002, release=0.15)
save('fall.wav', mix((0, fall), (0.5, thud)))
# 原地踏步 / 结束：三个往下走的小音，有点委屈
save('over.wav', mix((0, tone(lambda t: 784, 0.18, 'soft', 0.35)), (0.2, tone(lambda t: 659, 0.18, 'soft', 0.35)), (0.4, tone(lambda t: 523, 0.45, 'soft', 0.35, release=0.3, vibrato=0.02))))
# 新纪录：小号角
save('record.wav', mix((0, tone(lambda t: C5, 0.12, 'soft', 0.4)), (0.12, tone(lambda t: E5, 0.12, 'soft', 0.4)), (0.24, tone(lambda t: G5, 0.12, 'soft', 0.4)), (0.36, tone(lambda t: C6, 0.5, 'soft', 0.45, release=0.35, vibrato=0.01)), (0.36, bell(C7, 0.6, 0.15))))
print('ok', sorted(os.listdir(OUT)))
