'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Layers,
  List,
  Loader2,
  MapPinned,
  Maximize2,
  Pencil,
  Plus,
  Radio,
  Search,
  Settings2,
  Sprout,
} from 'lucide-react';
import { RADAR_MODULES, type RadarModuleId } from '@/lib/etholys-products';
import { isRadarModuleId, spaceKindMeta } from '@/lib/radar/space';
import { radarLoc, radarT } from '@/lib/radar/i18n';
import { type PropertyStepId, type PropertyStepState } from '@/lib/radar/property-progress';
import { RadarGeoPin } from '@/components/radar/RadarGeoPin';
import { RadarSiteMap } from '@/components/radar/RadarSiteMap';
import { RadarSpatialTwin } from '@/components/radar/RadarSpatialTwin';
import { RadarCropsPanel } from '@/components/radar/RadarCropsPanel';
import { RadarAddParcelForm } from '@/components/radar/RadarAddParcelForm';
import { RadarFocusSheet } from '@/components/radar/RadarFocusSheet';
import { RadarSpaceTree } from '@/components/radar/RadarSpaceTree';
import {
  emptyRadarLayout,
  RADAR_STRUCTURE_KINDS,
  rotateSpace,
  setSpaceRotation,
  unplaceSpace,
  type RadarCrop,
  type RadarSiteLayoutDoc,
  type RadarStructureKind,
} from '@/lib/radar/site-layout';

type SpaceEditMode = 'none' | 'place' | 'move' | 'rotate' | 'site_move' | 'site_resize';
import { MOISTURE_THRESHOLD } from '@/lib/radar/agriculture';
import { RADAR_DEVICE_CATALOG } from '@/lib/radar/devices';
import { isTraceStage, TRACE_STAGE_LABEL, type TraceStage } from '@/lib/radar/trace';

type Loc = 'pt' | 'es' | 'en';

type PropertyDetail = {
  id: string;
  name: string;
  moduleId: string | null;
  crop: string | null;
  areaHa: number | null;
  lat: number | null;
  lng: number | null;
  clientId: string | null;
  clientName: string | null;
  units: Array<{
    id: string;
    name: string;
    kind: string;
    crop: string | null;
    areaHa: number | null;
    moisture?: number | null;
  }>;
  sensors: Array<{
    id: string;
    name: string;
    metric: string;
    unitId: string | null;
    lastValue?: number | null;
  }>;
  crops?: RadarCrop[];
  latestByUnit?: Record<string, Record<string, number>>;
  devices?: Array<{ sensorId: string; sku: string; devEui: string | null; unitId: string | null }>;
  layout?: RadarSiteLayoutDoc;
  steps: PropertyStepState[];
  nextStep: PropertyStepId;
  progressPercent: number;
};

export function RadarPropertyWorkspace({
  companyId,
  propertyId,
  engagementId,
  locale,
  backHref,
  initialUnitId,
  initialSettingsOpen,
}: {
  companyId: string;
  propertyId: string;
  engagementId?: string | null;
  locale: string;
  backHref: string;
  initialUnitId?: string | null;
  /** Open Definições do lugar on mount (e.g. ?settings=1 from home). */
  initialSettingsOpen?: boolean;
}) {
  const loc = radarLoc(locale);
  const [data, setData] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tokenFlash, setTokenFlash] = useState<string | null>(null);

  // characterize form
  const [name, setName] = useState('');
  const [moduleId, setModuleId] = useState<RadarModuleId | null>(null);
  const [crop, setCrop] = useState('');
  const [area, setArea] = useState('');
  const [sensorName, setSensorName] = useState('');
  const [sensorSku, setSensorSku] = useState('SE01-LB');
  const [devEui, setDevEui] = useState('');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [editingSpace, setEditingSpace] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceCrop, setSpaceCrop] = useState('');
  const [spaceArea, setSpaceArea] = useState('');
  const [spaceWidthM, setSpaceWidthM] = useState('');
  const [spaceLengthM, setSpaceLengthM] = useState('');
  const [spaceSpacingM, setSpaceSpacingM] = useState('');
  const [editingSensorId, setEditingSensorId] = useState<string | null>(null);
  const [editSensorName, setEditSensorName] = useState('');
  const [editSensorMetric, setEditSensorMetric] = useState('');
  const [editSensorUnitId, setEditSensorUnitId] = useState('');
  const [editSensorSku, setEditSensorSku] = useState('SE01-LB');
  const [editSensorDevEui, setEditSensorDevEui] = useState('');
  const [panel, setPanel] = useState<PropertyStepId | null>(null);
  const [tool, setTool] = useState<'crops' | 'space' | null>(null);
  const [openLot, setOpenLot] = useState<{ code: string; currentStage: TraceStage } | null>(null);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [query, setQuery] = useState('');
  /** Closed by default so the map stays clear (Maps-like). */
  const [railOpen, setRailOpen] = useState(false);
  const [layout, setLayout] = useState<RadarSiteLayoutDoc>(emptyRadarLayout());
  const [editMode, setEditMode] = useState<SpaceEditMode>('none');
  /** Full focus sheet — closed by default so the map stays clear. */
  const [focusDetailOpen, setFocusDetailOpen] = useState(false);
  const [draftAreaHa, setDraftAreaHa] = useState<number | null>(null);
  const settingsOpened = useRef(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!companyId || !propertyId) return;
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/properties/${propertyId}?${q}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      const p = d.property as PropertyDetail;
      p.crops = Array.isArray(p.crops) ? p.crops : [];
      setData(p);
      setName(p.name);
      setModuleId(p.moduleId && isRadarModuleId(p.moduleId) ? p.moduleId : null);
      setCrop(p.crop || '');
      setArea(p.areaHa != null ? String(p.areaHa) : '');
      setLayout(p.layout && Array.isArray(p.layout.spaces) ? p.layout : emptyRadarLayout());
      // Default: no forced unit. Only focus when URL asks for one.
      const prefer =
        initialUnitId && p.units.some((u) => u.id === initialUnitId) ? initialUnitId : null;
      setFocusedId(prefer);
      if (!Array.isArray(p.crops)) (p as PropertyDetail).crops = [];
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, propertyId, engagementId, initialUnitId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!initialSettingsOpen || settingsOpened.current || !data) return;
    settingsOpened.current = true;
    setPanel('characterize');
    setTool(null);
    // Do not force 2D — user stays in whatever view they had; edit tools use map when needed.
  }, [initialSettingsOpen, data]);

  useEffect(() => {
    const el = frameRef.current;
    const main = el?.closest('main');
    if (!el || !main) return;
    const apply = () => {
      const r = main.getBoundingClientRect();
      el.style.position = 'fixed';
      el.style.top = `${r.top}px`;
      el.style.left = `${r.left}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
      // Above hub chrome; map overlays use a higher sibling z-index inside this frame.
      el.style.zIndex = '40';
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(main);
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, [data?.id]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void (async () => {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/lots?${q}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (cancelled || !r.ok) return;
      const open = (d.lots || []).find((l: { status: string }) => l.status === 'open');
      if (open && isTraceStage(open.currentStage)) {
        setOpenLot({ code: open.code, currentStage: open.currentStage });
      } else setOpenLot(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, engagementId, data?.id]);

  const draftLayout = useCallback((next: RadarSiteLayoutDoc) => {
    setLayout(next);
  }, []);

  const commitLayout = useCallback(
    async (next: RadarSiteLayoutDoc) => {
      setLayout(next);
      setEditMode((cur) => (cur === 'place' ? 'none' : cur));
      try {
        const r = await fetch('/api/radar/layout', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, engagementId, propertyId, layout: next }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(typeof d.error === 'string' ? d.error : 'layout');
        if (d.layout && Array.isArray((d.layout as RadarSiteLayoutDoc).spaces)) {
          setLayout(d.layout as RadarSiteLayoutDoc);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Erro');
      }
    },
    [companyId, engagementId, propertyId],
  );

  const patch = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/radar/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, ...payload }),
      });
      const d = await r.json();
      if (!r.ok) {
        const msg = typeof d.error === 'string' ? d.error : 'Falha ao gravar';
        setErr(msg);
        throw new Error(msg);
      }
      return d;
    } finally {
      setBusy(false);
    }
  };

  const commitSiteArea = async (nextHa: number) => {
    const ha = Number.isFinite(nextHa) && nextHa > 0 ? Math.round(nextHa * 100) / 100 : null;
    if (ha == null) return;
    setDraftAreaHa(ha);
    setArea(String(ha));
    try {
      await patch({
        action: 'characterize',
        name: name.trim() || data?.name,
        moduleId: moduleId || data?.moduleId,
        crop: crop || data?.crop || '',
        areaHa: ha,
      });
      setEditMode((cur) => (cur === 'site_resize' ? 'none' : cur));
      setDraftAreaHa(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-rose-200">{err || '—'}</p>;
  }

  const mapParcels = data.units
    .filter((u) => u.kind === 'parcel' || u.kind === 'lot' || u.kind === 'herd' || u.kind === 'generic')
    .map((u) => {
      const moisture = u.moisture ?? null;
      const nextAction =
        moisture != null && moisture < MOISTURE_THRESHOLD ? ('irrigate' as const) : ('ok' as const);
      return {
        id: u.id,
        name: u.name,
        crop: u.crop,
        areaHa: u.areaHa,
        moisture,
        nextAction,
        harvestBlocked: false,
        alerts: [] as Array<{ severity: string }>,
      };
    });

  const next = data.steps.find((s) => !s.done) ?? null;
  const focusedUnit = data.units.find((u) => u.id === focusedId) || null;
  const focusedPlaced = Boolean(layout.spaces.some((s) => s.id === focusedId && s.placed === true));
  const focusedMoisture = focusedUnit?.moisture ?? null;

  const focusUnit = (id: string, opts?: { keepEditMode?: boolean }) => {
    setFocusedId(id);
    setFocusDetailOpen(false);
    setEditingSpace(false);
    if (!opts?.keepEditMode) setEditMode('none');
    const u = data.units.find((x) => x.id === id);
    if (u) {
      setSpaceName(u.name);
      setSpaceCrop(u.crop || '');
      setSpaceArea(u.areaHa != null ? String(u.areaHa) : '');
      const rect = layout.spaces.find((s) => s.id === id);
      setSpaceWidthM(rect?.widthM != null ? String(rect.widthM) : '');
      setSpaceLengthM(rect?.lengthM != null ? String(rect.lengthM) : '');
      setSpaceSpacingM(rect?.spacingM != null ? String(rect.spacingM) : '');
    }
  };

  const openEditSpace = () => {
    if (!focusedUnit) return;
    setSpaceName(focusedUnit.name);
    setSpaceCrop(focusedUnit.crop || '');
    setSpaceArea(focusedUnit.areaHa != null ? String(focusedUnit.areaHa) : '');
    const rect = layout.spaces.find((s) => s.id === focusedUnit.id);
    setSpaceWidthM(rect?.widthM != null ? String(rect.widthM) : '');
    setSpaceLengthM(rect?.lengthM != null ? String(rect.lengthM) : '');
    setSpaceSpacingM(rect?.spacingM != null ? String(rect.spacingM) : '');
    setEditingSpace(true);
    setFocusDetailOpen(true);
    setEditMode('none');
    setPanel(null);
    setTool(null);
  };
  const companyQ = engagementId
    ? `company=${companyId}&engagement=${engagementId}`
    : `company=${companyId}`;
  const chainHref = `/hub/radar/cadeia?${companyQ}`;
  const cadernoHref = `/hub/radar/caderno?${companyQ}&property=${propertyId}${
    focusedId ? `&unit=${focusedId}` : ''
  }`;
  const openStep = (id: PropertyStepId) => {
    if (id === 'draw') {
      setTool('space');
      setPanel(null);
      return;
    }
    setPanel((cur) => (cur === id ? null : id));
    setTool(null);
    // Geolocate uses map handlers; if in 3D we temporarily show the map while editMode/placing is active.
  };
  const nextLabel: Record<PropertyStepId, string> = {
    characterize: radarT(loc, 'Falta caracterizar o sítio', 'Falta caracterizar el sitio', 'Characterize this site'),
    draw: radarT(loc, 'Falta criar o primeiro espaço', 'Falta crear el primer espacio', 'Add the first space'),
    geolocate: radarT(loc, 'Falta marcar o sítio no mapa', 'Falta marcar el sitio en el mapa', 'Pin this site'),
    sensors: radarT(loc, 'Falta ligar sensores', 'Falta conectar sensores', 'Connect sensors'),
  };
  const nextButton: Record<PropertyStepId, string> = {
    characterize: radarT(loc, 'Caracterizar', 'Caracterizar', 'Characterize'),
    draw: radarT(loc, 'Novo espaço', 'Nuevo espacio', 'New space'),
    geolocate: radarT(loc, 'Marcar no mapa', 'Marcar en el mapa', 'Pin on map'),
    sensors: radarT(loc, 'Ligar sensores', 'Conectar sensores', 'Connect sensors'),
  };
  // Solid dark chrome over OSM — translucent glass fails on pale tiles.
  const chromePill =
    'rounded-2xl bg-[#07111A] text-white shadow-lg ring-1 ring-white/25';
  const chipBtn = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold shadow-lg ring-1 ${
      on
        ? 'bg-teal-300 text-slate-950 ring-teal-200/80'
        : 'bg-[#07111A] text-white ring-white/25 hover:bg-[#12343c]'
    }`;
  const railBtn = (on: boolean) =>
    `flex w-full flex-col items-center gap-0.5 rounded-xl px-1 py-2 ${
      on ? 'bg-teal-300 text-slate-950' : 'text-white/85 hover:bg-white/10 hover:text-white'
    }`;

  const q = query.trim().toLowerCase();
  const treeUnits = q
    ? data.units.filter((u) => u.name.toLowerCase().includes(q) || (u.crop || '').toLowerCase().includes(q))
    : data.units;
  const cardOpen = Boolean(panel || tool);
  const detailOpen = focusDetailOpen && Boolean(focusedId) && !cardOpen;

  const deleteFocusedSpace = async () => {
    if (!focusedId || !focusedUnit) return;
    const ok = window.confirm(
      radarT(
        loc,
        `Apagar o espaço «${focusedUnit.name}»? Sai da lista e do mapa.`,
        `¿Borrar el espacio «${focusedUnit.name}»? Sale de la lista y del mapa.`,
        `Delete space “${focusedUnit.name}”? It leaves the list and the map.`,
      ),
    );
    if (!ok) return;
    try {
      await patch({ action: 'parcel_delete', unitId: focusedId });
      setFocusedId(null);
      setFocusDetailOpen(false);
      setEditMode('none');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    }
  };

  return (
    <div ref={frameRef} className="relative isolate overflow-hidden bg-[#07111A]">
      {/*
        Leaflet panes/controls use z-index 200–1000. Without a stacking context on the map
        layer, those values compete with sibling overlays (z-10) and bury all map chrome.
      */}
      <div className="absolute inset-0 z-0">
        {/*
          Stay in 3D mode for the toggle. When an edit tool needs Leaflet (place/move/site_*),
          show the OSM map for the gesture — view state stays '3d' and Twin returns when editMode clears.
        */}
        {view === '3d' && editMode === 'none' && panel !== 'geolocate' ? (
          <RadarSpatialTwin
            locale={loc}
            moduleId={data.moduleId}
            parcels={mapParcels.map((p) => {
              // Local plant % layout drives the 3D twin even when placed=false (not on OSM yet).
              const rect = layout.spaces.find((s) => s.id === p.id);
              if (!rect) return p;
              return {
                ...p,
                x: rect.x,
                y: rect.y,
                w: rect.w,
                h: rect.h,
                rotation: rect.rotation ?? 0,
                widthM: rect.widthM ?? null,
                lengthM: rect.lengthM ?? null,
                spacingM: rect.spacingM ?? null,
              };
            })}
            spaces={layout.spaces}
            mapPlacedCount={layout.spaces.filter(
              (s) => s.placed === true && mapParcels.some((p) => p.id === s.id),
            ).length}
            sensors={data.sensors.map((s) => ({
              id: s.id,
              name: s.name,
              unitId: s.unitId,
              lastValue: s.lastValue ?? null,
              sku: data.devices?.find((d) => d.sensorId === s.id)?.sku || null,
            }))}
            focusedId={focusedId}
            onFocus={(id) => focusUnit(id)}
            fill
            lat={data.lat}
            lng={data.lng}
            areaHa={draftAreaHa ?? data.areaHa}
            siteSideM={layout.siteSideM ?? null}
            structures={layout.structures || []}
            irrigation={layout.irrigation || []}
          />
        ) : (
          <RadarSiteMap
            companyId={companyId}
            engagementId={engagementId}
            propertyId={propertyId}
            locale={loc}
            moduleId={data.moduleId}
            mode="empresa"
            parcels={mapParcels}
            sensors={data.sensors.map((s) => ({
              id: s.id,
              name: s.name,
              unitId: s.unitId,
              lastValue: s.lastValue ?? null,
            }))}
            focusedId={focusedId}
            onFocus={(id) =>
              focusUnit(id, {
                keepEditMode: editMode === 'move' || editMode === 'rotate' || editMode === 'place',
              })
            }
            onSaved={() => void load()}
            syncedLayout={layout}
            editMode={editMode}
            onLayoutDraft={draftLayout}
            onLayoutCommit={(next) => void commitLayout(next)}
            onSiteAreaDraft={(ha) => {
              setDraftAreaHa(ha);
              setArea(String(ha));
            }}
            onSiteAreaCommit={(ha) => void commitSiteArea(ha)}
            basemap={{
              lat: data.lat,
              lng: data.lng,
              areaHa: draftAreaHa ?? data.areaHa,
              query,
              placing:
                editMode === 'site_move' ||
                panel === 'geolocate' ||
                data.lat == null ||
                data.lng == null,
              onPin: (lat, lng) => {
                void patch({ action: 'geolocate', lat, lng })
                  .then(() => {
                    setEditMode((cur) => (cur === 'site_move' ? 'none' : cur));
                    return load();
                  })
                  .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
              },
            }}
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1100]">
        {/* Maps-like floating left rail + optional spaces panel */}
        <aside className="pointer-events-auto absolute bottom-3 left-3 top-3 flex items-stretch gap-2">
          <div className="flex w-[3.25rem] flex-col items-center gap-1 rounded-2xl bg-[#07111A] px-1 py-2 shadow-xl ring-1 ring-white/25">
            <Link
              href={backHref}
              title={radarT(loc, 'Lugares', 'Lugares', 'Places')}
              className={railBtn(false)}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-[8px] font-semibold uppercase leading-tight tracking-wide">
                {radarT(loc, 'Voltar', 'Volver', 'Back')}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setRailOpen((v) => !v)}
              className={railBtn(railOpen)}
              title={radarT(loc, 'Lista de espaços', 'Lista de espacios', 'Spaces list')}
              aria-label={radarT(loc, 'Lista de espaços', 'Lista de espacios', 'Spaces list')}
              aria-pressed={railOpen}
            >
              <List className="h-4 w-4" />
              <span className="text-[8px] font-semibold uppercase leading-tight tracking-wide">
                {data.units.length}
              </span>
            </button>
            <Link
              href={cadernoHref}
              title={radarT(loc, 'Caderno', 'Cuaderno', 'Notebook')}
              className={railBtn(false)}
            >
              <BookOpen className="h-4 w-4" />
              <span className="text-[8px] font-semibold uppercase leading-tight tracking-wide">
                {radarT(loc, 'Caderno', 'Cuaderno', 'Note')}
              </span>
            </Link>
            <div className="mt-auto flex w-full flex-col items-center gap-1 border-t border-white/10 pt-2">
              <button
                type="button"
                onClick={() => {
                  openStep('characterize');
                  setEditMode('none');
                }}
                className={railBtn(panel === 'characterize')}
                title={radarT(loc, 'Definições do lugar', 'Ajustes del lugar', 'Place settings')}
              >
                <Settings2 className="h-4 w-4" />
                <span className="text-[8px] font-semibold uppercase leading-tight tracking-wide">
                  {radarT(loc, 'Ajustes', 'Ajustes', 'Set')}
                </span>
              </button>
            </div>
          </div>
          {railOpen && (
            <div className="flex max-h-full w-[min(16rem,calc(100vw-5rem))] flex-col overflow-hidden rounded-2xl bg-[#07111A] shadow-xl ring-1 ring-white/25">
              <div className="shrink-0 border-b border-white/10 px-3 pb-2 pt-3">
                <p className="truncate text-sm font-semibold text-white">{data.name}</p>
                {data.clientName && (
                  <p className="truncate text-[11px] text-white/55">{data.clientName}</p>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-1">
                <RadarSpaceTree
                  locale={loc}
                  moduleId={data.moduleId}
                  propertyName={data.name}
                  units={treeUnits}
                  sensors={data.sensors}
                  focusedId={focusedId}
                  onFocus={(id) => focusUnit(id)}
                />
              </div>
            </div>
          )}
        </aside>

        {/* Search pill + filter chips (top), clear of the left rail */}
        <div
          className={`pointer-events-auto absolute right-3 top-3 flex flex-col items-stretch gap-2 ${
            railOpen ? 'left-[20.5rem]' : 'left-[4.5rem]'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <label className={`flex min-w-[11rem] max-w-md flex-1 items-center gap-2 px-4 py-2.5 ${chromePill}`}>
              <Search className="h-4 w-4 shrink-0 text-teal-200" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={radarT(loc, 'Buscar espaço', 'Buscar espacio', 'Search spaces')}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/55"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setTool(tool === 'space' ? null : 'space');
                setPanel(null);
              }}
              className={chipBtn(tool === 'space')}
            >
              <Plus className="h-3.5 w-3.5" />
              {radarT(loc, 'Espaço', 'Espacio', 'Space')}
            </button>
            {data.moduleId === 'agriculture' && (
              <button
                type="button"
                onClick={() => {
                  setTool(tool === 'crops' ? null : 'crops');
                  setPanel(null);
                }}
                className={chipBtn(tool === 'crops')}
              >
                <Sprout className="h-3.5 w-3.5" />
                {radarT(loc, 'Cultivos', 'Cultivos', 'Crops')}
              </button>
            )}
            <button type="button" onClick={() => openStep('sensors')} className={chipBtn(panel === 'sensors')}>
              <Radio className="h-3.5 w-3.5" />
              {radarT(loc, 'Sensores', 'Sensores', 'Sensors')}
            </button>
          </div>
          {view === '3d' && editMode !== 'none' && (
            <p className="max-w-xl self-start rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-950 shadow-lg">
              {radarT(
                loc,
                'Modo 3D activo — a editar no mapa; a vista 3D retoma ao terminar a ferramenta.',
                'Modo 3D activo — editando en el mapa; la vista 3D vuelve al terminar la herramienta.',
                '3D mode on — editing on the map; 3D returns when you finish the tool.',
              )}
            </p>
          )}
          {err && (
            <p className="max-w-md rounded-xl border border-rose-400/30 bg-rose-950/90 px-3 py-2 text-sm text-rose-100">
              {err}
            </p>
          )}
          {next && (
            <div className="flex max-w-md items-center justify-between gap-3 self-start rounded-full bg-amber-50 px-3.5 py-1.5 text-amber-950 shadow-lg">
              <p className="truncate text-xs font-semibold sm:text-sm">{nextLabel[next.id]}</p>
              <button
                type="button"
                onClick={() => openStep(next.id)}
                className="shrink-0 rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold text-white"
              >
                {panel === next.id || (next.id === 'draw' && tool === 'space')
                  ? radarT(loc, 'Fechar', 'Cerrar', 'Close')
                  : nextButton[next.id]}
              </button>
            </div>
          )}
          {openLot && !cardOpen && (
            <Link
              href={chainHref}
              className={`self-start px-3.5 py-2 text-xs font-medium hover:bg-[#12343c] ${chromePill}`}
            >
              {radarT(loc, 'Lote', 'Lote', 'Lot')} {openLot.code} · {TRACE_STAGE_LABEL[openLot.currentStage][loc]} →
            </Link>
          )}
        </div>

        {/* Bottom-right: map type / layers (2D · 3D) — hide when a right sheet is open */}
        {!cardOpen && !detailOpen && (
          <div className="pointer-events-auto absolute bottom-4 right-3 z-20 flex flex-col items-end gap-2">
            <div className="overflow-hidden rounded-2xl bg-[#07111A] shadow-xl ring-1 ring-white/25">
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                <Layers className="h-3.5 w-3.5 text-teal-200" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
                  {radarT(loc, 'Camadas', 'Capas', 'Layers')}
                </span>
              </div>
              <div className="flex p-1">
                <button
                  type="button"
                  onClick={() => setView('2d')}
                  className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
                    view === '2d' ? 'bg-teal-300 text-slate-950' : 'text-white/85 hover:bg-white/10'
                  }`}
                >
                  2D
                </button>
                <button
                  type="button"
                  onClick={() => setView('3d')}
                  className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
                    view === '3d' ? 'bg-teal-300 text-slate-950' : 'text-white/85 hover:bg-white/10'
                  }`}
                >
                  3D
                </button>
              </div>
            </div>
          </div>
        )}

        {cardOpen && (
          <div className="pointer-events-auto absolute bottom-4 right-4 top-28 z-20 w-[min(28rem,calc(100%-5.5rem))] overflow-y-auto rounded-2xl border border-white/20 bg-[#07111A] px-4 py-4 shadow-2xl">
            {tool === 'crops' && data.moduleId === 'agriculture' && (
              <RadarCropsPanel
                locale={loc}
                crops={data.crops || []}
                busy={busy}
                onAdd={async (input) => {
                  await patch({ action: 'crop_add', ...input });
                  await load();
                }}
                onUpdate={async (cropId, input) => {
                  await patch({ action: 'crop_update', cropId, ...input });
                  await load();
                }}
                onRemove={async (cropId) => {
                  await patch({ action: 'crop_remove', cropId });
                  await load();
                }}
              />
            )}
            {tool === 'space' && (
              <RadarAddParcelForm
                locale={loc}
                moduleId={data.moduleId}
                crops={data.crops || []}
                busy={busy}
                onCancel={() => setTool(null)}
                onSubmit={async (input) => {
                  const d = await patch({ action: 'parcel', ...input });
                  await load();
                  if (d?.unit?.id) {
                    setFocusedId(d.unit.id as string);
                    setEditMode('place');
                  }
                  setTool(null);
                }}
              />
            )}
            {panel === 'characterize' && (
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    {radarT(loc, 'Configuração', 'Configuración', 'Configuration')}
                  </p>
                  <h2 className="mt-1 font-serif text-2xl text-white">
                    {radarT(loc, 'Definições do lugar', 'Ajustes del lugar', 'Place settings')}
                  </h2>
                  <p className="mt-1 text-sm text-white/55">
                    {radarT(
                      loc,
                      'Nome, tipo/módulo, área — e mover ou redimensionar a propriedade no mapa.',
                      'Nombre, tipo/módulo, área — y mover o redimensionar la propiedad en el mapa.',
                      'Name, type/module, area — and move or resize the property on the map.',
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-400/30 bg-[#0c1a24] px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/80">
                    {radarT(loc, 'Propriedade no mapa', 'Propiedad en el mapa', 'Property on the map')}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {radarT(
                      loc,
                      'Ferramentas do contorno do sítio — distintas de Mover/Rodar de um espaço.',
                      'Herramientas del contorno del sitio — distintas de Mover/Girar de un espacio.',
                      'Site outline tools — distinct from moving/rotating a space.',
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setTool(null);
                        setFocusedId(null);
                        setFocusDetailOpen(false);
                        setEditMode((cur) => (cur === 'site_move' ? 'none' : 'site_move'));
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                        editMode === 'site_move'
                          ? 'bg-amber-300 text-slate-950'
                          : 'bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      <MapPinned className="h-3.5 w-3.5" />
                      {editMode === 'site_move'
                        ? radarT(loc, 'A mover propriedade…', 'Moviendo propiedad…', 'Moving property…')
                        : radarT(loc, 'Mover propriedade', 'Mover propiedad', 'Move property')}
                    </button>
                    <button
                      type="button"
                      disabled={busy || data.lat == null || data.lng == null}
                      onClick={() => {
                        setTool(null);
                        setFocusedId(null);
                        setFocusDetailOpen(false);
                        setEditMode((cur) => (cur === 'site_resize' ? 'none' : 'site_resize'));
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                        editMode === 'site_resize'
                          ? 'bg-amber-300 text-slate-950'
                          : 'bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      {editMode === 'site_resize'
                        ? radarT(loc, 'A redimensionar…', 'Redimensionando…', 'Resizing…')
                        : radarT(loc, 'Redimensionar', 'Redimensionar', 'Resize')}
                    </button>
                  </div>
                  {(draftAreaHa ?? data.areaHa) != null && (
                    <p className="mt-2 text-xs text-white/55">
                      {radarT(loc, 'Área actual', 'Área actual', 'Current area')}:{' '}
                      <span className="font-semibold text-white">
                        {draftAreaHa ?? data.areaHa} ha
                      </span>
                      {(draftAreaHa ?? data.areaHa) != null && (
                        <span className="ml-2 text-white/40">
                          (~{Math.round(Math.sqrt(Number(draftAreaHa ?? data.areaHa) * 10000))} m de lado)
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-white/12 bg-[#0c1a24] px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                    {radarT(loc, 'Estruturas e irrigação (MVP)', 'Estructuras e irrigación (MVP)', 'Structures & irrigation (MVP)')}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {radarT(
                      loc,
                      'Tipos simples no layout — visíveis em 2D/3D. Não é CAD.',
                      'Tipos simples en el layout — visibles en 2D/3D. No es CAD.',
                      'Simple layout types — visible in 2D/3D. Not CAD.',
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {RADAR_STRUCTURE_KINDS.filter((k) => k !== 'irrigation_line').map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const id = `st_${Date.now().toString(36)}`;
                          const label: Record<RadarStructureKind, string> = {
                            shed: radarT(loc, 'Galpão', 'Galpón', 'Shed'),
                            greenhouse: radarT(loc, 'Estufa', 'Invernadero', 'Greenhouse'),
                            path: radarT(loc, 'Caminho', 'Camino', 'Path'),
                            irrigation_line: radarT(loc, 'Irrigação', 'Riego', 'Irrigation'),
                          };
                          const next = {
                            ...layout,
                            structures: [
                              ...(layout.structures || []),
                              {
                                id,
                                kind,
                                x: 20 + ((layout.structures?.length || 0) % 4) * 12,
                                y: 20 + Math.floor((layout.structures?.length || 0) / 4) * 12,
                                w: kind === 'path' ? 40 : 14,
                                h: kind === 'path' ? 6 : 12,
                                lengthM: kind === 'path' ? 20 : 6,
                                widthM: kind === 'path' ? 2 : 4,
                                heightM: kind === 'path' ? 0.1 : 2.5,
                                label: label[kind],
                              },
                            ],
                          };
                          void commitLayout(next);
                        }}
                        className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/15"
                      >
                        + {kind === 'shed' ? radarT(loc, 'Galpão', 'Galpón', 'Shed') : kind === 'greenhouse' ? radarT(loc, 'Estufa', 'Invernadero', 'Greenhouse') : radarT(loc, 'Caminho', 'Camino', 'Path')}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const id = `ir_${Date.now().toString(36)}`;
                        const n = layout.irrigation?.length || 0;
                        const next = {
                          ...layout,
                          irrigation: [
                            ...(layout.irrigation || []),
                            {
                              id,
                              label: radarT(loc, 'Linha de irrigação', 'Línea de riego', 'Irrigation line'),
                              points: [
                                { x: 15, y: 30 + n * 8 },
                                { x: 50, y: 30 + n * 8 },
                                { x: 85, y: 35 + n * 8 },
                              ],
                            },
                          ],
                        };
                        void commitLayout(next);
                      }}
                      className="rounded-full bg-sky-700/80 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-600"
                    >
                      + {radarT(loc, 'Irrigação', 'Riego', 'Irrigation')}
                    </button>
                  </div>
                  {((layout.structures?.length || 0) > 0 || (layout.irrigation?.length || 0) > 0) && (
                    <ul className="mt-2 space-y-1 text-xs text-white/60">
                      {(layout.structures || []).map((s) => (
                        <li key={s.id} className="flex justify-between gap-2">
                          <span>
                            {s.label || s.kind}
                            {s.lengthM != null ? ` · ${s.lengthM}×${s.widthM ?? '—'} m` : ''}
                          </span>
                          <button
                            type="button"
                            className="text-rose-300 hover:text-rose-200"
                            onClick={() =>
                              void commitLayout({
                                ...layout,
                                structures: (layout.structures || []).filter((x) => x.id !== s.id),
                              })
                            }
                          >
                            {radarT(loc, 'Apagar', 'Borrar', 'Delete')}
                          </button>
                        </li>
                      ))}
                      {(layout.irrigation || []).map((ir) => (
                        <li key={ir.id} className="flex justify-between gap-2">
                          <span>{ir.label || radarT(loc, 'Irrigação', 'Riego', 'Irrigation')}</span>
                          <button
                            type="button"
                            className="text-rose-300 hover:text-rose-200"
                            onClick={() =>
                              void commitLayout({
                                ...layout,
                                irrigation: (layout.irrigation || []).filter((x) => x.id !== ir.id),
                              })
                            }
                          >
                            {radarT(loc, 'Apagar', 'Borrar', 'Delete')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-white/45">
                    {radarT(loc, 'Nome', 'Nombre', 'Name')}
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {RADAR_MODULES.map((m) => {
                    const active = moduleId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => isRadarModuleId(m.id) && setModuleId(m.id)}
                        className={`rounded-2xl border px-4 py-4 text-left ${
                          active ? 'border-emerald-400/50 bg-emerald-500/15' : 'border-white/10 bg-white/[0.03]'
                        }`}
                      >
                        <p className="font-medium text-white">{m[loc]}</p>
                        <p className="mt-1 text-xs text-white/45">{m.hint[loc]}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-white/45">
                      {moduleId ? spaceKindMeta(moduleId).secondaryLabel[loc] : loc === 'es' ? 'Cultivo' : loc === 'en' ? 'Crop' : 'Cultura'}
                    </span>
                    <input
                      value={crop}
                      onChange={(e) => setCrop(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-white/45">
                      {moduleId ? spaceKindMeta(moduleId).areaUnit[loc] : 'ha'}
                    </span>
                    <input
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      inputMode="decimal"
                      className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={busy || !moduleId || name.trim().length < 2}
                  onClick={() =>
                    void patch({
                      action: 'characterize',
                      name,
                      moduleId,
                      crop,
                      areaHa: area ? Number(area) : null,
                    })
                      .then(() => load())
                      .then(() => setPanel(null))
                      .catch((e) => setErr(e.message))
                  }
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />}
                  {radarT(loc, 'Guardar', 'Guardar', 'Save')}
                </button>
              </div>
            )}
            {panel === 'geolocate' && (
              <RadarGeoPin
                locale={loc}
                lat={data.lat}
                lng={data.lng}
                busy={busy}
                onSave={async (lat, lng) => {
                  await patch({ action: 'geolocate', lat, lng });
                  await load();
                  setPanel(null);
                }}
              />
            )}
            {panel === 'sensors' && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-serif text-2xl text-white">{radarT(loc, 'Sensores', 'Sensores', 'Sensors')}</h2>
                  <p className="mt-1 text-sm text-white/55">
                    {radarT(
                      loc,
                      'Aparelho, espaço e DevEUI. O token aparece uma vez.',
                      'Equipo, espacio y DevEUI. El token aparece una vez.',
                      'Device, space and DevEUI. The token is shown once.',
                    )}
                  </p>
                  {data.sensors.length === 0 && (
                    <Link
                      href={`/hub/radar/automatizacao?company=${encodeURIComponent(companyId)}&property=${encodeURIComponent(data.id)}${engagementId ? `&engagement=${encodeURIComponent(engagementId)}` : ''}`}
                      className="mt-2 inline-flex text-xs font-semibold text-teal-200/90 underline-offset-2 hover:underline"
                    >
                      {radarT(loc, 'Começar automatização', 'Empezar automatización', 'Start automation')}
                    </Link>
                  )}
                </div>
                {editingSensorId && (
                  <div className="rounded-xl border border-teal-400/35 bg-[#0c1a24] px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-200/80">
                      {radarT(loc, 'Editar sensor', 'Editar sensor', 'Edit sensor')}
                    </p>
                    <div className="mt-3 grid gap-2">
                      <input
                        value={editSensorName}
                        onChange={(e) => setEditSensorName(e.target.value)}
                        placeholder={radarT(loc, 'Nome', 'Nombre', 'Name')}
                        className="rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none"
                      />
                      <select
                        value={editSensorMetric}
                        onChange={(e) => setEditSensorMetric(e.target.value)}
                        className="rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 [&>option]:bg-slate-950"
                      >
                        {RADAR_DEVICE_CATALOG.flatMap((d) => d.metrics).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id} ({m.unit})
                          </option>
                        ))}
                        <option value="soil_moisture">soil_moisture (%)</option>
                      </select>
                      <select
                        value={editSensorUnitId}
                        onChange={(e) => setEditSensorUnitId(e.target.value)}
                        className="rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 [&>option]:bg-slate-950"
                      >
                        <option value="">{radarT(loc, 'Sem espaço', 'Sin espacio', 'No space')}</option>
                        {data.units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editSensorSku}
                        onChange={(e) => setEditSensorSku(e.target.value)}
                        className="rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 [&>option]:bg-slate-950"
                      >
                        {RADAR_DEVICE_CATALOG.map((d) => (
                          <option key={d.sku} value={d.sku}>
                            {d.sku} — {d.label[loc]}
                          </option>
                        ))}
                      </select>
                      <input
                        value={editSensorDevEui}
                        onChange={(e) => setEditSensorDevEui(e.target.value)}
                        placeholder="DevEUI"
                        className="rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none"
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={busy || editSensorName.trim().length < 2}
                        onClick={() =>
                          void patch({
                            action: 'sensor_update',
                            sensorId: editingSensorId,
                            name: editSensorName,
                            metric: editSensorMetric,
                            unitId: editSensorUnitId || null,
                            sku: editSensorSku,
                            devEui: editSensorDevEui,
                          })
                            .then(() => {
                              setEditingSensorId(null);
                              return load();
                            })
                            .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'))
                        }
                        className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c] disabled:opacity-40"
                      >
                        {radarT(loc, 'Guardar', 'Guardar', 'Save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSensorId(null)}
                        className="rounded-xl px-3 py-2 text-sm text-white/55"
                      >
                        {radarT(loc, 'Cancelar', 'Cancelar', 'Cancel')}
                      </button>
                    </div>
                  </div>
                )}
                {data.sensors.length > 0 && (
                  <ul className="space-y-2">
                    {data.sensors.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#0c1a24] px-4 py-3 text-sm text-white/80"
                      >
                        <Radio className="h-4 w-4 shrink-0 text-emerald-300" />
                        <span className="min-w-0 flex-1 truncate">{s.name}</span>
                        <span className="text-white/45">· {s.metric}</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const binding = data.devices?.find((d) => d.sensorId === s.id);
                            setEditingSensorId(s.id);
                            setEditSensorName(s.name);
                            setEditSensorMetric(s.metric);
                            setEditSensorUnitId(s.unitId || '');
                            setEditSensorSku(binding?.sku || 'SE01-LB');
                            setEditSensorDevEui(binding?.devEui || '');
                          }}
                          className="rounded-full bg-[#12343c] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1a4a54] disabled:opacity-40"
                        >
                          {radarT(loc, 'Editar', 'Editar', 'Edit')}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const ok = window.confirm(
                              radarT(
                                loc,
                                `Desactivar o sensor «${s.name}»?`,
                                `¿Desactivar el sensor «${s.name}»?`,
                                `Deactivate sensor “${s.name}”?`,
                              ),
                            );
                            if (!ok) return;
                            void patch({ action: 'sensor_remove', sensorId: s.id })
                              .then(() => load())
                              .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'));
                          }}
                          className="rounded-full bg-rose-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-800 disabled:opacity-40"
                        >
                          {radarT(loc, 'Apagar', 'Borrar', 'Delete')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  <select
                    value={sensorSku}
                    onChange={(e) => setSensorSku(e.target.value)}
                    className="min-w-[14rem] rounded-2xl border border-slate-500 bg-slate-950 px-3 py-3 text-sm text-slate-100 [&>option]:bg-slate-950 [&>option]:text-slate-100"
                  >
                    {RADAR_DEVICE_CATALOG.map((d) => (
                      <option key={d.sku} value={d.sku}>
                        {d.sku} — {d.label[loc]}
                      </option>
                    ))}
                  </select>
                  <input
                    value={sensorName}
                    onChange={(e) => setSensorName(e.target.value)}
                    placeholder={radarT(loc, 'Nome no sítio', 'Nombre en el sitio', 'Name on the site')}
                    className="min-w-[12rem] flex-1 rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                  <input
                    value={devEui}
                    onChange={(e) => setDevEui(e.target.value)}
                    placeholder="DevEUI"
                    className="min-w-[10rem] rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                  <button
                    type="button"
                    disabled={busy || sensorName.trim().length < 2}
                    onClick={() =>
                      void patch({
                        action: 'sensor',
                        name: sensorName,
                        sku: sensorSku,
                        devEui,
                        unitId: focusedId || data.units[0]?.id,
                      })
                        .then((d) => {
                          setTokenFlash(`${d.token as string}  →  ${d.ingestPath as string}`);
                          setSensorName('');
                          setDevEui('');
                          return load();
                        })
                        .catch((e) => setErr(e.message))
                    }
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                    {radarT(loc, 'Emitir token', 'Emitir token', 'Issue token')}
                  </button>
                </div>
                {tokenFlash && (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                    <p className="font-medium">{radarT(loc, 'Copia agora', 'Copiá ahora', 'Copy now')}</p>
                    <code className="mt-1 block break-all text-xs">{tokenFlash}</code>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!cardOpen && focusedId && focusedUnit && !detailOpen && (
          <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 px-2">
            <div className="rounded-2xl border border-white/15 bg-[#07111A]/95 p-3 shadow-2xl backdrop-blur-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditMode('none');
                    setFocusDetailOpen(true);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-semibold text-white">{focusedUnit.name}</p>
                  <p className="mt-0.5 truncate text-xs text-white/50">
                    {[
                      focusedUnit.crop,
                      focusedMoisture != null ? `${focusedMoisture}%` : null,
                      !focusedPlaced
                        ? radarT(loc, 'Ainda fora do mapa', 'Aún fuera del mapa', 'Not on the map yet')
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || radarT(loc, 'Toca para abrir detalhes', 'Toca para abrir detalles', 'Tap to open details')}
                  </p>
                </button>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode('none');
                      setFocusDetailOpen(true);
                      setEditingSpace(false);
                    }}
                    className="rounded-full bg-teal-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-teal-300"
                  >
                    {radarT(loc, 'Ficha', 'Ficha', 'File')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditSpace()}
                    className="inline-flex items-center gap-1 rounded-full bg-[#12343c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a4a54]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {radarT(loc, 'Editar', 'Editar', 'Edit')}
                  </button>
                  <Link
                    href={cadernoHref}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    {radarT(loc, 'Caderno', 'Cuaderno', 'Notebook')}
                  </Link>
                </div>
              </div>

              {/* Layout tools only when adjusting — not competing with the map chrome. */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2">
                {!focusedPlaced ? (
                  <button
                    type="button"
                    disabled={data.lat == null || data.lng == null}
                    onClick={() => {
                      setPanel(null);
                      setTool(null);
                      setEditMode((cur) => (cur === 'place' ? 'none' : 'place'));
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                      editMode === 'place' ? 'bg-teal-300 text-slate-950' : 'bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    {editMode === 'place'
                      ? radarT(loc, 'A cancelar…', 'Cancelando…', 'Cancel…')
                      : radarT(loc, 'Colocar no mapa', 'Colocar en el mapa', 'Place on map')}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditMode((cur) => (cur === 'move' ? 'none' : 'move'));
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        editMode === 'move' ? 'bg-teal-300 text-slate-950' : 'bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      {editMode === 'move'
                        ? radarT(loc, 'A mover espaço…', 'Moviendo espacio…', 'Moving space…')
                        : radarT(loc, 'Mover espaço', 'Mover espacio', 'Move space')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditMode((cur) => (cur === 'rotate' ? 'none' : 'rotate'));
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        editMode === 'rotate'
                          ? 'bg-teal-300 text-slate-950'
                          : 'bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      {editMode === 'rotate'
                        ? radarT(loc, 'A rodar…', 'Girando…', 'Rotating…')
                        : radarT(loc, 'Rodar espaço', 'Girar espacio', 'Rotate space')}
                    </button>
                    {editMode === 'rotate' && focusedId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-1.5 py-0.5">
                        <button
                          type="button"
                          title="-1°"
                          onClick={() => void commitLayout(rotateSpace(layout, focusedId, -1))}
                          className="rounded-full px-2 py-1 text-[11px] font-semibold text-white/85 hover:bg-white/10"
                        >
                          −1°
                        </button>
                        <button
                          type="button"
                          title="+1°"
                          onClick={() => void commitLayout(rotateSpace(layout, focusedId, 1))}
                          className="rounded-full px-2 py-1 text-[11px] font-semibold text-white/85 hover:bg-white/10"
                        >
                          +1°
                        </button>
                        <button
                          type="button"
                          title="-15°"
                          onClick={() => void commitLayout(rotateSpace(layout, focusedId, -15))}
                          className="rounded-full px-2 py-1 text-[11px] font-semibold text-white/85 hover:bg-white/10"
                        >
                          −15°
                        </button>
                        <button
                          type="button"
                          title="+15°"
                          onClick={() => void commitLayout(rotateSpace(layout, focusedId, 15))}
                          className="rounded-full px-2 py-1 text-[11px] font-semibold text-white/85 hover:bg-white/10"
                        >
                          +15°
                        </button>
                        <span className="px-1.5 text-[11px] font-semibold tabular-nums text-teal-200">
                          {Math.round(layout.spaces.find((s) => s.id === focusedId)?.rotation ?? 0)}°
                        </span>
                        <button
                          type="button"
                          title="0°"
                          onClick={() => void commitLayout(setSpaceRotation(layout, focusedId, 0))}
                          className="rounded-full px-2 py-1 text-[11px] font-semibold text-white/70 hover:bg-white/10"
                        >
                          0°
                        </button>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!focusedId) return;
                        setEditMode('none');
                        void commitLayout(unplaceSpace(layout, focusedId));
                      }}
                      className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/15"
                    >
                      {radarT(loc, 'Tirar do mapa', 'Quitar del mapa', 'Remove from map')}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void deleteFocusedSpace()}
                  className="ml-auto rounded-full px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/15 disabled:opacity-40"
                >
                  {radarT(loc, 'Apagar espaço', 'Borrar espacio', 'Delete space')}
                </button>
              </div>
            </div>
          </div>
        )}

        {!cardOpen && !detailOpen && !focusedId && data.units.length > 0 && (
          <p className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[#07111A]/90 px-4 py-2 text-xs text-white/70 shadow-lg ring-1 ring-white/15">
            {radarT(
              loc,
              'Clica num espaço no mapa ou abre a lista à esquerda',
              'Clic en un espacio del mapa o abre la lista a la izquierda',
              'Click a space on the map or open the list on the left',
            )}
          </p>
        )}

        {detailOpen && focusedId && focusedUnit && (
          <div className="pointer-events-auto absolute bottom-3 right-3 top-28 z-20 flex w-[min(24rem,calc(100%-5.5rem))] flex-col gap-2 overflow-y-auto rounded-2xl border border-white/20 bg-[#07111A] p-3 shadow-2xl sm:bottom-4 sm:right-4">
            {editingSpace && (
              <div className="rounded-xl border border-teal-400/35 bg-[#0c1a24] px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-200/80">
                  {radarT(loc, 'Editar espaço', 'Editar espacio', 'Edit space')}
                </p>
                <h3 className="mt-1 text-lg font-medium text-white">
                  {radarT(loc, 'Espaço:', 'Espacio:', 'Space:')} {focusedUnit.name}
                </h3>
                <div className="mt-3 space-y-2">
                  <input
                    value={spaceName}
                    onChange={(e) => setSpaceName(e.target.value)}
                    placeholder={radarT(loc, 'Nome', 'Nombre', 'Name')}
                    className="w-full rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none"
                  />
                  <input
                    value={spaceCrop}
                    onChange={(e) => setSpaceCrop(e.target.value)}
                    placeholder={moduleId ? spaceKindMeta(moduleId).secondaryLabel[loc] : radarT(loc, 'Cultura', 'Cultivo', 'Crop')}
                    className="w-full rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none"
                  />
                  <input
                    value={spaceArea}
                    onChange={(e) => setSpaceArea(e.target.value)}
                    inputMode="decimal"
                    placeholder={moduleId ? spaceKindMeta(moduleId).areaUnit[loc] : 'ha'}
                    className="w-full rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={spaceWidthM}
                      onChange={(e) => setSpaceWidthM(e.target.value)}
                      inputMode="decimal"
                      placeholder={radarT(loc, 'Largura m', 'Ancho m', 'Width m')}
                      className="rounded-xl border border-slate-500 bg-slate-950 px-2 py-2 text-sm text-slate-100 outline-none"
                    />
                    <input
                      value={spaceLengthM}
                      onChange={(e) => setSpaceLengthM(e.target.value)}
                      inputMode="decimal"
                      placeholder={radarT(loc, 'Comp. m', 'Largo m', 'Length m')}
                      className="rounded-xl border border-slate-500 bg-slate-950 px-2 py-2 text-sm text-slate-100 outline-none"
                    />
                    <input
                      value={spaceSpacingM}
                      onChange={(e) => setSpaceSpacingM(e.target.value)}
                      inputMode="decimal"
                      placeholder={radarT(loc, 'Espaç. m', 'Espac. m', 'Spacing m')}
                      className="rounded-xl border border-slate-500 bg-slate-950 px-2 py-2 text-sm text-slate-100 outline-none"
                    />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busy || spaceName.trim().length < 2}
                    onClick={() =>
                      void patch({
                        action: 'parcel_update',
                        unitId: focusedId,
                        name: spaceName.trim(),
                        crop: spaceCrop.trim() || null,
                        areaHa: spaceArea ? Number(spaceArea) : null,
                      })
                        .then(() => {
                          const next = {
                            ...layout,
                            spaces: layout.spaces.map((s) =>
                              s.id === focusedId
                                ? {
                                    ...s,
                                    widthM: spaceWidthM ? Number(spaceWidthM) : null,
                                    lengthM: spaceLengthM ? Number(spaceLengthM) : null,
                                    spacingM: spaceSpacingM ? Number(spaceSpacingM) : null,
                                  }
                                : s,
                            ),
                          };
                          return commitLayout(next);
                        })
                        .then(() => load())
                        .then(() => setEditingSpace(false))
                        .catch((e) => setErr(e instanceof Error ? e.message : 'Erro'))
                    }
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c] disabled:opacity-40"
                  >
                    {radarT(loc, 'Guardar', 'Guardar', 'Save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSpace(false)}
                    className="rounded-xl px-3 py-2 text-sm text-white/55"
                  >
                    {radarT(loc, 'Cancelar', 'Cancelar', 'Cancel')}
                  </button>
                </div>
              </div>
            )}
            {data.moduleId === 'agriculture' && !editingSpace && (
              <ParcelAssignCrop
                locale={loc}
                unit={focusedUnit}
                crops={data.crops || []}
                busy={busy}
                onSave={async (cropName) => {
                  await patch({ action: 'parcel_update', unitId: focusedId, crop: cropName });
                  await load();
                }}
              />
            )}
            <RadarFocusSheet
              companyId={companyId}
              engagementId={engagementId}
              propertyId={propertyId}
              locale={loc}
              moduleId={data.moduleId}
              units={data.units}
              sensors={data.sensors}
              focusedId={focusedId}
              latest={data.latestByUnit?.[focusedId] ?? null}
              hasValve={Boolean(data.devices?.some((d) => d.unitId === focusedId && d.sku === 'SVC01-LS2'))}
              onClose={() => {
                setFocusDetailOpen(false);
                setEditingSpace(false);
              }}
              onEditSpace={() => openEditSpace()}
            />
          </div>
        )}

      </div>
    </div>
  );
}
function ParcelAssignCrop({
  locale,
  unit,
  crops,
  busy,
  onSave,
}: {
  locale: Loc;
  unit?: { id: string; name: string; crop: string | null };
  crops: RadarCrop[];
  busy?: boolean;
  onSave: (crop: string) => Promise<void>;
}) {
  const [crop, setCrop] = useState(unit?.crop || '');
  useEffect(() => {
    setCrop(unit?.crop || '');
  }, [unit?.id, unit?.crop]);
  if (!unit) return null;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/15 bg-[#0c1a24] px-4 py-3">
      <div className="min-w-[10rem] flex-1">
        <p className="text-[10px] uppercase tracking-wide text-white/50">
          {locale === 'es' ? 'Cultivo en' : locale === 'en' ? 'Crop on' : 'Cultivo em'} {unit.name}
        </p>
        {crops.length > 0 ? (
          <select
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-500 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">{locale === 'es' ? 'Ninguno' : locale === 'en' ? 'None' : 'Nenhum'}</option>
            {crops.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/20 bg-[#07111A] px-3 py-2 text-sm text-white"
            placeholder={locale === 'en' ? 'Crop name' : 'Nome do cultivo'}
          />
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onSave(crop)}
        className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-[#04110c] disabled:opacity-40"
      >
        {locale === 'en' ? 'Assign' : 'Associar'}
      </button>
    </div>
  );
}
