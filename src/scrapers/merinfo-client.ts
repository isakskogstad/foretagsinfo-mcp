/**
 * Merinfo.se HTTP Client
 * Axios-based client with stealth configuration for scraping
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { rateLimiter, RateLimiter } from './rate-limiter.js';
import { MERINFO_URLS } from './selectors.js';
import { logger } from '../utils/logger.js';

/**
 * User-Agent strings for rotation
 * Realistic Chrome/Firefox user agents on various platforms
 */
const USER_AGENTS = [
  // Chrome on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  // Firefox on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Safari on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

/**
 * Error types for merinfo scraping
 */
export class MerinfoError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'MerinfoError';
  }
}

export class RateLimitError extends MerinfoError {
  constructor() {
    super(
      'Sökgräns nådd på merinfo.se. Försök igen om några minuter.',
      'RATE_LIMIT',
      429
    );
  }
}

export class CompanyNotFoundError extends MerinfoError {
  constructor(orgNumber: string) {
    super(
      `Företag ${orgNumber} hittades inte på merinfo.se`,
      'COMPANY_NOT_FOUND',
      404
    );
  }
}

export class ScrapingError extends MerinfoError {
  constructor(message: string, cause?: Error) {
    super(message, 'SCRAPING_ERROR', 500, cause);
  }
}

/**
 * Merinfo HTTP Client
 */
export class MerinfoClient {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;

  constructor(customRateLimiter?: RateLimiter) {
    this.rateLimiter = customRateLimiter || rateLimiter;

    this.client = axios.create({
      baseURL: MERINFO_URLS.BASE,
      timeout: 30000,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      },
      // Follow redirects
      maxRedirects: 5,
      // Validate status codes
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

  /**
   * Get a random User-Agent string
   */
  private getRandomUserAgent(): string {
    const index = Math.floor(Math.random() * USER_AGENTS.length);
    return USER_AGENTS[index];
  }

  /**
   * Handle Axios errors
   */
  private handleError(error: AxiosError): never {
    if (error.response) {
      const status = error.response.status;

      if (status === 429 || status === 503) {
        throw new RateLimitError();
      }

      if (status === 404) {
        throw new CompanyNotFoundError('unknown');
      }

      throw new ScrapingError(
        `HTTP ${status}: ${error.message}`,
        error
      );
    }

    if (error.code === 'ECONNABORTED') {
      throw new ScrapingError('Request timeout', error);
    }

    throw new ScrapingError(
      `Network error: ${error.message}`,
      error
    );
  }

  /**
   * Fetch and parse a page from merinfo.se
   */
  private async fetchPage(url: string): Promise<cheerio.CheerioAPI> {
    // Wait for rate limiter slot
    await this.rateLimiter.waitForSlot();

    // Add random delay to appear more human-like
    await this.rateLimiter.randomDelay();

    logger.debug({ url }, 'Fetching merinfo page');

    const response = await this.client.get(url);

    // Check for rate limit page in HTML content
    const html = response.data as string;
    if (html.includes('Oops, din sökgräns är nådd!')) {
      throw new RateLimitError();
    }

    return cheerio.load(html);
  }

  /**
   * Search for a company by organization number
   */
  async searchCompany(orgNumber: string): Promise<cheerio.CheerioAPI> {
    const url = MERINFO_URLS.SEARCH(orgNumber);
    logger.info({ orgNumber }, 'Searching for company on merinfo.se');

    const $ = await this.fetchPage(url);

    // Check if any results were found
    const resultCards = $('div.mi-shadow-dark-blue-20');
    if (resultCards.length === 0) {
      throw new CompanyNotFoundError(orgNumber);
    }

    return $;
  }

  /**
   * Fetch company page by URL path
   */
  async fetchCompanyPage(path: string): Promise<cheerio.CheerioAPI> {
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    logger.info({ path: normalizedPath }, 'Fetching company page from merinfo.se');

    return this.fetchPage(`${MERINFO_URLS.BASE}${normalizedPath}`);
  }

  /**
   * Fetch company page directly by slug
   */
  async fetchCompanyBySlug(slug: string): Promise<cheerio.CheerioAPI> {
    logger.info({ slug }, 'Fetching company by slug from merinfo.se');
    return this.fetchPage(MERINFO_URLS.COMPANY(slug));
  }

  /**
   * Fetch person page by URL path
   */
  async fetchPersonPage(path: string): Promise<cheerio.CheerioAPI> {
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    logger.info({ path: normalizedPath }, 'Fetching person page from merinfo.se');

    return this.fetchPage(`${MERINFO_URLS.BASE}${normalizedPath}`);
  }

  /**
   * Fetch person page directly by slug
   */
  async fetchPersonBySlug(slug: string): Promise<cheerio.CheerioAPI> {
    logger.info({ slug }, 'Fetching person by slug from merinfo.se');
    return this.fetchPage(MERINFO_URLS.PERSON(slug));
  }

  /**
   * Get current rate limiter status
   */
  getRateLimiterStatus(): { tokens: number; burstCount: number } {
    return this.rateLimiter.getStatus();
  }
}

// Export singleton instance
export const merinfoClient = new MerinfoClient();
