export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

// GET: list invitations for user's companies
export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const where: any = {};
    if (companyId && tenant.companyIds.includes(companyId)) {
      where.companyId = companyId;
    } else {
      where.companyId = { in: tenant.companyIds };
    }
    const invitations = await prisma.invitation.findMany({
      where,
      include: { company: true, inviter: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ invitations });
  } catch (error: any) {
    console.error('Invitations GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST: create invitation
export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { companyId, email, role } = body;
    if (!companyId || !email) return NextResponse.json({ error: 'companyId y email requeridos' }, { status: 400 });
    if (!tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'No tienes acceso a esta empresa' }, { status: 403 });
    }
    // Check if user already in company
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const alreadyMember = await prisma.companyUser.findFirst({ where: { userId: existingUser.id, companyId } });
      if (alreadyMember) return NextResponse.json({ error: 'Este usuario ya es miembro de la empresa' }, { status: 400 });
    }
    // Check for existing pending invite
    const existingInvite = await prisma.invitation.findFirst({ where: { companyId, email, status: 'pending' } });
    if (existingInvite) return NextResponse.json({ error: 'Ya existe una invitación pendiente para este email' }, { status: 400 });
    const invitation = await prisma.invitation.create({
      data: {
        companyId,
        email,
        role: role || 'COLLABORATOR',
        invitedBy: tenant.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      include: { company: true, inviter: { select: { name: true } } },
    });

    // Send invitation email
    try {
      const appUrl = process.env.NEXTAUTH_URL || 'https://etholys.abacusai.app';
      const appName = 'ETHOLYS';
      const inviterName = invitation.inviter?.name || 'Un administrador';
      const companyName = invitation.company?.name || 'una empresa';
      const loginUrl = `${appUrl}/login`;
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #2dd4bf; margin: 0; font-size: 24px;">ETHOLYS</h1>
            <p style="color: #94a3b8; margin: 5px 0 0; font-size: 12px; letter-spacing: 2px;">SOLUTIONS FACTORY</p>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1e293b; margin: 0 0 15px;">Invitaci\u00f3n a ${companyName}</h2>
            <p style="color: #475569; line-height: 1.6;">
              <strong>${inviterName}</strong> te ha invitado a unirte a <strong>${companyName}</strong> en la plataforma ETHOLYS.
            </p>
            <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0; color: #475569;"><strong>C\u00f3digo de invitaci\u00f3n:</strong></p>
              <p style="font-family: monospace; font-size: 18px; color: #0d9488; font-weight: bold; margin: 5px 0;">${invitation.code}</p>
              <p style="margin: 5px 0; color: #475569;"><strong>Rol asignado:</strong> ${invitation.role}</p>
            </div>
            <p style="color: #475569; line-height: 1.6;">
              Para aceptar la invitaci\u00f3n, ingresa a ETHOLYS y usa el c\u00f3digo durante el registro, o accede a Configuraci\u00f3n si ya tienes cuenta.
            </p>
            <div style="text-align: center; margin: 25px 0;">
              <a href="${loginUrl}" style="background: #0d9488; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Acceder a ETHOLYS</a>
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">
              Esta invitaci\u00f3n expira en 7 d\u00edas. Si no solicitaste esto, puedes ignorar este mensaje.
            </p>
          </div>
        </div>
      `;
      await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployment_token: process.env.ABACUSAI_API_KEY,
          app_id: process.env.WEB_APP_ID,
          notification_id: process.env.NOTIF_ID_INVITACIN_A_EMPRESA,
          subject: `Invitaci\u00f3n a ${companyName} en ETHOLYS`,
          body: htmlBody,
          is_html: true,
          recipient_email: email,
          sender_email: `noreply@etholys.abacusai.app`,
          sender_alias: appName,
        }),
      });
    } catch (emailErr) {
      console.error('Error sending invitation email:', emailErr);
    }

    return NextResponse.json({ invitation });
  } catch (error: any) {
    console.error('Invitations POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT: accept invitation by code
export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { code } = body;
    if (!code) return NextResponse.json({ error: 'Código de invitación requerido' }, { status: 400 });
    const invitation = await prisma.invitation.findUnique({ where: { code }, include: { company: true } });
    if (!invitation) return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 });
    if (invitation.status !== 'pending') return NextResponse.json({ error: 'Esta invitación ya fue usada o revocada' }, { status: 400 });
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'expired' } });
      return NextResponse.json({ error: 'Invitación expirada' }, { status: 400 });
    }
    // Check if already member
    const alreadyMember = await prisma.companyUser.findFirst({ where: { userId: tenant.userId, companyId: invitation.companyId } });
    if (alreadyMember) {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'accepted', acceptedAt: new Date() } });
      return NextResponse.json({ success: true, message: 'Ya eres miembro de esta empresa', company: invitation.company });
    }
    // Add user to company
    await prisma.companyUser.create({
      data: { userId: tenant.userId, companyId: invitation.companyId, role: invitation.role },
    });
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'accepted', acceptedAt: new Date() } });
    return NextResponse.json({ success: true, message: 'Te has unido a la empresa exitosamente', company: invitation.company });
  } catch (error: any) {
    console.error('Invitations PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE: revoke invitation
export async function DELETE(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    const invitation = await prisma.invitation.findUnique({ where: { id } });
    if (!invitation || !tenant.companyIds.includes(invitation.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    await prisma.invitation.update({ where: { id }, data: { status: 'revoked' } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Invitations DELETE error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
