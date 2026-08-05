import 'server-only';

import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notify';

/** Após finalize: notifica o host e cria alerta Advisor se houver rascunhos. */
export async function notifyMeetActionsPending(opts: {
  companyId: string;
  sessionId: string;
  sessionTitle: string;
  createdById?: string | null;
  draftCount: number;
}): Promise<void> {
  if (opts.draftCount <= 0) return;

  const link = `/hub/meet?post=${encodeURIComponent(opts.sessionId)}&companyId=${encodeURIComponent(opts.companyId)}`;
  const title =
    opts.draftCount === 1
      ? '1 tarefa de reunião por validar'
      : `${opts.draftCount} tarefas de reunião por validar`;
  const message = `Reunião «${opts.sessionTitle}»: valide ou converta as tarefas geradas pela IA.`;

  if (opts.createdById) {
    await createNotification({
      userId: opts.createdById,
      type: 'meet_actions_pending',
      title,
      message,
      link,
    });
  }

  // Evitar duplicar alerta aberto do mesmo tipo+sessão
  const existing = await prisma.aiAlert.findFirst({
    where: {
      companyId: opts.companyId,
      type: 'meet_actions_pending',
      link,
      dismissedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });

  if (!existing) {
    await prisma.aiAlert.create({
      data: {
        companyId: opts.companyId,
        userId: opts.createdById || null,
        type: 'meet_actions_pending',
        severity: 'warning',
        title,
        message,
        link,
        expiresAt: new Date(Date.now() + 14 * 86400000),
      },
    });
  }
}
