// 五重塔：簷角青銅風鐸（20 顆，InstancedMesh）。
// 吊點 = pagodaEaveCorners(k)；鈴身頂在吊點下 pagoda.chimeDrop；舌（鐸舌）與短冊（風招）另有第二支點。
// 擺動只由 t 決定：每顆有自己的相位、頻率與陣風包絡。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pagoda, pagodaEaveCorners } from '../../layout.js';
import { makeRng } from '../../rng.js';
import { mat } from '../../materials.js';
import { V3, prep, latheMod, cylBetween } from './geom.js';

function bellGeometry(drop) {
  const parts = [];
  // 吊環與鎖（由隅木下的金具一路垂到鈴頂）
  const top = 0.06, bottom = -drop + 0.02;
  const n = Math.max(4, Math.round((top - bottom) / 0.075));
  const step = (top - bottom) / n;
  for (let i = 0; i < n; i++) {
    const g = new THREE.TorusGeometry(0.02, 0.0055, 5, 12);
    g.scale(1, 1.75, 1);
    if (i % 2) g.rotateY(Math.PI / 2);
    g.translate(0, top - step * (i + 0.5), 0);
    parts.push(g);
  }
  // 鈕（鈴頂吊耳）
  const knob = new THREE.TorusGeometry(0.022, 0.008, 6, 14);
  knob.translate(0, -drop - 0.012, 0);
  parts.push(knob);
  // 鈴身：略帶方形的風鐸，口緣外翻，腰有凸帶；含內壁
  const y = (v) => -drop - 0.035 + v;
  const prof = [
    [0, y(0)], [0.035, y(0)], [0.058, y(-0.008)], [0.072, y(-0.024)], [0.078, y(-0.048)], [0.08, y(-0.075)],
    [0.087, y(-0.079)], [0.087, y(-0.093)], [0.083, y(-0.098)], [0.087, y(-0.17)], [0.093, y(-0.25)],
    [0.099, y(-0.255)], [0.099, y(-0.27)], [0.096, y(-0.275)], [0.104, y(-0.31)], [0.118, y(-0.338)], [0.127, y(-0.35)],
    [0.124, y(-0.358)], [0.112, y(-0.352)], [0.096, y(-0.31)], [0.082, y(-0.2)], [0.07, y(-0.09)], [0.055, y(-0.035)], [0, y(-0.03)],
  ];
  parts.push(latheMod(prof, 48, (th) => 1 + 0.075 * Math.cos(4 * th)));
  // 乳（鈴面上的小乳頭狀突起）：四面各 2 列 × 3
  for (let f = 0; f < 4; f++) {
    for (const da of [-0.17, 0.17]) {
      const th = Math.PI / 4 + (f * Math.PI) / 2 + da;
      for (let r = 0; r < 3; r++) {
        const vy = -0.115 - r * 0.045;
        const rad = (0.083 + (0.09 - 0.083) * (r / 2)) * (1 + 0.075 * Math.cos(4 * th)) + 0.004;
        const g = new THREE.SphereGeometry(0.0085, 7, 4);
        g.translate(Math.sin(th) * rad, y(vy), Math.cos(th) * rad);
        parts.push(g);
      }
    }
  }
  return mergeGeometries(parts.map(prep), false);
}

function tongueGeometry(drop) {
  const piv = -drop - 0.06;
  const parts = [];
  parts.push(cylBetween(new V3(0, piv, 0), new V3(0, piv - 0.3, 0), 0.006, 0.006, 6));
  // 舌（鐸舌）：紡錘形錘
  parts.push(latheMod([[0, piv - 0.25], [0.02, piv - 0.262], [0.032, piv - 0.285], [0.034, piv - 0.3], [0.026, piv - 0.32], [0.012, piv - 0.33], [0, piv - 0.332]], 16));
  parts.push(cylBetween(new V3(0, piv - 0.33, 0), new V3(0, piv - 0.44, 0), 0.0035, 0.0035, 5));
  const ring = new THREE.TorusGeometry(0.012, 0.003, 4, 10);
  ring.translate(0, piv - 0.448, 0);
  parts.push(ring);
  return { geo: mergeGeometries(parts.map(prep), false), piv };
}

function plateGeometry(piv) {
  // 風招（短冊）：上窄下寬的心葉形青銅板，中央透孔
  const w = 0.075, h = 0.3;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(w * 0.5, -0.01, w * 0.55, -h * 0.25, w, -h * 0.55);
  s.bezierCurveTo(w * 1.25, -h * 0.82, w * 0.5, -h * 0.95, 0, -h);
  s.bezierCurveTo(-w * 0.5, -h * 0.95, -w * 1.25, -h * 0.82, -w, -h * 0.55);
  s.bezierCurveTo(-w * 0.55, -h * 0.25, -w * 0.5, -0.01, 0, 0);
  const hole = new THREE.Path();
  hole.absarc(0, -h * 0.6, 0.026, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const hole2 = new THREE.Path();
  hole2.absarc(0, -h * 0.3, 0.012, 0, Math.PI * 2, true);
  s.holes.push(hole2);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.005, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, piv - 0.458, -0.0025);
  return prep(g);
}

export function buildChimes(group) {
  const drop = pagoda.chimeDrop;
  const bellGeo = bellGeometry(drop);
  const { geo: tongueGeo, piv } = tongueGeometry(drop);
  const plateGeo = plateGeometry(piv);
  const [px, py, pz] = pagoda.pos;
  const inv = -pagoda.rotY;
  const items = [];
  const r = makeRng('pagoda-chimes');
  for (let k = 0; k < pagoda.stories.length; k++) {
    pagodaEaveCorners(k).forEach((c, ci) => {
      const lx = c[0] - px, lz = c[2] - pz;
      const x = lx * Math.cos(inv) + lz * Math.sin(inv), z = -lx * Math.sin(inv) + lz * Math.cos(inv);
      items.push({
        p: new V3(x, c[1] - py, z),
        yaw: Math.atan2(x, z) + r.range(-0.3, 0.3),
        w1: r.range(2.6, 3.4), w2: r.range(4.6, 6.2), w3: r.range(7.0, 9.0),
        p1: r.range(0, 6.283), p2: r.range(0, 6.283), p3: r.range(0, 6.283), pg: r.range(0, 6.283),
        amp: r.range(0.8, 1.2),
      });
    });
  }
  const n = items.length;
  const bells = new THREE.InstancedMesh(bellGeo, mat.bronze, n);
  const tongues = new THREE.InstancedMesh(tongueGeo, mat.bronze, n);
  const plates = new THREE.InstancedMesh(plateGeo, mat.bronze, n);
  for (const m of [bells, tongues, plates]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.receiveShadow = true;
    group.add(m);
  }
  bells.name = 'pagoda-chime-bells'; tongues.name = 'pagoda-chime-tongues'; plates.name = 'pagoda-chime-plates';

  const mB = new THREE.Matrix4(), mT = new THREE.Matrix4(), tmp = new THREE.Matrix4();
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  const one = new V3(1, 1, 1);
  // 風由西南西吹來（往東北東），在本地座標換算
  const wind = new V3(Math.sin(67.5 * Math.PI / 180), 0, -Math.cos(67.5 * Math.PI / 180));
  wind.applyAxisAngle(new V3(0, 1, 0), inv);
  function update(t) {
    for (let i = 0; i < n; i++) {
      const it = items[i];
      const gust = 0.55 + 0.45 * Math.sin(0.23 * t + it.pg) * Math.sin(0.097 * t + it.pg * 1.7);
      const g = Math.max(0.15, gust) * it.amp;
      // 主擺：繞與風向垂直的軸傾斜，外加小幅橫擺
      const along = 0.035 * g + 0.045 * g * Math.sin(it.w1 * t + it.p1);
      const across = 0.022 * g * Math.sin(it.w1 * 0.83 * t + it.p2);
      // 傾斜軸：along 沿風向 → 繞 (wind × up) 軸
      const ax = wind.z * along + wind.x * across * 0, az = -wind.x * along;
      e.set(ax + wind.x * across * 0.5, 0, az + wind.z * across * 0.5, 'XYZ');
      q.setFromEuler(e);
      mB.compose(it.p, q, one);
      tmp.makeRotationY(it.yaw + 0.05 * Math.sin(0.7 * t + it.p3));
      mB.multiply(tmp);
      bells.setMatrixAt(i, mB);
      // 舌：相對鈴身的二次擺
      const s1 = 0.16 * g * Math.sin(it.w2 * t + it.p2) + 0.06 * g * Math.sin(it.w3 * t + it.p3);
      const s2 = 0.1 * g * Math.sin(it.w2 * 0.9 * t + it.p1);
      mT.copy(mB);
      tmp.makeTranslation(0, piv, 0); mT.multiply(tmp);
      e.set(s1, 0, s2, 'XYZ'); tmp.makeRotationFromEuler(e); mT.multiply(tmp);
      tmp.makeTranslation(0, -piv, 0); mT.multiply(tmp);
      tongues.setMatrixAt(i, mT);
      // 短冊：受風面朝向風，再多一點擺動
      const pv = piv - 0.448;
      tmp.makeTranslation(0, pv, 0); mT.multiply(tmp);
      e.set(0.25 * g * Math.sin(it.w3 * 0.7 * t + it.p1), 0.4 * Math.sin(0.9 * t + it.p2), 0, 'XYZ'); tmp.makeRotationFromEuler(e); mT.multiply(tmp);
      tmp.makeTranslation(0, -pv, 0); mT.multiply(tmp);
      plates.setMatrixAt(i, mT);
    }
    bells.instanceMatrix.needsUpdate = true;
    tongues.instanceMatrix.needsUpdate = true;
    plates.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { update, count: n };
}
