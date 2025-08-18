// Singleton SIP Client Service - Ensures only one SIP connection instance
import { initializeSipClient, SipClientInstance } from '../components/SIP_Library/SipClient';

/**
 * Singleton service for managing a single SIP client instance
 * Prevents multiple connections and ensures proper lifecycle management
 */
class SipClientService {
  private static instance: SipClientService;
  private sipClient: SipClientInstance | null = null;
  private isInitialized = false;
  private isInitializing = false;

  // Private constructor to prevent direct instantiation
  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): SipClientService {
    if (!SipClientService.instance) {
      SipClientService.instance = new SipClientService();
    }
    return SipClientService.instance;
  }

  /**
   * Initialize SIP client (only once)
   */
  async initialize(): Promise<SipClientInstance> {
    // Return existing client if already initialized
    if (this.isInitialized && this.sipClient) {
      return this.sipClient;
    }

    // Prevent multiple simultaneous initializations
    if (this.isInitializing) {
      // Wait for ongoing initialization
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.sipClient!;
    }

    this.isInitializing = true;

    try {
      console.log('🔄 Initializing SIP client (singleton)...');
      this.sipClient = initializeSipClient();
      
      this.isInitialized = true;
      console.log('✅ SIP client initialized successfully');
      
      return this.sipClient;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Get current SIP client instance (if initialized)
   */
  getSipClient(): SipClientInstance | null {
    return this.sipClient;
  }

  /**
   * Check if SIP client is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.sipClient !== null;
  }

  /**
   * Cleanup - close connection and reset
   */
  cleanup(): void {
    if (this.sipClient?.socket) {
      console.log('🔌 Closing SIP client connection...');
      this.sipClient.socket.close();
    }
    
    this.sipClient = null;
    this.isInitialized = false;
    this.isInitializing = false;
  }
}

// Export singleton instance
export const sipClientService = SipClientService.getInstance();
