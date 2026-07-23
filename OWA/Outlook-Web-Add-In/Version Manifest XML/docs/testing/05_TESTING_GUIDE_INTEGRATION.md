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

## Status

| Scenario | Status |
|---|---|
| Token refresh flow | ✅ Done (9 tests) |
| Pairing flow | ✅ Done (13 tests) |
| Idle disconnect | ✅ Done (8 tests) |
| SIP + Redux sync | ✅ Done (2 tests) |

All 4 scenarios are implemented — 32 integration tests total.

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

### Scenario 1 — Token Refresh Flow ✅ Done

**Units involved:** `OfficeAuthService` → `TokenService` → `authSlice`

**Flow:**
1. `TokenService.ensureValidToken()` detects near-expiry token in Redux store
2. Calls `OfficeAuthService.getAccessToken()` to get a fresh Office JWT
3. Exchanges it via `POST /addin/office-token/token`
4. Dispatches `authenticationSuccess` to Redux
5. Returns new token to the caller

**Test file:** `src/__tests__/integration/tokenRefreshFlow.test.ts`

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

### Scenario 2 — Pairing Flow ✅ Done

**Units involved:** `PairingApiService` → `pairingSlice` → `App` component

**Flow:**
1. User fills in server URL + OTP in `PairingDialog`
2. `PairingApiService` sends pairing request
3. On success, `pairingSlice` is updated to `'paired'`
4. `App` re-renders and shows the main tab navigation

**Test file:** `src/__tests__/integration/pairingFlow.test.ts`

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

### Scenario 3 — Idle Disconnect ✅ Done

**Units involved:** `IdleActivityMonitor` → `WebRTCConnectionManager` → `connectionSlice`

**Flow:**
1. `WebRTCConnectionManager` starts `IdleActivityMonitor` after connecting
2. No user activity for `idleTimeout` ms
3. `IdleActivityMonitor` fires `onIdle` callback
4. `WebRTCConnectionManager` calls `disconnect()`
5. Redux `connectionSlice` is updated with `isIdle: true` and disconnected state

**Test file:** `src/__tests__/integration/idleDisconnect.test.ts` (8 tests)

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

### Scenario 4 — SIP + Redux Sync ✅ Done

**Units involved:** `WebRTCConnectionManager`, `SipClient`, `Registration`,
`EstablishingConnection`, `Peer2PeerConnection` (all real) + `connectionSlice` +
`authSlice` (real reducers, real `configureStore`)

**Flow:**
1. `WebRTCConnectionManager.connect()` initialises the real `SipClient`
2. The mocked `WebSocket` instance is driven manually through the real wire
   protocol: REGISTER → 202 → NOTIFY4 → ACK5 → NOTIFY6 → SDP offer → SDP answer
3. `RTCPeerConnection` is mocked per-test (ICE gathering, `createDataChannel`);
   DataChannel "open" events are simulated the same way the `Peer2PeerConnection`
   unit tests do, since jsdom has no real `RTCDataChannel` implementation
4. All 3 phases complete through the real state machines (no phase is mocked)
5. Redux `connectionSlice` reflects `CONNECTED`, and `authSlice` reflects a
   successful post-connection authentication

**Test file:** `src/__tests__/integration/sipReduxSync.test.ts` (2 tests — happy
path to `CONNECTED`, and a permanent registration failure that never reaches
`CONNECTED`)

**Key techniques:**
- `configService.getSipConfig()` / `getConfig()` mocked with static values (no
  Registration/EstablishingConnection/Peer2PeerConnection module mocking — they
  run for real)
- SIP messages are hand-built strings matching the exact header format produced
  by `MessageFactory`, extracting the real `Call-ID` from the client's own
  REGISTER message so the synthetic 202 response passes `Registration`'s session
  validation
- `WebRTCDataChannelService` mocked at module level to capture the observer
  `Peer2PeerConnection` subscribes with, so the test can fire
  `onDataChannelStateChanged("open", "offer")` directly instead of needing a
  real `RTCDataChannel`
- `@store` mocked with a dynamic getter returning a real `configureStore` with
  `connectionReducer` + `authReducer`, matching the pattern in
  `idleDisconnect.test.ts`

---

## Test File Structure

```
src/__tests__/integration/
├── tokenRefreshFlow.test.ts   ← ✅ done (9 tests)
├── pairingFlow.test.ts        ← ✅ done (13 tests)
├── idleDisconnect.test.ts     ← ✅ done (8 tests)
└── sipReduxSync.test.ts       ← ✅ done (2 tests)
```

---

## Running Integration Tests

```bash
# Run only integration tests
npm test -- --testPathPattern=src/__tests__/integration

# Run alongside unit tests
npm test

# With verbose output (useful for multi-step flows)
npm run test:verbose -- --testPathPattern=src/__tests__/integration
```
