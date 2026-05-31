'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, LayoutGrid, Map, Presentation, Users, Video } from 'lucide-react';
import { ForgeFacilitatorPlaybook } from '@/components/forge/ForgeFacilitatorPlaybook';
import { ForgeGameBoard, type ForgeGameSyncMode } from '@/components/forge/ForgeGameBoard';
import { ForgePresentationViewer } from '@/components/forge/ForgePresentationViewer';
import {
  isJitsiEmbeddable,
  jitsiEmbedUrl,
  resolveMeetingUrl,
  type ForgeLiveConfig,
} from '@/lib/forge/delivery';
import { canEmbedJitsiInIframe } from '@/lib/forge/jitsi-config';
import type { ExpedicionSlide } from '@/lib/forge/expedicion-presentacion-slides';
import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';

type LearnerMapRow = {
  userId: string;
  name: string | null;
  email: string | null;
  progressPercent: number;
  stationsCompleted: number;
  stationTotal: number;
  isFacilitator?: boolean;
  isSelf?: boolean;
  mapState?: {
    stations: { title: string; completed: boolean; activityDone: number; activityTotal: number }[];
  };
};

type Panel = 'session' | 'guide' | 'jitsi' | 'ppt' | 'board' | 'maps';

type Props = {
  courseId: string;
  courseTitle: string;
  liveConfig: ForgeLiveConfig;
  jitsiBaseUrl?: string;
  presentationSlides: ExpedicionSlide[];
  presentationPdfUrl?: string | null;
  presentationEmbedUrl?: string | null;
  gameActivityId: string | null;
};

export function ForgeLiveStudio({
  courseId,
  courseTitle,
  liveConfig,
  jitsiBaseUrl,
  presentationSlides,
  presentationPdfUrl,
  presentationEmbedUrl,
  gameActivityId,
}: Props) {
  const ft = useForgeT();
  const [panel, setPanel] = useState<Panel>('session');
  const [learners, setLearners] = useState<LearnerMapRow[]>([]);
  const [gameSpec, setGameSpec] = useState<GameSpecV1 | null>(null);
  const [gameState, setGameState] = useState<Record<string, unknown>>({});
  const [sharedRoomId, setSharedRoomId] = useState<string | null>(null);
  const [roomVersion, setRoomVersion] = useState(0);
  const [syncMode, setSyncMode] = useState<ForgeGameSyncMode | 'pending'>('pending');
  const [boardBusy, setBoardBusy] = useState(false);
  const salonBooted = useRef(false);

  const learnerUrl = useMemo(
    () => resolveMeetingUrl(liveConfig, courseId, 'learner', null, jitsiBaseUrl),
    [liveConfig, courseId, jitsiBaseUrl]
  );
  const facilitatorUrl = useMemo(
    () => resolveMeetingUrl(liveConfig, courseId, 'facilitator', null, jitsiBaseUrl),
    [liveConfig, courseId, jitsiBaseUrl]
  );
  const jitsiSrc =
    learnerUrl && isJitsiEmbeddable(learnerUrl) && canEmbedJitsiInIframe(learnerUrl)
      ? jitsiEmbedUrl(learnerUrl)
      : null;
  const facilitatorEmbedSrc =
    facilitatorUrl && isJitsiEmbeddable(facilitatorUrl) && canEmbedJitsiInIframe(facilitatorUrl)
      ? jitsiEmbedUrl(facilitatorUrl)
      : null;

  useEffect(() => {
    fetch(`/api/forge/courses/${courseId}/learners?maps=1`)
      .then((r) => r.json())
      .then((d) => setLearners(d.learners ?? []))
      .catch(() => {});
  }, [courseId]);

  const loadSpecForActivity = useCallback(async (): Promise<GameSpecV1 | null> => {
    if (!gameActivityId) return null;
    const actRes = await fetch(`/api/forge/activities/${gameActivityId}`);
    const actData = await actRes.json();
    const specId = actData.activity?.gameSpecId as string | undefined;
    if (!specId) return null;
    const gs = await fetch(`/api/forge/game-specs/${specId}`).then((r) => r.json());
    return (gs.gameSpec?.definition as GameSpecV1) ?? null;
  }, [gameActivityId]);

  const loadBoard = useCallback(async () => {
    if (!gameActivityId) return;
    const spec = await loadSpecForActivity();
    const res = await fetch(`/api/forge/shared-game-rooms?activityId=${encodeURIComponent(gameActivityId)}`);
    const d = await res.json();
    if (d.room && spec) {
      setSharedRoomId(d.room.id);
      setRoomVersion(d.room.version);
      setGameSpec(spec);
      setGameState(d.room.state);
      setSyncMode(d.isHost ? 'host' : 'viewer');
    }
  }, [gameActivityId, loadSpecForActivity]);

  useEffect(() => {
    if (panel === 'board' || panel === 'session') void loadBoard();
  }, [panel, loadBoard]);

  useEffect(() => {
    if (!gameActivityId || salonBooted.current) return;
    salonBooted.current = true;
    (async () => {
      const res = await fetch(
        `/api/forge/shared-game-rooms?activityId=${encodeURIComponent(gameActivityId)}`
      );
      const d = await res.json();
      if (d.room) {
        await loadBoard();
        return;
      }
      await startBoard();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once per mount
  }, [gameActivityId]);

  async function startBoard() {
    if (!gameActivityId) return;
    setBoardBusy(true);
    try {
      const spec = await loadSpecForActivity();
      const res = await fetch('/api/forge/shared-game-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: gameActivityId }),
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
      setSyncMode('host');
    } finally {
      setBoardBusy(false);
    }
  }

  const tabs: { id: Panel; label: string; icon: typeof Video }[] = [
    { id: 'session', label: ft('forge.studio.session'), icon: Video },
    { id: 'guide', label: ft('forge.studio.guide'), icon: BookOpen },
    { id: 'jitsi', label: ft('forge.studio.jitsi'), icon: Video },
    { id: 'ppt', label: ft('forge.studio.ppt'), icon: Presentation },
    { id: 'board', label: ft('forge.studio.board'), icon: LayoutGrid },
    { id: 'maps', label: ft('forge.studio.maps'), icon: Map },
  ];

  return (
    <div className="space-y-4">
      <Link
        href={`/hub/forge/cursos/${courseId}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {courseTitle}
      </Link>

      <div className="rounded-2xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 to-indigo-50 p-4">
        <h1 className="text-xl font-black text-slate-900">{ft('forge.studio.title')}</h1>
        <p className="mt-1 text-sm text-slate-600 max-w-3xl">{ft('forge.studio.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPanel(t.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition',
              panel === t.id ? 'bg-sky-600 text-white shadow' : 'bg-white border border-slate-200 text-slate-700'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {panel === 'session' && (
        <div className="grid gap-3 lg:grid-cols-12 min-h-[min(78vh,900px)]">
          <div className="lg:col-span-7 flex flex-col rounded-2xl border-2 border-sky-400/60 bg-slate-950 overflow-hidden shadow-xl min-h-[320px] lg:min-h-0">
            <p className="px-3 py-2 text-xs font-bold uppercase text-sky-200 border-b border-sky-800/50 bg-sky-950/80 shrink-0">
              {ft('forge.studio.immersiveVideo')}
            </p>
            {jitsiSrc ? (
              <iframe
                title="Jitsi"
                src={jitsiSrc}
                className="flex-1 min-h-[280px] w-full bg-black"
                allow="camera; microphone; fullscreen; display-capture"
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-sky-100">{ft('forge.studio.videoFallback')}</p>
                <a
                  href={learnerUrl ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-500"
                >
                  {ft('forge.live.join')}
                </a>
              </div>
            )}
          </div>
          <div className="lg:col-span-5 flex flex-col gap-3 min-h-0 overflow-y-auto max-h-[min(78vh,900px)]">
            <ForgePresentationViewer
              slides={presentationSlides}
              pdfUrl={presentationPdfUrl}
              embedUrl={presentationEmbedUrl}
              compact
            />
            <div className="rounded-xl border border-amber-300/80 bg-white p-2 shadow-sm">
              {gameSpec && syncMode !== 'pending' ? (
                <ForgeGameBoard
                  spec={gameSpec}
                  initialState={gameState}
                  syncMode={syncMode}
                  roomId={sharedRoomId ?? undefined}
                  roomVersion={roomVersion}
                  onRoomState={(s) => setGameState(s as Record<string, unknown>)}
                />
              ) : gameActivityId ? (
                <p className="p-4 text-sm text-amber-900 text-center">
                  {boardBusy ? ft('forge.general.loading') : ft('forge.studio.startBoard')}
                </p>
              ) : (
                <p className="p-3 text-sm text-amber-800">{ft('forge.studio.noGameActivity')}</p>
              )}
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-3 shrink-0">
              <p className="text-xs font-bold uppercase text-violet-800 mb-2 flex items-center gap-1">
                <Map className="h-3.5 w-3.5" />
                {ft('forge.studio.mapsHint')}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {learners.map((l) => (
                  <Link
                    key={l.userId}
                    href={`/hub/forge/cursos/${courseId}/alumnos/${l.userId}`}
                    className="shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-2 min-w-[140px] hover:border-violet-400"
                  >
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {l.name ?? l.email}
                      {l.isFacilitator ? ' · F' : ''}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {l.progressPercent}% · {l.stationsCompleted}/{l.stationTotal}
                    </p>
                  </Link>
                ))}
                {learners.length === 0 && (
                  <p className="text-xs text-violet-700">{ft('forge.alumnos.empty')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {panel === 'guide' && <ForgeFacilitatorPlaybook courseId={courseId} gameActivityId={gameActivityId} />}

      {panel === 'jitsi' && (
        <div className="grid gap-4 lg:grid-cols-2 min-h-[420px]">
          <div className="rounded-xl border border-sky-200 bg-white overflow-hidden flex flex-col">
            <p className="px-3 py-2 text-xs font-bold uppercase text-sky-800 border-b bg-sky-50">
              {ft('forge.studio.jitsiLearners')}
            </p>
            {jitsiSrc ? (
              <iframe title="Jitsi alumnos" src={jitsiSrc} className="flex-1 min-h-[360px] w-full" allow="camera; microphone; fullscreen" />
            ) : (
              <div className="p-6 text-sm text-slate-600">
                <a href={learnerUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="text-sky-700 font-bold underline">
                  {ft('forge.live.join')}
                </a>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-violet-200 bg-white overflow-hidden flex flex-col">
            <p className="px-3 py-2 text-xs font-bold uppercase text-violet-800 border-b bg-violet-50">
              {ft('forge.studio.jitsiFacilitator')}
            </p>
            {facilitatorEmbedSrc ? (
              <iframe
                title="Jitsi facilitador"
                src={facilitatorEmbedSrc}
                className="flex-1 min-h-[360px] w-full"
                allow="camera; microphone; fullscreen"
              />
            ) : (
              <div className="p-6 text-sm">
                <a href={facilitatorUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="text-violet-700 font-bold underline">
                  Sala facilitador
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {panel === 'ppt' && (
        <ForgePresentationViewer
          slides={presentationSlides}
          pdfUrl={presentationPdfUrl}
          embedUrl={presentationEmbedUrl}
        />
      )}

      {panel === 'board' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{ft('forge.studio.boardHint')}</p>
          {!sharedRoomId && gameActivityId && (
            <button
              type="button"
              disabled={boardBusy}
              onClick={() => void startBoard()}
              className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {boardBusy ? '…' : ft('forge.studio.startBoard')}
            </button>
          )}
          {gameSpec && syncMode !== 'pending' && (
            <ForgeGameBoard
              spec={gameSpec}
              initialState={gameState}
              syncMode={syncMode}
              roomId={sharedRoomId ?? undefined}
              roomVersion={roomVersion}
              onRoomState={(s) => setGameState(s as Record<string, unknown>)}
            />
          )}
          {!gameActivityId && (
            <p className="text-sm text-amber-800">{ft('forge.studio.noGameActivity')}</p>
          )}
        </div>
      )}

      {panel === 'maps' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 flex items-center gap-2">
            <Users className="h-4 w-4" />
            {ft('forge.studio.mapsHint')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {learners.map((l) => (
              <div key={l.userId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-bold text-slate-900 truncate">{l.name ?? l.email}</p>
                <p className="text-xs text-slate-500">
                  {l.progressPercent}% · {l.stationsCompleted}/{l.stationTotal} {ft('forge.studio.mapStations')}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(l.mapState?.stations ?? []).map((st, i) => (
                    <span
                      key={i}
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[9px] font-bold',
                        st.completed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      )}
                      title={st.title}
                    >
                      {i + 1}
                    </span>
                  ))}
                </div>
                <Link
                  href={`/hub/forge/cursos/${courseId}/alumnos/${l.userId}`}
                  className="mt-3 inline-block text-xs font-bold text-violet-700 hover:underline"
                >
                  {ft('forge.alumnos.viewDossier')} →
                </Link>
              </div>
            ))}
          </div>
          {learners.length === 0 && (
            <p className="text-sm text-slate-500 rounded-xl border border-dashed p-8 text-center">
              {ft('forge.alumnos.empty')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
