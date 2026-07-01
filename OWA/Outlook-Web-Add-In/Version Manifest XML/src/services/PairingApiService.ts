import { getLogger } from '@infra/logger';
import { store } from '@store';
import { setPaired, setUnpaired, setPairingChecking, setPairingError } from '@slices/pairingSlice';
import { isDevelopment } from '@config';
import { IAuthResponse } from '@interfaces/IAuth';

const PAIRING_API_BASE = isDevelopment()
  ? 'https://localhost:51906'
  : 'https://advokat-addin-pairing.azurewebsites.net';

export interface PairingServerInfo {
  advokatServerId: string;
  kuerzel: string;
}

/**
 * PairingApiService
 *
 * Communicates with the Pairing API (https://advokat-addin-pairing.azurewebsites.net)
 * to resolve the mapping between the current Office user (oid) and an ADVOKAT Server.
 *
 * Endpoints used:
 *   GET  /addin/server-id   — check if this oid is already paired → { advokatServerId } or 404
 *
 * The Office token is passed as a Bearer token; the Pairing API validates it via JWKS
 * and extracts the oid internally — the Add-in never sends the oid directly.
 */
export class PairingApiService {
  private logger = getLogger();

  /**
   * Exchange Office SSO token for a full ADVOKAT JWT set.
   *
   * Endpoint:
   *   POST /addin/office-token/token
   *   Authorization: Bearer <officeToken>
   *
   * Returns the same JWT shape as the classic password-grant token endpoint
   * ({ access_token, refresh_token, expires_in, refresh_token_lifetime }).
   */
  async exchangeOfficeToken(officeToken: string): Promise<IAuthResponse> {
    this.logger.info('PairingApiService', 'Exchanging Office token for ADVOKAT JWT...');

    let response: Response;
    try {
      response = await fetch(`${PAIRING_API_BASE}/addin/office-token/token`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${officeToken}`,
          Accept: 'application/json',
        },
      });
    } catch (networkError) {
      const message = networkError instanceof Error ? networkError.message : 'Network error';
      this.logger.error('PairingApiService', `Network error exchanging Office token: ${message}`, networkError);
      throw networkError;
    }

    if (response.status === 401) {
      const message = 'Office token exchange rejected (401): user is not paired to this server or Sachbearbeiter is inactive.';
      this.logger.error('PairingApiService', message);
      throw new Error(message);
    }

    if (!response.ok) {
      let detail = '';
      try { detail = await response.text(); } catch { /* ignore */ }
      const message = `Office token exchange failed: HTTP ${response.status}${detail ? ` — ${detail}` : ''}`;
      this.logger.error('PairingApiService', message);
      throw new Error(message);
    }

    let data: IAuthResponse;
    try {
      data = await response.json() as IAuthResponse;
    } catch (parseError) {
      const message = 'Office token exchange returned 200 but body is not valid JSON';
      this.logger.error('PairingApiService', message, parseError);
      throw new Error(message);
    }

    if (!data.access_token || !data.expires_in) {
      const message = 'Office token exchange response is missing required token fields';
      this.logger.error('PairingApiService', message);
      throw new Error(message);
    }

    this.logger.info('PairingApiService', 'Office token exchange successful. ADVOKAT JWT received.');
    return data;
  }

  /**
   * First-time OTP pairing.
   * Calls POST /addin/pair with the user-entered OTP.
   * The Pairing API validates the OTP, links oid → advokatServerId, and returns the server ID.
   * The add-in then uses advokatServerId to establish the WebRTC connection.
   *
   * @param otp          Short-lived code from ADVOKAT Desktop Client
   * @param officeToken  Microsoft-signed JWT from OfficeRuntime.auth.getAccessToken()
   * @returns { advokatServerId } on success
   * @throws  on network error, invalid OTP (400), or unexpected status
   */
  async pair(otp: string, officeToken: string): Promise<PairingServerInfo> {
    this.logger.info('PairingApiService', 'Submitting OTP pairing request...');
    store.dispatch(setPairingChecking());

    let response: Response;
    try {
      response = await fetch(`${PAIRING_API_BASE}/addin/pair`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${officeToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ otp }),
      });
    } catch (networkError) {
      const message = networkError instanceof Error ? networkError.message : 'Network error';
      this.logger.error('PairingApiService', `Network error during pairing: ${message}`, networkError);
      store.dispatch(setPairingError(message));
      throw networkError;
    }

    if (!response.ok) {
      let detail = '';
      try { detail = await response.text(); } catch { /* ignore */ }
      const message = `Pairing failed: HTTP ${response.status}${detail ? ` — ${detail}` : ''}`;
      this.logger.error('PairingApiService', message);
      store.dispatch(setPairingError(message));
      throw new Error(message);
    }

    let data: PairingServerInfo;
    try {
      data = await response.json() as PairingServerInfo;
    } catch (parseError) {
      const message = 'Pairing API returned 200 but body is not valid JSON';
      this.logger.error('PairingApiService', message, parseError);
      store.dispatch(setPairingError(message));
      throw new Error(message);
    }

    if (!data.advokatServerId) {
      const message = 'Pairing API returned 200 but advokatServerId is missing from response';
      this.logger.error('PairingApiService', message);
      store.dispatch(setPairingError(message));
      throw new Error(message);
    }

    this.logger.info('PairingApiService', `Pairing successful. advokatServerId: ${data.advokatServerId}, kuerzel: ${data.kuerzel}`);
    store.dispatch(setPaired({ advokatServerId: data.advokatServerId, kuerzel: data.kuerzel }));
    return data;
  }

  /**
   * Check whether the current Office user has already been paired with an ADVOKAT Server.
   *
   * @param officeToken  Microsoft-signed JWT from OfficeRuntime.auth.getAccessToken()
   * @returns { advokatServerId } if paired, null if not yet paired (404)
   * @throws  on network errors or unexpected HTTP status codes
   */
  async checkServerId(officeToken: string): Promise<PairingServerInfo | null> {
    this.logger.info('PairingApiService', 'Checking server-id pairing...');
    store.dispatch(setPairingChecking());

    let response: Response;
    try {
      response = await fetch(`${PAIRING_API_BASE}/addin/server-id`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${officeToken}`,
          Accept: 'application/json',
        },
      });
    } catch (networkError) {
      const message = networkError instanceof Error ? networkError.message : 'Network error';
      this.logger.error('PairingApiService', `Network error reaching Pairing API: ${message}`, networkError);
      store.dispatch(setPairingError(message));
      throw networkError;
    }

    if (response.status === 404) {
      this.logger.info('PairingApiService', 'No pairing found for this user (first-time setup).');
      store.dispatch(setUnpaired());
      return null;
    }

    if (!response.ok) {
      const message = `Pairing API returned unexpected status ${response.status}`;
      this.logger.error('PairingApiService', message);
      store.dispatch(setPairingError(message));
      throw new Error(message);
    }

    let data: PairingServerInfo;
    try {
      data = await response.json() as PairingServerInfo;
    } catch (parseError) {
      const message = 'Pairing API returned 200 but body is not valid JSON';
      this.logger.error('PairingApiService', message, parseError);
      store.dispatch(setPairingError(message));
      throw new Error(message);
    }

    if (!data.advokatServerId) {
      const message = 'Pairing API returned 200 but advokatServerId is missing from response';
      this.logger.error('PairingApiService', message);
      store.dispatch(setPairingError(message));
      throw new Error(message);
    }

    this.logger.info('PairingApiService', `Paired. advokatServerId: ${data.advokatServerId}, kuerzel: ${data.kuerzel}`);
    store.dispatch(setPaired({ advokatServerId: data.advokatServerId, kuerzel: data.kuerzel }));
    return data;
  }
}

export const pairingApiService = new PairingApiService();
