/* eslint-disable no-undef */
/**
 * Component Tests for tabs/person/SearchPersonList.tsx
 *
 * TextBox, Button, and DataGrid all resolve to the same mocked module (see
 * jest.config.js moduleNameMapper), so a single "Universal" mock dispatches
 * based on which props it receives.
 *
 * Covers:
 *  - Renders search input/button and results grid
 *  - handleSearch: empty query guard, in-flight guard, success, failure
 *  - Display name assembly (title+first+last, falls back to nKurz)
 *  - handleAddToFavorites delegates to onPersonSelect, with favorited/adding
 *    states swapping which action button is shown
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

// ─── WebRTCConnectionManager mock ──────────────────────────────────────────────
const mockPersonLookUp = jest.fn();
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => ({
      personLookUp: (...args: any[]) => mockPersonLookUp(...args),
    })),
  })),
}));

// ─── DevExtreme mock ────────────────────────────────────────────────────────────
jest.mock("devextreme-react/text-box", () => {
  const R = require("react");

  function Universal(props: any) {
    if (props.dataSource !== undefined) {
      // DataGrid usage
      const rows = props.dataSource || [];
      const columns = R.Children.toArray(props.children).filter(
        (c: any) => c.props && (c.props.dataField || c.props.buttons || c.props.cellRender)
      );
      return R.createElement(
        "div",
        { "data-testid": "person-grid" },
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
                    return R.createElement("button", {
                      key: bi,
                      "data-testid": `btn-${btn.icon}-${row.id}`,
                      title: btn.hint,
                      disabled: !!btn.disabled,
                      onClick: () => btn.onClick?.({ row: { data: row } }),
                    });
                  })
                );
              }
              if (col.props.cellRender) {
                return R.createElement(R.Fragment, { key: i }, col.props.cellRender({ data: row }));
              }
              const value = col.props.dataField
                .split(".")
                .reduce((acc: any, key: string) => acc?.[key], row);
              return R.createElement(
                "span",
                { key: i, "data-testid": `cell-${col.props.dataField}-${row.id}` },
                value
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
import SearchPersonList from "@components/tabs/person/SearchPersonList";
import { renderWithProviders } from "../testUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const readyConnectionState = { sipClientState: "CONNECTED", connectionStatus: "Connected", reconnectAttempts: 0, isIdle: false };

function baseState(overrides: Record<string, any> = {}) {
  return {
    auth: { isAuthenticated: true, credentials: { username: "tester" } },
    connection: readyConnectionState,
    person: {
      persons: [],
      loading: false,
      addToFavoriteLoading: false,
      addingToFavoritePersonId: null,
      error: null,
      searchTerm: "",
      previousSearchTerm: null,
      searchCounter: 0,
      favorites: [],
    },
    ...overrides,
  };
}

describe("SearchPersonList", () => {
  const onPersonSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockPersonLookUp.mockResolvedValue({ statusCode: 200, body: "[]" });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Rendering
  // ──────────────────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the search input, button, and grid", () => {
      renderWithProviders(<SearchPersonList onPersonSelect={onPersonSelect} />, {
        preloadedState: baseState(),
      });
      expect(screen.getByTestId("search-input")).toBeInTheDocument();
      expect(screen.getByTestId("button-search")).toBeInTheDocument();
      expect(screen.getByTestId("person-grid")).toBeInTheDocument();
    });

    it("assembles the display name from title/first/last name parts", async () => {
      renderWithProviders(<SearchPersonList onPersonSelect={onPersonSelect} />, {
        preloadedState: baseState({
          person: {
            ...baseState().person,
            persons: [{ id: 1, titel: "Dr.", vorname: "Max", name1: "Mustermann", nKurz: "MUS001" }],
          },
        }),
      });
      expect(screen.getByText("Dr. Max Mustermann")).toBeInTheDocument();
    });

    it("falls back to nKurz when no name parts are present", async () => {
      renderWithProviders(<SearchPersonList onPersonSelect={onPersonSelect} />, {
        preloadedState: baseState({
          person: { ...baseState().person, persons: [{ id: 1, nKurz: "MUS001" }] },
        }),
      });
      // Appears twice: once in the nKurz column cell, once as the display-name
      // cellRender's own fallback to nKurz.
      expect(screen.getAllByText("MUS001").length).toBeGreaterThanOrEqual(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleSearch
  // ──────────────────────────────────────────────────────────────────────────

  describe("handleSearch", () => {
    it("shows a warning and does not search when the query is empty", async () => {
      renderWithProviders(<SearchPersonList onPersonSelect={onPersonSelect} />, {
        preloadedState: baseState(),
      });

      fireEvent.click(screen.getByTestId("button-search"));

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith("common:enterSearchTerm", "warning", 3000)
      );
      expect(mockPersonLookUp).not.toHaveBeenCalled();
    });

    it("calls personLookUp with the trimmed search term on success", async () => {
      renderWithProviders(<SearchPersonList onPersonSelect={onPersonSelect} />, {
        preloadedState: baseState({ person: { ...baseState().person, searchTerm: "  Mustermann  " } }),
      });

      fireEvent.click(screen.getByTestId("button-search"));

      await waitFor(() => expect(mockPersonLookUp).toHaveBeenCalledWith("Mustermann"));
    });

    it("shows an error notification when the search fails", async () => {
      mockPersonLookUp.mockResolvedValue({ statusCode: 500 });

      renderWithProviders(<SearchPersonList onPersonSelect={onPersonSelect} />, {
        preloadedState: baseState({ person: { ...baseState().person, searchTerm: "Test" } }),
      });

      fireEvent.click(screen.getByTestId("button-search"));

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith("searchPersonsFailed", "error", 5000)
      );
    });

    it("does not trigger a second search while one is already loading", async () => {
      renderWithProviders(<SearchPersonList onPersonSelect={onPersonSelect} />, {
        preloadedState: baseState({ person: { ...baseState().person, searchTerm: "Test", loading: true } }),
      });

      fireEvent.click(screen.getByTestId("button-search"));
      await new Promise((r) => setTimeout(r, 0));

      expect(mockPersonLookUp).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Redux error → notify
  // ──────────────────────────────────────────────────────────────────────────

  describe("error state", () => {
    it("shows a notify error when person.error is set", async () => {
      renderWithProviders(<SearchPersonList onPersonSelect={onPersonSelect} />, {
        preloadedState: baseState({ person: { ...baseState().person, error: "Broke" } }),
      });
      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("Broke", "error", 5000));
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Favorites button
  // ──────────────────────────────────────────────────────────────────────────

  describe("handleAddToFavorites", () => {
    const withResults = baseState({
      person: { ...baseState().person, persons: [{ id: 1, nKurz: "MUS001", vorname: "Max", name1: "M" }] },
    });

    it("delegates to onPersonSelect with the person id and display name", () => {
      renderWithProviders(<SearchPersonList onPersonSelect={onPersonSelect} />, {
        preloadedState: withResults,
      });

      fireEvent.click(screen.getByTestId("btn-favorites-1"));

      expect(onPersonSelect).toHaveBeenCalledWith(1, "Max M");
    });

    it("shows the check icon instead of the star for an already-favorited person", () => {
      renderWithProviders(<SearchPersonList onPersonSelect={onPersonSelect} />, {
        preloadedState: baseState({
          person: { ...withResults.person, favorites: [{ id: 1 }] },
        }),
      });

      expect(screen.queryByTestId("btn-favorites-1")).not.toBeInTheDocument();
      expect(screen.getByTestId("btn-check-1")).toBeInTheDocument();
    });

    it("shows the loading icon while the person is being added to favorites", () => {
      renderWithProviders(<SearchPersonList onPersonSelect={onPersonSelect} />, {
        preloadedState: baseState({
          person: { ...withResults.person, addToFavoriteLoading: true, addingToFavoritePersonId: 1 },
        }),
      });

      expect(screen.queryByTestId("btn-favorites-1")).not.toBeInTheDocument();
      expect(screen.getByTestId("btn-refresh-1")).toBeInTheDocument();
    });
  });
});
