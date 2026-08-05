export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { createMeetForNexus } from '@/lib/meet/nexus-bridge';

/** Espelho NEXUS — cria / reutiliza sala Meet com mirror=nexus. */
export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = (await req.json()) as {
      companyId?: string;
      title?: string;
      description?: string;
    };

    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const result = await createMeetForNexus({
      companyId,
      createdById: tenant.userId,
      title: body.title,
      description: body.description,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/nexus]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
