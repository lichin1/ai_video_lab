// 黃昏天空：漸層、太陽、光暈、高積雲。同一份 shader 也拿來烘焙環境貼圖（PMREM）。
import * as THREE from 'three';
import { sun, sunDirection } from './layout.js';

const vert = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // 永遠在最遠處
}`;

const frag = /* glsl */`
uniform vec3 uSun;
uniform float uTime;
uniform float uSunDisc;   // 太陽圓盤亮度（環境貼圖烘焙時調低）
varying vec3 vDir;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float cosS = dot(d, uSun);
  // 水平方向與太陽方位的夾角，用來讓太陽那側更暖、對側帶紫粉（維納斯帶）
  float side = dot(normalize(vec2(d.x, d.z) + 1e-5), normalize(vec2(uSun.x, uSun.z))) * 0.5 + 0.5;

  vec3 zenith = vec3(0.10, 0.16, 0.36);
  vec3 midSun = vec3(0.85, 0.44, 0.28);
  vec3 midAnti = vec3(0.42, 0.34, 0.52);
  vec3 horSun = vec3(1.25, 0.58, 0.26);
  vec3 horAnti = vec3(0.86, 0.56, 0.58);

  float hh = max(h, 0.0);
  vec3 hor = mix(horAnti, horSun, pow(side, 1.6));
  vec3 mid = mix(midAnti, midSun, pow(side, 2.2));
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.18, hh));
  col = mix(col, zenith, smoothstep(0.12, 0.75, hh));

  // 太陽光暈
  float c = max(cosS, 0.0);
  col += vec3(1.0, 0.55, 0.22) * (pow(c, 5.0) * 0.22 + pow(c, 40.0) * 0.7 + pow(c, 600.0) * 3.0);

  // 雲：投影到天頂平面
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.06) * 0.9;
    uv += vec2(uTime * 0.004, uTime * 0.0015);
    float n = fbm(uv * 1.3 + vec2(0.0, 3.0));
    float streak = fbm(vec2(uv.x * 0.6, uv.y * 3.2) + 11.0);
    float cov = smoothstep(0.52, 0.78, n * 0.6 + streak * 0.55);
    cov *= smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.55, 0.9, h));
    // 雲底被低角度陽光照成橘粉，遠離太陽處偏紫灰
    vec3 lit = mix(vec3(0.55, 0.36, 0.42), vec3(1.6, 0.78, 0.42), pow(side, 2.5));
    lit += vec3(1.2, 0.5, 0.2) * pow(c, 10.0) * 1.5;
    vec3 shade = mix(vec3(0.24, 0.20, 0.30), vec3(0.62, 0.36, 0.30), side);
    vec3 cloud = mix(shade, lit, smoothstep(0.45, 0.85, n));
    col = mix(col, cloud, cov * 0.85);
  }

  // 太陽圓盤（雲擋住時仍在雲後透出）
  float disc = smoothstep(0.99994, 0.99997, cosS);
  col += vec3(6.0, 3.6, 1.6) * disc * uSunDisc;

  // 地平線以下：暗色霾
  if (h < 0.0) col = mix(hor * 0.55, vec3(0.16, 0.12, 0.16), smoothstep(0.0, -0.25, h));
  gl_FragColor = vec4(col, 1.0);
}`;

export function makeSky() {
  const [x, y, z] = sunDirection();
  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: { uSun: { value: new THREE.Vector3(x, y, z) }, uTime: { value: 0 }, uSunDisc: { value: 1 } },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(5000, 64, 32), material);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

/** 由天空 shader 烘焙環境貼圖，讓金屬（金箔、青銅）反射到暮色天空。 */
export function bakeEnvironment(renderer) {
  const envScene = new THREE.Scene();
  const sky = makeSky();
  sky.material.uniforms.uSunDisc.value = 0.15;
  envScene.add(sky);
  // 補一塊暗色地面，避免金屬下緣反射到亮天
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4000, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x2a2024, side: THREE.DoubleSide }));
  ground.position.y = -20;
  envScene.add(ground);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0, 0.1, 10000);
  pmrem.dispose();
  return rt.texture;
}

export const fogColor = new THREE.Color(0.86, 0.60, 0.48);
export { sun };
