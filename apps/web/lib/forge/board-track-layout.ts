/** Posiciones en rejilla para circuito perimetral (tablero real, no línea recta). */
export function boardCellGridPosition(
  index: number,
  spaces = 20
): { col: number; row: number; corner?: string } {
  if (spaces === 20) {
    const map: Record<number, { col: number; row: number }> = {
      0: { col: 0, row: 5 },
      1: { col: 1, row: 5 },
      2: { col: 2, row: 5 },
      3: { col: 3, row: 5 },
      4: { col: 4, row: 5 },
      5: { col: 5, row: 5 },
      6: { col: 5, row: 4 },
      7: { col: 5, row: 3 },
      8: { col: 5, row: 2 },
      9: { col: 5, row: 1 },
      10: { col: 5, row: 0 },
      11: { col: 4, row: 0 },
      12: { col: 3, row: 0 },
      13: { col: 2, row: 0 },
      14: { col: 1, row: 0 },
      15: { col: 0, row: 0 },
      16: { col: 0, row: 1 },
      17: { col: 0, row: 2 },
      18: { col: 0, row: 3 },
      19: { col: 0, row: 4 },
    };
    return map[index] ?? { col: 0, row: 0 };
  }
  const cols = 10;
  const row = Math.floor(index / cols);
  const col = row % 2 === 1 ? cols - 1 - (index % cols) : index % cols;
  return { col, row };
}

export const BOARD_TRACK_GRID = { cols: 6, rows: 6 } as const;
