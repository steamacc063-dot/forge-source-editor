import { SceneHierarchy } from './components/SceneHierarchy';
import { VectorInput } from './components/VectorInput';
import { download } from './lib/download';
import { MATERIALS, ENTITIES } from './lib/catalog';
import { MapSettings } from './components/MapSettings';
import { Vector3 } from 'three';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Box,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Crosshair,
  FolderOpen,
  Grid3X3,
  Hammer,
  Layers,
  Lightbulb,
  Maximize,
  Move,
  Plus,
  Redo2,
  RotateCw,
  Save,
  Search,
  Settings2,
  Terminal,
  Trash2,
  Undo2,
  UserRound,
  X,
  AlertTriangle,
  Compass,
} from 'lucide-react';
import { bounds, box, clone, duplicateObject, entity, exportVMF, importVMF, newProject, readProject, room, stairs, validate, type KV, type MapObject, type Project, type V3 } from './model';
import { Viewport, type ViewHandle, type ViewMode } from './Viewport';
import { Commands, type Action } from './Commands';
import type { SDKConfig } from './desktop';
import './style.css';
import './classic-theme.css';

function initial(): Project {
  try {
    const saved = localStorage.getItem('forge.autosave');
    if (saved) return readProject(saved);
  } catch {}
  const p = newProject();
  p.objects.filter(o => o.name === 'Ceiling' || o.name === 'South wall').forEach(o => (o.hidden = true));
  return p;
}
export default function App() {
  const [project, setProject] = useState<Project>(initial);
  const pRef = useRef(project);
  pRef.current = project;
  const [selected, setSelected] = useState<string | null>(null);
  const [past, setPast] = useState<Project[]>([]),
    [future, setFuture] = useState<Project[]>([]);
  const [saved, setSaved] = useState(() => JSON.stringify(project));
  const [recovery, setRecovery] = useState('Ready');
  const [tool, setTool] = useState<'translate' | 'rotate' | 'scale'>('translate'),
    [snap, setSnap] = useState(16),
    [view, setView] = useState<ViewMode>('perspective'),
    [wire, setWire] = useState(false),
    [fly, setFly] = useState(false);
  const [tab, setTab] = useState<'materials' | 'prefabs' | 'entities' | 'console' | 'issues'>('materials');
  const [query, setQuery] = useState('');
  const [face, setFace] = useState(-1);
  const [status, setStatus] = useState('Welcome to Forge. Your workspace is saved locally.');
  const [modal, setModal] = useState<'build' | 'help' | 'property' | 'output' | null>(null);
  const [propKey, setPropKey] = useState(''),
    [propValue, setPropValue] = useState('');
  const [output, setOutput] = useState({ event: 'OnTrigger', target: '', input: 'Trigger', parameter: '', delay: '0', once: false });
  const [config, setConfig] = useState<SDKConfig>({ binDir: '', gameDir: '', fast: false });
  const [building, setBuilding] = useState(false),
    [log, setLog] = useState('Forge build console\nSDK tools run locally in the desktop app.\n'),
    [bsp, setBsp] = useState('');
  const [layout, setLayout] = useState({ left: 238, right: 282, bottom: 225 });
  const viewport = useRef<ViewHandle>(null),
    file = useRef<HTMLInputElement>(null);
  const o = project.objects.find(o => o.id === selected);
  const issues = validate(project);
  const dirty = JSON.stringify(project) !== saved;
  const commit = (next: Project) => {
    setPast(h => [...h.slice(-79), clone(pRef.current)]);
    setFuture([]);
    setProject(next);
  };
  const edit = (id: string, patch: Partial<MapObject>) => {
    const next = clone(pRef.current),
      object = next.objects.find(o => o.id === id);
    if (!object || object.locked) return;
    Object.assign(object, patch);
    commit(next);
  };
  const select = (id: string | null) => {
    setSelected(id);
    setFace(-1);
  };
  const notify = (text: string) => setStatus(text);
  const undo = () => {
    if (!past.length) return;
    setFuture(h => [clone(project), ...h]);
    setProject(past[past.length - 1]);
    setPast(h => h.slice(0, -1));
    notify('Undone');
  };
  const redo = () => {
    if (!future.length) return;
    setPast(h => [...h, clone(project)]);
    setProject(future[0]);
    setFuture(h => h.slice(1));
    notify('Redone');
  };
  function add(objects: MapObject[]) {
    const next = clone(pRef.current);
    next.objects.push(...objects);
    commit(next);
    select(objects[0]?.id ?? null);
    notify(`Added ${objects.length === 1 ? objects[0].name : objects.length + ' objects'}`);
  }
  const addBrush = () => add([box('Block', [0, 0, 64], [128, 128, 128])]);
  function remove() {
    if (!o || o.locked) return;
    const next = clone(project);
    next.objects = next.objects.filter(obj => obj.id !== o.id && obj.parent !== o.id);
    commit(next);
    select(null);
    notify(`Deleted ${o.name}`);
  }
  function duplicate() {
    if (!o || o.locked) return;
    add([duplicateObject(o)]);
  }
  async function save(extension = 'forge') {
    try {
      const text = extension === 'forge' ? JSON.stringify(pRef.current, null, 2) : exportVMF(pRef.current);
      if (window.forgeDesktop) {
        const path = await window.forgeDesktop.save({ name: project.name, text, extension });
        if (!path) return;
      } else download(text, `${project.name}.${extension}`);
      if (extension === 'forge') setSaved(JSON.stringify(pRef.current));
      notify(extension === 'forge' ? 'Project saved' : 'VMF exported. Compile it with your game’s Source SDK.');
    } catch (e) {
      notify(String(e));
    }
  }
  function load(name: string, text: string) {
    try {
      const next = name.toLowerCase().endsWith('.vmf') ? importVMF(text, name.replace(/\.vmf$/i, '')) : readProject(text);
      localStorage.setItem('forge.previous', JSON.stringify(pRef.current));
      commit(next);
      select(null);
      setSaved(JSON.stringify(next));
      notify(`Opened ${name} · ${next.objects.length} objects`);
      setTimeout(() => viewport.current?.reset(), 50);
    } catch (e) {
      notify(`Could not open file: ${String(e)}`);
    }
  }
  async function open() {
    try {
      if (window.forgeDesktop) {
        const data = await window.forgeDesktop.open();
        if (data) load(data.name, data.text);
      } else file.current?.click();
    } catch (e) {
      notify(String(e));
    }
  }
  function applyMaterial(path: string) {
    if (!o || o.kind !== 'brush' || o.locked) {
      notify('Select an editable brush to apply a material.');
      return;
    }
    edit(o.id, { sides: o.sides?.map((s, i) => (face === -1 || face === i ? { ...s, material: path } : s)) });
  }
  function resize(which: 'left' | 'right' | 'bottom', e: React.PointerEvent) {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, ...layout };
    const move = (event: PointerEvent) =>
      setLayout(l => ({
        ...l,
        [which]: Math.max(
          which === 'bottom' ? 150 : 190,
          Math.min(
            which === 'bottom' ? 430 : 400,
            which === 'left' ? start.left + event.clientX - start.x : which === 'right' ? start.right - event.clientX + start.x : start.bottom - event.clientY + start.y
          )
        )
      }));
    const done = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', done);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', done);
  }
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem('forge.autosave', JSON.stringify(project));
        setRecovery('Recovery saved');
      } catch {
        setRecovery('Recovery unavailable · save to file');
      }
    }, 600);
    return () => clearTimeout(t);
  }, [project]);
  useEffect(() => {
    if (!window.forgeDesktop) return;
    window.forgeDesktop.readPrefs().then(p => setConfig(c => ({ ...c, ...p })));
    return window.forgeDesktop.onBuildLog(s => setLog(l => (l + s).slice(-300000)));
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,textarea,select') || modal || document.pointerLockElement) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'k') return;
      if (mod && k === 's') {
        e.preventDefault();
        void save();
      } else if (mod && k === 'o') {
        e.preventDefault();
        void open();
      } else if (mod && k === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        redo();
      } else if (mod && k === 'd') {
        e.preventDefault();
        duplicate();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        remove();
      } else if (k === 'w') setTool('translate');
      else if (k === 'e') setTool('rotate');
      else if (k === 'r') setTool('scale');
      else if (k === 'f') viewport.current?.focus(selected ?? undefined);
      else if (k === 'escape') {
        setFly(false);
        select(null);
      } else if (k === 'b') addBrush();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  async function build() {
    try {
      if (!window.forgeDesktop) return;
      if (issues.some(i => i.level === 'error')) {
        notify('Resolve map errors before building.');
        setModal(null);
        setTab('issues');
        return;
      }
      setBuilding(true);
      setTab('console');
      setModal(null);
      setLog('Starting Source SDK build…\n');
      await window.forgeDesktop.savePrefs(config);
      const result = await window.forgeDesktop.build({ config, vmf: exportVMF(pRef.current), name: project.name });
      if (result) {
        setBsp(result);
        notify('Build complete. BSP is ready.');
      } else notify('Build cancelled.');
    } catch (e) {
      setLog(l => l + `\n✕ ${String(e)}\n`);
      notify('Build failed. See the console.');
    } finally {
      setBuilding(false);
    }
  }
  const actions: Action[] = [
    { label: 'Add brush', shortcut: 'B', run: addBrush },
    { label: 'Add player spawn', run: () => add([entity('info_player_start', [0, 0, 40])]) },
    { label: 'Add point light', run: () => add([entity('light', [0, 0, 256], { _light: '255 238 210 500' })]) },
    { label: 'Open project or VMF', shortcut: '⌘ O', run: () => void open() },
    { label: 'Save project', shortcut: '⌘ S', run: () => void save() },
    { label: 'Export VMF', run: () => void save('vmf') },
    { label: 'Focus selection', shortcut: 'F', run: () => viewport.current?.focus(selected ?? undefined) },
    { label: 'Undo', shortcut: '⌘ Z', run: undo },
    { label: 'Redo', shortcut: '⇧ ⌘ Z', run: redo },
    { label: 'Validate map', run: () => setTab('issues') },
    { label: 'Build map', run: () => setModal('build') },
    {
      label: 'New empty map',
      run: () => {
        commit(newProject(false));
        select(null);
        notify('New map. Undo restores your previous map.');
      }
    },
    {
      label: 'Restore previous opened project',
      run: () => {
        const p = localStorage.getItem('forge.previous');
        if (p) load('previous.forge', p);
        else notify('No previous project is available.');
      }
    }
  ];
  const count = project.objects.filter(o => o.kind === 'brush').length;
  const connected = o?.source?.children?.find(c => c.name === 'connections');
  return (
    <div
      className="app"
      style={{ '--left': layout.left + 'px', '--right': layout.right + 'px', '--bottom': layout.bottom + 'px' } as CSSProperties}
      onDragOver={e => e.preventDefault()}
      onDrop={async e => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f && /\.(vmf|forge)$/i.test(f.name)) {
          if (f.size > 32 * 1024 * 1024) {
            notify('File exceeds the 32 MB limit.');
            return;
          }
          load(f.name, await f.text());
        }
      }}
    >
      <input
        ref={file}
        type="file"
        accept=".vmf,.forge"
        hidden
        onChange={async e => {
          const f = e.target.files?.[0];
          if (f) {
            if (f.size > 32 * 1024 * 1024) notify('File exceeds the 32 MB limit.');
            else load(f.name, await f.text());
          }
          e.target.value = '';
        }}
      />
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Layers size={18} />
          </div>
          <strong>FORGE</strong>
          <span className="version">0.1</span>
        </div>
        <nav className="menubar">
          <button
            onClick={() => {
              commit(newProject(false));
              select(null);
              notify('New map. Undo restores your previous map.');
            }}
          >
            New
          </button>
          <button onClick={() => void open()}>Open</button>
          <button onClick={() => void save()}>Save</button>
          <button onClick={() => void save('vmf')}>Export</button>
        </nav>
        <div className="top-spacer" />
        <Commands actions={actions} />
        <button className="icon-button" title="Editor help" onClick={() => setModal('help')} aria-label="Editor help">
          <CircleHelp size={17} />
        </button>
        <span className="engine-pill">
          <span /> SOURCE 1
        </span>
      </header>
      <div className="toolbar">
        <div className="project-title">
          <Box size={15} />
          <input aria-label="Map name" value={project.name} onChange={e => commit({ ...clone(project), name: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '_') || 'untitled' })} />
          {dirty && <span className="dirty-dot" />}
        </div>
        <div className="divider" />
        <button className="icon-button" title="Undo (⌘ Z)" aria-label="Undo" disabled={!past.length} onClick={undo}>
          <Undo2 size={16} />
        </button>
        <button className="icon-button" title="Redo (⇧ ⌘ Z)" aria-label="Redo" disabled={!future.length} onClick={redo}>
          <Redo2 size={16} />
        </button>
        <div className="divider" />
        {(
          [
            { mode: 'translate', label: 'Move', key: 'W', icon: Move },
            { mode: 'rotate', label: 'Rotate', key: 'E', icon: RotateCw },
            { mode: 'scale', label: 'Scale', key: 'R', icon: Maximize }
          ] as const
        ).map(t => (
          <button key={t.mode} className={'tool-button ' + (tool === t.mode ? 'selected' : '')} title={`${t.label} (${t.key})`} onClick={() => setTool(t.mode)}>
            <t.icon size={16} />
            <span>{t.label}</span>
          </button>
        ))}
        <div className="divider" />
        <Grid3X3 size={14} className="muted" />
        <select aria-label="Grid snap" value={snap} onChange={e => setSnap(Number(e.target.value))}>
          <option value={0}>Snap off</option>
          {[1, 4, 8, 16, 32, 64, 128].map(n => (
            <option key={n} value={n}>
              {n} units
            </option>
          ))}
        </select>
        <div className="top-spacer" />
        <button
          className={'tool-button ' + (fly ? 'selected' : '')}
          onClick={() => {
            setView('perspective');
            setFly(f => !f);
          }}
          title="Free camera preview, without Source physics"
        >
          <Compass size={16} />
          Fly preview
        </button>
        <button className="build-button" disabled={building} onClick={() => setModal('build')}>
          <Hammer size={15} />
          {building ? 'Building…' : 'Build map'}
          <ChevronDown size={12} />
        </button>
      </div>
      <main className="workspace">
        <SceneHierarchy project={project} selected={selected} select={select} onFocus={id => viewport.current?.focus(id)} addBrush={addBrush} commit={commit} />
        <div className="split vertical" onPointerDown={e => resize('left', e)} />
        <section className="center">
          <div className="scene-tab">
            <Box size={13} />
            <span>{project.name}</span>
            <small>.vmf workspace</small>
            <div className="top-spacer" />
            <span className="live-dot" />
            <small>Local workspace</small>
          </div>
          <div className="viewport">
            <div className="viewport-bar">
              <select
                aria-label="Viewport view"
                value={view}
                onChange={e => {
                  setView(e.target.value as ViewMode);
                  setFly(false);
                }}
              >
                <option value="perspective">Perspective</option>
                <option value="top">Top · XY</option>
                <option value="front">Front · XZ</option>
                <option value="side">Side · YZ</option>
              </select>
              <button className={wire ? 'active' : ''} onClick={() => setWire(w => !w)}>
                <Grid3X3 size={13} />
                {wire ? 'Wireframe' : 'Shaded'}
              </button>
              <span className="viewport-badge">{fly ? 'FREE CAMERA' : '3D VIEWPORT'}</span>
            </div>
            <Viewport
              ref={viewport}
              objects={project.objects}
              selected={selected}
              tool={tool}
              snap={snap}
              view={view}
              wire={wire}
              fly={fly}
              onSelect={select}
              onTransform={(id, position, rotation, scale) => edit(id, { position, rotation, scale })}
              onFlyEnd={() => setFly(false)}
              onError={notify}
            />
            <div className="axis-widget">
              <span className="axis-z">Z</span>
              <span className="axis-y">Y</span>
              <span className="axis-x">X</span>
              <Crosshair size={35} />
            </div>
            <div className="viewport-help">{fly ? 'Click viewport · WASD move · Q/E vertical · Shift faster · Esc exit' : 'Drag to orbit · Right drag to pan · Scroll to zoom · F to focus'}</div>
            <button className="focus-button" title="Frame all objects" aria-label="Frame all objects" onClick={() => viewport.current?.reset()}>
              <Maximize size={16} />
            </button>
          </div>
          <div className="split horizontal" onPointerDown={e => resize('bottom', e)} />
          <section className="content">
            <div className="content-heading">
              <div className="tabs">
                {(
                  [
                    { id: 'materials', label: 'Materials', icon: Grid3X3 },
                    { id: 'prefabs', label: 'Prefabs', icon: Boxes },
                    { id: 'entities', label: 'Entities', icon: Lightbulb },
                    { id: 'console', label: 'Console', icon: Terminal },
                    { id: 'issues', label: 'Map checks', icon: AlertTriangle }
                  ] as const
                ).map(t => (
                  <button
                    key={t.id}
                    className={tab === t.id ? 'active' : ''}
                    onClick={() => {
                      setTab(t.id);
                      setQuery('');
                    }}
                  >
                    <t.icon size={13} />
                    {t.label}
                    {t.id === 'issues' && issues.length > 0 && <span className="count">{issues.length}</span>}
                  </button>
                ))}
              </div>
            </div>
            {['materials', 'prefabs', 'entities'].includes(tab) && (
              <div className="content-tools">
                <span className="breadcrumb">
                  <FolderOpen size={13} />
                  Project <ChevronRight size={12} />
                  <strong>{tab[0].toUpperCase() + tab.slice(1)}</strong>
                </span>
                <div className="top-spacer" />
                <label className="searchbox small">
                  <Search size={13} />
                  <input aria-label="Search assets" placeholder={`Search ${tab}…`} value={query} onChange={e => setQuery(e.target.value)} />
                </label>
              </div>
            )}
            <div className="content-body">
              {tab === 'materials' && (
                <>
                  <div className="asset-grid">
                    {MATERIALS.filter(m => `${m.name} ${m.path}`.toLowerCase().includes(query.toLowerCase())).map(m => (
                      <button
                        className={'material-card ' + (o?.sides?.[face < 0 ? 0 : face]?.material === m.path ? 'chosen' : '')}
                        key={m.path}
                        title={`Apply ${m.path}`}
                        onClick={() => applyMaterial(m.path)}
                      >
                        <div className={'material-swatch ' + (m.path.startsWith('DEV') ? 'checker' : 'tool-swatch')} style={{ '--swatch': m.color } as CSSProperties}>
                          {m.path.startsWith('TOOLS') ? <Grid3X3 size={25} /> : <span>128 × 128</span>}
                        </div>
                        <strong>{m.name}</strong>
                        <small>{m.path.split('/')[0].toLowerCase()}</small>
                      </button>
                    ))}
                  </div>
                  <div className="content-note">Select a brush, then click a material. Game textures use material paths; this viewport shows blockout previews.</div>
                </>
              )}
              {tab === 'prefabs' && (
                <div className="asset-grid prefab-grid">
                  {[
                    { label: 'Sealed room', desc: '6 brushes + spawn + light', icon: Boxes, run: () => add(room([1536, 0, 0])) },
                    { label: 'Staircase', desc: '8 steps · 16-unit rise', icon: Layers, run: () => add(stairs()) },
                    { label: 'Platform', desc: '256 × 256 × 64 units', icon: Box, run: () => add([box('Platform', [0, 0, 32], [256, 256, 64])]) },
                    {
                      label: 'Save selection',
                      desc: 'Reusable .forge prefab',
                      icon: Save,
                      run: () => {
                        if (!o) {
                          notify('Select an object first.');
                          return;
                        }
                        const prefab = newProject(false);
                        const base = clone(o);
                        if (base.parent) {
                          delete base.parent;
                          notify('Brush prefab saved as world geometry.');
                        }
                        prefab.name = o.name;
                        prefab.objects = [base];
                        download(JSON.stringify(prefab, null, 2), 'prefab.forge');
                        notify('Saved prefab. Use Import prefab to place it.');
                      }
                    },
                    {
                      label: 'Import prefab',
                      desc: 'Place a .forge project',
                      icon: ArrowUpFromLine,
                      run: () => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.forge';
                        input.onchange = async () => {
                          const f = input.files?.[0];
                          if (!f) return;
                          try {
                            const imported = readProject(await f.text());
                            if (imported.objects.some(o => o.locked)) throw Error('This prefab contains protected imported data. Open it as a project instead.');
                            const copied = imported.objects.map(duplicateObject);
                            const mapping = new Map(imported.objects.map((o, i) => [o.id, copied[i].id]));
                            copied.forEach(o => {
                              if (o.parent) o.parent = mapping.get(o.parent);
                            });
                            add(copied);
                          } catch (e) {
                            notify(String(e));
                          }
                        };
                        input.click();
                      }
                    }
                  ]
                    .filter(p => p.label.toLowerCase().includes(query.toLowerCase()))
                    .map(p => (
                      <button className="prefab-card" key={p.label} onClick={p.run}>
                        <div>
                          <p.icon size={29} />
                          <Plus size={13} />
                        </div>
                        <strong>{p.label}</strong>
                        <small>{p.desc}</small>
                      </button>
                    ))}
                </div>
              )}
              {tab === 'entities' && (
                <div className="entity-grid">
                  {ENTITIES.filter(e => `${e.label} ${e.class}`.toLowerCase().includes(query.toLowerCase())).map(e => (
                    <button key={e.class} onClick={() => add([entity(e.class, [0, 0, e.class.startsWith('light') ? 256 : 40], e.props as Record<string, string>)])}>
                      <e.icon size={19} />
                      <div>
                        <strong>{e.label}</strong>
                        <small>{e.class}</small>
                      </div>
                      <Plus size={13} />
                    </button>
                  ))}
                </div>
              )}
              {tab === 'console' && (
                <>
                  <div className="console-actions">
                    <span>{building ? 'SDK build running' : 'Build output'}</span>
                    {building && <button onClick={() => void window.forgeDesktop?.cancelBuild()}>Cancel build</button>}
                    {bsp && <button onClick={() => void window.forgeDesktop?.reveal(bsp)}>Reveal BSP</button>}
                    <button onClick={() => setLog('')}>Clear</button>
                  </div>
                  <pre className="console">{log || 'No output.'}</pre>
                </>
              )}
              {tab === 'issues' && (
                <div className="issue-list">
                  <p className="content-note">Geometry, spawn, coordinate and entity checks. SDK compilation performs authoritative leak and engine checks.</p>
                  {issues.length ? (
                    issues.map((issue, i) => (
                      <button
                        className={'issue ' + issue.level}
                        key={i}
                        onClick={() => {
                          if (issue.object) {
                            select(issue.object);
                            viewport.current?.focus(issue.object);
                          }
                        }}
                      >
                        <AlertTriangle size={14} />
                        <span>{issue.message}</span>
                        <small>{issue.level}</small>
                      </button>
                    ))
                  ) : (
                    <div className="all-clear">
                      <Check size={22} />
                      Local map checks passed. Ready for SDK validation.
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </section>
        <div className="split vertical" onPointerDown={e => resize('right', e)} />
        <aside className="inspector">
          <div className="panel-heading">
            <span>Inspector</span>
            <Settings2 size={14} />
          </div>
          {o ? (
            <>
              <div className="selected-header">
                <div className={'object-icon ' + o.kind}>{o.kind === 'brush' ? <Box size={22} /> : <Lightbulb size={22} />}</div>
                <div>
                  <input aria-label="Object name" value={o.name} disabled={o.locked} onChange={e => edit(o.id, { name: e.target.value })} />
                  <small>{o.kind === 'brush' ? 'Convex brush' : o.props.classname}</small>
                </div>
              </div>
              {o.locked && <div className="lock-note">Protected imported data. Kept in VMF export; transform and property editing are disabled.</div>}
              <div className="inspector-scroll">
                <section className="inspector-section">
                  <h3>
                    <ChevronDown size={12} />
                    Transform <span>Source units</span>
                  </h3>
                  {(['position', 'rotation', ...(o.kind === 'brush' ? ['scale'] : [])] as const).map(k => (
                    <VectorInput key={k} label={k} values={o[k as 'position' | 'rotation' | 'scale']} disabled={o.locked} onChange={values => edit(o.id, { [k]: values })} />
                  ))}
                  {o.kind === 'brush' && (
                    <div className="dimensions">
                      <span>Bounds</span>
                      <code>{bounds(o).getSize(new Vector3()).toArray().map(Math.round).join(' × ')}</code>
                    </div>
                  )}
                </section>
                {o.kind === 'brush' ? (
                  <section className="inspector-section">
                    <h3>
                      <ChevronDown size={12} />
                      Surface material <span>{o.sides?.length} faces</span>
                    </h3>
                    <select className="full" value={face} onChange={e => setFace(Number(e.target.value))}>
                      <option value={-1}>All faces</option>
                      {o.sides?.map((_, i) => (
                        <option key={i} value={i}>
                          Face {i + 1}
                        </option>
                      ))}
                    </select>
                    <div className="material-preview checker" style={{ '--swatch': MATERIALS.find(m => m.path === o.sides?.[face < 0 ? 0 : face]?.material)?.color ?? '#8d9aaa' } as CSSProperties}>
                      <span>Material preview</span>
                      <Box size={31} />
                    </div>
                    <label className="field-label">
                      Material path
                      <input aria-label="Material path" disabled={o.locked} value={o.sides?.[face < 0 ? 0 : face]?.material ?? ''} onChange={e => applyMaterial(e.target.value)} spellCheck={false} />
                    </label>
                    <p className="field-hint">Use a material available in the target game.</p>
                  </section>
                ) : (
                  <>
                    <section className="inspector-section">
                      <h3>
                        <ChevronDown size={12} />
                        Entity properties
                        <button
                          className="icon-button"
                          aria-label="Add entity property"
                          disabled={o.locked}
                          onClick={() => {
                            setPropKey('');
                            setPropValue('');
                            setModal('property');
                          }}
                        >
                          <Plus size={13} />
                        </button>
                      </h3>
                      {Object.entries(o.props)
                        .filter(([k]) => !['origin', 'angles'].includes(k))
                        .map(([key, value]) => (
                          <label className="field-label" key={key}>
                            {key}
                            <input aria-label={key} value={value} disabled={o.locked} spellCheck={false} onChange={e => edit(o.id, { props: { ...o.props, [key]: e.target.value } })} />
                          </label>
                        ))}
                    </section>
                    <section className="inspector-section">
                      <h3>
                        <ChevronDown size={12} />
                        Entity outputs
                        <button className="icon-button" aria-label="Add entity output" disabled={o.locked} onClick={() => setModal('output')}>
                          <Plus size={13} />
                        </button>
                      </h3>
                      {connected?.children?.length ? (
                        connected.children.map((c, i) => (
                          <div key={i} className="output-row">
                            <div>
                              <strong>{c.name}</strong>
                              <small>{c.value?.replaceAll('\x1b', ',')}</small>
                            </div>
                            <button
                              className="icon-button"
                              aria-label="Remove output"
                              disabled={o.locked}
                              onClick={() => {
                                const source = clone(o.source!);
                                source.children!.find(c => c.name === 'connections')!.children!.splice(i, 1);
                                edit(o.id, { source });
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="field-hint">Connect events to named entities.</p>
                      )}
                    </section>
                  </>
                )}
                <section className="inspector-section">
                  <h3>
                    <ChevronDown size={12} />
                    Editor visibility
                  </h3>
                  <p className="field-hint">The eye in the hierarchy hides objects in the viewport. Hidden objects are still exported to VMF.</p>
                </section>
              </div>
              <div className="inspector-actions">
                <button disabled={o.locked} onClick={duplicate}>
                  <Copy size={14} />
                  Duplicate
                </button>
                <button disabled={o.locked} className="danger" onClick={remove}>
                  <Trash2 size={14} />
                </button>
              </div>
            </>
          ) : (
            <MapSettings project={project} onChange={commit} />
          )}
        </aside>
      </main>
      <footer className="statusbar">
        <span className="live-dot" />
        <span className="status-message" role="status">
          {status}
        </span>
        <span>{recovery}</span>
        <div className="divider" />
        <span>{count} brushes</span>
        <span>{project.objects.length - count} entities</span>
        <div className="divider" />
        <button onClick={() => setTab('issues')}>
          <AlertTriangle size={12} />
          {issues.length}
        </button>
        <span className="platform">{window.forgeDesktop ? 'Desktop' : 'Browser preview'}</span>
      </footer>
      {modal && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!building) setModal(null);
          }}
        >
          <section
            className={'modal ' + (modal === 'help' ? 'help-modal' : '')}
            role="dialog"
            aria-modal="true"
            aria-label={modal === 'build' ? 'Build map' : modal === 'help' ? 'Editor help' : 'Entity editing'}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-heading">
              <strong>{modal === 'build' ? 'Build your map' : modal === 'help' ? 'A new workspace for Source' : modal === 'property' ? 'Add entity property' : 'Connect an entity output'}</strong>
              <button className="icon-button" aria-label="Close dialog" onClick={() => setModal(null)}>
                <X size={18} />
              </button>
            </div>
            {modal === 'build' && (
              <>
                <p>Forge writes your VMF and runs VBSP → VVIS → VRAD with the SDK for your game. The resulting BSP stays beside the chosen VMF file.</p>
                {!window.forgeDesktop && (
                  <div className="lock-note">You’re in the browser preview. Use the included Forge desktop app for SDK builds, or export a VMF and compile in your installed SDK.</div>
                )}
                <label className="field-label">
                  SDK bin directory
                  <div className="path-input">
                    <input
                      aria-label="SDK bin directory"
                      value={config.binDir}
                      onChange={e => setConfig(c => ({ ...c, binDir: e.target.value }))}
                      placeholder="Folder containing vbsp, vvis and vrad"
                    />
                    <button
                      disabled={!window.forgeDesktop}
                      onClick={async () => {
                        const p = await window.forgeDesktop?.directory();
                        if (p) setConfig(c => ({ ...c, binDir: p }));
                      }}
                    >
                      <FolderOpen size={16} />
                    </button>
                  </div>
                </label>
                <label className="field-label">
                  Game directory
                  <div className="path-input">
                    <input aria-label="Game directory" value={config.gameDir} onChange={e => setConfig(c => ({ ...c, gameDir: e.target.value }))} placeholder="Folder containing gameinfo.txt" />
                    <button
                      disabled={!window.forgeDesktop}
                      onClick={async () => {
                        const p = await window.forgeDesktop?.directory();
                        if (p) setConfig(c => ({ ...c, gameDir: p }));
                      }}
                    >
                      <FolderOpen size={16} />
                    </button>
                  </div>
                </label>
                <label className="checkbox">
                  <input type="checkbox" checked={config.fast} onChange={e => setConfig(c => ({ ...c, fast: e.target.checked }))} />
                  Fast visibility and lighting for iteration
                </label>
                <p className="field-hint">
                  Choose tools that run on your operating system. Forge does not bundle Valve’s SDK. For game testing, put the BSP in the game’s maps folder and load it in-game.
                </p>
                <div className="modal-actions">
                  <button onClick={() => void save('vmf')}>
                    <ArrowDownToLine size={15} />
                    Export VMF
                  </button>
                  <button className="primary" disabled={!window.forgeDesktop || !config.binDir || !config.gameDir || building} onClick={() => void build()}>
                    <Hammer size={15} />
                    Choose output & build
                  </button>
                </div>
              </>
            )}
            {modal === 'help' && (
              <>
                <p>Forge 0.1 is a working Source 1 editor foundation. Build geometry, place entities, save your workspace, and export native VMF maps.</p>
                <div className="help-grid">
                  {[
                    ['W / E / R', 'Move / rotate / scale'],
                    ['B', 'Add a 128-unit block'],
                    ['F', 'Frame the selection'],
                    ['⌘ / Ctrl + D', 'Duplicate selection'],
                    ['Delete', 'Delete selection'],
                    ['⌘ / Ctrl + Z', 'Undo'],
                    ['⌘ / Ctrl + S', 'Save project'],
                    ['⌘ / Ctrl + K', 'Find a command']
                  ].map(([key, text]) => (
                    <div key={key}>
                      <kbd>{key}</kbd>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
                <p className="field-hint">
                  Orbit with left drag, pan with right drag, zoom with the wheel. Top, front and side views are orthographic. Fly preview is a free camera; Source rendering and physics require the
                  game.
                </p>
                <p className="field-hint">
                  This release uses procedural blockout material previews and entity markers. FGD loading, game asset mounting, model rendering, displacement editing, face UV tools, CSG clipping and
                  in-game live sync are future work. Imported displacement brushes remain protected, and imported UV axes are preserved.
                </p>
                <button className="primary" onClick={() => setModal(null)}>
                  Start building
                </button>
              </>
            )}
            {modal === 'property' && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (o && propKey.trim()) {
                    edit(o.id, { props: { ...o.props, [propKey.trim()]: propValue } });
                    setModal(null);
                  }
                }}
              >
                <label className="field-label">
                  Key
                  <input autoFocus required value={propKey} onChange={e => setPropKey(e.target.value)} placeholder="targetname" />
                </label>
                <label className="field-label">
                  Value
                  <input value={propValue} onChange={e => setPropValue(e.target.value)} />
                </label>
                <button className="primary" type="submit">
                  Add property
                </button>
              </form>
            )}
            {modal === 'output' && (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (!o) return;
                  const source = clone(o.source ?? ({ name: 'entity', children: [] } as KV));
                  let connections = source.children!.find(c => c.name === 'connections');
                  if (!connections) {
                    connections = { name: 'connections', children: [] };
                    source.children!.push(connections);
                  }
                  connections.children!.push({ name: output.event, value: [output.target, output.input, output.parameter, output.delay, output.once ? '1' : '-1'].join(',') });
                  edit(o.id, { source });
                  setModal(null);
                }}
              >
                <p>Connect a Source entity event to a named target. Event and input names must match the entity classes in your game.</p>
                {(['event', 'target', 'input', 'parameter', 'delay'] as const).map(key => (
                  <label className="field-label" key={key}>
                    {key}
                    <input
                      type={key === 'delay' ? 'number' : 'text'}
                      min={key === 'delay' ? 0 : undefined}
                      step={key === 'delay' ? 0.1 : undefined}
                      required={key !== 'parameter'}
                      list={key === 'target' ? 'targetnames' : undefined}
                      value={output[key]}
                      onChange={e => setOutput(v => ({ ...v, [key]: e.target.value.replaceAll(',', '') }))}
                    />
                  </label>
                ))}
                <datalist id="targetnames">
                  {project.objects
                    .filter(o => o.props.targetname)
                    .map(o => (
                      <option key={o.id} value={o.props.targetname} />
                    ))}
                </datalist>
                <label className="checkbox">
                  <input type="checkbox" checked={output.once} onChange={e => setOutput(v => ({ ...v, once: e.target.checked }))} />
                  Fire once
                </label>
                <button className="primary" type="submit">
                  Add connection
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
