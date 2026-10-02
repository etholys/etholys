/**
 * Caps de yield da descoberta FundHub.
 *
 * Limite principal em produção de teste: FUNDHUB_SCAN_BUDGET_USD (default $1)
 * + cooldown de hosts FUNDHUB_SOURCE_COOLDOWN_DAYS (default 7).
 * Sem tecto artificial de quantidade de candidatos quando unlimited.
 *
 * Produção com orçamento apertado: FUNDHUB_DISCOVERY_UNLIMITED=0 e opcionalmente
 * FUNDHUB_MAX_NORMALIZE / FUNDHUB_MAX_ENRICH / FUNDHUB_MAX_PACKS /
 * FUNDHUB_MAX_PER_INSTITUTION.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** true = não cortar listas após filtros (recomendado). */
export function isDiscoveryUnlimited(): boolean {
  const flag = process.env.FUNDHUB_DISCOVERY_UNLIMITED?.trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return false;
  if (flag === '1' || flag === 'true' || flag === 'on') return true;
  // Default: solto — filtro da empresa, não quantidade.
  return true;
}

/** Quantos candidatos normalizar a partir do JSON do LLM (antes do enrich). */
export function maxNormalizeCandidates(): number {
  if (isDiscoveryUnlimited()) {
    // Sem tecto prático — só safety contra payloads absurdos.
    return envInt('FUNDHUB_MAX_NORMALIZE', 50_000);
  }
  return envInt('FUNDHUB_MAX_NORMALIZE', 48);
}

/** Quantos candidatar a enrich HTTP/PDF. Unlimited = todos os normalizados. */
export function maxEnrichCandidates(): number {
  if (isDiscoveryUnlimited()) {
    return envInt('FUNDHUB_MAX_ENRICH', 50_000);
  }
  return envInt('FUNDHUB_MAX_ENRICH', 24);
}

/** Packs de query a correr (1–3). Unlimited → os 3 (inclui official). */
export function maxDiscoveryPacks(): number {
  if (isDiscoveryUnlimited()) return envInt('FUNDHUB_MAX_PACKS', 3);
  return envInt('FUNDHUB_MAX_PACKS', 3);
}

/**
 * Máx. por instituição (diversidade). Unlimited → sem corte por doador
 * (o filtro do briefing continua a mandar).
 */
export function maxPerInstitution(): number {
  if (isDiscoveryUnlimited()) {
    return envInt('FUNDHUB_MAX_PER_INSTITUTION', 50_000);
  }
  return envInt('FUNDHUB_MAX_PER_INSTITUTION', 4);
}

/** Texto do prompt: alvo de quantidade (não é hard cap de código). */
export function discoveryYieldPromptHint(): string {
  if (isDiscoveryUnlimited()) {
    return 'Return EVERY distinct matching call you can verify from the research — no artificial upper limit on total OR per funder when they match the briefing. Prefer complete JSON. Skip duplicates and EXISTING only.';
  }
  return 'Return 12–24 candidates from DISTINCT institutions when they exist. Prefer complete JSON over long essays.';
}
