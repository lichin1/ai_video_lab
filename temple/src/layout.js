// 場景平面圖 Site plan — 唯一的座標來源。所有其他程式都只能從這裡讀位置與尺寸。
//
// 單位：公尺。座標系（three.js 慣例，右手系）：
//   +X = 東   -X = 西
//   +Y = 上   地面基準 y = 0
//   +Z = 南   -Z = 北
// 寺院坐北朝南：參拜者由南方山門進入，經拱橋越過蓮花池，抵達北側主殿；五重塔在東側。
// 每個建築的 rotY 是繞 Y 軸的弧度，0 表示「正面朝 +Z（南）」。
//
// 這份檔案只放資料與由資料推導出的純函式，不碰 three.js。

const DEG = Math.PI / 180;

// ── 太陽：西南西，地平線上方約 7°，暖色光 ────────────────────────────
// 方位角由北順時針量：西南西 = 247.5°。
export const sun = {
  azimuthDeg: 247.5,
  elevationDeg: 7,
  color: 0xffb070,      // 暖橘色直射光
  intensity: 3.2,
  skyColor: 0xffc890,   // 半球光：天空側
  groundColor: 0x3a2a3a, // 半球光：地面側（暮色帶紫）
  hemiIntensity: 0.55,
  distance: 400,        // 平行光光源放置距離（只影響陰影相機）
};

/** 指向太陽的單位向量 [x, y, z]（世界座標）。 */
export function sunDirection() {
  const az = sun.azimuthDeg * DEG;
  const el = sun.elevationDeg * DEG;
  // 北 = -Z、東 = +X：方位角 θ 的水平方向 = (sin θ, -cos θ)
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
}

// ── 地形 ────────────────────────────────────────────────────────────
export const terrain = {
  size: 1200,            // 地形網格邊長（以原點為中心的正方形）
  // 寺域：平坦的境內，y = 0。範圍內不允許起伏（池塘挖洞除外）。
  precinct: { xMin: -70, xMax: 70, zMin: -70, zMax: 105 },
  precinctBlend: 30,     // 寺域邊界外往山丘過渡的距離
  // 後山：北、東、西三面的山丘；南面較低平，留給鏡頭往北看的空間。
  hills: [
    { x: 0, z: -230, radius: 190, height: 70 },
    { x: -200, z: -150, radius: 150, height: 55 },
    { x: 210, z: -170, radius: 160, height: 60 },
    { x: 260, z: 40, radius: 140, height: 35 },
    { x: -280, z: 60, radius: 150, height: 30 },
  ],
  // 遠山剪影（只做輪廓，霧中）
  farRidges: [
    { radius: 520, height: 120, seed: 'ridge-a' },
    { radius: 580, height: 160, seed: 'ridge-b' },
  ],
  // 境內圍牆（築地塀）：沿寺域邊界，山門處留開口
  wall: { height: 2.6, thickness: 1.0, gateGap: 18 },
};

// ── 參道與步道（折線，寬度 w） ─────────────────────────────────────
export const paths = [
  { id: 'approach-south', w: 5, pts: [[0, 140], [0, 76]] },               // 山門外
  { id: 'approach-gate-to-bridge', w: 5, pts: [[0, 64], [0, 44]] },       // 山門 → 橋南端
  { id: 'approach-bridge-to-hall', w: 6, pts: [[0, 16], [0, -16]] },      // 橋北端 → 主殿階前
  { id: 'to-pagoda', w: 3, pts: [[0, 2], [20, 2], [34, -2]] },            // 往五重塔
  { id: 'to-buddha', w: 3, pts: [[0, 2], [-20, 2], [-32, -2]] },          // 往露座佛像
];

// ── 山門（二層樓門）──────────────────────────────────────────────────
export const sanmon = {
  pos: [0, 0, 70],
  rotY: 0,
  width: 16,          // 東西向（五開間）
  depth: 8,           // 南北向
  bays: 5,
  baseHeight: 0.6,    // 石基壇
  firstStoryHeight: 5.5,
  secondStoryHeight: 4.2,
  roofHeight: 4.5,    // 屋頂本體高度
  totalHeight: 15.5,  // 含屋脊
  eaveOverhang: 2.6,
  // 中央開間懸掛的大提燈（chōchin）：中心點與尺寸
  chochin: { pos: [0, 3.6, 71.5], radius: 1.1, height: 2.6 },
};

// ── 蓮花池（橢圓）──────────────────────────────────────────────────
export const pond = {
  center: [0, 0, 30],
  rx: 30,               // 東西半徑
  rz: 13,               // 南北半徑
  waterLevel: -0.35,    // 水面高度
  depth: 1.4,           // 水面下最深處
  shoreWidth: 2.0,      // 岸邊石塊帶寬度
  // 蓮花聚落（避開橋所在的 |x| < 4 帶）
  lotusClusters: [
    { x: -18, z: 26, r: 6, count: 26, seed: 'lotus-w1' },
    { x: -9, z: 35, r: 4, count: 14, seed: 'lotus-w2' },
    { x: 14, z: 24, r: 5.5, count: 22, seed: 'lotus-e1' },
    { x: 21, z: 34, r: 4.5, count: 16, seed: 'lotus-e2' },
  ],
  // 主角蓮花（鏡頭 2 的特寫對象），花心位置
  heroLotus: { x: -7.5, z: 27.5, bloomHeight: 0.55 },
  koi: { count: 14, seed: 'koi', swimRadius: 0.8 /* 相對於橢圓的比例 */ },
};

/** 點 (x, z) 是否在池內（含岸邊帶以外的水域）。 */
export function inPond(x, z, margin = 0) {
  const dx = (x - pond.center[0]) / (pond.rx + margin);
  const dz = (z - pond.center[2]) / (pond.rz + margin);
  return dx * dx + dz * dz < 1;
}

// ── 拱橋（太鼓橋），南北向跨過池塘 ────────────────────────────────
export const bridge = {
  center: [0, 0, 30],
  rotY: 0,             // 橋身沿 Z 軸
  span: 30,            // 兩端著地點距離（z = 15 ~ 45），大於池南北直徑 26
  width: 3.2,
  rise: 3.6,           // 橋面中央比兩端高多少
  deckThickness: 0.35,
  railHeight: 1.0,
  postsPerSide: 9,     // 每側欄杆柱數（含兩端），柱頭有青銅擬寶珠（giboshi）
  pierRows: 3,         // 水中橋墩排數
};

/** 橋面中心線在參數 s ∈ [0,1]（南端 0 → 北端 1）時的 [x, y, z]，y 為橋面頂。 */
export function bridgeDeckPoint(s) {
  const [cx, cy, cz] = bridge.center;
  const z = cz + bridge.span / 2 - s * bridge.span;
  const y = cy + bridge.rise * Math.sin(Math.PI * s) ** 0.85;
  return [cx, y, z];
}

/** 第 i 根欄杆柱（side = -1 西側、+1 東側）柱頭擬寶珠的中心。 */
export function giboshiPoint(i, side) {
  const s = i / (bridge.postsPerSide - 1);
  const [x, y, z] = bridgeDeckPoint(s);
  return [x + side * (bridge.width / 2 - 0.1), y + bridge.railHeight + 0.18, z];
}

// ── 主殿（本堂）────────────────────────────────────────────────────
export const hall = {
  pos: [0, 0, -34],
  rotY: 0,
  width: 30,            // 東西（七開間）
  depth: 20,            // 南北（五開間）
  baysX: 7,
  baysZ: 5,
  platformHeight: 1.4,  // 石造基壇
  platformMargin: 3,    // 基壇比柱列外擴
  columnHeight: 6.5,
  columnRadius: 0.38,
  bracketHeight: 1.6,   // 斗栱層
  eaveOverhang: 4.5,
  roofHeight: 9.0,      // 屋頂本體（入母屋造）
  totalHeight: 19.5,    // 含屋脊與鴟尾
  stairWidth: 8,        // 正面中央階梯
  // 簷下懸掛的青銅吊燈籠（tsuri-dōrō），x 座標，掛在正面簷下
  hangingLanterns: { xs: [-12.86, -4.29, 4.29, 12.86], z: -34 + 10 + 2.0, y: 6.8 }, // 開間中央
};

// ── 露座青銅佛像（主殿西南，供鏡頭 4 特寫佛臉）────────────────────
export const buddha = {
  pos: [-32, 0, -4],
  rotY: 20 * DEG,       // 微微朝向參道
  pedestalHeight: 2.2,  // 蓮台 + 石座
  seatedHeight: 4.2,    // 坐姿佛身（含頭）
  faceHeight: 2.2 + 3.55, // 佛臉中心離地高度
  faceForward: 0.95,    // 佛臉中心相對於佛身中心往正面的位移
};

/** 佛臉中心的世界座標。 */
export function buddhaFacePoint() {
  const [x, , z] = buddha.pos;
  return [x + Math.sin(buddha.rotY) * buddha.faceForward, buddha.faceHeight, z + Math.cos(buddha.rotY) * buddha.faceForward];
}

// ── 五重塔 ─────────────────────────────────────────────────────────
export const pagoda = {
  pos: [36, 0, -8],
  rotY: 0,
  baseHeight: 1.0,       // 石基壇
  baseSize: 9.5,         // 基壇邊長
  // 每層：軸部寬度、軸部高度、出簷。由下往上逐層縮小（逓減）。
  stories: [
    { width: 6.6, height: 3.4, eave: 2.9 },
    { width: 6.0, height: 2.9, eave: 2.7 },
    { width: 5.4, height: 2.8, eave: 2.5 },
    { width: 4.8, height: 2.7, eave: 2.3 },
    { width: 4.2, height: 2.6, eave: 2.1 },
  ],
  roofHeight: 1.5,       // 每層屋頂本體厚度（含垂木）
  sorinHeight: 9.0,      // 相輪（含九輪與寶珠）
  chimeDrop: 0.55,       // 風鈴吊在簷角下方的距離
};
// 總高 = 基壇 + 各層軸部 + 各層屋頂 + 相輪 = 31.9 m
pagoda.totalHeight = pagoda.baseHeight + pagoda.stories.reduce((a, s) => a + s.height, 0)
  + pagoda.stories.length * pagoda.roofHeight + pagoda.sorinHeight;

/** 第 k 層（0 = 最下層）屋頂簷口的高度。 */
export function pagodaEaveY(k) {
  let y = pagoda.pos[1] + pagoda.baseHeight;
  for (let i = 0; i <= k; i++) y += pagoda.stories[i].height + (i < k ? pagoda.roofHeight : 0);
  return y;
}

/** 第 k 層四個簷角的世界座標（東南、西南、西北、東北），風鈴掛在這下方 chimeDrop 處。 */
export function pagodaEaveCorners(k) {
  const st = pagoda.stories[k];
  const h = st.width / 2 + st.eave;
  const y = pagodaEaveY(k) + 0.35; // 簷角起翹
  const [x, , z] = pagoda.pos;
  return [[x + h, y, z + h], [x - h, y, z + h], [x - h, y, z - h], [x + h, y, z - h]];
}

/** 相輪頂端（寶珠）位置。 */
export function pagodaFinialPoint() {
  const [x, y, z] = pagoda.pos;
  return [x, y + pagoda.totalHeight, z];
}

// ── 石燈籠（tōrō）：參道兩側成對 ──────────────────────────────────
export const toro = {
  height: 2.4,
  fireboxHeight: 1.75,   // 火袋中心離地高度
  positions: [
    [-4.5, 0, 94], [4.5, 0, 94],
    [-4.5, 0, 84], [4.5, 0, 84],
    [-4.5, 0, 58], [4.5, 0, 58],
    [-5.5, 0, 10], [5.5, 0, 10],
    [-5.5, 0, -2], [5.5, 0, -2],
    [28, 0, 3], [44, 0, 3],      // 塔前
    [-26, 0, 3],                 // 佛像前
  ],
  heroIndex: 4,                  // 鏡頭 1 特寫的那一座：山門內西側
};

// ── 樹木 ──────────────────────────────────────────────────────────
export const trees = {
  // 紅葉楓（主角樹種），每棵：位置、樹高、樹冠半徑
  maples: [
    { pos: [-14, 0, 52], height: 7.5, crown: 4.5 },
    { pos: [15, 0, 50], height: 8.0, crown: 5.0 },
    { pos: [-38, 0, 30], height: 9.0, crown: 5.5 },
    { pos: [38, 0, 42], height: 7.0, crown: 4.5 },
    { pos: [-22, 0, 8], height: 6.5, crown: 4.0 },
    { pos: [52, 0, 8], height: 8.5, crown: 5.0 },
    { pos: [-50, 0, -20], height: 9.5, crown: 6.0 },
    { pos: [20, 0, -52], height: 8.0, crown: 5.0 },
    { pos: [-24, 0, -56], height: 8.0, crown: 5.0 },
    { pos: [-46, 0, 60], height: 7.0, crown: 4.5 },
  ],
  heroMaple: 4,      // 鏡頭 10 逆光特寫的那棵（佛像與池之間）
  // 黑松：散植於池畔與境內
  pines: [
    { pos: [-30, 0, 44], height: 7, crown: 4 },
    { pos: [30, 0, 18], height: 6.5, crown: 3.5 },
    { pos: [-56, 0, 20], height: 9, crown: 4.5 },
    { pos: [58, 0, -30], height: 10, crown: 5 },
    { pos: [-10, 0, 62], height: 6, crown: 3 },
    { pos: [10, 0, 62], height: 6, crown: 3 },
  ],
  // 背景杉林：沿北、東、西寺域外帶狀散佈（數量 / 帶狀區域）
  forestBands: [
    { xMin: -160, xMax: 160, zMin: -150, zMax: -78, count: 420, seed: 'forest-n' },
    { xMin: 78, xMax: 170, zMin: -78, zMax: 110, count: 260, seed: 'forest-e' },
    { xMin: -170, xMax: -78, zMin: -78, zMax: 110, count: 260, seed: 'forest-w' },
  ],
  // 植樹禁區：建築、池、參道周圍不放樹（以矩形 [xMin, xMax, zMin, zMax] 表示）
  keepOut: [
    [-20, 20, -52, -14],   // 主殿 + 基壇
    [27, 45, -17, 1],      // 五重塔
    [-12, 12, 63, 77],     // 山門
    [-37, -27, -9, 1],     // 佛像
    [-4, 4, -20, 150],     // 中軸參道
  ],
};

// ── 鏡頭焦點（特寫物件）：由上面的資料推導，鏡頭程式只讀這裡 ──────
export function focusPoints() {
  const [tx, , tz] = toro.positions[toro.heroIndex];
  const m = trees.maples[trees.heroMaple];
  return {
    toro: [tx, toro.fireboxHeight, tz],
    heroLotus: [pond.heroLotus.x, pond.waterLevel + pond.heroLotus.bloomHeight, pond.heroLotus.z],
    chime: (() => { const c = pagodaEaveCorners(0)[1]; return [c[0], c[1] - pagoda.chimeDrop - 0.25, c[2]]; })(),
    buddhaFace: buddhaFacePoint(),
    chochin: [...sanmon.chochin.pos],
    giboshi: giboshiPoint(2, -1),
    hallLantern: [hall.hangingLanterns.xs[1], hall.hangingLanterns.y - 0.6, hall.hangingLanterns.z],
    finial: pagodaFinialPoint(),
    koiSpot: [9, pond.waterLevel, 33],
    maple: [m.pos[0] + 1.2, m.height * 0.62, m.pos[2] + 2.2],
    // 整座寺院的視覺中心（大部分拉遠鏡頭的終點目標）
    precinctCenter: [4, 6, 10],
  };
}

export const video = { fps: 30, width: 1920, height: 1080, shotSeconds: 7, shots: 10 };
