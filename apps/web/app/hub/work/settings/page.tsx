'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckSquare,
  Edit2,
  FolderKanban,
  Layers,
  Plus,
  Settings,
  Shield,
  Trash2,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { STARTER_GROUPS } from '@/components/work/work-ui';

export default function HubWorkSettingsPage() {
  const { locale, activeCompanyId } = useApp();
  const t = (en: string, es: string, pt: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const [departments, setDepartments] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showDeptForm, setShowDeptForm] = useState(false);
  const [editDept, setEditDept] = useState<any>(null);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');

  const [newGroupName, setNewGroupName] = useState('');
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    if (!activeCompanyId) {
      setDepartments([]);
      setProjects([]);
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const q = `companyId=${encodeURIComponent(activeCompanyId)}`;
      const [dRes, pRes, gRes] = await Promise.all([
        fetch(`/api/departments?${q}`),
        fetch(`/api/projects?${q}`),
        fetch(`/api/task-groups?${q}`),
      ]);
      const d = await dRes.json().catch(() => ({}));
      const p = await pRes.json().catch(() => ({}));
      const g = await gRes.json().catch(() => ({}));
      setDepartments(d?.departments ?? []);
      setProjects(p?.projects ?? []);
      setGroups(g?.groups ?? []);
    } catch {
      setError(t('Could not load settings', 'No se pudo cargar', 'Não foi possível carregar'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [activeCompanyId]);

  const openCreateDept = () => {
    setEditDept(null);
    setDeptName('');
    setDeptCode('');
    setShowDeptForm(true);
  };

  const openEditDept = (d: any) => {
    setEditDept(d);
    setDeptName(d.name || '');
    setDeptCode(d.code || '');
    setShowDeptForm(true);
  };

  const saveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !deptName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/departments', {
        method: editDept ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editDept
            ? { id: editDept.id, name: deptName.trim(), code: deptCode.trim() || null }
            : { companyId: activeCompanyId, name: deptName.trim(), code: deptCode.trim() || null },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      setShowDeptForm(false);
      setEditDept(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteDept = async (id: string, name: string) => {
    if (!confirm(`${t('Delete department', 'Eliminar sector', 'Excluir setor')} "${name}"?`)) return;
    await fetch(`/api/departments?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await load();
  };

  const createGroup = async () => {
    if (!activeCompanyId || !newGroupName.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/task-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: activeCompanyId, name: newGroupName.trim() }),
      });
      setNewGroupName('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const seedGroups = async () => {
    if (!activeCompanyId || seeding) return;
    setSeeding(true);
    try {
      for (const g of STARTER_GROUPS) {
        await fetch('/api/task-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: activeCompanyId, name: g.name, color: g.color }),
        });
      }
      await load();
    } finally {
      setSeeding(false);
    }
  };

  const deleteGroup = async (id: string, name: string) => {
    if (!confirm(`${t('Delete section', 'Eliminar sección', 'Excluir secção')} "${name}"?`)) return;
    await fetch(`/api/task-groups/${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-50 via-slate-50 to-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/hub/work"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Work
            </Link>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-700 text-white">
              <Settings className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-slate-900">
                {t('Work settings', 'Ajustes de Work', 'Definições Work')}
              </h1>
              <p className="truncate text-xs text-slate-500">
                {t(
                  'Departments, board sections and links — without leaving Work',
                  'Sectores, secciones del tablero y atajos — sin salir de Work',
                  'Setores, secções do quadro e atalhos — sem sair do Work',
                )}
              </p>
            </div>
          </div>
          <Link
            href="/hub/work"
            className="hidden items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-xs font-medium text-cyan-800 hover:bg-cyan-100 sm:inline-flex"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {t('Open board', 'Abrir tablero', 'Abrir quadro')}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        {!activeCompanyId && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t(
              'Select an active company in the Hub to manage Work structure.',
              'Selecciona una empresa activa en el Hub para gestionar la estructura.',
              'Seleciona uma empresa ativa no Hub para gerir a estrutura.',
            )}
          </div>
        )}

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600/30 border-t-cyan-600" />
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-5 shadow-sm">
              <h2 className="mb-1 text-sm font-semibold text-cyan-900">
                {t('Personal & team folders', 'Carpetas personales y de equipo', 'Pastas pessoais e de equipa')}
              </h2>
              <p className="text-sm text-cyan-900/80">
                {t(
                  'Anyone can create folders from the Work sidebar — Personal (only you) or Team (shared with the company). No admin required.',
                  'Cualquiera crea carpetas desde la barra de Work — Personal (solo tú) o Equipo (empresa). Sin ser admin.',
                  'Qualquer pessoa cria pastas na barra do Work — Pessoal (só tu) ou Equipa (empresa). Sem ser admin.',
                )}
              </p>
              <Link href="/hub/work" className="mt-3 inline-flex text-sm font-semibold text-cyan-800 hover:underline">
                {t('Open Work →', 'Abrir Work →', 'Abrir Work →')}
              </Link>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <FolderKanban className="h-4 w-4 text-cyan-700" />
                    {t('Departments / sectors', 'Departamentos / sectores', 'Departamentos / setores')}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {t(
                      'Same company departments used across Etholys. They appear in the Work sidebar.',
                      'Los mismos sectores de la empresa en Etholys. Aparecen en la barra de Work.',
                      'Os mesmos setores da empresa no Etholys. Aparecem na barra do Work.',
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!activeCompanyId}
                  onClick={openCreateDept}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('New', 'Nuevo', 'Novo')}
                </button>
              </div>

              <ul className="space-y-1">
                {departments.length === 0 && (
                  <li className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                    {t(
                      'No departments yet — create Finance, Ops, Programs…',
                      'Sin sectores — crea Finanzas, Ops, Programas…',
                      'Sem setores — cria Finanças, Ops, Programas…',
                    )}
                  </li>
                )}
                {departments.map((d) => (
                  <li
                    key={d.id}
                    className="group flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 font-medium text-slate-800">{d.name}</span>
                    {d.code ? <span className="text-[11px] text-slate-400">{d.code}</span> : null}
                    <button
                      type="button"
                      onClick={() => openEditDept(d)}
                      className="rounded p-1 text-slate-400 opacity-0 hover:text-cyan-700 group-hover:opacity-100"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteDept(d.id, d.name)}
                      className="rounded p-1 text-slate-400 opacity-0 hover:text-rose-600 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>

              {showDeptForm && (
                <form onSubmit={saveDept} className="mt-4 space-y-3 rounded-xl border border-cyan-100 bg-cyan-50/40 p-4">
                  <input
                    required
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder={t('Name', 'Nombre', 'Nome')}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  />
                  <input
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    placeholder={t('Code (optional)', 'Código (opcional)', 'Código (opcional)')}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDeptForm(false)}
                      className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-white"
                    >
                      {t('Cancel', 'Cancelar', 'Cancelar')}
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-40"
                    >
                      {t('Save', 'Guardar', 'Guardar')}
                    </button>
                  </div>
                </form>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Layers className="h-4 w-4 text-cyan-700" />
                    {t('Board sections (groups)', 'Secciones del tablero', 'Secções do quadro')}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {t(
                      'Monday-style groups shared across the company board.',
                      'Grupos estilo Monday compartidos en el tablero.',
                      'Grupos estilo Monday partilhados no quadro.',
                    )}
                  </p>
                </div>
                {groups.length === 0 && (
                  <button
                    type="button"
                    disabled={!activeCompanyId || seeding}
                    onClick={() => void seedGroups()}
                    className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-800 hover:bg-cyan-100 disabled:opacity-40"
                  >
                    {t('Starter: To do / Doing / Done', 'Inicial: To do / Doing / Done', 'Inicial: To do / Doing / Done')}
                  </button>
                )}
              </div>

              <ul className="mb-3 space-y-1">
                {groups.map((g) => (
                  <li key={g.id} className="group flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: g.color || '#0891b2' }} />
                    <span className="min-w-0 flex-1 font-medium text-slate-800">{g.name}</span>
                    <button
                      type="button"
                      onClick={() => void deleteGroup(g.id, g.name)}
                      className="rounded p-1 text-slate-400 opacity-0 hover:text-rose-600 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex gap-2">
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void createGroup())}
                  placeholder={t('New section…', 'Nueva sección…', 'Nova secção…')}
                  className="flex-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-400"
                  disabled={!activeCompanyId}
                />
                <button
                  type="button"
                  disabled={!activeCompanyId || saving || !newGroupName.trim()}
                  onClick={() => void createGroup()}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Building2 className="h-4 w-4 text-cyan-700" />
                {t('Projects', 'Proyectos', 'Projetos')}
              </h2>
              <p className="mb-4 text-xs text-slate-500">
                {t(
                  'Projects stay in SIEP. Create or edit them there; they show in the Work sidebar.',
                  'Los proyectos se gestionan en SIEP. Créalos allí; aparecen en la barra de Work.',
                  'Os projetos gerem-se no SIEP. Cria-os lá; aparecem na barra do Work.',
                )}
              </p>
              <ul className="mb-4 space-y-1">
                {projects.slice(0, 12).map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="truncate font-medium text-slate-800">{p.name}</span>
                    <span className="text-[11px] tabular-nums text-slate-400">{p._count?.tasks ?? 0}</span>
                  </li>
                ))}
                {projects.length === 0 && (
                  <li className="text-sm text-slate-400">
                    {t('No projects yet', 'Sin proyectos', 'Sem projetos')}
                  </li>
                )}
              </ul>
              <Link
                href="/siep/projects"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-700 hover:underline"
              >
                {t('Open SIEP projects', 'Abrir proyectos SIEP', 'Abrir projetos SIEP')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/hub/workspace/team"
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-300"
              >
                <div className="flex items-center gap-2 text-cyan-800">
                  <Shield className="h-5 w-5" />
                  <span className="font-semibold">{t('Team access', 'Acceso del equipo', 'Acesso da equipa')}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {t(
                    'Who can open Work and other Etholys systems.',
                    'Quién puede abrir Work y otros sistemas.',
                    'Quem pode abrir Work e outros sistemas.',
                  )}
                </p>
              </Link>
              <Link
                href="/hub/admin"
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400"
              >
                <div className="flex items-center gap-2 text-slate-800">
                  <Building2 className="h-5 w-5" />
                  <span className="font-semibold">
                    {t('Etholys administration', 'Administración Etholys', 'Administração Etholys')}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {t(
                    'Companies, invitations, profile and licenses.',
                    'Empresas, invitaciones, perfil y licencias.',
                    'Empresas, convites, perfil e licenças.',
                  )}
                </p>
              </Link>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
