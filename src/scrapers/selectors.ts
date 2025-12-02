/**
 * CSS Selectors for merinfo.se scraping
 * Based on analysis of merinfo_scraper Python implementation
 */

export const SELECTORS = {
  // ==========================================
  // Company Search Page
  // ==========================================
  SEARCH_RESULT_CARD: 'div.mi-shadow-dark-blue-20',
  SEARCH_COMPANY_LINK: 'a[href*="/foretag/"]',
  SEARCH_ORG_NUMBER: 'p', // Contains org number text

  // Warning indicators on search results
  SEARCH_WARNING: 'span.mi-text-red',

  // ==========================================
  // Company Page - Basic Info
  // ==========================================
  COMPANY_NAME: 'h1 span.namn',
  ORG_NUMBER: 'h1 i.fa-address-book + span',

  // Table-based data (th/td pairs)
  TABLE_ROW: 'th, td',

  // Status indicators
  STATUS_GREEN: '.mi-text-green',
  STATUS_RED: '.mi-text-red',
  STATUS_ORANGE: '.mi-text-orange',

  // ==========================================
  // Company Page - Contact Info
  // ==========================================
  PHONE: 'a[href^="tel:"]',
  ADDRESS: 'address',

  // ==========================================
  // Company Page - Board/Management Table
  // ==========================================
  // The board table contains columns: Name, Age, City, Role, Date
  BOARD_TABLE: 'table',
  BOARD_TABLE_HEADER: 'th',
  BOARD_ROWS: 'tbody tr',
  BOARD_PERSON_LINK: 'a[href*="/person/"]',

  // ==========================================
  // Company Page - Financial Data (Nyckeltal)
  // ==========================================
  FINANCIAL_HEADER: 'h3',
  FINANCIAL_VALUE: 'span',

  // ==========================================
  // Company Page - Industry (SNI)
  // ==========================================
  SNI_SECTION: 'h3',
  INDUSTRY_CATEGORIES: 'a',

  // ==========================================
  // Person Page
  // ==========================================
  PERSON_NAME: 'h1 span.namn',
  PERSON_AGE_ICON: 'i.fa-address-book',
  PERSON_AGE_SPAN: 'i.fa-address-book + span',
  PERSON_ADDRESS_SECTION: '#oversikt address',
  PERSON_PHONE: 'a[href^="tel:"]',

  // Phone table
  PHONE_TABLE: 'table',
  PHONE_TABLE_ROWS: 'tbody tr',
} as const;

/**
 * XPath selectors for complex queries
 * (Used with cheerio's limited XPath support or for reference)
 */
export const XPATH_SELECTORS = {
  // Table value by header text
  TABLE_VALUE: (headerText: string) =>
    `//th[contains(., '${headerText}')]/following-sibling::td`,

  // Financial value by label
  FINANCIAL_VALUE: (labelText: string) =>
    `//span[contains(., '${labelText}')]/following-sibling::span`,

  // Board member by role
  BOARD_MEMBER_BY_ROLE: (role: string) =>
    `//td[contains(., '${role}')]/following-sibling::td//a[contains(@href, '/person/')]`,

  // SNI section
  SNI_DESCRIPTION:
    "//h3[contains(., 'Svensk näringsgrensindelning')]/following-sibling::div",

  // Activity description
  ACTIVITY_DESCRIPTION:
    "//h3[contains(., 'Verksamhetsbeskrivning')]/following-sibling::div//div[contains(@class, 'expanded')]",
} as const;

/**
 * Table header mappings for extracting company data
 */
export const TABLE_HEADERS = {
  LEGAL_FORM: 'Bolagsform:',
  STATUS: 'Status:',
  REGISTRATION_DATE: 'Registrerat:',
  F_SKATT: 'F-Skatt:',
  VAT_REGISTERED: 'Momsregistrerad:',
  EMPLOYER: 'Arbetsgivare:',
  MUNICIPALITY: 'Kommunsäte:',
  COUNTY: 'Länssäte:',
} as const;

/**
 * Board member roles to search for
 */
export const BOARD_ROLES = [
  'VD',
  'Verkställande direktör',
  'Ordförande',
  'Styrelseordförande',
  'Styrelseledamot',
  'Ordinarie ledamot',
  'Suppleant',
  'Styrelsesuppleant',
  'Innehavare',
  'Komplementär',
  'Likvidator',
  'Revisor',
  'Firmatecknare',
] as const;

export type BoardRole = typeof BOARD_ROLES[number];

/**
 * URL patterns for merinfo.se
 */
export const MERINFO_URLS = {
  BASE: 'https://www.merinfo.se',
  SEARCH: (query: string) =>
    `https://www.merinfo.se/search?q=${encodeURIComponent(query)}`,
  COMPANY: (slug: string) => `https://www.merinfo.se/foretag/${slug}`,
  PERSON: (slug: string) => `https://www.merinfo.se/person/${slug}`,
} as const;
