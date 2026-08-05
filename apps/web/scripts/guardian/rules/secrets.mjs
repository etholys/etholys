const EXAMPLE_FILE = /\.(example|sample|template|dist)$/i;

const SECRET_FILES = [
  { pattern: /(^|\/)\.env$/, label: 'ficheiro .env' },
  { pattern: /(^|\/)\.env\.(local|development|dev|production|prod|staging|test)$/, label: 'ficheiro .env de ambiente' },
  { pattern: /\.pem$/, label: 'certificado/chave PEM' },
  { pattern: /\.(p12|pfx|jks|keystore)$/, label: 'keystore' },
  { pattern: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/, label: 'chave SSH privada' },
  { pattern: /(^|\/)service[-_]?account.*\.json$/i, label: 'service account de cloud' },
  { pattern: /(^|\/)credentials\.json$/i, label: 'ficheiro de credenciais' },
  { pattern: /\.key$/, label: 'chave privada' },
];

const HIGH_CONFIDENCE_PATTERNS = [
  { id: 'db-url-password', re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@'"`]+:([^\s:@'"`]{6,})@/g, label: 'URL de base de dados com password' },
  { id: 'openai-key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, label: 'chave de API OpenAI' },
  { id: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, label: 'chave de API Anthropic' },
  { id: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g, label: 'chave de API Google' },
  { id: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}/g, label: 'token GitHub' },
  { id: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g, label: 'token Slack' },
  { id: 'aws-key', re: /\bAKIA[0-9A-Z]{16}\b/g, label: 'access key AWS' },
  { id: 'private-key-block', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g, label: 'bloco de chave privada' },
  { id: 'sendgrid-key', re: /\bSG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, label: 'chave SendGrid' },
  { id: 'stripe-key', re: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/g, label: 'chave secreta Stripe (live)' },
];

const ASSIGNMENT_PATTERN =
  /\b(api[-_]?key|secret|secret[-_]?key|password|passwd|pwd|token|client[-_]?secret|auth[-_]?token|private[-_]?key)\b\s*[:=]\s*["'`]([^"'`\n]{8,})["'`]/gi;

const PLACEHOLDER_VALUE =
  /^(?:x{3,}|\*{3,}|\.{3,}|<[^>]*>|\$\{[^}]*\}|%[^%]+%|change[-_ ]?me|your[-_ ]?\w+|my[-_ ]?\w+|todo|tbd|example|placeholder|dummy|fake|sample|test|password|secret|senha|contrasena|contraseña|null|undefined|true|false|none|empty|string|number|boolean|\d+|[a-z]+\.(?:example|test|local)|sk-\.\.\.|redacted|[\w-]*magic[\w-]*|n\/a|unused|not[-_]?used)$/i;

/** Passwords por omissão: não são "segredos vazados", são contas fáceis de adivinhar. */
const DEFAULT_PASSWORD =
  /\b(?:password|passwd|pwd|senha|contrase(?:n|ñ)a)\b\s*[:=]\s*["'`]((?:temp|tmp|test|admin|user|demo|pass|senha|1234|abcd|etholys|changeme)[^"'`\n]{0,20})["'`]/gi;

const NON_SECRET_CONTEXT = /process\.env|import\.meta\.env|getenv|Deno\.env|\bz\.string\(\)|\btype\b|\binterface\b|@param|label:|placeholder=/i;

const TEST_OR_DOC = /(?:^|\/)(?:tests?|e2e|__tests__|docs|examples?)\//i;

function redact(value) {
  const trimmed = value.trim();
  const head = trimmed.slice(0, 4);
  return `${head}… (${trimmed.length} chars)`;
}

export default {
  id: 'secrets',
  title: 'Segredos e credenciais',
  run(ctx) {
    const findings = [];

    for (const rel of ctx.tracked) {
      if (EXAMPLE_FILE.test(rel) || ctx.isIgnored(rel)) continue;
      const match = SECRET_FILES.find((f) => f.pattern.test(rel));
      if (!match) continue;
      findings.push({
        severity: 'critical',
        file: rel,
        key: `tracked:${rel}`,
        message: `${match.label} está versionado no git ("${rel}"). Quem tiver acesso ao repositório (ou ao histórico, mesmo depois de apagar) fica com as credenciais.`,
        hint: 'Remover do índice (git rm --cached), rodar TODAS as credenciais que estavam lá dentro, e reescrever histórico se o repo for/ficar público.',
      });
    }

    for (const rel of ctx.scannable) {
      if (EXAMPLE_FILE.test(rel)) continue;
      const isTestOrDoc = TEST_OR_DOC.test(rel);
      const onDisk = ctx.read(rel);
      const content = onDisk || ctx.readFromGit(rel);
      if (!content) continue;

      for (const { id, re, label } of HIGH_CONFIDENCE_PATTERNS) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(content)) !== null) {
          const value = m[1] ?? m[0];
          if (PLACEHOLDER_VALUE.test(value.trim())) continue;
          findings.push({
            severity: isTestOrDoc ? 'medium' : 'critical',
            file: rel,
            line: ctx.lineOf(content, m.index),
            key: `${id}:${rel}`,
            message: `Possível ${label} escrita diretamente no ficheiro: ${redact(value)}`,
            hint: 'Mover para variável de ambiente / gestor de segredos e rodar a credencial exposta.',
          });
          break; // um achado por padrão/ficheiro é suficiente para agir
        }
      }

      if (isTestOrDoc) continue;

      DEFAULT_PASSWORD.lastIndex = 0;
      const defaults = [...content.matchAll(DEFAULT_PASSWORD)];
      const defaultValues = new Set(defaults.map((d) => d[1]));
      for (const d of defaults) {
        findings.push({
          severity: 'high',
          file: rel,
          line: ctx.lineOf(content, d.index),
          key: `default-password:${rel}`,
          message: `Password por omissão previsível no código ("${d[1]}") — contas criadas assim ficam abertas a quem conhecer o padrão.`,
          hint: 'Gerar password aleatória por conta (crypto.randomBytes) e obrigar a definir nova no primeiro login, ou usar apenas convite por link com token.',
        });
        break;
      }

      ASSIGNMENT_PATTERN.lastIndex = 0;
      let a;
      const seen = new Set();
      while ((a = ASSIGNMENT_PATTERN.exec(content)) !== null) {
        const [full, name, value] = a;
        if (PLACEHOLDER_VALUE.test(value.trim())) continue;
        if (defaultValues.has(value)) continue; // já reportado como password por omissão
        if (NON_SECRET_CONTEXT.test(full)) continue;
        const lineStart = content.lastIndexOf('\n', a.index) + 1;
        const lineEnd = content.indexOf('\n', a.index);
        const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
        if (NON_SECRET_CONTEXT.test(line)) continue;
        const dedupe = `${name.toLowerCase()}:${value.slice(0, 6)}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        findings.push({
          severity: 'high',
          file: rel,
          line: ctx.lineOf(content, a.index),
          key: `hardcoded:${rel}:${name.toLowerCase()}`,
          message: `Valor sensível ("${name}") escrito no código: ${redact(value)}`,
          hint: 'Ler de process.env e validar no arranque; nunca fixar no código.',
        });
      }
    }

    return findings;
  },
};
