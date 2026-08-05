# ETHOLYS Lab — MUSE (inteligência de inovação interna)

**Versão:** 0.1  
**Data:** 2026-08-05  
**Status:** F0–F1 em código (chat, board, handoff → ANVIL); observatório contínuo pendente  
**Público:** admin Etholys / agentes de IA  

**Fonte de verdade** para o motor de sugestões estratégicas do Lab (I+D+i interno).  
**Entrada para agentes:** [AGENTS.md](../../AGENTS.md) → este ficheiro.

---

## 1. Princípio

> **MUSE decide o quê e porquê.** ANVIL executa o como. Não fundir num único produto.

MUSE não é produto licenciado aos clientes. Vive em `/lab/muse`, atrás do gate do Lab (ADMIN + convite `LabInvite`).

| Papel | Ferramenta |
|-------|------------|
| Observar o ecossistema, priorizar oportunidades, bitácora de ideias | **MUSE** |
| Projetos de código, políticas de IP, agente de engenharia, deploy | **ANVIL** — [lab-anvil.md](./lab-anvil.md) |

### Decisão (ago/2026)

- **Manter separados** — papéis distintos (estratégia vs engenharia).
- **Mesmo Lab** — mesma identidade de fábrica interna, acesso por convite.
- **Pipeline MUSE → ANVIL** — sugestão aceite → “Implementar” cria (ou liga a) um `LabAnvilProject` com brief + política de reuso; MUSE guarda a bitácora ideia → decisão → resultado.

Não misturar UI/agente: inovação estratégica ≠ regras OSS/core do ANVIL.

---

## 2. Funções (visão)

1. **Observatório** — métricas de uso dos sistemas (ATLAS, SIEP, NEXUS, FORGE, …), padrões, features sub/sobreutilizadas, feedback/pain points.
2. **Proponente** — novos sistemas/produtos, melhorias, hardware, metodologias, processos, integrações.
3. **Bitácora** — histórico ideia → decisão → implementação → resultado.
4. **Handoff** — alimentar ANVIL quando a decisão for “construir”.

---

## 3. Estado no código (MVP)

| Tem | Ainda não tem |
|-----|----------------|
| Chat IA sob demanda (`POST /api/muse`) | Jobs periódicos / análise contínua |
| Board `MuseSuggestion` (status, prioridade, categoria) | Telemetria real SIEP/NEXUS/FORGE/… |
| Contexto ATLAS: projetos, tarefas, riscos, finanças, objetivos | Pain points / feedback estruturado |
| Gate Lab (ADMIN ou `LabInvite` aceite) | Bitácora completa pós-implementação |
| **Handoff “Implementar”** → `LabAnvilProject` + brief + sessão | — |

---

## 4. Modelo de dados

```
MuseSuggestion
  title, category, description, rationale
  priority, status, source
  companyId?, projectId?   # opcional (ATLAS)
  anvilProjectId?          # FK → LabAnvilProject (handoff)
  createdById?
```

Status típicos: `NEW` → `REVIEWING` → `ACCEPTED` → `IMPLEMENTING` → `DONE` | `DISMISSED`.

**Pipeline:** `POST /api/muse` `action=implement` cria/reutiliza `LabAnvilProject`, grava brief no `systemPromptExtra` do agente + sessão “Brief MUSE”, e define `status=IMPLEMENTING`.

---

## 5. Roadmap

| Fase | Entrega | Estado |
|------|---------|--------|
| **F0** | Chat + CRUD sugestões + contexto ATLAS | ✅ |
| **F1** | Pipeline “Implementar” → criar/ligar projeto ANVIL + brief | ✅ (ago/2026) |
| **F2** | Telemetria multi-sistema (além de ATLAS) | Pendente |
| **F3** | Análise periódica em background + dashboard de prioridades | Pendente |
| **F4** | Bitácora completa (decisão, resultado, feedback) | Pendente |

---

## 6. Onde está no código

```
apps/web/
  app/lab/muse/                      # UI
  app/api/muse/                      # GET / POST analyze|save|update|delete|implement
  lib/muse/implement-to-anvil.ts     # Handoff MUSE → ANVIL
  prisma/schema.prisma               # MuseSuggestion.anvilProjectId
  prisma/migrations/manual_muse_anvil_handoff.sql
```

Lab shell: `app/lab/` (layout + convites). ANVIL: ver [lab-anvil.md](./lab-anvil.md).

---

## 7. Relação com outros docs

- Visão produto (mais ampla): [ETHOLYS_Arquitectura_Productos.md](../../ETHOLYS_Arquitectura_Productos.md) § MUSE  
- Mapa Lab: [ETHOLYS_Arquitectura_v2.md](../../ETHOLYS_Arquitectura_v2.md) § 5  
- Engenharia: [lab-anvil.md](./lab-anvil.md)
