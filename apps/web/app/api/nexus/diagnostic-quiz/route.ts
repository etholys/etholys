import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { NEXUS_DIAGNOSTIC_QUIZ, parseDiagnosticSectorsJson } from '@/lib/nexus-diagnostic-quiz';

export const dynamic = 'force-dynamic';

/**
 * Lê `apps/web/data/nexus-diagnostic/quiz.json` se existir (array `sectors` ou raiz = array).
 * Caso contrário devolve o questionário embutido.
 */
export async function GET() {
  const filePath = path.join(process.cwd(), 'data', 'nexus-diagnostic', 'quiz.json');
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const arr = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && 'sectors' in parsed
        ? (parsed as { sectors: unknown }).sectors
        : null;
    const sectors = parseDiagnosticSectorsJson(arr);
    if (sectors && sectors.length > 0) {
      return NextResponse.json({ sectors, source: 'file' as const });
    }
  } catch {
    // ficheiro ausente ou JSON inválido
  }
  return NextResponse.json({ sectors: NEXUS_DIAGNOSTIC_QUIZ, source: 'default' as const });
}
