# Cache Implementation Summary

**Last Updated:** February 16, 2026  
**Purpose:** Quick reference for developers reviewing the cache implementation structure

---

## Overview

This document provides a comprehensive overview of the cache system implementation, including the architecture, implemented features, file structure, and usage patterns. The cache system uses a strategy pattern with support for localStorage and sessionStorage, automatic compression, TTL management, and real-time statistics monitoring.

---

## Core Features

### 1. CacheService (Main Orchestrator)

The CacheService provides a unified interface for all caching operations across the application.

**Key capabilities:**
- Multiple storage strategies (localStorage, sessionStorage)
- Automatic TTL management (1 hour / 24 hours / never)
- User namespace isolation (per-user caching)
- LRU eviction with quota handling
- Prefix isolation (`advokat_connect_`)
- Compression with LZ-string library
- Configurable compression thresholds
- Automatic expansion detection and fallback
- Real-time statistics tracking
- Storage usage monitoring

**Clear operations:**
- `clearNamespace(userId)` - Clear all cache for a specific user
- `clearAll()` - Clear entire cache
- `clearCacheType(key, options)` - Clear specific cache types
- `clearSearchCache()` - Clear search results
- `clearFavoritesCache()` - Clear favorites (persons + cases)
- `clearDocumentsCache(namespace, aktId)` - Clear specific document cache
- `clearAllDocuments()` - Clear all document caches with pattern matching
- `clearServicesCache()` - Clear services list

### 2. Storage Strategies

**LocalStorageStrategy:**
- Persistent storage across sessions
- Used for: Favorites, documents, app version
- Size limit: 5-10 MB
- Survives browser/app restarts

**SessionStorageStrategy:**
- Session-only storage
- Used for: Search results, services list
- Size limit: 5-10 MB
- Cleared when taskpane closes

### 3. Compression System

**Implementation details:**
- Library: lz-string (LZString compression)
- Marker: `__LZ__` prefix for compressed data
- Automatic compression based on size thresholds
- Expansion detection (falls back to uncompressed if compression increases size)
- Backward compatible (handles both compressed and uncompressed data)
- Performance tracking (compression time, ratio, bytes saved)

**Compression thresholds:**
- Favorites: 2 KB
- Search results: 1 KB
- Documents: 1 KB
- Services: No compression (small data)
- App version: No compression (tiny string)

**CompressionManager utilities:**
- `compress(data)` - Compress string with performance tracking
- `decompress(data)` - Decompress string with error handling
- `isCompressed(data)` - Check if data is compressed
- `shouldCompress(data, threshold)` - Fast size check before compression
- `getCompressionRatio(original, compressed)` - Calculate savings percentage

### 4. Cache Statistics

Real-time monitoring system for cache performance analysis.

**Tracked metrics:**
- Hit rate (cache hits vs misses)
- Operations count (hits, misses, writes, evictions, errors)
- Compression statistics (compressions, decompressions, bytes saved, expansions)
- Storage usage per type (entry count, bytes used, quota)
- Per-cache-type statistics (hits, misses, writes, last accessed)
- Uptime and operation history

**Access methods:**
- Statistics panel UI (Ctrl+Shift+S to toggle)
- `cacheService.getStatistics()` - Programmatic access
- `cacheService.logStatistics()` - Console logging
- `window.__cacheStats()` - Browser console debugging

**UI features:**
- Real-time updates via subscriber pattern
- Color-coded metrics (good/warning/bad)
- Performance section (hit rate, total ops, uptime)
- Operations breakdown (hits, misses, writes, evictions, errors)
- Compression effectiveness (ratio, average time, bytes saved)
- Storage usage bars with percentages
- Top 5 cache types by activity
- Controls: auto-refresh toggle, manual refresh, log to console, reset statistics

### 5. TTL Management

Automatic expiration system for cache entries.

**TTL constants (from config):**
- ONE_HOUR: 3,600,000 ms
- SIX_HOURS: 21,600,000 ms
- TWELVE_HOURS: 43,200,000 ms
- ONE_DAY: 86,400,000 ms
- ONE_WEEK: 604,800,000 ms
- THIRTY_DAYS: 2,592,000,000 ms
- NEVER: undefined

**TTLManager utilities:**
- `wrap(data, ttl, namespace)` - Wrap data with TTL metadata
- `unwrap(entry)` - Unwrap and validate TTL
- `isExpired(expiresAt)` - Check if entry expired

### 6. LRU Eviction

Automatic eviction when storage quota approaches limit (80% threshold).

**LRUManager features:**
- Evicts oldest entries first
- Updates access timestamps on reads
- Configurable eviction count (default: 5 entries)
- Aggressive mode (15 entries) on quota exceeded errors
- Statistics tracking for all evictions

### 7. Cache Versioning

Automatic cache invalidation on app version changes.

**Implementation:**
- App version stored in `src/config/index.ts` (APP_VERSION = '1.0.0')
- Version cached in localStorage (never expires)
- Version check on app startup (Office.onReady)
- Full cache clear on version mismatch
- Prevents false clears on browser restart

### 8. Network Detection

Intelligent cache behavior based on connectivity status.

**Detection logic:**
- Checks `navigator.onLine` (browser connectivity)
- Checks SIP connection status
- Checks authentication state
- Combined status via `selectIsReady` selector

**Behavior:**
- Offline: Use cache immediately, skip API calls
- SIP disconnected: Cache fallback with specific warning
- API failure: Stale cache fallback with user notification
- Different toast messages for different failure reasons

---

## Caching Strategy by Data Type

### Favorites (Persons & Cases)

**Storage:** LocalStorage  
**TTL:** 24 hours  
**Compression:** Yes (threshold: 2 KB)  
**Namespace:** Per-user  
**Update strategy:** Cache-first, background refresh, immediate updates on add/remove

**Behavior:**
1. Check cache on load
2. If cached and not expired, use cached data
3. Background API call to refresh
4. Update cache with fresh data
5. On add/remove: immediately update cache (optimistic updates)

**Size estimate:** 10-50 KB per user (100 favorites)

### Search Results (Persons & Cases)

**Storage:** SessionStorage  
**TTL:** Never (session-only)  
**Compression:** Yes (threshold: 1 KB)  
**Namespace:** None (session-isolated)  
**Update strategy:** Alternating cache/API per query

**Behavior:**
1. Odd queries: Check cache first, API fallback
2. Even queries: API first, cache fallback on failure
3. Empty results not cached
4. Stale cache fallback on any API failure
5. Search counter resets on unmount

**Size estimate:** ~5 KB per search result

### Documents (Case Documents)

**Storage:** LocalStorage  
**TTL:** 1 hour  
**Compression:** Yes (threshold: 1 KB)  
**Namespace:** Per-user  
**Update strategy:** Cache-first with expiration, read-only

**Behavior:**
1. Cache-first on document list load
2. If expired or missing: API call
3. Cache updated after API response
4. LRU eviction (max 5-10 cases cached)
5. Dynamic keys: `documents_{aktId}`

**Size estimate:** 50-200 KB per case

### Services List

**Storage:** SessionStorage  
**TTL:** Never (session-only)  
**Compression:** No (small data)  
**Namespace:** None (global list, session-isolated)  
**Update strategy:** Cache once per session

**Behavior:**
1. Load once on first access
2. Cached for entire session
3. Cleared on Outlook restart
4. No per-user namespace (services are global)

**Size estimate:** < 5 KB

### App Version

**Storage:** LocalStorage  
**TTL:** Never  
**Compression:** No (tiny string)  
**Namespace:** None (global)  
**Update strategy:** Check on startup, clear cache on mismatch

**Behavior:**
1. Read version from localStorage
2. Compare with APP_VERSION constant
3. If mismatch: clear all cache
4. Store new version
5. Only stored in localStorage (not sessionStorage)

---

## File Structure

### Core Cache System

```
src/services/cache/
├── CacheService.ts           # Main orchestrator class
├── index.ts                  # Public exports
├── types.ts                  # TypeScript interfaces
├── config.ts                 # Centralized cache configuration
├── strategies/
│   ├── IStorageStrategy.ts   # Strategy interface
│   ├── LocalStorageStrategy.ts
│   └── SessionStorageStrategy.ts
└── utils/
    ├── TTLManager.ts         # Expiration management
    ├── LRUManager.ts         # Eviction policy
    ├── CompressionManager.ts # LZ-string compression
    └── CacheStatistics.ts    # Real-time statistics tracking
```

### Redux Integration

```
src/store/slices/
├── aktenSlice.ts             # Favorites + search caching
├── personSlice.ts            # Favorites + search caching
├── serviceSlice.ts           # Services list caching
└── connectionSlice.ts        # Connection state (no caching)
```

### UI Components

```
src/taskpane/components/
├── App.tsx                   # Root component
├── Tab.tsx                   # Tab navigation with cache stats toggle
├── shared/
│   ├── CacheStatsPanel.tsx   # Statistics UI component
│   └── CacheStatsPanel.css   # Statistics panel styles
└── tabs/
    ├── case/
    │   └── SearchCaseList.tsx
    ├── person/
    │   └── SearchPersonList.tsx
    ├── service/
    │   └── ServiceTabContent.tsx
    └── shared/
        ├── SearchCaseList.tsx
        └── ServiceSection.tsx
```

### Configuration

```
src/config/
├── index.ts                  # APP_VERSION, ENABLE_CACHE_STATS
├── defaults.ts
├── environment.ts
└── types.ts
```

### Utilities

```
src/utils/
└── errorHelpers.ts           # getErrorMessage() helper
```

### Entry Point

```
src/taskpane/
├── index.tsx                 # App initialization, cache setup
└── taskpane.ts
```

---

## Usage Patterns

### Basic Cache Operations

```typescript
import { cacheService } from '../../services/cache';
import { CACHE_CONFIG, CACHE_KEYS } from '../../services/cache/config';

// Set namespace on login
cacheService.setNamespace(userId);

// Cache data
await cacheService.set(
  CACHE_KEYS.FAVORITES_PERSONS,
  data,
  CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]
);

// Retrieve data
const cached = await cacheService.get<Person[]>(
  CACHE_KEYS.FAVORITES_PERSONS,
  CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]
);

// Clear on logout
await cacheService.clearNamespace(userId);
```

### Redux Integration Pattern

```typescript
export const fetchFavoritePersons = createAsyncThunk(
  'person/fetchFavoritePersons',
  async (_, { getState }) => {
    const state = getState() as RootState;
    const userId = state.auth.userId;

    // Try cache first
    const cached = await cacheService.get<Person[]>(
      CACHE_KEYS.FAVORITES_PERSONS,
      { ...CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS], namespace: userId }
    );

    if (cached) {
      console.log('Using cached data');
      return cached;
    }

    // Fetch from API
    const data = await api.getFavoritePersons();

    // Update cache
    await cacheService.set(
      CACHE_KEYS.FAVORITES_PERSONS,
      data,
      { ...CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS], namespace: userId }
    );

    return data;
  }
);
```

### Immediate Cache Updates (Optimistic)

```typescript
// After adding to favorites
await cacheService.set(
  CACHE_KEYS.FAVORITES_PERSONS,
  updatedFavorites,
  { ...CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS], namespace: userId }
);
```

### Dynamic Cache Keys

```typescript
// Document cache per case
const dokumenteKey = `documents_${aktId}`;
await cacheService.set(
  dokumenteKey,
  documents,
  { ...CACHE_CONFIG[CACHE_KEYS.DOCUMENTS], namespace: userId }
);
```

### Network-Aware Caching

```typescript
const isReady = selectIsReady(state);

if (!isReady) {
  // Use cache immediately
  const cached = await cacheService.get(key, options);
  if (cached) return cached;
  
  // Show appropriate warning
  showToast('warning', 'Using cached data - network unavailable');
  return null;
}

// Proceed with API call
```

---

## Configuration Reference

All cache settings are centralized in `src/services/cache/config.ts`.

**Available cache keys:**
- APP_VERSION
- FAVORITES_PERSONS
- FAVORITES_AKTEN
- DOCUMENTS
- SERVICES
- SEARCH_RESULTS

**Configuration structure:**
```typescript
export const CACHE_CONFIG: Record<string, CacheOptions> = {
  [CACHE_KEYS.FAVORITES_PERSONS]: {
    storage: StorageType.LOCAL,
    ttl: CACHE_TTL.ONE_DAY,
    compress: true,
    compressionThreshold: 2048
  },
  // ... other configs
};
```

**Recommended approach:**
- Always use `CACHE_CONFIG` instead of manual configuration
- Always use `CACHE_KEYS` constants instead of string literals
- This ensures consistency and makes updates easier

---

## Recent Improvements

### Compression System (Feb 6, 2026)

- Implemented LZ-string compression for large cache entries
- Configurable thresholds (2KB for favorites, 1KB for search/documents)
- Automatic expansion detection with fallback
- String length estimation for fast pre-checks
- Actual Blob size calculation for accurate ratios
- Backward compatible with uncompressed data
- Comprehensive logging for all compression operations
- CompressionManager utility with full compression lifecycle

### Cache Statistics (Feb 16, 2026)

- Real-time statistics tracking system
- Subscriber pattern for live updates
- UI panel with visualization (toggleable with Ctrl+Shift+S)
- Performance metrics (hit rate, operations, uptime)
- Compression effectiveness tracking
- Storage usage monitoring with visual bars
- Top cache types by activity
- Console debugging via `window.__cacheStats()`
- Feature flag (ENABLE_CACHE_STATS) for production hiding

### UI Improvements (Feb 16, 2026)

- Moved statistics panel from fixed overlay to tab
- Lazy loading for cache stats panel
- Keyboard shortcut (Ctrl+Shift+S) to toggle
- Tab visibility configurable via feature flag
- Memoized calculations for better performance

### Bug Fixes & Optimizations

**Cache versioning:**
- Fixed false cache clears on restart (localStorage-only storage)
- Proper initialization sequence (inside Office.onReady)

**Search caching:**
- Fixed missing compression configuration
- Consistent use of centralized CACHE_CONFIG

**Compression:**
- Fixed compression ratio calculation
- Optimized Blob creation (reduced from 3 to 1-2 calls)
- Added expansion detection and fallback

**Services cache:**
- Removed redundant username namespace (sessionStorage already isolated)

**Error handling:**
- Type-safe error handling with `catch (error: unknown)`
- `getErrorMessage()` helper for consistent error messages
- Corrupted cache entry cleanup on parse errors
- Decompression failure handling

**Storage updates:**
- Storage statistics updated after evictions, writes, removals, clears
- Added `getEntryCount()` helper for accurate counting
- Fixed namespace filtering in entry count

**Performance:**
- Lazy loading for CacheStatsPanel
- Memoized expensive calculations in UI
- Fast string length estimation for compression checks

---

## Implementation Status

**Fully implemented and active:**
- CacheService with strategy pattern
- LocalStorage and SessionStorage strategies
- Compression with LZ-string
- TTL management and auto-expiration
- LRU eviction with quota handling
- Cache versioning on app updates
- Network detection and offline support
- Real-time statistics tracking
- Statistics UI panel with visualization
- Namespace isolation per user
- Selective cache clearing
- Error handling and recovery
- Integration with all Redux slices (akten, person, service)
- Integration with all UI tabs (Email, Service, Case, Person, Cache)

**Tested and verified:**
- Compression/decompression with expansion detection
- TTL expiration and auto-cleanup
- LRU eviction on quota threshold
- Cache clearing on logout
- Version change detection and cache invalidation
- Network offline fallback
- Statistics accuracy and real-time updates
- Keyboard shortcut toggle (Ctrl+Shift+S)
- Feature flag for production hiding

**Performance metrics:**
- Cache hit rate: Tracked in real-time
- Compression effectiveness: 40-70% size reduction on large datasets
- Compression time: < 5ms average for typical data
- Storage usage: Monitored with visual indicators
- Memory usage: Minimal overhead with lazy loading

---

## Related Documentation

- **[CACHE_QUICK_REFERENCE.md](./CACHE_QUICK_REFERENCE.md)** - Developer guide for using the cache system
- **[CACHE_STRATEGY_PROPOSAL.md](./CACHE_STRATEGY_PROPOSAL.md)** - Available cache options and recommendations
- **[CacheFeatures.md](./CacheFeatures.md)** - Feature checklist and implementation status
- **[FAVORITE_PERSONS_CACHE_IMPLEMENTATION.md](./FAVORITE_PERSONS_CACHE_IMPLEMENTATION.md)** - Original favorites cache plan

---

**Last Review:** February 16, 2026  
**Implementation Status:** Complete and active in production
