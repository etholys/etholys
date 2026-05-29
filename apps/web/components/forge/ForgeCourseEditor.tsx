'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Gamepad2,
  FileText,
  HelpCircle,
  Video,
  Radio,
  ClipboardList,
  MessageSquare,
  Layers,
  Trash2,
  Pencil,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { ForgeAddGamePanel } from '@/components/forge/ForgeAddGamePanel';
import { forgeActivityLabel } from '@/lib/forge/activity-ui';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';

type Module = { id: string; title: string; activities: { id: string; type: string; title: string }[] };

export function ForgeCourseEditor({
  courseId,
  modules,
  onChange,
  initialFocusGame,
}: {
  courseId: string;
  modules: Module[];
  onChange: () => void;
  /** Abre painel de jogo no primeiro módulo (ex.: redirect antigo /jogos/gerar) */
  initialFocusGame?: boolean;
}) {
  const ft = useForgeT();
  const loc = useForgeLocale();
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<
    'module' | 'lesson' | 'quiz' | 'game' | 'live' | 'assignment' | 'forum' | null
  >(null);
  const [targetModuleId, setTargetModuleId] = useState('');
  const emptyForm = () => ({
    title: '',
    body: '',
    videoUrl: '',
    quizPrompt: '',
    assignmentInstructions: '',
    forumUrl: '',
  });
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (initialFocusGame && modules.length > 0) {
      setTargetModuleId(modules[0].id);
      setPanel('game');
    }
  }, [initialFocusGame, modules]);

  async function post(url: string, body: unknown) {
    setBusy(true);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || 'Erro');
      return false;
    }
    onChange();
    return true;
  }

  async function patchActivity(activityId: string, body: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch(`/api/forge/activities/${activityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || ft('forge.general.error'));
      return false;
    }
    onChange();
    return true;
  }

  async function deleteActivity(activityId: string) {
    if (!confirm(ft('forge.editor.deleteConfirm'))) return;
    setBusy(true);
    const res = await fetch(`/api/forge/activities/${activityId}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || ft('forge.general.error'));
      return;
    }
    onChange();
  }

  function renameActivity(activityId: string, currentTitle: string) {
    const next = prompt(ft('forge.editor.rename'), currentTitle);
    if (!next?.trim() || next.trim() === currentTitle) return;
    void patchActivity(activityId, { title: next.trim() });
  }

  function buildReorderPayload(list: Module[]) {
    return list.map((m, i) => ({
      id: m.id,
      sortOrder: i,
      activities: m.activities.map((a, j) => ({ id: a.id, sortOrder: j })),
    }));
  }

  async function applyReorder(list: Module[]) {
    setBusy(true);
    const res = await fetch(`/api/forge/courses/${courseId}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modules: buildReorderPayload(list) }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || ft('forge.general.error'));
      return;
    }
    onChange();
  }

  function moveModule(moduleId: string, dir: -1 | 1) {
    const idx = modules.findIndex((m) => m.id === moduleId);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= modules.length) return;
    const next = [...modules];
    [next[idx], next[j]] = [next[j], next[idx]];
    void applyReorder(next);
  }

  function moveActivity(moduleId: string, activityId: string, dir: -1 | 1) {
    const modIdx = modules.findIndex((m) => m.id === moduleId);
    if (modIdx < 0) return;
    const mod = modules[modIdx];
    const aIdx = mod.activities.findIndex((a) => a.id === activityId);
    const j = aIdx + dir;
    if (aIdx < 0 || j < 0 || j >= mod.activities.length) return;
    const next = modules.map((m, i) => {
      if (i !== modIdx) return m;
      const acts = [...m.activities];
      [acts[aIdx], acts[j]] = [acts[j], acts[aIdx]];
      return { ...m, activities: acts };
    });
    void applyReorder(next);
  }

  async function deleteModule(moduleId: string) {
    if (!confirm(ft('forge.editor.deleteModuleConfirm'))) return;
    setBusy(true);
    const res = await fetch(`/api/forge/modules/${moduleId}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || ft('forge.general.error'));
      return;
    }
    onChange();
  }

  async function submitModule() {
    if (!form.title.trim()) return;
    const ok = await post(`/api/forge/courses/${courseId}/modules`, { title: form.title.trim() });
    if (ok) {
      setPanel(null);
      setForm(emptyForm());
    }
  }

  function openPanel(
    modId: string,
    kind: 'lesson' | 'quiz' | 'game' | 'live' | 'assignment' | 'forum'
  ) {
    setTargetModuleId(modId);
    setForm(emptyForm());
    setPanel(kind);
  }

  async function submitLesson() {
    if (!targetModuleId || !form.title.trim()) return;
    const ok = await post(`/api/forge/modules/${targetModuleId}/activities`, {
      type: 'lesson',
      title: form.title.trim(),
      config: { body: form.body, videoUrl: form.videoUrl || undefined },
    });
    if (ok) {
      setPanel(null);
      setForm(emptyForm());
    }
  }

  async function submitQuiz() {
    if (!targetModuleId || !form.title.trim()) return;
    const ok = await post(`/api/forge/modules/${targetModuleId}/activities`, {
      type: 'quiz',
      title: form.title.trim(),
      config: {
        questions: [
          {
            id: 'q1',
            prompt: form.quizPrompt || 'Pergunta?',
            options: ['Opção A', 'Opção B', 'Opção C'],
            correctIndex: 1,
          },
        ],
      },
    });
    if (ok) {
      setPanel(null);
      setForm(emptyForm());
    }
  }

  async function submitLive() {
    if (!targetModuleId || !form.title.trim()) return;
    const ok = await post(`/api/forge/modules/${targetModuleId}/activities`, {
      type: 'live',
      title: form.title.trim(),
      config: { calendar: true },
    });
    if (ok) {
      setPanel(null);
      setForm(emptyForm());
    }
  }

  async function submitAssignment() {
    if (!targetModuleId || !form.title.trim()) return;
    const ok = await post(`/api/forge/modules/${targetModuleId}/activities`, {
      type: 'assignment',
      title: form.title.trim(),
      config: { instructions: form.assignmentInstructions.trim() || undefined },
    });
    if (ok) {
      setPanel(null);
      setForm(emptyForm());
    }
  }

  async function submitForum() {
    if (!targetModuleId || !form.title.trim() || !form.forumUrl.trim()) return;
    const ok = await post(`/api/forge/modules/${targetModuleId}/activities`, {
      type: 'forum',
      title: form.title.trim(),
      config: { url: form.forumUrl.trim() },
    });
    if (ok) {
      setPanel(null);
      setForm(emptyForm());
    }
  }

  const targetModule = modules.find((m) => m.id === targetModuleId);

  return (
    <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50/40 p-4 space-y-4">
      <div className="rounded-lg border border-violet-200 bg-white/90 px-3 py-2 text-xs text-slate-600">
        <p className="font-semibold text-violet-900 flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" />
          {ft('forge.editor.contentTitle')}
        </p>
        <p className="mt-1">{ft('forge.editor.contentHint')}</p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setPanel('module');
          setTargetModuleId('');
          setForm(emptyForm());
        }}
        className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" /> {ft('forge.editor.newModule')}
      </button>

      {panel === 'module' && (
        <div className="rounded-lg border bg-white p-3 space-y-2">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={ft('forge.editor.moduleName')}
            className="w-full rounded border px-2 py-1.5 text-sm"
          />
          <button type="button" onClick={submitModule} className="rounded bg-violet-600 px-3 py-1 text-xs text-white">
            {ft('forge.editor.saveModule')}
          </button>
        </div>
      )}

      {modules.length === 0 && (
        <p className="text-sm text-slate-500">{ft('forge.editor.noModules')}</p>
      )}

      {modules.map((mod, modIndex) => (
        <div key={mod.id} className="rounded-lg border border-violet-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm font-semibold text-slate-800">{mod.title}</p>
            <button
              type="button"
              disabled={busy || modIndex === 0}
              title={ft('forge.editor.moveUp')}
              onClick={() => moveModule(mod.id, -1)}
              className="rounded p-0.5 text-slate-400 hover:text-violet-700 disabled:opacity-30"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={busy || modIndex === modules.length - 1}
              title={ft('forge.editor.moveDown')}
              onClick={() => moveModule(mod.id, 1)}
              className="rounded p-0.5 text-slate-400 hover:text-violet-700 disabled:opacity-30"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={busy}
              title={ft('forge.editor.deleteModule')}
              onClick={() => deleteModule(mod.id)}
              className="rounded p-0.5 text-slate-400 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {mod.activities.length > 0 && (
            <ul className="mt-2 space-y-1">
              {mod.activities.map((a, actIndex) => (
                <li key={a.id} className="flex items-center gap-2 text-xs text-slate-600">
                  <button
                    type="button"
                    disabled={busy || actIndex === 0}
                    title={ft('forge.editor.moveUp')}
                    onClick={() => moveActivity(mod.id, a.id, -1)}
                    className="rounded p-0.5 text-slate-300 hover:text-violet-700 disabled:opacity-30"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={busy || actIndex === mod.activities.length - 1}
                    title={ft('forge.editor.moveDown')}
                    onClick={() => moveActivity(mod.id, a.id, 1)}
                    className="rounded p-0.5 text-slate-300 hover:text-violet-700 disabled:opacity-30"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <span
                    className={`rounded px-1 py-0.5 font-semibold uppercase ${
                      a.type === 'game' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100'
                    }`}
                  >
                    {forgeActivityLabel(a.type, loc)}
                  </span>
                  <span className="flex-1 truncate">{a.title}</span>
                  <button
                    type="button"
                    disabled={busy}
                    title={ft('forge.editor.rename')}
                    onClick={() => renameActivity(a.id, a.title)}
                    className="rounded p-0.5 text-slate-400 hover:text-violet-700"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    title={ft('forge.editor.deleteActivity')}
                    onClick={() => deleteActivity(a.id)}
                    className="rounded p-0.5 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-[11px] font-medium text-slate-500">{ft('forge.editor.addActivity')}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => openPanel(mod.id, 'lesson')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                panel === 'lesson' && targetModuleId === mod.id ? 'bg-violet-600 text-white' : 'bg-slate-100'
              }`}
            >
              <FileText className="h-3 w-3" /> {ft('forge.editor.lesson')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => openPanel(mod.id, 'quiz')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                panel === 'quiz' && targetModuleId === mod.id ? 'bg-violet-600 text-white' : 'bg-slate-100'
              }`}
            >
              <HelpCircle className="h-3 w-3" /> {ft('forge.editor.quiz')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (panel === 'game' && targetModuleId === mod.id) setPanel(null);
                else openPanel(mod.id, 'game');
              }}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                panel === 'game' && targetModuleId === mod.id ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-900 border border-amber-200'
              }`}
            >
              <Gamepad2 className="h-3 w-3" /> {ft('forge.editor.game')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => openPanel(mod.id, 'live')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                panel === 'live' && targetModuleId === mod.id ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-900'
              }`}
            >
              <Radio className="h-3 w-3" /> {ft('forge.editor.live')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => openPanel(mod.id, 'assignment')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                panel === 'assignment' && targetModuleId === mod.id ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-900'
              }`}
            >
              <ClipboardList className="h-3 w-3" /> {ft('forge.editor.assignment')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => openPanel(mod.id, 'forum')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] ${
                panel === 'forum' && targetModuleId === mod.id ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-900'
              }`}
            >
              <MessageSquare className="h-3 w-3" /> {ft('forge.editor.forum')}
            </button>
          </div>

          {panel === 'lesson' && targetModuleId === mod.id && (
            <div className="mt-3 space-y-2 border-t pt-3">
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={ft('forge.editor.lessonTitle')}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder={ft('forge.editor.lessonBody')}
                rows={3}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
              <input
                value={form.videoUrl}
                onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                placeholder={ft('forge.editor.lessonVideo')}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
              <button type="button" onClick={submitLesson} className="rounded bg-violet-600 px-3 py-1 text-xs text-white">
                <Video className="inline h-3 w-3 mr-1" />
                {ft('forge.editor.createLesson')}
              </button>
            </div>
          )}

          {panel === 'quiz' && targetModuleId === mod.id && (
            <div className="mt-3 space-y-2 border-t pt-3">
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={ft('forge.editor.quizTitle')}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
              <input
                value={form.quizPrompt}
                onChange={(e) => setForm((f) => ({ ...f, quizPrompt: e.target.value }))}
                placeholder={ft('forge.editor.quizQuestion')}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
              <button type="button" onClick={submitQuiz} className="rounded bg-violet-600 px-3 py-1 text-xs text-white">
                {ft('forge.editor.createQuiz')}
              </button>
            </div>
          )}

          {panel === 'live' && targetModuleId === mod.id && (
            <div className="mt-3 space-y-2 border-t pt-3">
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={ft('forge.editor.liveTitle')}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
              <p className="text-[11px] text-sky-800">{ft('forge.editor.liveHint')}</p>
              <button type="button" onClick={submitLive} className="rounded bg-sky-600 px-3 py-1 text-xs text-white">
                <Radio className="inline h-3 w-3 mr-1" />
                {ft('forge.editor.createLive')}
              </button>
            </div>
          )}

          {panel === 'assignment' && targetModuleId === mod.id && (
            <div className="mt-3 space-y-2 border-t pt-3">
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={ft('forge.editor.assignmentTitle')}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
              <textarea
                value={form.assignmentInstructions}
                onChange={(e) => setForm((f) => ({ ...f, assignmentInstructions: e.target.value }))}
                placeholder={ft('forge.editor.assignmentInstructions')}
                rows={3}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={submitAssignment}
                className="rounded bg-emerald-600 px-3 py-1 text-xs text-white"
              >
                <ClipboardList className="inline h-3 w-3 mr-1" />
                {ft('forge.editor.createAssignment')}
              </button>
            </div>
          )}

          {panel === 'forum' && targetModuleId === mod.id && (
            <div className="mt-3 space-y-2 border-t pt-3">
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={ft('forge.editor.forumTitle')}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
              <input
                value={form.forumUrl}
                onChange={(e) => setForm((f) => ({ ...f, forumUrl: e.target.value }))}
                placeholder={ft('forge.editor.forumUrl')}
                className="w-full rounded border px-2 py-1.5 text-sm"
              />
              <button type="button" onClick={submitForum} className="rounded bg-indigo-600 px-3 py-1 text-xs text-white">
                <MessageSquare className="inline h-3 w-3 mr-1" />
                {ft('forge.editor.createForum')}
              </button>
            </div>
          )}

          {panel === 'game' && targetModuleId === mod.id && (
            <ForgeAddGamePanel
              courseId={courseId}
              moduleId={mod.id}
              moduleTitle={mod.title}
              onAdded={() => {
                onChange();
                setPanel(null);
              }}
            />
          )}
        </div>
      ))}

      {panel === 'game' && !targetModule && modules.length > 0 && (
        <p className="text-xs text-amber-800">{ft('forge.editor.pickModule')}</p>
      )}
    </div>
  );
}
