/**
 * Diagnóstico empresarial Nexus — quiz estruturado por setores e áreas.
 * Linguagem genérica (não setor rural). Pontuação 0–100 por pergunta, ponderada.
 */

export type QuizOption = { id: string; label: string; score: number };

export type QuizQuestion = {
  id: string;
  prompt: string;
  help: string;
  weight: number;
  options: QuizOption[];
};

export type QuizArea = {
  id: string;
  name: string;
  questions: QuizQuestion[];
};

export type QuizSector = {
  id: string;
  /** Usado na tag de rota (pillar) e relatórios */
  slug: string;
  name: string;
  intro: string;
  areas: QuizArea[];
};

const opt = (
  labels: [string, number][],
  unkLabel = 'Não sei / prefiro não responder'
): QuizOption[] => {
  const base = labels.map(([label, score], i) => ({
    id: `l${i + 1}`,
    label,
    score,
  }));
  return [...base, { id: 'unk', label: unkLabel, score: 42 }];
};

export const NEXUS_DIAGNOSTIC_QUIZ: QuizSector[] = [
  {
    id: 's1',
    slug: 'strategy',
    name: 'Estratégia e modelo de negócio',
    intro:
      'Vale para quem trabalha sozinho, micro ou empresa com equipa. Responda com o que é verdade hoje — não o ideal futuro.',
    areas: [
      {
        id: 's1a1',
        name: 'Direção e visão',
        questions: [
          {
            id: 's1a1q1',
            prompt: 'Tem uma ideia clara do que quer alcançar nos próximos 12–24 meses?',
            help: 'Pode estar só na cabeça — o importante é se orienta as decisões.',
            weight: 2,
            options: opt([
              ['Não tenho ideia a esse prazo', 18],
              ['Só na minha cabeça (ainda não partilhei)', 40],
              ['Clara e já a partilhei com quem me ajuda no negócio', 68],
              ['Escrita e revista de tempos a tempos', 88],
            ]),
          },
          {
            id: 's1a1q2',
            prompt: 'O modelo de receita principal está claro (o que vende, a quem, como cobra)?',
            help: 'Sem clareza, crescer ou pedir financiamento fica difícil — mesmo a trabalhar sozinho.',
            weight: 3,
            options: opt([
              ['Ainda não está claro', 20],
              ['Claro só para mim (trabalho sozinho ou quase)', 48],
              ['Claro para mim e para quem me ajuda (família, 1–2 pessoas)', 72],
              ['Escrito / acordado e quem vende ou atende também sabe', 90],
            ]),
          },
          {
            id: 's1a1q3',
            prompt: 'Tem metas numéricas simples (vendas, clientes, margem) que acompanha?',
            help: 'Metas sem acompanhamento raramente mudam o dia a dia.',
            weight: 2,
            options: opt([
              ['Não tenho metas', 15],
              ['Metas vagas («vender mais»)', 40],
              ['Metas definidas, olho de vez em quando', 65],
              ['Metas definidas e revisão pelo menos mensal', 88],
            ]),
          },
        ],
      },
      {
        id: 's1a2',
        name: 'Oferta e diferenciação',
        questions: [
          {
            id: 's1a2q1',
            prompt: 'Consegue explicar em uma frase por que um cliente escolhe a sua empresa e não um concorrente?',
            help: 'Proposta de valor clara sustém preço e fidelização.',
            weight: 3,
            options: opt([
              ['Não consigo', 18],
              ['Só de forma vaga', 42],
              ['Sim, na minha cabeça / para quem me ajuda', 68],
              ['Sim, e já confirmei com clientes ou no mercado', 90],
            ]),
          },
          {
            id: 's1a2q2',
            prompt: 'A oferta (produtos/serviços) está alinhada ao que realmente dá dinheiro?',
            help: 'Desalinhamento gera esforço alto e margem baixa.',
            weight: 2,
            options: opt([
              ['Não sei o que rentabiliza mais', 22],
              ['Só intuição', 45],
              ['Mais ou menos alinhado, com alguma noção de números', 68],
              ['Alinhado com análise simples de rentabilidade', 90],
            ]),
          },
        ],
      },
      {
        id: 's1a3',
        name: 'Parcerias e ecossistema',
        questions: [
          {
            id: 's1a3q1',
            prompt: 'Tem parcerias úteis (distribuição, fornecedor-chave, marca) com regras mínimas claras?',
            help: 'Parcerias mal definidas geram conflito e perda de tempo. «Não ter» também é válido.',
            weight: 1,
            options: opt([
              ['Não tenho parcerias relevantes (e está bem por agora)', 58],
              ['Tenho, mas só de palavra', 38],
              ['Acordo básico (mensagem, papel ou contrato simples)', 72],
              ['Acordo com metas e revisão', 88],
            ]),
          },
          {
            id: 's1a3q2',
            prompt: 'Acompanha o que fazem concorrentes e o que muda no setor?',
            help: 'Mesmo informalmente — ajuda a não ser surpreendido.',
            weight: 2,
            options: opt([
              ['Quase nunca', 20],
              ['De vez em quando (conversas, redes, feiras)', 48],
              ['Com alguma rotina (mensal / sazonal)', 72],
              ['De forma contínua, com várias fontes', 88],
            ]),
          },
        ],
      },
    ],
  },
  {
    id: 's2',
    slug: 'finance',
    name: 'Finanças e controlo',
    intro:
      'Liquidez, margens e disciplina financeira. Estime quando não tiver números exatos — o importante é a ordem de grandeza.',
    areas: [
      {
        id: 's2a1',
        name: 'Caixa e liquidez',
        questions: [
          {
            id: 's2a1q1',
            prompt: 'Quantos meses de despesas essenciais a tesouraria cobre sem novas entradas?',
            help: 'Folego de caixa.',
            weight: 3,
            options: opt([
              ['Menos de 1 mês', 15],
              ['1 a 2 meses', 38],
              ['3 a 5 meses', 62],
              ['6 meses ou mais', 88],
            ]),
          },
          {
            id: 's2a1q2',
            prompt: 'Existe previsão de caixa (entradas e saídas) para pelo menos 8–12 semanas?',
            help: 'Previsão reduz surpresas e atrasos a fornecedores.',
            weight: 2,
            options: opt([
              ['Não', 20],
              ['Informal / folha solta', 45],
              ['Sim, atualizada mensalmente', 72],
              ['Sim, atualizada semanalmente ou em tempo real', 90],
            ]),
          },
        ],
      },
      {
        id: 's2a2',
        name: 'Margem e custos',
        questions: [
          {
            id: 's2a2q1',
            prompt: 'Sabe a margem bruta média por linha de produto/serviço principal?',
            help: 'Margem por linha orienta preço e mix.',
            weight: 3,
            options: opt([
              ['Não sabemos', 18],
              ['Só margem global aproximada', 42],
              ['Sim, por linha principal', 72],
              ['Sim, por linha e revisão trimestral', 90],
            ]),
          },
          {
            id: 's2a2q2',
            prompt: 'Os custos fixos são revistos pelo menos trimestralmente?',
            help: 'Custos fixos crescem silenciosamente.',
            weight: 2,
            options: opt([
              ['Raramente', 22],
              ['Anualmente', 45],
              ['Trimestralmente', 72],
              ['Mensalmente com cortes planeados', 88],
            ]),
          },
        ],
      },
      {
        id: 's2a3',
        name: 'Investimento e financiamento',
        questions: [
          {
            id: 's2a3q1',
            prompt: 'Grandes investimentos passam por análise de retorno (payback ou ROI simples)?',
            help: 'Evita gastos impulsivos.',
            weight: 2,
            options: opt([
              ['Não', 20],
              ['Às vezes', 48],
              ['Quase sempre', 75],
              ['Sempre, com critério escrito', 90],
            ]),
          },
        ],
      },
      {
        id: 's2a4',
        name: 'Faturação e cobrança',
        questions: [
          {
            id: 's2a4q1',
            prompt: 'Prazo médio de recebimento (PMR) está sob controlo face ao negociado com clientes?',
            help: 'PMR alto sufoca caixa mesmo com lucro contabilístico.',
            weight: 3,
            options: opt([
              ['Não sabemos o PMR', 18],
              ['PMR alto sem plano', 35],
              ['Acompanhado, ações pontuais', 62],
              ['Metas de PMR + cobrança activa', 88],
            ]),
          },
          {
            id: 's2a4q2',
            prompt: 'Existe política de crédito e limite por cliente?',
            help: 'Reduz perdas por incumprimento.',
            weight: 2,
            options: opt([
              ['Não', 20],
              ['Informal', 45],
              ['Escrita, aplicação irregular', 68],
              ['Escrita, aplicada e revista', 88],
            ]),
          },
        ],
      },
    ],
  },
  {
    id: 's3',
    slug: 'operations',
    name: 'Operações e cadeia de valor',
    intro:
      'Como produz ou entrega o que vende: processos, fornecedores, qualidade e capacidade.',
    areas: [
      {
        id: 's3a1',
        name: 'Processos e capacidade',
        questions: [
          {
            id: 's3a1q1',
            prompt: 'Os processos críticos (pedido → entrega / produção → entrega) estão mapeados?',
            help: 'Mapa simples já reduz erros e retrabalho.',
            weight: 2,
            options: opt([
              ['Não', 18],
              ['Só verbalmente', 40],
              ['Mapeados em fluxograma simples', 70],
              ['Mapeados, com indicadores e donos', 90],
            ]),
          },
          {
            id: 's3a1q2',
            prompt: 'A capacidade instalada (pessoas, máquinas, horas) está dimensionada face à procura?',
            help: 'Desalinhamento gera atrasos ou custo ocioso.',
            weight: 2,
            options: opt([
              ['Não sabemos', 22],
              ['Intuição', 45],
              ['Planeamento básico de capacidade', 70],
              ['Planeamento com revisão periódica', 88],
            ]),
          },
        ],
      },
      {
        id: 's3a2',
        name: 'Fornecedores e compras',
        questions: [
          {
            id: 's3a2q1',
            prompt: 'Existem pelo menos dois fornecedores alternativos para insumos/serviços críticos?',
            help: 'Reduz risco de rutura.',
            weight: 2,
            options: opt([
              ['Não', 20],
              ['Só para parte dos críticos', 48],
              ['Sim, para a maioria', 75],
              ['Sim, com contratos ou acordos claros', 90],
            ]),
          },
          {
            id: 's3a2q2',
            prompt: 'Compras seguem critérios de preço, prazo e qualidade documentados?',
            help: 'Padronização reduz corrupção de custos.',
            weight: 2,
            options: opt([
              ['Não', 18],
              ['Informal', 45],
              ['Checklist simples', 72],
              ['Política escrita e auditoria ocasional', 88],
            ]),
          },
        ],
      },
      {
        id: 's3a3',
        name: 'Qualidade e melhoria',
        questions: [
          {
            id: 's3a3q1',
            prompt: 'Reclamações ou defeitos são registados e analisados para corrigir causa raiz?',
            help: 'Sem registo, os mesmos erros repetem-se.',
            weight: 2,
            options: opt([
              ['Não', 20],
              ['Registo informal', 45],
              ['Registo e análise ocasional', 70],
              ['Registo, análise e ações de melhoria', 90],
            ]),
          },
        ],
      },
      {
        id: 's3a4',
        name: 'Logística, stocks e activos',
        questions: [
          {
            id: 's3a4q1',
            prompt: 'Inventário ou activos críticos são contados ou reconciliados com rotina definida?',
            help: 'Evita desvios, rupturas e capital parado.',
            weight: 2,
            options: opt([
              ['Não', 18],
              ['Raramente', 40],
              ['Trimestral ou semestral', 68],
              ['Mensal ou em tempo real no sistema', 90],
            ]),
          },
          {
            id: 's3a4q2',
            prompt: 'Custos de logística (transporte, armazém) são acompanhados por encomenda ou rota?',
            help: 'Permite negociar e optimizar.',
            weight: 1,
            options: opt([
              ['Não', 22],
              ['Só total mensal', 48],
              ['Por categoria', 72],
              ['Por rota/pedido com metas', 88],
            ]),
          },
        ],
      },
    ],
  },
  {
    id: 's4',
    slug: 'commercial',
    name: 'Comercial e cliente',
    intro:
      'Aquisição, conversão, retenção e valor percebido pelo cliente.',
    areas: [
      {
        id: 's4a1',
        name: 'Funil e conversão',
        questions: [
          {
            id: 's4a1q1',
            prompt: 'Consegue medir quantos contactos viram proposta e quantas propostas viram venda?',
            help: 'Funil medido permite corrigir gargalos.',
            weight: 3,
            options: opt([
              ['Não medimos', 18],
              ['Medimos de forma irregular', 42],
              ['Medimos mensalmente', 72],
              ['Medimos semanalmente com metas', 90],
            ]),
          },
          {
            id: 's4a1q2',
            prompt: 'Quando vende ou atende, segue uma rotina mínima (perguntas, oferta, preço, fecho)?',
            help: 'Serve para quem trabalha sozinho ou com ajuda — não exige «equipa comercial».',
            weight: 2,
            options: opt([
              ['Improviso total em cada venda', 20],
              ['Tenho um jeito habitual, mas não está escrito', 48],
              ['Tenho um guia simples (notas / mensagem / papel)', 72],
              ['Guia claro e quem atende também o segue', 88],
            ]),
          },
        ],
      },
      {
        id: 's4a2',
        name: 'Preço e posicionamento',
        questions: [
          {
            id: 's4a2q1',
            prompt: 'A política de preços está baseada em custos, concorrência e valor percebido?',
            help: 'Preço só por intuição erode margem.',
            weight: 2,
            options: opt([
              ['Só intuição', 20],
              ['Custos apenas', 48],
              ['Custos + concorrência', 70],
              ['Custos + concorrência + valor', 90],
            ]),
          },
        ],
      },
      {
        id: 's4a3',
        name: 'Retenção e pós-venda',
        questions: [
          {
            id: 's4a3q1',
            prompt: 'Existe rotina de contacto ou valor acrescentado após a primeira venda?',
            help: 'Retenção custa menos que nova aquisição.',
            weight: 2,
            options: opt([
              ['Não', 18],
              ['Ocasional', 45],
              ['Sim, para clientes-chave', 72],
              ['Sim, automatizada ou segmentada', 88],
            ]),
          },
        ],
      },
      {
        id: 's4a4',
        name: 'Aquisição e marca',
        questions: [
          {
            id: 's4a4q1',
            prompt: 'Sabe o custo aproximado de aquisição de cliente (CAC) ou custo por lead qualificado?',
            help: 'Sem CAC, não se dimensiona investimento em marketing.',
            weight: 2,
            options: opt([
              ['Não', 18],
              ['Estimativa informal', 45],
              ['Calculado ocasionalmente', 70],
              ['Calculado e revisto com metas', 88],
            ]),
          },
          {
            id: 's4a4q2',
            prompt: 'A marca (nome, logótipo, mensagem) está protegida e consistente em todos os pontos de contacto?',
            help: 'Confusão de marca dilui confiança.',
            weight: 1,
            options: opt([
              ['Inconsistente', 25],
              ['Parcial', 50],
              ['Consistente', 75],
              ['Consistente + guia de marca', 90],
            ]),
          },
        ],
      },
    ],
  },
  {
    id: 's5',
    slug: 'people',
    name: 'Pessoas, cultura e liderança',
    intro:
      'Desde quem trabalha sozinho até micro com colaboradores: continuidade, competências e clareza do dia a dia.',
    areas: [
      {
        id: 's5a1',
        name: 'Quem faz o trabalho',
        questions: [
          {
            id: 's5a1q1',
            prompt: 'Se ficar doente ou ausente uma semana, o negócio continua a funcionar?',
            help: 'Mede dependência de uma só pessoa — comum e crítico em micro.',
            weight: 2,
            options: opt([
              ['Para quase tudo — sem mim, para', 18],
              ['Alguém da família / ajuda cobre o básico', 45],
              ['Há quem cubra as tarefas críticas', 70],
              ['Há substituições claras para o essencial', 88],
            ]),
          },
          {
            id: 's5a1q2',
            prompt: 'Quem trabalha no negócio (incluindo você) sabe fazer as tarefas críticas com segurança?',
            help: 'Inclui aprender sozinho, família ou colaboradores.',
            weight: 2,
            options: opt([
              ['Ainda estou a aprender o essencial', 28],
              ['Sei o básico; o resto é improviso', 48],
              ['As tarefas críticas estão cobertas no dia a dia', 72],
              ['Há formação / prática regular no que é crítico', 88],
            ]),
          },
        ],
      },
      {
        id: 's5a2',
        name: 'Prioridades e decisões',
        questions: [
          {
            id: 's5a2q1',
            prompt: 'As prioridades da semana estão claras para quem trabalha no negócio?',
            help: 'Se for só você: consegue decidir o que não fazer esta semana?',
            weight: 2,
            options: opt([
              ['Vou reagindo ao que aparece', 22],
              ['Tenho prioridades na cabeça', 48],
              ['Prioridades combinadas com quem me ajuda', 72],
              ['Prioridades visíveis / escritas e revistas', 88],
            ]),
          },
        ],
      },
      {
        id: 's5a3',
        name: 'Remuneração e desempenho',
        questions: [
          {
            id: 's5a3q1',
            prompt: 'Se há ajuda paga (salário, diária, comissão), as regras de pagamento estão claras?',
            help: 'Se trabalha sozinho sem ajuda paga, escolha a primeira opção.',
            weight: 2,
            options: opt([
              ['Não se aplica — trabalho sozinho / sem ajuda paga', 70],
              ['Há pagamento, mas as regras são pouco claras', 40],
              ['Regras claras para quem ajuda', 75],
              ['Regras claras e ligadas a resultados simples', 88],
            ]),
          },
          {
            id: 's5a3q2',
            prompt: 'Dá e recebe feedback sobre o trabalho (mesmo informal, com quem o ajuda)?',
            help: 'Em solo: autoavaliação do que correu bem/mal na semana também conta.',
            weight: 1,
            options: opt([
              ['Quase nunca', 22],
              ['Só quando há problema', 48],
              ['Com alguma rotina (semanal / mensal)', 72],
              ['Rotina clara com próximos passos', 88],
            ]),
          },
        ],
      },
    ],
  },
  {
    id: 's6',
    slug: 'digital',
    name: 'Digital, dados e segurança',
    intro:
      'Ferramentas, dados para decisão e proteção mínima do negócio digital.',
    areas: [
      {
        id: 's6a1',
        name: 'Sistemas e dados',
        questions: [
          {
            id: 's6a1q1',
            prompt: 'Dados comerciais e financeiros vivem num sistema central (ERP, folha, CRM) ou folhas dispersas?',
            help: 'Dispersão aumenta erro e tempo perdido.',
            weight: 2,
            options: opt([
              ['Muito disperso', 18],
              ['Principalmente folhas', 42],
              ['Sistema central com lacunas', 70],
              ['Sistema central com rotinas claras', 90],
            ]),
          },
          {
            id: 's6a1q2',
            prompt: 'Existe cópia de segurança automática dos dados críticos?',
            help: 'Ransomware e falhas de hardware são comuns.',
            weight: 3,
            options: opt([
              ['Não', 15],
              ['Manual irregular', 40],
              ['Automática sem teste', 65],
              ['Automática com teste de restauro', 90],
            ]),
          },
        ],
      },
      {
        id: 's6a2',
        name: 'Presença digital e canais',
        questions: [
          {
            id: 's6a2q1',
            prompt: 'Canais digitais (site, redes, WhatsApp business) estão atualizados e com mensagem coerente com a marca?',
            help: 'Incoerência confunde cliente.',
            weight: 2,
            options: opt([
              ['Desatualizado ou incoerente', 20],
              ['Parcialmente coerente', 48],
              ['Coerente, revisão trimestral', 75],
              ['Coerente, revisão mensal ou mais', 90],
            ]),
          },
          {
            id: 's6a2q2',
            prompt: 'Mede origem dos contactos (UTM, número dedicado, formulário)?',
            help: 'Sem medição não se otimiza investimento digital.',
            weight: 2,
            options: opt([
              ['Não', 18],
              ['Parcial', 45],
              ['Sim, revisão mensal', 72],
              ['Sim, ligado ao acompanhamento de contactos e vendas', 88],
            ]),
          },
        ],
      },
      {
        id: 's6a3',
        name: 'Cibersegurança e acesso',
        questions: [
          {
            id: 's6a3q1',
            prompt: 'Contas críticas (email, banco, redes sociais) têm autenticação de dois factores?',
            help: 'Reduz risco de hijack e fraude.',
            weight: 2,
            options: opt([
              ['Não / não sabemos', 18],
              ['Só em parte', 45],
              ['Na maioria das contas críticas', 75],
              ['Política obrigatória para toda a equipa', 90],
            ]),
          },
          {
            id: 's6a3q2',
            prompt: 'Existe política de passwords e revogação de acessos quando alguém sai?',
            help: 'Ex-funcionários com acesso são risco comum.',
            weight: 2,
            options: opt([
              ['Não', 18],
              ['Informal', 45],
              ['Checklist na saída', 72],
              ['Processo documentado e auditado', 88],
            ]),
          },
        ],
      },
    ],
  },
  {
    id: 's7',
    slug: 'risk',
    name: 'Riscos, legal e conformidade',
    intro:
      'Contratos, impostos, seguros e riscos operacionais mínimos para continuidade.',
    areas: [
      {
        id: 's7a1',
        name: 'Contratos e obrigações',
        questions: [
          {
            id: 's7a1q1',
            prompt: 'Contratos com clientes e fornecedores críticos estão formalizados e arquivados?',
            help: 'Verbal não protege em disputa.',
            weight: 2,
            options: opt([
              ['Muitos informais', 20],
              ['Parcialmente formalizados', 48],
              ['Formalizados na maioria', 75],
              ['Formalizados + revisão legal periódica', 90],
            ]),
          },
        ],
      },
      {
        id: 's7a2',
        name: 'Seguros e continuidade',
        questions: [
          {
            id: 's7a2q1',
            prompt: 'Existem seguros ou planos de continuidade para riscos maiores (incêndio, ciber, responsabilidade)?',
            help: 'Um incidente pode encerrar o negócio.',
            weight: 2,
            options: opt([
              ['Não', 18],
              ['Só o mínimo legal', 45],
              ['Cobertura adequada parcial', 70],
              ['Cobertura revisada anualmente', 88],
            ]),
          },
        ],
      },
      {
        id: 's7a3',
        name: 'Fiscal e obrigações formais',
        questions: [
          {
            id: 's7a3q1',
            prompt: 'Declarações fiscais e obrigações legais do sector são cumpridas com calendário e responsável definido?',
            help: 'Multas e bloqueios bancários destroem reputação.',
            weight: 3,
            options: opt([
              ['Frequentemente em cima do prazo ou atraso', 20],
              ['Cumpridas mas com stress', 48],
              ['Calendário interno', 72],
              ['Calendário + revisão dupla ou contabilista dedicado', 90],
            ]),
          },
        ],
      },
    ],
  },
];

export type FlatQuestion = {
  flatIndex: number;
  sector: QuizSector;
  area: QuizArea;
  question: QuizQuestion;
};

export function flattenDiagnosticQuiz(sectors: QuizSector[]): FlatQuestion[] {
  const list: FlatQuestion[] = [];
  let i = 0;
  for (const sector of sectors) {
    for (const area of sector.areas) {
      for (const question of area.questions) {
        list.push({ flatIndex: i++, sector, area, question });
      }
    }
  }
  return list;
}

export type AreaScore = {
  areaId: string;
  areaName: string;
  sectorId: string;
  sectorSlug: string;
  score: number;
  lowSignals: string[];
};

export type SectorScore = {
  sectorId: string;
  sectorSlug: string;
  sectorName: string;
  score: number;
  areas: AreaScore[];
  lowSignals: string[];
};

export type DiagnosticResult = {
  overall: number;
  sectors: SectorScore[];
  weakestSectors: SectorScore[];
  weakestAreas: AreaScore[];
};

export function computeDiagnosticResult(
  sectors: QuizSector[],
  answers: Record<string, string>
): DiagnosticResult {
  const sectorScores: SectorScore[] = [];

  for (const sector of sectors) {
    const areas: AreaScore[] = [];
    for (const area of sector.areas) {
      let weighted = 0;
      let wsum = 0;
      const lowSignals: string[] = [];
      for (const q of area.questions) {
        const val = answers[q.id];
        const chosen = q.options.find((o) => o.id === val) ?? q.options.find((o) => o.id === 'unk');
        const score = chosen?.score ?? 40;
        weighted += score * q.weight;
        wsum += q.weight;
        if (score <= 48) lowSignals.push(q.prompt);
      }
      const score = wsum > 0 ? Math.round(weighted / wsum) : 0;
      areas.push({
        areaId: area.id,
        areaName: area.name,
        sectorId: sector.id,
        sectorSlug: sector.slug,
        score,
        lowSignals,
      });
    }
    const sectorScore =
      areas.length > 0 ? Math.round(areas.reduce((a, b) => a + b.score, 0) / areas.length) : 0;
    const lowSignals = areas.flatMap((a) => a.lowSignals).slice(0, 6);
    sectorScores.push({
      sectorId: sector.id,
      sectorSlug: sector.slug,
      sectorName: sector.name,
      score: sectorScore,
      areas,
      lowSignals,
    });
  }

  const overall =
    sectorScores.length > 0
      ? Math.round(sectorScores.reduce((a, s) => a + s.score, 0) / sectorScores.length)
      : 0;

  const sortedSectors = [...sectorScores].sort((a, b) => a.score - b.score);
  const weakestSectors = sortedSectors.filter((s) => s.score < 60).slice(0, 4);

  const allAreas = sectorScores.flatMap((s) => s.areas);
  const sortedAreas = [...allAreas].sort((a, b) => a.score - b.score);
  const weakestAreas = sortedAreas.filter((a) => a.score < 58).slice(0, 6);

  return { overall, sectors: sectorScores, weakestSectors, weakestAreas };
}

/**
 * Valida e devolve sectores carregados de `quiz.json` (API / ficheiro local).
 * Devolve `null` se a estrutura for inválida.
 */
export function parseDiagnosticSectorsJson(data: unknown): QuizSector[] | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const sectors: QuizSector[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== 'object') return null;
    const s = raw as Record<string, unknown>;
    if (
      typeof s.id !== 'string' ||
      typeof s.slug !== 'string' ||
      typeof s.name !== 'string' ||
      typeof s.intro !== 'string' ||
      !Array.isArray(s.areas)
    ) {
      return null;
    }
    const areas: QuizArea[] = [];
    for (const rawA of s.areas) {
      if (!rawA || typeof rawA !== 'object') return null;
      const a = rawA as Record<string, unknown>;
      if (typeof a.id !== 'string' || typeof a.name !== 'string' || !Array.isArray(a.questions)) return null;
      const questions: QuizQuestion[] = [];
      for (const rawQ of a.questions) {
        if (!rawQ || typeof rawQ !== 'object') return null;
        const q = rawQ as Record<string, unknown>;
        if (typeof q.id !== 'string' || typeof q.prompt !== 'string' || typeof q.help !== 'string') return null;
        const w = typeof q.weight === 'number' && Number.isFinite(q.weight) ? q.weight : 1;
        if (!Array.isArray(q.options) || q.options.length === 0) return null;
        const options: QuizOption[] = [];
        for (const rawO of q.options) {
          if (!rawO || typeof rawO !== 'object') return null;
          const o = rawO as Record<string, unknown>;
          if (typeof o.id !== 'string' || typeof o.label !== 'string') return null;
          const sc = typeof o.score === 'number' && Number.isFinite(o.score) ? o.score : 40;
          options.push({ id: o.id, label: o.label, score: sc });
        }
        questions.push({ id: q.id, prompt: q.prompt, help: q.help, weight: w, options });
      }
      areas.push({ id: a.id, name: a.name, questions });
    }
    sectors.push({
      id: s.id,
      slug: s.slug,
      name: s.name,
      intro: s.intro,
      areas,
    });
  }
  return sectors;
}
