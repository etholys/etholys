# Etholys — instruções para agentes de IA

Este ficheiro é o **ponto de entrada** para humanos e agentes que trabalham no repositório. Leia-o antes de implementar funcionalidades novas.

## Documentação obrigatória (por área)

| Área | Documento | Quando ler |
|------|-----------|------------|
| **Ecossistema de produtos (visão geral)** | [ETHOLYS_Arquitectura_v2.md](./ETHOLYS_Arquitectura_v2.md) | Módulos, princípios, integrações entre sistemas |
| **FORGE — EAD unificado + jogos + gamificação** | [docs/architecture/forge-ead.md](./docs/architecture/forge-ead.md) | Qualquer trabalho em `/hub/forge`, APIs `forge`, LMS, jogos, IA geradora de jogos |
| **Índice de toda a documentação** | [docs/README.md](./docs/README.md) | Encontrar outros guias em `docs/` |
| **Backend (releases)** | [docs/backend-release-hygiene.md](./docs/backend-release-hygiene.md) | Publicar apenas `backend/` |
| **Instruções legadas (encoding, módulos)** | [etholys-web/.project_instructions.md](./etholys-web/.project_instructions.md) | Convenções JSX/encoding e histórico de módulos |

## Stack principal (apps/web)

- Next.js App Router — `apps/web/`
- Prisma + PostgreSQL — `apps/web/prisma/schema.prisma`
- Auth: NextAuth — multi-tenant por `companyId`
- LLM: Gemini — `apps/web/lib/gemini-client.ts`
- Hub de sistemas: `apps/web/app/hub/`
- Chaves de sistema: `ATLAS`, `SIEP`, `FUNDHUB`, `NEXUS`, `FORGE`, `PRISM` — ver `apps/web/lib/integrated-workspace.ts`

## FORGE — estado atual vs. alvo

| Item | Estado |
|------|--------|
| Dashboard + layout | `apps/web/app/hub/forge/` |
| APIs EAD / jogos | `apps/web/app/api/forge/` |
| Lib (motores, schemas, XP) | `apps/web/lib/forge/` |
| Modelos Prisma | `ForgeCourse`, `ForgeLearningActivity`, `ForgeGameSpec`, … |
| Ledger MVP (inovação) | `apps/web/app/api/company-memory/forge-ledger/route.ts` |
| **Arquitetura** | **[docs/architecture/forge-ead.md](./docs/architecture/forge-ead.md)** |

**Regra:** não criar silos separados para “cursos” vs. “jogos”. **Jogos = atividades `game` dentro do curso** (editor em `/hub/forge/cursos/[id]?edit=1`). Não adicionar menu «Jogos» ao lado de «Cursos». Gamificação é camada transversal (XP), não concorrente do LMS.

## Convenções de código

- Minimizar âmbito do diff; reutilizar padrões de NEXUS para APIs com IA (sessões, JSON validado, `companyId`).
- Não commitar segredos (`.env`).
- Commits e PRs apenas quando o utilizador pedir explicitamente.

## Onde implementar FORGE (quando chegar a código)

```
apps/web/
  app/hub/forge/              # UI
  app/api/forge/              # APIs REST (a criar)
  lib/forge/                  # schemas, motores, prompts (a criar)
  prisma/schema.prisma        # modelos (a criar)
```

Última atualização da arquitetura FORGE: **maio 2026** — ver data no cabeçalho de `docs/architecture/forge-ead.md`.
