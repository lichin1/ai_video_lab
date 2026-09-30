"""Splice re-rendered frame ranges (render/patch_<a>_<b>.mp4) into the full video.

Frame-accurate: the base is cut with trim filters on frame numbers and the
result re-encoded once, so there are no keyframe seams.
"""
import glob
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = f"{ROOT}/render/video_noaudio.mp4"


def main():
    patches = sorted((int(m.group(1)), int(m.group(2)), p) for p in glob.glob(f"{ROOT}/render/patch_*_*.mp4")
                     for m in [re.search(r"patch_(\d+)_(\d+)\.mp4$", p)])
    if not patches:
        print("no patches")
        return
    inputs = ["-i", BASE]
    parts, fc, cur = [], [], 0
    for k, (a, b, p) in enumerate(patches, 1):
        inputs += ["-i", p]
        fc.append(f"[0:v]trim=start_frame={cur}:end_frame={a},setpts=PTS-STARTPTS[b{k}]")
        fc.append(f"[{k}:v]setpts=PTS-STARTPTS[p{k}]")
        parts += [f"[b{k}]", f"[p{k}]"]
        cur = b
    fc.append(f"[0:v]trim=start_frame={cur},setpts=PTS-STARTPTS[tail]")
    parts.append("[tail]")
    fc.append("".join(parts) + f"concat=n={len(parts)}:v=1:a=0[out]")
    tmp = f"{ROOT}/render/video_spliced.mp4"
    subprocess.check_call(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(fc), "-map", "[out]",
                           "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", "-r", "30", tmp])
    os.replace(tmp, BASE)
    for _, _, p in patches:
        os.remove(p)
    print("spliced", [(a, b) for a, b, _ in patches])


if __name__ == "__main__":
    main()
