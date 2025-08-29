// WebRTC API Communication Service - Integrates with SIP_Library
import { v4 as uuidv4 } from 'uuid';
import { WebRTCApiRequest, WebRTCApiResponse, AktenQuery } from '../components/interfaces/IAkten';
import { LeistungenAuswahlQuery, LeistungPostData } from '../components/interfaces/IService';
import { DokumentPostData } from '../components/interfaces/IEmail';
import { DokumentResponse, DokumenteQuery } from '../components/interfaces/IDocument';
import { PersonenQuery, PersonResponse } from '../components/interfaces/IPerson';
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
  logChunkTransmission
} from '../utils/chunkingUtils';

/**
 * API Communication Service using WebRTC DataChannel
 * Leverages existing SIP_Library for WebRTC connection management
 */
class WebRTCApiService {
  private sipClient: SipClientInstance | null = null;
  private responseHandlers: Map<string, (response: WebRTCApiResponse) => void> = new Map();

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
      
      // Check if this is an API response with Id field
      if (parsed.Id && this.responseHandlers.has(parsed.Id)) {
        const handler = this.responseHandlers.get(parsed.Id);
        if (handler) {
          handler(parsed);
          this.responseHandlers.delete(parsed.Id);
        }
      } else {
        // Regular message - log it
        console.log('📨 DataChannel message:', message);
      }
    } catch (error) {
      
      // Not JSON - treat as regular message and send fake response to any pending request
      console.log('📨 DataChannel message (not JSON):', message);
      
      // If we have any pending requests, send a fake response to the first one
      if (this.responseHandlers.size > 0) {
        console.log('🔧 FAKE RESPONSE: Sending fake data for pending request');
        
        // Get the first pending request
        const [requestId, handler] = this.responseHandlers.entries().next().value;
        
        let fakeResponse: WebRTCApiResponse;
        
        // Determine response type based on the message content
        if (message.toLowerCase().includes('folders')) {
          // Create fake Folders response - return array of folder names as strings
          fakeResponse = {
            Id: requestId,
            Timestamp: Date.now(),
            statusCode: 200,
            data: [
              "Korrespondenz",
              "Verträge", 
              "Gerichtsdokumente",
              "Recherche",
              "Klientenunterlagen"
            ]
          };
        } else if (message.toLowerCase().includes('att')) {
          // Create fake Documents/Attachments response
          fakeResponse = {
            Id: requestId,
            Timestamp: Date.now(),
            statusCode: 200,
            data: [
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
            ]
          };
        } else if (message.toLowerCase().includes('service') || message.toLowerCase().includes('leistung')) {
          // Create fake Services response
          fakeResponse = {
            Id: requestId,
            Timestamp: Date.now(),
            statusCode: 200,
            data: [
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
            ]
          };
        } else {
          // Create fake Akten response
          fakeResponse = {
            Id: requestId,
            Timestamp: Date.now(),
            statusCode: 200,
            data: [
              {
                aktId: 12345,
                aKurz: "FAKE-2024-001",
                causa: "Sample case triggered by: " + message
              },
              {
                aktId: 12346,
                aKurz: "FAKE-2024-002", 
                causa: "Another test case - Contract review"
              },
              {
                aktId: 12347,
                aKurz: "FAKE-2024-003",
                causa: "Third test case - Legal dispute"
              }
            ]
          };
        }
        
        // Send fake response to the handler
        handler(fakeResponse);
        this.responseHandlers.delete(requestId);
      }
    }
  }

  /**
   * Send API request through WebRTC DataChannel
   * @param request - The API request to send
   * @returns Promise with API response
   */
  private async sendRequest<T>(request: WebRTCApiRequest): Promise<WebRTCApiResponse<T>> {
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

      const requestId = generateGuid();
      const requestWithId = { 
        Id: requestId,
        Timestamp: Date.now(),
        ...request
      };

      // Set up response handler
      this.responseHandlers.set(requestId, (response: WebRTCApiResponse<T>) => {
        resolve(response);
      });

      // Set timeout to clean up handler if no response
      setTimeout(() => {
        if (this.responseHandlers.has(requestId)) {
          this.responseHandlers.delete(requestId);
          reject(new Error('Request timeout - no response from remote'));
        }
      }, 60000);

      try {
        const message = JSON.stringify(requestWithId);
        console.log('📤 Sending API request:', `Size: ${new TextEncoder().encode(message).length} bytes`);
        dataChannel.send(message);
      } catch (error) {
        this.responseHandlers.delete(requestId);
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

    const request: WebRTCApiRequest = {
      method: 'GET',
      url: `api/v1.1/akten?${queryParams.toString()}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    return this.sendRequest(request);
  }

  /**
   * Akt Lookup - search in different fields via WebRTC
   * @param searchText - Text to search for in different fields
   */
  async aktLookUp(searchText: string) {
    const queryParams = new URLSearchParams();
    queryParams.append('searchText', searchText);

    const request: WebRTCApiRequest = {
      method: 'GET',
      url: `api/v1.1/akten/LookUp?${queryParams.toString()}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    return this.sendRequest(request);
  }

  /**
   * Add Akt to favorites
   * @param aktId - The ID of the Akt to add to favorites
   */
  async addAktToFavorite(aktId: number) {
    const request: WebRTCApiRequest = {
      method: 'POST',
      url: `api/v1.1/akten/AddToFavorites/${aktId}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    return this.sendRequest(request);
  }

  /**
   * Remove Akt from favorites
   * @param aktId - The ID of the Akt to remove from favorites
   */
  async removeAktFromFavorite(aktId: number) {
    const request: WebRTCApiRequest = {
      method: 'DELETE',
      url: `api/v1.1/akten/RemoveFromFavorites/${aktId}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    return this.sendRequest(request);
  }

  /**
   * Create HTTP request object for Services lookup
   * @param query - Search parameters for services
   */
  private createServicesLookupRequest(query: LeistungenAuswahlQuery): WebRTCApiRequest {
    const queryParams = new URLSearchParams();
    
    if (query.Kürzel) queryParams.append('Kürzel', query.Kürzel);
    if (query.OnlyQuickListe !== undefined) queryParams.append('OnlyQuickListe', query.OnlyQuickListe.toString());
    if (query.Limit) queryParams.append('Limit', query.Limit.toString());

    return {
      method: 'GET',
      url: `api/v1.1/services/Aswahl?${queryParams.toString()}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
  }

  /**
   * Load Services for a specific Akt via WebRTC
   * @param query - Search parameters for services
   */
  async loadServices(query: LeistungenAuswahlQuery) {
    const request = this.createServicesLookupRequest(query);
    return this.sendRequest(request);
  }

  /**
   * Create HTTP request object for posting a new Leistung
   * @param leistungData - Data for the new Leistung
   */
  private createLeistungPostRequest(leistungData: LeistungPostData): WebRTCApiRequest {
    return {
      method: 'POST',
      url: 'api/v1.1/leistung',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: leistungData
    };
  }

  /**
   * Save a new Leistung via WebRTC
   * @param leistungData - Data for the new Leistung
   */
  async saveLeistung(leistungData: LeistungPostData) {
    const request = this.createLeistungPostRequest(leistungData);
    return this.sendRequest(request);
  }

  /**
   * Create HTTP request object for saving documents
   * @param dokumentData - Document data to save
   */
  private createDokumentPostRequest(dokumentData: DokumentPostData): WebRTCApiRequest {
    return {
      method: 'POST',
      url: 'api/v1.1/dokument',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: dokumentData
    };
  }

  /**
   * Save a new document via WebRTC with automatic chunking for large content
   * @param dokumentData - Data for the new document
   */
  async saveDokument(dokumentData: DokumentPostData) {
    // Create the request and check if chunking is needed
    const request = this.createDokumentPostRequest(dokumentData);
    
    if (!needsChunking(request)) {
      // Small document, send normally
      const totalSize = calculateMessageSize(request);
      logChunkingInfo({
        totalSize,
        overheadSize: 0,
        maxContentPerChunk: 0,
        totalChunks: 1,
        action: 'single'
      });
      return this.sendRequest(request);
    }
    
    // Large document, split into chunks
    const totalSize = calculateMessageSize(request);
    
    // Calculate overhead size (all fields except 'inhalt')
    const documentWithoutContent = { ...dokumentData, inhalt: '' };
    const overheadSize = calculateOverheadSize(documentWithoutContent, this.createDokumentPostRequest.bind(this));
    
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
        const response = await this.sendRequest(this.createDokumentPostRequest(chunkData));
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
   * Create HTTP request object for getting available folders
   * @param aktId - The case ID to get folders for
   */
  private createGetFoldersRequest(aktId: number): WebRTCApiRequest {
    return {
      method: 'GET',
      url: `api/v1.1/folders/${aktId}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
  }

  /**
   * Get available folders for a case via WebRTC
   * @param aktId - The case ID to get folders for
   */
  async getAvailableFolders(aktId: number) {
    const request = this.createGetFoldersRequest(aktId);
    return this.sendRequest<string[]>(request);
  }

  /**
   * Create HTTP request object for getting saved email documents
   * @param query - Query parameters for documents
   */
  private createGetDocumentsRequest(query: DokumenteQuery): WebRTCApiRequest {
    const queryParams = new URLSearchParams();
    
    if (query.aktId) queryParams.append('aktId', query.aktId.toString());
    if (query.outlookEmailId) queryParams.append('outlookEmailId', query.outlookEmailId);
    if (query.dokumentArten) {
      query.dokumentArten.forEach(art => queryParams.append('dokumentArten', art.toString()));
    }
    if (query.limit) queryParams.append('limit', query.limit.toString());

    return {
      method: 'GET',
      url: `api/v1.1/dokument?${queryParams.toString()}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
  }

  /**
   * Get saved email information for a specific email ID via WebRTC
   * @param outlookEmailId - The Outlook email ID to search for
   * @param aktId - Optional case ID to filter by
   */
  async getSavedEmailInfo(outlookEmailId: string, aktId?: number) {
    const query: DokumenteQuery = {
      outlookEmailId,
      aktId
    };
    const request = this.createGetDocumentsRequest(query);
    return this.sendRequest<DokumentResponse[]>(request);
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

    const request: WebRTCApiRequest = {
      method: 'GET',
      url: `api/person?${queryParams.toString()}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    return this.sendRequest(request);
  }

  /**
   * Person Lookup - search in different fields via WebRTC
   * @param searchText - Text to search for in different fields
   */
  async personLookUp(searchText: string) {
    const queryParams = new URLSearchParams();
    queryParams.append('searchText', searchText);

    const request: WebRTCApiRequest = {
      method: 'GET',
      url: `api/person/Lookup?${queryParams.toString()}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    return this.sendRequest(request);
  }

  /**
   * Create request for adding person to favorites
   */
  private createAddPersonToFavoritesRequest(personId: number): WebRTCApiRequest {
    return {
      method: 'POST',
      url: `api/person/AddToFavorites/${personId}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
  }

  /**
   * Create request for removing person from favorites
   */
  private createRemovePersonFromFavoritesRequest(personId: number): WebRTCApiRequest {
    return {
      method: 'DELETE',
      url: `api/person/RemoveFromFavorites/${personId}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
  }

  /**
   * Add person to favorites via WebRTC
   */
  async addPersonToFavorites(personId: number) {
    const request = this.createAddPersonToFavoritesRequest(personId);
    return this.sendRequest(request);
  }

  /**
   * Remove person from favorites via WebRTC
   */
  async removePersonFromFavorites(personId: number) {
    const request = this.createRemovePersonFromFavoritesRequest(personId);
    return this.sendRequest(request);
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
