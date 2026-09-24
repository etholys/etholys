'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  Paperclip,
  Lightbulb,
  PenLine,
  Loader2,
  Send,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { StudioMarkdown } from '@/lib/studio/markdown-lite';
import {
  seedDocumentMarkdown,
  sectionsFromMarkdown,
  type ProposalFundSeed,
} from '@/lib/opportunity/proposal-workspace';

interface Fund extends ProposalFundSeed {
  id: string;
  name: string;
  institution: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface AttachedFile {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export default function FundHubProposalEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeCompanyId } = useApp();
  const companyId = isLikelyDbId(String(activeCompanyId ?? '').trim())
    ? String(activeCompanyId).trim()
    : '';
  const workspaceId = searchParams.get('workspace') || searchParams.get('workspaceId');
  const fundId = searchParams.get('fundId');

  const [fund, setFund] = useState<Fund | null>(null);
  const [loading, setLoading] = useState(true);
  const [editalLink, setEditalLink] = useState('');
  const [intakeNotes, setIntakeNotes] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [documentMarkdown, setDocumentMarkdown] = useState('');
  const [docMode, setDocMode] = useState<'edit' | 'preview'>('edit');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [brainstorming, setBrainstorming] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openingStudio, setOpeningStudio] = useState(false);
  const [coalitionPool, setCoalitionPool] = useState<Array<{ id: string; orgName: string; role: string }>>([]);
  const [coalition, setCoalition] = useState<Array<{ id: string; orgName: string; role: string; budgetPct?: number }>>([]);
  const brainstormRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const persistDraft = useCallback(
    (patch?: { documentMarkdown?: string; intakeNotes?: string; chat?: ChatMessage[]; coalition?: typeof coalition }) => {
      if (!workspaceId || typeof window === 'undefined') return;
      const md = patch?.documentMarkdown ?? documentMarkdown;
      const notes = patch?.intakeNotes ?? intakeNotes;
      const chats = patch?.chat ?? chatMessages;
      const draftKey = `proposalDraft:${workspaceId}`;
      const listRaw = localStorage.getItem('proposalDrafts') || '[]';
      let drafts: Array<Record<string, unknown>> = [];
      try {
        drafts = JSON.parse(listRaw);
      } catch {
        drafts = [];
      }
      const idx = drafts.findIndex((d) => d.workspaceId === workspaceId);
      const draftData = {
        workspaceId,
        fundId: fund?.id || fundId || null,
        fundName: fund?.name || 'Proposta',
        fundInstitution: fund?.institution || '',
        editalLink,
        editalSummary: notes,
        status: 'draft' as const,
        createdAt: idx >= 0 ? drafts[idx]!.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        title: fund?.name,
        coalition: patch?.coalition ?? coalition,
      };
      if (idx >= 0) drafts[idx] = draftData;
      else drafts.push(draftData);
      localStorage.setItem('proposalDrafts', JSON.stringify(drafts));
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          ...draftData,
          attachedFiles,
          documentMarkdown: md,
          chatMessages: chats,
          brainstormDone: chats.some((m) => m.role === 'assistant'),
          sections: sectionsFromMarkdown(md),
        }),
      );
      setDraftSaved(true);
    },
    [workspaceId, fund, fundId, editalLink, intakeNotes, attachedFiles, documentMarkdown, chatMessages, coalition],
  );

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      setError('Workspace não encontrado. Volte a Propostas.');
      return;
    }

    const intakeKey = `proposalIntake:${workspaceId}`;
    const draftKey = `proposalDraft:${workspaceId}`;
    let seededFund: Fund | null = null;
    let notes = '';
    let link = '';
    let md = '';
    let chats: ChatMessage[] = [];

    const savedIntake = window.localStorage.getItem(intakeKey);
    if (savedIntake) {
      try {
        const intake = JSON.parse(savedIntake);
        link = intake.editalLink || '';
        notes = intake.intakeNotes || '';
        setAttachedFiles(intake.attachedFiles || []);
        if (intake.fundName) {
          seededFund = {
            id: intake.fundId || fundId || 'adhoc',
            name: intake.fundName,
            institution: intake.fundInstitution || '',
            linkOficial: intake.editalLink,
            description: intake.intakeNotes,
          };
        }
      } catch {
        /* ignore */
      }
    }

    const savedDraft = window.localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.documentMarkdown) md = draft.documentMarkdown;
        else if (Array.isArray(draft.sections) && draft.sections.length) {
          md = draft.sections
            .map((s: { title?: string; content?: string }) => `## ${s.title || 'Secção'}\n\n${s.content || ''}`)
            .join('\n\n');
        }
        if (!notes && draft.editalSummary) notes = draft.editalSummary;
        if (Array.isArray(draft.chatMessages)) chats = draft.chatMessages;
        if (Array.isArray(draft.coalition)) setCoalition(draft.coalition);
        if (draft.fundName && !seededFund) {
          seededFund = {
            id: draft.fundId || fundId || 'adhoc',
            name: draft.fundName,
            institution: draft.fundInstitution || '',
          };
        }
        setDraftSaved(true);
      } catch {
        /* ignore */
      }
    }

    if (seededFund) setFund(seededFund);
    setEditalLink(link);
    setIntakeNotes(notes);
    setDocumentMarkdown(md);
    setChatMessages(chats);
    setLoading(false);
  }, [workspaceId, fundId]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/fundhub/coalition?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => r.json())
      .then((d) => setCoalitionPool(Array.isArray(d.members) ? d.members : []))
      .catch(() => setCoalitionPool([]));
  }, [companyId]);

  useEffect(() => {
    if (!fundId || !companyId) return;
    fetch(`/api/funds/${encodeURIComponent(fundId)}?companyId=${encodeURIComponent(companyId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.fund?.id) {
          setFund((prev) => ({ ...(prev || {}), ...d.fund }));
          if (d.fund.linkOficial) setEditalLink((cur) => cur || d.fund.linkOficial);
        }
      })
      .catch(() => {});
  }, [fundId, companyId]);

  useEffect(() => {
    if (!workspaceId || !companyId) return;
    const draftKey = `proposalDraft:${workspaceId}`;
    const saved = window.localStorage.getItem(draftKey);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft.documentMarkdown || (Array.isArray(draft.sections) && draft.sections.length)) return;
      } catch {
        /* load server */
      }
    }
    fetch(
      `/api/fundhub/proposals?companyId=${encodeURIComponent(companyId)}&workspaceId=${encodeURIComponent(workspaceId)}`,
      { cache: 'no-store' },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const p = d?.proposal;
        if (!p) return;
        if (p.editalLink) setEditalLink(p.editalLink);
        if (p.editalSummary) setIntakeNotes(p.editalSummary);
        if (p.sections?.length && !documentMarkdown) {
          const md = p.sections
            .map((s: { title?: string; content?: string }) => `## ${s.title || 'Secção'}\n\n${s.content || ''}`)
            .join('\n\n');
          setDocumentMarkdown(md);
        }
        if (p.fundName) {
          setFund((prev) =>
            prev || {
              id: p.fundId || 'adhoc',
              name: p.fundName,
              institution: p.fundInstitution || '',
            },
          );
        }
        setDraftSaved(true);
      })
      .catch(() => {});
  }, [workspaceId, companyId, documentMarkdown]);

  const assistantBody = useCallback(
    (mode: string, userMessage: string) => ({
      mode,
      userMessage,
      companyId,
      fundName: fund?.name,
      fundInstitution: fund?.institution,
      editalLink: editalLink || fund?.linkOficial,
      editalSummary: intakeNotes,
      documentMarkdown,
    }),
    [companyId, fund, editalLink, intakeNotes, documentMarkdown],
  );

  const runBrainstorm = useCallback(async () => {
    if (!workspaceId || brainstormRef.current) return;
    const lockKey = `proposalBrainstorm:${workspaceId}`;
    try {
      if (sessionStorage.getItem(lockKey)) return;
      sessionStorage.setItem(lockKey, '1');
    } catch {
      /* continue */
    }
    brainstormRef.current = true;
    setBrainstorming(true);
    setError(null);
    try {
      const response = await fetch('/api/proposals/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assistantBody('brainstorm', 'Chuva de ideias inicial para esta proposta.')),
      });
      const data = await response.json();
      if (!response.ok || !data.answer) {
        throw new Error(data.error || 'Não foi possível gerar a ideia geral.');
      }
      const answer = String(data.answer);
      const seed = fund || { id: fundId || 'adhoc', name: 'Proposta', institution: '' };
      const nextDoc = documentMarkdown.trim()
        ? documentMarkdown
        : seedDocumentMarkdown(seed, answer);
      const nextChat: ChatMessage[] = [
        ...chatMessages,
        { role: 'assistant', content: answer, createdAt: new Date().toISOString() },
      ];
      setDocumentMarkdown(nextDoc);
      setChatMessages(nextChat);
      persistDraft({ documentMarkdown: nextDoc, chat: nextChat });
    } catch {
      brainstormRef.current = false;
      try {
        sessionStorage.removeItem(`proposalBrainstorm:${workspaceId}`);
      } catch {
        /* ignore */
      }
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Não consegui abrir a chuva de ideias. Escreva no chat — já está activo.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setBrainstorming(false);
    }
  }, [workspaceId, assistantBody, fund, fundId, documentMarkdown, chatMessages, persistDraft]);

  useEffect(() => {
    if (loading || !workspaceId) return;
    if (chatMessages.some((m) => m.role === 'assistant')) return;
    if (documentMarkdown.trim().length > 80) return;
    void runBrainstorm();
  }, [loading, workspaceId, chatMessages, documentMarkdown, runBrainstorm]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [chatMessages, chatLoading, brainstorming]);

  const handleSendChat = useCallback(async () => {
    const message = chatInput.trim();
    if (!message || chatLoading) return;
    const nextUser: ChatMessage = { role: 'user', content: message, createdAt: new Date().toISOString() };
    setChatMessages((prev) => [...prev, nextUser]);
    setChatInput('');
    setChatLoading(true);
    try {
      const response = await fetch('/api/proposals/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assistantBody('chat', message)),
      });
      const data = await response.json();
      const reply: ChatMessage = {
        role: 'assistant',
        content: data.answer || data.error || 'Não foi possível gerar a resposta.',
        createdAt: new Date().toISOString(),
      };
      setChatMessages((prev) => {
        const next = [...prev, reply];
        persistDraft({ chat: next });
        return next;
      });
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Erro ao conectar com o assistente.', createdAt: new Date().toISOString() },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, assistantBody, persistDraft]);

  const insertIntoDocument = useCallback(
    (text: string) => {
      const block = text.trim();
      if (!block) return;
      setDocumentMarkdown((prev) => {
        const next = prev.trim()
          ? `${prev.trim()}\n\n${block}\n`
          : seedDocumentMarkdown(fund || { id: 'adhoc', name: 'Proposta' }, block);
        persistDraft({ documentMarkdown: next });
        return next;
      });
      setDocMode('edit');
      setDraftSaved(false);
    },
    [fund, persistDraft],
  );

  const handleGenerateStructure = useCallback(async () => {
    setChatLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/proposals/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assistantBody('structure', 'Gera a estrutura da proposta.')),
      });
      const data = await response.json();
      const answer = String(data.answer || '');
      const titles = answer
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*[\d\-\)\.]+\s*/, '').trim())
        .filter(Boolean);
      if (titles.length) {
        setDocumentMarkdown((prev) => {
          const existing = prev.trim();
          const extra = titles
            .filter((t) => !existing.toLowerCase().includes(`## ${t.toLowerCase()}`))
            .map((t) => `## ${t}\n\n`)
            .join('\n');
          const next = extra ? `${existing}\n\n${extra}` : existing;
          persistDraft({ documentMarkdown: next });
          return next;
        });
      }
      setChatMessages((prev) => {
        const next = [
          ...prev,
          { role: 'assistant' as const, content: answer || 'Estrutura gerada.', createdAt: new Date().toISOString() },
        ];
        persistDraft({ chat: next });
        return next;
      });
    } catch {
      setError('Não foi possível gerar a estrutura.');
    } finally {
      setChatLoading(false);
    }
  }, [assistantBody, persistDraft]);

  const handleAttachFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const MAX_FILES = 50;
    const MAX_FILE_BYTES = 25 * 1024 * 1024;
    const ACCEPTED_EXT =
      /\.(pdf|docx?|xlsx?|pptx?|txt|md|csv|rtf|odt|ods|odp|zip|rar|7z|png|jpe?g|gif|webp)$/i;
    setAttachedFiles((prev) => {
      const next = [...prev];
      for (const file of files) {
        if (next.length >= MAX_FILES) break;
        if (!ACCEPTED_EXT.test(file.name) || file.size > MAX_FILE_BYTES) continue;
        if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
        next.push({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
        });
      }
      return next;
    });
  }, []);

  const exportAsMarkdown = useCallback(() => {
    if (documentMarkdown.trim()) return documentMarkdown;
    return `# ${fund?.name || 'Proposta'}\n`;
  }, [documentMarkdown, fund]);

  const downloadProposal = useCallback(
    (format: 'markdown' | 'json') => {
      const content =
        format === 'markdown'
          ? exportAsMarkdown()
          : JSON.stringify(
              {
                fund: fund?.name,
                editalLink,
                intakeNotes,
                documentMarkdown,
                exportedAt: new Date().toISOString(),
              },
              null,
              2,
            );
      const blob = new Blob([content], { type: format === 'markdown' ? 'text/markdown' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposta_${fund?.name || 'export'}_${Date.now()}.${format === 'markdown' ? 'md' : 'json'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [exportAsMarkdown, fund, editalLink, intakeNotes, documentMarkdown],
  );

  const openInStudio = useCallback(async () => {
    const sections = sectionsFromMarkdown(documentMarkdown).filter((s) => s.title.trim() || s.content.trim());
    if (!sections.length) {
      setError('Escreva no documento antes de abrir no Studio.');
      return;
    }
    setOpeningStudio(true);
    setError(null);
    try {
      const r = await fetch('/api/studio/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'fundhub_proposal',
          title: fund?.name ? `Proposta · ${fund.name}` : 'Proposta',
          sections: sections.map((s) => ({ title: s.title, content: s.content })),
        }),
      });
      const d = (await r.json()) as { document?: { id: string }; error?: string };
      if (!r.ok || !d.document?.id) throw new Error(d.error || 'Falha ao abrir no Studio');
      router.push(`/hub/studio/${d.document.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao abrir no Studio');
    } finally {
      setOpeningStudio(false);
    }
  }, [documentMarkdown, fund, router]);

  const submitProposal = useCallback(async () => {
    if (!documentMarkdown.trim()) {
      setError('Escreva a proposta antes de marcar como enviada.');
      return;
    }
    if (!workspaceId) {
      setError('Workspace não identificado.');
      return;
    }
    setIsSubmitting(true);
    try {
      persistDraft();
      const proposalDrafts = localStorage.getItem('proposalDrafts') || '[]';
      const drafts = JSON.parse(proposalDrafts);
      const draftIndex = drafts.findIndex((d: { workspaceId?: string }) => d.workspaceId === workspaceId);
      if (draftIndex >= 0) {
        drafts[draftIndex].status = 'submitted';
        localStorage.setItem('proposalDrafts', JSON.stringify(drafts));
      }
      setError(null);
    } catch {
      setError('Erro ao enviar proposta.');
    } finally {
      setIsSubmitting(false);
    }
  }, [documentMarkdown, workspaceId, persistDraft]);

  const officialUrl = editalLink || fund?.linkOficial || '';

  const headerMeta = useMemo(() => {
    const bits = [fund?.institution, fund?.countries].filter(Boolean);
    return bits.join(' · ');
  }, [fund]);

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-3">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/hub/fundhub/proposals" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" /> Propostas
          </Link>
          <h1 className="mt-2 truncate text-2xl font-bold text-gray-900">{fund?.name || 'Proposta'}</h1>
          {headerMeta && <p className="text-sm text-gray-600">{headerMeta}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {officialUrl && (
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Edital
            </a>
          )}
          <button
            type="button"
            onClick={() => persistDraft()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Save className="h-3.5 w-3.5" />
            {draftSaved ? 'Guardado' : 'Guardar'}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu((v) => !v)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Exportar
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    downloadProposal('markdown');
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
                >
                  Markdown
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadProposal('json');
                    setShowExportMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
                >
                  JSON
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => void openInStudio()}
            disabled={openingStudio || !documentMarkdown.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
          >
            {openingStudio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
            Studio
          </button>
          <button
            type="button"
            onClick={() => void submitProposal()}
            disabled={isSubmitting || !documentMarkdown.trim()}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isSubmitting ? 'A enviar…' : 'Marcar enviada'}
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {coalitionPool.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold text-gray-900">Coligação nesta proposta</p>
          <p className="mt-0.5 text-[11px] text-gray-500">Membros já na página Coalizão — papel e % do orçamento.</p>
          <ul className="mt-2 space-y-1.5">
            {coalitionPool.map((m) => {
              const picked = coalition.find((c) => c.id === m.id);
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="inline-flex items-center gap-1.5 text-gray-800">
                    <input
                      type="checkbox"
                      checked={Boolean(picked)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...coalition, { id: m.id, orgName: m.orgName, role: m.role, budgetPct: 0 }]
                          : coalition.filter((c) => c.id !== m.id);
                        setCoalition(next);
                        persistDraft({ coalition: next });
                      }}
                    />
                    <span className="font-medium">{m.orgName}</span>
                    <span className="text-gray-500">{m.role}</span>
                  </label>
                  {picked && (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={picked.budgetPct ?? 0}
                      onChange={(e) => {
                        const budgetPct = Number(e.target.value);
                        const next = coalition.map((c) => (c.id === m.id ? { ...c, budgetPct } : c));
                        setCoalition(next);
                        persistDraft({ coalition: next });
                      }}
                      className="w-16 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-amber-600" />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.2fr)]">
          <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-gray-900">Chat</p>
              <button
                type="button"
                onClick={() => void handleGenerateStructure()}
                disabled={chatLoading}
                className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:underline disabled:opacity-50"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                Estrutura
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {brainstorming && chatMessages.length === 0 && (
                <div className="rounded-xl bg-amber-500/15 px-3 py-3 text-sm text-amber-100">
                  <p className="flex items-center gap-2 font-medium text-amber-100">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-300" />
                    Chuva de ideias…
                  </p>
                  <p className="mt-1 text-xs text-amber-200/90">Pode escrever no chat já — o documento está ao lado.</p>
                </div>
              )}
              {chatMessages.map((message, index) => (
                <div
                  key={`${message.createdAt}-${index}`}
                  className={`rounded-xl px-3 py-2.5 text-sm ${
                    message.role === 'assistant' ? 'bg-gray-50 text-gray-800' : 'bg-amber-50 text-gray-900'
                  }`}
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {message.role === 'assistant' ? 'IA' : 'Você'}
                  </p>
                  <StudioMarkdown text={message.content} />
                  {message.role === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => insertIntoDocument(message.content)}
                      className="mt-2 text-xs font-medium text-amber-800 hover:underline"
                    >
                      Inserir no documento
                    </button>
                  )}
                </div>
              ))}
              {chatLoading && (
                <p className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> A escrever…
                </p>
              )}
              <div ref={chatEndRef} />
            </div>
            <form
              className="border-t border-gray-100 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendChat();
              }}
            >
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendChat();
                  }
                }}
                rows={3}
                placeholder="Pergunte ou peça para redigir uma secção…"
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar
                </button>
              </div>
            </form>
          </section>

          <section className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-gray-900">Documento</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDocMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
                >
                  {docMode === 'edit' ? <Eye className="h-3.5 w-3.5" /> : <PenLine className="h-3.5 w-3.5" />}
                  {docMode === 'edit' ? 'Pré-ver' : 'Editar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAttach((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Anexos{attachedFiles.length ? ` (${attachedFiles.length})` : ''}
                </button>
              </div>
            </div>
            {showAttach && (
              <div className="border-b border-gray-100 px-4 py-3 text-xs">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 hover:bg-gray-50">
                  <Paperclip className="h-3.5 w-3.5" />
                  Anexar
                  <input type="file" multiple className="hidden" onChange={handleAttachFile} />
                </label>
                {attachedFiles.length > 0 && (
                  <ul className="mt-2 space-y-1 text-gray-600">
                    {attachedFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex justify-between gap-2">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          className="text-red-600"
                          onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== index))}
                        >
                          Remover
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {docMode === 'edit' ? (
              <textarea
                value={documentMarkdown}
                onChange={(e) => {
                  setDocumentMarkdown(e.target.value);
                  setDraftSaved(false);
                }}
                className="min-h-0 flex-1 resize-none border-0 px-4 py-3 font-mono text-sm leading-relaxed text-gray-900 outline-none"
                placeholder="O documento abre aqui. A chuva de ideias entra na secção Ideia geral."
              />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <StudioMarkdown text={documentMarkdown} emptyHint="Documento vazio." />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
