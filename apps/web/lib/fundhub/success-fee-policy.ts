/** F9 — success fee só em consultoria privada. Proibido em conta pública. */

const PUBLIC_ENTITY =
  /universidad|university|minister|gobierno|government|municip|publica|publico|ong govern|programa public|estado\b/i;

export function successFeeAllowed(entityType?: string | null, notes?: string | null): boolean {
  const hay = `${entityType ?? ''} ${notes ?? ''}`.trim();
  if (!hay) return true;
  return !PUBLIC_ENTITY.test(hay.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

export function successFeeBlockReason(
  entityType?: string | null,
  notes?: string | null,
  locale: string = 'es',
): string | null {
  if (successFeeAllowed(entityType, notes)) return null;
  if (locale === 'pt') {
    return 'Success fee não aplica a contas públicas / universidades / ministérios.';
  }
  if (locale === 'en') {
    return 'Success fee does not apply to public accounts / universities / ministries.';
  }
  return 'Success fee no aplica a cuentas públicas / universidades / ministerios.';
}
