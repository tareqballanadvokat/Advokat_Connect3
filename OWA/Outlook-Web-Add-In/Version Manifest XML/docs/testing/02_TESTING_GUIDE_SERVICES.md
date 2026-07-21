# Unit Testing Guide — Services

> Part of the overall [Testing Strategy](./00_TESTING_STRATEGY.md).  
> Covers `src/services/` — business logic classes that sit between Redux and the
> Office / WebRTC / network boundaries.

---

## Scope

| File | Status |
|---|---|
| `OfficeAuthService.ts` | ✅ 22 tests — `extractOid`, `extractEmail`, `getOfficeToken` success + failure paths |
| `TokenService.ts` | ✅ 17 tests — cached token, refresh, expiry boundary, no Office token, API failure, concurrency |
| `IdleActivityMonitor.ts` | ❌ not yet implemented |
| `PairingApiService.ts` | ❌ not yet implemented |
| `WebRTCDataChannelService.ts` | ❌ not yet implemented |
| `WebRTCConnectionManager.ts` | ❌ not yet implemented |

---

## Infrastructure Requirements

All infrastructure is already installed. The items below are one-time additions
needed before writing service tests.

### 1. Global `OfficeRuntime` mock

`OfficeAuthService` calls `OfficeRuntime.auth.getAccessToken()`.  
✅ Already added to `src/setupTests.ts`:

```typescript
global.OfficeRuntime = {
  auth: {
    getAccessToken: jest.fn(),
  },
} as any;
```

### 2. WebRTC global stubs

`WebRTCConnectionManager` and `WebRTCDataChannelService` use browser WebRTC APIs.  
Add to `src/setupTests.ts` if not already present:

```typescript
global.RTCPeerConnection = jest.fn().mockImplementation(() => ({
  createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: '' }),
  createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: '' }),
  setLocalDescription: jest.fn().mockResolvedValue(undefined),
  setRemoteDescription: jest.fn().mockResolvedValue(undefined),
  createDataChannel: jest.fn().mockReturnValue({ send: jest.fn(), close: jest.fn() }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  close: jest.fn(),
}));

global.RTCDataChannel = jest.fn();
```

### 3. Fake timers

`TokenService` and `IdleActivityMonitor` use `setTimeout`/`setInterval`.  
Call `jest.useFakeTimers()` inside `beforeEach` in those test files and
`jest.useRealTimers()` in `afterEach`.

---

## Test File Locations

```
src/services/__tests__/
├── OfficeAuthService.test.ts   ← ✅ done
├── TokenService.test.ts        ← ✅ done
├── IdleActivityMonitor.test.ts
├── PairingApiService.test.ts
├── WebRTCDataChannelService.test.ts
└── WebRTCConnectionManager.test.ts
```

---

## Service-by-Service Guide

---

### `OfficeAuthService` — Complexity: Low ✅ Done

**Test file:** `src/services/__tests__/OfficeAuthService.test.ts` (22 tests)

**Key mocking pattern:** spy on `store.dispatch`, use global `OfficeRuntime.auth.getAccessToken` mock from `setupTests.ts`.

**What to test:**

| Method | Scenario |
|---|---|
| `extractOid(token)` | Valid JWT with `oid` claim → returns oid string |
| `extractOid(token)` | Malformed token → returns `null` |
| `extractEmail(token)` | Valid JWT with `preferred_username` → returns email |
| `extractEmail(token)` | Missing claim → returns `null` |
| `getAccessToken()` | Calls `OfficeRuntime.auth.getAccessToken`, stores token in Redux |
| `getAccessToken()` | `OfficeRuntime` throws → logs error, dispatches `clearOfficeToken` |

**Example:**

```typescript
import { OfficeAuthService } from '@services/OfficeAuthService';

const buildJwt = (payload: object) =>
  'header.' + btoa(JSON.stringify(payload)) + '.sig';

describe('OfficeAuthService', () => {
  let service: OfficeAuthService;

  beforeEach(() => {
    service = new OfficeAuthService();
    jest.clearAllMocks();
  });

  it('should extract oid from a valid token', () => {
    const token = buildJwt({ oid: 'user-oid-123' });
    expect(service.extractOid(token)).toBe('user-oid-123');
  });

  it('should return null for a malformed token', () => {
    expect(service.extractOid('not.a.jwt')).toBeNull();
  });
});
```

---

### `TokenService` — Complexity: Medium ✅ Done

**Test file:** `src/services/__tests__/TokenService.test.ts` (17 tests)

**Key mocking pattern:** fully mock `@store` at module level (`jest.mock("@store", ...)`) so `mockGetState` and `mockDispatch` are plain jest.fn() — avoids spy-restoration race conditions between tests. Mock `@services/PairingApiService` to intercept the dynamic `await import()` in `_refresh()`.

**What to test:**

| Scenario | Assertion |
|---|---|
| Valid non-expiring token in store | Returns token immediately, no HTTP call |
| Token missing from store | Triggers refresh via `OfficeRuntime` token exchange |
| Token within `EXPIRY_BUFFER_MS` | Triggers proactive refresh |
| Two concurrent calls during refresh | Only one HTTP request made (shared promise) |
| Refresh fails | Returns `null` |

**Key mocking pattern:**

```typescript
import { store } from '@store';

jest.spyOn(store, 'getState').mockReturnValue({
  auth: {
    token: 'valid-token',
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 min from now
    officeToken: 'office-token',
  },
} as any);
```

Use `jest.useFakeTimers()` to control `Date.now()` for expiry boundary tests.

---

### `IdleActivityMonitor` — Complexity: Medium

**What to test:**

| Scenario | Assertion |
|---|---|
| `start()` attaches DOM event listeners | `addEventListener` called for each activity event |
| `stop()` removes all listeners | `removeEventListener` called for each event |
| No activity for `idleTimeout` ms | `onIdle` callback fired |
| Activity event received while idle | `onActive` callback fired, timer resets |
| Activity throttled within `throttleInterval` | `onIdle` timer not reset on rapid events |

**Key pattern:**

```typescript
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

it('should fire onIdle after timeout', () => {
  const onIdle = jest.fn();
  const monitor = new IdleActivityMonitor({ idleTimeout: 5000, onIdle, onActive: jest.fn() });
  monitor.start();

  jest.advanceTimersByTime(5001);

  expect(onIdle).toHaveBeenCalledTimes(1);
});
```

---

### `PairingApiService` — Complexity: Low

**What to test:**

| Scenario | Assertion |
|---|---|
| Successful pairing request | Returns expected response body |
| HTTP 4xx response | Throws or returns error state |
| Network failure | Error propagated correctly |

Mock `fetch` via `jest.spyOn(global, 'fetch')` or use the `mockFetch` helper
from the existing `testSetup.ts`.

---

### `WebRTCDataChannelService` — Complexity: Medium

**What to test:**

| Scenario | Assertion |
|---|---|
| `subscribe(observer)` registers observer | Observer receives subsequent events |
| `unsubscribe(observer)` removes observer | Observer does not receive events after removal |
| `setOfferChannel(channel)` + `sendMessage()` | Message sent on the offer channel |
| `setAnswerChannel(channel)` receives message | `onDataChannelMessage` fired on all subscribers |
| Channel state change | `onDataChannelStateChanged` fired with correct state and type |
| Channel error | `onDataChannelError` fired on all subscribers |

---

### `WebRTCConnectionManager` — Complexity: High

**What to test:**

| Scenario | Assertion |
|---|---|
| `connect()` initialises `SipClient` | `initializeSipClient` called with correct config |
| SipClient transitions to `CONNECTED` | Redux `sipClientStateChanged` dispatched |
| SipClient transitions to `FAILED` | Reconnect logic triggered after delay |
| SipClient transitions to `DISCONNECTED` | No reconnect attempted |
| `disconnect()` tears down SipClient | `SipClient.destroy()` called, Redux state reset |
| Idle timeout fires | `WebRTCConnectionManager` calls `disconnect()` |

Mock `initializeSipClient` to return a fake `SipClientInstance` whose observer
callbacks you can trigger manually.

```typescript
jest.mock('@infra/sip/SipClient', () => ({
  initializeSipClient: jest.fn(),
  SipClientState: { DISCONNECTED: 'DISCONNECTED', CONNECTED: 'CONNECTED', FAILED: 'FAILED' },
}));
```

---

## Running Service Tests

```bash
# Run only service tests
npm test -- --testPathPattern=src/services

# Watch mode
npm run test:watch -- --testPathPattern=src/services

# With coverage
npm run test:coverage -- --collectCoverageFrom='src/services/**'
```

---

## Coverage Targets

| File | Statements | Branches | Functions |
|---|---|---|---|
| `OfficeAuthService.ts` | 95%+ | 90%+ | 100% |
| `TokenService.ts` | 95%+ | 85%+ | 100% |
| `IdleActivityMonitor.ts` | 90%+ | 80%+ | 100% |
| `PairingApiService.ts` | 90%+ | 80%+ | 100% |
| `WebRTCDataChannelService.ts` | 90%+ | 80%+ | 100% |
| `WebRTCConnectionManager.ts` | 85%+ | 75%+ | 95%+ |
