/* eslint-disable no-undef */
/**
 * Unit Tests for WebRTCDataChannelService
 *
 * The service is a singleton, so each test calls WebRTCDataChannelService.destroy()
 * in afterEach to reset the instance and avoid state leaking between tests.
 *
 * A lightweight fake RTCDataChannel is used instead of the browser global so
 * we can control readyState and fire handlers manually.
 */

// ─── Logger mock ─────────────────────────────────────────────────────────────
const mockLogger = {
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => mockLogger),
}));

import {
  WebRTCDataChannelService,
  DataChannelObserver,
  ChannelType,
} from "@services/WebRTCDataChannelService";

// ─── Fake RTCDataChannel factory ──────────────────────────────────────────────
type FakeChannel = {
  readyState: RTCDataChannelState;
  label:      string;
  onopen:     ((ev: Event) => void) | null;
  onclose:    ((ev: Event) => void) | null;
  onerror:    ((ev: Event) => void) | null;
  onmessage:  ((ev: MessageEvent) => void) | null;
  send:       jest.Mock;
  close:      jest.Mock;
};

function makeChannel(
  readyState: RTCDataChannelState = "connecting",
  label = "test-channel"
): FakeChannel {
  return {
    readyState,
    label,
    onopen:    null,
    onclose:   null,
    onerror:   null,
    onmessage: null,
    send:      jest.fn(),
    close:     jest.fn(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeObserver(): {
  observer: DataChannelObserver;
  onMessage:      jest.Mock;
  onStateChanged: jest.Mock;
  onError:        jest.Mock;
} {
  const onMessage      = jest.fn();
  const onStateChanged = jest.fn();
  const onError        = jest.fn();

  return {
    observer: {
      onDataChannelMessage:     onMessage,
      onDataChannelStateChanged: onStateChanged,
      onDataChannelError:       onError,
    },
    onMessage,
    onStateChanged,
    onError,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("WebRTCDataChannelService", () => {
  let svc: WebRTCDataChannelService;

  beforeEach(() => {
    WebRTCDataChannelService.destroy();
    svc = WebRTCDataChannelService.getInstance();
  });

  afterEach(() => {
    WebRTCDataChannelService.destroy();
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Singleton
  // ──────────────────────────────────────────────────────────────────────────

  describe("Singleton", () => {
    it("returns the same instance on repeated calls", () => {
      const a = WebRTCDataChannelService.getInstance();
      const b = WebRTCDataChannelService.getInstance();
      expect(a).toBe(b);
    });

    it("creates a fresh instance after destroy()", () => {
      const a = WebRTCDataChannelService.getInstance();
      WebRTCDataChannelService.destroy();
      const b = WebRTCDataChannelService.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Observer registration
  // ──────────────────────────────────────────────────────────────────────────

  describe("subscribe() / unsubscribe()", () => {
    it("isSubscribed() returns false before subscription", () => {
      const { observer } = makeObserver();
      expect(svc.isSubscribed(observer)).toBe(false);
    });

    it("isSubscribed() returns true after subscribe()", () => {
      const { observer } = makeObserver();
      svc.subscribe(observer);
      expect(svc.isSubscribed(observer)).toBe(true);
    });

    it("isSubscribed() returns false after unsubscribe()", () => {
      const { observer } = makeObserver();
      svc.subscribe(observer);
      svc.unsubscribe(observer);
      expect(svc.isSubscribed(observer)).toBe(false);
    });

    it("unsubscribeAll() removes every observer", () => {
      const { observer: obs1 } = makeObserver();
      const { observer: obs2 } = makeObserver();
      svc.subscribe(obs1);
      svc.subscribe(obs2);
      svc.unsubscribeAll();
      expect(svc.isSubscribed(obs1)).toBe(false);
      expect(svc.isSubscribed(obs2)).toBe(false);
    });

    it("subscribing the same observer twice does not duplicate notifications", () => {
      const { observer, onStateChanged } = makeObserver();
      svc.subscribe(observer);
      svc.subscribe(observer); // duplicate — Set de-dupes

      const ch = makeChannel("connecting");
      svc.setOfferChannel(ch as unknown as RTCDataChannel);

      // notifyStateChanged fires once (initial) — observer should only receive it once
      expect(onStateChanged).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // setOfferChannel()
  // ──────────────────────────────────────────────────────────────────────────

  describe("setOfferChannel()", () => {
    it("notifies observers of the initial channel state", () => {
      const { observer, onStateChanged } = makeObserver();
      svc.subscribe(observer);

      const ch = makeChannel("connecting");
      svc.setOfferChannel(ch as unknown as RTCDataChannel);

      expect(onStateChanged).toHaveBeenCalledWith("connecting", "offer");
    });

    it("notifies observers when the channel opens (onopen fires)", () => {
      const { observer, onStateChanged } = makeObserver();
      svc.subscribe(observer);

      const ch = makeChannel("connecting");
      svc.setOfferChannel(ch as unknown as RTCDataChannel);
      ch.onopen?.(new Event("open"));

      expect(onStateChanged).toHaveBeenCalledWith("open", "offer");
    });

    it("notifies observers when the channel closes (onclose fires)", () => {
      const { observer, onStateChanged } = makeObserver();
      svc.subscribe(observer);

      const ch = makeChannel("open");
      svc.setOfferChannel(ch as unknown as RTCDataChannel);
      ch.onclose?.(new Event("close"));

      expect(onStateChanged).toHaveBeenCalledWith("closed", "offer");
    });

    it("notifies observers on error (onerror fires)", () => {
      const { observer, onError } = makeObserver();
      svc.subscribe(observer);

      const ch = makeChannel("open");
      svc.setOfferChannel(ch as unknown as RTCDataChannel);
      const errorEvt = new Event("error");
      ch.onerror?.(errorEvt);

      expect(onError).toHaveBeenCalledWith(errorEvt, "offer");
    });

    it("does NOT attach an onmessage handler to the offer channel", () => {
      const ch = makeChannel("open");
      svc.setOfferChannel(ch as unknown as RTCDataChannel);
      // offer channel is send-only — no message handler
      expect(ch.onmessage).toBeNull();
    });

    it("cleans up the previous channel when replacing it", () => {
      const old = makeChannel("open");
      svc.setOfferChannel(old as unknown as RTCDataChannel);

      const fresh = makeChannel("connecting");
      svc.setOfferChannel(fresh as unknown as RTCDataChannel);

      // Old channel handlers should be nulled out
      expect(old.onopen).toBeNull();
      expect(old.onclose).toBeNull();
      expect(old.onerror).toBeNull();
      // Old open channel should have been closed
      expect(old.close).toHaveBeenCalled();
    });

    it("notifies observers with 'closed' when set to null", () => {
      const { observer, onStateChanged } = makeObserver();
      svc.subscribe(observer);

      svc.setOfferChannel(null);

      expect(onStateChanged).toHaveBeenCalledWith("closed", "offer");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // setAnswerChannel()
  // ──────────────────────────────────────────────────────────────────────────

  describe("setAnswerChannel()", () => {
    it("attaches an onmessage handler to the answer channel", () => {
      const ch = makeChannel("open");
      svc.setAnswerChannel(ch as unknown as RTCDataChannel);
      expect(ch.onmessage).not.toBeNull();
    });

    it("does NOT emit 'open' state immediately for already-open answer channel", () => {
      const { observer, onStateChanged } = makeObserver();
      svc.subscribe(observer);

      const ch = makeChannel("open");
      svc.setAnswerChannel(ch as unknown as RTCDataChannel);

      // The service deliberately skips the initial 'open' notification for answer channel
      expect(onStateChanged).not.toHaveBeenCalledWith("open", "answer");
    });

    it("emits state for non-open answer channel on set", () => {
      const { observer, onStateChanged } = makeObserver();
      svc.subscribe(observer);

      const ch = makeChannel("connecting");
      svc.setAnswerChannel(ch as unknown as RTCDataChannel);

      expect(onStateChanged).toHaveBeenCalledWith("connecting", "answer");
    });

    it("notifies observers when the answer channel opens via DOM event", () => {
      const { observer, onStateChanged } = makeObserver();
      svc.subscribe(observer);

      const ch = makeChannel("connecting");
      svc.setAnswerChannel(ch as unknown as RTCDataChannel);
      ch.onopen?.(new Event("open"));

      expect(onStateChanged).toHaveBeenCalledWith("open", "answer");
    });

    it("broadcasts messages received on the answer channel to all observers", async () => {
      const { observer, onMessage } = makeObserver();
      svc.subscribe(observer);

      const ch = makeChannel("open");
      svc.setAnswerChannel(ch as unknown as RTCDataChannel);

      const messageEvent = new MessageEvent("message", { data: "hello" });
      ch.onmessage?.(messageEvent);

      // handleMessage is async — allow microtasks to flush
      await Promise.resolve();

      expect(onMessage).toHaveBeenCalledWith(messageEvent);
    });

    it("ignores a message whose data is of an unsupported type and logs a warning", async () => {
      const { observer, onMessage } = makeObserver();
      svc.subscribe(observer);

      const ch = makeChannel("open");
      svc.setAnswerChannel(ch as unknown as RTCDataChannel);

      // MessageEvent normally carries string/ArrayBuffer/Blob — simulate an
      // unsupported type (e.g. a number) reaching the handler.
      const messageEvent = new MessageEvent("message", { data: 42 });
      ch.onmessage?.(messageEvent);
      await Promise.resolve();

      expect(onMessage).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Unknown message type: number",
        "WebRTCDataChannelService"
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Observer error resilience — a throwing observer must not break notification
  // to the remaining observers, and the error is logged instead of propagated.
  // ──────────────────────────────────────────────────────────────────────────

  describe("Observer error resilience", () => {
    it("continues notifying other observers when one onDataChannelMessage handler throws", async () => {
      const throwingObserver: DataChannelObserver = {
        onDataChannelMessage: jest.fn(() => {
          throw new Error("boom");
        }),
      };
      const { observer: healthyObserver, onMessage } = makeObserver();

      svc.subscribe(throwingObserver);
      svc.subscribe(healthyObserver);

      const ch = makeChannel("open");
      svc.setAnswerChannel(ch as unknown as RTCDataChannel);

      const messageEvent = new MessageEvent("message", { data: "hello" });
      ch.onmessage?.(messageEvent);
      await Promise.resolve();
      await Promise.resolve();

      expect(onMessage).toHaveBeenCalledWith(messageEvent);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error in observer message handler:",
        "WebRTCDataChannelService",
        expect.any(Error)
      );
    });

    it("continues notifying other observers when one onDataChannelStateChanged handler throws", () => {
      const throwingObserver: DataChannelObserver = {
        onDataChannelStateChanged: jest.fn(() => {
          throw new Error("boom");
        }),
      };
      const { observer: healthyObserver, onStateChanged } = makeObserver();

      svc.subscribe(throwingObserver);
      svc.subscribe(healthyObserver);

      const ch = makeChannel("connecting");
      expect(() => svc.setOfferChannel(ch as unknown as RTCDataChannel)).not.toThrow();

      expect(onStateChanged).toHaveBeenCalledWith("connecting", "offer");
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error in observer state change handler:",
        "WebRTCDataChannelService",
        expect.any(Error)
      );
    });

    it("continues notifying other observers when one onDataChannelError handler throws", () => {
      const throwingObserver: DataChannelObserver = {
        onDataChannelError: jest.fn(() => {
          throw new Error("boom");
        }),
      };
      const { observer: healthyObserver, onError } = makeObserver();

      svc.subscribe(throwingObserver);
      svc.subscribe(healthyObserver);

      const ch = makeChannel("open");
      svc.setOfferChannel(ch as unknown as RTCDataChannel);

      expect(() => ch.onerror?.(new Event("error"))).not.toThrow();

      expect(onError).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error in observer error handler:",
        "WebRTCDataChannelService",
        expect.any(Error)
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // send()
  // ──────────────────────────────────────────────────────────────────────────

  describe("send()", () => {
    it("calls offerChannel.send() with the message", () => {
      const ch = makeChannel("open");
      svc.setOfferChannel(ch as unknown as RTCDataChannel);

      svc.send("ping");

      expect(ch.send).toHaveBeenCalledWith("ping");
    });

    it("throws when offer channel is not set", () => {
      expect(() => svc.send("hello")).toThrow(/Offer channel not set/i);
    });

    it("throws when offer channel is not open", () => {
      const ch = makeChannel("connecting");
      svc.setOfferChannel(ch as unknown as RTCDataChannel);

      expect(() => svc.send("hello")).toThrow(/connecting/i);
    });

    it("re-throws errors from the underlying send call", () => {
      const ch = makeChannel("open");
      ch.send.mockImplementation(() => { throw new Error("network failure"); });
      svc.setOfferChannel(ch as unknown as RTCDataChannel);

      expect(() => svc.send("hello")).toThrow("network failure");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Channel status getters
  // ──────────────────────────────────────────────────────────────────────────

  describe("Status getters", () => {
    it("isOfferChannelOpen is false when no offer channel is set", () => {
      expect(svc.isOfferChannelOpen).toBe(false);
    });

    it("isOfferChannelOpen is true when offer channel is open", () => {
      svc.setOfferChannel(makeChannel("open") as unknown as RTCDataChannel);
      expect(svc.isOfferChannelOpen).toBe(true);
    });

    it("isAnswerChannelOpen is false when no answer channel is set", () => {
      expect(svc.isAnswerChannelOpen).toBe(false);
    });

    it("isAnswerChannelOpen is true when answer channel is open", () => {
      svc.setAnswerChannel(makeChannel("open") as unknown as RTCDataChannel);
      expect(svc.isAnswerChannelOpen).toBe(true);
    });

    it("isReadyForCommunication is true only when both channels are open", () => {
      svc.setOfferChannel(makeChannel("open")  as unknown as RTCDataChannel);
      svc.setAnswerChannel(makeChannel("open") as unknown as RTCDataChannel);
      expect(svc.isReadyForCommunication).toBe(true);
    });

    it("isReadyForCommunication is false when only one channel is open", () => {
      svc.setOfferChannel(makeChannel("open") as unknown as RTCDataChannel);
      expect(svc.isReadyForCommunication).toBe(false);
    });

    it("getChannelStatus() reports 'not-set' when channels are absent", () => {
      const status = svc.getChannelStatus();
      expect(status.offer.state).toBe("not-set");
      expect(status.answer.state).toBe("not-set");
    });

    it("getChannelStatus() reports correct state and label when channels are set", () => {
      svc.setOfferChannel(makeChannel("open", "offer-ch")  as unknown as RTCDataChannel);
      svc.setAnswerChannel(makeChannel("open", "answer-ch") as unknown as RTCDataChannel);

      const status = svc.getChannelStatus();
      expect(status.offer.state).toBe("open");
      expect(status.offer.label).toBe("offer-ch");
      expect(status.answer.state).toBe("open");
      expect(status.answer.label).toBe("answer-ch");
      expect(status.canSend).toBe(true);
      expect(status.canReceive).toBe(true);
      expect(status.isReadyForCommunication).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // reset()
  // ──────────────────────────────────────────────────────────────────────────

  describe("reset()", () => {
    it("clears both channels", () => {
      svc.setOfferChannel(makeChannel("open")  as unknown as RTCDataChannel);
      svc.setAnswerChannel(makeChannel("open") as unknown as RTCDataChannel);

      svc.reset();

      expect(svc.getOfferChannel()).toBeNull();
      expect(svc.getAnswerChannel()).toBeNull();
    });

    it("removes all observers", () => {
      const { observer } = makeObserver();
      svc.subscribe(observer);

      svc.reset();

      expect(svc.isSubscribed(observer)).toBe(false);
    });
  });
});
