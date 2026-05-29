import 'server-only';

import type { Locale } from '@/lib/i18n';
import { forgeT, forgeTFormat } from '@/lib/forge/i18n';

export function parseForgeEmailLocale(v: unknown): Locale {
  if (v === 'pt' || v === 'en' || v === 'es') return v;
  return 'es';
}

export function buildForgeInviteEmailHtml(opts: {
  courseTitle: string;
  inviteUrl: string;
  inviterName?: string | null;
  toEmail: string;
  locale?: Locale;
}): { subject: string; html: string } {
  const loc = opts.locale ?? 'es';
  const inviter = opts.inviterName?.trim();
  const intro = inviter
    ? forgeTFormat('forge.email.invite.introNamed', loc, { name: inviter })
    : forgeT('forge.email.invite.intro', loc);

  const subject = forgeTFormat('forge.email.invite.subject', loc, { course: opts.courseTitle });
  const html = `
    <p>${forgeT('forge.email.greeting', loc)}</p>
    <p>${intro} <strong>${opts.courseTitle}</strong> ${forgeT('forge.email.invite.onForge', loc)}</p>
    <p><a href="${opts.inviteUrl}">${forgeT('forge.email.invite.cta', loc)}</a></p>
    <p>${forgeTFormat('forge.email.invite.expiry', loc, { email: opts.toEmail })}</p>
  `.trim();

  return { subject, html };
}

export function buildForgeNudgeEmailHtml(opts: {
  userName: string | null;
  courseTitle: string;
  courseUrl: string;
  kind: 'at_risk' | 'inactive';
  progressPercent?: number;
  locale?: Locale;
}): { subject: string; html: string } {
  const loc = opts.locale ?? 'es';
  const greeting = opts.userName
    ? forgeTFormat('forge.email.greetingNamed', loc, { name: opts.userName })
    : forgeT('forge.email.greeting', loc);

  const bodyKey = opts.kind === 'at_risk' ? 'forge.email.nudge.atRiskBody' : 'forge.email.nudge.inactiveBody';
  const body = forgeTFormat(bodyKey, loc, {
    course: opts.courseTitle,
    percent: opts.progressPercent ?? 0,
  });

  const subjectKey = opts.kind === 'at_risk' ? 'forge.email.nudge.atRiskSubject' : 'forge.email.nudge.inactiveSubject';
  const subject = forgeTFormat(subjectKey, loc, { course: opts.courseTitle });

  const html = `
    <p>${greeting}</p>
    <p>${body}</p>
    <p><a href="${opts.courseUrl}">${forgeT('forge.email.nudge.cta', loc)}</a></p>
    <p>${forgeT('forge.email.signature', loc)}</p>
  `.trim();

  return { subject, html };
}

export function buildForgeFacilitatorAtRiskNotification(opts: {
  courseTitle: string;
  atRiskCount: number;
  avgProgress: number;
  locale?: Locale;
}): { title: string; message: string } {
  const loc = opts.locale ?? 'es';
  return {
    title: forgeTFormat('forge.email.notify.facilitatorAtRiskTitle', loc, {
      count: opts.atRiskCount,
      course: opts.courseTitle,
    }),
    message: forgeTFormat('forge.email.notify.facilitatorAtRiskMessage', loc, {
      percent: opts.avgProgress,
    }),
  };
}

export function buildForgeInviteNotification(opts: {
  courseTitle: string;
  locale?: Locale;
}): { title: string; message: string } {
  const loc = opts.locale ?? 'es';
  return {
    title: forgeTFormat('forge.email.notify.inviteTitle', loc, { course: opts.courseTitle }),
    message: forgeT('forge.email.notify.inviteMessage', loc),
  };
}

export function buildForgeNudgeNotification(opts: {
  courseTitle: string;
  kind: 'at_risk' | 'inactive';
  progressPercent?: number;
  locale?: Locale;
}): { title: string; message: string } {
  const loc = opts.locale ?? 'es';
  if (opts.kind === 'at_risk') {
    return {
      title: forgeTFormat('forge.email.notify.atRiskTitle', loc, { course: opts.courseTitle }),
      message: forgeTFormat('forge.email.notify.atRiskMessage', loc, {
        percent: opts.progressPercent ?? 0,
      }),
    };
  }
  return {
    title: forgeTFormat('forge.email.notify.inactiveTitle', loc, { course: opts.courseTitle }),
    message: forgeT('forge.email.notify.inactiveMessage', loc),
  };
}
