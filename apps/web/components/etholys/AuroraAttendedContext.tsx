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
import type { AuroraViewerRole } from '@/lib/aurora-role';
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
  avanceHref: string;
  hasSelection: boolean;
  /** incubadora = técnico; attended = negócio externo a ver o próprio avanço */
  viewerRole: AuroraViewerRole;
  isAttendedViewer: boolean;
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
  const [viewerRole, setViewerRole] = useState<AuroraViewerRole>('incubator');

  const refresh = useCallback(async () => {
    if (!operatorCompanyId) {
      setOptions([]);
      setCanManage(false);
      setTechnicians([]);
      setViewerRole('incubator');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const roleRes = await fetch(
        `/api/business-dossier/aurora-role?companyId=${encodeURIComponent(operatorCompanyId)}`,
        { cache: 'no-store' },
      );
      const roleData = await roleRes.json().catch(() => ({}));
      const role: AuroraViewerRole = roleData.role === 'attended' ? 'attended' : 'incubator';
      setViewerRole(role);

      if (role === 'attended' && roleData.self?.companyId && roleData.self?.engagementId) {
        const selfRef: AuroraAttendedRef = {
          companyId: String(roleData.self.companyId),
          engagementId: String(roleData.self.engagementId),
          name: String(roleData.self.companyName || ''),
          engagementTitle: String(roleData.self.engagementTitle || ''),
        };
        setSelectionState(selfRef);
        writeAuroraAttendedSelection(operatorCompanyId, selfRef);
        setOptions([]);
        setCanManage(false);
        setTechnicians([]);
        return;
      }

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
      setViewerRole('incubator');
    } finally {
      setLoading(false);
    }
  }, [operatorCompanyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!operatorCompanyId || viewerRole === 'attended') return;
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
  }, [operatorCompanyId, search, options, viewerRole]);

  const setSelection = useCallback(
    (ref: AuroraAttendedRef | null) => {
      if (!operatorCompanyId || viewerRole === 'attended') return;
      writeAuroraAttendedSelection(operatorCompanyId, ref);
      setSelectionState(ref);
      const onTool =
        pathname?.startsWith('/hub/aurora/diagnostico') ||
        pathname?.startsWith('/hub/aurora/dossie') ||
        pathname?.startsWith('/hub/aurora/avance');
      if (onTool) {
        if (!ref) {
          router.push('/hub/aurora');
          return;
        }
        if (pathname.startsWith('/hub/aurora/dossie')) {
          router.replace(auroraToolHref('/hub/aurora/dossie', ref));
        } else if (pathname.startsWith('/hub/aurora/avance')) {
          const q = new URLSearchParams({ company: ref.companyId, engagement: ref.engagementId });
          router.replace(`/hub/aurora/avance?${q}`);
        } else {
          router.replace(auroraToolHref('/hub/aurora/diagnostico', ref));
        }
      }
    },
    [operatorCompanyId, pathname, router, viewerRole],
  );

  const avanceHref = useMemo(() => {
    if (!selection?.companyId || !selection.engagementId) return '/hub/aurora';
    const q = new URLSearchParams({ company: selection.companyId, engagement: selection.engagementId });
    return `/hub/aurora/avance?${q}`;
  }, [selection]);

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
      avanceHref,
      hasSelection: Boolean(selection?.companyId && selection.engagementId),
      viewerRole,
      isAttendedViewer: viewerRole === 'attended',
    }),
    [
      operatorCompanyId,
      selection,
      setSelection,
      options,
      canManage,
      technicians,
      loading,
      refresh,
      avanceHref,
      viewerRole,
    ],
  );

  return <AuroraAttendedContext.Provider value={value}>{children}</AuroraAttendedContext.Provider>;
}
