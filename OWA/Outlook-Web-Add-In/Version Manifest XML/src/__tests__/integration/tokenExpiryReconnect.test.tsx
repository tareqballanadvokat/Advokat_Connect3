/* eslint-disable no-undef */
/**
 * Integration Test — Token Expiry Mid-Session, UI-Visible Consequences
 *
 * tokenRefreshFlow.test.ts already proves TokenService + authSlice work
 * correctly in isolation (PairingApiService and OfficeAuthService mocked
 * away), but never renders anything — so it can't show what the USER
 * actually sees when a background token refresh succeeds or fails mid
 * session. This file renders the REAL WebRTCConnectionStatus component on
 * top of the REAL TokenService + authSlice, with only the network/Office
 * boundaries mocked (OfficeRuntime.auth.getAccessToken, PairingApiService's
 * HTTP exchange).
 *
 * It also documents a real, easy-to-miss behavior found by wiring these
 * pieces together: TokenService._refresh() does NOT dispatch
 * authenticationFailure() when the background refresh fails — it just
 * returns null and logs a warning (see TokenService.ts). So a failed
 * proactive refresh does NOT flip the WebRTCConnectionStatus banner to the
 * red "authentication failed" state; the connection keeps showing
 * "connected" right up until whatever action triggered the refresh fails
 * with its own error notification (already covered by
 * favoritesFlow.test.tsx's error-propagation tests). This is intentional
 * per TokenService's design (the transport is still healthy — only the
 * next authenticated call fails), but is worth proving explicitly so a
 * future change doesn't silently alter it.
 *
 * Units under test (REAL, not mocked):
 *   WebRTCConnectionStatus → the actual component
 *   TokenService            → the actual singleton (ensureValidToken())
 *   authSlice, connectionSlice → real reducers
 *   Redux store              → real configureStore
 *
 * External boundaries mocked:
 *   OfficeRuntime.auth.getAccessToken (global, already stubbed in setupTests.ts)
 *   @services/PairingApiService (exchangeOfficeToken → the actual HTTP call)
 *   @services/WebRTCConnectionManager (only getConfig(), read by the status
 *     component's debug logging effect)
 *   @infra/logger, react-i18next
 */

// ─── react-i18next mock ───────────────────────────────────────────────────────
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: any) =>
      typeof fallbackOrOpts === "string" ? fallbackOrOpts : key,
    i18n: { changeLanguage: jest.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: jest.fn() },
}));

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
}));

// ─── WebRTCConnectionManager mock — only getConfig() is read by this component ─
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getConfig: jest.fn(() => ({ maxReconnectAttempts: 2 })),
  })),
}));

// ─── PairingApiService mock — the real network boundary TokenService calls ───
const mockExchangeOfficeToken = jest.fn();
jest.mock("@services/PairingApiService", () => ({
  pairingApiService: { exchangeOfficeToken: (...args: any[]) => mockExchangeOfficeToken(...args) },
}));

// ─── Store mock — dynamic getter so the real TokenService dispatches into the
//     SAME store instance the rendered component reads from ─────────────────
let _store: ReturnType<typeof buildStore>;
jest.mock("@store", () => ({
  get store() { return _store; },
}));

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import authReducer, { selectAuthToken, selectIsAuthenticated, selectAuthError } from "@slices/authSlice";
import connectionReducer from "@slices/connectionSlice";
import pairingReducer from "@slices/pairingSlice";
import { tokenService } from "@services/TokenService";
import WebRTCConnectionStatus from "@components/tabs/shared/WebRTCConnectionStatus";

function buildStore() {
  return configureStore({
    reducer: { auth: authReducer, connection: connectionReducer, pairing: pairingReducer },
    preloadedState: {
      connection: { sipClientState: "CONNECTED", connectionStatus: "Connected", reconnectAttempts: 0, isIdle: false },
      auth: {
        credentials: { username: "tester" },
        token: "old-jwt",
        tokenType: "Bearer",
        // Within TokenService's 2-minute EXPIRY_BUFFER_MS — ensureValidToken() will refresh.
        expiresAt: Date.now() + 30_000,
        refreshToken: null,
        refreshTokenExpiresAt: null,
        isAuthenticated: true,
        isAuthenticating: false,
        error: null,
        officeToken: "old-office-token",
        oid: "oid-1",
        email: "user@test.com",
        advokatToken: null,
        officeAuthErrorKey: null,
      },
    } as any,
    middleware: (gd) => gd({ serializableCheck: false }),
  });
}

function renderStatus() {
  return render(
    <Provider store={_store}>
      <WebRTCConnectionStatus />
    </Provider>
  );
}

describe("Integration — Token Expiry Mid-Session, UI-Visible Consequences", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _store = buildStore();
    (global as any).OfficeRuntime = {
      auth: { getAccessToken: jest.fn() },
    };
  });

  it("silently refreshes the ADVOKAT JWT through the real TokenService/PairingApiService chain while the connection banner stays 'connected'", async () => {
    renderStatus();
    expect(screen.getByText("webrtc.connected")).toBeInTheDocument();

    (global as any).OfficeRuntime.auth.getAccessToken.mockResolvedValue("fresh-office-token");
    mockExchangeOfficeToken.mockResolvedValue({
      access_token: "new-jwt",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: null,
      refresh_token_lifetime: 7200,
    });

    const token = await tokenService.ensureValidToken();

    expect(token).toBe("new-jwt");
    expect(mockExchangeOfficeToken).toHaveBeenCalledWith("fresh-office-token");
    // Real authSlice reducer updated the real store.
    expect(selectAuthToken(_store.getState() as any)).toBe("new-jwt");
    expect(selectIsAuthenticated(_store.getState() as any)).toBe(true);

    // No visible interruption — the banner never left "connected".
    expect(screen.getByText("webrtc.connected")).toBeInTheDocument();
  });

  it("documents that a failed background refresh stays silent at the connection-status level (no red banner, no reconnect button)", async () => {
    renderStatus();
    expect(screen.getByText("webrtc.connected")).toBeInTheDocument();

    // Office SSO itself now fails (e.g. token revoked, user signed out elsewhere).
    (global as any).OfficeRuntime.auth.getAccessToken.mockResolvedValue(null);

    const token = await tokenService.ensureValidToken();

    expect(token).toBeNull();
    expect(mockExchangeOfficeToken).not.toHaveBeenCalled();

    // authSlice is untouched by the failed background refresh — isAuthenticated
    // and the stale token are left exactly as they were.
    expect(selectIsAuthenticated(_store.getState() as any)).toBe(true);
    expect(selectAuthToken(_store.getState() as any)).toBe("old-jwt");
    expect(selectAuthError(_store.getState() as any)).toBeNull();

    // The component re-renders on the (harmless) store read but the banner
    // stays green — the failure is invisible until the next authenticated
    // action actually fails (see favoritesFlow.test.tsx's error tests).
    await waitFor(() => expect(screen.getByText("webrtc.connected")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /reconnect/i })).not.toBeInTheDocument();
  });
});
