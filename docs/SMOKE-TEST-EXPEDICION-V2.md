# Smoke test manual — La Expedición V2 (presencial)

Executar **antes do primeiro workshop real**, com **2 telemóveis + 1 portátil (facilitador)**.

Tempo estimado: **25–35 min**.

---

## Preparação

- [ ] `npm run verify:expedicion-v2` passou no ambiente de deploy
- [ ] Curso publicado em produção (seed)
- [ ] Modo **Presencial** activo (sem Jitsi)
- [ ] Grupo `live_team` criado; link copiado: `.../sala?group=XXX`
- [ ] 2 alunos convidados e activados

---

## Facilitador (portátil)

1. [ ] Abrir salón com `?group=`
2. [ ] Badge **Presencial** visível no header
3. [ ] Completar **Quiz de madurez inicial** (ou confirmar que mesa já completou)
4. [ ] **Iniciar partida compartida**
5. [ ] Abrir **Presentación** → avançar até slide 3 (Raíces)
6. [ ] **Panel V2 equipos** lista a mesa com Eco ~500

---

## Aluno A (telefón 1)

1. [ ] Mesmo link `?group=`
2. [ ] Quiz pre completado
3. [ ] Tabuleiro visível (modo viewer ou player)
4. [ ] **Mapa + Finanzas** abre mapa V2
5. [ ] Adicionar post-it em **Raíces**

---

## Aluno B (telefón 2)

1. [ ] Entrar na mesma sala
2. [ ] Ver post-it de Aluno A no mapa em **≤10 s** (sync poll)
3. [ ] Lançar dado / mover peão (se for turno da mesa)

---

## Micro-caso + facilitador

1. [ ] Aluno A cai em estação → micro-caso aparece
2. [ ] Enviar respuesta al facilitador
3. [ ] Facilitador vê **micro-caso pendiente** no panel
4. [ ] Aprobar → **+200 Eco** no ledger da mesa (ambos telemóveis)

---

## Feria (slide 8)

1. [ ] Facilitador avança PPT ao slide **Gran desafío — Feria**
2. [ ] Equipa com 3+ columnas post-it → painel Feria
3. [ ] Enviar pitch → facilitador **Premiar (+300 Eco)**

---

## Cierre

1. [ ] Facilitador: **Cerrar ciclo** ×3 ou slide meta
2. [ ] Quiz final → **Puntuación de Sostenibilidad** com fórmula PPT
3. [ ] **Exportar CSV** com Eco + impacto

---

## Falha → acción

| Falha | Ver |
|-------|-----|
| Mapa não sincroniza | `roomId` na URL mi-mapa; grupo `live_team` |
| Eco duplicado no tabuleiro | Recriar sala (deve ter `v2FinancialMode`) |
| Quiz bloqueia | Esperado até completar pre/post |
| 502 / lento | Contabo RAM; ver [DEPLOY-CONTABO-CLOUDFLARE.md](./DEPLOY-CONTABO-CLOUDFLARE.md) |

Registar data, versão git (`git rev-parse --short HEAD`) e notas abaixo:

```
Data:
Versão:
Notas:
```
