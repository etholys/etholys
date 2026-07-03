'use client';

import { useState } from 'react';
import type { MicroCaso } from '@/lib/forge/expedicion-v2/content';
import { ForgeConsultancyModal } from '@/components/forge/ForgeConsultancyModal';
import { getCapsulaForStation } from '@/lib/forge/expedicion-v2/content';
import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import { EXPEDICION_V2_STATIONS } from '@/lib/forge/expedicion-v2/theme';
import type { ConsultancyOptionId } from '@/lib/forge/expedicion-v2/types';
import { HelpCircle } from 'lucide-react';

export function ForgeMicroCasoPanel({
  microCaso,
  station,
  balance,
  isFacilitator,
  onConsultancy,
  onValidate,
}: {
  microCaso: MicroCaso;
  station: ExpedicionStationSlug;
  balance: number;
  isFacilitator?: boolean;
  onConsultancy: (optionId: ConsultancyOptionId) => void;
  onValidate?: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState('');
  const [consultOpen, setConsultOpen] = useState(false);
  const [showCapsula, setShowCapsula] = useState(false);
  const capsula = getCapsulaForStation(station);
  const theme = EXPEDICION_V2_STATIONS[station];

  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className={cnHeader(theme.header)}>
        <span className="text-xs font-bold uppercase">Micro-Caso — {theme.label}</span>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm leading-relaxed text-slate-800">{microCaso.prompt}</p>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Tu respuesta estratégica…"
          rows={4}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          disabled={isFacilitator}
        />
        <div className="flex flex-wrap gap-2">
          {!isFacilitator && (
            <>
              <button
                type="button"
                onClick={() => setConsultOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-3 py-2 text-xs font-bold text-violet-900"
              >
                <HelpCircle className="h-4 w-4" />
                Pedir Consultoría
              </button>
              <button
                type="button"
                onClick={() => onValidate?.(answer)}
                disabled={!answer.trim()}
                className="rounded-lg bg-[#1B5E4B] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                Enviar respuesta
              </button>
            </>
          )}
          {isFacilitator && (
            <details className="w-full rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs">
              <summary className="font-bold cursor-pointer text-amber-900">Rúbrica (solo facilitador)</summary>
              <p className="mt-2 text-amber-950">{microCaso.validationRubric}</p>
            </details>
          )}
        </div>
      </div>
      <ForgeConsultancyModal
        open={consultOpen}
        balance={balance}
        stationLabel={showCapsula ? capsula?.title : undefined}
        capsulaBody={showCapsula ? capsula?.body : undefined}
        onClose={() => {
          setConsultOpen(false);
          setShowCapsula(false);
        }}
        onSelect={(id) => {
          if (id === 'ia_capsula') setShowCapsula(true);
          onConsultancy(id);
          if (id !== 'ia_capsula') setConsultOpen(false);
        }}
      />
    </div>
  );
}

function cnHeader(header: string) {
  return `px-4 py-2 ${header}`;
}
