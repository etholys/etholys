# AURORA · POLARIS · RADAR

Família que substitui o NEXUS como um único menu. **Licença atual:** a chave `NEXUS` abre os três. RADAR terá SKU próprio mais tarde.

Nomes anteriores (NIDO / RUMO / PULSO) redirecionam para estas rotas.

| Produto | Para quem | O que é | Rota |
|---------|-----------|---------|------|
| **AURORA** | técnicos, consultores, incubadoras | Incubadora virtual: assistência técnica a negócios **externos** | `/hub/aurora` |
| **POLARIS** | o negócio sozinho (interno) | Mapa de autodesenvolvimento: linha base + IA do sistema | `/hub/polaris` |
| **RADAR** | operação | Digitalização produtiva (dados, WhatsApp, alertas, automações) | `/hub/radar` |

## Duas camadas no AURORA (não confundir)

1. **Seletor global Etholys (Hub)** — empresa do grupo / incubadora com a qual estás a operar (`activeCompanyId` / CompanyPicker). É a **operadora** dos contratos AT.
2. **Seletor interno AURORA** — **negócio atendido** (MIPYME externa) + contrato AT (`?company=&engagement=` + `localStorage aurora_attended:<operatorId>`). Nunca usar o seletor Hub como se fosse o negócio diagnosticado.

Fluxo alvo (contínuo): diagnóstico inicial → documento/raio-x → validação técnico↔IA → rota de intervenção (atividades) + chat do técnico → vista do atendido (só raio-x, rota, avanço).

## Carteira e técnicos

- **Cartera** (`/hub/aurora`) = dashboard dos processos de assistência técnica da incubadora ativa.
- Sempre há (ou pode haver) um **técnico** que acompanha cada negócio (claim no dossiê).
- **Admin** da operadora: vê a carteira completa, filtra por técnico, convida técnicos (`/hub/workspace/team` + NEXUS).
- **Técnico** (não-admin): API devolve só negócios **seus** + **sem técnico** (para poder acompanhar).
- Diagnóstico / Dossier **exigem** negócio+contrato na URL; o menu redireciona à carteira se nada estiver selecionado.

## Método e rotas

Método partilhado (AURORA e POLARIS): conversa → retrato editável → hipótese aceite → 2–4 apostas → ritmo semanal. Brechas máx. 5, potenciais máx. 3. Não é score de quiz Likert. Em POLARIS a **linha base** (`/hub/polaris/diagnosis`) radiografa maturidade 1–5 por blocos (mesmo motor do diagnóstico AURORA) antes do guia de autodesenvolvimento; a **IA do sistema** (não há consultor humano externo) junta essa linha base ao brief do ecossistema e só então propõe avanço.

RADAR começa com quatro módulos: agricultura, agroindústria, pecuária, carbono. Liga-se a AURORA/POLARIS por `GET /api/radar/bridge`. Arquitetura: [etholys-radar.md](./etholys-radar.md).

Contratos AT em `/hub/aurora/contratos` e `/hub/aurora/at/[id]`. Programas em `/hub/aurora/programas`. Diagnóstico dinâmico em `/hub/aurora/diagnostico`. Dossiê em `/hub/aurora/dossie`.

`/hub/nexus/campo` redireciona para RADAR. Rotas NEXUS antigas continuam a funcionar.
