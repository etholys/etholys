import { prisma } from '@/lib/prisma';
import { AGRICULTURE_MODULE } from '@/lib/nexus-sector-modules';
import { buildAgricultureBoard, isRadarParcel } from '@/lib/radar/agriculture';
import { RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';
import { parseRadarLayout } from '@/lib/radar/site-layout';
import {
  buildPropertyProgress,
  isGeolocated,
  isPlantDrawn,
} from '@/lib/radar/property-progress';
import {
  SECTOR_AGENT_LABEL,
  sectorAgentFromModuleId,
} from '@/lib/radar/assistant/sector-agents';
import type {
  RadarAssistantContextSnapshot,
  RadarSetupGap,
} from '@/lib/radar/assistant/types';

const SENSOR_METRICS = AGRICULTURE_MODULE.metrics.map((m) => m.id);

function noteFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const n = (payload as { note?: unknown }).note;
  return typeof n === 'string' && n.trim() ? n.trim().slice(0, 200) : null;
}

export async function buildRadarAssistantContext(opts: {
  companyId: string;
  propertyId?: string | null;
  clientId?: string | null;
  locale: 'pt' | 'es' | 'en';
}): Promise<RadarAssistantContextSnapshot> {
  const { companyId, locale } = opts;
  const clientParam = String(opts.clientId || '').trim();
  const propertyWhere =
    !clientParam || clientParam === 'all' || clientParam === 'todos'
      ? { companyId, archivedAt: null as Date | null }
      : clientParam === 'own' ||
          clientParam === 'mine' ||
          clientParam === 'minha' ||
          clientParam === RADAR_SCOPE_OWN
        ? { companyId, clientId: null as string | null, archivedAt: null as Date | null }
        : { companyId, clientId: clientParam, archivedAt: null as Date | null };

  const properties = await prisma.radarProperty.findMany({
    where: propertyWhere,
    orderBy: { updatedAt: 'desc' },
    take: 40,
    include: {
      units: {
        where: { isActive: true },
        select: { id: true, name: true, kind: true, crop: true, areaHa: true },
      },
    },
  });

  type PropWithUnits = (typeof properties)[number];
  let focus: PropWithUnits | null =
    properties.find((p) => p.id === opts.propertyId) || properties[0] || null;

  if (opts.propertyId && !focus) {
    const extra = await prisma.radarProperty.findFirst({
      where: { id: opts.propertyId, companyId, archivedAt: null },
      include: {
        units: {
          where: { isActive: true },
          select: { id: true, name: true, kind: true, crop: true, areaHa: true },
        },
      },
    });
    focus = extra;
  }

  const focusUnits = focus?.units || [];
  const allUnitIds = properties.flatMap((p) => p.units.map((u) => u.id));
  const focusUnitIds = focusUnits.map((u) => u.id);

  const [entries, readings, sensors, tasks] = await Promise.all([
    allUnitIds.length
      ? prisma.nexusFieldEntry.findMany({
          where: { companyId, unitId: { in: allUnitIds } },
          orderBy: { occurredAt: 'desc' },
          take: 80,
        })
      : Promise.resolve([]),
    focusUnitIds.length
      ? prisma.nexusReading.findMany({
          where: { companyId, metric: { in: SENSOR_METRICS }, unitId: { in: focusUnitIds } },
          orderBy: { recordedAt: 'desc' },
          take: 80,
        })
      : Promise.resolve([]),
    prisma.nexusSensor.findMany({
      where: {
        companyId,
        isActive: true,
        ...(focusUnitIds.length ? { OR: [{ unitId: { in: focusUnitIds } }, { unitId: null }] } : {}),
      },
      select: {
        id: true,
        name: true,
        metric: true,
        unitId: true,
        lastSeenAt: true,
      },
      take: 40,
    }),
    prisma.radarTask.findMany({
      where: {
        companyId,
        archivedAt: null,
        status: { in: ['todo', 'doing'] },
        ...(focus ? { OR: [{ propertyId: focus.id }, { propertyId: null }] } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
  ]);

  const unitName = new Map<string, string>();
  for (const p of properties) {
    for (const u of p.units) unitName.set(u.id, u.name);
  }
  if (focus) {
    for (const u of focus.units) unitName.set(u.id, u.name);
  }

  const latestBySensor = new Map<string, number>();
  for (const r of readings) {
    if (!r.sensorId || latestBySensor.has(r.sensorId)) continue;
    latestBySensor.set(r.sensorId, r.value);
  }

  const checklist: RadarSetupGap[] = [];
  if (!focus) {
    checklist.push({
      id: 'no_property',
      severity: 'critical',
      message: {
        pt: 'Ainda não há propriedade. Cria um lugar no Painel (+).',
        es: 'Todavía no hay propiedad. Creá un sitio en el Panel (+).',
        en: 'No property yet. Create a place from the Dashboard (+).',
      },
      href: '/hub/radar',
    });
  } else {
    const sensorCount = sensors.filter((s) => !s.unitId || focusUnitIds.includes(s.unitId)).length;
    const progress = buildPropertyProgress({
      moduleId: focus.moduleId,
      crop: focus.crop,
      areaHa: focus.areaHa,
      layoutJson: focus.layoutJson,
      lat: focus.lat,
      lng: focus.lng,
      unitCount: focusUnits.length,
      sensorCount,
    });
    for (const step of progress.filter((s) => !s.done)) {
      if (step.id === 'characterize') {
        checklist.push({
          id: 'characterize',
          severity: 'critical',
          message: {
            pt: 'Caracterizar o lugar (módulo / cultura / área).',
            es: 'Caracterizar el sitio (módulo / cultivo / área).',
            en: 'Characterize the place (module / crop / area).',
          },
          href: `/hub/radar/properties/${focus.id}`,
        });
      }
      if (step.id === 'draw' || !isPlantDrawn({ layoutJson: focus.layoutJson, unitCount: focusUnits.length })) {
        if (step.id === 'draw') {
          checklist.push({
            id: 'draw',
            severity: 'warning',
            message: {
              pt: 'Desenhar planta — ainda sem espaços no mapa.',
              es: 'Dibujar planta — todavía sin espacios en el mapa.',
              en: 'Draw plant — no spaces on the map yet.',
            },
            href: `/hub/radar/properties/${focus.id}`,
          });
        }
      }
      if (step.id === 'geolocate' || !isGeolocated({ lat: focus.lat, lng: focus.lng })) {
        if (step.id === 'geolocate') {
          checklist.push({
            id: 'geolocate',
            severity: 'warning',
            message: {
              pt: 'Falta o pin de geolocalização.',
              es: 'Falta el pin de geolocalización.',
              en: 'Map pin / geolocation is missing.',
            },
            href: `/hub/radar/properties/${focus.id}`,
          });
        }
      }
      if (step.id === 'sensors') {
        checklist.push({
          id: 'sensors',
          severity: 'info',
          message: {
            pt: 'Sem sensores — começa a Automatização para ligar um aparelho.',
            es: 'Sin sensores — empezá Automatización para vincular un equipo.',
            en: 'No sensors — start Automation to bind a device.',
          },
          href: `/hub/radar/automatizacao?property=${focus.id}`,
        });
      }
    }

    const layout = parseRadarLayout(focus.layoutJson);
    const unplaced = focusUnits.filter((u) => {
      if (!isRadarParcel(u)) return false;
      const space = layout?.spaces.find((s) => s.id === u.id);
      return !space || space.placed === false;
    });
    if (unplaced.length > 0) {
      checklist.push({
        id: 'unplaced_spaces',
        severity: 'warning',
        message: {
          pt: `${unplaced.length} espaço(s) ainda sem posição no mapa.`,
          es: `${unplaced.length} espacio(s) aún sin posición en el mapa.`,
          en: `${unplaced.length} space(s) still unplaced on the map.`,
        },
        href: `/hub/radar/properties/${focus.id}`,
      });
    }

    const recentEntry = entries.find((e) => e.unitId && focusUnitIds.includes(e.unitId));
    const staleMs = 3 * 24 * 60 * 60 * 1000;
    if (!recentEntry || Date.now() - recentEntry.occurredAt.getTime() > staleMs) {
      checklist.push({
        id: 'caderno_gap',
        severity: 'info',
        message: {
          pt: 'Caderno parado — falta uma visita/anotação recente.',
          es: 'Cuaderno parado — falta una visita/nota reciente.',
          en: 'Notebook idle — missing a recent visit/note.',
        },
        href: '/hub/radar/caderno',
      });
    }
  }

  // Alerts from agriculture board (focus property) + light funnel gaps already in checklist
  const alerts: RadarAssistantContextSnapshot['alerts'] = [];
  if (focus && focus.moduleId === 'agriculture' && focusUnits.length) {
    const board = buildAgricultureBoard({
      now: new Date(),
      units: focusUnits,
      entries: entries.filter((e) => e.unitId && focusUnitIds.includes(e.unitId)),
      readings: readings.filter((r) => r.unitId && focusUnitIds.includes(r.unitId)),
    });
    for (const p of board.parcels || []) {
      if (!p.nextAction || p.nextAction === 'ok') continue;
      const msg =
        p.nextAction === 'irrigate'
          ? locale === 'es'
            ? `Regar — ${p.name}`
            : locale === 'en'
              ? `Irrigate — ${p.name}`
              : `Irrigar — ${p.name}`
          : p.nextAction === 'hold_harvest'
            ? locale === 'es'
              ? `No cosechar — ${p.name}`
              : locale === 'en'
                ? `Hold harvest — ${p.name}`
                : `Não colher — ${p.name}`
            : p.nextAction === 'scout'
              ? locale === 'es'
                ? `Recorrer — ${p.name}`
                : locale === 'en'
                  ? `Scout — ${p.name}`
                  : `Percorrer — ${p.name}`
              : locale === 'es'
                ? `Señal — ${p.name}`
                : locale === 'en'
                  ? `Signal — ${p.name}`
                  : `Sinal — ${p.name}`;
      alerts.push({
        id: `parcel:${p.id}:${p.nextAction}`,
        severity: p.nextAction === 'hold_harvest' || p.nextAction === 'irrigate' ? 'warning' : 'info',
        message: msg,
        propertyId: focus.id,
        href: `/hub/radar/properties/${focus.id}`,
      });
    }
  }

  const sectorAgent = sectorAgentFromModuleId(focus?.moduleId);
  const focused = focus;
  const spaceSource = focused
    ? focusUnits.map((u) => ({ ...u, propertyId: focused.id, layoutJson: focused.layoutJson }))
    : properties.flatMap((p) =>
        p.units.map((u) => ({ ...u, propertyId: p.id, layoutJson: p.layoutJson })),
      );
  const spaces = spaceSource.map((u) => {
    const layout = parseRadarLayout(u.layoutJson);
    const space = layout?.spaces.find((s) => s.id === u.id);
    return {
      id: u.id,
      name: u.name,
      propertyId: u.propertyId,
      placed: Boolean(space && space.placed !== false),
    };
  });

  return {
    companyId,
    propertyId: focus?.id || null,
    propertyName: focus?.name || null,
    moduleId: focus?.moduleId || null,
    sectorAgent,
    sectorLabel: SECTOR_AGENT_LABEL[sectorAgent],
    checklist,
    alerts: alerts.slice(0, 12),
    openTasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      severity: t.severity,
      propertyId: t.propertyId,
      href: t.propertyId ? `/hub/radar/properties/${t.propertyId}` : '/hub/radar/tarefas',
    })),
    recentCaderno: entries.slice(0, 8).map((e) => ({
      id: e.id,
      kind: e.kind,
      note: noteFromPayload(e.payloadJson),
      unitName: e.unitId ? unitName.get(e.unitId) || null : null,
      at: e.occurredAt.toISOString(),
    })),
    sensors: sensors.slice(0, 20).map((s) => ({
      id: s.id,
      name: s.name,
      metric: s.metric,
      lastValue: latestBySensor.get(s.id) ?? null,
      lastSeenAt: s.lastSeenAt?.toISOString() || null,
      unitName: s.unitId ? unitName.get(s.unitId) || null : null,
    })),
    spaces: spaces.slice(0, 40),
    visionSupported: true,
  };
}
