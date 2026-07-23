/* eslint-disable no-undef */
/**
 * Component Tests for EmailTabContent.tsx
 *
 * All heavy child components (SearchCaseList, EmailSend, ServiceSection,
 * TransferAndAttachment, RegisteredEmails, WebRTCConnectionStatus) are mocked to
 * simple stubs that expose the props passed to them, so these tests focus on
 * EmailTabContent's own logic: compose-mode conditional rendering, the messageId
 * fetch effect, and the sendEmailHandler validation/dispatch flow.
 *
 * Covers:
 *  - Always renders WebRTCConnectionStatus and SearchCaseList
 *  - Hides EmailSend / ServiceSection / TransferAndAttachment in compose mode
 *  - Shows EmailSend / ServiceSection / TransferAndAttachment in read mode
 *  - Selecting a case dispatches setSelectedAkt
 *  - sendEmailHandler: warns and does not save when no case is selected
 *  - sendEmailHandler: warns and does not save when messageId is not yet available
 *  - sendEmailHandler: saves the selected email via saveDokument and marks it disabled
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

// ─── useOfficeItem mock ────────────────────────────────────────────────────────
const mockIsComposeMode = jest.fn(() => false);
const mockGetInternetMessageIdAsync = jest.fn().mockResolvedValue("msg-123");
const mockGetEmailContentAsync = jest.fn().mockResolvedValue("<html>email</html>");
jest.mock("@hooks/useOfficeItem", () => ({
  IsComposeMode: () => mockIsComposeMode(),
  getInternetMessageIdAsync: (...args: any[]) => mockGetInternetMessageIdAsync(...args),
  getEmailContentAsync: (...args: any[]) => mockGetEmailContentAsync(...args),
}));

// ─── WebRTCConnectionManager mock (backs the real async thunks) ──────────────
const mockSaveDokument = jest.fn();
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => ({ saveDokument: mockSaveDokument })),
  })),
}));

// ─── Child component stubs ─────────────────────────────────────────────────────
jest.mock("@components/tabs/shared/WebRTCConnectionStatus", () => ({
  __esModule: true,
  default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "webrtc-status" }); },
}));

let lastSearchCaseListProps: any = null;
jest.mock("@components/tabs/shared/SearchCaseList", () => ({
  __esModule: true,
  default: (props: any) => {
    const R = require("react");
    lastSearchCaseListProps = props;
    return R.createElement("div", { "data-testid": "search-case-list" });
  },
}));

jest.mock("@components/tabs/shared/ServiceSection", () => ({
  __esModule: true,
  default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "service-section" }); },
}));

let lastEmailSendProps: any = null;
jest.mock("@src/taskpane/components/tabs/email/EmailSend", () => ({
  __esModule: true,
  default: (props: any) => {
    const R = require("react");
    lastEmailSendProps = props;
    return R.createElement(
      "button",
      { "data-testid": "transfer-btn", disabled: props.transferBtnDisable, onClick: props.onTransfer },
      "Transfer"
    );
  },
}));

jest.mock("@src/taskpane/components/tabs/email/RegisteredEmails", () => ({
  __esModule: true,
  default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "registered-emails" }); },
}));

jest.mock("@src/taskpane/components/tabs/email/TransferAndAttachment", () => ({
  __esModule: true,
  default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "transfer-and-attachment" }); },
}));

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import * as React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import EmailTabContent from "@components/tabs/email/EmailTabContent";
import { renderWithProviders } from "../testUtils";
import { setSelectedAkt } from "@slices/aktenSlice";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const readyAuthState = { isAuthenticated: true };
const readyConnectionState = { sipClientState: "CONNECTED", connectionStatus: "Connected", reconnectAttempts: 0, isIdle: false };

function baseState(overrides: Record<string, any> = {}) {
  return {
    auth: readyAuthState,
    connection: readyConnectionState,
    akten: { cases: [], selectedAkt: null },
    email: { attachmentSelected: [], saveDokumentLoading: false, saveDokumentError: null, saveCount: 0, registeredEmailsLoading: false },
    service: { selectedServiceId: 0, time: "", text: "", sb: "", services: [] },
    ...overrides,
  };
}

const fakeCase = { id: 42, aKurz: "TEST-42" };

describe("EmailTabContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsComposeMode.mockReturnValue(false);
    mockGetInternetMessageIdAsync.mockResolvedValue("msg-123");
    lastSearchCaseListProps = null;
    lastEmailSendProps = null;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Rendering
  // ──────────────────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("should always render WebRTCConnectionStatus and SearchCaseList", () => {
      renderWithProviders(<EmailTabContent />, { preloadedState: baseState() });
      expect(screen.getByTestId("webrtc-status")).toBeInTheDocument();
      expect(screen.getByTestId("search-case-list")).toBeInTheDocument();
    });

    it("should always render RegisteredEmails", () => {
      renderWithProviders(<EmailTabContent />, { preloadedState: baseState() });
      expect(screen.getByTestId("registered-emails")).toBeInTheDocument();
    });

    it("should show EmailSend, ServiceSection and TransferAndAttachment in read mode", () => {
      mockIsComposeMode.mockReturnValue(false);
      renderWithProviders(<EmailTabContent />, { preloadedState: baseState() });
      expect(screen.getByTestId("transfer-btn")).toBeInTheDocument();
      expect(screen.getByTestId("service-section")).toBeInTheDocument();
      expect(screen.getByTestId("transfer-and-attachment")).toBeInTheDocument();
    });

    it("should hide EmailSend, ServiceSection and TransferAndAttachment in compose mode", () => {
      mockIsComposeMode.mockReturnValue(true);
      renderWithProviders(<EmailTabContent />, { preloadedState: baseState() });
      expect(screen.queryByTestId("transfer-btn")).not.toBeInTheDocument();
      expect(screen.queryByTestId("service-section")).not.toBeInTheDocument();
      expect(screen.queryByTestId("transfer-and-attachment")).not.toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case selection
  // ──────────────────────────────────────────────────────────────────────────

  describe("case selection", () => {
    it("should dispatch setSelectedAkt when SearchCaseList reports a case selection", async () => {
      const { store } = renderWithProviders(<EmailTabContent />, { preloadedState: baseState() });

      await waitFor(() => expect(mockGetInternetMessageIdAsync).toHaveBeenCalled());
      await waitFor(() => expect(lastSearchCaseListProps).not.toBeNull());
      await lastSearchCaseListProps.onCaseSelect(fakeCase);

      expect(store.getState().akten.selectedAkt).toEqual(fakeCase);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // sendEmailHandler validation
  // ──────────────────────────────────────────────────────────────────────────

  describe("sendEmailHandler validation", () => {
    it("should render the transfer button disabled when no case is selected", () => {
      renderWithProviders(<EmailTabContent />, {
        preloadedState: baseState({ akten: { cases: [], selectedAkt: null } }),
      });
      expect(screen.getByTestId("transfer-btn")).toBeDisabled();
    });

    it("should warn and not save when no case is selected", async () => {
      renderWithProviders(<EmailTabContent />, {
        preloadedState: baseState({ akten: { cases: [], selectedAkt: null } }),
      });

      await waitFor(() => expect(lastEmailSendProps).not.toBeNull());
      await lastEmailSendProps.onTransfer();

      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      expect(mockNotify.mock.calls[0][1]).toBe("warning");
      expect(mockSaveDokument).not.toHaveBeenCalled();
    });

    it("should warn and not save when messageId is not yet available", async () => {
      mockGetInternetMessageIdAsync.mockRejectedValue(new Error("no id"));

      renderWithProviders(<EmailTabContent />, {
        preloadedState: baseState({ akten: { cases: [], selectedAkt: fakeCase } }),
      });

      // Wait for the mount effect's failed messageId fetch to settle.
      await waitFor(() => expect(mockGetInternetMessageIdAsync).toHaveBeenCalled());
      await waitFor(() => expect(lastEmailSendProps).not.toBeNull());

      await lastEmailSendProps.onTransfer();

      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      expect(mockSaveDokument).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // sendEmailHandler happy path
  // ──────────────────────────────────────────────────────────────────────────

  describe("sendEmailHandler happy path", () => {
    it("should save the selected email and mark it disabled on success", async () => {
      mockSaveDokument.mockResolvedValue({ statusCode: 200, body: "999" });

      const selectedEmailItem = {
        id: "att-1",
        label: "Email",
        name: "email.eml",
        type: "E",
        checked: true,
        disabled: false,
        folderName: null,
      };

      const { store } = renderWithProviders(<EmailTabContent />, {
        preloadedState: baseState({
          akten: { cases: [], selectedAkt: fakeCase },
          email: { attachmentSelected: [selectedEmailItem], saveDokumentLoading: false, saveDokumentError: null, saveCount: 0, registeredEmailsLoading: false },
        }),
      });

      await waitFor(() => expect(mockGetInternetMessageIdAsync).toHaveBeenCalled());

      fireEvent.click(screen.getByTestId("transfer-btn"));

      await waitFor(() => expect(mockSaveDokument).toHaveBeenCalledTimes(1));

      await waitFor(() => {
        expect(store.getState().email.attachmentSelected[0].disabled).toBe(true);
      });
    });
  });
});
