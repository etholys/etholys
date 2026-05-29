'use client';

import { useState } from 'react';
import { Sparkles, Gamepad2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';

const TEMPLATE_IDS = [
  'design-thinking-board',
  'okr-quiz',
  'negotiation-cards',
  'leadership-branching',
] as const;

/**
 * Cria uma atividade tipo `game` dentro de um curso/módulo.
 */
export function ForgeAddGamePanel({
  courseId,
  moduleId,
  moduleTitle,
  onAdded,
}: {
  courseId: string;
  moduleId?: string;
  moduleTitle?: string;
  onAdded: () => void;
}) {
  const ft = useForgeT();
  const locale = useForgeLocale();
  const { activeCompanyId } = useApp();
  const [expanded, setExpanded] = useState(true);
  const [methodology, setMethodology] = useState('');
  const [objectives, setObjectives] = useState('');
  const [engine, setEngine] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function applyTemplate(templateId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/forge/games/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: activeCompanyId,
          templateId,
          courseId,
          moduleId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || ft('forge.general.error'));
      onAdded();
      setExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : ft('forge.general.error'));
    } finally {
      setLoading(false);
    }
  }

  async function generateWithAi() {
    if (!methodology.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const gen = await fetch('/api/forge/games/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: activeCompanyId,
          methodology: methodology.trim(),
          objectives: objectives.split('\n').map((s) => s.trim()).filter(Boolean),
          engine,
          locale: locale === 'en' ? 'en' : locale === 'pt' ? 'pt' : 'es',
          publish: true,
        }),
      });
      const genData = await gen.json();
      if (!gen.ok) throw new Error(genData.error || ft('forge.general.error'));

      const attach = await fetch(`/api/forge/courses/${courseId}/attach-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameSpecId: genData.gameSpec.id,
          title: genData.gameSpec.title,
          moduleId,
        }),
      });
      const attachData = await attach.json();
      if (!attach.ok) throw new Error(attachData.error || ft('forge.general.error'));

      onAdded();
      setMethodology('');
      setObjectives('');
      setExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : ft('forge.general.error'));
    } finally {
      setLoading(false);
    }
  }

  const hintModule = moduleTitle
    ? ft('forge.game.newHintModule', { name: moduleTitle })
    : '';

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-100 px-3 py-2 text-xs font-semibold text-violet-900"
      >
        <Gamepad2 className="h-3.5 w-3.5" />
        {ft('forge.game.addCollapsed')}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-violet-300 bg-gradient-to-br from-violet-50 to-indigo-50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1 text-xs font-bold uppercase text-violet-800">
            <Gamepad2 className="h-3.5 w-3.5" />
            {ft('forge.game.newTitle')}
          </p>
          <p className="mt-0.5 text-[11px] text-violet-700/90">
            {ft('forge.game.newHint', { module: hintModule })}
          </p>
        </div>
        <button type="button" onClick={() => setExpanded(false)} className="text-xs text-slate-500 hover:text-slate-800">
          {ft('forge.game.close')}
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-slate-600">{ft('forge.game.templates')}</p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              disabled={loading}
              onClick={() => applyTemplate(id)}
              className="rounded-md border border-white bg-white px-2 py-1 text-[11px] font-medium text-violet-800 shadow-sm hover:bg-violet-50 disabled:opacity-50"
            >
              {ft(`forge.game.template.${id}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-violet-200/80 pt-3">
        <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-slate-600">
          <Sparkles className="h-3 w-3 text-violet-600" />
          {ft('forge.game.aiTitle')}
        </p>
        <textarea
          value={methodology}
          onChange={(e) => setMethodology(e.target.value)}
          rows={2}
          placeholder={ft('forge.game.methodology')}
          className="w-full rounded border px-2 py-1.5 text-sm"
        />
        <textarea
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          rows={1}
          placeholder={ft('forge.game.objectives')}
          className="mt-1.5 w-full rounded border px-2 py-1.5 text-sm"
        />
        <select
          value={engine}
          onChange={(e) => setEngine(e.target.value)}
          className="mt-1.5 w-full rounded border px-2 py-1 text-sm"
        >
          <option value="auto">{ft('forge.game.engine.auto')}</option>
          <option value="board">{ft('forge.game.engine.board')}</option>
          <option value="quiz_race">{ft('forge.game.engine.quiz_race')}</option>
          <option value="cards">{ft('forge.game.engine.cards')}</option>
          <option value="branching">{ft('forge.game.engine.branching')}</option>
        </select>
        <button
          type="button"
          disabled={loading || !methodology.trim()}
          onClick={generateWithAi}
          className="mt-2 w-full rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {loading ? ft('forge.game.generating') : ft('forge.game.generate')}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
