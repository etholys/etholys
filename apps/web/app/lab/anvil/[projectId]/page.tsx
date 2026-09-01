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
  FolderTree,
  FileCode2,
  ExternalLink,
} from 'lucide-react';

type DeployTarget = {
  id: string;
  kind: string;
  label: string;
  isDefault: boolean;
  status: string;
  configJson?: { token?: string; entry?: string; fileCount?: number; builtAt?: string } | null;
};

type Message = {
  id: string;
  role: string;
  content: string;
  metaJson?: {
    plan?: string[];
    artifacts?: Array<{ path: string; summary: string; language?: string; content?: string }>;
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

type SandboxFileMeta = {
  id: string;
  path: string;
  size: number;
  sha256?: string | null;
  mimeType?: string | null;
  updatedAt: string;
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
  const [tab, setTab] = useState<'chat' | 'files' | 'deploy' | 'members' | 'settings'>('chat');
  const [memberEmail, setMemberEmail] = useState('');
  const [newTarget, setNewTarget] = useState({ kind: 'contabo', label: 'Contabo prod' });
  const [error, setError] = useState('');
  const [files, setFiles] = useState<SandboxFileMeta[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileDirty, setFileDirty] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [applyingMsgId, setApplyingMsgId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [buildingPreview, setBuildingPreview] = useState(false);
  const [newFilePath, setNewFilePath] = useState('index.html');
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

  const loadFiles = useCallback(async () => {
    if (!projectId) return;
    setFilesLoading(true);
    try {
      const res = await fetch(`/api/lab/anvil/projects/${projectId}/files`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400) {
          setFiles([]);
          return;
        }
        setError(data.error || 'Erro ao listar ficheiros');
        return;
      }
      setFiles(data.files || []);
    } finally {
      setFilesLoading(false);
    }
  }, [projectId]);

  const openFile = async (path: string) => {
    const res = await fetch(
      `/api/lab/anvil/projects/${projectId}/files?path=${encodeURIComponent(path)}`,
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Erro ao ler ficheiro');
      return;
    }
    setSelectedPath(path);
    setFileContent(data.file?.contentText ?? '');
    setFileDirty(false);
  };

  const saveFile = async () => {
    if (!selectedPath) return;
    setSavingFile(true);
    try {
      const res = await fetch(`/api/lab/anvil/projects/${projectId}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedPath, content: fileContent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao gravar');
        return;
      }
      setFileDirty(false);
      await loadFiles();
    } finally {
      setSavingFile(false);
    }
  };

  const createFile = async () => {
    const path = newFilePath.trim();
    if (!path) return;
    const res = await fetch(`/api/lab/anvil/projects/${projectId}/files`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        content: path.endsWith('.html')
          ? '<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8"><title>ANVIL</title></head>\n<body>\n  <h1>Hello ANVIL</h1>\n</body>\n</html>\n'
          : '',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Erro ao criar');
      return;
    }
    await loadFiles();
    await openFile(path);
  };

  const deleteFile = async (path: string) => {
    if (!confirm(`Apagar ${path}?`)) return;
    const res = await fetch(`/api/lab/anvil/projects/${projectId}/files`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Erro ao apagar');
      return;
    }
    if (selectedPath === path) {
      setSelectedPath(null);
      setFileContent('');
      setFileDirty(false);
    }
    await loadFiles();
  };

  const applyArtifacts = async (msg: Message) => {
    const arts = (msg.metaJson?.artifacts || [])
      .filter((a) => a.path && typeof a.content === 'string')
      .map((a) => ({ path: a.path, content: a.content as string, summary: a.summary }));
    if (arts.length === 0) {
      setError(
        t(
          'Sin content en artifacts — pide al agente que incluya content en el JSON.',
          'Sem content nos artifacts — pede ao agente que inclua content no JSON.',
          'No content in artifacts — ask the agent to include content in the JSON.',
        ),
      );
      return;
    }
    setApplyingMsgId(msg.id);
    try {
      const res = await fetch(`/api/lab/anvil/projects/${projectId}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply', artifacts: arts }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao aplicar');
        return;
      }
      if (data.errors?.length) {
        setError(data.errors.map((e: { path: string; error: string }) => `${e.path}: ${e.error}`).join('; '));
      }
      await loadFiles();
      setTab('files');
    } finally {
      setApplyingMsgId(null);
    }
  };

  const buildPreview = async () => {
    setBuildingPreview(true);
    setError('');
    try {
      const res = await fetch(`/api/lab/anvil/projects/${projectId}/preview`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro no preview');
        return;
      }
      setPreviewUrl(data.url || data.path);
      await loadProject();
    } finally {
      setBuildingPreview(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (tab === 'files' && project?.workspaceKind === 'sandbox') {
      loadFiles();
    }
  }, [tab, project?.workspaceKind, loadFiles]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Sync preview URL from deploy target config
  useEffect(() => {
    const preview = project?.deployTargets?.find((d) => d.kind === 'preview' && d.configJson?.token);
    if (preview?.configJson?.token) {
      setPreviewUrl(`/api/lab/anvil/preview/${preview.configJson.token}`);
    }
  }, [project?.deployTargets]);

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
            ['files', t('Archivos', 'Ficheiros', 'Files')],
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
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] uppercase text-amber-400/80">Artifacts</div>
                        {project.workspaceKind === 'sandbox' &&
                          m.metaJson.artifacts.some((a) => a.content) && (
                            <button
                              type="button"
                              onClick={() => applyArtifacts(m)}
                              disabled={applyingMsgId === m.id}
                              className="text-[10px] px-2 py-0.5 rounded bg-amber-600/80 text-white hover:bg-amber-500 disabled:opacity-50"
                            >
                              {applyingMsgId === m.id
                                ? '…'
                                : t('Aplicar al sandbox', 'Aplicar ao sandbox', 'Apply to sandbox')}
                            </button>
                          )}
                      </div>
                      {m.metaJson.artifacts.map((a, i) => (
                        <div key={i} className="text-xs text-slate-400">
                          <span className="font-mono text-amber-300/90">{a.path}</span> — {a.summary}
                          {a.content ? (
                            <span className="text-emerald-500/80 ml-1">(+content)</span>
                          ) : null}
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

      {tab === 'files' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-4">
          {project.workspaceKind !== 'sandbox' ? (
            <p className="text-sm text-slate-400">
              {t(
                'El sandbox de archivos es para workspaceKind=sandbox. Monorepo llega en F4 (git/PR).',
                'O sandbox de ficheiros é para workspaceKind=sandbox. Monorepo chega em F4 (git/PR).',
                'File sandbox is for workspaceKind=sandbox. Monorepo comes in F4 (git/PR).',
              )}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-amber-400" />
                  Sandbox
                </h3>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={buildPreview}
                    disabled={buildingPreview || files.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    {buildingPreview ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
                    {t('Build preview', 'Build preview', 'Build preview')}
                  </button>
                  {previewUrl && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </a>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  placeholder="path/file.ext"
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-mono"
                />
                <button
                  type="button"
                  onClick={createFile}
                  className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-3 min-h-[50vh]">
                <div className="bg-slate-800/40 rounded-xl border border-slate-800 p-2 max-h-[60vh] overflow-y-auto space-y-0.5">
                  {filesLoading && (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    </div>
                  )}
                  {!filesLoading && files.length === 0 && (
                    <p className="text-xs text-slate-500 px-2 py-4">
                      {t('Sin archivos', 'Sem ficheiros', 'No files')}
                    </p>
                  )}
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className={`flex items-center gap-1 rounded-lg group ${
                        selectedPath === f.path ? 'bg-amber-500/15' : 'hover:bg-slate-800'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => openFile(f.path)}
                        className="flex-1 text-left px-2 py-1.5 text-xs font-mono text-slate-300 truncate"
                      >
                        <FileCode2 className="w-3 h-3 inline mr-1 text-amber-400/70" />
                        {f.path}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteFile(f.path)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col bg-slate-800/30 rounded-xl border border-slate-800 min-h-[50vh]">
                  {selectedPath ? (
                    <>
                      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
                        <span className="text-xs font-mono text-amber-300">{selectedPath}</span>
                        <button
                          type="button"
                          onClick={saveFile}
                          disabled={!fileDirty || savingFile}
                          className="px-2.5 py-1 text-xs rounded-lg bg-amber-600 text-white disabled:opacity-40"
                        >
                          {savingFile ? '…' : t('Guardar', 'Guardar', 'Save')}
                        </button>
                      </div>
                      <textarea
                        value={fileContent}
                        onChange={(e) => {
                          setFileContent(e.target.value);
                          setFileDirty(true);
                        }}
                        className="flex-1 w-full p-3 bg-transparent text-sm text-slate-200 font-mono resize-none focus:outline-none min-h-[40vh]"
                        spellCheck={false}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-16">
                      {t(
                        'Selecciona o crea un archivo',
                        'Selecciona ou cria um ficheiro',
                        'Select or create a file',
                      )}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
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
              'Elige una vista previa primero; publica en producción cuando apruebes.',
              'Escolhe uma pré-visualização primeiro; publica em produção quando aprovares.',
              'Use a preview first; publish to production when you approve.',
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
                  {d.kind === 'preview' && d.configJson?.token && (
                    <a
                      href={`/api/lab/anvil/preview/${d.configJson.token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      preview URL
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {d.kind === 'preview' && project.workspaceKind === 'sandbox' && (
                    <button
                      type="button"
                      onClick={buildPreview}
                      disabled={buildingPreview}
                      className="text-xs text-amber-300 hover:text-amber-200"
                    >
                      {buildingPreview ? '…' : 'rebuild'}
                    </button>
                  )}
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
