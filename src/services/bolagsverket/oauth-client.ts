/**
 * Bolagsverket OAuth2 Client
 *
 * Handles token generation and caching for Bolagsverket API
 * Uses client_credentials grant type
 */

import axios from 'axios';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

export class BolagsverketOAuth2Client {
  private clientId: string;
  private clientSecret: string;
  private tokenUrl: string;
  private cachedToken: CachedToken | null = null;

  constructor(
    clientId: string,
    clientSecret: string,
    tokenUrl: string = 'https://portal.api.bolagsverket.se/oauth2/token'
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tokenUrl = tokenUrl;
  }

  /**
   * Get valid access token (cached or fresh)
   */
  async getAccessToken(): Promise<string> {
    // Check if cached token is still valid
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.token;
    }

    // Request new token
    const token = await this.requestNewToken();
    return token;
  }

  /**
   * Request new OAuth2 token from Bolagsverket
   */
  private async requestNewToken(): Promise<string> {
    try {
      const response = await axios.post<TokenResponse>(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials'
        }),
        {
          auth: {
            username: this.clientId,
            password: this.clientSecret
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const { access_token, expires_in } = response.data;

      // Cache token with 60-second buffer before expiry
      this.cachedToken = {
        token: access_token,
        expiresAt: Date.now() + (expires_in - 60) * 1000
      };

      return access_token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `OAuth2 token request failed: ${error.response?.status} ${error.response?.statusText}`
        );
      }
      throw error;
    }
  }

  /**
   * Clear cached token (force refresh on next request)
   */
  clearCache(): void {
    this.cachedToken = null;
  }
}
