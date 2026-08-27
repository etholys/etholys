'use client';

import { useState } from 'react';
import {
  Clapperboard,
  ImageIcon,
  LayoutTemplate,
  Loader2,
  Presentation,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { StudioCanvasState } from '@/lib/studio/types';
import type { StudioDesignGenerateMode } from '@/lib/studio/design-media-ai';

type Props = {
  documentId: string;
  companyId?: string;
  locale: string;
  canEdit: boolean;
  disabled?: boolean;
  onApplied: (canvas: StudioCanvasState, message: string) => void;
};

type TabDef = {
  id: StudioDesignGenerateMode;
  icon: typeof Wand2;
  label: { pt: string; es: string; en: string };
  hint: { pt: string; es: string; en: string };
  placeholder: { pt: string; es: string; en: string };
  run: { pt: string; es: string; en: string };
  presets: { pt: string[]; es: string[]; en: string[] };
  generateImages?: boolean;
};

const TABS: TabDef[] = [
  {
    id: 'magic',
    icon: Wand2,
    label: { pt: 'Magic', es: 'Magic', en: 'Magic' },
    hint: {
      pt: 'Canva Magic Design — layout completo só a partir do brief.',
      es: 'Canva Magic Design — layout completo solo a partir del brief.',
      en: 'Canva Magic Design — full layout from brief only.',
    },
    placeholder: {
      pt: 'Ex.: poster campanha FORGE, cores brand, hero visual…',
      es: 'Ej.: póster campaña FORGE, colores brand, hero visual…',
      en: 'E.g. FORGE campaign poster, brand colors, hero visual…',
    },
    run: { pt: 'Criar design', es: 'Crear diseño', en: 'Create design' },
    presets: {
      pt: [
        'Poster institucional A4 — hero, título forte, 3 destaques',
        'Post LinkedIn 1080×1080 — quote + gráfico conceptual',
        'Flyer evento Meet/CHORUS — data, CTA, visual moderno',
      ],
      es: [
        'Póster institucional A4 — hero, título fuerte, 3 destacados',
        'Post LinkedIn 1080×1080 — cita + gráfico conceptual',
        'Flyer evento Meet/CHORUS — fecha, CTA, visual moderno',
      ],
      en: [
        'Institutional A4 poster — hero, strong title, 3 highlights',
        'LinkedIn post 1080×1080 — quote + conceptual graphic',
        'Meet/CHORUS event flyer — date, CTA, modern visual',
      ],
    },
    generateImages: true,
  },
  {
    id: 'deck',
    icon: Presentation,
    label: { pt: 'Deck', es: 'Deck', en: 'Deck' },
    hint: {
      pt: 'Gamma — apresentação slide-a-slide a partir do brief (+ texto Redação se existir).',
      es: 'Gamma — presentación slide a slide desde el brief (+ texto Redacción si existe).',
      en: 'Gamma — slide deck from brief (+ Write text if available).',
    },
    placeholder: {
      pt: 'Ex.: pitch investidores, 8 slides, problema → solução → métricas',
      es: 'Ej.: pitch inversores, 8 slides, problema → solución → métricas',
      en: 'E.g. investor pitch, 8 slides, problem → solution → metrics',
    },
    run: { pt: 'Gerar deck', es: 'Generar deck', en: 'Generate deck' },
    presets: {
      pt: [
        'Pitch 8 slides — capa, problema, solução, mercado, modelo, equipa, métricas, CTA',
        'Formação FORGE — módulo introdutório com objetivos e quiz',
        'Relatório trimestral visual — KPIs + gráficos conceptuais',
      ],
      es: [
        'Pitch 8 slides — portada, problema, solución, mercado, modelo, equipo, métricas, CTA',
        'Formación FORGE — módulo introductorio con objetivos y quiz',
        'Informe trimestral visual — KPIs + gráficos conceptuales',
      ],
      en: [
        '8-slide pitch — cover, problem, solution, market, model, team, metrics, CTA',
        'FORGE training — intro module with goals and quiz',
        'Visual quarterly report — KPIs + conceptual charts',
      ],
    },
  },
  {
    id: 'layout',
    icon: LayoutTemplate,
    label: { pt: 'Diagramar', es: 'Diagramar', en: 'Layout' },
    hint: {
      pt: 'Reorganiza o texto da Redação em layout visual (Gamma/InDesign).',
      es: 'Reorganiza el texto de Redacción en layout visual (Gamma/InDesign).',
      en: 'Reorganize Write text into visual layout (Gamma/InDesign).',
    },
    placeholder: {
      pt: 'Ex.: capa institucional, callouts, tipografia forte…',
      es: 'Ej.: portada institucional, callouts, tipografía fuerte…',
      en: 'E.g. institutional cover, callouts, strong typography…',
    },
    run: { pt: 'Diagramar agora', es: 'Diagramar ahora', en: 'Lay out now' },
    presets: {
      pt: [
        'Capa + secções limpas, estilo Gamma, tipografia forte',
        'Institucional com brand kit, callouts e hierarquia clara',
        'Relatório técnico: secções numeradas, listas, molduras subtis',
      ],
      es: [
        'Portada + secciones limpias, estilo Gamma, tipografía fuerte',
        'Institucional con brand kit, callouts y jerarquía clara',
        'Informe técnico: secciones numeradas, listas, marcos sutiles',
      ],
      en: [
        'Cover + clean sections, Gamma style, strong typography',
        'Institutional with brand kit, callouts and clear hierarchy',
        'Technical report: numbered sections, lists, subtle frames',
      ],
    },
  },
  {
    id: 'images',
    icon: ImageIcon,
    label: { pt: 'Imagens', es: 'Imágenes', en: 'Images' },
    hint: {
      pt: 'Gera ilustrações SVG com IA (estilo Canva/Photoshop) + legendas.',
      es: 'Genera ilustraciones SVG con IA (estilo Canva/Photoshop) + leyendas.',
      en: 'Generate AI SVG illustrations (Canva/Photoshop style) + captions.',
    },
    placeholder: {
      pt: 'Ex.: 3 ícones isométricos sustentabilidade, paleta brand',
      es: 'Ej.: 3 iconos isométricos sostenibilidad, paleta brand',
      en: 'E.g. 3 isometric sustainability icons, brand palette',
    },
    run: { pt: 'Gerar imagens', es: 'Generar imágenes', en: 'Generate images' },
    presets: {
      pt: [
        'Hero ilustração abstracta — crescimento, setas, brand',
        'Infográfico 4 ícones — processo ESG em 4 passos',
        'Collage 3 fotos conceptuais — equipa, natureza, tecnologia',
      ],
      es: [
        'Hero ilustración abstracta — crecimiento, flechas, brand',
        'Infografía 4 iconos — proceso ESG en 4 pasos',
        'Collage 3 fotos conceptuales — equipo, naturaleza, tecnología',
      ],
      en: [
        'Abstract hero illustration — growth, arrows, brand',
        '4-icon infographic — ESG process in 4 steps',
        '3-photo conceptual collage — team, nature, technology',
      ],
    },
    generateImages: true,
  },
  {
    id: 'video',
    icon: Clapperboard,
    label: { pt: 'Vídeo', es: 'Vídeo', en: 'Video' },
    hint: {
      pt: 'Storyboard multi-plano — frames + locução (CapCut/Premiere-lite).',
      es: 'Storyboard multi-plano — frames + locución (CapCut/Premiere-lite).',
      en: 'Multi-scene storyboard — frames + narration (CapCut/Premiere-lite).',
    },
    placeholder: {
      pt: 'Ex.: vídeo 60s produto FORGE — hook, demo, prova social, CTA',
      es: 'Ej.: vídeo 60s producto FORGE — hook, demo, prueba social, CTA',
      en: 'E.g. 60s FORGE product video — hook, demo, social proof, CTA',
    },
    run: { pt: 'Criar storyboard', es: 'Crear storyboard', en: 'Create storyboard' },
    presets: {
      pt: [
        'Vídeo institucional 45s — 5 planos, locução PT',
        'Tutorial Meet/CHORUS — ecrã partilha, breakout, gravação',
        'Reels campanha — 4 planos rápidos, texto overlay',
      ],
      es: [
        'Vídeo institucional 45s — 5 planos, locución ES',
        'Tutorial Meet/CHORUS — pantalla compartida, breakout, grabación',
        'Reels campaña — 4 planos rápidos, texto overlay',
      ],
      en: [
        '45s institutional video — 5 scenes, EN narration',
        'Meet/CHORUS tutorial — screen share, breakout, recording',
        'Campaign reels — 4 fast scenes, overlay text',
      ],
    },
    generateImages: true,
  },
];

function loc<T extends { pt: string; es: string; en: string }>(locale: string, o: T): string {
  return locale === 'es' ? o.es : locale === 'en' ? o.en : o.pt;
}

export function StudioDesignAiPanel({
  documentId,
  locale,
  canEdit,
  disabled,
  onApplied,
}: Props) {
  const [tab, setTab] = useState<StudioDesignGenerateMode>('magic');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  const active = TABS.find((t) => t.id === tab) ?? TABS[0]!;
  const presets =
    locale === 'es' ? active.presets.es : locale === 'en' ? active.presets.en : active.presets.pt;

  async function run(brief?: string) {
    if (!canEdit || busy) return;
    const text = (brief ?? prompt).trim();
    if (tab !== 'layout' && !text) {
      setError(
        locale === 'es'
          ? 'Describe qué quieres crear.'
          : locale === 'en'
            ? 'Describe what to create.'
            : 'Descreve o que queres criar.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/studio/documents/${documentId}/design-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: tab,
          prompt: text,
          locale,
          generateImages: active.generateImages !== false,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      if (d.canvasState) {
        onApplied(d.canvasState, d.message || '');
        setLastMsg(d.message || null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-violet-900/40 bg-[#0f0b16] text-violet-50">
      <div className="border-b border-violet-800/50 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <Wand2 className="h-4 w-4 text-violet-300" />
          {loc(locale, {
            pt: 'IA de Desenho',
            es: 'IA de Diseño',
            en: 'Design AI',
          })}
        </h2>
        <p className="mt-1 text-[11px] leading-snug text-violet-200/70">{loc(locale, active.hint)}</p>
      </div>

      <div className="flex gap-0.5 overflow-x-auto border-b border-violet-800/40 px-2 py-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setError(null);
              }}
              className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                on
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-violet-300 hover:bg-violet-900/60 hover:text-violet-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {loc(locale, t.label)}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
          {loc(locale, { pt: 'Presets', es: 'Presets', en: 'Presets' })}
        </p>
        <div className="flex flex-col gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              disabled={!canEdit || busy || disabled}
              onClick={() => {
                setPrompt(p);
                void run(p);
              }}
              className="rounded-xl border border-violet-700/50 bg-violet-950/50 px-3 py-2 text-left text-[11px] leading-snug text-violet-100 hover:border-violet-400 hover:bg-violet-900/40 disabled:opacity-40"
            >
              {p}
            </button>
          ))}
        </div>

        {lastMsg && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-100">
            {lastMsg}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-violet-800/50 p-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={!canEdit || busy}
          rows={3}
          placeholder={loc(locale, active.placeholder)}
          className="w-full resize-none rounded-xl border border-violet-700/60 bg-violet-950/80 px-3 py-2 text-sm text-violet-50 placeholder:text-violet-400/60 outline-none focus:border-violet-400"
        />
        <button
          type="button"
          disabled={!canEdit || busy || disabled}
          onClick={() => void run()}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-900/40 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loc(locale, active.run)}
        </button>
      </div>
    </div>
  );
}
