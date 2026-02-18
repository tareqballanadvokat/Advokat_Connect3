/**
 * Cache Service Type Definitions
 */

export enum StorageType {
  LOCAL = 'local',
  SESSION = 'session',
  MEMORY = 'memory',
  INDEXED_DB = 'indexeddb'
}

export interface CacheOptions {
  storage: StorageType;
  ttl?: number; // milliseconds, undefined = no expiration
  namespace?: string; // user ID for isolation
  compress?: boolean; // Enable compression for this cache entry
  compressionThreshold?: number; // Min bytes to compress (default: 1024)
}

export interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number | null;
  lastAccessed: number;
  namespace?: string;
}

export interface StorageUsage {
  used: number;
  quota: number;
  percentage: number;
}
