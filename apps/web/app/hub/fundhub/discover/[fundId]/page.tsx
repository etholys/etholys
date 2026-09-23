'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Heart,
  FileText,
  Calendar,
  DollarSign,
  MapPin,
  ExternalLink,
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
  const params = useParams();
  const fundId = params.fundId as string;

  const [fund, setFund] = useState<Fund | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

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

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-amber-600" />
      </div>
    );
  }

  if (!fund) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center">
        <p className="mb-4 text-gray-600">Fundo não encontrado</p>
        <Link href="/hub/fundhub/my-funds" className="text-amber-600 hover:text-amber-700">
          ← Em curso
        </Link>
      </div>
    );
  }

  const amountLabel =
    fund.amount != null
      ? `${fund.currency || 'USD'} ${Number(fund.amount).toLocaleString()}`
      : '—';

  return (
    <div className="space-y-6">
      <Link
        href="/hub/fundhub/my-funds"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Em curso
      </Link>

      <header className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  fund.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {fund.status === 'open' ? 'Aberto' : fund.status}
              </span>
              {fund.type && (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                  {fund.type}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-bold text-gray-900">{fund.name}</h1>
            <p className="mt-1 text-sm text-gray-600">{fund.institution}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleSaveStatus(isSaved ? '' : 'saved')}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Heart className={`h-4 w-4 ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
              {isSaved ? 'Guardado' : 'Guardar'}
            </button>
            <Link
              href={`/hub/fundhub/proposals?fundId=${fund.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              <FileText className="h-4 w-4" />
              Proposta
            </Link>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <DollarSign className="mt-0.5 h-4 w-4 text-amber-600" />
            <div>
              <dt className="text-xs text-gray-500">Montante</dt>
              <dd className="text-sm font-semibold text-gray-900">{amountLabel}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-4 w-4 text-amber-600" />
            <div>
              <dt className="text-xs text-gray-500">Prazo</dt>
              <dd className="text-sm font-semibold text-gray-900">
                {fund.deadline ? new Date(fund.deadline).toLocaleDateString() : '—'}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 text-amber-600" />
            <div>
              <dt className="text-xs text-gray-500">Países</dt>
              <dd className="text-sm font-semibold text-gray-900">{fund.countries || '—'}</dd>
            </div>
          </div>
        </dl>
      </header>

      {fund.description && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900">Descrição</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{fund.description}</p>
        </section>
      )}

      {fund.linkOficial && (
        <a
          href={fund.linkOficial}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          Site oficial
        </a>
      )}
    </div>
  );
}
