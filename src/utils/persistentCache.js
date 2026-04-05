/**
 * persistentCache.js
 * Thin localStorage-backed cache with TTL support.
 * Keeps API data warm across page navigations without a full refetch.
 */

const PREFIX = "tn_cache_";

/**
 * Write a value to the cache.
 * @param {string} key
 * @param {*} value  — must be JSON-serialisable
 * @param {number} ttlMs — time-to-live in milliseconds (default 5 min)
 */
export function cacheSet(key, value, ttlMs = 5 * 60 * 1000) {
  try {
    const entry = { value, expiresAt: Date.now() + ttlMs };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Ignore QuotaExceededError silently
  }
}

/**
 * Read a value from the cache.
 * Returns null if the key is missing or expired.
 * @param {string} key
 * @returns {*|null}
 */
export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { value, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

/** Remove a specific key from the cache. */
export function cacheDelete(key) {
  localStorage.removeItem(PREFIX + key);
}

/** Clear all TEMPONYAN cache entries. */
export function cacheClear() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}
