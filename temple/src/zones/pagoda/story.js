// 五重塔：單層（軸部 + 斗栱 + 雙層垂木 + 深簷 + 本瓦葺屋頂 + 隅棟）。
// 每層以「南面座標」建一面（s = 沿簷方向 +X，d = 離塔心的垂直距離 +Z），再繞 Y 軸轉四次。
// 屋面、軒裏與垂木都由同一組 (u, d) 函數決定，u = s / d ∈ [-1, 1]，u = ±1 即隅棟（對角線），
// 因此相鄰兩面在對角線上無縫接合；起翹 lift(u, d) 同時作用於屋面、垂木、茅負、隅木。
import * as THREE from 'three';
import { pagoda, pagodaEaveY } from '../../layout.js';
import { V3, clamp, lerp, box, boxAt, boxBetween, cylBetween, gridGeo, sweepRect, M } from './geom.js';

const TILE_PITCH = 0.3;       // 筒瓦列距（與 mat.roofTile 紋理對齊）
const TILE_LEN = 0.29;        // 每片瓦的水平長度

/** 第 k 層的尺寸與曲面函數 */
export function storyFrame(k) {
  const st = pagoda.stories[k];
  const sc = st.width / pagoda.stories[0].width;
  const bs = 0.7 + 0.3 * sc;                      // 細部比例
  const Y0 = pagodaEaveY(k) - pagoda.pos[1];      // 簷口高度（本地座標）
  const dw = st.width / 2, e = st.eave, H = dw + e;
  const inset = 0.045 * e;                        // 簷線平面上的弧（中央略內收，角部 = H）
  const oD = (u) => H - inset * (1 - u * u);
  const L = 0.65;                                 // 角部起翹量（隅木下緣正好落在 pagodaEaveCorners 的高度）
  const lift = (u, d) => {
    const t = clamp((d - dw) / (oD(u) - dw), 0, 1.12);
    return L * Math.pow(Math.min(1, Math.abs(u)), 3.2) * Math.pow(t, 1.6);
  };
  const a = k < pagoda.stories.length - 1 ? pagoda.stories[k + 1].width / 2 - 0.04 : 0.42;
  const roofTop = pagoda.roofHeight, edgeY = 0.13;
  const r0D = (u) => oD(u) + 0.08;                // 屋面外緣
  const roofV = (u, d) => clamp((r0D(u) - d) / (r0D(u) - a), 0, 1);
  const roofY = (u, d) => {
    const v = roofV(u, d);
    return Y0 + edgeY + (roofTop - edgeY) * (0.55 * v + 0.45 * v * v) + lift(u, d);
  };
  const sF = 0.2, rd = 0.13, rw = 0.1;
  const yFt = (u, d) => Y0 - 0.03 + sF * (oD(u) - d) + lift(u, d);   // 飛檐垂木上緣
  const dg0 = oD(0) - 0.42 * e;                                         // 木負位置
  const sG = 0.36;
  const yGt = (u, d) => yFt(u, dg0) - lift(u, dg0) - 0.27 + sG * (dg0 - d) + lift(u, d); // 地垂木上緣
  const dp = dw + 0.36 * e;                                             // 丸桁位置
  const pz = 0.2 * bs;                                                  // 丸桁斷面
  const pb = (u) => yGt(u, dp) - rd - pz;                               // 丸桁下緣 = 斗栱頂
  const hbD = 0.45 + 0.45 * sc;
  const yc = pb(0) - hbD;                                               // 柱頂
  const yb = k === 0 ? pagoda.baseHeight : pagodaEaveY(k - 1) - pagoda.pos[1] + pagoda.roofHeight;
  /** 給 s, d 解 u（s = u·oD(u) 這類方程），這裡直接 u = s / d */
  const uOf = (s, d) => clamp(s / d, -1, 1);
  /** 在外緣 d = f(u) 上、沿簷位置 s 的 u */
  const uOnEdge = (s, f) => { let u = s / f(0); for (let i = 0; i < 6; i++) u = s / f(u); return clamp(u, -1.05, 1.05); };
  return { k, st, sc, bs, Y0, dw, e, H, oD, L, lift, a, roofY, roofV, r0D, sF, rd, rw, yFt, dg0, sG, yGt, dp, pz, pb, yc, yb, uOf, uOnEdge };
}

// 四面旋轉：南、東、北、西
export const SIDE_ROT = [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => new THREE.Matrix4().makeRotationY(r));

/** 把「南面」幾何加入桶並旋轉四份 */
function add4(B, key, g) {
  for (const m of SIDE_ROT) B.add(key, g.clone(), m);
  g.dispose();
}

// ─────────────────────────────────────────────────────────────────────
export function buildStory(k, B) {
  const F = storyFrame(k);
  const { Y0, dw, e, H, oD, a, roofY, r0D, rd, rw, yFt, dg0, yGt, dp, pz, pb, yc, yb, bs, sc, lift, uOf, uOnEdge } = F;
  const P = (s, y, d) => new V3(s, y, d);
  const side = [];       // 收集南面幾何：[key, geo]
  const put = (key, g) => side.push([key, g]);

  // ── 屋面（瓦底）──
  {
    const nu = 44, nv = 16, rows = [], uvs = [];
    for (let i = 0; i <= nu; i++) {
      const u = -1 + (2 * i) / nu;
      const row = [], urow = [];
      for (let j = 0; j <= nv; j++) {
        const v = j / nv;
        const d = lerp(r0D(u), a, v);
        row.push(P(u * d, roofY(u, d), d));
        urow.push([(u * d) / 0.9, (r0D(0) - d) / 3.6]);
      }
      rows.push(row); uvs.push(urow);
    }
    put('tileBase', gridGeo(rows, uvs, new V3(0, 1, 0)));
  }

  // ── 筒瓦列 + 瓦當 ──
  {
    const r0 = 0.068;
    const roofP = (s, d) => P(s, roofY(uOf(s, d), d), d);
    const nPer = Math.ceil(r0D(1) / TILE_PITCH) + 1;
    for (let j = -nPer; j < nPer; j++) {
      const s = (j + 0.5) * TILE_PITCH;
      const d0 = r0D(clamp(uOnEdge(s, r0D), -1, 1));
      const dEnd = Math.max(a + 0.02, Math.abs(s) + 0.2);
      if (d0 - dEnd < 0.12) continue;
      // 取樣：每片瓦兩圈（下端寬、上端窄），形成一片片疊壓的節奏
      const ds = [];
      for (let n = 0; ; n++) {
        const dA = d0 - n * TILE_LEN, dB = dA - TILE_LEN * 0.82;
        if (dA <= dEnd) break;
        ds.push([dA, 1.0]);
        if (dB <= dEnd) break;
        ds.push([dB, 0.84]);
      }
      ds.push([dEnd, 0.9]);
      const rows = [], uvs = [];
      const segs = 5;
      let first = null;
      for (const [d, rk] of ds) {
        const c = roofP(s, d);
        const Ps = new V3().subVectors(roofP(s + 0.02, d), roofP(s - 0.02, d)).normalize();
        const Pin = new V3().subVectors(roofP(s, d - 0.02), roofP(s, d + 0.02)).normalize();
        const N = new V3().crossVectors(Ps, Pin).normalize();
        const r = r0 * rk;
        const ctr = c.clone().addScaledVector(N, r * 0.1);
        const row = [], urow = [];
        for (let q = 0; q <= segs; q++) {
          const th = (q / segs) * Math.PI;
          row.push(ctr.clone().addScaledVector(Ps, Math.cos(th) * r).addScaledVector(N, Math.sin(th) * r));
          urow.push([s / 0.9 + (q / segs - 0.5) * 0.06, (d0 - d) / 3.6]);
        }
        rows.push(row); uvs.push(urow);
        if (!first) first = { ctr, Ps, N, Pin };
      }
      if (rows.length < 2) continue;
      // 期望法線：第一圈中段點 - 中心
      const want = new V3().subVectors(rows[0][Math.floor(segs / 2)], first.ctr);
      put('tile', gridGeo(rows, uvs, want));
      // 瓦當（軒丸瓦的圓形瓦頭）：面朝外，巴紋
      const out = first.Pin.clone().negate();
      out.y *= 0.3; out.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), out);
      const rr = r0 * 1.12;
      const face = new THREE.CircleGeometry(rr, 14);
      face.applyMatrix4(new THREE.Matrix4().compose(first.ctr.clone().addScaledVector(out, 0.025), q, new V3(1, 1, 1)));
      put('tomoe', face);
      const rim = new THREE.CylinderGeometry(rr, rr, 0.05, 14, 1, true);
      rim.rotateX(Math.PI / 2);
      rim.applyMatrix4(new THREE.Matrix4().compose(first.ctr.clone(), q, new V3(1, 1, 1)));
      put('tile', rim);
    }
  }

  // ── 軒平瓦前緣條 ──
  {
    const pts = [], sides = [];
    for (let i = 0; i <= 40; i++) {
      const u = -1.03 + (2.06 * i) / 40, uu = clamp(u, -1, 1), ext = Math.max(1, Math.abs(u));
      const base = oD(uu) + 0.06;
      pts.push(P(u * base, roofY(uu, r0D(uu)) - 0.035, base * ext));
      sides.push(new V3(0, 0, 1));
    }
    put('tile', sweepRect(pts, sides, 0.12, 0.085));
  }

  // ── 隅棟（+s 角）──
  {
    const pts = [], sides = [], caps = [];
    const dOut = r0D(1) + 0.12;
    const nS = 18;
    for (let i = 0; i <= nS; i++) {
      const d = lerp(dOut, a + 0.05, i / nS);
      const dd = Math.min(d, r0D(1));
      pts.push(P(d, roofY(1, dd) + 0.1 + (d > dd ? (d - dd) * 0.9 : 0), d));
      sides.push(new V3(1, 0, -1).normalize());
    }
    put('tile', sweepRect(pts, sides, 0.3 * (0.8 + 0.2 * bs), 0.24));
    // 棟頂的冠瓦（圓）
    for (let i = 0; i < pts.length; i++) caps.push(pts[i].clone().add(new V3(0, 0.12, 0)));
    for (let i = 0; i < caps.length - 1; i++) put('tile', cylBetween(caps[i], caps[i + 1], 0.085, 0.085, 8));
    // 鬼瓦：面朝對角外（拱形頂、兩側角、巴紋圓）
    const tip = pts[0];
    const sh = new THREE.Shape();
    const ow = 0.15 * bs, oh = 0.27 * bs;
    sh.moveTo(-ow, 0); sh.lineTo(ow, 0); sh.lineTo(ow, oh * 0.55);
    sh.quadraticCurveTo(ow * 1.25, oh * 0.95, ow * 0.85, oh * 1.05);
    sh.quadraticCurveTo(ow * 0.6, oh * 0.8, ow * 0.45, oh * 0.85);
    sh.quadraticCurveTo(0, oh * 1.15, -ow * 0.45, oh * 0.85);
    sh.quadraticCurveTo(-ow * 0.6, oh * 0.8, -ow * 0.85, oh * 1.05);
    sh.quadraticCurveTo(-ow * 1.25, oh * 0.95, -ow, oh * 0.55);
    sh.lineTo(-ow, 0);
    const og = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 6 });
    og.translate(0, -oh * 0.45, -0.07);
    og.applyMatrix4(M(tip.x, tip.y, tip.z, Math.PI / 4, -0.12));
    put('tile', og);
    const od = new THREE.CircleGeometry(0.075 * bs, 14);
    od.applyMatrix4(M(tip.x + 0.02, tip.y + 0.005, tip.z + 0.02, Math.PI / 4, -0.12));
    put('tomoe', od);
  }

  // ── 茅負（簷口橫材）──
  {
    const pts = [], sides = [];
    for (let i = 0; i <= 40; i++) {
      const u = -1.025 + (2.05 * i) / 40, uu = clamp(u, -1, 1), ext = Math.max(1, Math.abs(u));
      const base = oD(uu) - 0.05;
      pts.push(P(u * base, yFt(uu, oD(uu)) + 0.08, base * ext));
      sides.push(new V3(0, 0, 1));
    }
    put('verm', sweepRect(pts, sides, 0.11, 0.16));
  }

  // ── 軒裏（飛檐板 + 地垂木板）──
  {
    const surf = (dA, dB, yfn, nv) => {
      const rows = [], uvs = [];
      for (let i = 0; i <= 40; i++) {
        const u = -1 + (2 * i) / 40;
        const row = [], urow = [];
        for (let j = 0; j <= nv; j++) {
          const d = lerp(dA(u), dB, j / nv);
          row.push(P(u * d, yfn(u, d) + 0.002, d));
          urow.push([u * d, d]);
        }
        rows.push(row); uvs.push(urow);
      }
      return gridGeo(rows, uvs, new V3(0, -1, 0));
    };
    put('board', surf((u) => oD(u) - 0.01, dg0, yFt, 5));
    put('board', surf(() => dg0 + 0.02, dw - 0.06, yGt, 6));
    // 木負：遮住兩層軒裏的落差
    const pts = [], sides = [];
    for (let i = 0; i <= 24; i++) {
      const s = lerp(-dg0 - 0.05, dg0 + 0.05, i / 24);
      const u = uOf(s, dg0);
      const yTop = yFt(u, dg0), yBot = yGt(u, dg0) - 0.03;
      pts.push(P(s, (yTop + yBot) / 2, dg0 + 0.03));
      sides.push(new V3(0, 0, 1));
    }
    const hh = yFt(0, dg0) - yGt(0, dg0) + 0.03;
    put('verm', sweepRect(pts, sides, 0.1, hh));
    // 丸桁
    const pp = [], ps = [];
    for (let i = 0; i <= 20; i++) {
      const s = lerp(-dp - 0.12, dp + 0.12, i / 20);
      const u = uOf(s, dp);
      pp.push(P(s, pb(u) + pz / 2, dp));
      ps.push(new V3(0, 0, 1));
    }
    put('verm', sweepRect(pp, ps, pz, pz));
  }

  // ── 垂木（飛檐垂木 + 地垂木），木口刷黃白 ──
  {
    const nPer = Math.ceil(H / TILE_PITCH) + 1;
    for (let j = -nPer; j < nPer; j++) {
      const s = (j + 0.5) * TILE_PITCH;
      const as = Math.abs(s);
      // 飛檐垂木
      const uo = uOnEdge(s, oD);
      const dOut = oD(clamp(uo, -1, 1)) - 0.02;
      const dIn = Math.max(dg0 + 0.02, as + 0.12);
      if (dOut - dIn > 0.1 && as < dOut - 0.1) {
        const pa = (d) => P(s, yFt(uOf(s, d), d) - rd / 2, d);
        const A = pa(dIn), Bp = pa(dOut - 0.014), C = pa(dOut);
        put('verm', boxBetween(A, Bp, rw, rd));
        put('pale', boxBetween(Bp, C, rw * 1.01, rd * 1.01));
      }
      // 地垂木
      const gOut = dg0 + 0.15, gIn = Math.max(dw - 0.06, as + 0.12);
      if (gOut - gIn > 0.1) {
        const pg = (d) => P(s, yGt(uOf(s, d), d) - rd / 2, d);
        const A = pg(gIn), Bp = pg(gOut - 0.014), C = pg(gOut);
        put('verm', boxBetween(A, Bp, rw, rd));
        put('pale', boxBetween(Bp, C, rw * 1.01, rd * 1.01));
      }
    }
    // 隅木（+s 角，沿對角線）：下緣在角尖處 = 簷角高度（風鈴吊點）
    const dTip = H + 0.12;
    const yTipTop = Y0 - 0.03 + F.L + 0.03;
    const hgt = 0.24 * (0.85 + 0.15 * bs);
    const inner = P(dw - 0.1, yGt(1, dw) - hgt / 2 + 0.04, dw - 0.1);
    const tip = P(dTip, yTipTop - hgt / 2, dTip);
    const dir = new V3().subVectors(tip, inner).normalize();
    const capStart = tip.clone().addScaledVector(dir, -0.035);
    put('verm', boxBetween(inner, capStart, 0.17 * bs + 0.03, hgt));
    put('pale', boxBetween(capStart, tip, 0.17 * bs + 0.032, hgt + 0.004));
    // 飾金具：木口周圍的金色包邊帶與中央鋲
    const bandA = tip.clone().addScaledVector(dir, -0.11), bandB = tip.clone().addScaledVector(dir, -0.06);
    put('gold', boxBetween(bandA, bandB, 0.17 * bs + 0.045, hgt + 0.018));
    const boss = new THREE.SphereGeometry(0.03, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    boss.rotateX(Math.PI / 2);
    boss.applyMatrix4(new THREE.Matrix4().compose(tip.clone().addScaledVector(dir, 0.0), new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), dir), new V3(1, 1, 1)));
    put('gold', boss);
    // 隅木先端的金色吊環座
    put('gold', boxAt(0.07, 0.03, 0.07, H, yTipTop - hgt - 0.01, H));
  }

  // ── 斗栱 ──
  {
    const lev0 = (Hb) => (Hb - 0.2 * bs) / 4;
    const module = (Mx, Hb, Pj, diag = false) => {
      const dai = 0.2 * bs, lev = lev0(Hb), ah = lev * 0.6, mh = lev - ah, aw = 0.12 * bs, blk = 0.19 * bs;
      const parts = [];
      parts.push(['verm', boxAt(0.38 * bs, dai, 0.38 * bs, 0, dai / 2, 0)]);
      for (let i = 0; i < 4; i++) {
        const y0 = dai + i * lev;
        const z = (i * Pj) / 3;
        const la = (i === 3 ? 1.05 : 0.9) * bs * (diag ? 0.8 : 1);
        // 橫向肘木與其上三個斗
        parts.push(['verm', boxAt(la, ah, aw, 0, y0 + ah / 2, z)]);
        for (const x of [-la / 2 + blk / 2, 0, la / 2 - blk / 2]) parts.push(['verm', boxAt(blk, mh, blk, x, y0 + ah + mh / 2, z)]);
        // 外挑肘木（前三段）
        if (i < 3) {
          const zt = ((i + 1) * Pj) / 3;
          parts.push(['verm', boxAt(aw, ah, zt + 0.25, 0, y0 + ah / 2, (zt - 0.25) / 2 + 0.0)]);
          parts.push(['verm', boxAt(blk, mh, blk, 0, y0 + ah + mh / 2, zt)]);
          // 肘木木口
          parts.push(['pale', boxAt(aw * 1.02, ah * 1.02, 0.012, 0, y0 + ah / 2, zt + blk / 2 + 0.0)]);
        }
      }
      // 尾垂木：由內上斜向外下，穿出第二、三段之間
      const tA = new V3(0, dai + 3.5 * lev, -0.3), tB = new V3(0, dai + 2.15 * lev, (2 * Pj) / 3 + 0.42 * bs);
      parts.push(['verm', boxBetween(tA, tB, aw * 1.15, ah * 1.15)]);
      const dirT = new V3().subVectors(tB, tA).normalize();
      parts.push(['gold', boxBetween(tB.clone().addScaledVector(dirT, -0.03), tB.clone().addScaledVector(dirT, 0.006), aw * 1.25, ah * 1.25)]);
      for (const [key, g] of parts) { g.applyMatrix4(Mx); put(key, g); }
    };
    const Pj = dp - dw;
    for (const s of [-dw, -dw / 3, dw / 3]) {
      const Hb = pb(uOf(s, dp)) - yc;
      module(M(s, yc, dw), Hb, Pj);
    }
    // 角：對角斗栱
    module(M(dw, yc, dw, Math.PI / 4), pb(1) - yc, Pj * Math.SQRT2, true);
    // 中備（間斗束）
    const Hb0 = pb(0) - yc, lev = lev0(Hb0), dai = 0.2 * bs;
    for (const s of [-2 * dw / 3, 0, 2 * dw / 3]) {
      put('verm', boxAt(0.1 * bs, dai + 2 * lev, 0.1 * bs, s, yc + (dai + 2 * lev) / 2, dw));
      put('verm', boxAt(0.19 * bs, lev * 0.4, 0.19 * bs, s, yc + dai + 2 * lev + lev * 0.2, dw));
      put('verm', boxAt(0.8 * bs, lev * 0.6, 0.12 * bs, s, yc + dai + 2.4 * lev + lev * 0.3, dw));
    }
    // 通肘木（壁面連續橫材）與支輪板
    for (const i of [1, 3]) {
      const y = yc + dai + i * lev + lev * 0.3;
      put('verm', boxAt(2 * dw + 0.2, lev * 0.6, 0.11 * bs, 0, y, dw));
    }
    for (const i of [1, 2]) {
      const y = yc + dai + i * lev + lev * 0.3;
      put('verm', boxAt(2 * (dw + (i * Pj) / 3) - 0.1, lev * 0.6, 0.11 * bs, 0, y, dw + (i * Pj) / 3));
    }
    // 白色支輪板（第二、三段之間，斜板）
    {
      const y1 = yc + dai + 2 * lev + lev * 0.6, y2 = yc + dai + 3 * lev + lev * 0.6;
      const z1 = dw + 0.06, z2 = dw + (2 * Pj) / 3 - 0.06;
      const rows = [[P(-dw, y1, z1), P(-dw - (z2 - dw) * 0.9, y2, z2)], [P(dw, y1, z1), P(dw + (z2 - dw) * 0.9, y2, z2)]];
      put('plaster', gridGeo(rows, [[[0, 0], [0, 1]], [[2 * dw, 0], [2 * dw, 1]]], new V3(0, -0.5, 1)));
      const rows2 = [[P(-dw - 0.2, yc + dai + 3 * lev + lev * 0.6, dw + 0.07), P(-dw - 0.2, pb(0) + pz + 0.02, dw + 0.07)], [P(dw + 0.2, yc + dai + 3 * lev + lev * 0.6, dw + 0.07), P(dw + 0.2, pb(0) + pz + 0.02, dw + 0.07)]];
      put('plaster', gridGeo(rows2, [[[0, 0], [0, 1]], [[2 * dw, 0], [2 * dw, 1]]], new V3(0, 0, 1)));
    }
  }

  // ── 軸部：柱、貫、長押、白壁、板門、連子窗 ──
  {
    const rc = 0.11 + 0.1 * sc;
    const colH = yc - yb;
    for (const s of [-dw, -dw / 3, dw / 3]) {
      const g = new THREE.CylinderGeometry(rc * 0.97, rc, colH, 18, 1, true);
      g.translate(s, yb + colH / 2, dw);
      put('verm', g);
    }
    const beamH = 0.2 * bs;
    put('verm', boxAt(2 * dw + 0.36, beamH, 0.16, 0, yc - beamH / 2, dw));               // 頭貫（兩端出木鼻）
    put('verm', boxAt(2 * dw, 0.16, 0.24, 0, yb + 0.08, dw));                             // 地覆
    const inner = yc - beamH - (yb + 0.16);
    const yh = yb + 0.16 + inner * 0.76;        // 內法長押
    const yk = yb + 0.16 + inner * 0.26;        // 腰長押
    put('verm', boxAt(2 * dw + 0.02, 0.12, 0.05, 0, yh + 0.06, dw + rc * 0.75));
    put('verm', boxAt(2 * dw + 0.02, 0.1, 0.05, 0, yk + 0.05, dw + rc * 0.75));
    const wz = dw - 0.01, wt = 0.1;
    const bayW = (2 * dw) / 3, clear = bayW - 2 * rc * 0.8;
    // 小壁（頭貫上方到軒裏）
    put('plaster', boxAt(2 * dw, yGt(0, dw) + 0.04 - yc, wt, 0, (yc + yGt(0, dw) + 0.04) / 2, wz - 0.02));
    // 各開間
    for (const b of [-1, 0, 1]) {
      const cx = b * bayW;
      // 上方白壁
      put('plaster', boxAt(clear, yc - beamH - (yh + 0.12), wt, cx, (yc - beamH + yh + 0.12) / 2, wz));
      if (b === 0) {
        // 板門：門框 + 雙扉 + 乳金具 + 八双
        const dW = clear, dH = yh - (yb + 0.16);
        const y0 = yb + 0.16;
        put('verm', boxAt(0.1, dH, 0.14, -dW / 2 + 0.05, y0 + dH / 2, wz + 0.02));
        put('verm', boxAt(0.1, dH, 0.14, dW / 2 - 0.05, y0 + dH / 2, wz + 0.02));
        put('verm', boxAt(dW, 0.08, 0.12, 0, yh - 0.04, wz + 0.02));
        const lw = (dW - 0.2) / 2;
        for (const sgn of [-1, 1]) {
          const lx = sgn * (lw / 2 + 0.002);
          put('door', boxAt(lw - 0.006, dH - 0.08, 0.06, lx, y0 + (dH - 0.08) / 2, wz - 0.01));
          // 橫桟（八双金具位置）
          for (const fy of [0.12, 0.5, 0.88]) {
            put('gold', boxAt(lw * 0.82, 0.035, 0.012, lx, y0 + (dH - 0.08) * fy, wz + 0.026));
            // 乳金具（饅頭鋲）
            for (let c = 0; c < 4; c++) {
              const st = new THREE.SphereGeometry(0.022 * bs, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
              st.rotateX(Math.PI / 2);
              st.translate(lx + (c - 1.5) * lw * 0.2, y0 + (dH - 0.08) * fy, wz + 0.03);
              put('gold', st);
            }
          }
          // 門環
          const ring = new THREE.TorusGeometry(0.045 * bs, 0.008, 6, 16);
          ring.translate(sgn * 0.06, y0 + dH * 0.45, wz + 0.035);
          put('gold', ring);
        }
      } else {
        // 腰壁
        put('plaster', boxAt(clear, yk - (yb + 0.16), wt, cx, (yk + yb + 0.16) / 2, wz));
        // 連子窗：框 + 菱形連子子 + 暗內部
        const wy0 = yk + 0.1, wy1 = yh, wh = wy1 - wy0;
        put('dark', boxAt(clear, wh, 0.02, cx, wy0 + wh / 2, wz - 0.06));
        put('verm', boxAt(clear, 0.07, 0.12, cx, wy0 + 0.035, wz + 0.02));
        put('verm', boxAt(clear, 0.07, 0.12, cx, wy1 - 0.035, wz + 0.02));
        put('verm', boxAt(0.07, wh, 0.12, cx - clear / 2 + 0.035, wy0 + wh / 2, wz + 0.02));
        put('verm', boxAt(0.07, wh, 0.12, cx + clear / 2 - 0.035, wy0 + wh / 2, wz + 0.02));
        const nb = Math.max(5, Math.round((clear - 0.14) / 0.1));
        for (let i = 0; i < nb; i++) {
          const x = cx - clear / 2 + 0.07 + ((i + 0.5) * (clear - 0.14)) / nb;
          put('verm', boxAt(0.042, wh - 0.14, 0.042, x, wy0 + wh / 2, wz + 0.0, Math.PI / 4));
        }
      }
    }
  }

  // 四面旋轉
  for (const [key, g] of side) add4(B, key, g);
  return F;
}
