import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { bounds, geometry, MapObject, matrix, tuple, V3 } from './model';

export type ViewMode = 'perspective' | 'top' | 'front' | 'side';
export interface ViewHandle {
  focus: (id?: string) => void;
  reset: () => void;
}
interface Props {
  objects: MapObject[];
  selected: string | null;
  tool: 'translate' | 'rotate' | 'scale';
  snap: number;
  view: ViewMode;
  wire: boolean;
  fly: boolean;
  onSelect: (id: string | null) => void;
  onTransform: (id: string, position: V3, rotation: V3, scale: V3) => void;
  onFlyEnd: () => void;
  onError: (text: string) => void;
}
const palette = (mat: string) =>
  /NODRAW/i.test(mat) ? '#636366' : /TRIGGER/i.test(mat) ? '#e69747' : /SKY/i.test(mat) ? '#779bbb' : /PLAYERCLIP/i.test(mat) ? '#ac648e' : /01B/i.test(mat) ? '#9aa7b4' : '#c49158';
export const Viewport = forwardRef<ViewHandle, Props>(function Viewport(props, ref) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{
    scene: T.Scene;
    camera: T.PerspectiveCamera | T.OrthographicCamera;
    renderer: T.WebGLRenderer;
    orbit: OrbitControls;
    gizmo: TransformControls;
    group: T.Group;
    map: Map<string, T.Object3D>;
    grid: T.GridHelper;
    focus: (id?: string) => void;
    keys: Set<string>;
    dragged: boolean;
  } | null>(null);
  const latest = useRef(props);
  latest.current = props;
  useImperativeHandle(ref, () => ({ focus: id => api.current?.focus(id), reset: () => api.current?.focus() }));
  useEffect(() => {
    const el = host.current!;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      latest.current.onError(`WebGL unavailable: ${String(e)}`);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.setClearColor('#303030', 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.tabIndex = 0;
    const scene = new T.Scene();
    const perspective = new T.PerspectiveCamera(50, 1, 1, 60000);
    perspective.up.set(0, 0, 1);
    perspective.position.set(1200, -1500, 1150);
    perspective.lookAt(0, 0, 80);
    const orbit = new OrbitControls(perspective, renderer.domElement);
    orbit.target.set(0, 0, 80);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.12;
    orbit.minDistance = 8;
    orbit.maxDistance = 24000;
    const gizmo = new TransformControls(perspective, renderer.domElement);
    gizmo.setSize(0.8);
    scene.add(gizmo.getHelper());
    const group = new T.Group();
    scene.add(group);
    scene.add(new T.HemisphereLight('#eaf3ff', '#34303d', 2));
    const sun = new T.DirectionalLight('#ffffff', 2.8);
    sun.position.set(-500, -700, 1400);
    scene.add(sun);
    const grid = new T.GridHelper(16384, 128, '#707070', '#4a4a4a');
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.3;
    scene.add(grid);
    const axes = new T.AxesHelper(180);
    axes.position.set(-620, -450, 0);
    scene.add(axes);
    const state = {
      scene,
      camera: perspective as T.PerspectiveCamera | T.OrthographicCamera,
      renderer,
      orbit,
      gizmo,
      group,
      map: new Map<string, T.Object3D>(),
      grid,
      keys: new Set<string>(),
      dragged: false,
      focus: (id?: string) => {
        const targets = id ? latest.current.objects.filter(o => o.id === id) : latest.current.objects.filter(o => !o.hidden);
        const b = new T.Box3();
        targets.forEach(o => b.union(bounds(o)));
        if (b.isEmpty()) b.set(new T.Vector3(-256, -256, 0), new T.Vector3(256, 256, 256));
        const center = b.getCenter(new T.Vector3());
        const size = Math.max(128, b.getSize(new T.Vector3()).length());
        const dir = state.camera.position.clone().sub(orbit.target).normalize();
        orbit.target.copy(center);
        state.camera.position.copy(center).addScaledVector(dir, size * 1.15);
        if (state.camera instanceof T.OrthographicCamera) {
          state.camera.zoom = Math.max(0.2, 1200 / size);
          state.camera.updateProjectionMatrix();
        }
        orbit.update();
      }
    };
    api.current = state;
    let resizing = true;
    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      renderer.setSize(width, height);
      if (state.camera instanceof T.PerspectiveCamera) state.camera.aspect = width / Math.max(1, height);
      else {
        const a = width / Math.max(1, height);
        state.camera.left = -800 * a;
        state.camera.right = 800 * a;
        state.camera.top = 800;
        state.camera.bottom = -800;
      }
      state.camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    resizing = false;
    gizmo.addEventListener('dragging-changed', e => {
      orbit.enabled = !e.value;
      state.dragged = !!e.value;
    });
    gizmo.addEventListener('mouseUp', () => {
      const object = gizmo.object;
      if (!object) return;
      const r = object.rotation;
      const scale = tuple(object.scale).map(n => Math.max(0.01, n)) as V3;
      latest.current.onTransform(object.userData.id, tuple(object.position), [(r.x * 180) / Math.PI, (r.y * 180) / Math.PI, (r.z * 180) / Math.PI], scale);
      setTimeout(() => {
        state.dragged = false;
      }, 0);
    });
    let down = { x: 0, y: 0 };
    let startDrag = false;
    const pointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      startDrag = state.dragged;
    };
    const pointerUp = (e: PointerEvent) => {
      if (e.button !== 0 || startDrag || state.dragged || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      if (latest.current.fly) {
        renderer.domElement.requestPointerLock();
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      const ray = new T.Raycaster();
      ray.setFromCamera(new T.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, (-(e.clientY - rect.top) / rect.height) * 2 + 1), state.camera);
      const hit = ray.intersectObjects(group.children, true).find(h => h.object.userData.id);
      latest.current.onSelect(hit?.object.userData.id ?? null);
    };
    const dbl = () => {
      if (latest.current.selected) state.focus(latest.current.selected);
    };
    const keyDown = (e: KeyboardEvent) => {
      if (document.pointerLockElement === renderer.domElement) {
        state.keys.add(e.code);
        e.preventDefault();
      }
    };
    const keyUp = (e: KeyboardEvent) => state.keys.delete(e.code);
    let yaw = 0,
      pitch = 0;
    const look = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      yaw -= e.movementX * 0.002;
      pitch = Math.max(-1.5, Math.min(1.5, pitch - e.movementY * 0.002));
      const forward = new T.Vector3(Math.cos(pitch) * Math.sin(yaw), Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch));
      state.camera.lookAt(state.camera.position.clone().add(forward));
    };
    const lock = () => {
      if (document.pointerLockElement === renderer.domElement) {
        orbit.enabled = false;
        const dir = state.camera.getWorldDirection(new T.Vector3());
        yaw = Math.atan2(dir.x, dir.y);
        pitch = Math.asin(dir.z);
      } else {
        state.keys.clear();
        orbit.enabled = true;
        orbit.target.copy(state.camera.position).addScaledVector(state.camera.getWorldDirection(new T.Vector3()), 256);
        latest.current.onFlyEnd();
      }
    };
    const blur = () => state.keys.clear();
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('dblclick', dbl);
    document.addEventListener('keydown', keyDown);
    document.addEventListener('keyup', keyUp);
    document.addEventListener('mousemove', look);
    document.addEventListener('pointerlockchange', lock);
    window.addEventListener('blur', blur);
    let frame = 0,
      last = performance.now();
    const animate = (time: number) => {
      const delta = Math.min(0.05, (time - last) / 1000);
      last = time;
      if (document.pointerLockElement === renderer.domElement) {
        const dir = new T.Vector3(Math.sin(yaw), Math.cos(yaw), 0),
          right = new T.Vector3(Math.cos(yaw), -Math.sin(yaw), 0);
        const move = new T.Vector3();
        if (state.keys.has('KeyW')) move.add(dir);
        if (state.keys.has('KeyS')) move.sub(dir);
        if (state.keys.has('KeyD')) move.add(right);
        if (state.keys.has('KeyA')) move.sub(right);
        if (state.keys.has('KeyE')) move.z++;
        if (state.keys.has('KeyQ')) move.z--;
        if (move.length()) state.camera.position.addScaledVector(move.normalize(), delta * (state.keys.has('ShiftLeft') ? 1200 : 400));
      } else orbit.update();
      state.gizmo.getHelper().visible = !!state.gizmo.object && !latest.current.fly;
      state.gizmo.enabled = !latest.current.fly;
      if (!resizing) renderer.render(scene, state.camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      orbit.dispose();
      gizmo.dispose();
      group.traverse(dispose);
      grid.geometry.dispose();
      (grid.material as T.Material).dispose();
      axes.geometry.dispose();
      (axes.material as T.Material).dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('dblclick', dbl);
      document.removeEventListener('keydown', keyDown);
      document.removeEventListener('keyup', keyUp);
      document.removeEventListener('mousemove', look);
      document.removeEventListener('pointerlockchange', lock);
      window.removeEventListener('blur', blur);
      api.current = null;
    };
  }, []);
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    a.gizmo.detach();
    a.group.traverse(dispose);
    a.group.clear();
    a.map.clear();
    props.objects.forEach(o => {
      if (o.hidden) return;
      let mesh: T.Mesh;
      if (o.kind === 'brush') {
        const materials = (o.sides ?? []).map(s => {
          const material = new T.MeshStandardMaterial({ color: palette(s.material), roughness: 0.86, metalness: 0.08, wireframe: props.wire, side: T.DoubleSide });
          if (/DEV\//i.test(s.material)) {
            const tex = checker(palette(s.material));
            material.map = tex;
          }
          return material;
        });
        mesh = new T.Mesh(geometry(o), materials);
      } else {
        const isLight = o.props.classname === 'light';
        mesh = new T.Mesh(
          isLight ? new T.SphereGeometry(12, 12, 8) : new T.OctahedronGeometry(22),
          new T.MeshStandardMaterial({ color: isLight ? '#ffd078' : '#62d7bf', emissive: isLight ? '#986632' : '#1f4945', emissiveIntensity: 0.7, wireframe: props.wire })
        );
        const stem = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(0, 0, -o.position[2])]), new T.LineBasicMaterial({ color: isLight ? '#6e5d3e' : '#345f5a' }));
        mesh.add(stem);
      }
      mesh.rotation.order = 'ZYX';
      matrix(o).decompose(mesh.position, mesh.quaternion, mesh.scale);
      mesh.userData.id = o.id;
      mesh.traverse(c => (c.userData.id = o.id));
      a.group.add(mesh);
      a.map.set(o.id, mesh);
      if (o.id === props.selected) {
        const edges = new T.LineSegments(new T.EdgesGeometry(mesh.geometry), new T.LineBasicMaterial({ color: '#efe28a', depthTest: false, transparent: true, opacity: 0.9 }));
        edges.renderOrder = 10;
        mesh.add(edges);
        if (!o.locked) a.gizmo.attach(mesh);
      }
    });
  }, [props.objects, props.selected, props.wire]);
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    a.gizmo.setMode(props.tool);
    a.gizmo.setSpace(props.tool === 'scale' ? 'local' : 'world');
    a.gizmo.setTranslationSnap(props.snap || null);
    a.gizmo.setRotationSnap(props.snap ? (15 * Math.PI) / 180 : null);
    a.gizmo.setScaleSnap(props.snap ? 0.125 : null);
  }, [props.tool, props.snap]);
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const center = a.orbit.target.clone();
    let camera: T.PerspectiveCamera | T.OrthographicCamera;
    if (props.view === 'perspective') {
      camera = new T.PerspectiveCamera(50, 1, 1, 60000);
      camera.up.set(0, 0, 1);
      camera.position.copy(center).add(new T.Vector3(1200, -1500, 1150));
      a.orbit.enableRotate = true;
    } else {
      camera = new T.OrthographicCamera(-800, 800, 800, -800, 1, 60000);
      if (props.view === 'top') {
        camera.up.set(0, 1, 0);
        camera.position.copy(center).add(new T.Vector3(0, 0, 5000));
      } else {
        camera.up.set(0, 0, 1);
        camera.position.copy(center).add(props.view === 'front' ? new T.Vector3(0, -5000, 0) : new T.Vector3(5000, 0, 0));
      }
      a.orbit.enableRotate = false;
    }
    camera.lookAt(center);
    a.camera = camera;
    a.orbit.object = camera;
    a.gizmo.camera = camera;
    const { width, height } = host.current!.getBoundingClientRect();
    if (camera instanceof T.PerspectiveCamera) camera.aspect = width / Math.max(1, height);
    else {
      camera.left = (-800 * width) / Math.max(1, height);
      camera.right = (800 * width) / Math.max(1, height);
    }
    camera.updateProjectionMatrix();
    a.orbit.update();
  }, [props.view]);
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    a.gizmo.getHelper().visible = !props.fly;
    if (!props.fly && document.pointerLockElement === a.renderer.domElement) document.exitPointerLock();
  }, [props.fly]);
  return <div ref={host} className="viewport-canvas" aria-label="3D map viewport" />;
});
function dispose(o: T.Object3D) {
  const mesh = o as T.Mesh;
  if (mesh.geometry) mesh.geometry.dispose();
  const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  ms.filter(Boolean).forEach(m => {
    const map = (m as T.MeshStandardMaterial).map;
    if (map) map.dispose();
    m.dispose();
  });
}
function checker(color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;
  c.fillStyle = color;
  c.fillRect(0, 0, 256, 256);
  c.fillStyle = '#ffffff12';
  c.fillRect(0, 0, 128, 128);
  c.fillRect(128, 128, 128, 128);
  c.strokeStyle = '#00000025';
  c.lineWidth = 2;
  c.strokeRect(1, 1, 254, 254);
  c.beginPath();
  c.moveTo(128, 0);
  c.lineTo(128, 256);
  c.moveTo(0, 128);
  c.lineTo(256, 128);
  c.stroke();
  const tex = new T.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}
