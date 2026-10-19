export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { normalizeSystemsInput, normalizeToolsInput, parseSystemsJson, parseToolsJson } from '@/lib/integrated-workspace-shared';
import { applyAcceptedInvitation, invitationRowToApplyOpts } from '@/lib/etholys-invite-apply';

/**
 * O código do convite prova o e-mail. Define a senha mesmo quando já existe
 * um utilizador sem senha (o reset por e-mail ignora password vazia).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      code?: string;
      email?: string;
      password?: string;
      name?: string;
    };
    const code = String(body.code || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim();

    if (!code || !email || password.length < 8) {
      return NextResponse.json(
        { error: 'Código, e-mail e senha (mín. 8 caracteres) são obrigatórios.' },
        { status: 400 },
      );
    }

    const invitation = await prisma.invitation.findUnique({ where: { code } });
    if (!invitation || (invitation.status !== 'pending' && invitation.status !== 'accepted')) {
      return NextResponse.json({ error: 'Código de convite inválido ou já usado.' }, { status: 400 });
    }
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: 'Este convite expirou.' }, { status: 400 });
    }
    if (invitation.email.toLowerCase() !== email) {
      return NextResponse.json({ error: 'Este código foi enviado a outro e-mail.' }, { status: 403 });
    }

    const hashed = await bcrypt.hash(password, 10);
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      if (name.length < 2) {
        return NextResponse.json({ error: 'Indique o seu nome.' }, { status: 400 });
      }
      user = await prisma.user.create({
        data: {
          email,
          password: hashed,
          name,
          role: 'COLLABORATOR',
        },
      });
    } else if (!user.isActive) {
      return NextResponse.json({ error: 'Esta conta está inativa.' }, { status: 403 });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashed,
          ...(name.length >= 2 && !user.name ? { name } : {}),
        },
      });
    }

    if (invitation.status === 'pending') {
      const systems = normalizeSystemsInput(parseSystemsJson(invitation.systems));
      const tools = normalizeToolsInput(parseToolsJson(invitation.tools));
      await applyAcceptedInvitation(invitationRowToApplyOpts(invitation, user.id, systems, tools));
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('Invitation set-password error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
