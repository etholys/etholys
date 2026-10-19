export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/** Dados públicos mínimos para a página de aceitação (sem sessão). */
export async function GET(req: Request) {
  try {
    const code = new URL(req.url).searchParams.get('code')?.trim() || '';
    if (!code || code.length > 80) {
      return NextResponse.json({ status: 'invalid' });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { code },
      select: {
        email: true,
        status: true,
        expiresAt: true,
        company: { select: { name: true } },
        inviter: { select: { name: true } },
      },
    });
    if (!invitation) return NextResponse.json({ status: 'invalid' });

    const expired = Boolean(invitation.expiresAt && new Date() > invitation.expiresAt);
    if (expired && invitation.status === 'pending') {
      return NextResponse.json({
        status: 'expired',
        companyName: invitation.company?.name ?? null,
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });

    const status =
      invitation.status === 'accepted' || invitation.status === 'pending'
        ? invitation.status
        : 'invalid';

    return NextResponse.json({
      status,
      companyName: invitation.company?.name ?? null,
      email: invitation.email,
      hasAccount: Boolean(existing),
      inviterName: invitation.inviter?.name ?? null,
    });
  } catch (error: unknown) {
    console.error('Invitation preview error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
