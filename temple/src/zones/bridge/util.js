// 拱橋分區共用小工具：幾何合併、掃掠、實例化。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** 統一屬性（position/normal/uv，非索引或索引皆可）後合併。 */
export function merge(geos) {
  const list = geos.filter(Boolean).map((g) => {
    let h = g.index ? g : g;
    for (const k of Object.keys(h.attributes)) if (!['position', 'normal', 'uv'].includes(k)) h.deleteAttribute(k);
    if (!h.attributes.uv) {
      h.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
    }
    if (!h.attributes.normal) h.computeVertexNormals();
    return h.index ? h.toNonIndexed() : h;
  });
  if (!list.length) return new THREE.BufferGeometry();
  const m = mergeGeometries(list, false);
  return m;
}

/** 以公尺為單位的方塊（uv：每面依實際邊長）。中心在 (x,y,z)。 */
export function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  // 把 uv 換成公尺單位
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (nx > 0.5) uv.setXY(i, pz, py);
    else if (ny > 0.5) uv.setXY(i, px, pz);
    else uv.setXY(i, px, py);
  }
  g.translate(x, y, z);
  return g;
}

/** 從 a 到 b 的方材（截面 w × h，h 沿 up 方向）。uv 的 v 沿長向（木紋方向）。 */
export function beam(a, b, w, h, up = new THREE.Vector3(0, 1, 0)) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.BoxGeometry(w, h, len);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (nx > 0.5) uv.setXY(i, pos.getY(i), pos.getZ(i));
    else if (ny > 0.5) uv.setXY(i, pos.getX(i), pos.getZ(i));
    else uv.setXY(i, pos.getX(i), pos.getY(i));
  }
  const m = new THREE.Matrix4();
  const zAxis = B.clone().sub(A).normalize();
  let xAxis = new THREE.Vector3().crossVectors(up, zAxis);
  if (xAxis.lengthSq() < 1e-6) xAxis.set(1, 0, 0);
  xAxis.normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis);
  m.makeBasis(xAxis, yAxis, zAxis);
  m.setPosition(A.clone().add(B).multiplyScalar(0.5));
  g.applyMatrix4(m);
  return g;
}

/** 圓柱，從 a 到 b，半徑 r（可兩端不同）。uv：u = 周長公尺、v = 長度公尺。 */
export function rod(a, b, r, seg = 12, r2 = r, caps = true) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r2, r, len, seg, 1, !caps);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * r, uv.getY(i) * len);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q);
  g.translate(A.x, A.y, A.z);
  return g;
}

/**
 * 掃掠：沿 n+1 個截面點建立管狀網格。sections[i] 是一圈點（Vector3 陣列，數量一致），
 * closed 表示截面封閉。uv：u = 截面周長公尺，v = 沿路徑公尺。
 */
export function loft(sections, { closed = true, capEnds = true } = {}) {
  const n = sections.length, m = sections[0].length;
  const ring = closed ? m + 1 : m;
  const pos = [], uv = [], idx = [];
  let vAcc = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      let c = new THREE.Vector3(), p = new THREE.Vector3();
      for (const q of sections[i]) c.add(q);
      for (const q of sections[i - 1]) p.add(q);
      vAcc += c.distanceTo(p) / m;
    }
    let uAcc = 0;
    for (let j = 0; j < ring; j++) {
      const q = sections[i][j % m];
      if (j > 0) uAcc += q.distanceTo(sections[i][(j - 1) % m]);
      pos.push(q.x, q.y, q.z);
      uv.push(uAcc, vAcc);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < ring - 1; j++) {
      const a = i * ring + j, b = a + 1, c = a + ring, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const parts = [g];
  if (capEnds && closed) {
    for (const [sec, flip] of [[sections[0], true], [sections[n - 1], false]]) {
      const cp = [], ci = [];
      const c = new THREE.Vector3();
      for (const q of sec) c.add(q);
      c.multiplyScalar(1 / m);
      cp.push(c.x, c.y, c.z);
      for (const q of sec) cp.push(q.x, q.y, q.z);
      for (let j = 0; j < m; j++) {
        const a = 1 + j, b = 1 + ((j + 1) % m);
        if (flip) ci.push(0, a, b); else ci.push(0, b, a);
      }
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
      cg.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((m + 1) * 2).fill(0), 2));
      cg.setIndex(ci);
      cg.computeVertexNormals();
      parts.push(cg);
    }
  }
  return parts.length > 1 ? merge(parts) : g;
}

/** 由 (rows+1)×(cols+1) 的點陣建立曲面。fn(i, j) → [x,y,z, u, v]。 */
export function gridSurface(rows, cols, fn, flip = false) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
    const [x, y, z, u, v] = fn(i, j);
    pos.push(x, y, z); uv.push(u, v);
  }
  const W = cols + 1;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * W + j, b = a + 1, c = a + W, d = c + 1;
    if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 建立 InstancedMesh。mats：Matrix4 陣列。 */
export function instanced(geo, material, mats, { cast = false, receive = true, colors = null } = {}) {
  const im = new THREE.InstancedMesh(geo, material, mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  if (colors) colors.forEach((c, i) => im.setColorAt(i, c));
  im.castShadow = cast; im.receiveShadow = receive;
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}

export function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}

/** 由位置、Y 軸旋轉、縮放建立矩陣。 */
export function trs(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));
  return m;
}

/** 讓物件 +Z 軸由 a 指向 b、長度縮放到 |ab|（幾何需沿 +Z 長 1、起點在 0）。 */
export function alongMatrix(a, b, sx = 1, sy = 1) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const zAxis = B.clone().sub(A);
  const len = zAxis.length();
  zAxis.normalize();
  let xAxis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), zAxis);
  if (xAxis.lengthSq() < 1e-6) xAxis.set(1, 0, 0);
  xAxis.normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis);
  const m = new THREE.Matrix4().makeBasis(xAxis.multiplyScalar(sx), yAxis.multiplyScalar(sy), zAxis.multiplyScalar(len));
  m.setPosition(A);
  return m;
}

export const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
