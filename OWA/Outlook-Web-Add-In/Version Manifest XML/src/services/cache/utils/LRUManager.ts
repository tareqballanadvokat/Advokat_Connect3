/**
 * LRU (Least Recently Used) Manager
 * Handles eviction of oldest cache entries
 */

import { CacheEntry } from '../types';
import { IStorageStrategy } from '../strategies/IStorageStrategy';

export class LRUManager {
  /**
   * Evict the oldest N entries from storage
   */
  static async evictOldest(
    strategy: IStorageStrategy,
    count: number
  ): Promise<number> {
    try {
      const keys = await strategy.getAllKeys();
      if (keys.length === 0) return 0;

      const entries: Array<{ key: string; lastAccessed: number }> = [];

      // Collect all entries with their lastAccessed timestamps
      for (const key of keys) {
        try {
          const serialized = await strategy.getItem(key);
          if (!serialized) continue;

          const entry = JSON.parse(serialized) as CacheEntry<any>;
          entries.push({
            key,
            lastAccessed: entry.lastAccessed || entry.createdAt
          });
        } catch {
          // Skip invalid entries
          continue;
        }
      }

      // Sort by lastAccessed (oldest first)
      entries.sort((a, b) => a.lastAccessed - b.lastAccessed);

      // Remove the oldest N entries
      const toRemove = Math.min(count, entries.length);
      for (let i = 0; i < toRemove; i++) {
        await strategy.removeItem(entries[i].key);
      }

      console.log(`🗑️ [LRUManager] Evicted ${toRemove} oldest entries`);
      return toRemove;
    } catch (error) {
      console.error('❌ [LRUManager] Eviction failed:', error);
      return 0;
    }
  }

  /**
   * Update lastAccessed timestamp for an entry
   */
  static updateAccessTime<T>(entry: CacheEntry<T>): CacheEntry<T> {
    return {
      ...entry,
      lastAccessed: Date.now()
    };
  }
}
