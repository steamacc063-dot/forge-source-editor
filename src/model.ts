import { parseVMF, writeVMF } from './core/vmf-codec';
import { matrix, planeOf, brushFaces, geometry, bounds } from './core/geometry';
export { parseVMF, writeVMF } from './core/vmf-codec';
export { matrix, planeOf, brushFaces, geometry, bounds } from './core/geometry';
import { Box3, BufferGeometry, Euler, Float32BufferAttribute, Matrix4, Plane, Quaternion, Vector3 } from 'three';

export type V3 = [number, number, number];
export interface KV {
  name: string;
  value?: string;
  children?: KV[];
}
export interface Side {
  points: V3[];
  material: string;
  source?: KV;
}
export interface MapObject {
  id: string;
  name: string;
  kind: 'brush' | 'entity';
  position: V3;
  rotation: V3;
  scale: V3;
  sides?: Side[];
  props: Record<string, string>;
  source?: KV;
  parent?: string;
  hidden?: boolean;
  locked?: boolean;
}
export interface Project {
  format: 'forge';
  version: 1;
  name: string;
  objects: MapObject[];
  root: KV[];
  world: Record<string, string>;
}
export const clone = <T>(x: T): T => structuredClone(x);
export const uid = () => crypto.randomUUID();
export const v = (a: V3) => new Vector3(...a);
export const tuple = (p: Vector3): V3 => [p.x, p.y, p.z];
export const num = (n: number) => String(Math.round(n * 10000) / 10000);
export const get = (n: KV, k: string) => n.children?.find(c => c.name === k && c.value !== undefined)?.value;
export function set(n: KV, k: string, value: string) {
  n.children ??= [];
  const c = n.children.find(c => c.name === k && c.value !== undefined);
  if (c) c.value = value;
  else n.children.push({ name: k, value });
}
export const propsOf = (n: KV) => Object.fromEntries((n.children ?? []).filter(c => c.value !== undefined).map(c => [c.name, c.value!]));
export function box(name: string, position: V3, size: V3, material = 'DEV/DEV_MEASUREGENERIC01B'): MapObject {
  const [x, y, z] = size.map(n => n / 2);
  const sides: Side[] = [];
  // Clockwise points viewed from outside, matching VBSP PlaneFromPoints.
  const faces: V3[][] = [
    [
      [x, -y, -z],
      [x, -y, z],
      [x, y, z]
    ],
    [
      [-x, y, -z],
      [-x, y, z],
      [-x, -y, z]
    ],
    [
      [-x, y, -z],
      [x, y, -z],
      [x, y, z]
    ],
    [
      [x, -y, -z],
      [-x, -y, -z],
      [-x, -y, z]
    ],
    [
      [-x, -y, z],
      [-x, y, z],
      [x, y, z]
    ],
    [
      [-x, y, -z],
      [-x, -y, -z],
      [x, -y, -z]
    ]
  ];
  faces.forEach(points => sides.push({ points, material }));
  return { id: uid(), name, kind: 'brush', position, rotation: [0, 0, 0], scale: [1, 1, 1], sides, props: {} };
}
export function entity(classname: string, position: V3, props: Record<string, string> = {}): MapObject {
  return { id: uid(), name: classname, kind: 'entity', position, rotation: [0, 0, 0], scale: [1, 1, 1], props: { classname, ...props } };
}
export function room(offset: V3 = [0, 0, 0]): MapObject[] {
  const objects = [
    box('Floor', [0, 0, -8], [1024, 768, 16]),
    box('Ceiling', [0, 0, 392], [1024, 768, 16], 'TOOLS/TOOLSNODRAW'),
    box('North wall', [0, 392, 192], [1056, 16, 416]),
    box('South wall', [0, -392, 192], [1056, 16, 416]),
    box('West wall', [-520, 0, 192], [16, 768, 416]),
    box('East wall', [520, 0, 192], [16, 768, 416]),
    entity('info_player_start', [-320, -220, 40]),
    entity('light', [0, 0, 280], { _light: '255 238 210 700' })
  ];
  objects.forEach(o => (o.position = o.position.map((n, i) => n + offset[i]) as V3));
  return objects;
}
export function stairs(offset: V3 = [0, 0, 0]): MapObject[] {
  return Array.from({ length: 8 }, (_, i) => box(`Step ${i + 1}`, [offset[0] + i * 32, offset[1], offset[2] + (i + 1) * 8], [32, 128, (i + 1) * 16]));
}
export function newProject(sample = true): Project {
  const objects = sample ? room() : [];
  if (sample) {
    objects.push(
      box('Platform', [-96, 0, 48], [320, 256, 96], 'DEV/DEV_MEASUREGENERIC01'),
      ...stairs([-256, -220, 0]),
      box('Column A', [320, 160, 96], [96, 96, 192]),
      box('Column B', [320, -160, 96], [96, 96, 192])
    );
  }
  return {
    format: 'forge',
    version: 1,
    name: sample ? 'blockout_01' : 'untitled',
    objects,
    root: [],
    world: { classname: 'worldspawn', skyname: 'sky_day01_01', detailmaterial: 'detail/detailsprites', detailvbsp: 'detail.vbsp' }
  };
}
export function importVMF(text: string, name = 'imported'): Project {
  const root = parseVMF(text);
  const world = root.find(n => n.name === 'world');
  if (!world) throw Error('VMF has no world block');
  const objects: MapObject[] = [];
  function readBrush(node: KV, parent?: string) {
    const sides = (node.children ?? [])
      .filter(n => n.name === 'side')
      .map(n => {
        const coords = (get(n, 'plane') ?? '').match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi)?.map(Number);
        if (!coords || coords.length !== 9 || coords.some(n => !Number.isFinite(n))) throw Error('Invalid brush plane');
        return { points: [coords.slice(0, 3), coords.slice(3, 6), coords.slice(6, 9)] as V3[], material: get(n, 'material') ?? 'TOOLS/TOOLSNODRAW', source: clone(n) };
      });
    const faces = brushFaces(sides);
    const b = new Box3().setFromPoints(faces.flat());
    const center = b.isEmpty() ? new Vector3() : b.getCenter(new Vector3());
    const locked = sides.some(s => s.source?.children?.some(c => c.name === 'dispinfo')) || faces.filter(f => f.length).length < 4;
    sides.forEach(s => (s.points = s.points.map(p => tuple(v(p).sub(center)))));
    objects.push({
      id: uid(),
      name: `Brush ${get(node, 'id') ?? objects.length + 1}`,
      kind: 'brush',
      position: tuple(center),
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      props: {},
      sides,
      source: clone(node),
      parent,
      locked
    });
  }
  function solids(n: KV, parent?: string) {
    (n.children ?? []).forEach(c => {
      if (c.name === 'solid') readBrush(c, parent);
      else if (c.children && c.name !== 'entity') solids(c, parent);
    });
  }
  solids(world);
  root
    .filter(n => n.name === 'entity' || n.name === 'hidden')
    .forEach(n => {
      const entities = n.name === 'entity' ? [n] : (n.children ?? []).filter(c => c.name === 'entity');
      for (const node of entities) {
        const props = propsOf(node);
        delete props.id;
        const pos = (props.origin ?? '0 0 0').split(/\s+/).map(Number);
        if (pos.length !== 3 || pos.some(n => !Number.isFinite(n))) throw Error('Invalid entity origin');
        const o = entity(props.classname ?? 'unknown', pos as V3, props);
        o.name = props.targetname || props.classname || 'Entity';
        o.source = clone(node);
        const angles = (props.angles ?? '0 0 0').split(/\s+/).map(Number);
        o.rotation = [angles[2] || 0, angles[0] || 0, angles[1] || 0];
        o.locked = !!node.children?.some(c => c.name === 'solid' || c.name === 'hidden');
        objects.push(o);
        solids(node, o.id);
      }
    });
  return { format: 'forge', version: 1, name, objects, root, world: propsOf(world) };
}
export function exportVMF(project: Project): string {
  const root = clone(project.root);
  let max = 1;
  const scan = (ns: KV[]) =>
    ns.forEach(n => {
      max = Math.max(max, Number(get(n, 'id')) || 0);
      if (n.children) scan(n.children);
    });
  scan(root);
  const next = () => String(++max);
  function id(n: KV) {
    if (!get(n, 'id')) set(n, 'id', next());
  }
  function stripSolids(n: KV): KV {
    return { ...n, children: n.children?.filter(c => c.name !== 'solid').map(c => (c.children ? stripSolids(c) : c)) };
  }
  function solid(o: MapObject): KV {
    if (o.locked && o.source) return clone(o.source);
    const node = o.source ? stripSolids(clone(o.source)) : { name: 'solid', children: [] };
    id(node);
    node.children = node.children?.filter(c => c.name !== 'side');
    const m = matrix(o);
    o.sides?.forEach(s => {
      const n = s.source ? clone(s.source) : { name: 'side', children: [] };
      id(n);
      set(n, 'plane', s.points.map(p => `(${tuple(v(p).applyMatrix4(m)).map(num).join(' ')})`).join(' '));
      set(n, 'material', s.material);
      if (!get(n, 'uaxis')) {
        const normal = planeOf(s).normal.clone().transformDirection(m);
        set(n, 'uaxis', Math.abs(normal.x) > 0.5 ? '[0 1 0 0] 0.25' : '[1 0 0 0] 0.25');
        set(n, 'vaxis', Math.abs(normal.z) > 0.5 ? '[0 -1 0 0] 0.25' : '[0 0 -1 0] 0.25');
        set(n, 'rotation', '0');
        set(n, 'lightmapscale', '16');
        set(n, 'smoothing_groups', '0');
      }
      node.children!.push(n);
    });
    return node;
  }
  let world = root.find(n => n.name === 'world');
  world = world ? stripSolids(world) : { name: 'world', children: [{ name: 'id', value: '1' }] };
  Object.entries(project.world).forEach(([k, value]) => set(world!, k, value));
  set(world, 'mapversion', '1');
  project.objects.filter(o => o.kind === 'brush' && !o.parent).forEach(o => world!.children!.push(solid(o)));
  const output = root.filter(n => !['world', 'entity'].includes(n.name)).map(n => (n.name === 'hidden' ? { ...n, children: n.children?.filter(c => c.name !== 'entity') } : n));
  if (!output.some(n => n.name === 'versioninfo'))
    output.unshift({
      name: 'versioninfo',
      children: [
        { name: 'editorversion', value: '400' },
        { name: 'editorbuild', value: '0' },
        { name: 'mapversion', value: '1' },
        { name: 'formatversion', value: '100' },
        { name: 'prefab', value: '0' }
      ]
    });
  output.push(world);
  project.objects
    .filter(o => o.kind === 'entity')
    .forEach(o => {
      const node = o.source ? stripSolids(clone(o.source)) : { name: 'entity', children: [] };
      id(node);
      node.children = node.children?.filter(c => c.value === undefined || c.name === 'id');
      Object.entries(o.props).forEach(([k, value]) => set(node, k, value));
      if (!o.locked) {
        set(node, 'origin', o.position.map(num).join(' '));
        set(node, 'angles', [o.rotation[1], o.rotation[2], o.rotation[0]].map(num).join(' '));
      }
      project.objects.filter(b => b.parent === o.id).forEach(b => node.children!.push(solid(b)));
      output.push(node);
    });
  return writeVMF(output);
}
export function duplicateObject(o: MapObject): MapObject {
  const c = clone(o);
  c.id = uid();
  c.name += ' copy';
  c.position[0] += 64;
  const clear = (n: KV) => {
    n.children = n.children?.filter(k => k.name !== 'id');
    n.children?.forEach(clear);
  };
  if (c.source) clear(c.source);
  c.sides?.forEach(s => {
    if (s.source) clear(s.source);
  });
  return c;
}
export interface Issue {
  level: 'error' | 'warning';
  message: string;
  object?: string;
}
export function validate(project: Project): Issue[] {
  const issues: Issue[] = [];
  if (!project.objects.some(o => o.kind === 'entity' && /^info_player_/.test(o.props.classname ?? '')))
    issues.push({ level: 'warning', message: 'No player spawn. Add the spawn entity for your target game.' });
  const skyFaces = project.objects.some(o => o.sides?.some(side => /TOOLS(?:2D)?SKYBOX/i.test(side.material)));
  if (skyFaces && !project.world.skyname?.trim()) issues.push({ level: 'error', message: 'Sky surfaces require a worldspawn skyname. Set it in Map properties.' });
  if (skyFaces && !project.objects.some(o => o.props.classname === 'light_environment')) issues.push({ level: 'warning', message: 'Sky surfaces have no light_environment. Add sunlight if outdoor lighting is intended.' });
  if (project.objects.filter(o => o.props.classname === 'sky_camera').length > 1) issues.push({ level: 'warning', message: 'Multiple sky_camera entities: check the target game supports this setup.' });
  project.objects.filter(o => o.kind === 'entity' && o.props.classname === 'func_instance').forEach(o => issues.push({ level: 'warning', message: `${o.name}: instance is preserved but not expanded or previewed.`, object: o.id }));
  const names = new Set(project.objects.map(o => o.props.targetname).filter(Boolean));
  project.objects.forEach(o => {
    if (o.kind === 'brush' && brushFaces(o.sides ?? []).filter(f => f.length).length < 4) issues.push({ level: 'error', message: `${o.name}: invalid or unsupported convex solid.`, object: o.id });
    if (o.locked) issues.push({ level: 'warning', message: `${o.name}: protected import data; editing is disabled.`, object: o.id });
    const b = bounds(o);
    if (!b.isEmpty() && [...b.min.toArray(), ...b.max.toArray()].some(n => Math.abs(n) > 16384))
      issues.push({ level: 'error', message: `${o.name}: outside the standard Source coordinate range.`, object: o.id });
    if (o.kind === 'entity' && o.props.classname === 'prop_static' && !o.props.model) issues.push({ level: 'error', message: `${o.name}: prop_static needs a model path.`, object: o.id });
    const connections = o.source?.children?.find(c => c.name === 'connections');
    connections?.children?.forEach(c => {
      const target = c.value?.split(/[,\x1b]/)[0];
      if (target && !target.startsWith('!') && !target.includes('*') && !names.has(target))
        issues.push({ level: 'warning', message: `${o.name}: output target "${target}" was not found.`, object: o.id });
    });
  });
  return issues;
}
export function readProject(text: string): Project {
  const p = JSON.parse(text);
  if (p.format !== 'forge' || p.version !== 1 || !Array.isArray(p.objects) || !Array.isArray(p.root) || !p.world || typeof p.name !== 'string') throw Error('Not a Forge v1 project');
  const ids = new Set<string>();
  for (const o of p.objects) {
    if (!o.id || ids.has(o.id) || !['brush', 'entity'].includes(o.kind) || typeof o.name !== 'string' || !o.props) throw Error('Invalid project object');
    ids.add(o.id);
    for (const k of ['position', 'rotation', 'scale'])
      if (!Array.isArray(o[k]) || o[k].length !== 3 || o[k].some((n: unknown) => typeof n !== 'number' || !Number.isFinite(n))) throw Error('Invalid object transform');
    if (o.scale.some((n: number) => n <= 0)) throw Error('Scale must be positive');
    if (
      o.kind === 'brush' &&
      (!Array.isArray(o.sides) || o.sides.some((s: Side) => typeof s.material !== 'string' || s.points.length !== 3 || s.points.some(p => p.length !== 3 || p.some(n => !Number.isFinite(n)))))
    )
      throw Error('Invalid brush');
  }
  return p;
}
