// Scene scripts, version 2 (script/script.json v2, from the association's own
// yearbook). Each scene has cam(L, D) -> [cx, cy, zoom], draw(L, D) -> world SVG
// and optional hud(L, D) -> screen-space SVG. L[i].s / L[i].e are narration line
// times in scene seconds; every picture event is keyed to them. Layers are
// drawn back to front and solid things carry opaque fills, so nearer objects
// always cover farther ones; para(f, ...) gives far layers parallax.

function camPath(keys) {
  const t = CUR.t;
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, b] = [keys[i], keys[i + 1]];
    if (t <= b[0]) { const k = ease((t - a[0]) / (b[0] - a[0])); return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)]; }
  }
  return keys[keys.length - 1].slice(1);
}
const hudFade = (a, b = 1e9, fin = 0.6, fout = 0.6) => Math.min(eout(prog(a, fin)), 1 - eout(prog(b, fout)));
const SERIF_EN = "'Noto Serif', 'DejaVu Serif', serif";
function cloudsRow(p, list, span) { return list.map(([x, y, s, sp]) => cloud(x, y, s, p, sp, span)).join(''); }
function nameTag(x, y, p, zh, en) {
  const w = Math.max(200, zh.length * 28 + 40);
  return op(eout(p), shape(rrect(x - w / 2, y - 36, w, 66, 14), 1, '#fffaf0', 2.4) + txt(x, y - 4, zh, 1, { size: 26 }) +
    txt(x, y + 20, en, 1, { size: 15, italic: true, latin: true, font: SERIF_EN, weight: 400, col: INK2, width: en.length * 8 }));
}
function heading(x, y, p, zh, en, size = 44) {
  const w = Math.max(zh.length * size * 1.1, en.length * size * 0.23) + 70;
  return shape(rrect(x - w / 2, y - size - 10, w, size * 2.1, 20), sub(p, 0, 0.4), '#fffaf0', 3) + txt(x, y, zh, sub(p, 0.2, 0.8), { size }) +
    txt(x, y + size * 0.78, en, sub(p, 0.5, 1), { size: size * 0.42, italic: true, latin: true, font: SERIF_EN, weight: 400, col: INK2, width: en.length * size * 0.22 });
}
function factCard(x, y, p, big, unit, label, en) {
  return op(eout(p), shape(rrect(x - 190, y - 92, 380, 176, 24), 1, '#fffaf0', 3.2) +
    txt(x - 20, y + 4, big, 1, { size: 86, font: "'Noto Serif CJK TC', serif", weight: 900, col: C.blood, width: big.length * 50 }) +
    txt(x + 30 + big.length * 25, y, unit, 1, { size: 36, anchor: 'start', width: unit.length * 36 }) +
    txt(x, y + 48, label, 1, { size: 24, col: INK2 }) + txt(x, y + 74, en, 1, { size: 16, italic: true, latin: true, font: SERIF_EN, weight: 400, col: INK2, width: en.length * 8 }));
}
const count = (v, t0, dur) => Math.round(v * ease(prog(t0, dur)));
const SHIRTS = ['#b9d4d0', '#e8c2b0', '#cfc0e0', '#c9d8b0', '#9dbbd6', '#f2d6a2', '#d7c3a6', '#e3b8c4'];
const HAIRS = ['short', 'long', 'cap', 'short', 'pony', 'bun', 'gray', 'short'];

const SCENES = {};

// 1 — Renwu. Events: the pin drops on the town; a passer-by helps an elder.
SCENES.s01_opening = {
  cam: (L, D) => camPath([[0, 960, 540, 1.0], [D, 1060, 590, 1.12]]),
  draw(L, D) {
    const t = CUR.t;
    let s = skyGrad();
    s += para(0.2, sun(1560, 210, 62, prog(0.2, 2)) + glowAt(1560, 210, 220, eout(prog(0.2, 2))));
    s += para(0.3, cloudsRow(prog(0.4, 2), [[300, 160, 1.1, 10], [980, 110, 0.8, 7], [1500, 320, 0.9, 12], [2000, 190, 1, 9]], [-400, 2500]));
    s += para(0.5, guanyinMountain(760, 560, 1.05, prog(0.5, 3), '#e2e6d4'));
    s += flyBy(3, 10, 360, 300, 'magpie', 0.9, 1) + flyBy(15, 9, 280, 360, 'magpie', 0.8, -1);
    s += flyBy(1, 14, 250, 200, 'small', 0.8, 1) + flyBy(1.6, 14, 280, 230, 'small', 0.6, 1) + flyBy(2.1, 14, 230, 190, 'small', 0.5, 1);
    s += para(0.7, hills(600, prog(1, 2.5), '#e4e8c9', 2, 30));
    s += para(0.85, paddy(100, 640, 520, 110, prog(1.6, 2.5)) + paddy(1320, 650, 600, 100, prog(1.9, 2.5)));
    s += ground(760, prog(1.2, 1.5), '#ece4cd', -400, 2500);
    s += river([[-300, 880], [300, 850], [700, 900], [1100, 870], [1500, 910], [2300, 880]], 70, prog(1.8, 2.5));
    const town = [[790, 780, 0.7, { sign: '雜貨' }], [940, 790, 0.78, { floors: 4, h: 300 }], [1085, 776, 0.68, {}], [1215, 792, 0.74, { floors: 3, sign: '藥局' }]];
    s += oldHouse(560, 790, 0.62, prog(2.0, 2));
    s += smoke(620, 700, 0.6);
    town.forEach(([x, y, sc, o], i) => { s += townhouse(x, y, sc, prog(2.2 + i * 0.35, 2), { ...o, lit: t > L[1].s }); });
    s += tree(420, 800, 0.9, prog(2.4, 1.6)) + tree(1370, 800, 1.0, prog(2.6, 1.6)) + tree(1490, 812, 0.8, prog(2.8, 1.6), 'palm') + tree(1720, 806, 0.85, prog(3, 1.6));
    s += fallingLeaves(1300, 1500, 650, 820, 4, 3);
    for (let i = 0; i < 14; i++) s += grass(60 + i * 150, 1000 + (i % 3) * 22, 1, prog(3 + i * 0.05, 1));
    // the elder and the helper
    const meet = L[1].s + 0.6;
    s += walker(1, meet - 1, 1900, 1420, 1050, 1.0, { shirt: '#c9d8b0', hair: 'short', vest: true, arms: t > meet ? [0.2, 1.0] : undefined, hold: t > meet + 0.4 ? riceBag(60, -74, 0.75, 1) : '' });
    s += person(1300, 1040, 0.98, prog(2.5, 1.2), { shirt: '#d9cfc2', hair: 'gray', elder: true, face: 1, arms: t > meet + 0.4 ? [0.2, -0.6 - 0.25 * Math.sin(t * 3)] : [0.2, 0.3] });
    if (t < meet + 0.4) s += riceBag(1352, 1044, 0.7, prog(2.6, 1));
    s += hearts(1360, 840, meet + 1.0, 5, 160);
    s += walker(2.5, 20, -80, 820, 1030, 0.9, { shirt: '#f2d6a2', hair: 'cap' });
    s += mapPin(1010, 520, 1.1, prog(L[0].s + 0.1, 1.2));
    s += op(eout(prog(L[0].s + 1.1, 0.4)), shape(rrect(1080, 400, 360, 110, 20), 1, '#fffaf0', 3));
    s += txt(1260, 452, '高雄市 仁武區', prog(L[0].s + 1.3, 1.2), { size: 44 });
    s += txt(1260, 492, 'Renwu District, Kaohsiung', prog(L[0].s + 1.9, 1.2), { size: 22, italic: true, latin: true, font: SERIF_EN, weight: 400, col: INK2, width: 280 });
    return s;
  },
};

// 2 — Title card. Event: sun rises while the emblem and title draw on.
SCENES.s02_title = {
  cam: (L, D) => camPath([[0, 960, 540, 1.0], [D, 960, 530, 1.05]]),
  draw(L, D) {
    let s = `<rect x="-200" y="-200" width="2400" height="1500" fill="#f1e2c4" fill-opacity="0.35"/>`;
    const sy = lerp(880, 300, eout(prog(0, 5)));
    s += glowAt(1580, sy, 260) + sun(1580, sy, 80, 1);
    s += hills(800, prog(0, 1.5), '#e6e2c6', 5, 50) + hills(880, prog(0.3, 1.5), '#dde3c3', 9, 35);
    s += cloudsRow(prog(0.5, 2), [[200, 150, 0.9, 6], [1650, 190, 1.1, 8]], [-300, 2300]);
    s += flyBy(4, 8, 420, 330, 'small', 0.9, -1) + flyBy(4.4, 8, 450, 360, 'small', 0.7, -1) + flyBy(4.8, 8, 400, 330, 'small', 0.6, -1);
    s += shape(rrect(430, 500, 1060, 250, 30), prog(1.6, 1.2), '#fffaf0', 3.4);
    s += kianshanLogo(960, 300, 1.25, prog(0.5, 3));
    s += txt(960, 612, '高雄市堅山慈善會簡介', prog(2, 2.2), { size: 86, spacing: 6, width: 940 });
    s += txt(960, 685, 'An Introduction to the Kaohsiung Jianshan Charity Association', prog(3.3, 2), { size: 30, italic: true, latin: true, font: SERIF_EN, weight: 400, col: INK2, width: 900 });
    s += ink(sl(560, 632, 1360, 632, 3), prog(3, 1.6), 2.6, C.blood);
    s += op(eout(prog(4.2, 0.8)), shape(rrect(740, 770, 440, 54, 27), 1, '#c95f52', 2.6) + txt(960, 806, '創會於民國 86 年 · since 1997', 1, { size: 24, col: '#fff7e6', width: 360 }));
    for (let i = 0; i < 6; i++) s += sparkle(540 + i * 170, 470 + (i % 2) * 330, 0.9, prog(4.5 + i * 0.2, 0.5));
    for (let i = 0; i < 14; i++) s += grass(60 + i * 140, 1000 + (i % 2) * 30, 1.1, prog(0.8, 1));
    s += walker(1, D, -100, 700, 1050, 0.8, { shirt: '#e8c2b0', hair: 'long' }) + walker(1, D, -180, 620, 1060, 0.62, { shirt: C.blue, kid: true });
    return s;
  },
};

// 3 — Founders. Events: seven neighbours meet at night (85.9); the plaque goes up (86.1.1);
// Li Ching-jui opens his own home as the office.
SCENES.s03_founders = {
  cam: (L, D) => camPath([[0, 960, 600, 1.06], [L[0].s + 4, 960, 600, 1.1], [L[1].s - 1.2, 980, 600, 1.06], [L[1].s + 1.2, 3300, 560, 1.0], [L[2].s, 3300, 580, 1.04], [D, 3360, 600, 1.1]]),
  draw(L, D) {
    const t = CUR.t;
    // ---- interior, night of 85.9 ----
    // the room fades up while it draws, so the title never gives way to a bare wall
    let s = op(eout(prog(0.2, 1.6)), `<rect x="-400" y="-300" width="2700" height="1700" fill="#efe1c6"/>`);
    s += shape(rect(-300, -200, 2560, 1150), prog(0.2, 1.4), '#f2e6cc', 3);
    for (let i = 0; i < 26; i++) s += ink(`M${-300 + i * 100} 950V-200`, prog(0.3, 1.2), 1, '#e2d2b2');
    s += shape(rect(1380, 420, 380, 280), prog(0.4, 1.2), 'url(#nightGrad)', 3.2) + ink(sl(1570, 420, 1570, 700, 1) + sl(1380, 560, 1760, 560, 1), prog(0.8, 0.8), 3);
    s += shape(circ(1680, 480, 30), prog(1, 0.8), '#f6e7b8', 2.2);
    for (let i = 0; i < 6; i++) s += sparkle(1420 + i * 55, 450 + (i % 3) * 70, 0.4, prog(1.2, 0.5));
    s += lamp(960, 470, 1.1, prog(0.6, 1.2), 1);
    s += op(eout(prog(1.2, 0.8)), calendar2(420, 560, 1.0, 1, '民國 85 年', '9月', '十五日'));
    // seven founders: four behind the table, three in front
    const back = [[700, 0], [860, 2], [1060, 6], [1220, 3]];
    back.forEach(([x, k], i) => s += person(x, 1000, 1.25, prog(1 + i * 0.25, 1.2), { shirt: SHIRTS[k], hair: HAIRS[k], face: x < 960 ? 1 : -1, arms: [0.3, 0.7 + 0.2 * Math.sin(t * 2 + i)] }));
    s += shape(rect(560, 890, 800, 30, 0.5), prog(0.8, 1), '#c9a77f', 3) + ink('M600 920V1080M1320 920V1080', prog(1, 0.6), 6, '#8b6f52');
    s += hatch(rect(560, 905, 800, 15, 0.3), prog(1, 0.6), 0.5);
    s += at(960, 888, 1, shape(rect(-120, -12, 240, 14, 0.3), prog(1.6, 0.8), '#fffaf0', 1.8) + txt(0, -16, '慈善籌備會', prog(L[0].s + 0.6, 1), { size: 22, col: '#7a2f28' }));
    [[500, 4, 1], [1420, 5, -1], [1600, 7, -1]].forEach(([x, k, f], i) => s += person(x, 1060, 1.35, prog(1.6 + i * 0.25, 1.2), { shirt: SHIRTS[k], hair: HAIRS[k], face: f, arms: t > L[0].s + 2 && i === 0 ? [0.2, -1.2 - 0.3 * Math.sin(t * 3)] : [0.3, 0.6] }));
    s += hearts(960, 700, L[0].s + 2.5, 5, 400, C.pink);
    // ---- exterior, New Year's Day 86 ----
    s += `<rect x="2300" y="-300" width="2400" height="1100" fill="url(#skyGrad)"/>`;
    s += para(0.5, cloudsRow(1, [[2700, 140, 1, 6], [3500, 110, 0.9, 5], [4100, 180, 1, 7]], [2200, 4700]));
    s += para(0.6, hills(640, 1, '#e4e8c9', 4, 30, 2200, 4800));
    s += ground(820, 1, '#ece4cd', 2200, 4800);
    s += tree(2650, 840, 1.15, 1) + tree(4050, 840, 1.1, 1, 'palm');
    s += oldHouse(3300, 860, 1.35, 1, { doorOpen: eout(prog(L[2].s + 0.4, 1.2)), lit: true });
    const ph = prog(L[1].s + 0.2, 1.2);
    s += op(eout(ph), g(plaque(3300, 560 - 120 * (1 - eout(ph)), 1, 1, '堅山南邑慈善會', Math.sin(t * 2.2) * 2 * (1 - eout(prog(L[1].s + 1.4, 2))))));
    s += confetti(3300, 500, L[1].s + 1.3, 30, 300);
    s += person(3300, 990, 1.15, eout(prog(L[2].s + 1.0, 0.8)), { shirt: '#c9b79e', hair: 'short', glasses: true, face: -1, arms: t > L[2].s + 1.6 ? [0.2, -1.4 - 0.2 * Math.sin(t * 3)] : undefined });
    s += nameTag(3560, 800, prog(L[2].s + 1.4, 0.8), '首任會長 李慶瑞', 'First president Li Ching-jui');
    for (let i = 0; i < 4; i++) s += walker(L[2].s + 0.5 + i * 0.5, 4.5, 2400 - i * 120, 3060 - i * 90, 1010 + (i % 2) * 18, 1.05, { shirt: SHIRTS[i + 2], hair: HAIRS[i + 2], vest: i % 2 === 0 });
    return s;
  },
  hud(L, D) {
    const names = '李慶瑞・江明和・黃金城・廖明全・林明正・黃大榮・張萬進';
    let h = op(hudFade(L[0].s + 1.2, L[1].s - 1.2), shape(rrect(480, 64, 960, 112, 22), 1, '#fffaf0', 3) +
      txt(960, 112, '七位發起人', 1, { size: 30, col: '#7a2f28' }) + txt(960, 154, names, prog(L[0].s + 1.6, 2.4), { size: 30, width: 860 }));
    h += op(hudFade(L[1].s, L[2].s + 2), calendar2(200, 300, 0.9, 1, '民國 86 年', '1月1日', '正式運作'));
    return h;
  },
};

// 4 — Growth. Events: boxes move to Linshan Lane while membership passes 100;
// donations build the hall while the charity chest stays locked; registration certificate.
SCENES.s04_growth = {
  cam: (L, D) => camPath([[0, 900, 560, 1.0], [L[0].s + 4.5, 2300, 560, 1.0], [L[1].s, 2900, 560, 1.0], [L[2].s - 0.4, 2950, 560, 1.05], [D, 2980, 560, 1.08]]),
  draw(L, D) {
    const t = CUR.t;
    let s = skyGrad(-600, 4400);
    s += para(0.3, cloudsRow(prog(0, 1), [[300, 150, 1, 9], [1200, 110, 0.8, 6], [2200, 190, 1, 8], [3100, 130, 0.9, 7], [3800, 170, 1, 6]], [-400, 4400]));
    s += para(0.5, guanyinMountain(2500, 600, 1.0, prog(0, 2), '#e2e6d4'));
    s += para(0.7, hills(650, prog(0, 1.5), '#e4e8c9', 3, 30, -400, 4600));
    s += para(0.85, [[1250, 0.6, 3], [1400, 0.66, 4], [1880, 0.62, 3], [3900, 0.6, 3], [4050, 0.64, 4]].map(([x, sc, f], i) => townhouse(x, 800, sc, prog(0.4 + i * 0.2, 1.6), { floors: f, h: f === 4 ? 320 : 260 })).join(''));
    s += ground(820, prog(0.2, 1), '#ece4cd', -600, 4600);
    // old office and the road
    s += oldHouse(520, 860, 1.1, prog(0.3, 2), { plaque: '堅山南邑慈善會' });
    s += signpost(140, 1040, 0.9, prog(0.8, 1), '南興巷');
    s += signpost(2050, 1040, 0.9, prog(L[0].s + 1.5, 1), '林山巷');
    s += tree(1100, 840, 1.0, prog(0.6, 1.5)) + tree(1600, 840, 0.9, prog(0.8, 1.5), 'palm');
    const ca = L[0].s - 0.5, cb = L[0].s + 5;
    const cx = lerp(700, 2500, ease(clamp((t - ca) / (cb - ca))));
    s += cart(cx, 1020, 1.0, prog(0.8, 1));
    s += person(cx - 160, 1030, 1.1, prog(0.8, 1), { shirt: '#c9d8b0', hair: 'short', vest: true, walk: t > ca && t < cb ? (cx - 700) * 0.05 : null, arms: [0.2, 1.3] });
    s += walker(ca + 0.4, cb - ca, 520, 2350, 1050, 1.0, { shirt: '#e8c2b0', hair: 'long', hold: cart(0, 0, 0, 0) });
    // the new hall rises with scaffolding, paid for by separate donations
    const build = prog(L[1].s - 0.5, 4.5);
    s += hall(3000, 860, 1.0, build, '堅山慈善會');
    s += op(1 - eout(prog(L[1].s + 4.2, 1)), scaffold(2720, 860, 560, 380, eout(prog(L[0].s + 2.5, 1.5))));
    s += donationBox(3460, 1030, 1.0, prog(L[1].s, 0.8));
    s += coins(3460, 940, L[1].s + 0.6, 8);
    for (let i = 0; i < 3; i++) s += person(3600 + i * 120, 1050, 1.0, prog(L[1].s + 0.2 + i * 0.2, 0.8), { shirt: SHIRTS[i + 3], hair: HAIRS[i + 3], face: -1, arms: [0.2, t > L[1].s + 0.6 + i * 0.9 && t < L[1].s + 1.6 + i * 0.9 ? -0.8 : 0.4] });
    s += chest(2540, 1040, 1.0, prog(L[1].s + 1.6, 0.8));
    s += sparkle(2500, 920, 0.9, prog(L[1].s + 2.6, 0.4)) + sparkle(2590, 900, 0.7, prog(L[1].s + 2.8, 0.4));
    return s;
  },
  hud(L, D) {
    const t = CUR.t;
    let h = op(hudFade(L[0].s + 0.6, L[1].s - 0.6), shape(rrect(1330, 40, 540, 190, 24), 1, '#fffaf0', 3) +
      txt(1600, 90, `會員 ${count(100, L[0].s + 0.8, 3.2)}+ 人`, 1, { size: 36, col: '#7a2f28', width: 260 }) + peopleIcons(1380, 150, Math.min(30, Math.round(30 * prog(L[0].s + 0.8, 3.2))), 15, 26));
    h += op(hudFade(L[1].s + 1.8, L[2].s - 0.4), shape(rrect(1500, 70, 380, 90, 20), 1, '#fffaf0', 2.6) + txt(1690, 112, '會館經費另行募款', 1, { size: 28 }) + txt(1690, 146, '從未動用慈善基金', 1, { size: 24, col: '#7a2f28' }));
    const cp = prog(L[2].s, 1.2);
    h += op(eout(cp) * 0.35, `<rect x="0" y="0" width="1920" height="1080" fill="#f4ecdc"/>`);
    h += op(eout(cp), certificate(760, 470, 1.15, cp, '立案證書', '高雄縣堅山慈善會 · 民國90年'));
    h += stamp(900, 590, 0.9, prog(L[2].s + 1.4, 0.45), '立案');
    h += op(eout(prog(L[2].s + 1.8, 0.8)), medallion(1380, 430, 1.25, prog(L[2].s + 1.8, 1.4), '黃金城', '首屆理事長', { shirt: '#b6c3b0', hair: 'short' }));
    return h;
  },
};

// 5 — Heritage along a road of years. Events: advisory group joins (92); Chen Kuo-tai
// and membership growth; ribbon cut at the new hall (101); torch relay to Li Kuo-chung.
const YEARS = [[300, '86'], [800, '90'], [1300, '92'], [1900, '94'], [2500, '98'], [3100, '101'], [3800, '104'], [4400, '108'], [5000, '112']];
SCENES.s05_heritage = {
  cam: (L, D) => camPath([[0, 960, 560, 1.0], [L[0].s + 1.5, 1300, 560, 1.0], [L[1].s - 0.5, 1500, 560, 1.0], [L[1].s + 3.5, 2200, 560, 1.0], [L[2].s - 0.6, 2500, 560, 1.0], [L[2].s + 1.5, 3100, 580, 1.04], [L[3].s - 0.6, 3300, 560, 1.0], [L[3].s + 4.2, 4500, 560, 1.0], [D, 4650, 580, 1.05]]),
  draw(L, D) {
    const t = CUR.t;
    let s = skyGrad(-600, 6200);
    s += para(0.3, cloudsRow(1, [[300, 140, 1, 8], [1400, 100, 0.8, 6], [2600, 170, 1, 9], [3800, 120, 0.9, 7], [5000, 160, 1, 6]], [-400, 6200]));
    s += para(0.55, guanyinMountain(2400, 610, 1.1, prog(0, 2), '#e2e6d4') + guanyinMountain(4800, 630, 0.9, prog(0, 2), '#e6e8d6'));
    s += para(0.75, hills(660, prog(0, 1.5), '#e4e8c9', 6, 26, -600, 6400));
    s += ground(830, prog(0.2, 1), '#ece4cd', -600, 6400);
    s += ink(curve([[-400, 960], [1000, 950], [2400, 965], [3800, 950], [5600, 960]]), prog(0.3, 2), 2.4, INK2, 'stroke-dasharray="18 14"');
    YEARS.forEach(([x, y], i) => s += signpost(x, 960, 0.85, prog(0.5 + i * 0.12, 1), `${y}年`));
    // medallions of presidents and chairmen at their years
    const M = [[300, '李慶瑞', '第一、二屆會長', 'gray', '#c9b79e', true], [800, '黃金城', '第一、二屆理事長', 'short', '#b6c3b0'], [1900, '陳國泰', '第三、四屆理事長', 'short', '#d7c3a6', true],
      [2500, '顏永泉', '第五屆理事長', 'short', '#cfc0e0'], [3100, '陳國泰', '第六、七屆理事長', 'short', '#d7c3a6', true], [3800, '洪丰裕', '第八、九屆理事長', 'short', '#b9d4d0'],
      [4400, '沈玉文', '第十、十一屆理事長', 'short', '#e3b8c4'], [5000, '李國忠', '第十二屆理事長', 'short', '#c9d8b0', true]];
    M.forEach(([x, n, r, hair, shirt, gl], i) => {
      const hi = n === '陳國泰' && t > L[1].s && t < L[2].s ? 1 + 0.06 * Math.sin(t * 4) : 1;
      s += medallion(x, 450, 0.95 * hi, prog(0.6 + i * 0.35, 1.4), n, r, { hair, shirt, glasses: gl });
    });
    // advisory group arrives at 92
    for (let i = 0; i < 5; i++) s += walker(L[0].s + i * 0.3, 3.5, 700 - i * 90, 1150 + i * 70, 1080 + (i % 2) * 16, 0.95, { shirt: '#e9e2d0', hair: HAIRS[i], arms: t > L[0].s + 3.8 ? [0.2, -2.3] : undefined });
    s += op(eout(prog(L[0].s + 3.6, 0.8)), banner(1300, 790, 360, 1, '顧問團成立', 'Advisory group'));
    // Chen Kuo-tai era: members gathering
    for (let i = 0; i < 6; i++) s += person(1750 + i * 85, 1070 + (i % 2) * 14, 0.92, prog(L[1].s + 0.8 + i * 0.25, 0.8), { shirt: SHIRTS[i], hair: HAIRS[i], vest: i % 2 === 0, arms: t > L[1].s + 2.6 ? [-2.3 - 0.2 * Math.sin(t * 3 + i), 0.3] : undefined });
    // new hall at 101 with ribbon cutting
    s += hall(3100, 860, 0.95, prog(L[1].s + 3, 2.5), '堅山慈善會館');
    const cut = L[2].s + 2.2;
    if (t < cut) s += ink(`M2920 760Q3100 ${790 + 8 * Math.sin(t * 3)} 3280 760`, prog(L[2].s - 0.2, 0.8), 6, C.blood) + heart(3100, 790, 1, prog(L[2].s, 0.6));
    else s += ink(`M2920 760Q2990 790 3060 ${800 + 40 * eout(prog(cut, 0.6))}M3280 760Q3210 790 3140 ${800 + 40 * eout(prog(cut, 0.6))}`, 1, 6, C.blood);
    s += confetti(3100, 700, cut, 34, 340);
    for (let i = 0; i < 4; i++) s += person(2900 + i * 130, 1060, 1.0, prog(L[2].s + 0.2 + i * 0.15, 0.8), { shirt: SHIRTS[i + 2], hair: HAIRS[i + 2], vest: true, face: i < 2 ? 1 : -1, arms: t > cut ? [-2.2 - 0.2 * Math.sin(t * 5 + i), -2.2] : [0.2, 0.4] });
    // torch relay under the last three medallions
    const r0 = L[3].s - 0.4, pass1 = L[3].s + 1.6, pass2 = L[3].s + 3.6;
    const run = [[3800, 4250, r0, pass1, '#b9d4d0'], [4300, 4850, pass1 + 0.2, pass2, '#e3b8c4'], [4900, 5000, pass2 + 0.2, pass2 + 1.2, '#c9d8b0']];
    run.forEach(([x0, x1, a, b, shirt], i) => {
      const holding = (i === 0 && t < pass1) || (i === 1 && t >= pass1 && t < pass2) || (i === 2 && t >= pass2);
      const up = i === 2 && t > pass2 + 1.3 ? eout(prog(pass2 + 1.3, 0.6)) : 0;
      s += walker(a, b - a, x0, x1, 1040, 1.15, { shirt, hair: 'short', vest: true, arms: [0.2, holding ? -1.4 - 1.2 * up : undefined], hold: holding ? torch(44 - 24 * up, -118 - 70 * up, 0.8, 1) : '' });
    });
    s += sparkle(4990, 800, 1.2, prog(pass2 + 1.8, 0.4)) + sparkle(5060, 760, 0.9, prog(pass2 + 2, 0.4));
    s += flyBy(2, 30, 260, 200, 'magpie', 0.9, 1, -200, 6000);
    return s;
  },
  hud(L, D) {
    return op(hudFade(L[1].s + 0.6, L[2].s - 0.6), shape(rrect(1330, 40, 540, 180, 24), 1, '#fffaf0', 3) +
      txt(1600, 90, `會員 ${count(900, L[1].s + 0.8, 3)}+ 人`, 1, { size: 38, col: '#7a2f28', width: 270 }) + peopleIcons(1385, 140, Math.round(30 * prog(L[1].s + 0.8, 3)), 15, 26));
  },
};

// 6 — Emergency relief. Events: monthly visit rota; Chen Kuo-tai and Wu Hui-feng
// bring rice to a family; 88 cases across three areas; two funerals arranged.
SCENES.s06_relief = {
  cam: (L, D) => camPath([[0, 900, 560, 1.0], [L[1].s - 0.6, 1100, 560, 1.0], [L[1].s + 1.6, 2300, 560, 1.02], [L[2].s - 0.6, 2400, 580, 1.06], [L[2].s + 1.2, 4200, 520, 1.0], [L[3].s - 0.6, 4200, 520, 1.0], [L[3].s + 1.4, 6100, 560, 1.0], [D, 6100, 600, 1.08]]),
  draw(L, D) {
    const t = CUR.t;
    let s = skyGrad(-600, 3300);
    s += para(0.3, cloudsRow(1, [[200, 140, 1, 8], [1000, 110, 0.9, 6], [1900, 170, 1, 9], [2800, 130, 0.9, 7]], [-400, 3300]));
    s += ground(840, prog(0, 1), '#e9e0c8', -600, 3300);
    // an alley of townhouses
    [[150, 1.0, 3], [380, 1.05, 4], [610, 0.95, 3], [840, 1.0, 3], [1070, 1.02, 4], [1300, 0.98, 3]].forEach(([x, sc, f], i) => s += townhouse(x, 840, sc, prog(0.2 + i * 0.2, 1.6), { floors: f, h: f === 4 ? 320 : 260 }));
    s += oldHouse(2550, 860, 1.3, prog(0.6, 2), { doorOpen: eout(prog(L[1].s + 2.6, 1.2)), lit: true });
    s += tree(1850, 860, 1.1, prog(0.8, 1.4)) + tree(3050, 860, 1.0, prog(1, 1.4), 'palm');
    s += smoke(2700, 650, 0.7);
    // board members on their monthly round
    for (let i = 0; i < 3; i++) s += walker(0.6 + i * 0.4, L[1].s - 0.2, -100 - i * 110, 1500 - i * 110, 1020 + (i % 2) * 18, 1.05, { shirt: SHIRTS[i + 4], hair: HAIRS[i + 4], vest: true, hold: i === 0 ? `<g transform="translate(46 -86)">${shape(rect(-16, -22, 32, 40, 0.3), 1, '#fffaf0', 1.8)}${ink('M-10 -12h20M-10 -4h20M-10 4h14', 1, 1.2, INK2)}</g>` : '', arms: i === 0 ? [0.2, 0.9] : undefined });
    // Chen Kuo-tai and Wu Hui-feng
    const wa = L[1].s - 1.2, wb = L[1].s + 2.4;
    s += walker(wa, wb - wa, 1500, 2330, 1010, 1.15, { shirt: '#d7c3a6', hair: 'gray', glasses: true, vest: true, arms: [0.2, 0.9], hold: riceBag(62, -70, 0.9, 1) });
    s += walker(wa + 0.2, wb - wa - 0.2, 1360, 2190, 1022, 1.1, { shirt: '#e3b8c4', hair: 'bun', dress: true, vest: true, arms: [0.2, 0.9], hold: giftBox(62, -62, 0.85, 1) });
    const xc = lerp(1500, 2330, clamp((t - wa) / (wb - wa)) * 0.85 + ease(clamp((t - wa) / (wb - wa))) * 0.15);
    const xw = lerp(1360, 2190, clamp((t - wa - 0.2) / (wb - wa - 0.2)) * 0.85 + ease(clamp((t - wa - 0.2) / (wb - wa - 0.2))) * 0.15);
    s += nameTag(xc, 760, prog(L[1].s, 0.8), '前理事長 陳國泰', 'Former chairman Chen Kuo-tai');
    s += nameTag(xw - 40, 676, prog(L[1].s + 0.5, 0.8), '吳惠豐', 'Wu Hui-feng');
    s += person(2560, 1000, 1.05, eout(prog(L[1].s + 3.0, 0.8)), { shirt: '#d9cfc2', hair: 'gray', elder: true, face: -1, arms: t > L[1].s + 3.6 ? [-0.5, -1.2 - 0.3 * Math.sin(t * 3)] : undefined });
    s += person(2660, 1012, 0.95, eout(prog(L[1].s + 3.3, 0.8)), { kid: true, shirt: C.blue, hair: 'pony', face: -1 });
    s += hearts(2450, 760, L[1].s + 3.8, 6, 300);
    // map of the three areas served (its own space further right)
    s += `<rect x="3400" y="-300" width="1700" height="1700" fill="#f4ecdc"/>`;
    s += shape(rect(3450, -60, 1500, 1150, 1), prog(L[2].s - 1.6, 1), '#f7f0e0', 3);
    s += regionMap(4200, 560, 1.15, prog(L[2].s - 0.8, 1.6));
    const pins = [[-300, -120], [-220, -90], [-330, -60], [-90, 110], [40, 120], [-120, 160], [60, 20], [-10, -20], [220, 160], [300, 210], [180, 250]];
    pins.forEach(([px, py], i) => s += mapPin(4200 + px * 1.15, 560 + py * 1.15, 0.45, prog(L[2].s + 0.5 + i * 0.22, 0.6)));
    // memorial: two families' funerals arranged in full (gentle, no portraits)
    s += `<rect x="5100" y="-300" width="2200" height="1700" fill="#efe9de"/>`;
    s += shape(rect(5300, 200, 1600, 700, 1), prog(L[3].s - 1.2, 1), '#f6f2ea', 3);
    s += shape(rect(5800, 300, 600, 380, 0.6), prog(L[3].s - 0.8, 1), '#fbf9f3', 2.4) + txt(6100, 500, '安息', prog(L[3].s - 0.2, 1.2), { size: 64, col: INK2 });
    s += flowersVase(5660, 840, 1.3, prog(L[3].s - 0.6, 1.4)) + flowersVase(6540, 840, 1.3, prog(L[3].s - 0.4, 1.4));
    s += candle(5950, 850, 1, prog(L[3].s, 0.8)) + candle(6250, 850, 1, prog(L[3].s + 0.2, 0.8));
    s += shape(rect(5560, 850, 1080, 40, 0.5), prog(L[3].s - 0.6, 1), '#d9c3a0', 2.6);
    for (let i = 0; i < 5; i++) s += person(5800 + i * 125, 1080, 1.15, prog(L[3].s + 0.6 + i * 0.2, 0.8), { shirt: '#5f5a55', pants: '#3f3a36', hair: HAIRS[i], face: 1, smile: false, bow: t > L[3].s + 2.4 ? 0.6 + 0.4 * Math.sin(clamp((t - L[3].s - 2.4) / 2) * Math.PI) : 0 });
    s += steam(6100, 840, 0.7, 3);
    return s;
  },
  hud(L, D) {
    const t = CUR.t;
    const m = 1 + Math.floor(clamp((t - 0.6) / Math.max(1, L[1].s - 1.2)) * 11.99);
    let h = op(hudFade(0.6, L[1].s - 0.8), calendar2(1700, 220, 0.85, 1, '每月輪值訪視', `${m}月`, '理監事・會務人員'));
    h += op(hudFade(L[2].s + 0.2, L[3].s - 0.6), factCard(1600, 170, 1, String(count(88, L[2].s + 0.4, 2.6)), '件', '112年 急難救助個案', 'Emergency cases, 2023'));
    h += op(hudFade(L[3].s + 1.0), factCard(1600, 170, 1, '2', '戶', '清寒喪葬協助', 'Funerals arranged in full'));
    return h;
  },
};

// 7 — Blood drives at Guanyin Mountain. Events: two dates fill their tallies; total 763.
SCENES.s07_blood = {
  cam: (L, D) => camPath([[0, 900, 560, 1.0], [L[0].s, 1100, 560, 1.02], [D, 1300, 600, 1.08]]),
  draw(L, D) {
    const t = CUR.t;
    let s = skyGrad(-600, 3200);
    s += para(0.2, sun(2100, 180, 58, prog(0, 1.5)) + glowAt(2100, 180, 200));
    s += para(0.3, cloudsRow(prog(0, 1.2), [[200, 140, 1, 8], [900, 110, 0.8, 6], [1700, 200, 1, 9], [2500, 130, 0.9, 7]], [-300, 3200]));
    s += para(0.55, guanyinMountain(1200, 620, 1.3, prog(0, 2.5), '#dfe5cf'));
    s += flyBy(1.5, 12, 250, 200, 'magpie', 0.9, 1, -150, 3000);
    s += para(0.75, hills(700, prog(0.3, 1.5), '#e4e8c9', 6, 26, -300, 3300));
    s += ground(820, prog(0.3, 1.2), '#ece4cd', -400, 3400);
    s += tree(140, 840, 1.1, prog(0.8, 1.4)) + tree(2900, 840, 1.2, prog(0.8, 1.4)) + tree(2760, 830, 0.9, prog(1, 1.4), 'palm');
    s += gate(560, 960, 1.0, prog(0.6, 2.4), '觀音山風景區');
    s += busBlood(1180, 990, 0.95, prog(0.8, 2)) + busBlood(1720, 990, 0.95, prog(1.1, 2));
    s += contactShadow(1180, 994, 230) + contactShadow(1720, 994, 230);
    s += tent(2330, 1000, 0.95, prog(1, 2));
    s += table(2330, 1000, 1.0, prog(1.4, 1.2), 260);
    [2240, 2300, 2360, 2420].forEach((x, i) => s += cup(x, 920, 1.2, prog(2 + i * 0.2, 0.6)));
    s += person(2450, 1020, 1.0, prog(1.6, 1.2), { shirt: '#f2d6a2', hair: 'bun', vest: true, face: -1, arms: [0.2, -1.8 - 0.35 * Math.sin(t * 4)] });
    s += person(2180, 1030, 1.0, prog(1.8, 1.2), { shirt: '#c9d8b0', hair: 'short', vest: true, face: -1, arms: [0.2, 1.0], hold: cup(62, -80, 1, 1) });
    for (let i = 0; i < 7; i++) s += walker(0.5 + i * 2.2, 9, 200 - i * 20, 1250 + (i % 3) * 110, 1060 + (i % 2) * 20, 0.95, { shirt: SHIRTS[i], hair: HAIRS[i] });
    return s;
  },
  hud(L, D) {
    const t = CUR.t;
    const a = count(369, L[0].s - 0.6, 2.4), b = count(394, L[0].s + 1.2, 2.4);
    let h = '';
    h += op(eout(prog(L[0].s - 1, 0.6)), shape(rrect(260, 60, 340, 150, 22), 1, '#fffaf0', 3) + txt(430, 106, '112.03.19', 1, { size: 28, col: INK2 }) + txt(430, 180, `${a} 袋`, 1, { size: 60, col: C.blood, font: "'Noto Serif CJK TC', serif", weight: 900, width: 220 }));
    h += op(eout(prog(L[0].s + 0.8, 0.6)), shape(rrect(1320, 60, 340, 150, 22), 1, '#fffaf0', 3) + txt(1490, 106, '112.07.16', 1, { size: 28, col: INK2 }) + txt(1490, 180, `${b} 袋`, 1, { size: 60, col: C.blood, font: "'Noto Serif CJK TC', serif", weight: 900, width: 220 }));
    h += op(eout(prog(L[0].s + 3.6, 0.6)), factCard(960, 150, 1, String(count(763, L[0].s + 3.6, 1.6)), '袋', '112年 兩場捐血合計', 'Bags of blood, 2023'));
    for (let i = 0; i < 6; i++) h += bloodBag(680 + i * 112, 330, 0.8, eout(prog(L[0].s + 3.8 + i * 0.15, 0.4)), clamp(prog(L[0].s + 3.8, 1.6) * 6 - i));
    return h;
  },
};

// 8 — September care drive and November scholarships.
SCENES.s08_care = {
  cam: (L, D) => camPath([[0, 960, 560, 1.0], [L[0].s + 3.5, 1100, 580, 1.06], [L[1].s - 1.0, 1150, 580, 1.04], [L[1].s + 1.2, 3500, 560, 1.0], [D, 3520, 600, 1.08]]),
  draw(L, D) {
    const t = CUR.t;
    let s = skyGrad(-600, 4800);
    s += para(0.3, cloudsRow(1, [[300, 130, 1, 8], [1200, 100, 0.9, 6], [2400, 160, 1, 9], [3500, 120, 0.9, 7], [4300, 150, 1, 6]], [-400, 4800]));
    s += para(0.7, hills(640, prog(0, 1.5), '#e4e8c9', 5, 26, -600, 4800));
    s += ground(830, prog(0.1, 1), '#ece4cd', -600, 4800);
    // Renwu activity centre, 112.09.24
    s += hall(960, 850, 1.05, prog(0.2, 2.5), '仁武活動中心');
    const flags = [['仁武', '#e9a79c'], ['大樹', '#c9d8b0'], ['大社', '#9dbbd6'], ['鳥松', '#f2d6a2'], ['橋頭', '#cfc0e0']];
    flags.forEach(([n, col], i) => s += districtFlag(1320 + i * 112, 870, 1.0, prog(L[0].s + 0.4 + i * 0.3, 0.8), n, col));
    s += riceStack(1460, 1000, 1.0, prog(0.8, 1.2)) + riceStack(1700, 1000, 0.9, prog(1, 1.2), 5);
    s += table(1180, 1040, 1.0, prog(1, 1), 300);
    s += person(1240, 1010, 1.05, prog(1.2, 1), { shirt: '#c9d8b0', hair: 'short', vest: true, face: -1, arms: [0.2, 1.0], hold: riceBag(62, -70, 0.8, 1) });
    s += person(1110, 1012, 1.0, prog(1.4, 1), { shirt: '#f2d6a2', hair: 'bun', vest: true, face: -1, arms: [0.2, 1.0], hold: giftBox(62, -62, 0.8, 1) });
    for (let i = 0; i < 6; i++) {
      const t0 = 0.8 + i * 1.6;
      s += walker(t0, 4, -200 - i * 40, 1000 - i * 70, 1070, 1.0, { shirt: SHIRTS[(i + 2) % 8], hair: HAIRS[(i + 2) % 8], elder: i % 3 === 0, kid: i === 4, arms: t > t0 + 4.2 && i === 0 ? [0.2, 1.0] : undefined, hold: t > t0 + 4.4 && i === 0 ? riceBag(62, -70, 0.8, 1) : '' });
    }
    s += tree(2100, 850, 1.1, prog(0.6, 1.4)) + tree(2300, 846, 0.9, prog(0.8, 1.4), 'palm');
    // Wulin village community centre, 112.11.19: scholarship ceremony
    s += hall(3500, 790, 0.95, prog(L[0].s + 4, 2), '');
    s += dais(3500, 900, 1.0, prog(L[1].s - 1.2, 1.4), '清寒優秀學生獎助學金');
    const give = L[1].s + 1.6, k = eout(prog(give, 1.0));
    s += person(3340, 840, 1.1, prog(L[1].s - 0.6, 0.8), { shirt: '#c9d8b0', hair: 'short', vest: true, glasses: true, arms: [0.2, t > give - 0.6 ? 1.1 : undefined] });
    s += envelope(lerp(3410, 3480, k), 760 - Math.sin(k * Math.PI) * 18, 0.6, prog(give - 0.8, 0.6), '獎助學金');
    for (let i = 0; i < 5; i++) s += person(3460 + i * 80, 840, 0.95, prog(L[1].s - 0.4 + i * 0.15, 0.8), { kid: i % 2 === 0, shirt: ['#9dbbd6', '#fffaf0', '#e8c2b0', '#fffaf0', '#cfc0e0'][i], hair: ['pony', 'short', 'short', 'long', 'short'][i], face: -1, bow: i === 0 && t > give + 1 ? 0.6 * Math.sin(clamp((t - give - 1) / 1.4) * Math.PI) : 0, arms: i === 0 && t > give ? [0.2, 1.0] : undefined });
    // audience seen from behind, clapping
    for (let i = 0; i < 9; i++) {
      const x = 3080 + i * 105, clap = t > give + 0.6 ? Math.abs(Math.sin(t * 9 + i)) : 0;
      s += at(x, 1080 + (i % 2) * 10, 1.2, shape(ell(0, -60, 22, 24, 14), 1, C.hair, 2.4) + shape('M-34 0Q-30 -40 0 -42Q30 -40 34 0Z', 1, SHIRTS[i % 8], 2.4) + op(clap, ink(`M-26 -36l${-6 - clap * 6} -14M26 -36l${6 + clap * 6} -14`, 1, 4, C.skin)));
    }
    s += hearts(3500, 600, give + 1.0, 6, 400);
    return s;
  },
  hud(L, D) {
    let h = op(hudFade(L[0].s - 0.4, L[1].s - 1.2), calendar2(200, 300, 0.85, 1, '112 年', '9月24日', '五區清寒慰問'));
    h += op(hudFade(L[0].s + 1.6, L[1].s - 1.2), factCard(1600, 170, 1, String(count(670, L[0].s + 1.8, 2.6)), '戶', '仁武・大樹・大社・鳥松・橋頭', 'Low-income households, five districts'));
    h += op(hudFade(L[1].s + 0.2), calendar2(200, 300, 0.85, 1, '112 年', '11月19日', '烏林里社區活動中心'));
    h += op(hudFade(L[1].s + 2.4), factCard(1600, 170, 1, String(count(94, L[1].s + 2.6, 2)), '位', '大學・高中・國中・小學', 'Scholarship students, 2023'));
    return h;
  },
};

// 9 — Ending. Events: the year turns through monthly and quarterly care; seven become
// a thousand; a hand reaches out; the emblem with "keep love going".
SCENES.s09_ending = {
  cam: (L, D) => camPath([[0, 960, 560, 1.04], [L[1].s - 0.4, 960, 560, 1.0], [L[2].s - 0.4, 960, 560, 1.0], [L[2].s + 2, 1000, 600, 1.06], [L[3].s - 0.4, 960, 540, 1.0], [D, 960, 520, 1.03]]),
  draw(L, D) {
    const t = CUR.t;
    let s = `<rect x="-600" y="-600" width="3200" height="1500" fill="url(#duskGrad)"/>`;
    s += para(0.2, glowAt(1300, 560, 340) + sun(1300, 560, 120, prog(0, 1.6)));
    s += para(0.3, cloudsRow(prog(0, 1.2), [[300, 180, 1, 5], [1000, 120, 0.8, 4], [1700, 230, 1.1, 6]], [-300, 2300]));
    s += para(0.55, guanyinMountain(1100, 700, 1.1, prog(0.2, 2), '#e3d7bf'));
    s += flyBy(2, 12, 320, 250, 'small', 0.9, -1) + flyBy(2.4, 12, 350, 280, 'small', 0.7, -1) + flyBy(3, 12, 300, 260, 'small', 0.6, -1);
    s += ground(820, prog(0.3, 1), '#eadcc0');
    s += tree(160, 840, 1.1, prog(0.6, 1.4)) + tree(1820, 840, 1.1, prog(0.6, 1.4), 'palm');
    // L0: the year's wheel of care
    const wheelO = Math.min(eout(prog(0.4, 1.2)), 1 - eout(prog(L[1].s - 0.8, 0.8)));
    if (wheelO > 0) {
      let w = shape(circ(960, 380, 230, 28), 1, '#fffaf0', 3) + ink(circ(960, 380, 170, 28), 1, 1.6, C.gold);
      for (let i = 0; i < 12; i++) {
        const a = -Math.PI / 2 + i / 12 * Math.PI * 2 + t * 0.25;
        w += txt(960 + Math.cos(a) * 200, 390 + Math.sin(a) * 200, `${i + 1}月`, 1, { size: 22, width: 46 });
        if (i % 3 === 2) w += heart(960 + Math.cos(a) * 140, 380 + Math.sin(a) * 140, 0.7, 1, C.pink);
      }
      w += txt(960, 370, '每月救急', 1, { size: 34, col: '#7a2f28' }) + txt(960, 414, '每季關懷身障朋友', 1, { size: 24, col: INK2 });
      s += op(wheelO, w);
    }
    for (let i = 0; i < 4; i++) s += walker(0.5 + i * 0.6, L[1].s - 1, 2000 + i * 140, 1100 + i * 160, 1040 + (i % 2) * 16, 1.0, { shirt: SHIRTS[i], hair: HAIRS[i], vest: true, hold: i === 1 ? riceBag(62, -70, 0.8, 1) : '', arms: i === 1 ? [0.2, 0.9] : undefined });
    // L1: seven founders, then the crowd grows outward
    const g7 = Math.min(eout(prog(L[1].s - 0.2, 0.8)), 1 - eout(prog(L[2].s - 0.4, 0.6)));
    if (g7 > 0) {
      let crowd = '';
      const N = Math.round(lerp(7, 70, ease(prog(L[1].s + 1.6, 3))));
      for (let i = N - 1; i >= 0; i--) {
        const ring = i < 7 ? 0 : 1 + Math.floor((i - 7) / 16);
        const a = i < 7 ? (i - 3) * 0.22 : (i * 2.399);
        const r = ring === 0 ? 0 : 120 + ring * 70;
        const x = 960 + (ring === 0 ? (i - 3) * 70 : Math.cos(a) * r * 1.6), y = 1000 + (ring === 0 ? 0 : Math.sin(a) * r * 0.25 - 20);
        crowd += person(x, y, ring === 0 ? 1.05 : 0.7, i < 7 ? 1 : eout(clamp((N - i) / 4)), { shirt: i < 7 ? '#f2d6a2' : SHIRTS[i % 8], hair: HAIRS[i % 8], vest: i < 7, arms: [-2.3 - 0.2 * Math.sin(t * 3 + i), 0.3] });
      }
      s += op(g7, crowd);
    }
    // L2: a hand reaches out towards the viewer
    s += op(Math.min(eout(prog(L[2].s, 0.8)), 1 - eout(prog(L[3].s - 0.4, 0.6))), outstretchedHand(lerp(1500, 1280, eout(prog(L[2].s, 1.4))), 900, 2.2, prog(L[2].s, 1.2)) + hearts(1180, 700, L[2].s + 1, 5, 200));
    // L3: emblem and invitation
    const cp = prog(L[3].s - 0.2, 1.6);
    s += op(eout(cp), shape(circ(960, 360, 170, 28), 1, '#fffaf0', 2.4));
    s += kianshanLogo(960, 360, 1.0, prog(L[3].s, 2));
    for (let i = 0; i < 10; i++) {
      const a = t * 0.5 + i / 10 * Math.PI * 2;
      s += heart(960 + Math.cos(a) * 260, 360 + Math.sin(a) * 190, 0.9, eout(prog(L[3].s + 0.2 + i * 0.1, 0.6)), i % 2 ? C.red : C.pink);
    }
    s += op(eout(prog(L[3].s + 0.4, 1)), shape(rrect(620, 590, 680, 110, 24), 1, '#fffaf0', 3));
    s += txt(960, 660, '邀您一起 · 讓愛延續', prog(L[3].s + 0.6, 1.8), { size: 52, col: '#7a2f28' });
    for (let i = 0; i < 4; i++) s += person([300, 470, 1450, 1620][i], 1040, 1.0, prog(L[3].s + 0.4 + i * 0.2, 0.8), { shirt: SHIRTS[i + 3], hair: HAIRS[i + 3], vest: true, face: i < 2 ? 1 : -1, arms: [-2.3 - 0.2 * Math.sin(t * 3 + i), -2.3 - 0.2 * Math.sin(t * 3 + i + 1)] });
    return s;
  },
  hud(L, D) {
    const n = Math.round(lerp(7, 1000, ease(prog(L[1].s + 1.6, 3))));
    return op(hudFade(L[1].s + 0.4, L[2].s - 0.6), shape(rrect(1440, 60, 420, 120, 24), 1, '#fffaf0', 3) + txt(1650, 140, n >= 1000 ? '1000+ 位會員' : `${n} 位`, 1, { size: 46, col: '#7a2f28', width: 340 }));
  },
};

// 10 — End card with emblem, contact, related bodies, sources and credits.
SCENES.s10_endcard = {
  cam: (L, D) => camPath([[0, 960, 540, 1.0], [D, 960, 540, 1.03]]),
  draw(L, D) {
    let s = `<rect x="-200" y="-200" width="2400" height="1500" fill="#f1e2c4" fill-opacity="0.35"/>`;
    s += cloudsRow(prog(0, 1), [[240, 140, 0.8, 6], [1700, 170, 0.9, 7]], [-300, 2300]);
    s += hills(960, prog(0, 1.2), '#e6e2c6', 4, 26);
    s += kianshanLogo(960, 190, 0.92, prog(0.2, 2));
    s += txt(960, 356, '高雄市堅山慈善會', prog(1, 1.4), { size: 60, spacing: 4 });
    s += txt(960, 398, 'Kaohsiung Jianshan Charity Association · since 1997', prog(1.6, 1.2), { size: 24, italic: true, latin: true, font: SERIF_EN, weight: 400, col: INK2, width: 620 });
    s += txt(960, 446, '高雄市仁武區仁林路267巷1弄19號　電話 (07) 374-8339', prog(2, 1.2), { size: 28, font: "'Noto Sans CJK TC', sans-serif", weight: 400, col: INK2, width: 760 });
    s += agencyBadge(420, 570, 0.78, prog(2.6, 1.4), 'social', '高雄市政府社會局', 'Social Affairs Bureau, Kaohsiung');
    s += agencyBadge(960, 570, 0.78, prog(2.9, 1.4), 'blood', '台灣血液基金會 高雄捐血中心', 'Kaohsiung Blood Center');
    s += agencyBadge(1500, 570, 0.78, prog(3.2, 1.4), 'volunteer', '高雄市志願服務資源中心', 'Kaohsiung Volunteer Service Center');
    const src = '資料來源：高雄市堅山慈善會會刊（會史、歷屆幹部、112年度會務報告、113年度工作計畫、章程）';
    s += txt(960, 690, src, prog(4, 1.6), { size: 22, font: "'Noto Sans CJK TC', sans-serif", weight: 400, col: INK2 });
    s += txt(960, 726, '中華捐血運動協會、高雄市志願服務資源中心、高雄市政府社會局福利地圖', prog(4.4, 1.6), { size: 22, font: "'Noto Sans CJK TC', sans-serif", weight: 400, col: INK2 });
    s += txt(960, 766, '畫面：程式繪製 SVG 手繪線稿 ｜ 旁白：Gemini TTS 語音合成 ｜ 配樂與音效：原創合成', prog(4.8, 1.6), { size: 22, font: "'Noto Sans CJK TC', sans-serif", weight: 400, col: INK2 });
    s += walker(0, D, -100, 2000, 1040, 0.8, { shirt: '#c9d8b0', hair: 'short', vest: true }) + walker(0.4, D, -220, 1880, 1050, 0.62, { kid: true, shirt: C.blue, hair: 'pony' });
    s += flyBy(2, 10, 300, 240, 'magpie', 0.8, -1);
    return s;
  },
};
