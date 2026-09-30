import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCallEvidence,
  canOpenProposalBlind,
  evidenceForDisplay,
  evidenceLine,
  extractDocumentLinks,
  hasOfficialCallEvidence,
  isLikelyCallPageUrl,
  isLikelyHomepageUrl,
  isLikelyListingUrl,
  looksInventedWithoutEvidence,
  normalizeCallDocuments,
  pickOfficialCallUrl,
} from '../../lib/opportunity/call-evidence';

test('homepage vs convocatoria page', () => {
  assert.equal(isLikelyHomepageUrl('https://www.ande.org.uy/'), true);
  assert.equal(isLikelyHomepageUrl('https://www.ande.org.uy/es'), true);
  assert.equal(isLikelyCallPageUrl('https://www.ande.org.uy/'), false);
  assert.equal(
    isLikelyCallPageUrl('https://www.ande.org.uy/convocatorias/programa-rural-2026'),
    true,
  );
});

test('invented generic programme without official call page is dropped', () => {
  assert.equal(
    looksInventedWithoutEvidence({
      name: 'ANDEDE — Programa de Apoio a Empreendimentos Rurais',
    }),
    true,
  );
  assert.equal(
    looksInventedWithoutEvidence({
      name: 'ANDEDE',
      linkOficial: 'https://www.ande.org.uy/',
    }),
    true,
  );
  assert.equal(
    looksInventedWithoutEvidence({
      name: 'ANDE rural 2026',
      callUrl: 'https://www.ande.org.uy/convocatorias/emprendimientos-2026',
    }),
    false,
  );
});

test('pickOfficialCallUrl prefers the call page over the homepage', () => {
  assert.equal(
    pickOfficialCallUrl({
      linkOficial: 'https://www.ande.org.uy/',
      callUrl: 'https://www.ande.org.uy/convocatorias/emprendimientos-2026',
    }),
    'https://www.ande.org.uy/convocatorias/emprendimientos-2026',
  );
});

test('extracts official PDFs from the call HTML', () => {
  const html = `
    <a href="/docs/bases.pdf">Bases de la convocatoria</a>
    <a href="https://grantwatch.com/file.pdf">Ignore aggregator</a>
    <a href="/sobre-nosotros">Quiénes somos</a>
  `;
  const docs = extractDocumentLinks(html, 'https://www.ande.org.uy/convocatorias/x');
  assert.equal(docs.length, 1);
  assert.equal(docs[0]?.url, 'https://www.ande.org.uy/docs/bases.pdf');
  assert.equal(docs[0]?.kind, 'pdf');
});

test('keeps Guidelines for Applicants even without .pdf in the href', () => {
  const html = `<a href="/Grant/ViewGuidelines/GO123">Guidelines for Applicants</a>`;
  const docs = extractDocumentLinks(html, 'https://www.grants.gov.au/Go/Show?GoUuid=abc');
  assert.equal(docs.length, 1);
  assert.match(docs[0]?.url || '', /ViewGuidelines/);
});

test('hasOfficialCallEvidence needs a call page or attachments', () => {
  assert.equal(hasOfficialCallEvidence({ linkOficial: 'https://www.ande.org.uy/' }), false);
  assert.equal(
    hasOfficialCallEvidence({
      documents: normalizeCallDocuments([{ title: 'Bases', url: 'https://www.ande.org.uy/bases.pdf' }]),
    }),
    true,
  );
});

test('evidence is verified only after HTTP OK on an official call page', () => {
  const call = { callUrl: 'https://www.ande.org.uy/convocatorias/emprendimientos-2026' };
  assert.equal(buildCallEvidence(call).status, 'unconfirmed');
  assert.equal(canOpenProposalBlind(call), false);

  const verified = buildCallEvidence(call, {
    httpOk: true,
    verifiedAt: '2026-09-23T12:00:00.000Z',
  });
  assert.equal(verified.status, 'verified');
  assert.equal(verified.documentCount, 0);
  assert.equal(canOpenProposalBlind({ ...call, evidence: verified }), true);
  assert.match(evidenceLine(verified, 'pt').label, /Verificado/);
  assert.match(evidenceLine(verified, 'pt').label, /página oficial/);
  assert.match(evidenceLine(verified, 'pt').label, /sem anexos/);
  assert.match(evidenceLine(verified, 'es').label, /sin anexos/);
  assert.match(evidenceLine(verified, 'en').label, /no attachments/);

  const failed = buildCallEvidence(call, { httpOk: false, httpStatus: 404 });
  assert.equal(failed.status, 'failed');
  assert.equal(canOpenProposalBlind({ ...call, evidence: failed }), false);
  assert.equal(evidenceLine(failed, 'pt').tone, 'bad');
  assert.match(evidenceLine(failed, 'pt').label, /não existe \(404\)/i);
  assert.match(evidenceLine(failed, 'es').label, /La página oficial no existe \(404\)/);
  assert.match(evidenceLine(failed, 'en').label, /Official page not found \(404\)/);
  assert.equal(evidenceLine(failed, 'es').label.includes('no respondió'), false);

  const networkMiss = buildCallEvidence(call, { httpOk: false, httpStatus: 0 });
  assert.equal(networkMiss.status, 'unconfirmed');
  assert.match(evidenceLine(networkMiss, 'es').label, /HTTP|timeout/i);
  assert.equal(evidenceLine(networkMiss, 'es').label.includes('falta confirmar'), false);
  assert.equal(evidenceLine(networkMiss, 'es').label.includes('URL oficial citada'), false);
  assert.equal(evidenceLine(networkMiss, 'es').label.includes('no respondió'), false);
});

test('homepage-only stays unconfirmed even if the site responds', () => {
  const ev = buildCallEvidence({ linkOficial: 'https://www.ande.org.uy/' }, { httpOk: true });
  assert.equal(ev.status, 'unconfirmed');
  assert.equal(canOpenProposalBlind({ linkOficial: 'https://www.ande.org.uy/', evidence: ev }), false);
});

const IFAD_AGTECH =
  'https://www.ifad.org/en/w/calls-for-proposal/call-for-proposals-selecting-an-implementing-partner-for-the-grant-evidence-for-scale-up-of-agtech-and-fintech-solutions-through-ifad-polg';
const IFAD_SAFEGUARD =
  'https://www.ifad.org/es/w/calls-for-proposal/regional-grant-safeguarding-rural-livelihoods-in-latin-america-and-the-caribbean';

test('the two IFAD Google slugs are call pages, not homepage or listing', () => {
  assert.equal(isLikelyHomepageUrl('https://www.ifad.org/'), true);
  assert.equal(isLikelyHomepageUrl('https://www.ifad.org/en'), true);
  assert.equal(isLikelyListingUrl('https://www.ifad.org/en/w/calls-for-proposal'), true);
  assert.equal(isLikelyCallPageUrl('https://www.ifad.org/en/w/calls-for-proposal'), false);
  assert.equal(isLikelyCallPageUrl(IFAD_AGTECH), true);
  assert.equal(isLikelyCallPageUrl(IFAD_SAFEGUARD), true);
  assert.equal(isLikelyHomepageUrl(IFAD_AGTECH), false);
  assert.equal(pickOfficialCallUrl({ callUrl: IFAD_AGTECH, linkOficial: 'https://www.ifad.org/' }), IFAD_AGTECH);
});

test('IFAD annex list without .pdf in href is kept', () => {
  const html = `
    <h2>Proposal submission requirements</h2>
    <ul>
      <li><a href="/documents/d/guest/concept-note-template">Concept Note Template (Annex 1)</a></li>
      <li><a href="/documents/d/guest/grant-detailed-activity-based-budget">Grant Detailed Activity-based Budget (Annex 2)</a></li>
      <li><a href="/documents/d/guest/self-certification-eligibility">Self-Certification of Eligibility for IFAD grant financing (Annex 3)</a></li>
      <li><a href="/documents/d/guest/self-certification-un">Self certification of eligibility for IFAD grant financing – UN entities (Annex 4)</a></li>
    </ul>
  `;
  const docs = extractDocumentLinks(html, IFAD_SAFEGUARD);
  assert.equal(docs.length, 4);
  assert.ok(docs.some((d) => /Annex 1/i.test(d.title)));
  assert.ok(docs.every((d) => d.url.includes('/documents/')));
});

test('homepage must not display as verified', () => {
  const ev = evidenceForDisplay({
    callUrl: 'https://www.ifad.org/',
    evidence: {
      status: 'verified',
      callUrl: 'https://www.ifad.org/',
      documentCount: 0,
      httpOk: true,
      httpStatus: 200,
    },
  });
  assert.equal(ev.status, 'unconfirmed');
});

test('evidence line never uses weasel copy', () => {
  const line = evidenceLine(
    { status: 'unconfirmed', callUrl: IFAD_AGTECH, documentCount: 0, httpStatus: 0, httpOk: false },
    'es',
  );
  assert.equal(/falta confirmar|URL oficial citada|no respondió/i.test(line.label), false);
});
