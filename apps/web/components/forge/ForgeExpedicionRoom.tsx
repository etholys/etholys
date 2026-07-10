'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Users, HelpCircle, X } from 'lucide-react';
import { ForgeGameBoard, type ForgeGameSyncMode } from '@/components/forge/ForgeGameBoard';
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
import { ForgeGameManualModal } from '@/components/forge/ForgeGameManual';
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
import { ForgeExpedicionLobby } from '@/components/forge/ForgeExpedicionLobby';
import { ForgeExpedicionTableDock } from '@/components/forge/ForgeExpedicionTableDock';
import { ForgePresentationView } from '@/components/forge/ForgePresentationView';
import {
  ForgeFacilitatorLensBar,
  type FacilitatorLens,
} from '@/components/forge/ForgeFacilitatorLensBar';
import { ForgeSustainabilityDashboard } from '@/components/forge/ForgeSustainabilityDashboard';
import { ForgeMicroCasoPanel } from '@/components/forge/ForgeMicroCasoPanel';
import { drawRandomMicroCaso, getMicroCasoById } from '@/lib/forge/expedicion-v2/content';
import { EXPEDICION_V2_SHELL } from '@/lib/forge/expedicion-v2/theme';
import type { MicroCaso } from '@/lib/forge/expedicion-v2/content';
import {
  resolveBoardLandEvent,
  type BoardLandEvent,
} from '@/lib/forge/expedicion-v2/board-land-events';
import { applyLedgerDrafts, impactPointsFromBoardEvents, ledgerDraftsFromBoardEvents } from '@/lib/forge/expedicion-v2/board-ledger-sync';
import { ForgeEventCardPanel } from '@/components/forge/ForgeEventCardPanel';
import { ForgeExpedicionCycleBar } from '@/components/forge/ForgeExpedicionCycleBar';
import { ForgeExpedicionRoomHeader } from '@/components/forge/ForgeExpedicionRoomHeader';
import { ForgeExpedicionSessionStrip } from '@/components/forge/ForgeExpedicionSessionStrip';
import { ForgeExpedicionFacConsole } from '@/components/forge/ForgeExpedicionFacConsole';
import { ForgeFeriaPanel } from '@/components/forge/ForgeFeriaPanel';
import { feriaEligible, feriaEligibilityHint } from '@/lib/forge/expedicion-v2/feria';
import type { TeamPeer } from '@/components/forge/ForgeConsultancyModal';

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
  const editionId = searchParams.get('editionId')?.trim() || null;
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
  const [roomView, setRoomView] = useState<'hall' | 'table' | 'presentation'>('hall');
  const [quizModal, setQuizModal] = useState<null | { side: 'pre' | 'post'; preview: boolean }>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [facLens, setFacLens] = useState<FacilitatorLens>({ kind: 'mine' });
  const [presentationRows, setPresentationRows] = useState<
    Array<{
      id: string;
      name: string;
      phase: string;
      balance: number;
      cyclesCompleted: number;
      maxCycles: number;
      impactPoints?: number;
      hasPendingMicroCaso?: boolean;
    }>
  >([]);
  const [activeMicroCaso, setActiveMicroCaso] = useState<MicroCaso | null>(null);
  const [landEvent, setLandEvent] = useState<BoardLandEvent | null>(null);
  const [cycleBusy, setCycleBusy] = useState(false);
  const [teamPeers, setTeamPeers] = useState<TeamPeer[]>([]);
  const [presencialHintDismissed, setPresencialHintDismissed] = useState(false);
  const lastBoardPosRef = useRef<number | null>(null);
  const multiBoot = parseMulti(gameState);
  const teamRoomId =
    multiBoot?.teamPlay && sharedRoomId ? sharedRoomId : null;
  const { v2, teamMode, videoEnabled, sessionFormat, patch: patchV2, reload: reloadV2 } = useExpedicionV2(
    courseId,
    { roomId: teamRoomId }
  );
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

  useEffect(() => {
    if (!playGroupId) {
      setTeamPeers([]);
      return;
    }
    fetch(`/api/forge/play-groups/${playGroupId}`)
      .then((r) => r.json())
      .then((d) => setTeamPeers(d.members ?? []))
      .catch(() => setTeamPeers([]));
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
  const boardPosition =
    multi?.teamPlay && typeof multi.position === 'number'
      ? multi.position
      : multi && myUserId
        ? multi.players.find((p) => p.userId === myUserId)?.position
        : typeof (gameState as { position?: number }).position === 'number'
          ? (gameState as { position: number }).position
          : multi?.players[0]?.position;
  const stationSlug = typeof boardPosition === 'number' ? stationSlugForSpace(boardPosition) : null;

  const handleBoardEvents = useCallback(
    async (events: Array<{ type?: string; message?: string; amount?: number }>) => {
      const drafts = ledgerDraftsFromBoardEvents(events);
      const impact = impactPointsFromBoardEvents(events);
      if (drafts.length) {
        await applyLedgerDrafts(courseId, drafts, teamRoomId);
      }
      if (impact > 0) {
        await patchV2({ action: 'add_impact', points: impact });
      }
      if (drafts.length || impact > 0) {
        await reloadV2();
      }
    },
    [courseId, reloadV2, teamRoomId, patchV2]
  );

  useEffect(() => {
    if (typeof boardPosition !== 'number' || isFac) return;
    if (lastBoardPosRef.current === boardPosition) return;
    lastBoardPosRef.current = boardPosition;
    const ev = resolveBoardLandEvent(boardPosition);
    if (ev.kind === 'estacion' && ev.station) {
      if (v2?.pendingMicroCaso && !isFac) {
        setLandEvent(null);
        return;
      }
      const mc = drawRandomMicroCaso(ev.station, v2?.completedMicroCasos ?? []);
      if (mc) setActiveMicroCaso(mc);
      setLandEvent(null);
    } else if (ev.kind === 'accion' || ev.kind === 'desafio') {
      setLandEvent(ev);
      setActiveMicroCaso(null);
    } else if (ev.kind === 'meta' && v2 && v2.phase === 'playing') {
      void (async () => {
        await patchV2({ action: 'end_cycle' });
        await reloadV2();
      })();
    } else {
      setLandEvent(null);
    }
  }, [boardPosition, isFac, v2?.phase, v2?.pendingMicroCaso, v2?.completedMicroCasos, patchV2, reloadV2]);

  const teamV2Active = Boolean(teamRoomId);
  const v2Phase = v2?.phase ?? 'lobby';
  const quizGate = v2?.quizGate ?? null;
  const facilitatorPersonalV2 = isFac && !teamV2Active;
  const effectivePhase = facilitatorPersonalV2 ? 'lobby' : v2Phase;

  const boardBlocked =
    !isFac && !facilitatorPersonalV2 && (effectivePhase === 'lobby' || effectivePhase === 'finished');

  const showHall = roomView === 'hall';
  const showTable = roomView === 'table';

  const quizPreAvailable = quizGate === 'pre';
  const quizPostAvailable = quizGate === 'post';

  const observeRoomId =
    isFac && facLens.kind === 'team' ? facLens.roomId : teamRoomId;
  const observeUserId = isFac && facLens.kind === 'learner' ? facLens.userId : null;
  const dockReadOnly = isFac && facLens.kind !== 'mine';
  const canResume = isFac || effectivePhase === 'playing' || quizPreAvailable || quizPostAvailable;

  const patchFacBatch = useCallback(
    async (action: string) => {
      await fetch(`/api/forge/courses/${courseId}/expedicion-v2`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await reloadV2();
    },
    [courseId, reloadV2]
  );

  const loadPresentationRows = useCallback(() => {
    if (!isFac) return;
    fetch(`/api/forge/courses/${courseId}/expedicion-v2/overview`)
      .then((r) => r.json())
      .then((d) => {
        const rows = [
          ...(d.teams ?? []).map((t: Record<string, unknown>) => ({
            id: String(t.roomId),
            name: String(t.name ?? 'Equipo'),
            phase: String(t.phase ?? 'lobby'),
            balance: Number(t.balance ?? 0),
            cyclesCompleted: Number(t.cyclesCompleted ?? 0),
            maxCycles: Number(t.maxCycles ?? 3),
            impactPoints: Number(t.impactPoints ?? 0),
            hasPendingMicroCaso: Boolean(t.hasPendingMicroCaso),
          })),
          ...(d.learners ?? []).map((l: Record<string, unknown>) => ({
            id: String(l.userId),
            name: String(l.name ?? 'Jugador'),
            phase: String(l.phase ?? 'lobby'),
            balance: Number(l.balance ?? 0),
            cyclesCompleted: 0,
            maxCycles: 3,
            impactPoints: Number(l.impactPoints ?? 0),
          })),
        ];
        setPresentationRows(rows);
      })
      .catch(() => {});
  }, [courseId, isFac]);

  useEffect(() => {
    setQuizModal(null);
  }, [courseId]);

  useEffect(() => {
    if (roomView === 'presentation') loadPresentationRows();
  }, [roomView, loadPresentationRows]);

  useEffect(() => {
    if (effectivePhase === 'playing' && !isFac && roomView === 'hall') {
      setRoomView('table');
    }
  }, [effectivePhase, isFac, roomView]);

  const pendingReview = v2?.pendingMicroCaso ?? null;
  const reviewMicroCaso = pendingReview ? getMicroCasoById(pendingReview.microCasoId) : null;
  const reviewStation = pendingReview?.station ?? null;

  const feriaSlideOpen = currentSlide?.n === 8;
  const showFeriaPanel =
    v2 &&
    !boardBlocked &&
    (feriaSlideOpen || Boolean(v2.pendingFeriaPitch) || v2.feriaAwarded);
  const feriaEligibleNow = v2 ? feriaEligible(v2.constructionMap) : false;

  const deckByStation = useMemo(() => {
    if (!gameSpec?.cards) return [];
    return EXPEDICION_STATION_SLUGS.map((slug) => ({
      slug,
      cards: cardsForStation(gameSpec.cards!, slug),
    })).filter((s) => s.cards.length > 0);
  }, [gameSpec?.cards]);

  return (
    <div className={cn('fixed inset-0 z-50 flex flex-col text-slate-900', EXPEDICION_V2_SHELL)}>
      {quizModal && (
        <ForgeMaturityQuizGate
          side={quizModal.side}
          preview={quizModal.preview}
          onClose={() => setQuizModal(null)}
          onComplete={async (answers) => {
            if (quizModal.preview) {
              setQuizModal(null);
              return;
            }
            const action =
              quizModal.side === 'pre' ? 'complete_pre_quiz' : 'complete_post_quiz';
            await patchV2({ action, answers });
            setQuizModal(null);
            if (quizModal.side === 'pre') setRoomView('table');
          }}
        />
      )}
      {roomView === 'presentation' && isFac && (
        <ForgePresentationView
          courseTitle={courseTitle}
          slides={presentationSlides}
          pdfUrl={presentationPdfUrl}
          embedUrl={presentationEmbedUrl}
          slideIndex={slideIdx}
          onSlideIndexChange={setSlideIdxSynced}
          liveRows={presentationRows}
          onClose={() => setRoomView('hall')}
        />
      )}
      <ForgeExpedicionRoomHeader
        courseId={courseId}
        courseTitle={courseTitle}
        roomView={roomView}
        onRoomViewChange={setRoomView}
        onOpenPresentation={() => {
          loadPresentationRows();
          setRoomView('presentation');
        }}
        onOpenManual={() => setManualOpen(true)}
        isFac={isFac}
        sessionFormat={sessionFormat}
        v2Phase={v2?.phase}
        v2Balance={v2?.ledger.balance}
        teamMode={teamMode}
        facEmergency={facEmergency}
        onToggleEmergency={() => setFacEmergency((v) => !v)}
        onToggleInvite={() => setInviteOpen(true)}
        onToggleDeck={() => setShowDeck((v) => !v)}
        showInvest={Boolean(stationSlug && v2)}
        stationSlug={stationSlug}
        onOpenInvest={stationSlug ? () => setInvestStation(stationSlug) : undefined}
      />

      {videoEnabled && <ForgeFloatingJitsi embedSrc={jitsiSrc} fallbackUrl={jitsiUrl} />}
      <ForgeGameCoach guide={coachGuide} knowledge={null} />
      <ForgeGameManualModal open={manualOpen} onClose={() => setManualOpen(false)} />

      <div className="flex flex-1 min-h-0 overflow-hidden flex-col">
        {roomView !== 'presentation' && (
        <main className="flex flex-1 flex-col min-w-0 min-h-0 p-2 md:p-3 gap-2">
          <ForgeExpedicionSessionStrip
            v2={v2}
            teamMode={teamMode}
            sessionFormat={sessionFormat}
          />
          {sessionFormat === 'presencial' && !presencialHintDismissed && (
            <div className="shrink-0 flex items-start gap-2 rounded-lg border border-[#145A45]/20 bg-white/95 px-3 py-2 text-xs text-[#145A45] shadow-sm">
              <p className="flex-1 font-medium">
                {teamMode ? ft('forge.v2.presentialTeamHint') : ft('forge.v2.presentialSoloHint')}
              </p>
              <button
                type="button"
                onClick={() => setPresencialHintDismissed(true)}
                className="shrink-0 text-[#145A45]/50 hover:text-[#145A45] font-bold"
                aria-label={ft('forge.general.close')}
              >
                ✕
              </button>
            </div>
          )}
          {isFac && showTable && (
            <ForgeFacilitatorLensBar courseId={courseId} lens={facLens} onLensChange={setFacLens} />
          )}
          {isFac && facLens.kind !== 'mine' && facLens.kind !== 'all' && showTable && (
            <p className="shrink-0 rounded-lg border border-[#2E5C9A]/30 bg-[#E8F0FA] px-3 py-2 text-xs font-medium text-[#1A3D5C]">
              {ft('forge.v2.lensObserving', { name: facLens.name })}
            </p>
          )}
          {isFac && showHall && (
            <ForgeExpedicionFacConsole
              courseId={courseId}
              editionId={editionId ?? undefined}
              lens={facLens}
              onLensChange={setFacLens}
              teamRoomId={teamRoomId}
              cycleBusy={cycleBusy}
              onAction={async (action) => {
                setCycleBusy(true);
                try {
                  await patchV2({ action });
                  await reloadV2();
                } finally {
                  setCycleBusy(false);
                }
              }}
            />
          )}
          {v2 && showTable && (
            <ForgeExpedicionCycleBar
              v2={v2}
              isFacilitator={isFac}
              busy={cycleBusy}
              onEndCycle={
                isFac
                  ? async () => {
                      setCycleBusy(true);
                      try {
                        await patchV2({ action: 'end_cycle' });
                        await reloadV2();
                      } finally {
                        setCycleBusy(false);
                      }
                    }
                  : undefined
              }
            />
          )}
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

          {landEvent?.kind === 'accion' && landEvent.actionCard && v2 && !boardBlocked && (
            <div className="shrink-0">
              <ForgeEventCardPanel
                kind="accion"
                card={landEvent.actionCard}
                onApply={async () => {
                  await patchV2({
                    action: 'apply_action_card',
                    cardId: landEvent.actionCard!.id,
                  });
                  await reloadV2();
                  setLandEvent(null);
                }}
                onDismiss={() => setLandEvent(null)}
              />
            </div>
          )}
          {landEvent?.kind === 'desafio' && landEvent.crisisCard && v2 && !boardBlocked && (
            <div className="shrink-0">
              <ForgeEventCardPanel
                kind="desafio"
                card={landEvent.crisisCard}
                onApplyCrisis={async (mode) => {
                  await patchV2({
                    action: 'apply_crisis_card',
                    cardId: landEvent.crisisCard!.id,
                    mode,
                  });
                  await reloadV2();
                  setLandEvent(null);
                }}
                onDismiss={() => setLandEvent(null)}
              />
            </div>
          )}

          {v2?.pendingMicroCaso && !isFac && !activeMicroCaso && !landEvent && (
            <p className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Respuesta enviada — esperando validación del facilitador (+200 Eco).
            </p>
          )}

          {activeMicroCaso && stationSlug && v2 && !boardBlocked && !landEvent && !pendingReview && (
            <div className="shrink-0">
              <ForgeMicroCasoPanel
                microCaso={activeMicroCaso}
                station={stationSlug}
                balance={v2.ledger.balance}
                isFacilitator={isFac}
                teamPeers={teamPeers}
                myUserId={myUserId}
                onConsultancy={async (optionId, peerUserId) => {
                  await patchV2({
                    action: 'consultancy',
                    optionId,
                    ...(peerUserId ? { peerUserId } : {}),
                  });
                  await reloadV2();
                }}
                onSubmit={async (answer) => {
                  await patchV2({
                    action: 'submit_micro_caso',
                    microCasoId: activeMicroCaso.id,
                    station: stationSlug,
                    answer,
                    submittedBy: myUserId,
                  });
                  await reloadV2();
                  setActiveMicroCaso(null);
                }}
              />
            </div>
          )}

          {isFac && reviewMicroCaso && reviewStation && v2 && !boardBlocked && !landEvent && (
            <div className="shrink-0">
              <ForgeMicroCasoPanel
                microCaso={reviewMicroCaso}
                station={reviewStation}
                balance={v2.ledger.balance}
                isFacilitator
                pendingAnswer={pendingReview?.answer}
                onConsultancy={() => {}}
                onApprove={async () => {
                  await patchV2({ action: 'approve_micro_caso' });
                  await reloadV2();
                }}
                onReject={async () => {
                  await patchV2({ action: 'reject_micro_caso' });
                  await reloadV2();
                }}
              />
            </div>
          )}

          {showFeriaPanel && v2 && (
            <div className="shrink-0">
              <ForgeFeriaPanel
                eligible={feriaEligibleNow}
                eligibilityHint={feriaEligibilityHint(v2.constructionMap)}
                isFacilitator={isFac}
                pendingPitch={v2.pendingFeriaPitch?.pitch}
                awarded={v2.feriaAwarded}
                onSubmit={async (pitch) => {
                  await patchV2({
                    action: 'submit_feria_pitch',
                    pitch,
                    submittedBy: myUserId,
                  });
                  await reloadV2();
                }}
                onAward={async () => {
                  await patchV2({ action: 'award_feria_pitch' });
                  await reloadV2();
                }}
                onReject={async () => {
                  await patchV2({ action: 'reject_feria_pitch' });
                  await reloadV2();
                }}
              />
            </div>
          )}

          {v2?.phase === 'finished' && v2.finalScoreBreakdown && (
            <div className="shrink-0">
              <ForgeSustainabilityDashboard breakdown={v2.finalScoreBreakdown} />
            </div>
          )}

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {showHall ? (
              <div className="flex flex-1 items-start justify-center overflow-y-auto py-2 md:py-4">
                <div className="w-full max-w-lg">
              <ForgeExpedicionLobby
                phase={effectivePhase}
                isFacilitator={isFac}
                teamMode={teamMode}
                v2={v2}
                canResume={canResume}
                quizPreAvailable={quizPreAvailable}
                quizPostAvailable={quizPostAvailable}
                profileOpen={profileOpen}
                onShowProfile={() => setProfileOpen((v) => !v)}
                onGoToTable={() => setRoomView('table')}
                onOpenQuiz={(side) => setQuizModal({ side, preview: false })}
                onPreviewQuiz={(side) => setQuizModal({ side, preview: true })}
                onPresentation={() => {
                  loadPresentationRows();
                  setRoomView('presentation');
                }}
                onFacOpenPreQuiz={
                  isFac
                    ? async () => {
                        if (teamV2Active) await patchV2({ action: 'open_pre_quiz' });
                        else await patchFacBatch('open_pre_quiz_all');
                        await reloadV2();
                      }
                    : undefined
                }
                onFacOpenPostQuiz={
                  isFac
                    ? async () => {
                        if (teamV2Active) await patchV2({ action: 'open_post_quiz' });
                        else await patchFacBatch('open_post_quiz_all');
                        await reloadV2();
                      }
                    : undefined
                }
                onFacRestart={
                  isFac
                    ? async () => {
                        if (teamV2Active) await patchV2({ action: 'reset_v2' });
                        else await patchFacBatch('reset_v2_all');
                        await patchFacBatch('return_to_lobby_all');
                        await reloadV2();
                        setRoomView('hall');
                      }
                    : undefined
                }
              />
                </div>
              </div>
            ) : (
              <div className="flex flex-1 min-h-0 flex-col md:flex-row gap-0">
                <div className="flex flex-1 flex-col min-h-0 min-w-0 gap-2 overflow-y-auto">
                  {!isCoaching && !boardBlocked && facLens.kind === 'mine' ? (
                    gameSpec && syncMode !== 'pending' ? (
                      <div className="flex flex-col flex-1 min-h-0 [&_.rounded-xl]:bg-transparent">
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
                          onGameEvents={handleBoardEvents}
                          v2EcoBalance={v2?.ledger.balance}
                        />
                      </div>
                    ) : (
                      <p className="text-center text-sm text-[#145A45]/70 py-12">
                        {boardBusy ? ft('forge.general.loading') : ft('forge.room.waitingBoard')}
                      </p>
                    )
                  ) : dockReadOnly ? (
                    <p className="text-center text-sm text-[#2E5C9A] py-8 px-4">
                      {ft('forge.v2.lensBoardHint')}
                    </p>
                  ) : (
                    myMap && <ForgePersonalMapStrip mapState={myMap} />
                  )}
                  {boardBlocked && effectivePhase !== 'finished' && (
                    <p className="text-center text-sm text-[#C9A227] font-semibold py-2">
                      {ft('forge.v2.lobbyBoardBlocked')}
                    </p>
                  )}
                </div>
                <ForgeExpedicionTableDock
                  courseId={courseId}
                  roomId={observeRoomId}
                  observeUserId={observeUserId}
                  teamPeers={teamPeers}
                  myUserId={myUserId}
                  readOnly={dockReadOnly || boardBlocked}
                  balance={v2?.ledger.balance}
                  impactPoints={v2?.impactPoints}
                />
              </div>
            )}
          </div>

          {myMap && !isCoaching && (
            <div className="shrink-0 max-h-28 overflow-hidden">
              <ForgePersonalMapStrip
                mapState={myMap}
                v2Balance={v2?.ledger.balance}
                v2PostItCount={v2?.constructionMap.postIts.length}
                v2ImpactPoints={v2?.impactPoints}
              />
            </div>
          )}

          {investStation && v2 && (
            <ForgeInvestmentPanel
              station={investStation}
              balance={v2.ledger.balance}
              benefits={v2.benefits}
              onClose={() => setInvestStation(null)}
              onPurchase={async (tierId, label, cost) => {
                await patchV2({
                  action: 'purchase_investment',
                  tierId,
                  label,
                  cost,
                  station: investStation,
                });
                await reloadV2();
              }}
            />
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
        )}
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
