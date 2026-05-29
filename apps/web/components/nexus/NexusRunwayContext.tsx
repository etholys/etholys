'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSearchParams } from 'next/navigation';
import {
  type RunwayMetrics,
  type RunwayTouch,
  continueChapterHref,
  emptyTouch,
  readRunwayTouch,
  runwayProgress,
} from '@/lib/nexus-runway';

type OverviewShape = {
  metrics?: RunwayMetrics;
  error?: string;
};

type NexusRunwayValue = {
  touch: RunwayTouch;
  metrics: RunwayMetrics | null;
  loading: boolean;
  continueHref: string;
  percent: number;
  done: number;
  total: number;
  refreshTouch: () => void;
  refreshOverview: () => void;
};

const NexusRunwayContext = createContext<NexusRunwayValue | null>(null);

export function NexusRunwayProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');

  const [touch, setTouch] = useState<RunwayTouch>(emptyTouch);
  const [metrics, setMetrics] = useState<RunwayMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshTouch = useCallback(() => {
    setTouch(readRunwayTouch());
  }, []);

  const refreshOverview = useCallback(() => {
    const qs = networkId ? `?networkId=${encodeURIComponent(networkId)}` : '';
    fetch(`/api/nexus/overview${qs}`)
      .then((r) => r.json() as Promise<OverviewShape>)
      .then((d) => {
        if (d.metrics) {
          setMetrics({
            pendingRoadmapActions: d.metrics.pendingRoadmapActions,
            completedRoadmapActions: d.metrics.completedRoadmapActions,
            openServiceTickets: d.metrics.openServiceTickets,
          });
        } else {
          setMetrics(null);
        }
      })
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, [networkId]);

  useEffect(() => {
    setLoading(true);
    refreshTouch();
    refreshOverview();
  }, [networkId, refreshOverview, refreshTouch]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nexusRunwayV1') refreshTouch();
    };
    const onLocal = () => refreshTouch();
    window.addEventListener('storage', onStorage);
    window.addEventListener('nexus-runway-update', onLocal);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('nexus-runway-update', onLocal);
    };
  }, [refreshTouch]);

  const value = useMemo<NexusRunwayValue>(() => {
    const { done, total, percent } = runwayProgress(touch, metrics);
    return {
      touch,
      metrics,
      loading,
      continueHref: continueChapterHref(touch, metrics, networkId),
      percent,
      done,
      total,
      refreshTouch,
      refreshOverview,
    };
  }, [touch, metrics, loading, networkId, refreshTouch, refreshOverview]);

  return <NexusRunwayContext.Provider value={value}>{children}</NexusRunwayContext.Provider>;
}

export function useNexusRunway() {
  const v = useContext(NexusRunwayContext);
  if (!v) throw new Error('useNexusRunway must be used within NexusRunwayProvider');
  return v;
}
