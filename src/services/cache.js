const memoryCache = new Map();

export const cache = {
  get(key) {
    const item = memoryCache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      memoryCache.delete(key);
      return null;
    }
    return item.data;
  },

  set(key, data, ttlMs = 30000) {
    memoryCache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  },

  invalidate(prefix = '') {
    if (!prefix) {
      memoryCache.clear();
      return;
    }
    for (const key of memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
  },
};

export default cache;
