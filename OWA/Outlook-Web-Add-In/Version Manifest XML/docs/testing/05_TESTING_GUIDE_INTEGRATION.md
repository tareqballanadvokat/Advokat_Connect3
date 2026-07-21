# Integration Testing Guide

> Part of the overall [Testing Strategy](./00_TESTING_STRATEGY.md).  
> Covers cross-layer flows where multiple real units are wired together and only
> the true system boundary (network, `OfficeRuntime`, WebSocket) is mocked.

---

## Purpose

Integration tests sit between unit tests and E2E tests on the test pyramid.
They verify that data flows correctly across module boundaries — for example,
that an auth token obtained via `OfficeAuthService` actually ends up in the
Redux store and is subsequently used by `TokenService` when making API calls.

**What is mocked:**
- `OfficeRuntime.auth` (no real Office context in Jest)
- `fetch` / HTTP calls (no real ADVOKAT server)
- `WebSocket` (no real SIP server)

**What is NOT mocked:**
- Redux store (real reducers and selectors)
- Service classes (real instances)
- React components (where tested together with services)

---

## Can Start Immediately?

| Scenario | Ready now? | Blocker |
|---|---|---|
| Token refresh flow | ✅ Yes | None |
| Pairing flow | ✅ Yes | None |
| Idle disconnect | ⚠️ Partial | Needs `IdleActivityMonitor` unit work done first |
| SIP + Redux sync | ⚠️ Partial | Needs WebSocket mock from [SIP guide](./03_TESTING_GUIDE_SIP.md) |

---

## Infrastructure Requirements

### `msw` (Mock Service Worker) — optional but recommended

`msw` intercepts `fetch` at the network layer, making HTTP mocking realistic
and reusable across tests. Install when integration tests grow beyond simple
`jest.spyOn(global, 'fetch')` patterns:

```bash
npm install --save-dev msw
```

Configure a server in `src/setupTests.ts`:

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## Scenarios

---

### Scenario 1 — Token Refresh Flow

**Units involved:** `OfficeAuthService` → `TokenService` → `authSlice`

**Flow:**
1. `TokenService.ensureValidToken()` detects near-expiry token in Redux store
2. Calls `OfficeAuthService.getAccessToken()` to get a fresh Office JWT
3. Exchanges it via `POST /addin/office-token/token`
4. Dispatches `authenticationSuccess` to Redux
5. Returns new token to the caller

**Test file:** `src/services/__tests__/integration/tokenRefreshFlow.test.ts`

```typescript
it('should refresh token when near expiry and update Redux', async () => {
  // Arrange
  const nearExpiryTime = Date.now() + 30 * 1000; // 30 seconds — within buffer
  const store = createTestStore({
    auth: { token: 'old-token', expiresAt: nearExpiryTime, officeToken: 'office-jwt' },
  });

  (OfficeRuntime.auth.getAccessToken as jest.Mock).mockResolvedValue('new-office-jwt');
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(
    JSON.stringify({ access_token: 'new-token', expires_in: 3600 }),
    { status: 200 }
  ));

  // Act
  const tokenService = new TokenService();
  const token = await tokenService.ensureValidToken();

  // Assert
  expect(token).toBe('new-token');
  expect(store.getState().auth.token).toBe('new-token');
});
```

---

### Scenario 2 — Pairing Flow

**Units involved:** `PairingApiService` → `pairingSlice` → `App` component

**Flow:**
1. User fills in server URL + OTP in `PairingDialog`
2. `PairingApiService` sends pairing request
3. On success, `pairingSlice` is updated to `'paired'`
4. `App` re-renders and shows the main tab navigation

**Test file:** `src/services/__tests__/integration/pairingFlow.test.ts`

```typescript
it('should update pairing state and re-render App after successful pairing', async () => {
  const user = userEvent.setup();

  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(
    JSON.stringify({ success: true }),
    { status: 200 }
  ));

  const { store } = renderWithProviders(<App title="Test" />, {
    preloadedState: { pairing: { status: 'unpaired' } },
  });

  await user.type(screen.getByLabelText(/server url/i), 'https://advokat.example.com');
  await user.type(screen.getByLabelText(/otp/i), '123456');
  await user.click(screen.getByRole('button', { name: /pair/i }));

  await waitFor(() => {
    expect(store.getState().pairing.status).toBe('paired');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

---

### Scenario 3 — Idle Disconnect

**Units involved:** `IdleActivityMonitor` → `WebRTCConnectionManager` → `connectionSlice`

**Flow:**
1. `WebRTCConnectionManager` starts `IdleActivityMonitor` after connecting
2. No user activity for `idleTimeout` ms
3. `IdleActivityMonitor` fires `onIdle` callback
4. `WebRTCConnectionManager` calls `disconnect()`
5. Redux `connectionSlice` is updated with `isIdle: true` and disconnected state

**Prerequisites:** `IdleActivityMonitor` unit tests done first (see
[Services Guide](./02_TESTING_GUIDE_SERVICES.md)).

```typescript
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

it('should disconnect and mark idle after timeout', () => {
  const store = createTestStore({ connection: connectedState });
  const manager = new WebRTCConnectionManager();
  manager.startIdleMonitoring(store.dispatch);

  jest.advanceTimersByTime(IDLE_TIMEOUT_MS + 100);

  expect(store.getState().connection.isIdle).toBe(true);
  expect(store.getState().connection.sipClientState).toBe(SipClientState.DISCONNECTED);
});
```

---

### Scenario 4 — SIP + Redux Sync

**Units involved:** `WebRTCConnectionManager` (real) + `SipClient` (mocked at WebSocket boundary) → `connectionSlice`

**Flow:**
1. `WebRTCConnectionManager.connect()` is called
2. `SipClient` initialises, mocked WebSocket responds with correct SIP messages
3. All 3 phases complete successfully
4. Redux `connectionSlice` reflects `CONNECTED` state

**Prerequisites:** WebSocket mock from [SIP guide](./03_TESTING_GUIDE_SIP.md) is in place.

```typescript
it('should reach CONNECTED state after successful SIP handshake', async () => {
  const store = createTestStore();
  const manager = new WebRTCConnectionManager();

  // Trigger connect (uses real SipClient internals, mocked WebSocket)
  manager.connect();

  // Simulate WebSocket SIP handshake responses
  ws.simulateMessage(REGISTER_200_OK);
  ws.simulateMessage(NOTIFY4);
  ws.simulateMessage(NOTIFY6);
  ws.simulateMessage(SERVICE_ANSWER);

  await waitFor(() => {
    expect(store.getState().connection.sipClientState).toBe(SipClientState.CONNECTED);
  });
});
```

---

## Test File Structure

```
src/
└── __integration__/
    ├── tokenRefreshFlow.test.ts
    ├── pairingFlow.test.ts
    ├── idleDisconnect.test.ts
    └── sipReduxSync.test.ts
```

Or co-locate alongside the primary service being tested:
```
src/services/__tests__/integration/
```

Update `jest.config.js` `testMatch` to pick up the `__integration__` folder
if you use the top-level location.

---

## Running Integration Tests

```bash
# Run only integration tests
npm test -- --testPathPattern=__integration__

# Run alongside unit tests
npm test

# With verbose output (useful for multi-step flows)
npm run test:verbose -- --testPathPattern=__integration__
```
