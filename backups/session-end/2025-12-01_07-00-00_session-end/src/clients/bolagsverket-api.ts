/**
 * Bolagsverket API Client
 * OAuth2 + REST endpoints för företagsdata och dokument
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../utils/logger.js';

interface OAuth2Token {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  expires_at?: number; // Vi lägger till när token upphör
}

export interface BolagsverketDokument {
  dokumentId: string;
  filformat: string;
  rapporteringsperiodTom: string;
  registreringstidpunkt: string;
}

interface DokumentListaResponse {
  dokument: BolagsverketDokument[];
}

interface BolagsverketConfig {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  apiBaseUrl: string;
  maxRetries?: number;
  retryDelay?: number;
  enableLogging?: boolean;
}

export class BolagsverketAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message);
    this.name = 'BolagsverketAPIError';
  }
}

export class BolagsverketClient {
  private config: BolagsverketConfig;
  private token: OAuth2Token | null = null;
  private httpClient: AxiosInstance;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly enableLogging: boolean;

  constructor(config?: Partial<BolagsverketConfig>) {
    this.config = {
      clientId: config?.clientId || process.env.BOLAGSVERKET_CLIENT_ID || '',
      clientSecret: config?.clientSecret || process.env.BOLAGSVERKET_CLIENT_SECRET || '',
      tokenUrl: 'https://portal.api.bolagsverket.se/oauth2/token',
      apiBaseUrl: 'https://gw.api.bolagsverket.se/vardefulla-datamangder/v1',
      maxRetries: 3,
      retryDelay: 1000,
      enableLogging: false,
      ...config,
    };

    this.maxRetries = this.config.maxRetries!;
    this.retryDelay = this.config.retryDelay!;
    this.enableLogging = this.config.enableLogging!;

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new BolagsverketAPIError(
        'Missing Bolagsverket credentials. Set BOLAGSVERKET_CLIENT_ID and BOLAGSVERKET_CLIENT_SECRET in .env'
      );
    }

    this.httpClient = axios.create({
      baseURL: this.config.apiBaseUrl,
      timeout: 30000,
    });
  }

  private log(message: string, data?: Record<string, unknown>): void {
    if (this.enableLogging) {
      logger.debug({ component: 'BolagsverketClient', ...data }, message);
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRetryableError(error: AxiosError): boolean {
    // Retry på nätverksfel eller 5xx server errors
    if (!error.response) return true;
    const status = error.response.status;
    return status >= 500 || status === 429; // 429 = Rate limit
  }

  /**
   * Hämta OAuth2 access token med retry-logik
   */
  private async getAccessToken(): Promise<string> {
    // Kolla om vi har ett giltigt token
    if (this.token && this.token.expires_at && Date.now() < this.token.expires_at) {
      this.log('Using cached access token');
      return this.token.access_token;
    }

    this.log('Fetching new access token');

    // Annars hämta nytt token med retry
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'vardefulla-datamangder:ping vardefulla-datamangder:read',
    });

    const auth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

    let lastError: any;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post<OAuth2Token>(
          this.config.tokenUrl,
          params,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );

        this.token = {
          ...response.data,
          expires_at: Date.now() + (response.data.expires_in * 1000) - 60000, // 1 min buffer
        };

        this.log('Access token fetched successfully', {
          expires_in: response.data.expires_in,
        });

        return this.token.access_token;
      } catch (error) {
        lastError = error;
        const axiosError = error as AxiosError;

        this.log(`Token fetch attempt ${attempt}/${this.maxRetries} failed`, {
          status: axiosError.response?.status,
          message: axiosError.message,
        });

        if (attempt < this.maxRetries && this.isRetryableError(axiosError)) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          this.log(`Retrying in ${delay}ms`);
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }

    throw new BolagsverketAPIError(
      'Failed to get access token after retries',
      (lastError as AxiosError).response?.status,
      lastError
    );
  }

  /**
   * Gör autentiserad API-förfrågan med retry-logik
   */
  private async makeAuthenticatedRequest<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: any
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const token = await this.getAccessToken();

        this.log(`${method} ${endpoint}`, data ? { dataKeys: Object.keys(data) } : undefined);

        const response = await this.httpClient.request<T>({
          method,
          url: endpoint,
          data,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': '*/*',
          },
        });

        this.log(`${method} ${endpoint} succeeded`, {
          status: response.status,
        });

        return response.data;
      } catch (error) {
        lastError = error;
        const axiosError = error as AxiosError;

        this.log(`${method} ${endpoint} attempt ${attempt}/${this.maxRetries} failed`, {
          status: axiosError.response?.status,
          message: axiosError.message,
        });

        // Om token har löpt ut, rensa cache och försök igen
        if (axiosError.response?.status === 401) {
          this.log('Token expired, clearing cache');
          this.token = null;
        }

        if (attempt < this.maxRetries && this.isRetryableError(axiosError)) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          this.log(`Retrying in ${delay}ms`);
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }

    const axiosError = lastError as AxiosError;
    throw new BolagsverketAPIError(
      `${method} ${endpoint} failed after ${this.maxRetries} retries: ${axiosError.message}`,
      axiosError.response?.status,
      lastError
    );
  }

  /**
   * Testa API-anslutningen
   */
  async ping(): Promise<boolean> {
    try {
      await this.makeAuthenticatedRequest('GET', '/isalive');
      this.log('Ping successful');
      return true;
    } catch (error) {
      this.log('Ping failed', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Sök organisationer
   *
   * @param criteria - Sökkriterier
   * @returns Företagsinformation
   */
  async searchOrganizations(criteria: {
    identitetsbeteckning: string; // Organisationsnummer, personnummer eller samordningsnummer
  }): Promise<any> {
    return this.makeAuthenticatedRequest('POST', '/organisationer', criteria);
  }

  /**
   * Hämta dokumentlista för organisation
   *
   * @param organisationId - Organisations-ID (10 siffror)
   * @returns Lista av tillgängliga dokument
   */
  async getDocumentList(organisationId: string): Promise<BolagsverketDokument[]> {
    const response = await this.makeAuthenticatedRequest<DokumentListaResponse>(
      'POST',
      '/dokumentlista',
      {
        identitetsbeteckning: organisationId,
      }
    );
    return response.dokument || [];
  }

  /**
   * Hämta specifikt dokument
   *
   * @param documentId - Dokument-ID från dokumentlista
   * @returns Dokument-innehåll som Buffer
   */
  async getDocument(documentId: string): Promise<Buffer> {
    const token = await this.getAccessToken();

    this.log(`GET /dokument/${documentId}`, { binary: true });

    const response = await this.httpClient.request({
      method: 'GET',
      url: `/dokument/${documentId}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/zip',
      },
      responseType: 'arraybuffer',
    });

    this.log(`GET /dokument/${documentId} succeeded`, {
      status: response.status,
      size: response.data.byteLength,
    });

    return Buffer.from(response.data);
  }

  /**
   * Hämta årsredovisning för företag
   *
   * @param organisationId - Organisations-ID
   * @param year - År (optional, senaste om inte angivet)
   * @returns Årsredovisning i iXBRL-format (ZIP-paket)
   */
  async getAnnualReport(organisationId: string, year?: number): Promise<any> {
    const documentList = await this.getDocumentList(organisationId);

    if (documentList.length === 0) {
      throw new BolagsverketAPIError(
        `Inga dokument hittades för ${organisationId}`
      );
    }

    // Sortera efter rapporteringsperiod, senaste först
    const sorted = [...documentList].sort((a, b) =>
      new Date(b.rapporteringsperiodTom).getTime() -
      new Date(a.rapporteringsperiodTom).getTime()
    );

    // Välj rätt år eller senaste
    const selected = year
      ? sorted.find((doc) =>
          new Date(doc.rapporteringsperiodTom).getFullYear() === year
        )
      : sorted[0];

    if (!selected) {
      throw new BolagsverketAPIError(
        `Ingen årsredovisning för år ${year} hittades för ${organisationId}`
      );
    }

    this.log('Fetching annual report', {
      dokumentId: selected.dokumentId,
      year: new Date(selected.rapporteringsperiodTom).getFullYear(),
    });

    return this.getDocument(selected.dokumentId);
  }
}

// Singleton instance för enkel användning
// Lazy initialization to allow dotenv to load first
let _bolagsverketClient: BolagsverketClient | null = null;
export const getBolagsverketClient = (): BolagsverketClient => {
  if (!_bolagsverketClient) {
    _bolagsverketClient = new BolagsverketClient();
  }
  return _bolagsverketClient;
};
