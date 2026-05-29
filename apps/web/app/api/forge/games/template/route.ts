export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { FORGE_GAME_TEMPLATES } from '@/lib/forge/templates';
import { validateAndPrepareSpec } from '@/lib/forge/engines';
import { parseGameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { requireForgeTenant, resolveForgeCompanyId } from '@/lib/forge/tenant';

export async function POST(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = (await req.json()) as {
      companyId?: string;
      templateId?: string;
      courseId?: string;
      moduleId?: string;
    };

    const companyId = resolveForgeCompanyId(tenant, body.companyId ?? null);
    if (!companyId) return NextResponse.json({ error: 'Sem empresa' }, { status: 400 });

    const tpl = body.templateId ? FORGE_GAME_TEMPLATES[body.templateId] : null;
    if (!tpl) return NextResponse.json({ error: 'templateId inválido' }, { status: 400 });

    const spec = validateAndPrepareSpec(parseGameSpecV1(tpl.spec));
    const row = await getForgeDb().forgeGameSpec.create({
      data: {
        companyId,
        engine: spec.engine,
        title: spec.title,
        definition: spec,
        status: 'published',
      },
    });

    const { courseId, moduleId } = body;

    if (courseId) {
      const course = await getForgeDb().forgeCourse.findFirst({
        where: { id: courseId, companyId: { in: tenant.companyIds } },
      });
      if (course) {
        let targetModuleId = moduleId;
        if (targetModuleId) {
          const exists = await getForgeDb().forgeModule.findFirst({
            where: { id: targetModuleId, courseId: course.id },
          });
          if (!exists) targetModuleId = undefined;
        }
        if (!targetModuleId) {
          const mod = await getForgeDb().forgeModule.create({
            data: {
              courseId: course.id,
              title: 'Prática',
              sortOrder: await getForgeDb().forgeModule.count({ where: { courseId: course.id } }),
            },
          });
          targetModuleId = mod.id;
        }
        await getForgeDb().forgeLearningActivity.create({
          data: {
            moduleId: targetModuleId,
            type: 'game',
            title: spec.title,
            gameSpecId: row.id,
            xpWeight: 2,
            config: {},
            sortOrder: await getForgeDb().forgeLearningActivity.count({ where: { moduleId: targetModuleId } }),
          },
        });
      }
    }

    return NextResponse.json({ gameSpec: { id: row.id, title: row.title, engine: row.engine } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
