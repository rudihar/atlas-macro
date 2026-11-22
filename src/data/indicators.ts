export type IndicatorDomain =
  | 'Output & Growth'
  | 'Prices & Money'
  | 'Fiscal & Public Finance'
  | 'Trade & External'
  | 'Labor & Productivity'
  | 'Demographics & Structural';

export type IndicatorFormat =
  | 'currencyCompact'
  | 'currencyExact'
  | 'percent'
  | 'numberCompact'
  | 'rate'
  | 'index';

export type IndicatorDefinition = {
  code: string;
  name: string;
  shortName: string;
  domain: IndicatorDomain;
  unit: string;
  format: IndicatorFormat;
  tier: 'core' | 'extended';
  headline?: boolean;
  description: string;
  polarity?: 'higher-better' | 'lower-better' | 'neutral';
};

export type CountryMeta = {
  id: string; // ISO3
  iso2: string;
  name: string;
  capital: string;
  region: string;
  regionId: string;
  incomeLevel: string;
  lendingType: string;
  longitude: string;
  latitude: string;
};

export type TimeSeriesPoint = {
  year: number;
  value: number;
};

export type IndicatorSeries = {
  code: string;
  name: string;
  unit?: string;
  latestYear: number | null;
  latestValue: number | null;
  previousYear: number | null;
  previousValue: number | null;
  deltaAbsolute: number | null;
  deltaPercent: number | null;
  points: TimeSeriesPoint[];
};

export type CatalogIndicator = {
  id: string;
  name: string;
  unit: string;
  sourceNote: string;
  sourceOrganization: string;
  topics: string[];
};

export const INDICATOR_DOMAINS: IndicatorDomain[] = [
  'Output & Growth',
  'Prices & Money',
  'Fiscal & Public Finance',
  'Trade & External',
  'Labor & Productivity',
  'Demographics & Structural',
];

export const CURATED_INDICATORS: IndicatorDefinition[] = [
  // Output & Growth
  {
    code: 'NY.GDP.MKTP.CD',
    name: 'GDP (Current US$)',
    shortName: 'Nominal GDP',
    domain: 'Output & Growth',
    unit: 'US$',
    format: 'currencyCompact',
    tier: 'core',
    headline: true,
    polarity: 'higher-better',
    description: 'Gross domestic product at purchaser prices converted to U.S. dollars at single-year official exchange rates.',
  },
  {
    code: 'NY.GDP.MKTP.KD.ZG',
    name: 'GDP Growth (Annual %)',
    shortName: 'GDP Growth',
    domain: 'Output & Growth',
    unit: '%',
    format: 'percent',
    tier: 'core',
    headline: true,
    polarity: 'higher-better',
    description: 'Annual percentage growth rate of real GDP at constant local currency market prices.',
  },
  {
    code: 'NY.GDP.PCAP.CD',
    name: 'GDP Per Capita (Current US$)',
    shortName: 'GDP Per Capita',
    domain: 'Output & Growth',
    unit: 'US$',
    format: 'currencyExact',
    tier: 'core',
    polarity: 'higher-better',
    description: 'Gross domestic product divided by midyear population in current U.S. dollars.',
  },
  {
    code: 'NY.GDP.PCAP.PP.CD',
    name: 'GDP Per Capita, PPP (Intl $)',
    shortName: 'GDP Per Capita (PPP)',
    domain: 'Output & Growth',
    unit: 'Intl $',
    format: 'currencyExact',
    tier: 'extended',
    polarity: 'higher-better',
    description: 'Gross domestic product converted to international dollars using purchasing power parity rates, divided by total population.',
  },
  {
    code: 'NY.GNP.PCAP.CD',
    name: 'GNI Per Capita, Atlas Method (US$)',
    shortName: 'GNI Per Capita',
    domain: 'Output & Growth',
    unit: 'US$',
    format: 'currencyExact',
    tier: 'extended',
    polarity: 'higher-better',
    description: 'Gross national income divided by midyear population, converted to U.S. dollars using the World Bank Atlas method.',
  },
  {
    code: 'NV.SRV.TOTL.ZS',
    name: 'Services, Value Added (% of GDP)',
    shortName: 'Services Share',
    domain: 'Output & Growth',
    unit: '% of GDP',
    format: 'percent',
    tier: 'extended',
    polarity: 'neutral',
    description: 'Value added from wholesale and retail trade, transport, financial, professional, and public services as a share of GDP.',
  },
  {
    code: 'NV.IND.TOTL.ZS',
    name: 'Industry, Value Added (% of GDP)',
    shortName: 'Industry Share',
    domain: 'Output & Growth',
    unit: '% of GDP',
    format: 'percent',
    tier: 'extended',
    polarity: 'neutral',
    description: 'Value added from mining, manufacturing, construction, electricity, water, and gas as a share of GDP.',
  },
  {
    code: 'NV.AGR.TOTL.ZS',
    name: 'Agriculture, Value Added (% of GDP)',
    shortName: 'Agriculture Share',
    domain: 'Output & Growth',
    unit: '% of GDP',
    format: 'percent',
    tier: 'extended',
    polarity: 'neutral',
    description: 'Value added from forestry, hunting, fishing, cultivation of crops, and livestock production as a share of GDP.',
  },

  // Prices & Money
  {
    code: 'FP.CPI.TOTL.ZG',
    name: 'Inflation, Consumer Prices (Annual %)',
    shortName: 'CPI Inflation',
    domain: 'Prices & Money',
    unit: '%',
    format: 'percent',
    tier: 'core',
    headline: true,
    polarity: 'lower-better',
    description: 'Annual percentage change in the cost to the average consumer of acquiring a fixed basket of goods and services.',
  },
  {
    code: 'NY.GDP.DEFL.KD.ZG',
    name: 'Inflation, GDP Deflator (Annual %)',
    shortName: 'GDP Deflator',
    domain: 'Prices & Money',
    unit: '%',
    format: 'percent',
    tier: 'extended',
    polarity: 'lower-better',
    description: 'Annual rate of price change in the economy as a whole, measured by the ratio of nominal to real GDP.',
  },
  {
    code: 'FR.INR.RINR',
    name: 'Real Interest Rate (%)',
    shortName: 'Real Interest Rate',
    domain: 'Prices & Money',
    unit: '%',
    format: 'percent',
    tier: 'extended',
    polarity: 'neutral',
    description: 'Lending interest rate adjusted for inflation as measured by the GDP deflator.',
  },
  {
    code: 'FR.INR.LEND',
    name: 'Lending Interest Rate (%)',
    shortName: 'Lending Rate',
    domain: 'Prices & Money',
    unit: '%',
    format: 'percent',
    tier: 'extended',
    polarity: 'neutral',
    description: 'Bank rate that usually meets the short- and medium-term financing needs of the private sector.',
  },
  {
    code: 'FM.LBL.BMNY.GD.ZS',
    name: 'Broad Money (% of GDP)',
    shortName: 'Broad Money (M3)',
    domain: 'Prices & Money',
    unit: '% of GDP',
    format: 'percent',
    tier: 'extended',
    polarity: 'neutral',
    description: 'Sum of currency outside banks, demand deposits, time/savings deposits, and foreign currency deposits relative to GDP.',
  },
  {
    code: 'PA.NUS.FCRF',
    name: 'Official Exchange Rate (LCU per US$)',
    shortName: 'FX Rate (vs USD)',
    domain: 'Prices & Money',
    unit: 'LCU/US$',
    format: 'rate',
    tier: 'extended',
    polarity: 'neutral',
    description: 'Period average official exchange rate determined by national authorities or legally sanctioned exchange markets.',
  },

  // Fiscal & Public Finance
  {
    code: 'GC.DOD.TOTL.GD.ZS',
    name: 'Central Government Debt (% of GDP)',
    shortName: 'Gov. Debt / GDP',
    domain: 'Fiscal & Public Finance',
    unit: '% of GDP',
    format: 'percent',
    tier: 'core',
    polarity: 'lower-better',
    description: 'Entire stock of direct government fixed-term contractual obligations to others outstanding on a particular date.',
  },
  {
    code: 'GC.BAL.CASH.GD.ZS',
    name: 'Fiscal Cash Surplus / Deficit (% of GDP)',
    shortName: 'Fiscal Balance',
    domain: 'Fiscal & Public Finance',
    unit: '% of GDP',
    format: 'percent',
    tier: 'extended',
    polarity: 'higher-better',
    description: 'Revenue (including grants) minus expense, minus net acquisition of nonfinancial assets as a share of GDP.',
  },
  {
    code: 'GC.TAX.TOTL.GD.ZS',
    name: 'Tax Revenue (% of GDP)',
    shortName: 'Tax Revenue',
    domain: 'Fiscal & Public Finance',
    unit: '% of GDP',
    format: 'percent',
    tier: 'extended',
    polarity: 'neutral',
    description: 'Compulsory transfers to the central government for public purposes as a percentage of GDP.',
  },
  {
    code: 'GC.XPN.TOTL.GD.ZS',
    name: 'Government Expense (% of GDP)',
    shortName: 'Gov. Expense',
    domain: 'Fiscal & Public Finance',
    unit: '% of GDP',
    format: 'percent',
    tier: 'extended',
    polarity: 'neutral',
    description: 'Cash payments for operating activities of the government in providing goods and services as a share of GDP.',
  },
  {
    code: 'MS.MIL.XPND.GD.ZS',
    name: 'Military Expenditure (% of GDP)',
    shortName: 'Defense Spending',
    domain: 'Fiscal & Public Finance',
    unit: '% of GDP',
    format: 'percent',
    tier: 'extended',
    polarity: 'neutral',
    description: 'All current and capital expenditures on the armed forces, defense ministries, and peacekeeping forces.',
  },

  // Trade & External
  {
    code: 'BN.CAB.XOKA.GD.ZS',
    name: 'Current Account Balance (% of GDP)',
    shortName: 'Current Account',
    domain: 'Trade & External',
    unit: '% of GDP',
    format: 'percent',
    tier: 'core',
    polarity: 'higher-better',
    description: 'Sum of net exports of goods and services, net primary income, and net secondary income as a percentage of GDP.',
  },
  {
    code: 'NE.EXP.GNFS.ZS',
    name: 'Exports of Goods & Services (% of GDP)',
    shortName: 'Exports / GDP',
    domain: 'Trade & External',
    unit: '% of GDP',
    format: 'percent',
    tier: 'extended',
    polarity: 'higher-better',
    description: 'Value of all goods and other market services provided to the rest of the world as a share of GDP.',
  },
  {
    code: 'NE.IMP.GNFS.ZS',
    name: 'Imports of Goods & Services (% of GDP)',
    shortName: 'Imports / GDP',
    domain: 'Trade & External',
    unit: '% of GDP',
    format: 'percent',
    tier: 'extended',
    polarity: 'neutral',
    description: 'Value of all goods and other market services received from the rest of the world as a share of GDP.',
  },
  {
    code: 'NE.TRD.GNFS.ZS',
    name: 'Trade Openness (% of GDP)',
    shortName: 'Total Trade / GDP',
    domain: 'Trade & External',
    unit: '% of GDP',
    format: 'percent',
    tier: 'extended',
    polarity: 'neutral',
    description: 'Sum of exports and imports of goods and services measured as a share of gross domestic product.',
  },
  {
    code: 'BX.KLT.DINV.WD.GD.ZS',
    name: 'Foreign Direct Investment, Net Inflows (% GDP)',
    shortName: 'FDI Inflows',
    domain: 'Trade & External',
    unit: '% of GDP',
    format: 'percent',
    tier: 'extended',
    polarity: 'higher-better',
    description: 'Net inflows of investment to acquire a lasting management interest in an enterprise operating in the economy.',
  },
  {
    code: 'FI.RES.TOTL.CD',
    name: 'Total Reserves (Incl. Gold, Current US$)',
    shortName: 'FX & Gold Reserves',
    domain: 'Trade & External',
    unit: 'US$',
    format: 'currencyCompact',
    tier: 'extended',
    polarity: 'higher-better',
    description: 'Holdings of monetary gold, special drawing rights, IMF reserves, and foreign exchange holdings under central bank control.',
  },

  // Labor & Productivity
  {
    code: 'SL.UEM.TOTL.ZS',
    name: 'Unemployment Rate (% of Labor Force)',
    shortName: 'Unemployment',
    domain: 'Labor & Productivity',
    unit: '%',
    format: 'percent',
    tier: 'core',
    headline: true,
    polarity: 'lower-better',
    description: 'Share of the labor force that is without work but available for and seeking employment (ILO modeled estimate).',
  },
  {
    code: 'SL.UEM.1524.ZS',
    name: 'Youth Unemployment (% Ages 15–24)',
    shortName: 'Youth Unemployment',
    domain: 'Labor & Productivity',
    unit: '%',
    format: 'percent',
    tier: 'extended',
    polarity: 'lower-better',
    description: 'Share of the labor force ages 15–24 without work but available for and seeking employment.',
  },
  {
    code: 'SL.TLF.CACT.ZS',
    name: 'Labor Force Participation Rate (% Ages 15+)',
    shortName: 'Labor Participation',
    domain: 'Labor & Productivity',
    unit: '%',
    format: 'percent',
    tier: 'extended',
    polarity: 'higher-better',
    description: 'Proportion of the population ages 15 and older that is economically active.',
  },
  {
    code: 'SL.GDP.PCAP.EM.KD',
    name: 'GDP Per Person Employed (Constant 2021 PPP $)',
    shortName: 'Labor Productivity',
    domain: 'Labor & Productivity',
    unit: 'PPP $',
    format: 'currencyExact',
    tier: 'extended',
    polarity: 'higher-better',
    description: 'Gross domestic product divided by total employment in the economy, converted to constant 2021 PPP international dollars.',
  },

  // Demographics & Structural
  {
    code: 'SP.POP.TOTL',
    name: 'Population, Total',
    shortName: 'Population',
    domain: 'Demographics & Structural',
    unit: 'People',
    format: 'numberCompact',
    tier: 'core',
    polarity: 'neutral',
    description: 'Total population based on the de facto definition counting all residents regardless of legal status or citizenship.',
  },
  {
    code: 'SP.POP.GROW',
    name: 'Population Growth (Annual %)',
    shortName: 'Population Growth',
    domain: 'Demographics & Structural',
    unit: '%',
    format: 'percent',
    tier: 'extended',
    polarity: 'neutral',
    description: 'Exponential rate of growth of midyear population from year t-1 to t, expressed as a percentage.',
  },
  {
    code: 'SP.URB.TOTL.IN.ZS',
    name: 'Urban Population (% of Total)',
    shortName: 'Urbanization',
    domain: 'Demographics & Structural',
    unit: '%',
    format: 'percent',
    tier: 'extended',
    polarity: 'neutral',
    description: 'Share of people living in urban areas as defined by national statistical offices.',
  },
  {
    code: 'NE.GDI.TOTL.ZS',
    name: 'Gross Capital Formation (% of GDP)',
    shortName: 'Capital Formation',
    domain: 'Demographics & Structural',
    unit: '% of GDP',
    format: 'percent',
    tier: 'extended',
    polarity: 'higher-better',
    description: 'Outlays on additions to fixed assets of the economy plus net changes in the level of inventories.',
  },
  {
    code: 'NY.GDS.TOTL.ZS',
    name: 'Gross Domestic Savings (% of GDP)',
    shortName: 'Domestic Savings',
    domain: 'Demographics & Structural',
    unit: '% of GDP',
    format: 'percent',
    tier: 'extended',
    polarity: 'higher-better',
    description: 'Gross domestic savings calculated as GDP less final consumption expenditure (total consumption).',
  },
  {
    code: 'EG.USE.PCAP.KG.OE',
    name: 'Energy Use (kg Oil Equivalent per Capita)',
    shortName: 'Energy Use / Capita',
    domain: 'Demographics & Structural',
    unit: 'kg oil eq.',
    format: 'numberCompact',
    tier: 'extended',
    polarity: 'neutral',
    description: 'Use of primary energy before transformation to other end-use fuels, equal to indigenous production plus imports minus exports.',
  },
  {
    code: 'SI.POV.GINI',
    name: 'Gini Index (Income Inequality)',
    shortName: 'Gini Index',
    domain: 'Demographics & Structural',
    unit: 'Index (0–100)',
    format: 'index',
    tier: 'extended',
    polarity: 'lower-better',
    description: 'Extent to which the distribution of income or consumption among individuals deviates from a perfectly equal distribution (0 = perfect equality).',
  },
];

export const CORE_INDICATOR_CODES = CURATED_INDICATORS.filter((i) => i.tier === 'core').map((i) => i.code);
export const EXTENDED_INDICATOR_CODES = CURATED_INDICATORS.filter((i) => i.tier === 'extended').map((i) => i.code);

export const INDICATOR_MAP: Record<string, IndicatorDefinition> = Object.fromEntries(
  CURATED_INDICATORS.map((item) => [item.code, item])
);
