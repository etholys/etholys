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

## Arquitetura

Seis camadas. Os quatro módulos de entrada (agricultura, agroindústria, pecuária, carbono) mudam o vocabulário e as regras. O laço é o mesmo.

```
Escolha do módulo (pulsoModule)
        │
        ▼
Fachada do módulo  (/hub/radar + /api/radar/<módulo>)
        │
        ▼
Núcleo operativo   unidades · caderno · leituras · regras
        │
        ├── canal app
        ├── canal WhatsApp   (/api/nexus/whatsapp/*)
        └── canal sensor     token nxsens_ · POST /api/nexus/ingest/readings
        │
        ▼
Cadeia produtiva   RadarLot · colheita → transformação → transporte → venda
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
| Módulo escolhido | dossiê `pulsoModule` | `agriculture` \| `agroindustry` \| `livestock` \| `carbon` |
| Unidade | `NexusOpsUnit` | parcela, lote, rebanho |
| Caderno | `NexusFieldEntry` | linha com `channel` app \| whatsapp \| sensor |
| Leitura | `NexusReading` | manual, sensor ou HTTP |
| Sensor | `NexusSensor` | token em hash; o claro só na criação |
| WhatsApp | `NexusWhatsappLink` | um telefone por empresa |
| Regra | `NexusOpsRule` | `irrigation`, `whatsapp_alerts` (ventilação fica fora da agricultura) |
| Lote (cadeia) | `RadarLot` | código humano + `publicToken`; estágio atual |
| Evento de lote | `RadarLotEvent` | colheita / transformação / transporte / venda |

Protocolos e limiares vivem em código (`lib/nexus-sector-modules/`, `lib/radar/`), não em score de diagnóstico.

### Cadeia produtiva (traçabilidade)

Pergunta do ecrã: **onde está este lote, agora?**

O lote nasce na **colheita** (não é um 5.º módulo na nav). Fluxo: colheita → transformação → transporte → comercialização. Avanço só para a etapa seguinte (ou evento extra na mesma).

- Hub: secção **Cadeia** em Agricultura — abrir lote, avançar, copiar link.
- APIs: `GET/POST /api/radar/lots`, `GET /api/radar/lots/[id]`, `GET /api/radar/lots/public/[token]`.
- Partilha: `/radar/lote/[token]` — comprador/auditor sem login; sem telefones, tokens de sensor nem IDs internos.
- Fora deste ciclo: QR gráfico, blockchain, SKU próprio.

Lib: `lib/radar/trace.ts`.

### Módulos

| Id | Unidade | O que mede | Estado |
|----|---------|------------|--------|
| `agriculture` | parcela | humidade, irrigação (mm), carência (PHI), caderno | **fechado** — primeiro módulo |
| `livestock` | rebanho | sanidade, alimento, mortalidade | mesmo laço, a seguir |
| `agroindustry` | lote | perda, qualidade, planta | mesmo laço, a seguir |
| `carbon` | leitura | práticas e emissões a partir dos outros três | rótulo até haver caderno real |

Carbono não abre caderno próprio. Lê práticas já registadas.

### O que a fachada agrícola faz

A pergunta do ecrã: **o que fazer hoje**. Não é um cadastro.

`GET /api/radar/agriculture` devolve `decision` (`open_farm` | `irrigate` | `hold_harvest` | `scout` | `ok`) e parcelas com humidade, última irrigação, carência e `nextAction`.

`POST` abre a exploração com uma parcela, regista irrigação (10 mm se não disser), pede confirmação no WhatsApp, liga o telemóvel e emite token de sensor só quando o canal ainda não lê.

Prioridade da decisão: não colher (PHI) → irrigar (humidade &lt; 25%) → percorrer (caderno parado) → em critério.

O Hub é o monitor. O WhatsApp é o canal do campo.

O vínculo do telefone continua em `/api/nexus/whatsapp/link`. O ingest HTTP continua em `/api/nexus/ingest/readings`. São canais partilhados; a fachada é que os mostra dentro do módulo.

Alertas no ecrã seguem sempre os protocolos de agricultura. A mensagem automática de WhatsApp ainda usa o setor da empresa (`deriveOpsAlerts`) até o canal passar a ser dono do módulo RADAR.

## Roadmap

1. **Agricultura** — a exploração abre sozinha. O ecrã diz o que fazer hoje (irrigar, não colher, ouvir o campo). WhatsApp é o canal. Fechado.
2. **Traçabilidade (cadeia)** — lote na colheita → transformação → transporte → venda; link público. Fechado neste ciclo.
3. **Pecuária** — o mesmo laço com rebanho, sanidade, alimento e mortalidade.
4. **Agroindústria** — lotes industriais, perda e qualidade (além da cadeia agrícola).
5. **Carbono** — primeira leitura de práticas a partir do caderno dos três módulos. Sem UI de dossiê.
6. **IA** — ler o caderno e propor um comando (irrigar ou não). A saída pede confirmação no WhatsApp; não actua sozinha.
7. **SKU RADAR** — licença própria. Fora deste ciclo. Até lá, `NEXUS`.

## Fora de âmbito

- Retrato, brechas, potenciais e apostas na UI do RADAR.
- Menu ou fluxo partilhado com AURORA ou POLARIS.
- Migration para renomear `pulsoModule`.
- QR gráfico, blockchain ou SKU próprio só para traçabilidade.
- Rebuild de Postgres, Caddy ou Jitsi. Deploy de UI é só `etholys-web`.
