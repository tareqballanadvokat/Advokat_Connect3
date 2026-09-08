/* eslint-disable no-undef */
/**
 * Component Tests for tabs/service/RegisteredService.tsx
 *
 * DataGrid is mocked with a minimal functional stand-in that exposes each
 * column's dataField value or calculateCellValue() result, so the component's
 * real fetch-on-mount effect and the time/SB display calculators can be
 * exercised.
 *
 * Covers:
 *  - Fetches registered services on mount when ready + a case is selected
 *  - Clears the list when not ready or no case selected
 *  - Re-fetches when refreshTrigger changes
 *  - 200 → populates rows, 404 → empty list (not an error), other status → error
 *  - Thrown exception → error message
 *  - getTimeDisplay / getSbDisplay: empty sachbearbeiter, single/multiple entries
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

// ─── WebRTCConnectionManager mock ──────────────────────────────────────────────
const mockGetLeistungenByAkt = jest.fn();
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => ({
      getLeistungenByAkt: (...args: any[]) => mockGetLeistungenByAkt(...args),
    })),
  })),
}));

// ─── DataGrid mock ──────────────────────────────────────────────────────────────
jest.mock("devextreme-react/data-grid", () => {
  const R = require("react");

  function DataGrid(props: any) {
    const rows = props.dataSource || [];
    const columns = R.Children.toArray(props.children).filter(
      (c: any) => c.props && (c.props.dataField || c.props.calculateCellValue)
    );
    return R.createElement(
      "div",
      { "data-testid": "registered-service-grid", "data-nodatatext": props.noDataText },
      rows.map((row: any) =>
        R.createElement(
          "div",
          { key: row.id, "data-testid": `grid-row-${row.id}` },
          columns.map((col: any, i: number) => {
            const value = col.props.calculateCellValue
              ? col.props.calculateCellValue(row)
              : row[col.props.dataField];
            return R.createElement(
              "span",
              { key: i, "data-testid": `cell-${col.props.caption}-${row.id}` },
              String(value ?? "")
            );
          })
        )
      )
    );
  }
  DataGrid.__esModule = true;
  DataGrid.default = DataGrid;
  DataGrid.Column = () => null;
  DataGrid.Paging = () => null;
  DataGrid.Pager = () => null;
  return DataGrid;
});

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import RegisteredService from "@components/tabs/service/RegisteredService";
import { renderWithProviders } from "../testUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const readyConnectionState = { sipClientState: "CONNECTED", connectionStatus: "Connected", reconnectAttempts: 0, isIdle: false };
const notReadyConnectionState = { sipClientState: "DISCONNECTED", connectionStatus: "Disconnected", reconnectAttempts: 0, isIdle: false };

function baseState(overrides: Record<string, any> = {}) {
  return {
    auth: { isAuthenticated: true, credentials: { username: "tester" } },
    connection: readyConnectionState,
    akten: { selectedAkt: { id: 1, aKurz: "TEST-1", causa: "Causa" } },
    service: { registeredServicesLoading: false },
    ...overrides,
  };
}

describe("RegisteredService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLeistungenByAkt.mockResolvedValue({ statusCode: 200, body: "[]" });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Fetch on mount
  // ──────────────────────────────────────────────────────────────────────────

  describe("fetch on mount", () => {
    it("fetches registered services when ready and a case is selected", async () => {
      renderWithProviders(<RegisteredService />, { preloadedState: baseState() });
      await waitFor(() =>
        expect(mockGetLeistungenByAkt).toHaveBeenCalledWith(expect.objectContaining({ aktId: 1 }))
      );
    });

    it("does NOT fetch when not ready", async () => {
      renderWithProviders(<RegisteredService />, {
        preloadedState: baseState({ connection: notReadyConnectionState }),
      });
      await new Promise((r) => setTimeout(r, 0));
      expect(mockGetLeistungenByAkt).not.toHaveBeenCalled();
    });

    it("does NOT fetch when no case is selected", async () => {
      renderWithProviders(<RegisteredService />, {
        preloadedState: baseState({ akten: { selectedAkt: null } }),
      });
      await new Promise((r) => setTimeout(r, 0));
      expect(mockGetLeistungenByAkt).not.toHaveBeenCalled();
    });

    it("re-fetches when refreshTrigger changes", async () => {
      const { rerender } = renderWithProviders(<RegisteredService refreshTrigger={1} />, {
        preloadedState: baseState(),
      });
      await waitFor(() => expect(mockGetLeistungenByAkt).toHaveBeenCalledTimes(1));

      rerender(<RegisteredService refreshTrigger={2} />);

      await waitFor(() => expect(mockGetLeistungenByAkt).toHaveBeenCalledTimes(2));
    });

    it("populates rows on a 200 response", async () => {
      mockGetLeistungenByAkt.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify([{ id: 1, leistungKurz: "SRV1" }]),
      });
      renderWithProviders(<RegisteredService />, { preloadedState: baseState() });
      await waitFor(() => expect(screen.getByTestId("grid-row-1")).toBeInTheDocument());
    });

    it("treats a 404 as an empty list, not an error", async () => {
      mockGetLeistungenByAkt.mockResolvedValue({ statusCode: 404 });
      renderWithProviders(<RegisteredService />, { preloadedState: baseState() });
      await waitFor(() => expect(mockGetLeistungenByAkt).toHaveBeenCalled());
      expect(screen.queryByText("failedToLoadServices")).not.toBeInTheDocument();
    });

    it("shows an error message on other failing status codes", async () => {
      mockGetLeistungenByAkt.mockResolvedValue({ statusCode: 500 });
      renderWithProviders(<RegisteredService />, { preloadedState: baseState() });
      await waitFor(() => expect(screen.getByText("failedToLoadServices")).toBeInTheDocument());
    });

    it("shows a fetch-error message when the API call throws", async () => {
      mockGetLeistungenByAkt.mockRejectedValue(new Error("network down"));
      renderWithProviders(<RegisteredService />, { preloadedState: baseState() });
      await waitFor(() => expect(screen.getByText("errorFetchingServices")).toBeInTheDocument());
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getTimeDisplay / getSbDisplay calculators
  // ──────────────────────────────────────────────────────────────────────────

  describe("cell value calculators", () => {
    it("shows an empty time/SB cell when sachbearbeiter is empty", async () => {
      mockGetLeistungenByAkt.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify([{ id: 1, sachbearbeiter: [] }]),
      });
      renderWithProviders(<RegisteredService />, { preloadedState: baseState() });
      await waitFor(() => expect(screen.getByTestId("grid-row-1")).toBeInTheDocument());
      expect(screen.getByTestId("cell-columns.time-1")).toHaveTextContent("");
      expect(screen.getByTestId("cell-columns.sb-1")).toHaveTextContent("");
    });

    it("shows the first entry's zeitVerrechenbar as the time display", async () => {
      mockGetLeistungenByAkt.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify([
          { id: 1, sachbearbeiter: [{ zeitVerrechenbar: "1:30" }, { zeitVerrechenbar: "0:45" }] },
        ]),
      });
      renderWithProviders(<RegisteredService />, { preloadedState: baseState() });
      await waitFor(() => expect(screen.getByTestId("grid-row-1")).toBeInTheDocument());
      expect(screen.getByTestId("cell-columns.time-1")).toHaveTextContent("1:30");
    });

    it("joins multiple sachbearbeiter kürzel with a comma", async () => {
      mockGetLeistungenByAkt.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify([
          { id: 1, sachbearbeiter: [{ sachbearbeiter: "JDO" }, { sachbearbeiter: "ABC" }] },
        ]),
      });
      renderWithProviders(<RegisteredService />, { preloadedState: baseState() });
      await waitFor(() => expect(screen.getByTestId("grid-row-1")).toBeInTheDocument());
      expect(screen.getByTestId("cell-columns.sb-1")).toHaveTextContent("JDO, ABC");
    });

    it("falls back to fürSachbearbeiter when sachbearbeiter kürzel is missing", async () => {
      mockGetLeistungenByAkt.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify([{ id: 1, sachbearbeiter: [{ fürSachbearbeiter: "XYZ" }] }]),
      });
      renderWithProviders(<RegisteredService />, { preloadedState: baseState() });
      await waitFor(() => expect(screen.getByTestId("grid-row-1")).toBeInTheDocument());
      expect(screen.getByTestId("cell-columns.sb-1")).toHaveTextContent("XYZ");
    });
  });
});
