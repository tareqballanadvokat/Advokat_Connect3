
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

export interface LeistungenQuery {
  aktId?: number | null;
  outlookEmailId?: string | null;
  count?: number | null;
}

export interface LeistungResponse {
  id: number;
  kostenEntscheidung?: string | null;
  gerichtId?: number | null;
  gegenWen?: string | null;
  halbe?: number | null;
  verbindungsgebührProzentsatz?: number | null;
  streitgenossenzuschlagProzentsatz?: number | null;
  zuschlagProzentsatz?: number | null;
  bemessungRAT?: number | null;
  bemessungAHR?: number | null;
  verdienst?: number | null;
  datumAbrechnung?: string | null;
  titelId?: number | null;
  gemeldetAm?: string | null;
  dokumentId?: number | null;
  status?: string | null;
  einheitssatz?: string | null;
  intern?: boolean | null;
  gruppe?: string | null;
  offenerPostenId?: number | null;
  einzahler?: number | null;
  tag?: number | null;
  teilaktPfad?: string | null;
  bearbeitungsInfoErstelltVon?: string | null;
  bearbeitungsInfoErstelltAm?: string | null;
  bearbeitungsInfoBearbeitetVon?: string | null;
  bearbeitungsInfoBearbeitetAm?: string | null;
  outlookEmailId?: string | null;
  
  // From LeistungBase (inherited properties)
  aktId?: number | null;
  aKurz?: string | null;
  leistungKurz: string;  // Required
  datum: string;         // Required
  honorartext?: string | null;
  memo?: string | null;
}
