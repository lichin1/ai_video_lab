#!/usr/bin/env node
// 預覽截圖工具（給各分區自查用）。
//
// 自訂鏡頭：
//   node tools/snap.mjs --only pond --cam -10,3,40 --look 0,0,30 --out /tmp/x.png
// 正式鏡頭（第 N 顆的幾個時間點，local 秒）：
//   node tools/snap.mjs --shot 2 --at 0,3.5,7 --out /tmp/shot2.png   → shot2_0.0.png ...
// 其他參數：--w 960 --h 540（預設 960×540）、--fov 40、--t 12（動畫時間）、--post 0、--aperture 0.02
import fs from 'node:fs';
import path from 'node:path';
import { openScene } from './browser.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  if (k.startsWith('--')) args[k.slice(2)] = process.argv[++i];
}
const vec = (s) => s.split(',').map(Number);
const out = args.out || 'snap.png';
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

const t0 = Date.now();
const scene = await openScene({ only: args.only, w: args.w || 960, h: args.h || 540, post: args.post });
console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const jobs = [];
if (args.shot !== undefined) {
  const n = +args.shot;
  for (const a of (args.at || '0,3.5,7').split(',').map(Number)) {
    const local = Math.min(a, 6.999);
    jobs.push({ t: n * 7 + local, cam: null, file: out.replace(/\.png$/, `_${a.toFixed(1)}.png`) });
  }
} else {
  const cam = { pos: vec(args.cam || '0,40,140'), look: vec(args.look || '0,5,0'), fov: +(args.fov || 40) };
  if (args.aperture) cam.aperture = +args.aperture;
  jobs.push({ t: +(args.t || 0), cam, file: out });
}
for (const j of jobs) {
  const t1 = Date.now();
  const { png, info } = await scene.frame(j.t, j.cam);
  fs.writeFileSync(j.file, png);
  console.log(`${j.file}  t=${j.t}  ${((Date.now() - t1) / 1000).toFixed(1)}s  calls=${info.calls}  tris=${JSON.stringify(info.triangles)}`);
}
if (scene.errors.length) console.log('console:\n' + [...new Set(scene.errors)].slice(0, 30).join('\n'));
await scene.close();
