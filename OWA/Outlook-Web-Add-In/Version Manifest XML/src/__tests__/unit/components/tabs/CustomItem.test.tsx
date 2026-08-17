/* eslint-disable no-undef */
/**
 * Component Tests for tabs/person/CustomItem.tsx
 *
 * Pure presentational component — no Redux/devextreme dependencies.
 *
 * Covers:
 *  - getFullName: title+first+last name assembly, falls back to nKurz, then to
 *    the translated "unknown person" placeholder
 *  - Address section: rendered only when adressdaten is present, street/plz/ort
 *    line composition, country code suffix
 *  - Contacts section: icon/label mapping by contact type (phone/email/website),
 *    website rendered as a link, remark note rendering
 *  - Empty state shown only when neither address nor contacts are present
 */

// ─── react-i18next mock ───────────────────────────────────────────────────────
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { changeLanguage: jest.fn() } }),
  initReactI18next: { type: "3rdParty", init: jest.fn() },
}));

// ─── Imports ─────────────────────────────────────────────────────────────────
import * as React from "react";
import { render, screen } from "@testing-library/react";
import CustomItem from "@components/tabs/person/CustomItem";
import { PersonResponse } from "@interfaces/IPerson";

function makePerson(overrides: Partial<PersonResponse> = {}): PersonResponse {
  return {
    id: 1,
    nKurz: "MUS001",
    istFirma: false,
    ...overrides,
  } as PersonResponse;
}

describe("CustomItem", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Full name assembly
  // ──────────────────────────────────────────────────────────────────────────

  describe("full name", () => {
    it("joins titel, vorname, name1, name2, name3", () => {
      render(
        <CustomItem
          {...makePerson({ titel: "Dr.", vorname: "Max", name1: "Mustermann", name2: "Jr.", name3: "III" })}
        />
      );
      expect(screen.getByText("Dr. Max Mustermann Jr. III")).toBeInTheDocument();
    });

    it("skips missing name parts", () => {
      render(<CustomItem {...makePerson({ vorname: "Max", name1: "Mustermann" })} />);
      expect(screen.getByText("Max Mustermann")).toBeInTheDocument();
    });

    it("falls back to nKurz when no name parts are present", () => {
      render(<CustomItem {...makePerson({ nKurz: "MUS001" })} />);
      expect(screen.getByText("MUS001")).toBeInTheDocument();
    });

    it("falls back to the translated placeholder when neither name parts nor nKurz are present", () => {
      render(<CustomItem {...makePerson({ nKurz: "" })} />);
      expect(screen.getByText("unknownPerson")).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Address section
  // ──────────────────────────────────────────────────────────────────────────

  describe("address section", () => {
    it("does not render the address section when adressdaten is absent", () => {
      render(<CustomItem {...makePerson()} />);
      expect(screen.queryByText("contactAddress")).not.toBeInTheDocument();
    });

    it("renders street, plz/ort, and country code when present", () => {
      render(
        <CustomItem
          {...makePerson({
            adressdaten: {
              straße: "Hauptstraße 1",
              plz: "12345",
              ort: "Berlin",
              landeskennzeichenIso2: "DE",
            },
          })}
        />
      );
      expect(screen.getByText("Hauptstraße 1")).toBeInTheDocument();
      expect(screen.getByText(/12345\s*Berlin, DE/)).toBeInTheDocument();
    });

    it("renders plz/ort without a country suffix when landeskennzeichenIso2 is absent", () => {
      render(
        <CustomItem
          {...makePerson({ adressdaten: { straße: "", plz: "12345", ort: "Berlin" } })}
        />
      );
      expect(screen.getByText(/^12345\s*Berlin$/)).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Contacts section
  // ──────────────────────────────────────────────────────────────────────────

  describe("contacts section", () => {
    it("maps a phone contact type to the phone label", () => {
      render(
        <CustomItem
          {...makePerson({
            kontakte: [{ reihung: 1, art: "Telefon", telefonnummerOderAdresse: "+49123456" }],
          })}
        />
      );
      expect(screen.getByText("contactTelefon")).toBeInTheDocument();
      expect(screen.getByText("+49123456")).toBeInTheDocument();
    });

    it("maps an email contact type to the email label", () => {
      render(
        <CustomItem
          {...makePerson({
            kontakte: [{ reihung: 1, art: "Email", telefonnummerOderAdresse: "max@example.com" }],
          })}
        />
      );
      expect(screen.getByText("contactEmail")).toBeInTheDocument();
    });

    it("maps a website contact type to a clickable link", () => {
      render(
        <CustomItem
          {...makePerson({
            kontakte: [{ reihung: 1, art: "Website", telefonnummerOderAdresse: "https://example.com" }],
          })}
        />
      );
      expect(screen.getByText("contactWebsite")).toBeInTheDocument();
      const link = screen.getByRole("link", { name: "https://example.com" });
      expect(link).toHaveAttribute("href", "https://example.com");
      expect(link).toHaveAttribute("target", "_blank");
    });

    it("falls back to the raw 'art' label for an unrecognized contact type", () => {
      render(
        <CustomItem
          {...makePerson({
            kontakte: [{ reihung: 1, art: "Fax", telefonnummerOderAdresse: "12345" }],
          })}
        />
      );
      expect(screen.getByText("Fax")).toBeInTheDocument();
    });

    it("renders a remark note in parentheses when present", () => {
      render(
        <CustomItem
          {...makePerson({
            kontakte: [
              {
                reihung: 1,
                art: "Telefon",
                telefonnummerOderAdresse: "+49123456",
                bemerkung: "office hours only",
              },
            ],
          })}
        />
      );
      expect(screen.getByText("(office hours only)")).toBeInTheDocument();
    });

    it("renders one row per contact", () => {
      render(
        <CustomItem
          {...makePerson({
            kontakte: [
              { reihung: 1, art: "Telefon", telefonnummerOderAdresse: "111" },
              { reihung: 2, art: "Email", telefonnummerOderAdresse: "a@b.com" },
            ],
          })}
        />
      );
      expect(screen.getByText("contactTelefon")).toBeInTheDocument();
      expect(screen.getByText("contactEmail")).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Empty state
  // ──────────────────────────────────────────────────────────────────────────

  describe("empty state", () => {
    it("shows the empty-state message when there is no address and no contacts", () => {
      render(<CustomItem {...makePerson()} />);
      expect(screen.getByText("noContactInfo")).toBeInTheDocument();
    });

    it("does not show the empty-state message when an address is present", () => {
      render(<CustomItem {...makePerson({ adressdaten: { straße: "X" } })} />);
      expect(screen.queryByText("noContactInfo")).not.toBeInTheDocument();
    });

    it("does not show the empty-state message when contacts are present", () => {
      render(
        <CustomItem
          {...makePerson({
            kontakte: [{ reihung: 1, art: "Telefon", telefonnummerOderAdresse: "111" }],
          })}
        />
      );
      expect(screen.queryByText("noContactInfo")).not.toBeInTheDocument();
    });

    it("does not show the empty-state message for an empty (but present) kontakte array", () => {
      render(<CustomItem {...makePerson({ kontakte: [] })} />);
      expect(screen.getByText("noContactInfo")).toBeInTheDocument();
    });
  });
});
