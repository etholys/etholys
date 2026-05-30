export const dynamic = 'force-dynamic';



import { NextRequest, NextResponse } from 'next/server';

import { getForgeDb } from '@/lib/forge/db';

import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';

import { parseForgeEmailLocale } from '@/lib/forge/email-templates';
import { inviteOneLearner } from '@/lib/forge/invite-learner-core';

import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';



type Ctx = { params: Promise<{ id: string }> };



export async function POST(req: NextRequest, ctx: Ctx) {

  try {

    const tenant = await requireForgeTenant();

    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });



    const { id: courseId } = await ctx.params;

    const course = await loadCourseForTenant(courseId, tenant);

    if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });



    const access = await getForgeCourseAccess(

      tenant.userId,

      course.companyId,

      course.id,

      course.createdById

    );

    if (!access.canFacilitate) {

      return NextResponse.json({ error: 'Sin permiso para invitar alumnos' }, { status: 403 });

    }



    const body = (await req.json()) as { emails?: string[]; locale?: string };
    const locale = parseForgeEmailLocale(body.locale);

    const emails = (body.emails ?? [])

      .map((e) => e.trim().toLowerCase())

      .filter((e) => e.includes('@'));

    if (emails.length === 0) {

      return NextResponse.json({ error: 'Indica al menos un email' }, { status: 400 });

    }



    const inviter = await getForgeDb().user.findUnique({

      where: { id: tenant.userId },

      select: { name: true },

    });



    const results: Awaited<ReturnType<typeof inviteOneLearner>>[] = [];

    for (const email of emails) {

      results.push(

        await inviteOneLearner({

          courseId,

          courseTitle: course.title,

          email,

          invitedById: tenant.userId,

          inviterName: inviter?.name,
          locale,
        })

      );

    }



    return NextResponse.json({

      results: emails.map((email, i) => ({ email, ...results[i] })),

    });

  } catch (e) {

    const msg = e instanceof Error ? e.message : 'Erro';

    return NextResponse.json({ error: msg }, { status: 500 });

  }

}

