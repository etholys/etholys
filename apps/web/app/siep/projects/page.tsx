'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/app/providers';
import { formatCurrency, formatDate, getStatusColor, formatPercent } from '@/lib/utils';
import { Plus, Search, FolderKanban, Calendar, DollarSign, Users, X, MapPin, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function ProjectsPage() {
  const { tr, activeCompanyId, locale } = useApp();
  type ML = { es: string; pt: string; en: string };
  const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
  const L = (m: ML) => m[locale] || m.en;
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ name: '', description: '', companyId: '', donorName: '', status: 'DRAFT', priority: 'MEDIUM', budget: 0, startDate: '', endDate: '', country: '', region: '', currency: 'USD' });

  const fetchProjects = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeCompanyId) params.set('companyId', activeCompanyId);
    if (statusFilter) params.set('status', statusFilter);
    if (includeInactive) params.set('includeInactive', '1');
    setFetchError(null);
    fetch(`/api/projects?${params}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setFetchError(d?.error || `Erro ${r.status}`);
          setProjects([]);
          return;
        }
        setProjects(d?.projects ?? []);
      })
      .catch(() => setFetchError('Falha de rede ao carregar projetos.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProjects(); }, [activeCompanyId, statusFilter, includeInactive]);
  useEffect(() => {
    fetch('/api/companies').then(r => r.json()).then(d => setCompanies(d?.companies ?? [])).catch(() => {});
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d?.users ?? [])).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { ...form, budget: parseFloat(form.budget) || 0, startDate: form.startDate ? new Date(form.startDate) : null, endDate: form.endDate ? new Date(form.endDate) : null };
    await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setShowForm(false);
    setForm({ name: '', description: '', companyId: '', donorName: '', status: 'DRAFT', priority: 'MEDIUM', budget: 0, startDate: '', endDate: '', country: '', region: '', currency: 'USD' });
    fetchProjects();
  };

  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, projectId: string, projectName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`\u00bfEliminar el proyecto "${projectName}"?\n\nEsta acci\u00f3n no se puede deshacer.`)) return;
    setDeleting(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) fetchProjects();
    } catch {}
    setDeleting(null);
  };

  const filtered = (projects ?? []).filter((p: any) => {
    if (search && !(p?.name ?? '').toLowerCase().includes(search.toLowerCase()) && !(p?.donorName ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statuses = ['DRAFT', 'PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

  return (
    <div className="space-y-6">
      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {fetchError}
          <span className="block mt-1 text-red-700/90">
            {locale === 'pt' ? 'Os dados não foram apagados — é um erro de carregamento. Recarregue a página.' : locale === 'es' ? 'Los datos no se borraron — es un error de carga. Recargue la página.' : 'Data was not deleted — this is a load error. Reload the page.'}
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tr('nav.projects')}</h1>
          <p className="text-gray-500 text-sm">{filtered?.length ?? 0} {tr('nav.projects').toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/siep/import" className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-700 hover:to-indigo-700 transition font-medium text-sm shadow-sm">
            <Sparkles className="w-4 h-4" />Importar
          </Link>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm">
            <Plus className="w-4 h-4" />{tr('project.new')}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr('general.search')} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
          <option value="">{tr('general.all')}</option>
          {statuses.map(s => <option key={s} value={s}>{tr(`status.${s.toLowerCase()}`)}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          {locale === 'pt' ? 'Incluir arquivados' : locale === 'es' ? 'Incluir archivados' : 'Include archived'}
        </label>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p: any) => (
            <Link key={p?.id} href={`/siep/projects/${p?.id}`} className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all group relative">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p?.company?.color ?? '#4F46E5' }} />
                  <span className="text-xs font-medium text-gray-500">{p?.company?.shortName ?? ''}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: getStatusColor(p?.status ?? '') + '20', color: getStatusColor(p?.status ?? '') }}>
                    {tr(`status.${(p?.status ?? '').toLowerCase()}`)}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, p?.id, p?.name)}
                    disabled={deleting === p?.id}
                    className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                    title={L(ml("Delete project","Eliminar proyecto","Excluir projeto"))}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition mb-1 line-clamp-2">{p?.name ?? ''}</h3>
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 flex-wrap">
                {p?.donorName && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{p.donorName}</span>}
                {p?.country && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.country}{p.region ? ` \u00b7 ${p.region}` : ''}</span>}
              </div>
              <div className="mb-2 space-y-1.5">
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5"><span className="text-gray-400">Ejecuci&oacute;n</span><span className="font-medium text-gray-600">{formatPercent(p?.progress)}</span></div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${p?.progress ?? 0}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5"><span className="text-gray-400">Financiero</span><span className="font-medium text-gray-600">{p?.budget > 0 ? Math.round(((p?.spent ?? 0) / p.budget) * 100) : 0}%</span></div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${p?.budget > 0 ? Math.min(100, Math.round(((p?.spent ?? 0) / p.budget) * 100)) : 0}%` }} /></div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{p?.currency ?? 'USD'} {formatCurrency(p?.budget)}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(p?.endDate)}</span>
              </div>
            </Link>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-gray-400">{tr('general.noData')}</div>}
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{tr('project.new')}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('project.name')} *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('project.description')}</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('auth.company')} *</label>
                  <select required value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">{tr('company.selector')}</option>
                    {(companies ?? []).map((c: any) => <option key={c?.id} value={c?.id}>{c?.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('project.donor')}</label><input value={form.donorName} onChange={e => setForm({ ...form, donorName: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('project.startDate')}</label><input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('project.endDate')}</label><input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Pa&iacute;s</label><input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="Uruguay, Brasil..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Regi&oacute;n</label><input value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} placeholder="Latinoam&eacute;rica..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                  <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="USD">USD</option><option value="BRL">BRL</option><option value="EUR">EUR</option><option value="UYU">UYU</option><option value="ARS">ARS</option><option value="GBP">GBP</option><option value="CHF">CHF</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('project.budget')}</label><input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('general.status')}</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    {statuses.map(s => <option key={s} value={s}>{tr(`status.${s.toLowerCase()}`)}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('general.priority')}</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <option key={p} value={p}>{tr(`priority.${p.toLowerCase()}`)}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">{tr('general.cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">{tr('general.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
