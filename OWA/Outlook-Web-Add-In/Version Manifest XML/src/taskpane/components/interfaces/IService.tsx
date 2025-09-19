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
  id: number;
  kürzel: string;
  stufe1?: string;
  stufe2?: string;
  stufe3?: string;
  anzeigenInQuicklisteOutlook?: boolean;
}

// Registered service item
export interface RegisteredService {
  id: string;
  date: string;
  abbreviation: string;
  text: string;
  time: string;
}
