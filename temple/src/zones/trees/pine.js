// 黑松（日本庭園修剪風格）：彎曲樹幹、水平伸出的枝、層狀雲朵般的針葉團（玉づくり）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { trees, pond, inPond } from '../../layout.js';
import { heightAt } from '../../ground.js';
import { makeRng, makeNoise2D, fbm } from '../../rng.js';
import { MeshBuilder, randUnit, basisMatrix } from './tube.js';
import { buildCoverageMips } from './leaf.js';

const V = THREE.Vector3;
const UP = new V(0, 1, 0);

function dataTex(data, S, H, { srgb = true, mips = null } = {}) {
  const t = new THREE.DataTexture(data, S, H, THREE.RGBAFormat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (mips) { t.mipmaps = mips; t.generateMipmaps = false; } else t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** 松針簇：由下方中心放射的針，alpha 貼圖。 */
function needleTexture(S = 256) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const rng = makeRng('pine-needles');
  g.lineCap = 'round';
  for (let i = 0; i < 170; i++) {
    const a = rng.range(-1.25, 1.25) * (0.6 + 0.4 * rng());
    const len = S * rng.range(0.45, 0.9) * (1 - 0.3 * Math.abs(a) / 1.25);
    const x0 = S * 0.5 + rng.range(-6, 6), y0 = S * 0.97;
    const bend = rng.range(-0.15, 0.15);
    const x1 = x0 + Math.sin(a) * len, y1 = y0 - Math.cos(a) * len;
    const mx = x0 + Math.sin(a + bend) * len * 0.5, my = y0 - Math.cos(a + bend) * len * 0.5;
    const k = rng.range(0.55, 1);
    g.strokeStyle = `rgb(${Math.round(180 * k)},${Math.round(215 * k)},${Math.round(160 * k)})`;
    g.lineWidth = rng.range(1.6, 2.6);
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
  }
  const img = g.getImageData(0, 0, S, S).data;
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const si = (y * S + x) * 4, di = ((S - 1 - y) * S + x) * 4;
    const a = img[si + 3];
    data[di] = a ? img[si] : 150; data[di + 1] = a ? img[si + 1] : 185; data[di + 2] = a ? img[si + 2] : 135; data[di + 3] = a;
  }
  return dataTex(data, S, S, { mips: buildCoverageMips(data, S, 0.4) });
}

/** 黑松樹皮：龜甲狀的深灰裂片（兩方向週期）。 */
function barkTexture(S = 256) {
  const noise = makeNoise2D('pine-bark');
  const data = new Uint8Array(S * S * 4);
  const T = Math.PI * 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const X = Math.cos(T * u) * 1.1 + Math.cos(T * v) * 0.5, Y = Math.sin(T * u) * 1.1 + Math.sin(T * v) * 0.5;
    const n = fbm(noise, X * 1.6 + 3, Y * 1.6, 4);
    const cr = Math.abs(noise(X * 2.2 + 11, Y * 4.0));
    const crack = cr < 0.09 ? 0.35 + cr * 4 : 1;
    const k = (0.75 + 0.25 * n) * crack;
    const i = (y * S + x) * 4;
    data[i] = 96 * k; data[i + 1] = 80 * k; data[i + 2] = 70 * k; data[i + 3] = 255;
  }
  return dataTex(data, S, S);
}

function inRect(x, z, r, m = 0) { return x > r[0] - m && x < r[1] + m && z > r[2] - m && z < r[3] + m; }

export function buildPines(group) {
  const barkMat = new THREE.MeshStandardMaterial({ name: 'pineBark', map: barkTexture(), roughness: 0.95 });
  const coreMat = new THREE.MeshStandardMaterial({ name: 'pineCore', color: new THREE.Color('#22341c'), roughness: 1 });
  const tuftMat = new THREE.MeshStandardMaterial({ name: 'pineNeedles', map: needleTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85 });
  const wood = new MeshBuilder();
  const cores = [];
  const tufts = [];
  const noise = makeNoise2D('pine-pad');

  trees.pines.forEach((spec, pi) => {
    const rng = makeRng('pine-' + pi);
    const H = spec.height, C = spec.crown;
    const base = new V(spec.pos[0], heightAt(spec.pos[0], spec.pos[2]), spec.pos[2]);
    // 傾斜方向：靠近池的松往池面探出，否則避開最近的禁區
    let lean = new V();
    const pc = new V(pond.center[0], 0, pond.center[2]);
    if (inPond(base.x, base.z, 16)) lean.set(pc.x - base.x, 0, pc.z - base.z).normalize();
    else {
      let best = Infinity;
      for (const r of trees.keepOut) {
        const cx = Math.max(r[0], Math.min(r[1], base.x)), cz = Math.max(r[2], Math.min(r[3], base.z));
        const d = Math.hypot(base.x - cx, base.z - cz);
        if (d < best && d > 0.01) { best = d; lean.set(base.x - cx, 0, base.z - cz).normalize(); }
      }
      if (best > 12) randUnit(rng, lean).setY(0).normalize();
    }
    lean.applyAxisAngle(UP, rng.range(-0.4, 0.4));
    const perp = new V(-lean.z, 0, lean.x);
    const Ht = H * 0.8;
    const ctrl = [];
    const ph = rng() * 6;
    for (let k = 0; k <= 6; k++) {
      const s = k / 6;
      const p = base.clone().addScaledVector(UP, Ht * s);
      p.addScaledVector(lean, H * 0.3 * Math.pow(Math.sin(s * Math.PI * 0.5), 1.4));
      p.addScaledVector(perp, Math.sin(s * Math.PI * 1.6 + ph) * 0.3 * (H / 7) * s);
      ctrl.push(p);
    }
    ctrl[0].y -= 0.2;
    const curve = new THREE.CatmullRomCurve3(ctrl);
    const N = 32;
    const pts = curve.getPoints(N);
    const r0 = 0.032 * H;
    const rAt = (s) => r0 * (1 - 0.72 * s) * (1 + 0.55 * Math.exp(-s * 16));
    const radii = pts.map((_, i) => rAt(i / N));
    wood.tube(pts, radii, 12, { vScale: 0.5, bump: (i, j, s) => 1 + 0.06 * noise(j * 0.9 + pi * 5, s * 2.5) });

    const pads = [];
    const nb = rng.int(5, 7);
    const ga = 2.39996;
    let az = Math.atan2(lean.z, lean.x) + rng.range(-0.5, 0.5);
    for (let b = 0; b < nb; b++) {
      const s = 0.38 + 0.52 * (b / (nb - 1)) + rng.range(-0.03, 0.03);
      const start = curve.getPoint(Math.min(0.97, s));
      az += ga;
      let h = new V(Math.cos(az), 0, Math.sin(az));
      const Lb = C * (0.55 + 0.55 * (1 - s)) * rng.range(0.8, 1.05);
      let end = start.clone().addScaledVector(h, Lb);
      if (trees.keepOut.some((r) => inRect(end.x, end.z, r, 1.2))) { h.negate(); end = start.clone().addScaledVector(h, Lb); }
      const side = new V(-h.z, 0, h.x);
      const p1 = start.clone().addScaledVector(h, Lb * 0.3).add(new V(0, -0.12, 0));
      const p2 = start.clone().addScaledVector(h, Lb * 0.65).addScaledVector(side, rng.range(-0.35, 0.35)).add(new V(0, -0.18, 0));
      const p3 = end.clone().add(new V(0, 0.22, 0));
      const bc = new THREE.CatmullRomCurve3([start, p1, p2, p3]);
      const bp = bc.getPoints(10), rb = rAt(s) * 0.5;
      wood.tube(bp, bp.map((_, i) => rb * (1 - 0.65 * i / 10)), 6, { vScale: 0.5 });
      const rx = C * rng.range(0.42, 0.55) * (1.05 - s * 0.3);
      pads.push({ c: p3.clone().add(new V(0, 0.12, 0)), rx, ry: rx * rng.range(0.3, 0.4), rz: rx * rng.range(0.75, 0.95), a: az });
      if (rng() < 0.65) {
        const sc = p2.clone().addScaledVector(side, (rng() < 0.5 ? -1 : 1) * Lb * 0.3).add(new V(0, 0.28, 0));
        const tw = [p2.clone(), p2.clone().lerp(sc, 0.5).add(new V(0, 0.05, 0)), sc];
        wood.tube(tw, [rb * 0.5, rb * 0.35, rb * 0.25], 5, { vScale: 0.5 });
        const r2 = rx * rng.range(0.55, 0.7);
        pads.push({ c: sc.clone().add(new V(0, 0.08, 0)), rx: r2, ry: r2 * 0.38, rz: r2 * 0.85, a: az + 0.6 });
      }
    }
    const top = curve.getPoint(1);
    pads.push({ c: top.clone().add(new V(0, 0.15, 0)), rx: C * 0.38, ry: C * 0.17, rz: C * 0.34, a: rng() * 6 });

    for (const pd of pads) {
      const g = new THREE.SphereGeometry(1, 14, 8);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const k = 1 + 0.12 * noise(x * 2.2 + pd.c.x, z * 2.2 + y * 1.7 + pd.c.z);
        x *= k; z *= k; y *= y < 0 ? 0.6 : k;
        p.setXYZ(i, x * pd.rx, y * pd.ry, z * pd.rz);
      }
      g.computeVertexNormals();
      g.rotateY(pd.a);
      g.translate(pd.c.x, pd.c.y, pd.c.z);
      cores.push(g);
      // 針葉簇
      const n = Math.round(pd.rx * pd.rz * 110 + 14);
      for (let i = 0; i < n; i++) {
        const th = rng() * Math.PI * 2, cy = rng() < 0.22 ? rng.range(-0.75, -0.2) : rng.range(-0.2, 1);
        const sy = Math.sqrt(Math.max(0, 1 - cy * cy));
        const lx = sy * Math.cos(th), lz = sy * Math.sin(th);
        const local = new V(lx * pd.rx * 0.93, cy * pd.ry * (cy < 0 ? 0.6 : 0.93), lz * pd.rz * 0.93).applyAxisAngle(UP, pd.a);
        const nrm = new V(lx / pd.rx, cy / pd.ry, lz / pd.rz).applyAxisAngle(UP, pd.a).normalize();
        const ydir = nrm.clone().multiplyScalar(0.75).addScaledVector(UP, 0.45).add(randUnit(rng).multiplyScalar(0.25));
        const pos = pd.c.clone().add(local).addScaledVector(nrm, -0.06);
        const light = 0.65 + 0.35 * Math.max(0, cy);
        const col = new THREE.Color('#3e5e30').lerp(new THREE.Color('#6e8a40'), rng() * 0.6).multiplyScalar(light * rng.range(0.85, 1.1));
        tufts.push({ p: pos, y: ydir, n: randUnit(rng), s: rng.range(0.26, 0.36) * Math.sqrt(C / 4), c: col });
      }
    }
  });

  const trunk = new THREE.Mesh(wood.toGeometry(), barkMat);
  trunk.castShadow = trunk.receiveShadow = true;
  trunk.name = 'pine-wood';
  group.add(trunk);
  const core = new THREE.Mesh(mergeGeometries(cores), coreMat);
  core.castShadow = core.receiveShadow = true;
  core.name = 'pine-pads';
  group.add(core);

  // 簇幾何：兩片交叉四邊形，原點在下緣，法線一律 +Y（讓光照呈現整團雲朵的明暗）
  const q1 = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const q2 = q1.clone().rotateY(Math.PI / 2);
  const tg = mergeGeometries([q1, q2]);
  const nr = tg.attributes.normal;
  for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
  const mesh = new THREE.InstancedMesh(tg, tuftMat, tufts.length);
  const m = new THREE.Matrix4();
  tufts.forEach((t, i) => { basisMatrix(m, t.p, t.y, t.n, t.s); mesh.setMatrixAt(i, m); mesh.setColorAt(i, t.c); });
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.name = 'pine-needles';
  mesh.computeBoundingSphere();
  group.add(mesh);
}
