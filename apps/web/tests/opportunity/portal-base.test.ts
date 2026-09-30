import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPortalRefreshBase,
  dedupePortalSourcesByHost,
  selectOfficialPortalsForCountries,
  sourceHost,
} from '../../lib/opportunity/portal-base';
import { OFFICIAL_PORTALS } from '../../lib/opportunity/official-portals';

describe('portal-base', () => {
  it('sourceHost strips www', () => {
    assert.equal(sourceHost('https://www.iadb.org/en/calls'), 'iadb.org');
  });

  it('LatAm countries keep latam + global portals', () => {
    const selected = selectOfficialPortalsForCountries(['Uruguay', 'Brasil']);
    assert.ok(selected.some((p) => p.id === 'iadb'));
    assert.ok(selected.some((p) => p.id === 'ifad'));
    assert.ok(selected.some((p) => p.region === 'br'));
    assert.ok(!selected.some((p) => p.id === 'grantsgov'));
  });

  it('empty countries returns full official list', () => {
    assert.equal(selectOfficialPortalsForCountries([]).length, OFFICIAL_PORTALS.length);
  });

  it('dedupe prefers monitored over official same host', () => {
    const merged = dedupePortalSourcesByHost([
      {
        name: 'Custom BID',
        url: 'https://www.iadb.org/custom',
        kind: 'monitored',
      },
      {
        name: 'BID / IDB',
        url: 'https://www.iadb.org/en/how-we-can-work-together/calls-proposals',
        kind: 'official',
        region: 'latam',
      },
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].kind, 'monitored');
    assert.equal(merged[0].name, 'Custom BID');
  });

  it('buildPortalRefreshBase merges monitored + official with limit', () => {
    const base = buildPortalRefreshBase({
      countries: ['Uruguay'],
      monitored: [{ name: 'ANDE', url: 'https://www.ande.org.uy/convocatorias' }],
      limit: 8,
    });
    assert.ok(base.length <= 8);
    assert.ok(base.some((s) => s.kind === 'monitored' && s.name === 'ANDE'));
    assert.ok(base.some((s) => s.kind === 'official'));
  });
});
