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
| Token refresh flow (service-level) | ✅ Done (9 tests) |
| Pairing flow (service-level) | ✅ Done (13 tests) |
| Pairing flow through the real UI | ✅ Done (4 tests) |
| Idle disconnect | ✅ Done (8 tests) |
| SIP + Redux sync (happy path, permanent failure, registration retry, full reconnect cycle) | ✅ Done (4 tests) |
| Favorites (case) flow end-to-end (component → thunk → real WebRTCApiService) | ✅ Done (4 tests) |
| Token expiry mid-session, UI-visible consequences | ✅ Done (2 tests) |

All scenarios are implemented — 44 integration tests total, across 7 files.

A gap re-audit (2026-08-17) found that most of the original 4 files only
wired 2 of the "2+ real units" they claimed — e.g. `pairingFlow.test.ts`
never rendered a component despite the guide describing a `PairingDialog`/
`App` scenario, and `idleDisconnect.test.ts` mocked `SipClient` away
entirely. The 3 new files above close those gaps with genuinely
cross-layer tests (component + slice + real service, with only the true
I/O boundary mocked), and `sipReduxSync.test.ts` gained 2 new tests for
previously-uncovered failure/recovery paths. One real production bug was
found and fixed in the process — see Scenario 2 below.

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

**Units involved (service-level):** `PairingApiService` → `pairingSlice`

**Test file:** `src/__tests__/integration/pairingFlow.test.ts` (13 tests) — calls
`PairingApiService.pair()`/`checkServerId()` directly against a mocked `fetch`
and asserts on the real `pairingSlice` reducer. Does not render a component.

**Units involved (real UI):** `PairingDialog` component → `pairingSlice` →
`PairingApiService` (real singleton, `fetch` mocked)

**Test file:** `src/__tests__/integration/pairingFlowUI.test.tsx` (4 tests) —
renders the real `PairingDialog`, submits an OTP through real `fireEvent`s, and
asserts the real round trip: submit → real fetch → real `pairingSlice` dispatch
→ dialog auto-unmounts on success, or stays visible with the real error message
on failure, and supports retry.

**Real bug found and fixed:** `PairingApiService.pair()`/`checkServerId()`
dispatch `setPairingError()` (status: `'error'`) *before* throwing on failure.
`PairingDialog` and `App.tsx` previously only stayed mounted while
`pairingStatus === 'unpaired'`, so the dialog unmounted itself the instant the
store flipped to `'error'` — hiding the very error message the component's own
catch block was about to render, and stranding the user with no visible dialog
and no way to retry a failed OTP submission. Both components now also
render/mount while `pairingStatus === 'error'`.

```typescript
it("submits the OTP through the real component and disappears once the real store reaches 'paired'", async () => {
  mockFetchOk({ advokatServerId: SERVER_ID, kuerzel: KUERZEL });
  const { container } = renderPairingDialog();

  fireEvent.change(screen.getByRole("textbox", { name: /One-time pairing code/i }), {
    target: { value: "abcd1234" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Pair with ADVOKAT/i }));

  await waitFor(() => expect(selectPairingStatus(_store.getState() as any)).toBe("paired"));
  await waitFor(() => expect(container).toBeEmptyDOMElement());
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

**Test file:** `src/__tests__/integration/sipReduxSync.test.ts` (4 tests — happy
path to `CONNECTED`; a permanent registration failure that never reaches
`CONNECTED`; a temporary (5xx) registration failure that retries in-place over
the same socket with a fresh Call-ID and still reaches `CONNECTED`; and a full
reconnect cycle — an unexpected (non-1000) WebSocket close triggers
`WebRTCConnectionManager`'s auto-reconnect, which tears down and creates a
brand-new `SipClient`/`WebSocket` and re-drives the handshake to `CONNECTED`)

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

### Scenario 5 — Favorites (Case) Flow End-to-End ✅ Done

**Units involved:** `CaseTabContent` component → `aktenSlice` (real reducer +
thunks) → `WebRTCApiService` (real instance — real chunking, request-id
correlation, and protocol construction; `chunkingUtils` is NOT mocked)

**Test file:** `src/__tests__/integration/favoritesFlow.test.tsx` (4 tests)

Only the true I/O boundary — `WebRTCDataChannelService.send()` /
`onDataChannelMessage()` — is driven manually, exactly the way the real
DataChannel delivers bytes. Unlike the unit-level `CaseTabContent.test.tsx`
(which mocks `getWebRTCApiService()` to return plain `jest.fn()` stubs), this
proves the full round trip: delete click → `removeAktFromFavoriteAsync` thunk
→ real `WebRTCApiService` builds the actual chunked protocol request → (fake)
DataChannel "sends" it → simulated server response delivered back through
`onDataChannelMessage()` → real thunk resolves → real reducer updates →
component re-renders → success notification. Also covers a permanent
HTTP-status error (400) and a connection-level failure (channels not ready)
both correctly propagating to a real Redux state change and a real UI error
notification.

---

### Scenario 6 — Token Expiry Mid-Session, UI-Visible Consequences ✅ Done

**Units involved:** `WebRTCConnectionStatus` component → `TokenService` (real
singleton) → `authSlice` (real reducer)

**Test file:** `src/__tests__/integration/tokenExpiryReconnect.test.tsx` (2 tests)

Renders the real connection-status banner on top of the real `TokenService`,
with only `OfficeRuntime.auth.getAccessToken` and `PairingApiService`'s HTTP
exchange mocked. Proves the background-refresh success path is fully silent
to the user (banner stays "connected" throughout), and documents a real,
easy-to-miss behavior: `TokenService._refresh()` does **not** dispatch
`authenticationFailure()` when a background refresh fails — it just returns
`null`. So a failed proactive refresh does not flip the banner to the red
"authentication failed" state or show a reconnect button; the failure only
becomes visible once whatever action triggered the refresh fails on its own
(see Scenario 5's error-propagation tests).

---

## Test File Structure

```
src/__tests__/integration/
├── tokenRefreshFlow.test.ts       ← ✅ done (9 tests)
├── pairingFlow.test.ts            ← ✅ done (13 tests)
├── pairingFlowUI.test.tsx         ← ✅ done (4 tests)
├── idleDisconnect.test.ts         ← ✅ done (8 tests)
├── sipReduxSync.test.ts           ← ✅ done (4 tests)
├── favoritesFlow.test.tsx         ← ✅ done (4 tests)
└── tokenExpiryReconnect.test.tsx  ← ✅ done (2 tests)
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
