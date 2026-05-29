# FORGE — Visão de interface (e-learning · jogos · híbrido)

**Referência visual:** mockups Rural Commerce (dashboard + player e-learning)  
**Curso de referência para QA:** **La Expedición Sostenible** (`seed-expedicion-sostenible.ts`)

---

## 1. Modos de curso (funcional, não cosmético)

| Modo | Atividades | Área principal | Rail direita |
|------|------------|----------------|--------------|
| **E-learning** | `lesson`, `media`, `quiz` | Vídeo / texto / quiz inline | Módulos → atividades |
| **Jogo** | `game` (+ opcional intro `lesson`) | Motor FORGE (`ForgeGameBoard`, etc.) | Estaciones / fases do jogo |
| **Híbrido** | Mix no mesmo `ForgeCourse` | Troca automática por `activity.type` | Uma lista única com ícones por tipo |

O progresso, matrícula, XP e certificado são **os mesmos** nos três modos.

---

## 2. Layout alvo (inspirado Rural Commerce)

```
┌─────────────────────────────────────────────────────────────┐
│ Banner curso (gradiente azul) + breadcrumb                  │
├─────────────────────────────────────────────────────────────┤
│ Faixa: emoji/título curso · progresso · XP                  │
├──────────────────────────────┬──────────────────────────────┤
│ MAIN (70%)                   │ RAIL (30%)                   │
│ • lesson → vídeo + texto     │ Módulo 1                     │
│ • quiz → perguntas           │   ○ Aula                     │
│ • game → tabuleiro/cartas    │   ● Quiz                     │
│                              │   ○ Jogo                     │
│ [Próxima atividade →]        │ Módulo 2 …                   │
└──────────────────────────────┴──────────────────────────────┘
```

Componente: `ForgeLearnShell` (`components/forge/ForgeLearnShell.tsx`).

---

## 3. Curso guardado: La Expedición Sostenible

| Módulo | Tipo dominante |
|--------|----------------|
| Bienvenida | lesson + quiz |
| Raíces … Futuro | lesson + quiz (cápsulas técnicas) |
| Taller — Tablero | lesson (manual) + **game** (board, 20 casillas) |

**GameSpec:** motor `board`, cartas por estación, locale `es`, tema triple impacto.

**Recriar na DB:** `POST /api/forge/seed-expedicion` ou botão em `/hub/forge/cursos`.

---

## 4. Roadmap visual (próximos passos)

- [ ] Player unificado com `ForgeLearnShell` em todas as atividades
- [ ] Página de curso com hero + rail (modo catálogo)
- [ ] Badges: Aula · Quiz · Jogo · Vídeo
- [ ] Modo “só jogo”: rail compacto com estaciones
- [ ] Tema FORGE alinhado ao azul Rural Commerce (tokens em `layout.tsx`)

---

## 5. Links

- [forge-ead.md](./forge-ead.md) — arquitetura de dados e motores
- [AGENTS.md](../../AGENTS.md)
