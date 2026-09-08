/* eslint-disable no-undef */
/**
 * Integration Test — Token Refresh Flow
 *
 * Units under test (REAL, not mocked):
 *   TokenService   → reads store, calls PairingApiService, dispatches to store
 *   authSlice      → reduces authenticationSuccess into real state
 *   Redux store    → real configureStore with all reducers
 *
 * External boundaries mocked:
 *   PairingApiService.exchangeOfficeToken (wraps the WebRTC data-channel call)
 *   @infra/logger
 */

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

// ─── Store mock — dynamic getter so each test can inject a fresh store ────────
let _store: ReturnType<typeof buildStore>;
jest.mock("@store", () => ({
  get store() { return _store; },
}));

// ─── PairingApiService mock (intercepts the dynamic import inside _refresh) ──
const mockExchangeOfficeToken = jest.fn();
jest.mock("@services/PairingApiService", () => ({
  pairingApiService: { exchangeOfficeToken: mockExchangeOfficeToken },
}));

// ─── OfficeAuthService mock — _refresh() re-acquires a fresh Office SSO token
// via this service rather than reading state.auth.officeToken directly.
const mockGetOfficeToken = jest.fn();
jest.mock("@services/OfficeAuthService", () => ({
  officeAuthService: { getOfficeToken: (...args: any[]) => mockGetOfficeToken(...args) },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────
import { configureStore } from "@reduxjs/toolkit";
import authReducer, {
  authenticationSuccess,
  setOfficeToken,
  validateToken,
} from "@slices/authSlice";
import { TokenService } from "@services/TokenService";
import type { IAuthResponse } from "@interfaces/IAuth";

// ─── Real store factory ─────────────────────────────────────────────────────
function buildStore() {
  return configureStore({
    reducer: { auth: authReducer },
    middleware: (gd) => gd({ serializableCheck: false }),
  });
}

/** Seed the store with an Office token (uses real reducer, no partial-state issues). */
function seedStore(
  store: ReturnType<typeof buildStore>,
  opts: { officeToken?: string | null; token?: string | null; expiresAt?: number | null } = {}
) {
  if (opts.officeToken) {
    store.dispatch(setOfficeToken({ officeToken: opts.officeToken, oid: null, email: null }));
    mockGetOfficeToken.mockResolvedValue(opts.officeToken);
  } else {
    mockGetOfficeToken.mockResolvedValue(null);
  }
  if (opts.token) {
    store.dispatch(
      authenticationSuccess({
        access_token:           opts.token,
        expires_in:             opts.expiresAt
          ? Math.round((opts.expiresAt - Date.now()) / 1000)
          : 3600,
        refresh_token:          null,
        refresh_token_lifetime: 7200,
      })
    );
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const EXPIRY_BUFFER_MS = 2 * 60 * 1000; // mirrors TokenService constant
const VALID_TOKEN      = "valid-advokat-token";
const NEW_TOKEN        = "refreshed-advokat-token";
const OFFICE_TOKEN     = "mock-office-jwt";

function makeAuthResponse(token = NEW_TOKEN): IAuthResponse {
  return {
    access_token:           token,
    token_type:             "Bearer",
    expires_in:             3600,
    refresh_token:          "rt-abc",
    refresh_token_lifetime: 7200,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Integration — Token Refresh Flow", () => {
  let service: TokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOfficeToken.mockReset().mockResolvedValue(null);
    _store = buildStore();
    service = new TokenService();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Happy path — valid token already in store
  // ──────────────────────────────────────────────────────────────────────────

  it("returns the cached token immediately when it is still valid", async () => {
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min — well within buffer
    _store = buildStore();
    seedStore(_store, { token: VALID_TOKEN, expiresAt, officeToken: OFFICE_TOKEN });

    const result = await service.ensureValidToken();

    expect(result).toBe(VALID_TOKEN);
    expect(mockExchangeOfficeToken).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Token near expiry — should refresh and update the real store
  // ──────────────────────────────────────────────────────────────────────────

  it("refreshes token when near expiry and updates the Redux store", async () => {
    const nearExpiry = Date.now() + 30 * 1000; // 30 s — within the 2-min buffer
    _store = buildStore();
    seedStore(_store, { token: VALID_TOKEN, expiresAt: nearExpiry, officeToken: OFFICE_TOKEN });
    mockExchangeOfficeToken.mockResolvedValue(makeAuthResponse());

    const result = await service.ensureValidToken();

    expect(result).toBe(NEW_TOKEN);
    // Real authSlice reducer should have stored the new token
    expect(_store.getState().auth.token).toBe(NEW_TOKEN);
  });

  it("calls exchangeOfficeToken with the Office token from the store", async () => {
    _store = buildStore();
    seedStore(_store, { officeToken: OFFICE_TOKEN });
    mockExchangeOfficeToken.mockResolvedValue(makeAuthResponse());

    await service.ensureValidToken();

    expect(mockExchangeOfficeToken).toHaveBeenCalledWith(OFFICE_TOKEN);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // No token — triggers refresh
  // ──────────────────────────────────────────────────────────────────────────

  it("triggers a refresh when no token exists in the store", async () => {
    _store = buildStore();
    seedStore(_store, { officeToken: OFFICE_TOKEN });
    mockExchangeOfficeToken.mockResolvedValue(makeAuthResponse());

    const result = await service.ensureValidToken();

    expect(result).toBe(NEW_TOKEN);
    expect(_store.getState().auth.token).toBe(NEW_TOKEN);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // No Office token — cannot refresh
  // ──────────────────────────────────────────────────────────────────────────

  it("returns null and makes no API call when no Office token is in the store", async () => {
    _store = buildStore();
    // No officeToken set — store has default null

    const result = await service.ensureValidToken();

    expect(result).toBeNull();
    expect(mockExchangeOfficeToken).not.toHaveBeenCalled();
    // Store should remain unchanged
    expect(_store.getState().auth.token).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Exchange failure — returns null, store not updated
  // ──────────────────────────────────────────────────────────────────────────

  it("returns null and leaves store unchanged when exchange API call fails", async () => {
    _store = buildStore();
    seedStore(_store, { officeToken: OFFICE_TOKEN });
    mockExchangeOfficeToken.mockRejectedValue(new Error("WebRTC channel not ready"));

    const result = await service.ensureValidToken();

    expect(result).toBeNull();
    expect(_store.getState().auth.token).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Concurrent calls — only one API call
  // ──────────────────────────────────────────────────────────────────────────

  it("makes only one API call when multiple concurrent ensureValidToken() calls occur", async () => {
    _store = buildStore();
    seedStore(_store, { officeToken: OFFICE_TOKEN });
    mockExchangeOfficeToken.mockResolvedValue(makeAuthResponse());

    const [r1, r2, r3] = await Promise.all([
      service.ensureValidToken(),
      service.ensureValidToken(),
      service.ensureValidToken(),
    ]);

    expect(mockExchangeOfficeToken).toHaveBeenCalledTimes(1);
    expect(r1).toBe(NEW_TOKEN);
    expect(r2).toBe(NEW_TOKEN);
    expect(r3).toBe(NEW_TOKEN);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Token just outside expiry buffer — should NOT refresh
  // ──────────────────────────────────────────────────────────────────────────

  it("does NOT refresh when token is just outside the expiry buffer", async () => {
    const safeExpiry = Date.now() + EXPIRY_BUFFER_MS + 30 * 1000; // buffer + 30 s extra
    _store = buildStore();
    seedStore(_store, { token: VALID_TOKEN, expiresAt: safeExpiry, officeToken: OFFICE_TOKEN });

    const result = await service.ensureValidToken();

    expect(result).toBe(VALID_TOKEN);
    expect(mockExchangeOfficeToken).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // authenticationSuccess dispatch updates all auth fields in real store
  // ──────────────────────────────────────────────────────────────────────────

  it("updates expiresAt in the real store after a successful refresh", async () => {
    _store = buildStore();
    seedStore(_store, { officeToken: OFFICE_TOKEN });
    mockExchangeOfficeToken.mockResolvedValue(makeAuthResponse());

    await service.ensureValidToken();

    const authState = _store.getState().auth;
    expect(authState.token).toBe(NEW_TOKEN);
    // expiresAt should be set to a future timestamp by authenticationSuccess reducer
    expect(authState.expiresAt).toBeGreaterThan(Date.now());
  });
});
