# Acesso Etholys — system admin vs empresa

**Data:** 2026-08-07  

## Modelo (simples)

1. **Empresas clientes** (+ utilizadores) — inclui Etholys como empresa se quiseres.  
   Admin da empresa = `CompanyUser.role = ADMIN` → só essa empresa. **Não vê o Etholys Lab.**

2. **System admin** (master) — emails em `ETHOLYS_PLATFORM_ADMIN_EMAILS`.  
   Entra pelo **mesmo** `/login`. Vê Hub completo + **Lab** (MUSE, ANVIL) + consola.

3. **Convidados do Lab** — `LabInvite` aceite (código gerado pelo system admin). Entram em `/lab` com o código; **não** são system admin e **não** vêem o atalho Lab no Hub.

`User.role = ADMIN` / `CompanyUser.role = ADMIN` **não** definem system admin nem o atalho Lab no Hub.

**Regra:** não coloques no allowlist o email com que entras como admin de uma empresa *cliente* (ex. Rural Commerce). Usa um email só de plataforma (ex. `etholys@gmail.com`). O Lab é interno Etholys; admin de cliente ≠ dono do sistema.

## Código

| Função | Ficheiro |
|--------|----------|
| `isSystemAdmin(email)` | `lib/platform-access.ts` (só `ETHOLYS_PLATFORM_ADMIN_EMAILS`; fallback bootstrap `etholys@gmail.com` se env vazio) |
| Lab gate | `lib/lab/access.ts` → `hasLabAccess` (system admin **ou** LabInvite) |
| Card Lab no Hub | `app/hub/page.tsx` → `GET /api/lab/access` → só se `isSystemAdmin` |
| ANVIL owners | `lib/lab-anvil/access.ts` → `isSystemAdmin` |

## Produção / local

Não há ecrã na app para “adicionar admin”. É uma linha no ficheiro **`.env`** do servidor (ou local).

```
ETHOLYS_PLATFORM_ADMIN_EMAILS=etholys@gmail.com
```

1. Edita `apps/web/.env` no PC (dev) **ou** no Contabo o `.env` que a app usa em produção.
2. Reinicia a app / redeploy.
3. Em `app.etholys.com` → **Login com Google** usando **etholys@gmail.com** (não se mete a senha do Gmail no `.env`).
4. Abre `/hub` → atalho **Lab**, ou `/lab`.

Vários emails de plataforma: `etholys@gmail.com,outro@etholys.com` — só emails internos Etholys, nunca admins de clientes.
