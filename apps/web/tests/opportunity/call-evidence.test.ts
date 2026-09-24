import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCallEvidence,
  canOpenProposalBlind,
  evidenceLine,
  hasOfficialCallEvidence,
  isLikelyCallPageUrl,
  isLikelyHomepageUrl,
  looksInventedWithoutEvidence,
  normalizeCallDocuments,
  pickOfficialCallUrl,
} from '../../lib/opportunity/call-evidence';
import { extractDocumentLinks } from '../../lib/opportunity/call-evidence';

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

  const failed = buildCallEvidence(call, { httpOk: false });
  assert.equal(failed.status, 'failed');
  assert.equal(canOpenProposalBlind({ ...call, evidence: failed }), false);
  assert.equal(evidenceLine(failed, 'pt').tone, 'bad');
});

test('homepage-only stays unconfirmed even if the site responds', () => {
  const ev = buildCallEvidence({ linkOficial: 'https://www.ande.org.uy/' }, { httpOk: true });
  assert.equal(ev.status, 'unconfirmed');
  assert.equal(canOpenProposalBlind({ linkOficial: 'https://www.ande.org.uy/', evidence: ev }), false);
});
