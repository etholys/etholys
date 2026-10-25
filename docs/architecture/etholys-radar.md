# RADAR — digitalização produtiva

Data: setembro 2026. Licença atual: chave `NEXUS`. SKU próprio do RADAR fica para depois — não inventar neste ciclo.

RADAR é a operação: dados, eficiência, automação, WhatsApp in/out, alertas, IA e sensores. Não é incubadora (AURORA) nem mapa de autodesenvolvimento (POLARIS). Não mostra dossiê, retrato nem apostas.

## Fronteira

| | RADAR | AURORA / POLARIS |
|--|--------|------------------|
| Pergunta | O que está a acontecer na exploração, agora? | Quem é o negócio e que aposta faz? |
| UI | `/hub/radar` | `/hub/aurora`, `/hub/polaris` |
| Ligação | `GET /api/radar/bridge` — só API interna | O retrato e as apostas ficam lá |
| Campo do módulo | `pulsoModule` (sem migration) | Não escrevem o módulo RADAR |

`/hub/nexus/campo` e `/hub/pulso` redirecionam para `/hub/radar`.

## Modelo de produto (empresa única)

RADAR é **sempre a empresa** no Etholys — um produto, uma central. Não há gate prestador vs produtor.

| Peça | Comportamento |
|------|----------------|
| **Âmbito** | Seletor **Propriedades** na sidebar: **Minha operação** \| **Cliente (empresa)** \| **Todos (carteira)**; botão **+** → Novo cliente \| Novo espaço |
| **Caso zero** | Só a minha fazenda — propriedades com `clientId` null; sem clientes nem técnicos obrigatórios |
| **Clientes** | Opcionais. Criar novo **ou** vincular empresa AURORA/ATER (`linkedCompanyId`). Um cliente pode ter vários espaços (horta + agroindústria + animais). |
| **Técnicos** | Da lista de funcionários; atribuição por cliente/propriedade em escala; flags `canSeeAll` / `canCreateClients` |
| **Home** | `/hub/radar` — **painel** (KPIs + «precisa atenção» + lista compacta de lugares/empresas). Não é lista gigante de cartões nem muro de alertas. |
| **Empresa** | `/hub/radar/empresas/[id]` — perfil do cliente: avisos desse âmbito + lugares com ação Abrir → mapa/Caderno |
| **Arquivar / apagar** | Cliente e lugar: menu **⋯** nas listas do painel e no perfil da empresa. Soft via `archivedAt` (sai do seletor/listas; unidades do lugar desativadas). «Apagar do mapa» continua só footprint. |
| **Nav** | Painel · Cadeia · **Caderno** · Tarefas · Equipa |
| **Caderno** | `/hub/radar/caderno` — gesto diário (campo / SOP); `NexusFieldEntry` via `/api/radar/entries`. Mapa e 3D ficam em Ver. Modelado a práticas de caderno de campo (papel), sem clonar o PDF página a página — ver secção abaixo. |
| **Tarefas** | `/hub/radar/tarefas` — lista curta a partir de alertas (prioridade), não grelha LED |
| **Cadeia** | `/hub/radar/cadeia` — lotes / custódia |
| **Equipa** | `/hub/radar/equipa` — técnicos + clientes (admin) |

Rotas legadas `/hub/radar/provider` e `/hub/radar/producer` redireccionam para `/hub/radar`.

`Company.radarOrgRole` fica só por compatibilidade e **não governa a UI**.

APIs: `/api/radar/clients` (`?aurora=1`), `/api/radar/properties`, `/api/radar/technicians`, `/api/radar/alerts?clientId=own|all|<id>`.

### Funil da propriedade (progress rail)


1. **Caracterizar** — módulo (`pulsoModule` / `moduleId`), cultura, área  
2. **Desenhar planta** — `RadarSiteMap` + `layoutJson` na propriedade  
3. **Geolocalizar** — lat/lng + pin OSM  
4. **Conectar sensores** — token `nxsens_` (fluxo existente)

Depois de caracterizada (agricultura), a **mesma UI operativa forte** (planta + métricas + canais + cadeia) vive dentro da propriedade. Não há vista Técnico fraca em paralelo.

Rotas: `/hub/radar/properties/[id]`. APIs: `/api/radar/org-role`, `/api/radar/clients`, `/api/radar/properties`, `/api/radar/properties/[id]`, `/api/radar/alerts`.

### Dashboard de alertas globais

`GET /api/radar/alerts?companyId=&clientId=` (opcional; `all` / omitido = carteira inteira na prestadora).

Agrega por propriedade no âmbito: humidade/PHI (board agricultura), sensores em falta, funil incompleto, lotes abertos sem check-in recente, WhatsApp desligado/não configurado. Alimenta o badge «atenção» no mapa e a lista em `/hub/radar/tarefas` — não a home como grelha LED.

Cartões: severity · cliente · propriedade · mensagem · link para `/hub/radar/properties/[id]`.

## Arquitetura

Seis camadas. Os quatro módulos de entrada (agricultura, agroindústria, pecuária, carbono) mudam o vocabulário e as regras. O laço é o mesmo.

```
Escolha de persona (radarOrgRole)
        │
        ├── provider → clientes → propriedades
        └── producer → propriedades
                │
                ▼
        Funil da propriedade (caracterizar → planta → geo → sensores)
                │
                ▼
Fachada do módulo  (ops UI única + /api/radar/<módulo>)
        │
        ▼
Núcleo operativo   unidades · caderno · leituras · regras
        │
        ├── canal app
        ├── canal WhatsApp   (/api/nexus/whatsapp/*)
        └── canal sensor     token nxsens_ · POST /api/nexus/ingest/readings
        │
        ▼
Cadeia de custódia  RadarLot · check-in por etapa (geo + foto + QR)
        │           Hub autentica · /radar/lote/[token] partilha pública
        ▼
Alertas do módulo  (protocolos em código, sem dossiê)
        │
        ▼
Saída              ecrã do módulo · WhatsApp (alerta e pedido de comando)
```

A ponte `GET /api/radar/bridge` lê o vínculo (módulo gravado, se existe retrato, quantas apostas abertas) para outros produtos. A UI do RADAR não renderiza esse conteúdo.

### Dados

| Peça | Modelo | Uso no RADAR |
|------|--------|----------------|
| Persona | `Company.radarOrgRole` | `producer` \| `provider` |
| Cliente (prestador) | `RadarClient` | carteira sob `providerCompanyId` |
| Propriedade | `RadarProperty` | fazenda; `layoutJson`, lat/lng, `moduleId` |
| Módulo escolhido | dossiê `pulsoModule` | `agriculture` \| `agroindustry` \| `livestock` \| `carbon` |
| Unidade | `NexusOpsUnit` | parcela sob `propertyId` |
| Caderno | `NexusFieldEntry` | linha com `channel` app \| whatsapp \| sensor |
| Leitura | `NexusReading` | manual, sensor ou HTTP |
| Sensor | `NexusSensor` | token em hash; o claro só na criação |
| WhatsApp | `NexusWhatsappLink` | um telefone por empresa |
| Regra | `NexusOpsRule` | `irrigation`, `whatsapp_alerts` |
| Lote (cadeia) | `RadarLot` | código humano + `publicToken` |
| Check-in | `RadarLotEvent.payloadJson` | `lat`, `lng`, `photoUrl`, `checkedInAt`, nota |
| Planta 2D (legado empresa) | `RadarSiteLayout` | fallback; preferir `RadarProperty.layoutJson` |

Protocolos e limiares vivem em código (`lib/nexus-sector-modules/`, `lib/radar/`), não em score de diagnóstico.

### Cadeia de custódia (traçabilidade)

Não é “onde está o lote?” em texto livre. É **check-in por etapa** com evidência:

| Etapa | Evidência mínima |
|-------|------------------|
| colheita → transformação → transporte → venda | timestamp + **lat/lng** (+ foto recomendada) |

- Avançar etapa = `action: checkin` em `POST /api/radar/lots` (geo obrigatória; foto via `photoDataUrl` → R2/local).
- Abrir lote na colheita também exige geo (primeiro check-in).
- QR + link público: `/radar/lote/[token]` mostra timeline com hora, GPS, thumbs de foto e QR de verificação.
- Fora deste ciclo: blockchain, SKU próprio, OCR de etiqueta.

Lib: `lib/radar/trace.ts`, `lib/radar/evidence-upload.ts`.

### Caderno de campo (agricultura)

O Caderno digital segue a estrutura útil de um caderno de campo real (ex.: PIB / produção integrada), priorizando o que o produtor preenche em repetição — não o checklist de auditoria completo.

Secções / tipos de registo (agricultura):

- **Sementeira / plantio** — cultivar, n.º de plantas, densidade, área
- **Adubação** — fertilizante, dose (kg ou L/ha), área
- **Fitossanitário / insumo** — produto, dose, coadjuvante, praga/doença, volume de calda, área, **carência (PHI)**
- **Irrigação** — lâmina (mm), tempo, frequência
- **Tratos culturais** — ensacamento, desbaste, escoramento, roçada, capina, etc.
- **Monitoramento de pragas (MIP)** — presença, nível, espécie
- **Colheita** — quantidade, peso (kg), rendimento (kg/ha)
- **Clima / evento** — geada, granizo, cheia, seca, vento, chuva torrencial
- **Observação** e **visita técnica** — notas livres

Schemas de campos: `lib/radar/caderno-fields.ts`. UI: `RadarCadernoBoard`. API: `/api/radar/entries`.

Fora do digital (ainda papel / futuro): identificação CNPE completa, tabelas de perdas anuais por praga, dados físico-hídricos do solo (CC/PMP), calibração de pulverizador, listas de auditoria PIB, anexos de análise foliar/solo.

### Módulos

| Id | Unidade | O que mede | Estado |
|----|---------|------------|--------|
| `agriculture` | parcela | humidade, irrigação (mm), carência (PHI), caderno | **fechado** — primeiro módulo |
| `livestock` | rebanho | sanidade, alimento, mortalidade | mesmo laço, a seguir |
| `agroindustry` | lote | perda, qualidade, planta | mesmo laço, a seguir |
| `carbon` | leitura | práticas e emissões a partir dos outros três | rótulo até haver caderno real |

Carbono não abre caderno próprio. Lê práticas já registadas.

### UI operativa (uma só)

Uma superfície forte (`RadarOpsView`, ex-Empresa): planta 2D, métricas, canais, cadeia com check-in. Técnico de campo usa a **mesma** UI — não há toggle Empresa|Técnico nem vista alternativa fraca.

`GET /api/radar/agriculture` devolve `decision`, `parcels`, `spaces` / `hasSpaces`.

Prioridade da decisão: não colher (PHI) → irrigar (humidade &lt; 25%) → percorrer (caderno parado) → em critério.

O Hub é o monitor. O WhatsApp é o canal do campo.

### Planta 2D (mapa operativo)

| Peça | Onde |
|------|------|
| Layout (propriedade) | `RadarProperty.layoutJson` |
| Layout (legado) | `RadarSiteLayout.layoutJson` |
| API | `GET/PATCH /api/radar/layout` (`propertyId` opcional) |
| UI | `RadarSiteMap` — tiles com estado, sensores, arrastar + guardar |

Espaços vêm dos `NexusOpsUnit` da propriedade. Sem layout guardado, a API devolve grelha automática.

O vínculo do telefone continua em `/api/nexus/whatsapp/link`. O ingest HTTP continua em `/api/nexus/ingest/readings`.

Alertas no ecrã seguem sempre os protocolos de agricultura. A mensagem automática de WhatsApp ainda usa o setor da empresa (`deriveOpsAlerts`) até o canal passar a ser dono do módulo RADAR.

## Roadmap

1. **Agricultura** — decisão ao vivo + WhatsApp. Fechado.
2. **Traçabilidade (cadeia de custódia)** — check-in geo/foto/QR por etapa. Fechado neste ciclo (esqueleto presentável).
3. **Personas + propriedades + âmbito** — prestador/produtor, ClientPicker, cadastro cliente/fazenda, dashboard de alertas. Fechado neste ciclo (esqueleto presentável).
4. **Pecuária / agroindústria / carbono** — mesmo laço.
5. **IA** — ler o caderno e propor comando (confirmação WhatsApp).
6. **SKU RADAR** — licença própria. Fora deste ciclo. Até lá, `NEXUS`.

## Fora de âmbito

- Retrato, brechas, potenciais e apostas na UI do RADAR.
- Menu ou fluxo partilhado com AURORA ou POLARIS.
- Migration para renomear `pulsoModule`.
- Vista Técnico paralela / toggle Empresa|Técnico.
- GIS completo, 3D, blockchain.
- Rebuild de Postgres, Caddy ou Jitsi. Deploy de UI é só `etholys-web`.

## Demos para apresentações (clientes)

Dois tenants re-runnable (upsert). Senha partilhada: env `SANDBOX_PASSWORD` ou default interno `EtholysSandbox2026!` (não commitar segredos em `.env`).

| Conta | Empresa | O que mostra |
|-------|---------|--------------|
| `demo.campo.novo@etholys.com` | Campo Novo (`CampoNovo`) | First-run: sem propriedade, mapa/Caderno vazios, funil Caracterizar → Desenhar → Geolocalizar → Sensores |
| `master.horizonte@etholys.com` | Horizonte Verde (`Horizonte`) | Avançado: Finca escuela pin OSM (Praça do Buriti), 4 espaços colocados/rodados, cultivos, sondas, Caderno, lotes, alertas |

Refresh após updates de produto (local ou Contabo, com `DATABASE_URL` da BD alvo):

```bash
cd apps/web
npm run seed:radar-demos
# equivalente: npx tsx --require dotenv/config scripts/seed-radar-demos.ts
```

Código: `lib/sandbox/seed-radar-demos.ts`, script `scripts/seed-radar-demos.ts`. A fazenda avançada também é actualizada por `npm run seed:sandbox` (`enrichSandboxPresentation` → `seedRadarFarm`).

### Apagar no mapa (semântica)

| Acção | Efeito |
|-------|--------|
| **Apagar do mapa** | Remove só o footprint (`placed: false`); o espaço fica na lista |
| **Apagar espaço** | Soft-delete do `NexusOpsUnit` + remove do `layoutJson` (e desactiva sensores do espaço) |
| Cultivos / sensores / Caderno | Trash com confirmação; Caderno via `DELETE /api/radar/entries` |
