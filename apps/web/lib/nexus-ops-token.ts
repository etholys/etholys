import { createHash, randomBytes } from 'crypto';

export const FIELD_ENTRY_KINDS = [
  'planting',
  'input',
  'irrigation',
  'pest',
  'harvest',
  'observation',
  'visit',
  'note',
  'health',
  'feed',
  'milking',
  'egg',
  'biosecurity',
  'hive_inspect',
  'process',
  'hygiene',
  'qc',
] as const;

export type FieldEntryKindId = (typeof FIELD_ENTRY_KINDS)[number];

export function isFieldEntryKind(v: string): v is FieldEntryKindId {
  return (FIELD_ENTRY_KINDS as readonly string[]).includes(v);
}

export function hashSensorToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateSensorToken(): { token: string; hash: string } {
  const token = `nxsens_${randomBytes(24).toString('hex')}`;
  return { token, hash: hashSensorToken(token) };
}

export function verifySensorToken(token: string, hash: string): boolean {
  if (!token || !hash) return false;
  const computed = hashSensorToken(token);
  if (computed.length !== hash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return mismatch === 0;
}

export function ingestCompanyForSensor(
  sensor: { companyId: string; tokenHash: string; isActive: boolean } | null,
  token: string
): { ok: true; companyId: string } | { ok: false; reason: 'invalid' } {
  if (!sensor || !sensor.isActive) return { ok: false, reason: 'invalid' };
  if (!token.startsWith('nxsens_') || !verifySensorToken(token, sensor.tokenHash)) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, companyId: sensor.companyId };
}
