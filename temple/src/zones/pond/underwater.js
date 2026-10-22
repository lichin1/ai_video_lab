// 水下物件（池底、水草、鯉魚、莖的水下段）的水體吸收：在各自材質的片元著色器裡，
// 依「水面到該點的折射路徑長」做 Beer–Lambert 吸收 + 綠褐色散射，水面本身就可以保持透明。
import * as THREE from 'three';
import { pond } from '../../layout.js';

export const WATER = {
  absorb: new THREE.Vector3(1.7, 0.95, 2.6),   // 每公尺吸收（紅、綠、藍）→ 偏綠褐
  scatter: new THREE.Vector3(0.045, 0.055, 0.030),
};

/**
 * 給 MeshStandardMaterial 加上水下吸收。amb：水中漫射光補償（模擬折射進水的天光，避免低角度陽光下魚背全黑）。
 * 會串接既有的 onBeforeCompile。
 */
export function underwater(material, { amb = 0.0, key = 'uw' } = {}) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (s, r) => {
    prev?.call(material, s, r);
    s.uniforms.uWL = { value: pond.waterLevel };
    s.uniforms.uAbsorb = { value: WATER.absorb };
    s.uniforms.uScatter = { value: WATER.scatter };
    s.uniforms.uUwAmb = { value: new THREE.Color(0.55, 0.42, 0.30).multiplyScalar(amb) };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vUwPos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 uwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          uwp = instanceMatrix * uwp;
        #endif
          vUwPos = (modelMatrix * uwp).xyz; }`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vUwPos;\nuniform float uWL;\nuniform vec3 uAbsorb, uScatter, uUwAmb;')
      .replace('#include <fog_fragment>', `
        if (vUwPos.y < uWL) {
          float uwD = uWL - vUwPos.y;
          vec3 uwV = normalize(cameraPosition - vUwPos);
          // 視線在水面處的入射角 → 水中折射角（n = 1.33）
          float cosI = abs(uwV.y);
          float cosT = sqrt(max(1.0 - (1.0 - cosI * cosI) / 1.769, 0.05));
          float path = uwD / cosT + uwD;      // 光進水 + 視線出水，兩段路徑
          vec3 T = exp(-uAbsorb * path);
          gl_FragColor.rgb = (gl_FragColor.rgb + diffuseColor.rgb * uUwAmb) * T + uScatter * (1.0 - T);
        }
        #include <fog_fragment>`);
  };
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|' + key + amb;
  return material;
}
