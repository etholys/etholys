export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import {
  geminiCompleteJsonText,
  geminiCompleteJsonWithPdf,
  geminiCompleteVision,
  getGeminiMaxOutputTokens,
  imageMimeFromFilename,
} from '@/lib/gemini-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';

const SYSTEM_PROMPT = `You are a financial transaction parser. Input may be CSV/Excel text, OR a PDF/image of bank statements, invoices, receipts, credit card summaries, or accounting reports (Spanish, Portuguese, English, or mixed).

Rules:
- Read tables, movement lists ("movimientos", "lançamentos", "extrato"), debits/credits ("débito/crédito", "cargo/abono"), and totals sections.
- Scanned PDFs: use the VISUAL layout of the attached document; do not assume text extraction is complete.
- INCOME: deposits, credits, salaries received, transfers in, sales ("ingreso", "crédito", "entrada"). EXPENSE: payments, debits, fees, purchases ("gasto", "débito", "saída").
- TRANSFER_IN / TRANSFER_OUT only when clearly internal transfers between own accounts.
- Use the transaction ROW date when each line has a date; else statement period or document date.
- Amounts: positive number only; if the PDF shows separate debit/credit columns, map sign to type and use absolute value for amount.
- If currency symbol appears ($ with context), infer USD vs UYU vs ARS from text (e.g. "UYU", "peso uruguayo").

Extract ALL line items you can identify (not only the first page). For each transaction, return:
- title: short descriptive name (e.g. "Google Workspace", "Pago electricidad")
- description: longer description if available
- type: INCOME, EXPENSE, TRANSFER_IN, or TRANSFER_OUT
- amount: numeric value (positive number, no currency symbols)
- currency: ISO code (USD, UYU, BRL, EUR, ARS). Default USD if not clear.
- category: best category guess (e.g. Servicios, Salarios, Materiales, Alimentación, Transporte, Impuestos, Alquiler, etc.)
- date: ISO date string YYYY-MM-DD

Respond with raw JSON only. No markdown or code fences.
Be concise in title/description when there are many rows.
Return this exact structure:
{
  "transactions": [
    {
      "title": "string",
      "description": "string or null",
      "type": "EXPENSE",
      "amount": 100.00,
      "currency": "USD",
      "category": "string",
      "date": "2025-01-15"
    }
  ],
  "summary": "Brief description of what was parsed (e.g. '3 transactions from a bank statement')"
}`;

/** Limite aproximado do pedido Gemini (documento inline + texto); margem de segurança. */
const MAX_INLINE_PDF_BYTES = 18 * 1024 * 1024;

type PreparedForLlm =
  | { mode: 'text'; userText: string }
  | { mode: 'vision'; userText: string; imageBase64: string }
  | { mode: 'pdf'; userText: string; pdfBase64: string; fallbackUserText: string };

async function extractFileContent(file: File): Promise<PreparedForLlm> {
  const name = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // PDF: enviar o ficheiro ao Gemini (lê digitalizações e layout). pdf-parse só como apoio.
  if (name.endsWith('.pdf')) {
    let txt = '';
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buffer);
      txt = (data.text || '').trim();
    } catch {
      txt = '';
    }
    const fallbackUserText = `Extract all transactions from this document.\n\n--- Extracted text only (${file.name}; may be empty for scanned PDFs) ---\n${txt.slice(0, 120000)}`;

    if (buffer.length > MAX_INLINE_PDF_BYTES) {
      if (!txt || txt.length < 40) {
        throw new Error(
          'PDF demasiado grande para envio à IA e sem texto extraível. Reduza o ficheiro (menos páginas) ou exporte para Excel/CSV.'
        );
      }
      return { mode: 'text', userText: fallbackUserText };
    }

    const textHint =
      txt.length >= 40
        ? `The attached PDF is "${file.name}". Below is imperfect text extraction (use it to disambiguate names/amounts; trust the PDF pages for layout and scanned content):\n\n---\n${txt.slice(0, 80000)}\n---\n\nNow extract all transactions from the attached PDF.`
        : `The attached PDF is "${file.name}". Text extraction yielded almost nothing (likely scanned or image-based). Extract all transactions by reading the PDF visually (tables, statements, invoices).`;

    return {
      mode: 'pdf',
      userText: textHint,
      pdfBase64: buffer.toString('base64'),
      fallbackUserText,
    };
  }

  // Imagens → Gemini (multimodal)
  if (name.match(/\.(jpg|jpeg|png|webp|gif|bmp|tiff?)$/)) {
    return {
      mode: 'vision',
      userText: 'Extract all transactions from this receipt/invoice/document. Respond with JSON only as instructed in the system prompt.',
      imageBase64: buffer.toString('base64'),
    };
  }

  // Excel / XLSX / XLS
  if (name.match(/\.(xlsx?|ods)$/)) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let text = '';
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      text += `Sheet: ${sheetName}\n`;
      text += XLSX.utils.sheet_to_csv(sheet) + '\n\n';
    });
    return {
      mode: 'text',
      userText: `Here is the spreadsheet content:\n\n${text.slice(0, 50000)}`,
    };
  }

  // CSV / TXT
  if (name.match(/\.(csv|tsv|txt)$/)) {
    const text = buffer.toString('utf-8');
    return {
      mode: 'text',
      userText: `Here is the file content:\n\n${text.slice(0, 50000)}`,
    };
  }

  // DOCX
  if (name.endsWith('.docx')) {
    let text = '';
    try {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } catch {
      const result = await mammoth.extractRawText({ arrayBuffer });
      text = result.value;
    }
    return {
      mode: 'text',
      userText: `Here is the document content:\n\n${text.slice(0, 50000)}`,
    };
  }

  throw new Error(`Unsupported file type: ${name}`);
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const prepared = await extractFileContent(file);

    const importMaxOut = getGeminiMaxOutputTokens();
    let content: string;
    try {
      if (prepared.mode === 'vision') {
        content = await geminiCompleteVision(
          SYSTEM_PROMPT,
          prepared.userText,
          prepared.imageBase64,
          imageMimeFromFilename(file.name),
          { maxOutputTokens: importMaxOut }
        );
      } else if (prepared.mode === 'pdf') {
        try {
          content = await geminiCompleteJsonWithPdf(SYSTEM_PROMPT, prepared.userText, prepared.pdfBase64, {
            maxOutputTokens: importMaxOut,
          });
        } catch (pdfErr: any) {
          console.warn('Gemini PDF inline failed, falling back to text extraction:', pdfErr?.message);
          content = await geminiCompleteJsonText(SYSTEM_PROMPT, prepared.fallbackUserText, {
            maxOutputTokens: importMaxOut,
          });
        }
      } else {
        content = await geminiCompleteJsonText(SYSTEM_PROMPT, prepared.userText, { maxOutputTokens: importMaxOut });
      }
    } catch (e: any) {
      console.error('Gemini import error:', e);
      return NextResponse.json(
        { error: e?.message || 'Error processing file with AI (Gemini)' },
        { status: 502 }
      );
    }

    let parsed: unknown;
    try {
      const balanced = extractFirstJsonObject(content) ?? content.trim();
      parsed = JSON.parse(balanced);
    } catch {
      console.error('Failed to parse LLM JSON:', content);
      return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 500 });
    }

    const p = parsed as { transactions?: any[]; summary?: string };

    // Validate & clean transactions
    const txs = (p.transactions || []).map((t: any) => ({
      title: t.title || '',
      description: t.description || null,
      type: ['INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT'].includes(t.type) ? t.type : 'EXPENSE',
      amount: Math.abs(parseFloat(t.amount) || 0),
      currency: t.currency || 'USD',
      category: t.category || '',
      date: t.date || new Date().toISOString().slice(0, 10),
    })).filter((t: any) => t.amount > 0);

    return NextResponse.json({
      transactions: txs,
      summary: p.summary || `${txs.length} transaction(s) found`,
      fileName: file.name,
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message || 'Error processing file' }, { status: 500 });
  }
}
