/* eslint-disable no-undef */

// WebRTC Connection Manager - Robust connection management with auto-recovery

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


import {
  SipClientInstance,
  SipClientState,
  SipClientObserver,
  initializeSipClient,
} from "@infra/sip/SipClient";
import { webRTCApiService } from "./webRTCApiService";
import { tokenService } from "./TokenService";
import { IdleActivityMonitor } from "./IdleActivityMonitor";
import { WebRTCDataChannelService } from "./WebRTCDataChannelService";
import { store } from "@store";
import { getLogger } from "@infra/logger";
import {
  startAuthentication,
  authenticationSuccess,
  authenticationFailure,
  selectAuthCredentials,
} from "@slices/authSlice";
import {
  updateConnectionState as updateReduxConnectionState,
  selectConnectionState,
  ConnectionState,
  setIdle,
  updateLastActivity,
  setDisconnectedDueToIdleAt,
  sipClientStateChanged,
  setSelectedCandidateType,
  selectIsReady,
} from "@slices/connectionSlice";
import { SelectedCandidateType } from "@infra/sip/Peer2PeerConnection";

export type { ConnectionState };

export interface ConnectionManagerConfig {
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  enableAutoReconnect?: boolean;
  idleTimeout?: number; // Time before user is considered idle
  enableIdleDisconnect?: boolean; // Enable idle disconnect feature (default: true)
  reconnectOnActivity?: boolean; // Reconnect when user becomes active (default: true)
}

const DEFAULT_CONFIG: Required<ConnectionManagerConfig> = {
  maxReconnectAttempts: 2,
  reconnectDelay: 3000,
  enableAutoReconnect: true,
  idleTimeout: 5 * 60 * 1000, // 1 minute
  enableIdleDisconnect: true,
  reconnectOnActivity: true,
};

export class WebRTCConnectionManager implements SipClientObserver {
  private config: Required<ConnectionManagerConfig>;
  private sipClient: SipClientInstance | null = null;
  private logger = getLogger();

  // Timers
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Pending waitForFullConnection promise callbacks (state-change driven, no polling timer)
  private _connectionResolve: (() => void) | null = null;
  private _connectionReject: ((err: Error) => void) | null = null;

  // Idle monitoring
  private idleMonitor: IdleActivityMonitor | null = null;
  private disconnectedDueToIdle: boolean = false;

  // Internal flags
  private isInitialized = false;
  private isReconnecting = false;
  private isDisconnectingFromIdle = false;
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

    store.dispatch(sipClientStateChanged(newState));

    if (newState === SipClientState.CONNECTED) {
      // Successfully connected - resolve any pending waitForFullConnection promise first,
      // then update Redux. handlePermanentFailure is NOT called here.
      this.logger.info("ConnectionManager", "CONNECTED state detected");
      this._resolvePendingConnection();
      this.updateConnectionState({
        reconnectAttempts: 0,
        lastError: undefined,
      });
    } else if (newState === SipClientState.FAILED_PERMANENTLY) {
      // Reject the pending promise BEFORE handlePermanentFailure() sets isReconnecting=true.
      // That flag will block handleConnectionError() from scheduling a duplicate reconnect
      // once connect()'s catch block runs as a microtask.
      this.logger.info(
        "ConnectionManager",
        "FAILED_PERMANENTLY state detected - will attempt full reconnection"
      );
      this._rejectPendingConnection(new Error(`Connection failed permanently: ${reason}`));
      this.handlePermanentFailure(reason);
    } else if (newState === SipClientState.DISCONNECTED) {
      // DISCONNECTED indicates deliberate disconnect - reject any pending promise and do not reconnect
      this.logger.info(
        "ConnectionManager",
        "DISCONNECTED state detected - no automatic reconnection"
      );
      this._rejectPendingConnection(new Error(`Connection disconnected: ${reason}`));
      this.updateConnectionState({
        reconnectAttempts: 0,
      });
    }
  }

  /**
   * Observer pattern callback - called when the ICE candidate type used for the connection is known
   */
  onSelectedCandidateType(type: SelectedCandidateType): void {
    this.logger.info("ConnectionManager", `Selected ICE candidate type: ${type}`);
    store.dispatch(setSelectedCandidateType(type));
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

    // Create and store initialization promise
    this.initializationPromise = (async () => {
      this.updateConnectionState({ connectionStatus: "Initializing connection manager..." });

      try {
        await this.connect();
        // Idle monitoring is started by connect() after successful connection
        // Set isInitialized BEFORE clearing initializationPromise to prevent race conditions
        this.isInitialized = true;
      } catch (error) {
        this.logger.error(
          "ConnectionManager",
          "Failed to initialize WebRTC Connection Manager",
          error
        );
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
    if (isConnecting) {
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

      // Suspend until onSipClientStateChanged resolves (CONNECTED) or rejects
      // (FAILED_PERMANENTLY / DISCONNECTED / clearAllTimers called by disconnect())
      await new Promise<void>((resolve, reject) => {
        this._connectionResolve = resolve;
        this._connectionReject = reject;
      });
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

      // Null the reference so getSipClient() does not return a dead instance,
      // and so subsequent disconnect() calls skip redundant SipClient cleanup.
      this.sipClient = null;

      // Clean up the API service - it was initialized with the now-failed SipClient
      // and is subscribed to DataChannel events it will never receive.
      webRTCApiService.cleanup();

      this.handleConnectionError(error);
      throw error;
    }

    // Authentication and post-connection setup run OUTSIDE the try-catch above.
    // A failed auth request (e.g. HTTP 400) is an application-level error, not a
    // connection failure. It must NOT trigger connection teardown or a reconnect.
    await this.performAuthentication();

    // Start idle monitoring only after successful connection + authentication
    this.startIdleMonitoring();

    // Clear any existing reconnect timer
    this.clearReconnectTimer();
  }

  /**
   * Disconnect from WebRTC
   * 
   * This method is the CENTRALIZED cleanup point for:
   * - Timers (reconnect, wait for connection)
   * - Idle monitoring (optional via stopIdleMonitor param)
   * - SipClient disconnection and unsubscription
   * - DataChannel cleanup
   * 
   * @param resetReconnectCounter - Whether to reset the reconnect attempt counter (default: true)
   *                                Set to false when disconnecting as part of a reconnect cycle
   * @param stopIdleMonitor - Whether to stop idle monitoring (default: true)
   *                         Set to false when disconnecting due to idle to keep monitoring for user return
   */
  async disconnect(resetReconnectCounter: boolean = true, stopIdleMonitor: boolean = true): Promise<void> {
    this.updateConnectionState({ connectionStatus: "Disconnecting..." });

    // 1. Clear all timers (reconnect, waitForConnection)
    this.clearAllTimers();

    // 2. Stop idle monitoring (unless explicitly told not to, e.g., during idle disconnect)
    if (stopIdleMonitor) {
      this.stopIdleMonitoring();
    }

    // 3. Reset reconnecting flag only on explicit external disconnects.
    // When called from within a reconnect cycle (resetReconnectCounter=false), keep the flag
    // so that handleConnectionError() knows not to schedule a second parallel reconnect.
    if (resetReconnectCounter) {
      this.isReconnecting = false;
    }

    // 4. Disconnect and cleanup SipClient
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

    // 5. Clear DataChannels from service to prevent stale references
    WebRTCDataChannelService.getInstance().reset();

    // 6. Reset reconnect attempts counter (unless part of reconnect cycle)
    if (resetReconnectCounter) {
      this.updateConnectionState({
        reconnectAttempts: 0,
      });
    }

    // 7. Mark as no longer initialized so initialize() can run again
    this.isInitialized = false;

    // 8. Explicitly update Redux to DISCONNECTED.
    // We unsubscribed from SipClient before calling sipClient.disconnect(), so
    // SipClient's internal transitionClientState(DISCONNECTED) fires after unsubscribe
    // and never reaches onSipClientStateChanged - Redux would stay stale otherwise.
    store.dispatch(sipClientStateChanged(SipClientState.DISCONNECTED));
  }

  /**
   * Reconnect with exponential backoff
   */
  async reconnect(force: boolean = false): Promise<void> {
    if (this.isReconnecting && !force) {
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

    const attemptNumber = force ? 1 : state.reconnectAttempts + 1;
    const delay = this.calculateReconnectDelay(attemptNumber);

    // Update attempt counter immediately (before timer) to prevent race conditions
    // If reconnect() is called again before timer fires, it will see the updated count
    this.updateConnectionState({
      reconnectAttempts: attemptNumber,
    });

    this.reconnectTimer = setTimeout(async () => {
      if (!this.isReconnecting) {
        this.logger.info("ConnectionManager", "Reconnect cancelled during delay");
        return;
      }

      try {
        // Full reconnect cycle - don't reset the reconnect counter
        // disconnect() will stop idle monitoring (stopIdleMonitor=true) and clear timers
        await this.disconnect(false, true);

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

        if (attemptNumber < maxAttempts && this.config.enableAutoReconnect) {
          // Schedule next attempt (will set isReconnecting again)
          this.reconnect();
        } else {
          // All attempts exhausted - run a final cleanup to release all resources
          // (sipClient, webRTCApiService subscription, DataChannels).
          // resetReconnectCounter=true: reset counter so a future manual call starts clean.
          // stopIdleMonitor=true: stop monitoring, we are fully giving up.
          // Must be awaited so the final status message is set AFTER disconnect()
          // finishes dispatching DISCONNECTED and updating connectionStatus.
          try {
            await this.disconnect(true, true);
          } catch (cleanupError) {
            this.logger.warn("ConnectionManager", "Error during post-reconnect cleanup", cleanupError);
          }
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

      // Authentication errors (e.g. wrong credentials → HTTP 400/401) are tracked in
      // authSlice and surfaced to the user via the WebRTCConnectionStatus banner.
      // We deliberately do NOT rethrow here: the WebRTC connection is still alive and
      // healthy, so there is nothing to reconnect. Rethrowing would propagate to
      // initialize()'s catch block and could schedule a pointless reconnect attempt.
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

  // Private methods

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

    store.dispatch(setIdle(true));
    store.dispatch(setDisconnectedDueToIdleAt(new Date().toISOString()));
    this.disconnectedDueToIdle = true;
    this.isDisconnectingFromIdle = true;

    // Disconnect but KEEP idle monitoring running (stopIdleMonitor = false)
    // This ensures the monitor stays in "idle" state and can detect user return
    this.disconnect(true, false).then(() => {
      this.isDisconnectingFromIdle = false;

      // If user became active while we were disconnecting, reconnect now
      if (!this.disconnectedDueToIdle && this.config.reconnectOnActivity) {
        this.logger.info("ConnectionManager", "User returned during idle disconnect - reconnecting now");
        this.updateConnectionState({ connectionStatus: "Reconnecting after inactivity..." });
        this.connect().catch((error) => {
          this.logger.error("ConnectionManager", "Error during post-idle reconnect", error);
        });
      } else if (this.disconnectedDueToIdle) {
        // Update status AFTER disconnect completes
        this.updateConnectionState({ connectionStatus: "Disconnected due to inactivity (1 min idle)" });
      }
    }).catch((error) => {
      this.isDisconnectingFromIdle = false;
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
    this.logger.debug(
      "ConnectionManager",
      `Checking idle reconnect: disconnectedDueToIdle=${this.disconnectedDueToIdle}, reconnectOnActivity=${this.config.reconnectOnActivity}`
    );

    if (this.disconnectedDueToIdle) {
      this.logger.info("ConnectionManager", "User was idle-disconnected, initiating reconnection");

      // Clear flag immediately to prevent race conditions
      this.disconnectedDueToIdle = false;
      store.dispatch(setDisconnectedDueToIdleAt(undefined));

      if (this.isDisconnectingFromIdle) {
        // disconnect() is still in progress - handleUserIdle's .then() will detect the cleared
        // flag and trigger connect() once disconnect fully completes
        this.logger.info(
          "ConnectionManager",
          "Idle disconnect still in progress - reconnect will be handled after disconnect completes"
        );
        return;
      }

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
      } else {
        this.logger.info("ConnectionManager", "Auto-reconnect on activity is disabled");
      }
    } else {
      this.logger.debug("ConnectionManager", "User was not idle-disconnected, no reconnection needed");
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Resolve the pending waitForFullConnection promise, if any. */
  private _resolvePendingConnection(): void {
    const resolve = this._connectionResolve;
    this._connectionResolve = null;
    this._connectionReject = null;
    resolve?.();
  }

  /** Reject the pending waitForFullConnection promise, if any. Idempotent. */
  private _rejectPendingConnection(err: Error): void {
    const reject = this._connectionReject;
    this._connectionResolve = null;
    this._connectionReject = null;
    reject?.(err);
  }

  private clearAllTimers(): void {
    this.clearReconnectTimer();
    // Reject any pending waitForFullConnection so connect() unblocks on explicit teardown
    this._rejectPendingConnection(new Error("Connection aborted: timers cleared"));
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


