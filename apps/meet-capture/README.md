# Etholys Meet Capture (desktop)

Shell Electron que abre a captura Etholys (`/hub/meet/capture`) com permissões de
ecrã + microfone — para reuniões **externas** (Zoom, Teams, Google Meet de terceiros).

## Uso rápido (dev)

```bash
cd apps/meet-capture
npm install
npm start
```

Opcional: `ETHOLYS_CAPTURE_URL=https://app.etholys.com/hub/meet/capture npm start`

## Pacote Windows (portable)

```bash
npm run pack:win
```

Gera um executável em `dist/`.

## Sem instalar Electron

No Chrome: abrir [https://app.etholys.com/hub/meet/capture](https://app.etholys.com/hub/meet/capture),
escolher a janela da reunião externa e gravar.
