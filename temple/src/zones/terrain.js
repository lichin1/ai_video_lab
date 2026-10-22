// 分區：terrain — 地面網格、草/苔/白砂、參道石板、築地塀、遠山剪影、石燈籠、池岸石帶。
import * as THREE from 'three';
import { buildGround } from './terrain/groundMesh.js';
import { buildPathStones } from './terrain/pathStones.js';
import { buildWall } from './terrain/wall.js';
import { buildRidges } from './terrain/ridges.js';
import { buildLanterns } from './terrain/toro.js';
import { buildShore } from './terrain/shore.js';

export default function build() {
  const group = new THREE.Group();
  group.name = 'terrain';
  group.add(buildGround());
  group.add(buildPathStones());
  group.add(buildWall());
  group.add(buildRidges());
  group.add(buildShore());
  const lanterns = buildLanterns();
  group.add(lanterns.object);
  return { object: group, update(t) { lanterns.update(t); } };
}
