/* eslint-disable no-undef */
/**
 * Unit Tests for loggingSlice
 * Tests all reducers — the logger side-effects are mocked so state changes
 * can be verified independently of the logger implementation.
 */

// Mock the logger to avoid real logging during tests
const mockLogger = {
  enable: jest.fn(),
  disable: jest.fn(),
  setLevel: jest.fn(),
  updateConfig: jest.fn(),
};
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => mockLogger),
}));

// Mock configService so initial state doesn't read real config
jest.mock("@config", () => ({
  configService: {
    getConfig: jest.fn(() => ({
      logging: {
        enabled: false,
        level: "warn",
      },
    })),
  },
}));

import loggingReducer, {
  initializeLogging,
  toggleLogging,
  enableLogging,
  disableLogging,
  setLogLevel,
  ILoggingState,
} from "@slices/loggingSlice";

describe("loggingSlice", () => {
  // The initial state is derived from the mocked configService above
  const initialState: ILoggingState = {
    enabled: false,
    level: "warn",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Reducer
  // ──────────────────────────────────────────────────────────────────────────

  describe("Reducer", () => {
    it("should return the initial state", () => {
      expect(loggingReducer(undefined, { type: "unknown" })).toEqual(initialState);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // initializeLogging
  // ──────────────────────────────────────────────────────────────────────────

  describe("initializeLogging", () => {
    it("should set enabled and level from payload", () => {
      const state = loggingReducer(
        initialState,
        initializeLogging({ enabled: true, level: "debug" })
      );
      expect(state.enabled).toBe(true);
      expect(state.level).toBe("debug");
    });

    it("should sync the logger instance with the new config", () => {
      loggingReducer(initialState, initializeLogging({ enabled: true, level: "info" }));
      expect(mockLogger.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true, level: "info" })
      );
    });

    it("should initialize with logging disabled", () => {
      const state = loggingReducer(
        initialState,
        initializeLogging({ enabled: false, level: "error" })
      );
      expect(state.enabled).toBe(false);
      expect(state.level).toBe("error");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // toggleLogging
  // ──────────────────────────────────────────────────────────────────────────

  describe("toggleLogging", () => {
    it("should enable logging when currently disabled", () => {
      const state = loggingReducer({ enabled: false, level: "warn" }, toggleLogging());
      expect(state.enabled).toBe(true);
    });

    it("should disable logging when currently enabled", () => {
      const state = loggingReducer({ enabled: true, level: "warn" }, toggleLogging());
      expect(state.enabled).toBe(false);
    });

    it("should call logger.enable() when toggling on", () => {
      loggingReducer({ enabled: false, level: "warn" }, toggleLogging());
      expect(mockLogger.enable).toHaveBeenCalledTimes(1);
    });

    it("should call logger.disable() when toggling off", () => {
      loggingReducer({ enabled: true, level: "warn" }, toggleLogging());
      expect(mockLogger.disable).toHaveBeenCalledTimes(1);
    });

    it("should preserve the log level when toggling", () => {
      const state = loggingReducer({ enabled: false, level: "debug" }, toggleLogging());
      expect(state.level).toBe("debug");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // enableLogging
  // ──────────────────────────────────────────────────────────────────────────

  describe("enableLogging", () => {
    it("should set enabled to true", () => {
      const state = loggingReducer({ enabled: false, level: "warn" }, enableLogging());
      expect(state.enabled).toBe(true);
    });

    it("should call logger.enable()", () => {
      loggingReducer(initialState, enableLogging());
      expect(mockLogger.enable).toHaveBeenCalledTimes(1);
    });

    it("should be idempotent when logging is already enabled", () => {
      const state = loggingReducer({ enabled: true, level: "warn" }, enableLogging());
      expect(state.enabled).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // disableLogging
  // ──────────────────────────────────────────────────────────────────────────

  describe("disableLogging", () => {
    it("should set enabled to false", () => {
      const state = loggingReducer({ enabled: true, level: "warn" }, disableLogging());
      expect(state.enabled).toBe(false);
    });

    it("should call logger.disable()", () => {
      loggingReducer({ enabled: true, level: "warn" }, disableLogging());
      expect(mockLogger.disable).toHaveBeenCalledTimes(1);
    });

    it("should be idempotent when logging is already disabled", () => {
      const state = loggingReducer({ enabled: false, level: "warn" }, disableLogging());
      expect(state.enabled).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // setLogLevel
  // ──────────────────────────────────────────────────────────────────────────

  describe("setLogLevel", () => {
    it("should update the log level to debug", () => {
      const state = loggingReducer(initialState, setLogLevel("debug"));
      expect(state.level).toBe("debug");
    });

    it("should update the log level to info", () => {
      const state = loggingReducer(initialState, setLogLevel("info"));
      expect(state.level).toBe("info");
    });

    it("should update the log level to warn", () => {
      const state = loggingReducer({ enabled: true, level: "debug" }, setLogLevel("warn"));
      expect(state.level).toBe("warn");
    });

    it("should update the log level to error", () => {
      const state = loggingReducer(initialState, setLogLevel("error"));
      expect(state.level).toBe("error");
    });

    it("should call logger.setLevel() with the new level", () => {
      loggingReducer(initialState, setLogLevel("debug"));
      expect(mockLogger.setLevel).toHaveBeenCalledWith("debug");
    });

    it("should preserve the enabled state when changing level", () => {
      const state = loggingReducer({ enabled: true, level: "warn" }, setLogLevel("error"));
      expect(state.enabled).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // State transitions
  // ──────────────────────────────────────────────────────────────────────────

  describe("State transitions", () => {
    it("should handle full logging lifecycle", () => {
      let state = initialState; // disabled, warn

      // Initialize with debug level enabled
      state = loggingReducer(state, initializeLogging({ enabled: true, level: "debug" }));
      expect(state.enabled).toBe(true);
      expect(state.level).toBe("debug");

      // Temporarily disable
      state = loggingReducer(state, disableLogging());
      expect(state.enabled).toBe(false);
      expect(state.level).toBe("debug"); // level unchanged

      // Re-enable via toggle
      state = loggingReducer(state, toggleLogging());
      expect(state.enabled).toBe(true);

      // Increase level
      state = loggingReducer(state, setLogLevel("error"));
      expect(state.level).toBe("error");
      expect(state.enabled).toBe(true);
    });
  });
});
