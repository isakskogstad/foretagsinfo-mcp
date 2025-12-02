/**
 * Merinfo.se HTML Parser
 * Cheerio-based parser for extracting company and person data
 */

import type { CheerioAPI } from 'cheerio';
import { SELECTORS, TABLE_HEADERS, BOARD_ROLES } from './selectors.js';
import { logger } from '../utils/logger.js';

/**
 * Board member data structure
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
 * Person details (extended data from person page)
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
 * Company data from merinfo.se
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
 * Clean text by removing extra whitespace and newlines
 */
function cleanText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return text.replace(/\s+/g, ' ').trim() || undefined;
}

/**
 * Parse age from text (e.g., "57 år" -> 57)
 */
function parseAge(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+)\s*år/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Parse financial value (e.g., "1 234 tkr" -> 1234000)
 */
function parseFinancialValue(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/\s/g, '').replace(/tkr$/i, '').replace(/\xa0/g, '');
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) return undefined;
  // Values are in thousands (tkr)
  return num * 1000;
}

/**
 * Parse address into components
 */
function parseAddress(addressText: string | undefined): {
  street?: string;
  postalCode?: string;
  city?: string;
} {
  if (!addressText) return {};

  // Swedish address format: "Street 123, 123 45 City" or "Street 123 lgh 1234, 123 45 City"
  const match = addressText.match(/(\d{3}\s?\d{2})\s+(.+)/);

  if (!match) {
    return { street: cleanText(addressText) };
  }

  const postalCode = match[1].replace(/\s/g, '');
  const city = cleanText(match[2]);
  const street = cleanText(addressText.split(match[0])[0])?.replace(/,\s*$/, '');

  return { street, postalCode, city };
}

/**
 * Get table value by header text
 */
function getTableValue($: CheerioAPI, headerText: string): string | undefined {
  let value: string | undefined;

  $('th').each((_, el) => {
    const $el = $(el);
    if ($el.text().includes(headerText)) {
      const $td = $el.next('td');
      if ($td.length) {
        value = cleanText($td.text());
      }
    }
  });

  return value;
}

/**
 * Parse boolean from "Ja"/"Nej" text
 */
function parseBoolean(text: string | undefined): boolean | undefined {
  if (!text) return undefined;
  if (text.toLowerCase().includes('ja')) return true;
  if (text.toLowerCase().includes('nej')) return false;
  return undefined;
}

/**
 * Parse board members from company page
 */
export function parseBoardMembers($: CheerioAPI): BoardMember[] {
  const members: BoardMember[] = [];
  const seenNames = new Set<string>();

  // Find tables that might contain board members
  // Look for tables with person links
  $('table').each((_, table) => {
    const $table = $(table);

    // Check if this table contains person links
    const personLinks = $table.find('a[href*="/person/"]');
    if (personLinks.length === 0) return;

    // Process each row
    $table.find('tbody tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length < 2) return;

      // Find the person link in this row
      const $personLink = $row.find('a[href*="/person/"]').first();
      if ($personLink.length === 0) return;

      const name = cleanText($personLink.text());
      if (!name || seenNames.has(name)) return;

      seenNames.add(name);

      const profileUrl = $personLink.attr('href');

      // Extract data from cells
      const cellTexts = cells.map((_, cell) => cleanText($(cell).text())).get();

      // Parse age from cell that contains "år"
      let age: number | undefined;
      let city: string | undefined;
      const roles: string[] = [];
      let appointedDate: string | undefined;

      cellTexts.forEach((text) => {
        if (!text) return;

        // Check for age
        const ageMatch = text.match(/^(\d{2,3})$/);
        if (ageMatch) {
          age = parseInt(ageMatch[1], 10);
          return;
        }

        // Check for date (YYYY-MM-DD format)
        const dateMatch = text.match(/^\d{4}-\d{2}-\d{2}$/);
        if (dateMatch) {
          appointedDate = text;
          return;
        }

        // Check for known roles
        for (const role of BOARD_ROLES) {
          if (text.toLowerCase().includes(role.toLowerCase())) {
            if (!roles.includes(role)) {
              roles.push(role);
            }
            return;
          }
        }

        // Check if it looks like a city (single word, starts with capital)
        if (/^[A-ZÅÄÖ][a-zåäö]+$/.test(text) && text.length > 2 && text.length < 20) {
          city = text;
        }
      });

      // Only add if we found at least a name
      if (name) {
        members.push({
          name,
          age,
          city,
          roles: roles.length > 0 ? roles : ['Okänd roll'],
          appointedDate,
          profileUrl: profileUrl ? `https://www.merinfo.se${profileUrl}` : undefined,
        });
      }
    });
  });

  logger.debug({ count: members.length }, 'Parsed board members');
  return members;
}

/**
 * Parse company page
 */
export function parseCompanyPage($: CheerioAPI, orgNumber: string): MerinfoCompanyData {
  // Basic company info
  const name = cleanText($(SELECTORS.COMPANY_NAME).text()) || 'Okänt företag';

  // Parse org number from page if not provided
  let parsedOrgNumber = orgNumber;
  const orgNumberEl = $('h1 i.fa-address-book').next('span');
  if (orgNumberEl.length) {
    const extracted = cleanText(orgNumberEl.text());
    if (extracted) {
      parsedOrgNumber = extracted.replace(/-/g, '');
    }
  }

  // Table-based data
  const legalForm = getTableValue($, TABLE_HEADERS.LEGAL_FORM);
  const status = getTableValue($, TABLE_HEADERS.STATUS);
  const registrationDate = getTableValue($, TABLE_HEADERS.REGISTRATION_DATE);

  // Status remarks (green/red/orange indicators)
  let remarks: string | undefined;
  const remarkEl = $(SELECTORS.STATUS_GREEN + ', ' + SELECTORS.STATUS_RED + ', ' + SELECTORS.STATUS_ORANGE).first();
  if (remarkEl.length) {
    remarks = cleanText(remarkEl.text());
    const dateEl = remarkEl.next('span');
    if (dateEl.length) {
      remarks = `${remarks} ${cleanText(dateEl.text())}`;
    }
  }

  // Contact info
  const phone = cleanText($(SELECTORS.PHONE).first().text());
  const addressText = cleanText($(SELECTORS.ADDRESS).text())?.replace(name, '').trim();
  const { street, postalCode, city } = parseAddress(addressText);
  const municipality = getTableValue($, TABLE_HEADERS.MUNICIPALITY);
  const county = getTableValue($, TABLE_HEADERS.COUNTY);

  // Tax info
  const fSkattText = getTableValue($, TABLE_HEADERS.F_SKATT);
  const vatText = getTableValue($, TABLE_HEADERS.VAT_REGISTERED);
  const employerText = getTableValue($, TABLE_HEADERS.EMPLOYER);

  // Financial data
  let financialPeriod: string | undefined;
  $('h3').each((_, el) => {
    const text = $(el).text();
    if (text.includes('Nyckeltal 20')) {
      financialPeriod = text.replace('Nyckeltal ', '').trim();
    }
  });

  // Find financial values - look for spans containing financial labels
  let revenue: number | undefined;
  let profitAfterFinancialItems: number | undefined;
  let netProfit: number | undefined;
  let totalAssets: number | undefined;

  $('span').each((_, el) => {
    const $el = $(el);
    const text = $el.text();
    const $nextSpan = $el.next('span');

    if (text.includes('Omsättning')) {
      revenue = parseFinancialValue($nextSpan.text());
    } else if (text.includes('Res. e. fin')) {
      profitAfterFinancialItems = parseFinancialValue($nextSpan.text());
    } else if (text.includes('Årets resultat')) {
      netProfit = parseFinancialValue($nextSpan.text());
    } else if (text.includes('Summa tillgångar')) {
      totalAssets = parseFinancialValue($nextSpan.text());
    }
  });

  // Industry/SNI info
  let sniCode: string | undefined;
  let sniDescription: string | undefined;
  const categories: string[] = [];
  let activityDescription: string | undefined;

  $('h3').each((_, el) => {
    const $el = $(el);
    const text = $el.text();

    if (text.includes('Svensk näringsgrensindelning')) {
      const sniText = cleanText($el.next('div').text());
      if (sniText) {
        const parts = sniText.split(' - ');
        if (parts.length >= 2) {
          sniCode = parts[0];
          sniDescription = parts.slice(1).join(' - ');
        } else {
          sniDescription = sniText;
        }
      }
    }

    if (text.includes('Bransch')) {
      $el.next('div').find('a').each((_, link) => {
        const category = cleanText($(link).text());
        if (category) {
          categories.push(category);
        }
      });
    }

    if (text.includes('Verksamhetsbeskrivning')) {
      activityDescription = cleanText($el.next('div').find('.expanded').text());
    }
  });

  // Board members
  const boardMembers = parseBoardMembers($);

  return {
    orgNumber: parsedOrgNumber,
    name,
    legalForm,
    status,
    registrationDate,
    remarks,
    contact: {
      phone,
      address: street || addressText,
      postalCode,
      city,
      municipality,
      county,
    },
    taxInfo: {
      fSkatt: parseBoolean(fSkattText),
      vatRegistered: parseBoolean(vatText),
      employerRegistered: parseBoolean(employerText),
    },
    financials: financialPeriod
      ? {
          period: financialPeriod,
          currency: 'SEK',
          revenue,
          profitAfterFinancialItems,
          netProfit,
          totalAssets,
        }
      : undefined,
    industry:
      sniCode || sniDescription || categories.length > 0 || activityDescription
        ? {
            sniCode,
            sniDescription,
            categories: categories.length > 0 ? categories : undefined,
            activityDescription,
          }
        : undefined,
    boardMembers,
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Parse person details page
 */
export function parsePersonPage($: CheerioAPI): PersonDetails {
  const name = cleanText($(SELECTORS.PERSON_NAME).text()) || 'Okänd person';

  // Parse age
  let age: number | undefined;
  const ageSpan = $('i.fa-address-book').next('span');
  if (ageSpan.length) {
    age = parseAge(ageSpan.text());
  }

  // Parse address
  let address: PersonDetails['address'];
  const addressSection = $('#oversikt address');
  if (addressSection.length) {
    const addressText = cleanText(addressSection.text());
    if (addressText) {
      // Check for apartment number (lgh XXXX)
      const aptMatch = addressText.match(/lgh\s?(\d{4})/i);
      const apartment = aptMatch ? `lgh ${aptMatch[1]}` : undefined;

      // Remove apartment from address before parsing
      const cleanedAddress = apartment
        ? addressText.replace(apartment, '').trim()
        : addressText;

      const { street, postalCode, city } = parseAddress(cleanedAddress);

      address = {
        street,
        apartment,
        postalCode,
        city,
      };
    }
  }

  // Parse phone numbers
  const phones: Array<{ number: string; owner?: string }> = [];
  $('table').each((_, table) => {
    const $table = $(table);
    const hasPhoneHeader = $table.find('th').toArray().some((th) =>
      $(th).text().includes('Telefonnummer')
    );

    if (hasPhoneHeader) {
      $table.find('tbody tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 1) {
          const number = cleanText(cells.eq(0).text());
          const owner = cells.length >= 2 ? cleanText(cells.eq(1).text()) : undefined;
          if (number) {
            phones.push({ number, owner });
          }
        }
      });
    }
  });

  return {
    name,
    age,
    address: address?.street || address?.city ? address : undefined,
    phones: phones.length > 0 ? phones : undefined,
  };
}

/**
 * Find company link from search results
 */
export function findCompanyLinkFromSearch(
  $: CheerioAPI,
  orgNumber: string
): string | undefined {
  let companyUrl: string | undefined;

  // Look for the search result card that contains the org number
  $('div.mi-shadow-dark-blue-20').each((_, card) => {
    const $card = $(card);
    const cardText = $card.text();

    // Check if this card contains the org number we're looking for
    const normalizedOrg = orgNumber.replace(/-/g, '');
    const formattedOrg = `${normalizedOrg.slice(0, 6)}-${normalizedOrg.slice(6)}`;

    if (cardText.includes(normalizedOrg) || cardText.includes(formattedOrg)) {
      // Check for warning (anmärkning)
      const hasWarning = $card.find('span.mi-text-red').length > 0 &&
        $card.text().includes('anmärka på');

      if (!hasWarning) {
        const link = $card.find('a[href*="/foretag/"]').first().attr('href');
        if (link) {
          companyUrl = link;
          return false; // Break the loop
        }
      }
    }
  });

  return companyUrl;
}
