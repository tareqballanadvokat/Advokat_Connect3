/**
 * Cache Service
 * Unified interface for caching with multiple storage strategies
 */

import { IStorageStrategy } from './strategies/IStorageStrategy';
import { LocalStorageStrategy } from './strategies/LocalStorageStrategy';
import { SessionStorageStrategy } from './strategies/SessionStorageStrategy';
import { StorageType, CacheOptions, CacheEntry } from './types';
import { TTLManager } from './utils/TTLManager';
import { LRUManager } from './utils/LRUManager';
import { STORAGE_PREFIX } from './config';

export class CacheService {
  private strategies: Map<StorageType, IStorageStrategy>;
  private currentNamespace?: string;
  private readonly QUOTA_THRESHOLD = 80; // Percentage
  private readonly EVICTION_COUNT = 5; // Number of entries to evict

  constructor() {
    this.strategies = new Map();
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    this.strategies.set(StorageType.LOCAL, new LocalStorageStrategy());
    this.strategies.set(StorageType.SESSION, new SessionStorageStrategy());
    // Add other strategies as needed (Memory, IndexedDB, etc.)
  }

  /**
   * Set current namespace (typically user ID)
   */
  setNamespace(namespace: string | undefined): void {
    this.currentNamespace = namespace;
  }

  /**
   * Build cache key with namespace
   */
  private buildKey(key: string, namespace?: string): string {
    const ns = namespace !== undefined ? namespace : this.currentNamespace;
    return ns ? `${ns}:${key}` : key;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, data: T, options: CacheOptions): Promise<void> {
    const strategy = this.strategies.get(options.storage);
    if (!strategy) {
      throw new Error(`Storage strategy not found: ${options.storage}`);
    }

    const isAvailable = await strategy.isAvailable();
    if (!isAvailable) {
      console.warn(`⚠️ [CacheService] Storage ${options.storage} not available`);
      return;
    }

    const namespacedKey = this.buildKey(key, options.namespace);
    const entry = TTLManager.wrap(data, options.ttl, options.namespace);
    const serialized = JSON.stringify(entry);
    const entrySize = new Blob([serialized]).size;

    // Check storage usage with actual entry size
    const usage = await strategy.getUsage();
    const spaceNeeded = usage.used + entrySize;
    const threshold = usage.quota * (this.QUOTA_THRESHOLD / 100);

    if (spaceNeeded > threshold) {
      const bytesToFree = spaceNeeded - threshold;
      console.warn(`⚠️ [CacheService] Storage ${options.storage} needs ${bytesToFree} bytes, evicting entries`);
      await LRUManager.evictOldest(strategy, this.EVICTION_COUNT);
    }

    // Try to write with retry on quota error
    try {
      await strategy.setItem(namespacedKey, serialized);
      console.log(`✅ [CacheService] Cached ${namespacedKey} in ${options.storage} (${entrySize} bytes)`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('quota exceeded')) {
        console.warn(`⚠️ [CacheService] Quota exceeded, aggressive eviction...`);
        await LRUManager.evictOldest(strategy, this.EVICTION_COUNT * 3);
        // Retry once
        await strategy.setItem(namespacedKey, serialized);
        console.log(`✅ [CacheService] Cached ${namespacedKey} after eviction (${entrySize} bytes)`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options: CacheOptions): Promise<T | null> {
    const strategy = this.strategies.get(options.storage);
    if (!strategy) {
      console.warn(`⚠️ [CacheService] Storage strategy not found: ${options.storage}`);
      return null;
    }

    const namespacedKey = this.buildKey(key, options.namespace);
    const serialized = await strategy.getItem(namespacedKey);

    if (!serialized) {
      return null;
    }

    try {
      const entry = JSON.parse(serialized) as CacheEntry<T>;
      const data = TTLManager.unwrap(entry);

      if (data === null) {
        console.log(`⏰ [CacheService] Cache entry expired: ${namespacedKey}`);
        await strategy.removeItem(namespacedKey);
        return null;
      }

      console.log(`✅ [CacheService] Retrieved ${namespacedKey} from ${options.storage}`);
      return data;
    } catch (error) {
      console.error(`❌ [CacheService] Failed to parse cache entry: ${namespacedKey}`, error);
      return null;
    }
  }

  /**
   * Remove value from cache
   */
  async remove(key: string, options: CacheOptions): Promise<void> {
    const strategy = this.strategies.get(options.storage);
    if (!strategy) return;

    const namespacedKey = this.buildKey(key, options.namespace);
    await strategy.removeItem(namespacedKey);
    console.log(`🗑️ [CacheService] Removed ${namespacedKey} from ${options.storage}`);
  }

  /**
   * Clear all entries for a namespace (e.g., on logout)
   * @returns Total number of entries cleared
   */
  async clearNamespace(namespace: string, storageType?: StorageType): Promise<number> {
    const strategies = storageType 
      ? [this.strategies.get(storageType)].filter(Boolean)
      : Array.from(this.strategies.values());

    let totalCleared = 0;

    for (const strategy of strategies) {
      const keys = await strategy!.getAllKeys();
      // Use startsWith to avoid matching partial usernames (e.g., user1 vs user123)
      const namespacedKeys = keys.filter(k => k.startsWith(`${STORAGE_PREFIX}${namespace}:`));

      for (const key of namespacedKeys) {
        // Strip prefix before removing since removeItem adds it back
        const rawKey = key.substring(STORAGE_PREFIX.length);
        await strategy!.removeItem(rawKey);
      }

      totalCleared += namespacedKeys.length;
      console.log(`🗑️ [CacheService] Cleared ${namespacedKeys.length} entries for namespace ${namespace}`);
    }

    return totalCleared;
  }

  /**
   * Clear all cache entries across all storage types
   * @returns Total number of entries cleared
   */
  async clearAll(): Promise<number> {
    let totalCleared = 0;

    for (const [storageType, strategy] of Array.from(this.strategies.entries())) {
      const keys = await strategy.getAllKeys();
      // Only clear keys with our prefix
      const ourKeys = keys.filter(k => k.startsWith(STORAGE_PREFIX));

      for (const key of ourKeys) {
        // Strip prefix before removing since removeItem adds it back
        const rawKey = key.substring(STORAGE_PREFIX.length);
        await strategy.removeItem(rawKey);
      }

      totalCleared += ourKeys.length;
      console.log(`🗑️ [CacheService] Cleared ${ourKeys.length} entries from ${storageType}`);
    }

    return totalCleared;
  }

  /**
   * Clear specific cache type(s) for a namespace
   * @param cacheKeys - Single key or array of keys to clear
   * @param options - Optional namespace to limit clearing
   * @returns Number of entries cleared
   */
  async clearCacheType(
    cacheKeys: string | string[], 
    options?: { namespace?: string }
  ): Promise<number> {
    const keys = Array.isArray(cacheKeys) ? cacheKeys : [cacheKeys];
    let cleared = 0;
    
    for (const [storageType, strategy] of Array.from(this.strategies.entries())) {
      const storageKeys = await strategy.getAllKeys();
      
      const matchesAnyKey = (storageKey: string): boolean => {
        for (const cacheKey of keys) {
          if (options?.namespace) {
            // Match: prefix + namespace + : + cacheKey
            const searchPattern = `${STORAGE_PREFIX}${options.namespace}:${cacheKey}`;
            if (storageKey.startsWith(searchPattern)) {
              return true;
            }
          } else {
            // Match across all namespaces
            if (storageKey.includes(`:${cacheKey}`) || storageKey.startsWith(`${STORAGE_PREFIX}${cacheKey}`)) {
              return true;
            }
          }
        }
        return false;
      };
      
      // Single filter pass for all keys
      const matchingKeys = storageKeys.filter(matchesAnyKey);
      
      // Remove all matching keys
      for (const key of matchingKeys) {
        const rawKey = key.substring(STORAGE_PREFIX.length);
        await strategy.removeItem(rawKey);
        cleared++;
      }
    }
    
    console.log(`🗑️ [CacheService] Cleared ${cleared} entries for cache type(s): ${Array.isArray(cacheKeys) ? cacheKeys.join(', ') : cacheKeys}`);
    return cleared;
  }

  /**
   * Helper method: Clear search cache
   */
  async clearSearchCache(namespace?: string): Promise<number> {
    return this.clearCacheType('search_results', { namespace });
  }

  /**
   * Helper method: Clear favorites cache (both persons and akten)
   */
  async clearFavoritesCache(namespace?: string): Promise<number> {
    return this.clearCacheType(
      ['favorites_persons', 'favorites_akten'], 
      { namespace }
    );
  }

  /**
   * Helper method: Clear documents cache
   * @param namespace - Optional namespace to limit clearing
   * @param aktId - Optional aktId to clear specific document cache (documents_${aktId})
   */
  async clearDocumentsCache(namespace?: string, aktId?: number): Promise<number> {
    const key = aktId !== undefined ? `documents_${aktId}` : 'documents';
    return this.clearCacheType(key, { namespace });
  }

  /**
   * Helper method: Clear all documents cache (wildcard for all aktIds)
   * Clears all keys matching documents_{number} pattern
   * @param namespace - Optional namespace to limit clearing
   */
  async clearAllDocuments(namespace?: string): Promise<number> {
    let cleared = 0;
    
    for (const [storageType, strategy] of Array.from(this.strategies.entries())) {
      const storageKeys = await strategy.getAllKeys();
      
      // Match only keys with "documents_{digits}" pattern
      const matchingKeys = storageKeys.filter(storageKey => {
        if (namespace) {
          // Match: prefix + namespace + : + documents_{digits}
          const pattern = `${STORAGE_PREFIX}${namespace}:documents_`;
          if (!storageKey.startsWith(pattern)) return false;
          
          // Verify it's followed by a number (aktId)
          const suffix = storageKey.substring(pattern.length);
          return /^\d+$/.test(suffix);
        } else {
          // Match across all namespaces: :documents_{digits} or prefix+documents_{digits}
          const match1 = storageKey.match(/:documents_(\d+)$/);
          if (match1) return true;
          
          const escapedPrefix = STORAGE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const match2 = storageKey.match(new RegExp(`^${escapedPrefix}documents_(\\d+)$`));
          return !!match2;
        }
      });
      
      // Remove all matching keys
      for (const key of matchingKeys) {
        const rawKey = key.substring(STORAGE_PREFIX.length);
        await strategy.removeItem(rawKey);
        cleared++;
      }
    }
    
    console.log(`🗑️ [CacheService] Cleared ${cleared} document entries${namespace ? ` for namespace ${namespace}` : ''}`);
    return cleared;
  }

  /**
   * Helper method: Clear services cache
   */
  async clearServicesCache(namespace?: string): Promise<number> {
    return this.clearCacheType('services', { namespace });
  }

  /**
   * Get storage usage
   */
  async getUsage(storageType: StorageType) {
    const strategy = this.strategies.get(storageType);
    if (!strategy) {
      throw new Error(`Storage strategy not found: ${storageType}`);
    }
    return await strategy.getUsage();
  }
}

// Singleton instance
export const cacheService = new CacheService();
