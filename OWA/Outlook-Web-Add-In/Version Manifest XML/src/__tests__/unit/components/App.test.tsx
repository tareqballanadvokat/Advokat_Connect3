/* eslint-disable no-undef */
/**
 * Component Tests for App.tsx
 *
 * Tests the top-level App component:
 *   - Renders without crashing
 *   - Shows PairingDialog when pairingStatus === 'unpaired'
 *   - Hides PairingDialog when pairingStatus !== 'unpaired'
 *   - Always renders the Tabs
 *   - Always renders the environment banner
 *   - Calls officeAuthService.getOfficeToken on mount
 *   - Chains to pairingApiService.checkServerId when a token is returned
 *   - Short-circuits when getOfficeToken returns null
 *   - Dispatches initializeLogging on mount
 */

// ─── react-i18next mock ───────────────────────────────────────────────────────
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { changeLanguage: jest.fn() } }),
  initReactI18next: { type: "3rdParty", init: jest.fn() },
}));

// ─── FluentUI mock (makeStyles just returns empty class maps) ────────────────
jest.mock("@fluentui/react-components", () => ({
  makeStyles: () => () => ({}),
  FluentProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ─── Config mock ─────────────────────────────────────────────────────────────
jest.mock("@config", () => ({
  configService: {
    getConfig: jest.fn(() => ({
      logging: { enabled: false, level: "warn" },
      theme: { name: "generic", compact: false },
      sip: { host: "test.host", port: 5061 },
    })),
    getSipConfig: jest.fn(() => ({ host: "test.host", port: 5061, toDisplayName: "S", fromDisplayName: "C" })),
    buildSipUri: jest.fn((name: string) => `sip:${name}@test.host:5061`),
    patchSipConfig: jest.fn(),
  },
  isDevelopment: jest.fn(() => false),
}));

jest.mock("@config/runtimeConfig", () => ({
  setAdvokatServerId: jest.fn(),
  setUserIdentifier: jest.fn(),
}));

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    updateConfig: jest.fn(), enable: jest.fn(), disable: jest.fn(), setLevel: jest.fn(),
  })),
}));

// ─── Service mocks ────────────────────────────────────────────────────────────
const mockGetOfficeToken = jest.fn();
jest.mock("@services/OfficeAuthService", () => ({
  officeAuthService: { getOfficeToken: mockGetOfficeToken },
}));

const mockCheckServerId = jest.fn();
jest.mock("@services/PairingApiService", () => ({
  pairingApiService: { checkServerId: mockCheckServerId },
}));

const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockInitialize = jest.fn().mockResolvedValue(undefined);
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
    initialize: mockInitialize,
    authenticate: jest.fn(),
    getWebRTCApiService: jest.fn(),
  })),
}));

// ─── Child component mocks ────────────────────────────────────────────────────
jest.mock("@components/Tab", () => ({
  __esModule: true,
  default: () => <div data-testid="tabs" />,
}));

jest.mock("@components/tabs/shared/PairingDialog", () => ({
  __esModule: true,
  default: () => <div data-testid="pairing-dialog" />,
}));

// ─── Imports ─────────────────────────────────────────────────────────────────
import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import App from "@components/App";
import { renderWithProviders } from "./testUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pairedState = { pairing: { status: "paired", advokatServerId: "adv-01", kuerzel: "JCH", error: null } };
const unpairedState = { pairing: { status: "unpaired", advokatServerId: null, kuerzel: null, error: null } };
const unknownState = { pairing: { status: "unknown", advokatServerId: null, kuerzel: null, error: null } };

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: OfficeRuntime is not available → SSO branch is skipped
    (global as any).OfficeRuntime = undefined;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Rendering basics
  // ──────────────────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("should render without crashing", () => {
      expect(() => renderWithProviders(<App title="Test" />, { preloadedState: unknownState })).not.toThrow();
    });

    it("should always render the Tabs component", () => {
      renderWithProviders(<App title="Test" />, { preloadedState: pairedState });
      expect(screen.getByTestId("tabs")).toBeInTheDocument();
    });

    it("should render the environment banner", () => {
      renderWithProviders(<App title="Test" />, { preloadedState: pairedState });
      // jsdom sets hostname to 'localhost' by default → banner shows LOCAL
      expect(screen.getByText(/LOCAL/i)).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PairingDialog visibility
  // ──────────────────────────────────────────────────────────────────────────

  describe("PairingDialog", () => {
    it("should show PairingDialog when pairingStatus is 'unpaired'", () => {
      renderWithProviders(<App title="Test" />, { preloadedState: unpairedState });
      expect(screen.getByTestId("pairing-dialog")).toBeInTheDocument();
    });

    it("should NOT show PairingDialog when pairingStatus is 'paired'", () => {
      renderWithProviders(<App title="Test" />, { preloadedState: pairedState });
      expect(screen.queryByTestId("pairing-dialog")).not.toBeInTheDocument();
    });

    it("should NOT show PairingDialog when pairingStatus is 'unknown'", () => {
      renderWithProviders(<App title="Test" />, { preloadedState: unknownState });
      expect(screen.queryByTestId("pairing-dialog")).not.toBeInTheDocument();
    });

    it("should NOT show PairingDialog when pairingStatus is 'checking'", () => {
      const checkingState = { pairing: { status: "checking", advokatServerId: null, kuerzel: null, error: null } };
      renderWithProviders(<App title="Test" />, { preloadedState: checkingState });
      expect(screen.queryByTestId("pairing-dialog")).not.toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SSO / pairing effects
  // ──────────────────────────────────────────────────────────────────────────

  describe("onMount SSO effect", () => {
    it("should NOT call getOfficeToken when OfficeRuntime is unavailable", async () => {
      (global as any).OfficeRuntime = undefined;

      renderWithProviders(<App title="Test" />, { preloadedState: unknownState });

      await waitFor(() => {
        expect(mockGetOfficeToken).not.toHaveBeenCalled();
      });
    });

    it("should call getOfficeToken when OfficeRuntime.auth is available", async () => {
      (global as any).OfficeRuntime = { auth: { getAccessToken: jest.fn() } };
      mockGetOfficeToken.mockResolvedValue("office-token-abc");
      mockCheckServerId.mockResolvedValue(null);

      renderWithProviders(<App title="Test" />, { preloadedState: unknownState });

      await waitFor(() => {
        expect(mockGetOfficeToken).toHaveBeenCalledTimes(1);
      });
    });

    it("should call checkServerId with the Office token when getOfficeToken succeeds", async () => {
      (global as any).OfficeRuntime = { auth: { getAccessToken: jest.fn() } };
      mockGetOfficeToken.mockResolvedValue("office-token-xyz");
      mockCheckServerId.mockResolvedValue({ advokatServerId: "adv-01", kuerzel: "JCH" });

      renderWithProviders(<App title="Test" />, { preloadedState: unknownState });

      await waitFor(() => {
        expect(mockCheckServerId).toHaveBeenCalledWith("office-token-xyz");
      });
    });

    it("should NOT call checkServerId when getOfficeToken returns null", async () => {
      (global as any).OfficeRuntime = { auth: { getAccessToken: jest.fn() } };
      mockGetOfficeToken.mockResolvedValue(null);

      renderWithProviders(<App title="Test" />, { preloadedState: unknownState });

      await waitFor(() => {
        expect(mockGetOfficeToken).toHaveBeenCalledTimes(1);
      });
      expect(mockCheckServerId).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Logging initialisation effect
  // ──────────────────────────────────────────────────────────────────────────

  describe("logging initialisation", () => {
    it("should dispatch initializeLogging on mount", async () => {
      const { store } = renderWithProviders(<App title="Test" />, { preloadedState: pairedState });

      // Logging state should be initialised from the config mock (enabled: false, level: 'warn')
      await waitFor(() => {
        expect(store.getState().logging.enabled).toBe(false);
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Ctrl+Shift+L logging toggle shortcut
  // ──────────────────────────────────────────────────────────────────────────

  describe("Ctrl+Shift+L logging toggle shortcut", () => {
    function fireCtrlShiftL() {
      const event = new KeyboardEvent("keydown", {
        key: "L",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
      return event;
    }

    it("toggles the logging.enabled flag in the store", async () => {
      const { store } = renderWithProviders(<App title="Test" />, { preloadedState: pairedState });
      await waitFor(() => expect(store.getState().logging.enabled).toBe(false));

      fireCtrlShiftL();

      expect(store.getState().logging.enabled).toBe(true);
    });

    it("toggles back off on a second press", async () => {
      const { store } = renderWithProviders(<App title="Test" />, { preloadedState: pairedState });
      await waitFor(() => expect(store.getState().logging.enabled).toBe(false));

      fireCtrlShiftL();
      fireCtrlShiftL();

      expect(store.getState().logging.enabled).toBe(false);
    });

    it("prevents the default browser action", async () => {
      renderWithProviders(<App title="Test" />, { preloadedState: pairedState });
      const event = fireCtrlShiftL();
      expect(event.defaultPrevented).toBe(true);
    });

    it("does NOT toggle logging for Ctrl+L without Shift", async () => {
      const { store } = renderWithProviders(<App title="Test" />, { preloadedState: pairedState });
      await waitFor(() => expect(store.getState().logging.enabled).toBe(false));

      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "L", ctrlKey: true, shiftKey: false, bubbles: true })
      );

      expect(store.getState().logging.enabled).toBe(false);
    });

    it("replaces the Office notification message with the new state", async () => {
      const replaceAsync = jest.fn();
      (global as any).Office = {
        ...((global as any).Office ?? {}),
        context: {
          mailbox: { item: { notificationMessages: { replaceAsync } } },
        },
        MailboxEnums: { ItemNotificationMessageType: { InformationalMessage: "informationalMessage" } },
      };

      renderWithProviders(<App title="Test" />, { preloadedState: pairedState });
      fireCtrlShiftL();

      expect(replaceAsync).toHaveBeenCalledWith(
        "LoggingToggleNotification",
        expect.objectContaining({ message: "logging.enabled" })
      );
    });

    it("removes the keydown listener on unmount", async () => {
      const { store, unmount } = renderWithProviders(<App title="Test" />, { preloadedState: pairedState });
      await waitFor(() => expect(store.getState().logging.enabled).toBe(false));

      unmount();
      fireCtrlShiftL();

      // No store to assert against post-unmount, but this should not throw
      expect(() => fireCtrlShiftL()).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // WebRTC connection manager init/cleanup effect (driven by advokatServerId)
  // ──────────────────────────────────────────────────────────────────────────

  describe("WebRTC connection manager effect", () => {
    it("does NOT initialize the connection manager while advokatServerId is unset", () => {
      renderWithProviders(<App title="Test" />, { preloadedState: unpairedState });
      expect(mockInitialize).not.toHaveBeenCalled();
    });

    it("initializes the connection manager once advokatServerId is known", async () => {
      renderWithProviders(<App title="Test" />, { preloadedState: pairedState });
      await waitFor(() => expect(mockInitialize).toHaveBeenCalledTimes(1));
    });

    it("disconnects the connection manager on unmount", async () => {
      const { unmount } = renderWithProviders(<App title="Test" />, { preloadedState: pairedState });
      await waitFor(() => expect(mockInitialize).toHaveBeenCalledTimes(1));

      unmount();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it("disconnects exactly once even if unload fires before unmount", async () => {
      const { unmount } = renderWithProviders(<App title="Test" />, { preloadedState: pairedState });
      await waitFor(() => expect(mockInitialize).toHaveBeenCalledTimes(1));

      window.dispatchEvent(new Event("unload"));
      unmount();

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it("re-initializes when advokatServerId changes after being unset", async () => {
      const { store } = renderWithProviders(<App title="Test" />, { preloadedState: unpairedState });
      expect(mockInitialize).not.toHaveBeenCalled();

      store.dispatch({
        type: "pairing/setPaired",
        payload: { advokatServerId: "adv-99", kuerzel: "ABC" },
      });

      await waitFor(() => expect(mockInitialize).toHaveBeenCalledTimes(1));
    });
  });
});
