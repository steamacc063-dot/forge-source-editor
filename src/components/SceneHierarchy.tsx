import { useState } from 'react';
import { Plus, Search, ChevronDown, Layers, Box, Lightbulb, UserRound, Eye, EyeOff, Boxes } from 'lucide-react';
import { clone, type Project } from '../model';

interface Props {
  project: Project;
  selected: string | null;
  select: (id: string) => void;
  onFocus: (id: string) => void;
  addBrush: () => void;
  commit: (project: Project) => void;
}

/** Scene presentation and search stay local; document changes go through undo history. */
export function SceneHierarchy({ project, selected, select, onFocus, addBrush, commit }: Props) {
  const [filter, setFilter] = useState('');
  const count = project.objects.filter(object => object.kind === 'brush').length;
  return (
<aside className="hierarchy">
          <div className="panel-heading">
            <span>Scene hierarchy</span>
            <button className="icon-button" aria-label="Add brush" title="Add brush (B)" onClick={addBrush}>
              <Plus size={15} />
            </button>
          </div>
          <label className="searchbox small">
            <Search size={13} />
            <input placeholder="Search scene…" aria-label="Search scene" value={filter} onChange={e => setFilter(e.target.value)} />
          </label>
          <div className="scene-root">
            <ChevronDown size={12} />
            <Layers size={13} />
            <span>{project.name}</span>
            <small>{project.objects.length}</small>
          </div>
          <div className="object-list">
            {project.objects
              .filter(o => `${o.name} ${o.props.classname ?? ''}`.toLowerCase().includes(filter.toLowerCase()))
              .map(object => (
                <div key={object.id} className={'object-row ' + (selected === object.id ? 'selected' : '') + (object.hidden ? ' hidden-object' : '')} style={{ paddingLeft: object.parent ? 32 : 15 }}>
                  <button className="object-name" onClick={() => select(object.id)} onDoubleClick={() => onFocus(object.id)}>
                    {object.kind === 'brush' ? <Box size={14} /> : object.props.classname?.startsWith('light') ? <Lightbulb size={14} /> : <UserRound size={14} />}
                    <span>{object.name}</span>
                    {object.locked && <small>locked</small>}
                  </button>
                  <button
                    className="eye-button"
                    title={object.hidden ? 'Show object' : 'Hide object'}
                    aria-label={`${object.hidden ? 'Show' : 'Hide'} ${object.name}`}
                    onClick={() => {
                      const next = clone(project);
                      next.objects.find(o => o.id === object.id)!.hidden = !object.hidden;
                      commit(next);
                    }}
                  >
                    {object.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              ))}
            {!project.objects.length && (
              <div className="empty">
                <Boxes size={26} />
                <p>Your map starts here.</p>
                <button onClick={addBrush}>Add a brush</button>
              </div>
            )}
          </div>
          <div className="hierarchy-footer">
            <span>
              <Box size={12} />
              {count} brushes
            </span>
            <span>{project.objects.length - count} entities</span>
          </div>
        </aside>
  );
}
