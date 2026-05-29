export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isExpedicionOwnerUserId } from '@/lib/forge/expedicion-owner';
import { seedExpedicionForOwner } from '@/lib/forge/seed-expedicion-for-owner';
import { seedExpedicionSostenibleCourse } from '@/lib/forge/seed-expedicion-sostenible';
import { requireForgeTenant, resolveForgeCompanyId } from '@/lib/forge/tenant';

export async function POST(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      companyId?: string;
      replace?: boolean;
      allMyCompanies?: boolean;
    };

    if (body.allMyCompanies) {
      if (!(await isExpedicionOwnerUserId(tenant.userId))) {
        return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
      }
      const result = await seedExpedicionForOwner({ replace: body.replace !== false });
      return NextResponse.json({ ok: true, ...result });
    }

    const companyId = resolveForgeCompanyId(tenant, body.companyId ?? null);
    if (!companyId) return NextResponse.json({ error: 'Sem empresa' }, { status: 400 });

    const courseId = await seedExpedicionSostenibleCourse(companyId, tenant.userId, {
      replace: Boolean(body.replace),
    });

    return NextResponse.json({ ok: true, courseId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
