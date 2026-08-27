import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultIncubationRun,
  parseHumanNotesFromIncubatorNotes,
  parseIncubationRunFromNotes,
  recordDiagnosis,
  serializeIncubatorNotes,
  syncLayerProgressFromTasks,
} from '../../lib/nexus-incubation-run';
import { normalizeProgram } from '../../lib/nexus-incubation-program';

test('incubation run round-trips in incubator notes', () => {
  let run = defaultIncubationRun(normalizeProgram({ mode: 'intensive', durationMonths: 6, hoursPerMonth: 10 }));
  run = recordDiagnosis(run, {
    id: 'dx1',
    at: new Date().toISOString(),
    sectorId: 'agriculture',
    sectorName: 'Agricultura',
    overall: 58,
    strengths: ['Operação'],
    weaknesses: ['Finanças'],
    potentials: ['Comercial'],
    pillarScores: [{ slug: 'finance', name: 'Finanças', score: 42 }],
  });
  const notes = serializeIncubatorNotes(run, 'Notas livres do técnico');
  assert.ok(notes.includes('Notas livres do técnico'));
  const parsed = parseIncubationRunFromNotes(notes);
  assert.equal(parsed?.diagnosis?.overall, 58);
  assert.equal(parseHumanNotesFromIncubatorNotes(notes), 'Notas livres do técnico');
});

test('sync layer progress from completed tasks', () => {
  const run = defaultIncubationRun(normalizeProgram({ durationMonths: 3, hoursPerMonth: 8 }));
  run.layers = [
    { index: 0, title: 'Camada 1', monthStart: 1, monthEnd: 2, hoursBudget: 12, goals: ['A'], status: 'active', taskIds: [] },
    { index: 1, title: 'Camada 2', monthStart: 3, monthEnd: 3, hoursBudget: 12, goals: ['B'], status: 'pending', taskIds: [] },
  ];
  run.committedAt = new Date().toISOString();
  const tasks = [
    { id: 't1', status: 'DONE', tags: 'nexus:incubation,incubation:layer:0,incubation:wi:wp_0', description: null },
    { id: 't2', status: 'TODO', tags: 'nexus:incubation,incubation:layer:0,incubation:wi:wp_1', description: null },
  ];
  const { progress } = syncLayerProgressFromTasks(run, tasks);
  assert.equal(progress.tasksDone, 1);
  assert.equal(progress.tasksTotal, 2);
  assert.equal(progress.overallPct, 50);
});
