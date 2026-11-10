/**
 * Procedural RADAR 3D meshes (crop rows / machines) shared by local Three twin
 * and MapLibre custom Three layer. Readable silhouettes — not photoreal GLBs.
 */

import * as THREE from 'three';
import {
  cropVisualFamily,
  DEFAULT_SIZE_M,
  deviceVisualFamily,
  type CropVisualFamily,
} from '@/lib/radar/visual-catalog';

const MAX_INSTANCES = 48;

export function addCropFamily(
  group: THREE.Group,
  family: CropVisualFamily,
  roomW: number,
  roomD: number,
  spacingM: number | null,
) {
  const pad = 0.35;
  const usableW = Math.max(0.5, roomW - pad * 2);
  const usableD = Math.max(0.5, roomD - pad * 2);
  const spacing =
    spacingM && spacingM > 0.15
      ? Math.min(spacingM, usableW / 2)
      : family === 'fruit_tree'
        ? 2.2
        : family === 'maize'
          ? 0.55
          : family === 'tomato_stake'
            ? 0.65
            : 0.7;
  const cols = Math.max(1, Math.floor(usableW / spacing));
  const rows = Math.max(1, Math.floor(usableD / spacing));
  const startX = -usableW / 2 + spacing / 2;
  const startZ = -usableD / 2 + spacing / 2;

  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (count >= MAX_INSTANCES) return;
      count += 1;
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

export function addMachine(group: THREE.Group, sku: string | null | undefined, name: string | null | undefined) {
  const family = deviceVisualFamily(sku, name);
  const size = DEFAULT_SIZE_M[family];
  const w = Math.min(2.4, size.w);
  const h = Math.min(2.2, size.h);
  const d = Math.min(1.6, size.l);
  if (family === 'dehydrator') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.35, roughness: 0.4 }),
    );
    body.position.set(0, h / 2 + 0.1, 0);
    group.add(body);
    const chimney = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155 }),
    );
    chimney.position.set(w * 0.25, h + 0.4, 0);
    group.add(chimney);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.55, h * 0.55, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9 }),
    );
    door.position.set(0, h * 0.45, d / 2 + 0.02);
    group.add(door);
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.15, 0.08, d * 0.35),
      new THREE.MeshStandardMaterial({ color: 0x475569 }),
    );
    belt.position.set(0, 0.35, d * 0.55);
    group.add(belt);
  } else if (family === 'valve') {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.18, 0.2, 10),
      new THREE.MeshStandardMaterial({ color: 0x0369a1 }),
    );
    base.position.set(0, 0.2, 0);
    group.add(base);
  } else {
    const machine = new THREE.Mesh(
      new THREE.BoxGeometry(w, h * 0.7, d),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.25, roughness: 0.45 }),
    );
    machine.position.set(0, h * 0.4, 0);
    group.add(machine);
    const hopper = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.18, w * 0.28, h * 0.35, 8),
      new THREE.MeshStandardMaterial({ color: 0x64748b }),
    );
    hopper.position.set(-w * 0.2, h * 0.85, 0);
    group.add(hopper);
  }
}

export function addSensor(group: THREE.Group, color: number, x: number, z: number) {
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

export function labelSprite(text: string) {
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

/** Prefer crop silhouette; agroindustry/livestock without crop → machine. */
export function fillSpaceContent(
  group: THREE.Group,
  opts: {
    moduleId?: string | null;
    name: string;
    crop: string | null;
    roomW: number;
    roomD: number;
    spacingM?: number | null;
  },
) {
  const family = cropVisualFamily(opts.crop, opts.name);
  const wantsMachine =
    (opts.moduleId === 'agroindustry' || opts.moduleId === 'livestock') && !opts.crop;
  const nameLooksLine = /linha|línea|linea|secador|dehydr|deshidr|máquina|maquina/i.test(opts.name);
  if (wantsMachine || (nameLooksLine && !opts.crop && opts.moduleId === 'agroindustry')) {
    addMachine(group, null, opts.name);
    return;
  }
  if (opts.moduleId === 'agroindustry' && nameLooksLine && family === 'generic_green') {
    addMachine(group, null, opts.name);
    return;
  }
  addCropFamily(group, family, opts.roomW, opts.roomD, opts.spacingM ?? null);
}
