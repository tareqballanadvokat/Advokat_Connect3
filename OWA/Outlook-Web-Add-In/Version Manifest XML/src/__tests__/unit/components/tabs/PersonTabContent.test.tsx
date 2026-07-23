/* eslint-disable no-undef */
/**
 * Component Tests for PersonTabContent.tsx
 *
 * SearchPersonList and WebRTCConnectionStatus are mocked to stubs. devextreme-react/accordion
 * is mocked with a minimal but functional Accordion that renders itemTitleRender/itemRender for
 * each entry in dataSource, so CustomTitle's real delete button can be exercised. CustomTitle and
 * CustomItem are used unmocked (they're plain presentational components). The cache layer is
 * mocked to always miss so every fetch goes through the (mocked) WebRTC API.
 *
 * Covers:
 *  - Always renders WebRTCConnectionStatus and SearchPersonList
 *  - Fetches favorite persons on mount once the connection is ready
 *  - Does NOT fetch favorites when the connection is not ready
 *  - Shows the empty-state message when there are no favorites
 *  - Renders one accordion entry per favorite person
 *  - Adding a person from search dispatches addPersonToFavoritesAsync
 *  - Clicking a person's delete button removes them from favorites
 *  - Removal failure shows an error notification
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
const mockGetFavoritePersons = jest.fn();
const mockAddPersonToFavorites = jest.fn();
const mockRemovePersonFromFavorites = jest.fn();
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => ({
      getFavoritePersons: (...args: any[]) => mockGetFavoritePersons(...args),
      addPersonToFavorites: (...args: any[]) => mockAddPersonToFavorites(...args),
      removePersonFromFavorites: (...args: any[]) => mockRemovePersonFromFavorites(...args),
    })),
  })),
}));

// ─── devextreme-react/accordion mock ───────────────────────────────────────────
// A minimal functional Accordion: renders itemTitleRender + itemRender for each
// dataSource entry so PersonTabContent's real handlers can be exercised.
jest.mock("devextreme-react/accordion", () => {
  const R = require("react");

  function Accordion(props: any) {
    const items = props.dataSource || [];
    return R.createElement(
      "div",
      { "data-testid": "devextreme-accordion" },
      items.map((item: any) =>
        R.createElement(
          "div",
          { key: item.id, "data-testid": `person-${item.id}` },
          props.itemTitleRender(item),
          props.itemRender(item)
        )
      )
    );
  }
  Accordion.__esModule = true;
  Accordion.default = Accordion;
  return Accordion;
});

// ─── Child component stubs ─────────────────────────────────────────────────────
jest.mock("@components/tabs/shared/WebRTCConnectionStatus", () => ({
  __esModule: true,
  default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "webrtc-status" }); },
}));

let lastSearchPersonListProps: any = null;
jest.mock("@src/taskpane/components/tabs/person/SearchPersonList", () => ({
  __esModule: true,
  default: (props: any) => {
    const R = require("react");
    lastSearchPersonListProps = props;
    return R.createElement("div", { "data-testid": "search-person-list" });
  },
}));

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import * as React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import PersonTabContent from "@components/tabs/person/PersonTabContent";
import { renderWithProviders } from "../testUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const readyConnectionState = { sipClientState: "CONNECTED", connectionStatus: "Connected", reconnectAttempts: 0, isIdle: false };
const notReadyConnectionState = { sipClientState: "DISCONNECTED", connectionStatus: "Disconnected", reconnectAttempts: 0, isIdle: false };

function baseState(overrides: Record<string, any> = {}) {
  return {
    auth: { isAuthenticated: true, credentials: { username: "tester" } },
    connection: readyConnectionState,
    person: {
      favorites: [],
      favoritesLoading: false,
      removeFromFavoriteLoading: false,
      removingFromFavoritePersonId: null,
    },
    ...overrides,
  };
}

const favoritePersons = [
  { id: 1, vorname: "Anna", name1: "Muster", nKurz: "AM" },
  { id: 2, vorname: "Bernd", name1: "Beispiel", nKurz: "BB" },
];

describe("PersonTabContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFavoritePersons.mockResolvedValue({ statusCode: 200, body: "[]" });
    mockAddPersonToFavorites.mockResolvedValue({ statusCode: 200 });
    mockRemovePersonFromFavorites.mockResolvedValue({ statusCode: 200 });
    lastSearchPersonListProps = null;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Rendering
  // ──────────────────────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("should always render WebRTCConnectionStatus and SearchPersonList", () => {
      renderWithProviders(<PersonTabContent />, { preloadedState: baseState() });
      expect(screen.getByTestId("webrtc-status")).toBeInTheDocument();
      expect(screen.getByTestId("search-person-list")).toBeInTheDocument();
    });

    it("should show the empty-state message when there are no favorites", async () => {
      renderWithProviders(<PersonTabContent />, { preloadedState: baseState() });
      await waitFor(() => expect(screen.getByText("noFavoritePersons")).toBeInTheDocument());
    });

    it("should render one accordion entry per favorite person", async () => {
      mockGetFavoritePersons.mockResolvedValue({ statusCode: 200, body: JSON.stringify(favoritePersons) });
      renderWithProviders(<PersonTabContent />, {
        preloadedState: baseState({ person: { ...baseState().person, favorites: favoritePersons } }),
      });
      await waitFor(() => expect(screen.getByTestId("person-1")).toBeInTheDocument());
      expect(screen.getByTestId("person-2")).toBeInTheDocument();
      expect(screen.getAllByText("Anna Muster").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Bernd Beispiel").length).toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Favorites fetch on mount
  // ──────────────────────────────────────────────────────────────────────────

  describe("favorites fetch on mount", () => {
    it("should fetch favorite persons when the connection is ready", async () => {
      renderWithProviders(<PersonTabContent />, { preloadedState: baseState() });
      await waitFor(() => expect(mockGetFavoritePersons).toHaveBeenCalledTimes(1));
    });

    it("should NOT fetch favorite persons when the connection is not ready", async () => {
      renderWithProviders(<PersonTabContent />, { preloadedState: baseState({ connection: notReadyConnectionState }) });
      await new Promise((r) => setTimeout(r, 0));
      expect(mockGetFavoritePersons).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Adding a person from search
  // ──────────────────────────────────────────────────────────────────────────

  describe("adding a person", () => {
    it("should dispatch addPersonToFavoritesAsync when SearchPersonList reports a selection", async () => {
      renderWithProviders(<PersonTabContent />, { preloadedState: baseState() });

      await waitFor(() => expect(lastSearchPersonListProps).not.toBeNull());
      await lastSearchPersonListProps.onPersonSelect(7, "New Person");

      await waitFor(() => expect(mockAddPersonToFavorites).toHaveBeenCalledWith(7));
      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      expect(mockNotify.mock.calls[0][1]).toBe("success");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Removing a favorite
  // ──────────────────────────────────────────────────────────────────────────

  describe("removing a favorite", () => {
    it("should remove the person from favorites on success", async () => {
      mockGetFavoritePersons.mockResolvedValue({ statusCode: 200, body: JSON.stringify(favoritePersons) });
      renderWithProviders(<PersonTabContent />, {
        preloadedState: baseState({ person: { ...baseState().person, favorites: favoritePersons } }),
      });

      await waitFor(() => expect(screen.getAllByTitle("hints.removeFromFavorites")).toHaveLength(2));
      fireEvent.click(screen.getAllByTitle("hints.removeFromFavorites")[0]);

      await waitFor(() => expect(mockRemovePersonFromFavorites).toHaveBeenCalledWith(1));
      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      expect(mockNotify.mock.calls[0][1]).toBe("success");
    });

    it("should show an error notification when removal fails", async () => {
      mockRemovePersonFromFavorites.mockResolvedValue({ statusCode: 500 });
      mockGetFavoritePersons.mockResolvedValue({ statusCode: 200, body: JSON.stringify(favoritePersons) });

      renderWithProviders(<PersonTabContent />, {
        preloadedState: baseState({ person: { ...baseState().person, favorites: favoritePersons } }),
      });

      await waitFor(() => expect(screen.getAllByTitle("hints.removeFromFavorites")).toHaveLength(2));
      fireEvent.click(screen.getAllByTitle("hints.removeFromFavorites")[0]);

      await waitFor(() => expect(mockNotify).toHaveBeenCalled());
      expect(mockNotify.mock.calls[0][1]).toBe("error");
    });
  });
});
