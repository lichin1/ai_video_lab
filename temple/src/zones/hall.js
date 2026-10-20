// 分區：hall（施工中佔位）
import * as THREE from 'three';

export default function build() {
  const group = new THREE.Group();
  group.name = 'hall';
  return { object: group, update(t) {} };
}
