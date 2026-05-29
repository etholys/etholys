export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getForgeDb } from '@/lib/forge/db';
import { forgeCertificateHtml } from '@/lib/forge/certificate-html';

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions);
    const { code } = await ctx.params;
    const verifyCode = code.trim().toUpperCase();

    const cert = await getForgeDb().forgeCertificate.findUnique({
      where: { verifyCode },
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { title: true } },
        company: { select: { name: true } },
      },
    });
    if (!cert) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    if (session?.user?.email) {
      const email = session.user.email.toLowerCase();
      const owner = await getForgeDb().user.findUnique({ where: { email } });
      const isOwner = owner?.id === cert.userId;
      const isOrg =
        owner &&
        (await getForgeDb().companyUser.findFirst({
          where: { userId: owner.id, companyId: cert.companyId },
        }));
      if (!isOwner && !isOrg) {
        return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Inicia sesión' }, { status: 401 });
    }

    const html = forgeCertificateHtml({
      learnerName: cert.user.name ?? 'Alumno',
      courseTitle: cert.course.title,
      institution: cert.company.name,
      verifyCode: cert.verifyCode,
      issuedAt: cert.issuedAt,
    });

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}
