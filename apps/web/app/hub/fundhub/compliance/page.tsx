'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Circle, AlertCircle, FileCheck, TrendingUp } from 'lucide-react';

const defaultComplianceChecklists = [
  {
    id: 'governance',
    title: 'Governança Corporativa',
    icon: FileCheck,
    color: 'bg-blue-100 text-blue-700',
    items: [
      { id: '1', task: 'Estrutura organizacional formalizada', completed: false },
      { id: '2', task: 'Conselho com 3+ membros independentes', completed: false },
      { id: '3', task: 'Política de conflito de interesses', completed: false },
      { id: '4', task: 'Diretor financeiro dedicado', completed: false },
    ],
  },
  {
    id: 'financial',
    title: 'Auditoria & Contabilidade',
    icon: TrendingUp,
    color: 'bg-green-100 text-green-700',
    items: [
      { id: '1', task: 'Auditoria financeira independente', completed: false },
      { id: '2', task: 'Demonstrações financeiras auditadas (3 anos)', completed: false },
      { id: '3', task: 'Balanço patrimonial positivo', completed: false },
      { id: '4', task: 'Controle interno documentado', completed: false },
    ],
  },
  {
    id: 'esg',
    title: 'ESG & Sustentabilidade',
    icon: AlertCircle,
    color: 'bg-emerald-100 text-emerald-700',
    items: [
      { id: '1', task: 'Política de gestão ambiental', completed: false },
      { id: '2', task: 'Indicadores de impacto social', completed: false },
      { id: '3', task: 'Relatório anual de stakeholders', completed: false },
      { id: '4', task: 'Alinhamento com ODS', completed: false },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance & Legal',
    icon: CheckCircle2,
    color: 'bg-purple-100 text-purple-700',
    items: [
      { id: '1', task: 'Documentação fiscal em dia', completed: false },
      { id: '2', task: 'Registro em Cartório de Pessoas Jurídicas', completed: false },
      { id: '3', task: 'Certidão negativa de débitos', completed: false },
      { id: '4', task: 'Política de privacidade e LGPD', completed: false },
    ],
  },
];

const getStorageKey = (fundId?: string | null) => `fundhubCompliance:${fundId || 'generic'}`;

export default function FundHubCompliancePage() {
  const searchParams = useSearchParams();
  const fundId = searchParams.get('fundId');
  const storageKey = getStorageKey(fundId);

  const [checklists, setChecklists] = useState(defaultComplianceChecklists);
  const [notes, setNotes] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.checklists) setChecklists(parsed.checklists);
        if (parsed.notes) setNotes(parsed.notes);
        if (parsed.savedAt) setSavedAt(parsed.savedAt);
      } catch {
        setChecklists(defaultComplianceChecklists);
      }
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify({
      checklists,
      notes,
      savedAt: new Date().toISOString(),
    }));
    setSavedAt(new Date().toISOString());
  }, [checklists, notes, storageKey]);

  const toggleItem = (checklistId: string, itemId: string) => {
    setChecklists(
      checklists.map((checklist) => {
        if (checklist.id === checklistId) {
          return {
            ...checklist,
            items: checklist.items.map((item) => ({
              ...item,
              completed: item.id === itemId ? !item.completed : item.completed,
            })),
          };
        }
        return checklist;
      })
    );
  };

  const resetChecklist = () => {
    setChecklists(defaultComplianceChecklists);
    setNotes('');
    setSavedAt(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
  };

  const getProgress = (items: any[]) => {
    const completed = items.filter((item) => item.completed).length;
    return Math.round((completed / items.length) * 100);
  };

  const totalItems = checklists.reduce((acc, c) => acc + c.items.length, 0);
  const completedItems = checklists.reduce(
    (acc, c) => acc + c.items.filter((i) => i.completed).length,
    0
  );
  const overallProgress = Math.round((completedItems / totalItems) * 100);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/hub/fundhub"
            className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center gap-1"
          >
            ← Voltar ao FundHub
          </Link>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Rota de Compliance</h1>
              <p className="text-lg text-gray-600 max-w-2xl">
                Acompanhe e gerencie requisitos de governança, auditoria, ESG e compliance para ser elegível em fundos grandes.
              </p>
              {fundId && (
                <p className="mt-3 text-sm text-amber-600">Foco no fundo selecionado: {fundId}</p>
              )}
            </div>
            <div className="rounded-3xl bg-gray-50 px-6 py-4 text-center shadow-sm">
              <p className="text-sm uppercase tracking-[0.25em] text-gray-500">Progresso geral</p>
              <p className="mt-3 text-5xl font-bold text-amber-600">{overallProgress}%</p>
              <p className="text-sm text-gray-600 mt-1">{completedItems} / {totalItems} itens concluídos</p>
              {savedAt && (
                <p className="text-xs text-gray-500 mt-2">Último salvo em {new Date(savedAt).toLocaleString('pt-BR')}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-6">
            {checklists.map((checklist) => {
              const progress = getProgress(checklist.items);
              const Icon = checklist.icon;

              return (
                <div key={checklist.id} className="rounded-2xl border border-gray-200 bg-white">
                  {/* Header */}
                  <div className="border-b border-gray-200 p-8">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${checklist.color}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">{checklist.title}</h2>
                          <p className="text-sm text-gray-600 mt-1">
                            {checklist.items.filter((i) => i.completed).length} de {checklist.items.length} concluídos
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-amber-600">{progress}%</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full bg-amber-600 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-gray-200">
                    {checklist.items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleItem(checklist.id, item.id)}
                        className="p-6 cursor-pointer hover:bg-gray-50 transition flex items-center gap-4"
                      >
                        {item.completed ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <Circle className="w-6 h-6 text-gray-300 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p
                            className={`font-medium ${
                              item.completed
                                ? 'text-gray-600 line-through'
                                : 'text-gray-900'
                            }`}
                          >
                            {item.task}
                          </p>
                        </div>
                        {item.completed && (
                          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                            Concluído
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-amber-600 font-semibold">Notas de compliance</p>
                  <p className="text-sm text-gray-600">Registre observações importantes sobre documentos e ações.</p>
                </div>
                <button
                  onClick={resetChecklist}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Reiniciar
                </button>
              </div>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={12}
                className="w-full rounded-3xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                placeholder="Anote riscos, documentos a atualizar ou próximas ações..."
              />
            </div>

            <div className="rounded-[2rem] border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600 shadow-sm">
              <p className="font-semibold text-gray-900 mb-3">Controle rápido</p>
              <p className="mb-4">O progresso de compliance é armazenado no navegador para que você possa retomar a qualquer momento.</p>
              <div className="space-y-3">
                <div className="rounded-3xl bg-white p-4">
                  <p className="font-semibold text-gray-900">Salvar</p>
                  <p className="text-sm text-gray-600">O progresso é salvo automaticamente a cada alteração.</p>
                </div>
                <div className="rounded-3xl bg-white p-4">
                  <p className="font-semibold text-gray-900">Limpar</p>
                  <p className="text-sm text-gray-600">Use o botão Reiniciar para começar um checklist novo.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Help Section */}
        <div className="mt-10 rounded-2xl border border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Precisa de ajuda?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="font-semibold text-gray-900 mb-2">📋 Documentos</p>
              <p className="text-sm text-gray-600">Veja quais documentos você precisa preparar para cada requisito.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2">🤝 Consultoria</p>
              <p className="text-sm text-gray-600">Conecte-se com especialistas em compliance para sua organização.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2">📊 Templates</p>
              <p className="text-sm text-gray-600">Baixe templates padronizados para políticas e documentos.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
