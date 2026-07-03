'use client';

import { CONSULTANCY_OPTIONS } from '@/lib/forge/expedicion-v2/consultancy';
import type { ConsultancyOptionId } from '@/lib/forge/expedicion-v2/types';
import { X } from 'lucide-react';

export function ForgeConsultancyModal({
  open,
  balance,
  stationLabel,
  capsulaBody,
  onClose,
  onSelect,
}: {
  open: boolean;
  balance: number;
  stationLabel?: string;
  capsulaBody?: string;
  onClose: () => void;
  onSelect: (optionId: ConsultancyOptionId) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="font-bold text-slate-900">Mercado de Consultoría</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500">
            Saldo disponible: <strong className="text-[#1B5E4B]">{balance} Eco</strong>
          </p>
          {capsulaBody && stationLabel && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950">
              <p className="font-bold">{stationLabel}</p>
              <p className="mt-1">{capsulaBody}</p>
            </div>
          )}
          {CONSULTANCY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={balance < opt.cost}
              onClick={() => onSelect(opt.id)}
              className="w-full rounded-xl border-2 border-slate-200 p-3 text-left hover:border-[#1B5E4B] disabled:opacity-40"
            >
              <div className="flex justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">{opt.label}</span>
                <span className="text-sm font-black text-rose-700">-{opt.cost}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{opt.description}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">Pago a: {opt.payee}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
