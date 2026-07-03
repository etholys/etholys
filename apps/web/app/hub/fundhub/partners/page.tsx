'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { StateEmpty, StateLoading } from '@/components/ui/StateBlocks';
import { ArrowLeft, Globe, Handshake, MapPin, Plus } from 'lucide-react';

type Partner = {
  id: string;
  name: string;
  country: string | null;
  role: string | null;
  website: string | null;
  notes: string | null;
};

export default function FundHubPartnersPage() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', country: '', role: '', website: '' });

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/fundhub/partners?companyId=${encodeURIComponent(companyId)}`);
      const d = (await r.json()) as { partners?: Partner[] };
      setPartners(Array.isArray(d.partners) ? d.partners : []);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    const r = await fetch('/api/fundhub/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, ...form }),
    });
    setSaving(false);
    if (r.ok) {
      setForm({ name: '', country: '', role: '', website: '' });
      setShowForm(false);
      void load();
    }
  };

  if (!companyId) {
    return (
      <StateEmpty
        title={t('Empresa não seleccionada', 'Empresa no seleccionada', 'No company selected')}
        description={t('Escolha a empresa na barra lateral.', 'Elija la empresa en la barra lateral.', 'Pick company in sidebar.')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/hub/fundhub" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            FundHub
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">
            {t('Parceiros locais e jurídicos', 'Socios locales y jurídicos', 'Local & legal partners')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {t(
              'Rede persistida por empresa — alimenta o perfil institucional.',
              'Red persistida por empresa — alimenta el perfil institucional.',
              'Per-company network — feeds the institutional profile.',
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          {t('Novo parceiro', 'Nuevo socio', 'New partner')}
        </button>
      </div>

      {showForm && (
        <form onSubmit={add} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              placeholder={t('Nome', 'Nombre', 'Name')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              placeholder={t('País', 'País', 'Country')}
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              placeholder={t('Papel', 'Rol', 'Role')}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="rounded-lg border px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              placeholder="Website"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="rounded-lg border px-3 py-2 text-sm sm:col-span-2"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {t('Guardar', 'Guardar', 'Save')}
          </button>
        </form>
      )}

      {loading ? (
        <StateLoading />
      ) : partners.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
          {t('Ainda sem parceiros registados.', 'Aún sin socios registrados.', 'No partners registered yet.')}
        </p>
      ) : (
        <div className="space-y-4">
          {partners.map((partner) => (
            <div key={partner.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {partner.country && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{partner.country}</p>
                  )}
                  <h3 className="mt-1 text-xl font-semibold text-gray-900">{partner.name}</h3>
                  {partner.role && <p className="mt-1 text-sm text-gray-600">{partner.role}</p>}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                  <Handshake className="h-4 w-4" />
                  {partner.website ? (
                    <a href={partner.website} target="_blank" rel="noreferrer" className="hover:underline">
                      <Globe className="inline h-4 w-4" />
                    </a>
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
