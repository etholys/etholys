import type { VentureStageId } from '@/lib/nexus-venture';
import { isValidStage } from '@/lib/nexus-venture';

export type NexusQuickStep = {
  id: string;
  titlePt: string;
  titleEs: string;
  titleEn: string;
  hintPt: string;
  hintEs: string;
  hintEn: string;
  /** Path (sem origem) — a página anexa ?network= se for rede */
  path: string;
  emphasis: 'high' | 'default';
};

function withNetwork(path: string, networkId: string | null | undefined): string {
  if (!networkId) return path;
  const q = new URLSearchParams();
  q.set('network', networkId);
  const join = path.includes('?') ? '&' : '?';
  return `${path}${join}${q.toString()}`;
}

const BASE_PATHS: Record<string, (net: string | null) => string> = {
  journey: (n) => withNetwork('/hub/nexus/journey', n),
  diagnosis: (n) => withNetwork('/hub/nexus/diagnosis', n),
  roadmap: (n) => withNetwork('/hub/nexus/roadmap', n),
  services: (n) => withNetwork('/hub/nexus/services', n),
  library: (n) => withNetwork('/hub/nexus/library', n),
  networks: (n) => withNetwork('/hub/nexus/networks', n),
  dashboard: (_n) => '/dashboard',
  siep: (_n) => '/siep',
  workspace: (_n) => '/hub/workspace',
  forge: (_n) => '/hub/forge',
  hub: (_n) => '/hub',
};

const STEPS: Record<VentureStageId, NexusQuickStep[]> = {
  DISCOVER: [
    {
      id: 'disc-1',
      titlePt: 'Fazer o diagnóstico guiado',
      titleEs: 'Hacer el diagnóstico guiado',
      titleEn: 'Run the guided diagnosis',
      hintPt: 'Clareia forças e lacunas; alimenta a rota e o assessor.',
      hintEs: 'Aclara brechas; alimenta la ruta y el asesor.',
      hintEn: 'Surfaces strengths and gaps; feeds roadmap and the advisor.',
      path: 'diagnosis',
      emphasis: 'high',
    },
    {
      id: 'disc-2',
      titlePt: 'Rever a fase da jornada de incubação',
      titleEs: 'Revisar fase de la jornada de incubación',
      titleEn: 'Check your venture journey stage',
      hintPt: 'Confirma se a fase (Descoberta) combina com o teu negócio hoje.',
      hintEs: 'Confirma si la fase (Descubrimiento) aplica a tu negocio hoy.',
      hintEn: 'Confirm Discovery matches your current reality.',
      path: 'journey',
      emphasis: 'default',
    },
    {
      id: 'disc-3',
      titlePt: 'Abrir o Centro integrado (o que fazer hoje)',
      titleEs: 'Abrir el centro integrado (qué hacer hoy)',
      titleEn: 'Open the integrated workspace (today’s queue)',
      hintPt: 'Tarefas, alertas e prazos noutros módulos, num só sítio.',
      hintEs: 'Tareas y alertas de otros módulos en un solo lugar.',
      hintEn: 'Tasks and alerts from other modules in one place.',
      path: 'workspace',
      emphasis: 'default',
    },
  ],
  FOCUS: [
    {
      id: 'foc-1',
      titlePt: 'Criar ou priorizar ações na rota viva',
      titleEs: 'Crear o priorizar acciones en la ruta viva',
      titleEn: 'Create or prioritise live roadmap actions',
      hintPt: 'Segmento, oferta e uma métrica de tração para acompanhares.',
      hintEs: 'Segmento, oferta y una métrica de tracción.',
      hintEn: 'Segment, offer, and one traction number to follow.',
      path: 'roadmap',
      emphasis: 'high',
    },
    {
      id: 'foc-2',
      titlePt: 'Sincronizar com projetos (SIEP)',
      titleEs: 'Sincronizar con proyectos (SIEP)',
      titleEn: 'Align with projects (SIEP)',
      hintPt: 'Se tiveres projecto, liga as metas semanais ao que está no SIEP.',
      hintEs: 'Si hay proyecto, alinea metas con SIEP.',
      hintEn: 'If you have a project, align weekly goals with SIEP.',
      path: 'siep',
      emphasis: 'default',
    },
    {
      id: 'foc-3',
      titlePt: 'Pedir apoio no ticket de serviço',
      titleEs: 'Pedir apoyo con ticket de servicio',
      titleEn: 'Request help via a service ticket',
      hintPt: 'Para execução com IA / equipa, sem perderes o fio no Hub.',
      hintEs: 'Para ejecución híbrida con IA o equipo interno.',
      hintEn: 'For hybrid or internal follow-through.',
      path: 'services',
      emphasis: 'default',
    },
  ],
  BUILD: [
    {
      id: 'bld-1',
      titlePt: 'Mapear processos e responsáveis (tarefas)',
      titleEs: 'Mapear procesos y responsables (tareas)',
      titleEn: 'Map processes and owners (tasks)',
      hintPt: 'Usa tarefas ATLAS e liga a entregas no SIEP quando fizer sentido.',
      hintEs: 'Usa tareas en ATLAS y conecta a entregas en SIEP.',
      hintEn: 'Use ATLAS tasks and connect to SIEP deliverables when relevant.',
      path: 'dashboard',
      emphasis: 'high',
    },
    {
      id: 'bld-2',
      titlePt: 'Rever finanças e caixa (ATLAS)',
      titleEs: 'Rever finanzas y caja (ATLAS)',
      titleEn: 'Review finance and cash (ATLAS)',
      hintPt: 'Crescimento com disciplina: alinha oferta, custo e prazos.',
      hintEs: 'Crecer con control: oferta, coste y plazos.',
      hintEn: 'Grow with discipline: offer, cost, and timelines.',
      path: 'dashboard',
      emphasis: 'default',
    },
    {
      id: 'bld-3',
      titlePt: 'Ler o método na biblioteca NEXUS',
      titleEs: 'Leer el método en la biblioteca NEXUS',
      titleEn: 'Read the method in the NEXUS library',
      hintPt: 'Ciclo sugerido e como usar o questionário e a rota.',
      hintEs: 'Ciclo sugerido y cómo usar cuestionario y ruta.',
      hintEn: 'Suggested cycle and how to use the questionnaire and route.',
      path: 'library',
      emphasis: 'default',
    },
  ],
  MEASURE: [
    {
      id: 'mea-1',
      titlePt: 'Rever indicadores e ritmo (SIEP / PRISM)',
      titleEs: 'Rever indicadores y ritmo (SIEP / PRISM)',
      titleEn: 'Review indicators and cadence (SIEP / PRISM)',
      hintPt: 'KPI, marcos e o que contar a financiadores (PRISM) vs operação (Workspace).',
      hintEs: 'KPI, hitos y qué contar a financiadores (PRISM).',
      hintEn: 'KPIs, milestones, and donor-facing reporting (PRISM) vs day-to-day.',
      path: 'siep',
      emphasis: 'high',
    },
    {
      id: 'mea-2',
      titlePt: 'Fechar ações pendentes na rota viva',
      titleEs: 'Cerrar acciones pendientes en la ruta viva',
      titleEn: 'Close pending live roadmap items',
      hintPt: 'Mantém o ritmo de melhoria contínua visível no Hub.',
      hintEs: 'Mantén el ritmo de mejora en el Hub.',
      hintEn: 'Keep continuous improvement visible in the Hub.',
      path: 'roadmap',
      emphasis: 'default',
    },
    {
      id: 'mea-3',
      titlePt: 'Centro integrado: alertas e prazos',
      titleEs: 'Centro integrado: alertas y plazos',
      titleEn: 'Workspace: alerts and deadlines',
      hintPt: 'Garante que o que atrasou aparece e é tratado.',
      hintEs: 'Asegura que retrasos se vean y se atiendan.',
      hintEn: 'Ensure slippage shows up and gets handled.',
      path: 'workspace',
      emphasis: 'default',
    },
  ],
  SCALE_GLOBAL: [
    {
      id: 'scl-1',
      titlePt: 'Checklist internacional na jornada',
      titleEs: 'Checklist internacional en la jornada',
      titleEn: 'International checklist on the journey',
      hintPt: 'Regiões, conformidade, parceiros e logística — ponto a ponto na jornada.',
      hintEs: 'Regiones, cumplimiento, socios y logística en la jornada.',
      hintEn: 'Regions, compliance, partners, and logistics in the journey UI.',
      path: 'journey',
      emphasis: 'high',
    },
    {
      id: 'scl-2',
      titlePt: 'Rede de parceiros (NEXUS)',
      titleEs: 'Red de partners (NEXUS)',
      titleEn: 'Partner network (NEXUS)',
      hintPt: 'Se a estratégia for ecossistema, regista a rede e membros.',
      hintEs: 'Si la estrategia es ecosistema, gestiona la red y miembros.',
      hintEn: 'If strategy is ecosystem, register the network and members.',
      path: 'networks',
      emphasis: 'default',
    },
    {
      id: 'scl-3',
      titlePt: 'Inovação e oferta (FORGE / Lab)',
      titleEs: 'Innovación y oferta (FORGE / Lab)',
      titleEn: 'Innovation and offer (FORGE / Lab)',
      hintPt: 'Onde ajustas produto, prototipo ou parcerias técnicas.',
      hintEs: 'Donde ajustar producto, prototipo o alianzas técnicas.',
      hintEn: 'Where you shape product, prototype, or technical partnerships.',
      path: 'forge',
      emphasis: 'default',
    },
  ],
};

const PATH_RESOLVER: Record<string, (n: string | null) => string> = {
  journey: (n) => BASE_PATHS.journey(n),
  diagnosis: (n) => BASE_PATHS.diagnosis(n),
  roadmap: (n) => BASE_PATHS.roadmap(n),
  services: (n) => BASE_PATHS.services(n),
  library: (n) => BASE_PATHS.library(n),
  networks: (n) => BASE_PATHS.networks(n),
  workspace: (n) => BASE_PATHS.workspace(n),
  siep: (n) => BASE_PATHS.siep(n),
  dashboard: (n) => BASE_PATHS.dashboard(n),
  forge: (n) => BASE_PATHS.forge(n),
  hub: (n) => BASE_PATHS.hub(n),
};

/**
 * Resolves path keys to full app paths, preserving rede (?network) quando existir.
 */
export function buildNexusQuickSteps(stage: VentureStageId, networkId: string | null | undefined): NexusQuickStep[] {
  const n = networkId || null;
  const raw = STEPS[stage] || STEPS.DISCOVER;
  return raw.map((s) => {
    const key = s.path;
    const resolver = PATH_RESOLVER[key] || BASE_PATHS.diagnosis;
    return { ...s, path: typeof resolver === 'function' ? (resolver as (x: string | null) => string)(n) : `/${key}` };
  });
}

export function safeVentureStage(raw: string | null | undefined): VentureStageId {
  if (raw && isValidStage(raw)) return raw as VentureStageId;
  return 'DISCOVER';
}
