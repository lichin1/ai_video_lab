// 分區：拱橋（太鼓橋）＋ 山門（二重門與大提燈）
import * as THREE from 'three';
import { buildBridge } from './bridge/taikobashi.js';

export default async function build() {
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
  return {
    object: group,
    update(t, camera) { sanmon?.update?.(t, camera); },
  };
}
