'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale, Check, X, Loader2, FileCheck } from 'lucide-react';
import { useApp } from '@/app/providers';
import { formatDate, isLikelyDbId } from '@/lib/utils';

type ApprovalRow = {
  id: string;
  status: string;
  note?: string | null;
  decisionNote?: string | null;
  createdAt: string;
  decidedAt?: string | null;
  task: { id: string; title: string; status?: string };
  requester: { id: string; name: string };
  approver: { id: string; name: string };
};

export default function CartaHubPage() {
  const { locale, activeCompanyId } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const companyId = activeCompanyId && isLikelyDbId(activeCompanyId) ? activeCompanyId : '';

  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ mine: '1' });
      if (filter === 'PENDING') qs.set('status', 'PENDING');
      if (companyId) qs.set('companyId', companyId);
      const r = await fetch(`/api/task-approvals?${qs}`);
      const d = await r.json();
      setApprovals(d?.approvals ?? []);
    } catch {
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setBusyId(id);
    try {
      await fetch(`/api/task-approvals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/80 to-slate-50">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/hub"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 hover:text-slate-600"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Voltar ao Hub', 'Volver al Hub', 'Back to Hub')}
          </Link>
          <div className="flex items-center gap-2 text-slate-800">
            <Scale className="h-6 w-6" />
            <span className="font-bold tracking-tight">CARTA</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            {t('Governança e aprovações', 'Gobernanza y aprobaciones', 'Governance & approvals')}
          </h1>
          <p className="mt-2 text-slate-600">
            {t(
              'Pedidos de aprovação de entregas do Etholys Work. Decisões ficam registadas aqui.',
              'Solicitudes de aprobación de entregas de Etholys Work. Las decisiones quedan registradas aquí.',
              'Delivery approval requests from Etholys Work. Decisions are logged here.',
            )}
          </p>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setFilter('PENDING')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === 'PENDING' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            {t('Pendentes', 'Pendientes', 'Pending')}
          </button>
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${filter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            {t('Todas', 'Todas', 'All')}
          </button>
          <Link href="/hub/work" className="ml-auto text-sm font-medium text-cyan-700 hover:underline">
            Etholys Work
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : approvals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            <FileCheck className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            {t('Nenhum pedido nesta vista.', 'Ninguna solicitud en esta vista.', 'No requests in this view.')}
          </div>
        ) : (
          <ul className="space-y-3">
            {approvals.map((a) => {
              const pending = a.status === 'PENDING';
              return (
                <li key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{a.task.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t('De', 'De', 'From')} {a.requester.name} → {a.approver.name} · {formatDate(a.createdAt)}
                      </p>
                      {a.note && <p className="mt-2 text-sm text-slate-600">{a.note}</p>}
                      {a.decisionNote && (
                        <p className="mt-1 text-xs text-slate-500">
                          {t('Nota', 'Nota', 'Note')}: {a.decisionNote}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        a.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : a.status === 'REJECTED'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                  {pending && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => void decide(a.id, 'APPROVED')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        {t('Aprovar', 'Aprobar', 'Approve')}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => void decide(a.id, 'REJECTED')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                        {t('Rejeitar', 'Rechazar', 'Reject')}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
