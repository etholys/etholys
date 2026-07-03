export type ReportCanvasRegionKind = 'paragraph' | 'tableCell' | 'cell';

export type ReportCanvasFieldType = 'short' | 'long' | 'table' | 'other';

export type ReportCanvasSectionKind = 'fields' | 'table' | 'narrative';

export type ReportCanvasSection = {
  id: string;
  kind: ReportCanvasSectionKind;
  title: string;
  regionIds: string[];
  /** Cabeçalhos de coluna (tabelas de grelha) */
  columns?: string[];
  /** Ordem visual (drag-and-drop) */
  order?: number;
};

export type ReportCanvasRegion = {
  id: string;
  kind: ReportCanvasRegionKind;
  label?: string;
  text: string;
  missing?: boolean;
  /** Tipo de campo na UI */
  fieldType?: ReportCanvasFieldType;
  /** Instrução ao utilizador (tooltip !) */
  instruction?: string;
  /** Excel sheet name */
  sheet?: string;
  row?: number;
  col?: number;
  /** DOCX: índice de parágrafo no documento (só corpo, sem tabelas) */
  docxIndex?: number;
  docxKind?: 'paragraph' | 'tableCell';
  /** DOCX: posição da célula na tabela do modelo */
  docxTableIndex?: number;
  docxRowIndex?: number;
  docxColIndex?: number;
  /** Agrupamento visual */
  sectionId?: string;
  tableId?: string;
  tableTitle?: string;
  columnLabel?: string;
  tableRow?: number;
  tableCol?: number;
  order?: number;
};

export type ReportCanvasState = {
  version: 1;
  /** Incrementado quando a heurística de leitura do modelo muda */
  parseVersion?: number;
  format: 'docx' | 'xlsx' | 'markdown';
  templateFileId: string;
  templateFileName?: string;
  regions: ReportCanvasRegion[];
  /** Ordem e agrupamento para pré-visualização */
  sections?: ReportCanvasSection[];
};

export type CanvasPatch = {
  regionId: string;
  text?: string;
  label?: string;
  missing?: boolean;
  fieldType?: ReportCanvasFieldType;
  instruction?: string;
  sectionId?: string;
  tableId?: string;
  tableTitle?: string;
  columnLabel?: string;
  tableRow?: number;
  tableCol?: number;
  order?: number;
};

export type CopilotCanvasPayload = {
  canvasPatches?: Array<{
    regionId?: string;
    text?: string;
    label?: string;
    missing?: boolean;
    sectionId?: string;
    tableId?: string;
    tableTitle?: string;
    columnLabel?: string;
    tableRow?: number;
    tableCol?: number;
    instruction?: string;
    fieldType?: ReportCanvasFieldType;
  }>;
  missingRegionIds?: string[];
  removeRegionIds?: string[];
  sectionPatches?: Array<{
    id: string;
    title?: string;
    kind?: ReportCanvasSectionKind;
    columns?: string[];
  }>;
  /** Novas linhas em tabelas (IA ou migração) — uma entrada = uma linha */
  addTableRows?: AddTableRowPayload[];
  /** Substitui TODAS as linhas de dados de uma tabela (reordenação / reescrita completa) */
  replaceTableRows?: ReplaceTableRowsPayload[];
};

export type AddTableRowPayload = {
  sectionId: string;
  cells: Array<{ tableCol: number; text?: string }>;
};

export type ReplaceTableRowsPayload = {
  sectionId: string;
  rows: Array<{ cells: Array<{ tableCol: number; text?: string }> }>;
};

export function emptyMarkdownCanvas(templateFileId: string, fileName: string, content: string): ReportCanvasState {
  return {
    version: 1,
    format: 'markdown',
    templateFileId,
    templateFileName: fileName,
    regions: [
      { id: 'body', kind: 'paragraph', label: 'Conteúdo del informe', text: content },
    ],
  };
}

export function canvasStateToPlainText(state: ReportCanvasState | null | undefined): string {
  if (!state?.regions?.length) return '';
  return state.regions
    .map((r) => {
      const label = r.label ? `## ${r.label}\n` : '';
      return `${label}${r.text}`.trim();
    })
    .filter(Boolean)
    .join('\n\n');
}
