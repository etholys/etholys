'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  Heart,
  Search,
  Sliders,
  Star,
  Trash2,
  ChevronDown,
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
  userStatus: { status: string; notes: string } | null;
}

interface PaginationData {
  total: number;
  pages: number;
  current: number;
  pageSize: number;
}

export default function FundHubDiscoverPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [funds, setFunds] = useState<Fund[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    pages: 1,
    current: 1,
    pageSize: 20,
  });
  const [loading, setLoading] = useState(true);
  const [selectedFilters, setSelectedFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || 'open',
    type: searchParams.get('type') || '',
    category: searchParams.get('category') || '',
    country: searchParams.get('country') || '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchFunds = useCallback(
    async (page: number = 1) => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.append('page', page.toString());
        if (selectedFilters.search) params.append('search', selectedFilters.search);
        if (selectedFilters.status) params.append('status', selectedFilters.status);
        if (selectedFilters.type) params.append('type', selectedFilters.type);
        if (selectedFilters.category) params.append('category', selectedFilters.category);
        if (selectedFilters.country) params.append('country', selectedFilters.country);

        const response = await fetch(`/api/funds?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        
        setFunds(data.funds || []);
        setPagination(data.pagination || {
          total: 0,
          pages: 0,
          current: 1,
          pageSize: 20,
        });
      } catch (error) {
        console.error('Error fetching funds:', error);
        setFunds([]);
        setPagination({
          total: 0,
          pages: 0,
          current: 1,
          pageSize: 20,
        });
      } finally {
        setLoading(false);
      }
    },
    [selectedFilters]
  );

  useEffect(() => {
    fetchFunds(1);
  }, [selectedFilters, fetchFunds]);

  const handleFilterChange = (filterName: string, value: string) => {
    setSelectedFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const handleSaveStatus = async (fundId: string, status: string) => {
    try {
      await fetch('/api/funds/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundId, status }),
      });
      fetchFunds(pagination.current);
    } catch (error) {
      console.error('Error saving fund status:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-white shadow-sm overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-4">
          <Link href="/hub/fundhub" className="text-sm font-semibold text-gray-700 hover:text-gray-900">
            ← FundHub
          </Link>
        </div>

        {/* Filters */}
        <div className="space-y-4 p-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Nombre, institución..."
              value={selectedFilters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
              className="mt-2 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm placeholder-gray-400 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">
              Estado
            </label>
            <select
              value={selectedFilters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
              className="mt-2 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="open">Abierto</option>
              <option value="closed">Cerrado</option>
              <option value="monitoring">Monitoreo</option>
              <option value="">Todos</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">
              Tipo
            </label>
            <select
              value={selectedFilters.type}
              onChange={e => handleFilterChange('type', e.target.value)}
              className="mt-2 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="">Todos</option>
              <option value="Grant">Grant</option>
              <option value="Prestamo">Préstamo</option>
              <option value="Aceleración">Aceleración</option>
              <option value="Equity">Equity</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">
              Categoría
            </label>
            <select
              value={selectedFilters.category}
              onChange={e => handleFilterChange('category', e.target.value)}
              className="mt-2 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="">Todos</option>
              <option value="Agricultura">Agricultura</option>
              <option value="Tecnología">Tecnología</option>
              <option value="ESG">ESG</option>
              <option value="Educación">Educación</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">
              País
            </label>
            <input
              type="text"
              placeholder="Ej: Brasil"
              value={selectedFilters.country}
              onChange={e => handleFilterChange('country', e.target.value)}
              className="mt-2 w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm placeholder-gray-400 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <button
            onClick={() => setSelectedFilters({ search: '', status: 'open', type: '', category: '', country: '' })}
            className="w-full rounded-2xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            Resetear filtros
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Descubrir Fondos</h1>
              <p className="mt-1 text-sm text-gray-600">
                {pagination.total} oportunidades encontradas
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Sliders className="h-4 w-4" />
                Filtros
              </button>
            </div>
          </div>
        </header>

        {/* Table */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-amber-600" />
            </div>
          ) : funds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="mb-3 h-12 w-12 text-gray-300" />
              <p className="text-gray-600">No se encontraron fondos con estos filtros.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Nombre</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Institución</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Tipo</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Categoría</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-700">Monto</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-700">Plazo</th>
                    <th className="px-6 py-3 text-center font-semibold text-gray-700">Match %</th>
                    <th className="px-6 py-3 text-center font-semibold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {funds.map((fund) => (
                    <tr key={fund.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{fund.name}</p>
                          <p className="text-xs text-gray-500">{fund.countries}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{fund.institution}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                          {fund.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{fund.category}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        {fund.amount ? `${fund.currency} ${(fund.amount / 1000000).toFixed(1)}M` : 'Variable'}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {fund.deadline
                          ? new Date(fund.deadline).toLocaleDateString('es-ES')
                          : 'Sin plazo'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            (fund.matchScore || 0) >= 75
                              ? 'bg-emerald-100 text-emerald-700'
                              : (fund.matchScore || 0) >= 50
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {Math.round(fund.matchScore || 0)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleSaveStatus(fund.id, 'saved')}
                            className="rounded-lg p-1 hover:bg-gray-100"
                            title="Guardar"
                          >
                            <Heart
                              className={`h-4 w-4 ${
                                fund.userStatus?.status === 'saved'
                                  ? 'fill-red-500 text-red-500'
                                  : 'text-gray-400'
                              }`}
                            />
                          </button>
                          <Link
                            href={`/hub/fundhub/discover/${fund.id}`}
                            className="rounded-lg p-1 hover:bg-gray-100 text-gray-400"
                            title="Ver detalles"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <footer className="border-t border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Mostrando {Math.min((pagination.current - 1) * pagination.pageSize + 1, pagination.total)} a{' '}
            {Math.min(pagination.current * pagination.pageSize, pagination.total)} de {pagination.total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchFunds(pagination.current - 1)}
              disabled={pagination.current === 1}
              className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1)
              .slice(Math.max(0, pagination.current - 2), Math.min(pagination.pages, pagination.current + 1))
              .map(page => (
                <button
                  key={page}
                  onClick={() => fetchFunds(page)}
                  className={`rounded-lg px-3 py-1 text-sm font-semibold ${
                    page === pagination.current
                      ? 'bg-amber-600 text-white'
                      : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            <button
              onClick={() => fetchFunds(pagination.current + 1)}
              disabled={pagination.current === pagination.pages}
              className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
