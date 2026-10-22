// 鏡頭表：10 顆 × 7 秒 = 70 秒。
// 每顆從小物件特寫開始（靜止約 1 秒）→ 中段加速拉遠 → 結尾放慢落在全景。
// 物件位置一律從 layout.focusPoints() 讀取。
//
// 鏡頭位置 = 目標點 + 方向 × 距離：
//   方向以「方位角（由北順時針）、仰角」表示，是從目標點看向鏡頭的方向；
//   距離在對數空間插值（近距離時移動慢、遠距離時移動快，看起來是等速倍率拉遠）。
import { focusPoints, video } from './layout.js';

const F = focusPoints();
const DEG = Math.PI / 180;
const HOLD = 0.9; // 開頭停在特寫的秒數

export const shots = [
  { name: '石燈籠 → 山門', focus: F.toro,
    near: { az: 15, el: 4, dist: 0.85 }, far: { look: [0, 6, 68], az: 340, el: 16, dist: 42 }, fov: [34, 42], aperture: 0.018 },
  { name: '蓮花 → 蓮池與拱橋', focus: F.heroLotus,
    near: { az: 165, el: 24, dist: 0.7 }, far: { look: [0, 1.5, 28], az: 200, el: 26, dist: 44 }, fov: [34, 42], aperture: 0.02 },
  { name: '風鈴 → 五重塔', focus: F.chime,
    near: { az: 205, el: 4, dist: 0.75 }, far: { look: [36, 14, -8], az: 218, el: 10, dist: 62 }, fov: [34, 40], aperture: 0.02 },
  { name: '佛像的臉 → 佛像與主殿', focus: F.buddhaFace,
    near: { az: 184, el: 2, dist: 1.0 }, far: { look: [-21, 6, -17], az: 158, el: 14, dist: 66 }, fov: [32, 42], aperture: 0.014 },
  { name: '大提燈 → 山門正面', focus: F.chochin,
    near: { az: 178, el: -6, dist: 3.1 }, far: { look: [0, 7, 64], az: 186, el: 9, dist: 50 }, fov: [36, 42], aperture: 0.01 },
  { name: '擬寶珠 → 逆光拱橋', focus: F.giboshi,
    near: { az: 130, el: 8, dist: 0.6 }, far: { look: [0, 1.5, 30], az: 85, el: 16, dist: 46 }, fov: [34, 42], aperture: 0.022 },
  { name: '吊燈籠 → 主殿正面', focus: F.hallLantern,
    near: { az: 150, el: -8, dist: 0.95 }, far: { look: [0, 8, -34], az: 190, el: 8, dist: 58 }, fov: [34, 44], aperture: 0.016 },
  { name: '相輪寶珠 → 塔與主殿俯瞰', focus: F.finial,
    near: { az: 232, el: 6, dist: 2.4 }, far: { look: [20, 9, -16], az: 205, el: 22, dist: 100 }, fov: [34, 42], aperture: 0.01 },
  { name: '錦鯉 → 越池望主殿', focus: F.koiSpot, lookExp: 1.35, // 池塘分區依此曲線安排錦鯉經過時間
    near: { az: 180, el: 62, dist: 1.3 }, far: { look: [0, 5, -12], az: 176, el: 18, dist: 82 }, fov: [36, 42], aperture: 0.012 },
  { name: '逆光楓葉 → 空拍全寺', focus: F.maple,
    near: { az: 67.5, el: -6, dist: 0.55 }, far: { look: [4, 0, 6], az: 150, el: 46, dist: 170 }, fov: [36, 46], aperture: 0.024 },
];

// cubic-bezier(x1, y1, x2, y2) 時間曲線（同 CSS），以二分法解 x → y
function bezier(x1, y1, x2, y2) {
  const B = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (B(x1, x2, m) < x) lo = m; else hi = m; }
    return B(y1, y2, (lo + hi) / 2);
  };
}
// 緩起、中段快、長長的收尾
const ease = bezier(0.55, 0.0, 0.18, 1.0);

/** 鏡頭內進度：前 HOLD 秒幾乎靜止（極慢推移），之後依時間曲線前進。 */
export function shotProgress(local) {
  const T = video.shotSeconds;
  if (local < HOLD) return 0.004 * (local / HOLD);
  return 0.004 + 0.996 * ease((local - HOLD) / (T - HOLD));
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const dirOf = (az, el) => [Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), -Math.cos(az * DEG) * Math.cos(el * DEG)];
const angLerp = (a, b, t) => { let d = ((b - a + 540) % 360) - 180; return a + d * t; };

/** 影片時間 t（秒）→ { pos, look, fov, focus, aperture, shot, local } */
export function cameraAt(t) {
  const T = video.shotSeconds;
  const i = Math.min(shots.length - 1, Math.max(0, Math.floor(t / T)));
  const local = t - i * T;
  const s = shots[i];
  const e = shotProgress(local);
  // 視線目標比鏡頭距離晚一點才移向全景，特寫物件在拉遠初段留在畫面內
  const look = lerp3(s.focus, s.far.look, Math.pow(e, s.lookExp ?? 3.0));
  const az = angLerp(s.near.az, s.far.az, e);
  const el = lerp(s.near.el, s.far.el, e);
  const dist = s.near.dist * Math.pow(s.far.dist / s.near.dist, e);
  const d = dirOf(az, el);
  const pos = look.map((v, k) => v + d[k] * dist);
  return {
    pos, look, dist,
    fov: lerp(s.fov[0], s.fov[1], e),
    focus: dist,
    aperture: s.aperture * (1 - e) ** 2.5,
    near: Math.min(0.05, dist * 0.05),
    shot: i, local,
  };
}

export const duration = shots.length * video.shotSeconds;
