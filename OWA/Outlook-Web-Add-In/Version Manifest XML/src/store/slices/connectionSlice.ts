/* eslint-disable no-undef */
// src/store/slices/connectionSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "@store";
import { SipClientState } from "@infra/sip/SipClient";

export interface ConnectionState {
  // Core state - single source of truth
  sipClientState: SipClientState; // DISCONNECTED, REGISTERING, CONNECTING, CONNECTING_P2P, CONNECTED, FAILED

  // User-friendly status message
  connectionStatus: string; // "Connecting...", "Connected", etc.

  // Error tracking
  lastError?: string;

  // Reconnection tracking
  reconnectAttempts: number;
  lastSuccessfulConnection?: string;

  // Idle management
  isIdle: boolean;
  lastActivityTimestamp?: string;
  idleDisconnectedAt?: string;
}

const initialState: ConnectionState = {
  sipClientState: SipClientState.DISCONNECTED,
  connectionStatus: "Disconnected",
  reconnectAttempts: 0,
  isIdle: false,
};

const connectionSlice = createSlice({
  name: "connection",
  initialState,
  reducers: {
    updateConnectionState: (state, action: PayloadAction<Partial<ConnectionState>>) => {
      return { ...state, ...action.payload };
    },

    updateConnectionStatus: (state, action: PayloadAction<string>) => {
      state.connectionStatus = action.payload;
    },

    setConnectionError: (state, action: PayloadAction<string>) => {
      state.lastError = action.payload;
      state.sipClientState = SipClientState.FAILED;
      state.connectionStatus = "Connection failed";
    },

    incrementReconnectAttempts: (state) => {
      state.reconnectAttempts += 1;
    },

    resetReconnectAttempts: (state) => {
      state.reconnectAttempts = 0;
    },

    resetConnection: () => {
      return initialState;
    },

    setIdle: (state, action: PayloadAction<boolean>) => {
      state.isIdle = action.payload;
    },

    updateLastActivity: (state) => {
      state.lastActivityTimestamp = new Date().toISOString();
    },

    setDisconnectedDueToIdleAt: (state, action: PayloadAction<string | undefined>) => {
      state.idleDisconnectedAt = action.payload;
    },

    sipClientStateChanged: (state, action: PayloadAction<SipClientState>) => {
      const sipState = action.payload;
      state.sipClientState = sipState;

      // Auto-update connectionStatus based on sipClientState
      switch (sipState) {
        case SipClientState.DISCONNECTED:
          state.connectionStatus = "Disconnected";
          break;
        case SipClientState.REGISTERING:
          state.connectionStatus = "Connecting.";
          break;
        case SipClientState.CONNECTING:
          state.connectionStatus = "Connecting..";
          break;
        case SipClientState.CONNECTING_P2P:
          state.connectionStatus = "Connecting...";
          break;
        case SipClientState.CONNECTED:
          state.connectionStatus = "Connected";
          state.lastSuccessfulConnection = new Date().toISOString();
          state.reconnectAttempts = 0;
          break;
        case SipClientState.FAILED:
          state.connectionStatus = "Connection failed";
          break;
        case SipClientState.FAILED_PERMANENTLY:
          state.connectionStatus = "Connection failed permanently";
          break;
      }
    },
  },
});

// Export actions
export const {
  updateConnectionState,
  updateConnectionStatus,
  setConnectionError,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  resetConnection,
  setIdle,
  updateLastActivity,
  setDisconnectedDueToIdleAt,
  sipClientStateChanged,
} = connectionSlice.actions;

// Selectors
export const selectConnectionState = (state: RootState) => state.connection;
export const selectConnectionStatus = (state: RootState) => state.connection.connectionStatus;
export const selectSipClientState = (state: RootState) => state.connection.sipClientState;

// Derived selectors based on sipClientState (single source of truth)
export const selectIsConnected = (state: RootState) =>
  state.connection.sipClientState === SipClientState.CONNECTED;

export const selectIsConnecting = (state: RootState) => {
  const s = state.connection.sipClientState;
  return s === SipClientState.REGISTERING || s === SipClientState.CONNECTING || s === SipClientState.CONNECTING_P2P;
};

export const selectIsFailed = (state: RootState) => state.connection.sipClientState === SipClientState.FAILED;

export const selectIsDisconnected = (state: RootState) =>
  state.connection.sipClientState === SipClientState.DISCONNECTED;

// Network availability (browser online/offline)
export const selectIsNavigatorOffline = () =>
  typeof navigator !== "undefined" ? !navigator.onLine : false;

export const selectIsNavigatorOnline = () =>
  typeof navigator !== "undefined" ? navigator.onLine : true;

// Cross-slice selector: connection + authentication
export const selectIsReady = (state: RootState) =>
  state.connection.sipClientState === SipClientState.CONNECTED &&
  state.auth?.isAuthenticated === true &&
  selectIsNavigatorOnline();

// Returns the reason why connection is not ready
export const selectNotReadyReason = (state: RootState): string => {
  if (!selectIsNavigatorOnline()) {
    return "Network offline";
  }
  if (state.connection.sipClientState !== SipClientState.CONNECTED) {
    return "SIP not connected";
  }
  if (!state.auth?.isAuthenticated) {
    return "Not authenticated";
  }
  return "Not connected";
};

export default connectionSlice.reducer;
