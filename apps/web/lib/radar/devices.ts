/** First hardware kit: Dragino LoRaWAN for farm + agroindustry. */

export type RadarDeviceSku = 'LPS8N' | 'SE01-LB' | 'SW3L-LB' | 'LHT65N-E5' | 'SVC01-LS2';

export type RadarDeviceProfile = {
  sku: RadarDeviceSku;
  role: 'gateway' | 'sensor' | 'actuator';
  primaryMetric: string;
  metrics: Array<{ id: string; unit: string }>;
  label: { pt: string; es: string; en: string };
};

export const RADAR_DEVICE_CATALOG: RadarDeviceProfile[] = [
  {
    sku: 'LPS8N',
    role: 'gateway',
    primaryMetric: 'gateway',
    metrics: [],
    label: {
      pt: 'Gateway LoRaWAN interior',
      es: 'Gateway LoRaWAN interior',
      en: 'Indoor LoRaWAN gateway',
    },
  },
  {
    sku: 'SE01-LB',
    role: 'sensor',
    primaryMetric: 'soil_moisture',
    metrics: [
      { id: 'soil_moisture', unit: '%' },
      { id: 'soil_ec', unit: 'uS/cm' },
      { id: 'soil_temperature', unit: '°C' },
    ],
    label: {
      pt: 'Humidade e condutividade do solo',
      es: 'Humedad y conductividad del suelo',
      en: 'Soil moisture and EC',
    },
  },
  {
    sku: 'SW3L-LB',
    role: 'sensor',
    primaryMetric: 'water_flow',
    metrics: [{ id: 'water_flow', unit: 'L' }],
    label: {
      pt: 'Caudal de água',
      es: 'Caudal de agua',
      en: 'Water flow',
    },
  },
  {
    sku: 'LHT65N-E5',
    role: 'sensor',
    primaryMetric: 'temperature',
    metrics: [
      { id: 'temperature', unit: '°C' },
      { id: 'air_humidity', unit: '%' },
      { id: 'illuminance', unit: 'lux' },
    ],
    label: {
      pt: 'Temperatura, humidade do ar e luz',
      es: 'Temperatura, humedad del aire y luz',
      en: 'Temperature, air humidity and light',
    },
  },
  {
    sku: 'SVC01-LS2',
    role: 'actuator',
    primaryMetric: 'valve_open',
    metrics: [{ id: 'valve_open', unit: '0/1' }],
    label: {
      pt: 'Válvula solenoide',
      es: 'Válvula solenoide',
      en: 'Solenoid valve',
    },
  },
];

export const RADAR_INGEST_METRICS = new Set<string>([
  'gateway',
  'soil_moisture',
  'soil_ec',
  'soil_temperature',
  'water_flow',
  'temperature',
  'air_humidity',
  'illuminance',
  'valve_open',
  'irrigation_mm',
  'input_applied',
  'waste_pct',
]);

const ALIAS: Record<string, { metric: string; unit: string }> = {
  soil_moisture: { metric: 'soil_moisture', unit: '%' },
  moisture: { metric: 'soil_moisture', unit: '%' },
  soil_moisture_pct: { metric: 'soil_moisture', unit: '%' },
  soil_ec: { metric: 'soil_ec', unit: 'uS/cm' },
  ec: { metric: 'soil_ec', unit: 'uS/cm' },
  soil_temperature: { metric: 'soil_temperature', unit: '°C' },
  temp_ds: { metric: 'soil_temperature', unit: '°C' },
  temperature: { metric: 'temperature', unit: '°C' },
  tempc_sht: { metric: 'temperature', unit: '°C' },
  air_humidity: { metric: 'air_humidity', unit: '%' },
  humidity: { metric: 'air_humidity', unit: '%' },
  hum_sht: { metric: 'air_humidity', unit: '%' },
  illuminance: { metric: 'illuminance', unit: 'lux' },
  lux: { metric: 'illuminance', unit: 'lux' },
  water_flow: { metric: 'water_flow', unit: 'L' },
  flow: { metric: 'water_flow', unit: 'L' },
  pulse: { metric: 'water_flow', unit: 'L' },
  valve: { metric: 'valve_open', unit: '0/1' },
  valve_open: { metric: 'valve_open', unit: '0/1' },
  valve_status: { metric: 'valve_open', unit: '0/1' },
};

export function deviceBySku(sku: string | null | undefined): RadarDeviceProfile | null {
  const key = String(sku || '').trim().toUpperCase();
  return RADAR_DEVICE_CATALOG.find((d) => d.sku === key) || null;
}

export function normalizeDevEui(raw: unknown): string | null {
  const s = String(raw || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (s.length < 8 || s.length > 16) return null;
  return s;
}

export type NormalizedReading = { metric: string; value: number; unit: string };

export function readingsFromDecoded(decoded: unknown): NormalizedReading[] {
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return [];
  const out: NormalizedReading[] = [];
  for (const [key, raw] of Object.entries(decoded as Record<string, unknown>)) {
    const spec = ALIAS[key.trim().toLowerCase()];
    if (!spec) continue;
    const value = typeof raw === 'boolean' ? (raw ? 1 : 0) : Number(raw);
    if (!Number.isFinite(value)) continue;
    out.push({ metric: spec.metric, value, unit: spec.unit });
  }
  return out;
}

export function unitForMetric(metric: string): string {
  if (metric === 'soil_moisture' || metric === 'air_humidity') return '%';
  if (metric === 'soil_ec') return 'uS/cm';
  if (metric === 'temperature' || metric === 'soil_temperature') return '°C';
  if (metric === 'illuminance') return 'lux';
  if (metric === 'water_flow') return 'L';
  if (metric === 'valve_open') return '0/1';
  if (metric === 'irrigation_mm') return 'mm';
  return 'u';
}
