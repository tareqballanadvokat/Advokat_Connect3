/**
 * Centralized Cache Configuration
 * Single source of truth for cache keys, TTL values, and storage settings
 */

import { StorageType, CacheOptions } from './types';

/**
 * Cache Keys
 */
export const CACHE_KEYS = {
  FAVORITES_PERSONS: 'favorites_persons',
  FAVORITES_AKTEN: 'favorites_akten',
  DOCUMENTS: 'documents',
  SEARCH_RESULTS: 'search_results',
  USER_PREFERENCES: 'user_preferences',
  SEARCH_HISTORY: 'search_history'
} as const;

/**
 * TTL (Time-To-Live) Constants in milliseconds
 */
export const CACHE_TTL = {
  ONE_HOUR: 60 * 60 * 1000,
  SIX_HOURS: 6 * 60 * 60 * 1000,
  TWELVE_HOURS: 12 * 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
  THIRTY_DAYS: 30 * 24 * 60 * 60 * 1000,
  NEVER: undefined
} as const;

/**
 * Cache Configuration for each data type
 */
export const CACHE_CONFIG: Record<string, CacheOptions> = {
  [CACHE_KEYS.FAVORITES_PERSONS]: {
    storage: StorageType.LOCAL,
    ttl: CACHE_TTL.ONE_DAY
  },
  [CACHE_KEYS.FAVORITES_AKTEN]: {
    storage: StorageType.LOCAL,
    ttl: CACHE_TTL.ONE_DAY
  },
  [CACHE_KEYS.DOCUMENTS]: {
    storage: StorageType.LOCAL,
    ttl: CACHE_TTL.ONE_HOUR
  },
  [CACHE_KEYS.SEARCH_RESULTS]: {
    storage: StorageType.SESSION,
    ttl: CACHE_TTL.NEVER // Session-only
  },
  [CACHE_KEYS.USER_PREFERENCES]: {
    storage: StorageType.LOCAL,
    ttl: CACHE_TTL.NEVER // No expiration
  },
  [CACHE_KEYS.SEARCH_HISTORY]: {
    storage: StorageType.LOCAL,
    ttl: CACHE_TTL.THIRTY_DAYS
  }
} as const;
