/**
 * Família de desenvolvimento Etholys — três produtos, um método.
 * Licença atual: NEXUS cobre NIDO + RUMO + PULSO (SKU próprio do PULSO vem depois).
 */

export const ETHOLYS_PRODUCTS = {
  nido: {
    id: 'nido' as const,
    name: 'NIDO',
    href: '/hub/nido',
    license: 'NEXUS' as const,
    tagline: {
      es: 'Incubadora virtual — técnicos, consultores e programas acompañan negocios.',
      pt: 'Incubadora virtual — técnicos, consultores e programas acompanham negócios.',
      en: 'Virtual incubator — technicians, consultants and programs accompany businesses.',
    },
  },
  rumo: {
    id: 'rumo' as const,
    name: 'RUMO',
    href: '/hub/rumo',
    license: 'NEXUS' as const,
    tagline: {
      es: 'Mapa de autodesarrollo — el negocio se entiende y se mueve solo, con IA.',
      pt: 'Mapa de autodesenvolvimento — o negócio entende-se e move-se sozinho, com IA.',
      en: 'Self-development map — the business understands itself and moves with AI.',
    },
  },
  pulso: {
    id: 'pulso' as const,
    name: 'PULSO',
    href: '/hub/pulso',
    license: 'NEXUS' as const,
    tagline: {
      es: 'Digitalización productiva — datos, WhatsApp, alertas y automatización.',
      pt: 'Digitalização produtiva — dados, WhatsApp, alertas e automatização.',
      en: 'Productive digitalization — data, WhatsApp, alerts and automation.',
    },
  },
} as const;

export type EtholysProductId = keyof typeof ETHOLYS_PRODUCTS;

export const PULSO_MODULES = [
  {
    id: 'agriculture',
    es: 'Agricultura',
    pt: 'Agricultura',
    en: 'Agriculture',
    hint: {
      es: 'Parcelas, riego, humedad, labores.',
      pt: 'Parcelas, irrigação, humidade, labores.',
      en: 'Plots, irrigation, moisture, field work.',
    },
  },
  {
    id: 'agroindustry',
    es: 'Agroindustria',
    pt: 'Agroindústria',
    en: 'Agroindustry',
    hint: {
      es: 'Lotes, planta, merma, calidad.',
      pt: 'Lotes, planta, perda, qualidade.',
      en: 'Lots, plant, waste, quality.',
    },
  },
  {
    id: 'livestock',
    es: 'Pecuaria',
    pt: 'Pecuária',
    en: 'Livestock',
    hint: {
      es: 'Rebaño, sanidad, alimento, mortandad.',
      pt: 'Rebanho, sanidade, alimento, mortalidade.',
      en: 'Herd, health, feed, mortality.',
    },
  },
  {
    id: 'carbon',
    es: 'Carbono',
    pt: 'Carbono',
    en: 'Carbon',
    hint: {
      es: 'Lectura de prácticas y emisiones — primera capa.',
      pt: 'Leitura de práticas e emissões — primeira camada.',
      en: 'Practices and emissions reading — first layer.',
    },
  },
] as const;

export type PulsoModuleId = (typeof PULSO_MODULES)[number]['id'];

export const INTERVIEW_BEATS = [
  {
    id: 'do',
    es: '¿Qué hace este negocio, en sus palabras?',
    pt: 'O que faz este negócio, nas palavras deles?',
    en: 'What does this business do, in their words?',
  },
  {
    id: 'money',
    es: 'Hoy, ¿de dónde entra el dinero?',
    pt: 'Hoje, de onde entra o dinheiro?',
    en: 'Today, where does the money come from?',
  },
  {
    id: 'deliver',
    es: '¿Qué entregan, a quién, y cómo saben que quedó bien?',
    pt: 'O que entregam, a quem, e como sabem que ficou bem?',
    en: 'What do they deliver, to whom, and how do they know it was good?',
  },
  {
    id: 'stuck',
    es: '¿Qué está trabado — lo que, si no cambia, no aguanta?',
    pt: 'O que está travado — o que, se não mudar, não segura?',
    en: 'What is stuck — what, if it does not change, will not hold?',
  },
  {
    id: 'works',
    es: '¿Qué ya funciona y se podría empujar más?',
    pt: 'O que já funciona e se poderia puxar mais?',
    en: 'What already works and could be pushed further?',
  },
] as const;

export const PRODUCT_HREF_TO_LICENSE: Record<string, 'NEXUS'> = {
  '/hub/nido': 'NEXUS',
  '/hub/rumo': 'NEXUS',
  '/hub/pulso': 'NEXUS',
  '/hub/nexus': 'NEXUS',
};
