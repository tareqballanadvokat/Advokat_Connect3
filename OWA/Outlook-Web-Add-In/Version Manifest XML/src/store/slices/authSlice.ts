// src/store/slices/authSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  IAuthState,
  IAuthCredentials,
  IAuthResponse,
} from "@interfaces/IAuth";
import { cacheService } from "@infra/cache";
import { getLogger } from "@infra/logger";

const logger = getLogger();

const initialState: IAuthState = {
  credentials: {
    grant_type: "password",
    client_id: "TestClientId",
    client_secret: "TestClientId",
    username: "JCH",
    password: "",
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

// Async thunk for logout to properly clear cache
export const logoutAsync = createAsyncThunk("auth/logout", async (_, { getState }) => {
  const state = getState() as { auth: IAuthState };
  const username = state.auth.credentials.username;

  if (username) {
    const clearedCount = await cacheService.clearNamespace(username);
    logger.info("authSlice", `Cache cleared for user: ${username} (${clearedCount} entries)`);
  }
});

const authSlice = createSlice({
  name: "auth",
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

    setGrantType: (
      state,
      action: PayloadAction<"password" | "client_credentials" | "windows_auth" | "refresh_token">
    ) => {
      state.credentials.grant_type = action.payload;
      state.error = null;
    },

    startAuthentication: (state) => {
      state.isAuthenticating = true;
      state.error = null;
    },

    authenticationSuccess: (state, action: PayloadAction<IAuthResponse>) => {
      const { access_token, token_type, expires_in, refresh_token, refresh_token_lifetime } =
        action.payload;

      state.token = access_token;
      state.tokenType = token_type || "Bearer";
      state.expiresAt = Date.now() + expires_in * 1000; // Convert seconds to milliseconds
      state.refreshToken = refresh_token;
      state.refreshTokenExpiresAt = Date.now() + refresh_token_lifetime * 1000; // Convert seconds to milliseconds
      state.isAuthenticated = true;
      state.isAuthenticating = false;
      state.error = null;

      // Set cache namespace for user isolation
      cacheService.setNamespace(state.credentials.username);
      logger.info("authSlice", `Cache namespace set to: ${state.credentials.username}`);

      logger.info(
        "authSlice",
        `Tokens stored in Redux, expiresAt: ${new Date(state.expiresAt).toISOString()}`
      );
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
        state.error = "Token expired";
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logoutAsync.fulfilled, () => {
        // Cache cleared successfully, logout reducer will handle state reset
        logger.info("authSlice", "Logout completed with cache cleared");
      })
      .addCase(logoutAsync.rejected, (action) => {
        logger.error("authSlice", "Failed to clear cache on logout", action.error);
        // Still proceed with logout even if cache clear fails
      });
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
export const selectRefreshToken = (state: { auth: IAuthState }) => state.auth.refreshToken;
export const selectAuthCredentials = (state: { auth: IAuthState }) => state.auth.credentials;
export const selectIsAuthenticating = (state: { auth: IAuthState }) => state.auth.isAuthenticating;
export const selectAuthError = (state: { auth: IAuthState }) => state.auth.error;

// Helper selector to check if token is valid (not expired)
export const selectIsTokenValid = (state: { auth: IAuthState }) => {
  const { token, expiresAt } = state.auth;
  return !!(token && expiresAt && Date.now() < expiresAt);
};

export default authSlice.reducer;
