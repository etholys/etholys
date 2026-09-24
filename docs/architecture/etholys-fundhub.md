# Etholys FundHub — captação de fundos

**Versão:** 1.0  
**Data:** 2026-09-24  
**Status:** F0 em produção; F1–F9 no código (F1 a entrar em produção; F2–F9 no mesmo ramo)  
**Público:** product, desenvolvedores, agentes de IA  
**Licença interna:** `FUNDHUB` (`sys.FUNDHUB`)  
**Entrada para agentes:** [AGENTS.md](../../AGENTS.md) → este ficheiro.

**Nome de produto:** **FundHub** (chave de sistema `FUNDHUB`; rotas `/hub/fundhub`, APIs `/api/opportunity/*` e `/api/fundhub/*`).

---

## 1. Princípio

> **Menos fundos. Todos oficiais. Cada um com prazo, elegibilidade e caminho até à proposta.**

FundHub não é um agregador tipo GrantWatch nem um GMS de doador tipo Fluxx. É o trabalho institucional de **encontrar convocatórias em fontes oficiais, decidir em equipa e escrever a candidatura** — no mesmo expediente.

| Não é | É |
|-------|---|
| Lista de grants comprada | Descoberta com URL oficial da **convocatória** |
| Writer genérico de IA | Proposta ancorada nas bases / PDFs |
| Mais um menu por função | Três sítios: **Buscar · Em curso · Propostas** |
| % de match sozinho | Evidência + go/no-go contra o perfil |

**Regra de UI:** não criar entradas novas no menu. Perfil, Mapa, Compliance, Coalizão e Parceiros já existem — ligam-se ao expediente, não competem com ele.

---

## 2. Ciclo do produto

```
Perfil da org ──► Buscar (inbox) ──► Evidência ──► Go/no-go ──► Em curso (pipeline)
                                              │                      │
                                              └── Documentos oficiais ┴──► Proposta
                                                                        │
                                                           Relógio (programa reabre)
```

1. **Buscar** — IA pesquisa; humano decide. Inbox **não apaga** varreduras anteriores.
2. **Evidência (F1)** — página da convocatória verificada, N documentos, data. Sem isto, não há proposta às cegas.
3. **Go/no-go (F2)** — critérios do perfil (país, tipo de org, privado, teto) no mesmo popup.
4. **Em curso (F3)** — estados: Decidir → Preparar → Submetido → Ganho/Perdido.
5. **Proposta (F4)** — secções a partir do texto das bases; chat com citação.
6. **Relógio (F5)** — programas mapeados avisam quando a janela abre.

---

## 3. Onde vive o código

| Camada | Caminho |
|--------|---------|
| UI | `apps/web/app/hub/fundhub/` |
| Componentes | `apps/web/components/opportunity/` |
| Lib | `apps/web/lib/opportunity/` |
| APIs descoberta / inbox | `apps/web/app/api/opportunity/` |
| APIs perfil / overview / compliance | `apps/web/app/api/fundhub/` |
| Prisma | `Fund`, `FundhubDiscoveryRun`, `FundingCaptureProfile`, `Proposal`, `FundhubPartner`, `FundhubComplianceChecklist`, `UserMonitoredSource` |
| Testes | `apps/web/tests/opportunity/` |

Chave de memória de varredura: `AiCompanyMemory.category = opportunity_scan`.

---

## 4. Modelo de dados (alvo)

Campos novos **entram no JSON do candidato** (inbox) primeiro; no `Fund` persistido quando o utilizador guarda. Evitar migração até F3, salvo `pipelineStatus` / `ownerUserId` / `watchOpen`.

### 4.1 Candidato (inbox + ficha)

Já existem: `callUrl`, `institutionUrl`, `documents[]`, `sourceExcerpt`, `runId`.

| Campo | Fase | Notas |
|-------|------|--------|
| `evidence` | F1 | `{ status, verifiedAt, callUrl, documentCount, httpOk }` |
| `fit` | F2 | `{ verdict, items[{ id, label, status, note }] }` |
| `pipelineStatus` | F3 | `decide \| prepare \| submitted \| won \| lost` |
| `ownerUserId` | F6 | Dono do expediente |
| `watchOpen` | F5 | `true` em programas de referência |

### 4.2 Fund (Em curso)

| Campo | Fase | Persistência |
|-------|------|----------------|
| `linkOficial` | F0 | Já é a convocatória quando há `callUrl` |
| `notes` | F0 | Inclui lista de documentos até haver coluna |
| `pipelineStatus` | F3 | Coluna Prisma ou JSON em `notes` até migração |
| `ownerUserId` | F6 | Coluna + índice `(companyId, ownerUserId)` |
| `watchOpen` | F5 | Boolean; alerta quando `availability` passa a aberto |
| `documentsJson` | F4 | Quando o texto das bases for extraído de verdade |

### 4.3 Relógio / alerta

Reutilizar `FundhubAlert` + `syncDeadlineNotifications`. F5 adiciona tipo `opportunity_window_open` (programa mapeado que reabriu).

---

## 5. APIs

| Método | Rota | Fase | Função |
|--------|------|------|--------|
| GET/POST | `/api/opportunity/scans` | F0 | Inbox unida + arrancar varredura |
| POST | `/api/opportunity/candidates/validate` | F0 | Guardar / não agora / rejeitar tipo |
| POST | `/api/opportunity/candidates/analyze` | F0 | Chat / brief (usa excerpt + docs) |
| POST | `/api/opportunity/candidates/enrich` | F0/F1 | Verifica URL, extrai anexos, grava `evidence` |
| POST | `/api/opportunity/candidates/documents` | F0 | Download 1 ficheiro ou ZIP |
| POST | `/api/opportunity/candidates/fit` | F2 | Go/no-go vs perfil |
| PATCH | `/api/opportunity/catalog` ou `/api/funds/...` | F3 | `pipelineStatus` |
| POST | `/api/opportunity/watch` | F5 | Ligar/desligar relógio |
| GET/PUT | `/api/fundhub/profile` | F0 | Perfil (F2 lê isto) |
| GET | `/api/opportunity/alerts` | F0/F5 | Prazos + janelas |

**Regra:** `open_now` **nunca** cai no fallback de conhecimento (inventa agências). Sem página oficial verificável → zero candidatos, não lixo.

---

## 6. Roadmap de implementação

### F0 — Fundação (feito)

Inbox persistente, ordem por prazo, filtros leves, URL oficial vs homepage, documentos + ZIP, recusa de inventados, perfil editável, proposta sem intake vazio.

### F1 — Ficha de evidência (feito)

Uma linha na ficha e no card:

`Verificado 23 set · página oficial · 3 documentos`  
ou `Não confirmado — sem página oficial da convocatória`

- `buildCallEvidence()` em `call-evidence.ts`
- `enrichCandidateEvidence` grava `evidence.verifiedAt` quando o HTTP da convocatória responde
- Proposta **não abre às cegas** se `status !== verified` (aviso + confirmação explícita)
- Sem ecrã novo

### F2 — Go / no-go (feito)

No mesmo popup, 5–8 critérios do `FundingCaptureProfile` + briefing:

país · tipo de org · privado elegível · teto · grant vs crédito · prazo ainda aberto

Verde / âmbar / vermelho. «Não somos elegíveis» → `not_now` + aprendizagem. Sem página nova.

### F3 — Pipeline em Em curso (feito)

Filtro ou colunas: **Decidir / Preparar / Submetido / Fechado**. Prazo no card. Default ao guardar: `decide`. Sem menu novo.

### F4 — Proposta a partir das bases (feito)

Extrair texto dos PDFs oficiais (já listados) → `sourceExcerpt` longo por documento → secções do editor + chat com «ver bases». Sem inventar requisitos em falta.

### F5 — Relógio de programas (feito)

Em **Mapear programas**, toggle «Avisar quando abrir». Digest / notificação in-app. Reutiliza alertas; não cria «Watch» no menu.

### F6 — Equipa (feito)

`ownerUserId` no fundo + avatar no card Em curso. Lista de membros da empresa (já existe no Hub). Sem módulo de RH.

### F7 — Coligação na proposta (feito)

Membros de `/hub/fundhub/coalition` escolhidos no editor: papel + % orçamento. Grava no intake JSON. Não duplicar a página Coalizão.

### F8 — Operador / white-label (feito)

Inbox partilhada por `companyId` do operador + orgs hospedadas. SKU `license.whitelabel` (não self-serve). Sem success fee em governo.

### F9 — Success fee (só consultoria) (feito)

Rider 1–3% com tecto no contrato privado. SKU `commission.fundhub.success_fee` já existe (2–5%). **Proibido** em universidade pública, ministério, operador de programa.

---

## 7. Precificação (âncora comercial)

Ver estudo de mercado no canvas interno. Resumo:

| Oferta | Banda |
|--------|--------|
| Licença ONG | USD 129–249/mês ou 1,5–2,7 mil/ano |
| Licença instituição (PO) | USD 4,8–12 mil/ano |
| White-label FundHub | setup 8–25 mil + 18–45 mil/ano |
| Operador multi-org | 25–60 mil + 200–600/org |
| Success fee | só consultoria privada, com tecto |

SKU actual `sys.FUNDHUB` = USD 129/mês, 15 seats — chão, não lista do produto completo.

---

## 8. O que não fazer

- Novos grupos de menu (Captación / Alianzas).
- Base tipo Candid (centenas de milhares de RFPs comprados).
- Writer sem edital oficial.
- Pós-prémio / spenddown (isso é SIEP / add-on).
- Success fee em conta pública.
- Fallback de conhecimento em `open_now`.

---

## 9. Testes mínimos por fase

| Fase | Ficheiro / caso |
|------|-----------------|
| F1 | `call-evidence.test.ts` — verified vs unconfirmed vs failed; proposta bloqueada sem confirm |
| F2 | fit vs perfil (país mismatch → red) |
| F3 | transições de `pipelineStatus` |
| F4 | extract de HTML/PDF → secções |
| F5 | watch + tipo de notificação |

---

Última actualização: **24 set 2026**.
