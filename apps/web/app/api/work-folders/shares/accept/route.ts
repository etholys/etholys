export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { acceptWorkFolderShare, getWorkSharePreview } from '@/lib/work/folder-share';

export async function GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get('token') || '';
    if (!token) return NextResponse.json({ error: 'token requerido' }, { status: 400 });
    const share = await getWorkSharePreview(token);
    if (!share) return NextResponse.json({ error: 'Convite inválido o expirado' }, { status: 404 });
    return NextResponse.json({
      share: {
        companyName: share.companyName,
        folder: share.folder,
        accessMode: share.accessMode,
        email: share.email,
        role: share.role,
        magicLoginToken: share.magicLoginToken,
      },
    });
  } catch (e) {
    console.error('work share preview', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || '');
    if (!token) return NextResponse.json({ error: 'token requerido' }, { status: 400 });
    const result = await acceptWorkFolderShare(token, session.user.id);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    console.error('work share accept', e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
