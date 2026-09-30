/**
 * Country tax checklists for ATLAS Impostos.
 * Names and cadences follow the ordinary company procedure in each jurisdiction
 * (income tax, VAT/GST analogue, payroll/social). Not e-filing and not legal advice.
 * Cadence is the usual frequency for a typical company — some regimes allow monthly vs quarterly by size.
 */

export type TaxObligationCadence = 'annual' | 'monthly' | 'quarterly' | 'bimonthly' | 'once';

export type TaxObligation = {
  id: string;
  title: string;
  titleEs: string;
  titlePt: string;
  cadence: TaxObligationCadence;
};

export type TaxRegion = 'americas' | 'europe' | 'africa' | 'middleeast' | 'asia' | 'oceania';

export type TaxCountryPack = {
  code: string;
  region: TaxRegion;
  nameEn: string;
  nameEs: string;
  namePt: string;
  taxIdLabel: string;
  vatName: string;
  entityHints: string[];
  obligations: TaxObligation[];
};

function o(
  id: string,
  title: string,
  titleEs: string,
  titlePt: string,
  cadence: TaxObligationCadence,
): TaxObligation {
  return { id, title, titleEs, titlePt, cadence };
}

function same(id: string, title: string, cadence: TaxObligationCadence): TaxObligation {
  return o(id, title, title, title, cadence);
}

function p(
  code: string,
  region: TaxRegion,
  nameEn: string,
  nameEs: string,
  namePt: string,
  taxIdLabel: string,
  vatName: string,
  entityHints: string[],
  obligations: TaxObligation[],
): TaxCountryPack {
  return { code, region, nameEn, nameEs, namePt, taxIdLabel, vatName, entityHints, obligations };
}

const GENERIC_OBLIGATIONS: TaxObligation[] = [
  o('income', 'Corporate / business income tax', 'Impuesto a la renta de sociedades', 'Imposto sobre o rendimento das empresas', 'annual'),
  o('vat', 'VAT / GST / sales tax returns', 'IVA / impuesto a las ventas', 'IVA / GST / imposto sobre vendas', 'monthly'),
  o('payroll', 'Payroll withholdings and social charges', 'Retenciones laborales y cargas sociales', 'Retenções e encargos sociais', 'monthly'),
  o('accounts', 'Annual accounts / books close', 'Cierre de libros / estados anuales', 'Encerramento de livros / demonstrações', 'annual'),
  o('local', 'Municipal / local business tax if any', 'Tributo municipal / patente si aplica', 'Tributo municipal / alvará se houver', 'annual'),
];

export const GENERIC_PACK: TaxCountryPack = {
  code: 'XX',
  region: 'americas',
  nameEn: 'Other country',
  nameEs: 'Otro país',
  namePt: 'Outro país',
  taxIdLabel: 'Tax ID',
  vatName: 'VAT / GST',
  entityHints: ['Ltd', 'LLC', 'SRL', 'SA', 'Sole proprietor', 'Cooperative', 'NGO'],
  obligations: GENERIC_OBLIGATIONS,
};

/** Common English/local names → ISO 3166-1 alpha-2 */
export const COUNTRY_NAME_ALIASES: Record<string, string> = {
  USA: 'US', 'UNITED STATES OF AMERICA': 'US', AMERICA: 'US',
  UK: 'GB', BRITAIN: 'GB', ENGLAND: 'GB', 'GREAT BRITAIN': 'GB',
  HOLLAND: 'NL', NETHERLANDS: 'NL',
  BRASIL: 'BR',
  MEXICO: 'MX', MÉXICO: 'MX',
  ESPANA: 'ES', ESPAÑA: 'ES', SPAIN: 'ES',
  ALEMANIA: 'DE', GERMANY: 'DE', DEUTSCHLAND: 'DE',
  FRANCIA: 'FR', FRANCE: 'FR',
  ITALIA: 'IT', ITALY: 'IT',
  CHINA: 'CN', PRC: 'CN',
  UAE: 'AE', EMIRATOS: 'AE', 'UNITED ARAB EMIRATES': 'AE',
  KOREA: 'KR', 'SOUTH KOREA': 'KR',
  RUSSIA: 'RU', RUSIA: 'RU',
  VIETNAM: 'VN',
  'CZECH REPUBLIC': 'CZ', CZECHIA: 'CZ',
  SLOVAKIA: 'SK',
  'IVORY COAST': 'CI', 'COTE D IVOIRE': 'CI', "CÔTE D'IVOIRE": 'CI',
  SWAZILAND: 'SZ', ESWATINI: 'SZ',
  BURMA: 'MM', MYANMAR: 'MM',
  PERU: 'PE', PERÚ: 'PE',
  PANAMA: 'PA', PANAMÁ: 'PA',
};

const RAW: TaxCountryPack[] = [
  // —— Americas ——
  p('AR', 'americas', 'Argentina', 'Argentina', 'Argentina', 'CUIT', 'IVA', ['SRL', 'SA', 'SAS', 'Monotributo', 'Cooperativa'], [
    same('gan', 'Ganancias (sociedades) — declaración anual AFIP', 'annual'),
    o('iva', 'IVA — F.2002 / libro IVA (usualmente mensual; algunos trimestral)', 'IVA — F.2002 (mensual o trimestral)', 'IVA — F.2002 (mensal ou trimestral)', 'monthly'),
    o('iibb', 'Ingresos Brutos provincial (CM05 / convenio multilateral)', 'Ingresos Brutos provincial', 'Ingresos Brutos provincial', 'monthly'),
    o('f931', 'Seguridad social F.931 / libro de sueldos', 'F.931 / libro de sueldos', 'F.931 / folha de pagamento', 'monthly'),
  ]),
  p('BO', 'americas', 'Bolivia', 'Bolivia', 'Bolívia', 'NIT', 'IVA', ['SRL', 'SA', 'Unipersonal', 'Empresa unipersonal'], [
    same('iue', 'IUE — Impuesto sobre las Utilidades de las Empresas (SIN, anual)', 'annual'),
    same('iva', 'IVA — declaración jurada mensual (Form. 200)', 'monthly'),
    same('it', 'IT — Impuesto a las Transacciones (mensual, sobre ingresos brutos)', 'monthly'),
    same('rciva', 'RC-IVA / aportes laborales si hay dependientes', 'monthly'),
  ]),
  p('BR', 'americas', 'Brazil', 'Brasil', 'Brasil', 'CNPJ', 'PIS/COFINS + ICMS/ISS', ['LTDA', 'SA', 'SLU', 'MEI', 'EIRELI', 'Cooperativa'], [
    o('irpj', 'IRPJ / CSLL — lucro real ou presumido (trimestral ou ajuste anual)', 'IRPJ / CSLL (trimestral ou anual)', 'IRPJ / CSLL (trimestral ou anual)', 'quarterly'),
    same('pis', 'PIS / COFINS — EFD-Contribuições (mensal)', 'monthly'),
    o('icms', 'ICMS estadual e/ou ISS municipal (conforme atividade)', 'ICMS estadual y/o ISS municipal', 'ICMS estadual e/ou ISS municipal', 'monthly'),
    same('esocial', 'eSocial / DCTFWeb / FGTS (folha)', 'monthly'),
    same('ecd', 'ECD / ECF — escrituração contábil e fiscal (anual)', 'annual'),
  ]),
  p('CA', 'americas', 'Canada', 'Canadá', 'Canadá', 'BN / Business Number', 'GST/HST', ['Corporation', 'LLC (extra-provincial)', 'Partnership', 'Sole prop'], [
    same('t2', 'T2 Corporation Income Tax Return (CRA, annual)', 'annual'),
    o('gst', 'GST/HST return — monthly, quarterly or annual by threshold', 'GST/HST (mensual, trimestral o anual)', 'GST/HST (mensal, trimestral ou anual)', 'quarterly'),
    same('pd7a', 'Payroll source deductions (PD7A / RP account)', 'monthly'),
    same('prov', 'Provincial corporate tax / extra-provincial filing if required', 'annual'),
  ]),
  p('CL', 'americas', 'Chile', 'Chile', 'Chile', 'RUT', 'IVA', ['SpA', 'Ltda', 'SA', 'EIRL', 'Cooperativa'], [
    same('f22', 'Renta 1ª categoría — Formulario 22 (anual, SII)', 'annual'),
    same('f29', 'F29 — IVA y retenciones (mensual)', 'monthly'),
    same('ppm', 'PPM — pagos provisionales mensuales de renta', 'monthly'),
    same('previred', 'Cotizaciones Previred / mutual (si hay trabajadores)', 'monthly'),
  ]),
  p('CO', 'americas', 'Colombia', 'Colombia', 'Colômbia', 'NIT', 'IVA', ['SAS', 'Ltda', 'SA', 'Empresa unipersonal'], [
    same('renta', 'Renta (Formulario 110 / 210 según tipo) — anual DIAN', 'annual'),
    o('iva', 'IVA — bimestral para la mayoría; mensual grandes contribuyentes', 'IVA (bimestral o mensual)', 'IVA (bimestral ou mensal)', 'bimonthly'),
    same('retefuente', 'Retención en la fuente (declaración mensual)', 'monthly'),
    o('ica', 'ICA municipal (periodicidad del municipio, p. ej. bimestral en Bogotá)', 'ICA municipal', 'ICA municipal', 'bimonthly'),
    same('pila', 'PILA / seguridad social (mensual)', 'monthly'),
  ]),
  p('CR', 'americas', 'Costa Rica', 'Costa Rica', 'Costa Rica', 'Cédula jurídica', 'IVA', ['SRL', 'SA', 'Unipersonal'], [
    same('renta', 'Impuesto sobre las utilidades — D-101 (anual, Hacienda)', 'annual'),
    same('iva', 'IVA / D-104 (mensual o trimestral según clasificador)', 'monthly'),
    same('ccss', 'CCSS / SEM / IVM si hay planilla', 'monthly'),
  ]),
  p('CU', 'americas', 'Cuba', 'Cuba', 'Cuba', 'NIT / ONAT', 'Impuesto sobre ventas', ['Empresa estatal', 'MIPYME', 'CNA'], [
    o('util', 'Impuesto sobre utilidades (ONAT, anual)', 'Impuesto sobre utilidades', 'Imposto sobre lucros', 'annual'),
    o('ventas', 'Impuesto sobre las ventas / servicios (periodicidad ONAT)', 'Impuesto sobre ventas', 'Imposto sobre vendas', 'monthly'),
    o('fuerza', 'Impuesto por la utilización de la fuerza de trabajo', 'Fuerza de trabajo', 'Força de trabalho', 'monthly'),
  ]),
  p('DO', 'americas', 'Dominican Republic', 'República Dominicana', 'República Dominicana', 'RNC', 'ITBIS', ['SRL', 'SA', 'EIRL'], [
    same('isr', 'ISR personas jurídicas — IR-2 (anual, DGII)', 'annual'),
    same('itbis', 'ITBIS — declaración mensual', 'monthly'),
    same('tss', 'TSS / aportes de seguridad social (SUIR)', 'monthly'),
  ]),
  p('EC', 'americas', 'Ecuador', 'Ecuador', 'Equador', 'RUC', 'IVA', ['CIA. LTDA.', 'SA', 'SAS', 'Sociedad civil'], [
    same('renta', 'Impuesto a la renta sociedades — Formulario 101 (anual, SRI)', 'annual'),
    same('iva', 'IVA — Formulario 104 (mensual o semestral según tipo)', 'monthly'),
    same('ats', 'ATS / retenciones en la fuente (si aplica)', 'monthly'),
    same('iess', 'IESS planilla (si hay afiliados)', 'monthly'),
  ]),
  p('SV', 'americas', 'El Salvador', 'El Salvador', 'El Salvador', 'NIT', 'IVA', ['SRL de CV', 'SA de CV', 'Empresa individual'], [
    same('renta', 'Impuesto sobre la renta — declaración anual (DGII / MH)', 'annual'),
    same('iva', 'IVA — F-07 / declaración mensual', 'monthly'),
    same('isss', 'ISSS / AFP planilla', 'monthly'),
  ]),
  p('GT', 'americas', 'Guatemala', 'Guatemala', 'Guatemala', 'NIT', 'IVA', ['SRL', 'SA', 'Empresa individual'], [
    same('isr', 'ISR — régimen sobre las utilidades o opcional simplificado (SAT)', 'annual'),
    same('iva', 'IVA — libro de compras/ventas y declaración mensual', 'monthly'),
    same('igss', 'IGSS planilla (si hay trabajadores)', 'monthly'),
  ]),
  p('GY', 'americas', 'Guyana', 'Guyana', 'Guiana', 'TIN', 'VAT', ['Ltd', 'Partnership', 'Sole trader'], [
    same('cit', 'Corporation tax return (GRA, annual)', 'annual'),
    same('vat', 'VAT return (usually monthly)', 'monthly'),
    same('nis', 'NIS payroll contributions', 'monthly'),
  ]),
  p('HN', 'americas', 'Honduras', 'Honduras', 'Honduras', 'RTN', 'ISV', ['SRL', 'SA', 'Comerciante individual'], [
    same('isr', 'ISR — declaración anual (SAR / DEI)', 'annual'),
    same('isv', 'ISV — Impuesto sobre Ventas (mensual)', 'monthly'),
    same('rap', 'RAP / IHSS planilla', 'monthly'),
  ]),
  p('HT', 'americas', 'Haiti', 'Haití', 'Haiti', 'NIF / DGI', 'TCA', ['SA', 'SARL', 'Entreprise individuelle'], [
    o('irc', 'IRC — Impôt sur le revenu des sociétés (DGI, annuel)', 'IRC sociedades', 'IRC sociedades', 'annual'),
    same('tca', 'TCA — Taxe sur le chiffre d’affaires (mensuelle)', 'monthly'),
    o('ona', 'ONA / charges sociales si salariés', 'ONA / cargas sociales', 'ONA / encargos sociais', 'monthly'),
  ]),
  p('JM', 'americas', 'Jamaica', 'Jamaica', 'Jamaica', 'TRN', 'GCT', ['Ltd', 'Partnership', 'Sole trader'], [
    same('cit', 'Company income tax (TAJ, annual)', 'annual'),
    same('gct', 'GCT — General Consumption Tax return (usually monthly)', 'monthly'),
    same('paye', 'PAYE / NIS / NHT / Education tax (payroll)', 'monthly'),
  ]),
  p('MX', 'americas', 'Mexico', 'México', 'México', 'RFC', 'IVA', ['S.A. de C.V.', 'S. de R.L.', 'S.A.P.I.', 'Persona física con actividad'], [
    o('isr', 'ISR anual + pagos provisionales mensuales (SAT)', 'ISR anual y provisionales', 'ISR anual e provisionais', 'annual'),
    same('iva', 'IVA — declaración mensual', 'monthly'),
    same('diot', 'DIOT — información de operaciones con terceros (mensual)', 'monthly'),
    same('imss', 'IMSS / INFONAVIT / SUA (si hay trabajadores)', 'monthly'),
  ]),
  p('NI', 'americas', 'Nicaragua', 'Nicaragua', 'Nicarágua', 'RUC', 'IVA', ['SRL', 'SA', 'Empresa individual'], [
    same('ir', 'IR — Impuesto sobre la renta (anual, DGI)', 'annual'),
    same('iva', 'IVA — declaración mensual', 'monthly'),
    same('inss', 'INSS planilla', 'monthly'),
  ]),
  p('PA', 'americas', 'Panama', 'Panamá', 'Panamá', 'RUC', 'ITBMS', ['SRL', 'SA', 'LLC', 'Fundación de interés privado'], [
    o('isr', 'ISR — renta territorial (DGI, anual; aviso de operación)', 'ISR territorial anual', 'ISR territorial anual', 'annual'),
    same('itbms', 'ITBMS — declaración mensual', 'monthly'),
    same('css', 'CSS / seguro social (si hay planilla)', 'monthly'),
  ]),
  p('PY', 'americas', 'Paraguay', 'Paraguay', 'Paraguai', 'RUC', 'IVA', ['SRL', 'SA', 'Unipersonal', 'E.A.S.'], [
    o('ire', 'IRE — Impuesto a la Renta Empresarial (SET, anual; Ley 6380/2019, reemplaza IRACIS)', 'IRE anual', 'IRE anual', 'annual'),
    same('iva', 'IVA — declaración jurada mensual (Form. 120)', 'monthly'),
    o('irp', 'IRP si el dueño tributa como persona física (cuando aplica)', 'IRP si aplica', 'IRP se aplicável', 'annual'),
  ]),
  p('PE', 'americas', 'Peru', 'Perú', 'Peru', 'RUC', 'IGV', ['SAC', 'SRL', 'EIRL', 'SA'], [
    o('renta', 'Renta 3ª categoría — DJ anual (PDT 710 / Form. 710)', 'Renta 3ª anual', 'Renda 3ª anual', 'annual'),
    same('igv', 'IGV + pagos a cuenta de renta — PDT 621 (mensual)', 'monthly'),
    same('plame', 'PLAME / EsSalud / ONP o AFP (planilla)', 'monthly'),
  ]),
  p('SR', 'americas', 'Suriname', 'Surinam', 'Suriname', 'TIN', 'BTW / omzetbelasting', ['NV', 'Ltd', 'Eenmanszaak'], [
    o('winst', 'Winstbelasting / company income tax (annual, Belastingdienst)', 'Impuesto a la renta', 'Imposto sobre o lucro', 'annual'),
    same('btw', 'Omzetbelasting / BTW (usually monthly)', 'monthly'),
    same('aov', 'AOV / payroll social if employees', 'monthly'),
  ]),
  p('TT', 'americas', 'Trinidad and Tobago', 'Trinidad y Tobago', 'Trinidad e Tobago', 'BIR file', 'VAT', ['Ltd', 'Partnership', 'Sole trader'], [
    same('cit', 'Corporation tax return (BIR, annual)', 'annual'),
    same('vat', 'VAT return (usually quarterly or monthly by registration)', 'quarterly'),
    same('nis', 'NIS / PAYE payroll', 'monthly'),
  ]),
  p('US', 'americas', 'United States', 'Estados Unidos', 'Estados Unidos', 'EIN', 'State sales tax', ['LLC', 'C-Corp', 'S-Corp', 'Partnership', 'Sole proprietor'], [
    o('1120', 'Federal income tax — 1120 (C-Corp), 1120-S, 1065 or 1040 Sch. C according to entity', 'Impuesto federal según tipo de entidad', 'Imposto federal conforme o tipo de entidade', 'annual'),
    same('est', 'Estimated federal tax (1120-W / 1040-ES, quarterly if required)', 'quarterly'),
    o('5472', 'Form 5472 + pro forma 1120 if 25%+ foreign-owned US corp / disregarded entity', '5472 si hay dueño extranjero ≥25%', '5472 se sócio estrangeiro ≥25%', 'annual'),
    o('941', 'Employment tax Form 941 (and 940 FUTA) if you have employees', '941 / 940 si hay empleados', '941 / 940 se há empregados', 'quarterly'),
    o('state', 'State income / franchise tax and state/local sales tax where nexus exists', 'Impuesto estatal y sales tax', 'Imposto estadual e sales tax', 'annual'),
  ]),
  p('UY', 'americas', 'Uruguay', 'Uruguay', 'Uruguai', 'RUC', 'IVA', ['SRL', 'SA', 'SAS', 'Unipersonal', 'Cooperativa'], [
    same('irae', 'IRAE — declaración jurada anual (DGI)', 'annual'),
    o('iva', 'IVA — 2181 / declaración (mensual; algunos contribuyentes menor frecuencia)', 'IVA DGI', 'IVA DGI', 'monthly'),
    same('bps', 'Aportes BPS (mensual si hay actividad/dependientes)', 'monthly'),
    o('ip', 'IP — Impuesto al Patrimonio si corresponde al sujeto', 'IP si corresponde', 'IP se aplicável', 'annual'),
  ]),
  p('VE', 'americas', 'Venezuela', 'Venezuela', 'Venezuela', 'RIF', 'IVA', ['SRL', 'SA', 'Firma personal'], [
    same('islr', 'ISLR — Impuesto sobre la Renta (anual, SENIAT)', 'annual'),
    same('iva', 'IVA — declaración periódica SENIAT', 'monthly'),
    same('ivss', 'IVSS / FAOV / INCES si hay trabajadores', 'monthly'),
  ]),
  p('BZ', 'americas', 'Belize', 'Belice', 'Belize', 'TIN', 'GST', ['Ltd', 'IBC', 'Sole trader'], [
    same('btax', 'Business tax / company income tax (BTS, annual)', 'annual'),
    same('gst', 'GST return (usually monthly or quarterly)', 'quarterly'),
    same('ssb', 'Social Security Board if employees', 'monthly'),
  ]),
  p('BS', 'americas', 'Bahamas', 'Bahamas', 'Bahamas', 'TIN', 'VAT', ['Ltd', 'IBC', 'Partnership'], [
    o('bizlic', 'Business licence tax (no general CIT; licence is the main levy)', 'Licencia de negocio', 'Licença comercial', 'annual'),
    same('vat', 'VAT return (Department of Inland Revenue, usually monthly)', 'monthly'),
    same('nib', 'NIB contributions if employees', 'monthly'),
  ]),
  p('BB', 'americas', 'Barbados', 'Barbados', 'Barbados', 'TIN', 'VAT', ['Ltd', 'Society', 'Sole trader'], [
    same('cit', 'Corporation tax (BRA, annual)', 'annual'),
    same('vat', 'VAT return (usually monthly or quarterly)', 'quarterly'),
    same('nis', 'NIS / PAYE', 'monthly'),
  ]),

  // —— Europe ——
  p('AL', 'europe', 'Albania', 'Albania', 'Albânia', 'NUIS', 'TVSH', ['Sh.p.k.', 'Sh.A.', 'D.p.p.'], [
    same('fitim', 'Tatimi mbi fitimin (CIT, annual, DPT)', 'annual'),
    same('tvsh', 'TVSH / VAT (usually monthly)', 'monthly'),
    same('sig', 'Sigurime shoqërore / payroll', 'monthly'),
  ]),
  p('AT', 'europe', 'Austria', 'Austria', 'Áustria', 'UID / Steuernummer', 'USt', ['GmbH', 'AG', 'OG', 'KG'], [
    same('koest', 'Körperschaftsteuer (Jahreserklärung, BMF)', 'annual'),
    same('ust', 'Umsatzsteuervoranmeldung (usually monthly or quarterly)', 'monthly'),
    same('sv', 'ÖGK / SV-Beiträge (Lohnverrechnung)', 'monthly'),
    same('komm', 'Kommunalsteuer (Gemeinde, monthly with payroll)', 'monthly'),
  ]),
  p('BE', 'europe', 'Belgium', 'Bélgica', 'Bélgica', 'BCE / TVA', 'TVA / BTW', ['SRL/BV', 'SA/NV', 'SNC'], [
    o('is', 'ISoc / VenB — impôt des sociétés (SPF Finances, annuel)', 'Impuesto de sociedades', 'IRC belga', 'annual'),
    o('tva', 'TVA/BTW — déclaration (mensuelle ou trimestrielle)', 'IVA belga', 'IVA belga', 'quarterly'),
    same('onss', 'ONSS / RSZ cotisations sociales (mensuel)', 'monthly'),
  ]),
  p('BG', 'europe', 'Bulgaria', 'Bulgaria', 'Bulgária', 'ЕИК / ДДС номер', 'ДДС', ['ООД', 'ЕООД', 'АД'], [
    same('cit', 'Корпоративен данък (НАП, годишна)', 'annual'),
    same('dds', 'ДДС декларация (обикновено месечна)', 'monthly'),
    same('nap', 'Декларация 1 / осигуровки (месечно)', 'monthly'),
  ]),
  p('HR', 'europe', 'Croatia', 'Croacia', 'Croácia', 'OIB', 'PDV', ['d.o.o.', 'd.d.', 'j.d.o.o.'], [
    same('dobit', 'Porez na dobit (GFI / Porezna, godišnje)', 'annual'),
    same('pdv', 'PDV prijava (mjesečno ili tromjesečno)', 'monthly'),
    same('joppd', 'JOPPD / doprinosi (mjesečno)', 'monthly'),
  ]),
  p('CY', 'europe', 'Cyprus', 'Chipre', 'Chipre', 'TIC', 'VAT', ['Ltd', 'PLC'], [
    same('cit', 'Corporation tax (TD4, annual, Tax Dept.)', 'annual'),
    same('vat', 'VAT return (usually quarterly)', 'quarterly'),
    same('si', 'Social insurance / GHS (monthly)', 'monthly'),
  ]),
  p('CZ', 'europe', 'Czechia', 'Chequia', 'Chéquia', 'DIČ / IČO', 'DPH', ['s.r.o.', 'a.s.', 'v.o.s.'], [
    same('dppo', 'Daň z příjmů právnických osob (FÚ, roční)', 'annual'),
    same('dph', 'DPH přiznání (měsíčně nebo čtvrtletně)', 'monthly'),
    same('sz', 'Sociální a zdravotní pojištění (měsíčně)', 'monthly'),
  ]),
  p('DK', 'europe', 'Denmark', 'Dinamarca', 'Dinamarca', 'CVR / SE', 'Moms', ['ApS', 'A/S', 'IVS'], [
    same('selskab', 'Selskabsskat (SKAT, årlig)', 'annual'),
    same('moms', 'Momsangivelse (måned, kvartal eller halvår efter omsætning)', 'quarterly'),
    same('eindkomst', 'eIndkomst / ATP (månedlig)', 'monthly'),
  ]),
  p('EE', 'europe', 'Estonia', 'Estonia', 'Estónia', 'KMKR / registrikood', 'km', ['OÜ', 'AS', 'tü'], [
    o('cit', 'Tulumaks — on distributed profits only (not on retained earnings)', 'CIT solo sobre beneficios distribuidos', 'IRC só sobre lucros distribuídos', 'annual'),
    same('km', 'Käibemaksu deklaratsioon (KMD, tavaliselt kuu)', 'monthly'),
    same('tsd', 'TSD / sotsiaalmaks (kuu)', 'monthly'),
  ]),
  p('FI', 'europe', 'Finland', 'Finlandia', 'Finlândia', 'Y-tunnus / ALV', 'ALV', ['Oy', 'Oyj', 'Ay'], [
    same('ytunnus', 'Yhteisöjen tulovero (Vero, vuosi)', 'annual'),
    same('alv', 'ALV-ilmoitus (kuukausi, neljännes tai vuosi kynnysten mukaan)', 'monthly'),
    same('palkka', 'Palkkatietoilmoitus / TyEL / sotu (kuukausi)', 'monthly'),
  ]),
  p('FR', 'europe', 'France', 'Francia', 'França', 'SIRET / n° TVA', 'TVA', ['SARL', 'SAS', 'SA', 'EI', 'SCI'], [
    same('is', 'Impôt sur les sociétés — liasse fiscale 2065 (annuel, DGFiP)', 'annual'),
    o('tva', 'TVA — CA3 mensuelle (ou CA12 annuelle si régime simplifié)', 'TVA CA3/CA12', 'TVA CA3/CA12', 'monthly'),
    same('dsn', 'DSN / URSSAF (mensuel si salariés)', 'monthly'),
    same('cfe', 'CFE / CVAE (impôts locaux, annuel)', 'annual'),
  ]),
  p('DE', 'europe', 'Germany', 'Alemania', 'Alemanha', 'Steuernummer / USt-IdNr.', 'USt', ['GmbH', 'UG', 'AG', 'GbR', 'KG'], [
    same('kst', 'Körperschaftsteuererklärung (jährlich, FA)', 'annual'),
    same('gewst', 'Gewerbesteuererklärung (Gemeinde / FA, jährlich)', 'annual'),
    o('ust', 'Umsatzsteuervoranmeldung (monatlich oder vierteljährlich nach Volumen)', 'USt-Voranmeldung', 'USt-Voranmeldung', 'monthly'),
    same('lohn', 'Lohnsteuer-Anmeldung + SV-Beiträge (monatlich)', 'monthly'),
  ]),
  p('GR', 'europe', 'Greece', 'Grecia', 'Grécia', 'ΑΦΜ', 'ΦΠΑ', ['ΙΚΕ', 'ΑΕ', 'ΕΠΕ', 'ΟΕ'], [
    o('foros', 'Φόρος εισοδήματος νομικών προσώπων (ΑΑΔΕ, ετήσια)', 'Impuesto sociedades', 'IRC grego', 'annual'),
    same('fpa', 'Δήλωση ΦΠΑ (μηνιαία ή τριμηνιαία)', 'monthly'),
    same('efka', 'ΕΦΚΑ / ΑΠΔ (μηνιαία)', 'monthly'),
  ]),
  p('HU', 'europe', 'Hungary', 'Hungría', 'Hungria', 'Adószám', 'ÁFA', ['Kft.', 'Zrt.', 'Bt.'], [
    same('tao', 'Társasági adó (NAV, éves)', 'annual'),
    same('afa', 'ÁFA bevallás (havi vagy negyedéves)', 'monthly'),
    same('jarulek', 'Járulékbevallás / 08-as (havi)', 'monthly'),
  ]),
  p('IS', 'europe', 'Iceland', 'Islandia', 'Islândia', 'Kennitala / VSK', 'VSK', ['ehf.', 'hf.', 'sf.'], [
    same('tekju', 'Tekjuskattur lögaðila (RSK, árlegt)', 'annual'),
    same('vsk', 'VSK-skýrsla (venjulega tví-mánaðarlega)', 'bimonthly'),
    same('trygging', 'Tryggingagjald / staðgreiðsla (mánaðarlega)', 'monthly'),
  ]),
  p('IE', 'europe', 'Ireland', 'Irlanda', 'Irlanda', 'CRO / VAT', 'VAT', ['Ltd', 'DAC', 'PLC', 'Unlimited'], [
    same('ct', 'Corporation Tax CT1 (Revenue, annual)', 'annual'),
    same('vat', 'VAT3 (bimonthly for most; some monthly/annual)', 'bimonthly'),
    same('paye', 'PAYE / PRSI / USC (monthly via ROS)', 'monthly'),
    same('cro', 'CRO annual return', 'annual'),
  ]),
  p('IT', 'europe', 'Italy', 'Italia', 'Itália', 'P. IVA / CF', 'IVA', ['Srl', 'Spa', 'Snc', 'Sas'], [
    same('ires', 'IRES (modello Redditi SC, annuale, AdE)', 'annual'),
    same('irap', 'IRAP regionale (annuale)', 'annual'),
    o('iva', 'Liquidazione IVA (mensile o trimestrale) + LIPE', 'IVA mensile/trimestrale', 'IVA mensal/trimestral', 'monthly'),
    same('f24', 'F24 ritenute / INPS / INAIL (mensile se dipendenti)', 'monthly'),
  ]),
  p('LV', 'europe', 'Latvia', 'Letonia', 'Letónia', 'PVN / reģ. nr.', 'PVN', ['SIA', 'AS', 'IK'], [
    same('uin', 'Uzņēmumu ienākuma nodoklis (VID, gada)', 'annual'),
    same('pvn', 'PVN deklarācija (mēnesis vai ceturksnis)', 'monthly'),
    same('vsaoi', 'VSAOI / darba alga (mēnesis)', 'monthly'),
  ]),
  p('LT', 'europe', 'Lithuania', 'Lituania', 'Lituânia', 'PVM kodas', 'PVM', ['UAB', 'AB', 'IĮ'], [
    same('pelno', 'Pelno mokestis (VMI, metinis)', 'annual'),
    same('pvm', 'PVM deklaracija (mėnesio arba ketvirčio)', 'monthly'),
    same('sodra', 'Sodra / GPM (mėnesio)', 'monthly'),
  ]),
  p('LU', 'europe', 'Luxembourg', 'Luxemburgo', 'Luxemburgo', 'Matricule / TVA', 'TVA', ['Sàrl', 'SA', 'SECS'], [
    same('irc', 'IRC / impôt sur le revenu des collectivités (ACD, annuel)', 'annual'),
    same('tva', 'TVA (mensuelle ou trimestrielle)', 'monthly'),
    same('ccss', 'CCSS / CNS (mensuel)', 'monthly'),
  ]),
  p('MT', 'europe', 'Malta', 'Malta', 'Malta', 'PE number', 'VAT', ['Ltd', 'PLC'], [
    same('itax', 'Income tax return (CfR, annual; imputation system)', 'annual'),
    same('vat', 'VAT return (usually quarterly)', 'quarterly'),
    same('fss', 'FSS / social security (monthly)', 'monthly'),
  ]),
  p('MD', 'europe', 'Moldova', 'Moldavia', 'Moldávia', 'IDNO / TVA', 'TVA', ['SRL', 'SA', 'ÎI'], [
    same('profit', 'Impozitul pe venit al persoanelor juridice (SFS, anual)', 'annual'),
    same('tva', 'Declarație TVA (lunar)', 'monthly'),
    same('cas', 'CAS / contribuții salariale (lunar)', 'monthly'),
  ]),
  p('NL', 'europe', 'Netherlands', 'Países Bajos', 'Países Baixos', 'RSIN / btw-id', 'btw', ['BV', 'NV', 'VOF', 'Eenmanszaak'], [
    same('vpb', 'Vennootschapsbelasting VPB (aangifte, jaar, Belastingdienst)', 'annual'),
    same('btw', 'btw-aangifte (maand of kwartaal)', 'quarterly'),
    same('lh', 'Loonheffingen (maand)', 'monthly'),
    same('kvk', 'KVK jaarrekening / deponering', 'annual'),
  ]),
  p('NO', 'europe', 'Norway', 'Noruega', 'Noruega', 'Org.nr / MVA', 'MVA', ['AS', 'ASA', 'ANS'], [
    same('skatt', 'Selskapsskatt (RF-1028 / skattemelding, årlig)', 'annual'),
    same('mva', 'MVA-melding (vanligvis annenhver måned)', 'bimonthly'),
    same('amelding', 'A-melding (månedlig, lønn og avgift)', 'monthly'),
  ]),
  p('PL', 'europe', 'Poland', 'Polonia', 'Polónia', 'NIP / REGON', 'VAT', ['sp. z o.o.', 'S.A.', 'sp.j.'], [
    same('cit', 'CIT-8 (roczne, KAS)', 'annual'),
    same('jpk', 'JPK_V7M / JPK_V7K (miesiąc lub kwartał)', 'monthly'),
    same('zus', 'ZUS DRA / PIT-4R zaliczki (miesiąc)', 'monthly'),
  ]),
  p('PT', 'europe', 'Portugal', 'Portugal', 'Portugal', 'NIPC / NIF', 'IVA', ['Lda', 'SA', 'ENI', 'Cooperativa'], [
    same('irc', 'IRC — Modelo 22 (anual, AT)', 'annual'),
    o('iva', 'IVA — declaração periódica (mensal ou trimestral pelo volume)', 'IVA periódico', 'IVA periódico', 'monthly'),
    same('ies', 'IES / prestação de contas (anual)', 'annual'),
    same('ss', 'Segurança Social DR / TSUs (mensal se trabalhadores)', 'monthly'),
  ]),
  p('RO', 'europe', 'Romania', 'Rumanía', 'Roménia', 'CUI / CIF', 'TVA', ['SRL', 'SA', 'PFA'], [
    same('profit', 'Impozit pe profit (D101 anual; plăți anticipate)', 'annual'),
    same('tva', 'Decont TVA D300 (lunar sau trimestrial)', 'monthly'),
    same('d112', 'D112 contribuții salariale (lunar)', 'monthly'),
  ]),
  p('RU', 'europe', 'Russia', 'Rusia', 'Rússia', 'ИНН / КПП', 'НДС', ['ООО', 'АО', 'ИП'], [
    same('np', 'Налог на прибыль (ФНС, год; авансы квартал/месяц)', 'annual'),
    same('nds', 'НДС декларация (квартал)', 'quarterly'),
    same('rsv', 'РСВ / страховые взносы (месяц)', 'monthly'),
    same('ndfl', '6-НДФЛ (если есть работники)', 'quarterly'),
  ]),
  p('RS', 'europe', 'Serbia', 'Serbia', 'Sérvia', 'PIB / MB', 'PDV', ['d.o.o.', 'a.d.', 'preduzetnik'], [
    same('dobit', 'Porez na dobit (PPDG, godišnje, PURS)', 'annual'),
    same('pdv', 'PDV prijava (mesečno ili tromesečno)', 'monthly'),
    same('pio', 'PIO / doprinosi (mesečno)', 'monthly'),
  ]),
  p('SK', 'europe', 'Slovakia', 'Eslovaquia', 'Eslováquia', 'IČ DPH / IČO', 'DPH', ['s.r.o.', 'a.s.', 'v.o.s.'], [
    same('dp', 'Daň z príjmov PO (FS, ročné)', 'annual'),
    same('dph', 'DPH priznanie (mesačne alebo štvrťročne)', 'monthly'),
    same('soc', 'Sociálna a zdravotná poisťovňa (mesačne)', 'monthly'),
  ]),
  p('SI', 'europe', 'Slovenia', 'Eslovenia', 'Eslovénia', 'Davčna št. / ID za DDV', 'DDV', ['d.o.o.', 'd.d.', 's.p.'], [
    same('ddpo', 'Davek od dohodkov pravnih oseb (FURS, letno)', 'annual'),
    same('ddv', 'DDV-O (mesečno ali četrtletno)', 'monthly'),
    same('zpiz', 'REK-1 / prispevki (mesečno)', 'monthly'),
  ]),
  p('ES', 'europe', 'Spain', 'España', 'Espanha', 'NIF / CIF', 'IVA', ['SL', 'SA', 'Autónomo societario', 'Cooperativa'], [
    same('mod200', 'Impuesto sobre Sociedades — modelo 200 (anual, AEAT)', 'annual'),
    same('mod202', 'Pagos fraccionados IS — modelo 202 (trimestral si toca)', 'quarterly'),
    o('mod303', 'IVA modelo 303 (trimestral; mensual si REDEME)', 'IVA 303', 'IVA 303', 'quarterly'),
    same('mod111', 'Retenciones trabajo/profesionales 111 / 190 (trimestral/anual)', 'quarterly'),
  ]),
  p('SE', 'europe', 'Sweden', 'Suecia', 'Suécia', 'Org.nr / momsnr', 'moms', ['AB', 'HB', 'KB'], [
    same('bolag', 'Bolagsskatt (Inkomstdeklaration 2, Skatteverket, årlig)', 'annual'),
    same('moms', 'Momsdeklaration (månad, kvartal eller år)', 'quarterly'),
    same('ag', 'Arbetsgivardeklaration (månad)', 'monthly'),
  ]),
  p('CH', 'europe', 'Switzerland', 'Suiza', 'Suíça', 'UID / MWST-Nr.', 'MWST / TVA / IVA', ['GmbH / Sàrl', 'AG / SA', 'Einzelfirma'], [
    o('gewinn', 'Gewinnsteuer Bund + Kanton/Gemeinde (jährlich)', 'Impuesto sobre el beneficio', 'Imposto sobre o lucro', 'annual'),
    o('mwst', 'MWST-Abrechnung (in der Regel quartalsweise)', 'IVA suiza trimestral', 'IVA suíça trimestral', 'quarterly'),
    same('ahv', 'AHV/IV/EO + BVG (monatlich bei Lohn)', 'monthly'),
  ]),
  p('UA', 'europe', 'Ukraine', 'Ucrania', 'Ucrânia', 'ЄДРПОУ / ІПН', 'ПДВ', ['ТОВ', 'ПрАТ', 'ФОП'], [
    same('profit', 'Податок на прибуток (ДПС, річна / квартальна за системою)', 'annual'),
    same('pdv', 'Декларація ПДВ (місячна)', 'monthly'),
    same('esv', 'ЄСВ (місячна)', 'monthly'),
  ]),
  p('GB', 'europe', 'United Kingdom', 'Reino Unido', 'Reino Unido', 'UTR / VAT / CRN', 'VAT', ['Ltd', 'LLP', 'PLC', 'Sole trader'], [
    same('ct600', 'Corporation Tax CT600 (HMRC, annual; 9 months after year-end)', 'annual'),
    o('vat', 'VAT return (usually quarterly; some monthly/annual)', 'IVA británica', 'IVA britânica', 'quarterly'),
    same('paye', 'PAYE / NIC via FPS (usually monthly)', 'monthly'),
    same('ch', 'Companies House accounts + confirmation statement', 'annual'),
  ]),

  // —— Africa ——
  p('DZ', 'africa', 'Algeria', 'Argelia', 'Argélia', 'NIF / NIS', 'TVA', ['SPA', 'SARL', 'EURL'], [
    same('ibs', 'IBS — Impôt sur les bénéfices des sociétés (DGI, annuel)', 'annual'),
    same('tva', 'TVA G50 (mensuelle)', 'monthly'),
    same('casnos', 'CASNOS / CNAS (mensuel si salariés)', 'monthly'),
  ]),
  p('AO', 'africa', 'Angola', 'Angola', 'Angola', 'NIF', 'IVA', ['SA', 'Lda', 'SU Lda'], [
    same('irt', 'IRT / Imposto Industrial (AGT, anual)', 'annual'),
    same('iva', 'IVA — declaração periódica (mensal)', 'monthly'),
    same('inss', 'INSS (mensal)', 'monthly'),
  ]),
  p('BW', 'africa', 'Botswana', 'Botsuana', 'Botsuana', 'TIN', 'VAT', ['Pty Ltd', 'Close company'], [
    same('cit', 'Company income tax (BURS, annual)', 'annual'),
    same('vat', 'VAT return (usually bimonthly)', 'bimonthly'),
    same('paye', 'PAYE (monthly)', 'monthly'),
  ]),
  p('CM', 'africa', 'Cameroon', 'Camerún', 'Camarões', 'NIU', 'TVA', ['SA', 'SARL', 'SAS'], [
    same('is', 'Impôt sur les sociétés (DGI, annuel)', 'annual'),
    same('tva', 'TVA (mensuelle)', 'monthly'),
    same('cnps', 'CNPS (mensuel)', 'monthly'),
  ]),
  p('CI', 'africa', "Côte d'Ivoire", 'Costa de Marfil', 'Costa do Marfim', 'NCC / IFU', 'TVA', ['SA', 'SARL', 'SAS'], [
    same('bic', 'BIC / IS (DGI, annuel)', 'annual'),
    same('tva', 'TVA (mensuelle)', 'monthly'),
    same('cnps', 'CNPS / ITS (mensuel)', 'monthly'),
  ]),
  p('EG', 'africa', 'Egypt', 'Egipto', 'Egito', 'Tax card / VAT', 'VAT', ['SAE', 'LLC', 'JSC'], [
    same('cit', 'Corporate income tax (ETA, annual)', 'annual'),
    same('vat', 'VAT return (usually monthly)', 'monthly'),
    same('si', 'Social insurance Form 2 (monthly)', 'monthly'),
  ]),
  p('ET', 'africa', 'Ethiopia', 'Etiopía', 'Etiópia', 'TIN', 'VAT', ['PLC', 'Share co.', 'SC'], [
    same('cit', 'Business income tax (MoR, annual)', 'annual'),
    same('vat', 'VAT declaration (monthly)', 'monthly'),
    same('pen', 'Pension / employment income tax withholding', 'monthly'),
  ]),
  p('GH', 'africa', 'Ghana', 'Ghana', 'Gana', 'TIN', 'VAT', ['Ltd', 'Company limited by guarantee'], [
    same('cit', 'Company income tax (GRA, annual) + self-assessment instalments', 'annual'),
    same('vat', 'VAT return (monthly)', 'monthly'),
    same('ssnit', 'SSNIT / PAYE (monthly)', 'monthly'),
  ]),
  p('KE', 'africa', 'Kenya', 'Kenia', 'Quénia', 'PIN', 'VAT', ['Ltd', 'LLP', 'PLC'], [
    same('cit', 'Corporation tax (KRA iTax, annual) + instalment tax', 'annual'),
    same('vat', 'VAT return (monthly)', 'monthly'),
    same('paye', 'PAYE / NSSF / SHIF (NHIF successor) monthly', 'monthly'),
  ]),
  p('MA', 'africa', 'Morocco', 'Marruecos', 'Marrocos', 'IF / ICE', 'TVA', ['SA', 'SARL', 'SAS'], [
    same('is', 'IS — Impôt sur les sociétés (DGI, annuel)', 'annual'),
    same('tva', 'TVA (mensuelle ou trimestrielle)', 'monthly'),
    same('cnss', 'CNSS (mensuel)', 'monthly'),
  ]),
  p('MU', 'africa', 'Mauritius', 'Mauricio', 'Maurícia', 'BRN / TAN', 'VAT', ['Ltd', 'GBL', 'PLC'], [
    same('cit', 'Company income tax (MRA, annual; 15% headline)', 'annual'),
    same('vat', 'VAT return (usually monthly or quarterly)', 'quarterly'),
    same('nps', 'NSF / PAYE (monthly)', 'monthly'),
  ]),
  p('MZ', 'africa', 'Mozambique', 'Mozambique', 'Moçambique', 'NUIT', 'IVA', ['SA', 'Lda', 'SU'], [
    same('irpc', 'IRPC (AT, anual)', 'annual'),
    same('iva', 'IVA (mensal)', 'monthly'),
    same('inss', 'INSS (mensal)', 'monthly'),
  ]),
  p('NA', 'africa', 'Namibia', 'Namibia', 'Namíbia', 'TIN', 'VAT', ['Pty Ltd', 'CC'], [
    same('cit', 'Company income tax (NamRA, annual)', 'annual'),
    same('vat', 'VAT return (usually bimonthly)', 'bimonthly'),
    same('paye', 'PAYE / SSC (monthly)', 'monthly'),
  ]),
  p('NG', 'africa', 'Nigeria', 'Nigeria', 'Nigéria', 'TIN / RC', 'VAT', ['Ltd', 'PLC', 'Ltd/Gte'], [
    same('cit', 'Companies Income Tax (FIRS, annual) + Tertiary Education Tax', 'annual'),
    same('vat', 'VAT return (monthly, FIRS)', 'monthly'),
    same('paye', 'PAYE / pension / NHF (state + PenCom, monthly)', 'monthly'),
    same('wht', 'WHT returns (usually monthly)', 'monthly'),
  ]),
  p('RW', 'africa', 'Rwanda', 'Ruanda', 'Ruanda', 'TIN', 'VAT', ['Ltd', 'Ltd by guarantee'], [
    same('cit', 'Corporate income tax (RRA, annual)', 'annual'),
    same('vat', 'VAT (monthly or quarterly by threshold)', 'monthly'),
    same('rssb', 'RSSB / PAYE (monthly)', 'monthly'),
  ]),
  p('SN', 'africa', 'Senegal', 'Senegal', 'Senegal', 'NINEA', 'TVA', ['SA', 'SARL', 'SAS'], [
    same('is', 'IS (DGID, annuel)', 'annual'),
    same('tva', 'TVA (mensuelle)', 'monthly'),
    same('ipres', 'IPRES / CSS (mensuel)', 'monthly'),
  ]),
  p('ZA', 'africa', 'South Africa', 'Sudáfrica', 'África do Sul', 'Income tax ref. / VAT', 'VAT', ['Pty Ltd', 'Ltd', 'NPC', 'CC'], [
    same('itr14', 'ITR14 company return (SARS, annual)', 'annual'),
    o('vat201', 'VAT201 (1 or 2-month cycle assigned by SARS)', 'VAT201', 'VAT201', 'bimonthly'),
    same('emp201', 'EMP201 PAYE / SDL / UIF (monthly)', 'monthly'),
    same('cipc', 'CIPC annual return', 'annual'),
  ]),
  p('TZ', 'africa', 'Tanzania', 'Tanzania', 'Tanzânia', 'TIN', 'VAT', ['Ltd', 'PLC'], [
    same('cit', 'Corporate tax (TRA, annual) + instalments', 'annual'),
    same('vat', 'VAT return (monthly)', 'monthly'),
    same('paye', 'PAYE / NSSF / SDL (monthly)', 'monthly'),
  ]),
  p('TN', 'africa', 'Tunisia', 'Túnez', 'Tunísia', 'MF / matricule fiscal', 'TVA', ['SA', 'SARL', 'SUARL'], [
    same('is', 'Impôt sur les sociétés (DGI, annuel)', 'annual'),
    same('tva', 'TVA (mensuelle)', 'monthly'),
    same('cnss', 'CNSS (trimestriel / mensuel selon effectif)', 'monthly'),
  ]),
  p('UG', 'africa', 'Uganda', 'Uganda', 'Uganda', 'TIN', 'VAT', ['Ltd', 'Ltd by guarantee'], [
    same('cit', 'Company income tax (URA, annual)', 'annual'),
    same('vat', 'VAT return (monthly)', 'monthly'),
    same('paye', 'PAYE / NSSF (monthly)', 'monthly'),
  ]),
  p('ZW', 'africa', 'Zimbabwe', 'Zimbabue', 'Zimbabué', 'BP number', 'VAT', ['Pvt Ltd', 'Ltd'], [
    same('cit', 'Company tax (ZIMRA, annual) + QPD', 'annual'),
    same('vat', 'VAT return (usually monthly)', 'monthly'),
    same('paye', 'PAYE / NSSA (monthly)', 'monthly'),
  ]),

  // —— Middle East ——
  p('BH', 'middleeast', 'Bahrain', 'Baréin', 'Barém', 'CR', 'VAT', ['WLL', 'BSC', 'SPC'], [
    o('cit', 'No general CIT on most local companies; foreign oil/gas and some branches are exceptions', 'Sin IS general (salvo sectores)', 'Sem IRC geral (exceto setores)', 'annual'),
    same('vat', 'VAT return (NBR, usually quarterly)', 'quarterly'),
    same('sio', 'SIO social insurance if employees', 'monthly'),
  ]),
  p('IR', 'middleeast', 'Iran', 'Irán', 'Irão', 'شناسه ملی / اقتصادی', 'مالیات بر ارزش افزوده', ['سهامی', 'با مسئولیت محدود'], [
    o('cit', 'مالیات عملکرد اشخاص حقوقی (سالیانه، سازمان امور مالیاتی)', 'Impuesto sociedades', 'IRC', 'annual'),
    same('vat', 'اظهارنامه ارزش افزوده (فصلی)', 'quarterly'),
    same('ins', 'حق بیمه تامین اجتماعی (ماهانه)', 'monthly'),
  ]),
  p('IQ', 'middleeast', 'Iraq', 'Irak', 'Iraque', 'Tax ID', 'Sales tax / VAT pilots', ['LLC', 'JSC'], [
    same('cit', 'Corporate income tax (GCT, annual)', 'annual'),
    o('stax', 'Sales tax / withholding as administered by GCT', 'Impuesto a las ventas', 'Imposto sobre vendas', 'monthly'),
    same('ss', 'Social security if employees', 'monthly'),
  ]),
  p('IL', 'middleeast', 'Israel', 'Israel', 'Israel', 'ח.פ. / עוסק', 'מע״מ', ['בע״מ', 'שותפות', 'עוסק מורשה'], [
    same('mas', 'מס חברות (שנתי, רשות המסים) + מקדמות', 'annual'),
    same('maam', 'מע״מ (בדרך כלל דו-חודשי או חודשי)', 'bimonthly'),
    same('bituach', 'ביטוח לאומי / ניכוי מס במקור משכר', 'monthly'),
  ]),
  p('JO', 'middleeast', 'Jordan', 'Jordania', 'Jordânia', 'National ID / TIN', 'GST / sales tax', ['LLC', 'PLC'], [
    same('cit', 'Income tax on companies (ISTD, annual)', 'annual'),
    same('gst', 'General sales tax return (usually monthly)', 'monthly'),
    same('ssc', 'SSC contributions (monthly)', 'monthly'),
  ]),
  p('KW', 'middleeast', 'Kuwait', 'Kuwait', 'Kuwait', 'Civil ID / Tax card', 'No VAT (as of 2025)', ['WLL', 'KSC', 'KSC Closed'], [
    o('cit', 'CIT mainly on foreign corporate bodies; Kuwaiti-owned companies follow DL 3/1955 / Zakat-type rules as applicable', 'IS principalmente a extranjeras', 'IRC sobretudo a estrangeiras', 'annual'),
    o('vat', 'VAT not in force — do not file a VAT return unless a GCC levy is later enacted', 'IVA no vigente', 'IVA não vigente', 'once'),
    same('pifss', 'PIFSS / labor if employees', 'monthly'),
  ]),
  p('LB', 'middleeast', 'Lebanon', 'Líbano', 'Líbano', 'MOF number', 'TVA', ['SAL', 'SARL', 'SNC'], [
    same('is', 'Impôt sur les sociétés (Ministère des Finances, annuel)', 'annual'),
    same('tva', 'TVA (trimestrielle)', 'quarterly'),
    same('cnss', 'CNSS (trimestriel)', 'quarterly'),
  ]),
  p('OM', 'middleeast', 'Oman', 'Omán', 'Omã', 'Tax card / CR', 'VAT', ['LLC', 'SAOC', 'SAOG'], [
    same('cit', 'Income tax return (Tax Authority, annual)', 'annual'),
    same('vat', 'VAT return (usually quarterly)', 'quarterly'),
    same('pas', 'PASI social insurance (monthly)', 'monthly'),
  ]),
  p('QA', 'middleeast', 'Qatar', 'Catar', 'Catar', 'TIN / CR', 'VAT', ['LLC', 'QFC', 'PJSC'], [
    same('cit', 'Corporate income tax (GTA, annual; local Qatari share often exempt)', 'annual'),
    same('vat', 'VAT return (usually monthly or quarterly)', 'quarterly'),
    same('grsia', 'GOSI / Qatari pension if applicable', 'monthly'),
  ]),
  p('SA', 'middleeast', 'Saudi Arabia', 'Arabia Saudita', 'Arábia Saudita', 'TIN / 700', 'VAT', ['LLC', 'JSC', 'Sole proprietorship'], [
    o('zakat', 'Zakat (Saudi/GCC owned) or CIT (foreign share) — ZATCA, annual + instalments', 'Zakat o IS', 'Zakat ou IRC', 'annual'),
    same('vat', 'VAT return (usually monthly or quarterly by size)', 'quarterly'),
    same('gosi', 'GOSI (monthly)', 'monthly'),
    same('wht', 'WHT statements (monthly if paying non-residents)', 'monthly'),
  ]),
  p('TR', 'middleeast', 'Turkey', 'Turquía', 'Turquia', 'VKN', 'KDV', ['A.Ş.', 'Ltd. Şti.', 'Kooperatif'], [
    same('kv', 'Kurumlar vergisi beyannamesi (GİB, yıllık) + geçici vergi', 'annual'),
    same('kdv', 'KDV beyannamesi (aylık)', 'monthly'),
    same('muhtasar', 'Muhtasar ve prim hizmet (aylık)', 'monthly'),
    same('sgk', 'SGK bildirgesi (aylık)', 'monthly'),
  ]),
  p('AE', 'middleeast', 'United Arab Emirates', 'Emiratos Árabes Unidos', 'Emirados Árabes Unidos', 'TRN / licence', 'VAT', ['LLC', 'Free zone Co.', 'PJSC', 'Sole est.'], [
    o('cit', 'Federal Corporate Tax return (FTA, annual; 9% above threshold since 2023)', 'IS federal FTA', 'IRC federal FTA', 'annual'),
    o('vat', 'VAT return (usually quarterly; some monthly)', 'IVA FTA', 'IVA FTA', 'quarterly'),
    same('wp', 'Wages protection / GPSSA where employees in mainland', 'monthly'),
  ]),

  // —— Asia ——
  p('BD', 'asia', 'Bangladesh', 'Bangladés', 'Bangladeche', 'TIN / BIN', 'VAT (Mushak)', ['Ltd', 'PLC'], [
    same('cit', 'Company income tax (NBR, annual) + advance tax', 'annual'),
    same('mushak', 'Mushak VAT return (usually monthly)', 'monthly'),
    same('tds', 'TDS statements', 'monthly'),
  ]),
  p('KH', 'asia', 'Cambodia', 'Camboya', 'Camboja', 'VAT TIN', 'VAT', ['Co. Ltd', 'PLC'], [
    same('cit', 'Tax on income (GDT, annual) + prepayments', 'annual'),
    same('vat', 'VAT return (monthly)', 'monthly'),
    same('toes', 'Tax on salary withholding (monthly)', 'monthly'),
  ]),
  p('CN', 'asia', 'China', 'China', 'China', '统一社会信用代码', '增值税', ['有限公司', '股份公司', 'WFOE'], [
    o('eit', '企业所得税 — 季度预缴 + 汇算清缴（税务局）', 'EIT trimestral + anual', 'EIT trimestral + anual', 'quarterly'),
    same('vat', '增值税申报（一般计税通常月度）', 'monthly'),
    same('iit', '个人所得税代扣 + 社保公积金（月度）', 'monthly'),
  ]),
  p('HK', 'asia', 'Hong Kong', 'Hong Kong', 'Hong Kong', 'BRN / TIN', 'None (no GST/VAT)', ['Ltd', 'Unlimited'], [
    same('profits', 'Profits Tax Return BIR51 (IRD, annual) — territorial source', 'annual'),
    o('gst', 'No GST/VAT return in Hong Kong', 'No hay IVA/GST', 'Não há IVA/GST', 'once'),
    same('mpf', 'MPF (mandatory monthly if employees)', 'monthly'),
    same('ir56b', "Employer's Return IR56B (annual)", 'annual'),
  ]),
  p('IN', 'asia', 'India', 'India', 'Índia', 'PAN / GSTIN / CIN', 'GST', ['Pvt Ltd', 'Ltd', 'LLP', 'OPC'], [
    same('itr6', 'ITR-6 / company income tax (Income Tax Dept., annual)', 'annual'),
    same('adv', 'Advance tax (usually 4 instalments)', 'quarterly'),
    o('gst', 'GSTR-1 + GSTR-3B (monthly; QRMP quarterly for small)', 'GSTR mensal/trimestral', 'GSTR mensal/trimestral', 'monthly'),
    same('tds', 'TDS (24Q/26Q) monthly + 24Q annual', 'monthly'),
    same('mca', 'MCA AOC-4 / MGT-7 (annual)', 'annual'),
  ]),
  p('ID', 'asia', 'Indonesia', 'Indonesia', 'Indonésia', 'NPWP / NITKU', 'PPN', ['PT', 'PT Tbk', 'CV', 'PMA'], [
    same('pphbadan', 'SPT Tahunan PPh Badan 1771 (DJP, tahunan)', 'annual'),
    same('ppn', 'SPT Masa PPN (bulanan)', 'monthly'),
    same('pph21', 'PPh 21 / BPJS Ketenagakerjaan & Kesehatan (bulanan)', 'monthly'),
  ]),
  p('JP', 'asia', 'Japan', 'Japón', 'Japão', '法人番号 / 登録番号', '消費税', ['株式会社', '合同会社', '有限会社'], [
    same('hojin', '法人税・地方法人税の申告（税務署、事業年度）', 'annual'),
    same('shohi', '消費税の申告（原則確定申告；中間申告あり）', 'annual'),
    same('gensen', '源泉所得税の納付（原則毎月；納期の特例は半年）', 'monthly'),
    same('shaho', '社会保険・労働保険（月次）', 'monthly'),
  ]),
  p('KZ', 'asia', 'Kazakhstan', 'Kazajistán', 'Cazaquistão', 'BIN / IIN', 'НДС', ['ТОО', 'АО', 'ИП'], [
    same('kpnu', 'КПН — корпоративный подоходный налог (КГД, год)', 'annual'),
    same('nds', 'НДС декларация (квартал)', 'quarterly'),
    same('opv', 'ОПВ / соцналог (месяц)', 'monthly'),
  ]),
  p('MY', 'asia', 'Malaysia', 'Malasia', 'Malásia', 'TIN / SST', 'SST', ['Sdn Bhd', 'Bhd', 'LLP'], [
    same('formc', 'Form C / company tax (LHDN, annual) + CP204 estimates', 'annual'),
    o('sst', 'SST-02 if SST-registered (sales/service tax, usually bimonthly)', 'SST', 'SST', 'bimonthly'),
    same('epf', 'EPF / SOCSO / EIS (monthly)', 'monthly'),
  ]),
  p('MN', 'asia', 'Mongolia', 'Mongolia', 'Mongólia', 'TIN', 'VAT', ['ХХК', 'ХК'], [
    same('cit', 'Corporate income tax (MTA, annual)', 'annual'),
    same('vat', 'VAT return (monthly)', 'monthly'),
    same('si', 'Social insurance (monthly)', 'monthly'),
  ]),
  p('MM', 'asia', 'Myanmar', 'Myanmar', 'Mianmar', 'TIN', 'Commercial tax', ['Ltd', 'JVC'], [
    same('cit', 'Company income tax (IRD, annual)', 'annual'),
    same('ctax', 'Commercial tax return (usually monthly)', 'monthly'),
    same('ssb', 'SSB if employees', 'monthly'),
  ]),
  p('NP', 'asia', 'Nepal', 'Nepal', 'Nepal', 'PAN / VAT', 'VAT', ['Pvt Ltd', 'Ltd'], [
    same('cit', 'Company income tax (IRD, annual)', 'annual'),
    same('vat', 'VAT return (usually monthly)', 'monthly'),
    same('ssf', 'SSF / CIT withholding on salary', 'monthly'),
  ]),
  p('PK', 'asia', 'Pakistan', 'Pakistán', 'Paquistão', 'NTN / STRN', 'Sales tax', ['Pvt Ltd', 'Ltd', 'SMC'], [
    same('cit', 'Income tax return (FBR, annual) + advance tax', 'annual'),
    same('stax', 'Sales tax return (usually monthly)', 'monthly'),
    same('wht', 'Withholding statements (monthly)', 'monthly'),
  ]),
  p('PH', 'asia', 'Philippines', 'Filipinas', 'Filipinas', 'TIN', 'VAT', ['Inc.', 'Corp.', 'OPC', 'Partnership'], [
    same('1702', 'Annual ITR 1702 (BIR) + quarterly 1702Q', 'annual'),
    same('2550', 'VAT 2550M / 2550Q', 'monthly'),
    same('1601', 'Withholding 1601-C / 1601-EQ (monthly/quarterly)', 'monthly'),
    same('sss', 'SSS / PhilHealth / Pag-IBIG (monthly)', 'monthly'),
  ]),
  p('SG', 'asia', 'Singapore', 'Singapur', 'Singapura', 'UEN / GST', 'GST', ['Pte Ltd', 'Ltd', 'LLP', 'Pte Ltd (exempted)'], [
    same('formc', 'Form C / C-S (IRAS, annual)', 'annual'),
    o('gst', 'GST F5 (usually quarterly if registered; threshold S$1m)', 'GST trimestral', 'GST trimestral', 'quarterly'),
    same('cpf', 'CPF (monthly if employees)', 'monthly'),
    same('acra', 'ACRA annual return', 'annual'),
  ]),
  p('KR', 'asia', 'South Korea', 'Corea del Sur', 'Coreia do Sul', '사업자등록번호', '부가가치세', ['주식회사', '유한회사', '유한책임회사'], [
    same('beopin', '법인세 신고 (국세청, 사업연도)', 'annual'),
    same('vat', '부가가치세 예정신고·확정신고 (6개월 주기, 조기환급은 월)', 'quarterly'),
    same('woncheon', '원천세 / 4대보험 (월)', 'monthly'),
  ]),
  p('LK', 'asia', 'Sri Lanka', 'Sri Lanka', 'Sri Lanka', 'TIN', 'VAT / SSCL', ['Pvt Ltd', 'PLC'], [
    same('cit', 'Company income tax (IRD, annual)', 'annual'),
    same('vat', 'VAT return (usually quarterly)', 'quarterly'),
    same('etf', 'ETF / EPF / PAYE (monthly)', 'monthly'),
  ]),
  p('TW', 'asia', 'Taiwan', 'Taiwán', 'Taiwan', '統一編號', '營業稅', ['股份有限公司', '有限公司'], [
    same('profit', '營利事業所得稅結算申報（財政部，年度）', 'annual'),
    same('biztax', '營業稅（原則每兩月；使用發票）', 'bimonthly'),
    same('labor', '勞健保 / 扣繳（月）', 'monthly'),
  ]),
  p('TH', 'asia', 'Thailand', 'Tailandia', 'Tailândia', 'Tax ID / VAT', 'VAT', ['Co., Ltd.', 'PLC', 'Partnership'], [
    same('pnd50', 'P.N.D.50 company income tax (annual, RD) + P.N.D.51 mid-year', 'annual'),
    same('vat', 'PP.30 VAT (monthly if registered)', 'monthly'),
    same('pnd1', 'P.N.D.1 / SSO (monthly)', 'monthly'),
  ]),
  p('UZ', 'asia', 'Uzbekistan', 'Uzbekistán', 'Uzbequistão', 'STIR / INN', 'QQS', ['MChJ', 'AJ', 'XK'], [
    same('foiz', 'Foyda soligʻi (DSQ, yillik)', 'annual'),
    same('qqs', 'QQS hisoboti (oylik yoki chorak)', 'monthly'),
    same('inps', 'IJTIMOIY SOLIQ (oylik)', 'monthly'),
  ]),
  p('VN', 'asia', 'Vietnam', 'Vietnam', 'Vietname', 'MST', 'GTGT', ['TNHH', 'CTCP', 'DNTN'], [
    same('tndn', 'Tờ khai thuế TNDN (quý / năm, TCT)', 'quarterly'),
    same('gtgt', 'Tờ khai GTGT (tháng hoặc quý theo ngưỡng)', 'monthly'),
    same('tncn', 'Khấu trừ TNCN + BHXH (tháng)', 'monthly'),
  ]),

  // —— Oceania ——
  p('AU', 'oceania', 'Australia', 'Australia', 'Austrália', 'ABN / TFN / ACN', 'GST', ['Pty Ltd', 'Ltd', 'Pty Ltd (trustee)'], [
    same('cit', 'Company tax return (ATO, annual)', 'annual'),
    o('bas', 'BAS — GST, PAYG withholding and PAYG instalments (monthly or quarterly)', 'BAS', 'BAS', 'quarterly'),
    same('stp', 'Single Touch Payroll (usually each pay run / monthly)', 'monthly'),
    same('asic', 'ASIC annual review', 'annual'),
  ]),
  p('FJ', 'oceania', 'Fiji', 'Fiyi', 'Fiji', 'TIN', 'VAT', ['Pte Ltd', 'Ltd'], [
    same('cit', 'Company income tax (FRCS, annual)', 'annual'),
    same('vat', 'VAT return (usually monthly or quarterly)', 'quarterly'),
    same('fnpf', 'FNPF / PAYE (monthly)', 'monthly'),
  ]),
  p('NZ', 'oceania', 'New Zealand', 'Nueva Zelanda', 'Nova Zelândia', 'IRD / NZBN', 'GST', ['Ltd', 'Ltd (look-through)', 'Partnership'], [
    same('ir4', 'IR4 company return (Inland Revenue, annual)', 'annual'),
    o('gst', 'GST return (usually 2-monthly; some monthly/6-monthly)', 'GST', 'GST', 'bimonthly'),
    same('paye', 'Payday filing / PAYE / KiwiSaver / ACC (each payday or monthly)', 'monthly'),
    same('companies', 'Companies Office annual return', 'annual'),
  ]),
  p('PG', 'oceania', 'Papua New Guinea', 'Papúa Nueva Guinea', 'Papua-Nova Guiné', 'TIN', 'GST', ['Ltd'], [
    same('cit', 'Company income tax (IRC, annual)', 'annual'),
    same('gst', 'GST return (usually monthly)', 'monthly'),
    same('salaries', 'Salary or wages tax (monthly)', 'monthly'),
  ]),
];

function sortKey(pack: TaxCountryPack): string {
  return pack.nameEn.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

export const TAX_COUNTRY_PACKS: TaxCountryPack[] = [...RAW].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

export const TAX_REGION_LABELS: Record<TaxRegion, { en: string; es: string; pt: string }> = {
  americas: { en: 'Americas', es: 'Américas', pt: 'Américas' },
  europe: { en: 'Europe', es: 'Europa', pt: 'Europa' },
  africa: { en: 'Africa', es: 'África', pt: 'África' },
  middleeast: { en: 'Middle East', es: 'Oriente Medio', pt: 'Médio Oriente' },
  asia: { en: 'Asia', es: 'Asia', pt: 'Ásia' },
  oceania: { en: 'Oceania', es: 'Oceanía', pt: 'Oceânia' },
};

const REGION_ORDER: TaxRegion[] = ['americas', 'europe', 'africa', 'middleeast', 'asia', 'oceania'];

export function taxCountriesByRegion(): { region: TaxRegion; packs: TaxCountryPack[] }[] {
  return REGION_ORDER.map((region) => ({
    region,
    packs: TAX_COUNTRY_PACKS.filter((p) => p.region === region),
  })).filter((g) => g.packs.length > 0);
}
