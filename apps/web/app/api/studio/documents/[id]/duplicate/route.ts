import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import { duplicateStudioDocument } from '@/lib/studio/duplicate-document';

export const dynamic = 'force-dynamic';

/** POST /api/studio/documents/[id]/duplicate */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const companyId = await resolveStudioCompanyId(user.id, req.nextUrl.searchParams.get('companyId'));

  const result = await duplicateStudioDocument({
    userId: user.id,
    sourceId: params.id,
    companyId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ document: result.document });
}
