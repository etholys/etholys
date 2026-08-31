/** Lê resposta de API Studio — evita crash quando o servidor devolve HTML (502/504/login). */
export async function parseStudioApiResponse<T extends Record<string, unknown>>(
  res: Response,
): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  const raw = await res.text();
  if (!raw.trim()) return {} as T;

  const looksJson =
    contentType.includes('application/json') ||
    raw.trimStart().startsWith('{') ||
    raw.trimStart().startsWith('[');

  if (looksJson) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(
        raw.includes('<!DOCTYPE')
          ? `Servidor devolveu HTML em vez de JSON (HTTP ${res.status}).`
          : `Resposta inválida (HTTP ${res.status}).`,
      );
    }
  }

  if (raw.includes('<!DOCTYPE') || raw.includes('<html')) {
    if (res.status === 504 || res.status === 524) {
      throw new Error('Tempo esgotado — tenta um brief mais curto ou sem imagens automáticas.');
    }
    throw new Error(
      `Erro do servidor (HTTP ${res.status}). Recarrega a página e tenta de novo.`,
    );
  }

  throw new Error(raw.slice(0, 240) || `Erro HTTP ${res.status}`);
}
