'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';

export type ActiveCompanyOption = {
  id: string;
  shortName: string;
  name?: string;
  color?: string | null;
};

/**
 * Garante empresa ativa após login: carrega /api/companies e, se não houver
 * seleção válida, escolhe a primeira. Essencial no mobile.
 */
export function useEnsureActiveCompany() {
  const { status } = useSession();
  const { activeCompanyId, setActiveCompanyId } = useApp();
  const activeRef = useRef(activeCompanyId);
  activeRef.current = activeCompanyId;

  const [companies, setCompanies] = useState<ActiveCompanyOption[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    setHttpStatus(null);
    if (status === 'loading') {
      setReady(false);
      return;
    }
    if (status !== 'authenticated') {
      setCompanies([]);
      setReady(true);
      return;
    }
    setReady(false);
    try {
      const r = await fetch('/api/companies', { cache: 'no-store', credentials: 'include' });
      setHttpStatus(r.status);
      let d: { companies?: ActiveCompanyOption[]; error?: string } = {};
      try {
        d = (await r.json()) as typeof d;
      } catch {
        setError(`Resposta inválida (HTTP ${r.status})`);
        setCompanies([]);
        setReady(true);
        return;
      }
      if (!r.ok) {
        setError(typeof d?.error === 'string' ? d.error : `HTTP ${r.status}`);
        setCompanies([]);
        setReady(true);
        return;
      }
      const list = (Array.isArray(d.companies) ? d.companies : [])
        .map((c) => ({
          ...c,
          id: c?.id != null ? String(c.id).trim() : '',
          shortName: (c?.shortName || c?.name || '—').trim() || '—',
        }))
        .filter((c) => c.id.length > 0);

      setCompanies(list);

      if (list.length === 0) {
        // Não limpar seleção antiga se a API veio vazia por glitch — só limpar se explícito
        setReady(true);
        return;
      }

      const cur = activeRef.current;
      const curStr = cur == null ? '' : String(cur).trim();
      const match = list.find((c) => c.id === curStr);
      if (match) {
        if (curStr !== activeRef.current) setActiveCompanyId(match.id);
        else if (!isLikelyDbId(curStr)) setActiveCompanyId(match.id);
        setReady(true);
        return;
      }
      // Confiar no ID da API (não filtrar por isLikelyDbId — cuid/uuid vêm da BD)
      setActiveCompanyId(list[0]!.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setCompanies([]);
    } finally {
      setReady(true);
    }
  }, [setActiveCompanyId, status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Preferir empresa que exista na lista carregada; senão localStorage se ainda válido
  const fromList =
    activeCompanyId && companies.some((c) => c.id === String(activeCompanyId))
      ? String(activeCompanyId)
      : '';
  const fromStorage =
    !fromList && activeCompanyId && isLikelyDbId(activeCompanyId) ? String(activeCompanyId) : '';
  const companyId = fromList || fromStorage || '';

  const activeCompany = companies.find((c) => c.id === companyId) ?? null;

  return {
    companies,
    companiesReady: ready,
    companiesLoadError: error,
    companiesHttpStatus: httpStatus,
    companyId,
    activeCompany,
    reloadCompanies: reload,
    setActiveCompanyId,
  };
}
