export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { geminiCompleteJsonText } from '@/lib/gemini-client';
import { parseGameSpecV1, safeParseGameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { validateAndPrepareSpec } from '@/lib/forge/engines';
import {
  buildGameGenerateSystemInstruction,
  buildGameGenerateUserText,
  FORGE_GAME_GENERATE_PROMPT_VERSION,
} from '@/lib/forge/prompts/game-generate';
import { requireForgeTenant, resolveForgeCompanyId } from '@/lib/forge/tenant';

export async function POST(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = (await req.json()) as {
      companyId?: string;
      methodology?: string;
      objectives?: string[];
      audience?: string;
      durationMinutes?: number;
      engine?: string;
      locale?: string;
      publish?: boolean;
    };

    const companyId = resolveForgeCompanyId(tenant, body.companyId ?? null);
    if (!companyId) return NextResponse.json({ error: 'Sem empresa' }, { status: 400 });

    const methodology = typeof body.methodology === 'string' ? body.methodology.trim() : '';
    if (!methodology) return NextResponse.json({ error: 'methodology é obrigatório' }, { status: 400 });

    let engineHint = body.engine;
    if (engineHint === 'auto' || !engineHint) {
      engineHint = methodology.length > 200 ? 'board' : 'quiz_race';
    }

    const rawJson = await geminiCompleteJsonText(
      buildGameGenerateSystemInstruction(),
      buildGameGenerateUserText({
        methodology,
        objectives: body.objectives,
        audience: body.audience,
        durationMinutes: body.durationMinutes,
        engine: engineHint,
        locale: body.locale,
      }),
      { maxOutputTokens: 16384 }
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      return NextResponse.json({ error: 'IA devolveu JSON inválido' }, { status: 422 });
    }

    const checked = safeParseGameSpecV1(parsed);
    if (!checked.success) {
      return NextResponse.json(
        { error: 'GameSpec inválido', details: checked.error.flatten() },
        { status: 422 }
      );
    }

    let spec = checked.data;
    if (body.engine && body.engine !== 'auto') {
      spec = { ...spec, engine: body.engine as typeof spec.engine };
    }

    try {
      spec = validateAndPrepareSpec(parseGameSpecV1(spec));
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Validação do motor falhou' },
        { status: 422 }
      );
    }

    const withMeta = {
      ...spec,
      aiMetadata: {
        methodology: methodology.slice(0, 2000),
        generatedAt: new Date().toISOString(),
        promptVersion: FORGE_GAME_GENERATE_PROMPT_VERSION,
      },
    };

    const row = await getForgeDb().forgeGameSpec.create({
      data: {
        companyId,
        engine: withMeta.engine,
        title: withMeta.title,
        definition: withMeta,
        status: body.publish ? 'published' : 'draft',
      },
    });

    return NextResponse.json({
      gameSpec: {
        id: row.id,
        engine: row.engine,
        title: row.title,
        status: row.status,
        definition: row.definition,
      },
      instructorNotes:
        'Revise cartões/perguntas antes de publicar numa atividade do tipo game.',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    const status = msg.includes('GEMINI') || msg.includes('Gemini') || msg.includes('Falta GEMINI') ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
