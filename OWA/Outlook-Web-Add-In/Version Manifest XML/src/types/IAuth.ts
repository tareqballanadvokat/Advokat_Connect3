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
  grant_type: 'password' | 'client_credentials' | 'windows_auth' | 'refresh_token';
  client_id: string;
  client_secret: string;
  username: string;
  password: string;
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
}

/**
 * Response returned by the ADVOKAT Server through the WebRTC data channel
 * for both the REGISTER_OTP (first-time pairing) and AUTH (returning user) flows.
 */
export interface IAdvokatAuthResponse {
  advokatToken: string;
}