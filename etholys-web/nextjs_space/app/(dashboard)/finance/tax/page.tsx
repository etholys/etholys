'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/app/providers';
import type { Locale } from '@/lib/i18n';
import {
  FileText, Plus, Upload, Download, Save, Trash2,
  CheckCircle2, Clock, AlertCircle, Building2, User, DollarSign, ArrowLeft,
  Sparkles, X, Loader2, Eye, Edit3, ChevronDown, ChevronUp
} from 'lucide-react';

type TaxFiling = {
  id: string;
  companyId: string;
  formType: string;
  taxYear: number;
  status: string;
  formData: Record<string, any>;
  autoData: Record<string, any> | null;
  notes: string | null;
  filedDate: string | null;
  createdAt: string;
  company: { id: string; name: string; shortName: string | null; ein: string | null };
  createdBy: { id: string; name: string | null };
};

/* ===== Multilingual helpers ===== */
type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });

type FieldDef = { key: string; labels: ML; type: string; computed?: boolean; options?: string[] };
type SectionDef = { id: string; titles: ML; icon: any; fields: FieldDef[] };

const STATUS_MAP: Record<string, { labels: ML; color: string; bg: string; icon: any }> = {
  draft:       { labels: ml('Draft', 'Borrador', 'Rascunho'), color: 'text-gray-600', bg: 'bg-gray-100', icon: Edit3 },
  in_progress: { labels: ml('In Progress', 'En Progreso', 'Em Progresso'), color: 'text-blue-600', bg: 'bg-blue-100', icon: Clock },
  review:      { labels: ml('In Review', 'En Revisión', 'Em Revisão'), color: 'text-amber-600', bg: 'bg-amber-100', icon: Eye },
  completed:   { labels: ml('Completed', 'Completado', 'Concluído'), color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle2 },
  filed:       { labels: ml('Filed', 'Presentado', 'Protocolado'), color: 'text-purple-600', bg: 'bg-purple-100', icon: FileText },
};

const FORM_TYPES = [
  { value: '1120', label: 'Form 1120 — U.S. Corporation Income Tax Return' },
  { value: '5472', label: 'Form 5472 — Information Return (25% Foreign-Owned U.S. Corp.)' },
];

/* ================================================================
   FORM 1120 – Faithful replica of IRS Form 1120
   ================================================================ */
const FORM_1120_SECTIONS: SectionDef[] = [
  {
    id: 'header',
    titles: ml('General Information', 'Información General', 'Informações Gerais'),
    icon: Building2,
    fields: [
      { key: 'corporationName', labels: ml('Name of corporation', 'Nombre de la corporación', 'Nome da corporação'), type: 'text' },
      { key: 'ein', labels: ml('Employer identification number (EIN)', 'Número de identificación del empleador (EIN)', 'Número de identificação do empregador (EIN)'), type: 'text' },
      { key: 'address', labels: ml('Number, street, and room or suite no.', 'Número, calle y oficina', 'Número, rua e sala'), type: 'text' },
      { key: 'cityStateZip', labels: ml('City or town, state or province, country, and ZIP or foreign postal code', 'Ciudad, estado, país y código postal', 'Cidade, estado, país e código postal'), type: 'text' },
      { key: 'dateIncorporated', labels: ml('Date incorporated', 'Fecha de incorporación', 'Data de incorporação'), type: 'date' },
      { key: 'businessActivityCode', labels: ml('Business activity code number', 'Código de actividad comercial', 'Código de atividade comercial'), type: 'text' },
      { key: 'businessActivity', labels: ml('Business activity', 'Actividad comercial', 'Atividade comercial'), type: 'text' },
      { key: 'productOrService', labels: ml('Product or service', 'Producto o servicio', 'Produto ou serviço'), type: 'text' },
      { key: 'totalAssets', labels: ml('Total assets (see instructions)', 'Total de activos (ver instrucciones)', 'Total de ativos (ver instruções)'), type: 'money' },
    ]
  },
  {
    id: 'income',
    titles: ml('Income', 'Ingresos', 'Receitas'),
    icon: DollarSign,
    fields: [
      { key: 'grossReceipts', labels: ml('Line 1a — Gross receipts or sales', 'Línea 1a — Ingresos brutos o ventas', 'Linha 1a — Receitas brutas ou vendas'), type: 'money' },
      { key: 'returnsAllowances', labels: ml('Line 1b — Returns and allowances', 'Línea 1b — Devoluciones y descuentos', 'Linha 1b — Devoluções e abatimentos'), type: 'money' },
      { key: 'line1c', labels: ml('Line 1c — Balance (subtract 1b from 1a)', 'Línea 1c — Saldo (restar 1b de 1a)', 'Linha 1c — Saldo (subtrair 1b de 1a)'), type: 'money', computed: true },
      { key: 'costOfGoodsSold', labels: ml('Line 2 — Cost of goods sold (attach Form 1125-A)', 'Línea 2 — Costo de mercancías vendidas (adjuntar Form 1125-A)', 'Linha 2 — Custo das mercadorias vendidas (anexar Form 1125-A)'), type: 'money' },
      { key: 'grossProfit', labels: ml('Line 3 — Gross profit (subtract line 2 from line 1c)', 'Línea 3 — Ganancia bruta (restar línea 2 de línea 1c)', 'Linha 3 — Lucro bruto (subtrair linha 2 de linha 1c)'), type: 'money', computed: true },
      { key: 'dividends', labels: ml('Line 4 — Dividends and inclusions (Schedule C, line 23)', 'Línea 4 — Dividendos e inclusiones (Schedule C, línea 23)', 'Linha 4 — Dividendos e inclusões (Schedule C, linha 23)'), type: 'money' },
      { key: 'interestIncome', labels: ml('Line 5 — Interest', 'Línea 5 — Intereses', 'Linha 5 — Juros'), type: 'money' },
      { key: 'grossRents', labels: ml('Line 6 — Gross rents', 'Línea 6 — Alquileres brutos', 'Linha 6 — Aluguéis brutos'), type: 'money' },
      { key: 'grossRoyalties', labels: ml('Line 7 — Gross royalties', 'Línea 7 — Regalías brutas', 'Linha 7 — Royalties brutos'), type: 'money' },
      { key: 'capitalGainNet', labels: ml('Line 8 — Capital gain net income (attach Schedule D)', 'Línea 8 — Ganancia neta de capital (adjuntar Schedule D)', 'Linha 8 — Ganho líquido de capital (anexar Schedule D)'), type: 'money' },
      { key: 'netGainLoss', labels: ml('Line 9 — Net gain or (loss) from Form 4797, Part II, line 17', 'Línea 9 — Ganancia/(pérdida) neta del Form 4797, Parte II, línea 17', 'Linha 9 — Ganho/(perda) líquido do Form 4797, Parte II, linha 17'), type: 'money' },
      { key: 'otherIncome', labels: ml('Line 10 — Other income (see instructions—attach statement)', 'Línea 10 — Otros ingresos (ver instrucciones—adjuntar declaración)', 'Linha 10 — Outras receitas (ver instruções—anexar declaração)'), type: 'money' },
      { key: 'totalIncome', labels: ml('Line 11 — Total income (add lines 3 through 10)', 'Línea 11 — Ingreso total (sumar líneas 3 a 10)', 'Linha 11 — Receita total (somar linhas 3 a 10)'), type: 'money', computed: true },
    ]
  },
  {
    id: 'deductions',
    titles: ml('Deductions', 'Deducciones', 'Deduções'),
    icon: FileText,
    fields: [
      { key: 'officerCompensation', labels: ml('Line 12 — Compensation of officers (attach Form 1125-E)', 'Línea 12 — Compensación a directivos (adjuntar Form 1125-E)', 'Linha 12 — Remuneração de diretores (anexar Form 1125-E)'), type: 'money' },
      { key: 'salariesAndWages', labels: ml('Line 13 — Salaries and wages (less employment credits)', 'Línea 13 — Salarios y jornales (menos créditos de empleo)', 'Linha 13 — Salários (menos créditos de emprego)'), type: 'money' },
      { key: 'repairsAndMaintenance', labels: ml('Line 14 — Repairs and maintenance', 'Línea 14 — Reparaciones y mantenimiento', 'Linha 14 — Reparos e manutenção'), type: 'money' },
      { key: 'badDebts', labels: ml('Line 15 — Bad debts', 'Línea 15 — Deudas incobrables', 'Linha 15 — Dívidas incobráveis'), type: 'money' },
      { key: 'rents', labels: ml('Line 16 — Rents', 'Línea 16 — Alquileres', 'Linha 16 — Aluguéis'), type: 'money' },
      { key: 'taxesAndLicenses', labels: ml('Line 17 — Taxes and licenses', 'Línea 17 — Impuestos y licencias', 'Linha 17 — Impostos e licenças'), type: 'money' },
      { key: 'interestExpense', labels: ml('Line 18 — Interest (see instructions)', 'Línea 18 — Intereses (ver instrucciones)', 'Linha 18 — Juros (ver instruções)'), type: 'money' },
      { key: 'charitableContributions', labels: ml('Line 19 — Charitable contributions', 'Línea 19 — Contribuciones caritativas', 'Linha 19 — Contribuições de caridade'), type: 'money' },
      { key: 'depreciation', labels: ml('Line 20 — Depreciation from Form 4562 not claimed on Form 1125-A or elsewhere', 'Línea 20 — Depreciación del Form 4562 no reclamada en Form 1125-A', 'Linha 20 — Depreciação do Form 4562 não reclamada no Form 1125-A'), type: 'money' },
      { key: 'depletion', labels: ml('Line 21 — Depletion', 'Línea 21 — Agotamiento', 'Linha 21 — Esgotamento'), type: 'money' },
      { key: 'advertising', labels: ml('Line 22 — Advertising', 'Línea 22 — Publicidad', 'Linha 22 — Publicidade'), type: 'money' },
      { key: 'pensionProfit', labels: ml('Line 23 — Pensions, profit-sharing, etc., plans', 'Línea 23 — Planes de pensión, participación en beneficios, etc.', 'Linha 23 — Planos de pensão, participação nos lucros, etc.'), type: 'money' },
      { key: 'employeeBenefits', labels: ml('Line 24 — Employee benefit programs', 'Línea 24 — Programas de beneficios para empleados', 'Linha 24 — Programas de benefícios para funcionários'), type: 'money' },
      { key: 'domesticProdDeduction', labels: ml('Line 25 — Reserved for future use', 'Línea 25 — Reservado para uso futuro', 'Linha 25 — Reservado para uso futuro'), type: 'money' },
      { key: 'otherDeductions', labels: ml('Line 26 — Other deductions (attach statement)', 'Línea 26 — Otras deducciones (adjuntar declaración)', 'Linha 26 — Outras deduções (anexar declaração)'), type: 'money' },
      { key: 'totalDeductions', labels: ml('Line 27 — Total deductions (add lines 12 through 26)', 'Línea 27 — Total de deducciones (sumar líneas 12 a 26)', 'Linha 27 — Total de deduções (somar linhas 12 a 26)'), type: 'money', computed: true },
    ]
  },
  {
    id: 'taxable',
    titles: ml('Tax Computation', 'Cálculo de Impuestos', 'Cálculo de Impostos'),
    icon: DollarSign,
    fields: [
      { key: 'taxableIncome', labels: ml('Line 28 — Taxable income before net operating loss deduction and special deductions (line 11 minus line 27)', 'Línea 28 — Ingreso gravable antes de la deducción por pérdida operativa neta y deducciones especiales (línea 11 menos línea 27)', 'Linha 28 — Renda tributável antes da dedução de prejuízo operacional líquido e deduções especiais (linha 11 menos linha 27)'), type: 'money', computed: true },
      { key: 'nolDeduction', labels: ml('Line 29a — Net operating loss deduction (see instructions)', 'Línea 29a — Deducción por pérdida operativa neta (ver instrucciones)', 'Linha 29a — Dedução de prejuízo operacional líquido (ver instruções)'), type: 'money' },
      { key: 'specialDeductions', labels: ml('Line 29b — Special deductions (Schedule C, line 24)', 'Línea 29b — Deducciones especiales (Schedule C, línea 24)', 'Linha 29b — Deduções especiais (Schedule C, linha 24)'), type: 'money' },
      { key: 'line29cTotal', labels: ml('Line 29c — Add lines 29a and 29b', 'Línea 29c — Sumar líneas 29a y 29b', 'Linha 29c — Somar linhas 29a e 29b'), type: 'money', computed: true },
      { key: 'finalTaxableIncome', labels: ml('Line 30 — Taxable income (subtract line 29c from line 28)', 'Línea 30 — Ingreso gravable (restar línea 29c de línea 28)', 'Linha 30 — Renda tributável (subtrair linha 29c de linha 28)'), type: 'money', computed: true },
      { key: 'totalTax', labels: ml('Line 31 — Total tax (Schedule J, Part I, line 11)', 'Línea 31 — Impuesto total (Schedule J, Parte I, línea 11)', 'Linha 31 — Imposto total (Schedule J, Parte I, linha 11)'), type: 'money' },
      { key: 'totalPayments', labels: ml('Line 33 — Total payments, credits, and section 965 net tax liability', 'Línea 33 — Total de pagos, créditos y obligación fiscal neta sección 965', 'Linha 33 — Total de pagamentos, créditos e passivo fiscal líquido seção 965'), type: 'money' },
      { key: 'estimatedTaxPenalty', labels: ml('Line 34 — Estimated tax penalty (see instructions)', 'Línea 34 — Penalidad de impuesto estimado (ver instrucciones)', 'Linha 34 — Multa de imposto estimado (ver instruções)'), type: 'money' },
      { key: 'amountOwed', labels: ml('Line 35 — Amount owed', 'Línea 35 — Monto adeudado', 'Linha 35 — Valor devido'), type: 'money' },
      { key: 'overpayment', labels: ml('Line 36 — Overpayment', 'Línea 36 — Sobrepago', 'Linha 36 — Pagamento a maior'), type: 'money' },
      { key: 'creditToNextYear', labels: ml('Line 37a — Credited to next year estimated tax', 'Línea 37a — Acreditado al impuesto estimado del próximo año', 'Linha 37a — Creditado ao imposto estimado do próximo ano'), type: 'money' },
      { key: 'refunded', labels: ml('Line 37b — Refunded', 'Línea 37b — Reembolsado', 'Linha 37b — Reembolsado'), type: 'money' },
    ]
  },
  {
    id: 'scheduleC',
    titles: ml('Schedule C — Dividends, Inclusions, and Special Deductions', 'Schedule C — Dividendos, Inclusiones y Deducciones Especiales', 'Schedule C — Dividendos, Inclusões e Deduções Especiais'),
    icon: FileText,
    fields: [
      { key: 'schedC_1', labels: ml('1. Dividends from less-than-20%-owned domestic corporations (other than debt-financed stock)', '1. Dividendos de corporaciones domésticas con menos del 20% de propiedad', '1. Dividendos de corporações domésticas com menos de 20% de participação'), type: 'money' },
      { key: 'schedC_2', labels: ml('2. Dividends from 20%-or-more-owned domestic corporations (other than debt-financed stock)', '2. Dividendos de corporaciones domésticas con 20% o más de propiedad', '2. Dividendos de corporações domésticas com 20% ou mais de participação'), type: 'money' },
      { key: 'schedC_3', labels: ml('3. Dividends on certain debt-financed stock of domestic and foreign corporations', '3. Dividendos sobre acciones financiadas con deuda', '3. Dividendos sobre ações financiadas com dívida'), type: 'money' },
      { key: 'schedC_4', labels: ml('4. Dividends on certain preferred stock of less-than-20%-owned public utilities', '4. Dividendos sobre acciones preferentes de servicios públicos (menos del 20%)', '4. Dividendos sobre ações preferenciais de serviços públicos (menos de 20%)'), type: 'money' },
      { key: 'schedC_5', labels: ml('5. Dividends on certain preferred stock of 20%-or-more-owned public utilities', '5. Dividendos sobre acciones preferentes de servicios públicos (20% o más)', '5. Dividendos sobre ações preferenciais de serviços públicos (20% ou mais)'), type: 'money' },
      { key: 'schedC_6', labels: ml('6. Dividends from less-than-20%-owned foreign corporations and certain FSCs', '6. Dividendos de corporaciones extranjeras (menos del 20%) y ciertos FSCs', '6. Dividendos de corporações estrangeiras (menos de 20%) e certos FSCs'), type: 'money' },
      { key: 'schedC_7', labels: ml('7. Dividends from 20%-or-more-owned foreign corporations and certain FSCs', '7. Dividendos de corporaciones extranjeras (20% o más) y ciertos FSCs', '7. Dividendos de corporações estrangeiras (20% ou mais) e certos FSCs'), type: 'money' },
      { key: 'schedC_8', labels: ml('8. Dividends from wholly owned foreign subsidiaries', '8. Dividendos de subsidiarias extranjeras de propiedad total', '8. Dividendos de subsidiárias estrangeiras de propriedade integral'), type: 'money' },
      { key: 'schedC_9', labels: ml('9. Subtotal. Add lines 1 through 8. See instructions for limitations', '9. Subtotal. Sumar líneas 1 a 8', '9. Subtotal. Somar linhas 1 a 8'), type: 'money', computed: true },
      { key: 'schedC_10', labels: ml('10. Dividends from domestic corporations received by a small business investment company operating under the Small Business Investment Act of 1958', '10. Dividendos recibidos por compañía de inversión para pequeñas empresas', '10. Dividendos recebidos por empresa de investimento para pequenas empresas'), type: 'money' },
      { key: 'schedC_11', labels: ml('11. Dividends from affiliated group members', '11. Dividendos de miembros del grupo afiliado', '11. Dividendos de membros do grupo afiliado'), type: 'money' },
      { key: 'schedC_12', labels: ml('12. Dividends from certain FSCs', '12. Dividendos de ciertos FSCs', '12. Dividendos de certos FSCs'), type: 'money' },
      { key: 'schedC_13', labels: ml('13. Foreign-source portion of dividends received from a specified 10%-owned foreign corporation (excluding hybrid dividends) (see instructions)', '13. Porción de fuente extranjera de dividendos de corporación extranjera (10%)', '13. Porção de fonte estrangeira de dividendos de corporação estrangeira (10%)'), type: 'money' },
      { key: 'schedC_14', labels: ml('14. Dividends from foreign corporations not included on line 3, 6, 7, 8, 11, 12, or 13 (including any hybrid dividends)', '14. Dividendos de corporaciones extranjeras no incluidos en líneas 3,6,7,8,11,12,13', '14. Dividendos de corporações estrangeiras não incluídos nas linhas 3,6,7,8,11,12,13'), type: 'money' },
      { key: 'schedC_15', labels: ml('15. Reserved for future use', '15. Reservado para uso futuro', '15. Reservado para uso futuro'), type: 'money' },
      { key: 'schedC_16a', labels: ml('16a. Subpart F inclusions derived from the sale by a controlled foreign corporation (CFC) of the stock of a lower-tier foreign corporation treated as a dividend (attach Forms 5471)', '16a. Inclusiones Subpart F derivadas de ventas de CFC', '16a. Inclusões Subpart F derivadas de vendas de CFC'), type: 'money' },
      { key: 'schedC_16b', labels: ml('16b. Subpart F inclusions derived from hybrid dividends of tiered corporations (attach Forms 5471)', '16b. Inclusiones Subpart F derivadas de dividendos híbridos', '16b. Inclusões Subpart F derivadas de dividendos híbridos'), type: 'money' },
      { key: 'schedC_16c', labels: ml('16c. Other inclusions from CFCs under subpart F not included on line 15a, 15b, or 17 (attach Form(s) 5471)', '16c. Otras inclusiones de CFCs bajo subparte F', '16c. Outras inclusões de CFCs sob subparte F'), type: 'money' },
      { key: 'schedC_17', labels: ml('17. Global Intangible Low-Taxed Income (GILTI) (attach Form(s) 5471 and Form 8992)', '17. GILTI (adjuntar Form(s) 5471 y Form 8992)', '17. GILTI (anexar Form(s) 5471 e Form 8992)'), type: 'money' },
      { key: 'schedC_18', labels: ml('18. Gross-up for foreign taxes deemed paid', '18. Incremento bruto por impuestos extranjeros considerados pagados', '18. Acréscimo bruto por impostos estrangeiros considerados pagos'), type: 'money' },
      { key: 'schedC_19', labels: ml('19. IC-DISC and former DISC dividends not included on line 1, 2, or 3', '19. Dividendos IC-DISC y antiguos DISC', '19. Dividendos IC-DISC e antigos DISC'), type: 'money' },
      { key: 'schedC_20', labels: ml('20. Other dividends', '20. Otros dividendos', '20. Outros dividendos'), type: 'money' },
      { key: 'schedC_21', labels: ml('21. Deduction for dividends paid on certain preferred stock of public utilities', '21. Deducción por dividendos pagados sobre acciones preferentes', '21. Dedução por dividendos pagos sobre ações preferenciais'), type: 'money' },
      { key: 'schedC_22', labels: ml('22. Section 250 deduction (attach Form 8993) (see instructions for limitations)', '22. Deducción sección 250 (adjuntar Form 8993)', '22. Dedução seção 250 (anexar Form 8993)'), type: 'money' },
      { key: 'schedC_23', labels: ml('23. Total dividends and inclusions. Add column (a), lines 9 through 20. Enter here and on page 1, line 4', '23. Total dividendos e inclusiones. Ingresar aquí y en página 1, línea 4', '23. Total dividendos e inclusões. Inserir aqui e na página 1, linha 4'), type: 'money', computed: true },
      { key: 'schedC_24', labels: ml('24. Total special deductions. Add column (c), lines 9 through 22. Enter here and on page 1, line 29b', '24. Total deducciones especiales. Ingresar aquí y en página 1, línea 29b', '24. Total deduções especiais. Inserir aqui e na página 1, linha 29b'), type: 'money' },
    ]
  },
  {
    id: 'scheduleJ',
    titles: ml('Schedule J — Tax Computation and Payment', 'Schedule J — Cálculo de Impuestos y Pago', 'Schedule J — Cálculo de Impostos e Pagamento'),
    icon: DollarSign,
    fields: [
      /* Part I — Tax Computation */
      { key: 'schedJ_1a', labels: ml('1a. Income tax (see instructions)', '1a. Impuesto sobre la renta (ver instrucciones)', '1a. Imposto de renda (ver instruções)'), type: 'money' },
      { key: 'schedJ_1b', labels: ml('1b. Tax from Form 1100-S (see instructions)', '1b. Impuesto del Form 1100-S', '1b. Imposto do Form 1100-S'), type: 'money' },
      { key: 'schedJ_2', labels: ml('2. Section 1291 tax (from Form 8621)', '2. Impuesto sección 1291 (del Form 8621)', '2. Imposto seção 1291 (do Form 8621)'), type: 'money' },
      { key: 'schedJ_3', labels: ml('3. Tax adjustment from Form 8621', '3. Ajuste de impuesto del Form 8621', '3. Ajuste de imposto do Form 8621'), type: 'money' },
      { key: 'schedJ_4', labels: ml('4. Additional tax under section 1813', '4. Impuesto adicional bajo sección 1813', '4. Imposto adicional sob seção 1813'), type: 'money' },
      { key: 'schedJ_5a', labels: ml('5a. Base erosion minimum tax amount from Form 8991', '5a. Impuesto mínimo por erosión de base del Form 8991', '5a. Imposto mínimo por erosão de base do Form 8991'), type: 'money' },
      { key: 'schedJ_5b', labels: ml('5b. Amount from Form 4626, Part II, line 8 (Alternative min. tax)', '5b. Monto del Form 4626 (impuesto mínimo alternativo)', '5b. Valor do Form 4626 (imposto mínimo alternativo)'), type: 'money' },
      { key: 'schedJ_5c', labels: ml('5c. Other chapter 1 tax', '5c. Otro impuesto del capítulo 1', '5c. Outro imposto do capítulo 1'), type: 'money' },
      { key: 'schedJ_6', labels: ml('6. Total income tax. Add lines 1a through 5c', '6. Total de impuesto sobre la renta. Sumar líneas 1a a 5c', '6. Total do imposto de renda. Somar linhas 1a a 5c'), type: 'money', computed: true },
      { key: 'schedJ_7a', labels: ml('7a. Corporate alternative minimum tax from Form 4626, Part II, line 13 (attach Form 4626)', '7a. Impuesto mínimo alternativo corporativo del Form 4626', '7a. Imposto mínimo alternativo corporativo do Form 4626'), type: 'money' },
      { key: 'schedJ_7b', labels: ml('7b. Credit from Form 4466 (see instructions)', '7b. Crédito del Form 4466', '7b. Crédito do Form 4466'), type: 'money' },
      { key: 'schedJ_8', labels: ml('8. Credit for prior year minimum tax (attach Form 8827)', '8. Crédito por impuesto mínimo del año anterior (adjuntar Form 8827)', '8. Crédito por imposto mínimo do ano anterior (anexar Form 8827)'), type: 'money' },
      { key: 'schedJ_9', labels: ml('9. Bond credits from Form 8912', '9. Créditos de bonos del Form 8912', '9. Créditos de títulos do Form 8912'), type: 'money' },
      { key: 'schedJ_10', labels: ml('10. Adjustment from Form 8576', '10. Ajuste del Form 8576', '10. Ajuste do Form 8576'), type: 'money' },
      { key: 'schedJ_11', labels: ml('11. Total credits. Add lines 7a through 10', '11. Total créditos. Sumar líneas 7a a 10', '11. Total créditos. Somar linhas 7a a 10'), type: 'money', computed: true },
      { key: 'schedJ_12', labels: ml('12. Subtract line 11 from line 6', '12. Restar línea 11 de línea 6', '12. Subtrair linha 11 de linha 6'), type: 'money', computed: true },
      { key: 'schedJ_13', labels: ml('13. Recapture of investment credit (attach Form 4255)', '13. Recaptura de crédito de inversión (adjuntar Form 4255)', '13. Recaptura de crédito de investimento (anexar Form 4255)'), type: 'money' },
      { key: 'schedJ_14', labels: ml('14. Recapture of low-income housing credit (attach Form 8611)', '14. Recaptura de crédito de vivienda de bajos ingresos', '14. Recaptura de crédito de habitação de baixa renda'), type: 'money' },
      { key: 'schedJ_15', labels: ml('15. Interest due under the look-back method—income forecast method (attach Form 8866)', '15. Intereses bajo método retrospectivo (adjuntar Form 8866)', '15. Juros sob método retrospectivo (anexar Form 8866)'), type: 'money' },
      { key: 'schedJ_16', labels: ml('16. Interest due under section 453A(c) and/or section 453(l)', '16. Intereses bajo sección 453A(c) y/o sección 453(l)', '16. Juros sob seção 453A(c) e/ou seção 453(l)'), type: 'money' },
      { key: 'schedJ_17', labels: ml('17. Interest due under section 453(l)(3)', '17. Intereses bajo sección 453(l)(3)', '17. Juros sob seção 453(l)(3)'), type: 'money' },
      { key: 'schedJ_18', labels: ml('18. Other (see instructions—attach statement)', '18. Otros (ver instrucciones)', '18. Outros (ver instruções)'), type: 'money' },
      { key: 'schedJ_19a', labels: ml('19a. Total tax before deferred taxes. Add lines 5, 6, 9, and 10', '19a. Total impuestos antes de impuestos diferidos', '19a. Total impostos antes de impostos diferidos'), type: 'money', computed: true },
      { key: 'schedJ_19b', labels: ml('19b. Deferred tax on the corporation\'s share of undistributed earnings of a qualified electing fund', '19b. Impuesto diferido sobre ganancias no distribuidas', '19b. Imposto diferido sobre lucros não distribuídos'), type: 'money' },
      { key: 'schedJ_19c', labels: ml('19c. Deferred LIFO recapture tax (section 1363(d))', '19c. Impuesto diferido por recaptura LIFO', '19c. Imposto diferido por recaptura LIFO'), type: 'money' },
      /* Part II — Payments and Refundable Credits */
      { key: 'schedJ_20a', labels: ml('20a. 2024 overpayment credited to 2025', '20a. Sobrepago de 2024 acreditado a 2025', '20a. Pagamento a maior de 2024 creditado para 2025'), type: 'money' },
      { key: 'schedJ_20b', labels: ml('20b. Prior year(s) overpayment credited to the current year', '20b. Sobrepago de año(s) anterior(es) acreditado al año actual', '20b. Pagamento a maior de ano(s) anterior(es) creditado para o ano atual'), type: 'money' },
      { key: 'schedJ_21', labels: ml('21. Current year\'s estimated tax payments', '21. Pagos de impuestos estimados del año actual', '21. Pagamentos de impostos estimados do ano atual'), type: 'money' },
      { key: 'schedJ_22', labels: ml('22. Current year\'s refund applied for on Form 4466', '22. Reembolso del año actual solicitado en Form 4466', '22. Reembolso do ano atual solicitado no Form 4466'), type: 'money' },
      { key: 'schedJ_23', labels: ml('23. Reserved for future use', '23. Reservado para uso futuro', '23. Reservado para uso futuro'), type: 'money' },
      { key: 'schedJ_24', labels: ml('24. Tax deposited with Form 7004', '24. Impuesto depositado con Form 7004', '24. Imposto depositado com Form 7004'), type: 'money' },
      { key: 'schedJ_25', labels: ml('25. Withholding (see instructions)', '25. Retenciones (ver instrucciones)', '25. Retenções (ver instruções)'), type: 'money' },
      { key: 'schedJ_26', labels: ml('26. Total payments. Combine lines 20a through 25', '26. Total pagos. Combinar líneas 20a a 25', '26. Total pagamentos. Combinar linhas 20a a 25'), type: 'money', computed: true },
      { key: 'schedJ_27', labels: ml('27. Refundable credits from: Form 2439, Form 4136, Other', '27. Créditos reembolsables', '27. Créditos reembolsáveis'), type: 'money' },
      { key: 'schedJ_28', labels: ml('28. Total credits. Add lines 26a through 29a', '28. Total créditos', '28. Total créditos'), type: 'money', computed: true },
      { key: 'schedJ_29', labels: ml('29. Elective payment election amount (from Form 3800)', '29. Monto de elección de pago electivo (del Form 3800)', '29. Valor de eleição de pagamento eletivo (do Form 3800)'), type: 'money' },
      { key: 'schedJ_30', labels: ml('30. Section 1082 applicable not tax liability. Enter amount from Form 1082, line 14', '30. Pasivo fiscal aplicable sección 1082', '30. Passivo fiscal aplicável seção 1082'), type: 'money' },
      { key: 'schedJ_31', labels: ml('31. Total payments, credits, and section 1082 net tax liability. Add lines 19, 21, 22a, and 22b. Enter here and on page 1, line 33', '31. Total pagos, créditos y pasivo fiscal neto', '31. Total pagamentos, créditos e passivo fiscal líquido'), type: 'money', computed: true },
    ]
  },
  {
    id: 'scheduleK',
    titles: ml('Schedule K — Other Information', 'Schedule K — Otra Información', 'Schedule K — Outras Informações'),
    icon: FileText,
    fields: [
      /* === Page 4: Questions 1–12 === */
      { key: 'accountingMethod', labels: ml('1. Check accounting method: a Cash, b Accrual, c Other (specify)', '1. Método contable: a Efectivo, b Devengo, c Otro (especifique)', '1. Método contábil: a Caixa, b Competência, c Outro (especifique)'), type: 'select', options: ['Cash', 'Accrual', 'Other'] },
      { key: 'schedK_q1_other', labels: ml('1c. (If "Other," specify)', '1c. (Si "Otro", especifique)', '1c. (Se "Outro", especifique)'), type: 'text' },
      { key: 'schedK_q2_code', labels: ml('2a. Business activity code no.', '2a. Código de actividad comercial', '2a. Código de atividade comercial'), type: 'text' },
      { key: 'schedK_q2_activity', labels: ml('2b. Business activity', '2b. Actividad comercial', '2b. Atividade comercial'), type: 'text' },
      { key: 'schedK_q2_product', labels: ml('2c. Product or service', '2c. Producto o servicio', '2c. Produto ou serviço'), type: 'text' },
      { key: 'schedK_q3', labels: ml('3. Is the corporation a subsidiary in an affiliated group or a parent-subsidiary controlled group?', '3. ¿Es la corporación una subsidiaria de un grupo afiliado o controlado?', '3. A corporação é subsidiária de um grupo afiliado ou controlado?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q3_name', labels: ml('3. If "Yes," enter name and EIN of the parent corporation ▶', '3. Si "Sí", ingrese nombre y EIN de la corporación matriz ▶', '3. Se "Sim", insira nome e EIN da corporação controladora ▶'), type: 'text' },
      { key: 'foreignOwnership', labels: ml('4a. At the end of the tax year, did any foreign or domestic corporation, partnership, trust, or tax-exempt organization own directly 20% or more, or own, directly or indirectly, 50% or more of the total voting power? If "Yes," complete Part I of Schedule G (Form 1120).', '4a. ¿Alguna entidad poseía ≥20% directo o ≥50% del poder de voto? Si "Sí", complete Parte I del Schedule G (Form 1120).', '4a. Alguma entidade possuía ≥20% direto ou ≥50% do poder de voto? Se "Sim", complete Parte I do Schedule G (Form 1120).'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q4b', labels: ml('4b. Did any individual or estate own directly 20% or more, or own, directly or indirectly, 50% or more of the total voting power? If "Yes," complete Part II of Schedule G (Form 1120).', '4b. ¿Algún individuo o patrimonio poseía ≥20% directo o ≥50% del poder de voto? Si "Sí", complete Parte II del Schedule G.', '4b. Algum indivíduo ou espólio possuía ≥20% direto ou ≥50% do poder de voto? Se "Sim", complete Parte II do Schedule G.'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q5', labels: ml('5a. At the end of the tax year, did the corporation own directly 20% or more, or own, directly or indirectly, 50% or more of the total voting power of any foreign or domestic corporation not included on Form 851? If "Yes," complete (i) through (iv) below.', '5a. ¿Poseía ≥20% o ≥50% del poder de voto de otra corporación no incluida en Form 851? Si "Sí", complete (i)-(iv).', '5a. Possuía ≥20% ou ≥50% do poder de voto de outra corporação não incluída no Form 851? Se "Sim", complete (i)-(iv).'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q5a_details', labels: ml('5a. If "Yes," enter: (i) Name of Corporation; (ii) EIN; (iii) Country of Incorporation; (iv) % Voting Stock — one per line', '5a. Si "Sí": (i) Nombre; (ii) EIN; (iii) País; (iv) % Voto — uno por línea', '5a. Se "Sim": (i) Nome; (ii) EIN; (iii) País; (iv) % Voto — um por linha'), type: 'text' },
      { key: 'schedK_q6', labels: ml('5b. Own directly an interest of 20% or more, or own, directly or indirectly, an interest of 50% or more in any foreign or domestic partnership or in the beneficial interest of a trust? If "Yes," complete (i) through (iv) below.', '5b. ¿Poseía ≥20% o ≥50% de interés en alguna sociedad o fideicomiso? Si "Sí", complete (i)-(iv).', '5b. Possuía ≥20% ou ≥50% de participação em alguma sociedade ou trust? Se "Sim", complete (i)-(iv).'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q5b_details', labels: ml('5b. If "Yes," enter: (i) Name of Entity; (ii) EIN; (iii) Country of Organization; (iv) Max % Profit/Loss/Capital — one per line', '5b. Si "Sí": (i) Nombre; (ii) EIN; (iii) País; (iv) Máx % Ganancia/Pérdida/Capital — uno por línea', '5b. Se "Sim": (i) Nome; (ii) EIN; (iii) País; (iv) Máx % Lucro/Perda/Capital — um por linha'), type: 'text' },
      { key: 'schedK_q7', labels: ml('6. During this tax year, did the corporation pay dividends (other than stock dividends and distributions in exchange for stock) in excess of the corporation\'s current and accumulated earnings and profits? See sections 301 and 316.', '6. ¿Pagó dividendos en exceso de las ganancias corrientes y acumuladas? Ver secciones 301 y 316.', '6. Pagou dividendos em excesso dos lucros correntes e acumulados? Ver seções 301 e 316.'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q8', labels: ml('7. At any time during this tax year, did one foreign person own, directly or indirectly, at least 25% of the total voting power of all classes of the corporation\'s stock entitled to vote or at least 25% of the total value of all classes of the corporation\'s stock?', '7. ¿Alguna persona extranjera poseía ≥25% del poder de voto o ≥25% del valor total de acciones?', '7. Alguma pessoa estrangeira possuía ≥25% do poder de voto ou ≥25% do valor total das ações?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q8a', labels: ml('7(a). Percentage owned ▶', '7(a). Porcentaje de propiedad ▶', '7(a). Percentual de propriedade ▶'), type: 'text' },
      { key: 'schedK_q8b', labels: ml('7(b). Owner\'s country ▶', '7(b). País del propietario ▶', '7(b). País do proprietário ▶'), type: 'text' },
      { key: 'schedK_q8c', labels: ml('7(c). The corporation may have to file Form 5472. Enter number of Forms 5472 attached ▶', '7(c). Puede requerir Form 5472. Ingrese cantidad adjuntos ▶', '7(c). Pode requerer Form 5472. Insira quantidade anexos ▶'), type: 'text' },
      { key: 'schedK_q10', labels: ml('8. Check this box if the corporation issued publicly offered debt instruments with original issue discount ▶', '8. Marque si emitió instrumentos de deuda con descuento de emisión original ▶', '8. Marque se emitiu instrumentos de dívida com desconto de emissão original ▶'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q11a', labels: ml('9. Enter the amount of tax-exempt interest received or accrued during this tax year ▶ $', '9. Monto de intereses exentos de impuestos recibidos o devengados ▶ $', '9. Valor de juros isentos de impostos recebidos ou acumulados ▶ $'), type: 'money' },
      { key: 'schedK_q11b', labels: ml('10. Enter the number of shareholders at the end of the tax year (if 100 or fewer) ▶', '10. Número de accionistas al final del año fiscal (si 100 o menos) ▶', '10. Número de acionistas no final do exercício (se 100 ou menos) ▶'), type: 'text' },
      { key: 'schedK_q12', labels: ml('11. If the corporation has an NOL for the tax year and is electing to forego the carryback period, check here (see instructions) ▶', '11. Si tiene NOL y elige renunciar al período de retroactividad, marque aquí ▶', '11. Se tem NOL e opta por renunciar ao período de retroatividade, marque aqui ▶'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q15', labels: ml('12. Enter the available NOL carryover from prior tax years (do not reduce it by any deduction reported on page 1, line 29a) ▶ $', '12. Arrastre de NOL disponible de años anteriores (no reducir por línea 29a, pág. 1) ▶ $', '12. Saldo de NOL disponível de anos anteriores (não reduzir pela linha 29a, pág. 1) ▶ $'), type: 'money' },
      /* === Page 5: Questions 13–32 === */
      { key: 'schedK_q13', labels: ml('13. Are the corporation\'s total receipts (page 1, line 1a, plus lines 4 through 10) for the tax year AND its total assets at the end of the tax year less than $250,000? If "Yes," the corporation is not required to complete Schedules L, M-1, and M-2.', '13. ¿Los ingresos totales Y activos totales son menores a $250,000? Si "Sí", no se requiere completar Schedules L, M-1 y M-2.', '13. As receitas totais E ativos totais são inferiores a $250.000? Se "Sim", não é necessário completar Schedules L, M-1 e M-2.'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q14', labels: ml('14. Is the corporation required to file Schedule UTP (Form 1120), Uncertain Tax Position Statement? See instructions. If "Yes," complete and attach Schedule UTP.', '14. ¿Se requiere presentar Schedule UTP (Form 1120)? Si "Sí", complete y adjunte Schedule UTP.', '14. É necessário apresentar Schedule UTP (Form 1120)? Se "Sim", complete e anexe Schedule UTP.'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q20', labels: ml('15a. Did the corporation make any payments in the calendar year that would require it to file Form(s) 1099?', '15a. ¿Realizó pagos que requieran presentar Form(s) 1099?', '15a. Fez pagamentos que exijam apresentar Form(s) 1099?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q20b', labels: ml('15b. If "Yes," did or will the corporation file required Form(s) 1099?', '15b. Si "Sí", ¿presentó o presentará los Form(s) 1099 requeridos?', '15b. Se "Sim", apresentou ou apresentará os Form(s) 1099 exigidos?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q17', labels: ml('16. During this tax year, did the corporation have an 80% or more change in ownership, including a change due to redemption of its own stock?', '16. ¿Hubo cambio de ≥80% en la propiedad, incluyendo por redención de acciones?', '16. Houve mudança de ≥80% na propriedade, incluindo por resgate de ações?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q18', labels: ml('17. During or subsequent to this tax year, but before the filing of this return, did the corporation dispose of more than 65% (by value) of its assets in a taxable, non-taxable, or tax-deferred transaction?', '17. ¿Dispuso de más del 65% de sus activos antes de presentar esta declaración?', '17. Alienou mais de 65% dos seus ativos antes de apresentar esta declaração?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q19', labels: ml('18. Did the corporation receive assets in a section 351 transfer in which any of the transferred assets had a built-in loss of more than $250,000?', '18. ¿Recibió activos en transferencia sección 351 con pérdida incorporada >$250,000?', '18. Recebeu ativos em transferência seção 351 com perda embutida >$250.000?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q21', labels: ml('19. During this tax year, did the corporation pay or accrue any interest or royalty for which the deduction is not allowed under section 267A? See instructions.', '19. ¿Pagó o devengó intereses o regalías no deducibles bajo sección 267A?', '19. Pagou ou acumulou juros ou royalties não dedutíveis sob seção 267A?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q21_amt', labels: ml('19. If "Yes," enter the total amount of the disallowed deductions ▶ $', '19. Si "Sí", monto total de deducciones no permitidas ▶ $', '19. Se "Sim", valor total das deduções não permitidas ▶ $'), type: 'money' },
      { key: 'schedK_q22', labels: ml('20. Does the corporation have gross receipts of at least $500 million in any of the 3 preceding tax years? (See sections 59A(e) and (f).)', '20. ¿Tiene ingresos brutos ≥$500M en alguno de los 3 años anteriores? (Ver secciones 59A(e) y (f).)', '20. Tem receitas brutas ≥$500M em algum dos 3 anos anteriores? (Ver seções 59A(e) e (f).)'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q23', labels: ml('21. Did the reporting corporation have an election under section 163(j) for any real property trade or business or any farming business in effect during this tax year? See instructions.', '21. ¿Tuvo elección bajo sección 163(j) para negocio inmobiliario o agrícola vigente?', '21. Teve eleição sob seção 163(j) para negócio imobiliário ou agrícola vigente?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q24', labels: ml('22. Does the corporation satisfy one or more of the following? See instructions. (a) The corporation owns a pass-through entity with current or prior year carryover excess business interest expense. (b) The corporation\'s aggregate average annual gross receipts for the 3 preceding tax years exceed $31 million and it has business interest expense. (c) The corporation is a tax shelter with business interest expense.', '22. ¿Cumple con alguna condición de sección 163(j)? (a) Exceso de interés comercial. (b) Ingresos brutos >$31M. (c) Es refugio fiscal con interés comercial.', '22. Cumpre com alguma condição da seção 163(j)? (a) Excesso de juros comerciais. (b) Receitas brutas >$31M. (c) É abrigo fiscal com juros comerciais.'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q25', labels: ml('23. Does the corporation itself, or together with any related party, have any specified foreign financial assets with an aggregate value over $50,000? (See section 6038D.)', '23. ¿Tiene activos financieros extranjeros especificados con valor agregado >$50,000? (Ver sección 6038D.)', '23. Tem ativos financeiros estrangeiros especificados com valor agregado >$50.000? (Ver seção 6038D.)'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q26', labels: ml('24. Since December 22, 2017, did a foreign corporation directly or indirectly acquire substantially all of the properties held by the corporation, and was the ownership percentage for purposes of section 7874 greater than 50%?', '24. ¿Una corporación extranjera adquirió sustancialmente todos los activos con >50% de propiedad (sección 7874)?', '24. Uma corporação estrangeira adquiriu substancialmente todos os ativos com >50% de propriedade (seção 7874)?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q27', labels: ml('25. At any time during this tax year, did the corporation (a) receive a digital asset (as a reward, award, or payment for property or services), or (b) sell, exchange, or otherwise dispose of a digital asset (or a financial interest in a digital asset)? See instructions.', '25. ¿Recibió, vendió, intercambió o dispuso de un activo digital?', '25. Recebeu, vendeu, trocou ou alienou um ativo digital?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q28', labels: ml('26. Was the corporation an applicable corporation under section 59(k) in any prior tax year?', '26. ¿Fue corporación aplicable bajo sección 59(k) en algún año anterior?', '26. Foi corporação aplicável sob seção 59(k) em algum ano anterior?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q29', labels: ml('27. Is the corporation an applicable corporation under section 59(k)(1) in the current tax year?', '27. ¿Es corporación aplicable bajo sección 59(k)(1) en el año fiscal actual?', '27. É corporação aplicável sob seção 59(k)(1) no exercício atual?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q30', labels: ml('28. Does the corporation meet the requirements of the safe harbor method as provided under section 59A(i)(2)(A) for the current tax year? See instructions.', '28. ¿Cumple con el método de puerto seguro bajo sección 59A(i)(2)(A)?', '28. Cumpre com o método de porto seguro sob seção 59A(i)(2)(A)?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q29_form4626', labels: ml('29. Is the corporation not required to complete and attach Form 4626? See instructions. If "Yes," enter the corporation\'s adjusted financial statement income.', '29. ¿No se requiere completar Form 4626? Si "Sí", ingrese el ingreso ajustado de estados financieros.', '29. Não é necessário completar Form 4626? Se "Sim", insira a receita ajustada de demonstrações financeiras.'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q29_afsi', labels: ml('29. If "Yes," enter the corporation\'s adjusted financial statement income (AFSI) ▶ $', '29. Si "Sí", ingrese AFSI ▶ $', '29. Se "Sim", insira AFSI ▶ $'), type: 'money' },
      { key: 'schedK_q30_form7208', labels: ml('30. Is the corporation required to file Form 7208, Excise Tax on Repurchase of Corporate Stock? See instructions.', '30. ¿Se requiere presentar Form 7208, Impuesto Especial sobre Recompra de Acciones Corporativas?', '30. É necessário apresentar Form 7208, Imposto Especial sobre Recompra de Ações Corporativas?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'schedK_q31', labels: ml('31. Reserved for future use', '31. Reservado para uso futuro', '31. Reservado para uso futuro'), type: 'text' },
      { key: 'schedK_q32', labels: ml('32. Reserved for future use', '32. Reservado para uso futuro', '32. Reservado para uso futuro'), type: 'text' },
    ]
  },
  {
    id: 'scheduleL',
    titles: ml('Schedule L — Balance Sheets per Books', 'Schedule L — Balance General según Libros', 'Schedule L — Balanço Patrimonial por Livros'),
    icon: FileText,
    fields: [
      /* === ASSETS === */
      { key: 'cashBOY', labels: ml('1. Cash — Beginning of tax year', '1. Efectivo — Inicio del año fiscal', '1. Caixa — Início do exercício'), type: 'money' },
      { key: 'cashEOY', labels: ml('1. Cash — End of tax year', '1. Efectivo — Fin del año fiscal', '1. Caixa — Final do exercício'), type: 'money' },
      { key: 'accountsReceivableBOY', labels: ml('2a. Trade notes & accounts receivable — BOY', '2a. Cuentas por cobrar comerciales — Inicio', '2a. Contas a receber comerciais — Início'), type: 'money' },
      { key: 'accountsReceivableEOY', labels: ml('2a. Trade notes & accounts receivable — EOY', '2a. Cuentas por cobrar comerciales — Fin', '2a. Contas a receber comerciais — Final'), type: 'money' },
      { key: 'badDebtAllowanceBOY', labels: ml('2b. Less allowance for bad debts — BOY', '2b. Menos provisión para deudas incobrables — Inicio', '2b. Menos provisão para devedores duvidosos — Início'), type: 'money' },
      { key: 'badDebtAllowanceEOY', labels: ml('2b. Less allowance for bad debts — EOY', '2b. Menos provisión para deudas incobrables — Fin', '2b. Menos provisão para devedores duvidosos — Final'), type: 'money' },
      { key: 'inventoriesBOY', labels: ml('3. Inventories — BOY', '3. Inventarios — Inicio', '3. Estoques — Início'), type: 'money' },
      { key: 'inventoriesEOY', labels: ml('3. Inventories — EOY', '3. Inventarios — Fin', '3. Estoques — Final'), type: 'money' },
      { key: 'usGovObligationsBOY', labels: ml('4. U.S. government obligations — BOY', '4. Obligaciones del gobierno de EE.UU. — Inicio', '4. Obrigações do governo dos EUA — Início'), type: 'money' },
      { key: 'usGovObligationsEOY', labels: ml('4. U.S. government obligations — EOY', '4. Obligaciones del gobierno de EE.UU. — Fin', '4. Obrigações do governo dos EUA — Final'), type: 'money' },
      { key: 'taxExemptSecuritiesBOY', labels: ml('5. Tax-exempt securities (see instructions) — BOY', '5. Valores exentos de impuestos (ver instrucciones) — Inicio', '5. Títulos isentos de impostos (ver instruções) — Início'), type: 'money' },
      { key: 'taxExemptSecuritiesEOY', labels: ml('5. Tax-exempt securities (see instructions) — EOY', '5. Valores exentos de impuestos (ver instrucciones) — Fin', '5. Títulos isentos de impostos (ver instruções) — Final'), type: 'money' },
      { key: 'otherCurrentAssetsBOY', labels: ml('6. Other current assets (attach statement) — BOY', '6. Otros activos corrientes (adjuntar declaración) — Inicio', '6. Outros ativos circulantes (anexar declaração) — Início'), type: 'money' },
      { key: 'otherCurrentAssetsEOY', labels: ml('6. Other current assets (attach statement) — EOY', '6. Otros activos corrientes (adjuntar declaración) — Fin', '6. Outros ativos circulantes (anexar declaração) — Final'), type: 'money' },
      { key: 'loansToStockholdersBOY', labels: ml('7. Loans to stockholders — BOY', '7. Préstamos a accionistas — Inicio', '7. Empréstimos a acionistas — Início'), type: 'money' },
      { key: 'loansToStockholdersEOY', labels: ml('7. Loans to stockholders — EOY', '7. Préstamos a accionistas — Fin', '7. Empréstimos a acionistas — Final'), type: 'money' },
      { key: 'mortgageRealEstateLoansBOY', labels: ml('8. Mortgage and real estate loans — BOY', '8. Hipotecas y préstamos inmobiliarios — Inicio', '8. Hipotecas e empréstimos imobiliários — Início'), type: 'money' },
      { key: 'mortgageRealEstateLoansEOY', labels: ml('8. Mortgage and real estate loans — EOY', '8. Hipotecas y préstamos inmobiliarios — Fin', '8. Hipotecas e empréstimos imobiliários — Final'), type: 'money' },
      { key: 'otherInvestmentsBOY', labels: ml('9. Other investments (attach statement) — BOY', '9. Otras inversiones (adjuntar declaración) — Inicio', '9. Outros investimentos (anexar declaração) — Início'), type: 'money' },
      { key: 'otherInvestmentsEOY', labels: ml('9. Other investments (attach statement) — EOY', '9. Otras inversiones (adjuntar declaración) — Fin', '9. Outros investimentos (anexar declaração) — Final'), type: 'money' },
      { key: 'buildingsBOY', labels: ml('10a. Buildings and other depreciable assets — BOY', '10a. Edificios y otros activos depreciables — Inicio', '10a. Edifícios e outros ativos depreciáveis — Início'), type: 'money' },
      { key: 'buildingsEOY', labels: ml('10a. Buildings and other depreciable assets — EOY', '10a. Edificios y otros activos depreciables — Fin', '10a. Edifícios e outros ativos depreciáveis — Final'), type: 'money' },
      { key: 'accumulatedDepBOY', labels: ml('10b. Less accumulated depreciation — BOY', '10b. Menos depreciación acumulada — Inicio', '10b. Menos depreciação acumulada — Início'), type: 'money' },
      { key: 'accumulatedDepEOY', labels: ml('10b. Less accumulated depreciation — EOY', '10b. Menos depreciación acumulada — Fin', '10b. Menos depreciação acumulada — Final'), type: 'money' },
      { key: 'depletableAssetsBOY', labels: ml('11a. Depletable assets — BOY', '11a. Activos agotables — Inicio', '11a. Ativos esgotáveis — Início'), type: 'money' },
      { key: 'depletableAssetsEOY', labels: ml('11a. Depletable assets — EOY', '11a. Activos agotables — Fin', '11a. Ativos esgotáveis — Final'), type: 'money' },
      { key: 'accumulatedDepletionBOY', labels: ml('11b. Less accumulated depletion — BOY', '11b. Menos agotamiento acumulado — Inicio', '11b. Menos exaustão acumulada — Início'), type: 'money' },
      { key: 'accumulatedDepletionEOY', labels: ml('11b. Less accumulated depletion — EOY', '11b. Menos agotamiento acumulado — Fin', '11b. Menos exaustão acumulada — Final'), type: 'money' },
      { key: 'landBOY', labels: ml('12. Land (net of any amortization) — BOY', '12. Terrenos (neto de amortización) — Inicio', '12. Terrenos (líquido de amortização) — Início'), type: 'money' },
      { key: 'landEOY', labels: ml('12. Land (net of any amortization) — EOY', '12. Terrenos (neto de amortización) — Fin', '12. Terrenos (líquido de amortização) — Final'), type: 'money' },
      { key: 'otherAssetsBOY', labels: ml('13. Other assets (attach statement) — BOY', '13. Otros activos (adjuntar declaración) — Inicio', '13. Outros ativos (anexar declaração) — Início'), type: 'money' },
      { key: 'otherAssetsEOY', labels: ml('13. Other assets (attach statement) — EOY', '13. Otros activos (adjuntar declaración) — Fin', '13. Outros ativos (anexar declaração) — Final'), type: 'money' },
      { key: 'totalAssetsBOY', labels: ml('14. Total assets — BOY', '14. Total activos — Inicio', '14. Total de ativos — Início'), type: 'money', computed: true },
      { key: 'totalAssetsEOY', labels: ml('14. Total assets — EOY', '14. Total activos — Fin', '14. Total de ativos — Final'), type: 'money', computed: true },
      /* === LIABILITIES === */
      { key: 'accountsPayableBOY', labels: ml('15. Accounts payable — BOY', '15. Cuentas por pagar — Inicio', '15. Contas a pagar — Início'), type: 'money' },
      { key: 'accountsPayableEOY', labels: ml('15. Accounts payable — EOY', '15. Cuentas por pagar — Fin', '15. Contas a pagar — Final'), type: 'money' },
      { key: 'mortgagesLT1yrBOY', labels: ml('16. Mortgages, notes, bonds payable in less than 1 year — BOY', '16. Hipotecas, pagarés, bonos pagaderos en menos de 1 año — Inicio', '16. Hipotecas, notas, títulos pagáveis em menos de 1 ano — Início'), type: 'money' },
      { key: 'mortgagesLT1yrEOY', labels: ml('16. Mortgages, notes, bonds payable in less than 1 year — EOY', '16. Hipotecas, pagarés, bonos pagaderos en menos de 1 año — Fin', '16. Hipotecas, notas, títulos pagáveis em menos de 1 ano — Final'), type: 'money' },
      { key: 'otherCurrentLiabBOY', labels: ml('17. Other current liabilities (attach statement) — BOY', '17. Otros pasivos corrientes (adjuntar declaración) — Inicio', '17. Outros passivos circulantes (anexar declaração) — Início'), type: 'money' },
      { key: 'otherCurrentLiabEOY', labels: ml('17. Other current liabilities (attach statement) — EOY', '17. Otros pasivos corrientes (adjuntar declaración) — Fin', '17. Outros passivos circulantes (anexar declaração) — Final'), type: 'money' },
      { key: 'loansFromShareholdersBOY', labels: ml('18. Loans from stockholders — BOY', '18. Préstamos de accionistas — Inicio', '18. Empréstimos de acionistas — Início'), type: 'money' },
      { key: 'loansFromShareholdersEOY', labels: ml('18. Loans from stockholders — EOY', '18. Préstamos de accionistas — Fin', '18. Empréstimos de acionistas — Final'), type: 'money' },
      { key: 'mortgagesGTE1yrBOY', labels: ml('19. Mortgages, notes, bonds payable in 1 year or more — BOY', '19. Hipotecas, pagarés, bonos pagaderos en 1 año o más — Inicio', '19. Hipotecas, notas, títulos pagáveis em 1 ano ou mais — Início'), type: 'money' },
      { key: 'mortgagesGTE1yrEOY', labels: ml('19. Mortgages, notes, bonds payable in 1 year or more — EOY', '19. Hipotecas, pagarés, bonos pagaderos en 1 año o más — Fin', '19. Hipotecas, notas, títulos pagáveis em 1 ano ou mais — Final'), type: 'money' },
      { key: 'otherLiabilitiesBOY', labels: ml('20. Other liabilities (attach statement) — BOY', '20. Otros pasivos (adjuntar declaración) — Inicio', '20. Outros passivos (anexar declaração) — Início'), type: 'money' },
      { key: 'otherLiabilitiesEOY', labels: ml('20. Other liabilities (attach statement) — EOY', '20. Otros pasivos (adjuntar declaración) — Fin', '20. Outros passivos (anexar declaração) — Final'), type: 'money' },
      { key: 'totalLiabilitiesBOY', labels: ml('21. Total liabilities — BOY', '21. Total pasivos — Inicio', '21. Total de passivos — Início'), type: 'money', computed: true },
      { key: 'totalLiabilitiesEOY', labels: ml('21. Total liabilities — EOY', '21. Total pasivos — Fin', '21. Total de passivos — Final'), type: 'money', computed: true },
      /* === STOCKHOLDERS' EQUITY === */
      { key: 'capitalStockBOY', labels: ml('22. Capital stock: a Preferred stock — BOY', '22. Capital social: a Acciones preferentes — Inicio', '22. Capital social: a Ações preferenciais — Início'), type: 'money' },
      { key: 'capitalStockEOY', labels: ml('22. Capital stock: a Preferred stock — EOY', '22. Capital social: a Acciones preferentes — Fin', '22. Capital social: a Ações preferenciais — Final'), type: 'money' },
      { key: 'additionalPaidInCapBOY', labels: ml('23. Additional paid-in capital — BOY', '23. Capital pagado adicional — Inicio', '23. Capital integralizado adicional — Início'), type: 'money' },
      { key: 'additionalPaidInCapEOY', labels: ml('23. Additional paid-in capital — EOY', '23. Capital pagado adicional — Fin', '23. Capital integralizado adicional — Final'), type: 'money' },
      { key: 'retainedEarningsApprBOY', labels: ml('24. Retained earnings — Appropriated (attach statement) — BOY', '24. Ganancias retenidas — Asignadas (adjuntar declaración) — Inicio', '24. Lucros acumulados — Reservados (anexar declaração) — Início'), type: 'money' },
      { key: 'retainedEarningsApprEOY', labels: ml('24. Retained earnings — Appropriated (attach statement) — EOY', '24. Ganancias retenidas — Asignadas (adjuntar declaración) — Fin', '24. Lucros acumulados — Reservados (anexar declaração) — Final'), type: 'money' },
      { key: 'retainedEarningsBOY', labels: ml('25. Retained earnings — Unappropriated — BOY', '25. Ganancias retenidas — No asignadas — Inicio', '25. Lucros acumulados — Não distribuídos — Início'), type: 'money' },
      { key: 'retainedEarningsEOY', labels: ml('25. Retained earnings — Unappropriated — EOY', '25. Ganancias retenidas — No asignadas — Fin', '25. Lucros acumulados — Não distribuídos — Final'), type: 'money' },
      { key: 'adjustmentsSHEquityBOY', labels: ml('26. Adjustments to shareholders\' equity (attach statement) — BOY', '26. Ajustes al capital de accionistas (adjuntar declaración) — Inicio', '26. Ajustes ao patrimônio dos acionistas (anexar declaração) — Início'), type: 'money' },
      { key: 'adjustmentsSHEquityEOY', labels: ml('26. Adjustments to shareholders\' equity (attach statement) — EOY', '26. Ajustes al capital de accionistas (adjuntar declaración) — Fin', '26. Ajustes ao patrimônio dos acionistas (anexar declaração) — Final'), type: 'money' },
      { key: 'lessCSSTreasuryBOY', labels: ml('27. Less cost of treasury stock — BOY', '27. Menos costo de acciones en tesorería — Inicio', '27. Menos custo de ações em tesouraria — Início'), type: 'money' },
      { key: 'lessCSSTreasuryEOY', labels: ml('27. Less cost of treasury stock — EOY', '27. Menos costo de acciones en tesorería — Fin', '27. Menos custo de ações em tesouraria — Final'), type: 'money' },
      { key: 'totalLiabEquityBOY', labels: ml('28. Total liabilities and stockholders\' equity — BOY', '28. Total pasivos y capital de accionistas — Inicio', '28. Total passivos e patrimônio dos acionistas — Início'), type: 'money', computed: true },
      { key: 'totalLiabEquityEOY', labels: ml('28. Total liabilities and stockholders\' equity — EOY', '28. Total pasivos y capital de accionistas — Fin', '28. Total passivos e patrimônio dos acionistas — Final'), type: 'money', computed: true },
    ]
  },
  {
    id: 'scheduleM1',
    titles: ml('Schedule M-1 — Reconciliation of Income (Loss) per Books With Income per Return', 'Schedule M-1 — Conciliación del Ingreso (Pérdida) según Libros con Ingreso según Declaración', 'Schedule M-1 — Conciliação da Receita (Perda) por Livros com Receita por Declaração'),
    icon: FileText,
    fields: [
      { key: 'm1_line1', labels: ml('1. Net income (loss) per books', '1. Ingreso (pérdida) neto según libros', '1. Lucro (prejuízo) líquido por livros'), type: 'money' },
      { key: 'm1_line2', labels: ml('2. Federal income tax per books', '2. Impuesto federal sobre ingresos según libros', '2. Imposto de renda federal por livros'), type: 'money' },
      { key: 'm1_line3', labels: ml('3. Excess of capital losses over capital gains', '3. Exceso de pérdidas de capital sobre ganancias de capital', '3. Excesso de perdas de capital sobre ganhos de capital'), type: 'money' },
      { key: 'm1_line4', labels: ml('4. Income subject to tax not recorded on books this year', '4. Ingreso sujeto a impuesto no registrado en libros este año', '4. Receita sujeita a imposto não registrada nos livros este ano'), type: 'money' },
      { key: 'm1_line5', labels: ml('5. Expenses recorded on books this year not deducted on this return', '5. Gastos registrados en libros este año no deducidos en esta declaración', '5. Despesas registradas nos livros este ano não deduzidas nesta declaração'), type: 'money' },
      { key: 'm1_line6', labels: ml('6. Add lines 1 through 5', '6. Sumar líneas 1 a 5', '6. Somar linhas 1 a 5'), type: 'money', computed: true },
      { key: 'm1_line7', labels: ml('7. Income recorded on books this year not included on this return', '7. Ingreso registrado en libros este año no incluido en esta declaración', '7. Receita registrada nos livros este ano não incluída nesta declaração'), type: 'money' },
      { key: 'm1_line8', labels: ml('8. Deductions on this return not charged against book income this year', '8. Deducciones en esta declaración no cargadas contra ingreso contable este año', '8. Deduções nesta declaração não debitadas contra receita contábil este ano'), type: 'money' },
      { key: 'm1_line9', labels: ml('9. Add lines 7 and 8', '9. Sumar líneas 7 y 8', '9. Somar linhas 7 e 8'), type: 'money', computed: true },
      { key: 'm1_line10', labels: ml('10. Income (page 1, line 28) — line 6 less line 9', '10. Ingreso (página 1, línea 28) — línea 6 menos línea 9', '10. Receita (página 1, linha 28) — linha 6 menos linha 9'), type: 'money', computed: true },
    ]
  },
  {
    id: 'scheduleM2',
    titles: ml('Schedule M-2 — Analysis of Unappropriated Retained Earnings per Books', 'Schedule M-2 — Análisis de Ganancias Retenidas No Asignadas según Libros', 'Schedule M-2 — Análise dos Lucros Acumulados Não Distribuídos por Livros'),
    icon: FileText,
    fields: [
      { key: 'm2_line1', labels: ml('1. Balance at beginning of year', '1. Saldo al inicio del año', '1. Saldo no início do ano'), type: 'money' },
      { key: 'm2_line2', labels: ml('2. Net income (loss) per books', '2. Ingreso (pérdida) neto según libros', '2. Lucro (prejuízo) líquido por livros'), type: 'money' },
      { key: 'm2_line3', labels: ml('3. Other increases (itemize)', '3. Otros aumentos (detallar)', '3. Outros aumentos (detalhar)'), type: 'money' },
      { key: 'm2_line4', labels: ml('4. Add lines 1, 2, and 3', '4. Sumar líneas 1, 2 y 3', '4. Somar linhas 1, 2 e 3'), type: 'money', computed: true },
      { key: 'm2_line5a', labels: ml('5a. Distributions: Cash', '5a. Distribuciones: Efectivo', '5a. Distribuições: Caixa'), type: 'money' },
      { key: 'm2_line5b', labels: ml('5b. Distributions: Stock', '5b. Distribuciones: Acciones', '5b. Distribuições: Ações'), type: 'money' },
      { key: 'm2_line5c', labels: ml('5c. Distributions: Property', '5c. Distribuciones: Propiedad', '5c. Distribuições: Propriedade'), type: 'money' },
      { key: 'm2_line6', labels: ml('6. Other decreases (itemize)', '6. Otras disminuciones (detallar)', '6. Outras diminuições (detalhar)'), type: 'money' },
      { key: 'm2_line7', labels: ml('7. Add lines 5 and 6', '7. Sumar líneas 5 y 6', '7. Somar linhas 5 e 6'), type: 'money', computed: true },
      { key: 'm2_line8', labels: ml('8. Balance at end of year (line 4 less line 7)', '8. Saldo al final del año (línea 4 menos línea 7)', '8. Saldo no final do ano (linha 4 menos linha 7)'), type: 'money', computed: true },
    ]
  },
];

/* ================================================================
   FORM 5472 – Faithful replica of IRS Form 5472
   ================================================================ */
const FORM_5472_SECTIONS: SectionDef[] = [
  {
    id: 'partI',
    titles: ml('Part I — Reporting Corporation', 'Parte I — Corporación Reportante', 'Parte I — Corporação Declarante'),
    icon: Building2,
    fields: [
      { key: 'reportingCorpName', labels: ml('1a. Name of reporting corporation', '1a. Nombre de la corporación reportante', '1a. Nome da corporação declarante'), type: 'text' },
      { key: 'reportingCorpEIN', labels: ml('1b. Employer identification number (EIN)', '1b. Número de identificación del empleador (EIN)', '1b. Número de identificação do empregador (EIN)'), type: 'text' },
      { key: 'reportingCorpAddress', labels: ml('1c. Number, street, and room or suite no.', '1c. Número, calle y oficina', '1c. Número, rua e sala'), type: 'text' },
      { key: 'reportingCorpCity', labels: ml('1d. City or town, state, and ZIP code', '1d. Ciudad, estado y código postal', '1d. Cidade, estado e código postal'), type: 'text' },
      { key: 'countryOfIncorporation', labels: ml('1e. Country of incorporation', '1e. País de incorporación', '1e. País de incorporação'), type: 'text' },
      { key: 'dateOfIncorporation', labels: ml('1f. Date of incorporation', '1f. Fecha de incorporación', '1f. Data de incorporação'), type: 'date' },
      { key: 'principalBusinessActivity', labels: ml('1g. Principal business activity', '1g. Actividad comercial principal', '1g. Atividade comercial principal'), type: 'text' },
      { key: 'principalBusinessActivityCode', labels: ml('1h. Principal business activity code', '1h. Código de actividad comercial principal', '1h. Código de atividade comercial principal'), type: 'text' },
      { key: 'totalAssets5472', labels: ml('1i. Total assets', '1i. Total de activos', '1i. Total de ativos'), type: 'money' },
      { key: 'totalValueGrossReceipts', labels: ml('2. Total value of gross payments made or received', '2. Valor total de pagos brutos realizados o recibidos', '2. Valor total de pagamentos brutos feitos ou recebidos'), type: 'money' },
      { key: 'taxReturnFiled', labels: ml('3. Check applicable box: Initial return / Final return / Amended return / Name change / Address change', '3. Marque la casilla correspondiente: Declaración inicial / Final / Enmendada / Cambio de nombre / Cambio de dirección', '3. Marque a caixa aplicável: Declaração inicial / Final / Corrigida / Mudança de nome / Mudança de endereço'), type: 'text' },
    ]
  },
  {
    id: 'partII',
    titles: ml('Part II — 25% Foreign Shareholder', 'Parte II — Accionista Extranjero (25%)', 'Parte II — Acionista Estrangeiro (25%)'),
    icon: User,
    fields: [
      { key: 'foreignShareholderName', labels: ml('4a. Name and address of direct 25% foreign shareholder', '4a. Nombre y dirección del accionista extranjero directo (25%)', '4a. Nome e endereço do acionista estrangeiro direto (25%)'), type: 'text' },
      { key: 'foreignShareholderAddress', labels: ml('4b. Address (number, street, and room or suite no.)', '4b. Dirección (número, calle y oficina)', '4b. Endereço (número, rua e sala)'), type: 'text' },
      { key: 'foreignShareholderCity', labels: ml('4c. City or town, state or province, country, and ZIP or foreign postal code', '4c. Ciudad, estado, país y código postal', '4c. Cidade, estado, país e código postal'), type: 'text' },
      { key: 'foreignShareholderCountry', labels: ml('5. Country of citizenship or incorporation', '5. País de ciudadanía o incorporación', '5. País de cidadania ou incorporação'), type: 'text' },
      { key: 'foreignShareholderTIN', labels: ml('6. U.S. identifying number, if any (SSN or ITIN)', '6. Número de identificación de EE.UU., si tiene (SSN o ITIN)', '6. Número de identificação dos EUA, se houver (SSN ou ITIN)'), type: 'text' },
      { key: 'foreignShareholderFTIN', labels: ml('7a. FTIN, if any (see instructions)', '7a. FTIN, si tiene (ver instrucciones)', '7a. FTIN, se houver (ver instruções)'), type: 'text' },
      { key: 'foreignShareholderPercentOwned', labels: ml('7b. Percentage of stock owned (%)', '7b. Porcentaje de acciones poseído (%)', '7b. Percentual de ações possuído (%)'), type: 'text' },
    ]
  },
  {
    id: 'partIII',
    titles: ml('Part III — Related Party', 'Parte III — Parte Relacionada', 'Parte III — Parte Relacionada'),
    icon: User,
    fields: [
      { key: 'relatedPartyName', labels: ml('8a. Name and address of related party', '8a. Nombre y dirección de la parte relacionada', '8a. Nome e endereço da parte relacionada'), type: 'text' },
      { key: 'relatedPartyAddress', labels: ml('8b. Address (number, street, and room or suite no.)', '8b. Dirección (número, calle y oficina)', '8b. Endereço (número, rua e sala)'), type: 'text' },
      { key: 'relatedPartyCountry', labels: ml('8c. Country of citizenship, organization, or incorporation', '8c. País de ciudadanía, organización o incorporación', '8c. País de cidadania, organização ou incorporação'), type: 'text' },
      { key: 'relatedPartyTIN', labels: ml('8d. U.S. identifying number, if any', '8d. Número de identificación de EE.UU., si tiene', '8d. Número de identificação dos EUA, se houver'), type: 'text' },
      { key: 'relatedPartyFTIN', labels: ml('8e. FTIN, if any', '8e. FTIN, si tiene', '8e. FTIN, se houver'), type: 'text' },
      { key: 'relatedPartyRelationship', labels: ml('8f. Relationship — Check applicable box (see instructions)', '8f. Relación — Marque la casilla correspondiente (ver instrucciones)', '8f. Relacionamento — Marque a caixa aplicável (ver instruções)'), type: 'text' },
      { key: 'principalBusinessActivityRP', labels: ml('8g. Principal business activity', '8g. Actividad comercial principal', '8g. Atividade comercial principal'), type: 'text' },
    ]
  },
  {
    id: 'partIV_received',
    titles: ml('Part IV — Monetary Transactions Between Reporting Corp. and Foreign Related Party (Amounts Received)', 'Parte IV — Transacciones Monetarias (Montos Recibidos)', 'Parte IV — Transações Monetárias (Valores Recebidos)'),
    icon: DollarSign,
    fields: [
      { key: 'salesOfStock', labels: ml('9. Sales of stock in trade (inventory)', '9. Ventas de inventario', '9. Vendas de estoque'), type: 'money' },
      { key: 'salesOfTangible', labels: ml('10. Sales of tangible property other than stock in trade', '10. Ventas de propiedad tangible que no es inventario', '10. Vendas de propriedade tangível que não é estoque'), type: 'money' },
      { key: 'salesOfPropertyRights', labels: ml('11. Sales of property rights or intangible property', '11. Ventas de derechos de propiedad o propiedad intangible', '11. Vendas de direitos de propriedade ou propriedade intangível'), type: 'money' },
      { key: 'platformContribution', labels: ml('12. Platform contribution transaction payments received', '12. Pagos de transacciones de contribución de plataforma recibidos', '12. Pagamentos de transações de contribuição de plataforma recebidos'), type: 'money' },
      { key: 'costSharingReceived', labels: ml('13. Cost sharing transaction payments received', '13. Pagos de transacciones de costo compartido recibidos', '13. Pagamentos de transações de custos compartilhados recebidos'), type: 'money' },
      { key: 'compensationReceived', labels: ml('14. Compensation received for technical, managerial, engineering, construction, or like services', '14. Compensación recibida por servicios técnicos, gerenciales, de ingeniería, construcción o similares', '14. Compensação recebida por serviços técnicos, gerenciais, de engenharia, construção ou similares'), type: 'money' },
      { key: 'commissionsReceived', labels: ml('15. Commissions received', '15. Comisiones recibidas', '15. Comissões recebidas'), type: 'money' },
      { key: 'rentsReceived', labels: ml('16. Rents, royalties, and license fees received', '16. Alquileres, regalías y tarifas de licencia recibidos', '16. Aluguéis, royalties e taxas de licença recebidos'), type: 'money' },
      { key: 'interestReceived', labels: ml('17. Interest received', '17. Intereses recibidos', '17. Juros recebidos'), type: 'money' },
      { key: 'premiumsReceived', labels: ml('18. Premiums received for insurance or reinsurance', '18. Primas recibidas por seguros o reaseguros', '18. Prêmios recebidos por seguros ou resseguros'), type: 'money' },
      { key: 'otherReceived', labels: ml('19. Other amounts received (see instructions)', '19. Otros montos recibidos (ver instrucciones)', '19. Outros valores recebidos (ver instruções)'), type: 'money' },
      { key: 'totalAmountsReceived', labels: ml('20. Total — Add lines 9 through 19', '20. Total — Sumar líneas 9 a 19', '20. Total — Somar linhas 9 a 19'), type: 'money', computed: true },
      { key: 'loanProceeds', labels: ml('21. Amounts borrowed (see instructions)', '21. Montos prestados (ver instrucciones)', '21. Valores emprestados (ver instruções)'), type: 'money' },
      { key: 'loanRepaymentReceived', labels: ml('22. Amounts received (loan repayments)', '22. Montos recibidos (pagos de préstamos)', '22. Valores recebidos (pagamentos de empréstimos)'), type: 'money' },
    ]
  },
  {
    id: 'partIV_paid',
    titles: ml('Part IV — Monetary Transactions (Amounts Paid)', 'Parte IV — Transacciones Monetarias (Montos Pagados)', 'Parte IV — Transações Monetárias (Valores Pagos)'),
    icon: DollarSign,
    fields: [
      { key: 'purchasesOfStock', labels: ml('23. Purchases of stock in trade (inventory)', '23. Compras de inventario', '23. Compras de estoque'), type: 'money' },
      { key: 'purchasesOfTangible', labels: ml('24. Purchases of tangible property other than stock in trade', '24. Compras de propiedad tangible que no es inventario', '24. Compras de propriedade tangível que não é estoque'), type: 'money' },
      { key: 'purchasesOfPropertyRights', labels: ml('25. Purchases of property rights or intangible property', '25. Compras de derechos de propiedad o propiedad intangible', '25. Compras de direitos de propriedade ou propriedade intangível'), type: 'money' },
      { key: 'platformContributionPaid', labels: ml('26. Platform contribution transaction payments paid', '26. Pagos de transacciones de contribución de plataforma pagados', '26. Pagamentos de transações de contribuição de plataforma pagos'), type: 'money' },
      { key: 'costSharingPaid', labels: ml('27. Cost sharing transaction payments paid', '27. Pagos de transacciones de costo compartido pagados', '27. Pagamentos de transações de custos compartilhados pagos'), type: 'money' },
      { key: 'compensationPaid', labels: ml('28. Compensation paid for technical, managerial, engineering, construction, or like services', '28. Compensación pagada por servicios técnicos, gerenciales, de ingeniería, construcción o similares', '28. Compensação paga por serviços técnicos, gerenciais, de engenharia, construção ou similares'), type: 'money' },
      { key: 'commissionsPaid', labels: ml('29. Commissions paid', '29. Comisiones pagadas', '29. Comissões pagas'), type: 'money' },
      { key: 'rentsPaid', labels: ml('30. Rents, royalties, and license fees paid', '30. Alquileres, regalías y tarifas de licencia pagados', '30. Aluguéis, royalties e taxas de licença pagos'), type: 'money' },
      { key: 'interestPaid', labels: ml('31. Interest paid', '31. Intereses pagados', '31. Juros pagos'), type: 'money' },
      { key: 'premiumsPaid', labels: ml('32. Premiums paid for insurance or reinsurance', '32. Primas pagadas por seguros o reaseguros', '32. Prêmios pagos por seguros ou resseguros'), type: 'money' },
      { key: 'otherPaid', labels: ml('33. Other amounts paid (see instructions)', '33. Otros montos pagados (ver instrucciones)', '33. Outros valores pagos (ver instruções)'), type: 'money' },
      { key: 'totalAmountsPaid', labels: ml('34. Total — Add lines 23 through 33', '34. Total — Sumar líneas 23 a 33', '34. Total — Somar linhas 23 a 33'), type: 'money', computed: true },
      { key: 'loanAdvances', labels: ml('35. Amounts loaned (see instructions)', '35. Montos prestados (ver instrucciones)', '35. Valores emprestados (ver instruções)'), type: 'money' },
      { key: 'loanRepaymentPaid', labels: ml('36. Amounts paid (loan repayments)', '36. Montos pagados (pagos de préstamos)', '36. Valores pagos (pagamentos de empréstimos)'), type: 'money' },
    ]
  },
  {
    id: 'partV',
    titles: ml('Part V — Reportable Transactions of a Reporting Corporation That Is a Foreign-Owned U.S. DE', 'Parte V — Transacciones Reportables de Corporación con Propietario Extranjero', 'Parte V — Transações Reportáveis de Corporação com Proprietário Estrangeiro'),
    icon: FileText,
    fields: [
      { key: 'partV_description', labels: ml('Describe on an attached separate sheet any other transaction as defined by Regulations section 1.482-1(i)(7), such as amounts paid or received in connection with the formation, dissolution, acquisition, and disposition of the entity, including contributions to and distributions from the entity, and check here ▶', 'Describa en hoja adjunta cualquier otra transacción según Reglamento sección 1.482-1(i)(7)', 'Descreva em folha anexa qualquer outra transação conforme Regulamento seção 1.482-1(i)(7)'), type: 'select', options: ['Yes', 'No'] },
    ]
  },
  {
    id: 'partVI',
    titles: ml('Part VI — Nonmonetary and Less-Than-Full Consideration Transactions Between the Reporting Corporation and the Foreign Related Party', 'Parte VI — Transacciones No Monetarias y de Contraprestación Parcial', 'Parte VI — Transações Não Monetárias e de Contraprestação Parcial'),
    icon: FileText,
    fields: [
      { key: 'partVI_description', labels: ml('Describe these transactions on an attached separate sheet and check here ▶', 'Describa estas transacciones en hoja adjunta y marque aquí', 'Descreva estas transações em folha anexa e marque aqui'), type: 'select', options: ['Yes', 'No'] },
    ]
  },
  {
    id: 'partVII',
    titles: ml('Part VII — Additional Information (All reporting corporations must complete Part VII)', 'Parte VII — Información Adicional (Todas las corporaciones deben completar)', 'Parte VII — Informações Adicionais (Todas as corporações devem preencher)'),
    icon: FileText,
    fields: [
      { key: 'partVII_q1', labels: ml('1. Does the reporting corporation import goods from a foreign related party?', '1. ¿La corporación reportante importa bienes de una parte relacionada extranjera?', '1. A corporação declarante importa bens de uma parte relacionada estrangeira?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'partVII_q1a', labels: ml('a. If "Yes," is the basis or inventory cost of the goods valued at greater than the customs value of the imported goods?', 'a. Si "Sí", ¿el costo del inventario es mayor al valor aduanero?', 'a. Se "Sim", o custo do estoque é maior que o valor aduaneiro?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'partVII_q2', labels: ml('2. During the tax year, was the foreign parent corporation a participant in any cost sharing arrangement (CSA)?', '2. ¿La corporación matriz extranjera participó en algún acuerdo de costos compartidos (CSA)?', '2. A corporação controladora estrangeira participou de algum acordo de custos compartilhados (CSA)?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'partVII_q3a', labels: ml('3a. During the tax year, did the reporting corporation pay or accrue any interest or royalty for which the deduction is not allowed under section 267A? (see instructions)', '3a. ¿Pagó o devengó intereses o regalías no deducibles bajo sección 267A?', '3a. Pagou ou acumulou juros ou royalties não dedutíveis sob seção 267A?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'partVII_q3a_amt', labels: ml('3a. If "Yes," enter the total amount of the disallowed deductions ▶ $', '3a. Si "Sí", ingrese el monto total de deducciones no permitidas', '3a. Se "Sim", insira o valor total das deduções não permitidas'), type: 'money' },
      { key: 'partVII_q3b', labels: ml('3b. Is the reporting corporation claiming a foreign-derived intangible income (FDII) deduction (under section 250) with respect to any transactions with the foreign related party?', '3b. ¿Reclama deducción FDII (bajo sección 250) con la parte relacionada extranjera?', '3b. Reivindica dedução FDII (sob seção 250) com a parte relacionada estrangeira?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'partVII_q4a', labels: ml('4a. Enter the amount of gross receipts derived from all sales of tangible property to the foreign related party', '4a. Ingresos brutos de ventas de propiedad tangible a la parte relacionada', '4a. Receitas brutas de vendas de propriedade tangível para a parte relacionada'), type: 'money' },
      { key: 'partVII_q4b', labels: ml('4b. Enter the amount of gross receipts derived from all sales of personal property to the foreign related party', '4b. Ingresos brutos de ventas de propiedad personal a la parte relacionada', '4b. Receitas brutas de vendas de propriedade pessoal para a parte relacionada'), type: 'money' },
      { key: 'partVII_q4c', labels: ml('4c. Enter the amount of gross receipts derived from all services provided to the foreign related party', '4c. Ingresos brutos por servicios a la parte relacionada', '4c. Receitas brutas por serviços para a parte relacionada'), type: 'money' },
      { key: 'partVII_q5a', labels: ml('5a. Did the reporting corporation have any loan to or from the related party to which the safe-haven rate of Regulations section 1.482-2(a)(2)(iii)(B) are applicable, and for which the reporting corporation used a rate of interest within the safe-haven?', '5a. ¿Tuvo préstamos con tasa dentro del puerto seguro según Reg. sección 1.482-2(a)(2)(iii)(B)?', '5a. Teve empréstimos com taxa dentro do porto seguro segundo Reg. seção 1.482-2(a)(2)(iii)(B)?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'partVII_q5b', labels: ml('5b. Did the reporting corporation have any loan to or from the related party to which the safe-haven rules of Regulations section 1.482-2(a)(2)(iii)(B) are applicable, and for which the reporting corporation used a rate of interest outside the safe-haven?', '5b. ¿Tuvo préstamos con tasa fuera del puerto seguro?', '5b. Teve empréstimos com taxa fora do porto seguro?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'partVII_q6', labels: ml('6. Did the reporting corporation issue a covered debt instrument in any of the transactions described in Regulations section 1.385-3(b)(2) or (3)?', '6. ¿Emitió instrumento de deuda cubierto según Reg. sección 1.385-3(b)(2) o (3)?', '6. Emitiu instrumento de dívida coberto segundo Reg. seção 1.385-3(b)(2) ou (3)?'), type: 'select', options: ['Yes', 'No'] },
    ]
  },
  {
    id: 'partVIII',
    titles: ml('Part VIII — Cost Sharing Arrangement (CSA)', 'Parte VIII — Acuerdo de Costos Compartidos (CSA)', 'Parte VIII — Acordo de Custos Compartilhados (CSA)'),
    icon: FileText,
    fields: [
      { key: 'partVIII_desc', labels: ml('Provide a brief description of the CSA with respect to which this Part VIII is being completed', 'Describa brevemente el CSA', 'Descreva brevemente o CSA'), type: 'text' },
      { key: 'partVIII_qa', labels: ml('a. During the life of the tax year, did the reporting corporation become a participant in the CSA?', 'a. ¿Se convirtió en participante del CSA durante el año fiscal?', 'a. Tornou-se participante do CSA durante o exercício?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'partVIII_qb', labels: ml('b. Was the CSA in effect before January 5, 2009?', 'b. ¿El CSA estaba vigente antes del 5 de enero de 2009?', 'b. O CSA estava em vigor antes de 5 de janeiro de 2009?'), type: 'select', options: ['Yes', 'No'] },
      { key: 'partVIII_qc', labels: ml('c. What was the reporting corporation\'s share of reasonably anticipated benefits for the CSA?', 'c. ¿Cuál fue la participación de la corporación en los beneficios anticipados del CSA?', 'c. Qual foi a participação da corporação nos benefícios antecipados do CSA?'), type: 'text' },
      { key: 'partVIII_stockComp', labels: ml('d. Enter the total amount of stock-based compensation deductions claimed by the reporting corporation ▶ $', 'd. Ingrese el monto total de deducciones por compensación basada en acciones', 'd. Insira o valor total de deduções por compensação baseada em ações'), type: 'money' },
      { key: 'partVIII_intangible', labels: ml('e. Enter the total amount of intangible development costs for the CSA ▶ $', 'e. Ingrese el total de costos de desarrollo de intangibles para el CSA', 'e. Insira o total de custos de desenvolvimento de intangíveis para o CSA'), type: 'money' },
    ]
  },
  {
    id: 'partIX',
    titles: ml('Part IX — Base Erosion Payments and Base Erosion Tax Benefits Under Section 59A', 'Parte IX — Pagos de Erosión de Base y Beneficios Fiscales Bajo Sección 59A', 'Parte IX — Pagamentos de Erosão de Base e Benefícios Fiscais Sob Seção 59A'),
    icon: DollarSign,
    fields: [
      { key: 'partIX_a', labels: ml('a. Amounts defined as base erosion payments under section 59A(d)', 'a. Montos definidos como pagos de erosión de base bajo sección 59A(d)', 'a. Valores definidos como pagamentos de erosão de base sob seção 59A(d)'), type: 'money' },
      { key: 'partIX_b', labels: ml('b. Amount of base erosion tax benefits under section 59A(c)(2)', 'b. Monto de beneficios fiscales por erosión de base bajo sección 59A(c)(2)', 'b. Valor de benefícios fiscais por erosão de base sob seção 59A(c)(2)'), type: 'money' },
      { key: 'partIX_c', labels: ml('c. Amount of total qualified derivative payments as described in section 59A(h) made by the reporting corporation', 'c. Monto de pagos de derivados calificados según sección 59A(h)', 'c. Valor de pagamentos de derivativos qualificados segundo seção 59A(h)'), type: 'money' },
      { key: 'partIX_d', labels: ml('d. Reserved for future use', 'd. Reservado para uso futuro', 'd. Reservado para uso futuro'), type: 'money' },
    ]
  },
];

/* ================================================================
   UI STRINGS (multilingual)
   ================================================================ */
const UI = {
  taxFilings: ml('Tax Filings', 'Declaraciones de Impuestos', 'Declarações de Impostos'),
  taxSubtitle: ml('IRS Forms 1120 and 5472 for foreign-owned U.S. LLCs', 'Formularios IRS 1120 y 5472 para LLC con propietario extranjero', 'Formulários IRS 1120 e 5472 para LLC com proprietário estrangeiro'),
  newFiling: ml('New Filing', 'Nueva Declaración', 'Nova Declaração'),
  createNewFiling: ml('Create New Filing', 'Crear Nueva Declaración', 'Criar Nova Declaração'),
  formType: ml('Form Type', 'Tipo de Formulario', 'Tipo de Formulário'),
  taxYear: ml('Tax Year', 'Año Fiscal', 'Ano Fiscal'),
  createBtn: ml('Create', 'Crear', 'Criar'),
  cancelBtn: ml('Cancel', 'Cancelar', 'Cancelar'),
  noFilings: ml('No tax filings yet.', 'No hay declaraciones de impuestos.', 'Não há declarações de impostos.'),
  noFilingsHint: ml('Create a new filing to get started.', 'Crea una nueva declaración para comenzar.', 'Crie uma nova declaração para começar.'),
  form: ml('Form', 'Formulario', 'Formulário'),
  company: ml('Company', 'Empresa', 'Empresa'),
  year: ml('Year', 'Año', 'Ano'),
  status: ml('Status', 'Estado', 'Status'),
  created: ml('Created', 'Creado', 'Criado'),
  actions: ml('Actions', 'Acciones', 'Ações'),
  autoPopulate: ml('Auto-fill', 'Auto-completar', 'Preencher automático'),
  extractFiles: ml('Extract from Files', 'Extraer de Archivos', 'Extrair de Arquivos'),
  generatePdf: ml('Generate PDF', 'Generar PDF', 'Gerar PDF'),
  save: ml('Save', 'Guardar', 'Salvar'),
  changeStatus: ml('Change status:', 'Cambiar estado:', 'Mudar status:'),
  fieldsCompleted: ml('fields completed', 'campos completados', 'campos preenchidos'),
  notes: ml('Notes', 'Notas', 'Notas'),
  notesPlaceholder: ml('Internal notes about this filing...', 'Notas internas sobre esta declaración...', 'Notas internas sobre esta declaração...'),
  systemData: ml('System data:', 'Datos del sistema:', 'Dados do sistema:'),
  transactionsFound: ml('transactions found', 'transacciones encontradas', 'transações encontradas'),
  income: ml('income', 'ingresos', 'receitas'),
  expenses: ml('expenses', 'gastos', 'despesas'),
  extractionCompleted: ml('Extraction completed', 'Extracción completada', 'Extração concluída'),
  irsCategorySummary: ml('IRS Category Summary:', 'Resumen por Categoría IRS:', 'Resumo por Categoria IRS:'),
  hide: ml('Hide', 'Ocultar', 'Ocultar'),
  view: ml('View', 'Ver', 'Ver'),
  extractedTxns: ml('extracted transactions', 'transacciones extraídas', 'transações extraídas'),
  txnDate: ml('Date', 'Fecha', 'Data'),
  txnDesc: ml('Description', 'Descripción', 'Descrição'),
  txnAmount: ml('Amount', 'Monto', 'Valor'),
  txnCategory: ml('IRS Category', 'Categoría IRS', 'Categoria IRS'),
  txnConf: ml('Conf.', 'Conf.', 'Conf.'),
  select: ml('— Select —', '— Seleccionar —', '— Selecionar —'),
  noCompanyError: ml('You must have at least one company to create a filing. Go to Settings to create one.', 'Debes tener al menos una empresa para crear una declaración. Ve a Configuración para crear una.', 'Você deve ter pelo menos uma empresa para criar uma declaração. Vá para Configurações para criar uma.'),
  errorCreating: ml('Error creating filing:', 'Error al crear la declaración:', 'Erro ao criar a declaração:'),
  confirmDelete: ml('Delete this filing?', '¿Eliminar esta declaración?', 'Excluir esta declaração?'),
  extractionError: ml('Extraction error:', 'Error de extracción:', 'Erro de extração:'),
  fieldsExtracted: ml('fields extracted from', 'campos extraídos de', 'campos extraídos de'),
  files: ml('file(s).', 'archivo(s).', 'arquivo(s).'),
  fileProcessError: ml('Error processing files:', 'Error al procesar archivos:', 'Erro ao processar arquivos:'),
};

export default function TaxFilingPage() {
  const { activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;

  const [filings, setFilings] = useState<TaxFiling[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [activeFiling, setActiveFiling] = useState<TaxFiling | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [autoData, setAutoData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionNotes, setExtractionNotes] = useState('');
  const [categorySummary, setCategorySummary] = useState<Record<string, { total: number; count: number }> | null>(null);
  const [extractedTransactions, setExtractedTransactions] = useState<any[] | null>(null);
  const [showTransactions, setShowTransactions] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [newFormType, setNewFormType] = useState('1120');
  const [newTaxYear, setNewTaxYear] = useState(new Date().getFullYear().toString());
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const fetchFilings = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeCompanyId ? `?companyId=${activeCompanyId}` : '';
      const [filRes, compRes] = await Promise.all([
        fetch(`/api/tax-filings${params}`),
        fetch('/api/companies'),
      ]);
      const filData = await filRes.json();
      const compData = await compRes.json();
      setFilings(filData?.filings ?? []);
      setCompanies(compData?.companies ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => { fetchFilings(); }, [fetchFilings]);

  const sections = activeFiling?.formType === '5472' ? FORM_5472_SECTIONS : FORM_1120_SECTIONS;

  const handleCreate = async () => {
    const compId = activeCompanyId || companies[0]?.id;
    if (!compId) {
      setErrorMsg(L(UI.noCompanyError));
      return;
    }
    setErrorMsg('');
    try {
      const res = await fetch('/api/tax-filings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: compId, formType: newFormType, taxYear: newTaxYear }),
      });
      const data = await res.json();
      if (data.error) { setErrorMsg(data.error); return; }
      if (data.filing) {
        setShowNewDialog(false);
        openFiling(data.filing);
        fetchFilings();
      }
    } catch (e: any) {
      setErrorMsg(L(UI.errorCreating) + ' ' + (e.message || ''));
    }
  };

  const openFiling = (filing: TaxFiling) => {
    setActiveFiling(filing);
    setFormData(filing.formData || {});
    setAutoData(filing.autoData || {});
    setExtractionNotes('');
    const sects = filing.formType === '5472' ? FORM_5472_SECTIONS : FORM_1120_SECTIONS;
    setExpandedSections({ [sects[0].id]: true });
    setView('form');
  };

  const handleAutoPopulate = async () => {
    if (!activeFiling) return;
    setAutoLoading(true);
    try {
      const res = await fetch('/api/tax-filings/auto-populate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: activeFiling.companyId,
          formType: activeFiling.formType,
          taxYear: activeFiling.taxYear,
        }),
      });
      const data = await res.json();
      if (data.autoData) {
        setAutoData(data.autoData);
        const merged = { ...formData };
        for (const [k, v] of Object.entries(data.autoData)) {
          if (k.startsWith('_')) continue;
          if (!merged[k] && merged[k] !== 0) merged[k] = v;
        }
        setFormData(merged);
      }
    } catch { /* ignore */ }
    setAutoLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0 || !activeFiling) return;
    setExtracting(true);
    setExtractionNotes('');
    setCategorySummary(null);
    setExtractedTransactions(null);
    setShowTransactions(false);
    setErrorMsg('');
    try {
      const fileList: { fileContent: string; fileName: string }[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binaryStr = '';
        const chunkSize = 8192;
        for (let j = 0; j < bytes.length; j += chunkSize) {
          const chunk = bytes.subarray(j, j + chunkSize);
          binaryStr += String.fromCharCode(...chunk);
        }
        const base64 = btoa(binaryStr);
        fileList.push({ fileContent: base64, fileName: file.name });
      }

      const res = await fetch('/api/tax-filings/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileList, formType: activeFiling.formType }),
      });
      const data = await res.json();
      if (data.error) {
        setErrorMsg(L(UI.extractionError) + ' ' + data.error);
      } else if (data.extracted) {
        const notes = data.extracted._extractionNotes || '';
        const txns = data.extracted._transactions || null;
        const catSummary = data.extracted._categorySummary || null;
        const internalKeys = Object.keys(data.extracted).filter(k => k.startsWith('_'));
        for (const k of internalKeys) delete data.extracted[k];
        const merged = { ...formData };
        let fieldsUpdated = 0;
        for (const [k, v] of Object.entries(data.extracted)) {
          if (v !== null && v !== undefined && v !== '') { merged[k] = v; fieldsUpdated++; }
        }
        setFormData(merged);
        setExtractionNotes(notes || `${fieldsUpdated} ${L(UI.fieldsExtracted)} ${fileList.length} ${L(UI.files)}`);
        if (txns) setExtractedTransactions(txns);
        if (catSummary) setCategorySummary(catSummary);
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      setErrorMsg(L(UI.fileProcessError) + ' ' + (err.message || ''));
    }
    setExtracting(false);
    e.target.value = '';
  };

  const handleSave = async (newStatus?: string) => {
    if (!activeFiling) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tax-filings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeFiling.id,
          formData,
          autoData,
          status: newStatus || activeFiling.status,
          ...(newStatus === 'filed' ? { filedDate: new Date().toISOString() } : {}),
        }),
      });
      const data = await res.json();
      if (data.filing) {
        setActiveFiling({ ...activeFiling, ...data.filing, formData, autoData });
        fetchFilings();
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(L(UI.confirmDelete))) return;
    try {
      await fetch(`/api/tax-filings?id=${id}`, { method: 'DELETE' });
      if (activeFiling?.id === id) { setView('list'); setActiveFiling(null); }
      fetchFilings();
    } catch { /* ignore */ }
  };

  const handleGeneratePDF = async () => {
    if (!activeFiling) return;
    setPdfGenerating(true);
    try {
      const res = await fetch('/api/tax-filings/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filingId: activeFiling.id,
          formType: activeFiling.formType,
          taxYear: activeFiling.taxYear,
          formData,
          companyName: activeFiling.company?.name || '',
        }),
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/pdf')) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Form_${activeFiling.formType}_${activeFiling.taxYear}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          const data = await res.json();
          if (data.pdfUrl) {
            const a = document.createElement('a');
            a.href = data.pdfUrl;
            a.download = `Form_${activeFiling.formType}_${activeFiling.taxYear}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        }
      }
    } catch (err) { console.error('PDF generation error:', err); }
    setPdfGenerating(false);
  };

  const updateField = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isAutoField = (key: string) => autoData && key in autoData && !key.startsWith('_');

  /* ===== Auto-compute CALC fields ===== */
  useEffect(() => {
    if (!activeFiling) return;
    const d = { ...formData };
    let changed = false;
    const num = (key: string) => parseFloat(d[key]) || 0;

    if (activeFiling.formType === '1120') {
      // Line 1c
      const l1c = num('grossReceipts') - num('returnsAllowances');
      if (d.line1c !== Math.round(l1c * 100) / 100) { d.line1c = Math.round(l1c * 100) / 100; changed = true; }
      // Line 3
      const gp = l1c - num('costOfGoodsSold');
      if (d.grossProfit !== Math.round(gp * 100) / 100) { d.grossProfit = Math.round(gp * 100) / 100; changed = true; }
      // Line 11
      const ti = gp + num('dividends') + num('interestIncome') + num('grossRents') + num('grossRoyalties') + num('capitalGainNet') + num('netGainLoss') + num('otherIncome');
      if (d.totalIncome !== Math.round(ti * 100) / 100) { d.totalIncome = Math.round(ti * 100) / 100; changed = true; }
      // Line 27
      const td = num('officerCompensation') + num('salariesAndWages') + num('repairsAndMaintenance') + num('badDebts') + num('rents') + num('taxesAndLicenses') + num('interestExpense') + num('charitableContributions') + num('depreciation') + num('depletion') + num('advertising') + num('pensionProfit') + num('employeeBenefits') + num('domesticProdDeduction') + num('otherDeductions');
      if (d.totalDeductions !== Math.round(td * 100) / 100) { d.totalDeductions = Math.round(td * 100) / 100; changed = true; }
      // Line 28
      const taxi = ti - td;
      if (d.taxableIncome !== Math.round(taxi * 100) / 100) { d.taxableIncome = Math.round(taxi * 100) / 100; changed = true; }
      // Line 29c
      const l29c = num('nolDeduction') + num('specialDeductions');
      if (d.line29cTotal !== Math.round(l29c * 100) / 100) { d.line29cTotal = Math.round(l29c * 100) / 100; changed = true; }
      // Line 30
      const ft = taxi - l29c;
      if (d.finalTaxableIncome !== Math.round(ft * 100) / 100) { d.finalTaxableIncome = Math.round(ft * 100) / 100; changed = true; }
      // Schedule M-1 Line 6
      const m1l6 = num('m1_line1') + num('m1_line2') + num('m1_line3') + num('m1_line4') + num('m1_line5');
      if (d.m1_line6 !== Math.round(m1l6 * 100) / 100) { d.m1_line6 = Math.round(m1l6 * 100) / 100; changed = true; }
      // Schedule M-1 Line 9
      const m1l9 = num('m1_line7') + num('m1_line8');
      if (d.m1_line9 !== Math.round(m1l9 * 100) / 100) { d.m1_line9 = Math.round(m1l9 * 100) / 100; changed = true; }
      // Schedule M-1 Line 10
      const m1l10 = m1l6 - m1l9;
      if (d.m1_line10 !== Math.round(m1l10 * 100) / 100) { d.m1_line10 = Math.round(m1l10 * 100) / 100; changed = true; }
      // Schedule M-2 Line 4
      const m2l4 = num('m2_line1') + num('m2_line2') + num('m2_line3');
      if (d.m2_line4 !== Math.round(m2l4 * 100) / 100) { d.m2_line4 = Math.round(m2l4 * 100) / 100; changed = true; }
      // Schedule M-2 Line 7
      const m2l7 = num('m2_line5a') + num('m2_line5b') + num('m2_line5c') + num('m2_line6');
      if (d.m2_line7 !== Math.round(m2l7 * 100) / 100) { d.m2_line7 = Math.round(m2l7 * 100) / 100; changed = true; }
      // Schedule M-2 Line 8
      const m2l8 = m2l4 - m2l7;
      if (d.m2_line8 !== Math.round(m2l8 * 100) / 100) { d.m2_line8 = Math.round(m2l8 * 100) / 100; changed = true; }

      // === Schedule C computed lines ===
      // Line 9: Subtotal (lines 1-8)
      const schedC9 = num('schedC_1') + num('schedC_2') + num('schedC_3') + num('schedC_4') + num('schedC_5') + num('schedC_6') + num('schedC_7') + num('schedC_8');
      if (d.schedC_9 !== Math.round(schedC9 * 100) / 100) { d.schedC_9 = Math.round(schedC9 * 100) / 100; changed = true; }
      // Line 23: Total dividends and inclusions (lines 9-20)
      const schedC23 = schedC9 + num('schedC_10') + num('schedC_11') + num('schedC_12') + num('schedC_13') + num('schedC_14') + num('schedC_15') + num('schedC_16a') + num('schedC_16b') + num('schedC_16c') + num('schedC_17') + num('schedC_18') + num('schedC_19') + num('schedC_20');
      if (d.schedC_23 !== Math.round(schedC23 * 100) / 100) { d.schedC_23 = Math.round(schedC23 * 100) / 100; changed = true; }

      // === Schedule J computed lines ===
      // Line 6: Total income tax (1a through 5c)
      const schedJ6 = num('schedJ_1a') + num('schedJ_1b') + num('schedJ_2') + num('schedJ_3') + num('schedJ_4') + num('schedJ_5a') + num('schedJ_5b') + num('schedJ_5c');
      if (d.schedJ_6 !== Math.round(schedJ6 * 100) / 100) { d.schedJ_6 = Math.round(schedJ6 * 100) / 100; changed = true; }
      // Line 11: Total credits (7a through 10)
      const schedJ11 = num('schedJ_7a') + num('schedJ_7b') + num('schedJ_8') + num('schedJ_9') + num('schedJ_10');
      if (d.schedJ_11 !== Math.round(schedJ11 * 100) / 100) { d.schedJ_11 = Math.round(schedJ11 * 100) / 100; changed = true; }
      // Line 12: line 6 minus line 11
      const schedJ12 = schedJ6 - schedJ11;
      if (d.schedJ_12 !== Math.round(schedJ12 * 100) / 100) { d.schedJ_12 = Math.round(schedJ12 * 100) / 100; changed = true; }
      // Line 19a: Total tax
      const schedJ19a = schedJ12 + num('schedJ_13') + num('schedJ_14') + num('schedJ_15') + num('schedJ_16') + num('schedJ_17') + num('schedJ_18');
      if (d.schedJ_19a !== Math.round(schedJ19a * 100) / 100) { d.schedJ_19a = Math.round(schedJ19a * 100) / 100; changed = true; }
      // Line 26: Total payments (20a through 25)
      const schedJ26 = num('schedJ_20a') + num('schedJ_20b') + num('schedJ_21') - num('schedJ_22') + num('schedJ_23') + num('schedJ_24') + num('schedJ_25');
      if (d.schedJ_26 !== Math.round(schedJ26 * 100) / 100) { d.schedJ_26 = Math.round(schedJ26 * 100) / 100; changed = true; }
      // Line 28: Total credits
      const schedJ28 = schedJ26 + num('schedJ_27');
      if (d.schedJ_28 !== Math.round(schedJ28 * 100) / 100) { d.schedJ_28 = Math.round(schedJ28 * 100) / 100; changed = true; }
      // Line 31: Total payments, credits and section 1082
      const schedJ31 = schedJ28 + num('schedJ_29') + num('schedJ_30');
      if (d.schedJ_31 !== Math.round(schedJ31 * 100) / 100) { d.schedJ_31 = Math.round(schedJ31 * 100) / 100; changed = true; }

      // === Schedule L auto-computed subtotals ===
      // Line 14: Total assets (lines 1-13, noting 2b/10b/11b are subtractive)
      const totalAssetsBOY = num('cashBOY') + num('accountsReceivableBOY') - num('badDebtAllowanceBOY')
        + num('inventoriesBOY') + num('usGovObligationsBOY') + num('taxExemptSecuritiesBOY')
        + num('otherCurrentAssetsBOY') + num('loansToStockholdersBOY') + num('mortgageRealEstateLoansBOY')
        + num('otherInvestmentsBOY') + num('buildingsBOY') - num('accumulatedDepBOY')
        + num('depletableAssetsBOY') - num('accumulatedDepletionBOY') + num('landBOY') + num('otherAssetsBOY');
      if (d.totalAssetsBOY !== Math.round(totalAssetsBOY * 100) / 100) { d.totalAssetsBOY = Math.round(totalAssetsBOY * 100) / 100; changed = true; }

      const totalAssetsEOY = num('cashEOY') + num('accountsReceivableEOY') - num('badDebtAllowanceEOY')
        + num('inventoriesEOY') + num('usGovObligationsEOY') + num('taxExemptSecuritiesEOY')
        + num('otherCurrentAssetsEOY') + num('loansToStockholdersEOY') + num('mortgageRealEstateLoansEOY')
        + num('otherInvestmentsEOY') + num('buildingsEOY') - num('accumulatedDepEOY')
        + num('depletableAssetsEOY') - num('accumulatedDepletionEOY') + num('landEOY') + num('otherAssetsEOY');
      if (d.totalAssetsEOY !== Math.round(totalAssetsEOY * 100) / 100) { d.totalAssetsEOY = Math.round(totalAssetsEOY * 100) / 100; changed = true; }

      // Line 21: Total liabilities (lines 15-20)
      const totalLiabBOY = num('accountsPayableBOY') + num('mortgagesLT1yrBOY') + num('otherCurrentLiabBOY')
        + num('loansFromShareholdersBOY') + num('mortgagesGTE1yrBOY') + num('otherLiabilitiesBOY');
      if (d.totalLiabilitiesBOY !== Math.round(totalLiabBOY * 100) / 100) { d.totalLiabilitiesBOY = Math.round(totalLiabBOY * 100) / 100; changed = true; }

      const totalLiabEOY = num('accountsPayableEOY') + num('mortgagesLT1yrEOY') + num('otherCurrentLiabEOY')
        + num('loansFromShareholdersEOY') + num('mortgagesGTE1yrEOY') + num('otherLiabilitiesEOY');
      if (d.totalLiabilitiesEOY !== Math.round(totalLiabEOY * 100) / 100) { d.totalLiabilitiesEOY = Math.round(totalLiabEOY * 100) / 100; changed = true; }

      // Line 28: Total liabilities and stockholders' equity (line 21 + lines 22-26 - line 27)
      const totalLiabEquityBOY = totalLiabBOY + num('capitalStockBOY') + num('additionalPaidInCapBOY')
        + num('retainedEarningsApprBOY') + num('retainedEarningsBOY') + num('adjustmentsSHEquityBOY') - num('lessCSSTreasuryBOY');
      if (d.totalLiabEquityBOY !== Math.round(totalLiabEquityBOY * 100) / 100) { d.totalLiabEquityBOY = Math.round(totalLiabEquityBOY * 100) / 100; changed = true; }

      const totalLiabEquityEOY = totalLiabEOY + num('capitalStockEOY') + num('additionalPaidInCapEOY')
        + num('retainedEarningsApprEOY') + num('retainedEarningsEOY') + num('adjustmentsSHEquityEOY') - num('lessCSSTreasuryEOY');
      if (d.totalLiabEquityEOY !== Math.round(totalLiabEquityEOY * 100) / 100) { d.totalLiabEquityEOY = Math.round(totalLiabEquityEOY * 100) / 100; changed = true; }

    } else if (activeFiling.formType === '5472') {
      // Total Received = sum of lines 9-19
      const tr = num('salesOfStock') + num('salesOfTangible') + num('salesOfPropertyRights') + num('platformContribution') + num('costSharingReceived') + num('compensationReceived') + num('commissionsReceived') + num('rentsReceived') + num('interestReceived') + num('premiumsReceived') + num('otherReceived');
      if (d.totalAmountsReceived !== Math.round(tr * 100) / 100) { d.totalAmountsReceived = Math.round(tr * 100) / 100; changed = true; }
      // Total Paid = sum of lines 23-33
      const tp = num('purchasesOfStock') + num('purchasesOfTangible') + num('purchasesOfPropertyRights') + num('platformContributionPaid') + num('costSharingPaid') + num('compensationPaid') + num('commissionsPaid') + num('rentsPaid') + num('interestPaid') + num('premiumsPaid') + num('otherPaid');
      if (d.totalAmountsPaid !== Math.round(tp * 100) / 100) { d.totalAmountsPaid = Math.round(tp * 100) / 100; changed = true; }
    }

    if (changed) setFormData(d);
  }, [formData, activeFiling]);

  /* ====== LIST VIEW ====== */
  if (view === 'list') {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{L(UI.taxFilings)}</h1>
            <p className="text-sm text-gray-500 mt-1">{L(UI.taxSubtitle)}</p>
          </div>
          <button onClick={() => setShowNewDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium">
            <Plus className="w-4 h-4" /> {L(UI.newFiling)}
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-800">{errorMsg}</div>
            <button onClick={() => setErrorMsg('')} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
          </div>
        )}

        {showNewDialog && (
          <div className="bg-white border border-teal-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-900">{L(UI.createNewFiling)}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{L(UI.formType)}</label>
                <select value={newFormType} onChange={e => setNewFormType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                  {FORM_TYPES.map(ft => (<option key={ft.value} value={ft.value}>{ft.label}</option>))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{L(UI.taxYear)}</label>
                <input type="number" value={newTaxYear} onChange={e => setNewTaxYear(e.target.value)} min={2000} max={2030}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
              </div>
              <div className="flex items-end gap-2">
                <button onClick={handleCreate} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">{L(UI.createBtn)}</button>
                <button onClick={() => setShowNewDialog(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">{L(UI.cancelBtn)}</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          </div>
        ) : filings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">{L(UI.noFilings)}</p>
            <p className="text-gray-400 text-sm mt-1">{L(UI.noFilingsHint)}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{L(UI.form)}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{L(UI.company)}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{L(UI.year)}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{L(UI.status)}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{L(UI.created)}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{L(UI.actions)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filings.map(f => {
                    const st = STATUS_MAP[f.status] || STATUS_MAP.draft;
                    const StIcon = st.icon;
                    return (
                      <tr key={f.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openFiling(f)}>
                        <td className="px-4 py-3"><span className="font-medium text-gray-900">Form {f.formType}</span></td>
                        <td className="px-4 py-3 text-sm text-gray-600">{f.company?.shortName || f.company?.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{f.taxYear}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>
                            <StIcon className="w-3 h-3" /> {L(st.labels)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(f.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-UY')}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={e => { e.stopPropagation(); handleDelete(f.id); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ====== FORM EDITOR VIEW ====== */
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('list'); setActiveFiling(null); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Form {activeFiling?.formType} — {activeFiling?.taxYear}</h1>
            <p className="text-sm text-gray-500">{activeFiling?.company?.name}</p>
          </div>
          {activeFiling && (() => {
            const st = STATUS_MAP[activeFiling.status] || STATUS_MAP.draft;
            const StIcon = st.icon;
            return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${st.bg} ${st.color}`}><StIcon className="w-3 h-3" /> {L(st.labels)}</span>;
          })()}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleAutoPopulate} disabled={autoLoading} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 text-sm font-medium disabled:opacity-50 transition-colors">
            {autoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {L(UI.autoPopulate)}
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 text-sm font-medium cursor-pointer transition-colors">
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {L(UI.extractFiles)}
            <input type="file" accept=".pdf,.csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" disabled={extracting} multiple />
          </label>
          <button onClick={handleGeneratePDF} disabled={pdfGenerating} className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 text-sm font-medium disabled:opacity-50 transition-colors">
            {pdfGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {L(UI.generatePdf)}
          </button>
          <button onClick={() => handleSave()} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {L(UI.save)}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-800">{errorMsg}</div>
          <button onClick={() => setErrorMsg('')} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {extractionNotes && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 mb-1">{L(UI.extractionCompleted)}</p>
              <pre className="text-xs text-blue-800 whitespace-pre-wrap font-mono leading-relaxed">{extractionNotes}</pre>
            </div>
            <button onClick={() => { setExtractionNotes(''); setCategorySummary(null); setExtractedTransactions(null); setShowTransactions(false); }} className="text-blue-400 hover:text-blue-600"><X className="w-4 h-4" /></button>
          </div>

          {categorySummary && (
            <div className="border-t border-blue-200 pt-3">
              <p className="text-xs font-semibold text-blue-900 mb-2">{L(UI.irsCategorySummary)}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(categorySummary).sort(([, a], [, b]) => b.total - a.total).map(([cat, { total, count }]) => (
                  <div key={cat} className={`rounded-lg p-2 ${cat === 'Unclassified' || cat.startsWith('Needs Review') ? 'bg-amber-50 border border-amber-200' : 'bg-white/60'}`}>
                    <p className={`text-xs ${cat === 'Unclassified' || cat.startsWith('Needs Review') ? 'text-amber-600' : 'text-blue-600'}`}>{cat}</p>
                    <p className="text-sm font-semibold text-blue-900">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    <p className="text-[10px] text-gray-400">{count} txns</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {extractedTransactions && extractedTransactions.length > 0 && (
            <div className="border-t border-blue-200 pt-3">
              <button onClick={() => setShowTransactions(!showTransactions)} className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1">
                {showTransactions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showTransactions ? L(UI.hide) : L(UI.view)} {extractedTransactions.length} {L(UI.extractedTxns)}
              </button>
              {showTransactions && (
                <div className="mt-2 max-h-64 overflow-y-auto border border-blue-100 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-blue-100/50 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1 text-blue-800">{L(UI.txnDate)}</th>
                        <th className="text-left px-2 py-1 text-blue-800">{L(UI.txnDesc)}</th>
                        <th className="text-right px-2 py-1 text-blue-800">{L(UI.txnAmount)}</th>
                        <th className="text-left px-2 py-1 text-blue-800">{L(UI.txnCategory)}</th>
                        <th className="text-center px-2 py-1 text-blue-800">{L(UI.txnConf)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50">
                      {extractedTransactions.map((t: any, i: number) => {
                        const isUnclassified = t.irsCategory === 'Unclassified' || (t.irsCategory || '').startsWith('Needs Review');
                        return (
                          <tr key={i} className={isUnclassified ? 'bg-amber-50/50' : ''}>
                            <td className="px-2 py-1 text-gray-600 whitespace-nowrap">{t.date}</td>
                            <td className="px-2 py-1 text-gray-800 max-w-[200px] truncate" title={t.description}>{t.description}</td>
                            <td className={`px-2 py-1 text-right font-mono whitespace-nowrap ${t.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              {t.amount >= 0 ? '+' : ''}{t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className={`px-2 py-1 ${isUnclassified ? 'text-amber-700 font-medium' : 'text-gray-600'}`}>{t.irsCategory}</td>
                            <td className="px-2 py-1 text-center">
                              <span className={`inline-block w-2 h-2 rounded-full ${t.confidence === 'high' ? 'bg-emerald-500' : t.confidence === 'medium' ? 'bg-amber-400' : 'bg-red-400'}`} title={t.confidence} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Status workflow */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500 mr-2">{L(UI.changeStatus)}</span>
          {Object.entries(STATUS_MAP).map(([key, conf]) => {
            const Icon = conf.icon;
            const isActive = activeFiling?.status === key;
            return (
              <button key={key} onClick={() => handleSave(key)} disabled={saving}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${isActive ? `${conf.bg} ${conf.color} border-current ring-2 ring-offset-1` : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
                <Icon className="w-3 h-3" /> {L(conf.labels)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Sections - Accordion */}
      <div className="space-y-3">
        {sections.map((section) => {
          const SIcon = section.icon;
          const isExpanded = expandedSections[section.id] ?? false;
          const filledCount = section.fields.filter(f => {
            const v = formData[f.key];
            return v !== undefined && v !== null && v !== '' && v !== 0;
          }).length;
          return (
            <div key={section.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => toggleSection(section.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                    <SIcon className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-900 text-sm">{L(section.titles)}</h3>
                    <p className="text-xs text-gray-400">{filledCount}/{section.fields.length} {L(UI.fieldsCompleted)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {filledCount === section.fields.length && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    {section.fields.map(field => {
                      const value = formData[field.key] ?? '';
                      const isAuto = isAutoField(field.key);
                      return (
                        <div key={field.key} className="space-y-1">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            {L(field.labels)}
                            {isAuto && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">AUTO</span>}
                            {field.computed && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">CALC</span>}
                          </label>
                          {field.type === 'select' ? (
                            <select value={String(value)} onChange={e => updateField(field.key, e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                              <option value="">{L(UI.select)}</option>
                              {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : field.type === 'money' ? (
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                              <input type="number" value={value}
                                onChange={e => !field.computed && updateField(field.key, e.target.value ? parseFloat(e.target.value) : '')}
                                readOnly={field.computed}
                                placeholder="0" step="0.01"
                                className={`w-full border rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${field.computed ? 'border-gray-200 bg-gray-50 text-gray-700 font-semibold cursor-default' : isAuto ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-300'}`} />
                            </div>
                          ) : (
                            <input type={field.type === 'date' ? 'date' : 'text'} value={String(value)} onChange={e => updateField(field.key, e.target.value)}
                              placeholder="—"
                              className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${isAuto ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-300'}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Notes */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 text-sm mb-3">{L(UI.notes)}</h3>
        <textarea value={formData._notes || ''} onChange={e => updateField('_notes', e.target.value)} rows={3}
          placeholder={L(UI.notesPlaceholder)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-y" />
      </div>

      {autoData && autoData._transactionCount !== undefined && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
          <strong>{L(UI.systemData)}</strong> {autoData._transactionCount} {L(UI.transactionsFound)}
          {autoData._incomeTransactions !== undefined && ` (${autoData._incomeTransactions} ${L(UI.income)}, ${autoData._expenseTransactions} ${L(UI.expenses)})`}
        </div>
      )}
    </div>
  );
}