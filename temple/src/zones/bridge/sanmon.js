// 山門（二重門）：五開間、石基壇、下層朱漆柱與中央三間通道、兩側間格子、
// 上層外圍高欄緣側、上下兩層斗栱與垂木、裳屋根（下層）＋入母屋屋頂（上層，本瓦葺、起翹）、中央大提燈。
import * as THREE from 'three';
import { sanmon as S } from '../../layout.js';
import { mat, scaled } from '../../materials.js';
import { makeRng } from '../../rng.js';
import { heightAt } from '../../ground.js';
import { merge, box, rod, instanced, mesh, trs, beam } from './util.js';
import { makeRoof } from './roof.js';
import { buildChochin } from './chochin.js';

const V3 = THREE.Vector3;

/** 斗栱一組（局部：外向 +z、上 +y，原點在台輪頂、柱心）。 */
function bracketGeo({ tiers, tierH, reach, daitoH = 0.22, armW = 0.14, blk = 0.2 }) {
  const P = [];
  // 大斗：上方方塊 + 下方收分
  P.push(box(0.46, daitoH * 0.62, 0.46, 0, daitoH * 0.38 + daitoH * 0.31, 0));
  P.push(new THREE.CylinderGeometry(0.46 / Math.SQRT2, 0.34 / Math.SQRT2, daitoH * 0.38, 4, 1).rotateY(Math.PI / 4).translate(0, daitoH * 0.19, 0));
  const armH = tierH * 0.56, blkH = tierH * 0.44;
  for (let k = 0; k < tiers; k++) {
    const y = daitoH + k * tierH;
    // 壁面上的橫向肘木與巻斗
    const L = k % 2 === 0 ? 1.15 : 1.55;
    P.push(box(L, armH, armW, 0, y + armH / 2, 0));
    for (const sx of [-1, 0, 1]) P.push(box(blk, blkH, blk, sx * (L / 2 - blk * 0.45), y + armH + blkH / 2, 0));
    // 外向肘木（一手ずつ前へ）
    const zEnd = (k + 1) * reach;
    P.push(box(armW, armH, zEnd + 0.35, 0, y + armH / 2, (zEnd - 0.35) / 2));
    P.push(box(blk + 0.02, blkH, blk + 0.02, 0, y + armH + blkH / 2, zEnd - 0.06));
    // 前方的秤肘木（第二手以後）
    if (k >= 1) {
      const zz = k * reach;
      P.push(box(1.0, armH, armW, 0, y + armH / 2, zz));
      for (const sx of [-1, 1]) P.push(box(blk, blkH, blk, sx * 0.42, y + armH + blkH / 2, zz));
    }
    // 肘木木口的圓弧下端（簡化為斜切小塊）
    P.push(box(armW * 0.9, armH * 0.4, 0.1, 0, y + armH * 0.2, zEnd + 0.03));
  }
  // 尾垂木（斜材，從內側上方穿出）
  if (tiers >= 3) {
    const y0 = daitoH + tierH * 1.0, y1 = daitoH + tierH * (tiers - 0.2);
    P.push(beam([0, y1 + 0.25, -0.6], [0, y0 + 0.05, tiers * reach * 0.82], 0.16, 0.2));
  }
  return merge(P);
}

/** 間斗束（柱間的簡易斗栱）。 */
function kentoGeo(h, tierH) {
  return merge([
    box(0.16, h, 0.16, 0, h / 2, 0),
    box(0.3, tierH * 0.45, 0.3, 0, h + tierH * 0.22, 0),
  ]);
}

export function buildSanmon() {
  const root = new THREE.Group();
  root.name = 'sanmon';
  const [px, , pz] = S.pos;
  const g0 = heightAt(px, pz);
  const group = new THREE.Group();
  group.position.set(px, g0, pz);
  group.rotation.y = S.rotY;
  root.add(group);

  // ── 尺寸（全部由 layout 推導）──
  const W = S.width, Dp = S.depth, hx0 = W / 2, hz0 = Dp / 2;
  const bayW = W / S.bays;
  const colX = Array.from({ length: S.bays + 1 }, (_, i) => -hx0 + i * bayW);
  const colZ = [-hz0, 0, hz0];
  const yB = S.baseHeight;
  const y1Top = yB + S.firstStoryHeight;              // 下層簷口
  const y2Top = y1Top + S.secondStoryHeight;          // 上層簷口
  const roofTop = y2Top + S.roofHeight;               // 屋面頂（大棟底）
  const ov2 = S.eaveOverhang, ov1 = ov2 * 0.75;
  const inset = 0.8;
  const hxU = hx0 - inset, hzU = hz0 - inset;         // 上層柱列
  const bayU = (2 * hxU) / S.bays;
  const colXU = Array.from({ length: S.bays + 1 }, (_, i) => -hxU + i * bayU);
  const colTop1 = y1Top - 1.35;
  const floorY = y1Top + 1.35;
  const colTop2 = y2Top - 1.2;
  const balc = 0.95;                                    // 緣側外伸
  const hxB = hxU + balc, hzB = hzU + balc;

  // ── 材質 ──
  const verm = scaled(mat.vermilion, 1, 1);
  const vermCol = scaled(mat.vermilion, 1.9, 4.2);
  const plaster = mat.plaster;
  const stone = scaled(mat.stone, 0.5, 0.5);
  const wood = mat.wood;
  const tipMat = new THREE.MeshStandardMaterial({ color: 0xe9d9a6, roughness: 0.7, name: 'rafter-tip' });
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x4b5058, roughness: 0.55, metalness: 0.2, name: 'ridge-tile' });
  const darkInt = new THREE.MeshStandardMaterial({ color: 0x2a1e18, roughness: 0.9, name: 'dark-interior' });
  const ceilWood = scaled(mat.wood, 1, 1);
  const buckets = new Map();
  const add = (m, g) => { if (!buckets.has(m)) buckets.set(m, []); buckets.get(m).push(g); };

  // ── 石基壇 ──
  {
    const bw = W + 2.4, bd = Dp + 2.4;
    add(stone, box(bw, yB - 0.08, bd, 0, (yB - 0.08) / 2, 0));
    // 葛石（上緣的長石）
    add(stone, box(bw + 0.06, 0.1, bd + 0.06, 0, yB - 0.05, 0));
    // 正背面中央石段
    for (const s of [-1, 1]) {
      add(stone, box(3 * bayW, yB * 0.5, 0.55, 0, yB * 0.25, s * (bd / 2 + 0.27)));
    }
    // 礎石
    for (const x of colX) for (const z of colZ) {
      add(stone, new THREE.CylinderGeometry(0.42, 0.5, 0.14, 16).translate(x, yB + 0.07, z));
    }
  }

  // ── 下層柱（18 根）──
  {
    const h = colTop1 - (yB + 0.14);
    const g = new THREE.CylinderGeometry(0.28, 0.31, h, 20, 1, true);
    g.translate(0, h / 2, 0);
    const mats = [];
    for (const x of colX) for (const z of colZ) mats.push(trs(x, yB + 0.14, z));
    group.add(instanced(g, vermCol, mats, { cast: true }));
  }

  // ── 下層：頭貫・台輪・虹梁 ──
  const daito = 0.22, reach1 = 0.48, tiers1 = 2;
  const lowerRoof = makeRoof({
    hx: hx0 + ov1, hz: hz0 + ov1, eaveY: y1Top, H: floorY - 0.2 - y1Top, Dn: ov1 + inset, p: 1.15,
    lift: 0.38, liftP: 3, Dtop: ov1 + inset, wallD: ov1, t: 0.32, amp: 0.065, hipW: 0.28, hipH: 0.22,
  });
  const purlin1Top = lowerRoof.botAt(0, hz0 + ov1 - (ov1 - tiers1 * reach1), ov1 - tiers1 * reach1) - 0.265;
  const base1 = colTop1 + 0.12;
  const tierH1 = (purlin1Top - 0.17 - base1 - daito) / tiers1;
  {
    // 頭貫（外周 + 中通り）
    for (const z of colZ) add(verm, box(W + 0.6, 0.3, 0.24, 0, colTop1 - 0.15, z));
    for (const x of [-hx0, hx0]) add(verm, box(0.24, 0.3, Dp + 0.6, x, colTop1 - 0.15, 0));
    // 台輪（外周）
    for (const z of [-hz0, hz0]) add(verm, box(W + 0.9, 0.12, 0.42, 0, colTop1 + 0.06, z));
    for (const x of [-hx0, hx0]) add(verm, box(0.42, 0.12, Dp + 0.9, x, colTop1 + 0.06, 0));
  }

  // ── 下層：壁・格子・小壁・天井 ──
  {
    const wallTop = colTop1 - 0.3;
    // 妻側（東西端）白壁 + 貫
    for (const sx of [-1, 1]) {
      add(plaster, box(0.16, wallTop - yB, Dp, sx * hx0, yB + (wallTop - yB) / 2, 0));
      for (const y of [yB + 0.9, yB + 2.4]) add(verm, box(0.22, 0.2, Dp, sx * hx0, y, 0));
      add(verm, box(0.24, 0.2, Dp, sx * hx0, yB + 0.1, 0)); // 地長押
      // 通道與側間的隔壁
      const xi = sx * (hx0 - bayW);
      add(plaster, box(0.14, wallTop - yB, Dp, xi, yB + (wallTop - yB) / 2, 0));
      for (const y of [yB + 0.9, yB + 2.4]) add(verm, box(0.2, 0.2, Dp, xi, y, 0));
      add(verm, box(0.22, 0.2, Dp, xi, yB + 0.1, 0));
      // 側間中通りの奥壁（暗い木板）
      add(darkInt, box(bayW, wallTop - yB, 0.1, sx * (hx0 - bayW / 2), yB + (wallTop - yB) / 2, 0));
    }
    // 格子（正背面的兩側間）
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
      const x0 = sx > 0 ? hx0 - bayW + 0.3 : -hx0 + 0.3, x1 = x0 + bayW - 0.6;
      const z = sz * hz0;
      const yL = yB + 1.0, yT = wallTop;
      // 腰板（朱）
      add(verm, box(bayW - 0.56, yL - yB, 0.08, (x0 + x1) / 2, yB + (yL - yB) / 2, z));
      add(verm, box(bayW - 0.5, 0.12, 0.16, (x0 + x1) / 2, yL, z));       // 腰長押
      add(verm, box(bayW - 0.5, 0.12, 0.16, (x0 + x1) / 2, yT - 0.06, z)); // 上枠
      const nV = Math.round((x1 - x0) / 0.13);
      for (let k = 1; k < nV; k++) add(verm, box(0.05, yT - yL, 0.06, x0 + (x1 - x0) * (k / nV), (yL + yT) / 2, z));
      const nH = Math.round((yT - yL) / 0.32);
      for (let k = 1; k < nH; k++) add(verm, box(x1 - x0, 0.045, 0.07, (x0 + x1) / 2, yL + (yT - yL) * (k / nH), z));
    }
    // 小壁（頭貫上方的白壁帶，立於柱心線）
    const fTop = lowerRoof.botAt(0, hz0, ov1) + 0.25;
    for (const z of [-hz0, hz0]) add(plaster, box(W, fTop - (colTop1 + 0.12), 0.1, 0, (fTop + colTop1 + 0.12) / 2, z));
    for (const x of [-hx0, hx0]) add(plaster, box(0.1, fTop - (colTop1 + 0.12), Dp, x, (fTop + colTop1 + 0.12) / 2, 0));
    // 天井（格天井）與虹梁
    const ceilY = purlin1Top - 0.1;
    add(ceilWood, box(W, 0.06, Dp, 0, ceilY + 0.03, 0));
    const nX = Math.round(W / 0.5), nZ = Math.round(Dp / 0.5);
    for (let k = 1; k < nX; k++) add(darkInt, box(0.06, 0.07, Dp, -hx0 + W * (k / nX), ceilY - 0.035, 0));
    for (let k = 1; k < nZ; k++) add(darkInt, box(W, 0.07, 0.06, 0, ceilY - 0.035, -hz0 + Dp * (k / nZ)));
    for (const x of colX) add(verm, box(0.28, 0.42, Dp, x, ceilY - 0.21, 0));
    // 中通りの冠木（通道上方的橫木）
    add(verm, box(W, 0.36, 0.26, 0, colTop1 - 0.62, 0));
  }

  // ── 斗栱（下層：二手先、上層：三手先）──
  const placeBrackets = (hx, hz, xs, zs, y, geo, kgeo, kh, reach, tiers) => {
    const mats = [], kmats = [];
    const outerZs = [-hz, hz];
    for (const x of xs) for (const z of outerZs) {
      mats.push(trs(x, y, z, z > 0 ? 0 : Math.PI));
    }
    for (const z of zs) for (const x of [-hx, hx]) {
      if (Math.abs(z) < hz - 1e-6) mats.push(trs(x, y, z, x > 0 ? Math.PI / 2 : -Math.PI / 2));
      else mats.push(trs(x, y, z, x > 0 ? Math.PI / 2 : -Math.PI / 2));
    }
    // 角：對角方向（伸長）
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mats.push(trs(sx * hx, y, sz * hz, Math.atan2(sx, sz), 1, 1, Math.SQRT2));
    // 間斗束
    for (let i = 0; i < xs.length - 1; i++) for (const z of outerZs) kmats.push(trs((xs[i] + xs[i + 1]) / 2, y, z));
    for (let i = 0; i < zs.length - 1; i++) for (const x of [-hx, hx]) kmats.push(trs(x, y, (zs[i] + zs[i + 1]) / 2));
    group.add(instanced(geo, verm, mats, { cast: true }));
    group.add(instanced(kgeo, verm, kmats, { cast: false }));
    // 通肘木（壁面連續橫材）與丸桁
    for (let k = 1; k <= tiers; k++) {
      const yy = y + daito + (k - 1) * (kh) + kh * 0.28;
      if (k > 1 || true) {
        for (const z of [-hz, hz]) add(verm, box(2 * hx + 0.4, kh * 0.5, 0.14, 0, yy, z));
        for (const x of [-hx, hx]) add(verm, box(0.14, kh * 0.5, 2 * hz + 0.4, x, yy, 0));
      }
    }
    const R = reach * tiers;
    const yP = y + daito + tiers * kh + 0.085;
    for (const s of [-1, 1]) {
      add(verm, box(2 * (hx + R) + 0.4, 0.17, 0.2, 0, yP, s * (hz + R)));
      add(verm, box(0.2, 0.17, 2 * (hz + R) + 0.4, s * (hx + R), yP, 0));
    }
  };
  placeBrackets(hx0, hz0, colX, colZ, base1,
    bracketGeo({ tiers: tiers1, tierH: tierH1, reach: reach1 }), kentoGeo(daito + 0.05, tierH1), tierH1, reach1, tiers1);

  // ── 垂木（共用）──
  const addRafters = (roof) => {
    const rg = new THREE.BoxGeometry(roof.RW, roof.RH, 1).translate(0, 0, 0.5);
    group.add(instanced(rg, verm, roof.rafterMats, { cast: false }));
    const tg = new THREE.BoxGeometry(roof.RW + 0.004, roof.RH + 0.004, 1).translate(0, 0, 0.5);
    group.add(instanced(tg, tipMat, roof.tipMats, { cast: false }));
    const hb = new THREE.BoxGeometry(0.22, 0.26, 1).translate(0, 0, 0.5);
    group.add(instanced(hb, verm, roof.hipBeamMats, { cast: false }));
    // 簷口の瓦當
    const et = new THREE.CylinderGeometry(0.078, 0.078, 1, 14, 1).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    group.add(instanced(et, mat.roofTile, roof.eaveTileMats, { cast: false }));
  };
  const addRoof = (roof) => {
    const tm = mesh(roof.tiles, mat.roofTile, { cast: true, receive: true });
    group.add(tm);
    add(wood, roof.soffit);
    add(verm, roof.fascia);
    add(mat.roofTile, roof.eaveStrip);
    add(ridgeMat, roof.ridges);
    addRafters(roof);
  };
  addRoof(lowerRoof);

  // ── 上層：緣側（床）・腰組・高欄 ──
  {
    add(wood, box(2 * hxB, 0.12, 2 * hzB, 0, floorY - 0.06, 0));
    // 縁葛（床緣的朱漆框）
    for (const s of [-1, 1]) {
      add(verm, box(2 * hxB + 0.1, 0.2, 0.14, 0, floorY - 0.15, s * hzB));
      add(verm, box(0.14, 0.2, 2 * hzB + 0.1, s * hxB, floorY - 0.15, 0));
    }
    // 腰組：上層柱位的小斗栱，承托緣側
    const kTier = 0.17;
    const kg = bracketGeo({ tiers: 2, tierH: kTier, reach: balc / 2, daitoH: 0.14, armW: 0.11, blk: 0.15 });
    const kbase = floorY - 0.25 - 0.14 - 2 * kTier;
    const mats = [];
    for (const x of colXU) for (const z of [-hzU, hzU]) mats.push(trs(x, kbase, z, z > 0 ? 0 : Math.PI));
    for (const x of [-hxU, hxU]) mats.push(trs(x, kbase, 0, x > 0 ? Math.PI / 2 : -Math.PI / 2));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      mats.push(trs(sx * hxU, kbase, sz * hzU, sx > 0 ? Math.PI / 2 : -Math.PI / 2));
      mats.push(trs(sx * hxU, kbase, sz * hzU, Math.atan2(sx, sz), 1, 1, Math.SQRT2));
    }
    group.add(instanced(kg, verm, mats, { cast: false }));
    // 高欄
    const rH = 0.82;
    const rail = [];
    const runs = [
      { a: [-hxB + 0.08, hzB - 0.08], b: [hxB - 0.08, hzB - 0.08] },
      { a: [-hxB + 0.08, -hzB + 0.08], b: [hxB - 0.08, -hzB + 0.08] },
      { a: [hxB - 0.08, -hzB + 0.08], b: [hxB - 0.08, hzB - 0.08] },
      { a: [-hxB + 0.08, -hzB + 0.08], b: [-hxB + 0.08, hzB - 0.08] },
    ];
    for (const r of runs) {
      const [ax, az] = r.a, [bx, bz] = r.b;
      const len = Math.hypot(bx - ax, bz - az);
      const along = (f, y, w, h) => {
        const x = ax + (bx - ax) * f, z = az + (bz - az) * f;
        return [x, y, z];
      };
      // 地覆・平桁
      rail.push(beam(along(0, floorY + 0.06), along(1, floorY + 0.06), 0.14, 0.12));
      rail.push(beam(along(0, floorY + 0.42), along(1, floorY + 0.42), 0.08, 0.08));
      // 架木（圓）：兩端略伸出
      const ext = 0.25 / len;
      rail.push(rod(along(-ext, floorY + rH), along(1 + ext, floorY + rH), 0.04, 10));
      // 親柱與束
      const nP = Math.round(len / bayU) ;
      for (let k = 0; k <= nP; k++) {
        const [x, , z] = along(k / nP, 0);
        rail.push(box(0.13, rH + 0.08, 0.13, x, floorY + (rH + 0.08) / 2, z));
      }
      const nS = Math.round(len / 0.6);
      for (let k = 1; k < nS; k++) {
        if (k % Math.round(nS / nP) === 0) continue;
        const [x, , z] = along(k / nS, 0);
        rail.push(box(0.06, 0.3, 0.06, x, floorY + 0.12 + 0.15, z));
        rail.push(box(0.06, rH - 0.46, 0.06, x, floorY + 0.46 + (rH - 0.46) / 2, z));
        rail.push(box(0.1, 0.05, 0.1, x, floorY + rH - 0.06, z));
      }
    }
    add(verm, merge(rail));
    // 角柱頭的青銅擬寶珠（小）
    const gb = new THREE.LatheGeometry([[0, 0], [0.08, 0], [0.085, 0.03], [0.05, 0.05], [0.04, 0.07], [0.085, 0.12], [0.06, 0.2], [0.02, 0.25], [0, 0.27]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
    const gm = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) gm.push(trs(sx * (hxB - 0.08), floorY + rH + 0.08, sz * (hzB - 0.08)));
    group.add(instanced(gb, mat.bronze, gm, { cast: false }));
  }

  // ── 上層柱與壁 ──
  const daito2 = 0.22, reach2 = 0.45, tiers2 = 3;
  const hx2 = hxU + ov2, hz2 = hzU + ov2;
  const upperRoof = makeRoof({
    hx: hx2, hz: hz2, eaveY: y2Top, H: roofTop - y2Top, Dn: hz2, p: 1.35, lift: 0.55, liftP: 3,
    gableX: hx2 - 0.5 * hz2, wallD: ov2, t: 0.42, amp: 0.075,
  });
  const purlin2Top = upperRoof.botAt(0, hz2 - (ov2 - tiers2 * reach2), ov2 - tiers2 * reach2) - 0.265;
  const base2 = colTop2 + 0.1;
  const tierH2 = (purlin2Top - 0.17 - base2 - daito2) / tiers2;
  {
    const h = colTop2 - floorY;
    const g = new THREE.CylinderGeometry(0.24, 0.26, h, 18, 1, true).translate(0, h / 2, 0);
    const mats = [];
    for (const x of colXU) for (const z of [-hzU, hzU]) mats.push(trs(x, floorY, z));
    for (const x of [-hxU, hxU]) mats.push(trs(x, floorY, 0));
    group.add(instanced(g, vermCol, mats, { cast: true }));
    // 頭貫・台輪
    for (const z of [-hzU, hzU]) {
      add(verm, box(2 * hxU + 0.6, 0.26, 0.22, 0, colTop2 - 0.13, z));
      add(verm, box(2 * hxU + 0.8, 0.1, 0.38, 0, colTop2 + 0.05, z));
    }
    for (const x of [-hxU, hxU]) {
      add(verm, box(0.22, 0.26, 2 * hzU + 0.6, x, colTop2 - 0.13, 0));
      add(verm, box(0.38, 0.1, 2 * hzU + 0.8, x, colTop2 + 0.05, 0));
    }
    // 壁：白壁、中央板扉、連子窓
    const wTop = colTop2 - 0.26;
    const yL = floorY + 0.36, yU = wTop - 0.42;
    const wallRun = (axis, s, cols) => {
      for (let i = 0; i < cols.length - 1; i++) {
        const c0 = cols[i], c1 = cols[i + 1], cm = (c0 + c1) / 2, w = c1 - c0;
        const P = (u, y, d, ww, hh, dd) => axis === 'z' ? box(ww, hh, dd, u, y, s * (hzU + d)) : box(dd, hh, ww, s * (hxU + d), y, u);
        add(plaster, P(cm, (floorY + wTop) / 2, 0, w, wTop - floorY, 0.12));
        // 長押（腰・内法）
        add(verm, P(cm, yL, 0.07, w + 0.02, 0.12, 0.06));
        add(verm, P(cm, yU, 0.07, w + 0.02, 0.14, 0.06));
        const center = i === Math.floor((cols.length - 1) / 2) && (cols.length - 1) % 2 === 1;
        if (center) {
          // 板扉（雙扇）
          for (const d of [-1, 1]) {
            add(verm, P(cm + d * w * 0.22, (yL + yU) / 2, 0.075, w * 0.42, yU - yL - 0.14, 0.06));
          }
          // 飾鋲
          for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) for (const d of [-1, 1]) {
            const uu = cm + d * w * 0.22 + (c - 1.5) * w * 0.09;
            const yy = yL + 0.2 + r * (yU - yL - 0.4) / 4;
            add(mat.gold, P(uu, yy, 0.11, 0.05, 0.05, 0.02));
          }
        } else if (i % 2 === 1 || axis === 'x') {
          // 連子窓：暗色窗洞 + 縱向細格
          const ww = w * 0.62, y0 = yL + 0.3, y1 = yU - 0.15;
          add(darkInt, P(cm, (y0 + y1) / 2, 0.065, ww, y1 - y0, 0.02));
          add(verm, P(cm, y0, 0.09, ww + 0.12, 0.08, 0.05));
          add(verm, P(cm, y1, 0.09, ww + 0.12, 0.08, 0.05));
          const n = Math.round(ww / 0.11);
          for (let k = 0; k <= n; k++) add(verm, P(cm - ww / 2 + ww * (k / n), (y0 + y1) / 2, 0.085, 0.04, y1 - y0, 0.05));
        }
      }
    };
    wallRun('z', 1, colXU); wallRun('z', -1, colXU);
    wallRun('x', 1, [-hzU, 0, hzU]); wallRun('x', -1, [-hzU, 0, hzU]);
    // 上層小壁
    const fTop = upperRoof.botAt(0, hzU, ov2) + 0.3;
    for (const z of [-hzU, hzU]) add(plaster, box(2 * hxU, fTop - colTop2, 0.1, 0, (fTop + colTop2) / 2, z));
    for (const x of [-hxU, hxU]) add(plaster, box(0.1, fTop - colTop2, 2 * hzU, x, (fTop + colTop2) / 2, 0));
  }
  placeBrackets(hxU, hzU, colXU, [-hzU, 0, hzU], base2,
    bracketGeo({ tiers: tiers2, tierH: tierH2, reach: reach2, daitoH: daito2 }), kentoGeo(daito2 + 0.05, tierH2), tierH2, reach2, tiers2);
  addRoof(upperRoof);
  // 妻（山面）
  add(vermCol, upperRoof.gableInfo.boards);
  add(plaster, upperRoof.gableInfo.walls);
  add(verm, upperRoof.gableInfo.frames);
  // 懸魚（金）
  {
    const gi = upperRoof.gableInfo;
    for (const sx of [-1, 1]) {
      const x = sx * (gi.gableX + 0.1);
      const y = gi.topAt(x, 0, gi.hz) - 0.5;
      const sh = new THREE.Shape();
      sh.moveTo(0, 0.1); sh.quadraticCurveTo(0.35, 0.05, 0.3, -0.35); sh.quadraticCurveTo(0.15, -0.55, 0, -0.75);
      sh.quadraticCurveTo(-0.15, -0.55, -0.3, -0.35); sh.quadraticCurveTo(-0.35, 0.05, 0, 0.1);
      const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1, curveSegments: 8 });
      eg.rotateY(sx * Math.PI / 2);
      eg.translate(x, y, 0);
      add(mat.gold, eg);
    }
  }
  // 大棟・鬼瓦
  {
    const mr = upperRoof.mainRidge;
    const L = mr.x1 - mr.x0;
    const y0 = mr.y;
    const top = S.totalHeight;
    const capR = 0.17;
    const stackTop = top - 2 * capR + 0.02;
    const layers = 4;
    for (let k = 0; k < layers; k++) {
      const yA = y0 - 0.2 + (stackTop - (y0 - 0.2)) * (k / layers), yBb = y0 - 0.2 + (stackTop - (y0 - 0.2)) * ((k + 1) / layers);
      const w = 0.72 - k * 0.05;
      add(ridgeMat, box(L - k * 0.05, yBb - yA - 0.012, w, 0, (yA + yBb) / 2, 0));
      add(darkInt, box(L - k * 0.05 - 0.02, 0.014, w - 0.03, 0, yBb - 0.007, 0));
    }
    add(ridgeMat, rod([mr.x0, top - capR, 0], [mr.x1, top - capR, 0], capR, 14));
    // 鬼瓦
    for (const sx of [-1, 1]) {
      const sh = new THREE.Shape();
      const hw = 0.55, hh = top - (y0 - 0.35);
      sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(hw * 0.95, hh * 0.6);
      sh.quadraticCurveTo(hw * 1.15, hh * 1.0, hw * 0.55, hh * 0.98);
      sh.quadraticCurveTo(0, hh * 0.86, -hw * 0.55, hh * 0.98);
      sh.quadraticCurveTo(-hw * 1.15, hh * 1.0, -hw * 0.95, hh * 0.6);
      sh.lineTo(-hw, 0);
      const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 8 });
      eg.translate(0, 0, -0.11);
      eg.rotateY(Math.PI / 2);
      eg.translate(sx * (mr.x1 + 0.08), y0 - 0.35, 0);
      add(ridgeMat, eg);
    }
  }

  // ── 中央大提燈 ──
  const cho = buildChochin();
  root.add(cho.object);
  {
    // 吊梁：在提燈正上方，橫跨中央開間（局部座標）
    const inv = new THREE.Matrix4().makeRotationY(-S.rotY);
    const lp = new V3(S.chochin.pos[0] - px, S.chochin.pos[1] - g0, S.chochin.pos[2] - pz).applyMatrix4(inv);
    const yb = cho.hang.worldTop - g0;
    const ceilY = purlin1Top - 0.1;
    const h = Math.max(0.2, ceilY - yb - 0.42 + 0.42);
    add(verm, box(bayW + 0.3, Math.min(h, ceilY - yb), 0.26, lp.x, yb + Math.min(h, ceilY - yb) / 2, lp.z));
    // 吊鉤座金
    add(mat.bronze, new THREE.CylinderGeometry(0.07, 0.09, 0.04, 16).translate(lp.x, yb + 0.02, lp.z));
    add(mat.bronze, rod([lp.x, yb - 0.08, lp.z], [lp.x, yb + 0.02, lp.z], 0.018, 8));
  }
  // 1 盞點光源：提燈內，照亮門下的柱與天井
  const light = new THREE.PointLight(0xff8a50, 9, 18, 2);
  light.position.set(...S.chochin.pos);
  light.castShadow = false;
  root.add(light);

  // ── 合併各材質 ──
  for (const [m, geos] of buckets) {
    const big = merge(geos);
    const cast = m !== mat.gold && m !== darkInt;
    group.add(mesh(big, m, { cast, receive: true }));
  }

  return { object: root, update() {} };
}
