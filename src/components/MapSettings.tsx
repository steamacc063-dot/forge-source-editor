import { useState } from 'react';
import { Box3, Vector3 } from 'three';
import { bounds, box, clone, entity, type Project } from '../model';

/** Map-level settings write native worldspawn keys; they are not viewport effects. */
export function MapSettings({ project, onChange }: { project: Project; onChange: (project: Project) => void }) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const update = (name: string, text: string) => onChange({ ...clone(project), world: { ...project.world, [name]: text } });
  function enclose() {
    const next = clone(project);
    const extent = new Box3();
    next.objects.forEach(o => extent.union(bounds(o)));
    if (extent.isEmpty()) extent.set(new Vector3(-512, -512, 0), new Vector3(512, 512, 512));
    extent.expandByScalar(128);
    const min = extent.min, max = extent.max, center = extent.getCenter(new Vector3()), size = extent.getSize(new Vector3());
    for (let axis = 0; axis < 3; axis++) for (const side of [-1, 1]) {
      const position = center.toArray() as [number, number, number];
      position[axis] = (side < 0 ? min.getComponent(axis) : max.getComponent(axis)) + side * 8;
      const dimensions = size.toArray() as [number, number, number];
      dimensions[axis] = 16;
      next.objects.push(box(`Sky boundary ${'XYZ'[axis]} ${side}`, position, dimensions, 'TOOLS/TOOLSSKYBOX'));
    }
    onChange(next);
  }
  function addEnvironment(classname: string, props: Record<string, string>) {
    const next = clone(project);
    next.objects.push(entity(classname, [0, 0, 256], props));
    onChange(next);
  }
  return <div className="inspector-scroll">
    <section className="inspector-section"><h3>Map properties · worldspawn</h3>
      <label className="field-label">Skybox texture name<input aria-label="Skybox texture name" value={project.world.skyname ?? ''} onChange={e => update('skyname', e.target.value)} placeholder="sky_day01_01" /></label>
      <p className="field-hint">Use the sky name available in your game, without skybox/ or face suffixes. Game sky textures are not previewed here.</p>
      <button onClick={enclose}>Create sky boundary</button>
      <p className="field-hint">Adds six sky brushes outside the map bounds. Existing walls remain intact. Open only the surfaces that should show the sky; compile to check for leaks. Undo removes the boundary.</p>
    </section>
    <section className="inspector-section"><h3>Environment helpers</h3>
      <button onClick={() => addEnvironment('light_environment', { _light: '255 245 220 600', _ambient: '170 195 230 80', pitch: '-45' })}>Add sunlight</button>
      <button onClick={() => addEnvironment('env_fog_controller', { fog_enable: '1', fog_color: '150 170 190', fog_start: '512', fog_end: '4096' })}>Add fog controller</button>
      <button onClick={() => addEnvironment('sky_camera', { scale: '16' })}>Add 3D sky camera</button>
      <p className="field-hint">Move a sky_camera into a separate sealed miniature scene. Adding the camera alone does not create a 3D skybox.</p>
    </section>
    <section className="inspector-section"><h3>Other world properties</h3>
      {Object.entries(project.world).filter(([name]) => !['skyname', 'id', 'classname', 'mapversion'].includes(name)).map(([name, text]) => <label className="field-label" key={name}>{name}<input value={text} onChange={e => update(name, e.target.value)} /></label>)}
      <form onSubmit={e => { e.preventDefault(); if (key.trim() && !['id','classname','mapversion'].includes(key.trim())) { update(key.trim(), value); setKey(''); setValue(''); } }}>
        <label className="field-label">Property name<input required value={key} onChange={e => setKey(e.target.value)} /></label>
        <label className="field-label">Property value<input value={value} onChange={e => setValue(e.target.value)} /></label>
        <button type="submit">Add world property</button>
      </form>
    </section>
  </div>;
}
