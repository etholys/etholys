import { prisma } from '@/lib/prisma';
import { prismaHasEnumValue } from '@/lib/prisma-has-field';
import { recordStudioActivity } from '@/lib/studio/activity';
import { getDocumentAccess } from '@/lib/studio/share';
import { normalizeStudioCanvas } from '@/lib/studio/types';

export async function duplicateStudioDocument(opts: {
  userId: string;
  sourceId: string;
  companyId?: string | null;
}): Promise<
  | { ok: true; document: { id: string; title: string; folderId: string | null } }
  | { ok: false; status: number; error: string }
> {
  const source = await prisma.studioDocument.findFirst({
    where: opts.companyId
      ? { id: opts.sourceId, companyId: opts.companyId }
      : { id: opts.sourceId },
  });
  if (!source) return { ok: false, status: 404, error: 'Not found' };

  const access = await getDocumentAccess(opts.userId, source);
  if (access === 'none' || access === 'viewer') {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  const canvas = normalizeStudioCanvas(source.canvasState);
  const copyTitle = `${source.title} (cópia)`.slice(0, 200);

  let aiSessionId: string | null = null;
  try {
    const kind = prismaHasEnumValue('AiAdvisorSessionKind', 'STUDIO_DOC')
      ? 'STUDIO_DOC'
      : 'WORKSPACE_ADVISOR';
    const sess = await prisma.aiAdvisorSession.create({
      data: {
        companyId: source.companyId,
        userId: opts.userId,
        title: `Studio: ${copyTitle}`.slice(0, 120),
        kind: kind as 'STUDIO_DOC' | 'WORKSPACE_ADVISOR',
      },
    });
    aiSessionId = sess.id;
  } catch {
    /* optional */
  }

  const doc = await prisma.studioDocument.create({
    data: {
      companyId: source.companyId,
      folderId: source.folderId,
      title: copyTitle,
      format: source.format,
      visibility: source.visibility,
      canvasState: canvas,
      templateKey: source.templateKey,
      aiSessionId,
      createdById: opts.userId,
      updatedById: opts.userId,
    },
  });

  await recordStudioActivity({
    documentId: doc.id,
    companyId: source.companyId,
    kind: 'created',
    summary: `Documento duplicado de «${source.title}»`,
    actorUserId: opts.userId,
    meta: { duplicatedFrom: source.id },
  });

  return {
    ok: true,
    document: { id: doc.id, title: doc.title, folderId: doc.folderId },
  };
}
