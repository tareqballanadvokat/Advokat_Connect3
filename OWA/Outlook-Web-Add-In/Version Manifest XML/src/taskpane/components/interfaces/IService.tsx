// TypeScript models matching the C# API structure for Services (Leistungen)

// Matches LeistungPostData class - data for creating a new service
export interface LeistungPostData {
  AktId?: number;
  AKurz?: string;
  LeistungKurz: string;         // Required
  Datum: string;                // Required - ISO date string
  Honorartext?: string;
  Memo?: string;
  SBZeitVerrechenbarInMinuten?: number;
  SBZeitNichtVerrechenbarInMinuten?: number;
}

// Matches LeistungenAuswahlQuery class - search for services
export interface LeistungenAuswahlQuery {
  Kürzel?: string;           // Case Kürzel to get services for
  OnlyQuickListe: boolean;   // Only services marked for quick list
  Limit?: number;            // Limit number of results
}

// Matches LeistungAuswahlResponse class - service information
export interface LeistungAuswahlResponse {
  Id: number;
  Kürzel: string;
  Stufe1?: string;
  Stufe2?: string;
  Stufe3?: string;
  AnzeigenInQuicklisteOutlook?: boolean;
}

// Legacy service interfaces (keeping for backward compatibility)

// Service data model for API communication
export interface ServiceModel {
  caseId: number;
  serviceAbbreviationType: string;
  serviceSB: string;
  serviceTime: string;
  serviceText: string;
  internetMessageId: string;
  userId: number;
}

// Service component props
export interface ServiceSectionProps {
  selectedAktKuerzel?: string; // The Kürzel of the selected Akt
  mode?: 'email' | 'service';  // Mode determines behavior differences
}

// Registered service item
export interface RegisteredService {
  id: string;
  date: string;
  abbreviation: string;
  text: string;
  time: string;
}
