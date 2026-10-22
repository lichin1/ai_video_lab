// 分區：池塘 — 水面（反射 + 金色光帶 + 波紋）、池底淤泥與水草、蓮葉蓮花（含主角蓮花）、錦鯉。
// 子模組在 ./pond/。所有動畫都是 t 的純函式。
import * as THREE from 'three';
import { pond, focusPoints } from '../layout.js';
import { makeRng } from '../rng.js';
import { buildWater } from './pond/water.js';
import { buildBed } from './pond/bed.js';
import { buildLotus } from './pond/lotus.js';
import { buildKoi } from './pond/koi.js';

export default function build({ renderer }) {
  const group = new THREE.Group();
  group.name = 'pond';

  const koi = buildKoi();
  const lotus = buildLotus();
  const bed = buildBed();

  // 同心漣漪：6 個槽，每槽週期性地在某隻鯉魚（或主角蓮花旁）的位置點出一圈。純 t 函式。
  const hero = focusPoints().heroLotus;
  const slots = Array.from({ length: 6 }, (_, i) => {
    const r = makeRng('pond-ring-' + i);
    return { P: r.range(4.5, 7.5), off: r() * 7, koi: i * 2 + (i % 2), str: r.range(0.6, 1.0), hero: i === 5 };
  });
  function rings(t) {
    return slots.map((s) => {
      const n = Math.floor((t + s.off) / s.P);
      const birth = n * s.P - s.off;
      if (s.hero) {
        const r = makeRng('pond-ring-hero-' + n);
        const a = r() * Math.PI * 2, d = r.range(0.35, 0.9);
        return [hero[0] + Math.cos(a) * d, hero[2] + Math.sin(a) * d, birth, s.str * 0.7];
      }
      const p = koi.positionOf(s.koi, birth);
      return [p[0], p[2], birth, s.str];
    });
  }
  const water = buildWater({ renderer, rings });

  group.add(bed.object, koi.object, lotus.object, water.object);

  return {
    object: group,
    update(t) {
      koi.update(t);
      lotus.update(t);
      bed.update(t);
      water.update(t);
    },
  };
}
