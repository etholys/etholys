/**
 * Site % layout ↔ WGS84 helpers shared by Leaflet (2D) and MapLibre (3D).
 * Origin is property lat/lng; site is a square of sideM meters, north-up.
 */

import type { RadarSpaceRect } from '@/lib/radar/site-layout';

export function offsetLatLng(lat: number, lng: number, eastM: number, northM: number): [number, number] {
  const lat2 = lat + northM / 111320;
  const lng2 = lng + eastM / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lat2, lng2];
}

export function siteRing(lat: number, lng: number, sideM: number): [number, number][] {
  const h = sideM / 2;
  return [
    offsetLatLng(lat, lng, -h, h),
    offsetLatLng(lat, lng, h, h),
    offsetLatLng(lat, lng, h, -h),
    offsetLatLng(lat, lng, -h, -h),
  ];
}

/** Closed ring as [lng, lat] for GeoJSON. */
export function siteRingLngLat(lat: number, lng: number, sideM: number): [number, number][] {
  const ring = siteRing(lat, lng, sideM);
  const closed = ring.map(([la, ln]) => [ln, la] as [number, number]);
  closed.push(closed[0]);
  return closed;
}

export function spaceRing(lat: number, lng: number, sideM: number, rect: RadarSpaceRect): [number, number][] {
  const west = -sideM / 2 + (rect.x / 100) * sideM;
  const east = west + (rect.w / 100) * sideM;
  const north = sideM / 2 - (rect.y / 100) * sideM;
  const south = north - (rect.h / 100) * sideM;
  const cx = (west + east) / 2;
  const cy = (north + south) / 2;
  const deg = ((rect.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(deg);
  const sin = Math.sin(deg);
  const corners: Array<[number, number]> = [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
  return corners.map(([ex, ny]) => {
    const dx = ex - cx;
    const dy = ny - cy;
    return offsetLatLng(lat, lng, cx + dx * cos - dy * sin, cy + dx * sin + dy * cos);
  });
}

export function spaceRingLngLat(
  lat: number,
  lng: number,
  sideM: number,
  rect: RadarSpaceRect,
): [number, number][] {
  const ring = spaceRing(lat, lng, sideM, rect);
  const closed = ring.map(([la, ln]) => [ln, la] as [number, number]);
  closed.push(closed[0]);
  return closed;
}

export function latLngToPct(lat0: number, lng0: number, sideM: number, lat: number, lng: number) {
  const northM = (lat - lat0) * 111320;
  const eastM = (lng - lng0) * (111320 * Math.cos((lat0 * Math.PI) / 180));
  return {
    x: ((eastM + sideM / 2) / sideM) * 100,
    y: ((sideM / 2 - northM) / sideM) * 100,
  };
}

export function spaceCenterMeters(sideM: number, rect: Pick<RadarSpaceRect, 'x' | 'y' | 'w' | 'h'>) {
  const west = -sideM / 2 + (rect.x / 100) * sideM;
  const east = west + (rect.w / 100) * sideM;
  const north = sideM / 2 - (rect.y / 100) * sideM;
  const south = north - (rect.h / 100) * sideM;
  return { cx: (west + east) / 2, cy: (north + south) / 2, west, east, north, south };
}

/** Angle of a map point around the footprint centre: 0 = north, + = toward east (clockwise). */
export function spacePointerDegFromLatLng(
  lat0: number,
  lng0: number,
  sideM: number,
  rect: Pick<RadarSpaceRect, 'x' | 'y' | 'w' | 'h'>,
  lat: number,
  lng: number,
) {
  const { cx, cy } = spaceCenterMeters(sideM, rect);
  const northM = (lat - lat0) * 111320;
  const eastM = (lng - lng0) * (111320 * Math.cos((lat0 * Math.PI) / 180));
  return (Math.atan2(eastM - cx, northM - cy) * 180) / Math.PI;
}

export function spacePointerDeg(
  lat0: number,
  lng0: number,
  sideM: number,
  drag: { x: number; y: number; w: number; h: number },
  lat: number,
  lng: number,
) {
  return spacePointerDegFromLatLng(
    lat0,
    lng0,
    sideM,
    { x: drag.x - drag.w / 2, y: drag.y - drag.h / 2, w: drag.w, h: drag.h },
    lat,
    lng,
  );
}

/** Handle sits just outside the rotated top edge so it tracks free rotation. */
export function spaceRotateHandle(
  lat: number,
  lng: number,
  sideM: number,
  rect: RadarSpaceRect,
): [number, number] {
  const { cx, cy, north, south } = spaceCenterMeters(sideM, rect);
  const tip = (north - south) / 2 + Math.max(10, ((north - south) / 2) * 0.18);
  const deg = ((rect.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(deg);
  const sin = Math.sin(deg);
  return offsetLatLng(lat, lng, cx - tip * sin, cy + tip * cos);
}
