// TypeScript interfaces matching C# PersonLookUpResponse model
export interface PersonKontaktData {
  reihung: number; // short in C# maps to number in TypeScript
  art: string; // required string
  bemerkung?: string; // optional string
  telefonnummerOderAdresse: string; // required string
}

export interface AdresseData {
  straße?: string;
  plz?: string;
  ort?: string;
  landeskennzeichenIso2?: string;
}

export interface PersonLookUpResponse {
  personId: number;
  nKurz: string;
  anzeigename: string;
  adressdaten?: AdresseData;
  kontakte: PersonKontaktData[];
}

// Query interface for person search
export interface PersonenQuery {
  nKurzLike?: string;
  name1Like?: string;
  count?: number;
  nurFavoriten?: boolean;
}

 export interface Person {
  id: string;
  fullName: string;
  address?: string;
  phone?: string;
  city?: string;
  website?: string;
}