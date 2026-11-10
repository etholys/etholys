import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { sideMetersFromHa } from '@/lib/radar/meters';
import { deviceVisualFamily } from '@/lib/radar/visual-catalog';
import { addMachine, addSensor, fillSpaceContent, labelSprite } from '@/lib/radar/mesh-kit';
import type { RadarIrrigationPath, RadarSiteStructure } from '@/lib/radar/site-layout';

export type WorldParcel = {
  id: string;
  name: string;
  crop: string | null;
  moisture: number | null;
  nextAction?: string;
  harvestBlocked?: boolean;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
  widthM?: number | null;
  lengthM?: number | null;
  spacingM?: number | null;
};

export type WorldSensor = {
  id: string;
  name: string;
  unitId?: string | null;
  lastValue: number | null;
  sku?: string | null;
};

type MountOpts = {
  moduleId?: string | null;
  parcels: WorldParcel[];
  sensors: WorldSensor[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  lat?: number | null;
  lng?: number | null;
  areaHa?: number | null;
  siteSideM?: number | null;
  structures?: RadarSiteStructure[];
  irrigation?: RadarIrrigationPath[];
};

function tone(p: WorldParcel): 'ok' | 'warn' | 'critical' {
  if (p.nextAction === 'irrigate' || p.nextAction === 'hold_harvest' || p.harvestBlocked) return 'critical';
  if (p.nextAction === 'scout' || p.nextAction === 'await_signal') return 'warn';
  if (p.moisture != null && p.moisture < 25) return 'warn';
  return 'ok';
}

const PIN = { ok: 0x0284c7, warn: 0xd97706, critical: 0xe11d48 } as const;

function addStructure(scene: THREE.Scene, s: RadarSiteStructure, spanM: number) {
  const w = Math.max(0.8, ((s.widthM ?? s.w) / (s.widthM ? 1 : 100)) * (s.widthM ? 1 : spanM));
  const d = Math.max(0.8, ((s.lengthM ?? s.h) / (s.lengthM ? 1 : 100)) * (s.lengthM ? 1 : spanM));
  const x = ((s.x + s.w / 2) / 100 - 0.5) * spanM;
  const z = ((s.y + s.h / 2) / 100 - 0.5) * spanM;
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = THREE.MathUtils.degToRad(s.rotation || 0);
  if (s.kind === 'shed') {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w, s.heightM ?? 2.2, d),
      new THREE.MeshStandardMaterial({ color: 0xb45309 }),
    );
    box.position.y = (s.heightM ?? 2.2) / 2;
    group.add(box);
  } else if (s.kind === 'greenhouse') {
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(w, s.heightM ?? 2.4, d),
      new THREE.MeshStandardMaterial({ color: 0xa5f3fc, transparent: true, opacity: 0.45 }),
    );
    glass.position.y = (s.heightM ?? 2.4) / 2;
    group.add(glass);
  } else if (s.kind === 'path') {
    const path = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.05, d),
      new THREE.MeshStandardMaterial({ color: 0xd6d3d1 }),
    );
    path.position.y = 0.04;
    group.add(path);
  } else {
    // irrigation_line as raised pipe segment
    const pipe = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(w, d), 0.08, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x0284c7 }),
    );
    pipe.position.y = 0.12;
    group.add(pipe);
  }
  scene.add(group);
}

function addIrrigationPath(scene: THREE.Scene, path: RadarIrrigationPath, spanM: number) {
  const pts = path.points.map(
    (p) => new THREE.Vector3(((p.x / 100) - 0.5) * spanM, 0.1, ((p.y / 100) - 0.5) * spanM),
  );
  if (pts.length < 2) return;
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(8, pts.length * 4), 0.06, 6, false),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.2 }),
  );
  scene.add(tube);
}

export function mountRadarWorld(host: HTMLElement, opts: MountOpts): () => void {
  const width = host.clientWidth || 640;
  const height = host.clientHeight || 560;
  const scene = new THREE.Scene();
  // Local plant only (geo 3D uses MapLibre). Soft sky — no heavy fog that washed out the scene.
  scene.background = new THREE.Color(0xb8c9b0);

  const camera = new THREE.PerspectiveCamera(32, width / height, 0.05, 500);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.shadowMap.enabled = true;
  host.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.12;
  controls.target.set(0, 0.15, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const sun = new THREE.DirectionalLight(0xffffff, 1.05);
  sun.position.set(10, 18, 8);
  sun.castShadow = true;
  scene.add(sun);

  const siteSideM =
    opts.siteSideM && opts.siteSideM > 0
      ? opts.siteSideM
      : sideMetersFromHa(opts.areaHa, Math.max(40, opts.parcels.length * 8));
  // Map % layout onto real meters for the site square
  const SPAN = siteSideM;

  const laidOut =
    opts.parcels.length > 0 && opts.parcels.every((p) => typeof p.x === 'number' && typeof p.y === 'number');
  const n = Math.max(1, opts.parcels.length);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cell = Math.min(8, SPAN / Math.max(cols, 1) - 0.5);
  const gap = 0.7;
  const gridSpanX = cols * cell + (cols - 1) * gap;
  const gridSpanZ = rows * cell + (rows - 1) * gap;

  // Opaque soil disc only — never a translucent slab or failed OSM texture plane (that was the blue fog bug).
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(SPAN * 0.72, 48),
    new THREE.MeshStandardMaterial({ color: 0x5f7d4a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  scene.add(ground);

  // 10 m scale bar
  const scaleLen = Math.min(10, SPAN * 0.25);
  const scaleBar = new THREE.Mesh(
    new THREE.BoxGeometry(scaleLen, 0.06, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x0f172a }),
  );
  scaleBar.position.set(-SPAN / 2 + scaleLen / 2 + 1, 0.05, SPAN / 2 - 1.2);
  scene.add(scaleBar);
  const scaleLabel = labelSprite(`${scaleLen.toFixed(0)} m`);
  scaleLabel.position.set(-SPAN / 2 + scaleLen / 2 + 1, 0.55, SPAN / 2 - 1.2);
  scene.add(scaleLabel);

  const rooms = opts.parcels.map((parcel, i) => {
    if (laidOut) {
      const wM = parcel.widthM && parcel.widthM > 0 ? parcel.widthM : Math.max(2, ((parcel.w ?? 18) / 100) * SPAN);
      const dM = parcel.lengthM && parcel.lengthM > 0 ? parcel.lengthM : Math.max(2, ((parcel.h ?? 14) / 100) * SPAN);
      const x = (((parcel.x ?? 0) + (parcel.w ?? 18) / 2) / 100 - 0.5) * SPAN;
      const z = (((parcel.y ?? 0) + (parcel.h ?? 14) / 2) / 100 - 0.5) * SPAN;
      return { parcel, x, z, w: wM, d: dM, rotation: parcel.rotation ?? 0 };
    }
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      parcel,
      x: -gridSpanX / 2 + cell / 2 + col * (cell + gap),
      z: -gridSpanZ / 2 + cell / 2 + row * (cell + gap),
      w: cell - 0.15,
      d: cell - 0.15,
      rotation: 0,
    };
  });

  let spanX = laidOut ? SPAN : gridSpanX;
  let spanZ = laidOut ? SPAN : gridSpanZ;
  if (laidOut && rooms.length > 0) {
    const minX = Math.min(...rooms.map((r) => r.x - r.w / 2));
    const maxX = Math.max(...rooms.map((r) => r.x + r.w / 2));
    const minZ = Math.min(...rooms.map((r) => r.z - r.d / 2));
    const maxZ = Math.max(...rooms.map((r) => r.z + r.d / 2));
    spanX = Math.max(8, maxX - minX + 4);
    spanZ = Math.max(8, maxZ - minZ + 4);
  }

  const pickables: THREE.Object3D[] = [];
  const roomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const focusMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbae6fd, emissiveIntensity: 0.35 });

  rooms.forEach((room) => {
    const { parcel } = room;
    const group = new THREE.Group();
    group.position.set(room.x, 0, room.z);
    group.rotation.y = THREE.MathUtils.degToRad(room.rotation || 0);
    group.userData.parcelId = parcel.id;

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(room.w, 0.08, room.d),
      opts.focusedId === parcel.id ? focusMat : roomMat,
    );
    floor.position.y = 0.06;
    floor.userData.parcelId = parcel.id;
    floor.receiveShadow = true;
    group.add(floor);
    pickables.push(floor);

    fillSpaceContent(group, {
      moduleId: opts.moduleId,
      name: parcel.name,
      crop: parcel.crop,
      roomW: room.w,
      roomD: room.d,
      spacingM: parcel.spacingM ?? null,
    });

    const tag = labelSprite(
      `${parcel.name}${parcel.widthM && parcel.lengthM ? ` · ${parcel.widthM}×${parcel.lengthM}m` : ''}`,
    );
    tag.position.set(0, 1.5, 0);
    group.add(tag);

    const zoneSensors = opts.sensors.filter((s) => s.unitId === parcel.id);
    zoneSensors.slice(0, 4).forEach((s, si) => {
      const fam = deviceVisualFamily(s.sku, s.name);
      if (fam === 'probe' || fam === 'gateway' || fam === 'valve') {
        addSensor(group, PIN[tone(parcel)], -room.w * 0.35 + (si % 2) * room.w * 0.5, room.d * 0.3);
      } else {
        addMachine(group, s.sku, s.name);
      }
    });

    scene.add(group);
  });

  for (const st of opts.structures || []) addStructure(scene, st, SPAN);
  for (const ir of opts.irrigation || []) addIrrigationPath(scene, ir, SPAN);

  const frameCamera = () => {
    const w = host.clientWidth || 640;
    const h = host.clientHeight || 560;
    camera.aspect = w / Math.max(h, 1);
    const fov = 32;
    camera.fov = fov;
    const vFov = (fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const halfX = spanX / 2 + 1;
    const halfZ = spanZ / 2 + 1;
    const distH = halfX / Math.tan(hFov / 2);
    const distV = halfZ / Math.tan(vFov / 2);
    const viewDist = Math.min(distH, distV) * 1.15;
    camera.position.copy(new THREE.Vector3(0.85, 0.75, 1).normalize().multiplyScalar(viewDist));
    camera.near = 0.05;
    camera.far = Math.max(200, viewDist * 16);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0.2, 0);
    controls.minDistance = viewDist * 0.4;
    controls.maxDistance = viewDist * 4;
    controls.update();
    renderer.setSize(w, h);
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const onPointer = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    const id = hit?.object.userData.parcelId as string | undefined;
    if (id) opts.onFocus(id);
  };
  renderer.domElement.addEventListener('pointerdown', onPointer);

  let frame = 0;
  let alive = true;
  const tick = () => {
    if (!alive) return;
    frame = requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
  };
  tick();
  frameCamera();
  const observer = new ResizeObserver(() => frameCamera());
  observer.observe(host);

  return () => {
    alive = false;
    cancelAnimationFrame(frame);
    observer.disconnect();
    renderer.domElement.removeEventListener('pointerdown', onPointer);
    controls.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  };
}
