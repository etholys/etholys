# Publicar La Expedición (web no celular)

> **Deploy Hetzner + Cloudflare (guia principal):** [DEPLOY-HETZNER-CLOUDFLARE.md](./DEPLOY-HETZNER-CLOUDFLARE.md)

O curso **já está criado e com status `published`** na base de dados onde correr o seed. Hoje isso está no teu **Postgres local** (`localhost:5433`). Para amanhã, os participantes precisam da **mesma app no teu domínio** (ex.: `https://forge.seudominio.com`) com **base de dados no servidor Hetzner**.

## O que cada pessoa vê (só o curso)

| Quem | O que vê |
|------|-----------|
| **Aluno convidado** (sem empresa Etholys) | Modo **course_only**: só o curso dele, mapa A2, Jitsi, atividades — **sem** catálogo FORGE, trilhas nem admin. |
| **Tu / facilitador** (conta Rural Commerce) | Painel completo + **Salón** (`/salon`). Usa links diretos; não partilhes o Hub geral com alunos. |

Convites usam `accessScope: course_only` automaticamente.

---

## Passo 1 — Publicar a app (uma vez)

### A) Variáveis no servidor de produção

```env
DATABASE_URL=postgresql://...          # Postgres na nuvem (NÃO localhost)
NEXTAUTH_URL=https://etholys.abacusai.app   # URL exacta do browser
NEXTAUTH_SECRET=...                    # segredo longo
RESEND_API_KEY=...                     # opcional: email automático
FORGE_EMAIL_FROM="FORGE <convites@ruralcommerceglobal.com>"
```

### B) Migrar e gerar cliente

No servidor ou CI, na pasta `apps/web`:

```bash
npx prisma migrate deploy
npx prisma generate
npm run build
npm start
```

(Se usas Docker Abacus/etholys, o mesmo comando dentro do contentor `web`.)

### C) Health

Abrir: `https://etholys.abacusai.app/api/forge/health` → deve responder `"ok": true`.

---

## Passo 2 — Curso na base de **produção**

O seed **só corre onde aponta o `DATABASE_URL`**. Para criar o curso em produção:

```bash
cd apps/web
# .env com DATABASE_URL de PRODUÇÃO (cuidado!)
npx tsx --require dotenv/config scripts/seed-expedicion-tiago.ts
```

Anota os IDs impressos (LLC e LTDA). Lista links:

```bash
NEXTAUTH_URL=https://etholys.abacusai.app npx tsx --require dotenv/config scripts/list-expedicion-courses.ts
```

---

## Passo 3 — Convidar alunos (hoje)

1. Login em produção → **FORGE → Curso (LLC ou LTDA) → Alumnos**.
2. Colar emails → **Enviar convites**.
3. Copiar cada link `.../hub/forge/activar?token=...` (se não houver Resend).
4. Enviar por WhatsApp — funciona no celular como site (pode **Adicionar ao ecrã**).

**Página pública de entrada (celular):**  
`https://etholys.abacusai.app/expedicion`  
(Quem já tem link de convite pode ir directo ao `activar`.)

---

## Passo 4 — Amanhã na sessão

| Papel | Link |
|-------|------|
| **Facilitador** | `.../hub/forge/cursos/{id}/salon` |
| **Alunos (vídeo)** | Jitsi da empresa (aparece também dentro do curso) |
| **Alunos (curso)** | Após activar → `.../hub/forge/cursos/{id}` |

Jitsi (exemplo após seed em produção):

- LLC alunos: `https://meet.jit.si/expedicion-rc-llc-XXXXXXXX`
- LTDA alunos: `https://meet.jit.si/expedicion-rc-ltda-XXXXXXXX`

(`list-expedicion-courses.ts` mostra os URLs exactos.)

---

## Celular (PWA)

- Layout FORGE já tem menu mobile e manifest `/forge-pwa.json`.
- Na primeira visita, o browser pode oferecer **“Adicionar ao ecrã inicial”** (Chrome/Android, Safari/iOS).
- Convite + activar estão optimizados para ecrã pequeno.

---

## Deixar “só este curso” visível na plataforma

1. **Em produção**, não cries outros cursos FORGE (ou deixa em `draft`).
2. **Não convides** ninguém como membro da empresa Etholys — só convites de aluno.
3. Partilha apenas:
   - `/expedicion` ou
   - links personalizados `/hub/forge/activar?token=...`
4. O Hub SIEP/resto da app continua no mesmo domínio, mas alunos **sem login** não entram; alunos **com convite** não vêem o Hub.

---

## Checklist rápido (amanhã)

- [ ] `NEXTAUTH_URL` = URL pública real
- [ ] `migrate deploy` em produção
- [ ] Seed Expedición em produção (LLC + LTDA se precisares)
- [ ] 1 convite de teste no teu telemóvel → activar → curso → Jitsi
- [ ] Convites reais enviados
- [ ] Salón aberto no portátil/tablet do facilitador

---

## Problemas comuns

| Sintoma | Causa provável |
|---------|----------------|
| Link abre localhost | `NEXTAUTH_URL` errado ao gerar convites |
| “Curso não encontrado” | Seed só no local; falta seed em produção |
| Login não funciona | `NEXTAUTH_SECRET` diferente entre deploys |
| Jitsi não embute | Normal em alguns telemóveis — usar botão “Abrir Jitsi” |
