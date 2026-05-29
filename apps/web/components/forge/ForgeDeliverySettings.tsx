'use client';

import { useState } from 'react';
import {
  FORGE_DELIVERY_MODES,
  type ForgeDeliveryMode,
  type ForgeLiveConfig,
  parseLiveConfig,
} from '@/lib/forge/delivery';
import {
  FORGE_GAME_PLAY_MODES,
  type ForgeGamePlayMode,
  parseGamePlayMode,
} from '@/lib/forge/game-play-mode';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { Video, Clock, Users } from 'lucide-react';

type CohortMode = 'invite_only' | 'open';

type Props = {
  deliveryMode: ForgeDeliveryMode;
  gamePlayMode: ForgeGamePlayMode;
  cohortMode?: CohortMode;
  liveConfig: ForgeLiveConfig;
  onSave: (
    mode: ForgeDeliveryMode,
    live: ForgeLiveConfig,
    game: ForgeGamePlayMode,
    cohort: CohortMode
  ) => Promise<void>;
};

function gameModeKey(id: ForgeGamePlayMode): 'personal' | 'shared' {
  return id === 'shared_live' ? 'shared' : 'personal';
}

export function ForgeDeliverySettings({
  deliveryMode,
  gamePlayMode,
  cohortMode = 'invite_only',
  liveConfig,
  onSave,
}: Props) {
  const ft = useForgeT();
  const [mode, setMode] = useState<ForgeDeliveryMode>(deliveryMode);
  const [gameMode, setGameMode] = useState<ForgeGamePlayMode>(gamePlayMode);
  const [cohort, setCohort] = useState<CohortMode>(cohortMode);
  const [live, setLive] = useState<ForgeLiveConfig>(liveConfig);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await onSave(mode, live, gameMode, cohort);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <Users className="h-5 w-5 text-blue-600" />
          {ft('forge.delivery.title')}
        </h3>
        <p className="mt-1 text-sm text-slate-500">{ft('forge.delivery.subtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {FORGE_DELIVERY_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`rounded-xl border-2 p-4 text-left transition ${
              mode === m.id
                ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                : 'border-slate-200 hover:border-blue-300'
            }`}
          >
            <p className="font-bold text-slate-900">{ft(`forge.delivery.${m.id}.label`)}</p>
            <p className="mt-1 text-xs text-slate-600">{ft(`forge.delivery.${m.id}.desc`)}</p>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-bold text-slate-800">{ft('forge.delivery.cohort.title')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setCohort('invite_only')}
            className={`rounded-xl border-2 p-3 text-left text-sm ${
              cohort === 'invite_only' ? 'border-blue-600 bg-blue-50' : 'border-slate-200'
            }`}
          >
            <p className="font-bold">{ft('forge.delivery.cohort.invite.label')}</p>
            <p className="text-xs text-slate-600 mt-1">{ft('forge.delivery.cohort.invite.desc')}</p>
          </button>
          <button
            type="button"
            onClick={() => setCohort('open')}
            className={`rounded-xl border-2 p-3 text-left text-sm ${
              cohort === 'open' ? 'border-blue-600 bg-blue-50' : 'border-slate-200'
            }`}
          >
            <p className="font-bold">{ft('forge.delivery.cohort.open.label')}</p>
            <p className="text-xs text-slate-600 mt-1">{ft('forge.delivery.cohort.open.desc')}</p>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-bold text-slate-800">{ft('forge.delivery.game.title')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FORGE_GAME_PLAY_MODES.map((g) => {
            const gk = gameModeKey(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGameMode(g.id)}
                className={`rounded-xl border-2 p-4 text-left ${
                  gameMode === g.id
                    ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200'
                    : 'border-slate-200'
                }`}
              >
                <p className="font-bold text-slate-900">{ft(`forge.delivery.game.${gk}.label`)}</p>
                <p className="mt-1 text-xs text-slate-600">{ft(`forge.delivery.game.${gk}.desc`)}</p>
              </button>
            );
          })}
        </div>
      </div>

      {(mode === 'live' || mode === 'blended') && (
        <div className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
          <h4 className="flex items-center gap-2 text-sm font-bold text-sky-900">
            <Video className="h-4 w-4" />
            {ft('forge.delivery.video.title')}
          </h4>
          <label className="block text-xs font-medium text-slate-600">
            {ft('forge.delivery.platform')}
            <select
              value={live.platform ?? 'jitsi'}
              onChange={(e) =>
                setLive({ ...live, platform: e.target.value as ForgeLiveConfig['platform'] })
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="jitsi">{ft('forge.delivery.platform.jitsi')}</option>
              <option value="meet">{ft('forge.delivery.platform.meet')}</option>
              <option value="zoom">{ft('forge.delivery.platform.zoom')}</option>
              <option value="teams">{ft('forge.delivery.platform.teams')}</option>
              <option value="custom">{ft('forge.delivery.platform.custom')}</option>
            </select>
          </label>
          {live.platform === 'jitsi' ? (
            <>
              <label className="block text-xs font-medium text-slate-600">
                {ft('forge.delivery.jitsi.room')}
                <input
                  value={live.roomName ?? ''}
                  onChange={(e) => setLive({ ...live, roomName: e.target.value })}
                  placeholder="expedicion-sostenible-mayo"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                {ft('forge.delivery.jitsi.facilitator')}
                <input
                  value={live.facilitatorRoomName ?? ''}
                  onChange={(e) => setLive({ ...live, facilitatorRoomName: e.target.value })}
                  placeholder="expedicion-sostenible-facilitador"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </>
          ) : null}
          <label className="block text-xs font-medium text-slate-600">
            {ft('forge.delivery.meetingUrl')}{' '}
            {live.platform === 'jitsi' ? ft('forge.delivery.meetingUrlOptional') : ''}
            <input
              value={live.meetingUrl ?? ''}
              onChange={(e) => setLive({ ...live, meetingUrl: e.target.value })}
              placeholder="https://meet.google.com/..."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            <Clock className="inline h-3.5 w-3.5 mr-1" />
            {ft('forge.delivery.scheduledLabel')}
            <input
              value={live.scheduledLabel ?? ''}
              onChange={(e) => setLive({ ...live, scheduledLabel: e.target.value })}
              placeholder="Sábados 10:00–13:00"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            {ft('forge.delivery.facilitatorNotes')}
            <textarea
              value={live.facilitatorNotes ?? ''}
              onChange={(e) => setLive({ ...live, facilitatorNotes: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={save}
        className="rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {busy ? ft('forge.delivery.saving') : ft('forge.delivery.save')}
      </button>
    </div>
  );
}

export { parseLiveConfig };
