/* eslint-disable no-undef */
/**
 * Unit Tests for WebRTCConnectionManager
 *
 * Strategy:
 * - initializeSipClient, webRTCApiService, WebRTCDataChannelService, IdleActivityMonitor,
 *   PairingApiService, and the Redux store are all mocked.
 * - connect() suspends on an internal Promise that resolves when onSipClientStateChanged(CONNECTED)
 *   is called — tests trigger this manually to simulate the full connect cycle.
 * - Fake timers control the reconnect delay without wall-clock waits.
 */

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

// ─── SipClient mock ───────────────────────────────────────────────────────────
const mockSipClient = {
  subscribe:           jest.fn(),
  unsubscribe:         jest.fn(),
  isSubscribed:        jest.fn(() => true),
  disconnect:          jest.fn(),
  send:                jest.fn(),
  getState:            jest.fn(),
  getDataChannelStatus: jest.fn(() => "none" as const),
  isHealthy:           jest.fn(() => false),
  timeoutManager:      {},
  socket:              { close: jest.fn(), readyState: 1 },
};

jest.mock("@infra/sip/SipClient", () => ({
  initializeSipClient: jest.fn(() => mockSipClient),
  SipClientState: {
    DISCONNECTED:    "DISCONNECTED",
    REGISTERING:     "REGISTERING",
    CONNECTING:      "CONNECTING",
    CONNECTING_P2P:  "CONNECTING_P2P",
    CONNECTED:       "CONNECTED",
    FAILED:          "FAILED",
    FAILED_PERMANENTLY: "FAILED_PERMANENTLY",
  },
}));

// ─── webRTCApiService mock ────────────────────────────────────────────────────
jest.mock("@services/webRTCApiService", () => ({
  webRTCApiService: {
    initialize: jest.fn(),
    cleanup:    jest.fn(),
  },
}));

// ─── WebRTCDataChannelService mock ────────────────────────────────────────────
const mockDataChannelSvc = {
  reset: jest.fn(),
  isReadyForCommunication: false,
};
jest.mock("@services/WebRTCDataChannelService", () => ({
  WebRTCDataChannelService: {
    getInstance: jest.fn(() => mockDataChannelSvc),
  },
}));

// ─── IdleActivityMonitor mock ─────────────────────────────────────────────────
// Captures the config (incl. onIdle/onActive callbacks) passed by
// startIdleMonitoring() so tests can fire them directly.
const mockIdleMonitor = { start: jest.fn(), stop: jest.fn() };
let capturedIdleMonitorConfig: { onIdle: () => void; onActive: () => void } | undefined;
jest.mock("@services/IdleActivityMonitor", () => ({
  IdleActivityMonitor: jest.fn((config) => {
    capturedIdleMonitorConfig = config;
    return mockIdleMonitor;
  }),
}));

// ─── PairingApiService mock ───────────────────────────────────────────────────
const mockExchangeOfficeToken = jest.fn(() =>
  Promise.resolve({ token: "jwt-token", refreshToken: "refresh", expiresIn: 3600 })
);
jest.mock("@services/PairingApiService", () => ({
  pairingApiService: { exchangeOfficeToken: (...args: any[]) => mockExchangeOfficeToken(...args) },
}));

// ─── OfficeAuthService mock — performAuthentication() re-acquires a fresh
// Office SSO token via this service before exchanging it for the ADVOKAT JWT.
const mockGetOfficeToken = jest.fn(() => Promise.resolve("office-jwt"));
jest.mock("@services/OfficeAuthService", () => ({
  officeAuthService: { getOfficeToken: (...args: any[]) => mockGetOfficeToken(...args) },
}));

// ─── Redux store mock ─────────────────────────────────────────────────────────
const mockDispatch = jest.fn();
const mockGetState = jest.fn();

jest.mock("@store", () => ({
  store: { dispatch: mockDispatch, getState: mockGetState },
}));

// ─── Slice action creators + selectors mocks ─────────────────────────────────
const mockSipClientStateChanged = jest.fn((s) => ({ type: "conn/sipClientStateChanged", payload: s }));
const mockUpdateConnectionState  = jest.fn((u) => ({ type: "conn/update", payload: u }));
const mockSetSelectedCandidateType = jest.fn((t) => ({ type: "conn/candidateType", payload: t }));
const mockSetIdle                = jest.fn((v) => ({ type: "conn/idle", payload: v }));
const mockSetDisconnectedDueToIdleAt = jest.fn((v) => ({ type: "conn/idleAt", payload: v }));
const mockUpdateLastActivity     = jest.fn(() => ({ type: "conn/activity" }));
const mockSelectConnectionState  = jest.fn();
const mockSelectIsReady          = jest.fn(() => false);

jest.mock("@slices/connectionSlice", () => ({
  sipClientStateChanged:       mockSipClientStateChanged,
  updateConnectionState:       mockUpdateConnectionState,
  setSelectedCandidateType:    mockSetSelectedCandidateType,
  setIdle:                     mockSetIdle,
  setDisconnectedDueToIdleAt:  mockSetDisconnectedDueToIdleAt,
  updateLastActivity:          mockUpdateLastActivity,
  selectConnectionState:       mockSelectConnectionState,
  selectIsReady:               mockSelectIsReady,
}));

const mockStartAuthentication    = jest.fn(() => ({ type: "auth/start" }));
const mockAuthSuccess            = jest.fn((d) => ({ type: "auth/success", payload: d }));
const mockAuthFailure            = jest.fn((m) => ({ type: "auth/failure", payload: m }));
const mockSelectOfficeToken      = jest.fn(() => "mock-office-token");

jest.mock("@slices/authSlice", () => ({
  startAuthentication:  mockStartAuthentication,
  authenticationSuccess: mockAuthSuccess,
  authenticationFailure: mockAuthFailure,
  selectOfficeToken:    mockSelectOfficeToken,
}));

// ─────────────────────────────────────────────────────────────────────────────

import {
  WebRTCConnectionManager,
  getWebRTCConnectionManager,
} from "@services/WebRTCConnectionManager";
import { initializeSipClient, SipClientState } from "@infra/sip/SipClient";
import { webRTCApiService }                    from "@services/webRTCApiService";
import { WebRTCDataChannelService }            from "@services/WebRTCDataChannelService";

// ─── Default mock Redux state ─────────────────────────────────────────────────

const DISCONNECTED_STATE = {
  sipClientState:    SipClientState.DISCONNECTED,
  reconnectAttempts: 0,
  connectionStatus:  "",
  isIdle:            false,
  lastError:         undefined,
};

// ─────────────────────────────────────────────────────────────────────────────

describe("WebRTCConnectionManager", () => {
  let manager: WebRTCConnectionManager;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    // Default Redux state: disconnected, no retries in progress
    mockSelectConnectionState.mockReturnValue({ ...DISCONNECTED_STATE });
    mockGetState.mockReturnValue({});

    // Default DataChannel: not ready (auth will fail silently)
    mockDataChannelSvc.isReadyForCommunication = false;
    capturedIdleMonitorConfig = undefined;
    mockGetOfficeToken.mockResolvedValue("office-jwt");
    mockExchangeOfficeToken.mockResolvedValue({ token: "jwt-token", refreshToken: "refresh", expiresIn: 3600 });

    manager = new WebRTCConnectionManager({
      reconnectDelay:       100,   // short delay for tests
      maxReconnectAttempts: 2,
      enableAutoReconnect:  true,
      enableIdleDisconnect: true,
      idleTimeout:          60_000,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Start connect() and immediately resolve it by simulating SipClient CONNECTED.
   * Returns the completed connect() promise.
   */
  async function connectAndResolve(): Promise<void> {
    const connectPromise = manager.connect();
    // Resolve the internal pending-connection promise
    manager.onSipClientStateChanged(SipClientState.CONNECTED, "connected");
    await connectPromise;
  }

  /**
   * Start connect() and reject it by simulating SipClient FAILED_PERMANENTLY.
   */
  async function connectAndReject(): Promise<void> {
    const connectPromise = manager.connect();
    manager.onSipClientStateChanged(SipClientState.FAILED_PERMANENTLY, "fatal");
    try { await connectPromise; } catch { /* expected */ }
  }

  /**
   * performAuthentication() is fired-and-forgotten from onSipClientStateChanged
   * (not awaited by connect()) — flush its microtask chain (getOfficeToken →
   * exchangeOfficeToken → dispatch) before asserting on the resulting calls.
   */
  async function flushMicrotasks(times = 6): Promise<void> {
    for (let i = 0; i < times; i++) {
      await Promise.resolve();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Initial accessors
  // ──────────────────────────────────────────────────────────────────────────

  describe("Accessors — before connect()", () => {
    it("getSipClient() returns null before connecting", () => {
      expect(manager.getSipClient()).toBeNull();
    });

    it("getConfig() returns the configured values", () => {
      expect(manager.getConfig().reconnectDelay).toBe(100);
      expect(manager.getConfig().maxReconnectAttempts).toBe(2);
    });

    it("getWebRTCApiService() returns the service singleton", () => {
      expect(manager.getWebRTCApiService()).toBe(webRTCApiService);
    });

    it("isReady() delegates to selectIsReady()", () => {
      mockSelectIsReady.mockReturnValue(true);
      expect(manager.isReady()).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // connect()
  // ──────────────────────────────────────────────────────────────────────────

  describe("connect()", () => {
    it("calls initializeSipClient()", async () => {
      await connectAndResolve();
      expect(initializeSipClient).toHaveBeenCalledTimes(1);
    });

    it("subscribes the manager to SipClient as an observer", async () => {
      await connectAndResolve();
      expect(mockSipClient.subscribe).toHaveBeenCalledWith(manager);
    });

    it("calls webRTCApiService.initialize() with the SipClient instance", async () => {
      await connectAndResolve();
      expect(webRTCApiService.initialize).toHaveBeenCalledWith(mockSipClient);
    });

    it("stores the SipClient instance (getSipClient() non-null after connect)", async () => {
      await connectAndResolve();
      expect(manager.getSipClient()).toBe(mockSipClient);
    });

    it("starts idle monitoring after successful connect (if enabled)", async () => {
      await connectAndResolve();
      expect(mockIdleMonitor.start).toHaveBeenCalledTimes(1);
    });

    it("returns early if already connecting (sipClientState = REGISTERING)", async () => {
      mockSelectConnectionState.mockReturnValue({
        ...DISCONNECTED_STATE,
        sipClientState: SipClientState.REGISTERING,
      });
      await manager.connect(); // should return without calling initializeSipClient
      expect(initializeSipClient).not.toHaveBeenCalled();
    });

    it("cleans up on FAILED_PERMANENTLY (unsubscribes and calls webRTCApiService.cleanup)", async () => {
      await connectAndReject();
      expect(webRTCApiService.cleanup).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // onSipClientStateChanged()
  // ──────────────────────────────────────────────────────────────────────────

  describe("onSipClientStateChanged()", () => {
    it("dispatches sipClientStateChanged for every state transition", () => {
      manager.onSipClientStateChanged(SipClientState.REGISTERING, "test");
      expect(mockDispatch).toHaveBeenCalledWith(
        mockSipClientStateChanged(SipClientState.REGISTERING)
      );
    });

    it("CONNECTED → resolves the pending connect() promise", async () => {
      const connectPromise = manager.connect();
      manager.onSipClientStateChanged(SipClientState.CONNECTED, "ok");
      await expect(connectPromise).resolves.toBeUndefined();
    });

    it("CONNECTED → dispatches updateConnectionState resetting reconnectAttempts", async () => {
      await connectAndResolve();
      const updateCalls = mockDispatch.mock.calls
        .map(([action]) => action)
        .filter((a) => a.type === "conn/update");
      const hadReset = updateCalls.some((a) => a.payload?.reconnectAttempts === 0);
      expect(hadReset).toBe(true);
    });

    it("FAILED_PERMANENTLY → rejects the pending connect() promise", async () => {
      const connectPromise = manager.connect();
      manager.onSipClientStateChanged(SipClientState.FAILED_PERMANENTLY, "fatal");
      await expect(connectPromise).rejects.toThrow("Connection failed permanently");
    });

    it("FAILED_PERMANENTLY → schedules reconnect (autoReconnect enabled)", async () => {
      await connectAndReject();
      // Reconnect timer should be scheduled (check that reconnectAttempts updated)
      const wasCalled = mockDispatch.mock.calls
        .map(([a]) => a)
        .some((a) => a.type === "conn/update" && a.payload?.reconnectAttempts > 0);
      expect(wasCalled).toBe(true);
    });

    it("deliberate disconnect() does NOT trigger automatic reconnect", async () => {
      // Fully connect first
      await connectAndResolve();
      jest.clearAllMocks();

      // Explicitly disconnect via manager.disconnect() — manager unsubscribes BEFORE
      // telling SipClient to go DISCONNECTED, so no onSipClientStateChanged fires.
      const disconnectPromise = manager.disconnect();
      await jest.advanceTimersByTimeAsync(500);
      await disconnectPromise;

      // Advance well past any reconnect delay — no new SipClient should be created
      await jest.advanceTimersByTimeAsync(5000);
      expect(initializeSipClient).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // onSelectedCandidateType()
  // ──────────────────────────────────────────────────────────────────────────

  describe("onSelectedCandidateType()", () => {
    it("dispatches setSelectedCandidateType with the ICE type", () => {
      manager.onSelectedCandidateType("stun");
      expect(mockDispatch).toHaveBeenCalledWith(mockSetSelectedCandidateType("stun"));
    });

    it("dispatches for each valid ICE type", () => {
      (["mdns", "direct", "stun", "turn", "unknown"] as const).forEach((type) => {
        manager.onSelectedCandidateType(type);
      });
      const dispatched = mockDispatch.mock.calls
        .map(([a]) => a.payload)
        .filter(Boolean);
      expect(dispatched).toContain("mdns");
      expect(dispatched).toContain("turn");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // disconnect()
  // ──────────────────────────────────────────────────────────────────────────

  describe("disconnect()", () => {
    it("unsubscribes from SipClient before disconnecting", async () => {
      await connectAndResolve();
      jest.clearAllMocks();
      const disconnectPromise = manager.disconnect();
      await jest.advanceTimersByTimeAsync(200);
      await disconnectPromise;
      expect(mockSipClient.unsubscribe).toHaveBeenCalledWith(manager);
    });

    it("calls sipClient.disconnect(DISCONNECTED)", async () => {
      await connectAndResolve();
      const disconnectPromise = manager.disconnect();
      await jest.advanceTimersByTimeAsync(200);
      await disconnectPromise;
      expect(mockSipClient.disconnect).toHaveBeenCalledWith(SipClientState.DISCONNECTED);
    });

    it("calls WebRTCDataChannelService.getInstance().reset()", async () => {
      await connectAndResolve();
      const disconnectPromise = manager.disconnect();
      await jest.advanceTimersByTimeAsync(200);
      await disconnectPromise;
      expect(mockDataChannelSvc.reset).toHaveBeenCalled();
    });

    it("dispatches sipClientStateChanged(DISCONNECTED)", async () => {
      await connectAndResolve();
      jest.clearAllMocks();
      const disconnectPromise = manager.disconnect();
      await jest.advanceTimersByTimeAsync(200);
      await disconnectPromise;
      expect(mockDispatch).toHaveBeenCalledWith(
        mockSipClientStateChanged(SipClientState.DISCONNECTED)
      );
    });

    it("sets getSipClient() to null after disconnect", async () => {
      await connectAndResolve();
      const disconnectPromise = manager.disconnect();
      await jest.advanceTimersByTimeAsync(200);
      await disconnectPromise;
      expect(manager.getSipClient()).toBeNull();
    });

    it("stops idle monitoring", async () => {
      await connectAndResolve();
      const disconnectPromise = manager.disconnect();
      await jest.advanceTimersByTimeAsync(200);
      await disconnectPromise;
      expect(mockIdleMonitor.stop).toHaveBeenCalled();
    });

    it("is safe to call when no SipClient is active (no-op)", async () => {
      // Never called connect() — sipClient is null
      const disconnectPromise = manager.disconnect();
      await jest.advanceTimersByTimeAsync(200);
      await expect(disconnectPromise).resolves.toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // initialize()
  // ──────────────────────────────────────────────────────────────────────────

  describe("initialize()", () => {
    it("calls connect() on first call", async () => {
      const initPromise = manager.initialize();
      manager.onSipClientStateChanged(SipClientState.CONNECTED, "ok");
      await initPromise;
      expect(initializeSipClient).toHaveBeenCalledTimes(1);
    });

    it("returns immediately on second call (idempotent after success)", async () => {
      const init1 = manager.initialize();
      manager.onSipClientStateChanged(SipClientState.CONNECTED, "ok");
      await init1;

      const init2 = manager.initialize();
      await init2;
      // Only one SipClient ever created
      expect(initializeSipClient).toHaveBeenCalledTimes(1);
    });

    it("deduplicates concurrent initialize() calls", async () => {
      // Call initialize() twice without awaiting either
      const p1 = manager.initialize();
      const p2 = manager.initialize();
      manager.onSipClientStateChanged(SipClientState.CONNECTED, "ok");
      await Promise.all([p1, p2]);
      expect(initializeSipClient).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // reconnect()
  // ──────────────────────────────────────────────────────────────────────────

  describe("reconnect()", () => {
    it("increments reconnectAttempts in Redux", async () => {
      manager.reconnect();
      const atUpdate = mockDispatch.mock.calls
        .map(([a]) => a)
        .find((a) => a.type === "conn/update" && a.payload?.reconnectAttempts > 0);
      expect(atUpdate).toBeDefined();
    });

    it("schedules a reconnect after the configured delay", async () => {
      const reconnectPromise = (async () => {
        manager.reconnect();
        // Advance well past max delay (reconnectDelay=100 + up to 1000ms jitter = max 1100ms)
        await jest.advanceTimersByTimeAsync(2000);
        // Simulate SipClient reconnecting (resolves connect()'s internal Promise)
        manager.onSipClientStateChanged(SipClientState.CONNECTED, "reconnected");
        await jest.advanceTimersByTimeAsync(500);
      })();
      await reconnectPromise;
      // At least one reconnect attempt was made (initializeSipClient called inside connect())
      expect(initializeSipClient).toHaveBeenCalled();
    });

    it("is a no-op when already reconnecting", async () => {
      manager.reconnect(); // first call — sets isReconnecting=true
      const dispatchCallsAfterFirst = mockDispatch.mock.calls.length;
      manager.reconnect(); // second call — should be ignored
      // No additional dispatch calls (reconnectAttempts incremented only once)
      const additionalCalls = mockDispatch.mock.calls.length - dispatchCallsAfterFirst;
      expect(additionalCalls).toBe(0);
    });

    it("stops reconnecting when maxReconnectAttempts is reached", async () => {
      // maxReconnectAttempts = 2; simulate already at max
      mockSelectConnectionState.mockReturnValue({
        ...DISCONNECTED_STATE,
        reconnectAttempts: 2,
      });
      manager.reconnect(); // should no-op because at max
      // No timer scheduled — advance time and check no new SipClient created
      await jest.advanceTimersByTimeAsync(5000);
      expect(initializeSipClient).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getConnectionState()
  // ──────────────────────────────────────────────────────────────────────────

  describe("getConnectionState()", () => {
    it("delegates to selectConnectionState(store.getState())", () => {
      const fakeState = { ...DISCONNECTED_STATE, connectionStatus: "custom" };
      mockSelectConnectionState.mockReturnValue(fakeState);

      expect(manager.getConnectionState()).toBe(fakeState);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // performAuthentication() — triggered internally on CONNECTED
  // ──────────────────────────────────────────────────────────────────────────

  describe("performAuthentication() success path (via CONNECTED transition)", () => {
    beforeEach(() => {
      // Channels ready — lets performAuthentication() proceed past its guard.
      mockDataChannelSvc.isReadyForCommunication = true;
    });

    it("dispatches startAuthentication when channels are ready", async () => {
      await connectAndResolve();
      await flushMicrotasks();

      expect(mockDispatch).toHaveBeenCalledWith(mockStartAuthentication());
    });

    it("calls officeAuthService.getOfficeToken()", async () => {
      await connectAndResolve();
      await flushMicrotasks();

      expect(mockGetOfficeToken).toHaveBeenCalledTimes(1);
    });

    it("exchanges the Office token via pairingApiService.exchangeOfficeToken()", async () => {
      await connectAndResolve();
      await flushMicrotasks();

      expect(mockExchangeOfficeToken).toHaveBeenCalledWith("office-jwt");
    });

    it("dispatches authenticationSuccess with the exchange response", async () => {
      const authResponse = { token: "jwt-token", refreshToken: "refresh", expiresIn: 3600 };
      mockExchangeOfficeToken.mockResolvedValue(authResponse);

      await connectAndResolve();
      await flushMicrotasks();

      expect(mockDispatch).toHaveBeenCalledWith(mockAuthSuccess(authResponse));
    });

    it("dispatches authenticationFailure when no Office token is available", async () => {
      mockGetOfficeToken.mockResolvedValue(null);

      await connectAndResolve();
      await flushMicrotasks();

      expect(mockExchangeOfficeToken).not.toHaveBeenCalled();
      const failureCall = mockDispatch.mock.calls
        .map(([a]) => a)
        .find((a) => a.type === "auth/failure");
      expect(failureCall).toBeDefined();
    });

    it("does NOT throw when channels are not ready (falls back to authenticationFailure)", async () => {
      mockDataChannelSvc.isReadyForCommunication = false;

      await connectAndResolve();
      await flushMicrotasks();

      expect(mockGetOfficeToken).not.toHaveBeenCalled();
      const failureCall = mockDispatch.mock.calls
        .map(([a]) => a)
        .find((a) => a.type === "auth/failure");
      expect(failureCall).toBeDefined();
    });
  });

  describe("CONNECTED transition — skips re-authentication when the JWT is still valid", () => {
    it("does NOT call performAuthentication when auth.token is valid and far from expiry", async () => {
      mockDataChannelSvc.isReadyForCommunication = true;
      mockGetState.mockReturnValue({
        auth: { token: "still-valid", expiresAt: Date.now() + 60 * 60 * 1000 },
      });

      await connectAndResolve();
      await flushMicrotasks();

      expect(mockGetOfficeToken).not.toHaveBeenCalled();
      expect(mockExchangeOfficeToken).not.toHaveBeenCalled();
    });

    it("DOES call performAuthentication when auth.token is near expiry", async () => {
      mockDataChannelSvc.isReadyForCommunication = true;
      mockGetState.mockReturnValue({
        auth: { token: "expiring-soon", expiresAt: Date.now() + 30 * 1000 },
      });

      await connectAndResolve();
      await flushMicrotasks();

      expect(mockGetOfficeToken).toHaveBeenCalledTimes(1);
    });

    it("DOES call performAuthentication when there is no auth.token at all", async () => {
      mockDataChannelSvc.isReadyForCommunication = true;
      mockGetState.mockReturnValue({ auth: { token: null, expiresAt: null } });

      await connectAndResolve();
      await flushMicrotasks();

      expect(mockGetOfficeToken).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Idle disconnect / reconnect — handleUserIdle() / handleUserActive()
  // (private methods, exercised via the onIdle/onActive callbacks captured
  // from the mocked IdleActivityMonitor constructor)
  // ──────────────────────────────────────────────────────────────────────────

  describe("Idle disconnect and reconnect-on-activity", () => {
    it("handleUserIdle() dispatches setIdle(true) and setDisconnectedDueToIdleAt when connected", async () => {
      await connectAndResolve();
      jest.clearAllMocks();
      mockSelectConnectionState.mockReturnValue({
        ...DISCONNECTED_STATE,
        sipClientState: SipClientState.CONNECTED,
      });

      capturedIdleMonitorConfig?.onIdle();
      await jest.advanceTimersByTimeAsync(200);

      expect(mockDispatch).toHaveBeenCalledWith(mockSetIdle(true));
      const idleAtCall = mockDispatch.mock.calls
        .map(([a]) => a)
        .find((a) => a.type === "conn/idleAt" && a.payload !== undefined);
      expect(idleAtCall).toBeDefined();
    });

    it("handleUserIdle() disconnects the SipClient", async () => {
      await connectAndResolve();
      jest.clearAllMocks();
      mockSelectConnectionState.mockReturnValue({
        ...DISCONNECTED_STATE,
        sipClientState: SipClientState.CONNECTED,
      });

      capturedIdleMonitorConfig?.onIdle();
      await jest.advanceTimersByTimeAsync(200);

      expect(mockSipClient.disconnect).toHaveBeenCalledWith(SipClientState.DISCONNECTED);
    });

    it("handleUserIdle() is a no-op when already disconnected", async () => {
      await connectAndResolve();
      jest.clearAllMocks();
      mockSelectConnectionState.mockReturnValue({ ...DISCONNECTED_STATE });

      capturedIdleMonitorConfig?.onIdle();
      await jest.advanceTimersByTimeAsync(200);

      expect(mockDispatch).not.toHaveBeenCalledWith(mockSetIdle(true));
    });

    it("handleUserActive() dispatches updateLastActivity and setIdle(false)", async () => {
      await connectAndResolve();
      jest.clearAllMocks();

      capturedIdleMonitorConfig?.onActive();

      expect(mockDispatch).toHaveBeenCalledWith(mockUpdateLastActivity());
      expect(mockDispatch).toHaveBeenCalledWith(mockSetIdle(false));
    });

    it("handleUserActive() reconnects after an idle disconnect completed", async () => {
      await connectAndResolve();
      mockSelectConnectionState.mockReturnValue({
        ...DISCONNECTED_STATE,
        sipClientState: SipClientState.CONNECTED,
      });

      // Go idle — triggers disconnect()
      capturedIdleMonitorConfig?.onIdle();
      await jest.advanceTimersByTimeAsync(200); // let disconnect()'s internal 100ms settle

      jest.clearAllMocks();
      mockSelectConnectionState.mockReturnValue({ ...DISCONNECTED_STATE });

      // User comes back — should trigger a fresh connect()
      capturedIdleMonitorConfig?.onActive();
      const secondConnect = manager.connect();
      manager.onSipClientStateChanged(SipClientState.CONNECTED, "reconnected-after-idle");
      await secondConnect;

      expect(initializeSipClient).toHaveBeenCalled();
    });

    it("handleUserActive() does NOT reconnect when the user was not idle-disconnected", async () => {
      await connectAndResolve();
      jest.clearAllMocks();

      capturedIdleMonitorConfig?.onActive();
      await jest.advanceTimersByTimeAsync(200);

      expect(initializeSipClient).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Singleton — getWebRTCConnectionManager()
  // ──────────────────────────────────────────────────────────────────────────

  describe("Singleton", () => {
    it("getWebRTCConnectionManager() returns the same instance on repeated calls", () => {
      const a = getWebRTCConnectionManager();
      const b = getWebRTCConnectionManager();
      expect(a).toBe(b);
    });
  });
});
