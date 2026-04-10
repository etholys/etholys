'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Sparkle,
  ClipboardList,
  AlertCircle,
  MessageCircle,
  Paperclip,
  Lightbulb,
} from 'lucide-react';

interface Fund {
  id: string;
  name: string;
  institution: string;
  type: string;
  category: string;
  amount: number;
  currency: string;
  deadline: string;
  countries: string;
  sectors: string;
  description?: string;
  linkOficial?: string;
  matchScore?: number;
  status: string;
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

interface SectionData {
  id: string;
  title: string;
  content: string;
}

export default function FundHubProposalEditorPage() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspace') || searchParams.get('workspaceId');
  const fundId = searchParams.get('fundId');
  const initialLink = searchParams.get('editalLink') || '';

  const [fund, setFund] = useState<Fund | null>(null);
  const [loadingFund, setLoadingFund] = useState(true);
  const [editalLink, setEditalLink] = useState(initialLink);
  const [intakeNotes, setIntakeNotes] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [proposalSections, setProposalSections] = useState<SectionData[]>([]);
  const [activeSection, setActiveSection] = useState('workflow');
  const [analysisResult, setAnalysisResult] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'O assistente de editais está pronto. Peça para analisar o edital ou gerar seções da proposta.', createdAt: new Date().toISOString() },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sectionTabs = useMemo(() => {
    const baseTabs = [
      { id: 'workflow', label: 'Fluxo' },
      { id: 'chat', label: 'Chat' },
    ];
    return [...baseTabs, ...proposalSections.map((section) => ({ id: section.id, label: section.title }))];
  }, [proposalSections]);

  useEffect(() => {
    if (!workspaceId) {
      setLoadingFund(false);
      setError('ID do workspace não encontrado. Volte e tente novamente.');
      return;
    }

    const intakeKey = `proposalIntake:${workspaceId}`;
    const draftKey = `proposalDraft:${workspaceId}`;

    if (typeof window !== 'undefined') {
      // Load intake data (from initial creation)
      const savedIntake = window.localStorage.getItem(intakeKey);
      if (savedIntake) {
        try {
          const intake = JSON.parse(savedIntake);
          setEditalLink(intake.editalLink || initialLink);
          setAttachedFiles(intake.attachedFiles || []);
          setIntakeNotes(intake.intakeNotes || '');
        } catch (err) {
          console.error('Error loading intake:', err);
        }
      }

      // Load existing draft (from previous edits)
      const savedDraft = window.localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          setProposalSections(draft.sections || []);
          // Don't override intakeNotes if already set from intake
          if (!savedIntake && draft.editalSummary) {
            setIntakeNotes(draft.editalSummary);
          }
          setDraftSaved(true);
        } catch (err) {
          console.error('Error loading draft:', err);
        }
      }
    }
    setLoadingFund(false);
  }, [workspaceId, initialLink]);

  useEffect(() => {
    if (!fundId) {
      setLoadingFund(false);
      return;
    }

    const fetchFund = async () => {
      try {
        setLoadingFund(true);
        const response = await fetch(`/api/funds/${fundId}`);
        if (!response.ok) throw new Error('Fundo não encontrado');
        const data = await response.json();
        setFund(data.fund);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingFund(false);
      }
    };

    fetchFund();
  }, [fundId]);

  const saveDraft = useCallback(() => {
    if (!workspaceId) {
      setError('Workspace não identificado.');
      return;
    }
    if (typeof window === 'undefined') return;

    try {
      const draftKey = `proposalDraft:${workspaceId}`;
      const proposalDrafts = localStorage.getItem('proposalDrafts') || '[]';
      const drafts = JSON.parse(proposalDrafts);
      
      const draftIndex = drafts.findIndex((d: any) => d.workspaceId === workspaceId);
      const draftData = {
        workspaceId,
        fundId: fund?.id || null,
        fundName: fund?.name || 'Sem fund',
        fundInstitution: fund?.institution || '',
        editalLink,
        editalSummary: intakeNotes,
        status: 'draft' as const,
        createdAt: draftIndex >= 0 ? drafts[draftIndex].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (draftIndex >= 0) {
        drafts[draftIndex] = draftData;
      } else {
        drafts.push(draftData);
      }

      localStorage.setItem('proposalDrafts', JSON.stringify(drafts));
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          ...draftData,
          attachedFiles,
          sections: proposalSections,
        })
      );

      setDraftSaved(true);
      setError(null);
      setTimeout(() => setError(null), 2000);
    } catch (err) {
      console.error('Error saving draft:', err);
      setError('Erro ao salvar rascunho.');
    }
  }, [workspaceId, fund, editalLink, intakeNotes, attachedFiles, proposalSections]);

  const handleCopySection = useCallback(async () => {
    const section = proposalSections.find((item) => item.id === activeSection);
    if (!section) return;
    try {
      await navigator.clipboard.writeText(section.content);
      setError('Conteúdo copiado');
    } catch {
      setError('Não foi possível copiar o conteúdo.');
    }
  }, [proposalSections, activeSection]);

  const handleAttachFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const item: AttachedFile = {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
    };
    setAttachedFiles([item, ...attachedFiles.slice(0, 2)]);

    if (file.type.startsWith('text') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const text = await file.text();
      setIntakeNotes((prev) => prev || text.slice(0, 10000));
    }
  }, [attachedFiles]);

  const parseSectionTitles = (answer: string) => {
    const lines = answer
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*[\d\-\)\.]+\s*/, '').trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return ['Objetivos', 'Finanças', 'Cronograma', 'Impacto', 'Equipe'];
    }

    return lines;
  };

  const handleGenerateStructure = useCallback(async () => {
    if (!workspaceId) {
      setError('Workspace não encontrado. Volte à página de propostas e inicie novamente.');
      return;
    }

    setError(null);
    setAnalysisResult('');
    setAnalysisLoading(true);

    try {
      const response = await fetch('/api/proposals/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fundName: fund?.name,
          fundInstitution: fund?.institution,
          editalLink,
          editalSummary: intakeNotes,
          userMessage:
            'Analise o edital e gere apenas os nomes das seções sugeridas para a proposta com base na estrutura do edital. Responda cada seção em uma linha.',
          mode: 'structure',
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const titles = parseSectionTitles(data.answer || '');
      const sections = titles.map((title, index) => ({
        id: `section-${index}`,
        title,
        content: '',
      }));

      setProposalSections(sections);
      setActiveSection(sections[0]?.id || 'workflow');
      setAnalysisResult(data.answer || 'Estrutura gerada.');
    } catch (err: any) {
      console.error(err);
      setError('Não foi possível gerar a estrutura do edital. Tente novamente.');
    } finally {
      setAnalysisLoading(false);
    }
  }, [workspaceId, fund, editalLink, intakeNotes]);

  const handleSendChat = useCallback(async () => {
    const message = chatInput.trim();
    if (!message) return;

    setChatMessages((prev) => [...prev, { role: 'user', content: message, createdAt: new Date().toISOString() }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/proposals/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fundName: fund?.name,
          fundInstitution: fund?.institution,
          editalLink,
          editalSummary: intakeNotes,
          userMessage: message,
        }),
      });

      const data = await response.json();
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer || 'Não foi possível gerar a resposta.', createdAt: new Date().toISOString() },
      ]);
    } catch (err) {
      console.error(err);
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Erro ao conectar com o assistente.', createdAt: new Date().toISOString() },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [fund, editalLink, intakeNotes, chatInput]);

  const updateSectionContent = useCallback((sectionId: string, content: string) => {
    setProposalSections((sections) =>
      sections.map((section) => (section.id === sectionId ? { ...section, content } : section))
    );
    setDraftSaved(false);
  }, []);

  const exportAsMarkdown = useCallback(() => {
    let markdown = `# Proposta: ${fund?.name || 'Sem título'}\n\n`;
    markdown += `**Edital:** ${editalLink || 'N/A'}\n\n`;
    markdown += `**Data:** ${new Date().toLocaleDateString('pt-BR')}\n\n---\n\n`;
    
    if (intakeNotes) {
      markdown += `## Notas do Edital\n\n${intakeNotes}\n\n---\n\n`;
    }

    proposalSections.forEach((section, idx) => {
      markdown += `## ${idx + 1}. ${section.title}\n\n${section.content || '(Vazio)'}\n\n`;
    });

    return markdown;
  }, [fund, editalLink, intakeNotes, proposalSections]);

  const downloadProposal = useCallback((format: 'markdown' | 'json') => {
    const content = format === 'markdown' ? exportAsMarkdown() : JSON.stringify(
      {
        fund: fund?.name,
        editalLink,
        intakeNotes,
        sections: proposalSections,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
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
  }, [exportAsMarkdown, fund, editalLink, intakeNotes, proposalSections]);

  const submitProposal = useCallback(async () => {
    if (proposalSections.length === 0 || proposalSections.some(s => !s.content?.trim())) {
      setError('Todas as seções devem ser preenchidas antes de enviar.');
      return;
    }

    if (!workspaceId) {
      setError('Workspace não identificado.');
      return;
    }

    setIsSubmitting(true);
    try {
      const proposalDrafts = localStorage.getItem('proposalDrafts') || '[]';
      const drafts = JSON.parse(proposalDrafts);
      const draftIndex = drafts.findIndex((d: any) => d.workspaceId === workspaceId);

      if (draftIndex >= 0) {
        drafts[draftIndex].status = 'submitted';
        localStorage.setItem('proposalDrafts', JSON.stringify(drafts));
      }

      const draftKey = `proposalDraft:${workspaceId}`;
      const existingDraft = localStorage.getItem(draftKey);
      if (existingDraft) {
        const draft = JSON.parse(existingDraft);
        draft.status = 'submitted';
        draft.submittedAt = new Date().toISOString();
        localStorage.setItem(draftKey, JSON.stringify(draft));
      }

      setError(null);
      alert('✓ Proposta enviada com sucesso!');
    } catch (err) {
      console.error('Error submitting proposal:', err);
      setError('Erro ao enviar proposta.');
    } finally {
      setIsSubmitting(false);
    }
  }, [workspaceId, proposalSections]);

  const activeSectionData = proposalSections.find((section) => section.id === activeSection);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link href="/hub/fundhub/proposals" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-4 h-4" /> Voltar a Propostas
            </Link>
            <h1 className="mt-4 text-4xl font-bold text-gray-900">Workspace de proposta</h1>
            <p className="mt-2 text-gray-600 max-w-3xl">
              Organize a proposta em abas por seção do edital, não em um texto corrido.
            </p>
          </div>
          <div className="space-y-3 text-right">
            {fund ? (
              <p className="text-sm text-gray-500">Fundo vinculado: <span className="font-semibold text-gray-900">{fund.name}</span></p>
            ) : (
              <p className="text-sm text-gray-500">Nenhum fundo vinculado.</p>
            )}
            <div className="flex gap-2 justify-end">
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Exportar
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg z-10">
                    <button
                      onClick={() => {
                        downloadProposal('markdown');
                        setShowExportMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      📄 Markdown (.md)
                    </button>
                    <button
                      onClick={() => {
                        downloadProposal('json');
                        setShowExportMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 border-t border-gray-200 flex items-center gap-2"
                    >
                      ⚙️ JSON (.json)
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={submitProposal}
                disabled={isSubmitting || proposalSections.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Enviando...' : '✓ Enviar Proposta'}
              </button>
            </div>
          </div>
        </div>

        {loadingFund ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-amber-600" />
          </div>
        ) : (
          <>
            {error && (
              <div className={`mb-6 rounded-lg border px-4 py-3 flex items-start gap-3 ${
                error.includes('✓') 
                  ? 'border-green-200 bg-green-50 text-green-800' 
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}>
                <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                  error.includes('✓') ? 'text-green-600' : 'text-red-600'
                }`} />
                <p className="text-sm">{error}</p>
              </div>
            )}
            <div className="grid gap-8 lg:grid-cols-[1.75fr_0.85fr]">
              <div className="space-y-6">
              <div className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-amber-600 font-semibold">Edital</p>
                    <h2 className="mt-3 text-2xl font-semibold text-gray-900">Intake do edital</h2>
                  </div>
                  <button
                    onClick={handleGenerateStructure}
                    disabled={analysisLoading}
                    className="inline-flex items-center gap-2 rounded-3xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    <Lightbulb className="w-4 h-4" /> Gerar fluxo do edital
                  </button>
                </div>

                <div className="grid gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Link do edital</label>
                    <input
                      value={editalLink}
                      onChange={(event) => setEditalLink(event.target.value)}
                      placeholder="Cole o link do edital aqui"
                      className="w-full rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Notas do edital</label>
                    <textarea
                      value={intakeNotes}
                      onChange={(event) => setIntakeNotes(event.target.value)}
                      rows={5}
                      className="w-full rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      placeholder="Cole os pontos-chave do edital, exigências e observações para que o fluxo seja preciso."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">Arquivos do edital</label>
                    <label className="group flex cursor-pointer items-center gap-3 rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm font-medium text-gray-700 hover:border-amber-300 hover:bg-amber-50">
                      <Paperclip className="w-5 h-5 text-amber-600" />
                      <span>Anexar arquivo</span>
                      <input type="file" accept=".pdf,.docx,.doc,.txt,.md" onChange={handleAttachFile} className="hidden" />
                    </label>
                    {attachedFiles.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
                        <p className="font-semibold">Arquivos anexados</p>
                        {attachedFiles.map((file) => (
                          <p key={file.uploadedAt} className="mt-2">{file.name} • {(file.size / 1024).toFixed(1)} KB</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {analysisResult && (
                  <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-gray-800">
                    <p className="font-semibold text-amber-900 mb-3">Estrutura sugerida</p>
                    <p className="whitespace-pre-line">{analysisResult}</p>
                  </div>
                )}
              </div>

              <div className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm">
                <div className="flex flex-wrap gap-2 mb-5">
                  {sectionTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSection(tab.id)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        activeSection === tab.id
                          ? 'bg-amber-600 text-white shadow'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeSection === 'workflow' && (
                  <div className="space-y-6">
                    <p className="text-sm text-gray-600">
                      O fluxo abaixo representa a estrutura de seções sugerida para este edital. Cada aba deve ser preenchida como um segmento independente da proposta.
                    </p>
                    {proposalSections.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                        Nenhuma seção gerada ainda. Clique em "Gerar fluxo do edital" para começar.
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {proposalSections.map((section, index) => (
                          <div key={section.id} className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                            <p className="font-semibold text-gray-900">{index + 1}. {section.title}</p>
                            <p className="text-sm text-gray-600 mt-2">Preencha os pontos deste bloco na aba correspondente.</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeSection === 'chat' && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {chatMessages.map((message, index) => (
                        <div
                          key={`${message.createdAt}-${index}`}
                          className={`rounded-3xl p-4 ${message.role === 'assistant' ? 'bg-gray-50 text-gray-800' : 'bg-amber-50 text-gray-900'}`}
                        >
                          <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">{message.role === 'assistant' ? 'IA' : 'Você'}</p>
                          <p className="whitespace-pre-line text-sm">{message.content}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                      <textarea
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        rows={4}
                        className="w-full resize-none rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                        placeholder="Pergunte sobre o edital ou peça recomendações para preencher uma seção."
                      />
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-500">A IA usa o contexto do edital para responder.</p>
                        <button
                          onClick={handleSendChat}
                          disabled={chatLoading}
                          className="inline-flex items-center gap-2 rounded-3xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                        >
                          Enviar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection !== 'workflow' && activeSection !== 'chat' && activeSectionData && (
                  <div className="space-y-4">
                    <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.25em] text-amber-600 font-semibold">Seção</p>
                          <h3 className="mt-2 text-xl font-semibold text-gray-900">{activeSectionData.title}</h3>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          <ClipboardList className="w-4 h-4" /> {draftSaved ? 'Rascunho salvo' : 'Não salvo'}
                        </span>
                      </div>

                      <textarea
                        value={activeSectionData.content}
                        onChange={(event) => updateSectionContent(activeSectionData.id, event.target.value)}
                        rows={14}
                        className="mt-6 w-full rounded-3xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                        placeholder={`Escreva o conteúdo para ${activeSectionData.title}...`}
                      />

                      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                        <button
                          onClick={handleCopySection}
                          className="inline-flex items-center gap-2 rounded-3xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          <Sparkle className="w-4 h-4 text-amber-600" /> Copiar seção
                        </button>
                        <div className="flex gap-2">
                          <button
                            onClick={saveDraft}
                            className="inline-flex items-center gap-2 rounded-3xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700"
                          >
                            <Save className="w-4 h-4" /> Salvar rascunho
                          </button>
                        </div>
                      </div>

                      {error && (
                        <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                          <AlertCircle className="inline-block w-4 h-4 mr-2 align-text-bottom" /> {error}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.25em] text-amber-600 font-semibold">Resumo do workspace</p>
                <div className="mt-4 space-y-4 text-sm text-gray-600">
                  <div>
                    <p className="font-semibold text-gray-900">Link do edital</p>
                    <p>{editalLink || 'Nenhum link informado'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Arquivos</p>
                    {attachedFiles.length > 0 ? (
                      attachedFiles.map((file) => (
                        <p key={file.uploadedAt}>{file.name}</p>
                      ))
                    ) : (
                      <p>Sem anexos</p>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Seções geradas</p>
                    <p>{proposalSections.length} seção(ões)</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600 shadow-sm">
                <p className="font-semibold text-gray-900 mb-3">Como usar</p>
                <p>
                  Use esta página para definir a estrutura do edital e preencher cada categoria em abas separadas. Aqui não se escreve mais tudo em um único bloco longo.
                </p>
              </div>
            </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
