export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { isPrecommercialMode } from '@/lib/platform-access';
import { normalizeSystemsInput, parseSystemsJson } from '@/lib/integrated-workspace-shared';

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

    const existing = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 });
    }

    let invitation: {
      id: string;
      companyId: string;
      role: string;
      status: string;
      expiresAt: Date | null;
      systems?: unknown;
    } | null = null;

    if (code) {
      invitation = await prisma.invitation.findUnique({ where: { code } });
      if (!invitation || invitation.status !== 'pending') {
        return NextResponse.json({ error: 'Código de convite inválido ou já usado.' }, { status: 400 });
      }
      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        return NextResponse.json({ error: 'Este convite expirou.' }, { status: 400 });
      }
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: String(email).trim().toLowerCase(),
        password: hashed,
        name: String(name).trim(),
        role: 'COLLABORATOR',
      },
    });

    if (invitation) {
      const inviteFull = await prisma.invitation.findUnique({ where: { id: invitation.id } });
      const isProjectGuest =
        inviteFull?.accessMode === 'project_guest' && Boolean(inviteFull.projectId);

      if (isProjectGuest && inviteFull?.projectId) {
        // Project-only guest: no CompanyUser
        await prisma.projectMember.upsert({
          where: {
            projectId_userId: { projectId: inviteFull.projectId, userId: user.id },
          },
          update: {
            accessMode: 'project_guest',
            status: 'active',
            permissions: (inviteFull.projectPermissions as any) ?? undefined,
          },
          create: {
            projectId: inviteFull.projectId,
            userId: user.id,
            role: 'aliado',
            accessMode: 'project_guest',
            status: 'active',
            permissions: (inviteFull.projectPermissions as any) ?? undefined,
          },
        });

        const systemsRaw = normalizeSystemsInput(parseSystemsJson(invitation.systems));
        const systems = systemsRaw.length > 0 ? systemsRaw : ['SIEP'];
        await prisma.integratedWorkspaceAccess.create({
          data: {
            companyId: invitation.companyId,
            userId: user.id,
            systems: systems as unknown as import('@prisma/client').Prisma.InputJsonValue,
            enabled: true,
          },
        });
      } else {
        await prisma.companyUser.create({
          data: {
            userId: user.id,
            companyId: invitation.companyId,
            role: invitation.role as 'COLLABORATOR' | 'ADMIN' | 'PROJECT_MANAGER' | 'TECHNICIAN',
          },
        });

        const systems = normalizeSystemsInput(parseSystemsJson(invitation.systems));
        if (systems.length > 0) {
          await prisma.integratedWorkspaceAccess.create({
            data: {
              companyId: invitation.companyId,
              userId: user.id,
              systems: systems as unknown as import('@prisma/client').Prisma.InputJsonValue,
              enabled: true,
            },
          });
        } else if (isPrecommercialMode()) {
          await prisma.integratedWorkspaceAccess.create({
            data: {
              companyId: invitation.companyId,
              userId: user.id,
              systems: [] as unknown as import('@prisma/client').Prisma.InputJsonValue,
              enabled: false,
            },
          });
        }
      }

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      });
    }

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error: unknown) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
