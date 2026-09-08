/* eslint-disable no-undef */
/**
 * Component Tests for Tab.tsx (DevTabs)
 *
 * Covers:
 *  - Renders DE / EN language-switcher buttons
 *  - Clicking EN / DE updates store language
 *  - Renders the DevExtreme Tabs wrapper
 *  - Cache tab is hidden when ENABLE_CACHE_STATS is false
 *  - Cache tab is shown when ENABLE_CACHE_STATS is true
 *  - ICE badge renders (shows '—' when no candidate type is selected)
 */

// ─── react-i18next mock ───────────────────────────────────────────────────────
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { changeLanguage: jest.fn() } }),
  initReactI18next: { type: "3rdParty", init: jest.fn() },
}));

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

// ─── Config mock — ENABLE_CACHE_STATS defaults to false ──────────────────────
jest.mock("@config", () => ({
  ENABLE_CACHE_STATS: false,
  isDevelopment: jest.fn(() => false),
  configService: {
    getConfig: jest.fn(() => ({
      logging: { enabled: false, level: "warn" },
      theme: { name: "generic", compact: false },
      sip: { host: "test.host", port: 5061 },
    })),
    getSipConfig: jest.fn(() => ({ host: "test.host", port: 5061 })),
    buildSipUri: jest.fn((name: string) => `sip:${name}@test.host:5061`),
    patchSipConfig: jest.fn(),
  },
}));
jest.mock("@config/runtimeConfig", () => ({
  setAdvokatServerId: jest.fn(),
  setUserIdentifier: jest.fn(),
}));

// ─── DevExtreme Tabs mock (overrides moduleNameMapper for this file) ─────────
// Forwards onItemClick so tests can actually switch tabs by clicking an Item,
// exercising DevTabs' renderContent() switch statement.
jest.mock("devextreme-react/tabs", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children, onItemClick }: { children?: React.ReactNode; onItemClick?: (e: { itemIndex: number }) => void }) =>
      React.createElement(
        "div",
        { "data-testid": "dx-tabs" },
        React.Children.map(children, (child: any, index: number) =>
          child
            ? React.cloneElement(child, { onClick: () => onItemClick?.({ itemIndex: index }) })
            : child
        )
      ),
    Item: ({ text, onClick }: { text?: string; onClick?: () => void }) =>
      React.createElement("div", { role: "tab", onClick }, text),
  };
});

// ─── Lazy-loaded tab content mocks ───────────────────────────────────────────
jest.mock("@components/tabs/service/ServiceTabContent",  () => ({ __esModule: true, default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "service-tab" }); } }));
jest.mock("@components/tabs/email/EmailTabContent",      () => ({ __esModule: true, default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "email-tab" }); } }));
jest.mock("@components/tabs/person/PersonTabContent",    () => ({ __esModule: true, default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "person-tab" }); } }));
jest.mock("@components/tabs/case/CaseTabContent",        () => ({ __esModule: true, default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "case-tab" }); } }));
jest.mock("@components/tabs/shared/CacheStatsPanel",     () => ({ __esModule: true, default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "cache-tab" }); } }));

import * as React from "react";
import { screen, fireEvent, act } from "@testing-library/react";
import { renderWithProviders } from "./testUtils";
import DevTabs from "@components/Tab";

describe("Tab (DevTabs)", () => {
  // ────────────────────────────────────────────────────────────────────────────
  // Language switcher
  // ────────────────────────────────────────────────────────────────────────────
  describe("Language switcher", () => {
    it("renders DE and EN buttons", () => {
      renderWithProviders(<DevTabs />);
      expect(screen.getByRole("button", { name: /^DE$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^EN$/i })).toBeInTheDocument();
    });

    it("updates store language to 'en' when EN is clicked", () => {
      const { store } = renderWithProviders(<DevTabs />, {
        preloadedState: { language: { lang: "de" } },
      });
      fireEvent.click(screen.getByRole("button", { name: /^EN$/i }));
      expect(store.getState().language.lang).toBe("en");
    });

    it("updates store language to 'de' when DE is clicked", () => {
      const { store } = renderWithProviders(<DevTabs />, {
        preloadedState: { language: { lang: "en" } },
      });
      fireEvent.click(screen.getByRole("button", { name: /^DE$/i }));
      expect(store.getState().language.lang).toBe("de");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Tabs wrapper
  // ────────────────────────────────────────────────────────────────────────────
  describe("Tabs", () => {
    it("renders the DevExtreme Tabs wrapper", () => {
      renderWithProviders(<DevTabs />);
      expect(screen.getByTestId("dx-tabs")).toBeInTheDocument();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // renderContent() switch statement — tab switching
  // ────────────────────────────────────────────────────────────────────────────
  describe("renderContent() tab switching", () => {
    it("renders the email tab by default (selectedIndex 0)", () => {
      renderWithProviders(<DevTabs />);
      expect(screen.getByTestId("email-tab")).toBeInTheDocument();
    });

    it("renders the service tab when its Item is clicked", async () => {
      renderWithProviders(<DevTabs />);
      fireEvent.click(screen.getByText("tabs.service"));
      // The lazily-loaded tab component resolves asynchronously via Suspense
      expect(await screen.findByTestId("service-tab")).toBeInTheDocument();
    });

    it("renders the case tab when its Item is clicked", async () => {
      renderWithProviders(<DevTabs />);
      fireEvent.click(screen.getByText("tabs.case"));
      expect(await screen.findByTestId("case-tab")).toBeInTheDocument();
    });

    it("renders the person tab when its Item is clicked", async () => {
      renderWithProviders(<DevTabs />);
      fireEvent.click(screen.getByText("tabs.person"));
      expect(await screen.findByTestId("person-tab")).toBeInTheDocument();
    });

    it("does not render the cache tab Item when ENABLE_CACHE_STATS is false", () => {
      renderWithProviders(<DevTabs />);
      expect(screen.queryByText("tabs.cache")).not.toBeInTheDocument();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // ICE badge
  // ────────────────────────────────────────────────────────────────────────────
  describe("ICE badge", () => {
    it("shows '—' when no candidate type is selected", () => {
      renderWithProviders(<DevTabs />);
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("shows 'STUN' label when selectedCandidateType is 'stun'", () => {
      renderWithProviders(<DevTabs />, {
        preloadedState: {
          connection: { selectedCandidateType: "stun" },
        },
      });
      expect(screen.getByText("STUN")).toBeInTheDocument();
    });

    it("shows 'TURN' label when selectedCandidateType is 'turn'", () => {
      renderWithProviders(<DevTabs />, {
        preloadedState: {
          connection: { selectedCandidateType: "turn" },
        },
      });
      expect(screen.getByText("TURN")).toBeInTheDocument();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Keyboard shortcut for cache tab toggle
  // ────────────────────────────────────────────────────────────────────────────
  describe("Keyboard shortcut", () => {
    function fireCtrlShiftS() {
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "S", ctrlKey: true, shiftKey: true, bubbles: true })
        );
      });
    }

    it("does not crash when Ctrl+Shift+S is pressed", () => {
      renderWithProviders(<DevTabs />);
      fireCtrlShiftS();
      // Just verify the component is still mounted
      expect(screen.getByRole("button", { name: /^DE$/i })).toBeInTheDocument();
    });

    it("reveals the cache tab Item after Ctrl+Shift+S", () => {
      renderWithProviders(<DevTabs />);
      expect(screen.queryByText("tabs.cache")).not.toBeInTheDocument();

      fireCtrlShiftS();

      expect(screen.getByText("tabs.cache")).toBeInTheDocument();
    });

    it("hides the cache tab Item again on a second Ctrl+Shift+S", () => {
      renderWithProviders(<DevTabs />);
      fireCtrlShiftS();
      expect(screen.getByText("tabs.cache")).toBeInTheDocument();

      fireCtrlShiftS();

      expect(screen.queryByText("tabs.cache")).not.toBeInTheDocument();
    });

    it("renders the CacheStatsPanel when the revealed cache tab is selected", async () => {
      renderWithProviders(<DevTabs />);
      fireCtrlShiftS();
      fireEvent.click(screen.getByText("tabs.cache"));
      expect(await screen.findByTestId("cache-tab")).toBeInTheDocument();
    });

    it("shows the 'cache not available' message if cache tab is toggled off while selected", async () => {
      renderWithProviders(<DevTabs />);
      fireCtrlShiftS(); // reveal
      fireEvent.click(screen.getByText("tabs.cache")); // select index 4
      expect(await screen.findByTestId("cache-tab")).toBeInTheDocument();

      fireCtrlShiftS(); // hide again, but selectedIndex is still 4

      expect(screen.queryByTestId("cache-tab")).not.toBeInTheDocument();
      expect(screen.getByText("cacheNotAvailable")).toBeInTheDocument();
    });
  });
});
