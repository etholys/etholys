import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { copilotStatusHint } from '../../lib/studio/copilot-status';

describe('copilot-status', () => {
  it('shows approved structure hint', () => {
    const hint = copilotStatusHint('apply', {
      status: 'approved',
      proposalText: 'plan',
      outline: [],
      updatedAt: new Date().toISOString(),
    }, 'es');
    assert.match(hint || '', /aprobada/i);
  });

  it('shows plan mode hint', () => {
    const hint = copilotStatusHint('propose', null, 'en');
    assert.match(hint || '', /Plan mode/i);
  });
});
