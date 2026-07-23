/* eslint-disable no-undef */
/**
 * Component Tests for ServiceTabContent.tsx
 *
 * All heavy child components (SearchCaseList, ServiceSend, ServiceSection,
 * RegisteredService, WebRTCConnectionStatus) are mocked to simple stubs that expose
 * the props passed to them, so these tests focus on ServiceTabContent's own logic:
 * compose-mode conditional rendering, case-selection wiring, and the
 * sendServiceHandler validation/dispatch flow.
 *
 * Covers:
 *  - Always renders WebRTCConnectionStatus, SearchCaseList and RegisteredService
 *  - Hides ServiceSend / ServiceSection in compose mode
 *  - Shows ServiceSend / ServiceSection in read mode
 *  - Selecting a case dispatches setSelectedAkt
 *  - sendServiceHandler: warns and does not save when no case is selected
 *  - sendServiceHandler: errors when only one of SB/time is provided
 *  - sendServiceHandler: saves the service via saveLeistung and shows a success notification
 *  - sendServiceHandler: shows an error notification when the save fails
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
jest.mock("@hooks/useOfficeItem", () => ({
  IsComposeMode: () => mockIsComposeMode(),
  getInternetMessageIdAsync: (...args: any[]) => mockGetInternetMessageIdAsync(...args),
}));

// ─── WebRTCConnectionManager mock (backs the real async thunks) ──────────────
const mockSaveLeistung = jest.fn();
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => ({ saveLeistung: mockSaveLeistung })),
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

let lastServiceSendProps: any = null;
jest.mock("@src/taskpane/components/tabs/service/ServiceSend", () => ({
  __esModule: true,
  default: (props: any) => {
    const R = require("react");
    lastServiceSendProps = props;
    return R.createElement(
      "button",
      { "data-testid": "transfer-btn", disabled: props.transferBtnDisable, onClick: props.onTransfer },
      "Transfer"
    );
  },
}));

jest.mock("@src/taskpane/components/tabs/service/RegisteredService", () => ({
  __esModule: true,
  default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "registered-service" }); },
}));

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import * as React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import ServiceTabContent from "@components/tabs/service/ServiceTabContent";
import { renderWithProviders } from "../testUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function baseState(overrides: Record<string, any> = {}) {
  return {
    akten: { cases: [], selectedAkt: null },
    service: { selectedServiceId: 3, time: "", text: "", sb: "", services: [{ id: 3, kürzel: "TEL" }] },
    ...overrides,
  };
}

const fakeCase = { id: 42, aKurz: "TEST-42" };

describe("ServiceTabContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsComposeMode.mockReturnValue(false);
    mockGetInternetMessageIdAsync.mockResolvedValue("msg-123");
    lastSearchCaseListProps = null;
    lastServiceSendProps = null;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Rendering
  // ──────────────────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("should always render WebRTCConnectionStatus, SearchCaseList and RegisteredService", () => {
      renderWithProviders(<ServiceTabContent />, { preloadedState: baseState() });
      expect(screen.getByTestId("webrtc-status")).toBeInTheDocument();
      expect(screen.getByTestId("search-case-list")).toBeInTheDocument();
      expect(screen.getByTestId("registered-service")).toBeInTheDocument();
    });

    it("should show ServiceSend and ServiceSection in read mode", () => {
      mockIsComposeMode.mockReturnValue(false);
      renderWithProviders(<ServiceTabContent />, { preloadedState: baseState() });
      expect(screen.getByTestId("transfer-btn")).toBeInTheDocument();
      expect(screen.getByTestId("service-section")).toBeInTheDocument();
    });

    it("should hide ServiceSend and ServiceSection in compose mode", () => {
      mockIsComposeMode.mockReturnValue(true);
      renderWithProviders(<ServiceTabContent />, { preloadedState: baseState() });
      expect(screen.queryByTestId("transfer-btn")).not.toBeInTheDocument();
      expect(screen.queryByTestId("service-section")).not.toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case selection
  // ──────────────────────────────────────────────────────────────────────────

  describe("case selection", () => {
    it("should dispatch setSelectedAkt when SearchCaseList reports a case selection", async () => {
      const { store } = renderWithProviders(<ServiceTabContent />, { preloadedState: baseState() });

      await waitFor(() => expect(lastSearchCaseListProps).not.toBeNull());
      lastSearchCaseListProps.onCaseSelect(fakeCase);

      expect(store.getState().akten.selectedAkt).toEqual(fakeCase);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // sendServiceHandler validation
  // ──────────────────────────────────────────────────────────────────────────

  describe("sendServiceHandler validation", () => {
    it("should render the transfer button disabled when no case is selected", () => {
      renderWithProviders(<ServiceTabContent />, {
        preloadedState: baseState({ akten: { cases: [], selectedAkt: null } }),
      });
      expect(screen.getByTestId("transfer-btn")).toBeDisabled();
    });

    it("should warn and not save when no case is selected", async () => {
      renderWithProviders(<ServiceTabContent />, {
        preloadedState: baseState({ akten: { cases: [], selectedAkt: null } }),
      });

      await waitFor(() => expect(lastServiceSendProps).not.toBeNull());
      await lastServiceSendProps.onTransfer();

      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      expect(mockNotify.mock.calls[0][1]).toBe("warning");
      expect(mockSaveLeistung).not.toHaveBeenCalled();
    });

    it("should error and not save when only SB is provided without time", async () => {
      renderWithProviders(<ServiceTabContent />, {
        preloadedState: baseState({
          akten: { cases: [], selectedAkt: fakeCase },
          service: { selectedServiceId: 3, time: "", text: "", sb: "AB", services: [{ id: 3, kürzel: "TEL" }] },
        }),
      });

      await waitFor(() => expect(lastServiceSendProps).not.toBeNull());
      await lastServiceSendProps.onTransfer();

      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      expect(mockNotify.mock.calls[0][1]).toBe("error");
      expect(mockSaveLeistung).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // sendServiceHandler happy / error paths
  // ──────────────────────────────────────────────────────────────────────────

  describe("sendServiceHandler", () => {
    it("should save the service and show a success notification", async () => {
      mockSaveLeistung.mockResolvedValue({ statusCode: 200, body: "1" });

      renderWithProviders(<ServiceTabContent />, {
        preloadedState: baseState({ akten: { cases: [], selectedAkt: fakeCase } }),
      });

      await waitFor(() => expect(lastServiceSendProps).not.toBeNull());
      await lastServiceSendProps.onTransfer();

      await waitFor(() => expect(mockSaveLeistung).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      expect(mockNotify.mock.calls[0][1]).toBe("success");
    });

    it("should show an error notification when saving fails", async () => {
      mockSaveLeistung.mockRejectedValue(new Error("network error"));

      renderWithProviders(<ServiceTabContent />, {
        preloadedState: baseState({ akten: { cases: [], selectedAkt: fakeCase } }),
      });

      await waitFor(() => expect(lastServiceSendProps).not.toBeNull());
      await lastServiceSendProps.onTransfer();

      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      expect(mockNotify.mock.calls[0][1]).toBe("error");
    });
  });
});
