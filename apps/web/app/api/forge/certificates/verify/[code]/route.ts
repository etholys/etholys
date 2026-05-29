export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';

type Ctx = { params: Promise<{ code: string }> };

/** Verificação pública — sem auth */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { code } = await ctx.params;
    const cert = await getForgeDb().forgeCertificate.findUnique({
      where: { verifyCode: code.trim().toUpperCase() },
      include: {
        user: { select: { name: true } },
        course: { select: { title: true } },
        company: { select: { name: true } },
      },
    });
    if (!cert) return NextResponse.json({ valid: false }, { status: 404 });

    return NextResponse.json({
      valid: true,
      title: cert.title,
      issuedAt: cert.issuedAt.toISOString(),
      learnerName: cert.user.name,
      courseTitle: cert.course.title,
      institution: cert.company.name,
      verifyCode: cert.verifyCode,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}
