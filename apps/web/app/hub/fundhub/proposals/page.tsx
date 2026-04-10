'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Upload,
  UploadCloud,
  ExternalLink,
  Trash2,
  FileText,
  Calendar,
  AlertCircle,
} from 'lucide-react';

interface FundSummary {
  id: string;
  name: string;
  institution: string;
  description?: string;
}

interface ProposalDraft {
  workspaceId: string;
  fundId: string;
  fundName: string;
  fundInstitution: string;
  editalLink: string;
  editalSummary: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'submitted' | 'archived';
}

interface ProposalIntake {
  workspaceId: string;
  fundId: string;
  fundName: string;
  fundInstitution: string;
  editalLink: string;
  intakeNotes: string;
  attachedFiles?: Array<{
    name: string;
    type: string;
    size: number;
    uploadedAt: string;
  }>;
}

export default function ProposalsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'drafts' | 'new'>('drafts');
  const [fund, setFund] = useState<FundSummary | null>(null);
  const [editalLink, setEditalLink] = useState('');
  const [intakeNotes, setIntakeNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [drafts, setDrafts] = useState<ProposalDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fundData = localStorage.getItem('selectedFund');
    if (fundData) {
      const parsed = JSON.parse(fundData);
      setFund(parsed);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('proposalDrafts');
    if (stored) {
      try {
        setDrafts(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading drafts:', e);
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Arquivo deve ter menos de 10MB');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  }, []);

  const handleOpenWorkspace = useCallback(async () => {
    if (!fund) {
      setError('Fund não carregado');
      return;
    }

    if (!editalLink && !selectedFile) {
      setError('Cole um link do edital ou selecione um arquivo');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const workspaceId = `workspace:${fund.id}:${Date.now()}`;

      const intakeData: ProposalIntake = {
        workspaceId,
        fundId: fund.id,
        fundName: fund.name,
        fundInstitution: fund.institution,
        editalLink,
        intakeNotes,
        attachedFiles: selectedFile
          ? [
              {
                name: selectedFile.name,
                type: selectedFile.type,
                size: selectedFile.size,
                uploadedAt: new Date().toISOString(),
              },
            ]
          : undefined,
      };

      localStorage.setItem(`proposalIntake:${workspaceId}`, JSON.stringify(intakeData));

      if (selectedFile) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result;
          localStorage.setItem(`proposalFile:${workspaceId}`, JSON.stringify({
            name: selectedFile.name,
            content: content,
            uploadedAt: new Date().toISOString(),
          }));
        };
        reader.readAsText(selectedFile);
      }

      router.push(`/hub/fundhub/proposals/editor?workspace=${encodeURIComponent(workspaceId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir workspace');
      setIsLoading(false);
    }
  }, [fund, editalLink, selectedFile, intakeNotes, router]);

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
    [router]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-4 sm:px-8">
          <Link href="/hub/fundhub" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">Propostas</h1>
          <p className="mt-1 text-gray-600">Gerencie suas propostas de edital</p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 sm:px-8">
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900">Erro</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Tabbed Navigation */}
        <div className="mb-8 border-b border-gray-200">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('drafts')}
              className={`border-b-2 px-1 py-3 text-sm font-medium transition ${
                activeTab === 'drafts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Rascunhos ({drafts.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`border-b-2 px-1 py-3 text-sm font-medium transition ${
                activeTab === 'new'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Começar Nova
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content: Drafts */}
        {activeTab === 'drafts' && (
          <div>
            {drafts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">Nenhuma proposta em rascunho</h3>
                <p className="mt-2 text-gray-600">
                  Você não tem propostas salvas. Clique em "Começar Nova" para criar sua primeira proposta.
                </p>
                <button
                  onClick={() => setActiveTab('new')}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
                >
                  <Plus className="h-4 w-4" />
                  Criar Proposta
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {drafts.map((draft) => (
                  <div key={draft.workspaceId} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition">
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{draft.fundName}</h3>
                        <p className="text-xs text-gray-500">{draft.fundInstitution}</p>
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
                        {draft.status === 'draft' ? 'Rascunho' : draft.status === 'submitted' ? 'Enviado' : 'Arquivado'}
                      </span>
                    </div>
                    <div className="mb-4 space-y-2 border-t border-gray-100 pt-4">
                      <p className="line-clamp-2 text-sm text-gray-600">
                        <span className="font-medium text-gray-700">Link:</span> {draft.editalLink || 'Sem link'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(draft.updatedAt).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleContinueDraft(draft.workspaceId)}
                        className="flex-1 rounded-lg bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-100 transition"
                      >
                        Continuar
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(draft.workspaceId)}
                        className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition"
                        title="Deletar proposta"
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

        {/* Tab Content: New Proposal */}
        {activeTab === 'new' && (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Começar Nova Proposta</h2>
                  <p className="mt-2 text-gray-600">Cole o link ou carregue o arquivo do edital para análise</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Link do Edital</label>
                    <input
                      type="url"
                      placeholder="https://www.example.com/edital"
                      value={editalLink}
                      onChange={(e) => setEditalLink(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                    />
                    <p className="mt-1 text-xs text-gray-500">Opcional: Cole aqui a URL do edital para análise remota</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Upload do Edital</label>
                    <div className="mt-2">
                      <label
                        htmlFor="file-upload"
                        className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-10 transition hover:border-blue-400 hover:bg-blue-50"
                      >
                        <div className="text-center">
                          <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="mt-2 text-sm font-medium text-gray-900">
                            {selectedFile ? selectedFile.name : 'Clique para selecionar ou arraste aqui'}
                          </p>
                          <p className="text-xs text-gray-500">PDF, DOCX ou TXT - até 10MB</p>
                        </div>
                        <input
                          id="file-upload"
                          type="file"
                          onChange={handleFileSelect}
                          accept=".pdf,.docx,.txt,.doc"
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Anotações Iniciais</label>
                    <textarea
                      value={intakeNotes}
                      onChange={(e) => setIntakeNotes(e.target.value)}
                      placeholder="Resumo do edital, pontos importantes, requisitos específicos..."
                      rows={4}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 font-mono text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                    />
                    <p className="mt-1 text-xs text-gray-500">Contexto que será enviado ao assistente para análise</p>
                  </div>

                  {fund && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium text-gray-900">Fund:</span> {fund.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium text-gray-900">Instituição:</span> {fund.institution}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleOpenWorkspace}
                    disabled={isLoading || (!editalLink && !selectedFile)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-medium text-white shadow hover:shadow-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {isLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        <Plus className="h-5 w-5" />
                        Abrir Workspace
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <aside>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="flex items-center gap-2 font-bold text-gray-900">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                  Como Funciona
                </h3>
                <ol className="mt-4 space-y-3">
                  <li className="flex gap-3">
                    <span className="font-semibold text-blue-600 min-w-fit">1.</span>
                    <span className="text-sm text-gray-600">Cole o link ou carregue o arquivo do edital</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-blue-600 min-w-fit">2.</span>
                    <span className="text-sm text-gray-600">O sistema analisa a estrutura do edital</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-blue-600 min-w-fit">3.</span>
                    <span className="text-sm text-gray-600">Seções dinâmicas são geradas automaticamente</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-blue-600 min-w-fit">4.</span>
                    <span className="text-sm text-gray-600">Preencha cada seção com o assistente de IA</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-blue-600 min-w-fit">5.</span>
                    <span className="text-sm text-gray-600">Salve e envie sua proposta</span>
                  </li>
                </ol>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
