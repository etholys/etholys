export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { presignLibroUpload, resolveLibroViewUrl, saveLibroMeta } from '@/lib/forge/course-libro';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const tenant = await requireForgeTenant();
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id: courseId } = await ctx.params;
  const course = await loadCourseForTenant(courseId, tenant);
  if (!course) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const url = await resolveLibroViewUrl(courseId);
  return NextResponse.json({
    url,
    fileName: course.libroPdfName,
    hasLibro: Boolean(course.libroPdfPath),
    libroOcrStatus: course.libroOcrStatus,
    libroOcrReady: course.libroOcrStatus === 'done',
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const tenant = await requireForgeTenant();
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id: courseId } = await ctx.params;
  const course = await loadCourseForTenant(courseId, tenant);
  if (!course) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const access = await getForgeCourseAccess(
    tenant.userId,
    course.companyId,
    course.id,
    course.createdById
  );
  if (!access.canFacilitate) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
  }

  const body = (await req.json()) as { action?: string; fileName?: string; storagePath?: string };

  if (body.action === 'presign') {
    const fileName = body.fileName?.trim() || 'libro.pdf';
    const presign = await presignLibroUpload(courseId, fileName);
    return NextResponse.json(presign);
  }

  if (body.action === 'confirm' && body.storagePath) {
    await saveLibroMeta(courseId, body.storagePath, body.fileName || 'libro.pdf');
    const url = await resolveLibroViewUrl(courseId);
    return NextResponse.json({ ok: true, url });
  }

  return NextResponse.json({ error: 'action inválida' }, { status: 400 });
}
