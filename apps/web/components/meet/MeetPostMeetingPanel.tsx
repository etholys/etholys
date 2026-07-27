'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles, Check, X, ListTodo } from 'lucide-react';
import Link from 'next/link';

type ActionItem = {
  id: string;
  title: string;
  notes: string | null;
  assigneeHint: string | null;
  status: string;
  taskId: string | null;
};

type SessionDetail = {
  id: string;
  title: string;
  status: string;
  projectId: string | null;
  summaryText: string | null;
  transcriptText: string | null;
  actionItems: ActionItem[];
};

type Props = {
  companyId: string;
  sessionId: string;
  locale: string;
  onClose: () => void;
  onUpdated: () => void;
};

export function MeetPostMeetingPanel({ companyId, sessionId, locale, onClose, onUpdated }: Props) {
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [briefBusy, setBriefBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<{
    alert: string;
    themes: string[];
    openDecisions: string[];
    suggestedNextSteps: string[];
  } | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/meet/sessions/${sessionId}?companyId=${encodeURIComponent(companyId)}`,
      );
      const d = (await r.json()) as { session?: SessionDetail; error?: string };
      if (!r.ok) throw new Error(d.error || 'Error');
      setDetail(d.session ?? null);
      if (d.session?.transcriptText) setNotes(d.session.transcriptText);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [companyId, sessionId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function runBriefing() {
    setBriefBusy(true);
    setError(null);
    setBriefing(null);
    try {
      const r = await fetch(`/api/meet/sessions/${sessionId}/briefing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, notesSoFar: notes, locale, markLive: true }),
      });
      const d = (await r.json()) as {
        error?: string;
        briefing?: {
          alert: string;
          themes: string[];
          openDecisions: string[];
          suggestedNextSteps: string[];
        };
      };
      if (!r.ok) throw new Error(d.error || 'Error');
      setBriefing(d.briefing ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBriefBusy(false);
    }
  }

  async function runFinalize() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await fetch(`/api/meet/sessions/${sessionId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          notes,
          endMeeting: true,
          replaceDrafts: true,
          locale,
        }),
      });
      const d = (await r.json()) as { error?: string; ai?: { actionItemsCreated?: number } };
      if (!r.ok) throw new Error(d.error || 'Error');
      setMsg(
        t(
          `Resumo gerado. ${d.ai?.actionItemsCreated ?? 0} tarefas em rascunho.`,
          `Resumen generado. ${d.ai?.actionItemsCreated ?? 0} tareas en borrador.`,
          `Summary ready. ${d.ai?.actionItemsCreated ?? 0} draft tasks.`,
        ),
      );
      await loadDetail();
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function actOnItem(actionId: string, action: 'accept' | 'reject' | 'convert') {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/meet/sessions/${sessionId}/actions/${actionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || 'Error');
      await loadDetail();
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function convertAll() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/meet/sessions/${sessionId}/actions/convert-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const d = (await r.json()) as { error?: string; converted?: number };
      if (!r.ok) throw new Error(d.error || 'Error');
      setMsg(
        t(
          `${d.converted ?? 0} tarefas criadas no SIEP.`,
          `${d.converted ?? 0} tareas creadas en SIEP.`,
          `${d.converted ?? 0} tasks created in SIEP.`,
        ),
      );
      await loadDetail();
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
      </div>
    );
  }

  if (!detail) {
    return (
      <p className="text-sm text-red-700">{error || t('Sessão não encontrada', 'Sesión no encontrada', 'Session not found')}</p>
    );
  }

  const drafts = detail.actionItems.filter((a) => a.status === 'draft' || a.status === 'accepted');

  return (
    <div className="space-y-4 rounded-2xl border border-sky-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Sparkles className="h-5 w-5 text-sky-600" />
            {t('Pós-reunião (IA)', 'Post-reunión (IA)', 'Post-meeting (AI)')}
          </h3>
          <p className="mt-0.5 text-sm text-slate-600">{detail.title}</p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
          {t('Fechar', 'Cerrar', 'Close')}
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {t(
          'Gravação: durante a call, no menu «⋯» / Gravar → gravação local → o ficheiro descarrega no teu PC. Cole aqui a transcrição (ou notas) para a IA gerar o resumo. Nuvem automática (R2) vem a seguir.',
          'Grabación: durante la call, menú «⋯» / Grabar → grabación local → el archivo se descarga en tu PC. Pega aquí la transcripción (o notas) para que la IA genere el resumen. Nube automática (R2) viene después.',
          'Recording: during the call, ⋯ / Record → local recording → file downloads to your PC. Paste transcript (or notes) here for AI summary. Automatic cloud (R2) comes next.',
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          {t(
            'Notas ou transcrição da reunião',
            'Notas o transcripción de la reunión',
            'Meeting notes or transcript',
          )}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
          placeholder={t(
            'Cole atas, chat ou transcrição…',
            'Pega actas, chat o transcripción…',
            'Paste minutes, chat, or transcript…',
          )}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={briefBusy || notes.trim().length < 15}
          onClick={() => void runBriefing()}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          {briefBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {t('Alerta em curso', 'Alerta en curso', 'Live alert')}
        </button>
        <button
          type="button"
          disabled={busy || notes.trim().length < 20}
          onClick={() => void runFinalize()}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {t('Encerrar + gerar resumo e tarefas', 'Cerrar + generar resumen y tareas', 'End + generate summary & tasks')}
        </button>
      </div>

      {briefing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">
            {t('Encaminhamento (hipótese)', 'Encaminamiento (hipótesis)', 'Direction (hypothesis)')}
          </p>
          <p className="mt-1">{briefing.alert}</p>
          {briefing.themes.length > 0 && (
            <p className="mt-2 text-xs">
              <span className="font-semibold">{t('Temas', 'Temas', 'Themes')}:</span> {briefing.themes.join(' · ')}
            </p>
          )}
          {briefing.openDecisions.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs">
              {briefing.openDecisions.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
          {briefing.suggestedNextSteps.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-xs">
              {briefing.suggestedNextSteps.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!detail.projectId && (
        <p className="text-xs text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          {t(
            'Sem projeto SIEP vinculado: pode gerar rascunhos, mas «Converter em tarefa» exige vínculo ao criar a reunião.',
            'Sin proyecto SIEP: puedes generar borradores, pero convertir a tarea requiere vínculo al crear la reunión.',
            'No SIEP project linked: you can generate drafts, but converting to tasks needs a project when creating the meeting.',
          )}
        </p>
      )}

      {detail.summaryText && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('Resumo', 'Resumen', 'Summary')}
          </p>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-800 font-sans">{detail.summaryText}</pre>
        </div>
      )}

      {detail.actionItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-1">
              <ListTodo className="h-4 w-4" />
              {t('Tarefas para validação', 'Tareas para validación', 'Tasks for validation')}
            </p>
            {detail.projectId && drafts.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void convertAll()}
                className="text-xs font-semibold text-sky-700 hover:underline disabled:opacity-50"
              >
                {t('Converter todas no SIEP', 'Convertir todas en SIEP', 'Convert all to SIEP')}
              </button>
            )}
          </div>
          <ul className="mt-2 space-y-2">
            {detail.actionItems.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{a.title}</p>
                    {a.notes && <p className="mt-0.5 text-xs text-slate-600">{a.notes}</p>}
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                      {a.status}
                      {a.assigneeHint ? ` · ${a.assigneeHint}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {a.status === 'draft' && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void actOnItem(a.id, 'accept')}
                          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800"
                          title="Accept"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void actOnItem(a.id, 'reject')}
                          className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-800"
                          title="Reject"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    )}
                    {(a.status === 'draft' || a.status === 'accepted') && !a.taskId && detail.projectId && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void actOnItem(a.id, 'convert')}
                        className="rounded bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white"
                      >
                        {t('→ SIEP', '→ SIEP', '→ SIEP')}
                      </button>
                    )}
                    {a.taskId && (
                      <Link
                        href={`/siep/projects/${detail.projectId}`}
                        className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700"
                      >
                        {t('Ver projeto', 'Ver proyecto', 'View project')}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {msg && <p className="text-sm text-emerald-800">{msg}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
