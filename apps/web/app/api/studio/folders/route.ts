import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';

export const dynamic = 'force-dynamic';

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

/** POST /api/studio/folders — create folder */
export async function POST(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = await resolveStudioCompanyId(
    user.id,
    typeof body.companyId === 'string' ? body.companyId : null,
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null;
  if (parentId) {
    const parent = await prisma.studioFolder.findFirst({ where: { id: parentId, companyId } });
    if (!parent) return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
  }

  try {
    const folder = await prisma.studioFolder.create({
      data: {
        companyId,
        parentId,
        name,
        createdById: user.id,
      },
    });
    return NextResponse.json({ folder }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'Failed to create folder', detail: msg }, { status: 503 });
  }
}

/** DELETE /api/studio/folders?id= */
export async function DELETE(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const companyId = await resolveStudioCompanyId(
    user.id,
    req.nextUrl.searchParams.get('companyId'),
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const folder = await prisma.studioFolder.findFirst({ where: { id, companyId } });
  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.studioFolder.delete({ where: { id: folder.id } });
  return NextResponse.json({ ok: true });
}
