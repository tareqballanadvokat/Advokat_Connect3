# Cache Service - Quick Reference for Developers

> **Complete guide for implementing and working with the cache system**

---

## 📚 Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration](#configuration)
3. [Usage Examples](#usage-examples)
4. [Compression](#compression)
5. [Cache Statistics & Monitoring](#cache-statistics--monitoring)
6. [Storage Management](#storage-management)
7. [Console Debugging](#console-debugging)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Import and Basic Setup

```typescript
import { cacheService } from '../../services/cache';
import { CACHE_CONFIG, CACHE_KEYS } from '../../services/cache/config';

// Set user namespace (on login)
cacheService.setNamespace(userId);

// centralized config
await cacheService.set(CACHE_KEYS.FAVORITES_PERSONS, data, CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]);

// Get cached data
const data = await cacheService.get<Person[]>(CACHE_KEYS.FAVORITES_PERSONS, CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]);
```

---

## Configuration

### Centralized Config (`src/services/cache/config.ts`)

**Always use `CACHE_CONFIG` instead of manual options:**

```typescript
// ✅ CORRECT - Uses centralized config
await cacheService.set(
  CACHE_KEYS.FAVORITES_PERSONS, 
  data, 
  CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]
);

// ❌ WRONG - Manual config (inconsistency risk)
await cacheService.set('favorites_persons', data, {
  storage: StorageType.LOCAL,
  ttl: 86400000
});
```

### Available Cache Keys

| Key | Storage | TTL | Compression | Threshold |
|-----|---------|-----|-------------|-----------|
| `APP_VERSION` | LOCAL | Never | No | - |
| `FAVORITES_PERSONS` | LOCAL | 1 day | Yes | 2KB |
| `FAVORITES_AKTEN` | LOCAL | 1 day | Yes | 2KB |
| `DOCUMENTS` | LOCAL | 1 hour | Yes | 1KB |
| `SERVICES` | SESSION | Never | No | - |
| `SEARCH_RESULTS` | SESSION | Never | Yes | 1KB |

### TTL Constants

```typescript
import { CACHE_TTL } from '../../services/cache/config';

CACHE_TTL.ONE_HOUR      // 3,600,000 ms
CACHE_TTL.SIX_HOURS     // 21,600,000 ms
CACHE_TTL.TWELVE_HOURS  // 43,200,000 ms
CACHE_TTL.ONE_DAY       // 86,400,000 ms
CACHE_TTL.ONE_WEEK      // 604,800,000 ms
CACHE_TTL.THIRTY_DAYS   // 2,592,000,000 ms
CACHE_TTL.NEVER         // undefined
```

---

## Usage Examples

### 1. Basic Operations

```typescript
// Set with namespace
await cacheService.set(CACHE_KEYS.FAVORITES_PERSONS, persons, CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]);

// Get
const persons = await cacheService.get<Person[]>(
  CACHE_KEYS.FAVORITES_PERSONS,
  CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]
);

// Remove specific key
await cacheService.remove(CACHE_KEYS.FAVORITES_PERSONS, CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]);
```

### 2. Namespace Management

```typescript
// Set namespace (typically on login)
cacheService.setNamespace(userId);

// Clear all cache for user (on logout)
const cleared = await cacheService.clearNamespace(userId);
console.log(`Cleared ${cleared} entries`);

// Clear namespace for specific storage
await cacheService.clearNamespace(userId, StorageType.LOCAL);
```

### 3. Cache Type Operations

```typescript
// Clear search cache
await cacheService.clearSearchCache(userId);

// Clear favorites
await cacheService.clearFavoritesCache(userId);

// Clear specific documents
await cacheService.clearDocumentsCache(userId, aktId);

// Clear ALL documents
await cacheService.clearAllDocuments(userId);

// Clear services
await cacheService.clearServicesCache(userId);
```

### 4. Dynamic Document Keys

```typescript
// Documents for specific Akt
const dokumenteKey = `documents_${aktId}`;
await cacheService.set(dokumenteKey, documents, {
  ...CACHE_CONFIG[CACHE_KEYS.DOCUMENTS],
  namespace: userId
});
```

### 5. Redux Integration Pattern

```typescript
// In your slice
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
      console.log('📦 [personSlice] Using cached data');
      return cached;
    }
    
    // Fetch from API
    const data = await api.getFavoritePersons();
    
    // Cache result
    await cacheService.set(
      CACHE_KEYS.FAVORITES_PERSONS,
      data,
      { ...CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS], namespace: userId }
    );
    
    return data;
  }
);
```

---

## Compression

### How It Works

- **Library**: `lz-string` (LZString compression)
- **Marker**: Compressed data prefixed with `__LZ__`
- **Automatic**: Compression/decompression handled automatically
- **Threshold**: Only data > threshold gets compressed

### Compression Logic

```typescript
// Automatic compression if enabled
if (options.compress && dataSize > options.compressionThreshold) {
  // Compresses automatically
  // Falls back to original if compression expands data
}

// Automatic decompression on read
if (data.startsWith('__LZ__')) {
  // Decompresses automatically
}
```

### Monitoring Compression

```typescript
// Check compression stats
const stats = cacheService.getStatistics();
console.log('Compressions:', stats.compression.compressions);
console.log('Bytes saved:', stats.compression.bytesBeforeCompression - stats.compression.bytesAfterCompression);
console.log('Expansions:', stats.compression.expansions); // Times compression made data larger
```

### Adding Compression to New Cache Type

```typescript
// In config.ts
export const CACHE_CONFIG = {
  MY_NEW_CACHE: {
    storage: StorageType.LOCAL,
    ttl: CACHE_TTL.ONE_DAY,
    compress: true,              // Enable compression
    compressionThreshold: 2048   // Compress if > 2KB
  }
};
```

---

## Cache Statistics & Monitoring

### Enable Statistics Panel

**Development**: Automatically enabled (`ENABLE_CACHE_STATS = true`)  
**Production**: Hidden by default, toggle with **Ctrl+Shift+S**

### Features

- **Real-time metrics**: Hit rate, operations, compression stats
- **Storage usage**: Per-storage visual bars with percentages
- **Top cache types**: Most accessed cache keys with hit rates
- **Controls**: Auto-refresh, manual refresh, log to console, reset stats

### Access Statistics Programmatically

```typescript
// Get current stats
const stats = cacheService.getStatistics();

// Log summary to console
cacheService.logStatistics();

// Via global (debugging)
window.__cacheStats(); // Available in browser console
```

### Statistics Interface

```typescript
interface CacheStats {
  operations: {
    hits: number;
    misses: number;
    writes: number;
    evictions: number;
    errors: number;
  };
  compression: {
    compressions: number;
    decompressions: number;
    bytesBeforeCompression: number;
    bytesAfterCompression: number;
    totalCompressionTime: number;
    expansions: number;
  };
  storage: {
    [storageType: string]: {
      entryCount: number;
      bytesUsed: number;
      bytesQuota: number;
    };
  };
  perType: {
    [cacheKey: string]: {
      hits: number;
      misses: number;
      writes: number;
      lastAccessed: number | null;
      lastUpdated: number | null;
    };
  };
  startTime: number;
  lastResetTime: number;
}
```

---

## Storage Management

### Storage Strategies

| Strategy | Type | Persistence | Quota | Use Case |
|----------|------|-------------|-------|----------|
| `LocalStorageStrategy` | LOCAL | Permanent | ~5-10MB | User preferences, favorites |
| `SessionStorageStrategy` | SESSION | Session only | ~5-10MB | Search results, temporary data |

### Eviction Policy

**Automatic eviction when storage > 80% quota:**

1. **LRU (Least Recently Used)**: Removes 5 oldest entries
2. **Aggressive mode**: If quota still exceeded, removes 15 entries
3. **Statistics updated**: After every eviction

### Manual Storage Check

```typescript
// Get storage usage
const usage = await cacheService.getUsage(StorageType.LOCAL);
console.log(`Used: ${usage.used}B / Quota: ${usage.quota}B`);
console.log(`Percentage: ${(usage.used / usage.quota * 100).toFixed(1)}%`);
```

---

## Console Debugging

### Log Patterns

**Cache Hit:**
```
✅ [CacheService] Cache hit: user123:favorites_persons
```

**Cache Miss:**
```
❌ [CacheService] Cache miss: user123:search_results
```

**Cache Write:**
```
✅ [CacheService] Cached user123:favorites_persons in LOCAL (12543 bytes)
```

**Compression:**
```
🗜️ [CacheService] Compressed user123:favorites_persons: 12543B → 3421B (72.7% saved)
```

**Compression Expansion (fallback):**
```
⚠️ [CacheService] Compression expanded data for user123:app_version, using original
```

**Eviction:**
```
⚠️ [CacheService] Storage LOCAL needs 15000 bytes, evicting entries
```

**Cache Expired:**
```
⏰ [CacheService] Cache expired: user123:documents_45
```

**Decompression:**
```
🔄 [CacheService] Detected compressed data for user123:search_results, decompressing...
```

**Cache Cleared:**
```
🗑️ [CacheService] Cleared 5 entries for namespace user123
```

### Browser Console Access

```javascript
// Global debugging helper
window.__cacheStats(); // Logs full statistics summary

// Manual operations (for testing)
// Available via cacheService import in browser DevTools
```

---

## Testing

### Test Cache in Redux Slice

```typescript
import { cacheService } from '../../services/cache';

describe('personSlice with cache', () => {
  beforeEach(() => {
    // Clear cache before each test
    cacheService.clearAll();
  });

  it('should use cached data on second fetch', async () => {
    // First fetch - cache miss
    const result1 = await store.dispatch(fetchFavoritePersons());
    expect(cacheService.getStatistics().operations.misses).toBe(1);
    
    // Second fetch - cache hit
    const result2 = await store.dispatch(fetchFavoritePersons());
    expect(cacheService.getStatistics().operations.hits).toBe(1);
    expect(result1.payload).toEqual(result2.payload);
  });
});
```

### Mock Cache in Tests

```typescript
jest.mock('../../services/cache', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    setNamespace: jest.fn(),
    clearNamespace: jest.fn()
  }
}));
```

---

## Troubleshooting

### Common Issues

**1. Cache not working / always returning null**
```typescript
// ✅ Check namespace is set
cacheService.setNamespace(userId);

// ✅ Check correct storage type
const options = CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]; // Use centralized config
```

**2. Data not persisting after refresh**
```typescript
// ✅ Ensure using LOCAL storage (not SESSION)
storage: StorageType.LOCAL // Persists across sessions
storage: StorageType.SESSION // Cleared on refresh/restart
```

**3. Compression failures**
```typescript
// Check console for expansion warnings
// If data compresses poorly, increase threshold:
compressionThreshold: 4096 // Only compress if > 4KB
```

**4. Quota exceeded errors**
```typescript
// Check storage usage
const usage = await cacheService.getUsage(StorageType.LOCAL);
if (usage.used / usage.quota > 0.9) {
  // Clear old cache
  await cacheService.clearNamespace(userId);
}
```

**5. Statistics not updating**
```typescript
// ✅ Ensure ENABLE_CACHE_STATS is true (dev mode)
// ✅ In production, press Ctrl+Shift+S to enable
```

**6. Stale data showing**
```typescript
// ✅ Check TTL configuration
ttl: CACHE_TTL.ONE_HOUR // Data expires after 1 hour

// ✅ Force clear if needed
await cacheService.clearCacheType(CACHE_KEYS.FAVORITES_PERSONS, { namespace: userId });
```

### Debug Checklist

- [ ] Namespace set via `setNamespace(userId)`
- [ ] Using `CACHE_CONFIG` from centralized config
- [ ] Correct `CACHE_KEYS` constant used
- [ ] Storage type matches persistence needs
- [ ] TTL appropriate for data staleness tolerance
- [ ] Compression threshold suits data size
- [ ] Check console logs for errors/warnings
- [ ] Verify statistics via `window.__cacheStats()`

---

## Storage Key Format

**Pattern:** `advokat_connect_[namespace]:[key]`

**Examples:**
- `advokat_connect_user123:favorites_persons`
- `advokat_connect_user123:favorites_akten`
- `advokat_connect_user123:documents_45`
- `advokat_connect_user123:search_results`
- `advokat_connect_app_version` (no namespace)

---

## Cache Entry Structure

**Uncompressed:**
```json
{
  "data": [...],
  "timestamp": 1737292800000,
  "expiresAt": 1737379200000,
  "namespace": "user123"
}
```

**Compressed (in storage):**
```
"__LZ__[compressed-base64-string]"
```

---

## Best Practices

1. ✅ **Always use centralized `CACHE_CONFIG`**
2. ✅ **Set namespace on login, clear on logout**
3. ✅ **Use compression for large datasets (> 1-2KB)**
4. ✅ **Monitor statistics during development**
5. ✅ **Set appropriate TTL based on data staleness**
6. ✅ **Handle null returns gracefully (cache miss/expired)**
7. ✅ **Use SESSION storage for temporary data**
8. ✅ **Use LOCAL storage for persistent data**
9. ✅ **Test cache behavior in unit tests**
10. ✅ **Check console logs for warnings/errors**

---

## Quick Reference Links

- **Implementation**: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **Features**: [CacheFeatures.md](./CacheFeatures.md)
- **Strategy Proposal**: [CACHE_STRATEGY_PROPOSAL.md](./CACHE_STRATEGY_PROPOSAL.md)
- **Favorites Cache**: [FAVORITE_PERSONS_CACHE_IMPLEMENTATION.md](./FAVORITE_PERSONS_CACHE_IMPLEMENTATION.md)
