import { prisma } from '@/lib/prisma';
import { prismaHasEnumValue } from '@/lib/prisma-has-field';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import { recordStudioActivity } from '@/lib/studio/activity';
import { canCreateStudioContent, getFolderAccess } from '@/lib/studio/share';
import { findSystemTemplate, resolveTemplateStudioLayer } from '@/lib/studio/templates';
import { templateHasDesignLayout } from '@/lib/studio/template-library/resolve-preview';
import {
  emptyStudioCanvas,
  isStudioFormat,
  isStudioPageSize,
  normalizeStudioCanvas,
  type StudioCanvasState,
  type StudioFormat,
  type StudioPageSize,
} from '@/lib/studio/types';

export type CreateStudioDocumentInput = {
  userId: string;
  companyId?: string | null;
  folderId?: string | null;
  title?: string;
  templateKey?: string;
  format?: StudioFormat | string | null;
  pageSize?: StudioPageSize | string | null;
  /** Prefer design shell when starting blank / custom size */
  studioMode?: 'write' | 'design' | null;
  canvasState?: StudioCanvasState | null;
  /** created | imported — para a trilha */
  activityKind?: 'created' | 'imported';
  activitySummary?: string;
  activityMeta?: Record<string, unknown>;
};

export type CreateStudioDocumentResult =
  | { ok: true; document: Awaited<ReturnType<typeof prisma.studioDocument.create>> }
  | { ok: false; status: number; error: string };

/** Cria documento Studio (template, canvas explícito ou vazio). */
export async function createStudioDocument(
  input: CreateStudioDocumentInput,
): Promise<CreateStudioDocumentResult> {
  const templateKey = (input.templateKey || '').trim();
  let resolvedTitle =
    (input.title || '').trim() ||
    (templateKey ? findSystemTemplate(templateKey)?.namePt : null) ||
    'Novo documento';
  const folderId = input.folderId || null;

  let resolvedCompanyId = await resolveStudioCompanyId(input.userId, input.companyId ?? null);

  if (folderId) {
    const folder = await prisma.studioFolder.findFirst({ where: { id: folderId } });
    if (!folder) return { ok: false, status: 404, error: 'Folder not found' };
    const access = await getFolderAccess(input.userId, folder);
    if (!canCreateStudioContent(access)) {
      return { ok: false, status: 403, error: 'Sem permissão para criar nesta pasta' };
    }
    resolvedCompanyId = folder.companyId;
  }

  if (!resolvedCompanyId) return { ok: false, status: 400, error: 'No company' };

  const tpl = templateKey ? findSystemTemplate(templateKey) : null;
  let canvas: StudioCanvasState;
  if (input.canvasState) {
    canvas = normalizeStudioCanvas(input.canvasState);
  } else if (tpl) {
    canvas = tpl.buildCanvas();
    if (!(input.title || '').trim()) resolvedTitle = tpl.namePt;
  } else if (templateKey && resolvedCompanyId) {
    try {
      const companyTpl = await prisma.studioTemplate.findFirst({
        where: { companyId: resolvedCompanyId, key: templateKey },
      });
      if (companyTpl?.canvasSeed) {
        canvas = normalizeStudioCanvas(companyTpl.canvasSeed);
        if (!(input.title || '').trim()) {
          resolvedTitle = companyTpl.namePt || companyTpl.nameEs || companyTpl.nameEn || resolvedTitle;
        }
      } else {
        canvas = emptyStudioCanvas(isStudioFormat(input.format) ? input.format : 'report');
      }
    } catch {
      canvas = emptyStudioCanvas(isStudioFormat(input.format) ? input.format : 'report');
    }
  } else {
    canvas = emptyStudioCanvas(isStudioFormat(input.format) ? input.format : 'report');
  }
  if (isStudioFormat(input.format)) canvas.format = input.format;
  else if (tpl) canvas.format = tpl.format;
  if (isStudioPageSize(input.pageSize)) {
    canvas.pageSize = input.pageSize;
    canvas.orientation = input.pageSize === 'Slide' ? 'landscape' : 'portrait';
    for (const p of canvas.pages) p.pageSize = input.pageSize;
    if (input.pageSize === 'Slide' && !isStudioFormat(input.format)) {
      canvas.format = 'presentation';
    }
  }
  if (input.studioMode === 'write' || input.studioMode === 'design') {
    canvas.studioMode = input.studioMode;
  } else if (tpl) {
    canvas.studioMode = resolveTemplateStudioLayer(tpl) === 'content' ? 'write' : 'design';
  } else if (!templateKey && !input.canvasState && isStudioPageSize(input.pageSize)) {
    canvas.studioMode = 'design';
  } else if (templateKey && templateHasDesignLayout(canvas)) {
    canvas.studioMode = 'design';
  }

  try {
    let aiSessionId: string | null = null;
    try {
      const kind = prismaHasEnumValue('AiAdvisorSessionKind', 'STUDIO_DOC')
        ? 'STUDIO_DOC'
        : 'WORKSPACE_ADVISOR';
      const sess = await prisma.aiAdvisorSession.create({
        data: {
          companyId: resolvedCompanyId,
          userId: input.userId,
          title: `Studio: ${resolvedTitle}`.slice(0, 120),
          kind: kind as 'STUDIO_DOC' | 'WORKSPACE_ADVISOR',
        },
      });
      aiSessionId = sess.id;
    } catch (e) {
      console.warn('[studio] ai session create skipped', e);
    }

    let doc;
    try {
      doc = await prisma.studioDocument.create({
        data: {
          companyId: resolvedCompanyId,
          folderId,
          title: resolvedTitle,
          format: canvas.format,
          visibility: 'private',
          canvasState: canvas,
          templateKey: templateKey || null,
          aiSessionId,
          createdById: input.userId,
          updatedById: input.userId,
        },
      });
    } catch (e) {
      // Coluna updatedById pode ainda não existir até ao SQL manual
      console.warn('[studio] create with updatedById failed, retrying', e);
      doc = await prisma.studioDocument.create({
        data: {
          companyId: resolvedCompanyId,
          folderId,
          title: resolvedTitle,
          format: canvas.format,
          visibility: 'private',
          canvasState: canvas,
          templateKey: templateKey || null,
          aiSessionId,
          createdById: input.userId,
        },
      });
    }

    await recordStudioActivity({
      documentId: doc.id,
      companyId: resolvedCompanyId,
      kind: input.activityKind || 'created',
      summary: input.activitySummary || `Documento criado: ${resolvedTitle}`,
      actorUserId: input.userId,
      meta: input.activityMeta || { templateKey: templateKey || null },
    });

    return { ok: true, document: doc };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[createStudioDocument]', e);
    return { ok: false, status: 503, error: msg };
  }
}
