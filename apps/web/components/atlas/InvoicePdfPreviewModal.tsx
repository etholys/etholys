'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, Download, FileSearch, X } from 'lucide-react';
import { invoicePdfUserError } from '@/lib/atlas/invoice-ops';

type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });

const PAGE_W = 794;
const PAGE_H = 1123;

export default function InvoicePdfPreviewModal({
  invoice,
  locale,
  onClose,
  onDownload,
  downloading,
}: {
  invoice: { id: string; number: string };
  locale: string;
  onClose: () => void;
  onDownload: () => void;
  downloading?: boolean;
}) {
  const L = (m: ML) => m[locale as keyof ML] || m.en;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, Math.max(0.35, (el.clientWidth - 24) / PAGE_W)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [html, loading]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      setHtml('');
      try {
        const res = await fetch(`/api/invoices/pdf?id=${encodeURIComponent(invoice.id)}&html=1`);
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(invoicePdfUserError(res.status, payload));
        }
        const text = await res.text();
        if (!text.includes('<html')) throw new Error(L(ml('Could not load preview', 'No se pudo cargar la vista previa', 'Não foi possível carregar a pré-visualização')));
        if (!cancelled) setHtml(text);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error && e.message
              ? e.message
              : L(ml('Could not load preview', 'No se pudo cargar la vista previa', 'Não foi possível carregar a pré-visualização')),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [invoice.id]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-6">
      <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileSearch className="h-5 w-5 shrink-0 text-slate-600" />
            <h3 className="truncate text-lg font-bold">
              {L(ml('Preview', 'Vista previa', 'Pré-visualizar'))}
              <span className="ml-2 font-medium text-gray-500">{invoice.number}</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading || loading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {downloading ? <Clock className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {L(ml('Download PDF', 'Descargar PDF', 'Descarregar PDF'))}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">
              {L(ml('Close', 'Cerrar', 'Fechar'))}
            </button>
            <button type="button" onClick={onClose} aria-label={L(ml('Close', 'Cerrar', 'Fechar'))}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div ref={wrapRef} className="min-h-0 flex-1 overflow-auto bg-neutral-200 p-4 dark:bg-neutral-800">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4 animate-spin" />
              {L(ml('Loading preview…', 'Cargando vista previa…', 'A carregar pré-visualização…'))}
            </div>
          ) : error ? (
            <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <div className="mx-auto" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
              <iframe
                title={L(ml('Invoice preview', 'Vista previa de factura', 'Pré-visualização da fatura'))}
                srcDoc={html}
                sandbox="allow-same-origin"
                className="origin-top-left bg-white shadow-xl"
                style={{
                  width: PAGE_W,
                  height: PAGE_H,
                  border: 'none',
                  transform: `scale(${scale})`,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
