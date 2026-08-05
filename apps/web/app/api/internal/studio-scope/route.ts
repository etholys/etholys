import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { resolveStudioJwtScope } from '@/lib/studio/share';

export const dynamic = 'force-dynamic';

/** GET /api/internal/studio-scope — usado pelo middleware */
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const userId = (token?.id as string) || (token?.sub as string);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = await resolveStudioJwtScope(userId);
  return NextResponse.json(scope);
}
