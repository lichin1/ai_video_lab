"""Generate narration audio, measure every line, and write the master timeline.

Voice: the brief asks for VoAI TTS "文彬 / Neo / 穩健". VoAI's API host is not
reachable from the build environment, so the default path uses an offline
Kokoro (sherpa-onnx) Mandarin male voice. To use real VoAI audio, export each
line from VoAI as audio/narration_override/NN.wav (NN = 01..24); those files
take priority and the whole timeline re-flows from their measured lengths.

Every generated line is transcribed back with a Paraformer ASR model and the
character error rate is reported, so mispronunciations are caught before the
timeline is built.
"""
import json
import os
import re
import sys

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


def main(sid, speed):
    jieba.setLogLevel(60)
    os.makedirs(OUT, exist_ok=True)
    tts, asr = make_tts(), make_asr()
    d, ls = lines()
    report = []
    for i, (scene, ln) in enumerate(ls, 1):
        path = f"{OUT}/{i:02d}.wav"
        ov = f"{OVERRIDE}/{i:02d}.wav"
        if os.path.exists(ov):
            y, sr = sf.read(ov, dtype="float32", always_2d=False)
            if y.ndim > 1:
                y = y.mean(axis=1)
            y = resample_poly(trim(y, sr), SR, sr).astype(np.float32)
            src = "override"
        else:
            y = synth(tts, ln["zh"], sid, speed)
            src = f"kokoro sid={sid}"
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
    if sys.argv[1:2] == ["audition"]:
        audition([int(s) for s in sys.argv[2].split(",")], float(sys.argv[3]))
    else:
        main(int(sys.argv[1]) if len(sys.argv) > 1 else 101,
             float(sys.argv[2]) if len(sys.argv) > 2 else 0.9)
