/**
 * MapLibre custom layer: Three.js crop/machine silhouettes on the geo twin.
 * Scene units = meters; origin at property lat/lng (east = +X, north = −Z after map rotation).
 */

import {
  MercatorCoordinate,
  type CustomLayerInterface,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import * as THREE from 'three';
import { spaceCenterMeters } from '@/lib/radar/geo-map';
import { fillSpaceContent } from '@/lib/radar/mesh-kit';
import type { RadarSpaceRect } from '@/lib/radar/site-layout';
import type { WorldParcel } from '@/components/radar/radar-world-scene';

export const RADAR_THREE_LAYER_ID = 'radar-three-crops';

export type ThreeTwinPayload = {
  parcels: WorldParcel[];
  spaces: RadarSpaceRect[];
  focusedId: string | null;
  sideM: number;
  lat: number;
  lng: number;
  moduleId?: string | null;
};

type Transform = {
  translateX: number;
  translateY: number;
  translateZ: number;
  rotateX: number;
  scale: number;
};

type LayerState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  root: THREE.Group;
  map: MapLibreMap;
  transform: Transform;
  lastKey: string;
};

function spaceDrawable(rect: RadarSpaceRect): boolean {
  if (!(rect.w > 0 && rect.h > 0)) return false;
  if (rect.placed === true) return true;
  return typeof rect.x === 'number' && typeof rect.y === 'number';
}

function drawableSpaces(parcels: WorldParcel[], spaces: RadarSpaceRect[]): RadarSpaceRect[] {
  const fromLayout = spaces.filter(spaceDrawable);
  if (fromLayout.length > 0) return fromLayout;
  const out: RadarSpaceRect[] = [];
  for (const parcel of parcels) {
    if (typeof parcel.x !== 'number' || typeof parcel.y !== 'number') continue;
    out.push({
      id: parcel.id,
      x: parcel.x,
      y: parcel.y,
      w: parcel.w ?? 18,
      h: parcel.h ?? 14,
      rotation: parcel.rotation ?? 0,
      placed: true,
    });
  }
  return out;
}

export function threeTwinPayloadKey(data: ThreeTwinPayload): string {
  const spaces = drawableSpaces(data.parcels, data.spaces);
  return [
    data.lat,
    data.lng,
    data.sideM,
    data.moduleId || '',
    data.focusedId || '',
    spaces.map((s) => `${s.id}:${s.x}:${s.y}:${s.w}:${s.h}:${s.rotation ?? 0}`).join('|'),
    data.parcels
      .map((p) => `${p.id}:${p.crop ?? ''}:${p.name}:${p.spacingM ?? ''}:${p.widthM ?? ''}:${p.lengthM ?? ''}`)
      .join('|'),
  ].join('::');
}

function makeTransform(lat: number, lng: number): Transform {
  const mercator = MercatorCoordinate.fromLngLat({ lng, lat }, 0);
  return {
    translateX: mercator.x,
    translateY: mercator.y,
    translateZ: mercator.z,
    rotateX: Math.PI / 2,
    scale: mercator.meterInMercatorCoordinateUnits(),
  };
}

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}

function rebuildMeshes(state: LayerState, data: ThreeTwinPayload) {
  while (state.root.children.length) {
    const child = state.root.children[0];
    state.root.remove(child);
    disposeObject(child);
  }

  const parcelById = new Map(data.parcels.map((p) => [p.id, p]));
  const spaces = drawableSpaces(data.parcels, data.spaces);
  const span = data.sideM;

  for (const rect of spaces) {
    const parcel = parcelById.get(rect.id);
    if (!parcel) continue;
    const { cx, cy, west, east, north, south } = spaceCenterMeters(span, rect);
    const wM = parcel.widthM && parcel.widthM > 0 ? parcel.widthM : Math.max(2, east - west);
    const dM = parcel.lengthM && parcel.lengthM > 0 ? parcel.lengthM : Math.max(2, north - south);

    const group = new THREE.Group();
    // Local meters: +X east, +Y up, +Z south (matches MapLibre sample after rotateX).
    group.position.set(cx, 0, -cy);
    group.rotation.y = THREE.MathUtils.degToRad(-(rect.rotation || 0));

    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(wM, 0.06, dM),
      new THREE.MeshStandardMaterial({
        color: data.focusedId === parcel.id ? 0xe0f2fe : 0xbbf7d0,
        transparent: true,
        opacity: 0.5,
      }),
    );
    bed.position.y = 0.03;
    group.add(bed);

    fillSpaceContent(group, {
      moduleId: data.moduleId,
      name: parcel.name,
      crop: parcel.crop,
      roomW: wM,
      roomD: dM,
      spacingM: parcel.spacingM ?? null,
    });

    state.root.add(group);
  }
}

export function createRadarMapLibreThreeLayer(
  id: string,
  getData: () => ThreeTwinPayload,
): CustomLayerInterface {
  let state: LayerState | null = null;

  return {
    id,
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      const camera = new THREE.Camera();
      const scene = new THREE.Scene();
      const root = new THREE.Group();
      scene.add(root);
      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const sun = new THREE.DirectionalLight(0xffffff, 1.1);
      sun.position.set(50, 90, 30);
      scene.add(sun);

      const renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;

      const data = getData();
      state = {
        renderer,
        scene,
        camera,
        root,
        map,
        transform: makeTransform(data.lat, data.lng),
        lastKey: '',
      };
      rebuildMeshes(state, data);
      state.lastKey = threeTwinPayloadKey(data);
    },

    render(_gl, matrix) {
      if (!state) return;
      const data = getData();
      const key = threeTwinPayloadKey(data);
      if (key !== state.lastKey) {
        state.transform = makeTransform(data.lat, data.lng);
        rebuildMeshes(state, data);
        state.lastKey = key;
      }

      const { transform, camera, renderer, scene, map } = state;
      const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), transform.rotateX);
      const l = new THREE.Matrix4()
        .makeTranslation(transform.translateX, transform.translateY, transform.translateZ)
        .scale(new THREE.Vector3(transform.scale, -transform.scale, transform.scale))
        .multiply(rotationX);

      camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix as unknown as number[]).multiply(l);
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    },

    onRemove() {
      if (!state) return;
      while (state.root.children.length) {
        const child = state.root.children[0];
        state.root.remove(child);
        disposeObject(child);
      }
      state.renderer.dispose();
      state = null;
    },
  };
}
