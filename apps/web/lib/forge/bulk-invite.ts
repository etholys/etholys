/** Parse CSV/texto: email por línea o email,nombre */
export function parseBulkInviteInput(raw: string): { email: string; name?: string }[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: { email: string; name?: string }[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const parts = line.split(/[,;\t]/).map((p) => p.trim());
    const email = (parts[0] ?? '').toLowerCase();
    if (!email.includes('@')) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ email, name: parts[1] || undefined });
  }
  return out;
}
