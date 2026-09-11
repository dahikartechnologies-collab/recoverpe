type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function readDashboardCache<T>(key: string): T | null {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  return entry.value;
}

export function writeDashboardCache<T>(
  key: string,
  value: T,
  ttlMs: number
): void {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateDashboardCache(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear();
    inflight.clear();
    return;
  }

  Array.from(memoryCache.keys()).forEach((key) => {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  });

  Array.from(inflight.keys()).forEach((key) => {
    if (key.startsWith(prefix)) {
      inflight.delete(key);
    }
  });
}

export async function coalesceDashboardRequest<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const cached = readDashboardCache<T>(key);

  if (cached) {
    return cached;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;

  if (pending) {
    return pending;
  }

  const request = loader()
    .then((value) => {
      writeDashboardCache(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}
