export type DiarizedUtterance = {
  speaker: string;
  text: string;
  startSec: number;
  endSec: number;
};

export function mergeAdjacentUtterances(rows: DiarizedUtterance[]): DiarizedUtterance[] {
  const merged: DiarizedUtterance[] = [];
  for (const row of rows) {
    const last = merged[merged.length - 1];
    if (last && last.speaker === row.speaker && row.startSec - last.endSec < 8) {
      last.text = `${last.text} ${row.text}`.replace(/\s+/g, ' ').trim();
      last.endSec = Math.max(last.endSec, row.endSec);
    } else {
      merged.push({ ...row });
    }
  }
  return merged;
}

export function formatDiarizedTranscript(utterances: DiarizedUtterance[]): string {
  return utterances
    .map((u) => {
      const m = Math.floor(u.startSec / 60);
      const s = Math.floor(u.startSec % 60)
        .toString()
        .padStart(2, '0');
      return `[${m}:${s}] ${u.speaker}: ${u.text}`;
    })
    .join('\n')
    .trim();
}
