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

## Personas (prestador vs produtor)

`Company.radarOrgRole`: `producer` | `provider` | `null`.

| Persona | Espaço | Hierarquia |
|---------|--------|------------|
| **Produtor** | `/hub/radar/producer` | Propriedades próprias + dashboard de alertas |
| **Prestador** | `/hub/radar/provider` | **ClientPicker** (Todos \| cliente) → alertas + propriedades do âmbito |

- Sem papel → ecrã forçado em `/hub/radar` (escolha prestador vs produtor). Não é toggle Empresa|Técnico.
- Criação de empresa pode gravar `radarOrgRole` (`POST /api/companies`). Signup global completo fica para depois; o gate RADAR é a fonte de verdade neste ciclo.
- Modelos: `RadarClient` (prestador), `RadarProperty` (fazenda/unidade), `NexusOpsUnit.propertyId`.

### Âmbito de cliente (prestadora)

Espelho do CompanyPicker do Hub, **sempre visível** na sidebar RADAR (`ProductAppShell.sidebarAfterCompany`):

| Peça | Onde |
|------|------|
| UI | `RadarClientPicker` — «Todos os clientes» \| cada `RadarClient` \| `+ Novo cliente` \| `+ Nova fazenda` |
| Estado | `RadarClientScopeProvider` — URL `?client=` + `localStorage` `radar.clientScope.{companyId}` |
| Cadastro | `RadarCreatePanel` — cliente (nome + contacto) ou fazenda (nome + módulo + cliente); cria e abre o funil da propriedade |
| Home | `RadarProviderHome` — dashboard de alertas + CTAs + lista filtrada |

Produtor: picker de cliente oculto; home com alertas das próprias propriedades.

### Funil da propriedade (progress rail)

1. **Caracterizar** — módulo (`pulsoModule` / `moduleId`), cultura, área  
2. **Desenhar planta** — `RadarSiteMap` + `layoutJson` na propriedade  
3. **Geolocalizar** — lat/lng + pin OSM  
4. **Conectar sensores** — token `nxsens_` (fluxo existente)

Depois de caracterizada (agricultura), a **mesma UI operativa forte** (planta + métricas + canais + cadeia) vive dentro da propriedade. Não há vista Técnico fraca em paralelo.

Rotas: `/hub/radar/properties/[id]`. APIs: `/api/radar/org-role`, `/api/radar/clients`, `/api/radar/properties`, `/api/radar/properties/[id]`, `/api/radar/alerts`.

### Dashboard de alertas globais

`GET /api/radar/alerts?companyId=&clientId=` (opcional; `all` / omitido = carteira inteira na prestadora).

Agrega por propriedade no âmbito: humidade/PHI (board agricultura), sensores em falta, funil incompleto, lotes abertos sem check-in recente, WhatsApp desligado/não configurado. UI: `RadarAlertsDashboard` na central prestadora/produtor.

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
