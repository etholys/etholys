export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getLearnerJourneyBundle } from '@/lib/forge/learner-journey';
import { requireForgeTenant } from '@/lib/forge/tenant';
import { getForgeDb } from '@/lib/forge/db';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id: courseId } = await ctx.params;
    const enrolled = await getForgeDb().forgeCourse.findFirst({
      where: {
        id: courseId,
        OR: [
          { companyId: { in: tenant.companyIds } },
          { enrollments: { some: { userId: tenant.userId } } },
        ],
      },
    });
    if (!enrolled) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    const bundle = await getLearnerJourneyBundle(courseId, tenant.userId);
    return NextResponse.json(bundle);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
