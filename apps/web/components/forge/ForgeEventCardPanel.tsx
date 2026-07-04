'use client';

import type { EventCard } from '@/lib/forge/expedicion-v2/content';
import { BOARD_V2_CELL } from '@/lib/forge/expedicion-v2/theme';
import { Zap, AlertTriangle } from 'lucide-react';

export function ForgeEventCardPanel({
  card,
  kind,
  onApply,
  onApplyCrisis,
  onDismiss,
}: {
  card: EventCard;
  kind: 'accion' | 'desafio';
  onApply?: () => void;
  /** Desafío: pagar multa o reescribir (eliminar post-it) */
  onApplyCrisis?: (mode: 'pay_fine' | 'rewrite') => void;
  onDismiss?: () => void;
}) {
  const isAction = kind === 'accion';
  const theme = isAction ? BOARD_V2_CELL.accion : BOARD_V2_CELL.desafio;
  const Icon = isAction ? Zap : AlertTriangle;

  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white shadow-lg overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-2 text-white ${theme.color}`}>
        <Icon className="h-4 w-4" />
        <span className="text-xs font-bold uppercase">
          {isAction ? 'Carta de Acción' : 'Carta de Desafío'} — {card.tag.replace(/\s+/g, ' ').trim()}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-900">{card.title}</p>
        <p className="text-sm text-slate-700">
          <span className="font-bold">Efecto: </span>
          {card.effect}
        </p>
        <div className="flex flex-wrap gap-2">
          {isAction ? (
            <button
              type="button"
              onClick={onApply}
              className={`rounded-lg px-4 py-2 text-xs font-bold text-white ${theme.color} hover:opacity-90`}
            >
              Aplicar beneficio
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onApplyCrisis?.('rewrite')}
                className="rounded-lg bg-slate-700 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Reescribir ficha (eliminar)
              </button>
              <button
                type="button"
                onClick={() => onApplyCrisis?.('pay_fine')}
                className={`rounded-lg px-4 py-2 text-xs font-bold text-white ${theme.color} hover:opacity-90`}
              >
                Pagar multa ({card.fineEco ?? 200} Eco)
              </button>
            </>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
