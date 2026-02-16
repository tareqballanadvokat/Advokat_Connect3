# Cache Options & Strategy Reference

**Last Updated:** February 16, 2026  
**Purpose:** Quick reference for available cache options and their appropriate use cases

---

## Overview

This document outlines the caching options available for our Outlook Add-in and provides guidance on which option to use for different types of data. The goal is to improve performance while maintaining security and staying within platform limitations.

---

## Available Cache Options

### 1. LocalStorage

**Characteristics:**
- Browser Web Storage API (string-based key-value)
- Size limit: 5-10 MB (browser dependent)
- Synchronous operations
- Persists across sessions until manually cleared
- Not encrypted by default
- Available on desktop and web clients
- Shared across all Office Add-ins from the same domain

**Recommended for:**
- Non-sensitive user preferences
- Favorite lists (cases, persons)
- Document metadata cache
- Search history
- UI state preferences

**Not recommended for:**
- Authentication tokens
- User credentials
- Highly sensitive data without encryption

**Implementation notes:**
- String-based storage requires JSON serialization
- Synchronous API can block UI if overused
- Survives browser/app restarts

---

### 2. SessionStorage

**Characteristics:**
- Browser Web Storage API (string-based key-value)
- Size limit: 5-10 MB (browser dependent)
- Synchronous operations
- Cleared when taskpane closes
- Not encrypted by default
- Available on desktop and web clients
- Isolated per session

**Recommended for:**
- Temporary session data
- Current search results
- Active connection state
- Short-lived cached API responses
- Data that should not persist after logout

**Not recommended for:**
- Data that needs to survive page reloads
- Long-term storage
- User preferences that should persist

**Implementation notes:**
- Ideal for temporary data during active session
- Automatically cleared when taskpane is closed
- Same 5MB limit as localStorage

---

### 3. IndexedDB

**Characteristics:**
- Browser Database API (object-based with indexing)
- Size limit: 50 MB+ (can request more)
- Asynchronous operations
- Persists across sessions
- Not encrypted by default
- Available on desktop and web clients
- Supports transactions and complex queries

**Recommended for:**
- Large datasets requiring structured queries
- Offline data synchronization
- Complex relational data
- Document search indices

**Not recommended for:**
- Simple key-value storage (localStorage is simpler)
- Very small amounts of data
- Scenarios requiring synchronous access

**Implementation notes:**
- More complex API than localStorage
- Asynchronous (non-blocking) operations
- Best for structured data with query requirements
- Currently not used in our implementation (localStorage sufficient for current needs)

---

### 4. Office.context.roamingSettings

**Characteristics:**
- Office Add-in Settings API
- Size limit: 32 KB total (strict)
- Asynchronous operations (requires saveAsync)
- Automatically encrypted by Office platform
- Syncs across all devices with user's mailbox
- Available on all Outlook clients (desktop, web, mobile)

**Recommended for:**
- Critical user preferences that should sync
- Theme and language settings
- Small configuration options
- Cross-device user preferences

**Not recommended for:**
- Large data (strict 32 KB limit)
- Frequently changing data
- Authentication tokens (use memory instead)

**Implementation notes:**
- Automatically encrypted and synced by Office
- Must call saveAsync() to persist changes
- Ideal for settings that should follow the user across devices
- Very limited size makes it unsuitable for most cache scenarios

---

### 5. Memory (Redux Store)

**Characteristics:**
- In-memory JavaScript state
- No size limit (limited by available RAM)
- Synchronous access
- Cleared on page refresh/reload
- Not persisted
- Fastest access speed

**Recommended for:**
- Authentication tokens (access tokens, refresh tokens)
- Active session state
- UI state (current tab, selections)
- WebRTC connection state
- Frequently accessed data

**Not recommended for:**
- Data that needs to survive page reloads
- Long-term storage
- Large datasets that could cause memory issues

**Implementation notes:**
- Currently used for authentication state
- Fastest access but no persistence
- Cleared automatically on refresh

---

## Data Classification & Storage Recommendations

### Authentication Data

**Access Tokens:**
- Storage: Memory only (Redux)
- Reason: Short-lived, highly sensitive
- TTL: Match API expires_in value
- Encryption: Not needed (never persisted)

**Refresh Tokens:**
- Storage: Memory (recommended) or encrypted localStorage (optional)
- Reason: Long-lived, very sensitive
- TTL: Match API refresh_token_lifetime
- Encryption: Required if persisted (AES-GCM)
- Note: Persistence is optional - provides convenience but requires careful security implementation

**User Credentials:**
- Storage: Never cache
- Reason: Extreme security risk

**Authentication State:**
- Storage: SessionStorage
- Data: isAuthenticated flag, user identity (non-sensitive)
- TTL: Session lifetime
- Size: < 1 KB

---

### User Preferences

**UI Preferences:**
- Storage: LocalStorage (or Office.context.roamingSettings for cross-device sync)
- Data: Last active tab, theme, display settings, language
- TTL: Indefinite (user-controlled)
- Size: < 5 KB
- Note: RoamingSettings provides cross-device sync but limited to 32 KB

**Search History:**
- Storage: LocalStorage
- Data: Recent search terms (last 20-50)
- TTL: 30 days
- Size: < 10 KB
- Encryption: Not required (non-sensitive)

---

### Favorites (Cases & Persons)

**Favorites Lists:**
- Storage: LocalStorage
- Data: Akten favorites, Person favorites
- TTL: 24 hours (revalidate on app start)
- Size: 10-50 KB (100 favorites × ~0.5 KB each)
- Compression: Enabled (threshold: 2 KB)
- Update strategy: Immediate cache update when adding/removing favorites
- Note: Background refresh on app start, optimistic updates for add/remove operations

---

### Document Cache

**Document Metadata:**
- Storage: LocalStorage
- Data: Document lists per case
- TTL: 1 hour per case
- Size: 50-200 KB per case
- Max cached: 5-10 cases
- Eviction: LRU (Least Recently Used)
- Compression: Enabled (threshold: 1 KB)
- Update strategy: Read-only cache (loaded from API, no immediate updates)

---

### Search Results

**Search Cache:**
- Storage: SessionStorage
- Data: Recent search results
- TTL: Session lifetime
- Size: 5 KB
- Compression: Enabled (threshold: 1 KB)
- Note: Temporary data, cleared when taskpane closes

---

### Configuration Data

**Environment Configuration:**
- Storage: SessionStorage
- Data: SIP config, API URLs, timeouts
- TTL: Session lifetime
- Size: < 5 KB

---

## Storage Limits & Quotas

### Platform Limits

**Add-in Package Size:**
- Maximum: 500 MB (AppSource limit)
- Recommended: < 50 MB
- Current size: ~5-10 MB (estimated)

**Runtime Memory:**
- Desktop Outlook: ~1-2 GB (shared with browser)
- Outlook Web: ~500 MB - 1 GB (browser tab limit)
- Mobile: ~100-300 MB (more restrictive)

**Storage API Limits:**
- localStorage: ~5-10 MB
- sessionStorage: ~5-10 MB
- IndexedDB: 50+ MB (can request more)
- Office.context.roamingSettings: 32 KB (strict)

### Recommended Cache Budget

**Total Cache Target:** < 25 MB  
**Maximum Cache:** < 50 MB

**Distribution:**
- Favorites (cases + persons): 5 MB
- Document cache: 10 MB
- Search indices: 5 MB
- Preferences: 1 MB
- Reserve: 4 MB

---

## Security Considerations

### Sensitive Data Guidelines

**High Risk Data:**
- Access tokens: Keep in memory only
- Refresh tokens: Memory preferred, encrypted localStorage optional
- User credentials: Never store

**Encryption Requirements:**
- Algorithm: AES-GCM (via Web Crypto API)
- Key length: 256 bits
- IV: 12 bytes (96 bits)
- Key storage: Memory only (non-extractable)
- Use case: Only for sensitive persisted data (e.g., optional refresh token caching)

### XSS Protection

LocalStorage and sessionStorage are accessible via JavaScript, making them vulnerable to XSS attacks.

**Mitigations:**
- Use Content Security Policy (CSP) in manifest
- Sanitize all user inputs
- Avoid eval() and innerHTML with untrusted data
- Use React's built-in XSS protection
- Encrypt sensitive cached data

### Data Privacy (GDPR)

**Requirements:**
- Document what data is cached
- Provide cache clear functionality
- Minimize cached personal data
- Implement data retention policies
- Clear cache on logout

**Mitigations:**
- Namespace cache per user
- Clear sensitive cache on logout
- Implement cache versioning
- Monitor and enforce size limits

---

## Implementation Guidance

### Cache Service Architecture

The CacheService provides a unified interface for all cache operations:

**Features:**
- Unified API for all storage types
- Automatic compression for large data
- TTL management with automatic expiration
- Size monitoring and enforcement
- Namespace isolation per user
- LRU eviction for document cache
- Real-time statistics tracking

**Cache Layers:**

1. **Memory (Redux)** - Authentication state, active session data
2. **SessionStorage** - Search results, temporary preferences
3. **LocalStorage** - Favorites, document cache, long-term preferences
4. **RoamingSettings** - Cross-device preferences (future consideration)

### Usage Pattern

```typescript
import { cacheService } from '../../services/cache';
import { CACHE_CONFIG, CACHE_KEYS } from '../../services/cache/config';

// Set namespace on login
cacheService.setNamespace(userId);

// Cache data using centralized config
await cacheService.set(
  CACHE_KEYS.FAVORITES_PERSONS, 
  data, 
  CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]
);

// Retrieve cached data
const cached = await cacheService.get<Person[]>(
  CACHE_KEYS.FAVORITES_PERSONS,
  CACHE_CONFIG[CACHE_KEYS.FAVORITES_PERSONS]
);

// Clear on logout
await cacheService.clearNamespace(userId);
```

### Cache Configuration

All cache settings are centralized in `src/services/cache/config.ts`:

| Cache Type | Storage | TTL | Compression | Threshold |
|------------|---------|-----|-------------|-----------|
| APP_VERSION | LOCAL | Never | No | - |
| FAVORITES_PERSONS | LOCAL | 1 day | Yes | 2 KB |
| FAVORITES_AKTEN | LOCAL | 1 day | Yes | 2 KB |
| DOCUMENTS | LOCAL | 1 hour | Yes | 1 KB |
| SERVICES | SESSION | Never | No | - |
| SEARCH_RESULTS | SESSION | Never | Yes | 1 KB |

### Update Strategies

**Immediate Updates (Optimistic):**
- Favorites (cases and persons)
- User preferences
- Search history
- Strategy: Update cache immediately after add/remove operations

**Read-Only Cache:**
- Document metadata
- Configuration data
- Strategy: Cache loaded from API, no immediate updates needed

**Session-Only:**
- Search results
- Connection state
- Strategy: Cleared when taskpane closes

---

## Monitoring & Debugging

### Statistics Panel

**Access:** Press Ctrl+Shift+S to toggle (available in development, hidden in production by default)

**Metrics:**
- Cache hit rate
- Total operations (hits, misses, writes, evictions)
- Compression statistics (ratio, time, expansions)
- Storage usage per type
- Top cache types by access

### Console Debugging

Available via `window.__cacheStats()` in browser console for detailed statistics.

---

## Summary

**Recommended Approach:**
1. Use **LocalStorage** for favorites, documents, and persistent preferences (with compression)
2. Use **SessionStorage** for temporary data and search results
3. Use **Memory (Redux)** for authentication tokens and active session state
4. Consider **RoamingSettings** for cross-device preferences (future enhancement)

**Security Principles:**
- Never cache user credentials
- Keep tokens in memory when possible
- Encrypt sensitive data if persistence is required
- Clear cache on logout
- Implement appropriate TTLs

**Size Management:**
- Target < 25 MB total cache
- Use compression for data > 1-2 KB
- Implement LRU eviction for document cache
- Monitor storage quotas
- Graceful degradation on quota errors

---

## References

- [Office Add-ins platform overview](https://learn.microsoft.com/en-us/office/dev/add-ins/overview/office-add-ins)
- [Office.context.roamingSettings API](https://learn.microsoft.com/en-us/javascript/api/outlook/office.roamingsettings)
- [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Web Crypto API](https://developer.mozilla.org/en-us/docs/Web/API/Web_Crypto_API)

---

**Status:** Active implementation - refer to [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for current progress