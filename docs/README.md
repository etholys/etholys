# Documentação Etholys

Índice central da documentação do repositório. Agentes de IA devem começar por **[../AGENTS.md](../AGENTS.md)**.

## Arquitetura de produtos

| Documento | Descrição |
|-----------|-----------|
| [../ETHOLYS_Arquitectura_v2.md](../ETHOLYS_Arquitectura_v2.md) | Visão do ecossistema (6 sistemas + Core) |
| [../ETHOLYS_Arquitectura_Productos.md](../ETHOLYS_Arquitectura_Productos.md) | Versão anterior / complementar |
| [architecture/README.md](./architecture/README.md) | Índice de arquitetura por sistema |
| **[architecture/etholys-tools.md](./architecture/etholys-tools.md)** | **Etholys Tools — faixa de ferramentas (Advisor, Studio, Meet, CARTA)** |
| **[architecture/forge-ead.md](./architecture/forge-ead.md)** | **FORGE — EAD unificado, jogos com IA, gamificação (fonte de verdade)** |
| **[architecture/etholys-meet.md](./architecture/etholys-meet.md)** | **Meet — reuniões transversais (motor + espelhos FORGE/SIEP/NEXUS)** |
| **[architecture/lab-anvil.md](./architecture/lab-anvil.md)** | **Lab ANVIL — agente de engenharia interno (Cursor/Abacus Lab)** |
| **[MEET-JITSI-CONTABO.md](./MEET-JITSI-CONTABO.md)** | **Subir Jitsi no Contabo (`meet.etholys.com`)** |
| **[MEET-VPS-JIBRI.md](./MEET-VPS-JIBRI.md)** | **VPS dedicado + Jibri → R2 / webhook** |

## Operações

| Documento | Descrição |
|-----------|-----------|
| [backend-release-hygiene.md](./backend-release-hygiene.md) | Releases seguros do `backend/` |
| [DEPLOY-CONTABO-CLOUDFLARE.md](./DEPLOY-CONTABO-CLOUDFLARE.md) | Deploy app no Contabo |
| **[MEET-JITSI-CONTABO.md](./MEET-JITSI-CONTABO.md)** | **Jitsi / Etholys Meet no Contabo (`meet.etholys.com`)** |
| **[MEET-VPS-JIBRI.md](./MEET-VPS-JIBRI.md)** | **VPS 2 + Jibri → R2** |
| [FORGE-JITSI-DNS.md](./FORGE-JITSI-DNS.md) | Referência DNS Jitsi (legado Hetzner) |

## Código relacionado

- App web: `apps/web/`
- Backend Python (API separada): `backend/`
