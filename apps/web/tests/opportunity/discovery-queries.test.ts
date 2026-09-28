import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBriefingDiversity,
  briefingRequestsIfad,
  buildDiscoverySearchQueries,
  detectDiscoveryRegions,
  dropUnrequestedIfad,
  isHomogeneousInstitutionSet,
  isIfadCandidate,
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

test('Horizonte-style portal list is not a request for IFAD', () => {
  assert.equal(
    briefingRequestsIfad({
      themes: ['desenvolvimento rural', 'economia verde'],
      countries: ['Brasil', 'Europa'],
      kinds: ['grant'],
      searchFeedback:
        'Portales: gub.uy, bidlab.org, iadb.org, caf.com, fao.org, ifad.org, ec.europa.eu, funding-tenders.europa.eu.',
    }),
    false,
  );
  assert.equal(
    briefingRequestsIfad({
      themes: ['IFAD producer organizations'],
      countries: ['América Latina'],
      kinds: ['grant'],
    }),
    true,
  );
});

test('Brazil-only rural briefing still searches LATAM portals and foundations', () => {
  const regions = detectDiscoveryRegions(['Brasil'], ['desenvolvimento rural']);
  assert.ok(regions.includes('br'));
  assert.ok(regions.includes('latam'));
  const queries = buildDiscoverySearchQueries({
    themes: ['desenvolvimento rural', 'agricultura familiar'],
    countries: ['Brasil'],
    kinds: ['grant'],
  });
  const blob = queries.join('\n');
  assert.match(blob, /finep\.gov\.br/);
  assert.match(blob, /iadb\.org/);
  assert.match(blob, /iaf\.gov/);
  assert.match(blob, /fordfoundation\.org/);
  assert.equal(/ifad\.org/.test(blob), false);
});

test('unrequested IFAD cards are dropped; two per institution kept', () => {
  const briefing = {
    themes: ['economia circular', 'digitalização'],
    countries: ['Europa', 'Brasil'],
    kinds: ['grant'] as const,
  };
  const raw = [
    { name: 'FO4IMPACT', institution: 'IFAD', matchScore: 58, callUrl: 'https://www.ifad.org/en/w/1' },
    { name: 'AgTech PoLG', institution: 'IFAD — International Fund', matchScore: 65, callUrl: 'https://www.ifad.org/en/w/2' },
    { name: 'LIFE circular', institution: 'European Commission', matchScore: 80, callUrl: 'https://ec.europa.eu/life/x' },
    { name: 'LIFE climate', institution: 'European Commission', matchScore: 70, callUrl: 'https://ec.europa.eu/life/y' },
    { name: 'FINEP digital', institution: 'FINEP', matchScore: 74, callUrl: 'https://www.finep.gov.br/chamada/x' },
  ];
  assert.equal(isIfadCandidate(raw[0]!), true);
  const dropped = dropUnrequestedIfad(raw, briefing);
  assert.equal(dropped.some((c) => isIfadCandidate(c)), false);
  const diverse = applyBriefingDiversity(raw, briefing);
  assert.equal(diverse.length, 3);
  assert.equal(diverse.some((c) => c.name === 'LIFE circular'), true);
  assert.equal(diverse.some((c) => c.name === 'LIFE climate'), true);
  assert.equal(diverse.some((c) => c.name === 'FINEP digital'), true);
  assert.equal(diverse.some((c) => isIfadCandidate(c)), false);
});

test('user command is the first required search; IFAD portals when asked', () => {
  const queries = buildDiscoverySearchQueries({
    themes: ['AgTech', 'FinTech'],
    countries: ['América Latina'],
    kinds: ['grant'],
    scanName: 'IFAD AgTech',
    searchFeedback: 'IFAD evidence for scale-up of AgTech and FinTech',
  });
  assert.equal(queries[0], 'IFAD evidence for scale-up of AgTech and FinTech');
  const blob = queries.join('\n');
  assert.match(blob, /site:ifad\.org/);
  assert.match(blob, /calls-for-proposal/);
});

test('requested IFAD keeps more than one IFAD call', () => {
  const briefing = {
    themes: ['IFAD rural livelihoods'],
    countries: ['América Latina'],
    kinds: ['grant'] as const,
  };
  const raw = [
    {
      name: 'AgTech PoLG',
      institution: 'IFAD',
      matchScore: 80,
      callUrl:
        'https://www.ifad.org/en/w/calls-for-proposal/call-for-proposals-selecting-an-implementing-partner-for-the-grant-evidence-for-scale-up-of-agtech-and-fintech-solutions-through-ifad-polg',
    },
    {
      name: 'Safeguarding Rural Livelihoods',
      institution: 'IFAD',
      matchScore: 78,
      callUrl:
        'https://www.ifad.org/es/w/calls-for-proposal/regional-grant-safeguarding-rural-livelihoods-in-latin-america-and-the-caribbean',
    },
  ];
  const diverse = applyBriefingDiversity(raw, briefing);
  assert.equal(diverse.length, 2);
});

test('official fetch looks like Chrome, not Etholys-FundHub', () => {
  assert.match(OFFICIAL_FETCH_UA, /Chrome\/128/);
  assert.equal(OFFICIAL_FETCH_UA.includes('Etholys-FundHub'), false);
  const headers = officialFetchHeaders('https://www.ifad.org/en/w/calls');
  assert.equal(headers['User-Agent'], OFFICIAL_FETCH_UA);
  assert.equal(headers.Referer, 'https://www.ifad.org/');
  assert.equal(headers['Sec-Fetch-Dest'], 'document');
});
