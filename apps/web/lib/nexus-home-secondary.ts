import { nexusHybridLocale } from '@/lib/nexus-hybrid';

export type NexusHomeLocale = 'pt' | 'es' | 'en';

export function nexusHomeLoc(raw: string | undefined): NexusHomeLocale {
  return nexusHybridLocale(raw);
}

export type NexusHomeSecondary = {
  loadError: string;
  retry: string;
  welcomeTitle: string;
  welcomeBody: string;
  netCompanies: string;
  netAnchor: string;
  netSiep: string;
  profileLabel: string;
  profileRole: string;
  profileHint: string;
  tools: {
    diagnosis: string;
    diagnosisHint: string;
    roadmap: string;
    roadmapHint: string;
    services: string;
    servicesHint: string;
    library: string;
    libraryHint: string;
  };
  recommendations: string;
};

const COPY: Record<NexusHomeLocale, NexusHomeSecondary> = {
  pt: {
    loadError: 'Não foi possível carregar o NEXUS.',
    retry: 'Tentar de novo',
    welcomeTitle: 'Bem-vindo ao NEXUS',
    welcomeBody: 'Comece pela fase, pelo diagnóstico ou pela rota.',
    netCompanies: 'empresas',
    netAnchor: 'âncora',
    netSiep: 'projeto SIEP',
    profileLabel: 'Perfil em uso',
    profileRole: 'função nesta empresa',
    profileHint: '',
    tools: {
      diagnosis: 'Diagnóstico guiado',
      diagnosisHint: 'Forças e debilidades por pilar',
      roadmap: 'Rota viva',
      roadmapHint: 'Ações e ritmo de execução',
      services: 'Serviços internos',
      servicesHint: 'Pedidos e tickets à equipa',
      library: 'Biblioteca',
      libraryHint: 'Método e guias de utilização',
    },
    recommendations: 'Próximas recomendações',
  },
  es: {
    loadError: 'No se pudo cargar NEXUS.',
    retry: 'Reintentar',
    welcomeTitle: 'Bienvenido a NEXUS',
    welcomeBody: 'Empiecen por la fase, el diagnóstico o la ruta.',
    netCompanies: 'empresas',
    netAnchor: 'ancla',
    netSiep: 'proyecto SIEP',
    profileLabel: 'Perfil en uso',
    profileRole: 'rol en esta empresa',
    profileHint: '',
    tools: {
      diagnosis: 'Diagnóstico guiado',
      diagnosisHint: 'Fortalezas y brechas por pilar',
      roadmap: 'Ruta viva',
      roadmapHint: 'Acciones y ritmo',
      services: 'Servicios internos',
      servicesHint: 'Solicitudes y tickets al equipo',
      library: 'Biblioteca',
      libraryHint: 'Método y guías de uso',
    },
    recommendations: 'Próximas recomendaciones',
  },
  en: {
    loadError: 'Could not load NEXUS.',
    retry: 'Try again',
    welcomeTitle: 'Welcome to NEXUS',
    welcomeBody: 'Start with phase, diagnosis, or the roadmap.',
    netCompanies: 'companies',
    netAnchor: 'anchor',
    netSiep: 'SIEP project',
    profileLabel: 'Profile in use',
    profileRole: 'role in this company',
    profileHint: '',
    tools: {
      diagnosis: 'Guided diagnosis',
      diagnosisHint: 'Strengths and gaps by pillar',
      roadmap: 'Live roadmap',
      roadmapHint: 'Actions and execution rhythm',
      services: 'Internal services',
      servicesHint: 'Requests and tickets to the team',
      library: 'Library',
      libraryHint: 'Method and how-to guides',
    },
    recommendations: 'Next recommendations',
  },
};

export function getNexusHomeSecondary(locale: string | undefined): NexusHomeSecondary {
  return COPY[nexusHomeLoc(locale)];
}
