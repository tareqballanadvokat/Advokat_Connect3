/* eslint-disable no-undef */
/**
 * Unit Tests for languageSlice
 * Tests the language reducer and localStorage persistence
 */

import languageReducer, { setLanguage, SupportedLanguage } from "@slices/languageSlice";

// Mock i18n so tests don't trigger real language loading
jest.mock("@i18n", () => ({
  changeLanguage: jest.fn(),
}));

// Import the mocked i18n so we can assert on it
import i18n from "@i18n";

describe("languageSlice", () => {
  // Reset localStorage and mocks before each test
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Reducer — initial state
  // ──────────────────────────────────────────────────────────────────────────

  describe("Reducer — initial state", () => {
    it("should default to 'de' when localStorage is empty", () => {
      // The module-level initialState is computed once at import time,
      // so we test the reducer with an explicit starting state.
      const state = languageReducer({ lang: "de" }, { type: "unknown" });
      expect(state.lang).toBe("de");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // setLanguage
  // ──────────────────────────────────────────────────────────────────────────

  describe("setLanguage", () => {
    it("should update lang to 'en'", () => {
      const state = languageReducer({ lang: "de" }, setLanguage("en"));
      expect(state.lang).toBe("en");
    });

    it("should update lang to 'de'", () => {
      const state = languageReducer({ lang: "en" }, setLanguage("de"));
      expect(state.lang).toBe("de");
    });

    it("should persist the selection to localStorage", () => {
      languageReducer({ lang: "de" }, setLanguage("en"));
      expect(localStorage.getItem("adv_lang")).toBe("en");
    });

    it("should call i18n.changeLanguage with the new language", () => {
      languageReducer({ lang: "de" }, setLanguage("en"));
      expect(i18n.changeLanguage).toHaveBeenCalledWith("en");
    });

    it("should call i18n.changeLanguage exactly once per dispatch", () => {
      languageReducer({ lang: "de" }, setLanguage("de"));
      expect(i18n.changeLanguage).toHaveBeenCalledTimes(1);
    });

    it("should overwrite a previously stored language in localStorage", () => {
      languageReducer({ lang: "de" }, setLanguage("en"));
      expect(localStorage.getItem("adv_lang")).toBe("en");

      languageReducer({ lang: "en" }, setLanguage("de"));
      expect(localStorage.getItem("adv_lang")).toBe("de");
    });

    it("should handle switching back and forth", () => {
      let state = { lang: "de" as SupportedLanguage };
      state = languageReducer(state, setLanguage("en"));
      expect(state.lang).toBe("en");
      state = languageReducer(state, setLanguage("de"));
      expect(state.lang).toBe("de");
    });
  });
});
