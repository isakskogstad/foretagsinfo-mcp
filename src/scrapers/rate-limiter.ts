/**
 * Rate Limiter for merinfo.se scraping
 * Implements token bucket algorithm with random delays
 */

export interface RateLimiterConfig {
  requestsPerMinute: number;
  minDelayMs: number;
  maxDelayMs: number;
  burstLimit: number;
  burstCooldownMs: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  requestsPerMinute: 20,
  minDelayMs: 1000,
  maxDelayMs: 2500,
  burstLimit: 3,
  burstCooldownMs: 5000,
};

export class RateLimiter {
  private config: RateLimiterConfig;
  private tokens: number;
  private lastRefill: number;
  private burstCount: number;
  private lastBurstReset: number;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tokens = this.config.requestsPerMinute;
    this.lastRefill = Date.now();
    this.burstCount = 0;
    this.lastBurstReset = Date.now();
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefill;
    const elapsedMinutes = elapsedMs / 60000;

    const tokensToAdd = elapsedMinutes * this.config.requestsPerMinute;
    this.tokens = Math.min(this.config.requestsPerMinute, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Check and reset burst counter if cooldown has passed
   */
  private checkBurstReset(): void {
    const now = Date.now();
    if (now - this.lastBurstReset >= this.config.burstCooldownMs) {
      this.burstCount = 0;
      this.lastBurstReset = now;
    }
  }

  /**
   * Wait until a request slot is available
   */
  async waitForSlot(): Promise<void> {
    this.refillTokens();
    this.checkBurstReset();

    // If we've hit burst limit, wait for cooldown
    if (this.burstCount >= this.config.burstLimit) {
      const waitTime = this.config.burstCooldownMs - (Date.now() - this.lastBurstReset);
      if (waitTime > 0) {
        await this.sleep(waitTime);
        this.burstCount = 0;
        this.lastBurstReset = Date.now();
      }
    }

    // If no tokens available, wait for refill
    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.config.requestsPerMinute) * 60000;
      await this.sleep(waitTime);
      this.refillTokens();
    }

    // Consume token and increment burst counter
    this.tokens -= 1;
    this.burstCount += 1;
  }

  /**
   * Add random delay between requests to appear more human-like
   */
  async randomDelay(): Promise<void> {
    const delay = this.config.minDelayMs +
      Math.random() * (this.config.maxDelayMs - this.config.minDelayMs);
    await this.sleep(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limiter status
   */
  getStatus(): { tokens: number; burstCount: number } {
    this.refillTokens();
    return {
      tokens: Math.floor(this.tokens),
      burstCount: this.burstCount,
    };
  }
}

// Export singleton instance for shared use
export const rateLimiter = new RateLimiter();
