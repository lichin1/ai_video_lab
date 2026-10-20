// 分區：bridge（施工中佔位）
import * as THREE from 'three';

export default function build() {
  const group = new THREE.Group();
  group.name = 'bridge';
  return { object: group, update(t) {} };
}
