# Etholys Meet — motor de reuniões (transversal)

**Versão:** 0.2
**Data:** 2026-08-05
**Status:** F0–F6 em código; infra Jitsi/Jibri e chaves R2/STT/OAuth dependem de env + ops
**Público:** product, desenvolvedores, agentes de IA

**Fonte de verdade** para videoconferência, breakouts, convites, gravação, transcrição e pós-reunião com IA no Etholys.  
**Entrada para agentes:** [AGENTS.md](../../AGENTS.md) → este ficheiro.

---

## 1. Princípio

> **Um motor, vários espelhos.** Não existem Zooms separados por módulo.

A sala técnica (Jitsi + metadados + IA) é única. FORGE, SIEP, Hub/**Etholys Tools** e NEXUS são **superfícies** que abrem a mesma reunião com contexto diferente.
Ver [etholys-tools.md](./etholys-tools.md) para a faixa de ferramentas.

| Espelho | Entrada | Contexto | Extra |
|---------|---------|----------|--------|
| **Hub / Etholys Tools** | `/hub/meet` | Solta ou depois vinculada | Entrada genérica |
| **FORGE** | Salão / sessão live | Curso, coorte, `ForgeLiveSession` | Breakouts, presença, capacitação |
| **SIEP** | Reuniões do projeto | `projectId` / atividade | Resumo → tarefas em rascunho |
| **NEXUS** | Hub NEXUS rail / `POST /api/meet/nexus` | Rede / AT / empreendedor | `mirror=nexus` |

**Regra:** o que já funciona no FORGE (Jitsi no salão) **não some**. Consome o motor Meet por baixo (`mirror=forge`).

---

## 2. Capacidades (roadmap)

| Fase | Entrega | Notas |
|------|---------|--------|
| **F0** | Spec + modelos + Hub stub | ✅ |
| **F1** | Sala Jitsi + convite e-mail + `.ics` + breakouts (host UI) | ✅ |
| **F2** | Espelho Hub + vínculo SIEP + espelho FORGE live | ✅ |
| **F3** | Pós-reunião IA + gravação | ✅ resumo/tarefas; **gravação local** no browser → ficheiro no PC/disco do utilizador (sem nuvem Etholys) |
| **F4** | Tarefas pré-criadas + validação → Task SIEP | ✅ |
| **F5** | Transcrição real + atribuição por participante | ✅ Vosk ES + painel Hub; arranque automático ao entrar |
| **F6** | Agenda dia/semana/mês/ano + OAuth Google / Outlook | ✅ API + UI; ligação persistente em `Account`; requer `GOOGLE_CALENDAR_ENABLED=1` / Azure AD |
| **F7** | Salas permanentes + recorrência (diária/semanal/dias úteis/mensal) | ✅ materializa ocorrências; mesmo link da série; apagar esta / seguintes / série |
| **F8** | Captura externa (Zoom/Teams) | ✅ `/hub/meet/capture` + shell Electron `apps/meet-capture` |

### Breakouts

Requisito **cedo** (F1): capacitações online. Breakout via Jitsi self-hosted (não `meet.jit.si`).

### Infra

- App Etholys (Next.js) + Postgres: metadados, convites, resumos, tarefas  
- **Jitsi** no Contabo (piloto): `meet.etholys.com` — [MEET-JITSI-CONTABO.md](../MEET-JITSI-CONTABO.md)
- **Jitsi + Jibri** em VPS separado — [MEET-VPS-JIBRI.md](../MEET-VPS-JIBRI.md)
- **R2/S3** para gravações (`AWS_*` / `R2_*`)
- **Jigasi + Google Speech ou Whisper compatível** para STT ao vivo por participante
- **Whisper pós-reunião** (`OPENAI_API_KEY`) para ficheiros já gravados
- **Claude** para resumo / action items / briefing

---

## 3. Modelo conceptual

```mermaid
flowchart TB
  subgraph motor [Etholys Meet]
    Session[MeetSession]
    Part[MeetParticipant]
    Action[MeetActionItem]
  end

  Session --> Part
  Session --> Action
  Session -.->|opcional| Project[SIEP Project]
  Session -.->|opcional| Live[ForgeLiveSession]
  Action -.->|após validação| Task[SIEP Task]
```

---

## 4. Código (onde implementar)

```
apps/web/
  app/hub/meet/                 # espelho Hub
  app/hub/meet/[sessionId]/     # sala + transcrição ao vivo + gravação
  app/api/meet/sessions/        # CRUD, ics, invite, finalize, briefing
  app/api/meet/sessions/[id]/recording/
  app/api/meet/sessions/[id]/transcribe/
  app/api/meet/sessions/[id]/transcript/
  app/api/meet/sessions/[id]/calendar/
  app/api/meet/calendar/connections/ # estado OAuth persistente do utilizador
  app/api/meet/webhooks/jibri/
  app/api/meet/nexus/           # espelho NEXUS
  lib/meet/                     # room, ICS, bridges, R2, STT, calendário
  prisma/schema.prisma          # MeetSession, MeetParticipant, MeetTranscriptSegment, MeetActionItem
```

---

## 5. Relação com CARTA / Advisor

- **Meet** = comunicação síncrona + memória da reunião  
- **CARTA** = aprovações / governança  
- **Advisor** = alerta `meet_actions_pending` quando há rascunhos por validar (+ notificação ao host no finalize)

Não fundir os três produtos.

---

## 5b. Visual in-call (estilo Google Meet)

| Camada | O quê | Limite |
|--------|--------|--------|
| **Chrome Etholys** (`MeetRoomClient`) | Top bar (hora + título + info), contagem de participantes, painel de transcrição, fundo `#202124`, iframe com cantos arredondados | Não controla ícones/tiles *dentro* do iframe |
| **External API** (`MeetConferenceFrame`) | `configOverwrite` / `interfaceConfigOverwrite`: sem watermark Jitsi, filmstrip vertical, toolbar ordenada, fundo charcoal | Algumas opções dependem da versão do web Jitsi |
| **Servidor** (`infra/jitsi/*` + `apply-jitsi-branding.sh`) | `custom-config.js`, `custom-interface_config.js`, `custom-meet.css` (raio nos tiles/toolbox) | CSS/patches estáticos somem se o contentor web for **recriado** sem rerun do script |

Deploy branding só Jitsi (sem rebuild app): `bash scripts/apply-jitsi-branding.sh` no Contabo.

---

## 6. Critérios de sucesso (piloto capacitação)

1. Facilitador abre sessão FORGE com breakouts estáveis (Jitsi self-hosted)
2. Convite por e-mail com Google/Outlook + `.ics`; convidados do evento recebem RSVP do provedor
3. Participantes entram pelo curso **ou** Hub Meet
4. Encerra → gravação (Jibri/upload) → STT opcional → resumo + ações editáveis

Última atualização: **agosto 2026**.
