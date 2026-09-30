import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  nextVersionNum,
  shouldSaveVersion,
  versionLabel,
} from '../../lib/opportunity/proposal-versions';

describe('proposal-versions', () => {
  it('increments version numbers', () => {
    assert.equal(nextVersionNum([]), 1);
    assert.equal(nextVersionNum([1, 3, 2]), 4);
  });

  it('skips tiny or identical content', () => {
    assert.equal(shouldSaveVersion({ nextContent: 'short' }), false);
    assert.equal(
      shouldSaveVersion({
        previousContent: 'Hello world this is a long enough draft body for versioning.',
        nextContent: 'Hello world this is a long enough draft body for versioning.',
      }),
      false,
    );
    assert.equal(
      shouldSaveVersion({
        previousContent: 'Hello world this is a long enough draft body for versioning.',
        nextContent:
          'Hello world this is a long enough draft body for versioning — with a substantial addition about objectives and budget.',
      }),
      true,
    );
  });

  it('labels by locale', () => {
    assert.equal(versionLabel(2, 'pt'), 'Versão 2');
    assert.equal(versionLabel(2, 'en'), 'Version 2');
  });
});
