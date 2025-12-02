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
