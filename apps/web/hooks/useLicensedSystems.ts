'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';

export type UserAccessScope = 'loading' | 'full' | 'systems' | 'none';

export function useLicensedSystems(companyId: string | null) {
  const [licensedSystems, setLicensedSystems] = useState<WorkspaceSystemKey[] | null>(null);
  const [companyLicensedSystems, setCompanyLicensedSystems] = useState<WorkspaceSystemKey[] | null>(null);
  const [addOnCodes, setAddOnCodes] = useState<string[]>([]);
  const [billingEnforced, setBillingEnforced] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [accessScope, setAccessScope] = useState<UserAccessScope>('loading');
  const [showIntegratedWorkspace, setShowIntegratedWorkspace] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setLicensedSystems(null);
      setCompanyLicensedSystems(null);
      setAddOnCodes([]);
      setBillingEnforced(false);
      setCanManage(false);
      setAccessScope('none');
      setShowIntegratedWorkspace(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setAccessScope('loading');
    try {
      const res = await fetch(`/api/workspace/access?companyId=${encodeURIComponent(companyId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setLicensedSystems([]);
        setCompanyLicensedSystems([]);
        setAddOnCodes([]);
        setBillingEnforced(false);
        setCanManage(false);
        setAccessScope('none');
        setShowIntegratedWorkspace(false);
        return;
      }
      const data = (await res.json()) as {
        canManage?: boolean;
        me?: { enabled?: boolean; systems?: WorkspaceSystemKey[] } | null;
        companyLicensedSystems?: WorkspaceSystemKey[] | null;
        addOnCodes?: string[] | null;
        billing?: { enforced?: boolean };
      };
      const manage = data.canManage === true;
      setCanManage(manage);
      setCompanyLicensedSystems(data.companyLicensedSystems ?? null);
      setAddOnCodes(Array.isArray(data.addOnCodes) ? data.addOnCodes : []);
      setBillingEnforced(data.billing?.enforced === true);

      if (manage) {
        setLicensedSystems(data.companyLicensedSystems ?? null);
        setAccessScope('full');
        setShowIntegratedWorkspace(true);
        return;
      }

      const me = data.me;
      if (!me || me.enabled === false) {
        setLicensedSystems([]);
        setAccessScope('none');
        setShowIntegratedWorkspace(false);
        return;
      }

      const systems = Array.isArray(me.systems) ? me.systems : [];
      if (systems.length === 0) {
        setLicensedSystems([]);
        setAccessScope('none');
        setShowIntegratedWorkspace(false);
        return;
      }

      setLicensedSystems(systems);
      setAccessScope('systems');
      setShowIntegratedWorkspace(systems.length > 0);
    } catch {
      setLicensedSystems([]);
      setCompanyLicensedSystems([]);
      setAddOnCodes([]);
      setBillingEnforced(false);
      setCanManage(false);
      setAccessScope('none');
      setShowIntegratedWorkspace(false);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    licensedSystems,
    companyLicensedSystems,
    addOnCodes,
    billingEnforced,
    canManage,
    accessScope,
    showIntegratedWorkspace,
    loading,
    refresh,
  };
}
