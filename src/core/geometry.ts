import { Box3, BufferGeometry, Euler, Float32BufferAttribute, Matrix4, Plane, Quaternion, Vector3 } from 'three';
import type { MapObject, Side, V3 } from '../model';
import { v } from '../model';

/** Source uses Z-up coordinates and clockwise brush plane points. */
export function matrix(o: MapObject): Matrix4 {
  return new Matrix4().compose(v(o.position), new Quaternion().setFromEuler(new Euler(...(o.rotation.map(n => (n * Math.PI) / 180) as V3), 'ZYX')), v(o.scale));
}
export function planeOf(s: Side): Plane {
  const [a, b, c] = s.points.map(v);
  const n = a.clone().sub(b).cross(c.clone().sub(b)).normalize();
  return new Plane(n, -n.dot(a));
}
export function brushFaces(sides: Side[]): Vector3[][] {
  if (sides.length > 128) return [];
  const planes = sides.map(planeOf);
  const verts: Vector3[] = [];
  for (let a = 0; a < planes.length; a++)
    for (let b = a + 1; b < planes.length; b++)
      for (let c = b + 1; c < planes.length; c++) {
        const p = planes[a],
          q = planes[b],
          r = planes[c];
        const qr = q.normal.clone().cross(r.normal);
        const d = p.normal.dot(qr);
        if (Math.abs(d) < 1e-7) continue;
        const pt = qr.multiplyScalar(-p.constant).add(r.normal.clone().cross(p.normal).multiplyScalar(-q.constant)).add(p.normal.clone().cross(q.normal).multiplyScalar(-r.constant)).divideScalar(d);
        if (planes.every(pl => pl.distanceToPoint(pt) < 0.01) && !verts.some(x => x.distanceToSquared(pt) < 0.00001)) verts.push(pt);
      }
  return planes.map(pl => {
    const points = verts.filter(pt => Math.abs(pl.distanceToPoint(pt)) < 0.02);
    if (points.length < 3) return [];
    const center = points.reduce((s, p) => s.add(p), new Vector3()).divideScalar(points.length);
    const u = points[0].clone().sub(center).normalize();
    const w = pl.normal.clone().cross(u);
    return points.sort((a, b) => Math.atan2(a.clone().sub(center).dot(w), a.clone().sub(center).dot(u)) - Math.atan2(b.clone().sub(center).dot(w), b.clone().sub(center).dot(u)));
  });
}
export function geometry(o: MapObject): BufferGeometry {
  const g = new BufferGeometry(),
    positions: number[] = [],
    uv: number[] = [];
  let start = 0;
  brushFaces(o.sides ?? []).forEach((face, i) => {
    for (let j = 1; j < face.length - 1; j++)
      for (const p of [face[0], face[j], face[j + 1]]) {
        positions.push(p.x, p.y, p.z);
        const normal = planeOf(o.sides![i]).normal;
        if (Math.abs(normal.z) > 0.5) uv.push(p.x / 128, p.y / 128);
        else if (Math.abs(normal.x) > 0.5) uv.push(p.y / 128, p.z / 128);
        else uv.push(p.x / 128, p.z / 128);
      }
    const count = positions.length / 3 - start;
    if (count) g.addGroup(start, count, i);
    start += count;
  });
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  g.computeBoundingBox();
  return g;
}
export function bounds(o: MapObject): Box3 {
  if (o.kind === 'entity') return new Box3(v(o.position).addScalar(-16), v(o.position).addScalar(16));
  const points = brushFaces(o.sides ?? [])
    .flat()
    .map(p => p.clone().applyMatrix4(matrix(o)));
  return new Box3().setFromPoints(points);
}
