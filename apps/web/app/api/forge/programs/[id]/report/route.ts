export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { getProgramAnalytics } from '@/lib/forge/program-analytics';
import { parseForgeEmailLocale } from '@/lib/forge/email-templates';
import { programAnalyticsReportHtml } from '@/lib/forge/analytics-report-html';
import { requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const program = await getForgeDb().forgeProgram.findUnique({ where: { id } });
    if (!program) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (!tenant.companyIds.includes(program.companyId)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }

    const analytics = await getProgramAnalytics(id);
    if (!analytics) return NextResponse.json({ error: 'Sin datos' }, { status: 404 });

    const locale = parseForgeEmailLocale(req.nextUrl.searchParams.get('lang'));
    const html = programAnalyticsReportHtml(analytics, locale);
    const filename = `forge-trilha-${id.slice(0, 8)}.html`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}
