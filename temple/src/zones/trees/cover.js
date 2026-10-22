// 境內點綴：修剪灌木（刈込み，杜鵑 / 紅葉的灯台躑躅）與草叢。避開參道、禁區、池、石燈籠、樹幹與圍牆。
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** 共用頂點的二十面體球（位移後法線才會平滑） */
function smoothIco(detail) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  return mergeVertices(g);
}
import { trees, toro, terrain, pond, inPond } from '../../layout.js';
import { heightAt, pathDistance } from '../../ground.js';
import { makeRng, makeNoise2D, fbm } from '../../rng.js';

const P = terrain.precinct;

function inKeepOut(x, z, m = 0) {
  return trees.keepOut.some((r) => x > r[0] - m && x < r[1] + m && z > r[2] - m && z < r[3] + m);
}
function keepOutDist(x, z) {
  let d = Infinity;
  for (const r of trees.keepOut) {
    const dx = Math.max(r[0] - x, 0, x - r[1]), dz = Math.max(r[2] - z, 0, z - r[3]);
    d = Math.min(d, Math.hypot(dx, dz));
  }
  return d;
}
const trunks = [...trees.maples, ...trees.pines].map((t) => t.pos);

function clear(x, z, m) {
  if (x < P.xMin + 1.8 + m || x > P.xMax - 1.8 - m || z < P.zMin + 1.8 + m || z > P.zMax - 1.8 - m) return false;
  if (inPond(x, z, pond.shoreWidth + 0.6 + m)) return false;
  if (pathDistance(x, z) < 0.5 + m) return false;
  if (inKeepOut(x, z, m)) return false;
  for (const t of toro.positions) if (Math.hypot(x - t[0], z - t[2]) < 1.0 + m) return false;
  for (const t of trunks) if (Math.hypot(x - t[0], z - t[2]) < 0.5 + m) return false;
  return true;
}
/** 點到池邊（含岸石帶）的距離近似 */
function pondRimDist(x, z) {
  const dx = (x - pond.center[0]) / pond.rx, dz = (z - pond.center[2]) / pond.rz;
  const d = Math.sqrt(dx * dx + dz * dz);
  return (d - 1) * Math.min(pond.rx, pond.rz) - pond.shoreWidth;
}

function leafyTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const rng = makeRng('shrub-leafy');
  g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 3800; i++) {
    const x = rng() * S, y = rng() * S, r = rng.range(2, 5), k = Math.round(rng.range(60, 255));
    g.fillStyle = `rgb(${k},${k},${k})`;
    g.beginPath(); g.ellipse(x, y, r, r * 0.6, rng() * 3.14, 0, Math.PI * 2); g.fill();
    for (const [ox, oy] of [[S, 0], [-S, 0], [0, S], [0, -S]]) { g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.6, 0, 0, Math.PI * 2); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function buildGroundCover(group) {
  const rng = makeRng('ground-cover');
  const noise = makeNoise2D('ground-cover');

  // ── 灌木 ──
  const shrubGeo = smoothIco(2);
  {
    const p = shrubGeo.attributes.position, n = makeNoise2D('shrub-shape');
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + 0.07 * fbm(n, x * 2 + 3, z * 2 + y * 1.5, 3);
      x *= k; z *= k; y = y < 0 ? y * 0.15 : y * k;
      p.setXYZ(i, x, y, z);
      uv[i * 2] = (Math.atan2(z, x) / (Math.PI * 2) + 0.5) * 4; uv[i * 2 + 1] = y * 2 + Math.hypot(x, z) * 0.5;
    }
    shrubGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    shrubGeo.computeVertexNormals();
  }
  const leafy = leafyTexture();
  const shrubMat = new THREE.MeshStandardMaterial({ name: 'shrub', map: leafy, bumpMap: leafy, bumpScale: 4, roughness: 0.9 });
  const shrubs = [];
  const greens = ['#34522a', '#3a5a2e', '#2e4826', '#466432'].map((h) => new THREE.Color(h));
  const autumn = ['#8a2216', '#a03a14', '#7a2a18', '#9a5a18'].map((h) => new THREE.Color(h));
  for (let tries = 0; shrubs.length < 95 && tries < 20000; tries++) {
    const x = rng.range(P.xMin, P.xMax), z = rng.range(P.zMin, P.zMax);
    const rim = pondRimDist(x, z), ko = keepOutDist(x, z);
    const pref = Math.max(rim > 0 && rim < 6 ? 1 : 0, ko > 1 && ko < 5 ? 0.8 : 0, (x < P.xMin + 9 || x > P.xMax - 9 || z < P.zMin + 9) ? 0.7 : 0);
    if (rng() > pref * (0.5 + 0.5 * noise(x / 15, z / 15))) continue;
    const r = rng.range(0.55, 1.3);
    if (!clear(x, z, r + 0.3)) continue;
    if (shrubs.some((s) => Math.hypot(s.x - x, s.z - z) < (s.r + r) * 0.8)) continue;
    const isAutumn = rng() < 0.28;
    shrubs.push({ x, z, r, h: r * rng.range(0.55, 0.8), rot: rng() * 6, c: rng.pick(isAutumn ? autumn : greens).clone().multiplyScalar(rng.range(0.85, 1.1)) });
  }
  {
    const mesh = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubs.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    shrubs.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
      m.compose(p.set(t.x, heightAt(t.x, t.z) - 0.03, t.z), q, s.set(t.r, t.h, t.r * rng.range(0.8, 1)));
      mesh.setMatrixAt(i, m); mesh.setColorAt(i, t.c);
    });
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = 'shrubs';
    mesh.computeBoundingSphere();
    group.add(mesh);
  }

  // ── 草叢 ──
  const pos = [], col = [], nrm = [];
  const BL = 13;
  const br = makeRng('grass-blade');
  const cBase = new THREE.Color('#3e5022'), cTip = new THREE.Color('#d8c070'), cMid = new THREE.Color('#7e8c3c');
  for (let b = 0; b < BL; b++) {
    const a = (b / BL) * Math.PI * 2 + br.range(-0.3, 0.3);
    const lean = br.range(0.3, 0.75), h = br.range(0.5, 1), w = br.range(0.025, 0.045);
    const dx = Math.cos(a), dz = Math.sin(a);
    const sx = -dz * w, sz = dx * w;
    const pt = (t) => [dx * lean * t * t * h + dx * 0.03, h * t * (1 - 0.15 * t), dz * lean * t * t * h + dz * 0.03];
    const p0 = pt(0), p1 = pt(0.5), p2 = pt(1);
    const L0 = [p0[0] - sx, p0[1], p0[2] - sz], R0 = [p0[0] + sx, p0[1], p0[2] + sz];
    const L1 = [p1[0] - sx * 0.7, p1[1], p1[2] - sz * 0.7], R1 = [p1[0] + sx * 0.7, p1[1], p1[2] + sz * 0.7];
    const tri = (A, B, Cc, ca, cb, cc) => { pos.push(...A, ...B, ...Cc); col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b); nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0); };
    tri(L0, R0, R1, cBase, cBase, cMid); tri(L0, R1, L1, cBase, cMid, cMid); tri(L1, R1, p2, cMid, cMid, cTip);
  }
  const grassGeo = new THREE.BufferGeometry();
  grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  grassGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  grassGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const grassMat = new THREE.MeshStandardMaterial({ name: 'grassTuft', vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
  const tufts = [];
  // 一叢叢聚生：先選叢心（池畔、樹根、建築邊），再在叢心周圍放 3–8 株
  for (let tries = 0; tufts.length < 1900 && tries < 60000; tries++) {
    const x = rng.range(P.xMin, P.xMax), z = rng.range(P.zMin, P.zMax);
    const rim = pondRimDist(x, z);
    let pref = 0.02;
    if (rim > 0 && rim < 4) pref += 0.8;
    for (const t of trunks) if (Math.hypot(x - t[0], z - t[2]) < 3) pref += 0.5;
    if (keepOutDist(x, z) < 2.5) pref += 0.35;
    if (rng() > pref) continue;
    const n = rng.int(3, 8);
    for (let k = 0; k < n; k++) {
      const a = rng() * 6.283, r = 0.55 * Math.sqrt(rng());
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (!clear(px, pz, 0.1)) continue;
      tufts.push({ x: px, z: pz, s: rng.range(0.28, 0.5), rot: rng() * 6, c: new THREE.Color(1, 1, 1).multiplyScalar(rng.range(0.75, 1.15)).lerp(new THREE.Color(1.1, 0.95, 0.7), rng() * 0.5) });
    }
  }
  {
    const mesh = new THREE.InstancedMesh(grassGeo, grassMat, tufts.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    tufts.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
      m.compose(p.set(t.x, heightAt(t.x, t.z) - 0.01, t.z), q, s.set(t.s * 1.2, t.s, t.s * 1.2));
      mesh.setMatrixAt(i, m); mesh.setColorAt(i, t.c);
    });
    mesh.receiveShadow = true;
    mesh.name = 'grass-tufts';
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
}
