'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import InvoiceSignaturePad from '@/components/atlas/InvoiceSignaturePad';
import { clientToInvoiceParty, INVOICE_CURRENCIES } from '@/lib/atlas/invoice-ops';

type ML = { es: string; pt: string; en: string };

export type InvoiceIssueForm = {
  companyId: string;
  type: string;
  clientId: string;
  counterpartyName: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  contactExtra: string;
  number: string;
  numberMode: 'auto' | 'manual';
  issueDate: string;
  dueDate: string;
  currency: string;
  altCurrency: string;
  exchangeRate: string;
  exchangeRateDate: string;
  exchangeRateSource: string;
  bankAccountId: string;
  signatureId: string;
  signatureImage: string;
  taxRate: string;
  notes: string;
  relatedInvoiceId: string;
  items: { description: string; quantity: number; unitPrice: number }[];
};

export default function InvoiceIssueFields({
  form,
  setForm,
  locale,
  clients,
  banks,
  signatures,
  previewNumber,
  numberingHint,
  onCreateClient,
  onCreateBank,
  onCreateSignature,
  showNewClient,
  setShowNewClient,
  showNewBank,
  setShowNewBank,
}: {
  form: InvoiceIssueForm;
  setForm: (next: InvoiceIssueForm) => void;
  locale: 'es' | 'pt' | 'en';
  clients: any[];
  banks: any[];
  signatures: any[];
  previewNumber: string;
  numberingHint: string;
  onCreateClient: (draft: { name: string; email: string; phone: string; address: string; extra: string }) => Promise<void>;
  onCreateBank: (draft: { label: string; bankName: string; bankAddress: string; accountNumber: string; routingNumber: string }) => Promise<void>;
  onCreateSignature: () => Promise<void>;
  showNewClient: boolean;
  setShowNewClient: (v: boolean) => void;
  showNewBank: boolean;
  setShowNewBank: (v: boolean) => void;
}) {
  const L = (m: ML) => m[locale] || m.en;
  const patch = (p: Partial<InvoiceIssueForm>) => setForm({ ...form, ...p });

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-gray-500">{L({ en: 'Invoice number', es: 'Número de factura', pt: 'Número da fatura' })}</label>
        <div className="mb-1 flex gap-3 text-xs">
          <label className="flex items-center gap-1">
            <input type="radio" checked={form.numberMode === 'auto'} onChange={() => patch({ numberMode: 'auto', number: previewNumber })} />
            {L({ en: 'Continue sequence', es: 'Seguir secuencia', pt: 'Continuar sequência' })}
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={form.numberMode === 'manual'} onChange={() => patch({ numberMode: 'manual' })} />
            {L({ en: 'Type manually', es: 'Escribir a mano', pt: 'Escrever à mão' })}
          </label>
        </div>
        <input
          className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
          value={form.numberMode === 'auto' ? previewNumber || form.number : form.number}
          readOnly={form.numberMode === 'auto'}
          onChange={(e) => patch({ number: e.target.value })}
        />
        {numberingHint ? <p className="mt-1 text-[11px] text-gray-400">{numberingHint}</p> : null}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs text-gray-500">{L({ en: 'Client', es: 'Cliente', pt: 'Cliente' })}</label>
          <button type="button" onClick={() => setShowNewClient(!showNewClient)} className="inline-flex items-center gap-1 text-xs text-teal-600">
            <Plus className="h-3.5 w-3.5" /> {L({ en: 'New client', es: 'Nuevo cliente', pt: 'Novo cliente' })}
          </button>
        </div>
        <select
          className="w-full rounded-lg border px-3 py-2 text-sm"
          value={form.clientId}
          onChange={(e) => {
            const id = e.target.value;
            const c = clients.find((x) => x.id === id);
            if (!c) return patch({ clientId: '' });
            const party = clientToInvoiceParty(c);
            patch({
              clientId: id,
              counterpartyName: party.contactName,
              contactEmail: party.contactEmail,
              contactPhone: party.contactPhone,
              contactAddress: party.contactAddress,
              contactExtra: party.contactExtra,
            });
          }}
        >
          <option value="">{L({ en: 'Select client', es: 'Seleccionar cliente', pt: 'Selecionar cliente' })}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input className="rounded-lg border px-3 py-2 text-sm" placeholder={L({ en: 'Client / supplier', es: 'Cliente / proveedor', pt: 'Cliente / fornecedor' })} value={form.counterpartyName} onChange={(e) => patch({ counterpartyName: e.target.value })} />
          <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Email" value={form.contactEmail} onChange={(e) => patch({ contactEmail: e.target.value })} />
        </div>
        <input className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" placeholder={L({ en: 'Phone', es: 'Teléfono', pt: 'Telefone' })} value={form.contactPhone} onChange={(e) => patch({ contactPhone: e.target.value })} />
        <textarea className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" rows={2} placeholder={L({ en: 'Address', es: 'Dirección', pt: 'Morada' })} value={form.contactAddress} onChange={(e) => patch({ contactAddress: e.target.value })} />
        <input className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" placeholder="UEI / extra" value={form.contactExtra} onChange={(e) => patch({ contactExtra: e.target.value })} />
      </div>
      {showNewClient && (
        <NewClientBox
          locale={locale}
          onCancel={() => setShowNewClient(false)}
          onSave={async (d) => {
            await onCreateClient(d);
            setShowNewClient(false);
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">{L({ en: 'Second currency', es: 'Segunda moneda', pt: 'Segunda moeda' })}</label>
          <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.altCurrency} onChange={(e) => patch({ altCurrency: e.target.value })}>
            <option value="">{L({ en: 'None', es: 'Ninguna', pt: 'Nenhuma' })}</option>
            {INVOICE_CURRENCIES.filter((c) => c !== form.currency).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{L({ en: 'Quotation', es: 'Cotización', pt: 'Cotação' })} 1 {form.currency} =</label>
          <input className="w-full rounded-lg border px-3 py-2 text-sm" type="number" min="0" step="0.0001" disabled={!form.altCurrency} value={form.exchangeRate} onChange={(e) => patch({ exchangeRate: e.target.value })} />
        </div>
      </div>
      {form.altCurrency ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">{L({ en: 'Rate date', es: 'Fecha de cotización', pt: 'Data da cotação' })}</label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" type="date" value={form.exchangeRateDate} onChange={(e) => patch({ exchangeRateDate: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">{L({ en: 'Source', es: 'Fuente', pt: 'Fonte' })}</label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="BCCR / Banco Central" value={form.exchangeRateSource} onChange={(e) => patch({ exchangeRateSource: e.target.value })} />
          </div>
        </div>
      ) : null}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs text-gray-500">{L({ en: 'Bank details', es: 'Datos bancarios', pt: 'Dados bancários' })}</label>
          <button type="button" onClick={() => setShowNewBank(!showNewBank)} className="inline-flex items-center gap-1 text-xs text-teal-600">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.bankAccountId} onChange={(e) => patch({ bankAccountId: e.target.value })}>
          <option value="">{L({ en: 'Use template default', es: 'Usar plantilla', pt: 'Usar modelo' })}</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>{b.label || b.bankName}</option>
          ))}
        </select>
      </div>
      {showNewBank && (
        <NewBankBox
          locale={locale}
          onCancel={() => setShowNewBank(false)}
          onSave={async (d) => {
            await onCreateBank(d);
            setShowNewBank(false);
          }}
        />
      )}

      <div>
        <label className="mb-1 block text-xs text-gray-500">{L({ en: 'Signature', es: 'Firma', pt: 'Assinatura' })}</label>
        <select
          className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
          value={form.signatureId}
          onChange={(e) => {
            const id = e.target.value;
            const s = signatures.find((x) => x.id === id);
            patch({ signatureId: id, signatureImage: s?.imageUrl || form.signatureImage });
          }}
        >
          <option value="">{L({ en: 'Draw now or pick saved', es: 'Firmar ahora o elegir guardada', pt: 'Assinar agora ou escolher guardada' })}</option>
          {signatures.map((s) => (
            <option key={s.id} value={s.id}>{s.name}{s.title ? ` — ${s.title}` : ''}</option>
          ))}
        </select>
        <InvoiceSignaturePad value={form.signatureImage} onChange={(signatureImage) => patch({ signatureImage })} />
        {form.signatureImage ? (
          <button type="button" onClick={onCreateSignature} className="text-xs text-teal-600 hover:underline">
            {L({ en: 'Save this signature for later', es: 'Guardar esta firma', pt: 'Guardar esta assinatura' })}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function NewClientBox({
  locale,
  onCancel,
  onSave,
}: {
  locale: 'es' | 'pt' | 'en';
  onCancel: () => void;
  onSave: (d: { name: string; email: string; phone: string; address: string; extra: string }) => Promise<void>;
}) {
  const L = (m: ML) => m[locale] || m.en;
  const [d, setD] = useState({ name: '', email: '', phone: '', address: '', extra: '' });
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder={L({ en: 'Legal name', es: 'Nombre legal', pt: 'Nome legal' })} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
      <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder={L({ en: 'Phone', es: 'Teléfono', pt: 'Telefone' })} value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
      <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={2} placeholder={L({ en: 'Address', es: 'Dirección', pt: 'Morada' })} value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} />
      <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="UEI / extra" value={d.extra} onChange={(e) => setD({ ...d, extra: e.target.value })} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-xs text-gray-500"><X className="inline h-3 w-3" /> {L({ en: 'Cancel', es: 'Cancelar', pt: 'Cancelar' })}</button>
        <button type="button" disabled={!d.name.trim()} onClick={() => onSave(d)} className="rounded-lg bg-teal-600 px-3 py-1 text-xs text-white">
          {L({ en: 'Save client', es: 'Guardar cliente', pt: 'Guardar cliente' })}
        </button>
      </div>
    </div>
  );
}

function NewBankBox({
  locale,
  onCancel,
  onSave,
}: {
  locale: 'es' | 'pt' | 'en';
  onCancel: () => void;
  onSave: (d: { label: string; bankName: string; bankAddress: string; accountNumber: string; routingNumber: string }) => Promise<void>;
}) {
  const L = (m: ML) => m[locale] || m.en;
  const [d, setD] = useState({ label: '', bankName: '', bankAddress: '', accountNumber: '', routingNumber: '' });
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder={L({ en: 'Label', es: 'Etiqueta', pt: 'Etiqueta' })} value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} />
      <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder={L({ en: 'Bank name', es: 'Banco', pt: 'Banco' })} value={d.bankName} onChange={(e) => setD({ ...d, bankName: e.target.value })} />
      <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder={L({ en: 'Bank address', es: 'Dirección banco', pt: 'Morada do banco' })} value={d.bankAddress} onChange={(e) => setD({ ...d, bankAddress: e.target.value })} />
      <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="IBAN / Account" value={d.accountNumber} onChange={(e) => setD({ ...d, accountNumber: e.target.value })} />
      <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="ABA / Routing" value={d.routingNumber} onChange={(e) => setD({ ...d, routingNumber: e.target.value })} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-xs text-gray-500">{L({ en: 'Cancel', es: 'Cancelar', pt: 'Cancelar' })}</button>
        <button type="button" disabled={!d.bankName.trim()} onClick={() => onSave(d)} className="rounded-lg bg-teal-600 px-3 py-1 text-xs text-white">
          {L({ en: 'Save bank', es: 'Guardar banco', pt: 'Guardar banco' })}
        </button>
      </div>
    </div>
  );
}

