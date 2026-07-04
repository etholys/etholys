# Colocar La Expedición online — Hetzner + Cloudflare

> **Nota:** O servidor de produção actual é **Contabo**. Use [DEPLOY-CONTABO-CLOUDFLARE.md](./DEPLOY-CONTABO-CLOUDFLARE.md) como guia principal. Este documento mantém-se como referência legado.

Guia completo para o curso funcionar no **PC e no celular** como **site web** (pode “Adicionar ao ecrã” como app).

Domínio deste projeto: **`forge.etholys.com`** (registo DNS na Cloudflare).

---

## Visão geral

```
[Celular/PC] → HTTPS → Cloudflare → Hetzner (Caddy :443) → Next.js :3000 → Postgres
```

| Peça | Função |
|------|--------|
| **Cloudflare** | DNS do teu domínio + HTTPS para visitantes |
| **Hetzner VPS** | Servidor Linux com Docker (**8 GB RAM** recomendado para V2) |
| **Caddy** | Certificado SSL no servidor + proxy |
| **Next.js** | App FORGE / curso |
| **Postgres** | Base de dados (convites, progresso, curso) |

---

## Parte 1 — Servidor Hetzner

### 1.1 Criar VPS

1. [Hetzner Cloud](https://console.hetzner.cloud/) → **Add Server**
2. **Ubuntu 24.04**, tipo **CX32** (8 GB RAM) — recomendado para La Expedición V2; CX22 (4 GB) pode falhar no build
3. Localização: perto dos alunos (ex. EU se Brasil, pode usar US também)
4. **SSH key** — cria e guarda a chave privada no PC
5. Anota o **IPv4** (ex. `95.xxx.xxx.xxx`)

### 1.2 Firewall Hetzner

No painel do servidor → **Firewalls** (ou Networking):

| Porta | Protocolo | Origem |
|-------|-----------|--------|
| 22 | TCP | O teu IP (ou 0.0.0.0/0 se precisares, menos seguro) |
| 80 | TCP | 0.0.0.0/0 |
| 443 | TCP | 0.0.0.0/0 |

### 1.3 Instalar Docker (SSH)

```bash
ssh root@95.xxx.xxx.xxx

apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin git
```

---

## Parte 2 — Cloudflare (DNS)

### 2.1 Registo DNS

1. [dash.cloudflare.com](https://dash.cloudflare.com) → teu domínio
2. **DNS** → **Add record**
   - **Type:** `A`
   - **Name:** `forge` (fica `forge.etholys.com`)
   - **IPv4:** IP do Hetzner
   - **Proxy status:** **Proxied** (nuvem laranja) — recomendado

### 2.2 SSL

**SSL/TLS** → modo **Full (strict)**  
(Depois do Caddy ter certificado Let's Encrypt no servidor.)

Se o certificado demorar a funcionar, temporariamente **Full** (não strict), depois volta a strict.

### 2.3 (Opcional) Always HTTPS

**SSL/TLS** → **Edge Certificates** → **Always Use HTTPS**: On

---

## Parte 3 — Código no servidor

### 3.1 Clonar repositório

```bash
mkdir -p /opt/etholys && cd /opt/etholys
git clone https://github.com/SEU_USER/Etholys.git .
# ou: rsync/scp da tua máquina Windows para /opt/etholys
```

### 3.2 Ficheiros de ambiente

```bash
cd /opt/etholys/infra
cp .env.production.example .env
nano .env
```

`infra/.env`:

```env
APP_DOMAIN=forge.etholys.com
POSTGRES_USER=etholys
POSTGRES_PASSWORD=uma_senha_muito_longa_e_aleatoria
POSTGRES_DB=etholys
```

```bash
cd /opt/etholys/apps/web
cp .env.production.example .env
nano .env
```

`apps/web/.env` (importante):

```env
NEXTAUTH_URL=https://forge.etholys.com
NEXTAUTH_SECRET=cole_aqui_32_bytes_aleatorios
```

Gerar segredo:

```bash
openssl rand -base64 32
```

Opcional (emails automáticos):

```env
RESEND_API_KEY=re_xxxx
FORGE_EMAIL_FROM="FORGE <convites@seudominio.com>"
```

---

## Parte 4 — Subir a app

```bash
cd /opt/etholys/infra
docker compose -f docker-compose.prod.yml up -d --build
```

A primeira vez demora **10–20 min** (build Next.js).

Ver logs:

```bash
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f caddy
```

Testar:

```bash
curl -s https://forge.etholys.com/api/forge/health
# deve conter "ok":true
```

No browser: `https://forge.etholys.com/expedicion`

---

## Parte 5 — Curso na base de produção

```bash
cd /opt/etholys/infra
docker compose -f docker-compose.prod.yml exec web \
  npx tsx --require dotenv/config scripts/seed-expedicion-tiago.ts
```

Listar URLs do curso e Jitsi:

```bash
docker compose -f docker-compose.prod.yml exec web \
  npx tsx --require dotenv/config scripts/list-expedicion-courses.ts
```

(Ajusta `NEXTAUTH_URL` no `.env` antes — os links de convite usam esse domínio.)

---

## Parte 6 — Convidar alunos (amanhã)

1. Entra: `https://forge.etholys.com` → login (conta Rural Commerce)
2. **FORGE** → curso **La Expedición** (LLC ou LTDA) → **Alumnos**
3. Cola emails → **Enviar convites**
4. Copia cada link `https://forge.etholys.com/hub/forge/activar?token=...`
5. Envia por **WhatsApp** (abre bem no celular)

**Entrada pública (celular):**  
`https://forge.etholys.com/expedicion`

Cada aluno ainda precisa do **link pessoal** com `token` para activar.

### O que o aluno vê no telemóvel

- Só o **curso** (sem menu Etholys completo)
- Videollamada **Jitsi** dentro do curso
- Mapa A2 e actividades
- Pode **Adicionar à página inicial** (Chrome/Safari → menu → instalar/atalho)

### Tu (facilitador)

- **Salón:** `https://forge.etholys.com/hub/forge/cursos/ID_DO_CURSO/salon`
- Não partilhes o link do Hub admin com alunos

---

## Parte 7 — Checklist antes da aula

- [ ] `https://forge.etholys.com/api/forge/health` → ok
- [ ] `/expedicion` abre no telemóvel
- [ ] Convite de teste no teu telemóvel → activar → curso → Jitsi
- [ ] Salón abre tabuleiro + PPT
- [ ] `NEXTAUTH_URL` = mesmo domínio que os alunos usam

---

## Problemas comuns

### Certificado SSL / erro 525 Cloudflare

- Portas **80 e 443** abertas no Hetzner
- Caddy a correr: `docker compose -f docker-compose.prod.yml ps`
- Tenta **DNS only** (nuvem cinza) 5 min para o Let's Encrypt emitir, depois volta **Proxied**

### Links de convite com `localhost`

- `NEXTAUTH_URL` em `apps/web/.env` deve ser `https://forge.etholys.com`
- Reinicia: `docker compose -f docker-compose.prod.yml up -d web`

### Build falha por memória

- VPS com pelo menos **4 GB RAM** ou adiciona swap:

```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
```

### Atualizar código depois

```bash
cd /opt/etholys && git pull
cd infra && docker compose -f docker-compose.prod.yml up -d --build web
```

---

## Resumo dos links (exemplo)

| Uso | URL |
|-----|-----|
| Entrada alunos | `https://forge.etholys.com/expedicion` |
| Activar convite | `https://forge.etholys.com/hub/forge/activar?token=...` |
| Facilitador salón | `https://forge.etholys.com/hub/forge/cursos/{id}/salon` |
| Jitsi alunos | `https://meet.jit.si/expedicion-rc-llc-...` (ver script list) |

---

## Segurança mínima

- Senha Postgres forte em `infra/.env`
- Não commits `.env` no Git
- SSH só com chave, não password root
- Backups Postgres: `docker exec etholys-postgres-prod pg_dump -U etholys etholys > backup.sql`
