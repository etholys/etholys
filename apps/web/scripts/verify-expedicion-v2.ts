/**
 * Verificación local de La Expedición V2 antes de deploy.
 * Uso: npx tsx scripts/verify-expedicion-v2.ts
 */
import fs from 'fs';
import path from 'path';
import { buildCapsulasTecnicas } from '../lib/forge/expedicion-v2/capsulas-content';
import { isExpedicionV2Spec } from '../lib/forge/expedicion-v2/board-v2-mode';

const DATA = path.join(__dirname, '../lib/forge/expedicion-v2/data');

function readJson<T>(name: string): T {
  const p = path.join(DATA, name);
  if (!fs.existsSync(p)) throw new Error(`Falta ${name}`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

let errors = 0;

function ok(msg: string) {
  console.log(`  ✔ ${msg}`);
}

function fail(msg: string) {
  console.error(`  ✖ ${msg}`);
  errors += 1;
}

console.log('La Expedición V2 — verificación\n');

try {
  const micro = readJson<unknown[]>('micro-casos.json');
  if (micro.length >= 49) ok(`micro-casos: ${micro.length}`);
  else fail(`micro-casos: solo ${micro.length} (esperado ≥49)`);

  const events = readJson<{ actions: unknown[]; crises: unknown[] }>('event-cards.json');
  if (events.actions.length >= 5) ok(`cartas Acción: ${events.actions.length}`);
  else fail(`cartas Acción: ${events.actions.length}`);
  if (events.crises.length >= 5) ok(`cartas Desafío: ${events.crises.length}`);
  else fail(`cartas Desafío: ${events.crises.length}`);

  const quiz = readJson<{ pre: unknown[]; post: unknown[] }>('quiz-maturidade.json');
  if (quiz.pre.length >= 6 && quiz.post.length >= 6) {
    ok(`quiz madurez: pre=${quiz.pre.length} post=${quiz.post.length}`);
  } else fail('quiz madurez incompleto');

  const caps = buildCapsulasTecnicas();
  if (caps.length === 5 && caps.every((c) => c.body.includes('Libro didáctico'))) {
    ok(`cápsulas: ${caps.length} con texto integral`);
  } else fail('cápsulas incompletas');

  const specOk = isExpedicionV2Spec({
    schemaVersion: 1,
    engine: 'board',
    locale: 'es',
    title: 'La Expedición Sostenible',
    learningObjectives: ['x'],
    board: { spaces: 20 },
  });
  if (specOk) ok('detector expedicionV2Spec');
  else fail('detector expedicionV2Spec');
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}

console.log('');
if (errors === 0) {
  console.log('OK — listo para deploy V2');
  process.exit(0);
} else {
  console.error(`${errors} error(es). Corregir antes de producción.`);
  process.exit(1);
}
