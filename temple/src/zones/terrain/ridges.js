// 地形分區：遠山剪影（layout.terrain.farRidges）。環狀的山稜帶，霧中只見輪廓。
// 太陽方位附近的山稜壓低，讓 7° 的夕陽不被遮住。
import * as THREE from 'three';
import { terrain, sun } from '../../layout.js';
import { makeNoise2D, fbm } from '../../rng.js';

export function buildRidges() {
  const group = new THREE.Group();
  group.name = 'terrain-ridges';
  const sunAz = sun.azimuthDeg * Math.PI / 180;
  const tanSun = Math.tan((sun.elevationDeg - 2.5) * Math.PI / 180);
  const colors = [new THREE.Color(0x2a2d3c), new THREE.Color(0x3b3a52)];
  terrain.farRidges.forEach((rd, k) => {
    const noise = makeNoise2D(rd.seed);
    const N = 720;
    const pos = [];
    const idx = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;          // 方位角（由北順時針）
      const sx = Math.sin(a), sz = -Math.cos(a);
      const c = Math.cos(a), s = Math.sin(a);
      // 用圓上座標取雜訊 → 首尾無縫
      let h = 0.5 + 0.5 * fbm(noise, c * 2.2 + 7, s * 2.2 + 3, 5);
      h = Math.pow(h, 1.4) * 1.25;
      // 南側較低（layout：南面低平）
      const south = Math.max(0, -Math.cos(a)) ; // 1 = 正南? az=180 → cos=-1
      h *= 1 - 0.45 * south;
      // 太陽方位附近：壓到太陽下方
      let dAz = Math.abs(((a - sunAz + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const valley = Math.exp(-(dAz * dAz) / (2 * 0.32 * 0.32));
      let top = rd.height * h;
      const maxAtSun = rd.radius * tanSun;
      top = top * (1 - valley) + Math.min(top, maxAtSun * (0.55 + 0.45 * h)) * valley;
      // 截面：外側從 -20 m 隆起到山頂，再朝更遠處下降一點（只是背面）
      const prof = [[-140, -20], [-60, top * 0.45], [-15, top * 0.9], [0, top], [60, top * 0.6]];
      for (let r = 0; r < prof.length; r++) {
        const R = rd.radius + prof[r][0] + (r === 3 ? 0 : 0);
        pos.push(sx * R, prof[r][1], sz * R);
      }
    }
    const P = 5;
    for (let i = 0; i < N; i++) for (let r = 0; r < P - 1; r++) {
      const a = i * P + r, b = a + 1, c = a + P, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.MeshLambertMaterial({ color: colors[k % colors.length], side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m);
    mesh.name = `terrain-ridge-${k}`;
    group.add(mesh);
  });
  return group;
}
