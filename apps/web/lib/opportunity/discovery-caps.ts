/**
 * Caps de yield da descoberta FundHub.
 *
 * Modo teste (default): sem tecto artificial — o briefing/filtro manda;
 * devolvemos todos os candidatos que passam filtros oficiais.
 * Produção / custo: definir FUNDHUB_DISCOVERY_UNLIMITED=0 e opcionalmente
 * FUNDHUB_MAX_NORMALIZE / FUNDHUB_MAX_ENRICH / FUNDHUB_MAX_PACKS.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** true = não cortar listas após filtros (recomendado enquanto medimos preço/cobertura). */
export function isDiscoveryUnlimited(): boolean {
  const flag = process.env.FUNDHUB_DISCOVERY_UNLIMITED?.trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return false;
  if (flag === '1' || flag === 'true' || flag === 'on') return true;
  // Default: solto (teste / construção de produto). Produção deve setar =0.
  return true;
}

/** Quantos candidatos normalizar a partir do JSON do LLM (antes do enrich). */
export function maxNormalizeCandidates(): number {
  if (isDiscoveryUnlimited()) return envInt('FUNDHUB_MAX_NORMALIZE', 500);
  return envInt('FUNDHUB_MAX_NORMALIZE', 48);
}

/** Quantos candidatar a enrich HTTP/PDF (custo de rede). Unlimited = todos os normalizados. */
export function maxEnrichCandidates(): number {
  if (isDiscoveryUnlimited()) return envInt('FUNDHUB_MAX_ENRICH', 500);
  return envInt('FUNDHUB_MAX_ENRICH', 24);
}

/** Packs de query a correr (1–3). Unlimited → os 3 (inclui official). */
export function maxDiscoveryPacks(): number {
  if (isDiscoveryUnlimited()) return envInt('FUNDHUB_MAX_PACKS', 3);
  return envInt('FUNDHUB_MAX_PACKS', 3);
}

/** Texto do prompt: alvo de quantidade (não é hard cap de código). */
export function discoveryYieldPromptHint(): string {
  if (isDiscoveryUnlimited()) {
    return 'Return EVERY distinct matching call you can verify from the research — no artificial upper limit. Prefer complete JSON. Skip duplicates and EXISTING only.';
  }
  return 'Return 12–24 candidates from DISTINCT institutions when they exist. Prefer complete JSON over long essays.';
}
