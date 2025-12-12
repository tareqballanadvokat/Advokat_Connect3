// WebRTC Connection Manager - Robust connection management with auto-recovery
import { SipClientInstance, SipClientState } from '../components/SIP_Library/SipClient';
import { sipClientService } from './sipClientService';
import { webRTCApiService } from './webRTCApiService';
import { IdleActivityMonitor } from './IdleActivityMonitor';
import { store } from '../../store';
import { 
  startAuthentication, 
  authenticationSuccess, 
  authenticationFailure, 
  selectAuthCredentials
} from '../../store/slices/authSlice';
import {
  updateConnectionState as updateReduxConnectionState,
  selectConnectionState,
  ConnectionState,
  setIdle,
  updateLastActivity,
  setIdleDisconnected,
  setAutoReconnectPending,
  sipClientStateChanged,
  selectIsReady,
} from '../../store/slices/connectionSlice';
import { selectIsAuthenticated } from '../../store/slices/authSlice';

export type { ConnectionState };

export interface ConnectionManagerConfig {
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  healthCheckInterval?: number;
  connectionTimeout?: number;
  enableAutoReconnect?: boolean;
  idleTimeout?: number;           // Time before user is considered idle (default: 60000ms = 1 minute)
  enableIdleDisconnect?: boolean; // Enable idle disconnect feature (default: true)
  reconnectOnActivity?: boolean;  // Reconnect when user becomes active (default: true)
}

const DEFAULT_CONFIG: Required<ConnectionManagerConfig> = {
  maxReconnectAttempts: 5,
  reconnectDelay: 3000, // 3 seconds
  healthCheckInterval: 10000, // 10 seconds
  connectionTimeout: 30000, // 30 seconds
  enableAutoReconnect: true,
  idleTimeout: 5 * 60 * 1000, // 5 minutes
  enableIdleDisconnect: true,
  reconnectOnActivity: true
};

/**
 * WebRTC Connection Manager Class
 * 
 * Orchestrates SipClient lifecycle and manages connection state in Redux.
 * Key responsibilities:
 * - SipClient initialization and teardown
 * - Redux state synchronization (sipClientState is single source of truth)
 * - Internal health monitoring (not exposed to Redux/UI)
 * - Idle detection and auto-disconnect
 * - Authentication coordination
 * - Automatic reconnection on failures
 * 
 * Architecture:
 * - SipClient events → Redux updates via sipClientStateChanged action
 * - Redux derives all boolean flags (isConnected, isConnecting) from sipClientState
 * - Health monitoring is internal: consecutiveFailures triggers reconnect after 3 failures
 * - UI components use derived selectors, never access internal health state
 */
export class WebRTCConnectionManager {
  private config: Required<ConnectionManagerConfig>;
  private sipClient: SipClientInstance | null = null;
  
  // Timers and intervals
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionTimeoutTimer: NodeJS.Timeout | null = null;
  private stateMonitorInterval: NodeJS.Timeout | null = null;
  
  // Idle monitoring
  private idleMonitor: IdleActivityMonitor | null = null;
  private wasIdleDisconnected: boolean = false;
  
  // Internal health tracking (not exposed to Redux)
  private consecutiveFailures: number = 0;
  private lastHealthCheckTime: Date = new Date();
  
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
      this.updateConnectionState({ connectionStatus: 'Initializing connection manager...' });
      
      try {
        await this.connect();
        // Health and idle monitoring are started by connect() after successful connection
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
    const isConnecting = state.sipClientState === SipClientState.REGISTERING || 
                        state.sipClientState === SipClientState.CONNECTING || 
                        state.sipClientState === SipClientState.CONNECTING_P2P;
    if (this.isDestroyed || isConnecting) {
      return;
    }

    this.updateConnectionState({ 
      lastError: undefined,
    });

    try {
      // Start connection timeout
      this.startConnectionTimeout();
      
      // Initialize SIP client through singleton service
      this.sipClient = await sipClientService.initialize();
      
      // Start monitoring SIP client state changes
      if (this.sipClient) {
        this.startStateMonitoring();
        
        // Initialize WebRTC API service
        webRTCApiService.initialize(this.sipClient);
      }
      
      // Wait for full connection establishment
      await this.waitForFullConnection();
      
      // Automatically authenticate after connection is established
      await this.performAuthentication();
      
      // Start health and idle monitoring only after successful connection
      this.startHealthMonitoring();
      this.startIdleMonitoring();
      
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
    this.updateConnectionState({ connectionStatus: 'Disconnecting...' });
    
    // Stop monitoring before disconnect
    this.stopHealthMonitoring();
    this.stopIdleMonitoring();
    this.stopStateMonitoring();
    
    this.clearAllTimers();
    this.isReconnecting = false;
    
    if (this.sipClient) {
      try {
        // Use SipClient public API for graceful disconnect
        // This will send CONNECTION BYE and REGISTRATION BYE messages if needed
        this.sipClient.disconnect();
        
        // Give messages time to be sent before cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn('Error during graceful disconnect:', error);
      }
    }
    
    this.updateConnectionState({
      reconnectAttempts: 0,
    });
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
      this.updateConnectionState({ connectionStatus: `Max reconnection attempts (${maxAttempts}) reached` });
      return;
    }

    this.isReconnecting = true;
    this.clearReconnectTimer();

    const attemptNumber = force ? 0 : state.reconnectAttempts + 1;
    const delay = this.calculateReconnectDelay(attemptNumber);

    this.updateConnectionState({ 
      reconnectAttempts: attemptNumber,
    });

    this.reconnectTimer = setTimeout(async () => {
      if (this.isDestroyed || !this.isReconnecting) return;

      try {
        // Stop monitoring before reconnect
        this.stopHealthMonitoring();
        this.stopIdleMonitoring();
        
        // Full reconnect cycle
        await this.disconnect();
        await this.connect();
        
        // Monitoring will be started by connect() after successful connection
        this.isReconnecting = false;
      } catch (error) {
        console.error(`Reconnection attempt ${attemptNumber} failed:`, error);
        
        if (attemptNumber < maxAttempts && this.config.enableAutoReconnect) {
          // Schedule next attempt
          await this.reconnect();
        } else {
          this.isReconnecting = false;
          this.updateConnectionState({ connectionStatus: `Reconnection failed after ${maxAttempts} attempts` });
        }
      }
    }, delay);
  }

  /**
   * Perform internal health check (not exposed to Redux)
   * Updates connection state if issues detected
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.sipClient || this.isDestroyed) {
      this.consecutiveFailures++;
      return;
    }

    this.lastHealthCheckTime = new Date();
    
    try {
      // Check SIP client health using public API
      const isSipHealthy = this.sipClient.isHealthy();
      const isApiReady = webRTCApiService.isReady();
      
      const isHealthy = isSipHealthy && isApiReady;
      
      if (!isHealthy) {
        this.consecutiveFailures++;
        console.warn(`[ConnectionManager] Health check failed (${this.consecutiveFailures} consecutive failures)`);
        
        // Trigger auto-reconnect after 3 consecutive failures
        if (this.consecutiveFailures >= 3 && this.config.enableAutoReconnect && !this.isReconnecting) {
          console.warn('[ConnectionManager] Health check threshold reached, triggering reconnection...');
          this.reconnect();
        }
      } else {
        // Reset failure count on successful health check
        if (this.consecutiveFailures > 0) {
          console.log('[ConnectionManager] Health restored');
          this.consecutiveFailures = 0;
        }
      }
    } catch (error) {
      console.error('[ConnectionManager] Health check error:', error);
      this.consecutiveFailures++;
    }
  }

  /**
   * Perform authentication with the remote API
   * This is automatically called after the WebRTC connection is established
   */
  private async performAuthentication(): Promise<void> {
    try {
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
      
      // Authentication state is managed by authSlice
      
      console.log('✅ Authentication successful');
      
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      store.dispatch(authenticationFailure(errorMessage));
      
      this.updateConnectionState({ 
        lastError: errorMessage,
      });
      
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
    return selectIsReady(store.getState());
  }

  /**
   * Destroy the connection manager
   */
  destroy(): void {
    this.isDestroyed = true;
    this.clearAllTimers();
    this.stopIdleMonitoring();
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
          this.sipClient.connection.isConnectionEstablished &&
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
      lastError: errorMessage,
    });
    
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

  private startStateMonitoring(): void {
    if (this.stateMonitorInterval) {
      clearInterval(this.stateMonitorInterval);
    }

    this.stateMonitorInterval = setInterval(() => {
      if (!this.sipClient || this.isDestroyed) {
        this.stopStateMonitoring();
        return;
      }
      
      const currentState = this.sipClient.getState();
      store.dispatch(sipClientStateChanged(currentState));
      
      // sipClientStateChanged will automatically update connectionStatus
      if (currentState === 'DISCONNECTED') {
        this.stopStateMonitoring();
      }
    }, 500);
  }

  private stopStateMonitoring(): void {
    if (this.stateMonitorInterval) {
      clearInterval(this.stateMonitorInterval);
      this.stateMonitorInterval = null;
    }
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

  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Start idle activity monitoring
   */
  private startIdleMonitoring(): void {
    if (!this.config.enableIdleDisconnect) {
      console.log('[ConnectionManager] Idle disconnect is disabled');
      return;
    }

    if (this.idleMonitor) {
      console.warn('[ConnectionManager] Idle monitor already running');
      return;
    }

    console.log(`[ConnectionManager] Starting idle monitoring (timeout: ${this.config.idleTimeout}ms)`);
    
    this.idleMonitor = new IdleActivityMonitor({
      idleTimeout: this.config.idleTimeout,
      onIdle: () => this.handleUserIdle(),
      onActive: () => this.handleUserActive(),
    });

    this.idleMonitor.start();
  }

  /**
   * Stop idle activity monitoring
   */
  private stopIdleMonitoring(): void {
    if (this.idleMonitor) {
      console.log('[ConnectionManager] Stopping idle monitoring');
      this.idleMonitor.stop();
      this.idleMonitor = null;
    }
  }

  /**
   * Handle user going idle - disconnect to save resources
   */
  private handleUserIdle(): void {
    console.log('[ConnectionManager] User went idle - disconnecting');
    
    const state = selectConnectionState(store.getState());
    const isConnected = state.sipClientState === SipClientState.CONNECTED;
    if (!isConnected) {
      console.log('[ConnectionManager] Already disconnected, skipping idle disconnect');
      return;
    }

    // Mark as idle and track when disconnected
    store.dispatch(setIdle(true));
    store.dispatch(setIdleDisconnected(new Date().toISOString()));
    this.wasIdleDisconnected = true;

    // Update status before disconnecting
    this.updateConnectionState({ connectionStatus: 'Disconnected due to inactivity (5 min idle)' });
    
    // Disconnect
    this.disconnect().catch(error => {
      console.error('[ConnectionManager] Error during idle disconnect:', error);
    });
  }

  /**
   * Handle user becoming active - reconnect if was idle-disconnected
   */
  private handleUserActive(): void {
    console.log('[ConnectionManager] User became active');
    
    // Update activity timestamp
    store.dispatch(updateLastActivity());
    store.dispatch(setIdle(false));

    // Check if we should reconnect
    if (this.wasIdleDisconnected && this.config.reconnectOnActivity) {
      console.log('[ConnectionManager] Reconnecting after idle period');
      
      this.wasIdleDisconnected = false;
      store.dispatch(setIdleDisconnected(undefined));
      store.dispatch(setAutoReconnectPending(false));
      
      // Update status and reconnect
      this.updateConnectionState({ connectionStatus: 'Reconnecting after inactivity...' });
      
      this.connect().catch(error => {
        console.error('[ConnectionManager] Error during post-idle reconnect:', error);
      });
    }
  }

  private startConnectionTimeout(): void {
    this.clearConnectionTimeout();
    this.connectionTimeoutTimer = setTimeout(() => {
      const state = selectConnectionState(store.getState());
      const isConnecting = state.sipClientState === SipClientState.REGISTERING || 
                          state.sipClientState === SipClientState.CONNECTING || 
                          state.sipClientState === SipClientState.CONNECTING_P2P;
      if (isConnecting) {
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
    this.stopStateMonitoring();
    this.stopHealthMonitoring();
  }

  private updateConnectionState(updates: Partial<ConnectionState>): void {
    store.dispatch(updateReduxConnectionState(updates));
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
