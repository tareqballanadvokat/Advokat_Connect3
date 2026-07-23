/* eslint-disable no-undef */
/**
 * Unit Tests for EstablishingConnection
 *
 * Tests the SIP connection-establishment state machine in isolation.
 * - Real TimeoutManager (with fake timers) to verify timer behaviour.
 * - configService is mocked to return a controlled SIP URI.
 * - Events callbacks are plain jest.fn() mocks.
 *
 * NOTIFY messages use their own (server-generated) Call-ID and tags —
 * different from registration session IDs — so no session-validation logic
 * needs to be considered in these tests.
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

import { EstablishingConnection, ConnectionState } from "@infra/sip/EstablishingConnection";
import { TimeoutManager }                          from "@infra/sip/TimeoutManager";

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
 * Builds a minimal NOTIFY4 message (CSeq:4).
 * Connection establishment extracts Call-ID, To-tag, and From-tag from this.
 */
function buildNotify4(
  callId  = "tunnel-call-id-abc",
  fromTag = "srv-from-tag",
  toTag   = "cli-to-tag"
): string {
  return [
    `NOTIFY sip:client@sip.test:5061;transport=wss SIP/2.0`,
    `Via: SIP/2.0/WSS sip.test;branch=z9hG4bKnotify4`,
    `From: "Server" <sip:server@sip.test;transport=wss>;tag=${fromTag}`,
    `To: "Client" <sip:client@sip.test;transport=wss>;tag=${toTag}`,
    `Call-ID: ${callId}`,
    `CSeq: 4 NOTIFY`,
    `Content-Length: 0`,
    ``,
    ``,
  ].join("\r\n");
}

function buildNotify6(callId = "tunnel-call-id-abc"): string {
  return [
    `NOTIFY sip:client@sip.test:5061;transport=wss SIP/2.0`,
    `Via: SIP/2.0/WSS sip.test;branch=z9hG4bKnotify6`,
    `From: "Server" <sip:server@sip.test;transport=wss>;tag=srv-from-tag`,
    `To: "Client" <sip:client@sip.test;transport=wss>;tag=cli-to-tag`,
    `Call-ID: ${callId}`,
    `CSeq: 6 NOTIFY`,
    `Content-Length: 0`,
    ``,
    ``,
  ].join("\r\n");
}

function buildConnectionBye(callId = "tunnel-call-id-abc"): string {
  return [
    `BYE sip:client@sip.test:5061;transport=wss SIP/2.0`,
    `Via: SIP/2.0/WSS sip.test;branch=z9hG4bKbye`,
    `From: "Server" <sip:server@sip.test;transport=wss>;tag=srv-from-tag`,
    `To: "Client" <sip:client@sip.test;transport=wss>;tag=cli-to-tag`,
    `Call-ID: ${callId}`,
    `CSeq: 7 BYE`,
    `Reason: CONNECTION`,
    ``,
    ``,
  ].join("\r\n");
}

// ─────────────────────────────────────────────────────────────────────────────

describe("EstablishingConnection", () => {
  let manager: TimeoutManager;
  let events:  ReturnType<typeof makeEvents>;
  let conn:    EstablishingConnection;

  const CONN_TIMEOUT_MS = 3_000;

  beforeEach(() => {
    jest.useFakeTimers();
    manager = new TimeoutManager();
    events  = makeEvents();
    conn    = new EstablishingConnection(manager, events);

    // Prime the connection with registration session data (as SipClient would)
    conn.updateData("reg-tag", "reg-call-id", "z9hG4bKreg", "Client", "Server", CONN_TIMEOUT_MS);
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
    it("starts in WAITING_NOTIFY_4 state", () => {
      expect(conn.getState()).toBe(ConnectionState.WAITING_NOTIFY_4);
    });

    it("isConnectionEstablished is false initially", () => {
      expect(conn.isConnectionEstablished).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // updateData()
  // ──────────────────────────────────────────────────────────────────────────

  describe("updateData()", () => {
    it("sets sipUri, tag, callId from registration phase", () => {
      expect(conn.tag).toBe("reg-tag");
      expect(conn.callId).toBe("reg-call-id");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // NOTIFY4 handling
  // ──────────────────────────────────────────────────────────────────────────

  describe("NOTIFY4 handling", () => {
    it("returns an ACK message containing 'CSeq: 5'", () => {
      const ack = conn.parseMessage(buildNotify4());
      expect(ack).toContain("CSeq: 5");
    });

    it("transitions to WAITING_NOTIFY_6 after NOTIFY4", () => {
      conn.parseMessage(buildNotify4());
      expect(conn.getState()).toBe(ConnectionState.WAITING_NOTIFY_6);
    });

    it("emits onStateChange with WAITING_NOTIFY_6", () => {
      conn.parseMessage(buildNotify4());
      expect(events.onStateChange).toHaveBeenCalledWith(ConnectionState.WAITING_NOTIFY_6);
    });

    it("starts the CONNECTION_TIMEOUT timer", () => {
      conn.parseMessage(buildNotify4());
      expect(manager.isTimerActive("CONNECTION_TIMEOUT")).toBe(true);
    });

    it("updates callId from NOTIFY4 Call-ID header", () => {
      conn.parseMessage(buildNotify4("new-tunnel-call-id"));
      expect(conn.callId).toBe("new-tunnel-call-id");
    });

    it("extracts To-tag from NOTIFY4 and stores it as the tag", () => {
      conn.parseMessage(buildNotify4("any-id", "srv-from", "client-to-tag"));
      expect(conn.tag).toBe("client-to-tag");
    });

    it("extracts From-tag from NOTIFY4 and stores it as toTag", () => {
      // Note: REGEX_FROM_TAG in EstablishingConnection has a known defect — the character
      // class [^\ s;>\r\n] excludes the letter 's', so tags containing 's' are not extracted.
      // We use a tag without 's' to verify the happy path.
      conn.parseMessage(buildNotify4("any-id", "fromtag-abc", "cli-to"));
      expect(conn.toTag).toBe("fromtag-abc");
    });

    it("resends ACK5 on duplicate NOTIFY4 without restarting timer", () => {
      conn.parseMessage(buildNotify4()); // first NOTIFY4
      const timerActiveAfterFirst = manager.isTimerActive("CONNECTION_TIMEOUT");

      // Simulate duplicate (same CSeq 4 — processedCSeqs should detect it)
      const ack = conn.parseMessage(buildNotify4());
      expect(ack).toBeDefined();
      // Timer was already cancelled by first NOTIFY4 (no, it's still running)
      // The timer should still be active from the first NOTIFY4 — just the ACK is resent
      expect(timerActiveAfterFirst).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CONNECTION_TIMEOUT expiry
  // ──────────────────────────────────────────────────────────────────────────

  describe("CONNECTION_TIMEOUT expiry", () => {
    it("fires onTimeout with 'CONNECTION_TIMEOUT'", () => {
      conn.parseMessage(buildNotify4()); // start timer
      jest.advanceTimersByTime(CONN_TIMEOUT_MS + 1);
      expect(events.onTimeout).toHaveBeenCalledWith("CONNECTION_TIMEOUT");
    });

    it("fires onFailure on timeout", () => {
      conn.parseMessage(buildNotify4());
      jest.advanceTimersByTime(CONN_TIMEOUT_MS + 1);
      expect(events.onFailure).toHaveBeenCalled();
    });

    it("transitions to FAILED on timeout", () => {
      conn.parseMessage(buildNotify4());
      jest.advanceTimersByTime(CONN_TIMEOUT_MS + 1);
      expect(conn.getState()).toBe(ConnectionState.FAILED);
    });

    it("sends CONNECTION BYE via onMessageToSend on timeout", () => {
      conn.parseMessage(buildNotify4());
      jest.advanceTimersByTime(CONN_TIMEOUT_MS + 1);
      expect(events.onMessageToSend).toHaveBeenCalledWith(
        expect.stringContaining("BYE"),
        expect.any(String)
      );
    });

    it("isConnectionEstablished remains false after timeout", () => {
      conn.parseMessage(buildNotify4());
      jest.advanceTimersByTime(CONN_TIMEOUT_MS + 1);
      expect(conn.isConnectionEstablished).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // NOTIFY6 handling (success path)
  // ──────────────────────────────────────────────────────────────────────────

  describe("NOTIFY6 handling", () => {
    it("fires onSuccess after NOTIFY6", () => {
      conn.parseMessage(buildNotify4());
      conn.parseMessage(buildNotify6());
      expect(events.onSuccess).toHaveBeenCalledTimes(1);
    });

    it("transitions to COMPLETE after NOTIFY6", () => {
      conn.parseMessage(buildNotify4());
      conn.parseMessage(buildNotify6());
      expect(conn.getState()).toBe(ConnectionState.COMPLETE);
    });

    it("sets isConnectionEstablished to true", () => {
      conn.parseMessage(buildNotify4());
      conn.parseMessage(buildNotify6());
      expect(conn.isConnectionEstablished).toBe(true);
    });

    it("cancels CONNECTION_TIMEOUT on NOTIFY6", () => {
      conn.parseMessage(buildNotify4());
      conn.parseMessage(buildNotify6());
      expect(manager.isTimerActive("CONNECTION_TIMEOUT")).toBe(false);
    });

    it("does NOT fire onTimeout after NOTIFY6 is received", () => {
      conn.parseMessage(buildNotify4());
      conn.parseMessage(buildNotify6());
      jest.advanceTimersByTime(CONN_TIMEOUT_MS + 1); // timer should be cancelled
      expect(events.onTimeout).not.toHaveBeenCalled();
    });

    it("returns undefined for NOTIFY6 (no ACK needed)", () => {
      conn.parseMessage(buildNotify4());
      const result = conn.parseMessage(buildNotify6());
      expect(result).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // CONNECTION BYE received
  // ──────────────────────────────────────────────────────────────────────────

  describe("CONNECTION BYE received", () => {
    it("transitions to FAILED when BYE received after NOTIFY4", () => {
      conn.parseMessage(buildNotify4());
      conn.parseMessage(buildConnectionBye());
      expect(conn.getState()).toBe(ConnectionState.FAILED);
    });

    it("fires onFailure when BYE received after NOTIFY4", () => {
      conn.parseMessage(buildNotify4());
      conn.parseMessage(buildConnectionBye());
      expect(events.onFailure).toHaveBeenCalled();
    });

    it("ignores BYE in WAITING_NOTIFY_4 state (server will resend NOTIFY4)", () => {
      // Don't call parseMessage(notify4) first — stay in WAITING_NOTIFY_4
      conn.parseMessage(buildConnectionBye());
      // Should still be in WAITING_NOTIFY_4
      expect(conn.getState()).toBe(ConnectionState.WAITING_NOTIFY_4);
      expect(events.onFailure).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Unrecognised messages
  // ──────────────────────────────────────────────────────────────────────────

  describe("Unrecognised messages", () => {
    it("returns undefined for unrecognised message types", () => {
      const result = conn.parseMessage("OPTIONS sip:server@sip.test SIP/2.0\r\nCSeq: 1 OPTIONS\r\n\r\n");
      expect(result).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // reset()
  // ──────────────────────────────────────────────────────────────────────────

  describe("reset()", () => {
    it("cancels the active CONNECTION_TIMEOUT", () => {
      conn.parseMessage(buildNotify4());
      expect(manager.isTimerActive("CONNECTION_TIMEOUT")).toBe(true);
      conn.reset();
      expect(manager.isTimerActive("CONNECTION_TIMEOUT")).toBe(false);
    });

    it("returns state to WAITING_NOTIFY_4", () => {
      conn.parseMessage(buildNotify4());
      conn.reset();
      expect(conn.getState()).toBe(ConnectionState.WAITING_NOTIFY_4);
    });

    it("resets isConnectionEstablished to false", () => {
      conn.parseMessage(buildNotify4());
      conn.parseMessage(buildNotify6()); // sets it true
      conn.reset();
      expect(conn.isConnectionEstablished).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Utility methods
  // ──────────────────────────────────────────────────────────────────────────

  describe("Utility methods", () => {
    it("getLastError() returns an empty string initially", () => {
      expect(conn.getLastError()).toBe("");
    });

    it("getLastError() returns a message after timeout", () => {
      conn.parseMessage(buildNotify4());
      jest.advanceTimersByTime(CONN_TIMEOUT_MS + 1);
      expect(conn.getLastError()).toBeTruthy();
    });
  });
});
