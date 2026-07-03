'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { useSession } from 'next-auth/react';
import { WORKSPACE_SYSTEM_KEYS, type WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';
import { isLikelyDbId } from '@/lib/utils';
import { StateLoading } from '@/components/ui/StateBlocks';
import { ArrowRight, LayoutGrid, Shield, User } from 'lucide-react';

type Grant = { userId: string; email: string; name: string; systems: string[]; enabled: boolean };

const SYSTEM_COLORS: Record<WorkspaceSystemKey, string> = {
  ATLAS: 'bg-teal-100 text-teal-800',
  SIEP: 'bg-indigo-100 text-indigo-800',
  FUNDHUB: 'bg-amber-100 text-amber-800',
  NEXUS: 'bg-violet-100 text-violet-800',
  FORGE: 'bg-blue-100 text-blue-800',
  PRISM: 'bg-rose-100 text-rose-800',
};

export function LicenseOverviewPanel() {
  const { locale, activeCompanyId } = useApp();
  const { data: session } = useSession();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [mySystems, setMySystems] = useState<WorkspaceSystemKey[] | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const meId = (session?.user as { id?: string } | undefined)?.id;

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setMySystems(null);
      setGrants([]);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/workspace/access?companyId=${encodeURIComponent(companyId)}`, {
        cache: 'no-store',
      });
      const d = (await r.json()) as {
        canManage?: boolean;
        me?: { enabled?: boolean; systems?: WorkspaceSystemKey[] } | null;
        grants?: Grant[];
        error?: string;
      };
      if (!r.ok) {
        setErr(d.error || 'Erro');
        return;
      }
      setCanManage(d.canManage === true);
      const me = d.me;
      if (me?.enabled && Array.isArray(me.systems) && me.systems.length > 0) {
        setMySystems(me.systems);
      } else {
        setMySystems(null);
      }
      setGrants(Array.isArray(d.grants) ? d.grants : []);
    } catch {
      setErr(t('Falha ao carregar licenças.', 'Error al cargar licencias.', 'Failed to load licenses.'));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
        {t(
          'Selecione uma empresa no Hub ou num módulo para ver as licenças de sistemas.',
          'Seleccione una empresa en el Hub o en un módulo para ver las licencias.',
          'Select a company in the Hub or a module to see system licenses.',
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <StateLoading />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <LayoutGrid className="h-4 w-4 text-slate-700" />
            {t('Licenças de sistemas', 'Licencias de sistemas', 'System licenses')}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t(
              'Resumo por empresa activa. Sem linha na lista = acesso total (compatibilidade).',
              'Resumen por empresa activa. Sin fila en la lista = acceso total (compatibilidad).',
              'Summary for active company. No row in the list = full access (compatibility).',
            )}
          </p>
        </div>
        <Link
          href="/hub/workspace/team"
          className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
        >
          {t('Gerir equipa', 'Gestionar equipo', 'Manage team')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}

      <div className="mb-5 rounded-lg border border-slate-100 bg-slate-50/80 p-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <User className="h-3.5 w-3.5" />
          {t('O seu acesso', 'Su acceso', 'Your access')}
        </p>
        {mySystems ? (
          <div className="flex flex-wrap gap-2">
            {mySystems.map((key) => (
              <span key={key} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${SYSTEM_COLORS[key]}`}>
                {key}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-700">
            {t(
              'Todos os sistemas (ainda sem restrição configurada para si).',
              'Todos los sistemas (aún sin restricción configurada para usted).',
              'All systems (no restriction configured for you yet).',
            )}
          </p>
        )}
      </div>

      {canManage ? (
        <div>
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Shield className="h-3.5 w-3.5" />
            {t('Utilizadores com grant', 'Usuarios con grant', 'Users with grants')}
            <span className="font-normal normal-case text-slate-400">({grants.length})</span>
          </p>
          {grants.length === 0 ? (
            <p className="text-sm text-slate-600">
              {t(
                'Nenhum grant explícito — todos entram por compatibilidade até configurar em Equipa.',
                'Ningún grant explícito — todos entran por compatibilidad hasta configurar en Equipo.',
                'No explicit grants — everyone has full access until you configure Team.',
              )}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">{t('Utilizador', 'Usuario', 'User')}</th>
                    <th className="px-3 py-2">{t('Sistemas', 'Sistemas', 'Systems')}</th>
                    <th className="px-3 py-2">{t('Estado', 'Estado', 'Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {grants.map((g) => (
                    <tr key={g.userId} className={g.userId === meId ? 'bg-slate-50/60' : undefined}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900">{g.name || g.email}</p>
                        <p className="text-xs text-slate-500">{g.email}</p>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(g.systems.length ? g.systems : WORKSPACE_SYSTEM_KEYS).map((key) => (
                            <span
                              key={`${g.userId}-${key}`}
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                SYSTEM_COLORS[key as WorkspaceSystemKey] ?? 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {key}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            g.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {g.enabled
                            ? t('Activo', 'Activo', 'Active')
                            : t('Desactivado', 'Desactivado', 'Disabled')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          {t(
            'Apenas administradores da empresa veem a lista completa de grants.',
            'Solo administradores de la empresa ven la lista completa de grants.',
            'Only company admins see the full grants list.',
          )}
        </p>
      )}
    </div>
  );
}
