/**
 * Mock Data Factories
 *
 * Factory functions for creating mock data objects used across all test files.
 * Each factory accepts optional overrides to customize the generated objects.
 */

import { FolderOption } from "../aktenSlice";
import { AktLookUpResponse } from "@interfaces/IAkten";
import {
  DokumentResponse,
  DokumentPostData,
  TransferAttachmentItem,
} from "@interfaces/IDocument";
import {
  LeistungAuswahlResponse,
  LeistungPostData,
} from "@interfaces/IService";
import {
  PersonLookUpResponse,
  PersonResponse,
} from "@interfaces/IPerson";

// ============================================================================
// Akten (Case) Factories
// ============================================================================

export const createMockAkt = (overrides: Partial<AktLookUpResponse> = {}): AktLookUpResponse => ({
  id: 1,
  aKurz: "TEST-001",
  causa: "Test Causa",
  ...overrides,
});

export const createMockDocument = (
  overrides: Partial<DokumentResponse> = {}
): DokumentResponse => ({
  id: 1,
  aktId: 1,
  betreff: "Test Document",
  dateipfad: "C:\\Documents\\test.pdf",
  dokumentArt: 0,
  anzahlMailAnhänge: 0,
  ...overrides,
});

export const createMockFolderOption = (overrides: Partial<FolderOption> = {}): FolderOption => ({
  id: 1,
  text: "Email",
  ...overrides,
});

// ============================================================================
// Email/Attachment Factories
// ============================================================================

export const createMockAttachment = (
  overrides: Partial<TransferAttachmentItem> = {}
): TransferAttachmentItem => ({
  id: "attachment-1",
  label: "Test Attachment",
  name: "test.pdf",
  type: "A",
  checked: false,
  readonly: false,
  disabled: false,
  option: 1,
  folderName: "Email",
  ...overrides,
});

export const createMockDokumentPostData = (
  overrides: Partial<DokumentPostData> = {}
): DokumentPostData => ({
  aktId: 1,
  betreff: "Test Document",
  inhalt: "base64content",
  dokumentArt: 0,
  anzahlMailAnhänge: 0,
  ...overrides,
});

// ============================================================================
// Service (Leistung) Factories
// ============================================================================

export const createMockService = (
  overrides: Partial<LeistungAuswahlResponse> = {}
): LeistungAuswahlResponse => ({
  id: 1,
  kürzel: "SRV001",
  stufe1: "Consultation",
  stufe2: "Legal Advice",
  stufe3: "General",
  anzeigenInQuicklisteOutlook: true,
  ...overrides,
});

export const createMockLeistungPostData = (
  overrides: Partial<LeistungPostData> = {}
): LeistungPostData => ({
  aktId: 123,
  aKurz: "AKT001",
  leistungKurz: "SRV001",
  datum: "2024-01-15",
  honorartext: "Legal consultation",
  memo: "Client meeting",
  sachbearbeiter: [
    {
      sb: "JDO",
      zeitVerrechenbarInMinuten: 60,
      zeitNichtVerrechenbarInMinuten: 15,
    },
  ],
  ...overrides,
});

// ============================================================================
// Person Factories
// ============================================================================

export const createMockPersonLookUp = (
  overrides: Partial<PersonLookUpResponse> = {}
): PersonLookUpResponse => ({
  id: 1,
  nKurz: "PERS001",
  istFirma: false,
  titel: "Dr.",
  vorname: "Max",
  name1: "Mustermann",
  name2: "",
  name3: "",
  adresse: {
    straße: "Hauptstraße 1",
    plz: "12345",
    ort: "Berlin",
    landeskennzeichenIso2: "DE",
  },
  kontakte: [
    {
      reihung: 1,
      art: "Email",
      bemerkung: "Work",
      telefonnummerOderAdresse: "max@example.com",
    },
  ],
  ...overrides,
});

export const createMockPersonResponse = (
  overrides: Partial<PersonResponse> = {}
): PersonResponse => ({
  id: 1,
  nKurz: "PERS001",
  istFirma: false,
  titel: "Dr.",
  vorname: "Max",
  name1: "Mustermann",
  name2: "",
  name3: "",
  adressdaten: {
    straße: "Hauptstraße 1",
    plz: "12345",
    ort: "Berlin",
    landeskennzeichenIso2: "DE",
  },
  kontakte: [],
  ...overrides,
});
