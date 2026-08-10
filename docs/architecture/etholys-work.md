# Etholys Work — motor de tarefas (Etholys Tools)

**Versão:** 0.2  
**Data:** 2026-08-08  
**Status:** F0–F4 em código (Tools `/hub/work` + CARTA inbox)  
**Público:** product, desenvolvedores, agentes de IA  

**Fonte de verdade** para o motor único de tarefas da equipa.  
**Entrada:** [AGENTS.md](../../AGENTS.md) → [etholys-tools.md](./etholys-tools.md) → este ficheiro.

---

## 1. Princípio

> **Um motor `Task`, vários espelhos.** Não duplicar Kanban SIEP vs “tarefas internas”.

| Superfície | Entrada | Filtro | Papel |
|------------|---------|--------|-------|
| **Work (Tools)** | `/hub/work` + atalho flutuante cyan | `companyId` ± `projectId` | Inbox e ops da equipa |
| **ATLAS** | `/tasks` | idem | Espelho ERP |
| **SIEP** | Secção atividades do projeto | `projectId` obrigatório | Execução do projeto |
| **Hub workspace** | `/hub/workspace` | Tarefas abertas | Espelho rápido |
| **Meet** | Pós-reunião → convert | Cria `Task` | Rascunho → tarefa |

**Regra:** `projectId` preenchido = tarefa de projeto (espelho SIEP). Sem `projectId` = tarefa operacional (empresa / área).

**Etholys Tools:** Work é (ou será) membro da faixa Tools — não vive “escondido” só no ERP. ATLAS continua a ter atalho; a casa conceptual é Tools.

---

## 2. O que NÃO é Work

| Peça | Onde |
|------|------|
| Aprovação formal de entrega | **CARTA** (Tools) — Work só dispara / liga |
| Mural da empresa (links, senhas, docs) | Ferramenta futura **Board** (Tools) — fora deste motor |
| Relatório de campo / quilometragem | SIEP (`TaskActivityReport`, …) |

---

## 3. Roadmap

| Fase | Entrega | Estado |
|------|---------|--------|
| **F0** | GET detalhe da tarefa; tags UI; subtarefas; comentários fiáveis; time log via detalhe | ✅ Base (ago/2026) |
| **F1** | Grupos/secções tipo Monday (`TaskGroup` + ordem); filtro por grupo | ✅ Base (ago/2026) |
| **F2** | Entrada Hub `/hub/work` + cartão Etholys Tools + hot button; deep-links ATLAS | ✅ (ago/2026) |
| **F3** | @menções em comentários → notificação | ✅ (ago/2026) |
| **F4** | Solicitar aprovação → CARTA inbox + notificação ao aprovador | ✅ (ago/2026) |
| **F5** | Templates de projeto (além de packs de tarefas) | Pendente |
| **F6** | Organizador: sidebar Setor/Projeto, dashboard de carga, vista Timeline/Gantt | Em curso (ago/2026) |

---

## 4. Modelo (já partilhado)

`Task` em `prisma/schema.prisma`: `projectId?`, `companyId?`, `assigneeId`, `parentId` (subtarefas), `tags`, `status`, `priority`, dates, recurring, checklist, comments, timeEntries, dependencies.

Novos campos só quando F1 (grupos) o exigir — preferir additive migrations.

---

## 5. Código

| Área | Path |
|------|------|
| UI ATLAS | `apps/web/app/(dashboard)/tasks/page.tsx` → `TasksBoard` |
| UI Hub Work | `apps/web/app/hub/work/page.tsx` → `WorkShell` |
| Shell / sidebar / dashboard / gantt | `components/work/WorkShell.tsx`, `WorkSidebar.tsx`, `WorkDashboard.tsx`, `WorkGantt.tsx` |
| Hot button | `apps/web/components/work/WorkHotButton.tsx` |
| Board partilhado | `apps/web/components/work/TasksBoard.tsx` |
| Templates | `apps/web/app/(dashboard)/templates/page.tsx` |
| APIs | `apps/web/app/api/tasks/`, `task-groups/`, `task-approvals/`, `checklist/`, `comments/`, `time-entries/` |
| SQL | `manual_etholys_work_groups.sql`, `manual_etholys_work_approvals.sql` |
| CARTA inbox | `apps/web/app/hub/carta/page.tsx` |
| Mentions | `apps/web/lib/work/mentions.ts` |

---

## 6. Relação com ATLAS §1.7

A arquitectura v2 lista “Tareas Internas” sob ATLAS. **Produto:** o domínio continua a ser o mesmo `Task`; o **posicionamento UX** migra gradualmente para Etholys Tools (Work), com ATLAS a manter espelho/atalho para equipas financeiras e ERP.
