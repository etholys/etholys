import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type WorldParcel = {
  id: string;
  name: string;
  crop: string | null;
  moisture: number | null;
  nextAction?: string;
  harvestBlocked?: boolean;
  /** Site-plan percent. When every parcel has x/y, the rooms use that layout. */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
};

export type WorldSensor = {
  id: string;
  name: string;
  unitId?: string | null;
  lastValue: number | null;
};

type MountOpts = {
  moduleId?: string | null;
  parcels: WorldParcel[];
  sensors: WorldSensor[];
  focusedId: string | null;
  onFocus: (id: string) => void;
};

function tone(p: WorldParcel): 'ok' | 'warn' | 'critical' {
  if (p.nextAction === 'irrigate' || p.nextAction === 'hold_harvest' || p.harvestBlocked) return 'critical';
  if (p.nextAction === 'scout' || p.nextAction === 'await_signal') return 'warn';
  if (p.moisture != null && p.moisture < 25) return 'warn';
  return 'ok';
}

const PIN = { ok: 0x0284c7, warn: 0xd97706, critical: 0xe11d48 } as const;

function labelSprite(text: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Sprite();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(0, 8, 256, 48);
  ctx.fillStyle = '#0f172a';
  ctx.font = '600 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.length > 18 ? `${text.slice(0, 17)}…` : text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

function addAgri(group: THREE.Group) {
  const green = new THREE.MeshStandardMaterial({ color: 0x22c55e });
  for (let i = 0; i < 6; i++) {
    const plant = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 6), green);
    plant.position.set(-0.9 + (i % 3) * 0.7, 0.35, -0.35 + Math.floor(i / 3) * 0.7);
    plant.castShadow = true;
    group.add(plant);
  }
}

function addFactory(group: THREE.Group) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
  const machine = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.7), metal);
  machine.position.set(-0.3, 0.45, 0);
  group.add(machine);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.15), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
  arm.position.set(0.7, 0.7, 0.2);
  group.add(arm);
}

function addSensor(group: THREE.Group, color: number, x: number, z: number) {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.12, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x1e293b }),
  );
  body.position.set(x, 0.2, z);
  group.add(body);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.12), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }));
  led.position.set(x, 0.28, z);
  group.add(led);
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  for (const r of [0.35, 0.55, 0.75]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.03, r, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.06, z);
    group.add(ring);
  }
}

export function mountRadarWorld(host: HTMLElement, opts: MountOpts): () => void {
  const width = host.clientWidth || 640;
  const height = host.clientHeight || 560;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb7c9a8);
  scene.fog = new THREE.Fog(0xb7c9a8, 48, 140);

  const camera = new THREE.PerspectiveCamera(32, width / height, 0.05, 400);

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
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.target.set(0, 0.15, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(8, 16, 6);
  sun.castShadow = true;
  scene.add(sun);

  const laidOut =
    opts.parcels.length > 0 && opts.parcels.every((p) => typeof p.x === 'number' && typeof p.y === 'number');
  const SPAN = 26;
  const n = Math.max(1, opts.parcels.length);
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cell = 4.2;
  const gap = 0.7;
  const gridSpanX = cols * cell + (cols - 1) * gap;
  const gridSpanZ = rows * cell + (rows - 1) * gap;
  const rooms = opts.parcels.map((parcel, i) => {
    if (laidOut) {
      const w = Math.max(1.15, ((parcel.w ?? 18) / 100) * SPAN);
      const d = Math.max(1.15, ((parcel.h ?? 14) / 100) * SPAN);
      const x = (((parcel.x ?? 0) + (parcel.w ?? 18) / 2) / 100 - 0.5) * SPAN;
      const z = (((parcel.y ?? 0) + (parcel.h ?? 14) / 2) / 100 - 0.5) * SPAN;
      return { parcel, x, z, w, d, rotation: parcel.rotation ?? 0 };
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
  let spanX = gridSpanX;
  let spanZ = gridSpanZ;
  if (laidOut && rooms.length > 0) {
    const minX = Math.min(...rooms.map((r) => r.x - r.w / 2));
    const maxX = Math.max(...rooms.map((r) => r.x + r.w / 2));
    const minZ = Math.min(...rooms.map((r) => r.z - r.d / 2));
    const maxZ = Math.max(...rooms.map((r) => r.z + r.d / 2));
    spanX = Math.max(8, maxX - minX + 3);
    spanZ = Math.max(8, maxZ - minZ + 3);
  }

  const frameCamera = () => {
    const w = host.clientWidth || 640;
    const h = host.clientHeight || 560;
    camera.aspect = w / Math.max(h, 1);
    const fov = 32;
    camera.fov = fov;
    const vFov = (fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const halfX = spanX / 2 + 0.4;
    const halfZ = spanZ / 2 + 0.4;
    const distH = halfX / Math.tan(hFov / 2);
    const distV = halfZ / Math.tan(vFov / 2);
    const viewDist = Math.min(distH, distV) * 1.08;
    camera.position.copy(new THREE.Vector3(0.82, 0.7, 1).normalize().multiplyScalar(viewDist));
    camera.near = 0.05;
    camera.far = Math.max(120, viewDist * 14);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0.2, 0);
    controls.minDistance = viewDist * 0.45;
    controls.maxDistance = viewDist * 3.2;
    controls.update();
    renderer.setSize(w, h);
  };

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(spanX, spanZ) * 8, 48),
    new THREE.MeshStandardMaterial({ color: 0x6d8f58, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.42;
  ground.receiveShadow = true;
  scene.add(ground);

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(spanX + 2.4, 0.35, spanZ + 2.4),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc }),
  );
  platform.position.y = -0.2;
  platform.receiveShadow = true;
  scene.add(platform);

  const grid = new THREE.GridHelper(Math.max(spanX, spanZ) + 2, Math.max(cols, rows) * 2, 0xcbd5e1, 0xe2e8f0);
  grid.position.y = 0.01;
  scene.add(grid);

  const pickables: THREE.Object3D[] = [];
  const roomMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0 });
  const focusMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbae6fd, emissiveIntensity: 0.35 });

  rooms.forEach((room) => {
    const { parcel } = room;
    const group = new THREE.Group();
    group.position.set(room.x, 0, room.z);
    group.rotation.y = THREE.MathUtils.degToRad(room.rotation || 0);
    group.userData.parcelId = parcel.id;

    const floor = new THREE.Mesh(new THREE.BoxGeometry(room.w, 0.08, room.d), opts.focusedId === parcel.id ? focusMat : roomMat);
    floor.position.y = 0.06;
    floor.userData.parcelId = parcel.id;
    floor.receiveShadow = true;
    group.add(floor);
    pickables.push(floor);

    const wall = new THREE.Mesh(new THREE.BoxGeometry(room.w, 0.45, 0.08), wallMat);
    wall.position.set(0, 0.28, -room.d / 2);
    group.add(wall);

    if (opts.moduleId === 'agroindustry' || opts.moduleId === 'livestock') addFactory(group);
    else addAgri(group);

    const tag = labelSprite(parcel.name);
    tag.position.set(0, 1.35, 0);
    group.add(tag);

    const zoneSensors = opts.sensors.filter((s) => s.unitId === parcel.id);
    const pins = zoneSensors.length > 0 ? zoneSensors : [{ id: parcel.id, name: parcel.name, unitId: parcel.id, lastValue: parcel.moisture }];
    pins.slice(0, 4).forEach((s, si) => {
      addSensor(group, PIN[tone(parcel)], -1.2 + (si % 2) * 1.6, 0.8 - Math.floor(si / 2) * 1.2);
    });

    scene.add(group);
  });

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
  const onResize = () => frameCamera();
  const observer = new ResizeObserver(onResize);
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
