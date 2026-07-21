/* eslint-disable no-undef */
/**
 * Component Tests for Header.tsx
 *
 * Covers:
 *  - Renders message prop as heading
 *  - Renders logo image with title as alt text
 *  - Renders DE / EN language-switcher buttons
 *  - Clicking EN button updates store language to 'en'
 *  - Clicking DE button updates store language to 'de'
 */

// ─── FluentUI mock ────────────────────────────────────────────────────────────
// makeStyles → returns empty class map; Image → plain <img>; tokens → empty obj
jest.mock("@fluentui/react-components", () => {
  const React = require("react");
  return {
    makeStyles: () => () => ({}),
    tokens: {},
    Image: ({ alt, src }: { alt?: string; src?: string }) =>
      React.createElement("img", { alt, src }),
  };
});

import * as React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "./testUtils";
import Header, { HeaderProps } from "../Header";

const defaultProps: HeaderProps = {
  title: "ADVOKAT Add-in",
  logo:  "logo.png",
  message: "Hello!",
};

describe("Header", () => {
  // ────────────────────────────────────────────────────────────────────────────
  // Rendering
  // ────────────────────────────────────────────────────────────────────────────
  describe("Rendering", () => {
    it("renders the message prop as an h1 heading", () => {
      renderWithProviders(<Header {...defaultProps} />);
      expect(screen.getByRole("heading", { level: 1, name: /Hello!/i })).toBeInTheDocument();
    });

    it("renders the logo image with the title as alt text", () => {
      renderWithProviders(<Header {...defaultProps} />);
      expect(screen.getByRole("img", { name: /ADVOKAT Add-in/i })).toBeInTheDocument();
    });

    it("renders both DE and EN language-switcher buttons", () => {
      renderWithProviders(<Header {...defaultProps} />);
      expect(screen.getByRole("button", { name: /^DE$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^EN$/i })).toBeInTheDocument();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Language switcher
  // ────────────────────────────────────────────────────────────────────────────
  describe("Language switcher", () => {
    it("updates store language to 'en' when EN is clicked", () => {
      const { store } = renderWithProviders(<Header {...defaultProps} />, {
        preloadedState: { language: { lang: "de" } },
      });

      fireEvent.click(screen.getByRole("button", { name: /^EN$/i }));

      expect(store.getState().language.lang).toBe("en");
    });

    it("updates store language to 'de' when DE is clicked", () => {
      const { store } = renderWithProviders(<Header {...defaultProps} />, {
        preloadedState: { language: { lang: "en" } },
      });

      fireEvent.click(screen.getByRole("button", { name: /^DE$/i }));

      expect(store.getState().language.lang).toBe("de");
    });

    it("renders DE as the active button when lang is 'de'", () => {
      renderWithProviders(<Header {...defaultProps} />, {
        preloadedState: { language: { lang: "de" } },
      });

      // Active button has the blue background colour (#0078d4)
      const deBtn = screen.getByRole("button", { name: /^DE$/i });
      expect(deBtn).toHaveStyle({ background: "#0078d4" });
    });

    it("renders EN as the active button when lang is 'en'", () => {
      renderWithProviders(<Header {...defaultProps} />, {
        preloadedState: { language: { lang: "en" } },
      });

      const enBtn = screen.getByRole("button", { name: /^EN$/i });
      expect(enBtn).toHaveStyle({ background: "#0078d4" });
    });
  });
});
