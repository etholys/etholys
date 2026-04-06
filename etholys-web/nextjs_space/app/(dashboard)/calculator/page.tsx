'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/app/providers';
import { Calculator, DollarSign, TrendingUp, Target, BarChart3, Info, Plus, X, Trash2 } from 'lucide-react';

type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });

const UI = {
  title: ml('Cost Calculator', 'Calculadora de Costos', 'Calculadora de Custos'),
  subtitle: ml('Full costing methodology: fixed + variable costs, margin, taxes and break-even point', 'Metodología de costeo completo: costos fijos + variables, margen, impuestos y punto de equilibrio', 'Metodologia de custeio completo: custos fixos + variáveis, margem, impostos e ponto de equilíbrio'),
  hideGuide: ml('Hide guide', 'Ocultar guía', 'Ocultar guia'),
  showGuide: ml('Show guide', 'Ver guía', 'Ver guia'),
  howItWorks: ml('How does it work?', '¿Cómo funciona?', 'Como funciona?'),
  guideFixed: ml('1. Fixed Costs: Expenses that don\'t change regardless of production (rent, fixed salaries, insurance, etc.).', '1. Costos Fijos: Gastos que no cambian sin importar cuánto produzcas (alquiler, salarios fijos, seguros, etc.).', '1. Custos Fixos: Despesas que não mudam independente da produção (aluguel, salários fixos, seguros, etc.).'),
  guideVariable: ml('2. Variable Costs: Expenses that change with production (raw materials, packaging, commissions, etc.).', '2. Costos Variables: Gastos que cambian según la producción (materia prima, empaque, comisiones, etc.).', '2. Custos Variáveis: Despesas que mudam com a produção (matéria-prima, embalagem, comissões, etc.).'),
  guideUnitCost: ml('3. Unit Cost = (Fixed Costs / Units) + (Variable Costs / Units)', '3. Costo Unitario = (Costos Fijos / Unidades) + (Costos Variables / Unidades)', '3. Custo Unitário = (Custos Fixos / Unidades) + (Custos Variáveis / Unidades)'),
  guidePrice: ml('4. Price = Unit Cost + Profit Margin + Taxes', '4. Precio = Costo Unitario + Margen de Ganancia + Impuestos', '4. Preço = Custo Unitário + Margem de Lucro + Impostos'),
  guideBE: ml('5. Break-Even = Fixed Costs / Margin per Unit (units needed to cover all costs).', '5. Punto de Equilibrio = Costos Fijos / Margen por Unidad (cuántas unidades necesitas vender para cubrir todos tus costos).', '5. Ponto de Equilíbrio = Custos Fixos / Margem por Unidade (unidades necessárias para cobrir todos os custos).'),
  productService: ml('Product / Service', 'Producto / Servicio', 'Produto / Serviço'),
  productNamePh: ml('Name of the product or service', 'Nombre del producto o servicio', 'Nome do produto ou serviço'),
  costStructure: ml('Cost Structure (monthly)', 'Estructura de Costos (mensual)', 'Estrutura de Custos (mensal)'),
  add: ml('Add', 'Agregar', 'Adicionar'),
  conceptPh: ml('Concept', 'Concepto', 'Conceito'),
  fixed: ml('Fixed', 'Fijo', 'Fixo'),
  variable: ml('Variable', 'Variable', 'Variável'),
  total: ml('Total', 'Total', 'Total'),
  parameters: ml('Parameters', 'Parámetros', 'Parâmetros'),
  unitsMonth: ml('Units / month', 'Unidades / mes', 'Unidades / mês'),
  profitMargin: ml('Profit margin %', 'Margen de ganancia %', 'Margem de lucro %'),
  taxPct: ml('Taxes %', 'Impuestos %', 'Impostos %'),
  suggestedPrice: ml('Suggested Price', 'Precio Sugerido', 'Preço Sugerido'),
  perUnit: ml('per unit (with taxes)', 'por unidad (con impuestos)', 'por unidade (com impostos)'),
  unitCost: ml('Unit cost', 'Costo unitario', 'Custo unitário'),
  fixedPerUnit: ml('Fixed per unit', 'Fijo por unidad', 'Fixo por unidade'),
  variablePerUnit: ml('Variable per unit', 'Variable por unidad', 'Variável por unidade'),
  margin: ml('Margin', 'Margen', 'Margem'),
  priceBeforeTax: ml('Price before taxes', 'Precio antes de imp.', 'Preço antes de imp.'),
  taxes: ml('Taxes', 'Impuestos', 'Impostos'),
  finalPrice: ml('Final price', 'Precio final', 'Preço final'),
  breakEven: ml('Break-Even Point', 'Punto de Equilibrio', 'Ponto de Equilíbrio'),
  units: ml('units', 'unidades', 'unidades'),
  inSales: ml('in sales', 'en ventas', 'em vendas'),
  breakEvenExplain: ml('You need to sell at least {{n}} units per month to cover all fixed costs and start generating profit.', 'Necesitas vender al menos {{n}} unidades al mes para cubrir todos los costos fijos y comenzar a generar ganancia.', 'Você precisa vender pelo menos {{n}} unidades por mês para cobrir todos os custos fixos e começar a gerar lucro.'),
  monthlyProjection: ml('Monthly Projection', 'Proyección Mensual', 'Projeção Mensal'),
  grossRevenue: ml('Gross revenue', 'Ingresos brutos', 'Receita bruta'),
  totalCosts: ml('Total costs', 'Costos totales', 'Custos totais'),
  netProfit: ml('Net profit', 'Ganancia neta', 'Lucro líquido'),
  realMarginOnPrice: ml('Real margin on price', 'Margen real s/ precio', 'Margem real s/ preço'),
  priceComposition: ml('Price Composition', 'Composición del Precio', 'Composição do Preço'),
  rawMaterial: ml('Raw material', 'Materia prima', 'Matéria-prima'),
  directLabor: ml('Direct labor', 'Mano de obra directa', 'Mão de obra direta'),
  rent: ml('Rent', 'Alquiler/Renta', 'Aluguel'),
  utilities: ml('Utilities (power, water, internet)', 'Servicios (luz, agua, internet)', 'Serviços (energia, água, internet)'),
};

interface CostItem { id: string; name: string; type: 'fixed' | 'variable'; amount: number; }

function fmt(n: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

export default function CalculatorPage() {
  const { locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;

  const [productName, setProductName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [costs, setCosts] = useState<CostItem[]>([
    { id: '1', name: L(UI.rawMaterial), type: 'variable', amount: 0 },
    { id: '2', name: L(UI.directLabor), type: 'variable', amount: 0 },
    { id: '3', name: L(UI.rent), type: 'fixed', amount: 0 },
    { id: '4', name: L(UI.utilities), type: 'fixed', amount: 0 },
  ]);
  const [unitsPerMonth, setUnitsPerMonth] = useState(100);
  const [marginPercent, setMarginPercent] = useState(30);
  const [taxPercent, setTaxPercent] = useState(22);
  const [showHelp, setShowHelp] = useState(false);

  const addCost = () => { setCosts([...costs, { id: Date.now().toString(), name: '', type: 'variable', amount: 0 }]); };
  const removeCost = (id: string) => setCosts(costs.filter(c => c.id !== id));
  const updateCost = (id: string, field: string, value: any) => {
    setCosts(costs.map(c => c.id === id ? { ...c, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : c));
  };

  const calc = useMemo(() => {
    const totalFixed = costs.filter(c => c.type === 'fixed').reduce((s, c) => s + c.amount, 0);
    const totalVariable = costs.filter(c => c.type === 'variable').reduce((s, c) => s + c.amount, 0);
    const totalCost = totalFixed + totalVariable;
    const unitCostVariable = unitsPerMonth > 0 ? totalVariable / unitsPerMonth : 0;
    const unitCostFixed = unitsPerMonth > 0 ? totalFixed / unitsPerMonth : 0;
    const unitCostTotal = unitCostVariable + unitCostFixed;
    const marginAmount = unitCostTotal * (marginPercent / 100);
    const priceBeforeTax = unitCostTotal + marginAmount;
    const taxAmount = priceBeforeTax * (taxPercent / 100);
    const finalPrice = priceBeforeTax + taxAmount;
    const monthlyRevenue = finalPrice * unitsPerMonth;
    const monthlyProfit = marginAmount * unitsPerMonth;
    const breakEvenUnits = marginAmount > 0 ? Math.ceil(totalFixed / marginAmount) : 0;
    const breakEvenRevenue = breakEvenUnits * finalPrice;
    const profitMarginReal = finalPrice > 0 ? (marginAmount / finalPrice) * 100 : 0;
    return { totalFixed, totalVariable, totalCost, unitCostVariable, unitCostFixed, unitCostTotal, marginAmount, priceBeforeTax, taxAmount, finalPrice, monthlyRevenue, monthlyProfit, breakEvenUnits, breakEvenRevenue, profitMarginReal };
  }, [costs, unitsPerMonth, marginPercent, taxPercent]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Calculator className="w-6 h-6 text-teal-600" />{L(UI.title)}</h1>
          <p className="text-gray-500 text-sm">{L(UI.subtitle)}</p>
        </div>
        <button onClick={() => setShowHelp(!showHelp)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
          <Info className="w-4 h-4" />{showHelp ? L(UI.hideGuide) : L(UI.showGuide)}
        </button>
      </div>

      {showHelp && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800 space-y-2">
          <h3 className="font-bold text-blue-900">{L(UI.howItWorks)}</h3>
          <p><strong>{L(UI.guideFixed)}</strong></p>
          <p><strong>{L(UI.guideVariable)}</strong></p>
          <p><strong>{L(UI.guideUnitCost)}</strong></p>
          <p><strong>{L(UI.guidePrice)}</strong></p>
          <p><strong>{L(UI.guideBE)}</strong></p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">{L(UI.productService)}</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><input value={productName} onChange={e => setProductName(e.target.value)} placeholder={L(UI.productNamePh)} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-teal-500 outline-none" /></div>
              <div><select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm"><option value="USD">USD</option><option value="UYU">UYU</option><option value="BRL">BRL</option><option value="EUR">EUR</option><option value="ARS">ARS</option></select></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">{L(UI.costStructure)}</h2>
              <button onClick={addCost} className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100"><Plus className="w-3 h-3" />{L(UI.add)}</button>
            </div>
            <div className="space-y-2">
              {costs.map(cost => (
                <div key={cost.id} className="flex items-center gap-2">
                  <input value={cost.name} onChange={e => updateCost(cost.id, 'name', e.target.value)} placeholder={L(UI.conceptPh)} className="flex-1 px-3 py-2 rounded-lg border text-sm" />
                  <select value={cost.type} onChange={e => updateCost(cost.id, 'type', e.target.value)} className={`px-3 py-2 rounded-lg border text-sm w-28 ${cost.type === 'fixed' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                    <option value="fixed">{L(UI.fixed)}</option>
                    <option value="variable">{L(UI.variable)}</option>
                  </select>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{currency}</span>
                    <input type="number" min="0" step="0.01" value={cost.amount || ''} onChange={e => updateCost(cost.id, 'amount', e.target.value)} className="w-full pl-12 pr-3 py-2 rounded-lg border text-sm text-right" />
                  </div>
                  <button onClick={() => removeCost(cost.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t flex justify-between text-sm">
              <div><span className="text-amber-600 font-medium">{L(UI.fixed)}: {fmt(calc.totalFixed, currency)}</span> + <span className="text-blue-600 font-medium">{L(UI.variable)}: {fmt(calc.totalVariable, currency)}</span></div>
              <span className="font-bold">{L(UI.total)}: {fmt(calc.totalCost, currency)}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">{L(UI.parameters)}</h2>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="block text-xs text-gray-500 mb-1">{L(UI.unitsMonth)}</label><input type="number" min="1" value={unitsPerMonth} onChange={e => setUnitsPerMonth(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">{L(UI.profitMargin)}</label><input type="number" min="0" max="500" step="1" value={marginPercent} onChange={e => setMarginPercent(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">{L(UI.taxPct)}</label><input type="number" min="0" max="100" step="0.5" value={taxPercent} onChange={e => setTaxPercent(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-xl border-2 border-teal-200 p-5">
            <h2 className="text-sm font-semibold text-teal-700 mb-4 flex items-center gap-1.5"><DollarSign className="w-4 h-4" />{L(UI.suggestedPrice)}</h2>
            <div className="text-center mb-4">
              <p className="text-3xl font-bold text-gray-900">{fmt(calc.finalPrice, currency)}</p>
              <p className="text-xs text-gray-500">{L(UI.perUnit)}</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">{L(UI.unitCost)}</span><span className="font-medium">{fmt(calc.unitCostTotal, currency)}</span></div>
              <div className="flex justify-between text-xs pl-3 text-gray-400"><span>{L(UI.fixedPerUnit)}</span><span>{fmt(calc.unitCostFixed, currency)}</span></div>
              <div className="flex justify-between text-xs pl-3 text-gray-400"><span>{L(UI.variablePerUnit)}</span><span>{fmt(calc.unitCostVariable, currency)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">+ {L(UI.margin)} ({marginPercent}%)</span><span className="font-medium text-emerald-600">+{fmt(calc.marginAmount, currency)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{L(UI.priceBeforeTax)}</span><span className="font-medium">{fmt(calc.priceBeforeTax, currency)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">+ {L(UI.taxes)} ({taxPercent}%)</span><span className="font-medium text-amber-600">+{fmt(calc.taxAmount, currency)}</span></div>
              <div className="border-t pt-2 flex justify-between font-bold"><span>{L(UI.finalPrice)}</span><span className="text-teal-700">{fmt(calc.finalPrice, currency)}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><Target className="w-4 h-4 text-red-500" />{L(UI.breakEven)}</h2>
            <div className="text-center mb-3">
              <p className="text-2xl font-bold text-gray-900">{calc.breakEvenUnits} <span className="text-sm font-normal text-gray-500">{L(UI.units)}</span></p>
              <p className="text-sm text-gray-500">{fmt(calc.breakEvenRevenue, currency)} {L(UI.inSales)}</p>
            </div>
            <p className="text-xs text-gray-400 text-center">{L(UI.breakEvenExplain).replace('{{n}}', String(calc.breakEvenUnits))}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-emerald-500" />{L(UI.monthlyProjection)}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">{L(UI.grossRevenue)}</span><span className="font-medium">{fmt(calc.monthlyRevenue, currency)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{L(UI.totalCosts)}</span><span className="font-medium text-red-500">{fmt(calc.totalCost, currency)}</span></div>
              <div className="flex justify-between border-t pt-2 font-bold"><span className="text-gray-700">{L(UI.netProfit)}</span><span className="text-emerald-600">{fmt(calc.monthlyProfit, currency)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{L(UI.realMarginOnPrice)}</span><span className="font-medium">{calc.profitMarginReal.toFixed(1)}%</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">{L(UI.priceComposition)}</h2>
            <div className="h-6 rounded-full overflow-hidden flex bg-gray-100">
              {calc.finalPrice > 0 && (<>
                <div className="bg-slate-400 h-full" style={{ width: `${(calc.unitCostFixed / calc.finalPrice) * 100}%` }} />
                <div className="bg-blue-400 h-full" style={{ width: `${(calc.unitCostVariable / calc.finalPrice) * 100}%` }} />
                <div className="bg-emerald-400 h-full" style={{ width: `${(calc.marginAmount / calc.finalPrice) * 100}%` }} />
                <div className="bg-amber-400 h-full" style={{ width: `${(calc.taxAmount / calc.finalPrice) * 100}%` }} />
              </>)}
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" />{L(UI.fixed)}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" />{L(UI.variable)}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />{L(UI.margin)}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" />{L(UI.taxes)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
