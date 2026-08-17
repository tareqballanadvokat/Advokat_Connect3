// src/services/officeAuthErrors.ts

/**
 * Maps OfficeRuntime.auth.getAccessToken() error codes to i18n keys under
 * the `officeAuth` namespace (see src/i18n.ts). Codes per Microsoft's
 * Office Add-ins SSO documentation:
 * https://learn.microsoft.com/office/dev/add-ins/develop/troubleshoot-sso-in-office-add-ins
 */
export const OFFICE_AUTH_ERROR_KEYS: Record<number, string> = {
  13001: 'officeAuth.errors.13001', // Not signed into Office
  13002: 'officeAuth.errors.13002', // Consent required / user aborted or blocked the consent prompt
  13003: 'officeAuth.errors.13003', // Unsupported account type (e.g. personal Microsoft account)
  13004: 'officeAuth.errors.13004', // Invalid resource/scope in manifest (config issue, not user-fixable)
  13005: 'officeAuth.errors.13005', // Invalid grant — user needs to sign in again
  13006: 'officeAuth.errors.13006', // Client error on the Office host
  13007: 'officeAuth.errors.13007', // Server error / host could not get a token on the user's behalf
  13008: 'officeAuth.errors.13008', // A previous getAccessToken() call is still in progress
  13012: 'officeAuth.errors.13012', // Environment/host/platform does not support SSO
};

const FALLBACK_KEY = 'officeAuth.errors.unknown';

/** Resolves the i18n key to show the user for a given getAccessToken() failure. */
export function resolveOfficeAuthErrorKey(code: number | undefined): string {
  if (code !== undefined && OFFICE_AUTH_ERROR_KEYS[code]) {
    return OFFICE_AUTH_ERROR_KEYS[code];
  }
  return FALLBACK_KEY;
}

/** True for errors where retrying immediately (without user action) may succeed. */
export function isOfficeAuthErrorRetryable(code: number | undefined): boolean {
  return code === 13006 || code === 13007 || code === 13008;
}
