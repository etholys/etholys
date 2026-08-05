const NEXT_CONFIG = 'apps/web/next.config.js';
const MIDDLEWARE = 'apps/web/middleware.ts';
const AUTH_OPTIONS = 'apps/web/lib/auth-options.ts';

const REQUIRED_HEADERS = [
  {
    name: 'Content-Security-Policy',
    severity: 'high',
    why: 'Sem CSP, qualquer XSS consegue carregar scripts externos e exfiltrar dados/sessões.',
  },
  {
    name: 'Strict-Transport-Security',
    severity: 'high',
    why: 'Sem HSTS, o browser aceita voltar a HTTP e a sessão pode ser interceptada.',
  },
  {
    name: 'X-Frame-Options',
    severity: 'high',
    why: 'Sem isto (ou frame-ancestors), a app pode ser embutida noutro site para clickjacking.',
  },
  {
    name: 'X-Content-Type-Options',
    severity: 'medium',
    why: 'Evita que o browser adivinhe o tipo de conteúdo (upload malicioso servido como script).',
  },
  {
    name: 'Referrer-Policy',
    severity: 'medium',
    why: 'Impede fuga de URLs internos (com ids) para sites externos.',
  },
  {
    name: 'Permissions-Policy',
    severity: 'low',
    why: 'Restringe câmara/microfone/geolocalização ao que o produto precisa.',
  },
];

export default {
  id: 'platform-hardening',
  title: 'Configuração da plataforma (headers, sessão, guardas)',
  run(ctx) {
    const findings = [];

    const nextConfig = ctx.read(NEXT_CONFIG);
    const middleware = ctx.read(MIDDLEWARE);
    const headerSources = `${nextConfig}\n${middleware}`;

    for (const header of REQUIRED_HEADERS) {
      if (headerSources.includes(header.name)) continue;
      findings.push({
        severity: header.severity,
        file: NEXT_CONFIG,
        key: `missing-header:${header.name}`,
        message: `O header de segurança ${header.name} não é enviado em nenhuma resposta. ${header.why}`,
        hint: 'Definir em next.config.js com async headers() (ou no middleware) para todas as rotas.',
      });
    }

    if (nextConfig.includes('ignoreDuringBuilds: true')) {
      findings.push({
        severity: 'low',
        file: NEXT_CONFIG,
        key: 'eslint-ignored-in-build',
        message: 'O build ignora erros de ESLint (ignoreDuringBuilds: true), incluindo regras que apanham padrões inseguros.',
        hint: 'Reativar quando o lint estiver limpo, ou pelo menos correr lint no CI.',
      });
    }

    const authOptions = ctx.read(AUTH_OPTIONS);
    if (authOptions) {
      if (!/maxAge/.test(authOptions)) {
        findings.push({
          severity: 'medium',
          file: AUTH_OPTIONS,
          key: 'session-no-maxage',
          message: 'A sessão JWT não define maxAge — fica com o prazo por omissão (30 dias) e não há forma de forçar re-login.',
          hint: 'Definir session: { strategy: "jwt", maxAge, updateAge } com um prazo alinhado com o risco (ex.: 8h–7d).',
        });
      }

      if (/allowDangerousEmailAccountLinking:\s*true/.test(authOptions)) {
        findings.push({
          severity: 'high',
          file: AUTH_OPTIONS,
          key: 'dangerous-account-linking',
          message: 'allowDangerousEmailAccountLinking está ativo: uma conta social com o mesmo email liga-se automaticamente a uma conta existente, o que permite tomada de conta se o provider não verificar o email.',
          hint: 'Desligar, ou só permitir para providers que garantem email verificado e depois de confirmar o email na base de dados.',
        });
      }

      if (!/emailVerified|email_verified/.test(authOptions)) {
        findings.push({
          severity: 'medium',
          file: AUTH_OPTIONS,
          key: 'no-email-verified-check',
          message: 'O login social não verifica se o email vem confirmado pelo provider (email_verified).',
          hint: 'No callback signIn, rejeitar contas sem email verificado antes de ligar a utilizadores existentes.',
        });
      }

      if (/secret:\s*process\.env\.NEXTAUTH_SECRET\s*[,}]/.test(authOptions)) {
        findings.push({
          severity: 'medium',
          file: AUTH_OPTIONS,
          key: 'secret-not-validated',
          message: 'NEXTAUTH_SECRET é usado sem validação no arranque — se faltar em produção, as sessões passam a ser assináveis de forma previsível/instável.',
          hint: 'Validar variáveis de ambiente obrigatórias no arranque e falhar cedo (ex.: schema zod em lib/env.ts).',
        });
      }
    }

    if (middleware) {
      // Guardas que engolem exceções e deixam passar o pedido ("fail open").
      const failOpen = /catch\s*\([^)]*\)\s*\{[^}]*(?:allowing request|return null|NextResponse\.next\(\))/gs;
      failOpen.lastIndex = 0;
      const matches = [...middleware.matchAll(failOpen)];
      if (matches.length > 0) {
        findings.push({
          severity: 'high',
          file: MIDDLEWARE,
          line: ctx.lineOf(middleware, matches[0].index),
          key: 'middleware-fail-open',
          message: `O middleware tem ${matches.length} bloco(s) catch que, em caso de erro na verificação de acesso, deixam o pedido continuar (fail open). Um atacante que provoque erros nessas verificações contorna licença/scope.`,
          hint: 'Em caso de erro numa verificação de segurança, negar (401/403) e registar o evento, em vez de permitir.',
        });
      }

      if (!/\/api\//.test(middleware) || !/getToken/.test(middleware)) {
        findings.push({
          severity: 'high',
          file: MIDDLEWARE,
          key: 'middleware-no-api-auth',
          message: 'O middleware não impõe sessão para /api/* — cada uma das rotas tem de se lembrar de validar sozinha.',
          hint: 'Negar por omissão em /api/* no middleware, com uma lista explícita de rotas públicas.',
        });
      } else if (/pathname\.startsWith\('\/api\/'\)\)\s*\{\s*return NextResponse\.next\(\)/.test(middleware)) {
        findings.push({
          severity: 'high',
          file: MIDDLEWARE,
          key: 'middleware-api-open-by-default',
          message: 'Em /api/*, o middleware termina com NextResponse.next() sem exigir sessão: o modelo é "aberto por omissão" e a proteção depende de cada rota individualmente.',
          hint: 'Inverter para "fechado por omissão": exigir token em /api/*, com allowlist explícita (auth, health, convites públicos, webhooks assinados).',
        });
      }
    }

    return findings;
  },
};
