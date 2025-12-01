/**
 * Rate Limiter Implementation
 *
 * Implements token bucket algorithm for client-side rate limiting
 * Prevents overwhelming external APIs and triggering rate limit errors
 */

export interface RateLimiterOptions {
  maxRequests?: number;    // Maximum requests in window (default: 10)
  windowMs?: number;       // Time window in milliseconds (default: 1000)
  name?: string;           // Limiter name for logging
}

export interface RateLimiterStats {
  maxRequests: number;
  windowMs: number;
  currentRequests: number;
  nextAvailableAt: Date | null;
  utilizationPercent: number;
}

/**
 * Token Bucket Rate Limiter
 *
 * Example usage:
 * ```typescript
 * const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });
 *
 * await limiter.acquire(); // Wait if needed
 * const result = await makeAPICall();
 * ```
 */
export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly name: string;

  constructor(options: RateLimiterOptions = {}) {
    this.maxRequests = options.maxRequests || 10;
    this.windowMs = options.windowMs || 1000;
    this.name = options.name || 'rate-limiter';
  }

  /**
   * Acquire permission to make a request
   * Will wait if rate limit is reached
   *
   * @returns Promise that resolves when request can proceed
   */
  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove requests outside current window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      // Calculate wait time until oldest request expires
      const oldestRequest = Math.min(...this.requests);
      const waitTime = this.windowMs - (now - oldestRequest);

      this.log(`Rate limit reached, waiting ${waitTime}ms`, {
        currentRequests: this.requests.length,
        maxRequests: this.maxRequests,
      });

      await this.sleep(waitTime);

      // Retry acquisition after waiting
      return this.acquire();
    }

    // Record this request
    this.requests.push(now);
  }

  /**
   * Try to acquire without waiting
   *
   * @returns true if acquired, false if would need to wait
   */
  tryAcquire(): boolean {
    const now = Date.now();

    // Remove requests outside current window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }

  /**
   * Get current rate limiter statistics
   */
  getStats(): RateLimiterStats {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    let nextAvailableAt: Date | null = null;
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...this.requests);
      nextAvailableAt = new Date(oldestRequest + this.windowMs);
    }

    return {
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      currentRequests: this.requests.length,
      nextAvailableAt,
      utilizationPercent: (this.requests.length / this.maxRequests) * 100,
    };
  }

  /**
   * Reset rate limiter (clear all request history)
   */
  reset(): void {
    this.log('Resetting rate limiter');
    this.requests = [];
  }

  /**
   * Check if rate limiter has capacity
   */
  hasCapacity(): boolean {
    const now = Date.now();
    const activeRequests = this.requests.filter(time => now - time < this.windowMs);
    return activeRequests.length < this.maxRequests;
  }

  /**
   * Get time until next request is available (in ms)
   * Returns 0 if immediately available
   */
  getWaitTime(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    if (this.requests.length < this.maxRequests) {
      return 0;
    }

    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, this.windowMs - (now - oldestRequest));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(message: string, data?: any): void {
    console.log(`[RateLimiter:${this.name}] ${message}`, data || '');
  }
}

/**
 * Sliding Window Rate Limiter
 * More accurate than token bucket for burst prevention
 */
export class SlidingWindowRateLimiter {
  private requestTimestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly name: string;

  constructor(options: RateLimiterOptions = {}) {
    this.maxRequests = options.maxRequests || 10;
    this.windowMs = options.windowMs || 1000;
    this.name = options.name || 'sliding-window-limiter';
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove timestamps outside window
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > windowStart);

    if (this.requestTimestamps.length >= this.maxRequests) {
      // Calculate precise wait time
      const oldestInWindow = Math.min(...this.requestTimestamps);
      const waitTime = Math.ceil((oldestInWindow + this.windowMs) - now);

      if (waitTime > 0) {
        await this.sleep(waitTime);
        return this.acquire(); // Retry
      }
    }

    this.requestTimestamps.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Multi-tier Rate Limiter
 * Enforces multiple rate limits simultaneously (e.g., 10/sec AND 100/min)
 */
export class MultiTierRateLimiter {
  private limiters: RateLimiter[];

  constructor(tiers: RateLimiterOptions[]) {
    this.limiters = tiers.map((options, index) =>
      new RateLimiter({ ...options, name: `tier-${index}` })
    );
  }

  /**
   * Acquire must pass all tier limits
   */
  async acquire(): Promise<void> {
    for (const limiter of this.limiters) {
      await limiter.acquire();
    }
  }

  getStats(): RateLimiterStats[] {
    return this.limiters.map(l => l.getStats());
  }

  reset(): void {
    this.limiters.forEach(l => l.reset());
  }
}
