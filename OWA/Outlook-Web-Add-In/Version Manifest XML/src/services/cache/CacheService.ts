/**
 * Cache Service
 * Unified interface for caching with multiple storage strategies
 */

import { IStorageStrategy } from './strategies/IStorageStrategy';
import { LocalStorageStrategy } from './strategies/LocalStorageStrategy';
import { StorageType, CacheOptions, CacheEntry } from './types';
import { TTLManager } from './utils/TTLManager';
import { LRUManager } from './utils/LRUManager';

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
    // Add other strategies as needed
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

    const cacheKey = this.buildKey(key, options.namespace);
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

    await strategy.setItem(cacheKey, serialized);
    console.log(`✅ [CacheService] Cached ${cacheKey} in ${options.storage} (${entrySize} bytes)`);
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

    const cacheKey = this.buildKey(key, options.namespace);
    const serialized = await strategy.getItem(cacheKey);

    if (!serialized) {
      return null;
    }

    try {
      const entry = JSON.parse(serialized) as CacheEntry<T>;
      const data = TTLManager.unwrap(entry);

      if (data === null) {
        console.log(`⏰ [CacheService] Cache entry expired: ${cacheKey}`);
        await strategy.removeItem(cacheKey);
        return null;
      }

      console.log(`✅ [CacheService] Retrieved ${cacheKey} from ${options.storage}`);
      return data;
    } catch (error) {
      console.error(`❌ [CacheService] Failed to parse cache entry: ${cacheKey}`, error);
      return null;
    }
  }

  /**
   * Remove value from cache
   */
  async remove(key: string, options: CacheOptions): Promise<void> {
    const strategy = this.strategies.get(options.storage);
    if (!strategy) return;

    const cacheKey = this.buildKey(key, options.namespace);
    await strategy.removeItem(cacheKey);
    console.log(`🗑️ [CacheService] Removed ${cacheKey} from ${options.storage}`);
  }

  /**
   * Clear all entries for a namespace (e.g., on logout)
   */
  async clearNamespace(namespace: string, storageType?: StorageType): Promise<void> {
    const strategies = storageType 
      ? [this.strategies.get(storageType)].filter(Boolean)
      : Array.from(this.strategies.values());

    for (const strategy of strategies) {
      const keys = await strategy!.getAllKeys();
      const prefix = 'advokat_connect_';
      // Use startsWith to avoid matching partial usernames (e.g., user1 vs user123)
      const namespacedKeys = keys.filter(k => k.startsWith(`${prefix}${namespace}:`));

      for (const key of namespacedKeys) {
        await strategy!.removeItem(key);
      }

      console.log(`🗑️ [CacheService] Cleared ${namespacedKeys.length} entries for namespace ${namespace}`);
    }
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
