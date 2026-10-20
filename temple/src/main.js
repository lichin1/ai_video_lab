// 場景組裝：渲染器、天空、光線、後製，以及六個施工分區。
// 頁面對外提供 window.renderAt(t, cam?)：渲染影片時間 t（秒）的那一格，cam 可覆寫鏡頭（預覽用）。
//
// 網址參數：
//   ?only=pond,bridge   只載入指定分區（預覽用）
//   ?w=1920&h=1080      輸出解析度
//   ?post=0             關閉後製（bloom / 景深 / 調色）
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as layout from './layout.js';
import { makeSky, bakeEnvironment, fogColor } from './sky.js';
import { cameraAt } from './shots.js';

export const ZONES = ['terrain', 'pond', 'hall', 'pagoda', 'bridge', 'trees'];

const params = new URLSearchParams(location.search);
const W = +params.get('w') || layout.video.width;
const H = +params.get('h') || layout.video.height;
const usePost = params.get('post') !== '0';
const only = params.get('only') ? params.get('only').split(',') : ZONES;

const renderer = new THREE.WebGLRenderer({ antialias: !usePost, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.info.autoReset = false; // composer 有多個 pass，改成每格手動歸零才能看到整格的 draw call
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(fogColor, 0.0024);
const sky = makeSky();
scene.add(sky);
scene.environment = bakeEnvironment(renderer);
scene.environmentIntensity = 0.6;

// ── 光線 ──
const [sx, sy, sz] = layout.sunDirection();
const sunLight = new THREE.DirectionalLight(layout.sun.color, layout.sun.intensity);
const sunTarget = new THREE.Object3D();
sunTarget.position.set(...layout.focusPoints().precinctCenter);
scene.add(sunTarget);
sunLight.target = sunTarget;
sunLight.position.set(sunTarget.position.x + sx * layout.sun.distance, sunTarget.position.y + sy * layout.sun.distance, sunTarget.position.z + sz * layout.sun.distance);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(4096, 4096);
Object.assign(sunLight.shadow.camera, { left: -120, right: 120, top: 70, bottom: -70, near: 200, far: 620 });
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.04;
scene.add(sunLight);
scene.add(new THREE.HemisphereLight(layout.sun.skyColor, layout.sun.groundColor, layout.sun.hemiIntensity));

const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 6000);

// ── 後製 ──
let composer = null, bokeh = null, grade = null;
if (usePost) {
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  bokeh = new BokehPass(scene, camera, { focus: 10, aperture: 0.0, maxblur: 0.008 });
  composer.addPass(bokeh);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.32, 0.55, 0.92));
  composer.addPass(new OutputPass());
  grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uSeed: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uSeed; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        vec2 q = vUv - 0.5;
        c *= 1.0 - dot(q, q) * 0.55;                 // 暗角
        c = mix(c, c * vec3(1.04, 0.99, 0.93), 0.6);  // 暖調
        c += (h(vUv * 1000.0) - 0.5) * 0.018;         // 底片顆粒（每格固定種子）
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  composer.addPass(grade);
}

// ── 分區 ──
const zones = [];
for (const name of only) {
  const mod = await import(`./zones/${name}.js`);
  const z = await mod.default({ scene, camera, renderer });
  z.object.name ||= name;
  scene.add(z.object);
  zones.push({ name, ...z });
}

function countTriangles() {
  const out = {};
  for (const z of zones) {
    let n = 0;
    z.object.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const g = o.geometry;
      const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
      n += tris * (o.isInstancedMesh ? o.count : 1);
    });
    out[z.name] = Math.round(n);
  }
  return out;
}

/** 渲染影片時間 t 的畫面。cam = { pos:[x,y,z], look:[x,y,z], fov, focus?, aperture? } 可覆寫鏡頭。 */
window.renderAt = async (t, cam) => {
  const c = cam || cameraAt(t);
  camera.position.set(...c.pos);
  camera.fov = c.fov ?? 40;
  camera.near = Math.max(0.02, Math.min(0.5, (c.near ?? 0.05)));
  camera.updateProjectionMatrix();
  camera.lookAt(...c.look);
  renderer.info.reset();
  sky.material.uniforms.uTime.value = t;
  for (const z of zones) z.update?.(t, camera);
  if (composer) {
    const focus = c.focus ?? camera.position.distanceTo(new THREE.Vector3(...c.look));
    bokeh.uniforms.focus.value = focus;
    bokeh.uniforms.aperture.value = c.aperture ?? 0;
    bokeh.enabled = bokeh.uniforms.aperture.value > 0;
    grade.uniforms.uSeed.value = (t * 30) % 97;
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  return { triangles: countTriangles(), calls: renderer.info.render.calls };
};
window.sceneInfo = () => ({ triangles: countTriangles() });
window.ready = true;
