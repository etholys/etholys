/**
 * SIEP import: LLM com JSON estruturado.
 */

import { llmGenerateContent, getLlmMaxOutputTokens, getLlmModel } from '@/lib/llm-client';

export { DEFAULT_LLM_MODEL, getLlmModel } from '@/lib/llm-client';

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

export async function callImportLlm(systemPrompt: string, userContent: ChatContentPart[]): Promise<string> {
  const userText = await buildPlainTextPromptFromParts(userContent);
  const maxOut = getLlmMaxOutputTokens();

  const { text, finishReason } = await llmGenerateContent({
    systemInstruction: systemPrompt,
    userText,
    maxOutputTokens: maxOut,
    temperature: 0.1,
    responseMimeType: 'application/json',
  });

  if (finishReason === 'MAX_TOKENS') {
    throw new Error(
      `A IA cortou a resposta (limite de saída). Defina LLM_MAX_OUTPUT_TOKENS=32000 no .env, reinicie o servidor, ou importe ficheiros menores.`,
    );
  }

  return text;
}
