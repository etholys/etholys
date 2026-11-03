# Etholys — centro de notificações + Web Push

## O que existe

- **In-app:** modelo `Notification`, API `/api/notifications`, sino no Hub (`/hub`), eTask (`/hub/work`) e FORGE.
- **Toasts online:** `NotificationToasts` no `Providers` (banner enquanto a sessão está aberta).
- **Web Push (browser):** `PushSubscription` + service worker (`public/sw.js`) + `/api/push/*`.

Emails de eTask (`task-notify.ts`) **continuam** a ser enviados; as notificações in-app/push são criadas em paralelo.

## Eventos Work → notificação

| Evento | Destinatários |
|--------|----------------|
| Comentário | Papéis na atividade (executor, responsável, revisor, criador, TaskPerson) |
| Menção | Utilizadores mencionados |
| Mudança de estado | Idem papéis |
| Nova atribuição / papel | Pessoa adicionada |
| Revisão / entrega / handoff | Destinatário da ação |
| Decisão de aprovação | Solicitante |
| Aceite de partilha de tablero | Quem convidou (`invitedById`) |

## Env (Web Push)

```bash
npx web-push generate-vapid-keys
```

No servidor (`apps/web/.env` / compose):

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public>
VAPID_PRIVATE_KEY=<private>
VAPID_SUBJECT=mailto:ops@etholys.com
```

Sem estas chaves: o centro in-app e os toasts funcionam; o browser push fica desativado (`/api/push/vapid-public-key` → `enabled: false`).

## Migração

`prisma/migrations/20261103180000_notifications_push` — colunas `companyId`/`taskId`/`readAt` em `Notification` + tabela `PushSubscription`.
