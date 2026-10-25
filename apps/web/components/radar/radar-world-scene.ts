import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { sideMetersFromHa } from '@/lib/radar/meters';
import {
  cropVisualFamily,
  DEFAULT_SIZE_M,
  deviceVisualFamily,
  type CropVisualFamily,
} from '@/lib/radar/visual-catalog';
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

function osmTileXY(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z };
}

/** OSM raster under the site — commercial-safe tiles + attribution in UI. */
function addOsmGround(scene: THREE.Scene, lat: number, lng: number, sideM: number) {
  const z = 17;
  const { x: tx, y: ty } = osmTileXY(lat, lng, z);
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';
  const group = new THREE.Group();
  group.position.y = -0.45;
  const tileSpan = sideM * 1.35;
  // 3×3 tiles around the site pin
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const url = `https://tile.openstreetmap.org/${z}/${tx + dx}/${ty + dy}.png`;
      const mat = new THREE.MeshBasicMaterial({ color: 0x8a9a7a, transparent: true, opacity: 0.92 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(tileSpan / 3, tileSpan / 3), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(dx * (tileSpan / 3), 0, dy * (tileSpan / 3));
      mesh.receiveShadow = true;
      group.add(mesh);
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
        },
        undefined,
        () => {
          /* keep green fallback if tile blocked */
        },
      );
    }
  }
  scene.add(group);
}

function addCropFamily(group: THREE.Group, family: CropVisualFamily, roomW: number, roomD: number, spacingM: number | null) {
  const pad = 0.25;
  const usableW = Math.max(0.5, roomW - pad * 2);
  const usableD = Math.max(0.5, roomD - pad * 2);
  const spacing = spacingM && spacingM > 0.15 ? Math.min(spacingM, usableW / 2) : family === 'fruit_tree' ? 2.2 : family === 'maize' ? 0.55 : 0.7;
  const cols = Math.max(1, Math.floor(usableW / spacing));
  const rows = Math.max(1, Math.floor(usableD / spacing));
  const startX = -usableW / 2 + spacing / 2;
  const startZ = -usableD / 2 + spacing / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r * cols + c > 36) break;
      const x = startX + c * spacing;
      const z = startZ + r * spacing;
      if (family === 'lettuce_bed') {
        const bed = new THREE.Mesh(
          new THREE.BoxGeometry(Math.min(0.55, spacing * 0.75), 0.12, Math.min(0.45, spacing * 0.7)),
          new THREE.MeshStandardMaterial({ color: 0x4d7c0f }),
        );
        bed.position.set(x, 0.18, z);
        group.add(bed);
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x84cc16 }),
        );
        leaf.position.set(x, 0.32, z);
        leaf.scale.set(1.4, 0.6, 1.2);
        group.add(leaf);
      } else if (family === 'fruit_tree') {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.09, 0.9, 6),
          new THREE.MeshStandardMaterial({ color: 0x7c4a1e }),
        );
        trunk.position.set(x, 0.55, z);
        group.add(trunk);
        const canopy = new THREE.Mesh(
          new THREE.SphereGeometry(0.55, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0x166534 }),
        );
        canopy.position.set(x, 1.25, z);
        group.add(canopy);
        const fruit = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 6, 6),
          new THREE.MeshStandardMaterial({ color: 0xdc2626 }),
        );
        fruit.position.set(x + 0.25, 1.15, z + 0.1);
        group.add(fruit);
      } else if (family === 'maize') {
        const stalk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.04, 1.5, 5),
          new THREE.MeshStandardMaterial({ color: 0x65a30d }),
        );
        stalk.position.set(x, 0.85, z);
        group.add(stalk);
        const cob = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 0.25, 6),
          new THREE.MeshStandardMaterial({ color: 0xfacc15 }),
        );
        cob.position.set(x + 0.08, 1.1, z);
        cob.rotation.z = 0.4;
        group.add(cob);
      } else if (family === 'vine_squash') {
        const vine = new THREE.Mesh(
          new THREE.BoxGeometry(spacing * 0.8, 0.06, spacing * 0.8),
          new THREE.MeshStandardMaterial({ color: 0x4ade80 }),
        );
        vine.position.set(x, 0.14, z);
        group.add(vine);
        const fruit = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xea580c }),
        );
        fruit.position.set(x, 0.28, z);
        fruit.scale.set(1.2, 0.7, 1);
        group.add(fruit);
      } else if (family === 'tomato_stake') {
        const stake = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 1.2, 5),
          new THREE.MeshStandardMaterial({ color: 0x78716c }),
        );
        stake.position.set(x, 0.7, z);
        group.add(stake);
        const plant = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.7, 6),
          new THREE.MeshStandardMaterial({ color: 0x16a34a }),
        );
        plant.position.set(x, 0.5, z);
        group.add(plant);
        const tomato = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 6, 6),
          new THREE.MeshStandardMaterial({ color: 0xef4444 }),
        );
        tomato.position.set(x + 0.12, 0.55, z);
        group.add(tomato);
      } else {
        const plant = new THREE.Mesh(
          new THREE.ConeGeometry(0.14, 0.5, 6),
          new THREE.MeshStandardMaterial({ color: 0x22c55e }),
        );
        plant.position.set(x, 0.35, z);
        group.add(plant);
      }
    }
  }
}

function addMachine(group: THREE.Group, sku: string | null | undefined, name: string | null | undefined) {
  const family = deviceVisualFamily(sku, name);
  const size = DEFAULT_SIZE_M[family];
  // Scene units ≈ meters at room scale; clamp to fit
  const w = Math.min(1.8, size.w * 0.45);
  const h = Math.min(1.6, size.h * 0.45);
  const d = Math.min(1.2, size.l * 0.45);
  if (family === 'dehydrator') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.35, roughness: 0.4 }),
    );
    body.position.set(0, h / 2 + 0.1, 0);
    group.add(body);
    const chimney = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155 }),
    );
    chimney.position.set(w * 0.25, h + 0.35, 0);
    group.add(chimney);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.55, h * 0.55, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9 }),
    );
    door.position.set(0, h * 0.45, d / 2 + 0.02);
    group.add(door);
  } else if (family === 'valve') {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.18, 0.2, 10),
      new THREE.MeshStandardMaterial({ color: 0x0369a1 }),
    );
    base.position.set(0.6, 0.2, 0.5);
    group.add(base);
  } else {
    const machine = new THREE.Mesh(
      new THREE.BoxGeometry(w, h * 0.7, d),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8 }),
    );
    machine.position.set(0, h * 0.4, 0);
    group.add(machine);
  }
}

function addSensor(group: THREE.Group, color: number, x: number, z: number) {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.1, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x1e293b }),
  );
  body.position.set(x, 0.18, z);
  group.add(body);
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.035, 0.1),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }),
  );
  led.position.set(x, 0.25, z);
  group.add(led);
}

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
  scene.background = new THREE.Color(0x87a0b8);
  scene.fog = new THREE.Fog(0x87a0b8, 60, 180);

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

  if (opts.lat != null && opts.lng != null && Number.isFinite(opts.lat) && Number.isFinite(opts.lng)) {
    addOsmGround(scene, opts.lat, opts.lng, SPAN);
  } else {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(SPAN * 1.6, 48),
      new THREE.MeshStandardMaterial({ color: 0x6d8f58, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.42;
    ground.receiveShadow = true;
    scene.add(ground);
  }

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(SPAN + 2, 0.2, SPAN + 2),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.55 }),
  );
  platform.position.y = -0.28;
  platform.receiveShadow = true;
  scene.add(platform);

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

    const family = cropVisualFamily(parcel.crop);
    if (opts.moduleId === 'agroindustry' || opts.moduleId === 'livestock') {
      addMachine(group, null, parcel.name);
    } else {
      addCropFamily(group, family, room.w, room.d, parcel.spacingM ?? null);
    }

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
