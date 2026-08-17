/* eslint-disable no-undef */
/**
 * Integration Test — SIP + Redux Sync (Scenario 4)
 *
 * Units under test (REAL, not mocked):
 *   WebRTCConnectionManager → real orchestrator, real SipClientObserver
 *   SipClient (initializeSipClient) → real 3-phase orchestration
 *   Registration, EstablishingConnection, Peer2PeerConnection → real classes
 *   MessageFactory, Helper, TimeoutManager → real
 *   connectionSlice, authSlice → real reducers
 *   Redux store → real configureStore
 *
 * External boundaries mocked:
 *   WebSocket / RTCPeerConnection → global mocks (setupTests.ts), driven manually
 *     per test to simulate the server side of the SIP/WebRTC handshake.
 *   WebRTCDataChannelService → module mock (channel open/close is real jsdom
 *     RTCDataChannel behaviour, which does not exist — so channel-open events
 *     are simulated the same way the Peer2PeerConnection unit tests do).
 *   webRTCApiService, PairingApiService, @infra/logger, @config → lightweight stubs.
 *
 * This drives a full REGISTER → NOTIFY4/6 → SDP offer/answer handshake through
 * the real state machines and asserts the Redux connectionSlice ends up CONNECTED.
 */

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

// ─── Config mock ─────────────────────────────────────────────────────────────
jest.mock("@config", () => ({
  configService: {
    getSipConfig: jest.fn(() => ({
      sipUri:          "sip:client@sip.test:5061;transport=wss",
      wsUri:           "wss://sip.test:443",
      fromDisplayName: "Client",
      toDisplayName:   "Server",
      maxRetries:      3,
    })),
    buildSipUri: jest.fn((name: string) => `sip:${name.toLowerCase()}@sip.test`),
  },
  getConfig: jest.fn(() => ({ webrtc: { iceServers: [] } })),
}));

// ─── WebRTCDataChannelService mock — captures the observer registered by
//     Peer2PeerConnection so the test can fire "open" events manually ────────
const mockSvcInstance = {
  subscribe:               jest.fn(),
  unsubscribe:             jest.fn(),
  setOfferChannel:         jest.fn(),
  setAnswerChannel:        jest.fn(),
  reset:                   jest.fn(),
  isReadyForCommunication: false,
  isOfferChannelOpen:      false,
  isAnswerChannelOpen:     false,
};

let capturedObserver: {
  onDataChannelStateChanged?: (state: RTCDataChannelState, type: "offer" | "answer") => void;
  onDataChannelError?:        (error: Event | string, type: "offer" | "answer") => void;
};

jest.mock("@services/WebRTCDataChannelService", () => ({
  WebRTCDataChannelService: {
    getInstance: jest.fn(() => mockSvcInstance),
    destroy:     jest.fn(),
  },
}));

// ─── webRTCApiService mock ────────────────────────────────────────────────────
jest.mock("@services/webRTCApiService", () => ({
  webRTCApiService: { initialize: jest.fn(), cleanup: jest.fn() },
}));

// ─── PairingApiService mock ───────────────────────────────────────────────────
jest.mock("@services/PairingApiService", () => ({
  pairingApiService: {
    exchangeOfficeToken: jest.fn(() =>
      Promise.resolve({ access_token: "jwt", expires_in: 3600, refresh_token: null, refresh_token_lifetime: 7200 })
    ),
  },
}));

// ─── OfficeAuthService mock — performAuthentication() re-acquires a fresh
// Office SSO token via this service before exchanging it for the ADVOKAT JWT.
const mockGetOfficeToken = jest.fn(() => Promise.resolve("office-jwt"));
jest.mock("@services/OfficeAuthService", () => ({
  officeAuthService: { getOfficeToken: (...args: any[]) => mockGetOfficeToken(...args) },
}));

// ─── Store mock — dynamic getter so each test injects a fresh store ───────────
let _store: ReturnType<typeof buildStore>;
jest.mock("@store", () => ({
  get store() { return _store; },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────
import { configureStore } from "@reduxjs/toolkit";
import connectionReducer, {
  selectConnectionState,
} from "@slices/connectionSlice";
import authReducer, { setOfficeToken, selectAuthToken, selectIsAuthenticated } from "@slices/authSlice";
import { WebRTCConnectionManager } from "@services/WebRTCConnectionManager";
import { SipClientState } from "@infra/sip/SipClient";

function buildStore() {
  return configureStore({
    reducer: { connection: connectionReducer, auth: authReducer },
    middleware: (gd) => gd({ serializableCheck: false }),
  });
}

/**
 * performAuthentication() is fired-and-forgotten from onSipClientStateChanged
 * (not awaited by connect()), so tests need to flush its microtask chain
 * (getOfficeToken → exchangeOfficeToken → dispatch) after connectPromise resolves.
 * Uses only microtasks (not setImmediate/setTimeout) so it works under fake timers.
 */
async function flushPromises(times = 6): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

// ─── SIP message builders (real wire format expected by Registration /
//     EstablishingConnection / Peer2PeerConnection) ───────────────────────────

function extractCallId(message: string): string {
  const match = message.match(/^Call-ID:\s*([^\r\n]+)/m);
  return match ? match[1] : "";
}

function build202Response(callId: string): string {
  return [
    "SIP/2.0 202 Accepted",
    "Via: SIP/2.0/WSS sip.test;branch=z9hG4bKserver202",
    'To: "Client" <sip:client@sip.test;transport=wss>',
    'From: "Server" <sip:server@sip.test;transport=wss>;tag=servregtag',
    `Call-ID: ${callId}`,
    "CSeq: 2 REGISTER",
    "Content-Length: 0",
    "",
    "",
  ].join("\r\n");
}

// Tag values deliberately avoid the lowercase letter "s" — EstablishingConnection's
// own REGEX_FROM_TAG has a pre-existing typo (`[^\ s;>\r\n]`) that truncates the
// captured tag at the first "s". Not exercised by this test, but avoided for clarity.
const CONN_CALL_ID = "conn-call-id-abc123";
const CONN_TO_TAG = "connToTagA1";
const CONN_FROM_TAG = "connFromTagB2";

function buildNotify4(): string {
  return [
    "NOTIFY sip:client@sip.test:5061;transport=wss SIP/2.0",
    "Via: SIP/2.0/WSS sip.test;branch=z9hG4bKnotify4",
    `To: "Client" <sip:client@sip.test;transport=wss>;tag=${CONN_TO_TAG}`,
    `From: "Server" <sip:server@sip.test;transport=wss>;tag=${CONN_FROM_TAG}`,
    `Call-ID: ${CONN_CALL_ID}`,
    "CSeq: 4 NOTIFY",
    "",
    "",
  ].join("\r\n");
}

function buildNotify6(): string {
  return [
    "NOTIFY sip:client@sip.test:5061;transport=wss SIP/2.0",
    "Via: SIP/2.0/WSS sip.test;branch=z9hG4bKnotify6",
    `From: "Server" <sip:server@sip.test;transport=wss>;tag=${CONN_FROM_TAG}`,
    `Call-ID: ${CONN_CALL_ID}`,
    "CSeq: 6 NOTIFY",
    "",
    "",
  ].join("\r\n");
}

function buildServiceAnswer(callId: string): string {
  const sdpJson = JSON.stringify({ type: "answer", sdp: "mock-sdp-answer" });
  return [
    "SERVICE sip:client@sip.test:5061;transport=wss SIP/2.0",
    "Via: SIP/2.0/WSS sip.test;branch=z9hG4bKanswer",
    `Call-ID: ${callId}`,
    "CSeq: 2 SERVICE",
    `Content-Length: ${new TextEncoder().encode(sdpJson).length}`,
    "",
    sdpJson,
  ].join("\r\n");
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Integration — SIP + Redux Sync (real SipClient orchestration)", () => {
  let manager: WebRTCConnectionManager;
  let mockPc: any;
  let mockDataChannel: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    _store = buildStore();

    // Seed an Office token in the store (unrelated to auth: performAuthentication()
    // re-acquires its own via the mocked officeAuthService.getOfficeToken() above).
    _store.dispatch(setOfficeToken({ officeToken: "office-jwt", oid: "oid-1", email: "user@test.com" }));

    (global.WebSocket as any).OPEN       = 1;
    (global.WebSocket as any).CONNECTING = 0;
    (global.WebSocket as any).CLOSING    = 2;
    (global.WebSocket as any).CLOSED     = 3;

    mockSvcInstance.isReadyForCommunication = false;
    mockSvcInstance.isOfferChannelOpen      = false;
    mockSvcInstance.isAnswerChannelOpen     = false;
    mockSvcInstance.subscribe.mockImplementation((obs: any) => {
      capturedObserver = obs;
    });

    mockDataChannel = {
      readyState: "connecting" as RTCDataChannelState,
      label:      "offer",
      onopen:     null,
      onclose:    null,
      onerror:    null,
      onmessage:  null,
      send:       jest.fn(),
      close:      jest.fn(),
    };

    mockPc = {
      createOffer:               jest.fn(() => Promise.resolve({ type: "offer", sdp: "mock-sdp-offer" })),
      createAnswer:              jest.fn(() => Promise.resolve({ type: "answer", sdp: "mock-sdp-answer" })),
      setLocalDescription:       jest.fn(async (desc: any) => { mockPc.localDescription = desc; }),
      setRemoteDescription:      jest.fn(() => Promise.resolve()),
      addIceCandidate:           jest.fn(() => Promise.resolve()),
      createDataChannel:         jest.fn(() => mockDataChannel),
      close:                     jest.fn(),
      getStats:                  jest.fn(() => Promise.resolve(new Map())),
      addEventListener:          jest.fn(),
      removeEventListener:       jest.fn(),
      onicecandidate:            null,
      ondatachannel:             null,
      onicegatheringstatechange: null,
      oniceconnectionstatechange: null,
      localDescription:          null,
      remoteDescription:         null,
      iceGatheringState:         "new",
      iceConnectionState:        "new",
    };
    (global.RTCPeerConnection as unknown as jest.Mock).mockImplementation(() => mockPc);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("reaches CONNECTED in connectionSlice after a full real SIP + WebRTC handshake", async () => {
    manager = new WebRTCConnectionManager({
      enableAutoReconnect:  false,
      enableIdleDisconnect: false,
    });

    const connectPromise = manager.connect();

    const sipClient = manager.getSipClient();
    expect(sipClient).not.toBeNull();
    const ws = sipClient!.socket as any;

    // ── Phase 1: Registration ──────────────────────────────────────────────
    ws.onopen?.(new Event("open"));
    expect(selectConnectionState(_store.getState() as any).sipClientState).toBe(
      SipClientState.REGISTERING
    );

    const registerMsg = ws.send.mock.calls[0][0];
    const callId = extractCallId(registerMsg);
    expect(callId).not.toBe("");

    await ws.onmessage!({ data: build202Response(callId) } as any);
    expect(selectConnectionState(_store.getState() as any).sipClientState).toBe(
      SipClientState.CONNECTING
    );

    // ── Phase 2: Connection establishment (NOTIFY4 → ACK5 → NOTIFY6) ───────
    await ws.onmessage!({ data: buildNotify4() } as any);
    await ws.onmessage!({ data: buildNotify6() } as any);
    expect(selectConnectionState(_store.getState() as any).sipClientState).toBe(
      SipClientState.CONNECTING_P2P
    );

    // ── Phase 3: WebRTC SDP exchange ───────────────────────────────────────
    // ICE gathering completes → offer is sent over the (mocked) WebSocket.
    mockPc.iceGatheringState = "complete";
    mockPc.onicegatheringstatechange?.();

    await ws.onmessage!({ data: buildServiceAnswer(CONN_CALL_ID) } as any);

    // DataChannels open — simulated the same way the Peer2PeerConnection unit
    // tests do, since jsdom has no real RTCDataChannel implementation.
    mockSvcInstance.isReadyForCommunication = true;
    capturedObserver.onDataChannelStateChanged?.("open", "offer");

    await connectPromise;

    const finalState = selectConnectionState(_store.getState() as any);
    expect(finalState.sipClientState).toBe(SipClientState.CONNECTED);

    // performAuthentication() runs fire-and-forgotten off the CONNECTED handler —
    // flush its microtask chain (getOfficeToken → exchangeOfficeToken → dispatch)
    // before asserting on the resulting auth state.
    await flushPromises();

    // Post-connection authentication ran against the real authSlice reducer.
    expect(selectAuthToken(_store.getState() as any)).toBe("jwt");
    expect(selectIsAuthenticated(_store.getState() as any)).toBe(true);
  });

  it("does not reach CONNECTED if the server rejects registration permanently", async () => {
    manager = new WebRTCConnectionManager({
      enableAutoReconnect:  false,
      enableIdleDisconnect: false,
    });

    const connectPromise = manager.connect();
    const sipClient = manager.getSipClient();
    const ws = sipClient!.socket as any;

    ws.onopen?.(new Event("open"));
    const registerMsg = ws.send.mock.calls[0][0];
    const callId = extractCallId(registerMsg);

    const forbidden = [
      "SIP/2.0 403 Forbidden",
      "Via: SIP/2.0/WSS sip.test;branch=z9hG4bKserver403",
      `Call-ID: ${callId}`,
      "CSeq: 2 REGISTER",
      "Content-Length: 0",
      "",
      "",
    ].join("\r\n");

    await ws.onmessage!({ data: forbidden } as any);

    try {
      await connectPromise;
    } catch {
      // expected — connect() rejects on FAILED_PERMANENTLY
    }

    const finalState = selectConnectionState(_store.getState() as any);
    expect(finalState.sipClientState).toBe(SipClientState.FAILED_PERMANENTLY);
    expect(finalState.sipClientState).not.toBe(SipClientState.CONNECTED);
  });
});
