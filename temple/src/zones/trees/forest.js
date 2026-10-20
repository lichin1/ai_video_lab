// 背景杉林：便宜的多層錐體 InstancedMesh（杉），夾雜少量圓冠闊葉樹（部分轉黃、轉紅）。種在山坡上（heightAt）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { trees, inPond } from '../../layout.js';
import { heightAt } from '../../ground.js';
import { makeRng, makeNoise2D } from '../../rng.js';

function inKeepOut(x, z, m = 0) {
  return trees.keepOut.some((r) => x > r[0] - m && x < r[1] + m && z > r[2] - m && z < r[3] + m);
}

export function buildForest(group) {
  // 杉：三層錐體，底在 y = 0、頂在 y = 1、半徑 1
  const tiers = [[1.0, 0.0, 0.62], [0.74, 0.3, 0.42], [0.48, 0.56, 0.44]].map(([r, y0, h]) => {
    const g = new THREE.ConeGeometry(r, h, 7, 1, true);
    g.translate(0, y0 + h / 2, 0);
    return g;
  });
  const trunk = new THREE.CylinderGeometry(0.06, 0.08, 0.12, 5, 1, true).translate(0, -0.02, 0);
  const coneGeo = mergeGeometries([...tiers.map((g) => g.toNonIndexed()), trunk.toNonIndexed()]);
  coneGeo.computeVertexNormals();
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);
  {
    const p = blobGeo.attributes.position, n = makeNoise2D('forest-blob');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + 0.15 * n(x * 1.7, z * 1.7 + y);
      p.setXYZ(i, x * k, (y < 0 ? y * 0.4 : y * k) + 0.4, z * k);
    }
    blobGeo.computeVertexNormals();
  }
  const mat = new THREE.MeshStandardMaterial({ name: 'forest', color: 0xffffff, roughness: 1, flatShading: false });

  const cones = [], blobs = [];
  const sugi = [new THREE.Color('#16302c'), new THREE.Color('#1e3a32'), new THREE.Color('#223a2a'), new THREE.Color('#14282a')];
  const broad = [new THREE.Color('#2c3a24'), new THREE.Color('#3a3a22'), new THREE.Color('#7a4a1a'), new THREE.Color('#8a3018'), new THREE.Color('#6a5a20')];
  for (const band of trees.forestBands) {
    const rng = makeRng(band.seed);
    const noise = makeNoise2D(band.seed + '-density');
    let placed = 0, tries = 0;
    while (placed < band.count && tries < band.count * 12) {
      tries++;
      const x = rng.range(band.xMin, band.xMax), z = rng.range(band.zMin, band.zMax);
      if (inPond(x, z, 4) || inKeepOut(x, z, 3)) continue;
      const dens = 0.55 + 0.45 * noise(x / 40, z / 40);
      if (rng() > dens) continue;
      const y = heightAt(x, z);
      placed++;
      if (rng() < 0.16) {
        const r = rng.range(3, 5.5);
        blobs.push({ x, y: y - 0.4, z, sx: r, sy: r * rng.range(0.7, 0.9), rot: rng() * 6, c: rng.pick(broad).clone().multiplyScalar(rng.range(0.8, 1.1)) });
      } else {
        const h = rng.range(15, 28);
        cones.push({ x, y: y - 0.6, z, sx: h * rng.range(0.15, 0.2), sy: h, rot: rng() * 6, c: rng.pick(sugi).clone().multiplyScalar(rng.range(0.8, 1.15)) });
      }
    }
  }
  const make = (geo, list, name) => {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    list.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
      m.compose(p.set(t.x, t.y, t.z), q, s.set(t.sx, t.sy, t.sx));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, t.c);
    });
    mesh.receiveShadow = true;   // 不投影：太陽仰角 7°，30 m 的杉影會長達兩百多公尺、蓋掉整個寺域
    mesh.name = name;
    mesh.computeBoundingSphere();
    group.add(mesh);
  };
  make(coneGeo, cones, 'forest-sugi');
  make(blobGeo, blobs, 'forest-broadleaf');
}
