// 主殿軸部與簷下：基壇、階段、礎石、朱漆柱、貫・長押、白壁、扉（桟唐戸・蔀戸）、三手先斗栱、軒天井、雙層垂木。
import * as THREE from 'three';
import { hall } from '../../layout.js';
import { box, beam, frustum, gridSurface, M, normalizeGeo, meterUV } from './geom.js';
import {
  W, D, O, P, colTop, brTop, colXs, colZs, bayX, bayZ, pOut, rafterH, rafterW, out1,
  yR, yF, fasciaH, H0, warp, warpOffset,
} from './dims.js';

const SIDES = ['S', 'N', 'E', 'W'];
const hwOf = (s) => (s === 'S' || s === 'N' ? W / 2 : D / 2);
/** 側面局部 (a 沿牆, out 往外, y) → 主殿局部座標 */
function toLocal(side, a, out, y) {
  if (side === 'S') return [a, y, D / 2 + out];
  if (side === 'N') return [-a, y, -(D / 2 + out)];
  if (side === 'E') return [W / 2 + out, y, -a];
  return [-(W / 2 + out), y, a];
}
/** 該側的旋轉角（局部 +Z 轉向外法線） */
const sideRot = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };

/** 沿四面、不反り的水平材（四角相互穿入即可）。 */
function sideBeams(bk, key, out, th, yb, yt, sides = SIDES, ext = 0) {
  for (const s of sides) {
    const L = 2 * (hwOf(s) + out + th / 2 + ext);
    const g = box(L, yt - yb, th, 'x');
    const c = toLocal(s, 0, out, (yb + yt) / 2);
    bk.add(key, g, M(c, [0, sideRot[s], 0]));
  }
}

/** 隨反り彎曲的周圈材（四面、斜接）。yb / yt 可為常數。 */
function warpRing(bk, key, out, th, yb, yt, nu = 64) {
  for (const s of SIDES) {
    const hw = hwOf(s);
    const face = (o0, o1, y0, y1) => gridSurface(nu, 1, (u, v) => {
      const o = o0 + (o1 - o0) * v, y = y0 + (y1 - y0) * v;
      const a = (u * 2 - 1) * (hw + o);
      return warp(toLocal(s, a, o, y));
    });
    const oi = out - th / 2, oo = out + th / 2;
    bk.add(key, face(oo, oo, yb, yt));   // 外面
    bk.add(key, face(oi, oi, yt, yb));   // 內面
    bk.add(key, face(oi, oo, yb, yb));   // 底
    bk.add(key, face(oo, oi, yt, yt));   // 頂
  }
}

// ── 基壇與階段 ──
function buildPlatform(bk) {
  const X = W / 2 + hall.platformMargin, Z = D / 2 + hall.platformMargin;
  bk.add('stone', box(2 * X + 0.08, 0.22, 2 * Z + 0.08), M([0, 0.11, 0]));          // 地覆石
  bk.add('stone', box(2 * X - 0.06, P - 0.4, 2 * Z - 0.06), M([0, P / 2, 0]));        // 羽目石
  bk.add('stoneTop', box(2 * X + 0.14, 0.2, 2 * Z + 0.14), M([0, P - 0.1, 0]));      // 葛石・敷石
  // 束石
  const posts = (len, n, place) => { for (let i = 0; i <= n; i++) place(-len + (2 * len * i) / n); };
  posts(X, 12, (a) => { for (const sz of [-1, 1]) bk.add('stone', box(0.42, P - 0.42, 0.08), M([a, P / 2, sz * (Z - 0.0)])); });
  posts(Z, 9, (a) => { for (const sx of [-1, 1]) bk.add('stone', box(0.08, P - 0.42, 0.42), M([sx * (X - 0.0), P / 2, a])); });
  // 正面中央階段
  const n = 8, rise = P / n, tread = 0.42, sw = hall.stairWidth;
  for (let i = 1; i < n; i++) {
    const run = (n - i) * tread;
    bk.add('stoneTop', box(sw, rise, run + 0.04), M([0, (i - 0.5) * rise, Z + run / 2 - 0.02]));
  }
  // 耳石（側面斜石）
  const sh = new THREE.Shape();
  const runAll = (n - 1) * tread + 0.25;
  sh.moveTo(0, 0); sh.lineTo(runAll, 0); sh.lineTo(runAll, 0.32); sh.lineTo(0.0, P + 0.06); sh.lineTo(0, 0);
  const ear = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false });
  for (const sx of [-1, 1]) {
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0));
    m.setPosition(sx * (sw / 2 + 0.5) + (sx > 0 ? 0 : 0.5), 0, Z - 0.02);
    bk.add('stone', meterUV(normalizeGeo(ear.clone())), m);
  }
}

// ── 柱・礎石 ──
function perimeterColumns() {
  const pts = [];
  for (const x of colXs) { pts.push([x, D / 2]); pts.push([x, -D / 2]); }
  for (const z of colZs.slice(1, -1)) { pts.push([W / 2, z]); pts.push([-W / 2, z]); }
  return pts;
}
function buildColumns(bk) {
  const r = hall.columnRadius, h = colTop - P - 0.12;
  const prof = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const rr = r * (1.04 - 0.1 * t + 0.05 * Math.sin(Math.PI * Math.min(1, t * 1.6)) * 0.6) * (t > 0.96 ? 0.97 : 1);
    prof.push(new THREE.Vector2(rr, t * h));
  }
  prof.unshift(new THREE.Vector2(0, 0)); prof.push(new THREE.Vector2(0, h));
  const col = meterUV(normalizeGeo(new THREE.LatheGeometry(prof, 28)), 'y');
  const base = meterUV(normalizeGeo(new THREE.CylinderGeometry(r + 0.12, r + 0.22, 0.14, 24)), 'y');
  const plinth = box(1.25, 0.06, 1.25);
  for (const [x, z] of perimeterColumns()) {
    bk.add('vermilion', col, M([x, P + 0.12, z]));
    bk.add('stone', base, M([x, P + 0.07, z]));
    bk.add('stoneTop', plinth, M([x, P + 0.02, z]));
  }
}

// ── 貫・長押・白壁・扉 ──
function buildWalls(bk) {
  const r = hall.columnRadius;
  const yNage = P + 4.3, yNageT = P + 4.55, yHead = colTop - 0.38;
  sideBeams(bk, 'vermilion', 0, 0.3, P, P + 0.25);                         // 地覆
  sideBeams(bk, 'vermilion', 0, 0.32, yNage, yNageT);                      // 内法長押
  sideBeams(bk, 'vermilion', 0, 0.3, yHead, colTop - 0.04);                // 頭貫
  sideBeams(bk, 'vermilion', 0, 0.62, colTop - 0.04, colTop + 0.1);        // 台輪
  sideBeams(bk, 'vermilion', 0, 0.3, P + 0.95, P + 1.15, ['N', 'E', 'W']); // 腰長押
  // 頭貫木鼻（柱角外突的端頭）
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    bk.add('vermilion', box(0.5, 0.28, 0.26), M([sx * (W / 2 + 0.4), yHead + 0.16, sz * D / 2]));
    bk.add('vermilion', box(0.26, 0.28, 0.5), M([sx * W / 2, yHead + 0.16, sz * (D / 2 + 0.4)]));
  }
  for (const s of SIDES) {
    const cols = s === 'S' || s === 'N' ? colXs : colZs;
    for (let i = 0; i < cols.length - 1; i++) {
      const a0 = cols[i] + r * 0.8, a1 = cols[i + 1] - r * 0.8, ac = (a0 + a1) / 2, w = a1 - a0;
      const rot = [0, sideRot[s], 0];
      // 小壁（長押上方）
      bk.add('plaster', box(w, yHead - yNageT, 0.18), M(toLocal(s, ac, -0.02, (yNageT + yHead) / 2), rot));
      if (s !== 'S') {
        bk.add('plaster', box(w, yNage - P - 0.25, 0.18), M(toLocal(s, ac, -0.02, (P + 0.25 + yNage) / 2), rot));
        continue;
      }
      // 正面：中央三間 桟唐戸，其餘 蔀戸
      const y0 = P + 0.25, y1 = yNage;
      bk.add('glow', box(w, y1 - y0, 0.02), M(toLocal(s, ac, -0.12, (y0 + y1) / 2), rot));
      if (i >= 2 && i <= 4) door(bk, s, a0, a1, y0, y1, rot);
      else shutter(bk, s, a0, a1, y0, y1, rot);
    }
  }
}
function door(bk, s, a0, a1, y0, y1, rot) {
  const post = 0.16, w = a1 - a0;
  const L = (k, out, y) => toLocal(s, k, out, y);
  bk.add('vermilion', box(post, y1 - y0, 0.22), M(L(a0 + post / 2, 0, (y0 + y1) / 2), rot)); // 方立
  bk.add('vermilion', box(post, y1 - y0, 0.22), M(L(a1 - post / 2, 0, (y0 + y1) / 2), rot));
  const lw = (w - 2 * post) / 2, h = y1 - y0;
  for (const k of [0, 1]) {
    const la = a0 + post + k * lw, lc = la + lw / 2;
    const st = 0.13, out = 0.0;
    // 框
    bk.add('vermilion', box(st, h, 0.1), M(L(la + st / 2, out, y0 + h / 2), rot));
    bk.add('vermilion', box(st, h, 0.1), M(L(la + lw - st / 2, out, y0 + h / 2), rot));
    const rails = [[0, 0.22], [0.42, 0.15], [h - 0.17, 0.17]];
    for (const [yy, rh] of rails) bk.add('vermilion', box(lw - 2 * st, rh, 0.1), M(L(lc, out, y0 + yy + rh / 2), rot));
    // 下部鏡板（二段，凸起格狭間板）
    const pb = y0 + 0.22, pt = y0 + 0.42 * h;
    bk.add('vermilion', box(lw - 2 * st, 0.42 * h - 0.22, 0.04), M(L(lc, out - 0.01, (pb + pt) / 2), rot));
    bk.add('vermilion', box(lw - 2 * st - 0.2, 0.42 * h - 0.5, 0.05), M(L(lc, out + 0.02, (pb + pt) / 2), rot));
    bk.add('gold', box(lw - 2 * st - 0.12, 0.03, 0.06), M(L(lc, out + 0.02, pb + 0.08), rot));
    bk.add('gold', box(lw - 2 * st - 0.12, 0.03, 0.06), M(L(lc, out + 0.02, pt - 0.08), rot));
    // 上部 桟（格子）
    const gb = y0 + 0.42 * h + 0.15, gt = y0 + h - 0.17, ga0 = la + st, ga1 = la + lw - st;
    const nV = Math.round((ga1 - ga0) / 0.13);
    for (let i = 1; i < nV; i++) bk.add('vermilion', box(0.035, gt - gb, 0.05), M(L(ga0 + ((ga1 - ga0) * i) / nV, out, (gb + gt) / 2), rot));
    const nH = Math.round((gt - gb) / 0.13);
    for (let j = 1; j < nH; j++) bk.add('vermilion', box(ga1 - ga0, 0.035, 0.05), M(L((ga0 + ga1) / 2, out, gb + ((gt - gb) * j) / nH), rot));
    // 飾金具：四角 L 形、八双、引手環
    for (const [ka, ky] of [[la + 0.02, y0 + 0.02], [la + lw - 0.02, y0 + 0.02], [la + 0.02, y1 - 0.02], [la + lw - 0.02, y1 - 0.02]]) {
      const sa = ka < lc ? 1 : -1, sy = ky < (y0 + y1) / 2 ? 1 : -1;
      bk.add('gold', box(0.32, 0.05, 0.03), M(L(ka + sa * 0.16, 0.06, ky + sy * 0.025), rot));
      bk.add('gold', box(0.05, 0.32, 0.03), M(L(ka + sa * 0.025, 0.06, ky + sy * 0.16), rot));
    }
    const ringA = k === 0 ? la + lw - 0.22 : la + 0.22;
    const ring = new THREE.TorusGeometry(0.07, 0.012, 6, 16);
    bk.add('gold', meterUV(normalizeGeo(ring)), M(L(ringA, 0.08, y0 + h * 0.48), rot));
    const boss = new THREE.CylinderGeometry(0.045, 0.055, 0.03, 12); boss.rotateX(Math.PI / 2);
    bk.add('gold', meterUV(normalizeGeo(boss)), M(L(ringA, 0.06, y0 + h * 0.48 + 0.07), rot));
  }
}
function shutter(bk, s, a0, a1, y0, y1, rot) {
  const L = (k, out, y) => toLocal(s, k, out, y);
  const fr = 0.12, h = y1 - y0, ym = y0 + h * 0.5;
  bk.add('vermilion', box(fr, h, 0.14), M(L(a0 + fr / 2, 0, (y0 + y1) / 2), rot));
  bk.add('vermilion', box(fr, h, 0.14), M(L(a1 - fr / 2, 0, (y0 + y1) / 2), rot));
  for (const yy of [y0 + fr / 2, ym, y1 - fr / 2]) bk.add('vermilion', box(a1 - a0, fr, 0.14), M(L((a0 + a1) / 2, 0, yy), rot));
  const ga0 = a0 + fr, ga1 = a1 - fr;
  const nV = Math.round((ga1 - ga0) / 0.19);
  for (let i = 1; i < nV; i++) bk.add('lattice', box(0.04, h - 2 * fr, 0.06), M(L(ga0 + ((ga1 - ga0) * i) / nV, 0.01, (y0 + y1) / 2), rot));
  for (const [b, t] of [[y0 + fr, ym - fr / 2], [ym + fr / 2, y1 - fr]]) {
    const nH = Math.round((t - b) / 0.19);
    for (let j = 1; j < nH; j++) bk.add('lattice', box(ga1 - ga0, 0.04, 0.06), M(L((ga0 + ga1) / 2, 0.01, b + ((t - b) * j) / nH), rot));
  }
  // 釣金具
  for (const k of [a0 + 0.5, a1 - 0.5]) bk.add('gold', box(0.08, 0.16, 0.04), M(L(k, 0.09, ym + 0.12), rot));
}

// ── 三手先斗栱 ──
function bracketSet() {
  // 局部：x 沿牆、y 由台輪上緣起、z 往外
  const b0 = colTop + 0.1, hb = brTop - 0.26 - b0, k = hb / 1.24;
  const ver = [], ylw = [];
  const blk = (x, y, z, s = 1) => { const g = frustum(0.27 * s, 0.21 * s, 0.15 * k); g.translate(x, y + 0.075 * k, z); ver.push(g); };
  const armX = (len, y, z) => { const g = box(len, 0.2 * k, 0.17, 'x'); g.translate(0, y + 0.1 * k, z); ver.push(g); };
  const armZ = (z0, z1, y, x = 0) => { const g = box(0.17, 0.2 * k, z1 - z0, 'z'); g.translate(x, y + 0.1 * k, (z0 + z1) / 2); ver.push(g); };
  // 大斗
  { const g = frustum(0.62, 0.48, 0.3 * k); g.translate(0, 0.15 * k, 0); ver.push(g); }
  const t1 = 0.25 * k, t2 = 0.57 * k, t3 = 0.89 * k;
  // 一手目
  armX(1.5, t1, 0); armZ(-0.35, 0.62, t1);
  blk(-0.62, t1 + 0.2 * k, 0); blk(0.62, t1 + 0.2 * k, 0); blk(0, t1 + 0.2 * k, 0.55);
  // 二手目
  armX(1.4, t2, 0.55); armZ(-0.35, 1.12, t2);
  blk(-0.58, t2 + 0.2 * k, 0.55); blk(0.58, t2 + 0.2 * k, 0.55); blk(0, t2 + 0.2 * k, 1.05);
  // 三手目
  armX(1.4, t3, 1.05); armZ(-0.35, 1.68, t3);
  blk(-0.58, t3 + 0.2 * k, 1.05); blk(0.58, t3 + 0.2 * k, 1.05); blk(0, t3 + 0.2 * k, pOut, 1.15);
  // 尾垂木（斜材）與木口
  const p0 = [0, t2 + 0.33 * k, -0.2], p1 = [0, t2 + 0.06 * k, 1.95];
  ver.push(beam(p0, p1, 0.2, 0.24));
  const dir = new THREE.Vector3(...p1).sub(new THREE.Vector3(...p0)).normalize();
  ylw.push(beam(p1, [p1[0] + dir.x * 0.015, p1[1] + dir.y * 0.015, p1[2] + dir.z * 0.015], 0.205, 0.245));
  return { ver, ylw, b0 };
}
function buildBrackets(bk) {
  const { ver, ylw, b0 } = bracketSet();
  const place = (x, z, rotY, sz = 1) => {
    const m = M([x, b0, z], [0, rotY, 0], [1, 1, sz]);
    for (const g of ver) bk.add('vermilion', g, m);
    for (const g of ylw) bk.add('rafterEnd', g, m);
  };
  for (const s of SIDES) {
    const cols = s === 'S' || s === 'N' ? colXs : colZs;
    for (const a of cols) { const [x, , z] = toLocal(s, a, 0, 0); place(x, z, sideRot[s]); }
    // 中備：間斗束
    for (let i = 0; i < cols.length - 1; i++) {
      const a = (cols[i] + cols[i + 1]) / 2;
      const [x, , z] = toLocal(s, a, 0, 0);
      const m = M([x, b0, z], [0, sideRot[s], 0]);
      const g1 = box(0.22, 0.28, 0.2); g1.translate(0, 0.14, 0.02); bk.add('vermilion', g1, m);
      const g2 = frustum(0.42, 0.32, 0.18); g2.translate(0, 0.37, 0.02); bk.add('vermilion', g2, m);
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) place(sx * W / 2, sz * D / 2, Math.atan2(sx, sz), Math.SQRT2);
  // 通肘木（牆線與各出的通材）、小壁帶
  const k = (brTop - 0.26 - b0) / 1.24;
  sideBeams(bk, 'plaster', -0.02, 0.16, colTop + 0.1, brTop + 0.35);
  for (const t of [0.25, 0.57, 0.89]) sideBeams(bk, 'vermilion', 0, 0.22, b0 + t * k, b0 + (t + 0.2) * k);
  sideBeams(bk, 'vermilion', 0.55, 0.18, b0 + 0.57 * k, b0 + 0.77 * k);
  sideBeams(bk, 'vermilion', 1.05, 0.18, b0 + 0.89 * k, b0 + 1.09 * k);
  // 支輪板（各出之間的斜板，白）與軒天井
  sideBeams(bk, 'plaster', 0.3, 0.42, b0 + 0.77 * k, b0 + 0.8 * k);
  sideBeams(bk, 'plaster', 0.8, 0.42, b0 + 1.09 * k, b0 + 1.12 * k);
  sideBeams(bk, 'ceiling', 0.75, 1.3, brTop - 0.02, brTop + 0.01);
  // 丸桁
  warpRing(bk, 'vermilion', pOut, 0.28, brTop - 0.27, brTop, 48);
}

// ── 雙層垂木、軒裏、木負、茅負、裏甲、隅木 ──
function buildEaves(bk) {
  for (const s of SIDES) {
    const hw = hwOf(s);
    const sp = s === 'S' || s === 'N' ? bayX / 12 : bayZ / 11;
    const n = Math.floor((hw + O) / sp);
    for (let i = -n; i < n; i++) {
      const a = (i + 0.5) * sp;
      const oin = Math.max(pOut - 0.15, Math.abs(a) - hw + 0.12);
      const add = (o0, o1, yTop, key) => {
        if (o1 - o0 < 0.1) return;
        const p0 = warp(toLocal(s, a, o0, yTop(o0) - rafterH / 2));
        const p1 = warp(toLocal(s, a, o1, yTop(o1) - rafterH / 2));
        bk.add(key, beam(p0, p1, rafterW, rafterH));
        const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]]; const l = Math.hypot(...d);
        const e = [p1[0] + (d[0] / l) * 0.014, p1[1] + (d[1] / l) * 0.014, p1[2] + (d[2] / l) * 0.014];
        bk.add('rafterEnd', beam(p1, e, rafterW + 0.006, rafterH + 0.006));
      };
      add(oin, out1 + 0.04, yR, 'vermilion');
      add(Math.max(oin, out1 - 0.05), O + 0.05, yF, 'vermilion');
    }
    // 軒裏板（垂木上的野地板，白）
    const soffit = (o0, o1, yTop) => gridSurface(72, 4, (u, v) => {
      const o = o0 + (o1 - o0) * v; const a = (u * 2 - 1) * (hw + o);
      return warp(toLocal(s, a, o, yTop(o) + 0.005));
    });
    bk.add('soffit', soffit(pOut - 0.15, out1, yR));
    bk.add('soffit', soffit(out1 - 0.06, O + 0.05, yF));
  }
  // 木負、茅負、裏甲
  warpRing(bk, 'vermilion', out1 - 0.02, 0.14, yR(out1) - 0.03, yF(out1) + 0.01);
  warpRing(bk, 'vermilion', O, 0.13, yF(O) - 0.02, yF(O) + fasciaH);
  warpRing(bk, 'wood', O + 0.05, 0.14, yF(O) + fasciaH, H0 - 0.1);
  // 隅木（大斷面斜材）＋ 金色木口金具
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pt = (o, y) => warp([sx * (W / 2 + o), y, sz * (D / 2 + o)]);
    const pA = pt(pOut - 0.2, yR(pOut - 0.2) - 0.1), pB = pt(out1, yR(out1) - 0.06), pC = pt(O + 0.22, yF(O + 0.22) - 0.02);
    bk.add('vermilion', beam(pA, pB, 0.3, 0.36));
    bk.add('vermilion', beam(pB, pC, 0.26, 0.32));
    const d = [pC[0] - pB[0], pC[1] - pB[1], pC[2] - pB[2]]; const l = Math.hypot(...d);
    bk.add('gold', beam(pC, [pC[0] + d[0] / l * 0.03, pC[1] + d[1] / l * 0.03, pC[2] + d[2] / l * 0.03], 0.29, 0.35));
  }
}

export function buildHallBody(bk) {
  buildPlatform(bk);
  buildColumns(bk);
  buildWalls(bk);
  buildBrackets(bk);
  buildEaves(bk);
}

/** 吊燈籠掛點（主殿局部座標下，軒裏垂木底的高度）。 */
export function soffitYAt(localZ) {
  const out = localZ - D / 2;
  return yR(out) - rafterH;
}
export { warpOffset };
