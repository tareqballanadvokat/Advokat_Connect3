# Unit Testing Guide — SIP Infrastructure

> Part of the overall [Testing Strategy](./00_TESTING_STRATEGY.md).  
> Covers `src/infrastructure/sip/` — the SIP protocol state-machine and WebRTC
> signalling layer.

---

## Scope

| File | Status | Complexity |
|---|---|---|
| `MessageFactory.ts` | ✅ 21 tests — all four message types, header and body assertions | Low |
| `Helper.ts` | ✅ 15 tests — string / ArrayBuffer / Blob paths, contentLength | Low |
| `TimeoutManager.ts` | ✅ 36 tests — start, cancel, cancelAll, reset, queries, stats | Low |
| `Registration.ts` | ❌ not yet implemented | Medium |
| `EstablishingConnection.ts` | ❌ not yet implemented | Medium |
| `Peer2PeerConnection.ts` | ❌ not yet implemented | High |
| `SipClient.ts` | ❌ not yet implemented | High |

---

## Recommended Implementation Order

Start with the low-complexity, dependency-free files first:

1. `MessageFactory` — ✅ done (`src/infrastructure/sip/__tests__/MessageFactory.test.ts`)
2. `Helper` — ✅ done (`src/infrastructure/sip/__tests__/Helper.test.ts`)
3. `TimeoutManager` — ✅ done (`src/infrastructure/sip/__tests__/TimeoutManager.test.ts`)
4. `Registration` — needs WebSocket mock
5. `EstablishingConnection` — needs WebSocket mock
6. `Peer2PeerConnection` — needs WebSocket + RTCPeerConnection mocks
7. `SipClient` — orchestrates all phases, needs full mock set

> **Note:** `TextEncoder` / `TextDecoder` polyfills and `Blob.text()` workaround
> were added to `src/setupTests.ts` while writing Helper tests.

---

## Infrastructure Requirements

### Global WebSocket mock

Add to `src/setupTests.ts`:

```typescript
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  send = jest.fn();
  close = jest.fn();

  simulateOpen() { this.onopen?.(new Event('open')); }
  simulateMessage(data: string) { this.onmessage?.(new MessageEvent('message', { data })); }
  simulateClose() { this.onclose?.(new CloseEvent('close')); }
  simulateError() { this.onerror?.(new Event('error')); }
}

global.WebSocket = MockWebSocket as any;
```

### Global RTCPeerConnection mock

Add to `src/setupTests.ts` (if not already added from the services guide):

```typescript
global.RTCPeerConnection = jest.fn().mockImplementation(() => ({
  createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp-offer' }),
  createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp-answer' }),
  setLocalDescription: jest.fn().mockResolvedValue(undefined),
  setRemoteDescription: jest.fn().mockResolvedValue(undefined),
  createDataChannel: jest.fn().mockReturnValue({
    send: jest.fn(),
    close: jest.fn(),
    readyState: 'open',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  close: jest.fn(),
  iceConnectionState: 'new',
  connectionState: 'new',
}));
```

---

## Test File Locations

```
src/infrastructure/sip/__tests__/
├── MessageFactory.test.ts
├── Helper.test.ts
├── TimeoutManager.test.ts
├── Registration.test.ts
├── EstablishingConnection.test.ts
├── Peer2PeerConnection.test.ts
└── SipClient.test.ts
```

---

## File-by-File Guide

---

### `MessageFactory` — Complexity: Low

Pure functions that produce SIP message strings. No mocks required.

**What to test:**

| Method | Scenario |
|---|---|
| `createRegisterMessage()` | Output contains correct `REGISTER` verb and headers |
| `createAckMessage()` | Output contains correct `ACK` verb and CSeq |
| `createServiceMessage(offer)` | Output contains `SERVICE` verb and embedded SDP offer |
| All methods | Output is a non-empty string |
| All methods | Required SIP headers present (`Via`, `From`, `To`, `CSeq`, `Call-ID`) |

**Example:**

```typescript
import { MessageFactory } from '@infra/sip/MessageFactory';

describe('MessageFactory', () => {
  it('should produce a REGISTER message', () => {
    const msg = MessageFactory.createRegisterMessage({ ... });
    expect(msg).toContain('REGISTER');
    expect(msg).toContain('Via:');
    expect(msg).toContain('From:');
  });
});
```

---

### `Helper` — Complexity: Low

SIP message parsing utilities. Pure functions, no mocks required.

**What to test:**

| Function | Scenario |
|---|---|
| Parse status code | Valid SIP response → numeric code extracted |
| Parse header value | Header present → correct value returned |
| Parse header value | Header absent → returns `null`/`undefined` |
| Parse SDP body | SDP block extracted from message |
| Malformed input | Does not throw; returns safe default |

---

### `TimeoutManager` — Complexity: Low

**What to test:**

| Scenario | Assertion |
|---|---|
| `register(key, callback, delay)` | Callback fires after `delay` ms |
| `cancel(key)` before delay elapses | Callback never fires |
| `cancelAll()` | All pending callbacks cancelled |
| Registering same key twice | Previous timer cancelled, new one started |

```typescript
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

it('should fire callback after delay', () => {
  const cb = jest.fn();
  manager.register('myKey', cb, 3000);
  jest.advanceTimersByTime(3001);
  expect(cb).toHaveBeenCalledTimes(1);
});

it('should not fire if cancelled before delay', () => {
  const cb = jest.fn();
  manager.register('myKey', cb, 3000);
  manager.cancel('myKey');
  jest.advanceTimersByTime(5000);
  expect(cb).not.toHaveBeenCalled();
});
```

---

### `Registration` — Complexity: Medium

**State transitions to test:**

```
IDLE → REGISTERING → REGISTERED
                   → FAILED (timeout)
                   → FAILED (error response)
```

**What to test:**

| Scenario | Assertion |
|---|---|
| `start()` sends REGISTER message | `WebSocket.send` called with REGISTER string |
| 200 OK response received | `onSuccess` callback fired |
| Timeout elapses before response | `onTimeout` callback fired |
| Error response (4xx/5xx) received | `onFailure` callback fired |
| `reset()` cancels pending timers | No callbacks fired after reset |

**Pattern — simulate incoming WebSocket message:**

```typescript
const ws = new (global.WebSocket as any)();
// After Registration is started and holds a reference to ws:
ws.simulateMessage('SIP/2.0 200 OK\r\n...');
```

---

### `EstablishingConnection` — Complexity: Medium

**State transitions to test:**

```
IDLE → WAITING_FOR_NOTIFY → ACKNOWLEDGED → CONNECTED
                                          → FAILED (timeout)
```

**What to test:**

| Scenario | Assertion |
|---|---|
| NOTIFY4 message received | ACK5 sent, state advances |
| NOTIFY6 message received | `onSuccess` callback fired |
| Connection timeout | `onTimeout` callback fired |
| Unexpected message received | State unchanged, no crash |

---

### `Peer2PeerConnection` — Complexity: High

**What to test:**

| Scenario | Assertion |
|---|---|
| `createOffer()` | `RTCPeerConnection.createOffer()` called, SDP returned |
| SDP answer applied | `setRemoteDescription` called with answer |
| DataChannel opened | `onDataChannelOpen` callback fired |
| DataChannel closes | `onDataChannelClose` callback fired |
| ICE candidate type selected | `setSelectedCandidateType` action dispatched with correct type |
| `destroy()` | `RTCPeerConnection.close()` called |

---

### `SipClient` — Complexity: High

Tests the full 3-phase orchestration:
**Registration → EstablishingConnection → Peer2PeerConnection**

**What to test:**

| Scenario | Assertion |
|---|---|
| `connect()` → Registration success → NOTIFY → SDP exchange | Observer notified with `CONNECTED` state |
| Registration timeout | Observer notified with `FAILED` state |
| Connection phase timeout | Observer notified with `FAILED` state |
| `disconnect()` | All phases torn down, observer notified with `DISCONNECTED` |
| Observer added with `addObserver()` | Receives all subsequent state change notifications |
| Observer removed with `removeObserver()` | No longer receives notifications |

**Mocking strategy:** Mock `Registration`, `EstablishingConnection`, and
`Peer2PeerConnection` at the module level. Manually trigger their callbacks
to simulate phase completions:

```typescript
jest.mock('@infra/sip/Registration');
jest.mock('@infra/sip/EstablishingConnection');
jest.mock('@infra/sip/Peer2PeerConnection');

// Then in test:
const registrationInstance = (Registration as jest.Mock).mock.instances[0];
registrationInstance.callbacks.onSuccess(); // simulate success
```

---

## Running SIP Tests

```bash
# Run only SIP tests
npm test -- --testPathPattern=src/infrastructure/sip

# Watch mode
npm run test:watch -- --testPathPattern=src/infrastructure/sip

# With coverage
npm run test:coverage -- --collectCoverageFrom='src/infrastructure/sip/**'
```

---

## Coverage Targets

| File | Statements | Branches | Functions |
|---|---|---|---|
| `MessageFactory.ts` | 100% | 100% | 100% |
| `Helper.ts` | 100% | 90%+ | 100% |
| `TimeoutManager.ts` | 95%+ | 90%+ | 100% |
| `Registration.ts` | 90%+ | 80%+ | 100% |
| `EstablishingConnection.ts` | 90%+ | 80%+ | 100% |
| `Peer2PeerConnection.ts` | 85%+ | 75%+ | 95%+ |
| `SipClient.ts` | 85%+ | 75%+ | 95%+ |
