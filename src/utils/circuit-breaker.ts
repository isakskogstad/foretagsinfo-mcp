/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by stopping requests to failing services
 * and allowing them time to recover.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, reject requests immediately
 * - HALF_OPEN: Testing if service has recovered
 */

export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation
  OPEN = 'OPEN',           // Failing, reject immediately
  HALF_OPEN = 'HALF_OPEN', // Testing recovery
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;      // Open after this many failures (default: 5)
  successThreshold?: number;      // Close after this many successes in HALF_OPEN (default: 2)
  timeout?: number;               // Time before trying HALF_OPEN (default: 60000ms)
  name?: string;                  // Circuit breaker name for logging
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalCalls: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  openedAt?: Date;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private openedAt?: Date;
  private totalCalls: number = 0;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000; // 60 seconds
    this.name = options.name || 'circuit-breaker';
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @param fn Function to execute
   * @returns Result of function execution
   * @throws Error if circuit is OPEN
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      const timeSinceOpen = Date.now() - (this.openedAt?.getTime() || 0);

      if (timeSinceOpen >= this.timeout) {
        this.log('Transitioning to HALF_OPEN state (testing recovery)');
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        this.log('Circuit is OPEN, rejecting request', {
          timeSinceOpen,
          timeout: this.timeout,
          remainingTime: this.timeout - timeSinceOpen,
        });
        throw new CircuitBreakerError(
          `Circuit breaker "${this.name}" is OPEN. Retry after ${Math.ceil((this.timeout - timeSinceOpen) / 1000)}s`,
          this.getStats()
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = new Date();
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.successThreshold) {
        this.log('Circuit recovered, transitioning to CLOSED', {
          successes: this.successCount,
        });
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        this.openedAt = undefined;
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: unknown): void {
    this.lastFailureTime = new Date();
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery test, go back to OPEN
      this.log('Recovery test failed, returning to OPEN state');
      this.state = CircuitState.OPEN;
      this.openedAt = new Date();
      this.successCount = 0;
    } else if (this.failureCount >= this.failureThreshold) {
      // Too many failures, open the circuit
      this.log('Failure threshold reached, opening circuit', {
        failures: this.failureCount,
        threshold: this.failureThreshold,
        error: error instanceof Error ? error.message : String(error),
      });
      this.state = CircuitState.OPEN;
      this.openedAt = new Date();
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
    };
  }

  /**
   * Manually reset circuit breaker to CLOSED state
   */
  reset(): void {
    this.log('Manually resetting circuit breaker');
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.openedAt = undefined;
  }

  /**
   * Check if circuit is accepting requests
   */
  isAvailable(): boolean {
    return this.state !== CircuitState.OPEN;
  }

  private log(message: string, data?: any): void {
    console.log(`[CircuitBreaker:${this.name}] ${message}`, data || '');
  }
}

/**
 * Circuit Breaker Error
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly stats: CircuitBreakerStats
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}
