// 漸細管（樹枝、樹幹）建構器：平行傳輸框架，uv 以公尺為單位（u 繞周長、v 沿枝長）。
import * as THREE from 'three';

const _q = new THREE.Quaternion();

export class MeshBuilder {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.idx = []; }
  get vcount() { return this.pos.length / 3; }

  /** pts: Vector3[]，radii: number[]，radial: 周向分段數。bump(i, j) 可回傳半徑倍率（樹皮起伏）。 */
  tube(pts, radii, radial, { vScale = 1, bump = null } = {}) {
    const n = pts.length;
    if (n < 2) return;
    const T = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      T.push(new THREE.Vector3().subVectors(b, a).normalize());
    }
    const ref = Math.abs(T[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const N = [new THREE.Vector3().crossVectors(T[0], ref).normalize()];
    for (let i = 1; i < n; i++) {
      _q.setFromUnitVectors(T[i - 1], T[i]);
      N.push(N[i - 1].clone().applyQuaternion(_q));
    }
    const base = this.vcount;
    let s = 0;
    const d = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      if (i > 0) s += pts[i].distanceTo(pts[i - 1]);
      const B = new THREE.Vector3().crossVectors(T[i], N[i]);
      const r = radii[i];
      const circ = Math.max(2 * Math.PI * r, 0.04);
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        d.copy(N[i]).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
        const rr = bump ? r * bump(i, j % radial, s) : r;
        this.pos.push(pts[i].x + d.x * rr, pts[i].y + d.y * rr, pts[i].z + d.z * rr);
        this.nrm.push(d.x, d.y, d.z);
        this.uv.push((j / radial) * circ, s * vScale);
      }
    }
    const R = radial + 1;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = base + i * R + j, b = a + R;
        this.idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }

  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.vcount > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** 單位隨機向量 */
export function randUnit(rng, out = new THREE.Vector3()) {
  const z = rng() * 2 - 1, a = rng() * Math.PI * 2, r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), z, r * Math.sin(a));
}

/** 由 Y（葉柄 → 葉尖）與近似法線 N 組出實例矩陣。 */
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
export function basisMatrix(m, pos, ydir, nrm, sx, sy = sx, sz = sx) {
  _y.copy(ydir).normalize();
  _z.copy(nrm).addScaledVector(_y, -nrm.dot(_y));
  if (_z.lengthSq() < 1e-8) _z.set(_y.y, -_y.x, 0.3);
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
  m.makeBasis(_x.multiplyScalar(sx), _y.multiplyScalar(sy), _z.multiplyScalar(sz));
  m.setPosition(pos);
  return m;
}
