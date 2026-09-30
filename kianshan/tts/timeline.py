"""Build the master timeline from measured narration lengths, and write the .srt.

Scene length = lead-in + lines (+ gaps) + tail. Every picture event in the
scenes is keyed to these line start times, so audio, subtitles and animation
stay locked together whatever the voice files measure.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
GAP = 2.0          # silence between lines inside a scene
SUB_HOLD = 0.35    # subtitle stays up a little after the voice ends
TARGET = (240, 300)

# lead-in (before first line) and tail (after last line) per scene, seconds
PACE = {
    "s01_opening": (5.5, 5.0),
    "s02_title": (5.0, 4.0),
    "s03_founding": (4.0, 4.5),
    "s04_chairs": (4.0, 4.5),
    "s05_scholarship": (4.0, 4.5),
    "s06_blood": (4.0, 5.0),
    "s07_rain": (4.5, 5.0),
    "s08_recent": (4.0, 4.5),
    "s09_ending": (4.5, 6.5),
    "s10_endcard": (14.0, 0.0),
}


def snap(t):
    return round(t * FPS) / FPS


def srt_time(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main():
    script = json.load(open(f"{ROOT}/script/script.json", encoding="utf8"))
    lines = json.load(open(f"{ROOT}/audio/narration_lines.json", encoding="utf8"))
    by_scene = {}
    for ln in lines:
        by_scene.setdefault(ln["scene"], []).append(ln)

    t = 0.0
    scenes = []
    for sc in script["scenes"]:
        lead, tail = PACE[sc["id"]]
        start = t
        local = lead
        out_lines = []
        for i, ln in enumerate(by_scene.get(sc["id"], [])):
            if i:
                local += GAP
            s = snap(local)
            out_lines.append({"n": ln["n"], "s": s, "e": snap(s + ln["dur"]), "dur": ln["dur"],
                              "zh": ln["zh"], "en": ln["en"], "file": ln["file"]})
            local = s + ln["dur"]
        dur = snap(local + tail)
        scenes.append({"id": sc["id"], "name": sc["name"], "start": snap(start), "dur": dur, "lines": out_lines})
        t = start + dur

    total = snap(t)
    tl = {"fps": FPS, "width": 1920, "height": 1080, "total": total,
          "frames": int(round(total * FPS)), "scenes": scenes}
    json.dump(tl, open(f"{ROOT}/render/timeline.json", "w", encoding="utf8"), ensure_ascii=False, indent=1)

    os.makedirs(f"{ROOT}/output", exist_ok=True)
    with open(f"{ROOT}/output/kianshan_intro.srt", "w", encoding="utf8") as f:
        k = 0
        for sc in scenes:
            for ln in sc["lines"]:
                k += 1
                a = sc["start"] + ln["s"]
                b = sc["start"] + ln["e"] + SUB_HOLD
                f.write(f"{k}\n{srt_time(a)} --> {srt_time(b)}\n{ln['zh']}\n{ln['en']}\n\n")

    for sc in scenes:
        print(f"{sc['id']:18s} start {sc['start']:7.2f}  dur {sc['dur']:6.2f}  lines {len(sc['lines'])}")
    print(f"TOTAL {total:.2f}s = {int(total // 60)}:{total % 60:05.2f}  frames {tl['frames']}")
    if not TARGET[0] <= total <= TARGET[1]:
        print("WARNING: total outside the 4-5 minute target")


if __name__ == "__main__":
    main()
