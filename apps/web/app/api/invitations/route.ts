export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { assertCanInviteToCompany } from '@/lib/workspace-access-scope';
import { isPrecommercialMode } from '@/lib/platform-access';
import { normalizeSystemsInput, parseSystemsJson } from '@/lib/integrated-workspace-shared';
import { validateInvitePayload, type EtholysInvitePayload } from '@/lib/etholys-invite';
import { applyAcceptedInvitation, invitationRowToApplyOpts } from '@/lib/etholys-invite-apply';
import type { Prisma, UserRole } from '@prisma/client';
import {
  assertSeatAvailable,
  assertSystemsAllowedForCompany,
} from '@/lib/billing/company-entitlements';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const where: { companyId: string | { in: string[] } } = companyId && tenant.companyIds.includes(companyId)
      ? { companyId }
      : { companyId: { in: tenant.companyIds } };
    const invitations = await prisma.invitation.findMany({
      where,
      include: {
        company: true,
        inviter: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({
      invitations: invitations.map((inv) => ({
        ...inv,
        systems: parseSystemsJson(inv.systems),
      })),
    });
  } catch (error: unknown) {
    console.error('Invitations GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = (await req.json()) as EtholysInvitePayload & { role?: string };
    const validated = validateInvitePayload({
      ...body,
      role: body.role === 'ADMIN' ? 'ADMIN' : 'COLLABORATOR',
    });
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const data = validated.data;

    if (!tenant.companyIds.includes(data.companyId)) {
      return NextResponse.json({ error: 'No tienes acceso a esta empresa' }, { status: 403 });
    }
    if (!(await assertCanInviteToCompany(tenant.userId, data.companyId))) {
      return NextResponse.json(
        { error: 'Sólo administradores pueden invitar a funciones.' },
        { status: 403 },
      );
    }

    if (data.inviteKind === 'ally' && data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, companyId: data.companyId },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json({ error: 'Proyecto no pertenece a esta empresa.' }, { status: 400 });
      }
    }

    const systemsRaw = normalizeSystemsInput(data.systems);
    const seatCheck = await assertSeatAvailable(data.companyId);
    if (!seatCheck.ok) {
      return NextResponse.json({ error: seatCheck.error }, { status: 400 });
    }
    let systems = systemsRaw;
    if (systems.length > 0 && data.inviteKind !== 'ally') {
      const allowed = await assertSystemsAllowedForCompany(data.companyId, systems);
      if (!allowed.ok) {
        return NextResponse.json({ error: allowed.error }, { status: 400 });
      }
      systems = allowed.systems;
    }
    if (isPrecommercialMode() && data.role !== 'ADMIN' && systems.length === 0 && data.inviteKind !== 'ally') {
      return NextResponse.json(
        {
          error:
            'En fase pré-comercial debe elegir al menos un sistema/función (SIEP, ATLAS, FORGE, …).',
        },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser && data.inviteKind !== 'ally') {
      const alreadyMember = await prisma.companyUser.findFirst({
        where: { userId: existingUser.id, companyId: data.companyId },
      });
      if (alreadyMember) {
        return NextResponse.json({ error: 'Este usuario ya es miembro de la empresa' }, { status: 400 });
      }
    }

    const existingInvite = await prisma.invitation.findFirst({
      where: { companyId: data.companyId, email: data.email, status: 'pending' },
    });
    if (existingInvite) {
      return NextResponse.json({ error: 'Ya existe una invitación pendiente para este email' }, { status: 400 });
    }

    const accessMode = data.inviteKind === 'ally' ? 'project_guest' : 'company';
    const role = (data.role || 'COLLABORATOR') as UserRole;

    const invitation = await prisma.invitation.create({
      data: {
        companyId: data.companyId,
        email: data.email,
        role,
        invitedBy: tenant.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        inviteKind: data.inviteKind,
        jobTitle: data.jobTitle || null,
        accessUntil: data.accessUntil ? new Date(data.accessUntil) : null,
        systems: systems.length > 0 ? (systems as unknown as Prisma.InputJsonValue) : undefined,
        projectId: data.projectId || null,
        accessMode,
        projectPermissions: data.projectPermissions?.length
          ? (data.projectPermissions as unknown as Prisma.InputJsonValue)
          : undefined,
        companySiepPermissions: data.companySiepPermissions?.length
          ? (data.companySiepPermissions as unknown as Prisma.InputJsonValue)
          : undefined,
      },
      include: {
        company: true,
        inviter: { select: { name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    let alreadyAccepted = false;
    if (existingUser) {
      await applyAcceptedInvitation(
        invitationRowToApplyOpts(invitation, existingUser.id, systems),
      );
      alreadyAccepted = true;
    }

    try {
      const appUrl = (process.env.NEXTAUTH_URL || 'https://app.etholys.com').replace(/\/$/, '');
      const inviterName = invitation.inviter?.name || 'Un administrador';
      const companyName = invitation.company?.name || 'una empresa';
      const loginUrl = `${appUrl}/login?invite=${encodeURIComponent(invitation.code)}`;
      const systemsLabel = systems.length > 0 ? systems.join(', ') : data.role === 'ADMIN' ? 'Hub completo' : 'acceso limitado';
      const kindLabel =
        data.inviteKind === 'ally'
          ? 'aliado de proyecto'
          : data.inviteKind === 'temporary'
            ? 'acceso temporal'
            : 'miembro';
      const cargoLine = data.jobTitle ? `<p><strong>Cargo:</strong> ${data.jobTitle}</p>` : '';
      const projectLine =
        invitation.project?.name
          ? `<p><strong>Proyecto:</strong> ${invitation.project.name}</p>`
          : '';
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0f172a; padding: 24px; text-align: center;">
            <h1 style="color: #2dd4bf; margin: 0;">ETHOLYS</h1>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0;">
            <p><strong>${inviterName}</strong> te invitó como <strong>${kindLabel}</strong> a usar <strong>${systemsLabel}</strong> en ${companyName}.</p>
            ${cargoLine}
            ${projectLine}
            <p>No verás el Hub completo — solo las funciones asignadas (salvo Administrador).</p>
            <p><strong>Código:</strong> <code style="font-size:18px;color:#0d9488">${invitation.code}</code></p>
            <p style="text-align:center;margin:24px 0">
              <a href="${loginUrl}" style="background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Activar acceso</a>
            </p>
            <p style="color:#94a3b8;font-size:12px">Expira en 7 días.</p>
          </div>
        </div>`;
      if (process.env.ABACUSAI_API_KEY) {
        await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deployment_token: process.env.ABACUSAI_API_KEY,
            app_id: process.env.WEB_APP_ID,
            notification_id: process.env.NOTIF_ID_INVITACIN_A_EMPRESA,
            subject: `Invitación Etholys — ${systemsLabel}`,
            body: htmlBody,
            is_html: true,
            recipient_email: data.email,
            sender_email: 'noreply@etholys.abacusai.app',
            sender_alias: 'ETHOLYS',
          }),
        });
      } else if (process.env.RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.AUTH_EMAIL_FROM || 'Etholys <noreply@etholys.com>',
            to: [data.email],
            subject: `Invitación Etholys — ${systemsLabel}`,
            html: htmlBody,
          }),
        });
      }
    } catch (emailErr) {
      console.error('Error sending invitation email:', emailErr);
    }

    return NextResponse.json({
      invitation: {
        ...invitation,
        systems,
        alreadyAccepted,
        loginHint: `/login?invite=${invitation.code}`,
      },
    });
  } catch (error: unknown) {
    console.error('Invitations POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/** Aceitar convite por código (utilizador já autenticado). */
export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = (await req.json()) as { code?: string };
    const code = String(body.code || '').trim();
    if (!code) return NextResponse.json({ error: 'Código requerido' }, { status: 400 });

    const invitation = await prisma.invitation.findUnique({ where: { code } });
    if (!invitation || invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Código inválido o ya usado' }, { status: 400 });
    }
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: 'Esta invitación expiró' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: tenant.userId },
      select: { email: true },
    });
    if (user?.email && user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Este código fue enviado a otro email. Inicia sesión con esa cuenta.' },
        { status: 403 },
      );
    }

    const systems = normalizeSystemsInput(parseSystemsJson(invitation.systems));
    await applyAcceptedInvitation(invitationRowToApplyOpts(invitation, tenant.userId, systems));

    return NextResponse.json({
      ok: true,
      message: 'Te has unido correctamente.',
      companyId: invitation.companyId,
      systems,
    });
  } catch (error: unknown) {
    console.error('Invitations PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id')?.trim();
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const invitation = await prisma.invitation.findUnique({ where: { id } });
    if (!invitation) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    if (!tenant.companyIds.includes(invitation.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    if (!(await assertCanInviteToCompany(tenant.userId, invitation.companyId))) {
      return NextResponse.json({ error: 'Sólo administradores' }, { status: 403 });
    }

    await prisma.invitation.update({
      where: { id },
      data: { status: 'revoked' },
    });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('Invitations DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
