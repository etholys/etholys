/**
 * Minimal JPEG EXIF GPS reader (browser / Node Buffer).
 * No dependency — enough for optional drone photo pin; not a full EXIF library.
 */

function readU16(view: DataView, offset: number, le: boolean): number {
  return le ? view.getUint16(offset, true) : view.getUint16(offset, false);
}

function readU32(view: DataView, offset: number, le: boolean): number {
  return le ? view.getUint32(offset, true) : view.getUint32(offset, false);
}

function readRational(view: DataView, offset: number, le: boolean): number {
  const num = readU32(view, offset, le);
  const den = readU32(view, offset + 4, le);
  if (!den) return 0;
  return num / den;
}

function dmsToDeg(d: number, m: number, s: number, ref: string): number {
  let deg = d + m / 60 + s / 3600;
  if (ref === 'S' || ref === 'W') deg = -deg;
  return deg;
}

/** Extract GPS lat/lng from a JPEG ArrayBuffer if present. */
export function extractJpegGps(buffer: ArrayBuffer): { lat: number; lng: number } | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    const size = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker === 0xe1) {
      const start = offset + 4;
      const end = offset + 2 + size;
      if (end > bytes.length) return null;
      const segment = bytes.slice(start, end);
      return parseExifGps(segment.buffer.slice(segment.byteOffset, segment.byteOffset + segment.byteLength));
    }
    if (marker === 0xda) break; // SOS
    offset += 2 + size;
  }
  return null;
}

function parseExifGps(seg: ArrayBuffer): { lat: number; lng: number } | null {
  const view = new DataView(seg);
  if (seg.byteLength < 14) return null;
  // "Exif\0\0"
  if (
    view.getUint8(0) !== 0x45 ||
    view.getUint8(1) !== 0x78 ||
    view.getUint8(2) !== 0x69 ||
    view.getUint8(3) !== 0x66
  ) {
    return null;
  }
  const tiff = 6;
  const endian = view.getUint16(tiff, false);
  const le = endian === 0x4949;
  if (!le && endian !== 0x4d4d) return null;
  const ifd0 = tiff + readU32(view, tiff + 4, le);

  const gpsPtr = findTagOffset(view, ifd0, 0x8825, le, tiff);
  if (gpsPtr == null) return null;
  const gpsIfd = tiff + gpsPtr;

  const latRef = findAsciiTag(view, gpsIfd, 0x0001, le, tiff);
  const lngRef = findAsciiTag(view, gpsIfd, 0x0003, le, tiff);
  const lat = findRational3(view, gpsIfd, 0x0002, le, tiff);
  const lng = findRational3(view, gpsIfd, 0x0004, le, tiff);
  if (!lat || !lng || !latRef || !lngRef) return null;

  const latDeg = dmsToDeg(lat[0], lat[1], lat[2], latRef.charAt(0).toUpperCase());
  const lngDeg = dmsToDeg(lng[0], lng[1], lng[2], lngRef.charAt(0).toUpperCase());
  if (!Number.isFinite(latDeg) || !Number.isFinite(lngDeg)) return null;
  if (Math.abs(latDeg) > 90 || Math.abs(lngDeg) > 180) return null;
  return { lat: latDeg, lng: lngDeg };
}

function findTagOffset(
  view: DataView,
  ifd: number,
  tag: number,
  le: boolean,
  tiff: number,
): number | null {
  if (ifd + 2 > view.byteLength) return null;
  const count = readU16(view, ifd, le);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    if (readU16(view, entry, le) !== tag) continue;
    const type = readU16(view, entry + 2, le);
    const num = readU32(view, entry + 4, le);
    if (type === 4 && num === 1) {
      return readU32(view, entry + 8, le);
    }
    // offset to value
    return readU32(view, entry + 8, le);
  }
  void tiff;
  return null;
}

function findAsciiTag(
  view: DataView,
  ifd: number,
  tag: number,
  le: boolean,
  tiff: number,
): string | null {
  if (ifd + 2 > view.byteLength) return null;
  const count = readU16(view, ifd, le);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    if (readU16(view, entry, le) !== tag) continue;
    const type = readU16(view, entry + 2, le);
    const num = readU32(view, entry + 4, le);
    if (type !== 2) return null;
    let off = entry + 8;
    if (num > 4) off = tiff + readU32(view, entry + 8, le);
    if (off + num > view.byteLength) return null;
    let s = '';
    for (let j = 0; j < num; j++) {
      const c = view.getUint8(off + j);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }
  return null;
}

function findRational3(
  view: DataView,
  ifd: number,
  tag: number,
  le: boolean,
  tiff: number,
): [number, number, number] | null {
  if (ifd + 2 > view.byteLength) return null;
  const count = readU16(view, ifd, le);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    if (readU16(view, entry, le) !== tag) continue;
    const type = readU16(view, entry + 2, le);
    const num = readU32(view, entry + 4, le);
    if (type !== 5 || num < 3) return null;
    const off = tiff + readU32(view, entry + 8, le);
    if (off + 24 > view.byteLength) return null;
    return [
      readRational(view, off, le),
      readRational(view, off + 8, le),
      readRational(view, off + 16, le),
    ];
  }
  return null;
}

/** Browser helper: File → optional GPS. */
export async function gpsFromImageFile(file: File): Promise<{ lat: number; lng: number } | null> {
  if (!file.type.includes('jpeg') && !/\.jpe?g$/i.test(file.name)) return null;
  const buf = await file.arrayBuffer();
  return extractJpegGps(buf);
}
