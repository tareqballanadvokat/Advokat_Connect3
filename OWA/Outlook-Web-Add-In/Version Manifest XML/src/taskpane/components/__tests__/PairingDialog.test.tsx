/* eslint-disable no-undef */
/**
 * Component Tests for PairingDialog.tsx
 *
 * Covers:
 *  - Returns null when pairingStatus !== 'unpaired'
 *  - Renders heading and OTP input when pairingStatus === 'unpaired'
 *  - Submit button is disabled when OTP is empty
 *  - Submit button becomes enabled after typing OTP
 *  - On successful submit, calls pairingApiService.pair() with OTP and token
 *  - Shows an error message when pairingApiService.pair() rejects
 *  - Shows generic error when rejection is not an Error instance
 *  - Shows error when officeToken is null (no SSO token available)
 */

// ─── react-i18next mock ───────────────────────────────────────────────────────
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
    i18n: { changeLanguage: jest.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: jest.fn() },
}));

// ─── PairingApiService mock ───────────────────────────────────────────────────
const mockPair = jest.fn();
jest.mock("@services/PairingApiService", () => ({
  pairingApiService: { pair: mockPair },
}));

import * as React from "react";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderWithProviders } from "./testUtils";
import PairingDialog from "../tabs/shared/PairingDialog";

/** Convenience: render with pairingStatus = 'unpaired' and an Office token */
function renderUnpaired(overrides: Record<string, unknown> = {}) {
  return renderWithProviders(<PairingDialog />, {
    preloadedState: {
      pairing: { status: "unpaired", advokatServerId: null, kuerzel: null, error: null },
      auth:    { officeToken: "mock-office-token", ...overrides.auth },
      ...overrides,
    },
  });
}

describe("PairingDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Visibility
  // ────────────────────────────────────────────────────────────────────────────
  describe("Visibility", () => {
    it("renders nothing when pairingStatus is 'paired'", () => {
      const { container } = renderWithProviders(<PairingDialog />, {
        preloadedState: { pairing: { status: "paired" } },
      });
      expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when pairingStatus is 'unknown'", () => {
      const { container } = renderWithProviders(<PairingDialog />, {
        preloadedState: { pairing: { status: "unknown" } },
      });
      expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when pairingStatus is 'checking'", () => {
      const { container } = renderWithProviders(<PairingDialog />, {
        preloadedState: { pairing: { status: "checking" } },
      });
      expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing when pairingStatus is 'error'", () => {
      const { container } = renderWithProviders(<PairingDialog />, {
        preloadedState: { pairing: { status: "error" } },
      });
      expect(container).toBeEmptyDOMElement();
    });

    it("renders the pairing form when pairingStatus is 'unpaired'", () => {
      renderUnpaired();
      expect(
        screen.getByText(/ADVOKAT Server Pairing Required/i)
      ).toBeInTheDocument();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // OTP input and submit button
  // ────────────────────────────────────────────────────────────────────────────
  describe("OTP input", () => {
    it("renders the OTP input with the correct aria-label", () => {
      renderUnpaired();
      expect(
        screen.getByRole("textbox", { name: /One-time pairing code/i })
      ).toBeInTheDocument();
    });

    it("submit button is disabled when OTP is empty", () => {
      renderUnpaired();
      expect(screen.getByRole("button", { name: /Pair with ADVOKAT/i })).toBeDisabled();
    });

    it("submit button is enabled after typing an OTP", () => {
      renderUnpaired();
      const input = screen.getByRole("textbox", { name: /One-time pairing code/i });
      fireEvent.change(input, { target: { value: "ABC123" } });
      expect(screen.getByRole("button", { name: /Pair with ADVOKAT/i })).not.toBeDisabled();
    });

    it("converts typed OTP to uppercase", () => {
      renderUnpaired();
      const input = screen.getByRole("textbox", { name: /One-time pairing code/i }) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "abc123" } });
      expect(input.value).toBe("ABC123");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Submission
  // ────────────────────────────────────────────────────────────────────────────
  describe("Form submission", () => {
    it("calls pairingApiService.pair() with the OTP and office token", async () => {
      mockPair.mockResolvedValue(undefined);
      renderUnpaired();

      const input = screen.getByRole("textbox", { name: /One-time pairing code/i });
      fireEvent.change(input, { target: { value: "ABCD1234" } });
      fireEvent.click(screen.getByRole("button", { name: /Pair with ADVOKAT/i }));

      await waitFor(() =>
        expect(mockPair).toHaveBeenCalledWith("ABCD1234", "mock-office-token")
      );
    });

    it("shows an error message when pairingApiService.pair() rejects with an Error", async () => {
      mockPair.mockRejectedValue(new Error("Invalid OTP"));
      renderUnpaired();

      const input = screen.getByRole("textbox", { name: /One-time pairing code/i });
      fireEvent.change(input, { target: { value: "WRONG1" } });
      fireEvent.click(screen.getByRole("button", { name: /Pair with ADVOKAT/i }));

      await waitFor(() =>
        expect(screen.getByText(/Invalid OTP/i)).toBeInTheDocument()
      );
    });

    it("shows a generic error when rejection is not an Error instance", async () => {
      mockPair.mockRejectedValue("unknown failure");
      renderUnpaired();

      const input = screen.getByRole("textbox", { name: /One-time pairing code/i });
      fireEvent.change(input, { target: { value: "WRONG2" } });
      fireEvent.click(screen.getByRole("button", { name: /Pair with ADVOKAT/i }));

      await waitFor(() =>
        expect(screen.getByText(/Pairing failed/i)).toBeInTheDocument()
      );
    });

    it("shows an SSO error when officeToken is null", async () => {
      renderWithProviders(<PairingDialog />, {
        preloadedState: {
          pairing: { status: "unpaired", advokatServerId: null, kuerzel: null, error: null },
          auth:    { officeToken: null },
        },
      });

      const input = screen.getByRole("textbox", { name: /One-time pairing code/i });
      fireEvent.change(input, { target: { value: "ABCD1" } });
      fireEvent.click(screen.getByRole("button", { name: /Pair with ADVOKAT/i }));

      await waitFor(() =>
        expect(screen.getByText(/Office SSO token is not available/i)).toBeInTheDocument()
      );
      expect(mockPair).not.toHaveBeenCalled();
    });
  });
});
