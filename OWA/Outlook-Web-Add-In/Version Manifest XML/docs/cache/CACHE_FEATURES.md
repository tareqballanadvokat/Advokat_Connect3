## **Must-Have Cache Features**

1. ✅ **Cache Invalidation on Mutations** - Clear/update cache when adding to favorites, creating cases, updating persons. **IMPLEMENTED**

2. ✅ **Network Detection** - Check `navigator.onLine` + SIP connection before API calls. If offline/disconnected, skip API and use cache immediately with specific warning. **IMPLEMENTED**

3. ✅ **Selective Cache Clear** - Method to clear specific cache types (`clearSearchCache()`, `clearFavoritesCache()`, `clearDocumentsCache()`, `clearServicesCache()`, `clearAllDocuments()`). **IMPLEMENTED**

~~4. **Cache Size Limits per Namespace** - Not needed (single user per computer, global 5MB limits sufficient)~~

---

## **Nice-to-Have Cache Features**

**Cache Middleware**
**Cache Operation Queue**: to prevent race condition 
1. **Cache Preloading** - Load favorites on login/app start in background

2. **Background Cache Refresh** - Silently refresh expired cache without blocking UI

3. **IndexedDB Strategy** - For larger storage (50MB+ vs 5MB localStorage)

4. ✅ **Cache Statistics** - Hit rate, size, age tracking for monitoring/debugging. **IMPLEMENTED**

5. **Optimistic Updates** - Update cache immediately on mutation, sync in background

6. **Partial Cache Updates** - Update single items in cached arrays instead of replacing entire cache

7. ✅ **Cache Compression** - LZ-string compression for large datasets. **IMPLEMENTED**

---

**Priority recommendation:** Implement #1 (invalidation) and #2 (network detection) first - they directly impact data consistency and UX.