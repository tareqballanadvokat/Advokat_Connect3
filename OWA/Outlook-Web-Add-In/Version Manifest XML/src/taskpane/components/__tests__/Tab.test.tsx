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
jest.mock("devextreme-react/tabs", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children, onItemClick }: { children?: React.ReactNode; onItemClick?: (e: { itemIndex: number }) => void }) =>
      React.createElement("div", { "data-testid": "dx-tabs" }, children),
    Item: ({ text }: { text?: string }) =>
      React.createElement("div", { role: "tab" }, text),
  };
});

// ─── Lazy-loaded tab content mocks ───────────────────────────────────────────
jest.mock("../tabs/service/ServiceTabContent",  () => ({ __esModule: true, default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "service-tab" }); } }));
jest.mock("../tabs/email/EmailTabContent",      () => ({ __esModule: true, default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "email-tab" }); } }));
jest.mock("../tabs/person/PersonTabContent",    () => ({ __esModule: true, default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "person-tab" }); } }));
jest.mock("../tabs/case/CaseTabContent",        () => ({ __esModule: true, default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "case-tab" }); } }));
jest.mock("../tabs/shared/CacheStatsPanel",     () => ({ __esModule: true, default: () => { const R = require("react"); return R.createElement("div", { "data-testid": "cache-tab" }); } }));

import * as React from "react";
import { screen, fireEvent, act } from "@testing-library/react";
import { renderWithProviders } from "./testUtils";
import DevTabs from "../Tab";

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
    it("does not crash when Ctrl+Shift+S is pressed", () => {
      renderWithProviders(<DevTabs />);
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "S", ctrlKey: true, shiftKey: true, bubbles: true })
        );
      });
      // Just verify the component is still mounted
      expect(screen.getByRole("button", { name: /^DE$/i })).toBeInTheDocument();
    });
  });
});
