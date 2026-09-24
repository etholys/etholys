/** F9 — success fee só em consultoria privada. Proibido em conta pública. */

const PUBLIC_ENTITY =
  /universidad|university|minister|gobierno|government|municip|publica|publico|ong govern|programa public|estado\b/i;

export function successFeeAllowed(entityType?: string | null, notes?: string | null): boolean {
  const hay = `${entityType ?? ''} ${notes ?? ''}`.trim();
  if (!hay) return true;
  return !PUBLIC_ENTITY.test(hay.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}
