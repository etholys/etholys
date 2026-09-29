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
import type { RadarOrgRole } from '@/lib/radar/org-role';
import {
  RADAR_CLIENT_ALL,
  parseRadarClientFromSearch,
  readRadarClientScope,
  writeRadarClientScope,
  type RadarClientScopeId,
} from '@/lib/radar/client-scope';

export type RadarClientOption = {
  id: string;
  name: string;
  contactName: string | null;
  propertyCount: number;
};

type RadarClientScopeValue = {
  companyId: string;
  engagementId: string | null;
  role: RadarOrgRole | null;
  roleLoading: boolean;
  clients: RadarClientOption[];
  clientsLoading: boolean;
  clientScope: RadarClientScopeId;
  selectedClientId: string | null;
  selectedClient: RadarClientOption | null;
  setClientScope: (scope: RadarClientScopeId) => void;
  refreshClients: () => Promise<void>;
  refreshRole: () => Promise<void>;
  createOpen: 'client' | 'property' | null;
  setCreateOpen: (v: 'client' | 'property' | null) => void;
  /** Bumps when clients/properties change so home lists refresh. */
  listRevision: number;
  bumpListRevision: () => void;
};

const Ctx = createContext<RadarClientScopeValue | null>(null);

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

  const [role, setRole] = useState<RadarOrgRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [clients, setClients] = useState<RadarClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientScope, setClientScopeState] = useState<RadarClientScopeId>(RADAR_CLIENT_ALL);
  const [createOpen, setCreateOpen] = useState<'client' | 'property' | null>(null);
  const [listRevision, setListRevision] = useState(0);
  const bumpListRevision = useCallback(() => setListRevision((n) => n + 1), []);

  const refreshRole = useCallback(async () => {
    if (!companyId) {
      setRole(null);
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    try {
      const q = new URLSearchParams({ companyId });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/radar/org-role?${q}`, { cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      setRole(r.ok && d.radarOrgRole ? d.radarOrgRole : null);
    } catch {
      setRole(null);
    } finally {
      setRoleLoading(false);
    }
  }, [companyId, engagementId]);

  const refreshClients = useCallback(async () => {
    if (!companyId || role !== 'provider') {
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
        })),
      );
    } catch {
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  }, [companyId, engagementId, role]);

  useEffect(() => {
    void refreshRole();
  }, [refreshRole]);

  useEffect(() => {
    void refreshClients();
  }, [refreshClients]);

  useEffect(() => {
    const fromUrl = parseRadarClientFromSearch(search);
    if (fromUrl) {
      setClientScopeState(fromUrl);
      if (companyId) writeRadarClientScope(companyId, fromUrl);
      return;
    }
    if (!companyId) {
      setClientScopeState(RADAR_CLIENT_ALL);
      return;
    }
    const stored = readRadarClientScope(companyId);
    setClientScopeState(stored || RADAR_CLIENT_ALL);
  }, [search, companyId]);

  useEffect(() => {
    const newParam = String(search.get('new') || '').trim();
    if (newParam === 'client') setCreateOpen('client');
    else if (newParam === 'property' || newParam === 'farm') setCreateOpen('property');
  }, [search]);

  const setClientScope = useCallback(
    (scope: RadarClientScopeId) => {
      setClientScopeState(scope);
      if (companyId) writeRadarClientScope(companyId, scope);
      const params = new URLSearchParams(search.toString());
      if (companyId) params.set('company', companyId);
      params.set('client', scope);
      params.delete('new');
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [companyId, pathname, router, search],
  );

  const selectedClientId = clientScope === RADAR_CLIENT_ALL ? null : clientScope;
  const selectedClient = useMemo(
    () => (selectedClientId ? clients.find((c) => c.id === selectedClientId) || null : null),
    [clients, selectedClientId],
  );

  const value = useMemo<RadarClientScopeValue>(
    () => ({
      companyId,
      engagementId,
      role,
      roleLoading,
      clients,
      clientsLoading,
      clientScope,
      selectedClientId,
      selectedClient,
      setClientScope,
      refreshClients,
      refreshRole,
      createOpen,
      setCreateOpen,
      listRevision,
      bumpListRevision,
    }),
    [
      companyId,
      engagementId,
      role,
      roleLoading,
      clients,
      clientsLoading,
      clientScope,
      selectedClientId,
      selectedClient,
      setClientScope,
      refreshClients,
      refreshRole,
      createOpen,
      listRevision,
      bumpListRevision,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
