// 地形分區：地面網格（變間距張量網格，寺域/池塘細、遠處粗）+ 依世界座標混合草/苔/白砂/林床的 shader。
import * as THREE from 'three';
import { terrain, pond, paths } from '../../layout.js';
import { heightAt } from '../../ground.js';
import { grassTexture, mossTexture, sandTexture, soilTexture, macroTexture } from './tex.js';

/** 依間距函式 step(x) 從 -half 走到 +half，最後一格對齊邊界。 */
function axis(half, step) {
  const out = [-half];
  let x = -half;
  while (x < half - 1e-6) {
    const s = step(x + 0.5 * step(x));
    x = Math.min(half, x + s);
    if (half - x < 0.35 * s) x = half;
    out.push(x);
  }
  return out;
}

function spacing(v, pondLo, pondHi, flatLo, flatHi, fine, mid) {
  if (v > pondLo && v < pondHi) return fine;
  if (v >= flatLo && v <= flatHi) return mid;
  const d = v < flatLo ? flatLo - v : v - flatHi;
  return Math.min(32, mid + 0.09 * d);
}

export function buildGround() {
  const half = terrain.size / 2;
  const P = terrain.precinct, B = terrain.precinctBlend;
  const pc = pond.center;
  const xs = axis(half, (x) => spacing(x, pc[0] - pond.rx - 4, pc[0] + pond.rx + 4, P.xMin - B, P.xMax + B, 0.6, 2));
  const zs = axis(half, (z) => spacing(z, pc[2] - pond.rz - 4, pc[2] + pond.rz + 4, P.zMin - B, P.zMax + B, 0.45, 2));
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  let k = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    pos[k++] = xs[i]; pos[k++] = heightAt(xs[i], zs[j]); pos[k++] = zs[j];
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  k = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    // 對角線方向交錯，避免斜坡出現單向鋸齒
    if ((i + j) & 1) { idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; }
    else { idx[k++] = a; idx[k++] = c; idx[k++] = d; idx[k++] = a; idx[k++] = d; idx[k++] = b; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const material = groundMaterial();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'terrain-ground';
  mesh.receiveShadow = true;
  return mesh;
}

function groundMaterial() {
  const segs = [];
  for (const p of paths) for (let i = 0; i < p.pts.length - 1; i++) {
    // 端點是否為折線的起訖（方頭），中間轉折為圓頭
    segs.push({ a: p.pts[i], b: p.pts[i + 1], w: p.w, ca: i === 0 ? 1 : 0, cb: i === p.pts.length - 2 ? 1 : 0 });
  }
  const MAXSEG = 12;
  const segU = [], wU = [], capU = [];
  for (let i = 0; i < MAXSEG; i++) {
    const s = segs[i];
    segU.push(s ? new THREE.Vector4(s.a[0], s.a[1], s.b[0], s.b[1]) : new THREE.Vector4(1e5, 1e5, 1e5 + 1, 1e5));
    wU.push(s ? s.w : 0);
    capU.push(new THREE.Vector2(s ? s.ca : 0, s ? s.cb : 0));
  }
  const P = terrain.precinct;
  const uniforms = {
    tGrass: { value: grassTexture() },
    tMoss: { value: mossTexture() },
    tSand: { value: sandTexture() },
    tSoil: { value: soilTexture() },
    tMacro: { value: macroTexture() },
    uSeg: { value: segU },
    uSegW: { value: wU },
    uSegCap: { value: capU },
    uPre: { value: new THREE.Vector4(P.xMin, P.zMin, P.xMax, P.zMax) },
    uPond: { value: new THREE.Vector4(pond.center[0], pond.center[2], pond.rx, pond.rz) },
    uWater: { value: pond.waterLevel },
  };
  const m = new THREE.MeshStandardMaterial({ name: 'terrain-ground', color: 0xffffff, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vTW;
uniform sampler2D tGrass, tMoss, tSand, tSoil, tMacro;
uniform vec4 uSeg[${MAXSEG}];
uniform float uSegW[${MAXSEG}];
uniform vec2 uSegCap[${MAXSEG}];
uniform vec4 uPre;
uniform vec4 uPond;
uniform float uWater;
float terrRough = 0.95;`)
      .replace('#include <map_fragment>', /* glsl */`
{
  vec2 p = vTW.xz;
  vec4 M = texture2D(tMacro, p / 90.0);
  vec4 M2 = texture2D(tMacro, p / 17.0 + 0.31);
  vec4 M3 = texture2D(tMacro, p / 4.3 + 0.67);
  // 拉開對比（value-noise fbm 集中在 0.5 附近）
  M = clamp((M - 0.5) * 2.6 + 0.5, 0.0, 1.0);
  M2 = clamp((M2 - 0.5) * 2.6 + 0.5, 0.0, 1.0);
  M3 = clamp((M3 - 0.5) * 2.4 + 0.5, 0.0, 1.0);
  // 參道距離（路緣外為正）
  float dPath = 1e5;
  for (int i = 0; i < ${MAXSEG}; i++) {
    vec2 a = uSeg[i].xy, b = uSeg[i].zw, v = b - a;
    float L = length(v);
    vec2 dv = v / L;
    float s = dot(p - a, dv);
    float perp = abs(dot(p - a, vec2(-dv.y, dv.x))) - uSegW[i] * 0.5;
    float t = clamp(s / L, 0.0, 1.0);
    float dr = length(p - a - v * t) - uSegW[i] * 0.5;
    // 方頭：起訖端用矩形距離
    float over = s < 0.0 ? -s : s - L;
    float isCap = s < 0.0 ? uSegCap[i].x : uSegCap[i].y;
    float dq = over > 0.0 ? max(perp, over) : perp;
    dPath = min(dPath, mix(dr, dq, isCap));
  }
  vec2 q = max(max(uPre.xy - p, p - uPre.zw), vec2(0.0));
  float dPre = length(q);
  float e = length((p - uPond.xy) / uPond.zw);

  vec3 grass = texture2D(tGrass, p / 2.6).rgb;
  vec3 grass2 = texture2D(tGrass, p / 11.0 + 0.5).rgb;
  grass = mix(grass, grass2, 0.35);
  vec3 moss = texture2D(tMoss, p / 1.9).rgb * mix(0.85, 1.15, M3.b);
  vec3 sand = texture2D(tSand, p / 1.3).rgb;
  vec3 soil = texture2D(tSoil, p / 3.1).rgb;

  // 境內：草與苔交錯（苔偏多在北側陰處與大樹下）
  float mossK = smoothstep(0.45, 0.6, M.r * 0.75 + M2.g * 0.4 - 0.1 + clamp(-p.y / 250.0, -0.12, 0.2));
  // 草色：偏枯的黃綠與暗綠交錯，加上土色斑
  vec3 grassDry = grass * vec3(1.15, 1.0, 0.7);
  vec3 g2 = mix(grass * vec3(0.82, 0.9, 0.8), grassDry, smoothstep(0.35, 0.75, M2.r * 0.7 + M3.g * 0.5));
  g2 = mix(g2, soil * 1.1, smoothstep(0.62, 0.8, M3.r) * 0.45);
  vec3 inner = mix(g2, moss, mossK);
  inner *= mix(0.72, 1.12, M2.b) * mix(0.9, 1.05, M3.b);
  // 寺域外：深綠山坡帶暮色紫，夾林床
  float hill = smoothstep(0.0, 22.0, dPre);
  float floorK = smoothstep(0.4, 0.7, M.g + hill * 0.15);
  vec3 outer = mix(grass * vec3(0.42, 0.55, 0.48), soil * 0.7, floorK * 0.75);
  outer = mix(outer, outer * vec3(0.82, 0.8, 1.0), 0.6) * mix(0.75, 1.05, M.b);
  vec3 col = mix(inner, outer, hill);

  // 參道兩旁白砂，砂紋與路平行
  float edge = 1.7 + (M2.r - 0.5) * 0.35;
  float sandK = 1.0 - smoothstep(edge - 0.08, edge + 0.08, dPath);
  float rake = 0.5 + 0.5 * sin(max(dPath, 0.0) * 6.2831853 / 0.16);
  vec3 sandC = sand * mix(0.84, 1.05, smoothstep(0.15, 0.95, rake));
  // 砂與草的交界放一條深色小石邊
  float lip = smoothstep(0.1, 0.0, abs(dPath - edge)) * 0.35;
  col = mix(col, sandC, sandK);
  col *= 1.0 - lip;
  // 路面（石板下的接縫）：灰色碎石
  float under = 1.0 - smoothstep(-0.05, 0.05, dPath);
  col = mix(col, sand * vec3(0.62, 0.6, 0.58), under);

  // 池：池底泥、岸邊濕潤
  float wet = smoothstep(1.08, 0.97, e);
  col = mix(col, mix(col, soil * vec3(0.7, 0.72, 0.62), 0.6) * 0.7, wet);
  float below = smoothstep(uWater + 0.05, uWater - 0.15, vTW.y);
  col = mix(col, soil * vec3(0.42, 0.46, 0.36), below);

  diffuseColor.rgb *= col;
  terrRough = mix(0.97, 0.9, sandK) * mix(1.0, 0.6, wet);
}
`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = terrRough;');
  };
  m.customProgramCacheKey = () => 'terrain-ground-v1';
  return m;
}
