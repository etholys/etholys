'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  type ForgeDeliveryMode,
  type ForgeLiveConfig,
  resolveMeetingUrl,
  isJitsiEmbeddable,
  jitsiEmbedUrl,
  showsLiveFeatures,
} from '@/lib/forge/delivery';
import {
  formatSessionWhen,
  pickFeaturedSession,
  type SerializedLiveSession,
} from '@/lib/forge/live-sessions';
import { Calendar, ExternalLink, Video, ChevronDown, ChevronUp, Radio, UserCog, PlayCircle } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { useApp } from '@/app/providers';
import type { Locale } from '@/lib/i18n';

type Props = {
  courseId: string;
  deliveryMode: ForgeDeliveryMode;
  liveConfig: ForgeLiveConfig;
  showFacilitatorNotes?: boolean;
  /** Sala de preparación / moderador (solo en modo edición) */
  showFacilitatorRoom?: boolean;
  compact?: boolean;
  currentActivityId?: string;
};

export function ForgeLivePanel({
  courseId,
  deliveryMode,
  liveConfig,
  showFacilitatorNotes = false,
  showFacilitatorRoom = false,
  compact = false,
  currentActivityId,
}: Props) {
  const ft = useForgeT();
  const { locale } = useApp();
  const loc = (locale as Locale) || 'es';
  const [expanded, setExpanded] = useState(!compact);
  const [sessions, setSessions] = useState<SerializedLiveSession[]>([]);

  useEffect(() => {
    if (!showsLiveFeatures(deliveryMode)) return;
    fetch(`/api/forge/courses/${courseId}/live-sessions`)
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions ?? []))
      .catch(() => {});
  }, [courseId, deliveryMode]);

  useEffect(() => {
    const live = sessions.find((s) => s.status === 'live');
    if (!live) return;
    fetch(`/api/forge/live-sessions/${live.id}/attendance`, { method: 'POST' }).catch(() => {});
  }, [sessions]);

  const featured = useMemo(() => pickFeaturedSession(sessions), [sessions]);
  const sessionOverride = featured?.meetingUrl ?? null;

  const learnerUrl = useMemo(
    () => resolveMeetingUrl(liveConfig, courseId, 'learner', sessionOverride),
    [liveConfig, courseId, sessionOverride]
  );
  const facilitatorUrl = useMemo(
    () => resolveMeetingUrl(liveConfig, courseId, 'facilitator', sessionOverride),
    [liveConfig, courseId, sessionOverride]
  );

  if (!showsLiveFeatures(deliveryMode) || !learnerUrl) return null;

  const embed = isJitsiEmbeddable(learnerUrl);
  const iframeSrc = embed && !learnerUrl.includes('localhost') ? jitsiEmbedUrl(learnerUrl) : null;
  const upcoming = sessions.filter((s) => s.status === 'upcoming').slice(0, 5);
  const recordings = sessions.filter((s) => s.recordingUrl && s.status === 'past').slice(0, 6);

  const focusLink =
    featured?.activityId && featured.status !== 'past'
      ? `/hub/forge/cursos/${courseId}/atividade/${featured.activityId}`
      : currentActivityId
        ? null
        : null;

  return (
    <div
      id="forge-live-panel"
      className="rounded-2xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 to-blue-50 overflow-hidden shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 p-4 border-b border-sky-200/80">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shrink-0">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-sky-800">
              {ft('forge.live.title')}
            </p>
            {featured?.status === 'live' && (
              <p className="mt-1 flex items-center gap-1 text-sm font-bold text-emerald-800">
                <Radio className="h-4 w-4 animate-pulse" />
                {featured.title} — ahora
              </p>
            )}
            {featured?.status === 'upcoming' && !liveConfig.scheduledLabel && (
              <p className="mt-1 text-sm font-semibold text-slate-800">
                Próxima: {featured.title} · {formatSessionWhen(featured.startsAt, loc)}
              </p>
            )}
            {liveConfig.scheduledLabel && (
              <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-800">
                <Calendar className="h-4 w-4 text-sky-600" />
                {liveConfig.scheduledLabel}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-600">
              Únete a la videollamada con el facilitador. En juegos, comparte pantalla o juega en paralelo
              con cámara y micrófono.
            </p>
          </div>
        </div>
        {compact && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="rounded-lg p-2 text-sky-700 hover:bg-sky-100"
          >
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        )}
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <a
              href={learnerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-700"
            >
              <Video className="h-4 w-4" />
              {ft('forge.live.join')}
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
            {showFacilitatorRoom && facilitatorUrl && facilitatorUrl !== learnerUrl && (
              <a
                href={facilitatorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-violet-400 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-900 hover:bg-violet-100"
              >
                <UserCog className="h-4 w-4" />
                Sala facilitador
              </a>
            )}
            {focusLink && (
              <Link
                href={focusLink}
                className="inline-flex items-center rounded-xl border border-sky-400 bg-white px-4 py-2.5 text-sm font-semibold text-sky-900 hover:bg-sky-50"
              >
                Ir a actividad de la sesión
              </Link>
            )}
            {deliveryMode === 'blended' && (
              <span className="inline-flex items-center rounded-xl border border-sky-300 bg-white px-4 py-2 text-xs font-medium text-sky-900">
                También puedes avanzar el contenido a tu ritmo
              </span>
            )}
          </div>

          {recordings.length > 0 && (
            <div className="rounded-xl border border-violet-200 bg-white/80 p-3">
              <p className="text-xs font-bold uppercase text-violet-800">{ft('forge.live.recordings')}</p>
              <ul className="mt-2 space-y-2">
                {recordings.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-800">{s.title}</span>
                    <a
                      href={s.recordingUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-violet-700 px-3 py-1 text-xs font-bold text-white hover:bg-violet-800"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      {ft('forge.live.recording')}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="rounded-xl border border-sky-200 bg-white/80 p-3">
              <p className="text-xs font-bold uppercase text-sky-800">Calendario</p>
              <ul className="mt-2 space-y-1.5">
                {upcoming.map((s) => (
                  <li key={s.id} className="flex justify-between gap-2 text-sm text-slate-700">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-xs text-slate-500 shrink-0">
                      {formatSessionWhen(s.startsAt, loc)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {iframeSrc && (
            <div className="rounded-xl overflow-hidden border border-sky-200 bg-black/5">
              <p className="px-3 py-2 text-[10px] font-bold uppercase text-sky-800 bg-sky-100/80">
                Vista previa — sala alumnos (Jitsi)
              </p>
              <iframe
                title="Videollamada"
                src={iframeSrc}
                allow="camera; microphone; fullscreen; display-capture"
                className="w-full aspect-video min-h-[240px] bg-slate-900"
              />
            </div>
          )}

          {showFacilitatorNotes && liveConfig.facilitatorNotes && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-950">
              <p className="text-xs font-bold uppercase text-amber-800">Notas del facilitador</p>
              <p className="mt-1 whitespace-pre-wrap">{liveConfig.facilitatorNotes}</p>
            </div>
          )}
          {showFacilitatorNotes && featured?.facilitatorNotes && (
            <div className="rounded-lg bg-amber-50/80 border border-amber-200 p-3 text-sm text-amber-950">
              <p className="text-xs font-bold uppercase text-amber-800">Sesión actual</p>
              <p className="mt-1 whitespace-pre-wrap">{featured.facilitatorNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
