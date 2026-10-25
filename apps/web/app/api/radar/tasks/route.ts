export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { AGRICULTURE_MODULE } from '@/lib/nexus-sector-modules';
import { buildAgricultureBoard, isRadarParcel } from '@/lib/radar/agriculture';
import {
  isRadarTaskSeverity,
  isRadarTaskStatus,
  parseProgressJson,
  type RadarTaskProgressNote,
  type RadarTaskSeverity,
  type RadarTaskStatus,
} from '@/lib/radar/tasks';
import { RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';

const SENSOR_METRICS = AGRICULTURE_MODULE.metrics.map((m) => m.id);

type TaskOut = {
  id: string;
  title: string;
  description: string | null;
  status: RadarTaskStatus;
  severity: RadarTaskSeverity;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitName: string | null;
  sourceKey: string | null;
  dueAt: string | null;
  progress: RadarTaskProgressNote[];
  href: string;
  persisted: boolean;
  updatedAt: string;
};

async function authorize(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return { error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
  }
  return { tenant };
}

function actionCopy(
  code: string,
  parcelName: string,
): { title: { pt: string; es: string; en: string }; description: { pt: string; es: string; en: string } } {
  if (code === 'irrigate') {
    return {
      title: {
        pt: `Irrigar — ${parcelName}`,
        es: `Regar — ${parcelName}`,
        en: `Irrigate — ${parcelName}`,
      },
      description: {
        pt: 'Humidade baixa neste espaço. Regista a irrigação no Caderno ou na ficha do espaço.',
        es: 'Humedad baja en este espacio. Registrá el riego en el Cuaderno o en la ficha del espacio.',
        en: 'Low moisture on this space. Log irrigation in the Notebook or space file.',
      },
    };
  }
  if (code === 'hold_harvest') {
    return {
      title: {
        pt: `Não colher — ${parcelName}`,
        es: `No cosechar — ${parcelName}`,
        en: `Hold harvest — ${parcelName}`,
      },
      description: {
        pt: 'Carência (PHI) activa. Espera o prazo antes de colher.',
        es: 'Carencia (PHI) activa. Esperá el plazo antes de cosechar.',
        en: 'PHI active. Wait out the interval before harvesting.',
      },
    };
  }
  if (code === 'scout') {
    return {
      title: {
        pt: `Percorrer — ${parcelName}`,
        es: `Recorrer — ${parcelName}`,
        en: `Scout — ${parcelName}`,
      },
      description: {
        pt: 'Caderno parado neste espaço. Faz uma visita e anota o que viste.',
        es: 'Cuaderno parado en este espacio. Hacé una visita y anotá lo que viste.',
        en: 'Notebook idle on this space. Walk it and log what you saw.',
      },
    };
  }
  if (code === 'await_signal') {
    return {
      title: {
        pt: `À espera de sinal — ${parcelName}`,
        es: `A la espera de señal — ${parcelName}`,
        en: `Awaiting signal — ${parcelName}`,
      },
      description: {
        pt: 'Sem leitura recente. Confirma o sensor ou regista humidade manualmente.',
        es: 'Sin lectura reciente. Confirmá el sensor o registrá humedad manualmente.',
        en: 'No recent reading. Check the sensor or log moisture manually.',
      },
    };
  }
  return {
    title: {
      pt: `Atenção — ${parcelName}`,
      es: `Atención — ${parcelName}`,
      en: `Attention — ${parcelName}`,
    },
    description: {
      pt: 'Abre a ficha do espaço e segue a prioridade do RADAR.',
      es: 'Abrí la ficha del espacio y seguí la prioridad del RADAR.',
      en: 'Open the space file and follow RADAR’s priority.',
    },
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  const clientParam = String(url.searchParams.get('clientId') || '').trim();
  const unitFilter = String(url.searchParams.get('unitId') || '').trim();
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const propertyWhere =
    !clientParam || clientParam === 'all' || clientParam === 'todos'
      ? { companyId, archivedAt: null }
      : clientParam === 'own' || clientParam === 'mine' || clientParam === 'minha' || clientParam === RADAR_SCOPE_OWN
        ? { companyId, clientId: null as string | null, archivedAt: null }
        : { companyId, clientId: clientParam, archivedAt: null };

  const properties = await prisma.radarProperty.findMany({
    where: propertyWhere,
    orderBy: { updatedAt: 'desc' },
    take: 80,
    include: {
      units: {
        where: { isActive: true },
        select: { id: true, name: true, kind: true, crop: true, areaHa: true },
      },
    },
  });

  const unitIds = properties.flatMap((p) => p.units.map((u) => u.id));
  const unitMeta = new Map<string, { name: string; propertyId: string; propertyName: string }>();
  const unitsForFilter: Array<{ id: string; name: string; propertyId: string; propertyName: string }> = [];
  for (const p of properties) {
    for (const u of p.units) {
      unitMeta.set(u.id, { name: u.name, propertyId: p.id, propertyName: p.name });
      unitsForFilter.push({ id: u.id, name: u.name, propertyId: p.id, propertyName: p.name });
    }
  }

  const [entries, readings, saved] = await Promise.all([
    unitIds.length
      ? prisma.nexusFieldEntry.findMany({
          where: { companyId, unitId: { in: unitIds } },
          orderBy: { occurredAt: 'desc' },
          take: 400,
        })
      : Promise.resolve([]),
    unitIds.length
      ? prisma.nexusReading.findMany({
          where: { companyId, metric: { in: SENSOR_METRICS }, unitId: { in: unitIds } },
          orderBy: { recordedAt: 'desc' },
          take: 400,
        })
      : Promise.resolve([]),
    prisma.radarTask.findMany({
      where: { companyId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
  ]);

  const qsBase = `company=${encodeURIComponent(companyId)}${engagementId ? `&engagement=${encodeURIComponent(engagementId)}` : ''}`;
  const now = new Date();
  const activeSaved = saved.filter((t) => !t.archivedAt);
  const suppressedSources = new Set(
    saved.filter((t) => t.archivedAt && t.sourceKey).map((t) => t.sourceKey as string),
  );
  const bySource = new Map(activeSaved.filter((t) => t.sourceKey).map((t) => [t.sourceKey as string, t]));
  const usedIds = new Set<string>();
  const tasks: TaskOut[] = [];

  for (const prop of properties) {
    const parcels = prop.units.filter(isRadarParcel);
    const parcelIds = new Set(parcels.map((u) => u.id));
    const board = buildAgricultureBoard({
      now,
      units: parcels,
      entries: entries
        .filter((e) => e.unitId && parcelIds.has(e.unitId))
        .map((e) => ({
          unitId: e.unitId,
          kind: e.kind,
          occurredAt: e.occurredAt,
          payloadJson: e.payloadJson,
        })),
      readings: readings
        .filter((r) => r.unitId && parcelIds.has(r.unitId))
        .map((r) => ({
          unitId: r.unitId,
          metric: r.metric,
          value: r.value,
          recordedAt: r.recordedAt,
          source: r.source,
        })),
    });

    for (const parcel of board.parcels) {
      if (parcel.nextAction === 'ok') continue;
      const sourceKey = `${prop.id}:${parcel.nextAction}:${parcel.id}`;
      if (suppressedSources.has(sourceKey)) continue;
      const copy = actionCopy(parcel.nextAction, parcel.name);
      const existing = bySource.get(sourceKey);
      const severity: RadarTaskSeverity =
        parcel.nextAction === 'hold_harvest' || parcel.nextAction === 'irrigate' ? 'critical' : 'warning';
      if (existing) {
        usedIds.add(existing.id);
        tasks.push({
          id: existing.id,
          title: existing.title,
          description: existing.description,
          status: isRadarTaskStatus(existing.status) ? existing.status : 'todo',
          severity: isRadarTaskSeverity(existing.severity) ? existing.severity : severity,
          propertyId: existing.propertyId,
          propertyName: prop.name,
          unitId: existing.unitId,
          unitName: parcel.name,
          sourceKey,
          dueAt: existing.dueAt?.toISOString() || null,
          progress: parseProgressJson(existing.progressJson),
          href: `/hub/radar/properties/${prop.id}?${qsBase}&unit=${parcel.id}`,
          persisted: true,
          updatedAt: existing.updatedAt.toISOString(),
        });
      } else {
        tasks.push({
          id: `virt:${sourceKey}`,
          title: copy.title.pt,
          description: copy.description.pt,
          status: 'todo',
          severity,
          propertyId: prop.id,
          propertyName: prop.name,
          unitId: parcel.id,
          unitName: parcel.name,
          sourceKey,
          dueAt: null,
          progress: [],
          href: `/hub/radar/properties/${prop.id}?${qsBase}&unit=${parcel.id}`,
          persisted: false,
          updatedAt: now.toISOString(),
        });
      }
    }
  }

  for (const row of activeSaved) {
    if (usedIds.has(row.id)) continue;
    if (row.sourceKey && bySource.has(row.sourceKey) && tasks.some((t) => t.sourceKey === row.sourceKey)) continue;
    const um = row.unitId ? unitMeta.get(row.unitId) : null;
    const prop = row.propertyId ? properties.find((p) => p.id === row.propertyId) : null;
    tasks.push({
      id: row.id,
      title: row.title,
      description: row.description,
      status: isRadarTaskStatus(row.status) ? row.status : 'todo',
      severity: isRadarTaskSeverity(row.severity) ? row.severity : 'info',
      propertyId: row.propertyId,
      propertyName: prop?.name || um?.propertyName || null,
      unitId: row.unitId,
      unitName: um?.name || null,
      sourceKey: row.sourceKey,
      dueAt: row.dueAt?.toISOString() || null,
      progress: parseProgressJson(row.progressJson),
      href: row.propertyId
        ? `/hub/radar/properties/${row.propertyId}?${qsBase}${row.unitId ? `&unit=${row.unitId}` : ''}`
        : `/hub/radar?${qsBase}`,
      persisted: true,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  const filtered =
    unitFilter && unitFilter !== 'all' && unitFilter !== 'todas'
      ? tasks.filter((t) => t.unitId === unitFilter)
      : tasks;

  const rank: Record<RadarTaskStatus, number> = { todo: 0, doing: 1, done: 2 };
  const sev: Record<RadarTaskSeverity, number> = { critical: 0, warning: 1, info: 2 };
  filtered.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      sev[a.severity] - sev[b.severity] ||
      a.title.localeCompare(b.title),
  );

  return NextResponse.json({
    companyId,
    unitId: unitFilter || 'all',
    units: unitsForFilter,
    count: filtered.length,
    tasks: filtered.slice(0, 80),
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  const engagementId = String(body.engagementId || '').trim() || null;
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const title = String(body.title || '').trim();
  if (title.length < 2) return NextResponse.json({ error: 'Título obrigatório.' }, { status: 400 });

  let propertyId = String(body.propertyId || '').trim() || null;
  let unitId = String(body.unitId || '').trim() || null;
  if (unitId) {
    const unit = await prisma.nexusOpsUnit.findFirst({
      where: { id: unitId, companyId, isActive: true },
      select: { id: true, propertyId: true, name: true },
    });
    if (!unit) return NextResponse.json({ error: 'Espaço inválido.' }, { status: 400 });
    unitId = unit.id;
    propertyId = propertyId || unit.propertyId;
  }
  if (propertyId) {
    const prop = await prisma.radarProperty.findFirst({ where: { id: propertyId, companyId } });
    if (!prop) return NextResponse.json({ error: 'Propriedade inválida.' }, { status: 400 });
  }

  const sourceKey = String(body.sourceKey || '').trim() || null;
  const status = isRadarTaskStatus(body.status) ? body.status : 'todo';
  const severity = isRadarTaskSeverity(body.severity) ? body.severity : 'info';
  const description = String(body.description || '').trim().slice(0, 4000) || null;

  if (sourceKey) {
    const existing = await prisma.radarTask.findFirst({
      where: { companyId, sourceKey },
    });
    if (existing) {
      const updated = await prisma.radarTask.update({
        where: { id: existing.id },
        data: {
          title: title.slice(0, 200),
          description,
          status,
          severity,
          propertyId,
          unitId,
          archivedAt: null,
        },
      });
      return NextResponse.json({ ok: true, task: serialize(updated) });
    }
  }

  const created = await prisma.radarTask.create({
    data: {
      companyId,
      propertyId,
      unitId,
      title: title.slice(0, 200),
      description,
      status,
      severity,
      sourceKey,
      progressJson: [],
    },
  });
  return NextResponse.json({ ok: true, task: serialize(created) });
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }
  const companyId = String(body.companyId || '').trim();
  const engagementId = String(body.engagementId || '').trim() || null;
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const action = String(body.action || 'update').trim();
  let taskId = String(body.taskId || body.id || '').trim();
  const sourceKey = String(body.sourceKey || '').trim() || null;

  // Materialize virtual alert task on first write
  if ((!taskId || taskId.startsWith('virt:')) && sourceKey) {
    const title = String(body.title || '').trim() || 'Tarefa RADAR';
    const description = String(body.description || '').trim().slice(0, 4000) || null;
    const propertyId = String(body.propertyId || '').trim() || null;
    const unitId = String(body.unitId || '').trim() || null;
    const severity = isRadarTaskSeverity(body.severity) ? body.severity : 'info';
    const created = await prisma.radarTask.upsert({
      where: { companyId_sourceKey: { companyId, sourceKey } },
      create: {
        companyId,
        propertyId,
        unitId,
        title: title.slice(0, 200),
        description,
        status: 'todo',
        severity,
        sourceKey,
        progressJson: [],
      },
      update: { archivedAt: null },
    });
    taskId = created.id;
  }

  if (!taskId || taskId.startsWith('virt:')) {
    return NextResponse.json({ error: 'taskId obrigatório.' }, { status: 400 });
  }

  const task = await prisma.radarTask.findFirst({ where: { id: taskId, companyId } });
  if (!task) return NextResponse.json({ error: 'Tarefa inválida.' }, { status: 404 });

  if (action === 'archive' || action === 'delete') {
    const updated = await prisma.radarTask.update({
      where: { id: task.id },
      data: { archivedAt: new Date(), status: 'done' },
    });
    return NextResponse.json({ ok: true, task: serialize(updated) });
  }

  if (action === 'progress') {
    const note = String(body.note || '').trim();
    if (note.length < 2) return NextResponse.json({ error: 'Nota de avanço obrigatória.' }, { status: 400 });
    const progress = parseProgressJson(task.progressJson);
    progress.push({
      id: `p_${Date.now().toString(36)}`,
      at: new Date().toISOString(),
      note: note.slice(0, 2000),
    });
    const nextStatus = task.status === 'todo' ? 'doing' : task.status;
    const updated = await prisma.radarTask.update({
      where: { id: task.id },
      data: {
        progressJson: progress,
        status: isRadarTaskStatus(body.status) ? body.status : nextStatus,
      },
    });
    return NextResponse.json({ ok: true, task: serialize(updated) });
  }

  const data: {
    title?: string;
    description?: string | null;
    status?: string;
    severity?: string;
    propertyId?: string | null;
    unitId?: string | null;
    dueAt?: Date | null;
  } = {};
  if (body.title != null) {
    const t = String(body.title).trim();
    if (t.length >= 2) data.title = t.slice(0, 200);
  }
  if (body.description !== undefined) {
    data.description = String(body.description || '').trim().slice(0, 4000) || null;
  }
  if (isRadarTaskStatus(body.status)) data.status = body.status;
  if (isRadarTaskSeverity(body.severity)) data.severity = body.severity;
  if (body.unitId !== undefined) {
    const uid = String(body.unitId || '').trim() || null;
    if (uid) {
      const unit = await prisma.nexusOpsUnit.findFirst({
        where: { id: uid, companyId, isActive: true },
        select: { id: true, propertyId: true },
      });
      if (!unit) return NextResponse.json({ error: 'Espaço inválido.' }, { status: 400 });
      data.unitId = unit.id;
      data.propertyId = unit.propertyId;
    } else {
      data.unitId = null;
    }
  }
  if (body.dueAt !== undefined) {
    if (body.dueAt == null || body.dueAt === '') data.dueAt = null;
    else {
      const d = new Date(String(body.dueAt));
      data.dueAt = Number.isFinite(d.getTime()) ? d : null;
    }
  }

  const updated = await prisma.radarTask.update({ where: { id: task.id }, data });
  return NextResponse.json({ ok: true, task: serialize(updated) });
}

function serialize(row: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  propertyId: string | null;
  unitId: string | null;
  sourceKey: string | null;
  dueAt: Date | null;
  progressJson: unknown;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: isRadarTaskStatus(row.status) ? row.status : 'todo',
    severity: isRadarTaskSeverity(row.severity) ? row.severity : 'info',
    propertyId: row.propertyId,
    unitId: row.unitId,
    sourceKey: row.sourceKey,
    dueAt: row.dueAt?.toISOString() || null,
    progress: parseProgressJson(row.progressJson),
    updatedAt: row.updatedAt.toISOString(),
    persisted: true,
  };
}
