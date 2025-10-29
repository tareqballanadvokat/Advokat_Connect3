
export interface PersonKontaktData {
  reihung: number;
  art: string;
  bemerkung?: string;
  telefonnummerOderAdresse: string;
}

export interface AdresseData {
  straße?: string;
  plz?: string;
  ort?: string;
  landeskennzeichenIso2?: string;
}

export interface PersonLookUpResponse {
  id: number;
  nKurz: string;
  istFirma?: boolean;
  titel?: string;
  vorname?: string;
  name1?: string;
  name2?: string;
  name3?: string;
  adresse?: AdresseData;
  kontakte: PersonKontaktData[];
}

// PersonResponse for GetAllAsync endpoint (favorites)
export interface PersonResponse {
  id: number;
  nKurz: string;
  istFirma?: boolean;
  titel?: string;
  vorname?: string;
  name1?: string;
  name2?: string;
  name3?: string;
  adressdaten?: AdresseData;
  kontakte: PersonKontaktData[];
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