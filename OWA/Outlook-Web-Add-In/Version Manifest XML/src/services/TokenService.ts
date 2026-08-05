import { store } from "@store";
import { selectAuthToken, authenticationSuccess } from "@slices/authSlice";
import { getLogger } from "@infra/logger";
import { officeAuthService } from "./OfficeAuthService";

/** Refresh proactively when less than this many ms remain on the token. */
const EXPIRY_BUFFER_MS = 2 * 60 * 1000; // 2 minutes

/**
 * TokenService
 *
 * Provides token access for WebRTC API requests.
 *
 * ensureValidToken() is the single method called by webRTCApiService.sendRequest()
 * before every authenticated API call. It proactively refreshes the ADVOKAT JWT
 * when it is within EXPIRY_BUFFER_MS of expiry by requesting a fresh Office SSO
 * token via OfficeRuntime.auth.getAccessToken() and exchanging it against
 * POST /addin/office-token/token.
 *
 * Concurrent calls during a refresh share a single in-flight promise so only
 * one HTTP request is made.
 */
export class TokenService {
  private logger = getLogger();
  private _refreshPromise: Promise<string | null> | null = null;

  async ensureValidToken(): Promise<string | null> {
    const state = store.getState();
    const token = selectAuthToken(state);
    const expiresAt: number | null = (state as any).auth?.expiresAt ?? null;
    const isNearExpiry = expiresAt !== null && expiresAt - Date.now() < EXPIRY_BUFFER_MS;

    if (token && !isNearExpiry) {
      return token;
    }

    // Token is missing or about to expire — refresh using the Office SSO token.
    if (!this._refreshPromise) {
      this._refreshPromise = this._refresh().finally(() => {
        this._refreshPromise = null;
      });
    }

    return this._refreshPromise;
  }

  private async _refresh(): Promise<string | null> {
    // Office SSO tokens are short-lived (~1h) and are not proactively renewed
    // elsewhere, so re-acquire a fresh one here rather than reusing whatever
    // is currently sitting in Redux from app startup.
    this.logger.info("Requesting fresh Office SSO token before ADVOKAT JWT exchange…", "TokenService");
    const officeToken = await officeAuthService.getOfficeToken();

    if (!officeToken) {
      this.logger.warn("Failed to obtain a fresh Office token — cannot refresh ADVOKAT JWT", "TokenService");
      return null;
    }

    try {
      this.logger.info("Refreshing ADVOKAT JWT via office-token exchange…", "TokenService");
      // Lazy-load to avoid a static circular import chain:
      // TokenService -> PairingApiService -> webRTCApiService -> TokenService
      const { pairingApiService } = await import("./PairingApiService");
      const authResponse = await pairingApiService.exchangeOfficeToken(officeToken);
      store.dispatch(authenticationSuccess(authResponse));
      this.logger.info("ADVOKAT JWT refreshed successfully", "TokenService");
      return authResponse.access_token;
    } catch (error) {
      this.logger.error("Failed to refresh ADVOKAT JWT", "TokenService", error);
      return null;
    }
  }
}

export const tokenService = new TokenService();
