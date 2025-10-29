// src/store/slices/authSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IAuthState, IAuthCredentials, IAuthResponse } from '../../taskpane/components/interfaces/IAuth';

const initialState: IAuthState = {
  credentials: {
    grant_type: 'password',
    client_id: 'advokat.client.web',
    client_secret: 'advokat',
    username: 'JCH',
    password: '',
  },
  token: null,
  tokenType: null,
  expiresAt: null,
  refreshToken: null,
  refreshTokenExpiresAt: null,
  isAuthenticated: false,
  isAuthenticating: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<Partial<IAuthCredentials>>) => {
      state.credentials = { ...state.credentials, ...action.payload };
      state.error = null;
    },
    
    setPassword: (state, action: PayloadAction<string>) => {
      state.credentials.password = action.payload;
      state.error = null;
    },

    setUsername: (state, action: PayloadAction<string>) => {
      state.credentials.username = action.payload;
      state.error = null;
    },

    setGrantType: (state, action: PayloadAction<'password' | 'client_credentials' | 'windows_auth' | 'refresh_token'>) => {
      state.credentials.grant_type = action.payload;
      state.error = null;
    },

    startAuthentication: (state) => {
      state.isAuthenticating = true;
      state.error = null;
    },

    authenticationSuccess: (state, action: PayloadAction<IAuthResponse>) => {
      const { access_token, token_type, expires_in, refresh_token, refresh_token_lifetime } = action.payload;
      
      state.token = access_token;
      state.tokenType = token_type || 'Bearer';
      state.expiresAt = Date.now() + (expires_in * 1000); // Convert seconds to milliseconds
      state.refreshToken = refresh_token;
      state.refreshTokenExpiresAt = Date.now() + (refresh_token_lifetime * 1000); // Convert seconds to milliseconds
      state.isAuthenticated = true;
      state.isAuthenticating = false;
      state.error = null;
    },

    authenticationFailure: (state, action: PayloadAction<string>) => {
      state.token = null;
      state.tokenType = null;
      state.expiresAt = null;
      state.refreshToken = null;
      state.refreshTokenExpiresAt = null;
      state.isAuthenticated = false;
      state.isAuthenticating = false;
      state.error = action.payload;
    },

    logout: (state) => {
      state.token = null;
      state.tokenType = null;
      state.expiresAt = null;
      state.refreshToken = null;
      state.refreshTokenExpiresAt = null;
      state.isAuthenticated = false;
      state.isAuthenticating = false;
      state.error = null;
    },

    clearError: (state) => {
      state.error = null;
    },

    // Check if token is expired and clear it if so
    validateToken: (state) => {
      if (state.token && state.expiresAt && Date.now() >= state.expiresAt) {
        state.token = null;
        state.tokenType = null;
        state.expiresAt = null;
        state.isAuthenticated = false;
        state.error = 'Token expired';
      }
    },
  },
});

export const {
  setCredentials,
  setPassword,
  setUsername,
  setGrantType,
  startAuthentication,
  authenticationSuccess,
  authenticationFailure,
  logout,
  clearError,
  validateToken,
} = authSlice.actions;

// Selectors
export const selectAuth = (state: { auth: IAuthState }) => state.auth;
export const selectIsAuthenticated = (state: { auth: IAuthState }) => state.auth.isAuthenticated;
export const selectAuthToken = (state: { auth: IAuthState }) => state.auth.token;
export const selectAuthCredentials = (state: { auth: IAuthState }) => state.auth.credentials;
export const selectIsAuthenticating = (state: { auth: IAuthState }) => state.auth.isAuthenticating;
export const selectAuthError = (state: { auth: IAuthState }) => state.auth.error;

// Helper selector to check if token is valid (not expired)
export const selectIsTokenValid = (state: { auth: IAuthState }) => {
  const { token, expiresAt } = state.auth;
  return token && expiresAt && Date.now() < expiresAt;
};

export default authSlice.reducer;