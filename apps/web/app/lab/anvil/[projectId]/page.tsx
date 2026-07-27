'use client';

import { useApp } from '@/app/providers';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Hammer,
  Send,
  Plus,
  Rocket,
  Users,
  Settings2,
  Loader2,
  Trash2,
} from 'lucide-react';

type DeployTarget = {
  id: string;
  kind: string;
  label: string;
  isDefault: boolean;
  status: string;
};

type Message = {
  id: string;
  role: string;
  content: string;
  metaJson?: {
    plan?: string[];
    artifacts?: Array<{ path: string; summary: string }>;
    policyWarnings?: string[];
    suggestedDeployKind?: string;
    reuseDecision?: string;
    blockedReasons?: string[];
  } | null;
  createdAt: string;
};

type Session = {
  id: string;
  title?: string | null;
  status: string;
  _count?: { messages: number };
};

type Project = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  visibility: string;
  relation: string;
  workspaceKind: string;
  repoUrl?: string | null;
  allowedReuse?: string[];
  agent?: { id: string; status: string; systemPromptExtra?: string | null } | null;
  deployTargets: DeployTarget[];
  members: Array<{ id: string; email: string; role: string; status: string }>;
  sessions: Session[];
};

export default function AnvilProjectPage() {
  const { locale } = useApp();
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<'chat' | 'deploy' | 'members' | 'settings'>('chat');
  const [memberEmail, setMemberEmail] = useState('');
  const [newTarget, setNewTarget] = useState({ kind: 'contabo', label: 'Contabo prod' });
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const t = (es: string, pt: string, en: string) =>
    locale === 'pt' ? pt : locale === 'en' ? en : es;

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/lab/anvil/projects/${projectId}`);
    if (!res.ok) {
      setError('Projeto inacessível');
      setLoading(false);
      return;
    }
    const data = await res.json();
    setProject(data.project);
    setIsOwner(!!data.isOwner);
    setLoading(false);
  }, [projectId]);

  const loadSession = useCallback(async (id: string) => {
    const res = await fetch(`/api/lab/anvil/sessions/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setSessionId(id);
    setMessages(data.session.messages || []);
  }, []);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const startSession = async () => {
    const res = await fetch(`/api/lab/anvil/projects/${projectId}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Erro');
      return;
    }
    setSessionId(data.session.id);
    setMessages([]);
    setTab('chat');
    await loadProject();
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    let sid = sessionId;
    if (!sid) {
      const res = await fetch(`/api/lab/anvil/projects/${projectId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro');
        return;
      }
      sid = data.session.id;
      setSessionId(sid);
    }

    const text = input.trim();
    setInput('');
    setSending(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}`,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch(`/api/lab/anvil/sessions/${sid}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro do agente');
      }
      await loadSession(sid!);
      await loadProject();
    } finally {
      setSending(false);
    }
  };

  const addMember = async () => {
    if (!memberEmail.trim()) return;
    const res = await fetch(`/api/lab/anvil/projects/${projectId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: memberEmail.trim() }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || 'Erro');
    setMemberEmail('');
    await loadProject();
  };

  const revokeMember = async (id: string) => {
    await fetch(`/api/lab/anvil/projects/${projectId}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await loadProject();
  };

  const addDeployTarget = async () => {
    const res = await fetch(`/api/lab/anvil/projects/${projectId}/deploy-targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTarget),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || 'Erro');
    await loadProject();
  };

  const setDefaultTarget = async (id: string) => {
    await fetch(`/api/lab/anvil/projects/${projectId}/deploy-targets`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isDefault: true }),
    });
    await loadProject();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16 text-slate-400">
        {error || 'Not found'}
        <div className="mt-4">
          <Link href="/lab/anvil" className="text-amber-400 text-sm">
            ← ANVIL
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/lab/anvil" className="text-sm text-slate-500 hover:text-slate-300">
            ← ANVIL
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center">
              <Hammer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{project.name}</h1>
              <p className="text-xs text-slate-400">
                {project.visibility} · {project.relation} · {project.workspaceKind}
                {project.agent ? ` · agente ${project.agent.status}` : ''}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={startSession}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-500"
        >
          <Plus className="w-4 h-4" />
          {t('Nueva sesión', 'Nova sessão', 'New session')}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(
          [
            ['chat', t('Chat', 'Chat', 'Chat')],
            ['deploy', t('Deploy', 'Deploy', 'Deploy')],
            ['members', t('Miembros', 'Membros', 'Members')],
            ['settings', t('Política', 'Política', 'Policy')],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition ${
              tab === key
                ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3 space-y-1 max-h-[70vh] overflow-y-auto">
            <p className="text-[10px] uppercase text-slate-500 px-2 mb-2">Sessions</p>
            {project.sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`w-full text-left px-2 py-2 rounded-lg text-sm truncate ${
                  sessionId === s.id
                    ? 'bg-amber-500/15 text-amber-200'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {s.title || s.id.slice(0, 8)}
              </button>
            ))}
            {project.sessions.length === 0 && (
              <p className="text-xs text-slate-500 px-2">
                {t('Sin sesiones', 'Sem sessões', 'No sessions')}
              </p>
            )}
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 flex flex-col min-h-[60vh] max-h-[75vh]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-12">
                  {t(
                    'Describe lo que quieres construir o cambiar. El agente respeta la política de este proyecto.',
                    'Descreve o que queres construir ou alterar. O agente respeita a política deste projeto.',
                    'Describe what you want to build or change. The agent respects this project policy.',
                  )}
                </p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-slate-800 text-slate-100 ml-8'
                      : 'bg-amber-500/5 border border-amber-500/10 text-slate-200 mr-4'
                  }`}
                >
                  <div className="text-[10px] uppercase text-slate-500 mb-1">{m.role}</div>
                  {m.content}
                  {m.metaJson?.artifacts && m.metaJson.artifacts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1">
                      <div className="text-[10px] uppercase text-amber-400/80">Artifacts</div>
                      {m.metaJson.artifacts.map((a, i) => (
                        <div key={i} className="text-xs text-slate-400">
                          <span className="font-mono text-amber-300/90">{a.path}</span> — {a.summary}
                        </div>
                      ))}
                    </div>
                  )}
                  {m.metaJson?.suggestedDeployKind && (
                    <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                      <Rocket className="w-3 h-3" />
                      deploy sugerido: {m.metaJson.suggestedDeployKind}
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  ANVIL…
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-slate-800 p-3 flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={2}
                placeholder={t(
                  'Pide un plan, código, o deploy preview…',
                  'Pede um plano, código, ou deploy preview…',
                  'Ask for a plan, code, or preview deploy…',
                )}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white resize-none"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'deploy' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Rocket className="w-4 h-4 text-amber-400" />
            Deploy targets
          </h3>
          <p className="text-sm text-slate-400">
            {t(
              'Elige preview primero; Contabo u otro host cuando apruebes.',
              'Escolhe preview primeiro; Contabo ou outro host quando aprovares.',
              'Use preview first; Contabo or another host when you approve.',
            )}
          </p>
          <div className="space-y-2">
            {project.deployTargets.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3"
              >
                <div>
                  <div className="text-sm text-white">
                    {d.label}{' '}
                    <span className="text-xs text-slate-500">({d.kind})</span>
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase">{d.status}</div>
                </div>
                <div className="flex items-center gap-2">
                  {d.isDefault ? (
                    <span className="text-[10px] text-amber-400">default</span>
                  ) : (
                    isOwner && (
                      <button
                        onClick={() => setDefaultTarget(d.id)}
                        className="text-xs text-slate-400 hover:text-amber-300"
                      >
                        set default
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
          {isOwner && (
            <div className="flex gap-2 flex-wrap">
              <select
                value={newTarget.kind}
                onChange={(e) => setNewTarget({ ...newTarget, kind: e.target.value })}
                className="px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              >
                <option value="preview">preview</option>
                <option value="staging">staging</option>
                <option value="contabo">contabo</option>
                <option value="custom">custom</option>
              </select>
              <input
                value={newTarget.label}
                onChange={(e) => setNewTarget({ ...newTarget, label: e.target.value })}
                className="flex-1 min-w-[140px] px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              />
              <button
                onClick={addDeployTarget}
                className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm"
              >
                {t('Añadir', 'Adicionar', 'Add')}
              </button>
            </div>
          )}
          <p className="text-xs text-slate-500">
            F2/F3: execução real de preview e Contabo ainda pendente — targets já ficam no projeto.
          </p>
        </div>
      )}

      {tab === 'members' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            {t('Miembros del proyecto', 'Membros do projeto', 'Project members')}
          </h3>
          {project.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3"
            >
              <div className="text-sm text-slate-200">
                {m.email}{' '}
                <span className="text-xs text-slate-500">
                  {m.role} · {m.status}
                </span>
              </div>
              {isOwner && m.role !== 'owner' && (
                <button onClick={() => revokeMember(m.id)} className="text-slate-500 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {isOwner && (
            <div className="flex gap-2">
              <input
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="email@..."
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              />
              <button
                onClick={addMember}
                className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm"
              >
                {t('Añadir', 'Adicionar', 'Add')}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-3 text-sm">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-amber-400" />
            Política
          </h3>
          <Row label="slug" value={project.slug} />
          <Row label="visibility" value={project.visibility} />
          <Row label="relation" value={project.relation} />
          <Row label="workspace" value={project.workspaceKind} />
          <Row label="repo" value={project.repoUrl || '—'} />
          <Row
            label="allowedReuse"
            value={
              Array.isArray(project.allowedReuse) && project.allowedReuse.length
                ? project.allowedReuse.join(', ')
                : '(vazio)'
            }
          />
          {project.visibility === 'public_oss' && (
            <p className="text-amber-300/90 text-xs mt-2 bg-amber-500/10 rounded-lg px-3 py-2">
              OSS: o agente está bloqueado de ler/copiar o monorepo Etholys. Reuso só via API /
              allowedReuse / reimplementação.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-slate-800/80 py-2">
      <span className="w-28 text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-200 break-all">{value}</span>
    </div>
  );
}
