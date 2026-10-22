export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { DEFAULT_WORK_COLUMNS, DEFAULT_WORK_NOTIFY, type WorkColumn, type WorkNotifyPrefs } from '@/components/work/work-ui';

const KINDS = new Set([
  'status',
  'person',
  'priority',
  'due',
  'start',
  'estimate',
  'origin',
  'updates',
  'files',
  'tags',
  'group',
  'responsible',
  'reviewer',
  'text',
  'number',
  'checkbox',
  'date',
]);

function parseBoard(raw: unknown): { columns: WorkColumn[]; notify: WorkNotifyPrefs } {
  const body = raw && typeof raw === 'object' ? (raw as { columns?: unknown; notify?: unknown }) : {};
  const columns = Array.isArray(body.columns)
    ? body.columns
        .map((col) => {
          if (!col || typeof col !== 'object') return null;
          const row = col as { id?: unknown; kind?: unknown; label?: unknown };
          const kind = String(row.kind || '');
          const id = String(row.id || '').trim();
          const label = String(row.label || '').trim();
          if (!id || !KINDS.has(kind) || !label) return null;
          return { id, kind, label } as WorkColumn;
        })
        .filter((col): col is WorkColumn => Boolean(col))
        .slice(0, 24)
    : [];
  const notifyRaw = body.notify && typeof body.notify === 'object' ? (body.notify as WorkNotifyPrefs) : DEFAULT_WORK_NOTIFY;
  return {
    columns: columns.length ? columns : DEFAULT_WORK_COLUMNS,
    notify: {
      comment: notifyRaw.comment !== false,
      assign: notifyRaw.assign !== false,
      status: notifyRaw.status !== false,
      email: notifyRaw.email !== false,
    },
  };
}

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const companyId = new URL(req.url).searchParams.get('companyId') || '';
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { workBoardJson: true },
    });
    return NextResponse.json(parseBoard(company?.workBoardJson));
  } catch (error: unknown) {
    console.error('Work board GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const companyId = String(body.companyId || '');
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }
    const board = parseBoard(body);
    await prisma.company.update({
      where: { id: companyId },
      data: { workBoardJson: board },
    });
    return NextResponse.json(board);
  } catch (error: unknown) {
    console.error('Work board PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
