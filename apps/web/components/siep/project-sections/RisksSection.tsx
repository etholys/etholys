'use client';

import { useState } from 'react';
import { SectionProps } from './types';
import { SectionTooltip } from './SectionTooltip';
import { getPriorityColor } from '@/lib/utils';
import { Shield, Plus, X, Trash2, AlertTriangle } from 'lucide-react';

export function RisksSection({ project, onRefresh, tr }: SectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ title: '', description: '', level: 'MEDIUM', impact: '', mitigation: '', status: 'open' });

  const risks = project?.risks ?? [];
  const openRisks = risks.filter((r: any) => r?.status === 'open');
  const levelCounts = (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(level => ({
    level,
    count: openRisks.filter((r: any) => r?.level === level).length,
  }));

  const levelColors: Record<string, string> = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444' };

  const addRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/risks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, projectId: project.id }),
    });
    setShowForm(false);
    setForm({ title: '', description: '', level: 'MEDIUM', impact: '', mitigation: '', status: 'open' });
    onRefresh();
  };

  const deleteRisk = async (riskId: string) => {
    if (!confirm(tr('general.confirm') + '?')) return;
    await fetch(`/api/risks?id=${riskId}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{tr('project.risks')}</h2>
              <SectionTooltip content="Registro de riesgos del proyecto con clasificaci&oacute;n por nivel, impacto y estrategias de mitigaci&oacute;n. Alineado con est&aacute;ndares de gesti&oacute;n de riesgos (ISO 31000)." />
            </div>
            <p className="text-sm text-gray-500">{openRisks.length} riesgos abiertos de {risks.length} total</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">
          <Plus className="w-4 h-4" />
          Nuevo Riesgo
        </button>
      </div>

      {/* Risk Level Summary */}
      <div className="grid grid-cols-4 gap-3">
        {levelCounts.map(({ level, count }) => (
          <div key={level} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-bold" style={{ color: levelColors[level] }}>{count}</p>
            <p className="text-xs text-gray-500 mt-1">{level === 'LOW' ? 'Bajo' : level === 'MEDIUM' ? 'Medio' : level === 'HIGH' ? 'Alto' : 'Cr\u00edtico'}</p>
          </div>
        ))}
      </div>

      {/* Risk Cards */}
      <div className="space-y-3">
        {risks.map((r: any) => (
          <div key={r?.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: levelColors[r?.level ?? 'MEDIUM'] }} />
                <span className="font-semibold text-gray-900">{r?.title ?? ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: getPriorityColor(r?.level ?? '') + '20', color: getPriorityColor(r?.level ?? '') }}>
                  {r?.level === 'LOW' ? 'Bajo' : r?.level === 'MEDIUM' ? 'Medio' : r?.level === 'HIGH' ? 'Alto' : 'Cr\u00edtico'}
                </span>
                <button onClick={() => deleteRisk(r?.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {r?.description && <p className="text-sm text-gray-600 mb-2">{r.description}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {r?.impact && (
                <div className="bg-red-50/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-700 mb-1">Impacto</p>
                  <p className="text-sm text-gray-700">{r.impact}</p>
                </div>
              )}
              {r?.mitigation && (
                <div className="bg-emerald-50/50 rounded-lg p-3">
                  <p className="text-xs font-medium text-emerald-700 mb-1">Mitigaci&oacute;n</p>
                  <p className="text-sm text-gray-700">{r.mitigation}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {risks.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 text-center py-12">
            <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">{tr('general.noData')}</p>
            <button onClick={() => setShowForm(true)} className="text-sm text-indigo-600 hover:underline mt-2">Agregar primer riesgo &rarr;</button>
          </div>
        )}
      </div>

      {/* Risk Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Nuevo Riesgo</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={addRisk} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">T&iacute;tulo *</label>
                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{tr('project.description')}</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nivel</label>
                <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                  <option value="LOW">Bajo</option>
                  <option value="MEDIUM">Medio</option>
                  <option value="HIGH">Alto</option>
                  <option value="CRITICAL">Cr&iacute;tico</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Impacto</label>
                <input value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mitigaci&oacute;n</label>
                <textarea value={form.mitigation} onChange={e => setForm({ ...form, mitigation: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">{tr('general.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
