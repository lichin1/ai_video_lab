// 主殿的尺寸推導與屋根曲面數學。全部由 layout.hall 推導（局部座標：原點 = hall.pos，+Z = 正面）。
import { hall } from '../../layout.js';

export const W = hall.width, D = hall.depth, O = hall.eaveOverhang;
export const P = hall.platformHeight;
export const colTop = P + hall.columnHeight;           // 柱頂
export const brTop = colTop + hall.bracketHeight;       // 斗栱層頂（丸桁頂）
export const Xe = W / 2 + O, Ze = D / 2 + O;           // 簷口線（平面）
export const colXs = Array.from({ length: hall.baysX + 1 }, (_, i) => -W / 2 + (i * W) / hall.baysX);
export const colZs = Array.from({ length: hall.baysZ + 1 }, (_, j) => -D / 2 + (j * D) / hall.baysZ);
export const bayX = W / hall.baysX, bayZ = D / hall.baysZ;

// ── 簷下（垂木）高度：out = 自柱列線往外的水平距離 ──
export const pOut = 1.6;           // 丸桁（出桁）位置 = 三手先的出
export const rafterH = 0.17, rafterW = 0.13;
export const out1 = O * 0.7;       // 地垂木 → 木負
const sR = 0.16, sF = 0.1, kioi = 0.22;
export const yR = (out) => brTop + rafterH - sR * (out - pOut);           // 地垂木上端
export const yF = (out) => yR(out1) + kioi - sF * (out - out1);          // 飛檐垂木上端
export const fasciaH = 0.26;
export const H0 = yF(O) + fasciaH + 0.08;                                  // 簷口瓦上緣（中段）

// ── 屋面：入母屋 ──
export const ridgeTop = brTop + hall.roofHeight;           // 大棟頂
export const ridgeStackH = 0.86;
export const Hr = ridgeTop - ridgeStackH + 0.08;            // 屋面在棟處高度
export const gxE = W / 2 - 5.5;                             // 上部切妻屋根的端（螻羽）
export const pedX = gxE - 0.5;                              // 妻壁位置
export const dGable = Xe - gxE;                             // 隅棟到達切妻端時的內縮距離
export const dSideTop = Xe - pedX + 0.12;                   // 側面屋面延伸到妻壁下
const prof = (d) => { const t = Math.max(0, d) / Ze; return 0.42 * t + 0.58 * t * t; };
/** 由簷口往內 d 公尺的屋面高度（未加反り）。 */
export const H = (d) => H0 + (Hr - H0) * prof(d) + (d < 0 ? d * 0.18 : 0);

// ── 簷角起翹（反り）：平面座標 → 抬升與外推 ──
const A0 = 11, Df = 5.5, Rf = 0.55, Pf = 0.32;
const g = (a) => (a < A0 ? (1 - Math.max(0, a) / A0) ** 2 : 0);
const f = (d) => (d < Df ? (1 - Math.max(0, d) / Df) ** 2 : 0);
/** 平面點 (x, z) 的反り：回傳 [dx, dy, dz]。 */
export function warpOffset(x, z) {
  const ax = Xe - Math.abs(x), az = Ze - Math.abs(z);
  const a = g(ax) * f(az), b = g(az) * f(ax);
  return [Math.sign(x) * Pf * b, Rf * (a + b), Math.sign(z) * Pf * a];
}
export function warp([x, y, z]) {
  const [dx, dy, dz] = warpOffset(x, z);
  return [x + dx, y + dy, z + dz];
}

/**
 * 屋面點：side ∈ 'S','N','E','W'，a = 沿簷方向座標（S/N 為 x，E/W 為 z），d = 由簷口往內距離。
 * 回傳已反り的 [x, y, z]；lift 為沿法線上抬。
 */
export function roofPoint(side, a, d) {
  let x, z;
  if (side === 'S') { x = a; z = Ze - d; } else if (side === 'N') { x = a; z = -(Ze - d); }
  else if (side === 'E') { z = a; x = Xe - d; } else { z = a; x = -(Xe - d); }
  return warp([x, H(d), z]);
}
/** 屋面在 (side, a, d) 處的法線（數值微分）。 */
export function roofNormal(side, a, d) {
  const e = 0.05;
  const p0 = roofPoint(side, a, d), pa = roofPoint(side, a + e, d), pd = roofPoint(side, a, d + e);
  const ta = [pa[0] - p0[0], pa[1] - p0[1], pa[2] - p0[2]], td = [pd[0] - p0[0], pd[1] - p0[1], pd[2] - p0[2]];
  let n = [ta[1] * td[2] - ta[2] * td[1], ta[2] * td[0] - ta[0] * td[2], ta[0] * td[1] - ta[1] * td[0]];
  if (n[1] < 0) n = n.map((v) => -v);
  const l = Math.hypot(...n);
  return n.map((v) => v / l);
}
/** 某側在內縮 d 處的半長（S/N：x 的範圍；E/W：z 的範圍）。 */
export function halfLen(side, d) {
  if (side === 'S' || side === 'N') return Math.max(Xe - d, gxE);
  return Ze - d;
}
