import { apiCache, priceCache, signalCache } from '@/lib/cache';

describe('SimpleCache', () => {
  beforeEach(() => {
    apiCache.clear();
    priceCache.clear();
    signalCache.clear();
  });

  describe('apiCache', () => {
    it('sets and retrieves data', () => {
      apiCache.set('test-key', { value: 42 });
      const result = apiCache.get('test-key');
      expect(result).toEqual({ value: 42 });
    });

    it('returns null for non-existent key', () => {
      const result = apiCache.get('non-existent');
      expect(result).toBeNull();
    });

    it('expires data after TTL', (done) => {
      apiCache.set('test-key', { value: 42 }, 100);
      setTimeout(() => {
        const result = apiCache.get('test-key');
        expect(result).toBeNull();
        done();
      }, 150);
    });

    it('uses default TTL when not specified', () => {
      apiCache.set('test-key', { value: 42 });
      const result = apiCache.get('test-key');
      expect(result).toEqual({ value: 42 });
    });

    it('has returns true for existing key', () => {
      apiCache.set('test-key', { value: 42 });
      expect(apiCache.has('test-key')).toBe(true);
    });

    it('has returns false for non-existent key', () => {
      expect(apiCache.has('non-existent')).toBe(false);
    });

    it('deletes key', () => {
      apiCache.set('test-key', { value: 42 });
      apiCache.delete('test-key');
      expect(apiCache.get('test-key')).toBeNull();
    });

    it('clears all entries', () => {
      apiCache.set('key1', { value: 1 });
      apiCache.set('key2', { value: 2 });
      apiCache.clear();
      expect(apiCache.size()).toBe(0);
    });

    it('cleanup removes expired entries', (done) => {
      apiCache.set('expired', { value: 1 }, 50);
      apiCache.set('valid', { value: 2 }, 5000);
      setTimeout(() => {
        apiCache.cleanup();
        expect(apiCache.has('expired')).toBe(false);
        expect(apiCache.has('valid')).toBe(true);
        done();
      }, 100);
    });

    it('size returns correct count', () => {
      expect(apiCache.size()).toBe(0);
      apiCache.set('key1', { value: 1 });
      expect(apiCache.size()).toBe(1);
      apiCache.set('key2', { value: 2 });
      expect(apiCache.size()).toBe(2);
    });
  });

  describe('priceCache', () => {
    it('has 5 second default TTL', () => {
      priceCache.set('test', { price: 50000 });
      const result = priceCache.get('test');
      expect(result).toEqual({ price: 50000 });
    });

    it('expires after 5 seconds', (done) => {
      priceCache.set('test', { price: 50000 });
      setTimeout(() => {
        const result = priceCache.get('test');
        expect(result).toBeNull();
        done();
      }, 5100);
    });
  });

  describe('signalCache', () => {
    it('has 60 second default TTL', () => {
      signalCache.set('test', { signal: 'buy' });
      const result = signalCache.get('test');
      expect(result).toEqual({ signal: 'buy' });
    });

    it('expires after 60 seconds', (done) => {
      signalCache.set('test', { signal: 'buy' });
      setTimeout(() => {
        const result = signalCache.get('test');
        expect(result).toBeNull();
        done();
      }, 61000);
    });
  });

  describe('cache isolation', () => {
    it('different caches do not share data', () => {
      apiCache.set('key', { source: 'api' });
      priceCache.set('key', { source: 'price' });
      signalCache.set('key', { source: 'signal' });

      expect(apiCache.get('key')).toEqual({ source: 'api' });
      expect(priceCache.get('key')).toEqual({ source: 'price' });
      expect(signalCache.get('key')).toEqual({ source: 'signal' });
    });
  });
});
