// 分區：主殿（本堂）＋ 四盞青銅吊燈籠 ＋ 露座青銅佛像。
// 子模組：hall/dims.js（尺寸與屋根數學）、hall/building.js（軸部・斗栱・軒）、hall/roof.js（屋根）、
//        hall/lantern.js（釣燈籠）、hall/buddha.js（佛像）、hall/geom.js（工具）。
import * as THREE from 'three';
import { hall, buddha } from '../layout.js';
import { mat } from '../materials.js';
import { Bucket, triplanar } from './hall/geom.js';
import { buildHallBody, soffitYAt } from './hall/building.js';
import { buildRoof } from './hall/roof.js';
import { lanternGeometries } from './hall/lantern.js';
import { buildBuddha } from './hall/buddha.js';

export default function build() {
  const group = new THREE.Group();
  group.name = 'hall';

  // ── 分區材質（共用材質只 clone） ──
  const ds = (m) => { const c = m.clone(); c.side = THREE.DoubleSide; return c; };
  const roofMat = ds(mat.roofTile);
  const tileDark = new THREE.MeshStandardMaterial({ name: 'tileDark', color: 0x50555d, roughness: 0.52, metalness: 0.25 });
  const stoneTop = mat.stone.clone(); stoneTop.color = new THREE.Color(0xe2dcd2);
  const glow = mat.paper.clone(); glow.emissiveIntensity = 0.32; glow.color = new THREE.Color(0x6a4a2a); glow.side = THREE.FrontSide;
  const rafterEnd = new THREE.MeshStandardMaterial({ name: 'rafterEnd', color: 0xe9c46a, roughness: 0.6 });
  const materials = {
    vermilion: mat.vermilion, vermilionDS: ds(mat.vermilion), lattice: mat.vermilion,
    stone: mat.stone, stoneTop, plaster: mat.plaster, soffit: ds(mat.plaster), ceiling: ds(mat.plaster),
    glow, gold: mat.gold, rafterEnd, wood: mat.wood, roof: roofMat, tileDark, tileRow: tileDark,
  };

  // ── 主殿 ──
  const hallGroup = new THREE.Group();
  hallGroup.name = 'hall-building';
  hallGroup.position.set(...hall.pos);
  hallGroup.rotation.y = hall.rotY;
  const bk = new Bucket();
  buildHallBody(bk);
  buildRoof(bk);
  hallGroup.add(bk.build(materials, {
    tileRow: { castShadow: false }, glow: { castShadow: false }, rafterEnd: { castShadow: false },
    lattice: { castShadow: false }, gold: { castShadow: false },
  }));
  group.add(hallGroup);

  // ── 吊燈籠 ──
  const lanterns = [];
  const inv = new THREE.Matrix4().compose(new THREE.Vector3(...hall.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, hall.rotY, 0)), new THREE.Vector3(1, 1, 1)).invert();
  const lanternFlame = mat.flame.clone();
  const lanternGlow = mat.paper.clone(); lanternGlow.emissiveIntensity = 2.4;
  let heroLight = null;
  hall.hangingLanterns.xs.forEach((x, i) => {
    const local = new THREE.Vector3(x, hall.hangingLanterns.y - 0.6, hall.hangingLanterns.z).applyMatrix4(inv);
    const topY = soffitYAt(local.z) + hall.pos[1];
    const centerY = hall.hangingLanterns.y - 0.6;          // 燈籠中心 = focusPoints().hallLantern
    const drop = topY - centerY;
    const geo = lanternGeometries(drop);
    const lg = new THREE.Group();
    lg.position.set(local.x, topY - hall.pos[1], local.z);
    const b = new THREE.Mesh(geo.bronze, mat.bronze); b.castShadow = true; b.receiveShadow = true;
    const gl = new THREE.Mesh(geo.glow, lanternGlow);
    const fl = new THREE.Mesh(geo.flame, lanternFlame);
    lg.add(b, gl, fl);
    if (i === 1) {
      heroLight = new THREE.PointLight(0xffa452, 3.5, 9, 2);
      heroLight.position.set(0, -drop, 0);
      heroLight.castShadow = false;
      lg.add(heroLight);
    }
    hallGroup.add(lg);
    lanterns.push({ g: lg, ph: i * 1.7 });
  });

  // ── 露座佛像 ──
  const bronzeTri = triplanar(mat.bronze, 1.4);
  const bronzeTriDS = triplanar(mat.bronze, 1.4); bronzeTriDS.side = THREE.DoubleSide;
  const { group: bud } = buildBuddha({ bronze: bronzeTri, bronzeDS: bronzeTriDS, gold: mat.gold, stone: mat.stone });
  bud.position.set(...buddha.pos);
  bud.rotation.y = buddha.rotY;
  group.add(bud);

  return {
    object: group,
    update(t) {
      for (const { g, ph } of lanterns) {
        g.rotation.z = 0.006 * Math.sin(0.83 * t + ph) + 0.003 * Math.sin(1.9 * t + ph * 2.1);
        g.rotation.x = 0.005 * Math.sin(0.67 * t + ph * 1.3);
      }
      const fl = 1 + 0.05 * Math.sin(11.3 * t) + 0.03 * Math.sin(23.7 * t + 1.3) + 0.02 * Math.sin(5.1 * t + 0.4);
      lanternGlow.emissiveIntensity = 2.4 * fl;
      if (heroLight) heroLight.intensity = 3.5 * fl;
    },
  };
}
