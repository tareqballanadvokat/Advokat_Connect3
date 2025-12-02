// TypeScript models matching the C# API structure for Services (Leistungen)

// Matches LeistungPostData class - data for creating a new service
export interface LeistungPostData {
  aktId: number | null;                           // Always send, use null if not set
  aKurz: string | null;                          // Always send, use null if not set
  leistungKurz: string;                          // Required
  datum: string;                                 // Required - ISO date string
  honorartext: string | null;                    // Always send, use null if not set
  memo: string | null;                           // Always send, use null if not set
  sbZeitVerrechenbarInMinuten: number | null;    // Always send, use null if not set
  sbZeitNichtVerrechenbarInMinuten: number | null; // Always send, use null if not set
  outlookEmailId?: string | null;                // Outlook email message ID for tracking
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
