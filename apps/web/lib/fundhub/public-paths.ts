/** Rotas FundHub públicas (sem login). */
export function isPublicFundhubPath(pathname: string): boolean {
  return pathname.startsWith('/fundhub/share/');
}
