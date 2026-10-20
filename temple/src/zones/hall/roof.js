// 入母屋造屋根：屋面、本瓦葺筒瓦列、瓦當、大棟／降棟／隅棟、鬼瓦、妻壁、破風、懸魚、鴟尾。
import * as THREE from 'three';
import { gridSurface, sweep, box, M, normalizeGeo, meterUV } from './geom.js';
import {
  Xe, Ze, H, Hr, ridgeTop, ridgeStackH, gxE, pedX, dGable, dSideTop,
  roofPoint, roofNormal, halfLen, warp,
} from './dims.js';

const SIDES = ['S', 'N', 'E', 'W'];
const ROW = 0.3;           // 筒瓦間距（與 mat.roofTile 的條紋一致）
const D_EAVE = -0.14;      // 屋面越出簷口線

export function buildRoof(bk) {
  // ── 屋面 ──
  for (const side of SIDES) {
    const fb = side === 'S' || side === 'N';
    const dMax = fb ? Ze : dSideTop;
    const nu = fb ? 200 : 120, nv = fb ? 56 : 40;
    const flip = side === 'S' || side === 'W';
    const geo = gridSurface(nu, nv, (u, v) => {
      const d = D_EAVE + (dMax - D_EAVE) * v;
      const a = (u * 2 - 1) * halfLen(side, d);
      return roofPoint(side, a, d);
    }, {
      flip,
      uvf: (u, v) => { const d = D_EAVE + (dMax - D_EAVE) * v; const a = (u * 2 - 1) * halfLen(side, d); return [a / 3, d / 3]; },
    });
    bk.add('roof', geo);
  }

  // ── 筒瓦列與瓦當 ──
  const tubes = [], tubeN = [], tubeUV = [];
  const SEG = 5, R = 0.085;
  const pushRow = (side, a, d0, d1) => {
    const len = d1 - d0;
    if (len < 0.15) return;
    const n = Math.max(2, Math.ceil(len / 0.45));
    const ring = [];
    for (let i = 0; i <= n; i++) {
      const d = d0 + (len * i) / n;
      const c = roofPoint(side, a, d), N = roofNormal(side, a, d);
      const pa = roofPoint(side, a + 0.05, d);
      let B = [pa[0] - c[0], pa[1] - c[1], pa[2] - c[2]]; const bl = Math.hypot(...B); B = B.map((v) => v / bl);
      const r = [];
      for (let s = 0; s <= SEG; s++) {
        const th = (Math.PI * s) / SEG, cs = Math.cos(th), sn = Math.sin(th);
        const nn = [cs * B[0] + sn * N[0], cs * B[1] + sn * N[1], cs * B[2] + sn * N[2]];
        r.push([c[0] + R * nn[0] - N[0] * 0.01, c[1] + R * nn[1] - N[1] * 0.01, c[2] + R * nn[2] - N[2] * 0.01, ...nn, d]);
      }
      ring.push(r);
    }
    for (let i = 0; i < n; i++) for (let s = 0; s < SEG; s++) {
      const q = [ring[i][s], ring[i][s + 1], ring[i + 1][s], ring[i + 1][s + 1]];
      const order = [0, 2, 1, 1, 2, 3];
      // 面向：檢查第一個三角形法線與頂點法線同向
      const [A, Bv, C] = [q[0], q[2], q[1]];
      const e1 = [Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const ok = cr[0] * A[3] + cr[1] * A[4] + cr[2] * A[5] > 0;
      for (const k of (ok ? order : [0, 1, 2, 1, 3, 2])) {
        const p = q[k];
        tubes.push(p[0], p[1], p[2]); tubeN.push(p[3], p[4], p[5]);
        tubeUV.push((k & 1 ? s + 1 : s) / SEG * 0.27, p[6]);
      }
    }
    // 瓦當（軒丸瓦）：圓盤朝外
    const c = roofPoint(side, a, d0), c2 = roofPoint(side, a, d0 + 0.1);
    const T = new THREE.Vector3(c[0] - c2[0], c[1] - c2[1], c[2] - c2[2]).normalize();
    const disc = new THREE.CylinderGeometry(R + 0.018, R + 0.018, 0.06, 12, 1);
    disc.rotateX(Math.PI / 2);
    const boss = new THREE.CylinderGeometry(0.035, 0.045, 0.03, 8, 1); boss.rotateX(Math.PI / 2); boss.translate(0, 0, 0.04);
    const rim = new THREE.TorusGeometry(R - 0.005, 0.012, 3, 12); rim.translate(0, 0, 0.03);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), T);
    const N0 = roofNormal(side, a, d0);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(c[0] + N0[0] * 0.03, c[1] + N0[1] * 0.03, c[2] + N0[2] * 0.03), q, new THREE.Vector3(1, 1, 1));
    for (const g of [disc, boss, rim]) bk.add('tileDark', meterUV(normalizeGeo(g)), m);
  };
  for (const side of SIDES) {
    const fb = side === 'S' || side === 'N';
    const lim = fb ? Xe : Ze;
    for (let k = -Math.ceil(lim / ROW); k <= Math.ceil(lim / ROW); k++) {
      const a = k * ROW + ROW / 2;
      if (Math.abs(a) > lim + 0.05) continue;
      let dTop;
      if (fb) dTop = Math.abs(a) <= gxE - 0.15 ? Ze - 0.4 : Xe - Math.abs(a) - 0.22;
      else dTop = Math.min(Ze - Math.abs(a) - 0.22, dSideTop - 0.25);
      pushRow(side, a, D_EAVE + 0.02, dTop);
    }
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(tubes, 3));
  tg.setAttribute('normal', new THREE.Float32BufferAttribute(tubeN, 3));
  tg.setAttribute('uv', new THREE.Float32BufferAttribute(tubeUV, 2));
  bk.add('tileRow', tg);

  // ── 簷口軒平瓦（瓦當下的唇） ──
  for (const side of SIDES) {
    const L = halfLen(side, D_EAVE);
    const pts = [];
    for (let i = 0; i <= 80; i++) {
      const a = -L + (2 * L * i) / 80;
      const p = roofPoint(side, a, D_EAVE + 0.02);
      pts.push([p[0], p[1] - 0.02, p[2]]);
    }
    const out = side === 'S' || side === 'E' ? 1 : -1;
    // 斷面（s 為 T×up 方向；由行進方向決定正負，做成對稱的厚唇即可）
    bk.add('tileDark', sweep(pts, [[-0.07, -0.13], [0.07, -0.13], [0.07, 0.02], [-0.07, 0.02]].map(([s, t]) => [s * out, t])));
  }

  // ── 棟 ──
  const stack = (hw, layers, lh, capR) => {
    const pr = [];
    // 右側由下往上（熨斗瓦層層微凸）
    for (let i = 0; i < layers; i++) {
      const w = hw * (i % 2 ? 0.93 : 1) * (1 - i * 0.015);
      pr.push([w, i * lh], [w, (i + 1) * lh]);
    }
    const top = layers * lh;
    for (let k = 0; k <= 8; k++) { const th = (Math.PI * k) / 8; pr.push([capR * Math.cos(th), top + capR * Math.sin(th) * 0.9]); }
    for (let i = layers - 1; i >= 0; i--) {
      const w = hw * (i % 2 ? 0.93 : 1) * (1 - i * 0.015);
      pr.push([-w, (i + 1) * lh], [-w, i * lh]);
    }
    return pr;
  };
  const mainProf = stack(0.42, 6, (ridgeStackH - 0.2) / 6, 0.24);
  const minorProf = stack(0.25, 4, 0.085, 0.15);
  // 大棟
  {
    const pts = [];
    for (let i = 0; i <= 20; i++) pts.push([-gxE - 0.15 + ((2 * gxE + 0.3) * i) / 20, ridgeTop - ridgeStackH, 0]);
    bk.add('tileDark', sweep(pts, mainProf, { capStart: true, capEnd: true }));
    // 大棟側面的「鬼板」端飾（棟端蓋板）
    for (const sx of [-1, 1]) bk.add('tileDark', box(0.12, ridgeStackH + 0.1, 1.0), M([sx * (gxE + 0.2), ridgeTop - ridgeStackH / 2, 0]));
  }
  const oni = (pos, dir) => { // 鬼瓦：拱形厚板，正面朝 dir（水平）
    const sh = new THREE.Shape();
    sh.moveTo(-0.38, 0); sh.lineTo(0.38, 0); sh.lineTo(0.36, 0.42);
    sh.quadraticCurveTo(0.42, 0.62, 0.22, 0.7); sh.quadraticCurveTo(0.1, 0.62, 0, 0.78); sh.quadraticCurveTo(-0.1, 0.62, -0.22, 0.7);
    sh.quadraticCurveTo(-0.42, 0.62, -0.36, 0.42); sh.lineTo(-0.38, 0);
    const hole = new THREE.Path(); hole.absarc(0, 0.33, 0.11, 0, Math.PI * 2, true);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 8 });
    const g2 = new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(); s.absarc(0, 0.33, 0.12, 0, Math.PI * 2); return s; })(), { depth: 0.22, bevelEnabled: false, curveSegments: 12 });
    const ang = Math.atan2(dir[0], dir[2]);
    const m = M(pos, [0, ang, 0]);
    bk.add('tileDark', meterUV(normalizeGeo(g)), m);
    bk.add('tileDark', meterUV(normalizeGeo(g2)), m);
  };
  // 降棟（切妻端，大棟 → 隅棟起點）
  for (const sx of [-1, 1]) for (const side of ['S', 'N']) {
    const sz = side === 'S' ? 1 : -1;
    const a = sx * (gxE - 0.32);
    const pts = [];
    const d1 = Xe - Math.abs(a) + 0.15;
    for (let i = 0; i <= 18; i++) {
      const d = Ze - 0.2 - ((Ze - 0.2 - d1) * i) / 18;
      const p = roofPoint(side, a, d);
      pts.push([p[0], p[1] - 0.05, p[2]]);
    }
    bk.add('tileDark', sweep(pts, minorProf));
    const e = pts[pts.length - 1];
    oni([e[0], e[1] - 0.02, e[2] + sz * 0.05], [0, 0, sz]);
  }
  // 隅棟（屋角 → 切妻端）
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 26; i++) {
      const d = -0.25 + ((dGable + 0.1 + 0.25) * i) / 26;
      const x = sx * (Xe - d), z = sz * (Ze - d);
      const p = warp([x, H(d), z]);
      pts.push([p[0], p[1] - 0.04 + (d < 0.6 ? (0.6 - d) * 0.25 : 0), p[2]]);
    }
    pts.reverse();
    bk.add('tileDark', sweep(pts, minorProf));
    const e = pts[pts.length - 1];
    oni([e[0] + sx * 0.06, e[1] - 0.05, e[2] + sz * 0.06], [sx * Math.SQRT1_2, 0, sz * Math.SQRT1_2]);
  }

  // ── 鴟尾（金） ──
  {
    const sh = new THREE.Shape();
    sh.moveTo(-0.05, 0); sh.lineTo(1.0, 0);
    sh.bezierCurveTo(0.82, 0.25, 0.55, 0.55, 0.45, 0.85);
    sh.bezierCurveTo(0.35, 1.15, 0.12, 1.32, -0.28, 1.52);
    sh.bezierCurveTo(-0.18, 1.2, -0.12, 0.7, -0.12, 0.35);
    sh.lineTo(-0.05, 0);
    const body = new THREE.ExtrudeGeometry(sh, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 3, curveSegments: 18, steps: 1 });
    body.translate(0, 0, -0.17);
    // 鰭的縱紋（金色細肋）
    const ribs = [];
    for (let k = 0; k < 6; k++) {
      const s = 0.15 + k * 0.13;
      const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.95 - s * 0.6, 0.02, 0), new THREE.Vector3(0.6 - s * 0.4, 0.55 + s * 0.2, 0), new THREE.Vector3(0.1 - s * 0.35, 1.05 + s * 0.35, 0));
      for (const zz of [-0.235, 0.235]) { const t = new THREE.TubeGeometry(c, 14, 0.022, 5, false); t.translate(0, 0, zz); ribs.push(t); }
    }
    const shY = ridgeTop - 0.42;
    for (const sx of [-1, 1]) {
      const m = M([sx * (gxE - 0.05), shY, 0], [0, sx > 0 ? Math.PI : 0, 0]);
      bk.add('gold', meterUV(normalizeGeo(body.clone())), m);
      for (const r of ribs) bk.add('gold', meterUV(normalizeGeo(r.clone())), m);
    }
  }

  // ── 妻壁（白壁 + 朱漆木連格子）、破風板、懸魚 ──
  const yTop = (z) => H(Ze - Math.abs(z)) - 0.28;
  const yB = H(Xe - pedX) - 0.02;
  const zb = Ze - (Xe - pedX);
  for (const sx of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(-zb, yB);
    for (let i = 0; i <= 24; i++) { const z = -zb + (2 * zb * i) / 24; sh.lineTo(z, Math.max(yB, yTop(z))); }
    sh.lineTo(zb, yB);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: false, curveSegments: 4 });
    // Shape 在 (z, y) 平面 → 轉到 x = sx*pedX
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0));
    m.setPosition(sx * pedX - (sx > 0 ? 0.0 : 0.14), 0, 0);
    bk.add('plaster', meterUV(normalizeGeo(g)), m);
    // 木連格子：縱橫格
    const xf = sx * (pedX + 0.17);
    for (let z = -zb + 0.3; z < zb; z += 0.42) {
      const yt = Math.max(yB, yTop(z)) - 0.04;
      if (yt - yB > 0.1) bk.add('vermilion', box(0.06, yt - yB, 0.07), M([xf, (yt + yB) / 2, z]));
    }
    for (let y = yB + 0.35; y < Hr; y += 0.42) {
      // 該高度的寬度
      let zw = 0;
      for (let z = 0; z < zb; z += 0.02) if (yTop(z) - 0.05 > y) zw = z;
      if (zw > 0.15) bk.add('vermilion', box(0.06, 0.07, 2 * zw), M([xf, y, 0]));
    }
    bk.add('vermilion', box(0.18, 0.22, 2 * zb), M([sx * (pedX + 0.12), yB + 0.1, 0]));
    // 破風板：沿上部屋面邊緣的曲板
    for (const sz of [-1, 1]) {
      const pts = [];
      const zEnd = Ze - dGable + 0.45;
      for (let i = 0; i <= 22; i++) {
        const z = sz * (zEnd * i) / 22;
        const y = H(Ze - Math.abs(z)) - 0.04 + (Math.abs(z) > zEnd - 0.9 ? ((Math.abs(z) - zEnd + 0.9) ** 2) * 0.25 : 0);
        pts.push([sx * (gxE + 0.03), y, z]);
      }
      bk.add('vermilion', sweep(pts, [[-0.07, -0.55], [0.07, -0.55], [0.07, 0.03], [-0.07, 0.03]], { up: [0, 1, 0] }));
      // 破風的金具（六葉）
      for (let i = 1; i <= 3; i++) {
        const z = sz * (zEnd * i) / 4;
        const y = H(Ze - Math.abs(z)) - 0.3;
        const c = new THREE.CylinderGeometry(0.09, 0.1, 0.03, 6); c.rotateZ(Math.PI / 2);
        bk.add('gold', meterUV(normalizeGeo(c)), M([sx * (gxE + 0.11), y, z]));
      }
    }
    // 懸魚（金）
    const gs = new THREE.Shape();
    gs.moveTo(0, 0.05);
    gs.bezierCurveTo(0.35, 0.05, 0.42, -0.35, 0.18, -0.6);
    gs.quadraticCurveTo(0.05, -0.72, 0, -0.95);
    gs.quadraticCurveTo(-0.05, -0.72, -0.18, -0.6);
    gs.bezierCurveTo(-0.42, -0.35, -0.35, 0.05, 0, 0.05);
    const gh = new THREE.Path(); gh.absellipse(0, -0.32, 0.12, 0.14, 0, Math.PI * 2, true); gs.holes.push(gh);
    const gg = new THREE.ExtrudeGeometry(gs, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, curveSegments: 12 });
    const mm = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -sx), new THREE.Vector3(0, 1, 0), new THREE.Vector3(sx, 0, 0));
    mm.setPosition(sx * (gxE + 0.12), H(Ze) - 0.55, 0);
    mm.scale(new THREE.Vector3(1.3, 1.3, 1));
    bk.add('gold', meterUV(normalizeGeo(gg)), mm);
  }
}
