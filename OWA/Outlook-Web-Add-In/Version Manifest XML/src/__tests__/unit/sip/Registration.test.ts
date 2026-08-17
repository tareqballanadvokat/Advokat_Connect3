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

function buildNotify(callId: string, clientTag: string): string {
  return [
    `NOTIFY sip:client@sip.test:5061;transport=wss SIP/2.0`,
    "Via: SIP/2.0/WSS sip.test;branch=z9hG4bKserver",
    `From: "Server" <sip:server@sip.test;transport=wss>;tag=srv-tag`,
    `To: "Client" <sip:client@sip.test;transport=wss>;tag=${clientTag}`,
    `Call-ID: ${callId}`,
    "CSeq: 4 NOTIFY",
    "",
    "",
  ].join("\r\n");
}

function buildUnrecognizedMessage(callId: string, clientTag: string): string {
  return [
    `INFO sip:client@sip.test:5061;transport=wss SIP/2.0`,
    "Via: SIP/2.0/WSS sip.test;branch=z9hG4bKserver",
    `From: "Server" <sip:server@sip.test;transport=wss>;tag=srv-tag`,
    `To: "Client" <sip:client@sip.test;transport=wss>;tag=${clientTag}`,
    `Call-ID: ${callId}`,
    "CSeq: 9 INFO",
    "",
    "",
  ].join("\r\n");
}

/** A 202 response with a custom raw body (or none), for parseServerTimeouts edge cases. */
function build202WithBody(
  callId: string,
  clientTag: string,
  body: string | null,
  serverTag = "srv-tag-abc"
): string {
  const headers = [
    "SIP/2.0 202 Accepted",
    "Via: SIP/2.0/WSS sip.test;branch=z9hG4bKserver",
    `From: "Server" <sip:server@sip.test;transport=wss>;tag=${serverTag}`,
    `To: "Client" <sip:client@sip.test;transport=wss>;tag=${clientTag}`,
    `Call-ID: ${callId}`,
    "CSeq: 2 REGISTER",
    "Content-Type: application/json",
  ];
  if (body === null) {
    // No body at all — no double-CRLF separator
    return headers.join("\r\n");
  }
  return [...headers, "", body].join("\r\n");
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

  // ──────────────────────────────────────────────────────────────────────────
  // getRegistrationError()
  // ──────────────────────────────────────────────────────────────────────────

  describe("getRegistrationError()", () => {
    it("returns an empty string before any error has occurred", () => {
      expect(reg.getRegistrationError()).toBe("");
    });

    it("returns the error code and reason after an error response", () => {
      reg.getInitialRegistration();
      reg.parseMessage(buildErrorResponse(500, "Server Error", reg.callId, reg.tag));
      expect(reg.getRegistrationError()).toBe("500 Server Error");
    });

    it("returns a timeout message after RECEIVE_TIMEOUT expiry", () => {
      reg.getInitialRegistration();
      jest.advanceTimersByTime(60_000);
      expect(reg.getRegistrationError()).toContain("RECEIVE_TIMEOUT");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // terminate()
  // ──────────────────────────────────────────────────────────────────────────

  describe("terminate()", () => {
    it("returns a REGISTRATION BYE message", () => {
      reg.getInitialRegistration();
      const msg = reg.terminate();
      expect(msg).toContain("BYE");
      expect(msg).toContain("REGISTRATION");
    });

    it("transitions to TERMINATING state", () => {
      reg.getInitialRegistration();
      reg.terminate();
      expect(reg.getRegistrationState()).toBe(RegistrationState.TERMINATING);
    });

    it("cancels any active RECEIVE_TIMEOUT", () => {
      reg.getInitialRegistration();
      expect(manager.isTimerActive("RECEIVE_TIMEOUT")).toBe(true);
      reg.terminate();
      expect(manager.isTimerActive("RECEIVE_TIMEOUT")).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Duplicate CSeq handling
  // ──────────────────────────────────────────────────────────────────────────

  describe("Duplicate message handling", () => {
    it("resends the ACK when a duplicate 202 (CSeq 2) arrives", () => {
      reg.getInitialRegistration();
      const first = reg.parseMessage(build202(reg.callId, reg.tag));
      expect(first).toContain("ACK");

      const duplicate = reg.parseMessage(build202(reg.callId, reg.tag));
      expect(duplicate).toContain("ACK");
    });

    it("does not re-fire onSuccess for a duplicate 202", () => {
      reg.getInitialRegistration();
      reg.parseMessage(build202(reg.callId, reg.tag));
      events.onSuccess.mockClear();

      reg.parseMessage(build202(reg.callId, reg.tag));
      expect(events.onSuccess).not.toHaveBeenCalled();
    });

    it("returns an empty string for a duplicate non-202 CSeq", () => {
      reg.getInitialRegistration();
      reg.parseMessage(build202(reg.callId, reg.tag)); // processes CSeq 2 (202) and pre-marks CSeq 3 (ACK)

      // CSeq 3 is already in processedCSeqs (from handle202Accepted) — any further
      // message with CSeq 3 that isn't itself a 202 hits the "ignoring duplicate" branch.
      const duplicateAckCseq = [
        "SIP/2.0 200 OK",
        `From: "Server" <sip:server@sip.test;transport=wss>;tag=srv-tag-abc`,
        `To: "Client" <sip:client@sip.test;transport=wss>;tag=${reg.tag}`,
        `Call-ID: ${reg.callId}`,
        "CSeq: 3 ACK",
        "",
        "",
      ].join("\r\n");

      const result = reg.parseMessage(duplicateAckCseq);
      expect(result).toBe("");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // NOTIFY received during Registration phase (out-of-phase message)
  // ──────────────────────────────────────────────────────────────────────────

  describe("NOTIFY received during Registration phase", () => {
    it("returns an empty string and does not fire onFailure/onSuccess", () => {
      reg.getInitialRegistration();
      const result = reg.parseMessage(buildNotify(reg.callId, reg.tag));
      expect(result).toBe("");
      expect(events.onFailure).not.toHaveBeenCalled();
      expect(events.onSuccess).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Unrecognized message type
  // ──────────────────────────────────────────────────────────────────────────

  describe("Unrecognized message type", () => {
    it("returns an empty string without side effects", () => {
      reg.getInitialRegistration();
      const result = reg.parseMessage(buildUnrecognizedMessage(reg.callId, reg.tag));
      expect(result).toBe("");
      expect(events.onFailure).not.toHaveBeenCalled();
      expect(events.onSuccess).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // parseServerTimeouts() edge cases (exercised via the 202 response path)
  // ──────────────────────────────────────────────────────────────────────────

  describe("parseServerTimeouts() edge cases", () => {
    it("falls back to default timeouts when the 202 response has no body", () => {
      reg.getInitialRegistration();
      const before = reg.getTimeoutConfiguration();
      reg.parseMessage(build202WithBody(reg.callId, reg.tag, null));
      expect(reg.getTimeoutConfiguration()).toEqual(before);
      // Registration still completes successfully despite missing timeout config
      expect(reg.isRegistered).toBe(true);
    });

    it("falls back to default timeouts when the body is malformed JSON", () => {
      reg.getInitialRegistration();
      const before = reg.getTimeoutConfiguration();
      reg.parseMessage(build202WithBody(reg.callId, reg.tag, "{not valid json"));
      expect(reg.getTimeoutConfiguration()).toEqual(before);
      expect(reg.isRegistered).toBe(true);
    });

    it("only applies fields present in the server's config, keeping others at default", () => {
      reg.getInitialRegistration();
      const before = reg.getTimeoutConfiguration();
      reg.parseMessage(
        build202WithBody(reg.callId, reg.tag, JSON.stringify({ ConnectionTimeout: 45000 }))
      );
      const after = reg.getTimeoutConfiguration();
      expect(after.connection).toBe(45000);
      expect(after.peerRegistration).toBe(before.peerRegistration);
      expect(after.receive).toBe(before.receive);
    });

    it("ignores non-numeric timeout fields and keeps the default", () => {
      reg.getInitialRegistration();
      const before = reg.getTimeoutConfiguration();
      reg.parseMessage(
        build202WithBody(
          reg.callId,
          reg.tag,
          JSON.stringify({ ConnectionTimeout: "not-a-number" })
        )
      );
      expect(reg.getTimeoutConfiguration().connection).toBe(before.connection);
    });

    it("enforces a 10000ms floor even when the server sends a smaller value", () => {
      reg.getInitialRegistration();
      reg.parseMessage(
        build202WithBody(reg.callId, reg.tag, JSON.stringify({ ConnectionTimeout: 500 }))
      );
      expect(reg.getTimeoutConfiguration().connection).toBe(10000);
    });
  });
});
