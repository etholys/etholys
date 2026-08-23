'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link2, Loader2, Plus, Trash2, X } from 'lucide-react';
import { DOC_LINK_SYSTEMS, type DocLinkSystemKey } from '@/lib/document-links-shared';

type LinkRow = {
  id: string;
  systemKey: string;
  entityType: string;
  entityId: string;
  label: string | null;
};

type OptionRow = {
  entityType: string;
  entityId: string;
  label: string;
  hint?: string;
};

type Props = {
  targetType: 'studio' | 'core';
  documentId: string;
  companyId?: string;
  canEdit: boolean;
  open: boolean;
  onClose: () => void;
  labels: {
    title: string;
    hint: string;
    system: string;
    entity: string;
    add: string;
    empty: string;
    close: string;
    loading: string;
  };
};

const SYSTEM_LABEL: Record<string, string> = {
  NEXUS: 'NEXUS',
  SIEP: 'SIEP',
  FUNDHUB: 'FUNDHUB',
  FORGE: 'FORGE',
  MEET: 'Meet',
  ATLAS: 'ATLAS',
  CORE: 'Core',
};

export function DocumentLinksPanel({
  targetType,
  documentId,
  companyId,
  canEdit,
  open,
  onClose,
  labels,
}: Props) {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [systemKey, setSystemKey] = useState<DocLinkSystemKey>('NEXUS');
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ targetType, documentId });
      const r = await fetch(`/api/document-links?${q}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      setLinks(d.links || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [targetType, documentId]);

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    setSelected('');
    try {
      const q = new URLSearchParams({ systemKey });
      if (companyId) q.set('companyId', companyId);
      const r = await fetch(`/api/document-links/options?${q}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      setOptions(d.entities || []);
    } catch {
      setOptions([]);
    } finally {
      setOptionsLoading(false);
    }
  }, [systemKey, companyId]);

  useEffect(() => {
    if (!open) return;
    void loadLinks();
  }, [open, loadLinks]);

  useEffect(() => {
    if (!open || !canEdit) return;
    void loadOptions();
  }, [open, canEdit, loadOptions]);

  async function addLink() {
    if (!selected || !canEdit) return;
    const opt = options.find((o) => `${o.entityType}:${o.entityId}` === selected);
    if (!opt) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/document-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          documentId,
          systemKey,
          entityType: opt.entityType,
          entityId: opt.entityId,
          label: opt.label,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      setSelected('');
      await loadLinks();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function removeLink(id: string) {
    if (!canEdit) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/document-links?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      await loadLinks();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-slate-900">
              <Link2 className="h-4 w-4 text-orange-600" />
              {labels.title}
            </h3>
            <p className="mt-1 text-xs text-slate-500">{labels.hint}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {error}
          </p>
        )}

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {labels.loading}
          </p>
        ) : links.length === 0 ? (
          <p className="mb-4 text-sm text-slate-500">{labels.empty}</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {links.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {l.label || l.entityId}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {SYSTEM_LABEL[l.systemKey] || l.systemKey} · {l.entityType}
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeLink(l.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {labels.system}
              <select
                value={systemKey}
                onChange={(e) => setSystemKey(e.target.value as DocLinkSystemKey)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800"
              >
                {DOC_LINK_SYSTEMS.map((s) => (
                  <option key={s} value={s}>
                    {SYSTEM_LABEL[s] || s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {labels.entity}
              <select
                value={selected}
                disabled={optionsLoading}
                onChange={(e) => setSelected(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800 disabled:opacity-50"
              >
                <option value="">
                  {optionsLoading ? labels.loading : '—'}
                </option>
                {options.map((o) => (
                  <option key={`${o.entityType}:${o.entityId}`} value={`${o.entityType}:${o.entityId}`}>
                    {o.label}
                    {o.hint ? ` (${o.hint})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={busy || !selected}
              onClick={() => void addLink()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {labels.add}
            </button>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            {labels.close}
          </button>
        </div>
      </div>
    </div>
  );
}
