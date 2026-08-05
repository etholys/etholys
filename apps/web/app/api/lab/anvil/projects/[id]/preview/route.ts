export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAnvilAccess, canAccessProject } from '@/lib/lab-anvil/access';
import { buildSandboxPreview } from '@/lib/lab-anvil/preview';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const access = await requireAnvilAccess();
  if (!access?.hasAccess) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!(await canAccessProject(access, id))) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
  }

  const url = new URL(req.url);
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    `${url.protocol}//${url.host}`;

  try {
    const result = await buildSandboxPreview({ projectId: id, baseUrl });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro no preview' },
      { status: 400 },
    );
  }
}
