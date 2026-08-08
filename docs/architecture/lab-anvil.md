# ETHOLYS Lab — ANVIL (agente de engenharia interno)

**Status:** F0–F2 feito · F3 webhook Contabo/custom · ponte MUSE → ANVIL  
**Versão:** 0.3  
**Data:** 2026-08-07  
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
| **Sandbox** | Árvore de ficheiros (`LabAnvilFile`) quando `workspaceKind=sandbox` |
| **Deploy target** | preview / staging / Contabo / custom — preview F2 activo |
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

| Papel | Quem | Vê |
|-------|------|-----|
| **System admin** | Emails em `ETHOLYS_PLATFORM_ADMIN_EMAILS` | Hub completo + Lab + MUSE + ANVIL (owner) |
| **Convidado Lab** | `LabInvite` aceite | `/lab` + MUSE; ANVIL só com convite ANVIL |
| **Admin de empresa** | `CompanyUser.role=ADMIN` | Só a **sua** empresa — **não** Lab |

`User.role=ADMIN` **não** é system admin. Login normal (`/login`); o system admin vê o atalho **Lab** no Hub.

Owners ANVIL = mesma allowlist (`isSystemAdmin`). Convites de projeto: `LabAnvilProjectMember`.

---

## 4. Modelo de dados

```
LabAnvilProject 1──1 LabAnvilAgent
       │
       ├── LabAnvilDeployTarget[]   # preview configJson.token
       ├── LabAnvilFile[]           # sandbox FS (F2)
       ├── LabAnvilProjectMember[]
       └── LabAnvilSession[] ── LabAnvilMessage[]

LabAnvilMember  (acesso global à ferramenta)

MuseSuggestion.anvilProjectId ──► LabAnvilProject  (handoff MUSE)
```

Campos-chave do projeto: `visibility`, `relation`, `workspaceKind`, `repoUrl`, `repoPath`, `allowedReuse` (JSON), `parentProjectId` (subprojetos Etholys).

---

## 5. Roadmap

| Fase | Entrega | Estado |
|------|---------|--------|
| **F0** | Spec + Prisma + access + CRUD projetos/targets/membros | ✅ |
| **F1** | Chat por agente + system prompt com política + planos/artefactos | ✅ |
| **F2** | Sandbox de ficheiros + preview URL estático | ✅ (MVP) |
| **F3** | Deploy Contabo / custom por webhook | ✅ (MVP webhook) |
| **F4** | Git branch/PR no monorepo Etholys | Pendente |
| **F5** | Extração assistida “para OSS” (sugerir API/pacote) | Pendente |

### F2 — APIs

| Rota | Papel |
|------|--------|
| `GET/PUT/DELETE /api/lab/anvil/projects/[id]/files` | Listar / ler / gravar / apagar; `PUT action=apply` (+ `messageId`) |
| `POST /api/lab/anvil/projects/[id]/preview` | Gera token no target `preview`, status `live` |
| `GET /api/lab/anvil/preview/[token]/[[...path]]` | Serve ficheiros do sandbox (público via token) |

### F3 — Deploy

| Rota | Papel |
|------|--------|
| `POST /api/lab/anvil/projects/[id]/deploy` | Body `{ targetId }` — POST webhook com manifest dos ficheiros |

`configJson.webhookUrl` (+ opcional `webhookSecret`) no target `contabo` / `custom` / `staging`.

### Ponte MUSE

`POST /api/muse` com `action: implement` → `implementMuseSuggestionToAnvil` (brief no agente + sessão). Ver [lab-muse.md](./lab-muse.md).

---

## 6. Onde está no código

```
apps/web/
  app/lab/anvil/           # UI
  app/api/lab/anvil/       # APIs
  lib/lab-anvil/           # access, policy, prompts, agent, sandbox-fs, preview
  lib/muse/implement-to-anvil.ts
  prisma/schema.prisma     # LabAnvil*
  prisma/migrations/manual_lab_anvil.sql
  prisma/migrations/manual_lab_anvil_f2.sql
  prisma/migrations/manual_muse_anvil_handoff.sql
```

---

## 7. Env

```
ETHOLYS_PLATFORM_ADMIN_EMAILS="tiago@…,outro@…"
```

(única allowlist de system admin / owners Lab+ANVIL)
