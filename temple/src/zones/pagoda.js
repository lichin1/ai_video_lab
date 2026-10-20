// 分區：五重塔（layout.pagoda）
// 石基壇 + 石階、五層軸部（朱漆柱、白壁、板門、連子窗）、三手先斗栱、雙層垂木、深簷本瓦葺、隅棟與起翹、
// 第一層高欄、相輪（露盤〜寶珠）、四條鎖、20 顆青銅風鐸（t 驅動擺動）。
// 細部模組在 ./pagoda/*.js。所有幾何依材質合併成少數幾個 Mesh。
import * as THREE from 'three';
import { pagoda } from '../layout.js';
import { mat } from '../materials.js';
import { makeRng } from '../rng.js';
import { Bucket, V3, box, boxAt, cylBetween, M } from './pagoda/geom.js';
import { buildStory, storyFrame } from './pagoda/story.js';
import { buildSorin } from './pagoda/sorin.js';
import { buildChimes } from './pagoda/chime.js';

/** 軒丸瓦瓦當的巴紋（canvas 程式繪製） */
function tomoeTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#4a5058'; g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  // 外緣
  g.strokeStyle = '#6c737c'; g.lineWidth = 7;
  g.beginPath(); g.arc(0, 0, 56, 0, Math.PI * 2); g.stroke();
  // 珠文
  g.fillStyle = '#727a84';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.beginPath(); g.arc(Math.cos(a) * 45, Math.sin(a) * 45, 3.2, 0, Math.PI * 2); g.fill();
  }
  // 三巴
  g.fillStyle = '#7a828c';
  for (let i = 0; i < 3; i++) {
    g.save();
    g.rotate((i * Math.PI * 2) / 3);
    g.beginPath();
    g.arc(0, -13, 13, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(13, -13);
    g.quadraticCurveTo(26, 8, 0, 36);
    g.quadraticCurveTo(18, 6, -13, -13);
    g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export default function build() {
  const group = new THREE.Group();
  group.name = 'pagoda';
  group.position.set(...pagoda.pos);
  group.rotation.y = pagoda.rotY;

  const B = new Bucket();

  // ── 石基壇（壇上積）──
  const bh = pagoda.baseHeight, bsz = pagoda.baseSize;
  B.add('stone', boxAt(bsz + 0.24, 0.16 * bh, bsz + 0.24, 0, 0.08 * bh, 0));          // 地覆石
  B.add('stone', boxAt(bsz - 0.06, 0.7 * bh, bsz - 0.06, 0, 0.16 * bh + 0.35 * bh, 0)); // 羽目石
  B.add('stone', boxAt(bsz, 0.14 * bh, bsz, 0, bh - 0.07 * bh, 0));                     // 葛石（外框 = baseSize）
  // 束石：羽目石上的立柱
  {
    const n = 7;
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i <= n; i++) {
        const x = -bsz / 2 + 0.2 + (i * (bsz - 0.4)) / n;
        const g = boxAt(0.24, 0.7 * bh, 0.06, x, 0.16 * bh + 0.35 * bh, bsz / 2 - 0.03 + 0.02);
        g.rotateY((s * Math.PI) / 2);
        B.add('stone', g);
      }
    }
  }
  // 基壇上面的敷石（略低於葛石邊緣的石板縫）
  {
    const r = makeRng('pagoda-paving');
    const n = 6, cell = (bsz - 0.6) / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = -bsz / 2 + 0.3 + (i + 0.5) * cell, z = -bsz / 2 + 0.3 + (j + 0.5) * cell;
      B.add('stone', boxAt(cell - 0.03, 0.02, cell - 0.03, x, bh + 0.005 + r() * 0.006, z));
    }
  }
  // ── 石階（南面中央）──
  {
    const w = 2.6, rise = bh / 4, tread = 0.34;
    for (let i = 0; i < 3; i++) {
      const top = rise * (i + 1);
      const len = (3 - i) * tread;
      B.add('stone', boxAt(w, top, len + 0.02, 0, top / 2, bsz / 2 + len / 2 - 0.01));
    }
    // 耳石（兩側斜石）
    const sh = new THREE.Shape();
    const L = 3 * tread + 0.1;
    sh.moveTo(0, 0); sh.lineTo(L, 0); sh.lineTo(L, 0.22); sh.lineTo(0.12, bh + 0.08); sh.lineTo(0, bh + 0.08); sh.lineTo(0, 0);
    const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.28, bevelEnabled: false });
    for (const sx of [-1, 1]) {
      const g = eg.clone();
      g.applyMatrix4(M(sx * (w / 2 + 0.14) + 0.14, 0, bsz / 2, -Math.PI / 2));
      // 旋轉後 shape 的 x 軸朝 +Z（往外），extrude 深度沿 +X
      B.add('stone', g);
    }
    eg.dispose();
  }

  // ── 五層 ──
  const frames = [];
  for (let k = 0; k < pagoda.stories.length; k++) frames.push(buildStory(k, B));

  // ── 第一層高欄（基壇上，南面中央開口接石階）──
  {
    const F = frames[0];
    const dR = F.dw + 0.85, y0 = bh, hR = 0.78;
    const gap = 1.35;
    const addRun = (s0, s1, d, rot) => {
      const parts = [];
      const len = s1 - s0, mid = (s0 + s1) / 2;
      parts.push(['verm', boxAt(len, 0.1, 0.12, mid, y0 + 0.05, d)]);                // 地覆
      parts.push(['verm', boxAt(len, 0.06, 0.07, mid, y0 + 0.42, d)]);               // 平桁
      parts.push(['verm', cylBetween(new V3(s0, y0 + hR, d), new V3(s1, y0 + hR, d), 0.04, 0.04, 10)]); // 架木
      const nb = Math.max(1, Math.round(len / 0.6));
      for (let i = 1; i < nb; i++) {
        const s = s0 + (i * len) / nb;
        parts.push(['verm', boxAt(0.06, 0.32, 0.06, s, y0 + 0.26, d)]);             // 束
        parts.push(['verm', boxAt(0.05, hR - 0.47, 0.05, s, y0 + 0.45 + (hR - 0.47) / 2, d)]); // 斗束
        parts.push(['verm', boxAt(0.1, 0.04, 0.08, s, y0 + hR - 0.06, d)]);
      }
      const m = new THREE.Matrix4().makeRotationY(rot);
      for (const [k, g] of parts) B.add(k, g, m);
    };
    const post = (s, d, rot) => {
      const m = new THREE.Matrix4().makeRotationY(rot);
      B.add('verm', boxAt(0.13, hR + 0.12, 0.13, s, y0 + (hR + 0.12) / 2, d), m);
      // 擬寶珠（金）
      const gb = new THREE.SphereGeometry(0.075, 14, 10);
      gb.scale(1, 1.1, 1);
      gb.translate(s, y0 + hR + 0.2, d);
      B.add('gold', gb, m);
      const tip = new THREE.ConeGeometry(0.03, 0.08, 10);
      tip.translate(s, y0 + hR + 0.3, d);
      B.add('gold', tip, m);
      const neck = new THREE.CylinderGeometry(0.05, 0.07, 0.06, 14);
      neck.translate(s, y0 + hR + 0.12, d);
      B.add('gold', neck, m);
    };
    for (let sd = 0; sd < 4; sd++) {
      const rot = (sd * Math.PI) / 2;
      if (sd === 0) {
        addRun(-dR, -gap, dR, rot); addRun(gap, dR, dR, rot);
        post(-gap, dR, rot); post(gap, dR, rot);
      } else addRun(-dR, dR, dR, rot);
      post(-dR, dR, rot);
    }
    // 緣（木板廊）：基壇上、柱外到高欄
    const ring = [];
    for (let sd = 0; sd < 4; sd++) {
      const g = boxAt(2 * dR, 0.06, dR - F.dw + 0.1, 0, y0 + 0.03 - 0.0, (dR + F.dw) / 2 - 0.05);
      ring.push(g);
      B.add('wood', g, new THREE.Matrix4().makeRotationY((sd * Math.PI) / 2));
    }
    // 南面木階（緣到石階）
    B.add('wood', boxAt(2 * gap - 0.1, 0.06, 0.4, 0, y0 + 0.03, dR + 0.15));
  }

  // ── 相輪 ──
  buildSorin(B);

  // ── 材質 ──
  const materials = {
    verm: mat.vermilion,
    door: (() => { const m = mat.vermilion.clone(); m.color = new THREE.Color(0.72, 0.6, 0.58); return m; })(),
    plaster: mat.plaster,
    board: (() => { const m = mat.plaster.clone(); m.color = new THREE.Color(0.92, 0.9, 0.86); return m; })(),
    pale: (() => { const m = mat.plaster.clone(); m.color = new THREE.Color(1.0, 0.86, 0.52); return m; })(),
    tileBase: mat.roofTile,
    tile: mat.roofTile,
    tomoe: new THREE.MeshStandardMaterial({ name: 'pagoda-tomoe', map: tomoeTexture(), roughness: 0.6, metalness: 0.15 }),
    stone: mat.stone,
    wood: mat.wood,
    dark: new THREE.MeshStandardMaterial({ name: 'pagoda-dark', color: 0x140c08, roughness: 1 }),
    gold: mat.gold,
    bronze: mat.bronze,
  };
  const meshes = B.build(materials, new Set(['verm', 'plaster', 'tileBase', 'stone', 'board', 'bronze', 'door']));
  for (const m of meshes) group.add(m);

  // ── 風鐸 ──
  const chimes = buildChimes(group);

  return {
    object: group,
    update(t) { chimes.update(t); },
  };
}
