'use client';

import { useState } from 'react';
import { CONSULTANCY_OPTIONS } from '@/lib/forge/expedicion-v2/consultancy';
import type { ConsultancyOptionId } from '@/lib/forge/expedicion-v2/types';
import { X } from 'lucide-react';

export type TeamPeer = { userId: string; name: string };

export function ForgeConsultancyModal({
  open,
  balance,
  stationLabel,
  capsulaBody,
  capsulaGuion,
  capsulaAccion,
  teamPeers,
  myUserId,
  onClose,
  onSelect,
}: {
  open: boolean;
  balance: number;
  stationLabel?: string;
  capsulaBody?: string;
  capsulaGuion?: string;
  capsulaAccion?: string;
  teamPeers?: TeamPeer[];
  myUserId?: string;
  onClose: () => void;
  onSelect: (optionId: ConsultancyOptionId, peerUserId?: string) => void;
}) {
  const [peerPick, setPeerPick] = useState<string>('');

  if (!open) return null;

  const peers = (teamPeers ?? []).filter((p) => p.userId !== myUserId);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-auto rounded-2xl bg-white shadow-2xl">
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
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950 space-y-2">
              <p className="font-bold">{stationLabel}</p>
              {capsulaGuion && (
                <p>
                  <span className="font-semibold">Guion: </span>
                  {capsulaGuion}
                </p>
              )}
              <p>{capsulaBody}</p>
              {capsulaAccion && (
                <p className="font-semibold text-[#1B5E4B]">Acción en mapa: {capsulaAccion}</p>
              )}
            </div>
          )}
          {peers.length > 0 && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-2">
              <label className="text-[10px] font-bold text-violet-900">
                Colega que te ayuda (pago −100 Eco al compañero)
              </label>
              <select
                value={peerPick}
                onChange={(e) => setPeerPick(e.target.value)}
                className="mt-1 w-full rounded border border-violet-200 px-2 py-1.5 text-xs"
              >
                <option value="">Seleccionar compañero…</option>
                {peers.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {CONSULTANCY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={
                balance < opt.cost || (opt.id === 'companero' && peers.length > 0 && !peerPick)
              }
              onClick={() => {
                onSelect(opt.id, opt.id === 'companero' ? peerPick || undefined : undefined);
              }}
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
