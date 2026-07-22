/* eslint-disable no-undef */
/**
 * Integration Test — Idle Disconnect Flow
 *
 * Units under test (REAL, not mocked):
 *   IdleActivityMonitor  → real timer-based idle detection
 *   WebRTCConnectionManager → real orchestrator that starts idle monitoring
 *   connectionSlice      → real reducer: sipClientStateChanged, setIdle,
 *                          setDisconnectedDueToIdleAt, updateLastActivity
 *   Redux store          → real configureStore with connectionReducer
 *
 * External boundaries mocked:
 *   initializeSipClient  → returns a mock SipClientInstance; connect() resolves
 *                          immediately when we call manager.onSipClientStateChanged(CONNECTED)
 *   webRTCApiService, WebRTCDataChannelService, PairingApiService, IdleActivityMonitor (logger calls)
 *   @infra/logger
 */

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

// ─── SipClient mock ───────────────────────────────────────────────────────────
const mockSipClient = {
  subscribe:            jest.fn(),
  unsubscribe:          jest.fn(),
  isSubscribed:         jest.fn(() => true),
  disconnect:           jest.fn(),
  send:                 jest.fn(),
  getState:             jest.fn(),
  getDataChannelStatus: jest.fn(() => "none" as const),
  isHealthy:            jest.fn(() => false),
  timeoutManager:       {},
  socket:               { close: jest.fn(), readyState: 1 },
};

jest.mock("@infra/sip/SipClient", () => ({
  initializeSipClient: jest.fn(() => mockSipClient),
  SipClientState: {
    DISCONNECTED:       "DISCONNECTED",
    REGISTERING:        "REGISTERING",
    CONNECTING:         "CONNECTING",
    CONNECTING_P2P:     "CONNECTING_P2P",
    CONNECTED:          "CONNECTED",
    FAILED:             "FAILED",
    FAILED_PERMANENTLY: "FAILED_PERMANENTLY",
  },
}));

// ─── webRTCApiService mock ────────────────────────────────────────────────────
jest.mock("@services/webRTCApiService", () => ({
  webRTCApiService: { initialize: jest.fn(), cleanup: jest.fn() },
}));

// ─── WebRTCDataChannelService mock ────────────────────────────────────────────
jest.mock("@services/WebRTCDataChannelService", () => ({
  WebRTCDataChannelService: {
    getInstance: jest.fn(() => ({
      reset:                   jest.fn(),
      isReadyForCommunication: false,
    })),
  },
}));

// ─── PairingApiService mock ───────────────────────────────────────────────────
jest.mock("@services/PairingApiService", () => ({
  pairingApiService: {
    exchangeOfficeToken: jest.fn(() =>
      Promise.resolve({ access_token: "jwt", expires_in: 3600, refresh_token: null, refresh_token_lifetime: 7200 })
    ),
  },
}));

// ─── Store mock — dynamic getter so each test injects a fresh store ───────────
let _store: ReturnType<typeof buildStore>;
jest.mock("@store", () => ({
  get store() { return _store; },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────
import { configureStore }     from "@reduxjs/toolkit";
import connectionReducer, {
  selectConnectionState,
  sipClientStateChanged,
} from "@slices/connectionSlice";
import authReducer             from "@slices/authSlice";
import {
  WebRTCConnectionManager,
} from "@services/WebRTCConnectionManager";
import { SipClientState }      from "@infra/sip/SipClient";

// ─── Real store factory ───────────────────────────────────────────────────────
function buildStore() {
  return configureStore({
    reducer: { connection: connectionReducer, auth: authReducer },
    middleware: (gd) => gd({ serializableCheck: false }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Integration — Idle Disconnect Flow", () => {
  let manager: WebRTCConnectionManager;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    _store = buildStore();
    (global.WebSocket as any).OPEN       = 1;
    (global.WebSocket as any).CONNECTING = 0;
    (global.WebSocket as any).CLOSING    = 2;
    (global.WebSocket as any).CLOSED     = 3;
  });

  afterEach(async () => {
    // Clean up any pending reconnect timers
    jest.runAllTimers();
    jest.useRealTimers();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Helper: connect the manager by resolving the internal promise via CONNECTED
  // ──────────────────────────────────────────────────────────────────────────
  async function connectManager(idleTimeoutMs = 5_000): Promise<void> {
    manager = new WebRTCConnectionManager({
      idleTimeout:          idleTimeoutMs,
      enableIdleDisconnect: true,
      reconnectOnActivity:  false,   // disable reconnect for simplicity
      enableAutoReconnect:  false,   // disable auto-reconnect for simplicity
    });
    const connectPromise = manager.connect();
    manager.onSipClientStateChanged(SipClientState.CONNECTED, "test");
    await connectPromise;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Idle detection
  // ──────────────────────────────────────────────────────────────────────────

  describe("Idle detection", () => {
    it("marks the store as idle after the configured timeout", async () => {
      await connectManager(5_000);

      jest.advanceTimersByTime(5_001);

      const state = selectConnectionState(_store.getState() as any);
      expect(state.isIdle).toBe(true);
    });

    it("records disconnectedDueToIdleAt timestamp after idle disconnect", async () => {
      await connectManager(5_000);

      jest.advanceTimersByTime(5_001);
      await jest.advanceTimersByTimeAsync(300); // let disconnect() 100ms timer fire

      const state = selectConnectionState(_store.getState() as any);
      expect(state.idleDisconnectedAt).not.toBeNull();
    });

    it("dispatches DISCONNECTED to the store when going idle", async () => {
      await connectManager(5_000);

      jest.advanceTimersByTime(5_001);
      await jest.advanceTimersByTimeAsync(300);

      const state = selectConnectionState(_store.getState() as any);
      expect(state.sipClientState).toBe(SipClientState.DISCONNECTED);
    });

    it("does NOT mark idle before the timeout elapses", async () => {
      await connectManager(5_000);

      jest.advanceTimersByTime(4_999);

      const state = selectConnectionState(_store.getState() as any);
      expect(state.isIdle).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Idle monitoring disabled
  // ──────────────────────────────────────────────────────────────────────────

  describe("Idle monitoring disabled", () => {
    it("does not mark idle when enableIdleDisconnect is false", async () => {
      manager = new WebRTCConnectionManager({
        idleTimeout:          2_000,
        enableIdleDisconnect: false,
        enableAutoReconnect:  false,
      });
      const connectPromise = manager.connect();
      manager.onSipClientStateChanged(SipClientState.CONNECTED, "test");
      await connectPromise;

      jest.advanceTimersByTime(10_000);

      const state = selectConnectionState(_store.getState() as any);
      expect(state.isIdle).toBe(false);
      expect(state.sipClientState).toBe(SipClientState.CONNECTED);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Store state transitions during connect lifecycle
  // ──────────────────────────────────────────────────────────────────────────

  describe("Redux state during connect / disconnect", () => {
    it("store reflects CONNECTED after onSipClientStateChanged(CONNECTED)", async () => {
      await connectManager();

      const state = selectConnectionState(_store.getState() as any);
      expect(state.sipClientState).toBe(SipClientState.CONNECTED);
    });

    it("store reflects DISCONNECTED after explicit disconnect()", async () => {
      await connectManager();

      const disconnectPromise = manager.disconnect();
      await jest.advanceTimersByTimeAsync(300);
      await disconnectPromise;

      const state = selectConnectionState(_store.getState() as any);
      expect(state.sipClientState).toBe(SipClientState.DISCONNECTED);
    });

    it("store reflects FAILED_PERMANENTLY when SipClient reports it", async () => {
      manager = new WebRTCConnectionManager({
        enableAutoReconnect:  false,
        enableIdleDisconnect: false,
      });
      const connectPromise = manager.connect();
      manager.onSipClientStateChanged(SipClientState.FAILED_PERMANENTLY, "test");
      try { await connectPromise; } catch { /* expected */ }

      const state = selectConnectionState(_store.getState() as any);
      expect(state.sipClientState).toBe(SipClientState.FAILED_PERMANENTLY);
    });
  });
});
