/**
 * Link curto de convite CHORUS: /m/{code}
 * O código é uma bijeção do id da sessão (cuid), sem coluna nova.
 */

const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function blockWidth(inputLen: number): number {
  return Math.max(1, Math.ceil((inputLen * Math.log(36)) / Math.log(62)));
}

function widthsForLength(length: number): number[] {
  const widths: number[] = [];
  let left = length;
  while (left > 0) {
    const take = Math.min(8, left);
    widths.push(blockWidth(take));
    left -= take;
  }
  return widths;
}

function encodeBlock(slice: string): string {
  let n = 0n;
  for (const ch of slice) {
    const v = B36.indexOf(ch);
    if (v < 0) throw new Error('invalid');
    n = n * 36n + BigInt(v);
  }
  const width = blockWidth(slice.length);
  let out = '';
  for (let i = 0; i < width; i += 1) {
    out = B62[Number(n % 62n)] + out;
    n /= 62n;
  }
  if (n !== 0n) throw new Error('overflow');
  return out;
}

function decodeBlock(encoded: string, inputLen: number): string {
  let n = 0n;
  for (const ch of encoded) {
    const v = B62.indexOf(ch);
    if (v < 0) throw new Error('invalid');
    n = n * 62n + BigInt(v);
  }
  let body = '';
  while (n > 0n) {
    body = B36[Number(n % 36n)] + body;
    n /= 36n;
  }
  if (body.length > inputLen) throw new Error('overflow');
  return body.padStart(inputLen, '0');
}

/** Código estável e reversível. Ids fora de [0-9a-z] ficam iguais. */
export function meetShortCode(sessionId: string): string {
  const id = sessionId.trim().toLowerCase();
  if (!/^[0-9a-z]+$/.test(id) || id.length < 8 || id.length > 61) return sessionId.trim();
  const blocks: string[] = [];
  for (let i = 0; i < id.length; i += 8) {
    blocks.push(encodeBlock(id.slice(i, i + 8)));
  }
  return `${B62[id.length]}${blocks.join('')}`;
}

/** null se o código não for um short code válido (roundtrip). */
export function meetSessionIdFromShortCode(code: string): string | null {
  const raw = code.trim();
  if (raw.length < 2) return null;
  const length = B62.indexOf(raw[0] || '');
  if (length < 8 || length > 61) return null;
  const widths = widthsForLength(length);
  const expected = 1 + widths.reduce((sum, w) => sum + w, 0);
  if (raw.length !== expected) return null;
  try {
    let offset = 1;
    let id = '';
    let left = length;
    for (const width of widths) {
      const take = Math.min(8, left);
      id += decodeBlock(raw.slice(offset, offset + width), take);
      offset += width;
      left -= take;
    }
    if (id.length !== length || meetShortCode(id) !== raw) return null;
    return id;
  } catch {
    return null;
  }
}

/** Aceita short code ou o id completo (links antigos). */
export function resolveMeetSessionKey(key: string): string {
  const trimmed = key.trim();
  return meetSessionIdFromShortCode(trimmed) || trimmed;
}
