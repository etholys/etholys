'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { StateEmpty, StateLoading } from '@/components/ui/StateBlocks';
import { ArrowLeft, Plus, Trash2, Users } from 'lucide-react';

type CoalitionMember = {
  id: string;
  orgName: string;
  country?: string;
  role: string;
  contactEmail?: string;
};

export default function FundHubCoalitionPage() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [members, setMembers] = useState<CoalitionMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ orgName: '', country: '', role: '', contactEmail: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/fundhub/coalition?companyId=${encodeURIComponent(companyId)}`);
      const d = (await r.json()) as { members?: CoalitionMember[] };
      setMembers(Array.isArray(d.members) ? d.members : []);
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
    setMsg(null);
    const r = await fetch('/api/fundhub/coalition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, ...form }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) {
      setMsg(d.error || 'Erro');
      return;
    }
    setMembers(d.members || []);
    setForm({ orgName: '', country: '', role: '', contactEmail: '' });
    setMsg(t('Membro adicionado.', 'Miembro añadido.', 'Member added.'));
  };

  const remove = async (memberId: string) => {
    if (!companyId) return;
    const r = await fetch(
      `/api/fundhub/coalition?companyId=${encodeURIComponent(companyId)}&memberId=${encodeURIComponent(memberId)}`,
      { method: 'DELETE' },
    );
    const d = await r.json();
    if (r.ok) setMembers(d.members || []);
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
      <div>
        <Link href="/hub/fundhub" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          FundHub
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Users className="h-7 w-7 text-emerald-600" />
          {t('Coalizão de candidatura', 'Coalición de candidatura', 'Application coalition')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          {t(
            'Organizações que entram na mesma proposta (consórcio). Aparece no perfil institucional e nas notas de proposta — sem duplicar dados do SIEP.',
            'Organizaciones que entran en la misma propuesta (consorcio). Aparece en el perfil institucional y en las notas — sin duplicar SIEP.',
            'Orgs on the same application (consortium). Shows on the institutional profile and proposal notes — without duplicating SIEP.',
          )}
        </p>
      </div>

      <form onSubmit={add} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">{t('Adicionar membro', 'Añadir miembro', 'Add member')}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder={t('Nome da organização', 'Nombre de la organización', 'Organization name')}
            value={form.orgName}
            onChange={(e) => setForm({ ...form, orgName: e.target.value })}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            placeholder={t('País', 'País', 'Country')}
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            required
            placeholder={t('Papel na coalizão', 'Rol en la coalición', 'Role in coalition')}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded-lg border px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            type="email"
            placeholder="Email (opcional)"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            className="rounded-lg border px-3 py-2 text-sm sm:col-span-2"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {t('Adicionar', 'Añadir', 'Add')}
        </button>
        {msg && <p className="mt-2 text-sm text-emerald-700">{msg}</p>}
      </form>

      {loading ? (
        <StateLoading />
      ) : members.length === 0 ? (
        <p className="text-sm text-gray-600">
          {t('Ainda sem membros na coalizão.', 'Aún sin miembros en la coalición.', 'No coalition members yet.')}
        </p>
      ) : (
        <ul className="space-y-3">
          {members.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div>
                <p className="font-semibold text-gray-900">{m.orgName}</p>
                <p className="text-sm text-gray-600">
                  {m.country && `${m.country} · `}
                  {m.role}
                </p>
                {m.contactEmail && <p className="text-xs text-gray-500">{m.contactEmail}</p>}
              </div>
              <button
                type="button"
                onClick={() => void remove(m.id)}
                className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                title={t('Remover', 'Eliminar', 'Remove')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
