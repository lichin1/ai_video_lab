// 分區：pagoda（施工中佔位）
import * as THREE from 'three';

export default function build() {
  const group = new THREE.Group();
  group.name = 'pagoda';
  return { object: group, update(t) {} };
}
