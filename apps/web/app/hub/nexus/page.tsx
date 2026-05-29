'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/app/providers';
import { type VentureStageId } from '@/lib/nexus-venture';
import type { NexusQuickStep } from '@/lib/nexus-guides';
import { getNexusHomeSecondary } from '@/lib/nexus-home-secondary';
import { NexusCoachPanel } from '@/components/nexus/NexusCoachPanel';
import { NexusMirrorRail } from '@/components/nexus/NexusMirrorRail';
import { parseNexusAdvisorMirror, type NexusAdvisorMirrorState } from '@/lib/nexus-advisor-mirror';

type OverviewCompany = {
  mode: 'company';
  companyId: string;
  maturityScore: number;
  maturityLevel: 'initial' | 'developing' | 'structured' | 'advanced';
  metrics: {
    activeProjects: number;
    openServiceTickets: number;
    completedRoadmapActions: number;
    pendingRoadmapActions: number;
  };
  userContext?: {
    user: { id: string; name: string; email: string } | null;
    activeCompanyId: string;
    activeRole: string | null;
    inferredPersona: 'GESTOR' | 'TECNICO' | 'COLABORADOR';
    companyRoles: Array<{
      companyId: string;
      role: string;
      company: { id: string; name: string; shortName: string };
    }>;
  };
  recommendations: string[];
  ventureStage: VentureStageId;
  quickNextSteps: NexusQuickStep[];
  showNexusWelcome: boolean;
};

type OverviewNetwork = {
  mode: 'network';
  networkId: string;
  network: {
    id: string;
    name: string;
    kind: string;
    anchorCompany: { id: string; name: string; shortName: string };
    siepProject: { id: string; name: string; companyId: string } | null;
    members: Array<{
      id: string;
      companyId: string;
      memberRole: string;
      company: { id: string; name: string; shortName: string };
      siepProject: { id: string; name: string; companyId: string } | null;
    }>;
  };
  companyIds: string[];
  maturityScore: number;
  maturityLevel: 'initial' | 'developing' | 'structured' | 'advanced';
  metrics: {
    activeProjects: number;
    openServiceTickets: number;
    completedRoadmapActions: number;
    pendingRoadmapActions: number;
  };
  userContext?: {
    user: { id: string; name: string; email: string } | null;
    activeCompanyId: string;
    activeRole: string | null;
    inferredPersona: 'GESTOR' | 'TECNICO' | 'COLABORADOR';
    companyRoles: Array<{
      companyId: string;
      role: string;
      company: { id: string; name: string; shortName: string };
    }>;
  };
  recommendations: string[];
  ventureStage: VentureStageId;
  quickNextSteps: NexusQuickStep[];
  showNexusWelcome: boolean;
};

type NexusOverview = OverviewCompany | OverviewNetwork;

function pickStepText(
  locale: string,
  s: NexusQuickStep,
): { title: string; hint: string } {
  if (locale === 'es') return { title: s.titleEs, hint: s.hintEs };
  if (locale === 'en') return { title: s.titleEn, hint: s.hintEn };
  return { title: s.titlePt, hint: s.hintPt };
}

function NexusHomeInner() {
  const { locale } = useApp();
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');
  const s = getNexusHomeSecondary(locale);

  const [data, setData] = useState<NexusOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [advisorSessionId, setAdvisorSessionId] = useState<string | null>(null);
  const [advisorMirror, setAdvisorMirror] = useState<NexusAdvisorMirrorState | null>(null);

  const loadOverview = useCallback(
    async (opts?: { background?: boolean }) => {
      const errCopy = getNexusHomeSecondary(locale);
      if (!opts?.background) {
        setLoading(true);
        setMsg(null);
      }
      try {
        const qs = networkId ? `?networkId=${encodeURIComponent(networkId)}` : '';
        const r = await fetch(`/api/nexus/overview${qs}`);
        const d = await r.json();
        if (!r.ok) throw new Error((d as { error?: string }).error || errCopy.loadError);
        setData(d as NexusOverview);
        if (!opts?.background) setMsg(null);
      } catch (e) {
        if (!opts?.background) {
          setData(null);
          setMsg(e instanceof Error ? e.message : errCopy.loadError);
        }
      } finally {
        if (!opts?.background) setLoading(false);
      }
    },
    [networkId, locale],
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const refreshAdvisorMirror = useCallback(async () => {
    if (!advisorSessionId) {
      setAdvisorMirror(null);
      return;
    }
    try {
      const r = await fetch(`/api/nexus/copilot/${advisorSessionId}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' },
      });
      if (!r.ok) return;
      const j = (await r.json()) as { nexusMirror?: unknown };
      const raw = j.nexusMirror;
      setAdvisorMirror(raw ? parseNexusAdvisorMirror(raw) : null);
    } catch {
      setAdvisorMirror(null);
    }
  }, [advisorSessionId]);

  useEffect(() => {
    void refreshAdvisorMirror();
  }, [refreshAdvisorMirror]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadOverview({ background: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadOverview]);

  const net = data?.mode === 'network' ? data.network : null;
  const withNet = (href: string) => (networkId ? `${href}?network=${encodeURIComponent(networkId)}` : href);
  const loc = locale === 'es' || locale === 'en' || locale === 'pt' ? locale : 'pt';
  const adjustStageLabel =
    loc === 'es' ? 'Ajustar fase y metas' : loc === 'en' ? 'Adjust phase & goals' : 'Ajustar fase e metas';

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-600" />
        </div>
      ) : !data && msg ? (
        <div
          className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50/90 px-4 py-4 text-center text-sm text-red-900"
          role="alert"
        >
          <p className="font-medium">{msg}</p>
          <button
            type="button"
            onClick={() => void loadOverview()}
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            {s.retry}
          </button>
        </div>
      ) : data ? (
        <>
          {net && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
              <strong>{net.name}</strong> · {net.members.length} {s.netCompanies} · {s.netAnchor} {net.anchorCompany.shortName}
              {net.siepProject && (
                <>
                  {' '}
                  · {s.netSiep}: <span className="font-medium">{net.siepProject.name}</span>
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <section
              className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
              aria-label={locale === 'es' ? 'Copiloto' : locale === 'pt' ? 'Copiloto' : 'Co-pilot'}
            >
              <NexusCoachPanel
                embeddedOnHub
                dense
                onAdvisorSessionId={setAdvisorSessionId}
                onConversationActivity={refreshAdvisorMirror}
              />
            </section>
            <aside
              className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:min-h-0 lg:min-w-0 lg:flex-1 lg:overflow-y-auto lg:border-l lg:border-slate-200 lg:pl-8"
              aria-label={locale === 'es' ? 'Trilha y resultados' : locale === 'pt' ? 'Trilha e resultados' : 'Path & results'}
            >
              <div className="border-t border-slate-200 pt-6 lg:border-t-0 lg:pt-0">
                <NexusMirrorRail
                  withNet={withNet}
                  ventureStage={data.ventureStage}
                  quickNextSteps={data.quickNextSteps || []}
                  adjustStageLabel={adjustStageLabel}
                  pickStepText={pickStepText}
                  loc={loc}
                  advisorMirror={advisorMirror}
                />
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function NexusHomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-600" />
        </div>
      }
    >
      <NexusHomeInner />
    </Suspense>
  );
}
