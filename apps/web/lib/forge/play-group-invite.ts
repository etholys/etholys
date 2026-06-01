/** URL pública para empreendedores entrarem num grupo/empresa. */
export function buildPlayGroupInviteUrl(inviteToken: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    process.env.FORGE_PUBLIC_URL?.replace(/\/$/, '') ||
    'https://forge.etholys.com';
  return `${base}/hub/forge/entrar-grupo?token=${encodeURIComponent(inviteToken)}`;
}
