#!/usr/bin/env node
// 逐格渲染整支影片：每秒一個片段（30 格），多個 worker 平行，各自把畫面直接送進 ffmpeg。
//   node tools/render.mjs [workers=2] [shots=0-9]   → render/chunks/shot_N.mp4 → output/temple_dusk.mp4
// 已存在的片段會跳過（容器重啟最多損失一秒的進度）；一顆鏡頭的 7 秒都完成後合成 shot_N.mp4。
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, openScene } from './browser.mjs';

const workers = +(process.argv[2] || 2);
const range = (process.argv[3] || '0-9').split('-').map(Number);
const FPS = 30, SHOT = 7, W = 1920, H = 1080;
const CHUNKS = path.join(ROOT, 'render', 'chunks');
const OUT = path.join(ROOT, 'output');
fs.mkdirSync(CHUNKS, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const segPath = (s, k) => path.join(CHUNKS, `shot_${s}_${k}.mp4`);
const queue = [];
for (let s = range[0]; s <= (range[1] ?? range[0]); s++) {
  if (fs.existsSync(path.join(CHUNKS, `shot_${s}.mp4`))) continue;
  for (let k = 0; k < SHOT; k++) if (!fs.existsSync(segPath(s, k))) queue.push([s, k]);
}

function joinShot(s) {
  const segs = Array.from({ length: SHOT }, (_, k) => segPath(s, k));
  if (!segs.every((p) => fs.existsSync(p))) return;
  const list = path.join(CHUNKS, `shot_${s}.txt`);
  fs.writeFileSync(list, segs.map((p) => `file '${p}'`).join('\n'));
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', path.join(CHUNKS, `shot_${s}.mp4`)], { stdio: 'inherit' });
  for (const p of [...segs, list]) fs.rmSync(p);
  console.log(`shot ${s} joined`);
}

async function renderSegment(scene, [s, k]) {
  const tmp = path.join(CHUNKS, `shot_${s}_${k}.part.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = k * FPS; f < (k + 1) * FPS; f++) {
    const t = s * SHOT + f / FPS;
    const { png } = await scene.frame(t);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  fs.renameSync(tmp, segPath(s, k));
  console.log(`shot ${s} sec ${k} done  ${((Date.now() - t0) / 1000 / FPS).toFixed(2)} s/frame`);
  joinShot(s);
}

async function worker() {
  const scene = await openScene({ w: W, h: H });
  while (queue.length) await renderSegment(scene, queue.shift());
  if (scene.errors.length) console.log([...new Set(scene.errors)].slice(0, 10).join('\n'));
  await scene.close();
}

for (let s = 0; s < 10; s++) joinShot(s);
await Promise.all(Array.from({ length: Math.min(workers, queue.length) }, worker));

const all = Array.from({ length: 10 }, (_, s) => path.join(CHUNKS, `shot_${s}.mp4`));
if (all.every((p) => fs.existsSync(p))) {
  const list = path.join(CHUNKS, 'list.txt');
  fs.writeFileSync(list, all.map((p) => `file '${p}'`).join('\n'));
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', path.join(OUT, 'temple_dusk_master.mp4')], { stdio: 'inherit' });
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(OUT, 'temple_dusk_master.mp4'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, 'temple_dusk.mp4')], { stdio: 'inherit' });
  console.log('wrote output/temple_dusk.mp4');
}
