/* eslint-disable no-undef */
/**
 * Unit Tests for pairingSlice
 * Tests all reducers and selectors for the add-in pairing state
 */

import pairingReducer, {
  setPairingChecking,
  setPaired,
  setUnpaired,
  setPairingError,
  resetPairing,
  selectPairing,
  selectPairingStatus,
  selectAdvokatServerId,
  selectKuerzel,
  PairingState,
} from "@slices/pairingSlice";

describe("pairingSlice", () => {
  const initialState: PairingState = {
    status: "unknown",
    advokatServerId: null,
    kuerzel: null,
    error: null,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Reducer
  // ──────────────────────────────────────────────────────────────────────────

  describe("Reducer", () => {
    it("should return the initial state", () => {
      expect(pairingReducer(undefined, { type: "unknown" })).toEqual(initialState);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // setPairingChecking
  // ──────────────────────────────────────────────────────────────────────────

  describe("setPairingChecking", () => {
    it("should set status to checking", () => {
      const state = pairingReducer(initialState, setPairingChecking());
      expect(state.status).toBe("checking");
    });

    it("should clear any existing error", () => {
      const stateWithError: PairingState = { ...initialState, error: "previous error" };
      const state = pairingReducer(stateWithError, setPairingChecking());
      expect(state.error).toBeNull();
    });

    it("should preserve advokatServerId and kuerzel", () => {
      const pairedState: PairingState = {
        ...initialState,
        advokatServerId: "server-1",
        kuerzel: "KCH",
      };
      const state = pairingReducer(pairedState, setPairingChecking());
      expect(state.advokatServerId).toBe("server-1");
      expect(state.kuerzel).toBe("KCH");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // setPaired
  // ──────────────────────────────────────────────────────────────────────────

  describe("setPaired", () => {
    it("should set status to paired with correct payload", () => {
      const state = pairingReducer(
        initialState,
        setPaired({ advokatServerId: "server-42", kuerzel: "JCH" })
      );
      expect(state.status).toBe("paired");
      expect(state.advokatServerId).toBe("server-42");
      expect(state.kuerzel).toBe("JCH");
    });

    it("should clear error on success", () => {
      const stateWithError: PairingState = { ...initialState, status: "error", error: "api failed" };
      const state = pairingReducer(
        stateWithError,
        setPaired({ advokatServerId: "server-1", kuerzel: "AK" })
      );
      expect(state.error).toBeNull();
    });

    it("should override a previously paired server ID", () => {
      const prevPaired: PairingState = {
        status: "paired",
        advokatServerId: "old-server",
        kuerzel: "OLD",
        error: null,
      };
      const state = pairingReducer(
        prevPaired,
        setPaired({ advokatServerId: "new-server", kuerzel: "NEW" })
      );
      expect(state.advokatServerId).toBe("new-server");
      expect(state.kuerzel).toBe("NEW");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // setUnpaired
  // ──────────────────────────────────────────────────────────────────────────

  describe("setUnpaired", () => {
    it("should set status to unpaired", () => {
      const state = pairingReducer(initialState, setUnpaired());
      expect(state.status).toBe("unpaired");
    });

    it("should clear advokatServerId and kuerzel", () => {
      const pairedState: PairingState = {
        status: "paired",
        advokatServerId: "server-1",
        kuerzel: "JCH",
        error: null,
      };
      const state = pairingReducer(pairedState, setUnpaired());
      expect(state.advokatServerId).toBeNull();
      expect(state.kuerzel).toBeNull();
    });

    it("should clear any error", () => {
      const stateWithError: PairingState = { ...initialState, error: "failed" };
      const state = pairingReducer(stateWithError, setUnpaired());
      expect(state.error).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // setPairingError
  // ──────────────────────────────────────────────────────────────────────────

  describe("setPairingError", () => {
    it("should set status to error", () => {
      const state = pairingReducer(initialState, setPairingError("Network unreachable"));
      expect(state.status).toBe("error");
    });

    it("should store the error message", () => {
      const state = pairingReducer(initialState, setPairingError("Timeout after 30s"));
      expect(state.error).toBe("Timeout after 30s");
    });

    it("should override a previous error", () => {
      const stateWithError: PairingState = { ...initialState, status: "error", error: "old error" };
      const state = pairingReducer(stateWithError, setPairingError("new error"));
      expect(state.error).toBe("new error");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // resetPairing
  // ──────────────────────────────────────────────────────────────────────────

  describe("resetPairing", () => {
    it("should reset to initial state from paired", () => {
      const pairedState: PairingState = {
        status: "paired",
        advokatServerId: "server-1",
        kuerzel: "JCH",
        error: null,
      };
      const state = pairingReducer(pairedState, resetPairing());
      expect(state).toEqual(initialState);
    });

    it("should reset to initial state from error", () => {
      const errorState: PairingState = {
        status: "error",
        advokatServerId: null,
        kuerzel: null,
        error: "something failed",
      };
      const state = pairingReducer(errorState, resetPairing());
      expect(state).toEqual(initialState);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Selectors
  // ──────────────────────────────────────────────────────────────────────────

  describe("Selectors", () => {
    const mockRootState = {
      pairing: {
        status: "paired" as const,
        advokatServerId: "server-99",
        kuerzel: "TBL",
        error: null,
      },
    };

    it("selectPairing should return the entire pairing state", () => {
      expect(selectPairing(mockRootState)).toEqual(mockRootState.pairing);
    });

    it("selectPairingStatus should return the status", () => {
      expect(selectPairingStatus(mockRootState)).toBe("paired");
    });

    it("selectAdvokatServerId should return the server ID", () => {
      expect(selectAdvokatServerId(mockRootState)).toBe("server-99");
    });

    it("selectKuerzel should return the Kürzel", () => {
      expect(selectKuerzel(mockRootState)).toBe("TBL");
    });

    it("selectAdvokatServerId should return null when not paired", () => {
      const unpairedState = { pairing: { ...initialState, status: "unpaired" as const } };
      expect(selectAdvokatServerId(unpairedState)).toBeNull();
    });

    it("selectKuerzel should return null when not paired", () => {
      const unpairedState = { pairing: { ...initialState, status: "unpaired" as const } };
      expect(selectKuerzel(unpairedState)).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // State transitions
  // ──────────────────────────────────────────────────────────────────────────

  describe("State transitions", () => {
    it("should handle the complete first-time pairing flow", () => {
      let state = initialState;

      // App starts, pairing status unknown
      expect(state.status).toBe("unknown");

      // Office token obtained, checking pairing
      state = pairingReducer(state, setPairingChecking());
      expect(state.status).toBe("checking");

      // Server responds: not paired yet
      state = pairingReducer(state, setUnpaired());
      expect(state.status).toBe("unpaired");

      // User completes OTP flow, pairing established
      state = pairingReducer(state, setPaired({ advokatServerId: "adv-01", kuerzel: "MK" }));
      expect(state.status).toBe("paired");
      expect(state.advokatServerId).toBe("adv-01");
      expect(state.kuerzel).toBe("MK");
    });

    it("should handle checking → error → retry → paired flow", () => {
      let state = initialState;

      state = pairingReducer(state, setPairingChecking());
      state = pairingReducer(state, setPairingError("Server unreachable"));
      expect(state.status).toBe("error");
      expect(state.error).toBe("Server unreachable");

      // Retry
      state = pairingReducer(state, setPairingChecking());
      expect(state.error).toBeNull();
      expect(state.status).toBe("checking");

      state = pairingReducer(state, setPaired({ advokatServerId: "adv-02", kuerzel: "AB" }));
      expect(state.status).toBe("paired");
    });
  });
});
