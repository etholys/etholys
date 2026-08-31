/** Separa texto legível de metadados legados no conteúdo das mensagens. */
export function parseStudioChatMessageContent(content: string): {
  text: string;
  attachmentNames?: string[];
  scopeLabel?: string;
} {
  let text = content;
  let attachmentNames: string[] | undefined;
  let scopeLabel: string | undefined;

  const scopeRe = /\n\n\[(?:Âmbito|Ámbito|Scope):\s*([^\]]+)\]\s*$/;
  const scopeMatch = text.match(scopeRe);
  if (scopeMatch) {
    scopeLabel = scopeMatch[1]!.trim();
    text = text.slice(0, scopeMatch.index).trimEnd();
  }

  const attachRe =
    /\n\n\[(\d+)\s+anexo\(s\):\s*([^\]]+)\]\s*$|\n\n\[(\d+)\s+attachment\(s\):\s*([^\]]+)\]\s*$/i;
  const attachMatch = text.match(attachRe);
  if (attachMatch) {
    const list = (attachMatch[2] || attachMatch[4] || '').trim();
    attachmentNames = list.split(',').map((s) => s.trim()).filter(Boolean);
    text = text.slice(0, attachMatch.index).trimEnd();
  }

  return { text, attachmentNames, scopeLabel };
}
