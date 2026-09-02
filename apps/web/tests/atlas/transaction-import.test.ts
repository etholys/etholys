import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATLAS_TX_CANONICAL_HEADERS,
  ATLAS_TX_TEMPLATE_ID,
  buildAtlasTransactionTemplateCsv,
  buildAtlasTransactionTemplateXlsx,
  excelSerialToIso,
  isAtlasTxTemplate,
  mapAtlasTxHeaders,
  normalizeAtlasTxStatus,
  normalizeAtlasTxType,
  parseAtlasAmount,
  parseAtlasDate,
  parseAtlasTransactionWorkbook,
} from '../../lib/atlas/transaction-import';

test('canonical headers are detected as ATLAS template', () => {
  assert.equal(isAtlasTxTemplate(ATLAS_TX_CANONICAL_HEADERS), true);
  assert.equal(isAtlasTxTemplate(['foo', 'bar']), false);
});

test('maps ES/PT/EN header aliases', () => {
  const mapped = mapAtlasTxHeaders(['Fecha', 'Tipo', 'Valor', 'Título', 'Moeda']);
  assert.equal(mapped.date, 0);
  assert.equal(mapped.type, 1);
  assert.equal(mapped.amount, 2);
  assert.equal(mapped.title, 3);
  assert.equal(mapped.currency, 4);
});

test('normalizes type aliases', () => {
  assert.equal(normalizeAtlasTxType('Ingreso'), 'INCOME');
  assert.equal(normalizeAtlasTxType('gasto'), 'EXPENSE');
  assert.equal(normalizeAtlasTxType('Receita'), 'INCOME');
  assert.equal(normalizeAtlasTxType('TRANSFER_IN'), 'TRANSFER_IN');
  assert.equal(normalizeAtlasTxType('Transferencia salida'), 'TRANSFER_OUT');
  assert.equal(normalizeAtlasTxType('xyz'), null);
  assert.equal(normalizeAtlasTxType('Inflow (Contribution)'), 'TRANSFER_IN');
  assert.equal(normalizeAtlasTxType('Inflow (Adjustment)'), 'INCOME');
  assert.equal(normalizeAtlasTxType('Inflow (Revenue)'), 'INCOME');
  assert.equal(normalizeAtlasTxType('Outflow (Expense)'), 'EXPENSE');
  assert.equal(normalizeAtlasTxType('Outflow (Transfer)'), 'TRANSFER_OUT');
  assert.equal(normalizeAtlasTxType('Inflow (Transfer)'), 'TRANSFER_IN');
});

test('normalizes status with default EXECUTED', () => {
  assert.equal(normalizeAtlasTxStatus('previsto'), 'FORECAST');
  assert.equal(normalizeAtlasTxStatus('Ejecutado'), 'EXECUTED');
  assert.equal(normalizeAtlasTxStatus(''), 'EXECUTED');
});

test('parses amounts with comma or dot', () => {
  assert.equal(parseAtlasAmount('120.50'), 120.5);
  assert.equal(parseAtlasAmount('120,50'), 120.5);
  assert.equal(parseAtlasAmount('1.234,56'), 1234.56);
  assert.equal(parseAtlasAmount(89), 89);
  assert.equal(parseAtlasAmount('-40'), 40);
  assert.equal(parseAtlasAmount('$1,234.56'), 1234.56);
  assert.equal(parseAtlasAmount('(120,50)'), 120.5);
  assert.equal(parseAtlasAmount('1\u00a0234,56'), 1234.56);
  assert.ok(Number.isNaN(parseAtlasAmount('#N/A')));
});

test('parses ISO and DMY dates', () => {
  assert.equal(parseAtlasDate('2026-01-15'), '2026-01-15');
  assert.equal(parseAtlasDate('15/01/2026'), '2026-01-15');
  assert.equal(parseAtlasDate(new Date('2026-03-02T12:00:00Z')), '2026-03-02');
  assert.ok(excelSerialToIso(44927));
});

test('generated xlsx round-trips without AI', () => {
  const buf = buildAtlasTransactionTemplateXlsx('es');
  const parsed = parseAtlasTransactionWorkbook(buf);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.transactions.length, 3);
  assert.equal(parsed.transactions[0]?.type, 'EXPENSE');
  assert.equal(parsed.transactions[0]?.title, 'Google Workspace');
  assert.equal(parsed.transactions[1]?.type, 'INCOME');
  assert.equal(parsed.transactions[2]?.currency, 'UYU');
  assert.equal(parsed.transactions[2]?.executionStatus, 'FORECAST');
  assert.equal(parsed.mappedColumns.date, 'fecha');
});

test('csv template parses and includes template id in xlsx instructions conceptually', () => {
  const csv = buildAtlasTransactionTemplateCsv();
  assert.match(csv, /^fecha,tipo,monto/);
  const parsed = parseAtlasTransactionWorkbook(Buffer.from(csv, 'utf8'));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.ok(parsed.transactions.length >= 2);
});

test('rejects sheets without required columns', () => {
  const csv = 'nombre,valor\nAlquiler,100\n';
  const parsed = parseAtlasTransactionWorkbook(Buffer.from(csv, 'utf8'));
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.equal(parsed.code, 'NOT_ATLAS_TEMPLATE');
  assert.ok(parsed.missing.includes('date'));
  assert.ok(parsed.missing.includes('type'));
});

test('keeps invalid rows with issues instead of omitting them', () => {
  const csv = [
    'fecha,tipo,monto,titulo',
    '2026-02-01,EXPENSE,10,Ok',
    'no-date,EXPENSE,20,Bad date',
    '2026-02-02,EXPENSE,0,Zero',
    '2026-02-03,INCOME,55,Keep',
  ].join('\n');
  const parsed = parseAtlasTransactionWorkbook(Buffer.from(csv, 'utf8'));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.transactions.length, 4);
  assert.equal(parsed.transactions[0]?.issues.length, 0);
  assert.equal(parsed.transactions[0]?.sourceRow, 2);
  assert.ok(parsed.transactions[1]?.issues.some((i) => i.field === 'date'));
  assert.equal(parsed.transactions[1]?.issues[0]?.raw, 'no-date');
  assert.ok(parsed.transactions[2]?.issues.some((i) => i.field === 'amount'));
  assert.equal(parsed.transactions[3]?.title, 'Keep');
  assert.ok(parsed.summary.includes('con error'));
  assert.equal(parsed.warnings.length, 2);
});

test('maps Inflow/Outflow cashflow labels without marking rows as errors', () => {
  const csv = [
    'fecha,tipo,monto,titulo',
    '2026-02-01,Inflow (Contribution),100,Aporte',
    '2026-02-02,Inflow (Adjustment),20,Ajuste',
    '2026-02-03,Inflow (Revenue),55,Venta',
    '2026-02-04,Outflow (Expense),10,Luz',
  ].join('\n');
  const parsed = parseAtlasTransactionWorkbook(Buffer.from(csv, 'utf8'));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.transactions.length, 4);
  assert.equal(parsed.transactions.every((t) => t.issues.length === 0), true);
  assert.equal(parsed.transactions[0]?.type, 'TRANSFER_IN');
  assert.equal(parsed.transactions[0]?.category, 'Contribution');
  assert.equal(parsed.transactions[1]?.type, 'INCOME');
  assert.equal(parsed.transactions[2]?.type, 'INCOME');
  assert.equal(parsed.transactions[2]?.category, 'Revenue');
  assert.equal(parsed.transactions[3]?.type, 'EXPENSE');
  assert.ok(parsed.warnings.some((w) => w.includes('equivalentes')));
});

test('template id is stable', () => {
  assert.equal(ATLAS_TX_TEMPLATE_ID, 'ATLAS_TX_V1');
});
