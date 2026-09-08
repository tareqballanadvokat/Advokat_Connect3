/* eslint-disable no-undef */
/**
 * Component Tests for tabs/shared/SearchCaseList.tsx (the cross-tab case picker
 * used by Email/Service tabs — distinct from tabs/case/SearchCaseList.tsx).
 *
 * TextBox, Button, and DataGrid all resolve to the same mocked module (see
 * jest.config.js moduleNameMapper), so a single "Universal" mock dispatches
 * based on which props it receives. LoadIndicator is mocked separately since
 * it maps to its own devextreme-react submodule slot.
 *
 * Covers:
 *  - Renders the search input/button and the select-case grid
 *  - handleSearch: empty query guard, in-flight guard, success, failure
 *  - Redux error state triggers a notify('error', ...)
 *  - Selecting a row calls onCaseSelect — but is gated while any Akt-scoped
 *    data (folders/services/documents) is still loading
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

// ─── WebRTCConnectionManager mock (backs the real aktLookUpAsync thunk) ───────
const mockAktLookUp = jest.fn();
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => ({
      aktLookUp: (...args: any[]) => mockAktLookUp(...args),
    })),
  })),
}));

// ─── DevExtreme mock ────────────────────────────────────────────────────────────
// See SearchCaseList.test.tsx for why this must be a single combined mock.
jest.mock("devextreme-react/text-box", () => {
  const R = require("react");

  function Universal(props: any) {
    if (props.dataSource !== undefined) {
      // DataGrid usage
      const rows = props.dataSource || [];
      const columns = R.Children.toArray(props.children).filter(
        (c: any) => c.props && (c.props.dataField || c.props.cellRender)
      );
      return R.createElement(
        "div",
        { "data-testid": "case-select-grid" },
        rows.map((row: any) =>
          R.createElement(
            "div",
            { key: row.id, "data-testid": `grid-row-${row.id}` },
            columns.map((col: any, i: number) => {
              if (col.props.cellRender) {
                return R.createElement(
                  R.Fragment,
                  { key: i },
                  col.props.cellRender({ data: row })
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

    if (props.onClick === undefined && props.width !== undefined && props.height !== undefined) {
      // LoadIndicator usage
      return R.createElement("div", { "data-testid": "load-indicator" });
    }

    // Button usage
    return R.createElement(
      "button",
      {
        "data-testid": props.icon === "arrowright" ? "select-case-btn" : `button-${props.icon}`,
        onClick: props.onClick,
        disabled: props.disabled,
        title: props.hint,
      },
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
import SearchCaseList from "@components/tabs/shared/SearchCaseList";
import { renderWithProviders } from "../testUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const readyConnectionState = { sipClientState: "CONNECTED", connectionStatus: "Connected", reconnectAttempts: 0, isIdle: false };

function baseState(overrides: Record<string, any> = {}) {
  return {
    auth: { isAuthenticated: true, credentials: { username: "tester" } },
    connection: readyConnectionState,
    akten: {
      cases: [],
      loading: false,
      error: null,
      searchTerm: "",
      previousSearchTerm: null,
      searchCounter: 0,
      selectedAkt: null,
      foldersLoading: false,
      emailDocumentsLoading: false,
    },
    service: { servicesLoading: false, registeredServicesLoading: false },
    email: { registeredEmailsLoading: false },
    ...overrides,
  };
}

describe("SearchCaseList (shared cross-tab picker)", () => {
  const onCaseSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockAktLookUp.mockResolvedValue({ statusCode: 200, body: "[]" });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Rendering
  // ──────────────────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the search input, button, and results grid", () => {
      renderWithProviders(<SearchCaseList onCaseSelect={onCaseSelect} />, { preloadedState: baseState() });
      expect(screen.getByTestId("search-input")).toBeInTheDocument();
      expect(screen.getByTestId("button-search")).toBeInTheDocument();
      expect(screen.getByTestId("case-select-grid")).toBeInTheDocument();
    });

    it("shows a loading indicator while a search is in flight", () => {
      renderWithProviders(<SearchCaseList onCaseSelect={onCaseSelect} />, {
        preloadedState: baseState({ akten: { ...baseState().akten, loading: true } }),
      });
      expect(screen.getByText("common:searchingCases")).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Redux error → notify
  // ──────────────────────────────────────────────────────────────────────────

  describe("error state", () => {
    it("shows a notify error when akten.error is set", async () => {
      renderWithProviders(<SearchCaseList onCaseSelect={onCaseSelect} />, {
        preloadedState: baseState({ akten: { ...baseState().akten, error: "Something broke" } }),
      });
      await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("Something broke", "error", 5000));
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleSearch
  // ──────────────────────────────────────────────────────────────────────────

  describe("handleSearch", () => {
    it("shows a warning and does not search when the query is empty", async () => {
      renderWithProviders(<SearchCaseList onCaseSelect={onCaseSelect} />, { preloadedState: baseState() });

      fireEvent.click(screen.getByTestId("button-search"));

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith("common:enterSearchTerm", "warning", 3000)
      );
      expect(mockAktLookUp).not.toHaveBeenCalled();
    });

    it("calls aktLookUp with the trimmed search term on success", async () => {
      renderWithProviders(<SearchCaseList onCaseSelect={onCaseSelect} />, {
        preloadedState: baseState({ akten: { ...baseState().akten, searchTerm: "  Mustermann  " } }),
      });

      fireEvent.click(screen.getByTestId("button-search"));

      await waitFor(() => expect(mockAktLookUp).toHaveBeenCalledWith("Mustermann"));
    });

    it("shows an error notification when the search fails", async () => {
      mockAktLookUp.mockResolvedValue({ statusCode: 500 });

      renderWithProviders(<SearchCaseList onCaseSelect={onCaseSelect} />, {
        preloadedState: baseState({ akten: { ...baseState().akten, searchTerm: "Test" } }),
      });

      fireEvent.click(screen.getByTestId("button-search"));

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith("searchCasesFailed", "error", 5000)
      );
    });

    it("does not trigger a second search while one is already loading", async () => {
      renderWithProviders(<SearchCaseList onCaseSelect={onCaseSelect} />, {
        preloadedState: baseState({ akten: { ...baseState().akten, searchTerm: "Test", loading: true } }),
      });

      fireEvent.click(screen.getByTestId("button-search"));
      await new Promise((r) => setTimeout(r, 0));

      expect(mockAktLookUp).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Row selection (onCaseSelect) — gated by anyAktLoading
  // ──────────────────────────────────────────────────────────────────────────

  describe("case selection", () => {
    const withResults = baseState({
      akten: { ...baseState().akten, cases: [{ id: 1, aKurz: "TEST-1", causa: "Causa 1" }] },
    });

    it("calls onCaseSelect with the row data when the select button is clicked", () => {
      renderWithProviders(<SearchCaseList onCaseSelect={onCaseSelect} />, { preloadedState: withResults });

      fireEvent.click(screen.getByTestId("select-case-btn"));

      expect(onCaseSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, aKurz: "TEST-1" })
      );
    });

    it("does NOT call onCaseSelect while Akt-scoped data is still loading", () => {
      renderWithProviders(<SearchCaseList onCaseSelect={onCaseSelect} />, {
        preloadedState: baseState({
          akten: { ...withResults.akten, foldersLoading: true },
        }),
      });

      fireEvent.click(screen.getByTestId("select-case-btn"));

      expect(onCaseSelect).not.toHaveBeenCalled();
    });

    it("shows a LoadIndicator on the selected row while Akt-scoped data loads", () => {
      renderWithProviders(<SearchCaseList onCaseSelect={onCaseSelect} />, {
        preloadedState: baseState({
          akten: {
            ...withResults.akten,
            selectedAkt: { id: 1, aKurz: "TEST-1", causa: "Causa 1" },
            foldersLoading: true,
          },
        }),
      });

      expect(screen.getByTestId("load-indicator")).toBeInTheDocument();
    });
  });
});
