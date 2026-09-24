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
  BookOpen,
  PenLine,
  Loader2,
  Send,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { StudioMarkdown } from '@/lib/studio/markdown-lite';
import {
  appendWriteSections,
  seedDocumentMarkdown,
  seedUnderstandMarkdown,
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
  const { activeCompanyId, locale } = useApp();
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
  const [stage, setStage] = useState<'understand' | 'write'>('understand');
  const [understanding, setUnderstanding] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openingStudio, setOpeningStudio] = useState(false);
  const [coalitionPool, setCoalitionPool] = useState<Array<{ id: string; orgName: string; role: string }>>([]);
  const [coalition, setCoalition] = useState<Array<{ id: string; orgName: string; role: string; budgetPct?: number }>>([]);
  const understandRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const persistDraft = useCallback(
    (patch?: {
      documentMarkdown?: string;
      intakeNotes?: string;
      chat?: ChatMessage[];
      coalition?: typeof coalition;
      stage?: 'understand' | 'write';
    }) => {
      if (!workspaceId || typeof window === 'undefined') return;
      const md = patch?.documentMarkdown ?? documentMarkdown;
      const notes = patch?.intakeNotes ?? intakeNotes;
      const chats = patch?.chat ?? chatMessages;
      const nextStage = patch?.stage ?? stage;
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
      try {
        const intakeRaw = localStorage.getItem(`proposalIntake:${workspaceId}`);
        if (intakeRaw) {
          const intake = JSON.parse(intakeRaw) as Record<string, unknown>;
          intake.stage = nextStage;
          localStorage.setItem(`proposalIntake:${workspaceId}`, JSON.stringify(intake));
        }
      } catch {
        /* ignore */
      }
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          ...draftData,
          attachedFiles,
          documentMarkdown: md,
          chatMessages: chats,
          stage: nextStage,
          sourceExcerpt: fund?.sourceExcerpt,
          basesText: fund?.basesText,
          documents: fund?.documents,
          brainstormDone: chats.some((m) => m.role === 'assistant'),
          sections: sectionsFromMarkdown(md),
        }),
      );
      setDraftSaved(true);
    },
    [workspaceId, fund, fundId, editalLink, intakeNotes, attachedFiles, documentMarkdown, chatMessages, coalition, stage],
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
        if (intake.stage === 'write' || intake.stage === 'understand') setStage(intake.stage);
        if (intake.fundName) {
          seededFund = {
            id: intake.fundId || fundId || 'adhoc',
            name: intake.fundName,
            institution: intake.fundInstitution || '',
            linkOficial: intake.editalLink,
            description: intake.intakeNotes,
            sourceExcerpt: intake.sourceExcerpt,
            basesText: intake.basesText,
            documents: Array.isArray(intake.documents) ? intake.documents : undefined,
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
        if (draft.stage === 'write' || draft.stage === 'understand') setStage(draft.stage);
        else if (Array.isArray(draft.chatMessages) && draft.chatMessages.some((m: ChatMessage) => m.role === 'assistant')) {
          setStage('write');
        }
        if (draft.fundName && !seededFund) {
          seededFund = {
            id: draft.fundId || fundId || 'adhoc',
            name: draft.fundName,
            institution: draft.fundInstitution || '',
            sourceExcerpt: draft.sourceExcerpt,
            basesText: draft.basesText,
            documents: Array.isArray(draft.documents) ? draft.documents : undefined,
          };
        } else if (seededFund) {
          seededFund = {
            ...seededFund,
            sourceExcerpt: seededFund.sourceExcerpt || draft.sourceExcerpt,
            basesText: seededFund.basesText || draft.basesText,
            documents: seededFund.documents || (Array.isArray(draft.documents) ? draft.documents : undefined),
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
          setFund((prev) => ({
            ...(prev || {}),
            ...d.fund,
            sourceExcerpt: d.fund.sourceExcerpt || prev?.sourceExcerpt,
            basesText: d.fund.basesText || prev?.basesText,
            documents: d.fund.documents?.length ? d.fund.documents : prev?.documents,
          }));
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
      editalLink: editalLink || fund?.linkOficial || fund?.callUrl,
      editalSummary: intakeNotes,
      documentMarkdown,
      sourceExcerpt: fund?.sourceExcerpt,
      basesText: fund?.basesText,
      documents: fund?.documents,
      locale,
    }),
    [companyId, fund, editalLink, intakeNotes, documentMarkdown, locale],
  );

  const runUnderstand = useCallback(async () => {
    if (!workspaceId || understandRef.current) return;
    const lockKey = `proposalUnderstand:${workspaceId}`;
    try {
      if (sessionStorage.getItem(lockKey)) return;
      sessionStorage.setItem(lockKey, '1');
    } catch {
      /* continue */
    }
    understandRef.current = true;
    setUnderstanding(true);
    setError(null);
    try {
      const response = await fetch('/api/proposals/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assistantBody('understand', '')),
      });
      const data = await response.json();
      if (!response.ok || !data.answer) {
        throw new Error(
          data.error ||
            (locale === 'en'
              ? 'Could not read the call.'
              : locale === 'pt'
                ? 'Não foi possível ler o edital.'
                : 'No se pudo leer la convocatoria.'),
        );
      }
      const answer = String(data.answer);
      const seed = fund || { id: fundId || 'adhoc', name: 'Proposta', institution: '' };
      const replaceBriefing = !chatMessages.some((m) => m.role === 'user');
      const nextDoc =
        !replaceBriefing && documentMarkdown.trim()
          ? documentMarkdown
          : seedUnderstandMarkdown(seed, answer, locale);
      const nextChat: ChatMessage[] = [
        ...chatMessages,
        { role: 'assistant', content: answer, createdAt: new Date().toISOString() },
      ];
      setDocumentMarkdown(nextDoc);
      setChatMessages(nextChat);
      persistDraft({ documentMarkdown: nextDoc, chat: nextChat });
    } catch {
      understandRef.current = false;
      try {
        sessionStorage.removeItem(`proposalUnderstand:${workspaceId}`);
      } catch {
        /* ignore */
      }
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            locale === 'en'
              ? 'I could not read the call automatically. Paste the official link again or attach the PDF — do not start writing without this briefing.'
              : locale === 'pt'
                ? 'Não consegui ler o edital automaticamente. Cole o link outra vez ou anexe o PDF — não avance para a postulação sem esta leitura.'
                : 'No pude leer la convocatoria automáticamente. Vuelva a pegar el enlace oficial o adjunte el PDF — no pase a la postulación sin esta lectura.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setUnderstanding(false);
    }
  }, [workspaceId, assistantBody, fund, fundId, documentMarkdown, chatMessages, persistDraft, locale]);

  const passToWrite = useCallback(() => {
    setStage('write');
    setDocumentMarkdown((prev) => {
      const next = appendWriteSections(
        prev || seedDocumentMarkdown(fund || { id: 'adhoc', name: fund?.name || 'Proposta' }, undefined, locale),
        locale,
      );
      persistDraft({ documentMarkdown: next, stage: 'write' });
      return next;
    });
    setChatMessages((prev) => {
      const next: ChatMessage[] = [
        ...prev,
        {
          role: 'assistant',
          content:
            locale === 'en'
              ? 'Call read. You can structure the application, ask for a section draft, or use the canvas.'
              : locale === 'pt'
                ? 'Edital lido. Pode estruturar a candidatura, pedir um rascunho de secção ou usar o canvas ao lado.'
                : 'Convocatoria leída. Puede estructurar la candidatura, pedir un borrador de sección o usar el canvas.',
          createdAt: new Date().toISOString(),
        },
      ];
      persistDraft({ chat: next, stage: 'write' });
      return next;
    });
  }, [fund, persistDraft, locale]);

  useEffect(() => {
    if (loading || !workspaceId) return;
    if (stage !== 'understand') return;
    if (chatMessages.some((m) => m.role === 'assistant')) return;
    void runUnderstand();
  }, [loading, workspaceId, stage, chatMessages, runUnderstand]);

  const localeAppliedRef = useRef(locale);
  useEffect(() => {
    if (loading || !workspaceId) return;
    if (stage !== 'understand') return;
    if (localeAppliedRef.current === locale) return;
    localeAppliedRef.current = locale;
    if (chatMessages.some((m) => m.role === 'user')) return;
    understandRef.current = false;
    try {
      sessionStorage.removeItem(`proposalUnderstand:${workspaceId}`);
    } catch {
      /* ignore */
    }
    setChatMessages([]);
  }, [locale, loading, workspaceId, stage, chatMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [chatMessages, chatLoading, understanding]);

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
        content:
          data.answer ||
          data.error ||
          (locale === 'en'
            ? 'Could not generate a reply.'
            : locale === 'pt'
              ? 'Não foi possível gerar a resposta.'
              : 'No se pudo generar la respuesta.'),
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
        {
          role: 'assistant',
          content:
            locale === 'en'
              ? 'Could not reach the assistant.'
              : locale === 'pt'
                ? 'Erro ao conectar com o assistente.'
                : 'Error al conectar con el asistente.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, assistantBody, persistDraft, locale]);

  const insertIntoDocument = useCallback(
    (text: string) => {
      const block = text.trim();
      if (!block) return;
      setDocumentMarkdown((prev) => {
        const next = prev.trim()
          ? `${prev.trim()}\n\n${block}\n`
          : seedDocumentMarkdown(fund || { id: 'adhoc', name: 'Proposta' }, block, locale);
        persistDraft({ documentMarkdown: next });
        return next;
      });
      setDocMode('edit');
      setDraftSaved(false);
    },
    [fund, persistDraft, locale],
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
    <div className="flex flex-col gap-3">
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
        <div className="grid min-h-0 gap-3 lg:h-[calc(100dvh-11rem)] lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.2fr)]">
          <section className="flex h-[70vh] min-h-[22rem] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white lg:h-full">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-gray-900">
                {stage === 'understand' ? 'Leitura do edital' : 'Chat'}
              </p>
              {stage === 'write' ? (
                <button
                  type="button"
                  onClick={() => void handleGenerateStructure()}
                  disabled={chatLoading}
                  className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:underline disabled:opacity-50"
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  Estrutura
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800">
                  <BookOpen className="h-3.5 w-3.5" />
                  1 / 2 · Entender
                </span>
              )}
            </div>
            <div className="fh-pane-scroll min-h-0 flex-1 space-y-3 px-4 py-3">
              {understanding && chatMessages.length === 0 && (
                <div className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-950">
                  <p className="flex items-center gap-2 font-medium">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
                    A ler a convocatória oficial…
                  </p>
                  <p className="mt-1 text-xs text-amber-800/80">
                    Página, anexos e bases — ainda sem chuva de ideias nem rascunho.
                  </p>
                </div>
              )}
              {stage === 'understand' && chatMessages.some((m) => m.role === 'assistant') && !understanding && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                  <p className="text-xs text-amber-950">
                    Confirme a leitura. Só depois avance para escrever a candidatura.
                  </p>
                  <button
                    type="button"
                    onClick={passToWrite}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                  >
                    <PenLine className="h-3.5 w-3.5" />
                    Passar à postulação
                  </button>
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
                placeholder={
                  stage === 'understand'
                    ? 'Pergunte sobre o edital (elegibilidade, prazo, anexos)…'
                    : 'Peça para redigir uma secção ou ajustar o tom do doador…'
                }
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

          <section className="flex h-[70vh] min-h-[22rem] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white lg:h-full">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-gray-900">
                {stage === 'understand' ? 'Notas do edital' : 'Documento'}
              </p>
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
                className="fh-pane-scroll min-h-0 flex-1 resize-none border-0 px-4 py-3 font-mono text-sm leading-relaxed text-gray-900 outline-none"
                placeholder={
                  stage === 'understand'
                    ? 'A leitura do edital aparece aqui. A postulação só depois do botão ao lado.'
                    : 'Escreva a candidatura. Use Estrutura no chat quando quiser as secções.'
                }
              />
            ) : (
              <div className="fh-pane-scroll min-h-0 flex-1 px-5 py-4">
                <StudioMarkdown text={documentMarkdown} emptyHint="Documento vazio." />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
