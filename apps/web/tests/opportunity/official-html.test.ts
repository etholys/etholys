import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlToExcerpt, siteNameFromHtml, titleFromHtml } from '../../lib/opportunity/official-html';

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
