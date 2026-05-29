# Arranque no Windows (Etholys)

## Erro `dockerDesktopLinuxEngine` / "The system cannot find the file specified"

O **Docker Desktop não está a correr**. O CLI `docker` existe, mas o motor (engine) está parado.

### O que fazer

1. Abra **Docker Desktop** no menu Iniciar.
2. Espere o estado **Engine running** (ícone verde na bandeja).
3. Volte a executar `open-etholys-local.bat` na raiz do projeto.

O script `open-etholys-local.bat` agora tenta **iniciar o Docker Desktop** e espera até ~3 minutos pelo motor.

### Se não tiver Docker instalado

- Instale [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
- Reinicie o PC após a instalação se o pipe continuar em falha.

---

## Duas formas de desenvolver

| Script | O que sobe | Quando usar |
|--------|------------|-------------|
| `open-etholys-local.bat` | Postgres + API + Next **dentro** do Docker | Ambiente igual ao da equipa; primeira vez demora (npm install no contentor) |
| `open-etholys-dev-local.bat` | Só **Postgres** no Docker; **Next.js no Windows** (`npm run dev`) | Mais rápido no dia a dia; precisa de Node 20+ no PC |

Ambos usam Postgres em **localhost:5433** (ver `apps/web/.env`).

### Só base de dados

```powershell
cd infra
docker compose up -d postgres
cd ..\apps\web
npx prisma migrate deploy
npm run dev
```

### Variáveis mínimas

Copie `apps/web/.env.example` → `apps/web/.env` e confirme:

```env
DATABASE_URL="postgresql://etholys:etholys_dev_change_me@localhost:5433/etholys"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="um-segredo-longo-aleatorio"
```

---

## Browser `chrome-error://` em localhost:3000

Normalmente o **servidor Next não está a correr** ou a porta 3000 ainda não respondeu.

- Stack Docker: `docker compose logs -f web` em `infra/`
- Dev local: terminal com `npm run dev` em `apps/web`
- Aguarde 1–3 min na primeira subida e recarregue (F5)
