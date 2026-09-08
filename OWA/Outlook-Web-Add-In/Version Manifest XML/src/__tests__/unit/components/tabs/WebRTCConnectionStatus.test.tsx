/* eslint-disable no-undef */
/**
 * Component Tests for tabs/shared/WebRTCConnectionStatus.tsx
 *
 * Pure Redux-driven presentational component — no devextreme dependencies.
 *
 * Covers:
 *  - getFriendlyMessage(): disconnected, auth-failed (generic + specific Office
 *    SSO error key), connected, failed-permanently, failing/reconnecting,
 *    connecting (default) branches
 *  - getStatusStyle(): background color per state
 *  - needsManualReconnect(): shown for permanent failure OR (authError && !isReady)
 *  - handleReconnect(): clears stale failure state, disconnects+reinitializes,
 *    disables the button while in flight, guards double-invocation
 *  - kuerzel/email subtitle only shown when ready + both present
 */

// ─── react-i18next mock ───────────────────────────────────────────────────────
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: any) => {
      if (typeof fallbackOrOpts === "string") return fallbackOrOpts;
      if (fallbackOrOpts && typeof fallbackOrOpts === "object") {
        return `${key}:${JSON.stringify(fallbackOrOpts)}`;
      }
      return key;
    },
    i18n: { changeLanguage: jest.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: jest.fn() },
}));

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
}));

// ─── WebRTCConnectionManager mock ──────────────────────────────────────────────
const mockDisconnect = jest.fn();
const mockInitialize = jest.fn();
const mockGetConfig = jest.fn(() => ({ maxReconnectAttempts: 3 }));
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    disconnect: (...args: any[]) => mockDisconnect(...args),
    initialize: (...args: any[]) => mockInitialize(...args),
    getConfig: (...args: any[]) => mockGetConfig(...args),
  })),
}));

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import * as React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import WebRTCConnectionStatus from "@components/tabs/shared/WebRTCConnectionStatus";
import { renderWithProviders } from "../testUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const disconnectedConnectionState = {
  sipClientState: "DISCONNECTED",
  connectionStatus: "Disconnected",
  reconnectAttempts: 0,
  isIdle: false,
};

function baseState(overrides: Record<string, any> = {}) {
  return {
    connection: disconnectedConnectionState,
    auth: { isAuthenticated: false, error: null, officeAuthErrorKey: null, email: null },
    pairing: { kuerzel: null },
    ...overrides,
  };
}

describe("WebRTCConnectionStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDisconnect.mockResolvedValue(undefined);
    mockInitialize.mockResolvedValue(undefined);
    mockGetConfig.mockReturnValue({ maxReconnectAttempts: 3 });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getFriendlyMessage() branches
  // ──────────────────────────────────────────────────────────────────────────

  describe("getFriendlyMessage()", () => {
    it("shows 'disconnected' when idle-disconnected", () => {
      renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          connection: { ...disconnectedConnectionState, idleDisconnectedAt: "2024-01-01T00:00:00Z" },
        }),
      });
      expect(screen.getByText("webrtc.disconnected")).toBeInTheDocument();
    });

    it("shows 'disconnected' when not connecting/connected/ready/failing", () => {
      renderWithProviders(<WebRTCConnectionStatus />, { preloadedState: baseState() });
      expect(screen.getByText("webrtc.disconnected")).toBeInTheDocument();
    });

    it("shows the generic auth-failed message when authError is set with no Office error key", () => {
      renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          connection: { ...disconnectedConnectionState, sipClientState: "CONNECTING", connectionStatus: "Connecting..." },
          auth: { isAuthenticated: false, error: "Bad credentials", officeAuthErrorKey: null, email: null },
        }),
      });
      expect(screen.getByText("webrtc.authenticationFailed")).toBeInTheDocument();
    });

    it("shows the specific Office SSO error message when officeAuthErrorKey is set", () => {
      renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          connection: { ...disconnectedConnectionState, sipClientState: "CONNECTING", connectionStatus: "Connecting..." },
          auth: {
            isAuthenticated: false,
            error: "Bad credentials",
            officeAuthErrorKey: "officeAuth.errors.13001",
            email: null,
          },
        }),
      });
      expect(screen.getByText("officeAuth.errors.13001")).toBeInTheDocument();
    });

    it("shows 'connected' when ready", () => {
      renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          connection: { ...disconnectedConnectionState, sipClientState: "CONNECTED" },
          auth: { isAuthenticated: true, error: null, officeAuthErrorKey: null, email: null },
        }),
      });
      expect(screen.getByText("webrtc.connected")).toBeInTheDocument();
    });

    it("shows 'connection failed permanently' when reconnection attempts are exhausted", () => {
      renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          connection: {
            ...disconnectedConnectionState,
            connectionStatus: "Max reconnection attempts (3) reached",
            lastError: "Max retries",
          },
        }),
      });
      expect(screen.getByText("webrtc.connectionFailedPermanently")).toBeInTheDocument();
    });

    it("shows a reconnecting-with-attempt message while actively failing/retrying", () => {
      renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          connection: {
            ...disconnectedConnectionState,
            connectionStatus: "Connection failed",
            reconnectAttempts: 2,
            lastError: "timeout",
          },
        }),
      });
      expect(
        screen.getByText('webrtc.connectionFailedReconnecting:{"attempt":2,"max":3}')
      ).toBeInTheDocument();
    });

    it("shows the default 'connecting' message otherwise", () => {
      renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          connection: { ...disconnectedConnectionState, sipClientState: "REGISTERING", connectionStatus: "Connecting." },
        }),
      });
      expect(screen.getByText("webrtc.connecting")).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getStatusStyle() colors
  // ──────────────────────────────────────────────────────────────────────────

  describe("getStatusStyle()", () => {
    it("uses grey for disconnected", () => {
      const { container } = renderWithProviders(<WebRTCConnectionStatus />, { preloadedState: baseState() });
      expect(container.firstChild).toHaveStyle({ backgroundColor: "#6c757d" });
    });

    it("uses red for auth failure", () => {
      const { container } = renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          connection: { ...disconnectedConnectionState, sipClientState: "CONNECTING", connectionStatus: "Connecting..." },
          auth: { isAuthenticated: false, error: "Bad credentials", officeAuthErrorKey: null, email: null },
        }),
      });
      expect(container.firstChild).toHaveStyle({ backgroundColor: "#dc3545" });
    });

    it("uses green when ready", () => {
      const { container } = renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          connection: { ...disconnectedConnectionState, sipClientState: "CONNECTED" },
          auth: { isAuthenticated: true, error: null, officeAuthErrorKey: null, email: null },
        }),
      });
      expect(container.firstChild).toHaveStyle({ backgroundColor: "#28a745" });
    });

    it("uses orange while failing/reconnecting", () => {
      const { container } = renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          connection: { ...disconnectedConnectionState, connectionStatus: "Connection failed", lastError: "x" },
        }),
      });
      expect(container.firstChild).toHaveStyle({ backgroundColor: "#fd7e14" });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // needsManualReconnect() → reconnect button visibility
  // ──────────────────────────────────────────────────────────────────────────

  describe("reconnect button visibility", () => {
    it("is hidden in the normal disconnected/connecting state", () => {
      renderWithProviders(<WebRTCConnectionStatus />, { preloadedState: baseState() });
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("is shown when connection failed permanently", () => {
      renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          connection: { ...disconnectedConnectionState, connectionStatus: "Reconnection failed after 3 attempts" },
        }),
      });
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("is shown when there is an auth error and the connection is not ready", () => {
      renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          auth: { isAuthenticated: false, error: "Bad credentials", officeAuthErrorKey: null, email: null },
        }),
      });
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("is hidden while merely retrying (not yet permanently failed)", () => {
      renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          connection: { ...disconnectedConnectionState, connectionStatus: "Connection failed", lastError: "x" },
        }),
      });
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleReconnect()
  // ──────────────────────────────────────────────────────────────────────────

  describe("handleReconnect()", () => {
    const failedState = baseState({
      connection: { ...disconnectedConnectionState, connectionStatus: "Max reconnection attempts (3) reached", reconnectAttempts: 3, lastError: "x" },
    });

    it("clears stale failure state and reinitializes the connection", async () => {
      const { store } = renderWithProviders(<WebRTCConnectionStatus />, { preloadedState: failedState });

      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => expect(mockDisconnect).toHaveBeenCalledTimes(1));
      expect(mockInitialize).toHaveBeenCalledTimes(1);
      expect(store.getState().connection.reconnectAttempts).toBe(0);
      expect(store.getState().connection.lastError).toBeUndefined();
    });

    it("disables the button and shows 'reconnecting' text while in flight", async () => {
      let resolveDisconnect!: () => void;
      mockDisconnect.mockReturnValue(new Promise<void>((res) => { resolveDisconnect = res; }));

      renderWithProviders(<WebRTCConnectionStatus />, { preloadedState: failedState });

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByRole("button")).toBeDisabled();
      expect(screen.getByText("Reconnecting…")).toBeInTheDocument();

      resolveDisconnect();
      await waitFor(() => expect(mockInitialize).toHaveBeenCalled());
    });

    it("ignores a second click while a reconnect is already in flight", async () => {
      let resolveDisconnect!: () => void;
      mockDisconnect.mockReturnValue(new Promise<void>((res) => { resolveDisconnect = res; }));

      renderWithProviders(<WebRTCConnectionStatus />, { preloadedState: failedState });

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByRole("button")); // disabled — should be a no-op

      resolveDisconnect();
      await waitFor(() => expect(mockInitialize).toHaveBeenCalledTimes(1));
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it("re-enables the button after a failed reconnect attempt", async () => {
      mockDisconnect.mockRejectedValue(new Error("disconnect failed"));

      renderWithProviders(<WebRTCConnectionStatus />, { preloadedState: failedState });

      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // kuerzel/email subtitle
  // ──────────────────────────────────────────────────────────────────────────

  describe("kuerzel/email subtitle", () => {
    it("shows kuerzel and email when ready and both are present", () => {
      renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          connection: { ...disconnectedConnectionState, sipClientState: "CONNECTED" },
          auth: { isAuthenticated: true, error: null, officeAuthErrorKey: null, email: "user@example.com" },
          pairing: { kuerzel: "JCH" },
        }),
      });
      expect(screen.getByText("JCH — user@example.com")).toBeInTheDocument();
    });

    it("does not show the subtitle when not ready", () => {
      renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          auth: { isAuthenticated: true, error: null, officeAuthErrorKey: null, email: "user@example.com" },
          pairing: { kuerzel: "JCH" },
        }),
      });
      expect(screen.queryByText(/user@example.com/)).not.toBeInTheDocument();
    });

    it("does not show the subtitle when kuerzel is missing", () => {
      renderWithProviders(<WebRTCConnectionStatus />, {
        preloadedState: baseState({
          connection: { ...disconnectedConnectionState, sipClientState: "CONNECTED" },
          auth: { isAuthenticated: true, error: null, officeAuthErrorKey: null, email: "user@example.com" },
          pairing: { kuerzel: null },
        }),
      });
      expect(screen.queryByText(/user@example.com/)).not.toBeInTheDocument();
    });
  });
});
