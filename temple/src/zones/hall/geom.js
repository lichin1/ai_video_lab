// 主殿分區共用幾何工具：以公尺為單位的 UV、依材質分桶合併、梁、掃掠、格網曲面。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _v = new THREE.Vector3();

/** 只保留 position / normal / uv，並轉為 non-indexed，方便合併。 */
export function normalizeGeo(g) {
  let geo = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  geo.clearGroups();
  return geo;
}

/** 依法線選主軸做盒狀投影的公尺 UV（grain = 'x'|'y'|'z' 讓 v 沿該軸，木紋/刷痕方向）。 */
export function meterUV(geo, grain = 'y', scale = 1) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const c = { x: p.getX(i), y: p.getY(i), z: p.getZ(i) };
    const axis = ax >= ay && ax >= az ? 'x' : ay >= az ? 'y' : 'z';
    const others = ['x', 'y', 'z'].filter((a) => a !== axis);
    let uA = others[0], vA = others[1];
    if (others.includes(grain)) { vA = grain; uA = others.find((a) => a !== grain); }
    uv[i * 2] = c[uA] * scale; uv[i * 2 + 1] = c[vA] * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** 依材質分桶收集幾何，最後各自合併成一個 Mesh。 */
export class Bucket {
  constructor() { this.items = new Map(); }
  add(key, geo, matrix) {
    const g = normalizeGeo(geo.index ? geo : geo.clone());
    if (matrix) g.applyMatrix4(matrix);
    if (!this.items.has(key)) this.items.set(key, []);
    this.items.get(key).push(g);
    return g;
  }
  /** materials: { key: material }，opts: { key: { castShadow, receiveShadow } } */
  build(materials, opts = {}, defaults = { castShadow: true, receiveShadow: true }) {
    const group = new THREE.Group();
    for (const [key, list] of this.items) {
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, materials[key]);
      m.name = key;
      Object.assign(m, defaults, opts[key] || {});
      group.add(m);
    }
    return group;
  }
}

export function M(pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], order = 'YXZ') {
  return new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, order)), new THREE.Vector3(...(Array.isArray(scl) ? scl : [scl, scl, scl])));
}

/** 盒子（中心在原點），公尺 UV。 */
export function box(w, h, d, grain) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (!grain) grain = w >= h && w >= d ? 'x' : d >= h ? 'z' : 'y';
  return meterUV(normalizeGeo(g), grain);
}

/** 以兩端點定義的梁（矩形斷面 w×h，h 方向盡量朝上）。 */
export function beamMatrix(p0, p1, upHint = [0, 1, 0]) {
  const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
  const X = b.clone().sub(a); const L = X.length(); X.normalize();
  let up = new THREE.Vector3(...upHint);
  if (Math.abs(up.dot(X)) > 0.98) up = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3().crossVectors(X, up).normalize();
  const Y = new THREE.Vector3().crossVectors(Z, X).normalize();
  const m = new THREE.Matrix4().makeBasis(X, Y, Z);
  m.setPosition(a.add(b).multiplyScalar(0.5));
  return { m, L };
}
export function beam(p0, p1, w, h, upHint) {
  const { m, L } = beamMatrix(p0, p1, upHint);
  const g = box(L, h, w, 'x');
  g.applyMatrix4(m);
  return g;
}

/** 四角錐台（斗的斗尻）：頂邊 a、底邊 b、高 h，中心在原點。 */
export function frustum(a, b, h) {
  const g = new THREE.CylinderGeometry(a / Math.SQRT2, b / Math.SQRT2, h, 4, 1);
  g.rotateY(Math.PI / 4);
  return meterUV(normalizeGeo(g), 'y');
}

/**
 * 格網曲面：f(u, v) → [x, y, z]，u,v ∈ [0,1]。uvf(u,v) → [U,V]（預設以弧長估公尺）。
 * 回傳 indexed geometry（已算法線）；flip 反轉面向。
 */
export function gridSurface(nu, nv, f, { uvf, flip = false } = {}) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  const uv = new Float32Array((nu + 1) * (nv + 1) * 2);
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const k = j * (nu + 1) + i;
    const p = f(i / nu, j / nv);
    pos.set(p, k * 3);
    if (uvf) uv.set(uvf(i / nu, j / nv, p), k * 2);
  }
  if (!uvf) { // 沿 u、v 的累積弧長
    for (let j = 0; j <= nv; j++) {
      let s = 0;
      for (let i = 0; i <= nu; i++) {
        const k = j * (nu + 1) + i;
        if (i > 0) s += Math.hypot(pos[k * 3] - pos[k * 3 - 3], pos[k * 3 + 1] - pos[k * 3 - 2], pos[k * 3 + 2] - pos[k * 3 - 1]);
        uv[k * 2] = s;
      }
    }
    for (let i = 0; i <= nu; i++) {
      let s = 0;
      for (let j = 0; j <= nv; j++) {
        const k = j * (nu + 1) + i, kp = (j - 1) * (nu + 1) + i;
        if (j > 0) s += Math.hypot(pos[k * 3] - pos[kp * 3], pos[k * 3 + 1] - pos[kp * 3 + 1], pos[k * 3 + 2] - pos[kp * 3 + 2]);
        uv[k * 2 + 1] = s;
      }
    }
  }
  const idx = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * 沿折線掃掠 2D 斷面。pts: [[x,y,z]...]，profile: [[s, t]...]（s 橫向、t 上方向），closed 斷面。
 * 每條斷面邊各自成條帶 → 斷面轉角銳利、沿路徑平滑。
 */
export function sweep(pts, profile, { up = [0, 1, 0], closed = true, capStart = false, capEnd = false, scaleFn } = {}) {
  const P = pts.map((p) => new THREE.Vector3(...p));
  const frames = P.map((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    const T = b.clone().sub(a).normalize();
    const U0 = new THREE.Vector3(...up);
    const S = new THREE.Vector3().crossVectors(T, U0).normalize();
    const U = new THREE.Vector3().crossVectors(S, T).normalize();
    return { T, S, U };
  });
  const geos = [];
  const nE = closed ? profile.length : profile.length - 1;
  for (let e = 0; e < nE; e++) {
    const p0 = profile[e], p1 = profile[(e + 1) % profile.length];
    const pos = [], uv = [];
    let along = 0;
    for (let i = 0; i < P.length; i++) {
      if (i > 0) along += P[i].distanceTo(P[i - 1]);
      const { S, U } = frames[i];
      const sc = scaleFn ? scaleFn(i / (P.length - 1)) : 1;
      for (const [k, q] of [p0, p1].entries()) {
        _v.copy(P[i]).addScaledVector(S, q[0] * sc).addScaledVector(U, q[1] * sc);
        pos.push(_v.x, _v.y, _v.z);
        uv.push(k * Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), along);
      }
    }
    const idx = [];
    for (let i = 0; i < P.length - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    geos.push(normalizeGeo(g));
  }
  const capAt = (i, flip) => {
    const { S, U } = frames[i];
    const sc = scaleFn ? scaleFn(i / (P.length - 1)) : 1;
    const shape = new THREE.Shape(profile.map(([s, t]) => new THREE.Vector2(s, t)));
    const sg = new THREE.ShapeGeometry(shape);
    const m = new THREE.Matrix4().makeBasis(S.clone().multiplyScalar(sc), U.clone().multiplyScalar(sc), frames[i].T.clone().multiplyScalar(flip ? -1 : 1));
    m.setPosition(P[i]);
    sg.applyMatrix4(m);
    // ShapeGeometry 面向 +Z(局部) = T；起點蓋需朝 -T
    if (!flip) { const ix = sg.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k]; ix[k] = ix[k + 1]; ix[k + 1] = t; } sg.computeVertexNormals(); }
    geos.push(normalizeGeo(sg));
  };
  if (capStart) capAt(0, false);
  if (capEnd) capAt(P.length - 1, true);
  return mergeGeometries(geos, false);
}

export { mergeGeometries };

/** 把材質的 map / roughnessMap 改為物件空間三面投影（避免程式雕刻模型的 UV 接縫）。 */
export function triplanar(material, scale = 1, sharp = 4) {
  const m = material.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTriScale = { value: scale };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos; varying vec3 vTriN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 triP = vec4(position, 1.0);
        vec3 triN = normal;
        #ifdef USE_INSTANCING
          triP = instanceMatrix * triP; triN = mat3(instanceMatrix) * triN;
        #endif
        vTriPos = (modelMatrix * triP).xyz; vTriN = normalize(mat3(modelMatrix) * triN);`);
    const tri = (tex) => `(texture2D(${tex}, vTriPos.zy * uTriScale) * triW.x + texture2D(${tex}, vTriPos.xz * uTriScale) * triW.y + texture2D(${tex}, vTriPos.xy * uTriScale) * triW.z)`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vTriPos; varying vec3 vTriN; uniform float uTriScale;`)
      .replace('#include <map_fragment>', `
        vec3 triW = pow(abs(normalize(vTriN)), vec3(${sharp.toFixed(1)})); triW /= (triW.x + triW.y + triW.z);
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = ${tri('map')};
          diffuseColor *= sampledDiffuseColor;
        #endif`)
      .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;
        #ifdef USE_ROUGHNESSMAP
          roughnessFactor *= ${tri('roughnessMap')}.g;
        #endif`);
  };
  m.customProgramCacheKey = () => 'triplanar-' + scale + '-' + sharp;
  return m;
}
