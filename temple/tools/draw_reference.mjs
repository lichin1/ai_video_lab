#!/usr/bin/env node
// 由 layout.js 畫出平面圖與立面示意圖（PNG），給施工分區參考比例。
//   node tools/draw_reference.mjs   → reference/*.png
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, chromium } from './browser.mjs';
import * as L from '../src/layout.js';

const OUT = path.join(ROOT, 'reference');
fs.mkdirSync(OUT, { recursive: true });
const F = L.focusPoints();
const C = { ink: '#2b2420', red: '#c4492a', gold: '#c99a2e', water: '#7fa7b8', grass: '#9aa86a', stone: '#a49c8f', tile: '#4d535c', sun: '#e88a2a' };
const font = `font-family="Noto Sans CJK TC, sans-serif"`;

// ── 平面圖 ─────────────────────────────────────────────────────────
function sitePlan() {
  const S = 5, x0 = -95, z0 = -85, W = 190 * S, H = 205 * S;
  const X = (x) => (x - x0) * S, Z = (z) => (z - z0) * S;
  const el = [];
  el.push(`<rect width="${W}" height="${H}" fill="#efe9dc"/>`);
  for (let g = -90; g <= 120; g += 10) {
    el.push(`<line x1="0" x2="${W}" y1="${Z(g)}" y2="${Z(g)}" stroke="#d8d0bf" stroke-width="${g === 0 ? 2 : 1}"/>`);
    el.push(`<text x="4" y="${Z(g) - 3}" font-size="11" fill="#9a8f7c" ${font}>z=${g}</text>`);
  }
  for (let g = -90; g <= 90; g += 10) {
    el.push(`<line y1="0" y2="${H}" x1="${X(g)}" x2="${X(g)}" stroke="#d8d0bf" stroke-width="${g === 0 ? 2 : 1}"/>`);
    el.push(`<text x="${X(g) + 3}" y="${H - 6}" font-size="11" fill="#9a8f7c" ${font}>x=${g}</text>`);
  }
  const p = L.terrain.precinct;
  el.push(`<rect x="${X(p.xMin)}" y="${Z(p.zMin)}" width="${(p.xMax - p.xMin) * S}" height="${(p.zMax - p.zMin) * S}" fill="${C.grass}" fill-opacity="0.25" stroke="${C.ink}" stroke-width="3" stroke-dasharray="10 6"/>`);
  for (const k of L.trees.keepOut) el.push(`<rect x="${X(k[0])}" y="${Z(k[2])}" width="${(k[1] - k[0]) * S}" height="${(k[3] - k[2]) * S}" fill="none" stroke="#b55" stroke-width="1" stroke-dasharray="3 3"/>`);
  for (const pa of L.paths) el.push(`<polyline points="${pa.pts.map(([x, z]) => `${X(x)},${Z(z)}`).join(' ')}" fill="none" stroke="#d9cdb3" stroke-width="${pa.w * S}" stroke-linejoin="round"/>`);
  const pd = L.pond;
  el.push(`<ellipse cx="${X(pd.center[0])}" cy="${Z(pd.center[2])}" rx="${pd.rx * S}" ry="${pd.rz * S}" fill="${C.water}" stroke="${C.stone}" stroke-width="${pd.shoreWidth * S}"/>`);
  for (const c of pd.lotusClusters) el.push(`<circle cx="${X(c.x)}" cy="${Z(c.z)}" r="${c.r * S}" fill="#6f9a5a" fill-opacity="0.6"/>`);
  const b = L.bridge;
  el.push(`<rect x="${X(b.center[0] - b.width / 2)}" y="${Z(b.center[2] - b.span / 2)}" width="${b.width * S}" height="${b.span * S}" fill="${C.red}"/>`);
  for (let i = 0; i < b.postsPerSide; i++) for (const sd of [-1, 1]) { const g = L.giboshiPoint(i, sd); el.push(`<circle cx="${X(g[0])}" cy="${Z(g[2])}" r="3" fill="${C.gold}"/>`); }
  const box = (cx, cz, w, d, fill, label, extra = '') => {
    el.push(`<rect x="${X(cx - w / 2)}" y="${Z(cz - d / 2)}" width="${w * S}" height="${d * S}" fill="${fill}" stroke="${C.ink}" stroke-width="2" ${extra}/>`);
    if (label) el.push(`<text x="${X(cx)}" y="${Z(cz) + 6}" font-size="18" font-weight="700" text-anchor="middle" fill="#fff" ${font} paint-order="stroke" stroke="${C.ink}" stroke-width="3">${label}</text>`);
  };
  const h = L.hall;
  box(h.pos[0], h.pos[2], h.width + 2 * h.platformMargin, h.depth + 2 * h.platformMargin, C.stone, '');
  box(h.pos[0], h.pos[2], h.width + 2 * h.eaveOverhang, h.depth + 2 * h.eaveOverhang, C.tile, '', 'fill-opacity="0.35"');
  box(h.pos[0], h.pos[2], h.width, h.depth, C.red, `主殿 ${h.width}×${h.depth} m  高 ${h.totalHeight}`);
  box(h.pos[0], h.pos[2] + h.depth / 2 + h.platformMargin + 2, h.stairWidth, 4, C.stone, '');
  const pg = L.pagoda, s0 = pg.stories[0];
  box(pg.pos[0], pg.pos[2], s0.width + 2 * s0.eave, s0.width + 2 * s0.eave, C.tile, '', 'fill-opacity="0.35"');
  box(pg.pos[0], pg.pos[2], pg.baseSize, pg.baseSize, C.stone, '');
  box(pg.pos[0], pg.pos[2], s0.width, s0.width, C.red, '');
  el.push(`<text x="${X(pg.pos[0])}" y="${Z(pg.pos[2] + 9)}" font-size="17" font-weight="700" text-anchor="middle" fill="${C.ink}" ${font}>五重塔 高 ${pg.totalHeight} m</text>`);
  const sm = L.sanmon;
  box(sm.pos[0], sm.pos[2], sm.width + 2 * sm.eaveOverhang, sm.depth + 2 * sm.eaveOverhang, C.tile, '', 'fill-opacity="0.35"');
  box(sm.pos[0], sm.pos[2], sm.width, sm.depth, C.red, `山門 ${sm.width}×${sm.depth}`);
  const bd = L.buddha;
  el.push(`<circle cx="${X(bd.pos[0])}" cy="${Z(bd.pos[2])}" r="${2.5 * S}" fill="#6d5a3a" stroke="${C.ink}" stroke-width="2"/>`);
  el.push(`<text x="${X(bd.pos[0])}" y="${Z(bd.pos[2] + 6)}" font-size="16" font-weight="700" text-anchor="middle" fill="${C.ink}" ${font}>露座佛像</text>`);
  for (const [x, , z] of L.toro.positions) el.push(`<rect x="${X(x) - 4}" y="${Z(z) - 4}" width="8" height="8" fill="${C.stone}" stroke="${C.ink}"/>`);
  for (const m of L.trees.maples) el.push(`<circle cx="${X(m.pos[0])}" cy="${Z(m.pos[2])}" r="${m.crown * S}" fill="#d0452a" fill-opacity="0.45" stroke="#a03018"/>`);
  for (const m of L.trees.pines) el.push(`<circle cx="${X(m.pos[0])}" cy="${Z(m.pos[2])}" r="${m.crown * S}" fill="#3f6a3a" fill-opacity="0.5" stroke="#2c4a28"/>`);
  el.push(`<text x="${X(0) + 14}" y="${Z(28)}" font-size="16" font-weight="700" fill="${C.ink}" ${font}>拱橋 跨距 ${b.span} m</text>`);
  el.push(`<text x="${X(-28)}" y="${Z(42)}" font-size="16" font-weight="700" fill="#2a4a5a" ${font}>蓮花池 ${pd.rx * 2}×${pd.rz * 2} m</text>`);
  // 鏡頭焦點
  const shotFocus = [F.toro, F.heroLotus, F.chime, F.buddhaFace, F.chochin, F.giboshi, F.hallLantern, F.finial, F.koiSpot, F.maple];
  shotFocus.forEach((f, i) => {
    el.push(`<circle cx="${X(f[0])}" cy="${Z(f[2])}" r="11" fill="#fff" stroke="#1d5fa8" stroke-width="2.5"/>`);
    el.push(`<text x="${X(f[0])}" y="${Z(f[2]) + 5}" font-size="13" font-weight="700" text-anchor="middle" fill="#1d5fa8" ${font}>${i + 1}</text>`);
  });
  // 太陽方位 & 北
  const [sx, , sz] = L.sunDirection();
  const ax = W - 110, az = 110;
  el.push(`<circle cx="${ax}" cy="${az}" r="80" fill="#fff" fill-opacity="0.7" stroke="${C.ink}"/>`);
  el.push(`<line x1="${ax}" y1="${az}" x2="${ax}" y2="${az - 70}" stroke="${C.ink}" stroke-width="3"/><text x="${ax}" y="${az - 82}" font-size="18" text-anchor="middle" font-weight="700" ${font}>北 (−Z)</text>`);
  const n = Math.hypot(sx, sz);
  el.push(`<line x1="${ax}" y1="${az}" x2="${ax + sx / n * 70}" y2="${az + sz / n * 70}" stroke="${C.sun}" stroke-width="5"/>`);
  el.push(`<circle cx="${ax + sx / n * 70}" cy="${az + sz / n * 70}" r="9" fill="${C.sun}"/>`);
  el.push(`<text x="${ax}" y="${az + 105}" font-size="14" text-anchor="middle" ${font}>太陽 西南西 ${L.sun.azimuthDeg}° 仰角 ${L.sun.elevationDeg}°</text>`);
  el.push(`<text x="20" y="34" font-size="26" font-weight="800" fill="${C.ink}" ${font}>黃昏寺院 場景平面圖（單位：公尺，格線 10 m，+X 東、+Z 南）</text>`);
  el.push(`<text x="20" y="60" font-size="15" fill="${C.ink}" ${font}>藍圈數字 = 鏡頭 1–10 的特寫物件　紅圈 = 楓　綠圈 = 松　灰方塊 = 石燈籠　虛線紅框 = 植樹禁區</text>`);
  return { w: W, h: H, svg: el.join('\n') };
}

// ── 立面圖（南向正面） ─────────────────────────────────────────────
function frame(title, w, h, S, body, notes) {
  const el = [`<rect width="${w}" height="${h}" fill="#f4efe4"/>`, body];
  el.push(`<text x="20" y="34" font-size="24" font-weight="800" fill="${C.ink}" ${font}>${title}</text>`);
  notes.forEach((t, i) => el.push(`<text x="20" y="${62 + i * 20}" font-size="14" fill="${C.ink}" ${font}>${t}</text>`));
  return { w, h, svg: el.join('\n') };
}
const dim = (x1, y1, x2, y2, label, side = 1) => {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1d5fa8" stroke-width="1.5" marker-start="url(#a)" marker-end="url(#a)"/>
<text x="${mx + (y1 === y2 ? 0 : 8 * side)}" y="${my + (y1 === y2 ? -6 : 4)}" font-size="13" fill="#1d5fa8" text-anchor="${y1 === y2 ? 'middle' : side > 0 ? 'start' : 'end'}" ${font}>${label}</text>`;
};
const defs = `<defs><marker id="a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,2 L10,5 L0,8 z" fill="#1d5fa8"/></marker></defs>`;

function hallElevation() {
  const h = L.hall, S = 22, W = 1400, Hh = 760, gx = W / 2, gy = Hh - 70;
  const X = (x) => gx + x * S, Y = (y) => gy - y * S;
  const el = [defs, `<line x1="0" x2="${W}" y1="${gy}" y2="${gy}" stroke="${C.ink}" stroke-width="2"/>`];
  const pw = h.width / 2 + h.platformMargin;
  el.push(`<rect x="${X(-pw)}" y="${Y(h.platformHeight)}" width="${pw * 2 * S}" height="${h.platformHeight * S}" fill="${C.stone}" stroke="${C.ink}"/>`);
  const top = h.platformHeight + h.columnHeight;
  for (let i = 0; i <= h.baysX; i++) {
    const x = -h.width / 2 + i * h.width / h.baysX;
    el.push(`<rect x="${X(x - h.columnRadius)}" y="${Y(top)}" width="${h.columnRadius * 2 * S}" height="${h.columnHeight * S}" fill="${C.red}" stroke="${C.ink}"/>`);
  }
  el.push(`<rect x="${X(-h.width / 2)}" y="${Y(top + h.bracketHeight)}" width="${h.width * S}" height="${h.bracketHeight * S}" fill="#8a5a3a" stroke="${C.ink}"/>`);
  for (let i = 0; i <= h.baysX * 2; i++) { const x = -h.width / 2 + i * h.width / h.baysX / 2; el.push(`<rect x="${X(x - 0.35)}" y="${Y(top + h.bracketHeight - 0.1)}" width="${0.7 * S}" height="${(h.bracketHeight - 0.2) * S}" fill="${C.gold}" fill-opacity="0.5"/>`); }
  const eY = top + h.bracketHeight, ew = h.width / 2 + h.eaveOverhang, rT = eY + h.roofHeight;
  // 入母屋：下段寄棟斜面 + 上段切妻三角
  el.push(`<path d="M${X(-ew - 0.8)},${Y(eY + 0.9)} Q${X(-ew + 3)},${Y(eY - 0.2)} ${X(-ew + 6)},${Y(eY + 0.3)} L${X(ew - 6)},${Y(eY + 0.3)} Q${X(ew - 3)},${Y(eY - 0.2)} ${X(ew + 0.8)},${Y(eY + 0.9)} L${X(h.width / 2 - 2)},${Y(eY + h.roofHeight * 0.55)} L${X(-h.width / 2 + 2)},${Y(eY + h.roofHeight * 0.55)} Z" fill="${C.tile}" stroke="${C.ink}"/>`);
  el.push(`<path d="M${X(-h.width / 2 + 3)},${Y(eY + h.roofHeight * 0.55)} L${X(-h.width / 2 + 6)},${Y(rT)} L${X(h.width / 2 - 6)},${Y(rT)} L${X(h.width / 2 - 3)},${Y(eY + h.roofHeight * 0.55)} Z" fill="#5a6068" stroke="${C.ink}"/>`);
  el.push(`<rect x="${X(-h.width / 2 + 6)}" y="${Y(rT + 0.9)}" width="${(h.width - 12) * S}" height="${0.9 * S}" fill="#3b4048"/>`);
  for (const sd of [-1, 1]) el.push(`<path d="M${X(sd * (h.width / 2 - 6))},${Y(rT + 0.9)} q${sd * 10},-${2 * S} ${sd * 1.2 * S},-${2 * S} q${-sd * 0.2 * S},${1.2 * S} ${-sd * 1.2 * S},${2 * S}" fill="${C.gold}" stroke="${C.ink}"/>`);
  for (const x of h.hangingLanterns.xs) el.push(`<line x1="${X(x)}" y1="${Y(eY)}" x2="${X(x)}" y2="${Y(h.hangingLanterns.y)}" stroke="${C.ink}"/><rect x="${X(x - 0.3)}" y="${Y(h.hangingLanterns.y)}" width="${0.6 * S}" height="${1.2 * S}" rx="4" fill="#5e7b62" stroke="${C.ink}"/>`);
  el.push(`<rect x="${X(-h.stairWidth / 2)}" y="${Y(h.platformHeight)}" width="${h.stairWidth * S}" height="${h.platformHeight * S}" fill="#c7bfb0" stroke="${C.ink}"/>`);
  el.push(dim(X(-h.width / 2), gy + 30, X(h.width / 2), gy + 30, `柱列寬 ${h.width} m（${h.baysX} 開間）`));
  el.push(dim(X(ew + 2.5), Y(0), X(ew + 2.5), Y(h.totalHeight), `總高 ${h.totalHeight} m`));
  el.push(dim(X(-ew - 2.5), Y(0), X(-ew - 2.5), Y(h.platformHeight), `基壇 ${h.platformHeight}`, -1));
  el.push(dim(X(-ew - 2.5), Y(h.platformHeight), X(-ew - 2.5), Y(top), `柱高 ${h.columnHeight}`, -1));
  el.push(dim(X(-ew - 2.5), Y(top), X(-ew - 2.5), Y(eY), `斗栱 ${h.bracketHeight}`, -1));
  el.push(dim(X(-ew - 2.5), Y(eY), X(-ew - 2.5), Y(rT), `屋頂 ${h.roofHeight}`, -1));
  el.push(dim(X(h.width / 2), Y(eY - 0.6), X(ew), Y(eY - 0.6), `出簷 ${h.eaveOverhang}`));
  return frame('主殿（本堂）南立面示意', W, Hh, S, el.join('\n'), [
    '入母屋造（下半寄棟四坡＋上半切妻山牆），簷口中段平、兩端起翹（反り）；屋脊兩端金色鴟尾。',
    '朱漆圓柱、白壁、柱上三手先斗栱、深出簷下可見雙層垂木。正面中央木階 + 四盞青銅吊燈籠。',
  ]);
}

function pagodaElevation() {
  const pg = L.pagoda, S = 19, W = 900, Hh = 760, gx = W / 2 - 60, gy = Hh - 40;
  const X = (x) => gx + x * S, Y = (y) => gy - y * S;
  const el = [defs, `<line x1="0" x2="${W}" y1="${gy}" y2="${gy}" stroke="${C.ink}" stroke-width="2"/>`];
  el.push(`<rect x="${X(-pg.baseSize / 2)}" y="${Y(pg.baseHeight)}" width="${pg.baseSize * S}" height="${pg.baseHeight * S}" fill="${C.stone}" stroke="${C.ink}"/>`);
  let y = pg.baseHeight;
  pg.stories.forEach((st, k) => {
    el.push(`<rect x="${X(-st.width / 2)}" y="${Y(y + st.height)}" width="${st.width * S}" height="${st.height * S}" fill="${C.red}" stroke="${C.ink}"/>`);
    el.push(`<rect x="${X(-st.width / 6)}" y="${Y(y + st.height * 0.8)}" width="${st.width / 3 * S}" height="${st.height * 0.7 * S}" fill="#6b3a22"/>`);
    const ey = L.pagodaEaveY(k), hw = st.width / 2 + st.eave;
    el.push(`<path d="M${X(-hw)},${Y(ey + 0.35)} Q${X(-hw + 1.5)},${Y(ey - 0.1)} ${X(-st.width / 2)},${Y(ey + 0.1)} L${X(st.width / 2)},${Y(ey + 0.1)} Q${X(hw - 1.5)},${Y(ey - 0.1)} ${X(hw)},${Y(ey + 0.35)} L${X(st.width / 2 * 0.6)},${Y(ey + pg.roofHeight)} L${X(-st.width / 2 * 0.6)},${Y(ey + pg.roofHeight)} Z" fill="${C.tile}" stroke="${C.ink}"/>`);
    for (const sd of [-1, 1]) el.push(`<line x1="${X(sd * hw)}" y1="${Y(ey + 0.35)}" x2="${X(sd * hw)}" y2="${Y(ey + 0.35 - pg.chimeDrop)}" stroke="${C.ink}"/><circle cx="${X(sd * hw)}" cy="${Y(ey + 0.35 - pg.chimeDrop - 0.15)}" r="4" fill="#5e7b62"/>`);
    el.push(`<text x="${X(hw) + 12}" y="${Y(ey) + 4}" font-size="12" fill="#1d5fa8" ${font}>第${k + 1}層 軸寬 ${st.width}、高 ${st.height}、出簷 ${st.eave}（簷口 y=${ey.toFixed(1)}）</text>`);
    y = ey + pg.roofHeight;
  });
  // 相輪
  el.push(`<rect x="${X(-0.25)}" y="${Y(y + pg.sorinHeight)}" width="${0.5 * S}" height="${pg.sorinHeight * S}" fill="#6a5a3a"/>`);
  for (let i = 0; i < 9; i++) el.push(`<ellipse cx="${X(0)}" cy="${Y(y + 1.6 + i * 0.55)}" rx="${(0.9 - i * 0.03) * S}" ry="3" fill="#7a6a40" stroke="${C.ink}"/>`);
  el.push(`<circle cx="${X(0)}" cy="${Y(y + pg.sorinHeight - 0.35)}" r="${0.35 * S}" fill="${C.gold}" stroke="${C.ink}"/>`);
  el.push(`<path d="M${X(-0.9)},${Y(y + 6.6)} q${0.9 * S},-${1.2 * S} ${1.8 * S},0" fill="none" stroke="${C.gold}" stroke-width="3"/>`);
  el.push(dim(X(-6), Y(0), X(-6), Y(pg.totalHeight), `總高 ${pg.totalHeight} m`, -1));
  el.push(dim(X(-6) - 70, Y(y), X(-6) - 70, Y(y + pg.sorinHeight), `相輪 ${pg.sorinHeight}`, -1));
  return frame('五重塔 立面示意', W, Hh, S, el.join('\n'), [
    '逐層縮小；屋頂深而薄，簷口四角明顯起翹。',
    '每層四角掛青銅風鈴；相輪：露盤→伏鉢→請花→九輪→水煙→寶珠（金）。',
  ]);
}

function bridgeElevation() {
  const b = L.bridge, S = 34, W = 1200, Hh = 420, gx = W / 2, gy = 300;
  const X = (z) => gx - (z - b.center[2]) * S, Y = (y) => gy - y * S; // 由東往西看：南在左
  const el = [defs];
  el.push(`<rect x="0" y="${Y(L.pond.waterLevel)}" width="${W}" height="${Hh}" fill="${C.water}" fill-opacity="0.5"/>`);
  el.push(`<line x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" stroke="${C.ink}" stroke-width="2"/>`);
  const N = 60, deck = [], under = [];
  for (let i = 0; i <= N; i++) { const [, y, z] = L.bridgeDeckPoint(i / N); deck.push(`${X(z)},${Y(y)}`); under.push(`${X(z)},${Y(y - b.deckThickness)}`); }
  el.push(`<polygon points="${deck.join(' ')} ${under.reverse().join(' ')}" fill="${C.red}" stroke="${C.ink}"/>`);
  const rail = []; for (let i = 0; i <= N; i++) { const [, y, z] = L.bridgeDeckPoint(i / N); rail.push(`${X(z)},${Y(y + b.railHeight)}`); }
  el.push(`<polyline points="${rail.join(' ')}" fill="none" stroke="${C.red}" stroke-width="7"/>`);
  for (let i = 0; i < b.postsPerSide; i++) {
    const [, y, z] = L.bridgeDeckPoint(i / (b.postsPerSide - 1));
    el.push(`<line x1="${X(z)}" y1="${Y(y)}" x2="${X(z)}" y2="${Y(y + b.railHeight)}" stroke="${C.red}" stroke-width="8"/>`);
    el.push(`<path d="M${X(z) - 7},${Y(y + b.railHeight + 0.05)} q7,-22 14,0 z" fill="${C.gold}" stroke="${C.ink}"/>`);
  }
  for (let r = 0; r < b.pierRows; r++) {
    const s = (r + 1) / (b.pierRows + 1), [, y, z] = L.bridgeDeckPoint(s);
    el.push(`<rect x="${X(z) - 6}" y="${Y(y - b.deckThickness)}" width="12" height="${(y - b.deckThickness - L.pond.waterLevel + L.pond.depth) * S}" fill="#7a3a22" stroke="${C.ink}"/>`);
  }
  el.push(dim(X(b.center[2] + b.span / 2), Y(-1.4) + 30, X(b.center[2] - b.span / 2), Y(-1.4) + 30, `跨距 ${b.span} m`));
  el.push(dim(X(b.center[2]) + 40, Y(0), X(b.center[2]) + 40, Y(b.rise), `拱高 ${b.rise}`));
  el.push(`<text x="20" y="${Y(L.pond.waterLevel) + 20}" font-size="13" fill="#1d4a5a" ${font}>水面 y = ${L.pond.waterLevel}</text>`);
  return frame('太鼓橋 東側立面（南在左、北在右）', W, Hh, S, el.join('\n'), [
    `橋面曲線 = bridgeDeckPoint(s)；寬 ${b.width} m；欄杆 ${b.railHeight} m，每側 ${b.postsPerSide} 根柱，柱頭青銅擬寶珠 giboshiPoint(i, side)。`,
  ]);
}

function sanmonElevation() {
  const sm = L.sanmon, S = 30, W = 1000, Hh = 640, gx = W / 2, gy = Hh - 50;
  const X = (x) => gx + x * S, Y = (y) => gy - y * S;
  const el = [defs, `<line x1="0" x2="${W}" y1="${gy}" y2="${gy}" stroke="${C.ink}" stroke-width="2"/>`];
  el.push(`<rect x="${X(-sm.width / 2 - 1)}" y="${Y(sm.baseHeight)}" width="${(sm.width + 2) * S}" height="${sm.baseHeight * S}" fill="${C.stone}" stroke="${C.ink}"/>`);
  const t1 = sm.baseHeight + sm.firstStoryHeight;
  for (let i = 0; i <= sm.bays; i++) { const x = -sm.width / 2 + i * sm.width / sm.bays; el.push(`<rect x="${X(x - 0.3)}" y="${Y(t1)}" width="${0.6 * S}" height="${sm.firstStoryHeight * S}" fill="${C.red}" stroke="${C.ink}"/>`); }
  el.push(`<path d="M${X(-sm.width / 2 - 2.2)},${Y(t1 + 0.6)} L${X(sm.width / 2 + 2.2)},${Y(t1 + 0.6)} L${X(sm.width / 2)},${Y(t1 + 1.6)} L${X(-sm.width / 2)},${Y(t1 + 1.6)} Z" fill="${C.tile}" stroke="${C.ink}"/>`);
  const t2 = t1 + 1.6 + sm.secondStoryHeight - 1.6;
  el.push(`<rect x="${X(-sm.width / 2 + 0.6)}" y="${Y(t2)}" width="${(sm.width - 1.2) * S}" height="${(t2 - t1 - 1.6) * S}" fill="${C.red}" stroke="${C.ink}"/>`);
  el.push(`<rect x="${X(-sm.width / 2 - 0.4)}" y="${Y(t1 + 2.6)}" width="${(sm.width + 0.8) * S}" height="${0.9 * S}" fill="none" stroke="${C.red}" stroke-width="4"/>`);
  const ew = sm.width / 2 + sm.eaveOverhang;
  el.push(`<path d="M${X(-ew)},${Y(t2 + 0.6)} Q${X(-ew + 2)},${Y(t2 - 0.1)} ${X(-ew + 4)},${Y(t2 + 0.2)} L${X(ew - 4)},${Y(t2 + 0.2)} Q${X(ew - 2)},${Y(t2 - 0.1)} ${X(ew)},${Y(t2 + 0.6)} L${X(sm.width / 2 - 2.5)},${Y(sm.totalHeight)} L${X(-sm.width / 2 + 2.5)},${Y(sm.totalHeight)} Z" fill="${C.tile}" stroke="${C.ink}"/>`);
  const c = sm.chochin;
  el.push(`<line x1="${X(0)}" y1="${Y(t1)}" x2="${X(0)}" y2="${Y(c.pos[1] + c.height / 2)}" stroke="${C.ink}"/>`);
  el.push(`<rect x="${X(-c.radius)}" y="${Y(c.pos[1] + c.height / 2)}" width="${c.radius * 2 * S}" height="${c.height * S}" rx="${c.radius * S * 0.9}" fill="#d23c26" stroke="${C.ink}"/>`);
  el.push(`<rect x="${X(-c.radius * 0.8)}" y="${Y(c.pos[1] + c.height / 2) - 6}" width="${c.radius * 1.6 * S}" height="10" fill="#222"/><rect x="${X(-c.radius * 0.8)}" y="${Y(c.pos[1] - c.height / 2) - 4}" width="${c.radius * 1.6 * S}" height="10" fill="#222"/>`);
  el.push(dim(X(-sm.width / 2), gy + 26, X(sm.width / 2), gy + 26, `寬 ${sm.width} m（${sm.bays} 開間）`));
  el.push(dim(X(ew + 1), Y(0), X(ew + 1), Y(sm.totalHeight), `總高 ${sm.totalHeight} m`));
  return frame('山門（二重門）南立面示意', W, Hh, S, el.join('\n'), [
    '下層五開間、中央通道掛大紅提燈；上層外圍環繞朱漆高欄（緣側）；入母屋屋頂。',
  ]);
}

const sheets = { site_plan: sitePlan(), elev_hall: hallElevation(), elev_pagoda: pagodaElevation(), elev_bridge: bridgeElevation(), elev_sanmon: sanmonElevation() };
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ deviceScaleFactor: 2 });
for (const [name, s] of Object.entries(sheets)) {
  await page.setViewportSize({ width: s.w, height: s.h });
  await page.setContent(`<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}">${s.svg}</svg></body></html>`);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('wrote', name);
}
await browser.close();
