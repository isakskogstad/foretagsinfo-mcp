/**
 * Hitta.se HTTP Client
 * Axios-based client for fetching company board member data
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { rateLimiter, RateLimiter } from './rate-limiter.js';
import { logger } from '../utils/logger.js';

/**
 * User-Agent strings for rotation
 */
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

/**
 * URL patterns for hitta.se
 */
export const HITTA_URLS = {
  BASE: 'https://www.hitta.se',
  SEARCH: (orgNumber: string) =>
    `https://www.hitta.se/s%C3%B6k?vad=${encodeURIComponent(orgNumber)}`,
  COMPANY: (slug: string) => `https://www.hitta.se${slug}`,
};

/**
 * Error types for hitta.se scraping
 */
export class HittaError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'HittaError';
  }
}

export class HittaRateLimitError extends HittaError {
  constructor() {
    super(
      'Sökgräns nådd på hitta.se. Försök igen om några minuter.',
      'RATE_LIMIT',
      429
    );
  }
}

export class HittaCompanyNotFoundError extends HittaError {
  constructor(orgNumber: string) {
    super(
      `Företag ${orgNumber} hittades inte på hitta.se`,
      'COMPANY_NOT_FOUND',
      404
    );
  }
}

export class HittaScrapingError extends HittaError {
  constructor(message: string, cause?: Error) {
    super(message, 'SCRAPING_ERROR', 500, cause);
  }
}

/**
 * Hitta.se HTTP Client
 */
export class HittaClient {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;

  constructor(customRateLimiter?: RateLimiter) {
    this.rateLimiter = customRateLimiter || rateLimiter;

    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    // Add request interceptor for User-Agent rotation
    this.client.interceptors.request.use((config) => {
      config.headers['User-Agent'] = this.getRandomUserAgent();
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => this.handleError(error)
    );
  }

  private getRandomUserAgent(): string {
    const index = Math.floor(Math.random() * USER_AGENTS.length);
    return USER_AGENTS[index];
  }

  private handleError(error: AxiosError): never {
    if (error.response) {
      const status = error.response.status;

      if (status === 429 || status === 503) {
        throw new HittaRateLimitError();
      }

      if (status === 404) {
        throw new HittaCompanyNotFoundError('unknown');
      }

      throw new HittaScrapingError(
        `HTTP ${status}: ${error.message}`,
        error
      );
    }

    if (error.code === 'ECONNABORTED') {
      throw new HittaScrapingError('Request timeout', error);
    }

    throw new HittaScrapingError(
      `Network error: ${error.message}`,
      error
    );
  }

  private async fetchPage(url: string): Promise<cheerio.CheerioAPI> {
    await this.rateLimiter.waitForSlot();
    await this.rateLimiter.randomDelay();

    logger.debug({ url }, 'Fetching hitta.se page');

    const response = await this.client.get(url);
    const html = response.data as string;

    return cheerio.load(html);
  }

  /**
   * Search for a company by organization number and get the company page URL
   */
  async findCompanyUrl(orgNumber: string): Promise<string> {
    const searchUrl = HITTA_URLS.SEARCH(orgNumber);
    logger.info({ orgNumber }, 'Searching for company on hitta.se');

    const $ = await this.fetchPage(searchUrl);

    // Look for the company link in search results
    // The link should contain the org number
    const normalizedOrg = orgNumber.replace(/-/g, '');
    const formattedOrg = `${normalizedOrg.slice(0, 6)}-${normalizedOrg.slice(6)}`;

    let companyUrl: string | undefined;

    // Find links that go to company pages
    $('a[href*="/f%C3%B6retag/"], a[href*="/foretag/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !companyUrl) {
        companyUrl = href;
      }
    });

    // Also check for direct company links
    if (!companyUrl) {
      // Try to find link with org number in JSON-LD or page content
      const pageText = $.html();

      // Look for company link patterns
      const linkMatch = pageText.match(/href="(\/[^"]*\/stockholm\/[^"]+)"/);
      if (linkMatch) {
        companyUrl = linkMatch[1];
      }
    }

    // Also try the företag page pattern with org number
    if (!companyUrl) {
      // Check if there's a direct företag link
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.includes(normalizedOrg) && !companyUrl) {
          companyUrl = href;
        }
      });
    }

    if (!companyUrl) {
      throw new HittaCompanyNotFoundError(orgNumber);
    }

    logger.debug({ companyUrl }, 'Found company URL');
    return companyUrl;
  }

  /**
   * Fetch the company's företag page which contains board member info
   */
  async fetchCompanyPage(orgNumber: string): Promise<cheerio.CheerioAPI> {
    // First try to search for the company URL
    let companyUrl: string;

    try {
      companyUrl = await this.findCompanyUrl(orgNumber);
    } catch (error) {
      // If search fails, throw error
      throw error;
    }

    // Construct the full URL
    const fullUrl = companyUrl.startsWith('http')
      ? companyUrl
      : `${HITTA_URLS.BASE}${companyUrl}`;

    // Fetch the company page
    return this.fetchPage(fullUrl);
  }

  /**
   * Fetch the företag (board info) page directly
   * URL pattern: /företag/{company-slug}/{org-number}
   */
  async fetchForetagPage(companySlug: string, orgNumber: string): Promise<cheerio.CheerioAPI> {
    const url = `${HITTA_URLS.BASE}/f%C3%B6retag/${encodeURIComponent(companySlug)}/${orgNumber}`;
    return this.fetchPage(url);
  }

  getRateLimiterStatus(): { tokens: number; burstCount: number } {
    return this.rateLimiter.getStatus();
  }
}

export const hittaClient = new HittaClient();
