export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { requireForgeTenant, resolveForgeCompanyId } from '@/lib/forge/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const companyId = resolveForgeCompanyId(tenant, req.nextUrl.searchParams.get('companyId'));
    const mine = req.nextUrl.searchParams.get('mine') === '1';

    const certs = await getForgeDb().forgeCertificate.findMany({
      where: {
        ...(companyId ? { companyId } : { companyId: { in: tenant.companyIds } }),
        ...(mine ? { userId: tenant.userId } : {}),
      },
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true, coverEmoji: true } },
      },
      orderBy: { issuedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      certificates: certs.map((c) => ({
        id: c.id,
        courseId: c.courseId,
        title: c.title,
        verifyCode: c.verifyCode,
        issuedAt: c.issuedAt.toISOString(),
        userName: c.user.name,
        courseTitle: c.course.title,
        coverEmoji: c.course.coverEmoji,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}
