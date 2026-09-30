"""Render the animation frame by frame in headless Chromium and encode to video.

Each frame: the page rebuilds the SVG for time t, waits for fonts/images and two
animation frames (so layout and paint are finished), then we screenshot it.
Frames are piped straight into ffmpeg, split over several workers.

  python3 render/render.py stills 30 900 ...      # PNG stills for checking
  python3 render/render.py video [workers]        # full render -> render/video_noaudio.mp4
"""
import asyncio
import base64
import glob
import json
import os
import subprocess
import sys
import time

import numpy as np
from PIL import Image, ImageFilter
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE = f"{ROOT}/engine"
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium")


def make_paper(path):
    """Off-white paper grain: soft blotches + fibres, used as a multiply layer."""
    rng = np.random.default_rng(7)
    h, w = 1080, 1920
    img = np.ones((h, w), np.float32)
    for scale, amp in ((240, 0.035), (60, 0.025), (12, 0.02)):
        small = rng.random((h // scale + 2, w // scale + 2)).astype(np.float32)
        big = np.array(Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) / 255
        img -= (big - 0.5) * amp * 2
    fib = Image.fromarray((rng.random((h, w)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    img -= (np.array(fib, np.float32) / 255 - 0.5) * 0.05
    yy, xx = np.mgrid[0:h, 0:w]
    vig = ((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2
    img -= vig * 0.05
    img = np.clip(img, 0, 1)
    rgb = np.stack([img * 255, img * 252, img * 246], -1)
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(path)


def load_logos():
    logos = {}
    for p in glob.glob(f"{ROOT}/assets/logos/*.png"):
        key = os.path.splitext(os.path.basename(p))[0]
        logos[key] = "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()
    return logos


async def open_page(pw, tl, logos):
    browser = await pw.chromium.launch(executable_path=CHROME, args=["--force-color-profile=srgb", "--disable-gpu"])
    page = await browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    await page.goto(f"file://{ENGINE}/index.html")
    await page.evaluate("([tl, logos]) => setup(tl, logos)", [tl, logos])
    return browser, page, errors


async def shot(page, f, errors):
    n = await page.evaluate(f"renderFrame({f})")
    if errors:
        raise RuntimeError(f"frame {f}: page error: {errors}")
    if n < 500:
        raise RuntimeError(f"frame {f}: suspiciously empty SVG ({n} chars)")
    return await page.screenshot(type="png", clip={"x": 0, "y": 0, "width": 1920, "height": 1080})


async def stills(frames, out_dir):
    tl = json.load(open(f"{ROOT}/render/timeline.json"))
    os.makedirs(out_dir, exist_ok=True)
    async with async_playwright() as pw:
        browser, page, errors = await open_page(pw, tl, load_logos())
        for f in frames:
            png = await shot(page, f, errors)
            open(f"{out_dir}/f{f:05d}.png", "wb").write(png)
        await browser.close()


async def worker(wid, a, b, tl, logos, log):
    out = f"{ROOT}/render/chunks/chunk_{wid:02d}.mp4"
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(tl["fps"]), "-c:v", "png", "-i", "-",
         "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", "-r", str(tl["fps"]), out],
        stdin=subprocess.PIPE)
    async with async_playwright() as pw:
        browser, page, errors = await open_page(pw, tl, logos)
        t0 = time.time()
        for f in range(a, b):
            png = await shot(page, f, errors)
            ff.stdin.write(png)
            if (f - a) % 150 == 0:
                el = time.time() - t0
                log(f"worker {wid}: frame {f} ({f - a + 1}/{b - a}) {el / (f - a + 1):.2f}s/frame")
        await browser.close()
    ff.stdin.close()
    if ff.wait() != 0:
        raise RuntimeError(f"ffmpeg failed for chunk {wid}")
    return out


async def video(workers):
    tl = json.load(open(f"{ROOT}/render/timeline.json"))
    logos = load_logos()
    os.makedirs(f"{ROOT}/render/chunks", exist_ok=True)
    for old in glob.glob(f"{ROOT}/render/chunks/*.mp4"):
        os.remove(old)
    n = tl["frames"]
    edges = [round(i * n / workers) for i in range(workers + 1)]
    log = lambda s: print(s, flush=True)
    chunks = await asyncio.gather(*[worker(i, edges[i], edges[i + 1], tl, logos, log) for i in range(workers)])
    lst = f"{ROOT}/render/chunks/list.txt"
    open(lst, "w").write("".join(f"file '{c}'\n" for c in chunks))
    subprocess.check_call(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst,
                           "-c", "copy", f"{ROOT}/render/video_noaudio.mp4"])
    print("frames rendered:", n)


if __name__ == "__main__":
    paper = f"{ENGINE}/paper.png"
    if not os.path.exists(paper):
        make_paper(paper)
    mode = sys.argv[1]
    if mode == "stills":
        asyncio.run(stills([int(x) for x in sys.argv[2:]], f"{ROOT}/qa/stills"))
    else:
        asyncio.run(video(int(sys.argv[2]) if len(sys.argv) > 2 else 4))
