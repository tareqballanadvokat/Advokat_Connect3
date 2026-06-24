import { store } from "@store";
import { selectAdvokatToken } from "@slices/authSlice";
import { getLogger } from "@infra/logger";

/**
 * TokenService
 *
 * Provides token access for WebRTC API requests.
 *
 * The add-in now authenticates via Office SSO: after the WebRTC tunnel is
 * established, WebRTCConnectionManager calls webRTCApiService.sendAuthMessage()
 * which sends the Microsoft-signed Office token through the tunnel. The ADVOKAT
 * Server validates it via JWKS and returns an advokatToken stored in Redux
 * (session memory only — never persisted to disk).
 *
 * ensureValidToken() is the single method called by webRTCApiService.sendRequest()
 * before every authenticated API call.
 */
export class TokenService {
  private logger = getLogger();

  /**
   * Returns the current advokatToken from Redux, or null if not yet authenticated.
   * Called by webRTCApiService.sendRequest() before every authenticated request.
   *
   * Session lifetime is managed by the ADVOKAT Server — no local expiry check needed.
   * If the server rejects the token (401), the shared retry budget in sendRequest() handles it.
   */
  async ensureValidToken(): Promise<string | null> {
    const advokatToken = selectAdvokatToken(store.getState());

    if (!advokatToken) {
      this.logger.warn("No advokatToken available — authentication required", "TokenService");
      return null;
    }

    return advokatToken;
  }
}

export const tokenService = new TokenService();
