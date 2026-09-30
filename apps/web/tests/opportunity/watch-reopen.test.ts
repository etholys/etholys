import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decideWatchReopenNotify,
  isOpenWindowStatus,
  isWindowReopen,
} from '../../lib/opportunity/watch-reopen';

describe('watch-reopen', () => {
  it('detects closed → open as reopen', () => {
    assert.equal(
      isWindowReopen({ previousStatus: 'closed', nextStatus: 'open' }),
      true,
    );
    assert.equal(
      isWindowReopen({ previousStatus: 'seasonal', nextStatus: 'open' }),
      true,
    );
  });

  it('does not treat first open sighting as reopen', () => {
    assert.equal(
      isWindowReopen({ previousStatus: null, nextStatus: 'open' }),
      false,
    );
  });

  it('does not notify when still open', () => {
    assert.equal(
      isWindowReopen({ previousStatus: 'open', nextStatus: 'open' }),
      false,
    );
  });

  it('notifyOnEnableWhileOpen when watch just enabled', () => {
    assert.equal(
      isWindowReopen({
        previousStatus: 'open',
        nextStatus: 'open',
        watchJustEnabled: true,
        notifyOnEnableWhileOpen: true,
      }),
      true,
    );
  });

  it('decideWatchReopenNotify returns reopened reason', () => {
    const d = decideWatchReopenNotify({
      watchOpen: true,
      currentStatus: 'open',
      lastSeenStatus: 'closed',
    });
    assert.equal(d.shouldNotify, true);
    assert.equal(d.reason, 'reopened');
    assert.equal(d.nextLastSeenStatus, 'open');
  });

  it('no watch → no notify', () => {
    const d = decideWatchReopenNotify({
      watchOpen: false,
      currentStatus: 'open',
      lastSeenStatus: 'closed',
    });
    assert.equal(d.shouldNotify, false);
    assert.equal(d.reason, 'no_watch');
  });

  it('isOpenWindowStatus accepts rolling', () => {
    assert.equal(isOpenWindowStatus('rolling'), true);
    assert.equal(isOpenWindowStatus('reference'), false);
  });
});
