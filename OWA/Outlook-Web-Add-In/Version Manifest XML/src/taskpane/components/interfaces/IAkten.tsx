
export interface AktenQuery {
  AktId?: number;        // Search by specific Akt ID
  AKurzLike?: string;    // Search by Kürzel pattern
  Count?: number;        // Limit number of results
  NurFavoriten?: boolean; // Only favorites flag
  Causa?: boolean;       // Include causa information
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

// WebRTC API request format based on the attached specification
export interface WebRTCApiRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
}

// Generic WebRTC API response format
export interface WebRTCApiResponse<T = any> {
  Id: string;         // GUID identifier matching the request
  Timestamp: number;  // Timestamp of the response
  statusCode: number;
  data: T;
  error?: string;
}
