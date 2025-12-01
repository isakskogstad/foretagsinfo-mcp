/**
 * Tests för Bolagsverket API Client
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { BolagsverketClient } from '../bolagsverket-api';
import 'dotenv/config';

describe('BolagsverketClient', () => {
  let client: BolagsverketClient;

  beforeAll(() => {
    client = new BolagsverketClient({
      clientId: process.env.BOLAGSVERKET_CLIENT_ID,
      clientSecret: process.env.BOLAGSVERKET_CLIENT_SECRET,
      enableLogging: true, // Aktivera logging för tester
    });
  });

  it('should successfully ping the API', async () => {
    const isAlive = await client.ping();
    expect(isAlive).toBe(true);
  }, 10000);

  it('should search for organizations', async () => {
    // Test med Spotify AB (org.nr: 5565939074)
    const result = await client.searchOrganizations({
      identitetsbeteckning: '5565939074',
    });

    expect(result).toBeDefined();
    expect(result.organisationer).toBeDefined();
    expect(Array.isArray(result.organisationer)).toBe(true);

    if (result.organisationer && result.organisationer.length > 0) {
      console.log('Found companies:', result.organisationer.length);
      console.log('First result:', JSON.stringify(result.organisationer[0], null, 2));
    }
  }, 15000);

  it('should get document list for organization', async () => {
    // Använd ett test-org-ID
    const testOrgId = '5560661778'; // Bonor AB från vår databas

    const documents = await client.getDocumentList(testOrgId);
    expect(documents).toBeDefined();
    expect(Array.isArray(documents)).toBe(true);

    if (documents.length > 0) {
      console.log('Found documents:', documents.length);
      console.log('First document:', JSON.stringify(documents[0], null, 2));
    }
  }, 15000);

  it('should handle errors gracefully', async () => {
    // Test med ogiltigt org-ID
    try {
      await client.getDocumentList('INVALID_ID');
    } catch (error: any) {
      expect(error.name).toBe('BolagsverketAPIError');
      expect(error.message).toBeDefined();
    }
  }, 15000);
});
