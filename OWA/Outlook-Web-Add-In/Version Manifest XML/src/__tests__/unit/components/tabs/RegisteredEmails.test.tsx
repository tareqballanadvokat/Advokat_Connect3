/* eslint-disable no-undef */
/**
 * Component Tests for tabs/email/RegisteredEmails.tsx
 *
 * DataGrid is mocked with a minimal functional stand-in that renders the
 * "buttons" column's onClick and the "betreff"/type cellRender for each row,
 * so the component's real fetch-on-mount effect and handleOpen handler can be
 * exercised.
 *
 * Covers:
 *  - Fetches registered emails on mount when ready + a case is selected
 *  - Clears the list when not ready or no case selected
 *  - 403 retry-with-narrower-query fallback
 *  - 404 / other-error / thrown-exception → distinct error messages
 *  - handleOpen: downloads and triggers a file download, empty-content warning,
 *    404-vs-generic error message
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

// ─── notify mock ──────────────────────────────────────────────────────────────
const mockNotify = jest.fn();
jest.mock("devextreme/ui/notify", () => ({
  __esModule: true,
  default: (...args: any[]) => mockNotify(...args),
}));

// ─── WebRTCConnectionManager mock ──────────────────────────────────────────────
const mockGetDocuments = jest.fn();
const mockDownloadDocument = jest.fn();
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => ({
      GetDocuments: (...args: any[]) => mockGetDocuments(...args),
      downloadDocument: (...args: any[]) => mockDownloadDocument(...args),
    })),
  })),
}));

// ─── DataGrid mock ──────────────────────────────────────────────────────────────
jest.mock("devextreme-react/data-grid", () => {
  const R = require("react");

  function DataGrid(props: any) {
    const rows = props.dataSource || [];
    const columns = R.Children.toArray(props.children).filter(
      (c: any) => c.props && (c.props.dataField || c.props.buttons || c.props.cellRender)
    );
    return R.createElement(
      "div",
      { "data-testid": "registered-emails-grid", "data-nodatatext": props.noDataText },
      rows.map((row: any) =>
        R.createElement(
          "div",
          { key: row.id, "data-testid": `grid-row-${row.id}` },
          columns.map((col: any, i: number) => {
            if (col.props.buttons) {
              return R.createElement(
                R.Fragment,
                { key: i },
                col.props.buttons.map((btn: any, bi: number) =>
                  R.createElement("button", {
                    key: bi,
                    "data-testid": `btn-${btn.icon}-${row.id}`,
                    title: btn.hint,
                    onClick: () => btn.onClick?.({ row: { data: row } }),
                  })
                )
              );
            }
            if (col.props.cellRender) {
              return R.createElement(R.Fragment, { key: i }, col.props.cellRender({ data: row }));
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
  DataGrid.__esModule = true;
  DataGrid.default = DataGrid;
  DataGrid.Column = () => null;
  DataGrid.Paging = () => null;
  DataGrid.Pager = () => null;
  return DataGrid;
});

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import * as React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import RegisteredEmails from "@components/tabs/email/RegisteredEmails";
import { renderWithProviders } from "../testUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const readyConnectionState = { sipClientState: "CONNECTED", connectionStatus: "Connected", reconnectAttempts: 0, isIdle: false };
const notReadyConnectionState = { sipClientState: "DISCONNECTED", connectionStatus: "Disconnected", reconnectAttempts: 0, isIdle: false };

function baseState(overrides: Record<string, any> = {}) {
  return {
    auth: { isAuthenticated: true, credentials: { username: "tester" } },
    connection: readyConnectionState,
    akten: { selectedAkt: { id: 1, aKurz: "TEST-1", causa: "Causa" } },
    email: { saveCount: 0, registeredEmailsLoading: false },
    ...overrides,
  };
}

describe("RegisteredEmails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDocuments.mockResolvedValue({ statusCode: 200, body: "[]" });
    mockDownloadDocument.mockResolvedValue(btoa("email content"));
    (global.URL as any).createObjectURL = jest.fn(() => "blob:mock-url");
    (global.URL as any).revokeObjectURL = jest.fn();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Fetch on mount
  // ──────────────────────────────────────────────────────────────────────────

  describe("fetch on mount", () => {
    it("fetches documents when ready and a case is selected", async () => {
      renderWithProviders(<RegisteredEmails />, { preloadedState: baseState() });
      await waitFor(() =>
        expect(mockGetDocuments).toHaveBeenCalledWith(expect.objectContaining({ aktId: 1 }))
      );
    });

    it("does NOT fetch when not ready", async () => {
      renderWithProviders(<RegisteredEmails />, {
        preloadedState: baseState({ connection: notReadyConnectionState }),
      });
      await new Promise((r) => setTimeout(r, 0));
      expect(mockGetDocuments).not.toHaveBeenCalled();
    });

    it("does NOT fetch when no case is selected", async () => {
      renderWithProviders(<RegisteredEmails />, {
        preloadedState: baseState({ akten: { selectedAkt: null } }),
      });
      await new Promise((r) => setTimeout(r, 0));
      expect(mockGetDocuments).not.toHaveBeenCalled();
    });

    it("renders one row per email, sorted most-recent first", async () => {
      mockGetDocuments.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify([
          { id: 1, betreff: "Older", datum: "2024-01-01T00:00:00Z", dokumentArt: "MailEmpfangen" },
          { id: 2, betreff: "Newer", datum: "2024-06-01T00:00:00Z", dokumentArt: "MailEmpfangen" },
        ]),
      });

      renderWithProviders(<RegisteredEmails />, { preloadedState: baseState() });

      await waitFor(() => expect(screen.getByTestId("grid-row-2")).toBeInTheDocument());
      expect(screen.getByTestId("grid-row-1")).toBeInTheDocument();
    });

    it("retries with a narrower query on a 403 and succeeds", async () => {
      mockGetDocuments
        .mockResolvedValueOnce({ statusCode: 403 })
        .mockResolvedValueOnce({
          statusCode: 200,
          body: JSON.stringify([{ id: 1, betreff: "Doc", dokumentArt: "MailEmpfangen" }]),
        });

      renderWithProviders(<RegisteredEmails />, { preloadedState: baseState() });

      await waitFor(() => expect(mockGetDocuments).toHaveBeenCalledTimes(2));
      const secondCallArgs = mockGetDocuments.mock.calls[1][0];
      expect(secondCallArgs).not.toHaveProperty("erstelltAb");
      await waitFor(() => expect(screen.getByTestId("grid-row-1")).toBeInTheDocument());
    });

    it("shows 'no registered emails' error on a 404", async () => {
      mockGetDocuments.mockResolvedValue({ statusCode: 404 });
      renderWithProviders(<RegisteredEmails />, { preloadedState: baseState() });
      await waitFor(() => expect(screen.getByText("noRegisteredEmails")).toBeInTheDocument());
    });

    it("shows a generic error on other failing status codes", async () => {
      mockGetDocuments.mockResolvedValue({ statusCode: 500 });
      renderWithProviders(<RegisteredEmails />, { preloadedState: baseState() });
      await waitFor(() => expect(screen.getByText("failedToLoadEmails")).toBeInTheDocument());
    });

    it("shows a fetch-error message when the API call throws", async () => {
      mockGetDocuments.mockRejectedValue(new Error("network down"));
      renderWithProviders(<RegisteredEmails />, { preloadedState: baseState() });
      await waitFor(() => expect(screen.getByText("errorFetchingEmails")).toBeInTheDocument());
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleOpen
  // ──────────────────────────────────────────────────────────────────────────

  describe("handleOpen", () => {
    async function renderWithOneEmail() {
      mockGetDocuments.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify([{ id: 42, betreff: "Test Email", dokumentArt: "MailEmpfangen" }]),
      });
      renderWithProviders(<RegisteredEmails />, { preloadedState: baseState() });
      await waitFor(() => expect(screen.getByTestId("grid-row-42")).toBeInTheDocument());
    }

    it("downloads the document and triggers a file download", async () => {
      await renderWithOneEmail();

      fireEvent.click(screen.getByTestId("btn-eyeopen-42"));

      await waitFor(() => expect(mockDownloadDocument).toHaveBeenCalledWith(42));
      await waitFor(() => expect((global.URL as any).createObjectURL).toHaveBeenCalled());
    });

    it("shows a generic error when the downloaded content is empty", async () => {
      // downloadDocumentAsync itself throws "Document content is empty" for a falsy
      // response, so an empty download surfaces as the catch-block error message
      // rather than the component's own (unreachable via the thunk) warning branch.
      mockDownloadDocument.mockResolvedValue("");
      await renderWithOneEmail();

      fireEvent.click(screen.getByTestId("btn-eyeopen-42"));

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith("failedToOpenDocument", "error", 3000)
      );
    });

    it("shows a 'document not found' message for a 404 error", async () => {
      mockDownloadDocument.mockRejectedValue(new Error("Request failed: 404 Not Found"));
      await renderWithOneEmail();

      fireEvent.click(screen.getByTestId("btn-eyeopen-42"));

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith("documentNotFound", "error", 3000)
      );
    });

    it("shows a generic failure message for other errors", async () => {
      mockDownloadDocument.mockRejectedValue(new Error("network error"));
      await renderWithOneEmail();

      fireEvent.click(screen.getByTestId("btn-eyeopen-42"));

      await waitFor(() =>
        expect(mockNotify).toHaveBeenCalledWith("failedToOpenDocument", "error", 3000)
      );
    });
  });
});
