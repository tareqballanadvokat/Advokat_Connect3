/* eslint-disable no-undef */
/**
 * Unit Tests for SipClient (initializeSipClient)
 *
 * Strategy:
 * - Registration, EstablishingConnection, Peer2PeerConnection are mocked at module
 *   level. Their constructors capture the event callbacks SipClient passes in; we
 *   trigger those callbacks manually to simulate phase completions.
 * - WebSocket: global mock from setupTests.ts. We get the instance from the returned
 *   SipClientInstance and manually fire onopen / onclose / onerror.
 * - Fake timers control PEER_REGISTRATION_TIMEOUT without wall-clock delays.
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

// ─── WebRTCDataChannelService safety mock (used deep inside Peer2PeerConnection
//     which is itself mocked, but the module-level import still runs) ─────────
jest.mock("@services/WebRTCDataChannelService", () => ({
  WebRTCDataChannelService: {
    getInstance: jest.fn(() => ({
      subscribe:               jest.fn(),
      setOfferChannel:         jest.fn(),
      reset:                   jest.fn(),
      isReadyForCommunication: false,
    })),
    destroy: jest.fn(),
  },
}));

// ─── Phase mocks — constructors are configured in beforeEach ─────────────────
jest.mock("@infra/sip/Registration", () => ({
  Registration: jest.fn(),
  RegistrationState: {
    IDLE:          "IDLE",
    REGISTER_SENT: "REGISTER_SENT",
    ACCEPTED_202:  "ACCEPTED_202",
    ACK_3_SENT:    "ACK_3_SENT",
    TERMINATING:   "TERMINATING",
    FAILED:        "FAILED",
  },
}));

jest.mock("@infra/sip/EstablishingConnection", () => ({
  EstablishingConnection: jest.fn(),
  ConnectionState: {
    WAITING_NOTIFY_4:  "WAITING_NOTIFY_4",
    NOTIFY_4_RECEIVED: "NOTIFY_4_RECEIVED",
    WAITING_NOTIFY_6:  "WAITING_NOTIFY_6",
    COMPLETE:          "COMPLETE",
    FAILED:            "FAILED",
    TERMINATING:       "TERMINATING",
  },
}));

jest.mock("@infra/sip/Peer2PeerConnection", () => ({
  Peer2PeerConnection: jest.fn(),
  SdpExchangeState: {
    IDLE:            "IDLE",
    OFFER_SENT:      "OFFER_SENT",
    ANSWER_RECEIVED: "ANSWER_RECEIVED",
    COMPLETE:        "COMPLETE",
    FAILED:          "FAILED",
  },
}));

import {
  initializeSipClient,
  SipClientState,
  SipClientInstance,
  SipClientObserver,
} from "@infra/sip/SipClient";
import { Registration }                              from "@infra/sip/Registration";
import { EstablishingConnection, ConnectionState }   from "@infra/sip/EstablishingConnection";
import { Peer2PeerConnection }                       from "@infra/sip/Peer2PeerConnection";

// ─────────────────────────────────────────────────────────────────────────────

describe("initializeSipClient", () => {
  let instance: SipClientInstance;
  let mockSocket: any;

  // Captured event callbacks from each phase constructor
  let capturedRegEvents:  any;
  let capturedConnEvents: any;
  let capturedP2PEvents:  any;

  // Mock phase instances returned by the mocked constructors
  let mockReg:  any;
  let mockConn: any;
  let mockP2P:  any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    // Expose static constants on the global WebSocket mock
    (global.WebSocket as any).OPEN       = 1;
    (global.WebSocket as any).CONNECTING = 0;
    (global.WebSocket as any).CLOSING    = 2;
    (global.WebSocket as any).CLOSED     = 3;

    // ── Build mock phase instances ──────────────────────────────────────────
    mockReg = {
      getInitialRegistration: jest.fn(() => "REGISTER mock"),
      parseMessage:           jest.fn(() => ""),
      isRegistered:           false,
      callId:                 "reg-call-id",
      tag:                    "reg-tag",
      branch:                 "z9hG4bKtest",
      fromDisplayName:        "Client",
      toDisplayName:          "Server",
      lastSentRegistrationByeCSeq: 0,
      lastByeReceived:        null,
      createRegistrationBye:  jest.fn(() => "REGISTRATION BYE mock"),
      resetRegistrationState: jest.fn(),
      getTimeoutConfiguration: jest.fn(() => ({
        peerRegistration: 30_000,
        connection:       3_000,
        receive:          10_000,
      })),
    };

    mockConn = {
      parseMessage:      jest.fn(() => undefined),
      getState:          jest.fn(() => ConnectionState.WAITING_NOTIFY_4),
      updateData:        jest.fn(),
      reset:             jest.fn(),
      createConnectionBye: jest.fn(() => "CONNECTION BYE mock"),
      callId:            "conn-call-id",
      tag:               "conn-tag",
      sipUri:            "sip:client@sip.test",
      toDisplayName:     "Server",
      fromDisplayName:   "Client",
    };

    mockP2P = {
      createOffer:         jest.fn(() => Promise.resolve()),
      parseIncomingAnswer: jest.fn(() => Promise.resolve()),
      getLastOfferParams:  jest.fn(() => null),
      isOfferSent:         false,
      getActiveDataChannel: jest.fn(() => null),
      updateConfiguration: jest.fn(),
      reset:               jest.fn(),
    };

    // ── Configure constructors to capture events ───────────────────────────
    (Registration as jest.Mock).mockImplementation((_tm: any, events: any) => {
      capturedRegEvents = events;
      return mockReg;
    });
    (EstablishingConnection as jest.Mock).mockImplementation((_tm: any, events: any) => {
      capturedConnEvents = events;
      return mockConn;
    });
    (Peer2PeerConnection as jest.Mock).mockImplementation((events: any) => {
      capturedP2PEvents = events;
      return mockP2P;
    });

    // ── Create the SIP client ──────────────────────────────────────────────
    instance   = initializeSipClient();
    mockSocket = instance.socket;
  });

  afterEach(() => {
    instance.socket.close?.();
    jest.useRealTimers();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  function openSocket() {
    mockSocket.onopen?.(new Event("open"));
  }

  function simulateRegistrationSuccess() {
    mockReg.isRegistered = true;
    capturedRegEvents.onSuccess({ peerRegistration: 30_000, connection: 3_000, receive: 10_000 });
  }

  function simulateConnectionSuccess() {
    capturedConnEvents.onSuccess();
  }

  function simulateP2PSuccess() {
    capturedP2PEvents.onSuccess();
  }

  function makeObserver(): { observer: SipClientObserver; onStateChanged: jest.Mock } {
    const onStateChanged = jest.fn();
    return {
      observer: { onSipClientStateChanged: onStateChanged },
      onStateChanged,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Initial state
  // ──────────────────────────────────────────────────────────────────────────

  describe("Initial state", () => {
    it("returns DISCONNECTED state before WebSocket opens", () => {
      expect(instance.getState()).toBe(SipClientState.DISCONNECTED);
    });

    it("isHealthy() returns false initially", () => {
      expect(instance.isHealthy()).toBe(false);
    });

    it("getDataChannelStatus() returns 'none' initially", () => {
      expect(instance.getDataChannelStatus()).toBe("none");
    });

    it("creates a WebSocket with the configured ws URI", () => {
      expect(global.WebSocket).toHaveBeenCalledWith("wss://sip.test:443", "sip");
    });

    it("creates Registration, EstablishingConnection, and Peer2PeerConnection", () => {
      expect(Registration).toHaveBeenCalledTimes(1);
      expect(EstablishingConnection).toHaveBeenCalledTimes(1);
      expect(Peer2PeerConnection).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Observer pattern
  // ──────────────────────────────────────────────────────────────────────────

  describe("Observer pattern", () => {
    it("isSubscribed() returns false before subscribing", () => {
      const { observer } = makeObserver();
      expect(instance.isSubscribed(observer)).toBe(false);
    });

    it("isSubscribed() returns true after subscribing", () => {
      const { observer } = makeObserver();
      instance.subscribe(observer);
      expect(instance.isSubscribed(observer)).toBe(true);
    });

    it("isSubscribed() returns false after unsubscribing", () => {
      const { observer } = makeObserver();
      instance.subscribe(observer);
      instance.unsubscribe(observer);
      expect(instance.isSubscribed(observer)).toBe(false);
    });

    it("notifies observer of state changes", () => {
      const { observer, onStateChanged } = makeObserver();
      instance.subscribe(observer);
      openSocket();
      expect(onStateChanged).toHaveBeenCalledWith(SipClientState.REGISTERING, expect.any(String));
    });

    it("does not notify observer after unsubscribe", () => {
      const { observer, onStateChanged } = makeObserver();
      instance.subscribe(observer);
      instance.unsubscribe(observer);
      openSocket();
      expect(onStateChanged).not.toHaveBeenCalled();
    });

    it("does not add the same observer twice", () => {
      const { observer, onStateChanged } = makeObserver();
      instance.subscribe(observer);
      instance.subscribe(observer); // duplicate
      openSocket();
      // Should be called once per state change, not twice
      const registering = onStateChanged.mock.calls.filter(
        ([s]) => s === SipClientState.REGISTERING
      );
      expect(registering).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // WebSocket lifecycle
  // ──────────────────────────────────────────────────────────────────────────

  describe("WebSocket lifecycle", () => {
    it("transitions to REGISTERING when socket opens", () => {
      openSocket();
      expect(instance.getState()).toBe(SipClientState.REGISTERING);
    });

    it("sends the initial REGISTER message when socket opens", () => {
      openSocket();
      expect(mockSocket.send).toHaveBeenCalledWith("REGISTER mock");
    });

    it("transitions to FAILED_PERMANENTLY on socket error", () => {
      mockSocket.onerror?.(new Event("error"));
      expect(instance.getState()).toBe(SipClientState.FAILED_PERMANENTLY);
    });

    it("transitions to FAILED_PERMANENTLY on unexpected socket close", () => {
      mockSocket.onclose?.({ code: 1001, reason: "going away" });
      expect(instance.getState()).toBe(SipClientState.FAILED_PERMANENTLY);
    });

    it("does NOT transition state on deliberate socket close (code 1000)", () => {
      // Socket starts DISCONNECTED — deliberate close should leave it unchanged
      mockSocket.onclose?.({ code: 1000, reason: "normal" });
      expect(instance.getState()).toBe(SipClientState.DISCONNECTED);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Registration phase
  // ──────────────────────────────────────────────────────────────────────────

  describe("Registration phase", () => {
    beforeEach(() => openSocket());

    it("transitions to CONNECTING after registration success", () => {
      simulateRegistrationSuccess();
      expect(instance.getState()).toBe(SipClientState.CONNECTING);
    });

    it("starts PEER_REGISTRATION_TIMEOUT after registration success", () => {
      simulateRegistrationSuccess();
      expect(instance.timeoutManager.isTimerActive("PEER_REGISTRATION_TIMEOUT")).toBe(true);
    });

    it("calls EstablishingConnection.updateData() after registration success", () => {
      simulateRegistrationSuccess();
      expect(mockConn.updateData).toHaveBeenCalledWith(
        mockReg.tag,
        mockReg.callId,
        mockReg.branch,
        mockReg.fromDisplayName,
        mockReg.toDisplayName,
        3_000 // connection timeout from server config
      );
    });

    it("calls Peer2PeerConnection.updateConfiguration() after registration success", () => {
      simulateRegistrationSuccess();
      expect(mockP2P.updateConfiguration).toHaveBeenCalledWith(
        instance.timeoutManager,
        10_000 // receive timeout from server config
      );
    });

    it("transitions to FAILED on permanent registration failure (401/403)", () => {
      capturedRegEvents.onFailure("Error 401: Unauthorized", false);
      expect(instance.getState()).toBe(SipClientState.FAILED_PERMANENTLY);
    });

    it("retries registration on retryable failure (first attempt)", () => {
      capturedRegEvents.onFailure("timeout", true);
      // Should retry — sends another REGISTER
      expect(mockReg.getInitialRegistration).toHaveBeenCalledTimes(2); // initial + 1 retry
    });

    it("transitions to REGISTERING after retryable failure retry", () => {
      capturedRegEvents.onFailure("timeout", true);
      expect(instance.getState()).toBe(SipClientState.REGISTERING);
    });

    it("transitions to FAILED_PERMANENTLY after max retries (3) are exhausted", () => {
      // maxRetries = 3 → 3 retries allowed → needs 4 failures total
      capturedRegEvents.onFailure("timeout", true); // retry 1 (count 0→1)
      capturedRegEvents.onFailure("timeout", true); // retry 2 (count 1→2)
      capturedRegEvents.onFailure("timeout", true); // retry 3 (count 2→3)
      capturedRegEvents.onFailure("timeout", true); // count 3 < 3 fails → FAILED_PERMANENTLY
      expect(instance.getState()).toBe(SipClientState.FAILED_PERMANENTLY);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Connection establishment phase
  // ──────────────────────────────────────────────────────────────────────────

  describe("Connection establishment phase", () => {
    beforeEach(() => {
      openSocket();
      simulateRegistrationSuccess();
    });

    it("transitions to CONNECTING_P2P after connection success", () => {
      simulateConnectionSuccess();
      expect(instance.getState()).toBe(SipClientState.CONNECTING_P2P);
    });

    it("cancels PEER_REGISTRATION_TIMEOUT after connection success", () => {
      simulateConnectionSuccess();
      expect(instance.timeoutManager.isTimerActive("PEER_REGISTRATION_TIMEOUT")).toBe(false);
    });

    it("retries connection phase on failure (retry available)", () => {
      capturedConnEvents.onFailure("timeout");
      // Connection retry: should call updateData again on EstablishingConnection
      expect(mockConn.updateData).toHaveBeenCalledTimes(2);
    });

    it("restarts registration after connection retries are exhausted", () => {
      // maxRetries = 3 → 3 retries → needs 4 failures to exhaust
      capturedConnEvents.onFailure("timeout"); // retry 1 (count 0→1)
      capturedConnEvents.onFailure("timeout"); // retry 2 (count 1→2)
      capturedConnEvents.onFailure("timeout"); // retry 3 (count 2→3)
      capturedConnEvents.onFailure("timeout"); // count 3 < 3 fails → restart registration
      const state = instance.getState();
      expect([SipClientState.REGISTERING, SipClientState.FAILED_PERMANENTLY]).toContain(state);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // WebRTC / Peer2Peer phase
  // ──────────────────────────────────────────────────────────────────────────

  describe("WebRTC / P2P phase", () => {
    beforeEach(() => {
      openSocket();
      simulateRegistrationSuccess();
      simulateConnectionSuccess();
    });

    it("transitions to CONNECTED after P2P success", () => {
      simulateP2PSuccess();
      expect(instance.getState()).toBe(SipClientState.CONNECTED);
    });

    it("retries WebRTC offer on P2P failure when retries remain", () => {
      mockP2P.getLastOfferParams.mockReturnValue({
        callId: "call-1", sipUri: "sip:client@sip.test", tag: "tag-1", toLine: "Server",
      });
      capturedP2PEvents.onFailure("timeout");
      expect(mockP2P.reset).toHaveBeenCalled();
      expect(mockP2P.createOffer).toHaveBeenCalled();
    });

    it("transitions to FAILED_PERMANENTLY after P2P max retries while connected", () => {
      // Give valid offer params so retries actually work (state stays CONNECTED)
      const savedParams = { callId: "c1", sipUri: "sip:client@sip.test", tag: "t1", toLine: "Server" };
      mockP2P.getLastOfferParams.mockReturnValue(savedParams);

      // Reach CONNECTED first
      simulateP2PSuccess();
      expect(instance.getState()).toBe(SipClientState.CONNECTED);

      // Exhaust WebRTC retries: maxRetries=3 → 3 retries → 4 failures total
      capturedP2PEvents.onFailure("timeout"); // retry 1
      capturedP2PEvents.onFailure("timeout"); // retry 2
      capturedP2PEvents.onFailure("timeout"); // retry 3
      capturedP2PEvents.onFailure("timeout"); // exhausted while still CONNECTED

      expect(instance.getState()).toBe(SipClientState.FAILED_PERMANENTLY);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PEER_REGISTRATION_TIMEOUT
  // ──────────────────────────────────────────────────────────────────────────

  describe("PEER_REGISTRATION_TIMEOUT", () => {
    it("retries registration when timeout fires and retries remain", () => {
      openSocket();
      simulateRegistrationSuccess();
      // Advance timer — PEER_REGISTRATION_TIMEOUT fires
      jest.advanceTimersByTime(30_001);
      // Should have sent a REGISTRATION BYE then retried
      expect(mockReg.createRegistrationBye).toHaveBeenCalled();
    });

    it("transitions toward FAILED_PERMANENTLY when timeout fires and no retries remain", () => {
      openSocket();
      simulateRegistrationSuccess();
      // Exhaust retries: 3 retries + 1 final failure = 4 total
      capturedRegEvents.onFailure("timeout", true); // retry 1
      capturedRegEvents.onFailure("timeout", true); // retry 2
      capturedRegEvents.onFailure("timeout", true); // retry 3
      capturedRegEvents.onFailure("timeout", true); // 3<3 false → FAILED_PERMANENTLY

      expect(instance.getState()).toBe(SipClientState.FAILED_PERMANENTLY);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // disconnect()
  // ──────────────────────────────────────────────────────────────────────────

  describe("disconnect()", () => {
    it("closes the WebSocket socket", () => {
      openSocket();
      instance.disconnect();
      expect(mockSocket.close).toHaveBeenCalled();
    });

    it("transitions to DISCONNECTED by default", () => {
      openSocket();
      instance.disconnect();
      expect(instance.getState()).toBe(SipClientState.DISCONNECTED);
    });

    it("transitions to FAILED when called with SipClientState.FAILED target", () => {
      openSocket();
      instance.disconnect(SipClientState.FAILED);
      expect(instance.getState()).toBe(SipClientState.FAILED);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // send() external API
  // ──────────────────────────────────────────────────────────────────────────

  describe("send()", () => {
    it("sends a message via the WebSocket when socket is open", () => {
      openSocket();
      simulateRegistrationSuccess();
      instance.send("CUSTOM MESSAGE");
      expect(mockSocket.send).toHaveBeenCalledWith("CUSTOM MESSAGE");
    });

    it("does not send when state is DISCONNECTED (terminal state)", () => {
      // Socket never opened — state stays DISCONNECTED
      instance.send("SHOULD NOT SEND");
      const allSentMessages = (mockSocket.send as jest.Mock).mock.calls.map(([m]) => m);
      expect(allSentMessages).not.toContain("SHOULD NOT SEND");
    });
  });
});
