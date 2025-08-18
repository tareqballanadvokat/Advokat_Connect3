// WebRTC API Communication Service - Integrates with SIP_Library
import { v4 as uuidv4 } from 'uuid';
import { WebRTCApiRequest, WebRTCApiResponse, AktenQuery } from '../components/interfaces/IAkten';
import { LeistungenAuswahlQuery, LeistungPostData } from '../components/interfaces/IService';
import { PersonenQuery } from '../components/interfaces/IPerson';
import { SipClientInstance } from '../components/SIP_Library/SipClient';

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
        
        // Determine if this should be Akten or Services data based on the message
        if (message.toLowerCase().includes('service') || message.toLowerCase().includes('leistung')) {
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
   * Generate a proper GUID (UUID v4) using uuid library
   */
  private generateGuid(): string {
    return uuidv4();
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

      const requestId = this.generateGuid();
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
        console.log('📤 Sending API request:', message);
        dataChannel.send(message);
      } catch (error) {
        this.responseHandlers.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * Create HTTP request object for Akten lookup
   * @param query - Search parameters
   */
  private createAktenLookupRequest(query: AktenQuery): WebRTCApiRequest {
    const queryParams = new URLSearchParams();
    
    if (query.aktId !== undefined) queryParams.append('aktId', query.aktId.toString());
    if (query.aKurzLike) queryParams.append('aKurzLike', query.aKurzLike);
    if (query.count) queryParams.append('count', query.count.toString());
    if (query.withCausa !== undefined) queryParams.append('withCausa', query.withCausa.toString());

    return {
      method: 'GET',
      url: `api/v1.1/akten/lookup?${queryParams.toString()}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
  }

  /**
   * Search for Akten (Cases) via WebRTC
   * @param query - Search parameters (Kürzel-based)
   */
  async searchAkten(query: AktenQuery) {
    
    const request = this.createAktenLookupRequest(query);
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

  // ===== PERSON API METHODS =====

  /**
   * Create request for person search
   */
  private createPersonSearchRequest(query: PersonenQuery): WebRTCApiRequest {
    const queryParams = new URLSearchParams();
    
    if (query.nKurzLike) queryParams.append('nKurzLike', query.nKurzLike);
    if (query.name1Like) queryParams.append('name1Like', query.name1Like);
    if (query.count) queryParams.append('count', query.count.toString());
    if (query.nurFavoriten !== undefined) queryParams.append('nurFavoriten', query.nurFavoriten.toString());

    return {
      method: 'GET',
      url: `api/person/Lookup?${queryParams.toString()}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
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
   * Search for persons via WebRTC
   */
  async searchPersons(query: PersonenQuery) {
    const request = this.createPersonSearchRequest(query);
    return this.sendRequest(request);
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
