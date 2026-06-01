'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { X, Users, HelpCircle, ShieldAlert } from 'lucide-react';
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
import { ForgeFacilitatorScriptPanel } from '@/components/forge/ForgeFacilitatorScriptPanel';
import { ForgeGameCoach } from '@/components/forge/ForgeGameCoach';
import { parseMulti, currentPlayer, type BoardGuide } from '@/lib/forge/expedicion-board-multi';

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
  const booted = useRef(false);

  const jitsiUrl = useMemo(
    () => resolveMeetingUrl(liveConfig, courseId, 'learner', null, jitsiBaseUrl),
    [liveConfig, courseId, jitsiBaseUrl]
  );
  const jitsiSrc =
    jitsiUrl && isJitsiEmbeddable(jitsiUrl) && canEmbedJitsiInIframe(jitsiUrl)
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
    if (!sharedRoomId) return;
    const poll = async () => {
      const res = await fetch(`/api/forge/shared-game-rooms/${sharedRoomId}`);
      const d = await res.json();
      if (res.ok && d.room) {
        setGameState(d.room.state);
        setRoomVersion(d.room.version);
        setBoardSyncFromState(d.room.state, isFac);
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

  const knowledgeCard =
    isFac && currentSlide?.tecnico
      ? { title: currentSlide.title, body: currentSlide.tecnico }
      : null;

  const card = (gameState as { currentCard?: { prompt?: string; reflection?: string; id?: string } })
    ?.currentCard;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900/95 px-3 py-2">
        <Link
          href={`/hub/forge/cursos/${courseId}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700"
          title={ft('forge.room.exit')}
        >
          <X className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
            {ft('forge.room.brand')}
          </p>
          <h1 className="truncate text-sm font-black md:text-base">{courseTitle}</h1>
        </div>
        {currentSlide && (
          <p className="hidden sm:block text-xs text-slate-400 max-w-[200px] truncate">
            {currentSlide.title}
          </p>
        )}
        {isFac && (
          <>
            <Link
              href={`/hub/forge/cursos/${courseId}/turmas`}
              className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-bold hover:bg-slate-800"
            >
              {ft('forge.tutorLobby.short')}
            </Link>
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
          </>
        )}
      </header>

      <ForgeFloatingJitsi embedSrc={jitsiSrc} fallbackUrl={jitsiUrl} />
      {isFac && (
        <ForgeFacilitatorScriptPanel
          slide={currentSlide}
          slideIndex={slideIdx}
          total={presentationSlides.length}
          onPrev={() => setSlideIdx((i) => Math.max(0, i - 1))}
          onNext={() => setSlideIdx((i) => Math.min(presentationSlides.length - 1, i + 1))}
        />
      )}
      <ForgeGameCoach guide={coachGuide} knowledge={knowledgeCard} />

      <div className="flex-1 overflow-y-auto min-h-0 bg-slate-900/80">
        <div className="p-3 space-y-3 max-w-4xl mx-auto">
            {presentationSlides.length > 0 && (
              <div className="rounded-xl border border-violet-500/30 overflow-hidden">
                <ForgePresentationViewer
                  slides={presentationSlides}
                  pdfUrl={presentationPdfUrl}
                  embedUrl={presentationEmbedUrl}
                  compact
                  audienceMode={!isFac}
                  slideIndex={slideIdx}
                  onSlideIndexChange={isFac ? setSlideIdx : undefined}
                />
                {capsuleQuiz && (
                  <div className="border-t border-violet-500/20 bg-violet-950/40 px-3 py-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setQuizOpen(true)}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold"
                    >
                      {isFac ? ft('forge.room.openQuiz') : ft('forge.room.doQuiz')} — {capsuleQuiz.title}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!isFac && myMap && <ForgePersonalMapStrip mapState={myMap} />}

            {card?.prompt && (
              <div className="rounded-xl border-2 border-amber-400/60 bg-amber-950/50 p-4">
                <p className="text-[10px] font-bold uppercase text-amber-300">
                  {isFac ? ft('forge.room.cardFac') : ft('forge.room.cardLearner')}
                </p>
                <p className="mt-2 text-base font-semibold text-amber-50">{card.prompt}</p>
                {card.reflection && (
                  <p className="mt-2 text-sm text-amber-200/90">💡 {card.reflection}</p>
                )}
                {!isFac && (
                  <p className="mt-3 text-xs text-amber-200/80">{ft('forge.room.cardHint')}</p>
                )}
              </div>
            )}

            <div className="rounded-xl border border-amber-500/40 bg-slate-900 p-2">
              {gameSpec && syncMode !== 'pending' ? (
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
              ) : (
                <p className="p-4 text-center text-sm text-amber-200">
                  {boardBusy ? ft('forge.general.loading') : ft('forge.room.waitingBoard')}
                </p>
              )}
            </div>

            {isFac && (
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
                  <Users className="h-4 w-4" />
                  {ft('forge.studio.mapsHint')} ({learners.length})
                </p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {learners.map((l) => (
                    <div
                      key={l.userId}
                      className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 min-w-[120px]"
                    >
                      <p className="text-xs font-bold truncate">{l.name ?? l.email}</p>
                      <p className="text-[10px] text-slate-400">
                        {l.stationsCompleted}/{l.stationTotal} · {l.progressPercent}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isFac && showDeck && gameSpec?.cards && (
              <div className="rounded-xl border border-slate-600 bg-slate-900 p-3 max-h-48 overflow-y-auto">
                <p className="text-xs font-bold text-slate-400 mb-2">{ft('forge.playbook.cardsTitle', { n: gameSpec.cards.length })}</p>
                <ul className="space-y-2 text-xs">
                  {gameSpec.cards.map((c) => (
                    <li key={c.id} className="text-slate-300">
                      <span className="text-slate-500">{c.id}</span> — {c.prompt}
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
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
