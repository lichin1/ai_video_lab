// 池塘水面：平面反射（Reflector，半解析度）＋ 程式波紋法線 ＋ 解析太陽金色光帶 ＋ 依水深的吸收與透明度。
// 波紋、漣漪全部是 uTime 的純函式。
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { pond, sun, sunDirection } from '../../layout.js';
import { heightAt } from '../../ground.js';

const vertexShader = /* glsl */`
uniform mat4 textureMatrix;
attribute float aDepth;
varying vec4 vUvR;
varying vec4 worldPosition;
varying float vDepth;
#include <common>
#include <fog_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
void main() {
  vUvR = textureMatrix * vec4(position, 1.0);
  worldPosition = modelMatrix * vec4(position, 1.0);
  vDepth = aDepth;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
  #include <shadowmap_vertex>
}`;

const fragmentShader = /* glsl */`
uniform sampler2D tDiffuse;
uniform vec3 color;
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAbsorb;
uniform vec3 uScatter;
uniform vec4 uRings[6];   // xy = 中心, z = 出生時間, w = 強度
varying vec4 vUvR;
varying vec4 worldPosition;
varying float vDepth;

#include <common>
#include <packing>
#include <bsdfs>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

float h21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
// value noise 及其解析梯度
vec3 vnoiseD(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = h21(i), b = h21(i + vec2(1, 0)), c = h21(i + vec2(0, 1)), d = h21(i + vec2(1, 1));
  float v = a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
  vec2 g = du * vec2(b - a + (a - b - c + d) * u.y, c - a + (a - b - c + d) * u.x);
  return vec3(v, g);
}

// 水面斜率（dh/dx, dh/dz）。fw = 此像素在世界中的寬度，用來淡出過細的波以免閃爍。
vec2 slope(vec2 p, float t, float fw) {
  vec2 g = vec2(0.0);
  // 方向波（微風吹出的細浪），色散關係 w = sqrt(g k + s k^3)
  const int NW = 7;
  vec2 dirs[NW]; float lens[NW]; float amps[NW];
  dirs[0] = normalize(vec2(0.8, 0.3));  lens[0] = 2.6; amps[0] = 0.0040;
  dirs[1] = normalize(vec2(0.6, -0.5)); lens[1] = 1.55; amps[1] = 0.0026;
  dirs[2] = normalize(vec2(0.9, 0.7));  lens[2] = 0.95; amps[2] = 0.0016;
  dirs[3] = normalize(vec2(-0.3, 1.0)); lens[3] = 0.62; amps[3] = 0.0010;
  dirs[4] = normalize(vec2(1.0, -0.1)); lens[4] = 0.37; amps[4] = 0.0006;
  dirs[5] = normalize(vec2(0.4, 0.9));  lens[5] = 0.23; amps[5] = 0.00035;
  dirs[6] = normalize(vec2(-0.8, 0.5)); lens[6] = 0.14; amps[6] = 0.0002;
  for (int i = 0; i < NW; i++) {
    float k = 6.2831853 / lens[i];
    float w = sqrt(9.81 * k + 0.000074 * k * k * k);
    float ph = dot(dirs[i], p) * k - w * t * 0.55 + float(i) * 1.7;
    float fade = 1.0 - smoothstep(0.25, 0.6, fw / lens[i]);
    g += dirs[i] * (amps[i] * k * cos(ph)) * fade;
  }
  // 雜訊細波（貓爪風紋），兩層反向漂移
  vec3 n1 = vnoiseD(p * 2.2 + vec2(t * 0.18, t * 0.07));
  vec3 n2 = vnoiseD(p * 5.1 - vec2(t * 0.11, -t * 0.21) + 13.0);
  vec3 n3 = vnoiseD(p * 0.35 + vec2(t * 0.02, 0.0) + 5.0); // 大尺度：有風處 / 無風處
  float gust = 0.55 + 0.9 * n3.x;
  g += n1.yz * 2.2 * 0.017 * gust * (1.0 - smoothstep(0.1, 0.4, fw * 2.2));
  g += n2.yz * 5.1 * 0.006 * gust * (1.0 - smoothstep(0.1, 0.4, fw * 5.1));
  // 魚與昆蟲點出的同心漣漪
  for (int i = 0; i < 6; i++) {
    vec4 R = uRings[i];
    float age = t - R.z;
    if (age < 0.0 || age > 6.0) continue;
    vec2 d = p - R.xy;
    float r = length(d) + 1e-4;
    float front = age * 0.32;
    float x = r - front;
    float env = exp(-x * x * 60.0) * exp(-age * 0.55) / (1.0 + r * 3.0);
    float dh = -sin(x * 70.0) * 70.0 * 0.0012 * env * R.w;
    g += d / r * dh * (1.0 - smoothstep(0.1, 0.5, fw * 12.0));
  }
  return g;
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 wp = worldPosition.xyz;
  vec3 toEye = cameraPosition - wp;
  float dist = length(toEye);
  vec3 V = toEye / dist;
  float fw = length(fwidth(wp.xz));

  vec2 g = slope(wp.xz, uTime, fw);
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  float NdV = max(dot(N, V), 0.001);
  float F = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);

  // 反射（以法線擾動投影座標）
  vec4 uvr = vUvR;
  uvr.xy += N.xz * vec2(0.9, 0.6) * uvr.w * (0.035 / (1.0 + dist * 0.04));
  vec3 refl = texture2DProj(tDiffuse, uvr).rgb;

  // 太陽：寬光帶（Beckmann 統計斜率）＋ 波紋上的尖銳閃光
  float shadow = getShadowMask();
  vec3 L = normalize(uSunDir);
  vec3 H = normalize(V + L);
  float NdH = max(H.y, 1e-3);                         // 對平均水面 (0,1,0)
  float m = 0.035 + 0.02 * smoothstep(5.0, 80.0, dist); // 遠處像素包含更多波 → 統計上更粗
  float t2 = (1.0 - NdH * NdH) / (NdH * NdH);
  float D = exp(-t2 / (m * m)) / (3.14159 * m * m * NdH * NdH * NdH * NdH);
  float VdH = max(dot(V, H), 0.0);
  float Fh = 0.02 + 0.98 * pow(1.0 - VdH, 5.0);
  float band = exp(-t2 / (m * m)) * Fh * 1.1;
  vec3 Rv = reflect(-V, N);
  float sp = max(dot(Rv, L), 0.0);
  float spark = pow(sp, 1100.0) * 14.0 + pow(sp, 160.0) * 1.0;
  vec3 sunSpec = uSunColor * (band * (0.25 + 0.75 * smoothstep(0.0, 1.0, sp * sp)) * 0.55 + spark * F * 2.5) * shadow;

  // 水下物件的吸收在各自材質裡做（underwater.js），水面只負責反射 + 少量霧化
  float edge = smoothstep(0.0, 0.04, vDepth);         // 岸邊柔和水線
  float haze = 0.06 * smoothstep(0.1, 1.2, vDepth);   // 深處一層極淡的懸浮物
  float a = clamp((F + (1.0 - F) * haze) * edge, 0.0, 1.0);
  vec3 col = (F * refl * color + (1.0 - F) * haze * uScatter * 6.0) / max(F + (1.0 - F) * haze, 1e-3);
  col += sunSpec / max(a, 0.02) * edge;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** 以 heightAt 量出的岸線半徑（以橢圓參數 d 表示）做水面網格。 */
function waterGeometry() {
  const segA = 160, rings = 40;
  const [cx, , cz] = pond.center;
  const pos = [], depth = [], idx = [];
  pos.push(0, 0, 0); depth.push(pond.waterLevel - heightAt(cx, cz));
  for (let j = 1; j <= rings; j++) {
    // 外圈密一點（水深變化集中在岸邊）
    const u = j / rings;
    const d = 1.0 * (1 - Math.pow(1 - u, 1.8));
    for (let i = 0; i < segA; i++) {
      const a = (i / segA) * Math.PI * 2;
      const lx = Math.cos(a) * pond.rx * d, lz = Math.sin(a) * pond.rz * d;
      pos.push(lx, -lz, 0); // 本地 XY 平面；旋轉後 y_local → -z_world
      depth.push(pond.waterLevel - heightAt(cx + lx, cz + lz));
    }
  }
  for (let i = 0; i < segA; i++) idx.push(0, 1 + ((i + 1) % segA), 1 + i);
  for (let j = 1; j < rings; j++) {
    const o0 = 1 + (j - 1) * segA, o1 = 1 + j * segA;
    for (let i = 0; i < segA; i++) {
      const i1 = (i + 1) % segA;
      idx.push(o0 + i, o1 + i1, o1 + i, o0 + i, o0 + i1, o1 + i1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(0).map((_, k) => (k % 3 === 2 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

export function buildWater({ renderer, rings }) {
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  const shader = {
    name: 'PondWater',
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      THREE.UniformsLib.lights,
      {
        color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(...sunDirection()) },
        uSunColor: { value: new THREE.Color(sun.color).multiplyScalar(sun.intensity * 1.6) },
        uAbsorb: { value: new THREE.Vector3(1.9, 1.05, 2.9) },
        uScatter: { value: new THREE.Vector3(0.050, 0.060, 0.034) },
        uRings: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -100, 0)) },
      },
    ]),
    vertexShader, fragmentShader,
  };
  const water = new Reflector(waterGeometry(), {
    textureWidth: Math.round(size.x * 0.5), textureHeight: Math.round(size.y * 0.5),
    clipBias: 0.002, shader, multisample: 0, color: 0xffffff,
  });
  water.name = 'pond-water';
  water.rotation.x = -Math.PI / 2;
  water.position.set(pond.center[0], pond.waterLevel, pond.center[2]);
  water.receiveShadow = true;
  water.renderOrder = 10;
  const m = water.material;
  m.uniforms.color.value = new THREE.Color(0.92, 0.9, 0.86); // 反射略為吸收
  m.fog = true; m.lights = true; m.transparent = true; m.depthWrite = true;
  m.extensions = { derivatives: true };
  // 景深（BokehPass）用 overrideMaterial 再畫一次場景時，不要重算反射
  const orig = water.onBeforeRender;
  water.onBeforeRender = function (r, s, c, ...rest) {
    if (s.overrideMaterial) return;
    orig.call(this, r, s, c, ...rest);
  };
  return {
    object: water,
    update(t) {
      m.uniforms.uTime.value = t;
      const R = rings(t);
      for (let i = 0; i < 6; i++) m.uniforms.uRings.value[i].set(...R[i]);
    },
  };
}
