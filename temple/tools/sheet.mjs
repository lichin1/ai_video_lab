#!/usr/bin/env node
// 鏡頭總覽：每顆鏡頭在幾個時間點各渲一張小圖，拼成一張接觸表。
//   node tools/sheet.mjs out.png [w=480] [times=0,1.5,3,4.5,7]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openScene } from './browser.mjs';

const out = path.resolve(process.argv[2] || 'sheet.png');
const w = +(process.argv[3] || 480), h = Math.round(w * 9 / 16);
const times = (process.argv[4] || '0,1.5,3,4.5,7').split(',').map(Number);
const dir = fs.mkdtempSync(path.join(path.dirname(out), 'sheet-'));
const scene = await openScene({ w, h });
const files = [];
for (let s = 0; s < 10; s++) for (const a of times) {
  const { png } = await scene.frame(s * 7 + Math.min(a, 6.999));
  const f = path.join(dir, `${s}_${a}.png`);
  fs.writeFileSync(f, png);
  files.push(f);
}
await scene.close();
const cols = times.length;
const layout = files.map((_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`).join('|');
spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...files.flatMap((f) => ['-i', f]),
  '-filter_complex', `${files.map((_, i) => `[${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout}`, out], { stdio: 'inherit' });
fs.rmSync(dir, { recursive: true });
console.log('wrote', out);
