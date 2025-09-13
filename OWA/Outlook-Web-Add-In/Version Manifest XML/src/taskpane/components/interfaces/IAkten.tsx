
export interface AktenQuery {
  AktId?: number;
  AKurzLike?: string;
  Count?: number;
  NurFavoriten?: boolean;
  Causa?: boolean;
}

export interface AktLookUpResponse {
  aktId: number;
  aKurz: string;
  causa?: string;
}

// New interface matching the latest API version
export interface AktenResponse {
  Id: number;
  AKurz: string;
  Causa?: string;
}
