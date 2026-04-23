import { PerformanceMonitor, performanceMonitor } from '@/lib/performance';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('recordMetric', () => {
    it('records a metric value', () => {
      monitor.recordMetric('test', 100);
      const stats = monitor.getMetricStats('test');
      expect(stats).not.toBeNull();
      expect(stats?.count).toBe(1);
      expect(stats?.avg).toBe(100);
    });

    it('keeps only last 100 values', () => {
      for (let i = 0; i < 150; i++) {
        monitor.recordMetric('test', i);
      }
      const stats = monitor.getMetricStats('test');
      expect(stats?.count).toBe(100);
    });

    it('calculates correct statistics', () => {
      monitor.recordMetric('test', 10);
      monitor.recordMetric('test', 20);
      monitor.recordMetric('test', 30);
      const stats = monitor.getMetricStats('test');
      expect(stats?.avg).toBe(20);
      expect(stats?.min).toBe(10);
      expect(stats?.max).toBe(30);
      expect(stats?.count).toBe(3);
    });
  });

  describe('recordApiCall', () => {
    it('records API call with api_ prefix', () => {
      monitor.recordApiCall('signal', 150);
      const stats = monitor.getMetricStats('api_signal');
      expect(stats).not.toBeNull();
      expect(stats?.count).toBe(1);
    });
  });

  describe('recordWebSocketLatency', () => {
    it('records WebSocket latency', () => {
      monitor.recordWebSocketLatency(50);
      const stats = monitor.getMetricStats('ws_latency');
      expect(stats).not.toBeNull();
      expect(stats?.count).toBe(1);
    });
  });

  describe('getMetricStats', () => {
    it('returns null for non-existent metric', () => {
      const stats = monitor.getMetricStats('nonexistent');
      expect(stats).toBeNull();
    });

    it('returns null for empty metric', () => {
      monitor.recordMetric('test', 100);
      monitor.reset();
      const stats = monitor.getMetricStats('test');
      expect(stats).toBeNull();
    });
  });

  describe('getAllMetrics', () => {
    it('returns all recorded metrics', () => {
      monitor.recordMetric('metric1', 10);
      monitor.recordMetric('metric2', 20);
      const all = monitor.getAllMetrics();
      expect(Object.keys(all)).toHaveLength(2);
      expect(all['metric1']).toBeDefined();
      expect(all['metric2']).toBeDefined();
    });

    it('returns empty object when no metrics', () => {
      const all = monitor.getAllMetrics();
      expect(Object.keys(all)).toHaveLength(0);
    });
  });

  describe('getUptime', () => {
    it('returns uptime in milliseconds', () => {
      const uptime = monitor.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(typeof uptime).toBe('number');
    });

    it('uptime increases over time', (done) => {
      const uptime1 = monitor.getUptime();
      setTimeout(() => {
        const uptime2 = monitor.getUptime();
        expect(uptime2).toBeGreaterThan(uptime1);
        done();
      }, 10);
    });
  });

  describe('reset', () => {
    it('clears all metrics', () => {
      monitor.recordMetric('test', 100);
      monitor.reset();
      const stats = monitor.getMetricStats('test');
      expect(stats).toBeNull();
    });

    it('resets start time', () => {
      const uptime1 = monitor.getUptime();
      monitor.reset();
      const uptime2 = monitor.getUptime();
      expect(uptime2).toBeLessThan(uptime1);
    });
  });

  describe('singleton instance', () => {
    it('performanceMonitor is a singleton', () => {
      expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('singleton persists across operations', () => {
      performanceMonitor.recordMetric('singleton_test', 42);
      const stats = performanceMonitor.getMetricStats('singleton_test');
      expect(stats?.avg).toBe(42);
      performanceMonitor.reset();
    });
  });
});
