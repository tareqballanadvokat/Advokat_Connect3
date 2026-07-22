/* eslint-disable no-undef */
/**
 * Unit Tests for Peer2PeerConnection
 *
 * Mocking strategy:
 * - RTCPeerConnection  : global mock from setupTests.ts, reconfigured per-test to expose
 *                        ice-gathering state and localDescription.
 * - WebRTCDataChannelService : module-level mock that exposes a single mock instance so
 *                              subscriber callbacks can be triggered manually.
 * - @config / @infra/logger  : lightweight stubs.
 * - TimeoutManager           : real instance + jest.useFakeTimers() so timer behaviour is
 *                              verified without wall-clock delays.
 */

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

// ─── Config mock ─────────────────────────────────────────────────────────────
jest.mock("@config", () => ({
  getConfig: jest.fn(() => ({
    webrtc: { iceServers: [] },
  })),
  configService: {
    getSipConfig: jest.fn(() => ({
      sipUri:          "sip:client@sip.test:5061;transport=wss",
      fromDisplayName: "Client",
      toDisplayName:   "Server",
    })),
    buildSipUri: jest.fn((name: string) => `sip:${name.toLowerCase()}@sip.test:5061;transport=wss`),
  },
}));

// ─── WebRTCDataChannelService mock ────────────────────────────────────────────
// We need a stable object so we can capture the subscribed observer and
// control `isReadyForCommunication` during tests.
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

jest.mock("@services/WebRTCDataChannelService", () => ({
  WebRTCDataChannelService: {
    getInstance: jest.fn(() => mockSvcInstance),
    destroy:     jest.fn(),
  },
}));

import { Peer2PeerConnection, SdpExchangeState } from "@infra/sip/Peer2PeerConnection";
import { TimeoutManager }                         from "@infra/sip/TimeoutManager";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEvents() {
  return {
    onStateChange:          jest.fn(),
    onSuccess:              jest.fn(),
    onFailure:              jest.fn(),
    onTimeout:              jest.fn(),
    onMessageToSend:        jest.fn(),
    onCandidateTypeSelected: jest.fn(),
  };
}

/** Returns a minimal SERVICE answer SIP message with an SDP JSON block. */
function buildServiceAnswer(sdp = "mock-sdp-answer"): string {
  const sdpJson = JSON.stringify({ type: "answer", sdp });
  return [
    `SERVICE sip:client@sip.test:5061;transport=wss SIP/2.0`,
    `Via: SIP/2.0/WSS sip.test;branch=z9hG4bKanswer`,
    `From: "Server" <sip:server@sip.test;transport=wss>;tag=srv-tag`,
    `To: "Client" <sip:client@sip.test;transport=wss>;tag=cli-tag`,
    `Call-ID: call-id-abc`,
    `CSeq: 2 SERVICE`,
    `Content-Length: ${sdpJson.length}`,
    ``,
    sdpJson,
  ].join("\r\n");
}

/** The default offer parameters used by most tests. */
const OFFER_PARAMS = {
  callId: "test-call-id",
  sipUri: "sip:client@sip.test:5061;transport=wss",
  tag:    "cli-tag-123",
  toLine: '"Server" <sip:server@sip.test;transport=wss>;tag=srv-tag',
};

// ─────────────────────────────────────────────────────────────────────────────

describe("Peer2PeerConnection", () => {
  let events:  ReturnType<typeof makeEvents>;
  let manager: TimeoutManager;
  let p2p:     Peer2PeerConnection;
  let mockPc:  any;

  /** Subscriber observer captured from the first mockSvcInstance.subscribe() call. */
  let capturedObserver: {
    onDataChannelStateChanged?: (state: RTCDataChannelState, type: "offer" | "answer") => void;
    onDataChannelError?:        (error: Event | string, type: "offer" | "answer") => void;
  };

  const RECEIVE_TIMEOUT_MS = 5_000;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    // Reset mock service flags
    mockSvcInstance.isReadyForCommunication = false;
    mockSvcInstance.isOfferChannelOpen      = false;
    mockSvcInstance.isAnswerChannelOpen     = false;

    // Capture the observer registered in the Peer2PeerConnection constructor / reset()
    mockSvcInstance.subscribe.mockImplementation((obs: any) => {
      capturedObserver = obs;
    });

    // Build a richly-configured RTCPeerConnection mock for each test
    mockPc = {
      createOffer:            jest.fn(() => Promise.resolve({ type: "offer", sdp: "mock-sdp-offer" })),
      createAnswer:           jest.fn(() => Promise.resolve({ type: "answer", sdp: "mock-sdp-answer" })),
      setLocalDescription:    jest.fn(async (desc: any) => { mockPc.localDescription = desc; }),
      setRemoteDescription:   jest.fn(() => Promise.resolve()),
      addIceCandidate:        jest.fn(() => Promise.resolve()),
      createDataChannel:      jest.fn(() => mockDataChannel),
      close:                  jest.fn(),
      getStats:               jest.fn(() => Promise.resolve(new Map())),
      addEventListener:       jest.fn(),
      removeEventListener:    jest.fn(),
      onicecandidate:         null,
      ondatachannel:          null,
      onicegatheringstatechange:     null,
      oniceconnectionstatechange:    null,
      localDescription:       null,
      remoteDescription:      null,
      iceGatheringState:      "new",
      iceConnectionState:     "new",
    };
    (global.RTCPeerConnection as jest.Mock).mockImplementation(() => mockPc);

    manager = new TimeoutManager();
    events  = makeEvents();
    p2p     = new Peer2PeerConnection(events);
    p2p.updateConfiguration(manager, RECEIVE_TIMEOUT_MS);
  });

  afterEach(() => {
    manager.cancelAllTimers();
    jest.useRealTimers();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Initial state
  // ──────────────────────────────────────────────────────────────────────────

  describe("Initial state", () => {
    it("starts in IDLE state", () => {
      expect(p2p.getState()).toBe(SdpExchangeState.IDLE);
    });

    it("isOfferSent is false initially", () => {
      expect(p2p.isOfferSent).toBe(false);
    });

    it("subscribes to WebRTCDataChannelService in the constructor", () => {
      expect(mockSvcInstance.subscribe).toHaveBeenCalledTimes(1);
    });

    it("getLastError() returns empty string initially", () => {
      expect(p2p.getLastError()).toBe("");
    });

    it("getLastOfferParams() returns null initially", () => {
      expect(p2p.getLastOfferParams()).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // createOffer()
  // ──────────────────────────────────────────────────────────────────────────

  describe("createOffer()", () => {
    it("calls pc.createDataChannel with label 'offer'", async () => {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      expect(mockPc.createDataChannel).toHaveBeenCalledWith("offer");
    });

    it("registers the data channel with WebRTCDataChannelService", async () => {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      expect(mockSvcInstance.setOfferChannel).toHaveBeenCalledWith(mockDataChannel);
    });

    it("calls pc.createOffer() and pc.setLocalDescription()", async () => {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      expect(mockPc.createOffer).toHaveBeenCalledTimes(1);
      expect(mockPc.setLocalDescription).toHaveBeenCalledWith({ type: "offer", sdp: "mock-sdp-offer" });
    });

    it("starts the ICE_GATHERING_TIMEOUT timer", async () => {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      expect(manager.isTimerActive("ICE_GATHERING_TIMEOUT")).toBe(true);
    });

    it("stores offer params in getLastOfferParams()", async () => {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      const params = p2p.getLastOfferParams();
      expect(params?.callId).toBe(OFFER_PARAMS.callId);
      expect(params?.sipUri).toBe(OFFER_PARAMS.sipUri);
    });

    it("transitions to FAILED and fires onFailure when pc.createOffer() throws", async () => {
      mockPc.createOffer.mockRejectedValue(new Error("WebRTC unavailable"));
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      expect(p2p.getState()).toBe(SdpExchangeState.FAILED);
      expect(events.onFailure).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ICE gathering → offer sent
  // ──────────────────────────────────────────────────────────────────────────

  describe("ICE gathering completion", () => {
    async function setupAndTriggerIce() {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      // Simulate ICE gathering completing
      mockPc.iceGatheringState = "complete";
      mockPc.onicegatheringstatechange?.();
    }

    it("sends the offer via onMessageToSend when ICE gathering completes", async () => {
      await setupAndTriggerIce();
      expect(events.onMessageToSend).toHaveBeenCalledWith(
        expect.stringContaining("SERVICE"),
        "SERVICE Offer"
      );
    });

    it("transitions to OFFER_SENT after sending the offer", async () => {
      await setupAndTriggerIce();
      expect(p2p.getState()).toBe(SdpExchangeState.OFFER_SENT);
    });

    it("sets isOfferSent to true after sending the offer", async () => {
      await setupAndTriggerIce();
      expect(p2p.isOfferSent).toBe(true);
    });

    it("starts the RECEIVE_TIMEOUT after sending the offer", async () => {
      await setupAndTriggerIce();
      expect(manager.isTimerActive("RECEIVE_TIMEOUT")).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // RECEIVE_TIMEOUT expiry
  // ──────────────────────────────────────────────────────────────────────────

  describe("RECEIVE_TIMEOUT expiry", () => {
    async function setupAndSendOffer() {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      mockPc.iceGatheringState = "complete";
      mockPc.onicegatheringstatechange?.();
    }

    it("fires onTimeout with 'RECEIVE_TIMEOUT' when timer expires", async () => {
      await setupAndSendOffer();
      jest.advanceTimersByTime(RECEIVE_TIMEOUT_MS + 1);
      expect(events.onTimeout).toHaveBeenCalledWith("RECEIVE_TIMEOUT");
    });

    it("fires onFailure when RECEIVE_TIMEOUT expires", async () => {
      await setupAndSendOffer();
      jest.advanceTimersByTime(RECEIVE_TIMEOUT_MS + 1);
      expect(events.onFailure).toHaveBeenCalled();
    });

    it("transitions to FAILED on RECEIVE_TIMEOUT", async () => {
      await setupAndSendOffer();
      jest.advanceTimersByTime(RECEIVE_TIMEOUT_MS + 1);
      expect(p2p.getState()).toBe(SdpExchangeState.FAILED);
    });

    it("sets isOfferSent to false on timeout", async () => {
      await setupAndSendOffer();
      jest.advanceTimersByTime(RECEIVE_TIMEOUT_MS + 1);
      expect(p2p.isOfferSent).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // parseIncomingAnswer()
  // ──────────────────────────────────────────────────────────────────────────

  describe("parseIncomingAnswer()", () => {
    async function setupOfferSent() {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      mockPc.iceGatheringState = "complete";
      mockPc.onicegatheringstatechange?.();
    }

    it("calls pc.setRemoteDescription() on a valid SERVICE answer", async () => {
      await setupOfferSent();
      await p2p.parseIncomingAnswer(buildServiceAnswer());
      expect(mockPc.setRemoteDescription).toHaveBeenCalledTimes(1);
    });

    it("transitions to ANSWER_RECEIVED on a valid answer", async () => {
      await setupOfferSent();
      await p2p.parseIncomingAnswer(buildServiceAnswer());
      expect(p2p.getState()).toBe(SdpExchangeState.ANSWER_RECEIVED);
    });

    it("cancels RECEIVE_TIMEOUT on a valid answer", async () => {
      await setupOfferSent();
      await p2p.parseIncomingAnswer(buildServiceAnswer());
      expect(manager.isTimerActive("RECEIVE_TIMEOUT")).toBe(false);
    });

    it("starts DATACHANNEL_OPEN_TIMEOUT after receiving answer", async () => {
      await setupOfferSent();
      await p2p.parseIncomingAnswer(buildServiceAnswer());
      expect(manager.isTimerActive("DATACHANNEL_OPEN_TIMEOUT")).toBe(true);
    });

    it("fires onFailure when SDP block is missing", async () => {
      await setupOfferSent();
      const noSdpAnswer = buildServiceAnswer().replace(/\{.*\}/s, "no-sdp-here");
      await p2p.parseIncomingAnswer(noSdpAnswer);
      expect(events.onFailure).toHaveBeenCalled();
      expect(p2p.getState()).toBe(SdpExchangeState.FAILED);
    });

    it("fires onFailure when SDP JSON is malformed", async () => {
      await setupOfferSent();
      const malformedAnswer = buildServiceAnswer().replace(/\{.*\}/s, '{"sdp": BROKEN}');
      await p2p.parseIncomingAnswer(malformedAnswer);
      expect(events.onFailure).toHaveBeenCalled();
    });

    it("ignores answer in IDLE state (state guard)", async () => {
      // Do not call createOffer — stay in IDLE
      await p2p.parseIncomingAnswer(buildServiceAnswer());
      expect(mockPc.setRemoteDescription).not.toHaveBeenCalled();
    });

    it("ignores a duplicate answer", async () => {
      await setupOfferSent();
      await p2p.parseIncomingAnswer(buildServiceAnswer());
      // Second answer should be ignored
      await p2p.parseIncomingAnswer(buildServiceAnswer());
      expect(mockPc.setRemoteDescription).toHaveBeenCalledTimes(1);
    });

    it("ignores a message that is not a SERVICE CSeq:2 answer", async () => {
      await setupOfferSent();
      await p2p.parseIncomingAnswer("NOTIFY sip:client@sip.test SIP/2.0\r\nCSeq: 4 NOTIFY\r\n\r\n");
      expect(mockPc.setRemoteDescription).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DataChannel state changes (success path)
  // ──────────────────────────────────────────────────────────────────────────

  describe("DataChannel open — success path", () => {
    async function reachAnswerReceived() {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      mockPc.iceGatheringState = "complete";
      mockPc.onicegatheringstatechange?.();
      await p2p.parseIncomingAnswer(buildServiceAnswer());
    }

    it("fires onSuccess when both channels are open", async () => {
      await reachAnswerReceived();
      // Simulate both channels reporting open
      mockSvcInstance.isReadyForCommunication = true;
      mockSvcInstance.isOfferChannelOpen      = true;
      mockSvcInstance.isAnswerChannelOpen     = true;
      capturedObserver.onDataChannelStateChanged?.("open", "offer");
      expect(events.onSuccess).toHaveBeenCalledTimes(1);
    });

    it("transitions to COMPLETE when both channels are open", async () => {
      await reachAnswerReceived();
      mockSvcInstance.isReadyForCommunication = true;
      capturedObserver.onDataChannelStateChanged?.("open", "answer");
      expect(p2p.getState()).toBe(SdpExchangeState.COMPLETE);
    });

    it("cancels DATACHANNEL_OPEN_TIMEOUT on success", async () => {
      await reachAnswerReceived();
      expect(manager.isTimerActive("DATACHANNEL_OPEN_TIMEOUT")).toBe(true);
      mockSvcInstance.isReadyForCommunication = true;
      capturedObserver.onDataChannelStateChanged?.("open", "offer");
      expect(manager.isTimerActive("DATACHANNEL_OPEN_TIMEOUT")).toBe(false);
    });

    it("does NOT fire onSuccess when only one channel is open", async () => {
      await reachAnswerReceived();
      // offer channel opens but answer is not ready
      mockSvcInstance.isReadyForCommunication = false;
      mockSvcInstance.isOfferChannelOpen      = true;
      mockSvcInstance.isAnswerChannelOpen     = false;
      capturedObserver.onDataChannelStateChanged?.("open", "offer");
      expect(events.onSuccess).not.toHaveBeenCalled();
    });

    it("ignores channel-open events when state is not ANSWER_RECEIVED", async () => {
      // Stay in IDLE — open event should be ignored
      mockSvcInstance.isReadyForCommunication = true;
      capturedObserver?.onDataChannelStateChanged?.("open", "offer");
      expect(events.onSuccess).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DataChannel errors
  // ──────────────────────────────────────────────────────────────────────────

  describe("DataChannel error", () => {
    it("transitions to FAILED on channel error in OFFER_SENT state", async () => {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      mockPc.iceGatheringState = "complete";
      mockPc.onicegatheringstatechange?.();
      // Now in OFFER_SENT — trigger error
      capturedObserver.onDataChannelError?.("connection lost", "offer");
      expect(p2p.getState()).toBe(SdpExchangeState.FAILED);
    });

    it("fires onFailure on channel error", async () => {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      mockPc.iceGatheringState = "complete";
      mockPc.onicegatheringstatechange?.();
      capturedObserver.onDataChannelError?.("network error", "answer");
      expect(events.onFailure).toHaveBeenCalledWith(expect.stringContaining("channel error"));
    });

    it("ignores DataChannel errors in IDLE state", async () => {
      // Stay in IDLE
      capturedObserver?.onDataChannelError?.("stale error", "offer");
      expect(events.onFailure).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DATACHANNEL_OPEN_TIMEOUT
  // ──────────────────────────────────────────────────────────────────────────

  describe("DATACHANNEL_OPEN_TIMEOUT expiry", () => {
    it("fires onFailure when DataChannel does not open in time", async () => {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      mockPc.iceGatheringState = "complete";
      mockPc.onicegatheringstatechange?.();
      await p2p.parseIncomingAnswer(buildServiceAnswer());

      jest.advanceTimersByTime(10_001); // DATACHANNEL_OPEN_TIMEOUT = 10 000ms

      expect(events.onFailure).toHaveBeenCalled();
      expect(p2p.getState()).toBe(SdpExchangeState.FAILED);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // reset()
  // ──────────────────────────────────────────────────────────────────────────

  describe("reset()", () => {
    it("returns state to IDLE", async () => {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      mockPc.iceGatheringState = "complete";
      mockPc.onicegatheringstatechange?.();
      jest.advanceTimersByTime(RECEIVE_TIMEOUT_MS + 1); // → FAILED

      p2p.reset();
      expect(p2p.getState()).toBe(SdpExchangeState.IDLE);
    });

    it("sets isOfferSent to false", async () => {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      mockPc.iceGatheringState = "complete";
      mockPc.onicegatheringstatechange?.();
      p2p.reset();
      expect(p2p.isOfferSent).toBe(false);
    });

    it("calls pc.close() to tear down the peer connection", async () => {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      p2p.reset();
      expect(mockPc.close).toHaveBeenCalled();
    });

    it("calls service.reset() to clear DataChannel state", async () => {
      p2p.reset();
      expect(mockSvcInstance.reset).toHaveBeenCalled();
    });

    it("re-subscribes to WebRTCDataChannelService after reset", () => {
      const subscribeCallsBefore = mockSvcInstance.subscribe.mock.calls.length;
      p2p.reset();
      expect(mockSvcInstance.subscribe.mock.calls.length).toBeGreaterThan(subscribeCallsBefore);
    });

    it("cancels any active timers", async () => {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      mockPc.iceGatheringState = "complete";
      mockPc.onicegatheringstatechange?.();
      expect(manager.isTimerActive("RECEIVE_TIMEOUT")).toBe(true);
      p2p.reset();
      expect(manager.isTimerActive("RECEIVE_TIMEOUT")).toBe(false);
    });

    it("clears getLastOfferParams()", async () => {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      p2p.reset();
      expect(p2p.getLastOfferParams()).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ICE_GATHERING_TIMEOUT
  // ──────────────────────────────────────────────────────────────────────────

  describe("ICE_GATHERING_TIMEOUT", () => {
    it("sends offer with partial candidates when ICE gathering times out", async () => {
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      // Do NOT trigger onicegatheringstatechange — let the timeout fire instead
      jest.advanceTimersByTime(5_001); // ICE_GATHERING_TIMEOUT = 5 000ms
      expect(events.onMessageToSend).toHaveBeenCalledWith(
        expect.stringContaining("SERVICE"),
        "SERVICE Offer"
      );
    });

    it("transitions to FAILED when ICE gathering times out with no local description", async () => {
      mockPc.setLocalDescription.mockImplementation(async () => {
        // Don't set localDescription — simulate early failure
      });
      await p2p.createOffer(OFFER_PARAMS.callId, OFFER_PARAMS.sipUri, OFFER_PARAMS.tag, OFFER_PARAMS.toLine);
      // localDescription is null, lastOfferParams is set
      jest.advanceTimersByTime(5_001);
      // Should fail because localDescription is null
      expect(p2p.getState()).toBe(SdpExchangeState.FAILED);
    });
  });
});

// ─── Mock data channel (module-level so it's accessible in all tests) ────────
const mockDataChannel: any = {
  readyState: "connecting" as RTCDataChannelState,
  label:      "offer",
  onopen:     null,
  onclose:    null,
  onerror:    null,
  onmessage:  null,
  send:       jest.fn(),
  close:      jest.fn(),
};
