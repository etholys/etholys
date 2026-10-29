import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMeetPostMeetingClassic } from '../../lib/meet/post-meeting-classic';
import { cleanSttUtteranceText, formatDialogueFromRawText } from '../../lib/meet/format-dialogue-classic';
import { resolveGenericSpeakers, estimateLineTimestamps } from '../../lib/meet/resolve-speakers-classic';
import { diarizeWhisperSegmentsClassic } from '../../lib/meet/diarize-classic';

const SAMPLE = `
Falante 1: Sí. Falante 2: Ok. , puedo hacer siete visitas a finca.
Falante 1: Bastante. Falante 2: Entonces lo vemos después, quedó pendiente de definir el alcance.
Falante 2: Después fui a la finca de don Juan Diego Valverde. Él tiene granadilla.
Falante 2: Voy a enviar el informe a ustedes.
Falante 1: Voy a habilitar una vista de técnico en los diagnósticos.
Falante 1: Podemos pasar nuestra del lunes para los miércoles e incluir a Joana 20 minutos.
Falante 2: Pura vida, muchas gracias, Thiago.
Falante 1: Bueno, Beatriz, entonces creo que es eso.
`;

test('classic summary is abstractive, not Falante quotes', () => {
  const r = generateMeetPostMeetingClassic({
    title: 'Seguimiento Frutalcop',
    notes: SAMPLE,
    locale: 'es',
    participants: ['Thiago', 'Beatriz'],
  });
  assert.doesNotMatch(r.summary, /Falante\s*\d/i);
  assert.match(r.summary, /Esta reunión|Próximos passos|Decisiones/i);
  // Must not paste long raw STT rambling as the abstract
  assert.ok(!r.summary.includes('puedo hacer siete visitas a finca'));
  assert.ok(r.summary.length < 3500);
});

test('pendientes reject past farm-visit narrative', () => {
  const r = generateMeetPostMeetingClassic({
    title: 'Seguimiento',
    notes: SAMPLE,
    locale: 'es',
  });
  const nextBlock = r.summary.split(/Próximos passos/i)[1] || '';
  assert.doesNotMatch(nextBlock, /Después fui a la finca/i);
  assert.doesNotMatch(nextBlock, /don Juan Diego/i);
});

test('tasks are short imperatives, not raw STT', () => {
  const r = generateMeetPostMeetingClassic({
    title: 'Seguimiento',
    notes: SAMPLE,
    locale: 'es',
    participants: ['Thiago', 'Beatriz'],
  });
  assert.ok(r.actionItems.length <= 8);
  for (const a of r.actionItems) {
    assert.ok(a.title.length <= 100, a.title);
    assert.doesNotMatch(a.title, /Falante/i);
    assert.doesNotMatch(a.title, /Después fui/i);
  }
  assert.ok(
    r.actionItems.some((a) => /informe|diagn|habilit|envi/i.test(a.title)),
    `expected real tasks, got: ${r.actionItems.map((a) => a.title).join(' | ')}`,
  );
});

test('tasks reject narrative / weak STT as DRAFT tickets', () => {
  const garbage = `
Falante 2: Entonces, ella está igual yo te voy a hacer un informecito.
Falante 1: Quiero revisar eso después.
Falante 2: Pura vida, ok, exacto.
Falante 1: Voy a enviar el informe mensual a Raymond.
`;
  const r = generateMeetPostMeetingClassic({
    title: 'Seguimiento',
    notes: garbage,
    locale: 'es',
    participants: ['Thiago', 'Beatriz'],
  });
  for (const a of r.actionItems) {
    assert.doesNotMatch(a.title, /informecito|ella está|Falante|Quiero revisar/i, a.title);
  }
  assert.ok(
    r.actionItems.some((a) => /envi/i.test(a.title) && /informe/i.test(a.title)),
    `expected only real send-report task, got: ${r.actionItems.map((a) => a.title).join(' | ')}`,
  );
  assert.ok(r.actionItems.length <= 3);
});

test('resolve Falante 1/2 via vocatives', () => {
  const lines = resolveGenericSpeakers(
    [
      { speaker: 'Falante 1', text: 'Bueno, Beatriz, entonces seguimos.' },
      { speaker: 'Falante 2', text: 'Pura vida, muchas gracias, Thiago.' },
    ],
    ['Thiago', 'Beatriz'],
  );
  const s1 = lines.find((l) => /Thiago|Beatriz/i.test(l.speaker));
  assert.ok(s1, `expected named speakers, got ${lines.map((l) => l.speaker).join(',')}`);
  assert.ok(lines.every((l) => !/^Falante/i.test(l.speaker)));
});

test('estimate timestamps when missing', () => {
  const timed = estimateLineTimestamps([
    { speaker: 'A', text: 'Hola, ¿cómo estás? Hablamos del proyecto.' },
    { speaker: 'B', text: 'Sí, perfecto.' },
  ]);
  assert.equal(timed[0]!.startSec, 0);
  assert.ok((timed[1]!.startSec ?? 0) > 0);
});

test('formatDialogue splits inline Falante turns', () => {
  const { lines, text } = formatDialogueFromRawText(
    'Falante 1: Hola. Falante 2: Gracias, Thiago.',
    ['Thiago', 'Beatriz'],
  );
  assert.ok(lines.length >= 2);
  assert.match(text, /\[0:00\]/);
});

test('cleanStt removes stutter and orphan punctuation', () => {
  const out = cleanSttUtteranceText(', se me se me se me enredó un poquitico');
  assert.doesNotMatch(out, /se me se me se me/i);
  assert.match(out, /Se me enredó/i);
});

test('diarize classic single participant', () => {
  const u = diarizeWhisperSegmentsClassic({
    segments: [
      { id: 0, start: 0, end: 2, text: 'hola' },
      { id: 1, start: 5, end: 7, text: 'mundo' },
    ],
    participants: ['Sabrina'],
  });
  assert.ok(u.every((x) => x.speaker === 'Sabrina'));
});
