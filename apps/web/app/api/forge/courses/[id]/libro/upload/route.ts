export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { saveLibroLocal } from '@/lib/forge/course-libro';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

/** Upload directo a disco (sin S3) — desarrollo o fallback */
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

  const form = await req.formData();
  const file = form.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Archivo PDF requerido' }, { status: 400 });
  }

  const name = file instanceof File ? file.name : 'libro.pdf';
  if (!name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Solo PDF' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'Máximo 50 MB' }, { status: 400 });
  }

  const rel = await saveLibroLocal(courseId, buf, name);
  return NextResponse.json({ ok: true, storagePath: rel, url: `/${rel}` });
}
