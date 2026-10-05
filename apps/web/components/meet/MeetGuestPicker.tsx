'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, UserPlus, X } from 'lucide-react';

export type MeetGuestSuggestion = {
  id: string | null;
  email: string;
  name: string;
  source: 'saved' | 'team' | 'recent';
};

type Props = {
  locale: string;
  companyId: string;
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
};

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] || '';
  return local
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

export function MeetGuestPicker({ locale, companyId, emails, onChange, placeholder }: Props) {
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<MeetGuestSuggestion[]>([]);
  const [pendingSave, setPendingSave] = useState<{ email: string; name: string } | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/meet/contacts?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setSuggestions(Array.isArray(d.contacts) ? d.contacts : []);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!boxRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = useMemo(
    () => new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
    [emails],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suggestions
      .filter((row) => !selected.has(row.email.toLowerCase()))
      .filter(
        (row) =>
          !q ||
          row.email.toLowerCase().includes(q) ||
          row.name.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, selected, suggestions]);

  const typedEmail = query.trim().toLowerCase();
  const canUseTyped = looksLikeEmail(typedEmail) && !selected.has(typedEmail);

  async function persistContact(email: string, name: string) {
    if (!companyId) return false;
    const r = await fetch('/api/meet/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, email, name: name.trim() }),
    });
    const d = (await r.json()) as { contact?: MeetGuestSuggestion };
    if (!r.ok || !d.contact) return false;
    setSuggestions((prev) => {
      const without = prev.filter((row) => row.email !== d.contact!.email);
      return [d.contact!, ...without];
    });
    return true;
  }

  function addEmail(email: string, name?: string, source?: MeetGuestSuggestion['source']) {
    const next = email.trim().toLowerCase();
    if (!next.includes('@') || selected.has(next)) {
      setQuery('');
      return;
    }
    const label = name?.trim() || nameFromEmail(next);
    onChange([...emails, next]);
    setQuery('');
    setOpen(false);
    const alreadySaved = suggestions.some(
      (row) => row.email.toLowerCase() === next && row.source === 'saved',
    );
    if (alreadySaved) {
      setPendingSave(null);
      setSavedNotice(null);
      return;
    }
    setPendingSave({ email: next, name: label });
    setSavedNotice(null);
    if (source === 'saved') return;
    void persistContact(next, label).then((ok) => {
      if (ok) {
        setSavedNotice(label);
      }
    });
    inputRef.current?.focus();
  }

  function removeEmail(email: string) {
    onChange(emails.filter((row) => row !== email));
    if (pendingSave?.email === email) setPendingSave(null);
  }

  function commitTypedOrFirst() {
    if (canUseTyped) {
      addEmail(typedEmail);
      return true;
    }
    if (looksLikeEmail(typedEmail)) {
      addEmail(typedEmail);
      return true;
    }
    if (filtered[0]) {
      addEmail(filtered[0].email, filtered[0].name, filtered[0].source);
      return true;
    }
    return false;
  }

  async function savePending() {
    if (!pendingSave || !companyId) return;
    setSaving(true);
    try {
      const ok = await persistContact(pendingSave.email, pendingSave.name);
      if (ok) {
        setSavedNotice(pendingSave.name.trim() || pendingSave.email);
        setPendingSave(null);
      }
    } finally {
      setSaving(false);
    }
  }

  function sourceLabel(source: MeetGuestSuggestion['source']) {
    if (source === 'saved') return t('Contacto', 'Contacto', 'Contact');
    if (source === 'team') return t('Equipa', 'Equipo', 'Team');
    return t('Recente', 'Reciente', 'Recent');
  }

  return (
    <div
      ref={boxRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ',' && event.key !== ';') return;
        event.preventDefault();
        event.stopPropagation();
        commitTypedOrFirst();
      }}
    >
      <div
        className="etholys-meet-light flex min-h-[5.5rem] flex-wrap content-start gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-2 focus-within:ring-2 focus-within:ring-sky-500"
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((email) => {
          const known = suggestions.find((row) => row.email.toLowerCase() === email);
          return (
            <span
              key={email}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-xs text-sky-900"
            >
              <span className="truncate">{known?.name || email}</span>
              <button
                type="button"
                onClick={() => removeEmail(email)}
                className="rounded-full p-0.5 hover:bg-sky-100"
                aria-label={t('Remover', 'Quitar', 'Remove')}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
              event.preventDefault();
              event.stopPropagation();
              commitTypedOrFirst();
            } else if (event.key === 'Backspace' && !query && emails.length) {
              removeEmail(emails[emails.length - 1]!);
            }
          }}
          placeholder={
            emails.length
              ? ''
              : placeholder ||
                t('Nome ou e-mail…', 'Nombre o email…', 'Name or email…')
          }
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={() => commitTypedOrFirst()}
          disabled={!canUseTyped && !filtered[0]}
          className="self-end rounded-full bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
        >
          {t('Adicionar', 'Añadir', 'Add')}
        </button>
      </div>

      {open && query.trim() && (loading || filtered.length > 0 || canUseTyped) && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {loading && (
            <li className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('A carregar contactos…', 'Cargando contactos…', 'Loading contacts…')}
            </li>
          )}
          {canUseTyped && (
            <li>
              <button
                type="button"
                onClick={() => addEmail(typedEmail)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-sky-50"
              >
                <UserPlus className="h-4 w-4 text-sky-600" />
                <span>
                  {t('Usar', 'Usar', 'Use')} <span className="font-medium">{typedEmail}</span>
                </span>
              </button>
            </li>
          )}
          {filtered.map((row) => (
            <li key={`${row.source}:${row.email}`}>
              <button
                type="button"
                onClick={() => addEmail(row.email, row.name, row.source)}
                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span>
                  <span className="block text-sm font-medium text-slate-800">{row.name}</span>
                  <span className="block text-xs text-slate-500">{row.email}</span>
                </span>
                <span className="mt-0.5 shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
                  {sourceLabel(row.source)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pendingSave && (
        <div className="relative z-30 mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
          <p className="text-xs font-medium text-sky-900">
            {savedNotice
              ? t('Contacto guardado. Queres ajustar o nome?', 'Contacto guardado. ¿Quieres ajustar el nombre?', 'Contact saved. Want to adjust the name?')
              : t('Guardar como contacto', 'Guardar como contacto', 'Save as a contact')}
          </p>
          <p className="mt-0.5 text-[11px] text-sky-800/80">{pendingSave.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={pendingSave.name}
              onChange={(event) =>
                setPendingSave((prev) => (prev ? { ...prev, name: event.target.value } : prev))
              }
              placeholder={t('Nome da pessoa', 'Nombre de la persona', 'Person name')}
              className="min-w-[8rem] flex-1 rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="button"
              disabled={saving || !pendingSave.name.trim()}
              onClick={() => void savePending()}
              className="rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : savedNotice ? (
                t('Atualizar nome', 'Actualizar nombre', 'Update name')
              ) : (
                t('Guardar contacto', 'Guardar contacto', 'Save contact')
              )}
            </button>
            <button
              type="button"
              onClick={() => setPendingSave(null)}
              className="text-xs text-sky-800/70 hover:text-sky-950"
            >
              {t('Fechar', 'Cerrar', 'Close')}
            </button>
          </div>
        </div>
      )}

      {!pendingSave && savedNotice && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700">
          <Check className="h-3.5 w-3.5" />
          {t('Contacto guardado:', 'Contacto guardado:', 'Contact saved:')} {savedNotice}
        </p>
      )}
    </div>
  );
}
