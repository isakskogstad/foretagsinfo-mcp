/**
 * Company Data Service
 * Integrates Bolagsverket API with Supabase caching
 *
 * Cache-first strategy:
 * 1. Check Supabase cache first
 * 2. If cache miss or expired → fetch from API
 * 3. Store result in cache
 * 4. Return data
 */

import { BolagsverketClient, BolagsverketDokument } from '../clients/bolagsverket-api.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'dotenv/config';

export interface CompanyDetails {
  organisationsidentitet: string;
  organisationsnamn: string;
  organisationsform?: string;
  registreringsdatum?: string;
  status?: string;
  address?: any;
  // Full API response stored in cache
  raw?: any;
}

// Re-export for convenience
export type { BolagsverketDokument as Document };

export interface CompanyDataServiceConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  cacheTTLDays?: number;
  documentCacheTTLDays?: number;
  enableLogging?: boolean;
}

export class CompanyDataService {
  private supabase: SupabaseClient;
  private bolagsverket: BolagsverketClient;
  private cacheTTL: number;
  private documentCacheTTL: number;
  private enableLogging: boolean;

  constructor(config?: CompanyDataServiceConfig) {
    const supabaseUrl = config?.supabaseUrl || process.env.SUPABASE_URL!;
    const supabaseKey = config?.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY!;

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.bolagsverket = new BolagsverketClient({
      enableLogging: config?.enableLogging || false,
    });

    this.cacheTTL = (config?.cacheTTLDays || 30) * 24 * 60 * 60 * 1000; // 30 days default
    this.documentCacheTTL = (config?.documentCacheTTLDays || 7) * 24 * 60 * 60 * 1000; // 7 days default
    this.enableLogging = config?.enableLogging || false;
  }

  private log(message: string, data?: any): void {
    if (this.enableLogging) {
      console.log(`[CompanyDataService] ${message}`, data || '');
    }
  }

  /**
   * Log API request for analytics
   */
  private async logRequest(
    endpoint: string,
    method: string,
    organisationsidentitet: string | null,
    statusCode: number,
    responseTimeMs: number,
    cacheHit: boolean
  ): Promise<void> {
    try {
      await this.supabase.from('api_request_log').insert({
        endpoint,
        method,
        organisationsidentitet,
        status_code: statusCode,
        response_time_ms: responseTimeMs,
        cache_hit: cacheHit,
      });
    } catch (error) {
      this.log('Failed to log request', { error });
    }
  }

  /**
   * Get company details with cache-first strategy
   */
  async getCompanyDetails(organisationsidentitet: string): Promise<CompanyDetails | null> {
    const startTime = Date.now();

    // 1. Check cache first
    const { data: cached, error: cacheError } = await this.supabase
      .from('company_details_cache')
      .select('*')
      .eq('organisationsidentitet', organisationsidentitet)
      .single();

    if (cached && !cacheError) {
      const expiresAt = new Date(cached.cache_expires_at);
      if (expiresAt > new Date()) {
        this.log('Cache HIT', { organisationsidentitet });
        await this.logRequest('getCompanyDetails', 'GET', organisationsidentitet, 200, Date.now() - startTime, true);

        // Update fetch count
        await this.supabase
          .from('company_details_cache')
          .update({ fetch_count: cached.fetch_count + 1 })
          .eq('organisationsidentitet', organisationsidentitet);

        return {
          organisationsidentitet: cached.organisationsidentitet,
          ...cached.api_response,
        };
      } else {
        this.log('Cache EXPIRED', { organisationsidentitet, expiresAt });
      }
    } else {
      this.log('Cache MISS', { organisationsidentitet });
    }

    // 2. Fetch from API
    try {
      const apiData = await this.bolagsverket.searchOrganizations({
        identitetsbeteckning: organisationsidentitet,
      });

      // API returnerar { organisationer: [...] }
      const organisationer = apiData?.organisationer || [];

      if (!organisationer || organisationer.length === 0) {
        await this.logRequest('getCompanyDetails', 'GET', organisationsidentitet, 404, Date.now() - startTime, false);
        return null;
      }

      const companyData = organisationer[0];

      // 3. Update cache
      const cacheExpiry = new Date(Date.now() + this.cacheTTL);
      await this.supabase.from('company_details_cache').upsert({
        organisationsidentitet,
        api_response: companyData,
        fetched_at: new Date().toISOString(),
        cache_expires_at: cacheExpiry.toISOString(),
      });

      this.log('Cache UPDATED', { organisationsidentitet, expiresAt: cacheExpiry });
      await this.logRequest('getCompanyDetails', 'GET', organisationsidentitet, 200, Date.now() - startTime, false);

      return {
        organisationsidentitet,
        ...companyData,
      };
    } catch (error) {
      this.log('API call failed', { error, organisationsidentitet });
      await this.logRequest('getCompanyDetails', 'GET', organisationsidentitet, 500, Date.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Get document list for company with caching
   */
  async getDocumentList(organisationsidentitet: string): Promise<BolagsverketDokument[]> {
    const startTime = Date.now();

    // 1. Check cache
    const { data: cached, error: cacheError } = await this.supabase
      .from('company_documents_cache')
      .select('*')
      .eq('organisationsidentitet', organisationsidentitet)
      .single();

    if (cached && !cacheError) {
      const expiresAt = new Date(cached.cache_expires_at);
      if (expiresAt > new Date()) {
        this.log('Documents cache HIT', { organisationsidentitet });
        await this.logRequest('getDocumentList', 'GET', organisationsidentitet, 200, Date.now() - startTime, true);

        await this.supabase
          .from('company_documents_cache')
          .update({ fetch_count: cached.fetch_count + 1 })
          .eq('organisationsidentitet', organisationsidentitet);

        return cached.documents;
      }
    }

    // 2. Fetch from API
    try {
      const documents = await this.bolagsverket.getDocumentList(organisationsidentitet);

      // 3. Update cache
      const cacheExpiry = new Date(Date.now() + this.documentCacheTTL);
      await this.supabase.from('company_documents_cache').upsert({
        organisationsidentitet,
        documents,
        fetched_at: new Date().toISOString(),
        cache_expires_at: cacheExpiry.toISOString(),
      });

      this.log('Documents cache UPDATED', { organisationsidentitet, count: documents.length });
      await this.logRequest('getDocumentList', 'GET', organisationsidentitet, 200, Date.now() - startTime, false);

      return documents;
    } catch (error) {
      this.log('Failed to fetch documents', { error, organisationsidentitet });
      await this.logRequest('getDocumentList', 'GET', organisationsidentitet, 500, Date.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Get and store annual report with automatic caching
   */
  async getAnnualReport(
    organisationsidentitet: string,
    year?: number
  ): Promise<{ data: any; storagePath: string }> {
    const startTime = Date.now();

    // 1. Check if we already have parsed financial data
    const query = this.supabase
      .from('financial_reports')
      .select('*')
      .eq('organisationsidentitet', organisationsidentitet);

    if (year) {
      query.eq('report_year', year);
    }

    const { data: existingReport, error } = await query.single();

    if (existingReport && !error) {
      this.log('Financial report cache HIT', { organisationsidentitet, year });
      await this.logRequest('getAnnualReport', 'GET', organisationsidentitet, 200, Date.now() - startTime, true);

      return {
        data: {
          balance_sheet: existingReport.balance_sheet,
          income_statement: existingReport.income_statement,
          cash_flow: existingReport.cash_flow,
          key_metrics: existingReport.key_metrics,
        },
        storagePath: existingReport.storage_path,
      };
    }

    // 2. Fetch from API
    try {
      const reportData = await this.bolagsverket.getAnnualReport(organisationsidentitet, year);

      // 3. Store file in Supabase Storage
      const storagePath = `${organisationsidentitet}/annual-reports/${year || 'latest'}/report.xml`;

      const { error: uploadError } = await this.supabase.storage
        .from('company-documents')
        .upload(storagePath, reportData, {
          contentType: 'application/xml',
          upsert: true,
        });

      if (uploadError) {
        this.log('Storage upload failed', { error: uploadError });
      } else {
        this.log('File stored', { storagePath });
      }

      // 4. TODO: Parse iXBRL and extract financial data
      // This will be implemented in the iXBRL parser module
      const financialData = {
        balance_sheet: null, // TODO: Parse from iXBRL
        income_statement: null,
        cash_flow: null,
        key_metrics: null,
      };

      // 5. Store parsed data in database
      await this.supabase.from('financial_reports').upsert({
        organisationsidentitet,
        report_year: year || new Date().getFullYear() - 1,
        report_type: 'ÅRSREDOVISNING',
        storage_path: storagePath,
        ...financialData,
      });

      await this.logRequest('getAnnualReport', 'GET', organisationsidentitet, 200, Date.now() - startTime, false);

      return {
        data: financialData,
        storagePath,
      };
    } catch (error) {
      this.log('Failed to fetch annual report', { error, organisationsidentitet, year });
      await this.logRequest('getAnnualReport', 'GET', organisationsidentitet, 500, Date.now() - startTime, false);
      throw error;
    }
  }

  /**
   * Search companies locally in Supabase
   * NOTE: Bolagsverket API only supports search by identitetsbeteckning,
   * so we search in our local database which contains 1.85M companies
   */
  async searchCompanies(query: string, limit: number = 10): Promise<CompanyDetails[]> {
    const startTime = Date.now();

    // Search in local database
    const { data: localResults, error } = await this.supabase
      .from('companies')
      .select('*')
      .or(`organisationsnamn.ilike.%${query}%,organisationsidentitet.eq.${query}`)
      .limit(limit);

    if (localResults && localResults.length > 0) {
      this.log('Local search', { query, count: localResults.length });
      await this.logRequest('searchCompanies', 'GET', null, 200, Date.now() - startTime, true);
      return localResults;
    }

    this.log('Local search - no results', { query });
    await this.logRequest('searchCompanies', 'GET', null, 404, Date.now() - startTime, true);
    return [];
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    const [detailsCount, docsCount, reportsCount, requestsCount] = await Promise.all([
      this.supabase.from('company_details_cache').select('*', { count: 'exact', head: true }),
      this.supabase.from('company_documents_cache').select('*', { count: 'exact', head: true }),
      this.supabase.from('financial_reports').select('*', { count: 'exact', head: true }),
      this.supabase.from('api_request_log').select('*', { count: 'exact', head: true }),
    ]);

    const { data: hitRate } = await this.supabase
      .from('api_request_log')
      .select('cache_hit')
      .gte('requested_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const totalRequests = hitRate?.length || 0;
    const cacheHits = hitRate?.filter((r) => r.cache_hit).length || 0;

    return {
      cached_company_details: detailsCount.count,
      cached_document_lists: docsCount.count,
      stored_financial_reports: reportsCount.count,
      total_api_requests: requestsCount.count,
      cache_hit_rate_24h: totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0,
    };
  }
}

// Singleton instance
export const companyDataService = new CompanyDataService();
