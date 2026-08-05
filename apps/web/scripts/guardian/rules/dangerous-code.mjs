const PATTERNS = [
  {
    id: 'raw-sql-unsafe',
    severity: 'critical',
    re: /\$(?:queryRawUnsafe|executeRawUnsafe)\s*\(/g,
    message: 'SQL cru sem parametrização ($queryRawUnsafe/$executeRawUnsafe) — porta de entrada clássica para SQL injection.',
    hint: 'Usar $queryRaw com template tagged (parametrizado) ou a API normal do Prisma.',
  },
  {
    id: 'eval',
    severity: 'critical',
    re: /(?<![\w.])eval\s*\(|new\s+Function\s*\(/g,
    message: 'Execução dinâmica de código (eval / new Function): se alguma parte vier de input do utilizador, é execução remota de código.',
    hint: 'Substituir por parsing explícito (JSON.parse, mapa de funções permitidas).',
  },
  {
    id: 'shell-interpolation',
    severity: 'critical',
    re: /(?:exec|execSync|spawnSync|spawn)\s*\(\s*[`'"][^`'"]*\$\{/g,
    message: 'Comando de shell construído com interpolação de variáveis — se o valor vier do utilizador, permite executar comandos no servidor.',
    hint: 'Usar execFile/spawn com array de argumentos, sem shell.',
  },
  {
    id: 'dangerously-set-inner-html',
    severity: 'medium',
    re: /dangerouslySetInnerHTML/g,
    message: 'HTML injetado diretamente no DOM (dangerouslySetInnerHTML) — risco de XSS se o conteúdo não for sanitizado.',
    hint: 'Sanitizar com DOMPurify/rehype-sanitize antes de injetar, ou renderizar como texto.',
  },
  {
    id: 'cors-wildcard',
    severity: 'high',
    re: /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*['"]/g,
    message: 'CORS aberto a qualquer origem (Access-Control-Allow-Origin: *) — outros sites podem chamar esta API a partir do browser.',
    hint: 'Restringir a origens conhecidas e nunca combinar "*" com credenciais.',
  },
  {
    id: 'tls-verification-off',
    severity: 'critical',
    re: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0|rejectUnauthorized:\s*false/g,
    message: 'Verificação de certificado TLS desligada — o tráfego pode ser interceptado sem ser detetado.',
    hint: 'Reativar a verificação e instalar a cadeia de certificados correta.',
  },
  {
    id: 'jwt-decode-without-verify',
    severity: 'high',
    re: /jwt\.decode\s*\(|decodeJwt\s*\(/g,
    message: 'Token JWT descodificado sem verificar a assinatura — o conteúdo pode ter sido forjado.',
    hint: 'Usar jwt.verify / jwtVerify com a chave correta antes de confiar nos claims.',
  },
  {
    id: 'math-random-token',
    severity: 'high',
    re: /(?:token|secret|code|password|otp|nonce|salt)\s*(?:=|:)\s*[^;\n]{0,60}Math\.random\s*\(/gi,
    message: 'Token/código de segurança gerado com Math.random(), que é previsível — dá para adivinhar convites ou links de partilha.',
    hint: 'Usar crypto.randomUUID() ou crypto.randomBytes(32).toString("base64url").',
  },
  {
    id: 'md5-sha1-secret',
    severity: 'medium',
    re: /createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/g,
    message: 'Hash fraco (MD5/SHA-1) em uso — inadequado para tokens, passwords ou verificação de integridade.',
    hint: 'Usar SHA-256 para integridade e bcrypt/argon2 para passwords.',
  },
  {
    id: 'loose-token-compare',
    severity: 'medium',
    re: /(?:secret|token|signature|hmac)\s*(?:===|==|!==|!=)\s*(?:req|request|headers|body|params|searchParams)/gi,
    message: 'Comparação de segredo/assinatura com === (vulnerável a timing attack).',
    hint: 'Usar crypto.timingSafeEqual com buffers do mesmo tamanho.',
  },
];

const SKIP = /(?:^|\/)(?:node_modules|\.next|tests?|e2e|__tests__)\//;

export default {
  id: 'dangerous-code',
  title: 'Padrões de código perigosos',
  run(ctx) {
    const findings = [];

    for (const rel of ctx.scannable) {
      if (SKIP.test(rel) || /\.(md|sql)$/.test(rel)) continue;
      const content = ctx.read(rel);
      if (!content) continue;

      for (const pattern of PATTERNS) {
        pattern.re.lastIndex = 0;
        const matches = [...content.matchAll(pattern.re)];
        if (matches.length === 0) continue;
        findings.push({
          severity: pattern.severity,
          file: rel,
          line: ctx.lineOf(content, matches[0].index),
          key: `${pattern.id}:${rel}`,
          message: `${pattern.message}${matches.length > 1 ? ` (${matches.length} ocorrências)` : ''}`,
          hint: pattern.hint,
        });
      }
    }

    return findings;
  },
};
