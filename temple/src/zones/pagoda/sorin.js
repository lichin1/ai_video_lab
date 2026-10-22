// 五重塔：相輪（露盤、伏鉢、請花、九輪、水煙、龍車、請花、寶珠）與四條鎖。
// 底 = totalHeight - sorinHeight，頂 = pagodaFinialPoint()（寶珠尖）。
import * as THREE from 'three';
import { pagoda } from '../../layout.js';
import { V3, boxAt, latheMod, gridGeo, cylBetween, M } from './geom.js';
import { storyFrame } from './story.js';

/** 蓮花座（請花）：n 片花瓣的殼，外表 + 內表 + 上緣 */
function lotusCup(B, key, { y0, h, rb, rt, n = 8, phase = 0, seg = 96, flare = 0.12 }) {
  const lobes = n / 2;
  const P = (th, t, inner) => {
    const lobe = Math.pow(Math.abs(Math.cos(lobes * (th + phase))), 0.8);
    const tip = Math.pow(lobe, 3);
    const hh = h * (0.62 + 0.38 * tip);
    let r = rb + (rt - rb) * Math.pow(t, 0.55);
    r *= 1 + flare * t * t * tip;
    r *= 0.93 + 0.07 * lobe;
    if (inner) r -= 0.012 + 0.01 * (1 - t);
    const y = y0 + t * hh - (inner ? 0.0 : 0);
    return new V3(Math.sin(th) * r, y, Math.cos(th) * r);
  };
  const nt = 7;
  const outer = [], inner = [], rim = [];
  const uo = [], ui = [], ur = [];
  for (let i = 0; i <= seg; i++) {
    const th = (i / seg) * Math.PI * 2;
    const ro = [], ri = [], a = [], b = [];
    for (let j = 0; j <= nt; j++) { const t = j / nt; ro.push(P(th, t, false)); ri.push(P(th, t, true)); a.push([i / seg * 4, t]); b.push([i / seg * 4, t]); }
    outer.push(ro); inner.push(ri); uo.push(a); ui.push(b);
    rim.push([P(th, 1, false), P(th, 1, true)]); ur.push([[i / seg * 4, 0], [i / seg * 4, 0.05]]);
  }
  const p0 = outer[0][3];
  B.add(key, gridGeo(outer, uo, new V3(p0.x, 0, p0.z)));
  B.add(key, gridGeo(inner, ui, new V3(-p0.x, 0, -p0.z)));
  B.add(key, gridGeo(rim, ur, new V3(0, 1, 0)));
}

/** 水煙：透雕火焰板（平面 xy，x 為徑向） */
function suienShape(Hs) {
  const env = (y) => {
    const t = Math.min(1, Math.max(0, y / Hs));
    return 0.12 + 0.44 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.7) * (1 - 0.3 * t);
  };
  const shape = new THREE.Shape();
  shape.moveTo(0.095, 0);
  const N = 120;
  for (let i = 0; i <= N; i++) {
    const y = (i / N) * Hs;
    const t = y / Hs;
    const saw = ((t * 5.5) % 1);
    const tongue = 0.11 * Math.pow(saw, 2.2) * Math.sin(Math.PI * Math.min(1, t * 1.1)) ;
    shape.lineTo(env(y) + tongue, y + 0.04 * Math.pow(saw, 3));
  }
  // 頂端火焰尖：向內捲
  shape.quadraticCurveTo(0.2, Hs + 0.06, 0.13, Hs + 0.12);
  shape.quadraticCurveTo(0.1, Hs + 0.05, 0.095, Hs - 0.05);
  shape.lineTo(0.095, 0);
  // 透雕：淚滴形（向外上方捲起的火焰孔）＋小圓孔
  const drop = (cx, cy, r, ang) => {
    const tx = cx + Math.cos(ang) * r * 2.3, ty = cy + Math.sin(ang) * r * 2.3;
    const dist = Math.hypot(tx - cx, ty - cy);
    const beta = Math.acos(r / dist);
    const p = new THREE.Path();
    p.moveTo(tx, ty);
    const a0 = ang + beta, a1 = ang - beta + Math.PI * 2;
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      p.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    p.lineTo(tx, ty);
    return p;
  };
  for (let j = 0; j < 5; j++) {
    const cy = Hs * (0.13 + 0.165 * j);
    const ev = env(cy) - 0.095;
    const r = Math.min(0.05, ev * 0.2);
    shape.holes.push(drop(0.095 + ev * 0.5, cy, r, 1.05 - j * 0.08));
    if (j < 4) {
      const cy2 = cy + Hs * 0.08, ev2 = env(cy2) - 0.095;
      const c = new THREE.Path();
      c.absarc(0.095 + ev2 * 0.82, cy2, Math.min(0.022, ev2 * 0.08), 0, Math.PI * 2, true);
      shape.holes.push(c);
      const c2 = new THREE.Path();
      c2.absarc(0.095 + ev2 * 0.25, cy2 + 0.02, Math.min(0.016, ev2 * 0.06), 0, Math.PI * 2, true);
      shape.holes.push(c2);
    }
  }
  return shape;
}

export function buildSorin(B) {
  const y0 = pagoda.totalHeight - pagoda.sorinHeight;  // 本地座標（group 已放在 pos）
  const top = pagoda.totalHeight;
  const S = pagoda.sorinHeight / 9;                     // 以 9 m 為設計基準的縮放
  const Y = (v) => y0 + v * S;

  // 露盤（方形基座）
  B.add('bronze', boxAt(1.42, 0.1 * S, 1.42, 0, Y(0.05), 0));
  B.add('bronze', boxAt(1.28, 0.32 * S, 1.28, 0, Y(0.26), 0));
  B.add('gold', boxAt(1.46, 0.04 * S, 1.46, 0, Y(0.11), 0));
  B.add('gold', boxAt(1.42, 0.05 * S, 1.42, 0, Y(0.445), 0));
  B.add('bronze', boxAt(1.36, 0.06 * S, 1.36, 0, Y(0.5), 0));
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    B.add('gold', boxAt(0.06, 0.32 * S, 0.06, sx * 0.64, Y(0.26), sz * 0.64));
  }
  // 露盤側面格狭間般的金色框
  for (let i = 0; i < 4; i++) {
    const g = boxAt(0.9, 0.18 * S, 0.012, 0, Y(0.26), 0.645);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY((i * Math.PI) / 2));
    B.add('gold', g);
  }

  // 伏鉢（覆鉢）
  B.add('bronze', latheMod([[0, Y(0.55)], [0.5, Y(0.55)], [0.54, Y(0.6)], [0.548, Y(0.68)], [0.525, Y(0.78)], [0.46, Y(0.88)], [0.34, Y(0.96)], [0.2, Y(1.0)], [0, Y(1.01)]], 48, undefined, -1));
  const band = new THREE.TorusGeometry(0.538, 0.018, 8, 64); band.rotateX(Math.PI / 2); band.translate(0, Y(0.63), 0);
  B.add('gold', band);

  // 請花（大）：兩重花瓣
  lotusCup(B, 'gold', { y0: Y(0.98), h: 0.36 * S, rb: 0.2, rt: 0.6, n: 8, flare: 0.16 });
  lotusCup(B, 'gold', { y0: Y(1.0), h: 0.3 * S, rb: 0.18, rt: 0.5, n: 8, phase: Math.PI / 8, flare: 0.1 });

  // 擦管（心柱）
  B.add('bronze', cylBetween(new V3(0, Y(0.55), 0), new V3(0, Y(7.98), 0), 0.088, 0.078, 20));

  // 九輪
  for (let i = 0; i < 9; i++) {
    const yc = Y(1.62 + i * 0.44);
    const R = 0.64 - 0.013 * i, t = 0.036;
    B.add('bronze', latheMod([[0.09, yc + t], [R - 0.035, yc + t], [R - 0.01, yc + 0.024], [R, yc], [R - 0.01, yc - 0.024], [R - 0.035, yc - t], [0.09, yc - t], [0.09, yc + t]], 56));
    const rim = new THREE.TorusGeometry(R - 0.003, 0.011, 6, 64); rim.rotateX(Math.PI / 2); rim.translate(0, yc, 0);
    B.add('gold', rim);
    // 輪間的小金環（擦管上的帶）
    const col = new THREE.TorusGeometry(0.095, 0.014, 6, 24); col.rotateX(Math.PI / 2); col.translate(0, yc + 0.22 * S, 0);
    B.add('gold', col);
  }

  // 水煙：四片透雕火焰
  const Hs = 1.65 * S;
  const sh = suienShape(Hs);
  const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 1, curveSegments: 6 });
  sg.translate(0, 0, -0.011);
  for (let i = 0; i < 4; i++) {
    const g = sg.clone();
    g.applyMatrix4(M(0, Y(5.3), 0, (i * Math.PI) / 2 + Math.PI / 4));
    B.add('gold', g);
  }
  sg.dispose();
  // 水煙下的座環
  const sb = new THREE.TorusGeometry(0.12, 0.03, 8, 24); sb.rotateX(Math.PI / 2); sb.translate(0, Y(5.3), 0);
  B.add('gold', sb);

  // 龍車
  B.add('gold', latheMod([[0, Y(7.45)], [0.08, Y(7.44)], [0.15, Y(7.41)], [0.2, Y(7.36)], [0.222, Y(7.3)], [0.222, Y(7.2)], [0.2, Y(7.14)], [0.15, Y(7.09)], [0.08, Y(7.06)], [0, Y(7.05)]], 64, (th) => 1 + 0.035 * Math.cos(8 * th)));
  const rr = new THREE.TorusGeometry(0.232, 0.022, 8, 48); rr.rotateX(Math.PI / 2); rr.translate(0, Y(7.25), 0);
  B.add('gold', rr);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const g = new THREE.SphereGeometry(0.03, 10, 6);
    g.translate(Math.sin(a) * 0.235, Y(7.25), Math.cos(a) * 0.235);
    B.add('gold', g);
  }
  // 頸部（念珠狀的節）
  B.add('bronze', latheMod([[0, Y(7.96)], [0.07, Y(7.95)], [0.085, Y(7.9)], [0.07, Y(7.85)], [0.095, Y(7.79)], [0.07, Y(7.73)], [0.09, Y(7.65)], [0.07, Y(7.56)], [0.11, Y(7.5)], [0.08, Y(7.45)], [0, Y(7.44)]], 32));
  for (const yy of [7.79, 7.65]) {
    const g = new THREE.TorusGeometry(0.09, 0.012, 6, 32); g.rotateX(Math.PI / 2); g.translate(0, Y(yy), 0);
    B.add('gold', g);
  }
  // 請花（小）＋寶珠
  lotusCup(B, 'gold', { y0: Y(7.94), h: 0.26 * S, rb: 0.06, rt: 0.25, n: 8, flare: 0.25, seg: 96 });
  lotusCup(B, 'gold', { y0: Y(7.97), h: 0.2 * S, rb: 0.06, rt: 0.2, n: 8, phase: Math.PI / 8, flare: 0.2 });
  const T = (v) => top - (9 - v) * S;   // 讓寶珠尖正好落在 top
  B.add('gold', latheMod([
    [0, T(9.0)], [0.006, T(8.995)], [0.02, T(8.975)], [0.045, T(8.94)], [0.09, T(8.88)], [0.15, T(8.81)], [0.21, T(8.73)],
    [0.255, T(8.64)], [0.28, T(8.55)], [0.285, T(8.47)], [0.27, T(8.39)], [0.235, T(8.32)], [0.18, T(8.27)], [0.11, T(8.235)], [0.04, T(8.215)], [0, T(8.21)],
  ], 64));
  // 寶珠根部金環
  const hr = new THREE.TorusGeometry(0.16, 0.016, 8, 40); hr.rotateX(Math.PI / 2); hr.translate(0, T(8.235), 0);
  B.add('gold', hr);

  // 鎖：水煙下方垂至頂層四個隅棟先端
  const F = storyFrame(pagoda.stories.length - 1);
  const yTop = Y(5.25);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const dx = Math.sin(a), dz = Math.cos(a);
    const Hc = F.r0D(1) * Math.SQRT2;
    const yEnd = F.roofY(1, F.r0D(1)) + 0.3;
    const A = new V3(dx * 0.14, yTop, dz * 0.14), Bq = new V3(dx * Hc * 0.98, yEnd, dz * Hc * 0.98);
    const pts = [];
    for (let j = 0; j <= 40; j++) {
      const t = j / 40;
      const p = new V3().lerpVectors(A, Bq, t);
      p.y -= 0.9 * Math.sin(Math.PI * t) * (1 - 0.3 * t);
      pts.push(p);
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.02, 5, false);
    B.add('bronze', tube);
  }
}
