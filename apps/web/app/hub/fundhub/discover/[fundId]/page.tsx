'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Heart,
  Share2,
  Eye,
  FileText,
  Calendar,
  DollarSign,
  MapPin,
  Tag,
  TrendingUp,
  Download,
  ExternalLink,
  Check,
  X,
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
  matchScore: number;
  status: string;
  description?: string;
  linkOficial?: string;
  userStatus?: { status: string; notes: string } | null;
}

export default function FundDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const fundId = params.fundId as string;

  const [fund, setFund] = useState<Fund | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchFund = async () => {
      try {
        const response = await fetch(`/api/funds/${fundId}`);
        if (!response.ok) throw new Error('Fund not found');
        const data = await response.json();
        setFund(data.fund);
        setIsSaved(data.fund.userStatus?.status === 'saved');
      } catch (error) {
        console.error('Error fetching fund:', error);
      } finally {
        setLoading(false);
      }
    };

    if (fundId) fetchFund();
  }, [fundId]);

  const handleSaveStatus = async (status: string) => {
    try {
      await fetch('/api/funds/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundId, status }),
      });
      setIsSaved(status === 'saved');
    } catch (error) {
      console.error('Error updating fund status:', error);
    }
  };

  const handleViewFund = async () => {
    await handleSaveStatus('viewed');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-amber-600" />
      </div>
    );
  }

  if (!fund) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <p className="text-gray-600 mb-4">Fundo não encontrado</p>
        <Link href="/hub/fundhub/discover" className="text-amber-600 hover:text-amber-700">
          ← Voltar para fundos
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/hub/fundhub/discover"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Voltar</span>
            </Link>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSaveStatus(isSaved ? '' : 'saved')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <Heart
                  className={`w-4 h-4 ${
                    isSaved ? 'fill-red-500 text-red-500' : 'text-gray-400'
                  }`}
                />
                {isSaved ? 'Salvo' : 'Salvar'}
              </button>
              <button
                onClick={handleViewFund}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                <Eye className="w-4 h-4" />
                Marcar como visualizado
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Fund Header */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                  fund.status === 'open'
                    ? 'bg-emerald-100 text-emerald-700'
                    : fund.status === 'closed'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {fund.status === 'open' ? 'Aberto' : fund.status === 'closed' ? 'Fechado' : 'Monitoramento'}
                </span>
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                  {fund.type}
                </span>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">{fund.name}</h1>
              <p className="text-lg text-gray-600 mb-4">{fund.institution}</p>
              
              {fund.description && (
                <p className="text-gray-600 leading-relaxed mb-4">{fund.description}</p>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="flex items-center gap-2 text-gray-700">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Valor</p>
                    <p className="font-semibold">{fund.currency} {(fund.amount / 1000000).toFixed(1)}M</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Calendar className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Prazo</p>
                    <p className="font-semibold">
                      {fund.deadline ? new Date(fund.deadline).toLocaleDateString('pt-BR') : 'S/ prazo'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Países</p>
                    <p className="font-semibold text-sm">{fund.countries}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Match</p>
                    <p className={`font-semibold ${
                      fund.matchScore >= 75
                        ? 'text-emerald-600'
                        : fund.matchScore >= 50
                        ? 'text-amber-600'
                        : 'text-gray-600'
                    }`}>
                      {Math.round(fund.matchScore)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Quick Actions */}
            <div className="w-full lg:w-80">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Próximas ações</h3>
                <div className="space-y-3">
                  <Link
                    href={`/hub/fundhub/proposals?fundId=${fund.id}`}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-white border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium">Escrever proposta</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </Link>
                  <button
                    onClick={() => handleSaveStatus(isSaved ? '' : 'saved')}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-white border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition"
                  >
                    <div className="flex items-center gap-2">
                      <Heart className={`w-4 h-4 ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                      <span className="text-sm font-medium">{isSaved ? 'Remover salvo' : 'Salvar para depois'}</span>
                    </div>
                  </button>
                  {fund.linkOficial && (
                    <a
                      href={fund.linkOficial}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">Ver original</span>
                      </div>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-4 px-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'text-amber-600 border-b-2 border-amber-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Informações
          </button>
          <button
            onClick={() => setActiveTab('requirements')}
            className={`pb-4 px-2 font-medium text-sm ${
              activeTab === 'requirements'
                ? 'text-amber-600 border-b-2 border-amber-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Requisitos
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`pb-4 px-2 font-medium text-sm ${
              activeTab === 'analysis'
                ? 'text-amber-600 border-b-2 border-amber-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Análise
          </button>
        </div>

        {/* Tab Content */}
        <div className="grid gap-8">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Detalhes principais</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-2">Categoria</p>
                    <p className="text-lg font-semibold text-gray-900">{fund.category}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-2">Setores elegíveis</p>
                    <div className="flex flex-wrap gap-2">
                      {fund.sectors.split(',').map((sector) => (
                        <span key={sector} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
                          <Tag className="w-3 h-3" />
                          {sector.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Compatibilidade com seu perfil</h2>
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-bold text-amber-600">{Math.round(fund.matchScore)}%</div>
                  <div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {fund.matchScore >= 75
                        ? 'Excelente compatibilidade! Este fundo é altamente alinhado com seu perfil.'
                        : fund.matchScore >= 50
                        ? 'Boa compatibilidade. Existem alguns requisitos que você precisa revisar.'
                        : 'Compatibilidade moderada. Será necessário trabalho de conformidade.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'requirements' && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Requisitos típicos para este tipo de fundo</h2>
              <div className="space-y-4">
                {[
                  'Registros legais e documentação fiscal em dia',
                  'Auditoria financeira independente',
                  'Plano de monitoramento e indicadores de impacto',
                  'Cofinanciamento mínimo de 20%',
                  'Experiência comprovada em projeto similar',
                  'Compliance ESG e governança corporativa',
                ].map((req, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 rounded-lg border border-gray-100 hover:bg-gray-50">
                    <Check className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">{req}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Adicione este item ao seu plano de compliance.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Análise estratégica</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Oportunidades</h3>
                  <ul className="space-y-2">
                    {['Financiamento sem contrapartida significativa', 'Alinhamento com objetivos de impacto', 'Instituição financiadora de reputação'].map((opp, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{opp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Desafios potenciais</h3>
                  <ul className="space-y-2">
                    {['Requisitos rigorosos de governança', 'Competição com outras organizações', 'Prazos apertados para entrega'].map((challenge, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <X className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{challenge}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
