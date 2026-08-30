import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectStudioContentMismatch,
  shouldApplyStudioDocumentFetch,
  shouldPersistStudioDocument,
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

describe('shouldPersistStudioDocument', () => {
  it('allows persist when doc and epoch match', () => {
    assert.equal(shouldPersistStudioDocument('doc-a', 3, 'doc-a', 3), true);
  });

  it('blocks persist after navigation', () => {
    assert.equal(shouldPersistStudioDocument('doc-a', 3, 'doc-b', 4), false);
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

describe('detectStudioContentMismatch', () => {
  it('flags Kumiai title with Nanobio body', () => {
    const hint = detectStudioContentMismatch('Plan Táctico — Kumiai Teas', {
      pages: [
        {
          blocks: [
            {
              kind: 'heading',
              text: 'PLAN DE NEGOCIO — NANOBIO',
            },
          ],
        },
      ],
    });
    assert.ok(hint?.includes('NANOBIO'));
  });

  it('passes when title matches heading', () => {
    const hint = detectStudioContentMismatch('Plan Kumiai Teas', {
      pages: [{ blocks: [{ kind: 'heading', text: 'Plan estratégico Kumiai Teas' }] }],
    });
    assert.equal(hint, null);
  });
});
