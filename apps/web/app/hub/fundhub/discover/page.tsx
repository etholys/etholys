'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { StateEmpty, StateLoading } from '@/components/ui/StateBlocks';
import { CandidateDetailSheet } from '@/components/opportunity/CandidateDetailSheet';
import { DeadlineAlertsPanel } from '@/components/opportunity/DeadlineAlertsPanel';
import { KnownFundsPanel } from '@/components/opportunity/KnownFundsPanel';
import {
  estimateScanPercent,
  ScanProgressRing,
} from '@/components/opportunity/ScanProgressRing';
import { SearchCoachingPanel } from '@/components/opportunity/SearchCoachingPanel';
import {
  availabilityBadgeClass,
  availabilityLabel,
  formatDateShort,
} from '@/lib/opportunity/availability';
import type { AvailabilityStatus, ScanFocus } from '@/lib/opportunity/scan-types';
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Database,
  ExternalLink,
  History,
  MapPin,
  MessageSquare,
  Radar,
  Search,
  Settings2,
  X,
} from 'lucide-react';

type OpportunityKind = 'grant' | 'credit' | 'alliance' | 'local_expert';

type Briefing = {
  themes: string[];
  countries: string[];
  kinds: OpportunityKind[];
  amountMin?: number;
  amountMax?: number;
  notes?: string;
  searchFeedback?: string;
  scanName?: string;
  classifications?: Array<'direct' | 'client_bridge' | 'joint'>;
  privateEligible?: boolean;
  reimbursable?: boolean;
};

type ScanCandidate = {
  tempId: string;
  name: string;
  institution: string;
  type: string;
  category?: string;
  description?: string;
  whoCanApply?: string;
  eligibility?: string;
  requirements?: string;
  howToApply?: string;
  risksCaveats?: string;
  linkOficial?: string;
  amount?: number;
  currency?: string;
  deadline?: string | null;
  countries?: string;
  matchScore?: number;
  matchJustification?: string;
  availabilityStatus?: AvailabilityStatus;
  opensAt?: string | null;
  closesAt?: string | null;
  applicationWindow?: string;
  eligibleCountries?: string;
  availabilityNote?: string;
  scanFocus?: ScanFocus;
  classification?: 'direct' | 'client_bridge' | 'joint';
  classificationNote?: string;
};

type CatalogFund = ScanCandidate & {
  id: string;
  status: string;
  userStatus?: { status: string } | null;
};

type ScanMeta = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string | null;
  scanned: number;
  created: number;
  errorCount: number;
  discoveryMode?: 'web' | 'knowledge' | null;
  searchQueries?: string[];
  scanFocus?: ScanFocus | null;
};

const KIND_OPTIONS: { id: OpportunityKind; pt: string; es: string }[] = [
  { id: 'grant', pt: 'Grant / edital', es: 'Grant / convocatoria' },
  { id: 'credit', pt: 'Crédito', es: 'Crédito' },
  { id: 'alliance', pt: 'Aliança', es: 'Alianza' },
  { id: 'local_expert', pt: 'Técnico local', es: 'Técnico local' },
];

export default function OpportunityDiscoverPage() {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [tab, setTab] = useState<'new' | 'catalog' | 'later'>('new');
  const [discoveryFocus, setDiscoveryFocus] = useState<ScanFocus>('open_now');
  const [briefing, setBriefing] = useState<Briefing>({
    themes: [],
    countries: [],
    kinds: ['grant', 'credit', 'alliance'],
  });
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [themesInput, setThemesInput] = useState('');
  const [countriesInput, setCountriesInput] = useState('');
  const [notesInput, setNotesInput] = useState('');

  const [latest, setLatest] = useState<ScanMeta | null>(null);
  const [recentRuns, setRecentRuns] = useState<ScanMeta[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState<ScanCandidate[]>([]);
  const [pendingReference, setPendingReference] = useState<ScanCandidate[]>([]);
  const [later, setLater] = useState<ScanCandidate[]>([]);
  const [catalog, setCatalog] = useState<CatalogFund[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanPercent, setScanPercent] = useState(0);
  const [scanUi, setScanUi] = useState<'idle' | 'running' | 'error' | 'done'>('idle');
  const [lastScanArgs, setLastScanArgs] = useState<{
    focus: ScanFocus;
    briefing?: Briefing;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScanCandidate | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'analyze'>('overview');

  const openDetail = (c: ScanCandidate, tab: 'overview' | 'analyze' = 'overview') => {
    setDetailTab(tab);
    setDetail(c);
  };

  const q = (path: string) =>
    `${path}${path.includes('?') ? '&' : '?'}companyId=${encodeURIComponent(companyId)}`;

  const loadBriefing = useCallback(async () => {
    const r = await fetch(q('/api/opportunity/briefing'), { cache: 'no-store' });
    if (!r.ok) return;
    const d = (await r.json()) as { briefing?: Briefing };
    if (d.briefing) {
      setBriefing(d.briefing);
      setThemesInput(d.briefing.themes.join(', '));
      setCountriesInput(d.briefing.countries.join(', '));
      setNotesInput(d.briefing.notes ?? '');
    }
  }, [companyId]);

  const loadScan = useCallback(async () => {
    const r = await fetch(q('/api/opportunity/scans'), { cache: 'no-store' });
    if (!r.ok) return;
    const d = (await r.json()) as {
      latest?: ScanMeta | null;
      pendingOpen?: ScanCandidate[];
      pendingReference?: ScanCandidate[];
      later?: ScanCandidate[];
      recentRuns?: ScanMeta[];
    };
    setLatest(d.latest ?? null);
    setRecentRuns(d.recentRuns ?? []);
    setPendingOpen(d.pendingOpen ?? []);
    setPendingReference(d.pendingReference ?? []);
    if (d.latest?.scanFocus) setDiscoveryFocus(d.latest.scanFocus);
    setLater(d.later ?? []);
  }, [companyId]);

  const pendingForFocus = discoveryFocus === 'open_now' ? pendingOpen : pendingReference;

  const loadCatalog = useCallback(async () => {
    const r = await fetch(q('/api/opportunity/catalog'), { cache: 'no-store' });
    if (!r.ok) return;
    const d = (await r.json()) as { funds?: CatalogFund[]; pagination?: { total: number } };
    setCatalog(d.funds ?? []);
    setCatalogTotal(d.pagination?.total ?? 0);
  }, [companyId]);

  const loadAll = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    await Promise.all([loadBriefing(), loadScan(), loadCatalog()]);
    setLoading(false);
  }, [companyId, loadBriefing, loadScan, loadCatalog]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveBriefing = async () => {
    const payload: Briefing = {
      ...briefing,
      themes: themesInput.split(',').map((s) => s.trim()).filter(Boolean),
      countries: countriesInput.split(',').map((s) => s.trim()).filter(Boolean),
      notes: notesInput.trim() || undefined,
    };
    const r = await fetch(q('/api/opportunity/briefing'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ briefing: payload }),
    });
    if (r.ok) {
      setBriefing(payload);
      setBriefingOpen(false);
      setMsg(t('Briefing guardado.', 'Briefing guardado.', 'Briefing saved.'));
    }
  };

  const startScan = async (
    focus: ScanFocus = discoveryFocus,
    briefingOverride?: Briefing,
  ) => {
    setScanning(true);
    setScanUi('running');
    setScanPercent(3);
    setMsg(null);
    setDiscoveryFocus(focus);
    const briefingToUse = briefingOverride ?? briefing;
    setLastScanArgs({ focus, briefing: briefingOverride });
    const startedAt = Date.now();
    try {
      const r = await fetch(q('/api/opportunity/scans'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefing: briefingToUse, scanFocus: focus }),
      });
      const raw = await r.text();
      let d: {
        error?: string;
        runId?: string;
        status?: string;
        created?: number;
        discoveryMode?: string;
        searchQueries?: string[];
        scanned?: number;
      } = {};
      try {
        d = JSON.parse(raw) as typeof d;
      } catch {
        throw new Error(
          t(
            'O servidor interrompeu a varredura (timeout). Tente de novo — agora a pesquisa corre em segundo plano.',
            'El servidor interrumpió el barrido (timeout). Intente de nuevo.',
            'Server interrupted the scan (timeout). Please try again.',
          ),
        );
      }
      if (!r.ok && r.status !== 409) throw new Error(d.error || 'Erro');
      const runId = d.runId;
      if (!runId) throw new Error(d.error || 'Sem runId');

      setMsg(
        t(
          'Varredura em curso… pode demorar 1–3 minutos.',
          'Barrido en curso… puede tardar 1–3 minutos.',
          'Scan in progress… may take 1–3 minutes.',
        ),
      );
      setLatest({
        id: runId,
        status: 'running',
        startedAt: new Date().toISOString(),
        scanned: 0,
        created: 0,
        errorCount: 0,
        scanFocus: focus,
      });
      setScanPercent(8);

      // Poll até completed / failed
      let attempts = 0;
      while (attempts < 90) {
        await new Promise((res) => setTimeout(res, 2000));
        attempts += 1;
        const pr = await fetch(q(`/api/opportunity/scans?runId=${encodeURIComponent(runId)}`), {
          cache: 'no-store',
        });
        const pRaw = await pr.text();
        let pd: {
          run?: {
            status: string;
            created: number;
            discoveryMode?: string | null;
            errorCount?: number;
            progressPct?: number | null;
            phase?: string | null;
          };
          error?: string;
        } = {};
        try {
          pd = JSON.parse(pRaw) as typeof pd;
        } catch {
          setScanPercent(estimateScanPercent(Date.now() - startedAt));
          continue;
        }
        if (!pr.ok) {
          setScanPercent(estimateScanPercent(Date.now() - startedAt));
          continue;
        }
        const st = pd.run?.status;
        setScanPercent(
          estimateScanPercent(Date.now() - startedAt, pd.run?.progressPct ?? null),
        );
        if (st === 'completed') {
          setScanPercent(100);
          setScanUi('done');
          const focusLabel =
            focus === 'open_now'
              ? t('Abertos agora', 'Abiertos ahora', 'Open now')
              : t('Base de referência', 'Base de referencia', 'Reference base');
          setMsg(
            t(
              `${focusLabel}: ${pd.run?.created ?? 0} candidatos${pd.run?.discoveryMode === 'web' ? ' (pesquisa web)' : ''}.`,
              `${focusLabel}: ${pd.run?.created ?? 0} candidatos${pd.run?.discoveryMode === 'web' ? ' (búsqueda web)' : ''}.`,
              `${focusLabel}: ${pd.run?.created ?? 0} candidates${pd.run?.discoveryMode === 'web' ? ' (web search)' : ''}.`,
            ),
          );
          break;
        }
        if (st === 'failed') {
          throw new Error(
            t(
              'A varredura falhou. Verifique a chave LLM e tente de novo.',
              'El barrido falló. Verifique la clave LLM.',
              'Scan failed. Check LLM key and retry.',
            ),
          );
        }
        if (attempts % 5 === 0) {
          setMsg(
            t(
              `A pesquisar… ${estimateScanPercent(Date.now() - startedAt, pd.run?.progressPct ?? null)}%`,
              `Buscando… ${estimateScanPercent(Date.now() - startedAt, pd.run?.progressPct ?? null)}%`,
              `Searching… ${estimateScanPercent(Date.now() - startedAt, pd.run?.progressPct ?? null)}%`,
            ),
          );
        }
      }

      await Promise.all([loadScan(), loadCatalog()]);
      setTab('new');
      setTimeout(() => {
        setScanUi((s) => (s === 'done' ? 'idle' : s));
        setScanPercent(0);
      }, 1200);
    } catch (e) {
      setScanUi('error');
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setScanning(false);
    }
  };

  const retryLastScan = () => {
    if (!lastScanArgs) {
      void startScan(discoveryFocus);
      return;
    }
    void startScan(lastScanArgs.focus, lastScanArgs.briefing);
  };

  const validate = async (
    tempId: string,
    action: 'save' | 'not_now' | 'reject_type',
    opts?: { reasons?: string[]; note?: string },
  ) => {
    if (!latest?.id) return;
    setBusyId(tempId);
    try {
      const r = await fetch(q('/api/opportunity/candidates/validate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: latest.id,
          tempId,
          action,
          reasons: opts?.reasons,
          note: opts?.note,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      await Promise.all([loadScan(), loadCatalog()]);
      if (action === 'save') {
        setMsg(
          t(
            'Guardado — a IA vai procurar mais fundos semelhantes.',
            'Guardado — la IA buscará fondos similares.',
            'Saved — AI will look for similar funds.',
          ),
        );
      } else if (action === 'reject_type') {
        setMsg(
          t(
            'Tipo registado para evitar — próximas varreduras aprendem isto.',
            'Tipo registrado para evitar — próximos barridos lo aprenden.',
            'Type flagged to avoid — future scans learn this.',
          ),
        );
      } else {
        setMsg(
          t(
            'Arquivado só para esta ocasião — não penaliza o tipo de fundo.',
            'Archivado solo para esta ocasión — no penaliza el tipo.',
            'Skipped for this occasion — does not penalize the fund type.',
          ),
        );
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusyId(null);
    }
  };

  if (!companyId) {
    return (
      <StateEmpty
        title={t('Empresa não seleccionada', 'Empresa no seleccionada', 'No company selected')}
        description={t(
          'Escolha a empresa na barra lateral.',
          'Elija la empresa en la barra lateral.',
          'Pick the active company in the sidebar.',
        )}
      />
    );
  }

  if (loading) return <StateLoading className="min-h-[50vh]" />;

  const lastScanLabel = latest
    ? new Date(latest.finishedAt || latest.startedAt).toLocaleDateString(
        locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es-ES' : 'en-US',
      )
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/hub/fundhub"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            OPPORTUNITY
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">
            {t('Descobrir oportunidades', 'Descubrir oportunidades', 'Discover opportunities')}
          </h1>
          {briefing.scanName && (
            <p className="mt-1 text-sm font-medium text-violet-800">
              {t('Perfil activo:', 'Perfil activo:', 'Active profile:')} {briefing.scanName}
              {briefing.amountMax != null ? ` · ≤ ${briefing.amountMax.toLocaleString()} USD` : ''}
            </p>
          )}
          {lastScanLabel && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>
                {t('Última varredura:', 'Último barrido:', 'Last scan:')} {lastScanLabel}
                {latest && ` · +${latest.created} ${t('candidatos', 'candidatos', 'candidates')}`}
              </span>
              {latest?.discoveryMode === 'web' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-800">
                  <Search className="h-3 w-3" />
                  {t('Pesquisa web', 'Búsqueda web', 'Web search')}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DeadlineAlertsPanel variant="inline" />
          {recentRuns.length > 0 && (
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <History className="h-4 w-4" />
              {t('Histórico', 'Historial', 'History')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setBriefingOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Settings2 className="h-4 w-4" />
            {t('Briefing', 'Briefing', 'Briefing')}
          </button>
          <button
            type="button"
            disabled={scanning}
            onClick={() => void startScan('open_now')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {(scanning || scanUi === 'error') && discoveryFocus === 'open_now' ? (
              <ScanProgressRing
                percent={scanPercent}
                state={scanUi === 'error' ? 'error' : scanUi === 'done' ? 'done' : 'running'}
                size={20}
                tone="onDark"
                onRetry={scanUi === 'error' ? retryLastScan : undefined}
              />
            ) : (
              <Radar className="h-4 w-4" />
            )}
            {t('Buscar abertos', 'Buscar abiertos', 'Find open calls')}
          </button>
          <button
            type="button"
            disabled={scanning}
            onClick={() => void startScan('reference')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-60"
          >
            {(scanning || scanUi === 'error') && discoveryFocus === 'reference' ? (
              <ScanProgressRing
                percent={scanPercent}
                state={scanUi === 'error' ? 'error' : scanUi === 'done' ? 'done' : 'running'}
                size={20}
                onRetry={scanUi === 'error' ? retryLastScan : undefined}
              />
            ) : (
              <Database className="h-4 w-4" />
            )}
            {t('Mapear base', 'Mapear base', 'Map reference')}
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2 text-sm ${
            scanUi === 'error'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {(scanning || scanUi === 'error' || scanUi === 'done') && (
            <ScanProgressRing
              percent={scanPercent}
              state={scanUi === 'error' ? 'error' : scanUi === 'done' ? 'done' : 'running'}
              size={28}
              onRetry={scanUi === 'error' ? retryLastScan : undefined}
            />
          )}
          <p className="min-w-0 flex-1">{msg}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          {historyOpen && recentRuns.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">
                {t('Varreduras recentes', 'Barridos recientes', 'Recent scans')}
              </h3>
              <ul className="mt-2 space-y-1.5">
                {recentRuns.map((run) => (
                  <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                    <span>
                      {new Date(run.finishedAt || run.startedAt).toLocaleString(
                        locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es-ES' : 'en-US',
                      )}
                    </span>
                    <span>
                      +{run.created} {t('candidatos', 'candidatos', 'candidates')}
                      {run.errorCount > 0 ? ` · ${run.errorCount} ${t('erros', 'errores', 'errors')}` : ''}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        run.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {run.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 border-b border-gray-200">
            {(
              [
                ['new', t('Validar', 'Validar', 'Validate')],
                ['catalog', t(`Catálogo (${catalogTotal})`, `Catálogo (${catalogTotal})`, `Catalog (${catalogTotal})`)],
                ['later', t(`Rever (${later.length})`, `Revisar (${later.length})`, `Review (${later.length})`)],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                  tab === key
                    ? 'border-amber-600 text-amber-800'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'new' && (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['open_now', t(`Abertos agora (${pendingOpen.length})`, `Abiertos ahora (${pendingOpen.length})`, `Open now (${pendingOpen.length})`)],
                  ['reference', t(`Base / referência (${pendingReference.length})`, `Base / referencia (${pendingReference.length})`, `Reference (${pendingReference.length})`)],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDiscoveryFocus(key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    discoveryFocus === key
                      ? key === 'open_now'
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-violet-100 text-violet-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
              <p className="w-full text-xs text-gray-500">
                {discoveryFocus === 'open_now'
                  ? t(
                      'Só editais com submissão aberta ou rolling — verificados na pesquisa web.',
                      'Solo convocatorias abiertas o rolling — verificadas en búsqueda web.',
                      'Only calls with open or rolling submission — verified via web search.',
                    )
                  : t(
                      'Programas permanentes, sazonais ou fechados — alimenta a base Etholys e a IA.',
                      'Programas permanentes, estacionales o cerrados — alimenta la base Etholys.',
                      'Permanent, seasonal, or closed programs — feeds Etholys base and AI.',
                    )}
              </p>
            </div>
          )}

          {tab === 'new' && pendingForFocus.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <Radar className="mx-auto h-12 w-12 text-gray-300" />
              <h2 className="mt-4 text-lg font-semibold text-gray-900">
                {discoveryFocus === 'open_now'
                  ? t('Nenhum edital aberto encontrado', 'Ninguna convocatoria abierta', 'No open calls found')
                  : t('Base ainda vazia', 'Base aún vacía', 'Reference base empty')}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
                {discoveryFocus === 'open_now'
                  ? t(
                      'Execute «Buscar abertos» — a IA procura convocatórias com prazo activo hoje.',
                      'Ejecute «Buscar abiertos» — la IA busca convocatorias con plazo activo hoy.',
                      'Run «Find open calls» — AI searches for calls with an active deadline today.',
                    )
                  : t(
                      'Execute «Mapear base» para registar programas relevantes mesmo fechados.',
                      'Ejecute «Mapear base» para programas relevantes aunque cerrados.',
                      'Run «Map reference» to catalog relevant programs even when closed.',
                    )}
              </p>
              <button
                type="button"
                disabled={scanning}
                onClick={() => (scanUi === 'error' ? retryLastScan() : void startScan(discoveryFocus))}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {scanning || scanUi === 'error' ? (
                  <ScanProgressRing
                    percent={scanPercent}
                    state={scanUi === 'error' ? 'error' : scanUi === 'done' ? 'done' : 'running'}
                    size={22}
                    tone="onDark"
                    onRetry={scanUi === 'error' ? retryLastScan : undefined}
                  />
                ) : discoveryFocus === 'open_now' ? (
                  <Radar className="h-4 w-4" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                {discoveryFocus === 'open_now'
                  ? t('Buscar abertos agora', 'Buscar abiertos', 'Find open calls')
                  : t('Mapear base de fundos', 'Mapear base', 'Map fund base')}
              </button>
            </div>
          )}

          {tab === 'new' &&
            pendingForFocus.map((c) => (
              <CandidateCard
                key={c.tempId}
                candidate={c}
                locale={locale}
                onOpen={(openTab) => openDetail(c, openTab)}
                t={t}
              />
            ))}

          {tab === 'later' &&
            (later.length === 0 ? (
              <p className="text-sm text-gray-500">{t('Nada para rever.', 'Nada para revisar.', 'Nothing to review.')}</p>
            ) : (
              later.map((c) => (
                <CandidateCard
                  key={c.tempId}
                  candidate={c}
                  locale={locale}
                  onOpen={(openTab) => openDetail(c, openTab)}
                  t={t}
                />
              ))
            ))}

          {tab === 'catalog' &&
            (catalog.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
                <Search className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm text-gray-600">
                  {t(
                    'Catálogo vazio — valide candidatos ou registe fundos que já conhece.',
                    'Catálogo vacío — valide candidatos o registre fondos conocidos.',
                    'Empty catalog — validate candidates or register known funds.',
                  )}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {catalog.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-amber-200"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{f.name}</p>
                        <p className="text-sm text-gray-600">{f.institution}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {f.type}
                          {f.countries ? ` · ${f.countries}` : ''}
                        </p>
                      </div>
                      {f.matchScore != null && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          {Math.round(f.matchScore)}%
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Link
                        href={`/hub/fundhub/discover/${f.id}`}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {t('Detalhe', 'Detalle', 'Detail')}
                      </Link>
                      <Link
                        href={`/hub/fundhub/proposals?fundId=${encodeURIComponent(f.id)}`}
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                      >
                        {t('Proposta', 'Propuesta', 'Proposal')}
                      </Link>
                    </div>
                  </div>
                ))}
                <Link
                  href="/hub/fundhub/my-funds"
                  className="inline-flex text-sm font-medium text-amber-700 hover:underline"
                >
                  {t('Ver todas as oportunidades guardadas →', 'Ver todas guardadas →', 'View all saved →')}
                </Link>
              </div>
            ))}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <SearchCoachingPanel
            briefing={briefing}
            scanning={scanning}
            scanPercent={scanPercent}
            scanUi={scanUi}
            onRetryScan={retryLastScan}
            onSaved={(next) =>
              setBriefing({
                themes: next.themes ?? [],
                countries: next.countries ?? [],
                kinds: (next.kinds as OpportunityKind[]) ?? ['grant'],
                notes: next.notes,
                searchFeedback: next.searchFeedback,
                scanName: next.scanName,
                classifications: next.classifications,
                amountMax: next.amountMax,
                privateEligible: next.privateEligible,
                reimbursable: next.reimbursable,
              })
            }
            onRunShortcut={(next, focus) => {
              const mapped: Briefing = {
                themes: next.themes ?? [],
                countries: next.countries ?? [],
                kinds: (next.kinds as OpportunityKind[]) ?? ['grant'],
                notes: next.notes,
                searchFeedback: next.searchFeedback,
                scanName: next.scanName,
                classifications: next.classifications,
                amountMax: next.amountMax,
                privateEligible: next.privateEligible,
                reimbursable: next.reimbursable,
              };
              setBriefing(mapped);
              void startScan(focus, mapped);
            }}
          />
          <KnownFundsPanel onAdded={() => void loadCatalog()} />
        </aside>
      </div>

      {detail && (
        <CandidateDetailSheet
          candidate={detail}
          runId={latest?.id}
          open
          initialTab={detailTab}
          busy={busyId === detail.tempId}
          onClose={() => setDetail(null)}
          onFeedback={(action, opts) => {
            void validate(detail.tempId, action, opts).then(() => setDetail(null));
          }}
        />
      )}

      {briefingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('Briefing de varredura', 'Briefing de barrido', 'Scan briefing')}
              </h2>
              <button type="button" onClick={() => setBriefingOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t(
                'O que procura? A IA usa isto para priorizar fontes e oportunidades.',
                '¿Qué busca? La IA usa esto para priorizar.',
                'What are you looking for? AI uses this to prioritize.',
              )}
            </p>

            <label className="mt-4 block text-xs font-semibold uppercase text-gray-500">
              {t('Temas / sectores', 'Temas / sectores', 'Themes / sectors')}
            </label>
            <input
              value={themesInput}
              onChange={(e) => setThemesInput(e.target.value)}
              placeholder={t('Agricultura, ESG, digital…', 'Agricultura, ESG…', 'Agriculture, ESG…')}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />

            <label className="mt-4 block text-xs font-semibold uppercase text-gray-500">
              {t('Países / regiões', 'Países / regiones', 'Countries / regions')}
            </label>
            <input
              value={countriesInput}
              onChange={(e) => setCountriesInput(e.target.value)}
              placeholder={t('Brasil, África…', 'Brasil, África…', 'Brazil, Africa…')}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />

            <p className="mt-4 text-xs font-semibold uppercase text-gray-500">
              {t('Tipos de oportunidade', 'Tipos de oportunidad', 'Opportunity types')}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {KIND_OPTIONS.map((k) => {
                const on = briefing.kinds.includes(k.id);
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() =>
                      setBriefing((b) => ({
                        ...b,
                        kinds: on ? b.kinds.filter((x) => x !== k.id) : [...b.kinds, k.id],
                      }))
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      on ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {locale === 'pt' ? k.pt : k.es}
                  </button>
                );
              })}
            </div>

            <label className="mt-4 block text-xs font-semibold uppercase text-gray-500">Notas</label>
            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder={t(
                'Ex.: foco em cadeias agrícolas, preferência multilateral…',
                'Ej.: cadenas agrícolas…',
                'E.g. ag supply chains…',
              )}
            />

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBriefingOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700"
              >
                {t('Cancelar', 'Cancelar', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => void saveBriefing()}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              >
                {t('Guardar briefing', 'Guardar briefing', 'Save briefing')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateCard({
  candidate: c,
  locale,
  onOpen,
  t,
}: {
  candidate: ScanCandidate;
  locale: string;
  onOpen: (tab?: 'overview' | 'analyze') => void;
  t: (pt: string, es: string, en: string) => string;
}) {
  const countries = c.eligibleCountries ?? c.countries;
  const closes = c.closesAt ?? c.deadline;
  const opensLabel = formatDateShort(c.opensAt, locale);
  const closesLabel = formatDateShort(closes, locale);
  const status = c.availabilityStatus;
  const host = (() => {
    if (!c.linkOficial) return null;
    try {
      return new URL(c.linkOficial).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  })();

  const dateLine =
    opensLabel && closesLabel
      ? `${opensLabel} → ${closesLabel}`
      : closesLabel || opensLabel || c.applicationWindow || null;

  const countryShort =
    countries && countries.length > 48 ? `${countries.slice(0, 48).trim()}…` : countries;

  return (
    <article className="group rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-amber-300 hover:shadow-md">
      <button
        type="button"
        onClick={() => onOpen('overview')}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {status && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${availabilityBadgeClass(status)}`}
              >
                {availabilityLabel(status, locale)}
              </span>
            )}
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
              {c.type}
            </span>
            {c.category && (
              <span className="max-w-[14rem] truncate rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-900">
                {c.category}
              </span>
            )}
            {c.classification && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-900">
                {c.classification === 'direct'
                  ? t('Directo', 'Directo', 'Direct')
                  : c.classification === 'client_bridge'
                    ? t('Ponte', 'Puente', 'Bridge')
                    : t('Conjunto', 'Conjunto', 'Joint')}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 line-clamp-1 text-sm font-semibold text-gray-900 group-hover:text-amber-900">
            {c.name}
          </h3>
          <p className="line-clamp-1 text-xs text-gray-600">{c.institution}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
            {dateLine && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3 shrink-0" />
                {dateLine}
              </span>
            )}
            {countryShort && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {countryShort}
              </span>
            )}
            {host && (
              <span className="inline-flex items-center gap-1 text-gray-400">
                <ExternalLink className="h-3 w-3 shrink-0" />
                {host}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {c.matchScore != null && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              {Math.round(c.matchScore)}%
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-amber-600" />
        </div>
      </button>
      <div className="flex flex-wrap gap-1.5 border-t border-gray-100 px-3 py-2">
        <button
          type="button"
          onClick={() => onOpen('analyze')}
          className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
        >
          <MessageSquare className="h-3 w-3" />
          {t('Analisar', 'Analizar', 'Analyze')}
        </button>
        <button
          type="button"
          onClick={() => onOpen('overview')}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
        >
          {t('Ver detalhes', 'Ver detalles', 'View details')}
          <ChevronRight className="h-3 w-3" />
        </button>
        {!c.linkOficial && (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-800">
            {t('Sem link oficial', 'Sin enlace oficial', 'No official link')}
          </span>
        )}
      </div>
    </article>
  );
}
