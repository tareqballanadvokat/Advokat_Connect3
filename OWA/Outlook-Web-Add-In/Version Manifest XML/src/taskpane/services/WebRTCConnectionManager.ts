// WebRTC Connection Manager - Robust connection management with auto-recovery
import { SipClientInstance } from '../components/SIP_Library/SipClient';
import { sipClientService } from './sipClientService';
import { webRTCApiService } from './webRTCApiService';
import { store } from '../../store';
import { 
  startAuthentication, 
  authenticationSuccess, 
  authenticationFailure, 
  selectAuthCredentials,
  selectIsAuthenticated 
} from '../../store/slices/authSlice';
import {
  updateConnectionState as updateReduxConnectionState,
  updateConnectionStatus as updateReduxConnectionStatus,
  updateConnectionHealth as updateReduxConnectionHealth,
  selectConnectionState,
  selectConnectionHealth,
  ConnectionState,
  ConnectionHealth,
} from '../../store/slices/connectionSlice';

export type { ConnectionState, ConnectionHealth };

export interface ConnectionManagerConfig {
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  healthCheckInterval?: number;
  connectionTimeout?: number;
  enableAutoReconnect?: boolean;
}

const DEFAULT_CONFIG: Required<ConnectionManagerConfig> = {
  maxReconnectAttempts: 5,
  reconnectDelay: 3000, // 3 seconds
  healthCheckInterval: 10000, // 10 seconds
  connectionTimeout: 30000, // 30 seconds
  enableAutoReconnect: true
};

/**
 * WebRTC Connection Manager Class
 * Handles robust connection management with auto-recovery, health monitoring,
 * and intelligent reconnection strategies
 */
export class WebRTCConnectionManager {
  private config: Required<ConnectionManagerConfig>;
  private sipClient: SipClientInstance | null = null;
  
  // Timers and intervals
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionTimeoutTimer: NodeJS.Timeout | null = null;
  
  // Internal flags
  private isInitialized = false;
  private isDestroyed = false;
  private isReconnecting = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: ConnectionManagerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the connection manager
   */
  async initialize(): Promise<void> {
    // Return existing initialization if already complete
    if (this.isInitialized) {
      return;
    }

    // Return ongoing initialization promise if in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Check if destroyed
    if (this.isDestroyed) {
      return;
    }

    // Create and store initialization promise
    this.initializationPromise = (async () => {
      this.updateConnectionStatus('Initializing connection manager...');
      
      try {
        await this.connect();
        this.startHealthMonitoring();
        this.isInitialized = true;
      } catch (error) {
        console.error('Failed to initialize WebRTC Connection Manager:', error);
        this.handleConnectionError(error);
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Connect to WebRTC
   */
  async connect(): Promise<void> {
    const state = selectConnectionState(store.getState());
    if (this.isDestroyed || state.isConnecting) {
      return;
    }

    this.updateConnectionState({ 
      isConnecting: true,
      lastError: undefined 
    });
    this.updateConnectionStatus('Connecting to SIP server...');

    try {
      // Start connection timeout
      this.startConnectionTimeout();
      
      // Initialize SIP client through singleton service
      this.sipClient = await sipClientService.initialize();
      
      // Initialize WebRTC API service
      if (this.sipClient) {
        webRTCApiService.initialize(this.sipClient);
      }
      
      // Wait for full connection establishment
      await this.waitForFullConnection();
      
      this.updateConnectionState({
        isConnected: true,
        isConnecting: false,
        reconnectAttempts: 0,
        lastSuccessfulConnection: new Date().toISOString()
      });
      this.updateConnectionStatus('Connected - authenticating with API...');
      
      // Automatically authenticate after connection is established
      await this.performAuthentication();
      
      // Clear any existing reconnect timer
      this.clearReconnectTimer();
      
    } catch (error) {
      this.handleConnectionError(error);
      throw error;
    } finally {
      this.clearConnectionTimeout();
    }
  }

  /**
   * Disconnect from WebRTC
   */
  async disconnect(): Promise<void> {
    this.updateConnectionStatus('Disconnecting...');
    
    this.clearAllTimers();
    this.isReconnecting = false;
    
    if (this.sipClient) {
      try {
        // Gracefully close data channel
        const dataChannel = this.sipClient.peer2peer.getActiveDataChannel();
        if (dataChannel && dataChannel.readyState === 'open') {
          dataChannel.close();
        }
        
        // Note: Cannot access RTCPeerConnection directly as it's private in Peer2PeerConnection
        // The peer2peer class manages its own connection lifecycle
      } catch (error) {
        console.warn('Error during graceful disconnect:', error);
      }
    }
    
    this.updateConnectionState({
      isConnected: false,
      isConnecting: false,
      isRegistered: false,
      isConnectionEstablished: false,
      isPeerConnected: false,
      isDataChannelOpen: false,
      isAuthenticated: false,
      isAuthenticating: false,
      reconnectAttempts: 0
    });
    this.updateConnectionStatus('Disconnected');
  }

  /**
   * Reconnect with exponential backoff
   */
  async reconnect(force: boolean = false): Promise<void> {
    if (this.isDestroyed || (this.isReconnecting && !force)) {
      return;
    }

    const state = selectConnectionState(store.getState());
    const maxAttempts = this.config.maxReconnectAttempts;
    if (state.reconnectAttempts >= maxAttempts && !force) {
      this.updateConnectionStatus(`Max reconnection attempts (${maxAttempts}) reached`);
      return;
    }

    this.isReconnecting = true;
    this.clearReconnectTimer();

    const attemptNumber = force ? 0 : state.reconnectAttempts + 1;
    const delay = this.calculateReconnectDelay(attemptNumber);

    this.updateConnectionState({ 
      reconnectAttempts: attemptNumber,
      isConnecting: false
    });
    this.updateConnectionStatus(`Reconnecting in ${delay}ms... (attempt ${attemptNumber}/${maxAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      if (this.isDestroyed || !this.isReconnecting) return;

      try {
        await this.disconnect();
        await this.connect();
        this.isReconnecting = false;
      } catch (error) {
        console.error(`Reconnection attempt ${attemptNumber} failed:`, error);
        
        if (attemptNumber < maxAttempts && this.config.enableAutoReconnect) {
          // Schedule next attempt
          await this.reconnect();
        } else {
          this.isReconnecting = false;
          this.updateConnectionStatus(`Reconnection failed after ${maxAttempts} attempts`);
        }
      }
    }, delay);
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<ConnectionHealth> {
    const health = selectConnectionHealth(store.getState());
    if (!this.sipClient || this.isDestroyed) {
      this.updateConnectionHealth({
        isHealthy: false,
        latency: 0,
        lastHealthCheck: new Date().toISOString(),
        consecutiveFailures: health.consecutiveFailures + 1
      });
      return selectConnectionHealth(store.getState());
    }

    const startTime = Date.now();
    
    try {
      // Check SIP client state
      const dataChannel = this.sipClient.peer2peer.getActiveDataChannel();
      const isApiReady = webRTCApiService.isReady();
      
      const isHealthy = !!(
        this.sipClient.registration.isRegistrationProcessFinished &&
        this.sipClient.connection.isEstablishingConnectionProcessFinished &&
        dataChannel?.readyState === 'open' &&
        isApiReady
      );
      
      const latency = Date.now() - startTime;
      
      const currentHealth = selectConnectionHealth(store.getState());
      this.updateConnectionHealth({
        isHealthy,
        latency,
        lastHealthCheck: new Date().toISOString(),
        consecutiveFailures: isHealthy ? 0 : currentHealth.consecutiveFailures + 1
      });
      
      // Update connection state based on health check
      this.updateConnectionState({
        isRegistered: this.sipClient.registration.isRegistrationProcessFinished,
        isConnectionEstablished: this.sipClient.connection.isEstablishingConnectionProcessFinished,
        isPeerConnected: !!dataChannel, // Use dataChannel existence as indicator of peer connection
        isDataChannelOpen: dataChannel?.readyState === 'open',
        isConnected: isHealthy
      });
      
      // Trigger auto-reconnect if unhealthy
      if (!isHealthy && this.config.enableAutoReconnect && !this.isReconnecting) {
        console.warn('Health check failed, triggering reconnection...');
        this.reconnect();
      }
      
      return selectConnectionHealth(store.getState());
      
    } catch (error) {
      console.error('Health check failed:', error);
      
      const currentHealth = selectConnectionHealth(store.getState());
      this.updateConnectionHealth({
        isHealthy: false,
        latency: Date.now() - startTime,
        lastHealthCheck: new Date().toISOString(),
        consecutiveFailures: currentHealth.consecutiveFailures + 1
      });
      
      return selectConnectionHealth(store.getState());
    }
  }

  /**
   * Perform authentication with the remote API
   * This is automatically called after the WebRTC connection is established
   */
  private async performAuthentication(): Promise<void> {
    try {
      this.updateConnectionState({ isAuthenticating: true });
      store.dispatch(startAuthentication());

      // Wait a moment for the data channel to be fully ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get credentials from Redux store
      const credentials = selectAuthCredentials(store.getState());
      
      console.log('🔐 Attempting authentication with credentials:', {
        grant_type: credentials.grant_type,
        client_id: credentials.client_id,
        username: credentials.username,
        hasPassword: !!credentials.password
      });

      // Prepare authentication request
      const authRequest = {
        grant_type: credentials.grant_type,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        username: credentials.username,
        password: credentials.password
      };

      // Send authentication request via WebRTC
      const authResponse = await webRTCApiService.authenticate(authRequest);
      
      // Update Redux store with authentication success
      store.dispatch(authenticationSuccess(authResponse));
      
      this.updateConnectionState({ 
        isAuthenticated: true, 
        isAuthenticating: false 
      });
      this.updateConnectionStatus('Connected and authenticated - ready for API calls');
      
      console.log('✅ Authentication successful');
      
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      store.dispatch(authenticationFailure(errorMessage));
      
      this.updateConnectionState({ 
        isAuthenticated: false, 
        isAuthenticating: false,
        lastError: errorMessage
      });
      this.updateConnectionStatus(`Connected but authentication failed: ${errorMessage}`);
      
      throw error;
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return selectConnectionState(store.getState());
  }

  /**
   * Get current connection health
   */
  getConnectionHealth(): ConnectionHealth {
    return selectConnectionHealth(store.getState());
  }

  /**
   * Get SIP client instance
   */
  getSipClient(): SipClientInstance | null {
    return this.sipClient;
  }

  /**
   * Get initialized WebRTC API service
   */
  getWebRTCApiService() {
    return webRTCApiService;
  }

  /**
   * Check if ready for API calls
   */
  isReady(): boolean {
    const state = selectConnectionState(store.getState());
    const health = selectConnectionHealth(store.getState());
    return state.isConnected && 
           state.isDataChannelOpen && 
           state.isAuthenticated &&
           health.isHealthy;
  }

  /**
   * @deprecated Use Redux selectors instead (selectConnectionState, selectConnectionHealth)
   */
  onStateChange(_listener: (state: ConnectionState) => void): () => void {
    console.warn('onStateChange is deprecated. Use Redux useAppSelector(selectConnectionState) instead.');
    return () => {};
  }

  /**
   * @deprecated Use Redux selectors instead (selectConnectionState, selectConnectionHealth)
   */
  onHealthChange(_listener: (health: ConnectionHealth) => void): () => void {
    console.warn('onHealthChange is deprecated. Use Redux useAppSelector(selectConnectionHealth) instead.');
    return () => {};
  }

  /**
   * Destroy the connection manager
   */
  destroy(): void {
    this.isDestroyed = true;
    this.clearAllTimers();
    this.disconnect();
  }

  // Private methods

  private async waitForFullConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxWaitTime = this.config.connectionTimeout;
      const checkInterval = 500;
      let elapsedTime = 0;

      const checkConnection = () => {
        if (this.isDestroyed) {
          reject(new Error('Connection manager destroyed'));
          return;
        }

        if (elapsedTime >= maxWaitTime) {
          reject(new Error('Connection timeout'));
          return;
        }

        if (!this.sipClient) {
          setTimeout(checkConnection, checkInterval);
          elapsedTime += checkInterval;
          return;
        }

        const dataChannel = this.sipClient.peer2peer.getActiveDataChannel();
        const isFullyConnected = !!(
          this.sipClient.registration.isRegistrationProcessFinished &&
          this.sipClient.connection.isEstablishingConnectionProcessFinished &&
          dataChannel?.readyState === 'open'
        );

        if (isFullyConnected) {
          resolve();
        } else {
          setTimeout(checkConnection, checkInterval);
          elapsedTime += checkInterval;
        }
      };

      checkConnection();
    });
  }

  private handleConnectionError(error: any): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    this.updateConnectionState({
      isConnected: false,
      isConnecting: false,
      lastError: errorMessage
    });
    this.updateConnectionStatus(`Connection error: ${errorMessage}`);
    
    // Trigger reconnection if enabled
    if (this.config.enableAutoReconnect && !this.isReconnecting) {
      this.reconnect();
    }
  }

  private calculateReconnectDelay(attemptNumber: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.reconnectDelay;
    const exponentialDelay = baseDelay * Math.pow(2, Math.min(attemptNumber - 1, 5));
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }

  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      if (!this.isDestroyed) {
        this.performHealthCheck();
      }
    }, this.config.healthCheckInterval);
  }

  private startConnectionTimeout(): void {
    this.clearConnectionTimeout();
    this.connectionTimeoutTimer = setTimeout(() => {
      const state = selectConnectionState(store.getState());
      if (state.isConnecting) {
        this.handleConnectionError(new Error('Connection timeout'));
      }
    }, this.config.connectionTimeout);
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearAllTimers(): void {
    this.clearConnectionTimeout();
    this.clearReconnectTimer();
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private updateConnectionState(updates: Partial<ConnectionState>): void {
    store.dispatch(updateReduxConnectionState(updates));
  }

  private updateConnectionStatus(status: string): void {
    this.updateConnectionState({ connectionStatus: status });
    store.dispatch(updateReduxConnectionStatus(status));
  }

  private updateConnectionHealth(updates: Partial<ConnectionHealth>): void {
    store.dispatch(updateReduxConnectionHealth(updates));
  }
}

// Singleton instance
let connectionManagerInstance: WebRTCConnectionManager | null = null;

/**
 * Get singleton WebRTC Connection Manager instance
 */
export const getWebRTCConnectionManager = (config?: ConnectionManagerConfig): WebRTCConnectionManager => {
  if (!connectionManagerInstance) {
    connectionManagerInstance = new WebRTCConnectionManager(config);
  }
  return connectionManagerInstance;
};

/**
 * Reset singleton instance (useful for testing)
 */
export const resetWebRTCConnectionManager = (): void => {
  if (connectionManagerInstance) {
    connectionManagerInstance.destroy();
    connectionManagerInstance = null;
  }
};
