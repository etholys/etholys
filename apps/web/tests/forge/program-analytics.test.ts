import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPEDICION_LIBRO_CHAPTERS, libroChapterForModuleTitle } from '../../lib/forge/libro-reference';

test('libro has 7 chapters', () => {
  assert.equal(EXPEDICION_LIBRO_CHAPTERS.length, 7);
});

test('libroChapterForModuleTitle matches module', () => {
  const ch = libroChapterForModuleTitle('Módulo Tierra — Producción');
  assert.ok(ch);
  assert.equal(ch?.moduleHint, 'Tierra');
});
