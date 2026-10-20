// 地形分區：築地塀（寺域圍牆）。石積基礎 + 略收分的白壁（五本定規筋）+ 本瓦葺小屋頂與棟。
// 東、西、北三面沿寺域邊界；南面沿山門所在的線，山門處留 gateGap 開口。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrain, sanmon } from '../../layout.js';
import { mat, scaled } from '../../materials.js';
import { makeCanvas, toTexture, fillPixels, periodicFbm, c255 } from './tex.js';
const ni = (g) => (g.index ? g.toNonIndexed() : g);

/** 沿 2D 線段 a→b 掃掠一個橫截面（陣列 [u, y]，u 為橫向偏移），產生側面帶，uv = (沿線距離, 截面弧長)。 */
function sweep(a, b, profile, { closeEnds = false, uScale = 1 } = {}) {
  const [ax, az] = a, [bx, bz] = b;
  const L = Math.hypot(bx - ax, bz - az);
  const dx = (bx - ax) / L, dz = (bz - az) / L;
  const px = -dz, pz = dx;
  const pos = [], uv = [], idx = [];
  let arc = [0];
  for (let i = 1; i < profile.length; i++) arc.push(arc[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  // 每段截面邊各自一組頂點（硬邊）
  for (let i = 0; i < profile.length - 1; i++) {
    const p0 = profile[i], p1 = profile[i + 1];
    const base = pos.length / 3;
    for (const [s, pp, ar] of [[0, p0, arc[i]], [0, p1, arc[i + 1]], [L, p0, arc[i]], [L, p1, arc[i + 1]]]) {
      pos.push(ax + dx * s + px * pp[0], pp[1], az + dz * s + pz * pp[0]);
      uv.push(s * uScale, ar);
    }
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g = ni(g);
  g.computeVertexNormals();
  if (closeEnds) {
    const caps = [];
    for (const [s, flip] of [[0, true], [L, false]]) {
      const shape = new THREE.Shape(profile.map(([u, y]) => new THREE.Vector2(u, y)));
      const cg = new THREE.ShapeGeometry(shape);
      // ShapeGeometry 在 XY 平面：x=u, y=y → 轉到世界
      const p = cg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i), y = p.getY(i);
        p.setXYZ(i, ax + dx * s + px * u, y, az + dz * s + pz * u);
      }
      if (flip !== isCCWFacing(dx, dz, px, pz)) flipWinding(cg);
      cg.computeVertexNormals();
      caps.push(ni(cg));
    }
    g = mergeGeometries([g, ...caps.map((c) => { c.deleteAttribute('normal'); c.computeVertexNormals(); return c; })]);
  }
  return g;
}
function isCCWFacing() { return true; }
function flipWinding(g) {
  const i = g.index.array;
  for (let k = 0; k < i.length; k += 3) { const t = i[k + 1]; i[k + 1] = i[k + 2]; i[k + 2] = t; }
}

function wallTexture() {
  // u：沿牆 4 m 一張；v：0..1 對應白壁高度。五本定規筋 + 雨漬 + 腳部泥污。
  const S = 512, cv = makeCanvas(S), g = cv.getContext('2d');
  const N = periodicFbm('tw-plaster', 4, 5), D = periodicFbm('tw-drip', 16, 3);
  const lines = [0.58, 0.64, 0.70, 0.76, 0.82];
  fillPixels(g, S, (u, v) => {
    const y = 1 - v; // 0 底 → 1 頂
    let k = 0.92 + N(u, v) * 0.08;
    // 屋簷下的雨漬（垂直條紋，往下漸淡）
    const drip = Math.max(0, D(u, 0.02 * v) - 0.45) * 1.6 * Math.pow(y, 2.2);
    k -= drip * 0.25;
    // 腳部泥污
    k -= Math.max(0, 0.22 - y) * 1.1 * (0.6 + N(u * 2 % 1, v) * 0.6);
    let r = 236 * k, gg = 229 * k, b = 214 * k;
    for (const L of lines) {
      const d = Math.abs(y - L) * S;
      if (d < 2.2) { const f = d < 1.1 ? 0.78 : 0.9; r *= f; gg *= f; b *= f * 0.98; }
      else if (d < 3.5 && y < L) { r *= 1.03; gg *= 1.03; b *= 1.03; } // 筋下緣受光
    }
    return [c255(r), c255(gg), c255(b)];
  });
  return toTexture(cv);
}

export function buildWall() {
  const W = terrain.wall, P = terrain.precinct;
  const zS = sanmon.pos[2];
  const gx = sanmon.pos[0], gh = W.gateGap / 2;
  const T = W.thickness, H = W.height;
  // 中心線（逆時針外圈）：南牆在山門線上
  const segs = [
    [[gx - gh, zS], [P.xMin, zS]],
    [[P.xMin, zS], [P.xMin, P.zMin]],
    [[P.xMin, P.zMin], [P.xMax, P.zMin]],
    [[P.xMax, P.zMin], [P.xMax, zS]],
    [[P.xMax, zS], [gx + gh, zS]],
  ];
  // 截面（u 橫向、y 高）
  const baseH = 0.45, roofBase = H - 0.42;
  const bT = T / 2 + 0.08, wb = T / 2, wt = T / 2 - 0.07; // 牆身收分
  const eave = T / 2 + 0.42;
  const stoneProf = [[-bT, -0.15], [-bT, baseH - 0.04], [-bT + 0.04, baseH], [-wb, baseH], [wb, baseH], [bT - 0.04, baseH], [bT, baseH - 0.04], [bT, -0.15]];
  const plasterProf = [[-wb, baseH], [-wt, roofBase], [wt, roofBase], [wb, baseH]];
  // 屋頂：從屋脊往兩側下垂的微凹曲面
  const ridgeY = H - 0.12, eaveY = roofBase - 0.02;
  const roofSide = (sgn) => {
    const pts = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      const u = 0.12 + (eave - 0.12) * t;
      const y = ridgeY + (eaveY - ridgeY) * (t * 0.8 + t * t * 0.2) - Math.sin(Math.PI * t) * 0.03;
      pts.push([sgn * u, y]);
    }
    return pts;
  };
  const roofL = roofSide(-1).reverse(), roofR = roofSide(1);
  const roofProf = [...roofL, ...roofR];
  // 屋頂底面（軒裏）與破風
  const soffitProf = [[eave, eaveY], [eave - 0.02, eaveY - 0.07], [wt, roofBase - 0.06], [-wt, roofBase - 0.06], [-eave + 0.02, eaveY - 0.07], [-eave, eaveY]];
  const ridgeProf = [[-0.16, ridgeY - 0.04], [-0.15, H - 0.02], [-0.1, H + 0.03], [0.1, H + 0.03], [0.15, H - 0.02], [0.16, ridgeY - 0.04]];

  const stones = [], plasters = [], roofs = [], soffits = [], ridges = [];
  const eaveTiles = [];
  for (const [a, b] of segs) {
    // 轉角處延伸半個厚度，讓牆在角落接合
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
    const isGateA = a[1] === zS && Math.abs(a[0] - gx) <= gh + 1e-6;
    const isGateB = b[1] === zS && Math.abs(b[0] - gx) <= gh + 1e-6;
    const ea = isGateA ? 0 : eave, eb = isGateB ? 0 : eave;
    const A = [a[0] - dx * (isGateA ? 0 : T / 2), a[1] - dz * (isGateA ? 0 : T / 2)];
    const B = [b[0] + dx * (isGateB ? 0 : T / 2), b[1] + dz * (isGateB ? 0 : T / 2)];
    const Ar = [a[0] - dx * ea, a[1] - dz * ea], Br = [b[0] + dx * eb, b[1] + dz * eb];
    stones.push(sweep(A, B, stoneProf, { closeEnds: isGateA || isGateB }));
    plasters.push(sweep(A, B, plasterProf, { closeEnds: isGateA || isGateB, uScale: 0.25 }));
    roofs.push(sweep(Ar, Br, roofProf));
    soffits.push(sweep(Ar, Br, soffitProf));
    ridges.push(sweep(Ar, Br, ridgeProf));
    // 軒丸瓦：沿兩側簷口每 0.3 m 一個
    const Lr = Math.hypot(Br[0] - Ar[0], Br[1] - Ar[1]);
    const px = -dz, pz = dx;
    for (let s = 0.15; s < Lr; s += 0.3) {
      for (const sg of [-1, 1]) {
        eaveTiles.push({
          x: Ar[0] + dx * s + px * sg * (eave + 0.015), z: Ar[1] + dz * s + pz * sg * (eave + 0.015),
          y: eaveY + 0.035, yaw: Math.atan2(px * sg, pz * sg),
        });
      }
    }
    // 山門側的牆頭：破風（以截面封口）
    if (isGateA || isGateB) {
      const at = isGateA ? Ar : Br;
      const capShape = new THREE.Shape([...roofProf, ...soffitProf].map(([u, y]) => new THREE.Vector2(u, y)));
      const cg = new THREE.ExtrudeGeometry(capShape, { depth: 0.04, bevelEnabled: false });
      cg.translate(0, 0, -0.02);
      cg.rotateY(Math.atan2(-dx, -dz));
      cg.translate(at[0], 0, at[1]);
      roofs.push(ni(cg));
    }
  }
  const strip = (gs) => mergeGeometries(gs.map((g) => {
    const h = g.index ? ni(g) : g;
    for (const k of Object.keys(h.attributes)) if (!['position', 'normal', 'uv'].includes(k)) h.deleteAttribute(k);
    if (!h.attributes.uv) h.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
    return h;
  }));
  const group = new THREE.Group();
  group.name = 'terrain-wall';

  const stoneM = scaled(mat.stone, 0.7, 0.7);
  stoneM.color = new THREE.Color(0.82, 0.8, 0.78);
  const plasterM = mat.plaster.clone();
  plasterM.map = wallTexture();
  // uv.v 為截面弧長 → 正規化到白壁高度
  const pg = strip(plasters);
  const uvA = pg.attributes.uv;
  for (let i = 0; i < uvA.count; i++) uvA.setY(i, 1 - uvA.getY(i) / (roofBase - baseH + 0.001));
  const tileM = scaled(mat.roofTile, 1 / 0.9, 1);
  const ridgeM = mat.roofTile.clone();
  ridgeM.normalMap = null; ridgeM.color = new THREE.Color(0.75, 0.78, 0.82);
  const soffitM = mat.plaster.clone();
  soffitM.color = new THREE.Color(0.72, 0.68, 0.62);

  const meshes = [
    [strip(stones), stoneM], [pg, plasterM], [strip(roofs), tileM], [strip(soffits), soffitM], [strip(ridges), ridgeM],
  ];
  for (const [g, m] of meshes) {
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  }
  // 軒丸瓦（InstancedMesh）
  const disc = new THREE.CircleGeometry(0.075, 7);
  const inst = new THREE.InstancedMesh(disc, ridgeM, eaveTiles.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  eaveTiles.forEach((t, i) => {
    q.setFromEuler(e.set(0, t.yaw, 0));
    m4.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(1, 1, 1));
    inst.setMatrixAt(i, m4);
  });
  inst.receiveShadow = true;
  group.add(inst);
  return group;
}
