/* eslint-disable no-undef */
/**
 * Integration Test — Pairing Flow Through the Real UI
 *
 * pairingFlow.test.ts exercises PairingApiService + pairingSlice directly
 * (calling service.pair()/checkServerId() itself) but never renders a
 * component — despite 05_TESTING_GUIDE_INTEGRATION.md describing this
 * scenario as covering `PairingDialog`/`App`. This file closes that gap:
 * it renders the REAL `PairingDialog` component wired to a REAL Redux
 * store (real pairingSlice + authSlice reducers) and drives the OTP
 * submission through the REAL (singleton) `pairingApiService`, with only
 * `fetch` mocked. Unlike the unit-level `PairingDialog.test.tsx` (which
 * mocks `pairingApiService` entirely and can only assert the mock was
 * called), this proves the full round trip: submit → real fetch → real
 * pairingSlice dispatch → pairingStatus flips to 'paired' → PairingDialog
 * observes its own store update and unmounts itself.
 *
 * Units under test (REAL, not mocked):
 *   PairingDialog       → the actual component under src/taskpane/components
 *   pairingApiService   → the real singleton (pair())
 *   pairingSlice, authSlice → real reducers
 *   Redux store         → real configureStore
 *
 * External boundaries mocked:
 *   fetch               → intercepted via a per-test mock
 *   @infra/logger, @config, @services/webRTCApiService → lightweight stubs
 *     (webRTCApiService is imported transitively by PairingApiService but
 *     unused by pair())
 *   react-i18next       → returns translation keys/fallbacks verbatim
 */

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

// ─── Config mock ─────────────────────────────────────────────────────────────
jest.mock("@config", () => ({
  isDevelopment: jest.fn(() => false),
  configService: { getConfig: jest.fn(() => ({})) },
}));

// ─── webRTCApiService mock (not used by pair(), but imported transitively) ───
jest.mock("@services/webRTCApiService", () => ({
  webRTCApiService: {
    initialize: jest.fn(),
    cleanup: jest.fn(),
    sendAuthMessage: jest.fn(),
  },
}));

// ─── react-i18next mock ───────────────────────────────────────────────────────
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { changeLanguage: jest.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: jest.fn() },
}));

// ─── Store mock — dynamic getter so the singleton pairingApiService dispatches
//     into the SAME store instance the rendered component reads from ─────────
let _store: ReturnType<typeof buildStore>;
jest.mock("@store", () => ({
  get store() { return _store; },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────
import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import pairingReducer, { selectPairingStatus, setUnpaired } from "@slices/pairingSlice";
import authReducer, { setOfficeToken } from "@slices/authSlice";
import { pairingApiService } from "@services/PairingApiService";
import PairingDialog from "@components/tabs/shared/PairingDialog";

function buildStore() {
  return configureStore({
    reducer: { pairing: pairingReducer, auth: authReducer },
    middleware: (gd) => gd({ serializableCheck: false }),
  });
}

function fakeResponse(body: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    json: async () => (typeof body === "string" ? JSON.parse(body) : body),
  };
}

function mockFetchOk(body: unknown, status = 200) {
  (global as any).fetch = jest.fn().mockResolvedValueOnce(fakeResponse(body, status));
}

function mockFetchError(status: number, text = "error") {
  (global as any).fetch = jest.fn().mockResolvedValueOnce(fakeResponse(text, status));
}

const OFFICE_TOKEN = "mock-office-jwt";
const SERVER_ID = "advokat-server-001";
const KUERZEL = "JCH";

function renderPairingDialog(withOfficeToken = true) {
  // Real component only renders while pairingStatus === 'unpaired' (default slice
  // state is 'unknown' — set explicitly, same as App.tsx does after checkServerId() 404s).
  _store.dispatch(setUnpaired());
  if (withOfficeToken) {
    _store.dispatch(setOfficeToken({ officeToken: OFFICE_TOKEN, oid: "oid-1", email: "user@test.com" }));
  }
  return render(
    <Provider store={_store}>
      <PairingDialog />
    </Provider>
  );
}

describe("Integration — Pairing Flow Through the Real UI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _store = buildStore();
  });

  it("submits the OTP through the real component and disappears once the real store reaches 'paired'", async () => {
    mockFetchOk({ advokatServerId: SERVER_ID, kuerzel: KUERZEL });
    const { container } = renderPairingDialog();

    expect(screen.getByText(/ADVOKAT Server Pairing Required/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /One-time pairing code/i }), {
      target: { value: "abcd1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Pair with ADVOKAT/i }));

    // Real fetch call was issued with the real request shape.
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalledTimes(1));
    const [url, init] = ((global as any).fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch(/\/addin\/pair$/);
    expect(init.headers.Authorization).toBe(`Bearer ${OFFICE_TOKEN}`);
    expect(JSON.parse(init.body)).toEqual({ otp: "ABCD1234" });

    // The real pairingSlice reducer transitioned the store to 'paired' ...
    await waitFor(() => expect(selectPairingStatus(_store.getState() as any)).toBe("paired"));

    // ... and PairingDialog, observing its own store via useAppSelector,
    // unmounts itself (returns null) without any test-level intervention.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("keeps the dialog mounted with a real error message when the real fetch call fails with HTTP 400", async () => {
    mockFetchError(400, "Invalid or expired OTP");
    renderPairingDialog();

    fireEvent.change(screen.getByRole("textbox", { name: /One-time pairing code/i }), {
      target: { value: "WRONG1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Pair with ADVOKAT/i }));

    // Real PairingApiService error-message construction (HTTP status + body text)
    // surfaces verbatim in the component, and the real store lands on 'error'.
    //
    // This also exercises a real bug this integration test found and the
    // accompanying fix: pairingApiService.pair() dispatches setPairingError()
    // (status: 'error') BEFORE throwing. PairingDialog/App.tsx previously only
    // stayed mounted while pairingStatus === 'unpaired', so the dialog unmounted
    // itself the instant the store flipped to 'error' — hiding the very error
    // message the catch block was about to render, and stranding the user with
    // no visible dialog and no way to retry. Both now also render while
    // pairingStatus === 'error'.
    await waitFor(() =>
      expect(screen.getByText(/Pairing failed: HTTP 400 — Invalid or expired OTP/i)).toBeInTheDocument()
    );
    expect(selectPairingStatus(_store.getState() as any)).toBe("error");

    // Dialog stays mounted so the user can correct the OTP and retry.
    expect(screen.getByText(/ADVOKAT Server Pairing Required/i)).toBeInTheDocument();
  });

  it("lets the user retry after a failed attempt and reach 'paired' on the second submission", async () => {
    mockFetchError(400, "Invalid or expired OTP");
    renderPairingDialog();

    const input = screen.getByRole("textbox", { name: /One-time pairing code/i });
    fireEvent.change(input, { target: { value: "WRONG1" } });
    fireEvent.click(screen.getByRole("button", { name: /Pair with ADVOKAT/i }));

    await waitFor(() => expect(selectPairingStatus(_store.getState() as any)).toBe("error"));

    // Dialog is still mounted and usable — correct the OTP and resubmit.
    mockFetchOk({ advokatServerId: SERVER_ID, kuerzel: KUERZEL });
    fireEvent.change(screen.getByRole("textbox", { name: /One-time pairing code/i }), {
      target: { value: "RIGHT1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Pair with ADVOKAT/i }));

    await waitFor(() => expect(selectPairingStatus(_store.getState() as any)).toBe("paired"));
    expect(((global as any).fetch as jest.Mock).mock.calls[0][1].body).toContain("RIGHT1");
  });

  it("never calls fetch and shows the SSO error when no Office token is present in the real auth slice", async () => {
    renderPairingDialog(/* withOfficeToken */ false);

    fireEvent.change(screen.getByRole("textbox", { name: /One-time pairing code/i }), {
      target: { value: "ABCD1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Pair with ADVOKAT/i }));

    await waitFor(() =>
      expect(screen.getByText(/Office SSO token is not available/i)).toBeInTheDocument()
    );
    expect((global as any).fetch).not.toHaveBeenCalled();
    expect(selectPairingStatus(_store.getState() as any)).toBe("unpaired");
  });
});
