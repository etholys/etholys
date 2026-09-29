import type { AuroraLocale } from './aurora-interview';
import { AURORA_RHYTHM_STALE_MS, type AuroraMethodStage, type AuroraPortfolioItem } from './aurora-portfolio';

export const AURORA_STAGES: AuroraMethodStage[] = ['talk', 'portrait', 'bets', 'rhythm', 'steady'];

export type AuroraAttention = 'unclaimed' | 'blocked' | 'stale' | 'talk' | 'portrait' | 'bets' | 'steady';

export function auroraStaleDays(lastRhythmAt: string | null, now = new Date()): number | null {
  if (!lastRhythmAt) return null;
  const t = new Date(lastRhythmAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000));
}

export function auroraIsBlocked(item: Pick<AuroraPortfolioItem, 'lastRhythmBlocked'>): boolean {
  return item.lastRhythmBlocked.trim().length > 0;
}

export function auroraAttention(item: AuroraPortfolioItem): AuroraAttention {
  if (!item.technicianUserId) return 'unclaimed';
  if (auroraIsBlocked(item)) return 'blocked';
  if (item.stage === 'talk' || item.stage === 'portrait' || item.stage === 'bets' || item.stage === 'rhythm') {
    return item.stage;
  }
  return 'steady';
}

export function auroraNextAction(item: AuroraPortfolioItem, locale: AuroraLocale): string {
  if (!item.technicianUserId) {
    if (locale === 'es') return 'Acompañar este negocio';
    if (locale === 'en') return 'Take this business';
    return 'Acompanhar este negócio';
  }
  if (auroraIsBlocked(item)) {
    const block = item.lastRhythmBlocked.slice(0, 80);
    if (locale === 'es') return `Destrabar: ${block}`;
    if (locale === 'en') return `Unblock: ${block}`;
    return `Destravar: ${block}`;
  }
  if (item.stage === 'talk') {
    if (!item.diagnosticComplete && (item.diagnosticDone ?? 0) === 0) {
      if (locale === 'es') return 'Abrir el diagnóstico por áreas';
      if (locale === 'en') return 'Open the area diagnostic';
      return 'Abrir o diagnóstico por áreas';
    }
    if (locale === 'es') return 'Seguir el diagnóstico o profundizar en el dossier';
    if (locale === 'en') return 'Continue the diagnostic or go deeper in the dossier';
    return 'Seguir o diagnóstico ou aprofundar no dossiê';
  }
  if (item.stage === 'portrait') {
    if (locale === 'es') return 'Corregir el retrato y aceptar la hipótesis';
    if (locale === 'en') return 'Correct the portrait and accept the hypothesis';
    return 'Corrigir o retrato e aceitar a hipótese';
  }
  if (item.stage === 'bets') {
    const need = Math.max(0, 2 - item.openBetCount);
    if (locale === 'es') return need ? `Cerrar ${need} apuesta${need === 1 ? '' : 's'} más` : 'Mover las apuestas';
    if (locale === 'en') return need ? `Close ${need} more bet${need === 1 ? '' : 's'}` : 'Move the bets';
    return need ? `Fechar mais ${need} aposta${need === 1 ? '' : 's'}` : 'Mover as apostas';
  }
  if (item.stage === 'rhythm') {
    if (item.lastRhythmNext) {
      if (locale === 'es') return `Anotar la semana — ${item.lastRhythmNext.slice(0, 80)}`;
      if (locale === 'en') return `Log the week — ${item.lastRhythmNext.slice(0, 80)}`;
      return `Anotar a semana — ${item.lastRhythmNext.slice(0, 80)}`;
    }
    if (locale === 'es') return 'Anotar qué pasó, qué traba, el próximo paso';
    if (locale === 'en') return 'Log what happened, what is stuck, the next step';
    return 'Anotar o que aconteceu, o que trava, o próximo passo';
  }
  if (locale === 'es') return item.lastRhythmNext || 'Mantener el ritmo';
  if (locale === 'en') return item.lastRhythmNext || 'Keep the rhythm';
  return item.lastRhythmNext || 'Manter o ritmo';
}

export type AuroraWeekBuckets = {
  round: AuroraPortfolioItem[];
  blocked: AuroraPortfolioItem[];
  unclaimed: AuroraPortfolioItem[];
  stale: AuroraPortfolioItem[];
  talk: AuroraPortfolioItem[];
};

export function auroraWeekBuckets(items: AuroraPortfolioItem[]): AuroraWeekBuckets {
  return {
    round: items.filter((i) => i.mine && i.stage !== 'steady'),
    blocked: items.filter(auroraIsBlocked),
    unclaimed: items.filter((i) => !i.technicianUserId),
    stale: items.filter((i) => i.stage === 'rhythm'),
    talk: items.filter((i) => i.stage === 'talk'),
  };
}

export type AuroraProgramGroup = {
  engagementId: string;
  title: string;
  items: AuroraPortfolioItem[];
  mine: number;
  unclaimed: number;
  needsAttention: number;
};

export function groupAuroraByProgram(items: AuroraPortfolioItem[]): AuroraProgramGroup[] {
  const map = new Map<string, AuroraProgramGroup>();
  for (const item of items) {
    const key = item.engagementId || item.engagementTitle || item.companyId;
    const prev = map.get(key);
    if (prev) {
      prev.items.push(item);
      if (item.mine) prev.mine += 1;
      if (!item.technicianUserId) prev.unclaimed += 1;
      if (item.stage !== 'steady') prev.needsAttention += 1;
    } else {
      map.set(key, {
        engagementId: item.engagementId,
        title: item.engagementTitle || item.name,
        items: [item],
        mine: item.mine ? 1 : 0,
        unclaimed: item.technicianUserId ? 0 : 1,
        needsAttention: item.stage === 'steady' ? 0 : 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.needsAttention - a.needsAttention || b.items.length - a.items.length);
}

export type AuroraPortfolioCounts = {
  total: number;
  mine: number;
  unclaimed: number;
  blocked: number;
  needsAttention: number;
  talk: number;
  portrait: number;
  bets: number;
  rhythm: number;
  steady: number;
  programs: number;
};

export function auroraPortfolioCounts(items: AuroraPortfolioItem[]): AuroraPortfolioCounts {
  return {
    total: items.length,
    mine: items.filter((i) => i.mine).length,
    unclaimed: items.filter((i) => !i.technicianUserId).length,
    blocked: items.filter(auroraIsBlocked).length,
    needsAttention: items.filter((i) => i.stage !== 'steady').length,
    talk: items.filter((i) => i.stage === 'talk').length,
    portrait: items.filter((i) => i.stage === 'portrait').length,
    bets: items.filter((i) => i.stage === 'bets').length,
    rhythm: items.filter((i) => i.stage === 'rhythm').length,
    steady: items.filter((i) => i.stage === 'steady').length,
    programs: new Set(items.map((i) => i.engagementId)).size,
  };
}

export function auroraWeekBriefing(items: AuroraPortfolioItem[], locale: AuroraLocale): string[] {
  const buckets = auroraWeekBuckets(items);
  const lines: string[] = [];
  const n = (count: number, one: string, many: string) => (count === 1 ? one : many);

  if (locale === 'es') {
    if (buckets.round.length) {
      lines.push(
        n(
          buckets.round.length,
          `1 negocio tuyo pide la ronda de esta semana.`,
          `${buckets.round.length} negocios tuyos piden la ronda de esta semana.`,
        ),
      );
    }
    if (buckets.unclaimed.length) {
      lines.push(
        n(buckets.unclaimed.length, '1 negocio sin técnico.', `${buckets.unclaimed.length} negocios sin técnico.`),
      );
    }
    if (buckets.talk.length) {
      lines.push(
        n(
          buckets.talk.length,
          '1 negocio todavía no tiene retrato — hay que conversar.',
          `${buckets.talk.length} negocios todavía no tienen retrato — hay que conversar.`,
        ),
      );
    }
  } else if (locale === 'en') {
    if (buckets.round.length) {
      lines.push(
        n(
          buckets.round.length,
          `1 of your businesses needs this week's round.`,
          `${buckets.round.length} of your businesses need this week's round.`,
        ),
      );
    }
    if (buckets.unclaimed.length) {
      lines.push(
        n(buckets.unclaimed.length, '1 business has no technician.', `${buckets.unclaimed.length} businesses have no technician.`),
      );
    }
    if (buckets.talk.length) {
      lines.push(
        n(
          buckets.talk.length,
          '1 business still has no portrait — start the conversation.',
          `${buckets.talk.length} businesses still have no portrait — start the conversation.`,
        ),
      );
    }
  } else {
    if (buckets.round.length) {
      lines.push(
        n(
          buckets.round.length,
          '1 negócio teu pede a ronda desta semana.',
          `${buckets.round.length} negócios teus pedem a ronda desta semana.`,
        ),
      );
    }
    if (buckets.unclaimed.length) {
      lines.push(
        n(buckets.unclaimed.length, '1 negócio sem técnico.', `${buckets.unclaimed.length} negócios sem técnico.`),
      );
    }
    if (buckets.talk.length) {
      lines.push(
        n(
          buckets.talk.length,
          '1 negócio ainda não tem retrato — falta conversar.',
          `${buckets.talk.length} negócios ainda não têm retrato — falta conversar.`,
        ),
      );
    }
  }

  for (const row of buckets.blocked.slice(0, 4)) {
    const name = row.shortName || row.name;
    const block = row.lastRhythmBlocked.slice(0, 120);
    lines.push(`${name}: ${block}`);
  }

  if (!lines.length) {
    if (locale === 'es') lines.push('La cartera está en ritmo. Anotá la semana si algo cambió.');
    else if (locale === 'en') lines.push('The portfolio is on rhythm. Log the week if something changed.');
    else lines.push('A carteira está em ritmo. Anota a semana se algo mudou.');
  }

  return lines.slice(0, 8);
}

export function auroraDueSoon(dueAt: Date | string | null | undefined, now = new Date()): boolean {
  if (!dueAt) return false;
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return false;
  const delta = t - now.getTime();
  return delta >= -AURORA_RHYTHM_STALE_MS && delta <= AURORA_RHYTHM_STALE_MS;
}
