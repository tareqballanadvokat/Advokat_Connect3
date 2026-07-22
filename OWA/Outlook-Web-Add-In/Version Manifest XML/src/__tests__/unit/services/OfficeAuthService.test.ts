/* eslint-disable no-undef */
/**
 * Unit Tests for OfficeAuthService
 *
 * Tests JWT parsing (extractOid, extractEmail) and the getOfficeToken()
 * SSO flow, including Redux dispatch side-effects.
 *
 * External dependencies mocked:
 *   - OfficeRuntime.auth.getAccessToken  (global mock in setupTests.ts)
 *   - store.dispatch                     (jest.spyOn per test)
 *   - @infra/logger                      (module mock)
 */

// ─── Logger mock ─────────────────────────────────────────────────────────────
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.mock("@infra/logger", () => ({ getLogger: jest.fn(() => mockLogger) }));

// ─── Store mock ───────────────────────────────────────────────────────────────
// We spy on the real store so dispatch interactions can be verified
// without coupling to Redux internals.
import { store } from "@store";

import { OfficeAuthService } from "@services/OfficeAuthService";
import { setOfficeToken, clearOfficeToken } from "@slices/authSlice";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal JWT string with the given payload.
 * The header and signature are fixed stubs — only the payload matters for parsing.
 */
function buildJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.stub-signature`;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("OfficeAuthService", () => {
  let service: OfficeAuthService;
  let dispatchSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new OfficeAuthService();
    dispatchSpy = jest.spyOn(store, "dispatch");
    jest.clearAllMocks();
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // extractOid
  // ──────────────────────────────────────────────────────────────────────────

  describe("extractOid", () => {
    it("should return the oid from a valid JWT", () => {
      const token = buildJwt({ oid: "user-oid-abc-123" });
      expect(service.extractOid(token)).toBe("user-oid-abc-123");
    });

    it("should return null when oid claim is absent", () => {
      const token = buildJwt({ sub: "some-subject", email: "a@b.com" });
      expect(service.extractOid(token)).toBeNull();
    });

    it("should return null for a token with only one segment", () => {
      expect(service.extractOid("not-a-jwt")).toBeNull();
    });

    it("should return null when payload base64 is not valid JSON", () => {
      expect(service.extractOid("header.!!!invalid-base64!!!.sig")).toBeNull();
    });

    it("should return null for an empty string", () => {
      expect(service.extractOid("")).toBeNull();
    });

    it("should not throw for any malformed input", () => {
      expect(() => service.extractOid("a.b.c.d.e")).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // extractEmail
  // ──────────────────────────────────────────────────────────────────────────

  describe("extractEmail", () => {
    it("should return preferred_username from a valid JWT", () => {
      const token = buildJwt({ preferred_username: "user@contoso.com" });
      expect(service.extractEmail(token)).toBe("user@contoso.com");
    });

    it("should return null when preferred_username is absent", () => {
      const token = buildJwt({ oid: "some-oid" });
      expect(service.extractEmail(token)).toBeNull();
    });

    it("should return null for a malformed token", () => {
      expect(service.extractEmail("bad-token")).toBeNull();
    });

    it("should return null for an empty string", () => {
      expect(service.extractEmail("")).toBeNull();
    });

    it("should handle a JWT that has both oid and preferred_username", () => {
      const token = buildJwt({ oid: "oid-xyz", preferred_username: "jane@example.com" });
      expect(service.extractEmail(token)).toBe("jane@example.com");
      expect(service.extractOid(token)).toBe("oid-xyz");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getOfficeToken — success path
  // ──────────────────────────────────────────────────────────────────────────

  describe("getOfficeToken — success", () => {
    const officeJwt = buildJwt({
      oid: "test-oid-456",
      preferred_username: "user@tenant.com",
    });

    beforeEach(() => {
      (OfficeRuntime.auth.getAccessToken as jest.Mock).mockResolvedValue(officeJwt);
    });

    it("should call OfficeRuntime.auth.getAccessToken", async () => {
      await service.getOfficeToken();
      expect(OfficeRuntime.auth.getAccessToken).toHaveBeenCalledTimes(1);
    });

    it("should pass the correct options to getAccessToken", async () => {
      await service.getOfficeToken();
      expect(OfficeRuntime.auth.getAccessToken).toHaveBeenCalledWith({
        allowSignInPrompt: true,
        allowConsentPrompt: true,
        forMSGraphAccess: false,
      });
    });

    it("should return the token string", async () => {
      const result = await service.getOfficeToken();
      expect(result).toBe(officeJwt);
    });

    it("should dispatch setOfficeToken with token, oid and email", async () => {
      await service.getOfficeToken();
      expect(dispatchSpy).toHaveBeenCalledWith(
        setOfficeToken({ officeToken: officeJwt, oid: "test-oid-456", email: "user@tenant.com" })
      );
    });

    it("should dispatch exactly once on success", async () => {
      await service.getOfficeToken();
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle a JWT where oid is null (missing claim)", async () => {
      const noOidJwt = buildJwt({ preferred_username: "user@tenant.com" });
      (OfficeRuntime.auth.getAccessToken as jest.Mock).mockResolvedValue(noOidJwt);

      await service.getOfficeToken();

      expect(dispatchSpy).toHaveBeenCalledWith(
        setOfficeToken({ officeToken: noOidJwt, oid: null, email: "user@tenant.com" })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getOfficeToken — failure paths
  // ──────────────────────────────────────────────────────────────────────────

  describe("getOfficeToken — failure", () => {
    it("should return null when OfficeRuntime throws", async () => {
      (OfficeRuntime.auth.getAccessToken as jest.Mock).mockRejectedValue(
        new Error("User not signed in")
      );
      const result = await service.getOfficeToken();
      expect(result).toBeNull();
    });

    it("should dispatch clearOfficeToken on error", async () => {
      (OfficeRuntime.auth.getAccessToken as jest.Mock).mockRejectedValue(
        Object.assign(new Error("SSO error"), { code: 13001 })
      );
      await service.getOfficeToken();
      expect(dispatchSpy).toHaveBeenCalledWith(clearOfficeToken());
    });

    it("should NOT dispatch setOfficeToken on error", async () => {
      (OfficeRuntime.auth.getAccessToken as jest.Mock).mockRejectedValue(new Error("13004"));
      await service.getOfficeToken();

      const calls = dispatchSpy.mock.calls.map((c) => c[0]);
      const hasSetToken = calls.some(
        (action) => action && action.type === setOfficeToken.type
      );
      expect(hasSetToken).toBe(false);
    });

    it("should not throw — errors are handled internally", async () => {
      (OfficeRuntime.auth.getAccessToken as jest.Mock).mockRejectedValue(new Error("fatal"));
      await expect(service.getOfficeToken()).resolves.toBeNull();
    });

    it("should handle error objects without a code property", async () => {
      (OfficeRuntime.auth.getAccessToken as jest.Mock).mockRejectedValue(
        new TypeError("Network failure")
      );
      const result = await service.getOfficeToken();
      expect(result).toBeNull();
    });
  });
});
