# AURORA · POLARIS · RADAR

Família que substitui o NEXUS como um único menu. **Licença atual:** a chave `NEXUS` abre os três. RADAR terá SKU próprio mais tarde.

Nomes anteriores (NIDO / RUMO / PULSO) redirecionam para estas rotas.

| Produto | Para quem | O que é | Rota |
|---------|-----------|---------|------|
| **AURORA** | técnicos, consultores, incubadoras | Incubadora virtual: mesmo método, carteira humana | `/hub/aurora` |
| **POLARIS** | o negócio sozinho | Mapa de autodesenvolvimento | `/hub/polaris` |
| **RADAR** | operação | Digitalização produtiva (dados, WhatsApp, alertas, automações) | `/hub/radar` |

Método partilhado (AURORA e POLARIS): conversa → retrato editável → hipótese aceite → 2–4 apostas → ritmo semanal. Brechas máx. 5, potenciais máx. 3. Não é score de quiz.

RADAR começa com quatro módulos: agricultura, agroindústria, pecuária, carbono. Liga-se a AURORA/POLARIS por `GET /api/radar/bridge` (`/api/pulso/bridge` continua como alias). Arquitetura, roadmap e fachada agrícola: [etholys-radar.md](./etholys-radar.md).

Contratos AT em `/hub/aurora/contratos` (lista) e `/hub/aurora/at/[id]`. A carteira em `/hub/aurora` é a ronda do técnico (meus, travados, sem dono) e o quadro do método. Programas em `/hub/aurora/programas` agrupam a carteira por contrato AT. O dossiê em `/hub/aurora/dossie` é conversa do técnico (LLM) → retrato editável → hipótese aceite → 2–4 apostas → ritmo. POLARIS reusa jornada, diagnóstico, roadmap e coach. RADAR agricultura usa a fachada `/api/radar/agriculture` por cima das unidades ops; não mostra a central NEXUS nem o retrato. Os dossiês hidratam-se a partir de `NexusDiagnosis`, jornada, roadmap e unidades ops — sem apagar retrato já escrito e sem colar score `/100` no retrato.

`/hub/nexus/campo` redireciona para RADAR. Rotas NEXUS antigas continuam a funcionar.
