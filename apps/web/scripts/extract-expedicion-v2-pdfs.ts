/**
 * Extrai conteúdo dos PDFs oficiais V2 → JSON em lib/forge/expedicion-v2/data/
 * Uso: npx tsx scripts/extract-expedicion-v2-pdfs.ts
 */
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

const PDF_BASE =
  process.env.EXPEDICION_PDF_DIR ||
  'g:/My Drive/4.3. Contenidos Formativos/3. Negocios Sostenibles/Calendario 2026/2. V2 - La expedición sostenible/juego/PDF';

const OUT = path.join(__dirname, '../lib/forge/expedicion-v2/data');

const STATIONS = ['RAÍCES', 'RAICES', 'TIERRA', 'ALQUIMIA', 'MERCADO', 'FUTURO'] as const;

function normStation(s: string): string {
  const u = s.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (u.includes('RAIZ') || u.includes('RAICE')) return 'raices';
  if (u.includes('TIERRA')) return 'tierra';
  if (u.includes('ALQUIMIA')) return 'alquimia';
  if (u.includes('MERCADO')) return 'mercado';
  if (u.includes('FUTURO')) return 'futuro';
  return 'raices';
}

async function readPdf(name: string): Promise<string> {
  const p = path.join(PDF_BASE, name);
  const buf = fs.readFileSync(p);
  const data = await pdf(buf);
  return data.text;
}

function parseMicroCasos(text: string) {
  const cards: Array<{
    id: string;
    station: string;
    prompt: string;
    validationRubric: string;
  }> = [];

  const fmtB = /VALIDACIÓN\s*\n(RAÍCES|RAICES|TIERRA|ALQUIMIA|MERCADO|FUTURO)\s*\n([\s\S]*?)(?=\nVALIDACIÓN\s*\n(?:RAÍCES|RAICES|TIERRA|ALQUIMIA|MERCADO|FUTURO)|\nImplementas una ruta|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = fmtB.exec(text)) !== null) {
    const station = normStation(m[1]);
    const body = m[2].trim();
    const rubricStart = body.search(/\nDebe |\nEl jugador |\nDiagnóstico:/i);
    if (rubricStart < 20) continue;
    const prompt = body.slice(0, rubricStart).replace(/\s+/g, ' ').trim();
    const validationRubric = body.slice(rubricStart).replace(/\s+/g, ' ').trim();
    cards.push({
      id: `mc-${String(cards.length + 1).padStart(2, '0')}`,
      station,
      prompt,
      validationRubric,
    });
  }

  const fmtA = /([\s\S]*?)\n(RAÍCES|RAICES|TIERRA|ALQUIMIA|MERCADO|FUTURO)\s*\n([\s\S]*?)\nVALIDACIÓN/gi;
  while ((m = fmtA.exec(text)) !== null) {
    const prompt = m[1].replace(/\s+/g, ' ').trim();
    const station = normStation(m[2]);
    const validationRubric = m[3].replace(/\s+/g, ' ').trim();
    if (prompt.length < 30 || validationRubric.length < 15) continue;
    if (/Efecto:/i.test(prompt)) continue;
    const dup = cards.some((c) => c.prompt.slice(0, 40) === prompt.slice(0, 40));
    if (dup) continue;
    cards.push({
      id: `mc-${String(cards.length + 1).padStart(2, '0')}`,
      station,
      prompt,
      validationRubric,
    });
  }

  return cards.slice(0, 50);
}

function parseEventCards(text: string) {
  const tail = text.split('Implementas una ruta')[1] || text.split(/Efecto:/i)[0];
  const eventSection = text.includes('Implementas una ruta')
    ? text.slice(text.indexOf('Implementas una ruta'))
    : '';
  const src = eventSection || text;
  const actions: Array<{ id: string; kind: 'action'; title: string; effect: string; tag: string }> = [];
  const crises: Array<{ id: string; kind: 'crisis'; title: string; effect: string; tag: string; fineEco?: number }> = [];
  const re =
    /([\s\S]*?)\nEfecto:\s*([\s\S]*?)\n([A-ZÁÉÍÓÚÑ\s]+)\s*(?=\n[A-Za-zÁÉí]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const title = m[1].replace(/\s+/g, ' ').trim();
    const effect = m[2].replace(/\s+/g, ' ').trim();
    const tag = m[3].trim();
    if (title.length < 10) continue;
    const fineMatch = (effect + title).match(/(\d{2,3})\s*Eco-Créditos/i);
    const isCrisis =
      /multa|pierdes|obsoleta|pagar|inundación|prohíbe|viral|suben de precio|se va|insuficiente/i.test(
        effect + title
      ) || /CLIMA|NORMATIVO|REPUTACIÓN|CRISIS|COSTOS|TALENTO/i.test(tag);
    const item = { title, effect, tag };
    if (isCrisis) {
      crises.push({
        id: `crisis-${crises.length + 1}`,
        kind: 'crisis',
        ...item,
        fineEco: fineMatch ? Number(fineMatch[1]) : 200,
      });
    } else {
      actions.push({ id: `action-${actions.length + 1}`, kind: 'action', ...item });
    }
  }
  return { actions: actions.slice(0, 5), crises: crises.slice(0, 5) };
}

function parseQuiz(text: string) {
  const preQuestions = [
    {
      id: 'pre-1',
      text: 'EN TUS PROPIAS PALABRAS, ¿QUÉ SIGNIFICA PARA TI QUE UN NEGOCIO SEA "SOSTENIBLE"?',
      type: 'text' as const,
    },
    {
      id: 'pre-2',
      text: '¿CUÁL ES EL PRIMER PASO PARA INTEGRAR LA SOSTENIBILIDAD EN UN NEGOCIO?',
      type: 'choice' as const,
      options: [
        'Cobrar más caro por los productos.',
        'Identificar tu propósito y hacer un diagnóstico de tu situación actual.',
        'Cambiar los colores de tu marca a tonos verdes.',
      ],
      correctIndex: 1,
    },
    {
      id: 'pre-3',
      text: 'SI QUIERES REDUCIR EL IMPACTO AMBIENTAL DE TUS OPERACIONES, LO MEJOR ES:',
      type: 'choice' as const,
      options: [
        'Comprar maquinaria nueva de inmediato.',
        'Identificar y medir tus desperdicios y el uso de tus recursos naturales.',
        'Hacer una campaña publicitaria sobre ecología.',
      ],
      correctIndex: 1,
    },
    {
      id: 'pre-4',
      text: 'AL MOMENTO DE CREAR O TRANSFORMAR TU PRODUCTO/SERVICIO, UNA PRÁCTICA SOSTENIBLE ES:',
      type: 'choice' as const,
      options: [
        'Diseñar procesos circulares (reducir, reutilizar, reciclar).',
        'Producir la mayor cantidad posible sin importar las mermas.',
        'Usar el material más barato posible, aunque sea de un solo uso.',
      ],
      correctIndex: 0,
    },
    {
      id: 'pre-5',
      text: 'COMUNICAR TUS PRÁCTICAS SOSTENIBLES A LOS CLIENTES SIRVE PRINCIPALMENTE PARA:',
      type: 'choice' as const,
      options: [
        'Ocultar si el producto tiene algún defecto de calidad.',
        'Conectar con personas que valoran el impacto positivo y generar confianza.',
        'Poder vender el producto siempre al doble de precio.',
      ],
      correctIndex: 1,
    },
    {
      id: 'pre-6',
      text: '¿CÓMO SABES SI TU ESFUERZO POR SER SOSTENIBLE ESTÁ FUNCIONANDO REALMENTE?',
      type: 'choice' as const,
      options: [
        'Definiendo métricas claras y evaluando los resultados periódicamente.',
        'Sabiendo que los competidores me están copiando.',
        'Si a fin de mes me sobró algo de dinero en el banco.',
      ],
      correctIndex: 0,
    },
  ];
  const postQuestions = [
    {
      id: 'post-1',
      text: '¿CUÁL ES LA PRINCIPAL LECCIÓN QUE TE LLEVAS DE LA EXPEDICIÓN DE HOY Y CÓMO LA APLICARÁS EN TU NEGOCIO?',
      type: 'text' as const,
    },
    {
      id: 'post-2',
      text: 'SEGÚN EL MAPA QUE USASTE HOY, SU PRIMER PASO DEBERÍA SER:',
      type: 'choice' as const,
      options: [
        'Gastar sus Eco-Créditos en publicidad.',
        'Hacer un diagnóstico para saber qué tienen hoy y qué les falta.',
        'Pedir un préstamo grande al banco.',
      ],
      correctIndex: 1,
    },
    {
      id: 'post-3',
      text: 'SI QUIERES REDUCIR EL IMPACTO AMBIENTAL DE TUS OPERACIONES, LO MEJOR ES:',
      type: 'choice' as const,
      options: [
        'Tirarlos a la basura porque ya no sirven.',
        'Esconderlos para que el cliente no los vea.',
        'Definir una Acción para aprovecharlos e Invertir recursos en solucionarlo.',
      ],
      correctIndex: 2,
    },
    {
      id: 'post-4',
      text: 'CAMBIAR TU EMPAQUE ACTUAL DE PLÁSTICO POR UNO ECOLÓGICO REPRESENTA:',
      type: 'choice' as const,
      options: [
        'Una Inversión necesaria a la que luego debes medirle su Resultado/Métrica.',
        'Un gasto inútil que solo te hace perder Eco-Créditos.',
        'Una acción que se hace sola, sin necesidad de planificar.',
      ],
      correctIndex: 0,
    },
    {
      id: 'post-5',
      text: 'LA MEJOR FORMA DE LLEVAR AL MERCADO UN PRODUCTO DE TRIPLE IMPACTO ES:',
      type: 'choice' as const,
      options: [
        'Comunicar de forma transparente tu impacto real para atraer a tu público ideal.',
        'Venderlo sin explicar sus beneficios ambientales para no aburrir al cliente.',
        'Exagerar sus beneficios ecológicos (Greenwashing) para vender más rápido.',
      ],
      correctIndex: 0,
    },
    {
      id: 'post-6',
      text: 'PARA VALIDAR TU ESFUERZO DESPUÉS DE 30 DÍAS, TÚ DEBES:',
      type: 'choice' as const,
      options: [
        'Suponer que todo está bien si nadie se queja.',
        'Revisar las métricas de tu mapa para ver si funcionó.',
        'Cambiar de acción inmediatamente para probar cosas nuevas.',
      ],
      correctIndex: 1,
    },
  ];
  return { pre: preQuestions, post: postQuestions, sourceChars: text.length };
}

const CAPSULAS = [
  {
    station: 'raices',
    title: 'Cápsula Raíces',
    body: 'El propósito no es un cartel: es el filtro de cada decisión. Diagnóstico = qué tienes y qué falta en identidad, equipo y alianzas. Sin propósito medible, el negocio compite solo por precio.',
  },
  {
    station: 'tierra',
    title: 'Cápsula Tierra',
    body: 'Operaciones sostenibles empiezan por medir: agua, energía, residuos. Acción sin medición es costo oculto. Invierte en eficiencia antes de marketing verde.',
  },
  {
    station: 'alquimia',
    title: 'Cápsula Alquimia',
    body: 'Diseño circular: reduce materiales, reutiliza subproductos, recicla. Cada cambio de empaque o proceso necesita inversión y una métrica de impacto verificable.',
  },
  {
    station: 'mercado',
    title: 'Cápsula Mercado',
    body: 'Comunicar impacto real genera confianza; el greenwashing destruye la marca. Tu métrica de mercado debe ser observable por el cliente (ventas, retención, NPS).',
  },
  {
    station: 'futuro',
    title: 'Cápsula Futuro',
    body: 'Resiliencia financiera = saber punto de equilibrio, reservas y escenarios. Toda acción sostenible debe traducirse en números que sobrevivan 12 meses.',
  },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const cartasText = await readPdf('CARTAS-ES.pdf');
  const quizText = await readPdf('QUIZ-ES.pdf');
  const microCasos = parseMicroCasos(cartasText);
  const events = parseEventCards(cartasText);
  const quiz = parseQuiz(quizText);
  fs.writeFileSync(path.join(OUT, 'micro-casos.json'), JSON.stringify(microCasos, null, 2));
  fs.writeFileSync(path.join(OUT, 'event-cards.json'), JSON.stringify(events, null, 2));
  fs.writeFileSync(path.join(OUT, 'quiz-maturidade.json'), JSON.stringify(quiz, null, 2));
  fs.writeFileSync(path.join(OUT, 'capsulas-tecnicas.json'), JSON.stringify(CAPSULAS, null, 2));
  console.log(`micro-casos: ${microCasos.length}`);
  console.log(`actions: ${events.actions.length}, crises: ${events.crises.length}`);
  console.log(`quiz pre: ${quiz.pre.length}, post: ${quiz.post.length}`);
  console.log(`out: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
