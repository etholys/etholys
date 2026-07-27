export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  requireAnvilAccess,
  generateInviteCode,
} from '@/lib/lab-anvil/access';

/** GET: estado de acesso + lista de membros (owners veem membros). */
export async function GET() {
  const access = await requireAnvilAccess();
  if (!access) {
    return NextResponse.json({ hasAccess: false }, { status: 401 });
  }

  if (!access.hasAccess) {
    return NextResponse.json({
      hasAccess: false,
      isOwner: false,
      needsInvite: true,
    });
  }

  let members: unknown[] = [];
  if (access.isOwner) {
    members = await prisma.labAnvilMember.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    });
  }

  return NextResponse.json({
    hasAccess: true,
    isOwner: access.isOwner,
    email: access.email,
    members,
  });
}

/** POST: aceitar código de convite OU (owner) criar convite. */
export async function POST(req: Request) {
  const access = await requireAnvilAccess();
  if (!access) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();

  // Aceitar convite
  if (body.action === 'accept' || body.code) {
    const code = String(body.code || '').toUpperCase().trim();
    if (!code) {
      return NextResponse.json({ error: 'Código requerido' }, { status: 400 });
    }

    const invite = await prisma.labAnvilMember.findUnique({ where: { inviteCode: code } });
    if (!invite || invite.status === 'revoked') {
      return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
    }
    if (invite.status === 'active') {
      return NextResponse.json({ error: 'Convite já utilizado' }, { status: 400 });
    }
    if (new Date() > invite.expiresAt) {
      return NextResponse.json({ error: 'Convite expirado' }, { status: 400 });
    }
    if (invite.email.toLowerCase() !== access.email.toLowerCase()) {
      return NextResponse.json({ error: 'Este código não corresponde ao teu email' }, { status: 400 });
    }

    const updated = await prisma.labAnvilMember.update({
      where: { id: invite.id },
      data: { status: 'active', userId: access.userId },
    });
    return NextResponse.json({ success: true, member: updated });
  }

  // Criar convite (owner)
  if (!access.isOwner) {
    return NextResponse.json({ error: 'Só owners podem convidar' }, { status: 403 });
  }

  const email = String(body.email || '').toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
  }

  const existing = await prisma.labAnvilMember.findFirst({
    where: { email, status: { in: ['pending', 'active'] } },
  });
  if (existing) {
    return NextResponse.json({ error: 'Já existe membro/convite para este email', member: existing }, { status: 409 });
  }

  let inviteCode = generateInviteCode();
  for (let i = 0; i < 8; i++) {
    const clash = await prisma.labAnvilMember.findUnique({ where: { inviteCode } });
    if (!clash) break;
    inviteCode = generateInviteCode();
  }

  const member = await prisma.labAnvilMember.create({
    data: {
      email,
      role: 'member',
      status: 'pending',
      inviteCode,
      invitedById: access.userId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return NextResponse.json({ member });
}

/** DELETE: revogar membro (owner). */
export async function DELETE(req: Request) {
  const access = await requireAnvilAccess();
  if (!access?.isOwner) {
    return NextResponse.json({ error: 'Só owners' }, { status: 403 });
  }

  const body = await req.json();
  const id = body.id as string | undefined;
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  await prisma.labAnvilMember.update({
    where: { id },
    data: { status: 'revoked' },
  });

  return NextResponse.json({ success: true });
}
