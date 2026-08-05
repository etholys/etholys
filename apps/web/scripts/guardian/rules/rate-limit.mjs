const RATE_LIMIT_SIGNALS = /rateLimit|ratelimit|rate_limit|Ratelimit|limiter|throttle|429|TOO_MANY_REQUESTS/;

const SENSITIVE_GROUPS = [
  {
    id: 'credenciais',
    severity: 'high',
    test: (p) => /\/(login|register|signup|signin|password|reset|forgot|otp|magic|activar|entrar|invite|convite)\b/.test(p),
    why: 'permite tentativas ilimitadas de adivinhar passwords ou tokens de convite (força bruta)',
  },
  {
    id: 'ia-llm',
    severity: 'medium',
    test: (p) => /\/(ai|llm|nexus|advisor|generate|chat|ollama)\b/.test(p),
    why: 'permite consumir o modelo sem limite (custo e negação de serviço)',
  },
  {
    id: 'email',
    severity: 'high',
    test: (p) => /\/(email|mail|send|notify|invitations?)\b/.test(p),
    why: 'permite usar o sistema para enviar emails em massa (spam em vosso nome)',
  },
  {
    id: 'upload',
    severity: 'medium',
    test: (p) => /\/(upload|import|files?|documents?|ocr|pdf)\b/.test(p),
    why: 'permite esgotar disco/CPU com ficheiros grandes ou repetidos',
  },
  {
    id: 'partilha-publica',
    severity: 'high',
    test: (p) => /\/(share|shared|public|verify|certificates?)\b/.test(p),
    why: 'é alcançável sem sessão e permite enumerar ids/códigos até acertar',
  },
];

export default {
  id: 'rate-limit',
  title: 'Limites de pedidos (força bruta, abuso, custo)',
  run(ctx) {
    const findings = [];

    const hasAnyLimiter = ctx.scannable.some(
      (rel) => rel.startsWith('apps/web/lib/') && RATE_LIMIT_SIGNALS.test(ctx.read(rel)),
    );

    if (!hasAnyLimiter) {
      findings.push({
        severity: 'high',
        file: 'apps/web/lib',
        key: 'no-rate-limit-infra',
        message: 'Não existe nenhum mecanismo de rate limiting no projeto: qualquer endpoint aceita pedidos ilimitados do mesmo IP/utilizador.',
        hint: 'Criar lib/rate-limit.ts (memória para dev, Redis/Upstash para produção) e aplicar primeiro no login, convites, envio de email e rotas de IA.',
      });
    }

    const perGroup = new Map();
    for (const { file, urlPath } of ctx.apiRoutes) {
      const content = ctx.read(file);
      if (!content || RATE_LIMIT_SIGNALS.test(content)) continue;
      const group = SENSITIVE_GROUPS.find((g) => g.test(urlPath));
      if (!group) continue;
      if (!perGroup.has(group.id)) perGroup.set(group.id, { group, routes: [] });
      perGroup.get(group.id).routes.push(urlPath);
    }

    for (const { group, routes } of perGroup.values()) {
      findings.push({
        severity: group.severity,
        file: 'apps/web/app/api',
        key: `no-rate-limit:${group.id}`,
        message: `${routes.length} rota(s) do grupo "${group.id}" não têm limite de pedidos — ${group.why}. Exemplos: ${routes
          .slice(0, 5)
          .join(', ')}${routes.length > 5 ? ` (+${routes.length - 5})` : ''}.`,
        hint: 'Aplicar o limitador por IP + por utilizador nestas rotas e devolver 429 com Retry-After.',
        details: routes,
      });
    }

    return findings;
  },
};
