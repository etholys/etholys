'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/app/providers';
import { ui } from '@/lib/i18n';
import { isLikelyDbId } from '@/lib/utils';
import { ScanProgressRing } from '@/components/opportunity/ScanProgressRing';
import {
  FolderOpen,
  Layers,
  Pencil,
  Plus,
  Radar,
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

const CLASS_OPTS: { id: OpportunityClassification; es: string; pt: string; en: string }[] = [
  { id: 'direct', es: 'Directo (nosotros)', pt: 'Directo (nós)', en: 'Direct (us)' },
  { id: 'client_bridge', es: 'Puente clientes', pt: 'Ponte clientes', en: 'Client bridge' },
  { id: 'joint', es: 'Conjunto', pt: 'Conjunto', en: 'Joint' },
];

export type SearchViewId = 'all' | string;

export function SearchCoachingPanel({
  briefing,
  scanning,
  scanPercent = 0,
  scanUi = 'idle',
  scanningShortcutId = null,
  selectedView,
  onSelectView,
  onRetryScan,
  onSaved,
  onRunShortcut,
}: {
  briefing: Briefing;
  scanning?: boolean;
  scanPercent?: number;
  scanUi?: 'idle' | 'running' | 'error' | 'done';
  /** Only this profile card shows the ring; page-level scans leave cards idle. */
  scanningShortcutId?: string | null;
  selectedView: SearchViewId;
  onSelectView: (view: SearchViewId, briefing?: Briefing) => void;
  onRetryScan?: () => void;
  onSaved?: (next: Briefing) => void;
  /** Activa o perfil e dispara a varredura. */
  onRunShortcut?: (briefing: Briefing, focus: ScanFocus, profileId: string) => void;
}) {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (es: string, pt: string, en: string) => ui(locale, es, pt, en);

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
    if (!companyId) {
      return null as {
        profiles: Profile[];
        activeProfileId: string | null;
      } | null;
    }
    const r = await fetch(q('/api/opportunity/profiles'), { cache: 'no-store' });
    if (!r.ok) return null;
    const d = (await r.json()) as { profiles?: Profile[]; activeProfileId?: string | null };
    const list = d.profiles ?? [];
    setProfiles(list);
    setActiveId(d.activeProfileId ?? null);
    return { profiles: list, activeProfileId: d.activeProfileId ?? null };
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

  const selectAll = () => {
    onSelectView('all');
  };

  const selectProfile = async (p: Profile) => {
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
      onSelectView(p.id, next);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!companyId || !feedback.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const name = scanName.trim() || t('Perfil sin nombre', 'Perfil sem nome', 'Untitled profile');
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
        throw new Error(t('Respuesta inválida.', 'Resposta inválida do servidor.', 'Invalid server response.'));
      }
      if (!r.ok) throw new Error(d.error || 'Erro');
      if (d.briefing) onSaved?.(d.briefing);
      if (d.profile) {
        setActiveId(d.profile.id);
        onSelectView(d.profile.id, d.briefing ?? { ...d.profile.briefing, scanName: d.profile.name });
      }
      await loadProfiles();
      setEditorOpen(false);
      setMsg(
        t(
          `Perfil «${name}» listo — busque desde esta vista.`,
          `Perfil «${name}» pronto — busque a partir desta vista.`,
          `Profile «${name}» ready — search from this view.`,
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
      onSelectView(p.id, next);
      onRunShortcut?.(next, focus, p.id);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Profile) => {
    if (
      !confirm(
        t(`¿Borrar perfil «${p.name}»?`, `Apagar perfil «${p.name}»?`, `Delete profile «${p.name}»?`),
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await fetch(`${q('/api/opportunity/profiles')}&profileId=${encodeURIComponent(p.id)}`, {
        method: 'DELETE',
      });
      if (editingId === p.id) setEditorOpen(false);
      const d = await loadProfiles();
      if (selectedView === p.id) {
        const next = d?.profiles[0];
        if (next) {
          onSelectView(next.id, { ...next.briefing, scanName: next.name, classifications: next.classifications });
        } else {
          onSelectView('all');
        }
      }
      setMsg(t('Perfil borrado.', 'Perfil apagado.', 'Profile deleted.'));
    } finally {
      setBusy(false);
    }
  };

  if (!companyId) return null;

  return (
    <section className="flex h-full min-h-[28rem] flex-col rounded-2xl border border-amber-900/20 bg-gradient-to-b from-zinc-950 to-zinc-900 p-3 text-amber-50 shadow-sm">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-amber-50">
            {t('Perfiles de búsqueda', 'Perfis de busca', 'Search profiles')}
          </h3>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-950 hover:bg-amber-400"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('Nuevo', 'Novo', 'New')}
        </button>
      </div>
      <p className="mt-1 px-1 text-[11px] leading-relaxed text-amber-100/60">
        {t(
          'Cada perfil guarda filtros y su propia bandeja de resultados.',
          'Cada perfil guarda filtros e a sua própria bandeja de resultados.',
          'Each profile keeps filters and its own results inbox.',
        )}
      </p>

      {msg && <p className="mt-2 px-1 text-xs text-amber-100/80">{msg}</p>}

      <button
        type="button"
        onClick={selectAll}
        className={`mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs transition ${
          selectedView === 'all'
            ? 'bg-amber-500/20 ring-1 ring-amber-400/40 text-amber-50'
            : 'text-amber-100/70 hover:bg-white/5'
        }`}
      >
        <Layers className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <span className="min-w-0">
          <span className="block font-semibold">
            {t('Todas las búsquedas', 'Todas as buscas', 'All searches')}
          </span>
          <span className="block text-[10px] text-amber-100/50">
            {t('Vista mixta (opcional)', 'Vista mista (opcional)', 'Mixed view (optional)')}
          </span>
        </span>
      </button>

      <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
        {profiles.length === 0 && !editorOpen && (
          <li>
            <button
              type="button"
              onClick={openCreate}
              className="w-full rounded-xl border border-dashed border-amber-500/30 bg-white/5 px-3 py-4 text-center text-xs text-amber-100/70 hover:bg-white/10"
            >
              {t(
                'Crear el primer perfil — ej. «Rural Uruguay abiertos»',
                'Criar o primeiro perfil — ex. «Rural Uruguay abertos»',
                'Create your first profile — e.g. «Rural Uruguay open»',
              )}
            </button>
          </li>
        )}

        {profiles.map((p) => {
          const isSelected = selectedView === p.id;
          const isActive = activeId === p.id;
          const cardScanning = Boolean(scanning && scanningShortcutId === p.id);
          return (
            <li key={p.id}>
              <div
                className={`rounded-xl px-2.5 py-2 transition ${
                  isSelected
                    ? 'bg-amber-500/15 ring-1 ring-amber-400/35'
                    : 'hover:bg-white/5'
                }`}
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void selectProfile(p)}
                  className="w-full text-left"
                >
                  <p className="truncate text-sm font-semibold text-amber-50">
                    {p.name}
                    {isActive && selectedView === 'all' ? (
                      <span className="ml-1 text-[9px] font-medium text-amber-400/80">●</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-amber-100/45">
                    {p.briefing.searchFeedback ||
                      p.briefing.themes?.join(', ') ||
                      t('Sin orientación', 'Sem orientação', 'No guidance')}
                  </p>
                </button>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={busy || cardScanning}
                    onClick={() => void runShortcut(p, 'open_now')}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-500 px-2 py-1.5 text-[10px] font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    {cardScanning ? (
                      <ScanProgressRing
                        percent={scanPercent}
                        state={scanUi === 'done' ? 'done' : 'running'}
                        size={16}
                        tone="onDark"
                        onRetry={scanUi === 'error' ? onRetryScan : undefined}
                      />
                    ) : (
                      <Radar className="h-3 w-3" />
                    )}
                    {t('Buscar', 'Buscar', 'Search')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openEdit(p)}
                    className="inline-flex items-center rounded-lg border border-amber-500/25 px-2 py-1.5 text-amber-100/80 hover:bg-white/5"
                    title={t('Renombrar / editar', 'Renomear / editar', 'Rename / edit')}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(p)}
                    className="inline-flex items-center rounded-lg border border-red-400/20 px-2 py-1.5 text-red-300/90 hover:bg-red-500/10"
                    title={t('Borrar', 'Apagar', 'Delete')}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {editorOpen && (
        <div className="mt-2 rounded-xl border border-amber-500/25 bg-zinc-950/80 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-50">
              {editingId
                ? t('Editar perfil', 'Editar perfil', 'Edit profile')
                : t('Nuevo perfil', 'Novo perfil', 'New profile')}
            </p>
            <button type="button" onClick={() => setEditorOpen(false)} className="text-amber-100/50 hover:text-amber-50">
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-amber-100/45">
            {t('Nombre', 'Nome', 'Name')}
          </label>
          <input
            value={scanName}
            onChange={(e) => setScanName(e.target.value)}
            placeholder="Rural Uruguay abiertos"
            className="mt-1 w-full rounded-lg border border-amber-500/20 bg-zinc-900 px-3 py-2 text-sm text-amber-50 placeholder:text-amber-100/30"
          />

          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-100/45">
            {t('Clasificaciones', 'Classificações', 'Classifications')}
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
                    on ? 'bg-amber-500 text-zinc-950' : 'border border-amber-500/25 text-amber-100/70'
                  }`}
                >
                  {t(c.es, c.pt, c.en)}
                </button>
              );
            })}
          </div>

          <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-amber-100/45">
            {t('Orientación / filtros', 'Orientação / filtros', 'Guidance / filters')}
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={6}
            className="mt-1 w-full rounded-lg border border-amber-500/20 bg-zinc-900 px-3 py-2 text-sm text-amber-50"
            placeholder={t(
              'País, tema, donante, tipo, exclusiones…',
              'País, tema, doador, tipo, exclusões…',
              'Country, theme, donor, type, exclusions…',
            )}
          />

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy || !feedback.trim()}
              onClick={() => void save()}
              className="flex-1 rounded-lg bg-amber-500 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {busy ? (
                <ScanProgressRing percent={40} state="running" size={16} tone="onDark" />
              ) : editingId ? (
                t('Guardar', 'Guardar', 'Save')
              ) : (
                t('Crear perfil', 'Criar perfil', 'Create profile')
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="rounded-lg border border-amber-500/25 px-3 py-2 text-xs text-amber-100/70"
            >
              {t('Cancelar', 'Cancelar', 'Cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
