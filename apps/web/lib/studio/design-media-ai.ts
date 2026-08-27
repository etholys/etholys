/**
 * IA de Desenho — modos Canva / Gamma / imagem / vídeo (storyboard).
 */
import type { StudioBlock, StudioCanvasState, StudioPage } from '@/lib/studio/types';
import { normalizeStudioCanvas } from '@/lib/studio/types';
import type { StudioBrandKit } from '@/lib/studio/export';
import { flattenStudioTextForDesign } from '@/lib/studio/design-layout-ai';

export type StudioDesignGenerateMode =
  | 'layout'
  | 'magic'
  | 'deck'
  | 'images'
  | 'video';

export type DesignGenerateInput = {
  mode: StudioDesignGenerateMode;
  locale: string;
  prompt: string;
  brand: StudioBrandKit;
  canvas: StudioCanvasState;
};

function lang(locale: string): string {
  return locale === 'es' ? 'español' : locale === 'en' ? 'English' : 'português';
}

export function buildDesignGenerateSystemPrompt(input: DesignGenerateInput): string {
  const { mode, locale, prompt, brand, canvas } = input;
  const sourceText = flattenStudioTextForDesign(canvas);
  const base = `És o **agente criativo Etholys Studio** (Canva + Gamma + InDesign + storyboard vídeo).
Idioma: ${lang(locale)}.
Brand: ${brand.orgName || '—'} · primária ${brand.primaryColor} · secundária ${brand.secondaryColor || '—'}.

Responde **só JSON** válido:
{
  "message": "resumo curto",
  "pageSize": "A4"|"Slide"|…,
  "format": "report"|"presentation"|"brief",
  "pages": [{
    "title": "…",
    "blocks": [{
      "kind": "heading"|"paragraph"|"bullets"|"callout"|"image"|"diagram",
      "text": "…",
      "imagePrompt": "só para kind image — descrição visual para gerar ilustração",
      "videoScene": { "durationSec": 5, "narration": "locução deste plano" },
      "style": { "align": "center", "textScale": "xl", "frame": "accent" },
      "layout": { "xPct": 8, "yPct": 12, "wPct": 84, "hPct": 40 }
    }]
  }]
}`;

  const modeBrief: Record<StudioDesignGenerateMode, string> = {
    layout: `## Modo: Diagramação (Gamma)
Reorganiza o texto fonte em layout visual profissional. Máx. 8 páginas. Posições % obrigatórias.
Brief: ${prompt || 'Moderno, institucional'}

## Texto fonte
${sourceText || '(vazio)'}`,
    magic: `## Modo: Magic Design (Canva)
Cria um design completo **só a partir do brief** — capa, secções, hierarquia visual. Não precisas de texto fonte.
Brief: ${prompt}
Inclui 1-2 blocos image com imagePrompt descritivo (hero, ícone conceptual).`,
    deck: `## Modo: Apresentação (Gamma deck)
Gera **6-8 slides** (pageSize Slide, format presentation). Título + bullets curtos por slide.
Brief: ${prompt}
${sourceText ? `\nConteúdo base:\n${sourceText.slice(0, 6000)}` : ''}`,
    images: `## Modo: Imagens IA (Canva / Photoshop-lite)
Gera **1 página** com 2-4 blocos image + legendas. Cada image tem imagePrompt detalhado (estilo, cores brand, composição).
Brief: ${prompt}`,
    video: `## Modo: Storyboard vídeo (CapCut/Premiere-lite)
Gera **4-6 páginas** (Slide landscape): cada uma = 1 plano com bloco image (frame) + heading + videoScene.narration + durationSec.
Brief: ${prompt}
Estilo: FORGE curso, campanha, ou vídeo institucional Meet/CHORUS.`,
  };

  return `${base}\n\n${modeBrief[mode]}`;
}

export function parseDesignGenerateJson(raw: string): {
  message: string;
  pageSize?: string;
  format?: string;
  pages: Array<{
    title?: string;
    blocks: Array<{
      kind?: string;
      text?: string;
      title?: string;
      imagePrompt?: string;
      videoScene?: { durationSec?: number; narration?: string };
      style?: StudioBlock['style'];
      layout?: StudioBlock['layout'];
      diagramLang?: StudioBlock['diagramLang'];
    }>;
  }>;
} | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      message?: string;
      pages?: unknown;
      pageSize?: string;
      format?: string;
    };
    if (!Array.isArray(parsed.pages) || !parsed.pages.length) return null;
    return {
      message: typeof parsed.message === 'string' ? parsed.message : 'Design aplicado.',
      pageSize: parsed.pageSize,
      format: parsed.format,
      pages: parsed.pages as Array<{
        title?: string;
        blocks: Array<{
          kind?: string;
          text?: string;
          title?: string;
          imagePrompt?: string;
          videoScene?: { durationSec?: number; narration?: string };
          style?: StudioBlock['style'];
          layout?: StudioBlock['layout'];
          diagramLang?: StudioBlock['diagramLang'];
        }>;
      }>,
    };
  } catch {
    return null;
  }
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const KINDS = new Set(['paragraph', 'heading', 'bullets', 'callout', 'diagram', 'image', 'table']);

export function applyDesignGenerateToCanvas(
  canvas: StudioCanvasState,
  layout: NonNullable<ReturnType<typeof parseDesignGenerateJson>>,
): StudioCanvasState {
  const pageSize =
    layout.pageSize === 'Slide' || layout.format === 'presentation'
      ? ('Slide' as const)
      : canvas.pageSize || 'A4';
  const format =
    layout.format === 'presentation'
      ? ('presentation' as const)
      : layout.format === 'brief'
        ? ('brief' as const)
        : canvas.format;

  const pages: StudioPage[] = layout.pages.slice(0, 10).map((p, i) => {
    const blocks: StudioBlock[] = (p.blocks || [])
      .filter((b) => b && (String(b.text || '').trim() || b.kind === 'image'))
      .slice(0, 24)
      .map((b, j) => {
        const kindRaw = String(b.kind || 'paragraph');
        const kind = (KINDS.has(kindRaw) ? kindRaw : 'paragraph') as StudioBlock['kind'];
        const fromAi = b.layout && typeof b.layout === 'object' ? b.layout : null;
        const autoLayout =
          fromAi && (fromAi.xPct != null || fromAi.yPct != null)
            ? {
                xPct: fromAi.xPct,
                yPct: fromAi.yPct,
                wPct: fromAi.wPct ?? 88,
                hPct: fromAi.hPct,
              }
            : {
                xPct: kind === 'image' ? 8 : 6,
                yPct: Math.min(75, 8 + j * 14),
                wPct: kind === 'image' ? 84 : 88,
                hPct: kind === 'image' ? 42 : undefined,
              };
        return {
          id: newId('block'),
          kind,
          title: typeof b.title === 'string' ? b.title : undefined,
          text: String(b.text || (kind === 'image' ? b.imagePrompt || 'Imagem' : '')),
          imagePrompt: typeof b.imagePrompt === 'string' ? b.imagePrompt : kind === 'image' ? String(b.text || '') : undefined,
          imageUrl: kind === 'image' ? null : undefined,
          mediaMeta:
            b.videoScene && typeof b.videoScene === 'object'
              ? {
                  type: 'video-scene' as const,
                  durationSec:
                    typeof b.videoScene.durationSec === 'number' ? b.videoScene.durationSec : 5,
                  narration:
                    typeof b.videoScene.narration === 'string' ? b.videoScene.narration : undefined,
                }
              : undefined,
          diagramLang: kind === 'diagram' ? b.diagramLang || 'mermaid' : undefined,
          style: b.style && typeof b.style === 'object' ? { ...b.style } : undefined,
          layout: autoLayout,
          order: j,
        };
      });
    if (!blocks.length) {
      blocks.push({ id: newId('block'), kind: 'paragraph', text: '', order: 0 });
    }
    return {
      id: canvas.pages[i]?.id || newId('page'),
      title: p.title || `Página ${i + 1}`,
      order: i,
      pageSize,
      layoutMode: 'blank' as const,
      moldId: null,
      blocks,
    };
  });

  return normalizeStudioCanvas({
    ...canvas,
    format,
    pageSize,
    orientation: pageSize === 'Slide' ? 'landscape' : canvas.orientation || 'portrait',
    studioMode: 'design',
    pages,
  });
}

/** Extrai SVG puro da resposta LLM. */
export function extractSvgFromLlm(raw: string): string | null {
  const t = raw.trim();
  const svgMatch = t.match(/<svg[\s\S]*<\/svg>/i);
  if (svgMatch) return svgMatch[0]!;
  if (t.startsWith('<svg')) return t;
  return null;
}

export function svgToDataUrl(svg: string): string {
  const encoded =
    typeof Buffer !== 'undefined'
      ? `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`
      : `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return encoded;
}

export function buildImageSvgSystemPrompt(brand: StudioBrandKit): string {
  return `Geras **apenas** markup SVG válido (sem markdown, sem explicação).
viewBox="0 0 800 600". Estilo ilustração profissional / Canva.
Cores: primária ${brand.primaryColor}, secundária ${brand.secondaryColor || '#64748b'}.
Sem scripts, sem links externos, sem raster embebido.`;
}

export function requiresSourceText(mode: StudioDesignGenerateMode): boolean {
  return mode === 'layout';
}
