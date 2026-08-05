# Etholys Meet — VPS dedicado + Jibri → R2

**Complementa:** [MEET-JITSI-CONTABO.md](./MEET-JITSI-CONTABO.md) (piloto no mesmo Contabo da app)  
**Produto:** [architecture/etholys-meet.md](./architecture/etholys-meet.md)

Quando a app e o Postgres já consomem RAM no Contabo, **Jitsi + Jibri (gravação)** devem ir para um **VPS 2** (≥ 8 GB RAM, disco SSD generoso).

---

## Arquitectura alvo

```
Browser
  ├─ app.etholys.com     → Contabo 1 → Next.js / Postgres
  └─ meet.etholys.com    → Contabo 2 (ou Hetzner) → Jitsi + Jigasi + Jibri
         ├─ Jigasi → STT ao vivo → evento por participante → app/Postgres
         │
         └─ finalize hook → POST https://app.etholys.com/api/meet/webhooks/jibri
                              Authorization: Bearer $MEET_JIBRI_WEBHOOK_SECRET
                              → upload R2/S3 → MeetSession.recordingUrl
                              → (opcional) Whisper STT → transcript / finalize IA
```

---

## Checklist VPS 2

1. [ ] DNS `meet` → IP do VPS 2 (Cloudflare **DNS only**)
2. [ ] Firewall: TCP 80/443, UDP **10000**, SSH
3. [ ] Instalar docker-jitsi-meet + **Jigasi transcriber** + **Jibri** (ver [jitsi-meet handbook](https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker))
4. [ ] `JITSI_BASE_URL=https://meet.etholys.com` na app (Contabo 1)
5. [ ] Bucket R2 (ou S3) + env na app (ver abaixo)
6. [ ] `MEET_JIBRI_WEBHOOK_SECRET` partilhado app ↔ script finalize
7. [ ] Script pós-gravação chama o webhook Etholys

---

## Env na app (`apps/web/.env`)

```env
# Jitsi (VPS 2)
JITSI_BASE_URL=https://meet.etholys.com
NEXT_PUBLIC_JITSI_BASE_URL=https://meet.etholys.com

# Object storage (Cloudflare R2 ou S3)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_BUCKET_NAME=etholys-meet
AWS_FOLDER_PREFIX=prod/
# R2:
R2_ACCOUNT_ID=...
# ou AWS_ENDPOINT_URL=https://<accountid>.r2.cloudflarestorage.com
AWS_PUBLIC_BASE_URL=https://media.etholys.com
# (opcional) R2_PUBLIC_BASE_URL=...

# Webhook Jibri
MEET_JIBRI_WEBHOOK_SECRET=gere-um-segredo-longo

# A app expõe os controlos apenas depois de os serviços estarem operacionais
MEET_LIVE_TRANSCRIPTION_ENABLED=1
MEET_CLOUD_RECORDING_ENABLED=1

# Transcrição (Whisper)
OPENAI_API_KEY=sk-...
# MEET_TRANSCRIBE_MODEL=whisper-1
```

---

## Transcrição real ao vivo (Jigasi)

Não confundir com transcrever um MP4 depois da reunião. O **Jigasi** entra na
sala, recebe o áudio dos participantes e o Jitsi emite
`transcriptionChunkReceived` com:

- `participant.id`
- `participant.name` (nome escolhido ao entrar)
- texto parcial e final

A app persiste os trechos finais em `MeetTranscriptSegment` e mostra:
`Nome do participante — texto`. Ao encerrar, a transcrição completa alimenta
o resumo e as tarefas.

No VPS Jitsi:

```bash
cd /opt/jitsi-docker
# configurar um backend STT suportado no .env:
ENABLE_TRANSCRIPTIONS=1
JIGASI_TRANSCRIBER_ENABLE_SAVING=1
JIGASI_TRANSCRIBER_RECORD_AUDIO=1

# Opção A: credenciais Google Cloud Speech (GC_PROJECT_ID, GC_PRIVATE_KEY_ID,
# GC_PRIVATE_KEY, GC_CLIENT_EMAIL, GC_CLIENT_ID, GC_CLIENT_CERT_URL)
#
# Opção B: endpoint Whisper compatível:
# JIGASI_TRANSCRIBER_WHISPER_URL=https://...

docker compose -f docker-compose.yml -f transcriber.yml up -d
docker compose -f docker-compose.yml -f transcriber.yml logs -f transcriber
```

Depois, na app: `MEET_LIVE_TRANSCRIPTION_ENABLED=1` e reiniciar `web`.

**Identidade:** o nome vem do display name no Jitsi, não de diarização
probabilística de um áudio misto. Participantes devem entrar com o nome correto.

---

## Destino da gravação

Na sala, **Gravar** oferece:

1. **Este computador** (`mode=local`) — o browser descarrega o ficheiro ao
   parar; o utilizador escolhe onde guardar pelo diálogo do browser.
2. **Nuvem Etholys** (`mode=file`) — requer Jibri; o ficheiro é enviado para
   R2 pelo webhook e associado a `MeetSession.recordingUrl`.

Jibri e Jigasi são serviços diferentes: Jigasi transcreve; Jibri grava vídeo.

---

## Webhook (payload)

`POST /api/meet/webhooks/jibri`

```json
{
  "roomSlug": "etholys-meet-xxxx",
  "fileUrl": "https://meet-internal/.../recording.mp4",
  "transcribe": true,
  "finalize": false
}
```

Alternativas: `recordingUrl` (já público), `fileBase64`, ou `sessionId` em vez de `roomSlug`.

Com `finalize: true` a app gera resumo IA + `MeetActionItem` drafts e alerta o Advisor.

---

## Upload manual (sem Jibri)

No Hub Meet → Pós-reunião → **Enviar gravação** (presign R2) → **Transcrever**.

---

## RAM / operação

| Peça | Nota |
|------|------|
| Jibri | 1 gravação activa ≈ 2–4 GB RAM + CPU |
| Contabo 1 | Pode **parar** Jitsi local se tudo estiver no VPS 2 |
| Disco | Gravações longas: preferir enviar logo para R2 e apagar local |

Última actualização: **agosto 2026**.
