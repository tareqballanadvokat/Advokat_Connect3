/* eslint-disable no-undef */
/**
 * Integration Test — Favorites (Case) Flow, End-to-End
 *
 * Unlike the unit-level CaseTabContent.test.tsx (which mocks
 * WebRTCConnectionManager.getWebRTCApiService() to return plain jest.fn()
 * stubs — i.e. never exercises real request/response message construction),
 * this test wires the REAL CaseTabContent component to the REAL aktenSlice
 * reducer/thunks AND a REAL WebRTCApiService instance. Only the true I/O
 * boundary — WebRTCDataChannelService.send()/onDataChannelMessage() — is
 * driven manually, exactly the way the real DataChannel would deliver bytes.
 *
 * This proves the full round trip that unit tests test in isolated pieces:
 *   delete click → removeAktFromFavoriteAsync thunk → real WebRTCApiService
 *   builds the actual chunked protocol request → (fake) DataChannel "sends"
 *   it → simulated server response delivered back through
 *   onDataChannelMessage() → real thunk resolves → real reducer updates →
 *   component re-renders → success notification.
 *
 * Units under test (REAL, not mocked):
 *   CaseTabContent        → the actual component
 *   aktenSlice            → real reducer + real thunks (getFavoriteAktenAsync,
 *                            removeAktFromFavoriteAsync)
 *   connectionSlice       → real selectIsReady
 *   WebRTCApiService       → real instance — real chunking/request-id/protocol
 *                            construction (chunkingUtils is NOT mocked)
 *   Redux store            → real configureStore
 *
 * External boundaries mocked:
 *   WebRTCDataChannelService → send() captured, responses delivered via the
 *     real service's own onDataChannelMessage() (exactly as production code
 *     receives them)
 *   TokenService, @infra/logger, @infra/cache (forced miss), notify,
 *   devextreme-react/tree-list, @hooks/useOfficeItem, react-i18next
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

// ─── notify mock ──────────────────────────────────────────────────────────────
const mockNotify = jest.fn();
jest.mock("devextreme/ui/notify", () => ({
  __esModule: true,
  default: (...args: any[]) => mockNotify(...args),
}));

// ─── Cache mock (always miss so thunks always hit the WebRTC API) ────────────
jest.mock("@infra/cache", () => {
  const actual = jest.requireActual("@infra/cache");
  return {
    ...actual,
    cacheService: {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      clearCacheType: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// ─── TokenService mock ────────────────────────────────────────────────────────
jest.mock("@services/TokenService", () => ({
  tokenService: { ensureValidToken: jest.fn(() => Promise.resolve("valid-token")) },
}));

// ─── WebRTCDataChannelService mock — the ONLY true I/O boundary here ─────────
const mockSend = jest.fn();
const mockDataChannelSvc = {
  send: (...args: any[]) => mockSend(...args),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  isSubscribed: jest.fn(() => false),
  isReadyForCommunication: true,
};
jest.mock("@services/WebRTCDataChannelService", () => ({
  WebRTCDataChannelService: { getInstance: jest.fn(() => mockDataChannelSvc) },
}));

// ─── IsComposeMode hook mock ───────────────────────────────────────────────────
jest.mock("@hooks/useOfficeItem", () => ({ IsComposeMode: () => false }));

// ─── devextreme-react/tree-list mock — minimal but functional ────────────────
// Renders the "name" column's cellRender for every top-level row (so the real
// delete handler wired by CaseTabContent can be exercised via a real click).
jest.mock("devextreme-react/tree-list", () => {
  const R = require("react");
  function TreeList(props: any) {
    const rows = props.dataSource || [];
    const columns = R.Children.toArray(props.children).filter((c: any) => c.props && c.props.cellRender);
    return R.createElement(
      "div",
      { "data-testid": "devextreme-treelist" },
      rows.map((row: any) =>
        R.createElement(
          "div",
          { key: row.id, "data-testid": `row-${row.id}` },
          columns.map((col: any, i: number) =>
            R.createElement(R.Fragment, { key: i }, col.props.cellRender({ data: row }))
          )
        )
      )
    );
  }
  TreeList.__esModule = true;
  TreeList.default = TreeList;
  TreeList.Column = (_props: any) => null;
  TreeList.Scrolling = (_props: any) => null;
  TreeList.Editing = (_props: any) => null;
  return TreeList;
});

// ─── Child component stubs (not the focus of this integration test) ─────────
jest.mock("@components/tabs/shared/WebRTCConnectionStatus", () => ({
  __esModule: true,
  default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "webrtc-status" }); },
}));
jest.mock("@src/taskpane/components/tabs/case/SearchCaseList", () => ({
  __esModule: true,
  default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "search-case-list" }); },
}));

// ─── WebRTCConnectionManager mock — hands back a REAL WebRTCApiService ───────
import { WebRTCApiService } from "@services/webRTCApiService";
const fakeSipClient = {} as any;
const svc = new WebRTCApiService();
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => svc),
  })),
}));

// ─── Store mock — dynamic getter so the real thunks dispatch into the SAME
//     store instance the rendered component reads from ──────────────────────
let _store: ReturnType<typeof buildStore>;
jest.mock("@store", () => ({
  get store() { return _store; },
}));

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import * as React from "react";
import { screen, waitFor, fireEvent, render } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import aktenReducer from "@slices/aktenSlice";
import connectionReducer from "@slices/connectionSlice";
import authReducer from "@slices/authSlice";
import CaseTabContent from "@components/tabs/case/CaseTabContent";
import type { WebRTCApiRequest, WebRTCApiResponse } from "@interfaces/IWebRTC";

function buildStore() {
  return configureStore({
    reducer: { akten: aktenReducer, connection: connectionReducer, auth: authReducer },
    preloadedState: {
      connection: { sipClientState: "CONNECTED", connectionStatus: "Connected", reconnectAttempts: 0, isIdle: false },
      auth: { isAuthenticated: true, credentials: { username: "tester" } },
    } as any,
    middleware: (gd) => gd({ serializableCheck: false }),
  });
}

function renderCaseTabContent() {
  return render(
    <Provider store={_store}>
      <CaseTabContent />
    </Provider>
  );
}

function base64EncodeUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** All chunks the real WebRTCApiService has actually sent for a given messageType. */
function sentRequestsFor(messageType: string): WebRTCApiRequest[] {
  return mockSend.mock.calls
    .map((c) => JSON.parse(c[0]) as WebRTCApiRequest)
    .filter((r) => r.messageType === messageType);
}

/** Simulate the server responding, exactly as WebRTCDataChannelService would deliver it. */
function deliverJsonResponse(id: string, jsonBody: unknown, statusCode = 200) {
  const response: WebRTCApiResponse = {
    id,
    timestamp: Date.now(),
    totalChunks: 1,
    currentChunk: 1,
    statusCode,
    body: base64EncodeUtf8(JSON.stringify(jsonBody)),
  } as WebRTCApiResponse;
  svc.onDataChannelMessage(new MessageEvent("message", { data: JSON.stringify(response) }));
}

/** Resolve the most recently sent request for a messageType with a JSON body. */
function resolveLatest(messageType: string, jsonBody: unknown, statusCode = 200) {
  const requests = sentRequestsFor(messageType);
  const last = requests[requests.length - 1];
  deliverJsonResponse(last.id, jsonBody, statusCode);
}

async function flush(times = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

const favoriteAkten = [
  { id: 1, aKurz: "TEST-1", causa: "Causa 1" },
  { id: 2, aKurz: "TEST-2", causa: "Causa 2" },
];

describe("Integration — Favorites (Case) Flow End-to-End", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDataChannelSvc.isSubscribed.mockReturnValue(false);
    mockDataChannelSvc.isReadyForCommunication = true;
    _store = buildStore();
    svc.cleanup();
    svc.initialize(fakeSipClient);
  });

  it("fetches favorites on mount via a real chunked protocol request and renders the real response", async () => {
    renderCaseTabContent();

    await waitFor(() => expect(sentRequestsFor("akten.getFavoriteAkten")).toHaveLength(1));
    const req = sentRequestsFor("akten.getFavoriteAkten")[0];

    // Real request construction: GET to the real endpoint, real headers.
    expect(req.method).toBe("GET");
    expect(req.uri).toMatch(/^api\/v2\.0\/akten\?/);
    expect(req.headers.Accept).toBe("application/json");

    resolveLatest("akten.getFavoriteAkten", favoriteAkten);

    await waitFor(() => expect(screen.getByTestId("row-1")).toBeInTheDocument());
    expect(screen.getByTestId("row-2")).toBeInTheDocument();
  });

  it("removes a favorite through the full stack: real DELETE request, real response, real reducer update, refetch, success notification", async () => {
    renderCaseTabContent();

    await waitFor(() => expect(sentRequestsFor("akten.getFavoriteAkten")).toHaveLength(1));
    resolveLatest("akten.getFavoriteAkten", favoriteAkten);
    await waitFor(() => expect(screen.getByTestId("row-1")).toBeInTheDocument());

    fireEvent.click(screen.getAllByTitle("removeFromFavorites")[0]);

    // Real removeAktFromFavoriteAsync -> real WebRTCApiService.removeAktFromFavorite(1)
    await waitFor(() => expect(sentRequestsFor("akten.removeAktFromFavorite")).toHaveLength(1));
    const deleteReq = sentRequestsFor("akten.removeAktFromFavorite")[0];
    expect(deleteReq.method).toBe("DELETE");
    expect(deleteReq.uri).toBe("api/v2.0/akten/RemoveFromFavorites/1");

    resolveLatest("akten.removeAktFromFavorite", {});

    // removeAktFromFavoriteAsync AWAITS this inner refetch itself (cache-invalidation
    // refresh) before returning — it must be resolved before handleDelete's own
    // .unwrap() continues to its own explicit refetch dispatch below.
    await waitFor(() => expect(sentRequestsFor("akten.getFavoriteAkten")).toHaveLength(2));
    resolveLatest("akten.getFavoriteAkten", [favoriteAkten[1]]);

    // Now removeAktFromFavoriteAsync has resolved — handleDelete's explicit refetch fires.
    await waitFor(() => expect(sentRequestsFor("akten.getFavoriteAkten")).toHaveLength(3));
    resolveLatest("akten.getFavoriteAkten", [favoriteAkten[1]]);

    await waitFor(() => expect(screen.queryByTestId("row-1")).not.toBeInTheDocument());
    expect(screen.getByTestId("row-2")).toBeInTheDocument();
    expect(mockNotify).toHaveBeenCalledWith(
      expect.stringContaining("removedFromFavoritesSuccess"),
      "success",
      3000
    );
  });

  it("shows an error notification and keeps the favorite when the server returns a permanent error status", async () => {
    renderCaseTabContent();

    await waitFor(() => expect(sentRequestsFor("akten.getFavoriteAkten")).toHaveLength(1));
    resolveLatest("akten.getFavoriteAkten", favoriteAkten);
    await waitFor(() => expect(screen.getByTestId("row-1")).toBeInTheDocument());

    fireEvent.click(screen.getAllByTitle("removeFromFavorites")[0]);
    await waitFor(() => expect(sentRequestsFor("akten.removeAktFromFavorite")).toHaveLength(1));

    // Real WebRTCApiService.validateAndCompleteResponse() treats 400 as a permanent
    // error (unlike 500, which it retries) — fails the request immediately, exactly
    // as the real server would for a bad request.
    resolveLatest("akten.removeAktFromFavorite", {}, 400);

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.stringContaining("failedToRemoveFromFavorites"),
        "error",
        5000
      )
    );
    // No refetch was triggered — the favorite is still in the list.
    expect(screen.getByTestId("row-1")).toBeInTheDocument();
  });

  it("propagates a connection-level failure (channels not ready) as a Redux error and a UI notification, distinct from an HTTP-status error", async () => {
    renderCaseTabContent();

    await waitFor(() => expect(sentRequestsFor("akten.getFavoriteAkten")).toHaveLength(1));
    resolveLatest("akten.getFavoriteAkten", favoriteAkten);
    await waitFor(() => expect(screen.getByTestId("row-1")).toBeInTheDocument());

    // Connection drops between the favorites list loading and the user clicking
    // delete. CaseTabContent's handleDelete has no isReady guard (unlike the
    // mount-fetch effect), so the real WebRTCApiService.sendRequest() is reached
    // and throws synchronously — this never becomes a pending/sent request at all,
    // exercising a genuinely different failure path than an HTTP error response.
    mockDataChannelSvc.isReadyForCommunication = false;

    fireEvent.click(screen.getAllByTitle("removeFromFavorites")[0]);

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.stringContaining("failedToRemoveFromFavorites"),
        "error",
        5000
      )
    );
    expect(sentRequestsFor("akten.removeAktFromFavorite")).toHaveLength(0);
    expect(screen.getByTestId("row-1")).toBeInTheDocument();
  });
});
