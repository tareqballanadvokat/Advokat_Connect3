/* eslint-disable no-undef */
/**
 * Component Tests for tabs/shared/ServiceSection.tsx
 *
 * SelectBox is mocked with a minimal stand-in; the SB/time/text fields are
 * plain HTML inputs in the real component, so they're exercised directly.
 *
 * Covers:
 *  - Conditional states: no-Akt placeholder, loading, error, and the form itself
 *  - Loads services when an Akt is selected, clears them when deselected
 *  - Time-input parsing/formatting (handleTimeChange auto-colon, handleTimeBlur
 *    digit-length branches: 1/2/3/4+ digits, capping to valid hour/minute ranges)
 *  - SB input is read-only, always defaulted from the logged-in user's kürzel
 *  - Service dropdown display-text building (stufe1>stufe2>stufe3, fallback to id)
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

// ─── WebRTCConnectionManager mock ──────────────────────────────────────────────
const mockLoadServices = jest.fn();
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => ({
      loadServices: (...args: any[]) => mockLoadServices(...args),
    })),
  })),
}));

// ─── SelectBox mock ─────────────────────────────────────────────────────────────
// Includes a search input that fires onOptionChanged({ name: "searchValue" }),
// mirroring DevExtreme's built-in search box behavior.
jest.mock("devextreme-react/select-box", () => {
  const R = require("react");
  return {
    __esModule: true,
    default: ({ dataSource, value, onValueChanged, onOptionChanged, disabled, placeholder }: any) =>
      R.createElement(
        R.Fragment,
        null,
        R.createElement("input", {
          "data-testid": "service-search-input",
          onChange: (e: any) => onOptionChanged?.({ name: "searchValue", value: e.target.value }),
        }),
        R.createElement(
          "div",
          { "data-testid": "service-select", "data-disabled": String(!!disabled), "data-placeholder": placeholder },
          (dataSource || []).map((opt: any) =>
            R.createElement(
              "button",
              { key: opt.id, "data-testid": `service-option-${opt.id}`, onClick: () => onValueChanged?.({ value: opt.id }) },
              opt.displayText
            )
          )
        )
      ),
  };
});

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import * as React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import ServiceSection from "@components/tabs/shared/ServiceSection";
import { renderWithProviders } from "../testUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const readyConnectionState = { sipClientState: "CONNECTED", connectionStatus: "Connected", reconnectAttempts: 0, isIdle: false };

function baseState(overrides: Record<string, any> = {}) {
  return {
    auth: { isAuthenticated: true, credentials: { username: "TST" } },
    connection: readyConnectionState,
    akten: { selectedAkt: { id: 1, aKurz: "TEST-1", causa: "Causa" } },
    service: {
      selectedServiceId: 0,
      time: "",
      text: "",
      sb: "",
      services: [],
      servicesLoading: false,
      servicesError: null,
      allServices: [],
      allServicesLoading: false,
      allServicesError: null,
      saveLeistungLoading: false,
      saveLeistungError: null,
      savedLeistungen: [],
      savedLeistungenLoading: false,
      savedLeistungenError: null,
      loadCounter: 0,
      previousLoadKey: null,
      registeredServicesLoading: false,
    },
    ...overrides,
  };
}

describe("ServiceSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadServices.mockResolvedValue({ statusCode: 200, body: "[]" });
  });

  /**
   * loadServicesAsync's `pending` action sets servicesLoading=true synchronously
   * on mount (before the mocked API call resolves), so every test that interacts
   * with the form must wait for that pending→fulfilled transition first.
   */
  async function renderReady(state = baseState()) {
    const utils = renderWithProviders(<ServiceSection />, { preloadedState: state });
    if (state.akten.selectedAkt) {
      await waitFor(() => expect(screen.queryByText("loadingServices")).not.toBeInTheDocument());
    }
    return utils;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Conditional states
  // ──────────────────────────────────────────────────────────────────────────

  describe("conditional states", () => {
    it("shows the placeholder when no Akt is selected", () => {
      renderWithProviders(<ServiceSection />, {
        preloadedState: baseState({ akten: { selectedAkt: null } }),
      });
      expect(screen.getByText("selectAktFirst")).toBeInTheDocument();
    });

    it("shows a 'type to search' hint under the heading", () => {
      renderWithProviders(<ServiceSection />, {
        preloadedState: baseState({ akten: { selectedAkt: null } }),
      });
      expect(screen.getByText("typeToSearchHint")).toBeInTheDocument();
    });

    it("shows the loading message while services are loading", () => {
      renderWithProviders(<ServiceSection />, {
        preloadedState: baseState({ service: { ...baseState().service, servicesLoading: true } }),
      });
      expect(screen.getByText("loadingServices")).toBeInTheDocument();
    });

    it("shows an error message when the service fetch fails", async () => {
      // Preloaded servicesError would be immediately overwritten by the mount
      // effect's own fetch — drive the error through the real thunk instead.
      mockLoadServices.mockRejectedValue(new Error("Boom"));
      renderWithProviders(<ServiceSection />, { preloadedState: baseState() });
      await waitFor(() => expect(screen.getByText(/Boom/)).toBeInTheDocument());
    });

    it("renders the form when an Akt is selected and services are loaded", async () => {
      await renderReady();
      expect(screen.getByTestId("service-select")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("sbPlaceholder")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("timePlaceholder")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("textPlaceholder")).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Load services on Akt selection
  // ──────────────────────────────────────────────────────────────────────────

  describe("loading services", () => {
    it("dispatches loadServicesAsync when an Akt is selected", async () => {
      renderWithProviders(<ServiceSection />, { preloadedState: baseState() });
      await waitFor(() => expect(mockLoadServices).toHaveBeenCalled());
    });

    it("clears services when no Akt is selected", () => {
      const { store } = renderWithProviders(<ServiceSection />, {
        preloadedState: baseState({
          akten: { selectedAkt: null },
          service: { ...baseState().service, services: [{ id: 1, kürzel: "S1" } as any] },
        }),
      });
      expect(store.getState().service.services).toEqual([]);
    });

    it("loads both the quick list and the full catalog in the background", async () => {
      renderWithProviders(<ServiceSection />, { preloadedState: baseState() });
      await waitFor(() => expect(mockLoadServices).toHaveBeenCalledTimes(2));
      expect(mockLoadServices).toHaveBeenCalledWith(
        expect.objectContaining({ OnlyQuickListe: true })
      );
      expect(mockLoadServices).toHaveBeenCalledWith(
        expect.objectContaining({ OnlyQuickListe: false })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Search: switches from the quick list to the full catalog
  // ──────────────────────────────────────────────────────────────────────────

  describe("service search", () => {
    beforeEach(() => {
      mockLoadServices.mockImplementation((query: any) =>
        Promise.resolve({
          statusCode: 200,
          body: query.OnlyQuickListe
            ? JSON.stringify([{ id: 1, kürzel: "Q1", stufe1: "QuickOnly" }])
            : JSON.stringify([{ id: 2, kürzel: "A2", stufe1: "FullOnly" }]),
        })
      );
    });

    it("shows the quick list by default", async () => {
      await renderReady();
      expect(screen.getByText("QuickOnly")).toBeInTheDocument();
      expect(screen.queryByText("FullOnly")).not.toBeInTheDocument();
    });

    it("switches to the full catalog once the user types a search term", async () => {
      await renderReady();
      await waitFor(() => expect(mockLoadServices).toHaveBeenCalledTimes(2));

      fireEvent.change(screen.getByTestId("service-search-input"), { target: { value: "Full" } });

      await waitFor(() => expect(screen.getByText("FullOnly")).toBeInTheDocument());
      expect(screen.queryByText("QuickOnly")).not.toBeInTheDocument();
    });

    it("reverts to the quick list once the search box is cleared", async () => {
      await renderReady();
      await waitFor(() => expect(mockLoadServices).toHaveBeenCalledTimes(2));

      const searchInput = screen.getByTestId("service-search-input");
      fireEvent.change(searchInput, { target: { value: "Full" } });
      await waitFor(() => expect(screen.getByText("FullOnly")).toBeInTheDocument());

      fireEvent.change(searchInput, { target: { value: "" } });
      expect(screen.getByText("QuickOnly")).toBeInTheDocument();
      expect(screen.queryByText("FullOnly")).not.toBeInTheDocument();
    });

    it("falls back to the full catalog when the quick list is empty for this Akt", async () => {
      mockLoadServices.mockImplementation((query: any) =>
        Promise.resolve({
          statusCode: 200,
          body: query.OnlyQuickListe
            ? "[]"
            : JSON.stringify([{ id: 2, kürzel: "A2", stufe1: "FullOnly" }]),
        })
      );

      await renderReady();
      await waitFor(() => expect(screen.getByText("FullOnly")).toBeInTheDocument());
    });

    it("caps the rendered rows when the full catalog has more matches than the limit", async () => {
      const bigCatalog = Array.from({ length: 80 }, (_, i) => ({ id: i, kürzel: `S${i}`, stufe1: `Service ${i}` }));
      mockLoadServices.mockImplementation((query: any) =>
        Promise.resolve({
          statusCode: 200,
          body: query.OnlyQuickListe ? "[]" : JSON.stringify(bigCatalog),
        })
      );

      await renderReady();
      await waitFor(() => expect(screen.getByText("Service 0")).toBeInTheDocument());

      expect(screen.queryAllByTestId(/^service-option-/)).toHaveLength(50);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Service dropdown display text
  // ──────────────────────────────────────────────────────────────────────────

  describe("service dropdown", () => {
    // These populate the list via the real loadServicesAsync fulfilled action
    // (fired from the mount effect) rather than preloaded state, since the
    // effect's fetch would otherwise overwrite any preloaded `services` array.

    it("builds display text from stufe1 > stufe2 > stufe3", async () => {
      mockLoadServices.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify([{ id: 1, kürzel: "S1", stufe1: "A", stufe2: "B", stufe3: "C" }]),
      });
      await renderReady();
      expect(screen.getByText("A > B > C")).toBeInTheDocument();
    });

    it("falls back to 'Service {id}' when no stufe fields are present", async () => {
      mockLoadServices.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify([{ id: 42, kürzel: "S1" }]),
      });
      await renderReady();
      expect(screen.getByText("Service 42")).toBeInTheDocument();
    });

    it("dispatches setSelectedServiceId when an option is chosen", async () => {
      mockLoadServices.mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify([{ id: 7, kürzel: "S1" }]),
      });
      const { store } = await renderReady();

      fireEvent.click(screen.getByTestId("service-option-7"));

      expect(store.getState().service.selectedServiceId).toBe(7);
    });

    it("is disabled with a 'no services available' placeholder when the list is empty", async () => {
      await renderReady();
      const select = screen.getByTestId("service-select");
      expect(select).toHaveAttribute("data-disabled", "true");
      expect(select).toHaveAttribute("data-placeholder", "noServicesAvailable");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Time input
  // ──────────────────────────────────────────────────────────────────────────

  describe("time input", () => {
    it("dispatches the raw value while typing (matches the HH:MM pattern)", async () => {
      const { store } = await renderReady();
      fireEvent.change(screen.getByPlaceholderText("timePlaceholder"), { target: { value: "1" } });
      expect(store.getState().service.time).toBe("1");
    });

    it("auto-inserts a colon after exactly 2 digits with no colon yet", async () => {
      const { store } = await renderReady();
      fireEvent.change(screen.getByPlaceholderText("timePlaceholder"), { target: { value: "13" } });
      expect(store.getState().service.time).toBe("13:");
    });

    it("ignores non-numeric input", async () => {
      const { store } = await renderReady(
        baseState({ service: { ...baseState().service, time: "12:" } })
      );
      fireEvent.change(screen.getByPlaceholderText("timePlaceholder"), { target: { value: "12:ab" } });
      expect(store.getState().service.time).toBe("12:"); // unchanged
    });

    it("on blur: a single digit is treated as hours (e.g. '1' -> '01:00')", async () => {
      const { store } = await renderReady(baseState({ service: { ...baseState().service, time: "1" } }));
      fireEvent.blur(screen.getByPlaceholderText("timePlaceholder"));
      expect(store.getState().service.time).toBe("01:00");
    });

    it("on blur: two digits are treated as hours (e.g. '02' -> '02:00')", async () => {
      const { store } = await renderReady(baseState({ service: { ...baseState().service, time: "02" } }));
      fireEvent.blur(screen.getByPlaceholderText("timePlaceholder"));
      expect(store.getState().service.time).toBe("02:00");
    });

    it("on blur: three digits split as H:MM (e.g. '130' -> '01:30')", async () => {
      const { store } = await renderReady(baseState({ service: { ...baseState().service, time: "130" } }));
      fireEvent.blur(screen.getByPlaceholderText("timePlaceholder"));
      expect(store.getState().service.time).toBe("01:30");
    });

    it("on blur: four digits split as HH:MM (e.g. '0130' -> '01:30')", async () => {
      const { store } = await renderReady(baseState({ service: { ...baseState().service, time: "0130" } }));
      fireEvent.blur(screen.getByPlaceholderText("timePlaceholder"));
      expect(store.getState().service.time).toBe("01:30");
    });

    it("on blur: caps hours at 23 and minutes at 59", async () => {
      const { store } = await renderReady(baseState({ service: { ...baseState().service, time: "9999" } }));
      fireEvent.blur(screen.getByPlaceholderText("timePlaceholder"));
      expect(store.getState().service.time).toBe("23:59");
    });

    it("on blur: clears the value when only non-digit characters remain", async () => {
      const { store } = await renderReady(baseState({ service: { ...baseState().service, time: ":" } }));
      fireEvent.blur(screen.getByPlaceholderText("timePlaceholder"));
      expect(store.getState().service.time).toBe("");
    });

    it("on blur: does nothing when the field is empty", async () => {
      const { store } = await renderReady(baseState({ service: { ...baseState().service, time: "" } }));
      fireEvent.blur(screen.getByPlaceholderText("timePlaceholder"));
      expect(store.getState().service.time).toBe("");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SB input
  // ──────────────────────────────────────────────────────────────────────────

  describe("SB input", () => {
    it("is read-only, since it is always the current user", async () => {
      await renderReady();
      expect(screen.getByPlaceholderText("sbPlaceholder")).toHaveAttribute("readonly");
    });

    it("ignores attempts to change its value", async () => {
      const { store } = await renderReady();
      fireEvent.change(screen.getByPlaceholderText("sbPlaceholder"), { target: { value: "jdo" } });
      expect(store.getState().service.sb).toBe("TST"); // unchanged - defaulted from login
    });

    it("defaults to the logged-in user's kürzel when the field is empty", async () => {
      const { store } = await renderReady();
      expect(store.getState().service.sb).toBe("TST");
    });

    it("does NOT override an existing SB value with the logged-in kürzel", async () => {
      const { store } = await renderReady(
        baseState({ service: { ...baseState().service, sb: "ABC" } })
      );
      expect(store.getState().service.sb).toBe("ABC");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Text input
  // ──────────────────────────────────────────────────────────────────────────

  describe("text input", () => {
    it("dispatches setText on change", async () => {
      const { store } = await renderReady();
      fireEvent.change(screen.getByPlaceholderText("textPlaceholder"), { target: { value: "Consultation" } });
      expect(store.getState().service.text).toBe("Consultation");
    });
  });
});
