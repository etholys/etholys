'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LayoutGrid, Map, Presentation, Users, Video } from 'lucide-react';
import { ForgeGameBoard, type ForgeGameSyncMode } from '@/components/forge/ForgeGameBoard';
import { ForgePresentationViewer } from '@/components/forge/ForgePresentationViewer';
import {
  isJitsiEmbeddable,
  jitsiEmbedUrl,
  resolveMeetingUrl,
  type ForgeLiveConfig,
} from '@/lib/forge/delivery';
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
  mapState?: {
    stations: { title: string; completed: boolean; activityDone: number; activityTotal: number }[];
  };
};

type Panel = 'session' | 'jitsi' | 'ppt' | 'board' | 'maps';

type Props = {
  courseId: string;
  courseTitle: string;
  liveConfig: ForgeLiveConfig;
  presentationSlides: ExpedicionSlide[];
  presentationPdfUrl?: string | null;
  presentationEmbedUrl?: string | null;
  gameActivityId: string | null;
};

export function ForgeLiveStudio({
  courseId,
  courseTitle,
  liveConfig,
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
  const [syncMode, setSyncMode] = useState<ForgeGameSyncMode>('pending');
  const [boardBusy, setBoardBusy] = useState(false);

  const learnerUrl = useMemo(
    () => resolveMeetingUrl(liveConfig, courseId, 'learner'),
    [liveConfig, courseId]
  );
  const facilitatorUrl = useMemo(
    () => resolveMeetingUrl(liveConfig, courseId, 'facilitator'),
    [liveConfig, courseId]
  );
  const jitsiSrc =
    learnerUrl && isJitsiEmbeddable(learnerUrl) && !learnerUrl.includes('localhost')
      ? jitsiEmbedUrl(learnerUrl)
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
        <div className="grid gap-4 xl:grid-cols-2 min-h-[520px]">
          <div className="rounded-xl border border-sky-200 bg-white overflow-hidden flex flex-col min-h-[360px]">
            <p className="px-3 py-2 text-xs font-bold uppercase text-sky-800 border-b bg-sky-50">
              {ft('forge.studio.jitsiLearners')}
            </p>
            {jitsiSrc ? (
              <iframe title="Jitsi" src={jitsiSrc} className="flex-1 min-h-[320px] w-full" allow="camera; microphone; fullscreen" />
            ) : (
              <div className="p-4 text-sm">
                <a href={learnerUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="text-sky-700 font-bold underline">
                  {ft('forge.live.join')}
                </a>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <ForgePresentationViewer
              slides={presentationSlides}
              pdfUrl={presentationPdfUrl}
              embedUrl={presentationEmbedUrl}
              compact
            />
            {gameSpec && syncMode !== 'pending' ? (
              <ForgeGameBoard
                spec={gameSpec}
                state={gameState}
                syncMode={syncMode}
                roomId={sharedRoomId}
                roomVersion={roomVersion}
                onStateChange={setGameState}
                onVersionChange={setRoomVersion}
              />
            ) : gameActivityId ? (
              <button
                type="button"
                disabled={boardBusy}
                onClick={() => void startBoard()}
                className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {boardBusy ? '…' : ft('forge.studio.startBoard')}
              </button>
            ) : null}
          </div>
        </div>
      )}

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
            {facilitatorUrl && isJitsiEmbeddable(facilitatorUrl) ? (
              <iframe
                title="Jitsi facilitador"
                src={jitsiEmbedUrl(facilitatorUrl)}
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
              state={gameState}
              syncMode={syncMode}
              roomId={sharedRoomId}
              roomVersion={roomVersion}
              onStateChange={setGameState}
              onVersionChange={setRoomVersion}
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
