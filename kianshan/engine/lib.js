// Hand-drawn SVG toolkit: sketchy geometry, draw-on strokes, reusable props.
// Every drawing function returns an SVG string. Objects are painted back to
// front and each one carries an opaque fill under its ink, so whatever is in
// front always hides what is behind it.

const W = 1920, H = 1080;
const PAPER = '#f4ecdc';
const INK = '#3a2f26';
const INK2 = '#6b5b4b';
const C = {
  sky: '#dfe9ea', skin: '#f5e1cb', hair: '#4a3b30', red: '#d98b7f', blood: '#c8554b',
  green: '#b9cf9a', green2: '#9fbb82', leaf: '#a9c48d', water: '#bcd6d9', roof: '#d9a58a',
  wall: '#f8f2e6', wall2: '#efe4cf', gold: '#e8c77b', vest: '#f0b35e', blue: '#9dbbd6',
  magpie: '#5c86b8', sun: '#f3cf86', pink: '#eab3a8', gray: '#cfc6b8', brown: '#b99b7b',
};

// ---------- clock & easing ----------
const CUR = { t: 0, T: 0, frame: 0 };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => (k = clamp(k), k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const eout = k => (k = clamp(k), 1 - Math.pow(1 - k, 3));
const prog = (t0, dur) => clamp((CUR.t - t0) / dur);   // reveal progress in scene time
const sub = (p, a, b) => clamp((p - a) / (b - a));     // slice of a progress value
const r1 = v => Math.round(v * 10) / 10;

// ---------- deterministic noise ----------
function hsh(...a) {
  let h = 2166136261;
  for (const v of a) { h ^= Math.floor(v * 97 + 13); h = Math.imul(h, 16777619); h ^= h >>> 13; }
  return ((h >>> 0) % 100000) / 100000;
}
const jit = (a, b, k, amt) => (hsh(a, b, k) - 0.5) * 2 * amt;

// ---------- sketchy geometry ----------
// A slightly bowed line, the way a pen drifts between two points.
function sl(x1, y1, x2, y2, a = 1.6) {
  const mx = (x1 + x2) / 2 + jit(x1, y2, 1, a), my = (y1 + y2) / 2 + jit(x2, y1, 2, a);
  return `M${r1(x1)} ${r1(y1)}Q${r1(mx)} ${r1(my)} ${r1(x2)} ${r1(y2)}`;
}
// Polyline made of gently wobbling segments; close=true returns to start with a small overshoot.
function poly(pts, close = false, a = 1.4) {
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  const seq = close ? [...pts.slice(1), pts[0]] : pts.slice(1);
  let prev = pts[0];
  for (const p of seq) {
    const mx = (prev[0] + p[0]) / 2 + jit(p[0], prev[1], 3, a), my = (prev[1] + p[1]) / 2 + jit(prev[0], p[1], 4, a);
    d += `Q${r1(mx)} ${r1(my)} ${r1(p[0])} ${r1(p[1])}`;
    prev = p;
  }
  if (close) { const q = pts[1]; d += `L${r1(lerp(pts[0][0], q[0], 0.06))} ${r1(lerp(pts[0][1], q[1], 0.06))}`; }
  return d;
}
// Smooth curve through points (Catmull-Rom → cubic Bézier).
function curve(pts, close = false) {
  const P = close ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M${r1(P[1][0])} ${r1(P[1][1])}`;
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return close ? d + 'Z' : d;
}
// Imperfect ellipse whose end overlaps its start, like a hand-drawn circle.
function ell(cx, cy, rx, ry, n = 20, a = 0.05, over = 0.12) {
  const pts = [];
  const s = hsh(cx, cy, rx) * Math.PI * 2;
  for (let i = 0; i <= n; i++) {
    const th = s + (i / n) * Math.PI * 2 * (1 + over);
    const k = 1 + jit(cx + i, cy, rx + i, a);
    pts.push([cx + Math.cos(th) * rx * k, cy + Math.sin(th) * ry * k]);
  }
  return curve(pts);
}
function circ(cx, cy, r, n) { return ell(cx, cy, r, r, n || Math.max(12, Math.min(28, r / 2))); }
function rect(x, y, w, h, a = 1.4) { return poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, a); }
function rrect(x, y, w, h, r) {
  return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
}

// ---------- ink primitives ----------
function ink(d, p = 1, w = 3, col = INK, extra = '') {
  if (p <= 0.001) return '';
  const dash = p >= 0.999 ? '' : ` pathLength="1" stroke-dasharray="1 2" stroke-dashoffset="${(1 - p).toFixed(4)}"`;
  return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${dash} ${extra}/>`;
}
function wash(d, p = 1, col = PAPER, op = 1) {
  const o = eout(sub(p, 0.15, 0.75)) * op;
  if (o <= 0.001) return '';
  return `<path d="${d}" fill="${col}" fill-opacity="${o.toFixed(3)}" stroke="none"/>`;
}
// Opaque body + outline: the core building block for occlusion.
function shape(d, p = 1, fill = PAPER, w = 3, col = INK) { return wash(d, p, fill) + ink(d, p, w, col); }
// Outlined tube (limbs, poles, tree trunks): dark wide stroke with a lighter core.
function tube(d, p, fill, w = 12, col = INK) {
  if (p <= 0.001) return '';
  return ink(d, p, w + 5, col) + ink(d, p, w, fill);
}
function g(content, tf = '', extra = '') { return `<g${tf ? ` transform="${tf}"` : ''} ${extra}>${content}</g>`; }
function at(x, y, s, content, rot = 0) { return g(content, `translate(${r1(x)} ${r1(y)})${rot ? ` rotate(${rot.toFixed(2)})` : ''}${s !== 1 ? ` scale(${s})` : ''}`); }
function op(o, content) { return o <= 0.001 ? '' : (o >= 0.999 ? content : `<g opacity="${o.toFixed(3)}">${content}</g>`); }

// Text that writes on from left to right (clip reveal) with a soft pen tip.
let _clipId = 0;
function txt(x, y, s, p, o = {}) {
  if (p <= 0.001) return '';
  const size = o.size || 40, anchor = o.anchor || 'middle', fam = o.font || "'Noto Serif CJK TC', serif";
  const col = o.col || INK, wgt = o.weight || 700, style = o.italic ? 'font-style="italic"' : '';
  const width = o.width || s.length * size * (o.latin ? 0.55 : 1.02);
  const x0 = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const id = `c${_clipId++}`;
  const clip = p >= 0.999 ? '' : `<clipPath id="${id}"><rect x="${x0 - 10}" y="${y - size * 1.2}" width="${(width + 20) * ease(p)}" height="${size * 1.7}"/></clipPath>`;
  const ls = o.spacing ? ` letter-spacing="${o.spacing}"` : '';
  const stroke = o.halo ? ` stroke="${o.halo}" stroke-width="${o.haloW || 8}" paint-order="stroke" stroke-linejoin="round"` : '';
  return `${clip}<text x="${x}" y="${y}" font-family="${fam}" font-size="${size}" font-weight="${wgt}" fill="${col}" text-anchor="${anchor}" ${style}${ls}${stroke}${p >= 0.999 ? '' : ` clip-path="url(#${id})"`}>${s}</text>`;
}

// ---------- sky & weather ----------
function sun(x, y, r, p) {
  const T = CUR.T;
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + T * 0.08;
    const r0 = r + 14, r2 = r + 34 + 8 * Math.sin(T * 1.5 + i);
    rays += ink(sl(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r2, y + Math.sin(a) * r2, 0.8), sub(p, 0.4 + i * 0.03, 0.8 + i * 0.015), 2.5, INK2);
  }
  return wash(circ(x, y, r), p, C.sun) + ink(circ(x, y, r), p, 3) + rays;
}
// Clouds drift continuously and wrap around the given span.
function cloud(x, y, s, p, speed = 8, span = [-400, 2400]) {
  const w = span[1] - span[0];
  const cx = span[0] + (((x - span[0] + CUR.T * speed) % w) + w) % w;
  const bumps = [[-60, 0, 42], [-20, -22, 50], [30, -14, 44], [66, 4, 34], [0, 10, 40]];
  let fill = '', line = '';
  const outline = curve([[-100, 22], [-104, -8], [-70, -34], [-34, -58], [12, -60], [50, -44], [84, -24], [104, 6], [96, 26], [40, 30], [-40, 30]], true);
  fill = wash(outline, p, '#fbf7ef');
  line = ink(outline, p, 2.6, INK2);
  return at(cx, y + Math.sin(CUR.T * 0.4 + x) * 3, s, fill + line);
}
// A bird: 'magpie' (Taiwan blue magpie, long tail) or small generic bird.
function bird(x, y, s, flap, kind = 'small', dir = 1) {
  const f = Math.sin(flap);
  const wy = -18 * f, wx = 4;
  let out = '';
  if (kind === 'magpie') {
    const tail = `M-8 2Q-60 ${10 + 4 * f} -110 ${6 + 6 * f}`;
    out += ink(tail, 1, 7, INK) + ink(tail, 1, 3.5, C.magpie);
    out += ink(`M-100 ${5 + 6 * f}l-10 -3M-100 ${5 + 6 * f}l-9 5`, 1, 2, INK);
    out += shape(ell(0, 0, 22, 10, 14), 1, C.magpie, 2.5);
    out += shape(circ(22, -6, 8, 12), 1, '#3b3b44', 2.5);
    out += ink(`M29 -6L40 -3L29 -1`, 1, 2.5, C.blood);
    out += shape(`M-6 -4Q${wx} ${wy - 10} 18 ${wy - 22}Q10 -6 8 -2Z`, 1, '#7ea0c8', 2.2);
  } else {
    out += ink(`M-16 ${wy}Q-8 ${wy * 0.3 - 4} 0 0Q8 ${wy * 0.3 - 4} 16 ${wy}`, 1, 3, INK);
  }
  return at(x, y, s * dir, out);
}
// A flock or single bird crossing the frame over time.
function flyBy(t0, dur, y0, y1, kind, s = 1, dir = 1, x0 = -150, x1 = 2100) {
  const k = (CUR.t - t0) / dur;
  if (k < 0 || k > 1) return '';
  const x = dir > 0 ? lerp(x0, x1, k) : lerp(x1, x0, k);
  const y = lerp(y0, y1, k) + Math.sin(k * 12) * 10;
  return bird(x, y, s, CUR.T * (kind === 'magpie' ? 9 : 14), kind, dir);
}
function rain(x0, x1, y0, y1, density = 1, seed = 1) {
  let out = '';
  const n = Math.floor(90 * density);
  for (let i = 0; i < n; i++) {
    const sx = x0 + hsh(i, seed, 1) * (x1 - x0);
    const sp = 900 + hsh(i, seed, 2) * 300;
    const len = 26 + hsh(i, seed, 3) * 18;
    const yy = y0 + (((hsh(i, seed, 4) * (y1 - y0) + CUR.T * sp) % (y1 - y0)) + (y1 - y0)) % (y1 - y0);
    out += `<path d="M${r1(sx - yy * 0.12)} ${r1(yy)}l-4 ${r1(len)}" stroke="${INK2}" stroke-width="2" stroke-linecap="round" opacity="0.55"/>`;
  }
  return out;
}
function ripples(x, y, w, seed = 1, n = 6) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const per = 1.1 + hsh(i, seed) * 0.8;
    const k = ((CUR.T + hsh(seed, i) * 5) % per) / per;
    const cx = x + (hsh(i, seed, 7) - 0.5) * w;
    out += op(1 - k, ink(ell(cx, y + (hsh(i, seed, 9) - 0.5) * 16, 6 + k * 34, 2 + k * 8, 14, 0.02, 0), 1, 2, INK2));
  }
  return out;
}
// Rising wisps: steam from tea, smoke from a chimney.
function steam(x, y, s = 1, n = 3) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const k = ((CUR.T * 0.45 + i / n) % 1);
    const yy = -k * 80, xx = (i - (n - 1) / 2) * 10;
    const d = `M${xx} ${yy}q${6 + 4 * Math.sin(CUR.T * 2 + i)} -12 0 -24q-6 -12 0 -24`;
    out += op(Math.sin(k * Math.PI) * 0.85, ink(d, 1, 2.4, INK2));
  }
  return at(x, y, s, out);
}
function smoke(x, y, s = 1) {
  let out = '';
  for (let i = 0; i < 5; i++) {
    const k = ((CUR.T * 0.18 + i / 5) % 1);
    const r = 10 + k * 26;
    out += op(Math.sin(k * Math.PI) * 0.8, shape(circ(Math.sin(k * 5 + i) * 10 + k * 40, -k * 170, r, 14), 1, '#f7f2e8', 2, INK2));
  }
  return at(x, y, s, out);
}
function heartPath(s = 1) {
  return `M0 ${8 * s}C${-4 * s} ${2 * s} ${-18 * s} ${-2 * s} ${-18 * s} ${-12 * s}C${-18 * s} ${-22 * s} ${-6 * s} ${-26 * s} 0 ${-16 * s}C${6 * s} ${-26 * s} ${18 * s} ${-22 * s} ${18 * s} ${-12 * s}C${18 * s} ${-2 * s} ${4 * s} ${2 * s} 0 ${8 * s}Z`;
}
function heart(x, y, s, p, col = C.red) { return at(x, y, s * (0.6 + 0.4 * eout(p)), shape(heartPath(1), p, col, 2.6)); }
// Hearts floating upward in a loop.
function hearts(x, y, t0, n = 5, spread = 80, col = C.red) {
  if (CUR.t < t0) return '';
  let out = '';
  for (let i = 0; i < n; i++) {
    const k = ((CUR.t - t0) * 0.25 + i / n) % 1;
    if (CUR.t - t0 < i / n / 0.25) continue;
    out += op(Math.sin(k * Math.PI), heart(x + Math.sin(k * 6 + i * 2) * spread * 0.3 + (hsh(i, x) - 0.5) * spread, y - k * 180, 0.9 + hsh(i, y) * 0.6, 1, col));
  }
  return out;
}
function sparkle(x, y, s, p) {
  const k = 0.7 + 0.3 * Math.sin(CUR.T * 5 + x);
  return op(p, at(x, y, s * k, ink('M0 -14V14M-14 0H14M-7 -7L7 7M7 -7L-7 7', 1, 2.4, INK2)));
}

// ---------- landscape ----------
function ridge(pts, p, fill, w = 3, bottom = 1200) {
  const d = curve(pts);
  const area = d + `L${pts[pts.length - 1][0]} ${bottom}L${pts[0][0]} ${bottom}Z`;
  return wash(area, p, fill) + ink(d, p, w, INK);
}
// Guanyin Mountain silhouette (Dashe) used across scenes.
function guanyinMountain(x, y, s, p, fill = '#dfe3cf') {
  const pts = [[-700, 120], [-520, 40], [-380, -40], [-260, -110], [-150, -170], [-60, -200], [30, -185], [120, -150], [230, -170], [340, -120], [480, -40], [620, 30], [760, 110]];
  let hatch = '';
  for (let i = 0; i < 9; i++) {
    const hx = -400 + i * 90;
    hatch += ink(sl(hx, -60 + Math.abs(hx) * 0.18, hx + 26, 10 + Math.abs(hx) * 0.1, 2), sub(p, 0.5 + i * 0.04, 0.9), 1.8, INK2);
  }
  return at(x, y, s, ridge(pts, p, fill, 3.2, 400) + hatch);
}
function hills(y, p, fill, seed = 1, amp = 40, x0 = -300, x1 = 2300) {
  const pts = [];
  for (let x = x0; x <= x1; x += 160) pts.push([x, y + Math.sin(x * 0.004 + seed) * amp + jit(x, seed, 5, amp * 0.4)]);
  return ridge(pts, p, fill, 3, 1400);
}
function ground(y, p, fill = '#ece3cc', x0 = -400, x1 = 2400) {
  return wash(`M${x0} ${y}H${x1}V1500H${x0}Z`, p, fill) + ink(sl(x0, y, x1, y, 3), p, 3);
}
// River with drifting wave strokes.
function river(pts, width, p) {
  const top = pts, bot = pts.map(([x, y]) => [x, y + width]);
  const area = curve(top) + 'L' + [...bot].reverse().map(q => `${q[0]} ${q[1]}`).join('L') + 'Z';
  let waves = '';
  for (let i = 0; i < 16; i++) {
    const k = ((i / 16 + CUR.T * 0.03) % 1);
    const idx = k * (pts.length - 1), j = Math.floor(idx), f = idx - j;
    const a = pts[j], b = pts[Math.min(j + 1, pts.length - 1)];
    const x = lerp(a[0], b[0], f), y = lerp(a[1], b[1], f) + width * (0.3 + 0.4 * hsh(i));
    waves += ink(`M${r1(x - 18)} ${r1(y)}q9 -7 18 0t18 0`, sub(p, 0.6, 1), 2, INK2);
  }
  return wash(area, p, C.water) + ink(curve(top), p, 3) + ink(curve(bot), p, 3) + waves;
}
// Rice paddy: rows of seedlings that sway in the breeze.
function paddy(x, y, w, h, p, rows = 4) {
  let out = shape(poly([[x, y], [x + w, y - 6], [x + w + 30, y + h], [x - 30, y + h + 4]], true), p, '#e3e8c4', 2.6);
  for (let r = 0; r < rows; r++) {
    const yy = y + (r + 0.6) * h / rows;
    for (let c = 0; c < w / 34; c++) {
      const xx = x + 14 + c * 34 + (r % 2) * 12;
      const sw = Math.sin(CUR.T * 1.6 + xx * 0.02 + r) * 3;
      out += ink(`M${xx} ${yy}q${sw} -8 ${sw * 2 - 4} -14M${xx} ${yy}q${sw} -8 ${sw * 2 + 5} -12`, sub(p, 0.4 + r * 0.1, 0.8 + r * 0.05), 2, '#6f8a4d');
    }
  }
  return out;
}
function tree(x, y, s, p, kind = 'round') {
  const sw = Math.sin(CUR.T * 1.1 + x * 0.01) * 2.5;
  const trunk = tube(`M0 0Q2 -40 ${sw * 0.3} -90`, sub(p, 0, 0.5), C.brown, 12);
  let crown;
  if (kind === 'palm') {
    let fr = '';
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.55 + Math.sin(CUR.T * 1.3 + i) * 0.05;
      const ex = Math.cos(a) * 80, ey = -150 + Math.sin(a) * 40 + 40;
      fr += shape(`M0 -150Q${ex * 0.5} ${-190 + (ey + 150) * 0.2} ${ex} ${ey}Q${ex * 0.4} -160 0 -150Z`, sub(p, 0.3 + i * 0.05, 0.9), C.leaf, 2.4);
    }
    return at(x, y, s, tube(`M0 0Q8 -80 0 -150`, sub(p, 0, 0.5), C.brown, 10) + g(fr, `rotate(${sw} 0 -150)`));
  }
  const cr = curve([[-60, -80], [-78, -120], [-58, -165], [-18, -190], [30, -184], [66, -150], [74, -108], [52, -76], [0, -70]], true);
  crown = shape(cr, sub(p, 0.25, 1), C.leaf, 3);
  let tex = '';
  for (let i = 0; i < 5; i++) tex += ink(`M${-40 + i * 20} ${-120 - (i % 2) * 22}q6 -6 12 0`, sub(p, 0.7 + i * 0.05, 1), 2, '#6f8a4d');
  return at(x, y, s, trunk + g(crown + tex, `rotate(${sw} 0 -60)`));
}
function bush(x, y, s, p) {
  const d = curve([[-50, 0], [-56, -24], [-30, -44], [0, -50], [30, -44], [54, -22], [50, 0]]) + 'Z';
  return at(x, y, s, shape(d, p, C.green, 2.6));
}
function grass(x, y, s = 1, p = 1) {
  const sw = Math.sin(CUR.T * 2 + x * 0.05) * 3;
  return at(x, y, s, ink(`M-8 0q-2 -10 ${-6 + sw} -20M0 0q0 -14 ${sw} -26M8 0q2 -10 ${6 + sw} -18`, p, 2, '#6f8a4d'));
}

// ---------- buildings ----------
function windowBox(x, y, w, h, p, lit = false) {
  return shape(rect(x, y, w, h), p, lit ? '#f7dc9a' : '#dde6e6', 2.4) + ink(sl(x + w / 2, y, x + w / 2, y + h, 0.6) + sl(x, y + h / 2, x + w, y + h / 2, 0.6), sub(p, 0.5, 1), 1.8);
}
// Taiwanese townhouse (透天厝).
function townhouse(x, y, s, p, o = {}) {
  const w = o.w || 170, h = o.h || 260, floors = o.floors || 3;
  let out = shape(rect(-w / 2, -h, w, h), sub(p, 0, 0.5), o.wall || C.wall, 3);
  out += shape(poly([[-w / 2 - 10, -h], [w / 2 + 10, -h], [w / 2 + 4, -h - 16], [-w / 2 - 4, -h - 16]], true), sub(p, 0.2, 0.6), C.gray, 2.6);
  for (let f = 0; f < floors - 1; f++) {
    const fy = -h + 24 + f * ((h - 90) / (floors - 1));
    out += windowBox(-w / 2 + 20, fy, w - 40, (h - 110) / (floors - 1) - 20, sub(p, 0.4 + f * 0.1, 0.8 + f * 0.05), o.lit);
    out += ink(sl(-w / 2, fy + (h - 110) / (floors - 1) - 4, w / 2, fy + (h - 110) / (floors - 1) - 4, 1), sub(p, 0.5, 0.9), 2);
  }
  out += shape(rect(-w / 2 + 16, -76, w - 32, 76), sub(p, 0.5, 0.9), o.door || '#d8cfbd', 2.6);
  for (let i = 1; i < 6; i++) out += ink(sl(-w / 2 + 16, -76 + i * 12.6, w / 2 - 16, -76 + i * 12.6, 0.4), sub(p, 0.7, 1), 1.4, INK2);
  if (o.sign) out += shape(rect(-w / 2 + 10, -h + 6, w - 20, 0.1), 0, PAPER);
  return at(x, y, s, out);
}
// Traditional house with a curved tile roof (三合院 style).
function oldHouse(x, y, s, p, o = {}) {
  const w = o.w || 300, h = o.h || 130;
  let out = shape(rect(-w / 2, -h, w, h), sub(p, 0, 0.5), C.wall2, 3);
  const roof = `M${-w / 2 - 40} ${-h + 4}Q${-w / 4} ${-h - 20} ${-w / 2 + 30} ${-h - 70}H${w / 2 - 30}Q${w / 4} ${-h - 20} ${w / 2 + 40} ${-h + 4}Z`;
  out += shape(roof, sub(p, 0.1, 0.6), C.roof, 3);
  for (let i = 0; i < 9; i++) { const xx = -w / 2 + 20 + i * (w - 40) / 8; out += ink(sl(xx, -h - 62, xx * 1.1, -h - 6, 0.8), sub(p, 0.5 + i * 0.03, 0.9), 1.6, INK2); }
  const doorOpen = o.doorOpen || 0;
  out += shape(rect(-34, -96, 68, 96), sub(p, 0.4, 0.8), '#f7dc9a', 2.6);
  out += shape(rect(-34, -96, 68 * (1 - doorOpen * 0.8), 96), sub(p, 0.45, 0.85), '#caa982', 2.6);
  out += windowBox(-w / 2 + 26, -96, 60, 50, sub(p, 0.5, 0.9), o.lit) + windowBox(w / 2 - 86, -96, 60, 50, sub(p, 0.55, 0.95), o.lit);
  return at(x, y, s, out);
}
// Community hall with a sign board; `sign` is the board text.
function hall(x, y, s, p, sign = '') {
  const w = 520, h = 260;
  let out = shape(rect(-w / 2, -h, w, h), sub(p, 0, 0.4), C.wall, 3.2);
  out += shape(poly([[-w / 2 - 30, -h], [0, -h - 110], [w / 2 + 30, -h]], true), sub(p, 0.1, 0.5), C.roof, 3.2);
  out += shape(rect(-170, -h + 20, 340, 56), sub(p, 0.3, 0.6), '#fbf5e8', 3);
  out += txt(0, -h + 62, sign, sub(p, 0.5, 0.9), { size: 38 });
  for (let i = 0; i < 4; i++) out += tube(sl(-w / 2 + 40 + i * ((w - 80) / 3), -h + 90, -w / 2 + 40 + i * ((w - 80) / 3), 0, 0.5), sub(p, 0.3 + i * 0.05, 0.7), '#efe2c8', 14);
  out += shape(rect(-60, -140, 120, 140), sub(p, 0.5, 0.8), '#d6b793', 3);
  out += windowBox(-190, -150, 80, 70, sub(p, 0.55, 0.9)) + windowBox(110, -150, 80, 70, sub(p, 0.6, 0.95));
  out += shape(rect(-w / 2 - 20, -8, w + 40, 16), sub(p, 0.4, 0.7), C.gray, 2.6);
  return at(x, y, s, out);
}
function school(x, y, s, p, name = '') {
  const w = 620, h = 240;
  let out = shape(rect(-w / 2, -h, w, h), sub(p, 0, 0.4), '#f6eedc', 3.2);
  out += shape(rect(-70, -h - 90, 140, 90), sub(p, 0.1, 0.5), '#f6eedc', 3);
  out += shape(circ(0, -h - 45, 28), sub(p, 0.4, 0.7), '#fff9ee', 2.6);
  const a = CUR.T * 0.5;
  out += ink(`M0 ${-h - 45}l${r1(Math.cos(a) * 18)} ${r1(Math.sin(a) * 18)}M0 ${-h - 45}l0 -14`, sub(p, 0.6, 0.8), 2.4);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
    if (c === 2 || c === 3) continue;
    out += windowBox(-w / 2 + 30 + c * 98, -h + 30 + r * 100, 70, 60, sub(p, 0.35 + (r * 6 + c) * 0.03, 0.8 + c * 0.02));
  }
  out += shape(rect(-50, -110, 100, 110), sub(p, 0.5, 0.8), '#d6b793', 3);
  if (name) out += txt(0, -h + 90, name, sub(p, 0.6, 1), { size: 30 });
  return at(x, y, s, out);
}
function flagpole(x, y, s, p, col = C.red) {
  const T = CUR.T;
  const pts = [];
  for (let i = 0; i <= 6; i++) pts.push([i * 16, -250 + Math.sin(T * 4 - i * 0.9) * (i * 1.4)]);
  const bot = pts.map(([a, b]) => [a, b + 56]).reverse();
  const flag = curve(pts) + 'L' + bot.map(q => `${q[0]} ${q[1]}`).join('L') + 'Z';
  return at(x, y, s, tube('M0 0V-260', sub(p, 0, 0.6), '#e8e0d0', 6) + shape(flag, sub(p, 0.5, 1), col, 2.6));
}

// ---------- people ----------
// Feet at (x, y); ~170px tall at s=1. o.walk = gait phase (radians) or undefined.
function person(x, y, s, p, o = {}) {
  const ph = o.walk;
  const walking = ph !== undefined && ph !== null;
  const swing = walking ? Math.sin(ph) * 0.42 : 0;
  const bob = walking ? Math.abs(Math.cos(ph)) * 3 : Math.sin(CUR.T * 1.6 + x) * 1.2;
  const shirt = o.shirt || C.blue, pants = o.pants || '#8c7e6c', skin = C.skin;
  const kid = o.kid ? 0.72 : 1;
  const hipY = -78, shY = -132 - bob, headY = -152 - bob;
  const leg = (sgn) => {
    const a = swing * sgn;
    const kx = Math.sin(a) * 38, ky = hipY + Math.cos(a) * 38;
    const fx = kx + Math.sin(a - (walking ? Math.max(0, -a) * 0.8 : 0)) * 40, fy = ky + 40;
    return `M${sgn * 6} ${hipY - bob}L${r1(kx + sgn * 5)} ${r1(ky - bob * 0.5)}L${r1(fx + sgn * 5)} ${r1(Math.min(0, fy))}l10 0`;
  };
  const arm = (sgn, ang) => {
    const a = ang !== undefined ? ang : -swing * sgn * 0.9;
    const ex = Math.sin(a) * 30 + sgn * 14, ey = shY + 8 + Math.cos(a) * 30;
    const a2 = ang !== undefined ? a * 1.15 : a * 1.3;
    return `M${sgn * 14} ${shY + 6}L${r1(ex)} ${r1(ey)}L${r1(ex + Math.sin(a2) * 28)} ${r1(ey + Math.cos(a2) * 28)}`;
  };
  const arms = o.arms || [];
  const pa = sub(p, 0, 0.5), pb = sub(p, 0.2, 0.7), pc = sub(p, 0.4, 1);
  let out = '';
  out += tube(arm(-1, arms[0]), pc, skin, 8);
  out += tube(leg(-1), pa, pants, 10);
  out += tube(leg(1), pa, pants, 10);
  const torso = poly([[-17, shY], [17, shY], [15 + (o.dress ? 12 : 0), hipY - bob + (o.dress ? 22 : 4)], [-15 - (o.dress ? 12 : 0), hipY - bob + (o.dress ? 22 : 4)]], true, 1);
  out += shape(torso, pb, shirt, 3);
  if (o.vest) out += shape(poly([[-17, shY + 2], [-5, shY + 2], [-6, hipY - bob + 2], [-16, hipY - bob + 2]], true, 0.6), pb, C.vest, 2) + shape(poly([[17, shY + 2], [5, shY + 2], [6, hipY - bob + 2], [16, hipY - bob + 2]], true, 0.6), pb, C.vest, 2);
  out += tube(`M0 ${shY}V${headY + 12}`, pb, skin, 6);
  out += shape(circ(0, headY, 16, 16), pb, skin, 3);
  const hair = o.hair || 'short';
  if (hair === 'short') out += shape(`M-16 ${headY - 2}Q-16 ${headY - 20} 0 ${headY - 20}Q16 ${headY - 20} 17 ${headY - 3}Q6 ${headY - 12} -16 ${headY - 2}Z`, pc, o.hairCol || C.hair, 2);
  if (hair === 'long') out += shape(`M-17 ${headY + 14}Q-20 ${headY - 20} 0 ${headY - 20}Q20 ${headY - 20} 17 ${headY + 14}Q12 ${headY - 6} 0 ${headY - 10}Q-12 ${headY - 6} -17 ${headY + 14}Z`, pc, o.hairCol || C.hair, 2);
  if (hair === 'bun') out += shape(circ(0, headY - 22, 8, 10), pc, o.hairCol || '#8a8178', 2) + shape(`M-16 ${headY - 2}Q-16 ${headY - 18} 0 ${headY - 18}Q16 ${headY - 18} 16 ${headY - 2}Q2 ${headY - 10} -16 ${headY - 2}Z`, pc, o.hairCol || '#8a8178', 2);
  if (hair === 'gray') out += shape(`M-16 ${headY - 2}Q-16 ${headY - 20} 0 ${headY - 20}Q16 ${headY - 20} 17 ${headY - 3}Q6 ${headY - 12} -16 ${headY - 2}Z`, pc, '#c9c3ba', 2);
  if (hair === 'cap') out += shape(`M-17 ${headY - 3}Q-16 ${headY - 22} 0 ${headY - 22}Q16 ${headY - 22} 17 ${headY - 3}ZM10 ${headY - 5}h16`, pc, C.vest, 2.4);
  const blink = (Math.sin(CUR.T * 0.9 + x * 0.3) > 0.985) ? 0.4 : 2.2;
  out += op(pc, `<ellipse cx="5" cy="${headY - 1}" rx="2" ry="${blink}" fill="${INK}"/><ellipse cx="-6" cy="${headY - 1}" rx="2" ry="${blink}" fill="${INK}"/>`);
  out += ink(`M-5 ${headY + 7}q5 ${o.smile === false ? 0 : 4} 10 0`, pc, 2);
  if (o.glasses) out += ink(circ(-6, headY - 1, 5, 10) + circ(6, headY - 1, 5, 10) + `M-1 ${headY - 1}h2`, pc, 1.6);
  if (o.hold) out += op(pc, o.hold);
  out += tube(arm(1, arms[1]), pc, skin, 8);
  if (o.front) out += op(pc, o.front);
  return at(x, y, s * kid * (o.face === -1 ? 1 : 1), g(out, o.face === -1 ? 'scale(-1 1)' : ''));
}
// A walker moving from x0 to x1 during [t0, t0+dur], with gait synced to speed.
function walker(t0, dur, x0, x1, y, s, o = {}) {
  const k = clamp((CUR.t - t0) / dur);
  const moving = CUR.t > t0 && CUR.t < t0 + dur;
  const x = lerp(x0, x1, ease(k) * 0.15 + k * 0.85);
  const face = x1 < x0 ? -1 : 1;
  const ph = moving ? (x - x0) * 0.055 / s : null;
  return person(x, y, s, o.p === undefined ? 1 : o.p, { ...o, walk: ph, face: o.face || face });
}

// ---------- props ----------
function umbrella(col = C.blood) {
  const d = `M-70 -200Q-66 -262 0 -266Q66 -262 70 -200Q52 -212 35 -200Q18 -212 0 -200Q-18 -212 -35 -200Q-52 -212 -70 -200Z`;
  return tube('M0 -262V-120q0 12 -10 10', 1, '#e8e0d0', 4) + shape(d, 1, col, 3) + ink('M0 -266Q-20 -230 -35 -200M0 -266Q20 -230 35 -200', 1, 1.8, INK2);
}
function envelope(x, y, s, p, label = '') {
  let out = shape(rect(-46, -30, 92, 60, 0.8), p, '#fbeee0', 2.6) + ink('M-46 -30L0 6L46 -30', sub(p, 0.4, 1), 2.4);
  out += shape(circ(0, 6, 8, 12), sub(p, 0.6, 1), C.blood, 2);
  if (label) out += txt(0, 24, label, sub(p, 0.6, 1), { size: 14, col: INK });
  return at(x, y, s, out);
}
function book(x, y, s, p, open = 0) {
  let out = shape(poly([[-60, 0], [0, 10], [60, 0], [60, -54], [0, -44], [-60, -54]], true, 0.6), p, '#fbf6ea', 2.6) + ink('M0 10V-44', p, 2);
  for (let i = 0; i < 4; i++) out += ink(sl(-50, -38 + i * 9, -10, -32 + i * 9, 0.4) + sl(10, -32 + i * 9, 50, -38 + i * 9, 0.4), sub(p, 0.5, 1), 1.4, INK2);
  const f = (CUR.T * 0.7) % 1;
  if (open) out += op(Math.sin(f * Math.PI) * open, shape(`M0 -44Q${30 * Math.cos(f * Math.PI)} ${-70 + 10 * Math.sin(f * Math.PI)} ${60 * Math.cos(f * Math.PI)} ${-54 - 14 * Math.sin(f * Math.PI)}L${60 * Math.cos(f * Math.PI)} ${-2 - 14 * Math.sin(f * Math.PI)}L0 10Z`, 1, '#fffaf0', 2));
  return at(x, y, s, out);
}
function torch(x, y, s, p) {
  const T = CUR.T;
  const fl = `M0 -60Q${-16 + 3 * Math.sin(T * 9)} -84 ${-2 + 4 * Math.sin(T * 7)} ${-112 - 6 * Math.sin(T * 11)}Q${6} -96 ${10 + 3 * Math.sin(T * 8)} -104Q18 -80 0 -60Z`;
  return at(x, y, s, tube('M0 0L0 -56', p, C.brown, 8) + shape(poly([[-12, -52], [12, -52], [8, -64], [-8, -64]], true), p, C.gold, 2.4) + op(p, shape(fl, 1, '#f3b86b', 2.4) + shape(`M0 -66Q-6 -80 0 ${-92 - 4 * Math.sin(T * 10)}Q6 -80 0 -66Z`, 1, '#fbe3a0', 1.6)));
}
function giftBox(x, y, s, p, label = '') {
  let out = shape(rect(-34, -50, 68, 50), p, '#f3d7a3', 2.6) + shape(rect(-38, -62, 76, 14), p, '#f3d7a3', 2.6);
  out += ink('M0 -62V0', sub(p, 0.5, 1), 5, C.blood) + ink('M0 -62q-20 -18 -24 -4t24 4q20 -18 24 -4t-24 4', sub(p, 0.6, 1), 2.4);
  if (label) out += txt(0, -20, label, sub(p, 0.7, 1), { size: 16 });
  return at(x, y, s, out);
}
function riceBag(x, y, s, p) {
  return at(x, y, s, shape(`M-32 0Q-40 -40 -26 -70Q0 -80 26 -70Q40 -40 32 0Z`, p, '#f6efdc', 2.6) + ink('M-26 -70q26 10 52 0', p, 2) + txt(0, -26, '米', sub(p, 0.5, 1), { size: 26 }));
}
function bloodBag(x, y, s, p, fill = 1) {
  const lvl = -60 + 56 * (1 - fill);
  const clip = `bb${_clipId++}`;
  return at(x, y, s, `<clipPath id="${clip}"><rect x="-30" y="${lvl}" width="60" height="80"/></clipPath>` +
    wash(rrect(-24, -62, 48, 64, 10), p, '#fbf1ec') + `<path d="${rrect(-24, -62, 48, 64, 10)}" fill="${C.blood}" fill-opacity="${(0.85 * eout(p)).toFixed(3)}" clip-path="url(#${clip})"/>` +
    ink(rrect(-24, -62, 48, 64, 10), p, 2.6) + ink('M0 -62V-80', p, 2.6) + txt(0, -22, '+', sub(p, 0.6, 1), { size: 26, col: '#fff' }));
}
function mapPin(x, y, s, p, drop = 1) {
  const yy = -380 * (1 - eout(drop));
  const bounce = drop >= 1 ? Math.abs(Math.sin(CUR.T * 2)) * -6 : 0;
  return at(x, y + yy + bounce, s, op(eout(drop), shape('M0 0C-10 -24 -38 -44 -38 -72A38 38 0 1 1 38 -72C38 -44 10 -24 0 0Z', 1, C.blood, 3) + shape(circ(0, -72, 14), 1, PAPER, 2.6)) + op(drop >= 1 ? 1 : 0, ink(ell(0, 4, 30, 7, 14), 1, 2, INK2)));
}
function paperPlane(x, y, s, rot, p = 1) {
  return at(x, y, s, shape('M-30 -8L34 0L-30 12L-18 1Z', p, '#fffaf0', 2.4) + ink('M-18 1L34 0', p, 1.8), rot);
}
function stamp(x, y, s, p, label) {
  // Seal stamp: drops in with a small overshoot, then rests at an angle.
  const k = eout(p);
  const sc = p <= 0 ? 0 : (p < 1 ? 1.8 - 0.8 * k : 1);
  return op(clamp(p * 3), at(x, y, s * sc, g(ink(rrect(-80, -44, 160, 88, 10), 1, 5, C.blood) + ink(rrect(-70, -34, 140, 68, 6), 1, 2, C.blood) + txt(0, 12, label, 1, { size: 34, col: C.blood, font: "'Noto Serif CJK TC', serif", weight: 900 }), 'rotate(-8)')));
}
function banner(x, y, w, p, label, sub_ = '') {
  const k = ease(p);
  const ww = w * k;
  const wav = Math.sin(CUR.T * 2) * 3;
  let out = shape(`M${-ww / 2} ${-46 + wav}Q0 ${-56 - wav} ${ww / 2} ${-46 + wav}L${ww / 2} ${46 + wav}Q0 ${36 - wav} ${-ww / 2} ${46 + wav}Z`, clamp(p * 4), '#fbe6dc', 3);
  out += tube(`M${-ww / 2} -70V70`, clamp(p * 4), C.brown, 7) + tube(`M${ww / 2} -70V70`, clamp(p * 4), C.brown, 7);
  const cid = `bn${_clipId++}`;
  out += `<clipPath id="${cid}"><rect x="${-ww / 2}" y="-60" width="${ww}" height="120"/></clipPath><g clip-path="url(#${cid})">` + txt(0, 14 + (sub_ ? -8 : 0), label, 1, { size: 44, col: '#7a2f28' }) + (sub_ ? txt(0, 34, sub_, 1, { size: 20, col: '#7a2f28', font: 'Noto Serif, serif', italic: true, latin: true }) : '') + '</g>';
  return at(x, y, 1, out);
}
function speech(x, y, s, p, content) {
  const d = `M-80 -60Q-90 -110 -40 -118Q0 -130 40 -118Q92 -110 82 -60Q80 -24 30 -22L0 4L-8 -22Q-76 -22 -80 -60Z`;
  return at(x, y, s * (0.5 + 0.5 * eout(p)), op(clamp(p * 3), shape(d, 1, '#fffaf0', 2.8) + content));
}
function busBlood(x, y, s, p, label = '捐血車') {
  const w = 460, h = 190;
  let out = shape(rrect(-w / 2, -h - 30, w, h, 26), sub(p, 0, 0.5), '#fbf7f0', 3.2);
  out += shape(rect(-w / 2 + 4, -84, w - 8, 26, 0.6), sub(p, 0.3, 0.7), '#e9a79c', 2.2);
  for (let i = 0; i < 4; i++) out += windowBox(-w / 2 + 30 + i * 84, -h, 64, 64, sub(p, 0.3 + i * 0.05, 0.8));
  out += shape(rect(w / 2 - 80, -h, 56, 150), sub(p, 0.4, 0.8), '#dde6e6', 2.6);
  out += at(w / 2 - 130, -100, 1.3, shape(heartPath(1), sub(p, 0.5, 0.9), C.blood, 2.4));
  out += txt(-40, -100, label, sub(p, 0.6, 1), { size: 30, col: '#7a2f28' });
  out += shape(circ(-w / 2 + 90, -24, 30), sub(p, 0.3, 0.7), '#6a6159', 3) + shape(circ(-w / 2 + 90, -24, 12), sub(p, 0.5, 0.8), C.gray, 2);
  out += shape(circ(w / 2 - 110, -24, 30), sub(p, 0.3, 0.7), '#6a6159', 3) + shape(circ(w / 2 - 110, -24, 12), sub(p, 0.5, 0.8), C.gray, 2);
  return at(x, y, s, out);
}
function gate(x, y, s, p, label) {
  let out = tube('M-300 0V-300', sub(p, 0, 0.5), '#efe2c8', 30) + tube('M300 0V-300', sub(p, 0, 0.5), '#efe2c8', 30);
  out += shape(`M-360 -290Q0 -330 360 -290L350 -250Q0 -284 -350 -250Z`, sub(p, 0.3, 0.7), C.roof, 3);
  out += shape(rect(-220, -250, 440, 70), sub(p, 0.4, 0.8), '#fbf5e8', 3);
  out += txt(0, -200, label, sub(p, 0.6, 1), { size: 40 });
  return at(x, y, s, out);
}
function tent(x, y, s, p) {
  let out = tube('M-150 0V-170', sub(p, 0, 0.5), '#e8e0d0', 7) + tube('M150 0V-170', sub(p, 0, 0.5), '#e8e0d0', 7);
  const fl = Math.sin(CUR.T * 2.5) * 3;
  out += shape(`M-180 -170L0 -250L180 -170L180 ${-150 + fl}Q150 ${-138 - fl} 120 ${-150 + fl}Q90 ${-138 - fl} 60 ${-150 + fl}Q30 ${-138 - fl} 0 ${-150 + fl}Q-30 ${-138 - fl} -60 ${-150 + fl}Q-90 ${-138 - fl} -120 ${-150 + fl}Q-150 ${-138 - fl} -180 ${-150 + fl}Z`, sub(p, 0.2, 0.7), '#f2d3c4', 3);
  return at(x, y, s, out);
}
function table(x, y, s, p, w = 240) {
  return at(x, y, s, shape(rect(-w / 2, -80, w, 16), p, '#d9c3a0', 2.6) + ink(`M${-w / 2 + 16} -64V0M${w / 2 - 16} -64V0`, p, 4));
}
function cup(x, y, s, p) {
  return at(x, y, s, shape('M-12 -24L12 -24L9 0L-9 0Z', p, '#fffaf0', 2.2) + wash('M-10 -18L10 -18L9 -4L-9 -4Z', p, '#e6c98e') + steam(0, -28, 0.45, 2));
}
function frame(x, y, s, p, who = {}) {
  let out = shape(rect(-70, -90, 140, 180), p, '#f3e3c6', 3.4) + shape(rect(-56, -76, 112, 152), sub(p, 0.2, 0.6), '#fffaf0', 2.2);
  // head-and-shoulders portrait, clipped to the mat
  const id = `fr${_clipId++}`;
  out += `<clipPath id="${id}"><rect x="-55" y="-75" width="110" height="150"/></clipPath><g clip-path="url(#${id})">` +
    person(0, 190, 1.45, sub(p, 0.4, 1), { shirt: who.shirt || '#c9b79e', hair: who.hair || 'short', glasses: who.glasses, arms: [0.1, -0.1] }) + '</g>';
  return at(x, y, s, out);
}
function counter(x, y, s, value, p, unit = '袋') {
  return at(x, y, s, op(p, shape(rrect(-150, -80, 300, 140, 26), 1, '#fffaf0', 3.4) + txt(-20, 30, String(Math.round(value)), 1, { size: 96, font: "'Noto Serif CJK TC', serif", weight: 900, col: C.blood, width: 170 }) + txt(100, 26, unit, 1, { size: 40 })));
}
function calendarPage(x, y, s, p, big, small) {
  return at(x, y, s, shape(rect(-80, -100, 160, 190), p, '#fffaf0', 3) + shape(rect(-80, -100, 160, 44), p, C.red, 3) + txt(0, 30, big, sub(p, 0.4, 1), { size: 60, font: "'Noto Serif CJK TC', serif", weight: 900 }) + txt(0, 72, small, sub(p, 0.6, 1), { size: 22 }) + ink('M-40 -112V-88M40 -112V-88', p, 4));
}
function signpost(x, y, s, p, label) {
  const sw = Math.sin(CUR.T * 1.5 + x) * 1.5;
  return at(x, y, s, tube('M0 0V-150', sub(p, 0, 0.5), C.brown, 9) + g(shape(poly([[-80, -170], [70, -170], [96, -140], [70, -110], [-80, -110]], true), sub(p, 0.3, 0.8), '#fbf1dc', 3) + txt(-6, -126, label, sub(p, 0.5, 1), { size: 34 }), `rotate(${sw} 0 -140)`));
}

// ---------- logos ----------
// Kianshan emblem, drawn as line art (mountain + sun + heart in a double ring).
// If assets/logos/kianshan.png is supplied, render.py switches to that image.
function kianshanLogo(x, y, s, p) {
  if (window.LOGOS && window.LOGOS.kianshan) {
    return op(eout(p), `<image href="${window.LOGOS.kianshan}" x="${x - 110 * s}" y="${y - 110 * s}" width="${220 * s}" height="${220 * s}"/>`);
  }
  let out = shape(circ(0, 0, 110, 28), sub(p, 0, 0.4), '#fbf5e9', 4) + ink(circ(0, 0, 96, 28), sub(p, 0.1, 0.5), 2);
  out += shape(poly([[-78, 40], [-34, -30], [-10, 4], [16, -48], [80, 40]], true, 0.4), sub(p, 0.3, 0.7), '#b9cf9a', 3);
  out += shape(circ(44, -40, 16), sub(p, 0.4, 0.7), C.sun, 2.4);
  out += at(0, 30, 1.2, shape(heartPath(1), sub(p, 0.5, 0.9), C.blood, 2.6));
  out += ink('M-66 58Q0 72 66 58', sub(p, 0.6, 0.9), 2.4);
  out += txt(0, 88, '堅山', sub(p, 0.7, 1), { size: 22, col: INK });
  return at(x, y, s, out);
}
// Name badges for related public bodies. Official marks are not reproduced;
// drop PNGs in assets/logos/ (see README) to show the real ones.
function agencyBadge(x, y, s, p, key, name, en) {
  let out = shape(rrect(-260, -52, 520, 104, 18), p, '#fffaf0', 3);
  if (window.LOGOS && window.LOGOS[key]) out += op(eout(p), `<image href="${window.LOGOS[key]}" x="-246" y="-42" width="84" height="84"/>`);
  else {
    const icon = { social: heartPath(1.1), blood: 'M0 -26C-12 -8 -20 2 -20 12A20 20 0 0 0 20 12C20 2 12 -8 0 -26Z', volunteer: 'M-20 10Q-20 -14 0 -14Q20 -14 20 10ZM0 -18A9 9 0 1 1 0.1 -18Z' }[key] || heartPath(1);
    out += at(-204, 4, 1.1, shape(circ(0, 0, 34, 18), sub(p, 0.2, 0.6), '#f6ecd6', 2.6) + shape(icon, sub(p, 0.4, 0.8), key === 'blood' ? C.blood : key === 'volunteer' ? C.vest : C.red, 2.4));
  }
  out += txt(-146, -4, name, sub(p, 0.4, 1), { size: 30, anchor: 'start', width: name.length * 31 });
  out += txt(-146, 30, en, sub(p, 0.6, 1), { size: 18, anchor: 'start', italic: true, latin: true, font: "'Noto Serif', 'DejaVu Serif', serif", weight: 400, col: INK2, width: en.length * 9.2 });
  return at(x, y, s, out);
}
