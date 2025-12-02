/**
 * Type definitions for Bolagsverket API responses
 */

/**
 * OAuth2 token response
 */
export interface OAuth2Token {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  // Calculated field
  expires_at?: number;
}

/**
 * Generic code/description pair used throughout the API
 */
export interface CodeDescription {
  kod: string;
  klartext: string;
}

/**
 * Data producer information
 */
export interface DataProducer {
  dataproducent: 'Bolagsverket' | 'SCB';
  fel: string | null;
}

/**
 * Organization identity
 */
export interface OrganisationsIdentitet {
  identitetsbeteckning: string;
  typ: CodeDescription;
}

/**
 * Organization name entry
 */
export interface OrganisationsNamn {
  namn: string;
  organisationsnamntyp: CodeDescription;
  registreringsdatum: string;
  verksamhetsbeskrivningSarskiltForetagsnamn?: string | null;
}

/**
 * SNI industry code
 */
export interface SNICode {
  kod: string;
  klartext: string;
}

/**
 * Postal address
 */
export interface PostAddress {
  utdelningsadress: string;
  postnummer: string;
  postort: string;
  land?: string | null;
  coAdress?: string | null;
}

/**
 * Full company data from /organisationer endpoint
 */
export interface CompanyData {
  organisationsidentitet: OrganisationsIdentitet;

  organisationsnamn: DataProducer & {
    organisationsnamnLista: OrganisationsNamn[];
  };

  organisationsform: DataProducer & CodeDescription;

  juridiskForm: DataProducer & CodeDescription;

  naringsgrenOrganisation: DataProducer & {
    sni: SNICode[];
  };

  organisationsdatum: DataProducer & {
    registreringsdatum: string;
    infortHosScb?: string | null;
  };

  postadressOrganisation: DataProducer & {
    postadress: PostAddress;
  };

  verksamhetsbeskrivning?: DataProducer & {
    beskrivning: string;
  };

  verksamOrganisation: DataProducer & {
    kod: 'JA' | 'NEJ';
  };

  registreringsland: CodeDescription;

  avregistreradOrganisation?: {
    datum: string;
  } | null;

  avregistreringsorsak?: CodeDescription | null;

  pagaendeAvvecklingsEllerOmstruktureringsforfarande?: {
    typ: CodeDescription;
  } | null;

  namnskyddslopnummer?: string | null;

  reklamsparr?: boolean | null;
}

/**
 * API response wrapper for /organisationer
 */
export interface OrganisationerResponse {
  organisationer: CompanyData[];
}

/**
 * Document metadata from /dokumentlista
 */
export interface DocumentMetadata {
  dokumentId: string;
  filformat: string;
  rapporteringsperiodTom: string;
  registreringstidpunkt: string;
}

/**
 * API response wrapper for /dokumentlista
 */
export interface DokumentlistaResponse {
  dokument: DocumentMetadata[];
}

/**
 * Parsed annual report data
 */
export interface AnnualReportData {
  period: {
    from: string;
    to: string;
  };
  incomeStatement: {
    revenue?: number;
    operatingResult?: number;
    financialResult?: number;
    netIncome?: number;
  };
  balanceSheet: {
    totalAssets?: number;
    fixedAssets?: number;
    currentAssets?: number;
    equity?: number;
    longTermLiabilities?: number;
    currentLiabilities?: number;
  };
  keyMetrics: {
    solidityPercent?: number;
    employees?: number;
  };
  management: {
    boardMembers: string[];
    ceo?: string;
  };
  rawXmlAvailable: boolean;
}

/**
 * Simplified company info for tool responses
 */
export interface CompanyInfo {
  orgNumber: string;
  name: string;
  foreignName?: string;
  organizationForm: string;
  legalForm: string;
  sniCodes: Array<{ code: string; description: string }>;
  address: {
    street: string;
    postalCode: string;
    city: string;
    country?: string;
  };
  registrationDate: string;
  isActive: boolean;
  deregistrationDate?: string;
  businessDescription?: string;
}

// ===========================================
// Merinfo.se Scraper Types
// ===========================================

/**
 * Board member from merinfo.se
 */
export interface BoardMember {
  name: string;
  age?: number;
  city?: string;
  roles: string[];
  appointedDate?: string;
  profileUrl?: string;
}

/**
 * Extended person details (from person page)
 */
export interface PersonDetails {
  name: string;
  age?: number;
  address?: {
    street?: string;
    apartment?: string;
    postalCode?: string;
    city?: string;
  };
  phones?: Array<{ number: string; owner?: string }>;
}

/**
 * Company data from merinfo.se scraping
 */
export interface MerinfoCompanyData {
  orgNumber: string;
  name: string;
  legalForm?: string;
  status?: string;
  registrationDate?: string;
  remarks?: string;
  contact?: {
    phone?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    municipality?: string;
    county?: string;
  };
  taxInfo?: {
    fSkatt?: boolean;
    vatRegistered?: boolean;
    employerRegistered?: boolean;
  };
  financials?: {
    period?: string;
    currency?: string;
    revenue?: number;
    profitAfterFinancialItems?: number;
    netProfit?: number;
    totalAssets?: number;
  };
  industry?: {
    sniCode?: string;
    sniDescription?: string;
    categories?: string[];
    activityDescription?: string;
  };
  boardMembers: BoardMember[];
  scrapedAt: string;
}

/**
 * Result from get_board_members tool
 */
export interface BoardMembersResult {
  orgNumber: string;
  companyName: string;
  boardMembers: BoardMember[];
  source: 'hitta.se' | 'merinfo.se';
  scrapedAt: string;
  partial?: boolean;
  error?: string;
}
