export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

function fmt(v: any) {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  if (isNaN(n) || n === 0) return '';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function scheduleLRow(line: string, label: string, boyKey: string, eoyKey: string, data: Record<string,any>, cls?: string) {
  return `<tr class="${cls || ''}">
    <td class="ln">${line}</td>
    <td class="desc">${label}</td>
    <td class="amt">${fmt(data[boyKey])}</td>
    <td class="amt">${fmt(data[eoyKey])}</td>
  </tr>`;
}

function generate1120HTML(d: Record<string, any>, taxYear: number, companyName: string) {
  const css = `
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: Letter; margin: 0.4in 0.5in; }
  body { font-family: 'Arial Narrow', Arial, Helvetica, sans-serif; font-size: 9px; color: #000; line-height: 1.3; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }

  /* IRS Header */
  .irs-header { display: flex; border: 2px solid #000; margin-bottom: 6px; }
  .irs-left { width: 18%; border-right: 2px solid #000; padding: 4px; text-align: center; display:flex; flex-direction:column; justify-content:center; }
  .irs-left .form-num { font-size: 22px; font-weight: bold; }
  .irs-left .dept { font-size: 7px; line-height: 1.2; }
  .irs-center { width: 62%; padding: 4px 8px; text-align: center; display:flex; flex-direction:column; justify-content:center; }
  .irs-center .title { font-size: 14px; font-weight: bold; }
  .irs-center .subtitle { font-size: 8px; margin-top: 2px; }
  .irs-right { width: 20%; border-left: 2px solid #000; padding: 4px; text-align: center; display:flex; flex-direction:column; justify-content:center; align-items:center; }
  .irs-right .omb { font-size: 8px; }
  .irs-right .year { font-size: 16px; font-weight: bold; }

  /* Corp info block */
  .corp-info { border: 1px solid #000; margin-bottom: 6px; font-size: 9px; }
  .corp-info td { padding: 2px 4px; border-bottom: 1px solid #999; }
  .corp-info .label { font-size: 7px; color: #333; text-transform: uppercase; }
  .corp-info .val { font-weight: bold; font-size: 10px; }

  /* Section tables */
  .sec { border: 1px solid #000; margin-bottom: 5px; font-size: 9px; }
  .sec-title { background: #000; color: #fff; padding: 3px 6px; font-weight: bold; font-size: 10px; letter-spacing: 0.5px; }
  .sec table { width: 100%; border-collapse: collapse; }
  .sec td, .sec th { padding: 2px 4px; border-bottom: 1px solid #ddd; vertical-align: top; }
  .sec .ln { width: 30px; text-align: right; font-weight: bold; padding-right: 4px; color: #333; }
  .sec .desc { }
  .sec .amt { width: 90px; text-align: right; font-weight: bold; font-family: 'Courier New', monospace; }
  .sec .total td { border-top: 2px solid #000; font-weight: bold; background: #f5f5f5; }
  .sec .sub td { background: #fafaf5; }

  /* Schedule L special grid */
  .schedL table { font-size: 8.5px; }
  .schedL th { background: #e8e8e8; font-weight: bold; font-size: 8px; text-align: center; padding: 3px 4px; border: 1px solid #999; }
  .schedL td { border: 1px solid #ddd; padding: 1.5px 3px; }
  .schedL .ln { width: 24px; text-align: center; font-weight: bold; }
  .schedL .desc { font-size: 8px; }
  .schedL .amt { width: 80px; text-align: right; font-family: 'Courier New', monospace; font-size: 8.5px; }
  .schedL .section-label td { background: #f0f0f0; font-weight: bold; font-size: 9px; border-top: 1.5px solid #000; }
  .schedL .total td { border-top: 2px solid #000; font-weight: bold; background: #f0f0e8; }

  /* Schedule K */
  .schedK table td { padding: 2px 4px; }
  .schedK .q { width: 30px; font-weight: bold; text-align: right; padding-right: 4px; }
  .schedK .ans { width: 60px; text-align: center; font-weight: bold; }

  .footer { text-align: center; font-size: 7px; color: #666; margin-top: 8px; border-top: 1px solid #999; padding-top: 4px; }
  .watermark { text-align: center; font-size: 8px; color: #999; margin-top: 4px; }
  `;

  // Helper for income/deduction rows
  function r(line: string, label: string, key: string, cls?: string) {
    return `<tr class="${cls || ''}">
      <td class="ln">${line}</td>
      <td class="desc">${label}</td>
      <td class="amt">${fmt(d[key])}</td>
    </tr>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>

<!-- PAGE 1: Header + Income + Deductions + Tax -->
<div class="page">

  <div class="irs-header">
    <div class="irs-left">
      <div class="form-num">1120</div>
      <div class="dept">Department of the Treasury<br>Internal Revenue Service</div>
    </div>
    <div class="irs-center">
      <div class="title">U.S. Corporation Income Tax Return</div>
      <div class="subtitle">For calendar year ${taxYear} or tax year beginning _________, ${taxYear}, ending _________, 20__</div>
      <div class="subtitle" style="margin-top:2px;">▶ Go to www.irs.gov/Form1120 for instructions and the latest information.</div>
    </div>
    <div class="irs-right">
      <div class="omb">OMB No. 1545-0123</div>
      <div class="year">${taxYear}</div>
    </div>
  </div>

  <table class="corp-info" style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:60%;">
        <div class="label">Name</div>
        <div class="val">${d.corporationName || companyName}</div>
      </td>
      <td style="width:40%;border-left:1px solid #999;">
        <div class="label">Employer identification number</div>
        <div class="val">${d.ein || ''}</div>
      </td>
    </tr>
    <tr>
      <td>
        <div class="label">Number, street, and room or suite no.</div>
        <div class="val">${d.address || ''}</div>
      </td>
      <td style="border-left:1px solid #999;">
        <div class="label">Date incorporated</div>
        <div class="val">${d.dateIncorporated || ''}</div>
      </td>
    </tr>
    <tr>
      <td>
        <div class="label">City or town, state or province, country, and ZIP</div>
        <div class="val">${d.cityStateZip || ''}</div>
      </td>
      <td style="border-left:1px solid #999;">
        <div class="label">Total assets (see instructions)</div>
        <div class="val">${fmt(d.totalAssets) ? '$' + fmt(d.totalAssets) : ''}</div>
      </td>
    </tr>
  </table>

  <div class="sec">
    <div class="sec-title">Income</div>
    <table>
      ${r('1a', 'Gross receipts or sales', 'grossReceipts')}
      ${r('1b', 'Returns and allowances', 'returnsAllowances')}
      ${r('1c', 'Balance. Subtract line 1b from line 1a', 'line1c', 'sub')}
      ${r('2', 'Cost of goods sold (attach Form 1125-A)', 'costOfGoodsSold')}
      ${r('3', 'Gross profit. Subtract line 2 from line 1c', 'grossProfit', 'sub')}
      ${r('4', 'Dividends and inclusions (Schedule C, line 23)', 'dividends')}
      ${r('5', 'Interest', 'interestIncome')}
      ${r('6', 'Gross rents', 'grossRents')}
      ${r('7', 'Gross royalties', 'grossRoyalties')}
      ${r('8', 'Capital gain net income (attach Schedule D)', 'capitalGainNet')}
      ${r('9', 'Net gain or (loss) from Form 4797, Part II, line 17', 'netGainLoss')}
      ${r('10', 'Other income (see instructions—attach statement)', 'otherIncome')}
      ${r('11', 'Total income. Add lines 3 through 10', 'totalIncome', 'total')}
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Deductions</div>
    <table>
      ${r('12', 'Compensation of officers (see instructions—attach Form 1125-E)', 'officerCompensation')}
      ${r('13', 'Salaries and wages (less employment credits)', 'salariesAndWages')}
      ${r('14', 'Repairs and maintenance', 'repairsAndMaintenance')}
      ${r('15', 'Bad debts', 'badDebts')}
      ${r('16', 'Rents', 'rents')}
      ${r('17', 'Taxes and licenses', 'taxesAndLicenses')}
      ${r('18', 'Interest (see instructions)', 'interestExpense')}
      ${r('19', 'Charitable contributions', 'charitableContributions')}
      ${r('20', 'Depreciation from Form 4562 not claimed on Form 1125-A or elsewhere on return', 'depreciation')}
      ${r('21', 'Depletion', 'depletion')}
      ${r('22', 'Advertising', 'advertising')}
      ${r('23', 'Pension, profit-sharing, etc., plans', 'pensionProfit')}
      ${r('24', 'Employee benefit programs', 'employeeBenefits')}
      ${r('25', 'Reserved for future use', 'domesticProdDeduction')}
      ${r('26', 'Other deductions (attach statement)', 'otherDeductions')}
      ${r('27', 'Total deductions. Add lines 12 through 26', 'totalDeductions', 'total')}
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Tax Computation</div>
    <table>
      ${r('28', 'Taxable income before net operating loss deduction and special deductions. Subtract line 27 from line 11', 'taxableIncome')}
      ${r('29a', 'Net operating loss deduction (see instructions)', 'nolDeduction')}
      ${r('29b', 'Special deductions (Schedule C, line 24)', 'specialDeductions')}
      ${r('29c', 'Add lines 29a and 29b', 'line29cTotal', 'sub')}
      ${r('30', 'Taxable income. Subtract line 29c from line 28', 'finalTaxableIncome', 'sub')}
      ${r('31', 'Total tax (Schedule J, Part I, line 11)', 'totalTax')}
      ${r('33', 'Total payments, credits, and section 965 net tax liability', 'totalPayments')}
      ${r('34', 'Estimated tax penalty (see instructions)', 'estimatedTaxPenalty')}
      ${r('35', 'Amount owed. If line 33 is smaller than the total of lines 31 and 34, enter amount owed', 'amountOwed', 'total')}
      ${r('36', 'Overpayment. If line 33 is larger than the total of lines 31 and 34, enter amount overpaid', 'overpayment')}
      ${r('37a', 'Credited to next year estimated tax', 'creditToNextYear')}
      ${r('37b', 'Refunded', 'refunded')}
    </table>
  </div>

  <div class="footer">
    For Paperwork Reduction Act Notice, see separate instructions. &nbsp;&nbsp; Cat. No. 11450Q &nbsp;&nbsp; Form <b>1120</b> (${taxYear})
  </div>
</div>

<!-- PAGE 2: Schedule C — Dividends, Inclusions, and Special Deductions -->
<div class="page">
  <div style="text-align:center;font-weight:bold;font-size:11px;margin-bottom:6px;border-bottom:2px solid #000;padding-bottom:4px;">
    Form 1120 (${taxYear}) &nbsp;&nbsp; ${d.corporationName || companyName} &nbsp;&nbsp; EIN: ${d.ein || '___'} &nbsp;&nbsp; Page <b>2</b>
  </div>

  <div class="sec">
    <div class="sec-title">Schedule C — Dividends, Inclusions, and Special Deductions <span style="font-weight:normal;font-size:8px;">(see instructions)</span></div>
    <table>
      <tr style="background:#e8e8e8;"><th class="ln"></th><th style="text-align:left;">Description</th><th class="amt">(a) Dividends and inclusions</th></tr>
      ${r('1', 'Dividends from less-than-20%-owned domestic corporations', 'schedC_1')}
      ${r('2', 'Dividends from 20%-or-more-owned domestic corporations', 'schedC_2')}
      ${r('3', 'Dividends on certain debt-financed stock of domestic and foreign corporations', 'schedC_3')}
      ${r('4', 'Dividends on certain preferred stock of less-than-20%-owned public utilities', 'schedC_4')}
      ${r('5', 'Dividends on certain preferred stock of 20%-or-more-owned public utilities', 'schedC_5')}
      ${r('6', 'Dividends from less-than-20%-owned foreign corporations and certain FSCs', 'schedC_6')}
      ${r('7', 'Dividends from 20%-or-more-owned foreign corporations and certain FSCs', 'schedC_7')}
      ${r('8', 'Dividends from wholly owned foreign subsidiaries', 'schedC_8')}
      ${r('9', '<b>Subtotal.</b> Add lines 1 through 8. See instructions for limitations', 'schedC_9', 'sub')}
      ${r('10', 'Dividends from domestic corporations received by a small business investment company operating under the Small Business Investment Act of 1958', 'schedC_10')}
      ${r('11', 'Dividends from affiliated group members', 'schedC_11')}
      ${r('12', 'Dividends from certain FSCs', 'schedC_12')}
      ${r('13', 'Foreign-source portion of dividends received from a specified 10%-owned foreign corporation', 'schedC_13')}
      ${r('14', 'Dividends from foreign corporations not included on line 3, 6, 7, 8, 11, 12, or 13', 'schedC_14')}
      ${r('15', 'Reserved for future use', 'schedC_15')}
      ${r('16a', 'Subpart F inclusions derived from the sale by a CFC of the stock of a lower-tier foreign corporation', 'schedC_16a')}
      ${r('16b', 'Subpart F inclusions derived from hybrid dividends of tiered corporations', 'schedC_16b')}
      ${r('16c', 'Other inclusions from CFCs under subpart F', 'schedC_16c')}
      ${r('17', 'Global Intangible Low-Taxed Income (GILTI) (attach Form(s) 5471 and Form 8992)', 'schedC_17')}
      ${r('18', 'Gross-up for foreign taxes deemed paid', 'schedC_18')}
      ${r('19', 'IC-DISC and former DISC dividends not included on line 1, 2, or 3', 'schedC_19')}
      ${r('20', 'Other dividends', 'schedC_20')}
      ${r('21', 'Deduction for dividends paid on certain preferred stock of public utilities', 'schedC_21')}
      ${r('22', 'Section 250 deduction (attach Form 8993)', 'schedC_22')}
      ${r('23', '<b>Total dividends and inclusions.</b> Add column (a), lines 9 through 20. Enter here and on page 1, line 4', 'schedC_23', 'total')}
      ${r('24', '<b>Total special deductions.</b> Add column (c), lines 9 through 22. Enter here and on page 1, line 29b', 'schedC_24', 'total')}
    </table>
  </div>

  <div class="footer">
    Form <b>1120</b> (${taxYear}) &nbsp;&nbsp; Page 2
  </div>
</div>

<!-- PAGE 3: Schedule J — Tax Computation and Payment -->
<div class="page">
  <div style="text-align:center;font-weight:bold;font-size:11px;margin-bottom:6px;border-bottom:2px solid #000;padding-bottom:4px;">
    Form 1120 (${taxYear}) &nbsp;&nbsp; ${d.corporationName || companyName} &nbsp;&nbsp; EIN: ${d.ein || '___'} &nbsp;&nbsp; Page <b>3</b>
  </div>

  <div class="sec">
    <div class="sec-title">Schedule J — Tax Computation and Payment <span style="font-weight:normal;font-size:8px;">(see instructions)</span></div>
    <table>
      <tr style="background:#e8e8e8;"><td colspan="2" style="font-weight:bold;padding:3px 6px;">Part I — Tax Computation</td><td class="amt"></td></tr>
      ${r('1a', 'Income tax (see instructions)', 'schedJ_1a')}
      ${r('1b', 'Tax from Form 1100-S (see instructions)', 'schedJ_1b')}
      ${r('2', 'Section 1291 tax (from Form 8621)', 'schedJ_2')}
      ${r('3', 'Tax adjustment from Form 8621', 'schedJ_3')}
      ${r('4', 'Additional tax under section 1813', 'schedJ_4')}
      ${r('5a', 'Base erosion minimum tax amount from Form 8991', 'schedJ_5a')}
      ${r('5b', 'Amount from Form 4626, Part II, line 8', 'schedJ_5b')}
      ${r('5c', 'Other chapter 1 tax', 'schedJ_5c')}
      ${r('6', '<b>Total income tax.</b> Add lines 1a through 5c', 'schedJ_6', 'sub')}
      ${r('7a', 'Corporate alternative minimum tax from Form 4626', 'schedJ_7a')}
      ${r('7b', 'Credit from Form 4466 (see instructions)', 'schedJ_7b')}
      ${r('8', 'Credit for prior year minimum tax (attach Form 8827)', 'schedJ_8')}
      ${r('9', 'Bond credits from Form 8912', 'schedJ_9')}
      ${r('10', 'Adjustment from Form 8576', 'schedJ_10')}
      ${r('11', '<b>Total credits.</b> Add lines 7a through 10', 'schedJ_11', 'sub')}
      ${r('12', 'Subtract line 11 from line 6', 'schedJ_12', 'sub')}
      ${r('13', 'Recapture of investment credit (attach Form 4255)', 'schedJ_13')}
      ${r('14', 'Recapture of low-income housing credit (attach Form 8611)', 'schedJ_14')}
      ${r('15', 'Interest due under the look-back method—income forecast method (attach Form 8866)', 'schedJ_15')}
      ${r('16', 'Interest due under section 453A(c) and/or section 453(l)', 'schedJ_16')}
      ${r('17', 'Interest due under section 453(l)(3)', 'schedJ_17')}
      ${r('18', 'Other (see instructions—attach statement)', 'schedJ_18')}
      ${r('19a', '<b>Total tax before deferred taxes.</b> Add lines 12 through 18', 'schedJ_19a', 'total')}
      ${r('19b', 'Deferred tax on undistributed earnings of a qualified electing fund', 'schedJ_19b')}
      ${r('19c', 'Deferred LIFO recapture tax (section 1363(d))', 'schedJ_19c')}
      <tr style="background:#e8e8e8;"><td colspan="2" style="font-weight:bold;padding:3px 6px;">Part II — Payments and Refundable Credits</td><td class="amt"></td></tr>
      ${r('20a', 'Prior year overpayment credited to current year', 'schedJ_20a')}
      ${r('20b', 'Prior year(s) overpayment credited to the current year', 'schedJ_20b')}
      ${r('21', 'Current year\'s estimated tax payments', 'schedJ_21')}
      ${r('22', 'Current year\'s refund applied for on Form 4466', 'schedJ_22')}
      ${r('23', 'Reserved for future use', 'schedJ_23')}
      ${r('24', 'Tax deposited with Form 7004', 'schedJ_24')}
      ${r('25', 'Withholding (see instructions)', 'schedJ_25')}
      ${r('26', '<b>Total payments.</b> Combine lines 20a through 25', 'schedJ_26', 'sub')}
      ${r('27', 'Refundable credits', 'schedJ_27')}
      ${r('28', '<b>Total credits.</b>', 'schedJ_28', 'sub')}
      ${r('29', 'Elective payment election amount (from Form 3800)', 'schedJ_29')}
      ${r('30', 'Section 1082 applicable net tax liability', 'schedJ_30')}
      ${r('31', '<b>Total payments, credits, and section 1082 net tax liability.</b> Enter here and on page 1, line 33', 'schedJ_31', 'total')}
    </table>
  </div>

  <div class="footer">
    Form <b>1120</b> (${taxYear}) &nbsp;&nbsp; Page 3
  </div>
</div>

<!-- PAGE 4: Schedule K — Other Information -->
<div class="page">
  <div style="text-align:center;font-weight:bold;font-size:11px;margin-bottom:6px;border-bottom:2px solid #000;padding-bottom:4px;">
    Form 1120 (${taxYear}) &nbsp;&nbsp; ${d.corporationName || companyName} &nbsp;&nbsp; EIN: ${d.ein || '___'} &nbsp;&nbsp; Page <b>4</b>
  </div>

  <div class="sec schedK">
    <div class="sec-title">Schedule K — Other Information <span style="font-weight:normal;font-size:8px;">(see instructions)</span></div>
    <table>
      <tr style="background:#f5f5f5;"><td class="q"></td><td style="font-weight:bold;font-size:8px;">Question</td><td class="ans" style="font-weight:bold;font-size:8px;">Yes / No</td></tr>
      <tr><td class="q">1</td><td>Check accounting method: <b>${d.accountingMethod || '___'}</b> ${d.schedK_q1_other ? '(Other: ' + d.schedK_q1_other + ')' : ''}</td><td class="ans"></td></tr>
      <tr><td class="q">2</td><td>a Business activity code no.: <b>${d.schedK_q2_code || d.businessActivityCode || '___'}</b> &nbsp; b Business activity: <b>${d.schedK_q2_activity || d.businessActivity || '___'}</b> &nbsp; c Product or service: <b>${d.schedK_q2_product || d.productOrService || '___'}</b></td><td class="ans"></td></tr>
      <tr><td class="q">3</td><td>Is the corporation a subsidiary in an affiliated group or a parent-subsidiary controlled group? ${d.schedK_q3_name ? 'Parent: <b>' + d.schedK_q3_name + '</b>' : ''}</td><td class="ans">${d.schedK_q3 || ''}</td></tr>
      <tr><td class="q">4a</td><td>At the end of the tax year, did any foreign or domestic corporation, partnership, trust, or tax-exempt organization own directly 20% or more, or own, directly or indirectly, 50% or more of the total voting power? If "Yes," complete Part I of Schedule G (Form 1120).</td><td class="ans">${d.foreignOwnership || ''}</td></tr>
      <tr><td class="q">4b</td><td>Did any individual or estate own directly 20% or more, or own, directly or indirectly, 50% or more of the total voting power? If "Yes," complete Part II of Schedule G (Form 1120).</td><td class="ans">${d.schedK_q4b || ''}</td></tr>
      <tr><td class="q">5a</td><td>At the end of the tax year, did the corporation own directly 20% or more, or own, directly or indirectly, 50% or more of the total voting power of any foreign or domestic corporation not included on Form 851? ${d.schedK_q5a_details ? '<br><span style="font-size:8px;color:#333;">Details: ' + d.schedK_q5a_details + '</span>' : ''}</td><td class="ans">${d.schedK_q5 || ''}</td></tr>
      <tr><td class="q">5b</td><td>Own directly an interest of 20% or more, or own, directly or indirectly, an interest of 50% or more in any partnership or in the beneficial interest of a trust? ${d.schedK_q5b_details ? '<br><span style="font-size:8px;color:#333;">Details: ' + d.schedK_q5b_details + '</span>' : ''}</td><td class="ans">${d.schedK_q6 || ''}</td></tr>
      <tr><td class="q">6</td><td>During this tax year, did the corporation pay dividends (other than stock dividends and distributions in exchange for stock) in excess of the corporation's current and accumulated earnings and profits? See sections 301 and 316.</td><td class="ans">${d.schedK_q7 || ''}</td></tr>
      <tr><td class="q">7</td><td>At any time during this tax year, did one foreign person own, directly or indirectly, at least 25% of the total voting power or at least 25% of the total value of all classes of the corporation's stock? ${d.schedK_q8a ? '&nbsp; (a) Pct: <b>' + d.schedK_q8a + '%</b>' : ''} ${d.schedK_q8b ? '&nbsp; (b) Country: <b>' + d.schedK_q8b + '</b>' : ''} ${d.schedK_q8c ? '&nbsp; (c) Forms 5472: <b>' + d.schedK_q8c + '</b>' : ''}</td><td class="ans">${d.schedK_q8 || ''}</td></tr>
      <tr><td class="q">8</td><td>Check this box if the corporation issued publicly offered debt instruments with original issue discount.</td><td class="ans">${d.schedK_q10 || ''}</td></tr>
      <tr><td class="q">9</td><td>Enter the amount of tax-exempt interest received or accrued during this tax year: <b>${fmt(d.schedK_q11a) ? '$' + fmt(d.schedK_q11a) : '___'}</b></td><td class="ans"></td></tr>
      <tr><td class="q">10</td><td>Enter the number of shareholders at end of tax year (if 100 or fewer): <b>${d.schedK_q11b || '___'}</b></td><td class="ans"></td></tr>
      <tr><td class="q">11</td><td>If the corporation has an NOL for the tax year and is electing to forego the carryback period, check here (see instructions).</td><td class="ans">${d.schedK_q12 || ''}</td></tr>
      <tr><td class="q">12</td><td>Enter the available NOL carryover from prior tax years (do not reduce by any deduction on page 1, line 29a): <b>${fmt(d.schedK_q15) ? '$' + fmt(d.schedK_q15) : '___'}</b></td><td class="ans"></td></tr>
    </table>
  </div>

  <div class="footer">
    Form <b>1120</b> (${taxYear}) &nbsp;&nbsp; Page 4
  </div>
</div>

<!-- PAGE 5: Schedule K (continued) -->
<div class="page">
  <div style="text-align:center;font-weight:bold;font-size:11px;margin-bottom:6px;border-bottom:2px solid #000;padding-bottom:4px;">
    Form 1120 (${taxYear}) &nbsp;&nbsp; ${d.corporationName || companyName} &nbsp;&nbsp; EIN: ${d.ein || '___'} &nbsp;&nbsp; Page <b>5</b>
  </div>

  <div class="sec schedK">
    <div class="sec-title">Schedule K — Other Information <span style="font-weight:normal;font-size:8px;">(continued from page 4)</span></div>
    <table>
      <tr style="background:#f5f5f5;"><td class="q"></td><td style="font-weight:bold;font-size:8px;">Question</td><td class="ans" style="font-weight:bold;font-size:8px;">Yes / No</td></tr>
      <tr><td class="q">13</td><td>Are the corporation's total receipts (page 1, line 1a, plus lines 4 through 10) for the tax year AND its total assets at the end of the tax year less than $250,000? If "Yes," the corporation is not required to complete Schedules L, M-1, and M-2.</td><td class="ans">${d.schedK_q13 || ''}</td></tr>
      <tr><td class="q">14</td><td>Is the corporation required to file Schedule UTP (Form 1120), Uncertain Tax Position Statement? If "Yes," complete and attach Schedule UTP.</td><td class="ans">${d.schedK_q14 || ''}</td></tr>
      <tr><td class="q">15a</td><td>Did the corporation make any payments in the calendar year that would require it to file Form(s) 1099?</td><td class="ans">${d.schedK_q20 || ''}</td></tr>
      <tr><td class="q">15b</td><td>&nbsp;&nbsp;If "Yes," did or will the corporation file required Form(s) 1099?</td><td class="ans">${d.schedK_q20b || ''}</td></tr>
      <tr><td class="q">16</td><td>During this tax year, did the corporation have an 80% or more change in ownership, including a change due to redemption of its own stock?</td><td class="ans">${d.schedK_q17 || ''}</td></tr>
      <tr><td class="q">17</td><td>During or subsequent to this tax year, but before the filing of this return, did the corporation dispose of more than 65% (by value) of its assets in a taxable, non-taxable, or tax-deferred transaction?</td><td class="ans">${d.schedK_q18 || ''}</td></tr>
      <tr><td class="q">18</td><td>Did the corporation receive assets in a section 351 transfer in which any of the transferred assets had a built-in loss of more than $250,000?</td><td class="ans">${d.schedK_q19 || ''}</td></tr>
      <tr><td class="q">19</td><td>During this tax year, did the corporation pay or accrue any interest or royalty for which the deduction is not allowed under section 267A? ${fmt(d.schedK_q21_amt) ? '&nbsp; Disallowed amount: <b>$' + fmt(d.schedK_q21_amt) + '</b>' : ''}</td><td class="ans">${d.schedK_q21 || ''}</td></tr>
      <tr><td class="q">20</td><td>Does the corporation have gross receipts of at least $500 million in any of the 3 preceding tax years? (See sections 59A(e) and (f).)</td><td class="ans">${d.schedK_q22 || ''}</td></tr>
      <tr><td class="q">21</td><td>Did the reporting corporation have an election under section 163(j) for any real property trade or business or any farming business in effect during this tax year?</td><td class="ans">${d.schedK_q23 || ''}</td></tr>
      <tr><td class="q">22</td><td>Does the corporation satisfy one or more of the following? (a) Pass-through entity with excess business interest expense. (b) Aggregate average annual gross receipts > $31 million with business interest expense. (c) Tax shelter with business interest expense. See instructions for section 163(j).</td><td class="ans">${d.schedK_q24 || ''}</td></tr>
      <tr><td class="q">23</td><td>Does the corporation itself, or together with any related party, have any specified foreign financial assets with an aggregate value over $50,000? (See section 6038D.)</td><td class="ans">${d.schedK_q25 || ''}</td></tr>
      <tr><td class="q">24</td><td>Since December 22, 2017, did a foreign corporation directly or indirectly acquire substantially all of the properties held by the corporation, and was the ownership percentage for purposes of section 7874 greater than 50%?</td><td class="ans">${d.schedK_q26 || ''}</td></tr>
      <tr><td class="q">25</td><td>At any time during this tax year, did the corporation (a) receive a digital asset (as a reward, award, or payment for property or services), or (b) sell, exchange, or otherwise dispose of a digital asset (or a financial interest in a digital asset)?</td><td class="ans">${d.schedK_q27 || ''}</td></tr>
      <tr><td class="q">26</td><td>Was the corporation an applicable corporation under section 59(k) in any prior tax year?</td><td class="ans">${d.schedK_q28 || ''}</td></tr>
      <tr><td class="q">27</td><td>Is the corporation an applicable corporation under section 59(k)(1) in the current tax year?</td><td class="ans">${d.schedK_q29 || ''}</td></tr>
      <tr><td class="q">28</td><td>Does the corporation meet the requirements of the safe harbor method as provided under section 59A(i)(2)(A) for the current tax year?</td><td class="ans">${d.schedK_q30 || ''}</td></tr>
      <tr><td class="q">29</td><td>Is the corporation not required to complete and attach Form 4626? ${fmt(d.schedK_q29_afsi) ? '&nbsp; AFSI: <b>$' + fmt(d.schedK_q29_afsi) + '</b>' : ''}</td><td class="ans">${d.schedK_q29_form4626 || ''}</td></tr>
      <tr><td class="q">30</td><td>Is the corporation required to file Form 7208, Excise Tax on Repurchase of Corporate Stock?</td><td class="ans">${d.schedK_q30_form7208 || ''}</td></tr>
      <tr><td class="q">31</td><td>Reserved for future use</td><td class="ans"></td></tr>
      <tr><td class="q">32</td><td>Reserved for future use</td><td class="ans"></td></tr>
    </table>
  </div>

  <div class="footer">
    Form <b>1120</b> (${taxYear}) &nbsp;&nbsp; Page 5
  </div>
</div>

<!-- PAGE 6: Schedule L -->
<div class="page">
  <div style="text-align:center;font-weight:bold;font-size:11px;margin-bottom:6px;border-bottom:2px solid #000;padding-bottom:4px;">
    Form 1120 (${taxYear}) &nbsp;&nbsp; ${d.corporationName || companyName} &nbsp;&nbsp; EIN: ${d.ein || '___'} &nbsp;&nbsp; Page <b>6</b>
  </div>

  <div class="sec schedL">
    <div class="sec-title">Schedule L — Balance Sheets per Books</div>
    <table>
      <tr>
        <th style="width:24px;"></th>
        <th style="text-align:left;">Assets</th>
        <th>(a) Beginning of tax year</th>
        <th>(b) End of tax year</th>
      </tr>
      ${scheduleLRow('1', 'Cash', 'cashBOY', 'cashEOY', d)}
      ${scheduleLRow('2a', 'Trade notes and accounts receivable', 'accountsReceivableBOY', 'accountsReceivableEOY', d)}
      ${scheduleLRow('2b', 'Less allowance for bad debts', 'badDebtAllowanceBOY', 'badDebtAllowanceEOY', d)}
      ${scheduleLRow('3', 'Inventories', 'inventoriesBOY', 'inventoriesEOY', d)}
      ${scheduleLRow('4', 'U.S. government obligations', 'usGovObligationsBOY', 'usGovObligationsEOY', d)}
      ${scheduleLRow('5', 'Tax-exempt securities (see instructions)', 'taxExemptSecuritiesBOY', 'taxExemptSecuritiesEOY', d)}
      ${scheduleLRow('6', 'Other current assets (attach statement)', 'otherCurrentAssetsBOY', 'otherCurrentAssetsEOY', d)}
      ${scheduleLRow('7', 'Loans to stockholders', 'loansToStockholdersBOY', 'loansToStockholdersEOY', d)}
      ${scheduleLRow('8', 'Mortgage and real estate loans', 'mortgageRealEstateLoansBOY', 'mortgageRealEstateLoansEOY', d)}
      ${scheduleLRow('9', 'Other investments (attach statement)', 'otherInvestmentsBOY', 'otherInvestmentsEOY', d)}
      ${scheduleLRow('10a', 'Buildings and other depreciable assets', 'buildingsBOY', 'buildingsEOY', d)}
      ${scheduleLRow('10b', 'Less accumulated depreciation', 'accumulatedDepBOY', 'accumulatedDepEOY', d)}
      ${scheduleLRow('11a', 'Depletable assets', 'depletableAssetsBOY', 'depletableAssetsEOY', d)}
      ${scheduleLRow('11b', 'Less accumulated depletion', 'accumulatedDepletionBOY', 'accumulatedDepletionEOY', d)}
      ${scheduleLRow('12', 'Land (net of any amortization)', 'landBOY', 'landEOY', d)}
      ${scheduleLRow('13', 'Other assets (attach statement)', 'otherAssetsBOY', 'otherAssetsEOY', d)}
      ${scheduleLRow('14', 'Total assets', 'totalAssetsBOY', 'totalAssetsEOY', d, 'total')}
      <tr class="section-label"><td></td><td colspan="3"><b>Liabilities and Stockholders' Equity</b></td></tr>
      ${scheduleLRow('15', 'Accounts payable', 'accountsPayableBOY', 'accountsPayableEOY', d)}
      ${scheduleLRow('16', 'Mortgages, notes, bonds payable in less than 1 year', 'mortgagesLT1yrBOY', 'mortgagesLT1yrEOY', d)}
      ${scheduleLRow('17', 'Other current liabilities (attach statement)', 'otherCurrentLiabBOY', 'otherCurrentLiabEOY', d)}
      ${scheduleLRow('18', 'Loans from stockholders', 'loansFromShareholdersBOY', 'loansFromShareholdersEOY', d)}
      ${scheduleLRow('19', 'Mortgages, notes, bonds payable in 1 year or more', 'mortgagesGTE1yrBOY', 'mortgagesGTE1yrEOY', d)}
      ${scheduleLRow('20', 'Other liabilities (attach statement)', 'otherLiabilitiesBOY', 'otherLiabilitiesEOY', d)}
      ${scheduleLRow('21', 'Total liabilities', 'totalLiabilitiesBOY', 'totalLiabilitiesEOY', d, 'total')}
      ${scheduleLRow('22', 'Capital stock: a Preferred stock, b Common stock', 'capitalStockBOY', 'capitalStockEOY', d)}
      ${scheduleLRow('23', 'Additional paid-in capital', 'additionalPaidInCapBOY', 'additionalPaidInCapEOY', d)}
      ${scheduleLRow('24', 'Retained earnings—Appropriated (attach statement)', 'retainedEarningsApprBOY', 'retainedEarningsApprEOY', d)}
      ${scheduleLRow('25', 'Retained earnings—Unappropriated', 'retainedEarningsBOY', 'retainedEarningsEOY', d)}
      ${scheduleLRow('26', 'Adjustments to shareholders\' equity (attach statement)', 'adjustmentsSHEquityBOY', 'adjustmentsSHEquityEOY', d)}
      ${scheduleLRow('27', 'Less cost of treasury stock', 'lessCSSTreasuryBOY', 'lessCSSTreasuryEOY', d)}
      ${scheduleLRow('28', 'Total liabilities and stockholders\' equity', 'totalLiabEquityBOY', 'totalLiabEquityEOY', d, 'total')}
    </table>
  </div>

  <div class="footer">
    Form <b>1120</b> (${taxYear}) &nbsp;&nbsp; Page 6
  </div>
</div>

<!-- PAGE 7: Schedule M-1 + M-2 + Signature -->
<div class="page">
  <div style="text-align:center;font-weight:bold;font-size:11px;margin-bottom:6px;border-bottom:2px solid #000;padding-bottom:4px;">
    Form 1120 (${taxYear}) &nbsp;&nbsp; ${d.corporationName || companyName} &nbsp;&nbsp; EIN: ${d.ein || '___'} &nbsp;&nbsp; Page <b>7</b>
  </div>

  <div class="sec">
    <div class="sec-title">Schedule M-1 — Reconciliation of Income (Loss) per Books With Income per Return</div>
    <table>
      ${r('1', 'Net income (loss) per books', 'm1_line1')}
      ${r('2', 'Federal income tax per books', 'm1_line2')}
      ${r('3', 'Excess of capital losses over capital gains', 'm1_line3')}
      ${r('4', 'Income subject to tax not recorded on books this year (itemize)', 'm1_line4')}
      ${r('5', 'Expenses recorded on books this year not deducted on this return (itemize)', 'm1_line5')}
      ${r('6', 'Add lines 1 through 5', 'm1_line6', 'sub')}
      ${r('7', 'Income recorded on books this year not included on this return (itemize)', 'm1_line7')}
      ${r('8', 'Deductions on this return not charged against book income this year (itemize)', 'm1_line8')}
      ${r('9', 'Add lines 7 and 8', 'm1_line9', 'sub')}
      ${r('10', 'Income (page 1, line 28)—line 6 less line 9', 'm1_line10', 'total')}
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Schedule M-2 — Analysis of Unappropriated Retained Earnings per Books (Line 25, Schedule L)</div>
    <table>
      ${r('1', 'Balance at beginning of year', 'm2_line1')}
      ${r('2', 'Net income (loss) per books', 'm2_line2')}
      ${r('3', 'Other increases (itemize)', 'm2_line3')}
      ${r('4', 'Add lines 1, 2, and 3', 'm2_line4', 'sub')}
      ${r('5a', 'Distributions: a Cash', 'm2_line5a')}
      ${r('5b', 'Distributions: b Stock', 'm2_line5b')}
      ${r('5c', 'Distributions: c Property', 'm2_line5c')}
      ${r('6', 'Other decreases (itemize)', 'm2_line6')}
      ${r('7', 'Add lines 5 and 6', 'm2_line7', 'sub')}
      ${r('8', 'Balance at end of year (line 4 less line 7)', 'm2_line8', 'total')}
    </table>
  </div>

  <div style="margin-top:16px;padding:10px;border:1px solid #999;font-size:8px;">
    <p style="font-weight:bold;margin-bottom:4px;">Under penalties of perjury, I declare that I have examined this return, including accompanying schedules and statements, and to the best of my knowledge and belief, it is true, correct, and complete. Declaration of preparer (other than taxpayer) is based on all information of which preparer has any knowledge.</p>
    <table style="width:100%;margin-top:8px;border-collapse:collapse;">
      <tr>
        <td style="width:50%;border-bottom:1px solid #000;padding:14px 4px 2px;"><span style="font-size:7px;color:#666;">Signature of officer</span></td>
        <td style="width:20%;border-bottom:1px solid #000;padding:14px 4px 2px;"><span style="font-size:7px;color:#666;">Date</span></td>
        <td style="width:30%;border-bottom:1px solid #000;padding:14px 4px 2px;"><span style="font-size:7px;color:#666;">Title</span></td>
      </tr>
    </table>
    <table style="width:100%;margin-top:8px;border-collapse:collapse;">
      <tr>
        <td style="width:40%;border-bottom:1px solid #000;padding:14px 4px 2px;"><span style="font-size:7px;color:#666;">Print/Type preparer's name</span></td>
        <td style="width:25%;border-bottom:1px solid #000;padding:14px 4px 2px;"><span style="font-size:7px;color:#666;">Preparer's signature</span></td>
        <td style="width:15%;border-bottom:1px solid #000;padding:14px 4px 2px;"><span style="font-size:7px;color:#666;">Date</span></td>
        <td style="width:20%;border-bottom:1px solid #000;padding:14px 4px 2px;"><span style="font-size:7px;color:#666;">PTIN</span></td>
      </tr>
    </table>
    <table style="width:100%;margin-top:6px;border-collapse:collapse;">
      <tr>
        <td style="width:50%;border-bottom:1px solid #000;padding:10px 4px 2px;"><span style="font-size:7px;color:#666;">Firm's name ▶</span></td>
        <td style="width:25%;border-bottom:1px solid #000;padding:10px 4px 2px;"><span style="font-size:7px;color:#666;">Firm's EIN ▶</span></td>
        <td style="width:25%;border-bottom:1px solid #000;padding:10px 4px 2px;"><span style="font-size:7px;color:#666;">Phone no.</span></td>
      </tr>
      <tr>
        <td colspan="3" style="border-bottom:1px solid #000;padding:10px 4px 2px;"><span style="font-size:7px;color:#666;">Firm's address ▶</span></td>
      </tr>
    </table>
  </div>

  <div class="footer">
    Form <b>1120</b> (${taxYear}) &nbsp;&nbsp; Page 7
  </div>
  <div class="watermark">Generated by ATLAS ERP — ETHOLYS</div>
</div>

</body></html>`;
}

function generate5472HTML(d: Record<string, any>, taxYear: number, companyName: string) {
  const css = `
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: Letter; margin: 0.4in 0.5in; }
  body { font-family: 'Arial Narrow', Arial, Helvetica, sans-serif; font-size: 9px; color: #000; line-height: 1.3; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .irs-header { display: flex; border: 2px solid #000; margin-bottom: 6px; }
  .irs-left { width: 18%; border-right: 2px solid #000; padding: 4px; text-align: center; display:flex; flex-direction:column; justify-content:center; }
  .irs-left .form-num { font-size: 22px; font-weight: bold; }
  .irs-left .dept { font-size: 7px; line-height: 1.2; }
  .irs-center { width: 62%; padding: 4px 8px; text-align: center; display:flex; flex-direction:column; justify-content:center; }
  .irs-center .title { font-size: 12px; font-weight: bold; }
  .irs-center .subtitle { font-size: 7.5px; margin-top: 2px; }
  .irs-right { width: 20%; border-left: 2px solid #000; padding: 4px; text-align: center; display:flex; flex-direction:column; justify-content:center; }
  .irs-right .omb { font-size: 8px; }
  .irs-right .year { font-size: 16px; font-weight: bold; }
  .sec { border: 1px solid #000; margin-bottom: 5px; font-size: 9px; }
  .sec-title { background: #000; color: #fff; padding: 3px 6px; font-weight: bold; font-size: 10px; }
  .sec table { width: 100%; border-collapse: collapse; }
  .sec td { padding: 2px 4px; border-bottom: 1px solid #ddd; }
  .ln { width: 30px; text-align: right; font-weight: bold; padding-right: 4px; color: #333; }
  .desc { }
  .amt { width: 90px; text-align: right; font-weight: bold; font-family: 'Courier New', monospace; }
  .total td { border-top: 2px solid #000; font-weight: bold; background: #f5f5f5; }
  .label { font-size: 7px; color: #333; text-transform: uppercase; }
  .val { font-weight: bold; font-size: 10px; }
  .footer { text-align: center; font-size: 7px; color: #666; margin-top: 8px; border-top: 1px solid #999; padding-top: 4px; }
  `;

  function r(line: string, label: string, key: string, cls?: string) {
    return `<tr class="${cls || ''}"><td class="ln">${line}</td><td class="desc">${label}</td><td class="amt">${fmt(d[key])}</td></tr>`;
  }
  function t(label: string, val: string) {
    return `<tr><td class="desc" style="padding-left:6px;"><span class="label">${label}</span><br><span class="val">${val || ''}</span></td></tr>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>

<div class="page">
  <div class="irs-header">
    <div class="irs-left">
      <div class="form-num">5472</div>
      <div class="dept">Department of the Treasury<br>Internal Revenue Service</div>
    </div>
    <div class="irs-center">
      <div class="title">Information Return of a 25% Foreign-Owned U.S. Corporation<br>or a Foreign Corporation Engaged in a U.S. Trade or Business</div>
      <div class="subtitle">▶ Go to www.irs.gov/Form5472 for instructions and the latest information.</div>
    </div>
    <div class="irs-right">
      <div class="omb">OMB No. 1545-0123</div>
      <div class="year">${taxYear}</div>
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">Part I — Reporting Corporation</div>
    <table>
      ${t('1a. Name of reporting corporation', d.reportingCorpName || companyName)}
      ${t('1b. Employer identification number (EIN)', d.reportingCorpEIN || '')}
      ${t('1c. Number, street, and room or suite no.', d.reportingCorpAddress || '')}
      ${t('1d. City or town, state, and ZIP code', d.reportingCorpCity || '')}
      ${t('1e. Country of incorporation', d.countryOfIncorporation || '')}
      ${t('1f. Date of incorporation', d.dateOfIncorporation || '')}
      ${t('1g. Principal business activity', d.principalBusinessActivity || '')}
      ${t('1h. Principal business activity code', d.principalBusinessActivityCode || '')}
      ${t('1i. Total assets', fmt(d.totalAssets5472) ? '$' + fmt(d.totalAssets5472) : '')}
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Part II — 25% Foreign Shareholder</div>
    <table>
      ${t('Name of shareholder', d.foreignShareholderName || '')}
      ${t('Address', [d.foreignShareholderAddress, d.foreignShareholderCity, d.foreignShareholderCountry].filter(Boolean).join(', '))}
      ${t('U.S. identifying number (TIN)', d.foreignShareholderTIN || '')}
      ${t('Percentage of ownership', d.foreignShareholderPercentOwned || '')}
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Part III — Related Party</div>
    <table>
      ${t('Name', d.relatedPartyName || '')}
      ${t('Address', [d.relatedPartyAddress, d.relatedPartyCountry].filter(Boolean).join(', '))}
      ${t('TIN', d.relatedPartyTIN || '')}
      ${t('Relationship', d.relatedPartyRelationship || '')}
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Part IV — Monetary Transactions — Amounts Received</div>
    <table>
      ${r('9', 'Sales of stock in trade (inventory)', 'salesOfStock')}
      ${r('10', 'Sales of tangible property other than stock in trade', 'salesOfTangible')}
      ${r('11', 'Platform contribution transaction payments received', 'platformContribution')}
      ${r('12', 'Cost sharing transaction payments received', 'costSharingReceived')}
      ${r('13', 'Compensation received for technical, managerial, etc. services', 'compensationReceived')}
      ${r('14', 'Commissions received', 'commissionsReceived')}
      ${r('15', 'Rents, royalties, and license fees received', 'rentsReceived')}
      ${r('16', 'Interest received', 'interestReceived')}
      ${r('17', 'Premiums received for insurance or reinsurance', 'premiumsReceived')}
      ${r('22', 'Total amounts received', 'totalAmountsReceived', 'total')}
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Part IV — Monetary Transactions — Amounts Paid</div>
    <table>
      ${r('23', 'Purchases of stock in trade (inventory)', 'purchasesOfStock')}
      ${r('24', 'Purchases of tangible property other than stock in trade', 'purchasesOfTangible')}
      ${r('25', 'Platform contribution transaction payments paid', 'platformContributionPaid')}
      ${r('26', 'Cost sharing transaction payments paid', 'costSharingPaid')}
      ${r('27', 'Compensation paid for technical, managerial, etc. services', 'compensationPaid')}
      ${r('28', 'Commissions paid', 'commissionsPaid')}
      ${r('29', 'Rents, royalties, and license fees paid', 'rentsPaid')}
      ${r('30', 'Interest paid', 'interestPaid')}
      ${r('31', 'Premiums paid for insurance or reinsurance', 'premiumsPaid')}
      ${r('36', 'Total amounts paid', 'totalAmountsPaid', 'total')}
    </table>
  </div>

  <div class="footer">
    Form <b>5472</b> (Rev. 12-2022) &nbsp;&nbsp; Cat. No. 49987Y &nbsp;&nbsp; Page 1
  </div>
</div>

<!-- PAGE 2 -->
<div class="page">
  <div style="text-align:center; font-weight:bold; font-size:11px; margin-bottom:6px;">Form 5472 (Rev. 12-2022) — Page 2</div>

  <div class="sec">
    <div class="sec-title">Part V — Reportable Transactions of a Reporting Corporation That Is a Foreign-Owned U.S. DE</div>
    <table>
      <tr><td class="desc" style="padding:4px 6px; font-size:8px;">Describe on an attached separate sheet any other transaction as defined by Regulations section 1.482-1(i)(7), such as amounts paid or received in connection with the formation, dissolution, acquisition, and disposition of the entity, including contributions to and distributions from the entity.</td></tr>
      <tr><td class="desc" style="padding:2px 6px;"><span class="label">Check if applicable</span><br><span class="val">${d.partV_description || 'No'}</span></td></tr>
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Part VI — Nonmonetary and Less-Than-Full Consideration Transactions</div>
    <table>
      <tr><td class="desc" style="padding:4px 6px; font-size:8px;">Describe these nonmonetary and less-than-full consideration transactions on an attached separate sheet.</td></tr>
      <tr><td class="desc" style="padding:2px 6px;"><span class="label">Check if applicable</span><br><span class="val">${d.partVI_description || 'No'}</span></td></tr>
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Part VII — Additional Information</div>
    <table style="width:100%; border-collapse:collapse;">
      <tr style="background:#eee;"><td style="padding:2px 4px; width:30px; font-weight:bold;">#</td><td style="padding:2px 4px;">Question</td><td style="padding:2px 4px; width:50px; text-align:center; font-weight:bold;">Yes/No</td><td style="padding:2px 4px; width:90px; text-align:right; font-weight:bold;">Amount</td></tr>
      <tr><td class="ln">1</td><td>Does the reporting corporation import goods from a foreign related party?</td><td style="text-align:center;">${d.partVII_q1 || ''}</td><td></td></tr>
      <tr><td class="ln">1a</td><td>&nbsp;&nbsp;If "Yes," is the basis or inventory cost of the goods valued at greater than the customs value?</td><td style="text-align:center;">${d.partVII_q1a || ''}</td><td></td></tr>
      <tr><td class="ln">2</td><td>During the tax year, was the foreign parent corporation a participant in any cost sharing arrangement (CSA)?</td><td style="text-align:center;">${d.partVII_q2 || ''}</td><td></td></tr>
      <tr><td class="ln">3a</td><td>Did the reporting corporation pay or accrue any interest or royalty for which the deduction is not allowed under section 267A?</td><td style="text-align:center;">${d.partVII_q3a || ''}</td><td class="amt">${fmt(d.partVII_q3a_amt)}</td></tr>
      <tr><td class="ln">3b</td><td>Is the reporting corporation claiming a foreign-derived intangible income (FDII) deduction under section 250?</td><td style="text-align:center;">${d.partVII_q3b || ''}</td><td></td></tr>
      <tr><td class="ln">4a</td><td>Gross receipts from sales of tangible property to the foreign related party</td><td></td><td class="amt">${fmt(d.partVII_q4a)}</td></tr>
      <tr><td class="ln">4b</td><td>Gross receipts from sales of personal property to the foreign related party</td><td></td><td class="amt">${fmt(d.partVII_q4b)}</td></tr>
      <tr><td class="ln">4c</td><td>Gross receipts from services provided to the foreign related party</td><td></td><td class="amt">${fmt(d.partVII_q4c)}</td></tr>
      <tr><td class="ln">5a</td><td>Loan to/from related party with safe-haven rate under Reg. §1.482-2(a)(2)(iii)(B), using rate within safe-haven?</td><td style="text-align:center;">${d.partVII_q5a || ''}</td><td></td></tr>
      <tr><td class="ln">5b</td><td>Loan to/from related party with safe-haven rules, using rate outside the safe-haven?</td><td style="text-align:center;">${d.partVII_q5b || ''}</td><td></td></tr>
      <tr><td class="ln">6</td><td>Did the reporting corporation issue a covered debt instrument under Reg. §1.385-3(b)(2) or (3)?</td><td style="text-align:center;">${d.partVII_q6 || ''}</td><td></td></tr>
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Part VIII — Cost Sharing Arrangement (CSA)</div>
    <table>
      <tr><td class="desc" style="padding:2px 6px;"><span class="label">Description of CSA</span><br><span class="val">${d.partVIII_desc || ''}</span></td></tr>
      <tr><td class="ln">a</td><td class="desc">During the tax year, did the reporting corporation become a participant in the CSA?</td><td class="amt" style="width:50px; text-align:center;">${d.partVIII_qa || ''}</td></tr>
      <tr><td class="ln">b</td><td class="desc">Was the CSA in effect before January 5, 2009?</td><td class="amt" style="width:50px; text-align:center;">${d.partVIII_qb || ''}</td></tr>
      <tr><td class="ln">c</td><td class="desc">Reporting corporation's share of reasonably anticipated benefits for the CSA</td><td class="amt">${d.partVIII_qc || ''}</td></tr>
      <tr><td class="ln">d</td><td class="desc">Total stock-based compensation deductions claimed</td><td class="amt">${fmt(d.partVIII_stockComp)}</td></tr>
      <tr><td class="ln">e</td><td class="desc">Total intangible development costs for the CSA</td><td class="amt">${fmt(d.partVIII_intangible)}</td></tr>
    </table>
  </div>

  <div class="sec">
    <div class="sec-title">Part IX — Base Erosion Payments and Base Erosion Tax Benefits (under Section 59A)</div>
    <table>
      ${r('a', 'Amounts defined as base erosion payments under section 59A(d)', 'partIX_a')}
      ${r('b', 'Amount of base erosion tax benefits under section 59A(c)(2)', 'partIX_b')}
      ${r('c', 'Total qualified derivative payments as described in section 59A(h)', 'partIX_c')}
      ${r('d', 'Reserved for future use', 'partIX_d')}
    </table>
  </div>

  <div class="footer">
    Form <b>5472</b> (Rev. 12-2022) &nbsp;&nbsp; Cat. No. 49987Y &nbsp;&nbsp; Generated by ATLAS ERP — ETHOLYS
  </div>
</div>

</body></html>`;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { formType, taxYear, formData: fd, companyName } = await req.json();
    if (!formType || !fd) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

    const html = formType === '5472'
      ? generate5472HTML(fd, taxYear, companyName)
      : generate1120HTML(fd, taxYear, companyName);

    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'PDF API not configured' }, { status: 500 });

    // Step 1: Create PDF request
    const createRes = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: apiKey,
        html_content: html,
        pdf_options: {
          format: 'Letter',
          margin: { top: '0.3in', right: '0.4in', bottom: '0.3in', left: '0.4in' },
          print_background: true,
        },
        base_url: process.env.NEXTAUTH_URL || 'https://etholys.abacusai.app',
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error('PDF create error:', errText);
      return NextResponse.json({ error: 'Failed to create PDF request' }, { status: 500 });
    }

    const createData = await createRes.json();
    const requestId = createData?.request_id;
    if (!requestId) {
      console.error('No request_id returned:', createData);
      return NextResponse.json({ error: 'No request ID' }, { status: 500 });
    }

    // Step 2: Poll for completion
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 1500));

      const statusRes = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, deployment_token: apiKey }),
      });

      const statusData = await statusRes.json();
      const status = statusData?.status || 'FAILED';
      const result = statusData?.result || null;

      if (status === 'SUCCESS') {
        if (result && result.result) {
          const pdfBuffer = Buffer.from(result.result, 'base64');
          return new NextResponse(pdfBuffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="Form_${formType}_${taxYear}.pdf"`,
            },
          });
        }
        return NextResponse.json({ error: 'PDF completed but no data' }, { status: 500 });
      }
      if (status === 'FAILED') {
        console.error('PDF generation failed:', statusData);
        return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'PDF generation timeout' }, { status: 504 });
  } catch (error: any) {
    console.error('Tax PDF error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
