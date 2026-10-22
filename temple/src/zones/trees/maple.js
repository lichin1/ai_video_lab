// 紅葉楓：遞迴分枝的樹幹（漸細管）＋ InstancedMesh 葉片，鏡頭 10 主角楓的特寫枝條、落葉（地面）與飄落葉（t 驅動）。
import * as THREE from 'three';
import { trees, focusPoints, sunDirection, inPond } from '../../layout.js';
import { heightAt } from '../../ground.js';
import { mat, scaled } from '../../materials.js';
import { makeRng, makeNoise2D } from '../../rng.js';
import { cameraAt, shots } from '../../shots.js';
import { MeshBuilder, randUnit, basisMatrix } from './tube.js';
import { makeLeafGeometry } from './leaf.js';

const V = THREE.Vector3;
const UP = new V(0, 1, 0);
const SUN = new V(...sunDirection()).normalize();
const SHADOW_FRACTION = 0.3;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// 葉色：金黃 → 橙 → 朱 → 紅 → 深紅
const PALETTE = [[0.0, '#e8b032'], [0.2, '#ec8a1c'], [0.4, '#e6561a'], [0.6, '#d02e18'], [0.8, '#a8131b'], [1.0, '#6e0915']]
  .map(([t, h]) => [t, new THREE.Color(h)]);
export function paletteAt(t, out = new THREE.Color()) {
  t = clamp01(t);
  for (let i = 1; i < PALETTE.length; i++) {
    if (t <= PALETTE[i][0]) {
      const [t0, c0] = PALETTE[i - 1], [t1, c1] = PALETTE[i];
      return out.copy(c0).lerp(c1, (t - t0) / (t1 - t0));
    }
  }
  return out.copy(PALETTE[PALETTE.length - 1][1]);
}

function distToSeg(p, a, b) {
  const ab = new V().subVectors(b, a), ap = new V().subVectors(p, a);
  const t = clamp01(ap.dot(ab) / ab.lengthSq());
  return ap.addScaledVector(ab, -t).length();
}

/** 鏡頭 10 的資訊：焦點、起始鏡位、視線基底、整段鏡頭路徑取樣 */
function heroShotInfo() {
  const F = focusPoints().maple;
  let idx = shots.findIndex((s) => s.focus.every((v, i) => Math.abs(v - F[i]) < 1e-6));
  if (idx < 0) idx = shots.length - 1;
  const t0 = idx * 7;
  const Fm = new V(...F);
  const cam0 = new V(...cameraAt(t0).pos);
  const vdir = Fm.clone().sub(cam0).normalize();
  const right = new V().crossVectors(vdir, UP).normalize();
  const camUp = new V().crossVectors(right, vdir).normalize();
  const path = [];
  for (let l = 0; l <= 7; l += 0.02) path.push(new V(...cameraAt(t0 + Math.min(l, 6.999)).pos));
  const pathDist = (p) => { let d = Infinity; for (const c of path) d = Math.min(d, c.distanceToSquared(p)); return Math.sqrt(d); };
  return { t0, Fm, cam0, vdir, right, camUp, pathDist };
}

// ── 單棵樹的枝幹生成 ────────────────────────────────────────────────
function growTree(spec, ti, { avoid = null } = {}) {
  const rng = makeRng('maple-tree-' + ti);
  const H = spec.height, C = spec.crown;
  const base = new V(spec.pos[0], heightAt(spec.pos[0], spec.pos[2]), spec.pos[2]);
  const cen = new V(base.x, base.y + H * 0.6, base.z);
  const ry = H * 0.42;
  const env = (p) => Math.hypot((p.x - cen.x) / C, (p.y - cen.y) / ry, (p.z - cen.z) / C);
  const outward = (p, out = new V()) => {
    out.set(p.x - cen.x, 0, p.z - cen.z);
    const l = out.length();
    return l > 1e-4 ? out.multiplyScalar(1 / l) : out.set(0, 0, 0);
  };
  const bld = new MeshBuilder();
  const tips = [];
  const maxD = 6;
  let trunkTop = null;
  const tmp = new V(), tmp2 = new V();
  const radialFor = (r) => (r > 0.1 ? 10 : r > 0.045 ? 7 : r > 0.022 ? 5 : 3);

  function grow(p0, dir, len, r0, depth) {
    const segs = depth < 2 ? 6 : depth < 4 ? 4 : 3;
    const pts = [p0.clone()], radii = [r0 * (depth === 0 ? 1.45 : 1)];
    const p = p0.clone(), d = dir.clone();
    const rEnd = Math.max(0.006, r0 * (depth === 0 ? 0.72 : 0.7));
    let blocked = false;
    for (let k = 1; k <= segs; k++) {
      d.addScaledVector(randUnit(rng, tmp), depth === 0 ? 0.08 : 0.16 + depth * 0.025);
      if (depth >= 3) d.y -= 0.022 * (depth - 2);
      d.y += 0.035;
      const e = env(p);
      if (e > 0.82) d.addScaledVector(tmp2.subVectors(cen, p).normalize(), (e - 0.82) * 2.2);
      d.normalize();
      p.addScaledVector(d, len / segs);
      if (avoid && depth >= 2 && avoid(p)) { blocked = true; break; }
      pts.push(p.clone());
      radii.push(r0 + (rEnd - r0) * (k / segs) ** 0.8);
    }
    if (pts.length < 2) return;
    const bump = depth === 0 ? (i, j, s) => 1 + 0.07 * Math.sin(j * 2.3 + s * 2.1) * Math.exp(-s * 0.8) + 0.04 * Math.sin(j * 5.1) : null;
    bld.tube(pts, radii, radialFor(r0), { vScale: 1, bump });
    if (blocked) return;
    if (depth === 0) trunkTop = p.clone();
    if (depth >= 5) for (let k = 1; k < pts.length - 1; k++) tips.push({ p: pts[k], d: d.clone(), w: 0.6 });
    if (depth === maxD) { tips.push({ p: p.clone(), d: d.clone() }); return; }
    // 側生小枝：讓樹冠內部也有葉
    if (depth >= 2) {
      for (let k = 2; k < pts.length - 1; k++) {
        if (rng() > 0.42) continue;
        const ax = randUnit(rng, new V()).cross(d).normalize();
        const sd = d.clone().applyAxisAngle(ax, rng.range(0.7, 1.1)).addScaledVector(outward(pts[k]), 0.3).normalize();
        grow(pts[k], sd, len * rng.range(0.35, 0.5), radii[k] * 0.55, Math.min(maxD, depth + 2));
      }
    }
    const nc = depth === 0 ? rng.int(4, 5) : (rng() < 0.3 ? 3 : 2);
    const az0 = rng() * Math.PI * 2;
    const u = new V().crossVectors(d, Math.abs(d.y) < 0.9 ? UP : new V(1, 0, 0)).normalize();
    const w = new V().crossVectors(d, u);
    for (let c = 0; c < nc; c++) {
      const ang = depth === 0 ? rng.range(0.6, 0.9) : rng.range(0.3, 0.62);
      const phi = az0 + (c * Math.PI * 2) / nc + rng.range(-0.4, 0.4);
      const off = u.clone().multiplyScalar(Math.cos(phi)).addScaledVector(w, Math.sin(phi));
      const cd = d.clone().multiplyScalar(Math.cos(ang)).addScaledVector(off, Math.sin(ang));
      cd.addScaledVector(outward(p), depth < 3 ? 0.3 : 0.15).normalize();
      const clen = depth === 0 ? C * rng.range(0.48, 0.6) : len * rng.range(0.66, 0.8);
      const cr = rEnd * (nc > 2 ? rng.range(0.6, 0.72) : rng.range(0.7, 0.82));
      grow(p, cd, clen, cr, depth + 1);
    }
  }

  const lean = randUnit(rng).setY(0).normalize().multiplyScalar(0.16);
  const tdir = UP.clone().add(lean).normalize();
  const Ht = H * rng.range(0.22, 0.3);
  grow(base.clone().setY(base.y - 0.15), tdir, Ht, 0.07 + 0.022 * H, 0);
  return { bld, tips, base, cen, C, ry, H, env, outward, rng, trunkTop };
}

// ── 葉片配置 ─────────────────────────────────────────────────────────
function scatterLeaves(tree, total, size, ti, noise) {
  const { tips, rng, base, H, env, outward } = tree;
  const n = Math.max(4, Math.round(total / tips.length));
  const cr = rng.range(0, 1);
  const bias = [0.05, 0.22, -0.05, -0.18, 0.12, 0.28, 0.0, -0.3, 0.15, -0.1][ti % 10];
  const leaves = [];
  const off = new V(), ow = new V(), r3 = new V();
  for (const tip of tips) {
    const clusterR = (typeof size === 'function' ? size(tip.p) : size) * rng.range(2.4, 3.4);
    for (let k = 0; k < n; k++) {
      randUnit(rng, off).multiplyScalar(clusterR * Math.cbrt(rng()));
      off.y *= 0.55;
      const p = tip.p.clone().add(off).addScaledVector(tip.d, clusterR * 0.35);
      if (env(p) > 1.22) continue;
      outward(p, ow);
      const ydir = tip.d.clone().multiplyScalar(0.5).add(randUnit(rng, r3).multiplyScalar(0.85)).addScaledVector(ow, 0.3);
      ydir.y -= 0.25;
      const nrm = new V(0, 0.8, 0).addScaledVector(ow, 0.5).add(randUnit(rng, r3).multiplyScalar(0.6));
      const hN = (p.y - base.y) / H;
      const t = -0.22 + 0.62 * hN + 0.45 * (env(p) - 0.6) + 0.28 * noise(p.x * 0.35 + ti * 7, p.z * 0.35 + p.y * 0.3) + bias + rng.gauss() * 0.08;
      const col = paletteAt(t);
      col.multiplyScalar(rng.range(0.85, 1.08));
      const sz = typeof size === 'function' ? size(p) : size;
      leaves.push({ p, y: ydir, n: nrm, s: sz * rng.range(0.8, 1.2), c: col, e: 1 });
    }
  }
  void cr;
  return leaves;
}

/** 以體素密度沿太陽方向累積光學厚度 → 每片葉的受光量 */
function computeExposure(leaves, { cell = 0.35, k = 0.55, floor = 0.1 } = {}) {
  const inv = 1 / cell;
  const key = (x, y, z) => ((Math.floor(x * inv) + 4096) * 8192 + (Math.floor(y * inv) + 4096)) * 8192 + (Math.floor(z * inv) + 4096);
  const grid = new Map();
  for (const l of leaves) {
    const kk = key(l.p.x, l.p.y, l.p.z);
    grid.set(kk, (grid.get(kk) || 0) + 0.45 * l.s * l.s * 0.5 / (cell * cell));
  }
  const steps = 34;
  for (const l of leaves) {
    let od = 0;
    let x = l.p.x + SUN.x * cell * 0.7, y = l.p.y + SUN.y * cell * 0.7, z = l.p.z + SUN.z * cell * 0.7;
    for (let s = 0; s < steps; s++) {
      od += grid.get(key(x, y, z)) || 0;
      x += SUN.x * cell; y += SUN.y * cell; z += SUN.z * cell;
    }
    l.e = Math.max(floor, Math.exp(-od * k));
  }
}

function leafMesh(geo, material, leaves, { castShadow = true, receiveShadow = false, shadowFraction = 1 } = {}) {
  // 打亂順序（固定種子），讓前 shadowFraction 比例的葉片成為均勻子集：陰影只畫這部分以省時間
  const sr = makeRng('leaf-order-' + leaves.length);
  for (let i = leaves.length - 1; i > 0; i--) { const j = Math.floor(sr() * (i + 1)); [leaves[i], leaves[j]] = [leaves[j], leaves[i]]; }
  const mesh = new THREE.InstancedMesh(geo, material, leaves.length);
  const m = new THREE.Matrix4();
  const ex = new Float32Array(leaves.length);
  leaves.forEach((l, i) => {
    basisMatrix(m, l.p, l.y, l.n, l.s);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, l.c);
    ex[i] = l.e;
  });
  geo = mesh.geometry;
  mesh.geometry = geo.clone();
  mesh.geometry.setAttribute('aExposure', new THREE.InstancedBufferAttribute(ex, 1));
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  if (castShadow && shadowFraction < 1) {
    const full = leaves.length, part = Math.max(1, Math.round(full * shadowFraction));
    mesh.onBeforeShadow = () => { mesh.count = part; };
    mesh.onAfterShadow = () => { mesh.count = full; };
  }
  mesh.computeBoundingSphere();
  return mesh;
}

// ── 主角楓：特寫枝條 ─────────────────────────────────────────────────
function heroSprays(tree, info, bld) {
  const { Fm, vdir, right, camUp } = info;
  const rng = makeRng('hero-maple-spray');
  const leaves = [];
  const P = (o, a, b, c) => o.clone().addScaledVector(right, a).addScaledVector(camUp, b).addScaledVector(vdir, c);

  /** 一枝對生葉的細枝：origin + 方向（在視平面內）＋ 節數 */
  function spray(origin, ax, ay, len, nodes, scale, colorT, { term = 3, droop = 0.09 } = {}) {
    const dirIn = right.clone().multiplyScalar(ax).addScaledVector(camUp, ay).normalize();
    const side = new V().crossVectors(dirIn, vdir).normalize(); // 視平面內垂直細枝的方向
    const pt = (s) => origin.clone().addScaledVector(dirIn, len * s).addScaledVector(side, -droop * s * s * len).addScaledVector(vdir, 0.03 * s);
    const pts = [], radii = [];
    for (let i = 0; i <= 12; i++) { pts.push(pt(i / 12)); radii.push(0.0068 - 0.0036 * (i / 12)); }
    bld.tube(pts, radii, 5);
    const add = (p, ydir, nrm, s, t) => {
      const c = paletteAt(t + rng.gauss() * 0.06);
      leaves.push({ p, y: ydir.normalize(), n: nrm.normalize(), s, c, e: 1, hero: true });
    };
    for (let k = 0; k < nodes; k++) {
      const s = 0.16 + 0.68 * (k / Math.max(1, nodes - 1));
      const a = pt(s), tg = pt(s + 0.02).sub(pt(s - 0.02)).normalize();
      const odd = k % 2 === 1;
      for (const sg of [1, -1]) {
        const yd = side.clone().multiplyScalar(sg * 0.9).addScaledVector(tg, 0.55).addScaledVector(vdir, odd ? sg * 0.45 : rng.range(-0.2, 0.2));
        if (sg < 0) yd.addScaledVector(camUp, -0.25);
        const nrm = vdir.clone().negate().addScaledVector(randUnit(rng), 0.3).addScaledVector(camUp, 0.15);
        add(a.clone(), yd, nrm, scale * rng.range(0.88, 1.08), colorT + (s - 0.5) * 0.18);
      }
    }
    const end = pt(1), tg = pt(1).sub(pt(0.96)).normalize();
    for (let k = 0; k < term; k++) {
      const ang = (k - (term - 1) / 2) * 0.75;
      const yd = tg.clone().applyAxisAngle(vdir, ang);
      const nrm = vdir.clone().negate().addScaledVector(randUnit(rng), 0.25);
      add(end.clone(), yd, nrm, scale * (k === (term - 1) / 2 ? 1.1 : 0.95), colorT - 0.08);
    }
    return pt;
  }

  // 主枝條：從右下進入畫面，橫越焦點
  const o1 = P(Fm, 0.27, -0.07, 0.02);
  spray(o1, -1, 0.22, 0.52, 5, 0.125, 0.46);
  // 從樹幹接到主枝條的枝
  if (tree.trunkTop) {
    const a = tree.trunkTop.clone(), b = o1;
    const c2 = b.clone().addScaledVector(right, 0.42).addScaledVector(camUp, -0.04).addScaledVector(vdir, 0.06);
    const c1 = a.clone().lerp(c2, 0.5).addScaledVector(UP, 0.35);
    const curve = new THREE.CatmullRomCurve3([a, c1, c2, b.clone().addScaledVector(right, 0.02)]);
    const pts = curve.getPoints(18), radii = pts.map((_, i) => 0.075 - 0.068 * (i / 18) ** 0.7);
    bld.tube(pts, radii, 6);
  }
  // 後景（稍失焦）
  const o2 = P(Fm, -0.36, 0.13, 0.4);
  spray(o2, 1, 0.35, 0.42, 4, 0.12, 0.62, { droop: -0.1 });
  const o3 = P(Fm, 0.42, 0.2, 0.85);
  spray(o3, -1, -0.15, 0.5, 4, 0.13, 0.3);
  const o5 = P(Fm, -0.15, -0.3, 0.6);
  spray(o5, 1, -0.2, 0.4, 3, 0.12, 0.72);
  // 前景（強烈失焦）
  const o4 = P(Fm, -0.34, -0.19, -0.2);
  spray(o4, 0.4, -1, 0.22, 1, 0.11, 0.52, { term: 2 });
  return leaves;
}

// ── 總組裝 ──────────────────────────────────────────────────────────
export function buildMaples(group, leafMat) {
  const bark = scaled(mat.wood, 1, 1);
  bark.color.setRGB(0.5, 0.52, 0.58);
  bark.roughness = 0.9;
  const noise = makeNoise2D('maple-color');
  const flatGeo = makeLeafGeometry(1, 1, 0);
  const foldGeo = makeLeafGeometry(2, 1, 0.5);
  const heroGeo = makeLeafGeometry(8, 8, 0.6);
  const info = heroShotInfo();
  const heroIdx = trees.heroMaple;
  const built = [];

  trees.maples.forEach((spec, ti) => {
    const isHero = ti === heroIdx;
    const sightEnd = info.Fm.clone().addScaledVector(info.vdir, 1.0);
    const avoid = isHero ? (p) => info.pathDist(p) < 0.24 || distToSeg(p, info.cam0, sightEnd) < 0.38 : null;
    const tree = growTree(spec, ti, { avoid });
    let leaves = scatterLeaves(tree, isHero ? 30000 : 26000, isHero ? (p) => (p.distanceTo(info.Fm) < 2.5 ? 0.12 : 0.18) : 0.21, ti, noise);
    let hero = [];
    if (isHero) {
      const { Fm, cam0, pathDist } = info;
      const rr = makeRng('hero-tunnel');
      leaves = leaves.filter((l) => {
        if (pathDist(l.p) < 0.34) return false;
        if (distToSeg(l.p, cam0, Fm.clone().addScaledVector(info.vdir, 0.15)) < 0.2) return false;
        const w = l.p.clone().sub(Fm), along = w.dot(SUN);
        if (along > 0.25 && w.addScaledVector(SUN, -along).length() < 0.3 + along * 0.06) return rr() < 0.12;
        if (l.p.distanceTo(Fm) < 0.3) return false;
        return true;
      });
      hero = heroSprays(tree, info, tree.bld);
    }
    computeExposure(leaves.concat(hero), { floor: isHero ? 0.12 : 0.1 });
    for (const l of hero) l.e = Math.max(l.e, 0.92);

    const branch = new THREE.Mesh(tree.bld.toGeometry(), bark);
    branch.castShadow = true; branch.receiveShadow = true;
    branch.name = `maple-${ti}-wood`;
    group.add(branch);
    const near = isHero ? leaves.filter((l) => l.p.distanceTo(info.Fm) < 2.2) : [];
    const far = isHero ? leaves.filter((l) => l.p.distanceTo(info.Fm) >= 2.2) : leaves;
    const lm = leafMesh(flatGeo, leafMat, far, { shadowFraction: SHADOW_FRACTION });
    lm.name = `maple-${ti}-leaves`;
    group.add(lm);
    if (near.length) {
      const nm = leafMesh(foldGeo, leafMat, near, { shadowFraction: SHADOW_FRACTION });
      nm.name = `maple-${ti}-leaves-near`;
      group.add(nm);
    }
    if (hero.length) {
      const hm = leafMesh(heroGeo, leafMat, hero, { castShadow: true });
      hm.name = 'maple-hero-spray';
      group.add(hm);
    }
    built.push({ spec, tree, isHero });
  });

  // 地上的落葉
  {
    const rng = makeRng('maple-fallen');
    const fallen = [];
    for (const { tree } of built) {
      const { base, C } = tree;
      const n = Math.round(900 * (C / 5) ** 2);
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, r = C * 1.3 * Math.pow(rng(), 0.75);
        const x = base.x + Math.cos(a) * r, z = base.z + Math.sin(a) * r;
        if (inPond(x, z, 0.4)) continue;
        const p = new V(x, heightAt(x, z) + 0.012 + rng() * 0.012, z);
        const ydir = new V(rng() - 0.5, 0, rng() - 0.5);
        const nrm = new V(rng.range(-0.25, 0.25), 1, rng.range(-0.25, 0.25));
        const c = paletteAt(rng.range(0.15, 0.95)).multiplyScalar(rng.range(0.55, 0.85));
        fallen.push({ p, y: ydir, n: nrm, s: 0.14 * rng.range(0.8, 1.2), c, e: 0.9 });
      }
    }
    const fm = leafMesh(flatGeo, leafMat, fallen, { castShadow: false, receiveShadow: true });
    fm.name = 'maple-fallen';
    group.add(fm);
  }

  return { built, info, heroGeo };
}

// ── 飄落的楓葉：位置是 t 的純函式（循環） ────────────────────────────
export function buildFallingLeaves(group, leafMat, geo, maples) {
  const rng = makeRng('maple-falling');
  const { built, info } = maples;
  const wind = new V(-SUN.x, 0, -SUN.z).normalize(); // 微風往東北東
  const items = [];
  const frac = (x) => x - Math.floor(x);
  const swayAt = (it, t) => [it.A * Math.sin(2 * Math.PI * it.f * t + it.ph1), it.A * 0.7 * Math.cos(2 * Math.PI * it.f * 0.83 * t + it.ph2)];
  const make = (x0, z0, y0, ground, P, ph) => ({
    x0, z0, y0, ground, P, ph,
    speed: rng.range(0.12, 0.3),
    A: rng.range(0.25, 0.6), f: rng.range(0.18, 0.35), ph1: rng() * 6.28, ph2: rng() * 6.28,
    spin: rng.range(-1.6, 1.6), rx: rng.range(0.6, 1.4), rf: rng.range(0.5, 1.1), ph3: rng() * 6.28,
    s: rng.range(0.1, 0.13), c: paletteAt(rng.range(0.2, 0.85)),
  });
  // 各樹周圍
  for (const { tree, isHero } of built) {
    const n = isHero ? 10 : 4;
    for (let i = 0; i < n; i++) {
      const a = rng() * 6.28, r = tree.C * rng.range(0.2, 0.95);
      const x0 = tree.base.x + Math.cos(a) * r, z0 = tree.base.z + Math.sin(a) * r;
      const y0 = tree.base.y + tree.H * rng.range(0.45, 0.85);
      const ground = heightAt(x0, z0) + 0.02;
      const fallH = y0 - ground;
      const P = fallH / rng.range(0.35, 0.6);
      items.push(make(x0, z0, y0, ground, P, rng() * P));
    }
  }
  // 鏡頭 10 開場：幾片葉恰好從特寫畫面前飄過
  const { Fm, cam0, vdir, right, camUp, t0 } = info;
  for (const [d, o, tc] of [[0.3, -0.12, 0.6], [0.9, 0.2, 1.4], [1.6, -0.35, 2.6], [0.55, 0.3, 3.4]]) {
    const target = cam0.clone().addScaledVector(vdir, d).addScaledVector(right, o).addScaledVector(camUp, 0.02);
    const ground = heightAt(target.x, target.z) + 0.02;
    const y0 = target.y + 1.6;
    const fallH = y0 - ground;
    const P = fallH / 0.4;
    const it = make(0, 0, y0, ground, P, 0);
    const uc = (y0 - target.y) / fallH;
    it.ph = ((uc * P - (t0 + tc)) % P + P) % P;
    const [sx, sz] = swayAt(it, t0 + tc);
    it.x0 = target.x - wind.x * it.speed * uc * P - sx;
    it.z0 = target.z - wind.z * it.speed * uc * P - sz;
    items.push(it);
  }
  const mesh = new THREE.InstancedMesh(geo, leafMat, items.length);
  mesh.geometry = geo.clone();
  mesh.geometry.setAttribute('aExposure', new THREE.InstancedBufferAttribute(new Float32Array(items.length).fill(1), 1));
  items.forEach((it, i) => mesh.setColorAt(i, it.c));
  mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.name = 'maple-falling';
  group.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new V(), s = new V();
  function update(t) {
    items.forEach((it, i) => {
      const u = frac((t + it.ph) / it.P);
      const [sx, sz] = swayAt(it, t);
      p.set(it.x0 + wind.x * it.speed * u * it.P + sx, it.y0 - (it.y0 - it.ground) * u, it.z0 + wind.z * it.speed * u * it.P + sz);
      e.set(it.rx * Math.sin(2 * Math.PI * it.rf * t + it.ph3) + 0.4, it.spin * t + it.ph1, 0.9 * Math.cos(2 * Math.PI * it.rf * 0.7 * t + it.ph2));
      q.setFromEuler(e);
      const fade = Math.min(1, u / 0.03, (1 - u) / 0.03);
      s.setScalar(it.s * Math.max(0.0001, fade));
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { update };
}
