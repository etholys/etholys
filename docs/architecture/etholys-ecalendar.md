# eCalendar — calendário transversal

**Versão:** 0.1  
**Data:** 2026-10-17  
**Estado:** F0 no código (`/hub/calendar`)  
**Público:** product, desenvolvedores, agentes de IA  

Ferramenta **Etholys Tools**. Não é um sistema licenciável. Não copia as datas dos outros produtos: **projeta-as** num calendário único.

---

## 1. Princípio

> Cada sistema continua dono das suas datas. O eCalendar é a superfície comum, com calendários (filtros) por origem.

| Camada | O que aparece | Onde se edita |
|--------|----------------|---------------|
| **eCalendar** | Eventos criados neste calendário | Aqui (`CalendarEvent`) |
| **eTask** | Tarefas com início ou prazo | eTask / projeto |
| **Projeto** | Início, fim e marcos do projeto. Também filtra tarefas, reuniões Chorus e visitas AURORA desse projeto | SIEP / projeto |
| **Chorus** | Sessões com hora marcada | Chorus |
| **FORGE** | Sessões ao vivo do curso | FORGE |
| **FundHub** | Prazo do fundo | FundHub |
| **AURORA** | Visitas de campo | AURORA |

Desligar um projeto esconde as datas ligadas a esse projeto, mesmo que a camada eTask ou Chorus continue ligada.

---

## 2. Rotas

| Peça | Caminho |
|------|---------|
| UI | `apps/web/app/hub/calendar/page.tsx` |
| Vista | `apps/web/components/calendar/ECalendar.tsx` |
| Feed | `GET /api/calendar/events?companyId&from&to` |
| Evento próprio | `POST /api/calendar/events`, `PATCH` e `DELETE /api/calendar/events/[id]` |
| Agregação | `apps/web/lib/calendar/feed.ts` |

Acesso: qualquer sessão com empresa. Sem add-on e sem grant extra (o calendário lê o que a empresa já tem).

---

## 3. Testes

`npm run test:calendar` em `apps/web` (também no workflow `.github/workflows/calendar.yml` quando estes ficheiros mudam).

Cobre filtros de camada, pesquisa, janela dia/semana/mês, contraste AA dos tokens e das cores de origem, e validação de criar/editar.

## 4. Fora deste F0

Convites, recorrência, arrastar para remarcar a origem, e sincronização com Google/Outlook (isso continua no Chorus).
