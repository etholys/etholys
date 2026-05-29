'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Building2, Globe, Truck, ClipboardCheck, Sparkles } from 'lucide-react';
import { useApp } from '@/app/providers';
import { useSession } from 'next-auth/react';
import {
  COMPANY_SECTORS,
  emptyContextSetup,
  deriveModuleHints,
  MODULE_HINT_LABEL,
  type CompanyContextSetup,
  type ModuleHintCode,
} from '@/lib/company-context-setup';
import { isLikelyDbId } from '@/lib/utils';
import { StateEmpty, StateError, StateLoading } from '@/components/ui/StateBlocks';

const GOAL_IDS = [
  { id: 'operations', es: 'Operación diaria', pt: 'Operação do dia a dia', en: 'Day-to-day operations' },
  { id: 'fundraising', es: 'Captación de fondos', pt: 'Captação de fundos', en: 'Fundraising' },
  { id: 'export', es: 'Comercio exterior', pt: 'Comércio externo', en: 'International trade' },
  { id: 'impact_reporting', es: 'Informes e impacto', pt: 'Relatórios e impacto', en: 'Reporting & impact' },
  { id: 'governance', es: 'Gobernanza y cumplimiento', pt: 'Governança e compliance', en: 'Governance & compliance' },
] as const;

export default function CompanyContextSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 px-4">
          <StateLoading className="h-full" />
        </div>
      }
    >
      <CompanyContextSetupInner />
    </Suspense>
  );
}

function CompanyContextSetupInner() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const search = useSearchParams();
  const { locale, activeCompanyId } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);

  const isFirst = search.get('first') === '1';
  const [step, setStep] = useState(0);
  const [ctx, setCtx] = useState<CompanyContextSetup>(() => emptyContextSetup());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [legalAck, setLegalAck] = useState(false);

  const companyId = activeCompanyId && isLikelyDbId(activeCompanyId) ? activeCompanyId : '';

  const L = (row: (typeof COMPANY_SECTORS)[number]['label']) => row[locale === 'en' ? 'en' : locale === 'pt' ? 'pt' : 'es'];

  const load = useCallback(async () => {
    if (!companyId) return;
    const r = await fetch(`/api/companies/setup?companyId=${encodeURIComponent(companyId)}`);
    if (!r.ok) return;
    const d = (await r.json()) as { company?: { name?: string; contextSetupJson?: unknown } };
    if (d.company?.name) setCompanyName(d.company.name);
    if (d.company?.contextSetupJson && typeof d.company.contextSetupJson === 'object' && d.company.contextSetupJson !== null) {
      setCtx((prev) => ({ ...prev, ...(d.company!.contextSetupJson as object) } as CompanyContextSetup));
    }
  }, [companyId]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/login');
  }, [authStatus, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (ctx.legalDisclaimerAcceptedAt) setLegalAck(true);
  }, [ctx.legalDisclaimerAcceptedAt]);

  const hintLabel = (code: ModuleHintCode) => {
    const L = MODULE_HINT_LABEL[code];
    return locale === 'pt' ? L.pt : locale === 'es' ? L.es : L.en;
  };
  const moduleHints = deriveModuleHints(ctx);

  const toggleGoal = (id: string) => {
    setCtx((c) => {
      const s = new Set(c.primaryGoals || []);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return { ...c, primaryGoals: [...s] };
    });
  };

  const save = async (opts?: { done?: boolean }) => {
    if (!companyId) {
      setErr(t('Selecione uma empresa no seletor do Hub.', 'Seleccione una empresa en el Hub.', 'Pick a company in the Hub header.'));
      return;
    }
    if (opts?.done && !ctx.legalDisclaimerAcceptedAt && !legalAck) {
      setErr(
        t(
          'Marque a confirmação do aviso (não é aconselhamento legal) para concluir.',
          'Marque la confirmación del aviso (no es asesoría legal) para finalizar.',
          'Confirm the non-advice disclaimer to finish the setup.'
        )
      );
      return;
    }
    let payload: CompanyContextSetup = { ...ctx, v: 1 };
    if (opts?.done && legalAck && !ctx.legalDisclaimerAcceptedAt) {
      payload = { ...payload, legalDisclaimerAcceptedAt: new Date().toISOString() };
    }
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch('/api/companies/setup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, context: payload }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error || 'Erro');
      }
      if (opts?.done) {
        router.push(isFirst ? '/dashboard' : '/hub');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('Falha ao guardar', 'Error al guardar', 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  if (authStatus === 'loading' || authStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-slate-50 px-4">
        <StateLoading className="h-full" />
      </div>
    );
  }

  if (!session?.user) return null;

  if (!companyId) {
    return (
      <div className="mx-auto min-h-screen max-w-lg p-6">
        <StateEmpty
          title={t('Sem empresa ativa', 'Sin empresa activa', 'No active company')}
          description={t(
            'Abra o Hub e escolha a organização no menu com o ícone de edifício.',
            'Abra el Hub y elija la organización en el menú con icono de edificio.',
            'Open the Hub and choose your organization in the building icon menu.'
          )}
          action={
            <Link href="/hub" className="text-sm font-medium text-teal-700 hover:underline">
              ← Hub
            </Link>
          }
        />
      </div>
    );
  }

  const totalSteps = 4;

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/50 to-slate-50">
      <header className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <Link href="/hub" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Hub
          </Link>
          <div className="text-xs text-slate-500">
            {t('Assistente de contexto', 'Asistente de contexto', 'Context setup')} · {step + 1}/{totalSteps}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {isFirst && step === 0 && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {t(
              'Bem-vindo. Estas respostas ajudam a adaptar prioridades e sugestões do Advisor — não substituem aconselhamento legal ou contabilístico.',
              'Bienvenido. Estas respuestas adaptan sugerencias y prioridades del Advisor.',
              'Welcome. These answers help tailor Advisor priorities— they do not replace legal or tax advice.'
            )}
          </p>
        )}

        {err && (
          <StateError
            className="mb-4"
            message={err}
          />
        )}

        {step === 0 && (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Building2 className="h-5 w-5 text-teal-600" />
              {t('Organização', 'Organización', 'Organization')}
            </h1>
            {companyName && <p className="text-sm text-slate-600">{companyName}</p>}
            <p className="text-sm text-slate-600">
              {t('Tipo e sector principal (pode ajustar mais tarde).', 'Tipo y sector principal (puede ajustar luego).', 'Kind and main sector (you can change later).')}
            </p>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">{t('Sector', 'Sector', 'Sector')}</label>
              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {COMPANY_SECTORS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCtx((c) => ({ ...c, sectorId: s.id }))}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${
                      ctx.sectorId === s.id ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    {L(s.label)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">{t('Forma legal / natureza', 'Forma legal / naturaleza', 'Legal form / nature')}</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={ctx.entityKind || ''}
                onChange={(e) => setCtx((c) => ({ ...c, entityKind: (e.target.value || undefined) as CompanyContextSetup['entityKind'] }))}
              >
                <option value="">{t('— selecionar —', '— elegir —', '— select —')}</option>
                <option value="company">{t('Empresa (sociedad)', 'Empresa (sociedad)', 'Company')}</option>
                <option value="cooperative">{t('Cooperativa', 'Cooperativa', 'Cooperative')}</option>
                <option value="ngo">{t('ONG / fundación', 'ONG / fundación', 'NGO / foundation')}</option>
                <option value="association">{t('Asociación', 'Asociación', 'Association')}</option>
                <option value="public">{t('Público o mixto', 'Público o mixto', 'Public or mixed')}</option>
                <option value="other">{t('Otro', 'Otro', 'Other')}</option>
              </select>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Globe className="h-5 w-5 text-teal-600" />
              {t('Sede e moeda', 'Sede y moneda', 'Base & currency')}
            </h1>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">{t('País / sede principal', 'País / sede', 'Primary country')}</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="e.g. Brasil, Chile, Portugal"
                value={ctx.countryPrimary || ''}
                onChange={(e) => setCtx((c) => ({ ...c, countryPrimary: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">{t('Moeda operacional', 'Moneda operacional', 'Operating currency')}</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="USD, EUR, BRL, CLP…"
                value={ctx.currencyOp || ''}
                onChange={(e) => setCtx((c) => ({ ...c, currencyOp: e.target.value }))}
              />
              <p className="mt-1 text-xs text-slate-500">
                {t('Deve alinhar com a moeda da empresa em Configuração, se possível.', 'Debería alinearse con la moneda de la empresa en ajustes.', 'Should match company currency in Settings when possible.')}
              </p>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Truck className="h-5 w-5 text-teal-600" />
              {t('Comércio internacional', 'Comercio internacional', 'International trade')}
            </h1>
            {[
              { key: 'tradesInternationally' as const, es: 'Operamos al menos importação ou exportação', pt: 'Operamos comércio internacional (import e/ou export)', en: 'We trade across borders' },
              { key: 'imports' as const, es: 'Importamos bens insumos ou produtos', pt: 'Importamos', en: 'We import' },
              { key: 'exports' as const, es: 'Exportamos', pt: 'Exportamos', en: 'We export' },
            ].map((row) => (
              <label key={row.key} className="flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={ctx[row.key] === true}
                  onChange={(e) => setCtx((c) => ({ ...c, [row.key]: e.target.checked }))}
                />
                {t(row.pt, row.es, row.en)}
              </label>
            ))}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ClipboardCheck className="h-5 w-5 text-teal-600" />
              {t('Prioridades e notas', 'Prioridades y notas', 'Priorities & notes')}
            </h1>
            <p className="text-sm text-slate-600">
              {t('Marque o que o Etholys deve priorizar nas sugestões (Advisor, resumos).', 'Marque en qué el Advisor debe centrarse.', 'Check what the Advisor should emphasise.')}
            </p>
            <div className="flex flex-col gap-2">
              {GOAL_IDS.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={(ctx.primaryGoals || []).includes(g.id)}
                    onChange={() => toggleGoal(g.id)}
                  />
                  {t(g.pt, g.es, g.en)}
                </label>
              ))}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">
                {t('Notas para o Advisor (facultativo)', 'Notas para el Advisor (opcional)', 'Notes for Advisor (optional)')}
              </label>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={3}
                placeholder={t('ex.: reforço de export CL → UE; foco em linhas de apoio público', 'e.g. …', 'e.g. focus areas…')}
                value={ctx.notesForAdvisor || ''}
                onChange={(e) => setCtx((c) => ({ ...c, notesForAdvisor: e.target.value }))}
              />
            </div>

            {moduleHints.length > 0 && (
              <div className="rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-3 text-sm text-slate-800">
                <p className="text-xs font-semibold uppercase text-teal-800">
                  {t('Módulos sugeridos (por prioridades)', 'Módulos sugeridos (prioridades)', 'Suggested modules (from goals)')}
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-slate-700">
                  {moduleHints.map((code) => (
                    <li key={code}>{hintLabel(code)}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  {t(
                    'Isto guia a narrativa; o acesso a cada área continua a depender de permissões da organização.',
                    'Esto guía la narrativa; el acceso sigue según permisos.',
                    'This guides the narrative; access to each area still depends on your org’s permissions.'
                  )}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-3 text-sm text-amber-950">
              <p>
                {t(
                  'As respostas do assistente não substituem aconselhamento legal, fiscal ou de compliance. Confirme com o profissional competente da sua organização.',
                  'Estas respuestas no reemplazan asesoría legal, fiscal o de compliance.',
                  'These answers are not legal, tax, or compliance advice. Confirm with a qualified professional.'
                )}
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-amber-400"
                  checked={legalAck}
                  onChange={(e) => setLegalAck(e.target.checked)}
                />
                <span>
                  {t(
                    'Compreendo e confirmo a limitação acima. Posso reabrir o assistente quando o contexto da empresa mudar (ex.: passar a exportar).',
                    'Entiendo y confirmo. Puedo volver al asistente si cambia el contexto (p. ej. exportar).',
                    'I understand and confirm. I can revisit this if our context changes (e.g. we start exporting).'
                  )}
                </span>
              </label>
            </div>
          </section>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Anterior', 'Anterior', 'Back')}
          </button>
          <div className="flex flex-wrap gap-2">
            {step < totalSteps - 1 ? (
              <button
                type="button"
                onClick={() => {
                  void save();
                  setStep((s) => s + 1);
                }}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                {t('Guardar e continuar', 'Guardar y continuar', 'Save & continue')}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void save({ done: true })}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                {saving ? '…' : <Check className="h-4 w-4" />}
                {t('Concluir', 'Concluir', 'Finish')}
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 flex items-center gap-1 text-center text-xs text-slate-500">
          <Sparkles className="h-3.5 w-3.5" />
          {t(
            'A seguir, use o botão roxo (Advisor) para síntese e alertas multi-sistema; o chat flutuante à direita é para diálogo e canais de trabalho.',
            'Luego, use el botón morado (Advisor) para alertas; el chat a la derecha es para diálogo.',
            'Next: use the purple Advisor button for cross-system digest; the right-side chat is for work dialogue.'
          )}
        </p>
      </main>
    </div>
  );
}
