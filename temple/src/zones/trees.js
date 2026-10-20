// 分區：trees（施工中佔位）
import * as THREE from 'three';

export default function build() {
  const group = new THREE.Group();
  group.name = 'trees';
  return { object: group, update(t) {} };
}
