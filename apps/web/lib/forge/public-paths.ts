/** Rotas FORGE acessíveis sem sessão (convite, activar). */
export function isPublicForgePath(pathname: string): boolean {
  return (
    pathname.startsWith('/hub/forge/activar') ||
    pathname.startsWith('/hub/forge/entrar')
  );
}
