import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parseAdvisorSessionKindBody } from '@/lib/ai-advisor-session-kind';

export const dynamic = 'force-dynamic';

/** GET /api/ai/advisor — list sessions for current user/company */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const sessions = await prisma.aiAdvisorSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    select: {
      id: true,
      title: true,
      kind: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(sessions);
}

/** POST /api/ai/advisor — create new session */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { companyUsers: { where: { isDefault: true }, take: 1 } },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const tenantRows = await prisma.companyUser.findMany({ where: { userId: user.id }, select: { companyId: true } });
  const tenantCompanyIds = [...new Set(tenantRows.map((r) => r.companyId))];

  let companyId: string | null = user.companyUsers[0]?.companyId ?? null;
  if (!companyId) {
    const any = await prisma.companyUser.findFirst({ where: { userId: user.id } });
    companyId = any?.companyId ?? null;
  }
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const requestedCompanyId = typeof body.companyId === 'string' ? body.companyId.trim() : '';
  let resolvedCompanyId: string = companyId;
  if (requestedCompanyId && tenantCompanyIds.includes(requestedCompanyId)) {
    resolvedCompanyId = requestedCompanyId;
  }

  const companyRow = await prisma.company.findUnique({
    where: { id: resolvedCompanyId },
    select: { id: true },
  });
  if (!companyRow) {
    return NextResponse.json(
      { error: 'Empresa inválida ou já não existe.', detail: resolvedCompanyId },
      { status: 400 },
    );
  }

  const title = (body.title as string) || null;
  const kind = parseAdvisorSessionKindBody(body.kind);

  try {
    const newSession = await prisma.aiAdvisorSession.create({
      data: {
        companyId: resolvedCompanyId,
        userId: user.id,
        title: title ?? undefined,
        kind,
      },
    });

    return NextResponse.json(newSession, { status: 201 });
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/ai/advisor] create AiAdvisorSession failed:', e);

    const missingSchemaHint =
      process.env.NODE_ENV !== 'production' &&
      (raw.includes('does not exist') ||
        raw.includes('Unknown arg') ||
        raw.includes('Invalid value') ||
        raw.includes('kind') ||
        raw.includes('nexusMirror'));

    const hint = missingSchemaHint
      ? 'Base de dados desactualizada neste ambiente. Em apps/web: `npx prisma migrate deploy` e `npx prisma generate`, depois reinicie o servidor.'
      : undefined;

    return NextResponse.json(
      {
        error: 'Não foi possível criar a sessão do assessor.',
        detail: raw,
        ...(hint ? { hint } : {}),
      },
      { status: 500 },
    );
  }
}
