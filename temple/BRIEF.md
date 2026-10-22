# 施工規範（給六個施工分區）

黃昏時刻的日本寺院，three.js 0.180，最後逐格渲染成 70 秒影片（10 顆鏡頭 × 7 秒，1920×1080，30 fps）。

## 鐵則

1. **不准用任何 3D 模型、貼圖或照片。** 不 import 任何 .glb/.obj/.png/.jpg。幾何全部用程式建（BufferGeometry、Lathe、Extrude、Tube、合併幾何、InstancedMesh…），紋理只能用 canvas 或 shader 程式產生。
2. **座標只從 `src/layout.js` 讀。** 位置、尺寸、高度都 import 自 layout（例如 `hall.width`、`pagodaEaveCorners(k)`、`bridgeDeckPoint(s)`）。不准在你的檔案裡寫死任何世界座標。物件內部的細部比例（例如斗栱的長寬）可以自己定，但整體外框必須等於 layout 的數字。
3. **只能改自己的檔案**：`src/zones/<你的分區>.js`。如果檔案太大，可以另外新增 `src/zones/<你的分區>/*.js` 子模組。**不准改** layout.js、materials.js、rng.js、ground.js、main.js、sky.js、shots.js、其他人的檔案。發現共用檔有問題，寫在最後的回報裡。
4. **共用材質一律用 `src/materials.js` 的 `mat`**：朱漆 `mat.vermilion`、金箔 `mat.gold`、青銅 `mat.bronze`、屋瓦 `mat.roofTile`、木頭 `mat.wood`，另有 `mat.stone`、`mat.plaster`、`mat.paper`（發光和紙）、`mat.flame`。不准修改它們；需要不同 repeat 用 `scaled(mat.wood, u, v)`，需要別的變化就 `.clone()` 後改副本。分區專屬的材質（水、荷葉、楓葉、草…）可以在自己檔案內建立。
5. **亂數一律用固定種子**：`import { makeRng, makeNoise2D, fbm } from '../rng.js'`，`const r = makeRng('pond-koi')`。禁止 `Math.random()`、`Date.now()`、`performance.now()`。每次打開長得一模一樣。
6. **動畫只能是時間 t 的純函式**：`update(t)` 拿到影片時間（秒，0–70），畫面只能由 t 決定（不能累加上一格的狀態），因為影片是多個程序跳著渲染的。
7. 不要 git commit（統籌者會收）。

## 模組介面

```js
// src/zones/pond.js
import * as THREE from 'three';
import { pond } from '../layout.js';
import { mat } from '../materials.js';
import { makeRng } from '../rng.js';
import { heightAt } from '../ground.js';

export default function build({ scene, camera, renderer }) {   // 可以是 async
  const group = new THREE.Group();
  // ... 建造 ...
  return { object: group, update(t, camera) { /* 動畫 */ } };
}
```

- 座標系：+X 東、+Y 上、+Z 南，單位公尺。建築 `rotY = 0` 表示正面朝 +Z（南）。
- 地面高度：`heightAt(x, z)`（`src/ground.js`）。寺域內是 y = 0 的平地，池塘處下凹。
- 陰影：自己設定 `castShadow` / `receiveShadow`（預設都是 false）。小東西（葉片、瓦片細節）不要 castShadow 以省效能，建築主體、樹幹、樹冠要。
- 光源：太陽與天光已由 main.js 處理（西南西、仰角 7°，暖色）。燈籠請用發光材質（`mat.paper`、`mat.flame`），bloom 會讓它發光。每個分區**最多 1 盞** `PointLight`（不可投影），放在最需要的地方。
- 效能（軟體 WebGL 渲染，四核 CPU）：大量重複物件用 `InstancedMesh` 或 `mergeGeometries`（`three/addons/utils/BufferGeometryUtils.js`）。三角形預算見下表；draw call 盡量 < 150／分區。
- 細節要經得起特寫：每顆鏡頭都從 0.5–2 公尺距離的特寫開始（見下方焦點清單），那個物件必須精緻。

## 分區分工

| 分區 | 檔案 | 內容 | 三角形預算 |
|---|---|---|---|
| 地形 | `zones/terrain.js` | 地面網格（用 heightAt）、草地與砂石的程式紋理、參道石板、寺域圍牆（築地塀，山門處開口）、遠山剪影、所有石燈籠（`toro.positions`，火袋發光，`toro.heroIndex` 那座要特別精緻）、池塘的岸石帶（`pond.shoreWidth`）。 | 500k |
| 池塘 | `zones/pond.js` | 水面（反射暮色天空與太陽、細微波紋、t 驅動）、池底、蓮葉與蓮花（`pond.lotusClusters`、主角 `pond.heroLotus` 要精緻到花瓣與花蕊）、錦鯉（`pond.koi`，紅白、橘、金，水面下游動，t 驅動，`focusPoints().koiSpot` 附近要有幾隻經過）。不要碰橋與岸石。 | 400k |
| 主殿 | `zones/hall.js` | 主殿（`hall`）：石基壇、正面階梯、朱漆柱、白壁與門扉、斗栱、雙層垂木、入母屋屋頂（本瓦葺、簷角起翹、金色鴟尾）、四盞青銅吊燈籠（`hall.hangingLanterns`）。另外負責露座青銅佛像（`buddha`，蓮台 + 石座 + 坐佛 + 光背；佛臉 `buddhaFacePoint()` 是鏡頭 4 的特寫，五官要細緻，慈悲微笑、半閉眼、螺髮、白毫）。 | 900k |
| 五重塔 | `zones/pagoda.js` | 五重塔（`pagoda`）：基壇、五層軸部（朱漆柱、白壁、門）、每層斗栱與深簷、屋瓦、簷角起翹、相輪（九輪、水煙、寶珠，`pagodaFinialPoint()`）、每層四角的青銅風鈴（`pagodaEaveCorners(k)` 下方 `pagoda.chimeDrop`，風鈴舌與短冊，隨風輕擺，t 驅動）。 | 600k |
| 拱橋 | `zones/bridge.js` | 太鼓橋（`bridge`，橋面曲線用 `bridgeDeckPoint(s)`）：朱漆橋身、欄杆、`giboshiPoint(i, side)` 的青銅擬寶珠、水中橋墩、兩端石座。另外負責山門（`sanmon`）：二重門、五開間、上層高欄、入母屋屋頂、中央大紅提燈（`sanmon.chochin`，鏡頭 5 特寫，竹骨與黑色上下框要清楚）。 | 600k |
| 樹木 | `zones/trees.js` | 紅葉楓（`trees.maples`，以紅、朱、橙、黃漸層，葉片要有形狀，`trees.heroMaple` 那棵是鏡頭 10 逆光特寫：葉脈透光、半透明）、黑松（`trees.pines`）、背景杉林（`trees.forestBands`，用 heightAt 種在山坡上，遠景用便宜幾何）、草叢點綴、飄落的楓葉（t 驅動）。避開 `trees.keepOut` 與池塘（`inPond`）。 | 1.2M |

## 鏡頭焦點（`focusPoints()`）— 必須精緻

| 鏡頭 | 焦點 | 負責 |
|---|---|---|
| 1 | `toro`：參道石燈籠的火袋 | 地形 |
| 2 | `heroLotus`：主角蓮花 | 池塘 |
| 3 | `chime`：五重塔第一層西南角的風鈴 | 五重塔 |
| 4 | `buddhaFace`：佛臉 | 主殿 |
| 5 | `chochin`：山門大提燈 | 拱橋 |
| 6 | `giboshi`：橋西側第 3 根柱的擬寶珠 | 拱橋 |
| 7 | `hallLantern`：主殿青銅吊燈籠 | 主殿 |
| 8 | `finial`：相輪寶珠 | 五重塔 |
| 9 | `koiSpot`：水面下的錦鯉 | 池塘 |
| 10 | `maple`：逆光楓葉（鏡頭朝西南西的太陽看過去） | 樹木 |

## 參考圖

`reference/` 下的圖由 `tools/draw_reference.mjs` 依 layout.js 畫出（比例正確）：
`site_plan.png`（平面圖）、`elev_hall.png`、`elev_pagoda.png`、`elev_bridge.png`、`elev_sanmon.png`。
用 Read 工具打開看。真實寺院可參考：法隆寺、興福寺五重塔、東寺、淺草寺雷門（大提燈）、住吉大社太鼓橋、鎌倉大佛、平等院鳳凰堂（池與倒影）。

日本寺院建築要點：
- 屋頂是主角：深而低的出簷（出簷常達柱高的 2/3），簷口線中段平直、兩端向上起翹；屋面略呈凹曲（反り）。本瓦葺：筒瓦與平瓦交替成列，簷口有圓形瓦當，屋脊有厚重的棟瓦。
- 簷下：柱頭上層層外挑的斗栱（三手先），兩層垂木（地垂木 + 飛檐垂木）木口刷白或黃。
- 色彩：朱漆（偏橘的紅）柱與木構、白壁、深灰瓦、金色飾金具、青銅綠鏽。
- 黃昏：太陽很低（7°），從西南西照來，陰影極長，西側面亮暖橘、東側面沉在藍紫陰影中。

## 自我檢查工具

```bash
# 只載入自己的分區（加快速度），自訂鏡頭：
node tools/snap.mjs --only pond --cam -10,3,40 --look 0,0,30 --out /tmp/<你的分區>/a.png
# 搭配地形一起看：
node tools/snap.mjs --only terrain,pond --cam ... --look ... --out ...
# 看正式鏡頭（第 N 顆，0 起算；--at 是鏡頭內秒數）：
node tools/snap.mjs --shot 1 --at 0,3,7 --out /tmp/<你的分區>/shot1.png
# 其他：--w 1920 --h 1080、--fov 40、--t 12（動畫時間）、--post 0（關後製）、--aperture 0.02（景深）
```

輸出會列出每格渲染秒數與各分區三角形數。用 Read 打開 PNG 檢查。**至少要從遠景、中景、特寫三種距離檢查**，包含你負責的鏡頭焦點特寫。
每格渲染超過 ~8 秒（1920×1080 全場景）就要減面。
