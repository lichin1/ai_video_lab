// 擬寶珠（giboshi）：青銅蔥花形柱頭飾。袖（胴）、帶狀箍環、頸部珠環、受花、寶珠。
import * as THREE from 'three';
import { mat } from '../../materials.js';
import { makeRng, makeNoise2D, fbm } from '../../rng.js';

/** 輪廓（r, y），y 相對於擬寶珠中心（giboshiPoint）。 */
export function giboshiProfile() {
  const P = [];
  const add = (r, y) => P.push(new THREE.Vector2(r, y));
  add(0.0, -0.345);
  add(0.096, -0.345);
  // 袖口唇（下緣帶）
  add(0.116, -0.34); add(0.123, -0.331); add(0.124, -0.32); add(0.118, -0.311); add(0.109, -0.305);
  // 袖身（略收）
  add(0.106, -0.29); add(0.104, -0.26); add(0.104, -0.235); add(0.106, -0.222);
  // 上帶箍環（兩條）
  add(0.114, -0.218); add(0.119, -0.211); add(0.119, -0.203); add(0.112, -0.198);
  add(0.112, -0.193); add(0.118, -0.188); add(0.118, -0.181); add(0.111, -0.176);
  // 肩部內收
  add(0.104, -0.17); add(0.092, -0.161); add(0.077, -0.152); add(0.064, -0.144);
  // 頸部
  add(0.057, -0.136); add(0.055, -0.128);
  // 頸部珠環（三圈）
  for (let k = 0; k < 3; k++) {
    const y0 = -0.124 + k * 0.016;
    add(0.06, y0); add(0.069, y0 + 0.004); add(0.071, y0 + 0.008); add(0.066, y0 + 0.012); add(0.057, y0 + 0.015);
  }
  add(0.052, -0.074);
  // 受花（蓮座小盤）
  add(0.058, -0.069); add(0.074, -0.064); add(0.092, -0.058); add(0.106, -0.052); add(0.112, -0.047); add(0.108, -0.043);
  add(0.094, -0.041); add(0.08, -0.039);
  // 寶珠：下半橢圓 + 上半蔥形尖頂
  const R = 0.148, yc = 0.03;
  for (let k = 0; k <= 10; k++) {
    const y = -0.035 + (yc - -0.035) * (k / 10);
    const q = (y - yc) / 0.082;
    add(R * Math.sqrt(Math.max(0, 1 - q * q)), y);
  }
  for (let k = 1; k <= 22; k++) {
    const u = k / 22;
    const y = yc + u * 0.215;
    // 蔥花形：中段飽滿，近頂端內凹成尖
    const r = R * Math.pow(Math.cos(u * Math.PI / 2), 1.55) * (1 + 0.18 * Math.sin(u * Math.PI) - 0.12 * u * u);
    add(Math.max(0.004, r * (1 - Math.pow(u, 6) * 0.6)), y);
  }
  // 尖端小珠
  add(0.012, 0.248); add(0.015, 0.254); add(0.012, 0.261); add(0.0, 0.266);
  return P;
}

let cachedMat = null;
/** 擬寶珠青銅材質：共用青銅的副本，換上帶銅鏽流痕的程式紋理（v 由下而上）。 */
export function giboshiMaterial() {
  if (cachedMat) return cachedMat;
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const n = makeNoise2D('giboshi-patina');
  const r = makeRng('giboshi-patina-r');
  const img = g.createImageData(S, S);
  const rough = document.createElement('canvas');
  rough.width = rough.height = S;
  const rg = rough.getContext('2d');
  const rimg = rg.createImageData(S, S);
  // 流痕：沿 v 的長條
  const streaks = Array.from({ length: 40 }, () => ({ u: r(), w: 0.004 + r() * 0.012, top: 0.35 + r() * 0.6, k: 0.4 + r() * 0.6 }));
  for (let y = 0; y < S; y++) {
    const v = 1 - y / S; // canvas 上方 = v 大（頂端）
    for (let x = 0; x < S; x++) {
      const u = x / S;
      // 週期化的雜訊（u 方向無縫）
      const ang = u * Math.PI * 2;
      const nx = Math.cos(ang) * 1.6, nz = Math.sin(ang) * 1.6;
      const blot = fbm(n, nx + v * 7.0, nz + v * 3.0, 5);
      const fine = fbm(n, nx * 6 + 11, nz * 6 + v * 40, 2);
      let verd = Math.max(0, blot * 1.5 + 0.25);
      // 越下方（袖與頸部凹處）綠鏽越重
      verd += Math.max(0, 0.55 - v) * 0.6;
      for (const s of streaks) {
        let du = Math.abs(u - s.u); du = Math.min(du, 1 - du);
        if (du < s.w && v < s.top) verd += s.k * (1 - du / s.w) * (1 - v / s.top) * 0.9;
      }
      verd = Math.min(1, verd * 1.15);
      const base = [128 + fine * 18, 86 + fine * 12, 48 + fine * 8];
      const vg = [104 + fine * 14, 162 + fine * 16, 136 + fine * 12];
      const dark = 0.85 + blot * 0.15;
      const i = (y * S + x) * 4;
      for (let k = 0; k < 3; k++) img.data[i + k] = Math.max(0, Math.min(255, (base[k] * (1 - verd * 0.9) + vg[k] * verd * 0.9) * dark));
      img.data[i + 3] = 255;
      // G = 粗糙度（綠鏽粗）、B = 金屬度（綠鏽處幾乎非金屬）、R = 凹凸（鑄造細孔與綠鏽結塊）
      const rr = Math.max(0, Math.min(255, 95 + verd * 140 + fine * 20));
      const mm = Math.max(0, Math.min(255, 235 - verd * 215));
      const pit = (r() < 0.012 ? -60 : 0);
      const bb = Math.max(0, Math.min(255, 128 + verd * 70 + fine * 25 + pit));
      rimg.data[i] = bb; rimg.data[i + 1] = rr; rimg.data[i + 2] = mm; rimg.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  rg.putImageData(rimg, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  const rt = new THREE.CanvasTexture(rough);
  rt.wrapS = THREE.RepeatWrapping;
  const m = mat.bronze.clone();
  m.map = t; m.roughnessMap = rt; m.metalnessMap = rt; m.roughness = 1.0; m.metalness = 1.0;
  m.bumpMap = rt; m.bumpScale = 0.6;
  m.name = 'giboshi-bronze';
  cachedMat = m;
  return m;
}

/** 擬寶珠幾何（中心在原點）。 */
export function giboshiGeometry(radial = 48) {
  const prof = giboshiProfile();
  const g = new THREE.LatheGeometry(prof, radial);
  // uv.v 依輪廓弧長正規化（讓紋理流痕平順）
  const L = [0];
  for (let i = 1; i < prof.length; i++) L.push(L[i - 1] + prof[i].distanceTo(prof[i - 1]));
  const uv = g.attributes.uv;
  const per = prof.length;
  for (let i = 0; i < uv.count; i++) uv.setY(i, L[i % per] / L[per - 1]);
  g.computeVertexNormals();
  return g;
}
