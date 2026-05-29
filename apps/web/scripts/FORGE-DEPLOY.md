# FORGE — Deploy checklist

## Base de datos

```bash
cd apps/web
npx prisma migrate deploy
npx prisma generate
```

Migrações relevantes: `inviteToken`, `magicLoginToken`, `ForgeCourseFacilitator`, `ForgeLiveAttendance`, `enforceOrder`, `libroPdfPath`.

## Libro PDF + OCR

- Facilitador: **Alumnos** → arrastrar PDF (S3 si hay AWS, si no `public/uploads/forge-libros/`)
- Tras subir: OCR automático (`pdf-parse`; si poco texto → Gemini con `GEMINI_API_KEY`)
- Alumnos: **Lector** + búsqueda en texto extraído
- Manual: `POST /api/forge/courses/[id]/libro/ocr`

## Grabaciones en vivo

- Tras la sesión: facilitador pega URL (YouTube/Drive) en calendario de sesiones o PATCH `recordingUrl`

## i18n FORGE

- `lib/forge/i18n.ts` + `useForgeT()` — respeta `locale` de `useApp()` (es/pt/en)

## E2E (Playwright)

Requisitos: Postgres em `localhost:5433`, `DATABASE_URL` em `apps/web/.env`, `FORGE_E2E_SECRET` em `.env.local`.

Windows (sem Docker no PATH do script): abra **Docker Desktop** → `open-etholys-dev-local.bat` ou só Postgres:

```bash
cd infra && docker compose up -d postgres
```

```bash
cd apps/web
npx prisma migrate deploy
npm run test:e2e:forge
```

Testes: convite → `/hub/forge/activar` (link mágico + password), multi-org. O `global-setup` cria `e2e/.seed-state.json` via Prisma direto.

O `global-setup` cria dados de teste em `e2e/.seed-state.json` (invite + multi-org). Opcional: `FORGE_E2E_SECRET` em `.env.local` para `POST /api/forge/e2e/seed`.

## Variables de entorno

```env
RESEND_API_KEY=          # convites e recordatorios por email
FORGE_EMAIL_FROM=
FORGE_CRON_SECRET=       # cron Bearer token
NEXTAUTH_URL=https://tu-dominio.com
```

## Cron (recomendado diario)

```bash
curl -X POST https://tu-dominio.com/api/forge/cron/reminders \
  -H "Authorization: Bearer $FORGE_CRON_SECRET"

curl -X POST https://tu-dominio.com/api/forge/cron/auto-nudges \
  -H "Authorization: Bearer $FORGE_CRON_SECRET"
```

## Health

`GET /api/forge/health` — debe devolver `ok: true`.

## Docker

Si `forgeCourse` falta en el cliente Prisma, regenerar volumen `node_modules` del contenedor web y `npm run dev:clean`.
