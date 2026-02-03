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
