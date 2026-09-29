export const RADAR_ORG_ROLES = ['producer', 'provider'] as const;
export type RadarOrgRole = (typeof RADAR_ORG_ROLES)[number];

export function isRadarOrgRole(v: unknown): v is RadarOrgRole {
  return v === 'producer' || v === 'provider';
}

export function radarHomePath(role: RadarOrgRole): string {
  return role === 'provider' ? '/hub/radar/provider' : '/hub/radar/producer';
}

export const RADAR_ORG_ROLE_COPY = {
  producer: {
    pt: {
      title: 'Empresa produtora',
      body: 'Operação rural própria — propriedades, planta, sensores e decisão no campo.',
    },
    es: {
      title: 'Empresa productora',
      body: 'Operación rural propia — propiedades, planta, sensores y decisión en campo.',
    },
    en: {
      title: 'Producer company',
      body: 'Your own rural operation — properties, plant map, sensors and field decisions.',
    },
  },
  provider: {
    pt: {
      title: 'Prestadora de serviço',
      body: 'Assistência, consultoria ou agronomia — carteira de clientes e propriedades de cada um.',
    },
    es: {
      title: 'Prestadora de servicio',
      body: 'Asistencia, consultoría o agronomía — cartera de clientes y propiedades de cada uno.',
    },
    en: {
      title: 'Service provider',
      body: 'Assistance, consulting or agronomy — client portfolio and each client’s properties.',
    },
  },
} as const;
