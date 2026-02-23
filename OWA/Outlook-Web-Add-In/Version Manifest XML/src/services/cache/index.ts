/**
 * Cache Service Module
 * Export cache service and types
 */

import { cacheService as _cacheService } from "./CacheService";

export { cacheService, CacheService } from "./CacheService";
export { StorageType } from "./types";
export { CACHE_KEYS, CACHE_TTL, CACHE_CONFIG } from "./config";
export type { CacheOptions, CacheEntry, StorageUsage } from "./types";

export const clearSearchCache = (namespace?: string): Promise<number> =>
  _cacheService.clearSearchCache(namespace);

export const clearFavoritesCache = (namespace?: string): Promise<number> =>
  _cacheService.clearFavoritesCache(namespace);

export const clearDocumentsCache = (namespace?: string, aktId?: number): Promise<number> =>
  _cacheService.clearDocumentsCache(namespace, aktId);

export const clearAllDocuments = (namespace?: string): Promise<number> =>
  _cacheService.clearAllDocuments(namespace);

export const clearServicesCache = (namespace?: string): Promise<number> =>
  _cacheService.clearServicesCache(namespace);
