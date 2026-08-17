/* eslint-disable no-undef */
/**
 * Unit Tests for officeAuthErrors
 *
 * Scenarios covered:
 *  resolveOfficeAuthErrorKey:
 *   1. Returns the mapped i18n key for each known Office SSO error code
 *   2. Returns the fallback key for an unknown code
 *   3. Returns the fallback key for undefined
 *  isOfficeAuthErrorRetryable:
 *   4. Returns true for the retryable codes (13006, 13007, 13008)
 *   5. Returns false for non-retryable known codes
 *   6. Returns false for unknown codes and undefined
 */
import {
  OFFICE_AUTH_ERROR_KEYS,
  resolveOfficeAuthErrorKey,
  isOfficeAuthErrorRetryable,
} from "@services/officeAuthErrors";

describe("officeAuthErrors", () => {
  describe("resolveOfficeAuthErrorKey", () => {
    it.each(Object.entries(OFFICE_AUTH_ERROR_KEYS))(
      "should map code %s to its i18n key",
      (code, expectedKey) => {
        expect(resolveOfficeAuthErrorKey(Number(code))).toBe(expectedKey);
      }
    );

    it("should return the fallback key for an unknown code", () => {
      expect(resolveOfficeAuthErrorKey(99999)).toBe("officeAuth.errors.unknown");
    });

    it("should return the fallback key for undefined", () => {
      expect(resolveOfficeAuthErrorKey(undefined)).toBe("officeAuth.errors.unknown");
    });
  });

  describe("isOfficeAuthErrorRetryable", () => {
    it.each([13006, 13007, 13008])("should return true for retryable code %d", (code) => {
      expect(isOfficeAuthErrorRetryable(code)).toBe(true);
    });

    it.each([13001, 13002, 13003, 13004, 13005, 13012])(
      "should return false for non-retryable known code %d",
      (code) => {
        expect(isOfficeAuthErrorRetryable(code)).toBe(false);
      }
    );

    it("should return false for an unknown code", () => {
      expect(isOfficeAuthErrorRetryable(1)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isOfficeAuthErrorRetryable(undefined)).toBe(false);
    });
  });
});
