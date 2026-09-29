'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/app/providers';
import type { AuroraPortfolioItem } from '@/lib/aurora-portfolio';
import {
  auroraToolHref,
  parseAuroraAttendedFromSearch,
  readAuroraAttendedSelection,
  writeAuroraAttendedSelection,
  type AuroraAttendedRef,
} from '@/lib/aurora-attended-selection';

type AuroraAttendedContextValue = {
  operatorCompanyId: string;
  selection: AuroraAttendedRef | null;
  setSelection: (ref: AuroraAttendedRef | null) => void;
  options: AuroraPortfolioItem[];
  canManage: boolean;
  technicians: Array<{ userId: string; name: string }>;
  loading: boolean;
  refresh: () => Promise<void>;
  diagnosticHref: string;
  dossierHref: string;
  hasSelection: boolean;
};

const AuroraAttendedContext = createContext<AuroraAttendedContextValue | null>(null);

export function useAuroraAttended() {
  const ctx = useContext(AuroraAttendedContext);
  if (!ctx) throw new Error('useAuroraAttended must be used inside AuroraAttendedProvider');
  return ctx;
}

export function useAuroraAttendedOptional() {
  return useContext(AuroraAttendedContext);
}

export function AuroraAttendedProvider({ children }: { children: ReactNode }) {
  const { activeCompanyId } = useApp();
  const operatorCompanyId = String(activeCompanyId || '').trim();
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [options, setOptions] = useState<AuroraPortfolioItem[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [technicians, setTechnicians] = useState<Array<{ userId: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelectionState] = useState<AuroraAttendedRef | null>(null);

  const refresh = useCallback(async () => {
    if (!operatorCompanyId) {
      setOptions([]);
      setCanManage(false);
      setTechnicians([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ operatorCompanyId });
      const res = await fetch(`/api/business-dossier/portfolio?${q}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'portfolio');
      const rows = Array.isArray(data.businesses) ? (data.businesses as AuroraPortfolioItem[]) : [];
      setOptions(rows);
      setCanManage(Boolean(data.canManage));
      setTechnicians(Array.isArray(data.technicians) ? data.technicians : []);
    } catch {
      setOptions([]);
      setCanManage(false);
      setTechnicians([]);
    } finally {
      setLoading(false);
    }
  }, [operatorCompanyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!operatorCompanyId) {
      setSelectionState(null);
      return;
    }
    const fromUrl = parseAuroraAttendedFromSearch(search);
    if (fromUrl) {
      const match = options.find(
        (o) => o.companyId === fromUrl.companyId && o.engagementId === fromUrl.engagementId,
      );
      const next: AuroraAttendedRef = {
        ...fromUrl,
        name: match?.name || fromUrl.name,
        engagementTitle: match?.engagementTitle || fromUrl.engagementTitle,
      };
      setSelectionState(next);
      writeAuroraAttendedSelection(operatorCompanyId, next);
      return;
    }
    const stored = readAuroraAttendedSelection(operatorCompanyId);
    if (!stored) {
      setSelectionState(null);
      return;
    }
    const stillVisible = options.some(
      (o) => o.companyId === stored.companyId && o.engagementId === stored.engagementId,
    );
    if (options.length > 0 && !stillVisible) {
      writeAuroraAttendedSelection(operatorCompanyId, null);
      setSelectionState(null);
      return;
    }
    const match = options.find(
      (o) => o.companyId === stored.companyId && o.engagementId === stored.engagementId,
    );
    setSelectionState(
      match
        ? {
            companyId: match.companyId,
            engagementId: match.engagementId,
            name: match.name,
            engagementTitle: match.engagementTitle,
          }
        : stored,
    );
  }, [operatorCompanyId, search, options]);

  const setSelection = useCallback(
    (ref: AuroraAttendedRef | null) => {
      if (!operatorCompanyId) return;
      writeAuroraAttendedSelection(operatorCompanyId, ref);
      setSelectionState(ref);
      const onTool =
        pathname?.startsWith('/hub/aurora/diagnostico') || pathname?.startsWith('/hub/aurora/dossie');
      if (onTool) {
        if (!ref) {
          router.push('/hub/aurora');
          return;
        }
        const target = pathname.startsWith('/hub/aurora/dossie')
          ? auroraToolHref('/hub/aurora/dossie', ref)
          : auroraToolHref('/hub/aurora/diagnostico', ref);
        router.replace(target);
      }
    },
    [operatorCompanyId, pathname, router],
  );

  const value = useMemo<AuroraAttendedContextValue>(
    () => ({
      operatorCompanyId,
      selection,
      setSelection,
      options,
      canManage,
      technicians,
      loading,
      refresh,
      diagnosticHref: auroraToolHref('/hub/aurora/diagnostico', selection),
      dossierHref: auroraToolHref('/hub/aurora/dossie', selection),
      hasSelection: Boolean(selection?.companyId && selection.engagementId),
    }),
    [operatorCompanyId, selection, setSelection, options, canManage, technicians, loading, refresh],
  );

  return <AuroraAttendedContext.Provider value={value}>{children}</AuroraAttendedContext.Provider>;
}
