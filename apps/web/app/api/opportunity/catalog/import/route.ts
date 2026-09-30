export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import {
  annotateImportAgainstCatalog,
  isImportDuplicate,
  matrixToImportText,
  parseFunderImportText,
  type FunderImportRow,
} from '@/lib/opportunity/funder-import';
import { sanitizeFundingLinks } from '@/lib/opportunity/official-url';
import {
  fundColumnDataFromMeta,
  parseFundHubMeta,
  writeFundHubMeta,
} from '@/lib/opportunity/pipeline';

async function textFromUpload(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.ods')) {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];
    return matrixToImportText(matrix);
  }
  return await file.text();
}

async function loadCatalogRefs(companyId: string) {
  return prisma.fund.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true, institution: true, linkOficial: true },
    take: 500,
  });
}

/** Preview: cola CSV/planilha → linhas editáveis. Confirm: grava no catálogo. */
export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const contentType = req.headers.get('content-type') || '';
  let text = '';
  let confirm = false;
  let rows: FunderImportRow[] = [];

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    confirm = String(form.get('confirm') || '') === 'true';
    const rowsRaw = form.get('rows');
    if (typeof rowsRaw === 'string' && rowsRaw.trim()) {
      rows = JSON.parse(rowsRaw) as FunderImportRow[];
    }
    const file = form.get('file');
    if (file instanceof File && file.size > 0) {
      text = await textFromUpload(file);
    } else {
      text = String(form.get('text') || '');
    }
  } else {
    const body = (await req.json()) as {
      text?: string;
      confirm?: boolean;
      rows?: FunderImportRow[];
    };
    text = String(body.text ?? '');
    confirm = Boolean(body.confirm);
    rows = Array.isArray(body.rows) ? body.rows : [];
  }

  const catalog = await loadCatalogRefs(ctx.companyId);

  if (!confirm) {
    const previewRows = annotateImportAgainstCatalog(parseFunderImportText(text), catalog);
    return NextResponse.json({
      preview: true,
      rows: previewRows,
      okCount: previewRows.filter((r) => r.ok && !isImportDuplicate(r)).length,
      issueCount: previewRows.filter((r) => !r.ok).length,
      duplicateCount: previewRows.filter((r) => isImportDuplicate(r)).length,
    });
  }

  const annotated = annotateImportAgainstCatalog(rows, catalog);
  const created: string[] = [];
  const skipped: string[] = [];
  const duplicates: string[] = [];

  for (const row of annotated) {
    const name = String(row.name ?? '').trim();
    const institution = String(row.institution ?? name).trim();
    if (!name || !institution) {
      skipped.push(name || `(row ${row.rowIndex})`);
      continue;
    }
    if (isImportDuplicate(row)) {
      duplicates.push(name);
      continue;
    }
    const links = sanitizeFundingLinks(row.linkOficial, row.linkOficial);
    const notes = writeFundHubMeta(row.notes ?? '', {
      pipelineStatus: 'decide',
      origin: { savedAt: new Date().toISOString() },
    });
    const cols = fundColumnDataFromMeta(parseFundHubMeta(notes));
    const fund = await prisma.fund.create({
      data: {
        companyId: ctx.companyId,
        name: name.slice(0, 300),
        institution: institution.slice(0, 200),
        linkOficial: links.linkOficial || null,
        type: String(row.type || 'Grant').slice(0, 40),
        notes,
        pipelineStatus: cols.pipelineStatus,
        ownerUserId: cols.ownerUserId,
        watchOpen: cols.watchOpen,
        fundHubMetaJson: cols.fundHubMetaJson,
        status: 'reference',
        isActive: true,
      },
    });
    created.push(fund.id);
  }

  return NextResponse.json({
    confirmed: true,
    count: created.length,
    created,
    skipped,
    duplicates,
  });
}
