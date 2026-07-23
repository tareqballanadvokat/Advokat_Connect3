/* eslint-disable no-undef */
/**
 * Unit Tests for PairingApiService
 *
 * Scenarios covered:
 *  exchangeOfficeToken:
 *   1. Delegates to webRTCApiService.sendAuthMessage and returns its result
 *  pair:
 *   2. Dispatches setPairingChecking, then POSTs /addin/pair and dispatches setPaired on success
 *   3. Network error → dispatches setPairingError and rethrows
 *   4. Non-ok response → dispatches setPairingError and throws
 *   5. Invalid JSON body → dispatches setPairingError and throws
 *   6. Missing advokatServerId in body → dispatches setPairingError and throws
 *  checkServerId:
 *   7. Dispatches setPairingChecking, then GETs /addin/server-id and dispatches setPaired on success
 *   8. 404 → dispatches setUnpaired and returns null
 *   9. Network error → dispatches setPairingError and rethrows
 *  10. Non-ok, non-404 response → dispatches setPairingError and throws
 *  11. Invalid JSON body → dispatches setPairingError and throws
 *  12. Missing advokatServerId in body → dispatches setPairingError and throws
 *
 * External dependencies mocked:
 *   - @infra/logger              (jest.mock)
 *   - @store                     (jest.mock — controllable dispatch spy)
 *   - ./webRTCApiService         (jest.mock — intercepts exchangeOfficeToken's dependency)
 *   - global.fetch               (jest.fn per test)
 */

// ─── Logger mock ─────────────────────────────────────────────────────────────
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock("@infra/logger", () => ({ getLogger: jest.fn(() => mockLogger) }));

// ─── Store mock ───────────────────────────────────────────────────────────────
const mockDispatch = jest.fn();
jest.mock("@store", () => ({
  store: { dispatch: (...args: any[]) => mockDispatch(...args) },
}));

// ─── webRTCApiService mock ─────────────────────────────────────────────────────
const mockSendAuthMessage = jest.fn();
jest.mock("@services/webRTCApiService", () => ({
  webRTCApiService: { sendAuthMessage: (...args: any[]) => mockSendAuthMessage(...args) },
}));

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import { PairingApiService } from "@services/PairingApiService";
import { setPaired, setUnpaired, setPairingChecking, setPairingError } from "@slices/pairingSlice";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockFetchResolvedOnce(response: Partial<Response>) {
  (global.fetch as jest.Mock).mockResolvedValueOnce(response as Response);
}

function jsonResponse(status: number, body: unknown): Partial<Response> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PairingApiService", () => {
  let service: PairingApiService;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    service = new PairingApiService();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // exchangeOfficeToken
  // ──────────────────────────────────────────────────────────────────────────

  describe("exchangeOfficeToken", () => {
    it("should delegate to webRTCApiService.sendAuthMessage and return its result", async () => {
      const authResponse = { access_token: "tok", token_type: "Bearer", expires_in: 3600, refresh_token: "r", refresh_token_lifetime: 7200 };
      mockSendAuthMessage.mockResolvedValue(authResponse);

      const result = await service.exchangeOfficeToken("office-jwt");

      expect(mockSendAuthMessage).toHaveBeenCalledWith("office-jwt");
      expect(result).toBe(authResponse);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // pair
  // ──────────────────────────────────────────────────────────────────────────

  describe("pair", () => {
    it("should dispatch setPairingChecking before calling the API", async () => {
      mockFetchResolvedOnce(jsonResponse(200, { advokatServerId: "srv-1", kuerzel: "AB" }));

      await service.pair("123456", "office-jwt");

      expect(mockDispatch).toHaveBeenCalledWith(setPairingChecking());
    });

    it("should POST to /addin/pair with the OTP and Office token, and dispatch setPaired on success", async () => {
      mockFetchResolvedOnce(jsonResponse(200, { advokatServerId: "srv-1", kuerzel: "AB" }));

      const result = await service.pair("123456", "office-jwt");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/addin/pair"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ Authorization: "Bearer office-jwt" }),
          body: JSON.stringify({ otp: "123456" }),
        })
      );
      expect(mockDispatch).toHaveBeenCalledWith(setPaired({ advokatServerId: "srv-1", kuerzel: "AB" }));
      expect(result).toEqual({ advokatServerId: "srv-1", kuerzel: "AB" });
    });

    it("should dispatch setPairingError and rethrow on network error", async () => {
      const networkError = new Error("Failed to fetch");
      (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

      await expect(service.pair("123456", "office-jwt")).rejects.toThrow("Failed to fetch");
      expect(mockDispatch).toHaveBeenCalledWith(setPairingError("Failed to fetch"));
    });

    it("should dispatch setPairingError and throw on a non-ok response", async () => {
      mockFetchResolvedOnce({ ok: false, status: 400, text: () => Promise.resolve("Invalid OTP") });

      await expect(service.pair("000000", "office-jwt")).rejects.toThrow(/HTTP 400/);
      expect(mockDispatch).toHaveBeenCalledWith(setPairingError(expect.stringContaining("400")));
    });

    it("should dispatch setPairingError and throw when the body is not valid JSON", async () => {
      mockFetchResolvedOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error("Unexpected token")),
      });

      await expect(service.pair("123456", "office-jwt")).rejects.toThrow(/not valid JSON/);
      expect(mockDispatch).toHaveBeenCalledWith(setPairingError(expect.stringContaining("not valid JSON")));
    });

    it("should dispatch setPairingError and throw when advokatServerId is missing", async () => {
      mockFetchResolvedOnce(jsonResponse(200, { kuerzel: "AB" }));

      await expect(service.pair("123456", "office-jwt")).rejects.toThrow(/advokatServerId is missing/);
      expect(mockDispatch).toHaveBeenCalledWith(setPairingError(expect.stringContaining("advokatServerId is missing")));
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // checkServerId
  // ──────────────────────────────────────────────────────────────────────────

  describe("checkServerId", () => {
    it("should dispatch setPairingChecking before calling the API", async () => {
      mockFetchResolvedOnce(jsonResponse(200, { advokatServerId: "srv-1", kuerzel: "AB" }));

      await service.checkServerId("office-jwt");

      expect(mockDispatch).toHaveBeenCalledWith(setPairingChecking());
    });

    it("should GET /addin/server-id and dispatch setPaired on success", async () => {
      mockFetchResolvedOnce(jsonResponse(200, { advokatServerId: "srv-1", kuerzel: "AB" }));

      const result = await service.checkServerId("office-jwt");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/addin/server-id"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({ Authorization: "Bearer office-jwt" }),
        })
      );
      expect(mockDispatch).toHaveBeenCalledWith(setPaired({ advokatServerId: "srv-1", kuerzel: "AB" }));
      expect(result).toEqual({ advokatServerId: "srv-1", kuerzel: "AB" });
    });

    it("should dispatch setUnpaired and return null on 404", async () => {
      mockFetchResolvedOnce({ ok: false, status: 404, json: () => Promise.resolve({}) });

      const result = await service.checkServerId("office-jwt");

      expect(mockDispatch).toHaveBeenCalledWith(setUnpaired());
      expect(result).toBeNull();
    });

    it("should dispatch setPairingError and rethrow on network error", async () => {
      const networkError = new Error("Failed to fetch");
      (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

      await expect(service.checkServerId("office-jwt")).rejects.toThrow("Failed to fetch");
      expect(mockDispatch).toHaveBeenCalledWith(setPairingError("Failed to fetch"));
    });

    it("should dispatch setPairingError and throw on a non-ok, non-404 response", async () => {
      mockFetchResolvedOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });

      await expect(service.checkServerId("office-jwt")).rejects.toThrow(/unexpected status 500/);
      expect(mockDispatch).toHaveBeenCalledWith(setPairingError(expect.stringContaining("500")));
    });

    it("should dispatch setPairingError and throw when the body is not valid JSON", async () => {
      mockFetchResolvedOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error("Unexpected token")),
      });

      await expect(service.checkServerId("office-jwt")).rejects.toThrow(/not valid JSON/);
      expect(mockDispatch).toHaveBeenCalledWith(setPairingError(expect.stringContaining("not valid JSON")));
    });

    it("should dispatch setPairingError and throw when advokatServerId is missing", async () => {
      mockFetchResolvedOnce(jsonResponse(200, { kuerzel: "AB" }));

      await expect(service.checkServerId("office-jwt")).rejects.toThrow(/advokatServerId is missing/);
      expect(mockDispatch).toHaveBeenCalledWith(setPairingError(expect.stringContaining("advokatServerId is missing")));
    });
  });
});
