// 五重塔：幾何小工具（合併桶、公尺 uv 的方塊、沿線掃掠、網格曲面）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const V3 = THREE.Vector3;
export const UP = new V3(0, 1, 0);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;

/** 統一屬性：只留 position/normal/uv，全部帶 index，方便 mergeGeometries。 */
export function prep(g) {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.clearGroups();
  return g;
}

/** 依材質分桶，最後各桶合併成一個 Mesh。 */
export class Bucket {
  constructor() { this.lists = {}; }
  add(key, g, m) {
    prep(g);
    if (m) g.applyMatrix4(m);
    (this.lists[key] ||= []).push(g);
    return g;
  }
  /** 加入幾何的多個變換副本 */
  addCopies(key, g, mats) { prep(g); for (const m of mats) this.add(key, g.clone(), m); }
  build(materials, shadowKeys = new Set()) {
    const out = [];
    for (const [key, list] of Object.entries(this.lists)) {
      if (!list.length) continue;
      const geo = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      const mesh = new THREE.Mesh(geo, materials[key]);
      mesh.name = 'pagoda-' + key;
      mesh.castShadow = shadowKeys.has(key);
      mesh.receiveShadow = true;
      out.push(mesh);
    }
    return out;
  }
}

/** BoxGeometry，uv 以公尺為單位。 */
export function box(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]);
  }
  return g;
}

export function boxAt(w, h, d, x, y, z, rotY = 0) {
  const g = box(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

/** 兩點之間的方塊（長度方向 = a→b），w 為水平寬、h 為高。 */
export function boxBetween(a, b, w, h, up = UP) {
  const dir = new V3().subVectors(b, a);
  const L = dir.length();
  dir.divideScalar(L);
  const x = new V3().crossVectors(up, dir);
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
  x.normalize();
  const y = new V3().crossVectors(dir, x).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, dir);
  m.setPosition(new V3().addVectors(a, b).multiplyScalar(0.5));
  const g = box(w, h, L);
  g.applyMatrix4(m);
  return g;
}

/** 圓柱在兩點之間 */
export function cylBetween(a, b, r0, r1 = r0, seg = 12) {
  const dir = new V3().subVectors(b, a);
  const L = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, false);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(new V3().addVectors(a, b).multiplyScalar(0.5), q, new V3(1, 1, 1)));
  return g;
}

/**
 * 網格曲面：rows[i][j] 為頂點（i 沿第一方向、j 沿第二方向），uvs 同形狀。
 * want(i,j) 回傳期望的法線方向（只用第一個四邊形檢查繞序）。
 */
export function gridGeo(rows, uvs, want) {
  const ni = rows.length, nj = rows[0].length;
  const pos = new Float32Array(ni * nj * 3), uv = new Float32Array(ni * nj * 2);
  for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
    const k = i * nj + j, p = rows[i][j];
    pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
    const t = uvs ? uvs[i][j] : [i, j];
    uv[k * 2] = t[0]; uv[k * 2 + 1] = t[1];
  }
  // 繞序檢查
  let flip = false;
  if (want) {
    const a = rows[0][0], b = rows[1][0], c = rows[0][1];
    const n = new V3().subVectors(b, a).cross(new V3().subVectors(c, a));
    flip = n.dot(want) < 0;
  }
  const idx = [];
  for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nj - 1; j++) {
    const a = i * nj + j, b = (i + 1) * nj + j, c = i * nj + j + 1, d = (i + 1) * nj + j + 1;
    if (!flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 沿折線掃掠矩形斷面。pts: V3[]，side: V3[]（每點的水平寬度方向），w 寬、h 高。
 * 四個面各自獨立（稜角銳利），兩端封口。
 */
export function sweepRect(pts, side, w, h, caps = true) {
  const n = pts.length;
  const corners = [];
  let len = 0;
  const L = [0];
  for (let i = 1; i < n; i++) { len += pts[i].distanceTo(pts[i - 1]); L.push(len); }
  for (let i = 0; i < n; i++) {
    const T = new V3().subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    const S = side[i].clone().normalize();
    const U = new V3().crossVectors(T, S).normalize();
    if (U.y < 0) U.negate();
    const c = pts[i];
    const sw = S.clone().multiplyScalar(w / 2), uh = U.clone().multiplyScalar(h / 2);
    corners.push([
      c.clone().add(sw).add(uh), c.clone().sub(sw).add(uh),
      c.clone().sub(sw).sub(uh), c.clone().add(sw).sub(uh),
    ]);
  }
  const geos = [];
  const faceW = [w, h, w, h];
  for (let f = 0; f < 4; f++) {
    const rows = [], uvs = [];
    for (let i = 0; i < n; i++) {
      rows.push([corners[i][f], corners[i][(f + 1) % 4]]);
      uvs.push([[L[i], 0], [L[i], faceW[f]]]);
    }
    const mid = new V3().addVectors(corners[0][f], corners[0][(f + 1) % 4]).multiplyScalar(0.5).sub(pts[0]);
    geos.push(gridGeo(rows, uvs, mid));
  }
  if (caps) {
    for (const [i, s] of [[0, -1], [n - 1, 1]]) {
      const c = corners[i];
      const T = new V3().subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize().multiplyScalar(s);
      geos.push(gridGeo([[c[0], c[1]], [c[3], c[2]]], [[[0, 0], [w, 0]], [[0, h], [w, h]]], T));
    }
  }
  const g = mergeGeometries(geos.map(prep), false);
  return g;
}

/** 自訂旋轉體：profile = [[r, y], ...]，radial(θ) 回傳半徑倍率。 */
export function latheMod(profile, seg, radial = () => 1, dir = 1) {
  const phi0 = 0;
  const rows = [], uvs = [];
  let L = 0;
  const lens = [0];
  for (let i = 1; i < profile.length; i++) {
    L += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]);
    lens.push(L);
  }
  const maxR = Math.max(...profile.map((q) => q[0]));
  for (let s = 0; s <= seg; s++) {
    const th = phi0 + (s / seg) * Math.PI * 2;
    const k = radial(th);
    const row = [], urow = [];
    for (let i = 0; i < profile.length; i++) {
      const [r, y] = profile[i];
      row.push(new V3(Math.sin(th) * r * k, y, Math.cos(th) * r * k));
      urow.push([(s / seg) * Math.PI * 2 * maxR, lens[i]]);
    }
    rows.push(row); uvs.push(urow);
  }
  // 法線方向：取一個 r>0 的點往外
  let j = profile.findIndex((p) => p[0] > 1e-4);
  if (j < 0) j = 0;
  if (j >= profile.length - 1) j = profile.length - 2;
  // 剖面切線 (dr, dy) 的外法線：dir=+1 表示剖面由上往下沿外表面描（(-dy, dr)），-1 相反
  const dr = profile[j + 1][0] - profile[j][0], dy = profile[j + 1][1] - profile[j][1];
  const nr = -dy * dir, ny = dr * dir;
  const p = rows[0][j];
  const rl = Math.hypot(p.x, p.z) || 1;
  const want = new V3(p.x / rl * nr, ny, p.z / rl * nr);
  return gridGeoAt(rows, uvs, j, want);
}
function gridGeoAt(rows, uvs, j, want) {
  // 以 (0,j) 四邊形檢查
  const a = rows[0][j], b = rows[1][j], c = rows[0][j + 1];
  const n = new V3().subVectors(b, a).cross(new V3().subVectors(c, a));
  const flip = n.dot(want) < 0;
  const ni = rows.length, nj = rows[0].length;
  const pos = new Float32Array(ni * nj * 3), uv = new Float32Array(ni * nj * 2);
  for (let i = 0; i < ni; i++) for (let jj = 0; jj < nj; jj++) {
    const k = i * nj + jj, q = rows[i][jj];
    pos.set([q.x, q.y, q.z], k * 3);
    uv.set(uvs[i][jj], k * 2);
  }
  const idx = [];
  for (let i = 0; i < ni - 1; i++) for (let jj = 0; jj < nj - 1; jj++) {
    const A = i * nj + jj, B = (i + 1) * nj + jj, C = i * nj + jj + 1, D = (i + 1) * nj + jj + 1;
    if (!flip) idx.push(A, B, C, B, D, C); else idx.push(A, C, B, B, C, D);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 以變換參數組 Matrix4 */
export function M(x = 0, y = 0, z = 0, rotY = 0, rotX = 0, rotZ = 0, s = 1) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ'));
  const sc = typeof s === 'number' ? new V3(s, s, s) : s;
  return new THREE.Matrix4().compose(new V3(x, y, z), q, sc);
}
