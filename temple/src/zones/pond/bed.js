// 池底：沿 heightAt 的深色淤泥（略抬高 + polygonOffset，蓋過地形網格的池內部分）與沉水水草。
import * as THREE from 'three';
import { pond } from '../../layout.js';
import { heightAt } from '../../ground.js';
import { makeRng, makeNoise2D, fbm } from '../../rng.js';
import { canvasTex } from './geom.js';
import { underwater } from './underwater.js';

const LIFT = 0.035;

function mudTexture() {
  return canvasTex(512, 512, (g, W) => {
    const n = makeNoise2D('pond-mud');
    const r = makeRng('pond-mud');
    const img = g.createImageData(W, W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const u = x / W, v = y / W;
      // 可平鋪的 fbm（四角交叉淡化）
      const N = (fx, o) => {
        const a = fbm(n, u * fx, v * fx, o), b = fbm(n, (u - 1) * fx, v * fx, o);
        const c = fbm(n, u * fx, (v - 1) * fx, o), d = fbm(n, (u - 1) * fx, (v - 1) * fx, o);
        return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
      };
      const big = N(3, 4), fine = N(24, 2);
      const k = 0.75 + big * 0.35 + fine * 0.12;
      const algae = Math.max(0, big * 1.5 - 0.15);
      const c = [62 * k, 52 * k, 34 * k].map((cv, i) => cv * (1 - algae * 0.5) + [48, 62, 30][i] * algae * 0.5 * k);
      const i4 = (y * W + x) * 4;
      img.data[i4] = c[0]; img.data[i4 + 1] = c[1]; img.data[i4 + 2] = c[2]; img.data[i4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // 小卵石與沉葉
    for (let k = 0; k < 160; k++) {
      const x = r() * W, y = r() * W, s = 1.5 + r() * 4;
      const l = 70 + r() * 50;
      g.fillStyle = `rgba(${l},${l * 0.92},${l * 0.78},${0.5 + r() * 0.4})`;
      g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2); g.fill();
    }
    for (let k = 0; k < 40; k++) {
      const x = r() * W, y = r() * W, s = 5 + r() * 9;
      g.fillStyle = `rgba(${70 + r() * 40},${40 + r() * 20},20,0.55)`;
      g.beginPath(); g.ellipse(x, y, s, s * 0.45, r() * 3, 0, Math.PI * 2); g.fill();
    }
  }, { wrap: true });
}

export function buildBed() {
  const group = new THREE.Group();
  group.name = 'pond-bed';
  const [cx, , cz] = pond.center;
  const segA = 180, rings = 46, dMax = 0.985;
  const pos = [], uv = [], idx = [];
  pos.push(cx, heightAt(cx, cz) + LIFT, cz); uv.push(cx / 2.5, cz / 2.5);
  for (let j = 1; j <= rings; j++) {
    const u = j / rings;
    const d = dMax * (1 - Math.pow(1 - u, 1.7));
    for (let i = 0; i < segA; i++) {
      const a = (i / segA) * Math.PI * 2;
      const x = cx + Math.cos(a) * pond.rx * d, z = cz + Math.sin(a) * pond.rz * d;
      pos.push(x, heightAt(x, z) + LIFT, z); uv.push(x / 2.5, z / 2.5);
    }
  }
  for (let i = 0; i < segA; i++) idx.push(0, 1 + ((i + 1) % segA), 1 + i);
  for (let j = 1; j < rings; j++) {
    const o0 = 1 + (j - 1) * segA, o1 = 1 + j * segA;
    for (let i = 0; i < segA; i++) {
      const i1 = (i + 1) % segA;
      idx.push(o0 + i, o1 + i1, o1 + i, o0 + i, o0 + i1, o1 + i1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    name: 'pond-mud', map: mudTexture(), roughness: 0.95, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  underwater(mat, { amb: 0.25, key: 'mud' });
  const bed = new THREE.Mesh(g, mat);
  bed.name = 'pond-mud';
  bed.receiveShadow = true;
  group.add(bed);

  // 沉水水草：細長帶狀葉叢，只放在水深 > 0.35 m 的地方，葉尖低於水面
  const r = makeRng('pond-weed');
  const blade = new THREE.PlaneGeometry(1, 1, 1, 5).translate(0, 0.5, 0);
  {
    const p = blade.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      p.setX(i, p.getX(i) * (1 - y * 0.75));
      p.setZ(i, Math.sin(y * 2.2) * 0.25 * y);
    }
    blade.computeVertexNormals();
  }
  const weedMat = new THREE.MeshStandardMaterial({ name: 'pond-weed', color: 0x3c5a26, roughness: 0.8, side: THREE.DoubleSide });
  underwater(weedMat, { amb: 0.3, key: 'weed' });
  const blades = [];
  for (let c = 0; c < 140; c++) {
    const a = r() * Math.PI * 2, d = 0.25 + Math.sqrt(r()) * 0.68;
    const x0 = cx + Math.cos(a) * pond.rx * d, z0 = cz + Math.sin(a) * pond.rz * d;
    if (Math.abs(x0) < 2.2) continue;
    const depth = pond.waterLevel - heightAt(x0, z0);
    if (depth < 0.35) continue;
    const n = r.int(5, 10);
    for (let k = 0; k < n; k++) {
      const x = x0 + r.range(-0.25, 0.25), z = z0 + r.range(-0.25, 0.25);
      const y = heightAt(x, z) + LIFT;
      const h = Math.min(r.range(0.25, 0.8), (pond.waterLevel - 0.12) - y);
      if (h < 0.1) continue;
      blades.push({ x, y, z, h, w: r.range(0.012, 0.025), rot: r() * Math.PI * 2, lean: r.range(0.05, 0.4), ph: r() * 6.28 });
    }
  }
  const im = new THREE.InstancedMesh(blade, weedMat, blades.length);
  im.name = 'pond-weed';
  im.frustumCulled = false;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
  const instanceColor = new THREE.Color();
  blades.forEach((b, i) => im.setColorAt(i, instanceColor.setRGB(0.8 + r() * 0.4, 0.8 + r() * 0.4, 0.7 + r() * 0.3)));
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(im);
  function update(t) {
    blades.forEach((b, i) => {
      E.set(b.lean + 0.12 * Math.sin(t * 0.7 + b.ph), b.rot, 0.08 * Math.sin(t * 0.5 + b.ph * 1.3));
      Q.setFromEuler(E);
      M.compose(P.set(b.x, b.y, b.z), Q, S.set(b.w, b.h, b.h));
      im.setMatrixAt(i, M);
    });
    im.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { object: group, update };
}
