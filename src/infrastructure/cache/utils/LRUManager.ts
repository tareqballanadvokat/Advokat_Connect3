/**
 * LRU (Least Recently Used) Manager
 * Handles eviction of oldest cache entries
 */

import { CacheEntry } from "@infra/cache/types";
import { IStorageStrategy } from "@infra/cache/strategies/IStorageStrategy";
import { TTLManager } from "./TTLManager";
import { STORAGE_PREFIX } from "@infra/cache/config";
import { getLogger } from "@infra/logger";

const logger = getLogger();

export class LRUManager {
  /**
   * Evict the oldest N entries from storage
   */
  static async evictOldest(strategy: IStorageStrategy, count: number): Promise<number> {
    try {
      const keys = await strategy.getAllKeys();
      if (keys.length === 0) return 0;

      const entries: Array<{ key: string; rawKey: string; lastAccessed: number }> = [];

      // Collect all non-expired entries with their lastAccessed timestamps
      for (const key of keys) {
        try {
          const serialized = await strategy.getItem(key);
          if (!serialized) continue;

          const entry = JSON.parse(serialized) as CacheEntry<any>;

          // Skip expired entries (they'll be cleaned up naturally)
          if (TTLManager.isExpired(entry)) {
            const rawKey = key.substring(STORAGE_PREFIX.length);
            await strategy.removeItem(rawKey);
            continue;
          }

          // Strip prefix to get the raw key for removeItem
          const rawKey = key.substring(STORAGE_PREFIX.length);
          entries.push({
            key,
            rawKey,
            lastAccessed: entry.lastAccessed,
          });
        } catch {
          // Skip invalid entries
          continue;
        }
      }

      // Sort by lastAccessed (oldest first)
      entries.sort((a, b) => a.lastAccessed - b.lastAccessed);

      // Remove the oldest N entries using raw keys (without prefix)
      const toRemove = Math.min(count, entries.length);
      for (let i = 0; i < toRemove; i++) {
        await strategy.removeItem(entries[i].rawKey);
      }

      logger.debug(`Evicted ${toRemove} oldest entries`, "LRUManager");
      return toRemove;
    } catch (error) {
      logger.error("Eviction failed: " + String(error), "LRUManager");
      return 0;
    }
  }
}
