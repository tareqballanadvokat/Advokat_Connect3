// WebRTC API Communication Service - Integrates with SIP_Library
import { v4 as uuidv4 } from 'uuid';
import { AktenQuery } from '../components/interfaces/IAkten';
import { WebRTCApiRequest, WebRTCApiResponse } from '../components/interfaces/IWebRTC';
import { LeistungenAuswahlQuery, LeistungPostData } from '../components/interfaces/IService';
import { DokumentPostData, DokumentResponse, DokumenteQuery } from '../components/interfaces/IDocument';
import { PersonenQuery, PersonResponse, PersonLookUpResponse } from '../components/interfaces/IPerson';
import { SipClientInstance } from '../components/SIP_Library/SipClient';
import { 
  CHUNKING_CONFIG,
  calculateMessageSize,
  calculateOverheadSize,
  calculateMaxContentPerChunk,
  splitDocumentContent,
  needsChunking,
  createChunkDelay,
  generateGuid,
  logChunkingInfo,
  logChunkTransmission,
  calculateChecksum,
  createProtocolId,
  createProtocolRequest
} from '../utils/chunkingUtils';

/**
 * API Communication Service using WebRTC DataChannel
 * Leverages existing SIP_Library for WebRTC connection management
 */
class WebRTCApiService {
  private sipClient: SipClientInstance | null = null;
  private pendingRequestHandlers: Map<string, (response: WebRTCApiResponse) => void> = new Map();

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
   */
  private setupDataChannelListener() {
    if (!this.sipClient) return;
    // Monitor data channel availability and register message handler
    const checkDataChannel = () => {
      const dataChannel = this.sipClient?.peer2peer.getActiveDataChannel();
      if (dataChannel && dataChannel.readyState === 'open') {
        // Register our message handler with the Peer2PeerConnection
        this.sipClient.peer2peer.addMessageHandler((event) => {
          this.handleDataChannelMessage(event);
        });
      } else {
        // Retry checking for data channel
        setTimeout(checkDataChannel, 1000);
      }
    };

    checkDataChannel();
  }

  /**
   * Handle incoming messages from DataChannel
   * Distinguishes between API responses and other messages
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
   */
  private processMessage(message: string) {
    try {
      const parsed = JSON.parse(message);
      console.log("parsed maessage: ", parsed);
      
      throw new Error('Test error to check debugger');
      // Check if this is an API response with Id field and we have a matching pending request
      if (parsed.Id && this.pendingRequestHandlers.has(parsed.Id)) {
        console.log('✅ Received response for request ID:', parsed.Id);
        const handler = this.pendingRequestHandlers.get(parsed.Id);
        if (handler) {
          handler(parsed);
          this.pendingRequestHandlers.delete(parsed.Id);
          console.log('📝 Pending requests after response:', this.pendingRequestHandlers.size);
        }
      } else if (parsed.Id) {
        // Response with ID but no matching pending request
        console.warn('⚠️ Received response for unknown request ID:', parsed.Id);
      } else {
        // Regular message without ID - log it
        console.log('📨 DataChannel message (no ID):', message);
      }
    } catch (error) {
      // Not JSON - could be a string response, try to match to pending requests
      console.log('📨 DataChannel message (not JSON):', message);
      
      // For testing/fake responses: if we have pending requests, try to match based on message content
      if (this.pendingRequestHandlers.size > 0) {
        console.log('🔧 FAKE RESPONSE: Attempting to match message to pending request');
        
        // Get the first pending request (this is still fallback behavior for testing)
        const [requestId, handler] = this.pendingRequestHandlers.entries().next().value;
        
        let fakeResponse: WebRTCApiResponse;
        
        // Determine response type based on the message content
        if (message.toLowerCase().includes('folders')) {
          // Create fake Folders response - return array of folder names as strings
          fakeResponse = {
            id: requestId,
            checksum: '',
            response: {
              timestamp: Date.now(),
              statusCode: 200,
              headers: {},
              body: JSON.stringify([
                "Korrespondenz",
                "Verträge", 
                "Gerichtsdokumente",
                "Recherche",
                "Klientenunterlagen"
              ])
            }
          };
        } else if (message.toLowerCase().includes('att')) {
          // Create fake Documents/Attachments response
          fakeResponse = {
            id: requestId,
            checksum: '',
            response: {
              timestamp: Date.now(),
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
        } else if (message.toLowerCase().includes('dokument') || message.toLowerCase().includes('getdocuments')) {
          // Create fake documents response for GetDocuments
          fakeResponse = {
            id: requestId,
            checksum: '',
            response: {
              timestamp: Date.now(),
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
            id: requestId,
            checksum: '',
            response: {
              timestamp: Date.now(),
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
            id: requestId,
            checksum: '',
            response: {
              timestamp: Date.now(),
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
            id: requestId,
            checksum: '',
            response: {
              timestamp: Date.now(),
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
            id: requestId,
            checksum: '',
            response: {
              timestamp: Date.now(),
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
            id: requestId,
            checksum: '',
            response: {
              timestamp: Date.now(),
              statusCode: 200,
              headers: {},
              body: JSON.stringify([
                {
                  PersonId: 2001,
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
                  PersonId: 2002,
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
            id: requestId,
            checksum: '',
            response: {
              timestamp: Date.now(),
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
            id: requestId,
            checksum: '',
            response: {
              timestamp: Date.now(),
              statusCode: 200,
              headers: {},
              body: JSON.stringify([
                {
                  aktId: 12348,
                  aKurz: "FAKE-2024-001",
                  causa: "Sample case triggered by: " + message
                },
                {
                  aktId: 12349,
                  aKurz: "FAKE-2024-002",
                  causa: "Second test case - Contract review"
                },
                {
                  aktId: 12350,
                  aKurz: "FAKE-2024-003",
                  causa: "Third test case - Legal dispute"
                }
              ])
            }
          };
        }
        
        // Send fake response to the handler
        handler(fakeResponse);
        this.pendingRequestHandlers.delete(requestId);
        console.log('📝 Pending requests after fake response:', this.pendingRequestHandlers.size);
      }
    }
  }
  /**
   * Send API request through WebRTC DataChannel
   * @param method - HTTP method
   * @param url - Request URL
   * @param headers - Request headers
   * @param body - Request body (optional)
   * @returns Promise with API response
   */
  private async sendRequest(method: string, url: string, headers: Record<string, string>, body?: any): Promise<WebRTCApiResponse> {
    return new Promise((resolve, reject) => {
      if (!this.sipClient) {
        reject(new Error('WebRTC API service not initialized'));
        return;
      }

      const dataChannel = this.sipClient.peer2peer.getActiveDataChannel();
      
      if (!dataChannel || dataChannel.readyState !== 'open') {
        reject(new Error('WebRTC data channel is not available'));
        return;
      }

      // Create full protocol request
      const protocolRequest = createProtocolRequest(method, url, headers, body);

      // Set up response handler
      this.pendingRequestHandlers.set(protocolRequest.id, (response: WebRTCApiResponse) => {
        resolve(response);
      });
      console.log('📝 Pending requests after new request added:', this.pendingRequestHandlers.size);

      // Set timeout to clean up handler if no response
      setTimeout(() => {
        if (this.pendingRequestHandlers.has(protocolRequest.id)) {
          this.pendingRequestHandlers.delete(protocolRequest.id);
          console.log('📝 Pending requests after timeout:', this.pendingRequestHandlers.size);
          reject(new Error('Request timeout - no response from remote'));
        }
      }, 60000);

      try {
        const message = JSON.stringify(protocolRequest);
        console.log('📤 Sending API request:', `Size: ${new TextEncoder().encode(message).length} bytes`);
        dataChannel.send(message);
      } catch (error) {
        this.pendingRequestHandlers.delete(protocolRequest.id);
        console.log('📝 Pending requests after error:', this.pendingRequestHandlers.size);
        reject(error);
      }
    });
  }

  /**
   * Get favorite Akten (Cases) via WebRTC
   * @param query - Search parameters with NurFavoriten=true
   */
  async getFavoriteAkten(query: AktenQuery) {
    const queryParams = new URLSearchParams();
    
    if (query.AktId !== undefined) queryParams.append('AktId', query.AktId.toString());
    if (query.AKurzLike) queryParams.append('AKurzLike', query.AKurzLike);
    if (query.Count) queryParams.append('Count', query.Count.toString());
    if (query.NurFavoriten !== undefined) queryParams.append('NurFavoriten', query.NurFavoriten.toString());
    if (query.Causa !== undefined) queryParams.append('Causa', query.Causa.toString());

    return this.sendRequest(
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
   */
  async aktLookUp(searchText: string) {
    const queryParams = new URLSearchParams();
    queryParams.append('searchText', searchText);

    return this.sendRequest(
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
   */
  async removeAktFromFavorite(aktId: number) {
    return this.sendRequest(
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
   */
  async loadServices(query: LeistungenAuswahlQuery) {
    const queryParams = new URLSearchParams();
    
    if (query.Kürzel) queryParams.append('Kürzel', query.Kürzel);
    if (query.OnlyQuickListe !== undefined) queryParams.append('OnlyQuickListe', query.OnlyQuickListe.toString());
    if (query.Limit) queryParams.append('Limit', query.Limit.toString());

    return this.sendRequest(
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
   * Helper to create document WebRTCApiRequest for chunking utilities
   * @param dokumentData - Document data to save
   */
  private createDokumentRequest(dokumentData: DokumentPostData): WebRTCApiRequest {
    return createProtocolRequest(
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
   * Save a new document via WebRTC with automatic chunking for large content
   * @param dokumentData - Data for the new document
   */
  async saveDokument(dokumentData: DokumentPostData) {
    // Create the request and check if chunking is needed
    const protocolRequest = this.createDokumentRequest(dokumentData);
    
    if (!needsChunking(protocolRequest)) {
      // Small document, send normally
      const totalSize = calculateMessageSize(protocolRequest);
      logChunkingInfo({
        totalSize,
        overheadSize: 0,
        maxContentPerChunk: 0,
        totalChunks: 1,
        action: 'single'
      });
      return this.sendRequest('POST', 'api/v1.1/dokument', {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }, dokumentData);
    }
    
    // Large document, split into chunks
    const totalSize = calculateMessageSize(protocolRequest);
    
    // Calculate overhead size (all fields except 'inhalt')
    const documentWithoutContent = { ...dokumentData, inhalt: '' };
    const overheadSize = calculateOverheadSize(documentWithoutContent, this.createDokumentRequest.bind(this));
    
    // Calculate max content size per chunk
    const maxContentPerChunk = calculateMaxContentPerChunk(overheadSize);
    
    const chunkingResult = splitDocumentContent(dokumentData.inhalt || '', maxContentPerChunk);
    
    logChunkingInfo({
      totalSize,
      overheadSize,
      maxContentPerChunk,
      totalChunks: chunkingResult.totalChunks,
      action: 'chunked'
    });
    
    // Send each chunk as a separate document request
    const responses = [];
    for (let i = 0; i < chunkingResult.chunks.length; i++) {
      const chunkData: DokumentPostData = {
        ...dokumentData,
        inhalt: chunkingResult.chunks[i],
        numberOfParts: chunkingResult.totalChunks,
        partNumber: i + 1,
        checkSum: chunkingResult.checkSum
      };
      
      logChunkTransmission(i + 1, chunkingResult.totalChunks);
      
      try {
        const response = await this.sendRequest('POST', 'api/v1.1/dokument', {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }, chunkData);
        responses.push(response);
        
        // Small delay between chunks
        if (i < chunkingResult.chunks.length - 1) {
          await createChunkDelay();
        }
      } catch (error) {
        console.error(`❌ Failed to send chunk ${i + 1}/${chunkingResult.totalChunks}:`, error);
        throw error;
      }
    }
    
    // Return the response from the last chunk (API will handle reassembly)
    return responses[responses.length - 1];
  }

  /**
   * Get available folders for a case via WebRTC
   * @param aktId - The case ID to get folders for
   */
  async getAvailableFolders(aktId: number) {
    return this.sendRequest(
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
    if (query.limit) queryParams.append('limit', query.limit.toString());

    return this.sendRequest(
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
      'DELETE',
      `api/person/RemoveFromFavorites/${personId}`,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );
  }

  /**
   * Check if WebRTC connection is ready for API calls
   */
  isReady(): boolean {
    const dataChannel = this.sipClient?.peer2peer.getActiveDataChannel();
    return dataChannel?.readyState === 'open' || false;
  }
}

// Export singleton instance
export const webRTCApiService = new WebRTCApiService();
