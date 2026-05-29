# FORGE — checklist publicação (48 h)

## Curso de referência

- **La Expedición Sostenible** — titular: `tiagorezende@ruralcommerceglobal.com` (Rural Commerce LLC + LTDA)
- CLI: `cd apps/web && npx tsx --require dotenv/config scripts/seed-expedicion-tiago.ts`
- API (titular): `POST /api/forge/seed-expedicion/owner` com `{ "replace": true }`
- UI: FORGE → Cursos → **La Expedición (todas mis empresas)** (só o titular vê o botão)

## Antes de apresentar

1. Docker: `docker compose -f infra/docker-compose.yml up -d web postgres`
2. Health: http://127.0.0.1:3000/api/forge/health → `"ok": true`
3. Login → Hub → FORGE → curso → **Empezar / Continuar**
4. Percorrer 1 aula + 1 quiz + tabuleiro (módulo Taller)

## O que está pronto

- Curso **síncrono** (videollamada) + mapa/tabuleiro **personal** por alumno
- Salas Jitsi **por empresa** (LLC / LTDA)
- Player com layout e-learning + rail de módulos
- Tabuleiro com Eco-Créditos, 20 casillas, cartas
- Matrícula, progresso, XP, certificado ao 100%
- Curso publicado (`status: published`)

## La Expedición — síncrono (sin vídeos grabados)

- Modalidad `live`, `gamePlayMode: personal`, 6 sesiones en calendario
- Aulas = lectura + quizzes entre sesiones; el aprendizaje principal es en la videollamada

## Limitações conhecidas (pós-MVP)

- Libro: texto seed + PDF opcional (upload manual)
- Modo facilitador presencial não digitalizado
- Trilhas/programas e analytics instrutor básicos

## Publicar

- Garantir `NEXTAUTH_URL` e `DATABASE_URL` em produção
- `npx prisma migrate deploy` no ambiente alvo
- Build: `npm run build` em `apps/web`
