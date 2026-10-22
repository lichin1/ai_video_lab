// 池塘分區用的程式幾何與紋理：荷葉、花瓣、蓮蓬＋花蕊、花苞、管狀曲線。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng, makeNoise2D, fbm } from '../../rng.js';

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const clamp255 = (v) => Math.max(0, Math.min(255, v | 0));

export function canvasTex(w, h, draw, { srgb = true, wrap = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ── 荷葉紋理：中心淡黃綠、放射狀主脈分岔、細網脈、葉緣略黃 ─────────────
export function leafTexture() {
  return canvasTex(512, 512, (g, W) => {
    const n = makeNoise2D('pond-leaf-tex');
    const r = makeRng('pond-leaf-tex');
    const img = g.createImageData(W, W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const u = x / W * 2 - 1, v = y / W * 2 - 1;
      const rad = Math.hypot(u, v), ang = Math.atan2(v, u);
      const mott = fbm(n, u * 6, v * 6, 4);
      const cell = Math.abs(n(u * 38, v * 38)) ;            // 細網脈（亮線）
      const base = [44, 82, 30];
      const center = [118, 140, 58];
      const k = smooth(0.0, 0.35, rad);
      let c = center.map((cv, i) => cv * (1 - k) + base[i] * k);
      // 葉緣：偏黃、略帶褐
      const rim = smooth(0.86, 0.99, rad);
      c = c.map((cv, i) => cv * (1 - rim * 0.45) + [120, 112, 46][i] * rim * 0.45);
      const shade = 1 + mott * 0.16 + (cell < 0.06 ? 0.08 : 0) + Math.sin(ang * 21) * 0.015;
      const i4 = (y * W + x) * 4;
      img.data[i4] = clamp255(c[0] * shade); img.data[i4 + 1] = clamp255(c[1] * shade); img.data[i4 + 2] = clamp255(c[2] * shade); img.data[i4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // 主脈：21 條放射，外 1/3 分岔
    const C = W / 2;
    g.lineCap = 'round';
    for (let k = 0; k < 21; k++) {
      const a = (k / 21) * Math.PI * 2 + 0.07;
      const jitter = (r() - 0.5) * 0.05;
      g.strokeStyle = 'rgba(160,182,100,0.42)';
      g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(C, C);
      const mid = 0.62 * C;
      g.quadraticCurveTo(C + Math.cos(a + jitter) * mid * 0.5, C + Math.sin(a + jitter) * mid * 0.5, C + Math.cos(a) * mid, C + Math.sin(a) * mid);
      g.stroke();
      g.lineWidth = 1.8;
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(C + Math.cos(a) * mid, C + Math.sin(a) * mid);
        const a2 = a + s * (0.07 + r() * 0.04);
        g.quadraticCurveTo(C + Math.cos(a2) * C * 0.8, C + Math.sin(a2) * C * 0.8, C + Math.cos(a2 + s * 0.02) * C * 0.97, C + Math.sin(a2 + s * 0.02) * C * 0.97);
        g.stroke();
      }
      // 次脈：連接相鄰主脈的細弧
      g.strokeStyle = 'rgba(150,175,95,0.25)'; g.lineWidth = 1;
      for (let q = 0; q < 5; q++) {
        const rr = C * (0.25 + q * 0.14 + r() * 0.04);
        g.beginPath(); g.arc(C, C, rr, a, a + (Math.PI * 2) / 21); g.stroke();
      }
    }
    // 中心臍點
    const grd = g.createRadialGradient(C, C, 0, C, C, 14);
    grd.addColorStop(0, 'rgba(190,198,128,0.8)'); grd.addColorStop(1, 'rgba(160,180,100,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(C, C, 14, 0, Math.PI * 2); g.fill();
    // 少許褐斑
    for (let k = 0; k < 9; k++) {
      const a = r() * Math.PI * 2, rr = C * (0.55 + r() * 0.4), s = 3 + r() * 9;
      g.fillStyle = `rgba(${90 + r() * 30},${70 + r() * 20},30,${0.25 + r() * 0.3})`;
      g.beginPath(); g.arc(C + Math.cos(a) * rr, C + Math.sin(a) * rr, s, 0, Math.PI * 2); g.fill();
    }
  });
}

/**
 * 荷葉（半徑 1）。notch：缺口角寬（弧度，缺口朝 +X）；curl：葉緣上捲；cup：整體碗形；wave：葉緣波浪。
 */
export function leafGeometry({ segA = 32, segR = 7, notch = 0.22, curl = 0.05, cup = 0, wave = 0.015, seed = 1 } = {}) {
  const pos = [], uv = [], idx = [];
  const a0 = notch / 2, a1 = Math.PI * 2 - notch / 2;
  const yAt = (r, a) => cup * r * r + curl * smooth(0.7, 1.0, r) ** 2 * (0.75 + 0.25 * Math.sin(5 * a + seed))
    + wave * r ** 3 * Math.sin(9 * a + seed * 2.3) - 0.012 * (1 - smooth(0, 0.25, r)) * (cup > 0 ? 0 : 1);
  pos.push(0, yAt(0, 0), 0); uv.push(0.5, 0.5);
  for (let j = 1; j <= segR; j++) {
    const r = j / segR;
    for (let i = 0; i <= segA; i++) {
      const a = a0 + (a1 - a0) * (i / segA);
      // 缺口兩側邊緣略為內收，缺口呈 V 形
      const rr = r * (1 - 0.06 * Math.exp(-Math.min(i, segA - i) * 1.3) * r);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      pos.push(x, yAt(r, a), z); uv.push(0.5 + 0.5 * x, 0.5 - 0.5 * z);
    }
  }
  const row = segA + 1;
  for (let i = 0; i < segA; i++) idx.push(0, 1 + i + 1, 1 + i);
  for (let j = 1; j < segR; j++) {
    const o0 = 1 + (j - 1) * row, o1 = 1 + j * row;
    for (let i = 0; i < segA; i++) idx.push(o0 + i, o0 + i + 1, o1 + i, o0 + i + 1, o1 + i + 1, o1 + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ── 花瓣紋理：基部乳白微黃綠 → 中段白粉 → 尖端洋紅粉；縱向細脈 ─────────
export function petalTexture() {
  return canvasTex(256, 512, (g, W, H) => {
    const n = makeNoise2D('pond-petal-tex');
    const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / (W - 1) * 2 - 1;    // 橫向 -1..1
      const v = 1 - y / (H - 1);        // 0 基部 → 1 尖端
      const base = [238, 240, 210], mid = [252, 244, 242], tip = [230, 104, 146];
      const edge = Math.abs(u);
      const pink = smooth(0.42, 1.02, v + edge * 0.3 * v) ** 1.35;
      let c;
      if (v < 0.22) c = base.map((b, i) => b * (1 - v / 0.22) + mid[i] * (v / 0.22));
      else c = mid;
      c = c.map((cv, i) => cv * (1 - pink) + tip[i] * pink);
      // 縱向脈：向基部與尖端收攏
      const conv = u / Math.max(0.15, Math.sin(Math.PI * Math.min(0.98, v * 0.9 + 0.05)));
      const vein = Math.pow(Math.abs(Math.cos(conv * Math.PI * 6.5)), 14);
      const vk = 1 - vein * (0.10 + 0.12 * pink);
      const nn = 1 + fbm(n, u * 3, v * 9, 3) * 0.05;
      const i4 = (y * W + x) * 4;
      img.data[i4] = clamp255(c[0] * vk * nn);
      img.data[i4 + 1] = clamp255(c[1] * (vk - vein * 0.06 * pink) * nn);
      img.data[i4 + 2] = clamp255(c[2] * vk * nn);
      img.data[i4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}

/**
 * 單片花瓣，基部在原點，向 +X（徑向外）與 +Y 生長。
 * tilt0/tilt1：基部/尖端與垂直的夾角（弧度）；cup：橫向凹度；tipCurl：尖端內扣（負值）或外翻。
 */
export function petalGeometry({ L, W, segU = 8, segV = 10, tilt0, tilt1, cup = 0.5, tipCurl = -0.25, twist = 0, ruffle = 0 }) {
  const pos = [], uv = [], idx = [];
  let sr = 0, sy = 0;
  const dv = 1 / segV;
  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    const phi = tilt0 + (tilt1 - tilt0) * v + tipCurl * v ** 3;
    const w = W * Math.pow(Math.sin(Math.PI * Math.pow(v, 1.12) * 0.999 + 0.0005), 0.6) * (1 - 0.1 * v) + W * 0.1 * (1 - v) ** 2;
    const inR = -Math.cos(phi), inY = Math.sin(phi);
    for (let i = 0; i <= segU; i++) {
      const u = -1 + (2 * i) / segU;
      const across = u * w;
      const off = cup * w * u * u + ruffle * w * Math.sin(u * 9 + v * 13) * v;
      const tw = twist * v * u * w;
      pos.push(sr + inR * off, sy + inY * off + tw, across);
      uv.push(i / segU, v);
    }
    if (j < segV) {
      const vm = (j + 0.5) / segV;
      const pm = tilt0 + (tilt1 - tilt0) * vm + tipCurl * vm ** 3;
      sr += Math.sin(pm) * L * dv; sy += Math.cos(pm) * L * dv;
    }
  }
  const row = segU + 1;
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 整朵花的花瓣（合併）。layers: [{ n, L, W, tilt0, tilt1, cup, tipCurl, rBase, y }]。
 * 原點 = 花托中心（蓮蓬頂面中心在 y = podTop）。
 */
export function petalsGeometry(layers, { segU, segV, seed }) {
  const r = makeRng(seed);
  const parts = [];
  let azOff = 0;
  for (const ly of layers) {
    for (let k = 0; k < ly.n; k++) {
      const jit = (r() - 0.5);
      const g = petalGeometry({
        L: ly.L * (1 + jit * 0.12), W: ly.W * (1 + (r() - 0.5) * 0.15), segU, segV,
        tilt0: ly.tilt0 + (r() - 0.5) * 0.12, tilt1: ly.tilt1 + (r() - 0.5) * 0.2,
        cup: ly.cup, tipCurl: ly.tipCurl, twist: (r() - 0.5) * 0.25, ruffle: ly.ruffle || 0,
      });
      const az = azOff + (k / ly.n) * Math.PI * 2 + (r() - 0.5) * 0.18;
      const m = new THREE.Matrix4().makeRotationY(az)
        .multiply(new THREE.Matrix4().makeTranslation(ly.rBase, ly.y, 0))
        .multiply(new THREE.Matrix4().makeRotationX((r() - 0.5) * 0.15));
      g.applyMatrix4(m);
      parts.push(g);
    }
    azOff += Math.PI / ly.n;
  }
  return mergeGeometries(parts);
}

function colorize(g, rgb) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = rgb[0]; c[i * 3 + 1] = rgb[1]; c[i * 3 + 2] = rgb[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

/** 沿曲線的細管，radius(t)、color(t) 為函式；sides 邊。 */
export function tubeAlong(points, radiusFn, colorFn, sides = 3) {
  const pos = [], col = [], idx = [];
  const P = points.map((p) => new THREE.Vector3(...p));
  const n = P.length;
  let prevN = null;
  for (let i = 0; i < n; i++) {
    const tan = (i < n - 1 ? P[i + 1].clone().sub(P[i]) : P[i].clone().sub(P[i - 1])).normalize();
    let nrm = prevN ? prevN.clone() : (Math.abs(tan.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0));
    nrm.sub(tan.clone().multiplyScalar(nrm.dot(tan))).normalize();
    prevN = nrm;
    const bin = new THREE.Vector3().crossVectors(tan, nrm);
    const t = i / (n - 1);
    const rad = radiusFn(t), c = colorFn(t);
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const o = nrm.clone().multiplyScalar(Math.cos(a) * rad).add(bin.clone().multiplyScalar(Math.sin(a) * rad));
      pos.push(P[i].x + o.x, P[i].y + o.y, P[i].z + o.z);
      col.push(...c);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let s = 0; s < sides; s++) {
    const a = i * sides + s, b = i * sides + ((s + 1) % sides), c = a + sides, d = b + sides;
    idx.push(a, c, b, b, c, d);
  }
  // 封尖端
  const tip = pos.length / 3;
  const L = P[n - 1];
  pos.push(L.x, L.y, L.z); col.push(...colorFn(1));
  for (let s = 0; s < sides; s++) idx.push((n - 1) * sides + s, tip, (n - 1) * sides + ((s + 1) % sides));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 蓮蓬（倒圓錐，頂面有蓮子）＋ 環繞的雄蕊。原點 = 蓮蓬頂面中心。
 * R：蓮蓬頂半徑；detail：0 一般 / 1 主角。
 */
export function centerGeometry({ R, H, seeds, stamens, detail = 0, seed = 'center' }) {
  const r = makeRng(seed);
  const parts = [];
  // 蓮蓬本體（Lathe）
  const prof = [];
  const segs = detail ? 14 : 6;
  prof.push(new THREE.Vector2(0.001, -H * 1.05));
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const rr = R * (0.38 + 0.62 * Math.pow(t, 0.8)) ;
    prof.push(new THREE.Vector2(rr, -H + H * t * 0.98));
  }
  prof.push(new THREE.Vector2(R * 1.0, 0)); prof.push(new THREE.Vector2(R * 0.85, H * 0.06));
  for (let i = 1; i <= 4; i++) prof.push(new THREE.Vector2(R * 0.85 * (1 - i / 4) + 0.0005, H * (0.06 + 0.02 * Math.sin((i / 4) * Math.PI / 2))));
  const lathe = new THREE.LatheGeometry(prof, detail ? 40 : 12);
  {
    const p = lathe.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = smooth(-H, 0.0, y);
      const top = [0.92, 0.80, 0.22], side = [0.62, 0.70, 0.20];
      for (let q = 0; q < 3; q++) c[i * 3 + q] = side[q] * (1 - k) + top[q] * k;
    }
    lathe.setAttribute('color', new THREE.BufferAttribute(c, 3));
    lathe.deleteAttribute('uv');
  }
  parts.push(lathe);
  // 蓮子：葉序排列，頂面凹洞中的小圓頂
  for (let k = 0; k < seeds; k++) {
    const rr = R * 0.78 * Math.sqrt((k + 0.5) / seeds);
    const a = k * 2.39996;
    const s = new THREE.SphereGeometry(R * (detail ? 0.13 : 0.15), detail ? 10 : 5, detail ? 6 : 3, 0, Math.PI * 2, 0, Math.PI / 2);
    s.scale(1, 0.55, 1);
    s.translate(Math.cos(a) * rr, H * 0.075, Math.sin(a) * rr);
    colorize(s, [0.66, 0.72, 0.16]);
    parts.push(s);
    if (detail) {
      // 蓮子周圍的淺色環（凹洞邊）
      const ring = new THREE.TorusGeometry(R * 0.15, R * 0.025, 3, 12);
      ring.rotateX(Math.PI / 2);
      ring.translate(Math.cos(a) * rr, H * 0.07, Math.sin(a) * rr);
      colorize(ring, [0.98, 0.9, 0.42]);
      parts.push(ring);
    }
  }
  // 雄蕊
  const sides = detail ? 4 : 3;
  const steps = detail ? 7 : 3;
  for (let k = 0; k < stamens; k++) {
    const a = (k / stamens) * Math.PI * 2 * 7.13 + r() * 0.3;
    const ring = Math.floor(k * 3 / stamens);
    const len = R * (1.05 + r() * 0.45);
    const r0 = R * (0.9 + ring * 0.08);
    const y0 = -H * (0.75 - ring * 0.15);
    const out = 0.5 + r() * 0.35 + ring * 0.15;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const rad = r0 + len * out * t * t * 0.9 + len * 0.1 * t;
      const y = y0 + len * (Math.sin(t * 1.4) * 0.95);
      pts.push([Math.cos(a) * rad, y, Math.sin(a) * rad]);
    }
    const thick = R * (detail ? 0.028 : 0.04);
    parts.push(tubeAlong(pts,
      (t) => (t < 0.45 ? thick * 0.55 : t < 0.9 ? thick * 1.25 : thick * 0.9),
      (t) => (t < 0.45 ? [0.98, 0.88, 0.48] : t < 0.9 ? [1.0, 0.70, 0.12] : [0.98, 0.95, 0.85]), sides));
  }
  for (const p of parts) if (!p.index) p.setIndex([...Array(p.attributes.position.count).keys()]);
  return mergeGeometries(parts.map((p) => { const q = p.attributes.normal ? p : (p.computeVertexNormals(), p); return q; }));
}

/** 花苞：尖卵形，尖端粉、基部綠白，帶花瓣縱溝。原點在花苞基部。 */
export function budGeometry({ H = 0.12, R = 0.032, seg = 14, detail = false }) {
  const prof = [];
  const n = detail ? 16 : 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const rr = R * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.9) * (1 - 0.1 * t) + 0.0004;
    prof.push(new THREE.Vector2(rr, t * H));
  }
  const g = new THREE.LatheGeometry(prof, seg);
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const groove = 1 - 0.07 * Math.pow(Math.abs(Math.cos(a * 2.5)), 6);  // 5 片外瓣的縫
    p.setX(i, x * groove); p.setZ(i, z * groove);
    const t = y / H;
    const pink = smooth(0.35, 1.0, t);
    const base = [0.62, 0.72, 0.42], mid = [0.96, 0.86, 0.84], tip = [0.86, 0.28, 0.48];
    const c1 = t < 0.3 ? base.map((b, q) => b * (1 - t / 0.3) + mid[q] * (t / 0.3)) : mid;
    for (let q = 0; q < 3; q++) c[i * 3 + q] = c1[q] * (1 - pink) + tip[q] * pink;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

export { colorize, smooth };
