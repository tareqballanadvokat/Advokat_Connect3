/* eslint-disable no-undef */
/**
 * Unit Tests for TokenService
 *
 * Scenarios covered:
 *  1. Valid, non-expiring token in store   → returned immediately, no refresh
 *  2. No token in store                    → refresh triggered
 *  3. Token near expiry (<2 min remaining) → proactive refresh triggered
 *  4. Token just outside expiry buffer     → NOT refreshed (still valid)
 *  5. No Office token available            → refresh returns null, no API call
 *  6. PairingApiService.exchangeOfficeToken fails → refresh returns null
 *  7. Concurrent calls during refresh      → only one HTTP request made
 *  8. After refresh completes              → next call starts a fresh refresh
 *
 * External dependencies mocked:
 *   - @store                      (jest.mock — fully stubbed, avoids spy race conditions)
 *   - @services/PairingApiService (jest.mock — intercepts dynamic import in _refresh)
 *   - @infra/logger               (jest.mock)
 */

// ─── Logger mock ─────────────────────────────────────────────────────────────
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock("@infra/logger", () => ({ getLogger: jest.fn(() => mockLogger) }));

// ─── Store mock ───────────────────────────────────────────────────────────────
// Fully mocked so we can control getState() return values per test without
// the spy-restoration race conditions that come with jest.spyOn.
const mockGetState = jest.fn();
const mockDispatch = jest.fn();
jest.mock("@store", () => ({
  store: {
    getState: (...args: any[]) => mockGetState(...args),
    dispatch: (...args: any[]) => mockDispatch(...args),
  },
}));

// ─── PairingApiService mock ───────────────────────────────────────────────────
// Must be declared before the TokenService import so Jest intercepts the
// dynamic `await import("./PairingApiService")` inside _refresh().
const mockExchangeOfficeToken = jest.fn();
jest.mock("@services/PairingApiService", () => ({
  pairingApiService: { exchangeOfficeToken: mockExchangeOfficeToken },
}));

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import { TokenService } from "@services/TokenService";
import { authenticationSuccess } from "@slices/authSlice";
import { IAuthResponse } from "@interfaces/IAuth";

// ─── Constants ────────────────────────────────────────────────────────────────
const EXPIRY_BUFFER_MS = 2 * 60 * 1000; // mirrors the constant in TokenService

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAuthResponse(overrides: Partial<IAuthResponse> = {}): IAuthResponse {
  return {
    access_token: "new-advokat-token",
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: "new-refresh-token",
    refresh_token_lifetime: 7200,
    ...overrides,
  };
}

function stubStore(options: {
  token?: string | null;
  expiresAt?: number | null;
  officeToken?: string | null;
}) {
  mockGetState.mockReturnValue({
    auth: {
      token: options.token ?? null,
      expiresAt: options.expiresAt ?? null,
      officeToken: options.officeToken ?? null,
    },
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("TokenService", () => {
  let service: TokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TokenService();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Valid non-expiring token — no refresh
  // ──────────────────────────────────────────────────────────────────────────

  describe("when a valid, non-expiring token is in the store", () => {
    beforeEach(() => {
      stubStore({ token: "valid-token", expiresAt: Date.now() + 10 * 60 * 1000 });
    });

    it("should return the cached token immediately", async () => {
      expect(await service.ensureValidToken()).toBe("valid-token");
    });

    it("should NOT call PairingApiService", async () => {
      await service.ensureValidToken();
      expect(mockExchangeOfficeToken).not.toHaveBeenCalled();
    });

    it("should NOT dispatch any Redux action", async () => {
      await service.ensureValidToken();
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. No token in store — refresh triggered
  // ──────────────────────────────────────────────────────────────────────────

  describe("when no token is in the store", () => {
    const authResponse = makeAuthResponse();

    beforeEach(() => {
      stubStore({ token: null, expiresAt: null, officeToken: "office-jwt" });
      mockExchangeOfficeToken.mockResolvedValue(authResponse);
    });

    it("should call PairingApiService.exchangeOfficeToken with the Office token", async () => {
      await service.ensureValidToken();
      expect(mockExchangeOfficeToken).toHaveBeenCalledWith("office-jwt");
    });

    it("should dispatch authenticationSuccess with the response", async () => {
      await service.ensureValidToken();
      expect(mockDispatch).toHaveBeenCalledWith(authenticationSuccess(authResponse));
    });

    it("should return the new access token", async () => {
      expect(await service.ensureValidToken()).toBe(authResponse.access_token);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3 & 4. Expiry boundary
  // ──────────────────────────────────────────────────────────────────────────

  describe("expiry boundary", () => {
    const authResponse = makeAuthResponse({ access_token: "refreshed-token" });

    it("should refresh when token expires within the 2-minute buffer", async () => {
      stubStore({ token: "expiring-soon", expiresAt: Date.now() + 30 * 1000, officeToken: "office-jwt" });
      mockExchangeOfficeToken.mockResolvedValue(authResponse);

      expect(await service.ensureValidToken()).toBe("refreshed-token");
      expect(mockExchangeOfficeToken).toHaveBeenCalledTimes(1);
    });

    it("should NOT refresh when token is just outside the buffer", async () => {
      stubStore({ token: "still-valid", expiresAt: Date.now() + EXPIRY_BUFFER_MS + 5000 });

      expect(await service.ensureValidToken()).toBe("still-valid");
      expect(mockExchangeOfficeToken).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. No Office token — cannot refresh
  // ──────────────────────────────────────────────────────────────────────────

  describe("when the Office token is missing from the store", () => {
    beforeEach(() => {
      stubStore({ token: null, expiresAt: null, officeToken: null });
    });

    it("should return null without calling PairingApiService", async () => {
      expect(await service.ensureValidToken()).toBeNull();
      expect(mockExchangeOfficeToken).not.toHaveBeenCalled();
    });

    it("should log a warning", async () => {
      await service.ensureValidToken();
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Exchange API call fails
  // ──────────────────────────────────────────────────────────────────────────

  describe("when the token exchange API call fails", () => {
    beforeEach(() => {
      stubStore({ token: null, expiresAt: null, officeToken: "office-jwt" });
      mockExchangeOfficeToken.mockRejectedValue(new Error("Network timeout"));
    });

    it("should return null", async () => {
      expect(await service.ensureValidToken()).toBeNull();
    });

    it("should not throw — errors are handled internally", async () => {
      await expect(service.ensureValidToken()).resolves.toBeNull();
    });

    it("should log the error", async () => {
      await service.ensureValidToken();
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    it("should NOT dispatch authenticationSuccess", async () => {
      await service.ensureValidToken();
      const dispatched = mockDispatch.mock.calls.map((c) => c[0]);
      expect(dispatched.some((a) => a?.type === authenticationSuccess.type)).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Concurrent calls — shared in-flight promise
  // ──────────────────────────────────────────────────────────────────────────

  describe("when ensureValidToken is called concurrently during a refresh", () => {
    const authResponse = makeAuthResponse({ access_token: "concurrent-token" });

    beforeEach(() => {
      stubStore({ token: null, expiresAt: null, officeToken: "office-jwt" });

      let resolveExchange!: (v: IAuthResponse) => void;
      const slowPromise = new Promise<IAuthResponse>((res) => { resolveExchange = res; });
      mockExchangeOfficeToken.mockReturnValue(slowPromise);
      // Resolve after current microtasks so all three concurrent calls share the promise
      Promise.resolve().then(() => resolveExchange(authResponse));
    });

    it("should call PairingApiService exactly once", async () => {
      const [r1, r2, r3] = await Promise.all([
        service.ensureValidToken(),
        service.ensureValidToken(),
        service.ensureValidToken(),
      ]);
      expect(mockExchangeOfficeToken).toHaveBeenCalledTimes(1);
      expect(r1).toBe("concurrent-token");
      expect(r2).toBe("concurrent-token");
      expect(r3).toBe("concurrent-token");
    });

    it("should dispatch authenticationSuccess exactly once", async () => {
      await Promise.all([
        service.ensureValidToken(),
        service.ensureValidToken(),
        service.ensureValidToken(),
      ]);
      const successCalls = mockDispatch.mock.calls.filter(
        (c) => c[0]?.type === authenticationSuccess.type
      );
      expect(successCalls).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. _refreshPromise cleared after completion — next call starts fresh
  // ──────────────────────────────────────────────────────────────────────────

  describe("after a completed refresh", () => {
    it("should start a fresh refresh on the next call", async () => {
      stubStore({ token: null, expiresAt: null, officeToken: "office-jwt" });
      mockExchangeOfficeToken
        .mockResolvedValueOnce(makeAuthResponse({ access_token: "first-token" }))
        .mockResolvedValueOnce(makeAuthResponse({ access_token: "second-token" }));

      await service.ensureValidToken();
      expect(mockExchangeOfficeToken).toHaveBeenCalledTimes(1);

      await service.ensureValidToken();
      expect(mockExchangeOfficeToken).toHaveBeenCalledTimes(2);
    });
  });
});
