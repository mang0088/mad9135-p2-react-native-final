'use strict';

/**
 * Minimal in-memory TTL cache.
 *
 * Used to avoid spending Geoapify credits on identical geocoding/places
 * requests. Entries expire by time and the store is capped so a long-running
 * process cannot grow without bound. No background timers are created.
 */
function createTtlCache({ ttlMs, maxEntries = 500 } = {}) {
  const store = new Map();

  return {
    get(key) {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (hit.expires <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return hit.value;
    },

    set(key, value) {
      if (store.has(key)) store.delete(key);
      if (store.size >= maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, expires: Date.now() + ttlMs });
    },

    clear() {
      store.clear();
    },

    get size() {
      return store.size;
    },
  };
}

module.exports = { createTtlCache };
