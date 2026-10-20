// 地面高度函式（共用、唯讀）。所有需要「放在地上」的東西都用 heightAt(x, z)。
// 地形分區負責把這個函式做成網格；其他分區用它決定物件的 y。
import { terrain, pond, paths } from './layout.js';
import { makeNoise2D, fbm } from './rng.js';

const noise = makeNoise2D('ground');
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** 點到寺域矩形的距離（在矩形內為 0）。 */
function precinctDistance(x, z) {
  const p = terrain.precinct;
  const dx = Math.max(p.xMin - x, 0, x - p.xMax);
  const dz = Math.max(p.zMin - z, 0, z - p.zMax);
  return Math.hypot(dx, dz);
}

/** 點到參道折線的最短距離減去半寬（在路面上 ≤ 0）。 */
function pathDistance(x, z) {
  let best = Infinity;
  for (const p of paths) {
    for (let i = 0; i < p.pts.length - 1; i++) {
      const [ax, az] = p.pts[i], [bx, bz] = p.pts[i + 1];
      const vx = bx - ax, vz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
      best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t) - p.w / 2);
    }
  }
  return best;
}

/** 池底深度剖面：岸邊 0 → 中心 waterLevel - depth。 */
function pondBasin(x, z) {
  const dx = (x - pond.center[0]) / pond.rx;
  const dz = (z - pond.center[2]) / pond.rz;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d >= 1) return 0;
  const bottom = pond.waterLevel - pond.depth;
  const k = smooth(1.0, 0.82, d); // 岸邊較陡
  return bottom * k * (0.85 + 0.15 * (1 - d));
}

/** 地表高度（公尺）。寺域內為平地 y = 0，池塘挖下去，寺域外漸變為山丘。 */
export function heightAt(x, z) {
  const basin = pondBasin(x, z);
  if (basin < 0) return basin;
  const out = smooth(0, terrain.precinctBlend, precinctDistance(x, z));
  if (out <= 0) return 0;
  let h = 0;
  for (const hl of terrain.hills) {
    const d = Math.hypot(x - hl.x, z - hl.z) / hl.radius;
    if (d < 1.6) h += hl.height * Math.exp(-d * d * 1.8);
  }
  h += 6 * fbm(noise, x / 90, z / 90, 4) + 4;
  h = Math.max(h, 0);
  const road = smooth(0, 6, pathDistance(x, z)); // 寺外參道保持平坦
  return h * out * road;
}

/** 地表法線 [nx, ny, nz]（有限差分）。 */
export function normalAt(x, z, e = 0.5) {
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  const nx = -hx, ny = 2 * e, nz = -hz;
  const l = Math.hypot(nx, ny, nz);
  return [nx / l, ny / l, nz / l];
}

export { pathDistance, precinctDistance };
