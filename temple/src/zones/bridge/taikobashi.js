// 太鼓橋：橋面（木板）、朱漆側桁、高欄（地覆・平桁・架木・束）、親柱與青銅擬寶珠、水中橋墩、兩端石座。
import * as THREE from 'three';
import { bridge, bridgeDeckPoint, giboshiPoint, pond } from '../../layout.js';
import { mat, scaled } from '../../materials.js';
import { makeRng } from '../../rng.js';
import { heightAt } from '../../ground.js';
import { merge, box, loft, rod, instanced, mesh, beam } from './util.js';
import { giboshiGeometry, giboshiMaterial } from './giboshi.js';

const V3 = THREE.Vector3;

export function buildBridge() {
  const group = new THREE.Group();
  group.name = 'taikobashi';
  const W = bridge.width, HW = W / 2, TH = bridge.deckThickness;

  // ── 弧長表：讓取樣沿橋面等距 ──
  const NS = 4000;
  const tab = [0];
  let prev = new V3(...bridgeDeckPoint(0));
  for (let i = 1; i <= NS; i++) {
    const p = new V3(...bridgeDeckPoint(i / NS));
    tab.push(tab[i - 1] + p.distanceTo(prev));
    prev = p;
  }
  const LEN = tab[NS];
  const sAtLen = (l) => {
    l = Math.max(0, Math.min(LEN, l));
    let lo = 0, hi = NS;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tab[m] < l) lo = m; else hi = m; }
    const f = (l - tab[lo]) / Math.max(1e-9, tab[hi] - tab[lo]);
    return (lo + f) / NS;
  };
  const P = (s) => new V3(...bridgeDeckPoint(Math.max(0, Math.min(1, s))));
  /** s 處的框架：T 切線（南→北）、N 橋面法線（向上）、X 東。 */
  const frame = (s) => {
    const e = 1e-4;
    const a = P(Math.max(0, s - e)), b = P(Math.min(1, s + e));
    const T = b.sub(a).normalize();
    const X = new V3(1, 0, 0);
    const N = new V3().crossVectors(X, T).normalize();
    return { p: P(s), T, N, X };
  };

  // 沿橋取樣點（等弧長，端部較密）
  const samples = (count) => {
    const out = [];
    for (let i = 0; i <= count; i++) out.push(sAtLen((i / count) * LEN));
    return out;
  };
  const S160 = samples(180);

  /**
   * 沿橋面掃掠矩形或圓形截面構件。
   * off(s) → { x, h }：橫向位置與相對橋面頂的「垂直」偏移；截面以 (X, N) 張開。
   */
  const sweep = (ss, { x = 0, y = 0, w, h, round = 0, normalOff = false }) => {
    const secs = [];
    for (const s of ss) {
      const f = frame(s);
      const c = f.p.clone().add(new V3(x, 0, 0));
      if (normalOff) c.addScaledVector(f.N, y); else c.y += y;
      const sec = [];
      if (round) {
        for (let k = 0; k < round; k++) {
          const a = (k / round) * Math.PI * 2;
          sec.push(c.clone().addScaledVector(f.X, Math.cos(a) * w).addScaledVector(f.N, Math.sin(a) * w));
        }
      } else {
        const hw = w / 2;
        // 逆時針：(+x,+h) (−x,+h) (−x,−h) (+x,−h)，h 為向上高度
        sec.push(c.clone().addScaledVector(f.X, hw).addScaledVector(f.N, h));
        sec.push(c.clone().addScaledVector(f.X, -hw).addScaledVector(f.N, h));
        sec.push(c.clone().addScaledVector(f.X, -hw));
        sec.push(c.clone().addScaledVector(f.X, hw));
      }
      secs.push(sec);
    }
    return loft(secs);
  };

  // ── 材質 ──
  const vermRail = scaled(mat.vermilion, 1, 1);
  const deckWood = scaled(mat.wood, 1, 1);
  const darkWood = mat.wood.clone();
  darkWood.color = new THREE.Color(0x6a5446);
  darkWood.name = 'pier-wood';
  const stone = scaled(mat.stone, 0.6, 0.6);
  const blackMetal = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.5, metalness: 0.6, name: 'black-iron' });

  // ── 橋面結構板（板下的厚度）──
  const slabTop = -0.06;
  group.add(mesh(sweep(S160, { w: W - 0.24, h: TH - 0.06, y: slabTop - (TH - 0.06), normalOff: true }), darkWood));

  // ── 橋板（橫鋪木板，InstancedMesh）──
  {
    const pw = 0.22, gap = 0.012;
    const n = Math.floor(LEN / (pw + gap));
    const plank = new THREE.BoxGeometry(pw, 0.06, W - 0.3);
    // 木紋沿板長（世界 x）：把頂面 uv 轉成 v = 板長方向
    {
      const pos = plank.attributes.position, nor = plank.attributes.normal, uv = plank.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const ny = Math.abs(nor.getY(i)), nx = Math.abs(nor.getX(i));
        if (ny > 0.5) uv.setXY(i, pos.getX(i) * 1.0, pos.getZ(i));
        else if (nx > 0.5) uv.setXY(i, pos.getY(i), pos.getZ(i));
        else uv.setXY(i, pos.getX(i), pos.getY(i));
      }
      plank.rotateY(Math.PI / 2); // 長向 → x
    }
    const r = makeRng('bridge-planks');
    const mats = [], cols = [];
    for (let i = 0; i < n; i++) {
      const s = sAtLen((i + 0.5) * (pw + gap) + (LEN - n * (pw + gap)) / 2);
      const f = frame(s);
      const c = f.p.clone().addScaledVector(f.N, -0.03 + (r() - 0.5) * 0.004);
      const m = new THREE.Matrix4().makeBasis(f.X, f.N, new V3().crossVectors(f.X, f.N));
      // 讓 box 的局部 x(=板寬方向) 對齊 T：box 旋轉後長向在 x，寬向在 z
      const basis = new THREE.Matrix4().makeBasis(f.X, f.N, f.T.clone().negate());
      basis.setPosition(c);
      // 每片板偏移紋理：用縮放 ±1 翻轉製造變化
      mats.push(basis);
      const k = 0.82 + r() * 0.3;
      cols.push(new THREE.Color(k, k * (0.95 + r() * 0.06), k * (0.9 + r() * 0.1)));
    }
    // 板的局部座標：長向 x（橫跨橋寬）、厚 y、寬 z（沿橋）
    group.add(instanced(plank, deckWood, mats, { cast: false, receive: true, colors: cols }));
  }

  // ── 側桁（朱漆大梁，橋身側面）與地覆 ──
  const girderH = TH + 0.32;
  for (const side of [-1, 1]) {
    group.add(mesh(sweep(S160, { x: side * (HW - 0.07), w: 0.14, h: girderH, y: -girderH + 0.02, normalOff: true }), vermRail));
    // 桁下緣的黑色飾帶（金具風）
    group.add(mesh(sweep(S160, { x: side * (HW - 0.065), w: 0.155, h: 0.04, y: -girderH - 0.01, normalOff: true }), blackMetal, { cast: false }));
    // 地覆（欄杆最下的橫木）
    group.add(mesh(sweep(S160, { x: side * (HW - 0.1), w: 0.16, h: 0.15, y: 0.0, normalOff: true }), vermRail));
  }

  // ── 高欄 ──
  const rail = bridge.railHeight;
  const posts = bridge.postsPerSide;
  const postS = Array.from({ length: posts }, (_, i) => i / (posts - 1));
  for (const side of [-1, 1]) {
    const gx = giboshiPoint(0, side)[0];
    // 架木（頂部圓欄）
    group.add(mesh(sweep(S160, { x: gx, w: 0.048, round: 12, y: rail - 0.06 }), vermRail));
    // 平桁（中段橫木）
    group.add(mesh(sweep(S160, { x: gx, w: 0.075, h: 0.085, y: 0.46 }), vermRail));
  }
  // 束（短柱）與斗：平桁～架木、地覆～平桁
  {
    const parts = [];
    for (const side of [-1, 1]) {
      const gx = giboshiPoint(0, side)[0];
      for (let i = 0; i < posts - 1; i++) {
        const l0 = tab[Math.round(postS[i] * NS)], l1 = tab[Math.round(postS[i + 1] * NS)];
        const nT = 3;
        for (let k = 1; k <= nT; k++) {
          const s = sAtLen(l0 + (l1 - l0) * (k / (nT + 1)));
          const p = P(s);
          // 上段束 + 斗
          parts.push(box(0.065, rail - 0.06 - 0.545 - 0.06, 0.065, gx, p.y + 0.545 + (rail - 0.06 - 0.545 - 0.06) / 2, p.z));
          parts.push(box(0.1, 0.05, 0.1, gx, p.y + rail - 0.06 - 0.072, p.z));
          // 下段束
          parts.push(box(0.06, 0.31, 0.06, gx, p.y + 0.15 + 0.155, p.z));
        }
      }
    }
    group.add(mesh(merge(parts), vermRail));
  }

  // ── 親柱與擬寶珠 ──
  {
    const postParts = [], capParts = [];
    const gm = [], gmHi = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < posts; i++) {
        const [x, y, z] = giboshiPoint(i, side);
        const deckY = y - rail - 0.18;
        const top = y - 0.33;
        const bot = deckY - girderH + 0.05;
        // 柱身：略帶倒角的方柱（八角近似）
        const g = new THREE.CylinderGeometry(0.105, 0.11, top - bot, 8, 1, false);
        g.rotateY(Math.PI / 8);
        const uv = g.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 0.7, uv.getY(k) * (top - bot));
        g.translate(x, (top + bot) / 2, z);
        postParts.push(g);
        // 柱身下段：側桁外的黑色金具帶
        capParts.push(box(0.235, 0.05, 0.235, x, deckY + 0.2, z));
        // 鏡頭 6 從西側第 3 根（i=2）特寫起：附近幾顆用高精度
        (side === -1 && i >= 1 && i <= 3 ? gmHi : gm).push(new THREE.Matrix4().makeTranslation(x, y, z));
      }
    }
    group.add(mesh(merge(postParts), vermRail));
    group.add(mesh(merge(capParts), blackMetal, { cast: false }));
    const gHi = instanced(giboshiGeometry(64), giboshiMaterial(), gmHi, { cast: true, receive: true });
    gHi.name = 'giboshi-hero';
    group.add(gHi);
    const gLo = instanced(giboshiGeometry(22), giboshiMaterial(), gm, { cast: true, receive: true });
    gLo.name = 'giboshi';
    group.add(gLo);
  }

  // ── 橋下：橫向根太（看得到的梁）──
  {
    const parts = [];
    const nJ = Math.floor(LEN / 1.1);
    for (let i = 1; i < nJ; i++) {
      const s = sAtLen((i / nJ) * LEN);
      const f = frame(s);
      const c = f.p.clone().addScaledVector(f.N, -TH - 0.09);
      const g = new THREE.BoxGeometry(W - 0.3, 0.18, 0.16);
      const m = new THREE.Matrix4().makeBasis(f.X, f.N, new V3().crossVectors(f.X, f.N));
      m.setPosition(c);
      g.applyMatrix4(m);
      parts.push(g);
    }
    group.add(mesh(merge(parts), darkWood, { cast: false }));
  }

  // ── 水中橋墩（pierRows 排）──
  {
    const parts = [], capParts = [];
    const rows = bridge.pierRows;
    for (let k = 1; k <= rows; k++) {
      const s = k / (rows + 1);
      const f = frame(s);
      // 側桁下緣在此處的高度（取較低的一點）
      const under = f.p.clone().addScaledVector(f.N, -girderH - 0.02);
      const capTop = under.y - 0.0;
      const capH = 0.34;
      const z = under.z;
      // 帽梁（橫跨橋寬）
      capParts.push(beam([-HW - 0.35, capTop - capH / 2, z], [HW + 0.35, capTop - capH / 2, z], 0.36, capH, new V3(0, 0, 1)));
      // 再加一層縱向小梁托住側桁
      for (const side of [-1, 1]) capParts.push(box(0.2, 0.12, 1.2, side * (HW - 0.07), capTop + 0.0 - 0.06 + 0.06, z));
      const pileXs = [-HW + 0.25, 0, HW - 0.25];
      for (const px of pileXs) {
        const bottom = heightAt(px, z) - 0.4;
        parts.push(rod([px, bottom, z], [px, capTop - capH + 0.01, z], 0.17, 14, 0.16));
      }
      // 貫（橫向繫梁）兩道：水面上一道、水面下一道
      const y1 = pond.waterLevel + 0.55, y2 = pond.waterLevel - 0.45;
      for (const yy of [y1, y2]) {
        if (yy < capTop - capH - 0.3) capParts.push(box(W + 0.2, 0.2, 0.14, 0, yy, z));
      }
      // 斜撐（X 形）
      const yTop = Math.min(capTop - capH - 0.2, y1 + 1.6);
      if (yTop > y1 + 0.5) {
        capParts.push(beam([-HW + 0.25, y1 + 0.1, z + 0.12], [0, yTop, z + 0.12], 0.1, 0.14, new V3(0, 0, 1)));
        capParts.push(beam([HW - 0.25, y1 + 0.1, z + 0.12], [0, yTop, z + 0.12], 0.1, 0.14, new V3(0, 0, 1)));
      }
    }
    group.add(mesh(merge(parts), darkWood));
    group.add(mesh(merge(capParts), darkWood));
  }

  // ── 兩端石座 ──
  {
    const parts = [];
    for (const end of [0, 1]) {
      const sEnd = end;
      const pEnd = P(sEnd);
      const d = end === 0 ? 1 : -1; // 往陸地方向的 z 符號
      // 剖面（a = 往陸地方向的距離，負值伸向池中）
      const reach = 2.5;
      const pts = [];
      const nTop = 14;
      for (let k = 0; k <= nTop; k++) {
        const a = -reach + (reach) * (k / nTop);
        const z = pEnd.z + d * a;
        const s = Math.abs(z - pEnd.z) / bridge.span;
        const sAbs = end === 0 ? s : 1 - s;
        const f = frame(Math.max(0.0005, Math.min(0.9995, sAbs)));
        const yb = f.p.clone().addScaledVector(f.N, -girderH - 0.03).y;
        pts.push([a, Math.max(0.06, yb)]);
      }
      pts.push([0.0, 0.06]);
      const zFront = pEnd.z - d * reach;
      const yBot = Math.min(heightAt(0, zFront), 0) - 0.35;
      pts.push([0.0, -0.4]);
      pts.push([-reach, yBot]);
      const shape = new THREE.Shape(pts.map(([a, y]) => new THREE.Vector2(a, y)));
      const sw = W + 0.7;
      const eg = new THREE.ExtrudeGeometry(shape, { depth: sw, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 4 });
      // (a, y, e) → (x = e − sw/2, y, z = zEnd + d·a)
      const pos = eg.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const a = pos.getX(i), y = pos.getY(i), e = pos.getZ(i);
        pos.setXYZ(i, e - sw / 2, y, pEnd.z + d * a);
      }
      if (d === 1) {
        for (let i = 0; i < pos.count; i += 3) {
          const ax = pos.getX(i + 1), ay = pos.getY(i + 1), az = pos.getZ(i + 1);
          pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
          pos.setXYZ(i + 2, ax, ay, az);
          const uv = eg.attributes.uv;
          const u1 = uv.getX(i + 1), v1 = uv.getY(i + 1);
          uv.setXY(i + 1, uv.getX(i + 2), uv.getY(i + 2)); uv.setXY(i + 2, u1, v1);
        }
      }
      eg.computeVertexNormals();
      parts.push(eg);
      // 石段縫：薄的橫帶（石積的層次）
      for (let c = 1; c <= 3; c++) {
        const yy = 0.06 - c * 0.42;
        if (yy > yBot + 0.1) parts.push(box(sw + 0.1, 0.05, reach * 0.7, 0, yy, pEnd.z - d * reach * 0.62));
      }
      // 著地平台（延伸到參道）
      parts.push(box(W + 1.0, 0.36, 1.8, 0, 0.06 - 0.18, pEnd.z + d * 0.9));
      // 袖石（兩側立石，頂部圓潤）
      for (const side of [-1, 1]) {
        const g = new THREE.CylinderGeometry(0.26, 0.3, 0.7, 10, 1);
        g.scale(1, 1, 1.6);
        g.translate(side * (HW + 0.55), 0.06 + 0.25, pEnd.z + d * 0.55);
        parts.push(g);
        const cap = new THREE.SphereGeometry(0.26, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        cap.scale(1, 0.45, 1.6);
        cap.translate(side * (HW + 0.55), 0.06 + 0.6, pEnd.z + d * 0.55);
        parts.push(cap);
      }
    }
    group.add(mesh(merge(parts), stone));
  }

  return group;
}
