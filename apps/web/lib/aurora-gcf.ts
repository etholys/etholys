import * as XLSX from 'xlsx';
import { carbonTonnesTo2030, corridorGroups, territorialEligibility, type TerritorialCompliance } from './aurora-territory';

export type GcfPropertyRow = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  areaHa: number | null;
  compliance: TerritorialCompliance | null;
};

export type GcfIndicatorRow = {
  code: string;
  title: string;
  indicator: string;
  unit: string;
  value: string;
  visits: number;
  onSite: number;
};

export function buildGcfWorkbook(input: {
  projectName: string;
  properties: GcfPropertyRow[];
  indicators: GcfIndicatorRow[];
  budgetTotal: number;
  budgetSpent: number;
  now?: Date;
}): Buffer {
  const now = input.now || new Date();
  const territory = input.properties.map((p) => {
    const gate = p.compliance ? territorialEligibility(p.compliance) : { eligible: false, reasons: ['Sem checagem territorial.'] };
    return {
      Propriedade: p.name,
      Município: p.compliance?.municipality || '',
      UF: p.compliance?.stateUf || '',
      Hectares: p.areaHa ?? '',
      CAR: p.compliance?.carCode || '',
      SIGEF: p.compliance?.sigefCode || '',
      Elegível: gate.eligible ? 'sim' : 'não',
      Motivos: gate.reasons.join(' '),
      Mulheres: p.compliance?.womenLed ? 'sim' : 'não',
      Jovens: p.compliance?.youthLed ? 'sim' : 'não',
      tCO2e_ate_2030: p.areaHa ? carbonTonnesTo2030(p.areaHa, now) : 0,
    };
  });

  const points = input.properties
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({ id: p.name, lat: p.lat as number, lng: p.lng as number }));
  const corridor = corridorGroups(points);

  const indicators = input.indicators.map((row) => ({
    Código: row.code,
    Indicador: row.indicator || row.title,
    Unidade: row.unit,
    Valor: row.value,
    Visitas: row.visits,
    NaFinca: row.onSite,
  }));

  const finance = [
    {
      Projeto: input.projectName,
      Orcamento: input.budgetTotal,
      Executado: input.budgetSpent,
      Fincas: input.properties.length,
      Elegiveis: territory.filter((r) => r.Elegível === 'sim').length,
      Corredor: corridor.connected.length,
      Isoladas: corridor.isolated.length,
      Carbono_tCO2e: territory.reduce((s, r) => s + Number(r.tCO2e_ate_2030 || 0), 0),
    },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(finance), 'Resumo');
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(indicators.length ? indicators : [{ Indicador: '' }]), 'Indicadores');
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(territory.length ? territory : [{ Propriedade: '' }]), 'Territorio');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
