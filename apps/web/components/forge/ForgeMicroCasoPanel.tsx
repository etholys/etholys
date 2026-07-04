'use client';

import { useState } from 'react';
import type { MicroCaso } from '@/lib/forge/expedicion-v2/content';
import { ForgeConsultancyModal, type TeamPeer } from '@/components/forge/ForgeConsultancyModal';
import { getCapsulaForStation } from '@/lib/forge/expedicion-v2/content';
import { ForgeCapsulaReader } from '@/components/forge/ForgeCapsulaReader';
import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import { EXPEDICION_V2_STATIONS } from '@/lib/forge/expedicion-v2/theme';
import type { ConsultancyOptionId } from '@/lib/forge/expedicion-v2/types';
import { CheckCircle, HelpCircle, XCircle } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';

export function ForgeMicroCasoPanel({
  microCaso,
  station,
  balance,
  isFacilitator,
  pendingAnswer,
  teamPeers,
  myUserId,
  onConsultancy,
  onSubmit,
  onApprove,
  onReject,
}: {
  microCaso: MicroCaso;
  station: ExpedicionStationSlug;
  balance: number;
  isFacilitator?: boolean;
  pendingAnswer?: string;
  teamPeers?: TeamPeer[];
  myUserId?: string;
  onConsultancy: (optionId: ConsultancyOptionId, peerUserId?: string) => void;
  onSubmit?: (answer: string) => void;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const ft = useForgeT();
  const [answer, setAnswer] = useState(pendingAnswer ?? '');
  const [consultOpen, setConsultOpen] = useState(false);
  const [showCapsula, setShowCapsula] = useState(false);
  const capsula = getCapsulaForStation(station);
  const theme = EXPEDICION_V2_STATIONS[station];
  const reviewMode = isFacilitator && Boolean(pendingAnswer);

  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className={cnHeader(theme.header)}>
        <span className="text-xs font-bold uppercase">
          {ft('forge.v2.microCasoTitle', { station: theme.label })}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm leading-relaxed text-slate-800">{microCaso.prompt}</p>
        {capsula && (
          <ForgeCapsulaReader capsula={capsula} defaultOpen={false} compact />
        )}
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={ft('forge.v2.microCasoAnswerPlaceholder')}
          rows={4}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          disabled={isFacilitator}
          readOnly={reviewMode}
        />
        {reviewMode && (
          <p className="text-[10px] font-bold uppercase text-amber-800">
            {ft('forge.v2.microCasoPending')}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {!isFacilitator && (
            <>
              <button
                type="button"
                onClick={() => setConsultOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-3 py-2 text-xs font-bold text-violet-900"
              >
                <HelpCircle className="h-4 w-4" />
                {ft('forge.v2.requestConsultancy')}
              </button>
              <button
                type="button"
                onClick={() => onSubmit?.(answer)}
                disabled={!answer.trim()}
                className="rounded-lg bg-[#1B5E4B] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                {ft('forge.v2.submitToFacilitator')}
              </button>
            </>
          )}
          {reviewMode && (
            <>
              <button
                type="button"
                onClick={onApprove}
                className="inline-flex items-center gap-1 rounded-lg bg-[#1B5E4B] px-3 py-2 text-xs font-bold text-white"
              >
                <CheckCircle className="h-4 w-4" />
                {ft('forge.v2.approveMicroCaso')}
              </button>
              <button
                type="button"
                onClick={onReject}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-400 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800"
              >
                <XCircle className="h-4 w-4" />
                {ft('forge.v2.feriaRejectBtn')}
              </button>
            </>
          )}
          {isFacilitator && (
            <details className="w-full rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs">
              <summary className="font-bold cursor-pointer text-amber-900">{ft('forge.v2.rubricSummary')}</summary>
              <p className="mt-2 text-amber-950">{microCaso.validationRubric}</p>
            </details>
          )}
        </div>
      </div>
      <ForgeConsultancyModal
        open={consultOpen}
        balance={balance}
        teamPeers={teamPeers}
        myUserId={myUserId}
        stationLabel={showCapsula ? capsula?.title : undefined}
        capsulaBody={showCapsula ? capsula?.body : undefined}
        capsulaGuion={
          showCapsula && capsula && 'guion' in capsula ? (capsula.guion as string) : undefined
        }
        capsulaAccion={
          showCapsula && capsula && 'accion' in capsula ? (capsula.accion as string) : undefined
        }
        onClose={() => {
          setConsultOpen(false);
          setShowCapsula(false);
        }}
        onSelect={(id, peerUserId) => {
          if (id === 'ia_capsula') {
            setShowCapsula(true);
            return;
          }
          onConsultancy(id, peerUserId);
          setConsultOpen(false);
        }}
      />
    </div>
  );
}

function cnHeader(header: string) {
  return `px-4 py-2 ${header}`;
}
