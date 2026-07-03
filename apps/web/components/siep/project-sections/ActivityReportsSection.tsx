'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { SectionProps } from './types';
import SectionTooltip from './SectionTooltip';
import { formatDate } from '@/lib/utils';
import {
  ClipboardList, Plus, X, Save, Loader2, Car, Camera, Paperclip,
  Send, CheckCircle2, ChevronDown, ChevronUp, MapPin,
} from 'lucide-react';
import { useSiepT } from '@/lib/siep/use-siep-t';
import { ReportGuidePanel } from '@/components/siep/ReportGuidePanel';

type Report = {
  id: string;
  taskId: string;
  reportDate: string;
  narrative: string;
  progressPct: number | null;
  status: string;
  includesTravel: boolean;
  photoUrls: string[];
  deliverableUrls: string[];
  budgetLine?: { id: string; description: string } | null;
  task?: { id: string; title: string };
  author?: { name: string };
  mileage?: {
    odometerStart?: number;
    odometerEnd?: number;
    distanceKm: number;
    fromPlace: string;
    toPlace: string;
    city: string;
    country: string;
    odometerStartPhoto?: string | null;
    odometerEndPhoto?: string | null;
    receiptUrls?: string[];
    reimbursementUsd: number | null;
    fuelPriceUsdPerLiter: number | null;
    status: string;
  } | null;
};

export default function ActivityReportsSection({ project, onRefresh }: SectionProps) {
  const st = useSiepT();
  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      draft: st('siep.reports.status.draft'),
      submitted: st('siep.reports.status.submitted'),
      approved: st('siep.reports.status.approved'),
      rejected: st('siep.reports.status.rejected'),
    };
    return map[s] || s;
  };
  const tasks = (project?.tasks ?? []).filter((t: any) => t?.isActive !== false);
  const budgetLines = (project?.budgetLines ?? []).filter((b: any) => b?.isActive !== false);
  const canApprove = project?.siepPermissions?.canApproveReports ?? false;
  const canReport = project?.siepPermissions?.canReportActivities ?? true;

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalTaskId, setModalTaskId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);

  const [form, setForm] = useState({
    narrative: '',
    progressPct: '',
    reportDate: new Date().toISOString().slice(0, 10),
    budgetLineId: '',
    includesTravel: false,
    photoUrlInput: '',
    photoUrls: [] as string[],
    deliverableUrlInput: '',
    deliverableUrls: [] as string[],
    odometerStart: '',
    odometerEnd: '',
    fromPlace: '',
    toPlace: '',
    city: '',
    country: project?.country || '',
    odometerStartPhoto: '',
    odometerEndPhoto: '',
    receiptUrlInput: '',
    receiptUrls: [] as string[],
  });

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${project.id}/activity-reports`);
      const d = await r.json();
      setReports(d.reports ?? []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const reportsByTask = useMemo(() => {
    const map = new Map<string, Report[]>();
    for (const rep of reports) {
      const list = map.get(rep.taskId) ?? [];
      list.push(rep);
      map.set(rep.taskId, list);
    }
    return map;
  }, [reports]);

  const openNewReport = (taskId: string) => {
    setEditingReportId(null);
    setModalTaskId(taskId);
    setForm({
      narrative: '',
      progressPct: '',
      reportDate: new Date().toISOString().slice(0, 10),
      budgetLineId: '',
      includesTravel: false,
      photoUrlInput: '',
      photoUrls: [],
      deliverableUrlInput: '',
      deliverableUrls: [],
      odometerStart: '',
      odometerEnd: '',
      fromPlace: '',
      toPlace: '',
      city: project?.region || '',
      country: project?.country || '',
      odometerStartPhoto: '',
      odometerEndPhoto: '',
      receiptUrlInput: '',
      receiptUrls: [],
    });
  };

  const openEditReport = async (rep: Report) => {
    let full = rep;
    try {
      const r = await fetch(`/api/activity-reports/${rep.id}`);
      const d = await r.json();
      if (r.ok && d.report) full = d.report;
    } catch {
      // usa dados da lista
    }
    setModalTaskId(full.taskId);
    setEditingReportId(full.id);
    setForm({
      narrative: full.narrative || '',
      progressPct: full.progressPct != null ? String(full.progressPct) : '',
      reportDate: full.reportDate ? new Date(full.reportDate).toISOString().slice(0, 10) : '',
      budgetLineId: full.budgetLine?.id || '',
      includesTravel: full.includesTravel,
      photoUrlInput: '',
      photoUrls: Array.isArray(full.photoUrls) ? full.photoUrls : [],
      deliverableUrlInput: '',
      deliverableUrls: Array.isArray(full.deliverableUrls) ? full.deliverableUrls : [],
      odometerStart: full.mileage?.odometerStart != null ? String(full.mileage.odometerStart) : '',
      odometerEnd: full.mileage?.odometerEnd != null ? String(full.mileage.odometerEnd) : '',
      fromPlace: full.mileage?.fromPlace || '',
      toPlace: full.mileage?.toPlace || '',
      city: full.mileage?.city || '',
      country: full.mileage?.country || project?.country || '',
      odometerStartPhoto: full.mileage?.odometerStartPhoto || '',
      odometerEndPhoto: full.mileage?.odometerEndPhoto || '',
      receiptUrlInput: '',
      receiptUrls: Array.isArray(full.mileage?.receiptUrls) ? full.mileage!.receiptUrls! : [],
    });
  };

  const addUrl = (field: 'photoUrls' | 'deliverableUrls' | 'receiptUrls', inputKey: 'photoUrlInput' | 'deliverableUrlInput' | 'receiptUrlInput') => {
    const url = form[inputKey].trim();
    if (!url) return;
    setForm((f) => ({ ...f, [field]: [...f[field], url], [inputKey]: '' }));
  };

  const saveReport = async (submit = false) => {
    if (!modalTaskId) return;
    setSaving(true);
    try {
      let reportId = editingReportId;
      const payload = {
        narrative: form.narrative,
        progressPct: form.progressPct ? parseInt(form.progressPct, 10) : null,
        reportDate: form.reportDate,
        budgetLineId: form.budgetLineId || null,
        photoUrls: form.photoUrls,
        deliverableUrls: form.deliverableUrls,
        includesTravel: form.includesTravel,
        mileage: form.includesTravel
          ? {
              odometerStart: parseFloat(form.odometerStart) || 0,
              odometerEnd: parseFloat(form.odometerEnd) || 0,
              fromPlace: form.fromPlace,
              toPlace: form.toPlace,
              city: form.city,
              country: form.country,
              odometerStartPhoto: form.odometerStartPhoto || null,
              odometerEndPhoto: form.odometerEndPhoto || null,
              receiptUrls: form.receiptUrls,
            }
          : undefined,
      };

      if (!reportId) {
        const cr = await fetch(`/api/projects/${project.id}/activity-reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: modalTaskId, ...payload }),
        });
        const cd = await cr.json();
        if (!cr.ok) throw new Error(cd.error);
        reportId = cd.report?.id;
      }

      if (reportId) {
        const ur = await fetch(`/api/activity-reports/${reportId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const ud = await ur.json();
        if (!ur.ok) throw new Error(ud.error);

        if (submit) {
          const sr = await fetch(`/api/activity-reports/${reportId}/submit`, { method: 'POST' });
          const sd = await sr.json();
          if (!sr.ok) throw new Error(sd.error);
        }
      }

      setModalTaskId(null);
      await fetchReports();
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : st('siep.reports.error.save'));
    } finally {
      setSaving(false);
    }
  };

  const approveReport = async (reportId: string) => {
    if (!confirm(st('siep.reports.approveConfirm'))) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/activity-reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await fetchReports();
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : st('siep.reports.error.generic'));
    } finally {
      setSaving(false);
    }
  };

  const distancePreview =
    form.includesTravel && form.odometerStart && form.odometerEnd
      ? Math.max(0, parseFloat(form.odometerEnd) - parseFloat(form.odometerStart))
      : 0;

  return (
    <div className="space-y-4">
      <ReportGuidePanel projectId={project.id} compact />

      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-gray-900">{st('siep.reports.title')}</h3>
        <SectionTooltip title={st('siep.reports.tooltipTitle')} content={st('siep.reports.tooltip')} />
      </div>
      <p className="text-xs text-gray-500">{st('siep.reports.intro')}</p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> {st('siep.reports.loading')}
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">{st('siep.reports.noTasks')}</p>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">{st('siep.reports.col.activity')}</th>
                <th className="px-4 py-3 text-center">{st('siep.reports.col.reports')}</th>
                <th className="px-4 py-3 text-right">{st('siep.reports.col.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tasks.map((task: any) => {
                const taskReports = reportsByTask.get(task.id) ?? [];
                const isOpen = expandedTask === task.id;
                return (
                  <Fragment key={task.id}>
                    <tr className="hover:bg-gray-50/80">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{task.title}</p>
                        <p className="text-[10px] text-gray-400">{task.status}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                          {taskReports.length}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {canReport && (
                        <button
                          type="button"
                          onClick={() => openNewReport(task.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {st('siep.reports.reportAdvance')}
                        </button>
                        )}
                        {taskReports.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedTask(isOpen ? null : task.id)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs text-gray-600 hover:bg-gray-50"
                          >
                            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            {st('siep.reports.history')}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && taskReports.map((rep) => (
                      <tr key={rep.id} className="bg-slate-50/60">
                        <td colSpan={3} className="px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-gray-500">
                                {formatDate(rep.reportDate)} · {statusLabel(rep.status)}
                                {rep.author?.name ? ` · ${rep.author.name}` : ''}
                                {rep.progressPct != null ? ` · ${rep.progressPct}%` : ''}
                              </p>
                              <p className="text-sm text-gray-800 mt-1 line-clamp-2">{rep.narrative || '—'}</p>
                              {rep.budgetLine && (
                                <p className="text-[10px] text-indigo-600 mt-1">{st('siep.reports.budgetLine')}: {rep.budgetLine.description}</p>
                              )}
                              {rep.mileage && (
                                <p className="text-[10px] text-emerald-700 mt-0.5 flex items-center gap-1">
                                  <Car className="w-3 h-3" />
                                  {rep.mileage.fromPlace} → {rep.mileage.toPlace} ({rep.mileage.distanceKm} km)
                                  {rep.mileage.reimbursementUsd != null && canApprove
                                    ? ` · ${rep.mileage.reimbursementUsd} USD`
                                    : rep.mileage.reimbursementUsd != null
                                      ? ` · ${st('siep.reports.reimbursePending')}`
                                      : ''}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {rep.status === 'draft' && (
                                <button type="button" onClick={() => openEditReport(rep)} className="text-xs text-indigo-600 hover:underline">
                                  {st('siep.reports.edit')}
                                </button>
                              )}
                              {canApprove && rep.status === 'submitted' && (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => approveReport(rep.id)}
                                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-600 text-white"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {st('siep.reports.approve')}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalTaskId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white flex items-center justify-between p-5 border-b z-10">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                {editingReportId ? st('siep.reports.modal.edit') : st('siep.reports.modal.new')}
              </h2>
              <button type="button" onClick={() => setModalTaskId(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{st('siep.reports.field.date')}</label>
                  <input type="date" value={form.reportDate} onChange={(e) => setForm({ ...form, reportDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{st('siep.reports.field.progress')}</label>
                  <input type="number" min={0} max={100} value={form.progressPct} onChange={(e) => setForm({ ...form, progressPct: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{st('siep.reports.field.narrative')} *</label>
                <textarea rows={3} value={form.narrative} onChange={(e) => setForm({ ...form, narrative: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder={st('siep.reports.field.narrativePh')} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{st('siep.reports.field.budgetLine')}</label>
                <select value={form.budgetLineId} onChange={(e) => setForm({ ...form, budgetLineId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                  <option value="">{st('siep.reports.field.budgetNone')}</option>
                  {budgetLines.map((bl: any) => (
                    <option key={bl.id} value={bl.id}>{bl.description}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5" /> {st('siep.reports.field.photos')}
                </label>
                <div className="flex gap-2">
                  <input value={form.photoUrlInput} onChange={(e) => setForm({ ...form, photoUrlInput: e.target.value })} placeholder="https://…" className="flex-1 px-3 py-2 rounded-lg border text-sm" />
                  <button type="button" onClick={() => addUrl('photoUrls', 'photoUrlInput')} className="px-3 py-2 text-xs border rounded-lg">+</button>
                </div>
                {form.photoUrls.map((u, i) => (
                  <p key={i} className="text-[10px] text-gray-500 truncate mt-1">{u}</p>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5" /> {st('siep.reports.field.deliverables')}
                </label>
                <div className="flex gap-2">
                  <input value={form.deliverableUrlInput} onChange={(e) => setForm({ ...form, deliverableUrlInput: e.target.value })} className="flex-1 px-3 py-2 rounded-lg border text-sm" />
                  <button type="button" onClick={() => addUrl('deliverableUrls', 'deliverableUrlInput')} className="px-3 py-2 text-xs border rounded-lg">+</button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.includesTravel} onChange={(e) => setForm({ ...form, includesTravel: e.target.checked })} />
                <Car className="w-4 h-4 text-amber-600" />
                {st('siep.reports.field.fieldVisit')}
              </label>

              {form.includesTravel && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                  <p className="text-xs font-medium text-amber-900 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {st('siep.reports.field.travelTitle')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-600">{st('siep.reports.field.odometerStart')}</label>
                      <input type="number" value={form.odometerStart} onChange={(e) => setForm({ ...form, odometerStart: e.target.value })} className="w-full px-2 py-1.5 rounded border text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600">{st('siep.reports.field.odometerEnd')}</label>
                      <input type="number" value={form.odometerEnd} onChange={(e) => setForm({ ...form, odometerEnd: e.target.value })} className="w-full px-2 py-1.5 rounded border text-sm" />
                    </div>
                  </div>
                  {distancePreview > 0 && (
                    <p className="text-xs text-amber-800">{st('siep.reports.field.distance')}: <strong>{distancePreview} km</strong></p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder={st('siep.reports.field.from')} value={form.fromPlace} onChange={(e) => setForm({ ...form, fromPlace: e.target.value })} className="px-2 py-1.5 rounded border text-sm" />
                    <input placeholder={st('siep.reports.field.to')} value={form.toPlace} onChange={(e) => setForm({ ...form, toPlace: e.target.value })} className="px-2 py-1.5 rounded border text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder={st('siep.reports.field.city')} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="px-2 py-1.5 rounded border text-sm" />
                    <input placeholder={st('siep.reports.field.country')} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="px-2 py-1.5 rounded border text-sm" />
                  </div>
                  <input placeholder={st('siep.reports.field.odometerStartPhoto')} value={form.odometerStartPhoto} onChange={(e) => setForm({ ...form, odometerStartPhoto: e.target.value })} className="w-full px-2 py-1.5 rounded border text-xs" />
                  <input placeholder={st('siep.reports.field.odometerEndPhoto')} value={form.odometerEndPhoto} onChange={(e) => setForm({ ...form, odometerEndPhoto: e.target.value })} className="w-full px-2 py-1.5 rounded border text-xs" />
                  <div className="flex gap-2">
                    <input placeholder={st('siep.reports.field.receipt')} value={form.receiptUrlInput} onChange={(e) => setForm({ ...form, receiptUrlInput: e.target.value })} className="flex-1 px-2 py-1.5 rounded border text-xs" />
                    <button type="button" onClick={() => addUrl('receiptUrls', 'receiptUrlInput')} className="px-2 text-xs border rounded">+</button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setModalTaskId(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{st('siep.reports.cancel')}</button>
                <button type="button" disabled={saving || !form.narrative.trim()} onClick={() => saveReport(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1">
                  <Save className="w-4 h-4" /> {st('siep.reports.draft')}
                </button>
                <button type="button" disabled={saving || !form.narrative.trim()} onClick={() => saveReport(true)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {st('siep.reports.submit')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
