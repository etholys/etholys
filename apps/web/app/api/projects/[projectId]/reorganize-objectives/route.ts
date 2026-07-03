export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  applyReparentLinks,
  reorganizeProjectObjectives,
  suggestObjectiveReparentLinks,
} from '@/lib/siep/reorganize-objectives';

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { id: true, companyId: true },
    });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const instructions = typeof body.instructions === 'string' ? body.instructions : undefined;
    const preview = body.preview === true;

    if (preview) {
      const { links, summary } = await suggestObjectiveReparentLinks(params.projectId, instructions);
      return NextResponse.json({ preview: true, links, summary, count: links.length });
    }

    const result = await reorganizeProjectObjectives(params.projectId, instructions);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[SIEP] reorganize-objectives error:', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Aplicar links já validados (opcional). */
export async function PUT(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { id: true, companyId: true },
    });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const links = Array.isArray(body.links) ? body.links : [];
    const result = await applyReparentLinks(params.projectId, links);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[SIEP] apply reparent links error:', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
