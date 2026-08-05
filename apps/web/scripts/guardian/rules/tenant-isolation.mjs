import { hasAuthSignal, isIntentionallyPublic } from './api-auth.mjs';

const READ_WRITE_OPS = ['findMany', 'findFirst', 'findUnique', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate'];

/** prisma.<delegate>.<op>( — captura o delegate e a operação usados na rota. */
const PRISMA_CALL = /prisma\.(\w+)\.(\w+)\s*\(/g;

/** findUnique/findFirst({ where: { id: ... } }) sem mais nada é o padrão clássico de IDOR. */
const LOOKUP_BY_ID_ONLY = /\.(findUnique|findFirst|update|delete)\s*\(\s*\{\s*where:\s*\{\s*id:\s*[^}]{1,80}\}\s*[,}]/g;

export default {
  id: 'tenant-isolation',
  title: 'Isolamento entre empresas (multi-tenant)',
  run(ctx) {
    const findings = [];

    for (const { file, urlPath } of ctx.apiRoutes) {
      if (isIntentionallyPublic(urlPath)) continue;
      const content = ctx.read(file);
      if (!content) continue;

      PRISMA_CALL.lastIndex = 0;
      const tenantCalls = new Map();
      let m;
      while ((m = PRISMA_CALL.exec(content)) !== null) {
        const [, delegate, op] = m;
        const model = ctx.tenantDelegates.get(delegate);
        if (!model || !READ_WRITE_OPS.includes(op)) continue;
        if (!tenantCalls.has(delegate)) tenantCalls.set(delegate, { model, ops: new Set(), index: m.index });
        tenantCalls.get(delegate).ops.add(op);
      }
      if (tenantCalls.size === 0) continue;

      const scopesByCompany = /companyId/.test(content);
      // Link de partilha/convite: o token aleatório é a própria credencial (capability URL).
      const scopesByCapabilityToken = /where:\s*\{[^}]*\b(?:token|magicLoginToken|code|inviteCode|roomCode)\b/.test(
        content,
      );

      if (!scopesByCompany && scopesByCapabilityToken) {
        findings.push({
          severity: 'medium',
          file,
          key: `capability-token-scope:${urlPath}`,
          message: `A rota ${urlPath} dá acesso a dados apenas com base num token/código no pedido, sem verificar empresa nem sessão. Quem obtiver o link (encaminhado, histórico de browser, logs) fica com o acesso.`,
          hint: 'Garantir token aleatório longo, prazo de validade, uso limitado, confirmação do email destinatário e limite de tentativas.',
        });
        continue;
      }

      if (!scopesByCompany) {
        const models = [...tenantCalls.values()].map((v) => v.model);
        findings.push({
          severity: hasAuthSignal(content, ctx) ? 'high' : 'critical',
          file,
          key: `no-company-scope:${urlPath}`,
          message: `A rota ${urlPath} consulta dados de empresa (${models.slice(0, 4).join(', ')}${
            models.length > 4 ? `, +${models.length - 4}` : ''
          }) sem filtrar por companyId — um utilizador de uma empresa pode conseguir ver/alterar dados de outra.`,
          hint: 'Obter companyIds do utilizador (getUserCompanyIds) e incluir companyId: { in: companyIds } em todos os where.',
        });
        continue;
      }

      LOOKUP_BY_ID_ONLY.lastIndex = 0;
      const idOnly = [...content.matchAll(LOOKUP_BY_ID_ONLY)];
      if (idOnly.length > 0) {
        findings.push({
          severity: 'medium',
          file,
          key: `id-only-lookup:${urlPath}`,
          message: `A rota ${urlPath} busca registos apenas por id (${idOnly.length}x) — confirmar que o companyId do utilizador é validado antes de devolver ou alterar o registo.`,
          hint: 'Preferir where: { id, companyId: { in: companyIds } } em vez de where: { id } seguido de verificação manual (ou garantir a verificação explícita imediatamente depois).',
        });
      }
    }

    return findings;
  },
};
