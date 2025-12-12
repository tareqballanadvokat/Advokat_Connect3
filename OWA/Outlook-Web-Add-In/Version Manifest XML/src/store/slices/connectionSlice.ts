// src/store/slices/connectionSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { SipClientState } from '../../taskpane/components/SIP_Library/SipClient';

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
  autoReconnectPending: boolean;
}

const initialState: ConnectionState = {
  sipClientState: SipClientState.DISCONNECTED,
  connectionStatus: 'Disconnected',
  reconnectAttempts: 0,
  isIdle: false,
  autoReconnectPending: false,
};

const connectionSlice = createSlice({
  name: 'connection',
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
      state.connectionStatus = 'Connection failed';
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

    setIdleDisconnected: (state, action: PayloadAction<string | undefined>) => {
      state.idleDisconnectedAt = action.payload;
      if (action.payload) {
        state.autoReconnectPending = true;
      }
    },

    setAutoReconnectPending: (state, action: PayloadAction<boolean>) => {
      state.autoReconnectPending = action.payload;
    },

    sipClientStateChanged: (state, action: PayloadAction<SipClientState>) => {
      const sipState = action.payload;
      state.sipClientState = sipState;
      
      // Auto-update connectionStatus based on sipClientState
      switch (sipState) {
        case 'DISCONNECTED':
          state.connectionStatus = 'Disconnected';
          break;
        case 'REGISTERING':
          state.connectionStatus = 'Connecting.';
          break;
        case 'CONNECTING':
          state.connectionStatus = 'Connecting..';
          break;
        case 'CONNECTING_P2P':
          state.connectionStatus = 'Connecting...';
          break;
        case 'CONNECTED':
          state.connectionStatus = 'Connected';
          if (!state.lastSuccessfulConnection) {
            state.lastSuccessfulConnection = new Date().toISOString();
          }
          state.reconnectAttempts = 0;
          break;
        case 'FAILED':
          state.connectionStatus = 'Connection failed';
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
  setIdleDisconnected,
  setAutoReconnectPending,
  sipClientStateChanged,
} = connectionSlice.actions;

// Selectors
export const selectConnectionState = (state: RootState) => state.connection;
export const selectConnectionStatus = (state: RootState) => state.connection.connectionStatus;
export const selectSipClientState = (state: RootState) => state.connection.sipClientState;

// Derived selectors based on sipClientState (single source of truth)
export const selectIsConnected = (state: RootState) => 
  state.connection.sipClientState === 'CONNECTED';

export const selectIsConnecting = (state: RootState) => {
  const s = state.connection.sipClientState;
  return s === 'REGISTERING' || s === 'CONNECTING' || s === 'CONNECTING_P2P';
};

export const selectIsFailed = (state: RootState) =>
  state.connection.sipClientState === 'FAILED';

export const selectIsDisconnected = (state: RootState) =>
  state.connection.sipClientState === 'DISCONNECTED';

// Cross-slice selector: connection + authentication
export const selectIsReady = (state: RootState) => 
  state.connection.sipClientState === 'CONNECTED' && 
  state.auth?.isAuthenticated === true;

export default connectionSlice.reducer;
