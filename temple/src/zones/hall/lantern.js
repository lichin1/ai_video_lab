// 六角青銅吊燈籠（釣燈籠）：鐶・吊鏈・宝珠・請花・反り笠＋蕨手・透彫火袋（八葉蓮華・連子・格狭間）・内側發光・中台・猫足。
// 局部座標：原點 = 吊點（軒下），燈籠中心在 (0, -drop, 0)。
import * as THREE from 'three';
import { Bucket, gridSurface, normalizeGeo, meterUV, M, mergeGeometries } from './geom.js';

const R = 0.26;              // 火袋六角外接半徑
const FB = 0.25;             // 火袋半高
const HEX = Math.PI / 3;

function hexR(theta) { // 外接半徑 1 的六角形在角度 theta 的半徑
  const m = ((theta % HEX) + HEX) % HEX - HEX / 2;
  return Math.cos(HEX / 2) / Math.cos(m);
}
function cornerness(theta) {
  const m = ((theta % HEX) + HEX) % HEX;
  const d = Math.min(m, HEX - m) / (HEX / 2);
  return (1 - d) ** 4;
}

/** 六角柱（或錐台）：r0 底、r1 頂的外接半徑，y0..y1。 */
function hexPrism(r0, r1, y0, y1) {
  const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, 6, 1);
  g.translate(0, (y0 + y1) / 2, 0);
  return meterUV(normalizeGeo(g), 'y', 4);
}

function kasa() {
  const yTop = 0.53, yEave = 0.31, r0 = 0.07, Rk = 0.5, lift = 0.07;
  const surf = (th, t, under) => {
    const rr = (r0 + (Rk - r0) * t) * hexR(th);
    let y = yTop - (yTop - yEave) * Math.pow(t, 0.55) + lift * t ** 3 * cornerness(th);
    if (under) y -= 0.03 + 0.02 * (1 - t);
    return [rr * Math.cos(th), y, rr * Math.sin(th)];
  };
  const NT = 72, NR = 14;
  const top = gridSurface(NT, NR, (u, v) => surf(u * Math.PI * 2, v, false), { uvf: (u, v) => [u * 2, v * 0.5], flip: true });
  const und = gridSurface(NT, NR, (u, v) => surf(u * Math.PI * 2, v, true), { uvf: (u, v) => [u * 2, v * 0.5] });
  const rim = gridSurface(NT, 1, (u, v) => { const th = u * Math.PI * 2; return surf(th, 1, v < 0.5); }, { uvf: (u, v) => [u * 2, v * 0.05] });
  const parts = [top, und, rim].map(normalizeGeo);
  // 降り棟（六條）與蕨手
  for (let k = 0; k < 6; k++) {
    const th = k * HEX;
    const pts = [];
    for (let i = 0; i <= 12; i++) { const p = surf(th, 0.05 + 0.95 * (i / 12), false); pts.push(new THREE.Vector3(p[0], p[1] + 0.012, p[2])); }
    const tip = pts[pts.length - 1];
    const dir = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
    // 蕨手：由角尖上捲、向內渦卷
    const curl = [];
    for (let i = 1; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 1.7;
      const rr = 0.05 * (1 - i / 22);
      curl.push(tip.clone().addScaledVector(dir, Math.sin(a) * rr).add(new THREE.Vector3(0, (1 - Math.cos(a)) * rr, 0)));
    }
    const curve = new THREE.CatmullRomCurve3([...pts, ...curl]);
    parts.push(normalizeGeo(new THREE.TubeGeometry(curve, 40, 0.012, 6, false)));
    const ball = new THREE.SphereGeometry(0.016, 8, 6); const e = curl[curl.length - 1]; ball.translate(e.x, e.y, e.z);
    parts.push(normalizeGeo(ball));
  }
  return parts;
}

function finial() {
  // 露盤 → 請花 → 宝珠 → 鐶座（由下往上）
  const prof = [
    [0.0, 0.5], [0.075, 0.5], [0.075, 0.53], [0.05, 0.545], [0.045, 0.56],
    [0.075, 0.585], [0.085, 0.6], [0.06, 0.6], [0.035, 0.61],               // 請花
    [0.05, 0.63], [0.062, 0.66], [0.058, 0.69], [0.04, 0.72], [0.018, 0.745], [0.006, 0.765], [0.0, 0.77], // 宝珠
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = normalizeGeo(new THREE.LatheGeometry(prof, 24));
  // 請花的蓮瓣
  const parts = [g];
  for (let k = 0; k < 8; k++) {
    const p = new THREE.SphereGeometry(0.03, 8, 6);
    p.scale(0.7, 1.0, 0.35);
    p.rotateZ(-0.6);
    p.translate(0.07, 0.6, 0);
    p.rotateY((k * Math.PI) / 4);
    parts.push(normalizeGeo(p));
  }
  // 鐶
  const ring = new THREE.TorusGeometry(0.04, 0.009, 8, 20); ring.translate(0, 0.81, 0);
  parts.push(normalizeGeo(ring));
  return parts;
}

function panelShape() {
  const w = R - 0.04, h = 2 * FB - 0.04;
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
  const rect = (x0, y0, x1, y1) => { const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x0, y1); p.lineTo(x1, y1); p.lineTo(x1, y0); p.lineTo(x0, y0); return p; };
  // 上段：連子（縱長窓）
  for (let i = 0; i < 5; i++) {
    const x = -0.08 + i * 0.04;
    const p = new THREE.Path();
    p.moveTo(x - 0.011, 0.14); p.lineTo(x - 0.011, 0.19); p.absarc(x, 0.19, 0.011, Math.PI, 0, true); p.lineTo(x + 0.011, 0.14); p.lineTo(x - 0.011, 0.14);
    s.holes.push(p);
  }
  // 中段：八葉蓮華（花瓣形透かし）＋中心小孔
  const cy = 0.0;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    const ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
    const P = (r, o) => [ca * r + px * o, cy + sa * r + py * o];
    const p = new THREE.Path();
    const [x0, y0] = P(0.03, 0); p.moveTo(x0, y0);
    const [c1x, c1y] = P(0.06, 0.028), [tx, ty] = P(0.092, 0), [c2x, c2y] = P(0.06, -0.028);
    p.quadraticCurveTo(c1x, c1y, tx, ty);
    p.quadraticCurveTo(c2x, c2y, x0, y0);
    s.holes.push(p);
  }
  { const p = new THREE.Path(); p.absarc(0, cy, 0.012, 0, Math.PI * 2, true); s.holes.push(p); }
  // 四隅の三角透かし
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const p = new THREE.Path();
    const x = sx * 0.088, y = cy + sy * 0.088;
    p.moveTo(x, y); p.lineTo(x - sx * 0.022, y); p.lineTo(x, y - sy * 0.022); p.lineTo(x, y);
    s.holes.push(p);
  }
  // 下段：格狭間
  {
    const p = new THREE.Path();
    const yb = -0.19, yt = -0.115, hw = 0.085;
    p.moveTo(-hw, yb);
    p.lineTo(hw, yb);
    p.quadraticCurveTo(hw + 0.01, yb + 0.03, hw - 0.012, yb + 0.042);
    p.quadraticCurveTo(hw - 0.005, yt, hw - 0.04, yt);
    p.quadraticCurveTo(0.02, yt, 0.012, yt - 0.012);
    p.quadraticCurveTo(0, yt + 0.006, -0.012, yt - 0.012);
    p.quadraticCurveTo(-0.02, yt, -hw + 0.04, yt);
    p.quadraticCurveTo(-hw + 0.005, yt, -hw + 0.012, yb + 0.042);
    p.quadraticCurveTo(-hw - 0.01, yb + 0.03, -hw, yb);
    s.holes.push(p);
  }
  void rect;
  return s;
}

function firebox() {
  const parts = [];
  const ap = R * Math.cos(HEX / 2);
  const pg = new THREE.ExtrudeGeometry(panelShape(), { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 6 });
  pg.translate(0, 0, -0.004);
  const ringRelief = new THREE.TorusGeometry(0.1, 0.0055, 5, 40);
  const bands = [];
  for (const y of [0.115, -0.105]) { const b = new THREE.BoxGeometry(R - 0.04, 0.012, 0.012); b.translate(0, y, 0.006); bands.push(b); }
  for (let k = 0; k < 6; k++) {
    const a = k * HEX + HEX / 2; // 面中心方向
    const m = new THREE.Matrix4().makeRotationY(Math.PI / 2 - a).setPosition(Math.cos(a) * ap, 0, Math.sin(a) * ap);
    for (const g of [pg, ringRelief, ...bands]) { const c = normalizeGeo(g.clone()); c.applyMatrix4(m); parts.push(c); }
    // 角柱
    const c = k * HEX;
    const post = new THREE.CylinderGeometry(0.016, 0.016, 2 * FB, 6); post.translate(Math.cos(c) * R, 0, Math.sin(c) * R);
    parts.push(normalizeGeo(post));
  }
  parts.push(hexPrism(R + 0.025, R + 0.02, FB - 0.005, FB + 0.04));       // 上框
  parts.push(hexPrism(R + 0.02, R + 0.03, -FB - 0.04, -FB + 0.005));      // 下框
  parts.push(hexPrism(R + 0.03, R + 0.01, FB + 0.04, FB + 0.065));        // 笠受
  parts.push(hexPrism(R + 0.08, R + 0.07, -FB - 0.075, -FB - 0.04));      // 中台
  parts.push(hexPrism(R + 0.05, R + 0.08, -FB - 0.095, -FB - 0.075));
  // 猫足
  for (let k = 0; k < 6; k++) {
    const c = k * HEX, d = new THREE.Vector3(Math.cos(c), 0, Math.sin(c));
    const r0 = R + 0.04;
    const curve = new THREE.CatmullRomCurve3([
      d.clone().multiplyScalar(r0).setY(-FB - 0.09), d.clone().multiplyScalar(r0 + 0.012).setY(-FB - 0.13),
      d.clone().multiplyScalar(r0 + 0.04).setY(-FB - 0.155), d.clone().multiplyScalar(r0 + 0.06).setY(-FB - 0.145),
    ]);
    parts.push(normalizeGeo(new THREE.TubeGeometry(curve, 10, 0.013, 6, false)));
  }
  // 底の擬宝珠形
  const knob = new THREE.LatheGeometry([[0, -FB - 0.095], [0.06, -FB - 0.1], [0.04, -FB - 0.13], [0.012, -FB - 0.16], [0, -FB - 0.17]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
  parts.push(normalizeGeo(knob));
  return parts;
}

/** 建一盞燈籠的幾何（bronze / glow / flame 三組），drop = 吊點到燈籠中心距離。 */
export function lanternGeometries(drop) {
  const bronze = [...kasa(), ...finial(), ...firebox()].map((g) => meterUV(g, 'y', 4));
  // 吊鏈：交錯的長圓鐶
  const ringTop = 0.81 + 0.04;          // 鐶頂（相對燈籠中心）
  const chainLen = drop - ringTop;
  const pitch = 0.062;
  const n = Math.max(1, Math.floor(chainLen / pitch));
  const link = new THREE.TorusGeometry(0.024, 0.0065, 5, 12);
  link.scale(1, 1.55, 1);
  for (let i = 0; i < n; i++) {
    const g = normalizeGeo(link.clone());
    if (i % 2) g.rotateY(Math.PI / 2);
    g.translate(0, ringTop + (i + 0.5) * (chainLen / n), 0);
    bronze.push(meterUV(g, 'y', 4));
  }
  // 軒下の吊金具
  const plate = new THREE.CylinderGeometry(0.09, 0.07, 0.03, 6); plate.translate(0, drop - 0.015, 0);
  bronze.push(meterUV(normalizeGeo(plate), 'y', 4));
  const geo = mergeGeometries(bronze.map((g) => { g.translate(0, -drop, 0); return g; }), false);
  // 內側發光紙筒與燈火
  const glow = hexPrism(R * 0.86, R * 0.86, -FB + 0.01, FB - 0.01);
  glow.translate(0, -drop, 0);
  const flameG = new THREE.LatheGeometry([[0, 0], [0.02, 0.02], [0.016, 0.05], [0.0, 0.09]].map(([r, y]) => new THREE.Vector2(r, y)), 10);
  flameG.translate(0, -drop - 0.08, 0);
  return { bronze: geo, glow, flame: normalizeGeo(flameG) };
}
export { Bucket, M };
