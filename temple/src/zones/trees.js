// 分區：trees — 紅葉楓、黑松、背景杉林、境內草叢與灌木、飄落的楓葉。
// 子模組在 src/zones/trees/：leaf（葉形貼圖與透光材質）、maple、pine、forest、cover、tube（漸細管）。
import * as THREE from 'three';
import { makeMapleLeafTexture, makeLeafMaterial } from './trees/leaf.js';
import { buildMaples, buildFallingLeaves } from './trees/maple.js';
import { buildPines } from './trees/pine.js';
import { buildForest } from './trees/forest.js';
import { buildGroundCover } from './trees/cover.js';

export default async function build() {
  const group = new THREE.Group();
  group.name = 'trees';
  const leafTex = makeMapleLeafTexture(512);
  const leafMat = makeLeafMaterial(leafTex);
  const maples = buildMaples(group, leafMat);
  const falling = buildFallingLeaves(group, leafMat, maples.heroGeo, maples);
  buildPines(group);
  buildForest(group);
  buildGroundCover(group);
  return {
    object: group,
    update(t) { falling.update(t); },
  };
}
