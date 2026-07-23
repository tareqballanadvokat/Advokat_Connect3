/* eslint-disable no-undef */
/**
 * Unit Tests for Registration
 *
 * Tests the SIP registration state machine in isolation.
 * - Real TimeoutManager (with fake timers) is used so timer behaviour is verified
 *   without wall-clock delays.
 * - configService is mocked to provide a controlled SIP URI.
 * - Events callbacks (onStateChange, onSuccess, onFailure, onTimeout, onMessageToSend)
 *   are plain jest.fn() mocks.
 */

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

// ─── Config mock ─────────────────────────────────────────────────────────────
jest.mock("@config", () => ({
  configService: {
    getSipConfig: jest.fn(() => ({
      sipUri:          "sip:client@sip.test:5061;transport=wss",
      fromDisplayName: "Client",
      toDisplayName:   "Server",
    })),
    buildSipUri: jest.fn((name: string) => `sip:${name.toLowerCase()}@sip.test:5061;transport=wss`),
  },
}));

import { Registration, RegistrationState } from "@infra/sip/Registration";
import { TimeoutManager }                   from "@infra/sip/TimeoutManager";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvents() {
  return {
    onStateChange:   jest.fn(),
    onSuccess:       jest.fn(),
    onFailure:       jest.fn(),
    onTimeout:       jest.fn(),
    onMessageToSend: jest.fn(),
  };
}

/**
 * Builds a minimal 202 Accepted response that passes Registration's session
 * validation.  callId and clientTag are taken from the Registration instance
 * after getInitialRegistration() has been called (so they are known).
 */
function build202(callId: string, clientTag: string, serverTag = "srv-tag-abc"): string {
  return [
    "SIP/2.0 202 Accepted",
    "Via: SIP/2.0/WSS sip.test;branch=z9hG4bKserver",
    `From: "Server" <sip:server@sip.test;transport=wss>;tag=${serverTag}`,
    `To: "Client" <sip:client@sip.test;transport=wss>;tag=${clientTag}`,
    `Call-ID: ${callId}`,
    "CSeq: 2 REGISTER",
    "Content-Type: application/json",
    "",
    JSON.stringify({ ConnectionTimeout: 30000, PeerRegistrationTimeout: 60000, ReceiveTimeout: 10000 }),
  ].join("\r\n");
}

function buildErrorResponse(
  code: number,
  reason: string,
  callId: string,
  clientTag: string
): string {
  return [
    `SIP/2.0 ${code} ${reason}`,
    "Via: SIP/2.0/WSS sip.test;branch=z9hG4bKserver",
    `From: "Server" <sip:server@sip.test;transport=wss>;tag=srv-tag`,
    `To: "Client" <sip:client@sip.test;transport=wss>;tag=${clientTag}`,
    `Call-ID: ${callId}`,
    `CSeq: 1 REGISTER`,
    "",
    "",
  ].join("\r\n");
}

function buildByeMessage(callId: string, clientTag: string): string {
  return [
    `BYE sip:client@sip.test:5061;transport=wss SIP/2.0`,
    "Via: SIP/2.0/WSS sip.test;branch=z9hG4bKserver",
    `From: "Server" <sip:server@sip.test;transport=wss>;tag=srv-tag`,
    `To: "Client" <sip:client@sip.test;transport=wss>;tag=${clientTag}`,
    `Call-ID: ${callId}`,
    "CSeq: 2 BYE",
    "Reason: REGISTRATION",
    "",
    "",
  ].join("\r\n");
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Registration", () => {
  let manager: TimeoutManager;
  let events:  ReturnType<typeof makeEvents>;
  let reg:     Registration;

  beforeEach(() => {
    jest.useFakeTimers();
    manager = new TimeoutManager();
    events  = makeEvents();
    reg     = new Registration(manager, events);
  });

  afterEach(() => {
    manager.cancelAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Initial state
  // ──────────────────────────────────────────────────────────────────────────

  describe("Initial state", () => {
    it("starts in IDLE state", () => {
      expect(reg.getRegistrationState()).toBe(RegistrationState.IDLE);
    });

    it("isRegistered is false initially", () => {
      expect(reg.isRegistered).toBe(false);
    });

    it("generates non-empty callId, tag, and branch on construction", () => {
      expect(reg.callId).toBeTruthy();
      expect(reg.tag).toBeTruthy();
      expect(reg.branch).toBeTruthy();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getInitialRegistration()
  // ──────────────────────────────────────────────────────────────────────────

  describe("getInitialRegistration()", () => {
    it("returns a string containing 'REGISTER'", () => {
      const msg = reg.getInitialRegistration();
      expect(msg).toContain("REGISTER");
    });

    it("transitions state to REGISTER_SENT", () => {
      reg.getInitialRegistration();
      expect(reg.getRegistrationState()).toBe(RegistrationState.REGISTER_SENT);
    });

    it("emits onStateChange with REGISTER_SENT", () => {
      reg.getInitialRegistration();
      expect(events.onStateChange).toHaveBeenCalledWith(RegistrationState.REGISTER_SENT);
    });

    it("starts the RECEIVE_TIMEOUT timer", () => {
      reg.getInitialRegistration();
      expect(manager.isTimerActive("RECEIVE_TIMEOUT")).toBe(true);
    });

    it("message includes CSeq header with value 1", () => {
      const msg = reg.getInitialRegistration();
      expect(msg).toMatch(/CSeq:\s*1/);
    });

    it("message includes the SIP URI in the Via or Request-URI", () => {
      const msg = reg.getInitialRegistration();
      expect(msg).toContain("sip.test");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // RECEIVE_TIMEOUT expiry
  // ──────────────────────────────────────────────────────────────────────────

  describe("RECEIVE_TIMEOUT expiry", () => {
    it("fires onTimeout with 'RECEIVE_TIMEOUT' when timer expires", () => {
      reg.getInitialRegistration();
      jest.advanceTimersByTime(60_000); // default is 1000ms but minimum enforced to 10000ms from server — use a big advance
      expect(events.onTimeout).toHaveBeenCalledWith("RECEIVE_TIMEOUT");
    });

    it("fires onFailure with isRetryable=true on timeout", () => {
      reg.getInitialRegistration();
      jest.advanceTimersByTime(60_000);
      expect(events.onFailure).toHaveBeenCalledWith(expect.stringContaining("RECEIVE_TIMEOUT"), true);
    });

    it("transitions to FAILED after timeout", () => {
      reg.getInitialRegistration();
      jest.advanceTimersByTime(60_000);
      expect(reg.getRegistrationState()).toBe(RegistrationState.FAILED);
    });

    it("sends a REGISTRATION BYE via onMessageToSend on timeout", () => {
      reg.getInitialRegistration();
      jest.advanceTimersByTime(60_000);
      expect(events.onMessageToSend).toHaveBeenCalledWith(
        expect.stringContaining("BYE"),
        expect.any(String)
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 202 Accepted flow (success path)
  // ──────────────────────────────────────────────────────────────────────────

  describe("202 Accepted flow", () => {
    it("returns an ACK message in response to 202", () => {
      reg.getInitialRegistration();
      const response = reg.parseMessage(build202(reg.callId, reg.tag));
      expect(response).toContain("ACK");
    });

    it("transitions to ACK_3_SENT after receiving 202", () => {
      reg.getInitialRegistration();
      reg.parseMessage(build202(reg.callId, reg.tag));
      expect(reg.getRegistrationState()).toBe(RegistrationState.ACK_3_SENT);
    });

    it("sets isRegistered to true after 202 + ACK", () => {
      reg.getInitialRegistration();
      reg.parseMessage(build202(reg.callId, reg.tag));
      expect(reg.isRegistered).toBe(true);
    });

    it("fires onSuccess with timeout config after 202", () => {
      reg.getInitialRegistration();
      reg.parseMessage(build202(reg.callId, reg.tag));
      expect(events.onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          peerRegistration: expect.any(Number),
          connection:       expect.any(Number),
          receive:          expect.any(Number),
        })
      );
    });

    it("cancels RECEIVE_TIMEOUT after receiving 202", () => {
      reg.getInitialRegistration();
      reg.parseMessage(build202(reg.callId, reg.tag));
      expect(manager.isTimerActive("RECEIVE_TIMEOUT")).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Error responses
  // ──────────────────────────────────────────────────────────────────────────

  describe("Error responses", () => {
    it("fires onFailure with isRetryable=false for 401 Unauthorized", () => {
      reg.getInitialRegistration();
      reg.parseMessage(buildErrorResponse(401, "Unauthorized", reg.callId, reg.tag));
      expect(events.onFailure).toHaveBeenCalledWith(expect.stringContaining("401"), false);
    });

    it("fires onFailure with isRetryable=false for 403 Forbidden", () => {
      reg.getInitialRegistration();
      reg.parseMessage(buildErrorResponse(403, "Forbidden", reg.callId, reg.tag));
      expect(events.onFailure).toHaveBeenCalledWith(expect.stringContaining("403"), false);
    });

    it("fires onFailure with isRetryable=true for 500 Server Error", () => {
      reg.getInitialRegistration();
      reg.parseMessage(buildErrorResponse(500, "Server Error", reg.callId, reg.tag));
      expect(events.onFailure).toHaveBeenCalledWith(expect.stringContaining("500"), true);
    });

    it("transitions to FAILED on any error response", () => {
      reg.getInitialRegistration();
      reg.parseMessage(buildErrorResponse(500, "Server Error", reg.callId, reg.tag));
      expect(reg.getRegistrationState()).toBe(RegistrationState.FAILED);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // REGISTRATION BYE
  // ──────────────────────────────────────────────────────────────────────────

  describe("REGISTRATION BYE received", () => {
    it("fires onFailure when server sends BYE", () => {
      reg.getInitialRegistration();
      reg.parseMessage(buildByeMessage(reg.callId, reg.tag));
      expect(events.onFailure).toHaveBeenCalled();
    });

    it("transitions to FAILED on BYE", () => {
      reg.getInitialRegistration();
      reg.parseMessage(buildByeMessage(reg.callId, reg.tag));
      expect(reg.getRegistrationState()).toBe(RegistrationState.FAILED);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Session validation
  // ──────────────────────────────────────────────────────────────────────────

  describe("Session validation", () => {
    it("ignores messages with a mismatched Call-ID", () => {
      reg.getInitialRegistration();
      const msgWithWrongCallId = build202("wrong-call-id", reg.tag);
      reg.parseMessage(msgWithWrongCallId);
      expect(events.onSuccess).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // resetRegistrationState()
  // ──────────────────────────────────────────────────────────────────────────

  describe("resetRegistrationState()", () => {
    it("returns state to IDLE", () => {
      reg.getInitialRegistration();
      jest.advanceTimersByTime(60_000); // trigger FAILED
      reg.resetRegistrationState();
      expect(reg.getRegistrationState()).toBe(RegistrationState.IDLE);
    });

    it("sets isRegistered to false", () => {
      reg.getInitialRegistration();
      reg.parseMessage(build202(reg.callId, reg.tag)); // sets isRegistered=true
      reg.resetRegistrationState();
      expect(reg.isRegistered).toBe(false);
    });

    it("generates a fresh callId after reset", () => {
      const originalCallId = reg.callId;
      reg.getInitialRegistration();
      reg.resetRegistrationState();
      expect(reg.callId).not.toBe(originalCallId);
    });

    it("cancels any active RECEIVE_TIMEOUT", () => {
      reg.getInitialRegistration();
      expect(manager.isTimerActive("RECEIVE_TIMEOUT")).toBe(true);
      reg.resetRegistrationState();
      expect(manager.isTimerActive("RECEIVE_TIMEOUT")).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getTimeoutConfiguration()
  // ──────────────────────────────────────────────────────────────────────────

  describe("getTimeoutConfiguration()", () => {
    it("returns an object with peerRegistration, connection, receive keys", () => {
      const cfg = reg.getTimeoutConfiguration();
      expect(cfg).toHaveProperty("peerRegistration");
      expect(cfg).toHaveProperty("connection");
      expect(cfg).toHaveProperty("receive");
    });
  });
});
