/**
 * Escala CMM 1–5 e itens de matriz setorial profunda.
 * Scores 0–100 mantêm compatibilidade com computeFullDiagnosticResult.
 */

export type MatrixOption = {
  id: string;
  label: { es: string; pt: string; en: string };
  score: number;
};

export const CMM_MATURITY_OPTIONS: MatrixOption[] = [
  {
    id: 'cmm1',
    label: {
      es: '1 — Ad-hoc / crítico (reactivo, sin registros)',
      pt: '1 — Ad-hoc / crítico (reativo, sem registos)',
      en: '1 — Ad-hoc / critical (reactive, no records)',
    },
    score: 20,
  },
  {
    id: 'cmm2',
    label: {
      es: '2 — Informal / tácito (oral, depende de personas clave)',
      pt: '2 — Informal / tácito (oral, depende de pessoas-chave)',
      en: '2 — Informal / tacit (oral, key-person dependent)',
    },
    score: 40,
  },
  {
    id: 'cmm3',
    label: {
      es: '3 — Funcional dependiente (opera solo con el dueño)',
      pt: '3 — Funcional dependente (só opera com o dono)',
      en: '3 — Owner-dependent functional',
    },
    score: 60,
  },
  {
    id: 'cmm4',
    label: {
      es: '4 — Estructurado / gestionado (documentado, medible)',
      pt: '4 — Estruturado / gerido (documentado, mensurável)',
      en: '4 — Structured / managed (documented, measurable)',
    },
    score: 80,
  },
  {
    id: 'cmm5',
    label: {
      es: '5 — Optimizado / escalable (mejora continua, replicable)',
      pt: '5 — Otimizado / escalável (melhoria contínua, replicável)',
      en: '5 — Optimized / scalable (continuous improvement)',
    },
    score: 100,
  },
];

export type SectorMatrixItem = {
  id: string;
  blockId: string;
  blockLabel: { es: string; pt: string; en: string };
  areaName: { es: string; pt: string; en: string };
  prompt: { es: string; pt: string; en: string };
  help: { es: string; pt: string; en: string };
  level5: { es: string; pt: string; en: string };
  pillarSlug: string;
  weight: number;
};

export type SectorMatrix = {
  sectorId: string;
  items: SectorMatrixItem[];
};
