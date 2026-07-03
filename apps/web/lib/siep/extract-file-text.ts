import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export type TextExtractionResult = {
  text: string;
  charCount: number;
  method: string;
  ok: boolean;
  issue?: string;
};

function isDocx(fileName: string, mime?: string | null): boolean {
  const name = fileName.toLowerCase();
  const m = mime || '';
  return (
    name.endsWith('.docx') ||
    m.includes('wordprocessingml') ||
    m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

function isPdf(fileName: string, mime?: string | null): boolean {
  return mime === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
}

/** Extrai texto de buffer para análise IA (Word, Excel, PDF, texto). */
export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType?: string | null,
): Promise<string> {
  return (await extractTextDetailed(buffer, fileName, mimeType)).text;
}

export async function extractTextDetailed(
  buffer: Buffer,
  fileName: string,
  mimeType?: string | null,
): Promise<TextExtractionResult> {
  const name = fileName.toLowerCase();
  const mime = mimeType || 'application/octet-stream';

  if (isPdf(name, mime)) {
    const pdfParse = (await import('pdf-parse')).default;
    try {
      const data = await pdfParse(buffer);
      const text = (data.text || '').trim();
      return assess(text, 'pdf-parse', text ? undefined : 'PDF sin capa de texto (puede ser escaneado)');
    } catch {
      return { text: '', charCount: 0, method: 'pdf-parse', ok: false, issue: 'Error al leer PDF' };
    }
  }

  if (isDocx(name, mime)) {
    try {
      const raw = await mammoth.extractRawText({ buffer });
      let text = (raw.value || '').trim();
      let method = 'mammoth-raw';

      if (text.length < 120) {
        const html = await mammoth.convertToHtml({ buffer });
        const fromHtml = html.value
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/tr>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (fromHtml.length > text.length) {
          text = fromHtml;
          method = 'mammoth-html';
        }
      }

      return assess(
        text,
        method,
        text.length < 40 ? 'DOCX con poco texto — formulario vacío o solo imágenes/cuadros no legibles' : undefined,
      );
    } catch {
      return { text: '', charCount: 0, method: 'mammoth', ok: false, issue: 'Error al leer DOCX' };
    }
  }

  if (name.endsWith('.doc')) {
    return {
      text: '',
      charCount: 0,
      method: 'unsupported',
      ok: false,
      issue: 'Formato .doc antiguo no soportado — guarde como .docx o exporte a PDF',
    };
  }

  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    mime.includes('spreadsheetml') ||
    mime.includes('ms-excel')
  ) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let allText = '';
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      allText += `[Hoja: ${sheetName}]\n${csv}\n\n`;
    }
    const text = allText.trim();
    return assess(text, 'xlsx', text.length < 20 ? 'Hoja Excel vacía o sin datos' : undefined);
  }

  if (mime.includes('text/') || name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = buffer.toString('utf-8').trim();
    return assess(text, 'utf-8');
  }

  const fallback = buffer.toString('utf-8').trim();
  return assess(fallback, 'binary-utf8', fallback.length < 40 ? 'Tipo de archivo no reconocido' : undefined);
}

function assess(text: string, method: string, issue?: string): TextExtractionResult {
  const charCount = text.length;
  const ok = charCount >= 80 && !issue;
  return { text, charCount, method, ok, issue };
}

export function isExtractedTextUsable(result: TextExtractionResult): boolean {
  return result.ok && result.charCount >= 80;
}
