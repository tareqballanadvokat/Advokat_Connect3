
export interface PersonKontaktData {
  Reihung: number;
  Art: string;
  Bemerkung?: string;
  TelefonnummerOderAdresse: string;
}

export interface AdresseData {
  straße?: string;
  plz?: string;
  ort?: string;
  landeskennzeichenIso2?: string;
}

export interface PersonLookUpResponse {
  Id: number;
  NKurz: string;
  IstFirma?: boolean;
  Titel?: string;
  Vorname?: string;
  Name1?: string;
  Name2?: string;
  Name3?: string;
  Adresse?: AdresseData;
  Kontakte: PersonKontaktData[];
}

// PersonResponse for GetAllAsync endpoint (favorites)
export interface PersonResponse {
  Id: number;
  NKurz: string;
  IstFirma?: boolean;
  Titel?: string;
  Vorname?: string;
  Name1?: string;
  Name2?: string;
  Name3?: string;
  Adressdaten?: AdresseData;
  Kontakte: PersonKontaktData[];
}

// Query interface for person search
export interface PersonenQuery {
  NKurzLike?: string;
  Name1Like?: string;
  Count?: number;
  NurFavoriten?: boolean;
}

 export interface Person {
  id: string;
  fullName: string;
  address?: string;
  phone?: string;
  city?: string;
  website?: string;
}