/* eslint-disable no-undef */
/**
 * Unit Tests for TimeoutManager
 *
 * Tests timer lifecycle: start, cancel, cancelAll, reset, queries, and stats.
 * Uses jest.useFakeTimers() so no real wall-clock time is consumed.
 *
 * Logger is mocked to keep test output clean.
 */

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => mockLogger),
}));

import { TimeoutManager } from "@infra/sip/TimeoutManager";

describe("TimeoutManager", () => {
  let manager: TimeoutManager;

  beforeEach(() => {
    jest.useFakeTimers();
    manager = new TimeoutManager();
    Object.values(mockLogger).forEach((fn) => fn.mockClear());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // startTimer
  // ──────────────────────────────────────────────────────────────────────────

  describe("startTimer", () => {
    it("should fire the callback after the specified duration", () => {
      const cb = jest.fn();
      manager.startTimer("test", 3000, cb);

      jest.advanceTimersByTime(3001);

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("should NOT fire the callback before the duration elapses", () => {
      const cb = jest.fn();
      manager.startTimer("test", 3000, cb);

      jest.advanceTimersByTime(2999);

      expect(cb).not.toHaveBeenCalled();
    });

    it("should register the timer as active immediately", () => {
      manager.startTimer("active-timer", 5000, jest.fn());
      expect(manager.isTimerActive("active-timer")).toBe(true);
    });

    it("should remove the timer from active list after it fires", () => {
      manager.startTimer("fire-me", 1000, jest.fn());
      jest.advanceTimersByTime(1001);
      expect(manager.isTimerActive("fire-me")).toBe(false);
    });

    it("should cancel an existing timer with the same name before starting a new one", () => {
      const firstCb = jest.fn();
      const secondCb = jest.fn();

      manager.startTimer("dupe", 5000, firstCb);
      manager.startTimer("dupe", 1000, secondCb); // replaces the first

      jest.advanceTimersByTime(5001);

      expect(firstCb).not.toHaveBeenCalled();
      expect(secondCb).toHaveBeenCalledTimes(1);
    });

    it("should support multiple independent timers", () => {
      const cbA = jest.fn();
      const cbB = jest.fn();

      manager.startTimer("A", 1000, cbA);
      manager.startTimer("B", 2000, cbB);

      jest.advanceTimersByTime(1001);
      expect(cbA).toHaveBeenCalledTimes(1);
      expect(cbB).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      expect(cbB).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // cancelTimer
  // ──────────────────────────────────────────────────────────────────────────

  describe("cancelTimer", () => {
    it("should return true when the timer exists", () => {
      manager.startTimer("cancel-me", 5000, jest.fn());
      expect(manager.cancelTimer("cancel-me")).toBe(true);
    });

    it("should return false when the timer does not exist", () => {
      expect(manager.cancelTimer("no-such-timer")).toBe(false);
    });

    it("should prevent the callback from firing after cancellation", () => {
      const cb = jest.fn();
      manager.startTimer("cancel-me", 2000, cb);
      manager.cancelTimer("cancel-me");

      jest.advanceTimersByTime(5000);

      expect(cb).not.toHaveBeenCalled();
    });

    it("should remove the timer from active list", () => {
      manager.startTimer("gone", 5000, jest.fn());
      manager.cancelTimer("gone");
      expect(manager.isTimerActive("gone")).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // cancelAllTimers
  // ──────────────────────────────────────────────────────────────────────────

  describe("cancelAllTimers", () => {
    it("should cancel every active timer", () => {
      const cbA = jest.fn();
      const cbB = jest.fn();
      const cbC = jest.fn();

      manager.startTimer("A", 1000, cbA);
      manager.startTimer("B", 2000, cbB);
      manager.startTimer("C", 3000, cbC);

      manager.cancelAllTimers();
      jest.advanceTimersByTime(5000);

      expect(cbA).not.toHaveBeenCalled();
      expect(cbB).not.toHaveBeenCalled();
      expect(cbC).not.toHaveBeenCalled();
    });

    it("should leave zero active timers afterwards", () => {
      manager.startTimer("X", 1000, jest.fn());
      manager.startTimer("Y", 2000, jest.fn());
      manager.cancelAllTimers();
      expect(manager.getActiveTimers()).toHaveLength(0);
    });

    it("should be a no-op when there are no active timers", () => {
      expect(() => manager.cancelAllTimers()).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // isTimerActive
  // ──────────────────────────────────────────────────────────────────────────

  describe("isTimerActive", () => {
    it("should return true for a running timer", () => {
      manager.startTimer("running", 5000, jest.fn());
      expect(manager.isTimerActive("running")).toBe(true);
    });

    it("should return false for an unknown timer name", () => {
      expect(manager.isTimerActive("unknown")).toBe(false);
    });

    it("should return false after the timer fires", () => {
      manager.startTimer("auto-cleanup", 100, jest.fn());
      jest.advanceTimersByTime(200);
      expect(manager.isTimerActive("auto-cleanup")).toBe(false);
    });

    it("should return false after the timer is cancelled", () => {
      manager.startTimer("to-cancel", 5000, jest.fn());
      manager.cancelTimer("to-cancel");
      expect(manager.isTimerActive("to-cancel")).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getRemainingTime
  // ──────────────────────────────────────────────────────────────────────────

  describe("getRemainingTime", () => {
    it("should return 0 for a non-existent timer", () => {
      expect(manager.getRemainingTime("ghost")).toBe(0);
    });

    it("should return the full duration immediately after starting", () => {
      manager.startTimer("fresh", 5000, jest.fn());
      const remaining = manager.getRemainingTime("fresh");
      // Allow a small margin since Date.now() runs between startTimer and getRemainingTime
      expect(remaining).toBeGreaterThanOrEqual(4990);
      expect(remaining).toBeLessThanOrEqual(5000);
    });

    it("should decrease as time passes", () => {
      manager.startTimer("ticking", 5000, jest.fn());
      jest.advanceTimersByTime(2000);
      const remaining = manager.getRemainingTime("ticking");
      expect(remaining).toBeGreaterThanOrEqual(2990);
      expect(remaining).toBeLessThanOrEqual(3000);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // resetTimer
  // ──────────────────────────────────────────────────────────────────────────

  describe("resetTimer", () => {
    it("should return false for a non-existent timer", () => {
      expect(manager.resetTimer("ghost")).toBe(false);
    });

    it("should return true for an existing timer", () => {
      manager.startTimer("live", 5000, jest.fn());
      expect(manager.resetTimer("live")).toBe(true);
    });

    it("should restart the timer so the callback fires after the new full duration", () => {
      const cb = jest.fn();
      manager.startTimer("reset-me", 5000, cb);

      jest.advanceTimersByTime(4000); // almost expired
      manager.resetTimer("reset-me", 3000); // restart with 3s

      jest.advanceTimersByTime(2999); // 2999ms into the new timer — should not fire yet
      expect(cb).not.toHaveBeenCalled();

      jest.advanceTimersByTime(2);   // push past 3000ms
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("should use the original duration when no newDuration is given", () => {
      const cb = jest.fn();
      manager.startTimer("original", 2000, cb);
      jest.advanceTimersByTime(1500);
      manager.resetTimer("original"); // no new duration → reuse 2000

      jest.advanceTimersByTime(1999); // not yet
      expect(cb).not.toHaveBeenCalled();

      jest.advanceTimersByTime(2);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getActiveTimers
  // ──────────────────────────────────────────────────────────────────────────

  describe("getActiveTimers", () => {
    it("should return an empty array when no timers are active", () => {
      expect(manager.getActiveTimers()).toEqual([]);
    });

    it("should list all active timer names", () => {
      manager.startTimer("alpha", 1000, jest.fn());
      manager.startTimer("beta", 2000, jest.fn());
      expect(manager.getActiveTimers()).toEqual(expect.arrayContaining(["alpha", "beta"]));
      expect(manager.getActiveTimers()).toHaveLength(2);
    });

    it("should remove a timer from the list after it fires", () => {
      manager.startTimer("short", 500, jest.fn());
      jest.advanceTimersByTime(600);
      expect(manager.getActiveTimers()).not.toContain("short");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getTimerInfo
  // ──────────────────────────────────────────────────────────────────────────

  describe("getTimerInfo", () => {
    it("should return undefined for a non-existent timer", () => {
      expect(manager.getTimerInfo("none")).toBeUndefined();
    });

    it("should return correct duration, elapsed and remaining", () => {
      manager.startTimer("info-timer", 6000, jest.fn());
      jest.advanceTimersByTime(2000);

      const info = manager.getTimerInfo("info-timer");
      expect(info).toBeDefined();
      expect(info!.duration).toBe(6000);
      expect(info!.elapsed).toBeGreaterThanOrEqual(2000);
      expect(info!.remaining).toBeLessThanOrEqual(4000);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getStats
  // ──────────────────────────────────────────────────────────────────────────

  describe("getStats", () => {
    it("should start with zero stats on a fresh instance", () => {
      expect(manager.getStats()).toEqual({ active: 0, created: 0, cleared: 0 });
    });

    it("should increment created count on each startTimer call", () => {
      manager.startTimer("A", 1000, jest.fn());
      manager.startTimer("B", 1000, jest.fn());
      expect(manager.getStats().created).toBe(2);
    });

    it("should increment cleared count on each cancelTimer call", () => {
      manager.startTimer("X", 1000, jest.fn());
      manager.cancelTimer("X");
      expect(manager.getStats().cleared).toBe(1);
    });

    it("should reflect active count correctly", () => {
      manager.startTimer("P", 1000, jest.fn());
      manager.startTimer("Q", 1000, jest.fn());
      manager.cancelTimer("P");
      expect(manager.getStats().active).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // logActiveTimers
  // ──────────────────────────────────────────────────────────────────────────

  describe("logActiveTimers", () => {
    it("should log 'No active timers' when there are none", () => {
      manager.logActiveTimers();
      expect(mockLogger.debug).toHaveBeenCalledWith("No active timers", "TimeoutManager");
    });

    it("should not iterate or log per-timer details when there are none", () => {
      manager.logActiveTimers();
      const perTimerLog = mockLogger.debug.mock.calls.find(([msg]) =>
        typeof msg === "string" && msg.startsWith("  - ")
      );
      expect(perTimerLog).toBeUndefined();
    });

    it("should log details for each active timer", () => {
      manager.startTimer("A", 5000, jest.fn());
      manager.startTimer("B", 10000, jest.fn());
      mockLogger.debug.mockClear();

      manager.logActiveTimers();

      expect(mockLogger.debug).toHaveBeenCalledWith("Active timers (2):", "TimeoutManager");
      const perTimerLogs = mockLogger.debug.mock.calls
        .map(([msg]) => msg)
        .filter((msg) => typeof msg === "string" && msg.startsWith("  - "));
      expect(perTimerLogs).toHaveLength(2);
      expect(perTimerLogs.some((m) => m.includes("A:"))).toBe(true);
      expect(perTimerLogs.some((m) => m.includes("B:"))).toBe(true);
    });

    it("should reflect elapsed/remaining time after time has passed", () => {
      manager.startTimer("A", 10000, jest.fn());
      jest.advanceTimersByTime(4000);
      mockLogger.debug.mockClear();

      manager.logActiveTimers();

      const line = mockLogger.debug.mock.calls
        .map(([msg]) => msg)
        .find((msg) => typeof msg === "string" && msg.startsWith("  - A:"));
      expect(line).toContain("4000ms elapsed");
      expect(line).toContain("6000ms remaining");
    });
  });
});
