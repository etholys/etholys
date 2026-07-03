export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { buildExecutionPassport } from '@/lib/fundhub/build-execution-passport';
import { resolveCompanyIdFromShareToken } from '@/lib/fundhub/passport-share';

/** Passaporte público (só leitura) — requer token activo. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const companyId = await resolveCompanyIdFromShareToken(token);
  if (!companyId) {
    return NextResponse.json({ error: 'Link inválido ou revogado', code: 'PASSPORT_SHARE_FORBIDDEN' }, { status: 404 });
  }

  const passport = await buildExecutionPassport(companyId, { publicView: true });
  if (!passport) {
    return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 });
  }

  return NextResponse.json({
    public: true,
    ...passport,
  });
}
