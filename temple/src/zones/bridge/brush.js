// 程式毛筆字：以「筆毛」模型在 canvas 上寫出粗毛筆感的大字（起筆頓、轉折頓、收筆飛白）。
import { makeRng, makeNoise2D } from '../../rng.js';

// 字形：單位方格（x 右、y 下），每筆 { p: 折線, w: 筆寬, end: 'press' | 'taper' | 'hook' }
export const GLYPHS = {
  '山': [
    { p: [[0.5, 0.03], [0.505, 0.5], [0.5, 0.86]], w: 0.15, end: 'press' },
    { p: [[0.12, 0.33], [0.135, 0.6], [0.14, 0.87], [0.5, 0.865], [0.88, 0.85]], w: 0.13, end: 'press' },
    { p: [[0.87, 0.28], [0.875, 0.6], [0.875, 0.97]], w: 0.135, end: 'taper' },
  ],
  '門': [
    { p: [[0.13, 0.06], [0.135, 0.5], [0.13, 0.99]], w: 0.115, end: 'taper' },
    { p: [[0.135, 0.07], [0.42, 0.055], [0.425, 0.42]], w: 0.095, end: 'press' },
    { p: [[0.17, 0.235], [0.4, 0.225]], w: 0.06, end: 'press' },
    { p: [[0.17, 0.41], [0.4, 0.4]], w: 0.06, end: 'press' },
    { p: [[0.58, 0.06], [0.585, 0.42]], w: 0.085, end: 'press' },
    { p: [[0.585, 0.07], [0.88, 0.05], [0.885, 0.5], [0.88, 0.93], [0.79, 0.87]], w: 0.105, end: 'hook' },
    { p: [[0.62, 0.235], [0.85, 0.225]], w: 0.06, end: 'press' },
    { p: [[0.62, 0.41], [0.85, 0.4]], w: 0.06, end: 'press' },
  ],
};

/** 在折線轉角加入小圓角並加密。回傳 [{x, y, corner}]（單位方格座標）。 */
function densify(pts, step = 0.004, fillet = 0.035) {
  const P = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const f1 = Math.min(fillet, l1 * 0.4), f2 = Math.min(fillet, l2 * 0.4);
    const p1 = [b[0] + (a[0] - b[0]) * (f1 / l1), b[1] + (a[1] - b[1]) * (f1 / l1)];
    const p2 = [b[0] + (c[0] - b[0]) * (f2 / l2), b[1] + (c[1] - b[1]) * (f2 / l2)];
    // 轉角是否明顯（決定是否頓筆）
    const d1 = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1], d2 = [(c[0] - b[0]) / l2, (c[1] - b[1]) / l2];
    const sharp = d1[0] * d2[0] + d1[1] * d2[1] < 0.7;
    P.push({ q: [p1, b, p2], sharp, at: b });
  }
  P.push(pts[pts.length - 1]);
  const out = [];
  let prev = null;
  const push = (x, y, corner) => {
    if (prev && Math.hypot(x - prev.x, y - prev.y) < step * 0.5) return;
    prev = { x, y, corner };
    out.push(prev);
  };
  const seg = (a, b) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k <= n; k++) push(a[0] + (b[0] - a[0]) * (k / n), a[1] + (b[1] - a[1]) * (k / n), null);
  };
  let cur = P[0];
  for (let i = 1; i < P.length; i++) {
    const e = P[i];
    if (Array.isArray(e)) { seg(cur, e); cur = e; continue; }
    const [p1, b, p2] = e.q;
    seg(cur, p1);
    const n = 10;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const x = (1 - t) * (1 - t) * p1[0] + 2 * (1 - t) * t * b[0] + t * t * p2[0];
      const y = (1 - t) * (1 - t) * p1[1] + 2 * (1 - t) * t * b[1] + t * t * p2[1];
      push(x, y, e.sharp ? e.at : null);
    }
    cur = p2;
  }
  // 記錄每點到轉角的距離
  const corners = P.filter((e) => !Array.isArray(e) && e.sharp).map((e) => e.at);
  let acc = 0;
  for (let i = 0; i < out.length; i++) {
    if (i > 0) acc += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
    out[i].s = acc;
    out[i].cd = corners.length ? Math.min(...corners.map((c) => Math.hypot(out[i].x - c[0], out[i].y - c[1]))) : 9;
  }
  return out;
}

/**
 * 寫一個字。box = { x, y, w, h }（canvas 像素），color 墨色。
 */
export function drawGlyph(g, ch, box, seed = 'brush', color = [18, 12, 10]) {
  const strokes = GLYPHS[ch];
  const rng = makeRng(seed + ch);
  const noise = makeNoise2D(seed + ch + '-n');
  const sx = box.w, sy = box.h;
  const S = Math.min(sx, sy);
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  strokes.forEach((st, si) => {
    const pts = densify(st.p);
    const L = pts[pts.length - 1].s;
    // 每點的筆壓（寬度倍率）
    const width = pts.map((p) => {
      const t = p.s / L;
      let k = 1;
      k *= 1 + 0.32 * Math.exp(-Math.pow(p.s / 0.05, 2)); // 起筆頓
      k *= 1 + 0.22 * Math.exp(-Math.pow(p.cd / 0.04, 2)); // 轉折頓
      k *= 0.93 + 0.07 * Math.sin(t * 7.0 + si);           // 行筆起伏
      if (st.end === 'press') k *= 1 + 0.18 * Math.exp(-Math.pow((L - p.s) / 0.045, 2));
      if (st.end === 'taper') k *= Math.min(1, 0.25 + (L - p.s) / 0.16);
      if (st.end === 'hook') k *= Math.min(1, 0.18 + (L - p.s) / 0.1);
      k *= 1 + 0.06 * noise(si * 3.1, p.s * 9);              // 筆觸的不規則
      return st.w * k * 1.45;
    });
    // 法線
    const nrm = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)];
      const dx = (b.x - a.x) * sx, dy = (b.y - a.y) * sy;
      const l = Math.hypot(dx, dy) || 1;
      return [-dy / l, dx / l];
    });
    const P = (i, off) => [box.x + pts[i].x * sx + nrm[i][0] * off, box.y + pts[i].y * sy + nrm[i][1] * off];
    // 1) 墨芯：實心（前 85% 長度），起筆略帶斜切
    g.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},0.96)`;
    for (let i = 0; i < pts.length; i++) {
      const t = pts[i].s / L;
      if (t > 0.8 && st.end !== 'press') break;
      const [x, y] = P(i, 0);
      const r = width[i] * S * 0.4;
      // 起筆：斜 45° 的筆鋒（楷書的切筆）
      const entry = Math.exp(-Math.pow(pts[i].s / 0.03, 2));
      g.beginPath();
      g.ellipse(x - entry * r * 0.25, y - entry * r * 0.25, r * (1 + entry * 0.35), r * (0.9 - entry * 0.2), -Math.PI / 4, 0, Math.PI * 2);
      g.fill();
    }
    // 2) 筆毛：逐根描線，收筆處漸乾（飛白）
    const NB = 110;
    for (let b = 0; b < NB; b++) {
      const o = (b / (NB - 1)) * 2 - 1 + (rng() - 0.5) * 0.02;
      const ink = 0.75 + rng() * 0.25;
      const edge = Math.abs(o);
      const dryStart = 0.45 + rng() * 0.4 - edge * 0.25;
      const lw = (st.w * S / NB) * 2.4 * (0.7 + rng() * 0.6);
      g.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${(0.55 + 0.4 * ink).toFixed(3)})`;
      g.lineWidth = lw;
      let drawing = false;
      g.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const t = pts[i].s / L;
        const n = noise(b * 0.73, pts[i].s * 22) * 0.5 + 0.5;
        const dryness = Math.max(0, t - dryStart) * 2.4 + (edge > 0.9 ? 0.25 : 0);
        const gap = n < dryness * 0.75;
        const rough = edge > 0.8 ? noise(b * 1.7 + 50, pts[i].s * 60) * 0.06 : 0;
        const [x, y] = P(i, (o + rough) * width[i] * S * 0.5);
        if (gap) { if (drawing) { g.stroke(); g.beginPath(); drawing = false; } continue; }
        if (!drawing) { g.moveTo(x, y); drawing = true; } else g.lineTo(x, y);
      }
      if (drawing) g.stroke();
    }
    // 3) 墨暈：邊緣少量墨點滲出
    g.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},0.35)`;
    for (let k = 0; k < 40; k++) {
      const i = Math.floor(rng() * pts.length);
      const side = rng() < 0.5 ? -1 : 1;
      const [x, y] = P(i, side * width[i] * S * (0.48 + rng() * 0.08));
      g.beginPath(); g.arc(x, y, S * 0.004 * (0.5 + rng()), 0, Math.PI * 2); g.fill();
    }
  });
  g.restore();
}
