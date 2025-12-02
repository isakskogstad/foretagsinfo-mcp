/**
 * Bolagsverket API Client
 * OAuth2 + REST endpoints för Värdefulla datamängder API
 */
import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger, createRequestLogger } from '../utils/logger.js';
import { BolagsverketAPIError } from '../utils/errors.js';
import type {
  OAuth2Token,
  OrganisationerResponse,
  DokumentlistaResponse,
  CompanyData,
  DocumentMetadata,
} from './types.js';

// Required OAuth2 scopes
const REQUIRED_SCOPES = 'vardefulla-datamangder:ping vardefulla-datamangder:read';

interface BolagsverketConfig {
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  apiBaseUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export class BolagsverketClient {
  private config: Required<BolagsverketConfig>;
  private token: OAuth2Token | null = null;
  private httpClient: AxiosInstance;

  constructor(config?: BolagsverketConfig) {
    this.config = {
      clientId: config?.clientId || process.env.BOLAGSVERKET_CLIENT_ID || '',
      clientSecret: config?.clientSecret || process.env.BOLAGSVERKET_CLIENT_SECRET || '',
      tokenUrl: config?.tokenUrl || 'https://portal.api.bolagsverket.se/oauth2/token',
      apiBaseUrl: config?.apiBaseUrl || 'https://gw.api.bolagsverket.se/vardefulla-datamangder/v1',
      maxRetries: config?.maxRetries ?? 3,
      retryDelay: config?.retryDelay ?? 1000,
      timeout: config?.timeout ?? 30000,
    };

    // Validate credentials
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error(
        'Missing Bolagsverket credentials. Set BOLAGSVERKET_CLIENT_ID and BOLAGSVERKET_CLIENT_SECRET'
      );
    }

    this.httpClient = axios.create({
      baseURL: this.config.apiBaseUrl,
      timeout: this.config.timeout,
    });
  }

  /**
   * Get OAuth2 access token with caching
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token (with 60s buffer)
    if (this.token && this.token.expires_at && Date.now() < this.token.expires_at - 60000) {
      return this.token.access_token;
    }

    logger.debug('Fetching new Bolagsverket access token');

    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await axios.post<OAuth2Token>(
          this.config.tokenUrl,
          `grant_type=client_credentials&scope=${encodeURIComponent(REQUIRED_SCOPES)}`,
          {
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 10000,
          }
        );

        this.token = {
          ...response.data,
          expires_at: Date.now() + response.data.expires_in * 1000,
        };

        logger.info({ expiresIn: response.data.expires_in }, 'Bolagsverket token acquired');
        return this.token.access_token;

      } catch (error) {
        lastError = error as Error;
        const axiosError = error as AxiosError;

        logger.warn(
          { attempt, status: axiosError.response?.status },
          'Token fetch attempt failed'
        );

        if (attempt < this.config.maxRetries && this.isRetryable(axiosError)) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new BolagsverketAPIError(
      `Failed to get access token: ${lastError?.message}`,
      401
    );
  }

  /**
   * Make authenticated API request with retry logic
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: unknown,
    requestId?: string
  ): Promise<T> {
    const log = requestId ? createRequestLogger(requestId) : logger;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const token = await this.getAccessToken();

        log.debug({ method, endpoint }, 'Making API request');

        const response = await this.httpClient.request<T>({
          method,
          url: endpoint,
          data,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        });

        log.debug({ method, endpoint, status: response.status }, 'API request succeeded');
        return response.data;

      } catch (error) {
        lastError = error as Error;
        const axiosError = error as AxiosError;

        // Clear token on 401 (expired)
        if (axiosError.response?.status === 401) {
          log.warn('Token expired, clearing cache');
          this.token = null;
        }

        log.warn(
          {
            attempt,
            status: axiosError.response?.status,
            message: axiosError.message,
          },
          'API request attempt failed'
        );

        if (attempt < this.config.maxRetries && this.isRetryable(axiosError)) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    const axiosError = lastError as AxiosError;
    const statusCode = axiosError?.response?.status || 500;
    const errorBody = axiosError?.response?.data as Record<string, unknown>;

    throw new BolagsverketAPIError(
      errorBody?.detail as string || errorBody?.message as string || lastError?.message || 'Request failed',
      statusCode,
      requestId,
      { endpoint }
    );
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: AxiosError): boolean {
    if (!error.response) return true; // Network error
    const status = error.response.status;
    return status >= 500 || status === 429; // Server error or rate limit
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== PUBLIC API METHODS ====================

  /**
   * Health check - test API connectivity
   */
  async ping(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      const response = await this.httpClient.get('/isalive', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Get company information by organization number
   */
  async getCompany(orgNumber: string, requestId?: string): Promise<CompanyData | null> {
    const response = await this.makeRequest<OrganisationerResponse>(
      'POST',
      '/organisationer',
      { identitetsbeteckning: orgNumber },
      requestId
    );

    return response.organisationer?.[0] || null;
  }

  /**
   * Get list of available documents for a company
   */
  async getDocumentList(orgNumber: string, requestId?: string): Promise<DocumentMetadata[]> {
    const response = await this.makeRequest<DokumentlistaResponse>(
      'POST',
      '/dokumentlista',
      { identitetsbeteckning: orgNumber },
      requestId
    );

    return response.dokument || [];
  }

  /**
   * Download a specific document (returns ZIP buffer)
   */
  async downloadDocument(documentId: string, requestId?: string): Promise<Buffer> {
    const log = requestId ? createRequestLogger(requestId) : logger;
    const token = await this.getAccessToken();

    log.debug({ documentId }, 'Downloading document');

    const response = await this.httpClient.get(`/dokument/${documentId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/zip',
      },
      responseType: 'arraybuffer',
    });

    log.info({ documentId, size: response.data.byteLength }, 'Document downloaded');
    return Buffer.from(response.data);
  }

  /**
   * Get latest annual report for a company
   * Returns the document for the specified year, or the most recent if year is not specified
   */
  async getAnnualReport(
    orgNumber: string,
    year?: number,
    requestId?: string
  ): Promise<{ document: Buffer; metadata: DocumentMetadata } | null> {
    const documents = await this.getDocumentList(orgNumber, requestId);

    if (documents.length === 0) {
      return null;
    }

    // Sort by period end date, newest first
    const sorted = [...documents].sort((a, b) =>
      new Date(b.rapporteringsperiodTom).getTime() - new Date(a.rapporteringsperiodTom).getTime()
    );

    // Find matching year or take newest
    const selected = year
      ? sorted.find(doc => new Date(doc.rapporteringsperiodTom).getFullYear() === year)
      : sorted[0];

    if (!selected) {
      return null;
    }

    const document = await this.downloadDocument(selected.dokumentId, requestId);
    return { document, metadata: selected };
  }
}

// Singleton instance with lazy initialization
let _client: BolagsverketClient | null = null;

export function getBolagsverketClient(): BolagsverketClient {
  if (!_client) {
    _client = new BolagsverketClient();
  }
  return _client;
}

export default BolagsverketClient;
