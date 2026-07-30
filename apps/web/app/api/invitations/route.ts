export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { assertCanInviteToCompany } from '@/lib/workspace-access-scope';
import { isPrecommercialMode } from '@/lib/platform-access';
import { normalizeSystemsInput } from '@/lib/integrated-workspace-shared';
import type { Prisma } from '@prisma/client';

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
      include: { company: true, inviter: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ invitations });
  } catch (error: unknown) {
    console.error('Invitations GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = (await req.json()) as {
      companyId?: string;
      email?: string;
      role?: string;
      systems?: unknown;
    };
    const companyId = body.companyId?.trim();
    const email = body.email?.trim().toLowerCase();
    if (!companyId || !email) {
      return NextResponse.json({ error: 'companyId y email requeridos' }, { status: 400 });
    }
    if (!tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'No tienes acceso a esta empresa' }, { status: 403 });
    }
    if (!(await assertCanInviteToCompany(tenant.userId, companyId))) {
      return NextResponse.json(
        { error: 'Sólo administradores pueden invitar a funciones.' },
        { status: 403 },
      );
    }

    const systems = normalizeSystemsInput(body.systems);
    if (isPrecommercialMode() && systems.length === 0) {
      return NextResponse.json(
        {
          error:
            'En fase pré-comercial debe elegir al menos un sistema/función (SIEP, ATLAS, FORGE, …).',
        },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const alreadyMember = await prisma.companyUser.findFirst({
        where: { userId: existingUser.id, companyId },
      });
      if (alreadyMember) {
        return NextResponse.json({ error: 'Este usuario ya es miembro de la empresa' }, { status: 400 });
      }
    }

    const existingInvite = await prisma.invitation.findFirst({
      where: { companyId, email, status: 'pending' },
    });
    if (existingInvite) {
      return NextResponse.json({ error: 'Ya existe una invitación pendiente para este email' }, { status: 400 });
    }

    const invitation = await prisma.invitation.create({
      data: {
        companyId,
        email,
        role: (body.role as 'COLLABORATOR') || 'COLLABORATOR',
        invitedBy: tenant.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        systems:
          systems.length > 0
            ? (systems as unknown as Prisma.InputJsonValue)
            : undefined,
      },
      include: { company: true, inviter: { select: { name: true } } },
    });

    // Se o user já existe: adicionar à empresa + grant já
    if (existingUser) {
      await prisma.companyUser.create({
        data: {
          userId: existingUser.id,
          companyId,
          role: 'COLLABORATOR',
        },
      });
      if (systems.length > 0) {
        await prisma.integratedWorkspaceAccess.upsert({
          where: { companyId_userId: { companyId, userId: existingUser.id } },
          create: {
            companyId,
            userId: existingUser.id,
            systems: systems as unknown as Prisma.InputJsonValue,
            enabled: true,
            grantedByUserId: tenant.userId,
          },
          update: {
            systems: systems as unknown as Prisma.InputJsonValue,
            enabled: true,
            grantedByUserId: tenant.userId,
          },
        });
      }
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      });
    }

    try {
      const appUrl = (process.env.NEXTAUTH_URL || 'https://app.etholys.com').replace(/\/$/, '');
      const inviterName = invitation.inviter?.name || 'Un administrador';
      const companyName = invitation.company?.name || 'una empresa';
      const loginUrl = `${appUrl}/login?invite=${encodeURIComponent(invitation.code)}`;
      const systemsLabel = systems.length > 0 ? systems.join(', ') : 'acceso limitado';
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #0f172a; padding: 24px; text-align: center;">
            <h1 style="color: #2dd4bf; margin: 0;">ETHOLYS</h1>
          </div>
          <div style="padding: 24px; border: 1px solid #e2e8f0;">
            <p><strong>${inviterName}</strong> te invitó a usar <strong>${systemsLabel}</strong> en ${companyName}.</p>
            <p>No verás el Hub completo — solo las funciones asignadas.</p>
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
            recipient_email: email,
            sender_email: 'noreply@etholys.abacusai.app',
            sender_alias: 'ETHOLYS',
          }),
        });
      } else if (process.env.RESEND_API_KEY) {
        // Resend opcional — fetch HTTP evita dependência de pacote no build
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.AUTH_EMAIL_FROM || 'Etholys <noreply@etholys.com>',
            to: [email],
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
        alreadyAccepted: Boolean(existingUser),
        loginHint: `/login?invite=${invitation.code}`,
      },
    });
  } catch (error: unknown) {
    console.error('Invitations POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
