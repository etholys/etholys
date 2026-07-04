# Deploy — Contabo + Cloudflare (Etholys / FORGE)

Guia principal para produção. O servidor actual é **Contabo VPS** (não Hetzner).

> Metodología V2: [DEPLOY-EXPEDICION-V2.md](./DEPLOY-EXPEDICION-V2.md)  
> Convites e turma: [PUBLICAR-EXPEDICION.md](./PUBLICAR-EXPEDICION.md)  
> Guia legado Hetzner (referência): [DEPLOY-HETZNER-CLOUDFLARE.md](./DEPLOY-HETZNER-CLOUDFLARE.md)

---

## Visão geral

```
[Celular/PC] → HTTPS → Cloudflare → Contabo VPS (Caddy :443) → Next.js :3000 → Postgres
```

| Peça | Função |
|------|--------|
| **Cloudflare** | DNS + HTTPS para visitantes |
| **Contabo VPS** | Ubuntu, Docker, **8 GB RAM** recomendado para V2 |
| **Caddy** | SSL Let's Encrypt + reverse proxy |
| **Next.js** | App FORGE / La Expedición |
| **Postgres** | Base de dados |

IP exemplo do projeto (verificar no painel Contabo): `84.247.187.155`

---

## Parte 1 — VPS Contabo

### 1.1 Contratar / dimensionar

1. [Contabo](https://contabo.com) → VPS
2. **Ubuntu 24.04**, **8 GB RAM** (VPS M ou equivalente)
3. Anotar IP público e senha root (e-mail Contabo)

### 1.2 Bootstrap inicial (Windows)

No PC, a partir da raiz do repo:

```powershell
.\infra\scripts\contabo-bootstrap.ps1
# ou: -ServerIp "SEU_IP"
```

O script instala chave SSH, corre setup remoto (Docker, UFW, swap 4 GB).

### 1.3 Setup manual (SSH)

Se preferir, no servidor:

```bash
ssh root@SEU_IP_CONTABO
bash -s < infra/scripts/contabo-server-setup.sh
```

Abre portas **22, 80, 443** (UFW). Swap 4 GB ajuda no `npm run build`.

---

## Parte 2 — Cloudflare DNS

1. Domínio na Cloudflare (ex. `forge.etholys.com`)
2. Registo **A** → IP da Contabo
3. Proxy laranja (HTTPS) activo
4. SSL/TLS → **Full (strict)** quando Caddy tiver certificado

---

## Parte 3 — Código no servidor

```bash
ssh root@SEU_IP_CONTABO
mkdir -p /opt/etholys && cd /opt/etholys
git clone https://github.com/SEU_ORG/Etholys.git .
# ou git pull após primeiro deploy
```

### Variáveis (`apps/web/.env`)

```env
DATABASE_URL=postgresql://etholys:SENHA_FORTE@postgres:5432/etholys
NEXTAUTH_URL=https://forge.seudominio.com
NEXTAUTH_SECRET=...
GEMINI_API_KEY=...
POSTGRES_PASSWORD=...
APP_DOMAIN=forge.seudominio.com
```

Copiar de `apps/web/.env.example` e preencher.

### Subir stack produção

```bash
cd /opt/etholys/infra
docker compose -f docker-compose.prod.yml up -d --build
```

Migrar e seed (primeira vez):

```bash
docker exec -it etholys-web-prod sh -c "cd /app && npx prisma migrate deploy"
docker exec -it etholys-web-prod sh -c "cd /app && npx tsx --require dotenv/config scripts/seed-expedicion-tiago.ts"
```

Health:

```bash
curl -s https://forge.seudominio.com/api/forge/health
```

---

## Parte 4 — Deploy de actualizações

Script no servidor (`/opt/etholys/scripts/deploy-forge-web.sh`):

```bash
ssh root@SEU_IP_CONTABO 'bash /opt/etholys/scripts/deploy-forge-web.sh'
```

Antes de deploy, no PC:

```bash
cd apps/web
npm run verify:expedicion-v2
npm run test:expedicion-v2
```

---

## Parte 5 — La Expedición V2 em produção

1. Curso → **Entrega** → modo **Presencial** ou **Online**
2. Criar grupo `live_team` em **Turmas**
3. Salón: `/hub/forge/cursos/{id}/sala?group={playGroupId}`
4. Facilitador inicia partida compartida
5. Alunos entram no mesmo link no telemóvel

Checklist completo: [DEPLOY-EXPEDICION-V2.md](./DEPLOY-EXPEDICION-V2.md)  
Smoke test manual (2 telemóveis): [SMOKE-TEST-EXPEDICION-V2.md](./SMOKE-TEST-EXPEDICION-V2.md)

---

## Problemas comuns (Contabo)

| Sintoma | Causa | Acção |
|---------|-------|--------|
| Build killed (OOM) | RAM insuficiente | VPS 8 GB + swap; `NODE_OPTIONS=--max-old-space-size=2048` |
| 502 / app caída | Container parado | `docker compose -f docker-compose.prod.yml ps` e logs |
| SSH timeout | Firewall Contabo | Painel Contabo → rede → portas 22/80/443 |
| Certificado SSL | Caddy / DNS | `APP_DOMAIN` correcto; portas 80/443 abertas |

Recuperação OOM: ver `scripts/recuperar-servidor-oom.sh` (adaptar comentários para Contabo).

---

## Checklist rápido

- [ ] VPS Contabo 8 GB + bootstrap (`contabo-server-setup.sh`)
- [ ] DNS Cloudflare → IP Contabo
- [ ] `.env` produção + `docker compose -f docker-compose.prod.yml up -d --build`
- [ ] `prisma migrate deploy` + seed Expedición
- [ ] `npm run verify:expedicion-v2` (local) antes de push
- [ ] Health OK + convite teste no telemóvel
- [ ] Sala V2 presencial com 2 dispositivos (smoke test)
