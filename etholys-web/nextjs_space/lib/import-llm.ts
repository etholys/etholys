/**
 * SIEP import: Google Gemini (JSON estruturado).
 */

import { geminiGenerateContent, getGeminiMaxOutputTokens, getGeminiModel } from '@/lib/gemini-client';

export { DEFAULT_GEMINI_MODEL as DEFAULT_GEMINI_IMPORT_MODEL, getGeminiModel as getGeminiImportModel } from '@/lib/gemini-client';

type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'file'; file: { filename: string; file_data?: string } };

/** Texto único a partir de partes (PDF extraído localmente com pdf-parse). */
export async function buildPlainTextPromptFromParts(parts: ChatContentPart[]): Promise<string> {
  const chunks: string[] = [];
  const pdfParse = (await import('pdf-parse')).default;

  for (const part of parts) {
    if (part.type === 'text') {
      chunks.push(part.text);
      continue;
    }
    if (part.type === 'file' && part.file?.file_data) {
      const m = part.file.file_data.match(/^data:application\/pdf;base64,(.+)$/i);
      if (m) {
        const buf = Buffer.from(m[1], 'base64');
        try {
          const data = await pdfParse(buf);
          chunks.push(`--- PDF: ${part.file.filename} ---\n${data.text || '[sin texto extraíble]'}\n--- Fin PDF ---`);
        } catch {
          chunks.push(`--- PDF: ${part.file.filename} ---\n[Error al extraer texto del PDF]\n--- Fin PDF ---`);
        }
      }
    }
  }
  return chunks.join('\n\n');
}

/** @deprecated Use buildPlainTextPromptFromParts */
export const buildPlainTextPromptForOllama = buildPlainTextPromptFromParts;

export async function callImportLlm(systemPrompt: string, userContent: ChatContentPart[]): Promise<string> {
  const userText = await buildPlainTextPromptFromParts(userContent);
  const maxOut = getGeminiMaxOutputTokens();

  const { text, finishReason } = await geminiGenerateContent({
    systemInstruction: systemPrompt,
    userText,
    maxOutputTokens: maxOut,
    temperature: 0.1,
    responseMimeType: 'application/json',
  });

  if (finishReason === 'MAX_TOKENS') {
    throw new Error(
      `Gemini cortou a resposta (limite de saída). Defina GEMINI_MAX_OUTPUT_TOKENS=65536 no .env, reinicie o servidor, ou importe ficheiros menores. Modelo: ${getGeminiModel()}`
    );
  }

  return text;
}
