'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/app/providers';
import { ui } from '@/lib/i18n';
import { isLikelyDbId } from '@/lib/utils';
import { CheckCircle2, Circle, AlertCircle, FileCheck, TrendingUp } from 'lucide-react';

const ICONS = {
  governance: FileCheck,
  financial: TrendingUp,
  esg: AlertCircle,
  compliance: CheckCircle2,
} as const;

type ChecklistId = keyof typeof ICONS;

type ItemDef = { id: string; es: string; pt: string; en: string };
type ListDef = {
  id: ChecklistId;
  color: string;
  title: { es: string; pt: string; en: string };
  items: ItemDef[];
};

const LIST_DEFS: ListDef[] = [
  {
    id: 'governance',
    color: 'bg-blue-100 text-blue-700',
    title: {
      es: 'Gobernanza corporativa',
      pt: 'Governança Corporativa',
      en: 'Corporate governance',
    },
    items: [
      {
        id: '1',
        es: 'Estructura organizacional formalizada',
        pt: 'Estrutura organizacional formalizada',
        en: 'Formalized organizational structure',
      },
      {
        id: '2',
        es: 'Consejo con 3+ miembros independientes',
        pt: 'Conselho com 3+ membros independentes',
        en: 'Board with 3+ independent members',
      },
      {
        id: '3',
        es: 'Política de conflicto de intereses',
        pt: 'Política de conflito de interesses',
        en: 'Conflict of interest policy',
      },
      {
        id: '4',
        es: 'Director financiero dedicado',
        pt: 'Diretor financeiro dedicado',
        en: 'Dedicated finance director',
      },
    ],
  },
  {
    id: 'financial',
    color: 'bg-green-100 text-green-700',
    title: {
      es: 'Auditoría y contabilidad',
      pt: 'Auditoria & Contabilidade',
      en: 'Audit & accounting',
    },
    items: [
      {
        id: '1',
        es: 'Auditoría financiera independiente',
        pt: 'Auditoria financeira independente',
        en: 'Independent financial audit',
      },
      {
        id: '2',
        es: 'Estados financieros auditados (3 años)',
        pt: 'Demonstrações financeiras auditadas (3 anos)',
        en: 'Audited financial statements (3 years)',
      },
      {
        id: '3',
        es: 'Balance patrimonial positivo',
        pt: 'Balanço patrimonial positivo',
        en: 'Positive equity / balance sheet',
      },
      {
        id: '4',
        es: 'Control interno documentado',
        pt: 'Controle interno documentado',
        en: 'Documented internal controls',
      },
    ],
  },
  {
    id: 'esg',
    color: 'bg-emerald-100 text-emerald-700',
    title: {
      es: 'ESG y sostenibilidad',
      pt: 'ESG & Sustentabilidade',
      en: 'ESG & sustainability',
    },
    items: [
      {
        id: '1',
        es: 'Política de gestión ambiental',
        pt: 'Política de gestão ambiental',
        en: 'Environmental management policy',
      },
      {
        id: '2',
        es: 'Indicadores de impacto social',
        pt: 'Indicadores de impacto social',
        en: 'Social impact indicators',
      },
      {
        id: '3',
        es: 'Informe anual a partes interesadas',
        pt: 'Relatório anual de stakeholders',
        en: 'Annual stakeholder report',
      },
      {
        id: '4',
        es: 'Alineación con ODS',
        pt: 'Alinhamento com ODS',
        en: 'Alignment with SDGs',
      },
    ],
  },
  {
    id: 'compliance',
    color: 'bg-purple-100 text-purple-700',
    title: {
      es: 'Cumplimiento y legal',
      pt: 'Compliance & Legal',
      en: 'Compliance & legal',
    },
    items: [
      {
        id: '1',
        es: 'Documentación fiscal al día',
        pt: 'Documentação fiscal em dia',
        en: 'Tax documentation up to date',
      },
      {
        id: '2',
        es: 'Registro mercantil / personería jurídica',
        pt: 'Registro em Cartório de Pessoas Jurídicas',
        en: 'Legal entity registration',
      },
      {
        id: '3',
        es: 'Certificado de no adeudo',
        pt: 'Certidão negativa de débitos',
        en: 'Tax clearance certificate',
      },
      {
        id: '4',
        es: 'Política de privacidad y protección de datos',
        pt: 'Política de privacidade e LGPD',
        en: 'Privacy and data-protection policy',
      },
    ],
  },
];

type ChecklistState = {
  id: ChecklistId;
  color: string;
  items: Array<{ id: string; completed: boolean }>;
};

const getStorageKey = (fundId?: string | null) => `fundhubCompliance:${fundId || 'generic'}`;

function completedCount(items: Array<{ completed?: boolean }>) {
  return items.filter((item) => item.completed).length;
}

function blankChecklists(): ChecklistState[] {
  return LIST_DEFS.map((list) => ({
    id: list.id,
    color: list.color,
    items: list.items.map((item) => ({ id: item.id, completed: false })),
  }));
}

function hydrateChecklists(raw: unknown): ChecklistState[] {
  const saved = Array.isArray(raw) ? raw : [];
  return LIST_DEFS.map((list) => {
    const hit = saved.find((row) => row && typeof row === 'object' && (row as { id?: string }).id === list.id) as
      | { items?: Array<{ id?: string; completed?: boolean }> | Record<string, boolean> }
      | undefined;
    return {
      id: list.id,
      color: list.color,
      items: list.items.map((item) => {
        let completed = false;
        const items = hit?.items;
        if (Array.isArray(items)) {
          completed = Boolean(items.find((savedItem) => savedItem.id === item.id)?.completed);
        } else if (items && typeof items === 'object') {
          completed = Boolean((items as Record<string, boolean>)[item.id]);
        }
        return { id: item.id, completed };
      }),
    };
  });
}

export default function FundHubCompliancePage() {
  const searchParams = useSearchParams();
  const { activeCompanyId, locale } = useApp();
  const companyId = isLikelyDbId(String(activeCompanyId ?? '').trim())
    ? String(activeCompanyId).trim()
    : '';
  const fundId = searchParams.get('fundId');
  const storageKey = getStorageKey(fundId);
  const dateLoc = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';

  const [checklists, setChecklists] = useState<ChecklistState[]>(blankChecklists);
  const [notes, setNotes] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const apply = (nextLists: ChecklistState[], nextNotes: string, at: string | null) => {
      if (cancelled) return;
      setChecklists(nextLists);
      setNotes(nextNotes);
      setSavedAt(at);
      setReady(true);
    };

    let localLists = blankChecklists();
    let localNotes = '';
    let localAt: string | null = null;
    let localDone = 0;
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.checklists) localLists = hydrateChecklists(parsed.checklists);
          if (parsed.notes) localNotes = parsed.notes;
          if (parsed.savedAt) localAt = parsed.savedAt;
          localDone = localLists.reduce((n, list) => n + completedCount(list.items || []), 0);
        } catch {
          localLists = blankChecklists();
        }
      }
    }

    if (!companyId || fundId) {
      apply(localLists, localNotes, localAt);
      return () => {
        cancelled = true;
      };
    }

    fetch(`/api/fundhub/compliance?companyId=${encodeURIComponent(companyId)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { checklists?: Array<{ id: string; items: Record<string, boolean> }>; notes?: string } | null) => {
        const server = d?.checklists ?? [];
        const merged = LIST_DEFS.map((list) => {
          const hit = server.find((row) => row.id === list.id);
          return {
            id: list.id,
            color: list.color,
            items: list.items.map((item) => ({
              id: item.id,
              completed: hit?.items?.[item.id] ?? false,
            })),
          };
        });
        const serverDone = merged.reduce((n, list) => n + completedCount(list.items), 0);
        if (localDone === 0 && serverDone > 0) {
          apply(merged, d?.notes || localNotes, new Date().toISOString());
        } else {
          apply(localLists, localNotes, localAt);
        }
      })
      .catch(() => apply(localLists, localNotes, localAt));

    return () => {
      cancelled = true;
    };
  }, [storageKey, companyId, fundId]);

  useEffect(() => {
    if (!ready || typeof window === 'undefined') return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        checklists: checklists.map((list) => ({
          id: list.id,
          items: list.items.map((item) => ({ id: item.id, completed: item.completed })),
        })),
        notes,
        savedAt: savedAt || new Date().toISOString(),
      }),
    );
  }, [checklists, notes, storageKey, ready, savedAt]);

  const toggleItem = (checklistId: string, itemId: string) => {
    setChecklists(
      checklists.map((checklist) => {
        if (checklist.id === checklistId) {
          return {
            ...checklist,
            items: checklist.items.map((item) => ({
              ...item,
              completed: item.id === itemId ? !item.completed : item.completed,
            })),
          };
        }
        return checklist;
      }),
    );
  };

  const resetChecklist = () => {
    setChecklists(blankChecklists());
    setNotes('');
    setSavedAt(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
  };

  const getProgress = (items: Array<{ completed: boolean }>) => {
    const completed = items.filter((item) => item.completed).length;
    return Math.round((completed / Math.max(items.length, 1)) * 100);
  };

  const totalItems = checklists.reduce((acc, c) => acc + c.items.length, 0);
  const completedItems = checklists.reduce((acc, c) => acc + completedCount(c.items), 0);
  const overallProgress = Math.round((completedItems / Math.max(totalItems, 1)) * 100);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-6 md:p-8">
        <div>
          <Link
            href="/hub/fundhub"
            className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            ← FundHub
          </Link>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="mb-2 text-4xl font-bold text-gray-900">
                {ui(locale, 'Cumplimiento', 'Compliance', 'Compliance')}
              </h1>
              <p className="max-w-2xl text-lg text-gray-600">
                {ui(
                  locale,
                  'Gobernanza, auditoría, ESG y legal — lo que falta para ser elegible.',
                  'Governança, auditoria, ESG e legal — o que falta para ser elegível.',
                  'Governance, audit, ESG and legal — what is still needed for eligibility.',
                )}
              </p>
              {fundId && (
                <p className="mt-3 text-sm text-amber-600">
                  {ui(locale, 'Foco en el fondo seleccionado:', 'Foco no fundo selecionado:', 'Focus on selected fund:')}{' '}
                  {fundId}
                </p>
              )}
            </div>
            <div className="rounded-3xl bg-gray-50 px-6 py-4 text-center shadow-sm">
              <p className="text-sm uppercase tracking-[0.25em] text-gray-500">
                {ui(locale, 'Progreso general', 'Progresso geral', 'Overall progress')}
              </p>
              <p className="mt-3 text-5xl font-bold text-amber-600">{overallProgress}%</p>
              <p className="mt-1 text-sm text-gray-600">
                {completedItems} / {totalItems}{' '}
                {ui(locale, 'ítems concluidos', 'itens concluídos', 'items completed')}
              </p>
              {savedAt && (
                <p className="mt-2 text-xs text-gray-500">
                  {ui(locale, 'Último guardado', 'Último salvo em', 'Last saved')}{' '}
                  {new Date(savedAt).toLocaleString(dateLoc)}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-6">
            {checklists.map((checklist) => {
              const def = LIST_DEFS.find((d) => d.id === checklist.id)!;
              const progress = getProgress(checklist.items);
              const Icon = ICONS[checklist.id];

              return (
                <div key={checklist.id} className="rounded-2xl border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 p-8">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`rounded-lg p-3 ${checklist.color}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">
                            {ui(locale, def.title.es, def.title.pt, def.title.en)}
                          </h2>
                          <p className="mt-1 text-sm text-gray-600">
                            {checklist.items.filter((i) => i.completed).length}{' '}
                            {ui(locale, 'de', 'de', 'of')} {checklist.items.length}{' '}
                            {ui(locale, 'concluidos', 'concluídos', 'completed')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-amber-600">{progress}%</div>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-amber-600 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="divide-y divide-gray-200">
                    {checklist.items.map((item) => {
                      const itemDef = def.items.find((i) => i.id === item.id)!;
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItem(checklist.id, item.id)}
                          className="flex cursor-pointer items-center gap-4 p-6 transition hover:bg-gray-50"
                        >
                          {item.completed ? (
                            <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-emerald-600" />
                          ) : (
                            <Circle className="h-6 w-6 flex-shrink-0 text-gray-300" />
                          )}
                          <div className="flex-1">
                            <p
                              className={`font-medium ${
                                item.completed ? 'text-gray-600 line-through' : 'text-gray-900'
                              }`}
                            >
                              {ui(locale, itemDef.es, itemDef.pt, itemDef.en)}
                            </p>
                          </div>
                          {item.completed && (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                              {ui(locale, 'Hecho', 'Concluído', 'Done')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-600">
                    {ui(locale, 'Notas de cumplimiento', 'Notas de compliance', 'Compliance notes')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {ui(
                      locale,
                      'Registra observaciones sobre documentos y acciones.',
                      'Registre observações importantes sobre documentos e ações.',
                      'Log notes about documents and actions.',
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetChecklist}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  {ui(locale, 'Reiniciar', 'Reiniciar', 'Reset')}
                </button>
              </div>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={12}
                className="w-full rounded-3xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                placeholder={ui(
                  locale,
                  'Anota riesgos, documentos a actualizar o próximas acciones…',
                  'Anote riscos, documentos a atualizar ou próximas ações...',
                  'Note risks, documents to update, or next actions…',
                )}
              />
            </div>

            <div className="rounded-[2rem] border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600 shadow-sm">
              <p className="mb-3 font-semibold text-gray-900">
                {ui(locale, 'Control rápido', 'Controle rápido', 'Quick controls')}
              </p>
              <p className="mb-4">
                {ui(
                  locale,
                  'El progreso se guarda en el navegador para retomar cuando quieras.',
                  'O progresso de compliance é armazenado no navegador para que você possa retomar a qualquer momento.',
                  'Progress is stored in the browser so you can resume anytime.',
                )}
              </p>
              <div className="space-y-3">
                <div className="rounded-3xl bg-white p-4">
                  <p className="font-semibold text-gray-900">{ui(locale, 'Guardar', 'Salvar', 'Save')}</p>
                  <p className="text-sm text-gray-600">
                    {ui(
                      locale,
                      'El progreso se guarda automáticamente en cada cambio.',
                      'O progresso é salvo automaticamente a cada alteração.',
                      'Progress saves automatically on every change.',
                    )}
                  </p>
                </div>
                <div className="rounded-3xl bg-white p-4">
                  <p className="font-semibold text-gray-900">{ui(locale, 'Limpiar', 'Limpar', 'Clear')}</p>
                  <p className="text-sm text-gray-600">
                    {ui(
                      locale,
                      'Usa Reiniciar para empezar un checklist nuevo.',
                      'Use o botão Reiniciar para começar um checklist novo.',
                      'Use Reset to start a new checklist.',
                    )}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-8">
          <h2 className="mb-4 text-2xl font-bold text-gray-900">
            {ui(locale, '¿Necesitas ayuda?', 'Precisa de ajuda?', 'Need help?')}
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div>
              <p className="mb-2 font-semibold text-gray-900">
                {ui(locale, 'Documentos', 'Documentos', 'Documents')}
              </p>
              <p className="text-sm text-gray-600">
                {ui(
                  locale,
                  'Revisa qué documentos preparar para cada requisito.',
                  'Veja quais documentos você precisa preparar para cada requisito.',
                  'See which documents to prepare for each requirement.',
                )}
              </p>
            </div>
            <div>
              <p className="mb-2 font-semibold text-gray-900">
                {ui(locale, 'Consultoría', 'Consultoria', 'Advisory')}
              </p>
              <p className="text-sm text-gray-600">
                {ui(
                  locale,
                  'Conéctate con especialistas en cumplimiento para tu organización.',
                  'Conecte-se com especialistas em compliance para sua organização.',
                  'Connect with compliance specialists for your organization.',
                )}
              </p>
            </div>
            <div>
              <p className="mb-2 font-semibold text-gray-900">Templates</p>
              <p className="text-sm text-gray-600">
                {ui(
                  locale,
                  'Descarga plantillas para políticas y documentos.',
                  'Baixe templates padronizados para políticas e documentos.',
                  'Download standard templates for policies and documents.',
                )}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
