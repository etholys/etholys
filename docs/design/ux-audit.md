# Etholys — Auditoria de UX/UI do ecossistema

**Estado:** em curso (análise por blocos, sem alterações de código)
**Última atualização:** agosto 2026
**Método:** inspeção visual do produto em execução (`http://localhost:3000`) + leitura do código, não apenas do código.

Documento vivo. Cada bloco é analisado no produto real (desktop e mobile), com diagnóstico do
estado atual e direção proposta. As alterações só são implementadas depois de a direção do bloco
ser aprovada.

---

## Ordem dos blocos

| # | Bloco | Estado da análise |
|---|-------|-------------------|
| 1 | Site público e acesso (`/`, `/login`) | ✅ Analisado |
| 2 | Identidade global (tokens, tipografia, cor, espaçamento) | 🔲 Por analisar |
| 3 | Shell do Hub (`/hub`) e navegação entre sistemas | 🔲 Por analisar |
| 4 | ATLAS — ERP (`/(dashboard)/*`) | 🔲 Por analisar |
| 5 | SIEP — projetos (`/siep/*`) | 🔲 Por analisar |
| 6 | FUNDHUB (`/hub/fundhub/*`) | 🔲 Por analisar |
| 7 | NEXUS (`/hub/nexus/*`) | 🔲 Por analisar |
| 8 | FORGE (`/hub/forge/*`) | 🔲 Por analisar |
| 9 | PRISM (`/hub/prism/*`) | 🔲 Por analisar |
| 10 | Etholys Tools — Advisor, Studio, Meet, CARTA | 🔲 Por analisar |
| 11 | Lab — MUSE, ANVIL (`/lab/*`) | 🔲 Por analisar |

---

## Bloco 1 — Site público e acesso

### 1.1 Home (`/`) — estado atual

A página é `apps/web/app/page.tsx`: um aviso de fase privada centrado sobre fundo escuro.

Medições no viewport de 2073×1167:

| Elemento | Valor observado |
|----------|-----------------|
| `h1` «Fábrica de Soluciones» | 36 px / 700, largura 345 px |
| Parágrafo de apoio | 14 px, `slate-400`, largura máxima 448 px |
| Nota de rodapé | 12 px, `slate-600` — contraste muito baixo |
| Área ocupada por conteúdo | ~180 px de altura no centro de 1167 px |

**Problemas**

1. **Proposta de valor** — «Fábrica de Soluciones» é uma assinatura institucional, não explica o
   resultado para o cliente.
2. **Hierarquia** — mais de 90% do ecrã não comunica nada; o conteúdo é um bloco pequeno e isolado.
3. **Navegação** — não existe caminho para conhecer sistemas, ferramentas, casos de uso ou
   diferenciais.
4. **Conversão** — não há ação principal. O visitante recebe uma restrição, mas não sabe como avançar.
5. **Confiança** — faltam sinais concretos: arquitetura do ecossistema, capacidades, segurança,
   integração entre sistemas.
6. **Acessibilidade** — a nota final (`slate-600` sobre `slate-950`) fica abaixo do contraste mínimo.

### 1.2 Login (`/login`) — estado atual

`apps/web/app/login/page.tsx`. Painel dividido: metade esquerda institucional escura (marca,
4 vantagens, badges dos 6 sistemas), metade direita o formulário sobre `gray-50`.

**Problemas**

1. **Inconsistência com a home** — outra linguagem visual, outra paleta, outra densidade. Parecem
   dois produtos diferentes.
2. **Mobile** — abaixo de `lg` o painel institucional desaparece por completo (`hidden lg:flex`).
   Fica um formulário sobre fundo claro, sem contexto de marca nem do ecossistema.
3. **Decoração sem função** — seis círculos concêntricos absolutos e dois gradientes radiais
   sobrepostos criam ruído sem reforçar a mensagem.
4. **Hierarquia tipográfica** — o título do formulário é `h3` (24 px) enquanto a marca do painel é
   `h1`; a ordem semântica não corresponde à leitura da página.
5. **Estado de campos** — os `input` de email e password não têm `placeholder` nem descrição de
   formato; o rótulo é a única pista.
6. **Ações concorrentes** — «Iniciar Sesión», «Registrarse» e Google competem visualmente, mesmo em
   fase pré-comercial em que o registo público não se aplica.

### 1.3 Direção proposta

Template visual detalhado no canvas de auditoria (fora do repositório):
`~/.cursor/projects/c-Users-rezen-OneDrive-Desktop-Etholys/canvases/etholys-site-ux-audit.canvas.tsx`

Estrutura alvo da home:

```
┌─────────────────────────────────────────────────────────────┐
│ Marca · Ecossistema · Sistemas · Tools · Como funciona      │
│                              [Entrar] [Solicitar demo]      │
├──────────────────────────────┬──────────────────────────────┤
│ Proposta de valor (24px)     │ MAPA DO ECOSSISTEMA          │
│ Subtítulo explicativo        │ ┌────────┬────────┐          │
│ [CTA primário] [CTA sec.]    │ │ ATLAS  │ SIEP   │ …        │
│ 6 sistemas · 4 tools · 1 SSO │ ├────────┴────────┤          │
│                              │ │ ETHOLYS CORE    │          │
├──────────────────────────────┴──────────────────────────────┤
│ Escolha por necessidade — grelha dos 6 sistemas             │
└─────────────────────────────────────────────────────────────┘
```

**Princípios**

- **Visual** — base sóbria, superfícies planas, contraste alto; teal reservado para marca e ação.
  Sem círculos decorativos, sem gradientes sobrepostos, sem cartões todos iguais.
- **Conteúdo** — começar pelo resultado para o cliente. «Fábrica de Soluções» mantém-se como
  assinatura, não como proposta de valor principal.
- **Ecossistema** — uma linguagem-base para toda a Etholys; cada sistema recebe um acento próprio
  sem parecer uma aplicação desconectada.
- **Acesso** — o login herda a mesma linguagem da home e mantém contexto de marca no mobile.
  Em fase pré-comercial, uma única ação primária.

### 1.4 Nota de operação

A URL de produção indicada em `ETHOLYS_Arquitectura_v2.md` (`etholys.abacusai.app`) responde
`Not Found`. A análise foi feita no ambiente local.

---

## Links

- [../../AGENTS.md](../../AGENTS.md) — entrada para agentes
- [../../ETHOLYS_Arquitectura_v2.md](../../ETHOLYS_Arquitectura_v2.md) — visão do ecossistema
- [../architecture/forge-ui-vision.md](../architecture/forge-ui-vision.md) — visão de interface FORGE
