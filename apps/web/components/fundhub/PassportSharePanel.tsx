'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { Copy, Share2, ShieldOff, X } from 'lucide-react';

export function PassportSharePanel() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const shareUrl = useMemo(() => {
    if (!token || typeof window === 'undefined') return '';
    return `${window.location.origin}/fundhub/share/${token}`;
  }, [token]);

  const load = useCallback(async () => {
    if (!companyId) return;
    const r = await fetch(`/api/fundhub/passport-share?companyId=${encodeURIComponent(companyId)}`);
    const d = (await r.json()) as { enabled?: boolean; token?: string | null };
    if (r.ok) {
      setEnabled(d.enabled === true);
      setToken(d.token ?? null);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const enable = async () => {
    if (!companyId) return;
    setBusy(true);
    setMsg(null);
    const r = await fetch('/api/fundhub/passport-share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setMsg(d.error || 'Erro');
      return;
    }
    setEnabled(true);
    setToken(d.token ?? null);
    setMsg(t('Link activo — copie e envie ao financiador.', 'Enlace activo — copie y envíe al financiador.', 'Link active — copy and send to the funder.'));
  };

  const revoke = async () => {
    if (!companyId) return;
    setBusy(true);
    const r = await fetch(`/api/fundhub/passport-share?companyId=${encodeURIComponent(companyId)}`, {
      method: 'DELETE',
    });
    setBusy(false);
    if (r.ok) {
      setEnabled(false);
      setToken(null);
      setMsg(t('Link revogado.', 'Enlace revocado.', 'Link revoked.'));
    }
  };

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMsg(t('Link copiado!', '¡Enlace copiado!', 'Link copied!'));
    } catch {
      setMsg(t('Falha ao copiar', 'Error al copiar', 'Copy failed'));
    }
  };

  if (!companyId) return null;

  return (
    <div ref={panelRef} className="no-print relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <Share2 className="h-3.5 w-3.5" />
        {t('Partilhar', 'Compartir', 'Share')}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {t('Partilhar com financiador', 'Compartir con financiador', 'Share with funder')}
              </p>
              <p className="mt-1 text-xs text-gray-600">
                {t(
                  'Link só de leitura. Pode revogar quando quiser.',
                  'Enlace de solo lectura. Puede revocarlo cuando quiera.',
                  'Read-only link. Revoke anytime.',
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {enabled && shareUrl ? (
            <div className="mt-3 space-y-2">
              <input
                readOnly
                value={shareUrl}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {t('Copiar link', 'Copiar enlace', 'Copy link')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void revoke()}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                  {t('Revogar', 'Revocar', 'Revoke')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void enable()}
              className="mt-3 w-full rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {t('Gerar link', 'Generar enlace', 'Generate link')}
            </button>
          )}

          {msg && <p className="mt-2 text-xs text-gray-600">{msg}</p>}
        </div>
      )}
    </div>
  );
}
