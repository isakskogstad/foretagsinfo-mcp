/**
 * Hitta.se HTML Parser
 * Cheerio-based parser for extracting board member data
 */

import type { CheerioAPI } from 'cheerio';
import { logger } from '../utils/logger.js';

/**
 * Board member data structure
 */
export interface HittaBoardMember {
  name: string;
  age?: number;
  city?: string;
  gender?: 'male' | 'female';
  roles: string[];
  appointedDate?: string;
}

/**
 * Company data from hitta.se
 */
export interface HittaCompanyData {
  orgNumber: string;
  name: string;
  address?: string;
  city?: string;
  industry?: string;
  boardMembers: HittaBoardMember[];
  scrapedAt: string;
}

/**
 * Known board roles
 */
const BOARD_ROLES = [
  'VD',
  'Verkställande direktör',
  'Ordförande',
  'Styrelseordförande',
  'Styrelseledamot',
  'Ledamot',
  'Suppleant',
  'Styrelsesuppleant',
  'Revisor',
  'Revisorsuppleant',
  'Firmatecknare',
  'Innehavare',
  'Komplementär',
];

/**
 * Clean text by removing extra whitespace
 */
function cleanText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return text.replace(/\s+/g, ' ').trim() || undefined;
}

/**
 * Parse age from text (e.g., "38 år" -> 38)
 */
function parseAge(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(\d+)\s*år/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Parse gender from text
 */
function parseGender(text: string): 'male' | 'female' | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('man') || lower.includes('male')) return 'male';
  if (lower.includes('kvinna') || lower.includes('female')) return 'female';
  return undefined;
}

/**
 * Extract roles from text
 */
function extractRoles(text: string): string[] {
  const roles: string[] = [];
  const lowerText = text.toLowerCase();

  for (const role of BOARD_ROLES) {
    if (lowerText.includes(role.toLowerCase())) {
      roles.push(role);
    }
  }

  return roles.length > 0 ? roles : ['Okänd roll'];
}

/**
 * Person data from hitta.se JSON
 */
interface HittaPersonJson {
  name: string;
  positions: string[];
  lastChanged?: string;
  vkikey?: string;
  city?: string;
  gender?: 'MALE' | 'FEMALE' | 'UNKNOWN';
  age?: number;
  executive?: boolean;
  boardMember?: boolean;
  accountant?: boolean;
  realPerson?: boolean;
}

/**
 * Financial data structure from hitta.se
 */
interface HittaFinancialData {
  persons?: HittaPersonJson[];
  companyName?: string;
  [key: string]: unknown;
}

/**
 * Parse company page from hitta.se
 * Extracts data from embedded JSON in React state
 */
export function parseHittaCompanyPage($: CheerioAPI, orgNumber: string): HittaCompanyData {
  const boardMembers: HittaBoardMember[] = [];
  let companyName = 'Okänt företag';

  // Try to extract company name from page title or h1
  const h1 = $('h1').first().text();
  if (h1) {
    companyName = cleanText(h1) || companyName;
  }

  const title = $('title').text();
  if (title && companyName === 'Okänt företag') {
    const titleMatch = title.match(/^([^-|]+)/);
    if (titleMatch) {
      companyName = cleanText(titleMatch[1]) || companyName;
    }
  }

  const htmlContent = $.html();

  // Method 1: Look for ESCAPED JSON (\"persons\":) - most common format on hitta.se
  // The JSON is embedded inside a string, so quotes are escaped with backslash
  // Use bracket matching since regex can't handle nested brackets properly
  const personsStartMarker = '\\"persons\\":[';
  const startIdx = htmlContent.indexOf(personsStartMarker);
  if (startIdx !== -1) {
    try {
      // Find matching closing bracket by counting bracket depth
      const arrayStart = startIdx + personsStartMarker.length;
      let depth = 1;
      let pos = arrayStart;

      while (depth > 0 && pos < htmlContent.length) {
        const char = htmlContent[pos];
        if (char === '[') depth++;
        else if (char === ']') depth--;
        pos++;
      }

      // Extract the array content including brackets
      const arrayContent = htmlContent.substring(arrayStart - 1, pos);

      // Unescape the JSON string
      const unescaped = arrayContent.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      const persons: HittaPersonJson[] = JSON.parse(unescaped);
      logger.debug({ count: persons.length }, 'Found persons in escaped JSON data');

      // Deduplicate by name+position (same person can appear with different roles)
      const seen = new Set<string>();
      for (const person of persons) {
        if (person.name && person.positions && person.positions.length > 0) {
          const key = `${person.name}|${person.positions[0]}`;
          if (!seen.has(key)) {
            seen.add(key);
            boardMembers.push({
              name: person.name,
              age: person.age ?? undefined,
              city: person.city ?? undefined,
              gender: person.gender === 'MALE' ? 'male' : person.gender === 'FEMALE' ? 'female' : undefined,
              roles: person.positions,
              appointedDate: person.lastChanged ?? undefined,
            });
          }
        }
      }
    } catch (e) {
      logger.debug({ error: e }, 'Failed to parse escaped persons JSON');
    }
  }

  // Method 2: Try unescaped JSON (regular "persons":)
  if (boardMembers.length === 0) {
    const personsMatch = htmlContent.match(/"persons"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
    if (personsMatch) {
      try {
        const persons: HittaPersonJson[] = JSON.parse(personsMatch[1]);
        logger.debug({ count: persons.length }, 'Found persons in JSON data');

        for (const person of persons) {
          if (person.name && person.positions && person.positions.length > 0) {
            boardMembers.push({
              name: person.name,
              age: person.age ?? undefined,
              city: person.city ?? undefined,
              gender: person.gender === 'MALE' ? 'male' : person.gender === 'FEMALE' ? 'female' : undefined,
              roles: person.positions,
              appointedDate: person.lastChanged ?? undefined,
            });
          }
        }
      } catch (e) {
        logger.debug({ error: e }, 'Failed to parse persons JSON');
      }
    }
  }

  // Method 3: Look for __NEXT_DATA__ script
  if (boardMembers.length === 0) {
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        // Navigate through the Next.js data structure
        const pageProps = nextData?.props?.pageProps;
        if (pageProps?.financialData?.persons) {
          const persons = pageProps.financialData.persons as HittaPersonJson[];
          for (const person of persons) {
            if (person.name && person.positions && person.positions.length > 0) {
              boardMembers.push({
                name: person.name,
                age: person.age,
                city: person.city,
                gender: person.gender === 'MALE' ? 'male' : person.gender === 'FEMALE' ? 'female' : undefined,
                roles: person.positions,
                appointedDate: person.lastChanged,
              });
            }
          }
          if (pageProps.financialData.companyName) {
            companyName = pageProps.financialData.companyName;
          }
        }
      } catch (e) {
        logger.debug({ error: e }, 'Failed to parse __NEXT_DATA__');
      }
    }
  }

  // Method 4: Look for any script containing "positions" and person names
  if (boardMembers.length === 0) {
    $('script').each((_, script) => {
      const scriptContent = $(script).html() || '';

      // Look for person objects with name and positions
      const personPattern = /\{"name"\s*:\s*"([^"]+)",\s*"positions"\s*:\s*\[([^\]]+)\](?:,\s*"lastChanged"\s*:\s*"([^"]*)")?(?:,\s*"[^"]*"\s*:\s*[^,}]*)*,\s*"city"\s*:\s*"([^"]*)"(?:,\s*"[^"]*"\s*:\s*[^,}]*)*,\s*"age"\s*:\s*(\d+)/g;

      let match;
      while ((match = personPattern.exec(scriptContent)) !== null) {
        const name = match[1];
        const positionsStr = match[2];
        const lastChanged = match[3];
        const city = match[4];
        const age = match[5] ? parseInt(match[5], 10) : undefined;

        // Parse positions array
        const positions = positionsStr.match(/"([^"]+)"/g)?.map(p => p.replace(/"/g, '')) || [];

        if (name && positions.length > 0) {
          boardMembers.push({
            name,
            age,
            city,
            roles: positions,
            appointedDate: lastChanged,
          });
        }
      }
    });
  }

  // Method 5: Fallback - try regex on full HTML for specific patterns
  if (boardMembers.length === 0) {
    // Pattern to match embedded JSON person objects
    const fullPattern = /"name":"([^"]+)"[^}]*"positions":\[([^\]]+)\][^}]*"city":"([^"]*)"[^}]*"age":(\d+)/g;
    let match;
    while ((match = fullPattern.exec(htmlContent)) !== null) {
      const name = match[1];
      const positionsStr = match[2];
      const city = match[3];
      const age = parseInt(match[4], 10);

      const positions = positionsStr.match(/"([^"]+)"/g)?.map(p => p.replace(/"/g, '')) || [];

      if (name && positions.length > 0) {
        boardMembers.push({
          name,
          age,
          city,
          roles: positions,
        });
      }
    }
  }

  logger.debug({ count: boardMembers.length }, 'Parsed board members from hitta.se');

  return {
    orgNumber: orgNumber.replace(/-/g, ''),
    name: companyName,
    boardMembers,
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Parse search results to find company URL
 */
export function findCompanyUrlFromSearch($: CheerioAPI, orgNumber: string): string | undefined {
  const normalizedOrg = orgNumber.replace(/-/g, '');

  // Look for links to company pages (företag)
  let companyUrl: string | undefined;

  // Method 1: Look for direct links containing org number
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && (href.includes('/f%C3%B6retag/') || href.includes('/foretag/'))) {
      if (href.includes(normalizedOrg) && !companyUrl) {
        companyUrl = href;
      }
    }
  });

  // Method 2: Look for any link containing the org number
  if (!companyUrl) {
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes(normalizedOrg) && !companyUrl) {
        companyUrl = href;
      }
    });
  }

  // Method 3: Try to find embedded JSON data
  if (!companyUrl) {
    $('script[type="application/json"]').each((_, script) => {
      try {
        const json = JSON.parse($(script).html() || '{}');
        // Look for URL in the JSON structure
        if (json.url && json.url.includes(normalizedOrg)) {
          companyUrl = json.url;
        }
      } catch {
        // Ignore parse errors
      }
    });
  }

  return companyUrl;
}
