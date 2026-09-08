/* eslint-disable no-undef */
/**
 * Component Tests for tabs/case/SearchCaseList.tsx
 *
 * TextBox, Button, and DataGrid are mocked with minimal functional stand-ins so
 * the component's real search and favorites handlers can be exercised. The cache
 * layer is mocked to always miss so every search/favorite action goes through the
 * (mocked) WebRTC API.
 *
 * Covers:
 *  - Renders the search input and button
 *  - handleSearch: empty query, not-ready, in-flight guard, success, failure
 *  - Favorites: add-to-favorites success/failure, already-in-favorites state,
 *    disabled state while favorites are loading/not yet loaded
 *  - Error message and loading indicator rendering
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
const mockAktLookUp = jest.fn();
const mockAddAktToFavorite = jest.fn();
const mockGetFavoriteAkten = jest.fn();
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => ({
      aktLookUp: (...args: any[]) => mockAktLookUp(...args),
      addAktToFavorite: (...args: any[]) => mockAddAktToFavorite(...args),
      getFavoriteAkten: (...args: any[]) => mockGetFavoriteAkten(...args),
    })),
  })),
}));

// ─── DevExtreme mock ────────────────────────────────────────────────────────────
// NOTE: jest's moduleNameMapper (see jest.config.js) routes every
// "devextreme-react/*" submodule to the SAME physical mock file, so separate
// jest.mock() calls per submodule collide (last one registered wins for all of
// them). Instead, register ONE mock whose default export inspects its own props
// to decide whether it's standing in for TextBox, Button, or DataGrid.
jest.mock("devextreme-react/text-box", () => {
  const R = require("react");

  function Universal(props: any) {
    if (props.dataSource !== undefined) {
      // DataGrid usage
      const rows = props.dataSource || [];
      const columns = R.Children.toArray(props.children).filter(
        (c: any) => c.props && (c.props.dataField || c.props.buttons)
      );
      return R.createElement(
        "div",
        { "data-testid": "search-case-grid" },
        rows.map((row: any) =>
          R.createElement(
            "div",
            { key: row.id, "data-testid": `grid-row-${row.id}` },
            columns.map((col: any, i: number) => {
              if (col.props.buttons) {
                return R.createElement(
                  R.Fragment,
                  { key: i },
                  col.props.buttons.map((btn: any, bi: number) => {
                    const visible = btn.visible ? btn.visible({ row: { data: row } }) : true;
                    if (!visible) return null;
                    const disabled =
                      typeof btn.disabled === "function"
                        ? btn.disabled({ row: { data: row } })
                        : !!btn.disabled;
                    return R.createElement("button", {
                      key: bi,
                      "data-testid": `btn-${btn.icon}-${row.id}`,
                      title: btn.hint,
                      disabled,
                      onClick: () => btn.onClick?.({ row: { data: row } }),
                    });
                  })
                );
              }
              return R.createElement(
                "span",
                { key: i, "data-testid": `cell-${col.props.dataField}-${row.id}` },
                row[col.props.dataField]
              );
            })
          )
        )
      );
    }

    if (props.onValueChanged !== undefined || props.onEnterKey !== undefined) {
      // TextBox usage
      return R.createElement("input", {
        "data-testid": "search-input",
        value: props.value || "",
        placeholder: props.placeholder,
        disabled: props.disabled,
        onChange: (e: any) => props.onValueChanged?.({ value: e.target.value }),
        onKeyDown: (e: any) => {
          if (e.key === "Enter") props.onEnterKey?.();
        },
      });
    }

    // Button usage
    return R.createElement(
      "button",
      { "data-testid": `button-${props.icon}`, onClick: props.onClick, disabled: props.disabled },
      props.text
    );
  }

  return {
    __esModule: true,
    default: Universal,
    Column: () => null,
    Paging: () => null,
    Pager: () => null,
  };
});

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import * as React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import SearchCaseList from "@components/tabs/case/SearchCaseList";
import { renderWithProviders } from "../testUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const readyConnectionState = { sipClientState: "CONNECTED", connectionStatus: "Connected", reconnectAttempts: 0, isIdle: false };
const notReadyConnectionState = { sipClientState: "DISCONNECTED", connectionStatus: "Disconnected", reconnectAttempts: 0, isIdle: false };

function baseState(overrides: Record<string, any> = {}) {
  return {
    auth: { isAuthenticated: true, credentials: { username: "tester" } },
    connection: readyConnectionState,
    akten: {
      cases: [],
      favouriteAkten: [],
      loading: false,
      favoritesLoading: false,
      favoritesLoaded: true,
      addToFavoriteLoading: false,
      addingToFavoriteAktId: null,
      error: null,
      searchTerm: "",
      previousSearchTerm: null,
      searchCounter: 0,
    },
    ...overrides,
  };
}

describe("SearchCaseList (case tab)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAktLookUp.mockResolvedValue({ statusCode: 200, body: "[]" });
    mockAddAktToFavorite.mockResolvedValue({ statusCode: 200 });
    mockGetFavoriteAkten.mockResolvedValue({ statusCode: 200, body: "[]" });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Rendering
  // ──────────────────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the search input and search button", () => {
      renderWithProviders(<SearchCaseList />, { preloadedState: baseState() });
      expect(screen.getByTestId("search-input")).toBeInTheDocument();
      expect(screen.getByTestId("button-search")).toBeInTheDocument();
    });

    it("renders the error message when akten.error is set", () => {
      renderWithProviders(<SearchCaseList />, {
        preloadedState: baseState({ akten: { ...baseState().akten, error: "Something broke" } }),
      });
      expect(screen.getByText(/Something broke/)).toBeInTheDocument();
    });

    it("does not render an error message when akten.error is null", () => {
      renderWithProviders(<SearchCaseList />, { preloadedState: baseState() });
      expect(screen.queryByText("common:errorPrefix")).not.toBeInTheDocument();
    });

    it("shows the loading indicator while a search is in flight", () => {
      renderWithProviders(<SearchCaseList />, {
        preloadedState: baseState({ akten: { ...baseState().akten, loading: true } }),
      });
      expect(screen.getByText("common:searchingViaWebRTC")).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleSearch
  // ──────────────────────────────────────────────────────────────────────────

  describe("handleSearch", () => {
    it("shows a warning and does not search when the query is empty", async () => {
      renderWithProviders(<SearchCaseList />, { preloadedState: baseState() });

      fireEvent.click(screen.getByTestId("button-search"));

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith("common:enterSearchTerm", "warning", 3000)
      );
      expect(mockAktLookUp).not.toHaveBeenCalled();
    });

    it("disables the search input and button when not ready", () => {
      renderWithProviders(<SearchCaseList />, {
        preloadedState: baseState({
          connection: notReadyConnectionState,
          akten: { ...baseState().akten, searchTerm: "Mustermann" },
        }),
      });

      // The UI already disables both controls while not ready — the "not ready"
      // warning inside handleSearch is a defensive guard behind that disabled state.
      expect(screen.getByTestId("search-input")).toBeDisabled();
      expect(screen.getByTestId("button-search")).toBeDisabled();
      expect(mockAktLookUp).not.toHaveBeenCalled();
    });

    it("does not trigger a second search while one is already loading", async () => {
      renderWithProviders(<SearchCaseList />, {
        preloadedState: baseState({ akten: { ...baseState().akten, searchTerm: "Test", loading: true } }),
      });

      fireEvent.click(screen.getByTestId("button-search"));
      await new Promise((r) => setTimeout(r, 0));

      expect(mockAktLookUp).not.toHaveBeenCalled();
    });

    it("calls aktLookUp with the trimmed search term on success", async () => {
      mockAktLookUp.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify([{ id: 1, aKurz: "TEST-1", causa: "Causa 1" }]),
      });

      renderWithProviders(<SearchCaseList />, {
        preloadedState: baseState({ akten: { ...baseState().akten, searchTerm: "  Mustermann  " } }),
      });

      fireEvent.click(screen.getByTestId("button-search"));

      await waitFor(() => expect(mockAktLookUp).toHaveBeenCalledWith("Mustermann"));
    });

    it("triggers a search on Enter key press in the input", async () => {
      renderWithProviders(<SearchCaseList />, {
        preloadedState: baseState({ akten: { ...baseState().akten, searchTerm: "Test" } }),
      });

      fireEvent.keyDown(screen.getByTestId("search-input"), { key: "Enter" });

      await waitFor(() => expect(mockAktLookUp).toHaveBeenCalledWith("Test"));
    });

    it("shows an error notification when the search fails", async () => {
      mockAktLookUp.mockResolvedValue({ statusCode: 500 });

      renderWithProviders(<SearchCaseList />, {
        preloadedState: baseState({ akten: { ...baseState().akten, searchTerm: "Test" } }),
      });

      fireEvent.click(screen.getByTestId("button-search"));

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith("searchCasesFailed", "error", 5000)
      );
    });

    it("dispatches setSearchTerm when typing in the input", () => {
      const { store } = renderWithProviders(<SearchCaseList />, { preloadedState: baseState() });

      fireEvent.change(screen.getByTestId("search-input"), { target: { value: "Neu" } });

      expect(store.getState().akten.searchTerm).toBe("Neu");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Favorites
  // ──────────────────────────────────────────────────────────────────────────

  describe("Favorites", () => {
    const withResults = baseState({
      akten: {
        ...baseState().akten,
        cases: [{ id: 1, aKurz: "TEST-1", causa: "Causa 1" }],
      },
    });

    it("adds a case to favorites and shows a success notification", async () => {
      renderWithProviders(<SearchCaseList />, { preloadedState: withResults });

      fireEvent.click(screen.getByTestId("btn-favorites-1"));

      await waitFor(() => expect(mockAddAktToFavorite).toHaveBeenCalledWith(1));
      await waitFor(() => expect(mockGetFavoriteAkten).toHaveBeenCalled());
      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith("addedToFavorites", "success", 3000)
      );
    });

    it("shows an error notification when adding to favorites fails", async () => {
      mockAddAktToFavorite.mockResolvedValue({ statusCode: 500 });
      renderWithProviders(<SearchCaseList />, { preloadedState: withResults });

      fireEvent.click(screen.getByTestId("btn-favorites-1"));

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith("failedToAddToFavorites", "error", 5000)
      );
    });

    it("shows the 'already in favorites' check icon instead of the star for a favorited case", () => {
      renderWithProviders(<SearchCaseList />, {
        preloadedState: baseState({
          akten: {
            ...withResults.akten,
            favouriteAkten: [{ id: 1, aKurz: "TEST-1", causa: "Causa 1" }],
          },
        }),
      });

      expect(screen.queryByTestId("btn-favorites-1")).not.toBeInTheDocument();
      expect(screen.getByTestId("btn-check-1")).toBeInTheDocument();
    });

    it("disables the star button while favorites are still loading", () => {
      renderWithProviders(<SearchCaseList />, {
        preloadedState: baseState({
          akten: { ...withResults.akten, favoritesLoaded: false, favoritesLoading: true },
        }),
      });

      expect(screen.getByTestId("btn-favorites-1")).toBeDisabled();
    });
  });
});
