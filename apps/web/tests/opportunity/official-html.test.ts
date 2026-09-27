import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alternateLocaleCallUrls,
  htmlMentionsAnnexes,
  htmlToExcerpt,
  isBotWallHtml,
  siteNameFromHtml,
  titleFromHtml,
} from '../../lib/opportunity/official-html';

test('titleFromHtml prefers og:title over the browser title', () => {
  const html = `
    <html><head>
      <title>Grants.gov.au</title>
      <meta property="og:title" content="Grant Opportunity GO1234">
    </head><body><h1>Ignore</h1></body></html>
  `;
  assert.equal(titleFromHtml(html), 'Grant Opportunity GO1234');
});

test('htmlToExcerpt strips scripts and collapses space', () => {
  const html = `<html><script>alert(1)</script><p>Eligible organisations  in Australia</p></html>`;
  const excerpt = htmlToExcerpt(html);
  assert.match(excerpt, /Eligible organisations in Australia/);
  assert.equal(/alert/.test(excerpt), false);
});

test('siteNameFromHtml falls back to hostname', () => {
  assert.equal(siteNameFromHtml('<html></html>', 'https://www.grants.gov.au/Go/Show?GoUuid=x'), 'grants.gov.au');
});

test('Cloudflare challenge HTML is a bot wall', () => {
  const html = `
    <title>Checking your browser</title>
    <p>Enable JavaScript and cookies to continue</p>
    <div id="challenge-platform">cf-browser-verification</div>
  `;
  assert.equal(isBotWallHtml(html), true);
  assert.equal(isBotWallHtml('<h1>Call for proposals</h1><p>Annex 1 Concept Note</p>'), false);
});

test('IFAD annex copy is detected even without pdf links', () => {
  assert.equal(htmlMentionsAnnexes('Proposal submission requirements Annex 1 Concept Note Template'), true);
  assert.equal(htmlMentionsAnnexes('About the funder'), false);
});

test('IFAD locale swap keeps the call slug', () => {
  const alts = alternateLocaleCallUrls(
    'https://www.ifad.org/en/w/calls-for-proposal/call-for-proposals-selecting-an-implementing-partner-for-the-grant-evidence-for-scale-up-of-agtech-and-fintech-solutions-through-ifad-polg',
  );
  assert.ok(alts.some((u) => u.includes('/es/w/calls-for-proposal/call-for-proposals-selecting')));
});
