import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import type { GeminiPart } from '@/lib/gemini-client';

export async function buildImportSectionContent(files: File[]): Promise<{
  userParts: GeminiPart[];
  fileNames: string[];
}> {
  const userParts: GeminiPart[] = [];
  const fileNames: string[] = [];

  userParts.push({
    text: `Analiza ${files.length} archivo(s) y extrae SOLO la sección indicada en las instrucciones del sistema.\nArchivos: ${files.map((f) => f.name).join(', ')}`,
  });

  for (const file of files) {
    fileNames.push(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'application/octet-stream';
    const name = file.name.toLowerCase();

    if (mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/.test(name)) {
      const mime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
      userParts.push({
        inlineData: { mimeType: mime, data: buffer.toString('base64') },
      });
      userParts.push({ text: `--- Imagen / foto: ${file.name} — lee tablas y texto visibles con precisión ---` });
      continue;
    }

    if (mimeType === 'application/pdf' || name.endsWith('.pdf')) {
      userParts.push({
        inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') },
      });
      userParts.push({ text: `--- PDF: ${file.name} ---` });
      continue;
    }

    let text = '';
    if (name.endsWith('.docx') || mimeType.includes('wordprocessingml')) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || '';
    } else if (
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      mimeType.includes('spreadsheetml') ||
      mimeType.includes('ms-excel')
    ) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        text += `[Hoja: ${sheetName}]\n${XLSX.utils.sheet_to_csv(sheet, { blankrows: false })}\n\n`;
      }
    } else {
      text = buffer.toString('utf-8');
    }

    userParts.push({
      text: `--- Archivo: ${file.name} ---\n${text || '[sin texto extraíble]'}\n--- Fin ---`,
    });
  }

  return { userParts, fileNames };
}
