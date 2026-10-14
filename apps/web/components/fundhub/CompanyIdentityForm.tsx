'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, Loader2, Save } from 'lucide-react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import type { CompanyIdentityPayload } from '@/lib/fundhub/company-identity-types';

export function CompanyIdentityForm({ showSignals = true }: { showSignals?: boolean }) {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);
  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [identity, setIdentity] = useState<CompanyIdentityPayload | null>(null);
  const [description, setDescription] = useState('');
  const [mission, setMission] = useState('');
  const [vision, setVision] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const apply = (row: CompanyIdentityPayload) => {
    setIdentity(row);
    setDescription(row.company.description);
    setMission(row.company.mission);
    setVision(row.company.vision);
  };

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/fundhub/identity?companyId=${encodeURIComponent(companyId)}`);
      if (!r.ok) return;
      apply((await r.json()) as CompanyIdentityPayload);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!companyId) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/fundhub/identity?companyId=${encodeURIComponent(companyId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, mission, vision }),
      });
      if (!r.ok) throw new Error('save failed');
      apply((await r.json()) as CompanyIdentityPayload);
      setMsg(t('Guardado no registo da empresa.', 'Guardado en el registro de la empresa.', 'Saved on the company record.'));
    } catch {
      setMsg(t('Erro ao guardar.', 'Error al guardar.', 'Save error.'));
    } finally {
      setSaving(false);
    }
  };

  if (!companyId) return null;
  if (loading || !identity) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        …
      </div>
    );
  }

  const atlasBits = [
    identity.atlas.activity,
    identity.atlas.sector && identity.atlas.sector !== identity.atlas.activity ? identity.atlas.sector : '',
    identity.atlas.country,
    identity.atlas.entityType,
  ].filter(Boolean);

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Building2 className="h-4 w-4 text-amber-700" />
            {identity.company.name}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {t(
              'Quem somos, missão e visão vivem no registo da empresa. Aqui é o mesmo texto — a análise do FundHub lê isto.',
              'Quiénes somos, misión y visión viven en el registro de la empresa. Aquí es el mismo texto — el análisis de FundHub lo lee.',
              'Who we are, mission, and vision live on the company record. This is the same text — FundHub analysis reads it.',
            )}
          </p>
        </div>
        <Link href="/hub/admin?s=org-profile" className="text-xs font-medium text-amber-700 hover:underline">
          {t('Administração Etholys', 'Administración Etholys', 'Etholys administration')}
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">
            {t('Quem é a empresa', 'Quién es la empresa', 'Who the company is')}
          </span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
            placeholder={t(
              'O que fazem, para quem, e onde.',
              'Qué hacen, para quién y dónde.',
              'What you do, for whom, and where.',
            )}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">{t('Missão', 'Misión', 'Mission')}</span>
            <textarea
              rows={3}
              value={mission}
              onChange={(e) => setMission(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">{t('Visão', 'Visión', 'Vision')}</span>
            <textarea
              rows={3}
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t('Guardar perfil', 'Guardar perfil', 'Save profile')}
        </button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>

      {showSignals && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-800">
            {t(
              'O que o SIEP e o ATLAS já sabem',
              'Lo que SIEP y ATLAS ya saben',
              'What SIEP and ATLAS already know',
            )}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {t(
              'Não é preciso voltar a escrever a lista de projectos. A análise usa este resumo.',
              'No hace falta reescribir la lista de proyectos. El análisis usa este resumen.',
              'You do not retype the project list. Analysis uses this summary.',
            )}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">SIEP</p>
                <Link href="/siep" className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline">
                  {t('Abrir', 'Abrir', 'Open')}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {identity.siep.projects.length === 0 ? (
                <p className="mt-2 text-sm text-gray-600">
                  {t(
                    'Nenhum projeto activo.',
                    'Ningún proyecto activo.',
                    'No active projects.',
                  )}
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {identity.siep.projects.map((p) => (
                    <li key={p.id}>
                      <Link href={`/siep/projects/${p.id}`} className="text-sm text-gray-800 hover:underline">
                        {p.name}
                        {p.country ? <span className="text-gray-500"> · {p.country}</span> : null}
                      </Link>
                    </li>
                  ))}
                  {identity.siep.activeCount > identity.siep.projects.length && (
                    <li className="text-xs text-gray-500">
                      {t(
                        `+${identity.siep.activeCount - identity.siep.projects.length} no portefólio`,
                        `+${identity.siep.activeCount - identity.siep.projects.length} en el portafolio`,
                        `+${identity.siep.activeCount - identity.siep.projects.length} in the portfolio`,
                      )}
                    </li>
                  )}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">ATLAS</p>
                <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline">
                  {t('Abrir', 'Abrir', 'Open')}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {atlasBits.length === 0 ? (
                <p className="mt-2 text-sm text-gray-600">
                  {t(
                    'Ainda sem actividade, sector ou país no registo.',
                    'Aún sin actividad, sector o país en el registro.',
                    'No activity, sector, or country on the record yet.',
                  )}
                </p>
              ) : (
                <p className="mt-2 text-sm text-gray-800">{atlasBits.join(' · ')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
