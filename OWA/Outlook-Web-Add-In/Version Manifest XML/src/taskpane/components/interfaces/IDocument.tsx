// Document interfaces corresponding to C# models

// Enum for document types (corresponds to C# DokumentArt enum)
export enum DokumentArt {
  Keine = 0,           // If the document is a normal file, not an email
  MailEmpfangen = 1,   // Received email
  MailGesendet = 2     // Sent email
}

// Interface for creating/posting documents (corresponds to C# DokumentPostData)
export interface DokumentPostData {
  aktId: number;
  aKurz?: string;
  betreff: string;
  mailAdresse?: string;
  empfangenAm?: Date;
  memo?: string;
  inhalt: string; // Base64 encoded content (byte[] in C# becomes string in TypeScript)
  sachbearbeiterKürzel?: string;
  dokumentArt: DokumentArt;
  outlookId?: string;
  anzahlMailAnhänge: number;
  dateigrößeInBytes?: number;
  dateiName?: string;
  ordnerName?: string;
  
  // Chunk parameters for large documents
  numberOfParts?: number;    // Total number of chunks
  partNumber?: number;       // Current part number (1-based)
  checkSum?: string;         // Checksum of complete document
}

// Interface for document response (corresponds to C# DokumentResponse)
export interface DokumentResponse {
  id: number;
  aKurz?: string;
  aktId?: number;
  datum?: Date;
  erledigtDatum?: Date;
  betreff?: string;
  dokumentArt: DokumentArt;
  mailAdresse?: string;
  mailZeitpunkt?: Date;
  anzahlMailAnhänge: number;
  anhangDateiNamen?: string;
  sachbearbeiterKürzel?: string;
  vonSachbearbeiterKürzel?: string;
  dateipfad?: string;
  bearbeitungsInfoErstelltVon?: string;
  bearbeitungsInfoErstelltAm?: Date;
  bearbeitungsInfoBearbeitetVon?: string;
  bearbeitungsInfoBearbeitetAm?: Date;
}

// Interface for querying documents (corresponds to C# DokumenteQuery)
export interface DokumenteQuery {
  aktId?: number;
  outlookEmailId?: string;
  dokumentArten?: DokumentArt[];
  limit?: number;
}

// Interface for transfer attachment items with document information
export interface TransferAttachmentItem {
  // Outlook properties
  id: string;
  label: string;
  name: string;
  type: string; // 'E' for email, 'A' for attachment
  checked: boolean;
  readonly: boolean;
  disabled: boolean;
  option: number; // Folder option ID
  folderName?: string;
  
  // Document information from Advokat (null if not saved yet)
  document?: DokumentResponse;
}


