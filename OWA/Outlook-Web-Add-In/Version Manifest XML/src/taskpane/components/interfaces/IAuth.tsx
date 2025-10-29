// src/taskpane/components/interfaces/IAuth.tsx

export interface IAuthRequest {
  grant_type: 'password' | 'client_credentials' | 'windows_auth' | 'refresh_token';
  client_id: string;
  client_secret?: string;
  username?: string;
  password?: string;
  refresh_token?: string;
}

export interface IAuthResponse {
  access_token: string;
  token_type?: string; // This might not be in the response
  expires_in: number; // in seconds
  refresh_token: string;
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
}