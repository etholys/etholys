export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getForgeDb } from '@/lib/forge/db';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { id: courseId } = await ctx.params;
    const course = await loadCourseForTenant(courseId, tenant);
    if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    const groups = await getForgeDb().forgePlayGroup.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { enrollments: true } },
        liveSession: { select: { id: true, title: true, startsAt: true } },
      },
    });

    return NextResponse.json({
      groups: groups.map((g: (typeof groups)[number]) => ({
        id: g.id,
        name: g.name,
        mode: g.mode,
        liveSessionId: g.liveSessionId,
        liveSessionTitle: g.liveSession?.title,
        startsAt: g.liveSession?.startsAt?.toISOString(),
        memberCount: g._count.enrollments,
        hasInvite: Boolean(g.inviteToken),
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}

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
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }

    const body = (await req.json()) as {
      name?: string;
      mode?: string;
      liveSessionId?: string | null;
    };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: 'Nombre del grupo requerido' }, { status: 400 });

    const mode = body.mode === 'individual_coaching' ? 'individual_coaching' : 'live_team';
    const liveSessionId =
      typeof body.liveSessionId === 'string' && body.liveSessionId ? body.liveSessionId : null;

    if (liveSessionId) {
      const ls = await getForgeDb().forgeLiveSession.findFirst({
        where: { id: liveSessionId, courseId },
      });
      if (!ls) return NextResponse.json({ error: 'Sesión inválida' }, { status: 400 });
    }

    const inviteToken = randomBytes(24).toString('base64url');
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);

    const group = await getForgeDb().forgePlayGroup.create({
      data: {
        courseId,
        name,
        mode,
        liveSessionId,
        inviteToken,
        inviteExpiresAt: expires,
      },
    });

    const base =
      process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
      process.env.FORGE_PUBLIC_URL?.replace(/\/$/, '') ||
      '';
    const inviteUrl = `${base}/hub/forge/activar?token=${encodeURIComponent(inviteToken)}&group=${group.id}`;

    return NextResponse.json(
      {
        group: { id: group.id, name: group.name, mode: group.mode, liveSessionId: group.liveSessionId },
        inviteUrl,
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}
