/** Dono autenticado da página vê o calendário; qualquer outra pessoa vê a reserva. */
export function publicAgendaViewer(
  page: { ownerId: string; companyId: string } | null,
  tenant: { userId: string; companyIds: string[] } | null,
): 'owner' | 'guest' {
  if (!page || !tenant) return 'guest';
  if (page.ownerId === tenant.userId && tenant.companyIds.includes(page.companyId)) return 'owner';
  return 'guest';
}
