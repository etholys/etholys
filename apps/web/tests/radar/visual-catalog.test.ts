import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cropVisualFamily, deviceVisualFamily } from '@/lib/radar/visual-catalog';

describe('radar visual catalog', () => {
  it('maps tomato cherry to tomato_stake (not generic)', () => {
    assert.equal(cropVisualFamily('Tomate cherry'), 'tomato_stake');
    assert.equal(cropVisualFamily('Tomato', 'Sweet 100'), 'tomato_stake');
  });

  it('maps leafy greens and maize distinctly', () => {
    assert.equal(cropVisualFamily('Lechuga'), 'lettuce_bed');
    assert.equal(cropVisualFamily('Rúcula'), 'lettuce_bed');
    assert.equal(cropVisualFamily('Maíz'), 'maize');
    assert.equal(cropVisualFamily('Zapallo'), 'vine_squash');
  });

  it('maps dehydrator / line names to machine family', () => {
    assert.equal(deviceVisualFamily('RADAR-DEHYDR-01', 'Secador linha A'), 'dehydrator');
    assert.equal(deviceVisualFamily(null, 'Linha secadora'), 'dehydrator');
  });
});
