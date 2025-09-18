import { AktenQuery } from '../components/interfaces/IAkten';
import { WebRTCApiRequest, WebRTCApiResponse } from '../components/interfaces/IWebRTC';
import { LeistungenAuswahlQuery, LeistungPostData } from '../components/interfaces/IService';
import { DokumentPostData, DokumenteQuery } from '../components/interfaces/IDocument';
import { PersonenQuery } from '../components/interfaces/IPerson';
import { IAuthRequest, IAuthResponse } from '../components/interfaces/IAuth';
import { SipClientInstance } from '../components/SIP_Library/SipClient';
import { store } from '../../store';
import { selectAuthToken, selectIsTokenValid } from '../../store/slices/authSlice';
import {
  calculateChecksum,
  createProtocolRequest,
  sendRequestWithChunking
} from '../utils/chunkingUtils';

/**
 * Tracks pending WebRTC requests with chunking support and retry logic
 */
interface PendingRequest {
  id: string;
  messageType: string;
  timestamp: number;
  timeoutHandle: NodeJS.Timeout;
  resolve: (response: WebRTCApiResponse) => void;
  reject: (error: Error) => void;
  expectedChunks?: number;
  receivedChunks?: Map<number, WebRTCApiResponse>;
  retryCount?: number;
  originalRequest?: WebRTCApiRequest;
}

// Configuration for response chunking and retries
interface ChunkingConfig {
  maxRetries: number;
  retryTimeoutMs: number;
}

/**
 * WebRTC API Service for handling fire-and-forget messaging with chunking support
 * Provides reliable communication over WebRTC data channels with automatic retry logic
 * Leverages existing SIP_Library for WebRTC connection management
 */
export class WebRTCApiService {
  private sipClient: SipClientInstance | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private readonly REQUEST_TIMEOUT = 100000;
  
  private readonly CHUNKING_CONFIG: ChunkingConfig = {
    maxRetries: 3,
    retryTimeoutMs: 80000
  };

  /**
   * Decode base64 response body with comprehensive logging
   * @param body - Base64 encoded response body
   * @param messageType - Message type for logging context
   * @returns Decoded response body or original if not base64
   */
  private decodeResponseBody(body: string | undefined, messageType: string): string {
    if (!body) {
      console.log(`📥 Response body is empty for ${messageType}`);
      return '';
    }

    console.log(`📥 Raw response body received for ${messageType} (length: ${body.length})`);
    console.log(`📥 Raw response body content: "${body}"`);

    try {
      // Attempt to decode base64
      const decoded = atob(body);
      console.log(`✅ Successfully decoded base64 response for ${messageType} (decoded length: ${decoded.length})`);
      console.log(`📥 Decoded response content: "${decoded}"`);
      return decoded;
    } catch (error) {
      console.log(`ℹ️ Response body is not base64 encoded for ${messageType}, using as-is`);
      console.log(`📥 Non-base64 response content: "${body}"`);
      return body;
    }
  }

  /**
   * Create form data string from authentication request
   * @param authRequest - Authentication request data
   * @returns Form data string in URL-encoded format
   */
  private createFormData(authRequest: IAuthRequest): string {
    // Create URL-encoded form data in the exact format requested
    const formParams = [
      `client_id=${encodeURIComponent(authRequest.client_id)}`,
      `client_secret=${encodeURIComponent(authRequest.client_secret || '')}`,
      `grant_type=${encodeURIComponent(authRequest.grant_type)}`,
      `username=${encodeURIComponent(authRequest.username || '')}`,
      `password=${encodeURIComponent(authRequest.password || '')}`
    ];
    
    const formData = formParams.join('&');

    console.log(`📤 Created URL-encoded form data:`);
    console.log(`📤 Form data content: ${formData}`);

    return formData;
  }

  /**
   * Create headers for WebRTC requests with automatic authorization
   * @param baseHeaders - Base headers to include
   * @param messageType - Message type to determine if authorization is needed
   * @returns Headers object with authorization if needed
   */
  private createRequestHeaders(baseHeaders: Record<string, string>, messageType: string): Record<string, string> {
    const requestHeaders = { ...baseHeaders };
    
    // Add Authorization header for all non-authentication requests
    if (!messageType.includes('auth.')) {
      const state = store.getState();
      const token = selectAuthToken(state);
      const isTokenValid = selectIsTokenValid(state);
      
      if (token && isTokenValid) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
        console.log('🔑 Added Authorization header to request:', messageType);
      } else {
        console.warn('⚠️ No valid token available for authenticated request:', messageType);
        // You might want to trigger token refresh or reject the request here
      }
    }
    
    return requestHeaders;
  }

  /**
   * Initialize with SIP client instance
   * @param sipClient - The initialized SIP client from SIP_Library
   */
  initialize(sipClient: SipClientInstance) {
    this.sipClient = sipClient;
    this.setupDataChannelListener();
  }

  /**
   * Set up listener for incoming API responses via DataChannel
   * Monitors data channel availability and registers message handlers
   */
  private setupDataChannelListener() {
    if (!this.sipClient) return;
    const checkDataChannel = () => {
      const dataChannel = this.sipClient?.peer2peer.getActiveDataChannel();
      if (dataChannel && dataChannel.readyState === 'open') {
        this.sipClient.peer2peer.addMessageHandler((event) => {
          this.handleDataChannelMessage(event);
        });
      } else {
        setTimeout(checkDataChannel, 1000);
      }
    };

    checkDataChannel();
  }

  /**
   * Handle incoming messages from DataChannel
   * Processes different data types (Blob, ArrayBuffer, string) and routes to message processor
   */
  private handleDataChannelMessage(event: MessageEvent) {
    let data: string;
    if (event.data instanceof Blob) {
      event.data.text().then(text => this.processMessage(text));
      return;
    } else if (event.data instanceof ArrayBuffer) {
      data = new TextDecoder().decode(event.data);
    } else {
      data = event.data;
    }
    
    this.processMessage(data);
  }

  /**
   * Process message and check if it's an API response
   * Handles chunked responses and resolves pending requests
   */
  private processMessage(message: string) {
    try {
      const parsed = JSON.parse(message) as WebRTCApiResponse;
      console.log("📨 Received message (processMessage method):", parsed);
      debugger;
      if (parsed.id) {
        const pendingRequest = this.pendingRequests.get(parsed.id);
        if (pendingRequest) {
          console.log('✅ Received response for request ID:', parsed.id, 'MessageType:', pendingRequest.messageType);
          
          if (parsed.isMultipart && parsed.response.totalChunks > 1) {
            this.handleChunkedResponse(parsed, pendingRequest);
          } else {
            this.validateAndCompleteResponse(parsed, pendingRequest);
          }
        } else {
          console.warn('⚠️ Received response for unknown request ID:', parsed.id);
        }
      } else {
        console.log('📨 DataChannel message (no ID):', message);
      }
    } catch (error) {
      console.log('📨 DataChannel message (not JSON):', message);
      
      if (this.pendingRequests.size > 0) {
        console.log('🔧 FAKE RESPONSE: Attempting to match message to pending request');
        
        let targetPendingRequest: PendingRequest | undefined;
        
        const requestEntries = Array.from(this.pendingRequests.entries());
        for (const [id, pendingRequest] of requestEntries) {
          if (message.toLowerCase().includes('folders') && pendingRequest.messageType.includes('getAvailableFolders')) {
            targetPendingRequest = pendingRequest;
            break;
          } else if (message.toLowerCase().includes('att') && pendingRequest.messageType.includes('getDocuments')) {
            targetPendingRequest = pendingRequest;
            break;
          } else if (message.toLowerCase().includes('dokument') && pendingRequest.messageType.includes('dokument')) {
            targetPendingRequest = pendingRequest;
            break;
          } else if (message.toLowerCase().includes('service') && pendingRequest.messageType.includes('service')) {
            targetPendingRequest = pendingRequest;
            break;
          } else if (message.toLowerCase().includes('favoriteakten') && pendingRequest.messageType.includes('getFavoriteAkten')) {
            targetPendingRequest = pendingRequest;
            break;
          } else if (message.toLowerCase().includes('favoritepersons') && pendingRequest.messageType.includes('getFavoritePersons')) {
            targetPendingRequest = pendingRequest;
            break;
          } else if (message.toLowerCase().startsWith('akten')) {
            targetPendingRequest = pendingRequest;
            break;
          }
        }
        
        if (!targetPendingRequest && this.pendingRequests.size > 0) {
          targetPendingRequest = this.pendingRequests.values().next().value;
        }
        
        if (targetPendingRequest) {
          let fakeResponse: WebRTCApiResponse;
          
          if (message.toLowerCase().includes('folders')) {
            const fakeBodyData = [
              "Korrespondenz",
              "Verträge", 
              "Gerichtsdokumente",
              "Recherche",
              "Klientenunterlagen"
            ];
            const fakeBodyString = JSON.stringify(fakeBodyData);
            const calculatedChecksum = calculateChecksum(fakeBodyString);
            
            fakeResponse = {
              id: targetPendingRequest.id,
              checksum: calculatedChecksum,
              isMultipart: false,
              response: {
                timestamp: Date.now(),
                totalChunks: 0,
                currentChunk: 0,
                statusCode: 200,
                headers: {},
                body: fakeBodyString
              }
            };
            
            console.log(`📋 Generated fake folders response with checksum: ${calculatedChecksum.substring(0, 8)}...`);
          } else if (message.toLowerCase().includes('att')) {
            fakeResponse = {
              id: targetPendingRequest.id,
              checksum: '',
              isMultipart: false,
              response: {
                timestamp: Date.now(),
                totalChunks: 0,
                currentChunk: 0,
                statusCode: 200,
                headers: {},
                body: JSON.stringify([
                  {
                    id: 5001,
                    aKurz: "FAKE-2024-001",
                    aktId: 12345,
                    datum: new Date('2024-01-15'),
                    betreff: "Sample Email Document",
                    dokumentArt: 1, // MailEmpfangen
                    mailAdresse: "client@example.com",
                    mailZeitpunkt: new Date('2024-01-15T10:30:00'),
                    anzahlMailAnhänge: 2,
                    anhangDateiNamen: "contract.pdf;invoice.xlsx",
                    sachbearbeiterKürzel: "JD",
                    dateipfad: "/documents/email_001.msg",
                    bearbeitungsInfoErstelltVon: "System",
                    bearbeitungsInfoErstelltAm: new Date('2024-01-15T10:35:00')
                  },
                  {
                    id: 5002,
                    aKurz: "FAKE-2024-001",
                    aktId: 12345,
                    datum: new Date('2024-01-15'),
                    betreff: "Email Tab Content - old.png",
                    dokumentArt: 0, // Keine (normal attachment)
                    anzahlMailAnhänge: 0,
                    sachbearbeiterKürzel: "JD",
                    dateipfad: "/documents/attachments/Email Tab Content - old.png",
                    bearbeitungsInfoErstelltVon: "System",
                    bearbeitungsInfoErstelltAm: new Date('2024-01-15T10:36:00')
                  }
                ])
              }
            };
          } else if (message.toLowerCase().includes('getdocuments')) {
            // Create fake documents response for GetDocuments
            fakeResponse = {
              id: targetPendingRequest.id,
              checksum: '',
              isMultipart: false,
              response: {
                timestamp: Date.now(),
                totalChunks: 0,
                currentChunk: 0,
                statusCode: 200,
                headers: {},
                body: JSON.stringify([
                  {
                    id: 6001,
                    aKurz: "FAKE-001",
                    aktId: 12345,
                    datum: new Date('2024-01-15'),
                    betreff: "Contract Draft v1.0",
                    dokumentArt: 0, // Normal document
                    dateipfad: "/Korrespondenz/Verträge/contract_draft_v1.docx",
                    sachbearbeiterKürzel: "JD",
                    bearbeitungsInfoErstelltVon: "System",
                    bearbeitungsInfoErstelltAm: new Date('2024-01-15T09:00:00')
                  },
                  {
                    id: 6002,
                    aKurz: "FAKE-001",
                    aktId: 12345,
                    datum: new Date('2024-01-16'),
                    betreff: "Meeting Notes - Initial Discussion",
                    dokumentArt: 0,
                    dateipfad: "/Korrespondenz/Notizen/meeting_notes_20240116.pdf",
                    sachbearbeiterKürzel: "JD",
                    bearbeitungsInfoErstelltVon: "System",
                    bearbeitungsInfoErstelltAm: new Date('2024-01-16T14:30:00')
                  },
                  {
                    id: 6003,
                    aKurz: "FAKE-001",
                    aktId: 12345,
                    datum: new Date('2024-01-17'),
                    betreff: "Legal Research Summary",
                    dokumentArt: 0,
                    dateipfad: "/Recherche/Rechtslage/legal_research_summary.pdf.pdf",
                    sachbearbeiterKürzel: "JD",
                    bearbeitungsInfoErstelltVon: "System",
                    bearbeitungsInfoErstelltAm: new Date('2024-01-17T11:15:00')
                  },
                  {
                    id: 6004,
                    aKurz: "FAKE-2024-001",
                    aktId: 12345,
                    datum: new Date('2024-01-18'),
                    betreff: "Client Email Response",
                    dokumentArt: 1, // MailEmpfangen
                    mailAdresse: "client@example.com",
                    mailZeitpunkt: new Date('2024-01-18T08:45:00'),
                    dateipfad: "/Korrespondenz/E-Mails/client_response_20240118.msg",
                    sachbearbeiterKürzel: "JD",
                    bearbeitungsInfoErstelltVon: "System",
                    bearbeitungsInfoErstelltAm: new Date('2024-01-18T08:50:00')
                  }
                ])
              }
            };
          } else if (message.toLowerCase().includes('service') || message.toLowerCase().includes('leistung')) {
            // Create fake Services response
            fakeResponse = {
              id: targetPendingRequest.id,
              checksum: '',
              isMultipart: false,
              response: {
                timestamp: Date.now(),
                totalChunks: 0,
                currentChunk: 0,
                statusCode: 200,
                headers: {},
                body: JSON.stringify([
                  {
                    Id: 1001,
                    Kürzel: "FAKE-2024-001",
                    Stufe1: "Consultation",
                    Stufe2: "Initial Meeting",
                    Stufe3: "Client Interview",
                    AnzeigenInQuicklisteOutlook: true
                  },
                  {
                    Id: 1002,
                    Kürzel: "FAKE-2024-001",
                    Stufe1: "Legal Research",
                    Stufe2: "Case Analysis",
                    Stufe3: "Document Review",
                    AnzeigenInQuicklisteOutlook: true
                  },
                  {
                    Id: 1003,
                    Kürzel: "FAKE-2024-001",
                    Stufe1: "Consultation",
                    Stufe2: "Follow-up Meeting",
                    Stufe3: "Strategy Discussion",
                    AnzeigenInQuicklisteOutlook: false
                  }
                ])
              }
            };
          } else if (message.toLowerCase().includes('addtofavorites') || message.toLowerCase().includes('addakt')) {
            // Create fake Add to Favorites response
            fakeResponse = {
              id: targetPendingRequest.id,
              checksum: '',
              isMultipart: false,
              response: {
                timestamp: Date.now(),
                totalChunks: 0,
                currentChunk: 0,
                statusCode: 200,
                headers: {},
                body: JSON.stringify({
                  success: true,
                  message: "Akt successfully added to favorites"
                })
              }
            };
          } else if (message.toLowerCase().includes('removefromfavorites') || message.toLowerCase().includes('removeakt')) {
            // Create fake Remove from Favorites response
            fakeResponse = {
              id: targetPendingRequest.id,
              checksum: '',
              isMultipart: false,
              response: {
                timestamp: Date.now(),
                totalChunks: 0,
                currentChunk: 0,
                statusCode: 200,
                headers: {},
                body: JSON.stringify({
                  success: true,
                  message: "Akt successfully removed from favorites"
                })
              }
            };
          } else if (message.toLowerCase().includes('favoriteakten') || (message.toLowerCase().includes('akten') && message.toLowerCase().includes('favoriten'))) {
            // Create fake favorite Akten response (AktenResponse format: Id, AKurz, Causa)
            fakeResponse = {
              id: targetPendingRequest.id,
              checksum: '',
              isMultipart: false,
              response: {
                timestamp: Date.now(),
                totalChunks: 0,
                currentChunk: 0,
                statusCode: 200,
                headers: {},
                body: JSON.stringify([
                  {
                    Id: 12345,
                    AKurz: "Akt1",
                    Causa: "Sample"
                  },
                  {
                    Id: 12346,
                    AKurz: "Akt2", 
                    Causa: "Favorite"
                  },
                  {
                    Id: 12347,
                    AKurz: "Akt3",
                    Causa: "Favorite case"
                  }
                ])
              }
            };
          } else if (message.toLowerCase().startsWith('person')) {
            // Create fake Person lookup response (PersonLookUpResponse format)
            fakeResponse = {
              id: targetPendingRequest.id,
              checksum: '',
              isMultipart: false,
              response: {
                timestamp: Date.now(),
                totalChunks: 0,
                currentChunk: 0,
                statusCode: 200,
                headers: {},
                body: JSON.stringify([
                  {
                    Id: 2001,
                    NKurz: `DEMO-P001`,
                    IstFirma: false,
                    Titel: 'Dr.',
                    Vorname: 'Max',
                    Name1: 'Mustermann',
                    Name2: undefined,
                    Adresse: {
                      straße: 'Musterstraße 123',
                      plz: '12345',
                      ort: 'Berlin',
                      landeskennzeichenIso2: 'DE'
                    },
                    Kontakte: [
                      { Reihung: 1, Art: 'Email', TelefonnummerOderAdresse: 'max.mustermann@example.com', Bemerkung: 'Primary' },
                      { Reihung: 2, Art: 'Telefon', TelefonnummerOderAdresse: '+49 30 12345678', Bemerkung: 'Mobile' }
                    ]
                  },
                  {
                    Id: 2002,
                    NKurz: `DEMO-P002`,
                    IstFirma: false,
                    Vorname: 'Anna',
                    Name1: 'Schmidt',
                    Adresse: {
                      straße: 'Beispielweg 456',
                      plz: '54321',
                      ort: 'München',
                      landeskennzeichenIso2: 'DE'
                    },
                    Kontakte: [
                      { Reihung: 1, Art: 'Email', TelefonnummerOderAdresse: 'anna.schmidt@example.com' },
                      { Reihung: 2, Art: 'Telefon', TelefonnummerOderAdresse: '+49 89 87654321' }
                    ]
                  }
                ])
              }
            };
          } else if (message.toLowerCase().includes('favoritepersons')) {
            // Create fake favorite persons response (PersonResponse format)
            fakeResponse = {
              id: targetPendingRequest.id,
              checksum: '',
              isMultipart: false,
              response: {
                timestamp: Date.now(),
                totalChunks: 0,
                currentChunk: 0,
                statusCode: 200,
                headers: {},
                body: JSON.stringify([
                  {
                    Id: 3001,
                    NKurz: 'FAV-P001',
                    IstFirma: false,
                    Titel: 'Dr.',
                    Vorname: 'Maria',
                    Name1: 'Favorit',
                    Name2: 'Client',
                    Adressdaten: {
                      straße: 'Hauptstraße 789',
                      plz: '10115',
                      ort: 'Berlin',
                      landeskennzeichenIso2: 'DE'
                    },
                    Kontakte: [
                      { Reihung: 1, Art: 'Email', TelefonnummerOderAdresse: 'maria.favorit@example.com', Bemerkung: 'Business' },
                      { Reihung: 2, Art: 'Telefon', TelefonnummerOderAdresse: '+49 30 55555555', Bemerkung: 'Office' }
                    ]
                  },
                  {
                    Id: 3002,
                    NKurz: 'FAV-P002',
                    IstFirma: true,
                    Name1: 'Musterfirma',
                    Name2: 'GmbH',
                    Adressdaten: {
                      straße: 'Geschäftsstraße 456',
                      plz: '20095',
                      ort: 'Hamburg',
                      landeskennzeichenIso2: 'DE'
                    },
                    Kontakte: [
                      { Reihung: 1, Art: 'Email', TelefonnummerOderAdresse: 'info@musterfirma.de', Bemerkung: 'Main' },
                      { Reihung: 2, Art: 'Telefon', TelefonnummerOderAdresse: '+49 40 66666666', Bemerkung: 'Reception' },
                      { Reihung: 3, Art: 'Website', TelefonnummerOderAdresse: 'https://www.musterfirma.de' }
                    ]
                  },
                  {
                    Id: 3003,
                    NKurz: 'FAV-P003',
                    IstFirma: false,
                    Vorname: 'Thomas',
                    Name1: 'Stammkunde',
                    Adressdaten: {
                      straße: 'Kundenweg 123',
                      plz: '80331',
                      ort: 'München',
                      landeskennzeichenIso2: 'DE'
                    },
                    Kontakte: [
                      { Reihung: 1, Art: 'Email', TelefonnummerOderAdresse: 'thomas.stammkunde@email.de' },
                      { Reihung: 2, Art: 'Telefon', TelefonnummerOderAdresse: '+49 89 77777777', Bemerkung: 'Mobile' }
                    ]
                  }
                ])
              }
            };
          } else {
            // Create fake Akten response (AktLookUpResponse format for search)
            fakeResponse = {
              id: targetPendingRequest.id,
              checksum: '',
              isMultipart: false,
              response: {
                timestamp: Date.now(),
                totalChunks: 0,
                currentChunk: 0,
                statusCode: 200,
                headers: {},
                body: JSON.stringify([
                  {
                    Id: 12348,
                    aKurz: "FAKE-2024-001",
                    causa: "Sample case triggered by: " + message
                  },
                  {
                    Id: 12349,
                    aKurz: "FAKE-2024-002",
                    causa: "Second test case - Contract review"
                  },
                  {
                    Id: 12350,
                    aKurz: "FAKE-2024-003",
                    causa: "Third test case - Legal dispute"
                  }
                ])
              }
            };
          }
          
          // Clear timeout
          clearTimeout(targetPendingRequest.timeoutHandle);
          
          // Remove from pending requests
          this.pendingRequests.delete(targetPendingRequest.id);
          
          // Send fake response to the resolve function
          targetPendingRequest.resolve(fakeResponse);
          console.log('📝 Pending requests after fake response:', this.pendingRequests.size);
        }
      }
    }
  }

  /**
   * Handle chunked response assembly
   * Assembles multi-part responses by collecting chunks and validating completeness
   */
  private handleChunkedResponse(chunk: WebRTCApiResponse, pendingRequest: PendingRequest) {
    const totalChunks = chunk.response.totalChunks;
    const currentChunk = chunk.response.currentChunk;
    
    console.log(`📦 Received chunk ${currentChunk}/${totalChunks} for request:`, pendingRequest.messageType);
    
    if (currentChunk < 1 || currentChunk > totalChunks) {
      console.error(`❌ Invalid chunk number ${currentChunk} (expected 1-${totalChunks}) for request:`, pendingRequest.messageType);
      this.handleChecksumFailure(pendingRequest);
      return;
    }
    
    if (!pendingRequest.expectedChunks) {
      pendingRequest.expectedChunks = totalChunks;
      pendingRequest.receivedChunks = new Map();
      
      clearTimeout(pendingRequest.timeoutHandle);
      pendingRequest.timeoutHandle = setTimeout(() => {
        this.handleChunkTimeout(pendingRequest);
      }, this.CHUNKING_CONFIG.retryTimeoutMs);
      
      console.log(`🔄 Expecting ${totalChunks} chunks for request:`, pendingRequest.messageType);
    } else if (pendingRequest.expectedChunks !== totalChunks) {
      console.error(`❌ Inconsistent totalChunks: expected ${pendingRequest.expectedChunks}, got ${totalChunks} for request:`, pendingRequest.messageType);
      this.handleChecksumFailure(pendingRequest);
      return;
    }
    
    if (pendingRequest.receivedChunks!.has(currentChunk)) {
      console.warn(`⚠️ Duplicate chunk ${currentChunk} received for request ${pendingRequest.messageType}, ignoring`);
      return;
    }
    
    // Store the chunk (order-independent storage)
    pendingRequest.receivedChunks!.set(currentChunk, chunk);
    
    const receivedCount = pendingRequest.receivedChunks!.size;
    console.log(`📊 Progress: ${receivedCount}/${totalChunks} chunks received for request:`, pendingRequest.messageType);
    
    if (receivedCount === totalChunks) {
      console.log('✅ All chunks received, assembling response for:', pendingRequest.messageType);
      this.assembleAndCompleteResponse(pendingRequest);
    }
  }

  /**
   * Re-send the original request for retry scenarios
   * Uses chunking system to reliably transmit the retry request
   */
  private async resendOriginalRequest(pendingRequest: PendingRequest): Promise<void> {
    if (!pendingRequest.originalRequest) {
      console.error(`❌ Cannot retry ${pendingRequest.messageType}: no original request stored`);
      this.completeRequest(pendingRequest, undefined, new Error('Cannot retry: original request not available'));
      return;
    }

    const dataChannel = this.sipClient?.peer2peer.getActiveDataChannel();
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.error(`❌ Cannot retry ${pendingRequest.messageType}: DataChannel not available`);
      this.completeRequest(pendingRequest, undefined, new Error('Cannot retry: DataChannel not available'));
      return;
    }

    try {
      console.log(`🔄 Re-sending original request for ${pendingRequest.messageType}`);
      
      await sendRequestWithChunking(pendingRequest.originalRequest, (chunk) => {
        const message = JSON.stringify(chunk);
        console.log(`📤 Re-sending chunk: Size ${new TextEncoder().encode(message).length} bytes`);
        dataChannel.send(message);
      });
      
      console.log(`✅ Successfully re-sent request for ${pendingRequest.messageType}`);
      
    } catch (error) {
      console.error(`❌ Failed to re-send request for ${pendingRequest.messageType}:`, error);
      this.completeRequest(pendingRequest, undefined, new Error(`Retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Handle chunk assembly timeout - retry the request
   * Implements exponential backoff with configurable retry limits
   */
  private handleChunkTimeout(pendingRequest: PendingRequest) {
    const retryCount = (pendingRequest.retryCount || 0) + 1;
    
    if (retryCount <= this.CHUNKING_CONFIG.maxRetries) {
      console.log(`⏰ Chunk assembly timeout for ${pendingRequest.messageType}, retrying (${retryCount}/${this.CHUNKING_CONFIG.maxRetries})`);
      
      // Reset chunking data for retry
      pendingRequest.expectedChunks = undefined;
      pendingRequest.receivedChunks = undefined;
      pendingRequest.retryCount = retryCount;
      
      // Clear existing timeout and set new timeout
      clearTimeout(pendingRequest.timeoutHandle);
      pendingRequest.timeoutHandle = setTimeout(() => {
        this.handleChunkTimeout(pendingRequest);
      }, this.CHUNKING_CONFIG.retryTimeoutMs);
      
      // Re-send the original request
      this.resendOriginalRequest(pendingRequest);
      
    } else {
      console.log(`❌ Max retries exceeded for ${pendingRequest.messageType}, failing request`);
      this.completeRequest(pendingRequest, undefined, new Error(`Chunk assembly timeout after ${retryCount} retries`));
    }
  }

  /**
   * Handle checksum failure - retry the request due to data corruption
   * Resets chunking state and attempts to resend the original request
   */
  private handleChecksumFailure(pendingRequest: PendingRequest) {
    const retryCount = (pendingRequest.retryCount || 0) + 1;
    
    if (retryCount <= this.CHUNKING_CONFIG.maxRetries) {
      console.log(`🔄 Checksum validation failed for ${pendingRequest.messageType}, retrying (${retryCount}/${this.CHUNKING_CONFIG.maxRetries})`);
      
      pendingRequest.expectedChunks = undefined;
      pendingRequest.receivedChunks = undefined;
      pendingRequest.retryCount = retryCount;
      
      clearTimeout(pendingRequest.timeoutHandle);
      pendingRequest.timeoutHandle = setTimeout(() => {
        this.handleChunkTimeout(pendingRequest);
      }, this.CHUNKING_CONFIG.retryTimeoutMs);
      
      this.resendOriginalRequest(pendingRequest);
      
    } else {
      console.log(`❌ Max retries exceeded for ${pendingRequest.messageType} due to checksum failures, failing request`);
      this.completeRequest(pendingRequest, undefined, new Error(`Checksum validation failed after ${retryCount} retries - data corruption detected`));
    }
  }

  /**
   * Validate checksum for single responses and complete the request
   * Performs integrity check and handles corruption by triggering retry
   */
  private validateAndCompleteResponse(response: WebRTCApiResponse, pendingRequest: PendingRequest) {
    const rawResponseBody = response.response.body || '';
    console.log(`📥 Processing single response for ${pendingRequest.messageType}`);
    
    // Decode base64 response body
    const decodedBody = this.decodeResponseBody(rawResponseBody, pendingRequest.messageType);
    
    const expectedChecksum = response.checksum;
    
    if (expectedChecksum) {
      // Calculate checksum using the original response object with base64-encoded body
      const actualChecksum = calculateChecksum(JSON.stringify(response.response));
      
      if (actualChecksum !== expectedChecksum) {
        console.error(`❌ Checksum mismatch for single response ${pendingRequest.messageType}`);
        console.error(`Expected: ${expectedChecksum}, Actual: ${actualChecksum}`);
        console.error(`Response object used for checksum:`, response.response);
        console.error(`Response corrupted during transmission, retrying...`);
        
        this.handleChecksumFailure(pendingRequest);
        return;
      }
      
      console.log(`✅ Checksum validation passed for single response ${pendingRequest.messageType}`);
    } else {
      console.log(`ℹ️ No checksum provided for ${pendingRequest.messageType}, skipping validation`);
    }
    
    // Create response with decoded body
    const processedResponse: WebRTCApiResponse = {
      ...response,
      response: {
        ...response.response,
        body: decodedBody
      }
    };
    
    this.completeRequest(pendingRequest, processedResponse);
  }

  /**
   * Assemble chunks into final response
   * Reconstructs complete response from ordered chunks with integrity validation
   */
  private assembleAndCompleteResponse(pendingRequest: PendingRequest) {
    const chunks = pendingRequest.receivedChunks!;
    const totalChunks = pendingRequest.expectedChunks!;
    
    const sortedChunks: WebRTCApiResponse[] = [];
    const chunkSequence: number[] = [];
    
    for (let i = 1; i <= totalChunks; i++) {
      const chunk = chunks.get(i);
      if (!chunk) {
        console.error(`❌ Missing chunk ${i} for request:`, pendingRequest.messageType);
        console.error(`❌ Available chunks: ${Array.from(chunks.keys()).sort((a, b) => a - b).join(', ')}`);
        this.completeRequest(pendingRequest, undefined, new Error(`Missing chunk ${i}/${totalChunks}`));
        return;
      }
      sortedChunks.push(chunk);
      chunkSequence.push(i);
    }
    
    console.log(`🔄 Assembling chunks in correct sequence: ${chunkSequence.join(' → ')} for request:`, pendingRequest.messageType);
    
    const assembledBody = sortedChunks.map(chunk => chunk.response.body || '').join('');
    console.log(`📥 Raw assembled body for ${pendingRequest.messageType} (length: ${assembledBody.length})`);
    
    // Decode base64 response body after assembly
    const decodedBody = this.decodeResponseBody(assembledBody, pendingRequest.messageType);
    
    const firstChunk = sortedChunks[0];
    
    // Create the complete response object with assembled base64 body for checksum calculation
    const assembledResponseForChecksum = {
      ...firstChunk.response,
      totalChunks: 0,     // Reset to 0 for assembled response
      currentChunk: 0,    // Reset to 0 for assembled response
      body: assembledBody  // Use base64-encoded assembled body for checksum
    };
    
    // Validate checksum to ensure data integrity (using entire response object with base64 body)
    const expectedChecksum = firstChunk.checksum;
    const actualChecksum = calculateChecksum(JSON.stringify(assembledResponseForChecksum));
    
    if (expectedChecksum && actualChecksum !== expectedChecksum) {
      console.error(`❌ Checksum mismatch for request ${pendingRequest.messageType}`);
      console.error(`Expected: ${expectedChecksum}, Actual: ${actualChecksum}`);
      console.error(`Response object used for checksum:`, assembledResponseForChecksum);
      console.error(`Response corrupted during transmission, retrying...`);
      
      // Treat as corruption and retry the request
      this.handleChecksumFailure(pendingRequest);
      return;
    }
    
    console.log(`✅ Checksum validation passed for ${pendingRequest.messageType}`);
    
    const finalResponse: WebRTCApiResponse = {
      ...firstChunk,
      isMultipart: false, // Mark as assembled
      response: {
        ...firstChunk.response,
        totalChunks: 0,
        currentChunk: 0,
        body: decodedBody
      }
    };

    console.log(`✅ Response assembled from ${totalChunks} chunks, final decoded size: ${decodedBody.length} chars`);
    this.completeRequest(pendingRequest, finalResponse);
  }

  /**
   * Complete a request (success or failure)
   */
  private completeRequest(pendingRequest: PendingRequest, response?: WebRTCApiResponse, error?: Error) {
    // Clear timeout
    clearTimeout(pendingRequest.timeoutHandle);
    
    // Remove from pending requests
    this.pendingRequests.delete(pendingRequest.id);
    
    console.log('📝 Pending requests after completion:', this.pendingRequests.size);
    
    if (error) {
      pendingRequest.reject(error);
    } else if (response) {
      pendingRequest.resolve(response);
    } else {
      pendingRequest.reject(new Error('Request completed without response or error'));
    }
  }

  /**
   * Send API request through WebRTC DataChannel with fire-and-forget pattern
   * @param messageType - Message type in format "sliceName.actionName"
   * @param method - HTTP method
   * @param url - Request URL
   * @param headers - Request headers
   * @param body - Request body (optional)
   * @returns Promise with API response
   */
  private async sendRequest(messageType: string, method: string, url: string, headers: Record<string, string>, body?: any): Promise<WebRTCApiResponse> {
    return new Promise(async (resolve, reject) => {
      if (!this.sipClient) {
        reject(new Error('WebRTC API service not initialized'));
        return;
      }

      const dataChannel = this.sipClient.peer2peer.getActiveDataChannel();
      
      if (!dataChannel || dataChannel.readyState !== 'open') {
        reject(new Error('WebRTC data channel is not available'));
        return;
      }

      // Check if there's already a pending request of the same type
      const existingRequestId = this.findPendingRequestByMessageType(messageType);
      if (existingRequestId) {
        const existingRequest = this.pendingRequests.get(existingRequestId);
        if (existingRequest) {
          console.log('🔄 Request already pending for messageType:', messageType, '- waiting for existing request');
          // Wait for the existing request instead of creating a new one
          existingRequest.resolve = resolve;
          existingRequest.reject = reject;
          return;
        }
      }

      // Create headers with automatic authorization
      const requestHeaders = this.createRequestHeaders(headers, messageType);

      // Create full protocol request
      const protocolRequest = createProtocolRequest(method, url, requestHeaders, body);
      console.log('📝 Created protocol request:', protocolRequest);
      
      // Add messageType to the request
      const requestWithMessageType = {
        ...protocolRequest,
        messageType: messageType
      };

      // Create pending request object
      const pendingRequest: PendingRequest = {
        id: protocolRequest.id,
        messageType: messageType,
        timestamp: Date.now(),
        timeoutHandle: setTimeout(() => {
          // Remove from pending requests on timeout
          this.pendingRequests.delete(protocolRequest.id);
          console.log('⏰ Request timeout for messageType:', messageType);
          console.log('📝 Pending requests after timeout:', this.pendingRequests.size);
          reject(new Error(`Request timeout - no response from remote for ${messageType}`));
        }, this.REQUEST_TIMEOUT),
        resolve: resolve,
        reject: reject,
        originalRequest: protocolRequest  // Store original request for retries
      };

      // Store pending request
      this.pendingRequests.set(protocolRequest.id, pendingRequest);
      
      console.log('📤 Preparing request for messageType:', messageType);
      console.log('📝 Pending requests after new request added:', this.pendingRequests.size);

      try {
        // Use generic chunking system to send the request
        await sendRequestWithChunking(requestWithMessageType, (chunk) => {
          const message = JSON.stringify(chunk);
          console.log(`📤 Sending chunk: Size ${new TextEncoder().encode(message).length} bytes`);
          dataChannel.send(message);
        });
        
      } catch (error) {
        // Clean up on send error
        const pendingReq = this.pendingRequests.get(protocolRequest.id);
        if (pendingReq) {
          clearTimeout(pendingReq.timeoutHandle);
          this.pendingRequests.delete(protocolRequest.id);
        }
        console.log('📝 Pending requests after error:', this.pendingRequests.size);
        reject(error);
      }
    });
  }

  /**
   * Find pending request by message type
   */
  private findPendingRequestByMessageType(messageType: string): string | undefined {
    const requestEntries = Array.from(this.pendingRequests.entries());
    for (const [id, request] of requestEntries) {
      if (request.messageType === messageType) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * Check if there are any pending requests (for loading state)
   * @returns True if there are pending requests
   */
  hasPendingRequests(): boolean {
    return this.pendingRequests.size > 0;
  }

  /**
   * Check if there's a pending request for a specific message type
   * @param messageType - Message type to check
   * @returns True if there's a pending request for this message type
   */
  hasPendingRequest(messageType: string): boolean {
    return this.findPendingRequestByMessageType(messageType) !== undefined;
  }

  /**
   * Get the number of pending requests
   * @returns Number of pending requests
   */
  getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Get favorite Akten (Cases) via WebRTC
   * @param query - Search parameters with NurFavoriten=true
  /**
   * Get favorite Akten with filtering options
   * @param query - Filter parameters for Akten search
   * @returns Promise resolving to Akten list matching the criteria
   */
  async getFavoriteAkten(query: AktenQuery) {
    const queryParams = new URLSearchParams();
    
    if (query.AktId !== undefined) queryParams.append('AktId', query.AktId.toString());
    if (query.AKurzLike) queryParams.append('AKurzLike', query.AKurzLike);
    if (query.Count) queryParams.append('Count', query.Count.toString());
    if (query.NurFavoriten !== undefined) queryParams.append('NurFavoriten', query.NurFavoriten.toString());

    return this.sendRequest(
      'akten.getFavoriteAkten',
      'GET',
      `api/v1.1/akten?${queryParams.toString()}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Akt Lookup - search in different fields via WebRTC
   * @param searchText - Text to search for in different fields
   * @returns Promise resolving to matching Akten entries
   */
  async aktLookUp(searchText: string) {
    const queryParams = new URLSearchParams();
    queryParams.append('searchText', searchText);

    return this.sendRequest(
      'akten.aktLookUp',
      'GET',
      `api/v1.1/akten/LookUp?${queryParams.toString()}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Add Akt to favorites
   * @param aktId - The ID of the Akt to add to favorites
   */
  async addAktToFavorite(aktId: number) {
    return this.sendRequest(
      'akten.addAktToFavorite',
      'POST',
      `api/v1.1/akten/AddToFavorites/${aktId}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Remove Akt from favorites
   * @param aktId - The ID of the Akt to remove from favorites
   * @returns Promise resolving when the removal is complete
   */
  async removeAktFromFavorite(aktId: number) {
    return this.sendRequest(
      'akten.removeAktFromFavorite',
      'DELETE',
      `api/v1.1/akten/RemoveFromFavorites/${aktId}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Load Services for a specific Akt via WebRTC
   * @param query - Search parameters for services
   * @returns Promise resolving to available services for the Akt
   */
  async loadServices(query: LeistungenAuswahlQuery) {
    const queryParams = new URLSearchParams();
    
    if (query.Kürzel) queryParams.append('Kürzel', query.Kürzel);
    if (query.OnlyQuickListe !== undefined) queryParams.append('OnlyQuickListe', query.OnlyQuickListe.toString());
    if (query.Limit) queryParams.append('Limit', query.Limit.toString());

    return this.sendRequest(
      'service.loadServices',
      'GET',
      `api/v1.1/services/Aswahl?${queryParams.toString()}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Save a new Leistung via WebRTC
   * @param leistungData - Data for the new Leistung
   */
  async saveLeistung(leistungData: LeistungPostData) {
    return this.sendRequest(
      'service.saveLeistung',
      'POST',
      'api/v1.1/leistung',
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      leistungData
    );
  }

  /**
   * Save a new document via WebRTC with automatic chunking for large content
   * @param dokumentData - Data for the new document
   */
  async saveDokument(dokumentData: DokumentPostData) {
    // The generic sendRequest method now handles all chunking automatically
    // No need for document-specific chunking logic
    return this.sendRequest(
      'dokument.saveDokument',
      'POST', 
      'api/v1.1/dokument', 
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }, 
      dokumentData
    );
  }

  /**
   * Get available folders for a case via WebRTC
   * @param aktId - The case ID to get folders for
   */
  async getAvailableFolders(aktId: number) {
    return this.sendRequest(
      'dokument.getAvailableFolders',
      'GET',
      `api/v1.1/folders/${aktId}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Get documents via WebRTC with flexible query parameters
   * @param query - Query parameters including aktId, outlookEmailId, dokumentArten, and limit
   */
  async GetDocuments(query: DokumenteQuery) {
    const queryParams = new URLSearchParams();
    
    if (query.aktId) queryParams.append('aktId', query.aktId.toString());
    if (query.outlookEmailId) queryParams.append('outlookEmailId', query.outlookEmailId);
    if (query.dokumentArten && query.dokumentArten.length > 0) {
      query.dokumentArten.forEach(art => queryParams.append('dokumentArten', art.toString()));
    }
    if (query.Count) queryParams.append('Count', query.Count.toString());

    return this.sendRequest(
      'dokument.getDocuments',
      'GET',
      `api/v1.1/dokument?${queryParams.toString()}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  // ===== PERSON API METHODS =====

  /**
   * Get favorite persons via WebRTC
   * @param query - Search parameters with NurFavoriten=true
   */
  async getFavoritePersons(query: PersonenQuery) {
    const queryParams = new URLSearchParams();
    
    if (query.NKurzLike) queryParams.append('NKurzLike', query.NKurzLike);
    if (query.Name1Like) queryParams.append('Name1Like', query.Name1Like);
    if (query.Count) queryParams.append('Count', query.Count.toString());
    if (query.NurFavoriten !== undefined) queryParams.append('NurFavoriten', query.NurFavoriten.toString());

    return this.sendRequest(
      'person.getFavoritePersons',
      'GET',
      `api/person?${queryParams.toString()}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Person Lookup - search in different fields via WebRTC
   * @param searchText - Text to search for in different fields
   */
  async personLookUp(searchText: string) {
    const queryParams = new URLSearchParams();
    queryParams.append('searchText', searchText);

    return this.sendRequest(
      'person.personLookUp',
      'GET',
      `api/person/Lookup?${queryParams.toString()}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Add person to favorites via WebRTC
   */
  async addPersonToFavorites(personId: number) {
    return this.sendRequest(
      'person.addPersonToFavorites',
      'POST',
      `api/person/AddToFavorites/${personId}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Remove person from favorites via WebRTC
   */
  async removePersonFromFavorites(personId: number) {
    return this.sendRequest(
      'person.removePersonFromFavorites',
      'DELETE',
      `api/person/RemoveFromFavorites/${personId}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Authenticate with API through WebRTC
   * This should be the first call made to establish authentication with the remote API
   * @param authRequest - Authentication request containing credentials
   * @returns Promise with authentication response containing token and expiration
   */
  async authenticate(authRequest: IAuthRequest): Promise<IAuthResponse> {
    console.log('🔐 Starting authentication via WebRTC...');
    console.log('🔐 Authentication request:', authRequest);
    
    // Create form data for authentication
    const formData = this.createFormData(authRequest);
    
    const response = await this.sendRequest(
      'auth.authenticate',
      'POST',
      'connect/token',
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      formData
    );

    console.log('🔐 Authentication response received');
    
    // Parse the response body to get authentication details
    if (response.response?.body && typeof response.response.body === 'string') {
      try {
        const authData = JSON.parse(response.response.body) as IAuthResponse;
        console.log('✅ Authentication successful - token received');
        return authData;
      } catch (error) {
        console.error('❌ Failed to parse authentication response:', error);
        throw new Error('Invalid authentication response format');
      }
    } else if (response.response?.body && typeof response.response.body === 'object') {
      // Response body is already an object
      console.log('✅ Authentication successful - token received');
      return response.response.body as IAuthResponse;
    } else {
      console.error('❌ Authentication failed - no token in response');
      throw new Error('Authentication failed - no token received');
    }
  }

  /**
   * Refresh authentication token
   * @param refreshToken - Refresh token from previous authentication
   * @returns Promise with new authentication response
   */
  async refreshToken(refreshToken: string): Promise<IAuthResponse> {
    console.log('🔄 Refreshing authentication token via WebRTC...');
    
    const refreshRequest: IAuthRequest = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: 'advokat.client.web'
    };

    return this.authenticate(refreshRequest);
  }

  /**
   * Check if WebRTC connection is ready for API calls
   * @returns True if data channel is open and ready for communication
   */
  isReady(): boolean {
    const dataChannel = this.sipClient?.peer2peer.getActiveDataChannel();
    return dataChannel?.readyState === 'open' || false;
  }
}

// Export singleton instance
export const webRTCApiService = new WebRTCApiService();
