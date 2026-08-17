/* eslint-disable no-undef */
/**
 * Component Tests for tabs/shared/CacheStatsPanel.tsx
 *
 * cacheStatistics (singleton) and cacheService are mocked directly — no
 * Redux/devextreme dependencies.
 *
 * Covers:
 *  - Subscribes to cacheStatistics on mount, unsubscribes on unmount
 *  - Auto-refresh toggle gates whether subscription updates apply
 *  - handleRefresh() re-pulls stats on demand
 *  - handleLogStats() delegates to cacheService.logStatistics()
 *  - handleReset(): confirm-gated, resets stats only when confirmed
 *  - Derived values: hit-rate color thresholds, bytesSaved calculation,
 *    per-type hit-rate calculation and top-5 sort/slice, storage usage percent
 */

const mockGetStats = jest.fn();
const mockSubscribe = jest.fn();
const mockGetHitRate = jest.fn();
const mockGetCompressionEffectiveness = jest.fn();
const mockGetAvgCompressionTime = jest.fn();
const mockGetUptime = jest.fn();
const mockReset = jest.fn();

jest.mock("@infra/cache/utils/CacheStatistics", () => ({
  cacheStatistics: {
    getStats: (...args: any[]) => mockGetStats(...args),
    subscribe: (...args: any[]) => mockSubscribe(...args),
    getHitRate: (...args: any[]) => mockGetHitRate(...args),
    getCompressionEffectiveness: (...args: any[]) => mockGetCompressionEffectiveness(...args),
    getAvgCompressionTime: (...args: any[]) => mockGetAvgCompressionTime(...args),
    getUptime: (...args: any[]) => mockGetUptime(...args),
    reset: (...args: any[]) => mockReset(...args),
  },
}));

const mockLogStatistics = jest.fn();
jest.mock("@infra/cache", () => ({
  cacheService: { logStatistics: (...args: any[]) => mockLogStatistics(...args) },
}));

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import * as React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import CacheStatsPanel from "@components/tabs/shared/CacheStatsPanel";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStats(overrides: Record<string, any> = {}) {
  return {
    operations: { hits: 10, misses: 5, writes: 3, evictions: 1, errors: 0 },
    compression: {
      compressions: 2,
      decompressions: 1,
      bytesBeforeCompression: 1000,
      bytesAfterCompression: 400,
      totalCompressionTime: 20,
      totalDecompressionTime: 5,
      expansions: 0,
    },
    storage: {
      local: { entryCount: 5, bytesUsed: 1024, bytesQuota: 10240 },
    },
    perType: {
      documents: { hits: 8, misses: 2, writes: 1, lastAccessed: null, lastUpdated: null },
    },
    startTime: Date.now(),
    lastResetTime: Date.now(),
    totalOperations: 18,
    ...overrides,
  };
}

describe("CacheStatsPanel", () => {
  let unsubscribe: jest.Mock;
  let subscribedListener: ((stats: any) => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribe = jest.fn();
    subscribedListener = undefined;
    mockSubscribe.mockImplementation((listener: (stats: any) => void) => {
      subscribedListener = listener;
      return unsubscribe;
    });
    mockGetStats.mockReturnValue(makeStats());
    mockGetHitRate.mockReturnValue(66.7);
    mockGetCompressionEffectiveness.mockReturnValue(60);
    mockGetAvgCompressionTime.mockReturnValue(10);
    mockGetUptime.mockReturnValue(120);
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Subscription lifecycle
  // ──────────────────────────────────────────────────────────────────────────

  describe("subscription lifecycle", () => {
    it("subscribes to cacheStatistics on mount", () => {
      render(<CacheStatsPanel />);
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });

    it("unsubscribes on unmount", () => {
      const { unmount } = render(<CacheStatsPanel />);
      unmount();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("applies subscription updates while auto-refresh is on", () => {
      render(<CacheStatsPanel />);
      act(() => {
        subscribedListener?.(makeStats({ operations: { hits: 99, misses: 5, writes: 3, evictions: 1, errors: 0 } }));
      });
      expect(screen.getByText("99")).toBeInTheDocument();
    });

    it("ignores subscription updates while auto-refresh is off", () => {
      render(<CacheStatsPanel />);
      fireEvent.click(screen.getByTitle("Auto-refresh ON")); // toggle off
      act(() => {
        subscribedListener?.(makeStats({ operations: { hits: 99, misses: 5, writes: 3, evictions: 1, errors: 0 } }));
      });
      expect(screen.queryByText("99")).not.toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument(); // original hits value
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Controls
  // ──────────────────────────────────────────────────────────────────────────

  describe("controls", () => {
    it("handleRefresh() re-pulls stats", () => {
      render(<CacheStatsPanel />);
      mockGetStats.mockReturnValue(makeStats({ operations: { hits: 42, misses: 5, writes: 3, evictions: 1, errors: 0 } }));

      fireEvent.click(screen.getByTitle("Refresh now"));

      expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("handleLogStats() delegates to cacheService.logStatistics()", () => {
      render(<CacheStatsPanel />);
      fireEvent.click(screen.getByTitle("Log to console"));
      expect(mockLogStatistics).toHaveBeenCalledTimes(1);
    });

    it("handleReset() resets stats when the user confirms", () => {
      render(<CacheStatsPanel />);
      fireEvent.click(screen.getByTitle("Reset statistics"));
      expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it("handleReset() does NOT reset stats when the user cancels the confirm dialog", () => {
      (window.confirm as jest.Mock).mockReturnValue(false);
      render(<CacheStatsPanel />);
      fireEvent.click(screen.getByTitle("Reset statistics"));
      expect(mockReset).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Derived values
  // ──────────────────────────────────────────────────────────────────────────

  describe("derived values", () => {
    it("shows the hit rate rounded to 1 decimal", () => {
      mockGetHitRate.mockReturnValue(66.666);
      render(<CacheStatsPanel />);
      expect(screen.getByText("66.7%")).toBeInTheDocument();
    });

    it("calculates bytesSaved from before/after compression sizes", () => {
      render(<CacheStatsPanel />);
      // (1000 - 400) / 1024 = 0.5859... -> "0.6"
      expect(screen.getByText("0.6KB")).toBeInTheDocument();
    });

    it("shows '0.0' bytesSaved when compression expanded the data", () => {
      mockGetStats.mockReturnValue(
        makeStats({
          compression: {
            compressions: 1,
            decompressions: 0,
            bytesBeforeCompression: 100,
            bytesAfterCompression: 150,
            totalCompressionTime: 5,
            totalDecompressionTime: 0,
            expansions: 1,
          },
        })
      );
      render(<CacheStatsPanel />);
      expect(screen.getByText("0.0KB")).toBeInTheDocument();
    });

    it("computes storage usage percentage and caps the bar width at 100%", () => {
      mockGetStats.mockReturnValue(
        makeStats({
          storage: { local: { entryCount: 3, bytesUsed: 20480, bytesQuota: 10240 } }, // 200%
        })
      );
      const { container } = render(<CacheStatsPanel />);
      expect(screen.getByText("200.0%")).toBeInTheDocument();
      const bar = container.querySelector(".storage-bar") as HTMLElement;
      expect(bar.style.width).toBe("100%");
    });

    it("computes per-type hit rate and shows H/M/W counts", () => {
      render(<CacheStatsPanel />);
      // documents: 8 hits, 2 misses -> 80%
      expect(screen.getByText("8H")).toBeInTheDocument();
      expect(screen.getByText("2M")).toBeInTheDocument();
      expect(screen.getByText("1W")).toBeInTheDocument();
      expect(screen.getByText("80%")).toBeInTheDocument();
    });

    it("shows 0% per-type hit rate when there have been no hits or misses", () => {
      mockGetStats.mockReturnValue(
        makeStats({
          perType: {
            empty: { hits: 0, misses: 0, writes: 2, lastAccessed: null, lastUpdated: null },
          },
        })
      );
      render(<CacheStatsPanel />);
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("sorts top cache types by (hits + writes) descending and shows at most 5", () => {
      const perType: Record<string, any> = {};
      for (let i = 1; i <= 7; i++) {
        perType[`type${i}`] = { hits: i, misses: 0, writes: 0, lastAccessed: null, lastUpdated: null };
      }
      mockGetStats.mockReturnValue(makeStats({ perType }));
      render(<CacheStatsPanel />);

      expect(screen.getByText("type7")).toBeInTheDocument();
      expect(screen.getByText("type3")).toBeInTheDocument();
      expect(screen.queryByText("type2")).not.toBeInTheDocument();
      expect(screen.queryByText("type1")).not.toBeInTheDocument();
    });
  });
});
