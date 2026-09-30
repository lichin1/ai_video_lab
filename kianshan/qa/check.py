"""Mux the final MP4, then check every frame and pull scene stills.

Frame checks, run on every decoded frame of the finished file:
  * frame count and duration match the timeline; audio and video lengths agree
  * no black, washed-out or uniform frames (outside the planned opening and final fade)
  * no glitch spikes: a frame that differs sharply from both neighbours while the
    neighbours agree with each other (a partly drawn or missing frame)
  * no frozen stretches: consecutive identical frames (everything is meant to keep moving)
"""
import json
import os
import subprocess

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = f"{ROOT}/output/kianshan_intro.mp4"
tl = json.load(open(f"{ROOT}/render/timeline.json", encoding="utf8"))
FPS = tl["fps"]


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout


def mux():
    subprocess.check_call([
        "ffmpeg", "-y", "-loglevel", "error", "-i", f"{ROOT}/render/video_noaudio.mp4", "-i", f"{ROOT}/audio/mix_final.wav",
        "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
        "-shortest", "-movflags", "+faststart",
        "-metadata", "title=高雄市堅山慈善會簡介", "-metadata:s:a:0", "language=chi", OUT])


def probe():
    js = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", OUT]))
    v = next(s for s in js["streams"] if s["codec_type"] == "video")
    a = next(s for s in js["streams"] if s["codec_type"] == "audio")
    nb = int(run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", OUT]).strip())
    return v, a, float(js["format"]["duration"]), nb


def frame_stats():
    w, h = 320, 180
    p = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-i", OUT, "-vf", f"scale={w}:{h}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         stdout=subprocess.PIPE)
    stats = []
    prev = None
    diffs = []
    small = []   # 160x90 greyscale copies for the neighbour test
    while True:
        buf = p.stdout.read(w * h * 3)
        if len(buf) < w * h * 3:
            break
        f = np.frombuffer(buf, np.uint8).reshape(h, w, 3).astype(np.float32)
        g = f.mean(2)
        # ink coverage: pixels clearly darker than paper
        ink = (g < 150).mean()
        stats.append((g.mean(), g.std(), ink))
        small.append(g.reshape(90, 2, 160, 2).mean((1, 3)).astype(np.uint8))
        diffs.append(0.0 if prev is None else float(np.abs(f - prev).mean()))
        prev = f
    p.wait()
    return np.array(stats), np.array(diffs), small


def scene_of(fi):
    t = fi / FPS
    for s in tl["scenes"]:
        if s["start"] <= t < s["start"] + s["dur"]:
            return s["id"], t - s["start"]
    return tl["scenes"][-1]["id"], t - tl["scenes"][-1]["start"]


def main():
    mux()
    v, a, dur, nb = probe()
    stats, diffs, small = frame_stats()
    n = len(stats)
    issues = []
    fade_from = int((tl["total"] - 1.6) * FPS)
    for i, (mean, std, ink) in enumerate(stats):
        sid, local = scene_of(i)
        expected_sparse = (sid == "s01_opening" and local < 1.0) or i >= fade_from
        if mean < 40:
            issues.append((i, "black/dark frame"))
        if std < 4 and not expected_sparse:
            issues.append((i, f"near-uniform frame (std {std:.1f})"))
        if ink < 0.002 and not expected_sparse:
            issues.append((i, f"almost no line art ({ink * 100:.2f}% ink)"))
    # glitch spikes: big change into a frame and big change out of it,
    # while frame i-1 and i+1 look alike
    med = np.median(diffs[1:])
    for i in range(1, n - 1):
        if diffs[i] > max(6 * med, 6) and diffs[i + 1] > max(6 * med, 6) and \
                np.abs(small[i - 1].astype(np.float32) - small[i + 1]).mean() < 0.35 * min(diffs[i], diffs[i + 1]):
            issues.append((i, f"glitch spike (diff in {diffs[i]:.1f}, out {diffs[i + 1]:.1f}, median {med:.2f})"))
    # frozen: 45+ identical frames in a row (1.5 s) would mean motion stopped
    run_len = 0
    for i in range(1, n):
        run_len = run_len + 1 if diffs[i] < 0.02 else 0
        if run_len == 45:
            issues.append((i, "motion frozen for 1.5 s"))

    # stills: two per scene at story beats + contact sheets
    sd = f"{ROOT}/qa/final_stills"
    os.makedirs(sd, exist_ok=True)
    for old in os.listdir(sd):
        os.remove(os.path.join(sd, old))
    picks = []
    for s in tl["scenes"]:
        ls = s["lines"]
        beats = [ls[0]["s"] + 1.5, ls[-1]["e"] - 0.5] if ls else [4.0, s["dur"] - 3.0]
        if len(ls) >= 4:
            beats.insert(1, ls[len(ls) // 2]["s"] + 1.5)
        for b in beats:
            picks.append((s["id"], s["name"], s["start"] + b))
    files = []
    for k, (sid, name, t) in enumerate(picks):
        fn = f"{sd}/{k:02d}_{sid}_{t:06.2f}s.jpg"
        subprocess.check_call(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", OUT, "-frames:v", "1", "-q:v", "2", fn])
        files.append(fn)
    for k in range(0, len(files), 4):
        sheet = Image.new("RGB", (1920, 1080), (244, 236, 220))
        for j, fn in enumerate(files[k:k + 4]):
            im = Image.open(fn).convert("RGB").resize((960, 540))
            sheet.paste(im, ((j % 2) * 960, (j // 2) * 540))
        sheet.save(f"{ROOT}/qa/final_sheet_{k // 4:02d}.jpg", quality=90)

    loud = subprocess.run(["ffmpeg", "-hide_banner", "-i", OUT, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    lufs = [l.strip() for l in loud.splitlines() if l.strip().startswith(("I:", "Peak:", "LRA:"))][-3:]

    rep = [
        "# 品質檢查報告", "",
        f"- 檔案：`output/kianshan_intro.mp4`",
        f"- 解析度／幀率：{v['width']}×{v['height']} @ {v['r_frame_rate']}，編碼 {v['codec_name']} / {a['codec_name']} {a['sample_rate']} Hz",
        f"- 片長：{dur:.2f} 秒（時間軸 {tl['total']:.2f} 秒），影格數：{nb}（時間軸 {tl['frames']}），逐格解碼 {n} 格",
        f"- 響度：{' / '.join(lufs)}",
        f"- 相鄰格差異中位數：{med:.2f}（線條每 3 格重新抖動，屬正常的手繪「沸騰」效果）",
        f"- 異常影格：{len(issues)} 個", "",
    ]
    if issues:
        rep += ["| 影格 | 時間 | 場景 | 問題 |", "|---|---|---|---|"]
        for i, msg in issues[:200]:
            sid, local = scene_of(i)
            rep.append(f"| {i} | {i / FPS:.2f}s | {sid} +{local:.2f}s | {msg} |")
    else:
        rep.append("所有影格都通過檢查：沒有黑畫面、空白畫面、破圖閃格，也沒有畫面凍結。")
    rep += ["", "## 抽幀截圖", ""] + [f"- `{os.path.relpath(f, ROOT)}`" for f in files]
    open(f"{ROOT}/qa/report.md", "w", encoding="utf8").write("\n".join(rep) + "\n")
    print("\n".join(rep[:10]))
    for i, msg in issues[:30]:
        print(i, scene_of(i), msg)
    assert nb == tl["frames"], "frame count mismatch"
    assert abs(float(a.get("duration", dur)) - float(v.get("duration", dur))) < 0.1, "audio/video length mismatch"


if __name__ == "__main__":
    main()
