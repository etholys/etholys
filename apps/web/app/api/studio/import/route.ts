import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { createStudioDocument } from '@/lib/studio/create-document';
import {
  fundhubProposalToStudioCanvas,
  meetSummaryToStudioCanvas,
  siepInformeToStudioCanvas,
} from '@/lib/studio/import-from';
import { loadInformeEditorState, legacyCanvasFromReport } from '@/lib/siep/informe-service';
import { createDocumentLink } from '@/lib/document-links';
import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';

export const dynamic = 'force-dynamic';

type ImportSource = 'siep_informe' | 'fundhub_proposal' | 'meet_session';

async function attachImportLinks(opts: {
  documentId: string;
  companyId: string;
  userId: string;
  links: Array<{
    systemKey: string;
    entityType: string;
    entityId: string;
    label?: string;
  }>;
}) {
  for (const link of opts.links) {
    try {
      await createDocumentLink({
        targetType: 'studio',
        companyId: opts.companyId,
        studioDocumentId: opts.documentId,
        userId: opts.userId,
        link,
      });
    } catch (e) {
      console.warn('[studio/import] link skip', e);
    }
  }
}

/**
 * POST /api/studio/import — one-shot bridge F3.
 * Cria um documento Studio privado a partir de SIEP / FUNDHUB / Meet e devolve o id.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const source = body.source as ImportSource;
  const companyId = typeof body.companyId === 'string' ? body.companyId : null;
  const folderId = typeof body.folderId === 'string' ? body.folderId : null;

  try {
    if (source === 'siep_informe') {
      const reportId = typeof body.reportId === 'string' ? body.reportId.trim() : '';
      if (!reportId) return NextResponse.json({ error: 'reportId obrigatório' }, { status: 400 });

      const tenant = await getUserCompanyIds();
      if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const loaded = await loadInformeEditorState(reportId, tenant.companyIds);
      if (!loaded) return NextResponse.json({ error: 'Informe não encontrado' }, { status: 404 });

      const canvas =
        (loaded.canvasState as ReportCanvasState | null) || legacyCanvasFromReport(loaded.report);
      const title = `Studio · ${loaded.report.title}`.slice(0, 180);
      const studioCanvas = siepInformeToStudioCanvas(loaded.report.title, canvas);

      const created = await createStudioDocument({
        userId: user.id,
        companyId: companyId || loaded.report.project.companyId,
        folderId,
        title,
        format: 'report',
        canvasState: studioCanvas,
        activityKind: 'imported',
        activitySummary: `Importado do informe SIEP «${loaded.report.title}»`,
        activityMeta: { source: 'siep_informe', reportId },
      });
      if (!created.ok) {
        return NextResponse.json({ error: created.error }, { status: created.status });
      }
      await attachImportLinks({
        documentId: created.document.id,
        companyId: created.document.companyId,
        userId: user.id,
        links: [
          {
            systemKey: 'SIEP',
            entityType: 'report',
            entityId: reportId,
            label: loaded.report.title,
          },
          {
            systemKey: 'SIEP',
            entityType: 'project',
            entityId: loaded.report.projectId,
            label: loaded.report.project?.name,
          },
        ].filter((l) => !!l.entityId),
      });
      return NextResponse.json({ document: { id: created.document.id, title: created.document.title } }, { status: 201 });
    }

    if (source === 'fundhub_proposal') {
      const titleRaw = typeof body.title === 'string' ? body.title.trim() : '';
      const sectionsRaw = Array.isArray(body.sections) ? body.sections : [];
      const sections = sectionsRaw
        .map((s) => {
          if (!s || typeof s !== 'object') return null;
          const o = s as Record<string, unknown>;
          return {
            title: typeof o.title === 'string' ? o.title : '',
            content: typeof o.content === 'string' ? o.content : '',
          };
        })
        .filter((s): s is { title: string; content: string } => !!s);

      if (!sections.length) {
        return NextResponse.json({ error: 'sections obrigatórias' }, { status: 400 });
      }

      const title = (titleRaw || 'Proposta FUNDHUB').slice(0, 180);
      const studioCanvas = fundhubProposalToStudioCanvas(title, sections);
      const created = await createStudioDocument({
        userId: user.id,
        companyId,
        folderId,
        title: `Studio · ${title}`.slice(0, 180),
        format: 'proposal',
        templateKey: 'funding-proposal-outline',
        canvasState: studioCanvas,
        activityKind: 'imported',
        activitySummary: `Importado da proposta FUNDHUB «${title}»`,
        activityMeta: { source: 'fundhub_proposal', sectionCount: sections.length },
      });
      if (!created.ok) {
        return NextResponse.json({ error: created.error }, { status: created.status });
      }
      const proposalId = typeof body.proposalId === 'string' ? body.proposalId.trim() : '';
      if (proposalId && created.document.companyId) {
        await attachImportLinks({
          documentId: created.document.id,
          companyId: created.document.companyId,
          userId: user.id,
          links: [
            {
              systemKey: 'FUNDHUB',
              entityType: 'proposal',
              entityId: proposalId,
              label: title,
            },
          ],
        });
      }
      return NextResponse.json({ document: { id: created.document.id, title: created.document.title } }, { status: 201 });
    }

    if (source === 'meet_session') {
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      if (!sessionId) return NextResponse.json({ error: 'sessionId obrigatório' }, { status: 400 });

      const tenant = await getUserCompanyIds();
      if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const cid = companyId && tenant.companyIds.includes(companyId) ? companyId : tenant.companyIds[0];
      if (!cid) return NextResponse.json({ error: 'No company' }, { status: 400 });

      const meet = await getMeetSessionForCompany(sessionId, cid);
      if (!meet) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });

      const notes = typeof body.notes === 'string' ? body.notes : null;
      const studioCanvas = meetSummaryToStudioCanvas({
        title: meet.title || 'Reunião',
        summaryText: meet.summaryText,
        notes,
        transcriptText: meet.transcriptText,
        actionItems: (meet.actionItems || []).map((a) => ({
          title: a.title,
          notes: a.notes,
          assigneeHint: a.assigneeHint,
        })),
      });

      const created = await createStudioDocument({
        userId: user.id,
        companyId: cid,
        folderId,
        title: `Studio · ${meet.title || 'Reunião'}`.slice(0, 180),
        format: 'brief',
        canvasState: studioCanvas,
        activityKind: 'imported',
        activitySummary: `Importado da reunião Meet «${meet.title || sessionId}»`,
        activityMeta: { source: 'meet_session', sessionId },
      });
      if (!created.ok) {
        return NextResponse.json({ error: created.error }, { status: created.status });
      }
      await attachImportLinks({
        documentId: created.document.id,
        companyId: created.document.companyId,
        userId: user.id,
        links: [
          {
            systemKey: 'MEET',
            entityType: 'meet_session',
            entityId: sessionId,
            label: meet.title || undefined,
          },
        ],
      });
      return NextResponse.json({ document: { id: created.document.id, title: created.document.title } }, { status: 201 });
    }

    return NextResponse.json(
      { error: 'source inválido (siep_informe | fundhub_proposal | meet_session)' },
      { status: 400 },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/studio/import]', e);
    return NextResponse.json({ error: 'Falha ao importar', detail: msg }, { status: 500 });
  }
}
