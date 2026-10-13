import { test } from 'node:test';
import assert from 'node:assert/strict';
import { box, brushFaces, bounds, clone, duplicateObject, entity, exportVMF, get, importVMF, newProject, parseVMF, planeOf, readProject, set, validate, writeVMF } from '../src/model';

test('VBSP clockwise planes form a closed six-face cube', () => {
  const b = box('Cube', [128, 256, 64], [64, 128, 32]);
  const faces = brushFaces(b.sides!);
  assert.equal(faces.length, 6);
  faces.forEach(f => assert.equal(f.length, 4));
  assert.deepEqual(bounds(b).min.toArray(), [96, 192, 48]);
  assert.deepEqual(bounds(b).max.toArray(), [160, 320, 80]);
  b.sides!.forEach(s => assert.ok(planeOf(s).distanceToPoint({ x: 0, y: 0, z: 0 } as any) < 0));
});
test('rotation, scale and translation survive a VMF round trip as actual planes', () => {
  const p = newProject(false),
    b = box('Cube', [100, -50, 64], [128, 64, 32]);
  b.rotation = [15, 30, 45];
  b.scale = [2, 1, 3];
  p.objects = [b];
  const imported = importVMF(exportVMF(p));
  const a = bounds(b),
    r = bounds(imported.objects[0]);
  a.min.toArray().forEach((n, i) => assert.ok(Math.abs(n - r.min.toArray()[i]) < 0.001));
  a.max.toArray().forEach((n, i) => assert.ok(Math.abs(n - r.max.toArray()[i]) < 0.001));
});
test('sample is sealed, has a spawn and light, and exports unique IDs', () => {
  const p = newProject(),
    text = exportVMF(p),
    q = importVMF(text);
  assert.equal(q.objects.length, p.objects.length);
  assert.equal(validate(q).filter(i => i.level === 'error').length, 0);
  assert.ok(q.objects.find(o => o.props.classname === 'info_player_start'));
  const ids = [...text.matchAll(/"id" "(\d+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
});
test('duplicate brushes allocate new solid and side IDs', () => {
  const p = importVMF(exportVMF(newProject()));
  const b = p.objects.find(o => o.kind === 'brush')!;
  p.objects.push(duplicateObject(b));
  const text = exportVMF(p);
  const ids = [...text.matchAll(/"id" "(\d+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(importVMF(text).objects.length, p.objects.length);
});
test('unknown VMF chunks, repeated outputs, per-face UV and brush entities are preserved', () => {
  const root = parseVMF(exportVMF(newProject(false)));
  const p = newProject(false);
  p.objects = [box('Brush', [0, 0, 0], [128, 128, 128]), entity('func_detail', [0, 0, 0], { targetname: 'detail' })];
  p.objects[0].parent = p.objects[1].id;
  const r = parseVMF(exportVMF(p)),
    ent = r.find(n => n.name === 'entity')!,
    solid = ent.children!.find(n => n.name === 'solid')!,
    side = solid.children!.find(n => n.name === 'side')!;
  set(side, 'uaxis', '[0 1 0 23] 0.5');
  set(side, 'vaxis', '[0 0 -1 7] 0.25');
  ent.children!.push({
    name: 'connections',
    children: [
      { name: 'OnTrigger', value: 'door,Open,,0,-1' },
      { name: 'OnTrigger', value: 'door,Close,,1,-1' }
    ]
  });
  r.push({ name: 'custom_chunk', children: [{ name: 'future-data', value: 'Keep me' }] });
  const q = importVMF(writeVMF(r));
  const out = parseVMF(exportVMF(q));
  assert.deepEqual(
    out.find(n => n.name === 'custom_chunk'),
    r.find(n => n.name === 'custom_chunk')
  );
  const e = out.find(n => n.name === 'entity')!;
  assert.equal(e.children!.find(n => n.name === 'connections')!.children!.length, 2);
  const s = e.children!.find(n => n.name === 'solid')!.children!.find(n => n.name === 'side')!;
  assert.equal(get(s, 'uaxis'), '[0 1 0 23] 0.5');
  assert.equal(get(s, 'vaxis'), '[0 0 -1 7] 0.25');
  assert.equal(q.objects.find(o => o.kind === 'brush')!.parent, q.objects.find(o => o.kind === 'entity')!.id);
  assert.ok(root.length);
});
test('displacement data is protected and exported without plane changes', () => {
  const r = parseVMF(exportVMF(newProject()));
  const world = r.find(n => n.name === 'world')!,
    solid = world.children!.find(n => n.name === 'solid')!;
  solid
    .children!.find(n => n.name === 'side')!
    .children!.push({
      name: 'dispinfo',
      children: [
        { name: 'power', value: '2' },
        { name: 'normals', children: [{ name: 'row0', value: '0 0 1 0 0 1' }] }
      ]
    });
  const q = importVMF(writeVMF(r));
  const locked = q.objects.find(o => o.locked)!;
  assert.ok(locked);
  const original = clone(locked.source);
  locked.position[0] += 500;
  const exported = parseVMF(exportVMF(q))
    .find(n => n.name === 'world')!
    .children!.find(n => n.name === 'solid' && get(n, 'id') === get(original!, 'id'));
  assert.deepEqual(exported, original);
});
test('parser handles escapes and duplicate keys and rejects malformed input', () => {
  const n = parseVMF('world { "classname" "worldspawn" "path" "models\\props\\a.mdl" connections { "OnTrigger" "a" "OnTrigger" "b" } } // comment');
  assert.deepEqual(parseVMF(writeVMF(n)), n);
  assert.throws(() => parseVMF('world { "x" "unterminated'));
  assert.throws(() => parseVMF('world { "x" "y"'));
  assert.throws(() => importVMF('entity {}'));
});
test('invalid project transforms are rejected and diagnostics find broken maps', () => {
  const p = newProject(false);
  p.objects = [box('Invalid', [20000, 0, 0], [128, 128, 128]), entity('prop_static', [0, 0, 0])];
  const issues = validate(p);
  assert.ok(issues.some(i => i.message.includes('coordinate')));
  assert.ok(issues.some(i => i.message.includes('model path')));
  assert.ok(issues.some(i => i.message.includes('spawn')));
  p.objects[0].scale[0] = 0;
  assert.throws(() => readProject(JSON.stringify(p)));
});
