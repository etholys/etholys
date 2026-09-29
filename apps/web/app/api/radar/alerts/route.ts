export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { AGRICULTURE_MODULE } from '@/lib/nexus-sector-modules';
import { buildAgricultureBoard, isRadarParcel } from '@/lib/radar/agriculture';
import { whatsappConfigured } from '@/lib/nexus-whatsapp';
import { RADAR_CLIENT_ALL } from '@/lib/radar/client-scope';

const SENSOR_METRICS = AGRICULTURE_MODULE.metrics.map((m) => m.id);
const STALE_LOT_MS = 7 * 24 * 60 * 60 * 1000;

type AlertCard = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  code: string;
  message: { es: string; pt: string; en: string };
  clientId: string | null;
  clientName: string | null;
  propertyId: string | null;
  propertyName: string | null;
  href: string;
};

async function authorize(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return { error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
  }
  return { tenant };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  const clientParam = String(url.searchParams.get('clientId') || '').trim();
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: { radarOrgRole: true },
  });
  const isProvider = company?.radarOrgRole === 'provider';

  const propertyWhere =
    isProvider && clientParam && clientParam !== RADAR_CLIENT_ALL && clientParam !== 'todos'
      ? { companyId, clientId: clientParam }
      : isProvider
        ? { companyId, clientId: { not: null } as const }
        : { companyId, clientId: null as string | null };

  const properties = await prisma.radarProperty.findMany({
    where: propertyWhere,
    orderBy: { updatedAt: 'desc' },
    take: 80,
    include: {
      client: { select: { id: true, name: true } },
      units: { where: { isActive: true }, select: { id: true, name: true, kind: true, crop: true, areaHa: true } },
    },
  });

  const unitIds = properties.flatMap((p) => p.units.map((u) => u.id));
  const unitToProperty = new Map<string, { propertyId: string; propertyName: string; clientId: string | null; clientName: string | null }>();
  for (const p of properties) {
    for (const u of p.units) {
      unitToProperty.set(u.id, {
        propertyId: p.id,
        propertyName: p.name,
        clientId: p.clientId,
        clientName: p.client?.name || null,
      });
    }
  }

  const [entries, readings, sensors, whatsapp, openLots] = await Promise.all([
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
    prisma.nexusSensor.findMany({
      where: { companyId, isActive: true },
      select: { id: true, unitId: true, name: true, lastSeenAt: true },
      take: 80,
    }),
    prisma.nexusWhatsappLink.findFirst({
      where: { companyId },
      select: { phoneE164: true, alertsEnabled: true, lastInboundAt: true },
    }),
    prisma.radarLot.findMany({
      where: { companyId, status: 'open' },
      orderBy: { updatedAt: 'desc' },
      take: 40,
      include: {
        events: { orderBy: { occurredAt: 'desc' }, take: 1 },
        unit: { select: { id: true, propertyId: true } },
      },
    }),
  ]);

  const now = new Date();
  const alerts: AlertCard[] = [];
  const qsBase = `company=${encodeURIComponent(companyId)}${engagementId ? `&engagement=${encodeURIComponent(engagementId)}` : ''}`;

  // Per-property agriculture alerts
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

    for (const a of board.alerts) {
      if (a.code === 'no_parcels' && parcels.length === 0) continue;
      alerts.push({
        id: `${prop.id}:${a.code}`,
        severity: a.severity,
        code: a.code,
        message: a.message,
        clientId: prop.clientId,
        clientName: prop.client?.name || null,
        propertyId: prop.id,
        propertyName: prop.name,
        href: `/hub/radar/properties/${prop.id}?${qsBase}`,
      });
    }

    // Missing sensors when characterized as agriculture
    if (prop.moduleId === 'agriculture' || parcels.length > 0) {
      const propSensors = sensors.filter((s) => !s.unitId || parcelIds.has(s.unitId));
      if (parcels.length > 0 && propSensors.length === 0) {
        alerts.push({
          id: `${prop.id}:missing_sensors`,
          severity: 'warning',
          code: 'missing_sensors',
          message: {
            es: 'Sin sensores activos — conectá un token nxsens_ o registrá humedad por WhatsApp.',
            pt: 'Sem sensores ativos — liga um token nxsens_ ou regista humidade por WhatsApp.',
            en: 'No active sensors — connect an nxsens_ token or log moisture via WhatsApp.',
          },
          clientId: prop.clientId,
          clientName: prop.client?.name || null,
          propertyId: prop.id,
          propertyName: prop.name,
          href: `/hub/radar/properties/${prop.id}?${qsBase}`,
        });
      }
    }

    // Funnel incomplete
    if (!prop.moduleId || !prop.lat || !prop.layoutJson) {
      alerts.push({
        id: `${prop.id}:funnel_incomplete`,
        severity: 'info',
        code: 'funnel_incomplete',
        message: {
          es: 'Embudo incompleto — caracterizar, planta o geo pendientes.',
          pt: 'Funil incompleto — caracterizar, planta ou geo por concluir.',
          en: 'Funnel incomplete — characterize, plant or geo still pending.',
        },
        clientId: prop.clientId,
        clientName: prop.client?.name || null,
        propertyId: prop.id,
        propertyName: prop.name,
        href: `/hub/radar/properties/${prop.id}?${qsBase}`,
      });
    }
  }

  // Open lots without recent check-in
  for (const lot of openLots) {
    const last = lot.events[0];
    const lastAt = last?.occurredAt?.getTime() ?? lot.updatedAt.getTime();
    if (now.getTime() - lastAt < STALE_LOT_MS) continue;
    const meta = lot.unitId ? unitToProperty.get(lot.unitId) : null;
    const propertyId = meta?.propertyId || lot.unit?.propertyId || null;
    if (isProvider && clientParam && clientParam !== RADAR_CLIENT_ALL) {
      if (!meta || meta.clientId !== clientParam) continue;
    }
    alerts.push({
      id: `lot:${lot.id}:stale_checkin`,
      severity: 'warning',
      code: 'stale_lot_checkin',
      message: {
        es: `Lote ${lot.code} sin check-in reciente (etapa ${lot.currentStage}).`,
        pt: `Lote ${lot.code} sem check-in recente (etapa ${lot.currentStage}).`,
        en: `Lot ${lot.code} without recent check-in (stage ${lot.currentStage}).`,
      },
      clientId: meta?.clientId || null,
      clientName: meta?.clientName || null,
      propertyId,
      propertyName: meta?.propertyName || null,
      href: propertyId ? `/hub/radar/properties/${propertyId}?${qsBase}` : `/hub/radar/provider?${qsBase}`,
    });
  }

  // WhatsApp channel
  if (!whatsappConfigured()) {
    alerts.push({
      id: 'wa:not_configured',
      severity: 'info',
      code: 'whatsapp_unconfigured',
      message: {
        es: 'Canal WhatsApp no configurado en el servidor.',
        pt: 'Canal WhatsApp não configurado no servidor.',
        en: 'WhatsApp channel not configured on the server.',
      },
      clientId: null,
      clientName: null,
      propertyId: null,
      propertyName: null,
      href: `/hub/radar/provider?${qsBase}`,
    });
  } else if (!whatsapp) {
    alerts.push({
      id: 'wa:unlinked',
      severity: 'warning',
      code: 'whatsapp_unlinked',
      message: {
        es: 'Ningún teléfono vinculado — el campo no puede escribir al Hub.',
        pt: 'Nenhum telefone vinculado — o campo não consegue escrever no Hub.',
        en: 'No phone linked — the field cannot write to the Hub.',
      },
      clientId: null,
      clientName: null,
      propertyId: null,
      propertyName: null,
      href: isProvider ? `/hub/radar/provider?${qsBase}` : `/hub/radar/producer?${qsBase}`,
    });
  }

  // Empty portfolio nudge
  if (properties.length === 0) {
    alerts.push({
      id: 'portfolio:empty',
      severity: 'warning',
      code: 'empty_portfolio',
      message: {
        es: isProvider
          ? 'Sin propiedades en este ámbito — registrá un cliente y una finca.'
          : 'Sin propiedades — registrá la primera finca para abrir el Radar.',
        pt: isProvider
          ? 'Sem propriedades neste âmbito — cadastra um cliente e uma fazenda.'
          : 'Sem propriedades — cadastra a primeira fazenda para abrir o Radar.',
        en: isProvider
          ? 'No properties in this scope — register a client and a farm.'
          : 'No properties — register the first farm to open Radar.',
      },
      clientId: clientParam && clientParam !== RADAR_CLIENT_ALL ? clientParam : null,
      clientName: null,
      propertyId: null,
      propertyName: null,
      href: isProvider ? `/hub/radar/provider?${qsBase}` : `/hub/radar/producer?${qsBase}`,
    });
  }

  const rank = { critical: 3, warning: 2, info: 1 };
  alerts.sort((a, b) => rank[b.severity] - rank[a.severity] || a.propertyName?.localeCompare(b.propertyName || '') || 0);

  return NextResponse.json({
    companyId,
    clientId: clientParam || RADAR_CLIENT_ALL,
    role: company?.radarOrgRole || null,
    count: alerts.length,
    alerts: alerts.slice(0, 60),
  });
}
