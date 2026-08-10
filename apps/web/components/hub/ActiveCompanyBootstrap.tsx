'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useApp } from '@/app/providers';

/**
 * Após login, resolve empresa ativa se localStorage estiver vazio/inválido.
 * Corre no shell global para Meet/Tools/Hub funcionarem no telemóvel sem
 * depender de ter visitado FORGE/NEXUS antes.
 */
export function ActiveCompanyBootstrap() {
  const { status } = useSession();
  const { activeCompanyId, setActiveCompanyId } = useApp();
  const activeRef = useRef(activeCompanyId);
  activeRef.current = activeCompanyId;
  const ranForUser = useRef(false);

  const ensure = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      const r = await fetch('/api/companies', { cache: 'no-store', credentials: 'include' });
      if (!r.ok) return;
      const d = (await r.json()) as { companies?: { id?: string }[] };
      const list = (Array.isArray(d.companies) ? d.companies : [])
        .map((c) => (c?.id != null ? String(c.id).trim() : ''))
        .filter((id) => id.length > 0);
      if (list.length === 0) return;
      const cur = activeRef.current;
      const curStr = cur == null ? '' : String(cur).trim();
      if (curStr && list.includes(curStr)) return;
      setActiveCompanyId(list[0]!);
    } catch {
      /* silencioso — páginas com picker tratam o erro */
    }
  }, [setActiveCompanyId, status]);

  useEffect(() => {
    if (status !== 'authenticated') {
      ranForUser.current = false;
      return;
    }
    if (ranForUser.current) return;
    ranForUser.current = true;
    void ensure();
  }, [status, ensure]);

  return null;
}
