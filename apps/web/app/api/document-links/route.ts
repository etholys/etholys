export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  createDocumentLink,
  deleteDocumentLink,
  isDocLinkSystemKey,
  listDocumentLinks,
  type DocLinkTargetType,
} from '@/lib/document-links';
import { getDocumentAccess, canEditStudioContent } from '@/lib/studio/share';

async function assertStudioAccess(userId: string, documentId: string) {
  const doc = await prisma.studioDocument.findUnique({ where: { id: documentId } });
  if (!doc) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const access = await getDocumentAccess(userId, doc);
  if (access === 'none') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { doc, access };
}

async function assertCoreAccess(companyIds: string[], documentId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || !doc.isActive) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (!companyIds.includes(doc.companyId)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { doc };
}

/** GET ?targetType=studio|core&documentId= */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const targetType = (req.nextUrl.searchParams.get('targetType') || '') as DocLinkTargetType;
  const documentId = req.nextUrl.searchParams.get('documentId') || '';
  if ((targetType !== 'studio' && targetType !== 'core') || !documentId) {
    return NextResponse.json({ error: 'targetType e documentId obrigatórios' }, { status: 400 });
  }

  const tenant = await getUserCompanyIds();
  const companyIds = tenant?.companyIds || [];

  if (targetType === 'studio') {
    const gate = await assertStudioAccess(userId, documentId);
    if ('error' in gate && gate.error) return gate.error;
  } else {
    const gate = await assertCoreAccess(companyIds, documentId);
    if ('error' in gate && gate.error) return gate.error;
  }

  const links = await listDocumentLinks({
    targetType,
    studioDocumentId: targetType === 'studio' ? documentId : null,
    coreDocumentId: targetType === 'core' ? documentId : null,
  });
  return NextResponse.json({ links });
}

/** POST { targetType, documentId, systemKey, entityType, entityId, label? } */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetType = body.targetType as DocLinkTargetType;
  const documentId = String(body.documentId || '');
  if ((targetType !== 'studio' && targetType !== 'core') || !documentId) {
    return NextResponse.json({ error: 'targetType e documentId obrigatórios' }, { status: 400 });
  }
  if (!isDocLinkSystemKey(String(body.systemKey || '').toUpperCase())) {
    return NextResponse.json({ error: 'systemKey inválido' }, { status: 400 });
  }

  const tenant = await getUserCompanyIds();
  const companyIds = tenant?.companyIds || [];

  let companyId = '';
  if (targetType === 'studio') {
    const gate = await assertStudioAccess(userId, documentId);
    if ('error' in gate && gate.error) return gate.error;
    if (!canEditStudioContent(gate.access!)) {
      return NextResponse.json({ error: 'Sem permissão para editar' }, { status: 403 });
    }
    companyId = gate.doc!.companyId;
  } else {
    const gate = await assertCoreAccess(companyIds, documentId);
    if ('error' in gate && gate.error) return gate.error;
    companyId = gate.doc!.companyId;
  }

  try {
    const link = await createDocumentLink({
      targetType,
      companyId,
      studioDocumentId: targetType === 'studio' ? documentId : null,
      coreDocumentId: targetType === 'core' ? documentId : null,
      userId,
      link: {
        systemKey: String(body.systemKey).toUpperCase(),
        entityType: String(body.entityType || '').toLowerCase(),
        entityId: String(body.entityId || ''),
        label: typeof body.label === 'string' ? body.label : null,
        meta: body.meta && typeof body.meta === 'object' ? body.meta : null,
      },
    });
    return NextResponse.json({ link });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro' },
      { status: 400 },
    );
  }
}

/** DELETE ?id= */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const tenant = await getUserCompanyIds();
  const companyIds = tenant?.companyIds || [];

  const row = await prisma.etholysDocumentLink.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (row.targetType === 'studio' && row.studioDocumentId) {
    const gate = await assertStudioAccess(userId, row.studioDocumentId);
    if ('error' in gate && gate.error) return gate.error;
    if (!canEditStudioContent(gate.access!)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
  } else if (row.coreDocumentId) {
    if (!companyIds.includes(row.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const ok = await deleteDocumentLink(id, [...companyIds, row.companyId]);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ ok: true });
}
