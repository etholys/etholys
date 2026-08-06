export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  DEFAULT_PROJECT_GUEST_PERMISSIONS,
  parseSiepPermissions,
  resolveProjectAccess,
  type SiepPermissionKey,
} from '@/lib/siep/permissions';

async function assertCanManageMembers(userId: string, projectId: string) {
  const access = await resolveProjectAccess(userId, projectId);
  if (!access.ok) return { ok: false as const, status: 403 as const, error: 'No autorizado' };

  const canManage =
    access.permissions.has('siep.team.manage_members') ||
    access.permissions.has('siep.team.manage_permissions') ||
    // Staff da empresa com edição do projeto (PM / admin) pode convidar
    (access.mode === 'company' && access.permissions.has('siep.project.edit'));

  if (!canManage) {
    return { ok: false as const, status: 403 as const, error: 'Sin permiso para gestionar el equipo' };
  }
  return { ok: true as const, access };
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const {
      projectId,
      userId,
      email,
      role,
      dedicationPct,
      monthlyCost,
      accessMode,
      permissions,
      inviteGuest,
    } = body as {
      projectId?: string;
      userId?: string;
      email?: string;
      role?: string;
      dedicationPct?: string | number;
      monthlyCost?: string | number | null;
      accessMode?: string;
      permissions?: unknown;
      inviteGuest?: boolean;
    };

    if (!projectId) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });

    const gate = await assertCanManageMembers(tenant.userId, projectId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, companyId: true, name: true },
    });
    if (!project) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });

    const perms = parseSiepPermissions(permissions);
    const isGuest = inviteGuest === true || accessMode === 'project_guest';

    // --- Convidado externo por email (não precisa ser da empresa) ---
    if (isGuest) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
      }

      const guestPerms: SiepPermissionKey[] =
        perms.length > 0 ? perms : DEFAULT_PROJECT_GUEST_PERMISSIONS;

      let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (!user) {
        // Utilizador placeholder — completa no signup com o código
        user = await prisma.user.create({
          data: {
            email: normalizedEmail,
            name: normalizedEmail.split('@')[0] || 'Invitado',
            password: randomBytes(32).toString('hex'),
            role: 'COLLABORATOR',
          },
        });
      }

      const member = await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: user.id } },
        update: {
          role: role || 'aliado',
          accessMode: 'project_guest',
          status: 'active',
          permissions: guestPerms,
          ...(dedicationPct !== undefined && { dedicationPct: parseFloat(String(dedicationPct)) || 100 }),
          ...(monthlyCost !== undefined && {
            monthlyCost: monthlyCost ? parseFloat(String(monthlyCost)) : null,
          }),
        },
        create: {
          projectId,
          userId: user.id,
          role: role || 'aliado',
          accessMode: 'project_guest',
          status: 'active',
          permissions: guestPerms,
          dedicationPct: dedicationPct ? parseFloat(String(dedicationPct)) : 100,
          monthlyCost: monthlyCost ? parseFloat(String(monthlyCost)) : null,
        },
        include: { user: true },
      });

      // Convite para login / completar conta
      const invitation = await prisma.invitation.create({
        data: {
          companyId: project.companyId,
          email: normalizedEmail,
          role: 'COLLABORATOR',
          invitedBy: tenant.userId,
          systems: ['SIEP'],
          projectId,
          accessMode: 'project_guest',
          projectPermissions: guestPerms,
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        } as any,
      });

      // Workspace SIEP sem tornar CompanyUser (acesso só via ProjectMember)
      const existingAccess = await prisma.integratedWorkspaceAccess.findFirst({
        where: { userId: user.id, companyId: project.companyId },
      });
      if (!existingAccess) {
        await prisma.integratedWorkspaceAccess.create({
          data: {
            companyId: project.companyId,
            userId: user.id,
            systems: ['SIEP'] as any,
            enabled: true,
          },
        });
      }

      return NextResponse.json({
        member,
        invitation: { code: invitation.code, email: invitation.email },
        message:
          'Miembro externo agregado al proyecto. Puede iniciar sesión con este email (restablecer contraseña si es cuenta nueva).',
      });
    }

    // --- Membro da empresa (fluxo clássico) ---
    if (!userId) return NextResponse.json({ error: 'Seleccione un usuario' }, { status: 400 });

    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: {
        role: role || 'member',
        accessMode: 'company_staff',
        status: 'active',
        ...(perms.length > 0 ? { permissions: perms } : {}),
        ...(dedicationPct !== undefined && { dedicationPct: parseFloat(String(dedicationPct)) || 100 }),
        ...(monthlyCost !== undefined && {
          monthlyCost: monthlyCost ? parseFloat(String(monthlyCost)) : null,
        }),
      },
      create: {
        projectId,
        userId,
        role: role || 'member',
        accessMode: 'company_staff',
        status: 'active',
        permissions: perms.length ? perms : undefined,
        dedicationPct: dedicationPct ? parseFloat(String(dedicationPct)) : 100,
        monthlyCost: monthlyCost ? parseFloat(String(monthlyCost)) : null,
      },
      include: { user: true },
    });
    return NextResponse.json({ member });
  } catch (error: any) {
    console.error('Add member error:', error);
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { id, role, dedicationPct, monthlyCost, permissions, status, accessMode } = body;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const existing = await prisma.projectMember.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const gate = await assertCanManageMembers(tenant.userId, existing.projectId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const data: any = {};
    if (role !== undefined) data.role = role;
    if (dedicationPct !== undefined) data.dedicationPct = parseFloat(dedicationPct) || 100;
    if (monthlyCost !== undefined) data.monthlyCost = monthlyCost ? parseFloat(monthlyCost) : null;
    if (status !== undefined) data.status = status;
    if (accessMode !== undefined) data.accessMode = accessMode;
    if (permissions !== undefined) data.permissions = parseSiepPermissions(permissions);

    const member = await prisma.projectMember.update({
      where: { id },
      data,
      include: { user: true },
    });
    return NextResponse.json({ member });
  } catch (error: any) {
    console.error('Update member error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const existing = await prisma.projectMember.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const gate = await assertCanManageMembers(tenant.userId, existing.projectId);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    await prisma.projectMember.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
