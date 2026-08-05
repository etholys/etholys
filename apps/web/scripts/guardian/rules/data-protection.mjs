const UPLOAD_SIGNALS = /formData\s*\(\s*\)|multipart\/form-data/;
const UPLOAD_VALIDATION = /(?:\.size\s*[<>]|MAX_(?:FILE_)?SIZE|ALLOWED_(?:MIME|TYPES|EXTENSIONS)|\.type\s*(?:===|!==|\.startsWith|\.includes)|mimetype)/i;

const WEBHOOK_SIGNATURE = /createHmac|timingSafeEqual|verifySignature|x-(?:hub-)?signature|svix|stripe-signature|WEBHOOK_SECRET/i;

const LLM_CALL = /llm-client|callLLM|chatCompletion|ollama|openai|anthropic|generateText/i;
const LLM_GUARD = /redact|anonymi[sz]e|sanitize|scrub|mask(?:Pii|Personal)|consent/i;

export default {
  id: 'data-protection',
  title: 'Proteção de dados (uploads, webhooks, IA, registo, retenção)',
  run(ctx) {
    const findings = [];

    for (const { file, urlPath } of ctx.apiRoutes) {
      const content = ctx.read(file);
      if (!content) continue;

      if (UPLOAD_SIGNALS.test(content) && !UPLOAD_VALIDATION.test(content)) {
        findings.push({
          severity: 'high',
          file,
          key: `upload-unvalidated:${urlPath}`,
          message: `A rota ${urlPath} aceita ficheiros sem validar tamanho nem tipo — permite subir executáveis/HTML malicioso ou esgotar o disco.`,
          hint: 'Validar tamanho máximo e lista de MIME types permitidos, gerar nome próprio no servidor e servir com Content-Disposition: attachment.',
        });
      }

      if (/webhook/i.test(urlPath) && !WEBHOOK_SIGNATURE.test(content)) {
        findings.push({
          severity: 'critical',
          file,
          key: `webhook-unsigned:${urlPath}`,
          message: `O webhook ${urlPath} não verifica assinatura — qualquer pessoa na internet pode enviar eventos falsos (ex.: marcar gravações, pagamentos ou estados como concluídos).`,
          hint: 'Validar HMAC com segredo partilhado usando crypto.timingSafeEqual, e rejeitar timestamps antigos (replay).',
        });
      }
    }

    const hasAuditModel = /model\s+(?:AuditLog|SecurityEvent|ActivityLog|AccessLog)\b/.test(
      ctx.read('apps/web/prisma/schema.prisma'),
    );
    if (!hasAuditModel) {
      findings.push({
        severity: 'high',
        file: 'apps/web/prisma/schema.prisma',
        key: 'no-audit-log',
        message: 'Não existe registo de auditoria (quem entrou, quem viu/alterou o quê, de que IP). Sem isto, um vazamento ou acesso indevido é impossível de detetar ou provar — e a GDPR exige poder demonstrá-lo.',
        hint: 'Criar modelo AuditLog (userId, companyId, action, resource, ip, userAgent, createdAt) e escrever nele em login, falha de login, acesso a dados sensíveis, partilha e exportação.',
      });
    }

    const hasLoginAttemptTracking = /failedLoginAttempts|lockedUntil|loginAttempt/i.test(
      ctx.read('apps/web/prisma/schema.prisma'),
    );
    if (!hasLoginAttemptTracking) {
      findings.push({
        severity: 'medium',
        file: 'apps/web/prisma/schema.prisma',
        key: 'no-login-attempt-tracking',
        message: 'Não há contagem de tentativas de login falhadas nem bloqueio temporário de conta — um atacante pode testar passwords indefinidamente.',
        hint: 'Guardar tentativas falhadas por conta/IP e bloquear temporariamente após N falhas (com alerta).',
      });
    }

    const oauthTokensStoredPlain = /model\s+Account\s*\{[\s\S]*?access_token\s+String/.test(
      ctx.read('apps/web/prisma/schema.prisma'),
    );
    if (oauthTokensStoredPlain) {
      findings.push({
        severity: 'medium',
        file: 'apps/web/prisma/schema.prisma',
        key: 'oauth-tokens-plaintext',
        message: 'Os tokens OAuth (Google/Microsoft, incluindo acesso a calendário e email) são guardados em texto simples na base de dados — quem consiga ler a base lê também as contas dos clientes.',
        hint: 'Cifrar em repouso na aplicação (AES-GCM com chave em KMS/env) ou, no mínimo, garantir cifra de disco + acesso restrito à base.',
      });
    }

    const llmRoutes = ctx.apiRoutes.filter(({ file }) => {
      const content = ctx.read(file);
      return content && LLM_CALL.test(content) && !LLM_GUARD.test(content);
    });
    if (llmRoutes.length > 0) {
      findings.push({
        severity: 'medium',
        file: 'apps/web/lib/llm-client.ts',
        key: 'llm-no-pii-guard',
        message: `${llmRoutes.length} rota(s) enviam conteúdo para o modelo de IA sem qualquer passo de anonimização/consentimento. Se o provider for externo, dados pessoais de clientes saem da vossa infraestrutura.`,
        hint: 'Definir política explícita: o que pode ir para o LLM, redigir identificadores diretos, registar consentimento e preferir modelo self-hosted para dados sensíveis.',
        details: llmRoutes.map((r) => r.urlPath).slice(0, 20),
      });
    }

    const hasRetentionPolicy = ctx.scannable.some((rel) =>
      /retention|anonymi[sz]e|right-to-be-forgotten|gdpr|rgpd/i.test(rel),
    );
    if (!hasRetentionPolicy) {
      findings.push({
        severity: 'low',
        file: 'apps/web',
        key: 'no-retention-policy',
        message: 'Não há sinal de política de retenção nem de mecanismo de apagar/anonimizar dados de um utilizador ou empresa (direito ao esquecimento).',
        hint: 'Documentar prazos de retenção e implementar apagamento/anonimização por empresa e por utilizador, incluindo backups.',
      });
    }

    return findings;
  },
};
