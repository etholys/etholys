export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  DEFAULT_WORK_COLUMNS,
  DEFAULT_WORK_NOTIFY,
  type WorkColumn,
  type WorkNotifyPrefs,
} from '@/components/work/work-ui';

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

function parseColumns(raw: unknown): WorkColumn[] {
  if (!Array.isArray(raw)) return [];
  return raw
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
    .slice(0, 24);
}

function parseNotify(raw: unknown): WorkNotifyPrefs {
  const notifyRaw = raw && typeof raw === 'object' ? (raw as WorkNotifyPrefs) : DEFAULT_WORK_NOTIFY;
  return {
    comment: notifyRaw.comment !== false,
    assign: notifyRaw.assign !== false,
    status: notifyRaw.status !== false,
    email: notifyRaw.email !== false,
  };
}

/** Garante colunas multi-papel visíveis em layouts antigos (sem apagar customizações). */
function ensureRoleColumns(columns: WorkColumn[]): WorkColumn[] {
  const out = [...columns];
  const afterPerson = Math.max(0, out.findIndex((c) => c.kind === 'person')) + 1 || 1;
  if (!out.some((c) => c.kind === 'responsible')) {
    out.splice(afterPerson, 0, {
      id: 'responsible',
      kind: 'responsible',
      label: 'Responsável',
    });
  }
  const afterResponsible = Math.max(
    afterPerson,
    out.findIndex((c) => c.kind === 'responsible') + 1,
  );
  if (!out.some((c) => c.kind === 'reviewer')) {
    out.splice(afterResponsible, 0, {
      id: 'reviewer',
      kind: 'reviewer',
      label: 'Supervisor',
    });
  }
  return out;
}

function parseLayout(raw: unknown): { columns: WorkColumn[]; notify: WorkNotifyPrefs } {
  const body = raw && typeof raw === 'object' ? (raw as { columns?: unknown; notify?: unknown }) : {};
  const columns = parseColumns(body.columns);
  return {
    columns: ensureRoleColumns(columns.length ? columns : DEFAULT_WORK_COLUMNS),
    notify: parseNotify(body.notify),
  };
}

function normalizeScopeKey(raw: string, userId: string) {
  const key = String(raw || '').trim().slice(0, 120);
  if (!key) return `mine:${userId}`;
  if (key.startsWith('mine:')) return `mine:${userId}`;
  return key;
}

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const url = new URL(req.url);
    const companyId = url.searchParams.get('companyId') || '';
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }
    const scopeKey = normalizeScopeKey(url.searchParams.get('scopeKey') || '', tenant.userId);

    const [row, company] = await Promise.all([
      prisma.workBoardLayout.findUnique({
        where: { companyId_scopeKey: { companyId, scopeKey } },
        select: { layoutJson: true },
      }),
      prisma.company.findUnique({
        where: { id: companyId },
        select: { workBoardJson: true },
      }),
    ]);

    // Notify fica ao nível da empresa (canais). Colunas são por área.
    const companyBoard = parseLayout(company?.workBoardJson);
    if (row?.layoutJson) {
      const layout = parseLayout(row.layoutJson);
      return NextResponse.json({
        columns: layout.columns,
        notify: companyBoard.notify,
        scopeKey,
        hasCustom: true,
      });
    }

    return NextResponse.json({
      columns: DEFAULT_WORK_COLUMNS,
      notify: companyBoard.notify,
      scopeKey,
      hasCustom: false,
    });
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
    const scopeKey = normalizeScopeKey(String(body.scopeKey || ''), tenant.userId);
    const columns = parseColumns(body.columns);
    const nextColumns = columns.length ? columns : DEFAULT_WORK_COLUMNS;

    // Preferências de notificação (canais) continuam na empresa.
    if (body.notify && typeof body.notify === 'object') {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { workBoardJson: true },
      });
      const prev = parseLayout(company?.workBoardJson);
      await prisma.company.update({
        where: { id: companyId },
        data: {
          workBoardJson: {
            columns: prev.columns,
            notify: parseNotify(body.notify),
          },
        },
      });
    }

    const layoutJson = { columns: nextColumns };
    await prisma.workBoardLayout.upsert({
      where: { companyId_scopeKey: { companyId, scopeKey } },
      create: { companyId, scopeKey, layoutJson },
      update: { layoutJson },
    });

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { workBoardJson: true },
    });
    return NextResponse.json({
      columns: nextColumns,
      notify: parseLayout(company?.workBoardJson).notify,
      scopeKey,
      hasCustom: true,
    });
  } catch (error: unknown) {
    console.error('Work board PUT error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
