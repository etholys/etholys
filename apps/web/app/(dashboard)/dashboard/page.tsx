'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/app/providers';
import { formatCurrency, getStatusColor, getPriorityColor, formatDate } from '@/lib/utils';
import {
  FolderKanban, CheckSquare, Users, DollarSign, TrendingUp, Clock,
  AlertTriangle, Activity, Package, UsersRound, FileText, CalendarDays,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import Link from 'next/link';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#94a3b8', '#60B5FF', '#f59e0b', '#a855f7', '#22c55e'];

type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });

const UI = {
  products: ml('Products', 'Productos', 'Produtos'),
  lowStock: ml('low stock', 'stock bajo', 'estoque baixo'),
  clients: ml('Clients', 'Clientes', 'Clientes'),
  receivable: ml('Receivable', 'Por cobrar', 'A receber'),
  payable: ml('Payable', 'Por pagar', 'A pagar'),
  overdue: ml('Overdue', 'Vencidas', 'Vencidas'),
  pendingLeaves: ml('Pending leaves', 'Licencias pend.', 'Licenças pend.'),
  recentActivity: ml('Recent Activity', 'Actividad Reciente', 'Atividade Recente'),
  system: ml('System', 'Sistema', 'Sistema'),
  noRecentActivity: ml('No recent activity in your organizations', 'No hay actividad reciente en tus organizaciones', 'Sem atividade recente nas suas organizações'),
};

function AnimatedNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const end = value ?? 0;
    const duration = 1000;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(end * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [value, mounted]);
  if (!mounted) return <span>{prefix}0</span>;
  return <span>{prefix}{display?.toLocaleString?.() ?? '0'}</span>;
}

export default function DashboardPage() {
  const { tr, activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    setLoading(true);
    const params = activeCompanyId ? `?companyId=${activeCompanyId}` : '';
    fetch(`/api/dashboard${params}`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [activeCompanyId]);

  if (loading || !mounted) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" /></div>;

  const stats = data?.stats ?? {};

  const topCards = [
    { label: tr('dashboard.totalProjects'), value: stats?.totalProjects ?? 0, icon: FolderKanban, color: 'bg-blue-50 text-blue-600', prefix: '' },
    { label: tr('dashboard.activeTasks'), value: stats?.activeTasks ?? 0, icon: CheckSquare, color: 'bg-amber-50 text-amber-600', prefix: '' },
    { label: tr('dashboard.teamMembers'), value: stats?.teamMembers ?? 0, icon: Users, color: 'bg-purple-50 text-purple-600', prefix: '' },
    { label: tr('dashboard.totalBudget'), value: stats?.totalBudget ?? 0, icon: DollarSign, color: 'bg-emerald-50 text-emerald-600', prefix: '$' },
  ];

  const statusLabels: Record<string, string> = {
    BACKLOG: tr('status.backlog'), TODO: tr('status.todo'), IN_PROGRESS: tr('status.in_progress'),
    IN_REVIEW: tr('status.in_review'), DONE: tr('status.done'),
  };
  const pieData = Object.entries(data?.tasksByStatus ?? {}).map(([key, value]: [string, any]) => ({
    name: statusLabels?.[key] ?? key, value: value ?? 0,
  })).filter((d: any) => (d?.value ?? 0) > 0);
  const budgetData = [
    { name: tr('dashboard.totalBudget'), value: stats?.totalBudget ?? 0 },
    { name: tr('project.spent'), value: stats?.totalSpent ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tr('dashboard.title')}</h1>
        <p className="text-gray-500 text-sm mt-1">{tr('app.tagline')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((s, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center`}><s.icon className="w-5 h-5" /></div>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold"><AnimatedNumber value={s.value} prefix={s.prefix} /></p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link href="/inventory" className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow block">
          <div className="flex items-center gap-2 mb-1"><Package className="w-4 h-4 text-teal-600" /><span className="text-xs text-gray-500">{L(UI.products)}</span></div>
          <p className="text-lg font-bold">{stats?.totalProducts ?? 0}</p>
          {(stats?.lowStockProducts ?? 0) > 0 && <p className="text-xs text-red-500 flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3" />{stats.lowStockProducts} {L(UI.lowStock)}</p>}
        </Link>
        <Link href="/clients" className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow block">
          <div className="flex items-center gap-2 mb-1"><UsersRound className="w-4 h-4 text-blue-600" /><span className="text-xs text-gray-500">{L(UI.clients)}</span></div>
          <p className="text-lg font-bold">{stats?.totalClients ?? 0}</p>
        </Link>
        <Link href="/invoices" className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow block">
          <div className="flex items-center gap-2 mb-1"><ArrowUpRight className="w-4 h-4 text-emerald-600" /><span className="text-xs text-gray-500">{L(UI.receivable)}</span></div>
          <p className="text-lg font-bold text-emerald-600">${(stats?.totalReceivable ?? 0).toLocaleString()}</p>
        </Link>
        <Link href="/invoices" className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow block">
          <div className="flex items-center gap-2 mb-1"><ArrowDownRight className="w-4 h-4 text-red-500" /><span className="text-xs text-gray-500">{L(UI.payable)}</span></div>
          <p className="text-lg font-bold text-red-500">${(stats?.totalPayable ?? 0).toLocaleString()}</p>
        </Link>
        <Link href="/invoices" className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow block">
          <div className="flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-red-600" /><span className="text-xs text-gray-500">{L(UI.overdue)}</span></div>
          <p className="text-lg font-bold text-red-600">{stats?.overdueInvoices ?? 0}</p>
        </Link>
        <Link href="/hr" className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow block">
          <div className="flex items-center gap-2 mb-1"><CalendarDays className="w-4 h-4 text-amber-600" /><span className="text-xs text-gray-500">{L(UI.pendingLeaves)}</span></div>
          <p className="text-lg font-bold text-amber-600">{stats?.pendingLeaves ?? 0}</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold mb-4">{tr('dashboard.tasksByStatus')}</h3>
          <div className="h-64">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                    {pieData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex items-center justify-center h-full text-gray-400 text-sm">{tr('general.noData')}</div>}
          </div>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {pieData.map((d: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-gray-600">{d?.name}: {d?.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold mb-4">{tr('dashboard.budgetOverview')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
                <XAxis dataKey="name" tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: any) => `$${(v ?? 0)?.toLocaleString?.()}`} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  <Cell fill="#0D9488" />
                  <Cell fill="#f59e0b" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><FolderKanban className="w-4 h-4 text-teal-600" />{tr('dashboard.projectProgress')}</h3>
          <div className="space-y-4">
            {(data?.projects ?? []).slice(0, 5).map((p: any) => (
              <Link key={p?.id} href={`/siep/projects/${p?.id}`} className="block group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p?.company?.color ?? '#0D9488' }} />
                    <span className="text-sm font-medium group-hover:text-teal-600 transition">{p?.name ?? ''}</span>
                  </div>
                  <span className="text-xs text-gray-500">{p?.progress ?? 0}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${p?.progress ?? 0}%`, backgroundColor: getStatusColor(p?.status ?? '') }} />
                </div>
              </Link>
            ))}
            {(data?.projects ?? []).length === 0 && <p className="text-sm text-gray-400 text-center py-4">{tr('general.noData')}</p>}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" />{tr('dashboard.upcomingDeadlines')}</h3>
          <div className="space-y-3">
            {(data?.upcomingDeadlines ?? []).map((t: any) => {
              const isOverdue = t?.dueDate && new Date(t.dueDate) < new Date();
              return (
                <div key={t?.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 transition">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getPriorityColor(t?.priority ?? '') }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t?.title ?? ''}</p>
                    <p className="text-xs text-gray-500">{t?.project?.name ?? ''}</p>
                  </div>
                  <div className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                    {isOverdue && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                    {formatDate(t?.dueDate)}
                  </div>
                </div>
              );
            })}
            {(data?.upcomingDeadlines ?? []).length === 0 && <p className="text-sm text-gray-400 text-center py-4">{tr('general.noData')}</p>}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-teal-600" />{L(UI.recentActivity)}</h3>
        <div className="space-y-3">
          {(data?.recentActivities ?? []).map((a: any) => (
            <div key={a?.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {(a?.user?.name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{a?.user?.name ?? L(UI.system)}</span>{' '}
                  <span className="text-gray-500">{a?.description ?? a?.action ?? ''}</span>
                  {a?.project && <span className="text-teal-600 font-medium"> · {a.project.name}</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(a?.createdAt)}</p>
              </div>
            </div>
          ))}
          {(data?.recentActivities ?? []).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">{L(UI.noRecentActivity)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
