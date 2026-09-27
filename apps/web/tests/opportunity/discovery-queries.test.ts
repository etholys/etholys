import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiscoverySearchQueries,
  detectDiscoveryRegions,
  isHomogeneousInstitutionSet,
  themeQueryBlob,
} from '../../lib/opportunity/discovery-queries';
import { OFFICIAL_FETCH_UA, officialFetchHeaders } from '../../lib/opportunity/official-fetch-headers';

test('regions from the screenshot briefing', () => {
  const regions = detectDiscoveryRegions(['Brasil', 'Estados Unidos', 'América Latina', 'Europa']);
  assert.ok(regions.includes('br'));
  assert.ok(regions.includes('us'));
  assert.ok(regions.includes('latam'));
  assert.ok(regions.includes('eu'));
});

test('open-now queries hit official portals, not aggregators', () => {
  const queries = buildDiscoverySearchQueries({
    themes: ['desenvolvimento rural', 'economia verde', 'economia circular', 'digitalização'],
    countries: ['Brasil', 'Estados Unidos', 'América Latina', 'Europa'],
    kinds: ['grant'],
  });
  assert.ok(queries.length >= 8);
  const blob = queries.join('\n');
  assert.match(blob, /funding-tenders\.europa\.eu/);
  assert.match(blob, /grants\.gov/);
  assert.match(blob, /finep\.gov\.br/);
  assert.match(blob, /iadb\.org/);
  assert.equal(/grantwatch|fundsforngos|instrumentl/i.test(blob), false);
});

test('theme blob keeps user wording', () => {
  assert.match(themeQueryBlob(['economia circular', 'digitalização']), /economia circular/);
});

test('three IFAD cards count as homogeneous', () => {
  assert.equal(
    isHomogeneousInstitutionSet([
      { institution: 'IFAD — International Fund for Agricultural Development' },
      { institution: 'IFAD' },
      { institution: 'International Fund for Agricultural Development (ONU)' },
    ]),
    true,
  );
  assert.equal(
    isHomogeneousInstitutionSet([
      { institution: 'Horizon Europe' },
      { institution: 'USDA NIFA' },
      { institution: 'FINEP' },
      { institution: 'IDB Lab' },
      { institution: 'Green Climate Fund' },
    ]),
    false,
  );
});

test('official fetch looks like Chrome, not Etholys-FundHub', () => {
  assert.match(OFFICIAL_FETCH_UA, /Chrome\/128/);
  assert.equal(OFFICIAL_FETCH_UA.includes('Etholys-FundHub'), false);
  const headers = officialFetchHeaders('https://www.ifad.org/en/w/calls');
  assert.equal(headers['User-Agent'], OFFICIAL_FETCH_UA);
  assert.equal(headers.Referer, 'https://www.ifad.org/');
  assert.equal(headers['Sec-Fetch-Dest'], 'document');
});
