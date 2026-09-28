import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { publicLotSnapshot } from '@/lib/radar/trace';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const lot = await prisma.radarLot.findFirst({
    where: { publicToken: String(token || '').trim() },
    select: { code: true },
  });
  return {
    title: lot ? `RADAR · ${lot.code}` : 'Traçabilidade RADAR',
    robots: { index: false, follow: false },
  };
}

function pickLabel(label: { pt: string; es: string; en: string }, lang: string) {
  if (lang === 'es') return label.es;
  if (lang === 'en') return label.en;
  return label.pt;
}

export default async function RadarLotePublicPage({ params }: Props) {
  const { token } = await params;
  const publicToken = String(token || '').trim();

  const lot = publicToken.length >= 12
    ? await prisma.radarLot.findFirst({
        where: { publicToken },
        include: { events: { orderBy: { occurredAt: 'asc' } } },
      })
    : null;

  if (!lot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0a12] px-6 text-white">
        <div className="max-w-md text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">RADAR</p>
          <h1 className="mt-3 font-serif text-3xl">Lote não encontrado</h1>
          <p className="mt-2 text-sm text-white/50">O link de traçabilidade é inválido ou expirou.</p>
        </div>
      </div>
    );
  }

  const snap = publicLotSnapshot({
    code: lot.code,
    crop: lot.crop,
    qty: lot.qty,
    unitLabel: lot.unitLabel,
    currentStage: lot.currentStage,
    status: lot.status,
    createdAt: lot.createdAt,
    events: lot.events.map((e) => ({
      stage: e.stage,
      occurredAt: e.occurredAt,
      payloadJson: e.payloadJson,
      channel: e.channel,
    })),
  });

  const lang = 'pt';
  const stageNow = pickLabel(snap.stageLabel, lang);

  return (
    <div className="min-h-screen bg-[#0b0a12] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 20% 0%, rgba(124,58,237,0.22), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(16,185,129,0.12), transparent 50%)',
        }}
      />
      <main className="relative z-10 mx-auto max-w-2xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Traçabilidade RADAR</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">{snap.code}</h1>
        <p className="mt-2 text-sm text-white/60">
          {[snap.crop, snap.qty != null ? `${snap.qty} ${snap.unitLabel}` : null].filter(Boolean).join(' · ') ||
            'Lote produtivo'}
        </p>
        <p className="mt-4 text-lg text-emerald-200/90">
          Agora: <span className="font-medium text-white">{stageNow}</span>
          {snap.status === 'closed' ? ' · comercializado' : ''}
        </p>

        <ol className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {snap.stages.map((s) => (
            <li
              key={s.id}
              className={`rounded-xl border px-3 py-3 text-center text-xs ${
                s.current
                  ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-50'
                  : s.done
                    ? 'border-white/20 text-white/75'
                    : 'border-white/10 text-white/35'
              }`}
            >
              {pickLabel(s.label, lang)}
            </li>
          ))}
        </ol>

        <section className="mt-12">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Linha do tempo</h2>
          <ol className="mt-4 space-y-4 border-l border-white/15 pl-5">
            {snap.timeline.map((ev, i) => (
              <li key={`${ev.stage}-${ev.occurredAt}-${i}`} className="relative">
                <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-violet-400/80" />
                <p className="text-sm font-medium text-white">{pickLabel(ev.stageLabel, lang)}</p>
                <p className="text-xs text-white/45">
                  {new Date(ev.occurredAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {ev.channel === 'whatsapp' ? ' · WhatsApp' : ''}
                </p>
                {(ev.note || ev.destination || ev.buyer || ev.carrier) && (
                  <p className="mt-1 text-sm text-white/70">
                    {[ev.note, ev.destination, ev.carrier, ev.buyer].filter(Boolean).join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-16 text-center text-[11px] text-white/30">Etholys RADAR · partilha de traçabilidade</p>
      </main>
    </div>
  );
}
