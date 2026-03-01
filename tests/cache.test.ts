import { beforeEach, describe, expect, it } from 'vitest';
import { clearCache, getCache, setCache } from '../src/lib/cache';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

describe('cache ttl', () => {
  beforeEach(() => {
    (global as any).window = { localStorage: new MemoryStorage() };
  });

  it('reads value before ttl and expires after ttl', async () => {
    setCache('k', { value: 1 }, 5);
    expect(getCache<{ value: number }>('k')?.value).toBe(1);
    await new Promise((r) => setTimeout(r, 10));
    expect(getCache<{ value: number }>('k')).toBeNull();
  });

  it('clearCache removes keys', () => {
    setCache('a', 1, 1000);
    clearCache('a');
    expect(getCache<number>('a')).toBeNull();
  });
});
