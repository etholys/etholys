'use client';

import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';
import type { InformeCanvasSelection } from '@/lib/siep/informe-canvas-selection';
import { WordReportCanvas } from '@/components/siep/canvas/WordReportCanvas';
import { ExcelReportCanvas } from '@/components/siep/canvas/ExcelReportCanvas';

type Props = {
  canvas: ReportCanvasState;
  onChange: (canvas: ReportCanvasState) => void;
  editableStructure?: boolean;
  selection?: InformeCanvasSelection | null;
  onSelectionChange?: (selection: InformeCanvasSelection | null) => void;
};

export function SiepInformeCanvas({
  canvas,
  onChange,
  editableStructure,
  selection,
  onSelectionChange,
}: Props) {
  if (canvas.format === 'xlsx') {
    return <ExcelReportCanvas canvas={canvas} onChange={onChange} editableStructure={editableStructure} />;
  }
  return (
    <WordReportCanvas
      canvas={canvas}
      onChange={onChange}
      editableStructure={editableStructure}
      selection={selection}
      onSelectionChange={onSelectionChange}
    />
  );
}
