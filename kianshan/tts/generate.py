"""Generate narration audio and measure every line for the timeline.

Voice: Gemini TTS (gemini-3.8-flash-tts), a female voice directed to read in a
warm Taiwanese-Mandarin storytelling tone. The API key is supplied by the
environment (x-goog-api-key header), never stored here. The offline Kokoro
voice is kept as a fallback (`--engine kokoro`). Files placed in
audio/narration_override/NN.wav (NN = 01..24) take priority over both.

Every generated line is transcribed back with a Paraformer ASR model and the
character error rate is reported, so mispronunciations are caught before the
timeline is built.
"""
import json
import os
import re
import sys

import base64
import io
import urllib.request

import jieba
import numpy as np
import opencc
import sherpa_onnx
import soundfile as sf
from scipy.signal import resample_poly

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.environ.get("MODELS_DIR", "/tmp/claude-0/models")
KOKORO = f"{MODELS}/kokoro-multi-lang-v1_1/"
ASR = f"{MODELS}/sherpa-onnx-paraformer-zh-small-2024-03-09/"
OUT = f"{ROOT}/audio/narration"
OVERRIDE = f"{ROOT}/audio/narration_override"
SR = 48000

# Spoken-form fixes applied only to the TTS input (subtitles keep the original).
SPOKEN = {
    "二〇二四": "二零二四",
    "二〇二五": "二零二五",
    "土地": "土地",
}

t2s = opencc.OpenCC("t2s")
s2t = opencc.OpenCC("s2t")


def make_tts():
    k = KOKORO
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=k + "model.onnx", voices=k + "voices.bin", tokens=k + "tokens.txt",
                data_dir=k + "espeak-ng-data", dict_dir=k + "dict",
                lexicon=k + "lexicon-us-en.txt," + k + "lexicon-zh.txt"),
            num_threads=4),
        rule_fsts=k + "date-zh.fst," + k + "phone-zh.fst," + k + "number-zh.fst")
    return sherpa_onnx.OfflineTts(cfg)


def make_asr():
    return sherpa_onnx.OfflineRecognizer.from_paraformer(
        paraformer=ASR + "model.int8.onnx", tokens=ASR + "tokens.txt", num_threads=4)


def norm(s):
    s = t2s.convert(s)
    for a, b in (("〇", "零"), ("二零二四", "二零二四")):
        s = s.replace(a, b)
    return re.sub(r"[^一-鿿0-9]", "", s)


def cer(ref, hyp):
    r, h = norm(ref), norm(hyp)
    d = np.arange(len(h) + 1)
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev = cur
    return d[len(h)] / max(1, len(r))


def trim(x, sr, thr=0.01, pad=0.08):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pad * sr))
    b = min(len(x), idx[-1] + int(pad * sr))
    return x[a:b]


def transcribe(asr, x, sr):
    st = asr.create_stream()
    st.accept_waveform(sr, x.astype(np.float32))
    asr.decode_stream(st)
    return st.result.text


def synth(tts, text, sid, speed):
    spoken = text
    for a, b in SPOKEN.items():
        spoken = spoken.replace(a, b)
    a = tts.generate(t2s.convert(spoken), sid=sid, speed=speed)
    x = np.array(a.samples, dtype=np.float32)
    x = trim(x, a.sample_rate)
    y = resample_poly(x, SR, a.sample_rate).astype(np.float32)
    return y


GEMINI_MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-3.8-flash-lite-tts")
STYLE = ("Read aloud in a warm, gentle storytelling tone, like a young woman from Taiwan "
         "speaking Taiwanese Mandarin, at an unhurried pace, pausing clearly between sentences: ")


def gemini_tts(text, voice):
    body = {"contents": [{"parts": [{"text": STYLE + text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    import time
    from urllib.error import HTTPError
    for attempt in range(10):
        try:
            d = json.load(urllib.request.urlopen(req, timeout=180))
            break
        except HTTPError as e:  # 429 rate limit / 5xx
            body_txt = e.read().decode("utf8", "ignore")
            if attempt == 9 or e.code not in (429, 500, 502, 503, 504) or "PerDay" in body_txt:
                raise RuntimeError(f"Gemini TTS {e.code}: {body_txt[:400]}")
            wait = e.headers.get("Retry-After")
            time.sleep(float(wait) if wait else min(90, 15 * (attempt + 1)))
    time.sleep(float(os.environ.get("GEMINI_TTS_PACE", "6")))  # stay under the per-minute quota
    part = d["candidates"][0]["content"]["parts"][0]["inlineData"]
    raw, mt = base64.b64decode(part["data"]), part.get("mimeType", "")
    if "wav" in mt:
        x, sr = sf.read(io.BytesIO(raw), dtype="float32")
    else:
        m = re.search(r"rate=(\d+)", mt)
        sr = int(m.group(1)) if m else 24000
        x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    if x.ndim > 1:
        x = x.mean(axis=1)
    x = trim(x, sr, thr=0.008)
    return resample_poly(x, SR, sr).astype(np.float32)


def gemini_paragraph(asr, texts, voice, tries=3):
    """One request per scene: the whole paragraph is read in one breath, then cut
    back into sentences at the pauses. The cut is accepted only when every
    piece's ASR transcript matches its sentence."""
    para = "\n\n".join(texts)
    best = None
    for _ in range(tries):
        y = gemini_tts(para, voice)
        pieces = split_at_pauses(y, len(texts))
        if pieces is None:
            continue
        errs = [cer(t, transcribe(asr, resample_poly(p, 16000, SR), 16000)) for t, p in zip(texts, pieces)]
        score = max(errs)
        if best is None or score < best[0]:
            best = (score, pieces, errs)
        if score <= 0.3:
            break
    if best is None:
        raise RuntimeError("could not split paragraph into sentences")
    return best[1], best[2]


def split_at_pauses(y, n):
    """Cut y into n pieces at the n-1 longest pauses (in time order)."""
    if n == 1:
        return [y]
    hop = int(0.01 * SR)
    frames = len(y) // hop
    rms = np.sqrt(np.mean(y[:frames * hop].reshape(frames, hop) ** 2, axis=1))
    silent = rms < max(0.004, 0.06 * np.percentile(rms, 95))
    gaps = []
    i = 0
    while i < frames:
        if silent[i]:
            j = i
            while j < frames and silent[j]:
                j += 1
            if i > 0 and j < frames:
                gaps.append((j - i, i, j))
            i = j
        else:
            i += 1
    if len(gaps) < n - 1:
        return None
    cuts = sorted(gaps, reverse=True)[: n - 1]
    cuts = sorted((a + b) // 2 * hop for _, a, b in cuts)
    edges = [0] + cuts + [len(y)]
    return [trim(y[a:b], SR, thr=0.008) for a, b in zip(edges[:-1], edges[1:])]


def gemini_checked(asr, text, voice, tries=4):
    """Regenerate until the ASR transcript matches (catches misreads and the
    model speaking its own direction aloud); keep the best take."""
    best = None
    for _ in range(tries):
        y = gemini_tts(text, voice)
        hyp = transcribe(asr, resample_poly(y, 16000, SR), 16000)
        e = cer(text, hyp)
        extra = len(norm(hyp)) > len(norm(text)) + 4
        score = e + (1 if extra else 0)
        if best is None or score < best[0]:
            best = (score, y)
        if score <= 0.2:
            break
    return best[1]


def lines():
    d = json.load(open(f"{ROOT}/script/script.json", encoding="utf8"))
    out = []
    for s in d["scenes"]:
        for ln in s["lines"]:
            out.append((s["id"], ln))
    return d, out


def audition(sids, speed):
    tts, asr = make_tts(), make_asr()
    _, ls = lines()
    for sid in sids:
        errs = []
        for _, ln in ls:
            y = synth(tts, ln["zh"], sid, speed)
            errs.append(cer(ln["zh"], transcribe(asr, resample_poly(y, 16000, SR), 16000)))
        print(f"sid {sid}: mean CER {np.mean(errs):.3f}  worst {max(errs):.3f}", flush=True)


def main(engine, voice, speed):
    jieba.setLogLevel(60)
    os.makedirs(OUT, exist_ok=True)
    asr = make_asr()
    tts = make_tts() if engine == "kokoro" else None
    d, ls = lines()
    report = []
    para = {}
    if engine == "gemini":
        # The free tier allows 10 requests/day, so read the script in three long
        # takes (whole scenes together), cut at the pauses, and only re-read a
        # single line when its piece does not match.
        by_scene = {}
        for i, (scene, ln) in enumerate(ls, 1):
            by_scene.setdefault(scene, []).append((i, ln))
        groups, cur = [], []
        for scene, items in by_scene.items():
            cur += items
            if len(cur) >= 8:
                groups.append(cur); cur = []
        if cur:
            groups.append(cur)
        for items in groups:
            todo = [(i, ln) for i, ln in items if not os.path.exists(f"{OVERRIDE}/{i:02d}.wav")]
            if not todo:
                continue
            pieces, errs = gemini_paragraph(asr, [ln["zh"] for _, ln in todo], voice, tries=1)
            for (i, ln), p, e in zip(todo, pieces, errs):
                para[i] = p if e <= 0.35 else gemini_checked(asr, ln["zh"], voice, tries=2)
            print(f"lines {todo[0][0]}-{todo[-1][0]} in one take; CER {np.round(errs, 2).tolist()}", flush=True)
    for i, (scene, ln) in enumerate(ls, 1):
        path = f"{OUT}/{i:02d}.wav"
        ov = f"{OVERRIDE}/{i:02d}.wav"
        if os.path.exists(ov):
            y, sr = sf.read(ov, dtype="float32", always_2d=False)
            if y.ndim > 1:
                y = y.mean(axis=1)
            y = resample_poly(trim(y, sr), SR, sr).astype(np.float32)
            src = "override"
        elif engine == "gemini":
            y = para[i] if i in para else gemini_checked(asr, ln["zh"], voice)
            src = f"gemini {GEMINI_MODEL} voice={voice} (scene take)"
        else:
            y = synth(tts, ln["zh"], int(voice), speed)
            src = f"kokoro sid={voice}"
        y = y / (np.abs(y).max() + 1e-9) * 0.89
        sf.write(path, y, SR, subtype="PCM_16")
        hyp = s2t.convert(transcribe(asr, resample_poly(y, 16000, SR), 16000))
        e = cer(ln["zh"], hyp)
        dur = len(y) / SR
        report.append({"n": i, "scene": scene, "zh": ln["zh"], "en": ln["en"],
                       "file": os.path.relpath(path, ROOT), "dur": round(dur, 3),
                       "asr": hyp, "cer": round(e, 3), "source": src})
        print(f"{i:02d} {dur:5.2f}s CER {e:.2f}  {ln['zh']}  ->  {hyp}", flush=True)
    json.dump(report, open(f"{ROOT}/audio/narration_lines.json", "w", encoding="utf8"),
              ensure_ascii=False, indent=1)


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["audition"]:
        audition([int(s) for s in a[1].split(",")], float(a[2]))
    elif a[:1] == ["kokoro"]:
        main("kokoro", a[1] if len(a) > 1 else "60", float(a[2]) if len(a) > 2 else 0.86)
    else:  # default: gemini [voice]
        main("gemini", a[1] if len(a) > 1 else "Aoede", 1.0)
