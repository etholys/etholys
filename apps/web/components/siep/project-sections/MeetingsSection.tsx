'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Video,
  Plus,
  Loader2,
  Download,
  FileText,
} from 'lucide-react';
import type { SectionProps } from './types';
import { SectionTooltip } from './SectionTooltip';
import { meetHubJoinPath, meetRecapPath } from '@/lib/meet/types';
import { useApp } from '@/app/providers';

type MeetRow = {
  id: string;
  title: string;
  status: string;
  mirror: string;
  scheduledAt: string | null;
  meetingUrl: string | null;
  _count?: { participants: number; actionItems: number };
};

export function MeetingsSection({ project }: SectionProps) {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const companyId = project?.companyId as string | undefined;
  const projectId = project?.id as string | undefined;

  const [sessions, setSessions] = useState<MeetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/meet/sessions?companyId=${encodeURIComponent(companyId)}&projectId=${encodeURIComponent(projectId)}`,
      );
      const d = (await r.json()) as { sessions?: MeetRow[]; error?: string };
      if (!r.ok) throw new Error(d.error || 'Error');
      setSessions(d.sessions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createMeeting(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !projectId || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/meet/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          projectId,
          mirror: 'siep',
          title: title.trim(),
          locale,
        }),
      });
      const d = (await r.json()) as { session?: { id?: string; meetingUrl?: string }; error?: string };
      if (!r.ok) throw new Error(d.error || 'Error');
      setTitle('');
      await load();
      if (d.session?.id && companyId) {
        window.location.href = meetHubJoinPath(d.session.id, companyId);
      } else if (d.session?.meetingUrl) {
        window.open(d.session.meetingUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Video className="h-5 w-5 text-sky-600" />
            {t('Reuniões Meet', 'Reuniones Meet', 'Meet meetings')}
            <SectionTooltip
              title="Etholys Meet"
              content={t(
                'Reuniões ligadas a este projeto. Após a chamada, gere resumo e tarefas.',
                'Reuniones ligadas a este proyecto. Tras la llamada, genera resumen y tareas.',
                'Meetings linked to this project. After the call, generate a summary and tasks.',
              )}
            />
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t(
              'Crie e abra reuniões deste projeto.',
              'Cree y abra reuniones de este proyecto.',
              'Create and open meetings for this project.',
            )}
          </p>
        </div>
        <Link
          href="/hub/meet"
          className="text-sm font-medium text-sky-700 hover:underline"
        >
          {t('Abrir Hub Meet', 'Abrir Hub Meet', 'Open Meet Hub')}
        </Link>
      </div>

      <form
        onSubmit={createMeeting}
        className="flex flex-col gap-3 rounded-xl border border-dashed border-sky-300 bg-sky-50/40 p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600">
            {t('Nova reunião do projeto', 'Nueva reunión del proyecto', 'New project meeting')}
          </label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder={t(
              'Ex.: Semanal com doador',
              'Ej.: Semanal con donante',
              'E.g. Weekly donor sync',
            )}
          />
        </div>
        <button
          type="submit"
          disabled={saving || !companyId}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t('Criar e abrir sala', 'Crear y abrir sala', 'Create & open room')}
        </button>
      </form>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          {t('Ainda não há reuniões neste projeto.', 'Aún no hay reuniones en este proyecto.', 'No meetings on this project yet.')}
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-gray-900">{s.title}</p>
                <p className="text-xs text-gray-500">
                  {s.status}
                  {s.scheduledAt
                    ? ` · ${new Date(s.scheduledAt).toLocaleString(locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES')}`
                    : ''}
                  {s._count?.actionItems
                    ? ` · ${s._count.actionItems} ${t('ações IA', 'acciones IA', 'AI actions')}`
                    : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {s.meetingUrl && companyId && (
                  <Link
                    href={meetHubJoinPath(s.id, companyId)}
                    className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {t('Entrar', 'Entrar', 'Join')}
                  </Link>
                )}
                {companyId && (
                  <a
                    href={`/api/meet/sessions/${s.id}/ics?companyId=${encodeURIComponent(companyId)}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
                  >
                    <Download className="h-3 w-3" />
                    .ics
                  </a>
                )}
                {companyId && (
                  <Link
                    href={meetRecapPath(s.id, companyId)}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800"
                  >
                    <FileText className="h-3 w-3" />
                    {t('Transcrição', 'Transcripción', 'Transcript')}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}
