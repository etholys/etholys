import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildStudioCopilotUserText,
  isStudioCopilotExplicitApproval,
  isStudioCopilotShortApproval,
} from '../../lib/studio/copilot-history';
import {
  buildStructureApprovalPatches,
  extractStructureOutline,
  findStructureProposalMessage,
  isStructureApprovalMessage,
  isStructureDevelopRequest,
  readStudioStructureState,
} from '../../lib/studio/structure-apply';
import { emptyStudioCanvas } from '../../lib/studio/types';

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

  it('detects explicit Spanish structure approval', () => {
    assert.equal(isStudioCopilotExplicitApproval('apruebo esta estructura tal como está'), true);
  });
});

describe('structure approval', () => {
  const history = [
    { role: 'user', content: 'Propón una estructura' },
    {
      role: 'assistant',
      content:
        '## PROPUESTA DE ESTRUCTURA\n\n**1. Identidad**\n\n¿Apruebas esta estructura o quieres ajustar algo antes de que edite el documento?',
    },
    { role: 'user', content: 'aprobado' },
    {
      role: 'assistant',
      content: 'Necesito más contexto…',
    },
  ];

  it('finds structure proposal even after bad follow-up', () => {
    const proposal = findStructureProposalMessage(history);
    assert.ok(proposal);
    assert.match(proposal!.content, /PROPUESTA DE ESTRUCTURA/);
  });

  it('detects aprobado as structure approval', () => {
    assert.equal(isStructureApprovalMessage('aprobado'), true);
    assert.equal(isStructureApprovalMessage('apruebo esta estructura tal como está'), true);
  });

  it('builds fallback patches from proposal', () => {
    const canvas = emptyStudioCanvas('report');
    canvas.pages[0].blocks.push({
      id: 'block-h2',
      kind: 'heading',
      title: 'Sec',
      text: 'Old',
      order: 2,
    });
    const proposal = findStructureProposalMessage(history)!;
    const patches = buildStructureApprovalPatches(canvas, proposal.content);
    assert.ok(patches.length >= 1);
    assert.match(patches[0].text || '', /Identidad/);
  });

  it('extracts outline sections', () => {
    const sections = extractStructureOutline(
      '### PARTE I\n**1. Identidad de Marca**\n- 9.1 Producción por Lotes',
    );
    assert.deepEqual(sections, ['PARTE I', '1. Identidad de Marca']);
  });

  it('detects develop request for approved structure', () => {
    assert.equal(
      isStructureDevelopRequest(
        'pero lo que estoy pidiendo es que desarrolles esa estructura que está aprobada',
      ),
      true,
    );
  });

  it('infers approved state from conversation', () => {
    const messages = [
      {
        role: 'assistant',
        content:
          '## PROPUESTA DE ESTRUCTURA\n**1. Identidad**\n¿Apruebas esta estructura antes de que edite el documento?',
      },
      { role: 'user', content: 'apruebo esta estructura tal como está' },
      {
        role: 'assistant',
        content: 'Perfecto, la estructura queda aprobada tal como está.',
      },
    ];
    const state = readStudioStructureState(messages);
    assert.equal(state?.status, 'approved');
  });
});
