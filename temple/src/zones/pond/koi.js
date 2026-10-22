// 錦鯉：程式幾何（身體 + 尾鰭 + 背鰭 + 胸鰭 + 腹鰭 + 臀鰭）、canvas 花紋（紅白、大正三色、黃金、橘），
// 頂點著色器做身體波動。位置、姿態、擺動全部是 t 的純函式。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pond, focusPoints } from '../../layout.js';
import { makeRng, makeNoise2D, fbm } from '../../rng.js';
import { canvasTex, smooth } from './geom.js';
import { underwater } from './underwater.js';

const WL = pond.waterLevel;
const BODY_END = 0.86;   // 身體 s 範圍 0（吻端）→ 0.86（尾柄）
const FIN_U0 = 0.885;    // 紋理中鰭用的區帶

function shape(s) {
  if (s < 0.32) return Math.pow(Math.sin((s / 0.32) * Math.PI / 2), 0.33);
  const t = Math.min(1, (s - 0.32) / (BODY_END - 0.32));
  return 0.2 + 0.8 * Math.pow(Math.cos(t * Math.PI) * 0.5 + 0.5, 0.95);
}
const HY = 0.125, WZ = 0.098;

function sheet(nA, nB, fn) {
  // fn(a, b) → [x, y, z, u, v]
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nB; j++) for (let i = 0; i <= nA; i++) {
    const [x, y, z, u, v] = fn(i / nA, j / nB);
    pos.push(x, y, z); uv.push(u, v);
  }
  for (let j = 0; j < nB; j++) for (let i = 0; i < nA; i++) {
    const a = j * (nA + 1) + i, b = a + 1, c = a + nA + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const finUV = (a, b) => [FIN_U0 + 0.11 * a, b];

/** 單位長度的鯉魚，吻端在 x = +0.5，背朝 +y。 */
function koiGeometry() {
  const segS = 32, segP = 22;
  // 身體
  const body = sheet(segP, segS, (a, b) => {
    const s = b * BODY_END;
    const phi = a * Math.PI * 2;
    const sh = shape(s);
    let y = Math.sin(phi) * HY * sh;
    if (y < 0) y *= 0.82;                          // 腹部略平
    const z = Math.cos(phi) * WZ * sh * (1 + 0.08 * Math.sin(phi)); // 背較寬
    // 頭部略低平
    const yOff = -0.012 * (1 - smooth(0, 0.2, s));
    return [0.5 - s, y + yOff, z, s, a];
  });
  // 尾鰭：垂直面，分叉
  const tail = sheet(7, 10, (a, b) => {
    const bb = b * 2 - 1;
    const h = bb * (0.028 + 0.13 * Math.pow(a, 0.8));
    const s = 0.82 + a * (0.16 + 0.07 * Math.abs(bb) ** 1.5 - 0.02 * (1 - Math.abs(bb)));
    return [0.5 - s, h, 0, ...finUV(a, b)];
  });
  // 背鰭
  const dorsal = sheet(8, 3, (a, b) => {
    const s = 0.3 + a * 0.36;
    const top = HY * shape(s);
    const hgt = 0.07 * Math.pow(Math.sin(Math.PI * Math.min(1, a * 1.1)), 0.6) * (1 - 0.35 * a);
    return [0.5 - s - b * 0.03, top * 0.96 + b * hgt, 0, ...finUV(a, b)];
  });
  // 胸鰭 / 腹鰭 / 臀鰭
  // 胸鰭等：近水平的扇形，由身體下側向後外方展開
  const fan = (s0, side, len, spread, down, out) => sheet(4, 4, (a, b) => {
    const ang = out + (-0.5 + b) * spread;          // 與「正後方」的夾角
    const sh = shape(s0);
    const rx = 0.5 - s0 - b * 0.03, ry = -HY * sh * 0.5, rz = side * WZ * sh * 0.8;
    const L = len * (0.55 + 0.45 * Math.sin(Math.PI * b)) * a;
    return [rx - L * Math.cos(ang), ry - L * down, rz + side * L * Math.sin(ang), ...finUV(a, b)];
  });
  const parts = [body, tail, dorsal,
    fan(0.21, 1, 0.17, 0.8, 0.12, 0.85), fan(0.21, -1, 0.17, 0.8, 0.12, 0.85),
    fan(0.52, 1, 0.075, 0.5, 0.3, 0.45), fan(0.52, -1, 0.075, 0.5, 0.3, 0.45),
    sheet(4, 3, (a, b) => { const s = 0.66 + a * 0.12; return [0.5 - s - b * 0.02, -HY * shape(s) * 0.8 - b * 0.045 * Math.sin(Math.PI * a), 0, ...finUV(a, b)]; }),
  ];
  return mergeGeometries(parts);
}

const TYPES = ['kohaku', 'sanke', 'ogon', 'orange', 'kohaku', 'orange', 'sanke', 'ogon', 'kohaku', 'orange', 'kohaku', 'sanke', 'ogon', 'orange'];

function koiTexture(type, seed) {
  const n = makeNoise2D(seed);
  const r = makeRng(seed);
  return canvasTex(256, 128, (g, W, H) => {
    const img = g.createImageData(W, H);
    const white = [242, 238, 228], red = [214, 46, 22], black = [22, 20, 22];
    const gold = [238, 178, 62], orange = [240, 112, 28];
    const off = r() * 50;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / (W - 1), v = y / (H - 1);
      const phi = v * Math.PI * 2;
      const top = Math.sin(phi);                    // 1 = 背、-1 = 腹
      let c;
      if (u >= FIN_U0 - 0.005) {
        // 鰭：半透明感的白 / 金 / 橘，帶鰭條
        const ray = 0.9 + 0.1 * Math.cos(v * 70);
        const base = type === 'ogon' ? [236, 196, 110] : type === 'orange' ? [246, 170, 110] : [236, 232, 226];
        c = base.map((b) => b * ray);
      } else {
        const nn = fbm(n, u * 5 + Math.cos(phi) * 0.8 + off, top * 1.3, 4);
        const back = smooth(-0.35, 0.5, top);
        if (type === 'kohaku' || type === 'sanke') {
          c = white;
          const head = u < 0.17 ? 0.25 : 0;
          const patch = nn * 1.4 + back * 0.6 + head - 0.3;
          if (patch > 0 && u > 0.04 && u < 0.83) c = red;
          if (type === 'sanke') {
            const sn = fbm(n, u * 14 + 30, Math.cos(phi) * 2 + top * 2, 3);
            if (sn > 0.38 && back > 0.4 && u > 0.2 && u < 0.8) c = black;
          }
        } else if (type === 'ogon') {
          c = gold.map((g0, i) => g0 * (0.85 + 0.25 * back) + (i === 2 ? -10 : 0));
        } else {
          c = orange.map((o, i) => o * (0.82 + 0.25 * back) + [10, 40, 50][i] * (1 - back));
        }
        // 腹側淡色
        const belly = smooth(0.1, -0.7, top);
        c = c.map((cv, i) => cv * (1 - belly * 0.6) + [240, 232, 214][i] * belly * 0.6);
        // 鱗片網紋
        const su = (u * 46) % 1, sv = (v * 30 + (Math.floor(u * 46) % 2) * 0.5) % 1;
        const edge = Math.min(su, 1 - su, sv, 1 - sv);
        const scale = u > 0.15 && u < 0.82 ? 1 - 0.05 * (1 - smooth(0.0, 0.2, edge)) : 1;
        c = c.map((cv) => cv * scale * (0.97 + 0.04 * n(u * 90, v * 60)));
        // 眼睛
        for (const ev of [0.045, 0.455]) {
          const d = Math.hypot((u - 0.072) * 1.0, (v - ev) * 0.55);
          if (d < 0.016) c = d < 0.009 ? [12, 10, 10] : [200, 160, 70];
        }
      }
      const i4 = (y * W + x) * 4;
      img.data[i4] = c[0]; img.data[i4 + 1] = c[1]; img.data[i4 + 2] = c[2]; img.data[i4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}

function koiMaterial(type, seed) {
  const m = new THREE.MeshStandardMaterial({
    name: 'koi-' + type, map: koiTexture(type, seed), side: THREE.DoubleSide,
    roughness: type === 'ogon' ? 0.3 : 0.38, metalness: type === 'ogon' ? 0.55 : 0.05,
  });
  const u = { uPhase: { value: 0 }, uAmp: { value: 0.05 }, uBend: { value: 0 } };
  m.userData.u = u;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uPhase, uAmp, uBend;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float ks = 0.5 - position.x;
        float kA = uAmp * (0.12 + 1.15 * ks * ks);
        float kW = sin(6.5 * ks - uPhase);
        float kdz = kA * 6.5 * cos(6.5 * ks - uPhase) + uAmp * 2.3 * ks * kW + 2.0 * uBend * ks;
        float kSlope = -kdz;
        objectNormal = normalize(vec3(objectNormal.x - kSlope * objectNormal.z, objectNormal.y, objectNormal.z + kSlope * objectNormal.x));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.z += kA * kW + uBend * ks * ks;
        transformed.x -= 0.5 * (kA * kW) * (kA * kW) * 4.0;`);
  };
  m.customProgramCacheKey = () => 'koi-wave';
  return underwater(m, { amb: 0.42, key: 'koi' });
}

// ── 游動路徑 ──────────────────────────────────────────────
const [CX, , CZ] = pond.center;
function genericPath(p, t) {
  const tt = t + p.t0;
  let u = p.a[0] * Math.sin(p.f[0] * tt + p.ph[0]) + p.a[1] * Math.sin(p.f[1] * tt + p.ph[1]);
  let w = p.a[0] * Math.cos(p.f[2] * tt + p.ph[2]) + p.a[1] * Math.sin(p.f[3] * tt + p.ph[3]);
  const r = Math.hypot(u, w) + 1e-6;
  const k = Math.tanh(1.15 * r) / r * 0.93;
  u *= k; w *= k;
  const sr = pond.koi.swimRadius;
  return [CX + u * pond.rx * sr, CZ + w * pond.rz * sr];
}

export function buildKoi() {
  const group = new THREE.Group();
  group.name = 'pond-koi';
  const geo = koiGeometry();
  const spot = focusPoints().koiSpot;
  const r = makeRng(pond.koi.seed);
  // 鏡頭 9（t ∈ [56, 63]）從 koiSpot 正上方拍：三隻在這段時間穿過畫面
  const featured = [
    { tc: 56.7, at: [0.0, -0.04], dir: Math.PI + 0.08, v: 0.2, curv: 0.01, depth: 0.14 },       // 紅白：往西，正中穿過
    { tc: 57.8, at: [-0.15, -0.72], dir: -0.3, v: 0.19, curv: -0.008, depth: 0.22 },          // 大正三色：往東北東
    { tc: 58.6, at: [-0.85, -4.6], dir: -Math.PI / 2 - 0.35, v: 0.24, curv: 0.012, depth: 0.17 }, // 黃金：往北
    { tc: 59.2, at: [-2.3, -9.5], dir: 0.15, v: 0.26, curv: -0.01, depth: 0.2 },              // 橘：遠景往東
  ];
  const fish = [];
  for (let k = 0; k < pond.koi.count; k++) {
    const type = TYPES[k % TYPES.length];
    const p = {
      a: [r.range(0.5, 0.7), r.range(0.22, 0.4)],
      f: [r.range(0.012, 0.02), r.range(0.03, 0.05), r.range(0.012, 0.02), r.range(0.03, 0.05)].map((f, i) => f * (r() < 0.5 ? -1 : 1)),
      ph: [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28], t0: r() * 500,
      len: r.range(0.42, 0.72), depthPh: r() * 6.28, depthF: r.range(0.08, 0.16),
      swimF: r.range(5.5, 8.0), swimPh: r() * 6.28,
      feat: featured[k] || null,
    };
    if (p.feat) p.len = [0.62, 0.58, 0.66, 0.6][k];
    const mat = koiMaterial(type, 'koi-' + k);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `koi-${k}-${type}`;
    mesh.scale.setScalar(p.len);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    fish.push({ p, mesh, mat });
  }

  function state(f, t) {
    const p = f.p;
    let [x, z] = genericPath(p, t);
    let depth = 0.1 + 0.2 * (0.5 + 0.5 * Math.sin(t * p.depthF + p.depthPh));
    if (p.feat) {
      const F = p.feat;
      const dt = t - F.tc;
      const dx = Math.cos(F.dir), dz = Math.sin(F.dir);
      const fx = spot[0] + F.at[0] + dx * F.v * dt - dz * F.curv * dt * dt;
      const fz = spot[2] + F.at[1] + dz * F.v * dt + dx * F.curv * dt * dt;
      const w = smooth(42, 52, t);
      x = x * (1 - w) + fx * w; z = z * (1 - w) + fz * w;
      depth = depth * (1 - w) + (F.depth + 0.02 * Math.sin(t * 0.4 + p.depthPh)) * w;
    }
    return [x, WL - depth, z];
  }
  /** 第 k 隻魚在 t 的 [x, y, z]（給漣漪用）。 */
  const positionOf = (k, t) => state(fish[k % fish.length], t);

  function update(t) {
    const h = 0.05;
    for (const f of fish) {
      const a = state(f, t - h), b = state(f, t), c = state(f, t + h);
      const vx = (c[0] - a[0]) / (2 * h), vz = (c[2] - a[2]) / (2 * h), vy = (c[1] - a[1]) / (2 * h);
      const speed = Math.hypot(vx, vz) + 1e-6;
      const yaw = Math.atan2(-vz, vx);
      const yaw0 = Math.atan2(-(b[2] - a[2]), b[0] - a[0]), yaw1 = Math.atan2(-(c[2] - b[2]), c[0] - b[0]);
      let dyaw = yaw1 - yaw0; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      const kappa = dyaw / (speed * h);               // 曲率（1/m）
      f.mesh.position.set(b[0], b[1], b[2]);
      f.mesh.rotation.set(0, yaw, Math.atan2(vy, speed) * 0.8, 'YXZ');
      const u = f.mat.userData.u;
      u.uPhase.value = t * f.p.swimF + f.p.swimPh;
      u.uAmp.value = 0.035 + 0.06 * Math.min(1, speed / 0.35);
      u.uBend.value = Math.max(-0.25, Math.min(0.25, -kappa * f.p.len * 0.5));
    }
  }
  update(0);
  return { object: group, update, positionOf };
}
