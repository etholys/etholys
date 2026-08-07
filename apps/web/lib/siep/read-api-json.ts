/**
 * Lê JSON de uma Response sem rebentar com HTML de proxy (502/504).
 */
export async function readApiJson<T = Record<string, unknown>>(
  res: Response,
): Promise<{ data: T; rawText: string }> {
  const rawText = await res.text();
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { data: {} as T, rawText };
  }
  try {
    return { data: JSON.parse(trimmed) as T, rawText };
  } catch {
    const looksHtml = trimmed.startsWith('<!') || trimmed.toLowerCase().startsWith('<html');
    if (looksHtml || res.status >= 500) {
      throw new Error(
        res.status === 502 || res.status === 504
          ? `Servidor indisponível (${res.status}). Tente novamente em alguns segundos.`
          : `Resposta inválida do servidor (${res.status}). Tente novamente.`,
      );
    }
    throw new Error(`Resposta inválida do servidor (${res.status}).`);
  }
}

export function apiErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const err = (data as { error?: unknown }).error;
    if (typeof err === 'string' && err.trim()) return err;
  }
  return fallback;
}
