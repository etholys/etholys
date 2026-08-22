export type NormalizedTranscriptChunk = {
  language?: string;
  messageID?: string;
  participant?: { id?: string; name?: string; avatarUrl?: string };
  final?: string;
  stable?: string;
  unstable?: string;
};

function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function fromJigasiJson(json: any): NormalizedTranscriptChunk | null {
  if (!json || typeof json !== 'object') return null;
  const type = String(json.type || '');
  if (type !== 'transcription-result' && type !== 'translation-result') return null;

  const text =
    (Array.isArray(json.transcript) && json.transcript[0]?.text) ||
    json.text ||
    json.final ||
    '';
  const cleaned = String(text || '').trim();
  if (!cleaned) return null;

  const interim = Boolean(json.is_interim);
  return {
    language: json.language,
    messageID: json.message_id || json.messageID || json.messageId,
    participant: json.participant
      ? {
          id: json.participant.id,
          name: json.participant.name,
        }
      : undefined,
    final: interim ? undefined : cleaned,
    stable: interim ? cleaned : undefined,
  };
}

/**
 * Aceita o payload do External API (campos no topo ou em `.data`),
 * mensagens endpoint do Jigasi e chat do transcriber.
 */
export function normalizeJitsiTranscriptPayload(raw: unknown): NormalizedTranscriptChunk | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, any>;
  const inner =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data) ? root.data : root;

  if (inner.final || inner.stable || inner.unstable) {
    const finalText = String(inner.final || '').trim();
    const stableText = String(inner.stable || '').trim();
    const unstableText = String(inner.unstable || '').trim();
    if (!finalText && !stableText && !unstableText) return null;
    return {
      language: inner.language,
      messageID: inner.messageID || inner.messageId || inner.message_id,
      participant: inner.participant,
      final: finalText || undefined,
      stable: stableText || undefined,
      unstable: unstableText || undefined,
    };
  }

  const jigasiDirect = fromJigasiJson(inner) || fromJigasiJson(tryParseJson(inner));
  if (jigasiDirect) return jigasiDirect;

  const eventData = inner.eventData && typeof inner.eventData === 'object' ? inner.eventData : null;
  if (eventData) {
    const fromEvent =
      fromJigasiJson(eventData) ||
      fromJigasiJson(eventData.data) ||
      fromJigasiJson(tryParseJson(eventData.text)) ||
      fromJigasiJson(tryParseJson(eventData.data));
    if (fromEvent) return fromEvent;
  }

  const message = String(inner.message || inner.txt || '').trim();
  const nick = String(inner.nick || inner.displayName || inner.from || '');
  if (message && /transcrib|jigasi|vosk|transcriber/i.test(`${nick} ${message}`)) {
    return {
      messageID: inner.messageId || inner.messageID || `chat-${Date.now()}`,
      participant: { name: nick || 'Transcriber' },
      final: message,
    };
  }

  return null;
}
