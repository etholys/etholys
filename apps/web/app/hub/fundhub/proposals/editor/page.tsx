'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/app/providers';
import { ui } from '@/lib/i18n';
import { cn, isLikelyDbId } from '@/lib/utils';
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
  ExternalLink,
  History,
  Mic,
  Square,
  Sparkles,
  PanelRightClose,
  PanelRightOpen,
  MessageSquare,
  FileText,
  ClipboardCheck,
  ChevronDown,
  X,
  Library,
  Image as ImageIcon,
  ScrollText,
} from 'lucide-react';
import { StudioMarkdown } from '@/lib/studio/markdown-lite';
import { RichTextPane } from '@/components/etholys/RichTextPane';
import {
  appendWriteSections,
  formatProposalFileContext,
  hydrateProposalAttachedFiles,
  mergeDraftIntoMarkdown,
  persistableProposalFiles,
  seedDocumentMarkdown,
  seedUnderstandMarkdown,
  sectionsFromMarkdown,
  type ProposalAttachedFile,
  type ProposalFileRole,
  type ProposalFundSeed,
} from '@/lib/opportunity/proposal-workspace';
import {
  checklistFromCandidateFields,
  appendChecklistSections,
  checklistToSectionTitles,
} from '@/lib/opportunity/rfp-checklist';
import { ProposalReviewPanel } from '@/components/fundhub/ProposalReviewPanel';
import {
  parseReviewStatus,
  reviewStatusLabel,
  type ProposalReviewStatus,
} from '@/lib/opportunity/proposal-review';

interface Fund extends ProposalFundSeed {
  id: string;
  name: string;
  institution: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  /** Reply was merged into the canvas (Redactar). */
  applied?: boolean;
}

type AttachedFile = ProposalAttachedFile;

const FILE_ROLE_CYCLE: ProposalFileRole[] = ['turn', 'reference', 'bases'];

function fileRoleLabel(locale: string, role: ProposalFileRole): string {
  if (role === 'bases') return ui(locale, 'Bases', 'Bases', 'RFP');
  if (role === 'reference') return ui(locale, 'Referencia', 'Referência', 'Reference');
  return ui(locale, 'Este mensaje', 'Esta mensagem', 'This turn');
}

function nextFileRole(role: ProposalFileRole): ProposalFileRole {
  const i = FILE_ROLE_CYCLE.indexOf(role);
  return FILE_ROLE_CYCLE[(i + 1) % FILE_ROLE_CYCLE.length]!;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Remove chuva de ideias que o modelo às vezes cola no briefing «understand». */
function stripUnsolicitedBrainstorm(text: string): string {
  const cut = text.search(
    /\n(?:#{1,3}\s*)?(?:\*\*)?(?:💡\s*)?(?:\d+[–-]\d+\s+)?(?:ideias?\s+para|ideas?\s+(?:para|to)|brainstorm|chuva de ideias|lluvia de ideas)/i,
  );
  if (cut > 80) return text.slice(0, cut).trim();
  return text.trim();
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [stage, setStage] = useState<'understand' | 'write'>('understand');
  const [understanding, setUnderstanding] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [composerMode, setComposerMode] = useState<'talk' | 'write'>('talk');
  const [showChatAttachMenu, setShowChatAttachMenu] = useState(false);
  const [attachAsRole, setAttachAsRole] = useState<ProposalFileRole>('turn');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openingStudio, setOpeningStudio] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [rightRailCollapsed, setRightRailCollapsed] = useState(false);
  const [rightRailTab, setRightRailTab] = useState<'review' | 'document'>('document');
  const [rightRailMenuOpen, setRightRailMenuOpen] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const [coalitionPool, setCoalitionPool] = useState<Array<{ id: string; orgName: string; role: string }>>([]);
  const [coalition, setCoalition] = useState<Array<{ id: string; orgName: string; role: string; budgetPct?: number }>>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<
    Array<{ id: string; versionNum: number; label: string; createdAt: string; content: string }>
  >([]);
  const [versionsBusy, setVersionsBusy] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<ProposalReviewStatus>('draft');
  const understandRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fundhubProposalRightRail');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { collapsed?: boolean; tab?: 'review' | 'document' };
      if (typeof parsed.collapsed === 'boolean') setRightRailCollapsed(parsed.collapsed);
      if (parsed.tab === 'review' || parsed.tab === 'document') setRightRailTab(parsed.tab);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'fundhubProposalRightRail',
        JSON.stringify({ collapsed: rightRailCollapsed, tab: rightRailTab }),
      );
    } catch {
      /* ignore */
    }
  }, [rightRailCollapsed, rightRailTab]);

  const rfpChecklist = useMemo(
    () =>
      checklistFromCandidateFields(
        {
          basesText: fund?.basesText,
          sourceExcerpt: fund?.sourceExcerpt,
          eligibility: fund?.eligibility,
          whoCanApply: fund?.whoCanApply,
          requirements: fund?.requirements,
        },
        locale,
      ),
    [fund?.basesText, fund?.sourceExcerpt, fund?.eligibility, fund?.whoCanApply, fund?.requirements, locale],
  );

  const persistDraft = useCallback(
    (patch?: {
      documentMarkdown?: string;
      intakeNotes?: string;
      chat?: ChatMessage[];
      coalition?: typeof coalition;
      stage?: 'understand' | 'write';
      reviewStatus?: ProposalReviewStatus;
    }) => {
      if (!workspaceId || typeof window === 'undefined') return;
      const md = patch?.documentMarkdown ?? documentMarkdown;
      const notes = patch?.intakeNotes ?? intakeNotes;
      const chats = patch?.chat ?? chatMessages;
      const nextStage = patch?.stage ?? stage;
      const nextReview = patch?.reviewStatus ?? reviewStatus;
      if (patch?.reviewStatus) setReviewStatus(patch.reviewStatus);
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
        reviewStatus: nextReview,
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
          attachedFiles: persistableProposalFiles(attachedFiles),
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

      const resolvedFundId = String(fund?.id || fundId || '').trim();
      if (companyId && resolvedFundId && isLikelyDbId(resolvedFundId)) {
        void fetch(
          `/api/fundhub/proposals?companyId=${encodeURIComponent(companyId)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspaceId,
              fundId: resolvedFundId,
              title: fund?.name || 'Proposta',
              editalLink,
              editalSummary: notes,
              status: 'draft',
              documentMarkdown: md,
              chatMessages: chats,
              stage: nextStage,
              reviewStatus: nextReview,
              coalition: patch?.coalition ?? coalition,
              sections: sectionsFromMarkdown(md),
            }),
          },
        ).catch(() => {
          /* local cache already saved */
        });
      }
    },
    [
      workspaceId,
      fund,
      fundId,
      companyId,
      editalLink,
      intakeNotes,
      attachedFiles,
      documentMarkdown,
      chatMessages,
      coalition,
      stage,
      reviewStatus,
    ],
  );

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      setError(
        ui(
          locale,
          'Workspace no encontrado. Vuelva a Propuestas.',
          'Workspace não encontrado. Volte a Propostas.',
          'Workspace not found. Go back to Proposals.',
        ),
      );
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
        setAttachedFiles(hydrateProposalAttachedFiles(intake.attachedFiles));
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
        if (Array.isArray(draft.attachedFiles) && draft.attachedFiles.length) {
          setAttachedFiles(hydrateProposalAttachedFiles(draft.attachedFiles));
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
        if (typeof p.documentMarkdown === 'string' && p.documentMarkdown.trim() && !documentMarkdown) {
          setDocumentMarkdown(p.documentMarkdown);
        } else if (p.sections?.length && !documentMarkdown) {
          const md = p.sections
            .map((s: { title?: string; content?: string }) => `## ${s.title || 'Secção'}\n\n${s.content || ''}`)
            .join('\n\n');
          setDocumentMarkdown(md);
        }
        if (Array.isArray(p.chatMessages) && p.chatMessages.length) {
          setChatMessages(p.chatMessages as ChatMessage[]);
        }
        if (p.stage === 'write' || p.stage === 'understand') setStage(p.stage);
        if (p.reviewStatus) setReviewStatus(parseReviewStatus(p.reviewStatus));
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
      workspaceFilesBlock: formatProposalFileContext(attachedFiles.filter((f) => f.role !== 'turn')),
      documents: fund?.documents,
      rfpChecklist: rfpChecklist.map((i) => ({ id: i.id, label: i.label, kind: i.kind })),
      locale,
    }),
    [companyId, fund, editalLink, intakeNotes, documentMarkdown, rfpChecklist, locale, attachedFiles],
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
      const answer = stripUnsolicitedBrainstorm(String(data.answer));
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
    setComposerMode('write');
    setDocumentMarkdown((prev) => {
      // Não injectar «Ideia geral / Rascunho» genéricos se já há checklist do edital —
      // o formato oficial manda; o utilizador usa «Estrutura» se ainda faltar.
      let next =
        prev?.trim() ||
        seedDocumentMarkdown(fund || { id: 'adhoc', name: fund?.name || 'Proposta' }, undefined, locale);
      if (rfpChecklist.length) {
        next = appendChecklistSections(next, rfpChecklist, locale);
      } else if (!/^##\s+/m.test(next)) {
        next = appendWriteSections(next, locale);
      }
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
              ? 'Call read. Use «Structure» for sections. Then switch to «Write» so the AI edits the document — «Talk» is Q&A only.'
              : locale === 'pt'
                ? 'Edital lido. Use «Estrutura» para as secções. Depois mude para «Redigir» para a IA escrever no documento — «Conversar» só tira dúvidas.'
                : 'Convocatoria leída. Use «Estructura» para las secciones. Luego cambie a «Redactar» para que la IA escriba en el documento — «Conversar» es solo para dudas.',
          createdAt: new Date().toISOString(),
        },
      ];
      persistDraft({ chat: next, stage: 'write' });
      return next;
    });
  }, [fund, persistDraft, locale, rfpChecklist]);

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
    let message = chatInput.trim();
    if (
      (!message &&
        attachedFiles.every((f) => !f.textExcerpt && !f.dataBase64)) ||
      chatLoading
    )
      return;
    const slashWrite = /^\s*\/(redactar|escribir|write|redige)\b/i.test(message);
    if (slashWrite) {
      message = message.replace(/^\s*\/(redactar|escribir|write|redige)\s*/i, '').trim();
      setComposerMode('write');
    }
    const isWrite = (composerMode === 'write' || slashWrite) && stage === 'write';

    const turnFiles = attachedFiles.filter((f) => f.role === 'turn');
    const attachBlock = formatProposalFileContext(turnFiles);

    const wantsDraftHint =
      isWrite ||
      /\b(item\s*por\s*item|desarroll|redact|complet[ae]|formulari|postulaci[oó]n|escribir|escrev|preench|vamos\s+item|empez|arran[ck])/i.test(
        message,
      );
    const sectionCount = sectionsFromMarkdown(documentMarkdown).filter(
      (s) => !/lectura|leitura|call reading|elegib|bases oficial/i.test(s.title),
    ).length;

    if (wantsDraftHint && rfpChecklist.length && sectionCount < 3) {
      setDocumentMarkdown((prev) => {
        const next = appendChecklistSections(prev, rfpChecklist, locale);
        persistDraft({ documentMarkdown: next });
        return next;
      });
      setRightRailCollapsed(false);
      setRightRailTab('document');
    }

    const draftDirective = isWrite
      ? locale === 'en'
        ? '\n\n[WRITE TO DOCUMENT] Output ONLY the section/punto the user asked for (## heading + text). If they name the applicant org or paste its text, that entity is the applicant — do NOT use the Hub company as proponent. If they are correcting a wrong org, rewrite THAT section only — do not jump to other canvas sections.'
        : locale === 'pt'
          ? '\n\n[ESCREVER NO DOCUMENTO] Saída APENAS da secção/ponto pedido (## título + texto). Se nomearem a postulante ou colarem o texto dela, essa entidade é a postulante — NÃO uses a empresa do Hub. Se corrigirem a org errada, reescreve SÓ essa secção — não saltes para outras do canvas.'
          : '\n\n[ESCRIBIR EN EL DOCUMENTO] Salida SOLO del punto/sección pedido (## título + texto). Si nombran a la postulante o pegan su texto, ESA entidad es la postulante — NO uses la empresa del Hub. Si corrigen la org equivocada, reescribe SOLO esa sección — no saltes a otras del canvas.'
      : '';

    const fullMessage = [message + draftDirective, attachBlock].filter(Boolean).join('\n\n');
    if (!fullMessage.trim()) return;
    const display =
      message ||
      (turnFiles.length
        ? ui(locale, 'Archivo de esta mensaje.', 'Ficheiro desta mensagem.', 'File for this message.')
        : ui(locale, 'Archivos adjuntos enviados.', 'Anexos enviados.', 'Attachments sent.'));
    const nextUser: ChatMessage = {
      role: 'user',
      content: isWrite ? `✎ ${display}` : display,
      createdAt: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, nextUser]);
    setChatInput('');
    if (turnFiles.length) {
      setAttachedFiles((prev) => prev.filter((f) => f.role !== 'turn'));
    }
    setChatLoading(true);
    try {
      const fileParts = [...turnFiles, ...attachedFiles.filter((f) => f.role !== 'turn' && f.dataBase64)]
        .filter((f) => f.dataBase64)
        .slice(0, 3)
        .map((f) => ({
          mimeType: f.type || 'application/octet-stream',
          data: f.dataBase64!,
          name: f.name,
          role: f.role,
        }));
      const response = await fetch('/api/proposals/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...assistantBody(isWrite ? 'draft_section' : 'chat', fullMessage),
          fileParts,
        }),
      });
      const data = await response.json();
      const answer = String(
        data.answer ||
          data.error ||
          (locale === 'en'
            ? 'Could not generate a reply.'
            : locale === 'pt'
              ? 'Não foi possível gerar a resposta.'
              : 'No se pudo generar la respuesta.'),
      );
      let applied = false;
      if (isWrite && answer && !data.error) {
        setDocumentMarkdown((prev) => {
          const next = mergeDraftIntoMarkdown(prev, answer);
          persistDraft({ documentMarkdown: next });
          return next;
        });
        setDraftSaved(false);
        setRightRailCollapsed(false);
        setRightRailTab('document');
        applied = true;
      } else if (wantsDraftHint && answer.includes('## ')) {
        setRightRailCollapsed(false);
        setRightRailTab('document');
      }
      const reply: ChatMessage = {
        role: 'assistant',
        content: applied
          ? `${locale === 'en' ? 'Written into the document.' : locale === 'pt' ? 'Escrito no documento.' : 'Escrito en el documento.'}\n\n${answer}`
          : answer,
        createdAt: new Date().toISOString(),
        applied,
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
  }, [
    chatInput,
    chatLoading,
    attachedFiles,
    assistantBody,
    persistDraft,
    locale,
    documentMarkdown,
    rfpChecklist,
    composerMode,
    stage,
  ]);

  const insertIntoDocument = useCallback(
    (text: string) => {
      const block = text.trim();
      if (!block) return;
      setDocumentMarkdown((prev) => {
        const next = mergeDraftIntoMarkdown(
          prev || seedDocumentMarkdown(fund || { id: 'adhoc', name: 'Proposta' }, block, locale),
          block,
        );
        persistDraft({ documentMarkdown: next });
        return next;
      });
      setDraftSaved(false);
      setRightRailCollapsed(false);
      setRightRailTab('document');
    },
    [fund, persistDraft, locale],
  );

  const handleGenerateStructure = useCallback(async () => {
    setChatLoading(true);
    setError(null);
    setRightRailCollapsed(false);
    setRightRailTab('document');
    try {
      // Preferir formato do edital (checklist) — não inventar outra arquitectura.
      let titles =
        rfpChecklist.length > 0 ? checklistToSectionTitles(rfpChecklist, locale) : [];
      let answer = '';
      if (!titles.length) {
        const response = await fetch('/api/proposals/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            assistantBody(
              'structure',
              ui(
                locale,
                'Genera solo los títulos de sección que pide esta convocatoria.',
                'Gera só os títulos de secção que este edital pede.',
                'Generate only the section titles this call requires.',
              ),
            ),
          ),
        });
        const data = await response.json();
        answer = String(data.answer || '');
        titles = answer
          .split(/\r?\n/)
          .map((line) => line.replace(/^\s*[\d\-\)\.]+\s*/, '').trim())
          .filter(Boolean);
      } else {
        answer = titles.map((t, i) => `${i + 1}. ${t}`).join('\n');
      }
      if (titles.length) {
        setDocumentMarkdown((prev) => {
          const existing = prev.trim();
          const extra = titles
            .filter((t) => !existing.toLowerCase().includes(`## ${t.toLowerCase()}`))
            .map((t) => `## ${t}\n\n`)
            .join('\n');
          let next = extra ? `${existing}\n\n${extra}` : existing;
          if (rfpChecklist.length) {
            next = appendChecklistSections(next, rfpChecklist, locale);
          }
          persistDraft({ documentMarkdown: next });
          return next;
        });
      }
      setChatMessages((prev) => {
        const next = [
          ...prev,
          {
            role: 'assistant' as const,
            content:
              answer ||
              ui(locale, 'Estructura aplicada.', 'Estrutura aplicada.', 'Structure applied.'),
            createdAt: new Date().toISOString(),
          },
        ];
        persistDraft({ chat: next });
        return next;
      });
    } catch {
      setError(
        ui(
          locale,
          'No se pudo generar la estructura.',
          'Não foi possível gerar a estrutura.',
          'Could not generate the structure.',
        ),
      );
    } finally {
      setChatLoading(false);
    }
  }, [assistantBody, persistDraft, rfpChecklist, locale]);

  const handleBrainstorm = useCallback(async () => {
    if (chatLoading) return;
    setChatLoading(true);
    setError(null);
    const userLine = ui(
      locale,
      'Quiero una lluvia de ideas para enmarcar esta propuesta.',
      'Quero uma chuva de ideias para enquadrar esta proposta.',
      'I want a brainstorm to frame this proposal.',
    );
    setChatMessages((prev) => [
      ...prev,
      { role: 'user', content: userLine, createdAt: new Date().toISOString() },
    ]);
    try {
      const response = await fetch('/api/proposals/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assistantBody('brainstorm', userLine)),
      });
      const data = await response.json();
      setChatMessages((prev) => {
        const next = [
          ...prev,
          {
            role: 'assistant' as const,
            content:
              String(data.answer || data.error || '') ||
              ui(locale, 'No se pudo generar ideas.', 'Não foi possível gerar ideias.', 'Could not generate ideas.'),
            createdAt: new Date().toISOString(),
          },
        ];
        persistDraft({ chat: next });
        return next;
      });
    } catch {
      setError(ui(locale, 'Error al pedir ideas.', 'Erro ao pedir ideias.', 'Error requesting ideas.'));
    } finally {
      setChatLoading(false);
    }
  }, [chatLoading, assistantBody, persistDraft, locale]);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (recording || chatLoading || transcribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaChunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) mediaChunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(mediaChunksRef.current, { type: mime });
        mediaChunksRef.current = [];
        if (blob.size < 64) return;
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append('file', blob, 'voice.webm');
          fd.append('locale', locale);
          const r = await fetch('/api/proposals/transcribe', { method: 'POST', body: fd });
          const d = (await r.json()) as { text?: string; error?: string };
          if (!r.ok || !d.text?.trim()) {
            setError(d.error || ui(locale, 'No se pudo transcribir.', 'Não foi possível transcrever.', 'Could not transcribe.'));
            return;
          }
          setChatInput((prev) => (prev.trim() ? `${prev.trim()} ${d.text!.trim()}` : d.text!.trim()));
        } catch {
          setError(ui(locale, 'Error de transcripción.', 'Erro de transcrição.', 'Transcription error.'));
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError(
        ui(
          locale,
          'No se pudo acceder al micrófono.',
          'Não foi possível aceder ao microfone.',
          'Could not access the microphone.',
        ),
      );
    }
  }, [recording, chatLoading, transcribing, locale]);

  const handleAttachFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>, role: ProposalFileRole = attachAsRole) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const MAX_FILES = 50;
    const MAX_FILE_BYTES = 25 * 1024 * 1024;
    const ACCEPTED_EXT =
      /\.(pdf|docx?|xlsx?|pptx?|txt|md|csv|rtf|odt|ods|odp|zip|rar|7z|png|jpe?g|gif|webp)$/i;
    const TEXT_EXT = /\.(txt|md|csv|rtf)$/i;
    const INLINE_EXT = /\.(png|jpe?g|gif|webp|pdf)$/i;
    const additions: AttachedFile[] = [];
    for (const file of files) {
      if (!ACCEPTED_EXT.test(file.name) || file.size > MAX_FILE_BYTES) continue;
      let textExcerpt: string | undefined;
      let dataBase64: string | undefined;
      if (TEXT_EXT.test(file.name) && file.size < 400_000) {
        try {
          textExcerpt = (await file.text()).slice(0, 12_000);
        } catch {
          textExcerpt = undefined;
        }
      }
      if (INLINE_EXT.test(file.name) && file.size < 4_000_000) {
        try {
          const url = await readFileAsDataUrl(file);
          const comma = url.indexOf(',');
          dataBase64 = comma >= 0 ? url.slice(comma + 1) : url;
        } catch {
          dataBase64 = undefined;
        }
      }
      additions.push({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        role,
        textExcerpt,
        dataBase64,
      });
    }
    if (!additions.length) return;
    setAttachedFiles((prev) => {
      const next = [...prev];
      for (const file of additions) {
        if (next.length >= MAX_FILES) break;
        if (next.some((f) => f.name === file.name && f.size === file.size && f.role === file.role)) continue;
        next.push(file);
      }
      return next;
    });
    setShowChatAttachMenu(false);
  },
  [attachAsRole],
);

  const loadVersions = useCallback(async () => {
    if (!workspaceId || !companyId) return;
    setVersionsBusy(true);
    try {
      const r = await fetch(
        `/api/fundhub/proposals/versions?companyId=${encodeURIComponent(companyId)}&workspaceId=${encodeURIComponent(workspaceId)}&locale=${encodeURIComponent(locale)}`,
        { cache: 'no-store' },
      );
      const d = (await r.json()) as { versions?: typeof versions };
      if (r.ok) setVersions(d.versions ?? []);
    } finally {
      setVersionsBusy(false);
    }
  }, [workspaceId, companyId, locale]);

  const saveVersion = useCallback(async () => {
    if (!workspaceId || !companyId || !documentMarkdown.trim()) return;
    setVersionsBusy(true);
    try {
      await fetch(
        `/api/fundhub/proposals/versions?companyId=${encodeURIComponent(companyId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, content: documentMarkdown, force: true }),
        },
      );
      await loadVersions();
      setVersionsOpen(true);
    } finally {
      setVersionsBusy(false);
    }
  }, [workspaceId, companyId, documentMarkdown, loadVersions]);

  const restoreVersion = useCallback(
    async (versionNum: number) => {
      if (!workspaceId || !companyId) return;
      setVersionsBusy(true);
      try {
        const r = await fetch(
          `/api/fundhub/proposals/versions?companyId=${encodeURIComponent(companyId)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspaceId, restoreVersionNum: versionNum }),
          },
        );
        const d = (await r.json()) as { documentMarkdown?: string };
        if (r.ok && d.documentMarkdown) {
          setDocumentMarkdown(d.documentMarkdown);
          persistDraft({ documentMarkdown: d.documentMarkdown });
        }
      } finally {
        setVersionsBusy(false);
      }
    },
    [workspaceId, companyId, persistDraft],
  );

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
      setError(
        ui(
          locale,
          'Escriba en el documento antes de abrir en Studio.',
          'Escreva no documento antes de abrir no Studio.',
          'Write in the document before opening in Studio.',
        ),
      );
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
          title: fund?.name
            ? `${ui(locale, 'Propuesta', 'Proposta', 'Proposal')} · ${fund.name}`
            : ui(locale, 'Propuesta', 'Proposta', 'Proposal'),
          sections: sections.map((s) => ({ title: s.title, content: s.content })),
        }),
      });
      const d = (await r.json()) as { document?: { id: string }; error?: string };
      if (!r.ok || !d.document?.id) {
        throw new Error(
          d.error ||
            ui(locale, 'No se pudo abrir en Studio', 'Falha ao abrir no Studio', 'Could not open in Studio'),
        );
      }
      router.push(`/hub/studio/${d.document.id}`);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : ui(locale, 'Error al abrir en Studio', 'Erro ao abrir no Studio', 'Error opening Studio'),
      );
    } finally {
      setOpeningStudio(false);
    }
  }, [documentMarkdown, fund, router, locale]);

  const submitProposal = useCallback(async () => {
    if (!documentMarkdown.trim()) {
      setError(
        ui(
          locale,
          'Escriba la propuesta antes de marcarla como enviada.',
          'Escreva a proposta antes de marcar como enviada.',
          'Write the proposal before marking it as submitted.',
        ),
      );
      return;
    }
    if (!workspaceId) {
      setError(
        ui(locale, 'Workspace no identificado.', 'Workspace não identificado.', 'Workspace not identified.'),
      );
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
      const resolvedFundId = String(fund?.id || fundId || '').trim();
      if (companyId && resolvedFundId && isLikelyDbId(resolvedFundId)) {
        const r = await fetch(
          `/api/fundhub/proposals?companyId=${encodeURIComponent(companyId)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspaceId,
              fundId: resolvedFundId,
              title: fund?.name || ui(locale, 'Propuesta', 'Proposta', 'Proposal'),
              editalLink,
              editalSummary: intakeNotes,
              status: 'submitted',
              documentMarkdown,
              chatMessages,
              stage,
              coalition,
              sections: sectionsFromMarkdown(documentMarkdown),
            }),
          },
        );
        if (!r.ok) {
          throw new Error(
            ui(locale, 'No se pudo guardar en el servidor', 'Falha ao gravar no servidor', 'Failed to save on server'),
          );
        }
      }
      setError(null);
    } catch {
      setError(ui(locale, 'Error al enviar la propuesta.', 'Erro ao enviar proposta.', 'Error submitting proposal.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    documentMarkdown,
    workspaceId,
    persistDraft,
    companyId,
    fund,
    fundId,
    editalLink,
    intakeNotes,
    chatMessages,
    stage,
    coalition,
    locale,
  ]);

  const officialUrl = editalLink || fund?.linkOficial || '';

  const headerMeta = useMemo(() => {
    const rawInst = String(fund?.institution ?? '').trim();
    const inst =
      !rawInst || /^(sem fundo vinculado|sin fondo vinculado|no fund linked)$/i.test(rawInst)
        ? ui(locale, 'Sin fondo vinculado', 'Sem fundo vinculado', 'No fund linked')
        : rawInst;
    const bits = [inst, fund?.countries].filter(Boolean);
    return bits.join(' · ');
  }, [fund, locale]);

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/hub/fundhub/proposals"
            className="inline-flex items-center gap-2 text-sm text-white/65 transition hover:text-amber-200"
          >
            <ArrowLeft className="h-4 w-4" /> {ui(locale, 'Propuestas', 'Propostas', 'Proposals')}
          </Link>
          <h1 className="mt-2 truncate text-2xl font-bold text-white">
            {fund?.name || ui(locale, 'Propuesta', 'Proposta', 'Proposal')}
          </h1>
          {headerMeta && <p className="text-sm text-white/55">{headerMeta}</p>}
        </div>
        <div className="relative flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => persistDraft()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/90 transition hover:bg-white/[0.1]"
            title={ui(locale, 'Guardar', 'Guardar', 'Save')}
          >
            <Save className="h-3.5 w-3.5" />
            {draftSaved
              ? ui(locale, 'Guardado', 'Guardado', 'Saved')
              : ui(locale, 'Guardar', 'Guardar', 'Save')}
          </button>
          <button
            type="button"
            onClick={() => setShowActionsMenu((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/90 transition hover:bg-white/[0.1]"
            aria-expanded={showActionsMenu}
          >
            {ui(locale, 'Acciones', 'Ações', 'Actions')}
            <ChevronDown className={cn('h-3.5 w-3.5 opacity-70 transition', showActionsMenu && 'rotate-180')} />
          </button>
          {showActionsMenu && (
            <div className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#0C1822] py-1 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)]">
              {officialUrl ? (
                <a
                  href={officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowActionsMenu(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white/80 hover:bg-white/5 hover:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-amber-300" />
                  {ui(locale, 'Edital / convocatoria', 'Edital / convocatória', 'Call notice')}
                </a>
              ) : null}
              <button
                type="button"
                disabled={versionsBusy}
                onClick={() => {
                  setShowActionsMenu(false);
                  setVersionsOpen(true);
                  void loadVersions();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white/80 hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                <History className="h-3.5 w-3.5 text-amber-300" />
                {ui(locale, 'Versiones', 'Versões', 'Versions')}
              </button>
              <div className="my-1 border-t border-white/10" />
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/35">
                {ui(locale, 'Exportar', 'Exportar', 'Export')}
              </p>
              <button
                type="button"
                onClick={() => {
                  downloadProposal('markdown');
                  setShowActionsMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white/80 hover:bg-white/5 hover:text-white"
              >
                Markdown
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadProposal('json');
                  setShowActionsMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white/80 hover:bg-white/5 hover:text-white"
              >
                JSON
              </button>
              <div className="my-1 border-t border-white/10" />
              <button
                type="button"
                disabled={openingStudio || !documentMarkdown.trim()}
                onClick={() => {
                  setShowActionsMenu(false);
                  void openInStudio();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-violet-200 hover:bg-white/5 disabled:opacity-50"
              >
                {openingStudio ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PenLine className="h-3.5 w-3.5" />
                )}
                Studio
              </button>
              <button
                type="button"
                disabled={isSubmitting || !documentMarkdown.trim()}
                onClick={() => {
                  setShowActionsMenu(false);
                  void submitProposal();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-emerald-300 hover:bg-white/5 disabled:opacity-50"
              >
                {isSubmitting
                  ? ui(locale, 'Enviando…', 'A enviar…', 'Submitting…')
                  : ui(locale, 'Marcar como enviada', 'Marcar como enviada', 'Mark as submitted')}
              </button>
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {versionsOpen && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-amber-950">
              {ui(locale, 'Historial de versiones', 'Histórico de versões', 'Version history')}
            </p>
            <button
              type="button"
              disabled={versionsBusy || !documentMarkdown.trim()}
              onClick={() => void saveVersion()}
              className="rounded-lg bg-amber-800 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50"
            >
              {ui(locale, 'Guardar versión ahora', 'Guardar versão agora', 'Save version now')}
            </button>
          </div>
          {versionsBusy && versions.length === 0 ? (
            <p className="mt-2 text-xs text-amber-800/80">…</p>
          ) : versions.length === 0 ? (
            <p className="mt-2 text-xs text-amber-800/80">
              {ui(
                locale,
                'Aún sin versiones — guarde una o edite y grabe la propuesta.',
                'Ainda sem versões — guarde uma ou edite e grave a proposta.',
                'No versions yet — save one or edit and save the proposal.',
              )}
            </p>
          ) : (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs"
                >
                  <span className="font-medium text-gray-900">
                    {v.label}{' '}
                    <span className="font-normal text-gray-500">
                      · {new Date(v.createdAt).toLocaleString(locale === 'pt' ? 'pt-PT' : locale === 'es' ? 'es-ES' : 'en-US')}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={versionsBusy}
                    onClick={() => void restoreVersion(v.versionNum)}
                    className="text-amber-900 underline disabled:opacity-50"
                  >
                    {ui(locale, 'Restaurar', 'Restaurar', 'Restore')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-amber-600" />
        </div>
      ) : (
        <div className="flex min-h-0 gap-3 lg:h-[calc(100dvh-9rem)]">
          <section className="flex h-[70vh] min-h-[22rem] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white lg:h-full">
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
              <p className="text-sm font-semibold text-gray-900">
                {stage === 'understand'
                  ? ui(locale, 'Lectura del edital', 'Leitura do edital', 'Call reading')
                  : ui(locale, 'Chat', 'Chat', 'Chat')}
              </p>
              {stage === 'write' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-1 inline-flex rounded-lg border border-gray-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => setComposerMode('talk')}
                      className={cn(
                        'rounded-md px-2 py-1 text-[11px] font-medium',
                        composerMode === 'talk'
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-50',
                      )}
                    >
                      {ui(locale, 'Conversar', 'Conversar', 'Talk')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerMode('write')}
                      className={cn(
                        'rounded-md px-2 py-1 text-[11px] font-medium',
                        composerMode === 'write'
                          ? 'bg-amber-700 text-white'
                          : 'text-gray-600 hover:bg-gray-50',
                      )}
                    >
                      {ui(locale, 'Redactar', 'Redigir', 'Write')}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleGenerateStructure()}
                    disabled={chatLoading}
                    className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:underline disabled:opacity-50"
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    {ui(locale, 'Estructura', 'Estrutura', 'Structure')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBrainstorm()}
                    disabled={chatLoading}
                    className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:underline disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {ui(locale, 'Ideas', 'Ideias', 'Ideas')}
                  </button>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800">
                  <BookOpen className="h-3.5 w-3.5" />
                  1 / 2 · {ui(locale, 'Entender', 'Entender', 'Understand')}
                </span>
              )}
            </div>
            <div className="fh-pane-scroll min-h-0 flex-1 space-y-3 px-4 py-3">
              {rfpChecklist.length > 0 && stage === 'understand' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/80">
                    {ui(locale, 'Checklist de la convocatoria', 'Checklist do edital', 'RFP checklist')}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {rfpChecklist.map((item) => (
                      <li key={item.id} className="text-xs text-amber-950">
                        · {item.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {understanding && chatMessages.length === 0 && (
                <div className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-950">
                  <p className="flex items-center gap-2 font-medium">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
                    {ui(
                      locale,
                      'Leyendo la convocatoria oficial…',
                      'A ler a convocatória oficial…',
                      'Reading the official call…',
                    )}
                  </p>
                  <p className="mt-1 text-xs text-amber-800/80">
                    {ui(
                      locale,
                      'Página, anexos y bases — aún sin lluvia de ideas ni borrador.',
                      'Página, anexos e bases — ainda sem chuva de ideias nem rascunho.',
                      'Page, annexes and guidelines — no brainstorm or draft yet.',
                    )}
                  </p>
                </div>
              )}
              {stage === 'understand' && chatMessages.some((m) => m.role === 'assistant') && !understanding && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                  <p className="text-xs text-amber-950">
                    {ui(
                      locale,
                      'Confirme la lectura. Solo después avance a escribir la candidatura.',
                      'Confirme a leitura. Só depois avance para escrever a candidatura.',
                      'Confirm the briefing. Only then move on to writing the application.',
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={passToWrite}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                  >
                    <PenLine className="h-3.5 w-3.5" />
                    {ui(locale, 'Pasar a la postulación', 'Passar à postulação', 'Start writing')}
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
                    {message.role === 'assistant'
                      ? ui(locale, 'IA', 'IA', 'AI')
                      : ui(locale, 'Tú', 'Você', 'You')}
                  </p>
                  <StudioMarkdown text={message.content} />
                  {message.role === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => {
                        insertIntoDocument(message.content);
                        setRightRailCollapsed(false);
                        setRightRailTab('document');
                      }}
                      className="mt-2 text-xs font-medium text-amber-800 hover:underline"
                    >
                      {message.applied
                        ? ui(locale, 'Ya está en el documento', 'Já está no documento', 'Already in the document')
                        : ui(locale, 'Insertar en el documento', 'Inserir no documento', 'Insert into document')}
                    </button>
                  )}
                </div>
              ))}
              {chatLoading && (
                <p className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />{' '}
                  {ui(locale, 'Escribiendo…', 'A escrever…', 'Writing…')}
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
                    ? ui(
                        locale,
                        'Pregunte sobre el edital (elegibilidad, plazo, anexos)…',
                        'Pergunte sobre o edital (elegibilidade, prazo, anexos)…',
                        'Ask about the call (eligibility, deadline, annexes)…',
                      )
                    : composerMode === 'write'
                      ? ui(
                          locale,
                          'Redactar: p. ej. «ítem 1 — contexto» — entra en el documento.',
                          'Redigir: p.ex. «item 1 — contexto» — entra no documento.',
                          'Write: e.g. «item 1 — context» — goes into the document.',
                        )
                      : ui(
                          locale,
                          'Conversar sobre el edital, o cambie a Redactar para escribir.',
                          'Conversar sobre o edital, ou mude para Redigir para escrever.',
                          'Talk about the call, or switch to Write to draft.',
                        )
                }
                className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
              <input
                ref={chatFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleAttachFile(e, attachAsRole);
                }}
              />
              {attachedFiles.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {attachedFiles.map((file, index) => (
                    <span
                      key={`${file.role}-${file.name}-${index}`}
                      className={cn(
                        'inline-flex max-w-[14rem] items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-[10px]',
                        file.role === 'bases' && 'bg-amber-50 text-amber-950',
                        file.role === 'reference' && 'bg-sky-50 text-sky-950',
                        file.role === 'turn' && 'bg-emerald-50 text-emerald-950',
                      )}
                      title={`${fileRoleLabel(locale, file.role)} · ${file.name}`}
                    >
                      <button
                        type="button"
                        className="shrink-0 font-semibold underline-offset-2 hover:underline"
                        onClick={() =>
                          setAttachedFiles((prev) =>
                            prev.map((f, i) => (i === index ? { ...f, role: nextFileRole(f.role) } : f)),
                          )
                        }
                      >
                        {fileRoleLabel(locale, file.role)}
                      </button>
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-gray-400 hover:bg-white/80 hover:text-red-600"
                        aria-label={ui(locale, 'Quitar', 'Remover', 'Remove')}
                        onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="relative flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowChatAttachMenu((v) => !v)}
                    className={cn(
                      'relative inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      attachedFiles.length && 'text-amber-800',
                    )}
                    title={ui(locale, 'Adjuntar archivo', 'Anexar ficheiro', 'Attach file')}
                  >
                    <Paperclip className="h-4 w-4" />
                    {attachedFiles.length > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-600 px-1 text-[9px] font-semibold text-white">
                        {attachedFiles.length}
                      </span>
                    )}
                  </button>
                  {showChatAttachMenu && (
                    <div className="absolute bottom-full left-0 z-20 mb-1 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                      <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {ui(locale, 'Adjuntar como', 'Anexar como', 'Attach as')}
                      </p>
                      {(
                        [
                          ['turn', ImageIcon, ui(locale, 'Este mensaje', 'Esta mensagem', 'This turn')],
                          ['reference', Library, ui(locale, 'Referencia', 'Referência', 'Reference')],
                          ['bases', ScrollText, ui(locale, 'Bases / edital', 'Bases / edital', 'RFP / bases')],
                        ] as const
                      ).map(([role, Icon, label]) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => {
                            setAttachAsRole(role);
                            chatFileInputRef.current?.click();
                          }}
                          className={cn(
                            'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[11px] hover:bg-gray-50',
                            attachAsRole === role ? 'font-medium text-gray-900' : 'text-gray-600',
                          )}
                        >
                          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-800" />
                          <span>
                            {label}
                            <span className="mt-0.5 block font-normal text-gray-400">
                              {role === 'turn'
                                ? ui(
                                    locale,
                                    'Captura o recorte para esta respuesta.',
                                    'Captura ou recorte para esta resposta.',
                                    'Screenshot or snippet for this reply.',
                                  )
                                : role === 'reference'
                                  ? ui(
                                      locale,
                                      'CV, informes — evidencia de la org.',
                                      'CV, relatórios — evidência da org.',
                                      'CV, reports — org evidence.',
                                    )
                                  : ui(
                                      locale,
                                      'PDF oficial, plantilla, anexos del donante.',
                                      'PDF oficial, formulário, anexos do doador.',
                                      'Official PDF, form, donor annexes.',
                                    )}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => (recording ? stopRecording() : void startRecording())}
                    disabled={chatLoading || transcribing}
                    className={`inline-flex items-center justify-center rounded-lg p-2 disabled:opacity-50 ${
                      recording
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    title={
                      transcribing
                        ? ui(locale, 'Transcribiendo…', 'A transcrever…', 'Transcribing…')
                        : recording
                          ? ui(locale, 'Detener', 'Parar', 'Stop')
                          : ui(locale, 'Nota de voz', 'Nota de voz', 'Voice note')
                    }
                  >
                    {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={
                    chatLoading ||
                    (!chatInput.trim() &&
                      !attachedFiles.some((f) => f.textExcerpt || (f.role === 'turn' && f.dataBase64)))
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {ui(locale, 'Enviar', 'Enviar', 'Send')}
                </button>
              </div>
            </form>
          </section>

          <aside
            className={cn(
              'flex h-[70vh] min-h-[22rem] flex-shrink-0 flex-col overflow-hidden border border-white/10 bg-[color:var(--sys-aside-bg,rgba(7,17,26,0.92))] text-[color:var(--sys-ink,#E8EEF2)] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.85)] backdrop-blur-md transition-all lg:h-full',
              'rounded-2xl',
              rightRailCollapsed
                ? 'w-16'
                : rightRailTab === 'document'
                  ? 'w-full max-w-xl lg:w-[min(42vw,34rem)]'
                  : 'w-full max-w-sm lg:w-80',
            )}
          >
            {rightRailCollapsed ? (
              <div className="flex h-full flex-col items-center gap-0.5 p-1.5">
                <button
                  type="button"
                  onClick={() => setRightRailCollapsed(false)}
                  className="rounded-lg p-2.5 text-white/70 transition hover:bg-white/5 hover:text-white"
                  title={ui(locale, 'Expandir panel', 'Expandir painel', 'Expand panel')}
                >
                  <PanelRightOpen className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRightRailTab('review');
                    setRightRailCollapsed(false);
                  }}
                  className={cn(
                    'rounded-lg p-2.5 transition',
                    rightRailTab === 'review'
                      ? 'bg-amber-500/15 text-amber-100'
                      : 'text-white/55 hover:bg-white/5 hover:text-white',
                  )}
                  title={ui(locale, 'Revisión', 'Revisão', 'Review')}
                >
                  <ClipboardCheck className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRightRailTab('document');
                    setRightRailCollapsed(false);
                  }}
                  className={cn(
                    'rounded-lg p-2.5 transition',
                    rightRailTab === 'document'
                      ? 'bg-amber-500/15 text-amber-100'
                      : 'text-white/55 hover:bg-white/5 hover:text-white',
                  )}
                  title={ui(locale, 'Documento', 'Documento', 'Document')}
                >
                  <FileText className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex-shrink-0 border-b border-white/10 p-3">
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setRightRailMenuOpen((v) => !v)}
                        className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/85 transition hover:bg-white/[0.07]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {rightRailTab === 'review' ? (
                            <MessageSquare className="h-4 w-4 flex-shrink-0 text-amber-300" />
                          ) : (
                            <FileText className="h-4 w-4 flex-shrink-0 text-amber-300" />
                          )}
                          <span className="truncate font-medium">
                            {rightRailTab === 'review'
                              ? ui(locale, 'Revisión', 'Revisão', 'Review')
                              : ui(locale, 'Documento', 'Documento', 'Document')}
                          </span>
                        </span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 flex-shrink-0 text-white/55 transition',
                            rightRailMenuOpen && 'rotate-180',
                          )}
                        />
                      </button>
                      {rightRailMenuOpen && (
                        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-white/10 bg-[#0C1822] py-1 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)]">
                          {(
                            [
                              ['review', ui(locale, 'Revisión', 'Revisão', 'Review'), MessageSquare],
                              ['document', ui(locale, 'Documento', 'Documento', 'Document'), FileText],
                            ] as const
                          ).map(([key, label, Icon]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setRightRailTab(key);
                                setRightRailMenuOpen(false);
                              }}
                              className={cn(
                                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5',
                                rightRailTab === key
                                  ? 'font-medium text-amber-200'
                                  : 'text-white/70',
                              )}
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRightRailMenuOpen(false);
                        setRightRailCollapsed(true);
                      }}
                      className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/5 hover:text-white"
                      title={ui(locale, 'Minimizar', 'Minimizar', 'Minimize')}
                    >
                      <PanelRightClose className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 truncate px-0.5 text-[11px] text-white/45">
                    {fund?.institution?.trim() &&
                    !/^(sem fundo vinculado|sin fondo vinculado|no fund linked)$/i.test(
                      fund.institution.trim(),
                    )
                      ? fund.institution
                      : ui(locale, 'Sin fondo vinculado', 'Sem fundo vinculado', 'No fund linked')}
                  </p>
                </div>

                {rightRailTab === 'review' ? (
                  <div className="fh-pane-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                    {workspaceId ? <ProposalReviewPanel workspaceId={workspaceId} tone="shell" /> : null}
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                        {ui(locale, 'Revisión', 'Revisão', 'Review')}:
                      </span>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-100">
                          {reviewStatusLabel(reviewStatus, locale)}
                        </span>
                        {(
                          [
                            ['in_review', ui(locale, 'Enviar a revisión', 'Enviar para revisão', 'Send to review')],
                            ['approved', ui(locale, 'Aprobar', 'Aprovar', 'Approve')],
                            [
                              'changes_requested',
                              ui(locale, 'Pedir cambios', 'Pedir alterações', 'Request changes'),
                            ],
                            ['draft', ui(locale, 'Volver a borrador', 'Voltar a rascunho', 'Back to draft')],
                          ] as const
                        ).map(([st, label]) => (
                          <button
                            key={st}
                            type="button"
                            disabled={reviewStatus === st}
                            onClick={() => persistDraft({ reviewStatus: st })}
                            className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-medium text-white/75 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {coalitionPool.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
                        <p className="text-xs font-semibold text-white">
                          {ui(
                            locale,
                            'Coalición en esta propuesta',
                            'Coligação nesta proposta',
                            'Coalition on this proposal',
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/45">
                          {ui(
                            locale,
                            'Miembros de Coalición — rol y % del presupuesto.',
                            'Membros já na página Coalizão — papel e % do orçamento.',
                            'Coalition page members — role and budget %.',
                          )}
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {coalitionPool.map((m) => {
                            const picked = coalition.find((c) => c.id === m.id);
                            return (
                              <li key={m.id} className="flex flex-wrap items-center gap-2 text-xs">
                                <label className="inline-flex items-center gap-1.5 text-white/85">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(picked)}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? [
                                            ...coalition,
                                            { id: m.id, orgName: m.orgName, role: m.role, budgetPct: 0 },
                                          ]
                                        : coalition.filter((c) => c.id !== m.id);
                                      setCoalition(next);
                                      persistDraft({ coalition: next });
                                    }}
                                  />
                                  <span className="font-medium">{m.orgName}</span>
                                  <span className="text-white/45">{m.role}</span>
                                </label>
                                {picked && (
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={picked.budgetPct ?? 0}
                                    onChange={(e) => {
                                      const budgetPct = Number(e.target.value);
                                      const next = coalition.map((c) =>
                                        c.id === m.id ? { ...c, budgetPct } : c,
                                      );
                                      setCoalition(next);
                                      persistDraft({ coalition: next });
                                    }}
                                    className="w-16 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-xs text-white"
                                  />
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="border-b border-white/10 px-3 py-2">
                      <p className="text-sm font-semibold text-white">
                        {stage === 'understand'
                          ? ui(locale, 'Notas del edital', 'Notas do edital', 'Call notes')
                          : ui(locale, 'Documento', 'Documento', 'Document')}
                      </p>
                    </div>
                    <div className="min-h-0 flex-1 overflow-hidden bg-white/[0.03]">
                      <RichTextPane
                        value={documentMarkdown}
                        onChange={(next) => {
                          setDocumentMarkdown(next);
                          setDraftSaved(false);
                        }}
                        placeholder={
                          stage === 'understand'
                            ? ui(
                                locale,
                                'La lectura del edital aparece aquí, ya diagramada. La postulación solo después del botón al lado.',
                                'A leitura do edital aparece aqui, já diagramada. A postulação só depois do botão ao lado.',
                                'The call briefing appears here, laid out. Writing starts only after the button beside the chat.',
                              )
                            : ui(
                                locale,
                                'Escriba la candidatura. Títulos, negrita y listas en la barra de arriba — sin # ni *.',
                                'Escreva a candidatura. Títulos, negrito e listas na barra acima — sem # nem *.',
                                'Write the application. Use the toolbar for headings, bold and lists — no # or *.',
                              )
                        }
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
