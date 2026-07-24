/**
 * services/cacheService.ts
 *
 * Simple, typed in-memory caching utility for successful API responses.
 * Cache duration: 24 hours.
 */

export interface UnifiedProduct {
  name: string;
  brand: string;
  manufacturer: string;
  category: string;
  barcode: string;
  size: string;
  referenceImage: string;
}

interface CacheEntry {
  product: UnifiedProduct;
  timestamp: number;
}

// Global cache object (persists across hot-reloaded lambdas in Vercel)
const globalCache = globalThis as unknown as {
  productCache: Record<string, CacheEntry> | undefined;
};

if (!globalCache.productCache) {
  globalCache.productCache = {};
}

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getCachedProduct(barcode: string): Promise<UnifiedProduct | null> {
  const cache = globalCache.productCache;
  if (!cache) return null;

  const entry = cache[barcode];
  if (!entry) return null;

  const isExpired = Date.now() - entry.timestamp > CACHE_DURATION_MS;
  if (isExpired) {
    console.log(`[CacheService] Cache expired for barcode: ${barcode}`);
    delete cache[barcode];
    return null;
  }

  console.log(`[CacheService] Cache HIT for barcode: ${barcode}`);
  return entry.product;
}

export async function setCachedProduct(barcode: string, product: UnifiedProduct): Promise<void> {
  const cache = globalCache.productCache;
  if (!cache) return;

  console.log(`[CacheService] Caching product data for barcode: ${barcode}`);
  cache[barcode] = {
    product,
    timestamp: Date.now(),
  };
}
