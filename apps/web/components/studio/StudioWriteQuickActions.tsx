'use client';

import { FileSpreadsheet, FileText, LayoutTemplate, Sparkles } from 'lucide-react';

type Props = {
  locale: string;
  disabled?: boolean;
  onRun: (prompt: string) => void;
};

const ACTIONS = {
  pt: [
    {
      id: 'ppt',
      icon: LayoutTemplate,
      label: 'Guião PPT',
      prompt:
        'Cria um guião de apresentação com 8 slides: título por slide, bullets curtos e notas do orador. Mantém o conteúdo actual quando existir.',
    },
    {
      id: 'table',
      icon: FileSpreadsheet,
      label: 'Tabela KPI',
      prompt:
        'Insere ou actualiza uma tabela KPI (Markdown) com colunas Métrica, Valor, Meta, Variação — dados exemplo realistas para o contexto do documento.',
    },
    {
      id: 'summary',
      icon: FileText,
      label: '1 página',
      prompt:
        'Resume todo o documento numa única página executiva: título, 3–5 bullets-chave e parágrafo de conclusão.',
    },
    {
      id: 'formal',
      icon: Sparkles,
      label: 'Tom formal',
      prompt:
        'Reescreve o documento (ou secções seleccionadas) com tom institucional formal, sem perder facts nem números.',
    },
  ],
  es: [
    {
      id: 'ppt',
      icon: LayoutTemplate,
      label: 'Guion PPT',
      prompt:
        'Crea un guion de presentación con 8 diapositivas: título por slide, bullets cortos y notas del orador. Mantén el contenido actual cuando exista.',
    },
    {
      id: 'table',
      icon: FileSpreadsheet,
      label: 'Tabla KPI',
      prompt:
        'Inserta o actualiza una tabla KPI (Markdown) con columnas Métrica, Valor, Meta, Variación — datos de ejemplo realistas para el contexto del documento.',
    },
    {
      id: 'summary',
      icon: FileText,
      label: '1 página',
      prompt:
        'Resume todo el documento en una sola página ejecutiva: título, 3–5 bullets clave y párrafo de conclusión.',
    },
    {
      id: 'formal',
      icon: Sparkles,
      label: 'Tono formal',
      prompt:
        'Reescribe el documento (o secciones seleccionadas) con tono institucional formal, sin perder hechos ni cifras.',
    },
  ],
  en: [
    {
      id: 'ppt',
      icon: LayoutTemplate,
      label: 'PPT outline',
      prompt:
        'Create a presentation outline with 8 slides: title per slide, short bullets and speaker notes. Keep existing content when present.',
    },
    {
      id: 'table',
      icon: FileSpreadsheet,
      label: 'KPI table',
      prompt:
        'Insert or update a KPI table (Markdown) with columns Metric, Value, Target, Delta — realistic sample data for the document context.',
    },
    {
      id: 'summary',
      icon: FileText,
      label: '1 page',
      prompt:
        'Summarize the whole document into one executive page: title, 3–5 key bullets and a closing paragraph.',
    },
    {
      id: 'formal',
      icon: Sparkles,
      label: 'Formal tone',
      prompt:
        'Rewrite the document (or selected sections) in a formal institutional tone without losing facts or numbers.',
    },
  ],
} as const;

export function StudioWriteQuickActions({ locale, disabled, onRun }: Props) {
  const actions =
    locale === 'es' ? ACTIONS.es : locale === 'en' ? ACTIONS.en : ACTIONS.pt;
  const title =
    locale === 'es'
      ? 'Conteúdo rápido'
      : locale === 'en'
        ? 'Quick content'
        : 'Conteúdo rápido';

  return (
    <div className="border-b border-stone-200 px-3 py-2">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">{title}</p>
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              type="button"
              disabled={disabled}
              onClick={() => onRun(a.prompt)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-semibold text-stone-700 hover:border-orange-300 hover:bg-orange-50 disabled:opacity-40"
            >
              <Icon className="h-3.5 w-3.5 text-orange-600" />
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
