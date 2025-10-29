
export interface AktenQuery {
  AktId?: number;
  AKurzLike?: string;
  Count?: number;
  NurFavoriten?: boolean;
}

export interface AktLookUpResponse {
  id: number;
  aKurz: string;
  causa?: string;
}

export interface AktenResponse {
  id: number;
  aKurz: string;
  causa?: string;
}
