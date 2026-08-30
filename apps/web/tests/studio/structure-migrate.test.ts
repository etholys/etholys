import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assignSegmentsToSections,
  buildStructureMigrationPatches,
  canvasWarrantsStructureMigration,
  collectMigratableSegments,
  scoreSegmentForSection,
} from '../../lib/studio/structure-migrate';
import { emptyStudioCanvas } from '../../lib/studio/types';

describe('structure-migrate', () => {
  const proposal = `# Propuesta de estructura

## Introducción Kumiai
- Contexto general

## Modelo financiero
- Proyecciones

## Riesgos y mitigación
- Matriz de riesgos`;

  it('scores keyword overlap', () => {
    assert.ok(
      scoreSegmentForSection('El modelo financiero incluye proyecciones a 5 años', 'Modelo financiero') >=
        1,
    );
  });

  it('collects migratable segments', () => {
    const canvas = emptyStudioCanvas('report');
    canvas.pages[0].blocks[1].text =
      'Este documento describe el modelo financiero del proyecto Kumiai con proyecciones detalladas.';
    const segments = collectMigratableSegments(canvas);
    assert.equal(segments.length, 1);
    assert.match(segments[0].text, /modelo financiero/i);
  });

  it('assigns segments by keywords', () => {
    const sections = [
      { title: 'Introducción Kumiai', bullets: [] },
      { title: 'Modelo financiero', bullets: [] },
    ];
    const segments = [
      { blockId: 'a', text: 'Contexto histórico del Kumiai en la región.' },
      { blockId: 'b', text: 'Las proyecciones del modelo financiero muestran crecimiento.' },
    ];
    const assigned = assignSegmentsToSections(sections, segments);
    assert.match(assigned[0].join(' '), /Kumiai|Contexto/i);
    assert.match(assigned[1].join(' '), /financiero|proyecciones/i);
  });

  it('builds migration patches with merged content', () => {
    const canvas = emptyStudioCanvas('report');
    canvas.pages[0].blocks.push({
      id: 'block-extra-h',
      kind: 'heading',
      title: 'Old',
      text: 'Sección antigua',
      order: 2,
    });
    canvas.pages[0].blocks.push({
      id: 'block-extra-b',
      kind: 'paragraph',
      title: 'Body',
      text: 'Texto sobre riesgos operativos y mitigación en el mercado local.',
      order: 3,
    });
    canvas.pages[0].blocks[1].text =
      'Introducción al Kumiai: cooperativa con enfoque sostenible y participación comunitaria.';

    const patches = buildStructureMigrationPatches(canvas, proposal);
    assert.ok(patches.length >= 4);
    const bodyPatch = patches.find((p) => p.blockId === 'block-body');
    assert.ok(bodyPatch);
    assert.match(bodyPatch!.text, /Kumiai|cooperativa/i);
  });

  it('warrants migration for substantial documents', () => {
    const canvas = emptyStudioCanvas('report');
    canvas.pages[0].blocks[1].text = 'x'.repeat(500);
    assert.equal(canvasWarrantsStructureMigration(canvas), true);
    assert.equal(canvasWarrantsStructureMigration(emptyStudioCanvas('report')), false);
  });
});
