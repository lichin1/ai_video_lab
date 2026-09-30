// Scene scripts. Each scene gets local time t (via CUR.t), its narration line
// times L[i].s / L[i].e and its duration D, and returns world SVG plus a camera.
// Layers are emitted back to front; every solid object has an opaque fill so
// nearer objects always cover farther ones.

function camPath(keys) {
  const t = CUR.t;
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, b] = [keys[i], keys[i + 1]];
    if (t <= b[0]) { const k = ease((t - a[0]) / (b[0] - a[0])); return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)]; }
  }
  return keys[keys.length - 1].slice(1);
}
const skyWash = (col = C.sky, x0 = -600, x1 = 8400) => `<rect x="${x0}" y="-600" width="${x1 - x0}" height="1300" fill="${col}" fill-opacity="0.35"/>`;
function cloudsRow(p, list, span) { return list.map(([x, y, s, sp]) => cloud(x, y, s, p, sp, span)).join(''); }
function nameTag(x, y, p, zh, en) {
  return op(eout(p), shape(rrect(x - 110, y - 36, 220, 64, 14), 1, '#fffaf0', 2.4) + txt(x, y - 4, zh, 1, { size: 26 }) + txt(x, y + 20, en, 1, { size: 15, italic: true, latin: true, font: "'Noto Serif', serif", weight: 400, col: INK2, width: en.length * 8 }));
}
function heading(x, y, p, zh, en, size = 46) {
  return shape(rrect(x - zh.length * size * 0.62 - 30, y - size - 10, zh.length * size * 1.24 + 60, size * 2.1, 20), sub(p, 0, 0.4), '#fffaf0', 3) + txt(x, y, zh, sub(p, 0.2, 0.8), { size }) + txt(x, y + size * 0.78, en, sub(p, 0.5, 1), { size: size * 0.42, italic: true, latin: true, font: "'Noto Serif', serif", weight: 400, col: INK2, width: en.length * size * 0.22 });
}

// Fade a screen-space element in at a and out at b (seconds, scene time).
const hudFade = (a, b = 1e9, fin = 0.6, fout = 0.6) => Math.min(eout(prog(a, fin)), 1 - eout(prog(b, fout)));

const SCENES = {};

// 1 — Opening: Renwu, north Kaohsiung. Event: map pin drops on the town.
SCENES.s01_opening = (L, D) => {
  const t = CUR.t;
  let s = skyWash();
  s += sun(1560, 230, 62, prog(0.2, 2));
  s += cloudsRow(prog(0.4, 2), [[300, 170, 1.1, 10], [980, 120, 0.8, 7], [1500, 330, 0.9, 12], [2000, 200, 1, 9]], [-300, 2300]);
  s += guanyinMountain(760, 560, 1.05, prog(0.5, 3));
  s += flyBy(3, 9, 360, 300, 'magpie', 0.9, 1) + flyBy(15, 9, 280, 360, 'magpie', 0.8, -1);
  s += flyBy(1, 14, 250, 200, 'small', 0.8, 1) + flyBy(1.6, 14, 280, 230, 'small', 0.6, 1);
  s += hills(600, prog(1, 2.5), '#e4e6c8', 2, 30);
  s += paddy(120, 640, 520, 110, prog(1.6, 2.5)) + paddy(1320, 650, 560, 100, prog(1.9, 2.5));
  s += ground(760, prog(1.2, 1.5), '#ece4cd');
  s += river([[-200, 880], [300, 850], [700, 900], [1100, 870], [1500, 910], [2100, 880]], 70, prog(1.8, 2.5));
  // Renwu town cluster
  const town = [[800, 780, 0.7, {}], [940, 790, 0.78, { floors: 4, h: 300 }], [1080, 776, 0.68, {}], [1210, 792, 0.74, { floors: 3 }]];
  town.forEach(([x, y, sc, o], i) => { s += townhouse(x, y, sc, prog(2.2 + i * 0.35, 2), { ...o, lit: t > L[1].s }); });
  s += oldHouse(560, 790, 0.62, prog(2.0, 2));
  s += smoke(620, 700, 0.6);
  s += tree(420, 800, 0.9, prog(2.4, 1.6)) + tree(1370, 800, 1.0, prog(2.6, 1.6)) + tree(1480, 812, 0.8, prog(2.8, 1.6), 'palm');
  for (let i = 0; i < 12; i++) s += grass(80 + i * 160, 1000 + (i % 3) * 20, 1, prog(3 + i * 0.05, 1));
  // road life: a farmer and a student stroll along the riverbank
  s += walker(2.5, 20, -80, 820, 1030, 0.9, { shirt: '#c9d8b0', hair: 'cap' });
  s += walker(6, 16, 2000, 1250, 1050, 0.82, { shirt: C.blue, hair: 'long', kid: true });
  s += hearts(1000, 520, L[1].s + 0.6, 6, 420);
  s += mapPin(1010, 520, 1.1, prog(L[0].s + 0.1, 1.2));
  s += op(eout(prog(L[0].s + 1.1, 0.4)), shape(rrect(1080, 400, 360, 110, 20), 1, '#fffaf0', 3));
  s += txt(1260, 452, '高雄市 仁武區', prog(L[0].s + 1.3, 1.2), { size: 44 });
  s += txt(1260, 492, 'Renwu District, Kaohsiung', prog(L[0].s + 1.9, 1.2), { size: 22, italic: true, latin: true, font: "'Noto Serif', serif", weight: 400, col: INK2, width: 280 });
  const cam = camPath([[0, 960, 540, 1.0], [D, 1040, 580, 1.12]]);
  return { svg: s, cam };
};

// 2 — Title card. Event: sun rises while the emblem and title draw on.
SCENES.s02_title = (L, D) => {
  const t = CUR.t;
  let s = skyWash('#f1e2c4');
  const sy = lerp(880, 300, eout(prog(0, 5)));
  s += sun(1580, sy, 80, 1);
  s += hills(800, prog(0, 1.5), '#e6e2c6', 5, 50) + hills(880, prog(0.3, 1.5), '#dde3c3', 9, 35);
  s += cloudsRow(prog(0.5, 2), [[200, 150, 0.9, 6], [1650, 190, 1.1, 8]], [-300, 2300]);
  s += flyBy(4, 8, 420, 330, 'small', 0.9, -1) + flyBy(4.4, 8, 450, 360, 'small', 0.7, -1) + flyBy(4.8, 8, 400, 330, 'small', 0.6, -1);
  s += shape(rrect(430, 500, 1060, 250, 30), prog(1.6, 1.2), '#fffaf0', 3.4);
  s += kianshanLogo(960, 300, 1.25, prog(0.5, 3));
  s += txt(960, 612, '高雄市堅山慈善會簡介', prog(2, 2.2), { size: 86, spacing: 6, width: 940 });
  s += txt(960, 685, 'An Introduction to the Kaohsiung Jianshan Charity Association', prog(3.3, 2), { size: 30, italic: true, latin: true, font: "'Noto Serif', serif", weight: 400, col: INK2, width: 900 });
  s += ink(sl(560, 632, 1360, 632, 3), prog(3, 1.6), 2.6, C.blood);
  for (let i = 0; i < 6; i++) s += sparkle(540 + i * 170, 470 + (i % 2) * 330, 0.9, prog(4.5 + i * 0.2, 0.5));
  for (let i = 0; i < 14; i++) s += grass(60 + i * 140, 1000 + (i % 2) * 30, 1.1, prog(0.8, 1));
  s += walker(1, D, -100, 700, 1050, 0.8, { shirt: '#e8c2b0', hair: 'long' }) + walker(1, D, -180, 620, 1060, 0.62, { shirt: C.blue, kid: true });
  return { svg: s, cam: camPath([[0, 960, 540, 1.0], [D, 960, 530, 1.05]]) };
};

// 3 — Founding. Event: neighbours converge on the hall and unfurl the banner.
SCENES.s03_founding = (L, D) => {
  const t = CUR.t;
  let s = skyWash();
  s += cloudsRow(prog(0, 1.5), [[260, 160, 1, 9], [1200, 110, 0.8, 6], [1800, 240, 0.9, 11]], [-300, 2300]);
  s += hills(640, prog(0, 1.5), '#e4e6c8', 4, 36);
  s += ground(820, prog(0.2, 1.2), '#ece4cd');
  s += tree(260, 840, 1.3, prog(0.6, 1.5)) + tree(1680, 840, 1.25, prog(0.8, 1.5)) + tree(1540, 830, 0.9, prog(1, 1.5), 'palm');
  s += hall(960, 840, 1.05, prog(0.3, 3), '堅山慈善會');
  s += flagpole(1330, 850, 1.1, prog(1.2, 1.5), '#e3a78e');
  s += flyBy(2, 10, 200, 150, 'magpie', 0.8, 1);
  const arrive = L[0].s + 2.8;
  const crowd = [
    [-120, 640, 1.1, { shirt: '#c9d8b0', hair: 'short' }], [-260, 520, 1.05, { shirt: '#e8c2b0', hair: 'long' }], [-380, 420, 0.98, { shirt: '#cfc0e0', hair: 'gray' }],
    [2040, 1280, 1.1, { shirt: C.blue, hair: 'short', glasses: true }], [2180, 1400, 1.04, { shirt: '#f2d6a2', hair: 'bun' }], [2300, 1520, 0.96, { shirt: '#b9d4d0', hair: 'cap' }],
  ];
  const up = eout(prog(arrive + 0.2, 0.8));
  crowd.forEach(([x0, x1, sc, o], i) => {
    const holder = i === 0 || i === 3;
    const arms = holder ? [-2.2 * up, -2.6 * up] : (t > arrive + 0.5 ? [0.2 + 0.25 * Math.sin(t * 3 + i), -0.2 - 0.25 * Math.sin(t * 3 + i)] : undefined);
    s += walker(0.8 + i * 0.25, arrive - 0.8 - i * 0.25, x0, x1, 990 + (i % 3) * 18, sc, { ...o, vest: i < 2 || i === 3, arms: t > arrive ? arms : undefined });
  });
  s += banner(960, 760, 700 * eout(prog(arrive + 0.6, 1.4)), prog(arrive + 0.6, 1.4) > 0 ? 1 : 0, '堅山慈善會 成立', 'The association is founded');
  s += hearts(960, 640, arrive + 1.4, 6, 700);
  s += signpost(170, 1040, 0.95, prog(L[1].s, 1.2), '仁林路');
  s += txt(170, 1070, 'Renlin Rd., Renwu', prog(L[1].s + 0.8, 1), { size: 18, italic: true, latin: true, font: "'Noto Serif', serif", weight: 400, width: 170 });
  let h = agencyBadge(1560, 110, 0.85, prog(L[1].s + 0.8, 1.6), 'social', '高雄市政府社會局', 'Social Affairs Bureau, Kaohsiung City');
  h += stamp(1770, 215, 0.62, prog(L[1].s + 2.4, 0.5), '輔導');
  return { svg: s, hud: h, cam: camPath([[0, 960, 540, 1.0], [L[0].s + 3, 960, 580, 1.06], [D, 980, 560, 1.1]]) };
};

// 4 — Chairpersons. Event: the torch is relayed, then the Chens bring gifts to an elder.
SCENES.s04_chairs = (L, D) => {
  const t = CUR.t;
  let s = skyWash();
  s += cloudsRow(prog(0, 1.2), [[300, 160, 1, 8], [1300, 120, 0.8, 6], [2300, 190, 1, 9], [3200, 140, 0.9, 7]], [-300, 4200]);
  s += guanyinMountain(2900, 620, 0.9, prog(0, 2));
  s += hills(660, prog(0, 1.5), '#e4e6c8', 7, 30, -300, 4200);
  s += ground(820, prog(0.2, 1.2), '#ece4cd', -400, 4300);
  // Part A — relay of the torch under a row of portraits
  const h = op(hudFade(0.6, L[1].s - 1), heading(960, 110, prog(0.6, 2), '歷任理事長', 'Past Chairpersons', 44));
  [560, 960, 1360].forEach((x, i) => {
    s += ink(sl(x, 250, x, 290, 0.5), prog(1 + i * 0.3, 0.4), 2);
    s += frame(x, 420, 1.2, prog(1 + i * 0.3, 1.6), { shirt: ['#c9b79e', '#b6c3b0', '#c2b4c8'][i], hair: ['gray', 'short', 'short'][i], glasses: i === 0 });
  });
  const p1 = L[0].s - 1.5, pass1 = L[0].s + 1.6, pass2 = L[0].s + 4.4;
  const runners = [[300, 620, p1, pass1], [620, 1040, pass1 + 0.3, pass2], [1040, 1300, pass2 + 0.3, pass2 + 2.2]];
  runners.forEach(([x0, x1, a, b], i) => {
    const holding = (i === 0 && t < pass1) || (i === 1 && t >= pass1 && t < pass2) || (i === 2 && t >= pass2);
    const wx = t < a ? x0 : t > b ? x1 : null;
    const o = { shirt: ['#d7c3a6', '#c9d8b0', '#b9d4d0'][i], hair: ['gray', 'short', 'short'][i], vest: true };
    const raise = i === 2 && t > pass2 + 2.4 ? -2.6 * eout(prog(pass2 + 2.4, 0.6)) : (holding ? -1.4 : undefined);
    const hold = holding ? torch(i === 2 && t > pass2 + 2.4 ? 20 - 14 * eout(prog(pass2 + 2.4, 0.6)) : 44, i === 2 && t > pass2 + 2.4 ? -150 - 60 * eout(prog(pass2 + 2.4, 0.6)) : -118, 0.8, 1) : '';
    s += walker(a, b - a, x0, x1, 990, 1.25, { ...o, arms: [0.2, raise], p: prog(1.2 + i * 0.3, 1.2), hold });
  });
  s += sparkle(1290, 660, 1.2, prog(pass2 + 2.8, 0.4)) + sparkle(1350, 610, 0.9, prog(pass2 + 3, 0.4));
  // Part B — Chairman Chen Kuo-tai and Ms. Wu Hui-feng visit an elder
  s += tree(2080, 840, 1.1, prog(2, 1.5)) + tree(3700, 840, 1.2, prog(2, 1.5));
  const door = eout(prog(L[2].s + 1.8, 1.2));
  s += oldHouse(3320, 860, 1.25, prog(1.5, 2.5), { doorOpen: door, lit: true });
  s += smoke(3450, 650, 0.8);
  const wa = L[1].s + 0.6, wb = L[2].s + 1.8;
  s += walker(wa, wb - wa, 2150, 2980, 990, 1.1, { shirt: '#b6c3b0', hair: 'short', glasses: true, vest: true, arms: [0.2, 0.9], hold: riceBag(62, -70, 0.9, 1) });
  s += walker(wa + 0.3, wb - wa - 0.3, 2030, 2840, 1000, 1.05, { shirt: '#e8c2b0', hair: 'bun', dress: true, vest: true, arms: [0.2, 0.9], hold: giftBox(62, -62, 0.9, 1) });
  const xChen = lerp(2150, 2980, clamp((t - wa) / (wb - wa)) * 0.85 + ease(clamp((t - wa) / (wb - wa))) * 0.15);
  const xWu = lerp(2030, 2840, clamp((t - wa - 0.3) / (wb - wa - 0.3)) * 0.85 + ease(clamp((t - wa - 0.3) / (wb - wa - 0.3))) * 0.15);
  s += nameTag(xChen, 770, prog(L[1].s + 0.8, 0.8), '陳國泰 理事長', 'Chairman Chen Kuo-tai');
  s += nameTag(xWu - 40, 690, prog(L[1].s + 1.4, 0.8), '吳惠豐 女士', 'Ms. Wu Hui-feng');
  s += person(3290, 990, 1.0, eout(prog(L[2].s + 2.4, 0.8)), { shirt: '#d9cfc2', hair: 'gray', face: -1, arms: t > L[2].s + 3 ? [-0.6, -1.2 - 0.3 * Math.sin(t * 3)] : undefined });
  s += hearts(3150, 740, L[2].s + 3, 6, 300);
  s += walker(0, D, 4200, 3700, 1060, 0.7, { shirt: C.blue, kid: true, hair: 'long' });
  const cam = camPath([[0, 960, 540, 1.0], [L[1].s - 0.6, 980, 560, 1.06], [L[1].s + 2.4, 2700, 580, 1.0], [L[2].s + 1.5, 2980, 600, 1.05], [D, 3100, 640, 1.12]]);
  return { svg: s, hud: h, cam };
};

// 5 — Scholarship. Events: envelope handed over; district signs pop up; caps tossed; child studies.
SCENES.s05_scholarship = (L, D) => {
  const t = CUR.t;
  let s = skyWash('#e2ebe8', -600, 8200);
  s += cloudsRow(prog(0, 1.2), [[300, 140, 1, 8], [1400, 180, 0.8, 7], [2600, 120, 1, 9], [3500, 200, 0.9, 6], [4600, 150, 1, 8], [5400, 210, 0.8, 7]], [-300, 6000]);
  s += guanyinMountain(2900, 640, 0.95, prog(0, 2));
  s += hills(690, prog(0, 1.5), '#e4e6c8', 3, 34, -300, 5900);
  s += ground(840, prog(0.2, 1.2), '#ece4cd', -400, 5900);
  // Panel 1 — school award
  s += school(900, 850, 1.05, prog(0.3, 2.6), '');
  s += flagpole(1420, 860, 1.1, prog(1, 1.5), '#e3a78e');
  let h = op(hudFade(L[0].s + 0.3, L[1].s - 0.6), heading(960, 110, prog(L[0].s + 0.3, 2), '清寒優秀學生獎助學金', 'Scholarships for bright students in need', 44));
  const give = L[0].s + 2.2;
  const k = eout(prog(give, 1.2));
  s += person(700, 1000, 1.1, prog(1, 1.4), { shirt: '#c9d8b0', hair: 'gray', vest: true, arms: [0.2, t > give - 0.8 ? 1.2 - 0.2 * k : undefined], face: 1 });
  s += person(1000, 1000, 0.95, prog(1.3, 1.4), { shirt: C.blue, kid: true, hair: 'long', face: -1, arms: [0.2, t > give + 0.6 ? 1.1 : undefined] });
  s += envelope(lerp(788, 910, k), lerp(870, 900, k) - Math.sin(k * Math.PI) * 30, 0.62, prog(give - 1, 0.8), '獎助學金');
  s += hearts(950, 780, give + 1.3, 5, 180);
  [[1160, 1010], [1230, 1025], [1300, 1005]].forEach(([x, y], i) => s += person(x, y - Math.max(0, Math.sin(t * 6 + i)) * (t > give + 1 ? 14 : 0), 0.9, prog(1.6 + i * 0.2, 1.2), { kid: true, shirt: ['#e8c2b0', '#f2d6a2', '#cfc0e0'][i], hair: ['short', 'long', 'short'][i], face: -1, arms: t > give + 1 ? [-2.4, -2.4] : undefined }));
  // Panel 2 — districts that benefit
  const names = ['仁武', '大樹', '鳥松', '大社'];
  names.forEach((n, i) => s += signpost(2250 + i * 340, 1000 - (i % 2) * 30, 1.1, prog(L[1].s + 0.4 + i * 0.55, 0.9), n));
  s += walker(L[1].s - 1, 12, 2000, 3700, 1060, 0.95, { kid: true, shirt: C.blue, hair: 'short', front: shape(rect(-30, -140, 22, 50), 1, '#e3a78e', 2) });
  s += walker(L[1].s - 0.5, 12, 1900, 3560, 1080, 0.9, { kid: true, shirt: '#f2d6a2', hair: 'long' });
  s += tree(3700, 860, 1.1, prog(1, 1.5)) + tree(2080, 860, 0.9, prog(1, 1.5), 'palm');
  // Panel 3 — university students
  s += school(4800, 850, 1.0, prog(L[1].s, 2.5), '大學 University');
  h += op(hudFade(L[2].s + 0.3, L[3].s - 2.6), heading(960, 110, prog(L[2].s + 0.3, 2), '學業 · 品德 兼優', 'Excellence in study and character', 40));
  const toss = L[2].s + 2.2;
  [4450, 4650, 4950, 5150].forEach((x, i) => {
    const tk = clamp((t - toss - i * 0.12) / 2.2);
    const cy = 780 - Math.sin(tk * Math.PI) * 330;
    s += person(x, 1000 + (i % 2) * 15, 1.02, prog(L[2].s - 0.5 + i * 0.2, 1.2), { shirt: ['#b9d4d0', '#e8c2b0', '#c9d8b0', '#cfc0e0'][i], hair: ['short', 'long', 'short', 'long'][i], face: i < 2 ? 1 : -1, arms: t > toss - 0.3 && t < toss + 2.6 ? [-2.5, -2.5] : [0.2, 0.9], hold: t < toss ? book(55, -80, 0.4, 1) : '' });
    if (t > toss) s += at(x, cy, 1, shape(poly([[-30, -6], [0, -18], [30, -6], [0, 6]], true, 0.4), 1, '#4a4038', 2.4) + ink('M20 -6v20', 1, 2, C.gold), tk * 540 * (i % 2 ? 1 : -1));
  });
  // Panel 4 — a child studies at home at night
  s += `<rect x="5760" y="-400" width="2200" height="1900" fill="#efe4cc"/>`;
  s += shape(rect(5790, -300, 1860, 1700), prog(L[3].s - 2.4, 1.5), '#f3e9d4', 3);
  s += shape(rect(6560, 250, 380, 300), prog(L[3].s - 2, 1.4), '#5d6f86', 3.2);
  s += shape(circ(6840, 330, 34), prog(L[3].s - 1.6, 1), '#f6e7b8', 2.4) + ink(sl(6750, 250, 6750, 550, 1) + sl(6560, 400, 6940, 400, 1), prog(L[3].s - 1.5, 1), 3);
  for (let i = 0; i < 5; i++) s += sparkle(6600 + i * 60, 290 + (i % 2) * 70, 0.5, prog(L[3].s - 1, 0.6));
  s += shape(rect(6040, 380, 160, 220), prog(L[3].s - 1.8, 1.2), '#f7eddc', 2.6) + txt(6120, 480, '獎狀', prog(L[3].s - 1.2, 1), { size: 34, col: C.blood });
  s += person(6770, 1010, 2.0, prog(L[3].s - 1.4, 1.2), { kid: true, shirt: C.blue, hair: 'long', arms: [0.8, 0.9 + 0.1 * Math.sin(t * 2)] });
  s += table(6700, 1010, 1.5, prog(L[3].s - 1.8, 1.2), 420);
  s += book(6580, 885, 1.1, prog(L[3].s - 1, 1), 1);
  s += envelope(6420, 868, 0.8, prog(L[3].s - 0.8, 0.8), '獎助學金');
  s += at(6960, 890, 1, tube('M0 0V-150Q0 -170 -40 -170', prog(L[3].s - 1.2, 0.8), '#8b7a66', 6) + shape('M-80 -150L-20 -150L-36 -190L-64 -190Z', prog(L[3].s - 1, 0.8), C.gold, 2.4) + op(eout(prog(L[3].s - 0.5, 1)) * (0.8 + 0.2 * Math.sin(t * 3)), `<ellipse cx="-50" cy="-60" rx="140" ry="90" fill="#f8dc8c" fill-opacity="0.22"/>`));
  s += hearts(6700, 740, L[3].s + 2, 4, 160);
  const cam = camPath([[0, 960, 540, 1.0], [L[0].s + 1.5, 940, 580, 1.08], [L[1].s - 0.8, 960, 580, 1.05], [L[1].s + 1.6, 2900, 560, 1.0], [L[2].s - 1.2, 3000, 560, 1.03], [L[2].s + 0.8, 4800, 560, 1.0], [L[3].s - 2.6, 4820, 560, 1.03], [L[3].s - 0.2, 6700, 560, 1.0], [D, 6700, 600, 1.1]]);
  return { svg: s, hud: h, cam };
};

// 6 — Blood drive at Guanyin Mountain. Events: buses pull in; tally climbs to 372.
SCENES.s06_blood = (L, D) => {
  const t = CUR.t;
  let s = skyWash('#e3ecec', -600, 3400);
  s += sun(2200, 180, 58, prog(0, 1.5));
  s += cloudsRow(prog(0, 1.2), [[200, 140, 1, 8], [900, 110, 0.8, 6], [1700, 200, 1, 9], [2500, 130, 0.9, 7]], [-300, 3200]);
  s += guanyinMountain(1200, 620, 1.25, prog(0, 2.5));
  s += flyBy(1.5, 12, 250, 200, 'magpie', 0.9, 1, -150, 3000);
  s += hills(700, prog(0.3, 1.5), '#e4e6c8', 6, 26, -300, 3300);
  s += ground(820, prog(0.3, 1.2), '#ece4cd', -400, 3400);
  s += tree(160, 840, 1.1, prog(0.8, 1.4)) + tree(2900, 840, 1.2, prog(0.8, 1.4)) + tree(2760, 830, 0.9, prog(1, 1.4), 'palm');
  s += gate(560, 960, 1.0, prog(0.6, 2.4), '觀音山風景區');
  // buses drive in from the right and stop
  const arriveA = L[1].s + 0.4, arriveB = L[1].s + 1.2;
  const bx1 = lerp(3400, 1180, eout(prog(arriveA, 2.6))), bx2 = lerp(3900, 1720, eout(prog(arriveB, 2.6)));
  if (t > arriveA - 0.1) s += busBlood(bx1, 990, 0.95, 1);
  if (t > arriveB - 0.1) s += busBlood(bx2, 990, 0.95, 1);
  s += tent(2330, 1000, 0.95, prog(0.8, 2));
  s += table(2330, 1000, 1.0, prog(1.2, 1.2), 260);
  [2240, 2300, 2360, 2420].forEach((x, i) => s += cup(x, 920, 1.2, prog(L[2].s - 0.6 + i * 0.2, 0.6)));
  s += person(2450, 1020, 1.0, prog(1.4, 1.2), { shirt: '#f2d6a2', hair: 'bun', vest: true, face: -1, arms: t > L[2].s ? [0.2, -1.8 - 0.35 * Math.sin(t * 4)] : undefined });
  s += person(2180, 1030, 1.0, prog(1.6, 1.2), { shirt: '#c9d8b0', hair: 'short', vest: true, face: -1, arms: t > L[2].s + 0.5 ? [0.2, 1.0] : undefined, hold: t > L[2].s + 0.5 ? cup(62, -80, 1, 1) : '' });
  // a queue of donors walking in through the gate
  for (let i = 0; i < 7; i++) {
    const t0 = 1.5 + i * 3.2;
    s += walker(t0, 9, 200 - i * 20, 1300 + (i % 3) * 90, 1060 + (i % 2) * 20, 0.95, { shirt: ['#b9d4d0', '#e8c2b0', '#cfc0e0', '#c9d8b0', C.blue, '#f2d6a2', '#d7c3a6'][i], hair: ['short', 'long', 'cap', 'short', 'long', 'bun', 'short'][i] });
  }
  let h = op(hudFade(L[1].s - 0.3, L[3].s - 0.8), calendarPage(200, 290, 0.9, 1, '5月', '2024') + txt(200, 430, 'May 2024', 1, { size: 22, italic: true, latin: true, font: "'Noto Serif', serif", weight: 400, width: 120 }));
  // tally
  const cnt = 372 * ease(prog(L[3].s + 0.2, 3.2));
  h += counter(960, 150, 1.0, cnt, eout(prog(L[3].s - 0.3, 0.6)));
  for (let i = 0; i < 6; i++) h += bloodBag(680 + i * 112, 330, 0.85, eout(prog(L[3].s + 0.3 + i * 0.25, 0.5)), clamp(cnt / 372 * 6 - i));
  // Chairman Li speaks
  s += person(1500, 1100, 1.3, eout(prog(L[4].s - 0.4, 0.8)), { shirt: '#d7c3a6', hair: 'short', vest: true, glasses: true, face: 1, arms: [0.2, -0.8 - 0.3 * Math.sin(t * 2.4)] });
  s += nameTag(1330, 860, prog(L[4].s + 0.2, 0.7), '李國忠 理事長', 'Chairman Li Kuo-chung');
  s += speech(1700, 800, 1.1, prog(L[4].s + 0.6, 0.6), heart(0, -64, 1.3, 1) + heart(-38, -72, 0.8, 1, C.pink) + heart(38, -72, 0.8, 1, C.pink));
  h += agencyBadge(1580, 110, 0.8, prog(L[2].s + 1.2, 1.6), 'blood', '台灣血液基金會 高雄捐血中心', 'Taiwan Blood Services Foundation, Kaohsiung');
  const cam = camPath([[0, 900, 540, 1.0], [L[1].s, 1000, 560, 1.02], [L[2].s - 0.5, 1250, 560, 1.02], [L[2].s + 1.4, 1750, 590, 1.08], [L[3].s - 0.4, 1450, 560, 1.0], [L[4].s - 0.4, 1520, 600, 1.05], [D, 1560, 680, 1.16]]);
  return { svg: s, hud: h, cam };
};

// 7 — Rain. Event: a volunteer walks through the rain and an elder opens the door.
SCENES.s07_rain = (L, D) => {
  const t = CUR.t;
  let s = `<rect x="-600" y="-600" width="3300" height="1500" fill="#c9d1d4" fill-opacity="0.45"/>`;
  s += cloudsRow(1, [[200, 120, 1.3, 5], [800, 90, 1.1, 4], [1400, 140, 1.4, 6], [2000, 110, 1.2, 5]], [-300, 2400]);
  s += rain(-300, 2300, -200, 1300, 1.6, 3);        // behind the houses: only shows in the sky
  const houses = [[240, 820, 1.0, { floors: 3 }], [470, 830, 1.05, { floors: 4, h: 320 }], [710, 820, 0.95, {}], [940, 830, 1.0, { floors: 3 }], [1180, 822, 1.02, { floors: 4, h: 300 }]];
  houses.forEach(([x, y, sc, o], i) => s += townhouse(x, y, sc, prog(0.2 + i * 0.3, 1.8), { ...o, lit: true }));
  const door = eout(prog(L[1].s + 1.6, 1.2));
  s += oldHouse(1620, 840, 1.25, prog(0.6, 2.2), { doorOpen: door, lit: true });
  s += smoke(1760, 620, 0.7);
  s += ground(840, prog(0, 1), '#ddd8c8', -400, 2400);
  const pud = [[500, 950, 160], [1150, 1010, 200], [1850, 960, 150]];
  pud.forEach(([x, y, w], i) => s += wash(ell(x, y, w / 2, 20, 18), 1, C.water, 0.9) + ink(ell(x, y, w / 2, 20, 18), 1, 2) + ripples(x, y, w * 0.8, i + 1, 4));
  s += `<g clip-path="url(#streetClip)">${rain(-300, 2300, 800, 1300, 1.0, 9)}</g>`;
  s += op(door, `<path d="M1578 840L1660 840L1780 1080L1480 1080Z" fill="#f8dc8c" fill-opacity="0.35"/>`);
  const va = L[0].s - 2, vb = L[1].s + 1.4;
  s += walker(va, vb - va, -100, 1480, 1000, 1.15, { shirt: '#c9d8b0', hair: 'short', vest: true, arms: [0.2, -1.2], hold: `<g transform="translate(48 -30)">${umbrella()}</g>`, front: '' });
  s += walker(va + 0.4, vb - va - 0.4, -260, 1340, 1020, 1.08, { shirt: '#e8c2b0', hair: 'long', vest: true, arms: [0.2, 0.9], hold: `<g transform="translate(-44 -24)">${umbrella('#6f95b8')}</g>` + riceBag(62, -70, 0.8, 1) });
  s += person(1640, 1000, 1.05, eout(prog(L[1].s + 2.2, 0.8)), { shirt: '#d9cfc2', hair: 'gray', face: -1, arms: t > L[1].s + 2.8 ? [-0.4, -1.6] : undefined });
  s += hearts(1540, 780, L[1].s + 3, 5, 220);
  const h = agencyBadge(1560, 110, 0.8, prog(L[0].s + 0.8, 1.6), 'volunteer', '高雄市志願服務資源中心', 'Kaohsiung Volunteer Service Center');
  const cam = camPath([[0, 900, 540, 1.0], [L[1].s, 1100, 560, 1.06], [D, 1400, 620, 1.14]]);
  return { svg: s, hud: h, cam };
};

// 8 — Recent news. Events: stamp hits the notice; letters fly as paper planes to schools.
SCENES.s08_recent = (L, D) => {
  const t = CUR.t;
  let s = skyWash('#e2ebe8');
  s += cloudsRow(prog(0, 1), [[300, 140, 0.9, 8], [1100, 100, 0.8, 6], [1800, 190, 1, 9]], [-300, 2300]);
  s += hills(620, prog(0, 1.5), '#e4e6c8', 8, 30);
  s += ground(760, prog(0.2, 1), '#ece4cd');
  const schools = [[1180, 700, 0.42], [1500, 760, 0.46], [1790, 690, 0.4]];
  schools.forEach(([x, y, sc], i) => s += school(x, y, sc, prog(0.8 + i * 0.3, 2)) + flagpole(x + 150 * sc * 2, y + 6, sc * 1.4, prog(1.4 + i * 0.3, 1.4), '#e3a78e'));
  s += tree(1000, 760, 0.7, prog(1, 1.4)) + tree(1880, 780, 0.75, prog(1, 1.4));
  // office desk
  s += shape(rect(-100, 560, 900, 560), prog(0, 1), '#f3e9d4', 3);
  s += table(380, 1080, 1.8, prog(0.3, 1.2), 420);
  s += calendarPage(160, 760, 0.95, prog(0.6, 1.2), '2025', '民國114年');
  for (let i = 0; i < 5; i++) s += at(420 + i * 3, 930 - i * 10, 1, shape(rect(-90, -20, 180, 24, 0.6), prog(0.8 + i * 0.1, 0.6), '#fffaf0', 2.2));
  s += envelope(420, 850, 1.3, prog(1.2, 0.8), '獎助學金公文');
  s += stamp(420, 850, 0.7, prog(L[0].s + 0.6, 0.45), '寄出');
  s += person(620, 1080, 1.15, prog(0.6, 1.2), { shirt: '#c9d8b0', hair: 'bun', vest: true, face: -1, arms: [0.2, t > L[0].s ? -0.9 : 0.6] });
  for (let i = 0; i < 6; i++) {
    const t0 = L[0].s + 1.4 + i * 0.55, k = clamp((t - t0) / 2.6);
    if (k <= 0 || k >= 1) continue;
    const [tx, ty] = [schools[i % 3][0], schools[i % 3][1] - 140];
    const x = lerp(420, tx, k), y = lerp(820, ty, k) - Math.sin(k * Math.PI) * (220 + i * 20);
    const dy = lerp(820, ty, k + 0.01) - Math.sin((k + 0.01) * Math.PI) * (220 + i * 20) - y;
    s += ink(`M${420} 820Q${(420 + tx) / 2} ${Math.min(820, ty) - 440 - i * 40} ${x} ${y}`, 1, 1.6, INK2, 'stroke-dasharray="6 10"');
    s += paperPlane(x, y, 1.2, Math.atan2(dy, (tx - 420) * 0.01) * 180 / Math.PI);
  }
  schools.forEach(([x, y], i) => s += sparkle(x, y - 150, 1, prog(L[0].s + 4 + i * 0.5, 0.4)));
  s += person(1400, 1000, 1.0, prog(L[1].s - 1, 1), { kid: true, shirt: C.blue, hair: 'long', arms: [0.8, 0.9], hold: envelope(56, -88, 0.5, 1) });
  s += person(1600, 1010, 0.98, prog(L[1].s - 0.6, 1), { kid: true, shirt: '#f2d6a2', hair: 'short', face: -1, arms: t > L[1].s + 1 ? [-2.4, -2.4 + 0.3 * Math.sin(t * 6)] : undefined });
  s += hearts(1500, 780, L[1].s + 1, 5, 240);
  const cam = camPath([[0, 960, 540, 1.0], [L[0].s + 1, 700, 600, 1.1], [L[0].s + 2.2, 960, 540, 1.0], [L[1].s - 0.5, 1000, 560, 1.0], [L[1].s + 1.5, 1470, 760, 1.4], [D, 1480, 780, 1.46]]);
  return { svg: s, cam };
};

// 9 — Ending. Events: a child grows into a volunteer; hearts circle the emblem.
SCENES.s09_ending = (L, D) => {
  const t = CUR.t;
  let s = `<rect x="-600" y="-600" width="3200" height="1500" fill="#f3d8b0" fill-opacity="0.45"/>`;
  s += sun(1300, 560, 120, prog(0, 1.6));
  s += cloudsRow(prog(0, 1.2), [[300, 180, 1, 5], [1000, 120, 0.8, 4], [1700, 230, 1.1, 6]], [-300, 2300]);
  s += guanyinMountain(1100, 700, 1.1, prog(0.2, 2), '#e3d7bf');
  s += flyBy(2, 12, 320, 250, 'small', 0.9, -1) + flyBy(2.4, 12, 350, 280, 'small', 0.7, -1) + flyBy(3, 12, 300, 260, 'small', 0.6, -1);
  s += ground(820, prog(0.3, 1), '#eadcc0');
  s += tree(160, 840, 1.1, prog(0.6, 1.4)) + tree(1820, 840, 1.1, prog(0.6, 1.4), 'palm');
  // growing up while walking
  const ga = L[0].s - 2.5, gb = L[1].s - 1;
  const gk = clamp((t - ga) / (gb - ga));
  const scale = lerp(0.62, 1.1, ease(gk));
  s += walker(ga, gb - ga, 100, 900, 1010, scale, { shirt: gk < 0.5 ? C.blue : '#c9d8b0', hair: gk < 0.5 ? 'long' : 'long', vest: gk > 0.6 });
  if (gk >= 1) s += person(900, 1010, 1.1, 1, { shirt: '#c9d8b0', hair: 'long', vest: true, arms: [0.2, 1.0], face: 1 });
  s += person(1060, 1020, 0.95, prog(L[0].s + 1, 1), { kid: true, shirt: '#f2d6a2', hair: 'short', face: -1, arms: t > gb + 0.2 ? [0.2, 1.0] : undefined });
  s += heart(985, 890, 0.9, eout(prog(gb + 0.3, 0.8)));
  s += hearts(980, 820, gb + 0.8, 5, 150);
  // circle of kindness
  const cp = prog(L[1].s, 1.6);
  s += op(eout(cp), shape(circ(960, 360, 170, 28), 1, '#fffaf0', 2.4));
  s += kianshanLogo(960, 360, 1.0, prog(L[1].s + 0.2, 2));
  for (let i = 0; i < 8; i++) {
    const a = t * 0.5 + i / 8 * Math.PI * 2;
    s += heart(960 + Math.cos(a) * 250, 360 + Math.sin(a) * 180, 0.9, eout(prog(L[1].s + 0.4 + i * 0.12, 0.6)), i % 2 ? C.red : C.pink);
  }
  const row = [300, 460, 1460, 1620];
  row.forEach((x, i) => s += person(x, 1040, 1.0, prog(L[1].s + 0.6 + i * 0.25, 1), { shirt: ['#b9d4d0', '#e8c2b0', '#cfc0e0', '#f2d6a2'][i], hair: ['short', 'long', 'gray', 'bun'][i], vest: true, face: i < 2 ? 1 : -1, arms: t > L[1].s + 2 ? [-2.3 - 0.2 * Math.sin(t * 3 + i), -2.3 - 0.2 * Math.sin(t * 3 + i + 1)] : undefined }));
  s += hearts(380, 820, L[1].s + 2.2, 4, 160) + hearts(1540, 820, L[1].s + 2.4, 4, 160);
  s += op(eout(prog(L[2].s + 0.4, 1)), shape(rrect(620, 570, 680, 110, 24), 1, '#fffaf0', 3));
  s += txt(960, 640, '邀您一起 · 讓愛延續', prog(L[2].s + 0.6, 1.8), { size: 52, col: '#7a2f28' });
  const cam = camPath([[0, 960, 600, 1.1], [L[1].s - 0.4, 900, 620, 1.12], [L[1].s + 1.4, 960, 540, 1.0], [D, 960, 520, 1.03]]);
  return { svg: s, cam };
};

// 10 — End card with emblem, agencies, sources and credits.
SCENES.s10_endcard = (L, D) => {
  const t = CUR.t;
  let s = skyWash('#f1e2c4');
  s += cloudsRow(prog(0, 1), [[240, 140, 0.8, 6], [1700, 170, 0.9, 7]], [-300, 2300]);
  s += hills(960, prog(0, 1.2), '#e6e2c6', 4, 26);
  s += kianshanLogo(960, 200, 0.95, prog(0.2, 2));
  s += txt(960, 368, '高雄市堅山慈善會', prog(1, 1.4), { size: 60, spacing: 4 });
  s += txt(960, 412, 'Kaohsiung Jianshan Charity Association', prog(1.6, 1.2), { size: 26, italic: true, latin: true, font: "'Noto Serif', serif", weight: 400, col: INK2, width: 520 });
  s += txt(960, 460, '高雄市仁武區仁林路267巷1弄19號', prog(2, 1.2), { size: 28, font: "'Noto Sans CJK TC', sans-serif", weight: 400, col: INK2 });
  s += agencyBadge(420, 580, 0.78, prog(2.6, 1.4), 'social', '高雄市政府社會局', 'Social Affairs Bureau, Kaohsiung');
  s += agencyBadge(960, 580, 0.78, prog(2.9, 1.4), 'blood', '台灣血液基金會 高雄捐血中心', 'Kaohsiung Blood Center');
  s += agencyBadge(1500, 580, 0.78, prog(3.2, 1.4), 'volunteer', '高雄市志願服務資源中心', 'Kaohsiung Volunteer Service Center');
  const src = '資料來源：高雄市政府社會局福利地圖、高雄市志願服務資源中心、中華捐血運動協會、各校獎助學金公告';
  s += txt(960, 710, src, prog(4, 1.6), { size: 22, font: "'Noto Sans CJK TC', sans-serif", weight: 400, col: INK2 });
  s += txt(960, 750, '畫面：程式繪製 SVG 手繪線稿 ｜ 旁白：AI 語音合成 ｜ 配樂與音效：原創合成', prog(4.6, 1.6), { size: 22, font: "'Noto Sans CJK TC', sans-serif", weight: 400, col: INK2 });
  s += walker(0, D, -100, 2000, 1040, 0.8, { shirt: '#c9d8b0', hair: 'short', vest: true }) + walker(0.4, D, -220, 1880, 1050, 0.62, { kid: true, shirt: C.blue, hair: 'long' });
  s += flyBy(2, 10, 300, 240, 'magpie', 0.8, -1);
  return { svg: s, cam: camPath([[0, 960, 540, 1.0], [D, 960, 540, 1.03]]) };
};
