'use client';

import {
  ClipboardList,
  DoorOpen,
  Eye,
  Monitor,
  Play,
  RotateCcw,
  User,
  Gamepad2,
  Users,
} from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';
import { EXPEDICION_HALL_PANEL } from '@/lib/forge/expedicion-v2/theme';
import type { GamePhase } from '@/lib/forge/expedicion-v2/types';
import type { ExpedicionV2PlayerState } from '@/lib/forge/expedicion-v2/types';

function ActionBtn({
  icon,
  title,
  hint,
  onClick,
  disabled,
  variant = 'default',
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'table' | 'quizPre' | 'quizPost';
}) {
  const styles = {
    default: 'border-white/30 bg-white/10 hover:bg-white/15 text-white',
    table: 'border-[#5FAE4A]/60 bg-[#5FAE4A] hover:bg-[#4F9E3A] text-[#0D4535]',
    quizPre: 'border-[#6EC4E8]/80 bg-[#6EC4E8] hover:bg-[#5AB8DC] text-[#1A3D5C]',
    quizPost: 'border-[#2E5C9A]/80 bg-[#2E5C9A] hover:bg-[#254D85] text-white',
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left transition w-full',
        styles[variant],
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg',
          variant === 'default' ? 'bg-black/20' : 'bg-black/10'
        )}
      >
        {icon}
      </span>
      <span className="font-black text-sm">{title}</span>
      <span className="text-xs opacity-90 leading-snug">{hint}</span>
    </button>
  );
}

export function ForgeExpedicionLobby({
  phase,
  isFacilitator,
  teamMode,
  v2,
  onGoToTable,
  onOpenQuiz,
  onPreviewQuiz,
  onPresentation,
  onFacOpenPreQuiz,
  onFacOpenPostQuiz,
  onFacRestart,
  onShowProfile,
  profileOpen,
  quizPreAvailable,
  quizPostAvailable,
  canResume,
}: {
  phase: GamePhase;
  isFacilitator: boolean;
  teamMode: boolean;
  v2: ExpedicionV2PlayerState | null;
  onGoToTable: () => void;
  onOpenQuiz: (side: 'pre' | 'post') => void;
  onPreviewQuiz: (side: 'pre' | 'post') => void;
  onPresentation?: () => void;
  onFacOpenPreQuiz?: () => void;
  onFacOpenPostQuiz?: () => void;
  onFacRestart?: () => void;
  onShowProfile?: () => void;
  profileOpen?: boolean;
  quizPreAvailable: boolean;
  quizPostAvailable: boolean;
  canResume: boolean;
}) {
  const ft = useForgeT();

  return (
    <div className={cn('mx-auto w-full max-w-lg p-4 md:p-5 space-y-5', EXPEDICION_HALL_PANEL)}>
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#C9A227]/60 bg-[#C9A227]/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
          <DoorOpen className="h-3.5 w-3.5 text-[#C9A227]" />
          {ft('forge.v2.lobbyTitle')}
        </div>
        <h2 className="text-xl font-black text-white">
          {isFacilitator ? ft('forge.v2.lobbySessionHeading') : ft('forge.v2.lobbyParticipantHeading')}
        </h2>
        <p className="text-sm text-white/85">
          {isFacilitator ? ft('forge.v2.lobbySessionHint') : ft('forge.v2.lobbyParticipantHint')}
        </p>
        {teamMode && (
          <p className="text-xs text-[#A8D5C4] font-semibold flex items-center justify-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {ft('forge.v2.lobbyTeamHint')}
          </p>
        )}
      </div>

      {!isFacilitator && v2 && onShowProfile && (
        <div className="rounded-xl border border-white/25 bg-[#0D4535]/50 p-3">
          <button
            type="button"
            onClick={onShowProfile}
            className="flex w-full items-center gap-2 text-left"
          >
            <User className="h-5 w-5 text-[#C9A227]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{ft('forge.v2.lobbyMyProfile')}</p>
              <p className="text-[10px] text-white/75 truncate">
                {ft(`forge.v2.phase.${phase}`)} · {ft('forge.v2.eco', { n: v2.ledger.balance })}
                {' · '}
                {ft('forge.v2.postIts', { n: v2.constructionMap.postIts.length })}
              </p>
            </div>
          </button>
          {profileOpen && (
            <div className="mt-3 border-t border-white/15 pt-3 text-xs text-white/85 space-y-1">
              <p>
                {ft('forge.v2.cycle', {
                  current: Math.min(v2.cyclesCompleted + 1, v2.maxCycles),
                  max: v2.maxCycles,
                })}
              </p>
              {(v2.impactPoints ?? 0) > 0 && (
                <p>{ft('forge.v2.impact', { n: v2.impactPoints ?? 0 })}</p>
              )}
              {v2.finalScore != null && <p>{ft('forge.v2.score', { n: v2.finalScore })}</p>}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {canResume && (
          <ActionBtn
            variant="table"
            icon={<Gamepad2 className="h-5 w-5" />}
            title={ft('forge.v2.lobbyResumeTable')}
            hint={ft('forge.v2.lobbyResumeTableHint')}
            onClick={onGoToTable}
          />
        )}

        <ActionBtn
          variant="quizPre"
          icon={<ClipboardList className="h-5 w-5" />}
          title={ft('forge.v2.lobbyTilePreQuiz')}
          hint={
            quizPreAvailable
              ? ft('forge.v2.lobbyTilePreQuizOpen')
              : isFacilitator
                ? ft('forge.v2.lobbyTilePreQuizPreview')
                : ft('forge.v2.lobbyTilePreQuizWait')
          }
          disabled={!isFacilitator && !quizPreAvailable}
          onClick={() => {
            if (isFacilitator && !quizPreAvailable) onPreviewQuiz('pre');
            else onOpenQuiz('pre');
          }}
        />

        {(phase === 'post_quiz' || quizPostAvailable || isFacilitator) && (
          <ActionBtn
            variant="quizPost"
            icon={<ClipboardList className="h-5 w-5" />}
            title={ft('forge.v2.lobbyTilePostQuiz')}
            hint={
              quizPostAvailable
                ? ft('forge.v2.lobbyTilePostQuizOpen')
                : isFacilitator
                  ? ft('forge.v2.lobbyTilePostQuizPreview')
                  : ft('forge.v2.lobbyTilePostQuizWait')
            }
            disabled={!isFacilitator && !quizPostAvailable}
            onClick={() => {
              if (isFacilitator && !quizPostAvailable) onPreviewQuiz('post');
              else onOpenQuiz('post');
            }}
          />
        )}

        {isFacilitator && onPresentation && (
          <ActionBtn
            icon={<Monitor className="h-5 w-5" />}
            title={ft('forge.v2.presentationMode')}
            hint={ft('forge.v2.lobbyPresentationHint')}
            onClick={onPresentation}
          />
        )}
      </div>

      {isFacilitator && (
        <div className="rounded-xl border border-white/20 bg-[#0D4535]/40 p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#C9A227]">
            {ft('forge.v2.lobbyFacControls')}
          </p>
          <div className="flex flex-wrap gap-2">
            {phase === 'lobby' && onFacOpenPreQuiz && (
              <button
                type="button"
                onClick={onFacOpenPreQuiz}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#6EC4E8] px-3 py-2 text-xs font-bold text-[#1A3D5C] hover:bg-[#5AB8DC]"
              >
                <Play className="h-3.5 w-3.5" />
                {ft('forge.v2.lobbyFacOpenPreQuizAll')}
              </button>
            )}
            {phase !== 'finished' && onFacOpenPostQuiz && (
              <button
                type="button"
                onClick={onFacOpenPostQuiz}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2E5C9A] px-3 py-2 text-xs font-bold text-white hover:bg-[#254D85]"
              >
                <Play className="h-3.5 w-3.5" />
                {ft('forge.v2.lobbyFacOpenPostQuizAll')}
              </button>
            )}
            {onFacRestart && (
              <button
                type="button"
                onClick={onFacRestart}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/60 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-950/60"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {ft('forge.v2.lobbyFacRestart')}
              </button>
            )}
            <button
              type="button"
              onClick={() => onPreviewQuiz('pre')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
            >
              <Eye className="h-3.5 w-3.5" />
              {ft('forge.v2.lobbyPreviewPreQuiz')}
            </button>
          </div>
        </div>
      )}

      {!isFacilitator && phase === 'lobby' && !quizPreAvailable && !canResume && (
        <p className="text-center text-xs text-white/70">{ft('forge.v2.lobbyLearnerWait')}</p>
      )}
    </div>
  );
}
