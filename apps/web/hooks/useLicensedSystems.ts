'use client';

import { useCallback, useEffect, useState } from 'react';
import { parseSystemsJson, type WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';
import { isLikelyDbId } from '@/lib/utils';

type AccessResponse = {
  canManage?: boolean;
  me?: { enabled?: boolean; systems?: unknown } | null;
  error?: string;
};

/**
 * Sistemas licenciados para a empresa activa.
 * `null` = ainda não filtrar / sem grant (mostrar todos — compatibilidade).
 */
export function useLicensedSystems(activeCompanyId: string | null | undefined) {
  const [licensedSystems, setLicensedSystems] = useState<WorkspaceSystemKey[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(false);

  const companyId = activeCompanyId && isLikelyDbId(activeCompanyId) ? activeCompanyId : '';

  const refresh = useCallback(async () => {
    if (!companyId) {
      setLicensedSystems(null);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/workspace/access?companyId=${encodeURIComponent(companyId)}`, {
        cache: 'no-store',
      });
      const data = (await r.json()) as AccessResponse;
      if (!r.ok) {
        setLicensedSystems(null);
        setCanManage(false);
        return;
      }
      setCanManage(data.canManage === true);
      const me = data.me;
      if (me?.enabled && me.systems) {
        const parsed = parseSystemsJson(me.systems);
        if (parsed.length > 0) {
          setLicensedSystems(parsed);
          return;
        }
      }
      setLicensedSystems(null);
    } catch {
      setLicensedSystems(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const licensedCount = licensedSystems?.length ?? null;

  const showIntegratedWorkspace =
    licensedSystems === null || licensedSystems.length >= 2 || canManage;

  return { licensedSystems, licensedCount, canManage, showIntegratedWorkspace, loading, refresh };
}
