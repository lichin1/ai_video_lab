"""Original score, sound effects and final mix, all synthesised in code.

Score: lyrical, easy-going country feel in G major - finger-picked guitar
(Karplus-Strong), warm pad, walking bass, a harmonica-like lead and brushed
shaker. Arrangement density follows the story (sparse opening, fuller blood
drive, minor colour in the rain, swell at the ending).
SFX: Taiwan blue magpie calls, Taiwan yuhina whistles, wind in the trees,
rain, pencil scratches as scenes draw on, and small foley hits.
Narration ducks music/ambience automatically; the result is normalised to
-15 LUFS integrated with ffmpeg loudnorm (two-pass).
"""
import json
import os
import subprocess

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, sosfiltfilt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
rng = np.random.default_rng(2024)

tl = json.load(open(f"{ROOT}/render/timeline.json", encoding="utf8"))
TOTAL = tl["total"]
N = int(TOTAL * SR) + SR
SC = {s["id"]: s for s in tl["scenes"]}


def at(scene, local):
    return SC[scene]["start"] + local


def line(scene, i):
    return SC[scene]["start"] + SC[scene]["lines"][i]["s"]


def bp(lo, hi, order=2):
    return butter(order, [lo, hi], btype="band", fs=SR, output="sos")


def lp(f, order=2):
    return butter(order, f, btype="low", fs=SR, output="sos")


def hp(f, order=2):
    return butter(order, f, btype="high", fs=SR, output="sos")


def add(buf, sig, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf) or i + len(sig) <= 0:
        return
    a = max(0, -i)
    j = min(len(buf), i + len(sig))
    buf[max(0, i):j] += sig[a:a + j - max(0, i)] * gain


def env_adsr(n, a=0.01, r=0.3):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------------------------------------------------------------- instruments
def pluck(freq, dur, bright=0.5, damp=0.996):
    """Karplus-Strong string; stereo is handled by the caller."""
    n = int(dur * SR)
    p = max(2, int(SR / freq))
    buf = (rng.random(p) * 2 - 1) * 0.5
    buf = sosfilt(lp(min(SR / 2 - 100, 1500 + 5000 * bright)), buf)
    out = np.zeros(n)
    idx = 0
    for k in range(n):
        v = buf[idx]
        out[k] = v
        nxt = buf[(idx + 1) % p]
        buf[idx] = damp * 0.5 * (v + nxt)
        idx = (idx + 1) % p
    return out * env_adsr(n, 0.002, 0.08)


_pluck_cache = {}


def guitar(m, dur, vel=1.0):
    key = (m, round(dur, 2))
    if key not in _pluck_cache:
        body = pluck(midi(m), dur, bright=0.45)
        body = body + 0.3 * sosfilt(bp(90, 260), body)       # wooden body resonance
        _pluck_cache[key] = body / (np.abs(body).max() + 1e-9)
    return _pluck_cache[key] * vel


def pad(ms, dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for m in ms:
        f = midi(m)
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12)
            s += np.sin(2 * np.pi * ff * t + rng.random() * 6) + 0.25 * np.sin(4 * np.pi * ff * t)
    s = sosfilt(lp(1800), s)
    e = np.minimum(1, np.minimum(t / 0.9, (dur - t) / 1.2).clip(0))
    return s / (len(ms) * 3) * e * vel


def bass(m, dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.1 * np.sin(6 * np.pi * f * t)
    return s * np.exp(-t * 2.2) * env_adsr(n, 0.005, 0.05) * vel


def harmonica(m, dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = midi(m) * (1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.4, 0, 1))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.28 * np.sin(3 * ph) + 0.12 * np.sin(4 * ph)
    breath = sosfilt(bp(1200, 4000), rng.standard_normal(n)) * 0.05
    e = np.clip(np.minimum(t / 0.08, (dur - t) / 0.18), 0, 1)
    return (s * 0.5 + breath) * e * vel


def shaker(dur, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sosfilt(hp(5000), rng.standard_normal(n)) * np.exp(-t * 40)
    return s * vel * 0.5


# ---------------------------------------------------------------- score
BPM = 84
BEAT = 60 / BPM
BAR = 4 * BEAT
CH = {  # chord -> (bass midi, guitar voicing)
    "G": (43, [55, 59, 62, 67, 71]), "D": (38, [50, 57, 62, 66, 69]), "Em": (40, [52, 59, 64, 67, 71]),
    "C": (36, [48, 55, 60, 64, 67]), "Am": (45, [57, 60, 64, 69, 72]), "Bm": (47, [59, 62, 66, 71, 74]),
    "D/F#": (42, [54, 57, 62, 66, 69]), "Cadd9": (36, [48, 55, 62, 64, 67]), "Dsus": (38, [50, 57, 62, 67, 69]),
}
# Per scene: progression, intensity (0..1), melody on/off, percussion on/off
PLAN = {
    "s01_opening": (["G", "D/F#", "Em", "Cadd9"], 0.35, False, False),
    "s02_title": (["C", "G", "Am", "D"], 0.55, True, False),
    "s03_founding": (["G", "C", "G", "D"], 0.55, False, True),
    "s04_chairs": (["Em", "C", "G", "D"], 0.5, True, False),
    "s05_scholarship": (["G", "D", "Em", "C"], 0.65, True, True),
    "s06_blood": (["C", "D", "G", "Em", "C", "D", "G", "G"], 0.8, True, True),
    "s07_rain": (["Em", "C", "Am", "Bm"], 0.3, False, False),
    "s08_recent": (["C", "G", "D", "Em"], 0.5, False, True),
    "s09_ending": (["C", "D", "Bm", "Em", "Am", "D", "G", "G"], 0.75, True, False),
    "s10_endcard": (["C", "D", "G", "G"], 0.4, True, False),
}
# harmonica lines (scale degrees in G major pentatonic, per bar), cycled
MELODY = [
    [(67, 1.5), (69, 0.5), (71, 1), (74, 1)], [(74, 1.5), (71, 0.5), (69, 2)],
    [(71, 1), (69, 1), (67, 1), (64, 1)], [(62, 3), (64, 1)],
    [(67, 1.5), (71, 0.5), (74, 1), (76, 1)], [(74, 2), (71, 1), (69, 1)],
    [(67, 1), (64, 1), (62, 1), (64, 1)], [(67, 4)],
]


def scene_at(t):
    for s in tl["scenes"]:
        if s["start"] <= t < s["start"] + s["dur"]:
            return s["id"]
    return tl["scenes"][-1]["id"]


def build_score():
    L = np.zeros(N)
    R = np.zeros(N)
    nbars = int(TOTAL / BAR) + 1
    bar_in_scene = {}
    for b in range(nbars):
        t0 = b * BAR
        sid = scene_at(t0 + 0.01)
        prog, inten, mel, perc = PLAN[sid]
        k = bar_in_scene.get(sid, 0)
        bar_in_scene[sid] = k + 1
        name = prog[k % len(prog)]
        last = t0 + BAR > TOTAL - 4
        if last:
            name = "G"
        bm, voicing = CH[name]
        # finger-picked pattern: bass on 1 & 3, arpeggio on eighths
        pattern = [0, 2, 3, 4, 1, 3, 2, 4]
        for e8, vi in enumerate(pattern):
            tt = t0 + e8 * BEAT / 2 + rng.normal(0, 0.006)
            note = voicing[vi] if e8 % 4 else bm + 12
            vel = (0.55 + 0.25 * (e8 % 4 == 0)) * (0.6 + 0.5 * inten)
            if inten < 0.4 and e8 % 2:
                vel *= 0.6
            g = guitar(note, 1.8, vel)
            pan = 0.4 + 0.2 * (vi / 4)
            add(L, g, tt, 0.16 * (1 - pan) * 2)
            add(R, g, tt, 0.16 * pan * 2)
        # pad
        pv = 0.10 + 0.14 * inten
        pd = pad([voicing[1], voicing[2], voicing[3]], BAR + 0.6, pv)
        add(L, pd, t0 - 0.2)
        add(R, pd, t0 - 0.2)
        # bass
        if inten >= 0.45:
            for beat, off in ((0, 0), (2, 7 if name not in ("Bm",) else 7)):
                bs = bass(bm + off - (12 if off else 0), BEAT * 1.8, 0.28 * (0.7 + 0.4 * inten))
                add(L, bs, t0 + beat * BEAT)
                add(R, bs, t0 + beat * BEAT)
        # shaker on off-beats
        if perc:
            for e8 in range(8):
                v = (0.10 if e8 % 2 else 0.05) * inten
                sh = shaker(0.12, v)
                add(L, sh, t0 + e8 * BEAT / 2, 0.8)
                add(R, sh, t0 + e8 * BEAT / 2 + 0.004, 1.0)
        # harmonica lead: plays in the second half of each 4-bar phrase
        if mel and (k % 4 in (1, 3) or sid in ("s09_ending", "s06_blood")):
            phrase = MELODY[(b + (2 if name in ("Em", "Am", "Bm") else 0)) % len(MELODY)]
            tt = t0
            chord_pcs = {v % 12 for v in voicing}
            for m, beats in phrase:
                if (m % 12) not in chord_pcs and beats >= 2:
                    m = min(voicing[2:], key=lambda v: abs((v + 12) - m)) + 12
                h = harmonica(m, beats * BEAT * 0.95, 0.07 + 0.05 * inten)
                add(L, h, tt, 0.9)
                add(R, h, tt, 1.1)
                tt += beats * BEAT
        if last:
            ring = sum(guitar(v, 5.0, 0.6) for v in voicing)
            add(L, ring, t0 + BAR, 0.12)
            add(R, ring, t0 + BAR, 0.12)
            break
    # simple room: two short feedback delays
    for buf in (L, R):
        d1, d2 = int(0.083 * SR), int(0.127 * SR)
        wet = np.zeros_like(buf)
        wet[d1:] += buf[:-d1] * 0.22
        wet[d2:] += buf[:-d2] * 0.16
        buf += sosfilt(lp(3500), wet)
    # fade in / out
    fi, fo = int(2.5 * SR), int(3.5 * SR)
    end = int(TOTAL * SR)
    for buf in (L, R):
        buf[:fi] *= np.linspace(0, 1, fi)
        buf[end - fo:end] *= np.linspace(1, 0, fo)
        buf[end:] = 0
    return L, R


# ---------------------------------------------------------------- sound effects
def magpie_call(n_notes=3):
    """Taiwan blue magpie: harsh, raspy 'kyak-kyak-kyak'."""
    out = []
    for i in range(n_notes):
        d = 0.16 + rng.random() * 0.05
        n = int(d * SR)
        t = np.arange(n) / SR
        f0 = 900 + 150 * rng.random()
        carrier = np.sin(2 * np.pi * f0 * t + 3 * np.sin(2 * np.pi * 70 * t))
        noise = sosfilt(bp(1400, 3800), rng.standard_normal(n))
        s = (0.6 * carrier + 0.9 * noise) * np.sin(np.pi * t / d) ** 0.6
        out.append(s)
        out.append(np.zeros(int((0.07 + 0.04 * rng.random()) * SR)))
    s = np.concatenate(out)
    return s / (np.abs(s).max() + 1e-9)


def yuhina_song():
    """Taiwan yuhina: bright, quick whistled phrase with rising/falling sweeps."""
    parts = []
    shapes = [(2600, 3600, 0.09), (3400, 2800, 0.11), (2900, 4100, 0.14)]
    for a, b, d in shapes:
        n = int(d * SR)
        t = np.arange(n) / SR
        f = np.linspace(a, b, n) * (1 + 0.03 * np.sin(2 * np.pi * 38 * t))
        ph = 2 * np.pi * np.cumsum(f) / SR
        parts.append(np.sin(ph) * np.sin(np.pi * t / d))
        parts.append(np.zeros(int(0.045 * SR)))
    s = np.concatenate(parts)
    return s / (np.abs(s).max() + 1e-9)


def chirp_small():
    d = 0.07
    n = int(d * SR)
    t = np.arange(n) / SR
    f = np.linspace(4200, 3000, n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d)


def wind(dur, strength=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    base = sosfiltfilt(bp(250, 1600), rng.standard_normal(n))
    rustle = sosfiltfilt(bp(2500, 7000), rng.standard_normal(n))
    lfo = 0.55 + 0.45 * np.sin(2 * np.pi * 0.11 * t + 1) * np.sin(2 * np.pi * 0.047 * t)
    gust = np.clip(np.sin(2 * np.pi * 0.07 * t), 0, 1) ** 2
    s = base * lfo * 0.6 + rustle * (0.15 + 0.5 * gust) * lfo
    return s / (np.abs(s).max() + 1e-9) * strength


def rain_bed(dur):
    n = int(dur * SR)
    hiss = sosfiltfilt(bp(1800, 9000), rng.standard_normal(n)) * 0.5
    body = sosfiltfilt(bp(300, 1500), rng.standard_normal(n)) * 0.25
    drops = np.zeros(n)
    for _ in range(int(dur * 45)):
        i = rng.integers(0, n - 2000)
        d = 0.012 + rng.random() * 0.02
        m = int(d * SR)
        tt = np.arange(m) / SR
        f = 1800 + rng.random() * 3000
        drops[i:i + m] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 260) * (0.2 + rng.random() * 0.6)
    s = hiss + body + drops * 0.5
    return s / (np.abs(s).max() + 1e-9)


def pencil(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sosfilt(bp(2500, 8000), rng.standard_normal(n))
    strokes = np.clip(np.sin(2 * np.pi * (3.2 + rng.random()) * t + rng.random() * 3), 0, 1) ** 1.5
    return s * strokes * env_adsr(n, 0.05, 0.3) * 0.5


def thud(freq=90):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t * (1 - 0.3 * t)) * np.exp(-t * 14) + sosfilt(bp(400, 2500), rng.standard_normal(n)) * np.exp(-t * 60) * 0.6
    return s / np.abs(s).max()


def pop():
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    f = np.linspace(500, 1200, n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 26)


def whoosh(dur=0.9):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = sosfiltfilt(bp(500, 3000), rng.standard_normal(n)) * np.sin(np.pi * t / dur) ** 2
    return s / (np.abs(s).max() + 1e-9)


def chime(m=84):
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    f = midi(m)
    s = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 4)) * np.exp(-t * 2.5)
    return s * env_adsr(n, 0.003, 0.2)


def tick():
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 200)


def engine_arrival(dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 42 + 10 * np.exp(-t)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * sosfilt(bp(80, 400), rng.standard_normal(n))
    e = np.clip(t / 0.8, 0, 1) * np.clip((dur - t) / 1.2, 0, 1)
    s = s * e
    return s / np.abs(s).max()


def build_sfx():
    L = np.zeros(N)
    R = np.zeros(N)

    def place(sig, t, g, pan=0.5):
        add(L, sig, t, g * (1 - pan) * 1.4)
        add(R, sig, t, g * pan * 1.4)

    # ambience beds
    for sid, strength in (("s01_opening", 0.10), ("s03_founding", 0.07), ("s04_chairs", 0.07), ("s05_scholarship", 0.05), ("s06_blood", 0.06), ("s09_ending", 0.08), ("s10_endcard", 0.05)):
        s = SC[sid]
        w = wind(s["dur"] + 1.6, strength)
        w *= np.clip(np.minimum(np.arange(len(w)) / (0.8 * SR), (len(w) - np.arange(len(w))) / (1.0 * SR)), 0, 1)
        place(w, s["start"] - 0.8, 1.0, 0.5 + 0.1 * rng.standard_normal())
    s = SC["s07_rain"]
    rb = rain_bed(s["dur"] + 2.0)
    fade = np.clip(np.minimum(np.arange(len(rb)) / (1.2 * SR), (len(rb) - np.arange(len(rb))) / (1.5 * SR)), 0, 1)
    place(rb * fade, s["start"] - 1.0, 0.16)
    place(wind(s["dur"] + 2.0, 0.07) * fade, s["start"] - 1.0, 1.0)

    # birds — magpies when a magpie is on screen, yuhina whistles through daylight scenes
    for sid, local in (("s01_opening", 4.5), ("s01_opening", 9.0), ("s01_opening", 17.0), ("s03_founding", 3.5), ("s06_blood", 3.0), ("s06_blood", 8.0), ("s10_endcard", 4.0)):
        place(magpie_call(3 + int(rng.integers(0, 2))), at(sid, local), 0.10, 0.3 + 0.4 * rng.random())
    for sid, locs in (("s01_opening", [1.5, 7.0, 12.5, 20.5]), ("s02_title", [5.5, 9.5]), ("s04_chairs", [2.0, 14.0, 22.0]),
                      ("s05_scholarship", [3.0, 16.0, 23.0]), ("s08_recent", [2.0]), ("s09_ending", [2.5, 9.0, 26.0]), ("s10_endcard", [7.5])):
        for lc in locs:
            place(yuhina_song(), at(sid, lc), 0.07, 0.2 + 0.6 * rng.random())
            place(chirp_small(), at(sid, lc + 1.1), 0.04, rng.random())

    # pencil scratches while each scene draws itself on
    for s in tl["scenes"]:
        place(pencil(2.6), s["start"] + 0.1, 0.05, 0.45)
    place(pencil(2.0), at("s02_title", 2.0), 0.05, 0.5)

    # event foley
    place(pop(), line("s01_opening", 0) + 1.0, 0.18)
    place(chime(88), line("s01_opening", 1) + 0.6, 0.06, 0.6)
    place(chime(83), at("s02_title", 3.0), 0.06, 0.5)
    place(chime(79), at("s02_title", 3.4), 0.05, 0.5)
    place(whoosh(1.2), line("s03_founding", 0) + 3.4, 0.08)
    place(thud(80), line("s03_founding", 1) + 2.6, 0.22, 0.7)
    place(chime(86), line("s04_chairs", 0) + 1.6, 0.05)
    place(chime(88), line("s04_chairs", 0) + 4.4, 0.05)
    place(chime(91), line("s04_chairs", 0) + 7.0, 0.06)
    place(whoosh(1.0), line("s04_chairs", 1) - 0.4, 0.06)
    place(thud(160), line("s04_chairs", 2) + 1.8, 0.06, 0.7)
    place(whoosh(0.8), line("s05_scholarship", 0) + 2.2, 0.06)
    place(chime(84), line("s05_scholarship", 0) + 3.4, 0.06)
    for i in range(4):
        place(pop(), line("s05_scholarship", 1) + 0.5 + i * 0.55, 0.10, 0.3 + 0.13 * i)
    place(whoosh(1.4), line("s05_scholarship", 2) + 2.2, 0.08)
    place(engine_arrival(3.2), line("s06_blood", 1) + 0.3, 0.14, 0.65)
    place(engine_arrival(3.2), line("s06_blood", 1) + 1.1, 0.12, 0.75)
    t0 = line("s06_blood", 3) + 0.2
    for k in range(0, 372, 12):
        u = k / 372
        tt = t0 + 3.2 * (np.arccos(1 - 2 * u) / np.pi if u < 1 else 1)
        place(tick(), tt, 0.05, 0.5)
    place(chime(91), t0 + 3.3, 0.08)
    place(thud(180), line("s07_rain", 1) + 1.6, 0.05, 0.7)
    place(thud(75), line("s08_recent", 0) + 0.6, 0.24, 0.3)
    for i in range(6):
        place(whoosh(1.4), line("s08_recent", 0) + 1.4 + i * 0.55, 0.035, 0.3 + 0.1 * i)
    place(chime(86), line("s09_ending", 0) + 4.8, 0.05)
    for i, m in enumerate((79, 83, 86, 91)):
        place(chime(m), line("s09_ending", 1) + 0.4 + i * 0.25, 0.04)
    return L, R


# ---------------------------------------------------------------- voice + mix
def build_voice():
    V = np.zeros(N)
    active = np.zeros(N)
    for s in tl["scenes"]:
        for ln in s["lines"]:
            y, sr = sf.read(f"{ROOT}/{ln['file']}", dtype="float32")
            t = s["start"] + ln["s"]
            add(V, y, t)
            a, b = int(t * SR), int((t + ln["dur"]) * SR)
            active[a:b] = 1
    # warm up the TTS a touch: gentle low-shelf-ish body + presence
    V = V + 0.25 * sosfilt(bp(120, 300), V) + 0.12 * sosfilt(bp(2500, 5000), V)
    # duck envelope with attack/release smoothing
    att, rel = 0.25, 0.7
    env = np.zeros(N)
    cur = 0.0
    ka, kr = 1 / (att * SR), 1 / (rel * SR)
    # look-ahead so the dip starts just before the voice
    look = int(0.2 * SR)
    act = np.concatenate([active[look:], np.zeros(look)])
    for i in range(0, N, 64):
        tgt = act[i]
        cur = min(tgt, cur + ka * 64) if tgt > cur else max(tgt, cur - kr * 64)
        env[i:i + 64] = cur
    return V, env


def main():
    mL, mR = build_score()
    sL, sR = build_sfx()
    V, duck = build_voice()
    music_gain = 10 ** (-7 / 20) * (1 - duck * (1 - 10 ** (-12 / 20)))
    sfx_gain = 1 - duck * (1 - 10 ** (-5 / 20))
    L = mL * music_gain * 1.0 + sL * sfx_gain + V * 0.9
    R = mR * music_gain * 1.0 + sR * sfx_gain + V * 0.9
    mix = np.stack([L, R], 1)[: int(TOTAL * SR)]
    mix /= np.abs(mix).max() + 1e-9
    mix *= 0.7
    os.makedirs(f"{ROOT}/audio/stems", exist_ok=True)
    sf.write(f"{ROOT}/audio/stems/music.wav", np.stack([mL, mR], 1)[: int(TOTAL * SR)] * 0.5, SR, subtype="PCM_24")
    sf.write(f"{ROOT}/audio/stems/sfx.wav", np.stack([sL, sR], 1)[: int(TOTAL * SR)] * 0.8, SR, subtype="PCM_24")
    sf.write(f"{ROOT}/audio/stems/voice.wav", V[: int(TOTAL * SR)], SR, subtype="PCM_24")
    raw = f"{ROOT}/audio/mix_raw.wav"
    sf.write(raw, mix, SR, subtype="PCM_24")

    # two-pass loudness normalisation to -15 LUFS
    p1 = subprocess.run(["ffmpeg", "-hide_banner", "-i", raw, "-af", "loudnorm=I=-15:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
                        capture_output=True, text=True).stderr
    js = json.loads(p1[p1.rindex("{"):p1.rindex("}") + 1])
    af = (f"loudnorm=I=-15:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
          f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
    subprocess.check_call(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-af", af, "-ar", str(SR), "-c:a", "pcm_s24le", f"{ROOT}/audio/mix_final.wav"])
    print("mixed; pass-1 measured", js["input_i"], "LUFS")


if __name__ == "__main__":
    main()
