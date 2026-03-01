type CacheEnvelope<T> = {
  value: T;
  expiresAt: number;
};

function safeLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, value: T, ttlMs: number) {
  const storage = safeLocalStorage();
  if (!storage) return;
  const payload: CacheEnvelope<T> = {
    value,
    expiresAt: Date.now() + Math.max(0, ttlMs),
  };
  storage.setItem(key, JSON.stringify(payload));
}

export function getCache<T>(key: string): T | null {
  const storage = safeLocalStorage();
  if (!storage) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as CacheEnvelope<T>;
    if (!payload || typeof payload.expiresAt !== 'number' || payload.expiresAt <= Date.now()) {
      storage.removeItem(key);
      return null;
    }
    return payload.value;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function clearCache(...keys: string[]) {
  const storage = safeLocalStorage();
  if (!storage) return;
  keys.forEach((k) => storage.removeItem(k));
}
