export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { isPrecommercialMode } from '@/lib/platform-access';
import { normalizeSystemsInput, normalizeToolsInput, parseSystemsJson, parseToolsJson } from '@/lib/integrated-workspace-shared';
import { applyAcceptedInvitation, invitationRowToApplyOpts } from '@/lib/etholys-invite-apply';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name, inviteCode } = body ?? {};
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Campos requeridos: email, password, name' }, { status: 400 });
    }

    const code = typeof inviteCode === 'string' ? inviteCode.trim() : '';
    if (isPrecommercialMode() && !code) {
      return NextResponse.json(
        {
          error:
            'Registo fechado. Use o código de convite que recebeu por e-mail (acesso só às funções atribuídas).',
        },
        { status: 403 },
      );
    }

    const emailNorm = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: emailNorm },
    });

    let invitation: Awaited<ReturnType<typeof prisma.invitation.findUnique>> = null;
    if (code) {
      invitation = await prisma.invitation.findUnique({ where: { code } });
      if (!invitation) {
        return NextResponse.json({ error: 'Código de convite inválido ou já usado.' }, { status: 400 });
      }
      if (invitation.email.toLowerCase() !== emailNorm) {
        return NextResponse.json(
          { error: 'Este código fue enviado a otro email.' },
          { status: 403 },
        );
      }
      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        return NextResponse.json({ error: 'Este convite expirou.' }, { status: 400 });
      }
    }

    if (existing) {
      if (invitation) {
        const alreadyMember = await prisma.companyUser.findFirst({
          where: { userId: existing.id, companyId: invitation.companyId },
          select: { id: true },
        });
        if (invitation.status === 'accepted' || alreadyMember) {
          return NextResponse.json(
            {
              error:
                'Ya tienes cuenta y acceso. Inicia sesión (no te registres de nuevo).',
              code: 'ALREADY_MEMBER',
            },
            { status: 400 },
          );
        }
      }
      return NextResponse.json(
        {
          error:
            'El email ya está registrado. Inicia sesión e introduce el código de invitación.',
          code: 'EMAIL_EXISTS',
        },
        { status: 400 },
      );
    }

    if (code && (!invitation || invitation.status !== 'pending')) {
      return NextResponse.json({ error: 'Código de convite inválido ou já usado.' }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        password: hashed,
        name: String(name).trim(),
        role: 'COLLABORATOR',
      },
    });

    if (invitation) {
      const systems = normalizeSystemsInput(parseSystemsJson(invitation.systems));
      const tools = normalizeToolsInput(parseToolsJson(invitation.tools));
      await applyAcceptedInvitation(invitationRowToApplyOpts(invitation, user.id, systems, tools));
    }

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error: unknown) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
