# AURORA · POLARIS · RADAR

Família que substitui o NEXUS como um único menu. **Licença atual:** a chave `NEXUS` abre os três. RADAR terá SKU próprio mais tarde.

Nomes anteriores (NIDO / RUMO / PULSO) redirecionam para estas rotas.

| Produto | Para quem | O que é | Rota |
|---------|-----------|---------|------|
| **AURORA** | técnicos, consultores, incubadoras | Incubadora virtual: mesmo método, carteira humana | `/hub/aurora` |
| **POLARIS** | o negócio sozinho | Mapa de autodesenvolvimento: linha base de maturidade + acompanhamento com IA do sistema (ecossistema Etholys) | `/hub/polaris` |
| **RADAR** | operação | Digitalização produtiva (dados, WhatsApp, alertas, automações) | `/hub/radar` |

Método partilhado (AURORA e POLARIS): conversa → retrato editável → hipótese aceite → 2–4 apostas → ritmo semanal. Brechas máx. 5, potenciais máx. 3. Não é score de quiz Likert. Em POLARIS a **linha base** (`/hub/polaris/diagnosis`) radiografa maturidade 1–5 por blocos (mesmo motor do diagnóstico AURORA) antes do guia de autodesenvolvimento; a **IA do sistema** (não há consultor humano externo) junta essa linha base ao brief do ecossistema (FundHub, Work, Meet, Studio, memória, RADAR) e só então propõe avanço.

RADAR começa com quatro módulos: agricultura, agroindústria, pecuária, carbono. Liga-se a AURORA/POLARIS por `GET /api/radar/bridge` (`/api/pulso/bridge` continua como alias). Arquitetura, roadmap e fachada agrícola: [etholys-radar.md](./etholys-radar.md).

Contratos AT em `/hub/aurora/contratos` (lista) e `/hub/aurora/at/[id]`. A carteira em `/hub/aurora` é a ronda do técnico (meus, travados, sem dono) e o quadro do método. Programas em `/hub/aurora/programas` agrupam a carteira por contrato AT. O **diagnóstico dinâmico** em `/hub/aurora/diagnostico` radiografa o negócio por blocos (maturidade 1–5 + situação real + brecha/potencial) em diálogo — não é planilha nem quiz. O dossiê em `/hub/aurora/dossie` é a conversa profunda do técnico → retrato → hipótese aceite → 2–4 apostas → ritmo. POLARIS reusa jornada, diagnóstico, roadmap e coach. RADAR agricultura usa a fachada `/api/radar/agriculture` por cima das unidades ops; não mostra a central NEXUS nem o retrato. Os dossiês hidratam-se a partir de `NexusDiagnosis`, jornada, roadmap e unidades ops — sem apagar retrato já escrito e sem colar score `/100` no retrato.

`/hub/nexus/campo` redireciona para RADAR. Rotas NEXUS antigas continuam a funcionar.
