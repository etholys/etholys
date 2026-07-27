# ETHOLYS Lab — ANVIL (agente de engenharia interno)

**Versão:** 0.1  
**Data:** 2026-07-27  
**Status:** F0–F1 em código (projetos, políticas, chat agente, membros, deploy targets)  
**Público:** admin Etholys / agentes de IA  

**Fonte de verdade** para o desenvolvedor de código interno (estilo Cursor/Abacus), exclusivo do Lab.  
**Entrada para agentes:** [AGENTS.md](../../AGENTS.md) → este ficheiro.

---

## 1. Princípio

> **Um runtime, um agente por projeto.** Contextos e regras de IP nunca se misturam.

ANVIL não é produto licenciado aos clientes. Vive em `/lab/anvil`, atrás de allowlist de owners + convites.

| Peça | Papel |
|------|--------|
| **Runtime** | LLM, APIs, UI, convites, audit |
| **Projeto** | Unidade de trabalho (Etholys, OSS, externo) |
| **Agente** | 1:1 com projeto — memória e regras desse contexto |
| **Deploy target** | preview / staging / Contabo / custom — escolhido por fase |
| **Reuse policy** | O que o agente pode e não pode tocar |

---

## 2. Tipos de projeto

| `relation` | `visibility` | Workspace | Uso típico |
|------------|--------------|-----------|------------|
| `etholys_core` | `private` | monorepo Etholys | Features / módulos internos |
| `standalone` | `private` | repo/sandbox externo | Software comercial externo |
| `consumes_etholys_api` | `public_oss` | repo público | UNICEF/OSS: app fina + API Etholys |
| `whitelabel_instance` | `private` | config + branding | Instância comercial Etholys |

### Regra OSS / UNICEF

- Projeto `public_oss` **nunca** lê o monorepo privado.
- Reuso Etholys = API/SDK público ou pacotes OSS aprovados em `allowedReuse`.
- Whitelabel premium continua em projeto `etholys_core` / `whitelabel_instance` separado.

---

## 3. Acesso

1. **Owners** — emails em `LAB_ANVIL_OWNER_EMAILS` (CSV). Criam projetos, convidam/revogam users, veem tudo.
2. **Membros** — `LabAnvilMember` (convite). Acedem a Anvil e só aos projetos onde são `LabAnvilProjectMember`.
3. Sem `LAB_ANVIL_OWNER_EMAILS`: bootstrap — `User.role === ADMIN` conta como owner (definir env em produção).

Lab geral (`/lab`) continua com o seu próprio gate. Anvil exige **acesso Anvil** adicional.

---

## 4. Modelo de dados

```
LabAnvilProject 1──1 LabAnvilAgent
       │
       ├── LabAnvilDeployTarget[]
       ├── LabAnvilProjectMember[]
       └── LabAnvilSession[] ── LabAnvilMessage[]

LabAnvilMember  (acesso global à ferramenta)
```

Campos-chave do projeto: `visibility`, `relation`, `workspaceKind`, `repoUrl`, `repoPath`, `allowedReuse` (JSON), `parentProjectId` (subprojetos Etholys).

---

## 5. Roadmap

| Fase | Entrega | Estado |
|------|---------|--------|
| **F0** | Spec + Prisma + access + CRUD projetos/targets/membros | ✅ |
| **F1** | Chat por agente + system prompt com política + planos/artefactos | ✅ |
| **F2** | Sandbox de ficheiros + preview URL | Pendente |
| **F3** | Deploy Contabo / custom por target | Pendente |
| **F4** | Git branch/PR no monorepo Etholys | Pendente |
| **F5** | Extração assistida “para OSS” (sugerir API/pacote) | Pendente |

---

## 6. Onde está no código

```
apps/web/
  app/lab/anvil/           # UI
  app/api/lab/anvil/       # APIs
  lib/lab-anvil/           # access, policy, prompts, agent
  prisma/schema.prisma     # LabAnvil*
  prisma/migrations/manual_lab_anvil.sql
```

---

## 7. Env

```
LAB_ANVIL_OWNER_EMAILS="admin@etholys.com"
```
