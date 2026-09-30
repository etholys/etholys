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
import {
  RADAR_SCOPE_ALL,
  RADAR_SCOPE_OWN,
  parseRadarScopeFromSearch,
  readRadarScope,
  writeRadarScope,
  type RadarScopeId,
} from '@/lib/radar/client-scope';

export type RadarClientOption = {
  id: string;
  name: string;
  contactName: string | null;
  propertyCount: number;
  linkedCompanyId?: string | null;
};

type RadarScopeValue = {
  companyId: string;
  engagementId: string | null;
  clients: RadarClientOption[];
  clientsLoading: boolean;
  scope: RadarScopeId;
  /** @deprecated use scope */
  clientScope: RadarScopeId;
  selectedClientId: string | null;
  selectedClient: RadarClientOption | null;
  isOwnScope: boolean;
  isAllScope: boolean;
  setScope: (scope: RadarScopeId) => void;
  /** @deprecated use setScope */
  setClientScope: (scope: RadarScopeId) => void;
  refreshClients: () => Promise<void>;
  createOpen: 'client' | 'property' | null;
  setCreateOpen: (v: 'client' | 'property' | null) => void;
  listRevision: number;
  bumpListRevision: () => void;
  /** legacy no-ops so old callers don't crash */
  role: null;
  roleLoading: boolean;
  refreshRole: () => Promise<void>;
};

const Ctx = createContext<RadarScopeValue | null>(null);

export function useRadarClientScope() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRadarClientScope must be used inside RadarClientScopeProvider');
  return ctx;
}

export function useRadarClientScopeOptional() {
  return useContext(Ctx);
}

export function RadarClientScopeProvider({ children }: { children: ReactNode }) {
  const { activeCompanyId } = useApp();
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const companyId = String(search.get('company') || activeCompanyId || '').trim();
  const engagementId = String(search.get('engagement') || '').trim() || null;

  const [clients, setClients] = useState<RadarClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [scope, setScopeState] = useState<RadarScopeId>(RADAR_SCOPE_OWN);
  const [createOpen, setCreateOpen] = useState<'client' | 'property' | null>(null);
  const [listRevision, setListRevision] = useState(0);
  const bumpListRevision = useCallback(() => setListRevision((n) => n + 1), []);

  const refreshClients = useCallback(async () => {
    if (!companyId) {
      setClients([]);
      setClientsLoading(false);
      return;
    }
    setClientsLoading(true);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/clients?${q}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'clients');
      setClients(
        (d.clients || []).map((c: RadarClientOption) => ({
          id: c.id,
          name: c.name,
          contactName: c.contactName ?? null,
          propertyCount: c.propertyCount ?? 0,
          linkedCompanyId: c.linkedCompanyId ?? null,
        })),
      );
    } catch {
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  }, [companyId, engagementId]);

  useEffect(() => {
    void refreshClients();
  }, [refreshClients]);

  useEffect(() => {
    const fromUrl = parseRadarScopeFromSearch(search);
    if (fromUrl) {
      setScopeState(fromUrl);
      if (companyId) writeRadarScope(companyId, fromUrl);
      return;
    }
    if (!companyId) {
      setScopeState(RADAR_SCOPE_OWN);
      return;
    }
    const stored = readRadarScope(companyId);
    setScopeState(stored || RADAR_SCOPE_OWN);
  }, [search, companyId]);

  useEffect(() => {
    const newParam = String(search.get('new') || '').trim();
    if (newParam === 'client') setCreateOpen('client');
    else if (newParam === 'property' || newParam === 'farm') setCreateOpen('property');
  }, [search]);

  const setScope = useCallback(
    (next: RadarScopeId) => {
      setScopeState(next);
      if (companyId) writeRadarScope(companyId, next);
      const params = new URLSearchParams(search.toString());
      if (companyId) params.set('company', companyId);
      params.set('client', next);
      params.delete('new');
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [companyId, pathname, router, search],
  );

  const selectedClientId =
    scope === RADAR_SCOPE_ALL || scope === RADAR_SCOPE_OWN ? null : scope;
  const selectedClient = useMemo(
    () => (selectedClientId ? clients.find((c) => c.id === selectedClientId) || null : null),
    [clients, selectedClientId],
  );

  const value = useMemo<RadarScopeValue>(
    () => ({
      companyId,
      engagementId,
      clients,
      clientsLoading,
      scope,
      clientScope: scope,
      selectedClientId,
      selectedClient,
      isOwnScope: scope === RADAR_SCOPE_OWN,
      isAllScope: scope === RADAR_SCOPE_ALL,
      setScope,
      setClientScope: setScope,
      refreshClients,
      createOpen,
      setCreateOpen,
      listRevision,
      bumpListRevision,
      role: null,
      roleLoading: false,
      refreshRole: async () => undefined,
    }),
    [
      companyId,
      engagementId,
      clients,
      clientsLoading,
      scope,
      selectedClientId,
      selectedClient,
      setScope,
      refreshClients,
      createOpen,
      listRevision,
      bumpListRevision,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
