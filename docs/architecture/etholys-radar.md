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

Cinco camadas. Os quatro módulos de entrada (agricultura, agroindústria, pecuária, carbono) mudam o vocabulário e as regras. O laço é o mesmo.

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
Alertas do módulo  (protocolos em código, sem dossiê)
        │
        ▼
Saída              ecrã do módulo · WhatsApp (alerta e pedido de comando)
```

A ponte `GET /api/radar/bridge` lê o vínculo (módulo gravado, se existe retrato, quantas apostas abertas) para outros produtos. A UI do RADAR não renderiza esse conteúdo.

### Dados (modelos já existentes)

Sem tabelas novas neste ciclo.

| Peça | Modelo | Uso no RADAR |
|------|--------|----------------|
| Módulo escolhido | dossiê `pulsoModule` | `agriculture` \| `agroindustry` \| `livestock` \| `carbon` |
| Unidade | `NexusOpsUnit` | parcela, lote, rebanho |
| Caderno | `NexusFieldEntry` | linha com `channel` app \| whatsapp \| sensor |
| Leitura | `NexusReading` | manual, sensor ou HTTP |
| Sensor | `NexusSensor` | token em hash; o claro só na criação |
| WhatsApp | `NexusWhatsappLink` | um telefone por empresa |
| Regra | `NexusOpsRule` | `irrigation`, `whatsapp_alerts` (ventilação fica fora da agricultura) |

Protocolos e limiares vivem em código (`lib/nexus-sector-modules/`), não em score de diagnóstico.

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

1. **Agricultura** — a exploração abre sozinha. O ecrã diz o que fazer hoje (irrigar, não colher, ouvir o campo). WhatsApp é o canal. Este ciclo.
2. **Pecuária** — o mesmo laço com rebanho, sanidade, alimento e mortalidade.
3. **Agroindústria** — lotes, perda e qualidade.
4. **Carbono** — primeira leitura de práticas a partir do caderno dos três módulos. Sem UI de dossiê.
5. **IA** — ler o caderno e propor um comando (irrigar ou não). A saída pede confirmação no WhatsApp; não actua sozinha.
6. **SKU RADAR** — licença própria. Fora deste ciclo. Até lá, `NEXUS`.

## Fora de âmbito

- Retrato, brechas, potenciais e apostas na UI do RADAR.
- Menu ou fluxo partilhado com AURORA ou POLARIS.
- Migration para renomear `pulsoModule`.
- Rebuild de Postgres, Caddy ou Jitsi. Deploy de UI é só `etholys-web`.
