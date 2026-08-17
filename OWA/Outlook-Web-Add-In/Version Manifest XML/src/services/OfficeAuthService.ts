/* global OfficeRuntime */

import { store } from '@store';
import { setOfficeToken, clearOfficeToken, setOfficeAuthErrorKey } from '@slices/authSlice';
import { getLogger } from '@infra/logger';
import { resolveOfficeAuthErrorKey } from './officeAuthErrors';

/**
 * OfficeAuthService
 *
 * Handles Microsoft Office SSO via OfficeRuntime.auth.getAccessToken().
 * The resulting token and oid are stored in Redux memory only — never persisted.
 *
 * Used in the authentication flow to:
 * 1. Obtain a Microsoft-signed JWT identifying the current Office user
 * 2. Extract the permanent user object ID (oid) from the token
 * 3. Send { otp, officeToken } through the WebRTC tunnel during first-time pairing
 * 4. Send officeToken for silent re-authentication on every subsequent session
 */
/** Reject an Office token that is already expired or expiring within this many ms. */
const EXPIRY_BUFFER_MS = 60 * 1000; // 1 minute

export class OfficeAuthService {
  private logger = getLogger();

  /**
   * Extracts the `exp` claim (as an epoch-ms timestamp) from an Office JWT token.
   */
  private extractExpiresAt(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch (error) {
      this.logger.error('OfficeAuthService', 'Failed to decode Office token expiry', error);
      return null;
    }
  }

  /**
   * Extracts the Microsoft user object ID (oid) from an Office JWT token.
   * The oid is a permanent identifier — it never changes for a given user/tenant.
   */
  extractOid(token: string): string | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.oid ?? null;
    } catch (error) {
      this.logger.error('OfficeAuthService', 'Failed to extract oid from Office token', error);
      return null;
    }
  }

  /**
   * Extracts the Microsoft preferred_username (email) from an Office JWT token.
   */
  extractEmail(token: string): string | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.preferred_username ?? null;
    } catch (error) {
      this.logger.error('OfficeAuthService', 'Failed to extract email from Office token', error);
      return null;
    }
  }

  /**
   * Calls OfficeRuntime.auth.getAccessToken() to obtain a Microsoft-signed SSO token.
   * On success: stores officeToken + oid in Redux (in memory only).
   * On failure: logs the error code and clears any stale token from Redux.
   *
   * Common error codes:
   *   13001 — User not signed into Office
   *   13002 — User consent required but allowConsentPrompt is false
   *   13003 — Unsupported user type (personal Microsoft account in some contexts)
   *   13004 — App not registered in Azure AD (missing WebApplicationInfo in manifest)
   *   13005 — Invalid scope configuration
   *   13006 — Host error — retry after a delay
   *   13007 — Host cannot get token on behalf of user
   *   13008 — Previous operation still in progress — retry
   *   13012 — Running in an environment that does not support SSO (e.g. Outlook on Mac < 16.x)
   */
  async getOfficeToken(): Promise<string | null> {
    try {
      this.logger.info('OfficeAuthService', 'Requesting Office SSO token...');

      const tokenOptions = {
        allowSignInPrompt: true,   // show sign-in UI if user is not signed into Office
        allowConsentPrompt: true,  // show consent dialog on first use
        forMSGraphAccess: false,   // we only need the oid — no MS Graph access required
      };

      let token = await OfficeRuntime.auth.getAccessToken(tokenOptions);
      let expiresAt = this.extractExpiresAt(token);

      // The host is expected to hand back a fresh token, but on some hosts/platforms
      // (e.g. after the add-in was idle for a long time) it can return one that is
      // already expired or about to expire. Retry once before giving up.
      if (expiresAt !== null && expiresAt - Date.now() < EXPIRY_BUFFER_MS) {
        this.logger.warn(
          'OfficeAuthService',
          `Office token expires too soon (expiresAt: ${new Date(expiresAt).toISOString()}) — requesting a fresh one`
        );
        token = await OfficeRuntime.auth.getAccessToken(tokenOptions);
        expiresAt = this.extractExpiresAt(token);

        if (expiresAt !== null && expiresAt - Date.now() < EXPIRY_BUFFER_MS) {
          throw new Error(
            `OfficeRuntime.auth.getAccessToken() returned an expired/near-expiry token twice in a row (expiresAt: ${new Date(expiresAt).toISOString()})`
          );
        }
      }

      const oid = this.extractOid(token);
      const email = this.extractEmail(token);

      store.dispatch(setOfficeToken({ officeToken: token, oid, email }));

      this.logger.info('OfficeAuthService', `Office token obtained. oid: ${oid}, email: ${email}`);
      return token;
    } catch (error) {
      const code = (error as any)?.code;
      const message = (error as any)?.message ?? String(error);
      const name = (error as any)?.name ?? 'unknown';
      // Use console.error directly — logger may not be enabled yet at startup
      // when this catch block runs (logging is initialized via Redux after first render).
      console.error(
        `❌ [OfficeAuthService] getAccessToken() failed.\n` +
        `  error code : ${code ?? 'none'}\n` +
        `  name       : ${name}\n` +
        `  message    : ${message}\n` +
        `  raw error  :`, error
      );
      this.logger.error(
        'OfficeAuthService',
        `getAccessToken() failed (error code: ${code ?? 'unknown'}, message: ${message})`,
        error
      );
      store.dispatch(clearOfficeToken());
      store.dispatch(setOfficeAuthErrorKey(resolveOfficeAuthErrorKey(code)));
      return null;
    }
  }
}

export const officeAuthService = new OfficeAuthService();
