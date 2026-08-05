import 'server-only';

import { prisma } from '@/lib/prisma';
import { createMeetSession, assertMeetPrismaReady } from '@/lib/meet/create-session';
import { meetHubJoinPath } from '@/lib/meet/types';

/**
 * Espelho NEXUS: cria (ou reutiliza recente) MeetSession com mirror=nexus.
 */
export async function createMeetForNexus(opts: {
  companyId: string;
  createdById?: string;
  title?: string;
  description?: string;
}): Promise<{
  meetSessionId: string;
  meetingUrl: string;
  joinPath: string;
  created: boolean;
}> {
  assertMeetPrismaReady();

  const title = (opts.title?.trim() || 'NEXUS — reunião AT / rede').slice(0, 200);

  // Reutilizar sala nexus "live" ou "scheduled" recente (< 2h) com o mesmo título
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const existing = await prisma.meetSession.findFirst({
    where: {
      companyId: opts.companyId,
      mirror: 'nexus',
      status: { in: ['scheduled', 'live'] },
      createdAt: { gte: since },
      title,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing?.meetingUrl) {
    return {
      meetSessionId: existing.id,
      meetingUrl: existing.meetingUrl,
      joinPath: meetHubJoinPath(existing.id, opts.companyId),
      created: false,
    };
  }

  const session = await createMeetSession({
    companyId: opts.companyId,
    createdById: opts.createdById,
    title,
    description:
      opts.description?.trim() ||
      'Reunião Etholys Meet aberta a partir do NEXUS (AT / rede / empreendedor).',
    mirror: 'nexus',
    scheduledAt: new Date(),
  });

  return {
    meetSessionId: session.id,
    meetingUrl: session.meetingUrl!,
    joinPath: meetHubJoinPath(session.id, opts.companyId),
    created: true,
  };
}
