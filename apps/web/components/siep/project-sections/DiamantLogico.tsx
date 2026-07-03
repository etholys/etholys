'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Plus, Trash2, ZoomIn, ZoomOut, Maximize2, Minimize2, Info, Link2, X } from 'lucide-react';
import {
  flattenObjectives,
  describeReparentError,
  type ObjectiveNode,
} from '@/lib/siep/objective-hierarchy';

/* ================================================================
   Types & Constants
   ================================================================ */
interface DNode {
  id: string;
  type: string;
  title: string;
  code?: string;
  description?: string;
  parentId?: string | null;
  children?: DNode[];
}

interface LayoutNode {
  id: string;
  type: string;
  title: string;
  code?: string;
  description?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  layer: number;
}

interface Edge {
  from: string;
  to: string;
  dashed?: boolean;
}

const LAYER_ORDER: Record<string, number> = {
  goal: 0, impact: 0,
  outcome: 1,
  objective: 2,
  output: 3, deliverable: 3,
  activity: 4,
  input: 5,
  need: 6,
  problem_statement: 7,
};

const LAYER_LABELS: Record<number, string> = {
  0: 'Meta / Impacto',
  1: 'Resultados',
  2: 'Obj. Espec\u00edficos',
  3: 'Productos',
  4: 'Actividades',
  5: 'Insumos',
  6: 'Necesidades',
  7: 'Problema',
};

const TYPE_ABBR: Record<string, string> = {
  problem_statement: 'PS', need: 'N', input: 'I',
  activity: 'A', output: 'OP', deliverable: 'ENT',
  objective: 'OE', outcome: 'R', goal: 'PG', impact: 'IMP',
  assumption: 'SUP', external_factor: 'FE',
};

const TYPE_COLORS: Record<string, string> = {
  problem_statement: '#dc2626', need: '#475569', input: '#3b82f6',
  activity: '#6366f1', output: '#7c3aed', deliverable: '#059669',
  objective: '#4f46e5', outcome: '#2563eb', goal: '#1d4ed8',
  impact: '#1e40af', assumption: '#8b5cf6', external_factor: '#a78bfa',
};

const TYPE_LABELS: Record<string, string> = {
  problem_statement: 'Problema', need: 'Necesidad', input: 'Insumo',
  activity: 'Actividad', output: 'Producto', deliverable: 'Entregable',
  objective: 'Obj. Espec\u00edfico', outcome: 'Resultado', goal: 'Meta',
  impact: 'Impacto', assumption: 'Supuesto', external_factor: 'Factor Externo',
};

const NODE_W = 200;
const NODE_H = 56;
const LAYER_GAP_Y = 110;
const NODE_GAP_X = 30;
const TOP_PAD = 50;
const LEFT_PAD = 130;

function getColor(type: string) { return TYPE_COLORS[type] || '#6b7280'; }
function getAbbr(type: string) { return TYPE_ABBR[type] || type.substring(0, 3).toUpperCase(); }
function getLabel(type: string) { return TYPE_LABELS[type] || type; }

/* ================================================================
   Layout engine
   ================================================================ */
function buildLayeredChart(objectives: DNode[]): { nodes: LayoutNode[]; edges: Edge[]; width: number; height: number; usedLayers: number[] } {
  const flat: LayoutNode[] = [];
  const edges: Edge[] = [];
  const contextTypes = new Set(['assumption', 'external_factor']);

  function walk(ns: DNode[], parentId: string | null) {
    for (const n of ns) {
      if (n.type === 'indicator') continue;
      if (contextTypes.has(n.type)) continue;
      flat.push({
        id: n.id, type: n.type, title: n.title, code: n.code,
        description: n.description, x: 0, y: 0, w: NODE_W, h: NODE_H,
        layer: LAYER_ORDER[n.type] ?? 4,
      });
      if (parentId) edges.push({ from: parentId, to: n.id });
      if (n.children) walk(n.children, n.id);
    }
  }
  walk(objectives, null);

  if (flat.length === 0) return { nodes: [], edges: [], width: 400, height: 200, usedLayers: [] };

  // Group by layer
  const byLayer = new Map<number, LayoutNode[]>();
  flat.forEach(n => {
    if (!byLayer.has(n.layer)) byLayer.set(n.layer, []);
    byLayer.get(n.layer)!.push(n);
  });

  const usedLayers = [...byLayer.keys()].sort((a, b) => a - b);

  let maxWidth = 0;
  usedLayers.forEach((layer) => {
    const nodes = byLayer.get(layer)!;
    const rowWidth = nodes.length * NODE_W + (nodes.length - 1) * NODE_GAP_X;
    maxWidth = Math.max(maxWidth, rowWidth);
  });

  usedLayers.forEach((layer, rowIndex) => {
    const nodes = byLayer.get(layer)!;
    const rowWidth = nodes.length * NODE_W + (nodes.length - 1) * NODE_GAP_X;
    const startX = LEFT_PAD + (maxWidth - rowWidth) / 2;
    const y = TOP_PAD + rowIndex * (NODE_H + LAYER_GAP_Y);
    nodes.forEach((n, i) => {
      n.x = startX + i * (NODE_W + NODE_GAP_X);
      n.y = y;
    });
  });

  // Add edges: needs -> problem_statements (visual closure)
  const needNodes = flat.filter(n => n.type === 'need');
  const psNodes = flat.filter(n => n.type === 'problem_statement');
  if (needNodes.length > 0 && psNodes.length > 0) {
    for (const need of needNodes) {
      for (const ps of psNodes) {
        // Only add if not already connected via tree
        const exists = edges.some(e => e.from === need.id && e.to === ps.id);
        if (!exists) {
          edges.push({ from: need.id, to: ps.id, dashed: false });
        }
      }
    }
  }

  const totalW = maxWidth + LEFT_PAD * 2;
  const totalH = TOP_PAD + usedLayers.length * (NODE_H + LAYER_GAP_Y);

  return { nodes: flat, edges, width: totalW, height: totalH, usedLayers };
}

/* ================================================================
   Bezier connector
   ================================================================ */
function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dy = y2 - y1;
  const cy = Math.abs(dy) * 0.4;
  if (dy > 0) return `M${x1},${y1} C${x1},${y1 + cy} ${x2},${y2 - cy} ${x2},${y2}`;
  return `M${x1},${y1} C${x1},${y1 - cy} ${x2},${y2 + cy} ${x2},${y2}`;
}

/* ================================================================
   Portal tooltip
   ================================================================ */
function TooltipPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return ReactDOM.createPortal(children as any, document.body) as any;
}

/* ================================================================
   Main component
   ================================================================ */
export default function DiamantLogico({
  objectives, onDelete, onCreate, onInlineSave, onReparent,
}: {
  objectives: DNode[];
  onDelete: (id: string) => void;
  onCreate: (parentId: string | null, type: string, lane?: string) => void;
  onInlineSave: (id: string, data: any) => Promise<void>;
  onReparent?: (childId: string, newParentId: string | null) => Promise<void>;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [linkSaving, setLinkSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Pan state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const { nodes, edges, width, height, usedLayers } = useMemo(() => buildLayeredChart(objectives), [objectives]);

  const contextItems = useMemo(() => {
    const items: DNode[] = [];
    function cwalk(ns: DNode[]) {
      for (const n of ns) {
        if (n.type === 'assumption' || n.type === 'external_factor') items.push(n);
        if (n.children?.length) cwalk(n.children);
      }
    }
    cwalk(objectives);
    return items;
  }, [objectives]);

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const flatTree = useMemo(
    () => flattenObjectives(objectives as ObjectiveNode[]),
    [objectives],
  );
  const flatById = useMemo(() => new Map(flatTree.map((n) => [n.id, n])), [flatTree]);

  const findNodeAtScreen = useCallback(
    (clientX: number, clientY: number): string | null => {
      if (!svgRef.current) return null;
      const pt = svgRef.current.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const ctm = svgRef.current.getScreenCTM();
      if (!ctm) return null;
      const svgPt = pt.matrixTransform(ctm.inverse());
      for (const n of nodes) {
        if (svgPt.x >= n.x && svgPt.x <= n.x + n.w && svgPt.y >= n.y && svgPt.y <= n.y + n.h) {
          return n.id;
        }
      }
      return null;
    },
    [nodes],
  );

  const attemptReparent = useCallback(
    async (childId: string, parentId: string) => {
      if (!onReparent) return;
      const child = flatById.get(childId);
      const parent = flatById.get(parentId);
      if (!child || !parent) return;
      const err = describeReparentError(child, parent, flatTree);
      if (err) {
        setLinkMessage(err);
        return;
      }
      setLinkSaving(true);
      setLinkMessage(null);
      try {
        await onReparent(childId, parentId);
        setLinkSourceId(null);
        setLinkMessage('Vínculo actualizado — o M&E reflecte a nova hierarquia.');
      } catch (e: unknown) {
        setLinkMessage(e instanceof Error ? e.message : 'Erro ao vincular');
      } finally {
        setLinkSaving(false);
      }
    },
    [flatById, flatTree, onReparent],
  );

  const handleLinkNodeClick = useCallback(
    (nodeId: string) => {
      if (!linkMode || linkSaving || !onReparent) return;
      const node = flatById.get(nodeId);
      if (!node) return;

      if (!linkSourceId) {
        setLinkSourceId(nodeId);
        setLinkMessage(`Seleccionado: ${node.code || node.title}. Clique ou solte sobre o novo pai.`);
        return;
      }

      if (linkSourceId === nodeId) {
        setLinkSourceId(null);
        setLinkMessage(null);
        return;
      }

      void attemptReparent(linkSourceId, nodeId);
    },
    [attemptReparent, flatById, linkMode, linkSaving, linkSourceId, onReparent],
  );

  const handleNodeDragStart = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      if (!linkMode || linkSaving || !onReparent) return;
      e.stopPropagation();
      e.preventDefault();
      setDraggingId(nodeId);
      setLinkSourceId(nodeId);
      const node = flatById.get(nodeId);
      setLinkMessage(`A arrastar: ${node?.code || node?.title}. Solte sobre o novo pai.`);
    },
    [flatById, linkMode, linkSaving, onReparent],
  );

  const handleDragMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingId) return;
      const targetId = findNodeAtScreen(e.clientX, e.clientY);
      if (targetId && targetId !== draggingId) {
        const child = flatById.get(draggingId);
        const parent = flatById.get(targetId);
        if (child && parent && !describeReparentError(child, parent, flatTree)) {
          setDropTargetId(targetId);
          return;
        }
      }
      setDropTargetId(null);
    },
    [draggingId, findNodeAtScreen, flatById, flatTree],
  );

  const handleDragEnd = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingId) return;
      const targetId = dropTargetId || findNodeAtScreen(e.clientX, e.clientY);
      if (targetId && targetId !== draggingId) {
        void attemptReparent(draggingId, targetId);
      }
      setDraggingId(null);
      setDropTargetId(null);
    },
    [attemptReparent, draggingId, dropTargetId, findNodeAtScreen],
  );

  useEffect(() => {
    if (!linkMode) {
      setLinkSourceId(null);
      setLinkMessage(null);
      setDraggingId(null);
      setDropTargetId(null);
    }
  }, [linkMode]);

  const isValidDropTarget = useCallback(
    (nodeId: string) => {
      if (!linkSourceId || linkSourceId === nodeId) return false;
      const child = flatById.get(linkSourceId);
      const parent = flatById.get(nodeId);
      if (!child || !parent) return false;
      return !describeReparentError(child, parent, flatTree);
    },
    [flatById, flatTree, linkSourceId],
  );

  const highlighted = useMemo(() => {
    if (!hoveredId) return null;
    const set = new Set<string>();
    set.add(hoveredId);
    const parentOf = new Map<string, string>();
    edges.forEach(e => parentOf.set(e.to, e.from));
    let cur: string | undefined = hoveredId;
    while (cur && parentOf.has(cur)) { cur = parentOf.get(cur)!; set.add(cur); }
    const childrenOf = new Map<string, string[]>();
    edges.forEach(e => { if (!childrenOf.has(e.from)) childrenOf.set(e.from, []); childrenOf.get(e.from)!.push(e.to); });
    function walkDown(id: string) { (childrenOf.get(id) || []).forEach(k => { set.add(k); walkDown(k); }); }
    walkDown(hoveredId);
    return set;
  }, [hoveredId, edges]);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.15, 2.5));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.15, 0.2));

  const handleFit = useCallback(() => {
    if (!containerRef.current || width === 0) return;
    const cw = containerRef.current.clientWidth - 16;
    const ch = containerRef.current.clientHeight - 16;
    const fitZoom = Math.min(cw / width, ch / height, 1.2);
    setZoom(Math.max(fitZoom, 0.2));
    setPan({ x: 0, y: 0 });
  }, [width, height]);

  useEffect(() => { handleFit(); }, [handleFit]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom(z => Math.min(Math.max(z + delta, 0.2), 2.5));
  }, []);

  // Mouse pan (disabled in link mode)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (linkMode || draggingId) return;
    if (e.button !== 0) return;
    const target = e.target as SVGElement;
    if (target.closest?.('[data-action]') || target.closest?.('[data-node]')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [draggingId, linkMode, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingId) {
      handleDragMove(e);
      return;
    }
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, [draggingId, handleDragMove, isPanning]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (draggingId) handleDragEnd(e);
    setIsPanning(false);
  }, [draggingId, handleDragEnd]);

  const CHILD_MAP: Record<string, string> = {
    goal: 'outcome', impact: 'outcome', outcome: 'objective',
    objective: 'output', output: 'activity', activity: 'input',
    input: 'need', deliverable: 'activity', need: 'problem_statement',
    problem_statement: 'need',
  };

  const handleEditSave = async () => {
    if (editId) { await onInlineSave(editId, { title: editTitle }); setEditId(null); }
  };

  const handleNodeHover = (nodeId: string) => {
    if (isPanning) return;
    setHoveredId(nodeId);
    const node = nodeMap.get(nodeId);
    if (!node || !svgRef.current || !containerRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    const scaleX = svgRect.width / (width || 1);
    const scaleY = svgRect.height / (height || 1);
    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;
    const screenX = containerRect.left + (node.x + node.w / 2) * scaleX - scrollLeft + pan.x;
    const screenY = containerRect.top + (node.y + node.h) * scaleY - scrollTop + pan.y;
    setTooltipPos({ x: screenX, y: screenY });
  };

  if (nodes.length === 0 && contextItems.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-400 mb-2">No hay elementos para visualizar en el Diamante L&oacute;gico.</p>
        <p className="text-xs text-gray-400">Importe un proyecto o agregue elementos manualmente.</p>
      </div>
    );
  }

  const hoveredNode = hoveredId ? nodeMap.get(hoveredId) : null;

  const canvasContent = (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Zoom: {Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={handleZoomOut} className="p-1 rounded hover:bg-gray-100 text-gray-500"><ZoomOut className="w-4 h-4" /></button>
          <button onClick={handleFit} className="p-1 rounded hover:bg-gray-100 text-gray-500" title="Ajustar"><Maximize2 className="w-4 h-4" /></button>
          <button onClick={() => { setIsFullscreen(!isFullscreen); setTimeout(() => handleFit(), 100); }}
            className="p-1 rounded hover:bg-gray-100 text-gray-500" title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {onReparent && (
            <button
              type="button"
              onClick={() => setLinkMode((v) => !v)}
              className={`ml-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                linkMode
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              {linkMode ? 'Modo vincular activo' : 'Vincular / reorganizar'}
            </button>
          )}
        </div>
        {!isFullscreen && (
          <button onClick={() => onCreate(null, 'problem_statement')} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">
            <Plus className="w-4 h-4" />Agregar
          </button>
        )}
      </div>

      {linkMode && (
        <div className="mb-3 flex items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <div>
            <p className="font-medium">Modo vincular</p>
            <p className="mt-0.5 text-amber-900/90">
              Clique num elemento (filho), depois clique no novo pai — ou arraste o nó até ao pai correcto.
              As colunas OE / R / OP / A do M&amp;E actualizam-se automaticamente.
            </p>
            {linkMessage && <p className="mt-1 text-amber-800">{linkMessage}</p>}
          </div>
          <button
            type="button"
            onClick={() => { setLinkMode(false); setLinkSourceId(null); setLinkMessage(null); }}
            className="p-1 rounded hover:bg-amber-100 text-amber-700"
            title="Sair do modo vincular"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex gap-3" style={{ height: isFullscreen ? 'calc(100vh - 80px)' : undefined }}>
        {/* SVG Canvas — pannable + zoomable */}
        <div
          ref={containerRef}
          className={`flex-1 overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-b from-slate-50 to-white ${
            linkMode ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ maxHeight: isFullscreen ? 'calc(100vh - 80px)' : '75vh' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            ref={svgRef}
            width={width * zoom}
            height={height * zoom}
            viewBox={`0 0 ${width} ${height}`}
            className="select-none"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
          >
            <defs>
              <filter id="cardShadow" x="-8%" y="-8%" width="116%" height="125%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.08" />
              </filter>
            </defs>

            {/* Layer labels */}
            {usedLayers.map((layer, rowIndex) => {
              const y = TOP_PAD + rowIndex * (NODE_H + LAYER_GAP_Y);
              const label = LAYER_LABELS[layer] || '';
              return label ? (
                <text key={`ll-${layer}`} x={8} y={y + NODE_H / 2 + 4} fontSize="10" fill="#94a3b8" fontWeight="600" textAnchor="start" opacity={0.7} fontStyle="italic">
                  {label}
                </text>
              ) : null;
            })}

            {/* Edges */}
            {edges.map((e, idx) => {
              const from = nodeMap.get(e.from);
              const to = nodeMap.get(e.to);
              if (!from || !to) return null;
              const x1 = from.x + from.w / 2;
              const y1 = from.y + from.h;
              const x2 = to.x + to.w / 2;
              const y2 = to.y;
              const isHl = highlighted?.has(e.from) && highlighted?.has(e.to);
              const isDim = highlighted && !isHl;
              return (
                <path
                  key={`e-${e.from}-${e.to}-${idx}`}
                  d={bezierPath(x1, y1, x2, y2)}
                  fill="none"
                  stroke={isHl ? '#4f46e5' : (e.dashed ? '#94a3b8' : '#94a3b8')}
                  strokeWidth={isHl ? 2.5 : 1.2}
                  strokeDasharray={e.dashed ? '4,4' : undefined}
                  opacity={isDim ? 0.08 : 0.6}
                  className="transition-all duration-200"
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(n => {
              const color = getColor(n.type);
              const isHovered = hoveredId === n.id;
              const isHl = highlighted?.has(n.id);
              const isDim = highlighted && !isHl;
              const isEditing = editId === n.id;
              const displayCode = n.code || getAbbr(n.type);
              const isLinkSource = linkSourceId === n.id;
              const isDropTarget = dropTargetId === n.id || (linkMode && linkSourceId && isValidDropTarget(n.id) && hoveredId === n.id);
              const nodeStroke = isLinkSource
                ? '#f59e0b'
                : isDropTarget
                  ? '#10b981'
                  : isHovered
                    ? '#ffffff'
                    : 'transparent';
              const nodeStrokeWidth = isLinkSource || isDropTarget ? 4 : isHovered ? 3 : 0;

              return (
                <g
                  key={n.id}
                  data-node="true"
                  onMouseEnter={() => handleNodeHover(n.id)}
                  onMouseLeave={() => { setHoveredId(null); setTooltipPos(null); }}
                  onMouseDown={(e) => {
                    if (linkMode && !isEditing) handleNodeDragStart(e, n.id);
                  }}
                  onClick={(e) => {
                    if (linkMode && !isEditing) {
                      e.stopPropagation();
                      handleLinkNodeClick(n.id);
                    }
                  }}
                  opacity={isDim ? 0.1 : 1}
                  style={{ transition: 'opacity 0.2s' }}
                  className={linkMode ? 'cursor-crosshair' : 'cursor-pointer'}
                >
                  <rect
                    x={n.x} y={n.y} width={n.w} height={n.h}
                    rx={n.h / 2}
                    fill={color}
                    stroke={nodeStroke}
                    strokeWidth={nodeStrokeWidth}
                    filter="url(#cardShadow)"
                  />

                  <rect
                    x={n.x + 12} y={n.y + 7}
                    width={Math.max(displayCode.length * 7.5 + 12, 36)}
                    height={17} rx={4}
                    fill="rgba(255,255,255,0.25)"
                  />
                  <text x={n.x + 18} y={n.y + 19} fontSize="10" fill="#fff" fontWeight="700" fontFamily="monospace">
                    {displayCode}
                  </text>

                  <text x={n.x + 14} y={n.y + 43} fontSize="11.5" fill="#ffffff" fontWeight="500" opacity={0.95}>
                    {n.title.length > 24 ? n.title.substring(0, 24) + '\u2026' : n.title}
                  </text>

                  {isEditing && (
                    <foreignObject x={n.x + 4} y={n.y + 4} width={n.w - 8} height={n.h - 8}>
                      <input
                        autoFocus value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') setEditId(null); }}
                        onBlur={() => handleEditSave()}
                        className="w-full h-full px-2 text-xs rounded-full border border-indigo-300 outline-none bg-white"
                        onClick={e => e.stopPropagation()}
                      />
                    </foreignObject>
                  )}

                  {/* Hover actions — hidden in link mode */}
                  {isHovered && !isEditing && !linkMode && (
                    <g data-action="true">
                      <g onClick={e => { e.stopPropagation(); onCreate(n.id, CHILD_MAP[n.type] || 'activity'); }} className="cursor-pointer">
                        <circle cx={n.x + n.w - 8} cy={n.y + 14} r={7} fill="#10b981" stroke="#fff" strokeWidth={1} />
                        <text x={n.x + n.w - 8} y={n.y + 17.5} fontSize="11" fill="white" textAnchor="middle" fontWeight="700">+</text>
                      </g>
                      <g onClick={e => { e.stopPropagation(); setEditId(n.id); setEditTitle(n.title); }} className="cursor-pointer">
                        <circle cx={n.x + n.w - 8} cy={n.y + 30} r={7} fill="#6b7280" stroke="#fff" strokeWidth={1} />
                        <text x={n.x + n.w - 8} y={n.y + 33.5} fontSize="8" fill="white" textAnchor="middle">{'\u270E'}</text>
                      </g>
                      <g onClick={e => { e.stopPropagation(); onDelete(n.id); }} className="cursor-pointer">
                        <circle cx={n.x + n.w - 8} cy={n.y + 46} r={7} fill="#ef4444" stroke="#fff" strokeWidth={1} />
                        <text x={n.x + n.w - 8} y={n.y + 49.5} fontSize="10" fill="white" textAnchor="middle" fontWeight="700">{'\u00D7'}</text>
                      </g>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Context sidebar */}
        {contextItems.length > 0 && (
          <div className="w-56 flex-shrink-0 overflow-y-auto overflow-x-hidden" style={{ maxHeight: isFullscreen ? 'calc(100vh - 80px)' : '75vh', scrollbarWidth: 'thin' }}>
            <div className="bg-violet-50/60 rounded-xl border border-violet-200 p-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <Info className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Contexto</span>
              </div>
              {contextItems.map(item => (
                <div key={item.id} className="bg-white rounded-lg border border-violet-100 p-2.5 group">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: getColor(item.type) + '18', color: getColor(item.type) }}>
                      {getAbbr(item.type)}
                    </span>
                    {item.code && <span className="text-[9px] font-mono text-gray-400">{item.code}</span>}
                  </div>
                  <p className="text-[11px] font-medium text-gray-700 leading-tight">{item.title}</p>
                  {item.description && <p className="text-[9px] text-gray-400 mt-0.5 leading-snug">{item.description}</p>}
                  <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => onDelete(item.id)} className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => onCreate(null, 'assumption')}
                className="w-full py-1.5 rounded-lg border border-dashed border-violet-300 text-[10px] text-violet-500 hover:bg-violet-100 transition flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" />Agregar supuesto
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tooltip portal */}
      {hoveredId && hoveredNode && tooltipPos && editId !== hoveredId && !isPanning && (
        <TooltipPortal>
          <div className="fixed pointer-events-none" style={{ left: tooltipPos.x, top: tooltipPos.y + 8, transform: 'translateX(-50%)', zIndex: 99999 }}>
            <div className="bg-gray-900 text-white rounded-xl shadow-2xl px-4 py-3 text-[11px] leading-relaxed" style={{ minWidth: 220, maxWidth: 340 }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-bold px-2 py-0.5 rounded text-[9px]" style={{ backgroundColor: getColor(hoveredNode.type) + '40', color: '#fff' }}>
                  {getLabel(hoveredNode.type)}
                </span>
                {hoveredNode.code && <span className="font-mono text-gray-400 text-[10px]">{hoveredNode.code}</span>}
              </div>
              <p className="text-white font-medium text-[12px] leading-snug">{hoveredNode.title}</p>
              {hoveredNode.description && <p className="text-gray-400 text-[10px] mt-1 leading-snug">{hoveredNode.description}</p>}
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-2.5 h-2.5 bg-gray-900 rotate-45" />
            </div>
          </div>
        </TooltipPortal>
      )}

      {/* Legend */}
      {!isFullscreen && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <span key={type} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: color + '15', color }}>
              {getAbbr(type)} &mdash; {getLabel(type)}
            </span>
          ))}
        </div>
      )}
    </>
  );

  // Fullscreen wrapper
  if (isFullscreen) {
    return (
      <TooltipPortal>
        <div className="fixed inset-0 z-[9998] bg-white p-4 overflow-hidden">
          {canvasContent}
        </div>
      </TooltipPortal>
    );
  }

  return <div className="space-y-0">{canvasContent}</div>;
}
