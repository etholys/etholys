import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  inferStudioCopilotMode,
  normalizeStudioCopilotMode,
  pendingStructureActions,
} from '../../lib/studio/copilot-modes';
import { isStructureDevelopRequest } from '../../lib/studio/structure-apply';

describe('copilot modes', () => {
  it('normalizes mode', () => {
    assert.equal(normalizeStudioCopilotMode('propose'), 'propose');
    assert.equal(normalizeStudioCopilotMode('invalid'), 'discuss');
  });

  it('infers edit_selection when blocks selected', () => {
    assert.equal(
      inferStudioCopilotMode({ requested: 'discuss', targetBlockIds: ['b1'], structureStatus: null }),
      'edit_selection',
    );
  });

  it('pending actions for approved structure', () => {
    const approved = {
      status: 'approved' as const,
      proposalText: 'plan',
      outline: ['A'],
      updatedAt: new Date().toISOString(),
    };
    const withoutMigrate = pendingStructureActions(approved);
    assert.ok(withoutMigrate.includes('apply_structure'));
    assert.ok(!withoutMigrate.includes('migrate_structure'));

    const withMigrate = pendingStructureActions(approved, { canMigrate: true });
    assert.ok(withMigrate.includes('migrate_structure'));
  });
});

describe('develop request (modes import re-export check)', () => {
  it('detects develop phrasing', () => {
    assert.equal(isStructureDevelopRequest('desarrolles esa estructura aprobada'), true);
  });
});
