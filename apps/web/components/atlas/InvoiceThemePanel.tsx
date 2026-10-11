'use client';

import { useEffect, useState } from 'react';
import { Palette, X, Upload } from 'lucide-react';
import type { InvoiceTheme, InvoiceTableStyle, InvoiceTableLayout } from '@/lib/atlas/invoice-theme';
import type { InvoiceNumbering } from '@/lib/atlas/invoice-numbering';
import { DEFAULT_INVOICE_NUMBERING, formatInvoiceNumber } from '@/lib/atlas/invoice-numbering';

type ML = { es: string; pt: string; en: string };

async function readImageFile(file: File): Promise<string> {
  if (file.size > 1.5 * 1024 * 1024) throw new Error('max');
  if (!file.type.startsWith('image/')) throw new Error('type');
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-gray-600">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          className="h-8 w-10 cursor-pointer rounded border bg-white p-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          className="w-24 rounded border px-2 py-1 font-mono text-[11px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  );
}

function FileField({
  label,
  preview,
  onFile,
  onClear,
}: {
  label: string;
  preview?: string;
  onFile: (dataUrl: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      {preview ? (
        <div
          className="flex h-16 items-center justify-center overflow-hidden rounded-lg border bg-slate-900"
          style={{ backgroundImage: preview.startsWith('data:') || preview.startsWith('/') ? `url(${preview})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          {label.toLowerCase().includes('logo') ? (
            <img src={preview} alt="" className="h-12 object-contain" />
          ) : null}
        </div>
      ) : (
        <div className="flex h-12 items-center justify-center rounded-lg border border-dashed text-xs text-gray-400">—</div>
      )}
      <div className="flex gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-gray-50">
          <Upload className="h-3.5 w-3.5" />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                onFile(await readImageFile(f));
              } catch {
                alert('Imagen: PNG/JPG/WebP, máximo 1.5 MB');
              }
            }}
          />
          Subir
        </label>
        {preview ? (
          <button type="button" onClick={onClear} className="text-xs text-red-500 hover:underline">
            Quitar
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function InvoiceThemePanel({
  companyId,
  locale,
}: {
  companyId: string;
  locale: 'es' | 'pt' | 'en';
}) {
  const L = (m: ML) => m[locale] || m.en;
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<InvoiceTheme | null>(null);
  const [numbering, setNumbering] = useState<InvoiceNumbering>({ ...DEFAULT_INVOICE_NUMBERING });
  const [numPreview, setNumPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!open || !companyId) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/invoices/theme?companyId=${encodeURIComponent(companyId)}`).then((r) => r.json()),
      fetch(`/api/invoices/numbering?companyId=${encodeURIComponent(companyId)}`).then((r) => r.json()),
    ])
      .then(([themeData, numData]) => {
        if (cancelled) return;
        if (themeData?.theme) setTheme(themeData.theme);
        if (numData?.numbering) setNumbering(numData.numbering);
        if (numData?.preview) setNumPreview(numData.preview);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, companyId]);

  const patch = (partial: Partial<InvoiceTheme>) => {
    setTheme((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  const save = async (next?: InvoiceTheme, presetId?: string) => {
    const bodyTheme = next || theme;
    if (!companyId) return;
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/invoices/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presetId ? { companyId, presetId } : { companyId, theme: bodyTheme }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || 'save');
      setTheme(d.theme);
      try {
        const numRes = await fetch('/api/invoices/numbering', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, numbering }),
        });
        const numData = await numRes.json();
        if (numData?.numbering) {
          setNumbering(numData.numbering);
          setNumPreview(formatInvoiceNumber(numData.numbering, numData.numbering.nextSeq));
        }
      } catch {}
      setMsg(L({ en: 'Saved', es: 'Guardado', pt: 'Guardado' }));
    } catch {
      setMsg(L({ en: 'Could not save', es: 'No se pudo guardar', pt: 'Não foi possível guardar' }));
    } finally {
      setSaving(false);
    }
  };

  const rows = theme?.payment.rows?.length
    ? theme.payment.rows
    : [
        { label: 'Bank Name', value: '' },
        { label: 'Bank Address', value: '' },
        { label: 'IBAN / Account Number', value: '' },
        { label: 'ABA / Routing Number', value: '' },
      ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50"
      >
        <Palette className="h-4 w-4" />
        {L({ en: 'PDF style', es: 'Estilo del PDF', pt: 'Estilo do PDF' })}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="text-lg font-bold">
                {L({ en: 'Invoice appearance', es: 'Apariencia de factura', pt: 'Aparência da fatura' })}
              </h3>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 overflow-y-auto px-5 py-4 text-sm">
              <p className="text-xs text-gray-500">
                {L({
                  en: 'Same layout for everyone. Change banner, logo, letter colors and table style.',
                  es: 'La estructura es la misma. Puedes cambiar banner, logo, colores y estilo de tabla.',
                  pt: 'A estrutura é a mesma. Podes mudar banner, logo, cores e estilo da tabela.',
                })}
              </p>
              <button
                type="button"
                onClick={() => save(undefined, 'rural-commerce')}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800"
              >
                {L({
                  en: 'Use Rural Commerce template',
                  es: 'Usar plantilla Rural Commerce',
                  pt: 'Usar modelo Rural Commerce',
                })}
              </button>
              <div className="space-y-2 rounded-xl border p-3">
                <p className="text-xs font-semibold text-gray-500">
                  {L({ en: 'Invoice numbering', es: 'Numeración de facturas', pt: 'Numeração de faturas' })}
                </p>
                <p className="text-[11px] text-gray-400">
                  {L({
                    en: 'Tokens: {PREFIX} {YYYY} {YY} {MM} {DD} {SEQ}. Example RC: INV-{YY}{SEQ} → INV-2608097.',
                    es: 'Tokens: {PREFIX} {YYYY} {YY} {MM} {DD} {SEQ}. Ejemplo RC: INV-{YY}{SEQ} → INV-2608097.',
                    pt: 'Tokens: {PREFIX} {YYYY} {YY} {MM} {DD} {SEQ}. Exemplo RC: INV-{YY}{SEQ} → INV-2608097.',
                  })}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-500">
                    {L({ en: 'Prefix', es: 'Prefijo', pt: 'Prefixo' })}
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm" value={numbering.prefix} onChange={(e) => setNumbering({ ...numbering, prefix: e.target.value.toUpperCase() })} />
                  </label>
                  <label className="text-xs text-gray-500">
                    {L({ en: 'Next sequence', es: 'Próxima secuencia', pt: 'Próxima sequência' })}
                    <input className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm" type="number" min={1} value={numbering.nextSeq} onChange={(e) => setNumbering({ ...numbering, nextSeq: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
                  </label>
                </div>
                <label className="text-xs text-gray-500">
                  {L({ en: 'Pattern', es: 'Formato', pt: 'Formato' })}
                  <input className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm" value={numbering.pattern} onChange={(e) => setNumbering({ ...numbering, pattern: e.target.value })} />
                </label>
                <label className="text-xs text-gray-500">
                  {L({ en: 'Sequence padding', es: 'Ceros del número', pt: 'Zeros da sequência' })}
                  <input className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm" type="number" min={1} max={8} value={numbering.seqPadding} onChange={(e) => setNumbering({ ...numbering, seqPadding: Math.min(8, Math.max(1, parseInt(e.target.value, 10) || 4)) })} />
                </label>
                <p className="font-mono text-xs text-teal-700">
                  {L({ en: 'Next number', es: 'Próximo número', pt: 'Próximo número' })}:{' '}
                  {numPreview || formatInvoiceNumber(numbering, numbering.nextSeq)}
                </p>
              </div>
              {theme && (
                <>
                  <div
                    className="overflow-hidden rounded-xl"
                    style={{
                      background: theme.bannerUrl ? undefined : theme.primary,
                      backgroundImage: theme.bannerUrl ? `url(${theme.bannerUrl})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center right',
                      minHeight: 88,
                    }}
                  >
                    <div className="flex items-center justify-between px-4 py-3">
                      {theme.logoUrl ? (
                        <img src={theme.logoUrl} alt="" className="h-10 object-contain" />
                      ) : (
                        <span className="font-semibold" style={{ color: theme.bannerText }}>
                          Logo
                        </span>
                      )}
                      <span className="text-[11px] font-semibold" style={{ color: theme.bannerText }}>
                        {numPreview || formatInvoiceNumber(numbering, numbering.nextSeq)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FileField
                      label="Banner"
                      preview={theme.bannerUrl}
                      onFile={(v) => patch({ bannerUrl: v })}
                      onClear={() => patch({ bannerUrl: '' })}
                    />
                    <FileField
                      label="Logo"
                      preview={theme.logoUrl}
                      onFile={(v) => patch({ logoUrl: v })}
                      onClear={() => patch({ logoUrl: '' })}
                    />
                  </div>
                  <div className="space-y-2 rounded-xl border p-3">
                    <p className="text-xs font-semibold text-gray-500">
                      {L({ en: 'Colors', es: 'Colores', pt: 'Cores' })}
                    </p>
                    <ColorField label={L({ en: 'Primary / header', es: 'Primario / encabezado', pt: 'Primária / cabeçalho' })} value={theme.primary} onChange={(primary) => patch({ primary, tableHeaderBg: primary, tableBorder: primary })} />
                    <ColorField label={L({ en: 'Accent / letters', es: 'Acento / letras', pt: 'Acento / letras' })} value={theme.accent} onChange={(accent) => patch({ accent, paymentHeaderBg: accent })} />
                    <ColorField label={L({ en: 'Heading text', es: 'Texto de títulos', pt: 'Texto de títulos' })} value={theme.headingText} onChange={(headingText) => patch({ headingText })} />
                    <ColorField label={L({ en: 'Table header', es: 'Cabecera de tabla', pt: 'Cabeçalho da tabela' })} value={theme.tableHeaderBg} onChange={(tableHeaderBg) => patch({ tableHeaderBg })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-gray-500">
                      {L({ en: 'Table style', es: 'Estilo de tabla', pt: 'Estilo da tabela' })}
                      <select
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                        value={theme.tableStyle}
                        onChange={(e) => patch({ tableStyle: e.target.value as InvoiceTableStyle })}
                      >
                        <option value="branded">Branded</option>
                        <option value="classic">Classic</option>
                        <option value="lined">Lined</option>
                        <option value="striped">Striped</option>
                      </select>
                    </label>
                    <label className="text-xs text-gray-500">
                      {L({ en: 'Columns', es: 'Columnas', pt: 'Colunas' })}
                      <select
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                        value={theme.tableLayout}
                        onChange={(e) => patch({ tableLayout: e.target.value as InvoiceTableLayout })}
                      >
                        <option value="amount">{L({ en: 'Item + amount', es: 'Ítem + monto', pt: 'Item + valor' })}</option>
                        <option value="detailed">{L({ en: 'Qty + unit + total', es: 'Cant. + precio + total', pt: 'Qtd. + preço + total' })}</option>
                      </select>
                    </label>
                  </div>
                  <div className="space-y-2 rounded-xl border p-3">
                    <p className="text-xs font-semibold text-gray-500">From</p>
                    <input className="w-full rounded-lg border px-3 py-2" placeholder="Legal name" value={theme.letterhead.legalName} onChange={(e) => patch({ letterhead: { ...theme.letterhead, legalName: e.target.value } })} />
                    <textarea className="w-full rounded-lg border px-3 py-2" rows={2} placeholder="Address" value={theme.letterhead.address} onChange={(e) => patch({ letterhead: { ...theme.letterhead, address: e.target.value } })} />
                    <div className="grid grid-cols-2 gap-2">
                      <input className="rounded-lg border px-3 py-2" placeholder="Phone" value={theme.letterhead.phone} onChange={(e) => patch({ letterhead: { ...theme.letterhead, phone: e.target.value } })} />
                      <input className="rounded-lg border px-3 py-2" placeholder="Email" value={theme.letterhead.email} onChange={(e) => patch({ letterhead: { ...theme.letterhead, email: e.target.value } })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="rounded-lg border px-3 py-2" placeholder="EIN / RUT" value={theme.letterhead.taxIdLabel} onChange={(e) => patch({ letterhead: { ...theme.letterhead, taxIdLabel: e.target.value } })} />
                      <input className="rounded-lg border px-3 py-2" placeholder="35-…" value={theme.letterhead.taxId} onChange={(e) => patch({ letterhead: { ...theme.letterhead, taxId: e.target.value } })} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={theme.payment.enabled} onChange={(e) => patch({ payment: { ...theme.payment, enabled: e.target.checked, rows } })} />
                    {L({ en: 'Payment instructions', es: 'Instrucciones de pago', pt: 'Instruções de pagamento' })}
                  </label>
                  {theme.payment.enabled &&
                    rows.map((row, i) => (
                      <div key={i} className="grid grid-cols-2 gap-2">
                        <input
                          className="rounded-lg border px-3 py-1.5 text-xs"
                          value={row.label}
                          onChange={(e) => {
                            const next = rows.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r));
                            patch({ payment: { ...theme.payment, rows: next } });
                          }}
                        />
                        <input
                          className="rounded-lg border px-3 py-1.5 text-xs"
                          value={row.value}
                          onChange={(e) => {
                            const next = rows.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r));
                            patch({ payment: { ...theme.payment, rows: next } });
                          }}
                        />
                      </div>
                    ))}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={theme.signature.enabled} onChange={(e) => patch({ signature: { ...theme.signature, enabled: e.target.checked } })} />
                    {L({ en: 'Signature block', es: 'Bloque de firma', pt: 'Bloco de assinatura' })}
                  </label>
                  {theme.signature.enabled && (
                    <div className="grid grid-cols-1 gap-2">
                      <input className="rounded-lg border px-3 py-2" placeholder="Name" value={theme.signature.name} onChange={(e) => patch({ signature: { ...theme.signature, name: e.target.value } })} />
                      <input className="rounded-lg border px-3 py-2" placeholder="Title" value={theme.signature.title} onChange={(e) => patch({ signature: { ...theme.signature, title: e.target.value } })} />
                      <input className="rounded-lg border px-3 py-2" placeholder="Company line" value={theme.signature.companyLine} onChange={(e) => patch({ signature: { ...theme.signature, companyLine: e.target.value } })} />
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              {msg ? <span className="mr-auto text-xs text-gray-500">{msg}</span> : null}
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-sm">
                {L({ en: 'Close', es: 'Cerrar', pt: 'Fechar' })}
              </button>
              <button
                type="button"
                disabled={saving || !theme}
                onClick={() => save()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? '…' : L({ en: 'Save', es: 'Guardar', pt: 'Guardar' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
