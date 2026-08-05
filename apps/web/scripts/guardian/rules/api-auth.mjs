/** Sinais de que a rota valida quem está a chamar (sessão, token de convite, segredo de cron, assinatura). */
const AUTH_SIGNALS = [
  /getServerSession/,
  /getToken\s*\(/,
  /requireAuth/,
  /getUserCompanyIds/,
  /resolveForge(?:Access|JwtScope)/,
  /resolveWorkspace(?:Access|JwtScope)/,
  /resolveStudio(?:Access|JwtScope)/,
  /findShareByMagicToken/,
  /findEnrollmentByMagicToken/,
  /verifyMagicToken/,
  /magicToken/i,
  /inviteToken/i,
  /shareToken/i,
  /accessToken/,
  /CRON_SECRET/,
  /INTERNAL_API_KEY/,
  /x-internal-secret/i,
  /createHmac/,
  /timingSafeEqual/,
  /isPlatformAdmin/,
  /requirePlatformAdmin/,
  /assertCompanyAccess/,
  /auth\(\)/,
];

/** Rotas públicas por desenho. Manter esta lista curta e justificada. */
const INTENTIONALLY_PUBLIC = [
  { prefix: '/api/auth', why: 'NextAuth' },
  { prefix: '/api/health', why: 'healthcheck' },
  { prefix: '/api/llm-health', why: 'healthcheck' },
  { prefix: '/api/ollama-health', why: 'healthcheck (alias legado)' },
  { prefix: '/api/forge/certificates/verify', why: 'verificação pública de certificado' },
  { prefix: '/api/signup', why: 'registo de conta (protegido por código de convite)' },
];

const HANDLER_EXPORT = /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

export function hasAuthSignal(content, ctx) {
  if (AUTH_SIGNALS.some((re) => re.test(content))) return true;
  // Guardas de acesso definidos em lib/ (ex.: requireForgeTenant -> getUserCompanyIds -> getServerSession).
  for (const name of ctx?.authGuardNames ?? []) {
    if (new RegExp(`\\b${name}\\s*\\(`).test(content)) return true;
  }
  return false;
}

export function isIntentionallyPublic(urlPath) {
  return INTENTIONALLY_PUBLIC.find((p) => urlPath === p.prefix || urlPath.startsWith(`${p.prefix}/`));
}

export default {
  id: 'api-auth',
  title: 'Autenticação nas rotas de API',
  run(ctx) {
    const findings = [];

    for (const { file, urlPath } of ctx.apiRoutes) {
      if (isIntentionallyPublic(urlPath)) continue;
      const content = ctx.read(file);
      if (!content) continue;
      if (hasAuthSignal(content, ctx)) continue;

      HANDLER_EXPORT.lastIndex = 0;
      const methods = [...content.matchAll(HANDLER_EXPORT)].map((m) => m[1]);
      if (methods.length === 0) continue;

      const touchesTenantData = [...ctx.tenantDelegates.keys()].some((delegate) =>
        content.includes(`prisma.${delegate}.`),
      );
      const mutates = methods.some((m) => m !== 'GET');

      findings.push({
        severity: touchesTenantData ? 'critical' : mutates ? 'high' : 'medium',
        file,
        key: `no-auth:${urlPath}`,
        message: `A rota ${urlPath} (${methods.join(', ')}) não verifica sessão nem token de acesso${
          touchesTenantData ? ' e lê/escreve dados de empresas na base de dados' : ''
        }.`,
        hint: 'Adicionar getServerSession/requireAuth no início do handler e devolver 401 quando não houver sessão. Se for pública de propósito, registar em INTENTIONALLY_PUBLIC com justificação.',
      });
    }

    return findings;
  },
};
