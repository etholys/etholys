'use client';

import { useCallback, useEffect, useState } from 'react';
import { ForgeGameBoard, type ForgeGameSyncMode } from '@/components/forge/ForgeGameBoard';
import { ForgeLivePanel } from '@/components/forge/ForgeLivePanel';
import { showsLiveFeatures, type ForgeDeliveryMode, type ForgeLiveConfig } from '@/lib/forge/delivery';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { type ForgeGamePlayMode, usesPersonalGame } from '@/lib/forge/game-play-mode';
import { Radio, Users } from 'lucide-react';
import { ForgeQuizRace } from '@/components/forge/ForgeQuizRace';
import { ForgeGameCards } from '@/components/forge/ForgeGameCards';
import { ForgeGameBranching } from '@/components/forge/ForgeGameBranching';
import { ForgeLessonBody } from '@/components/forge/ForgeLessonBody';
import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';

type Activity = {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  gameSpec?: { id: string; engine: string; definition?: unknown } | null;
  gameSpecId?: string | null;
};

type QuizQ = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

export function ForgeActivityPlayer({
  activity,
  courseId,
  deliveryMode = 'async',
  liveConfig = {},
  gamePlayMode = 'personal',
  canFacilitate = false,
  liveSessionId,
  onDone,
  alreadyCompleted,
}: {
  activity: Activity;
  courseId?: string;
  deliveryMode?: ForgeDeliveryMode;
  liveConfig?: ForgeLiveConfig;
  gamePlayMode?: ForgeGamePlayMode;
  canFacilitate?: boolean;
  liveSessionId?: string | null;
  onDone?: () => void;
  alreadyCompleted?: boolean;
}) {
  const ft = useForgeT();
  const liveSync = showsLiveFeatures(deliveryMode);
  const useSharedBoard = liveSync && !usesPersonalGame(gamePlayMode);
  const [busy, setBusy] = useState(false);
  const [gameSessionId, setGameSessionId] = useState<string | null>(null);
  const [sharedRoomId, setSharedRoomId] = useState<string | null>(null);
  const [roomVersion, setRoomVersion] = useState(0);
  const [syncMode, setSyncMode] = useState<ForgeGameSyncMode | 'pending'>('pending');
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [sharedFinished, setSharedFinished] = useState(false);
  const [gameSpec, setGameSpec] = useState<GameSpecV1 | null>(null);
  const [gameState, setGameState] = useState<Record<string, unknown>>({});
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizDone, setQuizDone] = useState(alreadyCompleted ?? false);
  const [assignmentNotes, setAssignmentNotes] = useState('');

  const complete = useCallback(
    async (score?: number, payload?: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await fetch('/api/forge/progress/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityId: activity.id, score, payload }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || ft('forge.general.error'));
        onDone?.();
      } finally {
        setBusy(false);
      }
    },
    [activity.id, onDone, ft]
  );

  const loadSpec = useCallback(async (): Promise<GameSpecV1 | null> => {
    const specId = activity.gameSpec?.id ?? activity.gameSpecId;
    if (!specId) return null;
    if (activity.gameSpec?.definition) return activity.gameSpec.definition as GameSpecV1;
    const gs = await fetch(`/api/forge/game-specs/${specId}`).then((r) => r.json());
    return (gs.gameSpec?.definition as GameSpecV1) ?? null;
  }, [activity]);

  const attachSharedRoom = useCallback(
    (room: { id: string; state: Record<string, unknown>; version: number }, spec: GameSpecV1, host: boolean) => {
      setSharedRoomId(room.id);
      setRoomVersion(room.version);
      setGameSpec(spec);
      setGameState(room.state);
      setSyncMode(host ? 'host' : 'viewer');
      setWaitingRoom(false);
    },
    []
  );

  const startSharedRoom = useCallback(async () => {
    setBusy(true);
    try {
      const spec = await loadSpec();
      if (!spec) return;
      const res = await fetch('/api/forge/shared-game-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          liveSessionId: liveSessionId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro');
      attachSharedRoom(data.room, (data.spec as GameSpecV1) ?? spec, true);
    } catch (e) {
      alert(e instanceof Error ? e.message : ft('forge.general.error'));
    } finally {
      setBusy(false);
    }
  }, [activity.id, liveSessionId, loadSpec, attachSharedRoom, ft]);

  useEffect(() => {
    if (activity.type !== 'game') return;
    const specId = activity.gameSpec?.id ?? activity.gameSpecId;
    if (!specId) return;

    let cancelled = false;
    (async () => {
      const spec = await loadSpec();
      if (cancelled || !spec) return;

      if (useSharedBoard) {
        const q = liveSessionId ? `?activityId=${activity.id}&liveSessionId=${liveSessionId}` : `?activityId=${activity.id}`;
        const roomRes = await fetch(`/api/forge/shared-game-rooms${q}`);
        const roomData = await roomRes.json();
        if (cancelled) return;

        if (roomData.room) {
          attachSharedRoom(roomData.room, spec, Boolean(roomData.isHost));
          return;
        }

        if (canFacilitate) {
          setGameSpec(spec);
          setSyncMode('pending');
          return;
        }

        setGameSpec(spec);
        setWaitingRoom(true);
        setSyncMode('pending');
        return;
      }

      const res = await fetch('/api/forge/game-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: activity.id }),
      });
      const data = await res.json();
      if (cancelled || !res.ok) return;
      setGameSessionId(data.session?.id ?? null);
      setGameSpec((data.spec as GameSpecV1) ?? spec);
      setGameState((data.session?.state ?? {}) as Record<string, unknown>);
      setSyncMode('solo');
    })();

    return () => {
      cancelled = true;
    };
  }, [activity, useSharedBoard, liveSessionId, canFacilitate, loadSpec, attachSharedRoom]);

  useEffect(() => {
    if (!waitingRoom || !useSharedBoard || sharedRoomId) return;
    const poll = async () => {
      const q = liveSessionId ? `?activityId=${activity.id}&liveSessionId=${liveSessionId}` : `?activityId=${activity.id}`;
      const res = await fetch(`/api/forge/shared-game-rooms${q}`);
      const data = await res.json();
      if (data.room && gameSpec) {
        attachSharedRoom(data.room, gameSpec, false);
      }
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [waitingRoom, useSharedBoard, sharedRoomId, activity.id, liveSessionId, gameSpec, attachSharedRoom]);

  if (alreadyCompleted && activity.type !== 'game') {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ft('forge.player.completed')}</p>
    );
  }

  if (activity.type === 'live' && courseId) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{ft('forge.player.liveActivity')}</p>
        <ForgeLivePanel
          courseId={courseId}
          deliveryMode={deliveryMode}
          liveConfig={liveConfig}
          currentActivityId={activity.id}
        />
        {!alreadyCompleted && (
          <button
            type="button"
            disabled={busy}
            onClick={() => complete(1, { live: true })}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {ft('forge.player.markComplete')}
          </button>
        )}
      </div>
    );
  }

  if (activity.type === 'assignment') {
    const instructions =
      typeof activity.config.instructions === 'string' ? activity.config.instructions : '';
    return (
      <div className="space-y-4">
        {instructions && <p className="text-sm text-slate-700 whitespace-pre-wrap">{instructions}</p>}
        <p className="text-sm text-slate-500">{ft('forge.player.assignmentHint')}</p>
        <textarea
          value={assignmentNotes}
          onChange={(e) => setAssignmentNotes(e.target.value)}
          placeholder={ft('forge.player.assignmentNotes')}
          rows={4}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        {!alreadyCompleted && (
          <button
            type="button"
            disabled={busy || !assignmentNotes.trim()}
            onClick={() => complete(1, { submission: assignmentNotes.trim() })}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {ft('forge.player.assignmentSubmit')}
          </button>
        )}
      </div>
    );
  }

  if (activity.type === 'forum') {
    const url = typeof activity.config.url === 'string' ? activity.config.url : '';
    return (
      <div className="space-y-4">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            {ft('forge.player.forumOpen')}
          </a>
        ) : (
          <p className="text-sm text-slate-500">{ft('forge.general.noData')}</p>
        )}
        {!alreadyCompleted && url && (
          <button
            type="button"
            disabled={busy}
            onClick={() => complete(1, { forumVisited: true })}
            className="rounded-lg border border-violet-300 px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50"
          >
            {ft('forge.player.markComplete')}
          </button>
        )}
      </div>
    );
  }

  if (activity.type === 'lesson' || activity.type === 'media') {
    const body = typeof activity.config.body === 'string' ? activity.config.body : '';
    const url = typeof activity.config.url === 'string' ? activity.config.url : '';
    const videoUrl = typeof activity.config.videoUrl === 'string' ? activity.config.videoUrl : '';
    const ytId =
      videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)?.[1] ??
      (typeof activity.config.youtubeId === 'string' ? activity.config.youtubeId : null);
    return (
      <div className="space-y-4">
        {ytId && (
          <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-lg border">
            <iframe
              title="Vídeo"
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${ytId}`}
              allowFullScreen
            />
          </div>
        )}
        {body && <ForgeLessonBody body={body} />}
        {url && !ytId && (
          <a href={url} target="_blank" rel="noreferrer" className="text-violet-600 hover:underline text-sm">
            {ft('forge.player.externalResource')}
          </a>
        )}
        {!alreadyCompleted && (
          <button
            type="button"
            disabled={busy}
            onClick={() => complete(1)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {ft('forge.player.markComplete')}
          </button>
        )}
      </div>
    );
  }

  if (activity.type === 'quiz') {
    const questions = (activity.config.questions as QuizQ[]) ?? [];
    const q = questions[quizIndex];
    if (!q) return <p className="text-sm text-slate-500">{ft('forge.player.quizEmpty')}</p>;
    if (quizDone) {
      return (
        <p className="text-emerald-700 font-medium">
          {ft('forge.player.quizDone', { correct: quizCorrect, total: questions.length })}
        </p>
      );
    }
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          {ft('forge.player.quizProgress', { n: quizIndex + 1, total: questions.length })}
        </p>
        <p className="font-medium text-slate-900">{q.prompt}</p>
        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={busy}
              onClick={async () => {
                const ok = i === q.correctIndex;
                const nextCorrect = quizCorrect + (ok ? 1 : 0);
                if (quizIndex + 1 >= questions.length) {
                  setQuizDone(true);
                  setQuizCorrect(nextCorrect);
                  await complete(nextCorrect / questions.length, {
                    correct: nextCorrect,
                    total: questions.length,
                  });
                } else {
                  setQuizCorrect(nextCorrect);
                  setQuizIndex((x) => x + 1);
                }
              }}
              className="block w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm hover:border-violet-300 hover:bg-violet-50"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (activity.type === 'game') {
    if (!gameSpec || syncMode === 'pending') {
      if (waitingRoom) {
        return (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-6 text-center space-y-3">
            <Users className="mx-auto h-10 w-10 text-sky-600" />
            <p className="font-bold text-sky-900">{ft('forge.player.waitingFacilitator')}</p>
            <p className="text-sm text-sky-800">{ft('forge.player.waitingHint')}</p>
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-sky-300 border-t-sky-600" />
          </div>
        );
      }
      if (canFacilitate && useSharedBoard) {
        return (
          <div className="rounded-xl border-2 border-violet-300 bg-violet-50 p-6 space-y-4">
            <p className="flex items-center gap-2 font-bold text-violet-900">
              <Radio className="h-5 w-5" />
              {ft('forge.player.liveSharedBoard')}
            </p>
            <p className="text-sm text-violet-800">{ft('forge.player.liveSharedHint')}</p>
            <button
              type="button"
              disabled={busy}
              onClick={startSharedRoom}
              className="rounded-xl bg-violet-700 px-6 py-3 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-50"
            >
              {busy ? ft('forge.player.starting') : ft('forge.player.startSharedBoard')}
            </button>
          </div>
        );
      }
      return <p className="text-sm text-slate-500">{ft('forge.player.loadingGame')}</p>;
    }

    const boardReady = syncMode === 'solo' ? gameSessionId : sharedRoomId;
    if (!boardReady) {
      return <p className="text-sm text-slate-500">{ft('forge.player.loadingGame')}</p>;
    }

    if (gameSpec.engine === 'board') {
      return (
        <div className="space-y-4">
          {liveSync && usesPersonalGame(gamePlayMode) && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {ft('forge.player.personalMapNote')}
            </p>
          )}
          <ForgeGameBoard
            sessionId={gameSessionId ?? undefined}
            roomId={sharedRoomId ?? undefined}
            syncMode={syncMode}
            spec={gameSpec}
            initialState={gameState}
            roomVersion={roomVersion}
            onComplete={() => {
              if (syncMode === 'viewer') {
                setSharedFinished(true);
              } else {
                onDone?.();
              }
            }}
            onRoomState={(_s, finished) => {
              if (finished && syncMode === 'viewer') setSharedFinished(true);
            }}
          />
          {sharedFinished && !alreadyCompleted && (
            <button
              type="button"
              disabled={busy}
              onClick={() => complete(1, { sharedRoomId, mode: 'live_sync' })}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700"
            >
              {ft('forge.player.markActivityComplete')}
            </button>
          )}
        </div>
      );
    }
    if (gameSpec.engine === 'quiz_race') {
      return (
        <ForgeQuizRace
          sessionId={gameSessionId!}
          spec={gameSpec}
          initialState={gameState}
          onComplete={() => onDone?.()}
        />
      );
    }
    if (gameSpec.engine === 'cards') {
      return (
        <ForgeGameCards
          sessionId={gameSessionId!}
          spec={gameSpec}
          initialState={gameState as { hand?: string[]; played?: string[] }}
          onComplete={() => onDone?.()}
        />
      );
    }
    if (gameSpec.engine === 'branching') {
      return (
        <ForgeGameBranching
          sessionId={gameSessionId!}
          spec={gameSpec}
          initialState={gameState as { nodeId?: string }}
          onComplete={() => onDone?.()}
        />
      );
    }
    return (
      <p className="text-sm text-amber-700">{ft('forge.player.engineSoon', { engine: gameSpec.engine })}</p>
    );
  }

  return (
    <p className="text-sm text-slate-500">{ft('forge.player.typeDeveloping', { type: activity.type })}</p>
  );
}
