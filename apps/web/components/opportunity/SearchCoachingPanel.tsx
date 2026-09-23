'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { ScanProgressRing } from '@/components/opportunity/ScanProgressRing';
import {
  Pencil,
  Plus,
  Radar,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { OpportunityClassification, ScanFocus } from '@/lib/opportunity/scan-types';

type Briefing = {
  themes: string[];
  countries: string[];
  kinds: string[];
  notes?: string;
  searchFeedback?: string;
  scanName?: string;
  classifications?: OpportunityClassification[];
  amountMax?: number;
  privateEligible?: boolean;
  reimbursable?: boolean;
};

type Profile = {
  id: string;
  name: string;
  briefing: Briefing;
  classifications: OpportunityClassification[];
};

const CLASS_OPTS: { id: OpportunityClassification; pt: string; es: string; en: string }[] = [
  { id: 'direct', pt: 'Directo (nós)', es: 'Directo (nosotros)', en: 'Direct (us)' },
  { id: 'client_bridge', pt: 'Ponte clientes', es: 'Puente clientes', en: 'Client bridge' },
  { id: 'joint', pt: 'Conjunto', es: 'Conjunto', en: 'Joint' },
];

export function SearchCoachingPanel({
  briefing,
  scanning,
  scanPercent = 0,
  scanUi = 'idle',
  onRetryScan,
  onSaved,
  onRunShortcut,
}: {
  briefing: Briefing;
  scanning?: boolean;
  scanPercent?: number;
  scanUi?: 'idle' | 'running' | 'error' | 'done';
  onRetryScan?: () => void;
  onSaved?: (next: Briefing) => void;
  /** Activa o atalho e dispara a varredura. */
  onRunShortcut?: (briefing: Briefing, focus: ScanFocus) => void;
}) {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scanName, setScanName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [classifications, setClassifications] = useState<OpportunityClassification[]>(['direct']);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const q = (path: string) =>
    `${path}${path.includes('?') ? '&' : '?'}companyId=${encodeURIComponent(companyId)}`;

  const loadProfiles = useCallback(async () => {
    if (!companyId) return;
    const r = await fetch(q('/api/opportunity/profiles'), { cache: 'no-store' });
    if (!r.ok) return;
    const d = (await r.json()) as { profiles?: Profile[]; activeProfileId?: string | null };
    setProfiles(d.profiles ?? []);
    setActiveId(d.activeProfileId ?? null);
  }, [companyId]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const openCreate = () => {
    setEditingId(null);
    setScanName(briefing.scanName ?? '');
    setFeedback(briefing.searchFeedback ?? '');
    setClassifications(briefing.classifications?.length ? briefing.classifications : ['direct']);
    setMsg(null);
    setEditorOpen(true);
  };

  const openEdit = (p: Profile) => {
    setEditingId(p.id);
    setScanName(p.name);
    setFeedback(p.briefing.searchFeedback ?? '');
    setClassifications(p.classifications?.length ? p.classifications : ['direct']);
    setMsg(null);
    setEditorOpen(true);
  };

  const save = async () => {
    if (!companyId || !feedback.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const name = scanName.trim() || t('Varredura sem nome', 'Barrido sin nombre', 'Untitled scan');
      const r = await fetch(q('/api/opportunity/profiles'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId ?? undefined,
          name,
          orientationText: feedback.trim(),
          classifications,
          briefing: {
            ...briefing,
            scanName: name,
            classifications,
            searchFeedback: feedback.trim(),
          },
        }),
      });
      const text = await r.text();
      let d: { error?: string; briefing?: Briefing; profile?: Profile } = {};
      try {
        d = JSON.parse(text) as typeof d;
      } catch {
        throw new Error(t('Resposta inválida do servidor.', 'Respuesta inválida.', 'Invalid server response.'));
      }
      if (!r.ok) throw new Error(d.error || 'Erro');
      if (d.briefing) onSaved?.(d.briefing);
      if (d.profile) setActiveId(d.profile.id);
      await loadProfiles();
      setEditorOpen(false);
      setMsg(
        t(
          `Atalho «${name}» pronto — clique em Buscar no cartão.`,
          `Atajo «${name}» listo — pulse Buscar en la tarjeta.`,
          `Shortcut «${name}» ready — click Search on the card.`,
        ),
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const runShortcut = async (p: Profile, focus: ScanFocus = 'open_now') => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(q('/api/opportunity/profiles'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: p.id }),
      });
      const d = (await r.json()) as { briefing?: Briefing; error?: string };
      if (!r.ok) throw new Error(d.error || 'Erro');
      const next = d.briefing ?? { ...p.briefing, scanName: p.name, classifications: p.classifications };
      onSaved?.(next);
      setActiveId(p.id);
      onRunShortcut?.(next, focus);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Profile) => {
    if (!confirm(t(`Apagar atalho «${p.name}»?`, `¿Borrar atajo «${p.name}»?`, `Delete shortcut «${p.name}»?`))) {
      return;
    }
    setBusy(true);
    try {
      await fetch(`${q('/api/opportunity/profiles')}&profileId=${encodeURIComponent(p.id)}`, {
        method: 'DELETE',
      });
      if (editingId === p.id) setEditorOpen(false);
      await loadProfiles();
      setMsg(t('Atalho apagado.', 'Atajo borrado.', 'Shortcut deleted.'));
    } finally {
      setBusy(false);
    }
  };

  if (!companyId) return null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-gray-900">
            {t('Atalhos de busca', 'Atajos de búsqueda', 'Search shortcuts')}
          </h3>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-gray-800"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('Novo', 'Nuevo', 'New')}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-600">
        {t(
          'Um atalho = um tipo de busca. Clique em Buscar.',
          'Un atajo = un tipo de búsqueda. Pulse Buscar.',
          'One shortcut = one search type. Click Search.',
        )}
      </p>

      {msg && <p className="mt-2 text-xs text-gray-700">{msg}</p>}

      {profiles.length === 0 && !editorOpen && (
        <button
          type="button"
          onClick={openCreate}
          className="mt-3 w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-center text-xs text-gray-700 hover:bg-white"
        >
          {t(
            'Criar o primeiro atalho — ex. «Rura Commerce interno FP»',
            'Crear el primer atajo — ej. «Rura Commerce interno FP»',
            'Create your first shortcut — e.g. «Rura Commerce interno FP»',
          )}
        </button>
      )}

      <ul className="mt-3 space-y-2">
        {profiles.map((p) => {
          const isActive = activeId === p.id || briefing.scanName === p.name;
          return (
            <li
              key={p.id}
              className={`rounded-xl border bg-white p-3 ${
                isActive ? 'border-gray-900 ring-1 ring-gray-200' : 'border-gray-200'
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">{p.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-500">
                {p.briefing.searchFeedback ||
                  p.briefing.themes?.join(', ') ||
                  t('Sem orientação', 'Sin orientación', 'No guidance')}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(p.classifications ?? []).map((c) => {
                  const opt = CLASS_OPTS.find((o) => o.id === c);
                  return (
                    <span
                      key={c}
                      className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-700"
                    >
                      {opt ? (locale === 'pt' ? opt.pt : locale === 'es' ? opt.es : opt.en) : c}
                    </span>
                  );
                })}
                {p.briefing.amountMax != null && (
                  <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-900">
                    ≤ {p.briefing.amountMax.toLocaleString()} USD
                  </span>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={busy || scanning}
                  onClick={() => void runShortcut(p, 'open_now')}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-gray-900 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {scanning ? (
                    <ScanProgressRing
                      percent={scanPercent}
                      state={scanUi === 'done' ? 'done' : 'running'}
                      size={18}
                      tone="onDark"
                    />
                  ) : (
                    <Radar className="h-3.5 w-3.5" />
                  )}
                  {t('Buscar', 'Buscar', 'Search')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openEdit(p)}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                  title={t('Editar atalho', 'Editar atajo', 'Edit shortcut')}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t('Editar', 'Editar', 'Edit')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(p)}
                  className="inline-flex items-center rounded-lg border border-red-100 px-2 py-1.5 text-red-700 hover:bg-red-50"
                  title={t('Apagar', 'Borrar', 'Delete')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {editorOpen && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-900">
              {editingId
                ? t('Editar atalho', 'Editar atajo', 'Edit shortcut')
                : t('Novo atalho', 'Nuevo atajo', 'New shortcut')}
            </p>
            <button type="button" onClick={() => setEditorOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="mt-2 block text-[10px] font-semibold uppercase text-gray-500">
            {t('Nome do atalho', 'Nombre del atajo', 'Shortcut name')}
          </label>
          <input
            value={scanName}
            onChange={(e) => setScanName(e.target.value)}
            placeholder="Rura Commerce interno FP"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />

          <p className="mt-2 text-[10px] font-semibold uppercase text-gray-500">
            {t('Classificações', 'Clasificaciones', 'Classifications')}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {CLASS_OPTS.map((c) => {
              const on = classifications.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setClassifications((prev) =>
                      on ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                    )
                  }
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    on ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700'
                  }`}
                >
                  {locale === 'pt' ? c.pt : locale === 'es' ? c.es : c.en}
                </button>
              );
            })}
          </div>

          <label className="mt-2 block text-[10px] font-semibold uppercase text-gray-500">
            {t('Orientação / comando', 'Orientación / comando', 'Guidance / command')}
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={7}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            placeholder={t(
              'Cole aqui a orientação completa da varredura…',
              'Pegue aquí la orientación completa…',
              'Paste the full scan guidance here…',
            )}
          />

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy || !feedback.trim()}
              onClick={() => void save()}
              className="flex-1 rounded-lg bg-gray-900 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {busy ? (
                <ScanProgressRing percent={40} state="running" size={16} tone="onDark" />
              ) : editingId ? (
                t('Guardar alterações', 'Guardar cambios', 'Save changes')
              ) : (
                t('Criar atalho', 'Crear atajo', 'Create shortcut')
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600"
            >
              {t('Cancelar', 'Cancelar', 'Cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
