import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAtBriefTemplate,
  buildDiagnosisAtBrief,
  buildSectorCaseChecklist,
  saveAtCaseDraft,
  loadAtCaseDraft,
  clearAtCaseDraft,
  AT_CASE_DRAFT_KEY,
} from '../../lib/nexus-at-sector-playbook';

test('builds sector brief with focus areas and company', () => {
  const brief = buildAtBriefTemplate('food_hospitality', 'visit', 'pt', {
    companyName: 'Café Central',
  });
  assert.match(brief, /Café Central/);
  assert.match(brief, /food cost|Food cost|carta/i);
  assert.match(brief, /Entregável|Entregável/);
});

test('builds checklist items per sector and case kind', () => {
  const items = buildSectorCaseChecklist('livestock', 'visit', 'es');
  assert.ok(items.length >= 3);
  assert.ok(items.some((x) => /Observar|Evaluar|Confirmar|Abordar|Documentar/.test(x)));
});

test('builds diagnosis brief from quiz result shape', () => {
  const brief = buildDiagnosisAtBrief(
    {
      overall: 54,
      weakestSectors: [{ sectorId: 's1', sectorSlug: 'finance', sectorName: 'Finanzas', score: 41, areas: [], lowSignals: [] }],
      weakestAreas: [{ areaId: 'a1', areaName: 'Flujo de caja', sectorSlug: 'finance', score: 38 }],
    },
    'es',
    'MiPYME X'
  );
  assert.match(brief, /54\/100/);
  assert.match(brief, /Finanzas/);
  assert.match(brief, /Flujo de caja/);
});

test('draft session helpers round-trip when window exists', () => {
  const g = globalThis as typeof globalThis & { window?: Window & typeof globalThis; sessionStorage?: Storage };
  const store = new Map<string, string>();
  g.window = g as Window & typeof globalThis;
  g.sessionStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };

  saveAtCaseDraft({
    companyId: 'co_1',
    caseKind: 'diagnosis',
    brief: 'Test brief with enough chars',
    source: 'diagnosis',
  });
  const loaded = loadAtCaseDraft('co_1');
  assert.ok(loaded);
  assert.equal(loaded!.caseKind, 'diagnosis');
  clearAtCaseDraft();
  assert.equal(loadAtCaseDraft('co_1'), null);
  assert.equal(store.has(AT_CASE_DRAFT_KEY), false);
});
