export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    if (!clientId) return NextResponse.json({ error: 'clientId requerido' }, { status: 400 });

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || !tenant.companyIds.includes(client.companyId)) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const interactions = await prisma.clientInteraction.findMany({
      where: { clientId },
      orderBy: { date: 'desc' },
      take: 100,
    });
    return NextResponse.json({ interactions });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();

    const client = await prisma.client.findUnique({ where: { id: body.clientId } });
    if (!client || !tenant.companyIds.includes(client.companyId)) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const interaction = await prisma.clientInteraction.create({
      data: {
        clientId: body.clientId,
        type: body.type || 'note',
        subject: body.subject,
        description: body.description || null,
        contactName: body.contactName || null,
        date: body.date ? new Date(body.date) : new Date(),
        performedBy: tenant.userId,
      },
    });
    return NextResponse.json({ interaction });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const interaction = await prisma.clientInteraction.findUnique({ where: { id }, include: { client: true } });
    if (!interaction || !tenant.companyIds.includes(interaction.client.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await prisma.clientInteraction.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
