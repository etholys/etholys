import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStudioImageProvider, hasStudioImageProviderConfigured } from '@/lib/studio/image-gen';

describe('image-gen config', () => {
  it('defaults provider to auto', () => {
    const prev = process.env.STUDIO_IMAGE_PROVIDER;
    delete process.env.STUDIO_IMAGE_PROVIDER;
    assert.equal(resolveStudioImageProvider(), 'auto');
    if (prev) process.env.STUDIO_IMAGE_PROVIDER = prev;
  });

  it('svg provider is always considered configured', () => {
    const prev = process.env.STUDIO_IMAGE_PROVIDER;
    process.env.STUDIO_IMAGE_PROVIDER = 'svg';
    assert.equal(hasStudioImageProviderConfigured(), true);
    if (prev) process.env.STUDIO_IMAGE_PROVIDER = prev;
    else delete process.env.STUDIO_IMAGE_PROVIDER;
  });
});
