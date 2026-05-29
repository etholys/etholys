export const dynamic = 'force-dynamic';

import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { getWebAppRoot } from '@/lib/prisma-app-root';

function readGeneratedForgeHint(webRoot: string) {
  const dts = path.join(webRoot, 'node_modules', '.prisma', 'client', 'index.d.ts');
  if (!fs.existsSync(dts)) {
    return { generatedClient: 'missing', hasForgeInTypes: false };
  }
  const text = fs.readFileSync(dts, 'utf8');
  return {
    generatedClient: dts,
    hasForgeInTypes: text.includes('ForgeCourse') || text.includes('forgeCourse'),
  };
}

export async function GET() {
  try {
    const webRoot = getWebAppRoot();
    const generated = readGeneratedForgeHint(webRoot);
    const db = getForgeDb();
    const forgeDelegates = Object.keys(db).filter((k) => k.startsWith('forge'));
    const hasForgeCourse = typeof db.forgeCourse?.findMany === 'function';
    const inDocker = webRoot === '/app' || process.cwd() === '/app';

    if (!hasForgeCourse) {
      return NextResponse.json(
        {
          ok: false,
          webRoot,
          cwd: process.cwd(),
          inDocker,
          forgeDelegates,
          ...generated,
          hint: inDocker
            ? 'Docker: docker compose -f infra/docker-compose.yml down && docker volume rm <projeto>_etholys_web_node_modules && docker compose -f infra/docker-compose.yml up -d web — veja logs do contentor etholys-nextjs'
            : 'Local: cd apps/web && npm run dev:clean',
        },
        { status: 503 }
      );
    }

    const count = await db.forgeCourse.count();
    const migrations = ['20260602120000_forge_invite_token', '20260603120000_forge_extras'];
    return NextResponse.json({
      ok: true,
      webRoot,
      cwd: process.cwd(),
      inDocker,
      forgeCourseCount: count,
      forgeDelegates,
      features: {
        resend: Boolean(process.env.RESEND_API_KEY),
        cron: Boolean(process.env.FORGE_CRON_SECRET),
        magicLogin: true,
        bulkInvite: true,
        publicVerify: true,
      },
      expectedMigrations: migrations,
      ...generated,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
