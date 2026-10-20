// 蓮葉、蓮花、花苞（聚落用 InstancedMesh）＋ 主角蓮花（鏡頭 2 特寫）。
import * as THREE from 'three';
import { pond, inPond, focusPoints } from '../../layout.js';
import { makeRng } from '../../rng.js';
import { underwater } from './underwater.js';
import { leafTexture, leafGeometry, petalTexture, petalsGeometry, centerGeometry, budGeometry, tubeAlong } from './geom.js';

const BRIDGE_HALF = 1.6;          // 橋所在帶 |x| < 1.6，不放蓮
const WL = pond.waterLevel;

function leafMaterial(tex) {
  const m = new THREE.MeshStandardMaterial({ name: 'lotus-leaf', map: tex, roughness: 0.5, metalness: 0, side: THREE.DoubleSide });
  m.onBeforeCompile = (s) => {
    // 葉背較淡、偏灰綠
    s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = diffuseColor.rgb * vec3(1.05, 1.12, 0.95) + vec3(0.03, 0.04, 0.02);');
  };
  return m;
}

function petalMaterial(tex) {
  const m = new THREE.MeshStandardMaterial({
    name: 'lotus-petal', map: tex, roughness: 0.62, metalness: 0, side: THREE.DoubleSide,
    emissive: 0xff8fae, emissiveIntensity: 0.06,
  });
  m.onBeforeCompile = (s) => {
    // 粗略的透光：逆光時花瓣背面透出粉色
    s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.55, 0.6) * 0.10;`);
  };
  return m;
}

const centerMat = () => new THREE.MeshStandardMaterial({ name: 'lotus-center', vertexColors: true, roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
const budMat = () => new THREE.MeshStandardMaterial({ name: 'lotus-bud', vertexColors: true, roughness: 0.55, metalness: 0, emissive: 0xff8fae, emissiveIntensity: 0.04 });
const stalkMat = () => underwater(new THREE.MeshStandardMaterial({ name: 'lotus-stalk', color: 0x5d7a34, roughness: 0.6 }), { amb: 0.2, key: 'stalk' });

const okSpot = (x, z, rad) => Math.abs(x) > BRIDGE_HALF + rad + 0.25 && inPond(x, z, -1.9 - rad);

// 花瓣層：一般花（較便宜）
const FLOWER_LAYERS = [
  { n: 6, L: 0.105, W: 0.050, tilt0: 0.95, tilt1: 1.30, cup: 0.45, tipCurl: -0.2, rBase: 0.022, y: -0.022 },
  { n: 7, L: 0.100, W: 0.050, tilt0: 0.60, tilt1: 0.90, cup: 0.5, tipCurl: -0.3, rBase: 0.019, y: -0.018 },
  { n: 6, L: 0.088, W: 0.044, tilt0: 0.36, tilt1: 0.52, cup: 0.55, tipCurl: -0.35, rBase: 0.016, y: -0.012 },
];
// 主角蓮花：四層 + 萼片
const HERO_LAYERS = [
  { n: 4, L: 0.075, W: 0.034, tilt0: 1.5, tilt1: 1.95, cup: 0.35, tipCurl: 0.0, rBase: 0.024, y: -0.034 },   // 萼片狀外瓣（下垂）
  { n: 8, L: 0.13, W: 0.06, tilt0: 1.12, tilt1: 1.42, cup: 0.40, tipCurl: -0.22, rBase: 0.026, y: -0.027, ruffle: 0.015 },
  { n: 8, L: 0.125, W: 0.058, tilt0: 0.84, tilt1: 1.08, cup: 0.46, tipCurl: -0.3, rBase: 0.025, y: -0.022, ruffle: 0.012 },
  { n: 7, L: 0.108, W: 0.056, tilt0: 0.66, tilt1: 0.9, cup: 0.42, tipCurl: -0.28, rBase: 0.025, y: -0.017, ruffle: 0.01 },
  { n: 5, L: 0.085, W: 0.05, tilt0: 0.48, tilt1: 0.66, cup: 0.45, tipCurl: -0.3, rBase: 0.025, y: -0.013 },
];
// 主角花朝鏡頭 2 的方向（南南東，方位 165°）微微低頭，讓花心的蓮蓬與雄蕊露出來
const HERO_LEAN = { az: 165 * Math.PI / 180, angle: 0.42 };

/** 由基點、高度、傾角得到「莖頂」的世界座標與旋轉。 */
function swayPose(base, h, lean, t, ph, amp, freq) {
  const ax = lean[0] + amp * Math.sin(t * freq + ph);
  const az = lean[1] + amp * 0.8 * Math.sin(t * freq * 0.77 + ph * 1.9);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(ax, 0, az));
  const top = new THREE.Vector3(0, h, 0).applyQuaternion(q).add(base);
  return { q, top };
}

export function buildLotus() {
  const group = new THREE.Group();
  group.name = 'pond-lotus';
  const leafTex = leafTexture();
  const petalTex = petalTexture();
  const mLeaf = leafMaterial(leafTex), mPetal = petalMaterial(petalTex);
  const mCenter = centerMat(), mBud = budMat(), mStalk = stalkMat();

  // ── 聚落規劃 ─────────────────────────────────────────────
  const floats = [];   // { x, z, r, rot, tilt, ph, color }
  const raised = [];   // { x, z, r, h, rot, lean, ph }
  const flowers = [];  // { x, z, h, s, rot, lean, ph }
  const buds = [];
  const placed = [];
  const free = (x, z, r) => placed.every((p) => Math.hypot(p[0] - x, p[1] - z) > (p[2] + r) * 0.78);
  const leafColor = (r) => {
    const k = r();
    if (k < 0.12) return new THREE.Color(1.25, 1.05, 0.55);   // 秋黃
    if (k < 0.2) return new THREE.Color(1.05, 0.8, 0.6);     // 褐化
    return new THREE.Color(0.85 + r() * 0.3, 0.9 + r() * 0.25, 0.8 + r() * 0.2);
  };

  for (const cl of pond.lotusClusters) {
    const r = makeRng(cl.seed);
    for (let p = 0; p < cl.count; p++) {
      const a = r() * Math.PI * 2, d = cl.r * Math.sqrt(r()) * 0.95;
      const px = cl.x + Math.cos(a) * d * 1.15, pz = cl.z + Math.sin(a) * d * 0.85;
      const nLeaves = r.int(3, 6);
      for (let k = 0; k < nLeaves; k++) {
        const lr = r.range(0.13, 0.3);
        for (let tries = 0; tries < 8; tries++) {
          const la = r() * Math.PI * 2, ld = r.range(0.05, 0.75);
          const x = px + Math.cos(la) * ld, z = pz + Math.sin(la) * ld;
          if (!okSpot(x, z, lr) || !free(x, z, lr)) continue;
          placed.push([x, z, lr]);
          floats.push({ x, z, r: lr, rot: r() * Math.PI * 2, tilt: [r.range(-0.03, 0.03), r.range(-0.03, 0.03)], ph: r() * 6.28, color: leafColor(r), v: r.int(0, 1) });
          break;
        }
      }
      // 立葉
      if (r() < 0.55) {
        const n = r() < 0.3 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const x = px + r.range(-0.4, 0.4), z = pz + r.range(-0.4, 0.4), lr = r.range(0.16, 0.3);
          if (!okSpot(x, z, lr)) continue;
          raised.push({ x, z, r: lr, h: r.range(0.18, 0.75), rot: r() * Math.PI * 2, lean: [r.range(-0.18, 0.18), r.range(-0.18, 0.18)], ph: r() * 6.28, color: leafColor(r) });
        }
      }
      // 花與花苞
      const fk = r();
      if (fk < 0.38) {
        const x = px + r.range(-0.3, 0.3), z = pz + r.range(-0.3, 0.3);
        if (okSpot(x, z, 0.15)) flowers.push({ x, z, h: r.range(0.3, 0.7), s: r.range(0.85, 1.2), rot: r() * Math.PI * 2, lean: [r.range(-0.12, 0.12), r.range(-0.12, 0.12)], ph: r() * 6.28 });
      } else if (fk < 0.62) {
        const x = px + r.range(-0.3, 0.3), z = pz + r.range(-0.3, 0.3);
        if (okSpot(x, z, 0.1)) buds.push({ x, z, h: r.range(0.25, 0.65), s: r.range(0.8, 1.15), rot: r() * Math.PI * 2, lean: [r.range(-0.15, 0.15), r.range(-0.15, 0.15)], ph: r() * 6.28 });
      }
    }
  }

  // ── 主角蓮花周邊（鏡頭 2）──────────────────────────────────
  const F = focusPoints();
  const [hx, hy, hz] = F.heroLotus;
  {
    // 主角周圍的浮葉、立葉、花苞（不擋住鏡頭方向：鏡頭在南南東上方）
    const hr = makeRng('pond-hero-ctx');
    const ctx = [
      [-0.32, -0.18, 0.3], [0.05, -0.42, 0.27], [0.4, 0.05, 0.24], [-0.15, 0.36, 0.22],
      [0.55, -0.42, 0.2], [-0.65, 0.2, 0.26], [0.2, 0.62, 0.28], [-0.55, -0.6, 0.23], [0.85, 0.35, 0.22],
    ];
    for (const [dx, dz, lr] of ctx) {
      const x = hx + dx, z = hz + dz;
      if (!free(x, z, lr * 0.8)) continue;
      placed.push([x, z, lr]);
      floats.push({ x, z, r: lr, rot: hr() * Math.PI * 2, tilt: [hr.range(-0.03, 0.03), hr.range(-0.03, 0.03)], ph: hr() * 6.28, color: new THREE.Color(0.95 + hr() * 0.15, 1.0 + hr() * 0.1, 0.9), v: hr.int(0, 1) });
    }
    raised.push({ x: hx - 0.38, z: hz - 0.42, r: 0.27, h: 0.62, rot: 1.2, lean: [-0.12, 0.1], ph: 1.0, color: new THREE.Color(1.0, 1.05, 0.95) });
    raised.push({ x: hx + 0.55, z: hz - 0.25, r: 0.22, h: 0.36, rot: 2.6, lean: [0.06, -0.12], ph: 2.2, color: new THREE.Color(1.1, 1.0, 0.8) });
    buds.push({ x: hx + 0.2, z: hz - 0.12, h: 0.5, s: 1.15, rot: 0.4, lean: [-0.05, -0.12], ph: 3.1 });
    flowers.push({ x: hx - 0.9, z: hz - 0.75, h: 0.42, s: 1.05, rot: 1.9, lean: [0.08, 0.1], ph: 4.0 });
  }

  // ── 幾何與 InstancedMesh ──────────────────────────────────
  const gFloatA = leafGeometry({ segA: 30, segR: 6, notch: 0.2, curl: 0.045, wave: 0.01, seed: 1 });
  const gFloatB = leafGeometry({ segA: 30, segR: 6, notch: 0.28, curl: 0.075, wave: 0.02, seed: 4 });
  const gRaised = leafGeometry({ segA: 32, segR: 7, notch: 0.0001, curl: 0.04, cup: 0.32, wave: 0.06, seed: 2 });
  const gPetals = petalsGeometry(FLOWER_LAYERS, { segU: 6, segV: 8, seed: 'flower-petals' });
  const gCenter = centerGeometry({ R: 0.022, H: 0.022, seeds: 11, stamens: 42, detail: 0, seed: 'flower-center' });
  const gBud = budGeometry({ H: 0.11, R: 0.03, seg: 12 });
  const gStalk = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true).translate(0, 0.5, 0);

  const floatsA = floats.filter((f) => f.v === 0), floatsB = floats.filter((f) => f.v === 1);
  const mk = (geo, mat, n, name) => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    m.count = n; m.name = name; m.frustumCulled = false; m.receiveShadow = true;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(m);
    return m;
  };
  const imFA = mk(gFloatA, mLeaf, floatsA.length, 'lotus-leaf-float-a');
  const imFB = mk(gFloatB, mLeaf, floatsB.length, 'lotus-leaf-float-b');
  const imR = mk(gRaised, mLeaf, raised.length, 'lotus-leaf-raised');
  const imP = mk(gPetals, mPetal, flowers.length, 'lotus-flower-petals');
  const imC = mk(gCenter, mCenter, flowers.length, 'lotus-flower-center');
  const imB = mk(gBud, mBud, buds.length, 'lotus-bud');
  const nStalk = raised.length + flowers.length + buds.length;
  const imS = mk(gStalk, mStalk, nStalk, 'lotus-stalk');
  floatsA.forEach((f, i) => imFA.setColorAt(i, f.color));
  floatsB.forEach((f, i) => imFB.setColorAt(i, f.color));
  raised.forEach((f, i) => imR.setColorAt(i, f.color));

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  const qy = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
  const stalkBase = (x, z) => new THREE.Vector3(x, WL - 0.25, z);

  // ── 主角蓮花 ───────────────────────────────────────────
  const hero = new THREE.Group();
  hero.name = 'hero-lotus';
  const heroPetals = new THREE.Mesh(petalsGeometry(HERO_LAYERS, { segU: 12, segV: 18, seed: 'hero-petals' }), mPetal);
  const heroCenter = new THREE.Mesh(centerGeometry({ R: 0.027, H: 0.028, seeds: 17, stamens: 190, detail: 1, seed: 'hero-center' }), mCenter);
  heroPetals.name = 'hero-petals'; heroCenter.name = 'hero-center';
  hero.add(heroPetals, heroCenter);
  // 花托下方的綠色基部（花梗頂端膨大）
  const recept = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 10), new THREE.MeshStandardMaterial({ color: 0x6f8a3a, roughness: 0.55 }));
  recept.scale.set(1, 0.9, 1); recept.position.y = -0.036;
  hero.add(recept);
  group.add(hero);
  // 主角花梗：彎曲細管，從水下延伸到花托
  const leanAxis = new THREE.Vector3(-Math.cos(HERO_LEAN.az), 0, -Math.sin(HERO_LEAN.az)); // = up × 鏡頭水平方向
  const heroPose = (t) => {
    const sw = 0.006;
    const q = new THREE.Quaternion().setFromAxisAngle(leanAxis, HERO_LEAN.angle)
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(sw * Math.sin(t * 0.9), 0.3, sw * 0.8 * Math.sin(t * 0.7 + 1.0))));
    return q;
  };
  const heroStalkMat = underwater(new THREE.MeshStandardMaterial({ color: 0x5f7c36, roughness: 0.55 }), { amb: 0.2, key: 'hstalk' });
  let heroStalk = null;
  const heroStalkGeo = () => {
    const q = heroPose(0);
    const end = new THREE.Vector3(0, -0.05, 0).applyQuaternion(q).add(new THREE.Vector3(hx, hy, hz));
    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const base = new THREE.Vector3(hx - dir.x * 0.1, WL - 0.3, hz - dir.z * 0.1);
    // 二次貝茲：從水下垂直長出，頂端順著花的傾角
    const ctrl = end.clone().sub(dir.clone().multiplyScalar(0.22));
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, it = 1 - t;
      const p = base.clone().multiplyScalar(it * it).add(ctrl.clone().multiplyScalar(2 * it * t)).add(end.clone().multiplyScalar(t * t));
      pts.push([p.x, p.y, p.z]);
    }
    return tubeAlong(pts, (t) => 0.0068 - t * 0.0012, () => [1, 1, 1], 10);
  };
  heroStalk = new THREE.Mesh(heroStalkGeo(), heroStalkMat);
  heroStalk.name = 'hero-stalk';
  group.add(heroStalk);
  // 露珠：主角附近葉面上的水滴
  const dropMat = new THREE.MeshStandardMaterial({ color: 0x9aa890, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.75, envMapIntensity: 2.0 });
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), dropMat, 40);
  drops.name = 'dew'; drops.count = 0;
  group.add(drops);
  {
    const dr = makeRng('pond-dew');
    const heroLeaves = floats.filter((f) => Math.hypot(f.x - hx, f.z - hz) < 0.8);
    let n = 0;
    for (const f of heroLeaves) {
      const k = dr.int(2, 5);
      for (let i = 0; i < k && n < 40; i++) {
        const a = dr() * 6.28, d = f.r * dr.range(0.15, 0.6);
        const s = dr.range(0.003, 0.009);
        M.compose(P.set(f.x + Math.cos(a) * d, WL + 0.012 + s * 0.4, f.z + Math.sin(a) * d), Q.identity(), S.set(s, s * 0.6, s));
        drops.setMatrixAt(n++, M);
      }
    }
    drops.count = n;
  }

  function update(t) {
    floatsA.forEach((f, i) => setFloat(imFA, i, f, t));
    floatsB.forEach((f, i) => setFloat(imFB, i, f, t));
    imFA.instanceMatrix.needsUpdate = imFB.instanceMatrix.needsUpdate = true;
    let si = 0;
    raised.forEach((f, i) => {
      const base = stalkBase(f.x, f.z);
      const h = f.h + 0.25;
      const { q, top } = swayPose(base, h, f.lean, t, f.ph, 0.025, 0.9);
      setStalk(si++, base, top, 0.006);
      // 葉面朝向：沿莖傾斜一半，再加葉本身自轉
      Q.copy(q).slerp(new THREE.Quaternion(), 0.4).multiply(qy(f.rot));
      M.compose(top, Q, S.set(f.r, f.r, f.r));
      imR.setMatrixAt(i, M);
    });
    flowers.forEach((f, i) => {
      const base = stalkBase(f.x, f.z);
      const { q, top } = swayPose(base, f.h + 0.25, f.lean, t, f.ph, 0.02, 1.1);
      setStalk(si++, base, top, 0.005);
      Q.copy(q).multiply(qy(f.rot));
      const c = top.clone().add(new THREE.Vector3(0, 0.035 * f.s, 0).applyQuaternion(q));
      M.compose(c, Q, S.set(f.s, f.s, f.s));
      imP.setMatrixAt(i, M); imC.setMatrixAt(i, M);
    });
    buds.forEach((f, i) => {
      const base = stalkBase(f.x, f.z);
      const { q, top } = swayPose(base, f.h + 0.25, f.lean, t, f.ph, 0.025, 1.2);
      setStalk(si++, base, top, 0.0045);
      Q.copy(q).multiply(qy(f.rot));
      M.compose(top.clone().sub(new THREE.Vector3(0, 0.004, 0)), Q, S.set(f.s, f.s, f.s));
      imB.setMatrixAt(i, M);
    });
    for (const m of [imR, imP, imC, imB, imS]) m.instanceMatrix.needsUpdate = true;
    // 主角：極輕微擺動（花心保持在焦點 ±5 mm）
    hero.position.set(hx, hy, hz);
    hero.quaternion.copy(heroPose(t));
  }
  function setFloat(im, i, f, t) {
    const bob = 0.0015 * Math.sin(t * 1.3 + f.ph);
    Q.setFromEuler(new THREE.Euler(f.tilt[0] + 0.01 * Math.sin(t * 0.8 + f.ph), f.rot + 0.02 * Math.sin(t * 0.21 + f.ph), f.tilt[1]));
    M.compose(P.set(f.x, WL + 0.006 + bob, f.z), Q, S.set(f.r, f.r, f.r));
    im.setMatrixAt(i, M);
  }
  function setStalk(i, base, top, rad) {
    const d = top.clone().sub(base);
    const len = d.length();
    Q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    M.compose(base, Q, S.set(rad, len, rad));
    imS.setMatrixAt(i, M);
  }
  update(0);
  return { object: group, update, stats: { floats: floats.length, raised: raised.length, flowers: flowers.length, buds: buds.length } };
}
