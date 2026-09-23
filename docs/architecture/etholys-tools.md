# Etholys Tools — faixa de ferramentas transversais

**Versão:** 0.2  
**Data:** 2026-09-22  
**Status:** Nome + agrupamento no Hub  
**Público:** product, desenvolvedores, agentes de IA  

**Fonte de verdade** para o conjunto de ferramentas avulsas do Hub (não são os 5 sistemas licenciáveis principais).  
**Entrada para agentes:** [AGENTS.md](../../AGENTS.md) → este ficheiro.

---

## 1. Princípio

> **Etholys Tools** = prateleira nomeada de ferramentas transversais. Cada ferramenta é um produto próprio (rota, motor, espelhos). **Não** é o Etholys Core nem um 6.º sistema peer de ATLAS/SIEP.

| Camada | Papel |
|--------|--------|
| **Sistemas** | ATLAS, SIEP, FUNDHUB, NEXUS, FORGE — produtos licenciáveis principais |
| **Etholys Tools** | Advisor, Studio, Work, Chorus (Meet), Prism — ferramentas no Hub; atalhos / espelhos nos sistemas |
| **Etholys Core** | SSO, chat, Docs S3, i18n, permissões, notif. — infraestrutura incluída |
| **Etholys Lab** | Ferramentas internas da fábrica — [MUSE](./lab-muse.md) (o quê) + [ANVIL](./lab-anvil.md) (como); separados, com pipeline; não públicas |

**Studio não é o guarda-chuva.** Studio é uma ferramenta *dentro* de Etholys Tools (documentos com IA).

**CARTA** foi descontinuado (sem superfície de produto). Aprovações e governança vivem em Work / NEXUS / ATLAS conforme o fluxo.

---

## 2. Membros atuais

| Ferramenta | Entrada Hub | Spec |
|------------|-------------|------|
| **Advisor** | `/hub/advisor` | Central de inteligência e conselhos institucionais |
| **Studio** | `/hub/studio` | [etholys-studio.md](./etholys-studio.md) — redação e diagramação (docs, vídeo, gráfico) |
| **Work** | `/hub/work` (+ atalho; ATLAS `/tasks`) | [etholys-work.md](./etholys-work.md) — gestor de tarefas |
| **Chorus** (produto; rota Meet) | `/hub/meet` | [etholys-meet.md](./etholys-meet.md) — reuniões, vídeo, transcrição e gravação |
| **Prism** | `/hub/prism` | Dados, progresso ESG e monitorização de impacto |

Candidato futuro (Tools, fora de Work): **Board** — mural da empresa (links, docs, senhas).

---

## 3. UI

- Secção **Etholys Tools** no Hub (`apps/web/app/hub/page.tsx`).
- Badge `productTier: 'tool' | 'advisor'` nos cartões.
- Cada ferramenta mantém rota própria sob `/hub/…` (`/hub/carta` redireciona para `/hub/work`).
- **Sem atalhos flutuantes** nas páginas dos sistemas (tapavam texto e anunciavam tools não contratadas).
- **Studio** e **Work** só entram no Hub se a empresa tiver o add-on (`addon.tool.studio` / `addon.tool.work`) quando a faturação está activa. Sem contrato registado (legado), o Hub continua a listá-las.

---

## 4. Relação com Core

Tools usam Core (auth, tenant, storage). Não substituem os sistemas licenciáveis.
