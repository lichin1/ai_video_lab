// 露座青銅佛像：石座 + 蓮台（仰蓮三重・反花）+ 結跏趺坐・定印的坐佛 + 舟形光背（金）。
// 佛身：符號距離場（平滑聯集）+ Surface Nets 多邊形化；佛頭：高細分變形球（臉部加密取樣）程式雕刻五官；
// 螺髮：InstancedMesh 螺旋小丘；白毫、長耳垂。
// 局部座標：原點 = buddha.pos，+Z = 佛像正面（rotY 由外層 group 套用）。
import * as THREE from 'three';
import { buddha } from '../../layout.js';
import { gridSurface, normalizeGeo, meterUV, mergeGeometries, box, M } from './geom.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const G2 = (dx, dy, sx, sy) => Math.exp(-((dx * dx) / (sx * sx) + (dy * dy) / (sy * sy)));
const ridge = (d, s) => Math.exp(-(d * d) / (s * s));

const SEAT = buddha.pedestalHeight;

// ═════════════════ 佛頭 ═════════════════
const HR = { x: 0.305, y: 0.4, z: 0.335 };
const FACE_OFF = [0, -0.12, 0.33];   // 臉中心（佛臉焦點）相對頭心
const TILT = 0.12;                    // 俯首

/** 臉部前凸量（公尺），x 橫向、fy = 相對臉中心的高度。 */
function faceRelief(x, fy) {
  const ax = Math.abs(x);
  let f = 0;
  // 額與太陽穴
  f += 0.008 * G2(ax, fy - 0.17, 0.12, 0.06);
  f -= 0.012 * G2(ax - 0.205, fy - 0.05, 0.035, 0.07);
  // 長眉：弧形眉稜 + 銳利眉線
  const browY = 0.108 - 0.95 * ax * ax - 0.05 * ax;
  const bm = sstep(0.215, 0.13, ax) * sstep(0.004, 0.03, ax);
  f += 0.011 * ridge(fy - browY, 0.02) * bm;
  f += 0.0035 * ridge(fy - browY - 0.006, 0.0055) * bm;
  f += 0.006 * G2(ax, fy - 0.09, 0.03, 0.03);         // 眉間
  // 眼窩與半閉的上瞼
  const ex = ax - 0.088;
  f -= 0.03 * G2(ex, fy - 0.058, 0.062, 0.036);
  f += 0.03 * G2(ex, fy - 0.052, 0.054, 0.024);
  const sY = 0.039 + 0.11 * ex - 1.6 * ex * ex;        // 眼裂線（外眥微上揚）
  const em = sstep(0.056, 0.036, Math.abs(ex + 0.004));
  f -= 0.0095 * ridge(fy - sY, 0.0048) * em;            // 細長眼裂
  f += 0.0055 * ridge(fy - (sY - 0.011), 0.0075) * em;  // 下瞼
  f -= 0.0012 * ridge(fy - (sY + 0.024 - 0.4 * ex * ex), 0.004) * sstep(0.06, 0.03, Math.abs(ex)); // 二重瞼線
  // 鼻：鼻樑 → 鼻頭 → 鼻翼
  const t = clamp((0.08 - fy) / 0.135, 0, 1);
  let nH = 0.011 + 0.05 * Math.pow(t, 1.25);
  if (fy < -0.055) nH *= Math.exp(-(((fy + 0.055) / 0.017) ** 2));
  const nW = 0.015 + 0.017 * t;
  f += nH * Math.exp(-((ax / nW) ** 2)) * sstep(0.12, 0.07, fy + 0.0);
  f += 0.011 * G2(ax, fy + 0.05, 0.02, 0.019);          // 鼻頭
  f += 0.02 * G2(ax - 0.031, fy + 0.066, 0.016, 0.015); // 鼻翼
  f -= 0.012 * G2(ax - 0.017, fy + 0.08, 0.008, 0.0055); // 鼻孔
  f -= 0.004 * G2(ax - 0.048, fy + 0.07, 0.006, 0.02);  // 鼻翼溝
  // 口周（人中、慈悲微笑的唇）
  f += 0.017 * G2(ax, fy + 0.13, 0.068, 0.052);
  f -= 0.003 * G2(ax, fy + 0.1, 0.0065, 0.017);
  const mY = -0.129 + 2.3 * ax * ax - 0.0035 * ridge(ax, 0.012); // 嘴角上揚、上唇中央的弓形
  f += 0.0105 * ridge(fy - (mY + 0.011), 0.0078) * sstep(0.066, 0.044, ax);
  f += 0.013 * ridge(fy - (mY - 0.016), 0.0105) * sstep(0.056, 0.026, ax);
  f -= 0.0062 * ridge(fy - mY, 0.0032) * sstep(0.066, 0.05, ax);
  f -= 0.0055 * G2(ax - 0.061, fy - (-0.129 + 2.3 * 0.061 * 0.061), 0.008, 0.008); // 嘴角窩
  f += 0.006 * G2(ax - 0.078, fy + 0.1, 0.022, 0.022);   // 笑頰
  // 頦
  f -= 0.006 * G2(ax, fy + 0.17, 0.04, 0.0085);
  f += 0.016 * G2(ax, fy + 0.205, 0.042, 0.036);
  // 豐頰
  f += 0.03 * G2(ax - 0.14, fy + 0.07, 0.085, 0.1);
  return f;
}

/** 單位方向 → 佛頭表面點（頭心局部）。 */
function headPoint(X, Y, Z) {
  // 水平斷面略呈方圓（superellipse），臉部平而側面飽滿
  const h = Math.hypot(X, Z);
  let xs = X, zs = Z;
  if (h > 1e-6) {
    const c = Math.abs(X / h), s = Math.abs(Z / h), n = 2.35;
    const k = Math.pow(c ** n + s ** n, -1 / n);
    xs *= k; zs *= k;
  }
  let x = HR.x * xs, y = HR.y * Y, z = HR.z * zs * (Z < 0 ? 1.06 : 1);
  // 下頦收窄
  if (Y < 0) { const j = Math.pow(sstep(0, 1, -Y), 1.4); x *= 1 - 0.1 * j; z *= 1 - 0.06 * j * (Z > 0 ? 1 : 0.3); }
  // 肉髻（頂部隆起）
  y += 0.085 * sstep(0.7, 0.96, Y);
  x *= 1 - 0.05 * sstep(0.6, 0.95, Y);
  // 臉部雕刻
  const wF = sstep(0.32, 0.72, Z);
  if (wF > 0) z += wF * faceRelief(x, y - FACE_OFF[1]);
  return [x, y, z];
}

function headGeometry() {
  const NU = 288, NV = 208;
  const th = (u) => { const s = 2 * u - 1; return Math.PI * (0.34 * s + 0.66 * s * s * s); };
  const phC = -0.2;
  const ph = (v) => { const s = 2 * v - 1; const w = 0.42 * s + 0.58 * s * s * s; return w < 0 ? phC + w * (Math.PI / 2 + phC) : phC + w * (Math.PI / 2 - phC); };
  const g = gridSurface(NU, NV, (u, v) => {
    const t = th(u), p = clamp(ph(v), -Math.PI / 2, Math.PI / 2);
    return headPoint(Math.cos(p) * Math.sin(t), Math.sin(p), Math.cos(p) * Math.cos(t));
  }, { uvf: (u, v) => [u * 2, v], flip: true });
  return g;
}

function hairDirs() {
  const N = 1100, out = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const Y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - Y * Y), a = i * ga;
    const X = r * Math.cos(a), Z = r * Math.sin(a);
    const [x, y] = headPoint(X, Y, Z);
    const front = sstep(-0.25, 0.55, Z);
    const lim = -0.24 + front * (0.115 - 0.75 * x * x + 0.24);
    if (y < lim) continue;
    if (Math.abs(X) > 0.72 && y < 0.04 && Z > -0.45) continue; // 耳周
    out.push([X, Y, Z]);
  }
  return out;
}

function curlGeometry() {
  const Rc = 0.029, Hc = 0.025, NR = 5, NA = 14;
  const g = gridSurface(NA, NR, (u, v) => {
    const a = u * Math.PI * 2, r = Rc * (1 - v);
    const tR = r / Rc;
    let hgt = Hc * Math.pow(1 - tR * tR, 0.55);
    hgt *= 1 + 0.16 * Math.cos(a + Math.PI * 2 * 1.6 * tR) * sstep(0.0, 0.25, tR);
    return [r * Math.cos(a), hgt - 0.004, r * Math.sin(a)];
  }, { uvf: (u, v) => [u * 0.15, v * 0.03], flip: false });
  return normalizeGeo(g);
}

function earGeometry(side) {
  const NT = 56, NP = 28;
  const g = gridSurface(NP, NT, (u, v) => {
    const t = v, phi = u * Math.PI * 2;
    const env = Math.pow(Math.max(0, 1 - (2 * t - 1) ** 2), 0.42);
    // 寬度：上耳寬、耳垂頸細長、末端飽滿
    const w = (t > 0.55 ? 0.066 : t > 0.2 ? 0.034 + 0.032 * sstep(0.2, 0.55, t) : 0.034 + 0.012 * sstep(0.2, 0.06, t) * sstep(0.0, 0.08, t) * 2) * env;
    const thk = (0.024 + 0.008 * sstep(0.3, 0.0, t)) * env;
    const c = Math.cos(phi), s = Math.sin(phi);
    let x = thk * c, z = w * s;
    const y = -0.21 + 0.225 * (2 * t - 1);
    if (c > 0) { // 外側面：耳甲凹與耳垂裂孔的凹痕
      const dz = s * (w > 1e-4 ? 1 : 0);
      x -= 0.02 * c * G2((t - 0.76) / 0.13, dz / 0.62, 1, 1);
      x -= 0.012 * c * G2((t - 0.36) / 0.1, dz / 0.3, 1, 1);
      x += 0.004 * c * ridge(Math.abs(dz) - 0.85, 0.12) * sstep(0.45, 0.6, t); // 耳輪
    }
    return [side * x, y, z];
  }, { uvf: (u, v) => [u * 0.3, v * 0.45], flip: side < 0 });
  // 傾斜：耳面略朝前、上端外傾
  g.rotateY(side * 0.32);
  g.rotateZ(-side * 0.06);
  g.translate(side * 0.278, 0, -0.035);
  return g;
}

// ═════════════════ 佛身（SDF） ═════════════════
function sdEll(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = px - cx, y = py - cy, z = pz - cz;
  const k0 = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2);
  const k1 = Math.sqrt((x / (rx * rx)) ** 2 + (y / (ry * ry)) ** 2 + (z / (rz * rz)) ** 2);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}
function sdCap(px, py, pz, a, b, ra, rb) {
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
}
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }

function makeBodySDF(headC) {
  const S = SEAT;
  const y = (v) => S + v; // 由座面起算
  const neckA = [0, y(2.78), 0.3], neckB = [headC[0], headC[1] - 0.12, headC[2] - 0.08];
  return (px, py, pz) => {
    const ax = Math.abs(px);
    // 軀幹
    let d = sdEll(px, py, pz, 0, y(2.25), 0.24, 0.86, 0.78, 0.56);
    d = smin(d, sdEll(px, py, pz, 0, y(1.35), 0.3, 0.84, 0.82, 0.62), 0.35);
    d = smin(d, sdEll(ax, py, pz, 0.74, y(2.62), 0.18, 0.4, 0.33, 0.4), 0.3);       // 肩
    d = smin(d, sdCap(px, py, pz, neckA, neckB, 0.22, 0.2), 0.14);                 // 頸
    // 臂：上臂（袖）→ 肘 → 前臂 → 定印
    const sh = [0.93, y(2.52), 0.14], el = [1.17, y(1.36), 0.36], wr = [0.42, y(0.8), 0.96];
    d = smin(d, sdCap(ax, py, pz, sh, el, 0.29, 0.25), 0.18);
    d = smin(d, sdCap(ax, py, pz, el, wr, 0.23, 0.17), 0.14);
    d = smin(d, sdEll(ax, py, pz, 1.14, y(0.95), 0.62, 0.3, 0.46, 0.42), 0.22);      // 垂袖
    d = smin(d, sdEll(px, py, pz, 0, y(0.72), 1.0, 0.44, 0.085, 0.25), 0.07);        // 重ねた掌
    d = smin(d, sdCap(ax, py, pz, [0.13, y(0.76), 1.13], [0.015, y(0.9), 1.11], 0.042, 0.036), 0.04); // 拇指相接
    d = smin(d, sdCap(ax, py, pz, [0.42, y(0.74), 0.92], [0.34, y(0.73), 1.17], 0.05, 0.045), 0.05);
    // 結跏趺坐：膝・脛・足
    d = smin(d, sdEll(px, py, pz, 0, y(0.32), 0.62, 1.72, 0.38, 0.98), 0.3);
    d = smin(d, sdEll(ax, py, pz, 1.42, y(0.3), 0.98, 0.44, 0.33, 0.47), 0.25);
    d = smin(d, sdCap(px, py, pz, [-1.36, y(0.36), 1.12], [0.62, y(0.58), 0.98], 0.25, 0.2), 0.2);
    d = smin(d, sdCap(px, py, pz, [1.36, y(0.32), 1.0], [-0.6, y(0.5), 0.8], 0.25, 0.2), 0.2);
    d = smin(d, sdEll(px, py, pz, 0.66, y(0.64), 1.0, 0.34, 0.1, 0.19), 0.08);       // 足裏（右足上向き）
    d = smin(d, sdEll(px, py, pz, -0.68, y(0.58), 0.84, 0.32, 0.1, 0.18), 0.08);
    // 衣文（法衣の襞）
    let fold = 0;
    if (pz > -0.1 && py > y(0.9) && py < y(2.7)) { // 胸腹：左肩から右脇へ流れる弧
      const r = Math.hypot(px - 0.95, py - y(2.7));
      fold += 0.009 * Math.sin(r * 22) * sstep(y(0.9), y(1.3), py) * sstep(0.35, 0.0, Math.abs(px + 0.05 - (py - y(1.0)) * 0.25) - 0.25);
    }
    if (py < y(0.95)) { // 膝前：手を中心に同心の襞
      const r = Math.hypot(px, (pz - 0.95) * 1.4);
      fold += 0.011 * Math.sin(r * 15) * sstep(0.35, 0.7, r);
    }
    if (ax > 0.9 && py > y(0.4) && py < y(2.4)) fold += 0.008 * Math.sin((pz * 0.8 + py) * 16) * sstep(0.9, 1.1, ax); // 袖
    // 胸の衣縁（右肩から斜めに）
    const edge = px * 0.55 + (py - y(1.9)) * 0.85 - 0.12;
    if (pz > 0.1 && py > y(1.0)) fold -= 0.012 * ridge(edge, 0.03);
    // 三道（頸のしわ）
    if (py > y(2.7)) for (const yy of [headC[1] - 0.47, headC[1] - 0.53]) fold += 0.005 * ridge(py - yy, 0.008) * sstep(0.3, 0.1, ax);
    d += fold;
    return Math.max(d, S - 0.02 - py);
  };
}

/** Surface Nets：sdf 等值面 → indexed BufferGeometry（法線用梯度）。 */
function surfaceNets(sdf, [x0, y0, z0], [x1, y1, z1], cell) {
  const nx = Math.ceil((x1 - x0) / cell) + 1, ny = Math.ceil((y1 - y0) / cell) + 1, nz = Math.ceil((z1 - z0) / cell) + 1;
  const F = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    F[i + nx * (j + ny * k)] = sdf(x0 + i * cell, y0 + j * cell, z0 + k * cell);
  const cid = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const pos = [];
  const C = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const [a, b, e] = corners[c];
      v[c] = F[i + a + nx * (j + b + ny * (k + e))];
      if (v[c] < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      const A = corners[a], B = corners[b];
      sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t; n++;
    }
    cid[C(i, j, k)] = pos.length / 3;
    pos.push(x0 + (i + sx / n) * cell, y0 + (j + sy / n) * cell, z0 + (k + sz / n) * cell);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, d, c, a, c, b); else idx.push(a, b, c, a, c, d);
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const f0 = F[i + nx * (j + ny * k)] < 0;
    if (i < nx - 1 && j > 0 && k > 0 && j < ny - 1 && k < nz - 1) {
      const f1 = F[i + 1 + nx * (j + ny * k)] < 0;
      if (f0 !== f1) quad(cid[C(i, j - 1, k - 1)], cid[C(i, j, k - 1)], cid[C(i, j, k)], cid[C(i, j - 1, k)], f1);
    }
    if (j < ny - 1 && i > 0 && k > 0 && i < nx - 1 && k < nz - 1) {
      const f1 = F[i + nx * (j + 1 + ny * k)] < 0;
      if (f0 !== f1) quad(cid[C(i - 1, j, k - 1)], cid[C(i - 1, j, k)], cid[C(i, j, k)], cid[C(i, j, k - 1)], f1);
    }
    if (k < nz - 1 && i > 0 && j > 0 && i < nx - 1 && j < ny - 1) {
      const f1 = F[i + nx * (j + ny * (k + 1))] < 0;
      if (f0 !== f1) quad(cid[C(i - 1, j - 1, k)], cid[C(i, j - 1, k)], cid[C(i, j, k)], cid[C(i - 1, j, k)], f1);
    }
  }
  // 梯度法線
  const nor = new Float32Array(pos.length);
  const e = cell * 0.5;
  for (let p = 0; p < pos.length; p += 3) {
    const x = pos[p], y = pos[p + 1], z = pos[p + 2];
    let gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    nor[p] = gx / l; nor[p + 1] = gy / l; nor[p + 2] = gz / l;
  }
  // 依法線校正繞向
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * (nor[a] + nor[b] + nor[c]) + cy * (nor[a + 1] + nor[b + 1] + nor[c + 1]) + cz * (nor[a + 2] + nor[b + 2] + nor[c + 2]) < 0) {
      const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  return g;
}

// ═════════════════ 蓮台・石座・光背 ═════════════════
function petal(L, Wd, cup, bend) {
  return gridSurface(10, 14, (u, v) => {
    const w = u * 2 - 1, s = v;
    const half = Wd * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.72)), 0.85) * (1 - 0.15 * s);
    const lat = w * half;
    const outN = -cup * (1 - w * w) * Math.sin(Math.PI * Math.min(1, s * 1.1)) + 0.012 * ridge(w, 0.12) * (1 - s) + 0.008 * ridge(Math.abs(w) - 0.92, 0.08);
    // 沿長度向外彎
    const ang = bend * s * s;
    const along = s * L;
    const yy = along * Math.cos(ang * 0.5) , nn = along * Math.sin(ang * 0.5) * 0.9;
    return [lat, yy, nn + outN + bend * 0.04 * s ** 3];
  }, { uvf: (u, v) => [u * Wd * 2, v * L] });
}

function lotusPedestal() {
  const bronzeParts = [], stoneParts = [];
  // 石座：八角三段
  const oct = (r0, r1, y0, y1) => { const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, 8, 1); g.rotateY(Math.PI / 8); g.translate(0, (y0 + y1) / 2, 0); return meterUV(normalizeGeo(g), 'y'); };
  const base = SEAT * 0.5;
  stoneParts.push(oct(2.75, 2.7, 0, base * 0.36), oct(2.42, 2.42, base * 0.36, base * 0.82), oct(2.55, 2.6, base * 0.82, base));
  // 格狭間の浮彫（八面）
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const ap = 2.42 * Math.cos(Math.PI / 8);
    const g = box(1.2, base * 0.3, 0.05);
    g.applyMatrix4(M([Math.sin(a) * ap, base * 0.59, Math.cos(a) * ap], [0, a, 0]));
    stoneParts.push(g);
  }
  // 蓮台本體（青銅）
  const prof = [[0, base], [2.05, base], [2.12, base + 0.06], [1.62, base + 0.18], [1.48, base + 0.3], [1.5, base + 0.42], [1.7, base + 0.5],
    [1.75, SEAT - 0.32], [1.86, SEAT - 0.12], [1.98, SEAT - 0.06], [1.98, SEAT], [0, SEAT]].map(([r, y]) => new THREE.Vector2(r, y));
  bronzeParts.push(normalizeGeo(new THREE.LatheGeometry(prof, 64)));
  // 反花（下向きの蓮弁）
  const down = petal(0.5, 0.2, 0.035, 0.9);
  for (let k = 0; k < 24; k++) {
    const a = ((k + 0.5) * Math.PI * 2) / 24;
    const m = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeTranslation(0, base + 0.42, 1.55)).multiply(new THREE.Matrix4().makeRotationX(Math.PI - 0.95));
    const g = normalizeGeo(down.clone()); g.applyMatrix4(m); bronzeParts.push(g);
  }
  // 仰蓮三重
  const rows = [[base + 0.45, 1.5, 0.98, 22, 0], [base + 0.6, 1.62, 0.78, 22, 0.5], [base + 0.76, 1.74, 0.58, 22, 0]];
  for (const [y0, r0, lean, n, off] of rows) {
    const pg = petal(0.6, 0.27, 0.05, 0.7);
    for (let k = 0; k < n; k++) {
      const a = ((k + off) * Math.PI * 2) / n;
      const m = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeTranslation(0, y0, r0)).multiply(new THREE.Matrix4().makeRotationX(lean));
      const g = normalizeGeo(pg.clone()); g.applyMatrix4(m); bronzeParts.push(g);
    }
  }
  return { bronze: mergeGeometries(bronzeParts), stone: mergeGeometries(stoneParts) };
}

function halo(headC) {
  const parts = [];
  const zH = -0.82, yb = SEAT - 0.3, yt = headC[1] + 1.9;
  // 舟形の外形 + 火焔の縁
  const outline = [];
  const N = 220;
  for (let i = 0; i <= N; i++) {
    const t = i / N;              // 0 = 右下 → 0.5 = 頂 → 1 = 左下
    const s = t < 0.5 ? 1 : -1, q = t < 0.5 ? t * 2 : (1 - t) * 2; // q: 0 底 → 1 頂
    const y = yb + (yt - yb) * q;
    const wBase = 2.15 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.5 + q * 0.62)), 0.9) * (1 - Math.pow(q, 4) * 0.98);
    const flame = 0.13 * Math.pow(Math.abs(Math.sin(q * Math.PI * 9)), 0.6) * (0.4 + q * 0.6);
    outline.push(new THREE.Vector2(s * (wBase + flame), y));
  }
  const sh = new THREE.Shape(outline);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, zH - 0.04);
  parts.push(normalizeGeo(g));
  // 頭光：同心圓環 + 放射の筋 + 中心蓮華
  const zf = zH + 0.07;
  for (const r of [0.66, 0.9, 1.0]) { const t = new THREE.TorusGeometry(r, 0.03, 6, 72); t.translate(0, headC[1], zf); parts.push(normalizeGeo(t)); }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const b = box(0.04, 0.22, 0.025); b.applyMatrix4(M([Math.sin(a) * 0.78, headC[1] + Math.cos(a) * 0.78, zf], [0, 0, -a], [1, 1, 1], 'XYZ'));
    parts.push(b);
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const p = new THREE.SphereGeometry(0.16, 10, 6); p.scale(0.45, 1, 0.25); p.translate(0, 0.25, 0);
    p.rotateZ(-a); p.translate(0, headC[1], zf);
    parts.push(normalizeGeo(p));
  }
  // 身光：開いた円弧
  const bodyC = SEAT + 1.75;
  for (const r of [1.55, 1.7]) {
    const t = new THREE.TorusGeometry(r, 0.03, 6, 80, Math.PI * 1.52);
    t.rotateZ(Math.PI / 2 + Math.PI * 0.24);
    t.translate(0, bodyC, zf); parts.push(normalizeGeo(t));
  }
  { const c = new THREE.CylinderGeometry(0.64, 0.64, 0.03, 64); c.rotateX(Math.PI / 2); c.translate(0, headC[1], zf - 0.02); parts.push(normalizeGeo(c)); }
  const post = box(0.3, yt - yb - 1.5, 0.2); post.translate(0, (yb + yt - 1.5) / 2, zH - 0.2);
  return { gold: mergeGeometries(parts.map((p) => meterUV(p, 'y'))), post };
}

/** 建造佛像。materials: { bronze, bronzeDS, gold, stone } */
export function buildBuddha(materials) {
  const group = new THREE.Group();
  group.name = 'buddha';
  const F = [0, buddha.faceHeight - buddha.pos[1], buddha.faceForward];
  const rx = new THREE.Matrix4().makeRotationX(TILT);
  const off = new THREE.Vector3(...FACE_OFF).applyMatrix4(rx);
  const headC = [F[0] - off.x, F[1] - off.y, F[2] - off.z];

  // 佛身
  const sdf = makeBodySDF(headC);
  const body = surfaceNets(sdf, [-2.08, SEAT - 0.06, -0.72], [2.08, headC[1] - 0.05, 1.7], 0.027);
  const bodyMesh = new THREE.Mesh(body, materials.bronze);
  bodyMesh.castShadow = bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 佛頭
  const head = new THREE.Group();
  head.position.set(...headC);
  head.rotation.x = TILT;
  group.add(head);
  const hg = headGeometry();
  const ears = mergeGeometries([normalizeGeo(earGeometry(1)), normalizeGeo(earGeometry(-1))]);
  const hm = new THREE.Mesh(mergeGeometries([normalizeGeo(hg), ears]), materials.bronze);
  hm.castShadow = hm.receiveShadow = true;
  head.add(hm);
  // 螺髮
  const dirs = hairDirs();
  const curl = curlGeometry();
  const inst = new THREE.InstancedMesh(curl, materials.bronze, dirs.length);
  const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), mtx = new THREE.Matrix4();
  dirs.forEach((d, i) => {
    const p = headPoint(...d);
    // 法線：數值微分
    const e = 0.01;
    const t1 = new THREE.Vector3(...headPoint(...normalize([d[0] + e, d[1], d[2]]))).sub(new THREE.Vector3(...p));
    const t2 = new THREE.Vector3(...headPoint(...normalize([d[0], d[1] + e, d[2]]))).sub(new THREE.Vector3(...p));
    let n = new THREE.Vector3().crossVectors(t1, t2).normalize();
    if (n.dot(new THREE.Vector3(...p)) < 0) n.negate();
    if (!isFinite(n.x)) n = new THREE.Vector3(...d);
    q.setFromUnitVectors(up, n);
    const spin = new THREE.Quaternion().setFromAxisAngle(up, i * 2.399);
    mtx.compose(new THREE.Vector3(...p), q.clone().multiply(spin), new THREE.Vector3(1, 1, 1));
    inst.setMatrixAt(i, mtx);
  });
  inst.receiveShadow = true;
  head.add(inst);
  // 白毫
  const uy = 0.128 + FACE_OFF[1];
  const Y = uy / HR.y; const up0 = headPoint(0, Y, Math.sqrt(1 - Y * Y));
  const urna = new THREE.Mesh(new THREE.SphereGeometry(0.017, 20, 14), materials.gold);
  urna.position.set(up0[0], up0[1], up0[2] - 0.006);
  head.add(urna);

  // 蓮台・石座
  const ped = lotusPedestal();
  const pb = new THREE.Mesh(ped.bronze, materials.bronzeDS); pb.castShadow = pb.receiveShadow = true; group.add(pb);
  const ps = new THREE.Mesh(ped.stone, materials.stone); ps.castShadow = ps.receiveShadow = true; group.add(ps);
  // 光背
  const h = halo(headC);
  const hgm = new THREE.Mesh(h.gold, materials.gold); hgm.castShadow = hgm.receiveShadow = true; group.add(hgm);
  const post = new THREE.Mesh(h.post, materials.bronze); post.castShadow = true; group.add(post);

  return { group, headC };
}

function normalize(v) { const l = Math.hypot(...v); return v.map((x) => x / l); }
