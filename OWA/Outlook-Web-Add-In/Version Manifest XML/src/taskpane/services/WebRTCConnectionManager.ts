/* eslint-disable no-undef */

// WebRTC Connection Manager - Robust connection management with auto-recovery
import {
  SipClientInstance,
  SipClientState,
  SipClientObserver,
  initializeSipClient,
} from "../components/SIP_Library/SipClient";
import { webRTCApiService } from "./webRTCApiService";
import { tokenService } from "./TokenService";
import { IdleActivityMonitor } from "./IdleActivityMonitor";
import { WebRTCDataChannelService } from "./WebRTCDataChannelService";
import { store } from "../../store";
import { getLogger } from "../../services/logger";
import {
  startAuthentication,
  authenticationSuccess,
  authenticationFailure,
  selectAuthCredentials,
} from "../../store/slices/authSlice";
import {
  updateConnectionState as updateReduxConnectionState,
  selectConnectionState,
  ConnectionState,
  setIdle,
  updateLastActivity,
  setDisconnectedDueToIdleAt,
  setAutoReconnectPending,
  sipClientStateChanged,
  selectIsReady,
} from "../../store/slices/connectionSlice";

export type { ConnectionState };

export interface ConnectionManagerConfig {
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  enableAutoReconnect?: boolean;
  idleTimeout?: number; // Time before user is considered idle (default: 60000ms = 1 minute)
  enableIdleDisconnect?: boolean; // Enable idle disconnect feature (default: true)
  reconnectOnActivity?: boolean; // Reconnect when user becomes active (default: true)
}

const DEFAULT_CONFIG: Required<ConnectionManagerConfig> = {
  maxReconnectAttempts: 2,
  reconnectDelay: 3000, // 3 seconds
  enableAutoReconnect: true,
  idleTimeout: 5 * 60 * 1000, // 5 minutes
  enableIdleDisconnect: true,
  reconnectOnActivity: true,
};

/**
 * WebRTC Connection Manager Class
 *
 * Orchestrates SipClient lifecycle and manages connection state in Redux.
 * Uses Observer pattern to react to SipClient state changes.
 *
 * Key responsibilities:
 * - SipClient initialization and teardown
 * - Redux state synchronization (sipClientState is single source of truth)
 * - Idle detection and auto-disconnect
 * - Authentication coordination
 * - Automatic reconnection on FAILED state (fatal errors or max retries)
 * - No reconnection on DISCONNECTED state (deliberate disconnect)
 *
 * Architecture:
 * - WebRTCConnectionManager implements SipClientObserver (Observer)
 * - SipClient is the Subject that notifies observers of state changes
 * - Redux updates happen via sipClientStateChanged action
 * - Redux derives all boolean flags (isConnected, isConnecting) from sipClientState
 * - No timers for monitoring - uses Observer pattern for state changes
 */
export class WebRTCConnectionManager implements SipClientObserver {
  private config: Required<ConnectionManagerConfig>;
  private sipClient: SipClientInstance | null = null;
  private logger = getLogger();

  // Timers
  private reconnectTimer: NodeJS.Timeout | null = null;
  private waitForConnectionTimer: NodeJS.Timeout | null = null;

  // Idle monitoring
  private idleMonitor: IdleActivityMonitor | null = null;
  private disconnectedDueToIdle: boolean = false;

  // Internal flags
  private isInitialized = false;
  private isDestroyed = false;
  private isReconnecting = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: ConnectionManagerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Observer pattern callback - called by SipClient when state changes
   * This is the central point for reacting to SipClient state changes
   */
  onSipClientStateChanged(newState: SipClientState, reason: string): void {
    this.logger.info("ConnectionManager", `SipClient state changed: ${newState} (${reason})`);

    // Update Redux with new state
    store.dispatch(sipClientStateChanged(newState));

    // Handle state-specific logic
    if (newState === SipClientState.FAILED_PERMANENTLY) {
      // FAILED_PERMANENTLY indicates SipClient exhausted all its internal retries
      // WebRTCConnectionManager should handle higher-level reconnection by creating new SipClient
      this.logger.info(
        "ConnectionManager",
        "FAILED_PERMANENTLY state detected - will attempt full reconnection"
      );
      this.handlePermanentFailure(reason);
    } else if (newState === SipClientState.DISCONNECTED) {
      // DISCONNECTED indicates deliberate disconnect - do not reconnect
      this.logger.info(
        "ConnectionManager",
        "DISCONNECTED state detected - no automatic reconnection"
      );
      this.updateConnectionState({
        reconnectAttempts: 0,
      });
    } else if (newState === SipClientState.CONNECTED) {
      // Successfully connected - reset reconnect attempts
      this.logger.info("ConnectionManager", "CONNECTED state detected");
      this.updateConnectionState({
        reconnectAttempts: 0,
        lastError: undefined,
      });
    }
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
      this.updateConnectionState({ connectionStatus: "Initializing connection manager..." });

      try {
        await this.connect();
        // Idle monitoring is started by connect() after successful connection
        // Set isInitialized BEFORE clearing initializationPromise to prevent race
        this.isInitialized = true;
      } catch (error) {
        this.logger.error(
          "ConnectionManager",
          "Failed to initialize WebRTC Connection Manager",
          error
        );
        // Don't set isInitialized on failure
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
    const isConnecting =
      state.sipClientState === SipClientState.REGISTERING ||
      state.sipClientState === SipClientState.CONNECTING ||
      state.sipClientState === SipClientState.CONNECTING_P2P;
    if (this.isDestroyed || isConnecting) {
      return;
    }

    this.updateConnectionState({
      lastError: undefined,
    });

    try {
      // Initialize SIP client directly
      this.sipClient = initializeSipClient();

      if (this.sipClient) {
        // Subscribe to SipClient state changes (Observer pattern)
        this.sipClient.subscribe(this);

        // Initialize WebRTC API service
        webRTCApiService.initialize(this.sipClient);
      }

      // Wait for full connection establishment
      await this.waitForFullConnection();

      // Automatically authenticate after connection is established
      await this.performAuthentication();

      // Start idle monitoring only after successful connection
      this.startIdleMonitoring();

      // Clear any existing reconnect timer
      this.clearReconnectTimer();
    } catch (error) {
      // Cleanup: unsubscribe if we subscribed but connection failed
      if (this.sipClient?.isSubscribed(this)) {
        try {
          this.sipClient.unsubscribe(this);
        } catch (unsubError) {
          this.logger.warn(
            "ConnectionManager",
            "Error unsubscribing after connection failure",
            unsubError
          );
        }
      }

      this.handleConnectionError(error);
      throw error;
    }
  }

  /**
   * Disconnect from WebRTC
   * @param resetReconnectCounter - Whether to reset the reconnect attempt counter (default: true)
   *                                Set to false when disconnecting as part of a reconnect cycle
   */
  async disconnect(resetReconnectCounter: boolean = true): Promise<void> {
    this.updateConnectionState({ connectionStatus: "Disconnecting..." });

    // Stop idle monitoring before disconnect
    this.stopIdleMonitoring();

    this.clearAllTimers();
    this.isReconnecting = false;

    if (this.sipClient) {
      try {
        // Unsubscribe from state changes
        this.sipClient.unsubscribe(this);

        // Use SipClient public API for graceful disconnect
        // Pass DISCONNECTED state to indicate deliberate disconnect (no retry)
        this.sipClient.disconnect(SipClientState.DISCONNECTED);

        // Give messages time to be sent before cleanup
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.warn("ConnectionManager", "Error during graceful disconnect", error);
      } finally {
        // Clear reference to allow garbage collection
        this.sipClient = null;
      }
    }

    // Clear both DataChannels from service to prevent stale references
    // Use the service's cleanup method for proper encapsulation
    WebRTCDataChannelService.getInstance().reset();

    // Only reset reconnect attempts when explicitly requested (deliberate disconnect)
    // During reconnect cycle, preserve the counter to show accurate attempt numbers
    if (resetReconnectCounter) {
      this.updateConnectionState({
        reconnectAttempts: 0,
      });
    }
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
      this.updateConnectionState({
        connectionStatus: `Max reconnection attempts (${maxAttempts}) reached`,
      });
      return;
    }

    this.isReconnecting = true;
    this.clearReconnectTimer();

    const attemptNumber = force ? 0 : state.reconnectAttempts + 1;
    const delay = this.calculateReconnectDelay(attemptNumber);

    // Update attempt counter immediately (before timer) to prevent race conditions
    // If reconnect() is called again before timer fires, it will see the updated count
    this.updateConnectionState({
      reconnectAttempts: attemptNumber,
    });

    this.reconnectTimer = setTimeout(async () => {
      // Check again if destroyed (timer may have been set before destroy)
      if (this.isDestroyed) {
        this.logger.info("ConnectionManager", "Destroyed during reconnect delay, aborting");
        this.isReconnecting = false;
        return;
      }

      if (!this.isReconnecting) {
        this.logger.info("ConnectionManager", "Reconnect cancelled during delay");
        return;
      }

      try {
        // Stop idle monitoring before reconnect
        this.stopIdleMonitoring();

        // Full reconnect cycle - don't reset the reconnect counter
        await this.disconnect(false);

        // Check destroyed again after async disconnect
        if (this.isDestroyed) {
          this.logger.info("ConnectionManager", "Destroyed during disconnect, aborting reconnect");
          this.isReconnecting = false;
          return;
        }

        await this.connect();

        // Idle monitoring will be started by connect() after successful connection
        this.isReconnecting = false;
      } catch (error) {
        this.logger.error(
          "ConnectionManager",
          `Reconnection attempt ${attemptNumber} failed`,
          error
        );

        // Always reset flag on error
        this.isReconnecting = false;

        if (this.isDestroyed) {
          this.logger.info("ConnectionManager", "Destroyed during reconnect error, stopping");
          return;
        }

        if (attemptNumber < maxAttempts && this.config.enableAutoReconnect) {
          // Schedule next attempt (will set isReconnecting again)
          this.reconnect();
        } else {
          this.updateConnectionState({
            connectionStatus: `Reconnection failed after ${maxAttempts} attempts`,
          });
        }
      }
    }, delay);
  }

  /**
   * Handle permanent failure (called when SipClient transitions to FAILED_PERMANENTLY state)
   * SipClient has exhausted all its internal retries, so we need to create a fresh instance
   */
  private handlePermanentFailure(reason: string): void {
    this.logger.info("ConnectionManager", `Handling permanent failure: ${reason}`);

    // Trigger full reconnection (new SipClient) if enabled and not already reconnecting
    if (this.config.enableAutoReconnect && !this.isReconnecting) {
      this.logger.info(
        "ConnectionManager",
        "Auto-reconnect enabled, scheduling full reconnection with new SipClient..."
      );
      this.updateConnectionState({
        lastError: reason,
        connectionStatus: `Connection failed permanently. Attempting retry..`,
      });
      this.reconnect();
    } else if (this.isReconnecting) {
      this.logger.info("ConnectionManager", "Already reconnecting, ignoring additional failure");
    } else {
      this.logger.info("ConnectionManager", "Auto-reconnect disabled");
    }
  }

  /**
   * Perform authentication with the remote API
   * This is automatically called after the WebRTC connection is established
   */
  private async performAuthentication(): Promise<void> {
    try {
      store.dispatch(startAuthentication());

      // Verify offer channel is open for sending (should already be open from waitForFullConnection)
      if (!WebRTCDataChannelService.getInstance().isOfferChannelOpen) {
        throw new Error("Offer channel not open - authentication cannot proceed");
      }

      this.logger.info(
        "ConnectionManager",
        "Offer channel is open, proceeding with authentication"
      );

      // Get credentials from Redux store
      const credentials = selectAuthCredentials(store.getState());

      this.logger.debug("ConnectionManager", "Attempting authentication with credentials", {
        grant_type: credentials.grant_type,
        client_id: credentials.client_id,
        username: credentials.username,
        hasPassword: !!credentials.password,
      });

      // Prepare authentication request
      const authRequest = {
        grant_type: credentials.grant_type,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        username: credentials.username,
        password: credentials.password,
      };

      // Send authentication request via WebRTC
      const authResponse = await webRTCApiService.authenticate(authRequest);

      // Encrypt tokens before storing in Redux
      const encryptedAuthResponse = await tokenService.encryptAuthResponse(authResponse);

      // Update Redux store with encrypted authentication tokens
      store.dispatch(authenticationSuccess(encryptedAuthResponse));

      // Authentication state is managed by authSlice

      this.logger.info("ConnectionManager", "Authentication successful (tokens encrypted)");
    } catch (error) {
      this.logger.error("ConnectionManager", "Authentication failed", error);

      const errorMessage = error instanceof Error ? error.message : "Authentication failed";
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
   * Get connection manager configuration
   */
  getConfig(): Readonly<Required<ConnectionManagerConfig>> {
    return this.config;
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
  async destroy(): Promise<void> {
    this.isDestroyed = true;
    this.clearAllTimers();
    this.stopIdleMonitoring();
    await this.disconnect();
  }

  // Private methods

  private async waitForFullConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxWaitTime = 30000; // 30 seconds max wait time
      const checkInterval = 500;
      let elapsedTime = 0;

      // Use setInterval instead of recursive setTimeout
      this.waitForConnectionTimer = setInterval(() => {
        if (this.isDestroyed) {
          this.clearWaitForConnectionTimer();
          reject(new Error("Connection manager destroyed"));
          return;
        }

        if (elapsedTime >= maxWaitTime) {
          this.clearWaitForConnectionTimer();
          reject(new Error("Connection timeout"));
          return;
        }

        if (!this.sipClient) {
          elapsedTime += checkInterval;
          return;
        }

        // Check if SipClient is in CONNECTED or CONNECTING_P2P state AND both channels are open
        const sipState = this.sipClient.getState();
        const isFullyConnected = !!(
          (sipState === SipClientState.CONNECTED || sipState === SipClientState.CONNECTING_P2P) &&
          WebRTCDataChannelService.getInstance().isReadyForCommunication
        );

        if (isFullyConnected) {
          this.clearWaitForConnectionTimer();
          resolve();
        } else {
          elapsedTime += checkInterval;
        }
      }, checkInterval);
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

  /**
   * Start idle activity monitoring
   */
  private startIdleMonitoring(): void {
    if (!this.config.enableIdleDisconnect) {
      this.logger.info("ConnectionManager", "Idle disconnect is disabled");
      return;
    }

    if (this.idleMonitor) {
      this.logger.warn("ConnectionManager", "Idle monitor already running");
      return;
    }

    this.logger.info(
      "ConnectionManager",
      `Starting idle monitoring (timeout: ${this.config.idleTimeout}ms)`
    );

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
      this.logger.info("ConnectionManager", "Stopping idle monitoring");
      this.idleMonitor.stop();
      this.idleMonitor = null;
    }
  }

  /**
   * Handle user going idle - disconnect to save resources
   */
  private handleUserIdle(): void {
    this.logger.info("ConnectionManager", "User went idle - disconnecting");

    const state = selectConnectionState(store.getState());
    const isConnected = state.sipClientState === SipClientState.CONNECTED;
    if (!isConnected) {
      this.logger.info("ConnectionManager", "Already disconnected, skipping idle disconnect");
      return;
    }

    // Mark as idle and track when disconnected
    store.dispatch(setIdle(true));
    store.dispatch(setDisconnectedDueToIdleAt(new Date().toISOString()));
    this.disconnectedDueToIdle = true;

    // Update status before disconnecting
    this.updateConnectionState({ connectionStatus: "Disconnected due to inactivity (5 min idle)" });

    // Disconnect
    this.disconnect().catch((error) => {
      this.logger.error("ConnectionManager", "Error during idle disconnect", error);
      // Clear idle flag on error to maintain consistent state
      this.disconnectedDueToIdle = false;
      store.dispatch(setDisconnectedDueToIdleAt(undefined));
    });
  }

  /**
   * Handle user becoming active - reconnect if was idle-disconnected
   */
  private handleUserActive(): void {
    this.logger.info("ConnectionManager", "User became active");

    // Update activity timestamp
    store.dispatch(updateLastActivity());
    store.dispatch(setIdle(false));

    // Check if we should reconnect
    if (this.disconnectedDueToIdle) {
      // Clear flag immediately to prevent race conditions
      this.disconnectedDueToIdle = false;
      store.dispatch(setDisconnectedDueToIdleAt(undefined));
      store.dispatch(setAutoReconnectPending(false));

      if (this.config.reconnectOnActivity) {
        // Don't start reconnect if already reconnecting or connecting
        const state = selectConnectionState(store.getState());
        const isConnecting =
          state.sipClientState === SipClientState.REGISTERING ||
          state.sipClientState === SipClientState.CONNECTING ||
          state.sipClientState === SipClientState.CONNECTING_P2P;

        if (this.isReconnecting || isConnecting) {
          this.logger.info(
            "ConnectionManager",
            "Already reconnecting/connecting, skipping post-idle reconnect"
          );
          return;
        }

        this.logger.info("ConnectionManager", "Reconnecting after idle period");

        // Update status and reconnect
        this.updateConnectionState({ connectionStatus: "Reconnecting after inactivity..." });

        this.connect().catch((error) => {
          this.logger.error("ConnectionManager", "Error during post-idle reconnect", error);
        });
      }
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearWaitForConnectionTimer(): void {
    if (this.waitForConnectionTimer) {
      clearInterval(this.waitForConnectionTimer);
      this.waitForConnectionTimer = null;
    }
  }

  private clearAllTimers(): void {
    this.clearReconnectTimer();
    this.clearWaitForConnectionTimer();
  }

  private updateConnectionState(updates: Partial<ConnectionState>): void {
    store.dispatch(updateReduxConnectionState(updates));
  }
}

// Singleton instance
let connectionManagerInstance: WebRTCConnectionManager | null = null;

/**
 * Get singleton WebRTC Connection Manager instance
 * Uses default configuration - config is internal to the singleton
 */
export const getWebRTCConnectionManager = (): WebRTCConnectionManager => {
  if (!connectionManagerInstance) {
    connectionManagerInstance = new WebRTCConnectionManager();
  }
  return connectionManagerInstance;
};

/**
 * Reset singleton instance (useful for testing)
 */
export const resetWebRTCConnectionManager = async (): Promise<void> => {
  if (connectionManagerInstance) {
    await connectionManagerInstance.destroy();
    connectionManagerInstance = null;
  }
};
