// 楓葉：程式畫的七裂掌狀葉貼圖（DataTexture，各通道是資料）＋ 透光葉片材質。
//   R = 葉肉明暗細節（含葉緣加深）  G = 葉脈遮罩  B = 葉基（中心）程度  A = 葉形
import * as THREE from 'three';
import { makeRng, makeNoise2D, fbm } from '../../rng.js';

export const ALPHA_TEST = 0.42;

/** 自建 mipmap：box filter，並調整每層 alpha 使「alpha > 門檻」的覆蓋率與原圖相同，遠看葉子才不會縮小消失。 */
export function buildCoverageMips(data, S, cut) {
  const coverage = (d) => { let c = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > cut * 255) c++; return c / (d.length / 4); };
  const target = coverage(data);
  const mips = [{ data, width: S, height: S }];
  let prev = data, w = S;
  while (w > 1) {
    const nw = w >> 1;
    const d = new Uint8Array(nw * nw * 4);
    for (let y = 0; y < nw; y++) for (let x = 0; x < nw; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) sum += prev[((y * 2 + dy) * w + x * 2 + dx) * 4 + c];
        d[(y * nw + x) * 4 + c] = sum / 4;
      }
    }
    // 二分搜尋 alpha 縮放
    let lo = 0.5, hi = 8;
    const tmp = new Uint8Array(nw * nw * 4);
    for (let it = 0; it < 14; it++) {
      const k = (lo + hi) / 2;
      for (let i = 3; i < d.length; i += 4) tmp[i] = Math.min(255, d[i] * k);
      if (coverage(tmp) < target) lo = k; else hi = k;
    }
    const k = (lo + hi) / 2;
    const out = new Uint8Array(d);
    for (let i = 3; i < d.length; i += 4) out[i] = Math.min(255, d[i] * k);
    mips.push({ data: out, width: nw, height: nw });
    prev = d; w = nw;
  }
  return mips;
}

// 七裂：角度（由葉尖方向「上」起算，度）、相對長度
const LOBES = [[0, 1.0], [39, 0.93], [-39, 0.93], [78, 0.76], [-78, 0.76], [121, 0.44], [-121, 0.44]];

export function makeMapleLeafTexture(S = 512) {
  const cx = 0.5 * S, cy = (1 - 0.40) * S;      // 葉身中心（canvas 座標，y 向下）
  const R = 0.455 * S;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const shapeC = mk(), veinC = mk(), edgeC = mk();
  const gs = shapeC.getContext('2d'), gv = veinC.getContext('2d'), ge = edgeC.getContext('2d');
  gv.fillStyle = '#000'; gv.fillRect(0, 0, S, S);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  gs.fillStyle = '#fff'; gv.strokeStyle = '#fff'; ge.strokeStyle = '#fff';
  gv.lineCap = 'round'; ge.lineJoin = 'round';
  const rng = makeRng('maple-leaf-shape');

  for (const [deg, L] of LOBES) {
    const a = deg * Math.PI / 180;
    const ax = Math.sin(a), ay = -Math.cos(a);   // 裂片軸方向（canvas）
    const px = -ay, py = ax;                     // 垂直方向
    const len = L * R * (1 + (rng() - 0.5) * 0.04);
    const wm = 0.175 * len;
    const width = (u) => (u < 0.36 ? 0.42 + 0.58 * Math.sin((u / 0.36) * Math.PI / 2)
      : Math.pow(Math.max(0, Math.cos(((u - 0.36) / 0.64) * Math.PI / 2)), 0.8)) * wm;
    const P = (u, w) => [cx + ax * len * u + px * w, cy + ay * len * u + py * w];
    // 鋸齒（重鋸齒）：每齒一個谷點、一個朝葉尖的尖點
    const teeth = Math.round(8 + 7 * L);
    const side = (sgn) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const u = 0.2 * i / 8; pts.push(P(u, sgn * width(u))); }
      for (let k = 0; k < teeth; k++) {
        const u0 = 0.2 + 0.78 * k / teeth, u1 = 0.2 + 0.78 * (k + 0.55) / teeth, u2 = 0.2 + 0.78 * (k + 0.8) / teeth;
        const f = Math.min(1, (u0 - 0.2) * 5);
        pts.push(P(u0, sgn * width(u0) * (1 - 0.13 * f)));
        pts.push(P(u1, sgn * width(u1) * (1 - 0.05 * f)));
        pts.push(P(u2, sgn * width(u2) * (1 + 0.06 * f)));
      }
      return pts;
    };
    const right = side(1), left = side(-1).reverse();
    const tip = P(1.0, 0);
    gs.beginPath();
    gs.moveTo(...right[0]);
    for (const p of right) gs.lineTo(...p);
    gs.lineTo(...tip);
    for (const p of left) gs.lineTo(...p);
    gs.closePath();
    gs.fill();
    ge.lineWidth = S * 0.012;
    ge.beginPath(); ge.moveTo(...right[0]); for (const p of right) ge.lineTo(...p); ge.lineTo(...tip); for (const p of left) ge.lineTo(...p); ge.stroke();

    // 主脈：中心 → 裂片尖，漸細
    const N = 16;
    for (let i = 0; i < N; i++) {
      const u0 = 0.93 * i / N, u1 = 0.93 * (i + 1) / N;
      gv.lineWidth = S * (0.0095 - 0.007 * (i / N)) * (0.75 + 0.25 * L);
      gv.beginPath(); gv.moveTo(...P(u0, 0)); gv.lineTo(...P(u1, 0)); gv.stroke();
    }
    // 側脈：斜向葉緣，略彎
    const nSec = Math.round(5 + 4 * L);
    for (let k = 0; k < nSec; k++) {
      const u = 0.2 + 0.66 * (k + 0.5) / nSec;
      for (const sgn of [1, -1]) {
        const ue = Math.min(0.98, u + 0.11);
        const s0 = P(u, 0), s2 = P(ue, sgn * width(ue) * 0.88), s1 = P(u + 0.05, sgn * width(u + 0.04) * 0.55);
        gv.lineWidth = S * 0.0034 * (0.8 + 0.2 * L);
        gv.beginPath(); gv.moveTo(...s0); gv.quadraticCurveTo(...s1, ...s2); gv.stroke();
        // 細脈：從側脈分出的小枝
        const m = [(s0[0] + s2[0]) / 2 * 0.5 + s1[0] * 0.5, (s0[1] + s2[1]) / 2 * 0.5 + s1[1] * 0.5];
        const t2 = P(Math.max(0.15, u - 0.05), sgn * width(u) * 0.95);
        gv.lineWidth = S * 0.0018;
        gv.beginPath(); gv.moveTo(...m); gv.lineTo(...t2); gv.stroke();
      }
    }
  }
  // 葉基圓盤
  gs.beginPath(); gs.arc(cx, cy, R * 0.15, 0, Math.PI * 2); gs.fill();
  // 葉柄（彎曲）
  for (const [g, w] of [[gs, 0.016], [gv, 0.012]]) {
    g.strokeStyle = '#fff'; g.lineCap = 'round';
    g.lineWidth = S * w;
    g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + S * 0.01, cy + S * 0.25, cx + S * 0.035, S * 0.985); g.stroke();
  }

  const sd = gs.getImageData(0, 0, S, S).data, vd = gv.getImageData(0, 0, S, S).data, ed = ge.getImageData(0, 0, S, S).data;
  const noise = makeNoise2D('maple-leaf-cells');
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const si = (y * S + x) * 4;
      const di = ((S - 1 - y) * S + x) * 4; // 翻轉：資料第 0 列 = v 0（下方）
      const u = x / S, v = y / S;
      const n1 = fbm(noise, u * 22, v * 22, 3), n2 = noise(u * 70, v * 70);
      const edge = ed[si] / 255;
      let detail = 0.86 + 0.07 * n1 + 0.035 * n2 - 0.2 * edge;
      const dist = Math.hypot(x - cx, y - cy) / R;
      const cen = Math.pow(Math.max(0, 1 - dist / 0.62), 1.4);
      data[di] = Math.max(0, Math.min(255, detail * 255));
      data[di + 1] = vd[si];
      data[di + 2] = cen * 255;
      data[di + 3] = sd[si + 3];
    }
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.mipmaps = buildCoverageMips(data, S, ALPHA_TEST);
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 楓葉材質：MeshStandardMaterial ＋ 背光透射（葉片被太陽從背面照到時發亮）。
 * 需要 instance attribute `aExposure`（0–1：樹冠自遮蔽後的受光量）。
 */
export function makeLeafMaterial(tex, { trans = 0.75, name = 'mapleLeaf' } = {}) {
  const m = new THREE.MeshStandardMaterial({
    name, map: tex, alphaTest: ALPHA_TEST, side: THREE.DoubleSide, roughness: 0.58, metalness: 0,
  });
  m.userData.trans = { value: trans };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTrans = m.userData.trans;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aExposure;\nvarying float vExposure;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvExposure = aExposure;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vExposure;\nuniform float uTrans;\nfloat gVein = 0.0;')
      .replace('#include <map_fragment>', 'vec4 leafTex = texture2D( map, vMapUv );')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 base = diffuseColor.rgb;
          gVein = leafTex.g;
          vec3 warm = vec3(base.r * 1.04 + 0.01, base.r * 0.36 + base.g * 1.1 + 0.01, base.b * 1.2);
          vec3 c = base * leafTex.r;
          c = mix(c, warm * 0.92, leafTex.b * 0.4);
          c = mix(c, warm * 1.08, gVein * 0.6);
          diffuseColor.rgb = c;
          diffuseColor.a = leafTex.a;
        }`)
      .replace('#include <lights_physical_pars_fragment>', `#include <lights_physical_pars_fragment>
void RE_Direct_Leaf( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  IncidentLight dl = directLight;
  dl.color *= vExposure;
  RE_Direct_Physical( dl, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  float NL = dot( geometryNormal, dl.direction );
  float back = saturate( -dot( geometryViewDir, dl.direction ) );
  float through = sqrt( saturate( -NL ) );
  float tr = through * ( 0.5 + 1.8 * pow( back, 4.0 ) + 0.9 * pow( back, 24.0 ) );
  vec3 tcol = material.diffuseColor * material.diffuseColor * 2.2;
  reflectedLight.directDiffuse += dl.color * BRDF_Lambert( tcol ) * tr * uTrans * ( 1.0 - 0.6 * gVein );
}
#undef RE_Direct
#define RE_Direct RE_Direct_Leaf`)
      .replace('#include <aomap_fragment>', 'reflectedLight.indirectDiffuse *= mix( 0.5, 1.0, vExposure );\n#include <aomap_fragment>');
  };
  m.customProgramCacheKey = () => 'maple-leaf-v1';
  return m;
}

/** 平面葉片幾何：原點在葉柄末端，+Y 沿葉柄 → 葉尖，法線 +Z。cup > 0 時細分並做出葉面捲曲。 */
export function makeLeafGeometry(segX = 1, segY = 1, cup = 0) {
  const g = new THREE.PlaneGeometry(1, 1, segX, segY);
  g.translate(0, 0.5, 0);
  if (cup > 0) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const r = Math.hypot(x, y - 0.4);
      // 中肋微折、裂片邊緣上翹、葉尖下垂
      const z = cup * (0.10 * Math.abs(x) + 0.22 * x * x + 0.10 * r * r) - cup * 0.12 * Math.max(0, y - 0.6) ** 2;
      p.setZ(i, z);
    }
    g.computeVertexNormals();
  }
  return g;
}
