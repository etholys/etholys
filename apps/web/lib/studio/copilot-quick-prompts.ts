import type { LucideIcon } from 'lucide-react';
import { FileSpreadsheet, FileText, LayoutTemplate, Sparkles } from 'lucide-react';

export type StudioQuickPrompt = {
  id: string;
  icon: LucideIcon;
  label: string;
  prompt: string;
};

export function studioQuickPrompts(locale: string): StudioQuickPrompt[] {
  if (locale === 'es') {
    return [
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
    ];
  }
  if (locale === 'en') {
    return [
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
          'Insert or update a KPI table (Markdown) with Metric, Value, Target, Change columns — realistic sample data for the document context.',
      },
      {
        id: 'summary',
        icon: FileText,
        label: '1-page summary',
        prompt:
          'Summarize the whole document on one executive page: title, 3–5 key bullets and a conclusion paragraph.',
      },
      {
        id: 'formal',
        icon: Sparkles,
        label: 'Formal tone',
        prompt:
          'Rewrite the document (or selected sections) in a formal institutional tone without losing facts or figures.',
      },
    ];
  }
  return [
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
  ];
}
