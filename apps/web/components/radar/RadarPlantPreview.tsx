'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { MOISTURE_THRESHOLD } from '@/lib/radar/agriculture';
import { RadarSiteMap, type MapParcel } from '@/components/radar/RadarSiteMap';

/** Read-only plant preview for the selected property on RADAR home. */
export function RadarPlantPreview({
  companyId,
  engagementId,
  propertyId,
  locale,
  moduleId,
  hero = false,
  operateHrefFor,
}: {
  companyId: string;
  engagementId?: string | null;
  propertyId: string;
  locale: string;
  moduleId?: string | null;
  /** Larger plant surface when home has a single site. */
  hero?: boolean;
  /** Click a space → open Operate focused on that unit. */
  operateHrefFor?: (unitId: string) => string;
}) {
  const router = useRouter();
  const [parcels, setParcels] = useState<MapParcel[]>([]);
  const [sensors, setSensors] = useState<Array<{ id: string; name: string; unitId: string | null; lastValue: number | null }>>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [lotCode, setLotCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams({ companyId });
        if (engagementId) q.set('engagementId', engagementId);
        const [propRes, lotsRes] = await Promise.all([
          fetch(`/api/radar/properties/${propertyId}?${q}`, { cache: 'no-store' }),
          fetch(`/api/radar/lots?${q}`, { cache: 'no-store' }),
        ]);
        const d = await propRes.json();
        const lotsData = await lotsRes.json().catch(() => ({}));
        if (cancelled || !propRes.ok) return;
        const units = (d.property?.units || []) as Array<{
          id: string;
          name: string;
          crop: string | null;
          areaHa: number | null;
          moisture?: number | null;
        }>;
        const mapped: MapParcel[] = units.map((u) => ({
          id: u.id,
          name: u.name,
          crop: u.crop,
          areaHa: u.areaHa,
          moisture: u.moisture ?? null,
          nextAction: u.moisture != null && u.moisture < MOISTURE_THRESHOLD ? 'irrigate' : 'ok',
          harvestBlocked: false,
          alerts: [],
        }));
        setParcels(mapped);
        setFocusedId(mapped[0]?.id || null);
        setSensors(
          (d.property?.sensors || []).map(
            (s: { id: string; name: string; unitId: string | null; lastValue?: number | null }) => ({
              id: s.id,
              name: s.name,
              unitId: s.unitId,
              lastValue: s.lastValue ?? null,
            }),
          ),
        );
        const open = (lotsData.lots || []).find((l: { status: string }) => l.status === 'open');
        setLotCode(open?.code || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, engagementId, propertyId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-300" />
      </div>
    );
  }

  if (parcels.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-[1.5rem] border border-dashed border-white/15 bg-[#0a1620] text-sm text-white/50 ${
          hero ? 'min-h-[22rem] md:min-h-[28rem]' : 'min-h-[12rem]'
        }`}
      >
        —
      </div>
    );
  }

  return (
    <RadarSiteMap
      companyId={companyId}
      engagementId={engagementId}
      propertyId={propertyId}
      locale={locale}
      moduleId={moduleId}
      mode="preview"
      parcels={parcels}
      sensors={sensors}
      focusedId={focusedId}
      onFocus={(id) => {
        setFocusedId(id);
        if (operateHrefFor) router.push(operateHrefFor(id));
      }}
      trailUnitIds={parcels.map((p) => p.id)}
      lotCode={lotCode}
      hero={hero}
    />
  );
}
