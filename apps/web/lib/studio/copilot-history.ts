export type CopilotHistoryMessage = { role: string; content: string };

function normalizeApproval(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const APPROVAL_RE =
  /^(si|s[ií]|sim|yes|ok|okay|vale|aprobado|aprovado|approved|confirmo|confirmado|de acuerdo|est[aá] bien|perfecto|proceed|continua|contin[uú]a|avanza|vai|pode|podes|adelante|est[aá] ok|listo|hecho|hazlo|faz isso|pode ser|podes ser)[.!?\s]*$/i;

const APPROVAL_PHRASE_RE =
  /^(apruebo|aprobo|confirmo|aprovado|aprobado|de acuerdo|adelante|hazlo|perfecto|sim|s[ií]|ok)\b/i;

/** Respostas curtas de confirmação («aprobado», «sim», «ok»). */
export function isStudioCopilotShortApproval(message: string): boolean {
  const n = normalizeApproval(message);
  if (!n || n.length > 48) return false;
  return APPROVAL_RE.test(n);
}

/** Confirmação explícita mais longa («apruebo esta estructura tal como está»). */
export function isStudioCopilotExplicitApproval(message: string): boolean {
  const t = message.trim();
  if (!t || t.length > 280) return false;
  const n = normalizeApproval(t);
  if (APPROVAL_PHRASE_RE.test(n)) return true;
  if (/estructura|estrutura|structure/.test(n) && /tal como|como est[aá]|as is|aprov|aproba/.test(n)) {
    return true;
  }
  return isStudioCopilotShortApproval(t);
}

function historyRoleLabel(role: string, locale: string): string {
  if (role === 'user') {
    return locale === 'es' ? 'Usuario' : locale === 'en' ? 'User' : 'Utilizador';
  }
  return locale === 'es' ? 'Asistente' : locale === 'en' ? 'Assistant' : 'Assistente';
}

/**
 * Monta o texto do turno com histórico — confirmações curtas referem-se ao turno anterior.
 */
export function buildStudioCopilotUserText(
  history: CopilotHistoryMessage[],
  newMessage: string,
  locale: string,
): string {
  const trimmed = newMessage.trim();
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
  const isApproval =
    isStudioCopilotShortApproval(trimmed) || isStudioCopilotExplicitApproval(trimmed);
  const approvalHint =
    isApproval && lastAssistant
      ? locale === 'es'
        ? `[El usuario CONFIRMA/APROBABA la propuesta del mensaje anterior del asistente. Aplícala en el documento con canvasPatches — no pidas más contexto.]\n\n`
        : locale === 'en'
          ? `[The user CONFIRMS/APPROVES the assistant's previous proposal. Apply it to the document with canvasPatches — do not ask for more context.]\n\n`
          : `[O utilizador CONFIRMA/APROVA a proposta da mensagem anterior do assistente. Aplica-a no documento com canvasPatches — não peças mais contexto.]\n\n`
      : '';

  if (!history.length) {
    return `${approvalHint}${trimmed}`;
  }

  const historyText = history
    .map((m) => `${historyRoleLabel(m.role, locale)}: ${m.content}`)
    .join('\n\n');

  const historyHeader =
    locale === 'es'
      ? 'HISTORIAL DE LA CONVERSACIÓN (usar para interpretar confirmaciones cortas como «aprobado», «sí», «ok»):'
      : locale === 'en'
        ? 'CONVERSATION HISTORY (use to interpret short confirmations like "approved", "yes", "ok"):'
        : 'HISTÓRICO DA CONVERSA (usar para interpretar confirmações curtas como «aprobado», «sim», «ok»):';

  const newHeader =
    locale === 'es'
      ? 'NUEVO MENSAJE DEL USUARIO:'
      : locale === 'en'
        ? 'NEW USER MESSAGE:'
        : 'NOVA MENSAGEM DO UTILIZADOR:';

  return `${approvalHint}${historyHeader}\n${historyText}\n\n${newHeader}\n${trimmed}`;
}
