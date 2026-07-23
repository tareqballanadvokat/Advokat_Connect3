/* eslint-disable no-undef */
/**
 * Component Tests for CaseTabContent.tsx
 *
 * SearchCaseList and WebRTCConnectionStatus are mocked to stubs. devextreme-react/tree-list
 * is mocked with a minimal but functional TreeList that renders the "name" column's
 * cellRender for each top-level row so the delete button (a real handler wired by
 * CaseTabContent) can be exercised. The cache layer is mocked to always miss so every
 * fetch goes through the (mocked) WebRTC API.
 *
 * Covers:
 *  - Always renders WebRTCConnectionStatus and SearchCaseList
 *  - Fetches favorite Akten on mount once the connection is ready
 *  - Does NOT fetch favorites when the connection is not ready
 *  - Renders one row per favorite Akt
 *  - Clicking the delete button removes the Akt from favorites and refreshes the list
 *  - Delete failure shows an error notification
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

// ─── WebRTCConnectionManager mock (backs the real async thunks) ──────────────
const mockGetFavoriteAkten = jest.fn();
const mockRemoveAktFromFavorite = jest.fn();
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => ({
      getFavoriteAkten: (...args: any[]) => mockGetFavoriteAkten(...args),
      removeAktFromFavorite: (...args: any[]) => mockRemoveAktFromFavorite(...args),
    })),
  })),
}));

// ─── devextreme-react/tree-list mock ───────────────────────────────────────────
// A minimal functional TreeList: renders the "name" column's cellRender for each
// top-level row (rootId === -1) so CaseTabContent's real handlers can be exercised.
jest.mock("devextreme-react/tree-list", () => {
  const R = require("react");

  function TreeList(props: any) {
    const rows = (props.dataSource || []).filter((r: any) => r.rootId === -1);
    const columns = R.Children.toArray(props.children).filter((c: any) => c.props && c.props.cellRender);
    return R.createElement(
      "div",
      { "data-testid": "devextreme-treelist" },
      rows.map((row: any) =>
        R.createElement(
          "div",
          { key: row.id, "data-testid": `row-${row.id}` },
          columns.map((col: any, i: number) => R.createElement(R.Fragment, { key: i }, col.props.cellRender({ data: row })))
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

// ─── Child component stubs ─────────────────────────────────────────────────────
jest.mock("@components/tabs/shared/WebRTCConnectionStatus", () => ({
  __esModule: true,
  default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "webrtc-status" }); },
}));

jest.mock("@src/taskpane/components/tabs/case/SearchCaseList", () => ({
  __esModule: true,
  default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "search-case-list" }); },
}));

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import * as React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import CaseTabContent from "@components/tabs/case/CaseTabContent";
import { renderWithProviders } from "../testUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const readyConnectionState = { sipClientState: "CONNECTED", connectionStatus: "Connected", reconnectAttempts: 0, isIdle: false };
const notReadyConnectionState = { sipClientState: "DISCONNECTED", connectionStatus: "Disconnected", reconnectAttempts: 0, isIdle: false };

function baseState(overrides: Record<string, any> = {}) {
  return {
    auth: { isAuthenticated: true, credentials: { username: "tester" } },
    connection: readyConnectionState,
    akten: {
      favouriteAkten: [],
      favoritesLoading: false,
      caseDocumentsLoading: false,
      loadingCaseDocumentsForAktId: null,
      removeFromFavoriteLoading: false,
      removingFromFavoriteAktId: null,
      caseTabExpandedKeys: [],
      caseTabDocumentsByAkt: {},
    },
    ...overrides,
  };
}

const favoriteAkten = [
  { id: 1, aKurz: "TEST-1", causa: "Causa 1" },
  { id: 2, aKurz: "TEST-2", causa: "Causa 2" },
];

describe("CaseTabContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFavoriteAkten.mockResolvedValue({ statusCode: 200, body: "[]" });
    mockRemoveAktFromFavorite.mockResolvedValue({ statusCode: 200 });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Rendering
  // ──────────────────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("should always render WebRTCConnectionStatus and SearchCaseList", () => {
      renderWithProviders(<CaseTabContent />, { preloadedState: baseState() });
      expect(screen.getByTestId("webrtc-status")).toBeInTheDocument();
      expect(screen.getByTestId("search-case-list")).toBeInTheDocument();
    });

    it("should render one row per favorite Akt", () => {
      renderWithProviders(<CaseTabContent />, {
        preloadedState: baseState({ akten: { ...baseState().akten, favouriteAkten: favoriteAkten } }),
      });
      expect(screen.getByTestId("row-1")).toBeInTheDocument();
      expect(screen.getByTestId("row-2")).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Favorites fetch on mount
  // ──────────────────────────────────────────────────────────────────────────

  describe("favorites fetch on mount", () => {
    it("should fetch favorite Akten when the connection is ready and none are loaded", async () => {
      renderWithProviders(<CaseTabContent />, { preloadedState: baseState() });
      await waitFor(() => expect(mockGetFavoriteAkten).toHaveBeenCalledTimes(1));
    });

    it("should NOT fetch favorite Akten when the connection is not ready", async () => {
      renderWithProviders(<CaseTabContent />, { preloadedState: baseState({ connection: notReadyConnectionState }) });
      await new Promise((r) => setTimeout(r, 0));
      expect(mockGetFavoriteAkten).not.toHaveBeenCalled();
    });

    it("should NOT re-fetch when favorites are already loaded", async () => {
      renderWithProviders(<CaseTabContent />, {
        preloadedState: baseState({ akten: { ...baseState().akten, favouriteAkten: favoriteAkten } }),
      });
      await new Promise((r) => setTimeout(r, 0));
      expect(mockGetFavoriteAkten).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Delete (remove from favorites)
  // ──────────────────────────────────────────────────────────────────────────

  describe("removing a favorite", () => {
    it("should remove the Akt and refresh the favorites list on success", async () => {
      const { store } = renderWithProviders(<CaseTabContent />, {
        preloadedState: baseState({ akten: { ...baseState().akten, favouriteAkten: favoriteAkten } }),
      });

      fireEvent.click(screen.getAllByTitle("removeFromFavorites")[0]);

      await waitFor(() => expect(mockRemoveAktFromFavorite).toHaveBeenCalledWith(1));
      // getFavoriteAktenAsync is dispatched twice after a successful removal: once inside the
      // thunk itself (cache invalidation refresh) and once explicitly by handleDelete.
      await waitFor(() => expect(mockGetFavoriteAkten).toHaveBeenCalledTimes(2));
      expect(store.getState().akten.caseTabExpandedKeys).not.toContain(1);
    });

    it("should show an error notification when removal fails", async () => {
      mockRemoveAktFromFavorite.mockResolvedValue({ statusCode: 500 });

      renderWithProviders(<CaseTabContent />, {
        preloadedState: baseState({ akten: { ...baseState().akten, favouriteAkten: favoriteAkten } }),
      });

      fireEvent.click(screen.getAllByTitle("removeFromFavorites")[0]);

      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      expect(mockNotify.mock.calls[0][1]).toBe("error");
    });
  });
});
