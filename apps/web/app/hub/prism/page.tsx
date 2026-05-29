'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Target, ArrowLeft, BarChart3, FileText, ExternalLink, Plus } from 'lucide-react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { StateEmpty, StateError, StateLoading } from '@/components/ui/StateBlocks';

type PrismItem = { id: string; indicator: string; link: string; projectLabel?: string; at: string };

export default function PrismHubPage() {
  const { locale, activeCompanyId } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const companyId = activeCompanyId && isLikelyDbId(activeCompanyId) ? activeCompanyId : '';

  const [items, setItems] = useState<PrismItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [indicator, setIndicator] = useState('');
  const [link, setLink] = useState('');
  const [projectLabel, setProjectLabel] = useState('');

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/company-memory/prism-ledger?companyId=${encodeURIComponent(companyId)}`);
      const d = (await r.json()) as { error?: string; items?: PrismItem[] };
      if (!r.ok) throw new Error(d.error || 'Erro');
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!companyId) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch('/api/company-memory/prism-ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, indicator, link, projectLabel: projectLabel || undefined }),
      });
      const d = (await r.json()) as { error?: string; items?: PrismItem[] };
      if (!r.ok) throw new Error(d.error || 'Erro');
      if (d.items) setItems(d.items);
      setIndicator('');
      setLink('');
      setProjectLabel('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/80 to-slate-50">
      <header className="border-b border-rose-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/hub"
            className="inline-flex items-center gap-2 text-sm font-medium text-rose-900 hover:text-rose-700"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Voltar ao Hub', 'Volver al Hub', 'Back to Hub')}
          </Link>
          <div className="flex items-center gap-2 text-rose-700">
            <Target className="h-6 w-6" />
            <span className="font-bold tracking-tight">PRISM</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">
            {t('Impacto, evidência e relatórios', 'Impacto, evidencia e informes', 'Impact, evidence & reporting')}
          </h1>
          <div
            className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
            role="note"
          >
            <p className="font-semibold">
              {t('Isto não é o “dashboard” do dia a dia', 'Esto no es el “dashboard” del día a día', 'This is not your day-to-day “dashboard”')}
            </p>
            <p className="mt-1 text-amber-950/90">
              {t(
                'O Centro integrado (Workspace) concentra o que fazer hoje, filas, prazos e alertas. O PRISM responde a: «que diferença fizemos?» e «o que mostramos ao financiador?» — M&E, evidência, relatórios a funders, narrativa de impacto.',
                'El Workspace concentra el qué hacer hoy. PRISM responde: “¿qué impacto tuvimos?” e informes a financiadores — M&E, evidencia, narrativa hacia el donante.',
                'The integrated workspace is for what to do today, queues, and deadlines. PRISM is for “what impact did we have?” and donor-facing story — M&E, evidence, funder reports — not a generic BI layer competing with the cockpit.'
              )}
            </p>
          </div>
          <p className="mt-4 text-slate-600">
            {t(
              'PRISM é a lente de monitorização e avaliação: indicadores, relatórios a financiadores e leitura consolidada dos dados do tenant. O «cockpit» do dia a dia (tarefas e alertas) está no Centro integrado — aqui o foco é accountability e M&E.',
              'PRISM es la lente de monitoreo y evaluación: indicadores, informes a financiadores y lectura consolidada. El cockpit diario está en el Centro integrado.',
              'PRISM is the monitoring & evaluation lens: indicators, donor-facing reports, and consolidated reads. Your daily cockpit (tasks & alerts) lives in the integrated workspace — here the focus is accountability and M&E.'
            )}
          </p>

          <ul className="mt-8 space-y-3">
            <li>
              <Link
                href="/reports"
                className="flex items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-sm font-medium text-rose-950 transition hover:bg-rose-100/80"
              >
                <span className="inline-flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 shrink-0" />
                  {t('Relatórios executivos & exportação (PDF)', 'Informes ejecutivos y exportación (PDF)', 'Executive reports & PDF export')}
                </span>
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </Link>
            </li>
            <li>
              <Link
                href="/siep/reports"
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
              >
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
                  {t('Relatórios por projecto (SIEP)', 'Informes por proyecto (SIEP)', 'Project reports (SIEP)')}
                </span>
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </Link>
            </li>
          </ul>

          <p className="mt-8 text-xs text-slate-500">
            {t(
              'Indicadores ME e linha de base ligados a resultados serão reforçados em evoluções futuras; os dados já fluem a partir de ATLAS e SIEP.',
              'Los indicadores ME y línea base conectados a resultados se reforzarán en evoluciones futuras.',
              'ME indicators and baselines tied to outcomes will be strengthened in future iterations; data already flows from ATLAS and SIEP.'
            )}
          </p>

          <div className="mt-10 border-t border-rose-100 pt-8">
            <h2 className="text-lg font-semibold text-slate-900">
              {t('Cadeia mínima: indicador → evidência', 'Cadena mínima: indicador → evidencia', 'Minimal chain: indicator → evidence')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t(
                'Ligue um indicador a um link ou documento (URL), com etiqueta de projecto/resultado se fizer sentido. Isto fica no contexto do tenant.',
                'Vincule un indicador a una URL, con etiqueta de proyecto/resultado si aplica.',
                'Tie an indicator to a link (URL) with an optional project/result label — stored in tenant context.'
              )}
            </p>

            {!companyId && (
              <p className="mt-4 text-sm text-amber-800">
                {t(
                  'Selecione uma organização no Hub (menu com ícone de edifício) para guardar.',
                  'Elija una organización en el Hub para guardar.',
                  'Select an organization in the Hub to save entries.'
                )}
              </p>
            )}

            {loading && <StateLoading className="py-6" />}
            {err && <StateError className="mt-4" message={err} onRetry={load} retryLabel={t('Tentar de novo', 'Reintentar', 'Retry')} />}

            {companyId && !loading && !err && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-500">{t('Indicador', 'Indicador', 'Indicator')}</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={indicator}
                      onChange={(e) => setIndicator(e.target.value)}
                      placeholder={t('ex.: Empregos indirectos (FTE)', 'ej.: empleo indirecto (FTE)', 'e.g. indirect jobs (FTE)')}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-500">{t('Evidência (URL https)', 'Evidencia (URL https)', 'Evidence (https URL)')}</label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-500">
                      {t('Projecto ou resultado (facultativo)', 'Proyecto o resultado (opcional)', 'Project or outcome (optional)')}
                    </label>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={projectLabel}
                      onChange={(e) => setProjectLabel(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void add()}
                  disabled={saving || !indicator.trim() || !link.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {saving ? '…' : t('Registar ligação', 'Registrar enlace', 'Save link')}
                </button>

                {items.length === 0 ? (
                  <StateEmpty
                    title={t('Ainda sem evidências', 'Aún sin evidencias', 'No evidence yet')}
                    description={t(
                      'Adicione o primeiro par indicador-URL.',
                      'Añada el primer par arriba.',
                      'Add your first indicator–link pair above.'
                    )}
                  />
                ) : (
                  <ul className="space-y-2">
                    {items.map((it) => (
                      <li
                        key={it.id}
                        className="flex flex-col gap-1 rounded-xl border border-rose-100 bg-rose-50/30 px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between"
                      >
                        <div>
                          <p className="font-medium text-slate-900">{it.indicator}</p>
                          {it.projectLabel && <p className="text-slate-600">{it.projectLabel}</p>}
                          <a
                            href={it.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-rose-800 underline"
                          >
                            {it.link} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          </a>
                        </div>
                        <span className="shrink-0 text-xs text-slate-500">{new Date(it.at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
