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
const mockGetDocuments = jest.fn();
const mockDownloadDocument = jest.fn();
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => ({
      getFavoriteAkten: (...args: any[]) => mockGetFavoriteAkten(...args),
      removeAktFromFavorite: (...args: any[]) => mockRemoveAktFromFavorite(...args),
      GetDocuments: (...args: any[]) => mockGetDocuments(...args),
      downloadDocument: (...args: any[]) => mockDownloadDocument(...args),
    })),
  })),
}));

// ─── IsComposeMode hook mock ───────────────────────────────────────────────────
let mockIsComposeMode = false;
jest.mock("@hooks/useOfficeItem", () => ({
  IsComposeMode: () => mockIsComposeMode,
}));

// ─── devextreme-react/tree-list mock ───────────────────────────────────────────
// A minimal functional TreeList: renders the "name" column's cellRender for every
// row (top-level Akt AND file/folder rows) so CaseTabContent's real handlers can be
// exercised, plus control buttons to trigger onSelectionChanged/onExpandedRowKeysChange.
jest.mock("devextreme-react/tree-list", () => {
  const R = require("react");

  function TreeList(props: any) {
    const rows = props.dataSource || [];
    const columns = R.Children.toArray(props.children).filter((c: any) => c.props && c.props.cellRender);
    return R.createElement(
      "div",
      { "data-testid": "devextreme-treelist" },
      [
        R.createElement("button", {
          key: "__trigger-selection",
          "data-testid": "trigger-selection-changed",
          onClick: () =>
            props.onSelectionChanged?.({ component: { getSelectedRowKeys: () => [1, 2] } }),
        }),
        ...rows.map((row: any) =>
          R.createElement(
            "div",
            { key: row.id, "data-testid": `row-${row.id}` },
            [
              R.createElement("button", {
                key: "expand",
                "data-testid": `expand-${row.id}`,
                onClick: () =>
                  props.onExpandedRowKeysChange?.([...(props.expandedRowKeys || []), row.id]),
              }),
              ...columns.map((col: any, i: number) =>
                R.createElement(R.Fragment, { key: i }, col.props.cellRender({ data: row }))
              ),
            ]
          )
        ),
      ]
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
    mockGetDocuments.mockResolvedValue({ statusCode: 200, body: "[]" });
    mockDownloadDocument.mockResolvedValue(btoa("file content"));
    mockIsComposeMode = false;

    // jsdom does not implement these — stub them for the download/open handlers
    (global.URL as any).createObjectURL = jest.fn(() => "blob:mock-url");
    (global.URL as any).revokeObjectURL = jest.fn();
    window.open = jest.fn(() => null);
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

  // ──────────────────────────────────────────────────────────────────────────
  // onSelectionChanged
  // ──────────────────────────────────────────────────────────────────────────

  describe("onSelectionChanged", () => {
    it("should sync the selected row keys into caseTabExpandedKeys", () => {
      const { store } = renderWithProviders(<CaseTabContent />, {
        preloadedState: baseState({ akten: { ...baseState().akten, favouriteAkten: favoriteAkten } }),
      });

      fireEvent.click(screen.getByTestId("trigger-selection-changed"));

      expect(store.getState().akten.caseTabExpandedKeys).toEqual([1, 2]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // onExpandedRowKeysChange — loading documents for a newly-expanded Akt
  // ──────────────────────────────────────────────────────────────────────────

  describe("onExpandedRowKeysChange", () => {
    it("should fetch documents when a favorite Akt is newly expanded", async () => {
      mockGetDocuments.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify([{ id: 101, aktId: 1, dateipfad: "TEST-1\\file.msg", betreff: "Doc" }]),
      });

      renderWithProviders(<CaseTabContent />, {
        preloadedState: baseState({ akten: { ...baseState().akten, favouriteAkten: favoriteAkten } }),
      });

      fireEvent.click(screen.getByTestId("expand-1"));

      await waitFor(() => expect(mockGetDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ aktId: 1 })
      ));
    });

    it("should persist loaded documents into caseTabDocumentsByAkt", async () => {
      mockGetDocuments.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify([{ id: 101, aktId: 1, dateipfad: "TEST-1\\file.msg", betreff: "Doc" }]),
      });

      const { store } = renderWithProviders(<CaseTabContent />, {
        preloadedState: baseState({ akten: { ...baseState().akten, favouriteAkten: favoriteAkten } }),
      });

      fireEvent.click(screen.getByTestId("expand-1"));

      await waitFor(() =>
        expect(store.getState().akten.caseTabDocumentsByAkt[1]).toHaveLength(1)
      );
    });

    it("should NOT re-fetch documents for an Akt that is already loaded", async () => {
      renderWithProviders(<CaseTabContent />, {
        preloadedState: baseState({
          akten: {
            ...baseState().akten,
            favouriteAkten: favoriteAkten,
            caseTabDocumentsByAkt: { 1: [] },
          },
        }),
      });

      fireEvent.click(screen.getByTestId("expand-1"));
      await new Promise((r) => setTimeout(r, 0));

      expect(mockGetDocuments).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleOpen — downloading/opening a document
  // ──────────────────────────────────────────────────────────────────────────

  describe("handleOpen", () => {
    const stateWithFileNode = baseState({
      akten: {
        ...baseState().akten,
        favouriteAkten: favoriteAkten,
        caseTabDocumentsByAkt: {
          1: [{ id: 101, aktId: 1, dateipfad: "TEST-1\\file.msg", betreff: "Doc" }],
        },
      },
    });

    it("should download the document and show a success notification (non-viewable file)", async () => {
      renderWithProviders(<CaseTabContent />, { preloadedState: stateWithFileNode });

      fireEvent.click(screen.getByTitle("openFile"));

      await waitFor(() => expect(mockDownloadDocument).toHaveBeenCalledWith(101));
      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      expect(mockNotify.mock.calls.some((c) => c[1] === "success")).toBe(true);
    });

    it("should show an error notification when the downloaded content is empty", async () => {
      // downloadDocumentAsync itself throws "Document content is empty" for a falsy
      // response, so an empty download surfaces as the catch-block error notification.
      mockDownloadDocument.mockResolvedValue("");
      renderWithProviders(<CaseTabContent />, { preloadedState: stateWithFileNode });

      fireEvent.click(screen.getByTitle("openFile"));

      await waitFor(() =>
        expect(mockNotify.mock.calls.some((c) => c[1] === "error")).toBe(true)
      );
    });

    it("should show an error notification when the download fails", async () => {
      mockDownloadDocument.mockRejectedValue(new Error("network error"));
      renderWithProviders(<CaseTabContent />, { preloadedState: stateWithFileNode });

      fireEvent.click(screen.getByTitle("openFile"));

      await waitFor(() => expect(mockNotify.mock.calls.some((c) => c[1] === "error")).toBe(true));
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleAdd — attaching a document to the compose email
  // ──────────────────────────────────────────────────────────────────────────

  describe("handleAdd", () => {
    const stateWithFileNode = baseState({
      akten: {
        ...baseState().akten,
        favouriteAkten: favoriteAkten,
        caseTabDocumentsByAkt: {
          1: [{ id: 101, aktId: 1, dateipfad: "TEST-1\\file.msg", betreff: "Doc" }],
        },
      },
    });

    beforeEach(() => {
      mockIsComposeMode = true;
      (global as any).Office.AsyncResultStatus = { Succeeded: "succeeded", Failed: "failed" };
      (global as any).Office.context.mailbox.item.addFileAttachmentFromBase64Async = jest.fn(
        (_content: string, _name: string, _opts: any, callback: (r: any) => void) => {
          callback({ status: "succeeded" });
        }
      );
    });

    it("does not render the attach button outside compose mode", () => {
      mockIsComposeMode = false;
      renderWithProviders(<CaseTabContent />, { preloadedState: stateWithFileNode });
      expect(screen.queryByTitle("addAsAttachment")).not.toBeInTheDocument();
    });

    it("downloads the document and attaches it to the email on success", async () => {
      renderWithProviders(<CaseTabContent />, { preloadedState: stateWithFileNode });

      fireEvent.click(screen.getByTitle("addAsAttachment"));

      await waitFor(() => expect(mockDownloadDocument).toHaveBeenCalledWith(101));
      await waitFor(() =>
        expect(
          (global as any).Office.context.mailbox.item.addFileAttachmentFromBase64Async
        ).toHaveBeenCalled()
      );
      await waitFor(() => expect(mockNotify.mock.calls.some((c) => c[1] === "success")).toBe(true));
    });

    it("shows an error notification when the attach call fails", async () => {
      (global as any).Office.context.mailbox.item.addFileAttachmentFromBase64Async = jest.fn(
        (_content: string, _name: string, _opts: any, callback: (r: any) => void) => {
          callback({ status: "failed", error: new Error("attach failed") });
        }
      );

      renderWithProviders(<CaseTabContent />, { preloadedState: stateWithFileNode });

      fireEvent.click(screen.getByTitle("addAsAttachment"));

      await waitFor(() => expect(mockNotify.mock.calls.some((c) => c[1] === "error")).toBe(true));
    });

    it("shows an error and does not attach when downloaded content is empty", async () => {
      // downloadDocumentAsync itself throws "Document content is empty" for a falsy
      // response, so an empty download surfaces as the catch-block error notification.
      mockDownloadDocument.mockResolvedValue("");
      renderWithProviders(<CaseTabContent />, { preloadedState: stateWithFileNode });

      fireEvent.click(screen.getByTitle("addAsAttachment"));

      await waitFor(() => expect(mockNotify.mock.calls.some((c) => c[1] === "error")).toBe(true));
      expect(
        (global as any).Office.context.mailbox.item.addFileAttachmentFromBase64Async
      ).not.toHaveBeenCalled();
    });
  });
});
