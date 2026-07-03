'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { X, Users, HelpCircle, ShieldAlert, Presentation } from 'lucide-react';
import { ForgeGameBoard, type ForgeGameSyncMode } from '@/components/forge/ForgeGameBoard';
import { ForgePresentationViewer } from '@/components/forge/ForgePresentationViewer';
import { ForgePersonalMapStrip } from '@/components/forge/ForgePersonalMapStrip';
import { ForgeActivityPlayer } from '@/components/forge/ForgeActivityPlayer';
import { ForgeInviteLearners } from '@/components/forge/ForgeInviteLearners';
import {
  isJitsiEmbeddable,
  jitsiEmbedUrl,
  resolveMeetingUrl,
  type ForgeLiveConfig,
} from '@/lib/forge/delivery';
import { canEmbedJitsiInIframe } from '@/lib/forge/jitsi-config';
import type { ExpedicionSlide } from '@/lib/forge/expedicion-presentacion-slides';
import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import type { JourneyMapState } from '@/lib/forge/learner-journey-types';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';
import { ForgeFloatingJitsi } from '@/components/forge/ForgeFloatingJitsi';
import { ForgeGameCoach } from '@/components/forge/ForgeGameCoach';
import { ForgeGameManualButton, ForgeGameManualModal } from '@/components/forge/ForgeGameManual';
import { parseMulti, currentPlayer, type BoardGuide } from '@/lib/forge/expedicion-board-multi';
import { readPresentationSlideIndex } from '@/lib/forge/room-presentation';
import {
  cardsForStation,
  stationSlugForSpace,
  EXPEDICION_STATION_SLUGS,
  type ExpedicionStationSlug,
} from '@/lib/forge/expedicion-station-decks';
import { ForgeInvestmentPanel } from '@/components/forge/ForgeInvestmentPanel';
import { useExpedicionV2 } from '@/lib/forge/expedicion-v2/useExpedicionV2';
import { ForgeMaturityQuizGate } from '@/components/forge/ForgeMaturityQuizGate';
import { ForgeSustainabilityDashboard } from '@/components/forge/ForgeSustainabilityDashboard';
import { ForgeExpedicionV2Workspace } from '@/components/forge/ForgeExpedicionV2Workspace';
import { ForgeMicroCasoPanel } from '@/components/forge/ForgeMicroCasoPanel';
import { drawRandomMicroCaso } from '@/lib/forge/expedicion-v2/content';
import { EXPEDICION_V2_SHELL } from '@/lib/forge/expedicion-v2/theme';
import type { MicroCaso } from '@/lib/forge/expedicion-v2/content';

/** Diapositiva PPT → índice do módulo (quiz da cápsula). */
const SLIDE_TO_MODULE: Record<number, number> = {
  3: 1,
  4: 2,
  5: 3,
  6: 4,
  7: 5,
};

type LearnerRow = {
  userId: string;
  name: string | null;
  email: string | null;
  progressPercent: number;
  stationsCompleted: number;
  stationTotal: number;
};

type ModuleRow = {
  id: string;
  title: string;
  activities: { id: string; type: string; title: string; config?: Record<string, unknown> }[];
};

type Props = {
  courseId: string;
  courseTitle: string;
  role: 'facilitator' | 'learner';
  liveConfig: ForgeLiveConfig;
  jitsiBaseUrl?: string;
  presentationSlides: ExpedicionSlide[];
  presentationPdfUrl?: string | null;
  presentationEmbedUrl?: string | null;
  gameActivityId: string | null;
};

export function ForgeExpedicionRoom({
  courseId,
  courseTitle,
  role,
  liveConfig,
  jitsiBaseUrl,
  presentationSlides,
  presentationPdfUrl,
  presentationEmbedUrl,
  gameActivityId,
}: Props) {
  const ft = useForgeT();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const liveSessionId = searchParams.get('session')?.trim() || null;
  const playGroupId = searchParams.get('group')?.trim() || null;
  const isFac = role === 'facilitator';
  const myUserId = session?.user?.id;
  const [facEmergency, setFacEmergency] = useState(false);
  const [coachGuide, setCoachGuide] = useState<BoardGuide | null>(null);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [myMap, setMyMap] = useState<JourneyMapState | null>(null);
  const [gameSpec, setGameSpec] = useState<GameSpecV1 | null>(null);
  const [gameState, setGameState] = useState<Record<string, unknown>>({});
  const [sharedRoomId, setSharedRoomId] = useState<string | null>(null);
  const [roomVersion, setRoomVersion] = useState(0);
  const [syncMode, setSyncMode] = useState<ForgeGameSyncMode | 'pending'>('pending');
  const [boardBusy, setBoardBusy] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);
  const [quizOpen, setQuizOpen] = useState(false);
  const [showDeck, setShowDeck] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [groupMode, setGroupMode] = useState<'live_team' | 'individual_coaching'>('live_team');
  const [investStation, setInvestStation] = useState<ExpedicionStationSlug | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [slidesOpen, setSlidesOpen] = useState(false);
  const [v2MapOpen, setV2MapOpen] = useState(false);
  const [activeMicroCaso, setActiveMicroCaso] = useState<MicroCaso | null>(null);
  const { v2, videoEnabled, sessionFormat, patch: patchV2 } = useExpedicionV2(courseId);
  const booted = useRef(false);
  const slideSyncRef = useRef(0);
  const isCoaching = groupMode === 'individual_coaching';

  const jitsiUrl = useMemo(
    () => resolveMeetingUrl(liveConfig, courseId, 'learner', null, jitsiBaseUrl),
    [liveConfig, courseId, jitsiBaseUrl]
  );
  const jitsiSrc =
    videoEnabled &&
    jitsiUrl &&
    isJitsiEmbeddable(jitsiUrl) &&
    canEmbedJitsiInIframe(jitsiUrl)
      ? jitsiEmbedUrl(jitsiUrl, { tileView: true })
      : null;

  const roomQuery = useMemo(() => {
    const p = new URLSearchParams({ activityId: gameActivityId ?? '' });
    if (liveSessionId) p.set('liveSessionId', liveSessionId);
    if (playGroupId) p.set('playGroupId', playGroupId);
    return p.toString();
  }, [gameActivityId, liveSessionId, playGroupId]);

  const currentSlide = presentationSlides[slideIdx];
  const capsuleModuleIdx = currentSlide ? SLIDE_TO_MODULE[currentSlide.n] : undefined;
  const capsuleQuiz =
    capsuleModuleIdx != null
      ? modules[capsuleModuleIdx]?.activities.find((a) => a.type === 'quiz')
      : null;

  const loadSpec = useCallback(async () => {
    if (!gameActivityId) return null;
    const act = await fetch(`/api/forge/activities/${gameActivityId}`).then((r) => r.json());
    const specId = act.activity?.gameSpecId as string | undefined;
    if (!specId) return null;
    const gs = await fetch(`/api/forge/game-specs/${specId}`).then((r) => r.json());
    return (gs.gameSpec?.definition as GameSpecV1) ?? null;
  }, [gameActivityId]);

  const setBoardSyncFromState = useCallback(
    (rawState: Record<string, unknown>, isHost: boolean) => {
      const multi = parseMulti(rawState);
      const cur = multi ? currentPlayer(multi) : null;
      if (isFac) {
        setSyncMode(facEmergency ? 'host' : 'facilitator');
      } else if (multi?.teamPlay && myUserId && multi.teamMemberIds?.includes(myUserId)) {
        setSyncMode('player');
      } else if (multi && cur && myUserId && cur.userId === myUserId) {
        setSyncMode('player');
      } else {
        setSyncMode('viewer');
      }
      if (multi?.guide) setCoachGuide(multi.guide);
    },
    [isFac, myUserId, facEmergency]
  );

  const loadBoard = useCallback(async () => {
    if (!gameActivityId) return;
    const spec = await loadSpec();
    const res = await fetch(`/api/forge/shared-game-rooms?${roomQuery}`);
    const d = await res.json();
    if (d.room && spec) {
      setSharedRoomId(d.room.id);
      setRoomVersion(d.room.version);
      setGameSpec(spec);
      setGameState(d.room.state);
      setBoardSyncFromState(d.room.state, d.isHost);
      const idx = readPresentationSlideIndex(d.room.state as Record<string, unknown>);
      slideSyncRef.current = idx;
      setSlideIdx(idx);
    }
  }, [gameActivityId, loadSpec, roomQuery, setBoardSyncFromState]);

  const startBoard = useCallback(async () => {
    if (!gameActivityId || !isFac) return;
    setBoardBusy(true);
    try {
      const spec = await loadSpec();
      const res = await fetch('/api/forge/shared-game-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: gameActivityId,
          liveSessionId,
          playGroupId,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.error || ft('forge.general.error'));
        return;
      }
      setSharedRoomId(d.room.id);
      setRoomVersion(d.room.version);
      setGameSpec((d.spec as GameSpecV1) ?? spec);
      setGameState(d.room.state);
      setBoardSyncFromState(d.room.state, true);
    } finally {
      setBoardBusy(false);
    }
  }, [gameActivityId, isFac, loadSpec, ft, liveSessionId, playGroupId, setBoardSyncFromState]);

  useEffect(() => {
    if (!playGroupId) {
      setGroupMode('live_team');
      return;
    }
    fetch(`/api/forge/play-groups/${playGroupId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.group?.mode === 'individual_coaching') setGroupMode('individual_coaching');
        else setGroupMode('live_team');
      })
      .catch(() => setGroupMode('live_team'));
  }, [playGroupId]);

  const syncSlideToRoom = useCallback(
    async (index: number) => {
      if (!sharedRoomId || !isFac) return;
      await fetch(`/api/forge/shared-game-rooms/${sharedRoomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presentationSlideIndex: index }),
      });
    },
    [sharedRoomId, isFac]
  );

  const setSlideIdxSynced = useCallback(
    (next: number | ((i: number) => number)) => {
      setSlideIdx((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        if (isFac && sharedRoomId) void syncSlideToRoom(value);
        return value;
      });
    },
    [isFac, sharedRoomId, syncSlideToRoom]
  );

  useEffect(() => {
    fetch(`/api/forge/courses/${courseId}`)
      .then((r) => r.json())
      .then((d) => setModules(d.course?.modules ?? []))
      .catch(() => {});
    if (isFac) {
      fetch(`/api/forge/courses/${courseId}/learners?maps=1`)
        .then((r) => r.json())
        .then((d) => setLearners(d.learners ?? []))
        .catch(() => {});
    } else {
      fetch(`/api/forge/courses/${courseId}/my-journey`)
        .then((r) => r.json())
        .then((d) => d.journey?.mapState && setMyMap(d.journey.mapState))
        .catch(() => {});
    }
  }, [courseId, isFac]);

  useEffect(() => {
    if (!gameActivityId || booted.current) return;
    booted.current = true;
    (async () => {
      const res = await fetch(`/api/forge/shared-game-rooms?${roomQuery}`);
      const d = await res.json();
      if (d.room) await loadBoard();
      else if (isFac) await startBoard();
      else setSyncMode('viewer');
    })();
  }, [gameActivityId, isFac, loadBoard, startBoard, roomQuery]);

  useEffect(() => {
    if (sharedRoomId || isFac || !gameActivityId) return;
    const wait = setInterval(async () => {
      const res = await fetch(`/api/forge/shared-game-rooms?${roomQuery}`);
      const d = await res.json();
      if (d.room?.id) {
        setSharedRoomId(d.room.id);
        setRoomVersion(d.room.version);
        setGameState(d.room.state);
        const idx = readPresentationSlideIndex(d.room.state as Record<string, unknown>);
        slideSyncRef.current = idx;
        setSlideIdx(idx);
        if (!isCoaching) setBoardSyncFromState(d.room.state, false);
      }
    }, 3000);
    return () => clearInterval(wait);
  }, [sharedRoomId, isFac, gameActivityId, roomQuery, isCoaching, setBoardSyncFromState]);

  useEffect(() => {
    if (!sharedRoomId) return;
    const poll = async () => {
      const res = await fetch(`/api/forge/shared-game-rooms/${sharedRoomId}`);
      const d = await res.json();
      if (res.ok && d.room) {
        setGameState(d.room.state);
        setRoomVersion(d.room.version);
        setBoardSyncFromState(d.room.state, isFac);
        const remoteSlide = readPresentationSlideIndex(d.room.state as Record<string, unknown>);
        if (!isFac && remoteSlide !== slideSyncRef.current) {
          slideSyncRef.current = remoteSlide;
          setSlideIdx(remoteSlide);
        }
      }
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [sharedRoomId, isFac, setBoardSyncFromState]);

  useEffect(() => {
    if (!gameState) return;
    const g = parseMulti(gameState)?.guide;
    if (g) setCoachGuide(g);
  }, [gameState]);

  const card = (gameState as { currentCard?: { prompt?: string; reflection?: string; id?: string } })
    ?.currentCard;

  const multi = parseMulti(gameState);
  const myPosition =
    multi && myUserId
      ? multi.players.find((p) => p.userId === myUserId)?.position
      : typeof (gameState as { position?: number }).position === 'number'
        ? (gameState as { position: number }).position
        : undefined;
  const stationSlug = typeof myPosition === 'number' ? stationSlugForSpace(myPosition) : null;

  useEffect(() => {
    if (!stationSlug || isFac) return;
    const mc = drawRandomMicroCaso(stationSlug);
    if (mc) setActiveMicroCaso(mc);
  }, [stationSlug, isFac, myPosition]);

  const boardBlocked = v2?.phase === 'pre_quiz' || v2?.phase === 'post_quiz' || v2?.phase === 'finished';

  const deckByStation = useMemo(() => {
    if (!gameSpec?.cards) return [];
    return EXPEDICION_STATION_SLUGS.map((slug) => ({
      slug,
      cards: cardsForStation(gameSpec.cards!, slug),
    })).filter((s) => s.cards.length > 0);
  }, [gameSpec?.cards]);

  return (
    <div className={cn('fixed inset-0 z-50 flex flex-col text-slate-900', EXPEDICION_V2_SHELL)}>
      {v2?.phase === 'pre_quiz' && (
        <ForgeMaturityQuizGate
          side="pre"
          onComplete={async (answers) => {
            await patchV2({ action: 'complete_pre_quiz', answers });
          }}
        />
      )}
      {v2?.phase === 'post_quiz' && (
        <ForgeMaturityQuizGate
          side="post"
          onComplete={async (answers) => {
            await patchV2({ action: 'complete_post_quiz', answers });
          }}
        />
      )}
      <header className="flex shrink-0 items-center gap-3 border-b border-[#1B5E4B]/20 bg-[#1B5E4B] px-3 py-2 text-white shadow-md">
        <Link
          href={`/hub/forge/cursos/${courseId}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
          title={ft('forge.room.exit')}
        >
          <X className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#F4B942]">
            {ft('forge.room.brand')}
            {sessionFormat === 'presencial' && (
              <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-[9px]">Presencial</span>
            )}
          </p>
          <h1 className="truncate text-sm font-black md:text-base">{courseTitle}</h1>
        </div>
        <ForgeGameManualButton onOpen={() => setManualOpen(true)} />
        {presentationSlides.length > 0 && (
          <button
            type="button"
            onClick={() => setSlidesOpen((v) => !v)}
            className={cn(
              'rounded-lg border px-2 py-1 text-[10px] font-bold flex items-center gap-1',
              slidesOpen ? 'border-violet-400 bg-violet-900 text-violet-100' : 'border-slate-700 hover:bg-slate-800'
            )}
          >
            <Presentation className="h-3 w-3" />
            {ft('forge.room.slides')}
            {isFac && ` ${slideIdx + 1}/${presentationSlides.length}`}
          </button>
        )}
        <button
          type="button"
          onClick={() => setV2MapOpen((v) => !v)}
          className={cn(
            'rounded-lg border px-2 py-1 text-[10px] font-bold',
            v2MapOpen ? 'border-[#F4B942] bg-[#F4B942]/20' : 'border-white/30 hover:bg-white/10'
          )}
        >
          Mapa + Finanzas
        </button>
        <Link
          href={`/hub/forge/cursos/${courseId}/mi-mapa`}
          className="rounded-lg border border-white/30 px-2 py-1 text-[10px] font-bold hover:bg-white/10"
        >
          {ft('forge.room.myMap')}
        </Link>
        <Link
          href={`/hub/forge/cursos/${courseId}/turmas`}
          className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-bold hover:bg-slate-800"
        >
          {ft('forge.tutorLobby.short')}
        </Link>
        {isFac && (
          <>
            <button
              type="button"
              onClick={() => setFacEmergency((v) => !v)}
              className={cn(
                'rounded-lg border px-2 py-1 text-[10px] font-bold flex items-center gap-1',
                facEmergency
                  ? 'border-amber-400 bg-amber-900 text-amber-100'
                  : 'border-slate-700 hover:bg-slate-800'
              )}
            >
              <ShieldAlert className="h-3 w-3" />
              {ft('forge.room.emergency')}
            </button>
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-bold hover:bg-slate-800"
            >
              {ft('forge.room.invites')}
            </button>
            <button
              type="button"
              onClick={() => setShowDeck((v) => !v)}
              className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-bold"
            >
              {ft('forge.room.deck')}
            </button>
            {stationSlug && (
              <button
                type="button"
                onClick={() => setInvestStation(stationSlug)}
                className="rounded-lg border border-emerald-600 px-2 py-1 text-[10px] font-bold text-emerald-300"
              >
                {ft('forge.room.investments')}
              </button>
            )}
          </>
        )}
      </header>

      {videoEnabled && <ForgeFloatingJitsi embedSrc={jitsiSrc} fallbackUrl={jitsiUrl} />}
      <ForgeGameCoach guide={coachGuide} knowledge={null} />
      <ForgeGameManualModal open={manualOpen} onClose={() => setManualOpen(false)} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {slidesOpen && presentationSlides.length > 0 && (
          <aside className="w-full max-w-sm shrink-0 border-r border-slate-800 bg-slate-900 overflow-y-auto z-10 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 px-2 py-2">
              {isFac && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setSlideIdxSynced((i) => Math.max(0, i - 1))}
                    disabled={slideIdx <= 0}
                    className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold disabled:opacity-40"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlideIdxSynced((i) => Math.min(presentationSlides.length - 1, i + 1))}
                    disabled={slideIdx >= presentationSlides.length - 1}
                    className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSlidesOpen(false)}
                className="ml-auto text-[10px] text-slate-400 hover:text-white"
              >
                {ft('forge.general.close')}
              </button>
            </div>
            <ForgePresentationViewer
              slides={presentationSlides}
              pdfUrl={presentationPdfUrl}
              embedUrl={presentationEmbedUrl}
              compact
              audienceMode
              slideIndex={slideIdx}
              onSlideIndexChange={isFac ? setSlideIdxSynced : undefined}
            />
            {capsuleQuiz && isFac && (
              <button
                type="button"
                onClick={() => setQuizOpen(true)}
                className="m-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold"
              >
                {ft('forge.room.openQuiz')} — {capsuleQuiz.title}
              </button>
            )}
          </aside>
        )}

        {v2MapOpen && (
          <aside className="w-full max-w-md shrink-0 border-r border-[#1B5E4B]/15 bg-white/90 overflow-y-auto z-10 p-3">
            <ForgeExpedicionV2Workspace courseId={courseId} readOnly={isFac} />
          </aside>
        )}

        <main className="flex-1 flex flex-col min-w-0 min-h-0 p-2 md:p-3 gap-2">
          {isCoaching && (
            <p className="text-center text-xs text-violet-300 shrink-0">{ft('forge.room.coachingHint')}</p>
          )}

          {card?.prompt && (
            <div className="shrink-0 rounded-lg border border-amber-400/50 bg-amber-950/60 px-3 py-2 max-h-24 overflow-y-auto">
              <p className="text-[10px] font-bold uppercase text-amber-300">
                {isFac ? ft('forge.room.cardFac') : ft('forge.room.cardLearner')}
              </p>
              <p className="text-sm font-semibold text-amber-50 line-clamp-2">{card.prompt}</p>
            </div>
          )}

          {activeMicroCaso && stationSlug && v2 && !boardBlocked && (
            <div className="shrink-0">
              <ForgeMicroCasoPanel
                microCaso={activeMicroCaso}
                station={stationSlug}
                balance={v2.ledger.balance}
                isFacilitator={isFac}
                onConsultancy={async (optionId) => {
                  await patchV2({ action: 'consultancy', optionId });
                }}
                onValidate={async () => {
                  await patchV2({
                    action: 'ledger_entry',
                    description: 'Premio estación (validación)',
                    entryType: 'E',
                    amount: 200,
                    meta: { kind: 'station_prize', microCasoId: activeMicroCaso.id },
                  });
                  setActiveMicroCaso(null);
                }}
              />
            </div>
          )}

          {v2?.phase === 'finished' && v2.finalScoreBreakdown && (
            <div className="shrink-0">
              <ForgeSustainabilityDashboard breakdown={v2.finalScoreBreakdown} />
            </div>
          )}

          <div className="flex-1 flex flex-col min-h-0 justify-center">
            {!isCoaching && !boardBlocked ? (
              gameSpec && syncMode !== 'pending' ? (
                <div className="flex flex-col h-full min-h-0 [&_.rounded-xl]:bg-transparent">
                  <ForgeGameBoard
                    spec={gameSpec}
                    initialState={gameState}
                    syncMode={syncMode}
                    roomId={sharedRoomId ?? undefined}
                    roomVersion={roomVersion}
                    myUserId={myUserId}
                    isFacilitator={isFac}
                    facilitatorEmergency={facEmergency}
                    onGuideChange={(g) => setCoachGuide(g)}
                    onRoomState={(s) => setGameState(s as Record<string, unknown>)}
                  />
                </div>
              ) : (
                <p className="text-center text-sm text-amber-200 py-12">
                  {boardBusy ? ft('forge.general.loading') : ft('forge.room.waitingBoard')}
                </p>
              )
            ) : (
              myMap && <ForgePersonalMapStrip mapState={myMap} />
            )}
          </div>
          {boardBlocked && v2?.phase !== 'finished' && (
            <p className="text-center text-sm text-[#1B5E4B] font-semibold py-8">
              Completa el Quiz de Madurez para continuar.
            </p>
          )}

          {myMap && !isCoaching && (
            <div className="shrink-0 max-h-28 overflow-hidden">
              <ForgePersonalMapStrip mapState={myMap} />
            </div>
          )}

          {investStation && (
            <ForgeInvestmentPanel station={investStation} onClose={() => setInvestStation(null)} />
          )}

          {isFac && showDeck && gameSpec?.cards && (
            <div className="shrink-0 rounded-lg border border-slate-600 bg-slate-900/90 p-2 max-h-32 overflow-y-auto text-xs">
              {deckByStation.map(({ slug, cards }) => (
                <p key={slug} className="text-slate-400">
                  <span className="text-emerald-400 font-bold">{slug}</span>: {cards.length} cartas
                </p>
              ))}
            </div>
          )}
        </main>
      </div>

      {quizOpen && capsuleQuiz && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white text-slate-900 p-5 shadow-2xl">
            <div className="flex justify-between items-start gap-2">
              <h3 className="font-black text-lg">{capsuleQuiz.title}</h3>
              <button type="button" onClick={() => setQuizOpen(false)} className="text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5" />
              {isFac ? ft('forge.room.quizFacHint') : ft('forge.room.quizLearnerHint')}
            </p>
            {isFac ? (
              <ul className="mt-4 space-y-4">
                {((capsuleQuiz.config?.questions as { prompt: string; options: string[]; correctIndex: number }[]) ?? []).map(
                  (q, i) => (
                    <li key={i} className="rounded-lg border border-slate-200 p-3">
                      <p className="font-semibold text-sm">{q.prompt}</p>
                      <ol className="mt-2 list-decimal list-inside text-sm text-slate-600 space-y-0.5">
                        {q.options.map((o, j) => (
                          <li key={j} className={j === q.correctIndex ? 'text-emerald-700 font-bold' : ''}>
                            {o}
                          </li>
                        ))}
                      </ol>
                    </li>
                  )
                )}
              </ul>
            ) : (
              <div className="mt-4">
                <ForgeActivityPlayer
                  activity={{
                    id: capsuleQuiz.id,
                    type: 'quiz',
                    title: capsuleQuiz.title,
                    config: capsuleQuiz.config ?? {},
                  }}
                  courseId={courseId}
                  deliveryMode="live"
                  onDone={() => setQuizOpen(false)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {inviteOpen && isFac && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white text-slate-900 p-5 shadow-2xl">
            <div className="flex justify-between items-start gap-2 mb-4">
              <h3 className="font-black text-lg">{ft('forge.room.invites')}</h3>
              <button type="button" onClick={() => setInviteOpen(false)} className="text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ForgeInviteLearners courseId={courseId} />
          </div>
        </div>
      )}
    </div>
  );
}
