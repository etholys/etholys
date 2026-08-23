/**
 * IA de diagramação (Design): transforma texto da redação num layout visual
 * estilo Gamma/Canva — com brand kit e instruções estéticas.
 */
import type { StudioBlock, StudioCanvasState, StudioPage } from '@/lib/studio/types';
import { normalizeStudioCanvas } from '@/lib/studio/types';
import type { StudioBrandKit } from '@/lib/studio/export';

export function flattenStudioTextForDesign(canvas: StudioCanvasState): string {
  const pages = canvas.pages.slice().sort((a, b) => a.order - b.order);
  const parts: string[] = [];
  for (const p of pages) {
    for (const b of p.blocks.slice().sort((x, y) => x.order - y.order)) {
      if (b.kind === 'image' || b.kind === 'diagram') continue;
      const t = String(b.text || '').trim();
      if (!t) continue;
      const tag =
        b.kind === 'heading'
          ? 'H'
          : b.kind === 'bullets'
            ? 'LIST'
            : b.kind === 'callout'
              ? 'CALLOUT'
              : 'P';
      parts.push(`[${tag}] ${t}`);
    }
  }
  return parts.join('\n\n').slice(0, 12000);
}

export function buildDesignLayoutSystemPrompt(opts: {
  locale: string;
  brand: StudioBrandKit;
  styleBrief: string;
  sourceText: string;
}): string {
  const lang =
    opts.locale === 'es' ? 'español' : opts.locale === 'en' ? 'English' : 'português';
  return `És o **agente de diagramação Etholys Studio** (nível Gamma / Canva / InDesign).
Transformas texto de redação num documento visual bem diagramado.

Idioma dos textos no documento: ${lang}.

## Brand kit (obrigatório respeitar)
- org: ${opts.brand.orgName || '—'}
- cor primária: ${opts.brand.primaryColor}
- cor secundária: ${opts.brand.secondaryColor}
- tipografia: ${opts.brand.fontFamily}
- rodapé: ${opts.brand.footerText || '—'}

## Brief estético do utilizador
${opts.styleBrief || '(moderno, limpo, institucional)'}

## Regras de diagramação
1. NÃO apagues o conteúdo semântico — reorganiza, hierarquiza e estiliza.
2. Usa blocos: heading, paragraph, bullets, callout (e no máximo 1 diagram mermaid se fizer sentido).
3. Aplica style em cada bloco quando útil:
   - align: left|center|right|justify
   - textScale: sm|md|lg|xl
   - frame: none|subtle|card|accent
4. Capa: 1.ª página com título grande (heading xl, center) + subtítulo.
5. Secções claras; callouts para destaques; listas para bullets.
6. Máximo 8 páginas. Densidade equilibrada (não folhas quase vazias).
7. Responde **só JSON** válido:
{
  "message": "resumo curto do que fizeste",
  "pages": [
    {
      "title": "Capa",
      "blocks": [
        { "kind": "heading", "text": "...", "style": { "align": "center", "textScale": "xl" } },
        { "kind": "paragraph", "text": "...", "style": { "align": "center", "textScale": "md" } }
      ]
    }
  ]
}

## Texto fonte (redação)
${opts.sourceText || '(vazio)'}
`;
}

export function parseDesignLayoutJson(raw: string): {
  message: string;
  pages: Array<{
    title?: string;
    blocks: Array<{
      kind?: string;
      text?: string;
      title?: string;
      style?: StudioBlock['style'];
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
    };
    if (!Array.isArray(parsed.pages) || !parsed.pages.length) return null;
    return {
      message: typeof parsed.message === 'string' ? parsed.message : 'Layout aplicado.',
      pages: parsed.pages as Array<{
        title?: string;
        blocks: Array<{
          kind?: string;
          text?: string;
          title?: string;
          style?: StudioBlock['style'];
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

const KINDS = new Set(['paragraph', 'heading', 'bullets', 'callout', 'diagram', 'image']);

/** Aplica o layout gerado pela IA sobre o canvas (modo design). */
export function applyDesignLayoutToCanvas(
  canvas: StudioCanvasState,
  layout: NonNullable<ReturnType<typeof parseDesignLayoutJson>>,
): StudioCanvasState {
  const pages: StudioPage[] = layout.pages.slice(0, 8).map((p, i) => {
    const blocks: StudioBlock[] = (p.blocks || [])
      .filter((b) => b && typeof b.text === 'string' && String(b.text).trim())
      .slice(0, 24)
      .map((b, j) => {
        const kindRaw = String(b.kind || 'paragraph');
        const kind = (KINDS.has(kindRaw) ? kindRaw : 'paragraph') as StudioBlock['kind'];
        return {
          id: newId('block'),
          kind,
          title: typeof b.title === 'string' ? b.title : undefined,
          text: String(b.text || ''),
          diagramLang: kind === 'diagram' ? b.diagramLang || 'mermaid' : undefined,
          style: (() => {
            const base: NonNullable<StudioBlock['style']> =
              b.style && typeof b.style === 'object' ? { ...b.style } : {};
            if (!base.frame && kind === 'callout') base.frame = 'accent';
            if (kind === 'heading' && i === 0 && j === 0) {
              if (!base.textScale) base.textScale = 'xl';
              if (!base.align) base.align = 'center';
            }
            return Object.keys(base).length ? base : undefined;
          })(),
          order: j,
        };
      });
    if (!blocks.length) {
      blocks.push({
        id: newId('block'),
        kind: 'paragraph',
        text: '',
        order: 0,
      });
    }
    return {
      id: canvas.pages[i]?.id || newId('page'),
      title: p.title || `Página ${i + 1}`,
      order: i,
      pageSize: canvas.pageSize || 'A4',
      layoutMode: 'blank' as const,
      moldId: null,
      blocks,
    };
  });

  return normalizeStudioCanvas({
    ...canvas,
    studioMode: 'design',
    pages,
  });
}
