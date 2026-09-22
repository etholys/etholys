'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { StateEmpty, StateLoading } from '@/components/ui/StateBlocks';
import { CandidateDetailSheet } from '@/components/opportunity/CandidateDetailSheet';
import type { ScanCandidate } from '@/lib/opportunity/scan-types';
import { ArrowLeft } from 'lucide-react';

function CandidatePreviewInner() {
  const params = useParams();
  const search = useSearchParams();
  const tempId = String(params.tempId ?? '');
  const runId = search.get('runId') ?? '';
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [candidate, setCandidate] = useState<ScanCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId || !runId || !tempId) {
      setLoading(false);
      setError('missing');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(
        `/api/opportunity/scans/${encodeURIComponent(runId)}?companyId=${encodeURIComponent(companyId)}`,
        { cache: 'no-store' },
      );
      const d = (await r.json()) as {
        pending?: ScanCandidate[];
        later?: ScanCandidate[];
        saved?: ScanCandidate[];
        discarded?: ScanCandidate[];
        error?: string;
      };
      if (!r.ok) throw new Error(d.error || 'Erro');
      const all = [
        ...(d.pending ?? []),
        ...(d.later ?? []),
        ...(d.saved ?? []),
        ...(d.discarded ?? []),
      ];
      const found = all.find((c) => c.tempId === tempId) ?? null;
      setCandidate(found);
      if (!found) setError('not_found');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, runId, tempId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!companyId) {
    return (
      <StateEmpty
        title={t('Empresa não seleccionada', 'Empresa no seleccionada', 'No company selected')}
        description={t('Escolha a empresa na barra lateral.', 'Elija la empresa.', 'Pick a company.')}
      />
    );
  }

  if (loading) return <StateLoading className="min-h-[50vh]" />;

  if (!candidate) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <p className="text-sm text-gray-600">
          {error === 'not_found'
            ? t('Candidato não encontrado nesta varredura.', 'Candidato no encontrado.', 'Candidate not found.')
            : error || t('Erro', 'Error', 'Error')}
        </p>
        <Link href="/hub/fundhub/discover" className="text-sm font-medium text-amber-700 hover:underline">
          ← OPPORTUNITY
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] bg-gray-50 p-4 md:p-8">
      <Link
        href="/hub/fundhub/discover"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('Voltar à descoberta', 'Volver al descubrimiento', 'Back to discover')}
      </Link>
      <CandidateDetailSheet
        candidate={candidate}
        runId={runId}
        open
        variant="page"
        onClose={() => {
          window.location.href = '/hub/fundhub/discover';
        }}
      />
    </div>
  );
}

export default function CandidatePreviewPage() {
  return (
    <Suspense fallback={<StateLoading className="min-h-[50vh]" />}>
      <CandidatePreviewInner />
    </Suspense>
  );
}
