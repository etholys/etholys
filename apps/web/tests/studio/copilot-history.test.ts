import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildStudioCopilotUserText,
  isStudioCopilotShortApproval,
} from '../../lib/studio/copilot-history';

describe('isStudioCopilotShortApproval', () => {
  it('detects Spanish approval', () => {
    assert.equal(isStudioCopilotShortApproval('aprobado'), true);
    assert.equal(isStudioCopilotShortApproval('Aprobado.'), true);
  });

  it('detects Portuguese approval', () => {
    assert.equal(isStudioCopilotShortApproval('sim'), true);
    assert.equal(isStudioCopilotShortApproval('aprovado'), true);
  });

  it('rejects long ambiguous messages', () => {
    assert.equal(isStudioCopilotShortApproval('aprobado pero cambia el título'), false);
  });
});

describe('buildStudioCopilotUserText', () => {
  const history = [
    { role: 'user', content: 'Propón una estructura' },
    {
      role: 'assistant',
      content: '¿Apruebas esta estructura o quieres ajustar algo?',
    },
  ];

  it('includes history and approval hint for aprobado', () => {
    const text = buildStudioCopilotUserText(history, 'aprobado', 'es');
    assert.match(text, /HISTORIAL DE LA CONVERSACIÓN/);
    assert.match(text, /CONFIRMA\/APROBABA/);
    assert.match(text, /aprobado/);
    assert.match(text, /Apruebas esta estructura/);
  });

  it('works without history', () => {
    const text = buildStudioCopilotUserText([], 'Hola', 'es');
    assert.equal(text, 'Hola');
  });
});
