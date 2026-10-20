// 地形分區：參道石板（layout.paths）。錯縫鋪設的花崗岩切石，倒角、微傾、色差，合併成一個網格。
import * as THREE from 'three';
import { paths, pagoda } from '../../layout.js';
import { heightAt } from '../../ground.js';
import { makeRng, makeNoise2D } from '../../rng.js';
import { mat } from '../../materials.js';
const ni = (g) => (g.index ? g.toNonIndexed() : g);

/** 一塊倒角石板（不含底面）。中心在原點，長 L（沿 X）、寬 W（沿 Z）、厚 H，頂面在 y = 0。 */
function slabPositions(L, W, H, bev) {
  const hx = L / 2, hz = W / 2, ix = hx - bev, iz = hz - bev, yb = -bev * 0.8;
  const top = [[-ix, 0, -iz], [ix, 0, -iz], [ix, 0, iz], [-ix, 0, iz]];
  const mid = [[-hx, yb, -hz], [hx, yb, -hz], [hx, yb, hz], [-hx, yb, hz]];
  const bot = mid.map(([x, , z]) => [x, -H, z]);
  const quads = [[top[0], top[3], top[2], top[1]]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quads.push([top[i], top[j], mid[j], mid[i]]);
    quads.push([mid[i], mid[j], bot[j], bot[i]]);
  }
  const out = [];
  for (const [a, b, c, d] of quads) out.push(a, b, c, a, c, d);
  return out;
}

export function buildPathStones() {
  const r = makeRng('terrain-slabs');
  const n = makeNoise2D('terrain-slab-tone');
  const pos = [], nor = [], col = [], uv = [];
  const tmp = new THREE.Vector3();

  // 判斷某點是否落在「先前的」路段上（交會處只鋪一次）
  const onPath = (pp, x, z, pad = 0) => {
    for (let i = 0; i < pp.pts.length - 1; i++) {
      const [ax, az] = pp.pts[i], [bx, bz] = pp.pts[i + 1];
      const vx = bx - ax, vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      if (Math.hypot(x - ax - vx * t, z - az - vz * t) < pp.w / 2 + pad) return true;
    }
    return false;
  };
  const ph = pagoda.baseSize / 2;
  const inPagodaBase = (x, z) => Math.abs(x - pagoda.pos[0]) < ph + 0.1 && Math.abs(z - pagoda.pos[2]) < ph + 0.1;

  paths.forEach((p, pi) => {
    for (let si = 0; si < p.pts.length - 1; si++) {
      const [ax, az] = p.pts[si], [bx, bz] = p.pts[si + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / len, dz = (bz - az) / len; // 沿路方向
      const px = -dz, pz = dx;                            // 橫向
      const yaw = Math.atan2(-dz, dx);                    // 讓石板長邊沿著路
      const wide = p.w >= 5;
      // 路的鋪法：主參道橫向 5–6 塊錯縫；支路 2–3 塊
      const rowLen = wide ? 0.62 : 0.55;
      const gap = 0.025;
      let s = 0;
      let row = 0;
      while (s < len - 0.05) {
        const rl = Math.min(rowLen * (0.85 + r() * 0.3), len - s);
        // 橫向切分
        let u = -p.w / 2;
        const off = (row & 1) ? 0.5 : 0;
        const nom = wide ? p.w / 5.5 : p.w / 2.5;
        let first = true;
        while (u < p.w / 2 - 0.05) {
          let wdt = nom * (0.7 + r() * 0.6);
          if (first) { wdt *= (0.5 + off); first = false; }
          wdt = Math.min(wdt, p.w / 2 - u);
          if (wdt < 0.12) break;
          const cu = u + wdt / 2, cs = s + rl / 2;
          const x = ax + dx * cs + px * cu, z = az + dz * cs + pz * cu;
          u += wdt;
          // 已被前面路段覆蓋、或在塔基壇下的就跳過
          let skip = inPagodaBase(x, z);
          for (let k = 0; k < pi && !skip; k++) if (onPath(paths[k], x, z, -0.05)) skip = true;
          if (skip) continue;
          const L = rl - gap, W = wdt - gap;
          const H = 0.14;
          const tris = slabPositions(L, W, H, 0.018 + r() * 0.012);
          const y0 = heightAt(x, z) + 0.035 + (r() - 0.5) * 0.012;
          const tiltX = (r() - 0.5) * 0.012, tiltZ = (r() - 0.5) * 0.012, jitterYaw = (r() - 0.5) * 0.02;
          const m = new THREE.Matrix4().compose(
            new THREE.Vector3(x, y0, z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, yaw + jitterYaw, tiltZ, 'YXZ')),
            new THREE.Vector3(1, 1, 1));
          // 色差：每塊略不同，偶有偏褐、偏青的石
          const tone = 0.78 + r() * 0.28 + n(x * 0.15, z * 0.15) * 0.06;
          const hue = r();
          const cr = tone * (hue < 0.2 ? 1.04 : 0.98), cg = tone * (hue > 0.85 ? 1.0 : 0.98), cb = tone * (hue > 0.85 ? 1.03 : 0.94);
          const uo = r() * 10, vo = r() * 10;
          const local = [];
          for (const v of tris) local.push(new THREE.Vector3(...v).applyMatrix4(m));
          for (let t = 0; t < local.length; t += 3) {
            const A = local[t], Bv = local[t + 1], C = local[t + 2];
            const N = tmp.copy(Bv).sub(A).cross(new THREE.Vector3().copy(C).sub(A)).normalize();
            for (let q = 0; q < 3; q++) {
              const V = local[t + q];
              const lv = tris[t + q];
              pos.push(V.x, V.y, V.z);
              nor.push(N.x, N.y, N.z);
              // 邊緣（倒角/側面）稍暗：風化與髒污
              const edgeDark = lv[1] < -0.001 ? 0.72 : 1.0;
              col.push(cr * edgeDark, cg * edgeDark, cb * edgeDark);
              uv.push(lv[0] + uo + (lv[1] < -0.001 ? lv[1] : 0), lv[2] + vo);
            }
          }
        }
        s += rl;
        row++;
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  const m = mat.stone.clone();
  m.vertexColors = true;
  m.roughness = 0.86;
  const mesh = new THREE.Mesh(geo, m);
  mesh.name = 'terrain-path-slabs';
  mesh.receiveShadow = true;
  return mesh;
}
