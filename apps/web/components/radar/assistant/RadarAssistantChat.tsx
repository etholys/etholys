'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, ImagePlus, Loader2, Send, Sparkles, Workflow, X } from 'lucide-react';
import { radarLoc, radarT } from '@/lib/radar/i18n';
import { hrefForAction } from '@/lib/radar/assistant/parse-actions';
import type {
  RadarAssistantAction,
  RadarAssistantContextSnapshot,
} from '@/lib/radar/assistant/types';

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: RadarAssistantAction[];
  visionUsed?: boolean;
  previewUrl?: string;
};

export function RadarAssistantChat({
  companyId,
  engagementId,
  clientId,
  propertyId,
  locale,
  qs,
}: {
  companyId: string;
  engagementId?: string | null;
  clientId?: string | null;
  propertyId?: string | null;
  locale: string;
  qs: string;
}) {
  const loc = radarLoc(locale);
  const [ctx, setCtx] = useState<RadarAssistantContextSnapshot | null>(null);
  const [ctxErr, setCtxErr] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [llmOk, setLlmOk] = useState<boolean | null>(null);
  const [image, setImage] = useState<{ base64: string; mime: string; preview: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCtx = useCallback(() => {
    if (!companyId) return;
    const q = new URLSearchParams({ companyId, locale: loc });
    if (engagementId) q.set('engagementId', engagementId);
    if (clientId) q.set('clientId', clientId);
    if (propertyId) q.set('propertyId', propertyId);
    void fetch(`/api/radar/assistant/context?${q}`, { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Erro');
        setCtx(d.context as RadarAssistantContextSnapshot);
        setCtxErr(null);
      })
      .catch((e: unknown) => setCtxErr(e instanceof Error ? e.message : 'Erro'));
  }, [clientId, companyId, engagementId, loc, propertyId]);

  useEffect(() => {
    loadCtx();
  }, [loadCtx]);

  useEffect(() => {
    void fetch('/api/llm-health', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setLlmOk(Boolean(d?.ok)))
      .catch(() => setLlmOk(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, busy]);

  const onPickImage = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 4_500_000) {
      setCtxErr(
        radarT(
          loc,
          'Imagem demasiado grande (máx. ~4 MB).',
          'Imagen demasiado grande (máx. ~4 MB).',
          'Image too large (max ~4 MB).',
        ),
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
      setImage({ base64, mime: file.type, preview: dataUrl });
      setCtxErr(null);
    };
    reader.readAsDataURL(file);
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !image) || busy || !companyId) return;
    setBusy(true);
    const userMsg: Msg = {
      id: `u_${Date.now()}`,
      role: 'user',
      content:
        text ||
        radarT(loc, '(foto anexada)', '(foto adjunta)', '(photo attached)'),
      previewUrl: image?.preview,
    };
    setMsgs((m) => [...m, userMsg]);
    setInput('');
    const img = image;
    setImage(null);

    try {
      const history = msgs
        .slice(-8)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const res = await fetch('/api/radar/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId: engagementId || undefined,
          clientId: clientId || undefined,
          propertyId: propertyId || ctx?.propertyId || undefined,
          locale: loc,
          message: text,
          history,
          imageBase64: img?.base64,
          imageMimeType: img?.mime,
          createSuggestedTasks: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || PUBLIC_ERR);
      setMsgs((m) => [
        ...m,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: String(d.reply || ''),
          actions: Array.isArray(d.actions) ? d.actions : [],
          visionUsed: Boolean(d.visionUsed),
        },
      ]);
      loadCtx();
    } catch (e: unknown) {
      setMsgs((m) => [
        ...m,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: e instanceof Error ? e.message : PUBLIC_ERR,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const sectorLabel = ctx?.sectorLabel?.[loc] || ctx?.sectorLabel?.pt || '—';
  const autoHref = `/hub/radar/automatizacao${qs}${qs.includes('?') ? '&' : '?'}property=${ctx?.propertyId || ''}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <section className="flex min-h-[32rem] flex-col rounded-2xl border border-white/10 bg-[#0a1620]/80">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-200/70">
              {radarT(loc, 'Assistente RADAR', 'Asistente RADAR', 'RADAR Assistant')}
            </p>
            <h1 className="mt-1 font-serif text-2xl text-white">
              {ctx?.propertyName || radarT(loc, 'Operação', 'Operación', 'Operation')}
            </h1>
            <p className="mt-1 text-sm text-white/50">
              {radarT(loc, 'Agente', 'Agente', 'Agent')}: {sectorLabel}
              {llmOk === false ? (
                <span className="ml-2 text-amber-200/80">
                  · {radarT(loc, 'IA indisponível', 'IA no disponible', 'AI unavailable')}
                </span>
              ) : null}
            </p>
          </div>
          <Link
            href={autoHref}
            className="inline-flex items-center gap-2 rounded-full border border-teal-400/35 bg-teal-500/10 px-3.5 py-2 text-xs font-semibold text-teal-100 transition hover:bg-teal-500/20"
          >
            <Workflow className="h-3.5 w-3.5" />
            {radarT(loc, 'Automatização', 'Automatización', 'Automation')}
          </Link>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {msgs.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-sm text-white/55">
              <p className="flex items-center gap-2 font-medium text-white/80">
                <Sparkles className="h-4 w-4 text-teal-300" />
                {radarT(
                  loc,
                  'Pergunta o que fazer, o que está errado, ou envia uma foto.',
                  'Preguntá qué hacer, qué está mal, o enviá una foto.',
                  'Ask what to do, what’s wrong, or send a photo.',
                )}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/40">
                {radarT(
                  loc,
                  'Visão multimodal activa: a foto é analisada pelo modelo. Hipóteses, não diagnóstico certo.',
                  'Visión multimodal activa: la foto la analiza el modelo. Hipótesis, no diagnóstico seguro.',
                  'Multimodal vision is on: the model reads the photo. Hypotheses, not a sure diagnosis.',
                )}
              </p>
            </div>
          )}
          {msgs.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[min(100%,36rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-teal-400/15 text-teal-50'
                    : 'bg-[#12202c] text-white/90'
                }`}
              >
                {m.role === 'assistant' && (
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-200/60">
                    <Bot className="h-3 w-3" />
                    {sectorLabel}
                    {m.visionUsed
                      ? ` · ${radarT(loc, 'foto lida', 'foto leída', 'photo read')}`
                      : ''}
                  </p>
                )}
                {m.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.previewUrl}
                    alt=""
                    className="mb-2 max-h-40 rounded-lg border border-white/10 object-cover"
                  />
                )}
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.actions.map((a, i) => (
                      <Link
                        key={`${a.type}_${i}`}
                        href={a.href || hrefForAction(a, qs)}
                        className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/85 transition hover:border-teal-400/40 hover:bg-teal-500/10"
                      >
                        {a.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <p className="flex items-center gap-2 text-xs text-white/40">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {radarT(loc, 'A pensar…', 'Pensando…', 'Thinking…')}
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-white/[0.07] px-4 py-3">
          {image && (
            <div className="mb-2 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.preview} alt="" className="h-12 w-12 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => setImage(null)}
                className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {ctxErr && <p className="mb-2 text-xs text-rose-200">{ctxErr}</p>}
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickImage(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-white/15 p-2.5 text-white/60 transition hover:border-teal-400/40 hover:text-teal-100"
              title={radarT(loc, 'Foto', 'Foto', 'Photo')}
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder={radarT(
                loc,
                'O que precisa de atenção? Ou descreve a situação…',
                '¿Qué necesita atención? O describí la situación…',
                'What needs attention? Or describe the situation…',
              )}
              className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-white/15 bg-[#07111A] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-teal-400/40"
            />
            <button
              type="button"
              disabled={busy || (!input.trim() && !image) || llmOk === false}
              onClick={() => void send()}
              className="rounded-xl bg-teal-400 px-3.5 py-2.5 text-slate-950 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </section>

      <aside className="space-y-5 text-sm">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/35">
            {radarT(loc, 'Secretária — setup', 'Secretaria — setup', 'Secretary — setup')}
          </p>
          {!ctx ? (
            <p className="mt-2 text-white/40">
              <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> …
            </p>
          ) : ctx.checklist.length === 0 ? (
            <p className="mt-2 text-white/50">
              {radarT(loc, 'Setup em ordem.', 'Setup en orden.', 'Setup looks complete.')}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {ctx.checklist.map((g) => (
                <li key={g.id}>
                  {g.href ? (
                    <Link href={`${g.href}${qs.includes('?') && !g.href.includes('?') ? qs : ''}`} className="block text-white/75 hover:text-teal-100">
                      <span className="text-amber-200/80">·</span> {g.message[loc]}
                    </Link>
                  ) : (
                    <span className="text-white/75">
                      <span className="text-amber-200/80">·</span> {g.message[loc]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {ctx && ctx.alerts.length > 0 && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/35">
              {radarT(loc, 'Alertas', 'Avisos', 'Alerts')}
            </p>
            <ul className="mt-2 space-y-1.5 text-white/70">
              {ctx.alerts.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link href={`${a.href}${qs}`} className="hover:text-teal-100">
                    {a.message}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ctx && ctx.openTasks.length > 0 && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/35">
              {radarT(loc, 'Tarefas abertas', 'Tareas abiertas', 'Open tasks')}
            </p>
            <ul className="mt-2 space-y-1.5 text-white/70">
              {ctx.openTasks.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link href={`/hub/radar/tarefas${qs}`} className="hover:text-teal-100">
                    {t.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {ctx && ctx.sensors.length > 0 && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/35">
              {radarT(loc, 'Sensores', 'Sensores', 'Sensors')}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-white/55">
              {ctx.sensors.slice(0, 6).map((s) => (
                <li key={s.id}>
                  {s.name}
                  {s.lastValue != null ? ` · ${s.lastValue}` : ''}
                  {s.unitName ? ` · ${s.unitName}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

const PUBLIC_ERR = 'O serviço de IA está temporariamente indisponível.';
