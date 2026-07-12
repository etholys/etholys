/** Posiciones en rejilla para circuito perimetral (tablero real, no línea recta). */
export function boardCellGridPosition(
  index: number,
  spaces = 20
): { col: number; row: number; corner?: string } {
  if (spaces === 20) {
    /** 9×3 — pista ancha, pocas filas → casillas más grandes en proyección */
    const map: Record<number, { col: number; row: number }> = {
      0: { col: 0, row: 2 },
      1: { col: 1, row: 2 },
      2: { col: 2, row: 2 },
      3: { col: 3, row: 2 },
      4: { col: 4, row: 2 },
      5: { col: 5, row: 2 },
      6: { col: 6, row: 2 },
      7: { col: 7, row: 2 },
      8: { col: 8, row: 2 },
      9: { col: 8, row: 1 },
      10: { col: 8, row: 0 },
      11: { col: 7, row: 0 },
      12: { col: 6, row: 0 },
      13: { col: 5, row: 0 },
      14: { col: 4, row: 0 },
      15: { col: 3, row: 0 },
      16: { col: 2, row: 0 },
      17: { col: 1, row: 0 },
      18: { col: 0, row: 0 },
      19: { col: 0, row: 1 },
    };
    return map[index] ?? { col: 0, row: 0 };
  }
  const cols = 10;
  const row = Math.floor(index / cols);
  const col = row % 2 === 1 ? cols - 1 - (index % cols) : index % cols;
  return { col, row };
}

export const BOARD_TRACK_GRID = { cols: 9, rows: 3 } as const;

/** Proporción ancho/alto del tablero para casillas cuadradas */
export const BOARD_TRACK_ASPECT = BOARD_TRACK_GRID.cols / BOARD_TRACK_GRID.rows;

