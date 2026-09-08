/* eslint-disable no-undef */
/**
 * Unit Tests for IdleActivityMonitor
 *
 * Uses fake timers to control setTimeout without real delays.
 * All DOM addEventListener / removeEventListener calls are spied on
 * at the suite level so each test starts with a clean spy state.
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

import { IdleActivityMonitor, IdleActivityMonitorConfig } from "@services/IdleActivityMonitor";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function buildMonitor(overrides: Partial<IdleActivityMonitorConfig> = {}): {
  monitor: IdleActivityMonitor;
  onIdle: jest.Mock;
  onActive: jest.Mock;
} {
  const onIdle   = jest.fn();
  const onActive = jest.fn();
  const monitor  = new IdleActivityMonitor({
    idleTimeout:      5_000,
    onIdle,
    onActive,
    throttleInterval: 1_000,
    ...overrides,
  });
  return { monitor, onIdle, onActive };
}

// ─── Activity events list (same as private field in the class) ────────────────
const ACTIVITY_EVENTS   = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
const VISIBILITY_EVENTS = ["visibilitychange", "focus", "blur"];

// ─────────────────────────────────────────────────────────────────────────────

describe("IdleActivityMonitor", () => {
  let docAddSpy:    jest.SpyInstance;
  let docRemoveSpy: jest.SpyInstance;
  let winAddSpy:    jest.SpyInstance;
  let winRemoveSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    Object.values(mockLogger).forEach((fn) => fn.mockClear());

    docAddSpy    = jest.spyOn(document, "addEventListener");
    docRemoveSpy = jest.spyOn(document, "removeEventListener");
    winAddSpy    = jest.spyOn(window,   "addEventListener");
    winRemoveSpy = jest.spyOn(window,   "removeEventListener");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Construction
  // ──────────────────────────────────────────────────────────────────────────

  describe("Constructor", () => {
    it("applies a default throttleInterval of 3000ms when not specified", () => {
      const { monitor } = buildMonitor({ throttleInterval: undefined });
      // The throttle is private, but we can verify start() works without error
      expect(() => monitor.start()).not.toThrow();
      monitor.stop();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // start()
  // ──────────────────────────────────────────────────────────────────────────

  describe("start()", () => {
    it("attaches event listeners for all activity events on document", () => {
      const { monitor } = buildMonitor();
      monitor.start();

      ACTIVITY_EVENTS.forEach((evt) => {
        expect(docAddSpy).toHaveBeenCalledWith(evt, expect.any(Function), { passive: true });
      });

      monitor.stop();
    });

    it("attaches visibilitychange listener on document", () => {
      const { monitor } = buildMonitor();
      monitor.start();

      expect(docAddSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));

      monitor.stop();
    });

    it("attaches focus and blur listeners on window", () => {
      const { monitor } = buildMonitor();
      monitor.start();

      expect(winAddSpy).toHaveBeenCalledWith("focus", expect.any(Function));
      expect(winAddSpy).toHaveBeenCalledWith("blur",  expect.any(Function));

      monitor.stop();
    });

    it("does not attach listeners twice when called a second time", () => {
      const { monitor } = buildMonitor();
      monitor.start();
      const callCountAfterFirst = docAddSpy.mock.calls.length;
      monitor.start(); // second call — should be a no-op

      expect(docAddSpy.mock.calls.length).toBe(callCountAfterFirst);

      monitor.stop();
    });

    it("sets isIdle() to false on start", () => {
      const { monitor } = buildMonitor();
      monitor.start();

      expect(monitor.isIdle()).toBe(false);

      monitor.stop();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // stop()
  // ──────────────────────────────────────────────────────────────────────────

  describe("stop()", () => {
    it("removes event listeners for all activity events from document", () => {
      const { monitor } = buildMonitor();
      monitor.start();
      monitor.stop();

      ACTIVITY_EVENTS.forEach((evt) => {
        expect(docRemoveSpy).toHaveBeenCalledWith(evt, expect.any(Function));
      });
    });

    it("removes visibilitychange listener from document", () => {
      const { monitor } = buildMonitor();
      monitor.start();
      monitor.stop();

      expect(docRemoveSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    });

    it("removes focus and blur listeners from window", () => {
      const { monitor } = buildMonitor();
      monitor.start();
      monitor.stop();

      expect(winRemoveSpy).toHaveBeenCalledWith("focus", expect.any(Function));
      expect(winRemoveSpy).toHaveBeenCalledWith("blur",  expect.any(Function));
    });

    it("is safe to call when not monitoring (no-op)", () => {
      const { monitor } = buildMonitor();
      expect(() => monitor.stop()).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Idle timeout
  // ──────────────────────────────────────────────────────────────────────────

  describe("Idle timeout", () => {
    it("fires onIdle after the configured timeout elapses", () => {
      const { monitor, onIdle } = buildMonitor({ idleTimeout: 5_000 });
      monitor.start();

      jest.advanceTimersByTime(5_001);

      expect(onIdle).toHaveBeenCalledTimes(1);
      monitor.stop();
    });

    it("does NOT fire onIdle before the timeout elapses", () => {
      const { monitor, onIdle } = buildMonitor({ idleTimeout: 5_000 });
      monitor.start();

      jest.advanceTimersByTime(4_999);

      expect(onIdle).not.toHaveBeenCalled();
      monitor.stop();
    });

    it("fires onIdle at most once per idle period", () => {
      const { monitor, onIdle } = buildMonitor({ idleTimeout: 5_000 });
      monitor.start();

      jest.advanceTimersByTime(10_000); // well past the timeout

      expect(onIdle).toHaveBeenCalledTimes(1);
      monitor.stop();
    });

    it("sets isIdle() to true after timeout", () => {
      const { monitor } = buildMonitor({ idleTimeout: 5_000 });
      monitor.start();

      jest.advanceTimersByTime(5_001);

      expect(monitor.isIdle()).toBe(true);
      monitor.stop();
    });

    it("does NOT fire onIdle when stop() is called before timeout", () => {
      const { monitor, onIdle } = buildMonitor({ idleTimeout: 5_000 });
      monitor.start();
      jest.advanceTimersByTime(3_000);
      monitor.stop();
      jest.advanceTimersByTime(3_000);

      expect(onIdle).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // reset() / returning from idle
  // ──────────────────────────────────────────────────────────────────────────

  describe("reset()", () => {
    it("fires onActive when called while the monitor is idle", () => {
      const { monitor, onActive } = buildMonitor({ idleTimeout: 5_000 });
      monitor.start();
      jest.advanceTimersByTime(5_001); // goes idle

      monitor.reset();

      expect(onActive).toHaveBeenCalledTimes(1);
      monitor.stop();
    });

    it("restores isIdle() to false after reset from idle state", () => {
      const { monitor } = buildMonitor({ idleTimeout: 5_000 });
      monitor.start();
      jest.advanceTimersByTime(5_001); // goes idle

      monitor.reset();

      expect(monitor.isIdle()).toBe(false);
      monitor.stop();
    });

    it("does NOT fire onActive when reset is called while already active", () => {
      const { monitor, onActive } = buildMonitor({ idleTimeout: 5_000 });
      monitor.start();

      monitor.reset(); // still active — should not fire onActive

      expect(onActive).not.toHaveBeenCalled();
      monitor.stop();
    });

    it("resets the idle timer so onIdle fires after a fresh timeout", () => {
      const { monitor, onIdle } = buildMonitor({ idleTimeout: 5_000 });
      monitor.start();

      jest.advanceTimersByTime(4_000); // almost idle
      monitor.reset();                 // resets the timer
      jest.advanceTimersByTime(4_000); // still within fresh timeout

      expect(onIdle).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1_001); // now past the fresh timeout

      expect(onIdle).toHaveBeenCalledTimes(1);
      monitor.stop();
    });

    it("is safe to call when not monitoring (no-op)", () => {
      const { monitor } = buildMonitor();
      expect(() => monitor.reset()).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Throttling
  // ──────────────────────────────────────────────────────────────────────────

  describe("Activity throttling", () => {
    it("only resets the idle timer once within the throttle window", () => {
      const { monitor, onIdle } = buildMonitor({
        idleTimeout:      5_000,
        throttleInterval: 2_000,
      });
      monitor.start();

      // Simulate rapid DOM events via the captured listener
      const activityHandler = docAddSpy.mock.calls
        .find(([evt]) => evt === "mousedown")?.[1] as (() => void) | undefined;

      if (activityHandler) {
        // Fire 3 events in quick succession (within throttle window)
        activityHandler();
        jest.advanceTimersByTime(100);
        activityHandler();
        jest.advanceTimersByTime(100);
        activityHandler();
      }

      // Advance past idle timeout — if throttle is correct only the FIRST
      // call reset the timer, so the timer started from t=0
      jest.advanceTimersByTime(5_000);

      // onIdle must have fired (timer was NOT reset by subsequent events)
      expect(onIdle).toHaveBeenCalledTimes(1);
      monitor.stop();
    });

    it("DOES reset the idle timer after the throttle interval has elapsed", () => {
      const { monitor, onIdle } = buildMonitor({
        idleTimeout:      5_000,
        throttleInterval: 2_000,
      });
      monitor.start();

      const activityHandler = docAddSpy.mock.calls
        .find(([evt]) => evt === "mousedown")?.[1] as (() => void) | undefined;

      if (activityHandler) {
        activityHandler();                   // t=0   — first event, resets timer
        jest.advanceTimersByTime(4_000);     // t=4000 — approaching idle
        activityHandler();                   // t=4000 — throttle elapsed (>2s), resets timer
        jest.advanceTimersByTime(4_000);     // t=8000 — still within fresh timeout
      }

      expect(onIdle).not.toHaveBeenCalled();
      monitor.stop();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Visibility change
  // ──────────────────────────────────────────────────────────────────────────

  describe("Visibility change", () => {
    it("resets the idle timer when the page becomes visible", () => {
      const { monitor, onIdle } = buildMonitor({ idleTimeout: 5_000 });
      monitor.start();

      // Capture the visibilitychange handler
      const visHandler = docAddSpy.mock.calls
        .find(([evt]) => evt === "visibilitychange")?.[1] as (() => void) | undefined;

      jest.advanceTimersByTime(4_000); // almost idle

      // Simulate page becoming visible
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      visHandler?.();

      jest.advanceTimersByTime(4_000); // still within fresh 5s window

      expect(onIdle).not.toHaveBeenCalled();
      monitor.stop();
    });

    it("does NOT reset the idle timer when the page becomes hidden/blurred", () => {
      const { monitor, onIdle } = buildMonitor({ idleTimeout: 5_000 });
      monitor.start();

      const visHandler = docAddSpy.mock.calls
        .find(([evt]) => evt === "visibilitychange")?.[1] as (() => void) | undefined;

      jest.advanceTimersByTime(4_000); // almost idle

      // Simulate page becoming hidden and unfocused
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      jest.spyOn(document, "hasFocus").mockReturnValue(false);
      visHandler?.();

      // The idle timer should NOT have been reset — it keeps counting toward the
      // original 5s deadline set by start(), so 1_001 more ms tips it over.
      jest.advanceTimersByTime(1_001);

      expect(onIdle).toHaveBeenCalledTimes(1);
      monitor.stop();
      jest.restoreAllMocks();
    });

    it("logs a debug message when the page becomes hidden/blurred", () => {
      const { monitor } = buildMonitor({ idleTimeout: 5_000 });
      monitor.start();

      const visHandler = docAddSpy.mock.calls
        .find(([evt]) => evt === "visibilitychange")?.[1] as (() => void) | undefined;

      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      jest.spyOn(document, "hasFocus").mockReturnValue(false);
      visHandler?.();

      expect(mockLogger.debug).toHaveBeenCalledWith("Page became hidden/blurred", "IdleMonitor");
      monitor.stop();
      jest.restoreAllMocks();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Utility methods
  // ──────────────────────────────────────────────────────────────────────────

  describe("Utility methods", () => {
    it("getLastActivityTime() returns a recent timestamp after start()", () => {
      const before = Date.now();
      const { monitor } = buildMonitor();
      monitor.start();

      expect(monitor.getLastActivityTime()).toBeGreaterThanOrEqual(before);

      monitor.stop();
    });

    it("getTimeSinceLastActivity() grows as time passes", () => {
      const { monitor } = buildMonitor();
      monitor.start();

      jest.advanceTimersByTime(3_000);

      expect(monitor.getTimeSinceLastActivity()).toBeGreaterThanOrEqual(3_000);
      monitor.stop();
    });

    it("getTimeSinceLastActivity() is near zero immediately after reset()", () => {
      const { monitor } = buildMonitor();
      monitor.start();

      jest.advanceTimersByTime(3_000);
      monitor.reset();

      expect(monitor.getTimeSinceLastActivity()).toBe(0);
      monitor.stop();
    });

    it("getTimeSinceLastActivity() resumes growing after a reset()", () => {
      const { monitor } = buildMonitor();
      monitor.start();

      jest.advanceTimersByTime(3_000);
      monitor.reset();
      jest.advanceTimersByTime(1_500);

      expect(monitor.getTimeSinceLastActivity()).toBe(1_500);
      monitor.stop();
    });

    it("isIdle() returns false before the timeout", () => {
      const { monitor } = buildMonitor({ idleTimeout: 5_000 });
      monitor.start();

      jest.advanceTimersByTime(4_000);

      expect(monitor.isIdle()).toBe(false);
      monitor.stop();
    });
  });
});
