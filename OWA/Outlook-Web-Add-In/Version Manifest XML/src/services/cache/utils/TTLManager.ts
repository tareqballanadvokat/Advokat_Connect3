/**
 * TTL (Time-To-Live) Manager
 * Handles expiration logic for cached entries
 */

import { CacheEntry } from '../types';

export class TTLManager {
  /**
   * Wrap data with TTL metadata
   */
  static wrap<T>(data: T, ttl?: number, namespace?: string): CacheEntry<T> {
    const now = Date.now();
    return {
      data,
      createdAt: now,
      expiresAt: ttl ? now + ttl : null,
      lastAccessed: now,
      namespace
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
