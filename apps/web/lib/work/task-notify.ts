import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notify';
import { sendAuthHtmlEmail } from '@/lib/send-auth-email';
import {
  renderEtholysMailLayout,
  type EtholysMailLocale,
} from '@/lib/email/etholys-mail-layout';

export type WorkNotifyKey = 'comment' | 'assign' | 'status';

export function wantsWorkNotify(json: unknown, key: WorkNotifyKey) {
  if (!json || typeof json !== 'object') return true;
  const notify = (json as { notify?: Record<string, boolean> }).notify;
  if (!notify || notify[key] === undefined) return true;
  return notify[key] !== false;
}

export function wantsWorkEmail(json: unknown) {
  if (!json || typeof json !== 'object') return true;
  const notify = (json as { notify?: { email?: boolean } }).notify;
  if (!notify || notify.email === undefined) return true;
  return notify.email !== false;
}

export function taskRoleUserIds(task: {
  assigneeId?: string | null;
  responsibleId?: string | null;
  reviewerId?: string | null;
  creatorId?: string | null;
  collaboratorIds?: unknown;
  assigneeIds?: string[] | null;
  responsibleIds?: string[] | null;
  reviewerIds?: string[] | null;
  people?: Array<{ userId: string; role: string }> | null;
}) {
  const fromPeople = Array.isArray(task.people) ? task.people.map((p) => p.userId) : [];
  const extra = Array.isArray(task.collaboratorIds)
    ? task.collaboratorIds.map((id) => String(id))
    : [];
  const assignees = Array.isArray(task.assigneeIds) ? task.assigneeIds : [];
  const responsible = Array.isArray(task.responsibleIds) ? task.responsibleIds : [];
  const reviewers = Array.isArray(task.reviewerIds) ? task.reviewerIds : [];
  return [
    task.assigneeId,
    task.responsibleId,
    task.reviewerId,
    task.creatorId,
    ...assignees,
    ...responsible,
    ...reviewers,
    ...fromPeople,
    ...extra,
  ];
}

function normalizeLocale(raw?: string | null): EtholysMailLocale {
  if (raw === 'pt' || raw === 'en' || raw === 'es') return raw;
  return 'es';
}

function mailCopy(locale: EtholysMailLocale) {
  if (locale === 'pt') {
    return {
      where: 'Onde',
      what: 'O que',
      who: 'Quem',
      when: 'Quando',
      cta: 'Abrir no eTask',
      product: 'Etholys · eTask',
      greeting: (name: string) => `Olá ${name},`,
    };
  }
  if (locale === 'en') {
    return {
      where: 'Where',
      what: 'What',
      who: 'Who',
      when: 'When',
      cta: 'Open in eTask',
      product: 'Etholys · eTask',
      greeting: (name: string) => `Hello ${name},`,
    };
  }
  return {
    where: 'Dónde',
    what: 'Qué',
    who: 'Quién',
    when: 'Cuándo',
    cta: 'Abrir en eTask',
    product: 'Etholys · eTask',
    greeting: (name: string) => `Hola ${name},`,
  };
}

function formatWhen(when: Date | string, locale: EtholysMailLocale): string {
  const d = typeof when === 'string' ? new Date(when) : when;
  if (Number.isNaN(d.getTime())) return String(when);
  const tag = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';
  return new Intl.DateTimeFormat(tag, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function absoluteTaskLink(link: string): string {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://app.etholys.com';
  return `${base.replace(/\/$/, '')}${link.startsWith('/') ? link : `/${link}`}`;
}

/** Compact subject: always starts with eTask. */
export function etaskMailSubject(phrase: string): string {
  const clean = String(phrase || '')
    .replace(/^eTask\s*[·\-–:]?\s*/i, '')
    .trim()
    .slice(0, 72);
  return clean ? `eTask · ${clean}` : 'eTask';
}

export function compactTitle(title: string, max = 48): string {
  const t = String(title || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function statusLabel(status: string, locale: EtholysMailLocale = 'es'): string {
  const key = String(status || '').toUpperCase();
  const map: Record<string, { es: string; pt: string; en: string }> = {
    BACKLOG: { es: 'Backlog', pt: 'Backlog', en: 'Backlog' },
    TODO: { es: 'Por hacer', pt: 'A fazer', en: 'To do' },
    IN_PROGRESS: { es: 'En progreso', pt: 'Em progresso', en: 'In progress' },
    IN_REVIEW: { es: 'En revisión', pt: 'Em revisão', en: 'In review' },
    DONE: { es: 'Hecho', pt: 'Concluído', en: 'Done' },
    CANCELLED: { es: 'Cancelado', pt: 'Cancelado', en: 'Cancelled' },
  };
  const row = map[key];
  if (!row) return String(status || '').replace(/_/g, ' ');
  return row[locale];
}

export function buildTaskContextLine(opts: {
  taskTitle: string;
  folderName?: string | null;
  groupName?: string | null;
  projectName?: string | null;
}): string {
  const bits = [opts.taskTitle.trim()];
  const board = opts.folderName || opts.groupName || opts.projectName;
  if (board) bits.push(board.trim());
  return bits.filter(Boolean).join(' · ');
}

export type TaskMailFields = {
  locale?: EtholysMailLocale;
  /** Short phrase after "eTask ·" */
  subjectPhrase: string;
  headline: string;
  where: string;
  what: string;
  who: string;
  when?: Date | string;
  link?: string;
  /** Extra paragraph (e.g. full comment) */
  detail?: string | null;
  preheader?: string;
};

export function buildTaskNotificationEmail(
  opts: TaskMailFields & { recipientName: string },
): { subject: string; html: string } {
  const locale = normalizeLocale(opts.locale);
  const copy = mailCopy(locale);
  const when = formatWhen(opts.when || new Date(), locale);
  const href = absoluteTaskLink(opts.link || '/hub/work');
  const paragraphs = [copy.greeting(opts.recipientName)];
  if (opts.detail?.trim()) {
    paragraphs.push(opts.detail.trim());
  }

  return {
    subject: etaskMailSubject(opts.subjectPhrase),
    html: renderEtholysMailLayout({
      locale,
      preheader: opts.preheader || opts.what,
      eyebrow: 'eTask',
      headline: opts.headline,
      paragraphs,
      sections: [
        { title: copy.where, items: [opts.where] },
        { title: copy.what, items: [opts.what] },
        { title: copy.who, items: [opts.who] },
        { title: copy.when, items: [when] },
      ],
      cta: { label: copy.cta, href },
      productLine: copy.product,
    }),
  };
}

async function notifyEmail(opts: {
  userId: string;
  mail: TaskMailFields;
}) {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { email: true, name: true, locale: true },
  });
  if (!user?.email) return;
  const locale = normalizeLocale(opts.mail.locale || user.locale);
  const built = buildTaskNotificationEmail({
    ...opts.mail,
    locale,
    recipientName: user.name || user.email,
  });
  void sendAuthHtmlEmail({
    to: user.email,
    subject: built.subject,
    html: built.html,
  });
}

export function notifyTaskWatchers(opts: {
  actorId: string;
  title: string;
  message: string;
  type: string;
  userIds: Array<string | null | undefined>;
  enabled: boolean;
  email?: boolean;
  link?: string;
  mail?: TaskMailFields;
}) {
  if (!opts.enabled) return;
  const link = opts.link || '/hub/work';
  const seen = new Set<string>();
  for (const id of opts.userIds) {
    if (!id || id === opts.actorId || seen.has(id)) continue;
    seen.add(id);
    createNotification({
      userId: id,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      link,
    });
    if (opts.email && opts.mail) {
      void notifyEmail({
        userId: id,
        mail: { ...opts.mail, link },
      });
    } else if (opts.email) {
      // Fallback for callers that have not migrated yet
      void notifyEmail({
        userId: id,
        mail: {
          subjectPhrase: opts.title,
          headline: opts.title,
          where: opts.message,
          what: opts.message,
          who: '—',
          link,
        },
      });
    }
  }
}

export function notifyTaskAssigned(opts: {
  assigneeId: string | null | undefined;
  actorId: string;
  title: string;
  projectId?: string | null;
  prevAssigneeId?: string | null;
  email?: boolean;
  roleLabel?: string;
  actorName?: string | null;
  where?: string;
  locale?: EtholysMailLocale;
}) {
  if (!opts.assigneeId || opts.assigneeId === opts.actorId) return;
  if (opts.prevAssigneeId && opts.prevAssigneeId === opts.assigneeId) return;
  const link = opts.projectId ? `/projects/${opts.projectId}` : '/hub/work';
  const role = opts.roleLabel || 'asignada';
  const who = opts.actorName?.trim() || 'Alguien';
  const where = opts.where || opts.title;
  const inAppTitle = 'Nueva tarea asignada';
  const inAppMessage = `Se te ${role}: ${opts.title}`;
  createNotification({
    userId: opts.assigneeId,
    type: 'task_assigned',
    title: inAppTitle,
    message: inAppMessage,
    link,
  });
  if (opts.email) {
    void notifyEmail({
      userId: opts.assigneeId,
      mail: {
        locale: opts.locale,
        subjectPhrase: 'Nueva asignación',
        headline: 'Nueva asignación',
        where,
        what: `Se te ${role}`,
        who,
        link,
        detail: compactTitle(opts.title, 120),
      },
    });
  }
}

export function notifyTaskAction(opts: {
  recipientId: string;
  actorId: string;
  actorName: string;
  action: 'review' | 'delivery' | 'handoff';
  taskTitle: string;
  where: string;
  note?: string | null;
  email?: boolean;
  link?: string;
  locale?: EtholysMailLocale;
}) {
  if (!opts.recipientId || opts.recipientId === opts.actorId) return;
  const link = opts.link || '/hub/work';
  const phrases = {
    review: {
      subject: 'Solicitud de revisión',
      headline: 'Solicitud de revisión',
      what: 'Pidió una revisión de esta actividad',
      type: 'task_review_request',
      inApp: 'Solicitud de revisión',
    },
    delivery: {
      subject: 'Entrega de actividad',
      headline: 'Entrega de actividad',
      what: 'Marcó esta actividad como entregada / lista para recepción',
      type: 'task_delivery',
      inApp: 'Entrega de actividad',
    },
    handoff: {
      subject: 'Actividad pasada',
      headline: 'Actividad pasada',
      what: 'Te pasó el testigo de esta actividad',
      type: 'task_handoff',
      inApp: 'Actividad pasada',
    },
  } as const;
  const p = phrases[opts.action];
  const message = `${opts.actorName}: ${p.what}${opts.note ? ` — ${opts.note.slice(0, 100)}` : ''}`;
  createNotification({
    userId: opts.recipientId,
    type: p.type,
    title: p.inApp,
    message: `${opts.taskTitle} — ${message}`,
    link,
  });
  if (opts.email) {
    void notifyEmail({
      userId: opts.recipientId,
      mail: {
        locale: opts.locale,
        subjectPhrase: p.subject,
        headline: p.headline,
        where: opts.where,
        what: opts.note?.trim() ? `${p.what}: ${opts.note.trim()}` : p.what,
        who: opts.actorName,
        link,
        detail: opts.note?.trim() || null,
      },
    });
  }
}
