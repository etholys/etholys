import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  remainingScanBudgetUsd,
  scanBudgetUsd,
  structureReserveUsd,
} from '../../lib/opportunity/discovery-budget';
import {
  canonicalizeDiscoveryHost,
  extractHostsFromText,
  filterQueriesAgainstCooldown,
  formatCooldownPromptBlock,
  sourceCooldownDays,
} from '../../lib/opportunity/discovery-source-cooldown-core';
import { buildDiscoveryBudgetExpansionPacks } from '../../lib/opportunity/discovery-queries';

describe('discovery-budget', () => {
  it('defaults to $1 scan budget', () => {
    assert.equal(scanBudgetUsd(), 1);
    assert.ok(structureReserveUsd() > 0);
    assert.ok(structureReserveUsd() < scanBudgetUsd());
  });

  it('remaining is full budget when no ALS usage', () => {
    assert.equal(remainingScanBudgetUsd(0), scanBudgetUsd());
  });
});

describe('discovery-source-cooldown', () => {
  it('defaults to 7-day cooldown', () => {
    assert.equal(sourceCooldownDays(), 7);
  });

  it('canonicalizes hosts without www', () => {
    assert.equal(canonicalizeDiscoveryHost('https://www.AECID.es/path'), 'aecid.es');
    assert.equal(canonicalizeDiscoveryHost('https://ifad.org/en/w'), 'ifad.org');
    assert.equal(canonicalizeDiscoveryHost('not a url'), null);
  });

  it('extracts hosts from research text', () => {
    const hosts = extractHostsFromText(
      'See https://www.aecid.es/convocatoria and also http://ifad.org/calls?x=1.',
    );
    assert.ok(hosts.includes('aecid.es'));
    assert.ok(hosts.includes('ifad.org'));
  });

  it('filters site: queries against cooldown set', () => {
    const cooled = new Set(['ifad.org']);
    const out = filterQueriesAgainstCooldown(
      ['site:ifad.org call', 'open grant Brazil', 'site:aecid.es convocatoria'],
      cooled,
    );
    assert.deepEqual(out, ['open grant Brazil', 'site:aecid.es convocatoria']);
  });

  it('formats cooldown prompt when hosts exist', () => {
    const block = formatCooldownPromptBlock(['aecid.es'], 7);
    assert.match(block, /SOURCE COOLDOWN/);
    assert.match(block, /aecid.es/);
  });
});

describe('discovery expansion packs', () => {
  it('builds country×theme packs for budget burn', () => {
    const packs = buildDiscoveryBudgetExpansionPacks({
      themes: ['agricultura', 'clima'],
      countries: ['Brasil', 'Paraguay'],
      kinds: ['grant'],
    });
    assert.ok(packs.length >= 2);
    assert.ok(packs.every((p) => p.queries.length > 0));
  });
});
