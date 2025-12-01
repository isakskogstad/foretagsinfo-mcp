/**
 * Performance Metrics Collection
 *
 * Lightweight metrics collection for monitoring application performance
 * without external dependencies.
 */

export interface MetricValue {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  p50: number;  // Median
  p95: number;
  p99: number;
  values: number[];
}

export interface CounterMetric {
  value: number;
  lastUpdated: Date;
}

export interface GaugeMetric {
  value: number;
  lastUpdated: Date;
}

export class Metrics {
  private counters = new Map<string, CounterMetric>();
  private gauges = new Map<string, GaugeMetric>();
  private histograms = new Map<string, number[]>();

  private readonly maxHistogramSize = 1000; // Keep last 1000 values

  /**
   * Increment a counter metric
   *
   * Use for: Total requests, cache hits, errors, etc.
   */
  increment(metric: string, value: number = 1): void {
    const current = this.counters.get(metric);

    if (current) {
      current.value += value;
      current.lastUpdated = new Date();
    } else {
      this.counters.set(metric, {
        value,
        lastUpdated: new Date(),
      });
    }
  }

  /**
   * Set a gauge metric (can go up or down)
   *
   * Use for: Active connections, queue size, memory usage, etc.
   */
  gauge(metric: string, value: number): void {
    this.gauges.set(metric, {
      value,
      lastUpdated: new Date(),
    });
  }

  /**
   * Record a value in histogram
   *
   * Use for: Response times, payload sizes, query durations, etc.
   */
  record(metric: string, value: number): void {
    const values = this.histograms.get(metric) || [];
    values.push(value);

    // Keep only last N values (sliding window)
    if (values.length > this.maxHistogramSize) {
      values.shift();
    }

    this.histograms.set(metric, values);
  }

  /**
   * Get counter value
   */
  getCounter(metric: string): number {
    return this.counters.get(metric)?.value || 0;
  }

  /**
   * Get gauge value
   */
  getGauge(metric: string): number {
    return this.gauges.get(metric)?.value || 0;
  }

  /**
   * Get histogram statistics
   */
  getHistogram(metric: string): MetricValue | null {
    const values = this.histograms.get(metric);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = sum / count;

    return {
      count,
      sum,
      min: sorted[0],
      max: sorted[count - 1],
      mean,
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      values: sorted,
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Export all metrics as JSON
   */
  export(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, Omit<MetricValue, 'values'>>;
    timestamp: string;
  } {
    const counters: Record<string, number> = {};
    const gauges: Record<string, number> = {};
    const histograms: Record<string, Omit<MetricValue, 'values'>> = {};

    for (const [key, value] of this.counters) {
      counters[key] = value.value;
    }

    for (const [key, value] of this.gauges) {
      gauges[key] = value.value;
    }

    for (const [key] of this.histograms) {
      const stats = this.getHistogram(key);
      if (stats) {
        const { values, ...rest } = stats;
        histograms[key] = rest;
      }
    }

    return {
      counters,
      gauges,
      histograms,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Export detailed metrics (including value arrays)
   */
  exportDetailed(): {
    counters: Map<string, CounterMetric>;
    gauges: Map<string, GaugeMetric>;
    histograms: Map<string, MetricValue>;
    timestamp: string;
  } {
    const histograms = new Map<string, MetricValue>();

    for (const [key] of this.histograms) {
      const stats = this.getHistogram(key);
      if (stats) {
        histograms.set(key, stats);
      }
    }

    return {
      counters: new Map(this.counters),
      gauges: new Map(this.gauges),
      histograms,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Reset specific metric
   */
  resetMetric(metric: string): void {
    this.counters.delete(metric);
    this.gauges.delete(metric);
    this.histograms.delete(metric);
  }

  /**
   * Get all metric names
   */
  getMetricNames(): {
    counters: string[];
    gauges: string[];
    histograms: string[];
  } {
    return {
      counters: Array.from(this.counters.keys()),
      gauges: Array.from(this.gauges.keys()),
      histograms: Array.from(this.histograms.keys()),
    };
  }
}

/**
 * Timer utility for measuring durations
 */
export class Timer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time in milliseconds
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Reset timer
   */
  reset(): void {
    this.startTime = Date.now();
  }

  /**
   * Stop timer and record in metrics
   */
  stop(metrics: Metrics, metricName: string): number {
    const duration = this.elapsed();
    metrics.record(metricName, duration);
    return duration;
  }
}

/**
 * Decorator for automatic performance tracking
 */
export function measurePerformance(metricName: string, metrics: Metrics) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const timer = new Timer();
      try {
        const result = await originalMethod.apply(this, args);
        timer.stop(metrics, metricName);
        metrics.increment(`${metricName}.success`);
        return result;
      } catch (error) {
        timer.stop(metrics, `${metricName}.error`);
        metrics.increment(`${metricName}.error`);
        throw error;
      }
    };

    return descriptor;
  };
}

// Singleton instance
export const metrics = new Metrics();

/**
 * Convenience functions using singleton
 */
export const incrementCounter = (metric: string, value?: number) =>
  metrics.increment(metric, value);

export const setGauge = (metric: string, value: number) =>
  metrics.gauge(metric, value);

export const recordValue = (metric: string, value: number) =>
  metrics.record(metric, value);

export const getMetrics = () => metrics.export();

export const createTimer = () => new Timer();
