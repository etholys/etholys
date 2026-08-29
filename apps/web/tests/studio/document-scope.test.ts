import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  shouldApplyStudioDocumentFetch,
  shouldTrustClientStudioCanvas,
} from '../../lib/studio/document-scope';

describe('shouldApplyStudioDocumentFetch', () => {
  it('accepts when doc id and epoch match', () => {
    assert.equal(shouldApplyStudioDocumentFetch('doc-a', 'doc-a', 2, 2), true);
  });

  it('rejects when document id changed', () => {
    assert.equal(shouldApplyStudioDocumentFetch('doc-a', 'doc-b', 2, 2), false);
  });

  it('rejects when a newer load started', () => {
    assert.equal(shouldApplyStudioDocumentFetch('doc-a', 'doc-a', 2, 3), false);
  });
});

describe('shouldTrustClientStudioCanvas', () => {
  const serverAt = '2026-08-29T12:00:00.000Z';

  it('trusts dirty client canvas', () => {
    assert.equal(shouldTrustClientStudioCanvas(true, 'other', serverAt), true);
  });

  it('trusts client canvas when revision matches server', () => {
    assert.equal(shouldTrustClientStudioCanvas(false, serverAt, serverAt), true);
  });

  it('rejects stale client canvas from another document session', () => {
    assert.equal(shouldTrustClientStudioCanvas(false, '2026-08-28T12:00:00.000Z', serverAt), false);
  });
});
