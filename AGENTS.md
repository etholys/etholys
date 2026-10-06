# Etholys — instruções para agentes de IA

Este ficheiro é o **ponto de entrada** para humanos e agentes que trabalham no repositório. Leia-o antes de implementar funcionalidades novas.

## Documentação obrigatória (por área)

| Área | Documento | Quando ler |
|------|-----------|------------|
| **Ecossistema de produtos (visão geral)** | [ETHOLYS_Arquitectura_v2.md](./ETHOLYS_Arquitectura_v2.md) | Módulos, princípios, integrações entre sistemas |
| **Etholys Tools — faixa de ferramentas** | [docs/architecture/etholys-tools.md](./docs/architecture/etholys-tools.md) | Advisor, Studio, Work, Chorus (Meet), Prism — não confundir com Core nem com Studio como guarda-chuva |
| **Etholys Work — motor de tarefas** | [docs/architecture/etholys-work.md](./docs/architecture/etholys-work.md) | `Task` único, espelhos ATLAS/SIEP/Meet; vistas Board/List/Kanban/Calendar/Workload; pastas ACL tipo Drive; Integrated Workspace (F11) |
| **FORGE — EAD unificado + jogos + gamificação** | [docs/architecture/forge-ead.md](./docs/architecture/forge-ead.md) | Qualquer trabalho em `/hub/forge`, APIs `forge`, LMS, jogos, IA geradora de jogos |
| **Etholys Meet → CHORUS** | [docs/architecture/etholys-meet.md](./docs/architecture/etholys-meet.md) | Produto **CHORUS** (`/hub/meet`): salas, breakouts, convites, gravação, transcrição e pós-chamada. **Não** usar nomes de infra de vídeo na UI nem ao falar com o utilizador |
| **Etholys Studio — documentos com IA (ferramenta)** | [docs/architecture/etholys-studio.md](./docs/architecture/etholys-studio.md) | `/hub/studio`, pastas, templates, canvas+chat, agente com consentimento, atalho hot |
| **FundHub — captação de fundos** | [docs/architecture/etholys-fundhub.md](./docs/architecture/etholys-fundhub.md) | Qualquer trabalho em `/hub/fundhub`, APIs `opportunity`/`fundhub`; evidência oficial, pipeline, proposta |
| **AURORA / POLARIS / RADAR** | [docs/architecture/etholys-aurora-polaris-radar.md](./docs/architecture/etholys-aurora-polaris-radar.md) | Incubadora virtual, mapa de autodesenvolvimento, digitalização produtiva — **não** juntar num só menu NEXUS |
| **RADAR — digitalização produtiva** | [docs/architecture/etholys-radar.md](./docs/architecture/etholys-radar.md) | `/hub/radar`: agricultura fechada; agroindústria, pecuária e carbono no mesmo laço. Sem dossiê na UI |
| **Lab MUSE — inovação / I+D+i interno** | [docs/architecture/lab-muse.md](./docs/architecture/lab-muse.md) | `/lab/muse` — sugestões estratégicas, observatório; pipeline → ANVIL (não fundir) |
| **Lab ANVIL — agente de engenharia interno** | [docs/architecture/lab-anvil.md](./docs/architecture/lab-anvil.md) | `/lab/anvil` — 1 agente/projeto, OSS vs Etholys, deploy targets, owners+convites |
| **System admin vs empresa** | [docs/architecture/system-admin.md](./docs/architecture/system-admin.md) | Master Etholys (`ETHOLYS_PLATFORM_ADMIN_EMAILS`) ≠ admin de cliente |
| **Licenças e pagamentos** | [docs/architecture/etholys-billing.md](./docs/architecture/etholys-billing.md) | Assinaturas, licenciamento, add-ons, comissões, faturas Etholys |
| **Motor de vídeo CHORUS (ops)** | [docs/MEET-JITSI-CONTABO.md](./docs/MEET-JITSI-CONTABO.md) | Subir `meet.etholys.com` — ops only; nunca expor na UI |
| **VPS gravação CHORUS (ops)** | [docs/MEET-VPS-JIBRI.md](./docs/MEET-VPS-JIBRI.md) | VPS dedicado, gravação → R2 — ops only |
| **Índice de toda a documentação** | [docs/README.md](./docs/README.md) | Encontrar outros guias em `docs/` |
| **Backend (releases)** | [docs/backend-release-hygiene.md](./docs/backend-release-hygiene.md) | Publicar apenas `backend/` |
| **Instruções legadas (encoding, módulos)** | [etholys-web/.project_instructions.md](./etholys-web/.project_instructions.md) | Convenções JSX/encoding e histórico de módulos |

## Stack principal (apps/web)

- Next.js App Router — `apps/web/`
- Prisma + PostgreSQL — `apps/web/prisma/schema.prisma`
- Auth: NextAuth — multi-tenant por `companyId`
- LLM: `apps/web/lib/llm-client.ts` (health: `/api/llm-health`; alias legado `/api/ollama-health`)
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
- **CHORUS:** produto desvinculado. Na UI, copy, seeds e respostas ao utilizador usar só **CHORUS** / sala / gravação / transcrição. Nomes de motor OSS ou ops ficam em `docs/MEET-*` e código interno — nunca na superfície do produto.

## Onde implementar FORGE (quando chegar a código)

```
apps/web/
  app/hub/forge/              # UI
  app/api/forge/              # APIs REST (a criar)
  lib/forge/                  # schemas, motores, prompts (a criar)
  prisma/schema.prisma        # modelos (a criar)
```

Última atualização da arquitetura FORGE: **maio 2026** — ver data no cabeçalho de `docs/architecture/forge-ead.md`.
