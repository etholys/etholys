import test from 'node:test';
import assert from 'node:assert/strict';
import { draftPortraitFromInterview } from '../../lib/business-dossier';

test('interview draft keeps stuck and works as gap and potential', () => {
  const d = draftPortraitFromInterview(
    {
      do: 'assistência a fundos',
      money: 'editais',
      deliver: 'propostas',
      stuck: 'evidência desordenada',
      works: 'rede de confiança',
    },
    'pt'
  );
  assert.match(d.portraitText, /assistência/);
  assert.match(d.hypothesis, /evidência desordenada/);
  assert.equal(d.gaps[0]?.text, 'evidência desordenada');
  assert.equal(d.potentials[0]?.text, 'rede de confiança');
});
