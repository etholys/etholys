'use client';

import { useApp } from '@/app/providers';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  Hammer,
  Plus,
  Shield,
  Users,
  Trash2,
  Copy,
  Check,
  ArrowRight,
  Lock,
  Globe2,
  Boxes,
} from 'lucide-react';

type Project = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  visibility: string;
  relation: string;
  workspaceKind: string;
  agent?: { status: string } | null;
  deployTargets?: Array<{ kind: string; label: string; isDefault: boolean }>;
  _count?: { sessions: number; members: number };
};

type Member = {
  id: string;
  email: string;
  status: string;
  inviteCode: string;
  user?: { name: string; email: string } | null;
};

const RELATION_LABELS: Record<string, string> = {
  etholys_core: 'Etholys core',
  standalone: 'Externo',
  consumes_etholys_api: 'OSS + API Etholys',
  whitelabel_instance: 'Whitelabel',
};

export default function AnvilLabPage() {
  const { locale } = useApp();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [needsInvite, setNeedsInvite] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    visibility: 'private',
    relation: 'standalone',
    workspaceKind: 'sandbox',
    repoUrl: '',
    allowedReuse: '',
  });

  const t = (es: string, pt: string, en: string) =>
    locale === 'pt' ? pt : locale === 'en' ? en : es;

  const loadAccess = useCallback(async () => {
    const res = await fetch('/api/lab/anvil/access');
    const data = await res.json();
    setHasAccess(!!data.hasAccess);
    setIsOwner(!!data.isOwner);
    setNeedsInvite(!!data.needsInvite && !data.hasAccess);
    setMembers(data.members || []);
    return !!data.hasAccess;
  }, []);

  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/lab/anvil/projects');
    if (!res.ok) return;
    const data = await res.json();
    setProjects(data.projects || []);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ok = await loadAccess();
      if (ok) await loadProjects();
      setLoading(false);
    })();
  }, [loadAccess, loadProjects]);

  const acceptInvite = async () => {
    setError('');
    const res = await fetch('/api/lab/anvil/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', code: inviteCode.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Erro');
      return;
    }
    setNeedsInvite(false);
    setHasAccess(true);
    await loadAccess();
    await loadProjects();
  };

  const createInvite = async () => {
    if (!inviteEmail.trim()) return;
    const res = await fetch('/api/lab/anvil/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Erro');
      return;
    }
    setInviteEmail('');
    await loadAccess();
  };

  const revokeMember = async (id: string) => {
    await fetch('/api/lab/anvil/access', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await loadAccess();
  };

  const createProject = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/lab/anvil/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          visibility: form.visibility,
          relation: form.relation,
          workspaceKind:
            form.visibility === 'public_oss' && form.workspaceKind === 'etholys_monorepo'
              ? 'external_repo'
              : form.workspaceKind,
          repoUrl: form.repoUrl.trim() || undefined,
          allowedReuse: form.allowedReuse
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro');
        return;
      }
      setShowCreate(false);
      setForm({
        name: '',
        description: '',
        visibility: 'private',
        relation: 'standalone',
        workspaceKind: 'sandbox',
        repoUrl: '',
        allowedReuse: '',
      });
      await loadProjects();
    } finally {
      setCreating(false);
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (needsInvite || !hasAccess) {
    return (
      <div className="max-w-md mx-auto py-12">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center mx-auto mb-4">
            <Hammer className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">ANVIL</h1>
          <p className="text-sm text-slate-400">
            {t(
              'Herramienta interna de ingeniería. Introduce tu código de invitación.',
              'Ferramenta interna de engenharia. Introduz o teu código de convite.',
              'Internal engineering tool. Enter your invitation code.',
            )}
          </p>
        </div>
        <div className="space-y-3">
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder={t('Código', 'Código', 'Code')}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-center font-mono text-white tracking-widest"
            maxLength={8}
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            onClick={acceptInvite}
            disabled={!inviteCode.trim()}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium disabled:opacity-50"
          >
            {t('Acceder', 'Aceder', 'Access')}
          </button>
          <Link href="/lab" className="block text-center text-sm text-slate-500 hover:text-slate-300">
            ← Lab
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/lab" className="text-slate-500 hover:text-slate-300 text-sm">
              ← Lab
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center">
              <Hammer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">ANVIL</h1>
              <p className="text-sm text-slate-400">
                {t(
                  'Un agente por proyecto',
                  'Um agente por projeto',
                  'One agent per project',
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <>
              <button
                onClick={() => setShowMembers(!showMembers)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition ${
                  showMembers
                    ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                {t('Usuarios', 'Utilizadores', 'Users')}
              </button>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-500"
              >
                <Plus className="w-4 h-4" />
                {t('Proyecto', 'Projeto', 'Project')}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {isOwner && showMembers && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            {t('Acceso ANVIL', 'Acesso ANVIL', 'ANVIL access')}
          </h3>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@..."
              className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200"
            />
            <button
              onClick={createInvite}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-500"
            >
              {t('Invitar', 'Convidar', 'Invite')}
            </button>
          </div>
          <div className="space-y-2">
            {members.length === 0 && (
              <p className="text-sm text-slate-500">
                {t('Sin invitaciones.', 'Sem convites.', 'No invites.')}
              </p>
            )}
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3"
              >
                <div>
                  <div className="text-sm text-slate-200">{m.email}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] uppercase text-slate-500">{m.status}</span>
                    {m.status === 'pending' && (
                      <>
                        <span className="text-xs font-mono text-amber-400">{m.inviteCode}</span>
                        <button
                          onClick={() => copyCode(m.inviteCode, m.id)}
                          className="text-slate-500 hover:text-amber-400"
                        >
                          {copied === m.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {m.status !== 'revoked' && (
                  <button
                    onClick={() => revokeMember(m.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isOwner && showCreate && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
          <h3 className="font-semibold text-white">
            {t('Nuevo proyecto + agente', 'Novo projeto + agente', 'New project + agent')}
          </h3>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('Nombre', 'Nome', 'Name')}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={t('Descripción', 'Descrição', 'Description')}
            rows={2}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-slate-400 space-y-1">
              Visibility
              <select
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value })}
                className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              >
                <option value="private">private</option>
                <option value="public_oss">public_oss</option>
              </select>
            </label>
            <label className="text-xs text-slate-400 space-y-1">
              Relation
              <select
                value={form.relation}
                onChange={(e) => {
                  const relation = e.target.value;
                  setForm({
                    ...form,
                    relation,
                    workspaceKind:
                      relation === 'etholys_core' || relation === 'whitelabel_instance'
                        ? 'etholys_monorepo'
                        : relation === 'consumes_etholys_api'
                          ? 'external_repo'
                          : form.workspaceKind,
                  });
                }}
                className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              >
                <option value="standalone">standalone</option>
                <option value="etholys_core">etholys_core</option>
                <option value="consumes_etholys_api">consumes_etholys_api</option>
                <option value="whitelabel_instance">whitelabel_instance</option>
              </select>
            </label>
            <label className="text-xs text-slate-400 space-y-1">
              Workspace
              <select
                value={form.workspaceKind}
                onChange={(e) => setForm({ ...form, workspaceKind: e.target.value })}
                className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              >
                <option value="sandbox">sandbox</option>
                <option value="external_repo">external_repo</option>
                <option value="etholys_monorepo">etholys_monorepo</option>
              </select>
            </label>
          </div>
          <input
            value={form.repoUrl}
            onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
            placeholder="https://github.com/..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
          />
          <input
            value={form.allowedReuse}
            onChange={(e) => setForm({ ...form, allowedReuse: e.target.value })}
            placeholder="allowedReuse: api:..., npm:@etholys/oss-... (CSV)"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
          />
          <button
            onClick={createProject}
            disabled={creating || !form.name.trim()}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-500 disabled:opacity-50"
          >
            {creating
              ? t('Creando…', 'A criar…', 'Creating…')
              : t('Crear agente', 'Criar agente', 'Create agent')}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => {
          const Icon =
            p.visibility === 'public_oss' ? Globe2 : p.relation === 'etholys_core' ? Boxes : Lock;
          return (
            <Link
              key={p.id}
              href={`/lab/anvil/${p.id}`}
              className="group bg-slate-900 rounded-2xl border border-slate-800 hover:border-amber-500/40 p-5 transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-slate-800 text-slate-400">
                  {RELATION_LABELS[p.relation] || p.relation}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">{p.name}</h3>
              <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                {p.description || p.slug}
              </p>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {p.visibility} · {p.workspaceKind}
                </span>
                <span className="flex items-center gap-1 text-amber-400 group-hover:gap-2 transition-all">
                  {t('Abrir', 'Abrir', 'Open')}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {projects.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-8">
          {t(
            'Aún no hay proyectos. Crea el primero.',
            'Ainda não há projetos. Cria o primeiro.',
            'No projects yet. Create the first one.',
          )}
        </p>
      )}
    </div>
  );
}
