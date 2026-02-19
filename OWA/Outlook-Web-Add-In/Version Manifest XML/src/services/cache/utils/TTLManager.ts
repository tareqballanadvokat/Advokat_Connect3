/**
 * TTL (Time-To-Live) Manager
 * Handles expiration logic for cached entries
 */
import { getLogger } from "../../logger";

const logger = getLogger();
import { CacheEntry } from "../types";

export class TTLManager {
  /**
   * Wrap data with TTL metadata
   */
  static wrap<T>(data: T, ttl?: number, namespace?: string): CacheEntry<T> {
    // Validate TTL: must be positive or undefined
    if (ttl !== undefined && ttl <= 0) {
      logger.warn(`Invalid TTL value: ${ttl}. Using no expiration.`, "TTLManager");
      ttl = undefined;
    }

    const now = Date.now();
    return {
      data,
      createdAt: now,
      expiresAt: ttl ? now + ttl : null,
      lastAccessed: now,
      namespace,
    };
  }

  /**
   * Check if cache entry is expired
   */
  static isExpired<T>(entry: CacheEntry<T>): boolean {
    if (!entry.expiresAt) return false;
    return Date.now() >= entry.expiresAt;
  }

  /**
   * Unwrap data if not expired, return null if expired
   */
  static unwrap<T>(entry: CacheEntry<T>): T | null {
    if (this.isExpired(entry)) {
      return null;
    }
    return entry.data;
  }
}
