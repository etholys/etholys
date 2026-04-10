'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Heart,
  Filter,
  Search,
  ChevronRight,
  ChevronLeft,
  Trash2,
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
  matchScore: number;
  status: string;
}

export default function MyFundsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchMyFunds = useCallback(async (pageNum: number = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/funds/my-funds?page=${pageNum}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setFunds(data.funds || []);
      setTotal(data.pagination?.total || 0);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching my funds:', error);
      setFunds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyFunds();
  }, [fetchMyFunds]);

  const handleRemoveFund = async (fundId: string) => {
    try {
      await fetch('/api/funds/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundId, status: '' }),
      });
      fetchMyFunds(page);
    } catch (error) {
      console.error('Error removing fund:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/hub/fundhub" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-2">
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar ao FundHub</span>
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Meus Fundos Salvos</h1>
              <p className="mt-1 text-gray-600">Gerenciar sua lista de oportunidades de financiamento</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-600">{total}</p>
              <p className="text-sm text-gray-600">fundos salvos</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-amber-600" />
          </div>
        ) : funds.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-4">Nenhum fundo salvo ainda</p>
            <Link
              href="/hub/fundhub/discover"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              <Search className="w-4 h-4" />
              Explorar fundos
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {funds.map((fund) => (
              <div
                key={fund.id}
                className="rounded-xl border border-gray-200 bg-white p-6 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                        fund.status === 'open'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {fund.status === 'open' ? 'Aberto' : 'Fechado'}
                      </span>
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                        {fund.type}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{fund.name}</h3>
                    <p className="text-sm text-gray-600 mb-4">{fund.institution}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Valor</p>
                        <p className="font-semibold text-gray-900">{fund.currency} {(fund.amount / 1000000).toFixed(1)}M</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Prazo</p>
                        <p className="font-semibold text-gray-900">
                          {fund.deadline ? new Date(fund.deadline).toLocaleDateString('pt-BR') : 'S/prazo'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Categoria</p>
                        <p className="font-semibold text-gray-900">{fund.category}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Match</p>
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

                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/hub/fundhub/discover/${fund.id}`}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                    >
                      <span className="text-sm font-medium">Ver detalhes</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleRemoveFund(fund.id)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Remover</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Pagination */}
            <div className="flex items-center justify-between mt-8">
              <p className="text-sm text-gray-600">
                Mostrando {Math.min((page - 1) * 20 + 1, total)} a {Math.min(page * 20, total)} de {total} fundos
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchMyFunds(page - 1)}
                  disabled={page === 1}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-4 py-2 text-sm font-medium text-gray-700">
                  Página {page}
                </span>
                <button
                  onClick={() => fetchMyFunds(page + 1)}
                  disabled={page * 20 >= total}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
