import type { GeoLocation } from "./types";

interface CacheEnvelope<T> {
  expiresAt: number;
  value: T;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Cache key for a location's historical data. Keyed by rounded coordinates and
 * the current date so it naturally rolls over daily. Units are NOT part of the
 * key: history is stored canonically in metric and converted at display time,
 * so toggling °F/°C never invalidates the cache.
 */
export function historyCacheKey(location: GeoLocation): string {
  const lat = location.latitude.toFixed(2);
  const lon = location.longitude.toFixed(2);
  return `wtm:archive:${lat}_${lon}:${todayStamp()}`;
}

export function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const env = JSON.parse(raw) as CacheEnvelope<T>;
    if (Date.now() > env.expiresAt) {
      window.localStorage.removeItem(key);
      return null;
    }
    return env.value;
  } catch {
    return null;
  }
}

export function writeCache<T>(
  key: string,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  if (typeof window === "undefined") return;
  try {
    const env: CacheEnvelope<T> = { expiresAt: Date.now() + ttlMs, value };
    window.localStorage.setItem(key, JSON.stringify(env));
  } catch {
    // Quota exceeded or serialization failure — proceed without caching.
    pruneArchiveCache();
  }
}

/** Removes archive entries from previous days to reclaim space. */
function pruneArchiveCache(): void {
  if (typeof window === "undefined") return;
  const stamp = todayStamp();
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("wtm:archive:") && !k.endsWith(stamp)) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
