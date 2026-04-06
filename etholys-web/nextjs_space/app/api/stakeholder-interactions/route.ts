export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const stakeholderId = searchParams.get('stakeholderId');
    if (!stakeholderId) return NextResponse.json({ error: 'Missing stakeholderId' }, { status: 400 });

    const stakeholder = await prisma.stakeholder.findUnique({ where: { id: stakeholderId } });
    if (!stakeholder || !tenant.companyIds.includes(stakeholder.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const interactions = await prisma.stakeholderInteraction.findMany({
      where: { stakeholderId },
      orderBy: { date: 'desc' },
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
    if (!body.stakeholderId) return NextResponse.json({ error: 'Missing stakeholderId' }, { status: 400 });

    const stakeholder = await prisma.stakeholder.findUnique({ where: { id: body.stakeholderId } });
    if (!stakeholder || !tenant.companyIds.includes(stakeholder.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const interaction = await prisma.stakeholderInteraction.create({
      data: {
        stakeholderId: body.stakeholderId,
        type: body.type || 'note',
        subject: body.subject || '',
        description: body.description || null,
        contactName: body.contactName || null,
        date: body.date ? new Date(body.date) : new Date(),
        performedBy: body.performedBy || null,
      },
    });
    return NextResponse.json({ interaction });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
