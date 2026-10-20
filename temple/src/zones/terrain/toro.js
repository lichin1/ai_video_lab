// 地形分區：石燈籠（春日型）。基礎（反花）、竿（節）、中台（受花）、火袋（窓・日月・鹿）、笠（蕨手）、請花＋寶珠。
// 尺寸以 2.4 m 標準設計，再以 layout.toro.height / fireboxHeight 分段縮放，使整體外框等於 layout。
// hero 那座：高細分、表面雜訊起伏、風化與苔斑頂點色、火袋窗格、內部火光（1 盞 PointLight）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toro, paths } from '../../layout.js';
import { heightAt } from '../../ground.js';
import { mat, scaled } from '../../materials.js';
import { makeRng, makeNoise2D, fbm } from '../../rng.js';
import { shots } from '../../shots.js';
import { makeCanvas, toTexture, fillPixels, periodicFbm, periodicNoise, c255 } from './tex.js';
const ni = (g) => (g.index ? g.toNonIndexed() : g);

const DESIGN_H = 2.4, DESIGN_FB = 1.75;
const TAU = Math.PI * 2;
const SIX = TAU / 6;

/** 設計高度 y → 實際高度（火袋中心與總高對齊 layout）。 */
function mapY(y) {
  if (y <= DESIGN_FB) return y * (toro.fireboxHeight / DESIGN_FB);
  return toro.fireboxHeight + (y - DESIGN_FB) * ((toro.height - toro.fireboxHeight) / (DESIGN_H - DESIGN_FB));
}

/** 六角形：角半徑 R 時，方位 θ 的半徑。face 0 的中心在 θ = 0。回傳 [factor, φ]（φ 為離面中心的角度）。 */
function hexFactor(theta) {
  const phi = ((theta + SIX / 2) % SIX + SIX) % SIX - SIX / 2;
  return [Math.cos(SIX / 2) / Math.cos(phi), phi];
}

/**
 * 旋轉體（可為六角或圓）。rings: [{ r, y, hex?:bool, petal?:amp, drop?:amp, lift?:amp }]
 * θ 由北順時針（方向 (sinθ, -cosθ)），face 0 朝 θ=0。
 */
function revolve(rings, cols, disp) {
  const nR = rings.length;
  const pos = new Float32Array(nR * (cols + 1) * 3);
  const uv = new Float32Array(nR * (cols + 1) * 2);
  let arc = 0;
  for (let i = 0; i < nR; i++) {
    const rg = rings[i];
    if (i > 0) arc += Math.hypot(rg.r - rings[i - 1].r, rg.y - rings[i - 1].y);
    for (let j = 0; j <= cols; j++) {
      const th = (j / cols) * TAU;
      let r = rg.r, y = rg.y;
      const [hf, phi] = hexFactor(th);
      if (rg.hex) r *= hf;
      const corner = Math.abs(phi) / (SIX / 2); // 0 面中心 → 1 角
      if (rg.petal) r += rg.petal * Math.pow(Math.abs(Math.sin(6 * th)), 0.7);
      if (rg.drop) y -= rg.drop * Math.pow(Math.abs(Math.sin(6 * th)), 2.5);
      if (rg.lift) y += rg.lift * Math.pow(corner, 4);
      if (rg.flare) r += rg.flare * Math.pow(corner, 4);
      let x = Math.sin(th) * r, z = -Math.cos(th) * r;
      if (disp && r > 1e-4) { const k = disp(x, y, z); x *= k; z *= k; }
      const o = (i * (cols + 1) + j);
      pos[o * 3] = x; pos[o * 3 + 1] = y; pos[o * 3 + 2] = z;
      uv[o * 2] = th * 0.3; uv[o * 2 + 1] = arc;
    }
  }
  const idx = [];
  for (let i = 0; i < nR - 1; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + 1, c = a + cols + 1, d = c + 1;
    // 外表面朝外：rings 由下往上
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // 接縫（j=0 與 j=cols）法線平均
  const n = g.attributes.normal;
  for (let i = 0; i < nR; i++) {
    const a = i * (cols + 1), b = a + cols;
    const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z);
  }
  return g;
}

/** 設計座標的環列，套用 mapY。 */
const R = (r, y, o = {}) => ({ r, y: mapY(y), ...o });

function lanternRings(hero) {
  const pet = hero ? 1 : 0.8;
  // 基礎
  const base = [
    R(0, -0.05, { hex: true }), R(0.50, -0.05, { hex: true }), R(0.50, 0.19, { hex: true }), R(0.49, 0.215, { hex: true }), R(0.47, 0.225, { hex: true }),
    // 反花（往下翻的蓮瓣）
    R(0.47, 0.235, { hex: true, petal: 0.02 * pet, drop: 0.035 }),
    R(0.455, 0.265, { hex: true, petal: 0.03 * pet }),
    R(0.41, 0.30, { hex: true, petal: 0.028 * pet }),
    R(0.33, 0.33, { hex: true, petal: 0.02 * pet }),
    R(0.24, 0.35, { hex: true, petal: 0.008 * pet }),
    R(0.19, 0.36), R(0.185, 0.39), R(0.17, 0.405), R(0.13, 0.42),
  ];
  // 竿（圓柱，中段的節）
  const sh = [
    R(0.125, 0.42), R(0.12, 0.80), R(0.128, 0.815), R(0.138, 0.83), R(0.138, 0.845), R(0.13, 0.852), R(0.138, 0.86), R(0.138, 0.875),
    R(0.13, 0.882), R(0.138, 0.89), R(0.138, 0.905), R(0.128, 0.92), R(0.118, 0.935), R(0.112, 1.27),
  ];
  // 中台：受花往上張開 → 側面帶 → 上面
  const mid = [
    R(0.12, 1.27), R(0.15, 1.285, { hex: true, petal: 0.006 }), R(0.22, 1.31, { hex: true, petal: 0.018 * pet }),
    R(0.30, 1.345, { hex: true, petal: 0.024 * pet }), R(0.36, 1.38, { hex: true, petal: 0.02 * pet }),
    R(0.385, 1.405, { hex: true, petal: 0.01 * pet, drop: -0.02 }),
    R(0.40, 1.41, { hex: true }), R(0.405, 1.415, { hex: true }), R(0.405, 1.495, { hex: true }), R(0.395, 1.505, { hex: true }),
    R(0.36, 1.51, { hex: true }), R(0.33, 1.515, { hex: true }), R(0.32, 1.535, { hex: true }), R(0.30, 1.54, { hex: true }), R(0, 1.54, { hex: true }),
  ];
  // 笠：軒裏 → 軒口（角起翹）→ 凹曲屋面 → 露盤
  const kasa = [
    R(0, 1.955, { hex: true }), R(0.27, 1.955, { hex: true }), R(0.28, 1.965, { hex: true }), R(0.48, 1.985, { hex: true, lift: 0.02 }),
    R(0.53, 1.995, { hex: true, lift: 0.035, flare: 0.015 }), R(0.545, 2.01, { hex: true, lift: 0.05, flare: 0.02 }),
    R(0.545, 2.04, { hex: true, lift: 0.055, flare: 0.02 }), R(0.535, 2.05, { hex: true, lift: 0.055, flare: 0.015 }),
    R(0.46, 2.075, { hex: true, lift: 0.03 }), R(0.38, 2.10, { hex: true, lift: 0.012 }), R(0.29, 2.13, { hex: true }),
    R(0.2, 2.16, { hex: true }), R(0.13, 2.185, { hex: true }), R(0.115, 2.19, { hex: true }), R(0.115, 2.215, { hex: true }),
    R(0.1, 2.22, { hex: true }), R(0, 2.22, { hex: true }),
  ];
  // 請花 + 寶珠（圓）
  const top = [
    R(0, 2.215), R(0.06, 2.22), R(0.08, 2.235, { petal: 0.008 }), R(0.095, 2.255, { petal: 0.012 }), R(0.09, 2.265), R(0.06, 2.27),
    R(0.07, 2.285), R(0.085, 2.31), R(0.086, 2.33), R(0.075, 2.355), R(0.05, 2.375), R(0.022, 2.39), R(0.006, 2.398), R(0, 2.4),
  ];
  return { base, sh, mid, kasa, top };
}

// ── 火袋 ───────────────────────────────────────────────────────────
const FB = { R: 0.285, y0: 1.54, y1: 1.955, t: 0.045 };
const WIN = { hw: 0.08, hh: 0.095, dy: 0.0 };

/** 格狹間輪廓（半寬 w，y 從 y0 到 y1）。 */
function kozaOutline(w, y0, y1) {
  const H = y1 - y0;
  const half = [[0, 0.8], [0.08, 0.9], [0.25, 0.99], [0.45, 1.0], [0.6, 0.92], [0.64, 0.8], [0.8, 0.78], [0.93, 0.7], [1, 0.55], [1, 0.0], [0.78, 0.0], [0.72, 0.1]];
  const pts = [];
  for (const [x, y] of half) pts.push([x * w, y0 + y * H]);
  pts.push([0, y0 + 0.1 * H]);
  for (let i = half.length - 1; i >= 1; i--) pts.push([-half[i][0] * w, y0 + half[i][1] * H]);
  return pts;
}

function deerShape(s, cx, cy, flip) {
  const pts = [[-0.5, 0.3], [-0.55, 0.22], [-0.48, 0.15], [-0.46, -0.05], [-0.44, -0.45], [-0.4, -0.45], [-0.36, -0.08], [-0.3, -0.06],
    [-0.28, -0.45], [-0.24, -0.45], [-0.22, -0.02], [0.15, -0.02], [0.17, -0.45], [0.21, -0.45], [0.23, -0.04], [0.27, -0.04],
    [0.3, -0.45], [0.34, -0.45], [0.33, 0.02], [0.38, 0.15], [0.42, 0.35], [0.48, 0.52], [0.62, 0.52], [0.63, 0.57], [0.52, 0.64],
    [0.5, 0.7], [0.47, 0.86], [0.44, 0.87], [0.46, 0.72], [0.44, 0.66], [0.36, 0.68], [0.4, 0.61], [0.3, 0.38], [0, 0.33], [-0.3, 0.32]];
  return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(cx + (flip ? -x : x) * s, cy + (y - 0.2) * s)));
}

function rectPath(x0, y0, x1, y1, P = new THREE.Path()) {
  P.moveTo(x0, y0); P.lineTo(x1, y0); P.lineTo(x1, y1); P.lineTo(x0, y1); P.lineTo(x0, y0);
  return P;
}

/** 單一面板（面板座標：x 橫、y 高（實際高度）、外表面 z=0，厚度往 -z）。 */
function panelGeometry(kind, hero) {
  const y0 = mapY(FB.y0), y1 = mapY(FB.y1), h = y1 - y0;
  const E = FB.R;                 // 六角邊長 = 角半徑
  const bev = hero ? 0.005 : 0.003;
  const hw = E / 2 - bev;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, bev); shape.lineTo(hw, bev); shape.lineTo(hw, h - bev); shape.lineTo(-hw, h - bev); shape.lineTo(-hw, bev);
  const cy = h * 0.5;
  const wy = cy + WIN.dy;
  const extras = [];
  const relief = (outer, inner, depth, z0 = 0) => {
    const sh = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
    if (inner) sh.holes.push(new THREE.Path(inner.map(([x, y]) => new THREE.Vector2(x, y))));
    const eg = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 4 });
    eg.translate(0, 0, z0);
    extras.push(eg);
  };
  const rect = (x0, y0_, x1, y1_) => [[x0, y0_], [x1, y0_], [x1, y1_], [x0, y1_]];
  if (kind !== 'deer') {
    // 腰板的格狹間（浮起的輪廓線）
    const ky0 = 0.035, ky1 = wy - WIN.hh - 0.03;
    const kz = kozaOutline(0.092, ky0, ky1);
    const ki = kozaOutline(0.092 - 0.009, ky0 + 0.008, ky1 - 0.008);
    relief(kz, ki, 0.006);
  }
  if (kind === 'window' || kind === 'open') {
    shape.holes.push(rectPath(-WIN.hw, wy - WIN.hh, WIN.hw, wy + WIN.hh));
    // 窓枠（窗緣浮起）
    relief(rect(-WIN.hw - 0.014, wy - WIN.hh - 0.014, WIN.hw + 0.014, wy + WIN.hh + 0.014), rect(-WIN.hw, wy - WIN.hh, WIN.hw, wy + WIN.hh), 0.007);
  } else if (kind === 'sun') {
    const p = new THREE.Path(); p.absarc(0, wy, 0.062, 0, TAU, false); shape.holes.push(p);
    const ring = [], inner = [];
    for (let i = 0; i < 32; i++) { const a = (i / 32) * TAU; ring.push([Math.cos(a) * 0.076, wy + Math.sin(a) * 0.076]); inner.push([Math.cos(a) * 0.062, wy + Math.sin(a) * 0.062]); }
    relief(ring, inner, 0.006);
  } else if (kind === 'moon') {
    const p = new THREE.Path();
    const N = 20, a0 = 63 * Math.PI / 180, b0 = 92.5 * Math.PI / 180;
    for (let i = 0; i <= N; i++) { const a = a0 + (TAU - 2 * a0) * (i / N); const x = Math.cos(a) * 0.065, y = Math.sin(a) * 0.065; i ? p.lineTo(x, wy + y) : p.moveTo(x, wy + y); }
    for (let i = 0; i <= N; i++) { const a = (TAU - b0) - (TAU - 2 * b0) * (i / N); p.lineTo(0.032 + Math.cos(a) * 0.058, wy + Math.sin(a) * 0.058); }
    shape.holes.push(p);
  } else if (kind === 'deer') {
    // 淺浮雕：外框 + 內凹板面 + 鹿形浮起
    shape.holes.push(rectPath(-0.09, cy - 0.15, 0.09, cy + 0.15));
    const field = new THREE.Shape(); rectPath(-0.092, cy - 0.152, 0.092, cy + 0.152, field);
    const fg = new THREE.ExtrudeGeometry(field, { depth: FB.t - 0.014, bevelEnabled: false });
    fg.translate(0, 0, -FB.t);
    extras.push(fg);
    const dg = new THREE.ExtrudeGeometry(deerShape(0.18, 0, cy - 0.02, false), { depth: 0.011, bevelEnabled: hero, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 2 });
    dg.translate(0, 0, -0.014 - 0.0005);
    extras.push(dg);
    // 鹿腳下的雲紋
    const cloud = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; cloud.push([-0.075 + t * 0.15, cy - 0.125 + 0.012 * Math.abs(Math.sin(t * Math.PI * 3))]); }
    cloud.push([0.075, cy - 0.14], [-0.075, cy - 0.14]);
    relief(cloud, null, 0.008, -0.014);
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: FB.t - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: hero ? 2 : 1, curveSegments: hero ? 24 : 12,
  });
  g.translate(0, 0, -FB.t + bev);
  const all = [g, ...extras].map((x) => { const n = ni(x); n.deleteAttribute('normal'); n.computeVertexNormals(); return n; });
  return { geo: mergeGeometries(all), y0 };
}

/** 窗格（木格子）：在面板座標中。 */
function latticeGeometry(hero) {
  const y0 = mapY(FB.y0), y1 = mapY(FB.y1), cy = (y1 - y0) * 0.5 + WIN.dy;
  const parts = [];
  const nV = hero ? 4 : 3;
  for (let i = 1; i <= nV; i++) {
    const x = -WIN.hw + (2 * WIN.hw * i) / (nV + 1);
    const b = new THREE.BoxGeometry(0.007, WIN.hh * 2 + 0.004, 0.012); b.translate(x, cy, -FB.t * 0.55); parts.push(b);
  }
  for (const yy of [-0.035, 0.035]) {
    const b = new THREE.BoxGeometry(WIN.hw * 2 + 0.004, 0.007, 0.012); b.translate(0, cy + yy, -FB.t * 0.55); parts.push(b);
  }
  return mergeGeometries(parts.map((p) => ni(p)));
}

/** 把面板座標轉到燈籠座標：外表面在 apothem，朝方位 φ。 */
function placePanel(g, phi, y0) {
  const a = FB.R * Math.cos(SIX / 2);
  const m = new THREE.Matrix4().makeRotationY(Math.PI - phi);
  m.setPosition(Math.sin(phi) * a, y0, -Math.cos(phi) * a);
  return g.clone().applyMatrix4(m);
}

// ── 蕨手（笠角的捲曲） ───────────────────────────────────────────
function warabiteGeometry(hero) {
  const out = [];
  const rr = 0.545 + 0.02; // 角的半徑（含 flare）
  for (let k = 0; k < 6; k++) {
    const th = SIX / 2 + k * SIX; // 角
    const dir = new THREE.Vector3(Math.sin(th), 0, -Math.cos(th));
    const base = dir.clone().multiplyScalar(rr * 0.97);
    const yb = mapY(2.05) + 0.055 * 0.98;
    const pts = [];
    const N = 9;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      // 從軒口往外上方伸出，再向內捲成一圈
      const ang = -0.3 + t * 4.4;
      const rad = 0.04 * (1 - 0.55 * t);
      const out1 = 0.015 + rad * Math.sin(ang) * 0.9 - t * 0.02;
      const up = 0.012 + rad * (1 - Math.cos(ang)) * 0.9;
      pts.push(base.clone().addScaledVector(dir, out1).add(new THREE.Vector3(0, yb + up - 0.02, 0)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, hero ? 18 : 8, hero ? 0.017 : 0.016, hero ? 8 : 5, false);
    out.push(ni(tube));
    // 起點的根部
    const knob = new THREE.SphereGeometry(0.02, hero ? 8 : 5, hero ? 6 : 4);
    knob.translate(pts[0].x, pts[0].y, pts[0].z);
    out.push(ni(knob));
  }
  return mergeGeometries(out.map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; }));
}

// ── 風化頂點色 ─────────────────────────────────────────────────────
const nA = makeNoise2D('toro-weather-a'), nB = makeNoise2D('toro-weather-b'), nC = makeNoise2D('toro-weather-c');
/** g 已在世界座標；yBase 為該座燈籠的地面高。 */
function weatherColors(g, yBase, hero) {
  const p = g.attributes.position, n = g.attributes.normal;
  const col = new Float32Array(p.count * 3);
  const v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    nn.fromBufferAttribute(n, i).normalize();
    const y = v.y - yBase;
    const s = hero ? 1 : 0.6;
    const f1 = fbm(nA, v.x * 7 + y * 3.1, v.z * 7 - y * 2.3, 4);
    const f2 = fbm(nB, v.x * 23 - y * 5, v.z * 23 + y * 7, 3);
    const f3 = nC(v.x * 60 + y * 11, v.z * 60 - y * 13);
    // 基本石色（花崗岩，偏暖灰），整體老化變暗
    let r = 0.78, gg = 0.8, b = 0.84;
    const age = 0.82 + f1 * 0.12;
    r *= age; gg *= age; b *= age;
    // 雨漬：笠與中台下方的垂直暗紋
    const streak = Math.max(0, fbm(nB, v.x * 40 + v.z * 40, y * 1.5, 2)) * (y < mapY(1.95) ? 1 : 0.3);
    r -= streak * 0.18; gg -= streak * 0.17; b -= streak * 0.15;
    // 地面附近泥污與濕氣
    const low = Math.max(0, 1 - y / 0.35);
    r -= low * 0.18; gg -= low * 0.16; b -= low * 0.17;
    // 苔：朝上的面、雜訊斑塊
    const up = Math.max(0, nn.y);
    const mossK = Math.min(1, Math.max(0, (f1 * 1.4 + f2 * 0.5 + up * 0.9 + low * 0.6 - 0.55) * 2.2)) * (0.35 + 0.65 * up + low * 0.5);
    const mr = 0.27 + f3 * 0.03, mg = 0.36 + f3 * 0.05, mb = 0.14;
    r = r * (1 - mossK) + mr * mossK; gg = gg * (1 - mossK) + mg * mossK; b = b * (1 - mossK) + mb * mossK;
    // 地衣：淡黃白小斑
    const lich = Math.max(0, f2 * 2.2 - 1.05) * s * (1 - mossK);
    r += lich * 0.22; gg += lich * 0.2; b += lich * 0.1;
    // 細小黑點（風化坑）
    if (f3 > 0.72) { const k = 0.85; r *= k; gg *= k; b *= k; }
    col[i * 3] = Math.max(0.05, r); col[i * 3 + 1] = Math.max(0.05, gg); col[i * 3 + 2] = Math.max(0.05, b);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/** 石面凹凸：細顆粒 + 小坑 + 淺裂紋。 */
function stoneBump() {
  const S = 512, cv = makeCanvas(S), g = cv.getContext('2d');
  const A = periodicFbm('toro-bump-a', 8, 4), Bn = periodicNoise('toro-bump-b', 128), C = periodicFbm('toro-bump-c', 3, 3);
  const r = makeRng('toro-bump-pits');
  fillPixels(g, S, (u, v) => {
    let k = 0.5 + (A(u, v) - 0.5) * 0.5 + (Bn(u, v) - 0.5) * 0.35;
    const crack = Math.abs(C(u, v) - 0.5);
    if (crack < 0.012) k -= (0.012 - crack) * 18;
    return [c255(k * 255), c255(k * 255), c255(k * 255)];
  });
  for (let i = 0; i < 900; i++) {
    const x = r() * S, y = r() * S, rad = 0.8 + r() * r() * 4;
    g.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.4})`;
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  return toTexture(cv, { srgb: false });
}

/** 燈籠石材：花崗岩斑晶 + 地衣斑 + 黑色老化斑（以公尺 uv 平鋪）。 */
function lanternStoneTexture() {
  const S = 512, cv = makeCanvas(S), g = cv.getContext('2d');
  const T = periodicFbm('toro-tex-t', 4, 5), L = periodicFbm('toro-tex-l', 6, 5), D = periodicFbm('toro-tex-d', 3, 4);
  const sp = periodicNoise('toro-tex-sp', 256);
  fillPixels(g, S, (u, v) => {
    let k = 0.88 + (T(u, v) - 0.5) * 0.35;
    const s = sp(u, v);
    let r = 168 * k, gg = 166 * k, b = 162 * k;
    if (s > 0.8) { r *= 0.55; gg *= 0.55; b *= 0.58; } else if (s < 0.12) { r *= 1.12; gg *= 1.12; b *= 1.1; }
    // 黑色老化斑（雨水與煤）
    const dk = Math.max(0, (D(u, v) - 0.55) * 3);
    r *= 1 - dk * 0.45; gg *= 1 - dk * 0.45; b *= 1 - dk * 0.42;
    // 地衣：淡黃綠灰的斑塊，邊緣不規則
    const l = L(u, v);
    if (l > 0.63) { const t = Math.min(1, (l - 0.63) * 10) * 0.75; r = r * (1 - t) + 178 * t; gg = gg * (1 - t) + 180 * t; b = b * (1 - t) + 162 * t; }
    else if (l < 0.33) { const t = Math.min(1, (0.33 - l) * 10) * 0.8; r = r * (1 - t) + 120 * t; gg = gg * (1 - t) + 128 * t; b = b * (1 - t) + 96 * t; }
    return [c255(r), c255(gg), c255(b)];
  });
  return toTexture(cv);
}

function glowSprite() {
  const S = 128, cv = makeCanvas(S), g = cv.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,200,120,1)'); gr.addColorStop(0.25, 'rgba(255,150,60,0.45)');
  gr.addColorStop(0.6, 'rgba(255,110,30,0.1)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const t = toTexture(cv); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function stripAttrs(g) {
  const h = g.index ? ni(g) : g;
  for (const k of Object.keys(h.attributes)) if (!['position', 'normal', 'uv'].includes(k)) h.deleteAttribute(k);
  if (!h.attributes.uv) h.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
  return h;
}

/** 燈籠的石頭本體（不含火光），local 座標，原點在地面中心。 */
function lanternStone(hero, seed) {
  const rings = lanternRings(hero);
  const cols = hero ? 6 * 14 : 6 * 4;
  const colsRound = hero ? 72 : 20;
  const nz = makeNoise2D(seed);
  const disp = hero ? (x, y, z) => 1 + 0.012 * fbm(nz, x * 9 + y * 4, z * 9 - y * 4, 3) + 0.004 * nz(x * 60 + y * 20, z * 60) : null;
  const parts = [
    revolve(rings.base, cols, disp),
    revolve(rings.sh, colsRound, disp),
    revolve(rings.mid, cols, disp),
    revolve(rings.kasa, cols, disp),
    revolve(rings.top, colsRound, disp),
  ];
  // 火袋面板：0 前窗（格子）、3 後窗、1 日、4 月、2/5 鹿
  const kinds = ['window', 'sun', 'deer', 'open', 'moon', 'deer'];
  for (let k = 0; k < 6; k++) {
    const { geo, y0 } = panelGeometry(kinds[k], hero);
    parts.push(placePanel(geo, k * SIX, y0));
  }
  // 六根角柱，蓋住面板接縫
  const y0 = mapY(FB.y0), y1 = mapY(FB.y1);
  for (let k = 0; k < 6; k++) {
    const th = SIX / 2 + k * SIX;
    const post = new THREE.CylinderGeometry(0.018, 0.018, y1 - y0, hero ? 6 : 4);
    post.translate(Math.sin(th) * (FB.R - 0.012), (y0 + y1) / 2, -Math.cos(th) * (FB.R - 0.012));
    parts.push(post);
  }
  parts.push(warabiteGeometry(hero));
  return mergeGeometries(parts.map(stripAttrs));
}

function frontAzimuth(x, z) {
  // 朝向最近的參道中心線
  let best = Infinity, tx = 0, tz = 0;
  for (const p of paths) for (let i = 0; i < p.pts.length - 1; i++) {
    const [ax, az] = p.pts[i], [bx, bz] = p.pts[i + 1];
    const vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    const qx = ax + vx * t, qz = az + vz * t;
    const d = Math.hypot(x - qx, z - qz);
    if (d < best) { best = d; tx = qx; tz = qz; }
  }
  return Math.atan2(tx - x, -(tz - z));
}

export function buildLanterns() {
  const group = new THREE.Group();
  group.name = 'terrain-toro';
  const stoneM = mat.stone.clone();
  stoneM.map = lanternStoneTexture();
  stoneM.map.repeat.set(1.4, 1.4);
  stoneM.vertexColors = true;
  stoneM.roughness = 0.93;
  stoneM.bumpMap = stoneBump();
  stoneM.bumpMap.repeat.set(2.5, 2.5);
  stoneM.bumpScale = 2.2;
  const latticeM = mat.wood.clone();
  latticeM.color = new THREE.Color(0.32, 0.24, 0.18);
  const glowM = mat.paper.clone();
  glowM.side = THREE.FrontSide;
  glowM.emissiveIntensity = 2.4;
  glowM.color = new THREE.Color(0.9, 0.75, 0.5);

  const nonHero = [];
  const flames = [];
  const r = makeRng('toro-place');
  let heroParts = null;
  const heroAz = (shots[0]?.near?.az ?? 15) * Math.PI / 180;

  toro.positions.forEach(([x, y0, z], i) => {
    const hero = i === toro.heroIndex;
    const az = hero ? heroAz : frontAzimuth(x, z) + (r() - 0.5) * 0.04;
    const yg = Math.min(heightAt(x, z), heightAt(x + 0.4, z), heightAt(x - 0.4, z), heightAt(x, z + 0.4), heightAt(x, z - 0.4));
    const world = new THREE.Matrix4().compose(new THREE.Vector3(x, yg + y0 - 0.02, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -az), new THREE.Vector3(1, 1, 1));
    const g = lanternStone(hero, `toro-${i}`);
    g.applyMatrix4(world);
    weatherColors(g, yg, hero);
    if (hero) heroParts = { g, world, az, x, z, yg };
    else nonHero.push(g);
    // 火袋內：油皿 + 火焰
    // 火皿：立在小石台上，火焰落在窗的下緣附近
    const fy = mapY(FB.y0) + 0.105;
    const dish = mergeGeometries([
      ni(new THREE.CylinderGeometry(0.03, 0.04, fy - mapY(FB.y0) - 0.02, hero ? 12 : 6)).translate(0, (fy + mapY(FB.y0) - 0.02) / 2, 0),
      ni(new THREE.CylinderGeometry(0.05, 0.035, 0.025, hero ? 16 : 8)).translate(0, fy - 0.0075, 0),
    ].map((x) => { x.deleteAttribute('uv'); x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); return x; }));
    dish.applyMatrix4(world);
    const dishPart = stripAttrs(dish);
    weatherColors(dishPart, yg, false);
    if (hero) heroParts.dish = dishPart; else nonHero.push(dishPart);
    flames.push({ world, hero, fy: fy + 0.005, seed: r() * 100 });
    // 窗格
    const lat = placePanel(latticeGeometry(hero), 0, mapY(FB.y0)).applyMatrix4(world);
    (hero ? (heroParts.lattice = lat) : (group.userData.lat ||= []).push(lat));
    // 非 hero：內部發光襯紙（從窗與日月孔透出）
    if (!hero) {
      const a = FB.R * Math.cos(SIX / 2) - FB.t - 0.004;
      const liner = new THREE.CylinderGeometry(a / Math.cos(SIX / 2), a / Math.cos(SIX / 2), mapY(FB.y1) - mapY(FB.y0) - 0.01, 6, 1, true);
      liner.rotateY(Math.PI / 6);
      liner.translate(0, (mapY(FB.y0) + mapY(FB.y1)) / 2, 0);
      liner.applyMatrix4(world);
      (group.userData.liners ||= []).push(stripAttrs(liner));
    }
  });

  const nonHeroGeo = mergeGeometries(nonHero);
  const nh = new THREE.Mesh(nonHeroGeo, stoneM);
  nh.name = 'toro-stone';
  nh.castShadow = true; nh.receiveShadow = true;
  group.add(nh);

  const heroMesh = new THREE.Mesh(mergeGeometries([heroParts.g, heroParts.dish]), stoneM);
  heroMesh.name = 'toro-hero';
  heroMesh.castShadow = true; heroMesh.receiveShadow = true;
  group.add(heroMesh);

  const latMesh = new THREE.Mesh(mergeGeometries([heroParts.lattice, ...group.userData.lat].map(stripAttrs)), latticeM);
  latMesh.castShadow = false; latMesh.receiveShadow = true;
  group.add(latMesh);

  const linerM = glowM.clone(); linerM.side = THREE.BackSide;
  const liners = new THREE.Mesh(mergeGeometries(group.userData.liners), linerM);
  liners.name = 'toro-liners';
  group.add(liners);
  delete group.userData.lat; delete group.userData.liners;

  // 火焰（每座一個，t 驅動搖曳）
  const flameGeo = new THREE.LatheGeometry([[0, 0], [0.011, 0.006], [0.017, 0.022], [0.015, 0.04], [0.008, 0.058], [0.002, 0.07], [0, 0.074]].map(([a, b]) => new THREE.Vector2(a, b)), 12);
  const coreGeo = new THREE.LatheGeometry([[0, 0], [0.006, 0.004], [0.008, 0.016], [0.004, 0.03], [0, 0.034]].map(([a, b]) => new THREE.Vector2(a, b)), 8);
  const flameOuterM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.3, 0.35), transparent: true, opacity: 0.85, depthWrite: false });
  const haloM = new THREE.SpriteMaterial({ map: glowSprite(), color: new THREE.Color(1.0, 0.8, 0.6), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const flameObjs = [];
  for (const f of flames) {
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = false;
    holder.matrix.copy(f.world);
    const fl = new THREE.Mesh(flameGeo, flameOuterM);
    fl.position.y = f.fy;
    const core = new THREE.Mesh(coreGeo, mat.flame);
    core.position.y = f.fy + 0.002;
    holder.add(fl, core);
    if (f.hero) {
      const halo = new THREE.Sprite(haloM);
      halo.scale.set(0.16, 0.16, 1);
      halo.position.y = f.fy + 0.035;
      holder.add(halo);
    }
    group.add(holder);
    flameObjs.push({ fl, core, f });
  }

  // hero 燈籠內的 PointLight（不投影）
  const hf = flames.find((f) => f.hero);
  const light = new THREE.PointLight(0xff9a48, 0.16, 6, 2);
  light.castShadow = false;
  const lp = new THREE.Vector3(0, hf.fy + 0.1, 0).applyMatrix4(hf.world);
  light.position.copy(lp);
  group.add(light);

  function update(t) {
    for (const { fl, core, f } of flameObjs) {
      const w = Math.sin(t * 11.3 + f.seed) * 0.5 + Math.sin(t * 17.9 + f.seed * 1.7) * 0.3 + Math.sin(t * 5.1 + f.seed * 0.3) * 0.2;
      const sy = 1 + 0.12 * w;
      fl.scale.set(1 - 0.05 * w, sy, 1 - 0.05 * w);
      fl.rotation.z = 0.06 * Math.sin(t * 3.7 + f.seed);
      fl.rotation.x = 0.05 * Math.sin(t * 2.9 + f.seed * 2.1);
      core.scale.set(1, 1 + 0.08 * w, 1);
    }
    const w = Math.sin(t * 11.3 + hf.seed) * 0.5 + Math.sin(t * 17.9 + hf.seed * 1.7) * 0.3 + Math.sin(t * 5.1 + hf.seed * 0.3) * 0.2;
    light.intensity = 0.16 * (1 + 0.1 * w);
  }
  return { object: group, update, light };
}
