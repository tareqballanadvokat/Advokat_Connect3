// TypeScript models matching the C# API structure for Akten (Cases)

// Matches AktenQuery class - search by Kürzel or AktId
export interface AktenQuery {
  aktId?: number;      // Search by specific Akt ID
  aKurzLike?: string;  // Search by Kürzel pattern
  count?: number;      // Limit number of results
  withCausa?: boolean; // Include causa information
}

// Matches AktLookUpResponse class  
export interface AktLookUpResponse {
  aktId: number;
  aKurz: string;    // The Kürzel
  causa?: string;
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
