// 分區：pond（施工中佔位）
import * as THREE from 'three';

export default function build() {
  const group = new THREE.Group();
  group.name = 'pond';
  return { object: group, update(t) {} };
}
