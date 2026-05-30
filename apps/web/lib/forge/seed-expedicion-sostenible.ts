import { Prisma } from '@prisma/client';
import { getForgeDb } from '@/lib/forge/db';
import { EXPEDICION_LIBRO_FULL, getFullLibroMarkdown } from '@/lib/forge/expedicion-libro-full';
import { assertExpedicionOwnerCompany } from '@/lib/forge/expedicion-owner';
import { buildExpedicionLiveConfig } from '@/lib/forge/expedicion-live';
import { EXPEDICION_PRESENTATION_SLIDES } from '@/lib/forge/expedicion-presentacion-slides';
import { libroChapterForModuleTitle } from '@/lib/forge/libro-reference';

export const EXPEDICION_COURSE_TITLE = 'La Expedición Sostenible';

function enrichLessonBody(moduleTitle: string, baseBody: string): string {
  const ch = libroChapterForModuleTitle(moduleTitle);
  const extra = ch ? EXPEDICION_LIBRO_FULL[ch.id] : undefined;
  if (!extra) return baseBody;
  return `${baseBody}\n\n---\n\n### Lectura del Libro Didáctico\n\n${extra}`;
}

type LessonCfg = { title: string; body: string; durationMinutes: number };
type QuizCfg = {
  title: string;
  questions: { id: string; prompt: string; options: string[]; correctIndex: number }[];
};
type ModuleCfg = { title: string; lesson: LessonCfg; quiz: QuizCfg };

const MODULES: ModuleCfg[] = [
  {
    title: 'Bienvenida — La Expedición',
    lesson: {
      title: 'Bienvenidos, expedicionarios',
      durationMinutes: 15,
      body: `Este curso es **síncrono**: aprendéis en **videollamada** con el facilitador, no con vídeos grabados.

En cada sesión entráis a la **videollamada (Jitsi)** y al **Salón FORGE**: un **tablero colectivo** (pista de 20 casillas, todos ven el mismo) y, en paralelo, **vuestro mapa A2 personal** donde pegáis fichas de vuestro modelo de negocio.

Recibiréis un **Mapa A2** (cinco estaciones) y **500 Eco-Créditos** iniciales en vuestra cuenta. El objetivo: un modelo de **Triple Impacto** coherente y rentable.

**Reglas de oro**
1. En el tablero colectivo: lanzar el dado y mover el peón en la pista (20 casillas).
2. En casilla de estación: robar carta, resolver (escribir o dibujar) y pegar la ficha en el mapa.
3. Validación del facilitador: ficha coherente → +100 Eco-Créditos y +1 Punto de Impacto.

**Las 5 estaciones del viaje**
- **Raíces** — Estrategia y propósito
- **Tierra** — Producción y regeneración
- **Alquimia** — Transformación y valor agregado
- **Mercado** — Comercialización digital
- **Futuro** — Finanzas y escalabilidad

Consultad el Libro Didáctico como manual de referencia durante todo el recorrido.`,
    },
    quiz: {
      title: 'Checkpoint — Bienvenida',
      questions: [
        {
          id: 'b1',
          prompt: '¿Cuál es el objetivo principal de La Expedición Sostenible?',
          options: [
            'Memorizar teoría sin aplicarla',
            'Rediseñar el negocio con Triple Impacto mediante retos y juego',
            'Solo aumentar ventas sin medir impacto',
          ],
          correctIndex: 1,
        },
        {
          id: 'b2',
          prompt: 'Al validar una ficha coherente en el taller, el jugador obtiene:',
          options: ['-50 Eco-Créditos', '+100 Eco-Créditos y +1 Punto de Impacto', 'Nada hasta el final'],
          correctIndex: 1,
        },
      ],
    },
  },
  {
    title: 'Raíces — Estrategia y ADN',
    lesson: {
      title: 'Triple Impacto y propuesta de valor',
      durationMinutes: 25,
      body: `**Propósito de la unidad:** pasar del modelo de "ganancia única" al de **valor compartido**.

**Triple Impacto**
- **Económico:** viabilidad sin depender de subsidios permanentes.
- **Social:** bienestar de empleados, comunidad y cadena de suministro.
- **Ambiental:** respeto a los límites del planeta.

**Propósito evolutivo:** ¿Qué vacío dejaría mi negocio en el mundo si desapareciera hoy?

**Cliente LOHAS** (Lifestyles of Health and Sustainability): valora trazabilidad, rechaza desperdicio y busca autenticidad.

**Hack del experto:** *"Tu precio no compite con el supermercado; financia la regeneración de la tierra. Si el cliente no lo entiende, no es el cliente correcto."*

**Acción en tu mapa:** redacta tu Propuesta de Valor Sostenible:
[Producto] + [Beneficio social/ambiental] + [Diferenciador].`,
    },
    quiz: {
      title: 'Checkpoint — Raíces',
      questions: [
        {
          id: 'r1',
          prompt: 'El segmento LOHAS se caracteriza por:',
          options: [
            'Buscar solo el precio más bajo',
            'Valorar trazabilidad, autenticidad y sostenibilidad',
            'No leer etiquetas ni certificaciones',
          ],
          correctIndex: 1,
        },
        {
          id: 'r2',
          prompt: 'La Propuesta de Valor Sostenible combina:',
          options: [
            'Solo precio y descuento',
            'Producto + beneficio social/ambiental + diferenciador',
            'Solo logotipo y color',
          ],
          correctIndex: 1,
        },
      ],
    },
  },
  {
    title: 'Tierra — Producción y regeneración',
    lesson: {
      title: 'Ecoeficiencia y suelo vivo',
      durationMinutes: 25,
      body: `**Propósito:** dejar de "agotar" el recurso para empezar a **construirlo**.

**Ecoeficiencia financiera:** menos agua y menos energía = menos costos fijos. No es solo ecología, es ahorro.

**Agricultura regenerativa:** el suelo es un organismo vivo. +1% de materia orgánica retiene ~200.000 litros de agua por hectárea.

**Bioinsumos:** compost, bioles y humus reducen dependencia de químicos caros.

**Hack del experto:** *"No veas la cáscara o el estiércol como basura; es oro negro. Cada kilo de abono que fabricas es dinero que no sale de tu cuenta."*

**Acción en tu mapa:** completa el **Semáforo de Eficiencia** — una práctica roja (desperdicio) y una verde (mejora inmediata).`,
    },
    quiz: {
      title: 'Checkpoint — Tierra',
      questions: [
        {
          id: 't1',
          prompt: 'La ecoeficiencia en una PyME significa principalmente:',
          options: [
            'Gastar más energía para crecer',
            'Producir más valor con menos agua, energía e insumos',
            'Eliminar todo empleo local',
          ],
          correctIndex: 1,
        },
      ],
    },
  },
  {
    title: 'Alquimia — Transformación y valor agregado',
    lesson: {
      title: 'Escalera del valor e inocuidad',
      durationMinutes: 25,
      body: `**Propósito:** extender la vida útil del producto y el margen de ganancia.

**Escalera del valor**
1. Limpieza y empaque básico
2. Transformación simple (conservas, secado)
3. Transformación avanzada (fermentación, aceites esenciales)

**Inocuidad y BPM:** la materia prima nunca debe cruzarse con el producto terminado. La limpieza es el **seguro de vida** de tu empresa.

**Etiquetado narrativo:** el empaque es el vendedor silencioso — debe contar el impacto (ej.: "procesado con energía solar").

**Alerta de riesgo:** un solo error de higiene destruye años de reputación.

**Acción en tu mapa:** dibuja el **flujograma de valor** (3 pasos clave) y define materiales de empaque sostenible.`,
    },
    quiz: {
      title: 'Checkpoint — Alquimia',
      questions: [
        {
          id: 'a1',
          prompt: 'En inocuidad alimentaria, un flujo correcto implica:',
          options: [
            'Mezclar materia prima y producto terminado en el mismo espacio',
            'Flujo lineal sin cruce entre crudo y terminado',
            'No limpiar equipos entre lotes',
          ],
          correctIndex: 1,
        },
      ],
    },
  },
  {
    title: 'Mercado — Comercialización digital',
    lesson: {
      title: 'Social Commerce y storytelling',
      durationMinutes: 25,
      body: `**Propósito:** eliminar intermediarios innecesarios y conectar con el corazón del cliente.

**Social Commerce:** WhatsApp Business como herramienta de gestión — catálogo, etiquetas de clientes, respuestas rápidas.

**Omnicanalidad:** el mensaje de sostenibilidad debe ser el mismo en feria presencial e Instagram.

**Storytelling de impacto:** el cliente consciente compra con el corazón y justifica con la razón — muestra el detrás de escena (suelo, personas, proceso).

**Hack del experto:** *"No vendas características (es rico, es rojo); vende beneficios y valores (es saludable, protege el agua)."*

**Acción en tu mapa:** define **canales híbridos** y redacta tu guion de venta en una frase para redes.`,
    },
    quiz: {
      title: 'Checkpoint — Mercado',
      questions: [
        {
          id: 'm1',
          prompt: 'WhatsApp Business, en este modelo, se usa principalmente para:',
          options: [
            'Solo chats informales sin catálogo',
            'Catálogo, etiquetas y ventas directas organizadas',
            'Evitar todo contacto con clientes',
          ],
          correctIndex: 1,
        },
      ],
    },
  },
  {
    title: 'Futuro — Finanzas y escalabilidad',
    lesson: {
      title: 'Punto de equilibrio y hoja de ruta',
      durationMinutes: 25,
      body: `**Propósito:** asegurar que el impacto perdure en el tiempo.

**Costos de Triple Impacto:** incluye mantenimiento de bio-fábrica, certificaciones y tiempo real — si no se mide, no se gestiona.

**Punto de equilibrio:** ¿Cuántas unidades debes vender al mes para utilidad cero (ni ganas ni pierdes)?

**Escalabilidad:** crecer (vender más) vs escalar (vender mucho más sin subir costos en la misma proporción).

**Alerta de riesgo:** no mezcles dinero personal con caja del negocio sin registrarlo — mata tu crecimiento.

**Acción en tu mapa:** calcula el **punto de equilibrio** y diseña **hoja de ruta a 12 meses** con 3 hitos.

**Fórmula final del taller:** (Eco-Créditos × 0,6) + (Puntos de Impacto × 10 × 0,4).`,
    },
    quiz: {
      title: 'Checkpoint — Futuro',
      questions: [
        {
          id: 'f1',
          prompt: 'El punto de equilibrio indica:',
          options: [
            'El precio máximo del mercado',
            'Cuántas unidades vender para no tener pérdidas',
            'Solo el impuesto a pagar',
          ],
          correctIndex: 1,
        },
      ],
    },
  },
];

function buildExpedicionGameSpec(companyId: string) {
  return {
    companyId,
    engine: 'board' as const,
    title: 'Pista de La Expedición — 20 casillas',
    status: 'published' as const,
    definition: {
      schemaVersion: 1 as const,
      engine: 'board' as const,
      locale: 'es',
      title: 'La Expedición Sostenible — Taller gamificado',
      theme: 'negocios sostenibles · triple impacto',
      learningObjectives: [
        'Completar las 5 estaciones del Mapa A2 con decisiones coherentes',
        'Aplicar propósito, ecoeficiencia, valor agregado, mercado y finanzas',
        'Maximizar Eco-Créditos y Puntos de Impacto en 3,5 h de sprint',
      ],
      estimatedMinutes: 210,
      narrative:
        'Sprint de 3,5 h: avanzáis por la pista central, robáis cartas por estación y pegáis fichas en vuestro mapa. El facilitador valida y actúa como banco.',
      board: { spaces: 20, loops: true, startSpace: 0, goalSpace: 19 },
      cards: [
        {
          id: 'raices-1',
          type: 'challenge' as const,
          prompt: 'Escribe tu PROPÓSITO en 15 palabras (Raíces).',
          reflection: '¿Qué vacío dejaría tu negocio si desapareciera?',
          xp: 30,
        },
        {
          id: 'raices-2',
          type: 'challenge' as const,
          prompt: 'Dibuja o describe a tu CLIENTE IDEAL (LOHAS).',
          xp: 30,
        },
        {
          id: 'tierra-1',
          type: 'challenge' as const,
          prompt: 'Semáforo de eficiencia: 1 práctica roja y 1 verde (Tierra).',
          reflection: '¿Qué residuo transformarás en recurso?',
          xp: 30,
        },
        {
          id: 'tierra-2',
          type: 'challenge' as const,
          prompt: 'Inventario de recursos: agua, energía e insumos clave.',
          xp: 25,
        },
        {
          id: 'alquimia-1',
          type: 'challenge' as const,
          prompt: 'Diseña un empaque que no use plástico (Alquimia).',
          reflection: 'Tu empaque debe contar la historia del impacto.',
          xp: 35,
        },
        {
          id: 'alquimia-2',
          type: 'challenge' as const,
          prompt: 'Checklist de inocuidad: 3 pasos críticos en tu proceso.',
          xp: 30,
        },
        {
          id: 'mercado-1',
          type: 'challenge' as const,
          prompt: 'Guion de venta en 1 frase + canal principal (Mercado).',
          xp: 30,
        },
        {
          id: 'mercado-2',
          type: 'challenge' as const,
          prompt: 'Define tu catálogo digital (WhatsApp u otro).',
          xp: 25,
        },
        {
          id: 'futuro-1',
          type: 'challenge' as const,
          prompt: 'Calcula punto de equilibrio aproximado (Futuro).',
          reflection: '¿Cuántas unidades mínimo al mes?',
          xp: 40,
        },
        {
          id: 'futuro-2',
          type: 'challenge' as const,
          prompt: 'Hoja de ruta: 3 hitos a 12 meses.',
          xp: 35,
        },
        {
          id: 'desafio-1',
          type: 'event' as const,
          prompt: 'Desafío: sequía — pagá 100 Eco-Créditos o perdé un turno corrigiendo plan hídrico.',
          xp: 0,
        },
        {
          id: 'desafio-2',
          type: 'bonus' as const,
          prompt: 'Oportunidad: feria local — +150 Eco-Créditos si tu pitch convence a la mesa.',
          xp: 50,
        },
        {
          id: 'accion-ahorro',
          type: 'bonus' as const,
          prompt: 'Acción: ahorro inteligente — +20 Eco-Créditos.',
          xp: 20,
        },
        { id: 'r3', type: 'challenge' as const, prompt: 'Lista 3 beneficios sostenibles de tu producto.', xp: 25 },
        { id: 'r4', type: 'challenge' as const, prompt: 'Escribe 1 objetivo medible a 6 meses.', xp: 25 },
        { id: 't3', type: 'challenge' as const, prompt: '¿Cuántos litros de agua usas por unidad? Estimación.', xp: 30 },
        { id: 't4', type: 'challenge' as const, prompt: 'Nombre un residuo que convertirás en abono.', xp: 25 },
        { id: 'a3', type: 'challenge' as const, prompt: 'Dibuja flujo: materia prima → producto final (3 pasos).', xp: 35 },
        { id: 'a4', type: 'challenge' as const, prompt: 'Claim honesto para tu etiqueta (1 frase).', xp: 25 },
        { id: 'm3', type: 'challenge' as const, prompt: 'Mensaje principal para WhatsApp o Instagram.', xp: 30 },
        { id: 'm4', type: 'challenge' as const, prompt: 'Pitch de 30 segundos para la Feria de Negocios.', xp: 35 },
        { id: 'f3', type: 'challenge' as const, prompt: 'Costo fijo mensual más alto de tu negocio.', xp: 25 },
        { id: 'f4', type: 'challenge' as const, prompt: 'Meta de ventas del mes 1 en unidades.', xp: 30 },
        {
          id: 'desafio-clima',
          type: 'event' as const,
          prompt: 'Tormenta: pierdes 1 turno o pagas 80 Eco-Créditos en mejoras.',
          xp: 0,
        },
        {
          id: 'desafio-cert',
          type: 'bonus' as const,
          prompt: 'Certificación local: +120 Eco-Créditos si describes el proceso.',
          xp: 120,
        },
      ],
      rules: { maxTurns: 35, diceSides: 6, minInsights: 6 },
      scoring: { xpPerInsight: 40, completionThreshold: 0.7 },
    },
  };
}

/** Curso completo basado en materiales V2 — La Expedición Sostenible (2026). */
export async function seedExpedicionSostenibleCourse(
  companyId: string,
  userId: string,
  opts?: { replace?: boolean }
): Promise<string> {
  await assertExpedicionOwnerCompany(companyId);
  const db = getForgeDb();
  const existing = await db.forgeCourse.findFirst({
    where: { companyId, title: EXPEDICION_COURSE_TITLE },
    include: { modules: { include: { activities: true } } },
  });

  if (existing && !opts?.replace) {
    return existing.id;
  }

  if (existing && opts?.replace) {
    await db.forgeCourse.delete({ where: { id: existing.id } });
  }

  const company = await db.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { id: true, name: true, shortName: true },
  });
  const liveConfig = buildExpedicionLiveConfig({
    companyId: company.id,
    companyName: company.name,
    shortName: company.shortName ?? company.name,
  });

  const gameSpec = await db.forgeGameSpec.create({
    data: buildExpedicionGameSpec(companyId),
  });

  type ModuleSeed = {
    title: string;
    sortOrder: number;
    activities: {
      create: {
        type: string;
        title: string;
        sortOrder: number;
        xpWeight: number;
        config: Prisma.InputJsonValue;
        gameSpecId?: string;
      }[];
    };
  };

  const modulesData: ModuleSeed[] = MODULES.map((mod, mi) => ({
    title: mod.title,
    sortOrder: mi,
    activities: {
      create: [
        {
          type: 'lesson',
          title: mod.lesson.title,
          sortOrder: 0,
          xpWeight: 1,
          config: {
            body: enrichLessonBody(mod.title, mod.lesson.body),
            durationMinutes: mod.lesson.durationMinutes,
          } as Prisma.InputJsonValue,
        },
        {
          type: 'quiz',
          title: mod.quiz.title,
          sortOrder: 1,
          xpWeight: 1.2,
          config: { questions: mod.quiz.questions } as Prisma.InputJsonValue,
        },
      ],
    },
  }));

  modulesData.push({
    title: 'Taller — Tablero La Expedición',
    sortOrder: MODULES.length,
    activities: {
      create: [
        {
          type: 'lesson',
          title: 'Manual operativo del juego (resumen)',
          sortOrder: 0,
          xpWeight: 0.8,
          config: {
            durationMinutes: 20,
            body: enrichLessonBody(
              'Taller — Tablero La Expedición',
              `**Duración:** 3,5 h · **Capital inicial:** 500 Eco-Créditos.

**Turno:** Lanzar → Mover → Actuar.

**Casilla estación:** robar carta del mazo, resolver en ficha 5×5 cm y pegar en hueco del mapa (4 por estación: diagnóstico, acción, recurso, resultado).

**Validación:** coherente +100 Eco-Créditos; incoherente -50 o corregir turno siguiente.

**Fin:** 3 vueltas a la pista o tiempo cumplido. Fórmula: (Eco-Créditos × 0,6) + (Puntos de Impacto × 10 × 0,4).

A continuación jugáis la **pista digital** con las cartas de este motor FORGE.

**Materiales de apoyo (V2, 2026):** Resumen Ejecutivo, Libro Didáctico, Manual operativo, Instrumentos del juego y Guion de presentación.`
            ),
          } as Prisma.InputJsonValue,
        },
        {
          type: 'game',
          title: 'Pista de La Expedición (20 casillas)',
          sortOrder: 1,
          xpWeight: 2.5,
          gameSpecId: gameSpec.id,
          config: {
            stationLabels: ['Raíces', 'Tierra', 'Alquimia', 'Mercado', 'Futuro'],
          } as Prisma.InputJsonValue,
        },
      ],
    },
  });

  let program = await db.forgeProgram.findFirst({
    where: { companyId, title: 'La Expedición — Trilha institucional' },
  });
  if (!program) {
    program = await db.forgeProgram.create({
      data: {
        companyId,
        title: 'La Expedición — Trilha institucional',
        description:
          'Trilha completa: bienvenida, 5 estaciones, taller del tablero y certificación.',
      },
    });
  }

  const course = await db.forgeCourse.create({
    data: {
      companyId,
      programId: program.id,
      createdById: userId,
      title: EXPEDICION_COURSE_TITLE,
      description:
        'Curso síncrono por videollamada (Jitsi). Tablero colectivo en vivo + mapa A2 personal por alumno. Cinco estaciones + taller (20 casillas). Presentación y materiales V2, 2026.',
      status: 'published',
      deliveryMode: 'live',
      gamePlayMode: 'shared_live',
      presentationSlides: EXPEDICION_PRESENTATION_SLIDES as unknown as object,
      cohortMode: 'invite_only',
      liveConfig,
      coverEmoji: '🌱',
      estimatedHours: 12,
      modules: { create: modulesData as Prisma.ForgeModuleCreateWithoutCourseInput[] },
    },
  });

  const mods = await db.forgeModule.findMany({
    where: { courseId: course.id },
    orderBy: { sortOrder: 'asc' },
    include: { activities: { orderBy: { sortOrder: 'asc' } } },
  });
  const acts = mods.flatMap((m) => m.activities);

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const sessionDefs = [
    { title: 'Sesión 1 — Bienvenida y reglas del juego', offsetDays: 2, actIdx: 0 },
    { title: 'Sesión 2 — Estación Raíces', offsetDays: 5, actIdx: 2 },
    { title: 'Sesión 3 — Estación Tierra', offsetDays: 9, actIdx: 4 },
    { title: 'Sesión 4 — Estación Alquimia', offsetDays: 12, actIdx: 6 },
    { title: 'Sesión 5 — Estación Mercado', offsetDays: 16, actIdx: 8 },
    { title: 'Sesión 6 — Futuro + Taller tablero', offsetDays: 19, actIdx: acts.length - 1 },
  ];

  await db.forgeCourseFacilitator.upsert({
    where: { courseId_userId: { courseId: course.id, userId } },
    create: { courseId: course.id, userId, role: 'lead' },
    update: { role: 'lead' },
  });

  const libroMd = getFullLibroMarkdown();
  await db.forgeCourse.update({
    where: { id: course.id },
    data: {
      libroOcrText: libroMd.slice(0, 500_000),
      libroOcrStatus: 'done',
      libroOcrAt: new Date(),
      libroOcrMeta: { method: 'seed', charCount: libroMd.length, source: 'expedicion-libro-full' },
    },
  });

  for (let i = 0; i < sessionDefs.length; i++) {
    const def = sessionDefs[i];
    const start = new Date(now + def.offsetDays * day);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    await db.forgeLiveSession.create({
      data: {
        courseId: course.id,
        title: def.title,
        startsAt: start,
        endsAt: end,
        activityId: acts[def.actIdx]?.id ?? null,
        sortOrder: i,
        facilitatorNotes:
          i === sessionDefs.length - 1
            ? `${company.name}: Salón FORGE — tablero colectivo + revisar mapas A2; validar fichas +100 Eco-Créditos.`
            : `${company.name}: Salón — Jitsi + PPT; tablero colectivo cuando toque; cada alumno avanza su mapa A2.`,
      },
    });
  }

  return course.id;
}
