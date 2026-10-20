// 共用材質：朱漆、金箔、青銅、屋瓦、木頭（另附石材、白壁、和紙，常用到所以也放這裡）。
// 所有紋理都用 canvas 以固定種子即時繪製，沒有載入任何圖片。
// 各分區只能「使用」這些材質，不要修改它們的屬性；需要變化時 .clone() 後改自己的副本。
//
// 用法：import { mat } from '../materials.js';  mesh.material = mat.vermilion;
//      紋理以每公尺重複一次設計（uv 單位 = 公尺），幾何的 uv 請盡量用公尺為單位。
import * as THREE from 'three';
import { makeRng, makeNoise2D, fbm } from './rng.js';

const TEX_SIZE = 512;

function canvasTexture(seed, size, draw, { srgb = true, repeat = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size, makeRng(seed), makeNoise2D(seed));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 以雜訊逐像素填色。fn(u, v, n) → [r, g, b]（0–255），u,v ∈ [0,1)，可無縫平鋪。 */
function pixelFill(g, size, noise, fn) {
  const img = g.createImageData(size, size);
  // 四角取樣雙線性交叉淡化，讓紋理可無縫平鋪
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const [r, gg, b] = fn(u, v, (fx, fy, oct = 4) => {
        const a = fbm(noise, u * fx, v * fy, oct);
        const bx = fbm(noise, (u - 1) * fx, v * fy, oct);
        const cy = fbm(noise, u * fx, (v - 1) * fy, oct);
        const d = fbm(noise, (u - 1) * fx, (v - 1) * fy, oct);
        return (a * (1 - u) + bx * u) * (1 - v) + (cy * (1 - u) + d * u) * v;
      });
      const i = (y * size + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

const clamp255 = (v) => Math.max(0, Math.min(255, v));

// ── 紋理 ───────────────────────────────────────────────────────────
// 朱漆：細微刷痕與褪色斑駁
const lacquerTex = canvasTexture('tex-lacquer', TEX_SIZE, (g, s, r, n) =>
  pixelFill(g, s, n, (u, v, N) => {
    const brush = N(2, 40, 3) * 0.5;      // 沿 v 方向的刷痕
    const blot = N(4, 4, 4);
    const k = 1 + brush * 0.12 + blot * 0.1;
    return [clamp255(186 * k), clamp255(74 * k), clamp255(42 * k)];
  }));
const lacquerRough = canvasTexture('tex-lacquer-r', 256, (g, s, r, n) =>
  pixelFill(g, s, n, (u, v, N) => { const k = clamp255(110 + N(6, 6, 4) * 70); return [k, k, k]; }), { srgb: false });

// 木頭：縱向木紋（v 方向為纖維方向）
const woodTex = canvasTexture('tex-wood', TEX_SIZE, (g, s, r, n) =>
  pixelFill(g, s, n, (u, v, N) => {
    const ring = Math.sin((u * 18 + N(3, 0.6, 3) * 2.5) * Math.PI * 2) * 0.5 + 0.5;
    const fine = N(60, 2, 2) * 0.5 + 0.5;
    const k = 0.78 + ring * 0.16 + fine * 0.1 + N(2, 2, 3) * 0.08;
    return [clamp255(120 * k), clamp255(82 * k), clamp255(52 * k)];
  }));

// 屋瓦：本瓦葺的明暗條紋（沿 u 每 0.3 m 一列筒瓦），加上青灰色斑
const tileTex = canvasTexture('tex-tile', TEX_SIZE, (g, s, r, n) =>
  pixelFill(g, s, n, (u, v, N) => {
    const rows = 1 / 0.3;
    const ph = (u * rows * 3) % 1;                     // 一張紋理含 3 列
    const ridge = Math.pow(Math.sin(ph * Math.PI), 0.6); // 筒瓦隆起較亮
    const course = (v * 3 * 4) % 1;                     // 瓦片接縫
    const seam = course < 0.06 ? 0.75 : 1;
    const k = (0.55 + ridge * 0.45) * seam * (1 + N(5, 5, 4) * 0.12);
    return [clamp255(70 * k), clamp255(76 * k), clamp255(84 * k)];
  }), { repeat: 1 });
const tileNormal = canvasTexture('tex-tile-n', 256, (g, s) => {
  const img = g.createImageData(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const ph = ((x / s) * 3) % 1;
    const nx = -Math.cos(ph * Math.PI) * 0.8;          // 筒瓦圓弧
    const course = ((y / s) * 12) % 1;
    const ny = course < 0.06 ? 0.6 : 0;
    const l = Math.hypot(nx, ny, 1);
    const i = (y * s + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}, { srgb: false });

// 青銅：深褐底色上的綠青（銅鏽）斑
const bronzeTex = canvasTexture('tex-bronze', TEX_SIZE, (g, s, r, n) =>
  pixelFill(g, s, n, (u, v, N) => {
    const pat = Math.max(0, N(5, 5, 5) * 1.6 - 0.45);
    const base = [150, 104, 60], verd = [88, 132, 112];
    const t = Math.min(0.85, pat);
    return base.map((b, i) => clamp255(b * (1 - t) + verd[i] * t + N(30, 30, 2) * 10));
  }));
const bronzeRough = canvasTexture('tex-bronze-r', 256, (g, s, r, n) =>
  pixelFill(g, s, n, (u, v, N) => { const k = clamp255(120 + Math.max(0, N(5, 5, 5)) * 160); return [k, k, k]; }), { srgb: false });

// 金箔：箔片接縫的細格與輕微色差
const goldTex = canvasTexture('tex-gold', 256, (g, s, r, n) =>
  pixelFill(g, s, n, (u, v, N) => {
    const seam = ((u * 8) % 1 < 0.03 || (v * 8) % 1 < 0.03) ? 0.9 : 1;
    const k = seam * (1 + N(8, 8, 3) * 0.06);
    return [clamp255(255 * k), clamp255(196 * k), clamp255(92 * k)];
  }));

// 石材：花崗岩斑點
const stoneTex = canvasTexture('tex-stone', TEX_SIZE, (g, s, r, n) =>
  pixelFill(g, s, n, (u, v, N) => {
    const k = 0.8 + N(3, 3, 5) * 0.18 + (r() - 0.5) * 0.12;
    return [clamp255(148 * k), clamp255(142 * k), clamp255(132 * k)];
  }));

// 白壁（漆喰）
const plasterTex = canvasTexture('tex-plaster', 256, (g, s, r, n) =>
  pixelFill(g, s, n, (u, v, N) => {
    const k = 0.93 + N(4, 4, 4) * 0.05 + Math.max(0, N(2, 8, 3)) * -0.06;
    return [clamp255(236 * k), clamp255(228 * k), clamp255(212 * k)];
  }));

// ── 材質 ───────────────────────────────────────────────────────────
export const mat = {
  /** 朱漆：柱、欄杆、橋、塔身 */
  vermilion: new THREE.MeshStandardMaterial({ name: 'vermilion', map: lacquerTex, roughnessMap: lacquerRough, roughness: 0.55, metalness: 0 }),
  /** 金箔：屋脊飾、相輪寶珠、佛像光背、飾金具 */
  gold: new THREE.MeshStandardMaterial({ name: 'gold', map: goldTex, color: 0xffffff, roughness: 0.28, metalness: 1.0 }),
  /** 青銅（帶銅鏽）：佛像、吊燈籠、擬寶珠、風鈴、相輪 */
  bronze: new THREE.MeshStandardMaterial({ name: 'bronze', map: bronzeTex, roughnessMap: bronzeRough, roughness: 0.6, metalness: 0.85 }),
  /** 屋瓦：深灰本瓦葺；uv 的 u 跨越瓦列（每 0.3 m 一列）、v 沿屋面斜向 */
  roofTile: new THREE.MeshStandardMaterial({ name: 'roofTile', map: tileTex, normalMap: tileNormal, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.62, metalness: 0.15 }),
  /** 木頭：素木、地板、垂木木口；v 方向為木紋方向 */
  wood: new THREE.MeshStandardMaterial({ name: 'wood', map: woodTex, roughness: 0.78, metalness: 0 }),
  /** 石材：基壇、石燈籠、石階、岸石 */
  stone: new THREE.MeshStandardMaterial({ name: 'stone', map: stoneTex, roughness: 0.9, metalness: 0 }),
  /** 白壁（漆喰）：牆面 */
  plaster: new THREE.MeshStandardMaterial({ name: 'plaster', map: plasterTex, roughness: 0.92, metalness: 0 }),
  /** 和紙（發光）：燈籠、提燈的紙面；emissiveIntensity 可在 clone 後調整 */
  paper: new THREE.MeshStandardMaterial({ name: 'paper', color: 0xf3e2c0, emissive: 0xffa040, emissiveIntensity: 1.6, roughness: 0.95, side: THREE.DoubleSide }),
  /** 火光：石燈籠火袋內、燈芯，純發光 */
  flame: new THREE.MeshBasicMaterial({ name: 'flame', color: new THREE.Color(4.0, 2.2, 0.8) }),
};

/** 以公尺為單位設定紋理重複：clone 一份並改 repeat（不影響共用材質）。 */
export function scaled(material, repeatU, repeatV = repeatU) {
  const m = material.clone();
  for (const k of ['map', 'roughnessMap', 'normalMap']) {
    if (m[k]) { m[k] = m[k].clone(); m[k].repeat.set(repeatU, repeatV); m[k].needsUpdate = true; }
  }
  return m;
}
