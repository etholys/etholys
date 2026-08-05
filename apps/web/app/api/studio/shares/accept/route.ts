import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { acceptShareByToken } from '@/lib/studio/share';

export const dynamic = 'force-dynamic';

/** GET /api/studio/shares/accept?token= — metadados da partilha */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim();
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const share = await prisma.studioShare.findFirst({
    where: { token, status: 'active' },
    select: {
      id: true,
      targetType: true,
      role: true,
      accessMode: true,
      email: true,
      expiresAt: true,
      magicLoginToken: true,
      folder: { select: { id: true, name: true } },
      document: { select: { id: true, title: true } },
      company: { select: { shortName: true, name: true } },
    },
  });
  if (!share) return NextResponse.json({ error: 'Partilha inválida ou expirada' }, { status: 404 });
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Partilha expirada' }, { status: 410 });
  }

  return NextResponse.json({
    share: {
      id: share.id,
      targetType: share.targetType,
      role: share.role,
      accessMode: share.accessMode,
      email: share.email,
      folder: share.folder,
      document: share.document,
      companyName: share.company.shortName || share.company.name,
      magicLoginToken: share.magicLoginToken,
    },
  });
}

/** POST /api/studio/shares/accept — { token } marca aceite e devolve destino */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const userId = session?.user?.email
    ? (await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }))?.id
    : null;

  const share = await acceptShareByToken(token, userId);
  if (!share) return NextResponse.json({ error: 'Partilha inválida' }, { status: 404 });

  const href =
    share.targetType === 'document' && share.documentId
      ? `/hub/studio/${share.documentId}`
      : share.folderId
        ? `/studio/f/${share.folderId}`
        : '/studio/shared';

  return NextResponse.json({
    ok: true,
    href,
    accessMode: share.accessMode,
    magicLoginToken: share.magicLoginToken,
    email: share.email,
  });
}
