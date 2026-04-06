export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import * as XLSX from 'xlsx';
import { geminiCompleteJsonText, geminiCompleteVision, imageMimeFromFilename } from '@/lib/gemini-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';

// ============================================================
// GENERIC TAX DATA EXTRACTION
// Mode 1: Excel/CSV with "IRS Category" column → deterministic
// Mode 2: AI extraction for PDFs and uncategorized files
// ============================================================

type ExtractedTransaction = {
  date: string;
  description: string;
  amount: number;
  irsCategory: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
};

type ExtractionResult = {
  transactions: ExtractedTransaction[];
  mode: 'categorized' | 'ai' | 'csv_parsed';
  summary: string;
};

// Standard IRS categories for Form 1120
const IRS_CATEGORIES = [
  'Gross Receipts',
  'Returns & Allowances',
  'Cost of Goods Sold',
  'Dividends',
  'Interest Income',
  'Gross Rents',
  'Gross Royalties',
  'Capital Gains',
  'Other Income',
  'Officer Compensation',
  'Salaries & Wages',
  'Repairs & Maintenance',
  'Bad Debts',
  'Rents',
  'Taxes & Licenses',
  'Interest Expense',
  'Charitable Contributions',
  'Depreciation',
  'Advertising',
  'Pension & Benefits',
  'Employee Benefits',
  'Other Deductions',
  'Owner Contribution',
  'Inter-bank Transfer',
  'Internal Transfer',
  'Contractor Services',
  'Cost of Services',
  'Bank Charges & Fees',
  'Office Expenses',
  'Field Expenses',
  'Software & Subscriptions',
  'Professional Services',
  'Travel & Transportation',
  'Meals & Entertainment',
  'Lodging',
  'Unclassified',
];

// Map IRS categories to Form 1120 lines
const CATEGORY_TO_FORM_LINE: Record<string, { line: string; field: string; type: 'income' | 'deduction' | 'excluded' }> = {
  'gross receipts': { line: '1a', field: 'grossReceipts', type: 'income' },
  'returns & allowances': { line: '1b', field: 'returnsAllowances', type: 'income' },
  'cost of goods sold': { line: '2', field: 'costOfGoodsSold', type: 'deduction' },
  'dividends': { line: '4', field: 'dividends', type: 'income' },
  'interest income': { line: '5', field: 'interestIncome', type: 'income' },
  'gross rents': { line: '6', field: 'grossRents', type: 'income' },
  'gross royalties': { line: '7', field: 'grossRoyalties', type: 'income' },
  'capital gains': { line: '8', field: 'capitalGainNet', type: 'income' },
  'other income': { line: '10', field: 'otherIncome', type: 'income' },
  'officer compensation': { line: '12', field: 'officerCompensation', type: 'deduction' },
  'salaries & wages': { line: '13', field: 'salariesAndWages', type: 'deduction' },
  'repairs & maintenance': { line: '14', field: 'repairsAndMaintenance', type: 'deduction' },
  'bad debts': { line: '15', field: 'badDebts', type: 'deduction' },
  'rents': { line: '16', field: 'rents', type: 'deduction' },
  'taxes & licenses': { line: '17', field: 'taxesAndLicenses', type: 'deduction' },
  'interest expense': { line: '18', field: 'interestExpense', type: 'deduction' },
  'charitable contributions': { line: '19', field: 'charitableContributions', type: 'deduction' },
  'depreciation': { line: '20', field: 'depreciation', type: 'deduction' },
  'advertising': { line: '22', field: 'advertising', type: 'deduction' },
  'pension & benefits': { line: '23', field: 'pensionProfit', type: 'deduction' },
  'employee benefits': { line: '24', field: 'employeeBenefits', type: 'deduction' },
  // These all roll up to "Other Deductions" (line 26)
  'other deductions': { line: '26', field: 'otherDeductions', type: 'deduction' },
  'contractor services': { line: '26', field: 'otherDeductions', type: 'deduction' },
  'cost of services': { line: '26', field: 'otherDeductions', type: 'deduction' },
  'bank charges & fees': { line: '26', field: 'otherDeductions', type: 'deduction' },
  'office expenses': { line: '26', field: 'otherDeductions', type: 'deduction' },
  'field expenses': { line: '26', field: 'otherDeductions', type: 'deduction' },
  'software & subscriptions': { line: '26', field: 'otherDeductions', type: 'deduction' },
  'professional services': { line: '26', field: 'otherDeductions', type: 'deduction' },
  'travel & transportation': { line: '26', field: 'otherDeductions', type: 'deduction' },
  'meals & entertainment': { line: '26', field: 'otherDeductions', type: 'deduction' },
  'lodging': { line: '26', field: 'otherDeductions', type: 'deduction' },
  // Excluded from P&L
  'owner contribution': { line: 'N/A', field: '_ownerContribution', type: 'excluded' },
  'inter-bank transfer': { line: 'N/A', field: '_interBankTransfer', type: 'excluded' },
  'internal transfer': { line: 'N/A', field: '_internalTransfer', type: 'excluded' },
  'unclassified': { line: 'N/A', field: '_unclassified', type: 'excluded' },
};

// ============================================================
// CSV PARSING UTILITIES
// ============================================================

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ============================================================
// MODE 1: CATEGORIZED EXCEL (deterministic)
// Requires "IRS Category" or "Categoria IRS" column
// ============================================================

function isCategorizedFile(csvText: string): boolean {
  const firstLine = csvText.split('\n')[0]?.toLowerCase() || '';
  return firstLine.includes('irs category') || firstLine.includes('categoria irs');
}

function parseCategorizedFile(csvText: string, fileName: string): ExtractionResult {
  const lines = csvText.split('\n');
  const transactions: ExtractedTransaction[] = [];
  if (lines.length < 2) return { transactions, mode: 'categorized', summary: 'Archivo vacío' };

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const irsCatIdx = headers.findIndex(h => h.includes('irs category') || h.includes('categoria irs'));
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('valor') || h.includes('monto'));
  const descIdx = headers.findIndex(h => h.includes('description') || h.includes('descri') || h.includes('concepto'));
  const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('data') || h.includes('fecha'));

  if (irsCatIdx === -1 || amountIdx === -1) {
    return { transactions, mode: 'categorized', summary: 'No se encontró columna de categoría IRS o monto' };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const irsCategory = (values[irsCatIdx] || '').trim();
    const amountStr = (values[amountIdx] || '').replace(/[,$"]/g, '');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount === 0) continue;

    transactions.push({
      date: dateIdx >= 0 ? (values[dateIdx] || '') : '',
      description: descIdx >= 0 ? (values[descIdx] || '') : '',
      amount,
      irsCategory: irsCategory || 'Unclassified',
      source: fileName,
      confidence: 'high',
    });
  }

  return {
    transactions,
    mode: 'categorized',
    summary: `${transactions.length} transacciones con categorías IRS pre-asignadas`,
  };
}

// ============================================================
// MODE 2: GENERIC CSV PARSING (no IRS Category)
// Parses transactions but marks them as needing AI or manual classification
// ============================================================

function parseGenericCSV(csvText: string, fileName: string): ExtractionResult {
  const lines = csvText.split('\n');
  const transactions: ExtractedTransaction[] = [];
  if (lines.length < 2) return { transactions, mode: 'csv_parsed', summary: 'Archivo vacío' };

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  
  // Find common column names
  const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('valor') || h.includes('monto'));
  const descIdx = headers.findIndex(h =>
    h.includes('description') || h.includes('descri') || h.includes('concepto') ||
    h.includes('name') || h.includes('payee') || h.includes('memo')
  );
  const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('data') || h.includes('fecha'));
  const categoryIdx = headers.findIndex(h =>
    h.includes('category') || h.includes('categoria') || h.includes('type') || h.includes('tipo')
  );

  if (amountIdx === -1) {
    return { transactions, mode: 'csv_parsed', summary: 'No se encontró columna de monto' };
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const amountStr = (values[amountIdx] || '').replace(/[,$"]/g, '');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount === 0) continue;

    const desc = descIdx >= 0 ? (values[descIdx] || '') : '';
    const date = dateIdx >= 0 ? (values[dateIdx] || '') : '';
    const existingCategory = categoryIdx >= 0 ? (values[categoryIdx] || '') : '';

    transactions.push({
      date,
      description: desc,
      amount,
      irsCategory: existingCategory ? `Needs Review: ${existingCategory}` : 'Unclassified',
      source: fileName,
      confidence: 'low',
    });
  }

  return {
    transactions,
    mode: 'csv_parsed',
    summary: `${transactions.length} transacciones extraídas — requieren clasificación manual o con IA`,
  };
}

// ============================================================
// MODE 3: AI EXTRACTION (for PDFs and complex files)
// Generic prompt — no company-specific context
// ============================================================

async function extractWithAI(base64Content: string, fileName: string, formType: string): Promise<ExtractionResult> {
  const transactions: ExtractedTransaction[] = [];

  const irsCategoryList = IRS_CATEGORIES.join(', ');

  const prompt = `You are a tax data extraction assistant. Analyze this financial document and extract ALL transactions.

For EACH transaction found, determine:
1. date: the transaction date (YYYY-MM-DD if possible)
2. description: what the transaction is about
3. amount: the amount (positive for credits/inflows, negative for debits/outflows)
4. irsCategory: classify into one of these IRS categories for Form ${formType}:
   ${irsCategoryList}

Classification guidelines:
- Revenue from clients/customers → "Gross Receipts"
- Bank interest, cashback rewards → "Other Income"
- Capital contributions from owners/shareholders → "Owner Contribution"
- Transfers between company's own bank accounts → "Inter-bank Transfer" or "Internal Transfer"
- Payments to contractors/freelancers → "Contractor Services"
- Software subscriptions, SaaS tools → "Software & Subscriptions"
- Bank fees, wire fees, transaction fees → "Bank Charges & Fees"
- Travel expenses → "Travel & Transportation"
- Hotel, accommodation → "Lodging"
- Meals, restaurants → "Meals & Entertainment"
- Office supplies, mail services → "Office Expenses"
- Legal, accounting, consulting → "Professional Services"
- If you're uncertain about a transaction → "Unclassified"

IMPORTANT:
- Be conservative: if unsure, use "Unclassified" — the user will review
- Positive amounts = money coming IN, negative = money going OUT
- Do NOT invent transactions that aren't in the document
- Include ALL transactions, even small fees

Return ONLY valid JSON:
{
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "...", "amount": 0.00, "irsCategory": "..." }
  ],
  "documentType": "bank_statement | invoice | receipt | tax_form | other",
  "period": "start date - end date (if identifiable)",
  "institution": "bank or institution name (if identifiable)"
}`;

  const systemMsg =
    'You are a precise financial document parser. Always respond with valid JSON only. Extract every transaction visible in the document.';

  try {
    const buffer = Buffer.from(base64Content, 'base64');
    const lower = fileName.toLowerCase();
    let text: string;

    if (lower.match(/\.(png|jpg|jpeg|webp|gif|bmp)$/)) {
      try {
        text = await geminiCompleteVision(
          systemMsg,
          prompt,
          buffer.toString('base64'),
          imageMimeFromFilename(fileName),
          { maxOutputTokens: 8192 }
        );
      } catch (e: any) {
        console.error('[Tax Extract AI] Gemini vision:', e);
        return {
          transactions,
          mode: 'ai',
          summary: e?.message || 'Error: IA imagen (Gemini)',
        };
      }
    } else if (lower.endsWith('.pdf')) {
      let docText = '';
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(buffer);
        docText = (data.text || '').trim();
      } catch (e) {
        console.error('[Tax Extract AI] PDF parse:', e);
        return { transactions, mode: 'ai', summary: 'Error: no se pudo leer el PDF' };
      }
      if (!docText) {
        return { transactions, mode: 'ai', summary: 'PDF sin texto extraíble' };
      }
      try {
        text = await geminiCompleteJsonText(
          systemMsg,
          `${prompt}\n\n--- DOCUMENT TEXT ---\n${docText.slice(0, 100000)}`,
          { maxOutputTokens: 8192 }
        );
      } catch (e: any) {
        console.error('[Tax Extract AI] Gemini:', e);
        return { transactions, mode: 'ai', summary: e?.message || 'Error Gemini' };
      }
    } else {
      const docText = buffer.toString('utf-8').slice(0, 100000);
      try {
        text = await geminiCompleteJsonText(systemMsg, `${prompt}\n\n--- DOCUMENT ---\n${docText}`, {
          maxOutputTokens: 8192,
        });
      } catch (e: any) {
        console.error('[Tax Extract AI] Gemini:', e);
        return { transactions, mode: 'ai', summary: e?.message || 'Error Gemini' };
      }
    }
    let parsed: any = {};
    try {
      const raw = extractFirstJsonObject(text) ?? text.trim();
      parsed = JSON.parse(raw);
    } catch {
      console.error('[Tax Extract AI] Failed to parse LLM response');
      return { transactions, mode: 'ai', summary: 'Error: no se pudo interpretar la respuesta de IA' };
    }

    const institution = parsed.institution || 'Desconocido';
    const txns = parsed.transactions || [];

    for (const txn of txns) {
      const amount = parseFloat(txn.amount) || 0;
      if (amount === 0) continue;

      const cat = (txn.irsCategory || 'Unclassified').trim();
      // Validate category exists in our list
      const validCat = IRS_CATEGORIES.find(c => c.toLowerCase() === cat.toLowerCase()) || 'Unclassified';

      transactions.push({
        date: txn.date || '',
        description: txn.description || '',
        amount,
        irsCategory: validCat,
        source: `${institution} (${fileName})`,
        confidence: validCat === 'Unclassified' ? 'low' : 'medium',
      });
    }

    const period = parsed.period || '';
    return {
      transactions,
      mode: 'ai',
      summary: `${transactions.length} transacciones extraídas de ${institution}${period ? ` (${period})` : ''} — clasificación tentativa por IA, revisar antes de usar`,
    };
  } catch (err) {
    console.error('[Tax Extract AI] Error:', err);
    return { transactions, mode: 'ai', summary: 'Error al procesar con IA' };
  }
}

// ============================================================
// SPREADSHEET PARSING (xlsx/xls to CSV)
// ============================================================

function parseSpreadsheetToCSV(base64Content: string): string {
  try {
    const buffer = Buffer.from(base64Content, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) sheets.push(csv);
    }
    return sheets.join('\n');
  } catch (e) {
    console.error('Spreadsheet parse error:', e);
    return '';
  }
}

function isSpreadsheet(fileName: string): boolean {
  const ext = (fileName || '').toLowerCase();
  return ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.csv');
}

// ============================================================
// AGGREGATION: Transactions → Form Fields
// ============================================================

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function aggregateToForm1120(transactions: ExtractedTransaction[]): Record<string, any> {
  // Aggregate by form field
  const fieldTotals: Record<string, number> = {};
  const categoryBreakdown: Record<string, { total: number; count: number }> = {};

  for (const txn of transactions) {
    const catKey = txn.irsCategory.toLowerCase();
    const mapping = CATEGORY_TO_FORM_LINE[catKey];

    if (!mapping || mapping.type === 'excluded') {
      // Track excluded items separately
      const exKey = txn.irsCategory;
      if (!categoryBreakdown[exKey]) categoryBreakdown[exKey] = { total: 0, count: 0 };
      categoryBreakdown[exKey].total += Math.abs(txn.amount);
      categoryBreakdown[exKey].count++;
      continue;
    }

    const absAmount = Math.abs(txn.amount);
    if (!fieldTotals[mapping.field]) fieldTotals[mapping.field] = 0;
    fieldTotals[mapping.field] += absAmount;

    // Track breakdown
    const bKey = txn.irsCategory;
    if (!categoryBreakdown[bKey]) categoryBreakdown[bKey] = { total: 0, count: 0 };
    categoryBreakdown[bKey].total += absAmount;
    categoryBreakdown[bKey].count++;
  }

  // Compute derived fields
  const grossReceipts = fieldTotals['grossReceipts'] || 0;
  const returnsAllowances = fieldTotals['returnsAllowances'] || 0;
  const cogs = fieldTotals['costOfGoodsSold'] || 0;
  const grossProfit = grossReceipts - returnsAllowances - cogs;

  const otherIncome = fieldTotals['otherIncome'] || 0;
  const dividends = fieldTotals['dividends'] || 0;
  const interestIncome = fieldTotals['interestIncome'] || 0;
  const grossRents = fieldTotals['grossRents'] || 0;
  const grossRoyalties = fieldTotals['grossRoyalties'] || 0;
  const capitalGains = fieldTotals['capitalGainNet'] || 0;
  const totalIncome = grossProfit + dividends + interestIncome + grossRents + grossRoyalties + capitalGains + otherIncome;

  // Sum all deductions
  const deductionFields = [
    'officerCompensation', 'salariesAndWages', 'repairsAndMaintenance', 'badDebts',
    'rents', 'taxesAndLicenses', 'interestExpense', 'charitableContributions',
    'depreciation', 'advertising', 'pensionProfit', 'employeeBenefits', 'otherDeductions',
  ];
  let totalDeductions = 0;
  for (const f of deductionFields) {
    totalDeductions += fieldTotals[f] || 0;
  }

  const taxableIncome = totalIncome - totalDeductions;

  const result: Record<string, any> = {
    grossReceipts: round2(grossReceipts),
    returnsAllowances: round2(returnsAllowances),
    costOfGoodsSold: round2(cogs),
    grossProfit: round2(grossProfit),
    dividends: round2(dividends),
    interestIncome: round2(interestIncome),
    grossRents: round2(grossRents),
    grossRoyalties: round2(grossRoyalties),
    capitalGainNet: round2(capitalGains),
    otherIncome: round2(otherIncome),
    totalIncome: round2(totalIncome),
  };

  // Add deduction fields
  for (const f of deductionFields) {
    result[f] = round2(fieldTotals[f] || 0);
  }
  result.totalDeductions = round2(totalDeductions);
  result.taxableIncome = round2(taxableIncome);

  // Internal metadata
  result._categoryBreakdown = categoryBreakdown;

  return result;
}

function aggregateToForm5472(transactions: ExtractedTransaction[]): Record<string, any> {
  // Form 5472 Part IV: transactions between US corp and foreign related party
  // The AI/user categorization determines which are related-party transactions
  let totalReceived = 0;
  let totalPaid = 0;
  const receivedCategories: Record<string, number> = {};
  const paidCategories: Record<string, number> = {};

  for (const txn of transactions) {
    const cat = txn.irsCategory.toLowerCase();
    // Owner contributions = amounts received from foreign related party
    if (cat === 'owner contribution') {
      totalReceived += Math.abs(txn.amount);
      receivedCategories['Capital/Loans'] = (receivedCategories['Capital/Loans'] || 0) + Math.abs(txn.amount);
    }
    // Contractor services to the owner = amounts paid to foreign related party
    // (This is a simplification — user should review)
    if (['contractor services', 'officer compensation'].includes(cat)) {
      totalPaid += Math.abs(txn.amount);
      paidCategories[txn.irsCategory] = (paidCategories[txn.irsCategory] || 0) + Math.abs(txn.amount);
    }
  }

  return {
    loanProceeds: round2(totalReceived),
    totalAmountsReceived: round2(totalReceived),
    compensationPaid: round2(totalPaid),
    totalAmountsPaid: round2(totalPaid),
    _receivedBreakdown: receivedCategories,
    _paidBreakdown: paidCategories,
    _note: 'Clasificación tentativa. El usuario debe revisar qué transacciones corresponden a partes relacionadas.',
  };
}

// ============================================================
// MAIN API HANDLER
// ============================================================

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { files, formType, fileContent, fileName } = body;

    // Support both multi-file and single file
    const fileList: { fileContent: string; fileName: string }[] = files || [];
    if (fileList.length === 0 && fileContent && fileName) {
      fileList.push({ fileContent, fileName });
    }

    if (fileList.length === 0 || !formType) {
      return NextResponse.json({ error: 'Se requieren archivos y tipo de formulario' }, { status: 400 });
    }

    const allTransactions: ExtractedTransaction[] = [];
    const filesSummary: string[] = [];
    let hasHighConfidence = false;
    let hasLowConfidence = false;

    for (const file of fileList) {
      let result: ExtractionResult;

      if (isSpreadsheet(file.fileName)) {
        const csvText = file.fileName.toLowerCase().endsWith('.csv')
          ? Buffer.from(file.fileContent, 'base64').toString('utf-8')
          : parseSpreadsheetToCSV(file.fileContent);

        if (!csvText.trim()) {
          filesSummary.push(`⚠️ ${file.fileName}: No se pudo leer el archivo`);
          continue;
        }

        if (isCategorizedFile(csvText)) {
          result = parseCategorizedFile(csvText, file.fileName);
          hasHighConfidence = true;
          filesSummary.push(`📊 ${file.fileName}: ${result.summary} (determinístico ✅)`);
        } else {
          result = parseGenericCSV(csvText, file.fileName);
          hasLowConfidence = true;
          filesSummary.push(`📄 ${file.fileName}: ${result.summary}`);
        }
      } else {
        // PDF or other → AI extraction
        result = await extractWithAI(file.fileContent, file.fileName, formType);
        hasLowConfidence = true;
        filesSummary.push(`🤖 ${file.fileName}: ${result.summary}`);
      }

      allTransactions.push(...result.transactions);
    }

    // Aggregate transactions into form fields
    const extracted = formType === '1120'
      ? aggregateToForm1120(allTransactions)
      : aggregateToForm5472(allTransactions);

    // Build transaction summary by category
    const categorySummary: Record<string, { total: number; count: number }> = {};
    for (const txn of allTransactions) {
      const key = txn.irsCategory;
      if (!categorySummary[key]) categorySummary[key] = { total: 0, count: 0 };
      categorySummary[key].total += Math.abs(txn.amount);
      categorySummary[key].count++;
    }

    const catLines = Object.entries(categorySummary)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([cat, { total, count }]) => `  ${cat}: $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${count} txns)`);

    const unclassifiedCount = allTransactions.filter(t => t.irsCategory === 'Unclassified' || t.irsCategory.startsWith('Needs Review')).length;
    const lowConfidenceCount = allTransactions.filter(t => t.confidence !== 'high').length;

    const notes: string[] = [
      `Archivos procesados (${fileList.length}):`,
      ...filesSummary,
      '',
      `Total de transacciones: ${allTransactions.length}`,
      '',
      'Clasificación por categoría:',
      ...catLines,
    ];

    if (unclassifiedCount > 0) {
      notes.push('', `⚠️ ${unclassifiedCount} transacciones sin clasificar — requieren revisión manual`);
    }
    if (hasLowConfidence) {
      notes.push('', '💡 Algunas transacciones fueron clasificadas por IA. Se recomienda revisar antes de presentar.');
    }
    if (hasHighConfidence && !hasLowConfidence) {
      notes.push('', '✅ Todas las transacciones tienen categorías IRS pre-asignadas (alta confianza).');
    }

    extracted._extractionNotes = notes.join('\n');

    // Include transaction details for review UI
    extracted._transactions = allTransactions;
    extracted._categorySummary = categorySummary;

    return NextResponse.json({ extracted });
  } catch (error: any) {
    console.error('Tax extract error:', error);
    return NextResponse.json({ error: 'Error en extracción: ' + (error.message || 'Error interno') }, { status: 500 });
  }
}
