'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { RadarSiteMap, type MapParcel } from '@/components/radar/RadarSiteMap';

/** Read-only plant preview for the selected property on RADAR home. */
export function RadarPlantPreview({
  companyId,
  engagementId,
  propertyId,
  locale,
  moduleId,
}: {
  companyId: string;
  engagementId?: string | null;
  propertyId: string;
  locale: string;
  moduleId?: string | null;
}) {
  const [parcels, setParcels] = useState<MapParcel[]>([]);
  const [sensors, setSensors] = useState<Array<{ id: string; name: string; unitId: string | null; lastValue: number | null }>>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams({ companyId });
        if (engagementId) q.set('engagementId', engagementId);
        const r = await fetch(`/api/radar/properties/${propertyId}?${q}`, { cache: 'no-store' });
        const d = await r.json();
        if (cancelled || !r.ok) return;
        const units = (d.property?.units || []) as Array<{
          id: string;
          name: string;
          crop: string | null;
          areaHa: number | null;
        }>;
        const mapped: MapParcel[] = units.map((u) => ({
          id: u.id,
          name: u.name,
          crop: u.crop,
          areaHa: u.areaHa,
          moisture: null,
          nextAction: 'ok',
          harvestBlocked: false,
          alerts: [],
        }));
        setParcels(mapped);
        setFocusedId(mapped[0]?.id || null);
        setSensors(
          (d.property?.sensors || []).map((s: { id: string; name: string; unitId: string | null }) => ({
            id: s.id,
            name: s.name,
            unitId: s.unitId,
            lastValue: null,
          })),
        );
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

  if (parcels.length === 0) return null;

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
      onFocus={setFocusedId}
      trailUnitIds={parcels.map((p) => p.id)}
    />
  );
}
