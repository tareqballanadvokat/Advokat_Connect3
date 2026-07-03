
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
  gerichtsgebuehrenArt?: GerichtsgebuehrenArt;
}

export enum GerichtsgebuehrenArt {
  Gebuehreneinzug = 0,
  ZahlungspflichtGegner = 1,
  Gebuehrenbefreiung = 2,
  Verfahrenshilfe = 3,
}

export interface AktResponse {
  id: number;
  aKurz: string;
  causa?: string;
  gerichtsgebuehrenArt?: GerichtsgebuehrenArt;
}

// Backward-compatible alias for existing imports/usages
export type AktenResponse = AktResponse;
