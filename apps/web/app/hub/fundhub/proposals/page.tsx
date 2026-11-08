'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/app/providers';
import { ui } from '@/lib/i18n';
import { isLikelyDbId } from '@/lib/utils';
import {
  ArrowLeft,
  Plus,
  UploadCloud,
  Trash2,
  FileText,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import {
  PROPOSAL_CANDIDATE_KEY,
  SELECTED_FUND_KEY,
  buildProposalIntake,
  createProposalWorkspaceId,
  editorHref,
  findReusableDraft,
  mergeProposalDraftIndexes,
  persistProposalIntake,
  readLocalProposalDrafts,
  seedFromCandidate,
  shouldSkipProposalIntake,
  type ProposalDraftIndex,
  type ProposalFundSeed,
} from '@/lib/opportunity/proposal-workspace';

interface FundSummary extends ProposalFundSeed {
  id: string;
  name: string;
  institution: string;
}

type ProposalDraft = ProposalDraftIndex;

const MAX_FILES = 50;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ACCEPTED_EXT =
  /\.(pdf|docx?|xlsx?|pptx?|txt|md|csv|rtf|odt|ods|odp|zip|rar|7z|png|jpe?g|gif|webp)$/i;
const ACCEPT_ATTR =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.rtf,.odt,.ods,.odp,.zip,.rar,.7z,.png,.jpg,.jpeg,.gif,.webp';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function asFundSeed(raw: unknown): FundSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  const tempId = String(f.tempId ?? '').trim();
  const id = String(f.id ?? '').trim() || (tempId ? `candidate:${tempId}` : '');
  const name = String(f.name ?? '').trim();
  if (!id || !name) return null;
  const requirements =
    typeof f.requirements === 'string'
      ? f.requirements
      : typeof f.requisites === 'string'
        ? f.requisites
        : undefined;
  return {
    id,
    name,
    institution: String(f.institution ?? ''),
    description: typeof f.description === 'string' ? f.description : undefined,
    linkOficial: typeof f.linkOficial === 'string' ? f.linkOficial : undefined,
    callUrl: typeof f.callUrl === 'string' ? f.callUrl : undefined,
    institutionUrl: typeof f.institutionUrl === 'string' ? f.institutionUrl : undefined,
    documents: Array.isArray(f.documents)
      ? (f.documents as Array<{ title?: string; url?: string; kind?: string }>)
          .filter((d) => typeof d?.url === 'string' && d.url)
          .map((d) => ({ title: String(d.title || d.url), url: String(d.url), kind: d.kind }))
      : undefined,
    sourceExcerpt: typeof f.sourceExcerpt === 'string' ? f.sourceExcerpt : undefined,
    eligibilityCriteria: typeof f.eligibilityCriteria === 'string' ? f.eligibilityCriteria : undefined,
    whoCanApply: typeof f.whoCanApply === 'string' ? f.whoCanApply : undefined,
    eligibility: typeof f.eligibility === 'string' ? f.eligibility : undefined,
    requirements,
    howToApply: typeof f.howToApply === 'string' ? f.howToApply : undefined,
    risksCaveats: typeof f.risksCaveats === 'string' ? f.risksCaveats : undefined,
    deadline: (f.deadline as string | Date | null | undefined) ?? undefined,
    countries: typeof f.countries === 'string' ? f.countries : undefined,
    amount: typeof f.amount === 'number' ? f.amount : undefined,
    currency: typeof f.currency === 'string' ? f.currency : undefined,
    type: typeof f.type === 'string' ? f.type : undefined,
    category: typeof f.category === 'string' ? f.category : undefined,
    notes: typeof f.notes === 'string' ? f.notes : undefined,
    summary: typeof f.summary === 'string' ? f.summary : undefined,
    matchJustification: typeof f.matchJustification === 'string' ? f.matchJustification : undefined,
    basesText: typeof f.basesText === 'string' ? f.basesText : undefined,
  };
}

export default function ProposalsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeCompanyId, locale } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);
  const fundIdParam = searchParams.get('fundId')?.trim() || '';
  const fromCandidate = searchParams.get('from') === 'candidate';

  const [coalitionCount, setCoalitionCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'drafts' | 'new'>('drafts');
  const [fund, setFund] = useState<FundSummary | null>(null);
  const [editalLink, setEditalLink] = useState('');
  const [intakeNotes, setIntakeNotes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [openingKnown, setOpeningKnown] = useState(Boolean(fundIdParam || fromCandidate));
  const [drafts, setDrafts] = useState<ProposalDraft[]>([]);
  const [draftsReady, setDraftsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openedRef = useRef(false);

  const openWorkspace = useCallback(
    (seed: ProposalFundSeed, source: 'fund' | 'candidate' | 'manual', extras?: { notes?: string }) => {
      const reusable = findReusableDraft(drafts, seed.id);
      if (reusable) {
        router.replace(editorHref(reusable.workspaceId, reusable.fundId));
        return;
      }
      const workspaceId = createProposalWorkspaceId(seed.id);
      const intake = buildProposalIntake(workspaceId, seed, {
        notes: extras?.notes,
        source,
      });
      persistProposalIntake(intake);
      try {
        localStorage.setItem(SELECTED_FUND_KEY, JSON.stringify(seed));
      } catch {
        /* ignore */
      }
      router.replace(editorHref(workspaceId, seed.id));
    },
    [drafts, router],
  );

  useEffect(() => {
    const local = readLocalProposalDrafts();
    if (!companyId) {
      setDrafts(local);
      setDraftsReady(true);
      return;
    }
    fetch(`/api/fundhub/proposals?companyId=${encodeURIComponent(companyId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { proposals?: ProposalDraft[] }) => {
        const server = Array.isArray(d.proposals) ? d.proposals : [];
        setDrafts(mergeProposalDraftIndexes(server, local));
      })
      .catch(() => setDrafts(local))
      .finally(() => setDraftsReady(true));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/fundhub/coalition?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => r.json())
      .then((d) => setCoalitionCount(Array.isArray(d.members) ? d.members.length : 0))
      .catch(() => {});
  }, [companyId]);

  useEffect(() => {
    if (!draftsReady || openedRef.current) return;

    if (fromCandidate) {
      try {
        const raw = sessionStorage.getItem(PROPOSAL_CANDIDATE_KEY);
        const candidate = asFundSeed(raw ? JSON.parse(raw) : null);
        if (candidate && shouldSkipProposalIntake({ candidate })) {
          openedRef.current = true;
          sessionStorage.removeItem(PROPOSAL_CANDIDATE_KEY);
          try {
            openWorkspace(seedFromCandidate(candidate), 'candidate');
          } catch (e) {
            openedRef.current = false;
            setOpeningKnown(false);
            setError(
              e instanceof Error
                ? e.message
                : ui(locale, 'No se pudo abrir la propuesta.', 'Não foi possível abrir a proposta.', 'Could not open the proposal.'),
            );
          }
          return;
        }
        if (candidate) {
          setFund(candidate);
          setEditalLink(candidate.callUrl || candidate.linkOficial || '');
          setIntakeNotes(candidate.description || '');
          setActiveTab('new');
        }
      } catch {
        /* ignore */
      }
      setOpeningKnown(false);
    }

    if (!fundIdParam) {
      if (!fromCandidate) setOpeningKnown(false);
      return;
    }

    if (!companyId) {
      setOpeningKnown(false);
      return;
    }

    let cancelled = false;
    fetch(`/api/funds/${encodeURIComponent(fundIdParam)}?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const f = asFundSeed(d?.fund);
        if (!f) {
          setOpeningKnown(false);
          setError(ui(locale, 'Fondo no encontrado.', 'Fundo não encontrado.', 'Fund not found.'));
          return;
        }
        setFund(f);
        try {
          localStorage.setItem(SELECTED_FUND_KEY, JSON.stringify(f));
        } catch {
          /* ignore */
        }
        if (shouldSkipProposalIntake({ fundId: f.id, fund: f })) {
          openedRef.current = true;
          try {
            openWorkspace(f, 'fund');
          } catch (e) {
            openedRef.current = false;
            setOpeningKnown(false);
            setError(
              e instanceof Error
                ? e.message
                : ui(locale, 'No se pudo abrir la propuesta.', 'Não foi possível abrir a proposta.', 'Could not open the proposal.'),
            );
          }
          return;
        }
        setEditalLink(f.linkOficial || '');
        setActiveTab('new');
        setOpeningKnown(false);
      })
      .catch(() => {
        if (!cancelled) {
          setOpeningKnown(false);
          setError(ui(locale, 'No se pudo cargar el fondo.', 'Não foi possível carregar o fundo.', 'Could not load the fund.'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, draftsReady, fundIdParam, fromCandidate, openWorkspace, locale]);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      if (!list.length) return;

      setSelectedFiles((prev) => {
        const next = [...prev];
        const errors: string[] = [];
        let skippedFormat = 0;
        let skippedSize = 0;

        for (const file of list) {
          if (next.length >= MAX_FILES) {
            errors.push(
              ui(
                locale,
                `Máximo de ${MAX_FILES} archivos por propuesta.`,
                `Máximo de ${MAX_FILES} arquivos por proposta.`,
                `Maximum of ${MAX_FILES} files per proposal.`,
              ),
            );
            break;
          }
          if (!ACCEPTED_EXT.test(file.name)) {
            skippedFormat += 1;
            continue;
          }
          if (file.size > MAX_FILE_BYTES) {
            skippedSize += 1;
            continue;
          }
          const duplicate = next.some(
            (f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified,
          );
          if (duplicate) continue;
          next.push(file);
        }

        if (skippedFormat) {
          errors.push(
            ui(
              locale,
              `${skippedFormat} archivo(s) ignorado(s): formato no soportado. Usá PDF, Word, Excel, PowerPoint, imágenes, ZIP, TXT, etc.`,
              `${skippedFormat} arquivo(s) ignorado(s): formato não suportado. Use PDF, Word, Excel, PowerPoint, imagens, ZIP, TXT, etc.`,
              `${skippedFormat} file(s) skipped: unsupported format. Use PDF, Word, Excel, PowerPoint, images, ZIP, TXT, etc.`,
            ),
          );
        }
        if (skippedSize) {
          errors.push(
            ui(
              locale,
              `${skippedSize} archivo(s) ignorado(s): cada uno debe pesar menos de 25MB.`,
              `${skippedSize} arquivo(s) ignorado(s): cada um deve ter menos de 25MB.`,
              `${skippedSize} file(s) skipped: each must be under 25MB.`,
            ),
          );
        }

        setError(errors.length ? errors.join(' ') : null);
        return next;
      });
    },
    [locale],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) addFiles(e.target.files);
      e.target.value = '';
    },
    [addFiles],
  );

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }, []);

  const handleOpenWorkspace = useCallback(async () => {
    if (fund && shouldSkipProposalIntake({ fundId: fund.id, fund })) {
      setIsLoading(true);
      openWorkspace(fund, fund.id.startsWith('candidate:') ? 'candidate' : 'fund', {
        notes: intakeNotes,
      });
      return;
    }

    if (!editalLink.trim() && selectedFiles.length === 0) {
      setError(
        ui(
          locale,
          'Pegá el enlace del edital o seleccioná al menos un archivo',
          'Cole um link do edital ou selecione pelo menos um arquivo',
          'Paste a call link or select at least one file',
        ),
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let resolvedFund: FundSummary = fund ?? {
        id: `adhoc-${Date.now()}`,
        name:
          selectedFiles[0]?.name?.replace(/\.[^.]+$/, '') ||
          ui(locale, 'Propuesta independiente', 'Proposta avulsa', 'Standalone proposal'),
        institution: ui(locale, 'Sin fondo vinculado', 'Sem fundo vinculado', 'No fund linked'),
        description: intakeNotes,
        linkOficial: editalLink.trim() || undefined,
      };

      const officialUrl = editalLink.trim() || resolvedFund.callUrl || resolvedFund.linkOficial || '';
      if (officialUrl && companyId) {
        try {
          const ingestRes = await fetch(
            `/api/fundhub/proposals/ingest-edital?companyId=${encodeURIComponent(companyId)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: officialUrl, locale }),
            },
          );
          const ingestData = (await ingestRes.json()) as {
            edital?: {
              name?: string;
              institution?: string;
              callUrl?: string;
              documents?: Array<{ title?: string; url?: string; kind?: string }>;
              sourceExcerpt?: string;
              basesText?: string;
            };
          };
          const ed = ingestData.edital;
          if (ed) {
            const docs = Array.isArray(ed.documents)
              ? ed.documents
                  .filter((d) => d?.url)
                  .map((d) => ({ title: String(d.title || d.url), url: String(d.url), kind: d.kind }))
              : resolvedFund.documents;
            resolvedFund = {
              ...resolvedFund,
              name: fund?.name || ed.name || resolvedFund.name,
              institution: fund?.institution || ed.institution || resolvedFund.institution,
              linkOficial: ed.callUrl || officialUrl,
              callUrl: ed.callUrl || officialUrl,
              documents: docs,
              sourceExcerpt: ed.sourceExcerpt || resolvedFund.sourceExcerpt,
              basesText: ed.basesText || resolvedFund.basesText,
            };
          }
        } catch {
          /* o editor ainda tenta ler o URL no briefing */
        }
      }
      const workspaceId = createProposalWorkspaceId(resolvedFund.id);
      const uploadedAt = new Date().toISOString();
      const intake = buildProposalIntake(workspaceId, {
        ...resolvedFund,
        linkOficial: editalLink.trim() || resolvedFund.linkOficial,
      }, {
        notes: intakeNotes,
        source: fund ? 'fund' : 'manual',
        files: selectedFiles.length
          ? selectedFiles.map((file) => ({
              name: file.name,
              type: file.type || 'application/octet-stream',
              size: file.size,
              uploadedAt,
            }))
          : undefined,
      });

      try {
        persistProposalIntake(intake);
      } catch {
        throw new Error(
          ui(
            locale,
            'No se pudieron guardar los anexos en el navegador (almacenamiento lleno). Quitá algunos archivos o limpiá la caché e intentá de nuevo.',
            'Não foi possível guardar os anexos no browser (armazenamento cheio). Remova alguns ficheiros ou limpe o cache e tente de novo.',
            'Could not save attachments in the browser (storage full). Remove some files or clear the cache and try again.',
          ),
        );
      }

      const textLike = selectedFiles.filter(
        (f) => f.type.startsWith('text') || /\.(txt|md|csv)$/i.test(f.name),
      );
      if (textLike.length) {
        try {
          const stored = await Promise.all(
            textLike.slice(0, 10).map(async (file) => ({
              name: file.name,
              content: (await file.text()).slice(0, 80000),
              uploadedAt,
            })),
          );
          localStorage.setItem(`proposalFiles:${workspaceId}`, JSON.stringify(stored));
          localStorage.setItem(
            `proposalFile:${workspaceId}`,
            JSON.stringify({ name: stored[0]!.name, content: stored[0]!.content, uploadedAt }),
          );
        } catch {
          /* metadados já gravados */
        }
      }

      if (!fund) {
        localStorage.setItem(SELECTED_FUND_KEY, JSON.stringify(resolvedFund));
      }

      router.push(editorHref(workspaceId, resolvedFund.id));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : ui(locale, 'Error al abrir el espacio de trabajo', 'Erro ao abrir workspace', 'Error opening workspace'),
      );
      setIsLoading(false);
    }
  }, [fund, editalLink, selectedFiles, intakeNotes, router, openWorkspace, companyId, locale]);

  const handleDeleteDraft = useCallback((workspaceId: string) => {
    const updated = drafts.filter((d) => d.workspaceId !== workspaceId);
    setDrafts(updated);
    localStorage.setItem('proposalDrafts', JSON.stringify(updated));
    localStorage.removeItem(`proposalDraft:${workspaceId}`);
    localStorage.removeItem(`proposalIntake:${workspaceId}`);
  }, [drafts]);

  const handleContinueDraft = useCallback(
    (workspaceId: string) => {
      router.push(`/hub/fundhub/proposals/editor?workspace=${encodeURIComponent(workspaceId)}`);
    },
    [router],
  );

  const dateLocale = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';

  if (openingKnown) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-amber-600" />
        <p className="text-sm text-gray-600">
          {ui(
            locale,
            'Abriendo la propuesta con los datos del fondo…',
            'A abrir a proposta com os dados do fundo…',
            'Opening the proposal with the fund data…',
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link href="/hub/fundhub" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          FundHub
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">
          {ui(locale, 'Propuestas', 'Propostas', 'Proposals')}
        </h1>
        <p className="mt-1 text-gray-600">
          {ui(locale, 'Escribir y seguir candidaturas.', 'Escrever e acompanhar candidaturas.', 'Write and track applications.')}
        </p>
      </header>

      <div>
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900">{ui(locale, 'Error', 'Erro', 'Error')}</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div className="mb-8 border-b border-gray-200">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('drafts')}
              className={`border-b-2 px-1 py-3 text-sm font-medium transition ${
                activeTab === 'drafts'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {ui(locale, 'Borradores', 'Rascunhos', 'Drafts')} ({drafts.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`border-b-2 px-1 py-3 text-sm font-medium transition ${
                activeTab === 'new'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {ui(locale, 'Independiente', 'Avulsa', 'Standalone')}
              </div>
            </button>
          </div>
        </div>

        {activeTab === 'drafts' && (
          <div>
            {drafts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  {ui(locale, 'Ninguna propuesta en borrador', 'Nenhuma proposta em rascunho', 'No draft proposals')}
                </h3>
                <p className="mt-2 text-gray-600">
                  {ui(
                    locale,
                    'Abrí un fondo en En curso, o empezá una independiente.',
                    'Abra um fundo em Em curso, ou comece uma avulsa.',
                    'Open a fund in In progress, or start a standalone one.',
                  )}
                </p>
                <button
                  onClick={() => setActiveTab('new')}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition"
                >
                  <Plus className="h-4 w-4" />
                  {ui(locale, 'Propuesta independiente', 'Proposta avulsa', 'Standalone proposal')}
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {drafts.map((draft) => (
                  <div key={draft.workspaceId} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition">
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{draft.title || draft.fundName}</h3>
                        <p className="text-xs text-gray-500">
                          {draft.fundName}
                          {draft.fundInstitution ? ` · ${draft.fundInstitution}` : ''}
                        </p>
                      </div>
                      <span
                        className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${
                          draft.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-800'
                            : draft.status === 'submitted'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {draft.status === 'draft'
                          ? ui(locale, 'Borrador', 'Rascunho', 'Draft')
                          : draft.status === 'submitted'
                            ? ui(locale, 'Enviado', 'Enviado', 'Submitted')
                            : ui(locale, 'Archivado', 'Arquivado', 'Archived')}
                      </span>
                    </div>
                    <div className="mb-4 space-y-2 border-t border-gray-100 pt-4">
                      <p className="line-clamp-2 text-sm text-gray-600">
                        {draft.editalLink ||
                          draft.fundInstitution ||
                          ui(locale, 'Sin enlace', 'Sem link', 'No link')}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(draft.updatedAt).toLocaleDateString(dateLocale, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleContinueDraft(draft.workspaceId)}
                        className="flex-1 rounded-lg bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100 transition"
                      >
                        {ui(locale, 'Continuar', 'Continuar', 'Continue')}
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(draft.workspaceId)}
                        className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition"
                        title={ui(locale, 'Eliminar propuesta', 'Eliminar proposta', 'Delete proposal')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'new' && (
          <div className="max-w-2xl">
            {coalitionCount > 0 && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {ui(locale, 'Coalición con', 'Coalizão com', 'Coalition with')}{' '}
                <strong>{coalitionCount}</strong>{' '}
                {ui(locale, 'organización(es).', 'organização(ões).', 'organization(s).')}{' '}
                <Link href="/hub/fundhub/coalition" className="font-medium underline">
                  {ui(locale, 'Gestionar', 'Gerir', 'Manage')}
                </Link>
              </div>
            )}
            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {ui(locale, 'Propuesta independiente', 'Proposta avulsa', 'Standalone proposal')}
                </h2>
                <p className="mt-2 text-gray-600">
                  {ui(
                    locale,
                    'Sin fondo guardado — pegá el enlace oficial. La IA lee la página y los anexos antes de cualquier postulación.',
                    'Sem fundo guardado — cole o link oficial. A IA lê a página e os anexos antes de qualquer postulação.',
                    'No saved fund — paste the official link. AI reads the page and attachments before any application.',
                  )}
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {ui(locale, 'Enlace del edital', 'Link do edital', 'Call link')}
                  </label>
                  <input
                    type="url"
                    placeholder="https://…"
                    value={editalLink}
                    onChange={(e) => setEditalLink(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {ui(locale, 'Archivos', 'Ficheiros', 'Files')}
                    {selectedFiles.length > 0 && (
                      <span className="ml-2 font-normal text-gray-500">
                        ({selectedFiles.length}/{MAX_FILES})
                      </span>
                    )}
                  </label>
                  <div className="mt-2">
                    <label
                      htmlFor="file-upload"
                      className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-10 transition hover:border-amber-400 hover:bg-amber-50"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                      }}
                    >
                      <div className="text-center">
                        <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                        <p className="mt-2 text-sm font-medium text-gray-900">
                          {ui(locale, 'Hacé clic o arrastrá', 'Clique ou arraste', 'Click or drag')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {ui(
                            locale,
                            `PDF, Word, Excel… — hasta 25MB · máx. ${MAX_FILES}`,
                            `PDF, Word, Excel… — até 25MB · máx. ${MAX_FILES}`,
                            `PDF, Word, Excel… — up to 25MB · max ${MAX_FILES}`,
                          )}
                        </p>
                      </div>
                      <input
                        id="file-upload"
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        accept={ACCEPT_ATTR}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {selectedFiles.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {selectedFiles.map((file, index) => (
                        <li
                          key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="h-4 w-4 flex-shrink-0 text-amber-700" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(index)}
                            className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                            title={ui(locale, 'Quitar archivo', 'Remover arquivo', 'Remove file')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {ui(locale, 'Notas', 'Notas', 'Notes')}
                  </label>
                  <textarea
                    value={intakeNotes}
                    onChange={(e) => setIntakeNotes(e.target.value)}
                    placeholder={ui(
                      locale,
                      'Puntos del edital, si querés…',
                      'Pontos do edital, se quiser…',
                      'Call notes, if you want…',
                    )}
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition"
                  />
                </div>

                {fund && !fund.id.startsWith('adhoc-') && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-gray-800">
                    <p className="font-medium text-gray-900">{fund.name}</p>
                    <p className="text-gray-600">{fund.institution}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void handleOpenWorkspace()}
                  disabled={isLoading || (!fund && !editalLink.trim() && selectedFiles.length === 0)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-6 py-3 font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {editalLink.trim()
                        ? ui(locale, 'Leyendo el edital oficial…', 'A ler o edital oficial…', 'Reading the official call…')
                        : ui(locale, 'Abriendo…', 'A abrir…', 'Opening…')}
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      {ui(locale, 'Leer el edital', 'Ler o edital', 'Read the call')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
