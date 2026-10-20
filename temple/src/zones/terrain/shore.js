// 地形分區：池塘岸石帶（layout.pond.shoreWidth）。沿橢圓排列大小不一的自然石，
// 水際大石半浸水中、外側小石填縫。池內 heightAt 下凹，石塊底部依地面高度埋入。
import * as THREE from 'three';
import { pond, bridge } from '../../layout.js';
import { heightAt } from '../../ground.js';
import { mat, scaled } from '../../materials.js';
import { makeRng, makeNoise2D, fbm } from '../../rng.js';
const ni = (g) => (g.index ? g.toNonIndexed() : g);

/** 一顆自然石的基本形（單位尺寸，底部平），帶頂面苔與水線暗色的頂點色。 */
function rockGeometry(seed, detail) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const n = makeNoise2D(seed);
  const r = makeRng(seed);
  const p = g.attributes.position;
  const sq = 0.68 + r() * 0.3;  // 扁平度
  const planes = [];
  for (let k = 0; k < 7; k++) {
    const a = r() * Math.PI * 2, el = (r() - 0.3) * 1.2;
    planes.push({ n: new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)), d: 0.62 + r() * 0.3 });
  }
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = 1 + 0.22 * fbm(n, v.x * 1.3 + v.y * 0.7 + 3, v.z * 1.3 - v.y * 0.9, 3) + 0.05 * n(v.x * 5, v.z * 5 + v.y * 4);
    v.multiplyScalar(d);
    // 稜角：用幾個隨機平面削切出破斷面
    for (const pl of planes) {
      const t = v.dot(pl.n) - pl.d;
      if (t > 0) v.addScaledVector(pl.n, -t);
    }
    v.y *= sq;
    if (v.y < -0.15) v.y = -0.15 - (v.y + 0.15) * 0.15; // 底部壓平
    // 稜角化：往少數幾個平面靠
    p.setXYZ(i, v.x, v.y + 0.15, v.z);
  }
  g.deleteAttribute('normal');
  const ng = g.index ? ni(g) : g;
  ng.computeVertexNormals();
  // 合併相同位置的法線（平滑但保留稜）
  const mg = smoothNormals(ng);
  const col = new Float32Array(mg.attributes.position.count * 3);
  const pp = mg.attributes.position, nn = mg.attributes.normal;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
    const up = Math.max(0, nn.getY(i));
    const f = fbm(n, x * 2.1 + 11, z * 2.1 - y, 3);
    const moss = Math.max(0, Math.min(1, (up - 0.55) * 2.5 + f * 1.2 - 0.1));
    let cr = 0.74 + f * 0.1, cg = 0.72 + f * 0.1, cb = 0.68 + f * 0.08;
    cr = cr * (1 - moss) + 0.3 * moss; cg = cg * (1 - moss) + 0.4 * moss; cb = cb * (1 - moss) + 0.16 * moss;
    const low = Math.max(0, 1 - y / 0.35);
    cr *= 1 - 0.45 * low; cg *= 1 - 0.42 * low; cb *= 1 - 0.4 * low;
    col[i * 3] = cr; col[i * 3 + 1] = cg; col[i * 3 + 2] = cb;
  }
  mg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  mg.computeBoundingSphere();
  return mg;
}

function smoothNormals(g) {
  const p = g.attributes.position, n = g.attributes.normal;
  const map = new Map();
  const key = (i) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    const a = map.get(k) || [0, 0, 0];
    a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i);
    map.set(k, a);
  }
  for (let i = 0; i < p.count; i++) {
    const a = map.get(key(i));
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
  }
  return g;
}

export function buildShore() {
  const group = new THREE.Group();
  group.name = 'terrain-shore';
  const r = makeRng('shore-stones');
  const [cx, , cz] = pond.center;
  const W = pond.shoreWidth;
  const VAR = 6;
  const bigGeos = [], smallGeos = [];
  for (let i = 0; i < VAR; i++) bigGeos.push(rockGeometry(`shore-big-${i}`, 2));
  for (let i = 0; i < VAR; i++) smallGeos.push(rockGeometry(`shore-small-${i}`, 1));
  const bigList = bigGeos.map(() => []), smallList = smallGeos.map(() => []);

  // 橢圓上以弧長均勻取點
  const N = 4000;
  const pts = [];
  let acc = 0, prev = null;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const x = cx + Math.cos(a) * pond.rx, z = cz + Math.sin(a) * pond.rz;
    if (prev) acc += Math.hypot(x - prev[0], z - prev[1]);
    pts.push({ a, x, z, s: acc });
    prev = [x, z];
  }
  const total = acc;
  const at = (s) => {
    s = ((s % total) + total) % total;
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].s < s) lo = m; else hi = m; }
    const p = pts[lo];
    // 外法線
    const nx = Math.cos(p.a) / pond.rx, nz = Math.sin(p.a) / pond.rz;
    const l = Math.hypot(nx, nz);
    return { x: p.x, z: p.z, nx: nx / l, nz: nz / l, tx: -nz / l, tz: nx / l };
  };
  const bridgeClear = bridge.width / 2 + 1.2;
  const blocked = (x) => Math.abs(x - bridge.center[0]) < bridgeClear;

  const place = (list, geos, x, z, sx, sy, sz, yaw, tone) => {
    const g = r.int(0, geos.length - 1);
    const ground = Math.min(heightAt(x, z), heightAt(x + sx * 0.6, z), heightAt(x - sx * 0.6, z), heightAt(x, z + sz * 0.6), heightAt(x, z - sz * 0.6));
    // 底部埋入，水際石頂部至少露出水面
    const top0 = ground + sy * 0.8;
    let yb = ground - sy * 0.12;
    if (top0 < pond.waterLevel + 0.08) { sy = (pond.waterLevel + 0.08 + r() * 0.18 - yb) / 0.95; }
    list[g].push({ x, y: yb, z, sx, sy, sz, yaw, tilt: (r() - 0.5) * 0.15, tone });
  };

  // 1) 水際的主石：沿線 0.9–1.6 m 間距，中心略在橢圓內
  for (let s = 0; s < total;) {
    const big = r() < 0.35;
    const size = big ? r.range(0.45, 0.8) : r.range(0.25, 0.45);
    const p = at(s);
    s += size * r.range(1.2, 1.7);
    if (blocked(p.x)) continue;
    const off = r.range(-0.45, 0.15) * W; // 往池內
    const x = p.x + p.nx * off, z = p.z + p.nz * off;
    place(bigList, bigGeos, x, z, size * r.range(0.9, 1.3), size * r.range(0.65, 1.0), size * r.range(0.8, 1.1), r() * Math.PI * 2, r.range(0.85, 1.1));
  }
  // 1b) 第二列：岸上的中石，與主石錯開
  for (let s = 0.4; s < total;) {
    const size = r.range(0.22, 0.42);
    const p = at(s);
    s += size * r.range(1.6, 2.6);
    if (blocked(p.x)) continue;
    const off = r.range(0.05, 0.42) * W;
    const x = p.x + p.nx * off, z = p.z + p.nz * off;
    place(bigList, bigGeos, x, z, size * r.range(0.9, 1.3), size * r.range(0.7, 1.05), size * r.range(0.8, 1.1), r() * Math.PI * 2, r.range(0.8, 1.05));
  }
  // 2) 岸上填縫的小石：帶寬 W 內散佈
  for (let s = 0; s < total;) {
    const p = at(s);
    s += r.range(0.18, 0.4);
    if (blocked(p.x)) continue;
    const k = r.int(1, 3);
    for (let j = 0; j < k; j++) {
      const off = r.range(-0.15, 0.55) * W;
      const along = r.range(-0.3, 0.3);
      const x = p.x + p.nx * off + p.tx * along, z = p.z + p.nz * off + p.tz * along;
      const size = r.range(0.07, 0.24) * (1 - Math.max(0, off / W) * 0.5);
      place(smallList, smallGeos, x, z, size * r.range(0.9, 1.4), size * r.range(0.5, 0.9), size * r.range(0.8, 1.2), r() * Math.PI * 2, r.range(0.75, 1.1));
    }
  }

  const m = scaled(mat.stone, 0.8, 0.8);
  m.vertexColors = true;
  m.roughness = 0.88;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  const emit = (geos, lists, cast) => {
    geos.forEach((g, gi) => {
      const L = lists[gi];
      if (!L.length) return;
      const im = new THREE.InstancedMesh(g, m, L.length);
      L.forEach((it, i) => {
        q.setFromEuler(e.set(it.tilt, it.yaw, it.tilt * 0.7, 'YXZ'));
        m4.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.sx, it.sy, it.sz));
        im.setMatrixAt(i, m4);
        im.setColorAt(i, c.setRGB(it.tone * 0.92, it.tone * 0.95, it.tone));
      });
      im.castShadow = cast; im.receiveShadow = true;
      im.computeBoundingSphere();
      group.add(im);
    });
  };
  emit(bigGeos, bigList, true);
  emit(smallGeos, smallList, false);
  return group;
}
