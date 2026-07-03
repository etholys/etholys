'use client';

import { useMemo, useState } from 'react';
import {
  flattenObjectives,
  listValidParents,
  formatParentOption,
  describeReparentError,
  type ObjectiveNode,
} from '@/lib/siep/objective-hierarchy';
import { buildMeChainRows } from '@/lib/siep/hierarchy-matrix';
import { SectionReimportBar } from '@/components/siep/SectionReimportBar';
import {
  ChevronDown,
  ChevronUp,
  Link2,
  AlertTriangle,
  Sparkles,
  Loader2,
  LayoutGrid,
  Columns3,
} from 'lucide-react';

const COLUMNS = [
  { key: 'goal', label: 'Meta', types: ['goal', 'impact'] },
  { key: 'outcome', label: 'Resultado (R)', types: ['outcome'] },
  { key: 'objective', label: 'Obj. Específico (OE)', types: ['objective'] },
  { key: 'output', label: 'Producto (OP)', types: ['output', 'deliverable'] },
  { key: 'activity', label: 'Actividad (A)', types: ['activity'] },
  { key: 'indicator', label: 'Indicador', types: ['indicator'] },
] as const;

interface Props {
  projectId: string;
  objectives: ObjectiveNode[];
  onReparent: (childId: string, newParentId: string | null) => Promise<void>;
  onRefresh: () => void;
  /** Dentro de sub-aba do Marco Lógico — sem cartão colapsável próprio */
  embedded?: boolean;
  /** 'table' = matriz/navegador; 'tools' = IA + re-import; omitido = tudo */
  panel?: 'table' | 'tools';
}

export default function HierarchyLinkPanel({
  projectId,
  objectives,
  onReparent,
  onRefresh,
  embedded = false,
  panel,
}: Props) {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<'matrix' | 'columns'>('matrix');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const [selOutcome, setSelOutcome] = useState<string>('');
  const [selObjective, setSelObjective] = useState<string>('');
  const [selOutput, setSelOutput] = useState<string>('');
  const [selActivity, setSelActivity] = useState<string>('');

  const flat = useMemo(() => flattenObjectives(objectives), [objectives]);
  const byId = useMemo(() => new Map(flat.map((n) => [n.id, n])), [flat]);
  const chainRows = useMemo(() => buildMeChainRows(objectives), [objectives]);

  const brokenCount = useMemo(() => {
    return flat.filter((n) => {
      if (!['outcome', 'objective', 'output', 'activity', 'indicator'].includes(n.type)) return false;
      const parent = n.parentId ? byId.get(n.parentId) : null;
      if (!parent && n.type !== 'outcome') return true;
      return parent ? Boolean(describeReparentError(n, parent, flat)) : false;
    }).length;
  }, [flat, byId]);

  const handleParentChange = async (child: ObjectiveNode, newParentId: string) => {
    setError(null);
    const parent = newParentId ? byId.get(newParentId) : null;
    const err = newParentId ? describeReparentError(child, parent, flat) : null;
    if (err) {
      setError(err);
      return;
    }
    if (child.parentId === newParentId) return;
    setSavingId(child.id);
    try {
      await onReparent(child.id, newParentId || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao actualizar vínculo');
    } finally {
      setSavingId(null);
    }
  };

  const runAiReorganize = async () => {
    if (!confirm('A IA vai reanalizar os vínculos OE → R → OP → A com base nos códigos e títulos actuais. Continuar?')) {
      return;
    }
    setAiLoading(true);
    setAiResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/reorganize-objectives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: aiInstructions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erro na reorganização');
      const msg = [
        data.summary,
        `${data.applied ?? 0} vínculo(s) corrigido(s).`,
        data.errors?.length ? `Avisos: ${data.errors.slice(0, 3).join('; ')}` : null,
      ]
        .filter(Boolean)
        .join(' ');
      setAiResult(msg);
      if ((data.applied ?? 0) > 0) onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao reorganizar com IA');
    } finally {
      setAiLoading(false);
    }
  };

  const columnLists = useMemo(() => {
    const allOutcomes = flat.filter((n) => n.type === 'outcome');

    const objectives = flat.filter((n) => {
      if (n.type !== 'objective') return false;
      if (selOutcome) return n.parentId === selOutcome;
      return true;
    });

    const outputs = flat.filter((n) => {
      if (n.type !== 'output' && n.type !== 'deliverable') return false;
      if (selObjective) return n.parentId === selObjective;
      return true;
    });

    const activities = flat.filter((n) => {
      if (n.type !== 'activity') return false;
      if (selOutput) return n.parentId === selOutput;
      return true;
    });

    const indicators = flat.filter((n) => {
      if (n.type !== 'indicator') return false;
      if (selActivity) return n.parentId === selActivity;
      return true;
    });

    return { allOutcomes, objectives, outputs, activities, indicators };
  }, [flat, selOutcome, selObjective, selOutput, selActivity]);

  const selectedNode = selActivity
    ? byId.get(selActivity)
    : selOutput
      ? byId.get(selOutput)
      : selObjective
        ? byId.get(selObjective)
        : selOutcome
          ? byId.get(selOutcome)
          : null;

  const renderParentSelect = (node: ObjectiveNode | null | undefined) => {
    if (!node) return null;
    const parent = node.parentId ? byId.get(node.parentId) : null;
    const invalid = parent ? describeReparentError(node, parent, flat) : null;
    const options = listValidParents(node, flat);
    if (parent && !options.some((p) => p.id === parent.id)) options.unshift(parent);

    return (
      <select
        value={node.parentId || ''}
        disabled={savingId === node.id}
        onChange={(e) => handleParentChange(node, e.target.value)}
        className={`mt-1 w-full rounded border px-1.5 py-1 text-[10px] ${
          invalid ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'
        }`}
        title="Alterar pai deste elemento"
      >
        <option value="">— Sem pai —</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {formatParentOption(p)}
          </option>
        ))}
      </select>
    );
  };

  const renderMatrixCell = (node: ObjectiveNode | null | undefined) => {
    if (!node) {
      return <span className="text-gray-300">—</span>;
    }
    const parent = node.parentId ? byId.get(node.parentId) : null;
    const invalid = parent ? describeReparentError(node, parent, flat) : false;
    return (
      <div className={invalid ? 'rounded-md bg-amber-50/80 p-1.5' : ''}>
        <p className="font-mono text-[10px] text-indigo-700">{node.code || '·'}</p>
        <p className="text-[11px] text-gray-800 leading-tight" title={node.title || ''}>
          {(node.title || '').length > 36 ? `${(node.title || '').slice(0, 36)}…` : node.title || '—'}
        </p>
        {renderParentSelect(node)}
      </div>
    );
  };

  if (flat.length === 0) return null;

  const showTable = !panel || panel === 'table';
  const showTools = !panel || panel === 'tools';

  const inner = (
    <div className={`space-y-4 ${embedded ? '' : 'px-5 pb-5 border-t border-gray-100'}`}>
      {showTable && brokenCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {brokenCount} vínculo(s) inconsistente(s). Corrija na matriz ou use a sub-aba «Corrigir / IA».
          </span>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
      )}
      {showTools && aiResult && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {aiResult}
        </div>
      )}

      {showTools && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 space-y-2">
              <p className="text-sm font-medium text-violet-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Reorganizar vínculos com IA
              </p>
              <p className="text-xs text-violet-800/80">
                Envia a estrutura actual (códigos, títulos, pais) para a IA reacomodar OE → R → OP → A sem apagar textos.
              </p>
              <textarea
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
                rows={3}
                placeholder="Opcional: ex. «OE1 e P1.1 pertencem ao Resultado R1, não ao R2»"
                className="w-full text-xs rounded-lg border border-violet-200 px-2 py-1.5 bg-white"
              />
              <button
                type="button"
                disabled={aiLoading}
                onClick={runAiReorganize}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiLoading ? 'A reorganizar…' : 'Reacomodar com IA'}
              </button>
            </div>

            <SectionReimportBar
              section="objectives"
              mode="project"
              projectId={projectId}
              context={{ objectives: objectives?.slice(0, 3) }}
              onApplied={() => onRefresh()}
              onError={(msg) => setError(msg)}
              className="border-amber-100 bg-amber-50/40"
            />
          </div>
          <p className="text-[10px] text-gray-500">
            Re-importar substitui todo o marco lógico a partir do ficheiro — ideal se a estrutura saiu completamente errada.
          </p>
        </>
      )}

      {showTable && (
        <>
          <p className="text-xs text-gray-500">
            {chainRows.length} linha(s) na matriz · {flat.length} nós. Uma coluna por tipo (OE · R · OP · A).
          </p>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
            <button
              type="button"
              onClick={() => setView('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                view === 'matrix' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Matriz
            </button>
            <button
              type="button"
              onClick={() => setView('columns')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                view === 'columns' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              Navegador
            </button>
          </div>

          {view === 'matrix' ? (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-indigo-600 text-white">
                    {COLUMNS.map((c) => (
                      <th key={c.key} className="text-left px-3 py-2.5 font-semibold whitespace-nowrap min-w-[140px]">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {chainRows.map((row) => (
                    <tr key={row.rowKey} className="hover:bg-slate-50/80 align-top">
                      {COLUMNS.map((c) => (
                        <td key={c.key} className="px-3 py-2 border-r border-gray-50 last:border-r-0">
                          {renderMatrixCell(row[c.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {[
                  {
                    title: 'Resultado (R)',
                    items: columnLists.allOutcomes,
                    selected: selOutcome,
                    onSelect: (id: string) => {
                      setSelOutcome(id);
                      setSelObjective('');
                      setSelOutput('');
                      setSelActivity('');
                    },
                  },
                  {
                    title: 'Obj. Específico (OE)',
                    items: columnLists.objectives,
                    selected: selObjective,
                    onSelect: (id: string) => {
                      setSelObjective(id);
                      setSelOutput('');
                      setSelActivity('');
                    },
                    disabled: !selOutcome,
                  },
                  {
                    title: 'Producto (OP)',
                    items: columnLists.outputs,
                    selected: selOutput,
                    onSelect: (id: string) => {
                      setSelOutput(id);
                      setSelActivity('');
                    },
                    disabled: !selObjective,
                  },
                  {
                    title: 'Actividad (A)',
                    items: columnLists.activities,
                    selected: selActivity,
                    onSelect: setSelActivity,
                    disabled: !selOutput,
                  },
                  {
                    title: 'Indicador',
                    items: columnLists.indicators,
                    selected: '',
                    onSelect: () => {},
                    disabled: !selActivity,
                  },
                ].map((col) => (
                  <div
                    key={col.title}
                    className={`flex-shrink-0 w-52 rounded-lg border ${
                      col.disabled ? 'opacity-50 border-gray-100' : 'border-gray-200'
                    } bg-white overflow-hidden`}
                  >
                    <div className="px-2 py-2 bg-gray-50 border-b text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                      {col.title}
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                      {col.items.length === 0 ? (
                        <p className="px-2 py-3 text-[10px] text-gray-400">—</p>
                      ) : (
                        col.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            disabled={col.disabled}
                            onClick={() => col.onSelect(item.id)}
                            className={`w-full text-left px-2 py-2 hover:bg-indigo-50 transition ${
                              col.selected === item.id ? 'bg-indigo-100 border-l-2 border-indigo-600' : ''
                            }`}
                          >
                            <span className="font-mono text-[10px] text-indigo-700">{item.code || '·'}</span>
                            <p className="text-[11px] text-gray-800 leading-tight truncate" title={item.title || ''}>
                              {item.title || '—'}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {selectedNode && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-4 py-3">
                  <p className="text-xs font-medium text-indigo-900">
                    Mover «{selectedNode.code || selectedNode.title}» para outro pai:
                  </p>
                  <div className="mt-2 max-w-md">{renderParentSelect(selectedNode)}</div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );

  if (embedded) return inner;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition text-left"
      >
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-indigo-600" />
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Hierarquia M&amp;E — OE · R · OP · A</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Uma coluna por tipo, alinhada ao quadro de monitorização. {chainRows.length} linha(s) · {flat.length} nós.
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && inner}
    </div>
  );
}
