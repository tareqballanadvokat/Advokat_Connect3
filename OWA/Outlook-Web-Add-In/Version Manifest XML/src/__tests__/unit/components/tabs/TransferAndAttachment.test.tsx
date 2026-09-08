/* eslint-disable no-undef */
/**
 * Component Tests for tabs/email/TransferAndAttachment.tsx
 *
 * CheckBox, TextBox, and SelectBox all resolve to the same mocked module (see
 * jest.config.js moduleNameMapper), so a single "Universal" mock dispatches
 * based on which props it receives. The real aktenSlice/emailSlice reducers
 * run against a real store; only the backing WebRTC API calls are mocked.
 *
 * Covers:
 *  - Loading state while documents haven't loaded for the selected Akt yet
 *  - Error state when building the transfer list throws
 *  - Dispatches getAvailableFoldersAsync / getEmailDocumentsAsync for a newly
 *    selected case
 *  - Building rows: unsaved vs. already-saved email/attachment, with folder
 *    matched via extractFolderFromPath (skipping DokumentArt subfolders)
 *  - Attachment-to-saved-document matching by name (path/fileName/subject)
 *  - Checking an item dispatches setAttachmentSelected with only checked items
 *  - Redux sync: externally-marked-disabled items become disabled/readonly/checked
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

// ─── useOfficeItem mock ────────────────────────────────────────────────────────
const mockGetInternetMessageIdAsync = jest.fn();
const mockGetEmailSubjectAsync = jest.fn();
const mockGetEmailAttachments = jest.fn();
jest.mock("@hooks/useOfficeItem", () => ({
  useOfficeItem: jest.fn(),
  getInternetMessageIdAsync: (...args: any[]) => mockGetInternetMessageIdAsync(...args),
  getEmailSubjectAsync: (...args: any[]) => mockGetEmailSubjectAsync(...args),
  getEmailAttachments: (...args: any[]) => mockGetEmailAttachments(...args),
}));

// ─── WebRTCConnectionManager mock ──────────────────────────────────────────────
const mockGetAvailableFolders = jest.fn();
const mockGetDocuments = jest.fn();
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => ({
      getAvailableFolders: (...args: any[]) => mockGetAvailableFolders(...args),
      GetDocuments: (...args: any[]) => mockGetDocuments(...args),
    })),
  })),
}));

// ─── DevExtreme mock ────────────────────────────────────────────────────────────
jest.mock("devextreme-react/check-box", () => {
  const R = require("react");

  function Universal(props: any) {
    if (props.dataSource !== undefined) {
      // SelectBox usage — exposed via a data attribute since a plain <select>
      // without matching <option> children can't reflect an arbitrary value.
      return R.createElement("div", {
        "data-testid": "select-folder",
        "data-value": String(props.value ?? ""),
        "data-disabled": String(!!props.disabled),
        onClick: () => {
          const nextOption = (props.dataSource || []).find((f: any) => f.id !== props.value);
          if (nextOption) props.onValueChanged?.({ value: nextOption.id });
        },
      });
    }

    if (props.readOnly !== undefined) {
      // CheckBox usage
      return R.createElement("input", {
        type: "checkbox",
        "data-testid": "checkbox",
        checked: !!props.value,
        disabled: props.disabled,
        onChange: (e: any) => props.onValueChanged?.({ value: e.target.checked }),
      });
    }

    // TextBox usage
    return R.createElement("input", {
      "data-testid": "textbox-label",
      value: props.value || "",
      disabled: props.disabled,
      onChange: (e: any) => props.onValueChanged?.({ value: e.target.value }),
    });
  }

  return { __esModule: true, default: Universal };
});

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import * as React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import TransferAndAttachment from "@components/tabs/email/TransferAndAttachment";
import { renderWithProviders } from "../testUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function baseState(overrides: Record<string, any> = {}) {
  return {
    akten: {
      folderOptions: [
        { id: 1, text: "Default" },
        { id: 2, text: "Email" },
      ],
      foldersLoading: false,
      foldersError: null,
      foldersLoadedForAktId: 1,
      emailDocuments: [],
      emailDocumentsLoadedForAktId: 1,
      selectedAkt: { id: 1, aKurz: "TEST-1", causa: "Causa" },
    },
    email: { attachmentSelected: [] },
    ...overrides,
  };
}

describe("TransferAndAttachment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailableFolders.mockResolvedValue({ statusCode: 200, body: "[]" });
    mockGetDocuments.mockResolvedValue({ statusCode: 200, body: "[]" });
    mockGetInternetMessageIdAsync.mockResolvedValue("msg-abc-123");
    mockGetEmailSubjectAsync.mockResolvedValue("Test Subject");
    mockGetEmailAttachments.mockResolvedValue([]);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Loading / error states
  // ──────────────────────────────────────────────────────────────────────────

  describe("loading / error states", () => {
    it("shows the loading state until documents are loaded for the selected Akt", () => {
      renderWithProviders(<TransferAndAttachment />, {
        preloadedState: baseState({
          akten: { ...baseState().akten, emailDocumentsLoadedForAktId: null },
        }),
      });
      expect(screen.getByText("loading")).toBeInTheDocument();
    });

    it("shows nothing pending (renders the title) once loading completes with no case", async () => {
      renderWithProviders(<TransferAndAttachment />, {
        preloadedState: baseState({ akten: { ...baseState().akten, selectedAkt: null } }),
      });
      await waitFor(() => expect(screen.getByText("transferEmailAndAttachments")).toBeInTheDocument());
    });

    it("shows an error message when building the transfer list throws", async () => {
      mockGetEmailSubjectAsync.mockRejectedValue(new Error("Office API unavailable"));

      renderWithProviders(<TransferAndAttachment />, { preloadedState: baseState() });

      await waitFor(() =>
        expect(screen.getByText(/Office API unavailable/)).toBeInTheDocument()
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Fetch effects
  // ──────────────────────────────────────────────────────────────────────────

  describe("fetch effects", () => {
    it("dispatches getAvailableFoldersAsync for a newly selected case", async () => {
      renderWithProviders(<TransferAndAttachment />, {
        preloadedState: baseState({
          akten: { ...baseState().akten, foldersLoadedForAktId: null, folderOptions: [] },
        }),
      });
      await waitFor(() => expect(mockGetAvailableFolders).toHaveBeenCalledWith(1));
    });

    it("dispatches getEmailDocumentsAsync with the Outlook message id for a newly selected case", async () => {
      renderWithProviders(<TransferAndAttachment />, {
        preloadedState: baseState({ akten: { ...baseState().akten, emailDocumentsLoadedForAktId: null } }),
      });
      await waitFor(() =>
        expect(mockGetDocuments).toHaveBeenCalledWith(
          expect.objectContaining({ aktId: 1 })
        )
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Row building — email row
  // ──────────────────────────────────────────────────────────────────────────

  describe("email row", () => {
    it("renders an unsaved email row as unchecked and enabled", async () => {
      renderWithProviders(<TransferAndAttachment />, { preloadedState: baseState() });

      await waitFor(() => expect(screen.getByTestId("checkbox")).toBeInTheDocument());
      expect(screen.getByTestId("checkbox")).not.toBeChecked();
      expect(screen.getByTestId("checkbox")).not.toBeDisabled();
    });

    it("marks an already-saved email row as checked, readonly, and disabled with its matched folder", async () => {
      renderWithProviders(<TransferAndAttachment />, {
        preloadedState: baseState({
          akten: {
            ...baseState().akten,
            emailDocuments: [
              {
                id: 501,
                aktId: 1,
                betreff: "Saved Subject",
                outlookEmailId: "msg-abc-123",
                dokumentArt: "MailEmpfangen",
                dateipfad: "C:\\ADVOKAT\\Daten\\TEST\\Email\\MailEmpfangen\\msg.eml",
              },
            ],
          },
        }),
      });

      await waitFor(() => expect(screen.getByTestId("checkbox")).toBeChecked());
      expect(screen.getByTestId("checkbox")).toBeDisabled();
      expect(screen.getByTestId("textbox-label")).toHaveValue("Saved Subject");
      // extractFolderFromPath skips the "MailEmpfangen" DokumentArt subfolder and
      // finds "Email" — matched against folderOptions to select its id (2).
      expect(screen.getByTestId("select-folder")).toHaveAttribute("data-value", "2");
    });

    it("falls back to 'Default' when the saved path has no real folder above the DokumentArt subfolder", async () => {
      renderWithProviders(<TransferAndAttachment />, {
        preloadedState: baseState({
          akten: {
            ...baseState().akten,
            emailDocuments: [
              {
                id: 501,
                aktId: 1,
                betreff: "Saved Subject",
                outlookEmailId: "msg-abc-123",
                dokumentArt: "MailEmpfangen",
                dateipfad: "C:\\MailEmpfangen\\msg.eml",
              },
            ],
          },
        }),
      });

      await waitFor(() => expect(screen.getByTestId("checkbox")).toBeChecked());
      // folderOptions[0] is "Default" (id 1) and no matching folder named "Default"
      // is required to exist for extractFolderFromPath itself to return "Default".
      expect(screen.getByTestId("select-folder")).toHaveAttribute("data-value", "1");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Row building — attachments
  // ──────────────────────────────────────────────────────────────────────────

  describe("attachment rows", () => {
    it("renders one row per attachment plus the email row", async () => {
      mockGetEmailAttachments.mockResolvedValue([
        { id: "att-1", name: "file1.pdf" },
        { id: "att-2", name: "file2.docx" },
      ]);

      renderWithProviders(<TransferAndAttachment />, { preloadedState: baseState() });

      await waitFor(() => expect(screen.getAllByTestId("checkbox")).toHaveLength(3));
    });

    it("matches a saved attachment document by filename and marks it checked/disabled", async () => {
      mockGetEmailAttachments.mockResolvedValue([{ id: "att-1", name: "invoice.pdf" }]);

      renderWithProviders(<TransferAndAttachment />, {
        preloadedState: baseState({
          akten: {
            ...baseState().akten,
            emailDocuments: [
              {
                id: 502,
                aktId: 1,
                betreff: "Invoice doc",
                outlookEmailId: "msg-abc-123",
                dokumentArt: "Keine",
                dateipfad: "C:\\ADVOKAT\\Daten\\TEST\\Email\\Keine\\invoice.pdf",
              },
            ],
          },
        }),
      });

      await waitFor(() => expect(screen.getAllByTestId("checkbox")).toHaveLength(2));
      const checkboxes = screen.getAllByTestId("checkbox");
      // [0] = email row (unsaved, unchecked), [1] = attachment row (matched, checked)
      expect(checkboxes[0]).not.toBeChecked();
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[1]).toBeDisabled();
    });

    it("does not match an attachment document belonging to a different email", async () => {
      mockGetEmailAttachments.mockResolvedValue([{ id: "att-1", name: "invoice.pdf" }]);

      renderWithProviders(<TransferAndAttachment />, {
        preloadedState: baseState({
          akten: {
            ...baseState().akten,
            emailDocuments: [
              {
                id: 502,
                aktId: 1,
                betreff: "Invoice doc",
                outlookEmailId: "some-other-message-id",
                dokumentArt: "Keine",
                dateipfad: "invoice.pdf",
              },
            ],
          },
        }),
      });

      await waitFor(() => expect(screen.getAllByTestId("checkbox")).toHaveLength(2));
      const checkboxes = screen.getAllByTestId("checkbox");
      expect(checkboxes[1]).not.toBeChecked();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Checking an item dispatches setAttachmentSelected
  // ──────────────────────────────────────────────────────────────────────────

  describe("updateItem / checking a row", () => {
    it("dispatches setAttachmentSelected with only the checked items", async () => {
      mockGetEmailAttachments.mockResolvedValue([{ id: "att-1", name: "file1.pdf" }]);

      const { store } = renderWithProviders(<TransferAndAttachment />, { preloadedState: baseState() });

      await waitFor(() => expect(screen.getAllByTestId("checkbox")).toHaveLength(2));

      fireEvent.click(screen.getAllByTestId("checkbox")[1]);

      await waitFor(() => expect(store.getState().email.attachmentSelected).toHaveLength(1));
      expect(store.getState().email.attachmentSelected[0].name).toBe("file1.pdf");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Redux sync — externally marking an item disabled after save
  // ──────────────────────────────────────────────────────────────────────────

  describe("Redux sync from attachmentSelected", () => {
    it("marks a previously-enabled item as disabled/readonly/checked once Redux flags it disabled", async () => {
      mockGetEmailAttachments.mockResolvedValue([{ id: "att-1", name: "file1.pdf" }]);

      const { store } = renderWithProviders(<TransferAndAttachment />, { preloadedState: baseState() });
      await waitFor(() => expect(screen.getAllByTestId("checkbox")).toHaveLength(2));
      expect(screen.getAllByTestId("checkbox")[1]).not.toBeDisabled();

      const { setAttachmentSelected } = require("@slices/emailSlice");
      store.dispatch(setAttachmentSelected([{ id: "att-1", name: "file1.pdf", disabled: true }]));

      await waitFor(() => {
        const boxes = screen.getAllByTestId("checkbox");
        expect((boxes[1] as HTMLInputElement).disabled).toBe(true);
      });
    });
  });
});
