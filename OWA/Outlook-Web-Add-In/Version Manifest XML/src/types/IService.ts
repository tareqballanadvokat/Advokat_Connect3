export interface LeistungSachbearbeiter {
  sb: string;  // SB-Kürzel (max 3 chars)
  zeitVerrechenbarInMinuten: number;
  zeitNichtVerrechenbarInMinuten: number;
}

export interface LeistungPostData {
  aktId: number | null;                          
  aKurz: string | null;                          
  leistungKurz: string;                          
  datum: string;                                 
  honorartext: string | null;                    
  memo: string | null;                           
  outlookEmailId?: string | null;                // Outlook email message ID for tracking
  sachbearbeiter?: LeistungSachbearbeiter[];     
  barauslagen?: any[];                           
}

export interface LeistungenAuswahlQuery {
  Kürzel?: string;           
  OnlyQuickListe: boolean;
  Count?: number;            
}

export interface LeistungAuswahlResponse {
  id: number;
  kürzel: string;
  stufe1?: string;
  stufe2?: string;
  stufe3?: string;
  anzeigenInQuicklisteOutlook?: boolean;
}

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
  
  // BearbeitungsInfoQuery fields
  erstelltAb?: Date | string | null;
  erstelltBis?: Date | string | null;
  erstelltVon?: string | null;
  bearbeitetAb?: Date | string | null;
  bearbeitetBis?: Date | string | null;
  bearbeitetVon?: string | null;
}

export interface LeistungSachbearbeiterResponse {
  id: number;
  index: number;
  sachbearbeiter?: string | null;
  fürSachbearbeiter?: string | null;
  zeitVerrechenbar?: string | null;
  zeitNichtVerrechenbar?: string | null;
  honorar?: number | null;
  zeitVerrechenbarInMinuten: number;
  zeitNichtVerrechenbarInMinuten: number;
}

export interface LeistungBarauslageResponse {
  id: number;
  index: number;
  art?: string | null;
  uStSatz?: number | null;
  ansprechbar?: boolean | null;
  betrag?: number | null;
  lokalwährungszeichen?: string | null;
  lokalwährungsbetrag?: number | null;
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
  leistungKurz: string; 
  datum: string; 
  honorartext?: string | null;
  memo?: string | null;

  barauslagen: LeistungBarauslageResponse[];
  sachbearbeiter: LeistungSachbearbeiterResponse[];
}
