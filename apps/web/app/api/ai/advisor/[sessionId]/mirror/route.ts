import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseNexusAdvisorMirror } from '@/lib/nexus-advisor-mirror';

export const dynamic = 'force-dynamic';

/**
 * PUT — atualizar o espelho NEXUS da sessão (rotas/artefactos acordados com o assessor IA).
 * Futuro: chamado após extracção estruturada da resposta IA ou acção explícita na UI.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!('nexusMirror' in body)) {
    return NextResponse.json({ error: 'nexusMirror is required (use null to clear)' }, { status: 400 });
  }

  const raw = body.nexusMirror;
  let nextMirror: unknown = null;
  if (raw !== null) {
    const parsed = parseNexusAdvisorMirror(raw);
    if (parsed == null) return NextResponse.json({ error: 'Invalid nexusMirror payload' }, { status: 400 });
    nextMirror = parsed;
  }

  const tenantRows = await prisma.companyUser.findMany({ where: { userId: user.id }, select: { companyId: true } });
  const tenantCompanyIds = [...new Set(tenantRows.map((r) => r.companyId))];

  const advisorSession = await prisma.aiAdvisorSession.findFirst({
    where: { id: params.sessionId, userId: user.id },
    select: { id: true, companyId: true, kind: true },
  });
  if (!advisorSession || !tenantCompanyIds.includes(advisorSession.companyId)) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (advisorSession.kind !== 'NEXUS_COPILOT') {
    return NextResponse.json(
      { error: 'Espelho NEXUS só aplica ao Copiloto NEXUS; esta sessão é do assessor workspace.', code: 'MIRROR_REQUIRES_NEXUS_SESSION' },
      { status: 409 },
    );
  }

  const updated = await prisma.aiAdvisorSession.update({
    where: { id: advisorSession.id },
    data: {
      nexusMirror: nextMirror === null ? Prisma.DbNull : (nextMirror as Prisma.InputJsonValue),
      updatedAt: new Date(),
    },
    select: { id: true, nexusMirror: true },
  });

  return NextResponse.json(updated);
}
