// 本瓦葺屋頂產生器：寄棟裳（下層腰屋根）與入母屋（上層）。
// 局部座標：屋頂平面中心為原點，正面朝 +Z。
// 屋面高度 = eaveY + H·(D/Dn)^p + 起翹，D = 距簷口的水平距離。
// 屋面以真實幾何做出筒瓦與平瓦的起伏（每列 1/3 m，對齊共用屋瓦紋理）。
import * as THREE from 'three';
import { gridSurface, loft, merge, alongMatrix, smooth } from './util.js';

const V3 = THREE.Vector3;
const P_TILE = 1 / 3; // 瓦列間距（共用紋理一張 3 列）

/**
 * opts:
 *  hx, hz      簷口半寬（x）與半深（z）
 *  eaveY       簷口瓦面高度
 *  H, Dn, p    屋面升高、正規化距離、凹曲指數
 *  lift, liftP 簷角起翹量與集中度
 *  gableX      入母屋：山面三角牆所在的 x（null = 四面寄棟裳）
 *  Dtop        裳屋根：屋面止於此 D（接上層牆）
 *  wallD       簷下垂木止於此 D（柱列/牆線）
 *  t           簷口厚度（瓦面到簷裏）
 *  amp         筒瓦起伏高度
 */
export function makeRoof(o) {
  const { hx, hz, eaveY, H, Dn, p, lift, liftP = 3, gableX = null, Dtop = null, wallD, t, amp = 0.07 } = o;
  const irimoya = gableX !== null;
  const Db = irimoya ? hx - gableX : null;

  const top0 = (D) => eaveY + H * Math.pow(Math.max(0, Math.min(1, D / Dn)), p);
  const liftAt = (x, z, D) => lift * Math.pow(Math.min(1, Math.abs(x) / hx), liftP) * Math.pow(Math.min(1, Math.abs(z) / hz), liftP)
    * Math.pow(1 - Math.min(1, D / Dn), 1.3);
  const planD = (x, z) => Math.min(hx - Math.abs(x), hz - Math.abs(z));
  /** 平面點 (x,z) 的瓦面基準高（不含筒瓦起伏）。D 由呼叫端給（入母屋的山面區域 D ≠ planD）。 */
  const topAt = (x, z, D) => top0(D) + liftAt(x, z, D);
  // 簷裏（軒天）：從簷口下緣直線升到牆線
  const tWall = t + 0.12;
  const botLin = (D) => {
    const a = eaveY - t, b = top0(wallD) - tWall;
    return a + (b - a) * (D / wallD);
  };
  const botAt = (x, z, D) => Math.min(botLin(D), top0(D) - 0.16) + liftAt(x, z, D);

  // 斜面弧長表（瓦紋 v 用）
  const arc = [0];
  const NA = 200, DM = Dn;
  for (let i = 1; i <= NA; i++) {
    const d0 = ((i - 1) / NA) * DM, d1 = (i / NA) * DM;
    arc.push(arc[i - 1] + Math.hypot(d1 - d0, top0(d1) - top0(d0)));
  }
  const arcAt = (D) => { const f = Math.max(0, Math.min(NA, (D / DM) * NA)); const i = Math.floor(f); return arc[Math.min(NA, i)] + (arc[Math.min(NA, i + 1)] - arc[Math.min(NA, i)]) * (f - i); };

  const tileProfile = (c) => {
    const ph = ((c / P_TILE) % 1 + 1) % 1;
    if (ph >= 0.32 && ph <= 0.68) { const q = (ph - 0.5) / 0.18; return amp * Math.sqrt(Math.max(0, 1 - q * q)); }
    const u = ((ph - 0.68 + 1) % 1) / 0.64;
    return -0.012 * Math.sin(Math.PI * u);
  };
  const tileCols = (half) => {
    const out = new Set([-half, half]);
    const phs = [0, 0.32, 0.4, 0.5, 0.6, 0.68];
    for (let k = Math.floor(-half / P_TILE) - 1; k <= Math.ceil(half / P_TILE) + 1; k++) {
      for (const ph of phs) { const c = (k + ph) * P_TILE; if (c > -half && c < half) out.add(+c.toFixed(5)); }
    }
    return [...out].sort((a, b) => a - b);
  };
  const lin = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * (i / n));

  const faces = [
    { ax: 'z', sg: 1 }, { ax: 'z', sg: -1 }, { ax: 'x', sg: 1 }, { ax: 'x', sg: -1 },
  ].map((f) => {
    const half = f.ax === 'z' ? hx : hz;
    const Dmax = irimoya ? (f.ax === 'z' ? hz : Db) : Dtop;
    const cr = (D) => (f.ax === 'z' ? (irimoya && D > Db ? gableX : hx - D) : hz - D);
    const plan = (c, D) => (f.ax === 'z' ? [c, f.sg * (hz - D)] : [f.sg * (hx - D), c]);
    return { ...f, half, Dmax, cr, plan };
  });

  const orient = (g, wantUp) => {
    // 依第一個三角形的法線決定是否翻轉
    const idx = g.index.array, pos = g.attributes.position;
    let ny = 0;
    for (let k = 0; k < Math.min(idx.length, 600); k += 3) {
      const a = new V3().fromBufferAttribute(pos, idx[k]), b = new V3().fromBufferAttribute(pos, idx[k + 1]), c = new V3().fromBufferAttribute(pos, idx[k + 2]);
      ny += b.sub(a).cross(c.sub(a)).y;
    }
    if ((ny > 0) !== wantUp) {
      for (let k = 0; k < idx.length; k += 3) { const tmp = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = tmp; }
      g.index.needsUpdate = true;
      g.computeVertexNormals();
    }
    return g;
  };

  const tiles = [], soffit = [], fascia = [], eaveStrip = [];
  const eaveTileMats = [];
  for (const f of faces) {
    const cols = tileCols(f.half);
    const nRows = Math.max(6, Math.ceil(f.Dmax / 0.2));
    const rowsD = lin(0, f.Dmax, nRows);
    // 瓦面
    tiles.push(orient(gridSurface(nRows, cols.length - 1, (i, j) => {
      const D = rowsD[i];
      const crD = f.cr(D);
      const c = Math.max(-crD, Math.min(crD, cols[j]));
      const [x, z] = f.plan(c, D);
      const fade = smooth(0.0, 0.16, crD - Math.abs(cols[j])) * (irimoya && f.ax === 'z' && D > Db ? smooth(0, 0.12, gableX - Math.abs(cols[j])) : 1);
      const y = topAt(x, z, D) + tileProfile(cols[j]) * fade;
      return [x, y, z, c, arcAt(D) * 0.3];
    }), true));
    // 簷裏
    const sc = lin(-f.half, f.half, Math.ceil(f.half * 2 / 0.5));
    const sRows = 8;
    soffit.push(orient(gridSurface(sRows, sc.length - 1, (i, j) => {
      const D = (i / sRows) * wallD;
      const crD = f.ax === 'z' ? hx - D : hz - D;
      const c = Math.max(-crD, Math.min(crD, sc[j]));
      const [x, z] = f.plan(c, D);
      return [x, botAt(x, z, D), z, c, D];
    }), false));
    // 簷口：上段軒平瓦帶（瓦色）+ 下段茅負（朱）
    const ec = lin(-f.half, f.half, Math.ceil(f.half * 2 / 0.25));
    const strip = (yTop, yBot, out = 0) => {
      const secs = [];
      // 用 loft 的開放截面：兩點（上、下）
      for (const c of ec) {
        const [x, z] = f.plan(c, 0);
        const o = f.ax === 'z' ? [0, f.sg * out] : [f.sg * out, 0];
        const yt = yTop(x, z), yb = yBot(x, z);
        secs.push([new V3(x + o[0], yt, z + o[1]), new V3(x + o[0], yb, z + o[1])]);
      }
      const g = loft(secs, { closed: false, capEnds: false });
      // 外向：法線應朝 +ax*sg
      const pos = g.attributes.position, idx = g.index.array;
      const a = new V3().fromBufferAttribute(pos, idx[0]), b = new V3().fromBufferAttribute(pos, idx[1]), cc = new V3().fromBufferAttribute(pos, idx[2]);
      const n = b.sub(a).cross(cc.sub(a));
      const outN = f.ax === 'z' ? n.z * f.sg : n.x * f.sg;
      if (outN < 0) { for (let k = 0; k < idx.length; k += 3) { const tmp = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = tmp; } g.computeVertexNormals(); }
      return g;
    };
    eaveStrip.push(strip((x, z) => topAt(x, z, 0) - 0.005, (x, z) => topAt(x, z, 0) - 0.09, 0.012));
    fascia.push(strip((x, z) => topAt(x, z, 0) - 0.09, (x, z) => botAt(x, z, 0), 0.0));
    // 軒丸瓦（圓形瓦當）位置
    for (let k = Math.ceil(-f.half / P_TILE - 0.5); (k + 0.5) * P_TILE < f.half; k++) {
      const c = (k + 0.5) * P_TILE;
      if (Math.abs(c) > f.half - 0.1) continue;
      const [x, z] = f.plan(c, 0);
      const y = topAt(x, z, 0) + amp * 0.35;
      const out = f.ax === 'z' ? new V3(0, 0, f.sg) : new V3(f.sg, 0, 0);
      const m = alongMatrix([x - out.x * 0.04, y, z - out.z * 0.04], [x + out.x * 0.035, y, z + out.z * 0.035]);
      eaveTileMats.push(m);
    }
  }

  // ── 棟（大棟・隅棟・降り棟）──
  const ridgeGeos = [];
  const ridgeAlong = (pts, w, h, sink = 0.1) => {
    const secs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const T = b.clone().sub(a).normalize();
      const side = new V3().crossVectors(T, new V3(0, 1, 0)).normalize();
      const up = new V3().crossVectors(side, T).normalize();
      if (up.y < 0) up.negate();
      const c = pts[i];
      const hw = w / 2;
      secs.push([
        c.clone().addScaledVector(side, hw).addScaledVector(up, h),
        c.clone().addScaledVector(side, -hw).addScaledVector(up, h),
        c.clone().addScaledVector(side, -hw * 1.05).addScaledVector(up, -sink),
        c.clone().addScaledVector(side, hw * 1.05).addScaledVector(up, -sink),
      ]);
    }
    // 方向一致性：以第一段決定，loft 預設外向假設截面逆時針（相對前進方向）
    const g = loft(secs);
    return g;
  };
  // 冠瓦（圓頂）
  const capAlong = (pts, r, lift0) => {
    const secs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const T = b.clone().sub(a).normalize();
      const side = new V3().crossVectors(T, new V3(0, 1, 0)).normalize();
      const up = new V3().crossVectors(side, T).normalize();
      if (up.y < 0) up.negate();
      const c = pts[i].clone().addScaledVector(up, lift0);
      const sec = [];
      for (let k = 0; k < 10; k++) {
        const ang = (k / 10) * Math.PI * 2;
        sec.push(c.clone().addScaledVector(side, Math.cos(ang) * r).addScaledVector(up, Math.sin(ang) * r));
      }
      secs.push(sec);
    }
    return loft(secs);
  };
  const ridges = [];
  // 隅棟：每個角，沿脊線 x = ±(hx − D), z = ±(hz − D)
  const DhipEnd = irimoya ? Db : Dtop;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pts = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const D = -0.06 + (DhipEnd + 0.06) * (i / n);
      const x = sx * (hx - D), z = sz * (hz - D);
      pts.push(new V3(x, topAt(x, z, Math.max(0, D)) + (D < 0 ? D * 0.6 : 0), z));
    }
    ridges.push({ pts, w: o.hipW ?? 0.32, h: o.hipH ?? 0.26 });
  }
  let mainRidge = null, gableInfo = null;
  if (irimoya) {
    // 降り棟：沿山面破風，x = ±gableX，z 從 ±(hz − Db) 到 0
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pts = [];
      const n = 20;
      for (let i = 0; i <= n; i++) {
        const D = Db + (hz - Db) * (i / n);
        const x = sx * (gableX + 0.05), z = sz * (hz - D);
        pts.push(new V3(x, topAt(x, z, D), z));
      }
      ridges.push({ pts, w: 0.3, h: 0.3 });
    }
    mainRidge = { y: top0(hz), x0: -gableX - 0.25, x1: gableX + 0.25 };
    gableInfo = { Db, gableX, top0, topAt, hz };
    // 破風板（山面兩側沿屋面邊緣的板）與妻壁（三角牆）
    const boards = [], walls = [], frames = [];
    const zr = hz - Db;
    for (const sx of [-1, 1]) {
      const pts = [];
      const n = 40;
      for (let i = 0; i <= n; i++) {
        const z = -zr - 0.15 + (2 * zr + 0.3) * (i / n);
        const D = hz - Math.abs(z);
        const x = sx * (gableX + 0.04);
        pts.push(new V3(x, topAt(x, z, Math.max(Db, D)) + 0.03, z));
      }
      boards.push(ridgeAlong(pts, 0.11, 0.0, 0.5));
      // 妻壁：x = ±(gableX − 0.3)，下緣 = 側面屋頂上緣，上緣 = 正面屋面下 0.45
      const xw = sx * (gableX - 0.3);
      const shapePts = [];
      const m = 30;
      for (let i = 0; i <= m; i++) {
        const z = -zr + 2 * zr * (i / m);
        shapePts.push([z, topAt(xw, z, Db) - 0.02]);
      }
      for (let i = m; i >= 0; i--) {
        const z = -zr + 2 * zr * (i / m);
        shapePts.push([z, topAt(xw, z, hz - Math.abs(z)) - 0.42]);
      }
      const sh = new THREE.Shape(shapePts.map(([z, y]) => new THREE.Vector2(z, y)));
      const sg = new THREE.ShapeGeometry(sh, 1);
      const pos = sg.attributes.position;
      for (let i = 0; i < pos.count; i++) { const z = pos.getX(i), y = pos.getY(i); pos.setXYZ(i, xw, y, z); }
      if (sx > 0) { const idx = sg.index.array; for (let k = 0; k < idx.length; k += 3) { const t2 = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t2; } }
      sg.computeVertexNormals();
      // uv 公尺化
      const uv = sg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getZ(i), pos.getY(i));
      walls.push(sg);
      // 妻壁的木框：下緣虹梁、中央束、兩道斜向的豕扠首
      const yb = topAt(xw, 0, Db);
      const yt = topAt(xw, 0, hz) - 0.42;
      const off = sx * 0.06;
      frames.push(new THREE.BoxGeometry(0.14, 0.28, 2 * zr).translate(xw + off, yb + 0.14, 0));
      frames.push(new THREE.BoxGeometry(0.14, yt - yb, 0.2).translate(xw + off, (yt + yb) / 2, 0));
      for (const sz of [-1, 1]) {
        const a = new V3(xw + off, yb + 0.28, sz * zr * 0.85), b = new V3(xw + off, yt - 0.1, 0);
        const len = a.distanceTo(b);
        const g = new THREE.BoxGeometry(0.12, 0.16, len);
        const mtx = new THREE.Matrix4().lookAt(a, b, new V3(0, 1, 0));
        mtx.setPosition(a.clone().add(b).multiplyScalar(0.5));
        g.applyMatrix4(mtx);
        frames.push(g);
      }
    }
    gableInfo.boards = merge(boards);
    gableInfo.walls = merge(walls);
    gableInfo.frames = merge(frames);
  }
  for (const r of ridges) {
    ridgeGeos.push(ridgeAlong(r.pts, r.w, r.h));
    ridgeGeos.push(capAlong(r.pts, r.w * 0.36, r.h));
  }

  // ── 垂木（地垂木＋飛檐垂木，角部扇垂木）──
  const rafterMats = [], tipMats = [];
  const RW = 0.1, RH = 0.12;
  const hxW = hx - wallD, hzW = hz - wallD;
  const addRafter = (pA, pB, depthOff) => {
    // pA, pB：平面點 [x, z, D]；y 取簷裏下方
    const ya = botAt(pA[0], pA[1], Math.max(0, pA[2])) - RH / 2 - depthOff;
    const yb = botAt(pB[0], pB[1], pB[2]) - RH / 2 - depthOff;
    const A = [pA[0], ya, pA[1]], B = [pB[0], yb, pB[1]];
    rafterMats.push(alongMatrix(A, B));
    const dir = new V3(B[0] - A[0], B[1] - A[1], B[2] - A[2]).normalize();
    tipMats.push(alongMatrix([A[0] - dir.x * 0.004, A[1] - dir.y * 0.004, A[2] - dir.z * 0.004], [A[0] + dir.x * 0.02, A[1] + dir.y * 0.02, A[2] + dir.z * 0.02]));
  };
  const spacing = o.rafterSpacing ?? 0.36;
  const tierSplit = 0.42; // 飛檐垂木的內端（佔 wallD 的比例）
  for (const f of faces) {
    const halfW = f.ax === 'z' ? hxW : hzW;
    const halfE = f.half;
    const n = Math.floor((2 * halfW) / spacing);
    // 直垂木
    for (let k = 0; k <= n; k++) {
      const c = -halfW + (2 * halfW) * (k / n);
      if (Math.abs(c) > halfW - 0.05) continue;
      const P = (D) => { const [x, z] = f.plan(c, D); return [x, z, D]; };
      addRafter(P(-0.07), P(wallD * tierSplit + 0.25), 0);           // 飛檐垂木
      addRafter(P(wallD * tierSplit), P(wallD), RH + 0.025);           // 地垂木
    }
    // 扇垂木：從牆角放射到簷口
    const nFan = Math.max(2, Math.round((halfE - halfW) / spacing));
    for (const sgc of [-1, 1]) {
      const [cxW, czW] = f.ax === 'z' ? [sgc * hxW, f.sg * hzW] : [f.sg * hxW, sgc * hzW];
      for (let k = 1; k < nFan; k++) {
        const c = sgc * (halfW + (halfE - halfW) * (k / nFan));
        const [ex, ez] = f.plan(c, 0);
        const at = (fr) => { const x = ex + (cxW - ex) * fr, z = ez + (czW - ez) * fr; return [x, z, Math.max(0, planD(x, z))]; };
        const ext = -0.07 / Math.hypot(cxW - ex, czW - ez);
        addRafter(at(ext), at(tierSplit + 0.1), 0);
        addRafter(at(tierSplit), at(1), RH + 0.025);
      }
    }
  }
  // 隅木（角的大斜材）
  const hipBeamMats = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const A = [sx * (hx + 0.1), botAt(sx * hx, sz * hz, 0) - 0.12, sz * (hz + 0.1)];
    const B = [sx * hxW, botAt(sx * hxW, sz * hzW, wallD) - 0.15, sz * hzW];
    hipBeamMats.push(alongMatrix(A, B));
  }

  return {
    tiles: merge(tiles), soffit: merge(soffit), fascia: merge(fascia), eaveStrip: merge(eaveStrip), ridges: merge(ridgeGeos),
    eaveTileMats, rafterMats, tipMats, hipBeamMats, RW, RH,
    mainRidge, gableInfo, top0, topAt, botAt, planD,
  };
}
