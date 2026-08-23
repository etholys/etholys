# Etholys Studio — criação de documentos (ferramenta transversal)

**Fase atual (UI):** dois espaços distintos — **Redação** (chrome claro, ribbon Formato, IA de redação) e **Desenho** (chrome escuro violeta, IA de diagramação `/design-layout` com brand kit). Ainda não é TipTap/Canva nativo; o caminho é evolução incremental para paridade Word/Gamma. 

**Fonte de verdade** para o estúdio de documentos com IA no Etholys.  
**Entrada para agentes:** [AGENTS.md](../../AGENTS.md) → este ficheiro.

---

## 1. Princípio

> **Ferramenta avulsa, atalho em todo o lado.** Não é SIEP, ATLAS nem Core básico.  
> Pertence à faixa **[Etholys Tools](./etholys-tools.md)** (Studio ≠ guarda-chuva das outras ferramentas).

| Camada | Papel |
|--------|--------|
| **Core Docs** (`/documents`) | Repositório de ficheiros S3 — permanece incluído |
| **Studio** (`/hub/studio`) | Addon/ferramenta: pastas, templates, canvas + chat IA |
| **Sistemas** | Continuam fluxos específicos (informe SIEP, proposta FUNDHUB); Studio é o motor geral |

- Cartão no Hub na secção **Etholys Tools** (junto a Meet / CARTA / Advisor)  
- **Botão hot** flutuante em ecrãs autenticados → atalho para `/hub/studio`  
- Licença: isento como Meet/CARTA no MVP (produto addon; gate comercial depois)

---

## 2. Capacidades (roadmap)

| Fase | Entrega | Notas |
|------|---------|--------|
| **F0** | Spec + pastas + docs + templates seed + editor dual-pane + agente consent | ✅ |
| **F1** | Kit de marca da empresa + export PDF/DOCX | ✅ |
| **F2** | Diagramas editáveis + “ajusta o diagrama” no chat | ✅ Mermaid + quadro visual Excalidraw |
| **F2.4** | Âmbito IA por secção + anti-wipe | ✅ seleção de blocos (mira) + filtro servidor |
| **F2.5** | Estilo de bloco (align / escala / moldura) | ✅ na faixa de design com secções selecionadas |
| **F2.1** | Permissões / partilha pasta+doc (membros + email externo; papéis viewer/editor/admin) | ✅ |
| **F2.2** | Contexto IA: ficheiros na pasta + anexos no chat | ✅ |
| **F2.3** | Editor: chat esquerdo redimensionável, undo/versões, folhas A4/A3, moldes | ✅ |
| **F3** | Pontes “Abrir no Studio” desde SIEP/FUNDHUB/Meet | ✅ one-shot via `POST /api/studio/import` |
| **F3.1** | Rastreabilidade: quem/quando falou com IA e editou o doc | ✅ `StudioDocumentActivity` + painel |
| **F4** | Templates por domínio + colaboração/comentários | ✅ filtros SIEP/FUNDHUB/Meet/… + `StudioDocumentComment` |
| **F5** | Presença colaborativa + aviso de edição remota | ✅ heartbeat Postgres + avatars + reload |
| **F6** | Sync suave + auto-save + gestão de blocos | ✅ pull remoto se limpo; autosave 8s; mover/apagar |
| **F7** | OT / CRDT (Yjs) para edição simultânea no mesmo bloco | Seguinte |

---

## 3. Modelo

```mermaid
flowchart LR
  Folder[StudioFolder] --> Doc[StudioDocument]
  Template[StudioTemplate] -.->|seed| Doc
  Doc --> Canvas[canvasState JSON]
  Doc --> Session[AiAdvisorSession STUDIO_DOC]
  Session --> Agent[Studio Agent]
  Agent -->|consent gate| Eco[Dados empresa]
  Brand[Brand kit AiCompanyMemory] --> Export[PDF / DOCX]
  Doc --> Export
```

- **Visibilidade:** `private` por omissão (dono + convidados explícitos). `company` é **opt-in manual** no diálogo de partilha — nunca automático, nem para conteúdo legado. Itens sem dono (conta apagada) ficam acessíveis a ADMIN da empresa para não ficarem órfãos.
- **Papéis de partilha** (`StudioShare.role`, TEXT — sem migração de coluna):

| Papel | Código | Pode |
|-------|--------|------|
| **Dono** | `owner` (criador; não é share) | Tudo, incluindo apagar o item e mudar visibilidade |
| **Admin de conteúdo** | `admin` | Ler, criar/editar pastas e docs, exportar, copilot, **partilhar**, **alterar papéis**, revogar acessos, renomear; apagar docs na pasta |
| **Editor** | `editor` | Ler, criar/editar pastas e docs, exportar, copilot |
| **Visualizador** | `viewer` | Só ler / exportar |

  Default ao convidar: **`editor`**. Herança: partilha numa pasta ancestral aplica o mesmo papel aos filhos. Valores novos são aditivos (`viewer`/`editor` existentes mantêm-se).
- **`StudioFolder`:** árvore por `companyId`  
- **`StudioDocument`:** título, format, `canvasState` (páginas/blocos), `aiSessionId`  
- **`StudioTemplate`:** sistema (`isSystem`) ou por empresa  
- **`StudioContextAsset`:** ficheiros de contexto para a IA — `scope=folder` (gerais da pasta, herdam para docs filhos) ou `scope=document` (anexos do chat/doc). Texto extraído (PDF/DOCX/txt) injectado no prompt; imagens/PDF também como multimodal no turno. **Não** passam pelo gate de consentimento do catálogo Etholys (o utilizador carregou-os de propósito).
- **`StudioDocumentVersion`:** snapshots restauráveis (quem + quando)  
- **`StudioDocumentActivity`:** trilha unificada — `ai_prompt` / `ai_response` / `ai_edit` / `saved` / `restored` / `created` / `imported` / `comment` (ator + timestamp + resumo). API `GET /api/studio/documents/[id]/activity`. Campo `updatedById` no documento = último editor.  
- **`StudioDocumentComment`:** comentários no documento ou num bloco (`blockId`); resolver/reabrir; API `/api/studio/documents/[id]/comments`.  
- **`StudioDocumentPresence`:** quem está a ver/editar (heartbeat ~12s, TTL 45s). API `/api/studio/documents/[id]/presence`. Sync suave: se o doc local não está dirty, aplica a versão remota; senão mostra banner. Auto-guardar silencioso aos 8s (`quiet` + sem snapshot).  
- **Templates por domínio:** `domain` em `STUDIO_SYSTEM_TEMPLATES` (general/siep/fundhub/meet/forge/atlas/nexus) — filtro na biblioteca.  
- **`EtholysDocumentLink`:** vínculo persistente Studio/Core → sistema+entidade (NEXUS AT, SIEP, FUNDHUB, empresa…). A IA usa os vínculos sem consentimento de catálogo. API `/api/document-links`.  
- **Brand kit:** `AiCompanyMemory` category `studio_brand` + fallback `Company.logo` / `Company.color`

Distinto do modelo `Document` (blob S3).

---

## 4. Agente Studio

- Kind de sessão: `STUDIO_DOC`  
- Conhece o **catálogo** do ecossistema (o que existe), mas **não injeta dados** sem consentimento explícito no turno  
- Resposta estruturada: mensagem + `canvasPatches` e/ou `consentRequest`  
- UI: se `consentRequest`, mostrar fontes e botões Sim/Não; só depois reenvia com `approvedSources`
- **Âmbito:** o utilizador pode selecionar blocos (mira) → `targetBlockIds` no copiloto; o servidor **filtra** patches fora do âmbito e **bloqueia** reescritas do documento inteiro

---

## 5. Export (F1)

| Formato | Mecanismo |
|--------|-----------|
| **PDF** | `studioCanvasToHtml` + Abacus `createConvertHtmlToPdfRequest` |
| **DOCX** | OOXML mínimo via JSZip (`studioCanvasToDocxBuffer`) |

API: `POST /api/studio/documents/[id]/export` com `{ format: "pdf" | "docx" }`.

---

## 6. Código

| Área | Path |
|------|------|
| UI Hub | `apps/web/app/hub/studio/` |
| Hot button | `apps/web/components/studio/StudioHotButton.tsx` |
| APIs | `apps/web/app/api/studio/` |
| Lib | `apps/web/lib/studio/` |
| Import F3 | `apps/web/lib/studio/import-from.ts`, `POST /api/studio/import` |
| Prisma | `StudioFolder`, `StudioDocument`, `StudioTemplate`, `StudioContextAsset` |
| SQL manual | `apps/web/prisma/migrations/manual_etholys_studio.sql` |
| Deploy | `scripts/apply-studio-deploy.sh` |

**Não reutilizar** Lab ANVIL (interno). O padrão de chat↔canvas inspira-se no informe SIEP, sem acoplar ao ciclo de vida de projetos.

### Deploy seguro (sem perda de dados)

A migração é **só additive** (`CREATE TABLE IF NOT EXISTS`, enum `ADD VALUE IF NOT EXISTS`). No servidor:

```bash
bash /opt/etholys/scripts/apply-studio-deploy.sh
```
