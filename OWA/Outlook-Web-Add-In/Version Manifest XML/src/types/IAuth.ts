// src/taskpane/components/interfaces/IAuth.tsx

export interface IAuthResponse {
  access_token: string;
  token_type?: string; // This might not be in the response
  expires_in: number; // in seconds
  refresh_token: string | null;
  refresh_token_lifetime: number; // in seconds
  scope?: string;
}

export interface IAuthCredentials {
  // Populated from the Pairing API's `kuerzel` once OTP pairing resolves
  // (see PairingApiService / pairingSlice) — the OTP is linked to a specific username.
  username: string | null;
}

export interface IAuthState {
  credentials: IAuthCredentials;
  token: string | null;
  tokenType: string | null;
  expiresAt: number | null; // timestamp in milliseconds
  refreshToken: string | null;
  refreshTokenExpiresAt: number | null; // timestamp in milliseconds
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: string | null;
  officeToken: string | null; // Microsoft Office SSO token — in memory only, never persisted
  oid: string | null;         // Microsoft user object ID extracted from officeToken
  email: string | null;       // Microsoft preferred_username (email) extracted from officeToken
  advokatToken: string | null; // Token issued by ADVOKAT Server after pairing/auth — session memory only, never persisted
  officeAuthErrorKey: string | null; // i18n key for the last getAccessToken() failure reason, or null
}

/**
 * Response returned by the ADVOKAT Server through the WebRTC data channel
 * for both the REGISTER_OTP (first-time pairing) and AUTH (returning user) flows.
 */
export interface IAdvokatAuthResponse {
  advokatToken: string;
}