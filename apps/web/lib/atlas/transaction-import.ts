/**
 * Importação financeira ATLAS sem IA.
 * Formato oficial da planilha = campos do sistema. Cabeçalhos estáveis;
 * aliases ES/PT/EN são reconhecidos para equivalência 1:1.
 */

import * as XLSX from 'xlsx';

export const ATLAS_TX_TEMPLATE_ID = 'ATLAS_TX_V1';
export const ATLAS_SMART_IMPORT_SKU = 'addon.atlas.smart_import';

export const ATLAS_TX_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT'] as const;
export type AtlasTxType = (typeof ATLAS_TX_TYPES)[number];

export const ATLAS_TX_STATUSES = ['EXECUTED', 'FORECAST'] as const;
export type AtlasTxStatus = (typeof ATLAS_TX_STATUSES)[number];

export const ATLAS_TX_CURRENCIES = ['USD', 'UYU', 'BRL', 'EUR', 'ARS'] as const;

export type AtlasTxColumnKey =
  | 'date'
  | 'type'
  | 'amount'
  | 'currency'
  | 'title'
  | 'description'
  | 'category'
  | 'status'
  | 'note';

export type AtlasTxColumnDef = {
  key: AtlasTxColumnKey;
  /** Cabeçalho canónico na planilha (espanhol, língua da UI). */
  header: string;
  aliases: string[];
  required: boolean;
};

export const ATLAS_TX_COLUMNS: AtlasTxColumnDef[] = [
  { key: 'date', header: 'fecha', aliases: ['date', 'fecha', 'data', 'fecha_prevista', 'fecha prevista'], required: true },
  { key: 'type', header: 'tipo', aliases: ['type', 'tipo'], required: true },
  {
    key: 'amount',
    header: 'monto',
    aliases: ['amount', 'monto', 'valor', 'importe', 'quantia'],
    required: true,
  },
  { key: 'currency', header: 'moneda', aliases: ['currency', 'moneda', 'moeda'], required: false },
  {
    key: 'title',
    header: 'titulo',
    aliases: ['title', 'titulo', 'título', 'nombre', 'nome', 'concepto', 'conceito'],
    required: false,
  },
  {
    key: 'description',
    header: 'descripcion',
    aliases: ['description', 'descripcion', 'descripción', 'descricao', 'descrição', 'detalle', 'detalhe'],
    required: false,
  },
  {
    key: 'category',
    header: 'categoria',
    aliases: ['category', 'categoria', 'categoría'],
    required: false,
  },
  {
    key: 'status',
    header: 'estado',
    aliases: ['status', 'estado', 'execution_status', 'executionstatus'],
    required: false,
  },
  {
    key: 'note',
    header: 'nota',
    aliases: ['note', 'nota', 'observacion', 'observación', 'observacao', 'observação'],
    required: false,
  },
];

export const ATLAS_TX_CANONICAL_HEADERS = ATLAS_TX_COLUMNS.map((c) => c.header);

export type AtlasImportIssue = {
  field: 'amount' | 'date' | 'type';
  message: string;
  raw: string;
};

export type AtlasImportTransaction = {
  title: string;
  description: string | null;
  type: AtlasTxType;
  amount: number;
  currency: string;
  category: string;
  date: string;
  note: string | null;
  executionStatus: AtlasTxStatus;
  sourceRow: number;
  issues: AtlasImportIssue[];
};

export type AtlasTemplateParseResult = {
  ok: true;
  transactions: AtlasImportTransaction[];
  summary: string;
  warnings: string[];
  mappedColumns: Partial<Record<AtlasTxColumnKey, string>>;
};

export type AtlasTemplateParseFailure = {
  ok: false;
  error: string;
  code: 'NOT_ATLAS_TEMPLATE' | 'NO_ROWS' | 'UNSUPPORTED';
  missing: AtlasTxColumnKey[];
};

function foldHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const ALIAS_INDEX: Map<string, AtlasTxColumnKey> = (() => {
  const map = new Map<string, AtlasTxColumnKey>();
  for (const col of ATLAS_TX_COLUMNS) {
    map.set(foldHeader(col.header), col.key);
    map.set(foldHeader(col.key), col.key);
    for (const alias of col.aliases) map.set(foldHeader(alias), col.key);
  }
  return map;
})();

export function mapAtlasTxHeaders(headers: string[]): Partial<Record<AtlasTxColumnKey, number>> {
  const mapped: Partial<Record<AtlasTxColumnKey, number>> = {};
  headers.forEach((raw, idx) => {
    const key = ALIAS_INDEX.get(foldHeader(String(raw ?? '')));
    if (key && mapped[key] === undefined) mapped[key] = idx;
  });
  return mapped;
}

export function isAtlasTxTemplate(headers: string[]): boolean {
  const mapped = mapAtlasTxHeaders(headers);
  return mapped.date !== undefined && mapped.type !== undefined && mapped.amount !== undefined;
}

const TYPE_ALIASES: Record<string, AtlasTxType> = {
  income: 'INCOME',
  ingreso: 'INCOME',
  ingresos: 'INCOME',
  receita: 'INCOME',
  receitas: 'INCOME',
  entrada: 'INCOME',
  i: 'INCOME',
  expense: 'EXPENSE',
  gasto: 'EXPENSE',
  gastos: 'EXPENSE',
  despesa: 'EXPENSE',
  despesas: 'EXPENSE',
  saida: 'EXPENSE',
  e: 'EXPENSE',
  transfer_in: 'TRANSFER_IN',
  transferin: 'TRANSFER_IN',
  transferencia_entrada: 'TRANSFER_IN',
  transferencia_entradas: 'TRANSFER_IN',
  transferenciaentrada: 'TRANSFER_IN',
  transfer_out: 'TRANSFER_OUT',
  transferout: 'TRANSFER_OUT',
  transferencia_salida: 'TRANSFER_OUT',
  transferencia_saida: 'TRANSFER_OUT',
  transferenciasalida: 'TRANSFER_OUT',
  transferenciasaida: 'TRANSFER_OUT',
};

export function normalizeAtlasTxType(raw: unknown): AtlasTxType | null {
  const folded = foldHeader(String(raw ?? ''));
  if (!folded) return null;
  const upper = String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  if ((ATLAS_TX_TYPES as readonly string[]).includes(upper)) return upper as AtlasTxType;
  return TYPE_ALIASES[folded] ?? null;
}

const STATUS_ALIASES: Record<string, AtlasTxStatus> = {
  executed: 'EXECUTED',
  ejecutado: 'EXECUTED',
  executado: 'EXECUTED',
  pagado: 'EXECUTED',
  pago: 'EXECUTED',
  realizado: 'EXECUTED',
  forecast: 'FORECAST',
  previsto: 'FORECAST',
  planificado: 'FORECAST',
};

export function normalizeAtlasTxStatus(raw: unknown): AtlasTxStatus {
  const folded = foldHeader(String(raw ?? ''));
  if (!folded) return 'EXECUTED';
  const upper = String(raw ?? '').trim().toUpperCase();
  if ((ATLAS_TX_STATUSES as readonly string[]).includes(upper)) return upper as AtlasTxStatus;
  return STATUS_ALIASES[folded] ?? 'EXECUTED';
}

function rawPreview(raw: unknown): string {
  if (raw == null || raw === '') return '(vacío)';
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);
  const s = String(raw).replace(/\s+/g, ' ').trim();
  return s.length > 48 ? `${s.slice(0, 45)}…` : s;
}

export function parseAtlasAmount(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.abs(raw);
  const s = String(raw ?? '')
    .replace(/\u00a0|\u202f|\u2009/g, ' ')
    .replace(/\u2212/g, '-')
    .trim();
  if (!s || s === '-' || s === '—' || s === '.') return NaN;
  if (/^#(?:n\/?a|value!|ref!|div\/0!)/i.test(s)) return NaN;
  const cleaned = s.replace(/\s/g, '').replace(/[^\d,.\-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') return NaN;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const decimals = cleaned.length - lastComma - 1;
    normalized = decimals === 3 && !cleaned.includes('.') ? cleaned.replace(',', '') : cleaned.replace(',', '.');
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? Math.abs(n) : NaN;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoFromParts(y: number, m: number, d: number): string | null {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Excel serial (1900 date system) → ISO date. */
export function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 80000) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial * 86400000);
  return new Date(utc).toISOString().slice(0, 10);
}

export function parseAtlasDate(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return isoFromParts(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return excelSerialToIso(raw);
  }
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return isoFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    let y = Number(dmy[3]);
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    if (a > 12) return isoFromParts(y, b, a);
    return isoFromParts(y, b, a);
  }
  return null;
}

function cellStr(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

const DATA_SHEET_NAMES = new Set(['transacciones', 'transactions', 'transacoes', 'transações', 'atlas', 'datos', 'dados']);
const SKIP_SHEET_NAMES = new Set(['instrucciones', 'instructions', 'instrucoes', 'instruções', 'valores', 'ayuda', 'ajuda']);

function pickDataSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet | null {
  const named = workbook.SheetNames.find((n) => DATA_SHEET_NAMES.has(foldHeader(n)));
  if (named) return workbook.Sheets[named] ?? null;

  for (const name of workbook.SheetNames) {
    if (SKIP_SHEET_NAMES.has(foldHeader(name))) continue;
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
    const headerRow = (rows[0] ?? []).map((c) => cellStr(c));
    if (isAtlasTxTemplate(headerRow)) return sheet;
  }
  return workbook.Sheets[workbook.SheetNames[0] ?? ''] ?? null;
}

export function parseAtlasTransactionWorkbook(buffer: Buffer): AtlasTemplateParseResult | AtlasTemplateParseFailure {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch {
    return { ok: false, error: 'No se pudo leer el archivo. Use .xlsx o .csv.', code: 'UNSUPPORTED', missing: [] };
  }
  const sheet = pickDataSheet(workbook);
  if (!sheet) {
    return { ok: false, error: 'La planilla no tiene hojas.', code: 'UNSUPPORTED', missing: [] };
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
  const headerRow = (rows[0] ?? []).map((c) => cellStr(c));
  const mapping = mapAtlasTxHeaders(headerRow);
  const missing = ATLAS_TX_COLUMNS.filter((c) => c.required && mapping[c.key] === undefined).map((c) => c.key);
  if (missing.length) {
    return {
      ok: false,
      error:
        'Este archivo no usa el formato ATLAS. Descargue el modelo oficial y complete las columnas, o use la importación con IA (Premium).',
      code: 'NOT_ATLAS_TEMPLATE',
      missing,
    };
  }

  const mappedColumns: Partial<Record<AtlasTxColumnKey, string>> = {};
  for (const [key, idx] of Object.entries(mapping) as [AtlasTxColumnKey, number][]) {
    mappedColumns[key] = headerRow[idx] ?? key;
  }

  const transactions: AtlasImportTransaction[] = [];
  const warnings: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const line = i + 1;
    const amountRaw = row[mapping.amount!];
    const amount = parseAtlasAmount(amountRaw);
    const dateRaw = row[mapping.date!];
    const typeRaw = row[mapping.type!];
    const titleRaw = mapping.title !== undefined ? cellStr(row[mapping.title]) : '';
    const descRaw = mapping.description !== undefined ? cellStr(row[mapping.description]) : '';
    const empty =
      !cellStr(dateRaw) &&
      !cellStr(typeRaw) &&
      !(typeof amountRaw === 'number') &&
      !cellStr(amountRaw) &&
      !titleRaw;
    if (empty) continue;

    const issues: AtlasImportIssue[] = [];
    if (!Number.isFinite(amount) || amount <= 0) {
      issues.push({
        field: 'amount',
        raw: rawPreview(amountRaw),
        message: `Fila ${line}: monto inválido «${rawPreview(amountRaw)}». Corrija el valor en la tabla — no se elimina la fila.`,
      });
    }
    const date = parseAtlasDate(dateRaw);
    if (!date) {
      issues.push({
        field: 'date',
        raw: rawPreview(dateRaw),
        message: `Fila ${line}: fecha inválida «${rawPreview(dateRaw)}». Use YYYY-MM-DD o DD/MM/YYYY.`,
      });
    }
    const type = normalizeAtlasTxType(typeRaw);
    if (!type) {
      issues.push({
        field: 'type',
        raw: rawPreview(typeRaw),
        message: `Fila ${line}: tipo inválido «${rawPreview(typeRaw)}». Use INCOME, EXPENSE, TRANSFER_IN o TRANSFER_OUT.`,
      });
    }
    const currencyRaw = mapping.currency !== undefined ? cellStr(row[mapping.currency]).toUpperCase() : 'USD';
    const currency = (ATLAS_TX_CURRENCIES as readonly string[]).includes(currencyRaw) ? currencyRaw : currencyRaw || 'USD';
    const category = mapping.category !== undefined ? cellStr(row[mapping.category]) : '';
    const note = mapping.note !== undefined ? cellStr(row[mapping.note]) : '';
    const statusRaw = mapping.status !== undefined ? row[mapping.status] : '';
    const resolvedType = type ?? 'EXPENSE';
    const resolvedAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
    const title = titleRaw || descRaw || `${resolvedType} ${resolvedAmount || rawPreview(amountRaw)}`;

    for (const issue of issues) warnings.push(issue.message);

    transactions.push({
      title,
      description: descRaw || null,
      type: resolvedType,
      amount: resolvedAmount,
      currency: currency || 'USD',
      category,
      date: date || '',
      note: note || null,
      executionStatus: normalizeAtlasTxStatus(statusRaw),
      sourceRow: line,
      issues,
    });
  }

  if (transactions.length === 0) {
    return {
      ok: false,
      error: 'No se encontraron filas. Complete fecha, tipo y monto (las filas vacías se ignoran).',
      code: 'NO_ROWS',
      missing: [],
    };
  }

  const errorCount = transactions.filter((t) => t.issues.length > 0).length;
  const okCount = transactions.length - errorCount;
  const summary =
    errorCount > 0
      ? `${okCount} listas, ${errorCount} con error — corrija las filas en rojo (no se omiten)`
      : `${transactions.length} transacción(es) del formato ATLAS`;

  return {
    ok: true,
    transactions,
    summary,
    warnings,
    mappedColumns,
  };
}

/** Revalida una fila después de editarla en la vista previa. */
export function atlasImportLiveIssues(t: {
  amount: number;
  date: string;
  type: string;
  sourceRow?: number;
}): AtlasImportIssue[] {
  const line = t.sourceRow ?? '?';
  const issues: AtlasImportIssue[] = [];
  if (!Number.isFinite(t.amount) || t.amount <= 0) {
    issues.push({
      field: 'amount',
      raw: String(t.amount ?? ''),
      message: `Fila ${line}: monto inválido «${t.amount}». Debe ser un número mayor que 0.`,
    });
  }
  if (!t.date || !parseAtlasDate(t.date)) {
    issues.push({
      field: 'date',
      raw: t.date || '(vacío)',
      message: `Fila ${line}: fecha inválida «${t.date || '(vacío)'}». Use YYYY-MM-DD o DD/MM/YYYY.`,
    });
  }
  if (!normalizeAtlasTxType(t.type)) {
    issues.push({
      field: 'type',
      raw: t.type || '(vacío)',
      message: `Fila ${line}: tipo inválido «${t.type || '(vacío)'}». Use INCOME, EXPENSE, TRANSFER_IN o TRANSFER_OUT.`,
    });
  }
  return issues;
}

function instructionLines(locale: 'es' | 'pt' | 'en'): string[][] {
  if (locale === 'pt') {
    return [
      [ATLAS_TX_TEMPLATE_ID, 'Modelo oficial ATLAS — transações'],
      [],
      ['Como usar'],
      ['1. Preencha a folha Transacciones. Não altere os nomes das colunas.'],
      ['2. Uma linha = uma transação. Apague as linhas de exemplo antes de enviar, se quiser.'],
      ['3. Em ATLAS → Finanças → Importar → Formato ATLAS, envie este ficheiro.'],
      ['4. Confirme a pré-visualização e grave. Não usa IA nem créditos.'],
      ['5. Linhas com erro NÃO são apagadas: aparecem em vermelho para corrigir antes de gravar.'],
      [],
      ['Colunas'],
      ['fecha*', 'Data YYYY-MM-DD (também DD/MM/YYYY)'],
      ['tipo*', 'INCOME | EXPENSE | TRANSFER_IN | TRANSFER_OUT (ou Ingreso / Gasto / Receita / Despesa)'],
      ['monto*', 'Número positivo (120.50 ou 120,50)'],
      ['moneda', 'USD, UYU, BRL, EUR, ARS (predefinição USD)'],
      ['titulo', 'Nome curto'],
      ['descripcion', 'Detalhe opcional'],
      ['categoria', 'Ex.: Salarios, Servicios, Venta'],
      ['estado', 'EXECUTED (executado) ou FORECAST (previsto). Predefinição: EXECUTED'],
      ['nota', 'Observação opcional'],
    ];
  }
  if (locale === 'en') {
    return [
      [ATLAS_TX_TEMPLATE_ID, 'Official ATLAS template — transactions'],
      [],
      ['How to use'],
      ['1. Fill the Transacciones sheet. Do not rename the column headers.'],
      ['2. One row = one transaction. Delete the sample rows before upload if you prefer.'],
      ['3. In ATLAS → Finance → Import → ATLAS format, upload this file.'],
      ['4. Confirm the preview and save. No AI / no credits.'],
      ['5. Invalid rows are NOT dropped: they appear in red so you can fix them before saving.'],
      [],
      ['Columns'],
      ['fecha*', 'Date YYYY-MM-DD (also DD/MM/YYYY)'],
      ['tipo*', 'INCOME | EXPENSE | TRANSFER_IN | TRANSFER_OUT (or Ingreso / Gasto)'],
      ['monto*', 'Positive number (120.50 or 120,50)'],
      ['moneda', 'USD, UYU, BRL, EUR, ARS (default USD)'],
      ['titulo', 'Short name'],
      ['descripcion', 'Optional detail'],
      ['categoria', 'e.g. Salarios, Servicios, Venta'],
      ['estado', 'EXECUTED or FORECAST. Default: EXECUTED'],
      ['nota', 'Optional note'],
    ];
  }
  return [
    [ATLAS_TX_TEMPLATE_ID, 'Modelo oficial ATLAS — transacciones'],
    [],
    ['Cómo usar'],
    ['1. Complete la hoja Transacciones. No cambie los nombres de las columnas.'],
    ['2. Una fila = una transacción. Puede borrar las filas de ejemplo antes de subir.'],
    ['3. En ATLAS → Finanzas → Importar → Formato ATLAS, suba este archivo.'],
      ['4. Confirme la vista previa y guarde. No usa IA ni créditos.'],
      ['5. Las filas con error NO se eliminan: aparecen en rojo para corregirlas antes de guardar.'],
    [],
    ['Columnas'],
    ['fecha*', 'Fecha YYYY-MM-DD (también DD/MM/YYYY)'],
    ['tipo*', 'INCOME | EXPENSE | TRANSFER_IN | TRANSFER_OUT (o Ingreso / Gasto / Receita / Despesa)'],
    ['monto*', 'Número positivo (120.50 o 120,50)'],
    ['moneda', 'USD, UYU, BRL, EUR, ARS (por defecto USD)'],
    ['titulo', 'Nombre corto'],
    ['descripcion', 'Detalle opcional'],
    ['categoria', 'Ej.: Salarios, Servicios, Venta'],
    ['estado', 'EXECUTED (ejecutado) o FORECAST (previsto). Por defecto: EXECUTED'],
    ['nota', 'Observación opcional'],
  ];
}

const SAMPLE_ROWS: Array<Array<string | number>> = [
  ['2026-01-15', 'EXPENSE', 120.5, 'USD', 'Google Workspace', 'Suscripción mensual', 'Servicios', 'EXECUTED', ''],
  ['2026-01-20', 'INCOME', 2500, 'USD', 'Venta consultoría', 'Factura 104', 'Venta', 'EXECUTED', ''],
  ['2026-01-22', 'EXPENSE', 890, 'UYU', 'Pago electricidad', '', 'Servicios', 'FORECAST', ''],
];

export function buildAtlasTransactionTemplateAoa(locale: 'es' | 'pt' | 'en' = 'es'): {
  data: Array<Array<string | number>>;
  instructions: string[][];
} {
  return {
    data: [ATLAS_TX_CANONICAL_HEADERS, ...SAMPLE_ROWS],
    instructions: instructionLines(locale),
  };
}

export function buildAtlasTransactionTemplateXlsx(locale: 'es' | 'pt' | 'en' = 'es'): Buffer {
  const { data, instructions } = buildAtlasTransactionTemplateAoa(locale);
  const wb = XLSX.utils.book_new();
  const dataSheet = XLSX.utils.aoa_to_sheet(data);
  dataSheet['!cols'] = [
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 28 },
    { wch: 28 },
    { wch: 14 },
    { wch: 12 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, dataSheet, 'Transacciones');
  const helpSheet = XLSX.utils.aoa_to_sheet(instructions);
  helpSheet['!cols'] = [{ wch: 18 }, { wch: 88 }];
  XLSX.utils.book_append_sheet(wb, helpSheet, 'Instrucciones');
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(out);
}

export function buildAtlasTransactionTemplateCsv(): string {
  const { data } = buildAtlasTransactionTemplateAoa('es');
  return data
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(','),
    )
    .join('\n');
}

export function isSpreadsheetImportFile(fileName: string): boolean {
  return /\.(xlsx?|csv|tsv)$/i.test(fileName);
}
