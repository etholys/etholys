# Etholys Tools — faixa de ferramentas transversais

**Versão:** 0.1  
**Data:** 2026-08-04  
**Status:** Nome + agrupamento no Hub  
**Público:** product, desenvolvedores, agentes de IA  

**Fonte de verdade** para o conjunto de ferramentas avulsas do Hub (não são os 6 sistemas licenciáveis).  
**Entrada para agentes:** [AGENTS.md](../../AGENTS.md) → este ficheiro.

---

## 1. Princípio

> **Etholys Tools** = prateleira nomeada de ferramentas transversais. Cada ferramenta é um produto próprio (rota, motor, espelhos). **Não** é o Etholys Core nem um 7.º sistema peer de ATLAS/SIEP.

| Camada | Papel |
|--------|--------|
| **Sistemas** | ATLAS, SIEP, FUNDHUB, NEXUS, FORGE, PRISM — produtos licenciáveis |
| **Etholys Tools** | Advisor, Studio, Meet, CARTA — ferramentas avulsas no Hub; atalhos / espelhos nos sistemas |
| **Etholys Core** | SSO, chat, Docs S3, i18n, permissões, notif. — infraestrutura incluída |
| **Etholys Lab** | Ferramentas internas da fábrica — [MUSE](./lab-muse.md) (o quê) + [ANVIL](./lab-anvil.md) (como); separados, com pipeline; não públicas |

**Studio não é o guarda-chuva.** Studio é uma ferramenta *dentro* de Etholys Tools (documentos com IA).

---

## 2. Membros atuais

| Ferramenta | Entrada Hub | Spec |
|------------|-------------|------|
| **AI Advisor** | `/hub/advisor` → workspace | Assessor transversal / alertas |
| **Studio** | `/hub/studio` | [etholys-studio.md](./etholys-studio.md) |
| **Meet** | `/hub/meet` | [etholys-meet.md](./etholys-meet.md) |
| **CARTA** | `/hub/carta` | Governança / aprovações |
| **Work** (tarefas) | `/tasks` hoje; `/hub/work` depois | [etholys-work.md](./etholys-work.md) — motor único `Task` |

Candidato futuro (Tools, fora de Work): **Board** — mural da empresa (links, docs, senhas).

---

## 3. UI

- Secção **Etholys Tools** no Hub (`apps/web/app/hub/page.tsx`), acima ou abaixo dos sistemas conforme layout vigente.
- Badge `productTier: 'tool' | 'advisor'` nos cartões.
- Cada ferramenta mantém rota própria sob `/hub/…`.

---

## 4. Relação com Core

Core = base comum. Tools = capacidades de produto transversais que o utilizador *abre* (reunião, documento, aprovação). Não misturar as duas camadas no posicionamento comercial.
