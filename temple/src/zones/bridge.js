// 分區：拱橋（太鼓橋）＋ 山門（二重門與大提燈）
import * as THREE from 'three';
import { buildBridge } from './bridge/taikobashi.js';

export default async function build({ scene, camera, renderer } = {}) {
  const group = new THREE.Group();
  group.name = 'bridge';
  group.add(buildBridge());
  let sanmon = null;
  try {
    const mod = await import('./bridge/sanmon.js');
    sanmon = mod.buildSanmon();
    group.add(sanmon.object);
  } catch (e) {
    if (!String(e).includes('Failed to fetch')) throw e;
  }
  // 預先上傳大型 canvas 紋理並編譯材質，避免第一格渲染卡住
  if (renderer) {
    const seen = new Set();
    group.traverse((o) => {
      if (!o.material) return;
      for (const m of [].concat(o.material)) for (const k of ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'bumpMap']) {
        const t = m[k];
        if (t && !seen.has(t)) { seen.add(t); renderer.initTexture(t); }
      }
    });
    try { if (scene && camera) { scene.add(group); renderer.compile(scene, camera); scene.remove(group); } } catch (e) { /* 非必要 */ }
  }
  return {
    object: group,
    update(t, camera) { sanmon?.update?.(t, camera); },
  };
}
