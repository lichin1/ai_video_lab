// 地形分區：程式產生的可平鋪紋理（canvas），全部固定種子。
import * as THREE from 'three';
import { makeRng } from '../../rng.js';

/** 週期性 value noise（格點數 period，可無縫平鋪），回傳 f(u,v) ∈ [0,1]，u,v ∈ [0,1)。 */
export function periodicNoise(seed, period) {
  const r = makeRng(seed);
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (i, j) => g[((j % period + period) % period) * period + ((i % period + period) % period)];
  return (u, v) => {
    const x = u * period, y = v * period;
    const i = Math.floor(x), j = Math.floor(y);
    let fx = x - i, fy = y - j;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };
}

/** 週期性 fbm：base 為最低頻格點數，octaves 層，輸出約 [0,1]。 */
export function periodicFbm(seed, base, octaves = 4) {
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push(periodicNoise(`${seed}-${o}`, base << o));
  return (u, v) => {
    let s = 0, a = 1, n = 0;
    for (const f of layers) { s += a * f(u, v); n += a; a *= 0.5; }
    return s / n;
  };
}

export function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

export function toTexture(canvas, { srgb = true, repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** 逐像素填色：fn(u, v) → [r,g,b]（0–255）。 */
export function fillPixels(g, size, fn) {
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, gg, b] = fn(x / size, y / size);
    const i = (y * size + x) * 4;
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

/** 在平鋪畫布上畫東西：draw(g, ox, oy) 會在 9 個偏移各畫一次，邊界自動接續。 */
export function wrapDraw(size, draw) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) draw(ox, oy);
}

const c255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
export const rgb = (r, g, b) => `rgb(${c255(r)},${c255(g)},${c255(b)})`;
export { c255 };

// ── 地面用紋理 ─────────────────────────────────────────────────────

/** 草地：暗綠底 + 大量短草葉筆觸（夾雜枯黃）。 */
export function grassTexture() {
  const S = 512, cv = makeCanvas(S), g = cv.getContext('2d');
  const N = periodicFbm('tg-grass', 4, 4);
  fillPixels(g, S, (u, v) => {
    const n = N(u, v);
    return [c255(58 + n * 34), c255(74 + n * 36), c255(30 + n * 16)];
  });
  const r = makeRng('tg-grass-blades');
  for (let i = 0; i < 9000; i++) {
    const x = r() * S, y = r() * S;
    const len = 5 + r() * 14, ang = -Math.PI / 2 + (r() - 0.5) * 1.4;
    const dry = r() < 0.18;
    const k = 0.7 + r() * 0.6;
    const col = dry ? rgb(130 * k, 118 * k, 60 * k) : rgb(66 * k, 98 * k, 34 * k);
    g.strokeStyle = col; g.lineWidth = 0.8 + r() * 1.3; g.globalAlpha = 0.75;
    wrapDraw(S, (ox, oy) => {
      if (x + ox < -20 || x + ox > S + 20 || y + oy < -20 || y + oy > S + 20) return;
      g.beginPath(); g.moveTo(x + ox, y + oy);
      g.quadraticCurveTo(x + ox + Math.cos(ang) * len * 0.5 + 2, y + oy + Math.sin(ang) * len * 0.5, x + ox + Math.cos(ang) * len, y + oy + Math.sin(ang) * len);
      g.stroke();
    });
  }
  g.globalAlpha = 1;
  return toTexture(cv);
}

/** 苔：濃綠的苔墊團塊與細碎亮點。 */
export function mossTexture() {
  const S = 512, cv = makeCanvas(S), g = cv.getContext('2d');
  const N = periodicFbm('tg-moss', 6, 5);
  const C = periodicNoise('tg-moss-c', 48);
  fillPixels(g, S, (u, v) => {
    const n = N(u, v), c = C(u, v);
    const cushion = Math.pow(c, 1.6);
    const k = 0.62 + n * 0.5 + cushion * 0.35;
    return [c255(48 * k), c255(78 * k), c255(30 * k)];
  });
  const r = makeRng('tg-moss-specks');
  for (let i = 0; i < 5000; i++) {
    const x = r() * S, y = r() * S, k = 0.8 + r() * 0.6;
    g.fillStyle = r() < 0.8 ? rgb(92 * k, 124 * k, 44 * k) : rgb(40 * k, 52 * k, 26 * k);
    g.fillRect(x, y, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  return toTexture(cv);
}

/** 白砂（白川砂）：灰白顆粒。 */
export function sandTexture() {
  const S = 512, cv = makeCanvas(S), g = cv.getContext('2d');
  const N = periodicFbm('tg-sand', 4, 3);
  fillPixels(g, S, (u, v) => {
    const k = 0.9 + N(u, v) * 0.14;
    return [c255(196 * k), c255(192 * k), c255(182 * k)];
  });
  const r = makeRng('tg-sand-grains');
  for (let i = 0; i < 26000; i++) {
    const x = r() * S, y = r() * S, rad = 0.6 + r() * r() * 2.4;
    const t = r();
    const k = t < 0.15 ? 0.55 + r() * 0.2 : t < 0.3 ? 1.1 : 0.85 + r() * 0.25;
    const warm = r() * 10;
    g.fillStyle = rgb(200 * k + warm, 196 * k + warm * 0.6, 186 * k);
    wrapDraw(S, (ox, oy) => {
      if (x + ox < -4 || x + ox > S + 4 || y + oy < -4 || y + oy > S + 4) return;
      g.beginPath(); g.arc(x + ox, y + oy, rad, 0, Math.PI * 2); g.fill();
    });
  }
  return toTexture(cv);
}

/** 林床：暗褐土與落針、落葉。 */
export function soilTexture() {
  const S = 512, cv = makeCanvas(S), g = cv.getContext('2d');
  const N = periodicFbm('tg-soil', 5, 4);
  fillPixels(g, S, (u, v) => {
    const k = 0.7 + N(u, v) * 0.6;
    return [c255(70 * k), c255(56 * k), c255(40 * k)];
  });
  const r = makeRng('tg-soil-needles');
  for (let i = 0; i < 4000; i++) {
    const x = r() * S, y = r() * S, a = r() * Math.PI * 2, l = 4 + r() * 8, k = 0.7 + r() * 0.7;
    g.strokeStyle = r() < 0.5 ? rgb(110 * k, 80 * k, 46 * k) : rgb(60 * k, 70 * k, 34 * k);
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return toTexture(cv);
}

/** 大尺度變化（線性空間）：R、G、B、A 四個獨立的 fbm 通道。 */
export function macroTexture() {
  const S = 256, cv = makeCanvas(S), g = cv.getContext('2d');
  const A = periodicFbm('tg-macro-a', 3, 5), B = periodicFbm('tg-macro-b', 4, 5), C = periodicFbm('tg-macro-c', 8, 4);
  fillPixels(g, S, (u, v) => [c255(A(u, v) * 255), c255(B(u, v) * 255), c255(C(u, v) * 255)]);
  return toTexture(cv, { srgb: false });
}
