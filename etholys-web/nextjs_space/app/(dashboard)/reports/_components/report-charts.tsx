'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { useApp } from '@/app/providers';

const COLORS = ['#0D9488', '#16A34A', '#7C3AED', '#EA580C', '#60B5FF', '#FF9149'];

export default function ReportCharts({ data }: { data: any }) {
  const { tr } = useApp();
  const companyBudgets = (data?.companyBudgets ?? []);
  const taskCompletion = data?.taskCompletion ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4">{tr('dashboard.budgetOverview')} por Empresa</h3>
        <div className="h-64">
          {companyBudgets.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={companyBudgets} margin={{ top: 5, right: 10, bottom: 25, left: 10 }}>
                <XAxis dataKey="name" tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: any) => `$${(v ?? 0)?.toLocaleString?.()}`} />
                <Bar dataKey="budget" name={tr('project.budget')} radius={[4, 4, 0, 0]}>
                  {companyBudgets.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-full text-gray-400 text-sm">{tr('general.noData')}</div>}
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4">{tr('report.taskCompletion')}</h3>
        <div className="h-64">
          {taskCompletion.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={taskCompletion} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                  {taskCompletion.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-full text-gray-400 text-sm">{tr('general.noData')}</div>}
        </div>
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {taskCompletion.map((d: any, i: number) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-gray-600">{d?.name}: {d?.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
