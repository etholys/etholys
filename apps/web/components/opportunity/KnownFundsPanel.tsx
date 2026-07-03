'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { BookMarked, Loader2, Plus } from 'lucide-react';

type KnownFund = {
  id: string;
  name: string;
  institution: string;
  linkOficial?: string | null;
  type: string;
};

export function KnownFundsPanel({ onAdded }: { onAdded?: () => void }) {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [url, setUrl] = useState('');
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [recent, setRecent] = useState<KnownFund[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const q = (path: string) =>
    `${path}${path.includes('?') ? '&' : '?'}companyId=${encodeURIComponent(companyId)}`;

  const loadRecent = useCallback(async () => {
    if (!companyId) return;
    const r = await fetch(q('/api/opportunity/catalog?limit=5'), { cache: 'no-store' });
    if (!r.ok) return;
    const d = (await r.json()) as { funds?: KnownFund[] };
    setRecent(d.funds ?? []);
  }, [companyId]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const submit = async () => {
    if (!companyId) return;
    setBusy(true);
    setMsg(null);
    try {
      const body = showBulk
        ? { bulk }
        : { name: name.trim(), institution: institution.trim(), linkOficial: url.trim() || undefined };
      const r = await fetch(q('/api/opportunity/catalog'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      setName('');
      setInstitution('');
      setUrl('');
      setBulk('');
      setMsg(
        t(
          `${d.count} fundo(s) registado(s). A IA usará isto nas próximas varreduras.`,
          `${d.count} fondo(s) registrado(s). La IA usará esto en próximos barridos.`,
          `${d.count} fund(s) saved. AI will use this in future scans.`,
        ),
      );
      await loadRecent();
      onAdded?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  if (!companyId) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <BookMarked className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-gray-900">
          {t('Fundos que já conheço', 'Fondos que ya conozco', 'Funds I already know')}
        </h3>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {t(
          'Registe o que já sabe — a IA evita duplicar e aprende o seu universo.',
          'Registre lo que ya sabe — la IA evita duplicar y aprende su universo.',
          'Register what you already know — AI avoids duplicates and learns your universe.',
        )}
      </p>

      <button
        type="button"
        onClick={() => setShowBulk((v) => !v)}
        className="mt-2 text-xs font-medium text-amber-700 hover:underline"
      >
        {showBulk
          ? t('← Formulário simples', '← Formulario simple', '← Simple form')
          : t('Importar lista (colar)', 'Importar lista (pegar)', 'Import list (paste)')}
      </button>

      {showBulk ? (
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={4}
          placeholder={t(
            'Nome | Instituição | URL\nGAFSP BIFT | World Bank | https://…',
            'Nombre | Institución | URL',
            'Name | Institution | URL',
          )}
          className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono"
        />
      ) : (
        <div className="mt-3 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Nome do fundo / edital', 'Nombre del fondo', 'Fund / call name')}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder={t('Instituição financiadora', 'Institución financiadora', 'Funder institution')}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('URL oficial (opcional)', 'URL oficial (opcional)', 'Official URL (optional)')}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
      )}

      <button
        type="button"
        disabled={busy || (showBulk ? !bulk.trim() : !name.trim() || !institution.trim())}
        onClick={() => void submit()}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {t('Registar fundo', 'Registrar fondo', 'Register fund')}
      </button>

      {msg && <p className="mt-2 text-xs text-gray-600">{msg}</p>}

      {recent.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-gray-100 pt-3">
          {recent.slice(0, 4).map((f) => (
            <li key={f.id} className="text-xs">
              <p className="truncate font-medium text-gray-800">{f.name}</p>
              <p className="truncate text-gray-500">{f.institution}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
