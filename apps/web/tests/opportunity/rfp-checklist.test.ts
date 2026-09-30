import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildRfpChecklist,
  checklistFromCandidateFields,
  checklistToSectionTitles,
  appendChecklistSections,
} from '../../lib/opportunity/rfp-checklist';

describe('rfp-checklist', () => {
  it('extracts deadline, org type and budget from bases text', () => {
    const text =
      'La convocatoria cierra el 15 de noviembre. Pueden postular ONG y cooperativas. ' +
      'Se requiere presupuesto detallado y carta de intención (LOI). Contrapartida del 10%.';
    const items = buildRfpChecklist(text, 'es');
    const ids = items.map((i) => i.id);
    assert.ok(ids.includes('deadline'));
    assert.ok(ids.includes('org_type'));
    assert.ok(ids.includes('budget'));
    assert.ok(ids.includes('loi'));
    assert.ok(ids.includes('cofunding'));
  });

  it('returns empty for short blobs', () => {
    assert.deepEqual(buildRfpChecklist('corto'), []);
  });

  it('joins candidate fields', () => {
    const items = checklistFromCandidateFields(
      {
        eligibility: 'Eligible countries: Uruguay and Argentina.',
        requirements: 'Submit budget and financial statements for audit.',
        whoCanApply: null,
        basesText: null,
        sourceExcerpt: null,
      },
      'en',
    );
    const ids = items.map((i) => i.id);
    assert.ok(ids.includes('geo'));
    assert.ok(ids.includes('budget'));
    assert.ok(ids.includes('audit'));
  });

  it('maps checklist to section titles and appends markdown', () => {
    const items = buildRfpChecklist(
      'Deadline closes soon. Budget required. Consortium with local partner.',
      'en',
    );
    const titles = checklistToSectionTitles(items, 'en');
    assert.ok(titles.some((t) => /Budget/i.test(t)));
    assert.ok(titles.some((t) => /Executive summary/i.test(t)));
    const md = appendChecklistSections('# Proposal\n\n## Draft\n\n', items, 'en');
    assert.match(md, /## Budget/);
  });
});
