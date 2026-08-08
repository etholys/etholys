# Acesso Etholys — system admin vs empresa

**Data:** 2026-08-07  

## Modelo (simples)

1. **Empresas clientes** (+ utilizadores) — inclui Etholys como empresa se quiseres.  
   Admin da empresa = `CompanyUser.role = ADMIN` → só essa empresa.

2. **System admin** (master) — emails em `ETHOLYS_PLATFORM_ADMIN_EMAILS`.  
   Entra pelo **mesmo** `/login`. Vê Hub completo + **Lab** (MUSE, ANVIL) + consola.

`User.role = ADMIN` **não** define system admin (era a fonte do caos com `admin@etholys.com`).

## Código

| Função | Ficheiro |
|--------|----------|
| `isSystemAdmin(email)` | `lib/platform-access.ts` |
| Lab gate | `lib/lab/access.ts` → `hasLabAccess` |
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

Vários emails: `etholys@gmail.com,outro@empresa.com`
