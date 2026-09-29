'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Download, Globe, Landmark, Loader2, RefreshCw, Save } from 'lucide-react';
import { countryPack, money, type TaxYearSummary } from '@/lib/atlas/tax-workspace';
import type { Locale } from '@/lib/i18n';

type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
const loc = (locale: Locale, m: ML) => m[locale] || m.en;

type CountryOpt = { code: string; nameEn: string; nameEs: string; namePt: string; taxIdLabel: string; vatName: string; entityHints: string[] };
type Obligation = { id: string; title: string; titleEs: string; titlePt: string; cadence: string };

export type TaxWorkspacePayload = {
  company: {
    id: string;
    name: string;
    shortName: string | null;
    currency: string;
    ein: string | null;
    taxAddress: string | null;
    incorporationCountry: string | null;
    entityType: string | null;
  };
  pack: {
    code: string;
    taxIdLabel: string;
    vatName: string;
    entityHints: string[];
    obligations: Obligation[];
    defaultStatuses: Record<string, string>;
  };
  countries: CountryOpt[];
  summary: TaxYearSummary;
};

const T = {
  books: ml('Books of the fiscal year', 'Libros del ejercicio', 'Livros do exercício'),
  cashIn: ml('Cash income', 'Ingresos de caja', 'Receitas de caixa'),
  cashOut: ml('Cash expenses', 'Gastos de caja', 'Despesas de caixa'),
  result: ml('Result', 'Resultado', 'Resultado'),
  vatOut: ml('Tax on sales invoices', 'Impuesto en facturas emitidas', 'Imposto em faturas emitidas'),
  vatIn: ml('Tax on purchase invoices', 'Impuesto en facturas de compra', 'Imposto em faturas de compra'),
  profile: ml('Tax profile', 'Perfil fiscal', 'Perfil fiscal'),
  country: ml('Country of tax residence', 'País de residencia fiscal', 'País de residência fiscal'),
  entity: ml('Entity type', 'Tipo de entidad', 'Tipo de entidade'),
  taxId: ml('Tax ID', 'Identificación fiscal', 'Identificação fiscal'),
  address: ml('Tax address', 'Domicilio fiscal', 'Domicílio fiscal'),
  fyStart: ml('Fiscal year starts in', 'El ejercicio empieza en', 'O exercício começa em'),
  saveProfile: ml('Save profile', 'Guardar perfil', 'Salvar perfil'),
  obligations: ml('Typical obligations (checklist)', 'Obligaciones típicas (lista)', 'Obrigações típicas (lista)'),
  byCat: ml('Executed movements by category', 'Movimientos ejecutados por categoría', 'Movimentos executados por categoria'),
  cat: ml('Category', 'Categoría', 'Categoria'),
  income: ml('Income', 'Ingresos', 'Receitas'),
  expense: ml('Expenses', 'Gastos', 'Despesas'),
  lines: ml('Lines', 'Líneas', 'Linhas'),
  exportCsv: ml('Export books (CSV)', 'Exportar libros (CSV)', 'Exportar livros (CSV)'),
  refresh: ml('Refresh from ATLAS', 'Actualizar desde ATLAS', 'Atualizar a partir do ATLAS'),
  disclaimer: ml(
    'ATLAS organizes books and a country checklist so you and your accountant can prepare filings. It does not e-file with IRS, DGI, RFB or any other authority, and it is not legal advice.',
    'ATLAS organiza los libros y una lista por país para que tú y tu contador preparen las declaraciones. No presenta ante IRS, DGI, RFB ni otra autoridad, y no es asesoramiento legal.',
    'O ATLAS organiza os livros e uma lista por país para você e o contabilista prepararem as declarações. Não protocola na IRS, DGI, RFB nem outra autoridade, e não é aconselhamento jurídico.',
  ),
  other: ml('Other / not listed', 'Otro / no listado', 'Outro / não listado'),
  pending: ml('Pending', 'Pendiente', 'Pendente'),
  done: ml('Done', 'Hecho', 'Feito'),
  na: ml('N/A', 'N/A', 'N/A'),
  projectOnly: ml('Donor-only (not company cash)', 'Solo informe/donante (no caja de la empresa)', 'Só relatório/doador (não caixa da empresa)'),
  forecast: ml('Forecast (not in tax books yet)', 'Previsión (aún no entra en libros fiscales)', 'Previsão (ainda não entra nos livros fiscais)'),
  empty: ml('No executed movements in this year.', 'No hay movimientos ejecutados en este año.', 'Não há movimentos executados neste ano.'),
};

const MONTHS: Record<Locale, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  pt: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
};

function countryName(c: CountryOpt, locale: Locale) {
  return locale === 'es' ? c.nameEs : locale === 'pt' ? c.namePt : c.nameEn;
}

function oblTitle(o: Obligation, locale: Locale) {
  return locale === 'es' ? o.titleEs : locale === 'pt' ? o.titlePt : o.title;
}

export function TaxYearPanel({
  locale,
  companyId,
  taxYear,
  fiscalStartMonth,
  formData,
  obligationStatus,
  onFormChange,
  onObligationChange,
  onFiscalMonthChange,
}: {
  locale: Locale;
  companyId: string;
  taxYear: number;
  fiscalStartMonth: number;
  formData: Record<string, any>;
  obligationStatus: Record<string, string>;
  onFormChange: (key: string, value: any) => void;
  onObligationChange: (id: string, status: string) => void;
  onFiscalMonthChange: (month: number) => void;
}) {
  const L = (m: ML) => loc(locale, m);
  const [payload, setPayload] = useState<TaxWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(
        `/api/tax-workspace/summary?companyId=${encodeURIComponent(companyId)}&taxYear=${taxYear}&fiscalStartMonth=${fiscalStartMonth}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setPayload(data);
      const s = data.summary;
      if (s) {
        onFormChange('_byCategory', s.byCategory);
        onFormChange('cashIncome', s.cashIncome);
        onFormChange('cashExpense', s.cashExpense);
        onFormChange('cashResult', s.cashResult);
        onFormChange('invoiceOutputTax', s.invoiceOutputTax);
        onFormChange('invoiceInputTax', s.invoiceInputTax);
      }
      if (!formData.taxCountry && data.company?.incorporationCountry) onFormChange('taxCountry', data.company.incorporationCountry);
      if (!formData.entityType && data.company?.entityType) onFormChange('entityType', data.company.entityType);
      if (!formData.taxId && data.company?.ein) onFormChange('taxId', data.company.ein);
      if (!formData.address && data.company?.taxAddress) onFormChange('address', data.company.taxAddress);
      if (!formData.legalName && data.company?.name) onFormChange('legalName', data.company.name);
    } catch (e: any) {
      setErr(e.message || 'Error');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, taxYear, fiscalStartMonth]);

  const saveProfile = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      await fetch('/api/companies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: companyId,
          incorporationCountry: formData.taxCountry || null,
          entityType: formData.entityType || null,
          ein: formData.taxId || null,
          taxAddress: formData.address || null,
        }),
      });
    } catch { /* ignore */ }
    setSaving(false);
    load();
  };

  const exportCsv = () => {
    window.open(
      `/api/tax-workspace/export?companyId=${encodeURIComponent(companyId)}&taxYear=${taxYear}&fiscalStartMonth=${fiscalStartMonth}`,
      '_blank',
    );
  };

  const summary: TaxYearSummary | null = payload?.summary || null;
  const currency = payload?.company.currency || 'USD';
  const selectedCountry = formData.taxCountry || payload?.company.incorporationCountry || '';
  const livePack = countryPack(formData.taxCountry || selectedCountry);
  const taxIdLabel = livePack.taxIdLabel || L(T.taxId);
  const hints = livePack.entityHints || [];
  const shownObligations = livePack.obligations || [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{L(T.disclaimer)}</p>

      {err && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {err}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {L(T.refresh)}
        </button>
        <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
          <Download className="w-4 h-4" /> {L(T.exportCsv)}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { k: L(T.cashIn), v: summary?.cashIncome ?? 0, c: 'text-emerald-700' },
          { k: L(T.cashOut), v: summary?.cashExpense ?? 0, c: 'text-rose-700' },
          { k: L(T.result), v: summary?.cashResult ?? 0, c: (summary?.cashResult || 0) >= 0 ? 'text-teal-800' : 'text-rose-800' },
          { k: L(T.vatOut), v: summary?.invoiceOutputTax ?? 0, c: 'text-gray-800' },
          { k: L(T.vatIn), v: summary?.invoiceInputTax ?? 0, c: 'text-gray-800' },
        ].map((card) => (
          <div key={card.k} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">{card.k}</p>
            <p className={`text-lg font-semibold mt-1 ${card.c}`}>{loading ? '…' : money(card.v, currency, locale)}</p>
          </div>
        ))}
      </div>

      {summary && (summary.projectOnlyOut > 0 || summary.forecastIncome > 0 || summary.forecastExpense > 0) && (
        <p className="text-xs text-gray-500">
          {summary.projectOnlyOut > 0 && <>{L(T.projectOnly)}: {money(summary.projectOnlyOut, currency, locale)}. </>}
          {(summary.forecastIncome > 0 || summary.forecastExpense > 0) && (
            <>{L(T.forecast)}: {money(summary.forecastIncome, currency, locale)} / {money(summary.forecastExpense, currency, locale)}.</>
          )}
        </p>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-teal-600" />
          <h3 className="font-semibold text-gray-900 text-sm">{L(T.profile)}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">{L(T.country)}</label>
            <select
              value={formData.taxCountry || selectedCountry || ''}
              onChange={(e) => onFormChange('taxCountry', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">{L(T.other)}</option>
              {(payload?.countries || []).map((c) => (
                <option key={c.code} value={c.code}>{countryName(c, locale)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">{L(T.entity)}</label>
            <input
              list="tax-entity-hints"
              value={formData.entityType || ''}
              onChange={(e) => onFormChange('entityType', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <datalist id="tax-entity-hints">
              {hints.map((h) => <option key={h} value={h} />)}
            </datalist>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">{taxIdLabel}</label>
            <input
              value={formData.taxId || ''}
              onChange={(e) => onFormChange('taxId', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">{L(T.address)}</label>
            <input
              value={formData.address || ''}
              onChange={(e) => onFormChange('address', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">{L(T.fyStart)}</label>
            <select
              value={fiscalStartMonth}
              onChange={(e) => onFiscalMonthChange(parseInt(e.target.value, 10))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {MONTHS[locale].map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={saveProfile} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {L(T.saveProfile)}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-teal-600" />
          <h3 className="font-semibold text-gray-900 text-sm">{L(T.obligations)}</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {shownObligations.map((o) => (
            <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2">
              <div>
                <p className="text-sm text-gray-900">{oblTitle(o, locale)}</p>
                <p className="text-[11px] text-gray-400 uppercase">{o.cadence}</p>
              </div>
              <select
                value={obligationStatus[o.id] || 'pending'}
                onChange={(e) => onObligationChange(o.id, e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="pending">{L(T.pending)}</option>
                <option value="done">{L(T.done)}</option>
                <option value="na">{L(T.na)}</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">{L(T.byCat)}</h3>
        </div>
        {!summary || summary.byCategory.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 text-center">{L(T.empty)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2">{L(T.cat)}</th>
                  <th className="text-right px-4 py-2">{L(T.income)}</th>
                  <th className="text-right px-4 py-2">{L(T.expense)}</th>
                  <th className="text-right px-4 py-2">{L(T.lines)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.byCategory.map((c) => (
                  <tr key={c.category}>
                    <td className="px-4 py-2 text-gray-800">{c.category}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-700">{c.income ? money(c.income, currency, locale) : '—'}</td>
                    <td className="px-4 py-2 text-right font-mono text-rose-700">{c.expense ? money(c.expense, currency, locale) : '—'}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
