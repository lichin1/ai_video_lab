// 山門大提燈（chōchin）：竹骨橫肋、紅色和紙（程式毛筆字「山門」）、上下黑漆木框、金屬吊具。
// 世界座標直接取自 sanmon.chochin（pos = 中心、radius、height）。
import * as THREE from 'three';
import { sanmon } from '../../layout.js';
import { mat } from '../../materials.js';
import { makeRng, makeNoise2D, fbm } from '../../rng.js';
import { drawGlyph } from './brush.js';
import { merge, rod, instanced, mesh } from './util.js';

const V3 = THREE.Vector3;

function paperTexture(R, paperH) {
  const W = 6144, H = 2304;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const noise = makeNoise2D('chochin-paper');
  const rng = makeRng('chochin-paper-r');
  // 底色：朱紅和紙，帶纖維與濃淡（先在低解析度算雜訊，再放大）
  const w2 = 1536, h2 = 576;
  const lo = document.createElement('canvas');
  lo.width = w2; lo.height = h2;
  const lg = lo.getContext('2d');
  const img = lg.createImageData(w2, h2);
  for (let y = 0; y < h2; y++) {
    const v = y / h2;
    for (let x = 0; x < w2; x++) {
      const u = x / w2;
      const a = u * Math.PI * 2;
      const nx = Math.cos(a) * 2.2, nz = Math.sin(a) * 2.2;
      const blot = fbm(noise, nx + v * 3, nz + v * 2, 4);
      const fiber = noise(nx * 30 + v * 4, nz * 30 + v * 120);
      const k = 0.92 + blot * 0.07 + fiber * 0.035;
      const i = (y * w2 + x) * 4;
      img.data[i] = Math.min(255, 196 * k);
      img.data[i + 1] = Math.min(255, 32 * k + 6);
      img.data[i + 2] = Math.min(255, 24 * k + 4);
      img.data[i + 3] = 255;
    }
  }
  lg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(lo, 0, 0, W, H);
  // 細纖維：短線
  for (let k = 0; k < 16000; k++) {
    const x = rng() * W, y = rng() * H, l = 6 + rng() * 22, a = rng() * Math.PI;
    g.strokeStyle = rng() < 0.5 ? 'rgba(255,90,60,0.07)' : 'rgba(80,0,0,0.07)';
    g.lineWidth = 1 + rng();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const pxPerM_y = H / paperH;
  const pxPerM_x = W / (2 * Math.PI * R);
  // 和紙接縫（縱向，每 0.46 m）
  g.strokeStyle = 'rgba(90,10,8,0.18)';
  g.lineWidth = 3;
  for (let x = 0; x < W; x += 0.46 * pxPerM_x) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  // 上下黑色帶（漆塗りの帯）
  const band = 0.16 * pxPerM_y;
  g.fillStyle = '#140d0b';
  g.fillRect(0, 0, W, band);
  g.fillRect(0, H - band, W, band);
  g.fillStyle = 'rgba(120,20,12,0.9)';
  g.fillRect(0, band, W, 0.018 * pxPerM_y);
  g.fillRect(0, H - band - 0.018 * pxPerM_y, W, 0.018 * pxPerM_y);
  // 字：「山」「門」直書，置於正面（u = 0.5）與背面（u = 0 / 1）
  const chW = 1.18 * pxPerM_x, chH1 = 0.82 * pxPerM_y, chH2 = 0.92 * pxPerM_y;
  const yMid = H / 2;
  for (const cx of [W * 0.5, 0, W]) {
    drawGlyph(g, '山', { x: cx - chW / 2, y: yMid - 0.08 * pxPerM_y - chH1, w: chW, h: chH1 }, 'chochin-a');
    drawGlyph(g, '門', { x: cx - chW * 0.98 / 2, y: yMid + 0.02 * pxPerM_y, w: chW * 0.98, h: chH2 }, 'chochin-b');
  }
  // 竹骨：透過和紙的細暗線（與幾何肋同位置），在紙上方畫
  return { canvas: c, g, pxPerM_y };
}

export function buildChochin() {
  const { pos, radius: R, height: Htot } = sanmon.chochin;
  const group = new THREE.Group();
  group.name = 'chochin';
  group.position.set(...pos);

  const frameH = 0.2;
  const half = Htot / 2 - frameH;        // 紙面半高
  const rEnd = R * 0.85;
  const paperR = (y) => rEnd + (R - rEnd) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(y / half), 2.6)), 1 / 2.6);

  // ── 竹骨位置 ──
  const ribPitch = 0.066;
  const nRib = Math.round((2 * half) / ribPitch);
  const ribY = Array.from({ length: nRib + 1 }, (_, k) => -half + (2 * half) * (k / nRib));

  // ── 紙面輪廓：肋處外凸、肋間微凹 ──
  const prof = [];
  for (let k = 0; k < nRib; k++) {
    const y0 = ribY[k], y1 = ribY[k + 1], dy = y1 - y0;
    const steps = [0, 0.12, 0.3, 0.5, 0.7, 0.88];
    for (const f of steps) {
      const y = y0 + dy * f;
      const base = paperR(y);
      // 肋：0 附近凸 0.006；肋間凹 0.007（紙的張力）
      const d = Math.min(f, 1 - f);
      const bump = d < 0.13 ? 0.0055 * (1 - d / 0.13) : -0.0065 * Math.sin(Math.PI * (f - 0.13) / 0.74);
      prof.push(new THREE.Vector2(base + bump, y));
    }
  }
  prof.push(new THREE.Vector2(paperR(half) + 0.0055, half));
  const paperGeo = new THREE.LatheGeometry(prof, 96, Math.PI, Math.PI * 2);
  {
    const uv = paperGeo.attributes.uv, P = paperGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (P.getY(i) + half) / (2 * half));
  }
  const tex = paperTexture(R, 2 * half);
  // 竹骨陰影線
  {
    const g = tex.g, H = tex.canvas.height, W = tex.canvas.width;
    for (const y of ribY) {
      const py = H - ((y + half) / (2 * half)) * H;
      g.fillStyle = 'rgba(60,6,4,0.55)';
      g.fillRect(0, py - 3.5, W, 7);
      g.fillStyle = 'rgba(255,120,80,0.10)';
      g.fillRect(0, py + 5, W, 4);
    }
  }
  const map = new THREE.CanvasTexture(tex.canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  map.wrapS = THREE.RepeatWrapping;
  const paperMat = mat.paper.clone();
  paperMat.name = 'chochin-paper';
  paperMat.color = new THREE.Color(0xffffff);
  paperMat.map = map;
  paperMat.emissive = new THREE.Color(1.0, 0.42, 0.3);
  paperMat.emissiveMap = map;
  paperMat.emissiveIntensity = 0.55;
  paperMat.roughness = 0.82;
  paperMat.side = THREE.FrontSide;
  const paper = mesh(paperGeo, paperMat, { cast: true, receive: false });
  group.add(paper);
  // 內側（從下方開口看進去的發光內面）
  const innerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.55, 0.3), side: THREE.BackSide, name: 'chochin-inner' });
  const inner = new THREE.Mesh(new THREE.LatheGeometry(prof.filter((_, i) => i % 3 === 0).map((p) => new THREE.Vector2(p.x - 0.01, p.y)), 48, Math.PI, Math.PI * 2), innerMat);
  group.add(inner);

  // ── 上下黑漆木框 ──
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x0d0b0a, roughness: 0.25, metalness: 0.0, name: 'black-lacquer' });
  const gold = mat.gold;
  const frameParts = [], goldParts = [];
  const lathe = (pts, seg = 96) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  for (const s of [1, -1]) {
    const y0 = s * half;       // 紙面端
    const y1 = s * (half + frameH);
    const fy = (f) => y0 + (y1 - y0) * f;
    // 木框輪廓（由紙端往外）：內唇 → 下緣凸線 → 主帶 → 上緣凸線 → 頂唇 → 封口盤
    const P = [
      [rEnd - 0.02, fy(-0.05)], [rEnd + 0.02, fy(0.0)], [R * 0.93, fy(0.02)], [R * 0.935, fy(0.1)],
      [R * 0.905, fy(0.14)], [R * 0.9, fy(0.2)], [R * 0.905, fy(0.72)], [R * 0.935, fy(0.78)],
      [R * 0.94, fy(0.86)], [R * 0.915, fy(0.92)], [R * 0.88, fy(0.96)], [R * 0.84, fy(1.0)],
      [R * 0.6, fy(1.0)], [R * 0.58, fy(0.97)], [0.0, fy(0.97)],
    ];
    const pts = s > 0 ? P : P.slice().reverse();
    frameParts.push(lathe(pts));
    // 金色細線（兩條）
    for (const f of [0.17, 0.75]) {
      const t = new THREE.TorusGeometry(R * 0.905, 0.008, 6, 128);
      t.rotateX(Math.PI / 2);
      t.translate(0, fy(f), 0);
      goldParts.push(t);
    }
  }
  group.add(mesh(merge(frameParts), lacquer, { cast: true, receive: true }));
  group.add(mesh(merge(goldParts), gold, { cast: false, receive: false }));

  // 木框上的金屬飾鋲（各 24 顆）
  {
    const stud = new THREE.SphereGeometry(0.018, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    stud.rotateX(Math.PI / 2); // 朝 +z
    const mats = [];
    for (const s of [1, -1]) {
      const y = s * (half + frameH * 0.46);
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2 + 0.13;
        const r = R * 0.9;
        const m = new THREE.Matrix4().makeRotationY(a);
        m.setPosition(Math.sin(a) * r, y, Math.cos(a) * r);
        mats.push(m);
      }
    }
    group.add(instanced(stud, gold, mats, { cast: false }));
  }

  // ── 底部：金屬底盤（青銅，帶同心圓紋）──
  {
    const yb = -(half + frameH * 0.97);
    const pts = [[0.0, yb - 0.06], [0.28, yb - 0.06], [0.34, yb - 0.04], [0.36, yb - 0.01], [R * 0.6, yb - 0.005], [R * 0.6, yb + 0.01]];
    const g = lathe(pts, 64);
    group.add(mesh(g, mat.bronze, { cast: false }));
    const t = new THREE.TorusGeometry(0.31, 0.012, 6, 64); t.rotateX(Math.PI / 2); t.translate(0, yb - 0.06, 0);
    const t2 = new THREE.TorusGeometry(0.18, 0.01, 6, 48); t2.rotateX(Math.PI / 2); t2.translate(0, yb - 0.065, 0);
    group.add(mesh(merge([t, t2]), gold, { cast: false }));
  }

  // ── 吊具：四道金屬吊帶 → 中央環 → 吊鉤（往上接梁）──
  const topY = half + frameH * 0.97;
  const hang = { top: topY };
  {
    const parts = [];
    const hubY = topY + 0.1;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const r0 = R * 0.62;
      const curve = new THREE.CubicBezierCurve3(
        new V3(Math.sin(a) * r0, topY, Math.cos(a) * r0),
        new V3(Math.sin(a) * r0 * 0.7, topY + 0.07, Math.cos(a) * r0 * 0.7),
        new V3(Math.sin(a) * 0.18, hubY, Math.cos(a) * 0.18),
        new V3(Math.sin(a) * 0.07, hubY, Math.cos(a) * 0.07),
      );
      parts.push(new THREE.TubeGeometry(curve, 16, 0.016, 6, false));
      // 吊帶根部的座金
      const b = new THREE.CylinderGeometry(0.05, 0.06, 0.02, 12);
      b.translate(Math.sin(a) * r0, topY + 0.01, Math.cos(a) * r0);
      parts.push(b);
    }
    // 中央環與吊鉤
    const hub = new THREE.CylinderGeometry(0.08, 0.09, 0.05, 20); hub.translate(0, hubY, 0); parts.push(hub);
    const ring = new THREE.TorusGeometry(0.05, 0.013, 8, 24); ring.translate(0, hubY + 0.07, 0); parts.push(ring);
    hang.hookTop = hubY + 0.12;
    group.add(mesh(merge(parts), mat.bronze, { cast: false }));
  }

  // 世界座標：吊鉤頂端（山門用來接梁）
  hang.worldTop = pos[1] + hang.hookTop;
  hang.worldFrameTop = pos[1] + topY;
  return { object: group, hang };
}
