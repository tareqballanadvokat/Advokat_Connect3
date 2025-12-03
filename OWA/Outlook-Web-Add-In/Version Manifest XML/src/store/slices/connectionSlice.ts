// src/store/slices/connectionSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isRegistered: boolean;
  isConnectionEstablished: boolean;
  isPeerConnected: boolean;
  isDataChannelOpen: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  connectionStatus: string;
  lastError?: string;
  reconnectAttempts: number;
  lastSuccessfulConnection?: string;
}

export interface ConnectionHealth {
  isHealthy: boolean;
  latency: number;
  lastHealthCheck: string;
  consecutiveFailures: number;
}

interface ConnectionSliceState {
  state: ConnectionState;
  health: ConnectionHealth;
}

const initialState: ConnectionSliceState = {
  state: {
    isConnected: false,
    isConnecting: false,
    isRegistered: false,
    isConnectionEstablished: false,
    isPeerConnected: false,
    isDataChannelOpen: false,
    isAuthenticated: false,
    isAuthenticating: false,
    connectionStatus: 'Initializing...',
    reconnectAttempts: 0,
  },
  health: {
    isHealthy: false,
    latency: 0,
    lastHealthCheck: new Date().toISOString(),
    consecutiveFailures: 0,
  },
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    updateConnectionState: (state, action: PayloadAction<Partial<ConnectionState>>) => {
      state.state = { ...state.state, ...action.payload };
    },

    updateConnectionStatus: (state, action: PayloadAction<string>) => {
      state.state.connectionStatus = action.payload;
    },

    setConnected: (state, action: PayloadAction<boolean>) => {
      state.state.isConnected = action.payload;
      if (action.payload) {
        state.state.lastSuccessfulConnection = new Date().toISOString();
        state.state.reconnectAttempts = 0;
      }
    },

    setConnecting: (state, action: PayloadAction<boolean>) => {
      state.state.isConnecting = action.payload;
    },

    setRegistered: (state, action: PayloadAction<boolean>) => {
      state.state.isRegistered = action.payload;
    },

    setConnectionEstablished: (state, action: PayloadAction<boolean>) => {
      state.state.isConnectionEstablished = action.payload;
    },

    setPeerConnected: (state, action: PayloadAction<boolean>) => {
      state.state.isPeerConnected = action.payload;
    },

    setDataChannelOpen: (state, action: PayloadAction<boolean>) => {
      state.state.isDataChannelOpen = action.payload;
    },

    setConnectionError: (state, action: PayloadAction<string>) => {
      state.state.lastError = action.payload;
      state.state.isConnecting = false;
      state.state.isConnected = false;
    },

    incrementReconnectAttempts: (state) => {
      state.state.reconnectAttempts += 1;
    },

    resetReconnectAttempts: (state) => {
      state.state.reconnectAttempts = 0;
    },

    updateConnectionHealth: (state, action: PayloadAction<Partial<ConnectionHealth>>) => {
      state.health = { 
        ...state.health, 
        ...action.payload,
        lastHealthCheck: new Date().toISOString()
      };
    },

    resetConnection: (state) => {
      state.state = initialState.state;
      state.health = initialState.health;
    },
  },
});

// Export actions
export const {
  updateConnectionState,
  updateConnectionStatus,
  setConnected,
  setConnecting,
  setRegistered,
  setConnectionEstablished,
  setPeerConnected,
  setDataChannelOpen,
  setConnectionError,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  updateConnectionHealth,
  resetConnection,
} = connectionSlice.actions;

// Selectors
export const selectConnectionState = (state: RootState) => state.connection.state;
export const selectConnectionHealth = (state: RootState) => state.connection.health;
export const selectIsConnected = (state: RootState) => state.connection.state.isConnected;
export const selectIsConnecting = (state: RootState) => state.connection.state.isConnecting;
export const selectIsRegistered = (state: RootState) => state.connection.state.isRegistered;
export const selectIsConnectionEstablished = (state: RootState) => state.connection.state.isConnectionEstablished;
export const selectConnectionStatus = (state: RootState) => state.connection.state.connectionStatus;
export const selectIsReady = (state: RootState) => 
  state.connection.state.isConnected && 
  state.connection.state.isRegistered && 
  state.connection.state.isConnectionEstablished &&
  state.connection.state.isDataChannelOpen;

export default connectionSlice.reducer;
